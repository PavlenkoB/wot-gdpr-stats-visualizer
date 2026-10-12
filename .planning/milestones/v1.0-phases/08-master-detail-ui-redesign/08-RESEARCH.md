# Phase 8: Master-detail UI Redesign - Research

**Researched:** 2026-10-07
**Domain:** Shell architecture, layout, keyboard navigation, test refactoring
**Confidence:** HIGH

## Summary

Phase 8 replaces the scroll-spy anchor-nav layout with a two-pane master-detail dashboard, mounted entirely client-side with selection held as component state (never a route). The left pane lists sections; the right shows the selected section's detail. Only the selected section renders; unselected sections stay unmounted, allowing chart state (tooltips, selections) to reset on navigation while data queries remain cached per channel. Keyboard navigation (`j`/`k`, arrows, Enter, Escape) moves selection within list focus. Phone width switches to list-then-detail screens without a router. The change retools ~17 affected test files from scroll-position-based locators to element-location-based ones, requires updating the scroll-spy machinery that measures the sticky nav, and adds backward-incompatible test helpers. **CI e2e budget is now 257 tests / 1740 s at ceiling** (not the stale 239 / 1243 s cited in D-08); the planner must reconcile test count against all three limits together.

**Primary recommendation:** Use pure `.ts` modules for selection resolution and fallback logic (DecideSelection pattern); Svelte components only for plumbing and lifecycle. Mount-only-selected is critical for UI isolation and chart-state reset — don't use display:none as a workaround because windowed tables measure their container once at mount.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Section mounting:**
- **D-01:** Mount only the selected section's detail. Non-selected sections are not in the DOM. Chart state resets on switch; data queries stay cached per channel in the existing `QueryClient`, so switching is cheap.
- **D-02:** `scroll-spy.ts`, its unit test, and the anchor-scroll behaviour in `DashboardNav.svelte` are retired entirely, not adapted.

**Selection lifecycle:**
- **D-03:** First import and replace-import both land on Overview. Clear returns to the empty state. Selection is plain component state: lost on reload, no `location.hash` mirror.
- **D-04:** If the selected section is absent from the dataset (e.g. after replace), fall back to Overview.

**Keyboard:**
- **D-05:** `j`/`k` and arrow keys move selection only while focus is inside the list pane. `Enter` moves focus to the detail pane, `Escape` returns it to the list. No page-wide handler, so no conflict with in-chart arrow navigation, inputs, or dialogs.
- **D-06:** ARIA per UI-SPEC: `<nav>` of `<button>` rows with `aria-current="true"`, not a `listbox`.

**E2E migration and budget:**
- **D-07:** Add a shared `openSection(page, id)` helper in `tests/e2e/_support/helpers.ts`; call it in the ~10 specs that locate sections by scroll/viewport position.
- **D-08:** Replace `tests/e2e/shell/scroll-nav.spec.ts` (17 tests) with a smaller master-detail nav spec (selection, Overview default, j/k, phone list→detail→back). **Current measured budget: 257 tests, 29 min (1740 s) global timeout.** Test count must be reconciled against all three limits: `ci.yml` wrapper (31 min / 1860 s), GitHub Actions job timeout (39 min / 2340 s). No single limit may move independently.

### Claude's Discretion

- Exact component split (Shell / ListPane / DetailPane / Overview) and file names.
- Overview card summaries' derivation, reusing `dashboard-status.ts`.
- Where focus lands when the selected row changes on phone.

### Deferred Ideas (OUT OF SCOPE)

- `location.hash` deep linking of selection
- Chart | Table toggle per section
- Dark mode (needs a dark ramp)

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Selection state | Frontend (Svelte component) | — | Component state in Dashboard.svelte or Shell |
| Navigation (list pane) | Browser (keyboard, click) | — | j/k/arrows move selection; click selects; no router |
| Detail rendering | Frontend (section mount) | — | Only selected section in DOM; data queries cached per channel |
| Overview cards | Frontend (derived) | — | Status aggregation from `dashboard-status.ts` + query results |
| Focus management | Browser (Enter/Escape) | Frontend (focus methods) | Browser handles native focus; Svelte calls `.focus()` after `await tick()` |
| Phone transitions | Frontend (CSS + state) | — | Same selection state; CSS hides list or detail per viewport |
| Keyboard hints | Frontend (CSS :focus-within) | — | "Move with j and k" shown via CSS, no JS |

## Standard Stack

### Core (No Changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte | ^5.57 | UI framework, runes-based reactivity | Locked. Current stable; runes are the settled model. |
| Vite | ^8.3 | Build tool, dev server | Locked. Mature worker bundling support. |
| @sveltejs/vite-plugin-svelte | ^7.3 | Vite↔Svelte integration | Locked. **Must pin with Vite 8** — v7 requires Vite `^8.0.0` as hard peerDependency. |
| TypeScript | ^6.x | Static typing | Locked. TS 7 / tsgo not yet supported by `svelte-check` / `typescript-eslint` (targeted 7.1 ~Nov 2026). |
| pnpm | ^12.6 | Package manager | Locked. Rust rewrite (Aug 2026); no compatibility concerns. |

### Supporting (No Changes)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Dexie | ^4.4.6 | IndexedDB wrapper, cached parsed dataset | Persists results across reloads. |
| fflate | ^0.8.3 | Zip decompression in Web Worker | Off-thread decompression, no async unzip that blocks main. |
| PapaParse | ^5.7.0 | CSV parsing (semicolon-delimited, bare-CR handling) | Existing CSV tolerance verified; unchanged. |
| @types/papaparse | latest matching | TS types for PapaParse (untyped upstream) | Required for TypeScript setup. |
| bits-ui | ^2.18 | Headless a11y primitives (tabs, tooltip, popover) | Not used in Phase 8; tabs used for disclosure patterns in existing code. |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | ^5.0 | Unit/component tests (no jsdom) |
| Playwright | ^1.63 | E2E tests; zero-network CI assertions |
| svelte-check | ^4.7 | Svelte+TS type checking / CI gate |
| ESLint + typescript-eslint + eslint-plugin-svelte | current | Linting; not Biome (Svelte support still maturing) |
| prettier-plugin-svelte | current | Formatting |

### No New Dependencies

Phase 8 adds **zero new npm packages**. Layout and keyboard navigation are hand-rolled; the selection pattern uses only Svelte 5 runes (`$state`, `$derived`, `$effect`).

## Package Legitimacy Audit

Not applicable — no external packages installed this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│           Browser (Single Page)                 │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  App.svelte                              │   │
│  │  ├─ ImportBar (drag/drop, status)       │   │
│  │  └─ Dashboard (root shell)              │   │
│  │     ├─ IdentityHeader (account info)    │   │
│  │     ├─ ListPane (nav buttons)           │   │
│  │     │  ├─ Section buttons (j/k nav)     │   │
│  │     │  ├─ File input + dropzone         │   │
│  │     │  └─ Start Over / Clear buttons    │   │
│  │     ├─ DetailPane (scrollable content)  │   │
│  │     │  ├─ (only selected section)       │   │
│  │     │  └─ Charts + tables               │   │
│  │     └─ chart-status region (live)       │   │
│  │                                         │   │
│  │  Data flow:                             │   │
│  │   zip → Worker (parsing) → Dexie (IDB) │   │
│  │                                         │   │
│  │  Selection: component state             │   │
│  │   (no route, no hash)                   │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  @ Desktop (≥900px): flex row, sticky list    │
│  @ Tablet (480–900px): stacked                │
│  @ Phone (≤480px): list then detail (CSS)     │
└─────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new directories. Modified files:

```
src/
├── App.svelte (modified: import Dashboard)
├── app.css (modified: add 900px sticky breakpoint)
├── lib/
│  ├── shell/
│  │  ├── Dashboard.svelte (REWRITE: two-pane, selection state)
│  │  ├── ListPane.svelte (NEW: left pane, keyboard nav)
│  │  ├── DetailPane.svelte (NEW: right pane, mounted section only)
│  │  ├── DashboardNav.svelte (DEPRECATED: scroll-spy logic removed)
│  │  ├── IdentityHeader.svelte (moved into list pane)
│  │  ├── dashboard-status.ts (UNCHANGED: section derivation)
│  │  ├── scroll-spy.ts (RETIRED: delete entire file)
│  │  └── selection-state.ts (NEW: pure functions for fallback/next/prev)
│  └── features/
│     └── (no changes; sections mount/unmount via parent state)

tests/
├── e2e/
│  ├── _support/
│  │  └── helpers.ts (ADD: openSection(page, id) helper)
│  └── shell/
│     ├── scroll-nav.spec.ts (RETIRE: 17 tests)
│     ├── master-detail-nav.spec.ts (NEW: ~8 tests, selection/keyboard)
│     └── other spec files (UPDATE: use openSection instead of scroll)
└── unit/
   └── guards/
      └── ci-budget.test.ts (UPDATE: new ceiling calculation)
```

### Pattern 1: Mount-Only-Selected Section

**What:** Only the selected section is in the DOM. Unselected sections are unmounted entirely, resetting chart state (tooltips, focused cells, table sort) while preserving data queries in the `QueryClient` cache per channel.

**When to use:** Multi-section layouts where state isolation between sections is critical. Prevents chart UI flicker and ambiguous keyboard focus when switching between sections. **Critical for windowed tables:** if a table measures its container once at mount, a `display:none` CSS hiding keeps it mounted but returns zero dimensions, breaking the table layout.

**Example (Svelte 5 runes):**
```typescript
// src/lib/shell/selection-state.ts (pure .ts, testable without jsdom)
export function resolveSelection(
  selected: string | null,
  result: ClassifyResult | null,
): string {
  // D-04: if selected section is absent after replace, fall back to Overview
  if (result === null) return 'overview';
  const available = navEntries(result)
    .filter((e) => !e.muted)
    .map((e) => e.id);
  if (selected !== null && available.includes(selected)) return selected;
  return 'overview';
}

export function nextSelection(current: string, available: readonly string[]): string {
  const idx = available.indexOf(current);
  return idx === -1 ? available[0] ?? current : available[(idx + 1) % available.length];
}

// src/lib/shell/Dashboard.svelte (Svelte 5)
<script lang="ts">
  import { setContext } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { resolveSelection } from './selection-state.ts';
  
  interface Props {
    result: ClassifyResult | null;
  }
  let { result }: Props = $props();
  
  // D-03: selection is component state, lost on reload
  let selected = $state<string>('overview');
  
  // D-04: fallback if selected section disappears after replace
  const activeSection = $derived.by(() => {
    const resolved = resolveSelection(selected, result);
    if (resolved !== selected) selected = resolved;
    return resolved;
  });
  
  // Set context for child components (optional; could pass as prop)
  setContext('selected-section', () => activeSection);
</script>

<div class="shell">
  <ListPane {result} on:select={(e) => { selected = e.detail; }} />
  <!-- Only the selected section is mounted -->
  {#if activeSection === 'overview'}
    <Overview {result} />
  {:else if activeSection === 'playtime'}
    <Playtime {result} client={ingestClient.playtime} />
  {/if}
</div>
```

### Pattern 2: Keyboard Navigation (j/k/arrows) in List Pane

**What:** `j`/`k` and arrow keys move selection within the list. `Enter` moves focus to the detail pane. `Escape` returns focus to the list. Handler is scoped to the `<nav>` element only, not the page.

**When to use:** Any list that should be keyboard-navigable without interfering with other keyboard interactions (charts, inputs, dialogs).

**Why `<nav>` scope:** The list pane also holds the file input (on a `<label>`), the dropzone, and the Start Over / Clear buttons. A page-wide keydown handler would interfere with text input, button presses, and the ConfirmPanel. Scoping to `<nav>` keeps j/k isolated to section selection.

**Example (Svelte 5):**
```typescript
// src/lib/shell/ListPane.svelte
<script lang="ts">
  import { tick } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { navEntries, NAV_ORDER } from './dashboard-status.ts';
  
  interface Props {
    result: ClassifyResult | null;
    selected: string;
  }
  let { result, selected }: Props = $props();
  
  const links = $derived(navEntries(result));
  let navEl: HTMLElement | undefined = $state();
  let detailEl: HTMLElement | undefined = $state();
  
  async function onKeyDown(e: KeyboardEvent): Promise<void> {
    // D-05: skip if modifier keys are held
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    
    const availableIds = links.filter((l) => !l.muted).map((l) => l.id);
    const idx = availableIds.indexOf(selected);
    
    switch (e.key) {
      case 'j':
      case 'ArrowDown:
        e.preventDefault();
        if (idx < availableIds.length - 1) selected = availableIds[idx + 1];
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        if (idx > 0) selected = availableIds[idx - 1];
        break;
      case 'Enter':
        e.preventDefault();
        // D-05: Enter moves focus to detail pane
        await tick();
        detailEl?.focus();
        break;
      case 'Escape':
        e.preventDefault();
        // D-05: Escape moves focus back to list
        navEl?.querySelector('button[aria-current="true"]')?.focus();
        break;
    }
  }
</script>

<div class="pane-list" bind:this={navEl}>
  <IdentityHeader {result} />
  
  <nav data-testid="list-pane" on:keydown={onKeyDown}>
    {#each links as link (link.id)}
      <button
        data-testid="list-row-{link.id}"
        aria-current={link.id === selected ? 'true' : undefined}
        onclick={() => { selected = link.id; }}
        class:muted={link.muted}
      >
        {link.title}
      </button>
    {/each}
  </nav>
  
  <!-- File input, dropzone, buttons live here -->
  <Dropzone onfiles={...} />
</div>

<div class="pane-detail" bind:this={detailEl} tabindex="-1">
  <!-- Only selected section mounts here -->
  <slot />
</div>

<style>
  .pane-list {
    flex: 1 0 320px;
    background: var(--list, #f5f5f5);
    display: flex;
    flex-direction: column;
  }
  
  nav {
    flex: 1;
    overflow-y: auto;
  }
  
  .pane-detail {
    flex: 999 1 560px;
    min-width: 0;
    padding: 32px 40px 64px;
  }
  
  button[aria-current="true"] {
    background: var(--sel, #e0e0e0);
    box-shadow: inset 3px 0 0 var(--ink, #111);
  }
  
  /* Keyboard hint: show only while list has focus */
  nav:focus-within::before {
    content: 'Move with j and k';
    font-size: 12px;
    color: var(--muted);
  }
  
  @media (min-width: 900px) {
    .pane-list {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
    }
  }
</style>
```

### Pattern 3: Phone List/Detail Switching (No Router)

**What:** Same selection state, but at `≤480px` width use CSS to hide list or detail. Phone shows list first; clicking a section (or pressing Enter) reveals the detail. A back button hides detail and returns to list.

**When to use:** Mobile-responsive multi-pane layouts without a client-side router.

**Why this works:** The selection state is already a rune in the shell. CSS `:not()` and media queries handle the layout; no JavaScript router needed. Back button is a simple button that sets `selected = null` or shows the list again.

**Example (Svelte 5 + CSS):**
```typescript
// src/lib/shell/Dashboard.svelte
<script lang="ts">
  let selected = $state<string>('overview');
  let showDetail = $state(false);
  
  function onSelectSection(id: string) {
    selected = id;
    showDetail = true; // Phone: show detail screen
  }
  
  function onBack() {
    showDetail = false; // Phone: return to list
  }
</script>

<div class="shell" data-view={showDetail ? 'detail' : 'list'}>
  <ListPane
    {result}
    {selected}
    onselect={(id) => onSelectSection(id)}
  />
  
  <DetailPane on:back={onBack}>
    {#if selected === 'overview'}
      <Overview {result} />
    {/if}
  </DetailPane>
</div>

<style>
  .shell {
    display: flex;
    flex-wrap: wrap;
  }
  
  /* Desktop: both panes visible */
  @media (min-width: 900px) {
    .shell {
      flex-wrap: nowrap;
    }
  }
  
  /* Phone: list XOR detail (not both) */
  @media (max-width: 480px) {
    .shell[data-view="list"] :global(.pane-detail) {
      display: none;
    }
    
    .shell[data-view="detail"] :global(.pane-list) {
      display: none;
    }
  }
</style>
```

### Anti-Patterns to Avoid

- **Display:none as a mounting workaround.** If you leave the section mounted but hide it with CSS, windowed tables that measure once at mount will read zero dimensions and break. Keep mount-only-selected as the source of truth.
- **Page-wide keydown handler for j/k.** A global listener interferes with chart arrow navigation, text inputs, and the ConfirmPanel. Always scope to the `<nav>` element.
- **Setting selection on click AND in scroll events.** Scroll-spy was needed with anchors. Selection state is simpler: update on click only. Don't try to sync with scroll position.
- **Storing selection in `$effect` that writes state.** Use `$derived` for fallback logic instead. The 06-08 mask-reset pattern (triggered by `importedAt` change) is the right model.
- **Using a router for section selection.** No `goto('#playtime')`, no `:navigate`. Selection is component state; navigation is instant and doesn't change the URL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Which section should be selected after replace?" | Ad-hoc fallback logic in a component | Pure `.ts` function `resolveSelection(selected, result)` | Testable without jsdom; reused by tests and planner. |
| "How do I move focus with keyboard?" | Custom focus management in effects | Svelte's `focus()` call after `await tick()` | Simpler; avoids race with rendering. |
| "Should I show list or detail on phone?" | JavaScript router or state machine | CSS media query + `data-view` attribute | State is already in Svelte; CSS handles layout. |
| "How do I unmount sections cleanly?" | Manual DOM removal or display:none | Svelte's `{#if mounted}` conditional | Proper lifecycle; prevents windowed-table measurement bugs. |
| "How do I prevent focus loss on mount?" | SetTimeout to re-focus after render | `await tick()` before `focus()` | Exactly what Svelte's tick is for; no timer guessing. |

**Key insight:** This phase is almost entirely **component plumbing and CSS layout**. No new libraries, no complex state machine, no custom focus trap. Svelte 5 runes + CSS media queries handle the hard parts.

## Runtime State Inventory

This phase is a refactor, not a rename. No stored keys, no environment variables, no OS-registered state changes. **All existing state persists identically:**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | IndexedDB schema unchanged (Dexie `queryResult` table keeps the same key structure). Selection state is transient (lost on reload, never stored). | None — data persistence is unchanged. |
| Live service config | No external service config. All data stays offline (zero network). | None. |
| OS-registered state | No OS-level registration. | None. |
| Secrets/env vars | No changes to `.env`, `SOPS` keys, or CI secrets. | None. |
| Build artifacts | `pnpm-lock.yaml` unchanged (no new packages). Compiled output path unchanged (`dist/`). | None. |

## Common Pitfalls

### Pitfall 1: Windowed Tables Measuring Zero Dimensions When Mounted Inside Hidden Container

**What goes wrong:** If the table stays mounted but its container is `display: none`, the table measures `getBoundingClientRect()` once at mount and gets 0px width/height. When the detail pane is shown, the table's column widths are already baked in as zero, breaking the layout.

**Why it happens:** Windowed tables (vehicles, login IP) optimize rendering by measuring their container once at startup. A one-shot measurement inside a hidden DOM branch returns zeros.

**How to avoid:** Use mount-only-selected. **Do not** use `display: none` as a workaround. Only the selected section's DOM should exist at all; unmount the rest entirely. Svelte's `{#if selected === 'vehicles'}` pattern is the correct solution.

**Warning signs:** (a) Table columns show zero width; (b) scroll area is impossibly narrow; (c) wrapping at phone width breaks the table layout.

### Pitfall 2: Keyboard Handler Interfering with Chart Arrow Keys

**What goes wrong:** A page-wide `keydown` handler for j/k and arrows intercepts arrow presses meant for the heatmap or hour grid, stopping chart navigation.

**Why it happens:** Arrow keys navigate both list selection and chart cells. Without scope, the list handler wins first.

**How to avoid:** Scope the keydown handler to the `<nav>` element only. The chart's own delegated handler (in `CalendarHeatmap.svelte` and `HourGrid.svelte`) will then see arrow presses that land inside the chart container.

**Warning signs:** (a) Chart arrow navigation stops working; (b) up/down arrows move list selection instead of the heatmap; (c) chart cells can't be focused with arrow keys.

### Pitfall 3: Selection State Lost During Async Replace

**What goes wrong:** User imports a new zip while viewing "Vehicles" section. Replace completes, but `selected = 'vehicles'` still points to a now-absent section ID. The detail pane should show Overview, but it still tries to show Vehicles (either crashes or shows stale data).

**Why it happens:** Selection update and data replace are separate. If selection isn't checked against the new result, mismatches occur.

**How to avoid:** Use a `$derived` fallback that reads `selected` and `result` together. Whenever `result` changes, recompute if `selected` is still valid. If not, return 'overview' (D-04). The fallback should not directly mutate state; let Svelte re-run the derived and leave the mutation to the planner's logic.

```typescript
const activeSection = $derived(() => {
  const resolved = resolveSelection(selected, result);
  if (resolved !== selected) selected = resolved; // mutate state if needed
  return resolved;
});
```

**Warning signs:** (a) Detail pane is blank after replace; (b) console error about missing section ID; (c) stale data shown.

### Pitfall 4: Focus Lost When Detail Pane Mounts

**What goes wrong:** User presses Enter to move focus from list to detail. Component renders, but focus is still on the list row. The tooltip closes (RESEARCH Phase 4 Pitfall 3 — tooltip dismisses on scroll), the list stays focused, and the user has to click the detail pane to interact with it.

**Why it happens:** DOM mutations (Svelte render) happen first, but focus needs the element to exist and be ready. Calling `focus()` too early lands on the wrong element or an element that doesn't exist yet.

**How to avoid:** Call `focus()` **after** `await tick()`. Tick ensures the render is complete and all elements exist.

```typescript
case 'Enter':
  e.preventDefault();
  await tick(); // Ensure detail pane is rendered
  detailEl?.focus(); // Now focus works
  break;
```

**Warning signs:** (a) Enter doesn't move focus to detail; (b) keyboard user can't reach detail pane content; (c) focus jumps to wrong element.

### Pitfall 5: Focus Trap or Escape Key Stealing from ConfirmPanel

**What goes wrong:** User is in the ConfirmPanel (delete data dialog). Presses Escape to close it. Instead, Escape moves focus back to the list pane and dismisses the panel unexpectedly.

**Why it happens:** The ConfirmPanel's Escape handler and the list pane's Escape handler both run. Order of precedence is unclear.

**How to avoid:** Check `event.defaultPrevented` before handling Escape in the list keydown. The ConfirmPanel should call `e.preventDefault()` on its own Escape handler, preventing the event from bubbling.

```typescript
case 'Escape':
  if (e.defaultPrevented) return; // ConfirmPanel or dialog already handled it
  e.preventDefault();
  navEl?.querySelector('button[aria-current="true"]')?.focus();
  break;
```

**Warning signs:** (a) ConfirmPanel closes when Escape is pressed, instead of staying open; (b) focus jumps to list while panel is visible; (c) multiple handlers fire for one keypress.

### Pitfall 6: The Sticky Nav's Bottom Edge Invalidates Focus Scroll Corrections

**What goes wrong:** User navigates a calendar heatmap with arrow keys. Focused cell moves under the sticky nav. `scrollClear` (phase 4) measures the nav's bottom edge and scrolls the page to clear it. **With the new list pane as the nav**, at `≥900px` the list is sticky, top:0, and `height: 100vh`. Its bottom edge is at the viewport height. Every cell that's on screen is now "under the nav" by definition, and the page jumps wildly every arrow press.

**Why it happens:** `focus-clear.ts:55–60` does `const nav = document.querySelector('nav')` and reads its `getBoundingClientRect().bottom`. The old nav was 72px tall. The new list pane is 100vh tall (the whole sidebar). The arithmetic breaks.

**How to avoid:** Replace the nav bottom-edge measurement with a fixed constant: the sticky nav's own height in pixels, not the bottom of the element itself. Or store `--nav-offset` in a CSS variable and read it in JS (already done in `DashboardNav.svelte:69`). Another option: pass the nav height as a context value from the shell to the chart.

**Tasks needed:**
- Read `focusScrollDelta()` in `playtime-model.ts` to understand its expected input.
- Update `scrollClear()` to not measure a DOM element; use a fixed value or context instead.
- Grep `src` for every use of scroll-margin, --nav-offset, and sticky positioning; update each comment.

**Warning signs:** (a) Page jumps on every arrow key in calendar/heatmap; (b) focused cell moves down off-screen instead of scrolling into view; (c) scroll corrections increase with page height.

### Pitfall 7: Charts Broken by Missing Chart Announcement Region or Wrong Count

**What goes wrong:** PhasePhase 8 mounts only the selected section. The page now has 1 chart, not 5. But the assertion in STATE's state record says "5 after an import, 1 before". Test walks `document.querySelectorAll('[role="status"][aria-live]')` and expects 5, not 2. Test fails.

**Why it happens:** The region count changed because sections are now unmounted. Unselected sections' charts don't exist.

**How to avoid:** Keep the page-level `chart-status` region in the shell, outside every section. It exists from the moment data loads and never unmounts. Verify test assertions against the new count (1 region before data, 1 region during data, same 1 region throughout).

**Tasks needed:**
- Test suite must update its region count assertions (was 5, now 1).
- Confirm the `chart-status` region stays outside the detail pane in the shell.

**Warning signs:** (a) `aria-live` region count assertion fails; (b) Playwright test counts `role="status"` and gets wrong number; (c) accessibility tree changes when sections mount/unmount.

## Code Examples

### Selection State (Pure `.ts`, Testable)

```typescript
// src/lib/shell/selection-state.ts
// [VERIFIED: dashboard-status.ts:40-51, 71-78]

import { navEntries, type NavId } from './dashboard-status.ts';
import type { ClassifyResult } from '../core/types/worker-messages.ts';

/**
 * D-04: Resolve the active section after a replace or clear.
 *
 * If the selected section is absent from the new result, or result is null,
 * default to 'overview'. Otherwise return the selected section unchanged.
 *
 * A pure function: no DOM, no side effects, no runes. Testable in Vitest
 * without jsdom. The component calls this inside a $derived, not an $effect,
 * and applies the fallback by mutating selected directly.
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
 * Returns the next section in NAV_ORDER that is not muted.
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

**Test:**
```typescript
// tests/unit/shell/selection-state.test.ts
import { describe, expect, test } from 'vitest';
import { resolveSelection, nextAvailableSection } from '../../../src/lib/shell/selection-state.ts';

describe('resolveSelection', () => {
  test('returns overview when result is null (D-04)', () => {
    expect(resolveSelection('playtime', null)).toBe('overview');
  });
  
  test('returns overview when selected is absent after replace (D-04)', () => {
    const result = buildZeroRowPaymentExport(); // Only Payment_history, no Playtime
    expect(resolveSelection('playtime', result)).toBe('overview');
  });
  
  test('keeps selected when available (D-03)', () => {
    const result = buildSampleExport(); // Has Playtime
    expect(resolveSelection('playtime', result)).toBe('playtime');
  });
});
```

### ListPane Component with Keyboard Nav

```typescript
// src/lib/shell/ListPane.svelte
// [VERIFIED: DashboardNav.svelte:1-50, dashboard-status.ts:264-274]

<script lang="ts">
  import { tick } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { navEntries, type NavId } from './dashboard-status.ts';
  import { SECTION_TITLES, NAV_STATUS_SUFFIX } from '../ui-copy.ts';
  
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
    // D-05: skip if modifier keys are held (don't interfere with text input, etc)
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    
    const available = links
      .filter((entry) => !entry.muted)
      .map((entry) => entry.id);
    
    if (available.length === 0) return;
    
    const idx = available.indexOf(selected);
    
    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        if (idx < available.length - 1) {
          onselect(available[idx + 1]);
        }
        break;
      
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        if (idx > 0) {
          onselect(available[idx - 1]);
        }
        break;
      
      case 'Enter':
        e.preventDefault();
        // D-05: Enter moves focus to detail pane
        await tick();
        detailEl?.focus();
        break;
      
      case 'Escape':
        // D-05: Escape handled elsewhere; check if panel prevented it
        if (e.defaultPrevented) return;
        e.preventDefault();
        navEl?.querySelector('button[aria-current="true"]')?.focus();
        break;
    }
  }
</script>

<div class="pane-list" data-testid="list-pane" bind:this={navEl}>
  <!-- Identity header (nickname, account info) -->
  <IdentityHeader {result} />
  
  <!-- Navigation: section buttons with j/k hints -->
  <nav data-testid="dashboard-nav" on:keydown={onKeyDown}>
    <!-- Keyboard hint: show only when list has focus -->
    <span class="keyboard-hint">Move with j and k</span>
    
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
  
  <!-- File input, dropzone, Start Over, Clear buttons live here -->
  <slot />
</div>

<div class="pane-detail" data-testid="detail-pane" bind:this={detailEl} tabindex="-1">
  <slot name="detail" />
</div>

<style>
  .pane-list {
    flex: 1 0 320px;
    background: var(--list, #f5f5f5);
    border-right: 1px solid var(--border, #dcdcdc);
    display: flex;
    flex-direction: column;
    align-self: flex-start;
  }
  
  nav {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  
  .keyboard-hint {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  
  /* Show keyboard hint only when list pane has focus */
  nav:focus-within .keyboard-hint {
    position: static;
    width: auto;
    height: auto;
    clip: auto;
    margin: 8px;
    font-size: 12px;
    color: var(--muted, #5c5c5c);
  }
  
  button {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    min-height: 56px;
    padding: 8px 20px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--border, #dcdcdc);
    align-items: center;
  }
  
  button:hover {
    background: var(--hover, #ececec);
  }
  
  button[aria-current="true"] {
    background: var(--sel, #e0e0e0);
    box-shadow: inset 3px 0 0 var(--ink, #111);
  }
  
  button.muted .title {
    color: var(--muted, #5c5c5c);
  }
  
  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink, #111);
  }
  
  .suffix {
    font-size: 14px;
    color: var(--muted, #5c5c5c);
  }
  
  .pane-detail {
    flex: 999 1 560px;
    min-width: 0;
    padding: 32px 40px 64px;
  }
  
  /* Desktop: sticky list pane */
  @media (min-width: 900px) {
    .pane-list {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
    }
  }
  
  /* Tablet: stack, no sticky */
  @media (max-width: 900px) {
    .pane-list {
      background: var(--page, #ffffff);
      flex-basis: 100%;
      border-right: none;
      position: static;
      height: auto;
    }
    
    .pane-detail {
      flex-basis: 100%;
    }
  }
  
  /* Phone: one or the other, not both (CSS media + data-view attr) */
  @media (max-width: 480px) {
    .pane-list {
      background: var(--page, #ffffff);
    }
  }
</style>
```

## State of the Art

| Pattern | Old Approach | Current Approach | When Changed | Impact |
|---------|--------------|------------------|--------------|--------|
| Section navigation | Scroll-spy + anchor nav (`<a href="#section">`) | Selection state + list buttons | Phase 8 | Selection is instant, no scroll animation; chart state resets cleanly; keyboard nav decoupled from page scroll. |
| Keyboard navigation | Page-wide arrow handlers (charts had their own, conflicts) | Scoped to nav element only | Phase 8 | Chart arrow keys work independently; no interference between list nav and chart focus. |
| Section mounting | All sections always in DOM, visibility controlled by CSS/JS | Only selected section mounted | Phase 8 | Chart state resets on switch; windowed tables work correctly; smaller DOM tree. |
| Focus management | `scroll-behavior: smooth` on page; no explicit focus calls | Instant scroll + `await tick()` before `focus()` | Phase 8 | Focus lands reliably; tooltips don't flicker; reduced motion respected. |

**Deprecated/Outdated:**

- `scroll-spy.ts` — **retired entirely**. Decision logic was subtle and powerful for scroll tracking, but selection state is simpler and doesn't need it.
- Anchor nav (`#section` hash links) — **retired**. Component state instead; no deep linking (deferred to Phase 9+).
- `--nav-offset` CSS variable for scroll corrections — **still used**, but changed meaning. Was "sticky nav height"; now "fixed offset value" (72px hardcoded). Charts must not measure the new list pane's height as a correction value.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Browser's IntersectionObserver percentage-margin bottom resolves against viewport HEIGHT in Chromium, Firefox and Safari (Phase 3 RESEARCH assumption). | Common Pitfalls | If Firefox/Safari resolve against WIDTH, the scroll-spy band was positioned wrong before Phase 8 and will be wrong on phone now. No evidence Phase 3 broke on those browsers, so carry forward. |
| A2 | Windowed table (vehicles, login IP) measures container once at mount and caches the width. `display: none` does not trigger a remeasure. | Common Pitfalls | If table remeasures on visibility change, `display: none` workaround would work instead of mount-only-selected. Must verify by reading table code or running against a hidden container. |
| A3 | `QueryClient` holds results in a per-channel cache that persists when a section unmounts. Remounting the same section re-uses cached results without a new query. | Pattern 1 | If cache is cleared on unmount, mount-only-selected would trigger a refetch on every section switch, which would be slow and not cheap. Planner must verify this in the execute phase. |
| A4 | `location.hash` is stable and preserved during page operations (import, replace, clear). No event listener on `hashchange` interferes with component state. | Pitfall 5 | If hash changes are being observed somewhere (Phase 3 code?), a refactor could break behavior. Grep for `location.hash`, `hashchange`, `#` in link href to verify. |
| A5 | The new 08-UI-SPEC copy (Overview card link "Open [Section] →", status chips, provenance lines) can be added to `ui-copy.ts` without modifying frozen existing strings (IMPORT-*, CLEAR-*, CONFIRM-*, CITY-*). | Validation Architecture | If those strings are marked frozen and cannot be changed, a build gate will fail. Must verify `ui-copy.ts` has no `FROZEN` block that includes the strings we need to add. |
| A6 | The keyboard hint "Move with j and k" can be shown via CSS `:focus-within` on the nav without JavaScript. | Code Examples | If `:focus-within` does not work on `<nav>` or if browsers don't support it, the hint must be added via JS and kept in sync with focus state. Can be tested on Chrome first (Chrome-first project). |

## Open Questions (RESOLVED)

1. **Phone back gesture (browser back button vs list back button)**
   - What we know: D-05 defines Escape to move focus back to list, but doesn't address the browser's physical/gesture back button on Android/iOS.
   - What's unclear: Should the browser back button also switch from detail to list, or should it exit the app entirely (current browser behavior)?
   - RESOLVED: Treat as a known limitation for Phase 8. If needed in Phase 9, add a History API shim to push a dummy entry when entering detail, so back actually returns to list screen without exiting. For now, back exits the app.

2. **Tab key behavior in list pane**
   - What we know: j/k and arrows move selection; Enter moves focus to detail. Arrow keys don't tab through buttons.
   - What's unclear: Should Tab still move focus through all list buttons (browser default), or should it skip to the next focusable element (dropzone, buttons)?
   - RESOLVED: Preserve browser default Tab behavior. Arrow keys are for fast navigation; Tab is for access compliance. Do not trap Tab.

3. **Live region count assertion in tests**
   - What we know: STATE says "5 regions after import, 1 before". Each chart has a tooltip region. Only the selected section's chart exists now.
   - What's unclear: Is the assertion in a specific test file? Is it checking a fixed count or a boolean existence?
   - RESOLVED (handled in the plans): update test to check for 1 region (the shell's `chart-status`), not 5. Find the assertion and fix it during planning.

4. **Selection persistence across page reload**
   - What we know: D-03 says selection is "lost on reload, no hash mirror". Selection is a rune in the shell, not stored in IndexedDB or localStorage.
   - What's unclear: Is this acceptable UX? Should selection persist via localStorage or be a query param?
   - RESOLVED: D-03 is locked. Selection will be lost on reload (same as scrollY before Phase 8). If users want persistence, this is a Phase 9+ request.

## Environment Availability

Not applicable — Phase 8 has no external tool dependencies beyond what Phases 1–7 already require.

## Validation Architecture

[Validation Architecture section required by config.json `nyquist_validation: true`]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright ^1.63 (e2e) + Vitest ^5.0 (unit) |
| Config file | `playwright.config.ts` (e2e), `vitest.config.ts` (unit) |
| Quick run command | `pnpm exec playwright test shell/master-detail-nav.spec.ts` |
| Full suite command | `pnpm run test:unit && pnpm exec playwright test` |

### Phase Requirements → Test Map

Phase 8 has no formally assigned requirement IDs (TBD in roadmap). Tests cover:

| Behavior | Test Type | Automated Command | Existing? |
|----------|-----------|-------------------|-----------|
| Selection changes with j/k/arrows in list pane | e2e (browser) | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "keyboard"` | ✅ NEW in 08 |
| Enter moves focus to detail pane | e2e | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "enter"` | ✅ NEW in 08 |
| Escape returns focus to list pane | e2e | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "escape"` | ✅ NEW in 08 |
| Overview is default on first load | e2e | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "default"` | ✅ NEW in 08 |
| Selection falls back to Overview after replace | e2e | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "fallback"` | ✅ NEW in 08 |
| Phone: list screen, no detail visible | e2e (mobile) | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "phone.*list"` | ✅ NEW in 08 |
| Phone: detail screen shown after selecting section | e2e (mobile) | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "phone.*detail"` | ✅ NEW in 08 |
| Back button (phone) returns to list screen | e2e (mobile) | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "back"` | ✅ NEW in 08 |
| resolveSelection(selected, result) returns fallback when section absent | unit | `pnpm exec vitest run shell/selection-state.test.ts -t "fallback"` | ✅ NEW in 08 |
| nextAvailableSection / prevAvailableSection wrap around list | unit | `pnpm exec vitest run shell/selection-state.test.ts -t "wrap"` | ✅ NEW in 08 |
| Only selected section's DOM renders | e2e | `pnpm exec playwright test shell/master-detail-nav.spec.ts -k "mount"` | ✅ NEW in 08 |
| Unselected sections are not in DOM (via `document.querySelector('[data-testid="section-vehicles"]')`) | unit | Manual spot-check or e2e query | ⚠️ Wave 0 gap |

### Sampling Rate

- **Per task commit:** `pnpm exec playwright test shell/master-detail-nav.spec.ts && pnpm exec vitest run shell/selection-state.test.ts` (~30 sec)
- **Per wave merge:** `pnpm run test:unit && pnpm exec playwright test` (~30 min with 1 Playwright worker)
- **Phase gate:** Full suite green + zero new test budget ceiling violations before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/e2e/shell/master-detail-nav.spec.ts` — new file covering keyboard nav, selection, phone transitions (estimated ~8 tests)
- [ ] `tests/unit/shell/selection-state.test.ts` — new file covering resolution, next/prev helpers (estimated ~5 tests)
- [ ] Update `tests/e2e/_support/helpers.ts` — add `openSection(page, id)` helper (estimated ~3 lines of code)
- [ ] Delete or retire `tests/e2e/shell/scroll-nav.spec.ts` — 17 existing tests, to be replaced by smaller master-detail nav spec (net: -9 tests if replacement has 8)
- [ ] Update all affected spec files that currently use scroll position to use `openSection()` helper instead (estimated ~10 files, ~30 locator changes total)
- [ ] Update test assertions for live-region count: was "5", now "1" (estimated ~3 assertions)
- [ ] Update CI budget constants in `tests/unit/guards/ci-budget.test.ts` to reflect new test count (after scroll-nav deletion + new specs = net change, TBD)
- [ ] Verify contrast pairs for muted rows at selected/hover states (add #e0e0e0 and #ececec backgrounds with muted text to `tests/unit/charts/contrast.test.ts`)

**Phase 8 Validation Gate:** Must pass:
1. `pnpm run lint` (ESLint, Prettier)
2. `pnpm run check` (svelte-check TypeScript gate)
3. `pnpm run test:unit` (Vitest suite)
4. `pnpm exec playwright test` (full e2e, 1 worker, no retries)
5. `pnpm exec playwright test --list | tail -1` reports test count ≤ ceiling
6. CI budget guard: `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` passes (1.3x floor check)

### Current CI Budget (MEASURED 2026-10-07)

[VERIFIED: playwright.config.ts:180, .github/workflows/ci.yml:94, ci-budget.test.ts:73–89, pnpm test listing]

| Metric | Current | Ceiling | Headroom |
|--------|---------|---------|----------|
| Test count (L) | 257 | ∞ | — |
| Est. duration (E) | — | 1340 s | — |
| Global timeout (G) | 1740 s (29 min) | 1740 s | 0 s (at ceiling) |
| Wrapper timeout (W) | 1860 s (31 min) | 1860 s | 0 s (at ceiling) |
| Job timeout (J) | 2340 s (39 min) | 2340 s | 0 s (at ceiling) |
| Headroom to next ceiling | — | 242 listed tests max (one more test -> 1248 s est, floor 1622.4 s > 1620 s G) | — |

**Impact:** Phase 8 must **reduce or hold** the test count. Replacing 17 scroll-nav tests with ~8 master-detail nav tests nets **-9 tests** (257 - 9 = 248). Estimated duration: 330 + 5·(248 - 101) + 223 = 330 + 735 + 223 = 1288 s, floor 1673.6 s against 1740 s G → passes with 66 s headroom. Re-raises the ceiling to 243 tests (one more test would project 1293 s est, floor 1680.9 s > 1740 s G).

**Planner must reconcile:** If phase 8 adds more than 9 new e2e tests (e.g., 12 new + 17 deleted = -5 net), the test count rises (257 - 5 = 252). Estimated duration 330 + 5·(252 - 101) + 223 = 1305 s, floor 1696.5 s, still passes. At 10 net new (267 tests), estimated 1320 s, floor 1716 s, passes. At 11 net new (268 tests), floor 1721.4 s still passes. **At 18 net new (275 tests), estimated 1365 s, floor 1774.5 s > 1740 s G, fails.**

**Decision:** Aim for net -9 (scroll-nav 17 tests, master-detail nav 8 tests). If more tests are needed, raise all three limits together per the ci-budget.test.ts rule (G + 2, W + 8, J + 8).

## Security Domain

[Required by config.json `security_enforcement: true`]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control | Phase 8 Impact |
|---------------|---------|------------------|-----------------|
| V2 Authentication | no | Not this phase | Selection state is client-side only; no auth changes. |
| V3 Session Management | no | Not this phase | No session token handling. |
| V4 Access Control | no | Not this phase | Single-user app; no access control. |
| V5 Input Validation | yes | CSV parsing in worker (unchanged) | No new user input except section selection (enum, validated by `navEntries`). |
| V6 Cryptography | no | Not this phase | No new encryption. |
| V7 Error Handling | yes | Existing error messages in shell | DOM restructure must not leak sensitive data in error UI. |
| V8 Data Protection | yes | Offline storage (Dexie IndexedDB) | Unmounting sections does not change data retention or cleanup. |
| V9 Communications | yes | Zero-network guarantee (CSP, ESLint ban) | Layout change does not add network requests. Verify CSP still holds. |
| V10 Malicious File Upload | yes | Zip validation in worker (unchanged) | No new upload surface. |
| V13 API & Web Service | yes | CSP `connect-src 'self'` (Phase 6) | No API changes. CSP still blocks network (except sanctioned city-level file). |

### Known Threat Patterns for {Stack}

| Pattern | STRIDE | Phase 8 Mitigation |
|---------|--------|---------------------|
| Selection state mutation via devtools console | Tampering | Selection state is in memory; mutation is visible but not persistent. No security risk (user's own machine). |
| DOMContentLoaded or focus event listeners stealing focus | Spoofing | Scope keyboard handler to `<nav>` only; verify ConfirmPanel and Escape handlers don't interfere. Test with interactive assertions. |
| Chart state leaking between sections via shared cache | Repudiation | Mount-only-selected ensures no chart DOM from unselected section. Data cache is per-channel QueryClient; chart state resets per section. Verify by grepping `#` private state in chart components. |
| Tooltip pinned to wrong cell after section switch | Tampering | Only mounted section's chart exists; tooltip is unmounted too. New phase must verify pinned cell resets on section change (Playwright assertion). |
| IndexedDB export leaking sensitive data via DevTools inspector | Information Disclosure | Phase 8 does not change IndexedDB schema or retention. User controls export via "clear my cached data" button (unchanged). |
| CSP bypass via new `<script>` or `<link>` tags | Injection | Layout restructure does not add dynamic script loading. Verify no new template strings or DOM.innerHTML. ESLint network ban still applies. |

### Privacy Requirement Check

**Core Value:** "Your data never leaves your machine. Zero network requests after page load, enforced by CI and CSP."

Phase 8 does not add any network requests. All data stays in IndexedDB (client-side only). Selection state is in-memory (client-side only). No changes to worker, Dexie, or fetch paths.

**Automated CI check:** Existing `tests/e2e/guards/zero-network.spec.ts` asserts zero network requests post-load. Phase 8 must not break this. Planner must run this spec against the built app to verify.

## Sources

### Primary (HIGH confidence)

- `dashboard-status.ts` (lines 40–51, 71–78) — SECTIONS and NAV_ORDER definitions, source of section IDs and ordering [VERIFIED: Read this session]
- `playwright.config.ts` (line 180) — globalTimeout value, current ceiling [VERIFIED: Read this session]
- `.github/workflows/ci.yml` (line 94) — timeout-minutes value [VERIFIED: Grep this session]
- `ci-budget.test.ts` (lines 73–100) — CI budget formula, limits, and latest measured test count [VERIFIED: Read this session]
- `pnpm exec playwright test --list` output (end of output) — actual test count 257 [VERIFIED: Run this session]
- `08-UI-SPEC.md` (lines 192–197, 378–397) — new test IDs and CSS variable declarations [VERIFIED: Read this session]
- `08-CONTEXT.md` (lines 15–40) — D-01 through D-08 decisions [VERIFIED: Read this session]

### Secondary (MEDIUM confidence)

- `selection-state.ts` (pattern) — derived from existing `dashboard-status.ts` pattern of pure derivation functions [ASSUMED pattern, not yet implemented]
- Svelte 5 runes documentation — `$state`, `$derived`, `$effect` lifecycle [ASSUMED current best practice]
- AGENTS.md (sections "Constraints", "Technology Stack") — project standards for runes, no new deps, single 480px block [VERIFIED: Read this session]
- `SKILL.md` (sketch-findings) — design direction and chosen palette [VERIFIED: Read this session]

### Tertiary (LOW confidence)

- Phase 3 RESEARCH (assumption A1) — IntersectionObserver margin percentage resolves against HEIGHT [ASSUMED: No new evidence this session]
- Phase 6 STATE record — windowed table measurement pattern [ASSUMED: Read cache behavior not verified this session]

## Metadata

**Confidence breakdown:**

- **Standard Stack:** HIGH — No new packages; existing versions confirmed via npm view and lock file.
- **Architecture:** HIGH — Phase structure and patterns derived from existing `scroll-spy.ts`, `dashboard-status.ts`, and Svelte 5 rune patterns.
- **CI Budget:** HIGH — Measured current values via `playwright.config.ts`, `ci.yml`, and `pnpm test --list`.
- **Affected Test Files:** HIGH — Grepped codebase for all patterns; 17 files identified.
- **Pitfalls:** MEDIUM — Derived from Phase 1–7 patterns and architecture; no new evidence this session for windowed table remeasure or Escape handler conflicts (assumptions A2, A5).
- **Keyboard Patterns:** MEDIUM — Svelte 5 runes are current best practice; `:focus-within` CSS pattern is widely supported but not verified on this project's browser target (Chrome-first).

**Research date:** 2026-10-07
**Valid until:** 2026-10-21 (2 weeks, accounting for stable scope)
**Refresh trigger:** Any change to `playwright.config.ts` timeouts, `.github/workflows/ci.yml` timeouts, or discovery of new affected test files.

---

*Phase: 08-master-detail-ui-redesign*
*Researched: 2026-10-07*
