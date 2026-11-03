---
phase: 09-multi-account-import-account-identity
reviewed: 2026-10-17T17:45:18Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/lib/worker/classify.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/account-summary.ts
  - src/lib/core/types/worker-messages.ts
  - src/lib/shell/IdentityHeader.svelte
  - src/lib/shell/identity-model.ts
  - src/lib/shell/DashboardSection.svelte
  - src/lib/shell/Dashboard.svelte
  - src/lib/shell/overview-model.ts
  - src/lib/shell/selection-state.ts
  - src/lib/ui-copy.ts
  - src/app.css
  - src/lib/features/vehicles/VehicleTable.svelte
  - src/lib/features/vehicles/BattleTypeSummary.svelte
findings:
  critical: 1
  warning: 3
  info: 6
  total: 10
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-17T17:45:18Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 9 turns the single-account importer into an N-account importer: `analyzeExport`
resolves every account root in one linear pass, every inflated entry is resolved to
exactly one owner, every stored row is stamped with that owner, and the identity
header renders a list.

The parts that carry the privacy and correctness weight hold up well and I checked
them adversarially rather than by assumption:

- **The classifier is sound on ownership.** `resolveCsvFileOwner`'s strict
  first-segment (or wrapper-second-segment) rule for two or more roots is the right
  call, and the `stray`/fail-closed rule (`classify.ts:617-620`) means a
  single-resolved-root archive cannot contain a sibling folder, so the one-root
  delegation to `resolveCsvFileCategory` — which keeps v1.0's rightmost-`/root/`
  fallback — is **not** a cross-account hole. I tried to construct one and could not.
- **The per-account identity pools are correctly scoped.** `RootState` is a `Map`
  (never a plain object, so `__proto__`/`constructor` roots are safe), each row is
  pushed only into `stateOf(resolved.root)`'s own pools, and `extractIdentity` is
  handed that root's own pool with that root's own name
  (`ingest.worker.ts:1112-1120`, `1137-1159`). A row cannot present a sibling's
  nickname.
- **No raw cell reaches the header.** `AccountIdentity` is built only from rows that
  passed `sanitizeUserInfoRow`, and `toAccountSummary` carries exactly the five
  derived fields. The `data-error` / `playtime-error` channels still carry a name
  only.
- **IndexedDB transaction discipline is intact.** `writeDataset` keeps
  clear → chunked `bulkPut` → `meta.put` in one `rw` transaction over both stores
  (`db.ts:351-368`); `readSessionRowData` / `readLoginRowData` / `readRowsByFile`
  read meta and rows in one `r` transaction and echo the snapshot's `importedAt`;
  `writePlaytimeIfCurrent` / `writeLoginsIfCurrent` still refuse a stale write.
  The D-21 purge is scoped to `db.rows` alone, which is what keeps the
  "Not yet supported" counts intact.
- **The keyed-`{#each}` fix is correct and complete for its scope.** Keying by
  position in `VehicleTable.svelte:342` and `BattleTypeSummary.svelte:171` is the
  only shape that can render a repeated id/code, and the e2e proves a repeated id
  really is drawn.

The one BLOCKER below is a case where the code and its own documentation disagree,
and the documentation is the thing that will stop the next reader from fixing it.

I also ran the project's own gates as evidence: `pnpm run lint` clean,
`pnpm run check` clean (0 errors / 0 warnings / 313 files),
`vitest run tests/unit/import tests/unit/shell` → **1217 passed / 30 files**,
`playwright test --list` → **258 tests in 28 files** (the CI budget guard's ceiling
is 262, and the `30 / 32 / 40 min` triple in `ci.yml` / `playwright.config.ts`
matches the guard's pins).

## Critical Issues

### CR-01: The merged readers hand account B's rows to account A's header resolver — and `db.ts` documents that this cannot happen

**File:** `src/lib/worker/db.ts:746-773` (the claim), with the code it contradicts at
`src/lib/features/vehicles/vehicle-aggregate.ts:977` and `:1005`,
`src/lib/features/finance/finance-aggregate.ts:361`, `:536`, `:816`, and
`src/lib/features/device-info/device-info-aggregate.ts:287`.

**Issue:**

`readRowsByFile` deliberately merges every account's rows of one file into a single
bucket, and its docstring justifies that with an invariant that is false:

> The vehicles, finance, payments and device-info channels are builders over rows
> that carry no header to resolve, so merging them changes no parse — it changes only
> WHICH rows the pane shows.

They *do* resolve a header, and they resolve it from the **first merged row**:

```ts
// vehicle-aggregate.ts:977 (by_Type) and :1005 (main)
const byTypeFields = resolveFields(byTypeRows[0], [...TITLE_SPECS[title].raw, TYPE_FIELD]);
const fields       = resolveFields(mainRows[0],   spec.raw);

// resolveFields (vehicle-aggregate.ts:524) reads Object.keys(row) of that ONE row
// and maps each field id to a KEY STRING found on it.
```

`mapRow` then maps **every** row in the bucket — including the other account's —
through those key strings, and `cell(row, key)` is `row[key] === undefined` for a row
whose header differs (`csv-columns.ts:20-22`). So the second account's rows render
`{ t: 'x', v: 'missing' }` in every column, and D-09/D-25 word that as **"not in
export"** — a false claim about a file that is plainly in the archive, attached to
numbers that exist. `splitVehicleId(undefined)` also yields an empty vehicle name, so
those rows additionally draw as chrome (`VehicleTable.svelte:186`).

`finance-aggregate.ts` resolves columns from `rows[0]` in three places and
`device-info-aggregate.ts:287` enumerates `Object.keys(rows[0]!)`, so the Premium,
Currency, Spend and Device-info panes have the identical failure mode.

Before Phase 9 this could not happen: one account meant one header. Phase 9 is
exactly what put two accounts' rows in one bucket, and the phase's own reasoning
elsewhere in `db.ts` says so — the session and login readers were given a per-account
level **for this reason** (RESEARCH Pitfall 3):

> Two accounts can contribute the same file name — and in the real-shape export they
> do, with different headers — so grouping by file alone would resolve one account's
> columns against another's and silently EXCLUDE its sessions.

The vehicles / finance / device-info readers were left merged on the stated premise
that they carry no header to resolve. That premise is wrong, and because the comment
asserts it, a later reader auditing this will conclude there is nothing to fix here.

The three-account e2e fixture does not catch it: `buildRealShapeThreeAccountExport`
gives every root the same vehicle/statistics header, so the merged first row happens
to be a valid header for all of them. The unit fixtures are the same.

**Fix:**

Either close the gap or make the claim true. The cheap, honest minimum is to stop
the merged reader from resolving one account's header over another's:

```ts
// db.ts — inside readRowsByFile, before the bucket is built
// Detect a divergent header across the merged rows of one file and say so,
// rather than letting the first row's header stand in for all of them.
for (const row of matches) {
  if (bucket !== undefined && !sameHeader(bucket[0]!, row)) divergent.add(name);
  ...
}
```

and have `resolveFields` degrade to the "not in export" wording only when the *file*
is absent, never when it is present with a different header.

The correct fix, and the one the phase deferred to Phase 10 in spirit, is to give
`readRowsByFile` the same per-account grouping `readSessionRowData` already has, so
each account's rows resolve against their own first row. That is a bigger change;
it should at minimum be recorded as a known defect rather than asserted away.

---

## Warnings

### WR-01: Two readers of the same meta record disagree about how many accounts it holds

**File:** `src/lib/worker/db.ts:683-684`

**Issue:**

`accountsOfMeta` is documented as "the ONE normaliser that turns a stored meta record
into an account list", and it treats an **empty** `accounts` array as absent — it
falls through to the legacy fields and returns a one-entry list
(`account-summary.ts:192-205`). `readLoginRowData` re-derives the same two facts
inline and does not:

```ts
const accountCount = meta.accounts?.length ?? 1;   // [] -> 0, not 1
const onlyRoot = meta.accounts?.[0]?.root ?? meta.accountRoot;
```

For a record with `accounts: []` the two answers are `1` and `0`. The login rebuild
then produces **no Account record** while `resultFromMeta` publishes **one account
row** — a rebuild that answers less than the import did, which is the exact
disagreement this reader exists to prevent (its own docstring, `db.ts:553-560`).
The production import always writes a non-empty list, so this is latent rather than
live today — but the whole point of the normaliser is that no reader re-derives.

**Fix:** route both through the one normaliser.

```ts
import { accountsOfMeta } from './account-summary.ts';
// ...
const onlyAccount = accountsOfMeta(meta);
const accountCount = onlyAccount.length;
const onlyRoot = onlyAccount[0]?.root ?? meta.accountRoot;
```

---

### WR-02: `resolveAccountRoots` re-normalises the whole entry list once per root, so the "one linear pass" cost claim does not hold on the success path

**File:** `src/lib/worker/classify.ts:629-636` (and `MAX_ACCOUNT_ROOTS`'s docstring at `:70-79`)

**Issue:**

The bounds comment states:

> The cap is decided after ONE linear pass over the entry list and BEFORE any
> per-root category counting, so a 3,000-folder archive costs exactly what a
> 3-entry archive costs.

That is true of the *decision*. The success path is not what the comment implies:

```ts
roots: roots.map((root) => ({
  root,
  categories: sortCategoryEntries(countsToEntries(foldersAt(prefixOf(root), prepared))),
})),
```

`foldersAt` calls `prepare(paths)` (`classify.ts:215-217`), and `prepare` runs
`normalizeEntryPath` + `isOsMetadataEntry` over **every** entry. So a legal
32-root archive pays 32 full re-normalisations of the entry list, plus
`hasCsvUnderAnyRoot`, plus the `prepare` at the top of `analyzeExport`.

The bound is real and T-09-02 is still satisfied in the sense that matters (the
archive cannot make the work unbounded — 32 is a constant). But the comment reads as
a stronger claim than the code makes, and a reviewer checking the threat model
against the comment would sign off on something the code does not do.

**Fix:** prepare once and pass the prepared list down, or amend the comment to say
"one linear pass for the DECISION; the success path then costs one pass per surviving
root (at most `MAX_ACCOUNT_ROOTS`), which is what bounds it".

---

### WR-03: `classify.ts` casts where the module's own rule is "never a cast"

**File:** `src/lib/worker/classify.ts:1092`

**Issue:**

```ts
return { root: root as string, category, sourceFile };
```

`root` is `string | undefined` at that point only because both branches of the
`if / else if` assign it and the `else` returns. TypeScript's control-flow analysis
already narrows it to `string`, so the assertion is doing nothing except hiding the
invariant. The same file's `PlaytimeAggregates.v` contract is worded the other way
round — "a mismatch is an error, not a cast" — and `worker-messages.ts` repeats the
rule, so a reader of this module has been told twice that casts are not how this
code handles a value it is not sure of.

**Fix:** delete the assertion. If a future branch can leave `root` unset, the
compiler should say so.

---

## Info

### IN-01: `toAccountSummary` is not tolerant of a stored `AccountMeta` missing the Phase-9 fields, and the failure is a render crash

**File:** `src/lib/worker/account-summary.ts:153-161`, consumed at `src/lib/shell/identity-model.ts:118`

**Issue:** `accountsOfMeta`'s legacy branch fills `games`/`firstYear`/`lastYear`, but
its modern branch returns `meta.accounts` verbatim. `toAccountSummary` copies
`account.games` with no fallback, and `accountRows` then does `account.games.length`
— a record whose `accounts` entries predate the `games` field would throw inside a
`$derived` and blank the dashboard rather than render one row. The type says the
fields are required, so this is only reachable from a partially-written record; the
defensive read costs nothing next to the one already spent on the legacy shape.

**Fix:** `games: account.games ?? []`, `firstYear: account.firstYear ?? null`,
`lastYear: account.lastYear ?? null`.

### IN-02: The D-11 "N accounts combined" caption is on the section panes but not on the surfaces that show the same summed numbers

**File:** `src/lib/shell/DashboardSection.svelte:122`, `src/lib/shell/Dashboard.svelte:219`

**Issue:** the caption is applied to the six panes whose rows merge, which is right.
But `paneEntries` (`selection-state.ts:227`) and `overviewCards`
(`overview-model.ts:117`) render the *same* summed `rowCount` per section with no
marker at all. On the side-by-side layout the identity header sits above the list, so
the count is in view; on phone width the Overview is the detail screen and the header
is on the list screen the user navigated away from. UI-SPEC Surface 3 puts the count
on the Account card, which is on the same screen, so this is mitigated — but the
principle D-11 states ("a pane whose numbers merge every account's rows must say so")
is applied to one surface and not the three that show identical numbers.

### IN-03: `recomputeStatusCounts` silently drops a status the map version would count

**File:** `src/lib/worker/ingest.worker.ts:1274-1286`

**Issue:** `if (CATEGORY_STATUS_ORDER.includes(c.status)) out[c.status] += 1;` versus
`statusCountsOf`'s `statusCounts[entry.status] += 1` (`classify.ts:731-739`). Two
implementations of one tally, in two modules, with different behaviour on an input
the closed `CategoryStatus` union says cannot occur. The first writes a wrong count;
the second would write `NaN`. Neither is reachable today; the duplication is the risk,
and `classify.ts`'s header explicitly says one implementation exists for exactly this
reason.

**Fix:** export `statusCountsOf` and call it from `resultFromMeta`.

### IN-04: `ci.yml` still calls Playwright's `globalTimeout` "27 min" in the wrapper's own comment

**File:** `.github/workflows/ci.yml:180-183`

**Issue:** the block describing `timeout 32m playwright test` opens with "the shell
wrapper around Playwright's own `globalTimeout` (27 min)". The value is 30 min
(`playwright.config.ts:196`), raised by plan 09-06, and the guard pins 30 / 32 / 40.
The comment is stale, and it is the comment whose whole job is to explain the
ordering between the three limits.

### IN-05: `AccountSummary` reachability is documented three times over

**File:** `src/lib/core/types/worker-messages.ts:63-86`

**Issue:** the `accounts?` doc is ~25 lines of prose covering order, absence and
privacy — valuable, but it is now the third place that says "absent on a hand-built
result, so every consumer must tolerate its absence" (`account-summary.ts:180-190`,
`identity-model.ts:67-70`). The prose is not wrong, only load-bearing prose that will
drift. Worth a pointer comment on each of the other two rather than a fourth copy.

### IN-06: `tests/e2e/shell/multi-account.spec.ts` walks every pane but only scans the Vehicles pane for repeated keys

**File:** `tests/e2e/shell/multi-account.spec.ts:549-554`, `:570-609`

**Issue:** `every pane opens on the three-account dataset` opens all nine panes and
leak-scans each, and `the Vehicles pane renders the repeated ids and codes` proves the
positional key actually draws a duplicate. The other keyed blocks that Phase 9's
merge could collide (`PlayerStats.svelte:631` `(code)` over `view.battleTypes`,
`WorldMap.svelte:403` `(row.cc)`, `CountryList.svelte:64` `(row.cc)`,
`CityList.svelte:59` `(row.place)`) are covered only by "the pane opened and threw
nothing" — which is the right smoke assertion, and worth naming as such rather than
leaving the impression that the collision sweep was exhaustive.

---

## What I verified and found sound

Recorded so the next reader does not redo it:

- **No cross-account leak through `resolveCsvFileOwner`.** The `stray` rule
  (`classify.ts:617-620`) means every top-level folder is a root when at least one is,
  so the `roots.size === 1` delegation to `resolveCsvFileCategory` — which keeps v1.0's
  rightmost-`/root/` fallback — can never resolve a file into a sibling account. Tried
  to construct a counter-example (`A/1234/...` plus `A/Clans/1234/...`); classification
  rejects it with `no-recognized-category` first.
- **`readLoginRowData`'s account pool is scoped.** It filters by
  `accountOf(row, meta) !== onlyRoot`, so a stray User_Info-shaped row stamped with
  another root cannot describe the one account that is the dataset.
- **The D-18 skip does not blind the identity pick.** `User_Info` is `supported`, so
  `storeRows` is true and the per-root pools still fill; the skip only removes rows of
  non-supported categories.
- **`MAX_PRESENCE_FILES` is per account** (`ingest.worker.ts:1040-1050`), so one noisy
  root cannot starve a sibling's presence facts; the flattened top-level list is
  bounded by `MAX_PRESENCE_FILES * MAX_ACCOUNT_ROOTS`.
- **The CI budget arithmetic checks out.** `E = 330 + 5*(258-86-5-5-5-2) + 120 + 90 +
  13 + 32 = 1360 s`; floor `1768 s`; `ceil(1768/60) = 30 min`; wrapper `1920 s =
  1800 + 120`; job `2400 s = 1920 + 480`. `playwright test --list` reports exactly
  258 tests in 28 files, four under the ceiling.
- **`earliestCreated` cannot name a day the export did not write.** It range-checks
  month and day including leap February, keeps the first of a tie, and returns `null`
  (→ "unknown") when nothing parses. No `Date`, so no timezone shift.
- **No prototype pollution.** Root names are used as `Map` keys (`byRoot`,
  `stateOf`, `grouped` in both readers) and `Set` members (`rootNames`) throughout the
  Phase 9 code. `GAME_LONG_NAMES[token]` in `ui-copy.ts:601` is a plain object, but
  the token is upper-cased by `summarizeSessionSources` and can therefore never be
  `__proto__` or `constructor`.

---

_Reviewed: 2026-10-17T17:45:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_