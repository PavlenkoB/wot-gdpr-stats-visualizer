import { buildDeviceInfo } from '../features/device-info/device-info-aggregate.ts';
import {
  DEVICE_FILE_KEYS,
  DEVICE_INFO_CATEGORY,
  DEVICE_SOURCES,
} from '../features/device-info/device-info-shared.ts';
import { buildCurrency, buildPremium, buildSpend } from '../features/finance/finance-aggregate.ts';
import {
  buildVehicleView,
  VEHICLE_FILE_NAMES,
  type VehicleFileFacts,
  type VehicleFiles,
} from '../features/vehicles/vehicle-aggregate.ts';
import type { DataQuery, DataResult } from '../core/types/worker-messages.ts';
import type { AccountRowGroup } from './csv-columns.ts';
import type { RowsSnapshot } from './db.ts';
import { MAX_BATTLE_TYPE_LENGTH, VEHICLE_TITLES } from '../features/vehicles/vehicle-shared.ts';

// =============================================================================
// data-queries.ts — the five channels, answered from ONE Dexie snapshot (05-07)
// =============================================================================
//
// The pure builders from 05-04 (vehicle) and 05-05 (finance) already know how
// to turn parsed rows into a view. This module owns everything AROUND them and
// nothing they own: which files a channel needs, whether a file was present,
// and which builder the request selects.
//
// ## Why the file table lives here and not in db.ts
//
// `db.ts` is the persistence layer and must not know what a dashboard block
// wants. The five channels' file names are product knowledge — the same
// knowledge the builders hold — so naming them here keeps the reader generic
// ("these names, these categories") and leaves one place where a new title's
// file has to be declared. `VEHICLE_FILE_NAMES` is imported from the builder
// rather than re-spelled, so the table the reader screens on and the map the
// builder resolves through cannot drift apart.
//
// ## Why presence is a first-class input
//
// `buildPremium(rows, seen)` takes `seen` SEPARATELY from `rows.length`, and
// the difference is a user-visible sentence (D-02, D-05): a file that was never
// in the archive is "not in this export", a file that was in it and parsed to
// no data rows is "no rows". The rows table cannot tell them apart, because the
// second leaves no row behind. That is why the presence facts are recorded at
// import (see `meta.files`) and resolved here.
//
// The legacy case is asymmetric ON PURPOSE: a cache written before this plan has
// no list, and "no rows" is the one sentence true of both cases, so a legacy
// cache says that rather than the absence claim it cannot support.
// =============================================================================

/** The lower-cased category each channel's files live in. */
const CATEGORY_PLAYER_STATS = 'player_statistics';
const CATEGORY_FINANCIAL = 'financial_data';
const CATEGORY_PAYMENT = 'payment_history';

const PREMIUM_FILE = 'operations_with_premium_days.csv';
const CURRENCY_FILE = 'virtual_currencies_operations.csv';
const ORDERS_FILE = 'orders.csv';

/** What one channel needs from the reader. */
export interface ChannelFiles {
  /** Lower-cased exact file names this channel reads. */
  names: ReadonlySet<string>;
  /** Lower-cased category names whose rows the channel accepts. */
  categories: readonly string[];
}

/**
 * The per-channel file table, keyed by channel.
 *
 * The three finance channels each need exactly one file, so their table entry is
 * a single name; the vehicles channel needs the builder's own sixteen-name set,
 * and the device-info channel (261012-bog) needs the three Device_info files.
 *
 * The key type EXCLUDES `logins` (06-01): that channel reads no file at all —
 * it is answered from the aggregate stored on the meta record, with a rebuild
 * from the stored session rows when that aggregate is absent or stale. Naming
 * it here would hand the worker's `DATA_FILES[query.channel]` lookup a
 * fabricated, empty file table and read rows for a question that never needed
 * them. The `logins` branch in `ingest.worker.ts` runs BEFORE that lookup, which
 * is the whole reason the exclusion is safe.
 */
export const DATA_FILES: Readonly<Record<Exclude<DataQuery['channel'], 'logins'>, ChannelFiles>> = {
  premium: {
    names: new Set([PREMIUM_FILE]),
    categories: [CATEGORY_FINANCIAL],
  },
  currency: {
    names: new Set([CURRENCY_FILE]),
    categories: [CATEGORY_FINANCIAL],
  },
  // `buildSpend` has no `seen` parameter and no `not-in-export` shape: a
  // missing Orders file is simply no usable rows (finance-shared.ts).
  spend: {
    names: new Set([ORDERS_FILE]),
    categories: [CATEGORY_PAYMENT],
  },
  vehicles: {
    names: VEHICLE_FILE_NAMES,
    categories: [CATEGORY_PLAYER_STATS],
  },
  // 261012-bog. The three lower-cased file names come from the shared contract
  // so the table the reader screens on and the names the builder is fed cannot
  // drift apart.
  'device-info': {
    names: new Set(DEVICE_SOURCES.map((source) => DEVICE_FILE_KEYS[source])),
    categories: [DEVICE_INFO_CATEGORY],
  },
};

/**
 * Was `name` in the export, and did it hold data rows?
 *
 * Three inputs, and the ORDER is the whole rule:
 *   1. A legacy cache (`files === null`) answers TRUE for every file the
 *      channel asked for. It cannot support the absence claim, and the sentence
 *      it falls back to is the one true of both cases.
 *   2. The presence list decides, matched on the lower-cased file name AND a
 *      category the channel accepts — a same-named file of another category is
 *      not this channel's file.
 *   3. Rows settle it last, so a file whose rows survived a truncated presence
 *      list still answers present.
 */
function isPresent(snapshot: RowsSnapshot, name: string, categories: readonly string[]): boolean {
  if (snapshot.files === null) return true;
  const wanted = new Set(categories.map((c) => c.toLowerCase()));
  const listed = snapshot.files.some(
    (file) => file.sourceFile.toLowerCase() === name && wanted.has(file.category.toLowerCase()),
  );
  if (listed) return true;
  // A file can be absent from a CAPPED presence list and still have rows. The
  // count is the sum over every account's group, because the bucket is grouped
  // per account rather than being one flat row list.
  return rowCountOf(snapshot.rows.get(name)) > 0;
}

/** How many rows a grouped file holds, summed over its accounts. */
function rowCountOf(groups: readonly AccountRowGroup[] | undefined): number {
  if (groups === undefined) return 0;
  let total = 0;
  for (const group of groups) total += group.rows.length;
  return total;
}

/**
 * ONE account's rows of one channel file — the unit every builder resolves
 * within, and the only way a builder reaches a row.
 *
 * This module is the SINGLE seam between the reader and the five builders (CR-01):
 * no builder may reach `snapshot.rows` itself, because the grouping is what stops
 * one account's column keys standing in for another's. A builder handed a group
 * resolves that group's columns from that group's own first row.
 */
function groupsOf(snapshot: RowsSnapshot, name: string): readonly AccountRowGroup[] {
  return snapshot.rows.get(name) ?? [];
}

/**
 * Build the file map the vehicle builder resolves through.
 *
 * EVERY name in the set gets an entry, including the ones the export did not
 * have: `factsOf` in the builder reads a missing key as `{ rows: [], seen:
 * false }`, so an explicit unseen entry and an absent one agree — but stating
 * all sixteen keeps the map's shape independent of what this export happened to
 * contain, which is what makes a title state reproducible.
 */
function vehicleFilesOf(snapshot: RowsSnapshot): VehicleFiles {
  const categories = DATA_FILES.vehicles.categories;
  const files = new Map<string, VehicleFileFacts>();
  for (const name of VEHICLE_FILE_NAMES) {
    files.set(name, {
      groups: groupsOf(snapshot, name),
      seen: isPresent(snapshot, name, categories),
    });
  }
  return files;
}

/**
 * Every channel the validator accepts, as the set it tests membership against.
 *
 * Built as the file table's keys PLUS the one channel that reads no file.
 * Deriving it from `Object.keys(DATA_FILES)` alone would reject a perfectly
 * well-formed `logins` query, because that channel is deliberately absent from
 * that table (see {@link DATA_FILES}).
 */
const DATA_CHANNELS: ReadonlySet<string> = new Set([...Object.keys(DATA_FILES), 'logins']);

/** The four title ids, as the set the validator tests membership against. */
const VEHICLE_TITLE_IDS: ReadonlySet<string> = new Set(VEHICLE_TITLES);

/**
 * Is this message a well-formed `DataQuery`?
 *
 * A strict, PURE predicate: it answers a boolean and never throws, whatever it
 * is handed. `postMessage` is a trust boundary (the threat register's "main
 * thread to worker"), and the types above describe what the page SENDS, not
 * what can arrive. A predicate that could throw would turn a malformed message
 * into an unhandled rejection inside the worker rather than an answer the block
 * can render.
 *
 * Every shape is rejected rather than coerced: an unknown channel, a title
 * outside the four ids, a non-string battleType, a battleType over the bound,
 * and every non-object. Coercing any of them would be a guess about intent made
 * on the user's behalf, and a rejection is answered with a FIXED detail — so a
 * wrong question produces a visible error, never a plausible wrong answer.
 *
 * The three finance channels take no further fields, and a `title` smuggled
 * into one is REJECTED rather than ignored: silently dropping a field this code
 * does not understand is how a future field starts being trusted by accident.
 *
 * The `logins` channel (06-01) is the fourth field-less channel and rides the
 * same rule unchanged: a bare `{ channel: 'logins' }` is a well-formed query,
 * and the same query plus a `title` is rejected. The `device-info` channel
 * (261012-bog) is the fifth and rides it too.
 */
export function isDataQuery(x: unknown): x is DataQuery {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const query = x as { channel?: unknown; title?: unknown; battleType?: unknown };
  if (typeof query.channel !== 'string' || !DATA_CHANNELS.has(query.channel)) return false;

  if (query.channel !== 'vehicles') {
    return !('title' in query) && !('battleType' in query);
  }

  // A title is either the default (null) or one of the four ids, and a
  // battleType is either All-battles (null) or a string no longer than a stored
  // code may be, which bounds what a hostile message can make the worker echo
  // into a view (T-05-18).
  const titleOk = query.title === null || VEHICLE_TITLE_IDS.has(query.title as string);
  const battleTypeOk =
    query.battleType === null ||
    (typeof query.battleType === 'string' && query.battleType.length <= MAX_BATTLE_TYPE_LENGTH);
  return titleOk && battleTypeOk;
}

/**
 * Answer one query from one snapshot.
 *
 * EXHAUSTIVE over the five channels that read files, deliberately: a channel
 * that somehow reached here would fall to the default and throw, and the
 * caller's catch turns that into a `data-error` for that block. That is the
 * right shape for a bug — a block shows an error, the import is untouched, and
 * nothing is served that no builder vouched for.
 *
 * `logins` reaches that default and is CORRECT to do so (06-01): it is answered
 * from the meta record by the worker's own branch, before the snapshot is ever
 * read, because it needs no rows when the stored aggregate is current. Throwing
 * here means "this function has no answer for that channel", which is exactly
 * the truth for a channel whose answer is not a function of the snapshot.
 */
export function answerDataQuery(query: DataQuery, snapshot: RowsSnapshot): DataResult {
  switch (query.channel) {
    case 'premium': {
      const name = PREMIUM_FILE;
      return {
        channel: 'premium',
        view: buildPremium(
          groupsOf(snapshot, name),
          isPresent(snapshot, name, DATA_FILES.premium.categories),
        ),
      };
    }
    case 'currency': {
      const name = CURRENCY_FILE;
      return {
        channel: 'currency',
        view: buildCurrency(
          groupsOf(snapshot, name),
          isPresent(snapshot, name, DATA_FILES.currency.categories),
        ),
      };
    }
    case 'spend':
      return { channel: 'spend', view: buildSpend(groupsOf(snapshot, ORDERS_FILE)) };
    case 'vehicles':
      return {
        channel: 'vehicles',
        view: buildVehicleView(vehicleFilesOf(snapshot), {
          title: query.title,
          battleType: query.battleType,
        }),
      };
    case 'device-info': {
      // Each source is fed its rows and its presence fact, so a file that was
      // never in the archive is told from one that held no rows. The legacy
      // asymmetry of `isPresent` applies unchanged. The builder re-applies the
      // Assistant extractor to a legacy row that still holds the raw POST
      // cell, so the blob is not exposed on that path either (PD-03).
      const categories = DATA_FILES['device-info'].categories;
      const source = (id: (typeof DEVICE_SOURCES)[number]) => ({
        groups: groupsOf(snapshot, DEVICE_FILE_KEYS[id]),
        seen: isPresent(snapshot, DEVICE_FILE_KEYS[id], categories),
      });
      return {
        channel: 'device-info',
        view: buildDeviceInfo({
          pc: source('pc'),
          blitz: source('blitz'),
          assistant: source('assistant'),
        }),
      };
    }
    default:
      throw new Error('unreachable channel');
  }
}

// =============================================================================
// The memo
// =============================================================================

/**
 * How many answers the memo may hold.
 *
 * A bound, not a cache policy: a flood of distinct queries (a user dragging a
 * battle-type control produces one per code) must not be able to grow the
 * worker's memory without limit (T-05-21). Sixteen covers the four channels
 * with room for a few selections each, which is the whole working set.
 */
export const MAX_MEMO_ENTRIES = 16;

/** One remembered answer, with the dataset it was computed from. */
interface MemoEntry {
  readonly importedAt: string;
  readonly result: DataResult;
}

/**
 * The memo, keyed by the channel plus the query's canonical JSON.
 *
 * ## Why the key includes the query
 *
 * The vehicles channel answers a different view per title and per battle type,
 * so a key of the channel alone would serve one selection's table under
 * another's. JSON gives one spelling per query shape, and the four channels'
 * shapes are disjoint enough that no two distinct queries share one.
 *
 * ## Why the importedAt is stored WITH the entry
 *
 * This is the whole safety property (T-05-19). A lookup hits only when the
 * stored `importedAt` equals the CURRENT meta's, so a replace can never be
 * answered from an entry computed against the previous dataset — the check is
 * against the dataset the caller is looking at, not against when the entry was
 * written. `clearDataQueryMemo` empties it on every import and every clear as
 * well, but correctness does not DEPEND on that: the equality check alone is
 * sufficient, and the clear is what keeps the bound meaningful.
 *
 * Map insertion order is the eviction order, so the first key is the oldest.
 */
const memo = new Map<string, MemoEntry>();

/** The memo key for one query. */
function memoKey(query: DataQuery): string {
  return `${query.channel}:${JSON.stringify(query)}`;
}

/** A memoised answer for `query`, or null when there is none for this dataset. */
export function getDataQueryMemo(
  query: DataQuery,
  importedAt: string,
): { importedAt: string; result: DataResult } | null {
  const entry = memo.get(memoKey(query));
  if (entry === undefined || entry.importedAt !== importedAt) return null;
  return entry;
}

/** Remember one answer, evicting the oldest beyond the bound. */
export function setDataQueryMemo(query: DataQuery, importedAt: string, result: DataResult): void {
  const key = memoKey(query);
  // Re-inserting moves the key to the end, so a refreshed entry counts as the
  // newest rather than the oldest.
  memo.delete(key);
  memo.set(key, { importedAt, result });
  while (memo.size > MAX_MEMO_ENTRIES) {
    const oldest = memo.keys().next();
    if (oldest.done === true) break;
    memo.delete(oldest.value);
  }
}

/**
 * Empty the memo. Called after every successful ingest and on clear-data, so a
 * replaced dataset never leaves a stale entry behind to be found by the
 * importedAt check.
 */
export function clearDataQueryMemo(): void {
  memo.clear();
}

/**
 * How many entries the memo holds. The test seam for the bound and the two
 * clears: neither is observable from a posted message.
 */
export function dataQueryMemoSize(): number {
  return memo.size;
}
