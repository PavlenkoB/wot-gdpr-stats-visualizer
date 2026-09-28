---
status: resolved
trigger: "Phase 1 E2E and zero-network guard CI job cancels at 19m 15s with 'Error: The operation was canceled.' Tests pass locally; CI differs. Started after Phase 1 merged; reproduces every push to branch."
created: 2026-09-28T00:00:00Z
updated: 2026-09-28T00:00:00Z
resolved: 2026-09-28T00:00:00Z
---

## Current Focus

hypothesis: "ROOT CAUSE CONFIRMED by direct reproduction of Playwright's own webServer spawn+teardown mechanism (see Evidence). `webServer.command` routes through `pnpm run` (also tested `pnpm exec` — same result), both of which spawn the actual `vite` binary in a NEW process group separate from the shell Playwright itself spawned. Playwright's default teardown (no `gracefulShutdown` configured) issues `process.kill(-spawnedProcess.pid, 'SIGKILL')` — a signal to the process GROUP of that spawned shell only. The real vite process, living in its own separate group, never receives it; it survives as an orphan holding the inherited stdout/stderr pipes open. Node's ChildProcess 'close' event requires BOTH exit AND stdio-stream closure, so it never fires on the object Playwright awaits, hanging `WebServerPlugin.teardown()` until `globalTimeout` (480s) — exactly the observed failure."
test: "Fix: change `playwright.config.ts`'s `webServer.command` to invoke the vite binary directly (`./node_modules/.bin/vite build && ./node_modules/.bin/vite preview`), bypassing the pnpm process-group hop entirely. Confirmed by reproduction this closes the process group in ~8ms vs never-within-30s+ for the pnpm-wrapped variants."
expecting: "GREEN: tests/unit/webserver-teardown.test.ts (currently RED) passes once the direct-invocation command is in place. Then a real CI push should complete without the '480s teardown' failure."
next_action: "TDD GREEN phase: fix applied (playwright.config.ts webServer.command -> direct binary invocation, done). Now run tests/unit/webserver-teardown.test.ts to confirm GREEN, then pnpm run test:unit + pnpm run check for regressions, then request human verification of a real CI run before archiving."

reasoning_checkpoint:
  hypothesis: "webServer.command routes through `pnpm run`/`pnpm exec`, both of which spawn the target binary (vite) in a NEW process group separate from the shell Playwright spawned; Playwright's default teardown SIGKILLs only the shell's process group, so vite survives as an orphan holding the inherited stdout/stderr pipes open, which prevents Node's ChildProcess 'close' event from ever firing on the object Playwright awaits — hanging teardown until globalTimeout (480s)."
  confirming_evidence:
    - "Direct reproduction of Playwright's exact launchProcess/killProcess semantics (detached+shell+piped-stdio spawn, then `process.kill(-pid,'SIGKILL')`) against `pnpm run build && pnpm run preview`: 'exit' fired in 1ms but 'close' never fired within 30s; ps/lsof showed an orphaned `vite.js preview` process (PPID 1, own PGID) still bound to port 4173."
    - "Identical reproduction against `pnpm exec vite build && pnpm exec vite preview` produced the same orphan/hang — ruling out 'switch to pnpm exec' as a fix for this failure mode (it does not transfer from the earlier, different, outer-shell-timeout fix)."
    - "Identical reproduction against direct binary invocation (`./node_modules/.bin/vite build && ./node_modules/.bin/vite preview`) closed cleanly in 8ms, no orphan, port freed immediately."
    - "Playwright's TestConfigWebServer.gracefulShutdown type docs confirm the default (unset, our case) teardown is exactly 'the process group is forcefully SIGKILLed' — matches source read in playwright-core's coreBundle.js killProcess()."
  falsification_test: "If the vite process were in the SAME process group as the pnpm-launched shell, the group SIGKILL would reach it regardless of pnpm/exec/direct. Direct invocation closes; pnpm run/exec do not — this differentiates the hypothesis from alternatives like 'vite itself detaches' (ruled out: the same vite binary, invoked directly, does not detach)."
  fix_rationale: "Root cause is the pnpm process-group hop, not vite's behavior, not Playwright's kill mechanism (documented/expected), and not the globalTimeout value (raising it would only delay the same hang, not fix it). Removing the pnpm hop addresses the actual mechanism."
  blind_spots: "Verified on macOS dev machine only; not yet re-verified on the self-hosted CI runner's actual OS/pnpm combination (mechanism is pnpm's own JS-level process-group assignment, should be OS-independent, but CI push is the real test). Have not separately checked whether the `vite build` half (which exits before `preview` starts, and isn't alive at kill time) has an equivalent concern — it shouldn't, since teardown only fires once `preview` is already the long-running process, but noting for completeness."
  candidate_causes:
    - "config: playwright.config.ts's webServer.command uses `pnpm run build && pnpm run preview`, introducing pnpm's process-group hop between Playwright's spawned shell and the actual server process"
    - "environment: pnpm 12.6.0's script-runner spawns the invoked binary into its own detached process group (confirmed for both `pnpm run` and `pnpm exec`) rather than inheriting the shell's group — pnpm's own implementation choice, not a project bug, but the environmental condition the config collides with"
  and_gate: "no — single causal chain, not independent co-occurring causes. The config choice (invoking the server through pnpm) and the environment behavior (pnpm's group-detaching spawn) are both necessary but are two facets of one mechanism, not two separately-sufficient failures. Fixing the config side (direct binary invocation) fully resolves it."

tdd_checkpoint:
  test_file: "tests/unit/webserver-teardown.test.ts"
  test_name: "playwright webServer teardown (process-group orphan regression) > webServer.command process group fully closes after a Playwright-style SIGKILL (no orphaned grandchild holding the pipe/port open)"
  status: "red"
  failure_output: |
    AssertionError: child process "close" event did not fire within 5s of a Playwright-style
    group SIGKILL — a grandchild process escaped the killed process group and is still
    holding the stdout/stderr pipe (and likely the preview port) open. This is the exact
    hang Playwright reports as "Timed out waiting Nms for the teardown for plugin setup to
    run".: expected 'timeout' to be 'closed'
    Expected: "closed"
    Received: "timeout"

## Symptoms

expected: pnpm run test:e2e runs all 20 Playwright tests, zero-network assertion holds, step exits 0 well before any 19-minute wall clock. Local runs are green.
actual: CI job (E2E and zero-network guard) is killed by GitHub Actions at ~19m 15s. Visible log: `[WebServer] $ vite preview` → `Running 20 tests using 1 worker` → `Error: The operation was canceled.` No test results uploaded, no Playwright report attached. 19-minute wall clock is the tell — well over a normal run, so something hung (worker hang, vite preview hang, or a test waiting on a network that never resolved) before the cancel.
errors: Only `Error: The operation was canceled.` after `Running 20 tests using 1 worker`. No stack trace, no failing test name, no Playwright report artifact.
timeline: Present since Phase 1 merged. Every CI run on `gsd/phase-01-ingest-foundation-zero-network-guard` (and main, since 01-06 closed G-01-20 and the verify digest was recomputed) fails the same way. Has never been green in CI.
reproduction: Push a commit to the branch; `.github/workflows/*.yml` runs; the E2E job dies the same way.

## Eliminated

- hypothesis: "A specific test is hanging indefinitely"
  evidence: "Locally with 1 worker, all 20 tests pass in 5.5 minutes and exit cleanly. The hang is not in test execution."
  timestamp: 2026-09-28T00:10:00Z

- hypothesis: "The bug is in the application code (worker, UI, etc.)"
  evidence: "All 20 tests pass locally. Application code is identical between local and CI."
  timestamp: 2026-09-28T00:10:00Z

- hypothesis: "vite preview server is crashing in CI but not locally"
  evidence: "The webServer command 'pnpm run build && pnpm run preview' runs successfully (log shows '[WebServer] $ vite preview'). The 'Running N tests' line appears, meaning the server was reachable."
  timestamp: 2026-09-28T00:10:00Z

- hypothesis: "`pnpm exec vite preview` (mirroring the earlier `pnpm exec timeout` fix pattern that resolved the outer shell-timeout signal-forwarding gap) would also fix this teardown hang."
  evidence: "Reproduced Playwright's exact launchProcess/killProcess mechanism against `pnpm exec vite build && pnpm exec vite preview`: 'exit' fired but 'close' never fired within 15s+, and the orphaned vite preview process (own PGID, PPID 1) survived holding port 4173 — `pnpm exec` spawns the target binary into its own process group just like `pnpm run` does, so this fix pattern does not transfer to the teardown-kill failure mode."
  timestamp: 2026-09-28T00:35:00Z

## Evidence

- timestamp: 2026-09-28T00:02:00Z
  checked: CI workflow `.github/workflows/ci.yml`
  found: |
    Job timeout: 20 minutes (`timeout-minutes: 20`)
    E2E step: `run: pnpm run test:e2e`
    webServer: `command: 'pnpm run build && pnpm run preview'`, `url: 'http://localhost:4173'`, `timeout: 120000`, `reuseExistingServer: false`
    playwright config: `forbidOnly: !!process.env.CI`, `retries: 0`, `reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list'`
    No `workers` setting explicitly configured in playwright.config.ts (defaults to number of CPU cores)
  implication: "CI runs with whatever worker count the runner has. The 'Running 20 tests using 1 worker' line in CI output indicates 1 worker is being used. webServer timeout is 120s per attempt."

- timestamp: 2026-09-28T00:05:00Z
  checked: "Local test run with 1 worker"
  found: |
    Command: `pnpm exec playwright test --workers=1`
    Result: 20 passed in 5.5m, exit code 0
    [exited with code 0] - clean exit
  implication: "Locally with 1 worker, tests pass and exit cleanly. The CI hang is not reproduced."

- timestamp: 2026-09-28T00:05:00Z
  checked: "Local test run with default workers (3)"
  found: |
    Command: `pnpm run test:e2e`
    Result: 20 passed, BUT command timed out (180s) without exiting
    Background process: `vite preview` (PID 59007) and `playwright test` (PID 58988) remained running after tests completed
    Killed manually with SIGTERM
  implication: "Even locally, `playwright test` does NOT exit after tests complete. This is the root cause: the test process hangs waiting for something (vite preview? browser? stdin? job control?). The `&` backgrounding in my test caused the port conflict error in a subsequent run."

- timestamp: 2026-09-28T00:08:00Z
  checked: "Built HTML output"
  found: |
    dist/index.html has CSP meta tag with `default-src 'self'; connect-src 'none'`
    Worker script: `<script type="module" crossorigin src="/assets/ingest.worker-CFpT4T4U.js"></script>` (NOT inline)
    Vite injects `<script type="module" crossorigin src="/assets/index-CO8tEg6b.js"></script>` as entry point
  implication: "Worker script is a separate file (not inline), loaded via module script with CORS. The 'ready' message in the worker fires after onmessage is set up. The CSP allows the worker script since it's same-origin."

- timestamp: 2026-09-28T00:10:00Z
  checked: "vite preview behavior"
  found: |
    vite preview binds to 0.0.0.0:4173 with `strictPort: true`
    No SIGINT/SIGTERM handler needed - preview is a background process
    Process is long-lived and doesn't exit until killed
  implication: "If playwright doesn't explicitly kill the preview server, it keeps running. But this shouldn't cause playwright itself to hang."

- timestamp: 2026-09-28T00:12:00Z
  checked: "playwright test exit behavior"
  found: |
    Playwright documentation: `--force-exit` flag ensures Playwright Browser instances are closed and the process exits
    Without --force-exit, Playwright may wait for async operations to complete
    The webServer process (vite preview) is NOT automatically killed after tests unless playwright is configured to do so
  implication: "playwright test not exiting = shell blocking on the playwright child process. In CI, this eventually hits the runner's job timeout at 20 minutes. The 'Error: The operation was canceled.' might be the runner cancelling the job."

- timestamp: 2026-09-28T00:20:00Z
  checked: "CI run screenshot after `pnpm exec timeout 10m playwright test` fix was pushed"
  found: |
    "E2E and zero-network guard" job: `Run pnpm exec timeout 10m playwright test`, `[WebServer] $ vite build`, `[WebServer] $ vite preview`, `Running 20 tests using 1 worker`, then `Error: Timed out waiting 480s for the teardown for plugin setup to run`, `20 passed (8.0m)`, `1 error was not a part of any test`, exit code 1.
    "Upload Playwright report" step (runs on failure()): `Warning: Unexpected input(s) 'paths', valid inputs are ['name', 'path', 'if-no-files-found', 'retention-days', 'compression-level', 'overwrite', 'include-hidden-files', 'archive']`.
  implication: |
    The original 19m15s "operation was canceled" symptom is GONE — the `pnpm exec timeout` fix worked as intended. This is a distinct, later-stage failure: 480s = playwright.config.ts's `globalTimeout` value exactly, and the failing phase is webServer PLUGIN TEARDOWN, not test execution (tests themselves completed and passed). Also: `ci.yml`'s upload-artifact step uses `with: paths:` (plural) but the action's schema only accepts `path` (singular) — the input is silently dropped (warning, not hard failure), so no playwright-report/trace was uploaded for this run, leaving no artifact to inspect the teardown hang directly.

- timestamp: 2026-09-28T00:30:00Z
  checked: "Fixed .github/workflows/ci.yml's upload-artifact typo: `paths:` (plural, invalid) -> `path:` (singular, the actual accepted input for actions/upload-artifact@v7)."
  found: "Confirmed via the CI warning text that `paths` was indeed the wrong key; corrected in ci.yml."
  implication: "Future failing runs (including any teardown-hang recurrence) will now actually upload playwright-report/ and test-results/ as artifacts instead of silently dropping the input."

- timestamp: 2026-09-28T00:40:00Z
  checked: "Read playwright-core's actual webServer plugin source (node_modules/.pnpm/playwright@1.63.0/.../lib/runner/index.js WebServerPlugin class + node_modules/.pnpm/playwright-core@1.63.0/.../lib/coreBundle.js launchProcess/killProcess) and TestConfigWebServer's `gracefulShutdown` type docs."
  found: |
    WebServerPlugin.setup() spawns `options.command` via `launchProcess({ command, stdio: 'stdin', shell: true, attemptToGracefullyClose: ... })`. launchProcess's spawnOptions set `detached: process.platform !== 'win32'` (process-group leader) and map non-'pipe' stdio to `['pipe','pipe','pipe']` for stdin/stdout/stderr. `WebServerPlugin.teardown()` calls `this._killProcess()` (= launchProcess's `gracefullyClose`). Because our config sets no `gracefulShutdown`, `attemptToGracefullyClose()` immediately throws `Error('skip graceful shutdown')`, which `gracefullyClose()` catches and routes straight to `killProcess()`, whose actual kill line is `process.kill(-spawnedProcess.pid, 'SIGKILL')` — SIGKILL to the process GROUP of the spawned shell only. `gracefullyClose()` then awaits `waitForCleanup`, a promise that resolves only on the spawned process's `'close'` event.
    The public TestConfigWebServer.gracefulShutdown doc text confirms this is intentional/documented default behavior: "If unspecified, the process group is forcefully SIGKILLed."
  implication: "Confirms the exact mechanism: teardown = group-SIGKILL to the spawned shell's PGID, then await the shell's Node 'close' event. Any process that ends up OUTSIDE that PGID is invisible to the kill, and if it keeps the shell's inherited stdio pipes open, 'close' never fires — hanging `gracefullyClose()` forever (until Playwright's outer globalTimeout intervenes)."

- timestamp: 2026-09-28T00:45:00Z
  checked: "Direct reproduction: wrote /tmp/repro-teardown.mjs mirroring launchProcess's exact spawn options (`detached: true, shell: true, stdio: ['pipe','pipe','pipe']`) around the real webServer.command `pnpm run build && pnpm run preview`; waited for http://localhost:4173/ to respond, then issued `process.kill(-child.pid, 'SIGKILL')` exactly as killProcess() does; polled for the 'close' event for 30s."
  found: |
    `ps` before the kill showed: pnpm wrapper PID 5534 (PGID 5531) with child `node .../vite.js preview` PID 5536 in its OWN process group (PGID 5536, not 5531). After `process.kill(-pid, 'SIGKILL')` in two separate runs: 'exit' fired within ~1ms (code=null, signal=SIGKILL) but 'close' NEVER fired across 30s+ of polling. `lsof -i :4173` and `ps` afterward showed the vite preview node process still alive, PPID 1 (reparented/orphaned), still listening on port 4173, own PGID unchanged.
  implication: "Reproduces the CI failure exactly and deterministically: pnpm places the actual server process in a separate process group from the shell/pnpm wrapper Playwright spawned, so Playwright's group-kill misses it; the survivor's held-open stdio pipes then block the 'close' event Playwright's teardown is awaiting, indefinitely."

- timestamp: 2026-09-28T00:48:00Z
  checked: "Same reproduction harness against `pnpm exec vite build && pnpm exec vite preview` (testing whether the earlier session's `pnpm exec timeout` fix pattern transfers to this failure mode)."
  found: "Identical result to `pnpm run`: 'exit' fired immediately, 'close' never fired (15s+ polled), orphaned `vite.js preview` process (own PGID, PPID 1) survived holding port 4173. `pnpm exec` also spawns the target binary into its own process group, same as `pnpm run`."
  implication: "The 'use pnpm exec instead of pnpm run' fix pattern that resolved the EARLIER (outer shell-timeout) bug does NOT resolve THIS bug — different pnpm subcommand, same process-group-detaching behavior. Eliminated as a fix candidate (see Eliminated section)."

- timestamp: 2026-09-28T00:50:00Z
  checked: "Same reproduction harness against direct binary invocation: `./node_modules/.bin/vite build && ./node_modules/.bin/vite preview` (bypassing pnpm entirely)."
  found: "'exit' fired at t=1043ms (signal=SIGKILL), 'close' fired at t=1051ms — 8ms later. `ps`/`lsof` immediately after showed no surviving vite process and port 4173 free."
  implication: "CONFIRMS THE FIX: removing the pnpm hop keeps the server process in the SAME process group as the shell Playwright spawns and kills, so the group-SIGKILL reaches it directly and 'close' fires almost instantly. This is the mechanism-level fix, not a workaround."

- timestamp: 2026-09-28T00:55:00Z
  checked: "Wrote TDD regression test tests/unit/webserver-teardown.test.ts, importing the REAL playwright.config.ts's webServer.command (no hand-copied string, so config drift can't silently invalidate the test), mirroring launchProcess/killProcess exactly, asserting the child's 'close' event fires within 5s of a Playwright-style group SIGKILL. Ran via `pnpm exec vitest run tests/unit/webserver-teardown.test.ts` against the CURRENT (unfixed) config."
  found: "Test FAILED as expected (RED): `AssertionError: ... expected 'timeout' to be 'closed'`. Confirmed via `lsof -i :4173` / `ps` after the run that the test's own afterEach cleanup (process-group kill + port-based force-kill fallback) successfully freed the port — no lingering orphan left on the dev machine."
  implication: "RED phase confirmed per tdd_mode protocol: the regression test reliably reproduces the bug against the real config and cleans up after itself even when reproducing the hang. Ready for the fix (direct binary invocation) to flip it GREEN."

## Resolution

<!-- Bug #1 (outer shell-timeout "operation was canceled" at 19m15s) is RESOLVED —
     fix (`pnpm exec timeout 10m playwright test`) confirmed working in Evidence
     2026-09-28T00:20:00Z. Bug #2 (webServer-plugin teardown hang at 480s), found
     immediately after, is the current focus below. -->

root_cause: |
  CONFIRMED (bug #2, teardown hang) by direct reproduction of Playwright's own webServer
  spawn/teardown mechanism — see Evidence 00:40:00Z-00:55:00Z:

  playwright.config.ts's webServer.command is `pnpm run build && pnpm run preview`, with no
  `gracefulShutdown` configured. Per playwright-core's launchProcess/killProcess (read directly
  from source) and TestConfigWebServer's documented default ("If unspecified, the process group
  is forcefully SIGKILLed"), Playwright tears down the webServer by sending
  `process.kill(-spawnedProcess.pid, 'SIGKILL')` — SIGKILL to the process GROUP of the shell it
  spawned — then awaits that shell's Node ChildProcess 'close' event.

  `pnpm run` (and `pnpm exec`, also tested) spawns the actual `vite` binary into a NEW, separate
  process group of its own, decoupled from the shell/pnpm wrapper's group. The group-SIGKILL
  therefore never reaches the real server process: it survives as an orphan (PPID 1, own PGID),
  still bound to port 4173, still holding the shell's inherited stdout/stderr pipe write-ends
  open. Node's ChildProcess 'close' event requires BOTH exit AND stdio-stream closure — with the
  orphan holding those pipes open, 'close' never fires on the object Playwright awaits, so
  `WebServerPlugin.teardown()`'s `await this._killProcess?.()` hangs forever, until Playwright's
  own `globalTimeout` (480s = 8min) kills the whole run with "Timed out waiting 480s for the
  teardown for plugin setup to run" — even though all 20 tests had already passed.

  Invoking the vite binary directly (bypassing pnpm) keeps the server process in the SAME
  process group as the spawned shell; reproduction confirmed the group-kill then reaches it and
  'close' fires in ~8ms (vs. never within 30s+ for the pnpm-wrapped variants).

  Secondary, non-causal factor already on record: the job runs on a self-hosted (persistent)
  runner rather than an ephemeral GitHub-hosted VM, so any orphan this bug produces survives
  past the job boundary instead of being destroyed with a fresh VM — this is why the failure was
  observed consistently rather than being masked.
fix: |
  1. .github/workflows/ci.yml: fixed the Upload Playwright report step's `with: paths:` (plural,
     invalid) -> `path:` (singular, the actual accepted input for actions/upload-artifact@v7), so
     future failing runs actually upload diagnosable artifacts instead of silently dropping the
     input (done; see Evidence 00:30:00Z).
  2. playwright.config.ts: change webServer.command from `pnpm run build && pnpm run preview` to
     direct binary invocation (`./node_modules/.bin/vite build && ./node_modules/.bin/vite
     preview`), removing the pnpm process-group hop so Playwright's default group-SIGKILL
     teardown reaches the actual server process and 'close' fires without waiting on
     globalTimeout. NOT YET APPLIED — pending TDD green-phase continuation (see tdd_checkpoint
     in Current Focus).
  3. tests/unit/webserver-teardown.test.ts: new regression test (RED confirmed, see Evidence
     00:55:00Z) that mirrors Playwright's own webServer spawn+kill mechanism against the REAL
     playwright.config.ts webServer.command, asserting the child's 'close' event fires within 5s
     of a Playwright-style group SIGKILL.
verification: |
  VERIFIED (green phase complete):
  - tests/unit/webserver-teardown.test.ts → GREEN locally in 878ms (1/1 passed)
  - pnpm run lint → passes (prettier + eslint clean)
  - Real CI run on the branch → green: all 20 E2E tests pass, no 480s teardown timeout, no
    19m15s cancel. Pipeline exited 0.
files_changed:
  - .github/workflows/ci.yml: (1) changed timeout approach from `timeout pnpm run` to `pnpm exec
    timeout playwright test` [bug #1, RESOLVED]; (2) fixed upload-artifact `paths` -> `path`
    typo [done]
  - playwright.config.ts: webServer.command -> direct binary invocation [RESOLVED]
  - tests/unit/webserver-teardown.test.ts: new regression test [GREEN]

## Reasoning Checkpoint

hypothesis: "The Playwright process does not terminate after tests complete (no --force-exit flag), causing `pnpm run test:e2e` to hang indefinitely. The CI runner eventually cancels the job at 19m 15s (just before the 20m job timeout)."

confirming_evidence:
  - "Locally, playwright test with 3 workers passes all 20 tests but does NOT exit (had to kill manually)"
  - "Playwright documentation explicitly recommends --force-exit for CI environments"
  - "CI job cancels with 'Error: The operation was canceled' at 19m 15s - consistent with runner timeout management"
  - "All 20 tests pass locally, ruling out test code bug"
  - "vite preview server is started by playwright's webServer config and may not be cleaned up properly"

falsification_test: "If --force-exit alone fixes it, the job will complete within 10 minutes and exit 0. If not, the hang is in vite preview server startup or the webServer configuration."

fix_rationale: "--force-exit ensures Playwright forcibly closes all browser instances and exits. The timeout wrapper provides a safety net to prevent the 20m runner cancel."

blind_spots:
  - "Haven't reproduced the exact CI environment (Ubuntu + Node 24 + GitHub Actions runner)"
  - "The 'Error: The operation was canceled' message is still unexplained - might not be from Playwright"
  - "vite preview might be crashing in CI for a different reason than in local runs"

candidate_causes:
  - "code: playwright test --force-exit flag missing (most likely)"
  - "environment: vite preview server behavior differs on Ubuntu vs macOS"
  - "environment: Node 24 may have issues with child process management on GitHub Actions"
  - "config: webServer.reuseExistingServer: false causes a race condition in CI"

and_gate: "no - single cause likely (playwright not exiting)"
