import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';

const BLOCK_FILE = 'SpendSummary.svelte';

function code(filename: string): string {
  return readFileSync(componentPath(filename), 'utf8');
}

/**
 * Strip single-line and multi-line comments from Svelte file source.
 *
 * The prohibitions below run on this, and the reason is concrete rather than
 * defensive: this file's own header comment says "no raw-HTML tag", and a
 * comment explaining WHY would contain `{@html` — while a comment naming the
 * rule about a `details` element would contain `details`. Every 04-09, 05-12
 * and 05-13 prohibition test strips for the same reason, and three of them were
 * caught passing vacuously during their RED phase by an empty read of a file
 * that did not exist yet.
 */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

describe('05-15 SpendSummary component contracts', () => {
  it('SpendSummary.svelte exists and implements its structural contract', () => {
    // Every test below asserts the file EXISTS first, because an empty string
    // contains no forbidden token and would pass vacuously.
    expect(existsSync(componentPath(BLOCK_FILE))).toBe(true);
    const clean = stripComments(code(BLOCK_FILE));

    // The hooks the browser specs read. `spend-card` carries the code as an
    // ATTRIBUTE for tests only; nothing concatenates it into a selector, which
    // is T-05-39's claim about untrusted zip text.
    for (const hook of [
      'spend-block',
      'spend-card',
      'spend-total',
      'spend-paid-count',
      'spend-gift',
      'spend-breakdown',
    ]) {
      expect(clean).toContain(`data-testid="${hook}"`);
    }
    // The three STATUS hooks are the one exception, and deliberately: the
    // `Other status` row exists only above zero, so writing three separate
    // `{#if}` blocks to hang three test ids on would be three copies of the
    // same markup to keep in step. They come from one literal table instead,
    // and this asserts BOTH halves of that: the three hook names are literals
    // in the file, and `data-testid` is bound to the table's field. A hook
    // renamed in the table is still a rename caught here, and renaming it
    // would also break the browser specs that read it.
    for (const hook of ['spend-failed', 'spend-new', 'spend-other']) {
      expect(clean).toContain(`'${hook}'`);
    }
    expect(clean).toContain('data-testid={figure.hook}');
    // …and the conditional that makes `Other status` optional is a property of
    // the row, not of a markup branch: a card whose `other` is zero must not
    // render the label either.
    expect(clean).toContain('card.other > 0');
    // The excluded pill is the SHARED `ExcludedNotice`, so its hook arrives as
    // a prop rather than as a literal attribute — and the prop IS the hook, so
    // asserting the prop is asserting the same thing the specs read.
    expect(clean).toContain('testId="spend-excluded"');
    expect(clean).toContain('ExcludedNotice');
    expect(clean).toContain('data-state={blockState}');
    expect(clean).toContain('data-currency=');

    // The block asks one channel and its state is derived by the SAME pure
    // function the premium and currency blocks use, which is what stops the
    // three sub-blocks from disagreeing about what the export contains.
    expect(clean).toContain("client.query({ channel: 'spend' })");
    expect(clean).toContain('deriveFinanceState({ importedAt, shown })');
    expect(clean).toContain("acceptDataOutcome(outcome, 'spend', wanted, importedAt)");
    // Busy only while loading, and the error state is an ALERT with no live
    // region attribute — a region created with its content announces nothing,
    // and an `aria-live` error would re-announce on every re-render.
    expect(clean).toContain("aria-busy={blockState === 'loading' ? 'true' : 'false'}");
    expect(clean).toContain('role="alert"');
    expect(clean).toContain('role="status"');
    expect(clean).not.toContain('aria-live');
  });

  it('SpendSummary.svelte renders every sentence from ui-copy', () => {
    const clean = stripComments(code(BLOCK_FILE));

    // D-21: the copy layer owns every user-facing string, and a component
    // that wrote one inline would be a second place for the wording to live.
    expect(clean).toMatch(/from '\.\.\/\.\.\/ui-copy\.ts'/);
    // The strings whose exact wording a spec asserts, and the two formatters
    // every money figure and count on the card goes through.
    for (const name of [
      'SPEND_HEADING',
      'SPEND_INTRO',
      'SPEND_LOADING',
      'SPEND_NO_USABLE',
      'SPEND_ERROR',
      'SPEND_LABEL_FAILED',
      'SPEND_LABEL_NEW',
      'SPEND_LABEL_OTHER',
      'SPEND_BREAKDOWN_DISCLOSURE',
      'SPEND_BY_YEAR',
      'SPEND_BY_GAME',
      'SPEND_BREAKDOWN_HEADERS',
      'SPEND_UNKNOWN_YEAR',
      'SPEND_BLANK_GAME',
      'SPEND_EXCLUDED_EXPLANATION',
      'UNKNOWN_CURRENCY_HEADING',
      'UNKNOWN_CURRENCY_CAPTION',
      'formatGiftLine',
      'formatPaidExcludedPill',
      'formatMoney',
      'formatPaidOrders',
      'formatNumber',
    ]) {
      expect(clean).toContain(name);
    }
    // No sentence literal: any string the reader sees that is not an
    // interpolation of one of the above is a string this file invented.
    expect(clean).not.toMatch(/>[^<>{]*[A-Za-z]{4,}[^<>{]*</);
  });

  it('SpendSummary.svelte rebuilds money from the transported string, never a number', () => {
    const clean = stripComments(code(BLOCK_FILE));

    // D-24/D-25: the sum crossed the message boundary as TEXT, so it is
    // VALIDATED as text and only then converted. `BigInt(card.units)` would
    // accept a corrupt value and throw inside a render; a float would lose the
    // hundredth that makes 15.495 draw as 15.50.
    expect(clean).toContain('parseUnitsString');
    expect(clean).toContain('formatMoney');
    expect(clean).not.toMatch(/Number\(card\./);
    // A card with no code is the unit-less group, and `formatMoney` is the one
    // place that renders the bare amount rather than inventing a unit.
    expect(clean).toContain('formatMoney(card.code,');
  });

  it('SpendSummary.svelte renders zip-derived codes as TEXT, never as markup', () => {
    const clean = stripComments(code(BLOCK_FILE));

    // T-05-46: a currency code and a game code are untrusted text from a zip.
    // Interpolation escapes them, a raw-HTML tag would not.
    expect(clean).not.toContain('{@html');
    // No inline style attribute or directive: a per-element colour would be a
    // per-element place for an untrusted value to reach the CSSOM.
    expect(clean).not.toMatch(/\bstyle="/);
    expect(clean).not.toMatch(/\bstyle:[a-zA-Z-]+=/);
    // No motion, and no `viewBox`: nothing here is drawn.
    expect(clean).not.toContain('viewBox');
    expect(clean).not.toContain('transition:');
    expect(clean).not.toContain('animation:');
  });

  it('SpendSummary.svelte uses native disclosure and native tables with captions', () => {
    const clean = stripComments(code(BLOCK_FILE));

    // D-22: a native `details` with no `open` attribute, because the
    // breakdown is a view of rows already on screen rather than a control the
    // reader needs to find before the card means anything. The `bind:open` of
    // the per-chart currency blocks is deliberately NOT copied: five cards
    // would then need five independent flags.
    expect(clean).toContain('<details');
    expect(clean).not.toMatch(/<details[^>]*\sopen/);
    expect(clean).toContain('<summary>');
    // Native table semantics: a caption a screen reader announces, and `th`
    // cells carrying `scope` so a column header belongs to its column.
    expect(clean).toContain('<table');
    expect(clean).toContain('<caption');
    expect(clean).toContain('scope="col"');
    expect(clean).toContain('</table>');
  });

  it('SpendSummary.svelte never conditions a headline on anything but a card', () => {
    const clean = stripComments(code(BLOCK_FILE));

    // T-05-45, the one structural half of the no-blended guarantee. There is
    // exactly ONE place a `spend-total` is created, it is inside the `{#each}`
    // over cards, and there is no second total, grand total or converted
    // figure anywhere in the file. The arithmetic half is 05-04's (the view has
    // no cross-currency field); this is the half that renders.
    const totalHooks = clean.match(/data-testid="spend-total"/g) ?? [];
    expect(totalHooks).toHaveLength(1);
    // And it lives inside the card loop: the each-block and the hook are within
    // the same window, so a total hoisted above the list would fail here.
    const eachAt = clean.indexOf('{#each readyView.cards');
    const totalAt = clean.indexOf('data-testid="spend-total"');
    const eachEnd = clean.indexOf('{/each}', eachAt);
    expect(eachAt).toBeGreaterThan(-1);
    expect(eachAt).toBeLessThan(totalAt);
    expect(totalAt).toBeLessThan(eachEnd);
    // No formatter is given more than one card's code and another's units, and
    // nothing on the file sums across the list.
    expect(clean).not.toContain('grand');
    expect(clean).not.toMatch(/\.reduce\(/);
  });
});
