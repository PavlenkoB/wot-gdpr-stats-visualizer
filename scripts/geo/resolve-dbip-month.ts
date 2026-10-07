/**
 * Print the DB-IP month a real download would resolve (phase 07, plan 07-02,
 * D-13, T-07-10, T-07-11).
 *
 * ## Why this script exists at all
 *
 * The deploy job's cache key has to name the month BEFORE the cache is restored,
 * because a cache key is what a restore is asked for. But the month is not a
 * constant: DB-IP publishes per month, drops old months, and may not have
 * published the current one yet — which is why `resolveDbipUrl` probes the
 * current UTC month and falls back exactly one month on a 404. So the key
 * cannot be written as a hard-coded string in the workflow, and the month
 * cannot be discovered after the restore, because by then the restore has
 * already been keyed on something else.
 *
 * Hence this script runs first, prints one `YYYY-MM` line, and the workflow
 * appends it to the step output the cache key reads.
 *
 * ## Why it uses the DOWNLOAD's own resolver
 *
 * The cache key and the download must not be able to disagree. If this script
 * re-implemented the month logic, a future change to `resolveDbipUrl` could
 * leave the two answering different months, and the result would be a cache
 * hit holding one month's data under another month's key. So this file calls
 * the same function `build-city-dataset.ts` calls, with the same real status
 * probe, and derives nothing of its own.
 *
 * ## What it prints, and what it does not
 *
 * Exactly one `YYYY-MM` line and a newline, on stdout, and nothing else — the
 * step output file takes one `name=value` per line, so a second line of
 * progress text would corrupt the key. A failure is NOT swallowed: if the
 * resolver throws (two 404s, a 403, a network error), the rejection propagates
 * and the process exits non-zero with nothing on stdout, so the cache step is
 * never keyed on an empty month.
 *
 * ERASABLE syntax only, because `tsconfig.node.json` sets `erasableSyntaxOnly`
 * and this runs through Node's native type stripping: no enum, no namespace,
 * no parameter property, no decorator.
 */

import { headStatus, resolveDbipUrl } from './lib/download.ts';

const resolved = await resolveDbipUrl('city', new Date(), headStatus);

process.stdout.write(`${resolved.month}\n`);
