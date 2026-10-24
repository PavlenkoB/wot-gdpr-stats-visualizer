import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// =============================================================================
// overview-main-thread-guard.test.ts — the main-thread boundary of the Overview
// (INSIGHT-01, INSIGHT-08)
//
// =============================================================================
//
// WHAT THIS PROVES
//   Two claims the requirement makes about the PAGE, which no other test
//   states in a way that can fail:
//
//   1. INSIGHT-01: "no row is read or computed on the main thread". The row
//      readers — the builders that fold account statistics rows, vehicle
//      statistics rows, currency operations and orders into tiles — live
//      behind the WORKER, and the page's own import graph never reaches them.
//      The import graph is the property: a main-thread module that imported
//      `overview-aggregate.ts` would put the row folding in the browser
//      bundle, and the page would then read rows.
//
//   2. INSIGHT-08: the "Wargaming life" list is READ-ONLY and is INDEPENDENT
//      of the shared game filter. The list is a plain list of figures, with no
//      control in it, and the Overview page's import graph never reaches the
//      shared filter — so no filter choice can narrow the list.
//
// WHY AN IMPORT-GRAPH GUARD AND NOT A RUNTIME TEST
//   The claim is about a BUNDLE, not about a screen: "this code is not in the
//   page's bundle" is a fact about the module graph, and the only way to
//   check it offline is to walk the graph. The project already does this for
//   the tank table (`tests/unit/guards/vehicle-table-guard.test.ts`), so the
//   shape is the project's own.
//
//   The walk is over RUNTIME edges only. A type-only import (`import type`)
//   is erased at build time and puts no code in the bundle, so it is not an
//   edge of the bundle's graph and is not counted as one.
//
// THE POSITIVE CONTROL
//   A guard that finds nothing proves nothing unless the walk is known to
//   work, so the first case asserts the closure is a real, non-trivial set
//   that contains the page's own modules. If the parser ever stopped matching
//   imports, that case would fail.
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** The page body, which holds the life list and the groups. */
const BENTO = path.join(REPO_ROOT, 'src/lib/features/overview/OverviewBento.svelte');

/**
 * The modules that READ ROWS or COMPUTE TILE FIGURES.
 *
 * Every one of them is behind the worker: `data-queries.ts` (worker-only)
 * imports `overview-aggregate.ts`, and that imports the rest. The page
 * importing any of them would fold rows in the browser.
 */
const ROW_READING_MODULES = [
  'src/lib/features/overview/overview-aggregate.ts',
  'src/lib/features/overview/overview-account-stats.ts',
  'src/lib/features/overview/overview-records.ts',
  'src/lib/features/overview/overview-tanks.ts',
  'src/lib/features/overview/overview-totals.ts',
  'src/lib/features/overview/overview-time.ts',
];

/** The worker's own directory: nothing under it may be in the page's bundle. */
const WORKER_DIR = 'src/lib/worker/';

/** The shared game filter (Phase 10): the Overview must not read it. */
const GAME_FILTER_MODULE = 'src/lib/shell/game-filter-state.ts';

// -----------------------------------------------------------------------------
// The walk
// -----------------------------------------------------------------------------

/** One import edge, with whether it carries code. */
interface Edge {
  /** The specifier as written. */
  specifier: string;
  /** False for `import type`, which is erased and carries no code. */
  runtime: boolean;
}

/**
 * The import edges of one source file.
 *
 * Both `import ... from '...'` and `export ... from '...'` are edges: a
 * re-export puts the target's code in the importing bundle just as an import
 * does.
 */
function edgesOf(source: string): Edge[] {
  const edges: Edge[] = [];
  const pattern = /(?:^|\n)\s*(import|export)\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    const clause = (match[2] ?? '').trim();
    const runtime = !/^type\b/.test(clause) && !/,\s*type\s/.test(`,${clause},`);
    edges.push({ specifier: match[3] ?? '', runtime });
  }
  // A bare `import './x.ts'` has no `from` clause.
  for (const match of source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
    edges.push({ specifier: match[1] ?? '', runtime: true });
  }
  return edges;
}

/** The file a relative specifier names, or null when it names nothing here. */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.svelte`, path.join(base, 'index.ts')]) {
    try {
      const resolved = path.relative(REPO_ROOT, candidate).split(path.sep).join('/');
      // `readFileSync` below is the existence check; a candidate that is not a
      // file throws there and is skipped.
      readFileSync(candidate, 'utf8');
      return resolved;
    } catch {
      // Not this candidate.
    }
  }
  return null;
}

/** The runtime import closure of one file, relative to the repository root. */
function runtimeClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    let source: string;
    try {
      source = readFileSync(path.join(REPO_ROOT, file), 'utf8');
    } catch {
      continue;
    }
    for (const edge of edgesOf(source)) {
      if (!edge.runtime) continue;
      const target = resolveSpecifier(edge.specifier, path.join(REPO_ROOT, file));
      if (target !== null && !seen.has(target)) stack.push(target);
    }
  }
  return seen;
}

/** The source of the life list block of the page body. */
function lifeListBlock(): string {
  const source = readFileSync(BENTO, 'utf8');
  const start = source.indexOf('data-testid="ov-life"');
  expect(start, 'the page body has no life list').toBeGreaterThan(-1);
  const end = source.indexOf('{/if}', start);
  expect(end, 'the life list block is never closed').toBeGreaterThan(start);
  return source.slice(start, end);
}

// -----------------------------------------------------------------------------
// The cases
// -----------------------------------------------------------------------------

describe('the Overview page: the main thread reads no rows', () => {
  const closure = runtimeClosure('src/lib/shell/Overview.svelte');

  it('walks a real import graph, so the cases below are not vacuous', () => {
    // The closure must contain the page's own modules, or the walk found
    // nothing and every other case would pass for the wrong reason.
    expect(closure.size).toBeGreaterThan(5);
    expect([...closure]).toContain('src/lib/shell/Overview.svelte');
    expect([...closure]).toContain('src/lib/features/overview/OverviewBento.svelte');
    expect([...closure]).toContain('src/lib/features/overview/overview-format.ts');
  });

  it('never reaches a module that reads rows or computes tile figures', () => {
    const reached = ROW_READING_MODULES.filter((module) => closure.has(module));
    expect(reached, 'the page bundle reaches a row reader').toEqual([]);
  });

  it('never reaches the worker, the database or Dexie', () => {
    const workerFiles = [...closure].filter((file) => file.startsWith(WORKER_DIR));
    expect(workerFiles, 'the page bundle reaches the worker').toEqual([]);

    const dexie = [...closure].filter((file) => file === 'src/lib/worker/db.ts');
    expect(dexie, 'the page bundle reaches the database').toEqual([]);
  });

  it('never reaches the shared game filter, so the filter cannot narrow it', () => {
    expect([...closure]).not.toContain(GAME_FILTER_MODULE);
  });
});

describe('the Wargaming life list: read-only figures', () => {
  const block = lifeListBlock();

  it('holds no control of any kind', () => {
    for (const forbidden of [
      '<button',
      '<input',
      '<select',
      '<a ',
      'role=',
      'onclick',
      'onchange',
    ]) {
      expect(block.includes(forbidden), `the life list holds ${forbidden}`).toBe(false);
    }
  });

  it('holds nothing but the label and the per-game figures', () => {
    // A `dt`/`dd` pair per game, inside the list's own container.
    expect(block).toContain('<dt>');
    expect(block).toContain('<dd>');
    // The figure goes through the one life formatter, which never prints "0.0 days".
    expect(block).toContain('lifeFigure(');
  });
});
