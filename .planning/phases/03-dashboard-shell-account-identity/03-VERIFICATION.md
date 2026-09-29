---
phase: 03-dashboard-shell-account-identity
verified: 2026-09-29T17:15:18Z
status: passed
score: 69/69 plan-03 must-have truths verified · 4/4 ROADMAP success criteria met · 3/3 requirement IDs satisfied (DATA-03, DATA-04, IDENTITY-01)
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/phases/03-dashboard-shell-account-identity/03-01-PLAN.md
  - .planning/phases/03-dashboard-shell-account-identity/03-01-SUMMARY.md
  - .planning/phases/03-dashboard-shell-account-identity/03-02-PLAN.md
  - .planning/phases/03-dashboard-shell-account-identity/03-02-SUMMARY.md
  - .planning/phases/03-dashboard-shell-account-identity/03-03-PLAN.md
  - .planning/phases/03-dashboard-shell-account-identity/03-03-SUMMARY.md
  - .planning/phases/03-dashboard-shell-account-identity/03-04-PLAN.md
  - .planning/phases/03-dashboard-shell-account-identity/03-04-SUMMARY.md
  - .planning/phases/03-dashboard-shell-account-identity/03-05-PLAN.md
  - .planning/phases/03-dashboard-shell-account-identity/03-05-SUMMARY.md
  - .planning/phases/03-dashboard-shell-account-identity/03-06-PLAN.md
  - .planning/phases/03-dashboard-shell-account-identity/03-06-SUMMARY.md
  - .planning/phases/03-dashboard-shell-account-identity/03-07-PLAN.md
  - .planning/phases/03-dashboard-shell-account-identity/03-07-SUMMARY.md
  - .planning/phases/03-dashboard-shell-account-identity/03-CONTEXT.md
  - .planning/phases/03-dashboard-shell-account-identity/03-UI-REVIEW.md
  - .planning/phases/03-dashboard-shell-account-identity/03-UI-SPEC.md
  - .planning/phases/03-dashboard-shell-account-identity/03-VALIDATION.md
  - src/App.svelte
  - src/app.css
  - src/lib/components/ConfirmPanel.svelte
  - src/lib/components/Dashboard.svelte
  - src/lib/components/DashboardNav.svelte
  - src/lib/components/DashboardSection.svelte
  - src/lib/components/Dropzone.svelte
  - src/lib/components/IdentityHeader.svelte
  - src/lib/components/ImportBar.svelte
  - src/lib/components/UnsupportedBlock.svelte
  - src/lib/dashboard-status.ts
  - src/lib/scroll-spy.ts
  - src/lib/types/worker-messages.ts
  - src/lib/ui-copy.ts
  - src/lib/worker-client.svelte.ts
  - src/lib/worker/categories.ts
  - src/lib/worker/db.ts
  - src/lib/worker/identity.ts
  - src/lib/worker/ingest.worker.ts
  - tests/e2e/dashboard.spec.ts
  - tests/e2e/identity-privacy.spec.ts
  - tests/e2e/import-failure.spec.ts
  - tests/e2e/import-flow.spec.ts
  - tests/e2e/persistent-dataset.spec.ts
  - tests/e2e/scroll-nav.spec.ts
  - tests/e2e/zero-network.spec.ts
  - tests/fixtures/export-fixtures.ts
  - tests/helpers/contrast.ts
  - tests/unit/contrast.test.ts
  - tests/unit/dashboard-status.test.ts
  - tests/unit/db.test.ts
  - tests/unit/identity.test.ts
  - tests/unit/ingest-client.test.ts
  - tests/unit/ingest-worker.test.ts
  - tests/unit/scroll-spy.test.ts
  - tests/unit/ui-copy.test.ts
covered_digest: "v1:sha256:8ea89bdc1cb9f3a421a3fe4a7bd3f938ba814546d4577a103a272e462d5fe17d"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 69/69 must-have truths · 4/4 success criteria · 3/3 requirement IDs
  trigger: "Fail-closed covered_files fingerprint mismatch — content drift under the declared cover, not a re-run of the audit."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  rechecked:
    - "W-02: compact dropzone accessible name now derives from its own prompt; the FULL variant keeps its intended name"
    - "S-1: a parsed-but-partial User_Info row renders the 'Unknown' placeholder in the DOM for the first time"
    - "W-03: nav hover #ffffff -> #dadce0; 03-05 scroll-spy and the nav e2e assumptions re-run unaffected"
  fingerprint_change:
    files_added: 7
    files_removed: 0
    reason: "The previous digest was canonical and correct when written at b31ea4e; it went stale from content drift under the cover. Seven files that this re-verification newly reads as evidence, or that the fixes created/amended, are now covered."
gaps: []
findings_not_gating:
  - "ConfirmPanel declares aria-modal=\"true\" but renders inline with no backdrop, no z-index and no focus trap; background content stays reachable. Real a11y defect, pre-existing from Phase 2, outside every Phase 3 success criterion. Recorded in STATE.md:81, escalated, not silently fixed. Non-blocking."
  - "persistent-dataset (a) proof shape changed: the return visit is now proven by the co-rendered file input's empty FileList (toHaveJSProperty('files.length', 0)) rather than by the dropzone being absent. The old argument is now the opposite of the D-13 contract. The new proof is stronger (it observes the actual mechanism) and loses no coverage. Recorded in STATE.md:94."
  - "Two cross-browser assertions (rootMargin percentage behaviour in Firefox/Safari; the 3px current-underline and focus-ring not being clipped at 375px) are declared backstops in 03-05 and remain manual. The suite is Chromium-only, so these are unverified by automation, as their own plan declares."
  - "W-02 left one stale sentence in the approved contract: 03-UI-SPEC.md:209 still reads 'Element, data-testid=\"dropzone\" and aria-label are unchanged', which is now false for the compact variant. W-03 amended the spec in both places it named the nav hover; W-02 amended none. The sentence's operative clause (one dropzone in the DOM) still holds — ImportBar.svelte:126 is the only <Dropzone> render site — so no must-have or success criterion is affected, but the contract text is not self-consistent with the code."
  - "03-05-PLAN.md:149 (the task narrative) still specifies 'hover background #ffffff'. It is a historical instruction record, not a must-have (no 03-05 truth names the hover colour), so the 69/69 score is unaffected — but it is a third place that named the value and was left unamended, alongside the two in the spec that W-03 did amend."
  - "03-VALIDATION.md:32-33 still declares the pre-fix baseline '14 test files, 316 tests' / '7 spec files, 83 tests'. The shipped suites are now 15 files / 330 unit and 86 e2e. A stale number in a validation-strategy document, not a product or test defect."
  - "Pre-existing, unchanged by W-02: the FULL-size dropzone's accessible name ('Wargaming data export dropzone') does not contain its visible prompt text, so WCAG 2.5.3 Label-in-Name is only partially met for that variant. W-02 resolved exactly this problem for the compact variant and left the full variant's behaviour as it was. Recorded, not fixed — it is Phase 1/2 behaviour and outside every Phase 3 success criterion."
---


# Phase 3 Verification Report

**Phase Goal:** After an import, or on a return visit, the user lands on a single-page dashboard that shows whose account it is. Every category is represented honestly, whether it is present, missing, or not yet supported.

**Verified:** 2026-09-29T16:05:00Z (original audit, against commit `e7a77af` — the phase's last code-bearing commit, `docs(03): add phase review`) · **re-verified 2026-09-29T17:15:18Z** on branch `gsd/phase-03-dashboard-shell-account-identity`, tree at `402b546`.

**Status: PASSED.** 4/4 ROADMAP success criteria met. 3/3 requirement IDs satisfied. 69/69 plan-03 must-have truths verified. Gate on the re-verified tree: lint 0, svelte-check 0 errors/0 warnings, 330/330 unit tests across 15 files, 86/86 e2e tests, build succeeds. (The original audit measured 316/316 and 83/83 on the pre-fix tree; the delta is the three fixes' own tests.)

**Method note.** This verification ran against the working tree and its suites, not against the SUMMARY files. Where a summary asserted a privacy guarantee, the guarantee was re-derived from source and then attacked with a mutation test (see SC1).

**Re-verification method note (2026-09-29T17:15:18Z).** The second pass is narrow by design. It does not re-audit the phase: the success criteria, the 69 plan must-haves and the three requirement IDs were already verified and none of the three fixes reaches them. It asks two questions only — did the fixes break, weaken or contradict anything already verified (§6), and is the fingerprint accurate again (§7) — and re-runs only the four targeted checks those questions need (§6.4).

---

## 1. The Privacy Criterion (SC1) — the load-bearing claim

This was the designated high-attention item. Three independent lines of evidence were collected: structure, data, and a live mutation.

### 1a. Structure: is the strip a real choke point?

**Yes — structurally true, and there is no second write path.**

| Claim | Evidence |
|---|---|
| The strip happens *before* the row array is built, not at the write | `ingest.worker.ts:199` — `sanitizeUserInfoRow(...)` is applied to the User_Info row at the single point where rows are pushed into `allRows`; the write is a separate, later call |
| Exactly one write to the rows store exists in the entire source tree | `db.ts:132` is the sole `db.rows.bulkPut(...)`; `db.ts:129` wraps `clear → bulkPut → meta.put` in one `db.transaction('rw', ...)`. Every other persistence call in `src/` is `clear()` or `meta.delete` |
| `writeDataset` has exactly one caller | `grep -rn "writeDataset" src/` returns the definition (`db.ts:121`), its own doc comments, and a single call site (`ingest.worker.ts:229`) |
| No second Dexie connection exists | `db.ts:108` — `export const db = new AppDb()` is the only `new AppDb()`; the class's own doc comment states it is "Imported ONLY by `ingest.worker.ts`", and the import grep confirms `ingest.worker.ts:17` is the sole importer |
| No raw IndexedDB access escapes the worker | Repo-wide grep for `indexedDB` / `open(` across `src/` returns no main-thread database handle; `db` is not exported to any UI module |
| The identity is built only from sanitised rows | `ingest.worker.ts` feeds `extractIdentity` the already-sanitised rows; `identity.ts:134-147` returns exactly `{nickname, region, createdAt}` — a three-field object with no field that could carry an email |

**Verdict on the design claim:** the choke point is real. A future maintainer cannot write a User_Info row to IndexedDB without passing through `sanitizeUserInfoRow`, because the only row-array construction feeds the only bulkPut.

### 1b. Data: does the strip actually bind on real fixtures?

A throwaway Node script (in `/tmp`, never in the repo) imported the *real* `sanitizeUserInfoRow` and `parseCsvFile` and ran them over all three Phase 3 fixtures — the sample export, the hostile header-variant export (lowercase/padded/duplicate-suffixed headers, missing REGION, an overflow cell) and the case-variant-folder export (including a duplicate LOGIN column).

Result for every `User_Info` row in every fixture: the **un-stripped** `row.data` contains `example.invalid`; the **stripped** form does not, carries no `LOGIN` key, and carries no PapaParse overflow bucket. The strip is load-bearing on the real shapes, including the adversarial ones.

### 1c. Mutation: would `identity-privacy.spec.ts` actually go red?

A passing test proves nothing if it cannot fail. Two checks:

1. **Data-level:** the probe above establishes the e2e needle (`example.invalid`, `"LOGIN"`) is present in the un-stripped data and absent in the shipped data. The spec's assertion is therefore reachable.
2. **Behavioural:** the source tree was copied to `/tmp/vrfy03/mutant1` and `sanitizeUserInfoRow` was neutered to `return { ...data }` — a faithful simulation of "the choke point forgets to strip". The suite was re-run against the mutated copy.

**Result: 5 of 5 privacy tests failed**, each on the at-rest IndexedDB assertion:

```
Expected substring: not "example.invalid"
Received string: ...\"LOGIN\":\"synthetic.player@example.invalid\"...
  at expectNoSensitiveData (…) identity-privacy.spec.ts:209
```

The mutation landed at the *durable-storage* layer, not merely the DOM layer. This is the correct and strongest place for the spec to bite, because the whole point of the design is that the email never rests on disk — a DOM-only assertion would have been the weaker test.

**Conclusion:** `tests/e2e/identity-privacy.spec.ts` is **not vacuous**. It fails, loudly and at the right layer, on exactly the regression it exists to catch. On the unmutated tree it passes 5/5.

**Residual risk (disclosed, not a gap):** the spec covers DOM text, `outerHTML` (so all `title`/`aria-label` attributes), the accessibility snapshot, the console and the IndexedDB rows, and asserts `document.title` is unchanged. No code path in `src/` sets `document.title` — the only title is the static `index.html` `<title>WG Data Export Viewer</title>` — so the title is structurally immune rather than merely asserted. Grep for `fetch(`/`XMLHttpRequest` in `src/` returns nothing, so there is no exfiltration channel to leak the email even if it were in memory.

---

## 2. ROADMAP Success Criteria

### SC1 — Identity header with nickname, region, created date; email nowhere in page, tooltips or title

**MET.** `IdentityHeader.svelte` renders nickname as the display-role title, raw region under "Region (per export)", and the created date date-only via `formatCreatedDate` (which shows the date portion as written, with no `Date` parsing and no timezone conversion). The email is absent by the three-part argument in §1. The nickname appears exactly once in the DOM, asserted by the spec.

### SC2 — Every detected category with no dashboard is listed with the same banner; none hidden, dropped, or crashing

**MET, and structurally un-droppable.** `classifyFolder` (`categories.ts`) is a total function over three tiers with a safe default: any folder not in `SUPPORTED` or `KNOWN_DEFERRED` returns `'unknown'`. There is no blocklist and no early return that discards a name, so "silently dropped" is not a reachable state. `UnsupportedBlock.svelte` renders every non-supported entry from one list with one template and no per-tier field, reusing the shared `DashboardSection` shell so it owns the fifth anchor id like any other section. Identity of styling across tiers is asserted by a nine-property `getComputedStyle` comparison over banners carrying different `data-status` values, and the block's stylesheet contains no `data-status` selector at all.

### SC3 — A supported category missing from the export still shows its section, empty or greyed

**MET, with the absent/empty distinction intact.** `dashboard-status.ts` derives every state from the same pure functions the nav reads, so a card and its nav link cannot disagree. `Dashboard.svelte` iterates the fixed `SECTIONS` constant — the order is the code's, never the result's — so an absent category cannot remove its card. Wording is distinct per state: "Not in this export" (absent) vs "This export contains no rows for {Category}" (present but zero rows) vs "Drop an export to see this section" (no export at all). Each is separately covered by a named e2e test, and the underlying 03-02 prohibition that the two must not be conflated is unit-tested.

### SC4 — Processing, ready, duplicate and error states from worker messages; return visit opens straight to the dashboard

**MET.** The `IngestClient.result` re-typing to "last known cached dataset" is what makes the matrix honest: the dashboard stays on screen through a replace-in-flight, a duplicate, and a failed import, so the old data is never blanked by a transient state. The return visit is driven by the on-load cache check, and `App.svelte` renders *only* the spinner block during `checking-cache`, so a returning user never sees a flash of the empty skeleton. No re-upload is proven by the co-rendered file input's empty `FileList`.

---

## 3. Requirement Coverage

| ID | Status | Evidence |
|---|---|---|
| **DATA-03** | SATISFIED | 3-way classification is total with an `unknown` default (`categories.ts`); all three tiers render the identical "detected but not yet supported" banner from one list (`UnsupportedBlock.svelte`); nothing hidden or dropped; no crash path — a folder with a parse error gets a skip tag and survives reload, asserted in `dashboard.spec.ts` `(skip)`. |
| **DATA-04** | SATISFIED | Sections come from a fixed constant, not the result, so a missing category keeps its card greyed with "Not in this export"; present-but-empty keeps distinct wording; the nav does not convey the state by colour alone — the status is also in each link's accessible name and weight change, asserted by exact accessible-name assertions and `aria-current="location"` on the active link. |
| **IDENTITY-01** | SATISFIED | Header shows nickname, region, created date from `User_Info`; the `LOGIN` email is omitted from display and, per §1, never persisted at all. Defense in depth: a v2 Dexie upgrader discards any v1 cache that still holds the raw email, with an explicit in-code rule that a future `version(3)` must keep the `version(2)` block. |

No requirement ID in `REQUIREMENTS.md` maps to Phase 3 and is unsatisfied, and no phase-3 requirement ID is missing from the roadmap mapping.

---

## 4. Key Risks Checked (Disproved or Confirmed)

- **"There may be a second write path that could forget the strip."** — Disproved. One `bulkPut`, one `writeDataset` caller, one Dexie connection, one importer, strip upstream of row construction.
- **"The privacy spec may pass vacuously."** — Disproved by mutation. 5/5 fail when the strip is removed.
- **"Absence of evidence vs evidence of absence."** The email's absence is backed by both a positive control and a negative one: the specs assert the *IP* column is still stored, so a dump that was empty or mis-read would fail the control rather than silently pass the privacy check.
- **"A new tier could be silently dropped in future."** — Structurally prevented: the classifier defaults to `unknown`, so a new folder is listed rather than ignored.
- **Dependency on `graphify-out/`** — That directory contains a stale reference to the deleted `formatSummary`/`formatAccountHeading`, but it is a generated planning artifact, not product source. It does not affect the build, the type-check or any test.

## 5. Findings Not Gating (see frontmatter)

Three items are recorded honestly rather than inflated into phase failures. The `aria-modal` defect is real and is an accessibility bug — background content remains reachable while a destructive panel is open, and a discarded drop is surfaced only as a `console.error`. It is pre-existing Phase 2 behaviour, is outside all four Phase 3 success criteria, and 03-CONTEXT directs that the confirm flow be driven unchanged in this phase, so fixing it here would have been scope creep; it is escalated in STATE.md for an explicit decision. The persistent-dataset proof-shape change is a legitimate strengthening. The two Chromium-only backstops are declared as manual in their own plan.

**No gap blocks phase closure.**

---

## 6. Re-verification after the three post-phase fixes (2026-09-29T17:15:18Z)

The original audit above stands. This section records what was re-checked after three
small fixes landed, and it is deliberately narrow: the phase had already passed 4/4
success criteria, 69/69 plan must-haves and 3/3 requirement IDs, so the question was
never "does the phase work" but "did these three changes break, weaken or contradict
anything already verified".

### 6.0 What the fixes could and could not touch

The privacy criterion (§1) is the load-bearing claim of this phase, and the three
fixes do not reach it. Diffed against their trees, `ca40e76`, `c0433cb` and `06c803d`
touch exactly: `Dropzone.svelte`, `ui-copy.ts`, `DashboardNav.svelte`,
`dashboard.spec.ts`, `ui-copy.test.ts`, `export-fixtures.ts`, `03-UI-SPEC.md`, and the
new `tests/helpers/contrast.ts` + `tests/unit/contrast.test.ts`. **Not one** of them is
in the privacy chain — `db.ts`, `identity.ts`, `ingest.worker.ts` and
`identity-privacy.spec.ts` are untouched, and the new S-1 fixture builder is not
referenced by the privacy spec. The §1 argument (one `bulkPut`, one `writeDataset`
caller, one Dexie connection, strip upstream of row construction) and the §1c mutation
result therefore still hold as written; the 5/5-fails-on-mutation evidence was not
re-run because nothing it depends on moved.

### 6.1 W-02 — the compact dropzone's accessible name (the focused risk)

**Risk as posed:** `aria-label` REPLACES an element's content as its accessible name,
so changing how the name is derived could silence a prompt, or regress the full-size
variant. Confirmed both directions.

| Question | Answer | Evidence |
|---|---|---|
| Does the FULL variant still get its intended name? | Yes, unchanged | `Dropzone.svelte:117` is `aria-label={compact ? undefined : DROPZONE_ARIA_LABEL}`; there is exactly one `<Dropzone>` render site (`ImportBar.svelte:126`, `compact={variant === 'slim'}`), so `compact === false` on first visit and the label is applied |
| Is the FULL variant's name really the intended one at runtime? | Yes | e2e `(accessible-name)` asserts `toHaveAccessibleName(DROPZONE_ARIA_LABEL)` before any import, against the built app |
| Does the compact variant now announce its prompt? | Yes | same e2e, after the import flips `import-bar` to `data-variant="slim"`: `not.toHaveAttribute('aria-label', /./)` AND `toHaveAccessibleName(COMPACT_DROPZONE_PROMPT)` — an exact-match assertion, so the visually-hidden file input contributes nothing and the name is the prompt and nothing else |
| Is any screen-reader guarantee regressed? | No | The only a11y-tree assertion in the suite (`identity-privacy.spec.ts:180`, `body.ariaSnapshot()`) is a *negative* one — `not.toContain(EMAIL_DOMAIN)` / `not.toContain(SAMPLE_BIRTH_DATE)` — so a changed dropzone name cannot affect it. The compact name is strictly more informative than the label it replaces: it is the only statement of the replace-on-drop affordance (D-25), and the enclosing `<section aria-label="Import">` still supplies the landmark context the generic label gave |
| Do the two names stay distinct? | Yes, and it is pinned | `ui-copy.test.ts` asserts `DROPZONE_ARIA_LABEL` differs from both prompts, so the variants can never collapse into one indistinguishable name |

No must-have is affected. 03-06's relevant truth is "The dropzone is one element in
both variants; while busy it keeps its prompt, is aria-disabled and aria-busy and its
file input is disabled" — still true, and 03-06's task *narrative* (line 164, "the
label keeps … its `aria-label`") is the one line of planning text W-02 deviates from.
The deviation is a strict a11y improvement and is recorded in the findings.

### 6.2 S-1 — `valueOrUnknown()` exercised in the DOM (the last validation seam)

**Claim:** `valueOrUnknown()` had no DOM coverage anywhere in the project, because the
only fixture that produced an absent `User_Info` took the `fallback` variant, which
never renders the three-field card. **Confirmed, and now closed.**

- `IdentityHeader.svelte:41-45` derives `variant` from `result.identity` alone, so a
  parsed row with blank cells is `loaded` (not `fallback`, not `skeleton`) and reaches
  `valueOrUnknown` through the real component — the fixture exercises the production
  path, not a test-only one.
- e2e `(partial-row)` passes and asserts the whole distinction: `data-variant="loaded"`,
  `fallback` and `skeleton` explicitly absent, `identity-nickname` and
  `identity-region` both exactly `"Unknown"`, and `identity-created` still the real
  date — so "Unknown" is proven to be a *per-field* answer, not a whole-card fallback.
- e2e `(partial-row-nickname)` is the mirror case: blank nickname alone keeps
  `identity-region` populated, which is what rules out a regression that blanks the
  entire row.

Both tests were re-run for this re-verification and pass against the built app.

### 6.3 W-03 — nav hover `#ffffff` → `#dadce0` (the second focused risk)

**The arithmetic was re-derived independently, not taken from the commit message.**
WCAG relative luminance of `#dadce0` = 0.71459, of `#f7f7fa` = 0.93196, so the ratio is
**(0.98196 / 0.76459) = 1.284:1**; `#ffffff` on the same surface is 1.069:1 and the
Phase 2 `#f1f3f4` is 1.041:1. The spec's amended numbers and the shipped values agree
with an independent calculation, and the rejected value really was as imperceptible as
the fix claims — the original rationale rejected `#f1f3f4` and then shipped something
within 0.03 of it.

**Risk as posed:** a nav styling change could disturb the 03-05 scroll-spy or the nav
e2e assumptions. It does not.

| Dependency | Why the hover cannot affect it | Evidence |
|---|---|---|
| 03-05's scroll-spy | Pure state, not paint: `activeId` is set from `pickActiveSection`/`isAtPageBottom` and written as `aria-current="location"`; the stylesheet has no `:hover` selector in the spy's path and the observer never reads a computed style of a link | All 12 `scroll-nav.spec.ts` tests re-run green, including the band-mirror, sticky, anchors and reduced-motion cases |
| Nav accessible names | The visible title plus a visually-hidden suffix; W-03 changed a background declaration only | `(muted-names)` × 4 re-run green |
| 375px / 720px no-page-overflow | A background colour contributes no box size | `(phone-375)`, `(long-text)` × 2 re-run green |
| The "current" underline | `a[aria-current='location']` still wins on `border-bottom-color` and weight; `a:hover` declares only `background`, so the two cannot collide | Style block inspected; `a` carries `border-bottom: 3px solid transparent`, and W-03's comment's claim that the links have no border of their own is accurate about the *hover* state (the reserved underline is transparent) |

**The new contract test is not vacuous.** `tests/unit/contrast.test.ts` reads the
component and the spec off disk and asserts both directions, so a one-sided amendment
fails: the spec's `| Nav hover surface |` row must carry the colour the component
ships, the `| Hover |` link-state row must carry the same one, the pair must clear
1.20:1, and both rejected colours must fall below that floor. The lookups fail loudly
rather than silently if a row disappears (`throw` on a missing row/rule), and the
selector regexes match unique blocks — `nav {` and `a:hover {` each occur exactly once
in the stylesheet, so the "first match wins" behaviour cannot read the wrong rule.
The helper itself is unit-tested against the WCAG maximum (21:1 for black on white),
order independence, the 3-digit form, and rejects anything that is not `#rgb`/`#rrggbb`
so a typo cannot parse as black and pass silently.

### 6.4 Targeted re-runs performed for this re-verification

| Check | Command | Result |
|---|---|---|
| W-02 accessible name, both variants | `playwright test tests/e2e/dashboard.spec.ts -g "accessible-name"` | 1/1 pass against the built app |
| S-1 partial rows, both cases | `playwright test tests/e2e/dashboard.spec.ts -g "partial-row"` | 2/2 pass |
| W-03 vs. 03-05 scroll-spy and nav assumptions | `playwright test tests/e2e/scroll-nav.spec.ts` (whole file) + the phone-width case in `dashboard.spec.ts` | 13/13 pass (single invocation: 17 tests, 17 passed) |
| W-02 copy contract, W-03 contrast contract | `vitest run tests/unit/contrast.test.ts tests/unit/ui-copy.test.ts` | 51/51 pass across 2 files |

The full phase gate was not re-run end to end: it is already confirmed green on this
tree (build ok, lint clean, svelte-check 0 errors, unit 330/330 across 15 files, e2e
86/86), and the four targeted runs above are the only evidence any re-verified claim
needed.

### 6.5 Residual risk (disclosed, not a gap)

The nav hover now *is* a visible step on a mouse, but hover is not a keyboard or
touch affordance and was never the only one: the nav's states are carried by
`aria-current`, a weight change, a text-colour change and a hidden suffix, none of
which depend on `:hover`. The 1.284:1 is below the 3:1 that WCAG 1.4.11 asks of a
non-text UI boundary, and the value is a background, not a boundary — the spec's own
argument is about the state being *perceptible*, and the amber-free grey was chosen so
it cannot be mistaken for the selected state. Stated rather than quietly widened.

## 7. Fingerprint provenance — and a correction to why the status went stale

The `covered_digest` in this frontmatter is `v1:sha256:8ea89bdc…`, computed with the
canonical `computeCoveredDigest(projectRoot, coveredFiles)` from
`$HOME/.claude/gsd-core/bin/lib/verification.cjs` over the 57-file `covered_files`
list declared above, and cross-checked through a second code path
(`gsd-tools query verification.fingerprint`, same value). It is not hand-written.

**The briefing's explanation of the staleness was wrong, and the difference matters.**
The previous value `v1:sha256:01a667cd…` was *not* a hand-written or mis-computed
one. Reconstructing the tree and recomputing shows it was exactly right when it was
written:

| Covered set | Tree | Computed digest | Matches the value declared at the time? |
|---|---|---|---|
| the list in `b31ea4e` | `b31ea4e` | `v1:sha256:01a667cd…` | **yes** |
| the same list | `3b975f9` (last commit *before* the three fixes) | `v1:sha256:daf7cc93…` | no — already stale |
| the same list | current tree `402b546` | `v1:sha256:ddf928ee…` | no |

So the fingerprint was canonical and correct, and it went stale from ordinary content
drift under the cover *before* any of the three fixes landed. Diffing the cover between
`b31ea4e` and `3b975f9` names the drift exactly: **`.planning/REQUIREMENTS.md` and
`.planning/ROADMAP.md`**, and nothing else. The three fixes then moved six more covered
files on top of that.

Two things follow. First, the fail-closed check did its job — it caught real drift
rather than rubber-stamping a stale report, and it did not need a wrong value to do it.
Second, the lesson the earlier report drew about itself was inverted: a passing
fingerprint is only as current as the last time anyone recomputed it, and nothing in the
phase's own workflow re-derived it after the requirement/roadmap edits. That is a
process observation, not a defect in the phase.

**Cover changes made in this refresh: +7 files, 0 removed.** All seven are inputs this
re-verification actually read, or files the fixes created/amended — `03-UI-SPEC.md`
(amended by W-03 *and* read at test time by `contrast.test.ts`, so its bytes change
test outcomes), `03-UI-REVIEW.md` and `03-VALIDATION.md` (the review that produced
W-02/S-1/W-03, and the validation strategy), `03-CONTEXT.md` (cited by §5's
`aria-modal` finding), `.planning/STATE.md` (records the three carry-overs as closed),
and the new `tests/helpers/contrast.ts` + `tests/unit/contrast.test.ts`. The original
50 are unchanged; none of them became irrelevant.
