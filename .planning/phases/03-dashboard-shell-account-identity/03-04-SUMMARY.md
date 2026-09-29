---
phase: 03-dashboard-shell-account-identity
plan: 04
status: complete
wave: 2
requirements: [IDENTITY-01, DATA-03, DATA-04]
---

# Plan 03-04 — the identity header, the section shell, and the unsupported block

## What was built

Five components and one App restructure, replacing the diagnostic results
view with the real dashboard content. Everything is TDD: each task's tests
were written and committed RED first, then made green.

**`IdentityHeader.svelte`** renders the worker's three-field identity in
three variants. `skeleton` (no result) is a greyed card reading "No export
loaded"; it carries `identity-title`, never the nickname test id, so a test
asking "is a nickname showing?" cannot be satisfied by a placeholder.
`fallback` (`result.identity` null or absent, D-16) is the account root as
the title and nothing else — no caption, no value list, and no `Account ID:`
line, which would repeat the title. `loaded` is the nickname as a
Display-role title, the "As of export" caption, a `dl` of raw region and
date-only created value, and the account ID as a secondary line.

**`DashboardSection.svelte`** (D-07) is the one section shell. Its root is
ONE element that is never swapped — the 03-05 scroll spy and the in-page
anchors will hold references to these nodes, and a per-status root would
leave them observing detached elements. Only the inner content branches
across `not-loaded` / `no-export` / `empty` / `pending` / `ready`. Every
greyed state states its reason in visible text, and adds a dashed border as
a shape cue on top of the surface tint, so "nothing here" is never carried
by colour alone (D-10, DATA-04).

**`ImportSummary.svelte`** is the single "N files, M rows" sentence in three
roles (a section's body, a `ready` section's muted caption, a banner's counts
line) plus the skip tag, which renders only above zero (D-04, D-09).

**`Dashboard.svelte`** composes the header and the cards, reading every
status and count from `dashboard-status.ts` — the same pure module the nav
reads in 03-05, so a nav link and its card cannot disagree (D-08).

**`UnsupportedBlock.svelte`** (D-22, DATA-03) is the fifth card, rendered
through the same shell so it owns the fifth anchor id and the same status
vocabulary. Its whole reason to exist is the honesty property: every
non-supported folder gets ONE banner, from one list, one template, one
sentence, one style. There is no branch on the entry's status and no
`data-status` selector anywhere in its stylesheet — the attribute is emitted
for tests only, and the computed-style comparison in the e2e spec is what
proves it never reached the CSS.

**`App.svelte`** was flattened from a state chain into one fixed document
order (confirm panel, notice, dropzone, bottom controls, dashboard) in every
state but the cache check, which renders alone (D-28). The persistent bar
took over the import timestamp and the Start over control from the retired
results view, and both destructive triggers now share one button rule. The
dashboard is driven by `ingestClient.result` — the last known dataset, from
03-03 — so a failed replace or a duplicate drop leaves the user's data on
screen instead of blanking the page (D-27, RESEARCH Pitfall 3).

**Retired** (D-23): `ResultsView.svelte` and `CategoryBadge.svelte`,
together with the `results` wrapper, the `account-heading`, the
`summary-line` and the badge list.

**SC1 is now a test, not a claim.** `tests/e2e/identity-privacy.spec.ts`
asserts, on the fresh-import path, the reload path and three hostile-header
variants, that neither the email domain nor the birth date appears in the
rendered text, in `document.documentElement.outerHTML` (which covers
`<title>`, every attribute and every hidden node), in the accessibility
snapshot, in the console of either the page or the worker, or in a raw
`indexedDB` dump of the `rows` and `meta` stores. Every negative assertion
is paired with two controls — the nickname appears exactly once in the
document, and the dump still contains the `"IP"` key — so a spec reading an
empty or wrong store could not pass.

## Files changed

| File | Change |
|------|--------|
| `src/lib/components/IdentityHeader.svelte` | new — skeleton, fallback and loaded identity card |
| `src/lib/components/DashboardSection.svelte` | new — the D-07 shell: one stable root, five statuses |
| `src/lib/components/ImportSummary.svelte` | new — the one counts sentence in three roles, plus the skip tag |
| `src/lib/components/Dashboard.svelte` | new — composition root; the extension point Phases 4-6 edit |
| `src/lib/components/UnsupportedBlock.svelte` | new — one identical banner per non-supported folder |
| `src/App.svelte` | flat document order, persistent bar takes the timestamp and Start over, flex-column `main`, dashboard mounted in every non-loading state |
| `src/app.css` | `--nav-offset: 72px`; h1/h2 demoted to the Heading role; `main` padding 24px |
| `src/lib/components/ResultsView.svelte` | deleted (D-23) |
| `src/lib/components/CategoryBadge.svelte` | deleted (D-23) |
| `tests/e2e/identity-privacy.spec.ts` | new — the SC1 leak spec, fresh / reload / three header variants |
| `tests/e2e/dashboard.spec.ts` | new — 19 tests: identity, sections, skeleton, banners, order, markup |
| `tests/e2e/zero-network.spec.ts` | one assertion: the retired level-2 account heading becomes `identity-nickname` |

`package.json` and `pnpm-lock.yaml` untouched (T-03-SC).

## Tests

**Task 1 — identity and the leak spec (5 new e2e tests).** Fresh import and
reload each assert the nickname, region and date-only created value, then run
the full leak surface. Three parametrised variants cover the shapes where a
naive strip fails: lowercase and padded headers with a missing `REGION`
column and a PapaParse overflow canary, a lowercased `user_info` folder, and
case-variant folders with a duplicate `LOGIN` column.

**Task 2 — the shell (12 e2e tests).** identity-loaded; sections-pending
(D-02 order, per-folder counts, the User_Info note override, D-06's no
collapse control, D-11's no game title); retired-markup absence; skeleton;
absent vs empty wording; fallback; empty-user-info; multi-row with and
without a matching ID; rootless; case-sum.

**Task 3 — the block (7 e2e tests).** banners-sample (worker order, shared
suffix, per-folder counts, and a nine-property computed-style comparison
across all four banners, two of which carry `data-status="known-deferred"`
and two `"unknown"`); banners-renamed (a fifth unknown folder, same styles);
none-detected; skip tag and its survival across a reload; case-variant
folders; five-card document order; and an untrusted folder name that must
render as text and create no `<b>` element.

Every expected string is computed from the same fixtures and formatters the
app uses. Section ids are asserted as literals rather than imported, because
they are the anchor contract 03-05 depends on.

### RED → GREEN evidence

| Commit | State |
|--------|-------|
| `e8aaa28` | RED — 6 fail, 1 passes; every failure is `element(s) not found` on `identity-nickname` |
| `3e192d4` | GREEN — 5/5 leak, 2/2 zero-network, 325 unit |
| `4d3016e` | RED — 8 fail, 4 pass; every failure is `element(s) not found` on `dashboard-section-*` |
| `d6cdae8` | GREEN — 12/12 dashboard, 5/5 leak, 2/2 zero-network, 325 unit |
| `4e0c589` | RED — 7 fail, 12 pass; every failure is the missing block |
| `db75e59` | GREEN — 19/19 dashboard, 5/5 leak, 2/2 zero-network, 325 unit |

The four tests that were already green at the Task 2 RED (identity-loaded,
multi-row, multi-row-no-match, rootless) exercise only the header Task 1
had already shipped; they were included in the file from the start rather
than added to drive Task 2. Counted here for honesty, not presented as RED
evidence.

## Verification

| Command | Result |
|---------|--------|
| `pnpm run lint` | exit 0 — prettier clean, eslint clean (the `no-at-html-tags` and `no-inline-styles` rules are errors, so every untrusted value in the new components is interpolated, never assigned) |
| `pnpm run check` | exit 0 — svelte-check 0 errors / 0 warnings on both tsconfigs, `tsc -p tsconfig.node.json` clean |
| `pnpm run test:unit` | 325 passed across 14 files |
| `pnpm exec playwright test tests/e2e/dashboard.spec.ts tests/e2e/identity-privacy.spec.ts tests/e2e/zero-network.spec.ts` | 26 passed, 0 failed |
| `grep -c "<section" src/lib/components/DashboardSection.svelte` | `1` |
| `grep -rEn "transition\|@keyframes\|animation" DashboardSection / ImportSummary / IdentityHeader / UnsupportedBlock` | no match (D-29) |
| `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` | exit 0 |
| `ls ResultsView.svelte CategoryBadge.svelte` | both missing; `pnpm run check` finds no importer |

The full gate was run after every task, not the per-task subset, per the
standing instruction from the phase.

The **full** Playwright suite is `31 passed, 20 failed`. All 20 failures are
in the three legacy specs — `import-failure` (6), `import-flow` (7),
`persistent-dataset` (7) — and every one asserts retired markup: the
`results` wrapper, `account-heading`, `summary-line`, `category-badge`, or a
`getByRole('heading', { level: 2 })` query that resolved to a single heading
when the dashboard now renders six. Plan 03-07 owns that migration
(RESEARCH Q6 lists the affected lines per spec). Nothing in the new work
causes them and nothing here can make them pass without editing specs 03-07
owns.

## Deviations

- **`--nav-offset` was added in this plan**, per the Task 1 action block and
  03-05's own "From 03-04" contract (`03-05-PLAN.md:108`), which reads the
  token as a carry-forward from here. The brief for this session said 03-05
  owns it; 03-05's action block does not add it, so leaving it out would
  leave `scroll-margin-top: var(--nav-offset)` unresolved and the nav with
  nothing to read. The plan and the downstream dependency agree, so the plan
  won. One line in `src/app.css` if the parent disagrees.
- **The three header-shape leak variants were written in Task 1**, not Task 3.
  The plan splits them across the two tasks; the end state is identical and
  splitting them would have meant a RED commit that only removed tests. The
  Task 1 RED run does show all six failing on the missing nickname element.
- **The section-order assertion lives in exactly one test.** The plan asks
  both that Task 2's counts test be updated to expect the block and that Task 3
  add an `(order)` test; two tests asserting one list is one test too many, so
  the assertion was moved into `(order)` and the Task 2 test points at it.
- **The empty-section skip tag renders as the `caption` variant.** The plan
  specifies `showCounts: false` for that case but not a variant; `caption` is
  the muted-metadata role and the only one of the three that fits an element
  showing a tag and no counts. Root test id is `section-caption`.
- **`{#snippet children()}` was dropped** in `UnsupportedBlock.svelte`:
  `svelte/no-useless-children-snippet` (an error in this repo) rejects an
  explicit snippet that only wraps the implicit children. The rendered
  output is identical.
- **The persistent bar's markup changed shape**: it gained the import
  timestamp and the Start over button, and both triggers now share one CSS
  rule. Interim layout per the plan's flagged assumptions — 03-06 replaces
  it with the real import bar.

## Notes for the next plans

- `--nav-offset: 72px` now exists in `src/app.css` (the one place Phase 7
  needs to change to move the anchor budget). 03-05 reads it via
  `parseNavOffset(getComputedStyle(...))`; nothing reads it yet, so the token
  is currently only a `scroll-margin-top` input.
- Section ids on the page are `activity-history`, `player-statistics`,
  `payment-history`, `user-info`, `not-yet-supported`, each on a stable root
  element that is never unmounted across statuses — the property 03-05's
  observer depends on.
- `Dashboard.svelte` is the file Phases 4 to 6 edit, and the only one: each
  passes its `ready` content to the matching `DashboardSection` as a
  `children` snippet, and adds its id to `BUILT_DASHBOARDS` in
  `dashboard-status.ts`. The `children` snippet path is already exercised
  today by the unsupported block.
- `SECTIONS` in `dashboard-status.ts` remains the single declaration of
  section order. `sectionIdsInOrder()` in the e2e spec reads the DOM order
  rather than re-deriving it, so a reordering fails the test instead of
  following the source.
- 03-05's reduced-motion note applies here: none of these components adds a
  motion effect, so scroll-spy tests need no `prefers-reduced-motion` guard
  for the cards themselves (the app's cache-check spinner still spins).
- **Left for 03-07** (not in this plan's file list):
  `.claude/skills/run-data-export-viewer/driver.mjs` and its `SKILL.md` still
  drive the page through `account-heading` and the old start-over flow, so
  that skill is now broken against the current build. RESEARCH Q6 flags it
  as low risk but explicit.

## Carried into verification

- The two `must_haves` marked `backstop` are verified by type-check and
  review only, as the plan states: the `ready` counts caption is
  unreachable until Phase 4 supplies a dashboard (the `children` path itself
  IS exercised by the unsupported block), and the untrusted-string wrapping
  is asserted as text with `overflow-wrap: anywhere` but not measured at
  375px and 720px — that visual pass is 03-05 and Phase 7.
- The leak spec runs on Chromium only. It asserts on `getComputedStyle`,
  `ariaSnapshot()` and `document.outerHTML`, none of which Safari or Firefox
  has been checked against; `buildRootlessExport` and the case-variant
  folder matching are likewise Chromium-verified only.
- The 20 legacy e2e failures above are the real remaining risk in this
  phase's verification, and they are 03-07's to close.
