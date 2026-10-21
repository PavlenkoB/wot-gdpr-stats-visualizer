# Phase 12 — UI Review

**Audited:** 2026-10-21
**Baseline:** 12-UI-SPEC.md (approved 2026-10-20)
**Screenshots:** not captured (no dev server on localhost:3000, 5173 or 8080; port 4173 was not touched). Code-only audit. Every visual claim below is derived from source and CSS, not from rendered pixels.
**Interaction captures:** off (workflow.ui_interaction_capture is false). Interaction findings are code-derived.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract strings are all present, but "Showing all 1 entries", an over-counting merge note and an overclaiming privacy sentence ship |
| 2. Visuals | 3/4 | Structure matches the contract, but the fixed 360px nowrap Entry cell clips name changes with no way to read the rest |
| 3. Color | 4/4 | No new colour, only var() tokens, kinds are words; the only hex is the sanctioned error panel, copied into two files |
| 4. Typography | 4/4 | One size (14px), two weights (400, 600), matches the four-role contract exactly |
| 5. Spacing | 3/4 | Scale and 40px rows honoured; the mask and kind controls deviate slightly from the declared control radius and height |
| 6. Experience Design | 2/4 | Dead mask UI, silent row loss with a "Showing all 0 entries" empty table, `\N` leaking to the screen, ghost rows |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Rows the language/country discriminator cannot place vanish, and the pane can render an empty table under a count** (WR-02, `timeline-aggregate.ts:267-274`, `AccountTimelinePane.svelte:154,165-170`) — The list headline counts N stored rows, the pane lists fewer, and a file whose `NAME` vocabulary does not contain "lang" or "countr" produces "Showing all 0 entries" over a header-only table. The reader cannot tell data from nothing. Fix: mark a ready file that yielded zero entries as `skipped`, or emit a fallback `language` entry carrying the raw NAME, and make `isWholePaneEmpty` also true when `entries.length === 0`.
2. **The `\N` null marker prints as literal `\N`, and ban `EXPIRED_AT` is stored but never shown** (WR-01, `new-data-aggregate.ts:83-129`, `new-data-specs.ts:573-577`) — Perks coupon `EXPIRED_AT`/`UPDATED_AT` cells and any name-history `OLD_NAME` show a raw backslash-N, which violates "not reported" being said in words. The open-ban semantics the header capture asked for are not implemented. Fix: normalise `\N` once in `cellOf` to the not-reported path, then either surface ban end/"Ongoing" as a secondary part or drop `EXPIRED_AT` from the spec.
3. **The Entry column clips the most useful content** (WR-05, `TimelineTable.svelte:97,391-393`) — Two 24-character nicknames plus the separator exceed 360px, `overflow: hidden; text-overflow: ellipsis` hides the previous nickname, and nothing exposes the full text. Fix: let Entry take the remaining width (360px floor) inside the existing horizontal scroller, or raise `ENTRY_PX` to about 480 and update `minWidthPx` and `.w-entry` together.

Further fixes (4 to 8), all WARNING:

4. **Dead address-masking UI and a false copy claim in the timeline** (IN-01) — `hasMaskableEntries` is always false because no timeline spec allowlists an address column, so `onToggle`, the `MASK_*` imports, `announcement` and the Dashboard `revealed`/`onRevealChange` threading are unreachable, yet `TIMELINE_ABOUT` tells the reader "IP addresses stay masked until you choose to show them". Remove the sentence (or the wiring) until an address column exists.
5. **Privacy copy overclaims** (WR-04, `ui-copy.ts:4258`) — "Email addresses in these files are never read, stored or shown" is stronger than the `EMAIL_SHAPE` heuristic can guarantee, and "read" is false (the files are parsed). Soften to "Cells that look like email addresses are dropped before anything is stored".
6. **Singular/plural errors** (IN-02) — `formatTimelineShowing(1, 1)` yields "Showing all 1 entries". `formatMergeNote` is fed rows removed, not entries merged, so three accounts sharing one identical row read "2 entries are identical". Special-case the singular and count merged entries.
7. **Ghost rows** (IN-03) — a row whose every allowlisted cell was email-dropped is stored as `{}`, counted, and renders a ready card with no columns; in merged files all such rows collapse into one empty row. Treat a ready card with zero listed columns as `skipped`.
8. **`survey PLAYER_ANSWER` and other free-text-capable columns have no value-shape validation** (WR-03) — a free-text answer in a future export would be stored and shown in the Perks Surveys card. Add a per-column pattern.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Matches the contract:
- All named constants exist in `src/lib/ui-copy.ts`: `TIMELINE_INTRO`, `PERKS_INTRO`, `TIMELINE_KIND_FILTER_LABEL` ("Filter by kind"), `TIMELINE_KIND_ALL` ("All entries"), `TIMELINE_COLUMN_LABELS`, `PERKS_CARD_TITLES`, the `PERKS_MASK_*` set, `TIMELINE_LOADING`, `PERKS_LOADING`, `TIMELINE_ERROR`, `PERKS_ERROR`.
- `formatMergeNote` handles the singular ("1 entry is identical ...").
- Per-file lines use `formatNewDataSkipped`/`formatDeviceNoRows` with canonical labels from `NEW_DATA_FILE_LABELS` via `fileLabel()` (`AccountTimelinePane.svelte:174-177`), never a zip entry name.
- The error is a fixed sentence in `role="alert"` (`AccountTimelinePane.svelte:199`, `PerksPane.svelte:205`).
- No generic CTA ("Submit", "OK", "Click here") is introduced; the phase adds no primary button.

Defects:
- **WARNING** `ui-copy.ts:4196-4199`: `formatTimelineShowing(1, 1)` returns "Showing all 1 entries". The contract text itself says `Showing all {m} entries`, so the spec and code agree on a sentence that is wrong at m = 1. Contradicts the care taken for the merge note singular two functions below.
- **WARNING** `ui-copy.ts:4210-4214` fed by `account-merge.ts:139`: `k` is rows removed, not entries merged. Three accounts holding one identical row says "2 entries are identical on more than one account" when there is one such entry.
- **WARNING** `ui-copy.ts:4258` (`TIMELINE_ABOUT`): "Email addresses in these files are never read, stored or shown" overclaims relative to a regex heuristic (WR-04). It also states "IP addresses stay masked until you choose to show them" about a pane that holds no address column (IN-01). A privacy tool should not describe data it does not hold.
- **WARNING** `\N` leaks to the screen as literal text in non-date cells (WR-01). The contract says null cells read `not reported`.

### Pillar 2: Visuals (3/4)

Matches the contract:
- Header zone order in `AccountTimelinePane.svelte` follows the contract: intro, merge note, per-file lines, mask block, About, kind chips, showing line, table. Provenance and the combined caption come from the shared `DashboardSection` via `newDataSectionProps` (`Dashboard.svelte:322-335`).
- Kind badge is an inert, neutral, bordered `span` with 18px line height inside a 40px row (`TimelineTable.svelte:360-372`), and is visually distinct from the account tag.
- Sticky header and sticky first column with opaque `--page` fill; `role="region"`, `tabindex="0"`, hidden caption; fixed 40px rows; two spacer rows for windowing; `max-height: 480px`.
- Kind filter reuses the native radio-in-label pattern; chips wrap at phone width (`flex-wrap: wrap`) with `min-height: 44px`.
- Perks renders four stacked cards in fixed order through the shared `NewDataCard`; a card never disappears.

Defects:
- **WARNING (WR-05)** `TimelineTable.svelte:97,314-328,391-393`: Entry is a fixed 360px column, `white-space: nowrap`, `overflow: hidden`, ellipsis, and no `title` or alternate path exposes the clipped text. Name-change entries (`OLD · NEW`) are the pane's core content and lose their tail first. The 40px-row constraint from `windowRange` rules out wrapping, so the width must give.
- **WARNING** The contract's approval flagged "add per-pane focal point" as a non-blocking item. Neither pane declares one: the first thing on screen is a muted 14px caption (`TIMELINE_INTRO`/`PERKS_INTRO`), then more muted captions, with the table as the only strong object. With a merge note, per-file lines, a mask block, an About disclosure and a chip row stacked above the table, the actual data is pushed below four or five secondary rows on a phone. No hierarchy device (size, weight, ink) separates the filter and showing line from the pane's explanatory prose.
- **WARNING** The merge note and per-file state lines are styled as undifferentiated 14px prose (`caption` muted for the note, `body info` with no visible chrome). A skipped file line looks identical to a helper sentence. Contract demanded words, not colour, so this is compliant, but nothing marks them as a state.
- The `.caption.hidden` showing line is absolutely positioned inside a flex column with `gap: 16px`; it still contributes to the flex gap count, which is harmless but means the gap before the table can be 16px larger than expected only when text is empty. Could not confirm without a render.

### Pillar 3: Color (4/4)

- Only token reads: `var(--text)`, `--muted`, `--faint`, `--border`, `--list`, `--page`, `--hover`, `--sel`, `--ink`, `--focus`, `--radius-control`.
- Hardcoded colour: `#c5221f`, `#fce8e6`, `#8a1c17` at `AccountTimelinePane.svelte:291-294` and `PerksPane.svelte:274-277` (2 files, 3 values each). This is the contract's sanctioned error panel and the comment records why it is repeated, but it is a third and fourth copy of the same literal group. A token would be the cleaner fix; not a score deduction since the contract allows it.
- Accent usage: selected chip is the only new accent consumer (`--sel` fill + `--ink` border + 3px inset bar), exactly as specified. Kind badges are identical in colour and differ only by word; no severity colour on bans.
- 60/30/10: dominant `--page`/`--list`, secondary `--border`/`--chip`, accent `--ink` only on the selected chip and card titles. No drift.

### Pillar 4: Typography (4/4)

- Distinct font sizes in the audited files: 14px only (every rule in the timeline pane, table, filter, Perks pane and the `NewDataCard` addition). The 12.5px list-row size predates this phase.
- Distinct weights: 400 (body, cells, captions) and 600 (headers, chips, badge, toggle, label). Matches the contract's four roles and two weights.
- Line-heights 1.4 and 1.5 as specified; the badge's 18px line is a documented exception.
- `tabular-nums` on table cells as specified. No new size or weight introduced.

### Pillar 5: Spacing (3/4)

Matches: 16px block gap in both panes, 8px chip gap, 4px label-to-chips gap, 4px tag margin, 12px cell padding, 40px rows, 240px/176px Date width at several-tags vs one-tag. The 64px extra for several-tags is declared in `TimelineTable.svelte:100`.

Defects:
- **WARNING** The mask toggle in both panes (`AccountTimelinePane.svelte:344-353`, `PerksPane.svelte:327-336`) uses `border-radius: 6px` and `padding: 8px 16px`. The contract's control radius is `var(--radius-control)` (8px) and the filter chips in the same pane use it, so the pane has two control radii side by side (button 6px, chips 8px). The 44px height comes only from the global `button, summary, a { min-height: 44px }` rule in `src/app.css`, so the contract's "one outlined 44px button" holds only if that global rule is not scoped to the phone block; it could not be verified without a render.
- **WARNING** Literal 6px radii on the table scroller and badge match the contract, but the 360px, 176px and 120px column widths are bare literals in both script and CSS (`TimelineTable.svelte:95-97,382-393`), duplicated by hand ("the classes below declare the same numbers"). The two must be edited together or the table's `min-width` will disagree with its columns.
- No arbitrary Tailwind-style values exist (no Tailwind in use); no off-scale spacing found.

### Pillar 6: Experience Design (2/4)

State coverage that works:
- Loading: `aria-busy` + one `role="status"` line carrying the loading sentence, no skeleton (matches the contract).
- Error: fixed sentence, `role="alert"`, no worker detail.
- Empty: per-card and per-file states with `data-status`, whole-pane-empty branch, presence-rule rows, and stale-dataset protection via `ShownBlock` stamped with `importedAt`.
- Filtering runs over in-memory entries, resets with the dataset by a pure read, and writes to no route or storage.
- Windowing past 500 entries with fixed 40px rows and bounded DOM; keyed by position where rows repeat across accounts.

Defects:
- **BLOCKER-adjacent (score driver)** Silent row loss (WR-02): unplaceable language/country rows are `continue`d (`timeline-aggregate.ts:267-274`) yet counted in `storedRows`; a file with zero resulting entries is still `ready`, so `isWholePaneEmpty` is false and the pane shows "Showing all 0 entries" above an empty table. This defeats the contract's own whole-pane-empty rule and the "Skipped" state.
- **WARNING** Dead interaction (IN-01): `canReveal` can never be true in the timeline, so the pane carries an entire unreachable control, announcement path and `onRevealChange` plumbing. The e2e spec asserts the toggle never appears, which confirms it is dead by design.
- **WARNING** Bans end date stored but unshown (WR-01): a user inspecting their own data cannot see whether a ban is open or ended, which is arguably the most consequential fact in the pane.
- **WARNING** Ghost rows (IN-03): an all-dropped row renders as a ready card with no columns.
- **WARNING** Millisecond precision discarded (IN-04): `ISO_TIMESTAMP_RE` ignores fractions, so events in the same second within a kind and file sort by input order while the intro promises "Newest first".
- **WARNING** No way to read clipped Entry text (WR-05), no copy/select affordance, no search. The contract explicitly excludes sort/search, so this is a gap in the contract as much as the build.
- Window scroll: `scrollTop` resets on every new `entries` array, so a chip change returns to top as intended, but the same effect also fires on dataset replace; fine.
- Registry audit: not applicable (`shadcn_initialized: false`, no third-party blocks).

---

## Files Audited

- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/features/account-timeline/AccountTimelinePane.svelte`
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/features/account-timeline/TimelineTable.svelte`
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/features/account-timeline/TimelineKindFilter.svelte`
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/features/new-data/PerksPane.svelte`
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/features/new-data/NewDataCard.svelte` (diff and styles only)
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/features/new-data/NewDataTable.svelte` (diff only)
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/shell/Dashboard.svelte` (mount points and `newDataSectionProps`)
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/ui-copy.ts` (Phase 12 strings)
- `/Users/you/src/github/wot-gdpr-stats-visualizer/src/app.css` (button floor rules, grep only)
- Baselines: `12-UI-SPEC.md`, `12-REVIEW.md`
- Not read in full (time-boxed): `12-CONTEXT.md`, the 13 PLAN/SUMMARY files, `timeline-aggregate.ts`, `timeline-state.ts`, `new-data-aggregate.ts` (their behaviour is taken from `12-REVIEW.md`, WR-01 to WR-05 and IN-01 to IN-05, which this audit confirms against the rendering code where possible).
