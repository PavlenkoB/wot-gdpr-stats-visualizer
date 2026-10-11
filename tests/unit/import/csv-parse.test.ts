import { describe, expect, test, vi } from 'vitest';
import { MAX_QUARANTINED_RECORDS, parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import {
  hasGluedSensitiveColumn,
  hasSensitiveColumn,
  sanitizeUserInfoRow,
} from '../../../src/lib/worker/identity.ts';
import {
  SAMPLE_BIRTH_DATE,
  SAMPLE_LOGIN,
  SAMPLE_LOGIN_DOMAIN,
} from '../../fixtures/export-fixtures.ts';

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
const LF = '\n';

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

// =============================================================================
// 02-05 Task 1 -- CR-03: the delimiter comes from the HEADER, and a glued
// sensitive header key withholds the file (fail closed)
// =============================================================================
//
// 02-REVIEW.md CR-03. PapaParse sniffs the delimiter from the first ten body
// records. One short row in a two-column file drags the average field count
// under 1.99, the sniff falls back to a comma, and every row lands under ONE
// key (`ID;NAME`). For a `LOGIN;BIRTH_DATE` file that key no longer matches the
// anchored D-18 deny-list, so the header-keyed strip in the worker passes the
// email through to IndexedDB.
//
// FIXTURE SHAPE (load-bearing): every text below starts DIRECTLY with the
// header, has no blank line, and keeps the short row inside the first ten
// records. PapaParse's sniff counts blank records, so a leading CRLF or a blank
// line between records dilutes the average and `;` is then detected correctly:
// the unfixed parser would PASS and the test would be vacuous. Do not build
// these with a CRLF-wrapped helper.
// =============================================================================

/** A text that starts directly with the header: no leading CRLF, no blank line. */
function direct(lines: readonly string[]): string {
  return lines.join(CRLF) + CRLF;
}

/** Serialise rows the way the worker choke point treats them (D-18 strip). */
function redactedDump(rows: ReturnType<typeof parseCsvFile>['rows']): string {
  return JSON.stringify(
    rows.map((r) => (hasSensitiveColumn(r.data) ? sanitizeUserInfoRow(r.data) : r.data)),
  );
}

describe('parseCsvFile -- CR-03: delimiter chosen from the header line only', () => {
  test('A (review repro): ID;NAME with seven valid rows and one short row keeps its real header keys', () => {
    const lines = ['ID;NAME'];
    for (let i = 0; i < 7; i++) lines.push(`${i};n${i}`);
    lines.push('99');
    const { rows, skippedCount } = parseCsvFile(direct(lines), 'X', 'a.csv');

    expect(skippedCount).toBe(0);
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      for (const key of Object.keys(row.data)) {
        expect(key).not.toContain(';');
        expect(['ID', 'NAME']).toContain(key);
      }
    }
    expect(rows[0]!.data).toEqual({ ID: '0', NAME: 'n0' });
    expect(rows[7]!.data['ID']).toBe('99');
  });

  const variants: ReadonlyArray<{ label: string; delimiter: string }> = [
    { label: 'semicolon', delimiter: ';' },
    { label: 'pipe', delimiter: '|' },
    { label: 'tab', delimiter: '\t' },
    // PapaParse's comma fallback happens to be right for a comma file, so this
    // passes before the fix. It is a CONTROL: it proves the header-driven choice
    // does not break the comma case.
    { label: 'comma (control)', delimiter: ',' },
  ];

  for (const variant of variants) {
    test(`B/C: LOGIN${variant.delimiter === '\t' ? '<TAB>' : variant.delimiter}BIRTH_DATE (${variant.label}) plus one short row keeps real keys and redacts through the D-18 strip`, () => {
      const d = variant.delimiter;
      const lines = [`LOGIN${d}BIRTH_DATE`];
      for (let i = 0; i < 7; i++) lines.push(`${SAMPLE_LOGIN}${d}${SAMPLE_BIRTH_DATE}`);
      lines.push('99');
      const { rows, skippedCount } = parseCsvFile(direct(lines), 'X', 'a.csv');

      expect(skippedCount).toBe(0);
      expect(rows).toHaveLength(8);
      expect(Object.keys(rows[0]!.data)).toEqual(['LOGIN', 'BIRTH_DATE']);
      for (const row of rows) {
        for (const key of Object.keys(row.data)) expect(key).not.toMatch(/[;,|\t]/);
      }

      const dump = redactedDump(rows);
      expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
      expect(dump).not.toContain(SAMPLE_BIRTH_DATE);
    });
  }
});

describe('parseCsvFile -- CR-03: a glued sensitive header key withholds the whole file', () => {
  test('D: a quoted "LOGIN;BIRTH_DATE" header cell is withheld, every data line counted, one tagged log', () => {
    const text = direct(['"LOGIN;BIRTH_DATE"', `"${SAMPLE_LOGIN};${SAMPLE_BIRTH_DATE}"`]);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { rows, skippedCount } = parseCsvFile(text, 'Misc', 'Misc/Contacts.csv');
      expect(rows).toEqual([]);
      expect(skippedCount).toBe(1);

      expect(spy).toHaveBeenCalledTimes(1);
      const [tag, detail] = spy.mock.calls[0]! as [string, Record<string, unknown>];
      expect(tag).toBe('[csv-parse] file withheld');
      expect(detail['category']).toBe('Misc');
      expect(detail['sourceFile']).toBe('Misc/Contacts.csv');
      expect(typeof detail['reason']).toBe('string');
      // D-03 privacy: the log carries structure only, never cell or header text.
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain(SAMPLE_LOGIN_DOMAIN);
      expect(logged).not.toContain(SAMPLE_BIRTH_DATE);
      expect(logged).not.toContain('BIRTH_DATE');
      expect(JSON.stringify(rows)).not.toContain(SAMPLE_LOGIN_DOMAIN);
    } finally {
      spy.mockRestore();
    }
  });

  test('E: mixed delimiters in the header (LOGIN;BIRTH_DATE,NAME) are withheld, both data lines counted', () => {
    const text = direct(['LOGIN;BIRTH_DATE,NAME', 'a;b,c', 'd;e,f']);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { rows, skippedCount } = parseCsvFile(text, 'Misc', 'm.csv');
      expect(rows).toEqual([]);
      expect(skippedCount).toBe(2);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![0]).toBe('[csv-parse] file withheld');
    } finally {
      spy.mockRestore();
    }
  });

  test('F: negative controls -- the real LOGIN_DT header and a duplicated LOGIN column are NOT withheld', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const logins = parseCsvFile(
        direct([
          'LOGIN_DT;IP;COUNTRY_CODE;USER_AGENT',
          '2020-01-01 10:00:00;203.0.113.1;UA;agent',
          '2020-01-02 10:00:00;203.0.113.2;DE;agent',
        ]),
        'Activity_history',
        'Logins.csv',
      );
      expect(logins.skippedCount).toBe(0);
      expect(logins.rows).toHaveLength(2);
      expect(Object.keys(logins.rows[0]!.data)).toContain('LOGIN_DT');

      // PapaParse renames the second LOGIN to LOGIN_1; both keys are whole
      // deny-list names that the existing strip already handles.
      const dup = parseCsvFile(direct(['LOGIN;LOGIN;X', 'a;b;c']), 'X', 'd.csv');
      expect(dup.skippedCount).toBe(0);
      expect(dup.rows).toHaveLength(1);
      expect(Object.keys(dup.rows[0]!.data)).toEqual(['LOGIN', 'LOGIN_1', 'X']);

      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });

  test('G: an unterminated quote in the header withholds the file without throwing', () => {
    const text = direct(['"A;B', '1;2', '3;4']);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let result: ReturnType<typeof parseCsvFile> | undefined;
      expect(() => {
        result = parseCsvFile(text, 'Misc', 'g.csv');
      }).not.toThrow();
      expect(result!.rows).toEqual([]);
      expect(result!.skippedCount).toBe(2);
      expect(spy).toHaveBeenCalledTimes(1);
      const [tag, detail] = spy.mock.calls[0]! as [string, Record<string, unknown>];
      expect(tag).toBe('[csv-parse] file withheld');
      expect(String(detail['reason'])).toMatch(/header/);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('hasGluedSensitiveColumn -- predicate (identity.ts)', () => {
  test('H: true for a key that hides a deny-listed name inside a longer key', () => {
    expect(hasGluedSensitiveColumn(['LOGIN;BIRTH_DATE'])).toBe(true);
    expect(hasGluedSensitiveColumn(['login birth_date'])).toBe(true);
    expect(hasGluedSensitiveColumn(['LOGIN\u200B'])).toBe(true);
    expect(hasGluedSensitiveColumn(['ID', 'BIRTH_DATE,NAME'])).toBe(true);
  });

  test('H: false for whole deny-list keys (the strip handles those), look-alikes and an empty list', () => {
    expect(hasGluedSensitiveColumn(['LOGIN'])).toBe(false);
    expect(hasGluedSensitiveColumn([' login '])).toBe(false);
    expect(hasGluedSensitiveColumn(['BIRTH_DATE_1'])).toBe(false);
    expect(hasGluedSensitiveColumn(['LOGIN_DT'])).toBe(false);
    expect(hasGluedSensitiveColumn(['USER_LOGIN'])).toBe(false);
    expect(hasGluedSensitiveColumn(['LOGIN_DT', 'IP', 'COUNTRY_CODE', 'USER_AGENT'])).toBe(false);
    expect(hasGluedSensitiveColumn([])).toBe(false);
  });
});

// =============================================================================
// 02-05 Task 2 -- CR-02: blank lines must not shift which row is dropped
// =============================================================================
//
// 02-REVIEW.md CR-02. `skipEmptyLines` made PapaParse's `error.row` count the
// blank lines that `result.data` no longer holds, so `error.row - 1` pointed at
// the wrong record: a VALID row was dropped and the malformed one kept, or the
// index fell off the end and the malformed row was stored with a count of 0.
// The fix keeps blank records in the parse and filters them in the wrapper, so
// the offending record is `data[row - 1]` exactly.
// =============================================================================

/** Collect the first-column values of the returned rows, in source order. */
function firstColumn(rows: ReturnType<typeof parseCsvFile>['rows']): (string | undefined)[] {
  return rows.map((r) => r.data['A']);
}

/** A console.error spy plus its parsed calls; restore in `finally`. */
function spyOnConsoleError() {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return {
    spy,
    calls: () =>
      spy.mock.calls.map((c) => ({ tag: c[0] as string, detail: c[1] as Record<string, unknown> })),
  };
}

describe('parseCsvFile -- CR-02: exact blank-line row mapping', () => {
  const REVIEW_TEXT =
    'A;B;C' +
    CRLF +
    'r0;a;b' +
    CRLF +
    CRLF +
    CRLF +
    'r2;"a"x";c' +
    CRLF +
    'r3;d;e' +
    CRLF +
    'r4;f;g' +
    CRLF;

  test('R1 (review repro): r2 is dropped and r4 SURVIVES, with its file-relative line', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const { rows, skippedCount } = parseCsvFile(REVIEW_TEXT, 'X', 'a.csv');
      expect(firstColumn(rows)).toEqual(['r0', 'r3', 'r4']);
      expect(skippedCount).toBe(1);
      expect(calls()).toHaveLength(1);
      expect(calls()[0]!.tag).toBe('[csv-parse] skipped row');
      expect(calls()[0]!.detail['line']).toBe(5);
      expect(calls()[0]!.detail['reason']).toBe('Quotes');
    } finally {
      spy.mockRestore();
    }
  });

  test('R2: the same text with a leading CRLF reports the line shifted by the leading blank line', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const { rows, skippedCount } = parseCsvFile(CRLF + REVIEW_TEXT, 'X', 'a.csv');
      expect(firstColumn(rows)).toEqual(['r0', 'r3', 'r4']);
      expect(skippedCount).toBe(1);
      expect(calls()[0]!.detail['line']).toBe(6);
    } finally {
      spy.mockRestore();
    }
  });

  test('R3: a trailing unterminated row after a blank line is dropped and counted, not stored', () => {
    const { spy } = spyOnConsoleError();
    try {
      const text = 'A;B;C' + CRLF + 'r0;a;b' + CRLF + CRLF + '"unterminated;z' + CRLF;
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(firstColumn(rows)).toEqual(['r0']);
      expect(skippedCount).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('R4: the real export shape (leading CRLF, a blank line between every record) drops only the malformed record', () => {
    const { spy } = spyOnConsoleError();
    try {
      const records = ['1;a', '2;b', '3;"a"x"', '4;d', '5;e'];
      let text = CRLF + 'A;B' + CRLF;
      for (const record of records) text += CRLF + record + CRLF;
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(firstColumn(rows)).toEqual(['1', '2', '4', '5']);
      expect(skippedCount).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('R5: blank-record semantics are unchanged: whitespace-only is a row, zero-length is not, trailing terminators add nothing', () => {
    const text = 'A;B' + CRLF + '1;2' + CRLF + '   ' + CRLF + CRLF + '3;4' + CRLF + CRLF + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(firstColumn(rows)).toEqual(['1', '   ', '3']);
  });

  test('R6: a BOM followed by blank lines still yields clean header keys', () => {
    const text = '\uFEFF' + CRLF + CRLF + 'A;B' + CRLF + '1;2' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!.data)).toEqual(['A', 'B']);
  });
});

// =============================================================================
// 02-05 Task 2 -- CR-01: a stray quote costs the lines it corrupts, no more
// =============================================================================
//
// 02-REVIEW.md CR-01. PapaParse treats everything from an unclosed opening
// quote to EOF as one quoted field. The wrapper counted "1 row" and kept the
// swallowed remainder as one giant cell, so every later row was lost while the
// UI said "1 row skipped". The fix quarantines only the PHYSICAL LINE that
// holds the opening quote and re-parses the rest.
//
// Accepted behaviour, recorded on purpose: the continuation lines of an
// unterminated multi-line field come back as ordinary rows. The quarantine
// unit is the physical line holding the opening quote, because that is the
// only boundary the parser can name without guessing.
// =============================================================================

describe('parseCsvFile -- CR-01: quarantine one physical line and recover the rest', () => {
  test('Q1 (review repro): rows after the stray-quote line come back, skippedCount is 1, one log at line 3', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const text = 'A;B' + CRLF + '1;2' + CRLF + '3;"abc' + CRLF + '4;5' + CRLF + '6;7' + CRLF;
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(rows.map((r) => r.data)).toEqual([
        { A: '1', B: '2' },
        { A: '4', B: '5' },
        { A: '6', B: '7' },
      ]);
      expect(skippedCount).toBe(1);
      expect(calls()).toHaveLength(1);
      expect(calls()[0]!.tag).toBe('[csv-parse] skipped row');
      expect(calls()[0]!.detail['line']).toBe(3);
      expect(calls()[0]!.detail['reason']).toBe('Quotes');
    } finally {
      spy.mockRestore();
    }
  });

  test('Q2: a later quote that closes the field early still quarantines only the first line', () => {
    const { spy } = spyOnConsoleError();
    try {
      const text = 'A;B' + CRLF + '1;2' + CRLF + '3;"abc' + CRLF + '4;"x"' + CRLF + '5;6' + CRLF;
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(rows.map((r) => r.data)).toEqual([
        { A: '1', B: '2' },
        { A: '4', B: 'x' },
        { A: '5', B: '6' },
      ]);
      expect(skippedCount).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('Q3: two stray quotes far apart quarantine both lines, with file-relative line numbers 3 and 5', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const lines = ['A;B', '1;2', '3;"x', '4;5', '6;"y', '7;8'];
      const { rows, skippedCount } = parseCsvFile(lines.join(CRLF) + CRLF, 'X', 'a.csv');
      expect(firstColumn(rows)).toEqual(['1', '4', '7']);
      expect(skippedCount).toBe(2);
      expect(calls().map((c) => c.detail['line'])).toEqual([3, 5]);
      for (const call of calls()) expect(call.tag).toBe('[csv-parse] skipped row');
    } finally {
      spy.mockRestore();
    }
  });

  test('Q4: a double-encoded Cyrillic cell AFTER a stray-quote line is still repaired (IMPORT-04)', () => {
    const { spy } = spyOnConsoleError();
    try {
      const original = 'Синтетический_клан';
      let mojibake = '';
      for (const byte of new TextEncoder().encode(original)) mojibake += String.fromCharCode(byte);
      const text = 'A;B' + CRLF + '0;ok' + CRLF + '1;"stray' + CRLF + mojibake + ';other' + CRLF;
      const { rows, skippedCount } = parseCsvFile(text, 'Clans', 'c.csv');
      expect(skippedCount).toBe(1);
      expect(firstColumn(rows)).toEqual(['0', original]);
    } finally {
      spy.mockRestore();
    }
  });

  test('Q5: bare-CR terminators give the same rows and skippedCount (IMPORT-03)', () => {
    const { spy } = spyOnConsoleError();
    try {
      const text = 'A;B' + CR + '1;2' + CR + '3;"abc' + CR + '4;5' + CR + '6;7' + CR;
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(firstColumn(rows)).toEqual(['1', '4', '6']);
      expect(skippedCount).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('Q6: past MAX_QUARANTINED_RECORDS the unread remainder is withheld AND counted, under its own tag', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const max = MAX_QUARANTINED_RECORDS;
      const lines = ['ID;NAME'];
      for (let i = 0; i <= max; i++) {
        lines.push(`g${i};ok`);
        lines.push(`s${i};"x`);
      }
      for (let i = 0; i < 5; i++) lines.push(`t${i};ok`);
      const { rows, skippedCount } = parseCsvFile(lines.join(CRLF) + CRLF, 'X', 'big.csv');

      // MAX quarantined lines, then the (MAX+1)th stray line and the five
      // trailing good lines that follow it are withheld: 1 + 5 more.
      expect(rows).toHaveLength(max + 1);
      expect(skippedCount).toBe(max + 6);
      const all = calls();
      expect(all.filter((c) => c.tag === '[csv-parse] skipped row')).toHaveLength(max);
      const withheld = all.filter((c) => c.tag === '[csv-parse] remainder withheld');
      expect(withheld).toHaveLength(1);
      expect(withheld[0]!.detail['reason']).toBe('quarantine-cap');
      expect(withheld[0]!.detail['category']).toBe('X');
      expect(withheld[0]!.detail['sourceFile']).toBe('big.csv');
    } finally {
      spy.mockRestore();
    }
  });

  test('every skip log carries structure only, never cell text (D-03)', () => {
    const { spy } = spyOnConsoleError();
    try {
      const text = 'A;B' + CRLF + 'secretcell;"secretstray' + CRLF + 'another-secret;1' + CRLF;
      parseCsvFile(text, 'X', 'a.csv');
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain('secret');
    } finally {
      spy.mockRestore();
    }
  });
});

// =============================================================================
// 02-06 Task 1 -- W-1: a lookalike spelling of LOGIN / BIRTH_DATE /
// BIRTH_DATE_SRC is stripped like the ASCII name (or the file is withheld)
// =============================================================================
//
// 02-VERIFICATION.md W-1. `normalizeKey` was trim plus upper-case, so a header
// written with fullwidth letters or a Cyrillic / Greek lookalike matched neither
// the header-keyed D-18 strip nor the 02-05 glued withhold, and the e-mail and
// birth date were persisted under the lookalike key.
//
// Every Unicode string below is written with \u escapes so a reviewer and a
// linter see exactly which code point is used. Tests tagged "(control)" are
// EXPECTED TO PASS before the change as well as after: they pin behaviour the
// change must not disturb (the 02-05 withholds, real headers, native-script
// headers). A control that fails, or a non-control that passes before the change,
// means the fixture shape is wrong: fix the fixture, never the expectation.
// =============================================================================

/** `ID;<login key>;<birth key>;NAME` plus data rows, CRLF, no blank line. */
function lookalikeFile(loginKey: string, birthKey = 'BIRTH_DATE', dataRows = 3): string {
  const lines = [`ID;${loginKey};${birthKey};NAME`];
  for (let i = 0; i < dataRows; i++) {
    lines.push(`${i};${SAMPLE_LOGIN};${SAMPLE_BIRTH_DATE};n${i}`);
  }
  return direct(lines);
}

/** The keys a row keeps once the worker's D-18 strip has run on it. */
function strippedKeys(row: { data: Record<string, string | undefined> }): string[] {
  return Object.keys(sanitizeUserInfoRow(row.data));
}

const FW_LOGIN = '\uFF2C\uFF2F\uFF27\uFF29\uFF2E';
const FW_BIRTH_DATE = '\uFF22\uFF29\uFF32\uFF34\uFF28\uFF3F\uFF24\uFF21\uFF34\uFF25';

describe('parseCsvFile -- W-1: the verifier repros (verbatim)', () => {
  test('repro 1: ID;<fullwidth LOGIN> keeps ID and drops the e-mail', () => {
    const text = `ID;${FW_LOGIN}` + CRLF + '1;a@b.invalid';
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(redactedDump(rows)).toBe('[{"ID":"1"}]');
    expect(redactedDump(rows)).not.toContain('a@b.invalid');
  });

  test('repro 2: ID;L<Cyrillic O>GIN keeps ID and drops the e-mail', () => {
    const text = 'ID;L\u041EGIN' + CRLF + '1;a@b.invalid';
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(redactedDump(rows)).toBe('[{"ID":"1"}]');
    expect(redactedDump(rows)).not.toContain('a@b.invalid');
  });
});

describe('parseCsvFile -- W-1: foldable lookalikes are stripped like the ASCII name', () => {
  const FOLDABLE: ReadonlyArray<{ label: string; login: string; birth: string }> = [
    {
      label: 'fullwidth upper case with fullwidth underscore',
      login: FW_LOGIN,
      birth: FW_BIRTH_DATE,
    },
    {
      label: 'fullwidth lower case LOGIN',
      login: '\uFF4C\uFF4F\uFF47\uFF49\uFF4E',
      birth: 'BIRTH_DATE',
    },
    { label: 'Cyrillic small o in LOGIN', login: 'L\u043EGIN', birth: 'BIRTH_DATE' },
    { label: 'Greek Omicron and Nu in LOGIN', login: 'L\u039FGI\u039D', birth: 'BIRTH_DATE' },
    {
      label: 'Greek Alpha and Epsilon in BIRTH_DATE',
      login: 'LOGIN',
      birth: 'BIRTH_D\u0391T\u0395',
    },
    { label: 'Cyrillic Shha in BIRTH_DATE', login: 'LOGIN', birth: 'BIRT\u04BA_DATE' },
    { label: 'Cyrillic Dze in BIRTH_DATE_SRC', login: 'LOGIN', birth: 'BIRTH_DATE_\u0405RC' },
    { label: 'Turkish dotted capital I in LOGIN', login: 'LOG\u0130N', birth: 'BIRTH_DATE' },
    {
      label: 'fullwidth LOGIN, ASCII underscore, fullwidth digit one',
      login: `${FW_LOGIN}_\uFF11`,
      birth: 'BIRTH_DATE',
    },
    {
      label: 'Cyrillic Ukrainian I standing for the I of LOGIN',
      login: 'LOG\u0406N',
      birth: 'BIRTH_DATE',
    },
    { label: 'palochka standing for the I of LOGIN', login: 'LOG\u04C0N', birth: 'BIRTH_DATE' },
  ];

  for (const c of FOLDABLE) {
    test(`${c.label}: kept, no value survives the strip, other columns kept`, () => {
      const { spy } = spyOnConsoleError();
      try {
        const { rows, skippedCount } = parseCsvFile(lookalikeFile(c.login, c.birth), 'X', 'a.csv');
        expect(skippedCount).toBe(0);
        expect(rows).toHaveLength(3);
        expect(spy).not.toHaveBeenCalled();
        for (const row of rows) {
          expect(hasSensitiveColumn(row.data)).toBe(true);
          expect(strippedKeys(row)).toEqual(['ID', 'NAME']);
        }
        const dump = redactedDump(rows);
        expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
        expect(dump).not.toContain(SAMPLE_BIRTH_DATE);
      } finally {
        spy.mockRestore();
      }
    });
  }

  test('(control) dotless i in LOGIN and long s in BIRTH_DATE_SRC are stripped (toUpperCase already folds them)', () => {
    const { rows, skippedCount } = parseCsvFile(
      lookalikeFile('LOG\u0131N', 'BIRTH_DATE_\u017FRC'),
      'X',
      'a.csv',
    );
    expect(skippedCount).toBe(0);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(strippedKeys(row)).toEqual(['ID', 'NAME']);
    expect(redactedDump(rows)).not.toContain(SAMPLE_LOGIN_DOMAIN);
  });
});

describe('parseCsvFile -- W-1: an unfoldable disguised name withholds the whole file', () => {
  const UNFOLDABLE: ReadonlyArray<{ label: string; key: string }> = [
    { label: 'Armenian Oh inside LOGIN', key: 'L\u0555GIN' },
    { label: 'Armenian small oh inside LOGIN', key: 'L\u0585GIN' },
    { label: 'Coptic O inside LOGIN', key: 'L\u2C9EGIN' },
    { label: 'Latin O with acute inside LOGIN', key: 'L\u00D3GIN' },
    { label: 'zero-width space inside LOGIN', key: 'LO\u200BGIN' },
    { label: 'soft hyphen inside LOGIN', key: 'LO\u00ADGIN' },
    { label: 'LOGIN_ followed by an Arabic-Indic digit', key: 'LOGIN_\u0661' },
    {
      label: 'fullwidth LOGIN, zero-width space, fullwidth BIRTH_DATE in ONE key',
      key: `${FW_LOGIN}\u200B${FW_BIRTH_DATE}`,
    },
    { label: 'palochka U+04C0 standing for the L of a lower-case login', key: '\u04C0ogin' },
    { label: 'palochka U+04CF standing for the L of a lower-case login', key: '\u04CFogin' },
    { label: 'Greek capital iota standing for the L of a lower-case login', key: '\u0399ogin' },
  ];

  for (const c of UNFOLDABLE) {
    test(`${c.label}: rows [], every data line counted, one tagged log, no text in it`, () => {
      const { spy, calls } = spyOnConsoleError();
      try {
        const { rows, skippedCount } = parseCsvFile(lookalikeFile(c.key), 'X', 'a.csv');
        expect(rows).toEqual([]);
        expect(skippedCount).toBe(3);
        expect(calls()).toHaveLength(1);
        expect(calls()[0]!.tag).toBe('[csv-parse] file withheld');
        const logged = JSON.stringify(spy.mock.calls);
        expect(logged).not.toContain(SAMPLE_LOGIN_DOMAIN);
        expect(logged).not.toContain(SAMPLE_BIRTH_DATE);
        expect(logged).not.toMatch(/gin|NAME/i);
      } finally {
        spy.mockRestore();
      }
    });
  }
});

describe('parseCsvFile -- W-1: preservation controls (02-05 withholds stay withheld)', () => {
  const PRESERVED: ReadonlyArray<{ label: string; key: string }> = [
    { label: 'ID + zero-width space + LOGIN', key: 'ID\u200BLOGIN' },
    { label: 'LOGIN + zero-width space + BIRTH_DATE', key: 'LOGIN\u200BBIRTH_DATE' },
    { label: 'LOGIN + e-acute + BIRTH_DATE', key: 'LOGIN\u00E9BIRTH_DATE' },
    { label: 'LOGIN + en dash + DT', key: 'LOGIN\u2013DT' },
    { label: 'LOGIN + fullwidth A', key: 'LOGIN\uFF21' },
    { label: 'LOGIN + fullwidth underscore + 1', key: 'LOGIN\uFF3F1' },
    { label: 'LOGIN + zero-width space', key: 'LOGIN\u200B' },
    { label: 'LOGIN;BIRTH_DATE', key: 'LOGIN;BIRTH_DATE' },
  ];

  for (const c of PRESERVED) {
    test(`(control) ${c.label}: hasGluedSensitiveColumn is true`, () => {
      expect(hasGluedSensitiveColumn([c.key])).toBe(true);
    });
  }

  for (const c of PRESERVED.filter(
    (p) => p.label.startsWith('ID +') || p.label.includes('e-acute'),
  )) {
    test(`(control) ${c.label}: run as a header, the file is withheld and counted`, () => {
      const { spy, calls } = spyOnConsoleError();
      try {
        const text = direct([`${c.key};NAME`, 'a;b', 'c;d']);
        const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
        expect(rows).toEqual([]);
        expect(skippedCount).toBe(2);
        expect(calls()).toHaveLength(1);
        expect(calls()[0]!.tag).toBe('[csv-parse] file withheld');
      } finally {
        spy.mockRestore();
      }
    });
  }
});

describe('parseCsvFile -- W-1: negative controls (real and native-script headers)', () => {
  test('(control) real and native-script headers are returned verbatim, never stripped or withheld', () => {
    const { spy } = spyOnConsoleError();
    try {
      const keys = [
        'ID',
        'NAME',
        'LOGIN_DT',
        'USER_LOGIN',
        'LOGIN_NAME',
        '\u0418\u041C\u042F',
        '\u041F\u0410\u0420\u041E\u041B\u042C',
        'PR\u00C9NOM',
        'L\u00C9GION',
      ];
      const text = direct([keys.join(';'), keys.map((_, i) => `v${i}`).join(';')]);
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(skippedCount).toBe(0);
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0]!.data)).toEqual(keys);
      expect(hasSensitiveColumn(rows[0]!.data)).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  test('(control) a duplicated LOGIN column keeps its keys, is not withheld, and the strip removes both', () => {
    const { spy } = spyOnConsoleError();
    try {
      const { rows, skippedCount } = parseCsvFile(direct(['LOGIN;LOGIN;X', 'a;b;c']), 'X', 'd.csv');
      expect(skippedCount).toBe(0);
      expect(Object.keys(rows[0]!.data)).toEqual(['LOGIN', 'LOGIN_1', 'X']);
      expect(strippedKeys(rows[0]!)).toEqual(['X']);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('hasGluedSensitiveColumn -- W-1 lookalikes', () => {
  test('(control before, guard after) a key the fold resolves to an exact name is NOT withheld; the strip removes it', () => {
    for (const key of [
      FW_LOGIN,
      'L\u041EGIN',
      'LOG\u0130N',
      'LOG\u0406N',
      'LOG\u04C0N',
      'BIRTH_DATE_\u0405RC',
      `${FW_LOGIN}_\uFF11`,
    ]) {
      expect(hasGluedSensitiveColumn([key]), `key ${JSON.stringify(key)}`).toBe(false);
    }
  });

  test('a key the fold cannot resolve but that reads as a deny-listed name IS withheld', () => {
    for (const key of [
      'L\u0555GIN',
      'L\u2C9EGIN',
      'L\u00D3GIN',
      'LO\u200BGIN',
      'LO\u00ADGIN',
      'LOGIN_\u0661',
      '\u04C0ogin',
      '\u04CFogin',
      '\u0399ogin',
    ]) {
      expect(hasGluedSensitiveColumn([key]), `key ${JSON.stringify(key)}`).toBe(true);
    }
  });

  test('a glued key is still caught after folding (fullwidth LOGIN; fullwidth BIRTH_DATE)', () => {
    expect(hasGluedSensitiveColumn([`${FW_LOGIN};${FW_BIRTH_DATE}`])).toBe(true);
  });

  test('(control) real and native-script names are not withheld', () => {
    for (const key of [
      'LOGIN_DT',
      'USER_LOGIN',
      'LOGIN_NAME',
      '\u0418\u041C\u042F',
      '\u041F\u0410\u0420\u041E\u041B\u042C',
      'PR\u00C9NOM',
      'L\u00C9GION',
    ]) {
      expect(hasGluedSensitiveColumn([key]), `key ${JSON.stringify(key)}`).toBe(false);
    }
  });

  test('hasSensitiveColumn follows the fold: lookalike names trigger, a native word does not', () => {
    expect(hasSensitiveColumn({ [FW_LOGIN]: 'x' })).toBe(true);
    expect(hasSensitiveColumn({ ['L\u041EGIN']: 'x' })).toBe(true);
    expect(hasSensitiveColumn({ ['LOG\u0406N']: 'x' })).toBe(true);
    expect(hasSensitiveColumn({ ['\u0418\u041C\u042F']: 'x' })).toBe(false);
  });
});

// =============================================================================
// 02-06 Task 2 -- W-2: terminators mixed INSIDE one file
// =============================================================================
//
// 02-VERIFICATION.md W-2. PapaParse picks ONE line break per file, so a record
// joined by another terminator was glued into its neighbour with skippedCount 0,
// and with a stray quote one valid record was lost while the count said 1. When
// two or more terminator kinds occur, every CRLF and bare CR is rewritten to LF
// and PapaParse is told `newline: '\n'`; uniform files are not touched.
//
// Tests tagged "(control)" are EXPECTED TO PASS before the change as well as
// after: they pin the bytes of a uniform file (M5b) and the Excel-style file
// (M5c). A control that fails, or a non-control that passes before the change,
// means the fixture shape is wrong: fix the fixture, never the expectation.
// =============================================================================

describe('parseCsvFile -- W-2: records split on their own terminator', () => {
  test('M1 (verifier probe 1): a bare LF record inside a CRLF file is its own row', () => {
    const text = 'A;B' + CRLF + '1;2' + LF + '3;4' + CRLF + '5;6' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows.map((r) => r.data)).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
      { A: '5', B: '6' },
    ]);
  });

  test('M2 (verifier probe 2): a bare CR record inside a CRLF file is its own row', () => {
    const text = 'A;B' + CRLF + '1;2' + CR + '3;4' + CRLF + '5;6' + CRLF + '7;8' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows.map((r) => r.data)).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
      { A: '5', B: '6' },
      { A: '7', B: '8' },
    ]);
  });

  test('M3: an LF record inside a bare-CR file, and a CRLF record inside an LF file', () => {
    const crFile = 'A;B' + CR + '1;2' + CR + '3;4' + LF + '5;6' + CR;
    const a = parseCsvFile(crFile, 'X', 'a.csv');
    expect(a.skippedCount).toBe(0);
    expect(firstColumn(a.rows)).toEqual(['1', '3', '5']);
    expect(a.rows.map((r) => r.data['B'])).toEqual(['2', '4', '6']);

    const lfFile = 'A;B' + LF + '1;2' + CRLF + '3;4' + LF;
    const b = parseCsvFile(lfFile, 'X', 'b.csv');
    expect(b.skippedCount).toBe(0);
    expect(b.rows.map((r) => r.data)).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ]);
  });

  test('M4: every cell quoted with the terminators mixed keeps every row and counts nothing lost', () => {
    const text = '"A";"B"' + CRLF + '"1";"2"' + CR + '"3";"4"' + LF + '"5";"6"' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(firstColumn(rows)).toEqual(['1', '3', '5']);
  });

  test('M5: a line break inside a quoted cell of a MIXED file stays in the cell (CRLF becomes LF, the stated cost)', () => {
    const text = 'A;B' + CRLF + '1;2' + LF + '3;"x' + CRLF + 'y"' + CR + '4;5' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows).toHaveLength(3);
    expect(rows[1]!.data['B']).toBe('x' + LF + 'y');
    expect(rows[2]!.data).toEqual({ A: '4', B: '5' });
  });

  test('M5b (control): a UNIFORM CRLF file keeps the CRLF inside a quoted cell byte for byte', () => {
    const text = 'A;B' + CRLF + '1;2' + CRLF + '3;"x' + CRLF + 'y"' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.data['B']).toBe('x' + CRLF + 'y');
  });

  test('M5c (control): the Excel-style file (CRLF terminators, Alt+Enter LF in a quoted cell) keeps the LF', () => {
    const text = 'A;B' + CRLF + '1;2' + CRLF + '3;"x' + LF + 'y"' + CRLF + '4;5' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows.map((r) => r.data)).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: 'x' + LF + 'y' },
      { A: '4', B: '5' },
    ]);
  });
});

describe('parseCsvFile -- W-2: a stray quote in a mixed file costs exactly its own line', () => {
  test('M6 (verifier probe 3): the valid first record survives, one skip at line 3', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const text = 'A;B' + CRLF + '1;2' + LF + '3;"abc' + CRLF + '4;5' + CRLF + '6;7' + CRLF;
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(rows.map((r) => r.data)).toEqual([
        { A: '1', B: '2' },
        { A: '4', B: '5' },
        { A: '6', B: '7' },
      ]);
      expect(skippedCount).toBe(1);
      expect(calls()).toHaveLength(1);
      expect(calls()[0]!.tag).toBe('[csv-parse] skipped row');
      expect(calls()[0]!.detail['line']).toBe(3);
      expect(calls()[0]!.detail['reason']).toBe('Quotes');
    } finally {
      spy.mockRestore();
    }
  });

  test('M7: every terminator kind counts as one physical line (stray quote on line 4)', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const text = 'A;B' + CRLF + '1;2' + CR + '3;4' + LF + '5;"abc' + CR + '6;7' + CRLF;
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
      expect(firstColumn(rows)).toEqual(['1', '3', '6']);
      expect(skippedCount).toBe(1);
      expect(calls()).toHaveLength(1);
      expect(calls()[0]!.detail['line']).toBe(4);
    } finally {
      spy.mockRestore();
    }
  });

  test('M8: a CR directly followed by a CRLF is two terminators and one blank line, never glued', () => {
    const text = 'A;B' + CR + CRLF + '1;2' + CR + CRLF + '3;4' + CRLF;
    const { rows, skippedCount } = parseCsvFile(text, 'X', 'a.csv');
    expect(skippedCount).toBe(0);
    expect(rows.map((r) => r.data)).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ]);
  });

  test('M9: the quarantine cap accounts identically under alternating terminators', () => {
    const { spy, calls } = spyOnConsoleError();
    try {
      const max = MAX_QUARANTINED_RECORDS;
      const terminators = [CRLF, LF, CR];
      let at = 0;
      const next = (): string => terminators[at++ % terminators.length]!;
      let text = 'ID;NAME' + next();
      for (let i = 0; i <= max; i++) {
        text += `g${i};ok` + next();
        text += `s${i};"x` + next();
      }
      for (let i = 0; i < 5; i++) text += `t${i};ok` + next();
      const { rows, skippedCount } = parseCsvFile(text, 'X', 'big.csv');

      expect(rows).toHaveLength(max + 1);
      expect(skippedCount).toBe(max + 6);
      const all = calls();
      expect(all.filter((c) => c.tag === '[csv-parse] skipped row')).toHaveLength(max);
      const withheld = all.filter((c) => c.tag === '[csv-parse] remainder withheld');
      expect(withheld).toHaveLength(1);
      expect(withheld[0]!.detail['reason']).toBe('quarantine-cap');
    } finally {
      spy.mockRestore();
    }
  });
});
