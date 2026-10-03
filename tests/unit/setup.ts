// Vitest runs unit tests under environment: 'node' (see vitest.config.ts),
// which has no `indexedDB` global (RESEARCH.md "Environment Availability"
// table). This polyfill must load before any Dexie import in any test
// file, or Dexie throws "IndexedDB API missing" at module-load time.
import 'fake-indexeddb/auto';

/**
 * Vitest setup file.
 *
 * Defines `$state` as a global identity function so that `.svelte.ts`
 * modules (e.g. `src/lib/import/worker-client.svelte.ts`) can be imported
 * and instantiated in plain Node tests without the Svelte compiler
 * being in the build pipeline. The unit tests in this directory
 * exercise the IngestClient state machine via its public fields
 * (state, stage, result, errorMessage, workerReady) and its
 * postMessage calls — none of those depend on rune reactivity.
 *
 * Why this is necessary:
 *
 *   - 01-04 introduces the first unit test that imports a `.svelte.ts`
 *     file. The Svelte 5 runes compiler normally rewrites `$state(x)`
 *     into reactive store reads/writes at compile time.
 *   - Adding the Svelte plugin to vitest.config.ts triggers a Vite
 *     prebundle pass that pulls in `svelte/internal/client` via the
 *     browser export condition. That pass hits a known Vite 8 +
 *     rolldown incompatibility (`node:module` cannot be resolved for
 *     `rolldown/runtime.js` when the browser condition is active),
 *     so the test runner fails at startup before any test runs.
 *   - This shim lets the test import the file directly: `$state(x)`
 *     becomes `x` (a passthrough), and the runes are inert. The
 *     compiler isn't in the pipeline so the file is loaded as
 *     ordinary ES module source.
 *
 * See `vitest.config.ts` for the wiring (`setupFiles`).
 */

// Note: Svelte 5 already declares `$state` as a global type via its runes
// types, so this file does not re-declare it. The runtime passthrough below
// is the only thing this setup file needs to add.
(globalThis as unknown as { $state: <T>(value: T) => T }).$state = <T>(value: T): T => value;

// -----------------------------------------------------------------------------
// Test-side locale pin (05-08, D-25)
// -----------------------------------------------------------------------------
// The app groups numbers by the VIEWER's locale, which is the right product
// behaviour and the wrong thing for an assertion to depend on: Node resolves
// its default locale from `LANG`/`LC_ALL`, so `(1204).toLocaleString()` is
// `1,204` on an en-US box, `1.204` on a de_DE one, and `1 204` on a uk_UA one.
// Every expectation in tests/unit is written in comma grouping, and that
// expectation is a statement about this code — not about the laptop it ran on.
//
// This is what RESEARCH.md "Pitfall 7" (formatting determinism) and the
// deferred `ui-copy.test.ts:207` failure both point at. The fix is deliberately
// on this side of the line: the production default stays the viewer's, and the
// tests declare which locale they are asserting in. Do not "fix" it by pinning
// a locale inside src/ — that re-introduces the Phase 4 behaviour of imposing
// the author's locale on the reader, and the 05-08 tracer asserts that this
// module is the only one that can pin anything at all.
import { setDefaultNumberLocale } from '../../src/lib/ui-copy';

setDefaultNumberLocale('en-US');

export {};
