---
phase: 03-dashboard-shell-account-identity
plan: 01
subsystem: worker-privacy
tags: [identity, privacy, dexie, worker, fixtures, indexdb-upgrade, csv-strip]
dependency_graph:
  requires: [phase-02-defensive-parsing-persistent-dataset]
  provides: [account-identity, d18-column-strip, dexie-v2-cache-wipe, phase-3-fixture-set]
  affects: [ingest-pipeline, worker-message-contract, identity-header, phase-3-ui-plans]
tech-stack:
  added: []
  patterns:
    - normalize-the-key-before-a-deny-list-match
    - sanitize-at-the-single-row-push
    - one-result-builder-for-every-replay-path
    - dexie-upgrade-to-discard-not-to-migrate
key-files:
  created:
    - src/lib/worker/identity.ts
    - tests/unit/identity.test.ts
  modified:
    - src/lib/types/worker-messages.ts
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - tests/fixtures/export-fixtures.ts
    - tests/unit/db.test.ts
    - tests/unit/ingest-worker.test.ts
decisions:
  - "D-17: the identity row is the Account_Info row whose ID equals the detected account root, falling back to row 1; Account_Info.csv rows outrank rows from other User_Info files"
  - "D-18: LOGIN / BIRTH_DATE / BIRTH_DATE_SRC are dropped at the single allRows push, matched on a trim+upper-case key with Papa's _N duplicate suffix allowed, and __parsed_extra is dropped with them"
  - "D-18: the category test is case-insensitive because classifyFolder is, so a user_info folder cannot skip the strip"
  - "D-19: Dexie version(2) with an unchanged store set plus an upgrade that clears rows then meta; the database name is NOT changed, or the emailed v1 store would be orphaned in the browser forever"
  - "D-20: the three-field identity is computed once in the worker, persisted on the meta record, and replayed by done, duplicate and cache-status through one resultFromMeta helper"
  - "identity null means no User_Info row was parsed (D-16 fallback); an object with null fields means a row parsed but the column was missing"
  - "AccountIdentity fields are string | null, not optional strings, so a missing value is distinguishable from a field this contract does not carry"
  - "sanitizeUserInfoRow rebuilds rows with Object.fromEntries, so a __proto__ header lands as an own data property and cannot reach the prototype chain"
  - "The rootless account (accountRoot === '') skips the ID match and falls back to row 1"
  - "Plan deviation: the long-unknown-folder fixture uses an unterminated '<b>bold_markup' rather than the specified '<b>bold</b>', because a zip entry name can never contain '/' — the path separator — and the name was silently truncated mid-tag"
metrics:
  duration: ~35min
  completed_date: 2026-09-29
  tokens: 78500
  tasks: 3
  commits: 7
  plan_head_before: b63f325
status: complete
---

# 03-01 Summary: Worker privacy core

## What was built

The worker-side half of the identity story. The account email and birth
data no longer reach IndexedDB, the three safe identity fields are computed
once in the worker, and any Phase 2 cache that already holds an email is
discarded on the user's next visit.

Everything the Phase 3 UI plans render — the identity header, the section
statuses, the return-visit path — reads from what this plan produces.

### Task 1 — strip, identity, and the meta replay

- `worker-messages.ts` gained `AccountIdentity` (`nickname`, `region`,
  `createdAt`, each `string | null`) and `ClassifyResult.identity`. No new
  message types: `done`, `duplicate` and `cache-status` already carried a
  `ClassifyResult`.
- `identity.ts` (new, pure, no worker globals) holds the three helpers the
  plan names: `isUserInfoCategory`, `sanitizeUserInfoRow`, `extractIdentity`.
- `db.ts` gained `DatasetMeta.identity` and a fifth **optional**
  `writeDataset` parameter, stored in the same `meta.put` inside the same
  transaction as the rows.
- `ingest.worker.ts` strips at the single `allRows.push`, extracts the
  identity from sanitised rows only, and builds both replay responses
  through one `resultFromMeta` helper.

Three RED-first tests drive the real worker and then read the Dexie
singleton it wrote: the posted identity, the absence of anything sensitive
at rest, and the `cache-status` / `duplicate` replay.

### Task 2 — hostile header shapes and the fixture set

`identity.test.ts` pins the drop list, non-mutation, `__proto__` safety,
the D-17 row choice and the hostile header shapes as pure functions.
Eleven worker-level cases prove the same properties survive the real parse
pipeline, over eleven new export fixtures — padded / lower-case /
duplicated / over-wide headers, a `user_info` folder, both folder casings
side by side, a decoy identity row, a missing folder, a header-only CSV,
long unbroken values.

All eleven builders derive from the canonical `sampleEntries()` through one
`buildCustomExport({ root, omitFolders, overrides })`, so each case varies
along exactly one axis and a change to the sample layout is never mirrored
by hand. `sampleEntries`, `SAMPLE_BADGE_ORDER` and every pre-existing
builder are untouched.

### Task 3 — Dexie v2 discards the emailed caches

`version(1)` became `version(2)` with the same store set plus an
`upgrade` that clears `rows` then `meta`. Both clears are awaited.

The upgrade test is a real guard, not a tautology: deleting the
`upgrade` callback makes exactly that one test fail with
`expected 1 to be +0`, which is the behaviour D-19 exists to change.

## Deviations from the plan

**1. The long-unknown-folder fixture could not be built as specified.**
The plan asked for a folder name containing the literal `<b>bold</b>`.
A zip entry name can never contain `/` — that is the path separator — and
the classifier was returning the name truncated to `..._<b>bold<`.
`LONG_UNKNOWN_FOLDER` is now an unterminated `<b>bold_markup`, which is
still markup that only becomes bold if a renderer interpolates the folder
name as HTML, and is representable in a zip. The Playwright leak/e2e
assertion in a later plan should reference the constant, not the old
string.

**2. One extra test surface beyond the plan's behaviour blocks.** The
plan's success criteria require every Phase 3 fixture to be exercised by at
least one test, but its Task 2 behaviour block names no worker case for
`buildMissingPaymentHistoryExport`, `buildZeroRowPaymentExport`,
`buildOnlySupportedExport` or `buildLongTextExport`. Four cases were added
so the criterion holds. They were added to the RED commit rather than the
GREEN one, so every Task 2 test still has a committed failing state.

**3. Two over-specified assertions in my own first draft were corrected
rather than implemented.** `isUserInfoCategory('user_info ')` (trailing
space) is not in the prescribed contract — `name.toLowerCase() ===
'user_info'` is — so the assertion was dropped rather than the
implementation widened. Same for a `SENSITIVE_KEY.test('LOGIN')`
self-check that asserted nothing about the system under test.

**4. The upgrade test needed a corrected `beforeEach`, twice.** Opening
the module singleton in that block creates the database at v2, which
leaves no versionchange transaction to observe — the test then passed for
a reason unrelated to the upgrader. The block now deletes without opening.
Separately, the "survives re-open" test had to move to its own describe
with the normal `delete + open`, because the no-open block leaves the
singleton closed.

## Key insights

**A deny-list has to normalise the key before it matches, or it is
decoration.** PapaParse does not trim header names, does not upper-case
them, renames a duplicate column to `LOGIN_1`, and routes cells beyond the
header into a `__parsed_extra` array that no column list inspects. Four
separate ways for the same email to survive, and the plan's fixture
exercises all four at once.

**`__parsed_extra` is the cheapest leak in the whole pipeline.** It is an
array, so a value-shaped deny-list cannot see it and a key-shaped one does
not either. Dropping the container rather than filtering its contents is
the only safe move.

**The strip and the identity share one normalisation rule, which is why
one is enough.** Because `pick` reads columns by the same trimmed
upper-cased key the strip drops by, a padded ` NAME ` and a lower-case
`region` are both stripped correctly *and* read correctly, with no second
set of rules to drift.

**A bare schema bump is not a data migration.** `version(2).stores(<same>)`
preserves every row; only an `upgrade` callback discards anything. The
value of the seeded-v1 test is that it fails for exactly the reason the
feature exists.

**Not opening the database can be load-bearing in a test.** Creating the
connection at the current version destroys the versionchange transition
the test exists to observe.

## Self-review

Two things I checked beyond the acceptance criteria:

- **The upgrade test is a real guard.** I deleted the `upgrade` callback,
  confirmed exactly one test failed with the data surviving, and restored
  it.
- **The whole suite, not just the touched files.** `pnpm exec vitest run`
  is 243/243 across 12 files, including the Phase 2 specs that share the
  fixtures file.

The plan-level `check` gate also caught a real type error that Task 2's own
verification command (`vitest` only) did not: the `__parsed_extra` literal
is an array of cells, which the all-string `Row` test type does not model.
It is now cast with a comment explaining that the runtime shape is the one
under test. This is the argument for running the plan-level
`lint && check && vitest` rather than each task's narrower command.

## Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run` (full suite) | PASS — 12 files, 244 tests |
| `pnpm run lint` (`prettier --check . && eslint .`) | PASS |
| `pnpm run check` (svelte-check x2 + tsc) | PASS — 0 errors, 0 warnings |
| `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` | PASS — no dependency added |
| `grep -c '^export function' src/lib/worker/identity.ts` | 3 (definition + 2 helpers + re-export counted as 3 `export function`) |
| `grep -c 'resultFromMeta' src/lib/worker/ingest.worker.ts` | 3 (definition + 2 call sites) |
| `grep -c 'version(2)' src/lib/worker/db.ts` | 2 |
| `grep -c 'export function build' tests/fixtures/export-fixtures.ts` | 30 (was 19, **+11**) |
| Remove the `upgrade` callback (manual probe) | The upgrade test fails `expected 1 to be +0` — the guard holds |

## Commits

| SHA | Task | What |
|---|---|---|
| `52b7c06` | 1 RED | Three failing worker tests: identity, no-leak, replay |
| `77c1c00` | 1 GREEN | `AccountIdentity`, `identity.ts`, meta identity, worker wiring |
| `ac6420c` | 2 RED | `identity.test.ts`, eleven worker cases, fixture constants + stubs |
| `1cbbf84` | 2 GREEN | The eleven fixture builders behind `buildCustomExport` |
| `a1578c1` | 3 RED | Seeded-v1 upgrade test (fails: data survives) |
| `dd69201` | 3 GREEN | Dexie `version(2)` + wiping upgrader; `__parsed_extra` type fix |

A final commit added a direct test for `buildCustomExport` itself, which
the ten wrappers only exercised transitively — the success criterion asks
for every fixture to be exercised, and a primitive that nothing names is
the one most likely to drift.

## Carried forward

- **Playwright specs assert retired markup** and are rewritten in the Wave
  3 plan (03-05/03-06 per RESEARCH Q6). Nothing in this plan runs them, so
  they are expected to be red until then.
- **`.claude/skills/run-data-export-viewer`** references retired test ids
  and the old account heading. The driver needs updating alongside the e2e
  rewrite, or the screenshot skill silently breaks.
- **The rootless-account copy decision** (RESEARCH Q3) — what the header
  shows when `accountRoot === ''` — is still unassigned to a plan. It
  belongs in 03-02's `ui-copy.ts` work.
- **A stale second tab** throws `DatabaseClosedError` after the v2 upgrade
  until it reloads. Accepted and documented in `db.ts`; worth a mention in
  the user-facing release notes if the tool is ever shared.
