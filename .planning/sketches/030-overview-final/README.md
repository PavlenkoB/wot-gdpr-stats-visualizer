---
sketch: 030
name: overview-final
question: "What is the final Overview: B1 grouped bento + pinned tiles on top + R2 expand 'down in its column'?"
winner: "Final synthesis"
tags: [overview, bento, pinned, expand, final, synthesis]
---

# Sketch 030: Overview, final synthesis

Chosen path: 022-B (bento) -> 023-B1 (grouped) -> 025-G2 (pinned tiles + expand in place) -> 029-R2 (no jump, "down in its column").
Rejected along the way: side inspector (025-G1), popover/sheet explanations (028), 024/026/027 alternatives kept only as ideas for later chapters.

## How to View
`node .planning/sketches/_shared/gen-data.mjs` once, then `open .planning/sketches/030-overview-final/index.html`.

## Behaviour contract
- **Layout:** Pinned group first (full tiles), then Time, Tanks, Records, Money. Three tile sizes only (hero 2x2, feature 2x1, metric 1x1). Columns follow the DETAIL PANE (`container-type: inline-size` on `.detail`): >= 880 px 4 columns, 480-879 px 2 columns, < 480 px 1 column (spans reset to auto). Hero first in DOM so it is first on phone. Use the View buttons (Phone 375, Tablet 768, Narrow 900, Desktop 1280): pane widths 341 / 478 / 610 / 990.
- **Grid fill rule (decided 2026-10-22):** only FEATURE tiles widen; heroes and metrics never stretch (no single metric spans a row). `fillSpans(tiles)` in `_shared/model.js` (pure, node-testable) picks the feature widths with the fewest empty cells (rejecting widths that would reorder tiles), accepts holes no feature can fill, and writes `--span4`, `--rows4`, `--span2` through the CSSOM, recomputed on render and pin / unpin only. Signature hour follows the hero in the Time group. Same rule and same results as the design canvas.
- **Expand:** click a tile; it grows downward in its own column (x, y, width delta 0, measured), siblings keep their natural height while it is open (`.bento:has(.tile.open)`), content below moves down. Esc closes and returns focus to the tile.
- **Keyboard:** roving tabindex (one tabbable tile button; the star is `tabindex=-1`); arrows move (left / right in DOM order, up / down by position), Home / End, Enter / Space expand, **P** pins the focused tile (`aria-keyshortcuts="p"`, announced in the live region), Esc closes. Shows how it is computed, what it reads, and a link to the detail section.
- **No jump:** tiles are never re-rendered after the first paint (only moved/toggled); the page scroll is adjusted so the changed tile stays under the pointer; changes animate through the View Transitions API when available and `prefers-reduced-motion` is off; otherwise they apply instantly. State never depends on the animation: the change is applied by a 600 ms fallback if the transition callback does not run, and intent is recorded synchronously (two quick clicks = open then close).
- **Pins:** star toggles; pinned tiles move to the Pinned group in their original order and return to their own group on unpin; stored on this device (localStorage, guarded); default pins: Logged in, Most-played tank, Most damage. A pinned tile whose source is absent is hidden from Pinned.
- **Missing data:** tiles whose source file is missing become dashed "Not in this export" tiles (never a zero), cannot be pinned or expanded. Preview states: full, older export, almost empty.
- **Every figure carries its rule:** the rule line on the tile, the longer definition on expand.
- **Colour and elevation (2026-10-22):** colour is limited to a group dot beside headings and tile labels and an amber star on pinned tiles; tiles stay white, numbers ink, charts teal. Shadows are "lifted": rest `0 1px 2px .05`, hover (hover-capable devices only) `0 4px 12px .08` with the border unchanged, open `0 8px 24px .10` plus an ink edge (`border` + `outline`, so layout is unaffected). Hairlines stay. Matches the design canvas (https://claude.ai/artifact/BJc6oZ2QEQkphxoKkq1Pa1).
- **Phone two-up (optional, default off):** preview-bar control "Phone layout: one column | two-up". Only for panes 340-479 px: metric tiles two per row, hero and feature full width, `short` labels (Top damage, Top XP, Top kills, Top nation). An open metric tile grows downward inside its half-width column (no sideways move); readable, but leaves a tall blank cell beside it. Undecided.
- **Game-agnostic header:** game switcher (WoT active; Blitz / Warships stubbed).

## Measured on real data (724px pane)
Expand a tile in either column: clicked tile x 0, y 0, width 0, scroll 0; sibling tile moves 0 and changes height 0; only content below moves (147-187 px, animated). Phone 375px: one column, no horizontal overflow, same zero movement, all targets >= 44px. Console errors: none (an unhandled "Transition was skipped" rejection was found and fixed).

## Implications for the build (to verify when planning)
- **Tank names/classes:** spike 001's build-time table (WG API key in `.env.local`, ~19 KB gzip, keyed by tag AND numeric tank_id; retired tanks fall back). Terms of Use must be read before committing the generated table.
- **Sessions-derived figures** (logged days, longest session, busiest day, streak, signature hour, per-hour grid): derive from the same session rows Playtime reads; some are probably new aggregates. Rules: union of intervals across ALL account folders; wall clock, no timezone; never sum lifetime stats across two exports.
- **Account/vehicle records** (`DAMAGE_MAX`, `XP_MAX`, `FRAGS_MAX`, `*_SERIES_MAX`, `MAX_*_VEHICLE`): check they are in the ingest allowlist; `MAX_*_VEHICLE` are numeric tank_ids.
- **Sensitive by default:** orders and chat = counts only; no clan names, bans or amounts on the Overview.
- **CSP:** no `style=""` attributes; set positions/names through CSSOM (`el.style.x = ...`) as `ChartTooltip` does; View Transition names are set that way here.
- **Model:** one pure module building the insight list from already-loaded aggregates (unit-testable in node, like `overview-model.ts`), one Svelte tile component, one grid; no new runtime dependency.

## What to look for
- Is the Pinned group (full tiles) right as the first thing people see, or should the hero Time tile come first for a fresh import with default pins?
- Are the default pins right?
- Anything in the tile set that should be added or dropped before planning?

## Measured after the container / fill / keyboard / two-up pass (2026-10-22)
- Pane widths 1040 / 880 / 879 / 600 / 480 / 479 / 340 px give 4 / 4 / 2 / 2 / 2 / 1 / 1 columns; metric labels wrap to 2 lines at most at 880 px (4 columns); no horizontal overflow at any of them.
- Holes: 288 DOM configurations (3 preview states x 24 pin sets x 3 widths, plus two-up) have 0 empty or overlapping cells; node simulation over every pin subset x state (1,370 distinct size sequences) has 0 holes at 4 and 2 columns.
- Expanding any tile (16 of 16, full and older export, 4 / 2 / 1 columns and two-up): clicked tile x, y, width and scroll delta 0, no span changes, siblings keep x and width.
- Two-up at a 340 px pane: label vs star overlap 0, horizontal overflow 0, open tiles 301-376 px tall.
- Also fixed: the class-split bar was empty (`.blk` beat `.stack`).

## Review fixes applied (2026-10-22)
From the design review: lightness-monotonic value scale + legend + peak labels over the peak bar; star with fixed label, `aria-pressed` and a live-region announcement; tile buttons contain only spans, charts `aria-hidden` with a hidden text summary; absent tiles collapse into one dashed row per group; group "Money" renamed "Totals"; wording ("one login to logout", "(24-hour days)", "880 million"); tabular numerals; 12 px axis text; long values at 22 px; forced-colors rules. Still open: first-five-seconds polish (game switcher weight, expand chevron), forced-colors polish, dark-mode variables, and the decision on phone two-up. See `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/overview-insights.md`.
