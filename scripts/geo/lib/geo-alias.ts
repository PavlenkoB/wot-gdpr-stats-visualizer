/**
 * The geo-table alias, shared by `vite.config.ts` and `vitest.config.ts`.
 *
 * ## Why this is a REGULAR EXPRESSION and not a string key
 *
 * `country-table.ts` imports the table as
 *
 * ```ts
 * import countryData from '#geo/country-data?inline';
 * ```
 *
 * and a Vite alias whose `find` is the STRING `'#geo/country-data'` does not
 * match an id that carries a query: Vite's string branch compares the whole
 * importee, so `'#geo/country-data?inline' !== '#geo/country-data'` and the
 * specifier falls through to the resolver, which then fails to find a file
 * named `#geo/country-data`. Probed while planning: the string form fails the
 * build; the regular-expression form below inlines the file as a base64 data
 * URL, which is exactly what the lazy decode in `country-table.ts` expects.
 *
 * The `?inline` suffix is what makes the table part of the WORKER CHUNK rather
 * than a separate asset the browser requests after load, which is the whole
 * reason this alias exists (D-12, RESEARCH Pitfall 1: a lazy chunk is a
 * post-load request and the zero-network check counts it). The replacement
 * therefore has to preserve whatever query the caller wrote, which is what the
 * capture group is for.
 *
 * ## Why there is an environment switch at all
 *
 * Every RFC 5737 / RFC 3849 documentation address resolves to `ZZ` in the real
 * DB-IP data, so a browser test fixture built only from documentation ranges
 * would shade no country at all (D-17, RESEARCH Pitfall 2). The recorded
 * checkpoint decision (option-a) resolves that with a build seam rather than by
 * committing real public addresses: `GEO_FIXTURE=1` points the alias at the
 * 377-byte committed fixture table.
 *
 * D-17's "no real IPs committed" then holds literally — nothing but
 * documentation ranges reaches the repository — while the 10,000-row scale
 * fixture can still shade a realistic spread of countries. The switch is
 * selected in exactly one place in the repository, `playwright.config.ts`'s
 * `webServer.env`; `tests/unit/guards/geo-seam.test.ts` (plan 06-06 Task 3)
 * reads that file and `package.json` and fails if anything else grows a way to
 * set it, which is what keeps a fixture table out of a deployed build.
 *
 * `vitest.config.ts` passes `{ GEO_FIXTURE: '1' }` deliberately: unit tests
 * always see the fixture table so their country assertions are deterministic.
 * The shipped table is not left untested — it is covered structurally by
 * `tests/unit/geo/country-table-shipped.test.ts`, which reads the committed
 * file off disk and asserts its shape, and by
 * `country-table-shipped.test.ts`'s assertion that the production table maps a
 * documentation address to the explicit unknown.
 */

import { fileURLToPath } from 'node:url';

/** The import specifier `src/lib/geo/country-table.ts` asks for, with or without a query. */
const SPECIFIER_RE = /^#geo\/country-data(\?.*)?$/;

/** The committed production table, 3,403,572 bytes (plan 06-04). */
const SHIPPED_TABLE = 'src/lib/geo/assets/country-table.bin';

/** The committed 377-byte fixture table, built from documentation ranges only. */
const FIXTURE_TABLE = 'tests/fixtures/geo/country-fixture.bin';

/** The alias entry type both Vite and Vitest accept, declared so no config needs a Vite import. */
export interface GeoAliasEntry {
  find: RegExp;
  replacement: string;
}

/**
 * The alias entries that resolve `#geo/country-data` to a table on disk.
 *
 * `env` is passed in rather than read from `process.env` so the two configs
 * differ in exactly one place and the seam guard can ask this function what a
 * given environment would produce without mutating the process.
 *
 * Both paths are resolved from the repository root relative to THIS file, so
 * the entry is correct wherever the config was loaded from.
 */
export function geoAliasEntries(env: Record<string, string | undefined>): GeoAliasEntry[] {
  const relative = env.GEO_FIXTURE === '1' ? FIXTURE_TABLE : SHIPPED_TABLE;
  const table = fileURLToPath(new URL(`../../../${relative}`, import.meta.url));
  return [{ find: SPECIFIER_RE, replacement: `${table}$1` }];
}
