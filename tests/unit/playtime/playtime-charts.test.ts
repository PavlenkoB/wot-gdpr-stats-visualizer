// =============================================================================
// The Activity charts — the contracts a component-only plan can actually test.
//
// WHY THIS FILE EXISTS
//
// Plan 04-09 adds five Svelte components and one DOM helper. It adds no new
// pure function: every arithmetic decision these charts make — which shade a
// cell gets, where its rect goes, what the arrow keys do, which side of the
// sticky nav the tooltip opens on, how long a duration bar is — was written
// and tested in 04-05 (`playtime-model.test.ts`) and 04-04 (`ui-copy.test.ts`).
// So there is nothing to RED-GREEN at the function level, and inventing a
// module to hold a wrapper around a tested function would be a worse plan, not
// a stricter one.
//
// What is left is the WIRING, and wiring is exactly what silently rots: a
// `viewBox` creeps onto a chart that must never scale, a cell grows an inline
// fill so it no longer reads the one ramp declaration, a "one delegated
// listener" grid grows a per-cell `addEventListener`, the `aria-busy` that the
// UI-SPEC puts on the charts container is put on the wrong element, the D-01
// basis caption moves into a tooltip where a sighted reader cannot see it.
// None of that shows up in a unit test of arithmetic, and all of it shows up
// in the DOM, which plan 04-11 asserts in a browser and plan 04-12 at scale.
//
// So this suite reads the component sources off disk and asserts the
// contracts the UI-SPEC and the plan name, the same way `contrast.test.ts`
// already reads `DashboardNav.svelte` and `app.css` off disk: the colour
// table is a table in a markdown file, so the only way to hold the stylesheet
// to it is to read the stylesheet. The same is true of a hand-rolled Svelte
// component with no module to import — `vitest.config.ts` deliberately has no
// Svelte plugin and cannot render a component at all.
//
// WHAT IS AND IS NOT ASSERTED HERE
//
// Asserted: the things whose failure is silent and whose fix is invisible to a
// passing arithmetic test — roles, test hooks, attribute names, the
// constant-vs-literal distinction, the prohibitions (no `@html`, no inline
// style, no per-cell listener, no `viewBox`, no motion, no ramp hex).
// Not asserted: layout geometry and colour rendering. Those are
// `pnpm run check` (svelte-check's a11y rules) and plan 04-11's Playwright,
// because a regex cannot tell you a 3px focus ring is not clipped.
//
// The file is read LAZILY and a missing file reads as an empty string, so a
// component that has not been written yet fails as a plain assertion failure
// naming the missing contract — never as a module-load crash that would take
// the whole suite down and hide which behaviours are and are not implemented.
// =============================================================================

import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentPath } from '../../helpers/components.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LIB = path.join(REPO_ROOT, 'src/lib');

const CHARTS = 'PlaytimeCharts.svelte';
const GRID = 'HourGrid.svelte';
const CALENDAR = 'CalendarHeatmap.svelte';
const LEGEND = 'ChartLegend.svelte';
const TOOLTIP = 'ChartTooltip.svelte';
const LIST = 'DurationList.svelte';
const BLOCK = 'Playtime.svelte';
const SUMMARY = 'PlaytimeSummary.svelte';
const FOCUS_CLEAR = 'core/focus-clear.ts';

/** The file's source, or `''` when it does not exist yet. */
function source(file: string): string {
  const full = file.endsWith('.ts') ? path.join(LIB, file) : componentPath(file);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/**
 * The source with every comment removed.
 *
 * The prohibitions below are things that must never appear IN THE CODE. A
 * comment that explains why `viewBox` is absent mentions `viewBox`, and a
 * comment that explains why there is no per-cell listener names
 * `addEventListener`; both are exactly what this repo's components should be
 * full of. So the prohibitions read the code, never the prose.
 */
function code(file: string): string {
  return source(file)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('04-09 Task 1 — the charts container, the weekday by hour grid and the legend', () => {
  test('the three chart files exist', () => {
    const missing = [CHARTS, GRID, LEGEND].filter((file) => !existsSync(componentPath(file)));
    expect(missing).toEqual([]);
  });

  test('the container is the one place the charts live, and it is busy while updating', () => {
    // 04-08 recorded the carry-forward: the UI-SPEC's `aria-busy` on the
    // charts container was not placed because the container did not exist.
    // This is where it lands, and it lands on the CONTAINER — in `updating`
    // the previous slice's charts are on screen and correct, which is
    // precisely what "busy" is allowed to mean without hiding them.
    expect(code(CHARTS)).toContain('data-testid="playtime-charts"');
    expect(code(CHARTS)).toMatch(/aria-busy=\{updating\s*\?\s*'true'\s*:\s*'false'\}/);
  });

  test('the hour grid is one fixed-size SVG that is never scaled', () => {
    // ACTIVITY-03's node count must not depend on session count, and the
    // 14px axis text must stay 14px — a `viewBox` with a scaling
    // `preserveAspectRatio` would shrink both.
    expect(code(GRID)).toMatch(/width=\{HOUR_GRID_LAYOUT\.width\}/);
    expect(code(GRID)).toMatch(/height=\{HOUR_GRID_LAYOUT\.height\}/);
    expect(code(GRID)).not.toContain('viewBox');
  });

  test('the hour grid is a role grid of row groups of gridcells', () => {
    expect(code(GRID)).toContain('role="grid"');
    expect(code(GRID)).toContain('role="row"');
    expect(code(GRID)).toContain('role="gridcell"');
    // The interactive role must be focus-supported or svelte-check's
    // `a11y_interactive_supports_focus` fires (RESEARCH Pattern 6).
    expect(code(GRID)).toMatch(/tabindex="-1"/);
  });

  test('every hour cell carries the hooks the UI-SPEC test-hook table names', () => {
    // `hour-cell` is the test id plan 04-11 and 04-12 count, and its
    // attributes are what makes 168 and the "both bases still sum to
    // slice.seconds" check possible from a browser.
    for (const hook of [
      'data-testid="hour-cell"',
      'data-weekday=',
      'data-hour=',
      'data-level=',
      'data-hours=',
      'data-seconds=',
      'data-index=',
    ]) {
      expect(code(GRID)).toContain(hook);
    }
    expect(code(GRID)).toContain('hoursAttribute(');
    expect(code(GRID)).toContain('formatHourCellLabel(');
  });

  test('the grid reads the ONE basis constant, for the caption, the name and the fill', () => {
    // `HOUR_GRID_BASIS` is deliberately unresolved (D-01). A component that
    // hard-codes `overlap` in any of those three places would make flipping
    // the constant a lie for that one place, and flipping it is a one-line
    // change by design (both bases are stored in every slice).
    expect(code(CHARTS)).toContain('HOUR_GRID_BASIS');
    expect(code(GRID)).toContain('HOUR_GRID_BASIS');
  });

  test('the roving tab stop is one cell at 0 and the other 167 at -1', () => {
    expect(code(GRID)).toMatch(/tabindex=\{[^}]*\?\s*0\s*:\s*-1\}/);
  });

  test('the chart title is an h4 and the D-01 basis caption is real text under it', () => {
    // Success criterion 3: the as-recorded basis is VISIBLE, not only in a
    // tooltip or an aria-label. An h3 would skip the heading level; a
    // tooltip would be invisible to the reader the caption is for.
    expect(code(CHARTS)).toMatch(/<h4[^>]*>\s*\{CHART_TITLE_HOUR_GRID\}\s*<\/h4>/);
    expect(code(CHARTS)).toMatch(/<p[^>]*>\s*\{HOUR_GRID_BASIS_CAPTION\}\s*<\/p>/);
  });

  test('the start-basis note is a branch on the constant, never an unconditional second caption', () => {
    // 04-08 accepted the wording and left `HOUR_GRID_BASIS` at `overlap`.
    // A reader told "each session is counted in the hour it starts" while
    // the grid is counting overlap is worse off than one told nothing.
    expect(code(CHARTS)).toMatch(/HOUR_GRID_BASIS\s*===\s*'start'/);
    expect(code(CHARTS)).toContain('HOUR_GRID_START_BASIS_NOTE');
  });

  test('the keyboard hint is real text that the grid is described by', () => {
    expect(code(CHARTS)).toContain('HOUR_GRID_KEYBOARD_HINT');
    expect(code(GRID)).toContain('aria-describedby=');
  });

  test('the legend is a Less-to-More row of aria-hidden swatches and a text note', () => {
    // The swatches carry no information a screen reader needs — the note and
    // every cell's accessible name do — so they are hidden, and the words
    // either side of them are what a reader hears for the scale.
    expect(code(LEGEND)).toContain('LEGEND_LESS');
    expect(code(LEGEND)).toContain('LEGEND_MORE');
    expect(code(LEGEND)).toContain('aria-hidden="true"');
    expect(code(LEGEND)).toMatch(/data-testid=\{testId\}/);
  });

  test('the legend and the cells read the ONE ramp declaration, never a literal hex', () => {
    // `src/app.css` declares `--ramp-0`..`--ramp-5` once and
    // `contrast.test.ts` already fails on any component restating a step; what
    // is asserted here is the positive half — that the components actually
    // reach for the variables, so removing the consumers fails here too.
    for (const level of [0, 1, 2, 3, 4, 5]) {
      expect(code(LEGEND)).toContain(`var(--ramp-${level})`);
      expect(code(GRID)).toContain(`var(--ramp-${level})`);
    }
  });

  test('the Playtime block mounts the container under the summary, for the shown slice', () => {
    // The block renders nothing in any non-ready state, and the charts take
    // the SLICE on screen plus the `updating` flag — not the requested one.
    expect(source(BLOCK)).toContain("import PlaytimeCharts from './PlaytimeCharts.svelte'");
    expect(source(BLOCK)).toMatch(
      /<PlaytimeCharts[\s\S]*?slice=\{readyView\.slice\}[\s\S]*?updating=\{/,
    );
  });

  test('no chart component writes raw HTML, an inline style, or motion', () => {
    for (const file of [CHARTS, GRID, LEGEND]) {
      // Without this the test passes on a file that does not exist: an empty
      // string contains no forbidden token, which is a vacuous green.
      expect(existsSync(componentPath(file)), file).toBe(true);
      const body = code(file);
      // Untrusted `SERVER_NAME` is zip content (T-04-15), the build-time CSP
      // has no `style-src 'unsafe-inline'`, and UI-SPEC section 9 says no
      // animation exists to reduce.
      expect(body, file).not.toContain('{@html');
      expect(body, file).not.toMatch(/\sstyle="/);
      expect(body, file).not.toMatch(/\sstyle:[a-zA-Z-]+=/);
      expect(body, file).not.toMatch(/transition|animation/);
    }
  });
});

describe('04-09 Task 2 — the shared tooltip, the roving keyboard model and the focus ring', () => {
  test('the tooltip element exists with the UI-SPEC section 8 attributes', () => {
    // One shared element for the whole page, `aria-hidden` because every cell
    // already carries the same text as its accessible name, and `hidden`
    // rather than absent so the element never has to be created mid-gesture.
    expect(code(TOOLTIP)).toContain("testId = 'chart-tooltip'");
    expect(code(TOOLTIP)).toContain('data-testid={testId}');
    expect(code(TOOLTIP)).toContain('aria-hidden="true"');
    expect(code(TOOLTIP)).toMatch(/hidden=\{request === null\}/);
  });

  test('the tooltip is positioned through the style object, never an attribute or a rule', () => {
    // The build-time CSP is `default-src 'self'` with no `style-src
    // 'unsafe-inline'` (RESEARCH Pattern 6, probed), so a `style` attribute or
    // `cssText` is blocked outright and `svelte/no-inline-styles` is an error.
    // Writing `el.style.left` and `el.style.top` is the only channel left.
    const body = code(TOOLTIP);
    expect(body).not.toMatch(/setAttribute|cssText/);
    expect(body).not.toMatch(/\sstyle="/);
    expect(body).not.toMatch(/\sstyle:[a-zA-Z-]+=/);
    expect(body).toMatch(/\.style\.left\s*=/);
    expect(body).toMatch(/\.style\.top\s*=/);
  });

  test('the tooltip is placed by the tested model, with the nav offset and a fallback', () => {
    // `clampTooltip` is the whole flip-and-clamp rule and it has unit tests in
    // 04-05; a component that reimplements it would be a second source of
    // truth for "never under the nav". The `--nav-offset` read is the one
    // thing the component must do itself, and 72 is the fallback for a page
    // that never declared the token.
    const body = code(TOOLTIP);
    expect(body).toContain('clampTooltip(');
    expect(body).toContain('--nav-offset');
    expect(body).toMatch(/72/);
  });

  test('the roving stop FOLLOWS focus, so the arrows are relative to the focused cell', () => {
    // A stop that only STARTS at Monday 00:00 is wrong the moment focus
    // arrives any other way — by Tab, by click, or programmatically. Arrows are
    // computed from the stop, so a stop that does not follow focus makes the
    // first press jump to a cell the reader is not on.
    expect(code(GRID)).toMatch(/function onFocusIn[\s\S]*?active = found\.index/);
  });

  test('the tooltip dismisses on resize and on scroll, and scroll is captured', () => {
    // Capture phase, because the grid's own horizontal scroller scrolls
    // without the event ever reaching the window in the bubble phase — a
    // tooltip left behind a moving cell is a tooltip pointing at nothing.
    expect(code(TOOLTIP)).toContain('<svelte:window');
    expect(code(TOOLTIP)).toContain('onresize');
    expect(code(TOOLTIP)).toMatch(/onscroll[^}]*capture/);
  });

  test('the hour grid delegates its pointer, focus and key events on the svg', () => {
    // 168 cells with a listener each is 168 listeners, and the UI-SPEC's scale
    // requirement is that the node count does not depend on the data. Svelte 5
    // delegates these six events at the root (RESEARCH Pattern 6, VERIFIED
    // against svelte/src/utils.js), so six attributes on the svg are six
    // listeners total however much data arrives.
    const body = code(GRID);
    for (const handler of [
      'onpointerover',
      'onpointerout',
      'onfocusin',
      'onfocusout',
      'onkeydown',
      'onpointerdown',
    ]) {
      expect(body, handler).toContain(handler);
    }
    expect(body).not.toMatch(/addEventListener|attachEvent/);
  });

  test('the key model asks the tested reducer, not a local one', () => {
    // The reducer's edge rules (no wrapping at a row boundary, Home/End are
    // the row's own first and last hour) are 04-05's and are unit-tested; a
    // component that computed the next index itself would be free to wrap.
    expect(code(GRID)).toContain('hourGridNavigate(');
  });

  test("the tooltip text is the cell's own two lines, under the same basis", () => {
    // The UI-SPEC requires the tooltip and the accessible name to be the same
    // words, or a screen-reader user and a sighted user are told two different
    // things about one cell.
    expect(code(GRID)).toContain('formatHourCellLine1(');
    expect(code(GRID)).toContain('formatHourCellLine2(');
    expect(code(GRID)).toContain('HOUR_GRID_BASIS');
  });

  test('the focus ring is an overlay drawn last, and only for keyboard focus', () => {
    // A `<rect>` stroke is painted UNDER later siblings, so a ring drawn in
    // place would be covered by the cells to its right and below (Pattern 6).
    // Two rects — 3px accent outside, 1px white inside — drawn after every
    // cell group, and gated on a flag set on keydown and cleared on pointer
    // down, so a mouse click never leaves a ring behind.
    const body = code(GRID);
    expect(body).toContain('focus-ring');
    expect(body).toContain('pointer-events: none');
    expect(body).toMatch(/keyboardFocus/);
    expect(body.lastIndexOf('focus-ring')).toBeGreaterThan(body.lastIndexOf('hour-cell'));
  });

  test('hour grid hover ring is an overlay before the keyboard ring, pointer-driven, sharing the ring CSS and unclipped', () => {
    const body = code(GRID);

    // One pair, like the focus ring: a third or a missing rect is a ring that
    // is lopsided or not there.
    expect(body.match(/class="hover-ring/g) ?? []).toHaveLength(2);

    // After every cell (an earlier ring is covered by later siblings) and
    // BEFORE the keyboard ring, so the keyboard ring stays the last element.
    const hoverAt = body.indexOf('class="hover-ring');
    expect(hoverAt).toBeGreaterThan(body.lastIndexOf('data-testid="hour-cell"'));
    expect(hoverAt).toBeLessThan(body.indexOf('class="focus-ring'));

    // Each handler body is cut at the next top-level function (a line that
    // starts with two spaces and `function`), so a match cannot cross into
    // another function.
    const handler = (name: string): string => {
      const found = new RegExp(`^ {2}(?:async )?function ${name}\\(`, 'm').exec(body);
      expect(found, `${name} exists`).not.toBeNull();
      const start = found?.index ?? 0;
      const rest = body.slice(start + 1);
      const next = /^ {2}(?:async )?function /m.exec(rest);
      return body.slice(start, next === null ? undefined : start + 1 + next.index);
    };
    const over = handler('onPointerOver');
    const out = handler('onPointerOut');

    // Hover is pointer position: it is taken from the cell under the pointer,
    // and it must never be confused with keyboard focus or the roving stop.
    expect(over).toMatch(/hoverIndex\s*=\s*found\.index/);
    expect(over).not.toMatch(/keyboardFocus|\bactive\b/);
    expect(out).not.toMatch(/keyboardFocus|\bactive\b/);
    // Leaving clears it, beside the tooltip dismissal.
    expect(out).toMatch(/hoverIndex\s*=\s*null/);
    // The keyboard handlers never touch the pointer's cell.
    for (const name of ['onFocusIn', 'onFocusOut', 'onKeyDown']) {
      expect(handler(name), `${name} leaves hoverIndex alone`).not.toMatch(/hoverIndex/);
    }
    // A press does not move the pointer, so pressing must not clear the ring,
    // while it still clears the keyboard flag as before. The handler is a
    // NAMED function since 07-03 (a touch tap needs a body with an event to
    // read `pointerType` from, and an inline arrow had no name to be called
    // by), so it is cut out the same way as the other four.
    const press = handler('onPointerDown');
    expect(press).toMatch(/keyboardFocus\s*=\s*false/);
    expect(press).not.toMatch(/hoverIndex/);

    // One declaration list per ring rule, so the hover ring cannot drift from
    // the keyboard ring: same fill, same pointer behaviour, same inner stroke.
    expect(body).toMatch(
      /\.focus-ring,\s*\.hover-ring\s*\{[^}]*fill:\s*none[^}]*pointer-events:\s*none[^}]*\}/,
    );
    expect(body).toMatch(/\.focus-ring-inner,\s*\.hover-ring-inner\s*\{/);

    // The svg must not crop the ring on the bottom row and the last column,
    // where the cell is flush with the svg edge.
    expect(body).toMatch(/(^|\s)svg\s*\{[^}]*overflow:\s*visible/m);

    // No CSS hover on the cell: a stroke on the rect is covered on its right
    // and bottom by the later cells, which is the lopsided ring this avoids.
    expect(body).not.toMatch(/(\.cell|\.level-\d|rect)[^{},]*:hover/);
  });

  test('a focused cell is corrected against the nav, through the shared helper', () => {
    // `scroll-margin-top` is not honoured on an SVG `<rect>` (RESEARCH Pitfall
    // 6), so the correction is a measured `scrollBy` — and the SIGN lives in
    // one helper with its own unit tests rather than at each call site.
    expect(code(GRID)).toContain('scrollClear(');
    expect(code(GRID)).not.toMatch(/scrollBy/);
    const helper = code(FOCUS_CLEAR);
    expect(helper).toContain('focusScrollDelta(');
    expect(helper).toContain('window.scrollBy({ top: delta, behavior:');
  });

  test('the container owns exactly one tooltip state and one tooltip element', () => {
    // 04-10's calendar feeds the SAME element, so a second tooltip here would
    // be two overlapping boxes and two live placements for one pointer.
    const body = code(CHARTS);
    expect(body.match(/<ChartTooltip/g) ?? []).toHaveLength(1);
    expect(body).toMatch(/let tooltip = \$state\.raw<TooltipRequest \| null>\(null\)/);
    expect(body).toContain('onDismiss');
  });

  test('the tooltip component writes no raw HTML, no inline style and no motion', () => {
    // The existence assertion keeps this from passing on an empty string,
    // which is what an absent component reads as.
    expect(existsSync(componentPath(TOOLTIP))).toBe(true);
    const body = code(TOOLTIP);
    expect(body).not.toContain('{@html');
    expect(body).not.toMatch(/transition|animation/);
  });
});

describe('04-09 Task 3 — the session length list', () => {
  test('the list exists and is an ordered list of twelve rows', () => {
    // Twelve always, not twelve only when every bin is populated: the bin
    // edges are the same twelve for every export, so a two-session export
    // still shows where its two sessions fall among the same twelve buckets.
    expect(existsSync(componentPath(LIST))).toBe(true);
    expect(code(LIST)).toContain('<ol');
    expect(code(LIST)).toContain('</ol>');
    expect(code(LIST)).toContain('data-testid="duration-chart"');
    expect(code(LIST)).toContain('aria-label={DURATION_LIST_ARIA_LABEL}');
  });

  test("the rows are the model's rows, named and counted as data", () => {
    // `buildDurationRows` already decided the twelve bins, their order, the
    // share formatting and the widths. A component that re-derived any of it
    // would be a second source of truth for the numbers the copy promises.
    expect(code(CHARTS)).toContain('buildDurationRows(');
    for (const hook of ['data-testid="duration-bin"', 'data-bin=', 'data-count=']) {
      expect(code(LIST)).toContain(hook);
    }
    expect(code(LIST)).toContain('DURATION_BIN_LABELS[row.bin]');
    expect(code(LIST)).toContain('formatDurationRowText(');
  });

  test('nothing in the list is focusable, and it carries no tooltip', () => {
    // Without the existence check this passes on an empty string, which is
    // what an absent component reads as.
    expect(existsSync(componentPath(LIST))).toBe(true);
    expect(code(LIST)).not.toContain('tabindex');
    expect(code(LIST)).not.toContain('role="grid');
    expect(code(LIST)).not.toContain('onpointer');
    expect(code(LIST)).not.toContain('onkeydown');
    expect(code(LIST)).not.toContain('ChartTooltip');
  });

  test('the bars are stretched rects on ONE ramp step, and an empty bin draws no rect', () => {
    // A zero-width bar is a hairline of colour where there is nothing to
    // count, and it reads as "a tiny amount" rather than "none".
    expect(code(LIST)).toMatch(/row\.count > 0/);
    // `barWidth` is a percentage of the largest bin, so it is the rect's own
    // width attribute inside a 0-100 viewBox stretched to the column. The
    // hour grid's "no viewBox" rule is a DIFFERENT rule: it is about 14px axis
    // text and a 24px cell pitch, neither of which a solid rectangle has.
    expect(code(LIST)).toContain('viewBox="0 0 100 12"');
    expect(code(LIST)).toContain('preserveAspectRatio="none"');
    expect(code(LIST)).toContain('width={row.barWidth}');
    // ONE step, not six. The ramp is a sequential scale and these bars are
    // counts of unrelated buckets, so length is the encoding and colour is
    // decoration — a six-step ramp would imply an ordering the reader has to
    // learn and would make the sub-3:1 light steps carry meaning.
    expect(code(LIST)).toContain('var(--ramp-4)');
    expect(code(LIST)).not.toMatch(/var\(--ramp-[0-35]\)/);
  });

  test('the section carries its title and the D-05 explanation, and NO legend', () => {
    // The logarithmic scale has to be stated or every bar comparison is
    // misread, so it is visible text under the title.
    expect(code(CHARTS)).toMatch(/<h4[^>]*>\s*\{CHART_TITLE_DURATION\}\s*<\/h4>/);
    expect(code(CHARTS)).toMatch(/<p[^>]*>\s*\{DURATION_EXPLANATION\}\s*<\/p>/);
    // Still exactly ONE legend: the hour grid's, `hour-legend`. There is no
    // duration legend because the bars are one colour, so a Less-to-More scale
    // would describe a range the chart does not use.
    expect(code(CHARTS)).toContain('testId="hour-legend"');
    expect(code(CHARTS).match(/<ChartLegend/g) ?? []).toHaveLength(1);
  });

  test('both charts are SIBLING sections in the one container', () => {
    // 04-10 added a third: one more <section> in this column, not a nested
    // block, and neither existing chart's placement had to move. The count is
    // the contract that a chart is a SECTION and not a wrapper around one.
    const sections = code(CHARTS).match(/<section class="chart">/g) ?? [];
    expect(sections).toHaveLength(3);
    // And the shared tooltip is a LAST child of the container, not of a
    // chart, so one element serves every chart in it.
    expect(code(CHARTS).match(/<ChartTooltip/g) ?? []).toHaveLength(1);
  });

  test('the duration list writes no raw HTML, no inline style and no motion', () => {
    const body = code(LIST);
    expect(existsSync(componentPath(LIST))).toBe(true);
    expect(body).not.toContain('{@html');
    expect(body).not.toMatch(/\sstyle="/);
    expect(body).not.toMatch(/\sstyle:[a-zA-Z-]+=/);
    expect(body).not.toMatch(/transition|animation/);
  });

  test('the two-line narrow layout is a media query, not a second markup', () => {
    // Below 480px the count moves under the label so a long bin range does not
    // wrap into three lines. Asserted as a media query because a duplicated
    // row for the narrow case would be two places for the copy to diverge.
    expect(code(LIST)).toMatch(/@media \(max-width: 480px\)/);
  });
});

describe('04-10 Task 1 — the calendar heatmap: year blocks, cells and the basis caption', () => {
  test('the calendar component exists and is a THIRD section, before the hour grid', () => {
    // The handover 04-09 left: the container is a flex column of SIBLING
    // sections, so the calendar is one more `<section>` inserted BEFORE the
    // weekday-by-hour one and nothing about either existing chart moves. The
    // ordering is asserted, not just the count — a calendar appended last would
    // put a decade of grids between the reader and the chart they came for.
    expect(existsSync(componentPath(CALENDAR))).toBe(true);
    const body = code(CHARTS);
    expect(body.match(/<section class="chart">/g) ?? []).toHaveLength(3);
    const calendarAt = body.indexOf('CalendarHeatmap');
    const hourGridAt = body.indexOf('<HourGrid');
    expect(calendarAt).toBeGreaterThan(-1);
    expect(hourGridAt).toBeGreaterThan(-1);
    expect(calendarAt).toBeLessThan(hourGridAt);
    // And still exactly ONE tooltip element, shared with the other two charts.
    expect(body.match(/<ChartTooltip/g) ?? []).toHaveLength(1);
  });

  test('the calendar is built from the slice by the tested model, never re-derived', () => {
    // `buildCalendarModel` already decided which years are active, how empty
    // runs collapse, where every rect goes and which shade each day gets. A
    // component that computed any of that itself would be a second source of
    // truth for D-04's node-count rule.
    expect(code(CHARTS)).toContain('buildCalendarModel(');
    expect(code(CALENDAR)).toContain('model.blocks');
    expect(code(CALENDAR)).not.toContain('buildCalendarModel(');
  });

  test("each year's svg is a fixed-size role grid that is never scaled", () => {
    // No `viewBox`: the 626x97 geometry is what puts 54 week columns in the
    // card, and the 14px month and weekday labels must stay 14px. A `viewBox`
    // with a scaling `preserveAspectRatio` would shrink both.
    const body = code(CALENDAR);
    expect(body).toMatch(/width=\{CALENDAR_LAYOUT\.width\}/);
    expect(body).toMatch(/height=\{CALENDAR_LAYOUT\.height\}/);
    expect(body).not.toContain('viewBox');
    expect(body).toContain('role="grid"');
    expect(body).toContain('role="row"');
    expect(body).toContain('role="gridcell"');
    // The interactive role must be focus-supported or svelte-check's
    // `a11y_interactive_supports_focus` fires (RESEARCH Pattern 6).
    expect(body).toMatch(/tabindex="-1"/);
    // And the grid names itself with the year, so a screen reader moving
    // between year grids is told which one it is standing in.
    expect(body).toContain('aria-label={formatCalendarYearLabel(block.year)}');
    expect(body).toContain('aria-describedby=');
  });

  test('the year head is a sticky SIBLING of the scroller, not a child of it', () => {
    // RESEARCH Pitfall 6: a `position: sticky` element inside an `overflow`
    // container sticks to THAT CONTAINER, not to the page, so a head inside
    // the scroller would stop sticking the moment the year scrolled sideways.
    // Asserted on the markup order inside the year block plus the two tokens
    // that make it stick, because either half alone is satisfiable by accident.
    const body = code(CALENDAR);
    expect(body).toContain('data-testid="calendar-year-head-{block.year}"');
    expect(body).toContain('data-testid="calendar-scroller-{block.year}"');
    const headAt = body.indexOf('calendar-year-head-{block.year}');
    const scrollerAt = body.indexOf('calendar-scroller-{block.year}');
    expect(headAt).toBeGreaterThan(-1);
    expect(scrollerAt).toBeGreaterThan(headAt);
    // `top: calc(var(--nav-offset) - 16px)` is the UI-SPEC's derived sticky
    // offset — 56px against a 72px nav, so the head parks UNDER the nav and
    // never under it. `z-index: 0` keeps it below the nav's 1.
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/top:\s*calc\(var\(--nav-offset\)\s*-\s*16px\)/);
    expect(body).toMatch(/z-index:\s*0/);
  });

  test('every day cell carries the hooks the UI-SPEC test-hook table names', () => {
    // `calendar-cell` is the hook 04-11 and 04-12 count, and its attributes
    // are what makes "the cell count equals the days in the active years" and
    // "both the seconds and the session count survive to the DOM" checkable
    // from a browser.
    const body = code(CALENDAR);
    for (const hook of [
      'data-testid="calendar-cell"',
      'data-date=',
      'data-day=',
      'data-level=',
      'data-hours=',
      'data-seconds=',
      'data-sessions=',
    ]) {
      expect(body, hook).toContain(hook);
    }
    expect(body).toContain('hoursAttribute(');
    expect(body).toContain('formatCalendarCellLabel(');
    // And the cell count is the model's, not a filtered one: every day of an
    // active year is drawn so the grid's emptiness is information (D-04).
    expect(body).toContain('cell.x');
    expect(body).toContain('cell.y');
  });

  test('cells read the ONE ramp declaration, never a level interpolated or a hex written', () => {
    // The scale is rank-based (D-04), so the six tokens are the whole
    // vocabulary: interpolating a level (`--ramp-{n}`) or restating a hex in
    // the component would both be a second place the ramp is declared, which
    // is exactly what `contrast.test.ts` fails on.
    const body = code(CALENDAR);
    for (let level = 0; level <= 5; level += 1) {
      expect(body, `level ${level}`).toContain(`var(--ramp-${level})`);
    }
    for (const hex of ['#eef0f2', '#b2dcd4', '#7cc7bc', '#43a89c', '#1f7a74', '#0d4f4c']) {
      expect(body, hex).not.toContain(hex);
    }
    expect(body).not.toMatch(/--ramp-\{/);
  });

  test('a collapsed run of empty years is one line and no grid', () => {
    // The whole defence against a stray 1970 row dragging forty empty
    // 366-cell grids onto the page (T-04-08, UI-SPEC "Collapsing empty years").
    const body = code(CALENDAR);
    expect(body).toContain('data-testid="calendar-empty-run"');
    expect(body).toContain('formatEmptyYearRun(');
    // Branched on the block's OWN kind, so a run cannot reach the year markup.
    expect(body).toMatch(/block\.kind\s*===\s*'empty'/);
  });

  test('the year head states hours, sessions and active days as real text', () => {
    // The relief rule: colour only reinforces, and a reader comparing two
    // years needs all three facts, which the UI-SPEC's year-head row names.
    const body = code(CALENDAR);
    expect(body).toContain('formatYearSummary(');
    expect(body).toMatch(/<h5[^>]*>\s*\{block\.year\}\s*<\/h5>/);
    // The h5 is the year LEVEL: h1 -> h2 section -> h3 Playtime -> h4 chart
    // title -> h5 year. An h4 here would collide with the chart titles.
  });

  test('the calendar carries its own D-01 basis caption under its own h4', () => {
    // Success criterion 3 for the calendar: the dates are as the export
    // records them, said as VISIBLE TEXT, not a tooltip and not an aria-label.
    const body = code(CHARTS);
    expect(body).toMatch(/<h4[^>]*>\s*\{CHART_TITLE_CALENDAR\}\s*<\/h4>/);
    expect(body).toMatch(/<p[^>]*>\s*\{CALENDAR_BASIS_CAPTION\}\s*<\/p>/);
    // The keyboard hint is real text too, and it lives INSIDE the calendar
    // rather than in the container, because the calendar owns the keys it
    // describes: the hour grid's hint sits under ITS title for the same
    // reason, and a hint in the shared container would read as applying to all
    // three charts, two of which answer different keys.
    expect(code(CALENDAR)).toContain('CALENDAR_KEYBOARD_HINT');
    expect(code(CALENDAR)).toMatch(/<p[^>]*id=\{hintId\}/);
  });

  test('one legend for the whole calendar, since the scale is shared across years', () => {
    // A legend per year would imply a per-year scale, and the UI-SPEC says the
    // scale is computed once across all years so a dark day means the same
    // amount of play in 2012 and in 2024.
    expect(code(CALENDAR)).toMatch(/<ChartLegend/);
    expect(code(CALENDAR)).toContain('testId="calendar-legend"');
    expect(code(CALENDAR)).toContain('formatCalendarLegendNote(');
    expect(code(CALENDAR).match(/<ChartLegend/g) ?? []).toHaveLength(1);
  });

  test('the calendar writes no raw HTML, no inline style and no motion', () => {
    const body = code(CALENDAR);
    // Without the existence assertion this passes on an empty string, which
    // is what an unwritten component reads as.
    expect(existsSync(componentPath(CALENDAR))).toBe(true);
    // Untrusted zip content, the build-time CSP with no `style-src
    // 'unsafe-inline'`, and UI-SPEC section 9: no animation exists to reduce.
    expect(body).not.toContain('{@html');
    expect(body).not.toMatch(/\sstyle="/);
    expect(body).not.toMatch(/\sstyle:[a-zA-Z-]+=/);
    expect(body).not.toMatch(/transition|animation/);
  });
});

describe('04-10 Task 2 — the roving tab stop, the shared tooltip and the measured clearance', () => {
  test('the calendar delegates its pointer, focus and key events on each year svg', () => {
    // Up to 366 rects a year and dozens of years: a listener per cell is a
    // listener count that grows with the data, which is what the scale
    // requirement forbids. Svelte 5 delegates these six events at the root
    // (RESEARCH Pattern 6), so six attributes per svg is six listeners total.
    const body = code(CALENDAR);
    for (const handler of [
      'onpointerover',
      'onpointerout',
      'onfocusin',
      'onfocusout',
      'onkeydown',
      'onpointerdown',
    ]) {
      expect(body, handler).toContain(handler);
    }
    expect(body).not.toMatch(/addEventListener|attachEvent/);
    // Cells are resolved from the event target with `closest` on their
    // `data-day`, not from a per-cell closure.
    expect(body).toMatch(/closest\('\[data-day\]'\)/);
  });

  test('the roving stop follows focus, and the key model asks the tested reducer', () => {
    // 04-09's D3, applied here: a stop that only STARTS at the initial day is
    // wrong the moment focus arrives by Tab, by click or programmatically, and
    // the arrows are computed from the stop — so a stop that does not follow
    // focus makes the first press jump a cell the reader is not on.
    expect(code(CALENDAR)).toMatch(/function onFocusIn[\s\S]*?activeDay = found\.day/);
    // The reducer's edge rules (no wrapping at a week column edge, Home/End
    // the year's own first and last week, PageUp/PageDown skipping collapsed
    // runs) are 04-05's and unit-tested; a local one would be free to wrap.
    expect(code(CALENDAR)).toContain('calendarNavigate(');
    // And the focus day is the drawn one, falling back to the model's initial
    // day when a selector change removes the year the stop was on — otherwise
    // the single tab stop can land on a cell that no longer exists.
    expect(code(CALENDAR)).toContain('isDrawnDay(');
    expect(code(CALENDAR)).toContain('initialCalendarFocus(');
  });

  test('the eight navigation keys are prevented whether or not they move', () => {
    // 04-09's D4. At a week-column edge the reducer returns the same day, and
    // an unprevented arrow key there is the BROWSER scrolling the page: the
    // calendar stays put while the page moves out from under the focused cell
    // and closes the tooltip on the way past.
    const body = code(CALENDAR);
    expect(body).toMatch(/event\.preventDefault\(\)/);
    for (const key of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ]) {
      expect(body, key).toContain(`'${key}'`);
    }
    // Escape hides the tooltip and does not move focus.
    expect(body).toMatch(/event\.key\s*===\s*'Escape'/);
  });

  test('the calendar passes its day cell as the tooltip anchor', () => {
    // 04-09's D2. `TooltipRequest` holds numbers by design, so the element
    // travels BESIDE it as a second argument; without a real anchor the shared
    // tooltip cannot tell a correction scroll from a reader scrolling away,
    // and it dismisses on the correction the focus itself caused.
    const body = code(CALENDAR);
    expect(body).toMatch(/onTip\(\s*\{[\s\S]*?anchor: rectOf\(/);
    expect(body).toContain('getBoundingClientRect()');
    // Line 1 is the recorded date and line 2 the hours-and-sessions pair, the
    // same words the cell's accessible name is built from (UI-SPEC section 8).
    expect(body).toContain('formatCalendarDate(');
    expect(body).toContain('formatCalendarTooltipLine2(');
    // The same `showTip` the hour grid calls, so there is one owner.
    expect(code(CHARTS)).toMatch(/<CalendarHeatmap[\s\S]*?onTip=\{showTip\}/);
  });

  test('the scroll clearance passes the year head MEASURED height, never 32', () => {
    // RESEARCH Pitfall 6: the head is 32px of declared height whose real
    // height grows when its summary wraps at narrow widths, and a head
    // assumed to be 32px is a head that overlaps the grid at 375px. The hour
    // grid passes 0 because nothing is above it; the calendar passes what it
    // measured, and the sign and `behavior: 'instant'` live in the one helper.
    const body = code(CALENDAR);
    expect(body).toContain('scrollClear(');
    expect(body).toMatch(/scrollClear\([\s\S]*?offsetHeight/);
    expect(body).not.toMatch(/scrollBy/);
    const helper = code(FOCUS_CLEAR);
    // The delta IS the scroll to apply: it is negative when the cell is short
    // of the clear line, a negative top scrolls the page up, and that moves
    // the cell down on screen and out from under the chrome. The scroll must
    // also be instant, or the tooltip the focus opened is dismissed by the
    // correction that caused the focus.
    expect(helper).toContain("window.scrollBy({ top: delta, behavior: 'instant' })");
  });

  test('the focus ring is an unclipped overlay drawn last, and only for keyboard focus', () => {
    // A `<rect>` stroke paints with the rect, so a ring drawn in place is
    // covered by the cells to its right and below (RESEARCH Pattern 6). Two
    // rects, drawn after every row group, gated on a flag set on keydown and
    // cleared on pointerdown, so a mouse click never leaves a ring behind.
    const body = code(CALENDAR);
    expect(body).toContain('focus-ring');
    expect(body).toContain('pointer-events: none');
    expect(body).toMatch(/keyboardFocus/);
    expect(body.lastIndexOf('focus-ring')).toBeGreaterThan(body.lastIndexOf('calendar-cell'));
    // The 10px cells leave no room inside for a 3px ring, so the scroller
    // carries vertical padding and the svg allows overflow — otherwise the ring
    // is clipped on the bottom row and the rightmost column.
    expect(body).toMatch(/overflow:\s*visible/);
    expect(body).toMatch(/\.scroller\s*\{[\s\S]*?padding:\s*4px\s+0/);
    // One ring only, for the day that has focus, and only in its own year.
    expect(body.match(/class="focus-ring/g) ?? []).toHaveLength(2);
  });

  test('the hover ring is an overlay before the keyboard ring, pointer-driven and sharing the ring CSS', () => {
    const body = code(CALENDAR);

    // One pair, like the focus ring: a third or a missing rect is a ring that
    // is lopsided or not there.
    expect(body.match(/class="hover-ring/g) ?? []).toHaveLength(2);

    // After every cell (an earlier ring is covered by later siblings) and
    // BEFORE the keyboard ring, so the keyboard ring stays the last element.
    const hoverAt = body.indexOf('class="hover-ring');
    expect(hoverAt).toBeGreaterThan(body.lastIndexOf('data-testid="calendar-cell"'));
    expect(hoverAt).toBeLessThan(body.indexOf('class="focus-ring'));

    // The lifecycle lives in the two delegated pointer handlers. Each body is
    // cut at the next top-level function so a match cannot cross into another.
    const handler = (name: string): string => {
      const start = body.indexOf(`function ${name}(`);
      expect(start, `${name} exists`).toBeGreaterThanOrEqual(0);
      const next = body.indexOf('\n  function ', start + 1);
      return body.slice(start, next === -1 ? undefined : next);
    };
    const over = handler('onPointerOver');
    // Hover is pointer position: it is taken from the cell under the pointer,
    // and it must never be confused with keyboard focus.
    expect(over).toMatch(/hoverDay\s*=\s*found\.day/);
    expect(over).not.toMatch(/keyboardFocus/);
    // Leaving clears it, beside the tooltip dismissal.
    expect(handler('onPointerOut')).toMatch(/hoverDay\s*=\s*null/);
    // A click does not move the pointer, so pressing must not clear the ring.
    expect(handler('onPointerDown')).not.toMatch(/hoverDay/);

    // One declaration list per ring rule, so the hover ring cannot drift from
    // the keyboard ring: same fill, same pointer behaviour, same inner stroke.
    expect(body).toMatch(
      /\.focus-ring,\s*\.hover-ring\s*\{[^}]*fill:\s*none[^}]*pointer-events:\s*none[^}]*\}/,
    );
    expect(body).toMatch(/\.focus-ring-inner,\s*\.hover-ring-inner\s*\{/);

    // No CSS hover on the cell: a stroke on the rect is covered on its right
    // and bottom by the later cells, which is the lopsided ring this avoids.
    expect(body).not.toMatch(/(\.cell|\.level-\d|rect)[^{},]*:hover/);
  });

  test('one cell in the whole chart carries tabindex 0 at any time', () => {
    // The UI-SPEC's "one tab stop for the whole chart, across all years": Tab
    // enters the calendar and leaves it on the next Tab, and the cell that
    // holds the stop is the focus day, wherever in the year stack it is.
    const body = code(CALENDAR);
    expect(body).toMatch(/tabindex=\{[^}]*\?\s*0\s*:\s*-1\}/);
  });
});

// =============================================================================
// 04-14 — the two states the code review found, as source contracts.
//
// WHAT THESE ARE, PRECISELY
// Neither fix is in a pure function: both are in the block's `load`, so they
// cannot be reached from a suite that has no Svelte plugin. The behavioural
// proofs are real-Chromium tests in `tests/e2e/playtime/playtime.spec.ts` (a post that
// throws, and a second tab clearing the cache) and they are the claims that
// matter. What is left here is the cheapest possible guard against a REGRESSION
// being reintroduced by a refactor that is told to "tidy up" these two lines —
// they assert the shape that carries each invariant, in the same way the
// contracts above assert shapes instead of pixels.
//
// They are honest about their reach: a regex cannot tell you what a user sees.
// =============================================================================
describe('04-14 — a failed and a dropped selection change both reconcile', () => {
  test('the announcement is written on the answer applied, and cleared on every other one', () => {
    // WR-1. `announcement` used to be written only on the ready-view path, so
    // a FAILED query left the previous slice's sentence in the live region,
    // directly above the error box, describing numbers that were no longer on
    // screen. `statusLine` returns it unchanged for every non-loading state, so
    // nothing downstream could have cleared it.
    const body = code(BLOCK);
    expect(body).toMatch(
      /announcement = selectionAnnouncement\(accepted\.view\);\s*\} else \{\s*announcement = '';/,
    );
  });

  test('a dropped answer reconciles the request, unless the ask itself is stale', () => {
    // WR-2. `onSelectChange` writes `requested` BEFORE the query, so an
    // answer `acceptOutcome` drops for a non-fatal reason (no view, or a
    // stamp that is not the ask's) leaves `requested` naming a slice nothing
    // will ever answer for, and the block reads "Updating charts..." forever.
    // The roll-back is gated twice, and both gates are the point: a SUPERSEDED
    // answer must not pull `requested` back over a newer request, and an ask
    // that is no longer the requested one must not rewrite it either.
    const body = code(BLOCK);
    expect(body).toMatch(
      /if \(accepted === null\) \{[\s\S]*?if \(\s*outcome\.kind !== 'superseded' &&\s*wanted === importedAt &&\s*requested\?\.valueIndex === ask\.valueIndex\s*\) \{[\s\S]*?requested = \{ importedAt: wanted, valueIndex: shown\?\.valueIndex \?\? null \};[\s\S]*?return;/,
    );
  });
});

// =============================================================================
// 04-18 — the tile value and the legend note (UAT G-04-UI-2 and the legend
// clause of G-04-UI-3)
// =============================================================================
//
// WHAT THIS DESCRIBE IS, AND IS NOT
// It pins the CAUSE of two layout defects the browser tests in
// `tests/e2e/playtime/playtime-ui-review.spec.ts` measure: the stylesheet properties that
// make a value unbreakable and a legend note its own line. It does not assert
// what a reader sees — a regex cannot tell you a "2,467" is one line, and 04-18's
// browser tests measure exactly that.
//
// Why a source shape at all, when a computed style would be the obvious
// assertion: the property that broke the tile IS the property a style assertion
// would check. `overflow-wrap: anywhere` on the dd is what the browser honoured
// and what made the numeral break mid-number. Reading the declaration back pins
// the rule that produced the measurement, and it fails on the OLD source — which
// a `getComputedStyle` test could not, because the old computed style is the one
// that was already wrong.

describe('04-18: tile and legend layout contracts', () => {
  /**
   * One rule's declarations, by selector, scoped to the braces of that rule.
   *
   * Scoped because these assertions are about ONE rule each. A `toContain` over
   * the whole stylesheet would be satisfied by a different rule or by prose, and
   * a selector matched without its braces would be satisfied by another
   * selector's list. A rule that is not there yields `''`, so the assertion
   * below names the rule it did not find instead of throwing on a null match.
   */
  function rule(body: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^{}]*)\\}`, 'm').exec(body);
    return match?.[1] ?? '';
  }

  test('a tile value wraps as a pair, and neither part of it ever breaks', () => {
    // G-04-UI-2. The dd is a flex ROW of a Display numeral and a Label unit, so
    // the only two outcomes that keep a figure readable are "both on one line"
    // and "the whole unit below the whole numeral". The break-inside-the-part
    // outcome needs two rules the old stylesheet did not have: a row that may
    // wrap at all, and a value that may not be broken to fit.
    const body = code(SUMMARY);
    const dd = rule(body, 'dd');
    const unit = rule(body, '.unit');

    expect(dd, 'the summary dd rule').toContain('flex-wrap: wrap');
    // NOT `anywhere`. That rule came from the UI-SPEC's blanket sentence about
    // children holding untrusted text, and it is kept for the split table's
    // cells and the notes — never for a formatted number and a fixed word, where
    // it let both flex items shrink to one character.
    expect(dd, 'the summary dd rule').toContain('overflow-wrap: normal');
    expect(dd, 'the summary dd rule').not.toContain('overflow-wrap: anywhere');
    // The unit is one word: even without the anywhere rule, "hours" is the
    // shortest thing in this component that a narrow tile could still split.
    expect(unit, 'the summary .unit rule').toContain('white-space: nowrap');

    // The cause is held in place by the RULES that were changed, and the two
    // tiles' minimum width and the 128px grid track are what keep two per row
    // at 375px. Neither may be "fixed" by widening the tile instead.
    expect(rule(body, 'dl'), 'the summary dl rule').toContain('minmax(128px, 1fr)');
  });

  test('the legend note is always its own full row, 8px under the swatch row', () => {
    // G-04-UI-3, legend clause. The note was a fourth item in the same wrapping
    // row, so a short note sat on More's line and a long one wrapped BY
    // ACCIDENT, each 4px under the row. A full-row basis makes the placement a
    // rule instead of a consequence of the sentence's length, and the row gap
    // carries the UI-SPEC's 8px `sm` step down to it.
    const body = code(LEGEND);
    const row = rule(body, '.row');
    const note = rule(body, '.note');

    // The shorthand `gap: <row> <column>`, or the two longhands. Both are the
    // same declaration written two ways and both are accepted here, because the
    // claim is the 8px between the rows, not the spelling.
    const rowGap = /gap:\s*8px\s+4px\b/.test(row) || /row-gap:\s*8px\b/.test(row) ? '8px' : 'no';
    expect(rowGap, 'the legend row rule declares an 8px row gap').toBe('8px');
    expect(row, 'the legend row rule').toMatch(/gap:\s*8px\s+4px\b|row-gap:\s*8px\b/);
    // Less, the swatches and More stay 4px apart: the 8px is between ROWS, and
    // widening the swatch spacing instead is the regression this pins.
    expect(row, 'the legend row rule').toMatch(/gap:\s*8px\s+4px\b|column-gap:\s*4px\b/);
    // A note that only takes a new line when it does not fit is the defect.
    expect(note, 'the legend .note rule').toContain('flex-basis: 100%');
  });
});
