import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';

const BLOCK_FILE = 'CurrencyBlock.svelte';
const LEGEND_FILE = 'FlowLegend.svelte';

/**
 * Every hex the two flow tokens and the six ramp steps are declared with in
 * `src/app.css`.
 *
 * They are written out HERE rather than read off the stylesheet, so a future
 * plan that changes a token has to change the test too — which is the point.
 * A test that read the hexes from `app.css` would pass forever against a
 * component that had started using the same hex directly, because the two
 * would be reading the same wrong value.
 */
const FLOW_AND_RAMP_HEXES: readonly string[] = [
  '#4c3fa6', // --flow-in
  '#a14a00', // --flow-out
  '#eef0f2', // --ramp-0
  '#b2dcd4', // --ramp-1
  '#7cc7bc', // --ramp-2
  '#43a89c', // --ramp-3
  '#1f7a74', // --ramp-4
  '#0d4f4c', // --ramp-5
];

function code(filename: string): string {
  return readFileSync(componentPath(filename), 'utf8');
}

/**
 * Strip single-line and multi-line comments from Svelte file source.
 *
 * The prohibitions below run on this, and the reason is concrete rather than
 * defensive: this file's own header comment says "no hex literal equal to a
 * flow or ramp colour", and a comment explaining WHY `--flow-in` is read as a
 * variable would contain `--flow-in` — but a comment quoting the rule would
 * contain the hexes themselves. Every 04-09/05-12 prohibition test strips for
 * the same reason, and three of them were caught passing vacuously during their
 * RED phase by an empty read of a file that did not exist yet.
 */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

describe('05-13 CurrencyBlock & FlowLegend component contracts', () => {
  it('CurrencyBlock.svelte exists and implements its structural contract', () => {
    // Every test below asserts the file EXISTS first, because an empty string
    // contains no forbidden token and would pass vacuously.
    expect(existsSync(componentPath(BLOCK_FILE))).toBe(true);
    const clean = stripComments(code(BLOCK_FILE));

    // Test hooks, and the state attribute the specs read. `currency-chart`
    // carries the code as an ATTRIBUTE for tests only; nothing concatenates it
    // into a selector, which is T-05-39's claim about untrusted zip text.
    expect(clean).toContain('data-testid="currency-block"');
    expect(clean).toContain('data-testid="currency-chart"');
    expect(clean).toContain('data-testid="currency-other-row"');
    // The excluded pill is the SHARED `ExcludedNotice`, so its hook arrives as
    // a prop rather than as a literal attribute — and the prop is the hook, so
    // asserting the prop is asserting the same thing the specs read.
    expect(clean).toContain('testId="currency-excluded"');
    expect(clean).toContain('ExcludedNotice');
    expect(clean).toContain('data-state={blockState}');
    expect(clean).toContain('data-currency=');
    // The two chart-level hooks the browser specs read, passed to the shared
    // chart component rather than reimplemented here.
    expect(clean).toContain('chartTestId="currency-svg"');
    expect(clean).toContain('cellTestId="currency-cell"');

    // D-02's states: the block asks one channel and its state is derived by
    // the SAME pure function the premium block uses, which is what stops the
    // two sub-blocks from disagreeing about what the export contains.
    expect(clean).toContain("client.query({ channel: 'currency' })");
    expect(clean).toContain('deriveFinanceState({ importedAt, shown })');
    expect(clean).toContain("acceptDataOutcome(outcome, 'currency', wanted, importedAt)");
    // Busy only while loading, and the error state is an ALERT with no live
    // region attribute — a region created with its content announces nothing,
    // and an `aria-live` error would re-announce on every re-render.
    expect(clean).toContain("aria-busy={blockState === 'loading' ? 'true' : 'false'}");
    expect(clean).toContain('role="alert"');
    expect(clean).toContain('role="status"');
    expect(clean).not.toContain('aria-live');
  });

  it('CurrencyBlock.svelte renders every sentence from ui-copy', () => {
    const clean = stripComments(code(BLOCK_FILE));

    // D-21: the copy layer owns every user-facing string, and a component
    // that wrote one inline would be a second place for the wording to live.
    expect(clean).toMatch(/from '\.\.\/\.\.\/ui-copy\.ts'/);
    // The four strings whose exact wording a spec asserts. If one of these
    // were written inline, the spec that checks the wording would pass against
    // a component that had drifted from the inventory it claims to use.
    for (const constant of [
      'FINANCIAL_CURRENCY_HEADING',
      'CURRENCY_BLOCK_CAPTION',
      'CURRENCY_NO_USABLE',
      'CURRENCY_EXCLUDED_EXPLANATION',
      'OTHER_CURRENCIES_HEADING',
      'CURRENCY_BLANK_CODE',
      'MONTHLY_TABLE_DISCLOSURE',
    ]) {
      expect(clean).toContain(constant);
    }
    // The `no-rows` sentence is the shared per-block formatter, not a second
    // template string in the component (D-02's absent-versus-empty claim).
    expect(clean).toContain("formatFinancialNoRows('currency')");
  });

  it('CurrencyBlock.svelte renders zip-derived codes as TEXT, never as markup', () => {
    const clean = stripComments(code(BLOCK_FILE));

    // T-05-39: a currency code is untrusted text from a zip. Interpolation
    // escapes it, a raw-HTML tag would not, and the hand fixture's `__proto__`
    // code is rendered as an ordinary row by exactly this path.
    expect(clean).not.toContain('{@html');
    // No inline style attribute or directive: a per-element colour would be a
    // per-element place for an untrusted value to reach the CSSOM.
    expect(clean).not.toMatch(/\bstyle="/);
    expect(clean).not.toMatch(/\bstyle:[a-zA-Z-]+=/);
    // No animation, and no `viewBox` — the chart is sized in user units so
    // the 14px axis text is never scaled with the plot.
    expect(clean).not.toContain('viewBox');
    expect(clean).not.toContain('transition:');
    expect(clean).not.toContain('animation:');
  });

  it('CurrencyBlock.svelte carries no flow or ramp colour literal', () => {
    const clean = stripComments(code(BLOCK_FILE)).toLowerCase();

    // The flow tokens are the two hues deposits and withdrawals are drawn in,
    // and they sit 1.36:1 apart — too close to carry the distinction on their
    // own. A literal here would fork the palette away from the token, and the
    // legend's swatches would then read one colour while the bars read
    // another.
    for (const hex of FLOW_AND_RAMP_HEXES) {
      expect(clean).not.toContain(hex);
    }
    // And the ramp is not this block's vocabulary at all: a currency chart is
    // two directions, not an ordered scale.
    expect(clean).not.toContain('var(--ramp-');
  });

  it('FlowLegend.svelte exists, reads both flow tokens and writes no hex', () => {
    expect(existsSync(componentPath(LEGEND_FILE))).toBe(true);
    const raw = code(LEGEND_FILE);
    const clean = stripComments(raw);

    // The swatches read the same two variables the bars do, so a theme change
    // moves the legend and the chart together.
    expect(raw).toContain('var(--flow-in)');
    expect(raw).toContain('var(--flow-out)');
    for (const hex of FLOW_AND_RAMP_HEXES) {
      expect(clean.toLowerCase()).not.toContain(hex);
    }

    // T-05-41: the swatches are decoration and the two words are the legend.
    // A swatch a screen reader announces as an unlabelled graphic adds nothing
    // the words do not already say.
    expect(clean).toContain('aria-hidden="true"');
    expect(clean).toContain('FLOW_LEGEND_DEPOSITED');
    expect(clean).toContain('FLOW_LEGEND_WITHDRAWN');
    // The words are real TEXT in a wrapping row, not a `title` and not a
    // tooltip: at 375px the two phrases do not fit on one line, and a legend
    // that scrolls horizontally to be read is not a legend.
    expect(clean).not.toContain('{@html');
    expect(clean).not.toMatch(/\bstyle="/);
    expect(clean).not.toMatch(/\bstyle:[a-zA-Z-]+=/);
    expect(clean).toContain('flex-wrap: wrap');
  });
});
