# Phase 8: Master-detail UI redesign - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the single-scroll dashboard and its anchor nav with a two-pane master-detail layout, without changing what any section computes or shows. Left: list of sections (Overview, Playtime, Login history, Vehicles, Finance, Payments, Account, "Not yet supported" footer row; unavailable sections muted). Right: one section's detail. Overview is the default landing view. Phone: list screen then detail screen with back control. Selection is component state, never a route. Palette "Day 10, ink + teal".

Layout, palette, copy, ARIA and test-id contract are already fixed in `08-UI-SPEC.md` (approved). This context captures the remaining behavioural decisions.

</domain>

<decisions>
## Implementation Decisions

### Section mounting
- **D-01:** Mount only the selected section's detail. Non-selected sections are not in the DOM. Chart state (tooltips, pinned cells, table sort) resets on switch; data queries stay cached per channel in the existing `QueryClient`, so switching is cheap.
- **D-02:** `scroll-spy.ts`, its unit test, and the anchor-scroll behaviour in `DashboardNav.svelte` are retired, not adapted.

### Selection lifecycle
- **D-03:** First import and replace-import both land on Overview. Clear returns to the empty state. Selection is plain component state: lost on reload, no `location.hash` mirror (UI-SPEC).
- **D-04:** If the selected section is absent from the dataset (e.g. after replace), fall back to Overview.

### Keyboard
- **D-05:** `j`/`k` and arrow keys move selection only while focus is inside the list pane. `Enter` moves focus to the detail pane, `Escape` returns it to the list. No page-wide handler, so no conflict with in-chart arrow navigation, inputs, or dialogs.
- **D-06:** ARIA per UI-SPEC: `<nav>` of `<button>` rows with `aria-current="true"`, not a `listbox`.

### E2E migration and budget
- **D-07:** Add a shared `openSection(page, id)` helper in `tests/e2e/_support/helpers.ts`; call it in the ~10 specs that locate sections by scroll/viewport position (uat-criteria, playtime-charts, playtime-ui-review, touch-targets, touch-tooltips, vehicle-stats, finance, login-history, login-table, login-map).
- **D-08:** Replace `tests/e2e/shell/scroll-nav.spec.ts` (17 tests) with a smaller master-detail nav spec (selection, Overview default, j/k, phone list->detail->back). Target a net test-count decrease or hold so the three CI limits (`playwright.config.ts` globalTimeout, `ci.yml`, `ci-budget.test.ts`; currently 239 tests / 1243 s at ceiling) need not rise. If the count does rise, raise all three together.

### Claude's Discretion
- Exact component split (Shell / ListPane / DetailPane / Overview) and file names.
- Overview card summaries' derivation, reusing `dashboard-status.ts`.
- Where focus lands when the selected row changes on phone.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design
- `.planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md` — approved design contract (tokens, layout, copy, test ids, ARIA, build notes)
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md` — design direction; read `sources/design-canvas/README.md` first
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/layout-and-navigation.md`
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/visual-language.md`
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/sources/themes/default.css` — neutral tokens
- `.planning/sketches/021-q2-configurator/` — chosen configuration

### Project
- `.planning/ROADMAP.md` §Phase 8 — goal and constraints
- `AGENTS.md` — privacy, no router, no new deps, 480px single phone block, 44px floor

### Code / tests touched
- `src/App.svelte`, `src/app.css`, `src/lib/shell/` (`Dashboard.svelte`, `DashboardNav.svelte`, `DashboardSection.svelte`, `IdentityHeader.svelte`, `dashboard-status.ts`, `scroll-spy.ts`)
- `tests/e2e/_support/helpers.ts`, `tests/e2e/shell/scroll-nav.spec.ts`, `tests/unit/guards/ci-budget.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
- `tests/unit/charts/contrast.test.ts` — extend with new neutral pairs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dashboard-status.ts` (`navEntries()` + status derivation): drives list rows, status chips, Overview cards.
- `IdentityHeader.svelte`, `Dropzone.svelte`, `ImportBar.svelte`, `ConfirmPanel.svelte`: move into the list pane / empty state.

### Established Patterns
- Per-channel `QueryClient` caching, so unmounted sections refetch cheaply.
- Source-contract unit tests and layout guards (`phase5-layout-guards.test.ts` 14px floor) constrain new CSS.

### Integration Points
- `Dashboard.svelte` becomes the shell holding selection state.
- Existing `data-testid="section-*"` ids are kept; new ids per UI-SPEC.

</code_context>

<specifics>
## Specific Ideas

Follow the hi-fi canvas https://claude.ai/artifact/XM5a7aV2p2XWze9DFi37G3.

</specifics>

<deferred>
## Deferred Ideas

- `location.hash` deep linking of selection
- Chart | Table toggle per section
- Dark mode (needs a dark ramp)

</deferred>

---

*Phase: 08-master-detail-ui-redesign*
*Context gathered: 2026-10-07*
