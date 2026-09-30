---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 1
total_count: 5
last_updated: 2026-09-30T18:35:22.674Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | .planning/phases/01-ingest-foundation-zero-network-guard/01-09-PLAN.md |  | 01-09: pnpm run test:e2e not run (environment override: port 4173 conflict with preview server); CSP assertions verified against built dist/index.html instead | fixed |  | 2026-09-30T16:46:01.263Z | 2026-09-30T17:24:10.351Z |
| 2 | 01 | todo | src/lib/worker-client.svelte.ts | 239 | WR-01 fail-fast guard does not cover the Start Over / Clear cached data confirm routes: requestStartOver() and requestClearData() have no #workerBroken check and confirmPending() posts to a dead worker, parking the client in 'confirm-pending' with no settle timer and no error banner. Reachable straight from a displayed cached dataset with no file drop. | open |  | 2026-09-30T17:09:08.407Z |  |
| 3 | 01 | todo | src/lib/worker/classify.ts | 271 | Rootless-first ordering (01-07) newly ACCEPTS any archive whose top-level folder is named after a recognized category regardless of content, e.g. ['Payment_history/invoice.pdf'] returns ok with accountRoot '' and 0 CSVs inflate, so a non-Wargaming zip produces a successful empty import instead of the clear rejection. Broader than the CR-01 disclosure in 01-07-SUMMARY.md, which named only the User_Info/Account_Info.csv case. | open |  | 2026-09-30T17:09:08.495Z |  |
| 4 | 01 | todo | package.json | 32 | pnpm run check is now 'tsc -b', which places 0 of 11 .svelte files in the TypeScript program, so Svelte components are no longer type-checked in CI. svelte-check@^4.7.6 remains an unused dependency and tsconfig.app.json:15 / ci.yml:60 still reference it in prose. Decide whether to re-add svelte-check as its own CI step. | open |  | 2026-09-30T17:09:08.583Z |  |
| 5 | 01 | todo | src/lib/worker-client.svelte.ts | 184 | WR-01 RE-OPENED during the phase-4 rebase merge. Plan 01-08's fix (mark worker broken on every onerror) was intentionally dropped because it conflicts with phase 4's 04-07 design assumption that a Worker can survive an idle+ready error event and serve new queries. The hang-on-busy-floor symptom WR-01 was filed for may resurface if real workers DO die on idle+ready errors. Open question: verify in a real browser whether an idle+ready worker error actually leaves a subsequent submitFiles() stranded on the MIN_PROCESSING_MS floor. If yes, restore WR-01 with a separate submit-gate flag (option C from the merge decision). | open |  | 2026-09-30T18:35:22.674Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-ingest-foundation-zero-network-guard/01-09-PLAN.md",
    "line": null,
    "description": "01-09: pnpm run test:e2e not run (environment override: port 4173 conflict with preview server); CSP assertions verified against built dist/index.html instead",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-30T16:46:01.263Z",
    "resolved_at": "2026-09-30T17:24:10.351Z"
  },
  {
    "id": 2,
    "kind": "todo",
    "phase": "01",
    "file": "src/lib/worker-client.svelte.ts",
    "line": 239,
    "description": "WR-01 fail-fast guard does not cover the Start Over / Clear cached data confirm routes: requestStartOver() and requestClearData() have no #workerBroken check and confirmPending() posts to a dead worker, parking the client in 'confirm-pending' with no settle timer and no error banner. Reachable straight from a displayed cached dataset with no file drop.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-30T17:09:08.407Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "todo",
    "phase": "01",
    "file": "src/lib/worker/classify.ts",
    "line": 271,
    "description": "Rootless-first ordering (01-07) newly ACCEPTS any archive whose top-level folder is named after a recognized category regardless of content, e.g. ['Payment_history/invoice.pdf'] returns ok with accountRoot '' and 0 CSVs inflate, so a non-Wargaming zip produces a successful empty import instead of the clear rejection. Broader than the CR-01 disclosure in 01-07-SUMMARY.md, which named only the User_Info/Account_Info.csv case.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-30T17:09:08.495Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "todo",
    "phase": "01",
    "file": "package.json",
    "line": 32,
    "description": "pnpm run check is now 'tsc -b', which places 0 of 11 .svelte files in the TypeScript program, so Svelte components are no longer type-checked in CI. svelte-check@^4.7.6 remains an unused dependency and tsconfig.app.json:15 / ci.yml:60 still reference it in prose. Decide whether to re-add svelte-check as its own CI step.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-30T17:09:08.583Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "todo",
    "phase": "01",
    "file": "src/lib/worker-client.svelte.ts",
    "line": 184,
    "description": "WR-01 RE-OPENED during the phase-4 rebase merge. Plan 01-08's fix (mark worker broken on every onerror) was intentionally dropped because it conflicts with phase 4's 04-07 design assumption that a Worker can survive an idle+ready error event and serve new queries. The hang-on-busy-floor symptom WR-01 was filed for may resurface if real workers DO die on idle+ready errors. Open question: verify in a real browser whether an idle+ready worker error actually leaves a subsequent submitFiles() stranded on the MIN_PROCESSING_MS floor. If yes, restore WR-01 with a separate submit-gate flag (option C from the merge decision).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-30T18:35:22.674Z",
    "resolved_at": null
  }
]
````
