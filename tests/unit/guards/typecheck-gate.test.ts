import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// =============================================================================
// The typecheck gate (06-16, WR-05)
// =============================================================================
//
// `tsc -b` never reads a `.svelte` file, and CI ran only `pnpm run check`, so a
// type import that did not exist and two Phase 5 errors sat behind a green
// check (06-REVIEW WR-05). The fix is two halves that are useless apart: the
// `check` script runs `svelte-check` after `tsc -b`, and CI's single typecheck
// step keeps running that script under a name that says so.
//
// This guard fails when either half regresses. The scan is a pure function of
// the two file texts so that it can be shown to fail on bad input; a guard that
// has only ever seen the real, passing files has not been shown to catch
// anything.
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

/** The comment lines out: a commented-out step must not satisfy the guard. */
function activeLines(workflow: string): string[] {
  return workflow.split('\n').filter((line) => !/^\s*#/.test(line));
}

/** Split the active workflow at each `- name:` line into [name, body] steps. */
function stepsOf(workflow: string): { name: string; body: string }[] {
  const steps: { name: string; lines: string[] }[] = [];
  for (const line of activeLines(workflow)) {
    const header = /^\s*-\s+name:\s*(.*?)\s*$/.exec(line);
    if (header !== null) {
      steps.push({ name: header[1] ?? '', lines: [] });
    } else if (steps.length > 0) {
      steps[steps.length - 1]?.lines.push(line);
    }
  }
  return steps.map((s) => ({ name: s.name, body: s.lines.join('\n') }));
}

/** The text from a step's `run:` onward, or '' for a step with no `run:`. */
function runText(body: string): string {
  const at = body.search(/^\s*run:/m);
  return at === -1 ? '' : body.slice(at);
}

/** Every problem the gate has; an empty list means the gate is intact. */
function typecheckGateProblems(packageJsonText: string, workflowText: string): string[] {
  const problems: string[] = [];

  const pkg = JSON.parse(packageJsonText) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const commands = (pkg.scripts?.check ?? '').split('&&').map((c) => c.trim());
  if (commands[0] !== 'tsc -b') {
    problems.push('the check script must start with `tsc -b`');
  }
  const svelteCheck = commands.slice(1).find((c) => c.startsWith('svelte-check'));
  if (svelteCheck === undefined) {
    problems.push('the check script must run svelte-check after tsc -b');
  } else if (!svelteCheck.includes('--tsconfig ./tsconfig.app.json')) {
    problems.push('svelte-check must be pointed at --tsconfig ./tsconfig.app.json');
  }
  if (pkg.devDependencies?.['svelte-check'] === undefined) {
    problems.push('svelte-check must be a devDependency');
  }

  const steps = stepsOf(workflowText);
  const typecheck = steps.filter((s) => s.name.includes('Typecheck'));
  if (typecheck.length !== 1) {
    problems.push(`the workflow needs exactly one Typecheck step, found ${typecheck.length}`);
  } else {
    const step = typecheck[0]!;
    if (!/^\s*run:\s*pnpm run check\s*$/m.test(runText(step.body))) {
      problems.push('the Typecheck step must run exactly `pnpm run check`');
    }
    if (!step.name.includes('svelte-check')) {
      problems.push('the Typecheck step name must mention svelte-check');
    }
  }
  for (const step of steps) {
    if (typecheck.includes(step)) continue;
    if (/\b(tsc|svelte-check)\b/.test(runText(step.body))) {
      problems.push(`step "${step.name}" runs a type checker directly instead of via the gate`);
    }
  }

  return problems;
}

const GOOD_PACKAGE = JSON.stringify({
  scripts: { check: 'tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning' },
  devDependencies: { 'svelte-check': '^4.7.6' },
});

const GOOD_WORKFLOW = [
  'jobs:',
  '  verify:',
  '    steps:',
  '      - name: Lint',
  '        run: pnpm run lint',
  '',
  '      - name: Typecheck (tsc -b and svelte-check)',
  '        run: pnpm run check',
  '',
  '      - name: Unit tests',
  '        run: pnpm run test:unit',
].join('\n');

describe('06-16 (WR-05): a .svelte type error cannot hide behind a green check', () => {
  it('the real package.json and the real workflow have no problem', () => {
    expect(
      typecheckGateProblems(readRepoFile('package.json'), readRepoFile('.github/workflows/ci.yml')),
    ).toEqual([]);
  });

  it('the known-good inputs have no problem (the scan is not vacuously failing)', () => {
    expect(typecheckGateProblems(GOOD_PACKAGE, GOOD_WORKFLOW)).toEqual([]);
  });

  it('a check script that is only tsc -b names svelte-check', () => {
    const pkg = JSON.stringify({
      scripts: { check: 'tsc -b' },
      devDependencies: { 'svelte-check': '^4.7.6' },
    });
    expect(typecheckGateProblems(pkg, GOOD_WORKFLOW).join('\n')).toContain('svelte-check');
  });

  it('a check script with svelte-check but without tsc -b names tsc -b', () => {
    const pkg = JSON.stringify({
      scripts: { check: 'svelte-check --tsconfig ./tsconfig.app.json' },
      devDependencies: { 'svelte-check': '^4.7.6' },
    });
    expect(typecheckGateProblems(pkg, GOOD_WORKFLOW).join('\n')).toContain('tsc -b');
  });

  it('a svelte-check that is not pointed at the app tsconfig is a problem', () => {
    const pkg = JSON.stringify({
      scripts: { check: 'tsc -b && svelte-check' },
      devDependencies: { 'svelte-check': '^4.7.6' },
    });
    expect(typecheckGateProblems(pkg, GOOD_WORKFLOW).join('\n')).toContain('tsconfig.app.json');
  });

  it('svelte-check missing from devDependencies is a problem', () => {
    const pkg = JSON.stringify({
      scripts: { check: 'tsc -b && svelte-check --tsconfig ./tsconfig.app.json' },
      devDependencies: {},
    });
    expect(typecheckGateProblems(pkg, GOOD_WORKFLOW).join('\n')).toContain('devDependency');
  });

  it('a typecheck step that runs a bare checker instead of pnpm run check is a problem', () => {
    for (const command of ['tsc -b', 'pnpm exec svelte-check']) {
      const workflow = GOOD_WORKFLOW.replace('run: pnpm run check', `run: ${command}`);
      expect(typecheckGateProblems(GOOD_PACKAGE, workflow).join('\n')).toContain(
        'exactly `pnpm run check`',
      );
    }
  });

  it('a workflow with no typecheck step, or with two, is a problem', () => {
    const none = GOOD_WORKFLOW.replace('Typecheck (tsc -b and svelte-check)', 'Verify');
    expect(typecheckGateProblems(GOOD_PACKAGE, none).join('\n')).toContain('found 0');

    const two = `${GOOD_WORKFLOW}\n      - name: Typecheck again (svelte-check)\n        run: pnpm run check`;
    expect(typecheckGateProblems(GOOD_PACKAGE, two).join('\n')).toContain('found 2');
  });

  it('a typecheck step whose name does not mention svelte-check is a problem', () => {
    const workflow = GOOD_WORKFLOW.replace('Typecheck (tsc -b and svelte-check)', 'Typecheck');
    expect(typecheckGateProblems(GOOD_PACKAGE, workflow).join('\n')).toContain(
      'name must mention svelte-check',
    );
  });

  it('another step that runs a checker directly is a problem', () => {
    const workflow = `${GOOD_WORKFLOW}\n      - name: Extra\n        run: pnpm exec svelte-check`;
    expect(typecheckGateProblems(GOOD_PACKAGE, workflow).join('\n')).toContain('"Extra"');
  });

  it('comment lines in the workflow are ignored, so a commented-out step satisfies nothing', () => {
    const commented = GOOD_WORKFLOW.split('\n')
      .map((line, i) => (i === 6 || i === 7 ? `# ${line}` : line))
      .join('\n');
    expect(commented).toContain('# ');
    expect(typecheckGateProblems(GOOD_PACKAGE, commented).join('\n')).toContain('found 0');
  });
});
