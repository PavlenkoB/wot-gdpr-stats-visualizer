---
status: awaiting_human_verify
trigger: "CI (ubuntu, 1 worker): tests/e2e/import-flow.spec.ts:420 '(f) the page stays responsive while a large export is unzipped' failed at :490, one main-thread long task { startTime: 4371.2, duration: 1216 } against a 1000 ms threshold; 197 passed / 1 failed; passed locally 198/198 several times"
created: 2026-10-03T00:00:00Z
updated: 2026-10-03T00:00:00Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-10-12
  status: awaiting_human_verify
---

## Current Focus

hypothesis: CONFIRMED. The 1216 ms long task is not app code. It is Playwright's own setInputFiles({ buffer }) injection (base64 atob + Uint8Array.from(.., c => c.charCodeAt(0)) of the 3.6 MB zip, run on the PAGE main thread before it dispatches `change`), which the test's [t0, ready] window includes
test: A/B the exact (f) assertion, buffer upload vs path upload, under CDP CPU throttling; capture/bubble `change` listeners; LoAF attribution; mutation check with a real >= 1 s main-thread block
expecting: buffer upload fails at ~9x throttle (CI-like), path upload passes with only the app's own ~9 ms results handler in the window
next_action: user confirms CI is green on the pushed fix; then archive to resolved/ and append to knowledge-base.md

reasoning_checkpoint:
  hypothesis: "import-flow (f) measures Playwright's in-page base64 decode of the in-memory upload payload as if it were the app's main-thread cost: one task proportional to the payload (3.6 MB zip), ending before the app sees the file, scaling linearly with CPU slowness, so a ~9x slower runner turns 140 ms into >= 1000 ms and the 1000 ms bound trips on the harness"
  confirming_evidence:
    - "Capture-phase `change` listener fires at t0+181.0..182.5 ms (1x) / t0+595.8..606.2 ms (4x), exactly the END of the single long task (ends t0+181.8 / t0+597.8..608.7); capture-to-bubble (every app handler) is 0.2 ms (1x) / 0.4-1.2 ms (4x)"
    - "playwright-core 1.63.0 InjectedScript.setInputFiles: `Uint8Array.from(atob(file.buffer), (c) => c.charCodeAt(0))` then File, DataTransfer, input.files, input+change dispatch, all in one task in the utility world (LoAF scripts: [] because the page does not own the script)"
    - "Same spec, zip delivered by path: no long task near the start at 1x, 6x, 9x, 12x, 20x; the only task in the window is the app's `Worker.onmessage` results handler (~9 ms unthrottled, 72-77 ms at 9x, ~165 ms at 20x)"
    - "Buffer upload of the real (f) assertion at 9x throttle fails 3/3 with 1,235 / 1,285 / 1,302 ms (CI: 1,216 ms); the path upload of the same assertion at 9x passes 3/3 (max 77 ms) and at 20x passes 3/3 (max 168 ms)"
    - "Decode cost is proportional to payload: heartbeat gap during upload 12 ms (42 KB), 32 ms (714 KB), 33 ms (816 KB), 123-156 ms (3.6 MB)"
  falsification_test: "If a path upload still showed a ~140 ms (1x) task ending at the change event, or the buffer upload at 9x did not exceed 1000 ms, the harness-decode hypothesis would be wrong. Neither happened."
  fix_rationale: "The measurement window, not the product, was wrong. Delivering the file by path (DOM.setFileInputFiles) removes the harness decode from the window, so the unchanged 1000 ms bound compares the app's own worst task (~9 ms) and a failure now means the app blocked the page. A path also matches what a real pick/drop hands the app (a disk-backed File). Raising the number would only have hidden it."
  blind_spots: "The CI runner's own slowdown factor was inferred (1216/140 = 8.7x; page-load timeline ~13x) not measured; a CI re-run of the pushed fix is the real proof. Playwright's decode may differ on other Playwright versions (this is 1.63.0)."
  candidate_causes:
    - "code(test harness): in-page payload decode inside the measured window (confirmed)"
    - "environment: slow/noisy CI runner multiplying a 140 ms task past 1000 ms (confirmed as the amplifier: the same task is 1,052-1,420 ms at 8-10x throttle)"
    - "code(app): main-thread work after import from Phase 4/5 rendering, results clone, query round trips (eliminated: the app's worst task is ~9 ms unthrottled; ~170 ms at 20x)"
  and_gate: "yes: both conditions are needed (a payload big enough to make the harness decode material AND a slow enough machine); neither alone fails. Fixing the first removes the dependence on the second."

## Symptoms

expected: `playwright test` exits 0, (f) sees no main-thread long task >= 1000 ms between submission and the dashboard
actual: CI: one long task, startTime 4371.2 ms, duration 1216 ms (the same CI run reported '50,000 operations import-to-ready 13294 ms', 'replace-to-ready 6430 ms': a slow runner)
errors: expect(offenders).toEqual([]) at import-flow.spec.ts:490, received [{ startTime: 4371.2, duration: 1216 }]
reproduction: CI only. Locally passes. Reproduced deterministically under CDP Emulation.setCPUThrottlingRate >= 8x with the original in-memory upload
started: the long-task window and the 1000 ms relaxation both date from Phase 1 (9689001); the fixture (20,000 incompressible tiny entries = 3.6 MB zip) has not changed

## Eliminated

- hypothesis: a real main-thread block after the import (Phase 4/5 playtime charts, calendar blocks, finance/vehicle blocks, worker query round trips, structured clone of results)
  evidence: with the harness decode out of the window, the app's longest task over the whole import is the `Worker.onmessage` results handler at ~9 ms (LoAF-attributed, 165-179 ms at 20x). Zero tasks >= 50 ms at 1x and 6x. The (f) fixture renders only empty-state blocks anyway
  timestamp: 2026-10-03

- hypothesis: the postMessage structured clone of the multi-MB File (the explanation in the old threshold comment)
  evidence: the long task ends at the `change` event, before the app's handler runs; the app's handler is 0.2 ms; postMessage of a File is a handle, not a byte copy; no task around the postMessage in path mode
  timestamp: 2026-10-03

## Evidence

- timestamp: 2026-10-03
  checked: scratch copy of test (f) recording every long task, long-animation-frame entries and stage marks, unthrottled x3
  found: exactly ONE long task per run, startTime t0+38..40 ms, duration 140-161 ms, zip 3,604,814 bytes. After it nothing >= 50 ms until the dashboard (slim bar at ~t0+970 ms). No LoAF script attribution (scripts: [])
  implication: the only long task of the import is at the very START of the window, before processing-status appears

- timestamp: 2026-10-03
  checked: same spec under CDP CPU throttle 2 / 4 / 6
  found: the single task scales linearly: 287-309 ms (2x), 536-549 ms (4x), 833-837 ms (6x); start stays t0+43..46 ms
  implication: linear in CPU slowness; 1216 ms is ~8.7x the 140 ms dev-machine figure

- timestamp: 2026-10-03
  checked: capture-phase and bubble-phase `change` listeners on window around the same upload
  found: `change` capture fires at the END of the long task; capture-to-bubble (all app handlers) = 0.2 ms (1x), 0.4-1.2 ms (4x)
  implication: the task finishes before the app sees the file; it cannot be app code

- timestamp: 2026-10-03
  checked: playwright-core 1.63.0 source (lib/coreBundle.js InjectedScript.setInputFiles, _setInputFiles)
  found: `Uint8Array.from(atob(file.buffer), (c) => c.charCodeAt(0))` run via evaluateInUtility, then input.files + input/change dispatch in the same task. The payload crosses the protocol as base64
  implication: mechanism confirmed; cost proportional to payload

- timestamp: 2026-10-03
  checked: zip sizes of every large synthetic export and the in-page block each causes (1 ms heartbeat gap)
  found: scale10x 42,541 B ~12 ms; finance50k 714,299 B ~32 ms; sessions60k 815,845 B ~33 ms; large20k 3,604,814 B 123-156 ms
  implication: (f)'s fixture is the outlier (incompressible 20k tiny entries). The other scale specs have ~30x headroom to 1000 ms: playtime-scale resets its long-task buffer after the import (windows exclude it); finance-scale (4) and persistent-dataset (c) include it but at 714 KB / 42 KB

- timestamp: 2026-10-03
  checked: path-based upload of the same spec, throttle 1 / 6 / 12 / 20; then the real (f) assertion at 9x and 20x on a clean build
  found: 1x and 6x: zero long tasks in the window. 9x: only 72-77 ms (results handler). 12x: 102-104 ms. 20x: 164-179 ms, LoAF-attributed to Worker.onmessage (app bundle). Buffer upload of the same assertion at 9x: 1,235 / 1,285 / 1,302 ms, fails 3/3
  implication: before/after A/B reproduces the CI failure and shows the fix removes it with >5x margin even at 20x

- timestamp: 2026-10-03
  checked: scratch mutation: unzipSync(await file.arrayBuffer()) on the main thread in submitFiles, path-based upload, 1x / 6x / 10x
  found: 0 ms (below the 50 ms reporting floor) / 111-114 ms / 186-187 ms: a main-thread unzip of this fixture costs only ~19 ms
  implication: HONEST LIMIT: the 1000 ms bound (and the original 250 ms) cannot see a main-thread unzip of this 20k fixture; it is a backstop for a gross block, not a micro-budget. The fix does not change detection power, it removes the false positive. (Note: scratch-f runs made against this mutated dist were discarded and redone on a clean build)

- timestamp: 2026-10-03
  checked: mutation on the real corrected spec: a 1.2 s busy-wait on the main thread 300 ms after the pick (src/lib/worker-client.svelte.ts, reverted)
  found: (f) fails at the offenders assertion: [{ duration: 1200, startTime: 595.1 }]. A 0 ms-delay variant makes the spec fail earlier, at `processing-status` visible (the block swallows the processing state)
  implication: the corrected check still catches a real >= 1 s main-thread block between the pick and the dashboard

## Resolution

root_cause: import-flow (f) uploaded the 3.6 MB zip with setInputFiles({ buffer }). Playwright base64-transfers an in-memory payload and decodes it ON THE PAGE MAIN THREAD (Uint8Array.from(atob(b64), c => c.charCodeAt(0)) in playwright-core's injected script), then dispatches `change` at the end of that one task. The task is proportional to the payload (3.6 MB: ~140 ms on a fast machine, 1,052-1,420 ms at 8-10x CPU throttle, 1,216 ms on the CI runner), lies inside the test's [t0, ready] window, and ends before the app sees the file (the app's handler is 0.2 ms). It was the harness's cost, misattributed in comments to the postMessage structured clone of a File. No app regression: the app's own worst task over the 20,000-entry import is the worker-results handler at ~9 ms.
fix: new helper pickExportFromDisk (tests/e2e/helpers.ts) writes the synthetic bytes under testInfo.outputPath and picks the file by PATH (DOM.setFileInputFiles), so the page gets a disk-backed File with no in-page decode. (f) uses it; the 1000 ms bound is unchanged. The false structured-clone explanation is corrected in import-flow (f), persistent-dataset (c) and finance-scale LONG_TASK_LIMIT_MS.
verification:
  target_test: { result: pass }   # (f) 10/10 with 5 parallel workers on the fixed spec; buffer upload at 9x throttle fails 3/3 (1,235-1,302 ms), path upload at 9x passes 3/3 (max 77 ms) and at 20x passes 3/3 (max 168 ms)
  mutation_check: { result: pass, mutant_killed: true }   # a 1.2 s main-thread busy-wait in submitFiles makes the corrected (f) fail at the offenders assertion (duration 1200); reverted
  no_op_deletion: { result: pass, deletion_justified_by_rca: n/a }   # no assertion removed or weakened: same filter (startTime >= t0, duration >= 1000), same threshold
  adjacent_tests: { result: pass, suites_run: [ "pnpm run lint exit 0", "pnpm run check exit 0", "pnpm run test:unit 47 files / 1405 tests exit 0 (incl. ci-budget, webserver-teardown)", "pnpm run test:e2e 198/198 exit 0 (54.7 s)", "CI=1 pnpm exec playwright test 198/198 exit 0 (3.2 min, 1 worker)" ] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }   # reverting to the buffer upload (SCRATCH_MODE=buffer) reproduces 1,235-1,302 ms at 9x; the path upload does not
  guardrail_verdict: accepted
limits: the 1000 ms bound cannot see a main-thread unzip of this fixture (~19 ms; ~190 ms at 10x); it flags a gross block (>= 1 s). Left unchanged on purpose: lowering it would not make that regression visible and would cut the margin on a slow runner. finance-scale (4) and persistent-dataset (c) still upload by buffer: their zips are 714 KB / 42 KB (~32 / ~12 ms decode), ~30x below the ceiling; only their comments changed.
files_changed: [tests/e2e/import-flow.spec.ts, tests/e2e/helpers.ts, tests/e2e/persistent-dataset.spec.ts, tests/e2e/finance-scale.spec.ts]
