/**
 * overview-shared.ts — the Overview's wire contract (13-01, D-01, D-18).
 *
 * ## What crosses the worker boundary here
 *
 * This module is used by BOTH the worker (which builds the view) and the page
 * (which renders it), so it carries NO dependency of any kind: only types and
 * runtime constants, and nothing here can pull a module into either bundle.
 * That is also why the file has no dependency statement at all — the phase-13
 * guard test reads this file and asserts that.
 *
 * ## The privacy contract (D-18, T-13-01)
 *
 * The view carries COUNTS, SECONDS, DAY NUMBERS, RATIOS, MICRO-UNIT STRINGS
 * and RESOLVED NAMES, and nothing else. There is no field that can hold an
 * order amount, chat text, a clan name, a nickname or an e-mail — not because
 * the builder is careful, but because the TYPE has nowhere to put one. A
 * future tile that wanted one would have to change this file, and that change
 * would be visible in a diff.
 *
 * ## Why the views are ARRAYS (T-13-05)
 *
 * `tiles` is an array of `{ id, ... }` objects in catalogue order, never an
 * object keyed by tile id. A keyed object would put a data-derived string in a
 * property position, where `__proto__` is a prototype and not a key. An array
 * makes that impossible by construction rather than by a filter.
 */

/**
 * The sixteen tile ids, in CATALOGUE order.
 *
 * The order is the contract: the view's `tiles` array carries exactly one
 * entry per id in this order, so a group can slice the array by index and the
 * order cannot drift between the worker and the page. The 13-UI-SPEC Tile
 * Catalogue table lists sixteen rows (its prose says seventeen); the TABLE is
 * the contract.
 */
export const OVERVIEW_TILE_IDS = [
  'logged',
  'hour',
  'streak',
  'sess',
  'busy',
  'tank',
  'cls',
  'fleet',
  'nat',
  'dmg',
  'xp',
  'kills',
  'snip',
  'cred',
  'bat',
  'ord',
] as const;

/** One tile id. */
export type OverviewTileId = (typeof OVERVIEW_TILE_IDS)[number];

/**
 * The four GROUPS of tiles.
 *
 * `Pinned` is NOT a group id: it is a derived view over whatever the user has
 * pinned, so a pinned tile keeps its own group identity underneath.
 */
export const OVERVIEW_GROUP_IDS = ['time', 'tanks', 'records', 'totals'] as const;

/** One group id. */
export type OverviewGroupId = (typeof OVERVIEW_GROUP_IDS)[number];

/**
 * The SOURCE a tile reads.
 *
 * The names are the wording the absent row uses ("Not in this export: …
 * needs session history"), so they are user-facing sentences in the tail of
 * each value.
 */
export type OverviewNeed =
  | 'session-history'
  | 'vehicle-statistics'
  | 'account-statistics'
  | 'currency-operations'
  | 'payment-history';

/**
 * Which source each tile reads.
 *
 * A complete `Record` over every tile id, so a new tile without a source is a
 * compile error rather than an absent row with no wording.
 */
export const OVERVIEW_TILE_NEEDS: Readonly<Record<OverviewTileId, OverviewNeed>> = {
  logged: 'session-history',
  hour: 'session-history',
  streak: 'session-history',
  sess: 'session-history',
  busy: 'session-history',
  tank: 'vehicle-statistics',
  cls: 'vehicle-statistics',
  fleet: 'vehicle-statistics',
  nat: 'vehicle-statistics',
  dmg: 'account-statistics',
  xp: 'account-statistics',
  kills: 'account-statistics',
  snip: 'account-statistics',
  cred: 'currency-operations',
  bat: 'account-statistics',
  ord: 'payment-history',
};

/**
 * A tank class, as the built-in tank table spells it.
 *
 * `unknown` is a real value and not a fallback marker: a tank missing from the
 * table is counted as unknown and NOT guessed (D-09), and the tile states its
 * class coverage rather than hiding the gap.
 */
export type OverviewClassKey =
  'mediumTank' | 'AT-SPG' | 'heavyTank' | 'lightTank' | 'SPG' | 'unknown';

/**
 * The small-sample guard for a PLAIN rate (a win rate, a share): 30 battles.
 *
 * Below this the rule line says "too few battles for a rate" instead of a
 * value (D-17). Counts and totals are NOT guarded.
 */
export const MIN_BATTLES_PLAIN_RATE = 30;

/**
 * The small-sample guard for a PER-TANK rate: 100 battles in that tank.
 *
 * The stricter of the two, because a per-tank rate rests on a smaller sample
 * than a dataset-wide one (D-17).
 */
export const MIN_BATTLES_TANK_RATE = 100;

/**
 * A tile whose SOURCE is missing.
 *
 * `column` names the missing record column for a COLUMN-level absence (an
 * older export revision without that column), and is null for a whole-source
 * absence. An absent tile is never a zero.
 */
export interface OverviewAbsentTile {
  id: OverviewTileId;
  status: 'absent';
  need: OverviewNeed;
  column: string | null;
}

/**
 * A tile with its figure.
 *
 * Every member carries `status: 'ok'`, so a reader narrows on `status` alone
 * and never has to ask which member it holds.
 */
export type OverviewReadyTile =
  | {
      id: 'logged';
      status: 'ok';
      /** Merged seconds across every account and every game. */
      seconds: number;
      /** The first day number with any session. */
      firstDay: number;
      /** The last day number with any session. */
      lastDay: number;
      /** Seconds in battle, or null when the export has no battle-time column. */
      battleSeconds: number | null;
      /** The active years, ascending, with the seconds of each. */
      years: { year: number; seconds: number }[];
    }
  | {
      id: 'hour';
      status: 'ok';
      /** Seconds per hour of day: exactly 24 entries, index = hour. */
      hours: number[];
      /** The hour with the most seconds, 0..23. */
      peakHour: number;
    }
  | {
      id: 'streak';
      status: 'ok';
      /** How many consecutive days the streak covers. */
      days: number;
      /** The first day of the streak. */
      startDay: number;
      /** The last day of the streak. */
      endDay: number;
    }
  | {
      id: 'sess';
      status: 'ok';
      /** The longest single session, in seconds. */
      seconds: number;
      /** The day that session started on. */
      day: number;
    }
  | {
      id: 'busy';
      status: 'ok';
      /** The most seconds on one calendar day. */
      seconds: number;
      /** The day it fell on. */
      day: number;
    }
  | {
      id: 'tank';
      status: 'ok';
      /** The tank's resolved name. */
      name: string;
      /** How many battles it has. */
      battles: number;
      /** Its share of all battles, 0..1. */
      share: number;
      /** Its class, or `unknown` when the tank is not in the table (D-09). */
      classKey: OverviewClassKey;
      /** Its tier, or null when the table does not name one. */
      tier: number | null;
      /** The most-played tanks, at most five, in descending battle order. */
      top: { name: string; classKey: OverviewClassKey; battles: number }[];
    }
  | {
      id: 'cls';
      status: 'ok';
      /** The class with the most battles. */
      classKey: Exclude<OverviewClassKey, 'unknown'>;
      /** Its share of all battles, 0..1. */
      share: number;
      /** The share of battles whose class is known, 0..1. */
      coverage: number;
      /** Every class and its battle count, descending. */
      rows: { classKey: OverviewClassKey; battles: number }[];
    }
  | {
      id: 'fleet';
      status: 'ok';
      /** How many different tanks have battles. */
      count: number;
    }
  | {
      id: 'nat';
      status: 'ok';
      /** The nation, as the raw prefix before the colon. */
      nation: string;
      /** Its share of all battles, 0..1. */
      share: number;
    }
  | {
      id: 'dmg';
      status: 'ok';
      /** The best single-battle damage. */
      value: number;
      /** The tank that battle was in, or null when the id is not recorded (D-09). */
      tankName: string | null;
      /**
       * How many accounts carried a figure for this record. A COUNT only: it is
       * the "N" of "best of N accounts", and an account folder with no
       * statistics for the record does not count (WR-04).
       */
      accounts: number;
    }
  | {
      id: 'xp';
      status: 'ok';
      /** The best single-battle XP. */
      value: number;
      /** The tank that battle was in, or null when the id is not recorded (D-09). */
      tankName: string | null;
      /**
       * How many accounts carried a figure for this record. A COUNT only: it is
       * the "N" of "best of N accounts", and an account folder with no
       * statistics for the record does not count (WR-04).
       */
      accounts: number;
    }
  | {
      id: 'kills';
      status: 'ok';
      /** The best single-battle kills. */
      value: number;
      /** The tank that battle was in, or null when the id is not recorded (D-09). */
      tankName: string | null;
      /**
       * How many accounts carried a figure for this record. A COUNT only: it is
       * the "N" of "best of N accounts", and an account folder with no
       * statistics for the record does not count (WR-04).
       */
      accounts: number;
    }
  | {
      id: 'snip';
      status: 'ok';
      /** The longest sniper series recorded. */
      value: number;
    }
  | {
      id: 'cred';
      status: 'ok';
      /** The credits earned, as a micro-unit decimal STRING — never a float. */
      units: string;
    }
  | {
      id: 'bat';
      status: 'ok';
      /** Lifetime battles. */
      battles: number;
      /** Lifetime wins, or null when the export does not record them. */
      wins: number | null;
      /** The win rate 0..1, or null when there are too few battles for a rate. */
      winRate: number | null;
    }
  | {
      id: 'ord';
      status: 'ok';
      /** How many payment orders. Count only: no amount, product or detail. */
      count: number;
    };

/** One tile: present with a figure, or absent with its source. */
export type OverviewTile = OverviewAbsentTile | OverviewReadyTile;

/**
 * One game's lifetime logged-in time.
 *
 * The game is the STORED token (the session file's own name), never a cell a
 * row carried (T-04-27).
 */
export interface OverviewLife {
  game: string;
  seconds: number;
}

/**
 * The whole Overview answer.
 *
 * `tiles` carries exactly one entry per {@link OVERVIEW_TILE_IDS} id, in that
 * order. `life` lists every game present, ascending by token. `firstDay` and
 * `lastDay` mirror the Logged in tile, and are null when there is no session
 * history at all.
 */
export interface OverviewView {
  tiles: OverviewTile[];
  life: OverviewLife[];
  firstDay: number | null;
  lastDay: number | null;
  accountCount: number;
}
