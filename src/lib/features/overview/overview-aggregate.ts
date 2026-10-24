import type { AccountRowGroup } from '../../worker/csv-columns.ts';
import type { PlaytimeAggregates } from '../../core/types/worker-messages.ts';
import { readAccountStats, type AccountStatsRead } from './overview-account-stats.ts';
import type { VehicleLookup } from './overview-lookup.ts';
import { buildRecordTiles } from './overview-records.ts';
import { buildTankTiles, sumVehicleBattleSeconds } from './overview-tanks.ts';
import { buildLife, buildTimeTiles, dayRange } from './overview-time.ts';
import { buildTotalsTiles } from './overview-totals.ts';
import {
  OVERVIEW_TILE_IDS,
  OVERVIEW_TILE_NEEDS,
  type OverviewAbsentTile,
  type OverviewTile,
  type OverviewTileId,
  type OverviewView,
} from './overview-shared.ts';

// =============================================================================
// overview-aggregate.ts — the pure builder behind the Overview's ONE answer
// =============================================================================
//
// ## What this module is
//
// A pure function over the inputs the worker already has: the playtime
// aggregate (from the meta record, read in the same transaction as the rows)
// and the four files' row groups. It computes a view and nothing else — no
// `Date`, no `Intl`, no locale, no DOM. The page formats what this produces.
//
// ## Why it is worker-only by import graph
//
// The builder is imported by `data-queries.ts`, which only the worker imports.
// Nothing on the main thread imports this module, so the main bundle never
// carries it. That is a property of the IMPORT GRAPH rather than of a lint
// rule, so it cannot be widened by accident without an import appearing.
//
// ## Why the tiles are an ARRAY and not a keyed object (T-13-05)
//
// `OVERVIEW_TILE_IDS` is mapped in order, so the array carries exactly one
// entry per id and the order cannot drift between the worker and the page. A
// keyed object would put a data-derived string in a property position, where
// `__proto__` is a prototype and not a key.
//
// ## Why the Logged in figure is `playtime.all` and nothing else (D-05)
//
// Phase 10 already merges the session intervals across every account and
// every game, so `playtime.all.seconds` IS the union. Merging them again
// here would double-count nothing and could only ever disagree with the
// Playtime pane, so this module does not merge at all. The Time group's own
// rules live in `overview-time.ts`; this module only hands them the
// aggregate and merges what they return.
//
// ## Why the tiles are COLLECTED and then laid out
//
// The wire contract is written in full (all sixteen tiles) so that later plans
// replace absent entries with real ones WITHOUT reshaping the type. An absent
// tile names the source it needs; it is never a zero.
//
// Each group of tiles is built by its own module and handed over as an array;
// this builder collects them by id and then lays the whole set out by mapping
// the catalogue. So the order is the catalogue order by construction, a group
// that contributes nothing cannot shift the others, and a later plan adds its
// own tiles the same way.
//
// ## Why the LOOKUP is an argument
//
// The tank table is worker-only (D-08): it is inlined into the worker chunk
// and the page must never pull it into the main bundle. So the lookup arrives
// as a parameter, and this module — which the worker imports — never reaches
// the table itself.
export interface OverviewFileInput {
  /** The file's rows, grouped per account. */
  groups: readonly AccountRowGroup[];
  /** Whether the file was in the export at all. */
  seen: boolean;
}

/** Everything the Overview's answer is computed from. */
export interface OverviewInputs {
  /**
   * The stored playtime aggregate, or null when the dataset holds none.
   *
   * Null is not "no sessions": the caller rebuilds a stale or absent
   * aggregate from the stored session rows before it gets here, so a null
   * aggregate reaching this builder means the export really has no session
   * history to report.
   */
  playtime: PlaytimeAggregates | null;
  /** How many account folders the dataset holds. */
  accountCount: number;
  /** The World of Tanks account statistics file. */
  accountStats: OverviewFileInput;
  /** The World of Tanks vehicle statistics file. */
  vehicleStats: OverviewFileInput;
  /** The virtual currencies operations log. */
  currency: OverviewFileInput;
  /** The payment orders file. */
  orders: OverviewFileInput;
}

/**
 * Build the Overview's view.
 *
 * The tiles are collected into a map by id and then laid out by mapping
 * {@link OVERVIEW_TILE_IDS}, so the array carries exactly one entry per id in
 * the catalogue order however many groups contributed to it. A later plan
 * adds its own tiles the same way, and the order cannot drift.
 */
export function buildOverviewView(inputs: OverviewInputs, lookup: VehicleLookup): OverviewView {
  // The account statistics are read ONCE, and every group that needs them is
  // built from that one read: the Records group and the Totals group from the
  // account statistics, the Tanks group from the vehicle statistics. The "In
  // battle" figure falls back to the vehicle rows when the account statistics
  // do not carry the column.
  const stats = readAccountStats(inputs.accountStats);
  const battleSeconds = battleSecondsOf(stats, inputs.vehicleStats);

  const built = new Map<OverviewTileId, OverviewTile>();
  for (const tile of buildTimeTiles(inputs.playtime, battleSeconds)) built.set(tile.id, tile);
  for (const tile of buildTankTiles(inputs.vehicleStats, lookup)) built.set(tile.id, tile);
  for (const tile of buildRecordTiles(stats, lookup)) built.set(tile.id, tile);
  for (const tile of buildTotalsTiles({
    stats,
    currency: inputs.currency,
    orders: inputs.orders,
  })) {
    built.set(tile.id, tile);
  }

  const tiles: OverviewTile[] = OVERVIEW_TILE_IDS.map((id) => built.get(id) ?? absentTile(id));

  const { firstDay, lastDay } = dayRange(inputs.playtime);

  return {
    tiles,
    life: buildLife(inputs.playtime),
    firstDay,
    lastDay,
    accountCount: inputs.accountCount,
  };
}

/** The absent form of one tile: the source it needs, and no column. */
function absentTile(id: (typeof OVERVIEW_TILE_IDS)[number]): OverviewAbsentTile {
  return { id, status: 'absent', need: OVERVIEW_TILE_NEEDS[id], column: null };
}

/**
 * The lifetime "In battle" figure, in seconds.
 *
 * The account statistics carry `BATTLE_LIFE_TIME` — the total across the
 * account folders — and the vehicle file carries the same quantity per tank.
 * The account figure is the one to use, and the per-vehicle sum is the
 * FALLBACK for an export that has no account statistics at all.
 *
 * A column that resolved but whose every cell says "no value" is NOT a zero:
 * the figure falls back to the vehicle rows rather than claiming the player
 * spent no time in battle (D-09).
 *
 * The account figure is also used ONLY when every account row carries it. A
 * sum over just the accounts whose header resolved would be a partial total
 * printed under the lifetime label (WR-03), so a single unreadable account
 * sends the figure to the vehicle rows, which cover every account the same
 * way. When those say nothing either, the figure is absent, not a partial one.
 */
function battleSecondsOf(stats: AccountStatsRead, vehicles: OverviewFileInput): number | null {
  if (stats.columns.battleSeconds && stats.rows.length > 0) {
    let total = 0;
    let complete = true;
    for (const row of stats.rows) {
      if (row.battleSeconds === null) {
        complete = false;
        break;
      }
      total += row.battleSeconds;
    }
    if (complete) return total;
  }
  return sumVehicleBattleSeconds(vehicles);
}
