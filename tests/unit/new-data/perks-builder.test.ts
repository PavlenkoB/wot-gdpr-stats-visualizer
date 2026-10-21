import { describe, expect, it } from 'vitest';
import {
  buildMergedNewDataCard,
  buildNewDataCard,
  buildPerksView,
  type NewDataCardInput,
} from '../../../src/lib/features/new-data/new-data-aggregate.ts';
import {
  PERKS_CARD_FILES,
  PERKS_CARD_IDS,
  type NewDataCardView,
  type PerksCardId,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
import type { AccountRowGroup } from '../../../src/lib/worker/csv-columns.ts';
import { NEW_DATA_SPEC_FILES, type SpecFile } from '../../../src/lib/worker/new-data-specs.ts';

// =============================================================================
// Plan 12-10 Task 1 — the Perks builder: the Subscriptions merge, the three
// files that never merge, the cell kinds, and spec-only reads.
//
// Column ids and kinds are read from the spec table at RUN TIME, so these cases
// stay correct whatever the captured names are. Every row VALUE, every expected
// count and every expected account list is a hand-typed literal.
// =============================================================================

type Row = Record<string, string | undefined>;

function specOfFile(key: string): SpecFile {
  const found = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`no spec ${key}`);
  return found;
}

/** The cards whose file the contract names (a removed card has a null entry). */
const MAPPED_CARDS: readonly PerksCardId[] = PERKS_CARD_IDS.filter(
  (id) => PERKS_CARD_FILES[id] !== null,
);

function specOfCard(id: PerksCardId): SpecFile {
  const file = PERKS_CARD_FILES[id];
  if (file === null) throw new Error(`card ${id} names no file`);
  return specOfFile(file);
}

/** A hand-typed default value per column kind. */
const DEFAULT_BY_KIND: Readonly<Record<string, string>> = {
  text: 'T1',
  date: '2024-03-05 20:00:00.000',
  number: '7',
  address: '192.0.2.10',
  code: '00012345678',
};

/**
 * A complete row for a card: every spec column filled by kind, then overridden.
 * Keyed by the spec's own column ids, never by a typed header name.
 */
function rowOfCard(id: PerksCardId, overrides: Row = {}): Row {
  const row: Row = {};
  for (const column of specOfCard(id).columns) row[column.id] = DEFAULT_BY_KIND[column.kind];
  return { ...row, ...overrides };
}

/** A row of the card that differs from {@link rowOfCard} in exactly its first column. */
function differingRowOfCard(id: PerksCardId): Row {
  const first = specOfCard(id).columns[0]!;
  return rowOfCard(id, { [first.id]: 'DIFFERENT-VALUE' });
}

function group(account: string, rows: readonly Row[]): AccountRowGroup {
  return { account, rows };
}

function inputOf(groups: readonly AccountRowGroup[]): NewDataCardInput {
  return { groups, seen: true, parsed: null };
}

const ABSENT: NewDataCardInput = { groups: [], seen: false, parsed: null };

function perksInputs(
  overrides: Partial<Record<PerksCardId, NewDataCardInput>>,
): Record<PerksCardId, NewDataCardInput> {
  return {
    subscriptions: ABSENT,
    coupons: ABSENT,
    bonusCodes: ABSENT,
    surveys: ABSENT,
    ...overrides,
  };
}

function ready(card: NewDataCardView) {
  if (card.status !== 'ready') throw new Error(`expected ready, got ${card.status}`);
  return card;
}

const SUBS = specOfCard('subscriptions');

// ---------------------------------------------------------------------------
// The Subscriptions merge (D-10, D-11, T-12-31)
// ---------------------------------------------------------------------------

describe('Subscriptions: identical rows merge across accounts', () => {
  it('collapses an identical row of two accounts into one row naming both', () => {
    const row = rowOfCard('subscriptions');
    const built = buildMergedNewDataCard(SUBS, inputOf([group('A', [row]), group('B', [row])]));
    const card = ready(built.card);
    expect(card.rows).toHaveLength(1);
    expect(card.rowCount).toBe(1);
    expect(card.rows[0]!.account).toBe('A');
    expect(card.rows[0]!.accounts).toEqual(['A', 'B']);
    expect(built.mergedAway).toBe(1);
  });

  it('keeps two rows apart when ONE allowlisted cell differs', () => {
    const built = buildMergedNewDataCard(
      SUBS,
      inputOf([
        group('A', [rowOfCard('subscriptions')]),
        group('B', [differingRowOfCard('subscriptions')]),
      ]),
    );
    const card = ready(built.card);
    expect(card.rows).toHaveLength(2);
    expect(card.rows.map((r) => r.account)).toEqual(['A', 'B']);
    // A row with a single owner keeps the plain shape: no accounts field at all.
    for (const r of card.rows) expect('accounts' in r).toBe(false);
    expect(built.mergedAway).toBe(0);
  });

  it('merges the first occurrence only: A twice and B once gives [A,B] and [A]', () => {
    const row = rowOfCard('subscriptions');
    const built = buildMergedNewDataCard(
      SUBS,
      inputOf([group('A', [row, row]), group('B', [row])]),
    );
    const card = ready(built.card);
    expect(card.rows).toHaveLength(2);
    expect(card.rows[0]!.accounts).toEqual(['A', 'B']);
    expect(card.rows[1]!.account).toBe('A');
    expect('accounts' in card.rows[1]!).toBe(false);
    expect(built.mergedAway).toBe(1);
  });

  it('never folds a repeat inside one account into its first row', () => {
    const row = rowOfCard('subscriptions');
    const built = buildMergedNewDataCard(SUBS, inputOf([group('A', [row, row])]));
    expect(ready(built.card).rows).toHaveLength(2);
    expect(built.mergedAway).toBe(0);
  });

  it('lists three contributing accounts in first-seen order', () => {
    const row = rowOfCard('subscriptions');
    const built = buildMergedNewDataCard(
      SUBS,
      inputOf([group('A', [row]), group('B', [row]), group('C', [row])]),
    );
    const card = ready(built.card);
    expect(card.rows).toHaveLength(1);
    expect(card.rows[0]!.accounts).toEqual(['A', 'B', 'C']);
    expect(built.mergedAway).toBe(2);
  });

  it('keeps a row and its absent-cell twin apart: absence is not an empty string', () => {
    // The merge key reads the whole column list, and an absent value differs
    // from an empty one (T-12-31). Hand-typed rows: one carries '', one omits it.
    const first = SUBS.columns[0]!.id;
    const built = buildMergedNewDataCard(
      SUBS,
      inputOf([group('A', [{ [first]: '' }]), group('B', [{}])]),
    );
    expect(ready(built.card).rows).toHaveLength(2);
    expect(built.mergedAway).toBe(0);
  });

  it('merges an account root named __proto__ and keeps its tag identity', () => {
    const row = rowOfCard('subscriptions');
    const built = buildMergedNewDataCard(
      SUBS,
      inputOf([group('__proto__', [row]), group('B', [row])]),
    );
    const card = ready(built.card);
    expect(card.rows[0]!.accounts).toEqual(['__proto__', 'B']);
    expect(card.rows[0]!.account).toBe('__proto__');
    expect(built.mergedAway).toBe(1);
  });

  it('a merged row carries ONE cells array (it masks and reveals as one row)', () => {
    const row = rowOfCard('subscriptions');
    const card = ready(
      buildMergedNewDataCard(SUBS, inputOf([group('A', [row]), group('B', [row])])).card,
    );
    expect(card.rows).toHaveLength(1);
    expect(card.rows[0]!.cells).toHaveLength(card.columns.length);
  });
});

// ---------------------------------------------------------------------------
// The view: only Subscriptions merges
// ---------------------------------------------------------------------------

describe('buildPerksView: the three other cards never merge (T-12-31)', () => {
  for (const id of MAPPED_CARDS.filter((card) => card !== 'subscriptions')) {
    it(`${id}: identical rows in two accounts stay two rows, each tagged with its own account`, () => {
      const row = rowOfCard(id);
      const view = buildPerksView(
        perksInputs({ [id]: inputOf([group('A', [row]), group('B', [row])]) }),
      );
      const card = ready(view.cards[id]);
      expect(card.rows).toHaveLength(2);
      expect(card.rows.map((r) => r.account)).toEqual(['A', 'B']);
      for (const r of card.rows) expect('accounts' in r).toBe(false);
      expect(view.mergedAway).toBe(0);
    });
  }

  it('mergedAway equals the Subscriptions removal count and no other card adds to it', () => {
    const subRow = rowOfCard('subscriptions');
    const couponRow = rowOfCard('coupons');
    const view = buildPerksView(
      perksInputs({
        subscriptions: inputOf([group('A', [subRow]), group('B', [subRow])]),
        coupons: inputOf([group('A', [couponRow]), group('B', [couponRow])]),
      }),
    );
    expect(view.mergedAway).toBe(1);
    expect(ready(view.cards.subscriptions).rowCount).toBe(1);
    expect(ready(view.cards.coupons).rowCount).toBe(2);
  });

  it('keeps the fixed card order and the status ready', () => {
    const view = buildPerksView(perksInputs({}));
    expect(view.status).toBe('ready');
    expect(Object.keys(view.cards)).toEqual(['subscriptions', 'coupons', 'bonusCodes', 'surveys']);
    expect(view.mergedAway).toBe(0);
  });

  it('a card whose file entry is null answers not-in-export and the others are unchanged', () => {
    // The completeness gate may remove a card; the contract then holds a null.
    // The table is restored in `finally` so no other test sees the change.
    const files = PERKS_CARD_FILES as Record<PerksCardId, string | null>;
    const saved = files.coupons;
    const row = rowOfCard('subscriptions');
    try {
      files.coupons = null;
      const view = buildPerksView(
        perksInputs({
          subscriptions: inputOf([group('A', [row]), group('B', [row])]),
          // Even if a caller hands a removed card rows, it answers not-in-export.
          coupons: inputOf([group('A', [rowOfCard('subscriptions')])]),
        }),
      );
      expect(view.cards.coupons).toEqual({ status: 'not-in-export' });
      expect(ready(view.cards.subscriptions).rowCount).toBe(1);
      expect(view.mergedAway).toBe(1);
    } finally {
      files.coupons = saved;
    }
  });
});

// ---------------------------------------------------------------------------
// The four states are unchanged
// ---------------------------------------------------------------------------

describe('the four states are the same for the merging builder', () => {
  it('no groups and not seen is not-in-export', () => {
    expect(buildMergedNewDataCard(SUBS, ABSENT)).toEqual({
      card: { status: 'not-in-export' },
      mergedAway: 0,
    });
  });

  it('seen with parsed rows above zero and nothing stored is skipped', () => {
    expect(buildMergedNewDataCard(SUBS, { groups: [], seen: true, parsed: 3 }).card).toEqual({
      status: 'skipped',
    });
  });

  it('seen with zero or unknown parsed is no-rows', () => {
    expect(buildMergedNewDataCard(SUBS, { groups: [], seen: true, parsed: 0 }).card).toEqual({
      status: 'no-rows',
    });
    expect(buildMergedNewDataCard(SUBS, { groups: [], seen: true, parsed: null }).card).toEqual({
      status: 'no-rows',
    });
  });
});

// ---------------------------------------------------------------------------
// Cells: codes, addresses, blanks (D-13, T-12-33)
// ---------------------------------------------------------------------------

describe('Perks cells by kind', () => {
  const COUPONS = specOfCard('coupons');
  const BONUS = specOfCard('bonusCodes');
  const codeColumn = (spec: SpecFile) => spec.columns.find((column) => column.kind === 'code')!;
  const addressColumn = BONUS.columns.find((column) => column.kind === 'address')!;

  function cellOfColumn(card: NewDataCardView, columnId: string, rowIndex = 0) {
    const view = ready(card);
    const at = view.columns.findIndex((column) => column.id === columnId);
    expect(at, `column ${columnId} listed`).toBeGreaterThanOrEqual(0);
    return view.rows[rowIndex]!.cells[at];
  }

  it('keeps a digit-shaped code as a trimmed string with its leading zeros', () => {
    const column = codeColumn(COUPONS);
    const card = buildNewDataCard(
      COUPONS,
      inputOf([group('A', [rowOfCard('coupons', { [column.id]: '  00012345678 ' })])]),
    );
    expect(cellOfColumn(card, column.id)).toBe('00012345678');
  });

  it('gives the canonical address for a valid address and null for a non-address string', () => {
    const card = buildNewDataCard(
      BONUS,
      inputOf([
        group('A', [
          rowOfCard('bonusCodes', { [addressColumn.id]: '192.0.2.10' }),
          rowOfCard('bonusCodes', { [addressColumn.id]: 'not-an-address.example.invalid' }),
        ]),
      ]),
    );
    expect(cellOfColumn(card, addressColumn.id, 0)).toBe('192.0.2.10');
    // A string that is not an address can never be revealed as one (T-12-33).
    expect(cellOfColumn(card, addressColumn.id, 1)).toBeNull();
  });

  it('reads a blank and an N/A cell as null', () => {
    const column = codeColumn(BONUS);
    const card = buildNewDataCard(
      BONUS,
      inputOf([
        group('A', [
          rowOfCard('bonusCodes', { [column.id]: '   ' }),
          rowOfCard('bonusCodes', { [column.id]: 'N/A' }),
        ]),
      ]),
    );
    expect(cellOfColumn(card, column.id, 0)).toBeNull();
    expect(cellOfColumn(card, column.id, 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Spec-only reads (T-12-32)
// ---------------------------------------------------------------------------

describe('the builder reads the spec columns and nothing else (T-12-32)', () => {
  const LEGACY_KEY = 'LEGACY_RAW_COLUMN';
  const LEGACY_VALUE = 'legacy-raw-value-canary';

  for (const id of MAPPED_CARDS) {
    it(`${id}: a legacy extra key contributes no column and no cell`, () => {
      const spec = specOfCard(id);
      const legacy: Row = { ...rowOfCard(id), [LEGACY_KEY]: LEGACY_VALUE };
      const group_ = group('A', [legacy]);
      const view = buildPerksView(perksInputs({ [id]: inputOf([group_]) }));
      const card = ready(view.cards[id]);
      expect(card.columns.map((column) => column.id)).toEqual(spec.columns.map((c) => c.id));
      expect(JSON.stringify(view)).not.toContain(LEGACY_VALUE);
      expect(JSON.stringify(view)).not.toContain(LEGACY_KEY);
    });
  }

  it('lists only the spec columns some stored row carries, in spec order', () => {
    // A Subscriptions row carrying only the LAST spec column.
    const last = SUBS.columns[SUBS.columns.length - 1]!;
    const card = ready(
      buildMergedNewDataCard(SUBS, inputOf([group('A', [{ [last.id]: 'x' }])])).card,
    );
    expect(card.columns.map((column) => column.id)).toEqual([last.id]);
  });
});
