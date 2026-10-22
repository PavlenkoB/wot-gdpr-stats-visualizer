---
sketch: 028
name: overview-explain-popover
question: "How should a tile explain how its number is computed, now that the side inspector (025-G1) is dropped?"
winner: "none (popover direction rejected 2026-10-22; user prefers expand-in-place, see 029)"
tags: [overview, bento, grouped, popover, a11y, explain]
---

# Sketch 028: Explain popover (B1 grouped bento, no side panel)

Base layout is B1: four groups, three tile sizes (hero, feature, metric), hero first.

## Existing app constraints that shaped it
- `src/lib/charts/ChartTooltip.svelte` / `tooltip-pin.ts`: one shared element, positioned with `element.style.left/top` only. The build CSP has no `style-src 'unsafe-inline'`, so a build must not use `style=""` attributes or write `style` text; the sketch's `place()` only writes left/top and one custom property via the CSSOM.
- The chart tooltip is `aria-hidden` because the same text is already each cell's accessible name. The explanation here is NOT duplicated elsewhere, so it must stay in the accessibility tree (role="dialog", aria-modal="false", labelled).
- `AboutDisclosure.svelte` ("About this chart" `<details>`) is the existing pattern for supplementary copy: P2 follows its spirit (a separate, named control).

## Platform choice
Native Popover API (`popover="auto"`): light-dismiss, Esc, top layer and focus return come from the browser, no focus-trap code. `<dialog>` + `showModal()` for the phone sheet (native focus trap and Esc).

## How to View
`node .planning/sketches/_shared/gen-data.mjs` once, then open `.planning/sketches/028-overview-explain-popover/index.html`
(or http://localhost:5173/.planning/sketches/028-overview-explain-popover/index.html). Phone/Tablet/Desktop buttons bottom right.

## Variants
- **P1: Click a tile, anchored popover** - the tile is the trigger (a faint "i" hints at it); popover opens beside it with an arrow, flips above when there is no room, follows scroll. Click again / outside / Esc closes; focus returns to the tile; Enter on the open tile toggles.
- **P2: Info button; tile itself navigates** - two clear actions: the tile goes to its section (like list rows), a real 44px "i" button (declarative `popovertarget`) opens the explanation. Matches how the app already separates a chart from its "About" note.
- **P3: Popover on desktop, bottom sheet on phone + stepper** - tile click opens the anchored popover when the frame is wide, a bottom-sheet dialog when narrow; prev/next (and arrow keys) step through all 16 tiles with a "7 / 16" counter without closing.

## What to Look For
- P1 vs P2: should clicking the number explain it (discoverable, but then who navigates?) or should explaining be a separate small control?
- Is the arrow-anchored popover better than the side panel for 15 tiles, or does the sheet/stepper (P3) feel more complete?
- Phone: is a bottom sheet clearly better than an anchored popover at 375px (try the Phone button, then P1 vs P3)?
- Do the popover contents (how computed / reads / detail / open section) say the right things, or is any line noise?

## Recommendation (author's view)
P2's split (tile navigates, "i" explains) + P3's sheet on phone. Reason: it keeps one click = one meaning, reuses the app's existing "About" idea, and needs the least code (native popover/dialog, no panel layout state).
