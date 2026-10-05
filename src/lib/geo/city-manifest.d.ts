/**
 * Ambient declaration of the build-time city manifest (phase 06, plan 06-11,
 * D-13, D-16).
 *
 * `vite.config.ts` bakes the manifest into the bundle with `define`, so the
 * page knows the name and the size of the opt-in city file without asking the
 * network. `null` means no city file was built for this bundle, which is what a
 * local or pull-request build looks like: the opt-in (plan 06-13) must then not
 * be offered at all, since a button that can only fail is worse than no button.
 *
 * Read it ONLY through `readCityManifest()` in `city-fetch.ts`, and only inside
 * a function, never at import time, so a unit test can stub the global.
 *
 * This file is a global script (no top-level import or export), the same shape
 * as `geo-assets.d.ts`: the app project includes every TypeScript file under
 * `src/`, and `tsconfig.test.json` lists it explicitly for the test project.
 */
declare const __GEO_CITY__: {
  /** The file name inside `geo-city-data/`, validated at build time. */
  file: string;
  /** The exact byte size of that file: the progress denominator. */
  bytes: number;
  /** The DB-IP month the file was derived from, `YYYY-MM`. */
  month: string;
  /** Lower-case hex SHA-256 of the file. */
  sha256: string;
  source: 'dbip' | 'fixture';
} | null;
