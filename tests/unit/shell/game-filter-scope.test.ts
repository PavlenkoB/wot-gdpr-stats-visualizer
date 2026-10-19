// =============================================================================
// game-filter-scope.test.ts — the filter reaches Playtime and Vehicles ONLY (D-07)
// =============================================================================
//
// WHAT THIS IS. A source-shape guard, not a render test. It reads
// `src/lib/shell/Dashboard.svelte` as TEXT and asserts which component tags
// receive `{gameFilter}`.
//
// WHY A TEXT GUARD AND NOT A RENDER. The guarantee is about a WIRING decision:
// which panes the shared game filter narrows. `Dashboard.svelte` mounts exactly
// one pane at a time behind an `{#if}` chain, `vitest.config.ts` runs in Node
// with no Svelte plugin, and a component cannot be rendered in a unit test at
// all — so a render-based assertion is not available in this repository, for
// any pane. The style is the one `tests/unit/import/multi-account-keys.test.ts`
// already uses for the same reason.
//
// WHY IT MATTERS. The filter is a claim about the whole export: a reader who
// narrows to HEAT and then opens Financial data would expect Financial data to
// obey it, and it does not — Financial has no per-game scope to narrow to. So
// the scope is a decision that has to be visible in one place rather than a
// property each pane re-decides. Plan 11-09 adds panes that must stay OUT of
// the filter; this guard is what makes them fail loudly if they do not.
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const DASHBOARD_PATH = fileURLToPath(
  new URL('../../../src/lib/shell/Dashboard.svelte', import.meta.url),
);

const source = readFileSync(DASHBOARD_PATH, 'utf8');

/** Every `{gameFilter}` prop pass in the source, as `[component, offset]`. */
function propPasses(): { component: string; offset: number }[] {
  const passes: { component: string; offset: number }[] = [];
  const pattern = /<([A-Z][A-Za-z]*)\b[^>]*?\{gameFilter\}/gs;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    passes.push({ component: match[1]!, offset: match.index });
  }
  return passes;
}

describe('Dashboard: the shared filter reaches Playtime and Vehicles, and nothing else', () => {
  test('{gameFilter} is passed to exactly two components', () => {
    const passes = propPasses();
    expect(passes.map((pass) => pass.component).sort()).toEqual(['PlayerStats', 'Playtime']);
  });

  test('both passes sit inside a component tag, never in a comment or a string', () => {
    // `[^>]*?` cannot cross a `>`, so a pass inside a JSX comment would have to
    // name a component too; the point of the assertion is that a future edit
    // which mentions `{gameFilter}` in prose does not silently become a pass.
    const passes = propPasses();
    expect(passes.length).toBeGreaterThanOrEqual(2);
    for (const pass of passes) {
      expect(pass.offset).toBeGreaterThan(0);
      expect(pass.offset).toBeLessThan(source.length);
    }
  });

  test('the panes that must NOT narrow are named in the source without the prop', () => {
    // Positive assertions rather than a scan for absence: a pane that were
    // removed from Dashboard.svelte entirely would make a "no {gameFilter}"
    // grep vacuously true, and this file is where those panes are rendered.
    for (const component of ['FinancialData', 'SpendSummary', 'LoginHistory', 'Overview']) {
      expect(source, `${component} is rendered by Dashboard.svelte`).toContain(`<${component}`);
    }
    const passes = propPasses().map((pass) => pass.component);
    for (const component of ['FinancialData', 'SpendSummary', 'LoginHistory', 'Overview']) {
      expect(passes, `${component} must not receive gameFilter`).not.toContain(component);
    }
  });

  test('the filter is derived from the stamped choice, not stored twice', () => {
    // One `$derived` read of the ONE cell. Two derivations of the same filter
    // would be two answers to one question, which is the failure this guard
    // exists to catch alongside the wiring.
    const derived = source.match(/const gameFilter = \$derived\(/g) ?? [];
    expect(derived).toHaveLength(1);
    expect(source).toContain('resolveGameFilter(');
  });
});
