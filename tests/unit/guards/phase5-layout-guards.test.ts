import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentPath, listComponentFiles } from '../../helpers/components.ts';
import { ruleDeclarations, styleText, tokenMap } from '../../helpers/css.ts';
import { TOKENS_CSS, readShellSource, shellHomeName } from '../../helpers/styles.ts';

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
// `stripComments` follows `tests/unit/charts/bar-chart-components.test.ts`.
// It is copied: test files do not import from each other in this repository.
//
// THE EXCEPTIONS, AND WHAT THEY BUY (Phase 14)
// The token map and the token file's path are imported, from
// `tests/helpers/css.ts` and `tests/helpers/styles.ts`. The rule they serve is
// the one this guard could not serve on its own: a rule that states its size
// as `var(--fs-body)` says nothing to a reader that only understands px, and
// the floor can only be judged once the token has been resolved. A copy of
// the token map in two files would be two answers to one question.
//
// The rule READER is imported too, and it is the one this guard was blind to.
// The local copy read a rule body with `[^}]*`, which stops at the first
// closing brace - so a NESTED rule (`.card { & .controls { ... } }`) was
// invisible to it, and a guard written against an invisible rule is a guard
// that passes vacuously. Plan 14-04 replaced the copy with the brace-aware
// reader, so a migrated component's nested rules are read.
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(REPO_ROOT, 'src');
const APP_CSS = path.join(SRC, 'app.css');

/**
 * Every file the font floor is measured over: each component's stylesheet,
 * `app.css`, which carries the root `font-size` and the nav's, and the shell
 * stylesheet.
 */
function stylesheetFiles(): readonly { label: string; source: string }[] {
  const files = listComponentFiles().map((name) => ({
    label: path.relative(REPO_ROOT, componentPath(name)),
    source: stripComments(readFileSync(componentPath(name), 'utf8')),
  }));
  return [
    ...files,
    { label: 'src/app.css', source: stripComments(readFileSync(APP_CSS, 'utf8')) },
    { label: shellHomeName(), source: stripComments(readShellSource()) },
  ];
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

/** The page root size in app.css (Body role); a `rem` is judged against what the page computes. */
const ROOT_FONT_SIZE_PX = 14;

/**
 * The one font-size floor (Phase 14, plan 14-04, D-06).
 *
 * 12px is the smallest size on the shared type scale, so it is the floor
 * everywhere. There is no per-folder floor any more: the Overview used to
 * have its own 12px floor while every other pane had 14px, and that
 * difference was the last shape of the Overview's separate design generation.
 *
 * The floor is a property of the SIZE, not of the file, so a rule that states
 * a size smaller than 12px fails wherever it is written.
 */
const MIN_FONT_SIZE_PX = 12;

/** A repo-relative name with forward slashes, whatever the platform separator is. */
function posix(label: string): string {
  return label.split(path.sep).join('/');
}

/** One stylesheet the floor is measured over. */
type Stylesheet = { label: string; source: string };

/**
 * The token map of the token file.
 *
 * A rule may state its size as a token (`var(--fs-body)`) rather than as a
 * px value, and the floor can only be judged once the token is resolved. The
 * map is read from `src/styles/tokens.css` - the file that OWNS the sizes -
 * so a token that is renamed or removed fails here rather than silently
 * reading as "no size at all".
 */
const TOKEN_MAP = tokenMap(readFileSync(TOKENS_CSS, 'utf8'));

/**
 * The size a token declares, in px.
 *
 * A token may name another token (`--fs-title` is `var(--fs-display)`), so
 * the chain is followed for a few hops before giving up. Null when the token
 * is not declared, or when it does not resolve to a px length.
 */
function tokenSizePx(name: string): number | null {
  let current = name;
  for (let hop = 0; hop < 4; hop += 1) {
    const value = TOKEN_MAP.get(current);
    if (value === undefined) return null;
    const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
    if (px !== null) return Number(px[1]);
    const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
    if (ref === null) return null;
    current = ref[1]!;
  }
  return null;
}

/**
 * Every font size in the given stylesheets that is below the floor.
 *
 * Pure and argument-taking, so the floor can be exercised by the self-tests
 * below with synthetic entries rather than only through the real tree.
 */
function fontSizeFloorOffenders(entries: readonly Stylesheet[]): string[] {
  const offenders: string[] = [];

  for (const { label, source } of entries) {
    for (const match of source.matchAll(/(?:^|[;{\s])font-size\s*:\s*([^;}]+)/g)) {
      const raw = (match[1] ?? '').trim();
      const where = `${label}: font-size: ${raw}`;

      // The nav's zero-size accessibility run, and the keywords that state
      // no size. Checked before parsing so `0` is not read as an unreadable
      // unit.
      if (/^0(?:\.0+)?$/.test(raw)) continue;
      if (/^(inherit|initial|unset)$/.test(raw)) continue;

      // A size stated as a token (Phase 14, D-01): resolved through the token
      // map and then judged against the floor. A token that is not declared
      // stays an offender - the guard cannot read it, and a guard that waves
      // an unreadable value through has stopped guarding.
      const token = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
      if (token !== null) {
        const pixels = tokenSizePx(token[1]!);
        if (pixels === null) {
          offenders.push(
            `${where} — the token ${token[1]} is not a size this guard can read, so it cannot be judged against the ${MIN_FONT_SIZE_PX}px floor`,
          );
          continue;
        }
        if (pixels < MIN_FONT_SIZE_PX) {
          offenders.push(
            `${where} — ${pixels}px is below the ${MIN_FONT_SIZE_PX}px floor (UI-SPEC Typography)`,
          );
        }
        continue;
      }

      const size = /^(\d+(?:\.\d+)?)(px|rem)?$/.exec(raw);
      if (size === null) {
        offenders.push(
          `${where} — the size is not a px or rem value, so this guard cannot read it; write it in px`,
        );
        continue;
      }
      const value = Number(size[1]);
      const pixels = size[2] === 'rem' ? value * ROOT_FONT_SIZE_PX : value;
      if (pixels < MIN_FONT_SIZE_PX) {
        offenders.push(
          `${where} — ${pixels}px is below the ${MIN_FONT_SIZE_PX}px floor (UI-SPEC Typography)`,
        );
      }
    }
  }

  return offenders;
}

describe('phase 5 layout guards (05-20)', () => {
  it('declares the Vehicle statistics controls row as a wrapping flex ROW', () => {
    const source = componentSource('PlayerStats.svelte');
    const controls = ruleDeclarations(styleText(source), '.controls');

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
  it('declares no font-size below the 12px floor in any component stylesheet or app.css', () => {
    const sheets = stylesheetFiles();
    const labels = sheets.map((sheet) => sheet.label);
    expect(labels, 'the floor still covers app.css').toContain('src/app.css');
    expect(labels, 'the floor covers the shell stylesheet').toContain(shellHomeName());
    const offenders = fontSizeFloorOffenders(sheets);

    expect(offenders, `font sizes below the 12px floor:\n  ${offenders.join('\n  ')}`).toEqual([]);
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
    const scrollBox = ruleDeclarations(styleText(source), '.scroll-box');
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
    const scrolls = ruleDeclarations(styleText(source), '.scrolls');
    expect(scrolls).toMatch(/(?:^|;)\s*max-height:\s*320px\s*;/);
    expect(scrolls).toMatch(/(?:^|;)\s*overflow:\s*auto\s*;/);
  });
});

// =============================================================================
// The ONE font-size floor, and the self-tests that keep it single
// (14-04, D-06)
// =============================================================================
//
// The floor used to be per file: 14px everywhere except in the Overview
// folder, which declared a 12px Label and Caption role and so had its own
// 12px floor. That difference was the last shape of the Overview's separate
// design generation, and plan 14-04 retired it.
//
// The assertions below are the single floor, stated as tests: 12px passes
// wherever it is written, 11px fails wherever it is written, and the floor
// applies to a size NAMED AS A TOKEN exactly as it applies to a raw px value.
//
// The last assertion is the one that protects the whole guard: a floor that
// is measured over a list of files is only worth anything if the list has the
// Overview in it. A component folder that fell out of the sweep would be
// exempt from the floor without anybody having decided that it should be.
// =============================================================================
describe('the one font-size floor (14-04, D-06)', () => {
  /** A synthetic stylesheet entry declaring one font size. */
  const entry = (label: string, size: string): Stylesheet => ({
    label,
    source: `.x { font-size: ${size}; }`,
  });

  it('a 12px caption passes wherever it is written', () => {
    expect(
      fontSizeFloorOffenders([entry('src/lib/features/overview/Tile.svelte', '12px')]),
    ).toEqual([]);
    expect(fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', '12px')])).toEqual([]);
    expect(fontSizeFloorOffenders([entry('src/app.css', '12px')])).toEqual([]);
  });

  it('an 11px size fails wherever it is written', () => {
    expect(
      fontSizeFloorOffenders([entry('src/lib/features/overview/Tile.svelte', '11px')]),
    ).toHaveLength(1);
    expect(fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', '11px')])).toHaveLength(1);
  });

  it('a var() that names a 12px token passes', () => {
    expect(
      fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', 'var(--fs-caption)')]),
    ).toEqual([]);
  });

  it('a var() that names no declared token fails', () => {
    expect(
      fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', 'var(--fs-nope)')]),
    ).toHaveLength(1);
  });

  it('the Overview components are inside the sweep this floor is measured over', () => {
    const labels = stylesheetFiles().map(({ label }) => posix(label));
    expect(
      labels.filter((label) => label.includes('features/overview/')),
      'the Overview components are listed by the component sweep',
    ).not.toEqual([]);
  });
});

// =============================================================================
// The token layer in the font-size floor (Phase 14, plan 14-01, D-01)
// =============================================================================
//
// A rule may state its size as `var(--fs-body)` instead of `14px`. The floor
// is a property of the SIZE, so the token has to be resolved before the floor
// can be judged - otherwise every tokenised size would read as "no size at
// all" and the guard would pass on the very rules that carry the design.
//
// A token that is NOT declared stays an offender: the guard cannot tell what
// it resolves to, and a guard that waves an unreadable value through has
// stopped guarding.
// =============================================================================
describe('the font-size token layer (14-01, D-01)', () => {
  /** A synthetic stylesheet entry declaring one font size. */
  const entry = (label: string, size: string): Stylesheet => ({
    label,
    source: `.x { font-size: ${size}; }`,
  });

  it('passes a var() that names a size at or above the floor', () => {
    expect(fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', 'var(--fs-body)')])).toEqual(
      [],
    );
  });

  it('judges a var() against the one floor', () => {
    // `--fs-caption` is 12px, and 12px is the floor: it passes everywhere.
    // The token is RESOLVED before the floor is judged, so the answer is the
    // size the token names and not the text of the declaration.
    expect(
      fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', 'var(--fs-caption)')]),
    ).toEqual([]);
    expect(
      fontSizeFloorOffenders([entry('src/lib/features/overview/Tile.svelte', 'var(--fs-caption)')]),
    ).toEqual([]);
  });

  it('fails a var() that names no declared token', () => {
    expect(
      fontSizeFloorOffenders([entry('src/lib/shell/Shell.svelte', 'var(--fs-nope)')]),
    ).toHaveLength(1);
  });
});
