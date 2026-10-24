import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentPath, listComponentFiles } from '../../helpers/components.ts';

// =============================================================================
// Phase 5 layout guards (plan 05-20).
// =============================================================================
//
// WHAT THIS FILE IS
// Three layout properties the Phase 5 vehicle block got wrong, each asserted on
// the SOURCE rather than only on a rendered page:
//
//   1. The Vehicle statistics controls row is a flex ROW that wraps. It was a
//      wrapping flex COLUMN, which stacks the Game control above the search box
//      at every width and pushes the table a full row further down the card.
//   2. No px font-size below 14px, and no component shrinks the page — a
//      `max-width: 480px` media query is a per-component phone layout, and the
//      block is inside a scrolling container rather than being the page.
//   3. The table's scroll region contains its own overflow horizontally
//      (`overflow-x: auto`), so an escaped child scrolls inside it rather than
//      widening the page.
//
// WHY SOURCE ASSERTIONS AND NOT ONLY PLAYWRIGHT
// The e2e spec asserts what a reader SEES: the controls are side by side at
// 1024px, no text is below 14px, the page does not scroll sideways at 375px.
// Each of those can pass against a declaration the browser then overrides, and
// 2 and 3 in particular are about which rule WINS — a `font-size: 13px` in a
// `max-width: 480px` block is invisible to a 1024px measurement and a
// `min-width: 0` on the wrong element is invisible to a scrollWidth assertion
// taken at a width where nothing overflows. These tests read the declarations
// that decide those outcomes, so a regression is caught by the cheap test
// instead of by the expensive one.
//
// WHY THE PATTERNS ARE COPIED RATHER THAN IMPORTED
// `stripComments` follows `tests/unit/charts/bar-chart-components.test.ts` and
// `ruleDeclarations` follows the rule-body-by-selector lookup in
// `tests/unit/charts/contrast.test.ts`. Neither is imported: test files do not import
// from each other in this repository, and a shared helper module would be a new
// thing to keep standing between two files that only need a regex.
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(REPO_ROOT, 'src');
const APP_CSS = path.join(SRC, 'app.css');

/**
 * Every file the font floor is measured over: each component's stylesheet and
 * `app.css`, which carries the root `font-size` and the nav's.
 */
function stylesheetFiles(): readonly { label: string; source: string }[] {
  const files = listComponentFiles().map((name) => ({
    label: path.relative(REPO_ROOT, componentPath(name)),
    source: stripComments(readFileSync(componentPath(name), 'utf8')),
  }));
  return [...files, { label: 'src/app.css', source: stripComments(readFileSync(APP_CSS, 'utf8')) }];
}

/** A component's source with its comments removed. */
function componentSource(filename: string): string {
  return stripComments(readFileSync(componentPath(filename), 'utf8'));
}

/** Strip HTML, block and line comments from Svelte/CSS source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** A regex metacharacter-safe copy of `text`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The declaration body of the FIRST rule whose selector list is EXACTLY
 * `selector`.
 *
 * "Exactly" is the point. `.controls` matches here; `.controls, .other` and
 * `header .controls` do not, because a rule that merely mentions the class in
 * a longer list is a different rule, and a guard that accepted one of those
 * would be satisfied by a declaration nobody reads as the controls row. The
 * rule must also be a whole rule rather than a mention inside a body's value,
 * which is why the match is anchored on a rule boundary (`}` or the start of
 * the source) rather than on the class name alone.
 */
function ruleDeclarations(source: string, selector: string): string {
  const boundary = '(?:^|[};])';
  const pattern = new RegExp(`${boundary}\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'm');
  return pattern.exec(source)?.[1] ?? '';
}

/** The page root size in app.css (Body role); a `rem` is judged against what the page computes. */
const ROOT_FONT_SIZE_PX = 14;

/**
 * The Overview folder and its own floor (13-UI-SPEC Typography, 13-04 Task 2).
 *
 * The floor is 14px everywhere because a 14px caption is readable and a 13px
 * one is not. The Overview page declares a 12px LABEL and CAPTION role, and
 * that is the ONE floor in the project that is lower — so the floor is
 * resolved PER FILE here, exactly as the font-size SCALE is resolved per file
 * in the phase-8 guard, and for the same reason: a global exemption is a
 * global weakening.
 */
const OVERVIEW_DIR = 'src/lib/features/overview/';
const OVERVIEW_MIN_FONT_SIZE_PX = 12;

/** A repo-relative name with forward slashes, whatever the platform separator is. */
function posix(label: string): string {
  return label.split(path.sep).join('/');
}

/** The minimum font size the given file may declare. */
function fontFloorPx(label: string): number {
  return posix(label).startsWith(OVERVIEW_DIR) ? OVERVIEW_MIN_FONT_SIZE_PX : ROOT_FONT_SIZE_PX;
}

/** One stylesheet the floor is measured over. */
type Stylesheet = { label: string; source: string };

/**
 * Every font size in the given stylesheets that is below ITS file's floor.
 *
 * Pure and argument-taking, so the exemption's scope can be exercised by the
 * self-tests below with synthetic entries rather than only through the real
 * tree.
 */
function fontSizeFloorOffenders(entries: readonly Stylesheet[]): string[] {
  const offenders: string[] = [];

  for (const { label, source } of entries) {
    const floor = fontFloorPx(label);
    for (const match of source.matchAll(/(?:^|[;{\s])font-size\s*:\s*([^;}]+)/g)) {
      const raw = (match[1] ?? '').trim();
      const where = `${label}: font-size: ${raw}`;

      // The nav's zero-size accessibility run, and the keywords that state
      // no size. Checked before parsing so `0` is not read as an unreadable
      // unit.
      if (/^0(?:\.0+)?$/.test(raw)) continue;
      if (/^(inherit|initial|unset)$/.test(raw)) continue;

      const size = /^(\d+(?:\.\d+)?)(px|rem)?$/.exec(raw);
      if (size === null) {
        offenders.push(
          `${where} — the size is not a px or rem value, so this guard cannot read it; write it in px`,
        );
        continue;
      }
      const value = Number(size[1]);
      const pixels = size[2] === 'rem' ? value * ROOT_FONT_SIZE_PX : value;
      if (pixels < floor) {
        offenders.push(`${where} — ${pixels}px is below the ${floor}px floor (UI-SPEC Typography)`);
      }
    }
  }

  return offenders;
}

describe('phase 5 layout guards (05-20)', () => {
  it('declares the Vehicle statistics controls row as a wrapping flex ROW', () => {
    const source = componentSource('PlayerStats.svelte');
    const controls = ruleDeclarations(source, '.controls');

    // The row: `display: flex` alone makes it a COLUMN, and a column cannot
    // sit the Game control beside the search box at any width. `flex-direction:
    // row` is the one declaration that turns the wrapping row into a row.
    expect(controls).toMatch(/(?:^|;)\s*flex-direction:\s*row\s*;/);
    // Wrapping is KEPT: the row is not nowrap, because at 375px the controls
    // still have to stack rather than overflow the card. A fix that removed
    // `flex-wrap` would pass the assertion above and break the 375px test.
    expect(controls).toMatch(/(?:^|;)\s*flex-wrap:\s*wrap\s*;/);
  });

  // ===========================================================================
  // G-05-10, part one: the Typography floor.
  // ===========================================================================
  //
  // The UI-SPEC says no text below 14px. The audit found six declarations that
  // said otherwise, and a measurement found 36 visible text nodes rendering
  // under the floor at BOTH 1280 and 375.
  //
  // Why this is a scan of every stylesheet rather than a check of the three
  // components the audit named: two of the six were invisible to any rendered
  // measurement. The vehicle table's `@media (max-width: 480px)` rule is dead
  // in the browser because every cell and header sets its own 14px, so a
  // 1280px walk and a 375px walk both miss it, and only reading the source
  // finds it. The file is the guard; the browser test is the proof.
  //
  // WHY EVERY VALUE IS MATCHED, NOT ONLY px
  // A guard written as `/font-size:\s*(\d+)px/` passes a stylesheet that says
  // `font-size: 0.75rem` — 12px by another spelling. So the value is parsed
  // rather than pattern-matched, `rem` is multiplied by the 14px root (ROOT_FONT_SIZE_PX), and any
  // unit this project does not use (`em`, `pt`, `%`, `vw`) FAILS with a message
  // that asks for px instead of silently passing an unread value.
  //
  // THE TWO ALLOWANCES, AND WHY EACH IS NOT A HOLE
  //   - A bare zero. `DashboardNav.svelte` sets `font-size: 0` on its
  //     `.screen-reader-only` run, which is 03-05's accessible-name fix: the
  //     text stays in the accessibility tree but takes no advance width. There
  //     is no visible text whose size a reader could be shown, so the floor
  //     cannot be about it. It is allowed by value only, not by selector, so a
  //     zero in any other file still fails.
  //   - The keywords `inherit`, `initial` and `unset`, which state no size of
  //     their own and so cannot be below the floor.
  // ===========================================================================
  it('declares no font-size below its floor (14px, or 12px under features/overview) in any component stylesheet or app.css', () => {
    const offenders = fontSizeFloorOffenders(stylesheetFiles());

    expect(offenders, `font sizes below the 14px floor:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  // ===========================================================================
  // G-05-10, part two: the battle-type table stays inside its card.
  // ===========================================================================
  //
  // The battle-type table is four columns with `white-space: nowrap` cells, so
  // its minimum width is the sum of its widest cells and nothing about the
  // export can make it narrower. At 375px it measured 316px inside a 293px box
  // and pushed the Player_statistics card's scrollWidth to 332 against 325.
  //
  // The fix is a scroll region around the TABLE, inside this component and not
  // in PlayerStats: PlayerStats' bare `div` rule makes every div in it a flex
  // column with a 24px gap, so a wrapper added THERE would change the card's
  // layout rather than contain the table.
  //
  // The region has to be focusable, or a keyboard reader cannot reach the
  // content that scrolled out of view — which is the same WCAG 2.1.1 argument
  // the vehicle table's scroller makes, and the reason this component copies
  // that element's shape rather than inventing one.
  //
  // It is named with `BATTLE_TYPE_SUMMARY_HEADING`, the heading already on
  // screen. That adds NO copy: the heading and the region share a name exactly
  // as the vehicle table's region shares its h4's (see `formatVehicleRegionName`).
  // ===========================================================================
  it('wraps the battle-type table in a named, focusable horizontal scroll region', () => {
    const source = componentSource('BattleTypeSummary.svelte');

    // The wrapper: a `region` role with a tab stop and the EXISTING heading
    // constant as its accessible name. Asserting the constant by name rather
    // than by value means a copy change is a one-line edit here, and that no
    // literal string can creep in beside the approved one.
    expect(source).toMatch(/role="region"/);
    expect(source).toMatch(/tabindex="0"/);
    expect(source).toMatch(/aria-label=\{BATTLE_TYPE_SUMMARY_HEADING\}/);

    // The rule: horizontal overflow contained. `overflow-x: auto` is what
    // fixes the spill — measured, deleting it fails the 375px browser test.
    const scrollBox = ruleDeclarations(source, '.scroll-box');
    expect(scrollBox).toMatch(/(?:^|;)\s*overflow-x:\s*auto\s*;/);
    // `min-width: 0` is the declaration that lets a box be narrower than its
    // content, which a scroll container has to be able to be. It is NOT what
    // fixes the spill in today's markup — the box is a block inside `<details>`
    // and deleting it leaves the 375px test green — and it is pinned because it
    // is what keeps the containment if this box ever becomes a flex or grid
    // item, where the automatic minimum size restores the max-content width.
    expect(scrollBox).toMatch(/(?:^|;)\s*min-width:\s*0\s*;/);

    // The EXISTING rule is kept, not repurposed: an export with more than
    // twelve codes still scrolls vertically in a 320px box, and `overflow: auto`
    // on this modifier is what does that. Losing it would drop the vertical
    // bound the UI-SPEC's "more than 12 rows" line asks for.
    const scrolls = ruleDeclarations(source, '.scrolls');
    expect(scrolls).toMatch(/(?:^|;)\s*max-height:\s*320px\s*;/);
    expect(scrolls).toMatch(/(?:^|;)\s*overflow:\s*auto\s*;/);
  });
});

// =============================================================================
// The Overview floor exemption, and the self-tests that keep it scoped
// (13-04 Task 2, 13-UI-SPEC Typography, T-13-12)
// =============================================================================
//
// The floor is lowered for the Overview folder ALONE, because that page
// declares a 12px Label and Caption role. The three assertions below are the
// shape of that scope: a 12px caption is legal there, a 12px caption is
// illegal everywhere else, and even inside the Overview a size below 12px
// still fails — the exemption lowers the floor, it does not remove it.
// =============================================================================
describe('the Overview font-size floor exemption (13-UI-SPEC Typography)', () => {
  /** A synthetic stylesheet entry declaring one font size. */
  const entry = (label: string, size: string): Stylesheet => ({
    label,
    source: `.x { font-size: ${size}; }`,
  });

  it('a 12px caption passes under the Overview label', () => {
    expect(
      fontSizeFloorOffenders([entry('src/lib/features/overview/Tile.svelte', '12px')]),
    ).toEqual([]);
  });

  it('a 12px caption fails under any other label', () => {
    expect(fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', '12px')])).toHaveLength(1);
    expect(fontSizeFloorOffenders([entry('src/app.css', '12px')])).toHaveLength(1);
  });

  it('an 11px size fails even under the Overview label', () => {
    expect(
      fontSizeFloorOffenders([entry('src/lib/features/overview/Tile.svelte', '11px')]),
    ).toHaveLength(1);
  });

  it('the Overview components are inside the sweep this floor is measured over', () => {
    // A per-file floor is only worth anything if the file is in the sweep: a
    // component folder that is not listed here would be exempt from the floor
    // without anybody having decided that it should be.
    const labels = stylesheetFiles().map(({ label }) => posix(label));
    expect(
      labels.filter((label) => label.startsWith(OVERVIEW_DIR)),
      'the Overview components are listed by the component sweep',
    ).not.toEqual([]);
  });
});
