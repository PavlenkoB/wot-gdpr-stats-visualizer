import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, relativeLuminance } from '../../helpers/contrast.ts';
import { componentPath, listComponentFiles } from '../../helpers/components.ts';

// =============================================================================
// Colour contracts, and the arithmetic behind them
// =============================================================================
//
// The Color tables are the approved contracts, so a value in one that no check
// verifies is a value that can quietly be wrong. The W-03 lesson (a hover
// surface rejected as "near-invisible" and then replaced by an equivalent one,
// 1.069:1) is why recorded ratios are recomputed from the shipped hex here
// rather than trusted. The anchor nav that W-03 was about is gone (phase 8,
// D-02); the row hover, selected and muted pairs of the Day 10 neutrals are the
// current contract, in the last block of this file.
//
// These tests read from disk rather than importing a token module: the colours
// are hand-authored hex in component stylesheets and src/app.css by design (the
// build-time CSP forbids inline styles), so there is no module for them to live
// in and a re-exported constant would only assert that a constant equals itself.
//
// The Activity data ramp (04-UI-SPEC Color) is the first such contract, and it
// is declared in `src/app.css` rather than in a component stylesheet for the
// same reason: six hand-authored hex values that four components read as
// `var(--ramp-N)` have exactly one place to be wrong in, and a ramp is a
// *sequence*, so a drift in one step silently breaks the monotonicity the
// scale rule depends on. The Color table stays the contract; these tests make
// the stylesheet and the spec agree, and make the recorded ratios true rather
// than merely stated — the W-03 lesson, applied to a six-step ramp instead of
// a single hover surface.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PHASE4_UI_SPEC = readFileSync(
  path.join(
    REPO_ROOT,
    '.planning/milestones/v1.0-phases/04-activity-time-dashboards/04-UI-SPEC.md',
  ),
  'utf8',
);
const APP_CSS = readFileSync(path.join(REPO_ROOT, 'src/app.css'), 'utf8');

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
    const offenders: string[] = [];
    for (const name of listComponentFiles()) {
      if (!name.endsWith('.svelte')) continue;
      const source = readFileSync(componentPath(name), 'utf8');
      for (const step of specRamp()) {
        if (new RegExp(step.hex, 'i').test(source)) offenders.push(`${name}: ${step.hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// =============================================================================
// The flow data colours — two marks, deliberately hard to tell apart (05-08)
// =============================================================================
//
// `--flow-in` and `--flow-out` are the first data colours in this app that
// are NOT a lightness ramp, and the first pair chosen to sit close together.
// The ramp's rule — one direction of lightness, one colour per rank — does not
// fit a diverging chart, where the meaning is side of the line rather than
// size. So the two hues are 1.36:1 apart, which is close enough to look like a
// mistake and far enough apart to read.
//
// The consequence drives the whole design: a pair this close must never be the
// only cue. Section 8's tooltip, the legend words, the side of the zero line
// and the monthly table all carry the same meaning in text, so the colours are
// allowed to be subtle precisely because nothing depends on them alone. That
// is why these are declared in app.css and read as `var(--flow-in)` — a
// component restating `#4c3fa6` would create a second copy of the contract
// with no way to tell which is authoritative, which is the same failure the
// ramp tests above were written to prevent.
//
// The 3:1 floor is the non-text-content minimum from WCAG 1.4.11: these are
// marks carrying information, and the recorded ratios are recomputed here
// rather than trusted, because a table that records a number nobody measured is
// the W-03 failure again.
// =============================================================================

const PHASE5_UI_SPEC = readFileSync(
  path.join(
    REPO_ROOT,
    '.planning/milestones/v1.0-phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md',
  ),
  'utf8',
);

/** The two surfaces these marks are measured against: a card and the tile. */
const FLOW_SURFACES: ReadonlyArray<readonly [string, string]> = [
  ['#ffffff', 'white card'],
  ['#f1f3f4', 'hover surface'],
];

/** Non-text content must clear this (WCAG 1.4.11). */
const MIN_FLOW_CONTRAST = 3;

/**
 * One flow row of the 05-UI-SPEC Color table: the token name, its hex, and the
 * two ratios the table records (on white, then on the hover surface).
 */
type FlowStep = {
  token: string;
  hex: string;
  onWhite: number;
  onHover: number;
};

function specFlow(): FlowStep[] {
  const steps: FlowStep[] = [];
  for (const token of ['--flow-in', '--flow-out']) {
    const row = PHASE5_UI_SPEC.split('\n').find((line) => line.startsWith(`| \`${token}\` |`));
    if (row === undefined) throw new Error(`no "${token}" row in the 05-UI-SPEC Color table`);
    const hex = row.match(/#[0-9a-f]{6}/i)?.[0];
    if (hex === undefined) throw new Error(`the "${token}" row declares no hex colour: ${row}`);
    // The two ratio cells are the trailing `8.17:1` / `7.34:1` values.
    const ratios = [...row.matchAll(/([0-9]+\.[0-9]+):1/g)].map((m) => Number(m[1]));
    if (ratios.length !== 2)
      throw new Error(`the "${token}" row records ${ratios.length} ratios: ${row}`);
    steps.push({ token, hex: hex.toLowerCase(), onWhite: ratios[0], onHover: ratios[1] });
  }
  return steps;
}

function appCssFlow(): Map<string, string> {
  const declared = new Map<string, string>();
  for (const match of APP_CSS.matchAll(/(--flow-(?:in|out))\s*:\s*(#[0-9a-f]{3,6})\s*;/gi)) {
    declared.set(match[1], match[2].toLowerCase());
  }
  return declared;
}

describe('flow data colours (05-UI-SPEC Color)', () => {
  test('the code ships the colours the Color table declares', () => {
    const css = appCssFlow();
    expect([...css.keys()].sort()).toEqual(['--flow-in', '--flow-out']);
    for (const step of specFlow()) {
      expect(css.get(step.token)).toBe(step.hex);
    }
  });

  test('each token is declared exactly once', () => {
    // A second declaration is either a silent override or a copy that will
    // drift; `:root` is the only place a phase data colour belongs.
    for (const token of ['--flow-in', '--flow-out']) {
      expect(APP_CSS.match(new RegExp(`${token}\\s*:`, 'g'))?.length).toBe(1);
    }
  });

  test('every recorded ratio on both surfaces is true of the shipped hex', () => {
    for (const step of specFlow()) {
      expect(contrastRatio(step.hex, '#ffffff')).toBeCloseTo(step.onWhite, 2);
      expect(contrastRatio(step.hex, '#f1f3f4')).toBeCloseTo(step.onHover, 2);
    }
  });

  test('both clear the 3:1 non-text floor on both surfaces', () => {
    for (const step of specFlow()) {
      for (const [surface] of FLOW_SURFACES) {
        expect(contrastRatio(step.hex, surface)).toBeGreaterThanOrEqual(MIN_FLOW_CONTRAST);
      }
    }
  });

  test('neither is a ramp step or the accent', () => {
    // These are two new hues, not two more rungs. A collision would make a
    // flow mark indistinguishable from a playtime cell or from a focus ring,
    // and the ramp's monotonic scale would silently gain a rung.
    const taken = new Set([...appCssRamp().values(), '#1a73e8']);
    for (const step of specFlow()) {
      expect(taken.has(step.hex)).toBe(false);
    }
  });

  test('the two are about 1.36:1 apart, close enough to need the text cues', () => {
    // The separation is a design fact, not an accident: it is why the legend
    // words, the zero line and the tooltip all restate the meaning. Asserting
    // it means a future "let's just make them clearly different" change has to
    // be a deliberate act in the spec, not a quiet edit to app.css.
    const [inflow, outflow] = specFlow();
    expect(contrastRatio(inflow.hex, outflow.hex)).toBeCloseTo(1.36, 2);
  });

  test('no component stylesheet restates either as a literal hex', () => {
    const offenders: string[] = [];
    for (const name of listComponentFiles()) {
      if (!name.endsWith('.svelte')) continue;
      const source = readFileSync(componentPath(name), 'utf8');
      for (const step of specFlow()) {
        if (new RegExp(step.hex, 'i').test(source)) offenders.push(`${name}: ${step.hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// =============================================================================
// The chart frame strokes — the W-03 method, applied to the zero line
// (05-UI-REVIEW top fix 2, UAT G-05-9)
// =============================================================================
//
// The same argument as the nav hover, one object over. The Color table declares
// the zero line `#5f6368` and the two plot-bound hairlines `#dadce0`, and the
// component shipped `#dadce0` for the zero line and an off-palette `#e8eaed` for
// the hairlines — so the chart painted its most important non-colour cue at
// 1.37:1, on a chart whose whole argument is that two hues 1.41:1 apart are NOT
// the only thing separating a deposit from a withdrawal. The zero line is the
// load-bearing part of that argument, so a light grey zero line is a missed
// contract rather than decoration.
//
// Comments are stripped before the stylesheet is read, because the rules now
// carry a comment naming the spec row — and that comment contains the hexes.
// Reading it without stripping would assert a comment against itself.
// =============================================================================

const MONTHLY_BAR_CHART = readFileSync(
  path.join(REPO_ROOT, 'src/lib/charts/MonthlyBarChart.svelte'),
  'utf8',
);

/** `/* … *\/`, so a comment cannot satisfy a rule about the declaration. */
function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * One row of the 05-UI-SPEC Color table: the zero line's hex, the hairlines'
 * hex, and the ratio the table records against white.
 */
type FrameStep = { zeroLine: string; hairline: string; onWhite: number };

function specFrame(): FrameStep {
  // The CONTRACT, not the amendments: later appendices record history and must
  // not be able to satisfy a test about what the chart must paint.
  const contract = PHASE5_UI_SPEC.split('\n## Amendments')[0] ?? '';
  const row = contract
    .split('\n')
    .find((line) => line.startsWith('| Chart zero line / bound lines |'));
  if (row === undefined) {
    throw new Error('no "Chart zero line / bound lines" row in the 05-UI-SPEC Color table');
  }
  const hexes = [...row.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase());
  if (hexes.length !== 2) {
    throw new Error(`the frame row declares ${hexes.length} hexes, expected two: ${row}`);
  }
  const ratio = row.match(/([0-9]+\.[0-9]+):1/)?.[1];
  if (ratio === undefined) {
    throw new Error(`the frame row records no contrast ratio: ${row}`);
  }
  return { zeroLine: hexes[0]!, hairline: hexes[1]!, onWhite: Number(ratio) };
}

/** The `--name: #hex;` custom property declared in src/app.css, lowercase. */
function appCssToken(name: string): string {
  const match = APP_CSS.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-f]{3,6})\\s*;`, 'i'));
  if (match === null) {
    throw new Error(`src/app.css declares no ${name} token`);
  }
  return match[1].toLowerCase();
}

/**
 * The raw `stroke:` value declared by the first rule whose selector matches:
 * a hex or a `var(--name)` read.
 */
function chartStrokeValue(selector: string): string {
  const rule = stripCssComments(MONTHLY_BAR_CHART).match(
    new RegExp(`(?:^|\\n)\\s*${selector}\\s*\\{([^}]*)\\}`),
  );
  if (rule === null) {
    throw new Error(`no "${selector}" rule in MonthlyBarChart.svelte`);
  }
  const value = rule[1].match(/stroke:\s*(#[0-9a-f]{3,6}|var\(--[a-z-]+\))/i);
  if (value === null) {
    throw new Error(`the "${selector}" rule declares no hex or var() stroke`);
  }
  return value[1].toLowerCase();
}

/** The `stroke:` of a rule as a lowercase hex, resolving a `var(--name)` read. */
function chartStroke(selector: string): string {
  const value = chartStrokeValue(selector);
  const token = value.match(/^var\((--[a-z-]+)\)$/);
  return token === null ? value : appCssToken(token[1]);
}

describe('chart frame strokes (05-UI-SPEC Color)', () => {
  test('the component paints the two strokes the Color table declares', () => {
    const frame = specFrame();

    // The Phase 8 muted token supersedes the 05 zero-line hex (08-UI-SPEC Hex
    // migrations): the zero line reads var(--muted) and resolves to that token.
    expect(chartStrokeValue('\\.zero-line')).toBe('var(--muted)');
    expect(chartStroke('\\.zero-line')).toBe(appCssToken('--muted'));
    expect(contrastRatio(chartStroke('\\.zero-line'), '#ffffff')).toBeGreaterThanOrEqual(
      MIN_FLOW_CONTRAST,
    );
    // quick 261009-qbo: the hairline reads var(--border) and resolves to that
    // token, which supersedes the 05 hex the same way the zero line does. The
    // two greys are within 4 of 255 on every channel (#dadce0 is a faint blue
    // grey, #dcdcdc a neutral one), so the line looks the same.
    expect(chartStrokeValue('\\.hairline')).toBe('var(--border)');
    expect(chartStroke('\\.hairline')).toBe(appCssToken('--border'));
    const rgb = (hex: string): number[] =>
      [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
    const drift = rgb(chartStroke('\\.hairline')).map((channel, index) =>
      Math.abs(channel - rgb(frame.hairline)[index]!),
    );
    expect(Math.max(...drift)).toBeLessThanOrEqual(4);
  });

  test('the zero line clears 3:1 and matches the ratio the table records', () => {
    // The recorded figure is asserted to 0.05 rather than recomputed exactly:
    // the table rounds to two decimals, and a guard that demanded the rounding
    // be reproduced would fail on a correct spec.
    const frame = specFrame();
    const measured = contrastRatio(frame.zeroLine, '#ffffff');

    expect(Math.abs(measured - frame.onWhite)).toBeLessThanOrEqual(0.05);
    // WCAG 1.4.11: the zero line IS the non-colour cue the diverging chart
    // leans on, so it is a graphic, and a graphic clears 3:1.
    expect(measured).toBeGreaterThanOrEqual(MIN_FLOW_CONTRAST);
  });

  test('the hairlines are the palette grey, not an off-palette one', () => {
    // A hairline marks the plot bound rather than separating two directions, so
    // it is held to the declared value and no further.
    expect(specFrame().hairline).toBe('#dadce0');
  });
});

// =============================================================================
// The amended copy — the user's two answers, written into the approved spec
// =============================================================================
//
// A UI-SPEC is a contract, and a contract that was approved before two
// questions were answered is a contract that is wrong in two places. These
// assertions exist because the failure mode of a spec is not a crash: it is a
// later plan reading the sentence that predates the answer and implementing
// the old behaviour confidently. Each string below is one the user chose or one
// the plan found to be factually wrong, asserted verbatim so the spec cannot be
// amended in one place and left stale in another.
//
// The compact example is the sharpest of them. The spec illustrated a 1,572
// month axis with `26.9M`, and `Intl.NumberFormat(..., { maximumFractionDigits:
// 1 })` renders 26,986,204 as `27M` — the spec's own example was unreachable
// through the formatter it named, so any test copied from it would have failed.
// =============================================================================

describe('05-UI-SPEC amended copy', () => {
  /** The spec text with the Amendments appendix removed, so a string recorded
   *  there as history cannot satisfy a test about the contract itself. */
  const contract = PHASE5_UI_SPEC.split('\n## Amendments')[0];

  test('the premium exclusion explains all three reasons a row is left out', () => {
    // A withdrawal is not a grant, and an unreadable date has no month to fall
    // in. Both were silently dropped before, which made the pill's count
    // disagree with what the chart did.
    expect(contract).toContain(
      'Rows whose premium value is not a recognisable duration or is a withdrawal, or whose date cannot be read, are not counted in the chart.',
    );
  });

  test('the premium disclosure is renamed to what it now lists', () => {
    // It lists excluded values, which is no longer only unrecognised ones: a
    // withdrawal has a perfectly readable premium string.
    expect(contract).toContain('Premium values not charted ({k})');
    expect(contract).not.toContain('Unrecognised premium values ({k})');
  });

  test('the disclosure keeps its test id, so no plan has to re-derive it', () => {
    expect(contract).toContain('premium-unrecognised');
  });

  test('the premium value rule says a withdrawal is never charted', () => {
    expect(contract).toContain('withdrawal');
    expect(contract).toMatch(/never charted/i);
  });

  test('the currency exclusion explains all three reasons a row is left out', () => {
    expect(contract).toContain(
      'Operations with an unknown type, a non-numeric amount or a date that cannot be read are not counted in any chart or total below.',
    );
  });

  test('a negative amount counts as non-numeric', () => {
    // The rule that would otherwise have been argued about: a withdrawal is
    // recorded as a negative deposit in some exports, and a chart that
    // summated it as an inflow would be quietly wrong.
    expect(contract).toMatch(/negative/i);
  });

  test('the readable-date window is stated, and bounds the axis', () => {
    expect(contract).toContain('1970 to 2100 inclusive');
    expect(contract).toContain('1,572 months');
  });

  test('the compact example is the one the named formatter actually produces', () => {
    expect(contract).toContain('27M');
    expect(contract).not.toContain('26.9M');
    // The expectation is derived from the formatter, not transcribed.
    expect(contract).toMatch(/computed from the formatter/i);
  });

  test('the ChartTooltip deviation from D-27 is recorded, not silent', () => {
    // D-27 says charts reuse ChartLegend. They do not, and a later plan
    // reading D-27 would build a ramp legend for a flow chart. The deviation
    // belongs in the spec where the decision is read.
    expect(PHASE5_UI_SPEC).toContain('D-27');
    expect(PHASE5_UI_SPEC).toContain('ChartLegend');
  });

  test('one tooltip instance per chart container, and the Financial test id', () => {
    // Two instances of the same test id would break Phase 4's unscoped
    // locators, so the second one is given a different id on purpose.
    expect(contract).toContain('finance-tooltip');
    expect(contract).toContain('chart-tooltip');
  });

  test('the amendments appendix names the decision it departs from', () => {
    // History stays readable: the delta is listed with its reason rather than
    // edited into the prose, so a reader can see what was approved and what
    // changed after.
    expect(PHASE5_UI_SPEC).toContain('## Amendments (plan 05-08)');
    const amendments = PHASE5_UI_SPEC.split('## Amendments (plan 05-08)')[1] ?? '';
    expect(amendments).toContain('D-27');
    expect(amendments).toContain('ChartLegend');
  });
});

// =============================================================================
// The 05-21 appendix — the currency plot split, pinned where it is read
// =============================================================================
//
// A superseding appendix is only worth anything if the phrases it hinges on
// stay in it. The danger is not that the appendix is deleted — a reader would
// notice — but that it is edited down to a summary and the load-bearing
// sentences go quietly: the ONE-scale statement, the quarter rule, and the note
// that the pitch belongs to another plan. Those three are what stop a later
// plan from re-deriving the split, or from assuming 05-21 took the width clause
// too and leaving it undone.
describe('05-21 amendments appendix', () => {
  /** The 05-21 section only, and only after the 05-08 one. */
  const appendix = (): string => {
    const afterFirst = PHASE5_UI_SPEC.split('## Amendments (plan 05-08)')[1] ?? '';
    const own = afterFirst.split('## Amendments (plan 05-21)')[1];
    if (own === undefined) {
      throw new Error('the 05-21 appendix is missing, or does not follow the 05-08 one');
    }
    return own;
  };

  test('it follows the plan 05-08 appendix rather than replacing it', () => {
    expect(PHASE5_UI_SPEC).toContain('## Amendments (plan 05-21)');
    expect(PHASE5_UI_SPEC.indexOf('## Amendments (plan 05-21)')).toBeGreaterThan(
      PHASE5_UI_SPEC.indexOf('## Amendments (plan 05-08)'),
    );
  });

  test('it states the one-scale honesty the split depends on', () => {
    // Without this sentence the split reads as two scales, and the whole point
    // of dividing the plot rather than scaling each side separately is that it
    // is not.
    expect(appendix()).toMatch(/ONE linear scale/);
    expect(appendix()).toMatch(/same height in every chart/);
    expect(appendix()).toContain('D-15');
    expect(appendix()).toContain('D-17');
  });

  test('it records the quarter rule and that a label may name an axis value', () => {
    expect(appendix()).toMatch(/quarter of the other side/);
    expect(appendix()).toContain('names that axis value');
  });

  test('it hands the pitch and the label stride to plan 05-22', () => {
    // The clause G-05-9 still has open, recorded so that "not here" reads as a
    // decision with an owner rather than an omission.
    expect(appendix()).toMatch(/NOT amended here/);
    expect(appendix()).toContain('05-22');
    expect(appendix()).toMatch(/pitch rule and the label stride/);
  });
});

// =============================================================================
// The 05-22 appendix — the whole-pixel pitch, pinned where it is read
// =============================================================================
//
// This appendix supersedes a rule that is still in the contract text above, so
// it has the same failure mode as 05-21's: not that it is deleted — a reader
// would notice — but that it is edited down until the sentences a later plan
// needs are gone. Four of them are load-bearing. The RULE (largest whole pixel
// from 4 to 16) is what stops someone re-deriving the four steps and calling it
// a regression. The STRIDE (24 below a pitch of 8px) is the clause that is easy
// to miss, because a stride of 12 is correct at every pitch the old ladder
// produced and quietly wrong at 5, 6 and 7. The HONESTY paragraph is what stops
// "make the charts the same width" being re-opened as a defect. And the OPTIONS
// are what stop a shared month axis — which amends D-17 — being re-proposed as
// if nobody had weighed it. The fifth test below is the other half: the
// superseded text must still be there, because a spec that rewrites its own
// history is a spec nobody can audit later.
// =============================================================================
describe('05-22 amendments appendix', () => {
  /** The 05-22 section only, and only after the 05-21 one. */
  const appendix = (): string => {
    const afterPrev = PHASE5_UI_SPEC.split('## Amendments (plan 05-21)')[1] ?? '';
    const own = afterPrev.split('## Amendments (plan 05-22)')[1];
    if (own === undefined) {
      throw new Error('the 05-22 appendix is missing, or does not follow the 05-21 one');
    }
    return own;
  };

  /** The approved contract, with every Amendments appendix removed. */
  const contract = (): string => PHASE5_UI_SPEC.split('\n## Amendments')[0];

  test('it follows the plan 05-21 appendix, which handed it the width clause', () => {
    // 05-21's item 4 recorded G-05-9's third clause as "NOT amended here" and
    // named 05-22 as its owner. If this appendix moved above that one the two
    // would read as rivals, and the clause would have no single owner again.
    expect(PHASE5_UI_SPEC).toContain('## Amendments (plan 05-22)');
    expect(PHASE5_UI_SPEC.indexOf('## Amendments (plan 05-22)')).toBeGreaterThan(
      PHASE5_UI_SPEC.indexOf('## Amendments (plan 05-21)'),
    );
    expect(appendix()).toContain('2026-10-02');
  });

  test('it states the whole-pixel pitch rule and what it supersedes', () => {
    expect(appendix()).toMatch(/largest whole pixel/);
    expect(appendix()).toMatch(/4 to 16/);
    expect(appendix()).toMatch(/576/);
    // Bar width follows the pitch rather than the old four values, so it is a
    // range now: 3px at the floor and 15px at the cap.
    expect(appendix()).toMatch(/bar width/);
    expect(appendix()).toMatch(/3 to 15px/);
    // And the two Spacing rows and the section 6 decision it replaces are named,
    // so "superseded" is a location and not a vibe.
    expect(appendix()).toContain('Chart bar pitch');
    expect(appendix()).toContain('Chart bar width');
    expect(appendix()).toContain('Pitch rule. Decision');
  });

  test('it states the label stride of 24 below a pitch of 8px', () => {
    // The clause a reader is most likely to miss: at 12 x pitch under 96px the
    // stride doubles, and 24 x 4 is exactly 96, so the gap holds everywhere.
    expect(appendix()).toMatch(/every 12 months/);
    expect(appendix()).toMatch(/every 24 months/);
    expect(appendix()).toMatch(/below a pitch of 8px/);
    expect(appendix()).toMatch(/at least 96px apart/);
    expect(appendix()).toMatch(/X axis \(D-26\)/);
  });

  test('it records that the widths are near-equal, and what would make them equal', () => {
    // D-17 and D-15 are the two decisions a reader would have to reopen to get
    // genuinely equal widths, and both are named here with the reason they were
    // not reopened: a shared month axis amends D-17, and a stretched frame draws
    // a flat zero line across months that are not in the data.
    expect(appendix()).toMatch(/own months/);
    expect(appendix()).toContain('D-17');
    expect(appendix()).toContain('D-15');
    expect(appendix()).toMatch(/never scaled/);
    expect(appendix()).toMatch(/14px/);
    expect(appendix()).toMatch(/near-equal, not equal/);
    expect(appendix()).toMatch(/shared month axis/);
    expect(appendix()).toMatch(/flat zero line/);
  });

  test('it closes G-05-9 in full, and lists what stayed the same', () => {
    // The closing sentence is the whole point of the appendix: plans 05-21 and
    // 05-22 together close all three clauses, so no later plan inherits a
    // "still open" reading of the gap.
    expect(appendix()).toContain('G-05-9');
    expect(appendix()).toMatch(/closed in full/);
    expect(appendix()).toContain('05-21');
    // And the unchanged parts, so "superseded" is not read as "rewritten".
    expect(appendix()).toMatch(/144/);
    expect(appendix()).toMatch(/node budget/);
  });

  test('the contract text it supersedes is still in the contract', () => {
    // The original wording stays above the first Amendments heading, as
    // approved. A spec that silently rewrote its own history would leave a
    // later reader unable to tell what was chosen from what was inherited.
    expect(contract()).toContain('| Chart bar pitch | 16 / 12 / 8 / 4px, chosen per chart');
    expect(contract()).toContain('| Chart bar width | pitch − 1px (15 / 11 / 7 / 3px), 1px gap |');
    expect(contract()).toContain('Pitch is the largest of 16, 12, 8, 4px');
    expect(contract()).toContain('then every 12 months (every 24 when the pitch is 4px)');
  });
});

// =============================================================================
// The country map's shading — the same six steps, now on a logarithmic scale
// (06-12, D-09, 06-UI-SPEC Color "Map shading")
// =============================================================================
//
// Phase 6 reuses the Activity ramp for the login map, so there is no new colour
// to pin. What IS new is a table of six ratios in the Phase 6 spec that a reader
// takes on trust, and a component that has to read the tokens rather than
// restate them. Four directions, for the reason the Phase 4 block gives:
//
//   1. SPEC -> CODE: the six values the Phase 6 table lists are the six
//      `--ramp-N` declarations in `src/app.css`.
//   2. RATIONALE -> CODE: each ratio the table records is recomputed from the
//      shipped hex, to the two decimals it is recorded in.
//   3. CODE -> FLOOR: lightness is strictly monotonic, the only channel that
//      carries "more logins" once the scale is logarithmic.
//   4. COMPONENT -> TOKEN: the map reads `var(--ramp-N)` for every level and
//      restates none of the six hex values. The map lives under
//      `features/logins`, which the shared component helper does not list, so it
//      is read by its own path rather than by editing that helper.
// =============================================================================

const PHASE6_UI_SPEC = readFileSync(
  path.join(
    REPO_ROOT,
    '.planning/milestones/v1.0-phases/06-login-ip-history-offline-geolocation/06-UI-SPEC.md',
  ),
  'utf8',
);

/** One row of the Phase 6 "Map shading" table: level, hex, and the recorded ratio. */
type MapShade = { level: number; token: string; hex: string; onWhite: number };

/**
 * The six rows of the Phase 6 Map shading table.
 *
 * Matched on the `--ramp-N` token in the second cell, so a number from another
 * table in the same file cannot be picked up, and the level sequence is asserted
 * to be 0 to 5 so a re-ordered or duplicated row is a failure and not a shorter
 * ramp.
 */
function phase6Shades(): MapShade[] {
  const rows = PHASE6_UI_SPEC.split('\n').filter((line) =>
    /^\|\s*[0-5]\s*\|\s*`--ramp-[0-5]`/.test(line),
  );
  const shades = rows.map((row): MapShade => {
    const cells = row.split('|').slice(1, -1);
    const hex = cells[2]?.match(/#[0-9a-f]{6}/i)?.[0];
    if (hex === undefined) throw new Error(`map shading row declares no hex colour: ${row}`);
    return {
      level: Number(cells[0]?.trim()),
      token: cells[1]?.replace(/`/g, '').trim() ?? '',
      hex: hex.toLowerCase(),
      onWhite: Number.parseFloat(cells[3]?.trim() ?? ''),
    };
  });
  if (shades.length !== 6) {
    throw new Error(`expected 6 map shading rows in 06-UI-SPEC, found ${shades.length}`);
  }
  shades.forEach((shade, index) => {
    if (shade.level !== index)
      throw new Error(`map shading row ${index} declares level ${shade.level}`);
  });
  return shades;
}

describe('the login map ramp pairs (06-UI-SPEC Color, Map shading)', () => {
  test('the six pairs the spec records are the six shipped declarations, token for token', () => {
    const css = appCssRamp();
    for (const shade of phase6Shades()) {
      expect(shade.token).toBe(`--ramp-${shade.level}`);
      expect(css.get(shade.level)).toBe(shade.hex);
    }
  });

  test('every recorded ratio on white is true of the shipped hex', () => {
    const recorded = phase6Shades().map((shade) => shade.onWhite);
    // The values the contract states, written out so a spec edit that keeps the
    // table self-consistent but changes the claim still fails here.
    expect(recorded).toEqual([1.14, 1.49, 1.95, 2.87, 5.13, 9.38]);
    for (const [level, ratio] of recorded.entries()) {
      const hex = appCssRamp().get(level) as string;
      expect(contrastRatio(hex, '#ffffff')).toBeCloseTo(ratio, 2);
    }
  });

  test('lightness is strictly monotonic, so a darker country always means more logins', () => {
    const luminances = [0, 1, 2, 3, 4, 5].map((level) =>
      relativeLuminance(appCssRamp().get(level) as string),
    );
    for (let i = 1; i < luminances.length; i += 1) {
      expect(luminances[i]).toBeLessThan(luminances[i - 1]!);
    }
  });

  test('steps 1 to 3 sit below the 3:1 non-text floor, which is why no shade is the only carrier', () => {
    // The relief rule is invoked because of exactly this: if a future ramp
    // cleared the floor, the text-equivalents would still be required, but the
    // spec's stated reason for them would be false.
    for (const level of [1, 2, 3]) {
      expect(contrastRatio(appCssRamp().get(level) as string, '#ffffff')).toBeLessThan(3);
    }
    for (const level of [4, 5]) {
      expect(contrastRatio(appCssRamp().get(level) as string, '#ffffff')).toBeGreaterThanOrEqual(3);
    }
  });

  test('the map component reads var(--ramp-N) for every level and restates no ramp hex', () => {
    const source = readFileSync(
      path.join(REPO_ROOT, 'src/lib/features/logins/WorldMap.svelte'),
      'utf8',
    );
    for (let level = 0; level <= 5; level += 1) {
      expect(source).toContain(`var(--ramp-${level})`);
    }
    for (const shade of phase6Shades()) {
      expect(source.toLowerCase(), `WorldMap restates ${shade.hex}`).not.toContain(shade.hex);
    }
  });

  test('the legend reuses the shared component, whose swatches read the same tokens', () => {
    const legend = readFileSync(path.join(REPO_ROOT, 'src/lib/charts/ChartLegend.svelte'), 'utf8');
    for (let level = 0; level <= 5; level += 1) {
      expect(legend).toContain(`var(--ramp-${level})`);
    }
    const section = readFileSync(
      path.join(REPO_ROOT, 'src/lib/features/logins/LoginMapSection.svelte'),
      'utf8',
    );
    expect(section).toContain('<ChartLegend');
    expect(section).toContain('testId="map-legend"');
  });
});

// =============================================================================
// Day 10 neutrals (08-01)
// =============================================================================
//
// Phase 8 adds a neutral chrome palette beside the data colours. The 08-UI-SPEC
// Build Notes code block is the contract; `src/app.css` is its implementation;
// these tests make the two agree and make the recorded ratios true rather than
// merely stated (the W-03 lesson, again). The data colours do not move, so the
// ramp and flow declarations are re-pinned here as a tripwire against a token
// edit that "tidies" them.
const PHASE8_UI_SPEC = readFileSync(
  path.join(
    REPO_ROOT,
    '.planning/milestones/v1.0-phases/08-master-detail-ui-redesign/08-UI-SPEC.md',
  ),
  'utf8',
);

/** The `--name: value;` lines of the first css block under "Build Notes". */
function phase8SpecTokens(): Map<string, string> {
  const notes = PHASE8_UI_SPEC.slice(PHASE8_UI_SPEC.indexOf('## Build Notes'));
  const block = notes.match(/```css\n([\s\S]*?)```/);
  if (block === null) throw new Error('no css block under Build Notes in 08-UI-SPEC.md');
  const tokens = new Map<string, string>();
  for (const line of (block[1] ?? '').matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(line[1] as string, (line[2] as string).trim().toLowerCase());
  }
  return tokens;
}

/** Every `--name: value;` declared in the `:root` rule of src/app.css. */
function appCssRootTokens(): Map<string, string> {
  const root = APP_CSS.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (root === null) throw new Error('no :root rule in src/app.css');
  const body = (root[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = new Map<string, string>();
  for (const line of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(line[1] as string, (line[2] as string).trim().toLowerCase());
  }
  return tokens;
}

describe('Day 10 neutrals (08-01)', () => {
  const NEUTRAL_TOKENS = [
    '--page',
    '--list',
    '--card',
    '--border',
    '--faint',
    '--ink',
    '--text',
    '--muted',
    '--sel',
    '--hover',
    '--chip',
    '--track',
    '--focus',
    '--radius-card',
    '--radius-control',
  ];

  test('the Build Notes block declares all fifteen tokens', () => {
    const spec = phase8SpecTokens();
    for (const token of NEUTRAL_TOKENS) {
      expect(spec.has(token), `${token} missing from the 08-UI-SPEC Build Notes`).toBe(true);
    }
  });

  test('every neutral token in :root equals the spec value', () => {
    const spec = phase8SpecTokens();
    const css = appCssRootTokens();
    for (const token of NEUTRAL_TOKENS) {
      expect(css.get(token), `${token} in src/app.css`).toBe(spec.get(token));
    }
  });

  test('the data colours are untouched', () => {
    const css = appCssRootTokens();
    expect(
      [0, 1, 2, 3, 4, 5].map((level) => css.get(`--ramp-${level}`)),
      'the six --ramp declarations',
    ).toEqual(['#eef0f2', '#b2dcd4', '#7cc7bc', '#43a89c', '#1f7a74', '#0d4f4c']);
    expect(css.get('--flow-in')).toBe('#4c3fa6');
    expect(css.get('--flow-out')).toBe('#a14a00');
  });

  test('the page reads the neutrals, not literals', () => {
    const root = (APP_CSS.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(root).toMatch(/(?:^|\n)\s*color:\s*var\(--text\);/);
    expect(root).toMatch(/(?:^|\n)\s*background:\s*var\(--page\);/);
  });

  describe('recorded ratios', () => {
    const t = (name: string): string => phase8SpecTokens().get(name) as string;

    test.each([
      { label: 'ink on page', fg: '--ink', bg: '--page', ratio: 18.88 },
      { label: 'text on page', fg: '--text', bg: '--page', ratio: 11.37 },
      { label: 'muted on page', fg: '--muted', bg: '--page', ratio: 6.69 },
      { label: 'muted on list', fg: '--muted', bg: '--list', ratio: 6.13 },
      { label: 'muted on selected', fg: '--muted', bg: '--sel', ratio: 5.07 },
      { label: 'muted on hover', fg: '--muted', bg: '--hover', ratio: 5.66 },
      { label: 'ink on selected', fg: '--ink', bg: '--sel', ratio: 14.3 },
    ])('$label is $ratio:1', ({ fg, bg, ratio }) => {
      expect(contrastRatio(appCssRootTokens().get(fg) as string, t(bg))).toBeCloseTo(ratio, 1);
    });

    test('white on ink (the primary button) is 18.88:1', () => {
      expect(contrastRatio('#ffffff', appCssRootTokens().get('--ink') as string)).toBeCloseTo(
        18.88,
        1,
      );
    });

    test('a selected row reads against a hovered one (measured 1.12)', () => {
      const css = appCssRootTokens();
      expect(
        contrastRatio(css.get('--sel') as string, css.get('--hover') as string),
      ).toBeGreaterThanOrEqual(1.1);
    });

    // quick 261009-qbo: the surfaces and borders that component stylesheets now
    // read from these tokens instead of restating a hex.
    test.each([
      { label: 'text on list', fg: '--text', bg: '--list', min: 4.5 },
      { label: 'text on hover', fg: '--text', bg: '--hover', min: 4.5 },
      { label: 'text on selected', fg: '--text', bg: '--sel', min: 4.5 },
      { label: 'text on chip', fg: '--text', bg: '--chip', min: 4.5 },
      { label: 'ink on selected', fg: '--ink', bg: '--sel', min: 7 },
      { label: 'ink on hover', fg: '--ink', bg: '--hover', min: 7 },
      // A control boundary keeps its contrast: borders of selects, inputs,
      // pickers and buttons read --faint, not --border.
      { label: 'faint on list (control boundary)', fg: '--faint', bg: '--list', min: 3 },
    ])('$label clears $min:1', ({ fg, bg, min }) => {
      const css = appCssRootTokens();
      expect(contrastRatio(css.get(fg) as string, css.get(bg) as string)).toBeGreaterThanOrEqual(
        min,
      );
    });

    test('faint on page clears the decoration-only floor of 3 (measured 3.36)', () => {
      const css = appCssRootTokens();
      expect(
        contrastRatio(css.get('--faint') as string, css.get('--page') as string),
      ).toBeGreaterThanOrEqual(3);
    });
  });
});
