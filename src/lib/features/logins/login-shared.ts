/**
 * Constants and types shared by the login aggregator (worker side) and the
 * login block (main-thread side).
 *
 * This module is pure — no imports, no `Date`, no worker globals — because it
 * is imported from both sides of the `postMessage` boundary. The worker builds
 * the aggregate; the main thread reads the constant and renders the view, and
 * neither may need the other's environment. That is the same rule
 * `playtime-shared.ts` states in its own header, and it is why the view type
 * lives here rather than in the worker message contract.
 */

/**
 * Bumped whenever a stored aggregate would change MEANING, so a dataset already
 * in a user's browser is re-derived instead of being read with new rules.
 *
 * What counts as a meaning change, concretely: a different definition of what
 * one "login" is (D-01 defines it as one session row), a different first/last
 * basis, a different set of columns read, or a change to which IP spellings the
 * parser accepts (plan 06-15: the dotted tail of an IPv6 address now counts as
 * two words, so spellings once refused are addresses and a nine-group key can no
 * longer be stored). What does NOT: a presentation
 * change, a new summary tile, or a cap, none of which alter what an existing
 * row means.
 *
 * A mismatch is a REBUILD, not a refusal and never a cast — the rows still
 * carry the `IP` column, so `buildLogins` can re-derive the aggregate exactly
 * as the import did. Refusing would show a user an error for data the app holds.
 */
export const LOGINS_VERSION = 2;

/**
 * Cap on distinct addresses the stored aggregate lists, so a crafted archive
 * cannot blow the record up with one entry per address (D-12, T-06-14).
 *
 * Modelled on `MAX_SPLIT_VALUES = 50` and for the same reason: the copy tells
 * the user when the cap bites rather than silently truncating, and the value is
 * big enough that a real export never reaches it — 20,000 addresses is a
 * veteran player who logged in from a different address every day for fifty
 * years, not a person.
 *
 * ## What the cap folds away, and what it does NOT (checkpoint: option-a)
 *
 * The addresses past the cap are **counted and not listed**. They are resolved
 * exactly like every other address, exactly once, and their logins are folded
 * into `countries`, into `unknown` and into `totalLogins` as if they had been
 * listed. Only the per-address rows stop.
 *
 * The alternative — leaving them out of the country figures too — was rejected
 * for a reason that is arithmetic rather than taste: the UI-SPEC requires the
 * drawn countries, the not-drawn countries and the unknown-country row to sum
 * to the tile total, and that sum only holds when capped logins are tallied.
 * Option-b would make the map and the "Top country" tile quietly undercount for
 * a large export, and the total on the tile and the sum on the map would
 * disagree with nothing to explain why.
 *
 * So the three relationships that hold at every size are:
 *
 *   - `totalLogins` is the number of counted login ROWS, unreadable rows
 *     excluded, listed or not;
 *   - `sum(countries[].logins) + unknown.logins` equals `totalLogins`;
 *   - `sum(addresses[].logins) + other.logins` ALSO equals `totalLogins`.
 *
 * The last one is why the UI needs the cap line in words rather than as a
 * footnote: at any size the listed rows and the stated totals are the same
 * number, and the cap sentence says which part of it is on screen.
 */
export const MAX_LOGIN_IPS = 20_000;

/**
 * One row of `Account_Info.csv`, as recorded (D-02) and never re-resolved.
 *
 * The account file is Wargaming's own statement about the account, so its
 * country is shown as written and is NEVER looked up through the offline
 * table: if the two disagree they are both right about different things, and
 * the note under the table says which one the row is.
 *
 * `ip` is the CANONICAL address, and it is non-null exactly when `ipState` is
 * `readable`. That is why the state is carried beside the value rather than
 * derived from it: a cell that is BLANK and a cell that could not be read are
 * two different facts about the user's own export, and they render as two
 * different sentences ("not in export" and "not readable"). A single
 * `ip: string | null` would collapse them.
 *
 * `countryCode` and `city` are the account file's own text, trimmed and cut at
 * 64 characters — the same bound `MAX_IP_TEXT_LENGTH` uses, for the same
 * reason: these are cells of an untrusted archive and a 100 KB one must cost a
 * trim and a slice. They are never parsed, normalised or upper-cased here; the
 * UI-SPEC renders a two-letter code as its English name and anything else as
 * written.
 */
export interface AccountRecord {
  /** The canonical address, or null when the cell is blank or unreadable. */
  ip: string | null;
  /** Which of the three facts about the cell is the true one. */
  ipState: 'readable' | 'unreadable' | 'blank';
  /** The account file's country text, or null when the cell is blank. */
  countryCode: string | null;
  /** The account file's city text, or null when the cell is blank. */
  city: string | null;
}

/** The longest an account-record text cell may be before it is cut. */
export const MAX_ACCOUNT_TEXT_LENGTH = 64;

/** One distinct canonical address, with everything the table row needs. */
export interface LoginAddress {
  /**
   * The canonical address string — the GROUPING KEY, and the only spelling the
   * table ever stores (D-05: one row per distinct full IP).
   */
  ip: string;
  /**
   * The two-letter country code resolved once at import (D-12), or null when
   * the lookup found no match: a private range, a DB-IP gap, or a build with no
   * table wired in. Null is D-08's "Unknown country", never a guess.
   */
  cc: string | null;
  /** How many counted rows carried this address (D-01: one login per row). */
  logins: number;
  /** Earliest usable wall-clock second, or null when no row's stamp parsed. */
  first: number | null;
  /** Latest usable wall-clock second, or null when no row's stamp parsed. */
  last: number | null;
  /**
   * The game tokens of the files this address appeared in, ascending.
   *
   * The token comes from the FILE NAME (`sessionFileGame`), never from a cell,
   * and a legacy `Sessions.csv` or a `Logins.csv` contributes none — which is
   * why an address from such a file carries no token rather than a fabricated
   * one.
   */
  games: string[];
}

/** One country's rollup, for the world map and the ranked country list. */
export interface LoginCountryTotal {
  /** Two-letter country code, upper case. */
  cc: string;
  /** Counted logins from every address in this country. */
  logins: number;
  /** How many distinct addresses contributed to that total. */
  ips: number;
}

/**
 * Every figure the login history shows, with nothing about HOW it was built.
 *
 * Split out of {@link LoginAggregates} so the `ready` view carries the same
 * shape by construction: a field added to one is a field added to the other,
 * and there is no list of "the data fields" that a new field could be left out
 * of by accident.
 */
export interface LoginsViewData {
  /** Sources that contributed at least one counted login. */
  filesWithRows: number;
  /**
   * One entry per distinct address, logins DESCENDING then address ASCENDING
   * by `compareIp`: numeric by octet or group, every IPv4 before every IPv6, so
   * `192.0.2.9` precedes `192.0.2.10`, which a code-unit comparison of the
   * strings would reverse.
   *
   * Never `localeCompare`: the order is STORED, and a locale-dependent
   * comparison would give two people reading one export two different tables
   * and two different meanings for the same row.
   */
  addresses: LoginAddress[];
  /** Counted logins across every address, unreadable rows excluded. */
  totalLogins: number;
  /**
   * Rows whose IP cell was missing, blank, over-long or unparseable (D-06).
   *
   * COUNTED AND NEVER STORED, and the count is the whole point: a user whose
   * export has one odd cell needs the sentence "1 row could not be read", not
   * an empty table with no explanation and never the cell itself (T-06-01).
   */
  unreadableRows: number;
  /** The D-08 unknown-country bucket: how many addresses and logins sit in it. */
  unknown: { addresses: number; logins: number };
  /** Per-country rollups, logins DESCENDING then code ASCENDING. */
  countries: LoginCountryTotal[];
  /**
   * Addresses past {@link MAX_LOGIN_IPS}: counted, listed nowhere.
   *
   * Their logins are ALSO in `totalLogins` and in the country and unknown
   * tallies, which is the recorded checkpoint outcome and the reason the cap
   * bounds MEMORY rather than the truth. The relationship the UI depends on is
   * that `sum(addresses[].logins) + other.logins === totalLogins` holds at
   * every size, so the listed rows and the stated totals never silently
   * disagree; see {@link MAX_LOGIN_IPS} for the full set of relationships.
   */
  other: { addresses: number; logins: number };
  /** Earliest usable wall-clock second over every address, or null. */
  first: number | null;
  /** Latest usable wall-clock second over every address, or null. */
  last: number | null;
  /**
   * The `Account_Info.csv` row shown as one labelled "Account record" entry
   * (D-02) — never a login, never in `totalLogins`, never in a country total
   * and never in `other`.
   *
   * It is stored UNCHANGED: the aggregator is handed it and neither reads it
   * nor counts it, because a value that were counted anywhere here would make
   * the account's own address a login the export never recorded. The worker
   * fills it from the sanitised User_Info row (plan 06-05).
   */
  account: AccountRecord | null;
}

/**
 * The whole-dataset login aggregate, computed once in the worker at import and
 * persisted on the dataset meta record (D-12).
 *
 * It is stored on the meta record and NOT on `ClassifyResult` on purpose, for
 * the reason 04-01 recorded for playtime: `IngestClient` holds the import result
 * as a deep `$state` proxy, which would walk every address on every replay.
 */
export interface LoginAggregates extends LoginsViewData {
  /** `LOGINS_VERSION` at aggregation time. */
  v: number;
  /**
   * The geo data this aggregate was resolved against — `geoTableId()` at build
   * time. A stored aggregate whose `geo` is not the current one is rebuilt, so
   * a build that ships a different table never serves answers from the old one.
   */
  geo: string;
  /**
   * Which SOURCE KINDS were supplied, per FILE rather than per row.
   *
   * Set before any row is read, because a header-only session file parses to
   * zero rows and a flag set inside the loop would report a file that EXISTS as
   * an export that has none. It is what separates `no-source` from
   * `no-usable`, which are two different sentences about the user's own zip
   * (Phase 3 D-10).
   */
  filesSeen: { sessions: boolean; logins: boolean };
}

/**
 * What a `logins` query answers with.
 *
 * Three statuses, and the copy treats them as three different sentences:
 *   - `no-source` — this export carries no session file and no login file, so
 *     there is nothing to say and no row to show.
 *   - `no-usable` — the files WERE there and no row carried a readable address,
 *     so the table is empty and the copy names the unreadable count.
 *   - `ready` — the table has its rows.
 */
export type LoginsView =
  | { status: 'no-source' }
  | { status: 'no-usable'; unreadable: number }
  | ({ status: 'ready' } & LoginsViewData);
