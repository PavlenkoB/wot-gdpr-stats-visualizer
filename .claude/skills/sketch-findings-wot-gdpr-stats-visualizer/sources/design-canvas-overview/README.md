# Overview design canvas (final direction)

Live: https://claude.ai/artifact/BJc6oZ2QEQkphxoKkq1Pa1 (private to the owner). Five artboards, all with INVENTED placeholder numbers (not a real player's):

- `Main.dc.html`: Overview, interactive (click a tile, star to pin). Tweaks: `accents` (group dots on/off), `density`, `elevation` (none | soft | lifted, default lifted).
- `Phone.dc.html`: Overview on phone (390px, single column, one tile open, soft shadow).
- `PhoneTwoUp.dc.html`: proposal, not a replacement: phone Overview with metric tiles two per row (hero and feature tiles full width, shorter metric labels such as Top damage / Top XP / Top kills, a lone last metric spans both columns, one metric tile open). An open metric tile grows downward inside its own half-width column. Verdict: it works and never moves sideways, but the text measure is about 18 characters and the neighbour leaves a blank gap under it (about 250 px for a 5-line definition), so it reads acceptably for short definitions and badly for long ones.
- `TileSystem.dc.html`: the tile system spec (three sizes, anatomy, four states, colour rule, behaviour).
- `AlmostEmpty.dc.html`: an export with only sessions; absent tiles are dashed "not in this export"; pinned tiles that are absent drop out of Pinned.
- `canvas.json`: layout index (frame positions: first row Main, Phone, PhoneTwoUp; second row TileSystem, AlmostEmpty, 120 px below the tallest first-row frame).

## Grid rules in `Main.dc.html` (container queries, not viewport media queries)

- The `<main>` content element is the container (`container: ov / inline-size`, padding lives on an inner div so the thresholds are the element's own width). Thresholds: 4 columns at 880 px and up, 2 columns from 480 to 879 px, 1 column below 480 px (the nav is 240 px wide and the content has a 560 px basis, so with the nav beside the content 4 columns start at viewport 1120; below viewport 800 the nav wraps above and the content is the full viewport width). Hero = 2 columns by 2 rows, feature = 2 columns, metric = 1 (spans reset to auto in 1 column).
- The top-5 rows use `22px minmax(0,1fr) clamp(60px,30%,150px) 60px`; below 440 px container width the bar drops under the name (same as the phone artboard) so the name column never collapses.
- Row-fill rule (2026-10-22): ONLY FEATURE tiles widen; heroes and metrics never stretch, so no single metric spans a row. `fillSpans(sizes, columns)` in `renderVals` simulates dense auto-placement, tries every feature width, rejects widths that reorder tiles visually, and keeps the combination with the fewest holes, then the least widening. Holes no feature can fill are accepted. It returns `--span4/--rows4` and `--span2/--rows2` custom properties set on the affected tile wrapper and consumed by the container query rules. Spans depend only on tile sizes, never on open state. The Pinned section is sorted hero, feature, metric. Signature hour follows the hero in Time, so Time (default pins) is Signature hour 4 wide plus 3 metrics (1 empty cell). The phone two-up board never stretches a lone last metric either (it leaves an empty half cell).


These are Design-canvas component files (they need the canvas runtime's `support.js`), so they are reference source, not runnable alone. They supersede the Overview card-grid artboards (`../design-canvas/Alt-B-Overview.dc.html`, `Color-10-Ink.dc.html`) for the Overview only; the shell, list pane and palette decisions there still stand.
