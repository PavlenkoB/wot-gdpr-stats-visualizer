import { describe, expect, test, vi } from 'vitest';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';

// =============================================================================
// parseCsvFile — defensive CSV parsing wrapper (RESEARCH.md Pattern 2 + D-03)
// =============================================================================
//
// Why this file exists (02-01-PLAN Task 3, Test 3, RED then GREEN):
//   IMPORT-03 requires CSV parsing to tolerate (a) CRLF AND bare-CR
//   line endings, (b) missing trailing columns, and (c) extra columns
//   — without aborting the file. The wrapper must run fixMojibake
//   on every string field before returning rows (IMPORT-04), and
//   must NOT treat PapaParse's `FieldMismatch` / `TooFewFields` /
//   `TooManyFields` errors as fatal (D-03, RESEARCH.md Anti-Patterns).
//
// The wrapper's only "skip" trigger is a `Quotes`-type error at a
// specific row index — a genuine structural corruption. All other
// `results.errors` entries are informational (PapaParse still emits
// the row in `results.data`); RESEARCH Pitfall 3 documents that
// PapaParse's `row` index can be off-by-one, so the wrapper must
// guard against out-of-range indices when splicing.
// =============================================================================

const CRLF = '\r\n';
const CR = '\r';

describe('parseCsvFile — line-ending tolerance (D-03, IMPORT-03)', () => {
  test('a CRLF-delimited file yields the same row count as a bare-CR file', () => {
    const header = 'A;B;C';
    const row1 = '1;2;3';
    const row2 = '4;5;6';
    const crlf = header + CRLF + row1 + CRLF + row2 + CRLF;
    const bareCR = header + CR + row1 + CR + row2 + CR;
    const r1 = parseCsvFile(crlf, 'X', 'a.csv');
    const r2 = parseCsvFile(bareCR, 'X', 'a.csv');
    expect(r1.skippedCount).toBe(0);
    expect(r2.skippedCount).toBe(0);
    expect(r1.rows).toHaveLength(2);
    expect(r2.rows).toHaveLength(2);
    // Field values agree field-by-field.
    for (let i = 0; i < 2; i++) {
      expect(r1.rows[i]!.data).toEqual(r2.rows[i]!.data);
    }
  });

  test('a file with no trailing newline yields the last row', () => {
    const text = 'A;B\n1;2\n3;4';
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows).toHaveLength(2);
  });
});

describe('parseCsvFile — ragged columns (D-03, IMPORT-03)', () => {
  test('a row with a missing trailing column stays in the result (PapaParse drops the missing key, not the row)', () => {
    const text = 'A;B;C' + CRLF + '1;2;3' + CRLF + '4;5' + CRLF; // second row missing C
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0); // missing column is NOT fatal
    expect(rows).toHaveLength(2);
    // The ragged row is still present (D-03: never abort on ragged columns).
    // PapaParse's header:true drops the missing key from the row object
    // rather than setting it to undefined — verify the surviving fields
    // are correct, and that the second row's B column is `5`, not `5;C`.
    const ragged = rows[1]!.data;
    expect(ragged['A']).toBe('4');
    expect(ragged['B']).toBe('5');
  });

  test('a row with an extra column does not abort the file (the row stays present)', () => {
    const text = 'A;B;C' + CRLF + '1;2;3' + CRLF + '4;5;6;7' + CRLF; // second row has 4 fields
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0); // extra column is NOT fatal
    expect(rows).toHaveLength(2);
    // Both rows present — the extra column doesn't drop the row.
    expect(rows[0]!.data['A']).toBe('1');
    expect(rows[1]!.data['A']).toBe('4');
  });
});

describe('parseCsvFile — runs fixMojibake on every string value (IMPORT-04)', () => {
  test('a cell containing a double-UTF8 Cyrillic byte pattern is corrected to readable Cyrillic', () => {
    const original = 'Синтетический_клан';
    const bytes = new TextEncoder().encode(original);
    let mojibake = '';
    for (let i = 0; i < bytes.length; i++) {
      mojibake += String.fromCharCode(bytes[i]!);
    }
    // CSV text: header A;B then a row with the mojibake string in column A.
    const text = 'A;B' + CRLF + mojibake + ';other' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'Clans', 'Clan_membership.csv');
    expect(skippedCount).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data['A']).toBe(original);
  });
});

// =============================================================================
// 02-02 — Skip-row accounting (D-04) made visible
// =============================================================================
//
// Why this block is its own world:
//   02-02 builds on 02-01's parseCsvFile shape — the wrapper returns
//   { rows, skippedCount } already, but the visibility side of the
//   feature (a category with N skipped rows shows "N rows skipped"
//   on its badge) only lands when the malformed-row fixture lands in
//   the worker pipeline end-to-end. The pure-function tests below
//   cover the parser's skip semantics in isolation, mirroring the
//   D-04 contract that:
//     - exactly one row is skipped when one row carries a Quotes-
//       type structural corruption;
//     - console.error fires once with the bracket-tagged short
//       message + category/sourceFile/reason detail;
//     - no rows are skipped from a well-formed file.
// =============================================================================

describe('parseCsvFile — skip-row accounting (D-04)', () => {
  // A 'Quotes'-type error is triggered by an unbalanced quote inside
  // a field — here the value of column A in row 2 is `"unterminated`
  // (missing the closing quote). PapaParse records this as a Quotes
  // error tied to the second data row.
  //
  // The malformed row is placed LAST (no following rows) so PapaParse
  // does not merge subsequent lines into the unterminated field —
  // that would make the result row's content ambiguous. With the
  // malformed row last, PapaParse returns both rows in result.data,
  // our wrapper drops the second one, and the test can assert
  // skippedCount === 1 with the first row surviving.
  const HEADER = 'A;B;C';
  const VALID_ROW = '1;2;3';
  const UNBALANCED_QUOTE_ROW = '"unterminated;6';

  test('parseCsvFile on a CSV containing one row with an unbalanced quote character returns skippedCount === 1, that row is absent from the returned rows, and console.error was called exactly once with category/sourceFile/reason', () => {
    const text = HEADER + CRLF + VALID_ROW + CRLF + UNBALANCED_QUOTE_ROW + CRLF;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { rows, skippedCount } = parseCsvFile(text, 'Bans', 'Bans.csv');

      // Skipped count matches the documented single-row contract (D-04).
      expect(skippedCount).toBe(1);
      // The malformed row is absent from the result — the surviving
      // row is the well-formed one.
      expect(rows).toHaveLength(1);
      expect(rows[0]!.data['A']).toBe('1');

      // The bracket-tagged short message + structured detail fired
      // exactly once for the single skip.
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleErrorSpy.mock.calls[0]!;
      expect(callArgs[0]).toBe('[csv-parse] skipped row');
      const detail = callArgs[1] as { category: string; sourceFile: string; reason: string };
      expect(detail.category).toBe('Bans');
      expect(detail.sourceFile).toBe('Bans.csv');
      expect(detail.reason).toBe('Quotes');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test('parseCsvFile on a CSV with no malformed rows returns skippedCount === 0', () => {
    const text = HEADER + CRLF + VALID_ROW + CRLF;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(skippedCount).toBe(0);
      expect(rows).toHaveLength(1);
      // No skip log fires for a clean file.
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
