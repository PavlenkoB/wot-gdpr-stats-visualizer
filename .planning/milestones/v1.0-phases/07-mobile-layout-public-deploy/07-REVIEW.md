---
phase: 07-mobile-layout-public-deploy
reviewed: 2026-10-05T18:15:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/deploy.yml
  - README.md
  - playwright.config.ts
  - scripts/geo/resolve-dbip-month.ts
  - src/App.svelte
  - src/app.css
  - src/lib/charts/ChartTooltip.svelte
  - src/lib/charts/MonthlyBarChart.svelte
  - src/lib/charts/tooltip-pin.ts
  - src/lib/features/logins/WorldMap.svelte
  - src/lib/features/playtime/CalendarHeatmap.svelte
  - src/lib/features/playtime/HourGrid.svelte
  - src/lib/shell/Dashboard.svelte
  - src/lib/shell/DashboardNav.svelte
  - tests/deploy/deployed-build.spec.ts
  - tests/deploy/dist-artifact.spec.ts
  - tests/deploy/playwright.gate.config.ts
  - tests/deploy/playwright.live.config.ts
  - tests/e2e/logins/login-map.spec.ts
  - tests/e2e/shell/dashboard.spec.ts
  - tests/e2e/shell/mobile-sweep.spec.ts
  - tests/e2e/shell/touch-targets.spec.ts
  - tests/e2e/shell/touch-tooltips.spec.ts
  - tests/unit/charts/tooltip-pin.test.ts
  - tests/unit/guards/ci-budget.test.ts
  - tests/unit/guards/deploy-gate.test.ts
  - tests/unit/guards/deploy-workflow.test.ts
  - tests/unit/playtime/playtime-charts.test.ts
  - vite.config.ts
findings:
  critical: 0
  warning: 5
  info: 11
  total: 16
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-05
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 07 is CSS, touch behaviour and a manual Pages deploy workflow. The privacy
guarantee holds: nothing in the touch or tooltip code opens a request or puts an
address in the DOM. The two announcement strings are module constants, the live
region only ever receives those two constants or the empty string, and the map
component still receives only country rows. `deploy.yml` is well scoped: empty
top-level `permissions`, per-job grants, Pages and OIDC on exactly one job,
SHA-pinned actions, `persist-credentials: false`, no `${{ }}` inside any `run:`
body, and the `__GEO_CITY__` ordering (generate, then build) is enforced by an
executable gate rather than a comment. There are no blockers.

The defects found are in what the happy-path tests cannot see:

- one confirmed accessibility regression at phone width (the nav link name, reproduced in Chromium),
- a touch interaction that fires on `pointerdown`, so a pan or scroll that starts
  on a chart pins and announces a tooltip,
- two publication-time security preconditions that the README either understates
  or omits (main-only is enforced only inside the workflow file; a self-hosted
  runner with a bare `pull_request` trigger once the repo is public),
- a smoke job whose own timeout can fire before its Playwright deadline,
- lower-severity items: a live region that can keep stale text on hybrid devices,
  stale comments and README figures, an unvalidated `VITE_BASE`, and layout-coupled
  touch specs.

## Warnings

### WR-01: At 480px and below the nav link's accessible name gains a stray space ("Payment_history , not in this export")

**File:** `src/lib/shell/DashboardNav.svelte:377-386` (with `:402-407`)
**Issue:** The phone-width block sets `a { display: flex; align-items: center; }`.
Making the link a flex container blockifies its children, so the
`.screen-reader-only` span (inline, `font-size: 0`, `position: static`) becomes a
block-level flex item. The file's own comment at lines 388-401 documents that
Chromium inserts a separator before a non-inline child and that this is exactly
what the `display: inline` / `position: static` construction exists to avoid
(Copywriting Contract D-03). I reproduced it in the installed Chromium with the
same markup and CSS:

| link `display` | accessible name | `getByRole('link', { name: 'Payment_history, not in this export', exact: true })` |
|---|---|---|
| `block` | `Payment_history, not in this export` | 1 match |
| `flex` | `Payment_history , not in this export` | 0 matches |
| `inline-flex` | `Payment_history , not in this export` | 0 matches |

Every muted nav link at phone width is affected. No test catches it:
`tests/e2e/shell/scroll-nav.spec.ts` asserts the names only at the default
1280px viewport, `touch-targets.spec.ts` measures boxes, and `mobile-sweep.spec.ts`
measures overflow. 07-05 added the flex rule to centre text in the 44px box and
nothing re-asserted the contract.
**Fix:** Keep the link a block box and centre the text with padding instead of flex:

```css
@media (max-width: 480px) {
  nav { padding-block: 5.5px; }
  a {
    display: block;
    /* 44px = 1.4em line (19.6px) + 3px border + 2 * 10.7px */
    padding-block: calc((44px - 1.4em - 3px) / 2);
  }
}
```

and add a phone-width assertion next to the existing 1280px one in
`scroll-nav.spec.ts` (a `muted-names` test at `viewport: { width: 375 }`).
`tests/e2e/shell/touch-targets.spec.ts` already runs at 375px, so a
`getByRole('link', { name, exact: true })` check there is the cheapest place.

### WR-02: Touch opens the tooltip on `pointerdown`, so every pan or scroll that starts on a chart pins, announces, then silently dismisses

**File:** `src/lib/features/playtime/HourGrid.svelte:210-221`, `src/lib/features/playtime/CalendarHeatmap.svelte:423-441`, `src/lib/charts/MonthlyBarChart.svelte:128-139`, `src/lib/features/logins/WorldMap.svelte:243-253`, `src/lib/charts/ChartTooltip.svelte:139-162`
**Issue:** All four charts open and pin on the touch `pointerdown`. A touch scroll
also begins with a `pointerdown` (the browser only sends `pointercancel` once it
takes over the gesture). The hour grid (624px), the calendar (634px) and the bar
charts are wider than the 295-309px card at 375px, so they are horizontally
scrollable and are the natural thing to pan; the map and every chart also sit in
the middle of a vertically scrolling page. Consequently, by construction:

1. A finger that lands on a cell to pan, or to scroll the page, opens a tooltip
   at the touch point and `pinOutcome` returns `announce: 'Tooltip pinned.'`.
2. The pan fires `scroll` (captured on `window`), the cell has moved, `isStale()`
   is true, and the tooltip is dismissed silently, which writes `''` to the live
   region.

Net effect: a tooltip flashes under the finger on every swipe that starts on a
mark, and assistive tech gets a pin announcement followed by a cleared region. A
swipe that starts outside the chart is worse for the spec: the capture-phase
`pointerdown` handler runs `onDismiss()` as a *loud* dismissal ("Tooltip
dismissed."), so the UI-SPEC's "a scroll dismisses quietly" row only holds for
scripted scrolls. The e2e suite cannot see any of this: it uses `locator.tap()`
and `window.scrollBy(...)`, never a real drag, and the map swipe guards in
`WorldMap.svelte:178-199` only suppress `pointerover`/`pointermove`, not the
`pointerdown` that follows.
**Fix:** Open on the completion of a tap rather than on its start. Record the
`pointerdown` (id, position), open on the matching `pointerup` if no
`pointercancel` arrived and the pointer moved less than a small slop (roughly
8-10px), and do the same for the capture-phase toggle-off/dismiss in
`ChartTooltip`. Add one e2e case that drags (`page.touchscreen` move, or
`dispatchEvent` of down/move/cancel) over a cell and asserts that no tooltip and
no announcement result. If `pointerdown` is kept, at minimum the announcement
should be deferred until `pointerup` so a scroll gesture is silent.

### WR-03: "main only" is enforced only by a check inside the workflow file; the README calls the real control optional

**File:** `.github/workflows/deploy.yml:13-14, 52-55`, `README.md:149-150`
**Issue:** A `workflow_dispatch` run takes its workflow definition from the ref it
is dispatched on. The comment "a tag or a branch run cannot reach a deploy job"
is true only for a branch whose copy of `deploy.yml` still contains the
preflight. Anyone with write access can push a branch whose `deploy.yml` drops the
preflight job and dispatch it; the in-file `REF != refs/heads/main` check, the
green-CI query and the whole `deploy-workflow.test.ts` guard are all inside the
file being replaced. The only thing outside the author's control is the
`github-pages` environment's deployment-branch restriction, and the README lists
it as "Optional". A public site that anyone with write access (or a leaked token)
can overwrite from an unreviewed branch is the exact failure the preflight exists
to prevent.
**Fix:** Make the environment restriction a required precondition in the README
checklist ("Settings > Environments > `github-pages` > Deployment branches and
tags: Selected branches > `main`"; add "required reviewers" if a second
approver is wanted), and reword the comment in `deploy.yml` so it does not
present the in-file check as the boundary:

```yaml
# Defence in depth only: the boundary is the github-pages environment's branch
# restriction, because a dispatched branch supplies its own copy of this file.
```

### WR-04: Self-hosted runner plus a bare `pull_request` trigger becomes remote code execution on the owner's machine once the repository is public

**File:** `.github/workflows/ci.yml:13, 27` (`README.md:143-147` lists the preconditions that omit it)
**Issue:** `verify` runs on `runs-on: self-hosted` and is triggered by every
`pull_request`. The deploy preflight trusts this workflow's result, and the
README's first precondition is making the repository public (Pages on the free
plan). A public repository lets any fork PR run `pnpm install --frozen-lockfile`,
`pnpm run lint`, the unit tests and Playwright on the maintainer's own persistent
machine. A PR can change `package.json` scripts, a lint config, a Vite plugin or a
test and execute arbitrary code there, with a persistent runner that survives
between jobs (the workflow itself caches `node_modules/.vite`, `node_modules/.tmp`
and the Playwright browsers on it). GitHub's guidance is not to attach
self-hosted runners to public repositories. It is also a trust issue for the
deploy gate: a poisoned runner can make CI green for a commit that is not what
was reviewed. This is not exploitable while the repo is private, but this phase
is the one that plans to flip that switch and the checklist never mentions it.
**Fix:** Add it to the "Preconditions (owner-only)" list and resolve it before
publication: either move `verify` to a GitHub-hosted runner, or run self-hosted
only for `push` to `main` and use `ubuntu-latest` for `pull_request`
(`runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-latest' || 'self-hosted' }}`),
and set Settings > Actions > "Require approval for all outside collaborators".
Note the e2e budget (251 tests, 29 min) was derived against the self-hosted
machine, so a hosted runner needs its own measurement.

### WR-05: The smoke job's deadlines are ordered so that its own timeout can fire before Playwright's, leaving no diagnostics

**File:** `.github/workflows/deploy.yml:211, 241-258, 266`, `tests/deploy/playwright.live.config.ts:94`
**Issue:** The `smoke` job has `timeout-minutes: 20` (1200 s). Inside it, the wait
loop alone can take up to 30 x (10 s sleep + curl) of roughly 300 s, checkout,
`pnpm install` and `playwright install --with-deps chromium` take a few minutes,
and the live config's `globalTimeout` is 15 minutes (900 s), with `retries: 1`
re-running the 240 s opt-in test. Worst case is about 300 + 180 + 900 = 1380 s,
which is over 1200 s. If the job limit fires first, GitHub cancels the job with
no Playwright diagnostics, and the `if: failure()` report upload does not run on a
cancelled job. This is the same ordering failure `tests/unit/guards/ci-budget.test.ts`
exists to prevent for `ci.yml` (inner deadline < wrapper < job), and nothing guards
it for `deploy.yml`; `deploy-workflow.test.ts` pins the loop bound (`<= 100`
attempts) but not the relationship to the job limit. A slow Pages propagation, the
exact case the wait loop is for, is where this would bite.
**Fix:** Keep `globalTimeout` plus the wait loop plus setup safely inside the job
limit, for example `timeout-minutes: 30` on `smoke`, or lower the live
`globalTimeout` to 10 minutes. Add a rule to `deploy-workflow.test.ts` that
`smoke` `timeout-minutes` x 60 >= wait budget (attempts x sleep) + live
`globalTimeout` + 300 s, so the next raise of either number cannot reintroduce it.

## Info

### IN-01: A touch pin released or unmounted by a non-touch input can leave "Tooltip pinned." in the live region and silence the next pin

**File:** `src/lib/charts/ChartTooltip.svelte:279-289`, `src/lib/shell/Dashboard.svelte:59-63`
**Issue:** The design rests on one rule (the doc comment on `pinOutcome`): a live
region that still holds the text it is about to announce does not announce it
again, so every way a pin ends has to clear or replace the text. Two ways do not,
both needing a non-touch input after a touch pin (so hybrid laptop/tablet
devices, not phones):

- A mouse hover or key press after a touch pin takes the `!touchOrigin` branch of
  `pinOutcome` (`{ pinned: false, announce: null }`): the pin is released but the
  region keeps `'Tooltip pinned.'`.
- `ChartTooltip` has no teardown. If a pin is standing when the owning block
  unmounts through a mouse, keyboard or drag-and-drop action (Start over, Replace,
  a dropped file), `pinned` is lost and `chartAnnouncement` in `Dashboard` is never
  reset, so the first pin on the next dataset writes `'Tooltip pinned.'` over
  `'Tooltip pinned.'`, which is no change and no announcement.

A touch tap on Start over or Replace does not hit this: it is a touch `pointerdown`
outside the chart surface, `touchTapAction` returns `dismiss`, and the region gets
"Tooltip dismissed." before anything unmounts. A silent cross-chart move (pin in one
`ChartTooltip` instance, then another) is the specified "a move announces nothing"
and is not a defect.
**Fix:** Clear the region whenever a pin ends for any reason:

```svelte
$effect(() => () => {
  // runs on unmount and before each re-run
  if (pinned) announce('');
});
```

or in `Dashboard`, `$effect(() => { if (result === null) chartAnnouncement = ''; })`;
and make the `!touchOrigin` branch return `announce: input.wasPinned ? '' : null`.

### IN-02: `ci.yml` comments contradict the numbers they sit next to

**File:** `.github/workflows/ci.yml:28-31, 171-179`
**Issue:** The header says the wrapper is "(30 min)" and "30 + 5 = 35 min, so 38
leaves 3 min"; the step comment says "`globalTimeout` (27 min)", "29 min = 1620 +
120 s" and "The 234 tests project to 1218 s". The live values are `globalTimeout`
29 min, wrapper 31 min, job 39 min and 251 tests. `ci-budget.test.ts` enforces
the numbers, not the prose, so the comments drift silently, and a maintainer
following them would raise the wrong limit.
**Fix:** Replace the per-plan history with one short statement of the current
G/W/J values and point at `tests/unit/guards/ci-budget.test.ts` as the source of
truth, as the test header already does.

### IN-03: README states stale counts and an understated Node requirement

**File:** `README.md:16, 49-50`
**Issue:** "Vitest: 337 unit tests" and "Playwright: 86 e2e tests" are the Phase 3
figures (the listed total is 251 across two projects). "Requires Node 22.12+" is
too low for the scripts this README tells people to run: `pnpm run geo:city`, the
rehearsal command and `scripts/geo/resolve-dbip-month.ts` use `node file.ts`, which
needs native type stripping enabled by default (Node 22.18+ / 23.6+); on 22.12 to
22.17 they fail with an unknown-extension error. There is no `engines` field or
`.nvmrc` to catch it.
**Fix:** Drop the counts (or say "see `pnpm run test:unit`"), and state Node
22.18+ (CI uses 24), ideally with `"engines": { "node": ">=22.18" }`.

### IN-04: `dismissIfStale` runs the dismissal path on every scroll and resize even when no tooltip is open

**File:** `src/lib/charts/ChartTooltip.svelte:209-230`
**Issue:** `isStale()` returns `true` when `request === null`, so with a closed
tooltip every scroll event (three instances on the page) sets `silentDismiss = true`
and calls the owner's `onDismiss()`. It is harmless today only because the next
request change resets the flag in the pin effect; the flag is armed with nothing to
dismiss and any future code that reads it outside that effect would misreport a
loud dismissal as silent.
**Fix:** Early-return when closed:

```ts
function dismissIfStale(): void {
  if (request === null || !isStale()) return;
  silentDismiss = true;
  onDismiss();
}
```

### IN-05: `VITE_BASE` is neither validated at build time nor pinned in the e2e config

**File:** `vite.config.ts:112`, `playwright.config.ts:211`, `tests/deploy/playwright.gate.config.ts:46`
**Issue:** `vite.config.ts` uses `process.env.VITE_BASE ?? '/'` while the gate uses
`process.env.VITE_BASE || DEFAULT_BASE`, so an empty `VITE_BASE=` builds with
`base: ''` (Vite treats it as relative) while the gate silently substitutes the
default and serves a mismatched mount. The strict absolute/slash-terminated
validation lives only in the gate config, so the build accepts any string. Separately,
`webServer.env` in `playwright.config.ts` merges with `process.env` and sets only
`GEO_FIXTURE`; a developer who has `VITE_BASE` exported will silently build and
serve the entire 251-test suite under that base and fail on baseURL.
**Fix:** Use `||` in `vite.config.ts` and fail the build on a base that is not
`/^\/([A-Za-z0-9._-]+\/)*$/`; set `env: { GEO_FIXTURE: '1', VITE_BASE: '/' }` in the
main Playwright config (the geo-seam guard reads that object, so update its
expectation in the same change).

### IN-06: The phone-width `main` padding is declared twice and one copy is dead

**File:** `src/app.css:81-104`, `src/App.svelte:278-299`
**Issue:** `app.css` declares `main { padding: 24px }` and a 480px `main { padding:
16px }`; `App.svelte` declares the same two rules scoped, and the scoped ones win,
so the global pair never applies to the app. The comment admits this and keeps both
"for any `main` that is not the app's", but there is no other `main`. Two copies
will diverge, and `mobile-sweep.spec.ts:84-106` pins only the effective one.
**Fix:** Keep the scoped rule (it is the one that applies) and delete the global
`main` padding rules; leave the 44px floor in `app.css`.

### IN-07: The city-dataset cache key ignores the generator, and the rollback note is imprecise

**File:** `.github/workflows/deploy.yml:120-125`, `README.md:171-174`
**Issue:** The cache key is only `dbip-city-lite-<month>`. If the container format
changes (`scripts/geo/build-city-dataset.ts`, `src/lib/geo/range-table.ts`) within a
month, a cache hit restores a container the new code cannot decode. The gate's
one-press opt-in test would catch it (it reaches `ready` only if the decode works),
so this fails loudly rather than ships, but it fails every deploy until the entry
ages out or is deleted by hand. Separately, "Re-run all jobs" redeploys the old
commit with whatever month `resolve-dbip-month.ts` resolves *today* (it uses
`new Date()`), not the data of the run being rolled back, so a rollback is not
byte-identical, and GitHub limits how long after the original run a re-run is
allowed (documented as 30 days; confirm against GitHub's docs and state the
figure in the README).
**Fix:** Add the generator to the key,
`dbip-city-lite-${{ steps.month.outputs.month }}-${{ hashFiles('scripts/geo/**', 'src/lib/geo/range-table.ts') }}`.
The `cache-key` rule in `deploy-workflow.test.ts` has no end anchor, so the suffixed
key still satisfies it; the `no-interpolation` and `cache-restore-keys` rules are
unaffected. In the README rollback paragraph, say the data month follows the re-run
date and name the re-run window.

### IN-08: Several touch specs assume a viewport layout and fail by bounding-box luck

**File:** `tests/e2e/shell/touch-tooltips.spec.ts:413-415`, `:119-123`, `:520-521`; `tests/e2e/shell/mobile-sweep.spec.ts:149-153`
**Issue:** The tap-outside cases pass only if another heading happens to be on
screen at 375x812 after Playwright has scrolled the tapped cell into view
(`toBeInViewport` is satisfied by any one visible pixel, including a pixel under
the 56px sticky nav, where the tap would then hit the nav rather than the
heading). The calendar case needs the hour grid's heading and a 2018 calendar cell
in the same screen; a few pixels of font-metric difference on the CI machine, or any
element added above, flips it. The failure would be a retry-less red on a 251-test
budget with no headroom. The `y + height <= 812` fold assertion in `mobile-sweep`
has the same dependence on header and nav height.
**Fix:** Tap a target that is outside the surface by construction and cannot
scroll: for example `page.getByTestId('identity-header')` for the Playtime and
Finance cases (scroll to top first), or dispatch the dismissal with
`page.touchscreen.tap(x, y)` at a point computed from the chart's own bounding box
(a point just above its top edge). Keep the `toBeInViewport` assertion but require
`ratio: 1`.

### IN-09: The CSP comment and shared-origin note undersell what `connect-src 'self'` allows on a Pages host

**File:** `vite.config.ts:30-31`, `README.md:228-236`
**Issue:** The config comment still says "Phase 7 can revisit path-restricting the
host source once the deployed origin is known". The origin is now known
(`<owner>.github.io`), and `'self'` there covers every sibling Pages project of the
same owner, not only this app; the README caveat covers shared IndexedDB but not
that the policy admits main-thread requests to those paths. It is defence in depth
and the real controls (ESLint ban plus request counting plus the live smoke) are
sound, so this is a documentation gap, not a hole.
**Fix:** Update the comment to record the D-15 decision that the policy deliberately
stays origin-free, and add one sentence to the README caveat that a sibling project
is same-origin for both storage and `connect-src`.

### IN-10: `dist-artifact.spec.ts` defaults the base to `/` while the gate config defaults to the Pages subpath

**File:** `tests/deploy/dist-artifact.spec.ts:172`, `tests/deploy/playwright.gate.config.ts:43, 130`
**Issue:** `const base = process.env.VITE_BASE || '/'` in the artifact spec, against
`process.env.VITE_BASE || DEFAULT_BASE` in the gate config that runs it. With
`VITE_BASE` unset (a local run without the README's rehearsal prefix) the two specs
in one gate disagree: a root-built `dist` passes the artifact spec and fails the
served spec, or the reverse. In the deploy workflow `VITE_BASE` is a job-level
env, so CI is unaffected.
**Fix:** Import `base` from `./playwright.gate.config.ts` (it already exports it) so
there is one default.

### IN-11: The comments claim the cache key and the download "cannot name different months"; they can

**File:** `.github/workflows/deploy.yml:104-107`, `scripts/geo/resolve-dbip-month.ts:19-26`
**Issue:** The month is resolved twice: once in the resolve step (for the key and
`EXPECT_CITY_MONTH`) and again inside `geo:city -- --download`. Using one resolver
function removes logic drift but not time drift: across a month boundary, or when
DB-IP publishes between the two calls, the manifest month differs from the key. The
failure is closed (the gate compares the manifest month to `EXPECT_CITY_MONTH`, and
the cache is saved only on a green job), so nothing wrong ships, but the stated
guarantee is false and the failure message will not point at the cause.
**Fix:** Reword the comments to say "cannot drift in logic", and pass the resolved
month or URL into the generator (`--month` is currently forbidden with `--download`,
so add an explicit `--url` or `--resolved-month` flag) so the two cannot disagree.

---

_Reviewed: 2026-10-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
