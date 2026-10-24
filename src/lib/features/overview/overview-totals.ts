/**
 * overview-totals.ts — the Totals group (13-08, D-17, D-18, D-21).
 *
 * ## What this module is
 *
 * Three tiles: Credits earned, Battles and Orders. Each is a fold over a
 * source the Overview already reads — the currency operations log, the
 * account statistics and the payment orders — and each says something
 * DIFFERENT about the player's own data.
 *
 * ## Why Credits earned is the Finance pane's own number (D-21)
 *
 * The tile calls {@link buildCurrency} — the very builder the Finance pane
 * calls — and takes the credits currency's in-flow out of its answer. So the
 * two panes cannot disagree: there is one definition of "credits earned" and
 * both read it. The figure crosses the wire as the exact micro-unit DECIMAL
 * STRING the money layer works in, never as a number: 12,000,000 credits is
 * `12000000000000` micro-units, and a float would lose the tail (T-13-24).
 *
 * A withdrawal is money that LEFT and is not in-flow, and another currency is
 * not credits at all.
 *
 * ## Why Battles guards the rate (D-17)
 *
 * The win rate is a PLAIN rate, so it needs at least
 * {@link MIN_BATTLES_PLAIN_RATE} battles. Below that the rule line says "too
 * few battles for a rate" instead of a value. The COUNTS are not guarded: a
 * player with nine battles really did fight nine battles, and a count is not
 * a rate.
 *
 * ## Why Orders is a COUNT and reads no cell (D-18)
 *
 * An order row holds an amount, a product and an id. None of them may reach
 * the Overview, so this module reads each group's `rows.length` and NOTHING
 * else — no cell, no header, no value. The tile's type has a count and
 * nothing else, so there is nowhere for an amount to hide even by accident.
 */

import { buildCurrency } from '../finance/finance-aggregate.ts';
import type { AccountStatsRead } from './overview-account-stats.ts';
import type { OverviewFileInput } from './overview-aggregate.ts';
import {
  MIN_BATTLES_PLAIN_RATE,
  OVERVIEW_TILE_NEEDS,
  type OverviewAbsentTile,
  type OverviewTile,
  type OverviewTileId,
} from './overview-shared.ts';

// -----------------------------------------------------------------------------
// The shapes
// -----------------------------------------------------------------------------

/**
 * What the Totals group is built from.
 *
 * The account statistics are read ONCE by the caller and handed over, because
 * the Records group reads them too and a second read could disagree with the
 * first.
 */
export interface OverviewTotalsInput {
  /** The account-statistics read. */
  stats: AccountStatsRead;
  /** The virtual-currency operations log. */
  currency: OverviewFileInput;
  /** The payment orders. */
  orders: OverviewFileInput;
}

/**
 * One currency's flow, as the Finance builder reports it.
 *
 * Both shapes it returns — a chart entry and a listed "other" currency — carry
 * these three fields, so the credits lookup can read either one the same way.
 */
interface CurrencyFlow {
  /** The code exactly as the export wrote it. */
  code: string | null;
  /** How many operations the currency had. */
  ops: number;
  /** The in-flow, as an exact micro-unit decimal string. */
  inUnits: string;
}

// -----------------------------------------------------------------------------
// The absent form
// -----------------------------------------------------------------------------

/**
 * One absent Totals tile: the source it needs, and the column when the
 * absence is a COLUMN-level one (D-03).
 */
function absent(id: OverviewTileId, column: string | null): OverviewAbsentTile {
  return { id, status: 'absent', need: OVERVIEW_TILE_NEEDS[id], column };
}

// -----------------------------------------------------------------------------
// The builder
// -----------------------------------------------------------------------------

/**
 * Build the three Totals tiles, in catalogue order.
 *
 * Pure: it reads the figures it is handed and returns three tiles, always in
 * the order cred, bat, ord. It never throws, whatever a cell holds.
 */
export function buildTotalsTiles(args: OverviewTotalsInput): OverviewTile[] {
  return [credTile(args.currency), batTile(args.stats), ordTile(args.orders)];
}

// -----------------------------------------------------------------------------
// Credits earned
// -----------------------------------------------------------------------------

/**
 * Credits earned: the Finance pane's own in-flow for the credits currency.
 *
 * The tile is absent when the currency log is not in the export, when the
 * log holds no usable operation, when it holds no credits currency at all,
 * and when the credits currency earned NOTHING — a currency log with only
 * withdrawals says nothing about what was earned, and a tile that reads "0"
 * is a zero, which the Overview never draws.
 */
function credTile(currency: OverviewFileInput): OverviewTile {
  const view = buildCurrency(currency.groups, currency.seen);
  if (view.status !== 'ready') return absent('cred', null);

  // The Finance builder lists a currency with a chart first and every other
  // currency below it, so the credits currency is looked for in both — a
  // small export's credits currency never earns a chart.
  const entry =
    pickCredits(view.charts as readonly CurrencyFlow[]) ??
    pickCredits(view.others as readonly CurrencyFlow[]);
  if (entry === null) return absent('cred', null);

  // The exact string, never a number: the sum is a bigint in micro-units and
  // a float would lose the tail (T-13-24).
  if (isZeroUnits(entry.inUnits)) return absent('cred', null);

  return { id: 'cred', status: 'ok', units: entry.inUnits };
}

/**
 * The credits currency of a list, or null when the list holds none.
 *
 * A code is the credits code when it IS `credits` or when its LAST
 * dot-separated segment is `credits` — the export writes `ru.wot.credits`,
 * and the older sample wrote `credits` outright. The matching is on the code
 * and never on the title, because the title is a label the export may leave
 * blank.
 *
 * When several codes match — one account folder's `ru.wot.credits` beside
 * another game's — the World of Tanks one wins, because the Totals group is
 * WoT-scoped (D-06). "World of Tanks" means a dot-delimited SEGMENT equal to
 * `wot`, never a substring: `ru.wotblitz.credits` and `ru.wotb.credits` hold
 * the letters but are other games' currencies (WR-05). Beyond that, the
 * currency with the most operations wins, and the code breaks a tie in plain
 * code-unit order. When a player holds several World of Tanks credits codes
 * (two realms, say), the dominant one is shown, not their sum: the tile is the
 * Finance pane's figure for ONE currency, and the Finance pane lists each
 * code on its own.
 */
function pickCredits(candidates: readonly CurrencyFlow[]): CurrencyFlow | null {
  const matches = candidates.filter((candidate) => isCreditsCode(candidate.code));
  if (matches.length === 0) return null;

  const wot = matches.filter((candidate) => isWotCode(candidate.code));
  const pool = wot.length > 0 ? wot : matches;

  return [...pool].sort((a, b) => b.ops - a.ops || compareCodeUnits(a.code, b.code))[0]!;
}

/**
 * Is this code the credits currency?
 *
 * The comparison is case-insensitive on the CODE alone, and it never touches
 * the currency's title: the code is the identifier the export chose, and a
 * title is a label (D-15, D-21).
 */
function isCreditsCode(code: string | null): boolean {
  if (code === null) return false;
  const lower = code.toLowerCase();
  if (lower === 'credits') return true;
  const dot = lower.lastIndexOf('.');
  return dot !== -1 && lower.slice(dot + 1) === 'credits';
}

/** Is one dot-delimited segment of this code exactly `wot`, case-insensitively? */
function isWotCode(code: string | null): boolean {
  return (code ?? '').toLowerCase().split('.').includes('wot');
}

/** Compare two currency codes in plain code-unit order, a blank code last. */
function compareCodeUnits(a: string | null, b: string | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Is this micro-unit string the figure zero?
 *
 * The units are an exact decimal string of micro-units, so "nothing earned"
 * is the string `0`. A non-numeric string is NOT zero: it is an unreadable
 * figure, and the tile reports it as it stands.
 */
function isZeroUnits(units: string): boolean {
  return units === '0';
}

// -----------------------------------------------------------------------------
// Battles
// -----------------------------------------------------------------------------

/**
 * Battles: the lifetime battle count, summed across the account folders.
 *
 * The wins are summed the same way. The win rate is the wins over the battles
 * of the accounts that carry BOTH figures — never a numerator and a denominator
 * from different accounts — and only when those battles are enough for a rate
 * to mean anything (D-17).
 */
function batTile(stats: AccountStatsRead): OverviewTile {
  // The file was not in the export at all.
  if (!stats.present) return absent('bat', null);

  // The file is there, but NO account's header carried the battle count: an
  // older export revision without it. That is a different sentence from a
  // missing file, and the tile names the column.
  if (!stats.columns.battles) return absent('bat', 'BATTLES_COUNT');

  let battles = 0;
  let readBattles = false;
  for (const row of stats.rows) {
    if (row.battles === null) continue;
    battles += row.battles;
    readBattles = true;
  }
  // Every account's cell says "no value": that is not a count of zero.
  if (!readBattles) return absent('bat', 'BATTLES_COUNT');

  // The wins are null when no account resolved the column at all, and null
  // again when every account's cell says "no value" — an unreadable figure is
  // not a count of zero. The COUNT is a sum over every account whose cell is
  // readable, the same as the battle count above.
  let wins: number | null = null;
  if (stats.columns.wins) {
    let total = 0;
    let readWins = false;
    for (const row of stats.rows) {
      if (row.wins === null) continue;
      total += row.wins;
      readWins = true;
    }
    if (readWins) wins = total;
  }

  // The RATE is computed only over the accounts that carry BOTH figures. A
  // numerator from one set of accounts over a denominator from another is a
  // figure that belongs to no account (WR-03): 300 wins of account A over the
  // 1,000 battles of A and B would read 30% where A's own rate is 50%. The
  // plain-rate guard applies to the battles the rate is over, not to the
  // all-account count.
  let rateBattles = 0;
  let rateWins = 0;
  let haveBoth = false;
  for (const row of stats.rows) {
    if (row.battles === null || row.wins === null) continue;
    rateBattles += row.battles;
    rateWins += row.wins;
    haveBoth = true;
  }
  const winRate = haveBoth && rateBattles >= MIN_BATTLES_PLAIN_RATE ? rateWins / rateBattles : null;

  return { id: 'bat', status: 'ok', battles, wins, winRate };
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------

/**
 * Orders: how many payment orders the export holds.
 *
 * A COUNT and nothing else. The function reads each group's `rows.length` and
 * no cell of any row, so an amount, a product or an order id cannot reach the
 * tile (D-18, T-13-23).
 *
 * A file that IS in the export and holds no order is a TRUE zero, not an
 * absence: the player really has no order in this export.
 */
function ordTile(orders: OverviewFileInput): OverviewTile {
  if (!orders.seen) return absent('ord', null);

  let count = 0;
  for (const group of orders.groups) count += group.rows.length;

  return { id: 'ord', status: 'ok', count };
}
