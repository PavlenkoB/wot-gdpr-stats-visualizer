---
phase: 09-multi-account-import-account-identity
plan: 08
subsystem: ui
tags: [ui-review, typography, provenance, identity-header, e2e-coverage]
requires: [09-04-SUMMARY, 09-05-SUMMARY, 09-07-SUMMARY]
provides: []
affects: [09-UI-SPEC, DashboardSection.svelte, IdentityHeader.svelte, multi-account.spec.ts]
tech-stack:
  added: []
  patterns:
    - "A design-contract amendment lands in the SAME commit as the code it describes, so the two can never disagree (the W-03 precedent from Phase 4, applied again here)"
    - "A widened browser scan excludes known-good repetition BY TEST ID at one named reader, never as an inline exemption — an inline one would silently accept a second, wrong duplication in the same pane"
    - "Async panes are read through `expect.poll` on a STABLE row count rather than on `data-status`, because a section can read 'ready' while its inner table has not drawn yet"
key-files:
  created: []
  modified:
    - src/lib/shell/DashboardSection.svelte
    - src/lib/shell/IdentityHeader.svelte
    - .planning/phases/09-multi-account-import-account-identity/09-UI-SPEC.md
    - tests/e2e/shell/multi-account.spec.ts
    - tests/unit/shell/identity-model.test.ts
decisions:
  - "The id-only row's title shares the `.account-id` selector rather than restating its values, so the ID-only title and the ID line cannot drift apart in a later edit"
  - "`readPaneRows` is one named reader with all three exclusions documented at the definition, so every pane walk measures the same thing"
  - "Device-info repetition is scoped out as D-11's specified merged read (dedupe is Phase 10's), distinct in REASON from D-12's within-account vehicle duplication — and each is proven still real by its own assertion"
metrics:
  duration: 22m
  completed: 2026-10-18
  commits: 3
  plan_head_before: 088e7d8df7c478b763d2b4bd98c5e00017aad265
  plan_head_after: 984651b9d06984cd1a91600d0b3bb4e319796444
actuals:
  tokens: 7256
  tasks: 3
  commits: 3
status: complete
---

# Phase 9 Plan 08: Close the three carried-open UI-audit findings Summary

Three small, unambiguous fixes from `09-UI-REVIEW.md`: the combined caption that sat one line-height from the line it introduces, the account row whose missing identity wore the row's most prominent type, and the repeated-key browser check that looked at one pane.

**One-liner:** The caption gets the phase's 4px block gap, an id-only account row is demoted to the ID line's Label role (type only — text and accessible name untouched), and the duplicate-row scan walks every pane instead of Vehicles alone.

---

## What shipped

### 1. The combined caption gets the phase's 4px block gap (`5449934`)

The provenance block was `gap: 0 4px`. D-11's caption takes `flex-basis: 100%`, so it becomes its own flex line — and with a zero row gap the 600-weight caption sat exactly one line-height from the 400-weight line it introduces. It is the only block in this phase where two lines of different weight sit adjacent, so it is also the only place the 4px block rhythm had to be added by hand.

The rule as written in `src/lib/shell/DashboardSection.svelte`:

```css
.provenance {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 4px;
  row-gap: 4px;
  /* … */
}
```

`column-gap` stays 4px and is asserted too: it is what makes the inline `From … · N files` run read as one line, and widening or removing it would change that run, which is not the fix. The caption remains the provenance block's first element child, which the same helper already asserts, so the layout fix cannot quietly become a reordering. The rule's comment records why the caption needs the row gap, so the value is not "tidied" back to `0` later.

**RED evidence:** `toHaveCSS('row-gap', '4px')` on the provenance block reported `Received: "0px"` against the un-amended component, in `expectCombinedCaption`, inside test (a).

### 2. An id-only account row is an ID line, not a heading (`2d42efc`)

The Typography table listed "ID-only row title" as a Heading. But a 20-digit account root at 18px/600 in `--ink` reads as a nickname, and the account is not one — it is an absence, and an absence must not wear the row's most prominent type.

The demotion is a change of **type only**. The element stays the same `h3`, the `data-testid="identity-multi-name"` hook is unchanged, the text stays `row.name`, and the row's accessible name is unchanged — a rootless account keeps the only identifier it has (D-17, T-09-28). The type comes from sharing the existing ID line's selector, so the two cannot drift apart:

```css
.account-id,
.multi-name.id-only {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--muted);
  /* … */
}
```

bound in the markup by `class:id-only={row.idOnly}`. No new copy string was added — no prefix, no suffix, no `ui-copy.ts` entry.

**The contract was amended in the same commit**, because `09-UI-SPEC.md` is what this component is measured against and it stated the opposite in two places. Six edits: the Typography table's Label and Heading rows plus a new paragraph recording the demotion as deliberate; the Color table's Accent and Muted rows plus a note that not every account name is Accent; the `partial | account with no User_Info` UI Considerations row; the Surface 1 `h3` description; and the Contrast bullet. The Test Hooks table needed no change, precisely because the element did not change.

**RED evidence (unit):** the new source-scan case failed against the un-amended component. It matches one `<h3>` carrying the test id, the `class:id-only` binding and exactly `{row.name}` as its text, so it pins the element, the hook, the modifier and the unchanged content in one assertion.

**Negative controls.** Both assertions were proved to bite before being trusted: flipping the expected size to `18px` failed with `Expected: "18px" / Received: "14px"`, and deleting `class:id-only` from the component failed the unit case. Without those, a green run would not have distinguished "asserted" from "vacuously true".

### 3. The repeated-key scan walks every pane (`984651b`)

09-04's keyed-each fix was proved in the browser on the Vehicles pane alone, leaving every other keyed list that can repeat a value across accounts unchecked in a real browser (IN-06, T-09-22).

The scan now walks `PANE_IDS` itself — the same source every other walk in this spec drives from — so a new pane is covered by construction rather than by remembering to add it here. It measures rendered row text (what a dropped or duplicated keyed row looks like to a user) and covers the account list alongside the panes.

**Panes walked, and what each contributed.** Measured by instrumenting the assertion, not assumed:

| Pane | Rows read | Note |
|------|-----------|------|
| Overview | 0 | Skipped — no table; `PANE_SECTION.overview` is `null`, scoped to the detail pane |
| Playtime | 6 | Scanned |
| Login history | 3 | Scanned |
| Vehicles | 0 | Scanned; every table is a D-12 exclusion |
| Finance | 0 | Skipped — no drawn table body for this dataset |
| Payments | 14 | Scanned |
| Device info | 0 | Scanned; every table is a D-11 exclusion |
| Account | 0 | Skipped — legitimately `pending` on a multi-account dataset |
| Not yet supported | 0 | Skipped — no rows by design |

Three panes with real row sets plus the account list, against the one the old scan covered.

**Two findings the widening produced, both resolved as designed repetition rather than by weakening the check:**

- **Device info** — 33 rows, 11 distinct. Every root of a multi-account export carries the same `Device_info` files, so each device draws once per account. That is D-11 exactly: every pane reads ALL accounts' rows, and **dedupe is explicitly deferred to Phase 10**. Not a keyed-each defect — the pane's own `each` is keyed by index and was never at risk.
- **The `data-status` gate is not usable here.** The Account pane is `pending` forever on this dataset (there is no single User_Info record to present), so a `ready` wait times out on a pane behaving correctly. And it is not sufficient where it does hold: Finance computes its totals and Device info reads its tables off the worker *after* the section already reads `ready`. The first version of this scan used that gate and passed vacuously on empty bodies — exactly how a widened scan turns into a weaker one. Replaced with an `expect.poll` that reads until the row count holds still across three polls.

**Each exclusion is scoped by test id at one named reader (`readPaneRows`), never exempted inline**, and each is proven still real by its own assertion: D-12's vehicle and battle-type duplication by the pre-existing Vehicles step, D-11's per-account device rows by a new Device info step. An inline exemption would silently accept a second, wrong duplication in the same pane; a scoped one cannot.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] The plan's `data-status="ready"` wait is neither sufficient nor usable for this scan**
- **Found during:** Task 3
- **Issue:** The plan directed the scan to wait on readiness; the account pane is `pending` forever on a multi-account dataset (timeouts on correct behaviour), and Finance/Device info draw their rows *after* `ready` (passes vacuously). First draft used it and produced a vacuous pass.
- **Fix:** An `expect.poll` on a stable row count, documented in place, with the reason recorded so the next reader does not "simplify" it back to the status gate.
- **Files modified:** `tests/e2e/shell/multi-account.spec.ts`
- **Commit:** `984651b`

**2. [Rule 1 - bug] A source-scan assertion broke on a Prettier reflow**
- **Found during:** Task 2
- **Issue:** The assertion pinned `>{row.name}</h3>`. Prettier reflow the `h3` attributes onto separate lines, so the literal no longer appeared — a formatting choice, not a contract.
- **Fix:** Replaced with a single regex over the whole `<h3>` that hops attribute line breaks and asserts its text content is exactly `{row.name}`. Now whitespace-independent.
- **Files modified:** `tests/unit/shell/identity-model.test.ts`
- **Commit:** `2d42efc`

**3. [Rule 2 - missing functionality] Device-info repetition had no proof of its own**
- **Found during:** Task 3
- **Issue:** Scoping the device pane out of the scan removes it from a check; an unproven exclusion can rot into hiding a defect.
- **Fix:** Added a Device info step asserting each device really does draw once per account, alongside D-12's existing proof. Both exclusions are now self-justifying.
- **Files modified:** `tests/e2e/shell/multi-account.spec.ts`
- **Commit:** `984651b`

### No new dependencies

`git diff --exit-code -- package.json pnpm-lock.yaml` exits 0. No copy was added (`git diff --stat -- src/lib/ui-copy.ts` is empty), no `@media` query was added, and no browser test was added.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm run check` | 0 errors, 0 warnings across 313 files |
| `pnpm run lint` | Prettier + ESLint clean |
| `pnpm run test:unit` | 3118 passed (96 files) |
| `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts` | 2 passed |
| `… master-detail-nav.spec.ts` | 15 passed — the `/^From …/` anchored assertion untouched |
| `… identity-privacy.spec.ts` | 5 passed |
| `pnpm exec playwright test --list` | **Total: 258 tests in 28 files** (unchanged) |
| `git diff --exit-code -- package.json pnpm-lock.yaml` | exits 0 |

Every assertion rode inside an existing test. `master-detail-nav.spec.ts`'s anchored `toHaveText(/^From …/)` is why the caption stayed a conditional adjacent tag and the provenance block's first child — the row gap was added without touching the markup.

---

## Threat Flags

None new. T-09-28's mitigation is implemented as written and asserted, not merely documented: the account root stays in the DOM inside the same `h3`, and the browser step asserts both its presence and its computed type. No fix here introduces a data path, and the phase's zero-network posture is untouched.

---

## Known Stubs

None. No `TODO`, no skipped test, no unrun verification. Every `<verify>` in the plan ran.

---

## Self-Check: PASSED

All five modified files exist; all three commits (`5449934`, `2d42efc`, `984651b`) are ancestors of HEAD; the SUMMARY was written against the measured commit count from the plan-head ledger, not narrated.