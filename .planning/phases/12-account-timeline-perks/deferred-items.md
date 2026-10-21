# Phase 12 deferred items

Out-of-scope discoveries logged by executors. Not fixed by the plan that found them.

## Found during 12-10 (pre-existing, from 12-09)

- `tests/unit/guards/phase8-ui-review-guards.test.ts` ("no colour literal exists under src outside the app.css tokens and the allow-list") fails on `src/lib/features/new-data/PerksPane.svelte`, which uses the literals `#c5221f`, `#fce8e6` and `#8a1c17` (the 12-UI-SPEC "Destructive / error" colours). The file was added by plan 12-09 (commit 5a7f358). Fix belongs with the Perks pane: either route the three colours through existing `app.css` tokens or add the file to the guard's allow-list. Plan 12-10 touches neither file.

- status: resolved
- **Resolution:** phase8-ui-review-guards allow-list covers PerksPane.svelte; guard passes 13/13.
