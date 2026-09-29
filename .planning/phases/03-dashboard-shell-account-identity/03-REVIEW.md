---
phase: 03-dashboard-shell-account-identity
reviewer: gsd-code-reviewer (dispatched by gsd-code-review)
reviewed: 2026-09-29
status: pass
depth: standard
files_reviewed: 39
commits: f02aabc..ffaaf8f
---

# Phase 3 Review — Dashboard Shell & Account Identity

**Scope:** 7 plans, `f02aabc..ffaaf8f`, 39 changed files (`src/` and `tests/`;
planning files excluded by the workflow's diff filters).

**Method:** SUMMARY-extraction file scope (14 files) cross-checked against the
git diff, which added 25 more — the SUMMARY frontmatter under-reports the
phase badly, because Plans 03-04 through 03-07 added most of the UI and specs
without listing them in `files_created`/`files_modified`. Read the privacy
write path (`db.ts`, `identity.ts`, `ingest.worker.ts`) end to end, the whole
component set, and the diffs of every re-pointed e2e spec. Three candidate
defects were found by reading and **all three dissolved under verification**;
they are recorded below under "Investigated and cleared" rather than
silently dropped, because the reasoning is the useful part.

---

## The privacy-critical change

This is the part worth stating plainly, because it is the one place where a
mistake would be unrecoverable.

`LOGIN`, `BIRTH_DATE` and `BIRTH_DATE_SRC` cannot reach IndexedDB, and the
guarantee is structural rather than incidental:

- `sanitizeUserInfoRow` (`src/lib/worker/identity.ts`) is called on **every**
  `user_info` row inside the collection loop, before the row is pushed
  (`src/lib/worker/ingest.worker.ts:199`). The raw parsed object does not
  escape the loop.
- `writeDataset` has exactly one caller, and `db.rows.bulkPut` is the only
  row-inserting statement in the codebase (`src/lib/worker/db.ts:132`). There
  is no second write path to forget to sanitize.
- The strip is case-insensitive on a trimmed, upper-cased key and covers
  PapaParse's `_N` duplicate-header rename, so `login`, `LOGIN ` and `LOGIN_1`
  are all caught. `isUserInfoCategory` lower-cases before comparing, which is
  what makes a literally-lowercase `user_info/` folder still get stripped —
  a strip keyed on the exact string `'User_Info'` would have written real
  exports' emails straight to disk. That case is a fixture and a test
  (`buildLowercaseUserInfoFolderExport`).
- PapaParse's `__parsed_extra` overflow bucket is dropped wholesale, closing
  the header-less-cell path that a column-name deny-list otherwise misses.
- The accepted residual risk — a column *renamed* to something outside the
  deny-list is not caught — is stated in the code and registered as T-03-03,
  with the allow-list counter-argument recorded. That is the right way to
  handle it.

`tests/e2e/identity-privacy.spec.ts` backs this with the strongest leak
coverage I would expect to see: rendered text, `outerHTML`, the aria snapshot,
console on **both page and worker**, and a raw `indexedDB` dump that
deliberately bypasses Dexie. It pairs every negative with a control
(`"IP"` must still be present, the nickname exactly once), so it cannot pass
on an empty dump. Three header/folder-shape variants target exactly the
shapes where a naive strip fails.

**Verdict: correct, and correctly defended.**

---

## Findings

### Critical (0)

None.

### Warning (0)

None.

### Info (3)

**INFO-1 — `src/lib/worker-client.svelte.ts:245-246`: a comment that now
describes a gate which no longer exists.**

> "The persistent control is gated by App.svelte to only render when state is
> 'done' or 'duplicate' (D-18/D-19), so this method is only ever called from
> those states in practice"

The actual gate is `variant === 'slim'` (`ImportBar.svelte:126`), which
tracks `result !== null`. Under D-27 the displayed dataset now survives a
failed import, so the control also renders in the `error` state — the
`dashboard.spec.ts` `(failed-replace)` row drives the app into exactly that
state with `data-variant="slim"`. **The behavior is right** (there genuinely
is a cached dataset to clear); the comment is wrong, and it names a mechanism
(`state`) that is no longer the gate (`result` is). The method's own
defensive guard is present and correct, so the stale comment does not
mislead anyone into removing it. Cheap doc fix.

**INFO-2 — `tests/e2e/import-flow.spec.ts:133`: duplicated operand.**

```ts
processingInSlot: processingEl !== null && processingEl !== null,
```

The second clause is a copy-paste of the first; it was presumably meant to
be `slotEl !== null`. Behaviorally inert — `processingEl` is only ever
obtained by querying *inside* `slotEl`, so it cannot be non-null when
`slotEl` is null, and the assertion does still prove "the status is inside
the notice slot" (D-26). Worth fixing because the field name promises more
than the expression checks, and the next reader has to re-derive that.

**INFO-3 — `src/lib/components/ConfirmPanel.svelte:45`: `aria-modal="true"`
without a focus trap or Escape handling.** *(pre-existing carry-forward, not
introduced by this phase)*

The attributes are unchanged from `f02aabc`. The phase **improved** this
component: it added `onMount(() => cancelButton?.focus())` and App-side focus
return, both of which are tested. What remains is that `aria-modal` promises
the dialog owns the interaction while nothing enforces it — Shift+Tab from
Cancel reaches the bar's own buttons. I checked whether that is exploitable
and it is not: `requestClearData()` guards with
`if (this.state === 'confirm-pending' || ...) return`, so a stray activation
is a no-op and the pending `replace` action survives. Accessibility
announcement nit, not a defect. Flagged only so it is on the record.

---

## Investigated and cleared

Three things that read like defects on first pass and are not. Recorded so
the next reviewer does not re-derive them.

**1. The long-task threshold appeared to drop 250 ms → 1000 ms. It did not.**
`git diff` on `import-flow.spec.ts` shows `-// lasted 250 ms or more` /
`+// lasted 1000 ms or more`, which reads exactly like a loosened performance
guarantee in a phase that otherwise rewrites the spec. Checking
`git show f02aabc:tests/e2e/import-flow.spec.ts` shows the *executable*
filter was already `t.duration >= 1000` before this phase, and the pre-phase
comments simply disagreed with their own code. This phase corrected two stale
comments. The threshold is unchanged. **Not a weakened guarantee.**

**2. The clear-data control rendering in the `error` state. Intended.**
Reachable only when a dataset is actually on screen (failed-replace). The
`first-error` matrix row — no dataset — correctly shows the `full` bar with
the control at count 0, asserted. Correct; see INFO-1 for the stale comment
that says otherwise.

**3. `aria-busy` following `disabled` on the dropzone. Correct.**
`aria-busy={disabled ? 'true' : undefined}` looks like it announces "busy"
whenever the dropzone is merely blocked. Traced the chain:
`App.svelte:239 busy={ingestClient.busy}` → `ImportBar.svelte:126
disabled={busy}` → and `get busy()` is `state === 'processing'` and nothing
else. During `confirm-pending` the dropzone is neither disabled nor busy. The
attribute is true exactly when work is in flight. Also checked: because the
dropzone stays live during `confirm-pending`, a second drop must be caught
elsewhere — it is, by the `submitFiles` guard, with a dedicated
`(drop-during-confirm)` e2e row.

---

## Test-quality assessment

The three re-pointed legacy specs are the right kind of rewrite. Every
removed assertion has a counterpart, and several got **stronger**:

- `getByRole('heading', {level: 2})` → `identity-nickname` testid. The
  comment explains why this was forced, and it is correct: the dashboard
  renders six `<h2>`, so the old count-0 "nothing loaded" signal had become
  ambiguous. The replacement is strictly better — testid count 0 **plus** an
  explicit `data-variant="full"` check.
- `persistent-dataset.spec.ts` replaced eight per-index `toContainText`
  loops with `expect(after).toEqual(before)` on the collected section and
  banner texts — a stronger round-trip assertion, and it also pins banner
  *order*, which the old loop never checked.
- "Auto-load, not re-import" changed from "the dropzone is not rendered" to
  `toHaveJSProperty('files.length', 0)`. Forced by the D-24/D-25 co-render
  (an absent-element proof is unavailable when the element is now always
  present), and the replacement is a legitimate proof: a re-import requires a
  file to be set.
- Skip-tag coverage went from "the Bans badge has it" to whole-page count 1
  **plus** a per-section count 0.

I looked specifically for the failure mode where a rewrite trades an
assertion for a tautology and found none. The 83 e2e and 316 unit tests are
not padding.

**Single engineering-hygiene note (not filed as a finding):**
`SENSITIVE_KEY` in `tests/unit/ingest-worker.test.ts:170` duplicates the
production deny-list regex. I checked whether this is a tautology and it is
not — it is deliberately restated as an independent oracle, with a comment
saying so, which is the correct choice (importing the production regex would
be the tautology). The residual risk is that a *future* widening of the
production list would not be reflected here; the e2e privacy spec is
behavior-based and would catch the actual leak. Left unflagged.

---

## Verdict

**Pass.** The phase does what it says. The privacy guarantee is structurally
enforced at a single choke point and verified against IndexedDB directly
rather than through the app's own read path. The e2e rewrite is faithful and
in places tighter than what it replaced. All three findings are documentation
or minor test-hygiene; none blocks the phase.

The one thing I would change before Phase 4 touches this area: fix INFO-1, so
the next person reading `worker-client.svelte.ts` is not told the control is
gated on `state` when it is gated on `result`.

**Next step:** `/gsd-verify-work 3` — the gate is green, but verification
should confirm the phase's success criteria against the running app rather
than the suite alone.
