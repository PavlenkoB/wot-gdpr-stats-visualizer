# Spike Conventions

## Stack
Plain Node ESM scripts (`.mjs`) reusing the repo's `fflate` and `papaparse` from `node_modules`; no new dependencies.

## Structure
`_lib/export-reader.mjs` reads a real export zip into `{account -> {"folder/file.csv" -> rows}}`. Each spike: `NNN-name/README.md` + scripts.
Real numbers go to `out.local/` (covered by the `*.local` gitignore rule) and are never committed.

## Patterns
Print aggregates only (no nickname, IP, email, chat text). Real exports live outside the repo (`~/Downloads/export/`).
