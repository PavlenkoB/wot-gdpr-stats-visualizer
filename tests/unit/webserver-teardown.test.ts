import { afterEach, describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../../playwright.config';

// =============================================================================
// Regression test for the ci-e2e-cancel debug session
// (.planning/debug/resolved/ci-e2e-cancel.md).
// =============================================================================
//
// Root cause (confirmed by direct reproduction): Playwright's webServer
// plugin spawns `config.webServer.command` with `{ detached: true, shell:
// true, stdio: ['pipe','pipe','pipe'] }` and, absent `gracefulShutdown`
// (unset here — see TestConfigWebServer.gracefulShutdown docs: "If
// unspecified, the process group is forcefully SIGKILLed"), tears it down
// with `process.kill(-spawnedProcess.pid, 'SIGKILL')` — a signal to the
// process GROUP of the immediately spawned shell only.
//
// `pnpm run <script>` (and `pnpm exec <bin>`) spawns the actual server
// binary in its OWN, separate process group rather than the shell's group.
// The group-kill therefore never reaches it: the server process survives,
// orphaned, still holding the shell's inherited stdout/stderr pipes open.
// Node's ChildProcess 'close' event requires BOTH exit AND stdio-stream
// closure, so it never fires — Playwright's `await this._killProcess?.()`
// in `WebServerPlugin.teardown()` hangs forever, and the run eventually
// dies with "Timed out waiting {globalTimeout}ms for the teardown for
// plugin setup to run" even though every test already passed.
//
// This test mirrors Playwright's exact spawn+kill mechanism directly
// against the REAL `webServer.command` in playwright.config.ts (imported,
// not hand-copied, so config drift can't silently invalidate the test) and
// asserts the child's 'close' event fires within a bounded window after a
// Playwright-style group SIGKILL. Before the fix (`pnpm run build && pnpm
// run preview`) this reliably times out; direct binary invocation does not.
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function launchLikePlaywright(command: string): ChildProcess {
  // Matches playwright-core's launchProcess() spawnOptions exactly for the
  // non-Windows, stdio !== 'pipe'-option case our webServer config hits
  // (WebServerPlugin passes `stdio: 'stdin'`, which launchProcess maps to
  // ['pipe','pipe','pipe'] for stdin/stdout/stderr).
  return spawn(command, [], {
    detached: process.platform !== 'win32',
    shell: true,
    cwd: REPO_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function killProcessGroupLikePlaywright(child: ChildProcess): void {
  // Matches launchProcess()'s killProcess(): process.kill(-pid, 'SIGKILL').
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Already dead — fine.
  }
}

/** Best-effort cleanup of anything still bound to the preview port, in case
 * this test itself reproduces the orphaning bug it's designed to catch. */
function forceFreePort(port: number): void {
  try {
    const pids = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // Already dead — fine.
      }
    }
  } catch {
    // lsof exits non-zero when nothing is listening — nothing to clean up.
  }
}

async function waitForReachable(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Server never became reachable at ${url} within ${timeoutMs}ms`);
}

describe('playwright webServer teardown (process-group orphan regression)', () => {
  let child: ChildProcess | undefined;

  afterEach(() => {
    if (child) killProcessGroupLikePlaywright(child);
    child = undefined;
    forceFreePort(4173);
  });

  test('webServer.command process group fully closes after a Playwright-style SIGKILL (no orphaned grandchild holding the pipe/port open)', async () => {
    const webServer = config.webServer;
    const command = webServer && !Array.isArray(webServer) ? webServer.command : undefined;
    expect(command, 'playwright.config.ts must define a single webServer.command').toBeTypeOf(
      'string',
    );

    child = launchLikePlaywright(command as string);
    expect(child.pid, 'spawn must produce a pid').toBeDefined();

    await waitForReachable(config.use?.baseURL ?? 'http://localhost:4173/', 30_000);

    const closed = new Promise<void>((resolve) => {
      child?.once('close', () => resolve());
    });

    killProcessGroupLikePlaywright(child);

    const outcome = await Promise.race([
      closed.then(() => 'closed' as const),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5_000)),
    ]);

    expect(
      outcome,
      'child process "close" event did not fire within 5s of a Playwright-style group ' +
        'SIGKILL — a grandchild process escaped the killed process group and is still ' +
        'holding the stdout/stderr pipe (and likely the preview port) open. This is the ' +
        'exact hang Playwright reports as "Timed out waiting Nms for the teardown for ' +
        'plugin setup to run".',
    ).toBe('closed');
  }, 45_000);
});
