import { describe, expect, test } from 'vitest';
import {
  extractAccountRecord,
  extractIdentity,
  hasSensitiveColumn,
  isUserInfoCategory,
  sanitizeUserInfoRow,
} from '../../../src/lib/worker/identity.ts';
import { MAX_ACCOUNT_TEXT_LENGTH } from '../../../src/lib/features/logins/login-shared.ts';

// =============================================================================
// identity.ts — the D-18 strip and the D-17/D-20 identity pick
// =============================================================================
//
// Why this file exists (03-01-PLAN Task 2, IDENTITY-01, threat T-03-01/04/05):
//   The privacy guarantee that the account email and birth data never rest
//   in IndexedDB is enforced in exactly one function — `sanitizeUserInfoRow`
//   — and the guarantee that only three safe fields reach the main thread
//   is enforced in exactly one other — `extractIdentity`.
//
//   Both take their input from a REAL untrusted export, whose column names
//   are whatever the CSV says. RESEARCH Q3 probed what PapaParse does with
//   that input, and the three answers that matter are all ways a naive
//   `row.LOGIN = undefined` strip leaks:
//
//     - it does NOT trim header names   →  ' LOGIN' survives
//     - it does NOT upper-case them     →  'login' survives
//     - it renames a duplicate column   →  'LOGIN_1' survives
//     - cells beyond the header land in `__parsed_extra`, an array the
//       worker never inspects
//
//   Those are what this file pins, as pure functions with no worker
//   globals, so the guarantee is testable without a zip or a database.
// =============================================================================

type Row = Record<string, string | undefined>;

/** A realistic sanitised Account_Info row, as identity.ts would produce. */
const SAMPLE_ROW: Row = {
  ID: '123456789',
  NAME: 'Synthetic Player',
  CREATED_AT: '2020-01-01 00:00:00',
  ACTIVATED_AT: '2020-01-02 00:00:00',
  IP: '192.0.2.10',
  COUNTRY_CODE: 'US',
  REGION: 'CA',
  CITY: 'Testville',
  USER_LANGUAGE: 'en',
  USER_STATED_COUNTRY: 'US',
};

describe('sanitizeUserInfoRow — the D-18 drop list', () => {
  test('drops every casing and padding of LOGIN, BIRTH_DATE and BIRTH_DATE_SRC', () => {
    const input: Row = {
      LOGIN: 'a@example.invalid',
      login: 'b@example.invalid',
      ' LOGIN': 'c@example.invalid',
      'LOGIN ': 'd@example.invalid',
      LogIn: 'e@example.invalid',
      BIRTH_DATE: '1990-01-01',
      'BIRTH_DATE ': '1991-02-02',
      ' birth_date': '1992-03-03',
      BIRTH_DATE_SRC: 'self',
      'birth_date_src ': 'passport',
    };
    expect(Object.keys(sanitizeUserInfoRow(input))).toEqual([]);
  });

  test('drops Papa’s duplicate-header rename (LOGIN_1) but keeps a non-sensitive _N column', () => {
    const out = sanitizeUserInfoRow({
      LOGIN: 'a@example.invalid',
      LOGIN_1: 'b@example.invalid',
      BIRTH_DATE_2: '1990-01-01',
      BIRTH_DATE_SRC_3: 'self',
      IP_1: '192.0.2.10',
    });
    expect(Object.keys(out)).toEqual(['IP_1']);
  });

  test('drops the __parsed_extra overflow bucket and keeps the safe cells around it', () => {
    // PapaParse puts overflow CELLS in an ARRAY under this key. The `Row`
    // type models the ordinary all-string row and does not spell that
    // array out, so the literal is cast: the runtime shape is exactly what
    // the strip has to survive, and it is the one shape a column-name
    // deny-list cannot see into.
    const input = {
      ID: '123456789',
      NAME: 'Synthetic Player',
      __parsed_extra: ['canary@example.invalid', '1990-01-01'],
    } as unknown as Row;
    const out = sanitizeUserInfoRow(input);
    expect(Object.keys(out)).toEqual(['ID', 'NAME']);
    expect(out['NAME']).toBe('Synthetic Player');
  });

  test('keeps IP, COUNTRY_CODE and CITY — D-18 narrows User_Info to three columns only', () => {
    const out = sanitizeUserInfoRow({ ...SAMPLE_ROW, LOGIN: 'a@example.invalid' });
    expect(out['IP']).toBe('192.0.2.10');
    expect(out['COUNTRY_CODE']).toBe('US');
    expect(out['CITY']).toBe('Testville');
    expect(out['NAME']).toBe('Synthetic Player');
  });

  test('does not mutate its input', () => {
    const input: Row = { ...SAMPLE_ROW, LOGIN: 'a@example.invalid' };
    const before = Object.keys(input);
    sanitizeUserInfoRow(input);
    expect(Object.keys(input)).toEqual(before);
    expect(input['LOGIN']).toBe('a@example.invalid');
  });

  test('a __proto__ header becomes an own data property and leaves the prototype alone (T-03-04)', () => {
    // Object.fromEntries (rather than copy-then-delete) is what makes this
    // hold: it creates own properties, so a key literally spelled
    // `__proto__` cannot reach the prototype chain.
    const hostile = Object.create(null) as Row;
    hostile['__proto__'] = 'polluted';
    hostile['NAME'] = 'Synthetic Player';

    const out = sanitizeUserInfoRow(hostile);
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(out['NAME']).toBe('Synthetic Player');
  });
});

describe('isUserInfoCategory', () => {
  test('is true for every casing of the folder name and false for anything else', () => {
    // classifyFolder is case-insensitive and PRESERVES the raw name, so
    // `user_info` classifies as the same supported category. A literal
    // comparison against 'User_Info' would let that export's email
    // straight into IndexedDB.
    expect(isUserInfoCategory('User_Info')).toBe(true);
    expect(isUserInfoCategory('user_info')).toBe(true);
    expect(isUserInfoCategory('USER_INFO')).toBe(true);
    expect(isUserInfoCategory('User_Info_extra')).toBe(false);
    expect(isUserInfoCategory('Chat_history')).toBe(false);
    expect(isUserInfoCategory('')).toBe(false);
  });
});

describe('extractIdentity — the D-17 row choice', () => {
  test('returns null for zero rows (the D-16 fallback trigger)', () => {
    expect(extractIdentity([], '123456789')).toBeNull();
  });

  test('a single row yields the three fields and nothing else (T-03-05)', () => {
    const identity = extractIdentity([SAMPLE_ROW], '123456789');
    expect(identity).toEqual({
      nickname: 'Synthetic Player',
      region: 'CA',
      createdAt: '2020-01-01 00:00:00',
    });
    expect(Object.keys(identity!).sort()).toEqual(['createdAt', 'nickname', 'region']);
  });

  test('picks the row whose ID equals the account root over a decoy first row', () => {
    const decoy: Row = { ID: '999999999', NAME: 'Decoy Player', REGION: 'NA', CREATED_AT: 'x' };
    const match: Row = {
      ID: '123456789',
      NAME: 'Matched Player',
      REGION: 'EU',
      CREATED_AT: 'y',
    };
    expect(extractIdentity([decoy, match], '123456789')).toEqual({
      nickname: 'Matched Player',
      region: 'EU',
      createdAt: 'y',
    });
  });

  test('falls back to the first row when no ID matches', () => {
    const first: Row = { ID: '999999999', NAME: 'Decoy Player', REGION: 'NA' };
    const second: Row = { ID: '888888888', NAME: 'Other Player', REGION: 'EU' };
    expect(extractIdentity([first, second], '123456789')?.nickname).toBe('Decoy Player');
  });

  test('an empty account root (a re-zipped export with no ID folder) falls back to row 1', () => {
    const rows: Row[] = [
      { ID: '999999999', NAME: 'Decoy Player', REGION: 'NA' },
      { ID: '123456789', NAME: 'Matched Player', REGION: 'EU' },
    ];
    expect(extractIdentity(rows, '')?.nickname).toBe('Decoy Player');
  });

  test('two rows sharing the account-root ID pick the FIRST, so the choice is stable', () => {
    const first: Row = { ID: '123456789', NAME: 'First Match', REGION: 'EU' };
    const second: Row = { ID: '123456789', NAME: 'Second Match', REGION: 'NA' };
    expect(extractIdentity([first, second], '123456789')?.nickname).toBe('First Match');
  });
});

describe('extractIdentity — hostile header shapes', () => {
  test('padded, lower-case and duplicate-suffixed column names all resolve', () => {
    const variant: Row = {
      ID: '123456789',
      ' NAME ': '  Variant Player  ',
      CREATED_AT: '2021-02-03 04:05:06',
      region: 'EU',
    };
    expect(extractIdentity([variant], '123456789')).toEqual({
      nickname: 'Variant Player',
      region: 'EU',
      createdAt: '2021-02-03 04:05:06',
    });

    const lower: Row = {
      id: '123456789',
      name: 'Lower Player',
      created_at: '2022-03-04 05:06:07',
      region: 'EU',
    };
    expect(extractIdentity([lower], '123456789')).toEqual({
      nickname: 'Lower Player',
      region: 'EU',
      createdAt: '2022-03-04 05:06:07',
    });
  });

  test('a missing REGION column yields a null slot, not a dropped identity', () => {
    const identity = extractIdentity(
      [{ ID: '123456789', NAME: 'No Region Player', CREATED_AT: '2020-01-01 00:00:00' }],
      '123456789',
    );
    expect(identity).toEqual({
      nickname: 'No Region Player',
      region: null,
      createdAt: '2020-01-01 00:00:00',
    });
  });

  test('blank and whitespace-only values become null, and real values are trimmed', () => {
    const identity = extractIdentity(
      [{ ID: '123456789', NAME: '   ', REGION: '', CREATED_AT: ' 2020-01-01 00:00:00 ' }],
      '123456789',
    );
    expect(identity).toEqual({ nickname: null, region: null, createdAt: '2020-01-01 00:00:00' });
  });

  test('a non-string cell (Papa’s undefined for a short row) is treated as absent', () => {
    const identity = extractIdentity(
      [{ ID: '123456789', NAME: undefined, REGION: 'CA', CREATED_AT: undefined }],
      '123456789',
    );
    expect(identity).toEqual({ nickname: null, region: 'CA', createdAt: null });
  });
});

// =============================================================================
// extractAccountRecord — the D-02 "Account record" row (06-05)
// =============================================================================
//
// Why this file's other half is still here: the account record reads IP,
// COUNTRY_CODE and CITY out of the SAME sanitised pool the identity pick uses,
// so the two guarantees meet in one place. The pool is what makes the email and
// the birth date structurally out of reach — a test that passed a row still
// carrying them would be testing a pool the worker never builds, so the last
// case below runs the row through `sanitizeUserInfoRow` first and asserts that
// none of the three leaked into the record.
//
// The three address states are the content: `readable`, `unreadable` and
// `blank` are three different facts about the user's own export, and a single
// `ip: string | null` would let a cell this build cannot read stand in for a
// cell the export never wrote.
// =============================================================================

describe('extractAccountRecord — the D-02 row choice', () => {
  test('returns null for zero rows (no account record at all)', () => {
    expect(extractAccountRecord([], '123456789')).toBeNull();
  });

  test('reads IP, COUNTRY_CODE and CITY from the account row, as written', () => {
    expect(extractAccountRecord([SAMPLE_ROW], '123456789')).toEqual({
      ip: '192.0.2.10',
      ipState: 'readable',
      countryCode: 'US',
      city: 'Testville',
    });
  });

  test('picks the row whose ID equals the account root, over a decoy first row', () => {
    const decoy: Row = { ID: '999999999', IP: '198.51.100.20', CITY: 'Decoytown' };
    const match: Row = { ID: '123456789', IP: '192.0.2.10', CITY: 'Testville' };
    expect(extractAccountRecord([decoy, match], '123456789')?.city).toBe('Testville');
  });

  test('falls back to the first row when no ID matches, and when the root is empty', () => {
    const first: Row = { ID: '999999999', CITY: 'Decoytown' };
    const second: Row = { ID: '888888888', CITY: 'Othertown' };
    expect(extractAccountRecord([first, second], '123456789')?.city).toBe('Decoytown');
    expect(extractAccountRecord([first, second], '')?.city).toBe('Decoytown');
  });

  test('the account row is chosen exactly the way the identity row is', () => {
    // The two picks are spelled out separately in the source on purpose (the
    // identity header must not be able to reach the account record), so this
    // is the test that says they still AGREE: a pool whose identity comes from
    // one row has its account record from that same row.
    const rows: Row[] = [
      {
        ID: '999999999',
        NAME: 'Decoy Player',
        REGION: 'NA',
        IP: '198.51.100.20',
        CITY: 'Decoytown',
      },
      {
        ID: '123456789',
        NAME: 'Matched Player',
        REGION: 'EU',
        IP: '192.0.2.10',
        CITY: 'Testville',
      },
    ];
    const identity = extractIdentity(rows, '123456789');
    const account = extractAccountRecord(rows, '123456789');
    expect(identity?.nickname).toBe('Matched Player');
    expect(account?.city).toBe('Testville');
    expect(extractIdentity([rows[0]!], '123456789')?.nickname).toBe('Decoy Player');
    expect(extractAccountRecord([rows[0]!], '123456789')?.city).toBe('Decoytown');
  });
});

describe('extractAccountRecord — the three address states', () => {
  test('a parseable address is stored CANONICAL, not as the cell was written', () => {
    // The canonical form is the grouping key everywhere else in the feature, and
    // it is what makes `2001:DB8::1` and `2001:db8:0:0:0:0:0:1` ONE account
    // record rather than two.
    expect(extractAccountRecord([{ IP: '2001:DB8::1' }], '')?.ip).toBe('2001:db8:0:0:0:0:0:1');
    expect(extractAccountRecord([{ IP: ' 192.0.2.10 ' }], '')).toMatchObject({
      ip: '192.0.2.10',
      ipState: 'readable',
    });
  });

  test('a non-blank cell that does not parse is UNREADABLE and is never stored as text', () => {
    // The cells below are the shapes D-06 and T-06-13 name. A stored one would
    // be a value a later renderer could put on a screen, and D-21 keeps dataset
    // text off the screen — so the record says it could not be read and stops.
    for (const cell of ['192.0.2.010', 'player@example.invalid', 'fe80::1%eth0', '<b>x</b>']) {
      const record = extractAccountRecord([{ IP: cell }], '');
      expect(record, cell).toEqual({
        ip: null,
        ipState: 'unreadable',
        countryCode: null,
        city: null,
      });
    }
  });

  test('a blank or absent cell is BLANK, which is a different fact from unreadable', () => {
    for (const row of [{}, { IP: '' }, { IP: '   ' }]) {
      expect(extractAccountRecord([row], '')?.ipState).toBe('blank');
      expect(extractAccountRecord([row], '')?.ip).toBeNull();
    }
  });

  test('an unreadable address leaves the country and city readable', () => {
    // Only the ADDRESS is unreadable. Collapsing the whole record would report
    // a missing country for an export that states one.
    expect(extractAccountRecord([{ IP: 'nope', COUNTRY_CODE: 'PL', CITY: 'Krakow' }], '')).toEqual({
      ip: null,
      ipState: 'unreadable',
      countryCode: 'PL',
      city: 'Krakow',
    });
  });
});

describe('extractAccountRecord — text bounds and the sanitised pool', () => {
  test('the country code and city are trimmed, and cut at 64 characters', () => {
    const long = 'C'.repeat(MAX_ACCOUNT_TEXT_LENGTH + 40);
    const record = extractAccountRecord(
      [{ IP: '192.0.2.10', COUNTRY_CODE: '  PL  ', CITY: `  ${long}  ` }],
      '',
    );
    expect(record?.countryCode).toBe('PL');
    expect(record?.city).toBe(long.trim().slice(0, MAX_ACCOUNT_TEXT_LENGTH));
    expect(record?.city).toHaveLength(MAX_ACCOUNT_TEXT_LENGTH);
  });

  test('a blank country or city is null, and a whitespace-only one counts as blank', () => {
    const record = extractAccountRecord([{ IP: '192.0.2.10', COUNTRY_CODE: '  ', CITY: '' }], '');
    expect(record?.countryCode).toBeNull();
    expect(record?.city).toBeNull();
  });

  test('padded and lower-case account column names still resolve', () => {
    const hostile: Row = {
      ID: '123456789',
      ' ip ': '192.0.2.10',
      country_code: 'DE',
      City: 'Berlin',
    };
    expect(extractAccountRecord([hostile], '123456789')).toEqual({
      ip: '192.0.2.10',
      ipState: 'readable',
      countryCode: 'DE',
      city: 'Berlin',
    });
  });

  test('LOGIN, BIRTH_DATE and the overflow bucket cannot reach the record', () => {
    // The pool the worker hands in has been through `sanitizeUserInfoRow`, so
    // this runs the real strip and then the real pick over what it left. A leak
    // would have to be a column this function reads by name, and it reads
    // exactly three.
    const dirty = {
      ID: '123456789',
      NAME: 'Synthetic Player',
      IP: '192.0.2.10',
      COUNTRY_CODE: 'US',
      CITY: 'Testville',
      LOGIN: 'synthetic.player@example.invalid',
      LOGIN_1: 'duplicate@example.invalid',
      BIRTH_DATE: '1990-01-01',
      __parsed_extra: ['CANARY-OVERFLOW-CELL'],
    } as unknown as Row;

    const record = extractAccountRecord([sanitizeUserInfoRow(dirty)], '123456789');
    expect(record).toEqual({
      ip: '192.0.2.10',
      ipState: 'readable',
      countryCode: 'US',
      city: 'Testville',
    });
    expect(JSON.stringify(record)).not.toContain('example.invalid');
    expect(JSON.stringify(record)).not.toContain('1990-01-01');
    expect(JSON.stringify(record)).not.toContain('CANARY-OVERFLOW-CELL');
  });

  test('a row with no ID column at all still yields the first row, not a throw', () => {
    expect(extractAccountRecord([{ CITY: 'Nowhere' }], '123456789')?.city).toBe('Nowhere');
  });
});

// =============================================================================
// hasSensitiveColumn — the header-name trigger (CR-01 layer 2, plan 01-13)
// =============================================================================
//
// The strip is keyed on the column NAME a row carries, not on the folder it
// was filed under. These cases pin the trigger against the same normalisation
// the strip uses (trim + upper-case + the `_N` duplicate suffix), and pin the
// near-misses that must NOT trigger: the login time column LOGIN_DT, and a row
// whose only unusual key is the overflow bucket.
// =============================================================================

describe('hasSensitiveColumn — the header-name trigger (CR-01 layer 2, plan 01-13)', () => {
  test.each([
    'LOGIN',
    'login',
    ' LOGIN',
    'LOGIN ',
    'LogIn',
    'BIRTH_DATE',
    'BIRTH_DATE ',
    ' birth_date',
    'BIRTH_DATE_SRC',
    'birth_date_src ',
    'LOGIN_1',
    'BIRTH_DATE_2',
    'BIRTH_DATE_SRC_3',
  ])('is true for a row carrying the header %j', (header) => {
    expect(hasSensitiveColumn({ ID: '1', [header]: 'x' })).toBe(true);
  });

  test.each(['LOGIN_DT', 'LOGIN_ID', 'LOGINS', 'BIRTH', 'IP', 'NAME', 'SESSION_START'])(
    'is false for a row whose only header is the near-miss %j',
    (header) => {
      expect(hasSensitiveColumn({ [header]: 'x' })).toBe(false);
    },
  );

  test('is false for an empty row', () => {
    expect(hasSensitiveColumn({})).toBe(false);
  });

  test('is false for a row whose only unusual key is the overflow bucket', () => {
    const row = { ID: '1', __parsed_extra: ['a@b.invalid'] } as unknown as Row;
    expect(hasSensitiveColumn(row)).toBe(false);
  });

  test('is false for a row whose deny-listed name exists only on its prototype', () => {
    const row = Object.create({ LOGIN: 'inherited' }) as Row;
    row['ID'] = '1';
    expect(row['LOGIN']).toBe('inherited');
    expect(hasSensitiveColumn(row)).toBe(false);
  });

  test('agrees with the strip: a row is flagged exactly when the strip would remove a column', () => {
    const rows: Row[] = [
      { ID: '1', LOGIN: 'x' },
      { ID: '1', ' birth_date ': 'x' },
      { ID: '1', LOGIN_DT: 'x' },
      { ID: '1', NAME: 'x' },
    ];
    for (const row of rows) {
      const stripped = Object.keys(sanitizeUserInfoRow(row)).length;
      expect(hasSensitiveColumn(row)).toBe(stripped < Object.keys(row).length);
    }
  });
});
