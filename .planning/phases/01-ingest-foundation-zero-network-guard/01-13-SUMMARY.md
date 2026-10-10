---
phase: 01-ingest-foundation-zero-network-guard
plan: 13
subsystem: worker-ingest
tags: [identity, sanitiser, header-keyed-strip, privacy, tdd, gap-closure, cr-01]

# Dependency graph
requires:
  - phase: 01-ingest-foundation-zero-network-guard
    provides: "01-11 ambiguous-root fail-closed in classify.ts (CR-01 layer 1), whose residual shapes this plan closes at the persistence boundary"
provides:
  - "CR-01 layer 2 closed: the LOGIN / BIRTH_DATE / BIRTH_DATE_SRC strip is keyed on the column NAME a parsed row carries, so no persisted row in any category holds them whatever folder the file was filed under"
  - "hasSensitiveColumn(row) exported from identity.ts: own keys, same normalizeKey and DROPPED_COLUMN as the strip, never reads values, does not treat the overflow key alone as a trigger"
  - "buildMisfiledAccountInfoExport(), buildBeyondBoundNestExport() and RAGGED_OVERFLOW_MARKER test fixtures, built through the pinned zipSync"
  - "Worker-level proof from zip bytes to Dexie for four classification-accepted shapes, plus controls proving nothing else moved"
affects: [01-15 real-export check and e2e privacy spec, worker-ingest, identity]

# Actuals (#2632) - pairs with the plan's `estimate`; chars/4 over the realized diff (19,768 chars).
actuals:
  tokens: 4942
  tasks: 2
  commits: 3

plan_head_before: 803d7630526adf602906fd68f3ef87562bfff546
plan_head_after: aa5208088314ae02a7a8e0bf76e2adcc76cc37a6
commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header-keyed enforcement: a privacy strip triggers on the column names the parsed row actually carries, not on a classification result that an attacker-controlled folder name can steer"
    - "Narrow trigger, full sanitiser: the same function that drops the three columns also drops the overflow bucket, but only for rows that carry a deny-listed header or live in a User_Info-family folder"

key-files:
  created: []
  modified:
    - src/lib/worker/identity.ts
    - src/lib/worker/ingest.worker.ts
    - tests/fixtures/export-fixtures.ts
    - tests/unit/import/ingest-worker.test.ts
    - tests/unit/shell/identity.test.ts

key-decisions:
  - "03-CONTEXT D-18 is widened in practice from 'User_Info only' to 'any row carrying one of the three headers'. 03-CONTEXT.md itself is not edited; this SUMMARY is the traceable record of the amendment."
  - "The folder-name flag `userInfo` is kept for exactly two jobs: the always-sanitise family (overflow bucket dropped even with no deny-listed header) and the identity / Account-record pool. The pool push block is byte-identical, so a misfiled copy cannot change what the header shows."
  - "Rows with no deny-listed header outside a User_Info-family folder keep their __parsed_extra bucket (T-01-49 accepted, pinned by the ragged-row control): Phase 2's store-everything rule is not narrowed beyond the three columns."

patterns-established:
  - "Mutation checks recorded as evidence: one call-site mutation per control, reverted with a single-file checkout"

requirements-completed: [IMPORT-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "An Account_Info-shaped file filed under UserInfo, Weird/User_Info or Activity_history persists with no LOGIN, BIRTH_DATE or BIRTH_DATE_SRC key (any casing, padding or _N suffix) and neither the email domain nor the birth date anywhere in rows or meta; IP is still stored"
    requirement: "IMPORT-02"
    verification:
      - kind: integration
        ref: "tests/unit/import/ingest-worker.test.ts#01-13 - CR-01 layer 2: (a) Account_Info files filed under UserInfo, Weird/User_Info and Activity_history persist without LOGIN or birth columns"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rootless archive whose User_Info sits one level past the 01-11 depth bound (accepted by layer 1) persists without the three columns"
    requirement: "IMPORT-02"
    verification:
      - kind: integration
        ref: "tests/unit/import/ingest-worker.test.ts#01-13 - CR-01 layer 2: (b) a rootless archive whose User_Info sits beyond the 01-11 depth bound"
        status: pass
    human_judgment: false
  - id: D3
    description: "hasSensitiveColumn is true for padded, cased and _N variants of the three columns and false for LOGIN_DT, LOGIN_ID, LOGINS, BIRTH, an overflow-only row and a prototype-only name"
    requirement: "IMPORT-02"
    verification:
      - kind: unit
        ref: "tests/unit/shell/identity.test.ts#hasSensitiveColumn - the header-name trigger (CR-01 layer 2, plan 01-13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Controls: LOGIN_DT survives on Logins.csv rows, a ragged row with no deny-listed header keeps its __parsed_extra bucket, the real User_Info rows are stripped as before and the identity is unchanged"
    requirement: "IMPORT-02"
    verification:
      - kind: integration
        ref: "tests/unit/import/ingest-worker.test.ts#01-13 - CR-01 layer 2: (c) controls"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full unit suite including the logins, playtime and 60,000-session scale paths that run every row through the choke point; lint; typecheck"
    requirement: "IMPORT-02"
    verification:
      - kind: unit
        ref: "pnpm run test:unit (86 files, 2688 tests), pnpm run lint, pnpm run check"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-10-10
status: complete
---

# Phase 01 Plan 13: Header-keyed sensitive-column strip (CR-01 layer 2) Summary

**The worker's row choke point now calls the full sanitiser whenever a parsed row carries a LOGIN / BIRTH_DATE / BIRTH_DATE_SRC header (any casing, padding or `_N` suffix) or sits in a User_Info-family folder, so the email and birth data cannot rest in IndexedDB for any shape the classifier still accepts.**

## Performance

- **Duration:** about 8 min
- **Tasks:** 2 (Task 1 tracer, Task 2 auto; both TDD)
- **Commits:** 3 (RED, GREEN, tests)
- **Files modified:** 5 (2 source, 3 test/fixture)

## Accomplishments

- `hasSensitiveColumn(data)` added to `identity.ts`: iterates `Object.keys` (own enumerable keys only), runs each through the existing `normalizeKey` and the existing `DROPPED_COLUMN` regex, never reads a value. The regex line and the body of `sanitizeUserInfoRow` are untouched (`git diff` shows additions only in identity.ts).
- `ingest.worker.ts` row loop takes the parsed row once and sanitises when `userInfo || hasSensitiveColumn(raw)`; otherwise the parsed object is stored untouched. The identity-pool push (`if (userInfo) { ... }`) is unchanged, and the comments on the folder flag and the choke point now say the header test is the guarantee.
- Three accepted shapes proven from zip bytes to Dexie: a renamed folder (`UserInfo/`), a nest under an unknown folder inside a real account root (`Weird/User_Info/`), a supported category that is not User_Info (`Activity_history/Account_Info.csv`). A fourth, a rootless archive with `User_Info` at directory depth 5, is proven too.
- `src/lib/core/types/worker-messages.ts` is not modified (`git diff --stat` empty), so D-09 holds.

## Red-then-green evidence (TDD)

Task 1 (worker test, `pnpm exec vitest run tests/unit/import/ingest-worker.test.ts -t "01-13"`):

- RED (unmodified source), commit `e5c42e4`:
  `FAIL ... > 01-13 - CR-01 layer 2: the strip is keyed on the header, not the folder > (a) Account_Info files filed under UserInfo, Weird/User_Info and Activity_history persist without LOGIN or birth columns` - `AssertionError: key LOGIN: expected true to be false` - `Tests  1 failed | 58 skipped (59)`
  Semantic assessment: the terminal response was `done` and all three non-vacuity row counts were above zero before the failing assertion, so the failure is the deny-listed-key scan on a persisted misfiled row, which is the planned assertion for the intended reason (not a fixture, classification or setup fault).
- GREEN (after the identity.ts and ingest.worker.ts edit), commit `a8607d9`:
  `Test Files  1 passed (1)` - `Tests  1 passed | 58 skipped (59)`
  Companion run: `pnpm exec vitest run tests/unit/shell/identity.test.ts tests/unit/guards/sample-export-shape.test.ts` -> `Test Files  2 passed (2)`, `Tests  43 passed (43)`.
- Tracer gate: `AUTO_CFG` false, `human_verify_mode` end-of-phase, `<verify>` automated-only, so the verify was re-run end to end after GREEN and passed before Task 2 began.

Task 2 (commit `aa52080`): tests written against the Task 1 implementation, so they pass on first run. No RED was manufactured (see Deviations); non-vacuity is instead evidenced by the two mutation checks below.

## Mutation checks (recorded, then reverted with `git checkout -- src/lib/worker/ingest.worker.ts`)

1. Call `sanitizeUserInfoRow` on EVERY row (`const data = sanitizeUserInfoRow(raw);`): control `(c)` fails with `AssertionError: expected undefined to deeply equal [ 'CANARY-RAGGED-OVERFLOW-CELL' ]`; `Tests  1 failed | 2 passed | 58 skipped (61)`. This is the required ragged-row mutation check.
2. Folder-only trigger (the pre-fix behaviour, `userInfo ? sanitizeUserInfoRow(raw) : raw`): `(a)` and `(b)` fail; `Tests  2 failed | 1 passed | 58 skipped (61)`. This shows the beyond-bound test is not vacuous either.

After both, `git diff --stat -- src/lib/worker/ingest.worker.ts` was empty.

## Test counts

- Before this plan (HEAD `803d763`): `pnpm exec vitest run tests/unit` -> 86 files, 2661 tests.
- After: `pnpm run test:unit` -> 86 files, 2688 tests (+27: 3 worker-level, 24 pure-function cases).

## Task Commits

1. **Task 1 RED** - `e5c42e4` `test(01-13): RED - misfiled Account_Info files keep LOGIN through the real worker`
2. **Task 1 GREEN** - `a8607d9` `fix(01-13): key the LOGIN and birth-date strip on the header, not the folder`
3. **Task 2** - `aa52080` `test(01-13): pin the header-keyed strip with pure cases, the beyond-bound nest and controls`

## Verification

- `pnpm run test:unit` - exit 0, 86 files, 2688 tests passed (includes the 60,000-session scale import, the logins and playtime paths).
- `pnpm run lint` - exit 0 (prettier --check and eslint).
- `pnpm run check` - exit 0 (`tsc -b`, svelte-check 0 errors 0 warnings).
- `grep -c "export function hasSensitiveColumn" src/lib/worker/identity.ts` = 1; `grep -c "hasSensitiveColumn" src/lib/worker/ingest.worker.ts` = 2 (import and call); `grep -c "hasSensitiveColumn" tests/unit/shell/identity.test.ts` >= 3.
- `git diff --stat 803d763..HEAD -- src/lib/core/types/worker-messages.ts` is empty.
- No Playwright spec added or changed; `tests/e2e/shell/identity-privacy.spec.ts` is re-run by plan 01-15.

## D-18 widening (traceable amendment)

03-CONTEXT D-18 is written as "User_Info only": the three sensitive columns are dropped for rows of the User_Info category. The planning input that scoped this plan widens it to "any row carrying one of those headers", and this plan implements that widening: a row is fully sanitised (three columns AND the overflow bucket) when its folder is in the User_Info family OR it carries a deny-listed header. 03-CONTEXT.md itself is not edited. The one-way property D-18 already accepted (raw zip bytes are not retained, so a dropped column cannot be recovered without a re-import) now also covers misfiled files that carry the three headers.

## Deviations from Plan

### Auto-fixed Issues

None needing a Rule 1-4 fix.

### Process note

**Task 2 tests had no RED phase.** The pure-function and worker tests of Task 2 exercise `hasSensitiveColumn`, which Task 1's GREEN commit had already shipped, so they pass on first run by construction. Per tdd.md ("Test doesn't fail in RED phase: feature may already exist") this was investigated: the premise is that the predicate and call site belong to the Task 1 tracer, and Task 2 pins them at more levels. The mutation checks above are the non-vacuity evidence in place of a RED. No manufactured failure was committed.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change. T-01-48 mitigated (header trigger at the single choke point, proven for four accepted shapes); T-01-49 accepted and pinned (ragged row keeps `__parsed_extra`); T-01-50 accepted and unchanged (a column renamed outside the deny-list); T-01-51 mitigated (one pass over a row's own keys, full suite including the 60,000-session scale import green, suite duration unchanged at about 6 s).

## Deferred

Already-persisted misfiled rows from an earlier build are not migrated (plan rationale: `writeDataset` replaces the whole dataset on the next import and "Clear my cached data" removes it; a Dexie version bump would discard every returning user's cache for a hypothetical row).

## Self-Check: PASSED

- FOUND: src/lib/worker/identity.ts (`export function hasSensitiveColumn`), src/lib/worker/ingest.worker.ts, tests/fixtures/export-fixtures.ts (`buildMisfiledAccountInfoExport`, `buildBeyondBoundNestExport`, `RAGGED_OVERFLOW_MARKER`), tests/unit/import/ingest-worker.test.ts, tests/unit/shell/identity.test.ts
- FOUND commits (ancestors of HEAD): e5c42e4, a8607d9, aa52080
- STATE.md and ROADMAP.md untouched; `roadmap update-plan-progress` and `requirements mark-complete` not run (orchestrator owns tracking).
