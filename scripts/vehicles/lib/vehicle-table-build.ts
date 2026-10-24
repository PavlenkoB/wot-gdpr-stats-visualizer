/**
 * The pure half of the tank-table generator (phase 13, plan 13-02, D-07,
 * D-08, D-09, T-13-06, T-13-07).
 *
 * ## Why this file has no network and no filesystem
 *
 * Everything here is a function of its arguments: the payload in, the rows
 * out. The network call lives in `scripts/vehicles/build-vehicle-table.ts` and
 * the file writes live there too, so the validation rules can be tested
 * exhaustively against synthetic payloads on a machine that cannot reach the
 * internet and has no key.
 *
 * ## Why the validation FAILS CLOSED (T-13-07)
 *
 * The API response is untrusted input that becomes COMMITTED SOURCE. A row
 * that slips through becomes a string the page interpolates as text and a key
 * the page looks up, so every field that could carry a control character, an
 * angle bracket, a duplicate key or a nonsense tier is rejected rather than
 * sanitised. There is no "best effort" path: the generator aborts with a
 * non-zero exit and writes NOTHING.
 *
 * ## Why an error message names the RULE and never the payload (T-13-06)
 *
 * An error page from the API can echo the offending parameter in
 * `error.value` — and the offending parameter is the application key. So a
 * thrown message may name the RULE and the numeric `tank_id` (a number we have
 * already checked is a positive integer), and nothing else: no tag, no nation,
 * no name, no type, no tier, no key, no URL. The rules themselves are the
 * useful part of the message; the payload is the part that must not escape.
 *
 * ## Why the row is a TUPLE
 *
 * The generated table is the compact form the spike measured: `[tank_id,
 * "nation:tag", name, type, tier]`, about 57 KB raw and 19 KB gzipped for the
 * real 1,035 vehicles. A tuple is the smallest thing that can carry five
 * values under one name, and it is inlined into the worker chunk rather than
 * parsed at runtime (D-08).
 */

import { createHash } from 'node:crypto';

/**
 * The vehicle classes the page knows, spelled exactly as the API spells them.
 *
 * `unknown` is NOT here: it is the FALLBACK for a tank missing from the
 * table, and it is a class the page shows, not a class the API reports
 * (D-09). The generator rejects a type outside this set, and the lookup
 * defensively stores anything else as `unknown` rather than dropping the row.
 */
export const VEHICLE_TYPES = ['mediumTank', 'AT-SPG', 'heavyTank', 'lightTank', 'SPG'] as const;

/**
 * The largest table the generator will write.
 *
 * The real encyclopedia list is about 1,035 rows. The cap is not about the
 * list's size: it is the ceiling on how much untrusted text may become
 * committed source in one file. A payload larger than this is refused rather
 * than written.
 */
export const MAX_ROWS = 3000;

/**
 * The highest tier a vehicle may carry. Wargaming added a tier XI (the first
 * real one is tank 6017), so the old ceiling of 10 refused real data. The
 * lookup in `overview-lookup.ts` keeps its own copy of this number, because
 * this script stands apart from `src/`; a test holds the two equal.
 */
export const MAX_TIER = 11;

/**
 * One row of the table.
 *
 * `key` is `nation:tag` — the two keys the page needs, joined: the tag key
 * matches `wot_vehicle_statistics.csv`'s `VEHICLE_NAME`, and the numeric
 * `tankId` matches the record columns.
 */
export type VehicleTableRow = readonly [
  tankId: number,
  key: string,
  name: string,
  type: string,
  tier: number,
];

/**
 * A tag is letters, digits, underscores and hyphens only, and short. The hyphen
 * is real data, not slack: the very first tank id is the T-34, tagged
 * `R04_T-34`, and the IS-3, KV-1 and their relatives carry one too.
 */
const TAG_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The first character a tag may not hold, as a code point, or null when every
 * character is allowed. It is what lets a refusal say WHICH character broke the
 * rule without echoing the tag itself, which came from outside.
 */
function firstDisallowedTagCharacter(tag: string): string | null {
  for (const char of tag) {
    if (!/^[A-Za-z0-9_-]$/.test(char)) {
      const code = char.codePointAt(0) ?? 0;
      return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    }
  }
  return null;
}

/** A nation is lower-case letters and underscores only, and short. */
const NATION_PATTERN = /^[a-z_]{2,20}$/;

/**
 * Whether a name carries a character it may not carry.
 *
 * A name may not hold a control character (below U+0020, U+007F, or the C1
 * range U+0080 to U+009F), an invisible or direction-changing character, or an
 * angle bracket. The bracket is what a page interpolating text has to escape,
 * and the control character is what a table cell cannot render. The invisible
 * ones (the zero-width characters and direction marks U+200B to U+200F, the
 * line and paragraph separators and the bidi embeddings and overrides
 * U+2028 to U+202E, the bidi isolates U+2066 to U+2069 and the byte-order mark
 * U+FEFF) would let a name read differently from what the committed source
 * shows, so a validator that claims to fail closed on API text refuses them.
 * All are rejected rather than stripped, because stripping changes a name.
 *
 * The code units are checked by NUMBER rather than by a regular expression: a
 * literal control range in a pattern is unreadable in a diff and
 * `no-control-regex` rightly refuses it.
 */
function forbiddenNameCharacter(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (
      code < 0x20 ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x2028 && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069) ||
      code === 0xfeff
    ) {
      return true;
    }
  }
  return text.includes('<') || text.includes('>');
}

/** A tank id is a positive integer no larger than a 32-bit signed int. */
const MAX_TANK_ID = 2147483647;

/** Whether a value is a plain object (and not an array, and not null). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The name to store: `short_name` when it is a non-empty string, else `name`.
 *
 * The spike's table used the same choice, and it is why the committed table
 * reads as "T29" rather than "M36 Borsig".
 */
function displayNameOf(entry: Record<string, unknown>): unknown {
  const short = entry['short_name'];
  if (typeof short === 'string' && short !== '') return short;
  return entry['name'];
}

/**
 * Validate one API entry and turn it into a row.
 *
 * Every rejection names the rule and the tank id, and never a string from the
 * payload (T-13-06).
 */
function rowFromEntry(entry: unknown, pageNumber: number): VehicleTableRow {
  if (!isRecord(entry)) {
    throw new Error(`vehicle-table: page ${pageNumber} holds an entry that is not an object`);
  }

  const tankId = entry['tank_id'];
  if (
    typeof tankId !== 'number' ||
    !Number.isInteger(tankId) ||
    tankId <= 0 ||
    tankId > MAX_TANK_ID
  ) {
    // The id itself is NOT echoed: it is the one field that has not been
    // checked to be a number yet.
    throw new Error(
      `vehicle-table: page ${pageNumber} holds a tank_id that is not a positive integer`,
    );
  }

  const tag = entry['tag'];
  if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) {
    const bad = typeof tag === 'string' ? firstDisallowedTagCharacter(tag) : null;
    const why =
      typeof tag !== 'string'
        ? 'is not a string'
        : tag.length === 0 || tag.length > 64
          ? 'is empty or longer than 64 characters'
          : bad === null
            ? 'is malformed'
            : `holds the character ${bad}`;
    throw new Error(`vehicle-table: tank ${tankId} has a malformed tag (${why})`);
  }

  const nation = entry['nation'];
  if (typeof nation !== 'string' || !NATION_PATTERN.test(nation)) {
    throw new Error(`vehicle-table: tank ${tankId} has a malformed nation`);
  }

  const name = displayNameOf(entry);
  if (typeof name !== 'string' || name.length < 1 || name.length > 60) {
    throw new Error(`vehicle-table: tank ${tankId} has a malformed name`);
  }
  if (forbiddenNameCharacter(name)) {
    throw new Error(
      `vehicle-table: tank ${tankId} has a name with a control character, an invisible or direction-changing character, or an angle bracket`,
    );
  }

  const type = entry['type'];
  if (typeof type !== 'string' || !(VEHICLE_TYPES as readonly string[]).includes(type)) {
    throw new Error(`vehicle-table: tank ${tankId} has a type outside the known set`);
  }

  const tier = entry['tier'];
  if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) {
    // A number is not a string from outside, so the value is safe to name; any
    // other type is named by its type only.
    const seen = typeof tier === 'number' ? String(tier) : `a ${typeof tier}`;
    throw new Error(
      `vehicle-table: tank ${tankId} has a tier outside 1 to ${MAX_TIER} (got ${seen})`,
    );
  }

  return [tankId, `${nation}:${tag}`, name, type, tier];
}

/**
 * Validate the raw API pages and return the rows, sorted by tank id.
 *
 * The input is the array of page objects the API returned, in the order they
 * were fetched. The output is the table's rows, ascending by `tank_id`, so
 * two runs over the same data produce byte-identical output.
 *
 * Throws on anything the table may not contain: a page that is not `ok`, a
 * missing `data`, an entry that is not an object, a bad id, tag, nation,
 * name, type or tier, a duplicate id, a duplicate `nation:tag`, an empty
 * result, or a result larger than {@link MAX_ROWS}.
 */
export function validatePages(pages: unknown): VehicleTableRow[] {
  if (!Array.isArray(pages)) {
    throw new Error('vehicle-table: the payload is not a list of API pages');
  }

  const rows: VehicleTableRow[] = [];
  const seenIds = new Set<number>();
  const seenKeys = new Set<string>();

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    if (!isRecord(page)) {
      throw new Error(`vehicle-table: page ${pageNumber} is not an object`);
    }
    if (page['status'] !== 'ok') {
      throw new Error(`vehicle-table: page ${pageNumber} did not answer with status "ok"`);
    }
    const data = page['data'];
    if (!isRecord(data)) {
      throw new Error(`vehicle-table: page ${pageNumber} carries no data object`);
    }
    for (const entry of Object.values(data)) {
      const row = rowFromEntry(entry, pageNumber);
      if (seenIds.has(row[0])) {
        throw new Error(`vehicle-table: tank ${row[0]} appears more than once`);
      }
      if (seenKeys.has(row[1])) {
        // The key itself is NOT echoed: it is payload text.
        throw new Error('vehicle-table: a vehicle key appears more than once');
      }
      seenIds.add(row[0]);
      seenKeys.add(row[1]);
      rows.push(row);
    }
  });

  if (rows.length === 0) {
    throw new Error('vehicle-table: the payload holds no vehicle rows');
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(`vehicle-table: the payload holds more than ${MAX_ROWS} rows`);
  }

  rows.sort((a, b) => a[0] - b[0]);
  return rows;
}

/**
 * Re-validate the rows of a COMMITTED table, offline.
 *
 * `--check` reads a module that was written by an earlier run, and the point
 * of the check is that the committed file is still a table this generator
 * would have written. So the same per-row rules run again over the compact
 * rows, and the count and the hash are compared with the metadata beside
 * them.
 */
export function validateRows(rows: readonly unknown[]): void {
  if (rows.length > MAX_ROWS) {
    throw new Error(`vehicle-table: the table holds more than ${MAX_ROWS} rows`);
  }
  const seenIds = new Set<number>();
  const seenKeys = new Set<string>();
  rows.forEach((raw, index) => {
    const where = `row ${index + 1}`;
    if (!Array.isArray(raw) || raw.length !== 5) {
      throw new Error(`vehicle-table: ${where} is not a five-value row`);
    }
    const [tankId, key, name, type, tier] = raw as [unknown, unknown, unknown, unknown, unknown];

    if (
      typeof tankId !== 'number' ||
      !Number.isInteger(tankId) ||
      tankId <= 0 ||
      tankId > MAX_TANK_ID
    ) {
      throw new Error(`vehicle-table: ${where} has a tank_id that is not a positive integer`);
    }
    if (typeof key !== 'string' || !/^[a-z_]{2,20}:[A-Za-z0-9_-]{1,64}$/.test(key)) {
      throw new Error(`vehicle-table: ${where} has a malformed vehicle key`);
    }
    if (typeof name !== 'string' || name.length < 1 || name.length > 60) {
      throw new Error(`vehicle-table: ${where} has a malformed name`);
    }
    if (forbiddenNameCharacter(name)) {
      throw new Error(
        `vehicle-table: ${where} has a name with a control character, an invisible or direction-changing character, or an angle bracket`,
      );
    }
    if (typeof type !== 'string' || !(VEHICLE_TYPES as readonly string[]).includes(type)) {
      throw new Error(`vehicle-table: ${where} has a type outside the known set`);
    }
    if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) {
      throw new Error(`vehicle-table: ${where} has a tier outside 1 to ${MAX_TIER}`);
    }
    if (seenIds.has(tankId)) {
      throw new Error(`vehicle-table: tank ${tankId} appears more than once`);
    }
    if (seenKeys.has(key)) {
      throw new Error('vehicle-table: a vehicle key appears more than once');
    }
    seenIds.add(tankId);
    seenKeys.add(key);
  });
}

/**
 * The rows' hash: sha256 over the rows' JSON.
 *
 * The hash is what `--check` compares, so it has to be a function of the
 * rows ALONE: no date, no count, no formatting. Two runs over the same data
 * hash the same, and one changed character hashes differently.
 */
export function rowsHash(rows: readonly VehicleTableRow[]): string {
  return createHash('sha256').update(JSON.stringify(rows), 'utf8').digest('hex');
}

/**
 * The generated module, as text.
 *
 * The module imports NOTHING (so no build-time package can reach the bundle
 * through it) and carries no key, no host and no URL. Every string is written
 * with `JSON.stringify`, so a quote in a name cannot break the module.
 */
export function renderModule(rows: readonly VehicleTableRow[], generatedAt: string): string {
  const body = rows
    .map(
      (row) =>
        `  [${row[0]}, ${JSON.stringify(row[1])}, ${JSON.stringify(row[2])}, ${JSON.stringify(row[3])}, ${row[4]}],`,
    )
    .join('\n');
  return `// GENERATED FILE — do not edit by hand. Run \`pnpm run vehicles:table\`, and prove
// it is current with \`pnpm run vehicles:table:check\`.
//
// Source: the Wargaming.net public API, encyclopedia vehicles data.
// Attribution: the copyright notice and the link to the official game site are
// shown in the Overview footer (OVERVIEW_ATTRIBUTION_* in src/lib/ui-copy.ts),
// as approved at the Terms-of-Use gate (13-CONTEXT D-07 and D-23).
//
// Rows: a tank this file does not hold falls back to the tag-derived name and
// an unknown class (D-09), and the Overview states its class coverage.
//
// This file is plain data and imports NOTHING. It is worker-only: the table is
// inlined into the worker chunk like the geo country table, and the browser
// never requests it (D-08), so it can never become a request after page load.

export type VehicleTableRow = readonly [
  tankId: number,
  key: string,
  name: string,
  type: string,
  tier: number,
];

export const VEHICLE_TABLE: readonly VehicleTableRow[] = [${body === '' ? '' : `\n${body}\n`}];

export const VEHICLE_TABLE_META = {
  count: ${rows.length},
  sha256: ${JSON.stringify(rowsHash(rows))},
  generatedAt: ${JSON.stringify(generatedAt)},
} as const;
`;
}

/**
 * The application key: the environment first, then the local env file.
 *
 * The environment variable wins, because a developer who exports the key
 * means it. The file is the fallback, and only this function and the script
 * that calls it ever read it — the file is gitignored, and no planner, test or
 * agent reads it.
 *
 * The key is RETURNED, never logged. The caller passes it to the request and
 * to nothing else.
 */
export function readApplicationId(
  env: Record<string, string | undefined>,
  envFileText: string | null,
): string | null {
  const fromEnv = env['WG_APPLICATION_ID'];
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim();

  if (envFileText === null) return null;

  // dotenv semantics: the LAST assignment wins, so a key a developer appended
  // below an older one is the one that is sent.
  const assignments = [
    ...envFileText.matchAll(/^[ \t]*(?:export[ \t]+)?WG_APPLICATION_ID[ \t]*=[ \t]*(.*)$/gm),
  ];
  const match = assignments[assignments.length - 1];
  if (match === undefined) return null;
  const raw = match[1]?.trim() ?? '';

  // A quoted value runs to its closing quote, and anything after it (an inline
  // comment) is dropped. An unquoted value ends at the first `#`, as in dotenv.
  const quote = raw.startsWith('"') || raw.startsWith("'") ? raw[0] : null;
  const closing = quote === null ? -1 : raw.indexOf(quote, 1);
  const value =
    quote !== null && closing !== -1
      ? raw.slice(1, closing).trim()
      : (raw.split('#')[0] ?? '').trim();
  return value === '' ? null : value;
}
