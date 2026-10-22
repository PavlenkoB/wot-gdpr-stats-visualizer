# Visual Language

Final palette chosen 2026-10-07: **"Day 10, ink + teal (ramp kept)"**. Chrome is neutral ink on white; data stays in the app's existing teal ramp. Verified against `src/` and `src/app.css`; where a sketch disagrees with the app, the app wins.

## Design Decisions
- **Light theme, white page.** Page `#ffffff`, list pane and dashed "not in this export" panels `#f5f5f5`, cards `#ffffff`, hairlines `#dcdcdc`.
- **Neutral ink chrome.** Ink `#111111` is the "primary": section and card titles, headline numbers, links, the selected-row bar and the one filled primary button. Body text `#3a3a3a`, muted text `#5c5c5c` (captions, labels), faint `#8c8c8c` for decoration and dashed borders only, never text.
- **Links are underlined ink**, e.g. "Open Playtime →" and "Clear my cached data". Colour must not be the only cue; the underline carries it.
- **Primary button** (only "Load city-level detail (~12 MB)"): filled `#111111`, white text, 44px high. Every other button is outlined (white, `#dcdcdc` border, ink text), so there is no competing action.
- **Data keeps the app's teal ramp, unchanged**: `--ramp-0..5` = `#eef0f2 #b2dcd4 #7cc7bc #43a89c #1f7a74 #0d4f4c`. The contract tests in `tests/unit/charts/contrast.test.ts` stay valid because the ramp is not touched. Bars and the sparkline use `--ramp-3` (sparkline) and `--ramp-4` (bars); the login stacked bar uses ramp 4 / 3 / 2.
- **Selection must read against hover** (research: a common list-detail mistake). Selected row: `#e0e0e0` background, 3px inset ink bar on the left, title in ink. Hover: `#ececec` only (lighter), no bar.
- **Focus ring stays blue**: 3px solid `#1a73e8`, offset inward on rows. It is the one place blue remains, for visibility; do not recolour it to ink.
- **Warning and error colours are unchanged**: `#fef7e0` / `#8a5a00` for the excluded-rows chip, `#c5221f` for errors.
- **Type:** the app's stack, `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`, no webfont. Section title 26px/600; chart card title 16px/600; list title 14px/600; tile numerals 30px/600 with a 14px muted unit; labels 12px uppercase, letter-spacing .06em; captions 12.5px muted.
- **Shape:** cards and tiles 8px radius, 1px `#dcdcdc` border, no shadows on the shell and detail sections (the Overview tiles are the one exception: see the Overview additions below); controls 8px; chips fully rounded; dashed `#8c8c8c` border for drop targets and unavailable panels.
- **Stat tiles:** `#f5f5f5` or white background, 1px border, uppercase label over a large number; grid `repeat(auto-fit, minmax(min(200px, 100%), 1fr))`.
- **Controls are at least 44px tall** (48px on phone).
- **Heatmaps** (unchanged from the app): calendar 7 rows, column flow, 14px cells, 3px gap, 2px radius; hour grid with a label column and 24 columns, 22px-high cells; legend "Less [6 swatches] More"; ranks stay rank-based.
- **Bars (session length):** 12px high track `#ececec`, fill `--ramp-4`, label left (96px), "count · percent" right (84px); all 12 bins shown including zeros.
- **Tables:** 13px, 12px muted header, 1px row rules, no zebra, inside an `overflow-x:auto` card with a `min-width`.
- **Explanatory notes:** one visible caption under a chart; the rest in an "About this chart" `<details>` (44px summary, ink text underlined). Keep the app's real copy.
- **Provenance line** in each detail header ("From Activity_history · 1 file, 311 rows · 1 session row excluded"); raw folder names are never headings.

## CSS Patterns
```css
:root{--page:#fff;--list:#f5f5f5;--card:#fff;--border:#dcdcdc;--faint:#8c8c8c;--ink:#111;--text:#3a3a3a;--muted:#5c5c5c;--sel:#e0e0e0;--hover:#ececec;--focus:#1a73e8}
body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5;color:var(--text)}
.card{border:1px solid var(--border);border-radius:8px;padding:20px;background:var(--card)}
.tile{background:var(--list);border:1px solid var(--border);border-radius:8px;padding:14px 16px}
.tile .k{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.tile .v{font-size:30px;line-height:1.2;font-weight:600;color:var(--ink)}
a,.link{color:var(--ink);text-decoration:underline}
button:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:-3px}
.btn{min-height:44px;padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--ink)}
.btn:hover{background:var(--hover)}
.btn.primary{background:var(--ink);border-color:var(--ink);color:#fff}
.cal{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,14px);grid-auto-columns:14px;gap:3px}
.hours{display:grid;grid-template-columns:36px repeat(24,minmax(0,1fr));gap:3px;align-items:center}
.bar{height:12px;border-radius:6px;background:#ececec;overflow:hidden}.bar>i{display:block;height:12px;background:var(--ramp-4)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--muted);font-weight:600;font-size:12px;padding:8px 6px;border-bottom:1px solid var(--border)}
td{padding:10px 6px;border-bottom:1px solid var(--border)}
```
Targets, not drop-in code: keep per-bucket aggregation, existing `--ramp-N` fills, tooltips and in-chart keyboard navigation.

## Wiring notes for the build
- Add the neutrals as `:root` tokens in `src/app.css`; leave `--ramp-*` and `--flow-in/--flow-out` untouched.
- Replace existing blue `#1a73e8` uses with ink where it is chrome (link, selected bar, nav underline), but keep it for the focus ring and spinner if the existing tests rely on it. Grep for `#1a73e8` first.
- Existing text colours `#3c4043` / `#5f6368` are close to `#3a3a3a` / `#5c5c5c`; migrate them together in one pass so contrast tests see one consistent set.
- Re-run `tests/unit/charts/contrast.test.ts` and add the new neutral pairs to it (ink on white and on `#f5f5f5`, muted on `#f5f5f5`, white on ink for the primary button).

## What to Avoid
- Coloured chrome (blue, indigo, berry, etc.) and per-section accents or tints, EXCEPT the two small Overview additions below (group dots and amber pinned stars); the other 11 palettes (warm paper, dark graphite, slate, forest, orange, navy, berry, ocean, plum, navy+teal, terracotta) were tried and not chosen.
- Dark mode in this phase (a later, separate decision: it needs a dark ramp).
- Hover and selected tints that are close in value (the Day 10 first draft had `#ebebeb` vs `#ececec`; fixed to `#ececec` vs `#e0e0e0`).
- Any text in `#8c8c8c`.
- Hand-written insight sentences from the sketches ("Evenings dominate", rarity labels); ship only what is computed.

## Origin
Sketches 001, 006, 008, 012, 021; design canvas https://claude.ai/artifact/XM5a7aV2p2XWze9DFi37G3 (artboard "Day 10 · Ink + teal (ramp kept)"). Sources in `sources/design-canvas/` and `sources/themes/default.css`.

## Overview additions (2026-10-22)
Applies to the Overview tiles only (full spec in `overview-insights.md`); nothing else on the page changes.
- **Colour limited to two things:** a 7 px dot (9 px in group headings) in a per-group hue beside labels (Time `#1f7a74`, Tanks `#c26a1b`, Records `#8f4a80`, Money `#3a6aa8`), and an amber star on pinned tiles (`#e0a020` fill, `#a8710a` stroke). Tiles white, numbers ink. Tinted tiles and coloured numbers were tried and rejected.
- **Elevation "lifted":** rest `0 1px 2px rgba(17,17,17,.05)`, hover `0 4px 12px rgba(17,17,17,.08)` (hover-capable devices only, border unchanged), open `0 8px 24px rgba(17,17,17,.10)` with a 2 px ink edge drawn as `border` + `outline` (outline-offset -2px), so layout never changes. Hairlines stay. Phone: soft rest only.
- **Value charts (Overview only):** coloured by value, lightness falling as value rises: `#4fb27f` -> `#6b8a14` -> `#8c6400` (eased). Peak labelled in text and a low-to-peak legend in the group heading. Detail in `overview-insights.md`.
