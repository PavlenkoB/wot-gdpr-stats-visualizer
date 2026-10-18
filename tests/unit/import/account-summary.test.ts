import { describe, expect, it } from 'vitest';
import type { SessionSource } from '../../../src/lib/features/playtime/playtime-aggregate.ts';
import type { AccountSummary } from '../../../src/lib/core/types/worker-messages.ts';
import type { AccountMeta, DatasetMeta } from '../../../src/lib/worker/db.ts';
import {
  accountSummariesOf,
  accountsOfMeta,
  compareAccounts,
  sortAccounts,
  summarizeSessionSources,
  toAccountSummary,
} from '../../../src/lib/worker/account-summary.ts';
import { accountRows } from '../../../src/lib/shell/identity-model.ts';
import { IDENTITY_NO_ACTIVITY } from '../../../src/lib/ui-copy.ts';

// =============================================================================
// account-summary.ts — the pure per-account summary (Phase 9, plan 09-02)
// =============================================================================
//
// This file holds NO worker globals and touches no Dexie: every function here is
// a pure answer over data the worker has already produced. That is what makes
// the D-14 / D-15 / D-16 rules testable without an archive and without a fake
// IndexedDB, and it is why the ingest worker imports this module rather than
// inlining the arithmetic in its parse loop.
//
// The rules under test, in the plan's own words:
//   - D-14 games — the game tokens of the `*_Game_Sessions.csv` files that hold
//     AT LEAST ONE ROW, upper-case, code-unit ascending. A header-only file
//     contributes no game; `Game_Active_Sessions.csv` names no game and is
//     never a source.
//   - D-15 years — min and max of the START cell of every session row whose
//     start parses, in either timestamp shape, across EVERY session source
//     (the legacy `Sessions.csv` adds years and no game). A row whose start does
//     not parse is skipped, never counted as activity.
//   - D-16 order — first activity year ascending, accounts with no activity
//     after all others, ties inside each group broken by root in PLAIN
//     code-unit order (never `localeCompare`, never numeric).
//
// The row helpers build rows in the two header shapes a real export uses:
// `STARTED_AT`/`FINISHED_AT` and the legacy `SESSION_START`/`SESSION_END`.
// =============================================================================

/** A real-shape session row: the `STARTED_AT` header of `WOT_Game_Sessions.csv`. */
function realRow(start: string, end = '01.01.2020 01:00'): Record<string, string | undefined> {
  return { STARTED_AT: start, FINISHED_AT: end };
}

/** A legacy-shape session row: the `SESSION_START` header of `Sessions.csv`. */
function legacyRow(start: string, end = '01.01.2020 01:00'): Record<string, string | undefined> {
  return { SESSION_START: start, SESSION_END: end };
}

function source(game: string | null, rows: Record<string, string | undefined>[]): SessionSource {
  return { game, rows };
}

const EMPTY: SessionSource = source('WOT', []);

describe('summarizeSessionSources — D-14 games', () => {
  it('counts a game only when its source holds at least one row, code-unit ascending', () => {
    const summary = summarizeSessionSources([
      source('WOTB', [realRow('01.06.2012 19:00')]),
      source('HEAT', [realRow('01.06.2019 19:00'), realRow('02.06.2019 19:00')]),
      // Header-only: the file was SEEN, so it counts as activity nowhere and
      // contributes no game (the NA root's `WOWS_Game_Sessions.csv`).
      source('WOWS', []),
      // A legacy source names no game at all.
      source(null, [legacyRow('03.06.2020 19:00')]),
    ]);
    expect(summary.games).toEqual(['HEAT', 'WOTB']);
  });

  it('deduplicates one game named by two files of the same account', () => {
    const summary = summarizeSessionSources([
      source('WOT', [realRow('01.06.2012 19:00')]),
      source('WOT', [realRow('02.06.2012 19:00')]),
    ]);
    expect(summary.games).toEqual(['WOT']);
  });
});

describe('summarizeSessionSources — D-15 years', () => {
  it('reads the min and max start across both timestamp shapes', () => {
    const summary = summarizeSessionSources([
      // Dotted, day-first, the real export's shape.
      source('WOT', [realRow('01.06.2012 19:00'), realRow('07.09.2021 18:00')]),
      // ISO, the alias header a mixed export also carries.
      source('WOTB', [
        { SESSION_START: '2023-04-02 15:00:00', SESSION_END: '2023-04-02 16:00:00' },
      ]),
    ]);
    expect([summary.firstYear, summary.lastYear]).toEqual([2012, 2023]);
  });

  it('skips a row whose start does not parse rather than counting it as activity', () => {
    const summary = summarizeSessionSources([
      source('WOT', [
        realRow('31.02.2020 10:00'), // impossible calendar date
        realRow('not a timestamp'),
        { STARTED_AT: '   ', FINISHED_AT: 'x' }, // blank
        realRow('14.02.2018 21:00'),
      ]),
    ]);
    expect([summary.firstYear, summary.lastYear]).toEqual([2018, 2018]);
  });

  it('lets a legacy no-game source contribute years without contributing a game', () => {
    const summary = summarizeSessionSources([source(null, [legacyRow('05.06.2018 20:00')])]);
    expect(summary.games).toEqual([]);
    expect([summary.firstYear, summary.lastYear]).toEqual([2018, 2018]);
  });

  it('contributes nothing from an empty or a header-only source', () => {
    expect(summarizeSessionSources([])).toEqual({ games: [], firstYear: null, lastYear: null });
    expect(summarizeSessionSources([EMPTY])).toEqual({
      games: [],
      firstYear: null,
      lastYear: null,
    });
  });

  it('reports both years null when no start in any source parses', () => {
    const summary = summarizeSessionSources([
      source('WOT', [realRow('nope'), realRow('13.13.2020 10:00')]),
      source('WOTB', [realRow('99.99.9999 10:00')]),
    ]);
    expect([summary.firstYear, summary.lastYear]).toEqual([null, null]);
    // The ROWS still exist, so the games list is unaffected by parse failures.
    expect(summary.games).toEqual(['WOT', 'WOTB']);
  });
});

describe('compareAccounts / sortAccounts — D-16 order', () => {
  const account = (root: string, firstYear: number | null): AccountSummary => ({
    root,
    identity: null,
    games: [],
    firstYear,
    lastYear: firstYear,
  });

  it('orders by first activity year ascending, then no-activity last', () => {
    const sorted = sortAccounts([
      account('900', 2021),
      account('300', null),
      account('100', 2012),
      account('700', 2018),
    ]);
    expect(sorted.map((a) => a.root)).toEqual(['100', '700', '900', '300']);
  });

  it('breaks a tie inside the active group by root in PLAIN code-unit order', () => {
    const sorted = sortAccounts([
      account('500000001', 2019),
      account('2000002', 2019),
      account('1000000003', 2019),
    ]);
    // Numeric order would be 2000002 < 500000001 < 1000000003; code-unit order
    // is '1…' < '2…' < '5…', so this ordering proves the comparator is not
    // numeric and not locale-aware.
    expect(sorted.map((a) => a.root)).toEqual(['1000000003', '2000002', '500000001']);
  });

  it('breaks a tie among the no-activity accounts by root, after every active one', () => {
    const sorted = sortAccounts([account('700', null), account('300', null), account('500', 2012)]);
    expect(sorted.map((a) => a.root)).toEqual(['500', '300', '700']);
  });

  it('is a total order — compareAccounts answers a stable sign for every pair', () => {
    expect(compareAccounts(account('a', 2012), account('b', 2012))).toBeLessThan(0);
    expect(compareAccounts(account('b', 2012), account('a', 2012))).toBeGreaterThan(0);
    expect(compareAccounts(account('a', 2012), account('a', 2012))).toBe(0);
    expect(compareAccounts(account('a', 2012), account('b', null))).toBeLessThan(0);
    expect(compareAccounts(account('a', null), account('b', 2012))).toBeGreaterThan(0);
    expect(compareAccounts(account('a', null), account('b', null))).toBeLessThan(0);
  });

  it('returns a new array and leaves the input untouched', () => {
    const input = [account('900', 2021), account('100', 2012)];
    const sorted = sortAccounts(input);
    expect(sorted).not.toBe(input);
    expect(input.map((a) => a.root)).toEqual(['900', '100']);
  });
});

describe('toAccountSummary — the stored account becomes its main-thread summary', () => {
  const stored: AccountMeta = {
    root: '2000002',
    categories: [{ name: 'User_Info', status: 'supported', fileCount: 1, rowCount: 1 }],
    identity: { nickname: 'Synthetic EU Captain', region: 'EU', createdAt: '2018-02-14 18:00:00' },
    files: [
      { category: 'User_Info', sourceFile: 'Account_Info.csv', rowCount: 1, account: '2000002' },
    ],
    games: ['HEAT', 'WOT', 'WOTB'],
    firstYear: 2018,
    lastYear: 2026,
  };

  it('keeps root, identity, games and years and drops categories and files', () => {
    const summary = toAccountSummary(stored);
    expect(summary).toEqual({
      root: '2000002',
      identity: stored.identity,
      games: ['HEAT', 'WOT', 'WOTB'],
      firstYear: 2018,
      lastYear: 2026,
    });
    expect(Object.keys(summary).sort()).toEqual([
      'firstYear',
      'games',
      'identity',
      'lastYear',
      'root',
    ]);
  });

  it('passes a null identity through rather than inventing one', () => {
    expect(toAccountSummary({ ...stored, identity: null }).identity).toBeNull();
  });

  // A record read back out of STORAGE, so the JSON round-trip models what a
  // cache written by another build — or a write interrupted mid-record —
  // actually hands the reader. The stored TYPE is deliberately not weakened:
  // the current writer always writes these fields.
  const partialRecord = (): AccountMeta =>
    JSON.parse(JSON.stringify({ root: '2000002', categories: [], files: [] })) as AccountMeta;

  it('projects a PARTIALLY written record to an empty games list and a null identity', () => {
    const partial = partialRecord();
    const summary = toAccountSummary(partial);

    // Total over the fields a stored record may not carry (09-09, IN-01,
    // T-09-30). An absent list must not travel on as `undefined`: the identity
    // header reads `.length` on it, and a blank dashboard is what that throws.
    expect(Array.isArray(summary.games)).toBe(true);
    expect(summary.games).toEqual([]);
    expect(summary.identity).toBeNull();
    expect(summary.root).toBe('2000002');
    // The fields the record DOES hold are still the record's own, and a missing
    // year is D-15's honest `null` rather than an absent field — `accountRows`
    // narrows on `=== null`, so `undefined` rendered as the string "undefined".
    expect(summary.firstYear).toBeNull();
    expect(summary.lastYear).toBeNull();
  });

  it('builds the id-only row from a partially written record instead of throwing', () => {
    const rows = accountRows([toAccountSummary(partialRecord())]);

    // `accountRows` reads `account.games.length` and `account.identity`. It
    // receives a PROJECTED summary, so proving the projection is total is what
    // makes those reads safe — this row is the assertion, the guard at the read
    // site would only hide the hole.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.idOnly).toBe(true);
    expect(rows[0]!.name).toBe('2000002');
    expect(rows[0]!.games).toBeNull();
    expect(rows[0]!.activity).toBe(IDENTITY_NO_ACTIVITY);
  });

  it('projects a COMPLETE record field for field, unchanged', () => {
    const summary = toAccountSummary(stored);
    expect(summary.games).toEqual(['HEAT', 'WOT', 'WOTB']);
    expect(summary.games).toBe(stored.games);
    expect(summary.identity).toBe(stored.identity);
    expect([summary.firstYear, summary.lastYear]).toEqual([2018, 2026]);
  });
});

describe('accountsOfMeta — the ONE normaliser every replay path uses', () => {
  const legacyMeta = {
    id: 'active',
    hash: 'abc',
    accountRoot: '12345',
    importedAt: '2026-10-16T00:00:00.000Z',
    categories: [{ name: 'User_Info', status: 'supported', fileCount: 1, rowCount: 1 }],
    identity: { nickname: 'Legacy', region: 'CA', createdAt: '2020-01-01 00:00:00' },
    files: [{ category: 'User_Info', sourceFile: 'Account_Info.csv', rowCount: 1 }],
  } as unknown as DatasetMeta;

  it('returns a stored list unchanged, in the order it was stored', () => {
    const stored: AccountMeta[] = [
      {
        root: 'b',
        categories: [],
        identity: null,
        files: [],
        games: ['WOT'],
        firstYear: 2020,
        lastYear: 2021,
      },
      {
        root: 'a',
        categories: [],
        identity: null,
        files: [],
        games: ['WOT'],
        firstYear: 2012,
        lastYear: 2019,
      },
    ];
    const meta = { ...legacyMeta, accounts: stored } as DatasetMeta;
    // Identity, not a copy: the stored order IS the D-16 order the import
    // computed, so a replay must not re-sort it.
    expect(accountsOfMeta(meta)).toBe(stored);
  });

  it('builds a one-entry list from the legacy fields, with no games and null years', () => {
    const list = accountsOfMeta(legacyMeta);
    expect(list).toHaveLength(1);
    expect(list[0]!.root).toBe('12345');
    expect(list[0]!.identity).toEqual(legacyMeta.identity);
    expect(list[0]!.categories).toEqual(legacyMeta.categories);
    expect(list[0]!.files).toEqual(legacyMeta.files);
    // D-22: a v1.0 cache is always ONE account, which the UI renders exactly as
    // v1.0 did with no games and no activity years, so nothing would read these
    // two fields for it. They are null, never a fabricated answer.
    expect(list[0]!.games).toEqual([]);
    expect(list[0]!.firstYear).toBeNull();
    expect(list[0]!.lastYear).toBeNull();
  });

  it('treats an empty stored list as legacy and normalises the rootless shape', () => {
    const rootless = {
      ...legacyMeta,
      accountRoot: '',
      identity: null,
      files: null,
      accounts: [],
    } as unknown as DatasetMeta;
    const list = accountsOfMeta(rootless);
    expect(list).toHaveLength(1);
    expect(list[0]!.root).toBe('');
    expect(list[0]!.identity).toBeNull();
    expect(list[0]!.files).toEqual([]);
  });
});

// =============================================================================
// accountSummariesOf — the ONE projection from stored records to the published
// list (plan 09-10, `accountCountSemantics: option-a`)
// =============================================================================
//
// The UI audit's first finding: the count described the ARCHIVE's roots while
// every pane described the DATA, so a title could read "3 accounts" beside one
// row saying "No activity recorded". Under option-a the published list carries
// only the roots that hold data, and this is the single place that decides it —
// the import's `done` payload and every replay both go through it, which is what
// makes them agree by construction rather than by three matching edits.
describe('accountSummariesOf — only the accounts that hold data are published', () => {
  const record = (root: string, hasData?: boolean): AccountMeta => ({
    root,
    categories: [],
    identity: null,
    files: [],
    games: ['WOT'],
    firstYear: 2020,
    lastYear: 2021,
    ...(hasData === undefined ? {} : { hasData }),
  });

  it('drops the records whose root stored nothing and keeps the rest in stored order', () => {
    const published = accountSummariesOf([
      record('100', true),
      record('200', false),
      record('300', true),
    ]);
    expect(published.map((a) => a.root)).toEqual(['100', '300']);
  });

  it('keeps a record whose flag says it holds data, however sparse that data is', () => {
    // D-17's case: sessions but no `User_Info`. The identity is null and the
    // years are null, and the account is STILL published — an absence of
    // identity is not an absence of data.
    const published = accountSummariesOf([
      { ...record('100', true), identity: null, games: [], firstYear: null, lastYear: null },
    ]);
    expect(published.map((a) => a.root)).toEqual(['100']);
    expect(published[0]!.identity).toBeNull();
  });

  it('treats an ABSENT flag as holds-data, so an existing cache renders as it always has', () => {
    // The back-compat rule in one assertion: a record written before the flag
    // existed must not lose an account on a reload. Nothing is dropped, and the
    // order is the stored order.
    const published = accountSummariesOf([record('100'), record('200')]);
    expect(published.map((a) => a.root)).toEqual(['100', '200']);
  });

  it('projects a list that drops everything into an EMPTY list, never a null', () => {
    // An empty published list is a shape the count layer already answers: a
    // dataset that holds one root with no data is a v1.0-shaped single account,
    // not a dashboard claiming zero.
    expect(accountSummariesOf([record('100', false)])).toEqual([]);
  });

  it('does not mutate the stored list it was handed', () => {
    const stored = [record('100', true), record('200', false)];
    accountSummariesOf(stored);
    expect(stored).toHaveLength(2);
  });
});
