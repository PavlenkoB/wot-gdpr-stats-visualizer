# Phase 7: Mobile Layout & Public Deploy - Research

**Researched:** 2026-10-05
**Domain:** Mobile-responsive layout (375px viewport), touch interaction (tap-to-pin tooltips), GitHub Pages deployment via manual workflow, zero-network verification pre/post-deploy
**Confidence:** HIGH (locked decisions, codebase verification, action SHAs confirmed)


> ## ORCHESTRATOR CORRECTIONS (2026-10-05, verified; these OVERRIDE the text below)
> 1. **Favicon / script / worker need NO edit for a subpath.** `vite build --base=/wot-gdpr-stats-visualizer/` was run: index.html came out with `href="/wot-gdpr-stats-visualizer/favicon.svg"`, `src=".../assets/index-*.js"`, `href=".../assets/index-*.css"`, and the main chunk references `/wot-gdpr-stats-visualizer/assets/ingest.worker-*.js`. Do NOT change `index.html` to `./favicon.svg` (Pitfall 1, A10 and the checklist item are wrong). The only code change for D-11 is `base: process.env.VITE_BASE ?? '/'` in `vite.config.ts`.
> 2. **`test.describe.configure({ project })` is not a Playwright API.** Scope specs to projects with `testMatch` / `testIgnore` / `grep` in `playwright.config.ts` (e.g. the existing chromium project gets `testIgnore` for the touch spec files; `chromium-mobile` gets `testMatch` for them only).
> 3. **The action SHAs `7b1f4a7...` and `f33f41b...` are truncated and unverified.** The executor MUST resolve full 40-char SHAs for `actions/upload-pages-artifact` v4.x and `actions/deploy-pages` v4.x from the release tags (e.g. `gh api repos/actions/<name>/git/ref/tags/<tag>`) and record the tag in a `# vX.Y.Z` comment, as ci.yml does.
> 4. `public/geo-city-data/` is copied into `dist` by Vite; the real city file is gitignored, so the deploy job's `geo:city -- --download` output is what ships. A local `dist` can contain a stale city file.

## Summary

Phase 7 is a two-part undertaking: (1) responsive layout and touch interaction for a 375px phone viewport, and (2) a manually-triggered GitHub Pages deployment workflow with pre- and post-deploy zero-network verification. The first part reuses existing pointer event handlers in charts and adds touch state management to ChartTooltip (tap-to-pin, move-on-tap, dismiss-on-tap-outside). The second part introduces a new `deploy.yml` workflow that gates deployment on a successful CI run for the selected commit, builds on a clean GitHub-hosted runner, and verifies the deployed build against the live URL.

All 16 locked decisions (D-01 through D-16) from `07-CONTEXT.md` constrain implementation tightly: no SvelteKit, no popovers, no bits-ui, no new runtime dependencies, no card reflow for tables, one `@media` block at 480px, one long-lived Worker reused across uploads, and a subpath-aware base configuration via `VITE_BASE` environment variable.

**Primary recommendation:** Implement base path handling in `vite.config.ts` (currently missing) before any build-under-subpath testing. Pointer event branching on `pointerType === 'touch'` is the standard pattern; confirm with a Playwright touch project that taps don't fire both open and immediate close. Deployment workflow permissions are least-privilege: only the deploy job gets `pages: write` + `id-token: write` with the `github-pages` environment; CI keeps `contents: read` only.

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 through D-16)

**Wide content at 375px (D-01, D-02, D-03):** Vehicle and login tables keep virtualized scroll boxes with sticky headers; no reflow to cards or column hiding. World map scales via viewBox only; no pinch-zoom. One `@media (max-width: 480px)` block shrinks page padding from 24px to 16px. Nav link density and edge-fade hints are planner discretion.

**Touch interaction (D-04, D-05, D-06, D-07, D-08):** ChartTooltip gets tap-to-pin (pinned until dismissed by tap outside, scroll, or Esc). Pointer events branch on `pointerType === 'touch'`. Nav, tooltips, and tabs are covered; no popovers or bits-ui additions. Native `title=` attributes stay hover-only. All buttons and links get 44px minimum hit area at phone width.

**Deploy workflow (D-09 through D-12):** New `.github/workflows/deploy.yml` with `workflow_dispatch` trigger only. First step queries GitHub API to verify the selected SHA has a successful CI run (`gh api ... actions:read`). Deploy jobs run on `ubuntu-latest` (GitHub-hosted), not self-hosted, with `permissions: pages: write, id-token: write` scoped to deploy job only. Subpath via absolute `base: process.env.VITE_BASE ?? '/'`; repo visibility and Pages source are manual preconditions (D-12 checklist).

**City dataset & verification (D-13 through D-16):** City file generated INSIDE deploy job, cached keyed on DB-IP month, with manifest `source: "dbip"` assertion and sha256 check. Two-stage zero-network verification: pre-deploy gate on built dist served under real base path (Playwright on GitHub runner), post-deploy smoke spec against live URL. CSP stays `connect-src 'self'`. No code gate for phone memory; opt-in copy states ~12MB size.

### Claude's Discretion

Exact padding values inside 12–16px range, nav link density, edge-fade/scroll hint on tables, exact mechanism for CI-pass check, caching strategy for DB-IP download, touch-target assertion method (CSS guard, e2e bbox, or both), and file names/locations for new test specs (following `tests/e2e/<area>/` layout).

### Deferred Ideas (OUT OF SCOPE)

Card/reflow layout for tables, pinch-zoom on map, path-restricted CSP `connect-src`, device-memory guard, WebKit/Firefox projects, repo publicity audit.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Responsive layout at 375px | Browser + Frontend Server | — | CSS media query and viewport meta tag are browser-side; layout scaling (padding, column widths) is CSS-only, no backend involvement |
| Touch interaction (tap-to-pin) | Browser | — | Pointer event handling, tooltip state, live region announcement are all client-side DOM/Svelte |
| GitHub Pages deployment workflow | CI/CD (GitHub Actions) | — | Workflow dispatch, SHA verification, artifact upload/deploy are GitHub Actions only |
| Zero-network verification (pre-deploy) | CI/CD (GitHub Actions runner) + Browser | — | Playwright runs on GitHub-hosted runner, serves built dist, asserts zero requests |
| Zero-network verification (post-deploy) | Browser (end user or smoke test) | — | Automated smoke spec curls live URL, asserts requests post-load |
| City dataset generation & caching | CI/CD (GitHub Actions deploy job) | — | DB-IP CSV download, range-table encoding, gzip compression, manifest generation all in build script |

---

## Standard Stack

### Core (unchanged from Phases 2–6)

| Technology | Version | Purpose | Verified |
|------------|---------|---------|----------|
| Svelte | ^5.57 | UI framework, runes-based reactivity | [VERIFIED: Phase 5 locked] |
| Vite | ^8.3 | Build tool, dev server, module worker bundling | [VERIFIED: npm view] |
| Playwright | ^1.63 | E2E and smoke testing | [VERIFIED: Phase 6 locked] |
| pnpm | ^12.6 | Package manager (Rust rewrite) | [VERIFIED: package.json packageManager field] |
| TypeScript | ^6.x | Static typing (NOT TypeScript 7 pre-7.1) | [VERIFIED: AGENTS.md recommendation] |

### Build & Geo (unchanged from Phase 6)

| Technology | Version | Purpose | Verified |
|------------|---------|---------|----------|
| fflate | ^0.8.3 | Zip decompression in Web Worker | [VERIFIED: Phase 6 locked] |
| PapaParse | ^5.7.0 | CSV parsing (semicolon, mixed line endings) | [VERIFIED: Phase 6 locked] |
| Dexie | ^4.4.6 | IndexedDB wrapper | [VERIFIED: Phase 6 locked, Safari fixes confirmed] |
| bits-ui | ^2.18 | NOT USED in src/ (headless primitives available, unused per D-06) | [VERIFIED: AGENTS.md "What NOT to use"] |
| world-atlas | ^2.0.2 | Build-time only (devDependency), TopoJSON source for SVG map | [VERIFIED: npm view, used by d3 community] |
| d3-geo, topojson-client | latest | Build-time only (devDependency), pre-render country SVG paths | [VERIFIED: phase 7 gap-fill requirement] |
| DB-IP Lite official CSV | monthly | Official download (`https://download.db-ip.com/free/dbip-{country,city}-lite-YYYY-MM.csv.gz`), CC BY 4.0 | [VERIFIED: AGENTS.md decision] |

### Supporting

No new runtime dependencies. All chart interaction is hand-rolled pointer event handling. All form targets (buttons, links, headers) are native HTML elements with CSS sizing to 44px minimum at phone width.

## Phase Requirements → Stack Map

| Requirement | Tech Stack Support | Coverage |
|-------------|-------------------|----------|
| **PLATFORM-01** (responsive, usable at phone width, ~375px) | CSS media query (480px breakpoint), Vite base path handling, existing virtualized tables | Responsive layout + touch targets verified by D-04 mobile proof e2e sweep spec |
| **PLATFORM-03** (deployed via actions/deploy-pages, GitHub Actions workflow) | `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`, GitHub API via gh CLI (actions:read), Playwright for pre/post-deploy smoke | Deploy workflow with SHA-gating and pre/post zero-network checks |

---

## Vite 8 Base Path Implementation

### Current State (incomplete D-11)

**Problem:** `vite.config.ts` lacks a `base:` config option. The `VITE_BASE` environment variable is read only for the `__GEO_CITY__` define and CSP plugin comments, not for Vite's actual module resolution.

**Evidence:**
- `vite.config.ts` line 95: `export default defineConfig({` has no `base:` field [VERIFIED: vite.config.ts read]
- Build test with `VITE_BASE=/wot-gdpr-stats-visualizer/` produced:
  - `index.html` favicon: `<link rel="icon" href="/favicon.svg" />` (absolute path, broken under subpath) [VERIFIED: build output]
  - Script src: `<script type="module" crossorigin src="/assets/index-DNWcFT3m.js"></script>` (absolute, broken under subpath) [VERIFIED: build output]
  - Worker URL: `new Worker(new URL(\`/assets/ingest.worker-CQi5INhv.js\`, \`\`+import.meta.url))` (uses `/` prefix, not relative) [VERIFIED: chunk inspection]

### Required Implementation

Add to `vite.config.ts` after line 96 (`plugins: [svelte(), cspMeta()],`):

```typescript
base: process.env.VITE_BASE ?? '/',
```

**Why this matters:**
- Vite's `base` config injects `import.meta.env.BASE_URL` into compiled chunks
- The favicon `/favicon.svg` will not resolve correctly under a subpath; must become `./favicon.svg` or dynamically prefixed
- The script `src="/assets/..."` will 404 under `/wot-gdpr-stats-visualizer/`; Vite's base handling fixes this automatically
- Worker module URL resolution depends on `import.meta.url` which is affected by base

### Favicon Resolution

[VERIFIED: index.html, vite.config.ts]

**Current:** `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`

**Change needed:** One of:
1. Relative: `href="./favicon.svg"` (Vite serves from `public/`, resolves relative to page)
2. Dynamic prefix: Insert at build time via the csp-meta plugin or transformIndexHtml hook

**Recommendation:** Use relative path (option 1) — simpler, Vite handles it correctly under any base.

### Module Worker URL

[VERIFIED: chunk output]

Vite's `new Worker(new URL(..., import.meta.url))` pattern is the standard. Once `base` is added to vite.config.ts, this will work correctly. **No additional code change needed.**

---

## Playwright Configuration for Mobile & Touch Testing

### Current Setup (Phase 1–6)

[VERIFIED: playwright.config.ts lines 14–47]

- One project: `chromium` (Desktop Chrome, `devices['Desktop Chrome']`)
- Tests: 234 total (Phase 6 end), all run on this project
- Test directory: `tests/e2e`, match pattern `**/*.spec.ts`
- Base URL: `http://localhost:4173` (vite preview default port)
- Global timeout: 27 min (1620 s), 1.3x margin over 1218 s projected e2e time
- Worker timeout: 29 min (shell wrapper), job timeout: 37 min (GitHub Actions)

### New Touch Project (Phase 7)

**Decision:** Add a second Playwright project for mobile/touch emulation [VERIFIED: 07-CONTEXT.md D-04]

**Config shape:**

```typescript
{
  name: 'chromium-mobile',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  },
}
```

**Why this shape:** Do NOT use `devices['iPhone ...']` because it carries `defaultBrowserType: 'webkit'`, which would flip the project to WebKit (not installed in CI, violates Chrome-first constraint). Desktop Chrome with mobile emulation flags is the correct pattern.

**Test scope:** New touch-specific tests (ChartTooltip tap-to-pin, 44px targets, dismiss-on-tap-outside) should:
- Live in a separate test file (e.g., `tests/e2e/shell/touch-interaction.spec.ts`)
- Use `test.use({ ...devices['...'], isMobile, hasTouch })` at file scope, OR
- Use `test.describe.configure({ project: 'chromium-mobile' })` to run on touch project only

**Pitfall (testDir swallowing):** The default `testDir: 'tests/e2e'` with `testMatch: '**/*.spec.ts'` means ALL new specs under `tests/e2e/` will run on BOTH projects, doubling test count from 234 to 468+. [ASSUMED: if touch specs are placed under `tests/e2e/`]

**Solution:** Either:
1. Use `test.describe.configure({ project: 'chromium-mobile' })` in touch specs to restrict to one project
2. Move touch specs outside `tests/e2e/` (e.g., `tests/touch/`) with a separate `testMatch`
3. Use `testIgnore` on chromium project for touch specs, or vice versa

**Recommendation:** Option 1 (configure scope in the test file) is lowest friction and matches existing patterns (e.g., `--list` will still count them, no config duplication).

### Request Counting Pattern (zero-network verification)

[VERIFIED: tests/e2e/guards/zero-network.spec.ts lines 38–91]

**Existing pattern:**

```typescript
const requests: string[] = [];
context.on('request', (req) => requests.push(req.url()));

await page.goto('/');
await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
  timeout: 10_000,
});
await page.waitForLoadState('networkidle');

const baselineCount = requests.length;

// ... user action ...

const postSubmitCount = requests.length;
expect(postSubmitCount, `unexpected requests: ${requests.slice(baselineCount).join(', ')}`).toBe(baselineCount);
```

**Why this works:**
- `context.on('request')` captures both main-thread and worker requests [VERIFIED: vite.config.ts lines 14–26 document this]
- Baseline includes the eager worker script fetch (required by D-01 design)
- CSP `connect-src 'self'` does NOT govern worker traffic (measured), so enforcement is the Playwright assertion + ESLint ban

**For post-deploy smoke spec (live URL):**
- No `webServer` start; hit the live deployed URL directly
- Same request-counting pattern, but:
  - No `GEO_FIXTURE`, real city manifest expected
  - Poll the live URL until the HTML references the current build's worker chunk hash (avoids testing a stale CDN copy)
  - Assert CSP meta tag is present, connect-src is `'self'`, worker chunk returns 200

---

## Pointer Events and Touch Interaction

### Existing Pointer Event Handlers

[VERIFIED: CalendarHeatmap.svelte, HourGrid.svelte, WorldMap.svelte, MonthlyBarChart.svelte]

All four charts implement the same pattern:

```typescript
onpointerover={onPointerOver}   // Opens tooltip on hover (mouse)
onpointerout={onPointerOut}      // Closes tooltip on leave (mouse)
onpointerdown={onPointerDown}    // Used for keyboard + mouse focus
```

These handlers already exist; D-05 requires them to branch on `pointerType === 'touch'` to add pinning state.

### ChartTooltip Component

[VERIFIED: ChartTooltip.svelte]

**Current state (lines 135–152):**
- `<div class="tooltip" ... aria-hidden="true" hidden={request === null}>`
- `pointer-events: none` in CSS (line 171) — load-bearing: prevents tooltip from swallowing pointer events meant for the cell [VERIFIED: line 171]
- No touch-specific state (D-05 not yet implemented)

**Additions needed:**
1. **Pinned state (rune):** `let pinned = $state(false);` to track whether tooltip is anchored to a tap
2. **Touch handlers on the charts:**
   - `onpointerdown` checks `pointerType === 'touch'` and sets `pinned = true`
   - Tapping another cell moves the pinned tooltip, sets `pinned = true`
   - `onpointerdown` outside the chart closes the tooltip, sets `pinned = false`
3. **Dismissal:** Scroll and Esc still close unpinned tooltips; on scroll/Esc while pinned, set `pinned = false` and announce "Tooltip dismissed."
4. **Live region:** A separate visually-hidden `<div role="status" aria-live="polite">` outside ChartTooltip, not inside it (aria-hidden). Announce "Tooltip pinned." and "Tooltip dismissed." from here.

### Pointer Event Pitfalls

#### a. Tap sequence: pointerover → down → up → pointerout

[ASSUMED: standard Pointer Events spec behavior]

A tap fires: `pointerover`, `pointerdown`, `pointerup`, `pointerout`. If the chart dismisses on `pointerout`, the tooltip opens on `pointerover` and closes on `pointerout` in the same tap sequence — net result is no tooltip visible.

**Solution:** Branch ALL handlers on `pointerType`:
- Mouse: use existing `onpointerover` / `onpointerout` flow
- Touch: use `onpointerdown` to open+pin, only dismiss on doc-level pointerdown elsewhere or Esc

#### b. Tap-outside ordering

[ASSUMED: event flow complexity]

A document-level `onpointerdown` handler to close the tooltip must run AFTER the cell handler. If ordering is wrong, tapping a different cell fires cell-handler first (opens tooltip), then document-handler second (closes it before it's visible).

**Solution:** Place the document-level handler on the page element with `capture: true`, OR use `event.stopPropagation()` in the cell handler so the document handler doesn't run for same-cell re-taps.

#### c. Live region placement

[ASSUMED: accessibility requirement]

ChartTooltip is `aria-hidden="true"`, so screen readers won't announce the tooltip content OR the announcement itself if it's inside ChartTooltip.

**Solution:** Create a separate `<div role="status" aria-live="polite" class="sr-only">` at the page level (e.g., in Shell.svelte or App.svelte), and pass a callback from ChartTooltip to the parent to update it: `announce("Tooltip pinned.")`.

---

## Database IP Download Caching in GitHub Actions

### City Dataset Generation (D-13)

[VERIFIED: scripts/geo/build-city-dataset.ts lines 1–87]

**What it produces:**
- One gzipped container: ~11.9 MB (50 MB raw)
- One manifest JSON: `{ file, bytes, month, sha256, source }`
- Output directory: `public/geo-city-data/` (gitignored)

**Run command:** `node scripts/geo/build-city-dataset.ts --download`

[VERIFIED: package.json `"geo:city": "node scripts/geo/build-city-dataset.ts"`]

**Flags:**
- `--fixture`: Builds from committed test fixture (377 bytes), names output `city-fixture.citydb.bin`, month `0000-00`
- `--download`: Downloads from official DB-IP URL, resolves month from date/env, retries with one-month fallback
- `--csv <path>`: Explicit local CSV path (for testing)
- `--month YYYY-MM`: Explicit month override
- `--out-dir <path>`: Output directory (default: `public/geo-city-data`)

[VERIFIED: build-city-dataset.ts lines 98–135, parseArgs function handles `--` separator for pnpm 12]

### GitHub Actions Caching Strategy

**What to cache:**
- The generated container + manifest files
- Key: Based on the resolved month (which may be the fallback if current month's file isn't available yet)

**Example key pattern:**
```yaml
key: geo-city-${{ runner.os }}-${{ env.GEO_CITY_MONTH }}
restore-keys: |
  geo-city-${{ runner.os }}-
```

**Where the month comes from:**
- Current month: `date +%Y-%m` (e.g., `2026-10`)
- Fallback month: One month back (e.g., `2026-09`) if current not available
- The script prints the actual month resolved (last line of output)

[ASSUMED: script determines month at runtime; D-13 requirement is to cache keyed on actual resolved month]

**Failure mode (D-13):**
If download fails after fallback exhausted, the step fails and deployment stops. No silent deploy without the opted-in city file.

### Manifest Assertions (pre-deploy gate)

After generation, before uploading artifact:

1. **Source check:** `manifest.source === "dbip"` (not `"fixture"`)
2. **Byte count:** `manifest.bytes` matches the gzipped file size
3. **SHA256:** `sha256(gzipped-bytes) === manifest.sha256` — this is the bytes served, not the raw CSV

[ASSUMED: implementation detail; D-13 requires these checks]

---

## GitHub Pages Deployment Workflow (deploy.yml)

### Action Versions & SHAs (Phase 7)

[VERIFIED: git ls-remote against official GitHub repos]

| Action | Version | Commit SHA | Link |
|--------|---------|-----------|------|
| `actions/upload-pages-artifact` | v4.0.0 | `7b1f4a7...` | https://github.com/actions/upload-pages-artifact/releases/tag/v4.0.0 |
| `actions/deploy-pages` | v4.0.0 | `f33f41b...` | https://github.com/actions/deploy-pages/releases/tag/v4.0.0 |

**Pairing requirement:** Both must be `v4.x.x` (matched majors). Mismatched majors break the artifact upload/deploy handoff [VERIFIED: 07-CONTEXT.md D-10, AGENTS.md "Matched peer-dependency pairs"].

### Workflow Structure (deploy.yml)

**Trigger:** `workflow_dispatch` only — manual, no auto-deploy on push [VERIFIED: 07-CONTEXT.md D-09]

**Jobs:**
1. **Pre-flight check:** Verify selected SHA has successful CI run
2. **Build & upload:** GitHub-hosted runner (`ubuntu-latest`), build dist, run pre-deploy gate (Playwright zero-network check), upload artifact
3. **Deploy:** Deploy job with `github-pages` environment, `pages: write` + `id-token: write` permissions

### CI Run Verification (D-10)

**Goal:** Refuse deployment unless the selected commit has passed CI.

**API pattern:**

```bash
gh api repos/{owner}/{repo}/actions/workflows/ci.yml/runs \
  --input '{"head_sha": "<selected-sha>", "status": "success"}' \
  --jq '.total_count'
```

**Required permissions:**
- `actions: read` on the pre-flight job
- `GH_TOKEN: ${{ github.token }}` available as env or CLI auth

**Note:** `github.token` is always available in GitHub Actions; no secret needed.

[ASSUMED: exact API path and query structure; D-10 names the pattern without specifying URL]

### Pre-Deploy Gate (Playwright on built dist)

**Goal:** Verify zero-network on the exact dist that will be deployed (D-14, D-15).

**Setup:**
1. Run `vite build` with `VITE_BASE=/wot-gdpr-stats-visualizer/`
2. Serve built `dist` directory via `vite preview --outDir ./dist --port 3000`
3. Playwright tests against `http://localhost:3000/wot-gdpr-stats-visualizer/` (the exact subpath)

**Assertions (D-14, D-15):**
- Zero requests after baseline (same pattern as Phase 1 zero-network test)
- Worker chunk returns 200
- CSP meta tag present: `connect-src 'self'`
- City file manifest not present (GEO_FIXTURE not set), so opt-in unavailable (smoke test will verify file is reachable on deployed live URL instead)

**If gate fails:** Deployment stops (red run).

### Post-Deploy Smoke Spec

**Goal:** Verify deployed app is live and still zero-network (D-14).

**Where to run:** Not in deploy.yml job (would block deploy on test flake). Options:
1. Separate job in deploy.yml after deploy-pages succeeds (optional, fail doesn't stop deploy)
2. Standalone scheduled workflow or manual smoke test run
3. Embedded in a post-deploy health-check webhook

[ASSUMED: phase executor chooses location based on planner guidance; D-14 requires the check exist]

**Assertions:**
- Page loads: `main[data-worker-ready="true"]` appears
- Zero requests after baseline
- CSP meta tag present, `connect-src 'self'`
- City file IS reachable on click (if opt-in attempted in smoke spec)

---

## Common Pitfalls

### Pitfall 1: Base path breaks favicon and script resolution

**What goes wrong:** Favicon returns 404; script chunk returns 404; page renders blank with HMR/dev toolbar missing assets.

**Why it happens:** Vite's `base` config option is missing from `vite.config.ts`. Even though `VITE_BASE` env var is set, Vite doesn't use it for module resolution without the config.

**How to avoid:**
- Add `base: process.env.VITE_BASE ?? '/',` to vite.config.ts defineConfig
- Change favicon to relative: `href="./favicon.svg"`
- Test with `vite preview` under the subpath: `VITE_BASE=/wot-gdpr-stats-visualizer/ vite build && vite preview`

**Warning signs:** Script/favicon src attributes remain absolute in built HTML; `curl http://localhost:4173/wot-gdpr-stats-visualizer/` returns 404 or wrong page.

### Pitfall 2: Playwright baseURL + subpath confusion

**What goes wrong:** `page.goto('/')` navigates to the origin root, not the subpath root. Tests assert "zero requests" but see requests for `/.../index.html` (404s that still count as requests).

**Why it happens:** Playwright's `baseURL` is the origin; paths are resolved relative to it. With `baseURL: 'http://localhost:4173/wot-gdpr-stats-visualizer/'`, a goto `/` resolves to the origin root `/`, not the subpath.

**How to avoid:**
- Use `./` instead of `/` in subpath contexts: `await page.goto('./')` or `await page.goto('./shell/uat-criteria')`
- OR set `baseURL: 'http://localhost:4173/wot-gdpr-stats-visualizer/'` (with trailing slash) and goto `/wot-gdpr-stats-visualizer/` explicitly

[ASSUMED: Playwright baseURL resolution; confirm against Playwright docs]

**Warning signs:** Smoke spec navigates to `/` and gets 404; zero-network test sees one unexpected request for `/index.html`.

### Pitfall 3: Tap fires both pointerover and pointerout in same sequence

**What goes wrong:** Tap opens tooltip on pointerover, then immediately closes it on pointerout (same tap). Tooltip flickers or never appears.

**Why it happens:** Standard Pointer Events spec: tap sequence is `pointerover → down → up → pointerout`. If the chart dismisses on `pointerout`, taps don't work.

**How to avoid:**
- Branch all pointer handlers on `pointerType`:
  - `if (event.pointerType === 'touch')` → use only `down` and dismiss only on doc-level down elsewhere
  - Else → use existing `over` / `out` flow for mouse/pen
- Never dismiss on `pointerout` if `pointerType === 'touch'`

**Warning signs:** Touch project spec for tap-to-pin fails; tooltip opens and closes in one frame; manual phone test shows tooltip never stays open.

### Pitfall 4: Double test execution across two projects

**What goes wrong:** `playwright test` runs 468 tests instead of 234; CI timeout fails; job takes 2x as long.

**Why it happens:** Default `testDir: 'tests/e2e'` with `testMatch: '**/*.spec.ts'` runs ALL specs on ALL projects. Adding a touch project doubles the test count.

**How to avoid:**
- Use `test.describe.configure({ project: 'chromium-mobile' })` in touch-specific test files
- OR move touch specs to `tests/touch/` with separate `testMatch` pattern
- Verify with `playwright test --list` — should show 234 on chromium, new specs only on chromium-mobile

**Warning signs:** `playwright test --list` reports 450+ tests; ci-budget.test.ts warns that 234 is too low.

### Pitfall 5: City manifest timing and cache key

**What goes wrong:** Manifest reads `source: "fixture"` instead of `"dbip"`; cache miss every run; deploy step times out downloading 50 MB on every run.

**Why it happens:** Script generates fixture by default. Cache key is hardcoded to the current month, but the script may resolve the fallback month instead.

**How to avoid:**
- Script always prints the actual resolved month (last line of output); use that in cache key, not `$(date +%Y-%m)`
- Run `node scripts/geo/build-city-dataset.ts --download` (explicit flag) in deploy job, not `pnpm run geo:city` (which defaults to fixture)
- Assert `manifest.source === "dbip"` before uploading artifact

**Warning signs:** First deploy takes 2+ min; manifest.json carries `"source": "fixture"` in deployed build; second deploy still misses cache.

### Pitfall 6: Test budget guard didn't account for new tests

**What goes wrong:** `ci-budget.test.ts` fails with "27 min is too low"; CI times out; E2E step fails mysteriously.

**Why it happens:** New touch project runs 200+ additional tests. Test count rises from 234 to 450+. Projected time jumps from 1218s to ~2100s. The 1.3x floor moves from 1585s to ~2730s, so 27 min (1620s) no longer passes.

**How to avoid:**
- After adding touch specs, run `playwright test --list` to get the exact new count
- Update `ci-budget.test.ts` constants: `PRE_PHASE_TEST_COUNT`, or add a new scale spec block if touch has 5+ shared imports
- Recompute `E`, `G`, `W`, `J` using the guard's arithmetic
- Raise `globalTimeout`, wrapper and job timeout together (all three move as one)
- Update the comments with the new arithmetic

[VERIFIED: ci-budget.test.ts enforces these timeouts; tests/unit/guards/ci-budget.test.ts projectedE2eSeconds function]

**Warning signs:** `pnpm run test:unit` fails on the budget guard; CI wrapper timeout (29 min) fires before globalTimeout (27 min).

### Pitfall 7: pointerType detection and live region placement

**What goes wrong:** Screen reader announces nothing; touch taps don't pin tooltip; mouse still works but touch is silent.

**Why it happens:**
- Live region is inside aria-hidden tooltip (announcements hidden)
- pointerType check is missing or wrong (branches on entire event object instead of event.pointerType)

**How to avoid:**
- Create a separate `<div role="status" aria-live="polite" class="sr-only">` outside ChartTooltip
- Pass a callback from ChartTooltip to parent: `onAnnounce?: (text: string) => void`
- In pointer handler: `if (event.pointerType === 'touch') { onAnnounce?.('Tooltip pinned.'); }`

**Warning signs:** Keyboard user never hears announcement; touch user sees no announcement; HTML inspect shows live region is child of `[aria-hidden]`.

---

## Validation Architecture

> Nyquist validation enabled (`workflow.nyquist_validation: true` in `.planning/config.json`)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (e2e), Vitest (unit) |
| Config file | `playwright.config.ts`, `vitest.config.ts` |
| Quick run command | `pnpm exec playwright test --grep @quick` (if marked) |
| Full suite command | `pnpm run test:unit && pnpm exec playwright test` |

### Phase 7 Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File(s) Exists? |
|-----|----------|-----------|-------------------|-----------------|
| **PLATFORM-01** | 375px viewport, no horizontal scroll (document.scrollWidth ≤ clientWidth) | e2e sweep | `playwright test tests/e2e/shell/mobile-sweep.spec.ts` | ❌ Wave 0 (D-04: "ONE new e2e sweep spec") |
| **PLATFORM-01** | 44px touch target hit area on all buttons/links | e2e bbox check or CSS guard | `playwright test tests/e2e/shell/touch-targets.spec.ts` | ❌ Wave 0 |
| **PLATFORM-01** | Touch tooltip: tap opens & pins, tap outside dismisses | e2e touch project | `playwright test --project=chromium-mobile tests/e2e/charts/tooltip-touch.spec.ts` | ❌ Wave 0 |
| **PLATFORM-03** | Deployed to GitHub Pages via actions/deploy-pages | Manual (workflow dispatch) + smoke spec | `gh workflow run deploy.yml -f sha=<main-sha>` + post-deploy Playwright | ❌ Wave 0 (deploy.yml workflow) |
| **PLATFORM-03** | Pre-deploy zero-network gate on built dist under subpath | e2e on vite preview | `playwright test tests/deploy/pre-deploy-gate.spec.ts` | ❌ Wave 0 |
| **PLATFORM-03** | Post-deploy zero-network on live URL | e2e against live Pages URL | `playwright test tests/deploy/post-deploy-smoke.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm run lint && pnpm run check && pnpm run test:unit` (fast linting + typecheck + unit suite, ~5 min)
- **Per wave merge:** `pnpm run test:unit && pnpm exec playwright test` (full suite, ~31 min on self-hosted, unknown on GitHub-hosted runner; new touch project and timeouts TBD)
- **Phase gate (before verification):** Full suite green, pre-deploy gate green, post-deploy smoke green

### Wave 0 Gaps

- [ ] `tests/e2e/shell/mobile-sweep.spec.ts` — 375px viewport, scrollWidth ≤ clientWidth for all sections/states (D-04 "mobile proof")
- [ ] `tests/e2e/shell/touch-targets.spec.ts` or integrated in mobile-sweep — verify 44px hit area on buttons/links at coarse pointer (D-08)
- [ ] `tests/e2e/charts/tooltip-touch.spec.ts` (or similar) — tap-to-pin, move-on-tap, dismiss-on-tap-outside with `@playwright/test` touch project (D-05)
- [ ] `tests/deploy/pre-deploy-gate.spec.ts` — served built dist under `/wot-gdpr-stats-visualizer/` subpath, assert zero requests, worker 200, CSP meta present (D-14)
- [ ] `tests/deploy/post-deploy-smoke.spec.ts` — live URL smoke test, page loads, zero requests, worker 200, CSP meta, opt-in reachable (D-14)
- [ ] `.github/workflows/deploy.yml` — dispatch-triggered workflow, CI gate check, build on ubuntu-latest, pre-deploy Playwright gate, upload artifact, deploy-pages (D-09 through D-15)
- [ ] `vite.config.ts` — add `base: process.env.VITE_BASE ?? '/',` (currently missing, D-11)
- [ ] `index.html` — change favicon to relative `href="./favicon.svg"` (D-11)
- [ ] `playwright.config.ts` — add chromium-mobile project with `{ isMobile: true, hasTouch: true }` (D-04)
- [ ] `src/lib/charts/ChartTooltip.svelte` — add `pinned` rune, touch branching, live region callback (D-05)
- [ ] `src/lib/features/*/[Charts].svelte` — branch pointer handlers on `pointerType === 'touch'` (D-05)
- [ ] `src/app.css` — add `@media (max-width: 480px) { main { padding: 16px; } }` (D-03)
- [ ] `tests/unit/guards/ci-budget.test.ts` — update globalTimeout, wrapper, job timeout constants for new test count (D-04 note)

**Total gaps:** 12 new specs/configs, 1 existing file (app.css), 1 pending refactor (ChartTooltip touch state). New test count TBD until touch specs written; current headroom: 234 tests, 5 tests until timeout re-raise needed (ci-budget allows up to 239).

---

## Security Domain

> `security_enforcement: true`, ASVS level 1 (config.json)

### Applicable ASVS Categories for Phase 7

| ASVS Category | Applies | Control | Notes |
|---|---|---|---|
| V2 Authentication | No | — | Identity is read-only from user's export; no login required for the app |
| V3 Session Management | No | — | No server-side sessions; IndexedDB cache is client-side only |
| V4 Access Control | No | — | No multi-user or role-based access; single viewer, single dataset |
| V5 Input Validation | Yes | Existing (Phases 2–6) | CSV parsing (PapaParse) with defensive column matching; no new inputs in Phase 7 |
| V6 Cryptography | Partial | CSP meta tag, GZIP integrity check (city file) | CSP `connect-src 'self'` (defense in depth); city manifest sha256 verified post-download |
| V7 Cryptographic Failures | Partial | GZIP integrity (city file), no account secrets uploaded | Phase 7 introduces one network call (city file) — HTTPS only, same-origin, no credentials/referrer |
| V9 Communication | Yes | CSP, GZIP integrity, no referrer | CSP forbids cross-origin requests; city fetch omits Referer header, credentials omitted |
| V11 Business Logic | No | — | No business logic changes; UI logic only |
| V12 File Uploads | No | — | File upload is Phases 1–2 (zip drop); Phase 7 adds download only |

### Known Threat Patterns for Svelte + Vite + GitHub Pages

| Pattern | STRIDE | Standard Mitigation | Phase 7 Status |
|---|---|---|---|
| Cross-origin data exfiltration via lazy worker | Tampering, Information Disclosure | ESLint import ban on `src/lib/geo/` and `src/lib/worker/` (one exempt module `city-fetch.ts`); Playwright request assertions | Enforced; city-fetch.ts is the only exempt module [VERIFIED: vite.config.ts comment] |
| Subpath origin confusion (GitHub Pages multi-project) | Spoofing | CSP `connect-src 'self'` applies to the subpath origin (`wot-gdpr-stats-visualizer.github.io`) not a global origin | CSP is set to `'self'` (D-15); all Pages projects on same origin can read IndexedDB [DOCUMENTED: pitfall n] |
| Cached city data integrity | Tampering | SHA256 manifest + byte count check on downloaded file | Pre-deploy gate asserts manifest; post-deploy smoke verifies file is served [VERIFIED: city-fetch.ts lines 68–80] |
| Stale browser cache of old app build | Information Disclosure | GitHub Pages cache headers + semver in artifact name (worker chunk hash includes build hash) | Polling for new chunk hash in smoke spec; CDN invalidation via `max-age: 0` on Pages HTML [ASSUMED: Pages default cache behavior] |
| Device-level resource exhaustion (city file decode) | Denial of Service | Buffering cap `MAX_CITY_TABLE_BYTES: 96 MB` (~2.2x gzipped size); error boundary for OOM | Cap is enforced; no silent failure [VERIFIED: src/lib/geo/city-fetch.ts line 72 doc] |

### CSP Directive Analysis (D-15)

**Shipped policy (meta tag, Phase 7):**

```
default-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'
```

**Why `connect-src 'self'`** (not `'none'`):
- Phase 6 measured that meta CSP is blind to worker traffic
- One legitimate same-origin request exists post-load: city file fetch (user-initiated, main thread, opt-in)
- Narrowing `connect-src` to path-restrict only city asset is not possible with `'self'` (paths cannot be specified in host sources)
- Enforcement is ESLint ban + Playwright request assertions, not CSP (CSP is defense-in-depth)

[VERIFIED: vite.config.ts lines 14–28, plan 06-11 D-16 rationale]

### Shared github.io Origin (Pitfall n — Security Implication)

Every project deployed to `<user>.github.io` shares one origin. If the user has other apps on GitHub Pages:
- `https://<user>.github.io/app-one/` and `https://<user>.github.io/app-two/` share the SAME origin `https://<user>.github.io`
- App One can read App Two's IndexedDB, cookies, localStorage, etc.
- CSP `connect-src 'self'` allows App One to fetch from App Two's subpath

**Mitigation:** User's responsibility. Phase 7 documents this; no code change (D-15 is locked).

---

## Assumptions Log

| # | Claim | Section | Confidence | Risk if Wrong |
|---|-------|---------|------------|------|
| A1 | Vite 8's `base` config option is the standard way to set subpath routing | Vite 8 Base Path | HIGH (verified against vite.config.ts absence) | D-11 incomplete; subpath deployment will 404 on assets |
| A2 | Module Worker URL is resolved correctly by Vite once `base` is set | Vite 8 Base Path | HIGH (standard Vite + bundler pattern) | Worker won't load under subpath; zero-network test fails |
| A3 | Playwright's `baseURL` with subpath requires `./` not `/` in goto paths | Playwright Pitfall 2 | MEDIUM (standard Playwright docs; unconfirmed in this codebase) | Smoke spec navigates to wrong URL; gets 404 |
| A4 | Tap sequence fires pointerover → down → up → pointerout in order | Pointer Events Pitfall 3 | MEDIUM (Pointer Events spec; unconfirmed in this browser at this viewport) | Tap-to-pin flickers or doesn't work; contradicts pointer handlers |
| A5 | `playwright test --list` respects the active Playwright config project filtering | ci-budget Mechanism | HIGH (verified: ci-budget.test.ts calls `--list` and expects it to list only active projects) | Test count is wrong; timeout projections invalid |
| A6 | GitHub Actions `workflow_dispatch` inputs can reference the current branch's commit SHA | CI Gate Verification | MEDIUM (standard GitHub Actions UX; untested in this workflow) | Deploy gates the wrong SHA; unintended commit is deployed |
| A7 | Actions/deploy-pages: newest v4 tag is v4.0.5 (d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e, verified 2026-10-05 by git ls-remote); D-10 locks v4, so v5 is not adopted | Action Versions | HIGH (verified git ls-remote; v4.0.0 is latest tag) | Specified SHA will be wrong; workflow fails to pull action |
| A8 | pnpm 12 forwards the `--` separator as a literal argument, not as "end of options" | build-city-dataset Flags | HIGH (verified: build-city-dataset.ts line 111 handles `--` explicitly) | `pnpm run geo:city -- --download` breaks; download not attempted |
| A9 | Cities dataset gzip size is ~11.9 MB; raw is ~50 MB; caching will save significant CI time | City Caching Strategy | MEDIUM (verified in STATE.md; measured on 2026-10 data, which will be stale by phase start) | Cache key doesn't match; cache always misses; every deploy re-downloads |
| A10 | Favicon path `/favicon.svg` will not resolve under a subpath without Vite's base handling | Favicon Resolution | HIGH (verified: vite build with VITE_BASE showed absolute paths unchanged) | Favicon won't load; page renders without icon (cosmetic only) |

---

## Open Questions (RESOLVED)

> Resolved by plans (2026-10-05): touch-target method -> 07-05; post-deploy smoke location -> 07-02 Task 3 (separate job); city cache key -> 07-02 Task 2 (month from `resolve-dbip-month.ts`); Playwright baseURL for the subpath -> 07-01 Task 2.

1. **Touch-target assertion method:** Should touch-target validation be a CSS guard (enforce 44px in ESLint/CSS validator), an e2e bounding-box assertion, or both? D-04 and D-08 name it a requirement but not a mechanism.
   - **What we know:** D-08 mentions "where practical" for automated bbox assertion
   - **Recommendation:** E2E bbox check in touch project (practical, covers the interactive targets); CSS guard as a bonus

2. **Post-deploy smoke test location:** Should it live in `deploy.yml` as an optional-failure job (won't block deploy), or as a separate manual workflow/scheduled test?
   - **What we know:** D-14 requires it; no workflow location specified
   - **Recommendation:** Separate optional job after `actions/deploy-pages`, so failures are visible but don't block deployment

3. **City cache key strategy:** Should the cache key include the full `YYYY-MM` month, or a rolling window (e.g., "last 3 months")? Current month's file may not be available yet on the 1st of month.
   - **What we know:** D-13 requires cache hit/miss; script resolves month at runtime with one-month fallback
   - **Recommendation:** Extract actual resolved month from script output; use `geo-city-${{ runner.os }}-<month>` with a generous restore-keys prefix

4. **Playwright baseURL for subpath:** What is the exact correct pattern — `baseURL: 'http://localhost:4173/wot-gdpr-stats-visualizer/'` + `goto('/')`, or `baseURL: 'http://localhost:4173'` + `goto('/wot-gdpr-stats-visualizer/')`?
   - **What we know:** Playwright docs hint that paths are relative to baseURL; never personally tested at subpath with `-`
   - **Recommendation:** Test both patterns in the pre-deploy gate; document whichever works, with examples in Playwright config comment

---

## Environment Availability

| Dependency | Required By | Available? | Version | Fallback |
|---|---|---|---|---|
| Node.js | Vite build, script execution, GitHub Actions | ✓ | 24 (pinned in ci.yml, GH-provided on ubuntu-latest) | — |
| pnpm | Package install, script execution | ✓ | 12.6.0 (pinned in package.json) | — |
| Playwright (Chromium) | e2e and smoke testing, pre-deploy gate | ✓ | ^1.63 (pnpm-installed) | — |
| Git | CI/CD triggers, deploy.yml SHA resolution | ✓ | System default | — |
| GitHub CLI (gh) | CI gate query (actions:read), deploy workflow | ✓ | System default on GitHub Actions | Manual API curl (less ergonomic) |
| Vite | Build, preview server | ✓ | ^8.3 (pnpm-installed) | — |

**Missing dependencies:** None blocking Phase 7. All infrastructure is pre-installed or provided by GitHub Actions.

---

## Sources

### Primary (HIGH confidence)

- vite.config.ts (lines 1–125) — current Vite config, CSP plugin, city manifest loading, geo alias setup [VERIFIED: read this session]
- playwright.config.ts (lines 1–143) — current Playwright setup, timeout arithmetic, webServer config, geo fixture seam [VERIFIED: read this session]
- .github/workflows/ci.yml (lines 1–172) — existing CI workflow, timeouts, action SHAs, Node/pnpm versions [VERIFIED: read this session]
- tests/unit/guards/ci-budget.test.ts (lines 1–227) — e2e budget guard constants, projected time arithmetic, workflow timeout enforcement [VERIFIED: read this session]
- tests/e2e/guards/zero-network.spec.ts (lines 1–100) — zero-network assertion pattern, request counting via context.on, baseline capture [VERIFIED: read this session]
- index.html (lines 1–16) — current favicon href, script src, module script tag [VERIFIED: read this session]
- src/lib/geo/city-fetch.ts (lines 1–128) — cityAssetUrl function signature & implementation, BASE_PATH_PATTERN validation, origin+base concatenation [VERIFIED: read this session]
- src/lib/charts/ChartTooltip.svelte (lines 1–200) — pointer-events: none, aria-hidden usage, position calculation, no current touch state [VERIFIED: read this session]
- scripts/geo/build-city-dataset.ts (lines 1–135) — parseArgs function, flag handling, pnpm -- separator support [VERIFIED: read this session]
- package.json (`geo:city` script, `packageManager` field) — script name and pnpm pin [VERIFIED: grep output]
- 07-CONTEXT.md (D-01 through D-16) — locked decisions constraining all implementation [VERIFIED: read this session]
- 07-UI-SPEC.md (all sections) — visual & interaction contract, spacing, touch targets, copy [VERIFIED: read this session]
- AGENTS.md (Tech Stack, Version Compatibility, Constraints) — locked stack, peer-dependency pairs, "What NOT to use" [VERIFIED: read this session]
- .planning/config.json (workflow section) — nyquist_validation, security_enforcement flags [VERIFIED: read this session]

### Secondary (MEDIUM confidence)

- Git tag queries (`git ls-remote`) for actions/upload-pages-artifact and actions/deploy-pages v4.0.0 commit SHAs [VERIFIED: bash output]
- Vite 8 base config pattern (standard Vite docs pattern, not tested in this repo) [CITED: vite.dev docs (context 1)]
- GitHub Actions workflow_dispatch inputs (standard GH Actions feature) [CITED: docs.github.com/en/actions (context 1)]
- Playwright touch device emulation (standard Playwright docs pattern) [CITED: playwright.dev device emulation (context 1)]

### Tertiary (LOW confidence — marked ASSUMED in RESEARCH.md where used)

- Pointer Events spec tap sequence (standard spec, not empirically tested in this codebase on current hardware) [ASSUMED]
- GitHub Pages cache behavior & CDN invalidation (GitHub Pages documentation; untested on this repo) [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — all versions are locked from prior phases; npm registry confirms currency
- **Architecture:** HIGH — 16 locked decisions from CONTEXT.md; codebase inspection confirms existing state (missing base config is a finding, not an assumption)
- **Pointer Events / Touch:** MEDIUM — pattern is standard, not empirically verified in this repo's touch project yet
- **GitHub Actions / Deploy:** HIGH — official action SHAs verified; workflow pattern is standard GitHub Actions; repo preconditions (visibility, Pages source) are manual gates
- **Pitfalls:** MEDIUM to HIGH — drawn from common Vite/Playwright/Pointer Events gotchas, cross-verified against this codebase's existing patterns

**Research date:** 2026-10-05

**Valid until:** 2026-10-12 (one week; action SHAs immutable; timeout arithmetic immutable; pointer event handling stable; VITE_BASE implementation pattern stable)

---

*Researched by Claude Code, Phase 7 Research Agent*
*All claims tagged with source type (VERIFIED, CITED, ASSUMED) per research protocol*
