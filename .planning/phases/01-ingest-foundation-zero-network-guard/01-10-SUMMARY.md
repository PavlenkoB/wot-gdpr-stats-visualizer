---
phase: 01-ingest-foundation-zero-network-guard
plan: 10
subsystem: docs
tags: [csp, playwright, chromium, no-sandbox, readme, skill-docs]

requires:
  - phase: 01-09
    provides: "vite.config.ts cspMeta plugin (build-time-only CSP meta injection) and the `tsc -b` project-reference graph behind `pnpm run check`"
provides:
  - "README.md Quick start: `pnpm run dev` injects no CSP meta tag, and the PLATFORM-02 zero-network assertion covers only `pnpm run build && pnpm run preview` (and CI), never the dev server"
  - ".claude/skills/run-data-export-viewer/driver.mjs: one-line comment above `chromium.launch({ args: ['--no-sandbox'] })` marking the flag as a dev-driver choice (flag itself unchanged)"
  - ".claude/skills/run-data-export-viewer/SKILL.md: new 'Driver sandbox flag' Gotcha explaining why the flag exists and why it is not an app-runtime concern"
  - ".claude/skills/run-data-export-viewer/SKILL.md: the stale 'test:e2e hangs after the last test passes' Gotcha reduced to a cross-reference at playwright.config.ts's direct-binary webServer.command and tests/unit/webserver-teardown.test.ts"
affects: [01-11, docs, run-data-export-viewer-skill, playwright-config, csp]

actuals:
  tokens: 1418
  tasks: 2
  commits: 2
plan_head_before: a497e390af22b3ba2a681c8d1d559d8146f63ab3

tech-stack:
  added: []
  patterns:
    - "Documentation-only gap closure: prose + a comment carry a finding, with the built artifact asserted unchanged to prove no behavior moved"

key-files:
  created: []
  modified:
    - README.md
    - .claude/skills/run-data-export-viewer/SKILL.md
    - .claude/skills/run-data-export-viewer/driver.mjs

key-decisions:
  - "One-line comment in driver.mjs rather than the plan's 4-line block: the plan's artifacts block and the execution contract both specify 'one-line', and the longer wording belongs in SKILL.md, which now carries it."
  - "Also fixed the two other places that still asserted the hang is live (the `## Test` snippet comment and the `## Troubleshooting` `pkill` workaround). Leaving them would have made the reduced Gotcha contradict itself; both now point at the regression test. This is the same WR-05 doc-drift area, and the plan's read_first names the Troubleshooting section."
  - "Kept the `pkill -f 'vite.js preview'` workaround out of the final file: the direct-binary webServer.command means the orphan it killed can no longer occur, so keeping it would teach a fix for a bug that is already fixed in code."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "README.md Quick start states that the dev server injects no CSP meta tag and that the zero-network assertion (PLATFORM-02) applies only to build/preview and CI, not to `pnpm run dev`"
    requirement: IN-04
    verification:
      - kind: other
        ref: "grep -q \"zero-network assertion\" README.md && grep -q \"pnpm run dev\" README.md (both match); README.md lines 28-38"
        status: pass
    human_judgment: false
  - id: D2
    description: "driver.mjs carries a comment above chromium.launch explaining the --no-sandbox flag, with the flag itself unchanged"
    requirement: IN-03
    verification:
      - kind: other
        ref: "grep -q \"Dev-driver only\" driver.mjs && grep -q \"'--no-sandbox'\" driver.mjs (both match); git diff --numstat -> `1\t0\tdriver.mjs` (one comment line added, zero removed, no logic change)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SKILL.md Gotchas documents the dev-driver sandbox flag, why it exists, and that it is not an app-runtime choice"
    requirement: IN-03
    verification:
      - kind: other
        ref: "grep -q \"Driver sandbox flag\" SKILL.md && grep -q \"'--no-sandbox'\" SKILL.md (both match)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The stale WR-05 e2e-teardown Gotcha is reduced to a cross-reference at playwright.config.ts (direct binary) and tests/unit/webserver-teardown.test.ts"
    requirement: WR-05
    verification:
      - kind: other
        ref: "grep -q \"tests/unit/webserver-teardown.test.ts\" SKILL.md && ! grep -q \"pnpm -> vite.js preview signal chain\" SKILL.md; residual literals 'vite.js preview' / 'pkill -f' / 'signal chain' return zero matches repo-wide in SKILL.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "No source-of-truth file changed: the plan touches docs plus one comment only, and the built runtime CSP is unchanged"
    requirement: WR-02
    verification:
      - kind: other
        ref: "git diff --name-only a497e39..HEAD -- src/ tests/ index.html vite.config.ts package.json tsconfig*.json playwright.config.ts eslint.config.js -> empty; pnpm run build exit 0 with grep -c \"default-src 'self'\" dist/index.html = 1 and grep -c \"connect-src 'none'\" dist/index.html = 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "The e2e suite (including the PLATFORM-02 zero-network spec) still passes against the edited tree"
    verification:
      - kind: e2e
        ref: "pnpm run test:e2e — NOT RUN: the environment override forbids it (Chromium cannot launch in this agent runtime; macOS Mach-port bootstrap_check_in is denied, so every spec dies at 0ms)"
        status: unknown
    human_judgment: true
    rationale: "The plan's Task 1 and Task 2 verify chains both end in `pnpm run test:e2e`, and both acceptance criteria list it. It cannot run in this runtime. The nearest available substitutes ran green and are recorded in Verification Evidence, but neither is the served-page assertion the spec performs: `pnpm run build` + the dist-level CSP greps (1/1, which is the exact artifact the spec's 'served HTML carries the CSP meta tag' test reads, minus the browser hop) and `pnpm run test:unit` (337 tests, which includes the tests/unit/webserver-teardown.test.ts regression test the SKILL.md cross-reference now points at). Note the class of failure is the same one the --no-sandbox flag documented in this very plan exists to work around. A human or CI on a normal runner should run `pnpm run test:e2e` to close D6."

duration: 3min
completed: 2026-09-30
status: complete
---

# Phase 01 Plan 10: Dev-Server CSP and Dev-Driver Sandbox Documentation Summary

**The dev server's lack of CSP is now stated as a deliberate limit of the zero-network guarantee, and the dev driver's `--no-sandbox` Chromium flag is documented in both the driver source and the skill that ships it.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-09-30T16:55:46Z
- **Completed:** 2026-09-30T16:58:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 markdown, 1 comment-only `.mjs`)

## Accomplishments

- **IN-04 closed.** README.md's Quick start no longer says only "no CSP meta applied" — it now says the CSP tag is build-time injected, so it exists only in `dist/`, and that the PLATFORM-02 zero-network assertion (`tests/e2e/zero-network.spec.ts`) covers `pnpm run build && pnpm run preview` and CI's e2e step but never `pnpm run dev`. A contributor running the dev server can no longer assume the guarantee they see in the built app.
- **IN-03 closed in code, with the flag intact.** `driver.mjs` gains exactly one line above `chromium.launch({ args: ['--no-sandbox'] })`. The diff is `1 0` — one comment line added, zero removed, zero logic changed. The flag is still there, which is what sandboxed agent runtimes (including this one) need.
- **IN-03 closed in the skill.** A new "Driver sandbox flag" Gotcha leads the Gotchas list, explaining the second-sandbox-layer failure mode, that it is a dev-driver choice rather than an app-runtime one (the shipped app never launches Chromium), and what to confirm before removing it.
- **WR-05 doc drift reduced.** The 19-line "test:e2e hangs after the last test passes" Gotcha — including its `pkill -f 'vite.js preview'` workaround and the `pnpm -> vite.js preview signal chain` explanation — is now a short cross-reference to `playwright.config.ts`'s direct-binary `webServer.command` and the `tests/unit/webserver-teardown.test.ts` regression test. The entry stays, so anyone who suspects the hang is back has somewhere to look.
- **Nothing moved that shouldn't have.** The built artifact still carries exactly one `default-src 'self'` and one `connect-src 'none'`; lint, typecheck, and 337 unit tests are green; no file under `src/`, `tests/`, or any build/CI config is in the plan's diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: README.md + driver.mjs comment (IN-03, IN-04)** — `d16e809` (docs)
2. **Task 2: SKILL.md — document `--no-sandbox` driver flag + reduce stale WR-05 Gotcha** — `81187d4` (docs)

## Files Created/Modified

- `README.md` — Quick start dev-server paragraph replaced: build-time-only CSP injection, and the explicit dev-vs-build/preview scoping of the zero-network assertion (PLATFORM-02, `tests/e2e/zero-network.spec.ts`).
- `.claude/skills/run-data-export-viewer/driver.mjs` — one comment line above the `chromium.launch` call. Comment only; `git diff --numstat` = `1 0`.
- `.claude/skills/run-data-export-viewer/SKILL.md` — new "Driver sandbox flag" Gotcha; WR-05 Gotcha reduced to a cross-reference; the `## Test` snippet comment and the `## Troubleshooting` hang entry repointed at the regression test. Frontmatter untouched; no other section restructured.

## Decisions Made

- **One-line comment, not the plan's four-line block.** The plan is internally inconsistent here (its `<action>` shows a 4-line comment, its acceptance criterion says "three-line", its `must_haves` artifact and the execution contract say one-line). I took the one-line reading and pushed the full explanation into SKILL.md, which is where a reader looks anyway. Content is identical in substance.
- **Two extra lines in SKILL.md beyond the named Gotcha.** The `## Test` snippet and the `## Troubleshooting` entry both still told the reader the hang is current and offered `pkill` as the fix. Reducing only the Gotcha would have left the file contradicting itself, which is the exact drift the plan exists to remove. Both edits are confined to the WR-05 area, and the plan's `read_first` names the Troubleshooting section.
- **Named PLATFORM-02 and the spec file in the README.** "Zero-network" alone is ambiguous in a public README; naming the assertion and its test file makes the note checkable rather than advisory.

## Deviations from Plan

None - plan executed as written. The one judgement call (comment length) and the two consistency edits in Task 2 are recorded under Decisions Made rather than as deviations; no file outside the plan's `files_modified` list was touched.

## Issues Encountered

- **`pnpm run test:e2e` was not run** (environment override: Chromium cannot launch in this agent runtime — macOS Mach-port `bootstrap_check_in` is denied, so every spec dies at 0 ms). Both tasks' verify chains and acceptance criteria list it. Substituted `pnpm run build` + the dist-level CSP greps and `pnpm run test:unit` (which includes the `webserver-teardown` regression test). Recorded as coverage entry D6 with `status: unknown` and `human_judgment: true`. Notably, the failure mode is the same class of problem the `--no-sandbox` flag this plan documents exists to work around.
- **The plan's premise that `pnpm run lint` formats these files is inaccurate for this repo.** `.prettierignore` lists `**/*.md` and `.claude/`, and `eslint.config.js` ignores `.claude/**`, so neither README.md, SKILL.md, nor driver.mjs is covered by `pnpm run lint`. The command exits 0, but that is a non-signal for these three files. Markdown was written to match the surrounding style (80-col wrapped, existing em-dash and backtick conventions) and the `.mjs` change is a comment on an untouched line, so no formatting risk is introduced either way.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Docs are consistent again; no code, test, or CI change is pending review. Phase 1 has no further code dependency on this plan.
- **One stale README number, deliberately left alone (out of scope):** the "Verifying the privacy guarantee" block still says `pnpm run test:unit # Vitest: 143 unit tests` and `pnpm run test:e2e # Playwright: 20 e2e tests`. The unit count is now 337 (measured this run). This plan's gap list is IN-03/IN-04 and neither is that count, so it was not touched — worth a one-line follow-up if the orchestrator wants README accuracy as a whole.
- **D6 needs a human or CI** on a runtime that can launch Chromium to close out `pnpm run test:e2e`. Nothing in the plan's own acceptance criteria depends on its result beyond that.

## Verification Evidence

All commands run from the repo root at `a497e39..81187d4`:

| Check | Result |
|-------|--------|
| `grep -q "zero-network assertion" README.md && grep -q "pnpm run dev" README.md` | exit 0 (both match) |
| `grep -q "Dev-driver only" driver.mjs && grep -q "'--no-sandbox'" driver.mjs` | exit 0 (both match) |
| `grep -q "Driver sandbox flag" SKILL.md && grep -q "'--no-sandbox'" SKILL.md` | exit 0 (both match) |
| `grep -q "tests/unit/webserver-teardown.test.ts" SKILL.md && ! grep -q "pnpm -> vite.js preview signal chain" SKILL.md` | exit 0 |
| residual stale literals in SKILL.md (`vite.js preview`, `pkill -f`, `signal chain`) | 0 matches |
| `git diff --numstat -- driver.mjs` | `1  0` — one comment line added, zero removed |
| `git diff --name-only a497e39..HEAD -- src/ tests/ index.html vite.config.ts package.json tsconfig*.json playwright.config.ts eslint.config.js` | empty (docs-only confirmed) |
| `git diff --name-only a497e39..HEAD` | `.claude/skills/run-data-export-viewer/SKILL.md`, `.claude/skills/run-data-export-viewer/driver.mjs`, `README.md` |
| `pnpm run build` | exit 0 |
| `grep -c "default-src 'self'" dist/index.html` | `1` |
| `grep -c "connect-src 'none'" dist/index.html` | `1` |
| `grep -c '&#39;' dist/index.html` | `0` |
| `pnpm run lint` | exit 0 (`prettier --check` + `eslint`) — see Issues: both ignore these three files |
| `pnpm run check` | exit 0 (`tsc -b`, no output) |
| `pnpm run test:unit` | exit 0 — 15 files, **337 passed** |
| `pnpm run test:e2e` | **not run** (environment override; see D6) |

## Self-Check: PASSED

- All 3 modified files exist on disk (checked with `[ -f ]`).
- Both task commits exist in history: `d16e809`, `81187d4`, both with the `(01-10)` scope token.
- `commits: 2` is measured from the persisted plan ledger (`plan_head_before: a497e390`, `git rev-list --count a497e390..HEAD` → 2), not narrated.
- No deletions in either commit (`git diff --diff-filter=D HEAD~1..HEAD` empty for both).
- No modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, or `.planning/state.json` by this plan (the two that show as modified were already dirty from the orchestrator and were never staged; `git status --short` after the final commit lists only those plus the two untracked files `playwright.scratch.config.ts` and `.planning/milestone.lock`, none of which were touched or committed).
- Every plan-level `<verification>` command was re-run after the final commit; the only one not satisfied is `pnpm run test:e2e`, which the environment forbids and which is recorded as D6 rather than reported as passing.

---
*Phase: 01-ingest-foundation-zero-network-guard*
*Completed: 2026-09-30*
