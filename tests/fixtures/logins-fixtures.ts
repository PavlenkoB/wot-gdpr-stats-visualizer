// =============================================================================
// The hand login fixture (phase 06, plan 06-01).
//
// WHAT THIS MIRRORS
// The STRUCTURE is the real Wargaming export inspected on 2021-10-12, the same
// one `playtime-real-shape-fixture.ts` reads: `Activity_history` holding
// per-game `<GAME>_Game_Sessions.csv` files, the three-column header
// `STARTED_AT;FINISHED_AT;IP`, CRLF terminators, and timestamps written
// `DD.MM.YYYY HH:MM` — dotted, DAY FIRST, to the minute, no zone, no seconds.
//
// The renderer is `buildRealShapeCsv` itself, not a copy of it, so the header
// line, the line terminator and the stamp shape are defined ONCE for both
// features (see the `ip` element it accepts).
//
// NO ROW CONTENT from that export is kept here or anywhere in this repo. Every
// date, duration and address below is fabricated, per `tests/fixtures/README.md`
// (fixture=synthetic), and all three addresses are RFC 5737 TEST-NET blocks:
// TEST-NET-1, TEST-NET-2 and TEST-NET-3. Per D-01 the login history is built
// from the per-game session files, so the invented `Activity_history/Logins.csv`
// and the synthetic `Sessions.csv` are OMITTED here — the fixture is the real
// shape, and the real 2021 export has no `Logins.csv` at all.
//
// WHY THREE ADDRESSES AND TWO UNREADABLE ROWS
//   - the HOME address appears in BOTH files, so its `games` set is two tokens
//     and its count is 3, which is what makes "the set of titles an address
//     appeared in" (D-01) observable at all;
//   - WORK and THIRD appear once per file, so each has 2 logins and 2 tokens;
//   - the tie between two addresses with the SAME count is what makes the
//     stored secondary ordering — logins descending, then address ASCENDING —
//     observable rather than incidental;
//   - the BLANK cell and the LEADING-ZERO cell are the two unreadable shapes
//     (D-06). The zero-padded one is the sharp case: `192.0.2.010` is
//     192.168.1.1-ish to a C library reading it as octal and nonsense to a
//     browser, so it is REJECTED rather than normalised to either reading.
//
// WHY THE ANSWER KEY IS COMPUTED HERE AND NOT READ BACK
// `wallSeconds` below converts a `DD.MM.YYYY HH:MM` stamp with the PLATFORM
// `Date.UTC`, while the aggregator it checks uses the project's own integer
// `daysFromCivil` arithmetic. Two instruments that share no primitive, exactly
// the independence claim `tests/helpers/session-oracle.ts` makes for playtime: a
// wrong hand number fails in Node in seconds rather than in a browser run hours
// later, and a bug in the civil-date arithmetic cannot hide behind itself.
// =============================================================================

import { buildCustomExport } from './export-fixtures.ts';
import { SAMPLE_BIRTH_DATE, SAMPLE_LOGIN, VARIANT_OVERFLOW_CANARY } from './export-fixtures.ts';
import { SAMPLE_ACCOUNT_ROOT } from './sample-account.ts';
import { mulberry32 } from './sessions-fixtures.ts';
import { buildRealShapeCsv, type RealShapeRow } from './playtime-real-shape-fixture.ts';
import type { LoginCountryTotal } from '../../src/lib/features/logins/login-shared.ts';

// -----------------------------------------------------------------------------
// The addresses
// -----------------------------------------------------------------------------

/** TEST-NET-1 (RFC 5737). The home address: three logins, across both files. */
export const LOGINS_IP_HOME = '192.0.2.10';

/** TEST-NET-2 (RFC 5737). Two logins, one per file. */
export const LOGINS_IP_WORK = '198.51.100.20';

/**
 * TEST-NET-3 (RFC 5737), last host of the `203.0.113.224/27` block that plan
 * 06-04's fixture table reserves as EXPLICIT UNKNOWN — no country entry covers
 * it, so it is the address that proves the unknown bucket is a real outcome
 * rather than an artefact of the two smaller blocks being unlisted.
 */
export const LOGINS_IP_THIRD = '203.0.113.230';

/** A cell that is blank: present, empty, unreadable (D-06). */
const BLANK_IP = '';

/** A cell with a zero-padded octet: rejected, never normalised (D-06). */
const PADDED_IP = '192.0.2.010';

// -----------------------------------------------------------------------------
// The rows, in the order the files write them
// -----------------------------------------------------------------------------

/**
 * `WOT_Game_Sessions.csv`.
 *
 *   1. 13.03.2019 20:00  HOME
 *   2. 13.03.2019 21:00  HOME   (a second, later login from the same address)
 *   3. 14.03.2019 23:30  WORK
 *   4. 03.11.2020 12:00  THIRD
 *   5. 04.11.2020 08:00  (blank)  UNREADABLE
 *   6. 05.11.2020 09:00  192.0.2.010 UNREADABLE (a padded octet is not an
 *      address; `inet_aton` would read the 010 as octal and silently produce a
 *      different host)
 */
export const LOGINS_WOT_ROWS: readonly RealShapeRow[] = [
  ['13.03.2019 20:00', '13.03.2019 21:30', LOGINS_IP_HOME],
  ['13.03.2019 21:00', '13.03.2019 22:00', LOGINS_IP_HOME],
  ['14.03.2019 23:30', '15.03.2019 00:30', LOGINS_IP_WORK],
  ['03.11.2020 12:00', '03.11.2020 12:30', LOGINS_IP_THIRD],
  ['04.11.2020 08:00', '04.11.2020 08:15', BLANK_IP],
  ['05.11.2020 09:00', '05.11.2020 09:05', PADDED_IP],
];

/**
 * `WOWS_Game_Sessions.csv`.
 *
 *   1. 13.03.2019 21:30  HOME   — the one row that makes HOME's `games` a SET
 *      of two rather than one, and that makes its first/last the two stamps on
 *      opposite sides of the WOT rows' last one.
 *   2. 20.06.2021 18:00  WORK
 *   3. 21.06.2021 19:00  THIRD  — the latest login in the export, so the
 *      overall `last` is this row's start and not the session's end.
 */
export const LOGINS_WOWS_ROWS: readonly RealShapeRow[] = [
  ['13.03.2019 21:30', '13.03.2019 23:00', LOGINS_IP_HOME],
  ['20.06.2021 18:00', '20.06.2021 18:20', LOGINS_IP_WORK],
  ['21.06.2021 19:00', '21.06.2021 19:10', LOGINS_IP_THIRD],
];

/**
 * The archive: the sample export with its two INVENTED `Activity_history` files
 * removed and the two real-shaped per-game files put in their place.
 *
 * Omitting rather than overriding `Sessions.csv` matters: the legacy file
 * carries a `SESSION_START` column and would contribute rows with no game
 * token, so leaving it in would make the answer key's per-address `games` sets
 * wrong in a way a reader could not see. `Logins.csv` is omitted for the same
 * reason — the real 2021 export has none (D-01).
 */
export function buildLoginsHandExport(): Uint8Array {
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides: {
      'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv(LOGINS_WOT_ROWS),
      'Activity_history/WOWS_Game_Sessions.csv': buildRealShapeCsv(LOGINS_WOWS_ROWS),
    },
  });
}

/** The most addresses {@link buildLoginsExportOfAddresses} accepts (minute field). */
const MAX_CHOSEN_ADDRESSES = 40;

/**
 * An archive whose `WOT_Game_Sessions.csv` holds exactly one row per CHOSEN
 * address, in the order given (plan 06-15, reused by plan 06-17).
 *
 * This is the one builder for tests that need to choose the address list: the
 * text of each IP cell is written verbatim, so a test can feed the parser any
 * spelling it likes through the real import path. `Sessions.csv` and
 * `Logins.csv` are omitted for the reason {@link buildLoginsHandExport} gives.
 *
 * Row N starts `13.03.2019 20:MM` and finishes `13.03.2019 21:MM`, with
 * MM = 10 + N, so every row is a distinct, valid session and the minute field
 * stays two digits for up to 40 addresses.
 */
export function buildLoginsExportOfAddresses(addresses: readonly string[]): Uint8Array {
  if (addresses.length > MAX_CHOSEN_ADDRESSES) {
    throw new Error(
      `buildLoginsExportOfAddresses: at most ${MAX_CHOSEN_ADDRESSES} addresses, got ${addresses.length}`,
    );
  }
  const rows: RealShapeRow[] = addresses.map((address, index) => {
    const minute = String(10 + index).padStart(2, '0');
    return [`13.03.2019 20:${minute}`, `13.03.2019 21:${minute}`, address];
  });
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides: { 'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv(rows) },
  });
}

// -----------------------------------------------------------------------------
// The answer key
// -----------------------------------------------------------------------------

/**
 * A `DD.MM.YYYY HH:MM` stamp as wall-clock seconds, via the PLATFORM clock.
 *
 * Deliberately a different instrument from the aggregator's: the aggregator
 * computes `daysFromCivil(y, m, d) * 86400 + …` with the project's own integer
 * arithmetic, and this uses `Date.UTC` with a zero-based month. A hand key
 * computed by calling the aggregator would be the aggregator agreeing with
 * itself, and would survive the exact bug it exists to catch.
 *
 * `Date.UTC` is UTC-BASED, which is what makes it the right independent check
 * and not a trap: the aggregator's "wall clock, no zone" reading and a UTC
 * reading of the same calendar fields are the same number, and neither is
 * shifted by the viewer's zone (D-03).
 */
export function wallSeconds(stamp: string): number {
  const match = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(stamp);
  if (match === null) throw new Error(`not a DD.MM.YYYY HH:MM stamp: ${stamp}`);
  return (
    Date.UTC(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4]),
      Number(match[5]),
    ) / 1000
  );
}

/** One address's expected row of the table. */
export interface LoginsHandAddress {
  ip: string;
  /**
   * The country the committed fixture table gives this address, or null for
   * the unknown bucket (D-08). It is part of the expected row rather than
   * omitted, because the table shows a country column and a test that left it
   * out would not notice the column going missing.
   *
   * 06-06 wired the table in. Each value below is read out of
   * `tests/fixtures/geo/country-fixture.csv` — the SAME committed source the
   * fixture table is built from — so the key is a fact about the data rather
   * than a copy of what the implementation answered. HOME sits in
   * `192.0.2.0/27`, which the fixture calls DE; WORK sits in
   * `198.51.100.0/27`, AU; and THIRD sits in `203.0.113.224/27`, the one
   * documentation block the fixture writes as an explicit `ZZ`, so it is the
   * unknown bucket and stays the address that proves the bucket is reachable
   * from a DOCUMENTATION address rather than only from a private range.
   */
  cc: string | null;
  logins: number;
  games: string[];
  first: number;
  last: number;
}

/** The whole expected aggregate, derived from the rows above by hand. */
export interface LoginsHandKey {
  totalLogins: number;
  unreadableRows: number;
  filesWithRows: number;
  first: number;
  last: number;
  unknown: { addresses: number; logins: number };
  countries: LoginCountryTotal[];
  other: { addresses: number; logins: number };
  addresses: LoginsHandAddress[];
}

/**
 * Every number the aggregate must produce, derived from the rows rather than
 * from the implementation.
 *
 * Counted by hand from {@link LOGINS_WOT_ROWS} and {@link LOGINS_WOWS_ROWS}:
 *
 *   - 9 rows, of which 2 are unreadable (a blank cell and a padded octet), so
 *     7 counted logins over 3 distinct addresses;
 *   - HOME holds rows W1, W2 and S1: 3 logins, tokens {WOT, WOWS}, first
 *     13.03.2019 20:00 (its earliest START) and last 13.03.2019 21:30 (the
 *     latest of its three starts — note this is the START column, never the
 *     session's end, so a five-hour session cannot move an address's `last`);
 *   - WORK holds W3 and S2: 2 logins, tokens {WOT, WOWS}, first
 *     14.03.2019 23:30, last 20.06.2021 18:00;
 *   - THIRD holds W4 and S3: 2 logins, tokens {WOT, WOWS}, first
 *     03.11.2020 12:00, last 21.06.2021 19:00;
 *   - the stored order is logins DESCENDING then address ASCENDING, so HOME
 *     leads, and WORK precedes THIRD because '198' sorts before '203';
 *   - the overall range opens at HOME's first and closes at THIRD's last, and
 *     the two unreadable rows contribute to NEITHER: their addresses were never
 *     read, so folding their stamps in would claim a first/last for an address
 *     that does not exist;
 *   - 06-06: the countries come from the committed fixture table. HOME is DE
 *     and WORK is AU, so `countries` holds those two in logins-descending
 *     order, and THIRD is the explicit unknown, leaving ONE address and TWO
 *     logins in the unknown bucket. The sum check the UI-SPEC rests on is
 *     therefore `3 + 2 + 2 === 7 === totalLogins`.
 */
export const LOGINS_HAND_KEY: LoginsHandKey = {
  totalLogins: 7,
  unreadableRows: 2,
  filesWithRows: 2,
  first: wallSeconds('13.03.2019 20:00'),
  last: wallSeconds('21.06.2021 19:00'),
  unknown: { addresses: 1, logins: 2 },
  countries: [
    { cc: 'DE', logins: 3, ips: 1 },
    { cc: 'AU', logins: 2, ips: 1 },
  ],
  other: { addresses: 0, logins: 0 },
  addresses: [
    {
      ip: LOGINS_IP_HOME,
      cc: 'DE',
      logins: 3,
      games: ['WOT', 'WOWS'],
      first: wallSeconds('13.03.2019 20:00'),
      last: wallSeconds('13.03.2019 21:30'),
    },
    {
      ip: LOGINS_IP_WORK,
      cc: 'AU',
      logins: 2,
      games: ['WOT', 'WOWS'],
      first: wallSeconds('14.03.2019 23:30'),
      last: wallSeconds('20.06.2021 18:00'),
    },
    {
      ip: LOGINS_IP_THIRD,
      cc: null,
      logins: 2,
      games: ['WOT', 'WOWS'],
      first: wallSeconds('03.11.2020 12:00'),
      last: wallSeconds('21.06.2021 19:00'),
    },
  ],
};

// =============================================================================
// The SCALE fixture and the over-cap generator (06-03, D-17, T-06-14)
//
// WHY A SECOND, BIGGER FIXTURE
// The hand fixture above is nine rows, and every number in it can be checked by
// reading it. That is exactly what makes it useless as a SCALE test: a wrong
// cap, a wrong tie order or a wrong fold is invisible at nine rows. So this
// adds a seeded 10,000-plus-row export, and a second generator that emits more
// distinct addresses than `MAX_LOGIN_IPS` so the cap is exercised by the REAL
// constant rather than by an injected override — a test that lowered the cap to
// 5 would prove the branch and not the bound.
//
// WHAT THE GENERATOR RECORDS, AND WHY THAT IS THE WHOLE POINT
// Every emitted row carries, beside its text, the canonical spelling it was
// INTENDED to have, or null when it was meant to be unreadable. That record is
// what `tests/helpers/login-oracle.ts` recomputes the aggregate from, with no
// import from `src/` at all. A fixture that only carried text would force the
// oracle to parse addresses too, and then the two would share the one mistake
// that matters most — the grouping key.
//
// THE ADDRESSES ARE DOCUMENTATION RANGES AND NOTHING ELSE (D-17)
//   - 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 (RFC 5737), hosts 1-254
//     so neither the network nor the broadcast address appears;
//   - 2001:db8::/32 (RFC 3849).
// `tests/unit/logins/login-fixtures.test.ts` asserts that EVERY emitted address
// lies inside one of the four, so a generator edit that reached for a real host
// would fail in Node rather than in a browser run.
//
// THE SHAPE IS THE REAL ONE, TWICE OVER
// WOT carries the real `DD.MM.YYYY HH:MM` stamp and the real three-column
// header; WOTB and WOWS carry the quoted ISO shape. One export therefore holds
// TWO date formats, which is the case the UI-SPEC's "timestamp unreadable or two
// formats in one export" row is about, and it is the only way a test can tell a
// day-first parse from a month-first one across a whole export.
//
// NOT A REAL EXPORT
// No row content from the 2021 export is used, per `tests/fixtures/README.md`
// (fixture=synthetic). Every date, address, user agent and country code below
// is fabricated.
// =============================================================================

/** The header an invented `Logins.csv` carries (06-RESEARCH Pattern 3). */
export const LOGINS_CSV_HEADER = 'LOGIN_DT;IP;COUNTRY_CODE;USER_AGENT';

/** The real per-game header, reused by the three generated session files. */
export const LOGINS_SESSION_HEADER = 'STARTED_AT;FINISHED_AT;IP';

/** One generated file: its exact text, and what each row was MEANT to be. */
export interface LoginsScaleFile {
  /** Archive-relative path, exactly as a `buildCustomExport` override key. */
  path: string;
  /** The game token the file NAME gives the worker, or null when it names none. */
  game: string | null;
  /** The header line, verbatim. */
  header: string;
  /** The whole file: the header, then one CRLF-terminated line per row. */
  text: string;
  /**
   * The canonical spelling each row was INTENDED to carry, or null when the row
   * was meant to be unreadable. Parallel to the lines of {@link text}.
   */
  intended: readonly (string | null)[];
}

/** A generated export: its files, and the totals an oracle must reproduce. */
export interface LoginsScaleSpec {
  files: readonly LoginsScaleFile[];
  /** Every row across every file, readable and not. */
  rowCount: number;
  /** Rows whose IP cell was meant to parse. */
  readableRows: number;
  /** Rows whose IP cell was meant to be refused. */
  unreadableRows: number;
  /** The distinct canonical addresses the readable rows carry. */
  distinctAddresses: number;
  /** Every distinct canonical address, ascending by numeric value. */
  addresses: readonly string[];
}

/** The seed, fixed: a failing scale case reproduces exactly on the next run. */
const SCALE_SEED = 0x0603_10;

/** The three documentation IPv4 blocks, as their first three octets. */
const IPV4_BLOCKS = ['192.0.2', '198.51.100', '203.0.113'] as const;

/** Host range inside each /24: 1 to 254, so neither .0 nor .255 ever appears. */
const HOST_MIN = 1;
const HOST_MAX = 254;

/**
 * `2001:db8:0:IIII:…:0:0` for one index, with `IIII` the index in hex.
 *
 * Three properties this shape is chosen for, each of which a test would
 * otherwise have to work around:
 *
 *   - The index occupies the FOURTH group, so two indices below 65,536 can
 *     never collide and the generator needs no set to keep them distinct.
 *   - The FIRST THREE groups are `2001:db8:0` for every address, so twenty
 *     thousand of them all MASK to the same string (D-06). That is D-05's "two
 *     rows can look identical once masked" at the size where it stops being an
 *     edge case.
 *   - The LAST TWO groups are always zero, so there is always a legal two-group
 *     run to compress — the generator can never emit a `::` that would stand
 *     for a group that is not there, which is the mistake a hand-written
 *     compressor makes and which a fixture that "looked fine" would hide.
 *
 * `IIII` is the low 16 bits of the index, so the numeric order of the generated
 * addresses is the order of the indices, and the over-cap cut lands exactly
 * where the arithmetic says it does.
 */
function documentationIpv6(index: number): string {
  const g3 = index & 0xffff;
  const g4 = (Math.imul(index, 0x9e3779b1) >>> 16) & 0xffff;
  const g5 = (Math.imul(index, 0x85ebca6b) >>> 0) & 0xffff;
  return `2001:db8:0:${[g3, g4, g5, 0, 0].map((g) => g.toString(16)).join(':')}`;
}

/**
 * Write one canonical IPv6 address in a NON-canonical spelling.
 *
 * The point of the spelling is that a reader of the CELL cannot tell it is not
 * canonical, and a reader of the TABLE sees one row. Three shapes, chosen by
 * `variant`, each a legal RFC 4291 text for the same sixteen bytes — and each
 * verified against {@link parseIp} by `login-fixtures.test.ts`, because a
 * "compression" that collapses groups which are not zero is a DIFFERENT address
 * wearing a compressed spelling's clothes, and the fixture would then disagree
 * with the aggregator for a reason that has nothing to do with either of them.
 */
function spellIpv6(canonical: string, variant: number): string {
  const groups = canonical.split(':');
  if (variant === 0) return canonical;
  if (variant === 1) return canonical.toUpperCase();
  if (variant === 2) {
    // The trailing run of zero groups, collapsed. `documentationIpv6` always
    // writes two of them, so the `::` here stands for exactly two.
    return `${groups.slice(0, 6).join(':')}::`;
  }
  // Zero-padded groups, which are legal text and NOT the canonical form.
  return groups.map((group) => group.padStart(4, '0')).join(':');
}

/**
 * A `DD.MM.YYYY HH:MM` stamp, DAY FIRST.
 *
 * `Date.UTC` with a zero-based month, the same instrument
 * {@link wallSeconds} uses and for the same reason: the fixture must not share
 * calendar arithmetic with the aggregator that reads it, or a bug in the
 * project own `daysFromCivil` would cancel out on both sides (T-04-28).
 */
function dottedStamp(seconds: number): string {
  const at = new Date(seconds * 1000);
  const dd = String(at.getUTCDate()).padStart(2, '0');
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mi = String(at.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${at.getUTCFullYear()} ${hh}:${mi}`;
}

/** The quoted ISO shape: `YYYY-MM-DDTHH:MM:SSZ`. */
function isoStamp(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(0, 19)}Z`.replace('T', 'T');
}

/** Every timestamp cell the generator writes that must NOT be readable. */
export const LOGINS_UNREADABLE_TIMESTAMPS: readonly string[] = [
  'not-a-date',
  '',
  '   ',
  '13.13.2019 20:00',
  '2020-02-30T00:00:00Z',
  'yesterday',
  '2019-03-13T24:00:00Z',
];

/** Every IP cell the generator writes that must NOT parse (D-06, T-06-13). */
export const LOGINS_UNREADABLE_IPS: readonly string[] = [
  '',
  '   ',
  '192.0.2.010',
  '192.0.2.256',
  'fe80::1%eth0',
  '[::1]',
  ':::',
  '1:2:3:4:5:6:7:8:9',
  '2001:db8:12345::1',
  '::ffff:192.0.2.010',
  'player@example.invalid',
  'Synthetic Player',
  '<script>alert(1)</script>',
  '<b>bold markup</b>',
  '192.0.2.1 and 192.0.2.2',
  '0xc0.0.2.10',
  '9'.repeat(200),
];

/** The generated `USER_AGENT` text, one of a fixed set. Never read, always present. */
const USER_AGENTS = ['Windows/10.0', 'Macintosh/14.2', 'Linux/6.1'] as const;

/** The country codes the generated `Logins.csv` records, as recorded text. */
const ACCOUNT_COUNTRIES = ['PL', 'DE', 'US', '', 'unknown'] as const;

/** How many distinct addresses the 10k fixture draws from. */
const SCALE_POOL_IPV4 = 600;
const SCALE_POOL_IPV6 = 300;

/** Rows per generated file. Sums to well over 10,000. */
const SCALE_ROWS = {
  wot: 5_000,
  wotb: 3_000,
  wows: 2_000,
  logins: 2_000,
} as const;

/** The window the generated stamps live in: 2018-01-01 to 2021-12-31. */
const STAMP_START = Date.UTC(2018, 0, 1) / 1000;
const STAMP_SPAN = Date.UTC(2022, 0, 1) / 1000 - STAMP_START;

/** One address the generator can write, with the spellings it may be written as. */
interface PoolAddress {
  /** What the aggregator must derive from any of the spellings below. */
  canonical: string;
  /** The cell texts that all mean this one address, plus one unreadable cell. */
  spellings: readonly string[];
}

/** The pool the 10k fixture draws from: documentation addresses and nothing else. */
function scalePool(): PoolAddress[] {
  const random = mulberry32(SCALE_SEED);
  const pool: PoolAddress[] = [];
  for (let block = 0; block < IPV4_BLOCKS.length; block++) {
    for (let i = 0; i < SCALE_POOL_IPV4 / IPV4_BLOCKS.length; i++) {
      const host = HOST_MIN + Math.floor(random() * (HOST_MAX - HOST_MIN + 1));
      const canonical = `${IPV4_BLOCKS[block]}.${host}`;
      pool.push({ canonical, spellings: [canonical, ` ${canonical} `] });
    }
  }
  for (let i = 0; i < SCALE_POOL_IPV6; i++) {
    // Offset well past the over-cap generator own indices so the two fixtures
    // never share an address and a test cannot pass by mixing them up.
    const canonical = documentationIpv6(100_000 + i);
    pool.push({
      canonical,
      spellings: [0, 1, 2, 3].map((variant) => spellIpv6(canonical, variant)),
    });
  }
  return pool;
}

/**
 * The row-count distribution: one dominant address and a long tail.
 *
 * The head is one address that carries roughly two rows in five, and the rest
 * share the remainder with weights falling as 1/(rank+1). That is what a real
 * login history looks like — a home address, a work address, a handful of
 * others and a long tail of one-offs — and it is the shape that makes the
 * `logins DESCENDING` order observable rather than incidental.
 */
function pickIndex(random: () => number, size: number): number {
  if (size === 0) return 0;
  if (random() < 0.4) return 0;
  // Inverse transform sampling of 1/(rank+1) over ranks 1..size-1.
  const u = random();
  const rank = Math.floor((size - 1) * (1 - Math.sqrt(1 - u * 0.999999))) + 1;
  return Math.min(size - 1, Math.max(1, rank));
}

/** One drawn row, before it is rendered into a file's own shape. */
interface DrawnRow {
  /**
   * The stamp exactly as it will be WRITTEN, or `null` to have one rendered
   * from `end`. Holding the text rather than a seconds number is what lets an
   * unreadable stamp exist at all.
   */
  start: string | null;
  /** The wall-clock second the session ENDS, used to render both stamps. */
  endSeconds: number;
  /** The IP cell exactly as it will be written. */
  ip: string;
  /** The canonical address it means, or null when the row is meant to be refused. */
  canonical: string | null;
}

/** Join one row's cells into a CSV line, quoting every cell when asked. */
function csvLine(cells: readonly string[], quoted: boolean): string {
  return cells.map((value) => (quoted ? `"${value}"` : value)).join(';');
}

/** A file's whole text: the header, then one CRLF-terminated line per row. */
function csvText(header: string, lines: readonly string[]): string {
  return header + '\r\n' + lines.map((line) => line + '\r\n').join('');
}

/**
 * The seeded 10,000-plus-row export.
 *
 * Twelve thousand rows over four files and nine hundred distinct addresses, one
 * of which carries two rows in five. Every address is a documentation range;
 * every cell is fabricated; every timestamp is derived from a fixed window with
 * the platform clock, so a wrong hand number in a test is reproducible.
 */
export function buildLoginsScaleSpec(): LoginsScaleSpec {
  const pool = scalePool();
  const random = mulberry32(SCALE_SEED ^ 0x5a5a);

  /**
   * Draw one file's worth of rows.
   *
   * One row in twenty carries a deliberately UNREADABLE address and one in
   * twenty-five a deliberately unreadable stamp, so both counters are non-zero
   * over the whole fixture rather than a handful of rows — which is the only
   * way an aggregate bug in the fold can show up as a wrong number.
   */
  const draw = (count: number): DrawnRow[] => {
    const rows: DrawnRow[] = [];
    for (let i = 0; i < count; i++) {
      const endSeconds = STAMP_START + Math.floor(random() * STAMP_SPAN);
      if (random() < 0.05) {
        rows.push({
          start: null,
          endSeconds,
          ip: LOGINS_UNREADABLE_IPS[Math.floor(random() * LOGINS_UNREADABLE_IPS.length)]!,
          canonical: null,
        });
        continue;
      }
      const address = pool[pickIndex(random, pool.length)]!;
      const unreadable = random() < 0.04;
      rows.push({
        start: unreadable
          ? LOGINS_UNREADABLE_TIMESTAMPS[
              Math.floor(random() * LOGINS_UNREADABLE_TIMESTAMPS.length)
            ]!
          : null,
        // A session is at least fifteen minutes, so the end is never the start.
        endSeconds: endSeconds + 900 + Math.floor(random() * 7_200),
        ip: address.spellings[Math.floor(random() * address.spellings.length)]!,
        canonical: address.canonical,
      });
    }
    return rows;
  };

  /** Render a file in the REAL shape: dotted stamps, bare cells, one header. */
  const dottedFile = (game: string, rows: readonly DrawnRow[]): LoginsScaleFile => ({
    path: `Activity_history/${game}_Game_Sessions.csv`,
    game,
    header: LOGINS_SESSION_HEADER,
    text: csvText(
      LOGINS_SESSION_HEADER,
      rows.map((row) =>
        csvLine(
          [row.start ?? dottedStamp(row.endSeconds - 900), dottedStamp(row.endSeconds), row.ip],
          false,
        ),
      ),
    ),
    intended: rows.map((row) => row.canonical),
  });

  /** Render a file in the QUOTED ISO shape: the same columns, another spelling. */
  const quotedFile = (game: string, rows: readonly DrawnRow[]): LoginsScaleFile => ({
    path: `Activity_history/${game}_Game_Sessions.csv`,
    game,
    header: LOGINS_SESSION_HEADER,
    text: csvText(
      LOGINS_SESSION_HEADER,
      rows.map((row) =>
        csvLine(
          [row.start ?? isoStamp(row.endSeconds - 900), isoStamp(row.endSeconds), row.ip],
          true,
        ),
      ),
    ),
    intended: rows.map((row) => row.canonical),
  });

  /** Render the invented `Logins.csv`: four columns, quoted, no game token. */
  const loginFile = (rows: readonly DrawnRow[]): LoginsScaleFile => ({
    path: 'Activity_history/Logins.csv',
    game: null,
    header: LOGINS_CSV_HEADER,
    text: csvText(
      LOGINS_CSV_HEADER,
      rows.map((row) =>
        csvLine(
          [
            row.start ?? isoStamp(row.endSeconds - 900),
            row.ip,
            ACCOUNT_COUNTRIES[Math.floor(random() * ACCOUNT_COUNTRIES.length)]!,
            USER_AGENTS[Math.floor(random() * USER_AGENTS.length)]!,
          ],
          true,
        ),
      ),
    ),
    intended: rows.map((row) => row.canonical),
  });

  const files = [
    dottedFile('WOT', draw(SCALE_ROWS.wot)),
    quotedFile('WOTB', draw(SCALE_ROWS.wotb)),
    quotedFile('WOWS', draw(SCALE_ROWS.wows)),
    loginFile(draw(SCALE_ROWS.logins)),
  ];

  let rowCount = 0;
  let readableRows = 0;
  let unreadableRows = 0;
  const addresses = new Set<string>();
  for (const file of files) {
    rowCount += file.intended.length;
    for (const canonical of file.intended) {
      if (canonical === null) unreadableRows += 1;
      else {
        readableRows += 1;
        addresses.add(canonical);
      }
    }
  }
  return {
    files,
    rowCount,
    readableRows,
    unreadableRows,
    distinctAddresses: addresses.size,
    addresses: [...addresses].sort(compareCanonicalIp),
  };
}

/**
 * Compare two canonical address strings NUMERICALLY, IPv4 before IPv6.
 *
 * A test-side comparator, written from the TEXT rather than from the
 * implementation: a canonical IPv4 is four decimal groups and a canonical IPv6
 * is eight lower-case hex groups, so splitting on `.` or `:` and comparing
 * numbers is a different piece of code from {@link compareIp} over octets. The
 * oracle uses its own copy of the same idea, on purpose.
 */
export function compareCanonicalIp(a: string, b: string): number {
  const aV6 = a.includes(':');
  const bV6 = b.includes(':');
  if (aV6 !== bV6) return aV6 ? 1 : -1;
  const left = a.split(aV6 ? ':' : '.').map((part) => (aV6 ? parseInt(part, 16) : Number(part)));
  const right = b.split(bV6 ? ':' : '.').map((part) => (bV6 ? parseInt(part, 16) : Number(part)));
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i]! - right[i]!;
  }
  return 0;
}

/**
 * Zip the scale fixture: the sample export with its two invented
 * `Activity_history` files removed and the four generated ones put in their
 * place.
 *
 * The same `omitFiles` the hand export uses, for the same reason: the sample's
 * own `Sessions.csv` carries a `SESSION_START` column and would contribute rows
 * with no game token, and the sample's own `Logins.csv` would contribute a
 * second set of logins the oracle never saw. A worker test over this archive and
 * a unit test over the same spec therefore describe ONE export.
 */
export function buildLoginsScaleExport(spec: LoginsScaleSpec): Uint8Array {
  const overrides: Record<string, string> = {};
  for (const file of spec.files) overrides[file.path] = file.text;
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides,
  });
}

/**
 * The over-cap fixture: more distinct addresses than `MAX_LOGIN_IPS` (06-03,
 * T-06-14).
 *
 * Every address appears exactly once except the first, which appears twice, so
 * the ranked order is the NUMERIC address order with one leader — which makes
 * the cut exact and checkable: the first `MAX_LOGIN_IPS` by value are listed and
 * the remainder is `20,500 - MAX_LOGIN_IPS`. Nothing here is injected to reach
 * the cap; the cap is the production constant and the archive is simply bigger
 * than it.
 *
 * The addresses are `2001:db8:0000:…` upwards, so all 20,500 rows MASK to the
 * same string. That is deliberate: it is the D-05 statement "two rows can look
 * identical once masked" at the size where looking at them becomes the normal
 * case rather than an edge.
 */
export function buildLoginsOverCapSpec(distinct: number): LoginsScaleSpec {
  const rows: { start: string; end: string; ip: string; canonical: string | null }[] = [];
  const intended: (string | null)[] = [];
  for (let i = 0; i < distinct; i++) {
    const canonical = documentationIpv6(i);
    const repeats = i === 0 ? 2 : 1;
    for (let r = 0; r < repeats; r++) {
      // A rotation through the three legal spellings, so the cap is exercised
      // over text the aggregator has to canonicalise rather than over a column
      // of already-canonical addresses.
      const start = STAMP_START + i * 600 + r;
      rows.push({
        start: dottedStamp(start),
        end: dottedStamp(start + 900),
        ip: spellIpv6(canonical, i % 4),
        canonical,
      });
      intended.push(canonical);
    }
  }
  const text =
    LOGINS_SESSION_HEADER +
    '\r\n' +
    rows.map((row) => `${row.start};${row.end};${row.ip}\r\n`).join('');
  const files: LoginsScaleFile[] = [
    {
      path: 'Activity_history/WOT_Game_Sessions.csv',
      game: 'WOT',
      header: LOGINS_SESSION_HEADER,
      text,
      intended,
    },
  ];
  const addresses = [...new Set(intended.filter((c): c is string => c !== null))].sort(
    compareCanonicalIp,
  );
  return {
    files,
    rowCount: rows.length,
    readableRows: rows.length,
    unreadableRows: 0,
    distinctAddresses: addresses.length,
    addresses,
  };
}

// =============================================================================
// The MERGED-SOURCE fixtures (06-05, D-01 + D-02)
//
// WHY A SECOND PAIR OF ARCHIVES
// The hand export above is session files ONLY, which is the real 2021 export's
// shape (D-01) and therefore the right fixture for everything 06-01 proved. It
// cannot prove the MERGE, because an export with nothing to merge in has one
// source however many rules the aggregator holds.
//
// These two add the other half:
//   - `buildLoginsMergedExport` — two per-game session files, an invented
//     `Logins.csv` and an `Account_Info.csv` of this phase's own, so all three
//     source kinds and the one labelled Account record are in play at once;
//   - `buildLoginsCsvOnlyExport` — the invented file and nothing else, which is
//     the only shape in which the login history IS the whole of
//     `Activity_history`'s addresses.
//
// THE ACCOUNT ADDRESS IS CHOSEN NOT TO APPEAR ANYWHERE ELSE
// That is the point of `ACCOUNT_RECORD_IP` living in its own documentation
// block: "the account record is never a login" is assertable by the address's
// ABSENCE from the address list, not by a total that would also come out right
// if the account row were counted and the Logins.csv's row were dropped.
//
// EVERY CELL IS SYNTHETIC
// No content from the 2021 export is used. Every address is an RFC 5737
// documentation range, every stamp is fabricated, and the `LOGIN`, `BIRTH_DATE`
// and overflow cells are the shared canaries `export-fixtures.ts` already
// exports — so "the strip holds" is assertable BY VALUE and not only by key.
// =============================================================================

/**
 * An address that appears ONLY in the invented `Logins.csv`.
 *
 * TEST-NET-3, inside the same block `LOGINS_IP_THIRD` uses and distinct from
 * it, so the two never collide in a fixture a test might sort.
 */
export const LOGINS_SOURCES_IP = '203.0.113.9';

/** The Account_Info address: TEST-NET-2, and in no session or login row. */
export const ACCOUNT_RECORD_IP = '198.51.100.77';

/** The account file's own country text — distinct from the Logins.csv's. */
export const ACCOUNT_RECORD_COUNTRY = 'PL';

export const ACCOUNT_RECORD_CITY = 'Krakow';

/**
 * The `Logins.csv`'s `COUNTRY_CODE` and `USER_AGENT`, which are never read.
 *
 * `XX` is a USER-ASSIGNED code that DB-IP never emits, and it is chosen
 * deliberately now that 06-06 wired the table in. The old value was `DE`, which
 * is what the committed fixture table gives `192.0.2.10` — so "the file's
 * country code never reaches the view" became untestable by string containment:
 * the view legitimately contains `DE` for a reason that has nothing to do with
 * the file. With `XX` the assertion is sharp again, and sharper than before:
 * the file claims `XX` for an address the table resolves to `CN`, so a leak
 * would show up as the wrong country rather than as an unmissable token.
 */
export const LOGINS_SOURCES_COUNTRY = 'XX';
export const LOGINS_SOURCES_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Synthetic Fixture)';

/**
 * The invented `Logins.csv`'s rows: one address seen only here, and one shared
 * with the session files — so the merge is observable as an ADD (logins) and a
 * UNION (games) rather than as two files that happen to hold different people.
 */
export const LOGINS_SOURCES_ROWS: readonly (readonly string[])[] = [
  ['2019-06-01 12:00:00', LOGINS_SOURCES_IP, LOGINS_SOURCES_COUNTRY, LOGINS_SOURCES_USER_AGENT],
  ['2020-02-02 10:30:00', LOGINS_IP_HOME, LOGINS_SOURCES_COUNTRY, 'Synthetic/1.0 Fixture'],
];

/**
 * `Account_Info.csv` with a header this phase owns, and a NINTH cell that
 * PapaParse puts in `__parsed_extra` — a bucket no column list can see into,
 * which is where the strongest canary belongs.
 */
const ACCOUNT_RECORD_HEADER = 'ID;NAME;CREATED_AT;IP;COUNTRY_CODE;CITY;LOGIN;BIRTH_DATE';
const ACCOUNT_RECORD_ROW: readonly string[] = [
  SAMPLE_ACCOUNT_ROOT,
  'Account Fixture Player',
  '2020-01-01 00:00:00',
  ACCOUNT_RECORD_IP,
  ACCOUNT_RECORD_COUNTRY,
  ACCOUNT_RECORD_CITY,
  SAMPLE_LOGIN,
  SAMPLE_BIRTH_DATE,
  VARIANT_OVERFLOW_CANARY,
];

/** One file's whole text: a leading CRLF, the header, one line per row. */
function withCrlf(header: string, rows: readonly (readonly string[])[]): string {
  let out = '\r\n' + header + '\r\n';
  for (const row of rows) out += '\r\n' + row.join(';') + '\r\n';
  return out;
}

/**
 * The three-source export: both per-game session files, the invented
 * `Logins.csv` and this phase's `Account_Info.csv`.
 *
 * The sample's own `Sessions.csv` and `Logins.csv` are OMITTED rather than
 * overridden, for the reason the hand export above omits them: they would
 * contribute rows the answer key never saw, and a reader of the numbers would
 * have no way to see that.
 */
export function buildLoginsMergedExport(): Uint8Array {
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides: {
      'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv(LOGINS_WOT_ROWS),
      'Activity_history/WOWS_Game_Sessions.csv': buildRealShapeCsv(LOGINS_WOWS_ROWS),
      'Activity_history/Logins.csv': withCrlf(LOGINS_CSV_HEADER, LOGINS_SOURCES_ROWS),
      'User_Info/Account_Info.csv': withCrlf(ACCOUNT_RECORD_HEADER, [ACCOUNT_RECORD_ROW]),
    },
  });
}

/**
 * The invented `Logins.csv` and NOTHING else under `Activity_history` — the
 * one shape in which the login history is the whole of the folder's addresses.
 *
 * The sample's `User_Info` is left in place, so this archive also carries the
 * sample's own account record: a rebuild over it must produce that record too,
 * which is a second thing the generalised reader has to get right besides the
 * login file itself.
 */
export function buildLoginsCsvOnlyExport(): Uint8Array {
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv'],
    overrides: { 'Activity_history/Logins.csv': withCrlf(LOGINS_CSV_HEADER, LOGINS_SOURCES_ROWS) },
  });
}

/**
 * The `Logins.csv` archive with its `User_Info` folder omitted entirely.
 *
 * The negative case for the Account record: no User_Info row means no record at
 * all, which is a different fact from a row whose address cell is blank — and
 * the Phase 3 D-16 identity fallback fires in the same import, so one archive
 * proves the two paths are independent.
 */
export function buildLoginsCsvOnlyExportWithoutUserInfo(): Uint8Array {
  return buildCustomExport({
    omitFolders: ['User_Info'],
    omitFiles: ['Activity_history/Sessions.csv'],
    overrides: { 'Activity_history/Logins.csv': withCrlf(LOGINS_CSV_HEADER, LOGINS_SOURCES_ROWS) },
  });
}

/**
 * Both source kinds present and BOTH of them header-only (06-05).
 *
 * The two emptiness questions this separates, and they are different sentences
 * about the user's own zip (Phase 3 D-10, restated for this channel):
 *
 *   - `no-source` — the export carries no file this history is built from;
 *   - `no-usable` — the files WERE there and no row carried a readable address.
 *
 * A file's presence is recorded BEFORE its row loop, precisely because a
 * header-only file parses to zero rows and a flag set inside the loop would
 * report a file that EXISTS as an export that has none. This archive is the
 * only way to reach that state: any row anywhere would make it `ready`.
 */
export function buildHeaderOnlyLoginsExport(): Uint8Array {
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides: {
      'Activity_history/WOT_Game_Sessions.csv': withCrlf(LOGINS_SESSION_HEADER, []),
      'Activity_history/Logins.csv': withCrlf(LOGINS_CSV_HEADER, []),
    },
  });
}

/**
 * The invented `Logins.csv` with NO session file beside it and a header that
 * names only the two columns the aggregator reads.
 *
 * Its point is the T-06-20 boundary in its STRICTEST form: a file whose every
 * other column is gone cannot leak through one, so a leak in the three-source
 * fixture can only be coming from a column this build resolved wrongly rather
 * than from a value that happened to be shared with the account record.
 */
export function buildLoginsMinimalColumnsExport(): Uint8Array {
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv'],
    overrides: {
      'Activity_history/Logins.csv': withCrlf('LOGIN_DT;IP', [
        [LOGINS_SOURCES_ROWS[0]![0]!, LOGINS_SOURCES_IP],
        [LOGINS_SOURCES_ROWS[1]![0]!, LOGINS_IP_HOME],
      ]),
    },
  });
}
