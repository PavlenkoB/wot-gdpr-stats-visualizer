/**
 * The geo SOURCE decision, pinned (phase 06, plan 06-04 Task 2, RESEARCH
 * Decision 1, ACTIVITY-06).
 *
 * ## Why this file exists at all
 *
 * The decision was made at a human checkpoint: the geo data comes from the
 * OFFICIAL monthly DB-IP downloads, not from the `@ip-location-db` npm mirror.
 * A decision that lives only in a SUMMARY is a decision that the next person
 * re-opens, and the evidence that produced it is the kind that is easy to
 * forget — the mirror is deprecated by npm, flagged SUS by the
 * package-legitimacy gate, stale, disagreeing with the official file on 2.65%
 * of /24 blocks and carrying no `ZZ` rows at all.
 *
 * So the decision is pinned in the two places it can actually be undone, and
 * nowhere else:
 *
 *   1. `package.json` — the mirror is not a dependency, of either kind. This is
 *      the decision's load-bearing claim: option-b was refused precisely so
 *      that nothing from `@ip-location-db` is installed, and an install is the
 *      one part of the decision that a later contributor could undo by accident
 *      (`pnpm add -D`).
 *   2. The two documents that used to NAME the mirror as the build-time input —
 *      `AGENTS.md`'s "Geo-map assets are build-time only" constraint and
 *      `REQUIREMENTS.md`'s `ACTIVITY-06`. A requirement that names a deprecated
 *      package keeps the phase looking unfinished to whoever audits it.
 *
 * These are source-contract tests in the 04-09 / 04-18 sense: the thing being
 * claimed is a property of files on disk rather than of a function, and there
 * is no other instrument for it. Every test asserts the file EXISTS first,
 * because an empty string contains no forbidden token and would pass vacuously.
 *
 * The URL shape the decision actually depends on — the current-month-then-
 * previous-month resolution — is NOT pinned here. It is pinned behaviourally,
 * with a stubbed `head`, in `tests/unit/geo/build-scripts.test.ts`, which is
 * where the code that implements it lives.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function readRepoFile(relative: string): string {
  const full = path.join(REPO_ROOT, relative);
  expect(
    readFileSync(full, 'utf8').length,
    `${relative} must exist and be readable`,
  ).toBeGreaterThan(0);
  return readFileSync(full, 'utf8');
}

/** The single `AGENTS.md` bullet that names the geo build-time input. */
function geoConstraintLine(): string {
  const agents = readRepoFile('AGENTS.md');
  const line = agents
    .split('\n')
    .find((candidate) => candidate.startsWith('- **Geo-map assets are build-time only**'));
  expect(line, 'AGENTS.md must keep a "Geo-map assets are build-time only" bullet').toBeDefined();
  return line!;
}

/** The single `REQUIREMENTS.md` bullet for `ACTIVITY-06`. */
function activity06Line(): string {
  const requirements = readRepoFile('.planning/milestones/v1.0-REQUIREMENTS.md');
  const line = requirements.split('\n').find((candidate) => candidate.includes('**ACTIVITY-06**'));
  expect(line, 'REQUIREMENTS.md must keep an ACTIVITY-06 line').toBeDefined();
  return line!;
}

describe('the geo source decision (06-04 Task 2, RESEARCH Decision 1)', () => {
  it('installs nothing from @ip-location-db', () => {
    const manifest = JSON.parse(readRepoFile('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const installed = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
    expect(installed.filter((name) => name.startsWith('@ip-location-db'))).toEqual([]);
  });

  it('names the official monthly download as the AGENTS.md build-time input', () => {
    const line = geoConstraintLine();
    expect(line).toContain('https://download.db-ip.com/free/dbip-');
    expect(line).toMatch(/official monthly DB-IP downloads/);
  });

  it('keeps the npm mirror named as a fallback and not as a dependency', () => {
    const line = geoConstraintLine();
    // The mirror stays named, because CONTRIBUTORS.md-level knowledge of an
    // offline fallback is worth keeping — what changed is that it is a fallback
    // and that nothing installs it.
    expect(line).toContain('@ip-location-db/dbip-country');
    expect(line).toMatch(/fallback/);
    expect(line).toMatch(/deprecated/);
    expect(line).toContain('nothing installs');
  });

  it('names the official monthly download in ACTIVITY-06 and not the mirror as its source', () => {
    const line = activity06Line();
    expect(line).toMatch(/official monthly download/);
    // The negative form is allowed and is what the amendment itself says; what
    // is refused is the mirror being named as where the data comes FROM.
    expect(line).not.toContain('@ip-location-db/dbip-country');
  });
});
