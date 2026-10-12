---
phase: 04-activity-time-dashboards
scope: gap-closure (plans 04-17, 04-18) + test-flakiness commits f512f56, e9588d0
reviewer: Verifier (independent, read-only)
reviewed: 2026-10-02
range: 52e352e..1a19b79
branch: gsd/phase-05-vehicle-stats-financial-dashboards
findings:
  blockers: 0
  major: 2
  minor: 3
  total: 5
status: issues_found
verdict: APPROVED_WITH_NOTES
note: >
  This review covers plans 04-17 and 04-18 only. The earlier review of plans
  04-14/04-15/04-16 lives in 04-GAPCLOSURE-REVIEW.md and is unchanged.
---

# 04 Gap-Closure Review — plans 04-17 and 04-18, plus the two flake-fix commits

Reviewer: independent Verifier (read-only). Date: 2026-10-02.
Range reviewed: `52e352e..1a19b79` on `gsd/phase-05-vehicle-stats-financial-dashboards`.

- 04-17 wave: `52e352e..6b5cbc5` — calendar gutter + focus correction
- flake fix:   `6b5cbc5..e9588d0` — `f512f56` (fixture zip mtime), `e9588d0` (vitest testTimeout)
- 04-18 wave:  `e9588d0..1a19b79` — summary tile wrap + legend note line

## VERDICT: APPROVED_WITH_NOTES

> **Filename note.** The review brief pointed at `04-GAPCLOSURE-REVIEW.md`, but that file
> already exists and holds the review of plans 04-14/04-15/04-16. This review therefore
> lives in `04-17-18-GAPCLOSURE-REVIEW.md`; the earlier file is left byte-for-byte intact.

The three gaps are closed correctly, the contract amendments A-1..A-4 are legitimate and
append-only, and every new test genuinely fails when its fix is reverted (I verified this by
mutation, not by reading the assertions). No invariant was broken: no dependency, no network,
no CSP, no Worker-lifecycle or DOM-shape change. The notes below are one real coverage gap in
the flake fix, one inaccurate claim in 04-17-SUMMARY.md, and a pre-existing Phase 05 e2e
failure that the reviewed range neither caused nor fixed.

---

## BLOCKERS

None.

---

## MAJOR

### M-1 — the flake fix's wrapper does not cover every `zipSync` call site

**What.** `f512f56` introduces a pinned-mtime `zipSync` wrapper
(`tests/fixtures/export-fixtures.ts:25-30`) and the doc comment above it claims
"**Every** fixture archive is built with a PINNED zip mtime". Two other fixture builders
import `zipSync` directly from `fflate` and bypass the wrapper entirely:

- `tests/fixtures/sessions-fixtures.ts:1` — `import { zipSync } from 'fflate';`
- `tests/fixtures/playtime-real-shape-fixture.ts:55` — `import { zipSync } from 'fflate';`

**Why it is a defect.** The claim in the comment is false as written, and the fix is
positional rather than structural, so the next archive added to either file silently
reintroduces the exact flake class that `f512f56` exists to kill. Those two builders are
consumed by the heaviest e2e suites — `tests/e2e/playtime-scale.spec.ts:139,142`
(`buildSessionsExport(SCALE_60K_SPEC)`), `tests/e2e/playtime-real-shape.spec.ts:77`,
`tests/e2e/playtime-ui-review.spec.ts:4`, and `tests/unit/ingest-worker.test.ts` at lines
1039/1092/1286/1941/1995.

**How to reproduce.** I probed `fflate@0.8.3` directly (scratch script in `/tmp`, no repo
mutation). Two unpinned `zipSync` calls 2.5 s apart produce **different** bytes; two pinned
ones produce **identical** bytes:

```
unpinned equal across 2.5s: false
pinned equal across 2.5s:    true
```

So any future assertion that builds one of the two bypassing exports twice and compares
bytes or a SHA-256 will flake at the same ~1-in-40 rate described in the commit comment.

**Mitigating — why this is MAJOR and not BLOCKER.** I checked every current consumer of the
two bypassing builders and found **no** byte-equality, hash-equality or dedup assertion over
them. They are built once per process (`memoised(...)` at
`playtime-scale.spec.ts:139,142`) and asserted on parsed content, so no current test is
affected, and the whole suite is green. The exposure is latent, not live. The minimal fix is
to export the wrapper (or a `pinnedZipEntries`) from a shared fixture module and route both
files through it, which would also make the comment true.

### M-2 — the wrapper's option spread can silently defeat its own pin

**What.** `tests/fixtures/export-fixtures.ts:29`:

```ts
return fflateZipSync(data, { mtime: ZIP_MTIME, ...opts });
```

`...opts` is spread **after** the pin, so a caller-supplied `mtime` wins and the archive goes
back to `Date.now()` — the precise failure the commit exists to prevent.

**Why it is a defect.** It is a trap in the one function whose entire job is to make the
behaviour unbypassable, and it is invisible: a future `zipSync(entries, { mtime })` reads as
"passing an option" rather than "re-enabling the flake". My probe confirms the clobber is
real — with the pin spread last, bytes again differ across 2.5 s:

```
spread-last caller mtime equal across 2.5s: false   (i.e. pin clobbered)
```

Spreading the pin last (`{ ...opts, mtime: ZIP_MTIME }`) would make the guarantee structural.
No caller can then opt out of reproducibility even by accident.

**Mitigating — why this is MAJOR and not BLOCKER.** I enumerated every call site of the local
`zipSync` in `export-fixtures.ts` (lines 405, 457, 473, 488, 502, 516, 525, 536, 547, 557,
568, 587, 618, 673, 781, 841, 1033, 1107, 1236) and **none of the 19 passes a second
argument** — a grep for `zipSync\([^)]*,` returns no matches. So today the spread order is
inert and nothing is broken. This is a latent trap, not a live bug.

---

## MINOR / NITS

### N-1 — `04-17-SUMMARY.md:77` misstates the finance e2e count and its passing status

The summary asserts "`tests/e2e/finance.spec.ts` (30 tests) passes unchanged" (and the RED
evidence table at `04-17-SUMMARY.md:119` records "30 passed").

- The file holds **28** tests, not 30. Verified:
  `pnpm exec playwright test tests/e2e/finance.spec.ts --list` → `Total: 28 tests in 1 file`.
- It does not currently pass. One test fails deterministically (3/3 repeats):
  `tests/e2e/finance.spec.ts:1568` — *"(clip) the first and last month keep the finance
  tooltip inside the viewport"*, with `TypeError: Cannot read properties of null (reading 'y')`
  from `flipped = (await tooltip.boundingBox())!` at line 1606.

**Attribution — this is NOT a regression from the reviewed range, and I verified that
rather than assuming it.** I restored the pre-fix versions of both files the range changed
that this test could plausibly depend on — `src/lib/focus-clear.ts` from `fd7412c^` (the
inverted `top: -delta`) and `tests/fixtures/export-fixtures.ts` from `52e352e` (no mtime pin)
— and re-ran the test. It **fails identically in both cases**. `finance.spec.ts` itself and
the Phase 05 components it exercises (`MonthlyBarChart.svelte`, `FlowLegend.svelte`) are
untouched by `52e352e..1a19b79` (`git diff --stat` on those paths is empty), and the
failing spec was last modified by `e232684`, which is an **ancestor of the pre-04-17 base**
(`git merge-base --is-ancestor e232684 52e352e` → true). The failure is pre-existing on this
shared Phase 05 branch.

The finding here is the *claim*, not the code: a summary that certifies a shared-branch suite
as "passes unchanged" with a wrong test count and a suite that is in fact red is a
regression-detection hole. Anyone re-running this verification step will hit a failure that
the summary says cannot exist.

### N-2 — `playtime-model.test.ts` label-room test fails with `NaN`, not a geometry mismatch

`tests/unit/playtime-model.test.ts:526` asserts `layout.gutter - layout.labelPad >= 33.02`.
Reverting the whole file to `52e352e` makes this fail as `expected NaN to be greater than or
equal to 33.02` — because `labelPad` does not exist in the pre-fix layout, so the expression
is `32 - undefined`. The failure is correct but the message is unhelpful.

This matters only for the *whole-file* revert. I re-tested the mutation that actually
represents the regression — keeping `labelPad: 4` and reverting the geometry to
`gutter: 32` / `width: 626` — and the guard fires with a readable assertion
(`expected 28 to be greater than or equal to 33.02`), alongside two sibling failures
(cell `x` and the month-label `x` literals). **The guard is sound**; only the diagnostic
quality of the whole-file-revert path is weak. Noted for awareness, no change required.

### N-3 — the `forty-year model` perf assertion is a wall-clock flake this range does not fix

`tests/unit/playtime-model.test.ts:479` asserts `elapsed < 100`. My first full-suite run
failed it at **106.8 ms**; it passes in isolation (134 ms wall including transform) and a
second full run was 1356/1356 green. The 04-17 change to `playtime-model.ts` is comment and
layout-constant only (the diff contains no loop, allocation or `push`/`map`/`filter` change),
so this is machine-load sensitivity, not a regression. Flagged because `e9588d0` raised
`testTimeout` to 20 s but that setting **cannot** help this test — the assertion is a
sub-100 ms internal measurement, not a vitest timeout. A perf gate that tight on a loaded
10-core box will keep flaking independently of the reviewed work.

---

## WHAT I_VERIFIED_AND_CONFIRMED_CORRECT

### Gates run (all read-only; tracked tree restored after every mutation)

| Gate | Result |
|---|---|
| `pnpm run lint` (`prettier --check .` + `eslint .`) | pass — "All matched files use Prettier code style!" |
| `pnpm run check` (`tsc -b`) | pass, no output |
| `pnpm run build` | pass, built in 1.34 s |
| `pnpm run test:unit` (run 1) | 1355/1356 — one load flake, see N-3 |
| `pnpm run test:unit` (run 2) | **1356/1356 green** |
| `playwright tests/e2e/playtime-ui-review.spec.ts` | 4/4 pass (25.5 s, and 4/4 again on re-run) |
| `playwright tests/e2e/playtime-charts.spec.ts` | 18/18 pass |
| `playwright tests/e2e/playtime-real-shape.spec.ts` + `playtime-scale.spec.ts` | 7/7 pass |
| `playwright tests/e2e/finance.spec.ts` | 27/28 pass; 1 pre-existing failure (N-1) |

### 1. Correctness against the plans' must_haves

- **375px tile geometry (04-18).** `PlaytimeSummary.svelte:228-238` sets `flex-wrap: wrap`,
  `row-gap: 0`, `column-gap: 4px`, `overflow-wrap: normal` on the `dd`; `:249` sets
  `white-space: nowrap` on `.unit`. This is the only way to get the two acceptable outcomes
  the plan describes. Measured arithmetic in the code is self-consistent: the 375px shrunk
  measurement 66.9 + 33.6 + 4 = **104.5**, exactly the tile inner width, confirming the
  pair now wraps as a pair rather than breaking inside a numeral. (The plan quotes 76.5 px
  for the *unsunk* numeral; the summary quotes 66.9 px for the *shrunk* one. These are
  consistent, not contradictory.)
- **54-column calendar fit (04-17).** Re-derived from `playtime-model.ts`: `gutter 40 +
  pitch 11 × 54 = 634`; last column's right edge is `40 + 53×11 + 10 = 633 <= 634`; card
  content width is `672 − 32 = 640`. The SVG's `width` attribute is bound to
  `CALENDAR_LAYOUT.width` (`CalendarHeatmap.svelte:474`), so the re-derivation actually
  reaches the DOM. The 6 px of headroom the summary claims is real.
- **Legend note line placement (04-18).** `ChartLegend.svelte:63,68,113` — `flex-wrap: wrap`,
  `gap: 8px 4px` on the row, `flex-basis: 100%` on the note. Row gap 8 px, column gap 4 px,
  matching A-4. Browser-verified at both widths in both legends.
- **Focus-correction direction (04-17).** `focus-clear.ts:66` is now
  `window.scrollBy({ top: delta, behavior: 'instant' })`. A cell under the sticky chrome must
  move **down** on screen, which means scrolling the page **up**; a negative `delta` scrolls
  up, so the sign is right. The old `-delta` scrolled the page down and buried the cell.

### 2. Contract breakage

- **Amendments are append-only.** `git diff 52e352e..1a19b79 -- 04-UI-SPEC.md` contains
  **zero** removed lines. The superseded spec rows are retained as history with a dated
  pointer stating "Where the two disagree, the amendment governs" (line 84). A-1..A-4 are
  present at lines 479, 512, 541, 581.
- **No hex and no tables where forbidden.** Zero `#rrggbb` occurrences and zero `|` table
  rows in the whole amendments section. Values are expressed as `8px` / `gap: 8px 4px` /
  `minmax(128px, 1fr)`, i.e. by the spec's own vocabulary.
- **Unchanged parts of the spec are not violated.** A-3's `overflow-wrap: normal` on the
  tile `dd` is a scoped, justified exception, and the blanket untrusted-text rule is retained
  where it belongs: `PlaytimeSummary.svelte:274,284,326` still carry
  `overflow-wrap: anywhere` for the split table and the notes. The calibration argument in
  the A-3 comment (an `anywhere` flex item's minimum width is one character, which is what
  produced "2,46 / 7") is a correct description of CSS flex min-content sizing.
- **The nav-offset sticky-head rule is untouched** — `--nav-offset` still has exactly one
  declaration (`src/app.css:18`) and `CalendarHeatmap.svelte:690` still uses
  `top: calc(var(--nav-offset) - 16px)`.

### 3. Test quality — every new test was mutation-tested, not just read

This is the section I weighted most heavily, since a test that asserts a string constant
survives the bug it was written for. I reverted each fix **in the working tree**, ran the
suite, and restored, confirming a clean tree each time:

| Reverted fix | Correct pre-fix base | Result |
|---|---|---|
| focus-clear sign → `top: -delta` | `fd7412c^` | **6 failed** (4 behavioural, 2 source-shape pins) |
| tile `dd` + legend note CSS | `e9588d0` | **2 failed** (04-18 group) |
| calendar `gutter: 32, width: 626` (keeping `labelPad`) | hand-mutation | **3 failed** |
| `mtime` pin removed from the wrapper | hand-mutation | **2 failed** (both byte-reproducibility guards) |

All eight new/updated guards are load-bearing. Note that my first mutation attempt used
`6b5cbc5` as the "pre-fix" base for `focus-clear.ts` and the unit tests **passed** — because
`6b5cbc5` is a docs commit that already sits on top of the fix. I re-ran against the true
parent `fd7412c^` and the guards fired. Worth recording: a reviewer who trusted the range
boundary instead of the actual fix commit would have concluded these tests were worthless.

- **The two byte-reproducibility guards are genuine.** `tests/unit/sample-export-shape.test.ts`
  builds `buildSampleExport()` twice with a 2.5 s gap (2.5 s > fflate's 2 s DOS-time
  granularity, so the window is wide enough to catch the bug) and compares both the raw
  `Uint8Array` and its SHA-256. With the pin removed, both fail with differing digests. This
  is exactly the guard the review brief asked me to confirm, and it holds.

### 4. The flake fix (`f512f56`, `e9588d0`)

- **Root cause is correctly diagnosed.** The comment at `export-fixtures.ts:3-18` is
  technically correct: fflate stamps each local header with `Date.now()` when no `mtime` is
  given, and a `Date` the export body already writes (`SAMPLE_CREATED_AT`) is a defensible
  pin that makes the archive agree with its own contents. I confirmed the granularity claim
  empirically (see M-1).
- **The `...opts` spread order is the one real weakness** — M-2 above.
- **`e9588d0`'s 20 s `testTimeout` is defensible, not a mask.** It is a ceiling, not an
  expectation. The slowest legitimate test in the suite is `webserver-teardown.test.ts:128`
  with a 5 s wait; everything else is sub-second, and the two tests cited in the commit
  measured 770 ms and 512 ms in isolation. I re-ran the new sleep-based tests under the **old
  5 s default** (`--testTimeout=5000`) and all 10 passed in 6.14 s, so 20 s buys headroom
  without being load-bearing for any new test. The setting cannot mask a real hang, and the
  commit explicitly declines to relax any assertion.
- The two flakes are correctly kept distinct: the starvation flake gets a ceiling, the
  reproducibility defect gets a source fix plus a guard. That separation is right.

### 5. Regressions and invariants

- **No new runtime dependency.** `git diff 52e352e..1a19b79 -- package.json pnpm-lock.yaml`
  is **empty**. `fflate` was already a dependency; the wrapper calls the existing import.
- **No network, no CSP change.** `git diff 52e352e..1a19b79 -- index.html` is **empty**. No
  `fetch`/XHR/WebSocket/`sendBeacon` was introduced; the full unit suite including the
  zero-network guard (`tests/unit/zero-network-guard.test.ts`) passes in the 1356/1356 run.
- **Svelte 4 with runes, single Worker lifecycle.** No reactivity change: the 04-17/04-18
  source diffs are CSS declarations and one arithmetic sign. No Worker was added, nested or
  per-upload.
- **No personal data.** Nothing in the diffs introduces IPs, account IDs or names; the
  fixtures use the existing synthetic player.
- **No per-row SVG / unbounded DOM.** The calendar change is 3 numeric constants; cell count
  is unchanged, and the 04-18 tile change is two CSS declarations on an existing `dd`.
- **Phase 05 sharing is safe, and better than the summary claims.** `ChartLegend.svelte` is
  consumed only by `CalendarHeatmap.svelte:30` and `PlaytimeCharts.svelte:18` — both Phase 4.
  Phase 05's `FlowLegend.svelte` is a deliberate, documented copy (its header at
  `FlowLegend.svelte:7-17` explains why it is not a prop on `ChartLegend`), so the legend
  change cannot reach Phase 05 charts. `focus-clear.ts` is genuinely shared with Phase 05's
  `MonthlyBarChart.svelte:144`, and the sign fix repairs it without editing a Phase 05 file.

---

## OPEN_QUESTIONS

1. **Is the pre-existing `finance.spec.ts:1568` failure already known to the Phase 05 owner?**
   It is deterministic (3/3) and predates the reviewed range, so it is out of scope here — but
   it means the Phase 05 branch is not green, and 04-17-SUMMARY.md asserts otherwise. I did
   not investigate the Phase 05 cause (a null `tooltip.boundingBox()` on the first month of a
   twenty-year currency history); that belongs to whoever owns Phase 05.
2. **Should the fixture mtime pin be structural rather than positional?** M-1 and M-2 are both
   latent. Whether to close them now (export the wrapper, spread the pin last) or accept them
   as documented risk is a call for the phase owner; the tests I ran show no current breakage.
3. **Is the `forty-year model` 100 ms budget the right gate for this hardware?** N-3 failed
   once at 106.8 ms on a loaded run and passed otherwise. Tightening or loosening it is a
   judgement call outside this review's scope; I only note that `testTimeout` does not and
   cannot govern it.
4. **Is `04-17-SUMMARY.md:119`'s "30 passed" reproducible for any commit?** I could not
   reproduce a 30-test finance suite at any point in the reviewed range; the file has 28.
   I did not bisect when it was last 30, so I cannot say whether the count or the pass claim
   was wrong at authoring time or has since drifted.

---

*Read-only review. No project file was modified; `git status --porcelain` shows only the
pre-existing untracked `.planning/ui-reviews/04-20261002-synth/` and no tracked changes.*
