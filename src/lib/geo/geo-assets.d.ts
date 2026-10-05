/**
 * Ambient declaration for the inlined country table.
 *
 * The specifier is an ALIAS, not a path: `#geo/country-data?inline` is turned
 * into an absolute path on disk by `geoAliasEntries` (see
 * `scripts/geo/lib/geo-alias.ts`), which is why TypeScript — which knows
 * nothing about the alias — needs to be told what the module is.
 *
 * `?inline` is Vite's data-URL form: the build inlines the bytes into the
 * worker chunk as base64 rather than emitting a separate asset the browser
 * would request after load. The default export is therefore a STRING, not bytes.
 *
 * This file is a global script (no top-level import or export), so the
 * declaration applies to every program that includes it: the app project
 * (`tsconfig.app.json` includes every TypeScript file under `src/`) and the
 * test project,
 * whose `include` had to grow this path so the test program that reaches
 * `country-table.ts` through imports can resolve the specifier.
 */

declare module '#geo/country-data?inline' {
  /** The table as a `data:` URL — `data:application/octet-stream;base64,…`. */
  const countryData: string;
  export default countryData;
}
