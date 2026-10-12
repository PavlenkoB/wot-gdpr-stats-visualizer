---
phase: 07-mobile-layout-public-deploy
plan: 07
subsystem: ui
tags: [css, accessibility, accessible-name, nav, playwright, gap-closure]

requires:
  - phase: 07-mobile-layout-public-deploy
    provides: "plan 07-05's phone-width nav rule (5.5px block padding, 44px link floor) whose flex centring caused GAP-WR01"
provides:
  - "The phone-width nav link rule centres its text with calc block padding and leaves the link a block box, so a muted link's accessible name is exactly 'Payment_history, not in this export' at 375px and 480px"
  - "Four (phone-names) tests in tests/e2e/shell/scroll-nav.spec.ts: not-loaded and after-import at each of 375px and 480px, each asserting a 44px link box"
affects: [verification-07, nav-offset, PLATFORM-01]

actuals:
  tokens: 5000
  tasks: 2
  commits: 2

plan_head_before: 6defe4eda27802d5e95a293d7bca8b5ffcfead3e
plan_head_after: 73ed5051d5f8ec236f405757dcaed70ec3174beb

tech-stack:
  added: []
  patterns:
    - "A nav link that carries a status-suffix child must never be a flex or grid container at any width: blockification of the child puts a separator in the accessible name"
    - "Centre text in a min-height-floored block box with block padding derived from the floor, border and line box, instead of making the box a flex container"

key-files:
  created: []
  modified:
    - src/lib/shell/DashboardNav.svelte
    - tests/e2e/shell/scroll-nav.spec.ts

key-decisions:
  - "Link block padding at phone width is calc((44px - 3px - 1.4em) / 2) (10.7px at 14px); the 3px/1.4/44px are the base rule's border and line height and the app.css floor, repeated because CSS cannot read them from another declaration"
  - "src/app.css is untouched: its phone-width floor also makes every anchor inline-flex, the same blockifying mechanism, accepted risk T-07-25 because the only other anchor (map-attribution-link) has a text-only child"

patterns-established:
  - "Red test commit precedes the fix commit, so the before-fix failure is a fact of git history"

requirements-completed: []

coverage:
  - id: D1
    description: "At 375px and 480px every nav link has its exact accessible name: all six 'Title, no export loaded' names on first visit, and 'Payment_history, not in this export' after an import lacking Payment history; an unmuted link's name is its bare title."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/scroll-nav.spec.ts (phone-names) x4, chromium"
        status: pass
    human_judgment: false
  - id: D2
    description: "The four tests discriminate: they fail against the 07-05 component and again when a flex container is put back on the link."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "red run on f936f91 against 6defe4e's component, and the Task 2 mutation re-run, both 4 failed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every nav link is still a 44px target and the nav is still 57px at 375px against a 72px --nav-offset."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-targets.spec.ts on chromium-mobile, unmodified, 3 passed; measurement table below"
        status: pass
    human_judgment: false
  - id: D4
    description: "The e2e budget does not move: 255 listed tests, ci-budget guard green, no limit edited."
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts, 6 passed"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-05
status: complete
---

# Phase 7 Plan 7: Exact nav link names at phone width (GAP-WR01) Summary

**The phone-width nav link is centred with calc block padding instead of flex, so its status-suffix span stays inline and the accessible name is exactly "Payment_history, not in this export" at 375px and 480px, held by four tests that fail on the 07-05 component and when flex is restored.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-05
- **Tasks:** 2 (one tracer, one auto)
- **Files modified:** 2

## Accomplishments

- Task 1 (tracer), two commits in order. `f936f91` adds the four `(phone-names)` tests (red); `73ed505` replaces the link's `display: flex; align-items: center` in the phone-width rule with `padding-block: calc((44px - 3px - 1.4em) / 2)`, rewrites the comment that said the links were centred with flex, and extends the `.screen-reader-only` comment with the blockification warning. Only the style block changed (hunks at lines 374, 383 and 396).
- Task 2 proved the contract: mutation re-failure, real-app measurements at four widths, regression sweep, budget and full suite.

## Red run (Task 1, against the unmodified 07-05 component)

All four failed (4 failed):

- Not-loaded tests at 375px and 480px: `getByRole('link', { name: 'Activity_history, no export loaded', exact: true })` expected count 1, received 0.
- After-import tests at 375px and 480px: `toHaveAccessibleName` expected "Payment_history, not in this export", received "Payment_history , not in this export" (the stray space).

## Mutation re-failure (Task 2)

With `display: flex; align-items: center` put back on the link in the phone-width rule (not committed), `-g "phone-names"` again gave 4 failed: two with zero exact matches, two with the received name "Payment_history , not in this export". The file was restored with `git checkout` and `git diff --quiet` exited 0.

## Nav measurements (real built app, throwaway spec, deleted)

| Width | Nav height | Link height | Link display | --nav-offset | Payment_history name |
| ----- | ---------- | ----------- | ------------ | ------------ | -------------------- |
| 375   | 57         | 44          | block        | 72px         | Payment_history, not in this export |
| 480   | 57         | 44          | block        | 72px         | Payment_history, not in this export |
| 481   | 56.59375   | 38.59375    | block        | 72px         | Payment_history, not in this export |
| 1280  | 56.59375   | 38.59375    | block        | 72px         | Payment_history, not in this export |

This matches the 07-05 table (56.59px before the floor, 57px after, `--nav-offset` 72px) and every expectation in the plan; the nav at 375px is within 1px of the 1280px nav.

## Verification

- Full `scroll-nav.spec.ts` on chromium: 18 passed. `touch-targets.spec.ts` on chromium-mobile, unmodified: 3 passed.
- `pnpm exec playwright test --list | tail -1`: `Total: 255 tests in 25 files` (251 plus the four). `ci-budget.test.ts`: 6 passed. `git diff` against the pre-plan HEAD for `playwright.config.ts`, `.github/workflows/ci.yml`, `ci-budget.test.ts`, `package.json`, `pnpm-lock.yaml`, `src/app.css`, `src/lib/ui-copy.ts` is empty.
- Full suite: `pnpm exec playwright test` 255 passed (1.3 min, both projects); `pnpm run test:unit` 2483 passed; `pnpm run check` 0 errors 0 warnings; `pnpm run lint` clean. `git status --porcelain src tests` prints nothing.
- The Task 2 regression sweep list (uat-criteria, dashboard, mobile-sweep, playtime, vehicles, logins) is covered by the full both-project run above, all green.

## Deviations from Plan

None - plan executed exactly as written.

## Finding to carry forward

The global `a` floor in `src/app.css` gives every anchor an inline-flex display at phone width, which blockifies any anchor child element. Today only the nav link has an element child, and the nav's scoped block display outranks the floor. Any future anchor with an element child must be written with this in mind (T-07-25, accepted).

## Self-Check: PASSED

- f936f91 and 73ed505 exist in git log; both touch only their own file.
- `src/lib/shell/DashboardNav.svelte` and `tests/e2e/shell/scroll-nav.spec.ts` modified; scratch spec absent.
