import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../../../playwright.config';

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
// The projection (see 04-13-SUMMARY.md for the measured inputs, 05-16-SUMMARY.md
// for the finance block and the raise it forced, and 06-14-SUMMARY.md for the
// login block and the raise it forced):
//
//   E = PRE_PHASE_SECONDS
//     + SECONDS_PER_NEW_TEST * (L - PRE_PHASE_TEST_COUNT
//                              - SCALE_SPEC_TEST_COUNT
//                              - FINANCE_SCALE_TEST_COUNT
//                              - LOGIN_SCALE_SPEC_TEST_COUNT)
//     + SCALE_SPEC_SECONDS
//     + FINANCE_SCALE_SECONDS
//     + LOGIN_SCALE_SPEC_SECONDS
//
//   L = the number of tests `playwright test --list` actually reports.
//
// THREE scale specs, priced as BLOCKS. Each file opens a browser context, builds
// a multi-megabyte export in Node and imports it, and then its remaining tests
// read one already-rendered DOM — so a per-test increment would charge each of
// their cheap assertions for the import that only the first one pays. Each is
// therefore subtracted from the per-test count and added back as one allowance,
// which is why a sixth test in any of the three files costs 0 s and the next
// browser test anywhere else costs 5 s.
//
// The worked arithmetic at the 06-14 count (L = 234 tests in 22 files):
//
//   E = 330 + 5 * (234 - 86 - 5 - 5 - 5) + 120 + 90 + 13
//     = 330 + 665 + 223
//     = 1218 s
//   1.3 * E = 1583.4 s, so globalTimeout must be at least 27 min (1620 s);
//   the wrapper is 29 min and the job 37 min (G + 2 and W + 8), and 27 min holds
//   up to 239 listed tests.
//
// 07-03 added the second Playwright project, `chromium-mobile`, and the five
// touch specs that run only on it. `playwright test --list` counts BOTH
// projects, so the five new tests are five new listed tests and nothing about
// the desktop project shrank — the `touch-` routing removed no spec, it gave
// the five a project of their own. L = 239 tests in 23 files, MEASURED:
//
//   E = 330 + 5 * (239 - 86 - 5 - 5 - 5) + 120 + 90 + 13
//     = 330 + 690 + 223
//     = 1243 s
//   1.3 * E = 1615.9 s, and ceil(1615.9 / 60) = 27 min
//
// so G = 27, W = 29 and J = 37: all THREE were unchanged and no limit moved.
// That was the LAST count 27 min covers — 240 tests would project 1248 s and a
// floor of 1622.4 s against a 1620 s `globalTimeout` — and 07-04 is the plan
// that crossed it, with the three touch specs that put the shared tooltip on
// the remaining chart surfaces. `playwright test --list` still counts BOTH
// projects, so those three are three new listed tests: L = 242 in 23 files,
// MEASURED:
//
//   E = 330 + 5 * (242 - 86 - 5 - 5 - 5) + 120 + 90 + 13
//     = 330 + 705 + 223
//     = 1258 s
//   1.3 * E = 1635.4 s, and ceil(1635.4 / 60) = 28 min
//
// so G = 28, W = 30 and J = 38: all THREE moved together, the same G + 2 and
// W + 8 relationship every raise before them used, and 28 min holds up to 248
// listed tests. The rule this header has carried since 05-14 is the one that
// produced it: raise all three together, never one.
//
// 07-05 is the next plan to cross a ceiling. It added the phone-width sweep
// (six tests, one of them the tracer) and three bounding-box touch-target
// specs on the touch project: 242 + 9 = 251 listed in 25 files, MEASURED. The
// first four of those nine (L = 246) still fit 28 min; the last five did not:
//
//   E = 330 + 5 * (251 - 86 - 5 - 5 - 5) + 120 + 90 + 13
//     = 330 + 750 + 223
//     = 1303 s
//   1.3 * E = 1693.9 s, and ceil(1693.9 / 60) = 29 min
//
// so G = 29, W = 31 and J = 39, all three moved together, and 29 min holds up
// to 258 listed tests.
//
// Phase 8 (the master-detail redesign) HELD all three limits. It deleted the
// 20-test anchor-nav spec and added a 15-test master-detail-nav spec, and no
// migrated spec added a test, so the phase ends BELOW where it started
// (257 at the phase base - 20 + 15 = 252). L = 252 tests in 25 files, MEASURED
// at the end of 08-19 Task 1:
//
//   E = 330 + 5 * (252 - 86 - 5 - 5 - 5) + 120 + 90 + 13
//     = 330 + 755 + 223
//     = 1308 s
//   1.3 * E = 1700.4 s, and ceil(1700.4 / 60) = 29 min
//
// so G = 29, W = 31 and J = 39 stay exactly where 07-05 left them (39.6 s of
// slack against the 1740 s globalTimeout), and 258 listed tests remains the
// ceiling. A count above 258 needs all three raised together, never one.
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
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
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

/** Tests in login-scale.spec.ts — MEASURED with `playwright test --list` at the
 * end of 06-14 Task 2: 234 tests in 22 files, five of them in this file. */
const LOGIN_SCALE_SPEC_TEST_COUNT = 5;

/**
 * Allowance for the 12,000-row login scale spec — ESTIMATE from 06-14.
 *
 * Measured on this machine, one worker, against the built app: the whole file
 * (the 12,000-row import to `ready`, the 662-address table, every sort, the map and
 * the list, the mask) takes 4.2 s. The runner factor this file already uses is
 * the ~3x that the 330 s baseline carries over the development machine's cost,
 * so 4.2 s * 3 = 12.6 s, rounded up to 13. It is deliberately NOT floored at the
 * 90 s the finance block carries: that floor stands for a 5.5 MB CSV built and
 * rendered in Node and a second browser context, neither of which this file
 * pays, and a floor that overstates the block would raise all three limits
 * further than the evidence supports. If the first CI run measures more, this
 * is the number to replace; the 1.3x margin on E is what absorbs it until then.
 */
const LOGIN_SCALE_SPEC_SECONDS = 13;

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
    listedTests -
      PRE_PHASE_TEST_COUNT -
      SCALE_SPEC_TEST_COUNT -
      FINANCE_SCALE_TEST_COUNT -
      LOGIN_SCALE_SPEC_TEST_COUNT,
  );
  return (
    PRE_PHASE_SECONDS +
    SECONDS_PER_NEW_TEST * newTests +
    SCALE_SPEC_SECONDS +
    FINANCE_SCALE_SECONDS +
    LOGIN_SCALE_SPEC_SECONDS
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
    // The 234-test, 5-test-per-scale-spec shape MEASURED at the end of 06-14
    // Task 2: 330 + 5 * (234 - 86 - 5 - 5 - 5) + 120 + 90 + 13 = 1218.
    expect(projectedE2eSeconds(234)).toBe(1218);
    // The 239-test shape MEASURED at the end of 07-03 Task 2, with the
    // chromium-mobile project added and its five touch specs counted once each:
    // 330 + 5 * (239 - 86 - 5 - 5 - 5) + 120 + 90 + 13 = 1243. This is the
    // last count 27 min covers — the next browser test anywhere in the
    // repository projects 1248 s and a floor of 1622.4 s against 1620.
    expect(projectedE2eSeconds(239)).toBe(1243);
    // The 242-test shape MEASURED at the end of 07-04 Task 3, with 07-03's five
    // touch specs plus this plan's three: 330 + 5 * (242 - 86 - 5 - 5 - 5)
    // + 120 + 90 + 13 = 1258. The floor moves to 1635.4 s, which is past the
    // 1620 s that 27 min gave, so this is the raise 07-03 predicted.
    expect(projectedE2eSeconds(242)).toBe(1258);
    // The 251-test shape MEASURED at the end of 07-05 Task 3, with the sweep's
    // six tests and the touch-target spec's three: 330 + 5 * (251 - 86 - 5 - 5
    // - 5) + 120 + 90 + 13 = 1303. The floor is 1693.9 s, past the 1680 s that
    // 28 min gave, so this is the raise 07-04 predicted.
    expect(projectedE2eSeconds(251)).toBe(1303);
    // The 252-test shape MEASURED at the end of 08-19 Task 1, after the phase
    // deleted the 20-test nav spec and added a 15-test one: 330 + 5 * (252 - 86
    // - 5 - 5 - 5) + 120 + 90 + 13 = 1308. The floor is 1700.4 s, which 29 min
    // (1740 s) still covers, so the three limits were held.
    expect(projectedE2eSeconds(252)).toBe(1308);
    // The 184-test shape of 05-16 under THIS function, which now also holds the
    // login block back: 330 + 5 * (184 - 86 - 5 - 5 - 5) + 120 + 90 + 13 = 968.
    expect(projectedE2eSeconds(184)).toBe(968);
    // One test beyond the baseline and ALL THREE scale specs is worth exactly
    // one increment; the projection never falls below the baseline + the three
    // allowances, even when a caller passes a count below the baseline.
    expect(
      projectedE2eSeconds(
        PRE_PHASE_TEST_COUNT +
          SCALE_SPEC_TEST_COUNT +
          FINANCE_SCALE_TEST_COUNT +
          LOGIN_SCALE_SPEC_TEST_COUNT +
          1,
      ),
    ).toBe(558);
    expect(projectedE2eSeconds(PRE_PHASE_TEST_COUNT)).toBe(553);
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

  test('phase 8 holds all three limits', () => {
    const { wrapperSeconds, jobSeconds } = workflowTimeouts();
    const raiseRule =
      'Phase 8 held G = 1740 s, W = 1860 s and J = 2340 s. A listed count above 258 needs all ' +
      'three raised together (G + 2 min, W + 8 min per the rule in this file), never one.';

    expect(globalTimeoutSeconds(), raiseRule).toBe(1740);
    expect(wrapperSeconds, raiseRule).toBe(1860);
    expect(jobSeconds, raiseRule).toBe(2340);

    const { total } = listedTestTotal();
    expect(
      total,
      `${total} listed tests is above the 258-test ceiling of a 1740 s globalTimeout ` +
        `(E = ${projectedE2eSeconds(total)} s, floor ${projectedE2eSeconds(total) * MIN_GLOBAL_MARGIN} s). ${raiseRule}`,
    ).toBeLessThanOrEqual(258);
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
