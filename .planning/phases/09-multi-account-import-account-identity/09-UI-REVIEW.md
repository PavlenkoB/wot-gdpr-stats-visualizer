# Phase 9 — UI Review (re-audit)

**Audited:** 2026-10-18
**Baseline:** `09-UI-SPEC.md` (approved 2026-10-16; amended in commit `2d42efc` for the ID-only title role)
**Screenshots:** NOT captured — nothing answering on localhost:3000 / 5173 / 8080. Code-only audit.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)
**Registry audit:** skipped — no `components.json`; UI-SPEC Registry Safety is `none`.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Prior finding 1 is fixed: the count now counts accounts that hold data, so the title, the rows and all six captions are one number. New residual: `09-UI-SPEC.md` was never amended for that decision, and a two-root archive with one data-less root now silently renders the SINGLE-account header. |
| 2. Visuals | 3/4 | Prior finding 3 is fixed: the ID-only title is no longer the row's largest element. Remaining: `.multi-title` shares the `.nickname` rule, so Display cannot be tuned per variant. |
| 3. Color | 4/4 | Zero new hex; the ID-only title takes `--muted`, the token the ID line already proves at 4.5:1. Accent (`--ink`) is confined to the title and named accounts. |
| 4. Typography | 4/4 | Three sizes (26/18/14), two weights (400/600), one phone collapse. The id-only demotion lands in Label role by selector sharing, and specificity beats the later `.multi-name` rule. |
| 5. Spacing | 4/4 | Prior finding 2 is fixed: `.provenance` is `column-gap: 4px; row-gap: 4px` and both are asserted. Every new value is 4/8/16/20. |
| 6. Experience Design | 3/4 | All 13 declared states still covered; the 375px backstop now measures real geometry. Remaining: no announced cue on import, and a data-less folder now vanishes with no trace. |

**Overall: 20/24** (prior audit: 19/24)

---

## Verdict on the three prior priority fixes

| Prior fix | Verdict | Evidence |
|-----------|---------|----------|
| 1. "N accounts" count could over-claim (counted archive roots, rows described data) | **FIXED** | `accountSummariesOf` (`src/lib/worker/account-summary.ts:263-267`) filters `hasData !== false`; both producers route through it (`ingest.worker.ts:730`, `:1277`); `hasData: root.storedRows > 0` is written with the record (`:1179`) and read absent-means-data (`db.ts:160`). The Account-record gate deliberately still reads roots and says why (`db.ts:723`). |
| 2. Combined caption crowded against the "From …" line (`gap: 0 4px`) | **FIXED** | `DashboardSection.svelte:220-231` — `column-gap: 4px; row-gap: 4px`, with the reason in a comment so it is not tidied back. Asserted by `toHaveCSS('row-gap','4px')` in `expectCombinedCaption` (`multi-account.spec.ts:482-492`). |
| 3. An absent `User_Info` row looked exactly like a real one | **FIXED** | `IdentityHeader.svelte:276-285` — `.account-id, .multi-name.id-only { 14px / 600 / 1.4 / --muted }`, bound by `class:id-only={row.idOnly}` (`:143`). Same `h3`, same test id, same `{row.name}`, same accessible name — a type-only change, as the amended UI-SPEC now records. Browser-proven: 14px for the ID-only title, 18px for a named one (`multi-account.spec.ts:358`, `:373`). |

All three landed. Fix 1 was a semantics decision (option-a, user checkpoint) rather than a copy change, and it was the right one.

---

## Top 3 Priority Fixes (new)

1. **A data-less root drops the dataset into the single-account header, unannounced** — `accountCountOf` counts the PUBLISHED list (`identity-model.ts:72-77`), so a two-root archive whose second root stores nothing renders `variant="loaded"`, not `multi`: the list pane shows the legacy FIRST-account identity — its `REGION` and `CREATED_AT` presented as the export's region and creation date, with no mention of the second folder. That is exactly the claim UI-SPEC Surface 3 forbids ("the per-account region is never shown as the export's region in multi mode"). *Fix:* count roots separately for the variant decision, or gate the single-account region/created pair on the archive's root count rather than the published list; either way the spec's zero-one-many row needs rewriting, because "no account count of zero is reachable" no longer describes the reachable state.
2. **`09-UI-SPEC.md` is stale on count semantics** — nothing in the Copywriting Contract or the UI Considerations table says which roots are counted, and the plan's own `affects:` list names `UI-SPEC-Copywriting-Contract` while the file is unchanged (only `09-VERIFICATION.md` was amended). A later reader auditing against the contract will "find" the old wording and re-open a closed finding. *Fix:* one dated amendment paragraph in the Copywriting Contract and the `zero-one-many | combined caption` row.
3. **Still no announced cue when a second export is imported** — the caption and the "N accounts" title are static text by contract; a user mid-session sees the header change and nothing else. Contract-accepted, but it is the weakest remaining interaction. *Fix (if wanted):* put the `combined-caption` in an `aria-live="polite"` slot, or make the existing import-notice slot name the new count.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- **Passes.** Every Phase 9 string is still a named export in `ui-copy.ts` (`IDENTITY_MULTI_LIST_LABEL`, `IDENTITY_GAMES_LABEL`, `IDENTITY_NO_ACTIVITY`, `ACCOUNT_ROW_MULTI_SUMMARY`, `formatAccountCount`, `formatCombinedCaption`, `formatActivityYears`, `formatEarliestCreated`, `formatGameLongName`, `formatAccountGames`). No string literal in any component; no new CTA, error or destructive copy, exactly as the contract requires. `formatAccountCount` has no singular branch and every call site gates on `>= 2` (`overview-model.ts:119-131`, `selection-state.ts:204-212`).
- **Fixed.** The count and the rows are now the same set, so "3 accounts" can no longer sit above two rendered rows (priority fix 1).
- **WARNING.** Prior finding 1's fix exposed a new path (priority fix 2 above): the fallback to a single-account header when roots > published accounts.
- **WARNING (contract critique, unchanged).** `IDENTITY_CAPTION` "As of export" is reused above the multi list, where the rows are session-derived. Mandated by the contract.
- **Nit (unchanged).** `ACCOUNT_ROW_MULTI_SUMMARY` uses an ASCII apostrophe beside an en-dash-heavy file.

### Pillar 2: Visuals (3/4)
- **Fixed.** `.multi-name.id-only` now renders at the ID line's role, so a rootless account no longer wears the row's most prominent type; the hierarchy 26 → 18 → 14 is intact and an absence is visibly an absence.
- Rows remain hairlines, not cards (`border-top: 1px solid var(--border); padding: 8px 0;`), no radius, no background, no hover, no focus stop — the 44px rule correctly does not apply. `min-width: 0` + `overflow-wrap: anywhere` on section, titles, `.account-id`, `.multi-name` and every `dd`.
- **WARNING.** `.nickname, .skeleton-title, .fallback-title, .multi-title` share one rule (`IdentityHeader.svelte:219-230`): Display cannot be tuned for the multi variant without moving every variant with it.
- **WARNING.** No screenshots exist for this audit either, so the visual claims are code-derived; the e2e 375px step (`multi-account.spec.ts:1122-1163`) now measures rendered geometry (scroll width, row right edges, full untruncated text), which is a real improvement over the prior audit but still not a visual comparison.

### Pillar 3: Color (4/4)
- No `#hex` or `rgb(` anywhere in `IdentityHeader.svelte`, `identity-model.ts`, `DashboardSection.svelte`'s `.combined` rule, or the `ui-copy.ts` Phase 9 block.
- Every colour is a token: `--ink` (multi title, named account), `--muted` (caption, `dt`, `.account-id`, `.combined`, and now `.multi-name.id-only`), `--text` (`dd`), `--border` (hairline).
- 60/30/10 holds: pane backgrounds dominate, `--border` is the only separator, `--ink` is the only accent and stays confined to the elements the contract reserves it for. The ID-only demotion moves an element OUT of the accent rather than adding one.
- Status is never colour alone: "No activity recorded" and the year range are text; no tint, dot or badge anywhere.
- Contrast: `--muted` on `--list` / `--page` is the already-measured pair; the ID-only title reuses it rather than introducing a new one.

### Pillar 4: Typography (4/4)
- Exactly three sizes (26 / 18 / 14) and two weights (400 / 600). No new size, no third weight, no third family, system-ui untouched. Line-heights follow the code's recorded 1.4 for labels, 1.3 for headings, 1.5 for body values — the deviation the spec says to keep.
- The phone collapse exists exactly once, inside the single existing block: `grep -c "max-width: 480px" src/app.css` = 1, and `.shell [data-testid='identity-header'] .multi-title { font-size: 18px }` at `src/app.css:358`, whose 3-class specificity beats the component-scoped rule.
- The id-only demotion is structurally safe: `.multi-name.id-only` (specificity 0,2,0) is declared before `.multi-name` (0,1,0), and the higher specificity wins regardless of order — verified by the browser assertion at `multi-account.spec.ts:358`.
- The prior warning about the ID-only title's type is resolved.

### Pillar 5: Spacing (4/4)
- `.provenance` is now `column-gap: 4px; row-gap: 4px` (`DashboardSection.svelte:224-225`); the row gap is what gives the `flex-basis: 100%` caption its 4px block rhythm, and the column gap that holds the inline "From … · N files" run together is preserved. Both are asserted.
- All other values stay on the declared scale: 4px (section gap, `.multi-row` gap, `dl` row gap, section padding), 8px (`.multi-row` padding), 16px (`dl` column gap), 20px (existing pane side padding). No arbitrary `[Npx]` / `[Nrem]` values in any changed file.
- `.multi-list` reset is `margin: 0; padding: 0; list-style: none` as specified; inter-row separation is row padding plus the hairline, not a gap.

### Pillar 6: Experience Design (3/4)
- All 13 declared UI-state rows verified still covered: Games omitted (never an empty `<dd>`) when there is no token; Activity falls back to `IDENTITY_NO_ACTIVITY`; blank `NAME` → "Unknown"; unknown token rendered raw; ID-only row omits its ID line; ordering is one comparator in the worker; no "show more", no truncation; the Login-history account-record row is gated to one account by the root-counting gate, which 09-10 deliberately left reading roots.
- **Improved.** The 375px long-text step now asserts rendered geometry — document `scrollWidth <= innerWidth`, every row's right edge inside the viewport, and the full 40-character nickname and 20-digit root present untruncated. This closes the prior audit's "untested at the pixel level" complaint for layout, though readability is still a human call.
- **Improved.** The repeated-key scan walks every pane through one named reader with by-test-id exclusions, and each exclusion has its own proof.
- **WARNING.** No announced cue on a mid-session import (priority fix 3).
- **WARNING (accepted cost, now user-visible).** A data-less folder is named nowhere — not in the header, not in a pane caption, not in an empty state. The decision is recorded and intentional; it is flagged here only because the surface that absorbs it (the single-account header) does not say what happened.

---

## Files Audited

- `.planning/phases/09-multi-account-import-account-identity/09-UI-SPEC.md` (baseline, amended for the ID-only role)
- `.planning/phases/09-multi-account-import-account-identity/09-UI-REVIEW.md` (prior audit, superseded)
- `.planning/phases/09-multi-account-import-account-identity/09-08-SUMMARY.md`, `09-10-SUMMARY.md`, `09-VERIFICATION.md` (dated decision amendment)
- `src/lib/shell/IdentityHeader.svelte`, `src/lib/shell/identity-model.ts`
- `src/lib/shell/DashboardSection.svelte` (`.provenance`, `.combined`), `src/lib/shell/Dashboard.svelte:219`
- `src/lib/shell/overview-model.ts:109-131`, `src/lib/shell/selection-state.ts:203-212`
- `src/lib/worker/account-summary.ts:247-267`, `src/lib/worker/db.ts:160,723`, `src/lib/worker/ingest.worker.ts:730,1179,1277`
- `src/app.css` (single 480px block, `.multi-title` phone rule at :358)
- `tests/e2e/shell/multi-account.spec.ts` (id-only type assertions :343-387, caption :482-492, pane scan :758/:924, 375px geometry :1122-1163)