---
phase: 08-master-detail-ui-redesign
reviewed: 2026-10-08T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - src/App.svelte
  - src/app.css
  - src/lib/charts/AboutDisclosure.svelte
  - src/lib/charts/ChartTooltip.svelte
  - src/lib/core/focus-clear.ts
  - src/lib/features/finance/CurrencyBlock.svelte
  - src/lib/features/finance/PremiumBlock.svelte
  - src/lib/features/logins/LoginMapSection.svelte
  - src/lib/features/logins/LoginSummary.svelte
  - src/lib/features/playtime/CalendarHeatmap.svelte
  - src/lib/features/playtime/PlaytimeCharts.svelte
  - src/lib/features/playtime/PlaytimeSummary.svelte
  - src/lib/shell/ConfirmPanel.svelte
  - src/lib/shell/Dashboard.svelte
  - src/lib/shell/DashboardSection.svelte
  - src/lib/shell/DetailPane.svelte
  - src/lib/shell/Dropzone.svelte
  - src/lib/shell/ExcludedNotice.svelte
  - src/lib/shell/IdentityHeader.svelte
  - src/lib/shell/ImportBar.svelte
  - src/lib/shell/ImportSummary.svelte
  - src/lib/shell/ListPane.svelte
  - src/lib/shell/Overview.svelte
  - src/lib/shell/UnsupportedBlock.svelte
  - src/lib/shell/overview-model.ts
  - src/lib/shell/selection-state.ts
  - src/lib/ui-copy.ts
  - tests/e2e/_support/helpers.ts
  - tests/unit/charts/about-disclosure.test.ts
  - tests/unit/charts/contrast.test.ts
  - tests/unit/core/focus-clear.test.ts
  - tests/unit/guards/ci-budget.test.ts
  - tests/unit/guards/phase7-layout-guards.test.ts
  - tests/unit/guards/phase8-shell-guards.test.ts
  - tests/unit/shell/overview-model.test.ts
  - tests/unit/shell/selection-state.test.ts
  - tests/unit/shell/ui-copy.test.ts
findings:
  critical: 1
  warning: 5
  info: 8
  total: 14
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-08
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

The master-detail shell is well structured. The pane model is pure and tested, selection and phone-view reset are derived rather than written from effects, and the `matchMedia` listener is removed on teardown. There is no router, storage, hash or raw-HTML use in the shell. Untrusted strings (nickname, region, account root, unsupported folder names) are all interpolated as text.

Nothing in the reviewed files issues a network request. The only outbound reference is the user-initiated DB-IP attribution link in `LoginMapSection.svelte:106-111`, which carries `rel="noreferrer noopener"` and is not a request until clicked. I found no zero-network regression.

The defects are concentrated in keyboard and focus handling and in the lifecycle of the import region:

- The list's j/k/arrow stepping is computed from the wrong reference row.
- The import region is now torn down and rebuilt whenever a dataset appears or disappears, which contradicts its own documented invariant.
- Several chart key handlers swallow browser shortcuts.

The remaining items are quality and guard-coverage gaps. No structural (fallow) findings were supplied for this review.

## Critical Issues

### CR-01: List keyboard navigation steps from the selected pane, not the focused row

**File:** `src/lib/shell/ListPane.svelte:82-106`
**Issue:** `onNavKeyDown` resolves the focused row into `current` (line 84) but computes the destination with `stepSelection(selected, direction)` (line 101). The doc comment promises "focus follows [the selection] so the next key always starts from the focused row". That holds only while focus and selection coincide. Two reproducible cases show it does not:

1. **First visit, nothing loaded.**
   - `resolveSelection` pins `selected` to `overview` while `result === null`, but `onselect` still moves focus.
   - Pressing `j` on Overview focuses Playtime.
   - Pressing `j` again recomputes `stepSelection('overview', 1)`, which is Playtime again.
   - A keyboard user is stuck on row 2 and can never reach the other rows with j or ArrowDown. Only Tab works.
2. **Loaded dataset, focus not on the selected row.**
   - Rows are plain buttons and all are in the tab order (D-06), so Tab can put focus on row 6 while Overview is selected.
   - Pressing `j` selects and focuses row 2, moving focus backwards.

Because the arrows are `preventDefault`ed, the user also cannot fall back to scrolling.

**Fix:**
```ts
const next = stepSelection(current, direction); // current = the focused row's pane
if (next === current) return;
onselect(next, 'keyboard');
await tick();
navEl?.querySelector<HTMLElement>(`[data-pane-id="${next}"]`)?.focus();
```
Add a unit or e2e case that presses j twice with `result === null` and asserts focus reaches the third row.

## Warnings

### WR-01: ImportBar is destroyed and re-created across the null / non-null transition, breaking its "never re-created" invariant

**File:** `src/lib/shell/Dashboard.svelte:259-262` and `src/lib/shell/ListPane.svelte:166-175` (invariant stated at `src/lib/shell/ImportBar.svelte:64-75, 83-89`)
**Issue:** `importRegion` is rendered in the detail pane while `result === null` and in the list pane otherwise. Svelte tears down one `ImportBar` and mounts a fresh one whenever a dataset appears (first import) or disappears (confirmed clear). `ImportBar`'s own comments say the element is never re-created and that its live region is always in the DOM before it speaks (RESEARCH Pitfall 10: "a region created together with its content is not announced").

The confirmed-clear path breaks this directly. The `justCleared` notice (`Cached data cleared`, `ImportBar.svelte:104-105`) is rendered inside a brand-new `role="status"` slot created in the same flush as its text. Screen readers will generally not announce it. The dropzone's drag-depth state and focus ring are also lost across the swap. App's `bind:this` handoff and the `justCleared` focus effect do still work (Svelte only nulls a binding that still points at the old instance).

**Fix:** Make the live region independent of the moving subtree. Hoist `notice-slot` (the `role="status"` div plus the notice branch) into `App.svelte` or `Dashboard.svelte`, mounted once and unconditionally. Alternatively keep a single `ImportBar` mounted in the list pane always, and let the first-visit detail pane contain a layout-only drop target that forwards to it. Add an e2e assertion that the `notice-slot` element handle survives a clear.

### WR-02: Chart key handlers hijack modified arrow/Home/End keys (browser Back/Forward, text navigation)

**File:** `src/lib/features/playtime/CalendarHeatmap.svelte:295-321`
**Issue:** `onKeyDown` matches on `event.key` alone and calls `event.preventDefault()` for `ArrowLeft/Right/Up/Down`, `Home`, `End`, `PageUp` and `PageDown` without looking at `ctrlKey`, `metaKey` or `altKey`.

- Alt+Left / Alt+Right (history Back/Forward on Windows and Linux) and Cmd+Left / Cmd+Right (macOS) are swallowed while a calendar cell has focus.
- Instead of navigating, they move the roving cell.
- `ListPane.svelte:83` correctly bails out on modified keys, so the new shell code and the older chart code are inconsistent.

I verified this in the calendar. The sibling handlers (`HourGrid.svelte:264`, `MonthlyBarChart.svelte:155`, `WorldMap.svelte:309`) have the same shape and should be checked and fixed together.

**Fix:**
```ts
if (event.ctrlKey || event.metaKey || event.altKey) return; // before the movable check
```
Keep `Shift` ignored too unless range selection is intended.

### WR-03: Production keyboard routing is keyed on `data-testid`

**File:** `src/lib/shell/ListPane.svelte:60-66, 105` (markup at line 150)
**Issue:** `paneOf` resolves the focused row with `closest('[data-testid^="list-row-"]')` and a string compare against `'list-row-' + id`. The `next` row is found with `[data-testid="list-row-${next}"]`. Test ids are a test contract, not application state. Renaming one (`selection-state.ts:53` already notes about 25 specs depend on these) silently disables Enter, j and k in production while unit tests still pass.

**Fix:** Add a dedicated attribute and key the logic on it.
```svelte
<button ... data-testid="list-row-{entry.id}" data-pane-id={entry.id}>
```
```ts
const row = target instanceof Element ? target.closest<HTMLElement>('[data-pane-id]') : null;
const id = row?.dataset.paneId;
return PANE_IDS.find((p) => p === id) ?? null;
```

### WR-04: Transient import notices can sit below the fold of the sticky, internally-scrolling list pane

**File:** `src/app.css:140-145`, `src/lib/shell/ListPane.svelte:166-175, 239-242`, `src/lib/shell/ImportBar.svelte:89-107`
**Issue:** At 900px and wider the list pane is `height: 100vh; overflow: auto`, and the import region (with its `processing`, `duplicate`, `error` and `cleared` notices) is parked at the bottom via `margin-top: auto`.

- Product label, identity header, hint, eight 56px rows and the slim import bar together exceed about 800px.
- On a typical 768px-tall laptop viewport the notice therefore renders inside the list's own scroll area, outside the visible part.
- Only the confirm panel is brought into view (its `onMount` calls `focus()`).
- A sighted user dropping a bad file or a duplicate sees nothing happen unless they scroll the list. The error banner is announced to screen readers, but not shown.

**Fix:** Either place the notice slot above the rows (the product header region), or scroll it into view when it appears. For example, make the `notice-slot` container `position: sticky; bottom: 0` inside the list pane, or call `scrollIntoView({ block: 'nearest' })` from an effect keyed on `notice`.

### WR-05: ConfirmPanel claims `aria-modal` but has no Escape, trap or inert background, and focus is dropped after a confirmed replace

**File:** `src/lib/shell/ConfirmPanel.svelte:45` (focus handling in `src/App.svelte:188-212`)
**Issue:**

- `role="alertdialog" aria-modal="true"` tells assistive tech the rest of the page is inert, but nothing makes it so.
- Tab leaves the panel into the list rows directly above it (the panel now lives at the bottom of the list pane).
- Escape does nothing in the panel. `DetailPane.svelte:44` explicitly lists `[role="alertdialog"]` as owning Escape, but the panel sits in the list pane, outside `DetailPane`, and implements no Escape handler.
- `App.svelte` restores focus only on cancel (`onCancelConfirm`) and after a confirmed clear (the `justCleared` effect). After a confirmed replace the panel unmounts and focus falls to `<body>`.

**Fix:** Add `onkeydown` Escape (calls `oncancel`) on the panel. Either remove `aria-modal` or set `inert` on the other regions while `confirm-pending`. After `confirmPending()` on a replace, focus the dropzone or the new Overview heading.

## Info

### IN-01: Dead smooth-scroll suspension and stale comments

**File:** `src/lib/features/playtime/CalendarHeatmap.svelte:341-359` (same pattern in `HourGrid.svelte:298-311`, `MonthlyBarChart.svelte:177-182`), `src/lib/charts/ChartTooltip.svelte:233-248`
**Issue:** The charts toggle `documentElement.style.scrollBehavior` around `focus()`, citing `scroll-behavior: smooth (D-29)`. `app.css` declares no smooth scrolling any more (`focus-clear.ts` says so too), so the try/finally is dead code that writes inline style on every key press. `ChartTooltip.navOffset()` documents and falls back to `72` (the retired nav's height), while `--nav-offset` is now `16px`. Several comments still describe "the sticky nav" (`ui-copy.ts:224-229`, the `focus-clear.test.ts` fixtures).
**Fix:** Delete the scrollBehavior save/restore, change the `navOffset()` fallback to `16`, and refresh the comments.

### IN-02: New neutral palette is not applied in the feature components touched by this phase

**File:** `src/lib/features/finance/PremiumBlock.svelte`, `CurrencyBlock.svelte`, `src/lib/features/logins/LoginMapSection.svelte`, `src/lib/features/playtime/PlaytimeCharts.svelte`, `CalendarHeatmap.svelte`, `src/lib/charts/ChartTooltip.svelte`, `src/lib/shell/ImportSummary.svelte:80`, `ConfirmPanel.svelte`
**Issue:** `app.css:20-21` says a component must read `var(--ink)` and friends rather than restate a hex. These files still hard-code `#08060d`, `#3c4043`, `#5f6368`, `#dadce0` and `#1a73e8`. The result is two slightly different greys and inks on one screen (for example `--muted` `#5c5c5c` beside `#5f6368`). `phase8-shell-guards.test.ts:99-105` scans only `src/lib/shell`, so the drift is unguarded.
**Fix:** Migrate to tokens, then widen the guard to `src/lib/**`.

### IN-03: Guard tests have narrower scope than their names claim

**File:** `tests/unit/guards/phase8-shell-guards.test.ts:145-163, 165-189`
**Issue:**
- (a) "exactly one phone block" counts `@media (max-width: 480px)` in `app.css` only. Eight scoped stylesheets repeat the literal 480 (`DetailPane`, `Overview`, `ListPane`, `DashboardSection`, `IdentityHeader` x2, `PlaytimeSummary`, `LoginSummary`, `DurationList`) and would not fail if `PHONE_MAX_WIDTH_PX` changed.
- (b) The no-`{@html` / no-`innerHTML` check lists five files, omitting `IdentityHeader`, `UnsupportedBlock` and `DashboardSection`, which are the ones rendering untrusted text. `shellSources()` already exists and would cover all of them.
- (c) The query pair `(max-width: 899px)` / `(min-width: 900px)` leaves a gap for fractional viewport widths between 899 and 900 (zoomed or hi-dpi). The JS `SIDE_BY_SIDE_MEDIA_QUERY` and the CSS disagree there.

**Fix:** Run (a) and (b) over every file under `src/lib/shell` and the feature directories. For (c), use range syntax such as `(width < 900px)` on both sides.

### IN-04: Dead and duplicated copy exports

**File:** `src/lib/ui-copy.ts:215-249, 2979-2988`
**Issue:** `NAV_STATUS_SUFFIX` is no longer used by production code (only by tests). The visually-hidden-suffix design it describes no longer exists in `ListPane`. Four of the six `SECTION_TITLES` values are dead, and `SECTION_TITLES['not-yet-supported']` duplicates `PANE_TITLES['not-yet-supported']` (the unsupported pane's heading comes from one table and its list row and region label from the other).
**Fix:** Remove `NAV_STATUS_SUFFIX` and the unused titles. Have `UnsupportedBlock` read `PANE_TITLES`.

### IN-05: Orphaned JSDoc in the e2e helpers

**File:** `tests/e2e/_support/helpers.ts:542-553, 628`
**Issue:** The block "Delay every `playtime-query` message the worker is sent..." sits above the doc for `failPlaytimeQueryFor`, so that function carries two stacked docblocks and `delayPlaytimeQueries` (line 628) has none.
**Fix:** Move the first docblock down to `delayPlaytimeQueries`.

### IN-06: Decorative glyphs are part of accessible names

**File:** `src/lib/shell/DetailPane.svelte:87-89`, `src/lib/shell/Overview.svelte:69`, `src/lib/ui-copy.ts:3042-3047`
**Issue:** The back button reads `‹ Sections` and the card links read `Open Playtime →`. Screen readers announce the glyphs ("single left-pointing angle quotation mark", "rightwards arrow"). The row chevron in `ListPane` is correctly `aria-hidden`; these two are not.
**Fix:** Split the glyph into an `aria-hidden` span in the markup (keep the strings in `ui-copy`).

### IN-07: `formatImportedOn` is fed an empty string when `importedAt` is missing

**File:** `src/App.svelte:177-180`, `src/lib/ui-copy.ts:123-129`
**Issue:** `result.importedAt ?? ''` makes `new Date('')` produce `Imported on Invalid Date` for any `ClassifyResult` that lacks the optional field. `selection-state.ts:205-210` explicitly allows that case.
**Fix:** Return `null` from the derived value when `importedAt` is absent, and guard `formatImportedOn` with `Number.isNaN(date.getTime())`.

### IN-08: Landmark, heading and description structure of the detail screen

**File:** `src/lib/shell/DetailPane.svelte:68-78`, `src/lib/shell/DashboardSection.svelte:81-87`, `src/lib/features/logins/LoginSummary.svelte:114-134`, `src/lib/features/playtime/CalendarHeatmap.svelte:461-463, 511`
**Issue:**
- (a) The detail region is `role="region"` labelled with the pane title, and the section inside it is `aria-labelledby` the same text, so assistive tech lists two same-named regions.
- (b) On the phone detail screen the list pane (and its only `<h1>`) is `display: none`, so the page has no `h1`.
- (c) `<p class="caption">` is a child of a `<div class="tile">` inside a `<dl>`. A `div` in a `dl` may contain only `dt`/`dd`, so this can trip an axe `definition-list` rule.
- (d) The calendar's `aria-describedby` target now lives inside a collapsed `<details>`. The comment asserts the id "still resolves"; that holds for the DOM, but whether Chromium exposes closed-`details` content as the accessible description is not asserted by any test.

**Fix:** Drop the redundant `aria-labelledby` or the pane label. Add a visually hidden `h1` to the phone bar. Move the share line into the `dd`. Add an e2e check of the cell's accessible description with the disclosure closed.

---

_Reviewed: 2026-10-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
