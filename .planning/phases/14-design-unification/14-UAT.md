---
status: complete
phase: 14-design-unification
source: [14-VERIFICATION.md]
started: 2026-10-28T06:49:46Z
updated: 2026-10-31T08:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Before/after UAT set for every pane
expected: See Current Test. Note: the original page-level PNG sets were wiped by a machine restart; rebuild the baseline from commit 901a9e1 to compare against. The Overview's byte-equal result is retained in 14-OVERVIEW-PIXEL-EVIDENCE.md.
result: pass

### 2. Phone-bar title truncation (code review WR-01)
expected: At 375px and 320px, open the "Warships crews & storage" pane and read the phone-bar title. The reviewer measured it ellipsized at 26px (306px of text in a 276px bar at 375px; 306 in 221 at 320px) where the 18px baseline did not truncate. The reviewer's measurement was made in a harness page and was not repeated by the verifier. Owner decides: accept the ellipsis, shrink the phone-bar title, or allow it to wrap.
result: pass
reported: "[screenshot, no text] Phone-bar title reads \"Warships crews & sto…\" - ellipsized beside the Sections back button on the Warships crews & storage pane at phone width."
severity: minor
owner_recheck: "Owner replied pass on 2026-10-31 after measured evidence: widest title (Warships crews & storage) 218px, scrollWidth = clientWidth at 375px and 320px, all 13 panes, Chromium."
fix_applied: "09e881b - the phone-bar title now carries .t-heading (18px). Measured in the built app: the widest title needs 218px; 375px has 276px free (58px spare), 320px has 221px free (about 3px spare, macOS Chromium system font; may differ on other platforms). Owner to re-check at 375px and 320px."

### 3. D-07 only partly delivered (owner decision)
expected: 105 of 188 14px sites at line height 1.4 keep token declarations because no role covers them. Owner decides: add .t-note (14/400/1.4) and .t-note-strong (14/600/1.4) roles in a follow-up (about 105 markup sites, no visible change), or accept the token declarations as final.
result: skipped
reason: "Deferred follow-up: follow-up (owner changed this from an earlier pass on 2026-10-29)"
note: "Owner replied pass. Read as: accept the 105 token-declared 14px/1.4 sites as the final state; no .t-note roles follow-up."

### 4. D-02 / UI-SPEC OI-11 (owner decision)
expected: src/app.css keeps the shell layout and the single phone block beside the element resets, which departs from D-02 as written. Owner decides: confirm this, or direct a follow-up that moves the layout and the phone block into src/styles/ and repoints the phase-8 guard that reads the phone block.
result: skipped
reason: "Deferred follow-up: follow-up"

### 5. .caption versus .t-caption naming (owner decision)
expected: .caption is the 14px muted note and .t-caption is the 12px role; the naming is a trap, documented in src/styles/utilities.css. Owner decides: rename in a follow-up, or accept.
result: skipped
reason: "Deferred follow-up: follow-up"

## Summary

total: 5
passed: 2
issues: 0
pending: 0
skipped: 3
blocked: 0

## Deferred Follow-Ups

- test: 3
  idea: "follow-up: add .t-note (14/400/1.4) and .t-note-strong (14/600/1.4) roles and move the ~105 token-declared 14px/1.4 sites onto them (D-07); no visible change"
  deferred_at: 2026-10-29

- test: 4
  idea: "follow-up: move the shell layout and the single phone block out of src/app.css into src/styles/ and repoint the phase-8 guard that reads the phone block (D-02 / UI-SPEC OI-11)"
  deferred_at: 2026-10-29

- test: 5
  idea: "follow-up: rename .caption (14px muted note) or .t-caption (12px role) so the two names stop colliding; documented in src/styles/utilities.css"
  deferred_at: 2026-10-31

## Recorded, not open

D-04 / UI-SPEC OI-6: the 44 sites of border-radius 6px keep 6px as --radius-sm. CONFIRMED by the owner in chat on 2026-10-25. (The verifier counted 32 such sites by direct grep and could not reconcile it with 44; see 14-VERIFICATION.md, info item I1.)

## Gaps

- gap_id: G-14-2
  truth: "The phone-bar title shows the pane's full name at 375px and 320px, or the owner accepts the ellipsis (code review WR-01)"
  status: resolved
  reason: "User reported: [screenshot, no text] phone-bar title reads 'Warships crews & sto…' (ellipsized) on the Warships crews & storage pane at phone width"
  severity: minor
  test: 2
  fix_commit: "09e881b"  # applied directly at the owner's request (option 1); owner re-check passed 2026-10-31
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
