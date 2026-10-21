import { describe, expect, it } from 'vitest';
import {
  buildHeatView,
  buildNewDataCard,
  buildWarshipsStorageView,
  cellOf,
  type NewDataCardInput,
} from '../../../src/lib/features/new-data/new-data-aggregate.ts';
import {
  HEAT_CARD_FILES,
  HEAT_CARD_IDS,
  WOWS_CARD_FILES,
  WOWS_CARD_IDS,
  type NewDataCardView,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
import { NEW_DATA_SPEC_FILES, type SpecFile } from '../../../src/lib/worker/new-data-specs.ts';

// =============================================================================
// Plan 11-07 Task 1 — the pure card builders
// =============================================================================

function spec(key: string): SpecFile {
  const found = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`no spec ${key}`);
  return found;
}

const CREWS = spec('wows_crews.csv');
const STORAGE = spec('wows_account_storage.csv');
const GEO = spec('heat_session_geolocation.csv');
const BATTLES = spec('heat_battle_types_statistics.csv');

type Row = Record<string, string | undefined>;

function input(
  rows: readonly Row[],
  extra: Partial<NewDataCardInput> = {},
  account = 'A1',
): NewDataCardInput {
  return {
    groups: rows.length === 0 ? [] : [{ account, rows }],
    seen: true,
    parsed: null,
    ...extra,
  };
}

function ready(view: NewDataCardView) {
  if (view.status !== 'ready') throw new Error(`expected ready, got ${view.status}`);
  return view;
}

describe('buildNewDataCard: the four states', () => {
  it('a file never seen is not-in-export', () => {
    expect(buildNewDataCard(CREWS, { groups: [], seen: false, parsed: null })).toEqual({
      status: 'not-in-export',
    });
  });

  it('seen with no stored rows and parsed 0 or unknown is no-rows', () => {
    expect(buildNewDataCard(CREWS, input([], { parsed: 0 }))).toEqual({ status: 'no-rows' });
    expect(buildNewDataCard(CREWS, input([], { parsed: null }))).toEqual({ status: 'no-rows' });
  });

  it('seen with no stored rows and parsed above 0 is skipped', () => {
    expect(buildNewDataCard(CREWS, input([], { parsed: 4 }))).toEqual({ status: 'skipped' });
  });

  it('stored rows give ready', () => {
    const view = ready(buildNewDataCard(CREWS, input([{ CREW_ID: 'c1' }])));
    expect(view.rowCount).toBe(1);
  });
});

describe('buildNewDataCard: columns and rows', () => {
  it('lists the spec columns some row carries, in SPEC order, with id and kind', () => {
    // Row keys deliberately in a different order from the spec.
    const view = ready(
      buildNewDataCard(
        CREWS,
        input([{ CREW_LEVEL: '7', CREW_ID: 'c1', CREW_TYPE: 'Captain' }, { CREW_SHIP: 'x' }]),
      ),
    );
    expect(view.columns).toEqual([
      { id: 'CREW_ID', kind: 'text' },
      { id: 'CREW_SHIP', kind: 'text' },
      { id: 'CREW_TYPE', kind: 'text' },
      { id: 'CREW_LEVEL', kind: 'number' },
    ]);
  });

  it('keeps one entry per stored row, in input order, with the group account', () => {
    const view = ready(
      buildNewDataCard(CREWS, {
        groups: [
          { account: 'A1', rows: [{ CREW_ID: 'a-1' }, { CREW_ID: 'a-2' }] },
          { account: 'B2', rows: [{ CREW_ID: 'b-1' }] },
        ],
        seen: true,
        parsed: null,
      }),
    );
    expect(view.rows.map((row) => row.account)).toEqual(['A1', 'A1', 'B2']);
    expect(view.rows.map((row) => row.cells[0])).toEqual(['a-1', 'a-2', 'b-1']);
    expect(view.rowCount).toBe(3);
  });

  it('never truncates: three thousand rows arrive whole', () => {
    const rows = Array.from({ length: 3000 }, (_, i) => ({ AMOUNT: String(i) }));
    const view = ready(buildNewDataCard(STORAGE, input(rows)));
    expect(view.rows).toHaveLength(3000);
    expect(view.rowCount).toBe(3000);
  });
});

describe('buildNewDataCard: cell rules', () => {
  function cellsOf(spec_: SpecFile, row: Row) {
    return ready(buildNewDataCard(spec_, input([row]))).rows[0]!.cells;
  }

  it('reads missing, blank and N/A or N/D in any case as null', () => {
    const cells = cellsOf(CREWS, {
      CREW_ID: '   ',
      CREW_SHIP: 'n/a',
      CREW_TYPE: 'N/D',
      CREW_LEVEL: undefined,
    });
    expect(cells).toEqual([null, null, null, null]);
  });

  it('turns a safe integer or a plain decimal in a number column into a number', () => {
    const [integer, decimal, signed] = cellsOf(BATTLES, {
      BATTLES: ' 42 ',
      WINS: '1.50',
      LOSSES: '-3',
    });
    expect(integer).toBe(42);
    expect(decimal).toBe(1.5);
    expect(signed).toBe(-3);
  });

  it('keeps an unsafe integer, an exponent and a word as the trimmed string', () => {
    const unsafe = '9007199254740993';
    const cells = cellsOf(BATTLES, { BATTLES: unsafe, WINS: '1e5', LOSSES: ' many ' });
    expect(cells).toEqual([unsafe, '1e5', 'many']);
  });

  it('trims text and clamps it to 200 characters', () => {
    const [cell] = cellsOf(CREWS, { CREW_ID: `  ${'x'.repeat(500)}  ` });
    expect(cell).toBe('x'.repeat(200));
  });

  it('keeps a date exactly as written', () => {
    const [cell] = cellsOf(GEO, { LAST_SESSION_STARTED_DT: '05.03.2024 20:00' });
    expect(cell).toBe('05.03.2024 20:00');
  });

  it('shows an address cell as the canonical address, or null when it is not one', () => {
    const geoColumns = (row: Row) => cellsOf(GEO, row)[0];
    expect(geoColumns({ IP: ' 203.0.113.7 ' })).toBe('203.0.113.7');
    expect(geoColumns({ IP: '2001:0DB8:0:0:0:0:0:1' })).not.toBeNull();
    expect(geoColumns({ IP: 'someone@example.invalid' })).toBeNull();
    expect(geoColumns({ IP: 'CANARY-NOT-AN-ADDRESS' })).toBeNull();
  });
});

describe('buildNewDataCard: cells come from the spec only', () => {
  const CANARY = 'CANARY-LEGACY-VALUE';

  it('contributes nothing from EMAIL, NICKNAME or __parsed_extra to a cell or to the view', () => {
    const view = buildNewDataCard(
      CREWS,
      input([
        {
          CREW_ID: 'c1',
          EMAIL: `${CANARY}@x.example.invalid`,
          NICKNAME: CANARY,
          __parsed_extra: CANARY,
          ACCOUNT_ID: CANARY,
        } as Row,
      ]),
    );
    const text = JSON.stringify(view);
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain('EMAIL');
    expect(text).not.toContain('NICKNAME');
    expect(text).not.toContain('__parsed_extra');
    expect(ready(view).columns).toEqual([{ id: 'CREW_ID', kind: 'text' }]);
  });

  it('serialises no key outside the view shape, no file name and no canary', () => {
    const view = buildNewDataCard(
      CREWS,
      input([{ CREW_ID: 'c1', CREW_LEVEL: '3', NICKNAME: CANARY } as Row]),
    );
    const allowedKeys = new Set([
      'status',
      'columns',
      'rows',
      'rowCount',
      'id',
      'kind',
      'account',
      'cells',
    ]);
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === 'object' && value !== null) {
        for (const [key, inner] of Object.entries(value)) {
          expect(allowedKeys.has(key), `key ${key}`).toBe(true);
          walk(inner);
        }
      }
    };
    walk(view);
    expect(JSON.stringify(view)).not.toContain('.csv');
  });

  it('a __proto__ key on a row neither reads nor writes anything', () => {
    const row = JSON.parse('{"CREW_ID":"c1","__proto__":{"CREW_SHIP":"polluted"}}') as Row;
    const view = ready(buildNewDataCard(CREWS, input([row])));
    expect(view.columns).toEqual([{ id: 'CREW_ID', kind: 'text' }]);
    expect(({} as Record<string, unknown>).CREW_SHIP).toBeUndefined();
  });
});

describe('the two view builders', () => {
  const absent: NewDataCardInput = { groups: [], seen: false, parsed: null };

  it('buildHeatView returns the four cards with a ready top level', () => {
    const inputs = {
      accountStats: absent,
      battleTypes: input([{ GAME_MODE: 'standard', BATTLES: '5' }]),
      storage: input([], { parsed: 2 }),
      geolocation: input([]),
    };
    const view = buildHeatView(inputs);
    expect(view.status).toBe('ready');
    expect(Object.keys(view.cards)).toEqual([...HEAT_CARD_IDS]);
    expect(view.cards.accountStats).toEqual({ status: 'not-in-export' });
    expect(view.cards.battleTypes.status).toBe('ready');
    expect(view.cards.storage).toEqual({ status: 'skipped' });
    expect(view.cards.geolocation).toEqual({ status: 'no-rows' });
  });

  it('buildWarshipsStorageView returns the two cards with a ready top level', () => {
    const view = buildWarshipsStorageView({
      crews: input([{ CREW_ID: 'c1' }], {}, 'B2'),
      storage: absent,
    });
    expect(view.status).toBe('ready');
    expect(Object.keys(view.cards)).toEqual([...WOWS_CARD_IDS]);
    expect(ready(view.cards.crews).rows[0]!.account).toBe('B2');
    expect(view.cards.storage).toEqual({ status: 'not-in-export' });
  });

  it('every card file key has a spec', () => {
    for (const key of [...Object.values(HEAT_CARD_FILES), ...Object.values(WOWS_CARD_FILES)]) {
      expect(
        NEW_DATA_SPEC_FILES.some((candidate) => candidate.key === key),
        key,
      ).toBe(true);
    }
  });
});

// =============================================================================
// Plan 12-06 Task 2 - the code kind of cellOf
// =============================================================================

describe('cellOf: the code kind (12-06, T-12-17)', () => {
  it('keeps a number-looking code as its trimmed string, leading zeros intact', () => {
    expect(cellOf('00012345678', 'code')).toBe('00012345678');
    expect(cellOf('  00012345678  ', 'code')).toBe('00012345678');
    // The same text under the number kind is a number: the code kind is the difference.
    expect(cellOf('12345678', 'number')).toBe(12345678);
    expect(cellOf('12345678', 'code')).toBe('12345678');
  });

  it('returns null for blank, N/A and N/D, and for a missing value', () => {
    expect(cellOf('', 'code')).toBeNull();
    expect(cellOf('   ', 'code')).toBeNull();
    expect(cellOf('N/A', 'code')).toBeNull();
    expect(cellOf('n/d', 'code')).toBeNull();
    expect(cellOf(undefined, 'code')).toBeNull();
  });

  it('clamps an over-long code to the cell bound', () => {
    const out = cellOf('Z'.repeat(5000), 'code');
    expect(typeof out).toBe('string');
    expect((out as string).length).toBeLessThanOrEqual(200);
  });
});
