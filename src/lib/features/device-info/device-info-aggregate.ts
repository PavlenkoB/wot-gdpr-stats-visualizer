/**
 * Device_info extraction and aggregation (quick task 261012-bog).
 *
 * ## Why this module exists
 *
 * Every device string the `Device info` pane draws is produced here, by pure
 * functions over header-keyed rows. Nothing in this file touches a worker
 * global, the DOM, a clock or the network: the same functions run under Node in
 * a unit test against a hand-derived answer key and inside the ingest worker
 * against a real export.
 *
 * ## The three rules that shape every function here
 *
 * 1. **The Assistant blob is read once and never kept.** Its cells carry the
 *    account id and an opaque flags number. `extractAssistantFields` lifts out
 *    the four allow-listed fields (Device type, App, Platform, Version) and
 *    nothing else; `reduceBlobRow` is what the import stores in place of the
 *    row. Every function that returns data returns CELLS, never a row object
 *    and never the blob.
 *
 * 2. **A cell is `null` ("not reported"), never guessed at** (PD-06). A cell
 *    that is absent, blank after a trim or `N/D` in any case is null; anything
 *    else is shown as written, clamped to 200 characters.
 *
 * 3. **A builder reads the columns it resolved, and no others.** The PC and
 *    Blitz tables resolve their columns by name from EACH ACCOUNT GROUP's FIRST
 *    row in one walk, and every row is read through the keys resolved for the
 *    group it belongs to — so no value is read by a guessed name, and no value
 *    is read through another account's key (CR-01).
 *
 * ## Hostile input
 *
 * The length of a blob is checked BEFORE any parse or pattern runs, so a
 * multi-megabyte cell costs a comparison and not a backtracking stall. The four
 * fallback patterns are fixed literals (none is built from data) with no nested
 * quantifier. Every lookup keyed by a name that came from a cell is a `Map`, so
 * a `__proto__` header or key is an ordinary key and writes nothing onto
 * `Object.prototype`. A parsed object is read through its OWN entries and only
 * string and finite-number values count.
 */

import { cell, headerKey, type AccountRowGroup } from '../../worker/csv-columns.ts';
import {
  ASSISTANT_COLUMNS,
  ASSISTANT_STORED_HEADERS,
  BLITZ_COLUMNS,
  DEVICE_COLUMN_HEADERS,
  DEVICE_INFO_CATEGORY,
  DEVICE_MEMORY_COLUMNS,
  DEVICE_NOT_AVAILABLE_TOKEN,
  DEVICE_ROW_STATE_KEY,
  DEVICE_ROW_UNREADABLE,
  MAX_BLOB_LENGTH,
  MAX_DEVICE_ROWS,
  MAX_DEVICE_TEXT,
  MAX_MEMORY_DIGITS,
  PC_COLUMNS,
  type AssistantColumnId,
  type BlitzColumnId,
  type DeviceCell,
  type DeviceInfoView,
  type DeviceRow,
  type DeviceTableView,
  type PcColumnId,
} from './device-info-shared.ts';

/** A stored or parsed row: header-keyed cells, absent for a ragged row. */
export type DeviceStoredRow = Readonly<Record<string, string | undefined>>;

/** The four fields read out of one Assistant blob, each text or null. */
export type AssistantFields = Readonly<Record<AssistantColumnId, string | null>>;

// ---------------------------------------------------------------------------
// Cell normalisation
// ---------------------------------------------------------------------------

/**
 * A cell as shown: null when absent, blank after a trim or `N/D` in any case,
 * else the trimmed text clamped to the text bound (PD-06).
 */
function notReported(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.toUpperCase() === DEVICE_NOT_AVAILABLE_TOKEN) return null;
  return trimmed.length > MAX_DEVICE_TEXT ? trimmed.slice(0, MAX_DEVICE_TEXT) : trimmed;
}

/** All digits and at most nine of them: a number of MB (PD-07). */
const MEMORY_DIGITS = new RegExp(`^[0-9]{1,${MAX_MEMORY_DIGITS}}$`);

/** One PC or Blitz cell: text, a memory number, or null. */
function deviceCell(raw: string | undefined, isMemory: boolean): DeviceCell {
  const text = notReported(raw);
  if (text === null) return null;
  if (isMemory && MEMORY_DIGITS.test(text)) return Number(text);
  return text;
}

// ---------------------------------------------------------------------------
// Category and header tests
// ---------------------------------------------------------------------------

/**
 * Is this category the Device_info family? Case-insensitive on purpose, for the
 * same reason `isUserInfoCategory` is: `classifyFolder` lower-cases before it
 * matches, so a folder spelled `device_info` classifies as the same supported
 * category and keeps that name.
 */
export function isDeviceInfoCategory(name: string): boolean {
  return name.toLowerCase() === DEVICE_INFO_CATEGORY;
}

/** Default_Ignorable_Code_Point, global: used ONLY through `replace`. */
const IGNORABLE = /\p{Default_Ignorable_Code_Point}/gu;

/** Is this header the blob column? NFKC, invisibles removed, trimmed, upper-cased. */
function isBlobKey(key: string): boolean {
  return key.normalize('NFKC').replace(IGNORABLE, '').trim().toUpperCase() === 'POST';
}

/**
 * Does this row carry the blob column? Own enumerable keys only, and it never
 * reads a value. `POST_ID` is not the blob column.
 */
export function hasBlobColumn(row: DeviceStoredRow): boolean {
  for (const key of Object.keys(row)) {
    if (isBlobKey(key)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The blob extractor
// ---------------------------------------------------------------------------

/** The four allow-listed keys, as a Map from the lower-cased trimmed key. */
const BLOB_KEYS: ReadonlyMap<string, AssistantColumnId> = new Map([
  ['device type', 'deviceType'],
  ['app', 'app'],
  ['platform', 'platform'],
  ['version', 'version'],
]);

/**
 * The fallback patterns, one per field, for a JSON-like blob `JSON.parse`
 * rejects (a trailing comma, single-quoted keys). Fixed literals, anchored on
 * the quoted key and a colon; the value is a quoted string without quotes or
 * line breaks or a bare token of at most 50 word, dot or hyphen characters.
 * No nested quantifier, and none of them is built from data.
 */
const FALLBACK_PATTERNS: Readonly<Record<AssistantColumnId, RegExp>> = {
  deviceType: /["']device type["']\s*:\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([\w.-]{1,50}))/i,
  app: /["']app["']\s*:\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([\w.-]{1,50}))/i,
  platform: /["']platform["']\s*:\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([\w.-]{1,50}))/i,
  version: /["']version["']\s*:\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([\w.-]{1,50}))/i,
};

/** Read the four fields out of a parsed (non-array) object's OWN entries. */
function fieldsFromObject(parsed: object): AssistantFields | null {
  const found = new Map<AssistantColumnId, string | null>();
  for (const [key, value] of Object.entries(parsed)) {
    const id = BLOB_KEYS.get(key.trim().toLowerCase());
    if (id === undefined || found.has(id)) continue;
    let text: string | null = null;
    if (typeof value === 'string') text = value;
    else if (typeof value === 'number' && Number.isFinite(value)) text = String(value);
    found.set(id, notReported(text));
  }
  return toFields(found);
}

/** Read the four fields through the fallback patterns. */
function fieldsFromPatterns(text: string): AssistantFields | null {
  const found = new Map<AssistantColumnId, string | null>();
  for (const id of ASSISTANT_COLUMNS) {
    const match = FALLBACK_PATTERNS[id].exec(text);
    if (match === null) continue;
    const value = match[1] ?? match[2] ?? match[3];
    // A bare `null` is the absence of a value, not the word.
    found.set(id, value === 'null' ? null : notReported(value));
  }
  return toFields(found);
}

/** The four-field record, or null when no field holds a value. */
function toFields(found: ReadonlyMap<AssistantColumnId, string | null>): AssistantFields | null {
  const fields: Record<AssistantColumnId, string | null> = {
    deviceType: found.get('deviceType') ?? null,
    app: found.get('app') ?? null,
    platform: found.get('platform') ?? null,
    version: found.get('version') ?? null,
  };
  const any = ASSISTANT_COLUMNS.some((id) => fields[id] !== null);
  return any ? fields : null;
}

/**
 * Lift Device type, App, Platform and Version out of one blob cell, or null when
 * none can be read.
 *
 * Order: the length bound; `JSON.parse` in a try; a parsed non-array object is
 * read through its own entries and nothing falls back to patterns afterwards (a
 * nested object holding the four keys is not the top level's); an array is null;
 * a parse failure or a primitive result goes to the four fixed patterns.
 *
 * The result carries exactly four fields. The Spa id, the flags value and every
 * other key are never copied, whatever the blob holds.
 */
export function extractAssistantFields(text: string | undefined): AssistantFields | null {
  if (typeof text !== 'string' || text.length > MAX_BLOB_LENGTH) return null;
  const trimmed = text.trim();
  if (trimmed === '') return null;

  // `undefined` is never a JSON.parse result, so it stands for "did not parse".
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = undefined;
  }

  if (Array.isArray(parsed)) return null;
  if (typeof parsed === 'object' && parsed !== null) return fieldsFromObject(parsed);
  return fieldsFromPatterns(trimmed);
}

/**
 * What the import stores in place of an Assistant row: an object holding ONLY
 * the non-null stored headers it yields, or the explicit unreadable marker.
 * The overflow bucket and every other key go with the blob.
 */
export function reduceBlobRow(raw: DeviceStoredRow): Record<string, string | undefined> {
  let blob: string | undefined;
  for (const key of Object.keys(raw)) {
    if (isBlobKey(key)) {
      blob = raw[key];
      break;
    }
  }
  const fields = extractAssistantFields(blob);
  if (fields === null) return { [DEVICE_ROW_STATE_KEY]: DEVICE_ROW_UNREADABLE };
  const out: Record<string, string | undefined> = {};
  for (const id of ASSISTANT_COLUMNS) {
    const value = fields[id];
    if (value !== null) out[ASSISTANT_STORED_HEADERS[id]] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

/**
 * One source's rows — grouped per ACCOUNT — and whether its file was in the
 * archive.
 *
 * The grouping is load-bearing, not bookkeeping (CR-01): two accounts' same-named
 * `WOT_Device_Info.csv` carry their own headers, and each group's columns are
 * resolved from that group's OWN first row. A single flat row list would resolve
 * one account's keys and read every other account's cells as absent.
 */
export interface DeviceSourceInput {
  readonly groups: readonly AccountRowGroup<DeviceStoredRow>[];
  readonly seen: boolean;
}

/** The three sources. */
export interface DeviceInfoInput {
  readonly pc: DeviceSourceInput;
  readonly blitz: DeviceSourceInput;
  readonly assistant: DeviceSourceInput;
}

/** The status of a source with no rows at all. */
function emptyTable(input: DeviceSourceInput): DeviceTableView<never> {
  return input.seen ? { status: 'no-rows' } : { status: 'not-in-export' };
}

/** Every group's rows, in group order and stored order within a group. */
function rowsOfGroups(groups: readonly AccountRowGroup<DeviceStoredRow>[]): DeviceStoredRow[] {
  const rows: DeviceStoredRow[] = [];
  for (const group of groups) rows.push(...group.rows);
  return rows;
}

/**
 * One group's column keys: one walk over ITS first row's keys through
 * `headerKey`, the first spelling of a header winning.
 *
 * A `Map`, so a `__proto__` header is an ordinary key. Resolving per group is
 * the whole of the CR-01 fix — a key is never taken from another account's row.
 */
function resolveKeysOf<C extends string>(
  group: AccountRowGroup<DeviceStoredRow>,
  columns: readonly C[],
  headers: Readonly<Record<C, string>>,
): readonly (string | null)[] {
  const first = group.rows[0];
  const keyOf = new Map<string, string>();
  if (first !== undefined) {
    for (const key of Object.keys(first)) {
      const folded = headerKey(key);
      if (!keyOf.has(folded)) keyOf.set(folded, key);
    }
  }
  return columns.map((id) => keyOf.get(headers[id]) ?? null);
}

/**
 * A PC or Blitz table: columns resolved PER GROUP from that group's own first
 * row, and every row read through the keys resolved for the row's OWN group.
 */
function headerKeyedTable<C extends string>(
  columns: readonly C[],
  headers: Readonly<Record<C, string>>,
  input: DeviceSourceInput,
): DeviceTableView<C> {
  const { groups } = input;
  const rowCount = rowsOfGroups(groups).length;
  if (rowCount === 0) return emptyTable(input);

  // `no-usable` is answered only when EVERY group's first row resolves no usable
  // column: one account whose header this app can read makes the table ready,
  // and the account that renamed every column is reported on its own rows as
  // `null` cells rather than hiding the whole table.
  const resolvedByGroup = groups.map((group) => resolveKeysOf(group, columns, headers));
  if (resolvedByGroup.every((resolved) => resolved.every((key) => key === null))) {
    return { status: 'no-usable', rowCount, unreadable: rowCount };
  }

  // The cap is on the FLATTENED concatenation — groups in order, rows in stored
  // order within a group — never a per-group cap and never an interleaving, so
  // the listed rows are a prefix of the rows the reader returned.
  const cells: DeviceRow[] = [];
  for (let g = 0; g < groups.length && cells.length < MAX_DEVICE_ROWS; g++) {
    const group = groups[g]!;
    const resolved = resolvedByGroup[g]!;
    for (const row of group.rows) {
      if (cells.length >= MAX_DEVICE_ROWS) break;
      cells.push(
        columns.map((id, i) =>
          deviceCell(cell(row, resolved[i] ?? null), DEVICE_MEMORY_COLUMNS.has(id)),
        ),
      );
    }
  }
  return {
    status: 'ready',
    columns: [...columns],
    rows: cells,
    rowCount,
    more: rowCount - cells.length,
    unreadable: 0,
  };
}

/** The four fields of one stored Assistant row, or null when none is readable. */
function assistantFieldsOf(row: DeviceStoredRow): AssistantFields | null {
  // A legacy row still holds the raw POST cell: the same extractor reads it, so
  // the blob is not exposed on that path either (PD-03).
  for (const key of Object.keys(row)) {
    if (isBlobKey(key)) return extractAssistantFields(row[key]);
  }
  // A reduced row: the four stored headers, or the unreadable marker (which has
  // none of them).
  const byHeader = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(row)) {
    const folded = headerKey(key);
    if (!byHeader.has(folded)) byHeader.set(folded, value);
  }
  const found = new Map<AssistantColumnId, string | null>();
  for (const id of ASSISTANT_COLUMNS) {
    found.set(id, notReported(byHeader.get(ASSISTANT_STORED_HEADERS[id])));
  }
  return toFields(found);
}

/** The Assistant table: per-row reads, unreadable rows counted and not listed. */
function assistantTable(input: DeviceSourceInput): DeviceTableView<AssistantColumnId> {
  const rows = rowsOfGroups(input.groups);
  if (rows.length === 0) return emptyTable(input);

  // Every Assistant read is PER ROW already (`assistantFieldsOf` walks that
  // row's own keys, whether it is a reduced row or a legacy blob), so grouping
  // costs this path nothing: it only fixes the ORDER and the rowCount.
  const readable: DeviceRow[] = [];
  let unreadable = 0;
  for (const row of rows) {
    const fields = assistantFieldsOf(row);
    if (fields === null) {
      unreadable++;
      continue;
    }
    readable.push(ASSISTANT_COLUMNS.map((id) => fields[id]));
  }
  if (readable.length === 0) {
    return { status: 'no-usable', rowCount: rows.length, unreadable };
  }
  const listed = readable.slice(0, MAX_DEVICE_ROWS);
  return {
    status: 'ready',
    columns: [...ASSISTANT_COLUMNS],
    rows: listed,
    rowCount: rows.length,
    more: readable.length - listed.length,
    unreadable,
  };
}

/**
 * Build the whole Device info view from the three sources' rows and presence.
 *
 * Returns cells only. The top-level status is always `ready`; the three tables
 * carry `not-in-export`, `no-rows`, `no-usable` and `ready` (PD-08).
 */
export function buildDeviceInfo(input: DeviceInfoInput): DeviceInfoView {
  return {
    status: 'ready',
    pc: headerKeyedTable<PcColumnId>(PC_COLUMNS, DEVICE_COLUMN_HEADERS.pc, input.pc),
    blitz: headerKeyedTable<BlitzColumnId>(BLITZ_COLUMNS, DEVICE_COLUMN_HEADERS.blitz, input.blitz),
    assistant: assistantTable(input.assistant),
  };
}
