/**
 * Login-history aggregation over the parsed rows of an export's session files
 * (phase 06, D-01, D-12, plan 06-01).
 *
 * ## What this exists, and what it deliberately does not do
 *
 * A "login" is ONE SESSION ROW (D-01), and the history is built from every
 * `*_Game_Sessions.csv` the archive holds, merged, with each address keeping
 * the set of game tokens of the files it appeared in. The real 2021 export has
 * no `Logins.csv` at all; a legacy `Sessions.csv` or an invented `Logins.csv`
 * contributes rows with NO game token rather than a fabricated one.
 *
 * This module lives BESIDE `playtime-aggregate.ts` and does not edit it. That
 * module's header states that the `IP` column is never read and
 * `tests/unit/playtime/` asserts it (T-04-01); the login history is the one
 * feature that must read it, so it reads it here.
 *
 * ## Why exactly TWO columns are read
 *
 * The `IP` cell, and the start-time cell. Nothing else is touched, and the
 * columns are resolved from the FIRST row's keys with `headerKey` — a padded
 * or oddly-cased header resolves, and a file whose later rows carry extra
 * columns cannot change which column is which. `FINISHED_AT` is deliberately
 * NOT read: a login is an arrival, so its time is when it STARTED, and reading
 * the end of the session would put a five-hour session in the wrong hour of
 * the day.
 *
 * ## Why the lookup is a PARAMETER
 *
 * `CountryLookup` is injected and never imported, so the aggregator cannot
 * decide which table it is running against, and a test can inject a counting
 * spy and prove the lookup runs ONCE PER DISTINCT ADDRESS rather than once per
 * row. On a 71,000-row export that is the difference between one comparison and
 * seventy thousand. `geoTableId()` is read by the WORKER, which is what decides
 * whether a stored aggregate is stale — not by this module, which cannot know
 * the id of a table it does not own.
 *
 * ## What it never does
 *
 * Never throw on data, never build a message from a cell, never store a value
 * it could not read. An unreadable address is COUNTED (`unreadableRows`) and
 * nothing more (D-06, T-06-02): the cell is the user's data, Phase 3 D-21
 * keeps it off the screen and out of every outcome, and T-06-01 keeps it out of
 * every log line.
 *
 * ## What the cap folds, and what it does not
 *
 * `MAX_LOGIN_IPS` bounds the STORED address list against a crafted archive
 * (D-12, T-06-14). It bounds memory, not the truth: the addresses past it are
 * resolved exactly once like every other address, and their logins are in
 * `totalLogins`, in `countries` and in `unknown`. Only the per-address rows
 * stop. The full set of relationships — and why the alternative was rejected —
 * is written on the constant in `login-shared.ts`.
 */

import { cell, headerKey } from '../../worker/csv-columns.ts';
import { compareIp, parseIp, type ParsedIp } from '../../geo/ip.ts';
import { geoTableId, type CountryLookup } from '../../geo/country-lookup.ts';
import {
  parseSessionTimestamp,
  type SessionRow,
  type SessionSource,
} from '../playtime/playtime-aggregate.ts';
import {
  LOGINS_VERSION,
  MAX_LOGIN_IPS,
  type AccountRecord,
  type LoginAddress,
  type LoginAggregates,
  type LoginsView,
} from './login-shared';

/**
 * One source of login rows: a session file's or a login file's own header, over
 * the same parsed rows the playtime aggregator reads.
 *
 * `kind` says which HEADER the rows carry, not which folder: a real export's
 * `*_Game_Sessions.csv` and a legacy `Sessions.csv` are both `sessions`, while
 * an invented `Logins.csv` is `logins`. `rows` is the SAME array object the
 * playtime source holds — pushed alongside it in the import loop, never copied
 * — so a second aggregation over a 71,000-row export costs a second pass, not
 * a second copy of every row.
 */
export type LoginSource = SessionSource & { kind: 'sessions' | 'logins' };

/**
 * The time column's accepted spellings, in the order they are preferred.
 *
 * `STARTED_AT` is the REAL export's name, `SESSION_START` the synthetic
 * fixture's, `LOGIN_DT` an invented `Logins.csv`'s. They are aliases for one
 * field, not three candidates: the resolution below takes whichever key
 * appears FIRST IN THE ROW, so a file carrying more than one reads the column
 * that actually holds the data.
 */
const TIME_COLUMN_NAMES: readonly string[] = ['STARTED_AT', 'SESSION_START', 'LOGIN_DT'];

/** The IP column's one accepted spelling, under the same `headerKey` match. */
const IP_COLUMN_NAME = 'IP';

/**
 * The one login-file name, spelled ONCE (D-01).
 *
 * The real 2021 export has no `Logins.csv` at all — its addresses live only in
 * the per-title `*_Game_Sessions.csv` files — so this name is an INVENTED
 * shape that a synthetic or older export may carry. It is a constant rather
 * than a literal at each of its three call sites (the import push, this
 * module's predicate and `db.ts`'s name-only screen) because a second
 * spelling of the same file is how the import path and the backfill stop
 * agreeing about which rows belong to the login history.
 */
const LOGINS_FILE_NAME = 'logins.csv';

/**
 * The folder both session files and `Logins.csv` live in, lower-cased.
 *
 * Deliberately the same rule `sessionFileGame` applies to a session file: the
 * classifier matches folder names case-insensitively and PRESERVES the export's
 * own spelling, so a `activity_history` folder classifies as the same
 * supported category and its files are the ones the history is built from.
 */
const ACTIVITY_HISTORY_CATEGORY = 'activity_history';

/**
 * The NAME-ONLY half of {@link isLoginsRow}, for the backfill's index screen
 * in `db.ts`.
 *
 * Exported for the same reason `isLegacySessionsFileName` is: a reader that
 * screens the `sourceFile` index has a key and no row to hand a category to,
 * and re-spelling the name here would let the screen and the predicate drift.
 * The two must stay one rule.
 */
export function isLoginsFileName(sourceFile: string): boolean {
  return sourceFile.toLowerCase() === LOGINS_FILE_NAME;
}

/**
 * True when a row is one of the invented `Logins.csv` rows (D-01).
 *
 * The same shape as `isSessionsRow`, and the same two comparisons: the folder
 * is `Activity_history` case-insensitively and only the BASENAME is matched, so
 * a `Logins.csv` in another folder is not mistaken for this one and a login
 * file nested one folder deeper is not either (the import path stores only the
 * basename).
 *
 * A row this accepts is handed to the aggregator with `kind: 'logins'` and
 * `game: null`, which is what makes its rows count as logins while contributing
 * NO game token: a title that name never claimed (T-04-27 — the token comes
 * from a file name or from nothing, never from a cell).
 */
export function isLoginsRow(category: string, sourceFile: string): boolean {
  return category.toLowerCase() === ACTIVITY_HISTORY_CATEGORY && isLoginsFileName(sourceFile);
}

/**
 * The two columns this module reads, resolved from a row's own keys.
 *
 * A `null` key means the column is absent, and then `cell` answers `undefined`
 * for every row — which makes the whole source contribute nothing rather than
 * being counted against a GUESSED column name.
 */
interface LoginColumns {
  ip: string | null;
  time: string | null;
}

/**
 * Resolve the IP and time columns from the KEYS of one row, first match wins.
 *
 * Only the first row is inspected, so a file whose later rows carry a different
 * set of headers cannot change which column is which partway through.
 */
function resolveLoginColumns(row: SessionRow): LoginColumns {
  const columns: LoginColumns = { ip: null, time: null };
  for (const key of Object.keys(row)) {
    const normalized = headerKey(key);
    if (columns.ip === null && normalized === IP_COLUMN_NAME) columns.ip = key;
    if (columns.time === null && TIME_COLUMN_NAMES.includes(normalized)) columns.time = key;
  }
  return columns;
}

/** No columns: what a source with no rows resolves to. */
const NO_COLUMNS: LoginColumns = { ip: null, time: null };

/**
 * One address while it is being counted, before its country is known.
 *
 * The `Set` of game tokens is what makes "the titles this address appeared in"
 * a SET rather than a count: the same address in three files contributes one
 * token, and the ordering rule for the finished array is stated at the sort.
 */
interface CountingAddress {
  /** Kept so the lookup runs on the parsed form and never re-parses a string. */
  parsed: ParsedIp;
  logins: number;
  first: number | null;
  last: number | null;
  games: Set<string>;
  /** Filled by the single post-walk lookup pass; unset until then. */
  resolvedCc?: string | null;
}

/** Fold one wall-clock second into a running min/max, treating null as unset. */
function fold(into: number | null, value: number | null): number | null {
  if (value === null) return into;
  if (into === null) return value;
  return Math.min(into, value);
}

/** Fold one wall-clock second into a running max, treating null as unset. */
function foldLast(into: number | null, value: number | null): number | null {
  if (value === null) return into;
  if (into === null) return value;
  return Math.max(into, value);
}

/**
 * Aggregate every login row of one import, one SOURCE at a time.
 *
 * Returns a complete {@link LoginAggregates}: the version, the geo id this
 * build aggregates under, the per-file presence facts, and every figure the
 * view shows. It never throws on data — an unreadable cell increments a counter
 * and the walk continues — so the ONE thing that can fail here is a bug, and
 * the caller wraps it in a try/catch that costs the user their import nothing
 * (T-04-03, restated for this channel).
 *
 * `account` is the `Account_Info.csv` row (D-02). It is stored UNCHANGED and
 * never counted: it is not a login, so it is not in `totalLogins`, not in a
 * country total, not in `unknown` and not in `other`. It is a parameter rather
 * than something this module reads so that the aggregate's account row is a
 * fact the WORKER asserts, not one a pure aggregator infers from a file it
 * does not own.
 */
export function buildLogins(
  sources: readonly LoginSource[],
  lookup: CountryLookup,
  account: AccountRecord | null = null,
): LoginAggregates {
  const filesSeen = { sessions: false, logins: false };
  // A Map, never an object: an address is a canonical string from a regex, so
  // it cannot be `__proto__` today, but the grouping key must not become a
  // property-name question if the parse ever widens.
  const counting = new Map<string, CountingAddress>();
  let unreadableRows = 0;
  let totalLogins = 0;
  let first: number | null = null;
  let last: number | null = null;
  let filesWithRows = 0;

  for (const source of sources) {
    // Presence is set per SOURCE, before the row loop: a header-only file
    // parses to zero rows, and a flag set inside the loop would report a file
    // that EXISTS as an export that has none.
    filesSeen[source.kind] = true;
    const columns = source.rows.length > 0 ? resolveLoginColumns(source.rows[0]!) : NO_COLUMNS;
    let contributed = false;

    for (const row of source.rows) {
      // A missing, blank, over-long or unparseable cell is COUNTED and nothing
      // else. The value itself is never stored, never echoed and never put in
      // a message (D-06, T-06-01, T-06-02).
      const parsed = parseIp(cell(row, columns.ip) ?? '');
      if (parsed === null) {
        unreadableRows += 1;
        continue;
      }
      contributed = true;
      totalLogins += 1;
      const stamp = parseSessionTimestamp(cell(row, columns.time));
      first = fold(first, stamp);
      last = foldLast(last, stamp);

      let entry = counting.get(parsed.canonical);
      if (entry === undefined) {
        entry = { parsed, logins: 0, first: null, last: null, games: new Set<string>() };
        counting.set(parsed.canonical, entry);
      }
      entry.logins += 1;
      entry.first = fold(entry.first, stamp);
      entry.last = foldLast(entry.last, stamp);
      // The token comes from the FILE NAME, never from a cell, so no untrusted
      // text can reach a table cell that shows a title (T-04-27). A source that
      // names no game — the legacy `Sessions.csv`, an invented `Logins.csv` —
      // contributes no token rather than a fabricated one.
      if (source.game !== null) entry.games.add(source.game);
    }
    if (contributed) filesWithRows += 1;
  }

  // The lookup runs ONCE PER DISTINCT ADDRESS, after the walk, over the parsed
  // form the walk already built. Per row it would be a lookup per session.
  //
  // It runs over EVERY distinct address, INCLUDING the ones past the cap: the
  // cap bounds what is STORED, and an address that is not listed is still an
  // address whose country is a fact about the export. Skipping the lookup for
  // the folded ones would be the cheapest possible code and the one that makes
  // the map undercount by exactly the amount the cap line describes (D-12).
  const unknown = { addresses: 0, logins: 0 };
  const byCountry = new Map<string, { logins: number; ips: number }>();
  for (const entry of counting.values()) {
    const cc = lookup(entry.parsed);
    entry.resolvedCc = cc;
    if (cc === null) {
      unknown.addresses += 1;
      unknown.logins += entry.logins;
      continue;
    }
    const rollup = byCountry.get(cc) ?? { logins: 0, ips: 0 };
    rollup.logins += entry.logins;
    rollup.ips += 1;
    byCountry.set(cc, rollup);
  }

  // The stored order: logins DESCENDING, then the NUMERIC address ascending
  // with every IPv4 before every IPv6 (D-05).
  //
  // `compareIp` and not a comparison of the canonical strings, and the
  // difference is not cosmetic: `9.0.0.0` sorts before `10.0.0.0` by value and
  // after it as text, and `::1` sorts after every IPv4 address rather than
  // wherever the digits happen to fall. `localeCompare` is excluded for the
  // Phase 4/5 reason — the order is STORED, and a locale-dependent one would
  // give two readers of one export two different tables.
  const ranked = [...counting.values()].sort((a, b) =>
    b.logins !== a.logins ? b.logins - a.logins : compareIp(a.parsed, b.parsed),
  );

  // The cap, applied to the RANKED list: the first MAX_LOGIN_IPS addresses in
  // the order the table displays are the ones kept, so a user reading the
  // table reads the same first rows whether or not there are more behind them.
  const listed = ranked.slice(0, MAX_LOGIN_IPS);
  const folded = ranked.slice(MAX_LOGIN_IPS);

  const addresses: LoginAddress[] = listed.map((entry) => ({
    ip: entry.parsed.canonical,
    cc: entry.resolvedCc ?? null,
    logins: entry.logins,
    first: entry.first,
    last: entry.last,
    games: [...entry.games].sort(),
  }));

  return {
    v: LOGINS_VERSION,
    geo: geoTableId(),
    filesSeen,
    filesWithRows,
    addresses,
    totalLogins,
    unreadableRows,
    // `unknown` and `countries` above were folded over EVERY resolved address,
    // listed or not — the recorded checkpoint outcome, and the reason
    // `sum(countries[].logins) + unknown.logins === totalLogins` holds at any
    // size. See MAX_LOGIN_IPS for the full set of relationships.
    unknown,
    countries: [...byCountry.entries()]
      .map(([cc, rollup]) => ({ cc, logins: rollup.logins, ips: rollup.ips }))
      .sort((a, b) => (b.logins !== a.logins ? b.logins - a.logins : a.cc < b.cc ? -1 : 1)),
    other: {
      addresses: folded.length,
      logins: folded.reduce((sum, entry) => sum + entry.logins, 0),
    },
    first,
    last,
    account,
  };
}

/**
 * Turn a stored aggregate into the view a query answers with.
 *
 * The two empty states are different SENTENCES about the user's own zip and
 * are never collapsed: `no-source` says the export carried no file this history
 * is built from, `no-usable` says the files were there and no row carried a
 * readable address. The second carries the unreadable count, because "nothing
 * to show" with no reason is the empty state this project has rejected since
 * Phase 3 D-10.
 *
 * The `ready` view carries the aggregate's data fields verbatim — same order,
 * same stored ranking — so the table and the stored record cannot disagree.
 */
export function viewFromLogins(aggregates: LoginAggregates): LoginsView {
  if (!aggregates.filesSeen.sessions && !aggregates.filesSeen.logins) {
    return { status: 'no-source' };
  }
  if (aggregates.totalLogins === 0) {
    return { status: 'no-usable', unreadable: aggregates.unreadableRows };
  }
  return {
    status: 'ready',
    filesWithRows: aggregates.filesWithRows,
    addresses: aggregates.addresses,
    totalLogins: aggregates.totalLogins,
    unreadableRows: aggregates.unreadableRows,
    unknown: aggregates.unknown,
    countries: aggregates.countries,
    other: aggregates.other,
    first: aggregates.first,
    last: aggregates.last,
    account: aggregates.account,
  };
}
