// =============================================================================
// Independent login-history oracle (phase 06, plan 06-03).
//
// WHAT THIS IS FOR
// `src/lib/features/logins/login-aggregate.ts` walks every row of every session
// file, keys a `Map` on a canonical address, folds a min and a max into it, and
// then sorts the result and slices it at a cap. Every one of those steps is
// compact, and every one of them is exactly the kind of shortcut that can be
// wrong in a way its own tests never notice — a test written beside the
// shortcut tends to reproduce the shortcut.
//
// So this module recomputes the same figures a deliberately naive way, and
// nothing here is allowed to import the implementation:
//
//   * the CSV is parsed by a CHARACTER-AT-A-TIME splitter, not by PapaParse;
//   * the timestamp is read with `Date.UTC` and validated by ROUND-TRIPPING it
//     through the platform `Date`, not by the project's own integer range
//     checks. A `2020-02-30` is refused here because `new Date` rolls it into
//     March and the fields no longer match, and the aggregator refuses it
//     because its own checker says so. Two mechanisms, one answer.
//   * the address ORDER is compared by splitting the canonical TEXT on `.` or
//     `:`, not by walking octets.
//   * the group key is NOT re-derived. It is read from the fixture's recorded
//     INTENDED spelling, so the one decision that matters most — which rows
//     are one address — is supplied rather than reproduced, and a bug in
//     canonicalisation cannot hide in both halves at once.
//
// The only two things this file is given are the spec (its text, and the
// intended spelling of each row) and a `countryOf` function the test supplies.
// `maxListed` is a PARAMETER rather than an import for the same reason: reading
// `MAX_LOGIN_IPS` from `src/` would make a wrong constant invisible.
//
// THE ONLY IMPORT IS NONE.
// `tests/helpers/session-oracle.ts` imports the seeded PRNG; this one does not,
// because it never generates anything — it only recomputes. Keep it that way.
// Do NOT "simplify" it to match the production code: it is useful only while it
// is able to disagree with the thing it checks.
// =============================================================================

import type { LoginsScaleSpec } from '../fixtures/logins-fixtures';

// -----------------------------------------------------------------------------
// The naive CSV reader
// -----------------------------------------------------------------------------

/**
 * Split ONE line into its cells, honouring double quotes and `;`.
 *
 * Written as an index walk rather than a `split`, because `split(';')` is
 * exactly the shortcut that breaks on a quoted cell — and two of the four
 * generated files are entirely quoted. A quoted cell may contain `;`, and this
 * reader says so; it is also the reason no generated cell may contain a double
 * quote, which `login-fixtures.test.ts` asserts.
 */
export function cells(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i <= line.length) {
    let value = '';
    if (line[i] === '"') {
      i += 1;
      while (i < line.length && line[i] !== '"') {
        value += line[i];
        i += 1;
      }
      i += 1; // the closing quote
    } else {
      while (i < line.length && line[i] !== ';') {
        value += line[i];
        i += 1;
      }
    }
    out.push(value);
    if (i >= line.length) return out;
    i += 1; // the delimiter
  }
  return out;
}

/** The lines of a file after its header, in order, with the terminator dropped. */
function dataLines(text: string): string[] {
  return text
    .split('\r\n')
    .slice(1)
    .filter((line) => line !== '');
}

// -----------------------------------------------------------------------------
// The naive timestamp reader
// -----------------------------------------------------------------------------

/** The real export's shape, DAY FIRST (T-04-28). */
const DOTTED_RE = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/;

/** The ISO shape, with no numeric offset: an offset is an instant (D-01). */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/;

/**
 * A stamp as wall-clock seconds, or null.
 *
 * Range checking is a ROUND TRIP: the fields go into `Date.UTC`, and the answer
 * is only accepted if every field reads back unchanged. That rejects
 * `2020-02-30`, `13.13.2019`, `24:00` and `23:60` without a table of month
 * lengths, and it is a different mechanism from the aggregator's explicit
 * checks, which is the point.
 */
export function oracleStamp(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const text = raw.trim();
  let year: number;
  let month: number;
  let day: number;
  let hour: number;
  let minute: number;
  let second: number;
  const dotted = DOTTED_RE.exec(text);
  const iso = dotted === null ? ISO_RE.exec(text) : null;
  if (dotted !== null) {
    day = Number(dotted[1]);
    month = Number(dotted[2]);
    year = Number(dotted[3]);
    hour = Number(dotted[4]);
    minute = Number(dotted[5]);
    second = 0;
  } else if (iso !== null) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
    hour = Number(iso[4]);
    minute = Number(iso[5]);
    second = Number(iso[6]);
  } else {
    return null;
  }
  const at = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    at.getUTCFullYear() !== year ||
    at.getUTCMonth() !== month - 1 ||
    at.getUTCDate() !== day ||
    at.getUTCHours() !== hour ||
    at.getUTCMinutes() !== minute ||
    at.getUTCSeconds() !== second
  ) {
    return null;
  }
  return at.getTime() / 1000;
}

// -----------------------------------------------------------------------------
// The naive address order
// -----------------------------------------------------------------------------

/**
 * Two canonical address strings, compared NUMERICALLY with every IPv4 first.
 *
 * From the TEXT, not from octets: a canonical IPv4 is four decimal groups and a
 * canonical IPv6 is eight lower-case hex groups, so this splits on `.` or `:`
 * and compares numbers. It shares no code with `compareIp` in `src/lib/geo/ip.ts`
 * and would disagree with it if that one ever compared the strings instead.
 */
export function oracleCompare(a: string, b: string): number {
  const aV6 = a.includes(':');
  const bV6 = b.includes(':');
  if (aV6 !== bV6) return aV6 ? 1 : -1;
  const left = a.split(aV6 ? ':' : '.').map((p) => (aV6 ? parseInt(p, 16) : Number(p)));
  const right = b.split(bV6 ? ':' : '.').map((p) => (bV6 ? parseInt(p, 16) : Number(p)));
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i]! - right[i]!;
  }
  return 0;
}

// -----------------------------------------------------------------------------
// The recomputation
// -----------------------------------------------------------------------------

/** The time columns, in the order the aggregator prefers them. */
const TIME_COLUMNS = ['STARTED_AT', 'SESSION_START', 'LOGIN_DT'];

/** One address while the oracle counts it. */
interface Counted {
  logins: number;
  first: number | null;
  last: number | null;
  games: Set<string>;
  cc: string | null;
}

/** What the caller supplies, none of it imported from `src/`. */
export interface OracleOptions {
  /** Resolves one canonical address to a country code, or null for unknown. */
  countryOf: (canonical: string) => string | null;
  /** How many addresses are LISTED. The rest are folded into `other`. */
  maxListed: number;
}

/** The figures the oracle expects the aggregate to hold. */
export interface OracleLogins {
  totalLogins: number;
  unreadableRows: number;
  filesWithRows: number;
  filesSeen: { sessions: boolean; logins: boolean };
  first: number | null;
  last: number | null;
  unknown: { addresses: number; logins: number };
  other: { addresses: number; logins: number };
  countries: { cc: string; logins: number; ips: number }[];
  addresses: {
    ip: string;
    cc: string | null;
    logins: number;
    first: number | null;
    last: number | null;
    games: string[];
    /**
     * Phase 10, D-18: always `[]` here, and that is a DERIVED value rather than
     * a convenience. Every source this oracle is fed is a scale fixture built
     * from `parseCsvFile`, which carries no account because a ROW has no owner —
     * so an oracle that invented a root here would be asserting something the
     * spec does not say. The field's presence is still worth the oracle, because
     * an implementation that emitted a root for an unstamped source would then
     * fail this comparison rather than pass unnoticed.
     */
    accounts: string[];
  }[];
}

/**
 * Recompute the whole aggregate from the spec, naively.
 *
 * The order of the passes is chosen so that each one is checkable against the
 * implementation's: read the files, count, resolve, RANK, then cap. The cap is
 * applied to the RANKED list, which is what makes the cut the same cut.
 */
export function oracleLogins(spec: LoginsScaleSpec, options: OracleOptions): OracleLogins {
  const counting = new Map<string, Counted>();
  let unreadableRows = 0;
  let totalLogins = 0;
  let first: number | null = null;
  let last: number | null = null;
  let filesWithRows = 0;
  const filesSeen = { sessions: false, logins: false };

  for (const file of spec.files) {
    filesSeen[file.game === null ? 'logins' : 'sessions'] = true;
    const header = cells(file.header);
    const keys = header.map((name) => name.trim().toUpperCase());
    const timeKey = TIME_COLUMNS.map((name) => keys.indexOf(name)).find((k) => k !== -1) ?? -1;

    const lines = dataLines(file.text);
    if (lines.length !== file.intended.length) {
      throw new Error(`${file.path}: ${lines.length} lines but ${file.intended.length} intended`);
    }

    let contributed = false;
    for (let i = 0; i < lines.length; i++) {
      const row = cells(lines[i]!);
      // The INTENDED spelling, not a re-parse: the group key is supplied, so a
      // canonicalisation bug can only ever be the implementation's.
      const canonical = file.intended[i] ?? null;
      if (canonical === null) {
        unreadableRows += 1;
        continue;
      }
      contributed = true;
      totalLogins += 1;

      const time = oracleStamp(timeKey === -1 ? undefined : row[timeKey]);
      if (time !== null) {
        first = first === null ? time : Math.min(first, time);
        last = last === null ? time : Math.max(last, time);
      }

      let entry = counting.get(canonical);
      if (entry === undefined) {
        entry = { logins: 0, first: null, last: null, games: new Set<string>(), cc: null };
        counting.set(canonical, entry);
      }
      entry.logins += 1;
      if (time !== null) {
        entry.first = entry.first === null ? time : Math.min(entry.first, time);
        entry.last = entry.last === null ? time : Math.max(entry.last, time);
      }
      if (file.game !== null) entry.games.add(file.game);
    }
    if (contributed) filesWithRows += 1;
  }

  // The lookup runs over EVERY distinct address, listed or not: the recorded
  // checkpoint outcome is that a cap bounds memory and not the truth.
  const unknown = { addresses: 0, logins: 0 };
  const byCountry = new Map<string, { logins: number; ips: number }>();
  for (const [ip, entry] of counting) {
    const cc = options.countryOf(ip);
    entry.cc = cc;
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

  const ranked = [...counting.entries()].sort((a, b) =>
    b[1].logins !== a[1].logins ? b[1].logins - a[1].logins : oracleCompare(a[0], b[0]),
  );
  const listed = ranked.slice(0, options.maxListed);
  const folded = ranked.slice(options.maxListed);

  return {
    totalLogins,
    unreadableRows,
    filesWithRows,
    filesSeen,
    first,
    last,
    unknown,
    other: {
      addresses: folded.length,
      logins: folded.reduce((sum, [, entry]) => sum + entry.logins, 0),
    },
    countries: [...byCountry.entries()]
      .map(([cc, rollup]) => ({ cc, logins: rollup.logins, ips: rollup.ips }))
      .sort((a, b) => (b.logins !== a.logins ? b.logins - a.logins : a.cc < b.cc ? -1 : 1)),
    addresses: listed.map(([ip, entry]) => ({
      ip,
      cc: entry.cc,
      logins: entry.logins,
      first: entry.first,
      last: entry.last,
      games: [...entry.games].sort(),
      // See the field's doc: these sources carry no owner, so the answer is no
      // owner, and the comparison is what says so.
      accounts: [],
    })),
  };
}
