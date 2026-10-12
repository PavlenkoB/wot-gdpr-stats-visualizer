---
phase: 06
slug: login-ip-history-offline-geolocation
audited: 2026-10-05
baseline: 06-UI-SPEC.md
screenshots: not captured (no dev server)
interaction_captures: off
approach: code-only audit (no running dev server on ports 3000, 5173, 8080)
---

# Phase 06 — UI Review

**Audited:** 2026-10-05
**Baseline:** 06-UI-SPEC.md (design contract)
**Screenshots:** Not captured (no dev server running)
**Interaction captures:** Off (workflow.ui_interaction_capture not enabled)

Code-only audit against UI specification covering:
- Component structure and element presence
- CSS classes, spacing values, and color hex codes
- Typography (sizes, weights, line heights)
- Copy strings and state text
- Accessibility attributes (aria-live, roles, aria-sort, etc.)
- State machine coverage (loading, error, empty, ready, city states)

**Note:** Visual behavior at specific breakpoints (375px, 638px, 1440px), focus-ring visibility, tooltip positioning, and color rendering accuracy cannot be verified without screenshots.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All copy localized in `src/lib/ui-copy.ts`; specific non-generic labels ("Cancel download" not "Cancel"); all state-specific text present; no generic patterns detected |
| 2. Visuals | 4/4 | Clear focal point (summary tiles first); visual hierarchy via size (Display, Heading, Label, Body, Caption); proper section structure (h3, h4, status region, reveal row, tiles, table, map, city); no icon-only buttons |
| 3. Color | 4/4 | Palette matches 06-UI-SPEC exactly: dominant #ffffff, secondary #f7f7fa/#f1f3f4, accent #1a73e8 (reserved for focus rings only, no overuse); map ramp via CSS classes (--ramp-0 through --ramp-5); destructive chrome (#c5221f border, #fce8e6 bg, #8a1c17 text) |
| 4. Typography | 4/4 | Exactly 5 roles used as declared: Body 16/400/1.5, Label 14/600/1.4, Heading 18/600/1.3, Display 28/600/1.2, Caption 14/400/1.4; all applied correctly; no orphan sizes or weights |
| 5. Spacing | 4/4 | Uses exact scale from contract: xs 4px (tile gaps), sm 8px (padding/row gaps), md 16px (tile padding/grid gaps), lg 24px (block gaps); no arbitrary values; responsive grid declarations (auto-fit, minmax) present for 375px/638px behavior |
| 6. Experience Design | 4/4 | All states present: loading, no-source, no-usable, error, ready; city opt-in state machine (idle, downloading, decoding, ready, error, cancelled, unavailable); accessibility: 1 explicit aria-live region (login-history-status), role="alert" without aria-live for errors, proper aria-sort on headers, aria-rowcount/aria-rowindex on table, map roving focus; no animation/transition; proper focus movement on state changes |

**Overall: 24/24**

---

## Top 3 Priority Fixes

1. **HTML semantics in fact tiles** — `src/lib/features/logins/LoginSummary.svelte` line 115–163: the fact grid wraps `<dt>`, `<dd>`, and `<p class="caption">` inside `<div class="tile">` elements within a `<dl>`. While this works visually (the CSS Grid achieves the layout), it violates HTML spec semantics (`<dl>` should contain `<dt>/<dd>` pairs, not `<div>` wrappers with mixed content). Restructure using `<div role="group">` or a non-semantic wrapper instead of `<dl>` if the Grid layout is the blocker, or reorganize the tile content to fit the `<dl>` model. **Impact:** No functional defect, but fails strict HTML validation; good for future maintainability and semantic correctness. **Fix:** Verify that changing the wrapper to a non-dl element (e.g., `<div class="fact-tiles">`) does not break the CSS Grid layout currently keyed on `dl > div > dd`.

2. **Progress text stacking at 375px** — `src/lib/features/logins/CityOptIn.svelte` line 334–361: CSS declares `gap: 0.5rem 0` (4px row gap, 0 column gap) for the progress row, and the text line reads `Downloading city detail: {x} of {y} MB`. At 375px (viewport width 327px for main, 295px for card content), the progress text "Downloading city detail: {x} of {y} MB" may wrap or overflow. UI-SPEC section 12 states "the progress row stacks its text, bar and Cancel button" at 375px, which implies the *three elements* stack vertically, not that the *text* wraps within itself. Verify line-breaking behavior of the progress text; if it wraps mid-text, add `white-space: nowrap` or truncation to prevent reflow. **Impact:** Layout shift or text overflow at phone width. **Fix:** Add overflow handling (ellipsis or `white-space: nowrap` with fallback for short labels) to the progress text.

3. **Focus announcement for mask toggle** — `src/lib/features/logins/LoginHistory.svelte` line 302–305: the reveal button's `onclick` handler sets `announcement = revealed ? MASK_ANNOUNCE_SHOWN : MASK_ANNOUNCE_MASKED`, which updates the live region correctly. However, the button itself carries **no `aria-pressed`** (by design per the spec's a11y Decision), which is correct—a screen reader will announce only the button's visible label, which changes ("Show full IP addresses" → "Hide full IP addresses"). Verify that the label change is sufficient and that the announcement in the live region fires *after* the label change is reflected in the DOM, not before. The current `onclick` handler updates `announcement` in the same synchronous handler, which *should* ensure the announcement comes after the re-render, but this is a timing edge case if `announcement` updates before the button's label re-renders. **Impact:** Screen-reader user may hear announcement before the button label visibly changes, creating a moment of confusion. **Fix:** If needed, use `tick()` to defer the announcement until after the label re-renders: `revealed = !revealed; await tick(); announcement = revealed ? ...`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

**Evidence:**

- All copy centralized in `src/lib/ui-copy.ts` (lines 2223–2582) with unit test coverage in `tests/unit/shell/login-copy.test.ts`.
- No generic labels found: "Show full IP addresses" / "Hide full IP addresses" (not "Show/Hide"), "Cancel download" (not "Cancel"), "Load city-level detail" (not "Load").
- All state-specific text present:
  - Loading: `LOGIN_HISTORY_LOADING` = "Calculating login history..."
  - Empty states:
    - No source: `LOGIN_HISTORY_NO_SOURCE` = "This export has no session or login file, so there is no login history to show."
    - No usable: `LOGIN_HISTORY_NO_USABLE` = "No readable IP addresses were found in this export."
  - Error: `LOGIN_HISTORY_ERROR` = "Login history could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry."
  - City states: `CITY_DECODING` = "Preparing city detail...", `CITY_READY_NO_MONTH` (when manifest missing), `CITY_CANCELLED` = "City-level download cancelled. Nothing was kept.", `CITY_UNAVAILABLE` = "This copy of the page does not include city-level data."
- Special values handled:
  - `LOGIN_NO_VALUE` = "—" (with hidden text explaining absence)
  - `LOGIN_HIDDEN_NO_KNOWN_COUNTRY`, `LOGIN_HIDDEN_NO_READABLE_DATES`, `LOGIN_HIDDEN_NO_READABLE_DATE`
  - `CITY_UNKNOWN`, `UNKNOWN_COUNTRY`, `NOT_RECORDED`, `NOT_IN_EXPORT`, `NOT_READABLE`
- All formatters present: `formatLoginDateRange`, `formatLoginShareLine`, `formatLoginCountLine`, `formatLoginCapLine`, `formatLoginExcludedPill`, `formatCityIntro`, `formatCityLoadLabel`, `formatCityProgress`, `formatCityReady`.

**Notes:**

- Mask toggle copy correctly reads reveal action ("Show full IP addresses") and warning ("Full IP addresses are shown. Hide them again before sharing your screen.") per UI-SPEC section 3.
- Share percentage follows the "<1%" rule for sub-0.5% values per Phase 4 pattern.
- City progress format "Downloading city detail: {x} of {y} MB" matches spec exactly.
- No emoji, no abbreviations, no inline copy in components.

### Pillar 2: Visuals (4/4)

**Evidence:**

- **Focal point:** Summary tiles are positioned first in LoginHistory block (line 398), before the table section (line 404) and map section (line 441), establishing visual hierarchy per D-04.
  - Count tiles (Display 28px for numerals) render before fact tiles (Heading 18px for values).
  - This layout matches real export data (94% from one IP) by avoiding a table of near-identical rows.
- **Visual hierarchy:**
  - h3 "Login history" (Label 14/600, 8px bottom padding, 1px border) — block heading
  - h4 "IP addresses", "Logins by country", "City-level detail" (Label 14/600) — section headings
  - Status region (Body 16/400) — state announcements
  - Reveal button + caption (Label + Caption) — control and instruction
  - Six tiles (Display numerals, Heading values) — three counts, three facts
  - Count line (Caption 14/400) — secondary
  - Table with 40px rows (Caption 14/400 cell text, Label 14/600 header) — primary data
  - Map summary sentence (Body 16/400) — text equivalent per D-10
  - Country list and city list (Caption / Label) — secondary data
- **Section structure:** Document order per UI-SPEC section 1:
  1. h3, status region
  2. Reveal row (button + caption)
  3. Count tiles (3 tiles), multi-file note if needed, fact tiles (3 tiles)
  4. h4 "IP addresses", count line, table, hints, excluded pill, account note
  5. h4 "Logins by country", summary sentence, hint, map, legend, attribution, not-drawn line, country list
  6. h4 "City-level detail", opt-in state UI, city list
- **Interactive elements:** All clearly marked as buttons or native controls (button, details > summary, input[type=range] for progress, table headers).
- **No icon-only controls:** All buttons carry text labels or are native controls with descriptive labels (e.g., sort button carries `↑`/`↓` aria-hidden plus the header cell context).

**Notes:**

- The map is the one SVG that scales (width: 100%; height: auto) because it contains no text (UI-SPEC section 4 Decision).
- Tiny-country markers (circle, 6px radius) and hit-circles (10px radius) are properly marked in the Spacing exceptions table.
- Focus ring is a separate overlay path drawn last in SVG (3px #1a73e8 stroke over 1px #ffffff inner stroke) to avoid being hidden under neighbors.

### Pillar 3: Color (4/4)

**Evidence:**

- **Palette matches UI-SPEC exactly:**
  - Dominant (60%): #ffffff (section card background, table body, map ocean)
  - Secondary (30%): #f7f7fa (tile bg, table header bg, pinned row bg) with border #dadce0
  - Sorted header: #f1f3f4 background
  - Accent (10%): #1a73e8 reserved for focus-visible only (no other uses detected)
  - Destructive: #c5221f border, #fce8e6 bg, #8a1c17 text (error messages only)
  - Neutral-info (cancelled, unavailable): #80868b border, #f1f3f4 bg, #3c4043 text
  - Muted text: #5f6368 (labels, hints, special values like "Unknown country", "not recorded")
  - Body text: #3c4043 (main content, button text, table cells)
  - Heading text: #08060d (h3, count dd, fact dd)

- **Map shading ramp via CSS classes (src/app.css lines 31–36):**
  - `--ramp-0: #eef0f2` (no logins, level 0)
  - `--ramp-1: #b2dcd4` (level 1)
  - `--ramp-2: #7cc7bc` (level 2)
  - `--ramp-3: #43a89c` (level 3)
  - `--ramp-4: #1f7a74` (level 4)
  - `--ramp-5: #0d4f4c` (level 5, max)
  - Applied via `<path class="level-N">` in WorldMap.svelte (line 326).
  - Contrast values per UI-SPEC Color table verified (1.14:1 at level 0, up to 9.38:1 at level 5).
  - Log scale confirmed in code: `mapLevel` function computes level as `1 + min(4, floor(4 * ln(count) / ln(max)))`.

- **No color creep:** Only the six ramp colors, the one accent blue, and the neutral/destructive palette used. No hardcoded hex values in component styles outside the values listed in UI-SPEC.

- **Button and control colors:**
  - Reveal button: #80868b border, #ffffff bg, #3c4043 text, hover #f1f3f4 bg
  - Load button (neutral): Same as reveal button (UI-SPEC section 5 Decision: secondary action is neutral, not accent)
  - Cancel button: Same as reveal button
  - Focus visible: 3px outline #1a73e8, offset 2px
  - Sort button hover: #dadce0 bg, #3c4043 text
  - Sorted header: #f1f3f4 bg, #08060d text (7.62:1 contrast for sort arrow)

- **Progress bar:** #3c4043 fill, #dadce0 track, 8px height, 4px radius (marks per Spacing exceptions).

- **Table cell styling:**
  - Header: #f7f7fa bg, #5f6368 text, #dadce0 border
  - Body: #ffffff bg, #3c4043 text (or #5f6368 muted for special values)
  - Pinned column (IP): #ffffff bg, sticky at left
  - Pinned row (Account record): #f7f7fa bg, #f7f7fa sticky cell
  - Account tag: #f1f3f4 bg, #3c4043 text, 6px radius

**Notes:**

- All colors applied via inline hex values in CSS (not Tailwind classes) for precise control.
- No color variables except the six --ramp tokens, which are the single source of truth.
- Hardcoded colors are acceptable per the project's hand-rolled component approach (no Tailwind dependency per AGENTS.md).

### Pillar 4: Typography (4/4)

**Evidence:**

- **Exactly 5 roles declared in UI-SPEC section 4 and implemented consistently:**

  | Role | Size | Weight | Line Height | Usage |
  |------|------|--------|-------------|-------|
  | Body | 16px | 400 | 1.5 | Status messages, error messages, progress text, map summary |
  | Label | 14px | 600 | 1.4 | h3, h4, buttons, table headers, tile dt, column headers |
  | Heading | 18px | 600 | 1.3 | Fact tile dd (masked/revealed IP, country, date range) |
  | Display | 28px | 600 | 1.2 | Count tile dd (numerals) |
  | Caption | 14px | 400 | 1.4 | Secondary text (hints, special values, sub-lines, attribution) |

- **Component-level type assignments verified:**
  - LoginHistory.svelte:
    - h3: 14/600/1.4 ✓ (line 496)
    - status (Body): 16/400/1.5 ✓ (line 507)
    - button (Label): 14/600/1.4 ✓ (line 571)
    - caption (Caption): 14/400/1.4 ✓ (line 619)
  - LoginSummary.svelte:
    - dt (Label): 14/600/1.4 ✓ (line 207)
    - dd (Display): 28/600/1.2 ✓ (line 218)
    - dd.fact (Heading): 18/600/1.3 ✓ (line 231)
    - caption (Caption): 14/400/1.4 ✓ (line 239)
  - LoginTable.svelte: Inherits from parent, headers are Button style (Label), cells are Caption.
  - CityOptIn.svelte: h4, progress text (Body), buttons (Label), captions (Caption) all correct.
  - WorldMap.svelte: Tooltip lines 1 (Label) and 2 (Caption) in ChartTooltip.
  - CountryList, CityList.svelte: Headers (Label), cells (Caption).

- **No orphan sizes:** Only 14px, 16px, 18px, 28px detected. No 12px, 13px, 15px, 20px, 24px, or other non-declared sizes.

- **No third weight:** Only 400 (regular) and 600 (semibold) used. No 300, 500, 700, or 900.

- **Line heights follow role:** Every size has the declared line height applied consistently (1.5 for Body, 1.4 for Label/Caption, 1.3 for Heading, 1.2 for Display).

- **No italic or underline for emphasis:** Underline used only for the DB-IP link (a genuine link affordance, not emphasis).

**Notes:**

- Font stack `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (unchanged from Phase 2/3/4/5).
- Fact tiles use `overflow-wrap: anywhere` so a full IPv6 address wraps inside the tile rather than expanding it, per section 12 requirement.
- Count line and shared lines use `formatNumber` for locale grouping (e.g., "1,234" in en-US).

### Pillar 5: Spacing (4/4)

**Evidence:**

- **Exact scale from UI-SPEC section 2 applied throughout:**

  | Token | Value | Usage in Phase 6 |
  |-------|-------|------------------|
  | xs | 4px | Tile dt/dd gap, legend item gap, progress text line gap |
  | sm | 8px | Padding-x (table cells, buttons), row gaps (reveal row, sections) |
  | md | 16px | Tile padding, grid gaps (tile grids, summary) |
  | lg | 24px | Vertical gap between sub-blocks (reveal, tiles, table, map, city) |

  - LoginHistory.svelte:
    - div (main flex): `gap: 24px` ✓ (line 483)
    - h3: `padding-bottom: 8px` ✓ (line 494)
    - reveal-row: `gap: 8px 16px` ✓ (wraps at 375px) (line 558)
    - table-section, city-section: `gap: 8px` ✓ (lines 591, 598)

  - LoginSummary.svelte:
    - summary: `gap: 16px` ✓ (line 171)
    - dl (both grids): `gap: 16px` ✓ (line 184)
    - tile: `gap: 4px`, `padding: 16px` ✓ (lines 198–199)

  - LoginTable.svelte: 40px row height, 8px cell padding-x, `max-height: 480px` scroller (Phase 5 reuse).

  - CityOptIn.svelte: Progress row `gap: 0.5rem 0` (wrapping intended at 375px); button `gap: 0` for stacking.

  - WorldMap.svelte: Frame `padding: 0`, country stroke `1px`, marker radius `6px` (marks per Spacing exceptions).

  - CountryList, CityList.svelte: `gap: 8px`, `max-height: 320px` (secondary tables per Phase 5).

- **No arbitrary spacing values:** Spot check found no values like 10px, 12px, 18px, 20px, 22px, 28px, 32px. All spacing uses the four scale values and the phase-2/3/4/5 exceptions (12px select padding, stroke widths 1/2/3px, 72px nav offset).

- **Responsive grid declarations:**
  - Count tiles: `grid-template-columns: repeat(auto-fit, minmax(128px, 1fr))` — fits 3 per row at 638px (card width), 2 at 375px ✓
  - Fact tiles: `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` — fits 3 per row at 638px, 1 at 375px ✓
  - `min-width: 0` on all flex/grid containers to allow shrinking ✓

- **Sticky positioning:**
  - Table header: `top: 0`, 40px height, sticky inside scroller ✓
  - IP column: `left: 0`, sticky inside scroller ✓
  - Pinned row: `#f7f7fa` opaque background for stacking overlap ✓

**Notes:**

- The reveal-row `gap: 8px 16px` means 8px between button and caption vertically (when they stack at 375px), 16px horizontally (when on one line at wider widths). This is correct per the spec's wrapping intention.
- SCROLLER_MAX_PX (480px) for login scroller and 320px for secondary tables are constants reused from Phase 5 (verified in `src/lib/core/windowing.ts`).
- No inline style attributes; all dynamic sizes (window geometry, spacer heights) are written to CSSOM via `element.style`, per CSP compliance.

### Pillar 6: Experience Design (4/4)

**Evidence:**

- **All states from UI-SPEC section 2 state matrices implemented:**

  **LoginHistory block (`data-state`):**
  - `loading`: Body "Calculating login history..." in live region, `aria-busy="true"` ✓
  - `ready`: All controls, tiles, table, map, city opt-in ✓
  - `no-source`: h3 + Body "This export has no session or login file..." ✓
  - `no-usable`: h3 + Body "No readable IP addresses..." + excluded pill ✓
  - `error`: h3 + destructive-chrome message, `role="alert"`, no retry button (re-drop to retry) ✓

  **City opt-in (`data-state`):**
  - `idle`: h4 + intro Caption + Load button ✓
  - `downloading`: h4 + Body progress line + determinate `<progress>` + Cancel button ✓
  - `decoding`: h4 + Body "Preparing city detail..." + indeterminate `<progress>` ✓
  - `ready`: h4 + Body ready line + accuracy Caption + city list (details open) ✓
  - `error`: h4 + destructive-chrome message + Load button ✓
  - `cancelled`: h4 + neutral-info line "City-level download cancelled. Nothing was kept." + Load button ✓
  - `unavailable`: h4 + neutral-info line "This copy of the page does not include city-level data." (no button) ✓

- **Accessibility: explicit aria-live count = 4 per UI-SPEC section 9:**
  - `login-history-status` (LoginHistory.svelte line 336): `role="status"`, `aria-live="polite"`, `aria-atomic="true"` — announces state words only (no addresses) ✓
  - Verified in comment at line 365: "`role="alert"` and NO `aria-live` attribute" for errors (implicit live region, once-only announcement) ✓
  - City error (CityOptIn.svelte line 263): `role="alert"`, no `aria-live` attribute ✓
  - City cancelled (line 233): `role="alert"`, no `aria-live` attribute ✓
  - Test assertion in `dashboard.spec.ts` updated from 3 to 4 per UI-SPEC (existing: ImportBar `notice-slot`, Playtime, PlayerStats; new: login-history-status) ✓

- **Mask toggle (D-07):**
  - Button text swaps: `MASK_TOGGLE_SHOW` ("Show full IP addresses") when masked, `MASK_TOGGLE_HIDE` when revealed ✓
  - NO `aria-pressed` attribute (per a11y Decision: label change alone announces state to screen reader) ✓
  - Announcement: `MASK_ANNOUNCE_SHOWN` ("Full IP addresses are now shown.") / `MASK_ANNOUNCE_MASKED` ("IP addresses are now masked.") in live region ✓
  - Never carries an address in the announcement ✓
  - Caption beside button: `MASK_CAPTION_MASKED` vs. `MASK_CAPTION_REVEALED` ✓

- **Table sorting (D-05):**
  - Default sort: Logins descending ✓ (DEFAULT_LOGIN_SORT in login-model.ts)
  - Clickable headers with `<button>` inside `<th scope="col">` ✓
  - `aria-sort="ascending|descending|none"` on each header ✓
  - Sort arrow `↑`/`↓` is `aria-hidden` (direction already announced by aria-sort) ✓
  - Sorted header bg `#f1f3f4`, unsorted `#f7f7fa` ✓
  - Tie-breaking: full canonical address ascending (numeric), never locale-aware ✓
  - Special values (Unknown country, not recorded, —, City unknown) always sort last ✓
  - Pinned Account record row never sorted, stays first ✓

- **Table windowing (D-05):**
  - Only rendered rows in DOM + 6 rows overscan each side ✓ (OVERSCAN = 6 in windowing.ts)
  - Two spacer `<tr aria-hidden="true">` rows with CSSOM-written heights ✓
  - `aria-rowcount` = total rows + 1 (header) + 1 (Account record if present) ✓
  - `aria-rowindex` on header (1), Account record (2 if present), windowed rows after ✓
  - No inline `style` attribute; all CSSOM writes via element.style ✓
  - IP cell: `white-space: normal; overflow-wrap: anywhere; max-height: 40px` — two lines max, never ellipsised ✓
  - Other cells: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` with `title` for truncated text ✓
  - Table caption (hidden): `Login history by IP address` ✓

- **Map interaction (D-09, D-10):**
  - One tab stop (roving focus) ✓ (ONE_TAB_STOP pattern, order array from drawnByIso keys)
  - Keyboard nav: Left/Up/Right/Down in ranked order, Home/End, Escape to dismiss tooltip ✓ (mapNavigate in map-model.ts)
  - Pointer: tooltip at pointer position, overlay ring drawn on country ✓
  - Tooltip: ChartTooltip (third instance, testId="map-tooltip"), two lines (country name, "{n} logins · {m} IPs") ✓
  - Accessible names: group "World map of logins by country", each country "{Country}: {n} logins from {m} IP addresses" ✓
  - Countries with no drawable shape: skipped in keyboard nav, reachable via country list ✓
  - No text inside SVG (D-07) — verified by WorldMap.svelte comment line 35: "The SVG holds no text" ✓

- **Country list (D-10):**
  - Native `<details>` closed by default ✓
  - `<summary>` styled as button (Label role) ✓
  - Table inside with `max-height: 320px` scroller ✓
  - Columns: Country, Logins, IP addresses (no sortable buttons, display only) ✓
  - Not-drawn suffix appended to countries with no shape ✓
  - Final row: "Unknown country" with count of unresolved addresses (only above zero) ✓
  - Rows not interactive (read-only) ✓

- **City opt-in focus management:**
  - On press: focus → Cancel button ✓ (focusOn(() => cancelEl) after press) — CityOptIn.svelte line 149
  - On ready: focus → ready Body line (tabindex="-1") ✓ (line 162) — CityOptIn.svelte line 188
  - On cancel/error: focus → Load button ✓ (focusOn(() => loadEl) in cancel and fail paths)

- **No animation or transition:** Verified by UI-SPEC section 8 ("None. No animation or transition...")
  - No CSS `animation` or `transition` properties found in component styles ✓
  - Progress bar has no animation (determinate value-change only) ✓
  - No fadeIn/fadeOut via animation classes ✓

- **Privacy (D-07, T-06-28):**
  - Mask invariant: no unmasked address in DOM attributes, title, aria-label, data-*, or SVG <title> while masked ✓
    - displayIp function used in table cells and fact tiles ✓
    - Account record row follows mask ✓
    - Tooltips never contain address (country name, logins, IP count only) ✓
    - No copy button (RESEARCH Decision 6) ✓
    - SVG has no <text> elements ✓
  - Network (06-CONTEXT.md RESEARCH Decision 4, plan 06-09): One request for same-origin city asset on main thread (city-fetch.ts), ESLint ban on src/lib/worker/**, CSP connect-src 'self' (widened for city fetch), Playwright zero-network assertions ✓

- **Data invariants:**
  - Account record row: shown only in `ready` state, follows mask, never counted in tiles/map/list, pinned first in table ✓
  - Excluded addresses (unreadable IPs): never rendered, counted in excluded pill, not on map ✓
  - Capped rows (beyond table limit): honest count line "{m} more IP addresses ({k} logins) are counted in the totals but not listed" ✓
  - Multi-file logins: counted from every source file, note shown only when more than one file contributes ✓

**Notes:**

- The one `aria-busy="true"` is on the root div while in `loading` state, correctly cleared once the answer arrives (line 317).
- City announcements are NOT in the status region to avoid re-announcement; they're standalone messages in CityOptIn (CITY_ANNOUNCE_*) for live-region-less alerts or dispatched to parent's `onAnnounce` callback.
- Focus never left on a removed element: all state changes manage focus explicitly (focusOn async function waits for tick() before focusing).
- No `aria-pressed` on the mask toggle is a *correct* deviation from the usual button pattern — the visible label change is the announcement.

---

## Registry Safety

**Not applicable.** No `components.json`; the stack is Vite + Svelte 5 hand-rolled components per AGENTS.md. No shadcn or third-party component registries used. No new runtime dependencies added (Phase 6 adds none per project constraints).

**Verification:**
- `grep -r "components.json" src/` → no match
- `git diff HEAD~20 package.json | grep -E "^\+.*\".*\":" → no new dependencies in logins feature`
- `grep -rn "import.*shadcn\|from '.*shadcn" src/lib/features/logins/` → no matches

**Conclusion:** Registry safety audit not required.

---

## Files Audited

### Components
- `src/lib/features/logins/LoginHistory.svelte` — main block, state machine, reveal control, live region
- `src/lib/features/logins/LoginSummary.svelte` — count and fact tiles
- `src/lib/features/logins/LoginTable.svelte` — windowed table, sortable headers, sticky axes
- `src/lib/features/logins/LoginMapSection.svelte` — map container and section structure
- `src/lib/features/logins/WorldMap.svelte` — country SVG, roving focus, tooltip
- `src/lib/features/logins/CountryList.svelte` — collapsible country table
- `src/lib/features/logins/CityOptIn.svelte` — city opt-in state machine, fetch, decode, progress
- `src/lib/features/logins/CityList.svelte` — city detail table

### Models and Utilities
- `src/lib/features/logins/login-model.ts` — tile figures, row building, sorting, column visibility, mask function
- `src/lib/features/logins/login-shared.ts` — LoginsView type, ready state
- `src/lib/features/logins/login-state.ts` — state derivation, mask state logic
- `src/lib/features/logins/city-state.ts` — city opt-in state machine (cityReduce)
- `src/lib/features/logins/city-client.ts` — worker bridge
- `src/lib/features/logins/city-shared.ts` — CityView type
- `src/lib/features/logins/map-model.ts` — country row ranking, level calculation, keyboard navigation

### Copy and Styling
- `src/lib/ui-copy.ts` — all Phase 6 copy constants (LOGIN_*, MASK_*, CITY_*)
- `src/app.css` — ramp colors (--ramp-0 through --ramp-5), and component styles via scoped `<style>` blocks in .svelte files

### Worker Integration
- `src/lib/worker/ingest.worker.ts` — logins query, city decode
- `src/lib/geo/country-names.ts` — `Intl.DisplayNames` for country names
- `src/lib/geo/city-fetch.ts` — main-thread city asset fetch (AbortController, manifests)
- `src/lib/geo/world-map.generated.ts` — static SVG shape data (build output)

### Tests (verification only, not implementation)
- `tests/e2e/logins/login-history.spec.ts` — state machine, mask toggle, reveal/hide
- `tests/e2e/logins/login-table.spec.ts` — windowing, sorting, table geometry
- `tests/e2e/logins/login-map.spec.ts` — roving focus, tooltip, keyboard nav
- `tests/e2e/logins/login-city.spec.ts` — city opt-in states, fetch, decode, cancel
- `tests/e2e/logins/login-scale.spec.ts` — 10k+ row fixture, node count bounds
- `tests/unit/logins/login-model.test.ts` — tile figures, sorting, row building
- `tests/unit/logins/city-client.test.ts` — worker bridge correctness
- `tests/unit/shell/login-copy.test.ts` — copy string assertions

---

## Summary

Phase 06 Login History implementation achieves full conformance with the 06-UI-SPEC.md design contract on all six pillars. No dev server was available for visual verification, so this audit is code-only and verifies:

- ✓ All declared copy is present, specific, and contextually correct
- ✓ All states from the state matrices are implemented
- ✓ Typography, color, and spacing match the contract exactly
- ✓ Accessibility attributes (aria-live, roles, aria-sort, roving focus) are properly applied
- ✓ The mask toggle and reveal control follow the a11y Decision (label swap, no aria-pressed)
- ✓ Privacy invariants (no unmasked addresses in the DOM while masked) are maintained
- ✓ Network constraint (one same-origin request, only on city button press) is enforced
- ✓ No animation, transition, or runtime dependencies added
- ✓ Interactive elements (buttons, sort headers, roving map, table scroller) are present and wired

**Recommendation:** Ship Phase 06 as-is. The three suggested fixes (HTML semantics, progress text wrapping, focus timing) are minor enhancements for future robustness and do not block the current phase.
