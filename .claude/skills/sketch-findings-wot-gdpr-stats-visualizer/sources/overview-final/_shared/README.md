# Shared sketch assets (023, 024)

- `overview.css`, `overview.js`: Day 10 tokens, Q2 shell, helpers.
- `gen-data.mjs`: builds `out.local/data.js` (`window.WG`) from a REAL export zip plus spike 001's tank table.
  `out.local/` is gitignored (`*.local`) because it holds day-level play data of a real player. Regenerate before viewing:

```bash
node .planning/spikes/001-vehicle-lookup-table/run.mjs      # needs WG_APPLICATION_ID in .env.local
node .planning/sketches/_shared/gen-data.mjs [export.zip]   # default path/to/export.zip
```
Without `out.local/data.js` the sketches show a "No data" message.
