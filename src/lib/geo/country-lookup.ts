/**
 * The country lookup the worker aggregates with (phase 06, D-12, plan 06-06).
 *
 * ## Worker-only
 *
 * This module is imported by the ingest worker and by nothing on the main
 * thread. D-12 puts the whole range table inside the worker at import time:
 * the main thread never loads it, never holds it, and never scans raw rows to
 * work out a country. A module that a main-thread import could reach is a
 * module whose table a main-thread bundle would one day pull in, so the
 * restriction is enforced by `no-restricted-imports` in `eslint.config.js` and
 * proved by the probes in `tests/unit/guards/lint-guards.test.ts`.
 *
 * ## The seam this file replaced, and what is still a seam
 *
 * `buildLogins` takes a {@link CountryLookup} as a PARAMETER and never imports
 * this module, and that has not changed. The aggregator's test still injects a
 * counting spy and still proves the lookup runs once per DISTINCT address
 * rather than once per row; {@link lookupCountryIn} exists so a test can do
 * the same against a table it decoded itself.
 *
 * What changed is the body. Until 06-06 there was no table, so the lookup
 * answered null for every address — the honest answer, and the reason every
 * fixture in the repository so far has documented addresses and no country.
 * Now the table is the committed DB-IP range table, inlined into the worker
 * chunk and decoded lazily by `country-table.ts`.
 *
 * ## Why the table identity is part of the answer's shape
 *
 * `geoTableId()` is stored beside the aggregate on the meta record. A build
 * that ships a DIFFERENT table therefore rebuilds its aggregates rather than
 * serving answers the current rules would not have produced — the same hook
 * `PLAYTIME_VERSION` provides, for the other half of the same staleness. A
 * rebuild is cheap (the rows are the dataset, the aggregate is derived) and
 * refusing to answer is not: it would show a user an error for data the app
 * still holds. The fixture flag is part of the id, so a browser run against
 * the fixture table and a real run against the shipped table are never mistaken
 * for one another.
 */

import { getCountryTable } from './country-table.ts';
import type { ParsedIp } from './ip.ts';
import { lookupIp, type RangeTable } from './range-table.ts';

/**
 * Resolve one ALREADY-PARSED address to a two-letter country code, or null.
 *
 * Takes the parsed form rather than the text so a caller cannot accidentally
 * run a range search against an unvalidated cell, and so the parse — the only
 * part that touches the string — happens exactly once per address, at the
 * aggregate.
 */
export type CountryLookup = (ip: ParsedIp) => string | null;

/** A place id is only ever a country code: two upper-case ASCII letters. */
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

/** The looked-up `geo` id, computed once per table rather than per lookup. */
let tableId: string | null = null;

/**
 * The country code a place id stands for, or null (D-08).
 *
 * Three answers are null and only these three:
 *
 *   - the table's EXPLICIT unknown id. `ZZ` is how the DB-IP source names
 *     reserved space — private ranges, loopback, and every RFC 5737 / RFC 3849
 *     documentation block, so in production this is where a user's own router
 *     address lands. It is a place in the table, not a country, and putting it
 *     on the map would shade a country that does not exist.
 *   - a place that is not two upper-case letters. The country table's places
 *     are all two-letter codes, so this is a defensive check rather than an
 *     expected case — but the same reader decodes the CITY table, whose places
 *     are `CC\tState\tCity` strings, and a table is an untrusted byte source
 *     (T-06-16). A name that failed the shape test must not reach a UI cell.
 *   - nothing else. Every other id is a country.
 */
function countryOf(table: RangeTable, placeId: number): string | null {
  if (placeId === table.unknownId) return null;
  const place = table.places[placeId];
  if (place === undefined) return null;
  return COUNTRY_CODE_RE.test(place) ? place : null;
}

/**
 * The lookup over a table the CALLER supplies.
 *
 * This is the form the tests use, so a country assertion is made against a
 * table decoded from disk rather than against whatever the build happened to
 * inline. It is also what keeps the module honest: the rule that turns a place
 * id into a code lives here and nowhere else, so a test exercising it is
 * exercising what the worker runs.
 */
export function lookupCountryIn(table: RangeTable, ip: ParsedIp): string | null {
  return countryOf(table, lookupIp(table, ip));
}

/**
 * The lookup the worker aggregates with.
 *
 * It takes its parameter so the signature stays the seam's; the table itself
 * comes from the inlined, lazily decoded module, and an IPv4-mapped IPv6
 * address is resolved through the IPv4 section by `lookupIp` rather than
 * matching an IPv6 range that happens to overlap it.
 */
export const lookupCountry: CountryLookup = (ip) => lookupCountryIn(getCountryTable(), ip);

/**
 * The identity of the geo data a stored aggregate was built against.
 *
 * It is the table's kind and source month, prefixed with `fixture-` when the
 * table is a test fixture. That is deliberately more than a version number: a
 * monthly refresh that changed a boundary has to invalidate the stored
 * aggregates, and a fixture run must never be mistaken for a real one.
 *
 * Computed once, and NOT at module load — the table decodes lazily
 * (`country-table.ts`), and asking for its identity at import time would
 * defeat that for a value nothing needs until the first query.
 */
export function geoTableId(): string {
  if (tableId === null) {
    const table = getCountryTable();
    tableId = `${table.fixture ? 'fixture-' : ''}${table.kind}-${table.month}`;
  }
  return tableId;
}
