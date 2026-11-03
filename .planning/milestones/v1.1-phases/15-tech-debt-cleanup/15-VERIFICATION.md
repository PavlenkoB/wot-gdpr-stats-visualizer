---
phase: 15-tech-debt-cleanup
verified: 2026-11-01T11:10:53Z
status: passed
score: 9/9 must-haves verified (truth 9 accepted by owner)
covered_files: [".planning/phases/15-tech-debt-cleanup/15-01-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-01-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-02-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-02-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-03-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-03-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-04-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-04-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-05-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-05-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-06-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-06-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-07-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-07-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-08-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-08-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-09-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-09-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-10-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-10-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-11-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-11-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-12-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-12-SUMMARY.md", ".planning/phases/15-tech-debt-cleanup/15-13-PLAN.md", ".planning/phases/15-tech-debt-cleanup/15-13-SUMMARY.md", "README.md", "src/app.css", "src/lib/shell/ImportSummary.svelte", "src/lib/ui-copy.ts", "src/main.ts", "src/styles/shell.css", "src/styles/type.css", "src/styles/utilities.css", "tests/helpers/token-guards.ts", "tests/unit/guards/design-tokens-guards.test.ts", "tests/unit/shell/ui-copy.test.ts"]
covered_digest: "v3:sha256:a618bbdc04d714767a624f05d755ce20e9f3c1a7cbd48a002a91956ffc32085c"
behavior_unverified: 0
behavior_unverified_items: []
overrides_applied: 1
overrides:
  - truth: "No visible change (style equality)"
    reason: "Owner accepted the executor-recorded EQUAL evidence (15-STYLE-EQUALITY-EVIDENCE.md, commit 7df547b) on 2026-11-01 without a re-run"
gaps: []
deferred: []
human_verification: []
---

# Phase 15: tech-debt-cleanup Verification Report

**Phase Goal:** Close the v1.1 milestone-audit tech debt: add the `.t-note` / `.t-note-strong` roles (D-07), move the shell layout and phone block out of `src/app.css` (D-02), rename `.caption` / `.t-caption`, remove or adopt the orphaned `.btn` / `.t-body-strong`, and confirm the privacy copy covers the `wg-overview-pins` localStorage key. No visible change except where stated.
**Verified:** 2026-11-01T11:10:53Z
**Status:** passed (truth 9 accepted by the owner on 2026-11-01 on the recorded evidence; harness and e2e were not re-run by the verifier)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Privacy copy says the pinned Overview tiles stay in this browser and hold no export data (PRIV-02, audit warning) | VERIFIED | `src/lib/ui-copy.ts:187` `CONFIRM_CLEAR_MESSAGE` ends "Your pinned Overview tiles stay in this browser; they hold no export data." The first two sentences are unchanged vs baseline 2cb5359 (the diff appends one sentence and updates the comment). `src/App.svelte` imports and uses the constant. `tests/unit/shell/ui-copy.test.ts:3038` pins the claim. README lines 234-240 say the pinned-tile list survives Clear and Start over, in local storage under one key. |
| 2 | Shell layout and single phone block live in `src/styles/shell.css`; `app.css` holds element resets only | VERIFIED | `src/styles/shell.css` exists. `src/app.css` selectors are `:root, body, textarea, main, .link, a:focus-visible, h2, p, ul`, with no `@media` and no `.shell`/`.pane-*` selector. Exactly one `max-width: 480px` under `src/` (`src/styles/shell.css:115`). `src/main.ts` imports `./styles/shell.css` after `./app.css`. |
| 3 | `.t-note` (14/400/1.4) and `.t-note-strong` (14/600/1.4) exist and are adopted, with zero unmigrated 14px/1.4 sites | VERIFIED | `src/styles/type.css:59-70` defines both, each setting size, weight and line height from tokens. `tools/note-sites.mjs` reports `total: 0 in 0 file(s)`. An independent grep for `line-height: 1.4` outside `type.css`/`utilities.css` in `src/` returns nothing. Role consumers in `.svelte` class positions: `t-note` in 42 files, `t-note-strong` in 35 files. |
| 4 | Orphans `.btn` and `.t-body-strong` removed; no guard, comment or test names them | VERIFIED | `src/styles/utilities.css` holds only `.muted-note`, `.body`, `.error`, `.visually-hidden`, `.scroller`; no `.btn` rule. `t-body-strong` is absent from `type.css` (ten roles remain: hero, stat, title, display, heading, body, note, note-strong, caption, label). Grep of `src/` and `tests/` for `.btn` and `t-body-strong` returns nothing. Remaining `.btn` literals exist only in sketch HTML under `.claude/skills/sketch-findings-*/sources/` and `references/visual-language.md` (Info I2). |
| 5 | Stale `app.css` pointers fixed (14-D-02 / OI-11) | VERIFIED | `tools/stale-ref-scan.mjs` exits 0. Remaining `app.css` mentions in `src/` and `tests/` are accurate: element-reset readers (`contrast.test.ts`, `phase5-layout-guards`, `phase8-ui-review-guards`), and `identity-model.test.ts` asserts the phone block is singular and `.multi-title` is gone. `App.svelte:342` correctly says the shell layout is in `src/styles/shell.css`. One comment is still inaccurate (Info I1). |
| 6 | `.caption` utility renamed `.muted-note`; `.t-caption` role untouched | VERIFIED | `tools/class-token-scan.mjs caption src tests` reports 0 uses in 399 files; its selftest is OK. `.muted-note` is defined at `src/styles/utilities.css:23` and used in 31 files under `src/` and `tests/`. `src/lib/shell/ImportSummary.svelte:59` maps variant `caption` to `muted-note` explicitly; the `caption` variant value and test ids are kept. `.t-caption` remains in use across the Overview components. |
| 7 | G7 note-role guard live over the whole `src/` tree with no exemption; role-consumer guard present | VERIFIED | `tests/unit/guards/design-tokens-guards.test.ts:755` runs `noteRoleOffenders` over `SRC_FILES` and expects an empty result. Non-vacuity asserts at least 50 files, the shell stylesheet, and at least 40 styled components (lines 740-760). `roleConsumerOffenders` (`tests/helpers/token-guards.ts:377`) is asserted over the ten roles (line 806). The guards directory passes: 22 files, 450 tests. |
| 8 | Gates green and the tree is built on the planned baseline: `pnpm run check`, `pnpm run lint`, `pnpm run build` pass; `package.json` and `pnpm-lock.yaml` are byte-equal to 2cb5359; only the confirmation constant changed in `ui-copy.ts`; the Playwright listing is within the 273-test cap | VERIFIED | `pnpm run check` exit 0 (svelte-check, 363 files, 0 errors, 0 warnings). `pnpm run lint` exit 0. `pnpm run build` exit 0. `pnpm exec vitest run tests/unit/guards`: 22 files, 450 tests passed. `git diff 2cb5359 HEAD -- package.json pnpm-lock.yaml` is empty. `git diff 2cb5359 HEAD -- src/lib/ui-copy.ts` changes only the confirmation constant and its comment. `playwright test --list` reports 273 tests in 33 files. `git worktree list` shows only the main worktree, so the baseline worktree is gone. |
| 9 | No visible change except where stated: computed style, rect and pixels equal the baseline at six widths in the rest, open and tooltip states | PRESENT_BEHAVIOR_UNVERIFIED | `15-STYLE-EQUALITY-EVIDENCE.md` `## Final result` records EQUAL (0 differing elements, 0 differing screenshots) at commit 7df547b. No `src/` or `tests/` file has changed since that commit. The verifier did not re-run the harness, and the record was written by the executor. See `behavior_unverified_items` and the Human Verification section. |

**Score:** 8/9 truths verified (1 present but behavior-unverified, 0 overrides)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/styles/shell.css` | Shell layout and the one phone block | VERIFIED | Exists; single 480px query at line 115; imported by `src/main.ts`. |
| `src/styles/type.css` | Ten roles incl. `.t-note`, `.t-note-strong` | VERIFIED | Lines 59-70 define the pair with token-driven size, weight and line height. |
| `src/styles/utilities.css` | `.muted-note` utility; no `.btn` | VERIFIED | `.muted-note` at line 23; `.btn` absent. |
| `src/lib/ui-copy.ts` | `CONFIRM_CLEAR_MESSAGE` with pins sentence | VERIFIED | Line 187. |
| `tests/unit/shell/ui-copy.test.ts` | Pins-sentence test | VERIFIED | Line 3038 asserts `pinned Overview tiles`. |
| `tests/helpers/token-guards.ts` | `noteRoleOffenders`, `roleConsumerOffenders` | VERIFIED | Both exported; used by the guard file. |
| `tests/unit/guards/design-tokens-guards.test.ts` | Whole-tree G7 sweep and role-consumer guard | VERIFIED | Sweep at line 755; role-consumer check at line 806. |
| `README.md` | Caveat names the pinned-tile list | VERIFIED | Lines 234-240. |
| `src/app.css` | Element resets only | VERIFIED | Selectors listed under Truth 2; no media query. |
| `.planning/phases/15-tech-debt-cleanup/tools/*.mjs` | Harness, note-sites, class-token and stale-ref scanners | VERIFIED | `note-sites` total 0; `class-token-scan` selftest OK; `stale-ref-scan` exit 0. The equality harness exists and was not run (Truth 9). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/App.svelte` | `src/lib/ui-copy.ts` | `CONFIRM_CLEAR_MESSAGE` import | WIRED | Import at `App.svelte:7`, used in the confirm flows. |
| `src/main.ts` | `src/styles/shell.css` | import after `./app.css` | WIRED | `main.ts:5`. |
| `src/lib/shell/UnsupportedBlock.svelte` | `src/styles/type.css` | class `t-note-strong` | WIRED | Tracer site from plan 15-01. |
| `src/lib/shell/ImportSummary.svelte` | `src/styles/utilities.css` | variant `caption` maps to `muted-note` | WIRED | `ImportSummary.svelte:59`. |
| `src/lib/shell/IdentityHeader.svelte` | `src/styles/type.css` | role swap for ID-only rows | WIRED | Role classes in markup (plan 15-06). |
| `tests/unit/guards/design-tokens-guards.test.ts` | `tests/helpers/token-guards.ts` | `noteRoleOffenders` over `SRC_FILES` | WIRED | Line 755. |

### Data-Flow Trace (Level 4)

Not applicable. This phase changes class names, type declarations, copy and guards. It renders no new dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Type check and svelte-check clean | `pnpm run check` | exit 0, 0 errors, 0 warnings | PASS |
| Formatting and ESLint clean | `pnpm run lint` | exit 0 | PASS |
| Production build | `pnpm run build` | exit 0 | PASS |
| Guards directory | `pnpm exec vitest run tests/unit/guards` | 22 files, 450 tests passed | PASS |
| G7 guard and ui-copy test | `pnpm exec vitest run tests/unit/guards/design-tokens-guards.test.ts tests/unit/shell/ui-copy.test.ts` | 2 files, 377 tests passed | PASS |
| Playwright test count within cap | `pnpm exec playwright test --list` | 273 tests in 33 files | PASS |
| No unmigrated note sites | `node .planning/phases/15-tech-debt-cleanup/tools/note-sites.mjs` | total 0 | PASS |
| No residual `caption` class token | `node .planning/phases/15-tech-debt-cleanup/tools/class-token-scan.mjs caption src tests` | 0 uses | PASS |
| Stale `app.css` pointers | `node .planning/phases/15-tech-debt-cleanup/tools/stale-ref-scan.mjs` | exit 0 | PASS |
| Visual equality at six widths | `node .planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs check` | NOT RUN (browser harness, scoped out) | ? SKIP, routed to human |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes are declared for this phase. Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PRIV-02 | none declared (audit item) | Privacy copy covers the `wg-overview-pins` localStorage key | SATISFIED | Truth 1: confirmation copy and README now name the pinned tiles. The v1.1 audit rated PRIV-02 PARTIAL on exactly this point. |

No orphaned requirements. Phase 15 plans declare `requirements: []`, and REQUIREMENTS.md has no phase-15 IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/unit/guards/phase8-shell-guards.test.ts` | 138 | Comment says "`src/app.css` holds no declaration at all any more" | Info | Inaccurate: `app.css` holds element resets. The assertion itself is unaffected. |
| `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/sources/**`, `references/visual-language.md` | various | Literal `.btn` rules in sketch HTML | Info | Historical sketch sources, not app code. Outside the orphan-removal scope. |

Debt-marker gate (TBD / FIXME / XXX) over every file this phase touched: no markers. Gate passes.

### Human Verification Required

#### 1. Visual equality harness

**Test:** `node .planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs check`, after recapturing the baseline from commit 2cb5359 as `15-STYLE-EQUALITY-EVIDENCE.md` describes.
**Expected:** EQUAL at all six widths in the rest, open and tooltip states, with 0 differing elements and 0 differing screenshots.
**Why human:** Needs a browser, a preview server and a baseline worktree. Scoped out of this light-check pass. The only result on record is the executor-written evidence at 7df547b.

#### 2. Full Playwright suite including zero-network specs

**Test:** `pnpm run test:e2e`
**Expected:** All 273 listed tests pass, and no request is made after page load.
**Why human:** Browser-driven and load-flaky. This pass confirmed the listing count only, not the run.

### Warnings

**W1. Visual-equality claim is unverified by this pass.** Truth 9 rests on the committed record at 7df547b. No `src/` or `tests/` file has changed since that commit, so the record applies to the final tree, but the verifier did not reproduce it.

### Info

- **I1.** `tests/unit/guards/phase8-shell-guards.test.ts:138` comment misdescribes `app.css` as holding no declaration. Comment-only fix, recommended for the next touch of that file.
- **I2.** `.btn` literals remain in sketch-findings source HTML and `visual-language.md`. These are design-history artifacts, not app code, so they do not reopen the orphan removal.
- **I3.** The v1.1 audit's other tech-debt item (ROADMAP.md still lists v1.1 as Phases 9-12) is outside phase 15 scope and was not verified here.

### Gaps Summary

No gaps. All eight gate, copy, structure and guard truths hold in the codebase. The one open item is Truth 9 (visual equality), which needs a browser run and is routed to human verification. The phase is not blocked by any failed truth.

---

_Verified: 2026-11-01T11:10:53Z_
_Verifier: Claude (gsd-verifier)_
