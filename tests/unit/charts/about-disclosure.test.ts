import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import { effectiveFontSizes, ruleDeclarations, styleText, tokenMap } from '../../helpers/css.ts';
import { readTokenSource, TYPE_CSS } from '../../helpers/styles.ts';

// =============================================================================
// AboutDisclosure placement guard (08-06)
// =============================================================================
//
// Why this is a source-contract test: no component here can be rendered in a
// unit test, and the thing worth guarding is a placement decision made in
// markup. The disclosure wraps SUPPLEMENTARY copy only (keyboard hints and the
// conditional hour-grid start-basis note). Three kinds of copy must stay
// visible, because something other than taste requires them:
//
//   - the basis captions (Phase 4 D-01, roadmap success criterion 3: the dates
//     and hours are the export's own, as visible text rather than a tooltip),
//   - the session-length explanation (D-05), and
//   - the map's DB-IP attribution (a CC BY 4.0 licence obligation, T-08-21).
//
// `stripComments` follows `tests/unit/guards/phase5-layout-guards.test.ts`; it is
// copied rather than imported because test files do not import each other.

/** Strip HTML, block and line comments from Svelte/CSS source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

function read(filename: string): string {
  return stripComments(readFileSync(componentPath(filename), 'utf8'));
}

const REGION = /<AboutDisclosure\b[^>]*>[\s\S]*?<\/AboutDisclosure>/g;

/** Every `<AboutDisclosure ...> ... </AboutDisclosure>` region in a source. */
function regions(source: string): string[] {
  return source.match(REGION) ?? [];
}

/** The source with every disclosure region removed: what is visible beside the chart. */
function outsideRegions(source: string): string {
  return source.replace(REGION, '');
}

const HINTS = [
  ['CalendarHeatmap.svelte', 'CALENDAR_KEYBOARD_HINT', 'about-calendar'],
  ['PlaytimeCharts.svelte', 'HOUR_GRID_KEYBOARD_HINT', 'about-hour-grid'],
  ['PremiumBlock.svelte', 'BAR_CHART_KEYBOARD_HINT', 'about-premium'],
  ['CurrencyBlock.svelte', 'BAR_CHART_KEYBOARD_HINT', 'about-currency-'],
  ['LoginMapSection.svelte', 'MAP_KEYBOARD_HINT', 'about-map'],
] as const;

describe('the keyboard hints sit inside an AboutDisclosure and keep their id', () => {
  test.each(HINTS)('%s wraps %s', (file, constant, testId) => {
    const source = read(file);
    const inside = regions(source);
    expect(inside.length, `${file} has an AboutDisclosure`).toBeGreaterThan(0);

    const holder = inside.find((region) => region.includes(`{${constant}}`));
    expect(holder, `${constant} is rendered inside a disclosure in ${file}`).toBeDefined();
    // The paragraph keeps an id, so the chart's aria-describedby still resolves.
    expect(holder).toMatch(/<p\b[^>]*\bid=/);
    expect(holder).toContain(constant);
    // The owner gives the disclosure its own test id.
    expect(source).toContain(`testId="${testId}`);
  });

  test('the hour grid disclosure also holds the conditional start-basis note', () => {
    const source = read('PlaytimeCharts.svelte');
    const holder = regions(source).find((region) => region.includes('{HOUR_GRID_KEYBOARD_HINT}'));
    expect(holder).toContain('HOUR_GRID_START_BASIS_NOTE');
  });
});

describe('requirement-bearing copy stays visible, outside every disclosure', () => {
  test('PlaytimeCharts keeps both basis captions and the duration explanation visible', () => {
    const outside = outsideRegions(read('PlaytimeCharts.svelte'));
    expect(outside).toContain('{CALENDAR_BASIS_CAPTION}');
    expect(outside).toContain('{HOUR_GRID_BASIS_CAPTION}');
    expect(outside).toContain('{DURATION_EXPLANATION}');
  });

  test('no disclosure region holds a basis caption or the duration explanation', () => {
    const inside = regions(read('PlaytimeCharts.svelte')).join('\n');
    expect(inside).not.toContain('CALENDAR_BASIS_CAPTION');
    expect(inside).not.toContain('HOUR_GRID_BASIS_CAPTION');
    expect(inside).not.toContain('DURATION_EXPLANATION');
  });

  test('LoginMapSection keeps the licence attribution and the not-drawn line outside', () => {
    const source = read('LoginMapSection.svelte');
    const outside = outsideRegions(source);
    expect(outside).toContain('data-testid="map-attribution"');
    expect(outside).toContain('data-testid="map-attribution-link"');
    expect(outside).toContain('data-testid="map-not-drawn"');
    const inside = regions(source).join('\n');
    expect(inside).not.toContain('map-attribution');
    expect(inside).not.toContain('map-not-drawn');
  });
});

// quick 261009-qbo: the Login history table's two usage hints are supplementary
// guidance and sit in a disclosure under the table. Two things beside them must
// NOT: the Account record note (Amendment A-3, read with the pinned row) and the
// city opt-in intro (Phase 6 D-14 and D-16: it is the only on-screen statement
// that nothing is downloaded until the press and nothing from the export is sent
// with the request, the one sanctioned exception to the zero-network guarantee).
describe('Login history: table hints in a disclosure, consent text visible', () => {
  const source = read('LoginHistory.svelte');

  test('both hints sit inside the about-login-table disclosure', () => {
    const holder = regions(source).find((region) => region.includes('{VEHICLE_SCROLL_HINT}'));
    expect(holder, 'the scroll hint is inside a disclosure').toBeDefined();
    expect(holder).toContain('{LOGIN_TABLE_FIND_HINT}');
    expect(source).toContain('testId="about-login-table"');
    expect(source).toContain('name={ABOUT_NAME_LOGIN_TABLE}');
  });

  test('the Account record note and the city opt-in stay outside every disclosure', () => {
    const outside = outsideRegions(source);
    expect(outside).toContain('data-testid="login-account-note"');
    expect(outside).toContain('<CityOptIn');
    expect(outside).not.toContain('{VEHICLE_SCROLL_HINT}');
    expect(outside).not.toContain('{LOGIN_TABLE_FIND_HINT}');
    const inside = regions(source).join('\n');
    expect(inside).not.toContain('login-account-note');
    expect(inside).not.toMatch(/city/i);
  });

  test('CityOptIn has no disclosure at all and still renders the intro', () => {
    const city = read('CityOptIn.svelte');
    expect(city).not.toContain('AboutDisclosure');
    expect(city).not.toMatch(/<details\b/);
    expect(city).toContain('data-testid="city-intro"');
  });
});

describe('AboutDisclosure.svelte', () => {
  const raw = readFileSync(componentPath('AboutDisclosure.svelte'), 'utf8');
  const source = stripComments(raw);

  /**
   * The token declarations, so a px assertion can be resolved back to pixels.
   *
   * The disclosure's sizes are TOKENS now (Phase 14, D-01). A reader that
   * matched `font-size: Npx` in the source would find NOTHING once the sizes
   * were tokenised, and a loop over an empty array asserts nothing - a vacuous
   * pass. Resolving the tokens first turns the declaration back into the px it
   * stands for, so the 14px floor is still checked against the real value.
   * The size now comes from a role class (14-D-07), so the sweep counts the
   * roles the markup uses as well as the declarations of the style block.
   */
  const TOKENS = tokenMap(readTokenSource());

  test('renders a details element with a summary', () => {
    expect(source).toMatch(/<details\b[\s\S]*<summary\b[^>]*>[\s\S]*<\/summary>[\s\S]*<\/details>/);
  });

  test('builds the summary text from formatAboutThis and renders its children', () => {
    expect(source).toContain('formatAboutThis(name)');
    expect(source).toContain('{@render children()}');
    expect(source).not.toContain('{@html');
  });

  test('the summary is at least 44px high', () => {
    // The rule is looked up by SELECTOR, so a nested block does not hide it and
    // a rule that moved does not silently stop answering.
    const rule = ruleDeclarations(styleText(raw), 'summary');
    expect(rule, 'a summary rule exists').not.toBe('');
    expect(rule).toMatch(/min-height:\s*44px/);
  });

  test('declares no font-size under 14px', () => {
    const sizes = effectiveFontSizes(raw, TOKENS, readFileSync(TYPE_CSS, 'utf8'));
    // The non-vacuity check: an empty match would make the loop below assert
    // nothing at all, and the 14px floor would be unproven.
    expect(sizes.length, 'the disclosure declares at least one font-size').toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(14);
  });

  test('the summary takes the strong note role and declares no type of its own', () => {
    expect(source).toMatch(/<summary class="t-note-strong">/);
    const rule = ruleDeclarations(styleText(raw), 'summary');
    expect(rule).not.toMatch(/font-size|font-weight|line-height/);
  });

  test('has no inline style attribute and no overflow declaration', () => {
    expect(source).not.toMatch(/\sstyle=/);
    expect(source).not.toMatch(/overflow/);
  });
});
