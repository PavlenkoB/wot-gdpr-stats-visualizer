import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLogins,
  viewFromLogins,
  type LoginSource,
} from '../../../src/lib/features/logins/login-aggregate.ts';
import type {
  AccountRecord,
  LoginsView,
  LoginAddress,
  LoginCountryTotal,
} from '../../../src/lib/features/logins/login-shared.ts';
import {
  DEFAULT_LOGIN_SORT,
  EMPTY_LOGIN_TILES,
  LOGIN_COLUMNS,
  accountCells,
  buildLoginRows,
  displayIp,
  hasAccountRow,
  loginCells,
  loginTiles,
  nextSort,
  sortLoginRows,
  visibleLoginColumns,
  type LoginColumnKey,
  type LoginRow,
  type LoginSort,
} from '../../../src/lib/features/logins/login-model.ts';
import { lookupCountry } from '../../../src/lib/geo/country-lookup.ts';
import { countryName } from '../../../src/lib/geo/country-names.ts';
import {
  LOGIN_ACCOUNT_TAG,
  LOGIN_GAMES_NOT_RECORDED,
  LOGIN_HIDDEN_NOT_COUNTED,
  LOGIN_HIDDEN_NO_READABLE_DATE,
  LOGIN_NOT_IN_EXPORT,
  LOGIN_NOT_READABLE,
  LOGIN_NO_VALUE,
  LOGIN_UNKNOWN_COUNTRY,
  formatLoginDate,
  formatLoginDateRange,
  formatLoginShareLine,
  formatNumber,
} from '../../../src/lib/ui-copy.ts';
import {
  buildRealShapeCsv,
  type RealShapeRow,
} from '../../fixtures/playtime-real-shape-fixture.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import {
  LOGINS_HAND_KEY,
  LOGINS_IP_HOME,
  LOGINS_IP_THIRD,
  LOGINS_IP_WORK,
  LOGINS_WOT_ROWS,
  LOGINS_WOWS_ROWS,
  buildLoginsScaleSpec,
  compareCanonicalIp,
  type LoginsScaleSpec,
} from '../../fixtures/logins-fixtures.ts';
import { oracleLogins } from '../../helpers/login-oracle.ts';

// =============================================================================
// The login block's figures (06-08, Task 2)
//
// WHY THE MODEL AND NOT THE COMPONENT
// Vitest has no Svelte plugin and runs `environment: 'node'`
// (vitest.config.ts), so a component cannot be rendered here. What CAN be
// tested is the arithmetic every tile reads — and the arithmetic is where the
// failures this block can have live: a tie broken by the locale, an address
// counted twice, a country tile that disagrees with the map's total.
//
// WHY THE EXPECTATIONS ARE NOT READ BACK FROM THE IMPLEMENTATION
// The hand fixture's answer key was derived BY HAND from nine rows
// (`LOGINS_HAND_KEY`) and the 12,000-row fixture is checked against
// `login-oracle.ts`, which shares no primitive with the aggregator. A model
// test that built its expectation by calling `buildLogins` and comparing the
// result with itself would pass against a model that is wrong in every cell.
//
// The tie-break cases are the reason this file exists at all: at three
// addresses, "the address with the most logins" and "the first address with
// the most logins" are the same answer, so a tie has to be constructed to be
// tested.
// =============================================================================

// -----------------------------------------------------------------------------
// Instruments
// -----------------------------------------------------------------------------

/** The two hand files as the sources the aggregator reads. */
function handSources(rows: readonly RealShapeRow[] = LOGINS_WOT_ROWS): LoginSource[] {
  const csv = buildRealShapeCsv(rows);
  return [
    {
      kind: 'sessions',
      game: 'WOT',
      rows: parseCsvFile(csv, 'Activity_history', 'WOT_Game_Sessions.csv').rows.map((r) => r.data),
    },
  ];
}

function handSourcesBothFiles(): LoginSource[] {
  return [
    ...handSources(LOGINS_WOT_ROWS).map((s) => ({ ...s, game: 'WOT' as const })),
    ...handSources(LOGINS_WOWS_ROWS).map((s) => ({ ...s, game: 'WOWS' as const })),
  ];
}

/** The hand fixture's `ready` view, through the real aggregator and real table. */
const HAND_VIEW = viewFromLogins(buildLogins(handSourcesBothFiles(), lookupCountry));

/** A ready view built by hand, for the cases a fixture cannot reach. */
function readyView(overrides: {
  addresses?: LoginAddress[];
  countries?: LoginCountryTotal[];
  totalLogins?: number;
  filesWithRows?: number;
  first?: number | null;
  last?: number | null;
  unknown?: { addresses: number; logins: number };
  other?: { addresses: number; logins: number };
}): LoginsView {
  return {
    status: 'ready',
    filesWithRows: overrides.filesWithRows ?? 1,
    addresses: overrides.addresses ?? [],
    totalLogins: overrides.totalLogins ?? 0,
    unreadableRows: 0,
    unknown: overrides.unknown ?? { addresses: 0, logins: 0 },
    countries: overrides.countries ?? [],
    other: overrides.other ?? { addresses: 0, logins: 0 },
    first: overrides.first ?? null,
    last: overrides.last ?? null,
    account: null,
  };
}

function addressOf(ip: string, logins: number): LoginAddress {
  return { ip, cc: null, logins, first: null, last: null, games: [] };
}

/** A `nameOf` that answers from a map and null for anything absent. */
const namesOf = (map: Readonly<Record<string, string>>) => (cc: string) => map[cc] ?? null;

// -----------------------------------------------------------------------------
// The hand fixture
// -----------------------------------------------------------------------------

describe('loginTiles over the hand fixture', () => {
  const tiles = loginTiles(HAND_VIEW, namesOf({ DE: 'Germany', AU: 'Australia' }));

  it('is reached through a ready view at all (the whole block reads this)', () => {
    expect(HAND_VIEW.status).toBe('ready');
  });

  it('counts the answer key distinct addresses', () => {
    // Three readable addresses. The two unreadable rows — a blank cell and a
    // zero-padded octet — are counted nowhere (D-06), and the Account record
    // is not a login at all (D-02).
    expect(tiles.ips).toBe(LOGINS_HAND_KEY.addresses.length);
    expect(tiles.ips).toBe(3);
  });

  it('counts the answer key distinct countries, and the unknown bucket separately', () => {
    expect(tiles.countries).toBe(LOGINS_HAND_KEY.countries.length);
    expect(tiles.countries).toBe(2);
    expect(tiles.unknownIps).toBe(LOGINS_HAND_KEY.unknown.addresses);
  });

  it('names the answer key most-used address with its login count', () => {
    expect(tiles.topIp).toEqual({ ip: LOGINS_IP_HOME, logins: 3 });
  });

  it('names the answer key top country', () => {
    expect(tiles.topCountry).toEqual({ cc: 'DE', name: 'Germany', logins: 3 });
  });

  it('carries the answer key overall range as the seconds the formatter takes', () => {
    expect(tiles.first).toBe(LOGINS_HAND_KEY.first);
    expect(tiles.last).toBe(LOGINS_HAND_KEY.last);
  });

  it('counts every login row in the denominator of both share tiles', () => {
    expect(tiles.totalLogins).toBe(LOGINS_HAND_KEY.totalLogins);
    expect(tiles.totalLogins).toBe(7);
    // The two share tiles are formatted from the pair this model returns, and
    // the denominator is ALL counted logins — the same one the map summary
    // sentence uses (D-10), so the two percentages on screen agree.
    expect(formatLoginShareLine(tiles.topIp!.logins, tiles.totalLogins)).toBe('3 logins (43%)');
    expect(formatLoginShareLine(tiles.topCountry!.logins, tiles.totalLogins)).toBe(
      '3 logins (43%)',
    );
  });

  it('says the export lists logins in more than one file, because it does (D-01)', () => {
    // The hand fixture is TWO per-game session files, so the rows of both are
    // counted and the totals can exceed the account's real login count. The
    // note is what tells the reader why (RESEARCH Pitfall 11).
    expect(LOGINS_HAND_KEY.filesWithRows).toBe(2);
    expect(tiles.multiFile).toBe(true);
  });
});

// =============================================================================
// The SIX TILE VALUES, as the reader sees them
//
// The criteria above are the MODEL's figures. This block is the same six
// through the real formatters the component uses and the real `countryName`
// the block passes in — so "each tile shows the answer key's value" is asserted
// at the level this repository can reach without a browser, and a browser test
// that later disagrees with it is disagreeing with a number rather than with a
// formatter.
//
// `countryName` is the app's own resolver, not a map written here: the point is
// that the tile shows what the page will show, so replacing the resolver would
// have to change this test rather than silently repoint it.
// =============================================================================

describe('the six tile values for the hand fixture, as rendered', () => {
  const tiles = loginTiles(HAND_VIEW, countryName);

  it('shows the answer key three counts', () => {
    expect(formatNumber(tiles.ips)).toBe('3');
    expect(formatNumber(tiles.countries)).toBe('2');
    expect(formatNumber(tiles.unknownIps)).toBe('1');
  });

  it('shows the masked most-used address, and the full one once revealed', () => {
    expect(displayIp(tiles.topIp!, false)).toBe('192.0.2.xxx');
    expect(displayIp(tiles.topIp!, true)).toBe(LOGINS_IP_HOME);
  });

  it('shows the top country as its English name, whatever the viewer locale (D-11)', () => {
    expect(tiles.topCountry?.name).toBe('Germany');
  });

  it('shows the answer key date range, date-only and with no timezone shift (D-03)', () => {
    // 13.03.2019 20:00 to 21.06.2021 19:00 as the wall clock wrote them. The
    // formatter builds the day from integer arithmetic, so a viewer west of
    // UTC sees the same two dates the export recorded.
    expect(formatLoginDateRange(tiles.first, tiles.last)).toBe('2019-03-13 to 2021-06-21');
  });

  it('shows the same share on both share tiles', () => {
    expect(formatLoginShareLine(tiles.topIp!.logins, tiles.totalLogins)).toBe(
      formatLoginShareLine(tiles.topCountry!.logins, tiles.totalLogins),
    );
  });
});

// -----------------------------------------------------------------------------
// The tie-breaks
// -----------------------------------------------------------------------------

describe('loginTiles tie-breaks', () => {
  it('picks the numerically LOWER address when two hold the same logins', () => {
    // Given in the WRONG order on purpose: a model that read the first row
    // would answer the later address.
    const view = readyView({
      addresses: [addressOf(LOGINS_IP_THIRD, 2), addressOf(LOGINS_IP_WORK, 2)],
      totalLogins: 4,
    });
    expect(loginTiles(view, () => null).topIp).toEqual({ ip: LOGINS_IP_WORK, logins: 2 });
  });

  it('puts IPv4 before IPv6 in a tie, never the other way round', () => {
    const view = readyView({
      addresses: [addressOf('2001:db8::1', 2), addressOf(LOGINS_IP_HOME, 2)],
      totalLogins: 4,
    });
    expect(loginTiles(view, () => null).topIp).toEqual({ ip: LOGINS_IP_HOME, logins: 2 });
  });

  it('ignores the order the rows arrived in when one address simply has more', () => {
    const view = readyView({
      addresses: [addressOf(LOGINS_IP_THIRD, 1), addressOf(LOGINS_IP_WORK, 7)],
      totalLogins: 8,
    });
    expect(loginTiles(view, () => null).topIp).toEqual({ ip: LOGINS_IP_WORK, logins: 7 });
  });

  it('picks the lower ENGLISH NAME when two countries hold the same logins', () => {
    // `CH` sorts before `CL` in code-unit order and its name does not, so this
    // case tells a name tie-break from a code tie-break. It matters: the name
    // is the string the tile shows.
    const view = readyView({
      countries: [
        { cc: 'CH', logins: 2, ips: 1 },
        { cc: 'CL', logins: 2, ips: 1 },
      ],
      totalLogins: 4,
    });
    const nameOf = namesOf({ CH: 'Switzerland', CL: 'Chile' });
    expect(loginTiles(view, nameOf).topCountry).toEqual({ cc: 'CL', name: 'Chile', logins: 2 });
  });
});

// -----------------------------------------------------------------------------
// The null cases
// -----------------------------------------------------------------------------

describe('loginTiles null cases', () => {
  it('gives no top country when no address resolved to one (D-08)', () => {
    const view = readyView({ addresses: [addressOf(LOGINS_IP_HOME, 3)], totalLogins: 3 });
    const tiles = loginTiles(view, () => null);
    expect(tiles.topCountry).toBeNull();
    // And the unknown bucket is still counted, because a reader comparing the
    // Countries tile with the IPs tile needs to see where the difference went.
    expect(tiles.unknownIps).toBe(0);
    expect(tiles.ips).toBe(1);
  });

  it('gives no range when no row carried a usable timestamp', () => {
    const view = readyView({ addresses: [addressOf(LOGINS_IP_HOME, 3)], totalLogins: 3 });
    const tiles = loginTiles(view, () => null);
    expect(tiles.first).toBeNull();
    expect(tiles.last).toBeNull();
  });

  it('skips a country it cannot name rather than showing a winner with no name', () => {
    // The dash with its hidden `no known country` is for a view where NOTHING
    // resolved; a single unnameable code must not make the tile claim that.
    const view = readyView({
      countries: [
        { cc: 'ZZ', logins: 9, ips: 1 },
        { cc: 'DE', logins: 2, ips: 1 },
      ],
      totalLogins: 11,
    });
    expect(loginTiles(view, namesOf({ DE: 'Germany' })).topCountry).toEqual({
      cc: 'DE',
      name: 'Germany',
      logins: 2,
    });
  });

  it('counts capped addresses in the totals even though they are listed nowhere', () => {
    // `MAX_LOGIN_IPS` bounds MEMORY, not the truth: a tile that disagreed with
    // the stated totals is exactly what the cap line exists to prevent.
    const view = readyView({
      addresses: [addressOf(LOGINS_IP_HOME, 3)],
      other: { addresses: 40, logins: 97 },
      totalLogins: 100,
    });
    const tiles = loginTiles(view, () => null);
    expect(tiles.ips).toBe(41);
    expect(tiles.totalLogins).toBe(100);
  });

  it('answers the empty model for a view that is not ready, rather than throwing', () => {
    expect(loginTiles({ status: 'no-source' }, () => null)).toBe(EMPTY_LOGIN_TILES);
    expect(loginTiles({ status: 'no-usable', unreadable: 3 }, () => null)).toBe(EMPTY_LOGIN_TILES);
  });

  it('does not raise the multi-file note for a single-file export', () => {
    const view = readyView({ addresses: [addressOf(LOGINS_IP_HOME, 1)], filesWithRows: 1 });
    expect(loginTiles(view, () => null).multiFile).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// displayIp — the one function that chooses a displayed address (D-07)
// -----------------------------------------------------------------------------

describe('displayIp', () => {
  it('masks an IPv4 down to its first three octets', () => {
    expect(displayIp({ ip: LOGINS_IP_HOME }, false)).toBe('192.0.2.xxx');
  });

  it('masks an IPv6 down to its first three groups', () => {
    expect(displayIp({ ip: '2001:db8:0:0:0:0:0:1' }, false)).toBe(
      '2001:db8:0:xxxx:xxxx:xxxx:xxxx:xxxx',
    );
  });

  it('answers the full canonical address only when revealed', () => {
    expect(displayIp({ ip: LOGINS_IP_HOME }, true)).toBe(LOGINS_IP_HOME);
  });

  it('never echoes a non-address, revealed or not (D-21, T-06-13)', () => {
    // The stored value is canonical by construction, so this is the guard on
    // the guard: a cell holding an email cannot put it on the screen by being
    // masked, and the REVEALED branch returns the input rather than a slice.
    expect(displayIp({ ip: 'account@example.com' }, true)).toBe('account@example.com');
    expect(displayIp({ ip: 'account@example.com' }, false)).toBe('xxx');
  });
});

// -----------------------------------------------------------------------------
// The seeded 12,000-row export, against the INDEPENDENT oracle (D-17)
// -----------------------------------------------------------------------------

const SCALE: LoginsScaleSpec = buildLoginsScaleSpec();

function scaleSources(spec: LoginsScaleSpec): LoginSource[] {
  return spec.files.map((file) => ({
    kind: file.game === null ? ('logins' as const) : ('sessions' as const),
    game: file.game,
    rows: parseCsvFile(file.text, 'Activity_history', file.path.split('/').pop()!).rows.map(
      (r) => r.data,
    ),
  }));
}

/** Two addresses in five resolve to a country, so both buckets are populated. */
function scaleCountryOf(canonical: string): string | null {
  const value = canonical.slice(-1).charCodeAt(0);
  if (value % 5 !== 0) return null;
  return ['AA', 'BB', 'CC', 'DD'][value % 4]!;
}

describe('loginTiles over the seeded 12,000-row export', () => {
  const aggregates = buildLogins(scaleSources(SCALE), (ip) => scaleCountryOf(ip.canonical));
  const view = viewFromLogins(aggregates);
  const tiles = loginTiles(
    view,
    namesOf({ AA: 'Ayland', BB: 'Blaeland', CC: 'Coraland', DD: 'Delland' }),
  );

  it('is a view big enough for the claims to mean anything', () => {
    // Not a vacuous guard: every comparison below is over these numbers, and a
    // generator that quietly emitted 200 rows would make all of them trivial.
    expect(SCALE.rowCount).toBeGreaterThanOrEqual(10_000);
    expect(view.status).toBe('ready');
  });

  it('agrees with the oracle on the distinct addresses and the unknown bucket', () => {
    const oracle = oracleLogins(SCALE, {
      countryOf: scaleCountryOf,
      maxListed: aggregates.addresses.length,
    });
    expect(tiles.ips).toBe(oracle.addresses.length + oracle.other.addresses);
    expect(tiles.totalLogins).toBe(oracle.totalLogins);
    expect(tiles.unknownIps).toBe(oracle.unknown.addresses);
  });

  it('agrees with the oracle on the distinct countries', () => {
    const oracle = oracleLogins(SCALE, {
      countryOf: scaleCountryOf,
      maxListed: aggregates.addresses.length,
    });
    expect(tiles.countries).toBe(oracle.countries.length);
  });

  it('names the same most-used address the oracle ranks first', () => {
    const oracle = oracleLogins(SCALE, {
      countryOf: scaleCountryOf,
      maxListed: aggregates.addresses.length,
    });
    const first = oracle.addresses[0]!;
    expect(tiles.topIp).toEqual({ ip: first.ip, logins: first.logins });
    // Non-vacuous: at this size the winner has thousands of logins, so a model
    // that read the wrong row or counted unreadable ones could not land here.
    expect(tiles.topIp!.logins).toBeGreaterThan(1);
  });
});

// =============================================================================
// Source contracts
//
// A component cannot be rendered under this project's Vitest configuration, so
// the parts of the block that are MARKUP are tested by reading the source off
// disk — the technique `tests/unit/playtime-charts.test.ts` established in
// 04-09. Two rules keep it honest, and both are from that file: the file must
// be asserted to EXIST first, because an empty string contains no forbidden
// token and would pass vacuously; and comments are STRIPPED before any
// prohibition runs, because a comment explaining why a token is absent names
// the token.
// =============================================================================

const FEATURE_DIR = join(process.cwd(), 'src/lib/features/logins');

/** Every file in the feature, source and stylesheet together. */
function featureFiles(): string[] {
  return readdirSync(FEATURE_DIR).map((name) => join(FEATURE_DIR, name));
}

/** The file's text with every comment removed. */
function codeOf(path: string): string {
  const source = readFileSync(path, 'utf8');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * The same, for a file a test is asserting about.
 *
 * The existence check is an ASSERTION rather than a bare read, so a component
 * that has not been written yet fails as "this file does not exist" instead of
 * surfacing as an `ENOENT` from `readFileSync` — which is a load error, not a
 * statement about the behaviour under test.
 */
function codeOfRequired(path: string): string {
  expect(existsSync(path), `${path} does not exist`).toBe(true);
  return codeOf(path);
}

describe('the six tiles live in LoginSummary.svelte (06-08 Task 2)', () => {
  const path = join(FEATURE_DIR, 'LoginSummary.svelte');

  it('exists', () => {
    // The guard that makes every assertion below non-vacuous.
    expect(existsSync(path)).toBe(true);
  });

  it('declares the six tile test ids from the UI-SPEC section 3 table', () => {
    const code = codeOfRequired(path);
    for (const id of [
      'login-summary-counts',
      'login-tile-ips',
      'login-tile-countries',
      'login-tile-unknown',
      'login-summary-facts',
      'login-tile-top-ip',
      'login-tile-top-country',
      'login-tile-range',
    ]) {
      expect(code).toContain(id);
    }
  });

  it('takes its labels from ui-copy and inlines no sentence of its own', () => {
    const code = codeOfRequired(path);
    // Every tile label, plus the two hidden texts the dash values carry and the
    // share-line formatter the two share tiles read.
    for (const symbol of [
      'LOGIN_TILE_IPS',
      'LOGIN_TILE_COUNTRIES',
      'LOGIN_TILE_UNKNOWN',
      'LOGIN_TILE_TOP_IP',
      'LOGIN_TILE_TOP_COUNTRY',
      'LOGIN_TILE_RANGE',
      'LOGIN_HIDDEN_NO_KNOWN_COUNTRY',
      'LOGIN_HIDDEN_NO_READABLE_DATES',
      'LOGIN_NO_VALUE',
      'formatLoginShareLine',
      'formatLoginDateRange',
      'formatNumber',
    ]) {
      expect(code).toContain(symbol);
    }
  });

  it('shows the multi-file note from the model figure, between the two grids (D-01)', () => {
    const code = codeOfRequired(path);
    expect(code).toContain('LOGIN_MULTI_FILE_NOTE');
    // The condition is a VALUE from `loginTiles`, not an expression in a
    // template: no unit test in this repository can render a component, so a
    // condition written here would be a condition nothing could test.
    expect(code).toContain('tiles.multiFile');
    // And it sits between the two grids, because the UI-SPEC puts the note
    // UNDER THE COUNT TILES — a reader meets the number and the reason for it
    // before the prose tiles below.
    const counts = code.indexOf('data-testid="login-summary-counts"');
    // The note's TEST ID rather than its symbol: the symbol also appears in the
    // import block, which is above both grids and would make the ordering
    // assertion true for the wrong reason.
    const note = code.indexOf('data-testid="login-multi-file-note"');
    const facts = code.indexOf('data-testid="login-summary-facts"');
    expect(counts).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(counts);
    expect(facts).toBeGreaterThan(note);
  });

  it('reads its one address through displayIp rather than the raw value', () => {
    const code = codeOfRequired(path);
    expect(code).toContain('displayIp(');
    // The raw field is a property access on a tile, and it may only appear as
    // the argument of `displayIp` or of `nameOf`-free data the tile needs.
    expect(code).not.toMatch(/\{[^}]*\.topIp\.ip[^}]*\}/);
  });

  it('styles no motion and no inline style attribute (06-UI-SPEC section 8, 11)', () => {
    const code = codeOfRequired(path);
    expect(code).not.toMatch(/transition\s*:/);
    expect(code).not.toMatch(/animation\s*:/);
    expect(code).not.toMatch(/style="/);
  });
});

describe('the block mounts the summary and announces the mask (D-07)', () => {
  const path = join(FEATURE_DIR, 'LoginHistory.svelte');

  it('exists', () => {
    expect(existsSync(path)).toBe(true);
  });

  it('mounts LoginSummary in the ready state, with the figures and the one mask flag', () => {
    const code = codeOfRequired(path);
    expect(code).toContain('<LoginSummary');
    // The summary takes the model's figures and THIS block's single mask flag,
    // so there is no second mask anywhere in the feature to fall out of step.
    expect(code).toMatch(/<LoginSummary[^>]*\{tiles\}[^>]*\{revealed\}/);
  });

  it('announces the mask through the two ui-copy sentences, and never with an address', () => {
    const code = codeOfRequired(path);
    expect(code).toContain('MASK_ANNOUNCE_SHOWN');
    expect(code).toContain('MASK_ANNOUNCE_MASKED');
  });

  it('carries no aria-pressed on the reveal control (UI-SPEC section 3 Decision)', () => {
    const code = codeOfRequired(path);
    expect(code).not.toContain('aria-pressed');
  });
});

describe('the mask is never persisted (D-07, T-06-29)', () => {
  it('no file under the feature touches a storage API, a cookie or the URL', () => {
    // The whole rule in one scan: the mask is ONE rune for the block and
    // survives no reload, because nothing writes it anywhere. A feature that
    // grew a `localStorage` read would make a reloaded page start revealed.
    const forbidden = [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'history.pushState',
      'history.replaceState',
    ];
    for (const file of featureFiles()) {
      const code = codeOf(file);
      for (const token of forbidden) {
        expect(code, `${file} must not touch ${token}`).not.toContain(token);
      }
    }
  });

  it('has files to scan, so the scan above is not vacuous', () => {
    expect(featureFiles().length).toBeGreaterThan(0);
  });
});

// =============================================================================
// The IP table's model (06-10, Task 2)
//
// Every decision the table makes is a pure function here, so it is tested
// without a DOM: which way a header sorts, where a special value lands, what a
// cell says, and whether the pinned Account record row exists at all.
// =============================================================================

/** A row built by hand, with only the fields a case cares about. */
function rowOf(ip: string, overrides: Partial<LoginAddress> = {}, nameOf = namesOf({})): LoginRow {
  return buildLoginRows([{ ...addressOf(ip, 1), ...overrides }], nameOf)[0]!;
}

/** Rows from addresses, through the real builder. */
function rowsOf(addresses: LoginAddress[], nameOf = namesOf({})): LoginRow[] {
  return buildLoginRows(addresses, nameOf);
}

const ips = (rows: readonly LoginRow[]): string[] => rows.map((row) => row.ip);

describe('nextSort (06-10, UI-SPEC section 3 Sorting)', () => {
  it('opens on Logins, descending', () => {
    expect(DEFAULT_LOGIN_SORT).toEqual({ key: 'logins', dir: 'desc' });
  });

  it('starts logins, first and last descending', () => {
    const from: LoginSort = { key: 'ip', dir: 'asc' };
    for (const key of ['logins', 'first', 'last'] as const) {
      expect(nextSort(from, key)).toEqual({ key, dir: 'desc' });
    }
  });

  it('starts ip, country, games and city ascending', () => {
    for (const key of ['ip', 'country', 'games', 'city'] as const) {
      expect(nextSort(DEFAULT_LOGIN_SORT, key)).toEqual({ key, dir: 'asc' });
    }
  });

  it('flips the sorted column, both ways, and has no unsorted state', () => {
    expect(nextSort({ key: 'logins', dir: 'desc' }, 'logins')).toEqual({
      key: 'logins',
      dir: 'asc',
    });
    expect(nextSort({ key: 'logins', dir: 'asc' }, 'logins')).toEqual({
      key: 'logins',
      dir: 'desc',
    });
    expect(nextSort({ key: 'country', dir: 'desc' }, 'country')).toEqual({
      key: 'country',
      dir: 'asc',
    });
  });

  it('leaves the state alone for a key that is not a column', () => {
    expect(nextSort(DEFAULT_LOGIN_SORT, 'nonsense')).toBe(DEFAULT_LOGIN_SORT);
  });

  it('declares the seven columns with the UI-SPEC widths and first directions', () => {
    expect(
      LOGIN_COLUMNS.map((column) => [column.key, column.widthPx, column.firstDirection]),
    ).toEqual([
      ['ip', 160, 'asc'],
      ['country', 136, 'asc'],
      ['logins', 80, 'desc'],
      ['first', 104, 'desc'],
      ['last', 104, 'desc'],
      ['games', 136, 'asc'],
      ['city', 160, 'asc'],
    ]);
    // The six default columns sum to 720px, the UI-SPEC's own figure.
    expect(visibleLoginColumns(false).reduce((sum, column) => sum + column.widthPx, 0)).toBe(720);
    expect(visibleLoginColumns(false).map((column) => column.key)).not.toContain('city');
    expect(visibleLoginColumns(true).map((column) => column.key)).toContain('city');
  });
});

describe('sortLoginRows (06-10)', () => {
  it('sorts the hand fixture logins descending, ties by address ascending', () => {
    const rows = rowsOf(HAND_VIEW.status === 'ready' ? [...HAND_VIEW.addresses].reverse() : []);
    expect(ips(sortLoginRows(rows, DEFAULT_LOGIN_SORT))).toEqual([
      LOGINS_IP_HOME,
      LOGINS_IP_WORK,
      LOGINS_IP_THIRD,
    ]);
  });

  it('keeps the address tie-break ascending when the direction flips', () => {
    const rows = rowsOf([
      addressOf('10.0.0.2', 5),
      addressOf('10.0.0.1', 5),
      addressOf('10.0.0.3', 9),
    ]);
    expect(ips(sortLoginRows(rows, { key: 'logins', dir: 'asc' }))).toEqual([
      '10.0.0.1',
      '10.0.0.2',
      '10.0.0.3',
    ]);
    expect(ips(sortLoginRows(rows, { key: 'logins', dir: 'desc' }))).toEqual([
      '10.0.0.3',
      '10.0.0.1',
      '10.0.0.2',
    ]);
  });

  it('sorts the IP column numerically, so 192.0.2.9 comes before 192.0.2.10', () => {
    const rows = rowsOf([addressOf('192.0.2.10', 1), addressOf('192.0.2.9', 1)]);
    expect(ips(sortLoginRows(rows, { key: 'ip', dir: 'asc' }))).toEqual([
      '192.0.2.9',
      '192.0.2.10',
    ]);
    expect(ips(sortLoginRows(rows, { key: 'ip', dir: 'desc' }))).toEqual([
      '192.0.2.10',
      '192.0.2.9',
    ]);
  });

  it('puts IPv4 before IPv6 ascending, and the reverse descending', () => {
    const v6 = '2001:db8:0:0:0:0:0:1';
    const rows = rowsOf([addressOf(v6, 1), addressOf('255.255.255.255', 1)]);
    expect(ips(sortLoginRows(rows, { key: 'ip', dir: 'asc' }))).toEqual(['255.255.255.255', v6]);
    expect(ips(sortLoginRows(rows, { key: 'ip', dir: 'desc' }))).toEqual([v6, '255.255.255.255']);
  });

  it('sorts country, games and city by displayed text in CODE-UNIT order, never by locale', () => {
    // A locale collation puts `apple` before `Banana`; code units put `Banana`
    // first. The viewer's locale must not decide the order of the table.
    const names = namesOf({ AA: 'apple', BB: 'Banana' });
    const rows = rowsOf(
      [
        { ...addressOf('10.0.0.1', 1), cc: 'AA' },
        { ...addressOf('10.0.0.2', 1), cc: 'BB' },
      ],
      names,
    );
    expect(ips(sortLoginRows(rows, { key: 'country', dir: 'asc' }))).toEqual([
      '10.0.0.2',
      '10.0.0.1',
    ]);

    const games = rowsOf([
      { ...addressOf('10.0.0.1', 1), games: ['WOWS'] },
      { ...addressOf('10.0.0.2', 1), games: ['WOT'] },
      { ...addressOf('10.0.0.3', 1), games: ['WOTB'] },
    ]);
    // The DISPLAYED text: `Warships`, `WoT`, `WoT Blitz`.
    expect(ips(sortLoginRows(games, { key: 'games', dir: 'asc' }))).toEqual([
      '10.0.0.1',
      '10.0.0.2',
      '10.0.0.3',
    ]);
  });

  it('sorts first and last by the seconds they carry', () => {
    const rows = rowsOf([
      { ...addressOf('10.0.0.1', 1), first: 300, last: 100 },
      { ...addressOf('10.0.0.2', 1), first: 100, last: 300 },
      { ...addressOf('10.0.0.3', 1), first: 200, last: 200 },
    ]);
    expect(ips(sortLoginRows(rows, { key: 'first', dir: 'desc' }))).toEqual([
      '10.0.0.1',
      '10.0.0.3',
      '10.0.0.2',
    ]);
    expect(ips(sortLoginRows(rows, { key: 'last', dir: 'asc' }))).toEqual([
      '10.0.0.1',
      '10.0.0.3',
      '10.0.0.2',
    ]);
  });

  it('puts every special value last in BOTH directions', () => {
    const names = namesOf({ AA: 'Ayland' });
    const rows = rowsOf(
      [
        { ...addressOf('10.0.0.1', 1), cc: null, first: null, games: [] },
        { ...addressOf('10.0.0.2', 1), cc: 'AA', first: 50, games: ['WOT'] },
        { ...addressOf('10.0.0.3', 1), cc: 'AA', first: 60, games: ['WOWS'] },
      ],
      names,
    );
    for (const key of ['country', 'first', 'games'] as const) {
      for (const dir of ['asc', 'desc'] as const) {
        const sorted = sortLoginRows(rows, { key, dir });
        expect(sorted[sorted.length - 1]!.ip, `${key} ${dir}`).toBe('10.0.0.1');
      }
    }
  });

  it('treats a country the name function cannot name as Unknown country, last', () => {
    const rows = rowsOf(
      [
        { ...addressOf('10.0.0.1', 1), cc: 'ZZ' },
        { ...addressOf('10.0.0.2', 1), cc: 'AA' },
      ],
      namesOf({ AA: 'Ayland' }),
    );
    expect(ips(sortLoginRows(rows, { key: 'country', dir: 'desc' }))).toEqual([
      '10.0.0.2',
      '10.0.0.1',
    ]);
  });

  it('is pure and stable: the input is untouched and the answer is a new array', () => {
    const rows = rowsOf([addressOf('10.0.0.2', 1), addressOf('10.0.0.1', 1)]);
    const before = ips(rows);
    const sorted = sortLoginRows(rows, { key: 'logins', dir: 'desc' });
    expect(ips(rows)).toEqual(before);
    expect(sorted).not.toBe(rows);
    expect(ips(sortLoginRows(rows, { key: 'logins', dir: 'desc' }))).toEqual(ips(sorted));
  });
});

describe('loginCells (06-10, UI-SPEC section 3 Cell values)', () => {
  it('shows Unknown country, muted, for an address with no match', () => {
    const cells = loginCells(rowOf('10.0.0.1'), false);
    expect(cells.country).toMatchObject({ text: LOGIN_UNKNOWN_COUNTRY, muted: true });
  });

  it('shows the English name for a resolved country, with only that name as its title', () => {
    const row = rowOf('10.0.0.1', { cc: 'AA' }, namesOf({ AA: 'Ayland' }));
    const cells = loginCells(row, false);
    expect(cells.country).toMatchObject({ text: 'Ayland', muted: false, title: 'Ayland' });
  });

  it('groups the logins exactly', () => {
    expect(loginCells(rowOf('10.0.0.1', { logins: 12_345 }), false).logins.text).toBe(
      formatNumber(12_345),
    );
  });

  it('writes dates as YYYY-MM-DD and a dash with hidden text when unreadable', () => {
    const seconds = LOGINS_HAND_KEY.first;
    const row = rowOf('10.0.0.1', { first: seconds, last: null });
    const cells = loginCells(row, false);
    expect(cells.first.text).toBe(formatLoginDate(seconds));
    expect(cells.first.text).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cells.last).toMatchObject({
      text: LOGIN_NO_VALUE,
      muted: true,
      hidden: LOGIN_HIDDEN_NO_READABLE_DATE,
    });
  });

  it('lists the games in the fixed order, and reads not recorded, muted, for none', () => {
    const named = loginCells(rowOf('10.0.0.1', { games: ['WOWS', 'WOT', 'WOWP', 'WOTB'] }), false);
    expect(named.games.text).toBe('WoT, WoT Blitz, Warships, Warplanes');
    expect(named.games.title).toBe('WoT, WoT Blitz, Warships, Warplanes');
    const none = loginCells(rowOf('10.0.0.1', { games: [] }), false);
    expect(none.games).toMatchObject({ text: LOGIN_GAMES_NOT_RECORDED, muted: true });
  });

  it('masks an IPv6 address to its first three groups while masked, and shows it revealed', () => {
    const v6 = '2001:db8:0:1:2:3:4:5';
    const row = rowOf(v6);
    expect(loginCells(row, false).ip.text).toBe('2001:db8:0:xxxx:xxxx:xxxx:xxxx:xxxx');
    expect(loginCells(row, true).ip.text).toBe(v6);
  });

  it('never gives an IP cell a title, in either state, and no title ever holds an address', () => {
    const rowsToCheck = rowsOf(
      [
        { ...addressOf('192.0.2.10', 3), cc: 'AA', games: ['WOT'], first: 100, last: 200 },
        { ...addressOf('2001:db8:0:1:2:3:4:5', 2), cc: null, games: [] },
      ],
      namesOf({ AA: 'Ayland' }),
    );
    for (const row of rowsToCheck) {
      for (const revealed of [false, true]) {
        const cells = loginCells(row, revealed);
        expect(cells.ip.title).toBeNull();
        for (const cell of Object.values(cells)) {
          if (cell.title !== null) expect(cell.title).not.toContain(row.ip);
        }
      }
    }
  });

  it('declares a city cell for every row, a dash while no city source is wired', () => {
    expect(loginCells(rowOf('10.0.0.1'), false).city.text).toBe(LOGIN_NO_VALUE);
  });
});

describe('the pinned Account record row (06-10, D-02)', () => {
  const account = (overrides: Partial<AccountRecord> = {}): AccountRecord => ({
    ip: '198.51.100.77',
    ipState: 'readable',
    countryCode: 'PL',
    city: 'Krakow',
    ...overrides,
  });
  const names = namesOf({ PL: 'Poland' });

  it('exists for a readable or an unreadable address, and not for a blank one or none', () => {
    expect(hasAccountRow(account())).toBe(true);
    expect(hasAccountRow(account({ ip: null, ipState: 'unreadable' }))).toBe(true);
    expect(hasAccountRow(account({ ip: null, ipState: 'blank' }))).toBe(false);
    expect(hasAccountRow(null)).toBe(false);
  });

  it('follows the mask like every other address', () => {
    expect(accountCells(account(), false, names).ip.text).toBe('198.51.100.xxx');
    expect(accountCells(account(), true, names).ip.text).toBe('198.51.100.77');
  });

  it('shows an unreadable address as not readable, with no trace of what was there', () => {
    const cells = accountCells(account({ ip: null, ipState: 'unreadable' }), true, names);
    expect(cells.ip).toMatchObject({ text: LOGIN_NOT_READABLE, muted: true });
  });

  it('turns a two-letter recorded country into its English name, and shows anything else as written', () => {
    expect(accountCells(account({ countryCode: 'PL' }), false, names).country.text).toBe('Poland');
    expect(accountCells(account({ countryCode: 'pl' }), false, names).country.text).toBe('Poland');
    expect(accountCells(account({ countryCode: 'unknown' }), false, names).country.text).toBe(
      'unknown',
    );
    expect(accountCells(account({ countryCode: 'ZZ' }), false, names).country.text).toBe('ZZ');
    expect(accountCells(account({ countryCode: null }), false, names).country).toMatchObject({
      text: LOGIN_NOT_IN_EXPORT,
      muted: true,
    });
  });

  it('is never re-resolved: a recorded country the table would contradict is shown as recorded', () => {
    // 192.0.2.10 resolves to DE in the committed fixture table; the account
    // file says PL. Recorded wins (D-02, RESEARCH Open Question 2).
    const cells = accountCells(account({ ip: '192.0.2.10', countryCode: 'PL' }), true, (cc) =>
      cc === 'DE' ? 'Germany' : cc === 'PL' ? 'Poland' : null,
    );
    expect(cells.country.text).toBe('Poland');
  });

  it('reads a dash with hidden text for Logins, First seen and Last seen, and carries the tag', () => {
    const cells = accountCells(account(), false, names);
    for (const key of ['logins', 'first', 'last'] as const) {
      expect(cells[key]).toMatchObject({
        text: LOGIN_NO_VALUE,
        muted: true,
        hidden: LOGIN_HIDDEN_NOT_COUNTED,
      });
    }
    expect(cells.games.text).toBe(LOGIN_ACCOUNT_TAG);
    expect(cells.games.tag).toBe(true);
  });

  it('never shows an address-shaped recorded country or city, masked or revealed (D-07)', () => {
    for (const hostile of ['192.0.2.10', '2001:db8:0:1:2:3:4:5', 'home 192.0.2.10', '::1']) {
      for (const revealed of [false, true]) {
        const cells = accountCells(
          account({ countryCode: hostile, city: hostile }),
          revealed,
          names,
        );
        expect(cells.country, hostile).toMatchObject({ text: LOGIN_NOT_READABLE, muted: true });
        expect(cells.city, hostile).toMatchObject({ text: LOGIN_NOT_READABLE, muted: true });
      }
    }
    // A name with a space, an accent or a full stop is still shown as written.
    const named = accountCells(
      account({ countryCode: 'Côte d’Ivoire', city: 'St. Petersburg' }),
      false,
      names,
    );
    expect(named.country.text).toBe('Côte d’Ivoire');
    expect(named.city.text).toBe('St. Petersburg');
  });

  it('shows the recorded city as written, or not in export', () => {
    expect(accountCells(account({ city: 'Krakow' }), false, names).city.text).toBe('Krakow');
    expect(accountCells(account({ city: null }), false, names).city.text).toBe(LOGIN_NOT_IN_EXPORT);
  });
});

describe('sortLoginRows over the seeded export, against a naive reference (06-10)', () => {
  const aggregates = buildLogins(scaleSources(SCALE), (ip) => scaleCountryOf(ip.canonical));
  const view = viewFromLogins(aggregates);
  const names = namesOf({ AA: 'Ayland', BB: 'Blaeland', CC: 'Coraland', DD: 'Delland' });
  const rows = buildLoginRows(view.status === 'ready' ? view.addresses : [], names);

  /**
   * The reference: written from the rule's own words, with `compareCanonicalIp`
   * (a text-based comparator that shares no code with `compareIp`) as the
   * address order, and the specials-last rule applied by hand per key.
   */
  function reference(sort: LoginSort): string[] {
    const sign = sort.dir === 'asc' ? 1 : -1;
    const text = (row: LoginRow, key: LoginColumnKey): string | number | null => {
      switch (key) {
        case 'ip':
          return row.ip;
        case 'logins':
          return row.logins;
        case 'first':
          return row.first;
        case 'last':
          return row.last;
        case 'country':
          return row.country;
        case 'games':
          return loginCells(row, false).games.muted ? null : loginCells(row, false).games.text;
        case 'city':
          return null;
      }
    };
    return [...rows]
      .sort((a, b) => {
        const left = text(a, sort.key);
        const right = text(b, sort.key);
        if (sort.key === 'ip') {
          return sign * compareCanonicalIp(a.ip, b.ip);
        }
        if (left === null || right === null) {
          if (left !== null) return -1;
          if (right !== null) return 1;
        } else if (left !== right) {
          return (left < right ? -1 : 1) * sign;
        }
        return compareCanonicalIp(a.ip, b.ip);
      })
      .map((row) => row.ip);
  }

  it('is a table big enough for the claims to mean anything', () => {
    expect(rows.length).toBeGreaterThan(500);
    // Both buckets populated, so the specials-last rule has something to bite.
    expect(rows.some((row) => row.country === null)).toBe(true);
    expect(rows.some((row) => row.country !== null)).toBe(true);
  });

  for (const column of LOGIN_COLUMNS) {
    for (const dir of ['asc', 'desc'] as const) {
      it(`agrees with the reference for ${column.key} ${dir}`, () => {
        const sort: LoginSort = { key: column.key, dir };
        expect(ips(sortLoginRows(rows, sort))).toEqual(reference(sort));
      });
    }
  }

  it('parses each address once, when the rows are built, and not per comparison', () => {
    // A built row carries its parsed bytes, so a sort never calls parseIp.
    expect(rows.every((row) => row.parsed !== null)).toBe(true);
  });
});
