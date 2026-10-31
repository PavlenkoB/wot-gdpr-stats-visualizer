import { describe, expect, it } from 'vitest';
import { compile } from 'svelte/compiler';
import { readSrcFiles } from '../../helpers/styles.ts';

// =============================================================================
// The nesting guard (Phase 14, plan 14-04, D-05 and OI-10).
// =============================================================================
//
// WHAT THIS PINS
//   D-05 makes native CSS nesting the form every migrated style block uses.
//   That form is only safe if the compiler SCOPES each nested selector: a
//   nested rule that escaped the scope would style every `.label` on the
//   page, not the one inside its card.
//
//   Two facts are proved here, on FIXTURES, before any pane is migrated:
//
//     1. the scoping: the top compound carries the scope class, and every
//        nested compound carries `:where(.svelte-...)`;
//     2. the detector: a nested selector that matches no element is DROPPED
//        from the output, with the warning `css_unused_selector`.
//
//   The second fact is the reason the sweep below exists. A dead nested rule
//   is not an error: the compiler removes it and says so in a warning that
//   `svelte-check` does not fail on by default. A guard that read only the
//   compiled CSS would never see it. So the sweep reads the WARNINGS, and the
//   fixture that proves the warning is live sits in the SAME file as the sweep
//   that depends on it: a detector that has stopped firing fails the fixture
//   first.
//
// THE SWEEP
//   Every `.svelte` file under `src/` that has a `<style>` element is compiled
//   on every run (no file is exempt since plan 14-21). A component
//   with a dead nested selector fails here, naming the file, the warning code
//   and the selector.
//
// WHY `generate: false` FOR THE SWEEP
//   The sweep does not need the compiled CSS - it needs the WARNINGS - and
//   `generate: false` is the analysis-only mode: no JavaScript is emitted and
//   no source map is built, so the sweep is cheap. The option set is proved
//   by the fixture below: the unused-selector fixture is compiled with
//   `generate: false` and the warning IS reported, so the sweep's detector is
//   the same detector the fixture proves live.
//
// WHY THE FIXTURES ARE STRINGS AND NOT FILES
//   A fixture in the repository would be a file the design-token guards read
//   and would have to be excluded from. A string in this
//   file cannot drift from the compiler's behaviour and cannot be picked up
//   by another guard.
// =============================================================================

/** The compiler options the probe uses. */
interface ProbeOptions {
  /**
   * The compiler's output mode. `false` is analysis only: the compiler
   * analyses the component and reports what it found, and emits nothing.
   */
  generate: 'client' | false;
  /** Where the CSS goes. `external` keeps it out of the JavaScript. */
  css: 'external';
}

/**
 * The compiler's warning code for a nested selector that matches no element.
 *
 * Named once, because three places depend on it: the probe that recognises the
 * warning, the fixture that proves it is reported, and the failure message
 * that names it. A code spelled three times is three chances to spell it
 * three ways.
 */
const UNUSED_SELECTOR_CODE = 'css_unused_selector';

/**
 * The compiler's message pattern for the same warning.
 *
 * The compiler names the dead selector in the message text:
 * `Unused CSS selector "& .nothere"`.
 */
const UNUSED_SELECTOR_MESSAGE = /Unused CSS selector "(.*)"/;

/** What the probe learned about one source. */
interface ProbeResult {
  /** Whether the compiler compiled the source at all. */
  compiled: boolean;
  /** The compiled CSS, or null when the compile produced none. */
  css: string | null;
  /** The warning codes the compiler reported. */
  warningCodes: string[];
  /** The selectors the compiler reported as unused. */
  unusedSelectors: string[];
  /** The compile error code, or null when the compile succeeded. */
  errorCode: string | null;
}

/**
 * Compiles one source and reports what the compiler said about it.
 *
 * A compile that THROWS is a result, not a crash: the component's script or
 * style does not parse, and that is a finding to fix in that component's own
 * plan - never a reason to skip the file.
 */
function probe(source: string, filename: string, options: ProbeOptions): ProbeResult {
  try {
    const result = compile(source, { filename, ...options });

    const warningCodes = result.warnings.map((warning) => warning.code);
    // The message is kept whole as well, so a message the pattern does not
    // match still reaches the failure.
    const unusedSelectors = result.warnings
      .filter((warning) => warning.code === UNUSED_SELECTOR_CODE)
      .map((warning) => UNUSED_SELECTOR_MESSAGE.exec(warning.message)?.[1] ?? warning.message);

    return {
      compiled: true,
      css: result.css?.code ?? null,
      warningCodes,
      unusedSelectors,
      errorCode: null,
    };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return {
      compiled: false,
      css: null,
      warningCodes: [],
      unusedSelectors: [],
      errorCode: typeof code === 'string' ? code : 'unknown',
    };
  }
}

/**
 * A card with a nested label, a nested `:hover` under it, and a nested
 * `@media` block.
 *
 * The three nesting forms are the three a migrated style block can use, and
 * all three are in one fixture because the scoping has to hold for each of
 * them separately.
 */
const NESTED_FIXTURE = `<div class="card">
  <span class="label">Label</span>
</div>

<style>
  .card {
    padding: 8px;

    & .label {
      color: red;

      &:hover {
        color: blue;
      }
    }

    @media (max-width: 480px) {
      & .label {
        color: green;
      }
    }
  }
</style>
`;

/**
 * A card whose nested selector matches nothing.
 *
 * The selector is dropped from the compiled CSS and reported as
 * `css_unused_selector`. This is the fixture that proves the sweep's
 * detector is live.
 */
const UNUSED_SELECTOR_FIXTURE = `<div class="card">
  <span class="label">Label</span>
</div>

<style>
  .card {
    & .nothere {
      color: red;
    }
  }
</style>
`;

/** A `&` outside any rule: the compiler refuses it. */
const TOP_LEVEL_AMP_FIXTURE = `<div class="card">Label</div>

<style>
  .card & {
    color: red;
  }
</style>
`;

/**
 * Every `.svelte` file under `src/` the sweep compiles: each one that has a
 * `<style>` element. A file with no `<style>` element has no CSS to compile.
 */
const SWEPT = readSrcFiles(['.svelte']).filter((file) => /<style[\s>]/.test(file.source));

describe('the Svelte scoping of nested rules (OI-10)', () => {
  it('scopes the top compound and every nested compound', () => {
    const result = probe(NESTED_FIXTURE, 'NestedFixture.svelte', {
      generate: 'client',
      css: 'external',
    });

    expect(result.errorCode, 'the fixture compiles').toBeNull();
    expect(result.css, 'the fixture produces CSS').not.toBeNull();

    // The TOP compound carries the scope class: `.card.svelte-xxxx`.
    expect(result.css).toMatch(/\.card\.svelte-[a-z0-9]+/);

    // The NESTED compound carries the scope as a `:where()`, so the nested
    // rule adds no specificity of its own. One occurrence per nested rule:
    // the `& .label` and the `& .label` inside the `@media`.
    //
    // The deeper `&:hover` carries none of its own, and does not need to: it
    // is nested INSIDE the scoped `& .label` rule, so the scope its parent
    // carries is the scope it inherits.
    const scoped = result.css!.match(/:where\(\.svelte-/g) ?? [];
    expect(scoped.length, 'every nested compound is scoped').toBeGreaterThanOrEqual(2);
    expect(result.css).toMatch(/&\s+\.label:where\(\.svelte-/);

    // Nothing is dead in this fixture: every nested selector matches.
    expect(result.warningCodes).not.toContain(UNUSED_SELECTOR_CODE);
  });

  it('reports a nested selector that matches no element as css_unused_selector', () => {
    const result = probe(UNUSED_SELECTOR_FIXTURE, 'UnusedSelectorFixture.svelte', {
      generate: 'client',
      css: 'external',
    });

    expect(result.errorCode, 'the fixture compiles').toBeNull();
    expect(result.warningCodes).toContain(UNUSED_SELECTOR_CODE);
    expect(result.unusedSelectors.join('\n')).toContain('& .nothere');
  });

  it('reports it in the analysis-only mode the sweep uses', () => {
    // The sweep compiles with `generate: false`: analysis only, no output,
    // no source map. That mode is cheaper, and it is ONLY safe if it reports
    // the same warnings - a sweep whose detector is silent would pass every
    // component, including the ones with a dead nested selector. So the
    // option set the sweep uses is proved here, on the same fixture, rather
    // than assumed.
    const result = probe(UNUSED_SELECTOR_FIXTURE, 'UnusedSelectorFixture.svelte', {
      generate: false,
      css: 'external',
    });

    expect(result.errorCode, 'the fixture compiles').toBeNull();
    expect(result.warningCodes, 'the analysis-only mode reports the warning').toContain(
      UNUSED_SELECTOR_CODE,
    );
    expect(result.unusedSelectors.join('\n')).toContain('& .nothere');
  });

  it('refuses a top-level & as css_nesting_selector_invalid_placement', () => {
    const result = probe(TOP_LEVEL_AMP_FIXTURE, 'TopLevelAmpFixture.svelte', {
      generate: 'client',
      css: 'external',
    });

    expect(result.errorCode).toBe('css_nesting_selector_invalid_placement');
  });
});

describe('the nesting sweep over every component with a style block (D-05)', () => {
  it('compiles every component with a style block, and every nested selector in it is used', () => {
    expect(
      SWEPT.length,
      'the sweep visits every component with a style block',
    ).toBeGreaterThanOrEqual(40);

    const failures: string[] = [];
    let compiled = 0;

    for (const file of SWEPT) {
      // The same option set the fixture above proves reports the unused
      // selector: analysis only, no output.
      const result = probe(file.source, file.name, { generate: false, css: 'external' });

      if (result.errorCode !== null) {
        failures.push(
          `${file.name}: the compiler threw ${result.errorCode}, so the component does not parse`,
        );
        continue;
      }
      if (!result.compiled) continue;
      compiled += 1;

      for (const selector of result.unusedSelectors) {
        failures.push(
          `${file.name}: ${UNUSED_SELECTOR_CODE} — "${selector}" matches no element and was dropped from the output`,
        );
      }
    }

    expect(compiled, 'the sweep compiled at least 40 components').toBeGreaterThanOrEqual(40);
    expect(
      failures,
      'every component compiles, and every nested selector in it matches an element',
    ).toEqual([]);
  });
});
