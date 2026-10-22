# Design canvas (hi-fi, built on the app's real tokens)

Live: https://claude.ai/artifact/XM5a7aV2p2XWze9DFi37G3 (private to the owner). It holds 20 artboards: the design, three alternatives and 12 colour palettes.

## What is authoritative
- **Palette: `Color-10-Ink.dc.html`** ("Day 10 · Ink + teal (ramp kept)"). This is the chosen colour system. Its `:root` block is the token source (also in `../themes/default.css`).
- **Overview-first layout: `Alt-B-Overview.dc.html`** (and `Color-10-Ink.dc.html`, the same layout in the chosen palette). Chosen as the landing section.
- **Structure and states:** `Main.dc.html` (desktop, interactive), `Empty.dc.html` (no export), `Phone-List.dc.html`, `Phone-Detail.dc.html`. **These four were drawn BEFORE the palette decision and still use the earlier Google-blue chrome (`#1a73e8`, `#e8f0fe`, `#f7f7fa`).** Take their layout, spacing and copy, and re-skin them with the Day 10 tokens (ink primary, `#e0e0e0` selected, `#ececec` hover, underlined ink links).
- Not chosen but kept for reference: `Alt-A-Triage.dc.html` (row previews, hash link), `Alt-C-Accessible.dc.html` (Chart | Table toggle, skip link, keyboard hint).
- `canvas.json`: artboard layout index of the whole canvas.

Sample numbers are invented (412.8 h, 286 sessions, 143 active days, 3 IPs, 612 logins, USD 29.97). Page copy is the app's real wording.

These are Design-canvas component files (they need the canvas runtime's `support.js`), so they are reference source, not runnable alone. Use the live link to view.

## Update 2026-10-22
The Overview section was redesigned (insights, not section cards). Its artboards are in `../design-canvas-overview/` and supersede the Overview artboards here. See `../../references/overview-insights.md`.
