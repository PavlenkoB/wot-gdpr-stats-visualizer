// =============================================================================
// overview-fixtures.test.ts — the Overview fixture and its answer key (13-03)
//
// WHAT THIS FILE PROVES
// Five things, in five groups:
//
//   1. SHAPE. The archive the fixture builds contains exactly the files the
//      default build promises, and each omit option removes EXACTLY the one
//      source it names and nothing else. An absent state the Overview has to
//      render is reachable by construction, not by a second hand-written
//      archive that could drift.
//
//   2. THE REAL WORKER. The archive imports through the actual ingest worker
//      and finishes `done` — for the default build, for every omit option and
//      for the `known` tags. A fixture that the real importer rejects is
//      worthless to the plans that will assert against it.
//
//   3. THE KEY IS SELF-CONSISTENT. The oracle's own figures agree with each
//      other: the day seconds sum to the WoT total, the hour array sums to
//      it too, the years sum to the all-games total, the vehicle totals sum
//      to the account-statistics battles, and the three HAND-COUNTED day
//      numbers equal `Date.UTC(...) / 86_400_000` — which is a completely
//      different route to the same three facts.
//
//   4. THE CANARIES ARE WHERE THEY BELONG. The chat line, the clan name and
//      the e-mail are absent from every stored row (a known-deferred category
//      stores nothing, and `LOGIN` is stripped at write time), while the order
//      amount, the finance canaries and the nickname are PRESENT at rest
//      because those categories are stored raw. That asymmetry is the reason
//      a later plan asserts their absence DOWNSTREAM rather than at rest.
//
//   5. THE FIXTURE IS INDEPENDENT. It imports nothing under `src/`, and the
//      oracle imports nothing at all — so a wrong aggregator and a wrong
//      fixture cannot agree by accident.
//
// Every expected figure lives in `tests/helpers/overview-oracle.ts`, which
// imports NOTHING and states the arithmetic beside each number.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import {
  OV_CANARIES,
  OV_CHAT_CANARY,
  OV_CLAN_CANARY,
  OV_EMAIL_CANARY,
  OV_HOSTILE_TAG,
  OV_NAME_CANARY,
  OV_ORDER_AMOUNT_CANARY,
  OV_ROOT_A,
  OV_ROOT_B,
  buildOverviewInsightExport,
  type OverviewOmit,
} from '../../fixtures/overview-fixtures.ts';
import { tagFallbackName } from '../../../src/lib/features/overview/overview-lookup.ts';
import { OV_EXPECTED, OV_HOSTILE_NAME } from '../../helpers/overview-oracle.ts';

// -----------------------------------------------------------------------------
// The file names the fixture writes
// -----------------------------------------------------------------------------

/** The three session files of the default archive. */
const SESSION_FILES: readonly string[] = [
  `${OV_ROOT_A}/Activity_history/WOT_Game_Sessions.csv`,
  `${OV_ROOT_A}/Activity_history/WOTB_Game_Sessions.csv`,
  `${OV_ROOT_B}/Activity_history/WOT_Game_Sessions.csv`,
];

/** The two World of Tanks session files. */
const WOT_SESSION_FILES: readonly string[] = [
  `${OV_ROOT_A}/Activity_history/WOT_Game_Sessions.csv`,
  `${OV_ROOT_B}/Activity_history/WOT_Game_Sessions.csv`,
];

/** The two account-statistics files. */
const ACCOUNT_STATS_FILES: readonly string[] = [
  `${OV_ROOT_A}/Player_statistics/WOT_Account_Statistics.csv`,
  `${OV_ROOT_B}/Player_statistics/WOT_Account_Statistics.csv`,
];

/** The two vehicle-statistics files. */
const VEHICLE_STATS_FILES: readonly string[] = [
  `${OV_ROOT_A}/Player_statistics/WOT_Vehicle_Statistics.csv`,
  `${OV_ROOT_B}/Player_statistics/WOT_Vehicle_Statistics.csv`,
];

/** The two currency-operations files. */
const CURRENCY_FILES: readonly string[] = [
  `${OV_ROOT_A}/Financial_data/Virtual_Currencies_Operations.csv`,
  `${OV_ROOT_B}/Financial_data/Virtual_Currencies_Operations.csv`,
];

/** The two Orders files. */
const ORDER_FILES: readonly string[] = [
  `${OV_ROOT_A}/Payment_history/Orders.csv`,
  `${OV_ROOT_B}/Payment_history/Orders.csv`,
];

/**
 * What each omit option removes, and what it must leave alone.
 *
 * `record-columns` removes NO FILE: the account-statistics file stays and its
 * header shrinks. That is why it is a different kind of absence, and why the
 * Overview has to tell a missing file from a missing column apart.
 */
const OMIT_REMOVES: readonly { omit: OverviewOmit; removed: readonly string[] }[] = [
  { omit: 'sessions', removed: SESSION_FILES },
  { omit: 'wot-sessions', removed: WOT_SESSION_FILES },
  { omit: 'account-statistics', removed: ACCOUNT_STATS_FILES },
  { omit: 'vehicle-statistics', removed: VEHICLE_STATS_FILES },
  { omit: 'currency', removed: CURRENCY_FILES },
  { omit: 'orders', removed: ORDER_FILES },
  { omit: 'record-columns', removed: [] },
];

/** The entry names of an archive, sorted. */
function entryNames(bytes: Uint8Array): string[] {
  return Object.keys(unzipSync(bytes)).sort();
}

/** One entry's text. */
function entryText(bytes: Uint8Array, name: string): string {
  const files = unzipSync(bytes);
  const raw = files[name];
  if (raw === undefined) throw new Error(`the archive has no entry ${name}`);
  return strFromU8(raw);
}

// -----------------------------------------------------------------------------
// The worker harness
// -----------------------------------------------------------------------------

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/**
 * Ingest one archive and assert the terminal reply was `done`.
 *
 * The spy is cleared first, because `waitForTerminal` scans the WHOLE call
 * history: a second import in one test would otherwise answer with the first
 * import's `done`.
 */
async function ingestDone(bytes: Uint8Array, name: string): Promise<void> {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
}

/** Everything the worker persisted, as one searchable string. */
async function dumpEverything(): Promise<string> {
  const { db } = await importWorkerDb();
  const [rows, meta] = await Promise.all([db.rows.toArray(), db.meta.get('active')]);
  return JSON.stringify({ rows, meta });
}

// =============================================================================
// 1. The archive's shape
// =============================================================================

describe('the Overview fixture archive', () => {
  it('holds both roots and every source the default build promises', () => {
    const names = entryNames(buildOverviewInsightExport());

    expect(names).toContain(`${OV_ROOT_A}/User_info/Account_Info.csv`);
    expect(names).toContain(`${OV_ROOT_B}/User_info/Account_Info.csv`);
    for (const file of [
      ...SESSION_FILES,
      ...ACCOUNT_STATS_FILES,
      ...VEHICLE_STATS_FILES,
      ...CURRENCY_FILES,
      ...ORDER_FILES,
    ]) {
      expect(names, `the default archive holds ${file}`).toContain(file);
    }
    // The known-deferred folders are present too: they are counted, never
    // stored, and their canaries are what a later plan asserts absent.
    expect(names).toContain(`${OV_ROOT_A}/Chat_history/Messages.csv`);
    expect(names).toContain(`${OV_ROOT_A}/Clans/Clan_membership.csv`);
  });

  it('removes exactly the one source each omit option names', () => {
    const defaultNames = entryNames(buildOverviewInsightExport());

    for (const { omit, removed } of OMIT_REMOVES) {
      const names = entryNames(buildOverviewInsightExport({ omit: [omit] }));
      const gone = defaultNames.filter((name) => !names.includes(name));
      const added = names.filter((name) => !defaultNames.includes(name));

      expect([...gone].sort(), `omit ${omit} removes`).toEqual([...removed].sort());
      expect(added, `omit ${omit} adds nothing`).toEqual([]);
    }
  });

  it('keeps the account-statistics file but drops its record columns', () => {
    const bytes = buildOverviewInsightExport({ omit: ['record-columns'] });
    const header = entryText(bytes, `${OV_ROOT_A}/Player_statistics/WOT_Account_Statistics.csv`)
      .split('\r')[0]!
      .split(';');

    expect(header).toEqual(['NAME', 'BATTLES_COUNT', 'WINS_COUNT', 'BATTLE_LIFE_TIME']);
    for (const column of OV_EXPECTED.absent['record-columns']!.droppedColumns ?? []) {
      expect(header, `the reduced header drops ${column}`).not.toContain(column);
    }
  });

  it('keeps every source when several options are combined', () => {
    const names = entryNames(
      buildOverviewInsightExport({ omit: ['currency', 'orders', 'vehicle-statistics'] }),
    );
    expect(names).not.toContain(`${OV_ROOT_A}/Financial_data/Virtual_Currencies_Operations.csv`);
    expect(names).not.toContain(`${OV_ROOT_B}/Payment_history/Orders.csv`);
    expect(names).not.toContain(`${OV_ROOT_A}/Player_statistics/WOT_Vehicle_Statistics.csv`);
    expect(names).toContain(`${OV_ROOT_A}/Activity_history/WOT_Game_Sessions.csv`);
  });
});

// =============================================================================
// 2. The real worker accepts the archive
// =============================================================================

describe('the Overview fixture through the real worker', () => {
  it('imports the default archive and finishes done', async () => {
    await ingestDone(buildOverviewInsightExport(), 'overview-default.zip');
  });

  for (const { omit } of OMIT_REMOVES) {
    it(`imports the archive with ${omit} omitted and finishes done`, async () => {
      await ingestDone(buildOverviewInsightExport({ omit: [omit] }), `overview-${omit}.zip`);
    });
  }

  it('imports the archive with the known tank tags and finishes done', async () => {
    await ingestDone(buildOverviewInsightExport({ tanks: 'known' }), 'overview-known.zip');
  });

  it('imports the archive with the hostile tank name and finishes done', async () => {
    await ingestDone(buildOverviewInsightExport({ tanks: 'hostile' }), 'overview-hostile.zip');
  });

  it('writes the hostile tag into the fourth slot only, and the oracle names what it reads as', () => {
    const files = unzipSync(buildOverviewInsightExport({ tanks: 'hostile' }));
    const vehicleText = VEHICLE_STATS_FILES.map((name) => strFromU8(files[name])).join('\n');
    expect(vehicleText).toContain(OV_HOSTILE_TAG);
    expect(vehicleText).not.toContain('SynthFour');
    expect(vehicleText).toContain('SynthOne');
    // The expected display name is what the application's own rule computes.
    expect(tagFallbackName(OV_HOSTILE_TAG)).toBe(OV_HOSTILE_NAME);
  });
});

// =============================================================================
// 3. The answer key is self-consistent
// =============================================================================

describe('the Overview answer key', () => {
  it('sums its own day seconds, hours and years to its own totals', () => {
    const { sessions } = OV_EXPECTED;

    const daySum = sessions.days.reduce((total, day) => total + day.seconds, 0);
    expect(daySum).toBe(sessions.wotSeconds);

    const hourSum = sessions.hours.reduce((total, seconds) => total + seconds, 0);
    expect(hourSum).toBe(sessions.wotSeconds);
    expect(sessions.hours).toHaveLength(24);

    const yearSum = sessions.years.reduce((total, year) => total + year.seconds, 0);
    expect(yearSum).toBe(sessions.allSeconds);
  });

  it('states the figures the plan names', () => {
    expect(OV_EXPECTED.sessions.wotSeconds).toBe(51900);
    expect(OV_EXPECTED.sessions.allSeconds).toBe(53700);
    expect(OV_EXPECTED.sessions.battleSeconds).toBe(1123200);
    expect(OV_EXPECTED.money.creditsInFlowMicro).toBe('12000000000000');
    expect(OV_EXPECTED.stats.battles).toBe(1500);
    expect(OV_EXPECTED.stats.wins).toBe(780);
    expect(OV_EXPECTED.money.orders).toBe(3);
  });

  it('makes the vehicle totals equal the account-statistics battles', () => {
    const { stats } = OV_EXPECTED;
    const vehicleSum = Object.values(stats.vehicleBattles).reduce((a, b) => a + b, 0);
    const nationSum = Object.values(stats.nationBattles).reduce((a, b) => a + b, 0);
    const classSum = Object.values(stats.classes).reduce((a, b) => a + b, 0);

    expect(vehicleSum).toBe(stats.battles);
    expect(nationSum).toBe(stats.battles);
    expect(classSum).toBe(stats.battles);
    expect(stats.coverageTotal).toBe(stats.battles);
    expect(stats.coverageBattles).toBe(1460);
    expect(stats.winRate).toBe(stats.wins / stats.battles);
  });

  it('agrees with `Date.UTC` about the three hand-counted day numbers', () => {
    const day = (year: number, month: number, date: number): number =>
      Date.UTC(year, month - 1, date) / 86_400_000;

    expect(OV_EXPECTED.sessions.firstDay).toBe(day(2020, 3, 1));
    expect(OV_EXPECTED.sessions.days[2]!.day).toBe(day(2020, 3, 3));
    expect(OV_EXPECTED.sessions.busiestDay.day).toBe(day(2020, 3, 10));
    expect(OV_EXPECTED.sessions.lastDay).toBe(day(2021, 6, 5));
  });

  it('agrees with itself about the streak, the peak hour and the busiest day', () => {
    const { sessions } = OV_EXPECTED;

    // The peak hour is the largest entry of the hour array, and the busiest
    // day is the largest entry of the day list.
    const peak = sessions.hours.indexOf(Math.max(...sessions.hours));
    expect(peak).toBe(sessions.peakHour);
    const busiest = sessions.days.reduce((a, b) => (b.seconds > a.seconds ? b : a));
    expect(busiest.day).toBe(sessions.busiestDay.day);
    expect(busiest.seconds).toBe(sessions.busiestDay.seconds);

    // The longest streak is the longest run of consecutive day numbers.
    let longest = 1;
    let run = 1;
    for (let i = 1; i < sessions.days.length; i++) {
      run = sessions.days[i]!.day === sessions.days[i - 1]!.day + 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    expect(longest).toBe(sessions.streak);
  });

  it('names an absent tile set for every omit option', () => {
    for (const { omit } of OMIT_REMOVES) {
      const state = OV_EXPECTED.absent[omit];
      expect(state, `the answer key covers omit ${omit}`).toBeDefined();
      expect(state!.tiles.length, `omit ${omit} names at least one tile`).toBeGreaterThan(0);
      expect(state!.needs.length, `omit ${omit} names what it needs`).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// 4. The canaries are where they belong
// =============================================================================

describe('the Overview fixture at rest', () => {
  it('stores no chat line, no clan name and no e-mail', async () => {
    await ingestDone(buildOverviewInsightExport(), 'overview-at-rest.zip');
    const dump = await dumpEverything();

    expect(dump).not.toContain(OV_CHAT_CANARY);
    expect(dump).not.toContain(OV_CLAN_CANARY);
    expect(dump).not.toContain(OV_EMAIL_CANARY);
  });

  it('stores the order amount, the finance canaries and the nickname raw', async () => {
    await ingestDone(buildOverviewInsightExport(), 'overview-at-rest-raw.zip');
    const dump = await dumpEverything();

    // These categories are STORED RAW, which is exactly why a later plan
    // asserts their absence downstream — in a worker reply, in a view, in the
    // DOM — and not at rest.
    expect(dump).toContain(OV_ORDER_AMOUNT_CANARY);
    expect(dump).toContain(OV_NAME_CANARY);
    for (const canary of OV_CANARIES) {
      if (canary === OV_CHAT_CANARY || canary === OV_CLAN_CANARY || canary === OV_EMAIL_CANARY) {
        continue;
      }
      expect(dump, `the stored rows carry ${canary}`).toContain(canary);
    }
  });
});

// =============================================================================
// 5. The fixture and the key are independent of the code under test
// =============================================================================

describe('the Overview fixture and key are independent', () => {
  it('the fixture imports nothing under src/', () => {
    const source = readFileSync(
      new URL('../../fixtures/overview-fixtures.ts', import.meta.url),
      'utf8',
    );
    const specifiers = [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    const dynamic = [...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
      (m) => m[1]!,
    );

    for (const specifier of [...specifiers, ...dynamic]) {
      expect(specifier, 'the fixture reaches into src/').not.toMatch(/(^|\/)src\//);
    }
  });

  it('the answer key imports nothing at all', () => {
    const source = readFileSync(
      new URL('../../helpers/overview-oracle.ts', import.meta.url),
      'utf8',
    );
    const importLines = source
      .split('\n')
      .filter((line) => line.trimStart().startsWith('import'))
      .map((line) => line.trim());

    expect(importLines).toEqual([]);
    expect(source).not.toMatch(/\bfrom\s*['"]/);
  });
});
