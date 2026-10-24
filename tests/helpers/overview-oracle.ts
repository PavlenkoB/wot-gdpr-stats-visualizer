// =============================================================================
// The Overview answer key (phase 13, plan 13-03, Task 2).
//
// WHAT THIS IS FOR
// The Overview's every tile is a NUMBER, and a number a test asserts against
// is worth nothing if the fixture and the aggregator could be wrong in the
// same direction. This file is the answer key for the synthetic archive
// `tests/fixtures/overview-fixtures.ts` builds: every figure is written out by
// hand, with the arithmetic that produces it in the comment beside it.
//
// ORACLE INDEPENDENCE — the hard rule
// This file imports NOTHING. Not `src/`, not the fixture module, not a date
// library. Every constant below is stated, not computed from the code that
// will be checked against it, and every day number is HAND-COUNTED from the
// epoch and then cross-checked by the fixture test against `Date.UTC`, which
// is a different route to the same fact.
//
// The independence is one-directional and deliberate: the ORACLE imports
// nothing, and the FIXTURE is allowed to know about the oracle (it does not
// have to). A fixture that imported this file could not drift away from it,
// but it could also not be wrong independently — and a fixture that is wrong
// is exactly what these two files exist to catch.
//
// THE ARCHIVE THIS KEY DESCRIBES
// Two account roots (`1234567` and `2345678`), the default build with nothing
// omitted and the invented tank tags. Every value in the archive is invented.
//
//   root A  six WoT sessions in the dotted timestamp shape, one Blitz session,
//           1,200 battles and 864,000 s of battle life
//   root B  two WoT sessions in the ISO shape, one of which OVERLAPS a root A
//           session by thirty minutes; 300 battles and 259,200 s of battle life
//
// Decisions: D-04 (sums across accounts), D-05 (the session union), D-06
// (habits are WoT-only), D-09 (the tag-derived fallback), D-19 (records are a
// maximum across accounts), D-20 (habits use WoT sessions only), D-21 (credits
// are deposits plus income).
// =============================================================================

// -----------------------------------------------------------------------------
// The shapes
// -----------------------------------------------------------------------------

/** One day of merged WoT playtime, keyed by its day number. */
export interface OvDaySeconds {
  /** The day number: days since 1970-01-01. */
  readonly day: number;
  /** The merged WoT seconds attributed to that day. */
  readonly seconds: number;
}

/** One figure that reaches its maximum in one account and names a tank. */
export interface OvRecord {
  /** The maximum value. */
  readonly value: number;
  /** The tank id the record's column carries, verbatim. */
  readonly tankId: string;
  /** The tank's name WITH the synthetic table; null when the table misses it. */
  readonly nameWithTable: string | null;
  /** The tank's name WITHOUT any table; null unless the id is unusable. */
  readonly nameWithoutTable: string | null;
}

/** One tile that is absent under an omit option, and what would bring it back. */
export interface OvAbsentState {
  /** The tile ids that disappear. */
  readonly tiles: readonly string[];
  /** The source (or the column) the tile needs. */
  readonly needs: readonly string[];
  /** The logged-in seconds that still read, when the tile itself still reads. */
  readonly loggedSeconds?: number;
  /** The "in battle" seconds that still read, when the figure falls back. */
  readonly battleSeconds?: number;
  /** The columns the option drops, when it drops columns rather than a file. */
  readonly droppedColumns?: readonly string[];
}

/** The whole answer key. */
export interface OvExpected {
  readonly sessions: {
    /** Merged WoT seconds across BOTH accounts. */
    readonly wotSeconds: number;
    /** Merged seconds across BOTH accounts and BOTH games. */
    readonly allSeconds: number;
    /** The Blitz file's own merged seconds. */
    readonly wotbSeconds: number;
    /** Usable WoT sessions. */
    readonly wotSessions: number;
    /** Usable sessions of every game. */
    readonly allSessions: number;
    /** Distinct days with a WoT session. */
    readonly activeDays: number;
    /** Per-game seconds, by game token, ascending. */
    readonly life: readonly { readonly game: string; readonly seconds: number }[];
    /** Merged seconds per year, by the session's START day, for every game. */
    readonly years: readonly { readonly year: number; readonly seconds: number }[];
    /** The first day with a session. */
    readonly firstDay: number;
    /** The last day with a session. */
    readonly lastDay: number;
    /** Merged WoT seconds per start day. */
    readonly days: readonly OvDaySeconds[];
    /** The longest run of consecutive days with a session. */
    readonly streak: number;
    /** The busiest day and its merged seconds. */
    readonly busiestDay: OvDaySeconds;
    /** The longest single session, and the day it started on. */
    readonly longestSession: OvDaySeconds;
    /** Merged WoT seconds per hour of day, index 0 to 23. */
    readonly hours: readonly number[];
    /** The hour with the most merged seconds. */
    readonly peakHour: number;
    /** "In battle" seconds: the two accounts' `BATTLE_LIFE_TIME` added up. */
    readonly battleSeconds: number;
  };
  readonly stats: {
    /** The number of account roots in the archive. */
    readonly accountCount: number;
    /** Battles across both accounts. */
    readonly battles: number;
    /** Wins across both accounts. */
    readonly wins: number;
    /** Wins over battles. */
    readonly winRate: number;
    /** The number of distinct tanks with at least one battle. */
    readonly fleet: number;
    /** Battles per tank tag, summed over both roots, garage-only excluded. */
    readonly vehicleBattles: Readonly<Record<string, number>>;
    /** The most-played tank. */
    readonly mostPlayed: { readonly tag: string; readonly battles: number; readonly share: number };
    /** Battles per nation, summed over both roots. */
    readonly nationBattles: Readonly<Record<string, number>>;
    /** The share of battles per nation. */
    readonly nationShares: Readonly<Record<string, number>>;
    /** The nation with the largest share. */
    readonly favouriteNation: string;
    /** Battles per class, with the synthetic table; unknown for the rest. */
    readonly classes: Readonly<Record<string, number>>;
    /** The battles whose class the table knows. */
    readonly coverageBattles: number;
    /** The battles in total, for the coverage share. */
    readonly coverageTotal: number;
    /** The class with the largest share. */
    readonly favouriteClass: { readonly classKey: string; readonly share: number };
    /** The five most-played tanks' names, with the synthetic table. */
    readonly topNames: readonly string[];
    /** The most-played tank as the synthetic table resolves it. */
    readonly mostPlayedResolved: {
      readonly name: string;
      readonly classKey: string;
      readonly tier: number;
    };
    /** The records: the maximum across accounts, with the tank that holds it. */
    readonly records: {
      readonly damage: OvRecord;
      readonly xp: OvRecord;
      readonly kills: OvRecord;
      readonly sniperSeries: { readonly value: number };
    };
  };
  readonly money: {
    /** The credits in flow, in whole credits. */
    readonly creditsInFlow: number;
    /** The same figure in the app's micro units, as a decimal string. */
    readonly creditsInFlowMicro: string;
    /** The number of orders. */
    readonly orders: number;
  };
  /** What each omit option removes, and what the absent tiles need. */
  readonly absent: Readonly<Record<string, OvAbsentState>>;
}

// -----------------------------------------------------------------------------
// The hand-counted day numbers
// -----------------------------------------------------------------------------
//
// 2020-01-01 is day 18,262: fifty years hold 18,250 days, and twelve of those
// years were leap years (1972, 1976, ... 2016 — 2000 included, because it is
// divisible by 400). January's 31 days and February's 29 put 2020-03-01 at
// 18,322, so 2020-03-03 is 18,324 and 2020-03-10 is 18,331.
//
// 2021-01-01 is day 18,628, because 2020 was a leap year and holds 366 days.
// From there to 1 June is 31 + 28 + 31 + 30 + 31 = 151 days, so 2021-06-01 is
// 18,779 and 2021-06-05 is 18,783.
//
// The fixture test recomputes all three with `Date.UTC(...) / 86_400_000`,
// which is a completely different route to the same three numbers.
// -----------------------------------------------------------------------------

/** 2020-03-01, the first day with a session. */
const DAY_2020_03_01 = 18322;
/** 2020-03-02. */
const DAY_2020_03_02 = 18323;
/** 2020-03-03, the day the longest session started on. */
const DAY_2020_03_03 = 18324;
/** 2020-03-10, the busiest day. */
const DAY_2020_03_10 = 18331;
/** 2021-06-05, the last day with a session. */
const DAY_2021_06_05 = 18783;

/** The battles in the archive, from the two account-statistics rows. */
const BATTLES_TOTAL = 1500;

/**
 * The name the fourth tank reads under the fixture's `tanks: 'hostile'` option
 * (13-14, D-18).
 *
 * The tag is `ussr:R99_<b>bold</b>_Four`. The fallback name drops the nation
 * prefix (`ussr:`) and ONE leading index token (`R99_`) and guesses nothing
 * else, so what is left is the markup characters themselves. The page must
 * show them as visible text and create no element from them.
 */
export const OV_HOSTILE_NAME = '<b>bold</b>_Four';

// -----------------------------------------------------------------------------
// The answer key
// -----------------------------------------------------------------------------

export const OV_EXPECTED: OvExpected = {
  sessions: {
    // The six root A WoT rows are 9,000 s, 2,700 s, 15,000 s, 3,600 s,
    // 10,800 s and 3,600 s. Root B's two are 5,400 s and 3,600 s.
    //
    // Root B's first session (10 March, 20:30 to 22:00) OVERLAPS root A's
    // sixth (10 March, 20:00 to 21:00) by thirty minutes, so the two of them
    // merge into one interval of 7,200 s and the overlap's 1,800 s is counted
    // once:
    //
    //   9,000 + 2,700 + 15,000 + 3,600 + 10,800 + 7,200 + 3,600 = 51,900
    wotSeconds: 51900,

    // Every game, every account. The Blitz row (1 March, 22:00 to 23:00,
    // 3,600 s) overlaps root A's first WoT row (1 March, 20:00 to 22:30) by
    // thirty minutes, so it adds 3,600 - 1,800 = 1,800 s to the WoT union:
    //
    //   51,900 + 1,800 = 53,700
    allSeconds: 53700,

    // The Blitz file on its own: one session of one hour.
    wotbSeconds: 3600,

    // Six root A rows plus two root B rows. The merged pair is still TWO
    // sessions; a merge does not delete either of them.
    wotSessions: 8,

    // The eight WoT sessions plus the one Blitz session.
    allSessions: 9,

    // 1, 2 and 3 March, 10 March, and 5 June 2021 — five distinct start days.
    activeDays: 5,

    // The per-game strip. The parts sum to MORE than the union (51,900 +
    // 3,600 = 55,500 against 53,700), because the two games overlap for
    // 1,800 s. That is the documented shape of a per-game strip over a union.
    life: [
      { game: 'WOT', seconds: 51900 },
      { game: 'WOTB', seconds: 3600 },
    ],

    // The all-games union, bucketed by the session's START day and then by
    // year. 2020 holds every session but the 2021 one, and its 50,100 s is
    // the all-games union of that year: 10,800 (1 March, with the Blitz
    // overlap merged in) + 2,700 + 15,000 + 21,600 (10 March) = 50,100.
    years: [
      { year: 2020, seconds: 50100 },
      { year: 2021, seconds: 3600 },
    ],

    // The first session starts on 1 March 2020 and the last on 5 June 2021.
    firstDay: DAY_2020_03_01,
    lastDay: DAY_2021_06_05,

    // The merged WoT seconds per start day:
    //   1 March   9,000
    //   2 March   2,700
    //   3 March  15,000
    //  10 March  3,600 + 10,800 + 7,200 = 21,600
    //   5 June 2021  3,600
    days: [
      { day: DAY_2020_03_01, seconds: 9000 },
      { day: DAY_2020_03_02, seconds: 2700 },
      { day: DAY_2020_03_03, seconds: 15000 },
      { day: DAY_2020_03_10, seconds: 21600 },
      { day: DAY_2021_06_05, seconds: 3600 },
    ],

    // The longest run of CONSECUTIVE days with a session: 1, 2 and 3 March
    // are three days in a row. 10 March stands alone and 5 June 2021 stands
    // alone, so neither extends the run.
    streak: 3,

    // The busiest day: 10 March, with 3,600 + 10,800 + 7,200 = 21,600 s.
    busiestDay: { day: DAY_2020_03_10, seconds: 21600 },

    // The longest single session: 3 March, 19:30 to 23:40 — four hours and
    // ten minutes, 15,000 s. The merged 10 March interval is 7,200 s, so the
    // single session on 3 March is the longer one.
    longestSession: { day: DAY_2020_03_03, seconds: 15000 },

    // The merged WoT seconds per hour of day. Each interval contributes the
    // seconds it actually occupies, and an interval that ends exactly on an
    // hour contributes nothing to the next one:
    //
    //   08:00-09:00            3,600
    //   12:00-15:00         3,600 x 3
    //   18:00-19:00 (2021)     3,600
    //   19:30-20:00            1,800
    //   20:00-21:00            3,600 + 3,600 + 3,600 = 10,800
    //   21:00-22:00            3,600 + 2,700 + 3,600 + 3,600 = 13,500
    //   22:00-23:00            1,800 + 3,600 = 5,400
    //   23:00-23:40            2,400
    //
    // The sum is 51,900, the WoT total.
    hours: [
      0, 0, 0, 0, 0, 0, 0, 0, 3600, 0, 0, 0, 3600, 3600, 3600, 0, 0, 0, 3600, 1800, 10800, 13500,
      5400, 2400,
    ],

    // The hour with the most merged seconds is 21:00, with 13,500 s.
    peakHour: 21,

    // "In battle": the two accounts' `BATTLE_LIFE_TIME` added up.
    //   864,000 + 259,200 = 1,123,200 s, which is exactly thirteen days.
    battleSeconds: 1123200,
  },

  stats: {
    // Two account roots.
    accountCount: 2,

    // 1,200 (root A) + 300 (root B).
    battles: BATTLES_TOTAL,

    // 660 (root A) + 120 (root B).
    wins: 780,

    // 780 of 1,500 — exactly 0.52.
    winRate: 0.52,

    // Four tanks have at least one battle. The fifth row of the archive — the
    // garage-only vehicle — has none and is not in the fleet.
    fleet: 4,

    // Battles per tag, summed over both roots, garage-only excluded:
    //   tag one    700 + 200 = 900
    //   tag two    350 +  60 = 410
    //   tag three  150 +   0 = 150
    //   tag four     0 +  40 =  40
    // and 900 + 410 + 150 + 40 = 1,500, which is the account-statistics total.
    vehicleBattles: {
      one: 900,
      two: 410,
      three: 150,
      four: 40,
    },

    // The most-played tank: 900 of 1,500 battles, so a share of 0.6.
    mostPlayed: { tag: 'china:Ch99_SynthOne', battles: 900, share: 0.6 },

    // Battles per nation, from the tag's prefix:
    //   china   900, usa 410, germany 150, ussr 40.
    nationBattles: {
      china: 900,
      usa: 410,
      germany: 150,
      ussr: 40,
    },

    // The share of battles per nation. China is 900 / 1,500 = 0.6 and
    // Germany is 150 / 1,500 = 0.1; the other two do not terminate, so they
    // are written as the fraction they are.
    nationShares: {
      china: 900 / BATTLES_TOTAL,
      usa: 410 / BATTLES_TOTAL,
      germany: 150 / BATTLES_TOTAL,
      ussr: 40 / BATTLES_TOTAL,
    },

    // China has the largest share.
    favouriteNation: 'china',

    // Battles per class, WITH the synthetic table: the table knows the first
    // three tags and not the fourth, so the fourth is unknown.
    //   heavyTank 900, mediumTank 410, AT-SPG 150, unknown 40.
    //
    // WITHOUT any table every tank is unknown, the coverage is 0 and the
    // favourite-class tile is absent — a different world, reachable by
    // pointing the lookup at an empty table.
    classes: {
      heavyTank: 900,
      mediumTank: 410,
      'AT-SPG': 150,
      unknown: 40,
    },

    // The class is known for 900 + 410 + 150 = 1,460 of the 1,500 battles.
    coverageBattles: 1460,
    coverageTotal: BATTLES_TOTAL,

    // The favourite class is the heavy tank, with 900 of 1,500 battles — a
    // share of 0.6.
    favouriteClass: { classKey: 'heavyTank', share: 0.6 },

    // The most-played tanks' names, with the synthetic table. The first
    // three resolve; the fourth does not, so it keeps its tag-derived name
    // `SynthFour` — the nation prefix dropped and the leading index token
    // removed, with nothing guessed.
    topNames: ['Synth One', 'Synth Two', 'Synth Three', 'SynthFour'],

    // The most-played tank as the synthetic table resolves it: tank 990001,
    // `Synth One`, a heavy tank, tier 8.
    mostPlayedResolved: { name: 'Synth One', classKey: 'heavyTank', tier: 8 },

    // The records. Each is the MAXIMUM across the two accounts, and the tank
    // is the one the account HOLDING the maximum names.
    records: {
      // Root B's 6,100 beats root A's 5,200, and root B names tank 990003.
      damage: {
        value: 6100,
        tankId: '990003',
        nameWithTable: 'Synth Three',
        nameWithoutTable: null,
      },
      // Root A's 2,100 beats root B's 1,900, and root A names tank 990002.
      xp: {
        value: 2100,
        tankId: '990002',
        nameWithTable: 'Synth Two',
        nameWithoutTable: null,
      },
      // Root B's 8 frags beat root A's 7, and root B's vehicle id is `0` —
      // the export's "not recorded" spelling, which resolves to nothing in
      // either world.
      kills: {
        value: 8,
        tankId: '0',
        nameWithTable: null,
        nameWithoutTable: null,
      },
      // The series is a maximum too: root A's 9 beats root B's `\N`, which is
      // the export's own "no value" marker and not a zero.
      sniperSeries: { value: 9 },
    },
  },

  money: {
    // The credits in flow: the two deposits and the one income. The
    // withdrawal is money that LEFT and is not in-flow, and the gold row is a
    // different currency and is not credits at all.
    //   9,000,000 + 2,000,000 + 1,000,000 = 12,000,000
    creditsInFlow: 12000000,

    // The same figure in the app's micro units (six decimal places), written
    // as the decimal string the money layer works in:
    //   12,000,000 x 1,000,000 = 12,000,000,000,000
    creditsInFlowMicro: '12000000000000',

    // Two orders for root A and one for root B.
    orders: 3,
  },

  absent: {
    // No session file at all: the time group has nothing to show. The
    // "in battle" figure still reads, because it comes from the account
    // statistics.
    sessions: {
      tiles: ['logged', 'hour', 'streak', 'sess', 'busy'],
      needs: ['session-history'],
    },

    // The WoT session files are gone but the Blitz one is not: the logged-in
    // figure still reads, and it reads 3,600 s — the Blitz session alone. The
    // four habit tiles are WoT-only (D-20), so they are gone.
    'wot-sessions': {
      tiles: ['hour', 'streak', 'sess', 'busy'],
      needs: ['wot-session-history'],
      loggedSeconds: 3600,
    },

    // No account-statistics file: the four record tiles and the battles tile
    // have no column to read. The "in battle" figure FALLS BACK to the sum of
    // the per-vehicle `BATTLE_LIFE_TIME_SEC` cells, and because the fixture
    // makes that sum equal the account total, the fallback reads the same
    // 1,123,200 s.
    'account-statistics': {
      tiles: ['dmg', 'xp', 'kills', 'snip', 'bat'],
      needs: ['account-statistics'],
      battleSeconds: 1123200,
    },

    // No vehicle-statistics file: the four tank tiles have nothing to read.
    // The records and the battles figure are untouched — they come from the
    // account statistics.
    'vehicle-statistics': {
      tiles: ['tank', 'cls', 'fleet', 'nat'],
      needs: ['vehicle-statistics'],
    },

    // No currency file: the credits tile is gone.
    currency: {
      tiles: ['cred'],
      needs: ['currency'],
    },

    // No Orders file: the orders tile is gone.
    orders: {
      tiles: ['ord'],
      needs: ['orders'],
    },

    // The file is there but carries no record column. The four record tiles
    // are gone for a DIFFERENT reason than a missing file, and the Overview
    // has to tell the two apart: the file exists, so the group is present.
    // The battles tile still reads — `BATTLES_COUNT` is not a record column.
    'record-columns': {
      tiles: ['dmg', 'xp', 'kills', 'snip'],
      needs: ['DAMAGE_MAX', 'XP_MAX', 'FRAGS_MAX', 'SNIPER_SERIES_MAX'],
      droppedColumns: [
        'DAMAGE_MAX',
        'XP_MAX',
        'FRAGS_MAX',
        'MAX_DAMAGE_VEHICLE',
        'MAX_XP_VEHICLE',
        'MAX_FRAGS_VEHICLE',
        'KILLING_SERIES_MAX',
        'SNIPER_SERIES_MAX',
      ],
    },
  },
};
