import Papa from 'papaparse';
import { hasGluedSensitiveColumn } from './identity.ts';
import { fixMojibake } from './mojibake.ts';

/**
 * Defensive CSV parser for one file (RESEARCH.md Pattern 2 + D-03, hardened by
 * 02-05 for CR-01 / CR-02 / CR-03 of 02-REVIEW.md).
 *
 * Why this exists (02-01-PLAN Task 3, IMPORT-03, IMPORT-04, D-03):
 *   Every category's CSV is parsed here, in the worker, before being
 *   written to Dexie. The wrapper does what the bare `Papa.parse` call
 *   would not:
 *
 *     1. Normalises the text (one BOM, then any leading line breaks, which
 *        the real export starts with) and picks the DELIMITER FROM THE
 *        HEADER LINE ONLY. PapaParse's own sniff reads body records, so one
 *        short row flipped a two-column file to a comma and glued every row
 *        under one key (CR-03).
 *     2. Fails closed on an untrustworthy header: an unterminated or
 *        malformed quote in the header, or a key that hides a D-18
 *        deny-listed name inside a longer key (`hasGluedSensitiveColumn`),
 *        withholds the WHOLE file. No row is returned, every non-empty data
 *        line is counted in `skippedCount`, and one `[csv-parse] file
 *        withheld` log carries the reason (never any cell or header text).
 *     3. Keeps blank records in the PapaParse parse (`skipEmptyLines`
 *        false) and filters them itself. PapaParse numbers the header as
 *        record 0, so with every blank record retained an error on record
 *        `row` is `data[row - 1]` exactly (CR-02). A record is blank when
 *        its only key holds the empty string; a whitespace-only value is a
 *        row, as before.
 *     4. Treats ragged-column errors (`FieldMismatch`, `TooFewFields`,
 *        `TooManyFields`) as NON-fatal (D-03): a missing trailing field is
 *        a missing key and an extra field lands in `__parsed_extra`.
 *     5. Treats a `Quotes` error as structural corruption (D-03). Two shapes:
 *          - single-line: the record has no line break in any cell, so just
 *            that record is dropped and counted;
 *          - spanning: the quote opened a field that swallowed physical
 *            lines. Only the physical line holding the opening quote is
 *            quarantined and counted, the remainder is re-parsed so the rows
 *            after it are recovered (CR-01). Every quarantine and every
 *            recovered row is reflected in `skippedCount` / `rows`.
 *        The stated limitation: the quarantine unit is the physical line
 *        holding the opening quote, so the continuation lines of an
 *        unterminated multi-line field come back as ordinary rows.
 *     6. Bounds the recovery. Each quarantine re-parses the remaining text,
 *        so the loop is quadratic on a hostile file; past
 *        `MAX_QUARANTINED_RECORDS` the unread remainder is withheld AND
 *        counted (D-04), under its own `[csv-parse] remainder withheld` tag.
 *        This is a work bound, not a size cap: nothing is rejected by size.
 *     7. Runs `fixMojibake` on every string value of every kept row (IMPORT-04
 *        / D-01: parse every category, not just the supported ones).
 *     8. Splits a file that mixes terminator kinds on each record's OWN
 *        terminator (02-06, W-2). PapaParse picks ONE line break per file, so
 *        a record joined by another terminator was glued into its neighbour
 *        with `skippedCount` 0. When two or more of CRLF, bare CR and bare LF
 *        occur anywhere in the text, every CRLF and every bare CR is rewritten
 *        to LF and PapaParse is told `newline: '\n'`. A UNIFORM file is not
 *        touched: its cell bytes are exactly what they were. Consequences,
 *        stated so a later review does not mistake them for regressions:
 *          - in a MIXED file only, a CR or CRLF inside a quoted cell is
 *            rewritten to LF. The break still stays inside the cell and never
 *            splits the record;
 *          - the common Excel-style file (CRLF terminators with an Alt+Enter
 *            bare LF inside a quoted cell) counts as "mixed", so it takes this
 *            path: its cells keep their exact LF, the parse is correct, and
 *            only a CR or CRLF inside a quoted cell of that same file becomes
 *            LF;
 *          - an unquoted bare CR in the middle of a record of a CRLF file now
 *            ends the record;
 *          - a CR directly before a CRLF is two terminators and produces one
 *            blank record, which the wrapper filters;
 *          - PapaParse's own guess inspects only the first MiB of the text;
 *            the mixed check covers the whole text;
 *          - `line` numbers count each terminator kind as one physical line.
 *
 * Per-skip logging follows the `[bracket-tag] short-message, detail` shape
 * used by `ingest.worker.ts`. `line` is the 1-based physical line in the
 * BOM-free file, counting leading blank lines. The detail carries category,
 * sourceFile, line and reason, never cell content (D-03, privacy).
 *
 * PapaParse runs with `worker: false`: this module already executes inside
 * the ingest worker, and a nested worker would be redundant (AGENTS.md).
 */

export interface ParsedRow {
  data: Record<string, string | undefined>;
}

export interface ParsedFile {
  rows: ParsedRow[];
  skippedCount: number;
}

/** A physical line terminator, any of the three the exports are known to use. */
const LINE_BREAK = /\r\n|\r|\n/;

/**
 * Do two or more terminator kinds (CRLF, a bare CR, a bare LF) occur anywhere
 * in `text`? (W-2) False without a CR at all. Three linear native scans over
 * the WHOLE text, so a mix that sits past PapaParse's own first-MiB guess is
 * still seen.
 */
function hasMixedTerminators(text: string): boolean {
  if (!text.includes('\r')) return false;
  let kinds = 0;
  if (text.includes('\r\n')) kinds++;
  if (/\r(?!\n)/.test(text)) kinds++;
  if (/(?<!\r)\n/.test(text)) kinds++;
  return kinds >= 2;
}

/**
 * Pick the delimiter from the HEADER LINE ONLY (CR-03). PapaParse's own sniff
 * reads the first ten body records, so one short row in a two-column file drags
 * the average under 1.99 and flips the delimiter to a comma, which glues every
 * row under a single key and lets `LOGIN;BIRTH_DATE` content bypass the
 * header-keyed strip. The header is the one line whose shape is not data
 * dependent.
 *
 * The first of `;` `,` tab `|` (in that priority) that appears OUTSIDE a
 * double-quoted span of the header line wins; with none, `;`, the documented
 * export format. A linear scan: no regular expression, so no backtracking.
 */
function chooseDelimiter(headerLine: string): string {
  let inQuotes = false;
  let semicolon = false;
  let comma = false;
  let tab = false;
  let pipe = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ';') semicolon = true;
    else if (ch === ',') comma = true;
    else if (ch === '\t') tab = true;
    else if (ch === '|') pipe = true;
  }
  if (semicolon) return ';';
  if (comma) return ',';
  if (tab) return '\t';
  if (pipe) return '|';
  return ';';
}

/** Number of non-empty physical lines in `text` (a zero-length line is not one). */
function countNonEmptyLines(text: string): number {
  let count = 0;
  for (const line of text.split(LINE_BREAK)) {
    if (line.length > 0) count++;
  }
  return count;
}

/**
 * Withhold a whole file: no rows, every non-empty data line counted in
 * `skippedCount` (D-04), one tagged log carrying structure only (D-03).
 * Fail closed: a file whose header cannot be trusted is never partly kept.
 */
function withholdFile(
  body: string,
  headerEnd: number,
  reason: string,
  category: string,
  sourceFile: string,
): ParsedFile {
  const lines = headerEnd === -1 ? 0 : countNonEmptyLines(body.slice(headerEnd));
  console.error('[csv-parse] file withheld', { category, sourceFile, reason, lines });
  return { rows: [], skippedCount: lines };
}

/** Maximum physical lines quarantined (re-parsed) in one file; see the header note. */
export const MAX_QUARANTINED_RECORDS = 1000;

/** One record as PapaParse hands it over; values may be strings or the overflow array. */
type RawRecord = Record<string, unknown>;

/**
 * A record is blank when it has exactly one own key and that value is the empty
 * string. This is the old `skipEmptyLines: true` rule, applied by the wrapper so
 * the record numbering stays aligned with PapaParse's error rows. The overflow
 * bucket holds an array, never `''`, so it can not be mistaken for a blank.
 */
function isBlankRecord(record: RawRecord): boolean {
  const keys = Object.keys(record);
  return keys.length === 1 && record[keys[0]!] === '';
}

/** Does any cell of this record contain the file's line terminator? */
function hasLineBreak(record: RawRecord, linebreak: string): boolean {
  for (const value of Object.values(record)) {
    if (typeof value === 'string') {
      if (value.includes(linebreak)) return true;
    } else if (Array.isArray(value)) {
      for (const cell of value) {
        if (typeof cell === 'string' && cell.includes(linebreak)) return true;
      }
    }
  }
  return false;
}

/** Count `linebreak` occurrences that START in [from, to). Linear. */
function countBreaks(text: string, from: number, to: number, linebreak: string): number {
  let count = 0;
  let at = text.indexOf(linebreak, from);
  while (at !== -1 && at < to) {
    count++;
    at = text.indexOf(linebreak, at + linebreak.length);
  }
  return count;
}

/**
 * `newline` is `'\n'` only for a file whose terminators were canonicalised
 * (W-2); otherwise it is left out so PapaParse guesses exactly as before.
 */
function parseOnce(text: string, delimiter: string, newline: '\n' | undefined) {
  return Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    // Blank records stay in `data` so record numbering matches `error.row`
    // (CR-02); the wrapper filters them, see `isBlankRecord`.
    skipEmptyLines: false,
    delimiter,
    worker: false,
    ...(newline === undefined ? {} : { newline }),
  });
}

export function parseCsvFile(text: string, category: string, sourceFile: string): ParsedFile {
  // Normalise first: one leading BOM, then any run of leading line breaks, so
  // the header record is the first record (the real export starts with a CRLF).
  // `leading` counts the removed blank lines so reported line numbers stay
  // relative to the file as it was.
  let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let leading = 0;
  while (start < text.length) {
    const ch = text[start];
    if (ch === '\r') start += text[start + 1] === '\n' ? 2 : 1;
    else if (ch === '\n') start += 1;
    else break;
    leading++;
  }
  const normalised = text.slice(start);
  if (normalised === '') return { rows: [], skippedCount: 0 };

  // W-2: records split on their own terminator. In a file that mixes kinds,
  // every CRLF and bare CR becomes LF (one global replace, left to right, so a
  // CR followed by a CRLF is two terminators) and PapaParse is told LF. A
  // uniform file is left byte-identical and PapaParse guesses as before.
  const mixed = hasMixedTerminators(normalised);
  const body = mixed ? normalised.replace(/\r\n?/g, '\n') : normalised;
  const newline = mixed ? '\n' : undefined;

  const headerEnd = body.search(LINE_BREAK);
  const headerLine = headerEnd === -1 ? body : body.slice(0, headerEnd);
  const delimiter = chooseDelimiter(headerLine);

  let result = parseOnce(body, delimiter, newline);

  // Header-level fail-closed withholds (CR-03), before any row is read.
  if (result.errors.some((e) => e.type === 'Quotes' && e.row === 0)) {
    return withholdFile(body, headerEnd, 'header-quote', category, sourceFile);
  }
  if (hasGluedSensitiveColumn(result.meta.fields ?? [])) {
    return withholdFile(body, headerEnd, 'glued-sensitive-header', category, sourceFile);
  }

  const rows: ParsedRow[] = [];
  let skippedCount = 0;
  let quarantined = 0;
  // Physical lines cut out of `pending` so far (quarantined lines AND the good
  // lines that sat between the header and each one), for line numbers only.
  let removed = 0;
  let pending = body;

  const keep = (record: RawRecord): void => {
    const fixed: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(record)) {
      fixed[k] = typeof v === 'string' ? fixMojibake(v) : (v as string | undefined);
    }
    rows.push({ data: fixed });
  };

  for (;;) {
    const linebreak = result.meta.linebreak;
    const data = result.data as RawRecord[];

    // First error index per record, ascending by record. A Quotes error on the
    // header (row 0) was handled above and can not recur: the header text is
    // never rewritten.
    const firstIndex = new Map<number, number | undefined>();
    for (const error of result.errors) {
      if (error.type !== 'Quotes') continue; // ragged columns are not fatal
      if (typeof error.row !== 'number' || error.row < 1) continue;
      if (!firstIndex.has(error.row)) firstIndex.set(error.row, error.index);
    }
    const errorRows = [...firstIndex.keys()].sort((x, y) => x - y);

    // Single-line corruption: drop just that record. The first record with a
    // line break in a cell is "spanning" and ends the examination: the quoted
    // field swallowed physical lines, so everything from it on in this parse is
    // untrustworthy and is re-parsed after the quarantine.
    const dropped = new Set<number>();
    let spanningRow = -1;
    let scanFrom = 0;
    let scanBreaks = 0;
    for (const row of errorRows) {
      const record = data[row - 1];
      const index = firstIndex.get(row);
      if (record === undefined || hasLineBreak(record, linebreak)) {
        spanningRow = row;
        break;
      }
      dropped.add(row - 1);
      skippedCount++;
      let line: number | undefined;
      if (typeof index === 'number') {
        scanBreaks += countBreaks(pending, scanFrom, index, linebreak);
        scanFrom = Math.max(scanFrom, index);
        line = leading + removed + scanBreaks + 1;
      }
      console.error('[csv-parse] skipped row', { category, sourceFile, line, reason: 'Quotes' });
    }

    // Where does the quarantined line start? Needed before harvesting: if the
    // spanning record can not be located, nothing of this parse is trusted.
    const headerBreak = pending.indexOf(linebreak);
    const dataStart = headerBreak === -1 ? pending.length : headerBreak + linebreak.length;
    let lineStart = -1;
    let lineEnd = -1;
    if (spanningRow !== -1) {
      const index = firstIndex.get(spanningRow);
      if (typeof index === 'number') {
        // `index` is the offset just after the opening quote.
        const open = Math.max(index - 1, dataStart);
        const previous = pending.lastIndexOf(linebreak, open);
        lineStart = previous === -1 ? 0 : previous + linebreak.length;
        if (lineStart < dataStart) lineStart = dataStart;
        const next = pending.indexOf(linebreak, open);
        lineEnd = next === -1 ? pending.length : next + linebreak.length;
      } else {
        lineStart = dataStart;
      }
    }

    // Harvest the records before the spanning one (all of them when there is
    // none). Records after it come from the re-parse, never from this parse.
    // Unlocatable spanning record (no index): harvest nothing from this parse,
    // the whole data part is withheld and counted below.
    const harvestEnd =
      spanningRow === -1
        ? data.length
        : lineEnd === -1
          ? 0
          : Math.min(spanningRow - 1, data.length);
    for (let i = 0; i < harvestEnd; i++) {
      if (dropped.has(i)) continue;
      const record = data[i]!;
      if (isBlankRecord(record)) continue;
      keep(record);
    }

    if (spanningRow === -1) break;

    // Cap: bound the quadratic re-parse; count and log the unread remainder.
    if (lineEnd === -1 || quarantined >= MAX_QUARANTINED_RECORDS) {
      const lines = countNonEmptyLines(pending.slice(lineStart));
      skippedCount += lines;
      console.error('[csv-parse] remainder withheld', {
        category,
        sourceFile,
        line: leading + removed + countBreaks(pending, 0, lineStart, linebreak) + 1,
        reason: lineEnd === -1 ? 'quote-position-unknown' : 'quarantine-cap',
        lines,
      });
      break;
    }

    // Quarantine exactly one physical line and re-parse what follows it.
    skippedCount++;
    quarantined++;
    console.error('[csv-parse] skipped row', {
      category,
      sourceFile,
      line: leading + removed + countBreaks(pending, 0, lineStart, linebreak) + 1,
      reason: 'Quotes',
    });
    removed += countBreaks(pending, dataStart, lineEnd, linebreak);
    pending = pending.slice(0, dataStart) + pending.slice(lineEnd);
    if (pending.length === dataStart) break; // nothing left to read
    result = parseOnce(pending, delimiter, newline);
  }

  return { rows, skippedCount };
}
