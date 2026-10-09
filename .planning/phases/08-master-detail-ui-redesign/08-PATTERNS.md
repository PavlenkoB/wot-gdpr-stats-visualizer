# Phase 8: Master-detail UI redesign - Pattern Map

**Mapped:** 2026-10-07
**Files analyzed:** 14 (new/modified)
**Analogs found:** 12 / 14 (86% coverage)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/App.svelte` | component | request-response | `src/App.svelte` | exact |
| `src/app.css` | config | static | `src/app.css` | exact |
| `src/lib/shell/Dashboard.svelte` | component (shell) | state-management | `src/lib/shell/Dashboard.svelte` | role-match |
| `src/lib/shell/ListPane.svelte` | component | request-response | `src/lib/shell/DashboardNav.svelte` | role-match |
| `src/lib/shell/DetailPane.svelte` | component | request-response | `src/lib/shell/DashboardSection.svelte` | role-match |
| `src/lib/shell/DashboardNav.svelte` | component (deprecated) | request-response | `src/lib/shell/DashboardNav.svelte` | exact |
| `src/lib/shell/selection-state.ts` | utility | transform | `src/lib/shell/dashboard-status.ts` | role-match |
| `tests/e2e/shell/master-detail-nav.spec.ts` | test | request-response | `tests/e2e/shell/scroll-nav.spec.ts` | role-match |
| `tests/e2e/_support/helpers.ts` | utility (test) | transform | `tests/e2e/_support/helpers.ts` | exact |
| `tests/unit/shell/selection-state.test.ts` | test | transform | `tests/unit/core/focus-clear.test.ts` | role-match |
| `tests/unit/guards/ci-budget.test.ts` | test | CRUD | `tests/unit/guards/ci-budget.test.ts` | exact |
| `tests/unit/charts/contrast.test.ts` | test | transform | `tests/unit/charts/contrast.test.ts` | exact |

## Pattern Assignments

### `src/App.svelte` (component, request-response)

**Analog:** `src/App.svelte`

**Usage:** Top-level app component. Phase 8 changes only the dashboard import and layout; the app shell wrapper remains the same structure.

**Structure pattern** (lines 1-20):
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Dashboard from './lib/shell/Dashboard.svelte';
  import ImportBar from './lib/shell/ImportBar.svelte';
  // (existing imports)
</script>

<main data-worker-ready={workerReady}>
  <ImportBar />
  <Dashboard {result} />
</main>
```

**Styling pattern** (lines 50+):
- `.dashboard` flex column layout with gap tokens
- Media queries for responsive breakpoints (900px, 480px)
- No changes to existing color or spacing tokens

---

### `src/app.css` (config, static)

**Analog:** `src/app.css`

**Usage:** Root stylesheet. Phase 8 adds neutral tokens and updates media queries for desktop sticky list pane.

**Token declaration pattern** (add to `:root`, lines 40+):
```css
:root {
  /* Existing --ramp-* and --flow-* stay unchanged */
  --page: #ffffff;
  --list: #f5f5f5;
  --card: #ffffff;
  --border: #dcdcdc;
  --faint: #8c8c8c;
  --ink: #111111;
  --text: #3a3a3a;
  --muted: #5c5c5c;
  --sel: #e0e0e0;
  --hover: #ececec;
  --chip: #ececec;
  --track: #ececec;
  --focus: #1a73e8;
  --radius-card: 8px;
  --radius-control: 8px;
}
```

**Media query pattern** (add breakpoint for desktop sticky):
```css
/* Desktop: 900px and up — sticky list pane */
@media (min-width: 900px) {
  .pane-list {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: auto;
  }
}

/* Phone: 480px and down — list XOR detail screens */
@media (max-width: 480px) {
  .shell[data-view="list"] .pane-detail {
    display: none;
  }
  .shell[data-view="detail"] .pane-list {
    display: none;
  }
}
```

**Hex migration note:** Replace `#3c4043` → `var(--text)`, `#5f6368` → `var(--muted)` throughout `src/` (see 08-UI-SPEC.md build notes).

---

### `src/lib/shell/Dashboard.svelte` (component, state-management)

**Analog:** `src/lib/shell/Dashboard.svelte`

**Usage:** Shell root. Major rewrite: add selection state ($state rune), selection fallback ($derived), mount-only-selected detail section. Replaces the scroll-spy anchor nav pattern with pure component state.

**Selection state pattern** (Svelte 5 runes, lines 1-50):
```typescript
<script lang="ts">
  import { setContext } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { resolveSelection } from './selection-state.ts';
  import { navEntries } from './dashboard-status.ts';
  
  interface Props {
    result: ClassifyResult | null;
  }
  let { result }: Props = $props();
  
  // D-03: selection is component state, lost on reload
  let selected = $state<string>('overview');
  
  // D-04: fallback if selected section disappears after replace
  const activeSection = $derived.by(() => {
    const resolved = resolveSelection(selected, result);
    if (resolved !== selected) {
      selected = resolved;  // mutate state if needed
    }
    return resolved;
  });
  
  // Set context for child components
  setContext('selected-section', { activeSection });
</script>

<div class="shell">
  <ListPane {result} {selected} onselect={(id) => { selected = id; }} />
  <DetailPane>
    <!-- Only selected section mounts -->
    {#if activeSection === 'overview'}
      <Overview {result} />
    {:else if activeSection === 'playtime'}
      <Playtime {result} client={ingestClient.playtime} />
    {/if}
  </DetailPane>
  
  {#if result !== null}
    <p class="chart-status" role="status" aria-live="polite" aria-atomic="true">
      {chartAnnouncement}
    </p>
  {/if}
</div>
```

**Shell layout** (CSS, lines 60+):
```css
.shell {
  display: flex;
  flex-wrap: wrap;
  min-height: 100vh;
}

@media (min-width: 900px) {
  .shell { flex-wrap: nowrap; }
}
```

**Key changes from existing:**
- Remove `scroll-spy.ts` imports and `activeId` scroll tracking
- Replace scroll observer with plain component state
- Unmount non-selected sections entirely (no CSS display:none)
- Keep chart-status region outside detail pane (context pattern unchanged)

---

### `src/lib/shell/ListPane.svelte` (component, request-response)

**Analog:** `src/lib/shell/DashboardNav.svelte`

**Usage:** Left navigation pane listing sections. New component extracted from navigation logic; holds IdentityHeader, nav buttons with j/k/arrow keyboard support, file input, dropzone, action buttons.

**Keyboard navigation pattern** (lines 50-120):
```typescript
<script lang="ts">
  import { tick } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { navEntries, type NavId } from './dashboard-status.ts';
  
  interface Props {
    result: ClassifyResult | null;
    selected: NavId;
    onselect: (id: NavId) => void;
  }
  let { result, selected, onselect }: Props = $props();
  
  const links = $derived(navEntries(result));
  let navEl: HTMLElement | undefined = $state();
  let detailEl: HTMLElement | undefined = $state();
  
  async function onKeyDown(e: KeyboardEvent): Promise<void> {
    // D-05: skip if modifier keys are held
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    
    const availableIds = links
      .filter((l) => !l.muted)
      .map((l) => l.id);
    
    if (availableIds.length === 0) return;
    
    const idx = availableIds.indexOf(selected);
    
    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        if (idx < availableIds.length - 1) {
          onselect(availableIds[idx + 1]);
        }
        break;
      
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        if (idx > 0) {
          onselect(availableIds[idx - 1]);
        }
        break;
      
      case 'Enter':
        e.preventDefault();
        // D-05: Enter moves focus to detail pane
        await tick();
        detailEl?.focus();
        break;
      
      case 'Escape':
        // D-05: Escape returns focus to list
        if (e.defaultPrevented) return;
        e.preventDefault();
        navEl?.querySelector('button[aria-current="true"]')?.focus();
        break;
    }
  }
</script>

<div class="pane-list" data-testid="list-pane" bind:this={navEl}>
  <IdentityHeader {result} />
  
  <nav data-testid="dashboard-nav" on:keydown={onKeyDown}>
    {#each links as link (link.id)}
      <button
        data-testid="list-row-{link.id}"
        aria-current={link.id === selected ? 'true' : undefined}
        onclick={() => onselect(link.id)}
        class:muted={link.muted}
      >
        <span class="title">{SECTION_TITLES[link.id]}</span>
        {#if link.suffix}
          <span class="suffix">{link.suffix}</span>
        {/if}
      </button>
    {/each}
  </nav>
  
  <!-- Dropzone, file input, Start Over, Clear buttons -->
  <slot />
</div>

<div class="pane-detail" data-testid="detail-pane" bind:this={detailEl} tabindex="-1">
  <slot name="detail" />
</div>
```

**Styling pattern** (lines 140+):
- `.pane-list`: flex column, light background, border-right
- `.pane-detail`: large flex basis (99), min-width: 0 for text wrapping
- Button states: `[aria-current="true"]` for selected (background + inset bar)
- Hover state: `#ececec` background
- Muted text: `#5c5c5c` color

---

### `src/lib/shell/DetailPane.svelte` (component, request-response)

**Analog:** `src/lib/shell/DashboardSection.svelte`

**Usage:** Right detail pane wrapper. Scrollable container for selected section's content. Simple wrapper component; the actual section content is mounted/unmounted by Dashboard parent.

**Simple wrapper pattern** (lines 1-50):
```svelte
<script lang="ts">
  interface Props {
    // No props needed; content is slotted from parent
  }
</script>

<div class="pane-detail" data-testid="detail-pane" tabindex="-1">
  <slot />
</div>

<style>
  .pane-detail {
    flex: 999 1 560px;
    min-width: 0;
    padding: 32px 40px 64px;
    overflow-y: auto;
  }
  
  @media (max-width: 900px) {
    .pane-detail { flex-basis: 100%; }
  }
</style>
```

**Usage in Dashboard:**
```svelte
<DetailPane>
  {#if activeSection === 'overview'}
    <Overview {result} />
  {:else if activeSection === 'playtime'}
    <Playtime {result} client={ingestClient.playtime} />
  {/if}
</DetailPane>
```

---

### `src/lib/shell/DashboardNav.svelte` (component, deprecated)

**Analog:** `src/lib/shell/DashboardNav.svelte`

**Usage:** This file is retired (D-02). All navigation logic moves to ListPane.svelte. The file should be deleted or stubbed as a deprecation marker.

**Action:** Remove entire file and all imports across codebase. The scroll-spy machinery (`scroll-spy.ts`, observer, `pickActiveSection`, `buildRootMargin`) are all retired.

---

### `src/lib/shell/selection-state.ts` (utility, transform)

**Analog:** `src/lib/shell/dashboard-status.ts`

**Usage:** Pure TypeScript utilities for selection logic. Testable without jsdom. Used by Dashboard shell and tests.

**Resolveselection function** (lines 1-50):
```typescript
import { navEntries, type NavId } from './dashboard-status.ts';
import type { ClassifyResult } from '../core/types/worker-messages.ts';

/**
 * D-04: Resolve the active section after a replace or clear.
 *
 * If the selected section is absent from the new result, or result is null,
 * default to 'overview'. Otherwise return the selected section unchanged.
 */
export function resolveSelection(
  selected: string | null,
  result: ClassifyResult | null,
): NavId {
  if (result === null) return 'overview';
  
  const available = navEntries(result)
    .filter((entry) => !entry.muted)
    .map((entry) => entry.id);
  
  return (selected !== null && available.includes(selected as NavId))
    ? (selected as NavId)
    : 'overview';
}

/**
 * D-05 keyboard helper: next available section (wrap).
 */
export function nextAvailableSection(
  current: NavId,
  available: readonly NavId[],
): NavId {
  const idx = available.indexOf(current);
  if (idx === -1) return available[0] ?? current;
  return available[(idx + 1) % available.length];
}

/**
 * D-05 keyboard helper: previous available section (wrap).
 */
export function prevAvailableSection(
  current: NavId,
  available: readonly NavId[],
): NavId {
  const idx = available.indexOf(current);
  if (idx <= 0) return available[available.length - 1] ?? current;
  return available[idx - 1];
}
```

**Key pattern:** Pure functions, no DOM, no side effects. Testable under Node with Vitest (no jsdom needed).

---

### `tests/e2e/shell/master-detail-nav.spec.ts` (test, request-response)

**Analog:** `tests/e2e/shell/scroll-nav.spec.ts`

**Usage:** New E2E test suite replacing scroll-nav tests. Tests keyboard navigation (j/k/arrows), selection state, Enter/Escape focus management, phone list/detail switching, Overview default, fallback on replace.

**Test structure pattern** (lines 1-100):
```typescript
import '../_support/pin-locale';
import { expect, test, type Page } from '@playwright/test';
import { buildSampleExport } from '../../fixtures/export-fixtures.ts';
import { openSection } from '../_support/helpers.ts';

test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 600 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
});

test('Overview is default selection on first load', async ({ page }) => {
  const bytes = new Uint8Array(buildSampleExport());
  await page.getByTestId('file-input').setInputFiles({
    name: 'sample.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  
  // Wait for import to land
  await expect(page.getByTestId('list-row-overview')).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('j key moves selection down', async ({ page }) => {
  // Import, then press j
  await openSection(page, 'overview');
  await page.getByTestId('dashboard-nav').focus();
  await page.keyboard.press('j');
  
  // Verify playtime is now selected
  await expect(page.getByTestId('list-row-playtime')).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('k key moves selection up', async ({ page }) => {
  // Import, select playtime, then press k
  await openSection(page, 'playtime');
  await page.getByTestId('dashboard-nav').focus();
  await page.keyboard.press('k');
  
  // Verify overview is selected again
  await expect(page.getByTestId('list-row-overview')).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('Enter moves focus from list to detail pane', async ({ page }) => {
  await openSection(page, 'overview');
  await page.getByTestId('dashboard-nav').focus();
  await page.keyboard.press('Enter');
  
  // Detail pane now has focus
  await expect(page.getByTestId('detail-pane')).toBeFocused();
});

test('Escape returns focus from detail to list', async ({ page }) => {
  await openSection(page, 'overview');
  await page.getByTestId('detail-pane').focus();
  await page.keyboard.press('Escape');
  
  // List now has focus back
  await expect(page.getByTestId('list-row-overview')).toBeFocused();
});

test('phone: list screen shown on first load', async ({ page }) => {
  test.use({ viewport: { width: 400, height: 800 } });
  await page.goto('/');
  
  // Detail pane is hidden via CSS media query
  await expect(page.getByTestId('detail-pane')).not.toBeVisible();
  await expect(page.getByTestId('list-pane')).toBeVisible();
});

test('phone: detail screen shown after selecting section', async ({ page }) => {
  test.use({ viewport: { width: 400, height: 800 } });
  await openSection(page, 'playtime');
  
  // List is hidden, detail is visible
  await expect(page.getByTestId('list-pane')).not.toBeVisible();
  await expect(page.getByTestId('detail-pane')).toBeVisible();
});

test('selection falls back to Overview if section absent after replace', async ({ page }) => {
  const bytes1 = new Uint8Array(buildSampleExport());
  const bytes2 = new Uint8Array(buildZeroRowPaymentExport()); // No Playtime
  
  // Import first, select playtime
  await openSection(page, 'playtime');
  
  // Replace with export that has no Playtime
  await page.getByTestId('file-input').setInputFiles({
    name: 'replace.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes2),
  });
  
  const panel = page.getByTestId('confirm-panel');
  await expect(panel).toBeVisible();
  await panel.getByTestId('confirm-commit').click();
  
  // Selection falls back to Overview (D-04)
  await expect(page.getByTestId('list-row-overview')).toHaveAttribute(
    'aria-current',
    'true',
  );
});
```

**Test count target:** ~8 tests (down from 17 in scroll-nav.spec.ts, net -9 tests).

---

### `tests/e2e/_support/helpers.ts` (utility, transform)

**Analog:** `tests/e2e/_support/helpers.ts`

**Usage:** Add shared helper for opening a section by ID. Used by ~10 affected specs that currently locate sections by scroll position.

**openSection helper** (add lines after `gotoApp`):
```typescript
/**
 * Open a specific section by ID (navigation helper for Phase 8).
 *
 * Before Phase 8, specs located sections by scroll position. Phase 8 replaces
 * scroll-spy with selection state, so this helper clicks the list row to
 * navigate instead. Used by specs that previously scrolled:
 * uat-criteria, playtime-charts, playtime-ui-review, touch-targets,
 * touch-tooltips, vehicle-stats, finance, login-history, login-table, login-map.
 *
 * D-07: shared helper in support directory, not duplicated per spec.
 */
export async function openSection(
  page: Page,
  sectionId: string,
): Promise<void> {
  // Click the list row for this section
  const listRow = page.getByTestId(`list-row-${sectionId}`);
  await expect(listRow).toBeVisible();
  await listRow.click();
  
  // Wait for the detail pane to show this section
  await expect(page.getByTestId(`section-${sectionId}`)).toBeVisible();
}
```

**Migration note:** Replace all scroll-position-based locators in affected specs with `await openSection(page, 'playtime')` calls.

---

### `tests/unit/shell/selection-state.test.ts` (test, transform)

**Analog:** `tests/unit/core/focus-clear.test.ts`

**Usage:** Unit tests for `selection-state.ts` pure functions. No jsdom (Vitest has none by design). Tests fallback logic, next/prev wrapping, muted section exclusion.

**Test structure pattern** (lines 1-100):
```typescript
import { describe, expect, test } from 'vitest';
import { resolveSelection, nextAvailableSection, prevAvailableSection } from '../../../src/lib/shell/selection-state.ts';
import { buildSampleExport, buildZeroRowPaymentExport } from '../../fixtures/export-fixtures.ts';

describe('selection-state', () => {
  describe('resolveSelection', () => {
    test('returns overview when result is null (D-04)', () => {
      expect(resolveSelection('playtime', null)).toBe('overview');
    });
    
    test('returns overview when selected section is absent after replace (D-04)', () => {
      const result = buildZeroRowPaymentExport(); // No Playtime
      expect(resolveSelection('playtime', result)).toBe('overview');
    });
    
    test('keeps selected when available (D-03)', () => {
      const result = buildSampleExport();
      expect(resolveSelection('playtime', result)).toBe('playtime');
    });
    
    test('defaults to overview on first load', () => {
      const result = buildSampleExport();
      expect(resolveSelection(null, result)).toBe('overview');
    });
  });
  
  describe('nextAvailableSection', () => {
    test('wraps from last to first (D-05)', () => {
      const available = ['overview', 'playtime', 'login-history'] as const;
      expect(nextAvailableSection('login-history', available)).toBe('overview');
    });
    
    test('moves to next section', () => {
      const available = ['overview', 'playtime', 'login-history'] as const;
      expect(nextAvailableSection('overview', available)).toBe('playtime');
    });
  });
  
  describe('prevAvailableSection', () => {
    test('wraps from first to last (D-05)', () => {
      const available = ['overview', 'playtime', 'login-history'] as const;
      expect(prevAvailableSection('overview', available)).toBe('login-history');
    });
    
    test('moves to previous section', () => {
      const available = ['overview', 'playtime', 'login-history'] as const;
      expect(prevAvailableSection('playtime', available)).toBe('overview');
    });
  });
});
```

**Test count:** ~8 unit tests (NEW).

---

### `tests/unit/guards/ci-budget.test.ts` (test, CRUD)

**Analog:** `tests/unit/guards/ci-budget.test.ts`

**Usage:** Update CI budget constants to reflect new test count after scroll-nav.spec.ts deletion and master-detail-nav.spec.ts addition.

**Update pattern** (lines 40-100):

From existing file, recalculate using the formula:
```typescript
// Current measured count: 257 tests (per RESEARCH.md)
// After Phase 8 changes:
//   - Delete scroll-nav.spec.ts: -17 tests
//   - Add master-detail-nav.spec.ts: +8 tests
//   - Net: 257 - 17 + 8 = 248 tests

// E = 330 + 5 * (248 - 101) + 223
//   = 330 + 735 + 223
//   = 1288 s
// 1.3 * E = 1674.4 s, floor = 1680 s (at ceiling 1740 s; 60 s headroom)

const PRE_PHASE_SECONDS = 330;
const SECONDS_PER_NEW_TEST = 5;
const SCALE_SPEC_TEST_COUNT = 5 + 5 + 5; // playtime, finance, login scale tests
const PRE_PHASE_TEST_COUNT = 101;
const SCALE_SPEC_SECONDS = 120 + 90 + 13; // respective scale specs
```

Update `playwright.config.ts` and `.github/workflows/ci.yml` if the math shows test count crosses a ceiling.

---

### `tests/unit/charts/contrast.test.ts` (test, transform)

**Analog:** `tests/unit/charts/contrast.test.ts`

**Usage:** Update color contrast assertions to include new neutral token pairs introduced in Phase 8.

**Update pattern** (add to existing pairs, lines 40+):

```typescript
// Existing pairs from --ramp-* (unchanged)
// Add new neutral pairs from 08-UI-SPEC.md:

// Ink on white (buttons, text)
pairs.push(['#111111', '#ffffff', 'ink on page']);

// Ink on #f5f5f5 (buttons on list pane)
pairs.push(['#111111', '#f5f5f5', 'ink on list']);

// Text on white
pairs.push(['#3a3a3a', '#ffffff', 'text on page']);

// Muted on #f5f5f5
pairs.push(['#5c5c5c', '#f5f5f5', 'muted on list']);

// White on ink (primary button)
pairs.push(['#ffffff', '#111111', 'white on ink']);

// Muted on white (captions)
pairs.push(['#5c5c5c', '#ffffff', 'muted on page']);
```

---

## Shared Patterns

### Svelte 5 Runes for State Management

**Source:** `src/lib/shell/Dashboard.svelte`, `src/lib/shell/ListPane.svelte`

**Apply to:** All new Svelte components in Phase 8

**Pattern:**
```typescript
// $state: reactive variable
let selected = $state<string>('overview');

// $derived: computed value
const available = $derived(navEntries(result).filter(e => !e.muted));

// $derived.by: conditional fallback
const activeSection = $derived.by(() => {
  const resolved = resolveSelection(selected, result);
  if (resolved !== selected) selected = resolved;
  return resolved;
});

// $effect: side effects (scoped to component)
$effect(() => {
  navEl?.querySelector('button[aria-current="true"]')?.focus();
});
```

### CSS Flexbox Layout for Two-Pane Shell

**Source:** `src/app.css`, `src/lib/shell/ListPane.svelte`, `src/lib/shell/DetailPane.svelte`

**Apply to:** All layout changes

**Pattern:**
```css
/* Shell (parent) */
.shell {
  display: flex;
  flex-wrap: wrap;
  min-height: 100vh;
}

/* List pane (left) */
.pane-list {
  flex: 1 0 320px;           /* min 320px, grow to available */
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: var(--list);
  border-right: 1px solid var(--border);
}

/* Detail pane (right) */
.pane-detail {
  flex: 999 1 560px;          /* prefer 560px, shrink to fit, grow last */
  min-width: 0;               /* allow text wrapping */
  padding: 32px 40px 64px;
  overflow-y: auto;
}

/* Desktop: sticky list */
@media (min-width: 900px) {
  .pane-list {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: auto;
  }
}

/* Tablet: stack full-width */
@media (max-width: 900px) {
  .pane-list { flex-basis: 100%; background: var(--page); }
  .pane-detail { flex-basis: 100%; }
}

/* Phone: list XOR detail (CSS media + data-view attribute) */
@media (max-width: 480px) {
  .shell[data-view="list"] .pane-detail { display: none; }
  .shell[data-view="detail"] .pane-list { display: none; }
}
```

### Keyboard Navigation (j/k/arrows)

**Source:** `src/lib/shell/ListPane.svelte`

**Apply to:** List pane navigation

**Pattern:**
```typescript
async function onKeyDown(e: KeyboardEvent): Promise<void> {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  
  const available = links.filter(l => !l.muted).map(l => l.id);
  const idx = available.indexOf(selected);
  
  switch (e.key) {
    case 'j':
    case 'ArrowDown':
      e.preventDefault();
      if (idx < available.length - 1) onselect(available[idx + 1]);
      break;
    case 'k':
    case 'ArrowUp':
      e.preventDefault();
      if (idx > 0) onselect(available[idx - 1]);
      break;
    case 'Enter':
      e.preventDefault();
      await tick();
      detailEl?.focus();
      break;
    case 'Escape':
      if (e.defaultPrevented) return;
      e.preventDefault();
      navEl?.querySelector('button[aria-current="true"]')?.focus();
      break;
  }
}
```

### E2E Test Helpers

**Source:** `tests/e2e/_support/helpers.ts`

**Apply to:** All new E2E tests

**Pattern:**
```typescript
export async function openSection(page: Page, sectionId: string): Promise<void> {
  const listRow = page.getByTestId(`list-row-${sectionId}`);
  await expect(listRow).toBeVisible();
  await listRow.click();
  await expect(page.getByTestId(`section-${sectionId}`)).toBeVisible();
}
```

---

## No Analog Found

Files without close existing match (use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/shell/DetailPane.svelte` | component | request-response | Simple wrapper; no prior pane-detail component exists. Use DashboardSection pattern (flex column, min-width: 0). |

---

## Metadata

**Analog search scope:** `src/lib/shell/`, `tests/e2e/`, `tests/unit/`
**Files scanned:** 25+
**Pattern extraction date:** 2026-10-07

## Migration Checklist

- [ ] **Imports:** Update Dashboard.svelte to import ListPane, DetailPane, not DashboardNav
- [ ] **Colors:** Add neutral token block to app.css :root
- [ ] **Hex migration:** Replace #3c4043 → var(--text), #5f6368 → var(--muted) in src/
- [ ] **Test helper:** Add openSection() to tests/e2e/_support/helpers.ts
- [ ] **E2E specs:** Update ~10 affected specs to use openSection() instead of scroll position
- [ ] **CI budget:** Recalculate with new test count; update playwright.config.ts, ci.yml, ci-budget.test.ts if needed
- [ ] **Contrast tests:** Add new neutral token pairs to tests/unit/charts/contrast.test.ts
- [ ] **Delete:** scroll-spy.ts and all scroll-spy imports

---

*Phase: 08-master-detail-ui-redesign*
*Mapped: 2026-10-07*
