---
schema_version: 1
open_count: 2
waived_count: 2
fixed_count: 9
total_count: 13
last_updated: 2026-10-18T06:11:32.205Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | .planning/phases/01-ingest-foundation-zero-network-guard/01-09-PLAN.md |  | 01-09: pnpm run test:e2e not run (environment override: port 4173 conflict with preview server); CSP assertions verified against built dist/index.html instead | fixed |  | 2026-09-30T16:46:01.263Z | 2026-09-30T17:24:10.351Z |
| 2 | 01 | todo | src/lib/worker-client.svelte.ts | 239 | WR-01 fail-fast guard does not cover the Start Over / Clear cached data confirm routes: requestStartOver() and requestClearData() have no #workerBroken check and confirmPending() posts to a dead worker, parking the client in 'confirm-pending' with no settle timer and no error banner. Reachable straight from a displayed cached dataset with no file drop. | waived | Same dead-worker-after-ready family as review WR-04/WR-05; accepted by signed override O-1 (01-VERIFICATION.md) and deferred in 01-REVIEW-DISPOSITION.md | 2026-09-30T17:09:08.407Z | 2026-10-10T10:07:44.264Z |
| 3 | 01 | todo | src/lib/worker/classify.ts | 271 | Rootless-first ordering (01-07) newly ACCEPTS any archive whose top-level folder is named after a recognized category regardless of content, e.g. ['Payment_history/invoice.pdf'] returns ok with accountRoot '' and 0 CSVs inflate, so a non-Wargaming zip produces a successful empty import instead of the clear rejection. Broader than the CR-01 disclosure in 01-07-SUMMARY.md, which named only the User_Info/Account_Info.csv case. | fixed |  | 2026-09-30T17:09:08.495Z | 2026-10-10T10:10:04.427Z |
| 4 | 01 | todo | package.json | 32 | pnpm run check is now 'tsc -b', which places 0 of 11 .svelte files in the TypeScript program, so Svelte components are no longer type-checked in CI. svelte-check@^4.7.6 remains an unused dependency and tsconfig.app.json:15 / ci.yml:60 still reference it in prose. Decide whether to re-add svelte-check as its own CI step. | fixed |  | 2026-09-30T17:09:08.583Z | 2026-10-10T10:07:43.900Z |
| 5 | 01 | todo | src/lib/worker-client.svelte.ts | 184 | WR-01 RE-OPENED during the phase-4 rebase merge. Plan 01-08's fix (mark worker broken on every onerror) was intentionally dropped because it conflicts with phase 4's 04-07 design assumption that a Worker can survive an idle+ready error event and serve new queries. The hang-on-busy-floor symptom WR-01 was filed for may resurface if real workers DO die on idle+ready errors. Open question: verify in a real browser whether an idle+ready worker error actually leaves a subsequent submitFiles() stranded on the MIN_PROCESSING_MS floor. If yes, restore WR-01 with a separate submit-gate flag (option C from the merge decision). | waived | Deliberate phase-4 design (04-07) reversing plan 01-08; accepted by signed override O-1 (01-VERIFICATION.md), tracked as WR-04/WR-05 | 2026-09-30T18:35:22.674Z | 2026-10-10T10:07:44.338Z |
| 6 | 05 | skipped-test | tests/unit/ui-copy.test.ts | 207 | pre-existing locale-dependent failure: formatImportSummary groups with the machine locale, so the en-US literal fails on a uk_UA box | fixed |  | 2026-10-01T17:05:31.713Z | 2026-10-10T10:07:43.972Z |
| 7 | 05 | deviation | tests/e2e/finance.spec.ts |  | monthly-table-disclosure and bar-scroller are per-chart hooks now; 05-10's premium table spec had to be scoped to its block | fixed |  | 2026-10-01T21:48:40.951Z | 2026-10-10T10:07:44.045Z |
| 8 | 05 | skipped-test | tests/e2e/finance.spec.ts | 1519 | ORDER-DEPENDENT FLAKE, measured not anecdotal: at 05-15's HEAD 1e0d491 the full Playwright suite passed 1 run in 6; the other five failed this test with TypeError: Cannot read properties of null (reading 'y'), because boundingBox() returns null when ChartTooltip dismisses the tooltip in response to the scroll event that window.scrollTo delivers ASYNCHRONOUSLY after the test's hover(). It is 05-13's spec, passes 5/5 in isolation, and still fails with 05-15's spend specs EXCLUDED from the run, so 05-15's added spec load is not the trigger; 05-15 does add a spend-channel query plus five cards with two breakdown tables to every import this spec makes, which may have widened the window but was NOT proved. NOT FIXED by 05-15 (documentation-only close-out; the baseline experiment at 8837739 was refused by the permission layer as a product-file overwrite). Fix is test-side ordering: scroll and let the event land BEFORE hovering, as the sibling (keys) test in the same describe already does. | fixed |  | 2026-10-02T12:30:00.000Z | 2026-10-10T10:07:44.117Z |
| 9 | 05 | deviation | src/lib/dashboard-status.ts | 99 | 05-15's Task 1 said to update the BUILT_DASHBOARDS comment for the four built sections, and the per-id list below the sentence WAS updated with the payment-history entry - but the count in the sentence that introduces it still reads 'Two ids'. Comment only, nothing behavioural depends on it and no test reads it, but it now disagrees with tests/unit/dashboard-status.test.ts, whose own comment says 'Four sections have shipped'. Left unfixed for the orchestrator to decide on a re-dispatch; a one-word edit. | fixed |  | 2026-10-02T12:30:00.000Z | 2026-10-10T10:07:44.191Z |
| 10 | 09 | deviation | src/lib/worker/classify.ts |  | 09-01: real account id 1234567 remains in pre-existing v1.0 classify.test.ts literals (out of scope, see deferred-items.md) | open |  | 2026-10-16T20:01:08.978Z |  |
| 11 | 09 | deviation | src/lib/shell/DashboardSection.svelte | 162 | Rule 1 fix: the caption's {#if} introduced a whitespace text node that changed a v1.0 DOM's text content and broke master-detail-nav's toHaveText(/^From .../) | fixed |  | 2026-10-17T03:36:43.585Z | 2026-10-17T03:37:29.139Z |
| 12 | 09 | unrun-verify | .planning/phases/09-multi-account-import-account-identity/09-VALIDATION.md |  | 09-06 optional real-export check not run: environment data-handling permission denied reading the private 3-account archive | open |  | 2026-10-17T17:34:58.778Z |  |
| 13 | 09 | deviation | .planning/phases/09-multi-account-import-account-identity/09-10-SUMMARY.md |  | 09-10 fixture correction: the data-less root initially still received the three shared Player_statistics files (a supported category), so it held data and the fixture did not describe its claimed shape | fixed |  | 2026-10-18T06:10:56.957Z | 2026-10-18T06:11:32.205Z |

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
    "status": "waived",
    "reason": "Same dead-worker-after-ready family as review WR-04/WR-05; accepted by signed override O-1 (01-VERIFICATION.md) and deferred in 01-REVIEW-DISPOSITION.md",
    "recorded_at": "2026-09-30T17:09:08.407Z",
    "resolved_at": "2026-10-10T10:07:44.264Z"
  },
  {
    "id": 3,
    "kind": "todo",
    "phase": "01",
    "file": "src/lib/worker/classify.ts",
    "line": 271,
    "description": "Rootless-first ordering (01-07) newly ACCEPTS any archive whose top-level folder is named after a recognized category regardless of content, e.g. ['Payment_history/invoice.pdf'] returns ok with accountRoot '' and 0 CSVs inflate, so a non-Wargaming zip produces a successful empty import instead of the clear rejection. Broader than the CR-01 disclosure in 01-07-SUMMARY.md, which named only the User_Info/Account_Info.csv case.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-30T17:09:08.495Z",
    "resolved_at": "2026-10-10T10:10:04.427Z"
  },
  {
    "id": 4,
    "kind": "todo",
    "phase": "01",
    "file": "package.json",
    "line": 32,
    "description": "pnpm run check is now 'tsc -b', which places 0 of 11 .svelte files in the TypeScript program, so Svelte components are no longer type-checked in CI. svelte-check@^4.7.6 remains an unused dependency and tsconfig.app.json:15 / ci.yml:60 still reference it in prose. Decide whether to re-add svelte-check as its own CI step.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-30T17:09:08.583Z",
    "resolved_at": "2026-10-10T10:07:43.900Z"
  },
  {
    "id": 5,
    "kind": "todo",
    "phase": "01",
    "file": "src/lib/worker-client.svelte.ts",
    "line": 184,
    "description": "WR-01 RE-OPENED during the phase-4 rebase merge. Plan 01-08's fix (mark worker broken on every onerror) was intentionally dropped because it conflicts with phase 4's 04-07 design assumption that a Worker can survive an idle+ready error event and serve new queries. The hang-on-busy-floor symptom WR-01 was filed for may resurface if real workers DO die on idle+ready errors. Open question: verify in a real browser whether an idle+ready worker error actually leaves a subsequent submitFiles() stranded on the MIN_PROCESSING_MS floor. If yes, restore WR-01 with a separate submit-gate flag (option C from the merge decision).",
    "status": "waived",
    "reason": "Deliberate phase-4 design (04-07) reversing plan 01-08; accepted by signed override O-1 (01-VERIFICATION.md), tracked as WR-04/WR-05",
    "recorded_at": "2026-09-30T18:35:22.674Z",
    "resolved_at": "2026-10-10T10:07:44.338Z"
  },
  {
    "id": 6,
    "kind": "skipped-test",
    "phase": "05",
    "file": "tests/unit/ui-copy.test.ts",
    "line": 207,
    "description": "pre-existing locale-dependent failure: formatImportSummary groups with the machine locale, so the en-US literal fails on a uk_UA box",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-01T17:05:31.713Z",
    "resolved_at": "2026-10-10T10:07:43.972Z",
    "milestone": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "05",
    "file": "tests/e2e/finance.spec.ts",
    "line": null,
    "description": "monthly-table-disclosure and bar-scroller are per-chart hooks now; 05-10's premium table spec had to be scoped to its block",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-01T21:48:40.951Z",
    "resolved_at": "2026-10-10T10:07:44.045Z",
    "milestone": null
  },
  {
    "id": 8,
    "kind": "skipped-test",
    "phase": "05",
    "file": "tests/e2e/finance.spec.ts",
    "line": 1519,
    "description": "ORDER-DEPENDENT FLAKE, measured not anecdotal: at 05-15's HEAD 1e0d491 the full Playwright suite passed 1 run in 6; the other five failed this test with TypeError: Cannot read properties of null (reading 'y'), because boundingBox() returns null when ChartTooltip dismisses the tooltip in response to the scroll event that window.scrollTo delivers ASYNCHRONOUSLY after the test's hover(). It is 05-13's spec, passes 5/5 in isolation, and still fails with 05-15's spend specs EXCLUDED from the run, so 05-15's added spec load is not the trigger; 05-15 does add a spend-channel query plus five cards with two breakdown tables to every import this spec makes, which may have widened the window but was NOT proved. NOT FIXED by 05-15 (documentation-only close-out; the baseline experiment at 8837739 was refused by the permission layer as a product-file overwrite). Fix is test-side ordering: scroll and let the event land BEFORE hovering, as the sibling (keys) test in the same describe already does.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-02T12:30:00.000Z",
    "resolved_at": "2026-10-10T10:07:44.117Z",
    "milestone": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "05",
    "file": "src/lib/dashboard-status.ts",
    "line": 99,
    "description": "05-15's Task 1 said to update the BUILT_DASHBOARDS comment for the four built sections, and the per-id list below the sentence WAS updated with the payment-history entry - but the count in the sentence that introduces it still reads 'Two ids'. Comment only, nothing behavioural depends on it and no test reads it, but it now disagrees with tests/unit/dashboard-status.test.ts, whose own comment says 'Four sections have shipped'. Left unfixed for the orchestrator to decide on a re-dispatch; a one-word edit.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-02T12:30:00.000Z",
    "resolved_at": "2026-10-10T10:07:44.191Z",
    "milestone": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "09",
    "file": "src/lib/worker/classify.ts",
    "line": null,
    "description": "09-01: real account id 1234567 remains in pre-existing v1.0 classify.test.ts literals (out of scope, see deferred-items.md)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-16T20:01:08.978Z",
    "resolved_at": null,
    "milestone": "v1.1"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "09",
    "file": "src/lib/shell/DashboardSection.svelte",
    "line": 162,
    "description": "Rule 1 fix: the caption's {#if} introduced a whitespace text node that changed a v1.0 DOM's text content and broke master-detail-nav's toHaveText(/^From .../)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-17T03:36:43.585Z",
    "resolved_at": "2026-10-17T03:37:29.139Z",
    "milestone": "v1.1"
  },
  {
    "id": 12,
    "kind": "unrun-verify",
    "phase": "09",
    "file": ".planning/phases/09-multi-account-import-account-identity/09-VALIDATION.md",
    "line": null,
    "description": "09-06 optional real-export check not run: environment data-handling permission denied reading the private 3-account archive",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-17T17:34:58.778Z",
    "resolved_at": null,
    "milestone": "v1.1"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "09",
    "file": ".planning/phases/09-multi-account-import-account-identity/09-10-SUMMARY.md",
    "line": null,
    "description": "09-10 fixture correction: the data-less root initially still received the three shared Player_statistics files (a supported category), so it held data and the fixture did not describe its claimed shape",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-18T06:10:56.957Z",
    "resolved_at": "2026-10-18T06:11:32.205Z",
    "milestone": "v1.1"
  }
]
````
