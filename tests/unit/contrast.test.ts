import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, relativeLuminance } from '../helpers/contrast.ts';

// =============================================================================
// The nav hover surface — the colour contract, and the arithmetic behind it
// (W-03, an amendment to 03-UI-SPEC.md's Color table).
// =============================================================================
//
// The Color table is the approved contract, so a value in it that no check
// verifies is a value that can quietly be wrong. The row it got wrong was
// "Nav hover surface": `#ffffff` on a `#f7f7fa` nav, justified by rejecting
// the Phase 2 `#f1f3f4` as "near-invisible on that surface". Both are
// invisible — 1.069:1 and 1.041:1 — so the rationale rejected a value and
// then shipped an equivalent one, and the hover affordance was absent.
//
// Two assertions, because either alone is satisfiable by a regression in
// the other:
//   1. the colour in DashboardNav.svelte IS the colour the spec declares,
//      so the contract cannot be amended in one place only, and
//   2. the shipped pair clears 1.20:1, so a future change to another
//      near-invisible grey fails even if the spec is amended with it.
//
// Both read from disk rather than importing a token module: the colours are
// hand-authored hex in component stylesheets by design (the build-time CSP
// forbids inline styles), so there is no module for them to live in and a
// re-exported constant would only assert that a constant equals itself.
//
// The Activity data ramp (04-UI-SPEC Color) is the second such contract, and it
// is declared in `src/app.css` rather than in a component stylesheet for the
// same reason: six hand-authored hex values that four components read as
// `var(--ramp-N)` have exactly one place to be wrong in, and a ramp is a
// *sequence*, so a drift in one step silently breaks the monotonicity the
// scale rule depends on. The Color table stays the contract; these tests make
// the stylesheet and the spec agree, and make the recorded ratios true rather
// than merely stated — the W-03 lesson, applied to a six-step ramp instead of
// a single hover surface.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NAV_SOURCE = readFileSync(
  path.join(REPO_ROOT, 'src/lib/components/DashboardNav.svelte'),
  'utf8',
);
const UI_SPEC = readFileSync(
  path.join(REPO_ROOT, '.planning/phases/03-dashboard-shell-account-identity/03-UI-SPEC.md'),
  'utf8',
);
const PHASE4_UI_SPEC = readFileSync(
  path.join(REPO_ROOT, '.planning/phases/04-activity-time-dashboards/04-UI-SPEC.md'),
  'utf8',
);
const APP_CSS = readFileSync(path.join(REPO_ROOT, 'src/app.css'), 'utf8');

/**
 * A hover has to be SEEN, not merely specified. 1.20:1 is the floor the
 * Color table's rationale is argued from: the rejected `#f1f3f4` (1.041:1)
 * and the shipped `#ffffff` (1.069:1) are both below it, the approved
 * `#dadce0` (1.284:1) is above it.
 */
const MIN_HOVER_CONTRAST = 1.2;

/** The declared value of a `| <label> | <value> | … |` row in the Color table. */
function specTableValue(label: string): string {
  const row = UI_SPEC.split('\n').find((line) => line.startsWith(`| ${label} |`));
  if (row === undefined) throw new Error(`no "${label}" row in the 03-UI-SPEC Color table`);
  const cell = row.split('|')[2] ?? '';
  const hex = cell.match(/#[0-9a-f]{6}/i);
  if (hex === null) throw new Error(`the "${label}" row declares no hex colour: ${row}`);
  return hex[0].toLowerCase();
}

/** The `background:` of the first declaration block whose selector matches. */
function cssBackground(selector: string): string {
  const rule = NAV_SOURCE.match(new RegExp(`(?:^|\\n)\\s*${selector}\\s*\\{([^}]*)\\}`));
  if (rule === null) throw new Error(`no "${selector}" rule in DashboardNav.svelte`);
  const value = rule[1].match(/background:\s*(#[0-9a-f]{3,6})/i);
  if (value === null) throw new Error(`the "${selector}" rule declares no hex background`);
  return value[1].toLowerCase();
}

describe('contrastRatio', () => {
  test('is the WCAG maximum for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  test('is 1 for a colour against itself, whatever that colour is', () => {
    for (const hex of ['#ffffff', '#dadce0', '#f7f7fa', '#1a73e8']) {
      expect(contrastRatio(hex, hex)).toBe(1);
    }
  });

  test('does not depend on argument order', () => {
    expect(contrastRatio('#dadce0', '#f7f7fa')).toBe(contrastRatio('#f7f7fa', '#dadce0'));
  });

  test('accepts the 3-digit form as its own expansion', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  test('is case-insensitive, because the stylesheets are not consistent', () => {
    expect(contrastRatio('#DADCE0', '#f7f7fa')).toBe(contrastRatio('#dadce0', '#f7f7fa'));
  });

  test('reproduces the ratios the Color table is argued from', () => {
    // The numbers in the amended rationale, computed rather than trusted.
    expect(contrastRatio('#ffffff', '#f7f7fa')).toBeCloseTo(1.069, 2);
    expect(contrastRatio('#f1f3f4', '#f7f7fa')).toBeCloseTo(1.041, 2);
    expect(contrastRatio('#dadce0', '#f7f7fa')).toBeCloseTo(1.284, 2);
  });

  test('rejects anything that is not #rgb or #rrggbb', () => {
    // A silently-parsed-as-black typo would make an invisible hover pass.
    for (const bad of ['white', 'rgb(255,255,255)', '#ffff', '#gggggg', '', 'f7f7fa']) {
      expect(() => contrastRatio(bad, '#ffffff')).toThrow(/not a #rgb or #rrggbb colour/);
    }
  });

  test('relativeLuminance spans black to white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('nav hover surface (W-03)', () => {
  test('the code ships the colour the Color table declares', () => {
    expect(cssBackground('a:hover')).toBe(specTableValue('Nav hover surface'));
  });

  test('the link-state table declares the same hover background', () => {
    // The same colour is specified twice — once in the Color table and once
    // in the nav's link-state table. A one-sided amendment is the drift
    // this assertion exists to make impossible.
    const hoverRow = UI_SPEC.split('\n').find((line) => line.startsWith('| Hover |'));
    expect(hoverRow).toBeDefined();
    expect(hoverRow).toContain(cssBackground('a:hover'));
  });

  test('the shipped pair clears the floor a hover has to clear', () => {
    const surface = cssBackground('nav');
    expect(contrastRatio(cssBackground('a:hover'), surface)).toBeGreaterThanOrEqual(
      MIN_HOVER_CONTRAST,
    );
  });

  test('the two colours the rationale rejects are below the floor', () => {
    // Pins the arithmetic that amended the Color table, so the rationale
    // cannot be re-argued from a number that was never measured.
    const surface = cssBackground('nav');
    expect(contrastRatio('#ffffff', surface)).toBeLessThan(MIN_HOVER_CONTRAST);
    expect(contrastRatio('#f1f3f4', surface)).toBeLessThan(MIN_HOVER_CONTRAST);
  });

  test('the spec and the component agree on the nav surface itself', () => {
    // The contrast above is only meaningful against the surface the
    // component actually paints, so that surface is pinned to the spec too.
    expect(cssBackground('nav')).toBe(specTableValue('Secondary (30%)'));
  });
});

// =============================================================================
// The Activity data ramp — six steps declared once (04-04-PLAN Task 1)
// =============================================================================
//
// The W-03 precedent, applied to a ramp. Three directions are pinned, because
// each one alone is satisfiable by a regression in another:
//
//   1. SPEC → CODE: the six `--ramp-N` declarations in src/app.css are the six
//      values the Color table records, level for level, so the ramp cannot be
//      amended in the stylesheet alone.
//   2. RATIONALE → CODE: every recorded ratio is recomputed from the shipped
//      hex, so a table that records 1.14 while the code ships something 1.20
//      fails here rather than in a review nobody reads. (W-03 exists because
//      exactly that shipped once.)
//   3. CODE → FLOOR: the monotonicity, the adjacent-step separation and the
//      4.5:1 / 7:1 text-readability floors are asserted from the arithmetic, so
//      a future amendment of the table that keeps it internally consistent but
//      breaks the guarantee still fails.
//
// The hex values are parsed out of the spec rather than repeated as literals
// here, for the reason the nav tests give: a repeated literal asserts that a
// literal equals itself, and the whole point is that one of the two is wrong.
// =============================================================================

/** One row of the 04-UI-SPEC Data ramp table: the level, its hex, its recorded
 *  ratio on white, and its recorded ratio to the previous level. */
type RampStep = {
  level: number;
  hex: string;
  onWhite: number;
  fromPrevious: number | null;
};

/**
 * The six Data ramp rows, parsed from 04-UI-SPEC.md.
 *
 * Rows are matched on the leading `| <n> |` of a table row so the parse cannot
 * silently pick up a number from another table in the same file; the level
 * sequence is asserted to be 0..5 so a re-ordered or duplicated row is a
 * failure, not a shorter ramp.
 */
function specRamp(): RampStep[] {
  const rows = PHASE4_UI_SPEC.split('\n').filter((line) => /^\|\s*[0-5]\s*\|/.test(line));
  const steps = rows.map((row): RampStep => {
    const cells = row.split('|').slice(1, -1);
    const hex = cells[2]?.match(/#[0-9a-f]{6}/i)?.[0];
    if (hex === undefined) throw new Error(`ramp row declares no hex colour: ${row}`);
    const fromPrevious = cells[4]?.trim() ?? '';
    return {
      level: Number(cells[0]?.trim()),
      hex: hex.toLowerCase(),
      onWhite: Number(cells[3]?.trim()),
      // Level 0 records an em dash: it has no previous step to be a ratio of.
      fromPrevious: fromPrevious === '' || fromPrevious === '—' ? null : Number(fromPrevious),
    };
  });
  if (steps.length !== 6)
    throw new Error(`expected 6 ramp rows in 04-UI-SPEC, found ${steps.length}`);
  steps.forEach((step, index) => {
    if (step.level !== index) throw new Error(`ramp row ${index} declares level ${step.level}`);
  });
  return steps;
}

/** The six `--ramp-N: <hex>;` declarations in src/app.css, keyed by level. */
function appCssRamp(): Map<number, string> {
  const ramp = new Map<number, string>();
  for (const match of APP_CSS.matchAll(/--ramp-([0-5])\s*:\s*(#[0-9a-f]{3,6})\s*;/gi)) {
    ramp.set(Number(match[1]), match[2].toLowerCase());
  }
  return ramp;
}

describe('playtime data ramp (04-UI-SPEC Color)', () => {
  test('the code ships the ramp the Color table declares, level for level', () => {
    const css = appCssRamp();
    expect([...css.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (const step of specRamp()) {
      expect(css.get(step.level)).toBe(step.hex);
    }
  });

  test('every recorded ratio to white is true of the shipped hex', () => {
    // The table's numbers are arguments, not facts. W-03 shipped a rationale
    // that rejected 1.041:1 and then shipped 1.069:1; recomputing the figure
    // is what makes that class of error impossible here.
    for (const step of specRamp()) {
      expect(contrastRatio(step.hex, '#ffffff')).toBeCloseTo(step.onWhite, 1);
    }
  });

  test('every recorded ratio to the previous step is true of the shipped hex', () => {
    const steps = specRamp();
    steps.forEach((step, index) => {
      if (step.fromPrevious === null) return;
      const previous = steps[index - 1];
      expect(previous).toBeDefined();
      // The table's column is the ratio of the two steps' contrast on white,
      // i.e. how much further each step recedes from the page.
      const recorded = contrastRatio(step.hex, '#ffffff') / contrastRatio(previous.hex, '#ffffff');
      expect(recorded).toBeCloseTo(step.fromPrevious, 1);
    });
  });

  test('lightness is strictly monotonic, so more play is always darker', () => {
    // The Scale rule (D-04) is rank-based, so the only channel carrying "more"
    // is darkness. An equal-luminance pair would make two ranks identical.
    const luminances =
      appCssRamp().get(0) === undefined
        ? []
        : [0, 1, 2, 3, 4, 5].map((level) => relativeLuminance(appCssRamp().get(level) as string));
    expect(luminances).toHaveLength(6);
    for (let i = 1; i < luminances.length; i += 1) {
      expect(luminances[i]).toBeLessThan(luminances[i - 1]);
    }
  });

  test('adjacent steps are separated by at least 1.25:1 against each other', () => {
    // Two neighbouring shades have to be tellable apart, not only
    // distinguishable from the page. This is the floor the Color table's
    // "levels 1-3 are below 3:1 by design" note is argued from: a sequential
    // ramp may sit close to white at the low end, but two adjacent cells must
    // still differ by a visible amount.
    for (let level = 1; level <= 5; level += 1) {
      const lower = appCssRamp().get(level - 1) as string;
      const upper = appCssRamp().get(level) as string;
      expect(contrastRatio(lower, upper)).toBeGreaterThanOrEqual(1.25);
    }
  });

  test('the two darkest levels clear the text-readability floors on white', () => {
    // Levels 0-3 are chart fills that carry their value in a tooltip and an
    // aria-label, so a low ratio is the documented trade. Levels 4 and 5 are
    // the shades reused for the duration bar fill and the darkest cells, which
    // is where a bar's edge stops being visible against the card.
    expect(contrastRatio(appCssRamp().get(4) as string, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(appCssRamp().get(5) as string, '#ffffff')).toBeGreaterThanOrEqual(7);
  });

  test('the contrast pairs the Color table records for the other chrome', () => {
    // "Other colour uses" pairs, recomputed rather than trusted. Each entry is
    // [foreground, background, recorded ratio] exactly as the table states it.
    const RECORDED_PAIRS: ReadonlyArray<readonly [string, string, number]> = [
      ['#ffffff', '#3c4043', 10.47], // Tooltip: white text on the neutral surface
      ['#8a5a00', '#fef7e0', 5.53], // Excluded-row pill: amber text on its own bg
      ['#8a1c17', '#fce8e6', 7.89], // Error message: destructive text on its own bg
      ['#5f6368', '#f7f7fa', 5.66], // Tile surface: muted text on the tile
      ['#1a73e8', '#ffffff', 4.5], // Focus ring: accent against the card
    ];
    for (const [fg, bg, recorded] of RECORDED_PAIRS) {
      expect(contrastRatio(fg, bg)).toBeCloseTo(recorded, 1);
    }
  });

  test('no component stylesheet restates a ramp step as a literal hex', () => {
    // Vacuously true today (the ramp has no consumers until 04-09/04-10) and
    // it is here to be the tripwire: six hand-authored hex in each chart
    // component would be six chances to drift from this table, and the reader
    // would have no way to tell which copy is authoritative. Charts read
    // var(--ramp-N).
    const componentDir = path.join(REPO_ROOT, 'src/lib/components');
    const offenders: string[] = [];
    for (const name of readdirSync(componentDir)) {
      if (!name.endsWith('.svelte')) continue;
      const source = readFileSync(path.join(componentDir, name), 'utf8');
      for (const step of specRamp()) {
        if (new RegExp(step.hex, 'i').test(source)) offenders.push(`${name}: ${step.hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
