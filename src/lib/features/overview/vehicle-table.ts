/**
 * vehicle-table.ts — the ONE module that imports the generated table (13-02,
 * D-08, T-13-09).
 *
 * ## Why the import is STATIC and never dynamic
 *
 * A dynamic `import()` is a chunk request the browser makes AFTER the page
 * has loaded, and the zero-network contract counts it. The table is therefore
 * imported statically here, so the bundler inlines it into the worker chunk
 * exactly like the geo country table, and no request is ever made for it.
 *
 * ## Why this is the only importer
 *
 * The ESLint rule in `eslint.config.js` keeps the table out of the main
 * bundle: the page has no rows to feed a lookup, and the table is about
 * nineteen kilobytes gzipped that the main thread would carry for nothing.
 * The rule names the import specifier, so this module — which imports its
 * generated sibling — is the one path the rule exempts, beside the worker
 * directory itself.
 *
 * `overview-lookup.ts` imports NOTHING: the rows arrive as an argument, so
 * the lookup stays testable and the page never reaches the table by accident.
 */

import { createVehicleLookup } from './overview-lookup.ts';
import { VEHICLE_TABLE } from './vehicle-table.generated.ts';

/**
 * The lookup over the committed table.
 *
 * The table holds the maintainer-generated rows (the Terms-of-Use gate passed
 * in plan 13-15, D-07). A tank the table does not know — a retired or removed
 * one, or an invented tag in a test archive — is still a miss, and the page
 * falls back to the tag-derived name and an unknown class (D-09).
 */
export const defaultVehicleLookup = createVehicleLookup(VEHICLE_TABLE);
