import type { AccountSummary, ClassifyResult } from '../core/types/worker-messages.ts';
import { daysInMonth } from '../core/civil-date.ts';
import {
  IDENTITY_NO_ACTIVITY,
  UNKNOWN_VALUE,
  formatAccountGames,
  formatAccountId,
  formatAccountTagLabel,
  formatActivityYears,
} from '../ui-copy.ts';

/**
 * The view model behind the multi-account identity header (Phase 9, plan
 * 09-04; D-13 … D-17, UI-SPEC Surface 1).
 *
 * ## Why this is a pure module and not markup
 *
 * Every decision the multi header makes — is this a multi dataset, what does
 * one row show, whose identity does it show — is a decision about DATA, and
 * every one of them has an empty, a partial and a hostile shape. `vitest.config.ts`
 * runs in Node with no Svelte plugin, so a component cannot be rendered in a
 * unit test at all; putting these rules here makes them testable without a
 * browser, and leaves the component with nothing to decide.
 *
 * ## The privacy rule this module enforces structurally
 *
 * `accountRows` reads ONE `AccountSummary` at a time and never looks at
 * `ClassifyResult.identity`, the legacy first-account field. That is the whole
 * of T-09-20: a row cannot present another account's identity as its own
 * because it is never handed anything but its own summary. The legacy field is
 * still what the SINGLE-account header renders, unchanged.
 *
 * ## No `Date`, no DOM, no runes
 *
 * The dates are compared as normalised integers (see {@link parseCivilDate}),
 * for the same reason `src/lib/core/civil-date.ts` exists: a wall-clock stamp in
 * an export is not an instant, and a `Date` round-trip would invent a timezone
 * the field never had and could shift a day for a viewer west of UTC.
 */

/** One rendered account row: everything the template shows, already decided. */
export interface AccountRowModel {
  /**
   * True when this root parsed NO `User_Info` row, so the ID is the title
   * (D-17) and the ID line is omitted rather than repeating it.
   */
  idOnly: boolean;
  /**
   * The row's heading: the nickname, `Unknown` for a blank `NAME`, or the
   * account root on an ID-only row.
   *
   * NEVER another account's nickname, and never the legacy first-account one —
   * this is a field of the account's OWN summary, which is where the per-root
   * identity pool was filled in the worker (D-17, D-19).
   */
  name: string;
  /** The `Account ID: {root}` line, or `null` on an ID-only row. */
  idLine: string | null;
  /** The games value, or `null` when the account has no game token at all. */
  games: string | null;
  /** The activity value: a year range, or "No activity recorded" (D-15). */
  activity: string;
}

/**
 * How many account folders the archive held (plan 09-11).
 *
 * Zero for `null` (no export at all); otherwise the greatest of one, the
 * published `rootCount` and the published list's length. The one-folder answer
 * is what makes a v1.0 cache and a hand-built result render exactly as v1.0, and
 * the maximum is defensive: a `rootCount` smaller than the list it sits beside
 * is a malformed result, and the list is the stronger evidence.
 *
 * This counts FOLDERS, including a folder that stored nothing. It decides which
 * variant the dashboard shows and never a title or a caption: those read
 * {@link accountCountOf}.
 */
export function rootCountOf(result: ClassifyResult | null): number {
  if (result === null) return 0;
  return Math.max(1, result.rootCount ?? 0, result.accounts?.length ?? 0);
}

/**
 * Whether the archive held two or more account folders.
 *
 * The one predicate every variant decision asks: the header's multi variant, the
 * Account list row and the Overview Account card. The legacy `identity` is the
 * FIRST folder's, so an archive of several folders must never render it as the
 * export's, whether or not the other folders stored data (D-13, T-09-33).
 */
export function hasMultipleRoots(result: ClassifyResult | null): boolean {
  return rootCountOf(result) >= 2;
}

/**
 * How many accounts the dataset holds data for.
 *
 * The figure behind every title, row count and combined caption (09-10
 * option-a): `result.accounts.length` for a non-empty list; for an absent or
 * empty list, ONE (a hand-built result or a v1.0 cache reads as one account) —
 * unless the archive held several folders, in which case none of them stored
 * data and the answer is ZERO. Zero for `null`.
 *
 * It must never choose a variant: it answers "how many accounts have data", not
 * "how many folders did the archive hold". That is {@link hasMultipleRoots}.
 */
export function accountCountOf(result: ClassifyResult | null): number {
  if (result === null) return 0;
  const accounts = result.accounts;
  if (accounts === undefined || accounts.length === 0) {
    return hasMultipleRoots(result) ? 0 : 1;
  }
  return accounts.length;
}

/** D-16: an absent or blank nickname is "Unknown", never an empty heading. */
function valueOrUnknown(value: string | null): string {
  return value === null || value.trim() === '' ? UNKNOWN_VALUE : value;
}

/**
 * One row per account, IN THE ORDER GIVEN.
 *
 * The worker stores D-16 order (first activity year ascending, no-activity
 * accounts last, ties and absences by account ID in code-unit order) and every
 * producer sorts with `sortAccounts`, so re-sorting here would mean two
 * comparators that could disagree. This function is a projection, not a sort.
 */
export function accountRows(accounts: readonly AccountSummary[]): AccountRowModel[] {
  return accounts.map((account) => {
    // Bound once and narrowed on the BINDING, not on a boolean alias: TypeScript
    // will not carry the narrowing through `idOnly`, and the alias would hide a
    // real "read from a possibly-null identity" bug behind a truthy flag.
    const identity = account.identity;
    const idOnly = identity === null;
    const years = account.firstYear;
    return {
      idOnly,
      name: identity === null ? account.root : valueOrUnknown(identity.nickname),
      // v1.0 D-16's rule, applied per row: the ID line is omitted where the ID
      // is already the title, so one value is never shown twice.
      idLine: idOnly ? null : formatAccountId(account.root),
      // An account with no game token omits the Games term AND its value
      // (UI-SPEC, empty/identity header/Games row) — never an empty `<dd>`.
      games: account.games.length === 0 ? null : formatAccountGames(account.games),
      activity:
        years === null ? IDENTITY_NO_ACTIVITY : formatActivityYears(years, account.lastYear),
    };
  });
}

/**
 * One account's tag (Phase 10, D-10): the letter, the root it belongs to and the
 * nickname it may be named by.
 *
 * `nickname` is `null` for an account with no `User_Info` row or a blank `NAME`,
 * which is what lets the phrase omit the clause rather than render "nickname"
 * followed by nothing. It is never the `Unknown` placeholder
 * {@link accountRows} shows as a heading: that string is for a VISIBLE heading,
 * and repeating it inside a hidden phrase would announce an absence as a value.
 */
export interface AccountTagModel {
  /** The account root this tag names — the `Map` key and `VehicleRow.account`. */
  root: string;
  /** `A`, `B`, … `Z`, `AA`, `AB`. Derived from the order, never stored. */
  letter: string;
  nickname: string | null;
}

/**
 * The account tag letters, in BIJECTIVE base-26 (D-10).
 *
 * Zero is `A` and twenty-five is `Z`, so twenty-six is `AA` rather than `BA`:
 * the letters name POSITIONS in an ordered list the reader can count, and `BA`
 * at twenty-six would leave `AA` at the end of the list with nothing before it.
 *
 * The loop is written as the research's version rather than as a `String.fromCharCode`
 * with a base-26 carry, because the carry for a bijective base is `floor(n/26) - 1`
 * and getting that off by one is invisible at `A` and wrong at `AA`.
 *
 * A negative index returns `''` rather than throwing: the function is called
 * from a template on a value this module itself produced, so a negative index
 * would be a bug elsewhere — and an empty chip renders as nothing rather than
 * taking the page down.
 */
export function letterOf(index: number): string {
  let n = index;
  let text = '';
  if (n < 0) return text;
  do {
    text = String.fromCharCode(65 + (n % 26)) + text;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return text;
}

/**
 * One tag per account, keyed by root, IN THE ORDER GIVEN (D-10, D-16).
 *
 * A `Map`, never an object: the key is a zip folder name, so a root literally
 * called `__proto__` or `constructor` is a hostile string that an object would
 * either drop or answer with a prototype member (T-10-09). `Map` makes both
 * ordinary keys, and `Map.get` cannot walk a prototype chain.
 *
 * A projection, not a sort, for exactly the reason {@link accountRows} is one:
 * the worker's `sortAccounts` is the only D-16 comparator, and a second one here
 * would be a second thing that can disagree with the header's own row order.
 * The letters therefore match the header's row order by construction rather than
 * by two comparators agreeing.
 *
 * A duplicate root keeps its FIRST letter: the list is expected to be one entry
 * per account, and a repeated root is a malformed result for which showing the
 * first is the stable answer rather than the last.
 */
export function accountTagsOf(accounts: readonly AccountSummary[]): Map<string, AccountTagModel> {
  const tags = new Map<string, AccountTagModel>();
  accounts.forEach((account, index) => {
    if (tags.has(account.root)) return;
    const nickname = account.identity?.nickname ?? null;
    tags.set(account.root, {
      root: account.root,
      letter: letterOf(index),
      nickname: nickname === null || nickname.trim() === '' ? null : nickname,
    });
  });
  return tags;
}

/**
 * The tags to draw, or `null` when there are none (D-10, UI-SPEC zero-one-many).
 *
 * `null` and not an empty map is the whole rule: every call site asks
 * `tags !== null`, so one account renders no node, no wrapper and no extra
 * column width, and the v1.0 DOM stays byte-identical.
 *
 * The count is {@link accountCountOf} rather than `accounts.length`, because
 * that is the figure the caption and the header title already use — a tag row
 * that disagrees with the count above it would be two answers to one question.
 * An archive whose folders all stored data has an empty list and therefore no
 * tags, which is why the published list is checked as well.
 */
export function accountTagsFor(
  result: ClassifyResult | null,
): ReadonlyMap<string, AccountTagModel> | null {
  if (result === null || accountCountOf(result) < 2) return null;
  const accounts = result.accounts ?? [];
  if (accounts.length < 2) return null;
  return accountTagsOf(accounts);
}

/**
 * A tag's phrase in a DATA ROW (D-10, D-19).
 *
 * Exported beside {@link accountTagsOf} rather than left to each caller, so the
 * one function that builds a phrase containing the ID and the nickname is the
 * one that goes through `formatAccountTagLabel`.
 */
export function tagLabel(tag: AccountTagModel): string {
  return formatAccountTagLabel(tag.letter, tag.root, tag.nickname);
}

/**
 * A parsed civil date as comparable integers, or `null` when the text is not a
 * date this export writes.
 *
 * ## Why two shapes and no `Date`
 *
 * A real export writes `YYYY-MM-DD…` for `CREATED_AT` and `DD.MM.YYYY …` for
 * the European fields, so both are accepted. A value in any other shape does
 * not parse and is SKIPPED rather than guessed at, because a card that names a
 * date the export never wrote is a statement about the user's own account that
 * the data does not support.
 *
 * The month and day are range-checked (including the leap-year February), which
 * is why `daysInMonth` is imported: `2020-02-30` is not a date, and accepting
 * it would silently normalise to a March day. Nothing here constructs a `Date`,
 * so no timezone can shift a day (the rule `formatCreatedDate` documents).
 */
function parseCivilDate(raw: string): { y: number; m: number; d: number } | null {
  const text = raw.trim().split(/[ T]/)[0] ?? '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso !== null) {
    return check(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (dotted !== null) {
    return check(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
  }
  return null;
}

function check(y: number, m: number, d: number): { y: number; m: number; d: number } | null {
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** Is `a` earlier than `b`? Integer arithmetic, so no locale and no `Date`. */
function earlier(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) {
  if (a.y !== b.y) return a.y < b.y;
  if (a.m !== b.m) return a.m < b.m;
  return a.d < b.d;
}

/**
 * The earliest creation date across every account whose `createdAt` parses, as
 * the text `formatCreatedDate` would show it, or `null` when none parses.
 *
 * The Overview card's multi-account summary (UI-SPEC Surface 3). "Earliest"
 * rather than any one account's date, because one account does not describe an
 * export holding several; and `null` rather than a guess, because the card then
 * says the date is unknown instead of naming a day nobody wrote.
 *
 * Ties keep the FIRST account's text, so the answer does not depend on an order
 * the caller may not have sorted.
 */
export function earliestCreated(accounts: readonly AccountSummary[]): string | null {
  let best: { y: number; m: number; d: number } | null = null;
  let bestText: string | null = null;

  for (const account of accounts) {
    const createdAt = account.identity?.createdAt ?? null;
    if (createdAt === null) continue;
    const parsed = parseCivilDate(createdAt);
    if (parsed === null) continue;
    if (best === null || earlier(parsed, best)) {
      best = parsed;
      bestText = createdAt.trim().split(/[ T]/)[0] ?? null;
    }
  }

  return bestText;
}
