# Phase 7: Mobile Layout & Public Deploy - Pattern Map

**Mapped:** 2026-10-05
**Files analyzed:** 18 new/modified files
**Analogs found:** 16 / 18 (2 files with partial/no analog patterns)

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `vite.config.ts` | config | request-response | itself (Phase 6) | exact |
| `playwright.config.ts` | config | test-orchestration | itself (Phase 6) | exact |
| `.github/workflows/deploy.yml` | CI/CD config | request-response | `ci.yml` | role-match |
| `src/app.css` | styling | render | `DurationList.svelte` (480px) | pattern-match |
| `src/lib/charts/ChartTooltip.svelte` | component | event-driven | itself (Phase 6) | exact |
| `src/lib/features/playtime/CalendarHeatmap.svelte` | component | event-driven | itself (Phase 6) | exact |
| `src/lib/features/playtime/HourGrid.svelte` | component | event-driven | itself (Phase 6) | exact |
| `src/lib/charts/MonthlyBarChart.svelte` | component | event-driven | itself (Phase 6) | exact |
| `src/lib/features/logins/WorldMap.svelte` | component | event-driven | itself (Phase 6) | exact |
| `src/lib/features/vehicles/VehicleTable.svelte` | component | CRUD | itself (Phase 6) | exact |
| `src/lib/features/logins/LoginTable.svelte` | component | CRUD | itself (Phase 6) | exact |
| `src/lib/features/logins/CityOptIn.svelte` | component | request-response | itself (Phase 6) | verify-only |
| `.github/workflows/ci.yml` | CI/CD config | request-response | itself (Phase 6) | exact (modify) |
| `tests/unit/guards/ci-budget.test.ts` | test | validation | itself (Phase 6) | exact (modify) |
| `tests/e2e/shell/mobile-sweep.spec.ts` | test | e2e | `uat-criteria.spec.ts` | role-match |
| `tests/e2e/shell/touch-interaction.spec.ts` | test | e2e | `zero-network.spec.ts` | role-match |
| `tests/deploy/pre-deploy-gate.spec.ts` | test | e2e | `zero-network.spec.ts` | role-match |
| `tests/deploy/post-deploy-smoke.spec.ts` | test | e2e | `zero-network.spec.ts` | role-match |

---

## Pattern Assignments

### `vite.config.ts` (config, request-response)

**Analog:** itself (Phase 6)

**Current usage of `process.env` pattern** (lines 100-107):
```typescript
// The opt-in city file's manifest, read ONCE here and baked into the bundle
// (plan 06-11, D-13, D-16). `null` — no manifest was built — makes the opt-in
// unavailable in the interface, so a local or pull-request build never offers
// a download that can only fail. `process.env` is passed through whole, like
// the alias below, so the fixture switch has one path and not two.
define: {
  __GEO_CITY__: JSON.stringify(loadCityManifestFile(process.env)),
},
```

**Add base config (D-11)** — Insert after line 96, before `worker: { format: 'es' }`:
```typescript
base: process.env.VITE_BASE ?? '/',
```

**Rationale:** Vite's `base` config option injects `import.meta.env.BASE_URL` into compiled chunks and resolves the favicon path and worker script URL correctly under a subpath. Without it, favicon and script srcs remain absolute, breaking under `/wot-gdpr-stats-visualizer/`.

---

### `playwright.config.ts` (config, test-orchestration)

**Analog:** itself (Phase 6)

**Extract existing `projects` array** (lines 42-47):
```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
],
```

**Add new `chromium-mobile` project** — Insert into `projects` array:
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

**Extract existing `webServer` and `globalTimeout`** (lines 112-143, 110):
```typescript
webServer: {
  command: './node_modules/.bin/vite build && ./node_modules/.bin/vite preview',
  url: 'http://localhost:4173',
  reuseExistingServer: false,
  timeout: 120000,
  env: { GEO_FIXTURE: '1' },
},
globalTimeout: 27 * 60 * 1000,  // Will need update per D-04 test count
```

**Note on test scoping:** Use `testIgnore` on chromium project for touch specs, or `testMatch` on chromium-mobile project only. Do NOT use `test.describe.configure({ project })` — it is not a Playwright API. Instead, place touch specs in separate files and configure via `playwright.config.ts` glob patterns.

**Concern:** D-04 adds multiple e2e tests. Current count is 234 tests, 27 min globalTimeout. New tests may require ci-budget updates. See `ci-budget.test.ts` pattern below.

---

### `.github/workflows/ci.yml` (CI/CD config, request-response)

**Analog:** itself (Phase 6, lines 73, 110, 160)

**Modify timeouts** — After D-04 touch specs added, count will exceed 239 tests. Current arithmetic in `playwright.config.ts` lines 52-109:
```
E = 330 + 5 * (L - 86 - 5 - 5 - 5) + 120 + 90 + 13 = projected seconds
G = ceil(1.3 * E / 60) + 3 minutes  (globalTimeout, with 1.3x floor)
W = G + 2 minutes  (wrapper, shell timeout)
J = W + 8 minutes  (job timeout-minutes)
```

Current values (234 tests, 1218s projected):
- `globalTimeout: 27 * 60 * 1000` (line 110 in playwright.config.ts)
- `run: pnpm exec timeout 29m playwright test` (line 160)
- `timeout-minutes: 37` (line 73)

**When to update:** After final test count is known, recalculate E, G, W, J. All three must move together.

---

### `tests/unit/guards/ci-budget.test.ts` (test, validation)

**Analog:** itself (Phase 6, lines 75-106)

**Extract constant definitions** (lines 75-106):
```typescript
const PRE_PHASE_TEST_COUNT = 86;  // E2E tests at Phase 3 end
const PRE_PHASE_SECONDS = 330;     // ESTIMATE for pre-phase suite
const SCALE_SPEC_TEST_COUNT = 5;   // playtime-scale.spec.ts
const SCALE_SPEC_SECONDS = 120;    // 60,000-session scale block
const FINANCE_SCALE_TEST_COUNT = 5;
const FINANCE_SCALE_SECONDS = 90;  // 50,000-operation finance block
const LOGIN_SCALE_SPEC_TEST_COUNT = 5;
const LOGIN_SCALE_SPEC_SECONDS = 13;  // 12,000-row login scale block
```

**Projection function** — Uses these constants to compute `projectedE2eSeconds(testCount)` which enforces `globalTimeout >= ceil(1.3 * E / 60) * 60 + 3s`.

**Update after Phase 7 test count is final:** Increase test count constant(s) and recalculate if new specs exceed 239. The guard parses ci.yml's `globalTimeout` with a regex and compares.

---

### `src/app.css` (styling, render)

**Analog:** `src/lib/features/playtime/DurationList.svelte` (lines 152-157)

**Extract existing `main` rule** (lines 81-85):
```css
main {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
}
```

**Add 480px breakpoint** (D-03) — Append to end of file:
```css
@media (max-width: 480px) {
  main {
    padding: 16px;
  }
}
```

**Note:** UI-SPEC approves 16px padding at phone width (not 12-16px range). This is the ONE media query for Phase 7; no per-component `@media` blocks should override it. The `--nav-offset: 72px` (line 18) and column `max-width: 720px` are unchanged.

---

### `src/lib/charts/ChartTooltip.svelte` (component, event-driven)

**Analog:** itself (Phase 6)

**Current props** (lines 37-49):
```typescript
interface Props {
  /** The active cell, or null for "nothing is active". */
  request: TooltipRequest | null;
  /** The element the request was measured from, or null if the owner has none. */
  anchor?: Element | null;
  /** Close it — Escape, a scroll, a resize, or a pointer leaving a cell. */
  onDismiss: () => void;
  /** Optional test id override for the tooltip element. Defaults to "chart-tooltip". */
  testId?: string;
}
```

**Existing `pointer-events: none`** (line 171):
```css
.tooltip {
  pointer-events: none;  /* load-bearing: prevents tooltip from swallowing pointer events */
}
```

**Existing `aria-hidden` and scroll dismiss** (lines 139-140, 133):
```svelte
<div class="tooltip" aria-hidden="true" hidden={request === null}>

<svelte:window onresize={dismissIfStale} onscrollcapture={dismissIfStale} />
```

**Add for touch (D-05):**
1. New rune: `let pinned = $state(false);` — track whether tooltip is pinned
2. Modify `onDismiss` callback to accept an optional reason param for accessibility
3. Add live region callback: `onAnnounce?: (text: string) => void` — pass to parent component
4. Modify scroll/Esc handling to reset `pinned = false` when dismissing while pinned

**Shared pattern note:** All four chart components (CalendarHeatmap, HourGrid, MonthlyBarChart, WorldMap) already have pointer event handlers; they need branching logic on `event.pointerType === 'touch'` to use `onpointerdown` only (not `onpointerover`/`onpointerout`) and set/unset `pinned` state via the tooltip parent.

---

### Chart Components: `CalendarHeatmap.svelte`, `HourGrid.svelte`, `MonthlyBarChart.svelte`, `WorldMap.svelte` (components, event-driven)

**Analog:** themselves (Phase 6)

**Current pointer event handlers in all four:**

CalendarHeatmap (lines 476-481):
```svelte
onpointerover={onPointerOver}
onpointerout={onPointerOut}
onfocusin={onFocusIn}
onfocusout={onFocusOut}
onkeydown={onKeyDown}
onpointerdown={onPointerDown}
```

HourGrid (lines 319-324):
```svelte
onpointerover={onPointerOver}
onpointerout={onPointerOut}
onfocusin={onFocusIn}
onfocusout={onFocusOut}
onkeydown={onKeyDown}
onpointerdown={onPointerDown}
```

MonthlyBarChart (lines 166-171):
```svelte
onpointerover={onPointerOver}
onpointerout={onPointerOut}
onfocusin={onFocusIn}
onfocusout={onFocusOut}
onkeydown={onKeyDown}
onpointerdown={() => { /* ... */ }}
```

WorldMap (lines 305-310):
```svelte
onpointerover={onPointerOver}
onpointermove={onPointerMove}
onpointerout={onPointerOut}
onfocusin={onFocusIn}
onfocusout={onFocusOut}
onkeydown={onKeyDown}
```

**Add for touch (D-05):** Modify `onPointerOver` and `onPointerOut` handlers to branch on `event.pointerType`:

```typescript
function onPointerOver(event: PointerEvent) {
  if (event.pointerType === 'touch') return;  // Touch uses onpointerdown only
  // existing mouse/pen logic
}

function onPointerOut(event: PointerEvent) {
  if (event.pointerType === 'touch') return;  // Touch dismisses on doc-level down elsewhere
  // existing mouse/pen logic
}

// For touch: only set pinned state in onPointerDown
function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    setTooltip(cell, { pinned: true });
    onAnnounce('Tooltip pinned.');
    event.stopPropagation();  // Prevent document-level handler firing same cell
    return;
  }
  // existing keyboard focus logic
}
```

**Critical pitfall:** Tap fires `pointerover → down → up → pointerout` in sequence. Without branching, `pointerout` dismisses the tooltip that `pointerover` opened in the same tap, leaving nothing visible.

---

### `src/lib/features/vehicles/VehicleTable.svelte`, `src/lib/features/logins/LoginTable.svelte` (components, CRUD)

**Analog:** themselves (Phase 6)

**D-01 requirement:** Tables keep their virtualized scroll boxes with sticky headers + first column. No reflow to cards, no column hiding. Phase 7 is width/padding tuning only.

**Extract scroller CSS pattern:**
- Scroller has `overflow-x: auto` and a bounded `max-width: 100%`
- Sticky header: `position: sticky; top: --nav-offset` (CSS variable from root)
- Sticky first column (on LoginTable): `position: sticky; left: 0`

**Do NOT modify:** Virtualization geometry, row height, column widths. Only confirm that `document.scrollWidth <= clientWidth` at 375px via e2e sweep spec (D-04).

---

### `src/lib/features/logins/CityOptIn.svelte` (component, request-response)

**Analog:** itself (Phase 6, lines 1-150 read)

**Verify only:** No pattern changes for Phase 7. The `~N MB` copy is already present in `formatCityLoadLabel()` (line 93, imported from `ui-copy.ts`). No new rune or prop needed for touch.

---

### `.github/workflows/deploy.yml` (CI/CD config, request-response)

**Analog:** `.github/workflows/ci.yml` (Phase 6)

**NEW file structure (D-09 through D-15):**

1. **Trigger:**
```yaml
on:
  workflow_dispatch:
```

2. **Least-privilege permissions (D-10):**
```yaml
permissions:
  contents: read  # for checkout

jobs:
  pre-flight:
    runs-on: ubuntu-latest
    permissions:
      actions: read  # to query CI workflow status via gh api
    steps:
      - name: Verify selected SHA has successful CI run
        run: |
          gh api "repos/${{ github.repository }}/actions/workflows/ci.yml/runs?head_sha=${{ github.sha }}&status=success" \
            --jq '.total_count' | grep -E '^[1-9]'
          # Exit 1 if count is 0 (no successful CI run for this SHA)
```

3. **Build job (ubuntu-latest, GitHub-hosted):**
```yaml
  build:
    runs-on: ubuntu-latest
    needs: pre-flight
    steps:
      - uses: actions/checkout@<SHA> # v7.x
        with:
          persist-credentials: false
      
      - uses: pnpm/action-setup@<SHA> # v6.x (package.json pins version)
      - uses: actions/setup-node@<SHA> # v7.x
        with:
          node-version: 24
          cache: pnpm
      
      - run: pnpm install --frozen-lockfile
      
      - name: Build with subpath base
        run: |
          export VITE_BASE=/wot-gdpr-stats-visualizer/
          pnpm run build
      
      - name: Run pre-deploy Playwright gate
        run: |
          export VITE_BASE=/wot-gdpr-stats-visualizer/
          pnpm exec playwright install --with-deps chromium
          # Serve dist under the base path in test
          pnpm exec timeout 15m playwright test tests/deploy/pre-deploy-gate.spec.ts
      
      - name: Cache city file by month
        uses: actions/cache@<SHA> # v4.x
        with:
          path: public/geo-city-data/
          key: geo-city-${{ runner.os }}-<RESOLVED_MONTH>
          restore-keys: |
            geo-city-${{ runner.os }}-
      
      - name: Generate city dataset
        run: |
          node scripts/geo/build-city-dataset.ts --download
          # Verify manifest source and integrity
          node -e "
            const m = require('./public/geo-city-data/manifest.json');
            if (m.source !== 'dbip') throw new Error('manifest source is not dbip');
            console.log('City file manifest OK: ' + m.file + ' (' + m.bytes + ' bytes, ' + m.month + ')');
          "
      
      - uses: actions/upload-pages-artifact@<SHA> # v4.x
        with:
          path: dist
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/deploy-pages@<SHA> # v4.x
      
      - name: Post-deploy smoke spec (optional, don't block deploy)
        if: success()
        run: |
          pnpm exec playwright install --with-deps chromium
          pnpm exec timeout 10m playwright test tests/deploy/post-deploy-smoke.spec.ts || true
```

**Critical notes:**
- **Action SHAs:** Use full 40-char SHAs, not truncated. Record the major version in a comment: `@<SHA> # v4.0.0`
- **Permissions scoping:** Pre-flight job gets `actions: read`, build gets none, deploy gets `pages: write` + `id-token: write` + `github-pages` environment
- **City cache key:** Must use actual resolved month from script output, not `$(date +%Y-%m)`. Script will print the resolved month; extract it.
- **Subpath build:** Set `VITE_BASE=/wot-gdpr-stats-visualizer/` before `pnpm run build`
- **Pre-deploy gate:** Serve built dist under the base path (`http://localhost:3000/wot-gdpr-stats-visualizer/`) and run playwright against it

---

### `tests/e2e/shell/mobile-sweep.spec.ts` (test, e2e)

**Analog:** `tests/e2e/shell/uat-criteria.spec.ts` (lines 1-80)

**Pattern:** Import helpers, use fixture, test multiple states

```typescript
import { test, expect } from '@playwright/test';
import { gotoApp, importExport, SYNTHETIC_ZIP_NAME } from '../_support/helpers';
import { buildSampleExport } from '../../fixtures/export-fixtures.ts';
import { SCALE_5K_SPEC, buildSessionsExport } from '../../fixtures/sessions-fixtures.ts';

test('mobile-sweep-375px: no horizontal scroll for all states', async ({ page, viewport }) => {
  // viewport is 375x812 from chromium-mobile project
  
  // Test 1: Empty state (identity + nav + footer visible, no content)
  await gotoApp(page);
  expect(page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth)
  );
  
  // Test 2: After import (heatmap, tiles, table all visible)
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSessionsExport(SCALE_5K_SPEC));
  
  // Assert all sections have document.scrollWidth <= clientWidth
  const sections = ['identity-header', 'nav', 'playtime-block', 'logins-block', 'banner-area', 'footer'];
  for (const section of sections) {
    const el = page.locator(`[data-testid="${section}"]`).first();
    if (await el.isVisible()) {
      const scrollWidth = await el.evaluate((e) => e.scrollWidth);
      const clientWidth = await el.evaluate((e) => e.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth, `${section} has horizontal scroll`);
    }
  }
});
```

**D-04 requirement:** Test 375px viewport with no horizontal page scroll, including all states (identity, heatmaps, vehicle table, finance, login table, map, banners, city opt-in, clear-data).

---

### `tests/e2e/shell/touch-interaction.spec.ts` (test, e2e, chromium-mobile only)

**Analog:** `tests/e2e/guards/zero-network.spec.ts` (lines 1-50, pointer event patterns)

**Pattern:** Use touch project, test tap-to-pin

```typescript
import { test, expect } from '@playwright/test';
import { gotoApp, importExport, SYNTHETIC_ZIP_NAME } from '../_support/helpers';
import { buildSampleExport } from '../../fixtures/export-fixtures.ts';

// This test runs ONLY on chromium-mobile project (use testMatch or testIgnore in playwright.config.ts)

test('tap-to-pin: tooltip pinned on tap, moves on second tap, dismissed on tap outside', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
  
  const heatmap = page.locator('[data-testid="calendar-chart"]').first();
  const cells = heatmap.locator('rect[role="button"]');
  
  // Tap first cell
  const cell1 = cells.nth(0);
  await cell1.tap();
  
  // Tooltip should be visible (pinned)
  const tooltip = page.locator('[data-testid="chart-tooltip"]');
  await expect(tooltip).not.toHaveAttribute('hidden', 'true');
  
  // Live region announces pinned
  const liveRegion = page.locator('[role="status"][aria-live="polite"]');
  await expect(liveRegion).toContainText('Tooltip pinned');
  
  // Tap second cell — tooltip moves
  const cell2 = cells.nth(1);
  await cell2.tap();
  const afterMove = await tooltip.evaluate((e) => window.getComputedStyle(e).left);
  
  // Tap outside — tooltip dismissed
  await heatmap.tap({ position: { x: 10, y: 10 } });  // Outside chart area
  await expect(tooltip).toHaveAttribute('hidden', 'true');
  await expect(liveRegion).toContainText('Tooltip dismissed');
});

test('touch targets: all buttons and links have 44px minimum hit area at 375px', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
  
  // Check nav links
  const navLinks = page.locator('[data-testid="nav"] a');
  for (let i = 0; i < (await navLinks.count()); i++) {
    const link = navLinks.nth(i);
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  
  // Check CityOptIn button
  const loadButton = page.locator('[data-testid="city-load-button"]');
  if (await loadButton.isVisible()) {
    const box = await loadButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
```

**Critical:** Specs in this file must run on `chromium-mobile` project only. Use `testMatch: '**/touch-interaction.spec.ts'` on chromium-mobile and `testIgnore: '**/touch-interaction.spec.ts'` on chromium, or place in separate directory.

---

### `tests/deploy/pre-deploy-gate.spec.ts` (test, e2e)

**Analog:** `tests/e2e/guards/zero-network.spec.ts` (lines 38-90, request counting pattern)

**Pattern:** Assert zero requests, worker ready, CSP meta

```typescript
import { test, expect } from '@playwright/test';

test.describe('pre-deploy gate: built dist under subpath', () => {
  test.beforeAll(async () => {
    // This test does NOT use webServer (it's run separately, serving dist manually)
    // The GitHub Actions job runs: pnpm exec vite build && vite preview --port 3000
    // and accesses http://localhost:3000/wot-gdpr-stats-visualizer/
  });

  test('zero network requests after initial load', async ({ page, context }) => {
    const requests: string[] = [];
    context.on('request', (req) => requests.push(req.url()));

    // Navigate to the subpath where deploy.yml serves dist
    await page.goto('./');  // Relative goto, baseURL is configured for the subpath
    
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    
    await page.waitForLoadState('networkidle');
    const baselineCount = requests.length;
    
    // No additional requests post-load (baseline includes worker script fetch)
    await page.waitForTimeout(500);
    const postLoadCount = requests.length;
    expect(postLoadCount).toBe(baselineCount);
  });

  test('CSP meta tag present with correct directives', async ({ page }) => {
    await page.goto('./');
    
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .first()
      .getAttribute('content');
    
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
  });

  test('worker chunk loads and returns 200', async ({ page }) => {
    const responses: { url: string; status: number }[] = [];
    page.on('response', (res) => {
      if (res.url().includes('worker')) {
        responses.push({ url: res.url(), status: res.status() });
      }
    });
    
    await page.goto('./');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    
    expect(responses.some((r) => r.status === 200)).toBe(true);
  });
});
```

**Note:** This spec does NOT use playwright.config.ts's webServer; it is run in the GitHub Actions deploy job with a manual vite preview server. The baseURL for this spec must be configured separately or passed via environment variable during the test run.

---

### `tests/deploy/post-deploy-smoke.spec.ts` (test, e2e)

**Analog:** `tests/e2e/guards/zero-network.spec.ts` (lines 38-90)

**Pattern:** Hit live URL, assert zero requests, CSP, worker ready

```typescript
import { test, expect } from '@playwright/test';

test.describe('post-deploy smoke: live GitHub Pages URL', () => {
  const LIVE_URL = process.env.LIVE_URL || 'https://<username>.github.io/wot-gdpr-stats-visualizer/';

  test('page loads and worker is ready', async ({ page }) => {
    await page.goto(LIVE_URL);
    
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
  });

  test('zero network requests after load', async ({ page, context }) => {
    const requests: string[] = [];
    context.on('request', (req) => requests.push(req.url()));

    await page.goto(LIVE_URL);
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await page.waitForLoadState('networkidle');

    const baselineCount = requests.length;
    expect(baselineCount).toBeGreaterThan(0);

    // Simulate user interaction (no opt-in attempted, so no city file request)
    await page.waitForTimeout(500);
    const postLoadCount = requests.length;
    expect(postLoadCount).toBe(baselineCount);
  });

  test('CSP meta tag present', async ({ page }) => {
    await page.goto(LIVE_URL);
    
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .first()
      .getAttribute('content');
    
    expect(csp).toBeTruthy();
    expect(csp).toContain("connect-src 'self'");
  });

  test('city file is reachable if opt-in attempted', async ({ page, context }) => {
    const requests: { url: string; status: number }[] = [];
    context.on('response', (res) => {
      if (res.url().includes('.citydb.bin')) {
        requests.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto(LIVE_URL);
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // Click city opt-in if available
    const loadButton = page.locator('[data-testid="city-load-button"]');
    if (await loadButton.isVisible()) {
      await loadButton.click();
      await page.waitForTimeout(2000);  // Wait for download to start
      
      // City file should be reachable (200 or 304, not 404/403)
      if (requests.length > 0) {
        expect(requests[0].status).toBeLessThan(400);
      }
    }
  });
});
```

**Note:** Run as optional failure (do NOT block deploy). Set `LIVE_URL` environment variable or hardcode after repo is public. This spec runs AFTER `actions/deploy-pages` completes.

---

## Shared Patterns

### Pointer Events: Touch vs. Mouse Branching (D-05)

**Source:** Existing `CalendarHeatmap.svelte`, `HourGrid.svelte`, `MonthlyBarChart.svelte`, `WorldMap.svelte`

**Apply to:** All four chart pointer handlers

All pointer handlers must branch on `event.pointerType`:

```typescript
// MOUSE / PEN: use over/out for hover
function onPointerOver(event: PointerEvent) {
  if (event.pointerType === 'touch') return;
  // Existing hover-open logic
}

function onPointerOut(event: PointerEvent) {
  if (event.pointerType === 'touch') return;
  // Existing hover-close logic
}

// TOUCH: use down only, dismiss on doc-level down elsewhere
function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    const cell = /* resolve from target */;
    setTooltip(cell, { pinned: true });
    onAnnounce?.('Tooltip pinned.');
    event.stopPropagation();  // Prevent document handler firing same cell
    return;
  }
  // Existing keyboard focus logic (common to all pointer types)
}

// DOCUMENT-LEVEL dismiss (for touch only)
// Should be capture phase to catch tap-outside before cell's stopPropagation
document.addEventListener('pointerdown', () => {
  if (pinned) {
    dismissTooltip();
    pinned = false;
    onAnnounce?.('Tooltip dismissed.');
  }
}, { capture: true });
```

**Pitfall:** Standard Pointer Events spec fires `pointerover → down → up → pointerout` on tap. If handlers don't branch, tooltip opens on `over` and closes on `out` in the same tap, leaving it invisible.

---

### 44px Touch Target Rule (D-08)

**Source:** UI-SPEC section "Touch Targets"

**Apply to:** All buttons, links, sort headers, nav links, CityOptIn buttons, summary toggles, Clear data, DB-IP link

**Pattern:** CSS media query at 480px, scoped to affected targets

```css
@media (max-width: 480px) {
  button, a, [role="button"], th[role="button"] {
    min-height: 44px;
    min-width: 44px;
    /* Preserve existing padding; let min-height/width expand click area */
  }
}
```

**Alternative (component-scoped):** Some components already have fixed heights (e.g., nav links at 40px). A global rule may require component-level overrides. Record which components need local adjustments.

**Verification:** E2E bounding-box assertion (D-04 note) in touch project:

```typescript
const box = await element.boundingBox();
expect(box?.width).toBeGreaterThanOrEqual(44);
expect(box?.height).toBeGreaterThanOrEqual(44);
```

---

### Subpath Navigation: Playwright baseURL (Deploy & Live Specs)

**Source:** Research Pitfall 2

**Critical:** `page.goto('/')` with a subpath `baseURL` navigates to the ORIGIN root, not the subpath root.

**Pattern:**
```typescript
// WRONG:
// baseURL: 'http://localhost:3000/wot-gdpr-stats-visualizer/'
// page.goto('/') → http://localhost:3000/ (404)

// CORRECT:
// baseURL: 'http://localhost:3000/wot-gdpr-stats-visualizer/'
// page.goto('./') → http://localhost:3000/wot-gdpr-stats-visualizer/

await page.goto('./');  // Relative goto
```

**Apply to:** pre-deploy-gate and post-deploy-smoke specs. Configure Playwright baseURL with the full subpath including trailing slash, then use `./` or relative paths in specs.

---

### City File Caching by Month (D-13)

**Source:** Research section "Database IP Download Caching"

**Pattern (deploy.yml):**
```yaml
- name: Generate city dataset and extract resolved month
  id: city
  run: |
    node scripts/geo/build-city-dataset.ts --download 2>&1 | tee city-output.txt
    MONTH=$(tail -1 city-output.txt | grep -oE '[0-9]{4}-[0-9]{2}' || echo "fallback")
    echo "resolved_month=$MONTH" >> $GITHUB_OUTPUT

- name: Cache city file by month
  uses: actions/cache@... # v4.x
  with:
    path: public/geo-city-data/
    key: geo-city-${{ runner.os }}-${{ steps.city.outputs.resolved_month }}
    restore-keys: |
      geo-city-${{ runner.os }}-
```

**Rationale:** Script resolves the month at runtime (current month, or fallback one month back). Extract it from script output and use as cache key, not `$(date +%Y-%m)`, which would always be the current month and miss cached fallback data.

---

### CI-Gate Pattern (D-10): Verify SHA has Successful CI

**Source:** Research section "CI Run Verification"

**Pattern (deploy.yml pre-flight job):**
```bash
gh api "repos/${{ github.repository }}/actions/workflows/ci.yml/runs?head_sha=${{ github.sha }}&status=success" \
  --jq '.total_count' | grep -E '^[1-9]'
# Exit 0 if count >= 1, exit 1 if count == 0
```

**Requirement:** Pre-flight job needs `actions: read` permission. The `github.token` is always available; no secrets needed.

---

## Files with No Analog or Partial Match

| File | Reason | Pattern Source |
|------|--------|----------------|
| `index.html` | **No change needed** (orchestrator correction 1). Favicon stays `/favicon.svg`; Vite's `base` config handles path resolution at build time. | N/A |
| `.github/workflows/deploy.yml` | **First GitHub Pages workflow in repo.** Deploy structure differs significantly from CI (manual dispatch, GitHub-hosted runner, pages environment, deploy-pages action). Partial match with ci.yml for action format and timeout patterns. | `ci.yml` (partial) |
| `tests/deploy/pre-deploy-gate.spec.ts` | **Serves dist under a custom port and subpath.** Does not use playwright.config.ts webServer. Must be run separately in deploy job. Partial match with zero-network pattern. | `zero-network.spec.ts` (partial) |
| `tests/deploy/post-deploy-smoke.spec.ts` | **Hits live URL after deploy.** No local webServer. Pattern matches zero-network request-counting, but environment (live URL) is external. | `zero-network.spec.ts` (partial) |

---

## Metadata

**Analog search scope:**
- `.github/workflows/ci.yml`
- `playwright.config.ts`
- `vite.config.ts`
- `src/app.css`
- `src/lib/charts/ChartTooltip.svelte`
- `src/lib/features/playtime/{CalendarHeatmap,HourGrid,DurationList}.svelte`
- `src/lib/features/logins/{WorldMap,LoginTable,CityOptIn}.svelte`
- `src/lib/features/vehicles/VehicleTable.svelte`
- `src/lib/charts/MonthlyBarChart.svelte`
- `tests/e2e/shell/{uat-criteria,scroll-nav}.spec.ts`
- `tests/e2e/guards/zero-network.spec.ts`
- `tests/e2e/_support/helpers.ts`
- `tests/unit/guards/ci-budget.test.ts`
- `scripts/geo/lib/city-manifest.ts`

**Files scanned:** 22 (all tracked, no mirrors)

**Pattern extraction date:** 2026-10-05

**Confidence:** HIGH — all analogs are existing production code or well-understood GitHub Actions patterns (ci.yml, actions/deploy-pages docs)

---

*Patterns mapped by Claude Code, Phase 7 Pattern Mapper*
