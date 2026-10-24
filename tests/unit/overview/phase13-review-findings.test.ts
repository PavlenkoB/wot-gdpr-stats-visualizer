import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AccountStatsColumns,
  AccountStatsRead,
  AccountStatsRow,
} from '../../../src/lib/features/overview/overview-account-stats.ts';
import type { OverviewFileInput } from '../../../src/lib/features/overview/overview-aggregate.ts';
import { buildTotalsTiles } from '../../../src/lib/features/overview/overview-totals.ts';
import type { OverviewTile } from '../../../src/lib/features/overview/overview-shared.ts';

// =============================================================================
// phase13-review-findings.test.ts — the fixed findings of 13-REVIEW.md
// (WR-03, WR-05, WR-06)
//
// =============================================================================
//
// WHY THIS FILE EXISTS
//   13-REVIEW.md raised six warnings and seven info items against the Phase 13
//   implementation, and 13-REVIEW-DISPOSITION.md records every one of them as
//   OPEN. Three of them are defects in a figure the Overview prints, so a
//   faithful test can be written for each today.
//
//   The tests here assert the CORRECT behaviour. They were marked `it.fails`
//   while the defects existed, so the suite stayed green and turned red the
//   day the fixes landed. Each fix removed its marker in its own commit, and
//   every case is now an ordinary regression test.
//
// WHAT EACH CASE IS
//
//   WR-03 — The win rate is computed over MISMATCHED account subsets.
//     `battles` sums every account row whose battle count is readable;
//     `wins` sums only the rows whose wins cell is readable. Two accounts,
//     one of which does not carry a readable wins cell, therefore produce a
//     rate that belongs to neither account: the numerator comes from one
//     account and the denominator from both. The rate must be computed over
//     the rows that carry BOTH figures.
//
//   WR-05 — The credits pick matches "wot" as a SUBSTRING.
//     `ru.wotblitz.credits` contains "wot", so another game's credits currency
//     joins the World of Tanks pool and can win the pick on operation count.
//     The Overview then reports another game's credits under "Credits
//     earned". The match must be on a dot-delimited segment.
//
//   WR-06 — The generator trusts the API's `page_total`.
//     The page loop is bounded only from below, so a malformed or hostile
//     answer with a huge `page_total` makes the generator issue that many
//     authenticated requests before any validation runs. The loop must be
//     bounded by what the table can hold.
//
// THE HONEST NUMBERS
//   Every expected figure here is derived in the test from the rule the
//   requirement states, never read back from the implementation.
// =============================================================================

/** One account-statistics row, with everything the Totals group reads. */
function rowOf(partial: Partial<AccountStatsRow>): AccountStatsRow {
  return {
    account: 'test-account',
    battles: null,
    wins: null,
    battleSeconds: null,
    damageMax: null,
    xpMax: null,
    fragsMax: null,
    sniperSeries: null,
    damageMaxTank: null,
    xpMaxTank: null,
    fragsMaxTank: null,
    ...partial,
  };
}

/** One account-statistics read, with the columns it resolved. */
function statsOf(
  rows: readonly AccountStatsRow[],
  columns: Partial<AccountStatsColumns> = {},
): AccountStatsRead {
  return {
    present: true,
    rows: [...rows],
    columns: {
      battles: false,
      wins: false,
      battleSeconds: false,
      damageMax: false,
      xpMax: false,
      fragsMax: false,
      sniperSeries: false,
      ...columns,
    },
  };
}

/** One currency-operations file, built by hand. */
function currencyOf(rows: readonly Record<string, string>[]): OverviewFileInput {
  return { groups: [{ account: 'test-account', rows }], seen: true };
}

/** One currency operation row, with the columns the Finance builder reads. */
function currencyRow(
  code: string,
  amount: string,
  created: string,
  type = 'deposit',
): Record<string, string> {
  return {
    CREATED: created,
    CURRENCY_CODE: code,
    CURRENCY_TITLE: 'Credits',
    AMOUNT: amount,
    TYPE: type,
    ORDER: 'order-reference',
  };
}

/** The Totals tiles of one hand-built input. */
function totalsOf(stats: AccountStatsRead, currency: OverviewFileInput): OverviewTile[] {
  return buildTotalsTiles({
    stats,
    currency,
    orders: { groups: [], seen: false },
  });
}

/** The ready tile of an id. Throws when the tile is absent. */
function ready(tiles: readonly OverviewTile[], id: string): Record<string, unknown> {
  const tile = tiles.find((entry) => entry.id === id);
  if (tile === undefined) throw new Error(`no tile ${id}`);
  if (tile.status !== 'ok') throw new Error(`expected a ready ${id} tile`);
  return tile as unknown as Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// WR-06: the generator's page loop
// -----------------------------------------------------------------------------

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts/vehicles/build-vehicle-table.ts');

/**
 * The most pages the generator may ever ask for.
 *
 * The table can hold at most `MAX_ROWS` rows and one page holds `PAGE_LIMIT`
 * of them, so a page count past that carries no row the table could keep.
 */
const MAX_PAGES = Math.ceil(3000 / 100) + 1;

/** The marker the fetch stub prints once per request it answers. */
const REQUEST_MARKER = 'WG-REQUEST ';

let tempDir = '';

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'vehicle-table-pages-'));
});

afterAll(() => {
  if (tempDir !== '') rmSync(tempDir, { recursive: true, force: true });
});

/**
 * A fetch stub that answers EVERY request with a page claiming a million
 * pages follow, and counts the requests it answered.
 *
 * The stub is loaded into the generator with `--import`, so the generator's
 * own `fetch` call resolves to it and NO request leaves the machine. The
 * claim it makes is the hostile one: `meta.page_total` of a million, with
 * one page of real-looking rows behind it.
 *
 * The stub also collapses the generator's 150 ms pause between pages to
 * nothing, so the case runs in milliseconds rather than in the tens of
 * seconds a million paced requests would take. The pause is a rate limit,
 * not a behaviour under test: the number of REQUESTS is what matters here,
 * and the stub counts them either way.
 *
 * The stub refuses to answer more than `STUB_PAGE_LIMIT` requests, so a
 * generator that ignores `page_total` runs out of stub long before it runs
 * out of machine.
 */
const STUB_PAGE_LIMIT = 60;

function writeFetchStub(): string {
  const file = path.join(tempDir, 'fetch-stub.mjs');
  writeFileSync(
    file,
    [
      'globalThis.setTimeout = (fn) => { Promise.resolve().then(fn); return 0; };',
      'let n = 0;',
      'globalThis.fetch = async () => {',
      '  n += 1;',
      "  process.stdout.write('WG-REQUEST ' + n + '\\n');",
      `  if (n > ${STUB_PAGE_LIMIT}) throw new Error('WG-REQUEST-CAP');`,
      "  return { json: async () => ({ status: 'ok', meta: { count: 1, page_total: 1000000, total: 1000000 }, data: { '900001': { tank_id: 900001, tag: 'SynthAlpha', name: 'Synth Alpha', short_name: 'SynthAlpha', type: 'mediumTank', tier: 5, nation: 'synth' } } }) };",
      '};',
      '',
    ].join('\n'),
  );
  return file;
}

describe('WR-06: the generator bounds the pages it asks the API for', () => {
  it('a page_total of a million does not make the generator ask for a million pages', () => {
    const stub = writeFetchStub();
    const result = spawnSync(
      process.execPath,
      [
        `--import=${pathToFileURL(stub).href}`,
        BUILD_SCRIPT,
        '--out',
        path.join(tempDir, 'never-written.ts'),
      ],
      {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: { ...process.env, WG_APPLICATION_ID: 'SYNTHETIC-KEY-FOR-THE-STUB' },
        timeout: 60_000,
      },
    );

    const stdout = result.stdout ?? '';
    const requests = stdout.split(REQUEST_MARKER).length - 1;

    // The generator must not have issued an unbounded number of requests.
    expect(requests).toBeLessThanOrEqual(MAX_PAGES);
  });

  it('control: the stub itself answers as many pages as it is asked for', () => {
    // The counter in the case above is only meaningful if the stub really
    // answers every request. This case proves it does, with the same stub and
    // the same hostile answer.
    const stub = writeFetchStub();
    const result = spawnSync(
      process.execPath,
      [
        `--import=${pathToFileURL(stub).href}`,
        '-e',
        "const r = await fetch('https://example.invalid/'); process.stdout.write('WG-REQUEST ' + (await r.json()).meta.page_total + '\\n');",
      ],
      { encoding: 'utf8', cwd: REPO_ROOT, timeout: 30_000 },
    );
    expect(result.stdout ?? '').toContain('WG-REQUEST 1000000');
  });
});

describe('WR-03: the win rate is computed over the accounts that carry both figures', () => {
  // Two accounts. The first carries battles and wins. The second carries
  // battles but its wins cell is unreadable, which is exactly the per-account
  // header drift the phase is built around.
  const stats = statsOf(
    [
      rowOf({ account: 'a', battles: 600, wins: 300 }),
      rowOf({ account: 'b', battles: 400, wins: null }),
    ],
    { battles: true, wins: true },
  );

  it('the rate is 300 of the 600 battles the wins were actually won in', () => {
    const tiles = totalsOf(stats, currencyOf([]));
    const bat = ready(tiles, 'bat');

    // The lifetime COUNT is a sum over every account that carried the
    // column, and stays 1,000.
    expect(bat['battles']).toBe(1000);

    // The RATE must not mix the accounts: 300 wins out of the 600 battles
    // of the account that reported both is 50%, and 300 out of 1,000 (30%)
    // is a figure that belongs to no account.
    expect(bat['winRate']).toBe(0.5);
  });

  it('the count is still the sum over every account that carried the column', () => {
    const tiles = totalsOf(stats, currencyOf([]));
    expect(ready(tiles, 'bat')['battles']).toBe(1000);
  });

  it('control: one account carrying both figures gives its own rate', () => {
    const single = statsOf([rowOf({ account: 'a', battles: 600, wins: 300 })], {
      battles: true,
      wins: true,
    });
    const tiles = totalsOf(single, currencyOf([]));
    const bat = ready(tiles, 'bat');
    expect(bat['battles']).toBe(600);
    expect(bat['winRate']).toBe(0.5);
  });
});

describe('WR-05: the credits pick matches the World of Tanks segment, not a substring', () => {
  // The World of Tanks credits currency, one operation.
  const wot = currencyRow('ru.wot.credits', '9000000.00', '2020-03-02 09:00:00');
  // Another game's credits currency, three operations. Its code CONTAINS
  // "wot", so a substring match lets it into the World of Tanks pool.
  const blitz = [
    currencyRow('ru.wotblitz.credits', '1000000.00', '2020-03-02 10:00:00'),
    currencyRow('ru.wotblitz.credits', '1000000.00', '2020-03-03 10:00:00'),
    currencyRow('ru.wotblitz.credits', '1000000.00', '2020-03-04 10:00:00'),
  ];

  it("the tile reports the World of Tanks credits, not the other game's", () => {
    const tiles = totalsOf(
      statsOf([], { battles: false, wins: false }),
      currencyOf([wot, ...blitz]),
    );
    const cred = ready(tiles, 'cred');

    // 9,000,000 credits in micro-units (MICRO_SCALE = 6).
    expect(cred['units']).toBe('9000000000000');
  });

  it('control: the World of Tanks credits alone are that figure', () => {
    const tiles = totalsOf(statsOf([], {}), currencyOf([wot]));
    expect(ready(tiles, 'cred')['units']).toBe('9000000000000');
  });
});
