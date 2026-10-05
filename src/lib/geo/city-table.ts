/**
 * The opt-in city container: inflate, validate, decode and resolve (phase 06,
 * ACTIVITY-07, D-13, D-14, D-15, D-16, T-06-33, T-06-34, T-06-35, RESEARCH
 * Pattern 7, Pitfall 21).
 *
 * ## Worker-only
 *
 * `no-restricted-imports` in `eslint.config.js` names this module before it
 * existed: a main-thread import would pull a container the main thread has no
 * rows to feed, and the raw rows never leave the worker in the first place.
 *
 * ## Why the bytes arrive rather than being fetched
 *
 * This module NEVER reaches for a network API — there is no `fetch` here, and
 * `pnpm run lint` proves it by failing the build if one appears. Whichever
 * thread decides to download the asset posts a buffer across, and both
 * candidate designs were measured in RESEARCH; the choice between them is the
 * checkpoint at the end of this plan, and this side of it is identical either
 * way. That is the point of the seam: the answer is a function of the bytes,
 * not of who fetched them.
 *
 * ## Why ONE error text (T-06-33)
 *
 * {@link CITY_DATA_ERROR} is a constant, never a formatted message. These
 * bytes are untrusted until validated and they arrive from a network response,
 * so a message assembled from them would be text an attacker chose: it is
 * logged, rendered and copied. A single fixed string is the same argument
 * `RANGE_TABLE_ERROR` makes for the container, one level up.
 *
 * ## Why the three rejection classes are separate steps
 *
 * A gzip body is not a container, a wrong hash is not a malformed container,
 * and a malformed container is not a bomb. Each is refused by the step that can
 * actually recognise it, so a failure says which class it was to the console
 * and says NOTHING to the user.
 */

import { mappedIpv4, parseIp } from './ip.ts';
import {
  KIND_CITY,
  MAX_CITY_TABLE_BYTES,
  decodeRangeTable,
  lookupIp,
  type DecodeFamilies,
  type RangeTable,
} from './range-table.ts';
import {
  MAX_CITY_LIST,
  type CityAddressInput,
  type CityPlace,
  type CityRankedPlace,
  type CityView,
} from '../features/logins/city-shared.ts';

/**
 * The one text every city-data failure answers with (T-06-33, T-06-35).
 *
 * A constant rather than a formatted message: an error string is logged,
 * rendered and copied, and a container whose header is hostile would otherwise
 * choose its own text. The same argument as `RANGE_TABLE_ERROR`, one level up.
 */
export const CITY_DATA_ERROR = 'city data invalid';

/**
 * The address families a list of listed addresses needs decoded (T-06-34,
 * T-06-65, CR-02).
 *
 * An IPv4 address needs the IPv4 family. An IPv6 address needs the IPv6
 * family, EXCEPT an IPv4-mapped one (`::ffff:a.b.c.d`, in either spelling):
 * {@link lookupIp} resolves that case through the IPv4 plane, so it needs the
 * IPv4 family and not the IPv6 one. Both functions ask {@link mappedIpv4}, the
 * one predicate that says which plane an IPv6 address is read from, so the
 * decode and the lookup cannot drift apart. The `::ffff:0:a.b.c.d` form is not
 * mapped and counts as plain IPv6.
 *
 * An unreadable entry is skipped. An empty or all-unreadable list answers
 * `{ ipv4: false, ipv6: false }`: there is nothing to look up, so nothing is
 * decoded. That keeps the 3.8-million-entry IPv6 planes unallocated for an
 * account that never reads them.
 */
export function familiesOf(addresses: readonly { readonly ip: string }[]): DecodeFamilies {
  let ipv4 = false;
  let ipv6 = false;
  for (const address of addresses) {
    const ip = parseIp(address.ip);
    if (ip === null) continue;
    if (ip.family === 4 || mappedIpv4(ip) !== null) ipv4 = true;
    else ipv6 = true;
  }
  return { ipv4, ipv6 };
}

/**
 * The largest INFLATED body this module will assemble, in bytes (WR-02).
 *
 * Exactly the container decoder's own city cap. A body that inflates past it
 * could never be decoded, so letting the stream run on to a looser number would
 * only spend memory on a result that is then refused. (The measured real
 * container is 42.8 MB, so the cap is more than twice the real thing.) It is a
 * PARAMETER of {@link inflateIfGzip} as well as a constant here, so a test can
 * prove the cap with a few hundred kilobytes instead of by editing a production
 * number.
 */
export const MAX_CITY_INFLATED_BYTES = MAX_CITY_TABLE_BYTES;

/** The first two bytes of a gzip member. */
const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

function fail(): never {
  throw new Error(CITY_DATA_ERROR);
}

/** True when `bytes` opens with a gzip member header. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;
}

/**
 * Return the container bytes, inflating only if the body is gzipped.
 *
 * ## Why the magic bytes and not a flag
 *
 * The production contract is GZIP-ONLY (WR-07): the worker checks the body's
 * length and SHA-256 against the manifest, and both describe the gzipped file,
 * so a host that decodes `Content-Encoding` on the way out (handing over a plain
 * container) is refused before this function runs. The plain branch below is
 * for callers that bypass that check (`sha256: null`, tests) and for a plain
 * container handed in directly. Sniffing the magic bytes rather than trusting a
 * flag means a wrong assumption cannot become an inflate error a long way from
 * its cause (RESEARCH Pitfall 16).
 *
 * ## Why a gzip-of-gzip is REFUSED rather than inflated twice (T-06-33)
 *
 * Inflate once and the result is still a gzip member. Handing that to the
 * container decoder would refuse it on the magic bytes, so the outcome would be
 * right by accident and the reason wrong; refusing it here makes "this is
 * double-compressed" the stated cause, and costs two byte comparisons.
 *
 * ## Why the cap is enforced WHILE STREAMING (T-06-33)
 *
 * A gzip bomb is small on the wire and enormous inflated, so a check after the
 * fact is no check at all: by then the allocation has happened. The count is
 * taken per chunk, the reader is cancelled the moment it passes, and the
 * partial output is dropped.
 *
 * `maxBytes` is a parameter so a test can prove the cap with a few hundred
 * kilobytes rather than by editing a production constant.
 *
 * @throws {@link CITY_DATA_ERROR} and nothing else.
 */
export async function inflateIfGzip(
  bytes: Uint8Array,
  maxBytes: number = MAX_CITY_INFLATED_BYTES,
): Promise<Uint8Array> {
  if (!isGzip(bytes)) return bytes;
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    // One buffer, sized to the cap and filled as chunks arrive, so the inflated
    // bytes are never held twice (a chunk list plus a final copy peaked at
    // twice the body). The allocation is zero-filled lazily by the platform, so
    // the untouched tail of a 43 MB body in a 96 MB buffer costs address space,
    // not memory.
    const buffer = new Uint8Array(maxBytes);
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value !== undefined) {
        if (total + value.length > maxBytes) {
          await reader.cancel();
          return fail();
        }
        buffer.set(value, total);
        total += value.length;
      }
    }
    const out = buffer.subarray(0, total);
    if (isGzip(out)) fail();
    return out;
  } catch (err) {
    if (err instanceof Error && err.message === CITY_DATA_ERROR) throw err;
    return fail();
  }
}

/**
 * Decode a container and require it to be a CITY one.
 *
 * The kind check is not redundant with the caller's own check: it is the one
 * place where a country table — a table this project DID commit, and one a
 * route-fulfilled test could serve — is refused as city data, rather than being
 * decoded and answered with two-letter places where cities should be.
 *
 * @throws {@link CITY_DATA_ERROR} and nothing else.
 */
export function decodeCityTable(bytes: Uint8Array, families?: DecodeFamilies): RangeTable {
  // `families` reaches the container reader, which PARSES AND VALIDATES a
  // skipped family and only leaves its typed arrays unallocated — so an
  // IPv4-only account never builds the 3.8-million-entry IPv6 planes
  // (T-06-34, Pitfall 21) and a corrupt IPv6 section is still a rejection.
  let table: RangeTable;
  try {
    table = decodeRangeTable(bytes, families);
  } catch {
    return fail();
  }
  if (table.kind !== KIND_CITY) fail();
  return table;
}

/** The container's `CC\tState\tCity` string, split into its three parts. */
function placeFrom(text: string): CityPlace {
  const first = text.indexOf('\t');
  if (first < 0) return { cc: text, state: '', city: '' };
  const second = text.indexOf('\t', first + 1);
  if (second < 0) return { cc: text.slice(0, first), state: text.slice(first + 1), city: '' };
  return {
    cc: text.slice(0, first),
    state: text.slice(first + 1, second),
    city: text.slice(second + 1),
  };
}

/** The two counts a ranking needs, before it is ordered. */
interface Tally {
  logins: number;
  ips: number;
}

/**
 * The rank order, in one comparator, because the list is STORED (D-16).
 *
 * Logins descending, then city ascending, then country code ascending, all by
 * plain code-unit comparison. Never `localeCompare`: the order a user sees
 * would then depend on their browser's locale, and two people reading one
 * export would see two different lists.
 *
 * The city and the country are both tie-breaks rather than a third criterion on
 * the place string, because they are what the rows DISPLAY — a tie broken by
 * state would order two visible rows by a column that is not on screen.
 */
function compareRanked(
  a: CityRankedPlace,
  b: CityRankedPlace,
  places: readonly CityPlace[],
): number {
  if (a.logins !== b.logins) return b.logins - a.logins;
  const ap = places[a.place]!;
  const bp = places[b.place]!;
  if (ap.city !== bp.city) return ap.city < bp.city ? -1 : 1;
  if (ap.cc !== bp.cc) return ap.cc < bp.cc ? -1 : 1;
  return 0;
}

/**
 * Resolve the listed addresses against a decoded city table (D-16, UI-SPEC
 * section 5).
 *
 * ## The four rules, and why each one is a rule
 *
 *  - An address whose COUNTRY the account's own table could not name is not
 *    looked up at all. A country that is unknown is not a place the city
 *    database gets to fill in, and skipping the lookup also means such an
 *    address cannot consume a place slot.
 *  - An address the city table resolves to its own unknown place has no city
 *    record. `placeOf` is -1 and the address is not ranked: a "no record" is
 *    not a place.
 *  - A place with an EMPTY city is a real answer — the database placed the
 *    prefix in a country and named no city — so the address is counted in
 *    `noCityAddresses` and is neither ranked nor given a `placeOf` entry,
 *    because there is no city to put in the column.
 *  - Everything else is ranked by logins descending, to {@link MAX_CITY_LIST},
 *    and the remainder is counted in `moreCities` rather than dropped silently.
 *
 * ## Why the view compacts the container's places
 *
 * The real container numbers about 194,000 places and a dataset resolves a
 * handful, so `places` carries only the ones this dataset reached, in first-use
 * order, and every index in the view points into it. That is what keeps the
 * reply small enough to be a plain object and what stops a 194,000-entry
 * string table from crossing `postMessage` on a user's machine.
 */
export function buildCityView(
  addresses: readonly CityAddressInput[],
  table: RangeTable,
  month: string = table.month,
): CityView {
  const places: CityPlace[] = [];
  const placeIds = new Map<string, number>();
  const tallies: Tally[] = [];
  const placeOf: number[] = new Array<number>(addresses.length);
  let noCityAddresses = 0;

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]!;
    // Rule one: no country, no city. Not looked up at all.
    if (address.cc === null) {
      placeOf[i] = -1;
      continue;
    }
    const ip = parseIp(address.ip);
    if (ip === null) {
      placeOf[i] = -1;
      continue;
    }
    const containerId = lookupIp(table, ip);
    // Rule two: the container's own unknown place is "no record", not a place.
    if (containerId < 0 || containerId === table.unknownId) {
      placeOf[i] = -1;
      continue;
    }
    const text = table.places[containerId]!;
    const place = placeFrom(text);
    // Rule three: a country with no city name is an answer, counted not ranked.
    if (place.city.length === 0) {
      placeOf[i] = -1;
      noCityAddresses += 1;
      continue;
    }
    let index = placeIds.get(text);
    if (index === undefined) {
      index = places.length;
      places.push(place);
      placeIds.set(text, index);
      tallies.push({ logins: 0, ips: 0 });
    }
    placeOf[i] = index;
    const tally = tallies[index]!;
    tally.ips += 1;
    tally.logins += address.logins;
  }

  const ranked: CityRankedPlace[] = [];
  for (let i = 0; i < places.length; i++) {
    ranked.push({ place: i, logins: tallies[i]!.logins, ips: tallies[i]!.ips });
  }
  ranked.sort((a, b) => compareRanked(a, b, places));
  const shown = ranked.slice(0, MAX_CITY_LIST);

  return {
    month,
    places,
    placeOf,
    ranked: shown,
    moreCities: ranked.length - shown.length,
    noCityAddresses,
  };
}
