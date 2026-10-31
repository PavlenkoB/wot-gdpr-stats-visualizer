import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import { ruleDeclarations, styleText } from '../../helpers/css.ts';
import { UTILITIES_CSS } from '../../helpers/styles.ts';

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
// WHY IT STILL HOLDS AFTER THE ANCHOR NAV WAS RETIRED
// Phase 7 added it so the sticky nav (z-index 1) was never painted over by a
// table's sticky cells, and two browser tests in the old nav spec measured
// paint order for LoginTable and VehicleTable. The master-detail shell (phase
// 8) has no bar over the content and that spec is gone, so those browser tests
// were retired with the behaviour. The declaration stays and is still asserted,
// because each scroller's sticky cells (header z-index 2, corner cell 3, first
// column 1) must still be compared with each other and never with anything in
// the page's root stacking context. It also covers the two scrollers a browser
// test cannot reach:
//
//   - CountryList cannot go red: its header cells are `position: sticky` with
//     no z-index and its scroller is unpositioned.
//   - CityList only renders after the opt-in city download, whose browser state
//     needs a route-fulfilled city file (tests/e2e/logins/login-city.spec.ts).
//
// So the one declaration that makes all four scrollers a stacking context is
// asserted here, and a z-index added to either list's header later is contained
// by it.
//
// WHY THE READER IS IMPORTED RATHER THAN COPIED (Phase 14, plan 14-04)
// The local copy read a rule body with `[^}]*`, which stops at the first
// closing brace - so a NESTED rule (`.table { & .scroller { ... } }`) was
// invisible to it, and a guard written against an invisible rule is a guard
// that passes vacuously. The brace-aware reader in `tests/helpers/css.ts`
// sees the nested form, so a component that migrates its scroller into a
// nested rule is still checked.
//
// THE TWO WORLDS THE ASSERTION ACCEPTS
// The four components still carry their OWN `.scroller` rule today. Plans
// 14-11 and 14-13 migrate them to the shared `.scroller` utility in
// `src/styles/utilities.css`, and the verdict has to hold in both worlds:
//
//   - a component with a LOCAL `.scroller` rule: that rule must declare
//     `isolation: isolate`;
//   - a component with NO local rule: it must carry the shared `scroller`
//     class on an element, and the shared utility must declare
//     `isolation: isolate`.
//
// A component with neither fails, because a scroller that is not a stacking
// context is exactly the defect this guard exists for. The two worlds are
// PROVED by the self-tests below: a branch that never runs is a branch that
// has never been checked.
// =============================================================================

/**
 * The shared `.scroller` utility: the rule the four components will use once
 * they are migrated.
 */
const SHARED_SCROLLER = ruleDeclarations(readFileSync(UTILITIES_CSS, 'utf8'), '.scroller');

/** The declaration that makes a scroller its own stacking context. */
const ISOLATION = /(?:^|[{;])\s*isolation:\s*isolate\s*;/;

/** A markup element carrying the shared `scroller` class. */
const SCROLLER_CLASS = /class="[^"]*\bscroller\b/;

/** The verdict of the scroller check for one component. */
interface ScrollerVerdict {
  /** Whether the component's scroller is its own stacking context. */
  ok: boolean;
  /** Why it is not, when it is not. */
  reason: string;
}

/**
 * Judges one component's scroller.
 *
 * Pure and argument-taking, so both worlds can be exercised by the
 * self-tests below with synthetic sources rather than only through the four
 * real components - which today all sit in the FIRST world, leaving the
 * second one untested.
 */
function scrollerVerdict(source: string): ScrollerVerdict {
  const declarations = ruleDeclarations(styleText(source), '.scroller');

  if (declarations !== '') {
    return ISOLATION.test(declarations)
      ? { ok: true, reason: '' }
      : { ok: false, reason: 'its own .scroller rule does not declare isolation: isolate' };
  }

  if (!SCROLLER_CLASS.test(source)) {
    return {
      ok: false,
      reason:
        'it has no .scroller rule of its own and its markup does not use the shared `scroller` class',
    };
  }

  return ISOLATION.test(SHARED_SCROLLER)
    ? { ok: true, reason: '' }
    : { ok: false, reason: 'the shared .scroller utility does not declare isolation: isolate' };
}

const SCROLLER_COMPONENTS = [
  'LoginTable.svelte',
  'VehicleTable.svelte',
  'CityList.svelte',
  'CountryList.svelte',
] as const;

/** The one message every failure of this guard carries. */
const G07_5 =
  "the .scroller must be its own stacking context (isolation: isolate), or its sticky cells are compared with the nav's z-index (G-07-5)";

describe('phase 7 layout guards (07-08, G-07-5)', () => {
  it.each(SCROLLER_COMPONENTS)(
    '%s: the .scroller is its own stacking context (isolation: isolate)',
    (name) => {
      const file = componentPath(name);
      expect(existsSync(file), `${name} does not exist (looked at ${file})`).toBe(true);

      const verdict = scrollerVerdict(readFileSync(file, 'utf8'));
      expect(verdict.ok, `${name}: ${G07_5} — ${verdict.reason}`).toBe(true);
    },
  );
});

describe('the scroller verdict, on both worlds (14-04)', () => {
  it('a component with its own .scroller rule is judged on that rule', () => {
    expect(
      scrollerVerdict(
        '<div class="scroller"></div><style>.scroller { isolation: isolate; }</style>',
      ).ok,
    ).toBe(true);
    expect(
      scrollerVerdict('<div class="scroller"></div><style>.scroller { overflow: auto; }</style>')
        .ok,
    ).toBe(false);
  });

  it('a component with no rule of its own is judged on the shared utility', () => {
    expect(
      scrollerVerdict('<div class="scroller"></div><style>.box { color: red; }</style>').ok,
    ).toBe(true);
  });

  it('a component with neither a rule nor the shared class fails', () => {
    const verdict = scrollerVerdict('<div class="box"></div><style>.box { color: red; }</style>');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('shared `scroller` class');
  });

  it('the shared .scroller utility declares the isolation', () => {
    expect(
      SHARED_SCROLLER,
      'src/styles/utilities.css: the shared .scroller must declare isolation: isolate',
    ).toMatch(ISOLATION);
  });
});
