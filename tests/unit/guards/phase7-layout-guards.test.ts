import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';

// =============================================================================
// Phase 7 layout guards (plan 07-08, gap G-07-5).
// =============================================================================
//
// WHAT THIS FILE IS
// One declaration, asserted on the SOURCE of all four table scrollers:
// `isolation: isolate` on `.scroller` in LoginTable, VehicleTable, CityList and
// CountryList. It makes each scroller its own stacking context, so a table's
// sticky cells (header z-index 2, corner cell 3, first column 1) are compared
// with each other and never with the sticky nav's z-index 1 in the page's root
// stacking context.
//
// WHY IT SITS NEXT TO THE BROWSER TESTS
// The two (stacking) tests in tests/e2e/shell/scroll-nav.spec.ts cover the two
// tables that overlap the nav today, LoginTable and VehicleTable, by measuring
// paint order. They cannot cover the other two:
//
//   - CountryList cannot go red: its header cells are `position: sticky` with
//     no z-index and its scroller is unpositioned, so they paint below the nav
//     already and there is no failing browser state to write.
//   - CityList only renders after the opt-in city download, whose browser state
//     needs a route-fulfilled city file (tests/e2e/logins/login-city.spec.ts).
//
// So the one declaration that makes all four scrollers a stacking context is
// asserted here, and a z-index added to either list's header later is contained
// by it rather than painted over the nav.
//
// WHY THE PATTERNS ARE COPIED RATHER THAN IMPORTED
// `stripComments` and `ruleDeclarations` are copied from
// phase5-layout-guards.test.ts: test files do not import from each other in
// this repository (that file's header gives the reason).
// =============================================================================

/** Strip HTML, block and line comments from Svelte/CSS source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** A regex metacharacter-safe copy of `text`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The declaration body of the FIRST rule whose selector list is EXACTLY
 * `selector` (`.scroller` matches; `.scroller:focus-visible` and
 * `.a .scroller` do not).
 */
function ruleDeclarations(source: string, selector: string): string {
  const boundary = '(?:^|[};])';
  const pattern = new RegExp(`${boundary}\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'm');
  return pattern.exec(source)?.[1] ?? '';
}

const SCROLLER_COMPONENTS = [
  'LoginTable.svelte',
  'VehicleTable.svelte',
  'CityList.svelte',
  'CountryList.svelte',
] as const;

describe('phase 7 layout guards (07-08, G-07-5)', () => {
  it.each(SCROLLER_COMPONENTS)(
    '%s: the .scroller rule is its own stacking context (isolation: isolate)',
    (name) => {
      const file = componentPath(name);
      expect(existsSync(file), `${name} does not exist (looked at ${file})`).toBe(true);

      const source = stripComments(readFileSync(file, 'utf8'));
      const declarations = ruleDeclarations(source, '.scroller');
      expect(declarations, `${name} has no .scroller rule`).not.toBe('');

      expect(
        declarations,
        `${name}: .scroller must declare isolation: isolate, or its sticky cells are compared with the nav's z-index (G-07-5)`,
      ).toMatch(/(?:^|[{;])\s*isolation:\s*isolate\s*;/);
    },
  );
});
