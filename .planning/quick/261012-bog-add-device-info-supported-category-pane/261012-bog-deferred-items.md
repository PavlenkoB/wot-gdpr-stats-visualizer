# Deferred items: quick 261012-bog

Out-of-scope discoveries, not fixed here (scope boundary). Both predate this task:
they fail identically in a baseline `pnpm run test:unit` at 4be75dd, before any edit.

| Item | Where | Cause | Status |
| ---- | ----- | ----- | ------ |
| Suite fails to load | `tests/unit/charts/contrast.test.ts` | ENOENT reading `.planning/phases/04-activity-time-dashboards/04-UI-SPEC.md`, archived by the v1.0 milestone commits | deferred |
| 1 test fails | `tests/unit/geo/source-decision.test.ts` ("names the official monthly download in ACTIVITY-06 and not the mirror as its source") | ENOENT reading `.planning/REQUIREMENTS.md`, removed with the v1.0 archive (`chore: remove REQUIREMENTS.md for v1.0 milestone`) | deferred |

Both need either the archived document path updated in the test or the test
retired with the milestone; that is a decision for the owner of those guards.
