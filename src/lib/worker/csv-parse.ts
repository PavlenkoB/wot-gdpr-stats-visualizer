import Papa from 'papaparse';
import { fixMojibake } from './mojibake.ts';

/**
 * Defensive CSV parser for one file (RESEARCH.md Pattern 2 + D-03).
 *
 * Why this exists (02-01-PLAN Task 3, IMPORT-03, IMPORT-04, D-03):
 *   Every category's CSV is parsed here, in the worker, before being
 *   written to Dexie. The wrapper does three things the bare
 *   `Papa.parse` call would not:
 *
 *     1. Runs `fixMojibake` on every string value (IMPORT-04 / D-01:
 *        parse every category, not just the four 'supported' ones).
 *     2. Treats ragged-column errors (`FieldMismatch`, `TooFewFields`,
 *        `TooManyFields`) as NON-fatal per RESEARCH.md Anti-Patterns
 *        and D-03 — PapaParse's `header: true` already represents a
 *        missing trailing field as an `undefined` key and an extra
 *        field as a `__parsed_extra` array, both of which are
 *        preserved here.
 *     3. Treats a `Quotes`-type error at a specific row index as a
 *        genuine structural corruption (D-03) — that row is removed
 *        from the result and counted in `skippedCount`. PapaParse's
 *        `error.row` is 1-based when `header: true`; the wrapper
 *        translates it to a 0-based `result.data` index. An out-of-
 *        range result silently skips (the row was already dropped by
 *        PapaParse), never throws — RESEARCH Pitfall 3's off-by-one
 *        guard pattern.
 *
 * Per-row skip logging follows the existing `[bracket-tag] short-
 * message, detail` shape used by `ingest.worker.ts`'s catch block.
 */

export interface ParsedRow {
  data: Record<string, string | undefined>;
}

export interface ParsedFile {
  rows: ParsedRow[];
  skippedCount: number;
}

export function parseCsvFile(text: string, category: string, sourceFile: string): ParsedFile {
  const result = Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    skipEmptyLines: true,
    worker: false,
  });

  const rows: ParsedRow[] = [];
  const skipIndices = new Set<number>();

  for (const error of result.errors) {
    if (error.type !== 'Quotes') continue; // ragged columns are not fatal
    if (typeof error.row !== 'number') continue;
    // PapaParse's `error.row` is 1-based when `header: true` — the
    // header is row 0 internally, the first data row is row 1, and
    // `result.data` is a 0-based array (data[0] = first data row).
    // Translate PapaParse's row to a data index. An out-of-range
    // index means PapaParse already dropped the malformed row from
    // `data` (e.g. unparseable rows are sometimes omitted), in which
    // case there is nothing to remove — silently skip rather than
    // splice and risk an index mismatch (RESEARCH Pitfall 3).
    const dataIndex = error.row - 1;
    if (dataIndex < 0 || dataIndex >= result.data.length) continue;
    skipIndices.add(dataIndex);
    console.error('[csv-parse] skipped row', {
      category,
      sourceFile,
      rowIndex: error.row,
      reason: error.type,
    });
  }

  for (let i = 0; i < result.data.length; i++) {
    if (skipIndices.has(i)) continue;
    const row = result.data[i]!;
    const fixed: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(row)) {
      fixed[k] = typeof v === 'string' ? fixMojibake(v) : v;
    }
    rows.push({ data: fixed });
  }

  return { rows, skippedCount: skipIndices.size };
}
