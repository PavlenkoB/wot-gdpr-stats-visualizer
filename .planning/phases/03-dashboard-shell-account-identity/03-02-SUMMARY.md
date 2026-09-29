---
phase: 03-dashboard-shell-account-identity
plan: 02
subsystem: dashboard-ui-logic
tags: [dashboard-status, nav, scroll-spy, ui-copy, section-status, d08, d03, d05]
dependency_graph:
  requires: [phase-03-plan-01-worker-privacy]
  provides: [dashboard-status-module, scroll-spy-rule, phase-3-ui-copy]
  affects: [dashboard-section-component, dashboard-nav-component, identity-header, phase-4-6-dashboards]
tech-stack:
  added: []
  patterns:
    - one-pure-status-function-three-consumers
    - absent-is-null-not-zero
    - case-insensitive-merge-for-supported-case-sensitive-split-for-unsupported
    - the-scroll-decision-outside-the-dom
key-files:
  created:
    - src/lib/dashboard-status.ts
    - src/lib/scroll-spy.ts
    - tests/unit/dashboard-status.test.ts
    - tests/unit/scroll-spy.test.ts
  modified:
    - src/lib/ui-copy.ts
    - tests/unit/ui-copy.test.ts
decisions:
  - "D-02 order is declared in dashboard-status.SECTIONS, never derived from worker/categories.SUPPORTED (a different order, and it exists for the worker) or from SAMPLE_BADGE_ORDER"
  - "sectionCounts answers null for absent and zeroes for present-but-empty; the two never collapse, because collapsing them is exactly the DATA-04 repudiation risk"
  - "Supported folder matching lowercases and SUMS every match (User_Info + user_info = one section); the unsupported list applies the opposite rule and keeps case-variant names as separate items"
  - "The unsupported block maps onto the shared section shell via unsupportedSectionStatus: not-loaded to not-loaded, none to empty, has-items to ready (D-07, one section component)"
  - "The rootless-account copy belongs here, in ui-copy.ts: IDENTITY_UNKNOWN_ACCOUNT_TITLE + formatIdentityFallbackTitle, closing the decision 03-01 left unassigned (RESEARCH Pitfall 6)"
  - "formatSectionStatus is typed to the three GREYED statuses only, so a caller must narrow before asking for a status line; pending and ready have no status line by design (D-09)"
  - "Nav muted reasons are a closed union of section statuses (no-export, empty, not-loaded) plus none; the reason is what becomes the visible-text accessible-name suffix (D-03)"
  - "Every nav title and suffix lives in ui-copy, never in dashboard-status, so the status module carries no copy strings and no import can become a cycle"
  - "The band-bottom percentage is Chromium-verified against height and unverified in Firefox/Safari (RESEARCH A1); the UI-SPEC string stands, and the px-rebuild fix belongs in the component, not here"
  - "Plan deviation: five guard assertions were rewritten to carry a contrast line, because against a constant-returning stub they were tautologies with no committed failing state"
  - "Plan deviation: isAtPageBottom's effective threshold is scrollY >= docHeight - 1 - innerHeight, so the spec's 1px slack means the one-pixel-short case sits at 2198, not 2200; the implementation follows the formula, the test's arithmetic was corrected"
metrics:
  duration: ~40min
  completed_date: 2026-09-29
  tokens: 62000
  tasks: 3
  commits: 6
  plan_head_before: d736f51
status: complete
---

# 03-02 Summary: Dashboard status, nav model and copy

## What was built

The logic the whole dashboard shell will read, with no component in it.
Three pure modules — `dashboard-status.ts`, `scroll-spy.ts` and the
additive half of `ui-copy.ts` — plus 65 tests. The Svelte components in
03-04 to 03-06 get to be thin, because the hard parts were already decided
here and can be stated in a test rather than argued about in a template.

Everything is DOM-free on purpose: this repo's Vitest setup has no jsdom
and does not want one, so a rule that lived inside a component would be
untestable, and a subtle rule that is untestable is a rule that gets guessed
at. 65 new tests, no new environment, no new dependency.

### Task 1 — one status derivation (tracer)

The nav, the section cards and the "Not yet supported" block all describe
the same export, so D-08 makes them read one module rather than each grow
its own `{#if}`. A nav link and its card disagreeing is the bug a user
reads as "the app is lying to me".

`sectionCounts` returns `null` for a folder that is absent and zeroed counts
for one that is present with nothing parsed. That single choice is the whole
DATA-04 contract: collapsing the two would let "Not in this export" stand in
for "there, but empty", which is a statement about the user's own data.

The tracer test walks the full path in one assertion chain — a result
without `Payment_history` becomes `no-export`, becomes "Not in this export",
becomes a muted nav entry, and becomes the exact accessible name
`Payment_history, not in this export`.

### Task 2 — every new string, locked

Twenty-three exact-string tests over the UI-SPEC Copywriting Contract. The
section notes, the unsupported block, the identity header, the import
region, and the formatters: `formatImportSummary` composed from the two
existing count formatters, `formatAccountId`, `formatCreatedDate`,
`formatIdentityFallbackTitle`.

### Task 3 — the scroll rule

`pickActiveSection`, `isAtPageBottom`, `buildRootMargin`, `parseNavOffset`.
No imports, no browser globals, four exported functions. The three Chromium
probe findings from RESEARCH Q5 are encoded as named tests.

## The decision 03-01 left unassigned

**The rootless-account copy is in scope, and it is implemented here.** The
plan's Task 2 names `IDENTITY_UNKNOWN_ACCOUNT_TITLE` and
`formatIdentityFallbackTitle` outright, the artifacts list includes them,
and `IDENTITY_UNKNOWN_ACCOUNT_TITLE` is in the behavior block's exact-string
list — so this was never ambiguous about ownership, only about which
document said so.

The substance: a re-zip whose entries are not all under one root folder
yields `accountRoot === ''`. D-16's fallback title is then the account ID,
which is then the empty string, which is then an empty `<h2>` — a blank card
with no explanation anywhere on the page. `formatIdentityFallbackTitle('')`
returns `IDENTITY_UNKNOWN_ACCOUNT_TITLE` ('Unknown account') and the root
unchanged otherwise. RESEARCH Pitfall 6 asks for "copy for the empty-root
case, tested"; it is now both.

## Deviations from the plan

**1. Five guard assertions were rewritten to carry a contrast line.** My
first RED drafts of the scroll-spy guards asserted only that a function
returns `false` or returns `previous` — and against a signature-only stub
that returns `false` and `previous`, they PASSED. Six of fifteen tests had
no committed failing state, which makes them decoration: they cannot
distinguish a correct implementation from a constant. Each now pairs the
guard with a case that differs only in the variable under test (a tall page
scrolled to the bottom vs. at rest; a non-empty intersecting set vs. an
empty one; a parseable `--nav-offset` vs. an unset one). 13 of 15 now fail
red.

**2. The `isAtPageBottom` threshold test had the arithmetic wrong.** The
plan's phrasing "one pixel short of that threshold is false, exact is true"
is correct as a rule; my numbers were not. The effective threshold is
`scrollY >= docHeight - 1 - innerHeight`, so for a 3000px document in an
800px viewport it is 2199, and 2200 — which I had used as the "one pixel
short" case — is already inside the slack and correctly returns `true`. The
implementation follows the plan's formula; the test's numbers were corrected
to 2198/2199/2200. Worth stating because the plan's own acceptance-criteria
wording is easy to misread the same way.

**3. `formatSectionStatus` takes the three greyed statuses, not
`SectionStatus`.** The plan describes it as "for the three greyed
statuses", and typing it that way is the honest contract: a populated card
has a summary line and a note (D-09), not a status line, so there is no
sensible `pending` or `ready` return value. A caller must narrow the card's
status before asking for a status line, which the template already does when
it branches on the greyed cases.

**4. One type alias added to `ui-copy.ts`.** `GreyedSectionStatus` is not
in the plan's artifacts list. It is a `Extract` of the existing
`SectionStatus` union, defined in `ui-copy.ts` rather than
`dashboard-status.ts` so the status module's export list stays exactly as
the plan specifies it.

## Key insights

**`null` and `0` are the entire DATA-04 requirement.** Every other part of
the status ladder follows from refusing to let an absent folder report a
count. The skip-tag case then comes free: a folder whose rows were all
skipped is `empty` AND still reports `skippedRowCount: 3`, so the card can
say "no rows" and "3 skipped" without one erasing the other. That is
RESEARCH Open Question 2's flagged addition, and the counts module already
supports it — 03-04 only has to render the tag.

**Case handling is asymmetric, and both directions are correct.** Supported
folders MERGE across case (`User_Info` + `user_info` is one section with
summed counts) because `classifyFolder` is case-insensitive and an export
can hold both — reporting `no-export` there while rows sit in IndexedDB is
the Pitfall 1 failure. Unsupported folders SPLIT across case (`Bans` and
`bans` stay two list items) because merging them would hide a folder that
is genuinely in the archive. One line of code in each direction, opposite
intents, each with a test that fails if it is copied to the other place.

**The one-pixel slack moves the threshold, it does not sit after it.** The
formula is `scrollY + innerHeight >= docHeight - 1`, so the true boundary
is one pixel ABOVE the geometric bottom. Getting that backwards in a test
produces a test that fails for a correct implementation, which is the more
expensive mistake of the two.

**A guard test needs a contrast line or it proves nothing.** Six of my
first-fifteen scroll-spy tests were `expect(fn(...)).toBe(false)` against a
stub that returns `false`. The fix is not better assertions, it is pairing
every guard with the case it is guarding *against*.

## Self-review

Beyond the acceptance criteria:

- **Every guard test is discriminating.** No test in the plan passes
  against a constant-returning implementation of the function it tests.
  This was not true of the first draft, and the RED commit is what caught
  it.
- **The full suite, not the three files.** `pnpm run lint && pnpm run check
  && pnpm run test:unit` — 309 tests across 14 files, up from 244/12. The
  pre-existing `webserver-teardown.test.ts` is untouched.
- **One infra flake, investigated not ignored.** A single full-suite run
  failed with a worker fork SIGKILLed on `webserver-teardown.test.ts`
  (pre-existing, Phase 01) while all 309 tests passed. Three subsequent
  runs were clean. Not caused by this plan: the plan adds no workers, no
  timers and no teardown.
- **Acceptance-criteria greps, run literally.** `grep -c "^export "`
  returns 17 (plan asked for ≥ 14); `grep -c "^import "` and
  `grep -c "^import type "` both return 1 on `dashboard-status.ts` (the
  plan's no-runtime-import criterion, checked as written);
  `scroll-spy.ts` has 0 import lines and 0 lines mentioning `window` or
  `document` outside comments.

## Verification

| Command | Result |
|---|---|
| `pnpm run test:unit` (full suite) | PASS — 14 files, 309 tests (was 12/244) |
| `pnpm run lint` (`prettier --check . && eslint .`) | PASS |
| `pnpm run check` (svelte-check x2 + tsc) | PASS — 0 errors, 0 warnings |
| `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` | PASS — no dependency added |
| `grep -c "^export " src/lib/dashboard-status.ts` | 17 (plan asked for ≥ 14) |
| `grep -c "^import "` / `grep -c "^import type "` (dashboard-status.ts) | 1 / 1 — type-only, no runtime import |
| `grep -vE '^\s*(//\|/\*\|\*)' src/lib/scroll-spy.ts \| grep -cE "window\|document"` | 0 |
| `grep -cE "^import " src/lib/scroll-spy.ts` | 0 |

## Commits

| SHA | Task | What |
|---|---|---|
| `1b38df8` | 1 RED | 23 failing tests: tracer path, status table, unsupported block, nav model |
| `21c8db7` | 1 GREEN | `dashboard-status.ts` (17 exports) + `SECTION_TITLES`/`NAV_STATUS_SUFFIX`/`formatSectionStatus` |
| `b80a4df` | 2 RED | 23 failing exact-string copy and formatter tests |
| `a99cbbb` | 2 GREEN | The 15 copy constants and 4 formatters, doc-commented to their decision |
| `3804758` | 3 RED | 13 failing scroll-spy tests, guard cases given contrast lines |
| `f28599a` | 3 GREEN | `scroll-spy.ts`; corrected the threshold test's arithmetic |

## Carried forward

- **The scroll-spy e2e assertion must mirror the rule, not the wording.**
  At Phase 3 content heights middle sections often cannot reach the band
  before the page bottoms out, so clicking `User_Info` can legitimately
  leave `Not yet supported` current (RESEARCH Q5.5, UI-SPEC backstop). 03-05
  and 03-06 should assert the rule's own disjunction, and it is worth a UAT
  note rather than a bug report.
- **`--nav-offset` is still the single source of truth.** `parseNavOffset`
  reads the computed custom property, so `app.css` must actually declare
  it before the nav works; a 03-05 wiring slip would show a plausible
  default rather than a failure.
- **Chromium-only percentage semantics.** The `-60%` band resolves against
  HEIGHT in Chromium and is unverified in Firefox and Safari
  (RESEARCH A1). If that ever matters, the fix is a px computation plus an
  observer rebuild on resize, and it belongs in the nav component.
- **`BUILT_DASHBOARDS` is empty by design.** It becomes `ready` only when
  Phases 4-6 add their id; until then every populated section shows the
  D-09 "coming in a later update" note.
- **The `empty`-state skip tag is still an open flag** (RESEARCH Open
  Question 2). The counts module already returns the number; only 03-04's
  render and the UI checker's confirmation are outstanding.
- **Playwright specs still assert retired markup** and are rewritten in the
  Wave 3 plan. Nothing here runs them, so they are expected to stay red
  until 03-05/03-06.
