import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
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
