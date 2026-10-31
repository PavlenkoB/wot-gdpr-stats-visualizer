import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, relativeLuminance } from '../../helpers/contrast.ts';
import { componentPath, listComponentFiles } from '../../helpers/components.ts';
import {
  scanRules,
  stripCssComments as stripComments,
  tokenMap,
  type CssRule,
} from '../../helpers/css.ts';
import {
  contrastRatioRgb,
  hexToRgb,
  luminanceRgb,
  mixSrgb,
  parseColorMix,
  resolveMix,
  type Rgb,
} from '../../helpers/color.ts';
import { readTokenSource } from '../../helpers/styles.ts';

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
// are hand-authored hex in component stylesheets and in the token stylesheet by
// design (the build-time CSP forbids inline styles), so there is no module for
// them to live in and a re-exported constant would only assert that a constant
// equals itself.
//
// The heat scale (14-UI-SPEC Color, D-11) is the first such contract, and it
// is declared in the token stylesheet rather than in a component stylesheet for
// the same reason: hand-authored hex values that five components read as
// `var(--heat-N)` have exactly one place to be wrong in, and a scale is a
// *sequence*, so a drift in one step silently breaks the monotonicity the
// scale rule depends on. The Color table stays the contract; these tests make
// the stylesheet and the spec agree, and make the recorded ratios true rather
// than merely stated — the W-03 lesson, applied to a five-step scale instead of
// a single hover surface.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP_CSS = readFileSync(path.join(REPO_ROOT, 'src/app.css'), 'utf8');

/**
 * The token source, read through the shared helper.
 *
 * The readers below ask for a DECLARATION, never for a FILE: `readTokenSource()`
 * returns the text of the stylesheet a custom property is declared in, so a
 * reader here does not care which file that is. That is what made plan 14-02's
 * relocation a pure move with no test edit - the reader was already asking for
 * the declaration, and only the file the answer came from changed.
 */
const TOKEN_CSS = readTokenSource();

/**
 * The same source with the comments stripped.
 *
 * A count of a declaration must not see a token NAME quoted inside a contract
 * comment: the heat group's comment names six swatches and the flow's names
 * two, and a count that read the prose would be counting sentences.
 */
const TOKEN_CSS_STRIPPED = stripComments(TOKEN_CSS);

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
// The other chrome the Color table records (04-UI-SPEC Color)
// =============================================================================
//
// "Other colour uses" pairs, recomputed rather than trusted. Each entry is
// [foreground, background, recorded ratio] exactly as the table states it.
// None of them is a data scale: they are the tooltip, the excluded-row pill,
// the error message, the tile surface and the focus ring.
// =============================================================================

describe('the contrast pairs the Color table records for the other chrome', () => {
  test('every recorded pair is true of the shipped colours', () => {
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
});

// =============================================================================
// The flow data colours — two marks, deliberately hard to tell apart (05-08)
// =============================================================================
//
// `--flow-in` and `--flow-out` are the first data colours in this app that
// are NOT a lightness scale, and the first pair chosen to sit close together.
// The value scale's rule — one direction of lightness, one colour per rank —
// does not fit a diverging chart, where the meaning is side of the line rather
// than size. So the two hues are 1.36:1 apart, which is close enough to look
// like a mistake and far enough apart to read.
//
// The consequence drives the whole design: a pair this close must never be the
// only cue. Section 8's tooltip, the legend words, the side of the zero line
// and the monthly table all carry the same meaning in text, so the colours are
// allowed to be subtle precisely because nothing depends on them alone. That
// is why these are declared in the token stylesheet and read as `var(--flow-in)` — a
// component restating `#4c3fa6` would create a second copy of the contract
// with no way to tell which is authoritative, which is the same failure the
// heat scale tests are written to prevent.
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
  for (const match of TOKEN_CSS.matchAll(/(--flow-(?:in|out))\s*:\s*(#[0-9a-f]{3,6})\s*;/gi)) {
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
      expect(TOKEN_CSS_STRIPPED.match(new RegExp(`${token}\\s*:`, 'g'))?.length).toBe(1);
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

  test('neither is a data-scale swatch or the accent', () => {
    // These are two new hues, not two more rungs. A collision would make a
    // flow mark indistinguishable from a data cell or from a focus ring, and
    // the value scale would silently gain a rung. The six swatches are the
    // empty one, the three stops and the two derived steps the browser mixes.
    const taken = new Set([...heatSwatchHexes(), '#1a73e8']);
    for (const step of specFlow()) {
      expect(taken.has(step.hex)).toBe(false);
    }
  });

  test('the two are about 1.36:1 apart, close enough to need the text cues', () => {
    // The separation is a design fact, not an accident: it is why the legend
    // words, the zero line and the tooltip all restate the meaning. Asserting
    // it means a future "let's just make them clearly different" change has to
    // be a deliberate act in the spec, not a quiet edit to the token stylesheet.
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

/** The `--name: #hex;` custom property declared in the token source, lowercase. */
function appCssToken(name: string): string {
  const match = TOKEN_CSS.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-f]{3,6})\\s*;`, 'i'));
  if (match === null) {
    throw new Error(`the token source declares no ${name} token`);
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
    // reading D-27 would build a value-scale legend for a flow chart. The
    // deviation belongs in the spec where the decision is read.
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
// The country map's shading — the one value scale (06-12, D-09)
// =============================================================================
//
// The map reads the SAME heat scale every other data mark reads: the neutral
// empty swatch and the five data steps. There is no map-specific colour and
// no map-specific table any more, so what this block pins is the one thing
// that is still the map's own business: the component reads the tokens rather
// than restating a hex, and the legend beside it is the shared component with
// the shared swatches.
//
// The CONTRAST of the six swatches is not asserted here: the heat scale
// describe at the end of this file owns it, and it is the same scale, so a
// second copy of the ratios would only be a second copy to drift.
// =============================================================================

describe('the login map reads the heat scale', () => {
  test('the map component reads var(--heat-N) for every level and restates no heat hex', () => {
    const source = readFileSync(
      path.join(REPO_ROOT, 'src/lib/features/logins/WorldMap.svelte'),
      'utf8',
    );
    expect(source).toContain('var(--heat-empty)');
    for (let level = 1; level <= 5; level += 1) {
      expect(source).toContain(`var(--heat-${level})`);
    }
    for (const hex of heatSwatchHexes()) {
      expect(source.toLowerCase(), `WorldMap restates ${hex}`).not.toContain(hex);
    }
  });

  test('the legend reuses the shared component, whose swatches read the same tokens', () => {
    const legend = readFileSync(path.join(REPO_ROOT, 'src/lib/charts/ChartLegend.svelte'), 'utf8');
    expect(legend).toContain('var(--heat-empty)');
    for (let level = 1; level <= 5; level += 1) {
      expect(legend).toContain(`var(--heat-${level})`);
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
// Build Notes code block is the contract; the token stylesheet is its
// implementation;
// these tests make the two agree and make the recorded ratios true rather than
// merely stated (the W-03 lesson, again). The data colours do not move, so the
// heat stops, the empty swatch and the flow declarations are re-pinned here as
// a tripwire against a token edit that "tidies" them.
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

/**
 * Every `--name: value;` declared in the token source, lower-cased.
 *
 * The reader is the shared `tokenMap`: it takes the FIRST declaration of each
 * name, which is the default one, and it reads every block of the source
 * rather than only the first `:root` rule. That matters because the token
 * stylesheets hold more than one block - the `:root` defaults, a media query
 * that switches the title size, and an `@supports` block that overrides the
 * derived heat steps - and a reader that saw only the first block would miss
 * a token a later plan added to one of the others.
 */
function appCssRootTokens(): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [name, value] of tokenMap(TOKEN_CSS)) {
    tokens.set(name, value.toLowerCase());
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
      expect(css.get(token), `${token} in the token source`).toBe(spec.get(token));
    }
  });

  test('the data colours are untouched', () => {
    // The tripwire against a token edit that "tidies" the data colours: the
    // three heat stops, the neutral empty swatch and the two flow hues are
    // the values every data mark in the app is measured against.
    const css = appCssRootTokens();
    expect(css.get('--heat-low'), '--heat-low').toBe('#47a374');
    expect(css.get('--heat-mid'), '--heat-mid').toBe('#6b8a14');
    expect(css.get('--heat-peak'), '--heat-peak').toBe('#8c6400');
    expect(css.get('--heat-empty'), '--heat-empty').toBe('#eef0f2');
    expect(css.get('--flow-in')).toBe('#4c3fa6');
    expect(css.get('--flow-out')).toBe('#a14a00');
  });

  test('the page reads the neutrals, not literals', () => {
    // The ELEMENT rule stays in `src/app.css`: it is the page's own reset, not
    // a token. Only the custom properties moved to the token stylesheet.
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

// =============================================================================
// The Overview colours (13-04 Task 1, 13-UI-SPEC Color, D-13, D-22)
// =============================================================================
//
// The Overview is a page that may use a small, named set of colours and
// nothing else, so its palette is a contract in the same sense the heat scale
// is: ten custom properties in the token stylesheet, and every figure the
// Color table records recomputed here from the shipped declarations.
//
// Two facts in this block are the ones a later edit would most easily break:
//
//   1. THE LIGHTEST HEAT STOP IS A FLOOR, NOT A PREFERENCE. The sketch's
//      green measured 2.62:1 on white and failed 3:1; the shipped green is
//      darkened to 3.11:1 (D-22). The old value is asserted here as well, so
//      the darkening cannot be undone by a "taste" edit without a test
//      failing and the reason being spelled out.
//   2. THE BARS SIT ON WHITE, NEVER ON A GREY TRACK. A track grey would drop
//      the lightest step back to 2.63:1 — under the floor again — so the
//      Overview draws no track, and the numbers that forbid it are recorded
//      here rather than left in a comment.
//
// The group dots are IDENTITY, never meaning: the group name beside a dot is
// the text that carries the meaning, and the dot is aria-hidden. So the dots
// are held to the 3:1 non-text floor, and none of them may collide with a
// heat swatch: a dot beside a chart is a mark, not a bar, and a data step
// means a value.
// =============================================================================

/** The ten tokens the Overview palette declares, in the order the contract lists them. */
const OVERVIEW_TOKENS = [
  '--heat-low',
  '--heat-mid',
  '--heat-peak',
  '--ov-time',
  '--ov-tanks',
  '--ov-records',
  '--ov-totals',
  '--ov-pinned',
  '--ov-star-fill',
  '--ov-star-stroke',
] as const;

/** The ten Overview tokens as declared in the token source, lower-cased. */
function overviewTokens(): Map<string, string> {
  const declared = new Map<string, string>();
  for (const token of OVERVIEW_TOKENS) {
    declared.set(token, appCssToken(token));
  }
  return declared;
}

describe('Overview colours (13-UI-SPEC Color)', () => {
  test('the code ships the ten tokens the contract declares, each exactly once', () => {
    for (const token of OVERVIEW_TOKENS) {
      expect(appCssToken(token), `${token} is declared`).toMatch(/^#[0-9a-f]{6}$/);
      expect(
        TOKEN_CSS_STRIPPED.match(new RegExp(`${token}\\s*:`, 'g'))?.length,
        `${token} once`,
      ).toBe(1);
    }
  });

  test('every recorded ratio on white is true of the shipped hex', () => {
    // The Color table's numbers are arguments, not facts: the W-03 lesson.
    const css = new Map<string, string>([
      ...overviewTokens(),
      ['--faint', appCssRootTokens().get('--faint') as string],
    ]);
    const RECORDED: ReadonlyArray<readonly [string, number]> = [
      ['--heat-low', 3.11],
      ['--heat-mid', 3.98],
      ['--heat-peak', 5.33],
      ['--ov-time', 5.13],
      ['--ov-tanks', 3.91],
      ['--ov-records', 6.07],
      ['--ov-totals', 5.52],
      ['--ov-star-stroke', 4.17],
      // Decorative only: the pinned star's FILL never has to be readable on
      // its own, because the star's stroke (4.17:1) and the tile's text
      // label carry the meaning.
      ['--ov-star-fill', 2.28],
      // Graphics only, never text: the chart baseline, the unpinned star
      // stroke and the absent-row dot.
      ['--faint', 3.36],
    ];
    for (const [token, recorded] of RECORDED) {
      expect(contrastRatio(css.get(token) as string, '#ffffff'), token).toBeCloseTo(recorded, 2);
    }
  });

  test('the neutral text pairs the Overview uses are true of the shipped tokens', () => {
    // Every text colour on the Overview is one of these three; #8c8c8c is
    // decoration and never text.
    const css = appCssRootTokens();
    const RECORDED: ReadonlyArray<readonly [string, number]> = [
      ['--ink', 18.88],
      ['--muted', 6.69],
      ['--text', 11.37],
    ];
    for (const [token, recorded] of RECORDED) {
      expect(contrastRatio(css.get(token) as string, '#ffffff'), token).toBeCloseTo(recorded, 2);
    }
  });

  test('the lightest heat stop clears 3:1 on white and fails it on a grey track', () => {
    // The reason the Overview draws its bars on the tile surface and never on
    // a track: the track grey takes the lightest step back under the floor.
    const low = overviewTokens().get('--heat-low') as string;
    expect(contrastRatio(low, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(low, appCssRootTokens().get('--track') as string)).toBeCloseTo(2.63, 2);
    expect(contrastRatio(low, appCssRootTokens().get('--track') as string)).toBeLessThan(3);
  });

  test('the three heat stops fall strictly in luminance, so the peak is the darkest', () => {
    const css = overviewTokens();
    const luminances = (['--heat-low', '--heat-mid', '--heat-peak'] as const).map((token) =>
      relativeLuminance(css.get(token) as string),
    );
    for (let index = 1; index < luminances.length; index += 1) {
      expect(luminances[index]).toBeLessThan(luminances[index - 1] as number);
    }
  });

  test('the sketch green is below the floor, so the darkening was a fix and not a taste change', () => {
    // D-22. The previous lightest step measured 2.62:1 on white and failed
    // the 3:1 a non-text mark needs; the shipped step measures 3.11:1.
    expect(contrastRatio('#4fb27f', '#ffffff')).toBeCloseTo(2.62, 2);
    expect(contrastRatio('#4fb27f', '#ffffff')).toBeLessThan(3);
    expect(contrastRatio(overviewTokens().get('--heat-low') as string, '#ffffff')).toBeGreaterThan(
      3,
    );
  });

  test('the four catalogue group dots are distinct, and none of them is a heat swatch', () => {
    // A dot is identity, not meaning: the group name beside it carries the
    // meaning and the dot is aria-hidden. The Time dot used to reuse the old
    // ramp's fourth step; the heat scale replaced that ramp, so the dot keeps
    // its own value and must not collide with a data step.
    const css = overviewTokens();
    const heat = new Set(heatSwatchHexes());
    const dots = ['--ov-time', '--ov-tanks', '--ov-records', '--ov-totals'] as const;
    const values = dots.map((token) => css.get(token) as string);

    expect(new Set(values).size, 'the four group dots are four distinct values').toBe(4);
    // The Time dot still has its recorded value: the heat scale did not
    // repaint it, it only ended the ramp it used to share a colour with.
    expect(css.get('--ov-time')).toBe('#1f7a74');
    for (const [index, token] of dots.entries()) {
      const value = values[index] as string;
      expect(heat.has(value), `${token} is not a heat swatch`).toBe(false);
    }
    // The Pinned dot is its own role, not a catalogue dot, and it is not a
    // heat swatch either.
    expect(heat.has(css.get('--ov-pinned') as string)).toBe(false);
    expect(values).not.toContain(css.get('--ov-pinned') as string);
  });
});

// =============================================================================
// The heat scale (14-UI-SPEC Color, D-10/D-11)
// =============================================================================
//
// The QUANTISATION is unchanged and discrete: `levelOf` returns 0 for a cell
// with no data and 1 to 5 by RANK (the playtime model's cut points), and no
// colour is ever interpolated from the data itself. What this block pins is
// the CONTRACT the five data steps and the one neutral empty swatch must
// keep, in the approved UI-SPEC's own words:
//
//   D-11 as amended: five data levels plus the neutral empty swatch, 3:1 on
//   the five data steps (the empty swatch is exempt at 1.14:1), lightness
//   strictly monotonic across the six swatches, adjacent-step floor 1.1:1
//   (it was 1.25:1 for the old ramp).
//
// The two DERIVED steps are written as `color-mix(in srgb, ...)` inside an
// `@supports` block, so the test mirrors the arithmetic in the same colour
// space: `mixSrgb` averages the channels in gamma-encoded sRGB, exactly what
// Chromium does for `srgb`. The colour space is CHECKED rather than assumed -
// `resolveMix` refuses an `oklab` expression - and the DECLARED STRINGS are
// asserted too, so a silent switch to another space, a swapped stop or a
// dropped fallback fails a named test here rather than a review nobody reads.
//
// The empty swatch is EXEMPT from the 3:1 floor on purpose: it means "no data",
// not "a low value", so it is a neutral surface rather than a data mark. That
// exemption is asserted, not assumed: the floor applies to exactly the five
// data steps.
// =============================================================================

/** The six swatches of the scale, in contract order. */
const HEAT_SWATCHES = [
  '--heat-empty',
  '--heat-1',
  '--heat-2',
  '--heat-3',
  '--heat-4',
  '--heat-5',
] as const;

/** The four hex declarations the scale is built from. */
const HEAT_STOPS = {
  '--heat-low': '#47a374',
  '--heat-mid': '#6b8a14',
  '--heat-peak': '#8c6400',
  '--heat-empty': '#eef0f2',
} as const;

/** White, the surface every data step is measured against. */
const WHITE: Rgb = [255, 255, 255];

/** Every rule of the token stylesheet, parsed by the shared scanner. */
function heatRules(): readonly CssRule[] {
  return scanRules(TOKEN_CSS_STRIPPED);
}

/**
 * The top-level `:root` rule: the defaults, and the plain fallbacks of the
 * two derived steps.
 */
function rootRule(): CssRule {
  const rule = heatRules().find(
    (candidate) => candidate.parent === null && candidate.selector.trim() === ':root',
  );
  if (rule === undefined) throw new Error('the token stylesheet declares no top-level :root rule');
  return rule;
}

/**
 * The `:root` rule INSIDE the `@supports` block: the derived overrides.
 *
 * The rule is found by its PARENT, not by its selector: there are two
 * `:root` rules in the token stylesheet, and a lookup by selector would
 * always find the first one - the one that holds the fallbacks.
 */
function supportsRule(): CssRule | undefined {
  const rules = heatRules();
  return rules.find((rule) => {
    if (rule.parent === null) return false;
    const parent = rules[rule.parent];
    return parent !== undefined && parent.selector.trim().startsWith('@supports');
  });
}

/** The `--name: value` pairs of one rule. */
function declarationsOf(rule: CssRule | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const declaration of rule?.declarations ?? []) {
    const match = /^(--[\w-]+)\s*:\s*(.+)$/.exec(declaration);
    if (match === null) continue;
    map.set(match[1]!, (match[2] ?? '').trim());
  }
  return map;
}

/** The declarations of the top-level `:root` rule. */
function rootDeclarations(): Map<string, string> {
  return declarationsOf(rootRule());
}

/** The declarations of the `:root` rule inside the `@supports` block. */
function supportsDeclarations(): Map<string, string> {
  return declarationsOf(supportsRule());
}

/** The hex value a token declares, lower-cased. */
function tokenHex(name: string): string {
  const expression = supportsDeclarations().get(name) ?? rootDeclarations().get(name);
  const match = expression === undefined ? null : /^(#[0-9a-f]{3,6})$/i.exec(expression);
  if (match === null) {
    throw new Error(`the token stylesheet declares no hex value for ${name}`);
  }
  return (match[1] as string).toLowerCase();
}

/**
 * The colour a swatch paints, as the browser resolves it.
 *
 * A `var()` reads the token it names, a plain hex is itself, and a
 * `color-mix()` is mixed in the colour space it declares - which the helper
 * refuses unless it is `srgb`.
 */
function swatchRgb(name: string): Rgb {
  const expression = supportsDeclarations().get(name) ?? rootDeclarations().get(name);
  if (expression === undefined) throw new Error(`the token stylesheet declares no ${name}`);
  const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(expression);
  if (reference !== null) return hexToRgb(tokenHex(reference[1] as string));
  if (expression.startsWith('#')) return hexToRgb(expression.toLowerCase());
  return resolveMix(expression, (ref) => hexToRgb(tokenHex(ref)));
}

/**
 * A colour as the eight-bit hex the browser stores it as.
 *
 * The two DERIVED steps are mixed by the browser and come back as fractional
 * channels, so they are rounded to the eight bits a paint holds before they are
 * compared with a hex written in a stylesheet.
 */
function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The six swatches of the scale as the hex the browser paints them.
 *
 * The empty swatch, the three stops and the two mixed steps, so a block that
 * asks "is this colour already taken by the value scale?" has the answer the
 * screen shows rather than the answer the stylesheet's arithmetic suggests.
 */
function heatSwatchHexes(): string[] {
  return HEAT_SWATCHES.map((name) => rgbToHex(swatchRgb(name)));
}

describe('heat scale (14-UI-SPEC Color, D-10/D-11)', () => {
  test('the three stops and the empty swatch are each declared exactly once', () => {
    for (const [name, hex] of Object.entries(HEAT_STOPS)) {
      expect(tokenHex(name), `${name} value`).toBe(hex);
      const declarations = TOKEN_CSS_STRIPPED.match(new RegExp(`${name}\\s*:`, 'g'))?.length ?? 0;
      expect(declarations, `${name} is declared once`).toBe(1);
    }
  });

  test('the five data steps read the three stops, with plain fallbacks for the two derived ones', () => {
    const root = rootDeclarations();
    expect(root.get('--heat-1')).toBe('var(--heat-low)');
    expect(root.get('--heat-3')).toBe('var(--heat-mid)');
    expect(root.get('--heat-5')).toBe('var(--heat-peak)');
    // The two derived steps FALL BACK to the stop below them, so a browser
    // without color-mix() shows three bands rather than a second hand-picked
    // scale - which is what D-11 forbids.
    expect(root.get('--heat-2')).toBe('var(--heat-low)');
    expect(root.get('--heat-4')).toBe('var(--heat-mid)');
  });

  test('the derived steps are mixed in srgb, and the space is checked rather than assumed', () => {
    const supports = supportsDeclarations();
    expect(supports.get('--heat-2')).toBe(
      'color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid))',
    );
    expect(supports.get('--heat-4')).toBe(
      'color-mix(in srgb, var(--heat-mid) 50%, var(--heat-peak))',
    );
    expect(parseColorMix(supports.get('--heat-2') as string).space).toBe('srgb');
    expect(parseColorMix(supports.get('--heat-4') as string).space).toBe('srgb');
    // An oklab expression is a DIFFERENT colour for the same two stops, so the
    // helper refuses it rather than computing a colour the browser never
    // produces. A drift of the colour space therefore cannot pass silently.
    expect(() =>
      resolveMix('color-mix(in oklab, var(--heat-low) 50%, var(--heat-mid))', (ref) =>
        hexToRgb(tokenHex(ref)),
      ),
    ).toThrow(/not comparable/);
  });

  test('the mixed colours are the channel averages of the two stops', () => {
    const low = hexToRgb(HEAT_STOPS['--heat-low']);
    const mid = hexToRgb(HEAT_STOPS['--heat-mid']);
    const peak = hexToRgb(HEAT_STOPS['--heat-peak']);
    // The arithmetic the CSS asks for, in gamma-encoded sRGB: the values
    // Chromium resolves the two mixes to.
    expect(mixSrgb(low, mid, 0.5)).toEqual([89, 150.5, 68]);
    expect(mixSrgb(mid, peak, 0.5)).toEqual([123.5, 119, 10]);
    // And the swatches the stylesheet actually paints.
    expect(swatchRgb('--heat-2')).toEqual([89, 150.5, 68]);
    expect(swatchRgb('--heat-4')).toEqual([123.5, 119, 10]);
  });

  test('every data step clears 3:1 on white, and the empty swatch is exempt', () => {
    for (const name of ['--heat-1', '--heat-2', '--heat-3', '--heat-4', '--heat-5']) {
      expect(contrastRatioRgb(swatchRgb(name), WHITE), `${name} on white`).toBeGreaterThanOrEqual(
        3,
      );
    }
    // The empty swatch means "no data", not "a low value": it is a neutral
    // surface, and the exemption is asserted rather than assumed.
    expect(contrastRatioRgb(swatchRgb('--heat-empty'), WHITE)).toBeCloseTo(1.14, 2);
    expect(contrastRatioRgb(swatchRgb('--heat-empty'), WHITE)).toBeLessThan(3);
  });

  test('every recorded ratio on white is true of the shipped colours', () => {
    // The Color table's numbers are arguments, not facts: the W-03 lesson,
    // applied to the heat scale.
    const RECORDED: ReadonlyArray<readonly [string, number]> = [
      ['--heat-1', 3.11],
      ['--heat-2', 3.56],
      ['--heat-3', 3.98],
      ['--heat-4', 4.67],
      ['--heat-5', 5.33],
    ];
    for (const [name, recorded] of RECORDED) {
      expect(contrastRatioRgb(swatchRgb(name), WHITE), name).toBeCloseTo(recorded, 2);
    }
  });

  test('lightness falls strictly from the empty swatch to level 5', () => {
    // The only channel carrying "more" is darkness, so an equal-luminance
    // pair would make two levels identical.
    const luminances = HEAT_SWATCHES.map((name) => luminanceRgb(swatchRgb(name)));
    for (let index = 1; index < luminances.length; index += 1) {
      expect(
        luminances[index],
        `lightness must fall from the empty swatch to level 5 (${HEAT_SWATCHES[index]})`,
      ).toBeLessThan(luminances[index - 1] as number);
    }
  });

  test('adjacent data steps are at least 1.1:1 apart', () => {
    // OI-4: the old ramp's 1.25:1 floor cannot hold for five steps between
    // 3.11:1 and 5.33:1 - a 1.25:1 chain would need a peak of about 7.6:1.
    for (let level = 2; level <= 5; level += 1) {
      const lower = swatchRgb(`--heat-${level - 1}`);
      const upper = swatchRgb(`--heat-${level}`);
      const separation = (luminanceRgb(lower) + 0.05) / (luminanceRgb(upper) + 0.05);
      expect(separation, `adjacent data steps ${level - 1} and ${level}`).toBeGreaterThanOrEqual(
        1.1,
      );
    }
  });

  test('the three stops are told apart by hue, not by lightness alone', () => {
    // The steps differ in hue (green, olive, gold), so a reader who cannot
    // separate two of them by lightness still has the hue to go on.
    const PAIRS: ReadonlyArray<readonly [string, string]> = [
      ['--heat-low', '--heat-mid'],
      ['--heat-mid', '--heat-peak'],
      ['--heat-low', '--heat-peak'],
    ];
    for (const [first, second] of PAIRS) {
      const ratio = contrastRatioRgb(hexToRgb(tokenHex(first)), hexToRgb(tokenHex(second)));
      expect(ratio, `${first} against ${second}`).toBeGreaterThan(1.05);
    }
  });
});
