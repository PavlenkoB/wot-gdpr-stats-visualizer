/**
 * Reading a DB-IP range CSV, line by line (phase 06, plan 06-04, RESEARCH
 * Pattern 9).
 *
 * ## Why the splitter is here and not PapaParse
 *
 * This is a BUILD-TIME script, running in Node, reading a file this project
 * downloaded. PapaParse is a runtime dependency of the app, and pulling it in
 * here would make the build scripts depend on the browser bundle's parser for
 * a job that is twenty lines. It is also the wrong tool for one specific
 * reason: the CITY file quotes fields that contain the delimiter (`"South
 * Brisbane"`), so a `split(',')` would turn one city into four columns, and
 * plan 06-09 reuses this exact splitter for that file. Handling the quotes here
 * once is what makes the reuse safe.
 *
 * ## Why a whole LINE, not a whole FILE
 *
 * The country CSV is 31 MB raw and the city CSV is 693 MB. The callers stream
 * with `readline` and hand one line at a time, so the peak memory of building a
 * table is the table and not the text (T-06-18).
 *
 * ## Why a malformed line is SKIPPED rather than fatal
 *
 * `parseCountryLine` answers `null` for a header, a blank line, a comment and
 * anything that is not two addresses and a place; `parseCityLine` does the same
 * for the wider city layout. The build script counts the lines it had to skip
 * and prints the count, so a source that changed shape is visible in the
 * build's own output rather than silently producing a table with holes in it.
 * A line that parses to an address range can never be skipped by accident: a
 * row that is not an address is not a range.
 */

import { parseIp, type ParsedIp } from '../../../src/lib/geo/ip.ts';
import type { RangeInput } from '../../../src/lib/geo/range-table.ts';

/** One row of a `start,end,place` range file. */
export type CountryLine = RangeInput;

/**
 * Split one CSV line into its fields, honouring double-quoted fields.
 *
 * A doubled quote inside a quoted field is one literal quote (`"a""b"` is
 * `a"b`), which is what RFC 4180 says and what the DB-IP city export uses for
 * a name containing one. A quoted field may contain commas, and a quote that
 * opens a field and is never closed simply runs to the end of the line — the
 * line is discarded by the caller anyway, and inventing a throw here would
 * make a single bad line stop a build.
 *
 * Never throws.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ',') {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

/**
 * Parse one `start,end,CC` line, or answer null.
 *
 * Null is the answer for a header (`start_ip,end_ip,country`), a blank line, a
 * `#` comment, a line with the wrong number of fields, and a line whose
 * addresses are not both parseable in the SAME family. The family rule matters:
 * an IPv4 start with an IPv6 end is a corrupt row, and building a range from it
 * would put a start and an end in different address spaces.
 *
 * The addresses are parsed with the PRODUCTION parser from `src/lib/geo/ip.ts`
 * rather than a second one written here, so a table can never be built from a
 * row the app would later refuse to read.
 *
 * Never throws.
 */
export function parseCountryLine(line: string): CountryLine | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null;
  const fields = splitCsvLine(trimmed);
  if (fields.length < 3) return null;
  const start: ParsedIp | null = parseIp(fields[0]!);
  const end: ParsedIp | null = parseIp(fields[1]!);
  if (start === null || end === null) return null;
  if (start.family !== end.family) return null;
  const place = fields[2]!.trim();
  if (place.length === 0) return null;
  return { start, end, place };
}

/** One row of the DB-IP city CSV: two addresses and one `CC\tState\tCity` place. */
export type CityLine = RangeInput;

/**
 * How many fields a DB-IP city row has:
 * `start,end,continent,CC,state,city,latitude,longitude`.
 *
 * The count is checked rather than the header being recognised, because a
 * source that GAINED a column and a source whose header was translated both
 * arrive as "eight fields that are not two addresses and a place" — and the
 * only safe answer to a row this build cannot place is to skip it and let the
 * build print how many it skipped.
 */
const CITY_FIELD_COUNT = 8;

/**
 * Parse one `start,end,continent,CC,state,city,lat,lon` line, or answer null.
 *
 * ## Why the place is a TAB-joined string
 *
 * A city place is `CC`, a tab, the state and a tab, the city name. A tab
 * separator rather than a comma because a city name MAY contain a comma —
 * DB-IP's own export quotes `"Zapopan, Jalisco"` — and a comma-joined place
 * would then be ambiguous with itself inside the container's newline-separated
 * place table. A tab cannot occur in a place: the container refuses a newline
 * (which would collide with the place-table separator), no geographic name
 * DB-IP publishes contains a tab, and the value is quoted CSV text either way.
 *
 * An EMPTY city is not a skip. DB-IP's real file has rows with a country and
 * no city name, and dropping them would silently delete the range — the
 * address would fall into the surrounding unknown hole and the account would
 * be told "no record" about a prefix the database does describe. So they
 * become a place with an empty city, and the city view counts them in
 * `noCityAddresses` instead (D-16, UI-SPEC section 5).
 *
 * Continent, latitude and longitude are read only to prove the row has the
 * shape this build expects; none of them reaches the output. They are not
 * needed: the map is country-level and stays that way (D-16).
 *
 * Never throws.
 */
export function parseCityLine(line: string): CityLine | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null;
  const fields = splitCsvLine(trimmed);
  if (fields.length !== CITY_FIELD_COUNT) return null;
  const start: ParsedIp | null = parseIp(fields[0]!);
  const end: ParsedIp | null = parseIp(fields[1]!);
  if (start === null || end === null) return null;
  if (start.family !== end.family) return null;
  // A row with no country cannot name a place. It is rare enough that the
  // build's skipped count is the right place for it to show up.
  const cc = fields[3]!.trim();
  if (cc.length === 0) return null;
  const state = fields[4]!.trim();
  const city = fields[5]!.trim();
  return { start, end, place: `${cc}\t${state}\t${city}` };
}
