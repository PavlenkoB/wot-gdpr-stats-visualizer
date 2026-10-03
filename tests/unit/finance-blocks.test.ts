// =============================================================================
// The Financial BLOCKS' source contracts (05-10, Task 3)
// =============================================================================
//
// WHY THIS FILE EXISTS, AND WHY IT READS SOURCE
//
// `tests/unit/finance-state.test.ts` covers the decisions. What is left is the
// WIRING, and wiring is what rots silently: a `{@html}` creeping into a list
// of untrusted premium strings, a `style:` directive appearing because one
// state needed a colour, a per-row `addEventListener` multiplying a listener
// by the length of a twenty-year history, an `aria-live` attribute landing on
// the disclosure and quietly changing a page-wide count another spec asserts.
// None of that shows up in a test of arithmetic, and all of it is a security
// or an accessibility property rather than a number.
//
// `vitest.config.ts` has no Svelte plugin and cannot render a component at
// all, so the contract that can be checked in Node is checked against the
// source text — the same technique `playtime-charts.test.ts` uses for the
// Phase 4 charts and `contrast.test.ts` uses for the stylesheet. `pnpm run
// check` (svelte-check's a11y rules) and the browser spec cover what a regex
// cannot, and this file says so rather than pretending to.
//
// COMMENTS ARE STRIPPED BEFORE EVERY PROHIBITION
// A comment explaining why `{@html}` is absent necessarily names `{@html}`,
// and a comment explaining why there is no per-row listener names
// `addEventListener`. So the prohibitions read `code()`, never `source()`:
// otherwise this file would forbid the explanations that belong in the
// components.
//
// LAZY READ, MISSING FILE IS AN EMPTY STRING
// A component that has not been written yet fails as a plain assertion
// naming the missing contract, not as a module-load crash that would take the
// whole unit suite down and hide what else is and is not implemented.
//
// Decisions: D-20 (excluded rows counted, their strings listed), D-02 (the
// notice is shared, not copied). Threats: T-05-29 (a crafted premium string
// rendered as markup or into an attribute).
// =============================================================================

import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPONENTS = path.join(REPO_ROOT, 'src/lib/components');

const NOTICE = 'ExcludedNotice.svelte';
const PREMIUM = 'PremiumBlock.svelte';
const FINANCIAL = 'FinancialData.svelte';
const PLAYTIME = 'Playtime.svelte';
const PLAYTIME_SUMMARY = 'PlaytimeSummary.svelte';

/** The file's source, or `''` when it does not exist yet. */
function source(file: string): string {
  const full = path.join(COMPONENTS, file);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/** The source with every comment removed — see the header's "COMMENTS" note. */
function code(file: string): string {
  return source(file)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('05-10 Task 3: the generalised excluded notice', () => {
  test('the notice takes three optional props', () => {
    // `count` stays required and stays the only prop a Phase 4 caller passes.
    // The three new ones are optional precisely so the existing two call sites
    // are untouched — which is asserted separately below rather than assumed.
    const notice = code(NOTICE);
    expect(notice).toMatch(/\bcount:\s*number/);
    expect(notice).toMatch(/\bpill\?:\s*string/);
    expect(notice).toMatch(/\bexplanation\?:\s*string/);
    expect(notice).toMatch(/\btestId\?:\s*string/);
  });

  test('each optional prop falls back to its Phase 4 value', () => {
    // The defaults are the load-bearing part of "generalised without
    // changing": a missing `??` would make the playtime notice render an empty
    // pill row, and `formatExcludedPill(0)` returning '' is the whole reason
    // the component can be trusted to render nothing.
    const notice = code(NOTICE);
    expect(notice).toMatch(/formatExcludedPill\(count\)/);
    expect(notice).toContain('PLAYTIME_EXCLUDED_EXPLANATION');
    expect(notice).toContain("'playtime-excluded'");
  });

  test('the notice renders the pill, the explanation and the test id from props', () => {
    // The single `{#if pill !== ''}` guard is the "never 0 rows excluded" rule
    // (D-02) and it must now test the RESOLVED pill, not the count: a caller
    // that passes `formatXExcludedPill(0)` gets '' and the notice disappears,
    // which is the only way the zero case stays unrepresentable from outside.
    const notice = code(NOTICE);
    expect(notice).toMatch(/\{#if\s+\w*[Pp]ill\w*\s*!==\s*''\}/);
    expect(notice).toMatch(/data-testid=\{[A-Za-z0-9_]+\}/);
    // The hard-coded Phase 4 test id is GONE from the markup, replaced by the
    // bound value — if it were still hard-coded, the premium notice would
    // render under a hook that says "playtime".
    expect(notice).not.toMatch(/data-testid="playtime-excluded"/);
  });

  test('the Phase 4 callers pass only count and are otherwise untouched', () => {
    // The regression guard for the generalisation itself. A future edit that
    // "helpfully" passes a new prop from the playtime side would change a
    // Phase 4 component, and the acceptance criterion for this plan is that
    // both of these files have an EMPTY diff.
    for (const caller of [PLAYTIME, PLAYTIME_SUMMARY]) {
      const call = code(caller).match(/<ExcludedNotice\b[^>]*\/>/);
      expect(call, `${caller} must still call <ExcludedNotice />`).not.toBeNull();
      expect(call![0]).toMatch(/\bcount=\{/);
      expect(call![0]).not.toMatch(/\bpill=/);
      expect(call![0]).not.toMatch(/\bexplanation=/);
      expect(call![0]).not.toMatch(/\btestId=/);
    }
  });
});

describe('05-10 Task 3: the premium block lists the strings that were not charted', () => {
  test('the block hosts both hooks, and the pill is the notice rather than a copy', () => {
    // `premium-excluded` reaches the page THROUGH the shared notice, so the
    // block's own source names it as the `testId` prop. Asserting the literal
    // `data-testid="premium-excluded"` here would pass against a block that
    // had grown its own pill and left the notice unused — which is exactly the
    // duplication the generalisation exists to prevent.
    const premium = code(PREMIUM);
    expect(premium).toContain('data-testid="premium-block"');
    expect(premium).toContain('data-testid="premium-summary"');
    expect(premium).toMatch(/testId="premium-excluded"/);
    expect(premium).toContain('data-testid="premium-unrecognised"');
    // The premium copy comes from the Phase 5 inventory, not from a literal in
    // the component.
    expect(premium).toContain('formatPremiumExcludedPill');
    expect(premium).toContain('PREMIUM_EXCLUDED_EXPLANATION');
    expect(premium).toContain('formatPremiumUnrecognisedDisclosure');
    expect(premium).toContain('formatUnrecognisedOverflow');
  });

  test('the disclosure is a NATIVE details element, not a click handler', () => {
    // A disclosure built from a div and an on:click would need a keyboard
    // handler, a focus ring and an expanded state, and would still be wrong on
    // a phone. `details`/`summary` is the control the UI-SPEC asks for and the
    // one that needs none of that wiring.
    const premium = code(PREMIUM);
    expect(premium).toMatch(/<details\b/);
    expect(premium).toMatch(/<summary\b/);
    expect(premium).toContain('<ul');
    expect(premium).toContain('<li');
  });
});

describe('05-10 Task 3: what neither component may contain', () => {
  /**
   * T-05-29 in source form. Each prohibition names a way a crafted premium
   * string — which came out of a real export the user opened — could become
   * markup, a style, a listener, or a live region.
   */
  const PROHIBITIONS: readonly { what: string; pattern: RegExp; why: string }[] = [
    {
      what: 'a raw-HTML interpolation tag',
      pattern: /\{@html/,
      why: 'the unrecognised premium strings are TEXT; `{@html}` would make one an element',
    },
    {
      what: 'an inline style attribute',
      pattern: /\sstyle="/,
      why: 'state colours belong in the stylesheet, where a contrast test can read them',
    },
    {
      what: 'a style directive',
      pattern: /\sstyle:/,
      why: 'the same reason, reached through the other syntax',
    },
    {
      what: 'an aria-live attribute',
      pattern: /aria-live/,
      why: "the notice slot is the page's only live region and the playtime status line the other; a third would break a count another spec asserts",
    },
    {
      what: 'a per-row listener',
      pattern: /addEventListener/,
      why: 'the listed strings number up to twenty and are plain text; a listener per row would be a listener per string',
    },
  ];

  for (const file of [PREMIUM, NOTICE, FINANCIAL]) {
    test(`${file} contains none of them`, () => {
      const stripped = code(file);
      for (const { what, pattern, why } of PROHIBITIONS) {
        expect(stripped, `${file} must not contain ${what} — ${why}`).not.toMatch(pattern);
      }
    });
  }
});
