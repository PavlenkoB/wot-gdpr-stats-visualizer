# Phase 3 — UI Review

**Audited:** 2026-09-29
**Baseline:** `.planning/phases/03-dashboard-shell-account-identity/03-UI-SPEC.md`, read with `03-CONTEXT.md` (locked decisions) and `03-PATTERNS.md`
**Screenshots:** captured — production bundle built with `vite build`, served with `vite preview --port 4173 --strictPort`, driven headless via Playwright against `http://localhost:4173`. 4 measurements in `.planning/ui-reviews/03-measurements/` (gitignored; no binary assets in this commit).
**Scope:** this phase's own surface only — `IdentityHeader`, `DashboardSection`, `ImportSummary`, `Dashboard`, `UnsupportedBlock`, `DashboardNav`, `ImportBar`, `Dropzone`, `ConfirmPanel`, `FailureBanner`, `App.svelte`, `app.css`. Phase 1/2 components referenced only as inherited chrome.
**Registry Safety:** not applicable — no `components.json` in the phase directory and no third-party UI registry in the audited components (all imports are Svelte or relative).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Every contract string landed verbatim and both retirements are clean, but the compact dropzone's `aria-label` overrides its own visible prompt, so D-25's replacement warning is never announced |
| 2. Visuals | 3/4 | Identity nickname is a clean 28px focal point; section cards invert their own hierarchy — a 16px pending note sits under a 14px summary line |
| 3. Color | 3/4 | Every text pair meets AA and the spec's own 6.05:1 figure verifies, but the nav hover is 1.07:1 — the surface the spec rejected as "near-invisible" was 1.04:1 |
| 4. Typography | 4/4 | Exactly four sizes, two weights, four line-heights, each mapped to a contract role; no off-scale size survives |
| 5. Spacing | 4/4 | Every value is a multiple of 4 with only the declared 12/20 exceptions; the 72px nav-offset math verifies at 56.6 + 16.2 = 72.8 in-browser |
| 6. Experience Design | 2/4 | All four empty states, loading, error and destructive confirmation are present, but the destructive confirm declares `aria-modal="true"` while being fully permeable to focus and Escape |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **`ConfirmPanel` claims modality it does not have** (`ConfirmPanel.svelte:45`) — `role="alertdialog"` + `aria-modal="true"` on an inline, `position: static`, `z-index: auto`, backdrop-free panel with no `inert` and no `<dialog>`. Measured: forward Tab from the open panel goes `confirm-cancel → confirm-commit → nav-link-activity-history` (straight out into the page), and Shift+Tab re-enters via the nav and continues into the still-enabled dropzone (`file-input → dropzone`, `tabindex="0"`, not inert). Escape does not dismiss. Assistive tech is told the page behind is inert when it is fully live — on the one path that permanently deletes user data. Either drop `aria-modal` and make it what the spec actually describes (an inline disclosure), or make it real: backdrop, `inert` on the rest of `main`, focus containment, Escape-to-cancel.
2. **The compact dropzone's replacement prompt is invisible to screen readers** (`Dropzone.svelte:110`) — the static `aria-label="Wargaming data export dropzone"` overrides the visible prompt, so "Drop a new export (.zip) here to replace this one, or click to choose it." is never announced and `aria-describedby` is absent. The one string whose job is to warn that dropping is destructive is the one string AT cannot reach. Add a visually-hidden description span referenced by `aria-describedby` (or set `aria-label` to the prompt) and keep the short label for identification only.
3. **The nav's hover state is imperceptible** (`DashboardNav.svelte:229`) — measured contrast of the shipped `#ffffff` hover on the `#f7f7fa` nav is **1.07:1**; the `#f1f3f4` the spec rejected as "near-invisible" is **1.04:1**. The chosen value is 0.03 away from the one it replaced, so the stated rationale does not hold and a mouse user gets no hover feedback on nav links. Darken the surface (e.g. `#e8eaed`) or add a non-colour hover cue; either way the spec's rationale sentence should be corrected, since the code is faithfully doing what the spec asked.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Every string in the UI-SPEC copywriting contract is implemented verbatim.** Spot-checked against `src/lib/ui-copy.ts`: `DROPZONE_PROMPT`, `COMPACT_DROPZONE_PROMPT`, the two empty-state headings, `GENERIC_FAILURE_MESSAGE`, the confirm string triples (`CONFIRM_CLEAR_MESSAGE` / `KEEP_CACHED_DATA_LABEL` / `DELETE_CACHED_DATA_LABEL`, `CONFIRM_REPLACE_MESSAGE` / `KEEP_CURRENT_DATA_LABEL` / `REPLACE_DATASET_LABEL`), the five nav labels, the four nav suffixes, the three section status strings, both section notes, `UNSUPPORTED_INTRO`, `UNSUPPORTED_NONE_DETECTED`, `UNSUPPORTED_BANNER_SUFFIX`, the identity region/caption/region/created/account-ID labels, and the skeleton strings. Both retirements are honoured — `formatSummary` and `formatAccountHeading` are gone from `ui-copy.ts`, and a grep for the retired off-scale strings finds no residue.

- **W-02 (Warning, also Pillar 6)** — `Dropzone.svelte:110`. `aria-label="Wargaming data export dropzone"` overrides the rendered prompt in both variants, and there is no `aria-describedby`. Measured accessible name: `Wargaming data export dropzone`; measured visible prompt in slim mode: `Drop a new export (.zip) here to replace this one, or click to choose it.` D-25 (locked) introduced the compact prompt specifically so the user is told dropping will *replace* an existing export. For a screen-reader user that warning is never spoken. The UI-SPEC is partly responsible — it requires the Phase 1 `aria-label` to stay "unchanged so there is only ever one dropzone in the DOM" while also introducing a new prompt string — so this is a contract gap the implementation inherited, not a careless edit.
- **Minor** — the empty-state variant of `ImportSummary` (skipped-rows-on-an-empty-section, from RESEARCH Q2 discretion) is not specified in the contract. It renders the skip tag alone in a Label/muted `<p>`, which reads correctly; recorded so the omission is a known gap rather than an accident.
- Generic-label grep (`Submit`, `Click Here`, `OK`, `Cancel`, `Try again`, `went wrong`, `error occurred`, `No data`, `No results`) returns zero hits.

### Pillar 2: Visuals (3/4)

The loaded state has a genuine single focal point: the identity nickname renders at 28px/600 against a 14px caption, a 14px `dt` column and 16px `dd` values, and the demoted `h1` correctly steps back to Heading size. Untrusted long text behaves: measured `overflow-wrap: anywhere`, `text-overflow: clip`, `scrollWidth === clientWidth` (638/638 — no truncation, no overflow). Icon-only affordances: none, so the "icon-only buttons need tooltips" rule has no surface here. No sticky overlap: at 720px with the nav stuck, `navBottom` sits at 72.8px and `occludedByStickyNav` is empty.

- **W-04 (Warning, contract observation)** — `DashboardSection.svelte:91,94`. A pending section renders Heading 18/600 title → Label 14/600 `1 file, 1 row` → Body 16/400 `Dashboard coming in a later update`. The de-emphasised note is set one step *larger* than the summary line directly above it, and in the regular weight at Body size it becomes the most prominent body text in the card. The spec mandates this (the note is deliberately Body, not a muted Label), so the code is compliant — but the inversion should be a conscious decision. Suggest Label 14/600 `#5f6368`, or accept and record why Body is right.
- **Minor** — in the skeleton state there is no focal point at all: `h1` "WG Data Export Viewer", the identity card's "No export loaded", and all five section titles are every one Heading 18/600 `#3c4043` — seven visually identical headings, differentiated only by position. This follows from the spec reserving Display for the nickname, which is absent pre-import. Flagged so the "one focal point" principle is knowingly relaxed in the skeleton state rather than by omission.
- **M-01 (Minor)** — at 375px the nav scrolls internally by 291px with no overflow affordance (no fade, mask or scrollbar styling); the 375px screenshot shows a mid-word `ment_history` at the left edge. The contract's actual requirement — the nav must not *silently clip* a link — is met: focusing the last link scrolls it fully into view (`linkRect [204, 342]` inside `navRect [24, 351]`). Discoverability is a Phase 7 phone-treatment item per the spec's own scope boundary.
- **M-02 (Minor)** — the nav is `top: 0` (spec-compliant; the spec says `position: sticky; top: 0; z-index: 1`), but the measured result is a 16.2px gap above it, so the 16px of clearance in `--nav-offset: 72px` now sits entirely *below* the stuck nav rather than being split as the derivation implies. Harmless today — no card is occluded and the 72px anchor offset is still correct — but note it before Phase 7 touches either value.

### Pillar 3: Color (3/4)

18 distinct hex values ship. The accent `#1a73e8` appears only in its four reserved places: dropzone drag-highlight, focus rings, the spinner border, and the nav active underline. The destructive pair `#c5221f` / `#fce8e6` / `#8a1c17` appears only on `FailureBanner` and the `ConfirmPanel` commit button — notably *not* on "Start over" or "Clear my cached data", which stay neutral chrome per D-17/D-18. The 60/30/10 distribution holds: white dominant, `#f7f7fa` secondary, accent strictly functional.

Measured contrast on the shipped surfaces:

| Pair | Ratio | Verdict |
|---|---|---|
| Muted `#5f6368` on card `#ffffff` | 6.05:1 | Pass (matches the spec's own stated 6.05) |
| Muted `#5f6368` on greyed `#f7f7fa` | 5.66:1 | Pass (spec states 5.6) |
| Skip tag `#8a5a00` on `#fef7e0` | 5.53:1 | Pass AA at 14px |
| Banner text `#3c4043` on `#f1f3f4` | 9.40:1 | Pass |
| Confirm text `#202124` on `#fef7e0` | 15.02:1 | Pass |
| Focus ring `#1a73e8` on nav `#f7f7fa` | 4.21:1 | Pass (needs 3:1, WCAG 1.4.11) |
| Focus ring `#1a73e8` on card `#ffffff` | 4.51:1 | Pass |

- **W-03 (Warning)** — `DashboardNav.svelte:229`. The nav's hover background is `#ffffff` on a `#f7f7fa` container. The UI-SPEC justifies this choice by saying the Phase 2 hover `#f1f3f4` "would be near-invisible on that surface". Measured: the shipped value is **1.07:1** and the rejected value is **1.04:1** — the swap moved the contrast by 0.03 and changed nothing. The affordance is absent, not subtle. The only non-colour weight cue (600 vs 400) marks the *active* link, not the hovered one, so hovering gives no feedback at all.
- **M-03 (Minor)** — two shipped colours are absent from the UI-SPEC's palette table: `#202124` (ConfirmPanel body text, `ConfirmPanel.svelte:81`) and `#f5d4d1` (ConfirmPanel commit hover, `ConfirmPanel.svelte:142`). Both are inherited unchanged from Phase 2, which the spec defers to, so this is a completeness gap in the spec's palette rather than an implementation deviation. Related: `FailureBanner.svelte:25` sets `#8a1c17` while a nearby comment claims the text "stays default body color" — it is not the declared Body colour `#08060d`; the comment is stale.
- Colour is never the only signal: the skip tag pairs colour with the word "Skipped", the active nav link pairs colour with a 3px underline and `aria-current="location"`, the destructive commit pairs colour with the explicit label "Delete cached data", and empty states are stated in text.

### Pillar 4: Typography (4/4)

The strongest pillar. The entire `src` tree contains exactly four font sizes — 14px (×13), 16px (×12), 18px (×2), 28px (×1) — exactly two weights (600 ×17, 400 ×7) and four line-heights (1.5, 1.4, 1.3, 1.2), each mapping cleanly onto Body / Label / Heading / Display. Every off-scale value the spec listed for retirement is gone: no 15px, no 13px, no 20px `h2`. The muted-link weight exception (400 on a 14px label) is applied exactly where the contract authorises it and nowhere else.

- The one typographic anomaly in the tree is `DashboardNav.svelte:277` — `line-height: 0` on the screen-reader-only suffix span, paired with `font-size: 0` and `display: inline` rather than the 1px clip pattern the spec prescribes. This is the deviation flagged from the earlier phase. Judged here: the documented reason is sound, and the *consequence* is verifiably harmless. The span is in normal flow, so Chromium inserts a separator when it computes an accessible name from content — the clip pattern's `position: absolute` removes the span from the flow and drops the separator, which is exactly the failure the code comment describes. Measured in Chromium 141: the rendered name is correct and separator-free (`Activity_history, not in this export`, `User_Info, no export loaded`), and because a `font-size: 0` inline box has a zero-height strut it cannot inflate the parent line box — the measured nav height is 56.6px against the contract's ~56px estimate. The residual risk is a user-forced minimum font size, which would make the suffix faintly visible; that risk is accepted for the correct accessible name, and the same file family (`Dropzone.svelte`) still uses the clip pattern, so the two techniques coexist by design rather than by accident.

### Pillar 5: Spacing (4/4)

Every `padding`, `margin` and `gap` in the audited components is a multiple of 4. The only non-4 values are exactly the ones the contract declares: `12px` notice/button chrome, `20px` full-dropzone padding, and `--nav-offset: 72px` (explicitly "a multiple of 4; not a scale token"). The rhythm verifies end to end: `main` and `.dashboard` both use `gap: 24px`, cards `gap: 8px` / `padding: 16px`, the identity `dl` `gap: 4px 16px`, the bar children `12px`, the `dl` grid at 375px resolving to `131.3px 145.7px` (two columns retained, as the contract requires, with values wrapping rather than truncating).

- The nav-offset derivation is the contract's most load-bearing spacing claim and it holds: measured nav height 56.6px, stuck with 16.2px above it, `navBottom` 72.8px against `--nav-offset: 72px`, and `occludedByStickyNav: []` — no section ever tucks under the sticky nav. M-02 (Pillar 2) records the one nuance.
- **M-04 (Minor)** — `main`'s `padding: 24px` is declared twice: `src/app.css:37` and `src/App.svelte:278`. The spec describes `app.css` as holding "legacy 20px horizontal padding ... superseded" by App.svelte's override, but `app.css` now also says 24px, so the two must be kept in sync for no rendering benefit. The rendered value is correct.

### Pillar 6: Experience Design (2/4)

State coverage is broad and, where the contract is explicit, faithfully implemented. All four empty states exist and are distinguished correctly (not-loaded greyed card, "Not in this export" with the `aria-disabled` dropzone, empty with the count-suffix status line, and the "none detected" empty unsupported list). Loading is covered twice — the window-level cache check and the in-slot processing notice. Errors surface as a `role="alert"` `FailureBanner` in the notice slot with the old dataset intact. Both destructive triggers route through the one shared `ConfirmPanel` with identical copy. The notice slot is always mounted, carries `aria-live="polite"` + `aria-atomic="true"`, and nests no second live region. Reduced-motion is respected: the sole animation is the CSS spinner, correctly paused under `prefers-reduced-motion`.

- **W-01 (Warning, top priority)** — `ConfirmPanel.svelte:45`. `aria-modal="true"` on a non-modal. Full measurement above under Priority Fix 1. The 03-06 focus work that *is* present is correct: focus lands on `confirm-cancel` on open (the safe default), and dismissal returns focus to the trigger — verified in the project's own e2e suite and again here. The gap is that nothing stops focus *leaving*, and no Escape route exists.
- **W-02 (Warning, also Pillar 1)** — `Dropzone.svelte:110`. The replacement prompt is never announced.
- **Minor** — the disabled dropzone sets `aria-busy` from `disabled` rather than from a processing flag (a deliberate choice, commented in source, so the "processing" state is never announced on the dropzone itself; the processing notice carries it instead). `aria-busy` on a `role="button"` is semantically loose but harmless.
- **Minor** — during a replace-in-flight the two destructive bar buttons remain enabled, so a user can open the confirm panel mid-import. The worker client and the state machine handle the resulting `confirm-pending` transition, and the contract does not require disabling them, but the affordance is looser than the situation warrants. Flagged for the phase that owns in-flight UX.
- Not defects, verified passes: focus returns to the correct trigger for start-over, clear-data and replace-on-drop; a second drop while the panel is open changes nothing; a stray window drop is prevented and changes nothing.

---

## Verified Passes

Recorded so the next phase does not re-derive them.

- **Nav fit at 720px** — 600.3px of links in 670px of available width. The spec's own estimate ("about 653px against 672px") was pessimistic by ~53px, so the row has roughly 10% slack rather than the 19px its arithmetic implied. No overflow, and the focus ring is not clipped by `overflow-x: auto` (8px of nav padding against a 3px ring plus 2px offset).
- **375px** — `documentElement.scrollWidth === 375`, no page-level horizontal scroll, `main` content width 327px as specified, the identity `dl` stays two columns, the slim bar wraps without widening the page.
- **Untrusted text** — `overflow-wrap: anywhere` and `min-width: 0` are present on every element that interpolates a folder name, nickname or account ID; measured `scrollWidth === clientWidth` with no truncation.
- **Scroll-spy** — one `IntersectionObserver` with `rootMargin: "-72px 0px -60% 0px"` built from `--nav-offset`; the spec's "band ends at 40% of the viewport" and its `-60%` bottom margin are consistent, not a contradiction.
- **Project e2e suite** — 83/83 passing against the production bundle (36.7s), covering the app-state matrix, confirm/focus, scroll-nav, long untrusted text and the phone-375 layout. Nothing found in this audit contradicts them; the four warnings above sit in behaviour the suite does not assert.

---

## Files Audited

- `src/App.svelte` (330 lines)
- `src/app.css` (61 lines)
- `src/lib/components/IdentityHeader.svelte` (215)
- `src/lib/components/DashboardSection.svelte` (175)
- `src/lib/components/ImportSummary.svelte` (114)
- `src/lib/components/Dashboard.svelte` (85)
- `src/lib/components/UnsupportedBlock.svelte` (150)
- `src/lib/components/DashboardNav.svelte` (279)
- `src/lib/components/ImportBar.svelte` (248)
- `src/lib/components/Dropzone.svelte` (206)
- `src/lib/components/ConfirmPanel.svelte` (149)
- `src/lib/components/FailureBanner.svelte` (29)
- Supporting (read for copy and status logic, not audited as UI): `src/lib/ui-copy.ts`, `src/lib/dashboard-status.ts`, `src/lib/scroll-spy.ts`, `src/lib/worker-client.svelte.ts`

**Screenshot inventory** (gitignored, not committed): `skeleton-720.png`, `loaded-375.png`, `confirm-open-720.png`, `stuck-720.png` in `.planning/ui-reviews/03-measurements/`.

**Note, outside the six pillars:** the `.spinner` rule is duplicated verbatim at `App.svelte:307` and `ImportBar.svelte:182`, each with its own `prefers-reduced-motion` copy at `:325` and `:200`. Both halves must be edited together in any future spinner change.
