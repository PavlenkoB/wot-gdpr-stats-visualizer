---
phase: 01-ingest-foundation-zero-network-guard
type: supersession-record
created: 2026-10-10
status: unsigned
source: 01-VERIFICATION.md gaps G1 to G6 (Override Suggestions O-1 to O-6)
produced_by: plan 01-12 (gap closure, documentation only)
executed_plans_modified: none
executed_summaries_appended: [01-01, 01-02, 01-04, 01-05, 01-08, 01-09, 01-10]
---

# Phase 01 Supersession Record (G1 to G6)

## How to use this record

This document is evidence, not a fix. It changes no behaviour. It collects, in one place, the
six groups of must-have rows that `01-VERIFICATION.md` reports as FAILED because a LATER phase
changed the value on purpose (eleven literal rows, six groups). For each group it states the
must-have as the verification report quotes it, where it came from, what superseded it and why,
the file and line that prove the current value, and one read-only command that re-proves it.
Every file and line below was re-checked with grep or a direct read when this document was
written (2026-10-10), not copied from the verification report.

What this record does NOT do:

- It does not edit `01-VERIFICATION.md`. That report keeps `status: gaps_found` and
  `overrides_applied: 0` until a human decides.
- It does not edit any executed `01-NN-PLAN.md`, any source file, any test, the workflow or any
  config. Runtime behaviour is untouched: the CSP `connect-src` stays `'self'`, the CI push
  trigger stays `branches: [main]`, the `check` script keeps its svelte-check pass.
- It does not accept anything. An override needs a named human who accepted it. The override
  block at the end of this document is UNSIGNED: both `accepted_by` and `accepted_at` are empty
  strings in all six entries and stay that way until the person who accepts each entry fills
  them, either at the plan 01-15 decision checkpoint or by hand.

A caveat the signer should weigh. `.claude/gsd-core/references/verification-overrides.md` says
that more than two or three overrides for one phase is a signal to revisit the plan text instead
of overriding in bulk. This record has six groups. The alternative to signing the block is to
correct the must-have wording of the executed plans (and ROADMAP SC4) in a separate,
user-authorised follow-up. ROADMAP success criterion 4 (`.planning/ROADMAP.md` line 36) still
reads "CI runs lint, typecheck, Vitest, and Playwright on every push", and changing that wording
is the user's call, not something this plan does.

The seven executed SUMMARY files that assert superseded values each carry an appended
correction section (listed at the end) that points back here, so a reader of a summary reaches
this evidence. Nothing above those sections was rewritten.

A note on provenance. The per-plan commit hashes cited inside the old summaries (for example
`cd38ed7`, `950830d`) are not resolvable in this repository: Phase 01 history was squashed into
`9689001`. The file and line evidence below is therefore taken from the current tree, and the
commit ids cited as "superseded by" are ones that DO resolve (for example `50f9f5c`,
`2ef027c`) or are phase plan ids whose PLAN and SUMMARY files exist under `.planning/phases/`.

---

### G1 — Idle-and-ready worker error no longer marks the worker broken (O-1)

**Must-have as 01-VERIFICATION.md quotes it:** "Plan 01-08 truth 1: an onerror while the client
is idle AND ready marks the worker broken, so a later submitFiles() fails fast without
postMessage".

**Came from:** executed plan 01-08, truth 1 (`01-08-PLAN.md`), reported as done in
`01-08-SUMMARY.md` (frontmatter `provides` and "WR-01 closed", plus the verification-table rows
built on it).

**Superseded by:** Phase 4 plan 04-07 (`.planning/phases/04-activity-time-dashboards/04-07-PLAN.md`
and `04-07-SUMMARY.md`). The code comment in `worker-client.svelte.ts` says so directly: an
`onerror` while idle and ready is not treated as a dead worker, because a real Worker can
survive an error event and serve new traffic; the WR-01 hang depends on the worker actually
being dead, which is not the same as an `onerror` having fired. Only the pre-ready branch marks
the client broken. The 04-07 tests pin the reversal.

**Current proof:**

| File | Line | Value |
|------|------|-------|
| `src/lib/import/worker-client.svelte.ts` | 225 | `this.#worker.onerror = (event) => {` |
| `src/lib/import/worker-client.svelte.ts` | 230-250 | comment: "Phase 4 (04-07) won the merge against WR-01 ... Idle+ready is the pre-04-07 nothing case, retained as an informational log" |
| `src/lib/import/worker-client.svelte.ts` | 261 | `} else if (!this.workerReady) {` (the only branch that reaches the flag) |
| `src/lib/import/worker-client.svelte.ts` | 266 | `this.#workerBroken = true;` (inside that pre-ready branch only) |
| `tests/unit/import/ingest-client.test.ts` | 1608 | `test('a worker error while idle and ready leaves the ingest machine exactly as it was', ...` |
| `tests/unit/import/ingest-client.test.ts` | 1887 | `test('a worker that is idle and ready is not marked broken: queries still work after an error', ...` |

**Observation, not a change.** The test name `01-08-SUMMARY.md` cites ("onerror while idle AND
ready: a later submitFiles fails fast without posting (WR-01)") is not in the suite (grep count
0). Two stale comments in the same file still describe the pre-04-07 contract and were left
alone because this plan changes no source: the class docstring at lines 64-66 ("marks
#workerBroken — before OR after 'ready' (WR-01)") and the guard comment at lines 474-480 ("set
by EVERY worker error event, including one that lands between submissions while the client is
idle and ready"). The submit-time guard itself (`if (this.#workerBroken)`, line 493) is still
there and still correct for the pre-ready case.

**Advisory that stays open:** a worker that dies AFTER `ready` is still not detected
(`01-REVIEW.md` WR-04 at line 170 and WR-05 at line 176; recorded as deferred in
`01-15-PLAN.md` lines 106-107). Accepting O-1 accepts the Phase 4 reversal; it does not resolve
that advisory.

**Re-prove (read-only):**

```
sed -n '259,268p' src/lib/import/worker-client.svelte.ts
grep -n "a worker error while idle and ready leaves the ingest machine exactly as it was\|a worker that is idle and ready is not marked broken" tests/unit/import/ingest-client.test.ts
grep -c "onerror while idle AND ready" tests/unit/import/ingest-client.test.ts   # expect 0
```

---

### G2 — CSP meta carries connect-src 'self', not 'none' (O-2)

**Must-have as 01-VERIFICATION.md quotes it:** "Plan 01-01 truth 5 and plan 01-10 truth 4: CSP
meta carries connect-src 'none' and the app's runtime CSP is unchanged".

**Came from:** executed plan 01-01 truth 5 ("dist/index.html contains a Content-Security-Policy
meta tag with default-src 'self' and connect-src 'none', placed before the module script and any
stylesheet link") and plan 01-10 truth 4 (the runtime CSP unchanged by the docs plan). The same
literal also appears in plan 01-09 truth 6 and in the build-and-grep rows of the 01-09 and 01-10
summaries; those are historical measurements of a build that no longer exists.

**Superseded by:** Phase 6 plan 06-11 (`06-11-PLAN.md`, `06-11-SUMMARY.md`, decision D-16). The
product now makes exactly one sanctioned request after load: the opt-in same-origin city file,
issued from the main thread after an explicit click. `connect-src` is therefore `'self'`. The
reason is documented in `vite.config.ts` and in `AGENTS.md`: a meta CSP is blind to worker
traffic (a main-thread fetch was blocked, a module-worker fetch returned 200 under `'none'`),
so the directive was only ever defence in depth; the enforcement is the ESLint network ban plus
the Playwright request assertions. `default-src 'self'`, the other three directives and the
placement before the module script are unchanged.

**Current proof:**

| File | Line | Value |
|------|------|-------|
| `vite.config.ts` | 14-28 | doc block "`connect-src 'self'` (plan 06-11, D-16) — defence in depth, NOT the guard" |
| `vite.config.ts` | 39 | `"default-src 'self'",` |
| `vite.config.ts` | 40 | `"connect-src 'self'",` |
| `AGENTS.md` | 73 | "Since plan 06-11 the shipped directive is `connect-src 'self'` (previously `'none'`)" |
| `tests/e2e/guards/zero-network.spec.ts` | 95 | test title "served HTML carries the CSP meta tag with connect-src exactly 'self' and every other directive unchanged" |
| `tests/e2e/guards/zero-network.spec.ts` | 118 | `expect(directives.get('connect-src')).toBe("'self'");` |

**Re-prove (read-only):**

```
sed -n '38,44p' vite.config.ts
grep -n "connect-src" tests/e2e/guards/zero-network.spec.ts | sed -n 1,8p
grep -c "connect-src 'none'" vite.config.ts   # only prose mentions of the old value remain (doc block), never a directive
```

---

### G3 — Account heading, summary line and flat badge list were replaced in Phase 3 (O-3)

**Must-have as 01-VERIFICATION.md quotes it:** "Plan 01-01 truth 1, plan 01-04 truth 5, plan
01-05 truths 3 and 5: success UI shows heading 'Account: <root>', summary '4 supported ·
2 known-deferred · 2 unknown', and a flat badge list via ResultsView.svelte /
CategoryBadge.svelte".

**Came from:** executed plan 01-01 truth 1 (heading "Account: 123456789"), plan 01-04 truth 5
(valid export after a failure shows 'Account: 123456789'), plan 01-05 truth 3 (heading, summary
line and one flat badge list in a fixed order) and truth 5 (renamed-root heading and the
"4 supported · 2 known-deferred · 3 unknown" summary).

**Superseded by:** Phase 3. Plan 03-04 (decision D-23) retired `ResultsView.svelte` and
`CategoryBadge.svelte` (`03-04-SUMMARY.md` lines 62, 88-89; the deleting commit is `2ef027c`).
Plan 03-07 (requirement IDENTITY-01) deleted the helpers `formatSummary` and
`formatAccountHeading` once the specs that imported them were re-pointed at the dashboard
(`03-07-SUMMARY.md` lines 26 and 129; `ui-copy.ts` line 198). The account root is now shown as
"Account ID: <root>" by `IdentityHeader.svelte`, and per-category status is rendered by the
dashboard sections with a `data-status` attribute. The substance the old rows protected (root
detected inside the worker, categories sorted, a renamed root shows the unknown folder) is
still exercised by the passing import-flow e2e spec and the unit suite; only the literal
wording and component names are superseded.

**Current proof:**

| File | Line | Value |
|------|------|-------|
| `src/lib/ui-copy.ts` | 198 | "(`formatSummary`, `formatAccountHeading`) was deleted in Plan 03-07," |
| `src/lib/ui-copy.ts` | 434 | "Replaces `formatAccountHeading`'s "Account: …" wording" |
| `src/lib/ui-copy.ts` | 443-445 | `export function formatAccountId(root: string): string { return \`Account ID: ${root}\`; }` |
| `src/lib/shell/IdentityHeader.svelte` | 112 | `{formatAccountId(result?.accountRoot ?? '')}` |
| `src/lib/shell/DashboardSection.svelte` | 85 | `data-status={status}` |
| `src/lib/shell/UnsupportedBlock.svelte` | (file) | renders the known-deferred and unknown folders |
| `src/lib/components/` | (dir) | does not exist; no `ResultsView*` or `CategoryBadge*` file anywhere under `src/` |

**Re-prove (read-only):**

```
sed -n '443,445p' src/lib/ui-copy.ts
grep -n "formatAccountId" src/lib/shell/IdentityHeader.svelte
find src -name 'ResultsView*' -o -name 'CategoryBadge*'   # expect no output
grep -n "data-status={status}" src/lib/shell/DashboardSection.svelte
```

---

### G4 — The long-task bound is 1000 ms, not 250 ms (O-4)

**Must-have as 01-VERIFICATION.md quotes it:** "Plan 01-05 truth 7: no main-thread long task of
250 ms or more between submission and results, on a 20,000-entry export".

**Came from:** executed plan 01-05 truth 7 ("Importing a 20,000-entry synthetic export produces
no main-thread long task of 250 ms or more between submission and results"; the e2e reference
in `01-05-SUMMARY.md` line 167 is `offenders.filter(duration>=250) === []`).

**Superseded by:** a later edit to the e2e spec itself, recorded in its own comment. The
measured cost that exceeded 250 ms was the Playwright harness, not the app:
`setInputFiles({ buffer })` makes Playwright decode the whole 3.6 MB payload on the page's main
thread and dispatch `change` only at the end of that task. The app's own unzip measures about
19 ms. The bound was relaxed to 1000 ms as a backstop for a gross block (an O(n^2) pass or the
pipeline landing on the main thread), with the reason written beside it. Re-measuring with the
mark placed after the dispatch, so the harness cost falls outside the window, is the alternative
way to restore 250 ms; it is not done here.

**Current proof:**

| File | Line | Value |
|------|------|-------|
| `tests/e2e/import/import-flow.spec.ts` | 59-60 | header: "At 20,000 entries, no main-thread long task of 1000 ms or more occurs between submission and the dashboard" |
| `tests/e2e/import/import-flow.spec.ts` | 460 | section title "(f) Responsiveness — no main-thread long task ≥ 1000 ms at 20,000 entries" |
| `tests/e2e/import/import-flow.spec.ts` | 535-542 | comment: harness `setInputFiles` decode, "the 1000 ms bound was relaxed from the original 250 ms for a cost that was the harness's" |
| `tests/e2e/import/import-flow.spec.ts` | 552 | `.filter((t) => t.startTime >= mark && t.duration >= 1000)` |

**Re-prove (read-only):**

```
sed -n '548,555p' tests/e2e/import/import-flow.spec.ts
grep -n "relaxed from the original 250 ms" tests/e2e/import/import-flow.spec.ts
```

---

### G5 — CI push trigger is restricted to main (O-5)

**Must-have as 01-VERIFICATION.md quotes it:** "Plan 01-02 truth 8 and ROADMAP SC4: CI runs
lint, typecheck, Vitest and Playwright on every push".

**Came from:** executed plan 01-02 truth 7 as numbered in the plan file (".github/workflows/ci.yml
runs on every push and every pull_request ...", reported as truth 8 in the verification table),
and ROADMAP success criterion 4 (`.planning/ROADMAP.md` line 36; the plan list at line 46 and the
overview at line 5 use the same "on every push" wording).

**Superseded by:** a later edit to `.github/workflows/ci.yml`. The header comment records it as a
deliberate trade-off: push is restricted to `main` (post-merge verification only) and
`pull_request` stays bare, so every PR from any branch still runs the full gates (including the
zero-network spec) before merge, while the same commit's gates are not run twice for `push` and
for `pull_request: synchronize`. It states that it revisits the earlier "bare push, no filters"
decision.

**Current proof:**

| File | Line | Value |
|------|------|-------|
| `.github/workflows/ci.yml` | 3-9 | header comment: trade-off, "deliberately revisits the prior "bare push, no filters" decision" |
| `.github/workflows/ci.yml` | 10-13 | `on:` / `push:` / `branches: [main]` / `pull_request:` |
| `.planning/ROADMAP.md` | 36 | SC4 still reads "on every push" (unchanged by this plan; the wording is the user's to update) |

**Re-prove (read-only):**

```
sed -n '10,13p' .github/workflows/ci.yml
sed -n '36p' .planning/ROADMAP.md
```

---

### G6 — `pnpm run check` is `tsc -b` followed by svelte-check (O-6)

**Must-have as 01-VERIFICATION.md quotes it:** "Plan 01-09 truth 2 and artifact: pnpm run check
is a single tsc -b (artifact contains "check": "tsc -b")".

**Came from:** executed plan 01-09 truth 2 and its `package.json` artifact; reported as done in
`01-09-SUMMARY.md` (provides list, truths, "WR-04 closed", the file-change list and the
verification table: `"check": "tsc -b",`).

**Superseded by:** Phase 6 commit `50f9f5c` ("feat: login-IP history with offline country map and
opt-in city detail (Phase 6) (#9)"), whose `package.json` diff turns `"check": "tsc -b"` into
`"check": "tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning"`. The
reason is the one `01-09-SUMMARY.md` itself flagged at line 190: `tsc` does not put `.svelte`
files in its program, so a bare `tsc -b` stopped type-checking the Svelte components that Phase
6 added. `pnpm run check` still exits 0.

**Current proof:**

| File | Line | Value |
|------|------|-------|
| `package.json` | 11 | `"check": "tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning",` |

**Re-prove (read-only):**

```
grep -n '"check"' package.json
git show 50f9f5c -- package.json | grep -n '"check"'
```

---

## Unsigned override block

The two empty fields in each entry below are intentionally blank and must be filled by the
person who accepts that entry; when the block is pasted into the `01-VERIFICATION.md`
frontmatter, `overrides_applied` must be set to the number of entries actually accepted (not
automatically six), and entries that are not accepted must be removed from the pasted list.

```yaml
overrides:
  # O-1 (G1)
  - must_have: "onerror while the client is idle and ready marks the worker broken"
    reason: "Reversed deliberately by plan 04-07: a live worker survives an error event, so only a pre-ready onerror marks the client broken (src/lib/import/worker-client.svelte.ts lines 259-268). The dead-worker-after-ready hang is accepted and tracked as 01-REVIEW WR-04 and WR-05. Unit tests pin the reversal (tests/unit/import/ingest-client.test.ts lines 1608 and 1887)."
    accepted_by: ""
    accepted_at: ""
  # O-2 (G2)
  - must_have: "CSP meta carries connect-src 'none'"
    reason: "Superseded by plan 06-11: the opt-in same-origin city file requires connect-src 'self' (vite.config.ts lines 39-40, AGENTS.md line 73). A meta CSP never governed worker traffic, so the guard is the ESLint network ban plus the Playwright request assertions. default-src 'self' and the meta placement are unchanged."
    accepted_by: ""
    accepted_at: ""
  # O-3 (G3)
  - must_have: "success view heading 'Account: <root>' with summary line and badge list"
    reason: "Superseded by Phase 3: plan 03-04 (D-23) retired ResultsView and CategoryBadge, plan 03-07 (IDENTITY-01) deleted formatSummary and formatAccountHeading. The heading is 'Account ID: <root>' in IdentityHeader (src/lib/ui-copy.ts line 443) and per-category status is rendered by the dashboard sections with data-status."
    accepted_by: ""
    accepted_at: ""
  # O-4 (G4)
  - must_have: "no long task of 250 ms or more on a 20,000-entry import"
    reason: "The cost that exceeded 250 ms was the Playwright setInputFiles decode, not the app (about 19 ms unzip). The bound was relaxed to 1000 ms with the reason recorded in tests/e2e/import/import-flow.spec.ts lines 535-542 and enforced at line 552."
    accepted_by: ""
    accepted_at: ""
  # O-5 (G5)
  - must_have: "CI runs on every push"
    reason: "Push was restricted to main as a deliberate trade-off recorded in the .github/workflows/ci.yml header (lines 3-13); every pull request from any branch still runs the full gates, including the zero-network spec."
    accepted_by: ""
    accepted_at: ""
  # O-6 (G6)
  - must_have: "pnpm run check is exactly tsc -b"
    reason: "svelte-check was added in Phase 6 (commit 50f9f5c, package.json line 11) because tsc -b cannot type-check .svelte files; pnpm run check still exits 0."
    accepted_by: ""
    accepted_at: ""
```

## Corrections made to the executed summaries

Each file below gained one append-only section titled "Correction notes (gap closure 01-12,
2026-10-10)". No existing line of any of them was deleted or rewritten. The section quotes the
old claim, says what is true now, names the superseding plan or commit, and points at the
record id above.

| Summary | Groups addressed | What the note corrects |
|---------|------------------|------------------------|
| `01-01-SUMMARY.md` | G2, G3 | `connect-src 'none'` statements (CSP provides entry, verification refs, deviation text); the tracer "Account: {raw ID}" heading statements |
| `01-02-SUMMARY.md` | G5 | "every push and every PR", "bare triggers", "no trigger filters" |
| `01-04-SUMMARY.md` | G3 | the "Account:" heading and the "summary line + category list" done-block statements |
| `01-05-SUMMARY.md` | G3, G4 | ResultsView, CategoryBadge and formatter statements; the "no 250 ms+ long task at 20,000 entries" claim |
| `01-08-SUMMARY.md` | G1 | onerror marks the worker broken unconditionally, the cited WR-01 test name, "WR-01 closed" |
| `01-09-SUMMARY.md` | G6, G2 | `pnpm run check` is a single `tsc -b`; the byte-identical `dist` and `connect-src 'none'` figures |
| `01-10-SUMMARY.md` | G2, G6 | `connect-src 'none'` grep counts; the "pnpm run check exit 0 (tsc -b, no output)" row |
