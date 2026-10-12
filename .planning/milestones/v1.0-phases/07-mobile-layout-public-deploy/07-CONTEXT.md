# Phase 7: Mobile Layout & Public Deploy - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The finished dashboard works at phone width (~375px) with no horizontal page scroll, touch interaction works for the existing chart readouts and controls, and the app is publicly deployed to GitHub Pages under a project subpath by a manually triggered, CI-gated workflow. The zero-network guarantee is verified against the deployed build (pre-deploy on the artifact, post-deploy on the live URL). Requirements: PLATFORM-01, PLATFORM-03.

</domain>

<decisions>
## Implementation Decisions

### Wide content at 375px
- **D-01:** Vehicle table and login table KEEP their own virtualized scroll box with sticky header + first column (no reflow to cards, no column hiding). Phase work is width/padding tuning, touch scrolling and, at planner discretion, an edge-fade hint that more columns exist. Satisfies SC1 "wide charts scroll inside their own container" without touching virtualization geometry.
- **D-02:** World map only scales (viewBox) at phone width; no min-width scroll, no pinch-zoom. Per-country figures are already in the country table below the map; tap-to-reveal figures comes from D-05.
- **D-03:** One `@media (max-width: 480px)` block in `src/app.css` shrinks the page padding from 24px to ~12-16px. Nav stays the existing horizontally-scrolling anchor strip (hidden scrollbar, `--nav-offset` height contract unchanged unless re-measurement shows drift). Existing `max-width: 720px` column untouched at larger widths.
- **D-04:** Mobile proof = (a) ONE new e2e sweep spec: import a fixture, viewport 375x812, assert `document.scrollWidth <= clientWidth` for every section and state (identity header, heatmaps, vehicle table, finance, login table, map, banners incl. failure/excluded/unsupported, city opt-in, clear-data control); (b) a SECOND Playwright project with `hasTouch`/`isMobile` (Chromium emulation) for the touch specs. No WebKit/Firefox projects (AGENTS.md: Chrome-first). New tests mean the `ci-budget` guard constants, `globalTimeout`, wrapper and job timeout must be raised together (see `tests/unit/guards/ci-budget.test.ts`).

### Touch: tooltips & controls
- **D-05:** Chart readouts (CalendarHeatmap, HourGrid, MonthlyBarChart, WorldMap, all driving the shared `ChartTooltip`) get touch behaviour for `pointerType === 'touch'`: tap opens AND pins the tooltip; tapping another cell moves it; tap outside, scroll, or Esc dismisses. Mouse and keyboard behaviour stay unchanged (no timers, no auto-dismiss).
- **D-06:** SC2's "tabs, tooltips, popovers" is interpreted against what exists: the nav anchor strip is the "tabs"; the shared chart tooltip is the "tooltips"; there are NO popovers and `bits-ui` is unused in `src/`. No dependency is added. SC2's wording is to be amended in ROADMAP.md the way plan 06-06 amended SC4.
- **D-07:** The two native `title=` attributes (VehicleTable name cell `title={row.id}`, LoginTable `cell.title`) are left as hover-only extras. No new touch UI for them.
- **D-08:** Touch-target rule: buttons and links (nav links, sort headers, Clear data, reveal-IP toggle, city opt-in, etc.) get a minimum 44px hit area at phone width / coarse pointer. Chart marks (heatmap cells, map shapes) are exempt; tap-to-pin (D-05) handles their precision. Enforce with an automated bounding-box assertion in the touch project where practical.

### Deploy workflow
- **D-09:** Deploy lives in a NEW `.github/workflows/deploy.yml`, triggered ONLY by `workflow_dispatch` (manual). `ci.yml` keeps lint/typecheck/unit/e2e on the existing self-hosted runner and gains no Pages permissions. This deliberately amends SC3 ("pushing to main ... only if it passes does the workflow deploy"): push to `main` runs CI; deploy is a deliberate manual step that cannot ship an unverified commit. Record the SC3 amendment in ROADMAP.md.
- **D-10:** The deploy workflow's first step refuses to proceed unless the selected SHA has a successful `CI` workflow run (queried via the GitHub API with `gh`/`actions` API; least-privilege `actions: read`). Deploy jobs run on a GitHub-hosted runner (`ubuntu-latest`), not self-hosted, so the public artifact is built on a clean VM. `permissions: pages: write, id-token: write` are scoped to the deploy job only, with the `github-pages` environment; use `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4` (SHA-pinned like ci.yml, matched pair).
- **D-11:** Subpath via absolute base from env: `vite.config.ts` gets `base: process.env.VITE_BASE ?? '/'`; the deploy job sets `VITE_BASE=/wot-gdpr-stats-visualizer/`. Dev, `vite preview` and the existing 234 e2e tests stay at `/`. A relative base (`./`) is explicitly rejected because `cityAssetUrl` in `src/lib/geo/city-fetch.ts` concatenates `origin + BASE_URL`. `index.html`'s `/favicon.svg` and the worker script URL must be verified to resolve under the base.
- **D-12:** The repo may be PRIVATE (free Pages requires public). The phase's first task is to confirm repo visibility and that Pages source = "GitHub Actions"; both are documented manual preconditions (checklist in plan + README), not automated. If the repo goes public, a pre-deploy audit (no real IPs/PII in committed fixtures, README/LICENSE) is the user's call and is not decided here.

### City dataset & live verification
- **D-13:** The real city file is generated INSIDE the deploy job (`pnpm run geo:city -- --download`), cached keyed on the DB-IP month, with the manifest asserted `source: "dbip"` (the fixture manifest differs) and the served file's byte count and sha256 checked against the manifest. If the download fails after the script's existing one-month fallback, the deploy FAILS (no silent deploy without the opt-in). Deploy build has no `GEO_FIXTURE`.
- **D-14:** Two-stage verification of "zero-network on the deployed build": (1) PRE-deploy gate: serve the exact deploy `dist` under the real base path in Playwright (on the GitHub-hosted runner) and run zero-network, worker chunk 200, CSP meta present, and city-file reachability assertions; only then upload the artifact. (2) POST-deploy smoke spec against the live URL: page loads, CSP meta present, worker chunk 200, zero requests after load, city file reachable on click. A post-deploy failure marks the run red and is reported; rollback is re-running deploy on the previous green SHA.
- **D-15:** CSP stays `connect-src 'self'` (Phase 6 hand-off c declined). No origin baked into the policy. The live check only asserts the meta tag is present; enforcement remains the ESLint network ban + Playwright request assertions.
- **D-16:** Phone-class memory (Phase 6 hand-off d): no code gate. The city opt-in copy states the ~12 MB download size so mobile-data users know; the existing error state for a failed/OOM decode is verified; a manual UAT item "try the opt-in on a real phone after the first deploy" is recorded.

### Claude's Discretion
- Exact padding values inside the 12-16px range, nav link density, and whether an edge-fade/scroll hint is added to tables.
- Exact mechanism for the "green CI for this SHA" check and for caching the DB-IP download.
- Whether the touch-target assertion is a unit-level CSS guard, an e2e bounding-box check, or both.
- File names/locations for the new sweep spec, touch project config and live-smoke spec, following the `tests/e2e/<area>/` layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` §"Phase 7: Mobile Layout & Public Deploy" — goal, success criteria SC1-SC4; "Planning Notes" Phase 6 hand-offs (a)-(d)
- `.planning/REQUIREMENTS.md` — PLATFORM-01, PLATFORM-03 (PLATFORM-02 already complete, must stay green)
- `.planning/PROJECT.md` — Core value (zero network), constraints (Deployment, Mobile, Browser target, Dependency minimalism)
- `AGENTS.md` — Tech stack, CSP rationale, "What NOT to use" (no gh-pages package, no SvelteKit, no new runtime deps)

### Deploy / CI
- `.github/workflows/ci.yml` — existing self-hosted verify job, SHA-pinned actions, timeout relationship (globalTimeout < wrapper < job)
- `playwright.config.ts` — webServer, `GEO_FIXTURE` seam (only place), globalTimeout arithmetic
- `tests/unit/guards/ci-budget.test.ts` — must be updated with new test counts; guard enforces timeout ordering
- `tests/unit/guards/geo-seam.test.ts`, `tests/unit/guards/phase6-guards.test.ts` — geo seam and Phase 6 invariants
- `vite.config.ts` — csp-meta plugin, `base` (currently unset), `__GEO_CITY__` define
- `scripts/geo/build-city-dataset.ts`, `scripts/geo/lib/city-manifest.ts` — city generation, manifest, one-month fallback
- `src/lib/geo/city-fetch.ts` — `cityAssetUrl(manifest, baseUrl, href)`, the only exempt network module
- `public/geo-city-data/` — gitignored output (`**/geo-city-data/`, `**/*.citydb.bin`)
- `index.html` — `/favicon.svg`, module script (base handling)

### Mobile layout / touch
- `src/app.css` — page column `max-width: 720px; padding: 24px`, `--nav-offset: 72px`
- `src/lib/shell/DashboardNav.svelte` — sticky scrolling nav strip, hidden scrollbar height contract
- `src/lib/charts/ChartTooltip.svelte`, `src/lib/charts/MonthlyBarChart.svelte`, `src/lib/features/playtime/CalendarHeatmap.svelte`, `src/lib/features/playtime/HourGrid.svelte`, `src/lib/features/logins/WorldMap.svelte` — pointer handlers driving the shared tooltip
- `src/lib/features/vehicles/VehicleTable.svelte`, `src/lib/features/logins/LoginTable.svelte` — virtualized scroll boxes with sticky axes
- `src/lib/features/logins/CityOptIn.svelte` — opt-in control and copy
- `tests/e2e/shell/uat-criteria.spec.ts` (UAT-4), `tests/e2e/shell/scroll-nav.spec.ts`, other `375` specs — existing phone-width coverage to extend, not duplicate
- `tests/e2e/_support/helpers.ts` — shared locators

No external ADRs/specs beyond the above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChartTooltip` (shared by heatmap, hour grid, bar chart, map): single place to add tap-pin/dismiss state for touch.
- `--nav-offset` token and `scroll-spy.ts`: height contract the nav relies on; keep stable when changing nav padding.
- `cityAssetUrl` + `import.meta.env.BASE_URL`: already base-aware, so absolute `VITE_BASE` works without code change in the fetch path.
- Existing 375px specs (UAT-4, scroll-nav, vehicle/finance/login specs) and `tests/e2e/_support/helpers.ts` locators.
- `ci-budget.test.ts` guard: encodes the timeout arithmetic that must be updated with any added tests.

### Established Patterns
- Only one `@media (max-width)` rule exists (`DurationList.svelte`, 480px); breakpoint convention to follow: 480px.
- Scroll containment: wide components use `overflow-x/auto` in their own box (heatmaps, bar chart, nav, tables).
- SHA-pinned GitHub Actions; least-privilege `permissions:` per job; `persist-credentials: false`.
- E2E always runs against built `vite preview` with `GEO_FIXTURE=1`; only one place may set that env.
- Hand-rolled charts and primitives; no `bits-ui` use in `src/` despite being listed in the stack.

### Integration Points
- `vite.config.ts` `base` + `index.html` favicon/script paths.
- New `.github/workflows/deploy.yml` alongside `ci.yml`.
- New second Playwright project (touch) in `playwright.config.ts`, and a base-path preview variant for the pre-deploy gate.
- `ROADMAP.md` amendments (SC2 wording per D-06, SC3 per D-09).

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants deploy "on GitHub but manually triggered, tests and other on self hosted".
- Rollback story = re-run the manual deploy on the previous green SHA.

</specifics>

<deferred>
## Deferred Ideas

- Card/reflow layout for tables on phones — rejected for this phase; revisit only if user feedback shows the scroll boxes are unusable.
- Pinch-zoom/pan on the world map — new capability, own phase.
- Narrowing CSP `connect-src` to a path-restricted host — declined; defence-in-depth only.
- Device-memory guard / hiding the city opt-in on small screens — declined; manual phone check instead.
- WebKit/Firefox Playwright projects — out of scope per Chrome-first constraint.
- Making the repo public (README/PII audit) — user hasn't decided; precondition check only.

</deferred>

---

*Phase: 07-mobile-layout-public-deploy*
*Context gathered: 2026-10-05*
