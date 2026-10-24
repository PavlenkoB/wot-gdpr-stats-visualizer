import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clampName,
  readCount,
  readTankId,
  resolveFields,
  type FieldSpec,
} from '../../../src/lib/features/overview/overview-columns.ts';
import { readAccountStats } from '../../../src/lib/features/overview/overview-account-stats.ts';
import type { OverviewFileInput } from '../../../src/lib/features/overview/overview-aggregate.ts';
import type { AccountRowGroup } from '../../../src/lib/worker/csv-columns.ts';
import { OV_IDS, OV_NAME_CANARY, OV_ROOT_A, OV_ROOT_B } from '../../fixtures/overview-fixtures.ts';

// =============================================================================
// The account-statistics reader (13-07 Task 1, D-04, D-18, D-19, T-13-19/20)
// =============================================================================
//
// WHAT THIS PINS
//   - each account resolves its OWN columns, so the account that spells the
//     battle count `GAMES_PLAYED` is read through `GAMES_PLAYED` and the one
//     that spells it `BATTLES_COUNT` through `BATTLES_COUNT` (CR-01, T-13-20);
//   - a cell that is not a plain number reads as null and NEVER as zero: a
//     blank, `N/D`, `N/A`, a sign, a decimal point and an exponent are all
//     "the export does not say" (D-09);
//   - a record tank id is only an id when it matches /^[1-9][0-9]{0,9}$/, so
//     the export's own `0` reads as "not recorded" (D-09, Pitfall 9);
//   - the NICKNAME column is never read: a Proxy-wrapped row records every
//     property the reader touches, and `NAME` is not among them (D-18,
//     T-13-19).
//
// Every figure here is the fixture archive's own: 1,200 + 300 battles, 660 +
// 120 wins, and the record maxima the oracle states. The names are the
// fixture's invented tank ids and the account roots are made-up numbers.
// =============================================================================

/** The oracle's account A row, in the export's own column names. */
const ROW_A = {
  NAME: OV_NAME_CANARY,
  BATTLES_COUNT: '1200',
  WINS_COUNT: '660',
  BATTLE_LIFE_TIME: '864000',
  DAMAGE_MAX: '5200',
  XP_MAX: '2100',
  FRAGS_MAX: '7',
  MAX_DAMAGE_VEHICLE: OV_IDS.one,
  MAX_XP_VEHICLE: OV_IDS.two,
  MAX_FRAGS_VEHICLE: OV_IDS.one,
  SNIPER_SERIES_MAX: '9',
} as const;

/**
 * The oracle's account B row.
 *
 * The battle count is spelled `GAMES_PLAYED` here and nowhere else — the
 * whole point of the two-account archive — and the series is the export's own
 * `\N`, which means "no value" and not a zero.
 */
const ROW_B = {
  NAME: OV_NAME_CANARY,
  GAMES_PLAYED: '300',
  WINS_COUNT: '120',
  BATTLE_LIFE_TIME: '259200',
  DAMAGE_MAX: '6100',
  XP_MAX: '1900',
  FRAGS_MAX: '8',
  MAX_DAMAGE_VEHICLE: OV_IDS.three,
  MAX_XP_VEHICLE: OV_IDS.four,
  MAX_FRAGS_VEHICLE: '0',
  SNIPER_SERIES_MAX: '\\N',
} as const;

/** The two account groups, in the archive's order. */
function groups(): AccountRowGroup[] {
  return [
    { account: OV_ROOT_A, rows: [ROW_A] },
    { account: OV_ROOT_B, rows: [ROW_B] },
  ];
}

/** The file input for the two accounts. */
function input(seen = true, rows = groups()): OverviewFileInput {
  return { groups: rows, seen };
}

describe('readAccountStats: each account reads through its own header', () => {
  it('reads both accounts through their own battle-count spellings', () => {
    const read = readAccountStats(input());
    expect(read.present).toBe(true);
    expect(read.rows).toHaveLength(2);

    // 1,200 through `BATTLES_COUNT` and 300 through `GAMES_PLAYED` — the
    // second account is not read through the first account's key.
    expect(read.rows[0]?.battles).toBe(1200);
    expect(read.rows[1]?.battles).toBe(300);
    expect(read.rows[0]?.account).toBe(OV_ROOT_A);
    expect(read.rows[1]?.account).toBe(OV_ROOT_B);
  });

  it('reads the totals, the records and the tank ids the oracle states', () => {
    const read = readAccountStats(input());

    expect(read.rows[0]?.wins).toBe(660);
    expect(read.rows[0]?.battleSeconds).toBe(864000);
    expect(read.rows[0]?.damageMax).toBe(5200);
    expect(read.rows[0]?.xpMax).toBe(2100);
    expect(read.rows[0]?.fragsMax).toBe(7);
    expect(read.rows[0]?.sniperSeries).toBe(9);
    expect(read.rows[0]?.damageMaxTank).toBe(OV_IDS.one);
    expect(read.rows[0]?.xpMaxTank).toBe(OV_IDS.two);
    expect(read.rows[0]?.fragsMaxTank).toBe(OV_IDS.one);

    expect(read.rows[1]?.wins).toBe(120);
    expect(read.rows[1]?.battleSeconds).toBe(259200);
    expect(read.rows[1]?.damageMax).toBe(6100);
    expect(read.rows[1]?.xpMax).toBe(1900);
    expect(read.rows[1]?.fragsMax).toBe(8);
    expect(read.rows[1]?.damageMaxTank).toBe(OV_IDS.three);
    expect(read.rows[1]?.xpMaxTank).toBe(OV_IDS.four);
  });

  it('reads the export specials as null, never as zero', () => {
    const read = readAccountStats(input());

    // The series is `\N` in account B: "no value", not zero.
    expect(read.rows[1]?.sniperSeries).toBeNull();
    // The frags tank id is `0`: the export's "not recorded" spelling, which is
    // not an id at all.
    expect(read.rows[1]?.fragsMaxTank).toBeNull();
  });

  it('ignores a second row in the same group', () => {
    // The file holds one row per account. Reading a second row would double
    // the account's totals — a claim the export does not make.
    const withExtra: AccountRowGroup[] = [
      { account: OV_ROOT_A, rows: [ROW_A, { ...ROW_A, BATTLES_COUNT: '9999' }] },
      { account: OV_ROOT_B, rows: [ROW_B] },
    ];
    const read = readAccountStats(input(true, withExtra));
    expect(read.rows).toHaveLength(2);
    expect(read.rows[0]?.battles).toBe(1200);
  });

  it('contributes no row for a group with no rows', () => {
    const withEmpty: AccountRowGroup[] = [
      { account: OV_ROOT_A, rows: [] },
      { account: OV_ROOT_B, rows: [ROW_B] },
    ];
    const read = readAccountStats(input(true, withEmpty));
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0]?.account).toBe(OV_ROOT_B);
    expect(read.present).toBe(true);
  });

  it('is not present when the file was not in the export', () => {
    // The rows are read either way — `seen` is a claim about the ARCHIVE, not
    // about the rows — but the file is not present, and every caller asks
    // `present` before it uses a figure.
    expect(readAccountStats(input(false)).present).toBe(false);
  });

  it('is not present when no group holds a row', () => {
    const read = readAccountStats(input(true, [{ account: OV_ROOT_A, rows: [] }]));
    expect(read.present).toBe(false);
  });
});

describe('readAccountStats: which columns the export carried', () => {
  it('is true for a column any one account resolved', () => {
    const read = readAccountStats(input());
    expect(read.columns.battles).toBe(true);
    expect(read.columns.wins).toBe(true);
    expect(read.columns.battleSeconds).toBe(true);
    expect(read.columns.damageMax).toBe(true);
    expect(read.columns.xpMax).toBe(true);
    expect(read.columns.fragsMax).toBe(true);
    expect(read.columns.sniperSeries).toBe(true);
  });

  it('is false for a column no account resolved', () => {
    // A battles-only file: the counts resolve, the records do not.
    const battlesOnly: AccountRowGroup[] = [
      {
        account: OV_ROOT_A,
        rows: [
          {
            NAME: OV_NAME_CANARY,
            BATTLES_COUNT: '1200',
            WINS_COUNT: '660',
            BATTLE_LIFE_TIME: '864000',
          },
        ],
      },
    ];
    const read = readAccountStats(input(true, battlesOnly));
    expect(read.columns.battles).toBe(true);
    expect(read.columns.wins).toBe(true);
    expect(read.columns.damageMax).toBe(false);
    expect(read.columns.xpMax).toBe(false);
    expect(read.columns.fragsMax).toBe(false);
    expect(read.columns.sniperSeries).toBe(false);
    // The file is still present: it is the COLUMNS that are missing.
    expect(read.present).toBe(true);
  });

  it('is true when only one of two accounts carries the column', () => {
    const oneWins: AccountRowGroup[] = [
      {
        account: OV_ROOT_A,
        rows: [{ NAME: OV_NAME_CANARY, BATTLES_COUNT: '10', WINS_COUNT: '4' }],
      },
      { account: OV_ROOT_B, rows: [{ NAME: OV_NAME_CANARY, GAMES_PLAYED: '5' }] },
    ];
    const read = readAccountStats(input(true, oneWins));
    expect(read.columns.wins).toBe(true);
    expect(read.columns.battleSeconds).toBe(false);
    // The account without the column reads a null figure, not a zero.
    expect(read.rows[1]?.wins).toBeNull();
    expect(read.rows[1]?.battles).toBe(5);
  });
});

describe('readCount: a count is a plain number or nothing', () => {
  it.each([
    ['0', 0],
    ['7', 7],
    ['1200', 1200],
    [' 12 ', 12],
    ['007', 7],
    ['000000000000000', 0],
    ['999999999999999', 999999999999999],
  ])('reads %s as %s', (raw, expected) => {
    expect(readCount(raw)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['N/D'],
    ['n/d'],
    ['N/A'],
    ['\\N'],
    ['-1'],
    ['+1'],
    ['1.5'],
    ['0.0'],
    ['1e3'],
    ['1,200'],
    ['12abc'],
    ['undefined'],
  ])('reads %s as null', (raw) => {
    expect(readCount(raw)).toBeNull();
  });

  it('reads an absent cell as null', () => {
    expect(readCount(undefined)).toBeNull();
  });

  it('refuses more than fifteen digits', () => {
    expect(readCount('1234567890123456')).toBeNull();
  });
});

describe('readTankId: an id is a positive integer or nothing', () => {
  it.each([
    ['1', '1'],
    ['12', '12'],
    [' 12 ', '12'],
    ['990001', '990001'],
    ['1234567890', '1234567890'],
  ])('reads %s as %s', (raw, expected) => {
    expect(readTankId(raw)).toBe(expected);
  });

  it.each([
    ['0'],
    ['00'],
    ['007'],
    [''],
    ['   '],
    ['\\N'],
    ['N/D'],
    ['N/A'],
    ['1e3'],
    ['-5'],
    ['12.0'],
    ['12345678901'],
    ['abc'],
  ])('reads %s as null', (raw) => {
    expect(readTankId(raw)).toBeNull();
  });

  it('reads an absent cell as null', () => {
    expect(readTankId(undefined)).toBeNull();
  });
});

describe("resolveFields: one walk, the row's own key wins", () => {
  const BATTLES: FieldSpec = {
    id: 'battles',
    headers: ['BATTLES_COUNT', 'BATTLES', 'GAMES_PLAYED'],
  };

  it("resolves to the row's own spelling of the key", () => {
    const resolved = resolveFields({ GAMES_PLAYED: '3' }, [BATTLES]);
    expect(resolved.get('battles')).toBe('GAMES_PLAYED');
  });

  it('prefers the key that appears first in the row', () => {
    // Both spellings are present: the one that comes FIRST in the row wins,
    // so the populated column is the one read.
    const resolved = resolveFields({ GAMES_PLAYED: '3', BATTLES_COUNT: '9' }, [BATTLES]);
    expect(resolved.get('battles')).toBe('GAMES_PLAYED');

    const reversed = resolveFields({ BATTLES_COUNT: '9', GAMES_PLAYED: '3' }, [BATTLES]);
    expect(reversed.get('battles')).toBe('BATTLES_COUNT');
  });

  it('matches a header case-insensitively and through its whitespace', () => {
    const resolved = resolveFields({ ' battles_count ': '4' }, [BATTLES]);
    expect(resolved.get('battles')).toBe(' battles_count ');
  });

  it('gives every field an entry, and null for the ones it cannot resolve', () => {
    const resolved = resolveFields({ WINS_COUNT: '1' }, [BATTLES]);
    expect(resolved.size).toBe(1);
    expect(resolved.get('battles')).toBeNull();
  });

  it('resolves nothing from an absent row', () => {
    const resolved = resolveFields(undefined, [BATTLES]);
    expect(resolved.get('battles')).toBeNull();
  });
});

describe('clampName: a name is trimmed and bounded', () => {
  it('trims and keeps the text', () => {
    expect(clampName('  Synth One  ')).toBe('Synth One');
  });

  it('cuts a very long name to a hundred characters', () => {
    expect(clampName('x'.repeat(500))).toHaveLength(100);
  });

  it('turns a blank into a blank', () => {
    expect(clampName('   ')).toBe('');
  });
});

describe("the column module has one dependency and it is the worker's row type", () => {
  it("imports only the worker's csv-columns module", () => {
    // The reader module reaches the worker for the ROW TYPE and the two
    // helpers beside it, and for nothing else: a second dependency would be a
    // second place where a column could be spelled.
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const source = readFileSync(
      path.join(repoRoot, 'src/lib/features/overview/overview-columns.ts'),
      'utf8',
    );
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import'))
      .map((line) => line.match(/from\s+'([^']+)'/)?.[1]);
    expect(imports).toEqual(['../../worker/csv-columns.ts']);
  });
});

describe('the nickname column is never read (D-18, T-13-19)', () => {
  it('reads no property called NAME, and enumerates the row once per group', () => {
    const reads: string[] = [];
    let enumerations = 0;

    const watched = (row: Record<string, string>): Record<string, string> =>
      new Proxy(row, {
        get(target, property, receiver) {
          if (typeof property === 'string') reads.push(property);
          return Reflect.get(target, property, receiver);
        },
        ownKeys(target) {
          enumerations += 1;
          return Reflect.ownKeys(target);
        },
      });

    const input: OverviewFileInput = {
      seen: true,
      groups: [
        { account: OV_ROOT_A, rows: [watched({ ...ROW_A })] },
        { account: OV_ROOT_B, rows: [watched({ ...ROW_B })] },
      ],
    };

    const read = readAccountStats(input);

    // The figures still read: the canary is a witness, not a blocker.
    expect(read.rows[0]?.battles).toBe(1200);
    expect(read.rows[1]?.battles).toBe(300);

    // The nickname was never touched.
    expect(reads).not.toContain('NAME');
    expect(reads).toContain('BATTLES_COUNT');
    expect(reads).toContain('GAMES_PLAYED');

    // ONE enumeration per group, never one per field.
    expect(enumerations).toBe(2);

    // And the canary never reaches the result.
    expect(JSON.stringify(read)).not.toContain(OV_NAME_CANARY);
  });
});
