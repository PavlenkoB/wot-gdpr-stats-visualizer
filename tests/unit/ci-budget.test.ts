import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../../playwright.config';

// =============================================================================
// CI e2e budget guard (plan 04-13).
// =============================================================================
//
// Three limits protect the e2e step, and nothing in the repository enforced
// their ORDER before this file did:
//   1. `globalTimeout` in playwright.config.ts  — Playwright's own deadline.
//      When it fires, the run aborts with per-test diagnostics.
//   2. `timeout <N>m playwright test` in .github/workflows/ci.yml — the shell
//      wrapper. When it fires first, the job dies with "operation canceled"
//      and no indication of which test hung: the exact failure mode the
//      ci-e2e-cancel debug session traced and fixed.
//   3. `timeout-minutes:` on the job — the outermost GitHub Actions deadline.
//
// If (2) or (3) is shorter than (1), the limit above the run is the one that
// fires and the diagnostic value of (1) is lost. If any of them is shorter
// than the run actually needs, a passing suite is reported as a failure.
// The e2e phase's own suite costs grew by 27 tests over Phases 1-3 (86 ->
// 109) while these three numbers stayed at their Phase-1 values, so this
// guard now pins the projection the plan derived AND the ordering.
//
// The projection (see 04-13-SUMMARY.md for the measured inputs, and
// 05-16-SUMMARY.md for the finance block and the raise it forced):
//
//   E = PRE_PHASE_SECONDS
//     + SECONDS_PER_NEW_TEST * (L - PRE_PHASE_TEST_COUNT
//                              - SCALE_SPEC_TEST_COUNT
//                              - FINANCE_SCALE_TEST_COUNT)
//     + SCALE_SPEC_SECONDS
//     + FINANCE_SCALE_SECONDS
//
//   L = the number of tests `playwright test --list` actually reports.
//
// TWO scale specs, priced as BLOCKS. Both files open a browser context, build
// a multi-megabyte export in Node and import it, and then their remaining
// tests read one already-rendered DOM — so a per-test increment would charge
// each of their cheap assertions for the import that only the first one pays.
// Each is therefore subtracted from the per-test count and added back as one
// allowance, which is why a fifth test in either file costs 0 s and the sixth
// browser test anywhere costs 5 s.
//
// Every constant below is either MEASURED in this repository or an ESTIMATE
// carried forward from an earlier phase, and is labelled as such. The
// estimation lives here, not in a comment, because `globalTimeout` is
// compared against the value this function returns: a comment can drift
// without consequence, this cannot. The single input that is not yet
// measured is PRE_PHASE_SECONDS (no CI run has executed the phase-4 suite);
// the first CI run replaces it with a real number.
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');

/** E2E tests at the end of Phase 3 — MEASURED (03-VERIFICATION: 86/86). */
const PRE_PHASE_TEST_COUNT = 86;

/** ~5.5 min for the pre-phase suite — ESTIMATE. Carried forward, not measured:
 * the "~5.5 min" figure it comes from was recorded for Phase 1's 20-test
 * suite, so it was never a measurement of the 86-test suite either. The same
 * 109 tests run at CI's worker count on the development machine take 1.8 min
 * (04-13 measurement), so this baseline is ~3x the local cost and exists to
 * cover the unknown self-hosted runner. */
const PRE_PHASE_SECONDS = 330;

/** Tests in playtime-scale.spec.ts — MEASURED (5, not the 6 the plan assumed). */
const SCALE_SPEC_TEST_COUNT = 5;

/** Allowance for the 60,000-session scale spec — ESTIMATE from 04-12. Its
 * tests share one expensive import, so they are priced as a block rather than
 * per test. */
const SCALE_SPEC_SECONDS = 120;

/** Tests in finance-scale.spec.ts — MEASURED with `playwright test --list` at
 * the end of 05-16 Task 1: 184 tests in 16 files, five of them in this file. */
const FINANCE_SCALE_TEST_COUNT = 5;

/**
 * Allowance for the 50,000-operation finance scale spec — ESTIMATE from 05-16,
 * and the FLOOR is what binds. Plan 05-16 Task 2 defines the value as "the
 * Task 1 measured 50,000-row import time rounded up plus the 10,000-row
 * replace, never below 90". Task 1 MEASURED both on this machine:
 *
 *   50,000 operations, submission to `ready`:  1,414 ms  -> 2 s rounded up
 *   10,000 operations, replace to `ready`:         947 ms  -> 1 s rounded up
 *   computed:                                                        3 s
 *   floor:                                                           90 s
 *
 * so this is 90, and the reason the floor exists is visible in that
 * arithmetic: the two import timings are the WHOLE cost of the expensive part,
 * and they leave out everything else the block pays — a browser context, the
 * Vite preview server's first module graph, rendering six charts and a
 * 5.5 MB CSV in Node, and a second context for the replace. Those are what
 * 04-13's 120 s block is really made of, and they are unmeasured on a CI
 * runner. 90 is deliberately below the 60,000-session spec's 120 s: the
 * finance block imports a 5.5 MB export where the activity block imports a
 * 60,000-session one, and a floor that overstates this block would raise all
 * three limits further than the evidence supports.
 */
const FINANCE_SCALE_SECONDS = 90;

/** Per-test increment for a browser-backed test — ESTIMATE from the phase. */
const SECONDS_PER_NEW_TEST = 5;

/** `globalTimeout` must be at least this multiple of E. */
const MIN_GLOBAL_MARGIN = 1.3;

/** The shell wrapper must outlast `globalTimeout` by at least this, so the
 * diagnostic deadline is always the one that fires first. */
const MIN_WRAPPER_OVERHEAD_SECONDS = 90;

/** The job must outlast the wrapper by at least this, leaving room to reach
 * the e2e step at all. */
const MIN_JOB_OVERHEAD_SECONDS = 300;

/** `playwright test --list` is config parsing and spec loading only. It took
 * 0.3 s for all 109 tests; 60 s is a ceiling, not an expectation. */
const LIST_TIMEOUT_MS = 60_000;

function projectedE2eSeconds(listedTests: number): number {
  const newTests = Math.max(
    0,
    listedTests - PRE_PHASE_TEST_COUNT - SCALE_SPEC_TEST_COUNT - FINANCE_SCALE_TEST_COUNT,
  );
  return (
    PRE_PHASE_SECONDS + SECONDS_PER_NEW_TEST * newTests + SCALE_SPEC_SECONDS + FINANCE_SCALE_SECONDS
  );
}

function listedTestTotal(): { total: number; files: number } {
  const output = execFileSync(
    path.join(REPO_ROOT, 'node_modules', '.bin', 'playwright'),
    ['test', '--list', '--reporter=list'],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: LIST_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
  );
  const match = /Total: (\d+) tests? in (\d+) files?/.exec(output);
  if (!match) {
    throw new Error(
      `\`playwright test --list\` printed no "Total: N tests in M files" line:\n${output}`,
    );
  }
  return { total: Number(match[1]), files: Number(match[2]) };
}

function activeWorkflowLines(): string {
  return readFileSync(WORKFLOW, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function workflowTimeouts(): { jobSeconds: number; wrapperSeconds: number } {
  const active = activeWorkflowLines();
  const job = [...active.matchAll(/^\s*timeout-minutes:\s*(\d+)\s*$/gm)].map(
    (m) => Number(m[1]) * 60,
  );
  const wrapper = [...active.matchAll(/timeout\s+(\d+)m\s+playwright\s+test/g)].map(
    (m) => Number(m[1]) * 60,
  );

  expect(
    job.length,
    `.github/workflows/ci.yml must declare exactly one active \`timeout-minutes:\` on the job — found ${job.length}`,
  ).toBe(1);
  expect(
    wrapper.length,
    `.github/workflows/ci.yml must declare exactly one active \`timeout <N>m playwright test\` wrapper — found ${wrapper.length}`,
  ).toBe(1);

  return { jobSeconds: job[0], wrapperSeconds: wrapper[0] };
}

function globalTimeoutSeconds(): number {
  return (config.globalTimeout ?? 0) / 1000;
}

function smallestPassingMinutes(e: number): number {
  return Math.ceil((e * MIN_GLOBAL_MARGIN) / 60);
}

describe('CI e2e budget', () => {
  test('the workflow declares one job timeout and one shell wrapper, both positive', () => {
    const { jobSeconds, wrapperSeconds } = workflowTimeouts();

    expect(jobSeconds).toBeGreaterThan(0);
    expect(wrapperSeconds).toBeGreaterThan(0);
  });

  test('playwright test --list exits 0 and reports at least the pre-phase suite', () => {
    const { total, files } = listedTestTotal();

    expect(total).toBeGreaterThanOrEqual(PRE_PHASE_TEST_COUNT);
    expect(files).toBeGreaterThan(0);
  });

  test('the projection is the arithmetic the plan derived', () => {
    // The 184-test, 5-test-per-scale-spec shape MEASURED at the end of 05-16
    // Task 1: 330 + 5 * (184 - 86 - 5 - 5) + 120 + 90 = 980.
    expect(projectedE2eSeconds(184)).toBe(980);
    // One test beyond the baseline and BOTH scale specs is worth exactly one
    // increment; the projection never falls below the baseline + both
    // allowances, even when a caller passes a count below the baseline.
    expect(
      projectedE2eSeconds(
        PRE_PHASE_TEST_COUNT + SCALE_SPEC_TEST_COUNT + FINANCE_SCALE_TEST_COUNT + 1,
      ),
    ).toBe(545);
    expect(projectedE2eSeconds(PRE_PHASE_TEST_COUNT)).toBe(540);
  });

  test('globalTimeout is at least 1.3x the projected e2e duration', () => {
    const { total } = listedTestTotal();
    const e = projectedE2eSeconds(total);
    const global = globalTimeoutSeconds();

    expect(
      global,
      `Global timeout ${global} s is under ${MIN_GLOBAL_MARGIN}x the projected e2e duration ` +
        `${e} s for ${total} listed tests; the smallest passing whole number of minutes ` +
        `is ${smallestPassingMinutes(e)}.`,
    ).toBeGreaterThanOrEqual(e * MIN_GLOBAL_MARGIN);
  });

  test('the shell wrapper outlives globalTimeout by at least 90 s', () => {
    const { wrapperSeconds } = workflowTimeouts();
    const global = globalTimeoutSeconds();

    expect(
      wrapperSeconds,
      `Wrapper ${wrapperSeconds} s must be at least globalTimeout + ${MIN_WRAPPER_OVERHEAD_SECONDS} s ` +
        `(${global + MIN_WRAPPER_OVERHEAD_SECONDS} s), or the wrapper fires first and the run dies ` +
        `with "operation canceled" and no test context.`,
    ).toBeGreaterThanOrEqual(global + MIN_WRAPPER_OVERHEAD_SECONDS);
  });

  test('the job outlives the wrapper by at least 300 s', () => {
    const { jobSeconds, wrapperSeconds } = workflowTimeouts();

    expect(
      jobSeconds,
      `Job timeout ${jobSeconds} s must be at least wrapper + ${MIN_JOB_OVERHEAD_SECONDS} s ` +
        `(${wrapperSeconds + MIN_JOB_OVERHEAD_SECONDS} s), or the job is cancelled while the e2e ` +
        `step is still running.`,
    ).toBeGreaterThanOrEqual(wrapperSeconds + MIN_JOB_OVERHEAD_SECONDS);
  });
});
