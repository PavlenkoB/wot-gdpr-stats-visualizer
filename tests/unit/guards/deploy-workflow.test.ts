import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

// =============================================================================
// 07-02: the deploy workflow cannot ship an unverified commit or widen its own
// privileges (D-09, D-10, T-07-05 to T-07-08).
// =============================================================================
//
// Nothing in this repository can RUN `.github/workflows/deploy.yml` before it is
// merged, and the first real run is a manual verification item in plan 07-06.
// That makes this file the executable proof of the workflow's structure — and a
// guard nobody has ever seen fail is not proof of anything, so every rule below
// is paired with a test that mutates the real file into exactly that fault and
// expects this file's rules to name it.
//
// There is no YAML parser in `package.json` and none is added (T-07-SC). The
// workflow is read as text: comment lines are dropped, `jobs:` is split into
// blocks on its two-space-indented keys, and a `run:` step is read as its inline
// value plus the deeper-indented lines under a block scalar. That is a deliberate
// trade — a YAML library would understand constructs this guard deliberately does
// not accept, and the point of the guard is to pin a small, boring shape rather
// than to parse a language.
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'deploy.yml');

/**
 * The geo fixture switch's name, assembled at runtime.
 *
 * The contract this file defends is that the deploy workflow never selects the
 * test-data table. Writing the name here as a literal would make this file the
 * one place under test that contains it, which is exactly what a grep over the
 * deploy area would find. Joining the halves keeps the assertion exact and the
 * text absent.
 */
const FIXTURE_SWITCH = ['GEO', 'FIXTURE'].join('_');

/** The absolute Pages subpath the build must bake (D-11). */
const PAGES_BASE = '/wot-gdpr-stats-visualizer/';

/** The only runner a public artifact may be built or published on (D-10). */
const RUNNER = 'ubuntu-latest';

/** The workflow text with whole-line comments dropped. */
function activeLines(text: string): string[] {
  return text.split('\n').filter((line) => !/^\s*#/.test(line));
}

interface Workflow {
  /** Lines above `jobs:` — the trigger, top-level permissions, concurrency. */
  readonly preamble: string;
  /** Job name to the lines of its block, in document order. */
  readonly jobs: Map<string, string[]>;
}

/** Split a workflow into its preamble and its job blocks. */
function parseWorkflow(text: string): Workflow {
  const lines = activeLines(text);
  const jobsStart = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  const preamble = lines.slice(0, jobsStart === -1 ? 0 : jobsStart).join('\n');
  const jobs = new Map<string, string[]>();

  if (jobsStart !== -1) {
    let name: string | null = null;
    let block: string[] = [];
    for (const line of lines.slice(jobsStart + 1)) {
      const header = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
      if (header) {
        if (name !== null) jobs.set(name, block);
        name = header[1]!;
        block = [];
        continue;
      }
      if (name !== null) block.push(line);
    }
    if (name !== null) jobs.set(name, block);
  }

  return { preamble, jobs };
}

/** A job's own body, as one string. */
function jobText(jobs: Map<string, string[]>, name: string): string {
  return (jobs.get(name) ?? []).join('\n');
}

/**
 * Every `run:` script in a block, each as one string.
 *
 * Both shapes are collected: a single-line `run: <command>`, and a block scalar
 * whose lines are indented deeper than the key. The interpolation rule reads
 * these, because a `${{ }}` in a script body is exactly the injection surface
 * D-09 closed by having no dispatch inputs.
 */
function runScripts(block: string[]): string[] {
  const scripts: string[] = [];
  for (let i = 0; i < block.length; i += 1) {
    const inline = /^(\s*)run:\s*(.+?)\s*$/.exec(block[i]!);
    if (!inline) continue;
    const baseIndent = inline[1]!.length;
    const parts = [inline[2]!];
    for (let j = i + 1; j < block.length; j += 1) {
      const line = block[j]!;
      if (line.trim() === '') continue;
      if (line.length - line.trimStart().length <= baseIndent) break;
      parts.push(line);
    }
    scripts.push(parts.join('\n'));
  }
  return scripts;
}

/** One step's full text: its list item plus everything indented under it. */
function stepsOf(block: string[]): string[] {
  const steps: string[] = [];
  for (let i = 0; i < block.length; i += 1) {
    if (!/^ {6}- /.test(block[i]!)) continue;
    const parts = [block[i]!];
    for (let j = i + 1; j < block.length; j += 1) {
      const line = block[j]!;
      if (line.trim() === '') continue;
      if (/^ {6}- /.test(line)) break;
      parts.push(line);
    }
    steps.push(parts.join('\n'));
  }
  return steps;
}

/** The rule ids, so a mutation test can assert the RIGHT rule fired. */
type Rule =
  | 'trigger'
  | 'top-level-permissions'
  | 'pages-privileges'
  | 'actions-read'
  | 'runner'
  | 'timeout'
  | 'action-pins'
  | 'checkout-credentials'
  | 'no-interpolation'
  | 'concurrency'
  | 'preflight-check'
  | 'job-graph'
  | 'pages-pair-version'
  | 'fixture-switch'
  | 'vite-base'
  | 'build-order'
  | 'generate-condition'
  | 'cache-restore-keys'
  | 'cache-key'
  | 'entry-output'
  | 'gate-month'
  | 'upload-path'
  | 'month-script'
  | 'smoke-job'
  | 'smoke-needs'
  | 'smoke-privileges'
  | 'smoke-url'
  | 'smoke-entry'
  | 'smoke-wait'
  | 'smoke-spec'
  | 'error-masking'
  | 'live-config';

/** Every way this workflow text violates a rule, as `<rule>: <detail>` lines. */
function problems(text: string): string[] {
  const found: string[] = [];
  const report = (rule: Rule, detail: string): void => {
    found.push(`${rule}: ${detail}`);
  };
  const { preamble, jobs } = parseWorkflow(text);
  const all = text;

  // --- the trigger is exactly one manual event, with no inputs ---------------
  // The `on:` block is read by INDENTATION, not by a shape of lines: `push`
  // brings `branches:` and `workflow_dispatch` brings `inputs:`, both indented
  // deeper than their key, so a fixed-arity match would silently stop at the
  // first nested line and read a trigger that is not there.
  const preambleLines = preamble.split('\n');
  const onStart = preambleLines.findIndex((line) => /^on:\s*$/.test(line));
  const triggerBlock: string[] = [];
  for (let i = onStart + 1; i < preambleLines.length; i += 1) {
    const line = preambleLines[i]!;
    if (line.trim() === '' || line.length - line.trimStart().length < 2) break;
    triggerBlock.push(line);
  }
  const triggerText = triggerBlock.join('\n');
  const triggerKeys = [...triggerText.matchAll(/^ {2}([A-Za-z_][\w-]*):/gm)].map((m) => m[1]!);
  if (!triggerKeys.includes('workflow_dispatch')) {
    report('trigger', 'no workflow_dispatch trigger');
  }
  for (const forbidden of ['push', 'pull_request', 'schedule', 'workflow_run']) {
    if (triggerKeys.includes(forbidden))
      report('trigger', `the ${forbidden} trigger is not allowed`);
  }
  if (/^ {2,}inputs:/m.test(triggerText)) {
    report('trigger', 'the dispatch must declare no inputs');
  }

  // --- the top level grants nothing; each job grants itself -------------------
  if (!/^permissions: \{\}\s*$/m.test(preamble)) {
    report('top-level-permissions', 'the top-level permissions must be the empty mapping');
  }

  // --- Pages and OIDC on exactly one job -------------------------------------
  for (const [name, block] of jobs) {
    const body = block.join('\n');
    for (const privilege of ['pages: write', 'id-token: write']) {
      if (body.includes(privilege) && name !== 'deploy') {
        report('pages-privileges', `${privilege} appears in job ${name}`);
      }
    }
    if (body.includes('actions: read') && name !== 'preflight') {
      report('actions-read', `actions: read appears in job ${name}`);
    }
  }
  const deploy = jobText(jobs, 'deploy');
  for (const privilege of ['pages: write', 'id-token: write']) {
    if (!deploy.includes(privilege)) {
      report('pages-privileges', `the deploy job is missing ${privilege}`);
    }
  }

  // --- every job: this runner, and a deadline --------------------------------
  for (const [name, block] of jobs) {
    if (!block.some((line) => new RegExp(`^\\s*runs-on:\\s*${RUNNER}\\s*$`).test(line))) {
      report('runner', `job ${name} does not run on ${RUNNER}`);
    }
    if (!block.some((line) => /^\s*timeout-minutes:\s*\d+\s*$/.test(line))) {
      report('timeout', `job ${name} declares no timeout-minutes`);
    }
  }

  // --- every action pinned to a full commit, checkout never keeps a token -----
  for (const line of all.split('\n')) {
    const uses = /^\s*uses:\s*(\S+)\s*(#.*)?$/.exec(line);
    if (!uses) continue;
    if (!/@[0-9a-f]{40}$/.test(uses[1]!)) {
      report('action-pins', `${uses[1]} is not a 40-character commit sha`);
    }
    if (!/^#\s*v\d/.test(uses[2] ?? '')) {
      report('action-pins', `${uses[1]} carries no version comment`);
    }
  }
  for (const step of stepsOf([...jobs.values()].flat())) {
    if (!/uses:\s*actions\/checkout@/.test(step)) continue;
    if (!/persist-credentials:\s*false/.test(step)) {
      report('checkout-credentials', 'a checkout step does not set persist-credentials: false');
    }
  }

  // --- no expression is ever interpolated into a shell script ------------------
  for (const script of [...jobs.values()].flatMap(runScripts)) {
    if (script.includes('${{')) {
      report('no-interpolation', 'a run block interpolates an expression');
    }
  }

  // --- one deploy at a time ---------------------------------------------------
  if (!/^concurrency:\n {2}group: pages$/m.test(preamble)) {
    report('concurrency', 'the concurrency group is not `pages`');
  }
  if (!/^ {2}cancel-in-progress: false$/m.test(preamble)) {
    report('concurrency', 'cancel-in-progress must be false so a half-published site survives');
  }

  // --- the preflight asks the API the two questions that matter ----------------
  const preflight = jobText(jobs, 'preflight');
  for (const literal of [
    'refs/heads/main',
    'workflows/ci.yml/runs',
    'event=push',
    'head_sha',
    'status=success',
  ]) {
    if (!preflight.includes(literal)) {
      report('preflight-check', `the preflight job does not mention ${literal}`);
    }
  }

  // --- the job graph: nothing runs before the thing it depends on -------------
  if (!/needs: preflight\b/.test(jobText(jobs, 'build'))) {
    report('job-graph', 'build does not need preflight');
  }
  if (!/needs: build\b/.test(deploy)) {
    report('job-graph', 'deploy does not need build');
  }
  if (!/environment:\n(?: {6}\S.*\n)*? {6}name: github-pages\b/.test(deploy)) {
    report('job-graph', 'the deploy job does not use the github-pages environment');
  }

  // --- the Pages pair is the matched v4 pair -----------------------------------
  const usesLines = all
    .split('\n')
    .filter((line) => /uses:\s*actions\/(upload|deploy)-pages/.test(line));
  for (const action of ['upload-pages-artifact', 'deploy-pages']) {
    const line = usesLines.find((candidate) => candidate.includes(action));
    if (!line) {
      report('pages-pair-version', `${action} is not used`);
    } else if (!/#\s*v4\./.test(line)) {
      report('pages-pair-version', `${action} is not pinned to a v4 tag`);
    }
  }

  // --- never a test-data table in a public build -------------------------------
  if (all.includes(FIXTURE_SWITCH)) {
    report('fixture-switch', 'the deploy workflow names the geo test-data switch');
  }

  // --- the base the public site is served under --------------------------------
  if (
    !new RegExp(`^\\s*VITE_BASE:\\s*${PAGES_BASE.replace(/\//g, '\\/')}\\s*$`, 'm').test(
      jobText(jobs, 'build'),
    )
  ) {
    report('vite-base', `the build job does not set VITE_BASE to ${PAGES_BASE}`);
  }

  // ---------------------------------------------------------------------------
  // The build job's ORDER, and the four facts that order depends on (D-13,
  // T-07-09, T-07-10, T-07-11).
  //
  // The order is the whole point of this job: month, then cache, then generate,
  // then build, then read the entry name, then install a browser, then gate,
  // then upload. Six of those eight steps exist to make the seventh impossible
  // to get wrong, and nothing in the workflow itself would notice if two of
  // them swapped.
  // ---------------------------------------------------------------------------
  const buildBlock = jobs.get('build') ?? [];
  const buildSteps = stepsOf(buildBlock);

  /** Index of the first build step matching `needle`, or -1. */
  const buildStepIndex = (needle: string): number =>
    buildSteps.findIndex((step) => step.includes(needle));

  const monthAt = buildStepIndex('scripts/geo/resolve-dbip-month.ts');
  const cacheAt = buildStepIndex('dbip-city-lite-');
  const generateAt = buildStepIndex('pnpm run geo:city -- --download');
  const buildAt = buildStepIndex('run: pnpm run build');
  const entryAt = buildStepIndex('dist/index.html');
  const chromiumAt = buildStepIndex('playwright install --with-deps chromium');
  const gateAt = buildStepIndex('playwright.gate.config.ts');
  const uploadAt = buildStepIndex('actions/upload-pages-artifact@');

  const ordered = buildSteps.length > 0;
  if (!ordered) {
    report('build-order', 'the build job has no readable steps');
  } else {
    for (const [label, at] of [
      ['month', monthAt],
      ['cache', cacheAt],
      ['generate', generateAt],
      ['build', buildAt],
      ['entry', entryAt],
      ['chromium install', chromiumAt],
      ['gate', gateAt],
      ['upload', uploadAt],
    ] as const) {
      if (at === -1) report('build-order', `the build job has no ${label} step`);
    }
    const positions = [
      monthAt,
      cacheAt,
      generateAt,
      buildAt,
      entryAt,
      chromiumAt,
      gateAt,
      uploadAt,
    ];
    if (
      positions.every((at) => at !== -1) &&
      positions.some((at, i) => i > 0 && at < positions[i - 1]!)
    ) {
      report('build-order', 'the build job steps are not in month/cache/generate/build order');
    }
  }

  // The generate step must be conditional on the cache MISSING. Unconditional,
  // a cache hit would re-download ~85 MB every run; absent, a poisoned cache
  // would be replaced silently and the key would prove nothing.
  if (
    generateAt !== -1 &&
    !/if:\s*steps\.city-cache\.outputs\.cache-hit\s*!=\s*'true'/.test(buildSteps[generateAt]!)
  ) {
    report('generate-condition', 'the generate step is not guarded by the cache-miss condition');
  }

  // A fallback-key list would let a stale month satisfy this month's key.
  if (cacheAt !== -1 && /restore-keys:/.test(buildSteps[cacheAt]!)) {
    report('cache-restore-keys', 'the city cache declares a restore-keys fallback');
  }

  // The cache key must carry the month output, not a literal.
  if (
    cacheAt !== -1 &&
    !/key:\s*dbip-city-lite-\$\{\{\s*steps\.month\.outputs\.month\s*\}\}/.test(buildSteps[cacheAt]!)
  ) {
    report('cache-key', 'the city cache key is not the resolved month output');
  }

  // The entry script has to be exposed to the smoke job, which cannot read the
  // filesystem of another job.
  if (
    !/entry_script:\s*\$\{\{\s*steps\.entry\.outputs\.script\s*\}\}/.test(jobText(jobs, 'build'))
  ) {
    report('entry-output', 'the build job does not expose entry_script');
  }

  // The gate is told which month to expect, so a cache hit is checked too.
  if (
    gateAt !== -1 &&
    !/EXPECT_CITY_MONTH:\s*\$\{\{\s*steps\.month\.outputs\.month\s*\}\}/.test(buildSteps[gateAt]!)
  ) {
    report('gate-month', 'the pre-deploy gate is not told the expected city month');
  }

  if (uploadAt !== -1 && !/path:\s*dist\s*$/.test(buildSteps[uploadAt]!)) {
    report('upload-path', 'the Pages artifact is not exactly the dist directory');
  }

  // The month script must go through the DOWNLOAD's resolver, or the cache key
  // and the download can answer different months.
  const monthScript = readRepoFile('scripts/geo/resolve-dbip-month.ts');
  if (!monthScript.includes('resolveDbipUrl')) {
    report('month-script', 'the month script does not call the shared resolver');
  }
  if (!monthScript.includes('headStatus')) {
    report('month-script', 'the month script does not use the real status probe');
  }
  if (/console\.(log|info|error|warn)/.test(monthScript)) {
    report('month-script', 'the month script writes a second line of noise to stdout');
  }

  // ---------------------------------------------------------------------------
  // The post-deploy smoke (D-14, T-07-12).
  //
  // A separate job, not a step in `deploy`: a step there could only be
  // reported, while a job here can fail the run, and the run's red state IS the
  // report. It needs BOTH jobs — the build's entry-script name and the deploy's
  // URL — and it must hold no Pages privilege of its own.
  // ---------------------------------------------------------------------------
  const smokeBlock = jobs.get('smoke') ?? [];
  const smokeText = smokeBlock.join('\n');

  if (smokeBlock.length === 0) {
    report('smoke-job', 'there is no smoke job');
  } else {
    if (!/needs:\s*\[build,\s*deploy\]/.test(smokeText)) {
      report('smoke-needs', 'the smoke job does not need both build and deploy');
    }
    if (/(pages:\s*write|id-token:\s*write)/.test(smokeText)) {
      report('smoke-privileges', 'the smoke job holds a Pages privilege');
    }
    if (!/contents:\s*read/.test(smokeText)) {
      report('smoke-privileges', 'the smoke job does not hold contents: read');
    }
    if (!/actions\/checkout@[0-9a-f]{40}\s*#\s*v/.test(smokeText)) {
      report('smoke-privileges', 'the smoke job does not check the repository out, pinned');
    } else if (!/persist-credentials:\s*false/.test(smokeText)) {
      report('checkout-credentials', 'the smoke job checkout keeps its credentials');
    }

    // The URL and the entry name may only reach a step as an expression on an
    // `env:` line.
    //
    // The rule is keyed on the OUTPUT EXPRESSION, not on the variable's name:
    // what must not happen is `needs.deploy.outputs.page_url` being pasted into
    // a command, and a mutation that replaces `$LIVE_URL` with that expression
    // in a run line is exactly the fault. Keying on the name instead would have
    // missed it, because the faulty line no longer mentions the name at all.
    //
    // A `$LIVE_URL` inside a script is the POINT — the value came from the
    // environment rather than being pasted in — so nothing here objects to the
    // shell reading its own variables. (`no-interpolation` separately bans any
    // `${{` inside a run block outright; this catches the same leak on a value
    // that sits outside a run block.)
    for (const line of smokeText.split('\n')) {
      if (!line.includes('${{')) continue;
      if (
        line.includes('page_url') &&
        !/^\s*LIVE_URL:\s*\$\{\{\s*needs\.deploy\.outputs\.page_url\s*\}\}\s*$/.test(line)
      ) {
        report('smoke-url', `the deployed URL is expressed outside its env line: ${line.trim()}`);
      }
      if (
        line.includes('entry_script') &&
        !/^\s*EXPECT_ENTRY:\s*\$\{\{\s*needs\.build\.outputs\.entry_script\s*\}\}\s*$/.test(line)
      ) {
        report('smoke-entry', `the entry script is expressed outside its env line: ${line.trim()}`);
      }
    }

    // The wait step is what makes a green honest. Without it, the smoke can
    // pass against a stale copy of an older deploy; without the grep, the wait
    // proves nothing at all; without the bound, a broken site hangs the job
    // until its own timeout instead of failing with a name.
    const waitStep = stepsOf(smokeBlock).find((step) => step.includes('EXPECT_ENTRY')) ?? '';
    const waitScript = waitStep.includes('run:') ? waitStep.slice(waitStep.indexOf('run:')) : '';
    if (!/grep\s+-qF\s+"?\$\{?EXPECT_ENTRY/.test(waitScript)) {
      report('smoke-wait', 'the wait step does not grep the live body for EXPECT_ENTRY');
    }
    // A SMALL bound, not merely a numeric one. `-le 999999` is formally finite
    // and practically a hang: it would outlast the job's own 20-minute timeout
    // while reporting nothing, which is the exact failure the bound exists to
    // avoid. The ceiling below is generous for a 10-second sleep and still far
    // under the job timeout.
    const bound = /-le\s+(\d+)/.exec(waitScript);
    if (!bound) {
      report('smoke-wait', 'the wait loop has no finite upper bound');
    } else if (Number(bound[1]) > 100) {
      report('smoke-wait', `the wait loop allows ${bound[1]} attempts, which is a hang`);
    }
    if (!/exit 1/.test(waitScript)) {
      report('smoke-wait', 'the wait step cannot fail after its last attempt');
    }
    if (!/playwright\.live\.config\.ts/.test(smokeText)) {
      report('smoke-spec', 'the smoke job does not run the live config');
    }
  }

  if (!/page_url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/.test(deploy)) {
    report('smoke-url', 'the deploy job does not publish a page_url output');
  }

  // --- nothing in this workflow may hide a failure -----------------------------
  // The smoke exists to turn the run red; a masking switch anywhere would undo
  // that silently, which is why it is a rule rather than a review note.
  for (const line of all.split('\n')) {
    if (/^\s*continue-on-error:/.test(line)) {
      report('error-masking', `a step masks its own failure: ${line.trim()}`);
    }
  }
  for (const script of [...jobs.values()].flatMap(runScripts)) {
    if (/\|\|\s*(true|:|exit 0)/.test(script)) {
      report('error-masking', 'a run block discards an exit status with a shell fallback');
    }
  }

  // --- the live config: a URL in, a spec out, no server, no test data ----------
  const liveConfig = readRepoFile('tests/deploy/playwright.live.config.ts');
  if (!/process\.env\.LIVE_URL/.test(liveConfig)) {
    report('live-config', 'the live config does not read LIVE_URL');
  }
  if (/^\s*webServer:/m.test(liveConfig)) {
    report('live-config', 'the live config launches a server');
  }
  if (!/deployed-build\.spec\.ts/.test(liveConfig)) {
    report('live-config', 'the live config does not name the shared spec');
  }
  if (liveConfig.includes(FIXTURE_SWITCH)) {
    report('live-config', 'the live config names the geo test-data switch');
  }
  if (!/retries:\s*1/.test(liveConfig)) {
    report('live-config', 'the live config does not allow the one reported retry');
  }

  return found;
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

const REAL = readFileSync(WORKFLOW, 'utf8');

/** Apply a textual mutation to the real workflow and return its problems. */
function mutatedBy(replacements: readonly (readonly [string, string])[]): string[] {
  let text = REAL;
  for (const [from, to] of replacements) {
    expect(text, `the mutation's anchor must exist: ${from}`).toContain(from);
    text = text.replace(from, to);
  }
  return problems(text);
}

/**
 * The shape every mutation test asserts.
 *
 * Not "equals one string": a single fault can legitimately trip one rule twice
 * (moving `pages: write` into `build` both puts a Pages privilege on the wrong
 * job AND strips it from the right one), and pinning the count would make this
 * guard fail for the right reason. What matters is that the list is NOT empty
 * and that every entry names the rule under test — so a mutation cannot be
 * "rejected" by an unrelated rule firing first.
 */
function rejects(rule: Rule, replacements: readonly (readonly [string, string])[]): void {
  const found = mutatedBy(replacements);
  expect(found, 'the mutation introduced no problem at all, so the rule is dead').not.toEqual([]);
  expect(found.filter((problem) => !problem.startsWith(`${rule}: `))).toEqual([]);
}

/**
 * Move a build step after another one, by name, and return the mutated problems.
 *
 * Written as a structural splice rather than a long string replacement because
 * the thing under test is a REORDERING, and a replacement that has to reproduce
 * a dozen lines of surrounding YAML verbatim is a test that breaks when a
 * comment is reworded — and then gets "fixed" by weakening itself.
 *
 * The splice is done on the RAW lines rather than on the parsed block, because
 * the parsed block has its comments removed and so is not a substring of the
 * file it came from. A comment above a step travels with it, which is what a
 * person moving the step in a real editor would get.
 */
function problemsWithStepMoved(afterName: string, movedName: string): string[] {
  const lines = REAL.split('\n');

  // The `build:` job's own line range, comments included.
  const buildAt = lines.findIndex((line) => /^ {2}build:\s*$/.test(line));
  if (buildAt === -1) return problems(REAL);
  let buildEnd = lines.length;
  for (let i = buildAt + 1; i < lines.length; i += 1) {
    if (/^ {2}[A-Za-z][\w-]*:\s*$/.test(lines[i]!)) {
      buildEnd = i;
      break;
    }
  }

  const job = lines.slice(buildAt, buildEnd);
  const starts: number[] = [];
  for (let i = 0; i < job.length; i += 1) {
    if (/^ {6}- /.test(job[i]!)) starts.push(i);
  }

  const endOf = (stepIndex: number): number => starts[stepIndex + 1] ?? job.length;
  const stepIndexOf = (needle: string): number =>
    starts.findIndex((at, index) => job.slice(at, endOf(index)).join('\n').includes(needle));

  const target = stepIndexOf(afterName);
  const moving = stepIndexOf(movedName);
  if (target === -1 || moving === -1) return problems(REAL);

  // The moved step carries any comment lines directly above it.
  let stepStart = starts[moving]!;
  while (stepStart > 0 && /^\s*#/.test(job[stepStart - 1]!)) stepStart -= 1;
  const stepEnd = endOf(moving);
  const movedLines = job.slice(stepStart, stepEnd);

  const rest = job.filter((_, i) => i < stepStart || i >= stepEnd);
  // AFTER the target step, not before it: "move X after Y" on a step that
  // already precedes Y is a no-op if the insert lands at Y's start.
  const targetStart = rest.findIndex((line) => line === job[starts[target]!]);
  const insertAt = rest.findIndex((line, i) => i > targetStart && line === job[endOf(target) - 1]);
  const shifted = [...rest.slice(0, insertAt + 1), ...movedLines, ...rest.slice(insertAt + 1)];

  return problems([...lines.slice(0, buildAt), ...shifted, ...lines.slice(buildEnd)].join('\n'));
}

/**
 * Assert that `rule` is among the problems a mutation produces.
 *
 * The counterpart to {@link rejects}, for a fault that legitimately trips
 * several rules at once. Demanding that the list contain ONLY this rule would
 * make the test fail for the right reason, and would tempt a future edit into
 * weakening one of the rules so the count came out right.
 */
function namesRule(rule: Rule, replacements: readonly (readonly [string, string])[]): void {
  const found = mutatedBy(replacements);
  expect(found, 'the mutation introduced no problem at all, so the rule is dead').not.toEqual([]);
  expect(
    found.filter((problem) => problem.startsWith(`${rule}: `)),
    `the mutation was caught, but not by ${rule}`,
  ).not.toEqual([]);
}

/** Assert that moving one build step after another is rejected by `rule`. */
function rejectsMove(afterName: string, movedName: string, rule: Rule): void {
  const found = problemsWithStepMoved(afterName, movedName);
  expect(found, 'the move introduced no problem at all, so the order rule is dead').not.toEqual([]);
  expect(found.filter((problem) => !problem.startsWith(`${rule}: `))).toEqual([]);
}

describe('07-02: deploy.yml cannot ship an unverified commit or widen its own privileges', () => {
  test('the real workflow violates no rule', () => {
    expect(problems(REAL)).toEqual([]);
  });

  test('the parser sees the jobs it is ruling about, so the rules are not vacuous', () => {
    // Every other test here would pass against a file the parser read as empty
    // — or read as one undifferentiated blob with no job boundaries at all.
    const { jobs } = parseWorkflow(REAL);
    expect([...jobs.keys()]).toEqual(['preflight', 'build', 'deploy', 'smoke']);
    expect(runScripts(jobs.get('preflight') ?? []).join('\n')).toContain('refs/heads/main');
  });

  describe('the trigger may only be a manual dispatch', () => {
    test('a push trigger is rejected', () => {
      rejects('trigger', [
        ['  workflow_dispatch:', '  push:\n    branches: [main]\n  workflow_dispatch:'],
      ]);
    });

    test('a pull_request trigger is rejected', () => {
      rejects('trigger', [['  workflow_dispatch:', '  pull_request:\n  workflow_dispatch:']]);
    });

    test('a declared input is rejected', () => {
      rejects('trigger', [
        [
          '  workflow_dispatch:',
          '  workflow_dispatch:\n    inputs:\n      sha:\n        type: string',
        ],
      ]);
    });
  });

  test('a non-empty top-level permissions block is rejected', () => {
    rejects('top-level-permissions', [['permissions: {}', 'permissions:\n  contents: read']]);
  });

  describe('the Pages privileges are rejected', () => {
    test('when they appear in the build job', () => {
      rejects('pages-privileges', [
        ['    permissions:\n      pages: write\n      id-token: write\n', '    permissions:\n'],
        [
          '    permissions:\n      contents: read\n',
          '    permissions:\n      contents: read\n      pages: write\n',
        ],
      ]);
    });

    test('when the deploy job loses one of them', () => {
      rejects('pages-privileges', [['      id-token: write\n', '']]);
    });
  });

  test('actions: read outside the preflight job is rejected', () => {
    rejects('actions-read', [
      ['    permissions:\n      actions: read\n', '    permissions:\n'],
      [
        '    permissions:\n      contents: read\n',
        '    permissions:\n      contents: read\n      actions: read\n',
      ],
    ]);
  });

  test('a self-hosted runner anywhere is rejected', () => {
    rejects('runner', [
      [
        '    runs-on: ubuntu-latest\n    timeout-minutes: 30',
        '    runs-on: self-hosted\n    timeout-minutes: 30',
      ],
    ]);
  });

  test('a job without a deadline is rejected', () => {
    rejects('timeout', [['    timeout-minutes: 30\n', '']]);
  });

  describe('an unpinned action is rejected', () => {
    test('when the reference is a tag rather than a commit', () => {
      rejects('action-pins', [
        ['actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1', 'actions/checkout@v7.0.1'],
      ]);
    });

    test('when the sha is truncated', () => {
      rejects('action-pins', [
        [
          'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
          'actions/checkout@3d3c42e5aac5ba805825da76410c # v7.0.1',
        ],
      ]);
    });

    test('when the version comment is missing', () => {
      rejects('action-pins', [
        [
          'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
          'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
        ],
      ]);
    });
  });

  test('a checkout that keeps its credentials is rejected', () => {
    rejects('checkout-credentials', [['          persist-credentials: false\n', '']]);
  });

  test('an expression interpolated into a run block is rejected', () => {
    rejects('no-interpolation', [
      [
        '        run: pnpm install --frozen-lockfile',
        '        run: pnpm install --frozen-lockfile ${{ github.sha }}',
      ],
    ]);
  });

  test('an expression interpolated into a MULTI-LINE run block is rejected', () => {
    // The inline case above is the easy one; a block scalar is where an
    // expression would actually land unnoticed, because the step's own `run: |`
    // line carries none.
    rejects('no-interpolation', [
      [
        '          set -euo pipefail',
        '          echo ${{ github.sha }}\n          set -euo pipefail',
      ],
    ]);
  });

  describe('the concurrency block is rejected', () => {
    test('when a second dispatch would cancel the first', () => {
      rejects('concurrency', [['  cancel-in-progress: false', '  cancel-in-progress: true']]);
    });

    test('when the group is not the pages group', () => {
      rejects('concurrency', [['  group: pages', '  group: deploy']]);
    });
  });

  test('a preflight that stops asking about push runs on main is rejected', () => {
    rejects('preflight-check', [['&event=push&', '&']]);
  });

  describe('the job graph is rejected', () => {
    test('when the build no longer waits for the preflight', () => {
      rejects('job-graph', [['    needs: preflight\n', '']]);
    });

    test('when the deploy job no longer waits for the build', () => {
      rejects('job-graph', [['    needs: build\n', '']]);
    });

    test('when the deploy job loses the Pages environment', () => {
      rejects('job-graph', [['      name: github-pages\n', '      name: production\n']]);
    });
  });

  test('a Pages action off the v4 line is rejected', () => {
    rejects('pages-pair-version', [
      [
        'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4.0.5',
        'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v3.0.1',
      ],
    ]);
  });

  test('naming the geo test-data switch anywhere is rejected', () => {
    rejects('fixture-switch', [
      ['      VITE_BASE:', `      ${FIXTURE_SWITCH}: '1'\n      VITE_BASE:`],
    ]);
  });

  test('a base other than the Pages subpath is rejected', () => {
    rejects('vite-base', [['      VITE_BASE: /wot-gdpr-stats-visualizer/', '      VITE_BASE: /']]);
  });
});

// -----------------------------------------------------------------------------
// The build job's order and the four facts that order rests on (D-13, T-07-09,
// T-07-10, T-07-11).
// -----------------------------------------------------------------------------
describe('07-02: the build job generates the city dataset before it builds', () => {
  test('the build job has its eight steps, in order', () => {
    // The order rule is the one that fails silently in a workflow: nothing in
    // YAML stops a step moving, and the resulting artifact 404s for a user who
    // pressed the opt-in. So the order is asserted as a sequence of positions.
    const { jobs } = parseWorkflow(REAL);
    const steps = stepsOf(jobs.get('build') ?? []);
    const at = (needle: string): number => steps.findIndex((step) => step.includes(needle));

    expect(at('scripts/geo/resolve-dbip-month.ts')).toBeLessThan(at('dbip-city-lite-'));
    expect(at('dbip-city-lite-')).toBeLessThan(at('pnpm run geo:city -- --download'));
    expect(at('pnpm run geo:city -- --download')).toBeLessThan(at('run: pnpm run build'));
    expect(at('run: pnpm run build')).toBeLessThan(at('dist/index.html'));
    expect(at('dist/index.html')).toBeLessThan(at('playwright install --with-deps chromium'));
    expect(at('playwright install --with-deps chromium')).toBeLessThan(
      at('playwright.gate.config.ts'),
    );
    expect(at('playwright.gate.config.ts')).toBeLessThan(at('actions/upload-pages-artifact@'));
  });

  test('moving the generation after the build is rejected', () => {
    // The single most valuable mutation in this file: this is the reordering
    // that would ship a bundle whose opt-in 404s. The manifest is baked while
    // Vite evaluates its config, so a build that ran first cannot name the file.
    rejectsMove('run: pnpm run build', 'pnpm run geo:city -- --download', 'build-order');
  });

  test('a fallback-key entry on the city cache is rejected', () => {
    // A prefix fallback is how a stale month ends up satisfying this month's
    // key, which is the exact substitution the key exists to prevent.
    rejects('cache-restore-keys', [
      [
        '          key: dbip-city-lite-${{ steps.month.outputs.month }}\n',
        '          key: dbip-city-lite-${{ steps.month.outputs.month }}\n          restore-keys: |\n            dbip-city-lite-\n',
      ],
    ]);
  });

  test('a cache key that is not the resolved month is rejected', () => {
    rejects('cache-key', [
      [
        '          key: dbip-city-lite-${{ steps.month.outputs.month }}',
        '          key: dbip-city-lite-2026-10',
      ],
    ]);
  });

  test('removing the cache-miss condition from the generation is rejected', () => {
    rejects('generate-condition', [
      ["        if: steps.city-cache.outputs.cache-hit != 'true'\n", ''],
    ]);
  });

  test('moving the gate after the artifact upload is rejected', () => {
    // After the upload, the gate would report on an artifact that is already on
    // its way to Pages — a red run over something already published.
    rejectsMove('actions/upload-pages-artifact@', 'playwright.gate.config.ts', 'build-order');
  });

  test('moving the entry read before the build is rejected', () => {
    // The entry script is a hashed name that only exists in a BUILT index.html,
    // so reading it before the build would find nothing — or, with the guard
    // removed, the smoke would wait for a filename no build ever emitted.
    rejectsMove('run: pnpm run build', 'dist/index.html', 'build-order');
  });

  test('moving the cache after the month is rejected', () => {
    // The key reads the month step's output, so a restore before the month was
    // resolved would key on an empty string.
    rejectsMove('scripts/geo/resolve-dbip-month.ts', 'dbip-city-lite-', 'build-order');
  });

  test('removing the entry_script output is rejected', () => {
    // The smoke job runs on a different machine and cannot read this job's
    // filesystem, so this output is the only channel between them.
    rejects('entry-output', [['      entry_script: ${{ steps.entry.outputs.script }}\n', '']]);
  });

  test('a gate that is not told the expected month is rejected', () => {
    rejects('gate-month', [
      ['          EXPECT_CITY_MONTH: ${{ steps.month.outputs.month }}\n', ''],
    ]);
  });

  test('uploading something other than dist alone is rejected', () => {
    rejects('upload-path', [
      ['          path: dist\n', '          path: |\n            dist\n            public\n'],
    ]);
  });

  describe('the month script', () => {
    const script = readRepoFile('scripts/geo/resolve-dbip-month.ts');

    test('prints one month line and nothing else', () => {
      // Two lines would corrupt the step-output file the cache key reads, and
      // progress text on stdout is exactly the second line.
      expect(script).toContain('process.stdout.write(`${resolved.month}\\n`)');
      expect(script).not.toMatch(/console\.(log|info|error|warn)/);
    });

    test('goes through the same resolver the download uses', () => {
      // Re-deriving the month here would let the cache key and the download
      // answer different months, which is the failure the shared resolver is
      // here to make impossible.
      expect(script).toContain("from './lib/download.ts'");
      expect(script).toContain('resolveDbipUrl');
      expect(script).toContain('headStatus');
    });

    test('does not swallow a resolution failure', () => {
      // An empty stdout would key the cache on an empty month, so the rejection
      // has to reach the process exit code rather than being caught.
      expect(script).not.toMatch(/catch\s*[({]/);
      expect(script).not.toContain('process.exit(0)');
    });
  });
});

// -----------------------------------------------------------------------------
// The post-deploy smoke (D-14, T-07-12).
// -----------------------------------------------------------------------------
describe('07-02: the post-deploy smoke is a job that can turn the run red', () => {
  test('removing the deploy job from the smoke needs is rejected', () => {
    rejects('smoke-needs', [['    needs: [build, deploy]', '    needs: [build]']]);
  });

  test('removing the build job from the smoke needs is rejected', () => {
    // Without `build` the smoke has no entry-script name and cannot tell this
    // deployment from an older one — which is the false green T-07-12 names.
    rejects('smoke-needs', [['    needs: [build, deploy]', '    needs: [deploy]']]);
  });

  test('giving the smoke job a Pages privilege is rejected', () => {
    // The general `pages-privileges` rule catches this too — a privilege on
    // any job but `deploy` — so both rules are required to name it, and this
    // is the one that says the SMOKE must stay read-only even as the deploy
    // job keeps its own.
    const found = mutatedBy([
      [
        '    permissions:\n      contents: read\n    steps:\n      - name: Checkout\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          persist-credentials: false\n\n      - name: Install pnpm',
        '    permissions:\n      contents: read\n      pages: write\n    steps:\n      - name: Checkout\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          persist-credentials: false\n\n      - name: Install pnpm',
      ],
    ]);
    expect(found).not.toEqual([]);
    expect(found).toContainEqual(expect.stringContaining('smoke-privileges'));
    expect(found).toContainEqual(expect.stringContaining('pages-privileges'));
  });

  test('deleting the grep that proves the live site is THIS build is rejected', () => {
    // The whole reason the wait step exists. Without the grep it is a sleep
    // loop, and a stale copy of an older deploy passes the smoke.
    rejects('smoke-wait', [
      [
        '            if curl --fail --silent --show-error --location "$LIVE_URL" | grep -qF "$EXPECT_ENTRY"; then',
        '            if curl --fail --silent --show-error --location "$LIVE_URL" > /dev/null; then',
      ],
    ]);
  });

  test('a wait loop with no bound is rejected', () => {
    rejects('smoke-wait', [
      [
        '          while [ "$attempt" -le 30 ]; do',
        '          while [ "$attempt" -le 999999 ]; do',
      ],
    ]);
  });

  test('a wait step that cannot fail after its last try is rejected', () => {
    // A loop that simply ends is a script whose last command decides the step,
    // and the last command of a sleep loop is a success.
    rejects('smoke-wait', [
      [
        '          echo "$EXPECT_ENTRY never appeared in the live page at $LIVE_URL" >&2\n          exit 1',
        '          echo "$EXPECT_ENTRY never appeared in the live page at $LIVE_URL" >&2',
      ],
    ]);
  });

  test('an error-masking switch anywhere in the workflow is rejected', () => {
    // The smoke exists to turn the run red; a masking switch undoes that
    // silently, which is why it is a rule and not a review note.
    rejects('error-masking', [
      [
        '      - name: Post-deploy smoke against the live URL\n',
        '      - name: Post-deploy smoke against the live URL\n        continue-on-error: true\n',
      ],
    ]);
  });

  test('a shell fallback that discards an exit status is rejected', () => {
    rejects('error-masking', [
      [
        '          month=$(node scripts/geo/resolve-dbip-month.ts)',
        '          month=$(node scripts/geo/resolve-dbip-month.ts) || true',
      ],
    ]);
  });

  test('expressing the URL on a run line instead of an env line is rejected', () => {
    // Two rules are correct to fire here and this test does not narrow to one:
    // `no-interpolation` (a run block may carry no expression at all) and
    // `smoke-url` (the URL's expression belongs on its env line). Both are
    // consequences of the same fault, and pinning either alone would let the
    // other go untested.
    namesRule('smoke-url', [
      [
        '          LIVE_URL: ${{ needs.deploy.outputs.page_url }}\n          EXPECT_ENTRY:',
        '          EXPECT_ENTRY:',
      ],
      [
        '            if curl --fail --silent --show-error --location "$LIVE_URL" | grep -qF "$EXPECT_ENTRY"; then',
        '            if curl --fail --silent --show-error --location "${{ needs.deploy.outputs.page_url }}" | grep -qF "$EXPECT_ENTRY"; then',
      ],
    ]);
  });

  test('expressing the entry name on a run line instead of an env line is rejected', () => {
    // As above: `no-interpolation`, `smoke-entry` and — because the grep the
    // mutation broke is the same grep the wait rule reads — `smoke-wait`.
    namesRule('smoke-entry', [
      ['          EXPECT_ENTRY: ${{ needs.build.outputs.entry_script }}\n', ''],
      [
        '            if curl --fail --silent --show-error --location "$LIVE_URL" | grep -qF "$EXPECT_ENTRY"; then',
        '            if curl --fail --silent --show-error --location "$LIVE_URL" | grep -qF "${{ needs.build.outputs.entry_script }}"; then',
      ],
    ]);
  });

  describe('the live config', () => {
    const config = readRepoFile('tests/deploy/playwright.live.config.ts');

    test('takes its base from LIVE_URL and nothing else', () => {
      // One input, and it is the deployed URL. A second source of the base
      // would be a second thing that can disagree with the gate.
      expect(config).toContain('process.env.LIVE_URL');
      expect(config).not.toContain('VITE_BASE');
    });

    test('launches no server', () => {
      // The site is already live; a local copy here would be a second thing
      // under test, and the gate already covers the local one.
      expect(config).not.toMatch(/^\s*webServer:/m);
    });

    test('runs the shared spec and not the artifact one', () => {
      // The artifact spec reads a build's filesystem, and a live URL has none.
      expect(config).toContain('deployed-build.spec.ts');
      expect(config).not.toContain('dist-artifact');
    });

    test('refuses http for anything but the loopback names', () => {
      // The local case exists so this config can be proven before it is
      // trusted; anything else over http is not the site being deployed.
      expect(config).toContain("parsed.protocol === 'http:'");
      expect(config).toContain('LOOPBACK_HOSTS.has(parsed.hostname)');
      expect(config).toContain("parsed.protocol !== 'https:'");
    });

    test('fails fast when LIVE_URL is missing', () => {
      // There is no sensible default, and a default that silently pointed at
      // localhost would turn the post-deploy proof into a local one.
      expect(config).toMatch(/if \(!LIVE_URL\)/);
    });

    test('never selects the geo test-data table', () => {
      expect(config).not.toContain(FIXTURE_SWITCH);
    });

    test('allows one retry, so a slow Pages publish is flaky rather than red', () => {
      expect(config).toContain('retries: 1');
    });
  });
});
