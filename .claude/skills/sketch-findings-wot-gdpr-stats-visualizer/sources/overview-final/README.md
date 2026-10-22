# Overview final (sketch 030) and its shared assets

Reference copy of `.planning/sketches/030-overview-final/` plus `.planning/sketches/_shared/` (CSS tokens, helpers, tile model, data generator). The originals stay the source of truth: `gen-data.mjs` imports `../../spikes/_lib/export-reader.mjs`, so run it from `.planning/sketches/` in the repo, not from here.

The sketch needs `_shared/out.local/data.js` (real numbers from a real export; gitignored, never copy it into the repo). Without it the page says "No data".

Authoritative for behaviour (expand, pin, no-jump, absent states, shadows, group dots, amber star). The hi-fi look is in `../design-canvas-overview/`.
