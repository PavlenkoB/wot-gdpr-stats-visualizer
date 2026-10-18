import type { AccountSummary } from '../core/types/worker-messages.ts';
import { civilFromDays } from '../core/civil-date.ts';
import {
  parseSessionTimestamp,
  resolveSessionColumns,
  type SessionSource,
} from '../features/playtime/playtime-aggregate.ts';
import { cell } from './csv-columns.ts';
import type { AccountMeta, DatasetMeta } from './db.ts';

/**
 * Per-account summary, ordering and the meta-to-accounts normaliser
 * (Phase 9, plan 09-02; D-08, D-14, D-15, D-16, D-22).
 *
 * ## Why this is a separate pure module
 *
 * Four of the phase's decisions are arithmetic over data the worker has
 * ALREADY produced — which games an account played, in which years, in what
 * order the accounts list reads, and what a v1.0 cache normalises to. None of
 * them needs a zip, a worker scope or a database, and every one of them is a
 * rule a reader can get subtly wrong in a different direction (numeric instead
 * of code-unit ordering; years read through `Date` and shifted by the viewer's
 * zone; a legacy cache normalised to an empty list instead of a one-account
 * one). Keeping them here makes each rule a small named function with its own
 * unit tests, and leaves `ingest.worker.ts` responsible for orchestration only.
 *
 * There are no worker globals and no Dexie import beyond `import type`, so this
 * module is importable from a plain Node test as well as from the worker.
 */

/** What {@link summarizeSessionSources} answers for one account. */
export interface AccountSummaryFacts {
  /** The account's game tokens, code-unit ascending (D-14). */
  games: string[];
  /** The earliest session start's year, or null when none parses (D-15). */
  firstYear: number | null;
  /** The latest session start's year, or null when none parses (D-15). */
  lastYear: number | null;
}

/**
 * Games and activity years for ONE account, from that account's session
 * sources (D-14, D-15).
 *
 * ## Games: files WITH ROWS, never files that were seen
 *
 * A `*_Game_Sessions.csv` the account never played parses to zero rows, and
 * listing its game would claim the account played it — a statement about the
 * user's own history that the data does not support. So a source contributes
 * its token only when it holds at least one row. The token is upper-cased and
 * the list is sorted in PLAIN code-unit order, because the identity header
 * shows this list and two viewers must see the same one.
 *
 * `Game_Active_Sessions.csv` is not a session source at all (it names no game
 * and is not in the aggregator's sources), so it can never appear here.
 *
 * ## Years: EVERY source with rows, game or not
 *
 * The legacy `Sessions.csv` names no game but its starts are real activity, so
 * it contributes years and no game. Years are the min and max of the START cell
 * of every row whose start parses, across every source — read through
 * `resolveSessionColumns` per source, exactly as the playtime aggregator does,
 * because each session file carries its own header and resolving once for the
 * whole account would apply the first file's columns to every other one.
 *
 * A row whose start does not parse is SKIPPED, not counted as activity: a
 * garbage cell is not a session, and D-15's answer must be derivable from the
 * rows a reader could also see.
 *
 * The conversion is `civilFromDays`, never `Date`: the same export must give
 * the same years whatever zone the browser runs in (D-01 of the civil-date
 * module), and the session timestamps are wall-clock stamps rather than
 * instants.
 */
export function summarizeSessionSources(sources: readonly SessionSource[]): AccountSummaryFacts {
  const games = new Set<string>();
  let earliest: number | null = null;
  let latest: number | null = null;

  for (const source of sources) {
    if (source.rows.length === 0) continue;
    if (source.game !== null) games.add(source.game.toUpperCase());

    const columns = resolveSessionColumns(source.rows[0]!);
    if (columns.start === null) continue;
    for (const row of source.rows) {
      const seconds = parseSessionTimestamp(cell(row, columns.start));
      if (seconds === null) continue;
      if (earliest === null || seconds < earliest) earliest = seconds;
      if (latest === null || seconds > latest) latest = seconds;
    }
  }

  return {
    games: [...games].sort(),
    firstYear: earliest === null ? null : civilFromDays(Math.floor(earliest / 86400)).y,
    lastYear: latest === null ? null : civilFromDays(Math.floor(latest / 86400)).y,
  };
}

/** The two fields D-16 orders by. Narrower than {@link AccountMeta}. */
export interface OrderableAccount {
  root: string;
  firstYear: number | null;
}

/**
 * The D-16 comparator: first activity year ascending, an account with no
 * activity after every account with some, and ties broken by root in PLAIN
 * code-unit order.
 *
 * ## Why code-unit and never numeric or locale
 *
 * Real Wargaming account folders are numeric ids of DIFFERENT lengths, so the
 * numeric order and the code-unit order disagree (`1000000003` sorts before
 * `2000002` by code unit and after it numerically). The order is only stable
 * if it does not depend on which comparison a reader happened to reach for, and
 * `localeCompare` would additionally make it depend on the VIEWER's locale —
 * two people reading the same export would see the accounts listed differently.
 *
 * ## Why no-activity accounts go last rather than being treated as year 0
 *
 * "No activity recorded" is an absence, not an activity in 1970. Sorting it
 * as a small year would put a fresh account at the TOP of a list that reads as
 * a migration timeline, which is the one claim D-16 is making.
 */
export function compareAccounts(a: OrderableAccount, b: OrderableAccount): number {
  if (a.firstYear !== null && b.firstYear !== null && a.firstYear !== b.firstYear) {
    return a.firstYear < b.firstYear ? -1 : 1;
  }
  if (a.firstYear !== null && b.firstYear === null) return -1;
  if (a.firstYear === null && b.firstYear !== null) return 1;
  if (a.root === b.root) return 0;
  return a.root < b.root ? -1 : 1;
}

/**
 * A new array in D-16 order. The input is not mutated: the caller keeps the
 * classifier's code-unit order for whatever else needs it, and a sort that
 * reordered its argument in place would make the two indistinguishable.
 */
export function sortAccounts<T extends OrderableAccount>(accounts: readonly T[]): T[] {
  return [...accounts].sort(compareAccounts);
}

/**
 * The main-thread view of one stored account (ACCOUNT-05).
 *
 * Categories and presence facts stay in the worker and in `meta.accounts`:
 * nothing outside the worker reads them this phase, and crossing them would
 * widen what leaves the worker for no consumer.
 *
 * ## Why the defaults belong HERE (09-09, IN-01, T-09-30)
 *
 * This projection is the ONE boundary every replay crosses — `done`, `duplicate`
 * and `cache-status` all reach the main thread through it — so a record written
 * by ANOTHER build, or one interrupted mid-write, is completed here and nowhere
 * else. A default at each reader instead would be a default that can disagree
 * with itself: one header could show an account with no games while the next
 * reads `.length` off `undefined` and blanks the dashboard.
 *
 * `games` defaults to a NEW empty array rather than a shared one: a constant
 * handed to two summaries is one array a caller could mutate into both.
 * `identity` defaults to `null`, which is D-17's own "this root parsed no
 * User_Info row" value and the shape the id-only row already renders — not a
 * fabricated nickname.
 *
 * ## Why the stored type is NOT weakened
 *
 * `AccountMeta` stays exactly as the current writer writes it, because that is
 * the writer's contract and nothing here is evidence about it. The tolerance is
 * for records in STORAGE, which is a fact about another build or an
 * interrupted write; a partial field is possible on the way out of IndexedDB
 * without being possible on the way in.
 */
export function toAccountSummary(account: AccountMeta): AccountSummary {
  return {
    root: account.root,
    identity: account.identity ?? null,
    games: account.games ?? [],
    // A missing year is D-15's honest `null` ("no activity recorded"), not an
    // absent field: `accountRows` narrows on `=== null`, so `undefined` sailed
    // past it and the row rendered the STRING "undefined" as its activity line.
    firstYear: account.firstYear ?? null,
    lastYear: account.lastYear ?? null,
  };
}

/**
 * The ONE normaliser that turns a stored meta record into an account list
 * (D-08, D-22).
 *
 * `done`, `duplicate` and `cache-status` all build their accounts through this,
 * so a page reloaded after an import shows exactly what the import showed. A
 * field a replay could disagree about is a page that renders a nickname after
 * a re-drop but not after a reload.
 *
 * ## Why a legacy meta becomes a ONE-entry list rather than none
 *
 * A cache written before Phase 9 has no `accounts` array, but it does have the
 * legacy `accountRoot` / `identity` / `categories` / `files` fields, and its
 * rows are all one account's. Returning an EMPTY list would tell a reader the
 * export held no accounts, which is a different statement from "this cache
 * predates accounts" — and every v1.0 reader of `accountRoot` would then be
 * describing an account the list does not contain.
 *
 * ## Why its games and years are empty and null (D-22)
 *
 * They are NOT computed here, and deliberately so. A v1.0 cache is always a
 * single account, and the identity header renders one account exactly as v1.0
 * did — with no games and no activity years. Nothing would read these two
 * fields for such a dataset, so computing them would mean a rebuild path, a
 * summary-version constant and a guarded write that exist only to answer a
 * question nobody asks. `null` is the honest value: "not computed for this
 * dataset", never a fabricated 1970 or an empty-account claim. Phase 10
 * revisits this if a game filter ever needs them.
 */
export function accountsOfMeta(meta: DatasetMeta): AccountMeta[] {
  if (Array.isArray(meta.accounts) && meta.accounts.length > 0) return meta.accounts;
  return [
    {
      root: meta.accountRoot,
      categories: meta.categories,
      identity: meta.identity ?? null,
      files: meta.files ?? [],
      games: [],
      firstYear: null,
      lastYear: null,
    },
  ];
}

/**
 * The ONE projection from stored records to the PUBLISHED account list
 * (plan 09-10, `accountCountSemantics: option-a`).
 *
 * ## Why this exists and is not a filter at each call site
 *
 * The UI audit's first finding was that the header's count and the pane captions
 * described the ARCHIVE while the rows described the DATA: a root whose folders
 * are all `known-deferred` was counted and listed while contributing no row to
 * anything on the dashboard. Deciding that at each of the three replay paths
 * would have been three matching edits that could drift — which is what let the
 * count drift in the first place. `done`, `duplicate` and `cache-status` all go
 * through here, so they agree by construction.
 *
 * ## The filter is `hasData === false`, never "no data can be inferred"
 *
 * An ABSENT flag means the record predates the field, and such a record is
 * published exactly as it always was. That is what keeps a returning user's
 * cache rendering identically after this ships.
 *
 * It also means the filter cannot be answered from a summary: a root with
 * sessions but no `User_Info` has no games, no years and a null identity, and it
 * STILL holds data and stays listed (D-17). Only the writer, which saw every row
 * it stored, can answer this — hence the stored flag.
 *
 * ## Why the order is untouched
 *
 * Filtering preserves the input's order, so the published list is in the same
 * D-16 order the store holds and the sort stays the worker's single comparator.
 */
export function accountSummariesOf(accounts: readonly AccountMeta[]): AccountSummary[] {
  return accounts
    .filter((account) => account.hasData !== false)
    .map((account) => toAccountSummary(account));
}
