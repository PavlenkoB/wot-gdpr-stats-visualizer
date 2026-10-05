import { compareIp, maskIp, parseIp, type ParsedIp } from '../../geo/ip.ts';
import {
  LOGIN_ACCOUNT_TAG,
  LOGIN_CITY_UNKNOWN,
  LOGIN_COL_CITY,
  LOGIN_COL_COUNTRY,
  LOGIN_COL_FIRST,
  LOGIN_COL_GAMES,
  LOGIN_COL_IP,
  LOGIN_COL_LAST,
  LOGIN_COL_LOGINS,
  LOGIN_GAMES_NOT_RECORDED,
  LOGIN_HIDDEN_NOT_COUNTED,
  LOGIN_HIDDEN_NO_READABLE_DATE,
  LOGIN_NOT_IN_EXPORT,
  LOGIN_NOT_READABLE,
  LOGIN_NO_VALUE,
  LOGIN_UNKNOWN_COUNTRY,
  formatGames,
  formatLoginDate,
  formatNumber,
} from '../../ui-copy.ts';
import type { CityPlace, CityView } from './city-shared.ts';
import type { AccountRecord, LoginAddress, LoginsView } from './login-shared.ts';

// =============================================================================
// The Login history block's figures, as pure functions (06-08).
//
// ## What this module holds, and what it deliberately does not
//
// It holds the ONE decision the masking promise rests on (`displayIp`), the
// arithmetic behind the six summary tiles (`loginTiles`) and, since 06-10, the
// table's column definitions, row views and cell text. It holds no `Intl`: the
// country NAME is supplied by the caller as a `nameOf` function, and every
// sentence and formatter is `ui-copy`'s. Since 06-10 the table cells are
// composed here from those exports, because a cell's text is a decision (which
// special value, which order) that has to be testable without a DOM.
//
// That is the same split `playtime-model.ts` states for itself (04-05) and the
// reason it is a module rather than a `const` inside the component: a state
// test is not where wording is verified, and a wording test is not where
// arithmetic is verified.
//
// ## Why `nameOf` is a PARAMETER
//
// `countryName` (06-06) is main-thread safe by design, but taking it as a
// parameter keeps this file free of `Intl` and lets a unit test name countries
// without depending on the platform's CLDR build. Two consequences, both
// wanted:
//
//   - the top-country tie-break is by English NAME, which is what the UI-SPEC
//     asks for, and the name is the same string the tile will display, so the
//     tie-break can never disagree with what the reader sees;
//   - a country whose name cannot be produced is not skipped silently — it is
//     simply not a candidate, because a tile showing a dash for a country that
//     does have logins would be a false statement.
//
// ## Why the shares are NOT computed here
//
// The share of a count is one rule for the whole app (whole percent, with the
// Phase 4 under-half-percent rule) and `ui-copy`'s `formatSharePercent` is its
// one implementation. Computing a second one here would be the exact defect
// that rule exists to prevent: `0%` beside a non-zero count in one tile and
// `<1%` in another. So `loginTiles` returns the COUNT and the DENOMINATOR, and
// the component formats the pair.
// =============================================================================

/**
 * The one function in this app that decides which address string is displayed
 * (D-07).
 *
 * ## The invariant it exists to make unbreakable
 *
 * While masked, no unmasked address may exist ANYWHERE: not in the DOM text,
 * not in an attribute, not in the accessibility tree, not in the selection and
 * not in the document title. The only way to guarantee that is to make the DOM
 * hold exactly the string being displayed — never a hidden second copy that a
 * CSS rule reveals. So there is one function, it takes the reveal flag as an
 * argument, and every surface (the table cells, the Most-used tile, the Account
 * record row, a later tooltip) calls it rather than choosing for itself.
 *
 * `maskIp` (06-04) is the masked form: an IPv4 keeps its first three octets,
 * an IPv6 its first three groups, and anything that is not exactly a canonical
 * address answers the fixed text `xxx` rather than echoing its input — which is
 * why a cell holding an email address cannot put that address on the screen by
 * being masked (D-21, T-06-13).
 *
 * The `revealed` branch returns the stored canonical string and nothing else.
 * It is not a second mask and not a re-spelling: the view carries the address
 * the worker resolved, and the reveal needs no round trip because the answer
 * carries full addresses in memory (06-UI-SPEC, Trust Boundaries).
 */
export function displayIp(address: { ip: string }, revealed: boolean): string {
  return revealed ? address.ip : maskIp(address.ip);
}

/** One fact tile's value, before it is formatted. */
export interface LoginTileFacts {
  /** Every figure the six tiles render, in the order they are laid out. */
  readonly ips: number;
  readonly countries: number;
  readonly unknownIps: number;
  readonly totalLogins: number;
  /**
   * The address with the most logins, or null when there is none.
   *
   * `logins` is the COUNT, and the share is `logins / totalLogins` — the
   * component formats the pair through `formatLoginShareLine`, so the
   * denominator is the same one the Top country tile and the map summary use and
   * the two percentages on screen cannot disagree (D-10).
   */
  readonly topIp: { readonly ip: string; readonly logins: number } | null;
  /** The country with the most logins and a name, or null when none has one. */
  readonly topCountry: {
    readonly cc: string;
    readonly name: string;
    readonly logins: number;
  } | null;
  /**
   * The earliest and latest usable wall-clock second, as the NUMBERS the
   * formatter takes.
   *
   * Seconds, not a formatted range, because the range wording (`a to b`, or
   * `a` when they are the same day) is `ui-copy`'s and the null case is a dash
   * the COMPONENT chooses; a formatter here would make two places responsible
   * for the same decision.
   */
  readonly first: number | null;
  readonly last: number | null;
  /**
   * Whether the note explaining the totals belongs on screen (D-01, RESEARCH
   * Pitfall 11).
   *
   * True when more than one FILE contributed counted rows. A login is one
   * session row and the rows of `Logins.csv` and of the session files are BOTH
   * counted, without de-duplication, so on such an export the totals can exceed
   * the account's real login count. The note says so, and it is shown only
   * then: an export with one session file has nothing to explain.
   *
   * A BOOLEAN rather than the raw `filesWithRows`, because the question the
   * component asks is "does the note belong here", not "how many files were
   * there" — and because a condition in a template is a condition no unit test
   * in this repository can reach (there is no Svelte plugin under Vitest).
   */
  readonly multiFile: boolean;
}

/** The empty tile model, for a view that is not `ready`. */
export const EMPTY_LOGIN_TILES: LoginTileFacts = {
  ips: 0,
  countries: 0,
  unknownIps: 0,
  totalLogins: 0,
  topIp: null,
  topCountry: null,
  first: null,
  last: null,
  multiFile: false,
};

/**
 * Compare two canonical addresses the way the aggregate RANKS them: numerically
 * by octet or group, IPv4 before IPv6.
 *
 * The same rule `login-aggregate.ts` sorts its stored array with, and the same
 * one `compareCanonicalIp` re-derives in the test fixtures. Spelling it out
 * here rather than reading `addresses[0]` is deliberate: it means the tile's
 * winner is decided by a rule this file states, and a hand-built view in a unit
 * test can be given an arbitrary order and still produce the documented answer.
 *
 * The two orders agree in practice — the stored array is already
 * logins-descending then this comparison — so the tile and the table (plan
 * 06-10) can never name different addresses for the same dataset.
 */
function compareAddresses(a: string, b: string): number {
  const left = parseIp(a);
  const right = parseIp(b);
  if (left === null || right === null) return a < b ? -1 : a > b ? 1 : 0;
  return compareIp(left, right);
}

/**
 * The six summary tiles' figures, from a `ready` view (D-04, D-08).
 *
 * A view that is not `ready` answers {@link EMPTY_LOGIN_TILES}, so a caller
 * cannot render a tile against a view that carries no figures. The component
 * does not render the tiles in that state anyway; this is what keeps a
 * hand-built call from throwing inside a render.
 *
 * Three decisions are made here rather than in the component, and each is a
 * tie-break the UI-SPEC fixes:
 *
 *   - **The most-used address.** Most logins wins; a tie takes the
 *     numerically lower canonical address, IPv4 before IPv6. Never the
 *     locale, and never the order the rows happened to arrive in.
 *   - **The top country.** Most logins wins; a tie takes the LOWER ENGLISH
 *     NAME in plain code-unit order, because the name is the string the tile
 *     shows and a tie broken on the two-letter code could order two countries
 *     the reader sees the other way round. A country `nameOf` cannot name is
 *     not a candidate: the tile's contract is to show a name, and the dash
 *     with its hidden text is for a view where NO country resolved.
 *   - **The date range.** The view's own `first` and `last`, which the
 *     aggregator took over every address and which deliberately EXCLUDE rows
 *     whose timestamp could not be read.
 *
 * The counts are of LOGIN ROWS only, never the Account record (D-02): the
 * account's own address is not a login the export recorded, so it is in
 * neither the `ips` tile nor any denominator. Addresses the aggregate's cap
 * folded away are still COUNTED here — `MAX_LOGIN_IPS` bounds memory, not the
 * truth, and a tile that disagreed with the stated totals is the failure
 * `06-01` recorded the cap line to prevent.
 */
export function loginTiles(
  view: LoginsView,
  nameOf: (cc: string) => string | null,
): LoginTileFacts {
  if (view.status !== 'ready') return EMPTY_LOGIN_TILES;

  let topIp: LoginTileFacts['topIp'] = null;
  for (const address of view.addresses) {
    if (topIp === null || address.logins > topIp.logins) {
      topIp = { ip: address.ip, logins: address.logins };
    } else if (address.logins === topIp.logins && compareAddresses(address.ip, topIp.ip) < 0) {
      topIp = { ip: address.ip, logins: address.logins };
    }
  }

  let topCountry: LoginTileFacts['topCountry'] = null;
  for (const country of view.countries) {
    const name = nameOf(country.cc);
    // A country with no name is not a candidate, not a winner with a null name
    // to render later: `LOGIN_HIDDEN_NO_KNOWN_COUNTRY` is for a view where
    // nothing resolved, and it would be false here.
    if (name === null) continue;
    if (
      topCountry === null ||
      country.logins > topCountry.logins ||
      (country.logins === topCountry.logins && name < topCountry.name)
    ) {
      topCountry = { cc: country.cc, name, logins: country.logins };
    }
  }

  return {
    ips: view.addresses.length + view.other.addresses,
    countries: view.countries.length,
    unknownIps: view.unknown.addresses,
    totalLogins: view.totalLogins,
    topIp,
    topCountry,
    first: view.first,
    last: view.last,
    multiFile: view.filesWithRows >= 2,
  };
}

// =============================================================================
// The IP table (06-10, D-05)
// =============================================================================

/** The table's column keys, which are also the `login-sort-{key}` test hooks. */
export type LoginColumnKey = 'ip' | 'country' | 'logins' | 'first' | 'last' | 'games' | 'city';

/** One column of the table: its key, its header text, and its geometry. */
export interface LoginColumn {
  readonly key: LoginColumnKey;
  /** The header text, from the frozen copy inventory. */
  readonly label: string;
  /** The CSS class that declares the width, because no inline style is allowed. */
  readonly widthClass: string;
  /** The same width in pixels: the table's minimum width is their sum. */
  readonly widthPx: number;
  /** Numbers sit on the right, everything else on the left. */
  readonly align: 'left' | 'right';
  /** The direction the first click on this column sorts by. */
  readonly firstDirection: 'asc' | 'desc';
}

/**
 * The seven column definitions, widths from the UI-SPEC spacing exceptions.
 *
 * The six default columns sum to 720px against a 638px card, so the table
 * scrolls sideways inside its scroller by design. `city` is declared here and
 * left out of {@link visibleLoginColumns} until city detail has been loaded.
 */
export const LOGIN_COLUMNS: readonly LoginColumn[] = [
  {
    key: 'ip',
    label: LOGIN_COL_IP,
    widthClass: 'w-ip',
    widthPx: 160,
    align: 'left',
    firstDirection: 'asc',
  },
  {
    key: 'country',
    label: LOGIN_COL_COUNTRY,
    widthClass: 'w-country',
    widthPx: 136,
    align: 'left',
    firstDirection: 'asc',
  },
  {
    key: 'logins',
    label: LOGIN_COL_LOGINS,
    widthClass: 'w-logins',
    widthPx: 80,
    align: 'right',
    firstDirection: 'desc',
  },
  {
    key: 'first',
    label: LOGIN_COL_FIRST,
    widthClass: 'w-first',
    widthPx: 104,
    align: 'left',
    firstDirection: 'desc',
  },
  {
    key: 'last',
    label: LOGIN_COL_LAST,
    widthClass: 'w-last',
    widthPx: 104,
    align: 'left',
    firstDirection: 'desc',
  },
  {
    key: 'games',
    label: LOGIN_COL_GAMES,
    widthClass: 'w-games',
    widthPx: 136,
    align: 'left',
    firstDirection: 'asc',
  },
  {
    key: 'city',
    label: LOGIN_COL_CITY,
    widthClass: 'w-city',
    widthPx: 160,
    align: 'left',
    firstDirection: 'asc',
  },
];

/** The columns to draw: the six defaults, plus City once city detail is loaded. */
export function visibleLoginColumns(cityLoaded: boolean): readonly LoginColumn[] {
  return cityLoaded ? LOGIN_COLUMNS : LOGIN_COLUMNS.filter((column) => column.key !== 'city');
}

/**
 * One listed address, prepared once per view.
 *
 * The parsed bytes and the games text are computed when the rows are built, so
 * a sort compares byte arrays and strings and never re-parses or re-formats
 * twenty thousand rows. The row holds the full canonical address because the
 * cells need it to choose a string through {@link displayIp}; nothing about a
 * row is ever written to an attribute.
 */
export interface LoginRow {
  /** The canonical address. Reaches the DOM only through `displayIp`. */
  readonly ip: string;
  readonly parsed: ParsedIp | null;
  /** The English country name, or null for an address with no country match. */
  readonly country: string | null;
  readonly logins: number;
  readonly first: number | null;
  readonly last: number | null;
  /**
   * The Games cell's text: the known game names in the fixed order, or the
   * empty string for an address that appeared only in a file naming no game.
   */
  readonly gamesText: string;
  /** What the City cell says about this address (06-13). */
  readonly city: RowCity;
}

/**
 * The City cell's source for one address, decided once when the rows are built.
 *
 *   - `place`: the database names a city for it (the cell is `{City}, {State}`).
 *   - `unknown`: it has a country and the database has no city name or no
 *     record (`City unknown`, muted, sorted last).
 *   - `none`: it has no country, or no city detail is loaded (a dash).
 *
 * Decided at build time, from the city view's `placeOf` and the address' own
 * position in the stored order, because that alignment is only true BEFORE the
 * rows are sorted: `placeOf[i]` belongs to `addresses[i]` and to nothing else.
 */
export type RowCity =
  | { readonly kind: 'place'; readonly text: string }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'none' };

const NO_CITY: RowCity = { kind: 'none' };
const UNKNOWN_CITY: RowCity = { kind: 'unknown' };

/**
 * A place as one line: `{City}, {State}` as written, or just the city when the
 * state is blank (06-UI-SPEC section 3, Cell values). The country is a column of
 * its own and is not repeated here.
 */
export function cityPlaceText(place: CityPlace): string {
  return place.state === '' ? place.city : `${place.city}, ${place.state}`;
}

/**
 * The rows of a view, in the order the aggregate stored them, parsed once.
 *
 * `cityView` is the opt-in city tier, or absent. Its `placeOf` is ALIGNED to
 * `addresses` by index, so a view whose length disagrees is for another list of
 * addresses and is ignored whole rather than attributing a city to the wrong
 * row.
 */
export function buildLoginRows(
  addresses: readonly LoginAddress[],
  nameOf: (cc: string) => string | null,
  cityView: CityView | null = null,
): LoginRow[] {
  const aligned = cityView !== null && cityView.placeOf.length === addresses.length;
  return addresses.map((address, index) => ({
    ip: address.ip,
    parsed: parseIp(address.ip),
    // A code the name function cannot name reads as no match, the same
    // Unknown country the map and the Top country tile use.
    country: address.cc === null ? null : nameOf(address.cc),
    logins: address.logins,
    first: address.first,
    last: address.last,
    gamesText: address.games.length === 0 ? '' : formatGames(address.games),
    city: aligned ? cityOf(address, cityView.placeOf[index]!, cityView.places) : NO_CITY,
  }));
}

/** One address' City cell source (see {@link RowCity}). */
function cityOf(address: LoginAddress, placeIndex: number, places: readonly CityPlace[]): RowCity {
  if (address.cc === null) return NO_CITY;
  const place = placeIndex >= 0 ? places[placeIndex] : undefined;
  // An index that points nowhere is "no record", never a guess.
  if (place === undefined || place.city === '') return UNKNOWN_CITY;
  return { kind: 'place', text: cityPlaceText(place) };
}

// -----------------------------------------------------------------------------
// Sorting
// -----------------------------------------------------------------------------

/** Which column the table is sorted by, and which way. */
export interface LoginSort {
  readonly key: LoginColumnKey;
  readonly dir: 'asc' | 'desc';
}

/** D-05: the order the table opens with, and returns to on a new dataset. */
export const DEFAULT_LOGIN_SORT: LoginSort = { key: 'logins', dir: 'desc' };

/**
 * What the next click on a header sorts by.
 *
 * A NEW column takes its own first direction (descending for Logins, First seen
 * and Last seen, ascending for the rest), the SORTED column flips, and a key
 * that is not a column leaves the state untouched. There is no unsorted state: a
 * table that could return to file order would have a third arrow and no way for
 * a reader to tell it from a table sorted by something forgotten.
 */
export function nextSort(current: LoginSort, key: string): LoginSort {
  const column = LOGIN_COLUMNS.find((entry) => entry.key === key);
  if (column === undefined) return current;
  if (current.key === column.key) {
    return { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key: column.key, dir: column.firstDirection };
}

/** Two addresses by canonical order: numeric, IPv4 before IPv6, never locale. */
function compareRows(a: LoginRow, b: LoginRow): number {
  if (a.parsed !== null && b.parsed !== null) return compareIp(a.parsed, b.parsed);
  // Unreachable for a stored canonical address; a code-unit fall-back keeps a
  // hand-built row from making the comparator inconsistent.
  return a.ip < b.ip ? -1 : a.ip > b.ip ? 1 : 0;
}

/**
 * The value a column is compared by, or null for a SPECIAL value.
 *
 * Special values (Unknown country, not recorded, a dash) sort last in both
 * directions, so the direction is applied to two present values and never to
 * that decision. A City that is not a named place (`City unknown`, a dash) is
 * special, so a table without city detail sorts City by the address order.
 */
function sortValue(row: LoginRow, key: LoginColumnKey): number | string | null {
  switch (key) {
    case 'ip':
      return null;
    case 'logins':
      return row.logins;
    case 'first':
      return row.first;
    case 'last':
      return row.last;
    case 'country':
      return row.country;
    case 'games':
      return row.gamesText === '' ? null : row.gamesText;
    case 'city':
      // `City unknown` and the dash are special values, so they sort last.
      return row.city.kind === 'place' ? row.city.text : null;
  }
}

/**
 * Sort rows for the table, returning a NEW array.
 *
 * The order is the sorted column, then the canonical address ascending in both
 * directions (a tie is a tie, and which of two equal values comes first is not a
 * question about magnitude). Text compares by code unit, never by locale, so two
 * people reading one export see one table. The sort is allowed while masked:
 * the order reveals only the relative position of a hidden last part among
 * addresses that already share a visible prefix (UI-SPEC section 3 Decision).
 */
export function sortLoginRows(rows: readonly LoginRow[], sort: LoginSort): LoginRow[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.key === 'ip') return sign * compareRows(a, b);
    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    if (left === null || right === null) {
      if (left !== null) return -1;
      if (right !== null) return 1;
    } else if (left !== right) {
      return (left < right ? -1 : 1) * sign;
    }
    return compareRows(a, b);
  });
}

// -----------------------------------------------------------------------------
// Cells
// -----------------------------------------------------------------------------

/** One cell's display: its text, whether it is muted, and its extras. */
export interface LoginCell {
  readonly text: string;
  readonly muted: boolean;
  /** Visually hidden text paired with a dash, or null. */
  readonly hidden: string | null;
  /**
   * The cell's `title`, or null. Only ever that cell's OWN name text (a country
   * name or a list of game names); an address never appears here and the IP
   * cell's is always null.
   */
  readonly title: string | null;
  /** True for the Account record tag, which the table draws as a chip. */
  readonly tag?: true;
}

/** Every column's cell for one row or for the Account record row. */
export type LoginCells = Record<LoginColumnKey, LoginCell>;

function plain(text: string, title: string | null = null): LoginCell {
  return { text, muted: false, hidden: null, title };
}

function special(text: string, hidden: string | null = null): LoginCell {
  return { text, muted: true, hidden, title: null };
}

/** A date cell: `YYYY-MM-DD`, or a dash with hidden text when unreadable. */
function dateCell(seconds: number | null): LoginCell {
  return seconds === null
    ? special(LOGIN_NO_VALUE, LOGIN_HIDDEN_NO_READABLE_DATE)
    : plain(formatLoginDate(seconds));
}

/**
 * The cells of one listed row, as displayed.
 *
 * The IP cell is the ONE cell that can hold an address and it comes through
 * {@link displayIp}; no other cell reads the row's address, and no title is ever
 * given to the IP cell. The City cell reads the row's own city source, which is
 * a dash until city detail is loaded (and the column is not drawn until then).
 */
export function loginCells(row: LoginRow, revealed: boolean): LoginCells {
  return {
    ip: plain(displayIp(row, revealed)),
    country:
      row.country === null ? special(LOGIN_UNKNOWN_COUNTRY) : plain(row.country, row.country),
    logins: plain(formatNumber(row.logins)),
    first: dateCell(row.first),
    last: dateCell(row.last),
    games:
      row.gamesText === ''
        ? special(LOGIN_GAMES_NOT_RECORDED)
        : plain(row.gamesText, row.gamesText),
    city: cityCell(row.city),
  };
}

/** The City cell: the place, `City unknown` (muted), or a dash (muted). */
function cityCell(city: RowCity): LoginCell {
  switch (city.kind) {
    case 'place':
      return plain(city.text, city.text);
    case 'unknown':
      return special(LOGIN_CITY_UNKNOWN);
    case 'none':
      return special(LOGIN_NO_VALUE);
  }
}

// -----------------------------------------------------------------------------
// The pinned Account record row
// -----------------------------------------------------------------------------

/**
 * Whether the pinned Account record row exists (D-02).
 *
 * It does for a readable address and for one that could not be read (the row
 * then says so in fixed words), and not for a blank cell or no account record:
 * a row with nothing to show would be a row of dashes labelled as a fact.
 */
export function hasAccountRow(account: AccountRecord | null): account is AccountRecord {
  return account !== null && account.ipState !== 'blank';
}

/**
 * Whether recorded text could carry an IP address.
 *
 * The account file's country and city are shown as written, and while masked no
 * unmasked address may exist anywhere in the page. `parseIp` would only catch a
 * cell that is EXACTLY an address, so `home 192.0.2.10` would slip through; a
 * conservative substring rule does not: a colon (any IPv6) or a dotted run of
 * digits (any IPv4). A country or city name contains neither. The cell then
 * reads the fixed words `not readable` and never echoes what was there.
 */
function looksLikeAddress(text: string): boolean {
  return text.includes(':') || /\d+\.\d+/.test(text);
}

/** A recorded country: exactly two letters become a name; anything else is as written. */
function recordedCountry(text: string | null, nameOf: (cc: string) => string | null): LoginCell {
  if (text === null || text === '') return special(LOGIN_NOT_IN_EXPORT);
  if (looksLikeAddress(text)) return special(LOGIN_NOT_READABLE);
  if (/^[A-Za-z]{2}$/.test(text)) {
    // Upper-cased for the LOOKUP only: the account file's text is stored as
    // written and a lower-case code still names a country.
    const name = nameOf(text.toUpperCase());
    if (name !== null) return plain(name, name);
  }
  return plain(text);
}

/**
 * The cells of the pinned Account record row (D-02).
 *
 * The country is the file's own recorded value and is NEVER re-resolved through
 * the offline table: the two can disagree, both are right about different
 * things, and the note under the table says which one the row is. Logins, First
 * seen and Last seen are dashes with hidden text, because the row is not a
 * login. The IP follows the same mask as every other address; an address that
 * could not be read is the fixed words `not readable`, with no trace of the
 * cell (`account.ip` is null for it, so there is nothing to leak).
 */
export function accountCells(
  account: AccountRecord,
  revealed: boolean,
  nameOf: (cc: string) => string | null,
): LoginCells {
  const dash = (): LoginCell => special(LOGIN_NO_VALUE, LOGIN_HIDDEN_NOT_COUNTED);
  return {
    ip:
      account.ip === null
        ? special(account.ipState === 'unreadable' ? LOGIN_NOT_READABLE : LOGIN_NOT_IN_EXPORT)
        : plain(displayIp({ ip: account.ip }, revealed)),
    country: recordedCountry(account.countryCode, nameOf),
    logins: dash(),
    first: dash(),
    last: dash(),
    games: { text: LOGIN_ACCOUNT_TAG, muted: false, hidden: null, title: null, tag: true },
    city:
      account.city === null || account.city === ''
        ? special(LOGIN_NOT_IN_EXPORT)
        : looksLikeAddress(account.city)
          ? special(LOGIN_NOT_READABLE)
          : plain(account.city),
  };
}

// -----------------------------------------------------------------------------
// The figures under the table
// -----------------------------------------------------------------------------

/**
 * The figures the count line reads: the LISTED addresses and their logins.
 *
 * Not `totalLogins`, which also holds the logins of addresses the cap folded
 * away, so the listed rows plus the cap line's unlisted addresses equal the
 * tile total and the listed logins plus the cap line's logins equal the
 * counted logins (06-03's recorded outcome).
 */
export function listedFigures(rows: readonly LoginRow[]): { addresses: number; logins: number } {
  let logins = 0;
  for (const row of rows) logins += row.logins;
  return { addresses: rows.length, logins };
}

/** The addresses and logins the cap folded away, or null when it folded none. */
export function capFigures(view: LoginsView): { addresses: number; logins: number } | null {
  if (view.status !== 'ready' || view.other.addresses === 0) return null;
  return { addresses: view.other.addresses, logins: view.other.logins };
}

/**
 * How many login rows had no readable address, for the excluded pill.
 *
 * Counted for a `ready` view and for a `no-usable` one (the UI-SPEC shows the
 * pill in both), and zero for anything else. The pill component renders nothing
 * at zero, so this never needs to be guarded at the call site.
 */
export function excludedCount(view: LoginsView | null): number {
  if (view === null) return 0;
  if (view.status === 'ready') return view.unreadableRows;
  if (view.status === 'no-usable') return view.unreadable;
  return 0;
}
