---
phase: 01-ingest-foundation-zero-network-guard
reviewed: 2026-09-28T12:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - .claude/skills/run-data-export-viewer/driver.mjs
  - .claude/skills/run-data-export-viewer/SKILL.md
  - .github/workflows/ci.yml
  - .gitignore
  - .prettierignore
  - .prettierrc
  - .vscode/extensions.json
  - eslint.config.js
  - index.html
  - package.json
  - playwright.config.ts
  - public/favicon.svg
  - README.md
  - src/app.css
  - src/App.svelte
  - src/lib/components/CategoryBadge.svelte
  - src/lib/components/Dropzone.svelte
  - src/lib/components/FailureBanner.svelte
  - src/lib/components/ResultsView.svelte
  - src/lib/ingest-client.ts
  - src/lib/precheck.ts
  - src/lib/types/worker-messages.ts
  - src/lib/ui-copy.ts
  - src/lib/worker-client.svelte.ts
  - src/lib/worker/categories.ts
  - src/lib/worker/classify.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/zip-paths.ts
  - src/main.ts
  - svelte.config.js
  - tests/e2e/helpers.ts
  - tests/e2e/import-failure.spec.ts
  - tests/e2e/import-flow.spec.ts
  - tests/e2e/zero-network.spec.ts
  - tests/fixtures/export-fixtures.ts
  - tests/fixtures/README.md
  - tests/unit/classify.test.ts
  - tests/unit/ingest-client.test.ts
  - tests/unit/lint-guards.test.ts
  - tests/unit/setup.ts
  - tests/unit/ui-copy.test.ts
  - tests/unit/zip-paths.test.ts
  - tsconfig.app.json
  - tsconfig.json
  - tsconfig.node.json
  - tsconfig.test.json
  - vite.config.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-28T12:00:00Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

Reviewed the Phase 01 ingest-foundation-zero-network-guard deliverable: a privacy-focused, browser-only Wargaming GDPR data-export viewer built with Svelte 5 (runes), TypeScript 6, Vite 8, pnpm 12, Vitest, and Playwright. The phase covers the dropzone, root-detection + classifier for a zipped export, the typed worker contract, and the CI/network/lint guard.

The privacy-by-construction contract (zero network requests after page load) is well-defended: an aggressive ESLint ban on every common network API inside `src/` (including `src/lib/worker/`), a CSP meta injected at build time, and a Playwright spec that asserts no requests after baseline. The worker pipeline is correctly off the main thread with a single long-lived Worker instance. The pre-check + classifier pipeline is hardened against malformed input and the G-01-20 wrapper/rootless fix is implemented and tested.

One critical correctness defect found: the wrapper-descent retry in `classify.ts` returns the wrapper folder name itself as the displayed account root for a single-wrapper-around-categories shape (no inner account folder), contradicting the implementation comment. Six warnings cover secondary correctness gaps and operational robustness. Five info items cover style/config nits.

## Critical Issues

### CR-01: Wrapper retry returns wrapper name as accountRoot when wrapper sits directly above recognized categories

**File:** `src/lib/worker/classify.ts:228-255`
**Issue:** The `resolveAccountRootAndCategories` function's wrapper-descent retry is documented as returning "the innermost folder name, never a wrapper prefix" (lines 196-203 comment). However, when `detectRoot` finds a wrapper folder whose DIRECT child IS a recognized category (e.g., `personal_data_export/Activity_history/foo.csv` — wrapper around categories, no inner account folder), the loop never enters because `hasRecognizedCategory(counts)` is already true on the initial iteration. `displayRoot` retains its initial value `root` (the wrapper name), and the result reports the wrapper folder as the account root.

This contradicts the documented invariant and produces a misleading UI: the user sees `Account: personal_data_export` and could mistake it for their account ID. The current test suite (`buildWrapperExport`) only covers the wrapper-around-account-folder shape, not this one-wrapper-around-categories shape.

Example input that triggers the bug: `analyzeExport(['personal_data_export/Activity_history/foo.csv'])` returns `{ ok: true, result: { accountRoot: 'personal_data_export', categories: [{ name: 'Activity_history', status: 'supported', fileCount: 1 }] } }` instead of `{ ok: true, result: { accountRoot: '', categories: [...] } }` (the rootless fallback the comment promises).

**Fix:**
```typescript
// In resolveAccountRootAndCategories, when detectRoot returns non-null:
// If the root itself has recognized categories as direct children AND
// the root isn't itself a recognized category, the wrapper retry
// cannot apply — fall through to the rootless fallback.
if (root !== null) {
  const initialCounts = categoryFoldersUnder(root, prepared);
  if (hasRecognizedCategory(initialCounts)) {
    // Wrapper contains recognized categories directly — this is the
    // rootless shape (no account folder), but with one extra wrapper
    // around it. The rootless fallback handles it correctly.
    const counts0 = foldersAt('', prepared);
    if (hasRecognizedCategory(counts0)) {
      return { root: '', counts: counts0 };
    }
    return null;
  }
  // Strategy 1: wrapper-descent retry (existing code).
  ...
}
```

## Warnings

### WR-01: `onerror` after worker is ready does not mark the worker broken

**File:** `src/lib/worker-client.svelte.ts:99-116`
**Issue:** The `onerror` handler only marks the worker broken (`#workerBroken = true`) when state is `processing` OR the worker hasn't yet reported ready. If the worker emits `onerror` while in the `idle` state AND `workerReady === true` (e.g., a script crash during a quiescent moment between jobs), the handler logs the error but takes no permanent action. A subsequent `submitFiles` will pass the `!#workerBroken && workerReady` guard and call `postMessage` on a dead worker. The `postMessage` will either silently fail or throw, leaving the UI in an inconsistent state (state may stay `processing` while the worker never responds).

The comment on line 114-115 acknowledges this is "informational only" but the assumption that a worker error during idle is harmless is unsafe — the next submission will hang on the busy floor for 400 ms, then never settle because no terminal event ever arrives.

**Fix:** Track a worker-broken state independently of in-flight state. In the `onerror` handler:
```typescript
this.#worker.onerror = (event) => {
  console.error('[ingest] worker error:', event.message || 'unknown');
  this.#workerBroken = true; // worker errors are always fatal
  if (this.state === 'processing') {
    this.#scheduleSettle(() => this.#fail(`worker error: ${event.message || 'unknown'}`));
  } else if (!this.workerReady) {
    this.#fail('worker-not-ready');
  }
};
```
Add a test in `tests/unit/ingest-client.test.ts` that fires `onerror` while idle + ready and asserts `#workerBroken === true` and the next `submitFiles` fails fast.

### WR-02: CSP plugin order tie-breaking relies on registration order

**File:** `vite.config.ts:25-91`
**Issue:** Both `cspMeta` and `unescapeQuotes` use `order: 'post'` for `transformIndexHtml`. The implementation works only because Vite resolves same-order ties by plugin registration order, and `cspMeta` is listed first in the `plugins: [svelte(), cspMeta, unescapeQuotes]` array. A future contributor who reorders the plugins array, or a Vite version change in tie-breaking behavior, would silently break the meta-tag unescape step and cause the literal `&#39;` to ship in `dist/index.html`. The acceptance-criteria grep for `connect-src 'none'` would still match because the test uses `grep -q` (substring match), but the designer's intended `'` characters would be HTML-encoded `&#39;` in the served HTML — semantically equivalent for the browser but cosmetically off and a fragility signal.

The comment at line 35 acknowledges the build-time acceptance criteria grep but does not call out the order fragility.

**Fix:** Either give `unescapeQuotes` an explicit higher order (e.g., `order: 'post-post'`) or, preferably, fold the unescape into the `cspMeta` plugin itself so there is no second plugin to coordinate with. Example:
```typescript
const cspMeta: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      // ... inject tags ...
      return { html, tags: injected.tags };
    },
  },
  // Apply a second pass via the same plugin's other hook, e.g.
  // writeBundle, to unescape &#39; -> ' in the emitted HTML.
};
```

### WR-03: `categoryFoldersUnder` with empty root returns empty (footgun, not currently triggered)

**File:** `src/lib/worker/classify.ts:124-126`
**Issue:** `categoryFoldersUnder('', paths)` returns `foldersAt('/' , paths)` — but `prepare()` strips leading slashes, so the `p.startsWith('/')` check in `foldersAt` never matches. The function silently returns an empty map. This is not currently called with an empty root (the rootless path uses `foldersAt('', prepared)` directly), so the bug is latent. But the API is exported and the asymmetry between `categoryFoldersUnder(root)` (prefix includes trailing slash) and the internal `foldersAt('', prepared)` (no prefix) is undocumented.

**Fix:** Either remove the public surface (rename to private) or guard the public function:
```typescript
export function categoryFoldersUnder(root: string, paths: string[]): Map<string, number> {
  if (root === '') return new Map(); // explicit no-op for empty root
  return foldersAt(root + '/', paths);
}
```

### WR-04: `package.json` check script runs three sequential type-check passes

**File:** `package.json:11`
**Issue:** `"check": "svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json && svelte-check --tsconfig ./tsconfig.test.json"` runs two `svelte-check` invocations and one `tsc`. The two `svelte-check` calls (one for `src/`, one for `tests/`) duplicate the Svelte parser warm-up cost. Combined with a single `tsc` for `vite.config.ts`, this triples the type-check overhead in CI.

**Fix:** Use a single root `tsconfig.json` with project references and let `tsc -b` orchestrate. The existing `tsconfig.json` already declares references to `tsconfig.app.json` and `tsconfig.node.json`; add `tsconfig.test.json` as a third reference and run `tsc -b` once.

### WR-05: Playwright config `webServer.command` does not honor `pnpm test:e2e` exit timing reliably

**File:** `playwright.config.ts:30-35`
**Issue:** `webServer.command: 'pnpm run build && pnpm run preview'` builds then spawns `vite preview`. The skill README documents that the spawned `vite.js preview` process often does not receive signal through the `pnpm` -> `node` -> `vite.js` chain, causing the Playwright runner to hang on teardown (recorded as `webServer-teardown Gotcha`). This is a known operational hazard but it blocks `pnpm run test:e2e` from exiting cleanly, polluting the developer/CI loop. The `--signal` flag and `killTimeout` settings on `webServer` are not configured.

**Fix:** Use `webServer.command: 'pnpm run build && pnpm exec vite preview --port 4173 --strictPort'` and configure teardown explicitly:
```typescript
webServer: {
  command: 'pnpm run build && pnpm exec vite preview --port 4173 --strictPort',
  url: 'http://localhost:4173',
  reuseExistingServer: false,
  timeout: 120000,
  // Don't hang on teardown if the signal doesn't propagate.
  // (Playwright already kills the spawned process group via SIGTERM
  //  by default; the issue is the child pnpm process tree.)
},
```
If this doesn't resolve the hang, switch to using `pnpm exec vite preview` directly (skip the pnpm process entirely) so the signal goes straight to the node process.

### WR-06: Rootless fallback path is unreachable when `detectRoot` returns a single segment that's not the account folder

**File:** `src/lib/worker/classify.ts:228-263`
**Issue:** When `detectRoot` returns a single top-level segment, the code enters the wrapper-descent branch and never falls through to the rootless fallback (line 256-261), even when the wrapper retry fails to find a recognized category. If the wrapper retry exhausts `MAX_WRAPPER_DEPTH` without success, the function returns `null` and the caller falls through to the pre-existing reason-classification chain (line 353-360), which classifies the archive as `no-single-root` — even when the rootless fallback would have succeeded.

Example: `['WrapperName/Activity_history/foo.csv', 'WrapperName/Payment_history/bar.csv']` — a single wrapper around two recognized categories (no inner account folder). `detectRoot` returns `WrapperName`; the retry tries `categoryFoldersUnder('WrapperName')` which returns `Map('Activity_history' => 1, 'Payment_history' => 1)`; `hasRecognizedCategory` is true; loop skipped; return `{ root: 'WrapperName', counts }` (the CR-01 bug). The rootless fallback is never consulted.

The rootless fallback should at least be tried when the wrapper retry returns null. Even fixing CR-01, an archive like `['WrapperName/Activity_history/foo.csv', 'WrapperName/Unrecognized/bar.csv']` (wrapper around mixed content) currently returns `{ root: 'WrapperName', counts }` with one recognized entry, but a more correct answer might be the rootless fallback `Map('Activity_history' => 1)`.

**Fix:** After the wrapper retry returns null, attempt the rootless fallback before falling through to the named-reason chain:
```typescript
if (root !== null) {
  // ... existing wrapper retry ...
  if (hasRecognizedCategory(counts)) {
    return { root: displayRoot, counts };
  }
  // Wrapper retry exhausted; try rootless fallback before failing.
  const counts0 = foldersAt('', prepared);
  if (hasRecognizedCategory(counts0)) {
    return { root: '', counts: counts0 };
  }
  return null;
}
```

## Info

### IN-01: `tsconfig.app.json` missing `verbatimModuleSyntax: true`

**File:** `tsconfig.app.json:1-23`
**Issue:** Both `tsconfig.node.json` and `tsconfig.test.json` set `verbatimModuleSyntax: true`, but `tsconfig.app.json` (which checks `src/`) does not. Inconsistent module syntax enforcement across the three tsconfigs.

**Fix:** Add `"verbatimModuleSyntax": true` to `tsconfig.app.json` if the project intends consistent module syntax handling, or document why `src/` is the exception.

### IN-02: `tsconfig.app.json` has `checkJs: true` but no JS files exist

**File:** `tsconfig.app.json:18`
**Issue:** `"checkJs": true` is set, but the project contains no `.js` files in `src/` (verified — only `.svelte` and `.ts`). The flag is a no-op but adds compile overhead.

**Fix:** Remove `"checkJs": true` or document its purpose as future-proofing for when JS lands.

### IN-03: `driver.mjs` uses `--no-sandbox` Chromium flag

**File:** `.claude/skills/run-data-export-viewer/driver.mjs:62`
**Issue:** `chromium.launch({ args: ['--no-sandbox'] })` disables the Chromium sandbox. This is a documented workaround for running as root in Docker but reduces process isolation. Acceptable for a local dev driver, but the comment should call out the security tradeoff.

**Fix:** Add a comment explaining the sandbox trade-off and a TODO to make the flag conditional on `process.geteuid?.() === 0`:
```javascript
const isRoot = process.geteuid?.() === 0;
const browser = await chromium.launch({
  args: isRoot ? ['--no-sandbox'] : [],
});
```

### IN-04: `index.html` ships without CSP — dev mode has no network-request guard

**File:** `index.html:1-17`
**Issue:** The CSP meta tag is injected at build time by the Vite plugin. `pnpm run dev` (which uses Vite's dev server with HMR) produces HTML without CSP. This is documented and intentional (HMR websocket would be blocked), but a developer accidentally testing against the dev server in Playwright would see no network assertion. The `tests/e2e/zero-network.spec.ts` correctly tests against the built app, but the README's "verify the privacy guarantee" section does not warn that dev mode is unguarded.

**Fix:** Add a one-line note in `README.md`'s "Verifying the privacy guarantee" section that the zero-network assertion only applies to `pnpm run preview` / CI, not `pnpm run dev`.

### IN-05: `svelte.config.js` is an empty object

**File:** `svelte.config.js:1-3`
**Issue:** The config exports `{}`. The comment notes this is typed against `@sveltejs/vite-plugin-svelte`'s `SvelteConfig` but contains no overrides. Functionally fine — Svelte 5's defaults are used — but the file could be deleted entirely if Vite picks up the defaults.

**Fix:** Delete the file if no future Svelte overrides are anticipated, or add a TODO comment explaining why the empty export is kept (e.g., to give plugin tooling a config to read).

---

_Reviewed: 2026-09-28T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_