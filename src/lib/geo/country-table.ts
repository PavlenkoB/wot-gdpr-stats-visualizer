/**
 * The inlined country table, decoded ONCE and on first use.
 *
 * ## Worker-only
 *
 * D-12 puts the whole range table inside the ingest worker at import time: the
 * main thread never loads it, never holds it, and never scans raw rows to work
 * out a country. This module is one of the worker-only modules
 * `no-restricted-imports` keeps off the main thread (see `eslint.config.js`
 * block 8, and the probes in `tests/unit/guards/lint-guards.test.ts`).
 *
 * ## Why the table is INLINED and never fetched (D-12, RESEARCH Decision 5)
 *
 * `?inline` makes the build embed the bytes in the worker chunk as a base64
 * data URL, so no request is made for the table and the zero-network check
 * after load still passes. The alternative — a separate asset fetched on first
 * lookup — would be a post-load request and would fail it. It would also mean
 * a second sanctioned network path in a product that has exactly one, which
 * plan 06-11 owns for the opt-in city dataset.
 *
 * The measured cost of inlining is accepted and recorded: 3,403,572 raw bytes
 * become roughly 4.5 MB of base64 text in the worker chunk, compressing back to
 * about the table's 725 KB gzipped on the wire, paid on every page load for a
 * table that is only needed once a dataset is loaded.
 *
 * ## Why the decode is LAZY (T-06-24)
 *
 * The worker spawns eagerly and posts `ready` first, before any export has
 * been dropped. Decoding 3.4 MB of base64 and building the typed arrays at
 * module load would put that cost in front of the first paint of an app that
 * may never import anything. The decode therefore runs on the FIRST
 * {@link getCountryTable} call — that is, the first login aggregation — and the
 * result is cached in module state for every lookup after it.
 *
 * A decode failure throws {@link RANGE_TABLE_ERROR}, the container's own fixed
 * string. The worker's aggregation try/catch turns a throw into no stored
 * aggregate and a `data-error` reply, so a corrupt table costs the user their
 * country column and not their import (the same rule T-04-03 states for
 * playtime, and T-06-01 keeps the detail a NAME and never a message).
 */

import countryData from '#geo/country-data?inline';
import { decodeRangeTable, RANGE_TABLE_ERROR, type RangeTable } from './range-table.ts';

/** The module-level cache. `null` means "not decoded yet", which is not the same as "failed". */
let cached: RangeTable | null = null;

/** One call decodes and caches; every call after it is a field read. */
function decode(): RangeTable {
  const bytes = dataUrlBytes(countryData);
  return decodeRangeTable(bytes);
}

/**
 * The country range table, decoded on first use.
 *
 * @throws the container's fixed {@link RANGE_TABLE_ERROR} when the inlined
 * data is not a base64 data URL or does not decode to a readable table.
 */
export function getCountryTable(): RangeTable {
  if (cached === null) cached = decode();
  return cached;
}

/**
 * The `data:` URL Vite produces for `?inline` to its raw bytes.
 *
 * The prefix is read rather than assumed, because Vite's own media type for an
 * unrecognised extension is not a contract this module should be quietly
 * dependent on: what matters is only that a base64 payload follows a comma.
 * Anything else — a truncated chunk, a string literal that survived some
 * future transform, a file that turned out to hold text — fails the same way
 * and with the same message.
 */
function dataUrlBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) throw new Error(RANGE_TABLE_ERROR);
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
