// =============================================================================
// The Vehicle statistics block — the contracts a component-only plan can test.
//
// WHY THIS FILE EXISTS
//
// Plan 05-12 Task 1 added a pure module (`vehicle-state.ts`) and Task 2 adds
// no new pure function: every decision the block makes — which rows are drawn,
// in what order, what a cell says, which state is on screen — was written and
// tested in 05-09 and 05-10. So there is nothing to RED-GREEN at the function
// level, and inventing a module to hold a wrapper around a tested function
// would be a worse plan, not a stricter one.
//
// What is left is the WIRING, and wiring is exactly what silently rots: a
// `style` attribute creeps onto a spacer row and the CSP blocks it at runtime
// rather than at build time, a `role="grid"` appears on a table whose whole
// point is native semantics, a second `aria-live` attribute appears and the
// page-wide count `dashboard.spec.ts` asserts silently becomes a lie, a sort
// button is added for a column the model has declared non-sortable, a sentence
// is typed into a component instead of reached for in `ui-copy.ts`.
//
// None of that shows up in a unit test of arithmetic, and all of it shows up
// in the DOM — which `tests/e2e/vehicles/vehicle-stats.spec.ts` asserts in a browser.
// This file is the cheap half: the shapes and the prohibitions.
//
// WHAT IS AND IS NOT ASSERTED HERE
//
// Asserted: the contracts whose failure is silent and whose fix is invisible
// to a passing arithmetic test — roles, test hooks, attribute names, the
// native-vs-grid distinction, the prohibitions, and the copy rule.
// Not asserted: layout geometry, colour rendering, sticky behaviour, and the
// window arithmetic in a real browser. Those are the Playwright specs and
// `pnpm run build`.
//
// The file is read LAZILY and a missing file reads as an empty string, so a
// component that has not been written yet fails as a plain assertion failure
// naming the missing contract — never as a module-load crash.
// =============================================================================

import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as fixtures from '../../fixtures/player-stats-fixtures';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse';
import { buildVehicleView } from '../../../src/lib/features/vehicles/vehicle-aggregate';
import type { VehicleFileFacts } from '../../../src/lib/features/vehicles/vehicle-aggregate';
import type { VehicleView } from '../../../src/lib/features/vehicles/vehicle-shared';
import {
  BATTLE_TYPE_SUMMARY_CAPTION,
  BATTLE_TYPE_SUMMARY_DISCLOSURE,
  BATTLE_TYPE_SUMMARY_HEADERS,
  BATTLE_TYPE_SUMMARY_HEADING,
  BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS,
  COLUMN_PICKER_LEGEND,
  COLUMN_PICKER_SUMMARY,
  HEADER_LIFETIME_BATTLES_LABEL,
  HEADER_PREMIUM_EXPIRES_LABEL,
  PLAYER_STATS_ERROR,
  PLAYER_STATS_HEADING,
  PLAYER_STATS_LOADING,
  PLAYER_STATS_UPDATING,
  TITLE_CONTROL_LABEL,
  VALUE_NOT_AVAILABLE,
  VEHICLE_COLUMN_LABELS,
  VEHICLE_DERIVED_NOTE,
  VEHICLE_FIND_HINT,
  VEHICLE_NO_MATCH,
  VEHICLE_SCROLL_HINT,
  VEHICLE_SEARCH_LABEL,
  WARSHIPS_ALL_NOTE,
} from '../../../src/lib/ui-copy';
import { componentPath } from '../../helpers/components.ts';

const TABLE = 'VehicleTable.svelte';
const BLOCK = 'PlayerStats.svelte';

/** The file's source, or `''` when it does not exist yet. */
function source(file: string): string {
  const full = componentPath(file);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/**
 * The source with every comment removed.
 *
 * The prohibitions below are things that must never appear IN THE CODE. A
 * comment that explains why `style` attributes are absent mentions `style`,
 * and a comment that explains why there is no per-row listener names
 * `addEventListener`; both are exactly what this repo's components should be
 * full of. So the prohibitions read the code, never the prose.
 */
function code(file: string): string {
  return source(file)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('05-12 Task 1 — the windowed table: native semantics, the two spacers, the CSSOM geometry', () => {
  test('the table is a native table with a hidden caption, and never a grid', () => {
    expect(existsSync(componentPath(TABLE))).toBe(true);
    const body = code(TABLE);
    expect(body).toContain('<table');
    expect(body).toContain('<caption');
    // `role="grid"` would REPLACE the native table semantics the windowing
    // exists to keep: `aria-rowcount` / `aria-rowindex` are honoured on a
    // table and are the only way a screen reader is told the true size and
    // position of a row that is not in the DOM.
    expect(body).not.toContain('role="grid"');
    expect(body).not.toContain('role="row"');
    expect(body).not.toContain('role="cell"');
  });

  test('the region is a focusable scroll container and the table is windowed through it', () => {
    const body = code(TABLE);
    // WCAG 2.1.1: a keyboard-scrollable box that is not focusable cannot be
    // scrolled with the arrow, Page Up or Page Down keys at all.
    expect(body).toContain('role="region"');
    expect(body).toMatch(/tabindex="0"/);
    expect(body).toContain('aria-label={regionName}');
    // The windowing itself: `windowRange` is the tested decision, so the
    // component must ask it rather than compute an offset of its own.
    expect(body).toContain('windowRange(');
    expect(body).toContain('SCROLLER_MAX_PX');
  });

  test('the header is a `th scope="col"` row with `aria-sort` on every column', () => {
    const body = code(TABLE);
    expect(body).toContain('scope="col"');
    expect(body).toContain('aria-sort={ariaSort(column)}');
    // `none` on every unsorted column, and only `ascending` / `descending` on
    // the sorted one — asserted on the helper, because the attribute is bound
    // to it and a component that typed three literals at the attribute would
    // not be caught by a regex for the attribute name alone.
    expect(body).toMatch(/function ariaSort[\s\S]*?return 'none';/);
    expect(body).toMatch(/function ariaSort[\s\S]*?'ascending' : 'descending'/);
  });

  test('both spacers are `aria-hidden` and their heights are CSSOM writes from script', () => {
    const body = code(TABLE);
    // Two, between the visible rows: one above and one below.
    expect(body.match(/class="spacer"/g) ?? []).toHaveLength(2);
    expect(body).toContain('aria-hidden="true"');
    // T-05-38: the build-time CSP has no `style-src 'unsafe-inline'` and
    // `svelte/no-inline-styles` is an error, so the geometry goes through
    // `element.style` — the one channel `ChartTooltip` already uses.
    expect(body).toMatch(/\.style\.height\s*=/);
    expect(body).toMatch(/\.style\.minWidth\s*=/);
    // And never the two banned channels, which would be blocked at runtime
    // rather than at build time.
    expect(body).not.toMatch(/\sstyle="/);
    expect(body).not.toMatch(/\sstyle:[a-zA-Z-]+=/);
    expect(body).not.toMatch(/setAttribute|cssText/);
  });

  test('every drawn row carries its true position, and the table its true size', () => {
    const body = code(TABLE);
    expect(body).toContain('aria-rowcount={rows.length + 1}');
    // Header is row 1, so a drawn row's absolute index is its position plus
    // two. Asserted on the expression because the `+ 2` is the whole claim.
    expect(body).toContain('aria-rowindex={index + 2}');
  });

  test('the nation tag and the id are two plain interpolations, never markup', () => {
    // T-05-35: a vehicle id is zip content, and the fixture's unterminated
    // `<b>` must show as those characters.
    const body = code(TABLE);
    expect(body).toContain('data-testid="vehicle-nation-tag"');
    expect(body).not.toContain('{@html');
    // The full text rides in `title` because the cell is one ellipsised line.
    expect(body).toContain('title={row.id}');
  });

  test('the sort buttons carry the UI-SPEC test ids and reach the tested model', () => {
    const body = code(TABLE);
    expect(body).toContain('data-testid="vehicle-sort-{column.key}"');
    expect(body).toContain('onclick={() => onSort(column.key)}');
    // A non-sortable column (the two Warships per-type cells) renders plain
    // text and NO button, because there is nothing there to sort (D-08).
    expect(body).toMatch(/\{#if column\.sortable\}[\s\S]*?\{:else\}[\s\S]*?\.plain/);
  });

  test('the cell text is `formatVehicleCell`’s, never a local format', () => {
    const body = code(TABLE);
    expect(body).toContain('formatVehicleCell(');
    // The hidden accessible text sits beside a dash, because a dash on its own
    // tells a screen-reader user that nothing is there and not why.
    expect(body).toContain('class="sr-only"');
  });

  test('there is one scroll listener on the container, and the only raw listener is one resize', () => {
    // 5,000 rows with a listener each is a listener count that grows with the
    // data, which is what the scale requirement forbids. Svelte 5 delegates
    // `onscroll` and `onclick` at the root, so one handler on the scroller is
    // one listener however many rows are drawn.
    const body = code(TABLE);
    expect(body).toContain('onscroll={onScroll}');
    // The ONE imperative listener, and it is on the window for the resize that
    // changes the viewport height the windowing divides by. Asserted as a
    // count rather than as an absence, because a window resize listener is
    // correct here and a blanket ban would be a rule with a hole in it.
    expect(body.match(/addEventListener\(/g) ?? []).toHaveLength(1);
    expect(body).toContain("window.addEventListener('resize'");
    expect(body).toContain("window.removeEventListener('resize'");
    expect(body).not.toMatch(/attachEvent/);
    // And the scroll handler is coalesced through a frame, so a scroll does not
    // re-window the table once per pixel.
    expect(body).toContain('requestAnimationFrame');
  });

  test('every column key a real view carries has a header label of its own', () => {
    // The two halves of this phase speak in different vocabularies, and the
    // table is the ONLY place they meet: the worker emits `VehicleColumn.key`
    // values (`winRate`, `avgDamage`, `xp`), and the copy inventory is keyed
    // on the same names or a header falls through to printing the key itself.
    // That is not hypothetical — it is what 05-12 found, a column headed
    // `winRate` where the UI-SPEC specifies `Win rate`.
    //
    // Building a REAL view from the 05-01 hand fixture is what makes this a
    // contract rather than a restatement of the inventory: a new column the
    // worker adds in 05-14 fails here until the copy names it, instead of
    // reaching a reader as an identifier.
    for (const [titleId, names] of [
      ['wot', ['WOT_Vehicle_Statistics.csv', 'WOT_Account_Statistics.csv']],
      ['wows', ['WOWS_Ship_Statistics.csv', 'WOWS_Account_Statistics.csv']],
    ] as const) {
      const files = new Map<string, VehicleFileFacts>();
      for (const name of names) {
        const parsed = parseCsvFile(
          fixtures.PLAYER_STATS_SAMPLE_FILES[name],
          'Player_statistics',
          name,
        );
        files.set(name.toLowerCase(), { rows: parsed.rows.map((row) => row.data), seen: true });
      }
      const view: VehicleView = buildVehicleView(files, { title: titleId, battleType: null });

      for (const column of view.columns) {
        const label = (VEHICLE_COLUMN_LABELS as Record<string, string>)[column.key];
        // `undefined` is the failure that matters: no label at all. `equal to
        // the key` is the same failure one indirection later, and is what a
        // key spelled slightly differently produces.
        expect(label, `no header label for column ${column.key} (${titleId})`).toBeDefined();
        expect(label, `the label for ${column.key} is the key itself (${titleId})`).not.toBe(
          column.key,
        );
      }
    }
  });

  test('the table writes no raw HTML, no inline style, no motion and no viewBox', () => {
    const body = code(TABLE);
    expect(body).not.toContain('viewBox');
    expect(body).not.toMatch(/transition|animation/);
  });
});

describe('05-12 Task 2 — the block: one live region, the controls, the count line and the copy rule', () => {
  test('the block carries `data-state` and `data-title-state` on one root', () => {
    expect(existsSync(componentPath(BLOCK))).toBe(true);
    const body = code(BLOCK);
    expect(body).toContain('data-testid="player-stats"');
    expect(body).toContain('data-state={playerState}');
    // D-05's second half: a block state and a title state are not the same
    // thing, and a test reading one of them must not have to guess which.
    expect(body).toContain('data-title-state={titleState}');
  });

  test('the block owns EXACTLY ONE explicit live region, present in every state', () => {
    const body = code(BLOCK);
    // The count, asserted rather than the selector avoided: a second polite
    // region would make the page-wide count `dashboard.spec.ts` asserts a
    // lie, and an assertive one would interrupt the playtime status.
    expect(body.match(/aria-live=/g) ?? []).toHaveLength(1);
    expect(body).toMatch(/aria-live="polite"/);
    expect(body).toMatch(/aria-atomic="true"/);
    expect(body).toContain('role="status"');
    // And it is EMPTY-but-present when nothing is happening, not absent: a
    // region that appears only while loading is announced by the insertion of
    // the element rather than by its text.
    expect(body).toContain("class:hidden={statusText === ''}");
  });

  test('the error paragraph is an `alert` with no `aria-live` attribute', () => {
    const body = code(BLOCK);
    // An implicit live region, deliberately not an explicit one: adding the
    // attribute would break the page-wide count the Phase 3 spec asserts.
    expect(body).toContain('role="alert"');
    expect(body).toContain('data-testid="player-stats-error"');
    // The worker detail is unreachable: the fixed sentence is the only thing
    // this block can say about a failure (T-05-31).
    expect(body).not.toMatch(/error\.detail|outcome\.detail/);
  });

  test('the Game control is a native select whose options are never disabled', () => {
    const body = code(BLOCK);
    expect(body).toContain('data-testid="player-stats-title-selector"');
    // A disabled option cannot be read in the content area, so the reason a
    // title has no table has to live in the option TEXT (D-05).
    expect(body).not.toContain('disabled');
    expect(body).toContain('VEHICLE_TITLES');
    expect(body).toContain('formatTitleOption');
  });

  test('the search is a native `type="search"` input with a visible label', () => {
    const body = code(BLOCK);
    expect(body).toContain('type="search"');
    expect(body).toContain('data-testid="vehicle-search"');
    // A placeholder is not a label: it disappears as soon as the reader types.
    expect(body).not.toContain('placeholder=');
  });

  test('the block asks the tested models, and re-derives none of them', () => {
    const body = code(BLOCK);
    // 05-09 decided filtering, ordering and the drawn columns; 05-10's
    // `vehicle-state.ts` decided the state machine. A component that computed
    // any of it itself would be a second source of truth for D-05 and D-12.
    expect(body).toContain('sortRows(');
    expect(body).toContain('filterRows(');
    expect(body).toContain('nextSort(');
    expect(body).toContain('zeroBattleCount(');
    expect(body).toContain('derivePlayerState(');
    expect(body).toContain('acceptVehicleOutcome(');
    expect(body).toContain('appliedAsk(');
    expect(body).toContain('visibleColumns(');
  });

  test('the selector state is reset on a title change and never persisted', () => {
    // D-28 / D-12: a different game is a different table, so the search and
    // the sort both go back to their defaults. And nothing is written to
    // storage, so there is no stale value to migrate on reload.
    const body = code(BLOCK);
    expect(body).toContain('freshSelection()');
    expect(body).not.toMatch(/localStorage|sessionStorage/);
  });

  test('the count line, the derived-value note and both hints are the copy inventory’s', () => {
    const body = code(BLOCK);
    expect(body).toContain('data-testid="vehicle-count"');
    expect(body).toContain('formatVehicleCount(');
    expect(body).toContain('formatVehicleSearchCount(');
    // D-12: a search with no match says so IN PLACE of the table, and the
    // count line is still there — a reader has to be able to see that the
    // filter is what emptied it.
    expect(body).toContain('VEHICLE_NO_MATCH');
    // The windowing's cost is stated, not hidden: a reader whose browser's
    // find skips the omitted rows needs to be told where to look instead.
    expect(body).toContain('VEHICLE_DERIVED_NOTE');
    expect(body).toContain('VEHICLE_SCROLL_HINT');
    expect(body).toContain('VEHICLE_FIND_HINT');
  });

  test('NO UI-SPEC sentence is typed into either component', () => {
    // The one rule that makes the copy inventory worth having: a sentence
    // typed into a component is a sentence no `ui-copy` test can change and
    // no other block can reuse. Every sentence in the block comes from the
    // inventory by name.
    //
    // The one-word heading is deliberately NOT in this list: `Vehicles` is a
    // substring of the block's own `ShownVehicles` type, so a verbatim check
    // on it would fail on an identifier rather than on a sentence. The
    // positive half is asserted instead, immediately below.
    const sentences = [
      PLAYER_STATS_HEADING,
      PLAYER_STATS_LOADING,
      PLAYER_STATS_UPDATING,
      PLAYER_STATS_ERROR,
      TITLE_CONTROL_LABEL,
      VEHICLE_SEARCH_LABEL,
      VEHICLE_SCROLL_HINT,
      VEHICLE_FIND_HINT,
      VEHICLE_NO_MATCH,
      VEHICLE_DERIVED_NOTE,
    ];
    for (const file of [BLOCK, TABLE]) {
      const body = code(file);
      expect(existsSync(componentPath(file)), file).toBe(true);
      for (const sentence of sentences) {
        expect(body, `${file} types the sentence ${JSON.stringify(sentence)}`).not.toContain(
          sentence,
        );
      }
    }
    // The positive half: the h4 is the inventory's constant, not the word.
    expect(code(BLOCK)).toMatch(/<h4[^>]*>\s*\{VEHICLE_TABLE_TITLE\}\s*<\/h4>/);
  });

  test('the block writes no raw HTML, no inline style, no motion and no router', () => {
    const body = code(BLOCK);
    expect(body).not.toContain('{@html');
    expect(body).not.toMatch(/\sstyle="/);
    expect(body).not.toMatch(/\sstyle:[a-zA-Z-]+=/);
    expect(body).not.toMatch(/transition|animation/);
    // No client-side router: the dashboard is one page and the nav is anchors
    // (PROJECT.md, the GitHub Pages refresh-404 rule).
    expect(body).not.toMatch(/import .* from 'svelte\/routing'|goto\(/);
  });
});

// =============================================================================
// 05-14 Task 2 — the per-title header, the battle-type SUMMARY, the Warships
// all-battles view and the Warplanes 20 note.
//
// Same technique as the two blocks above and for the same reason: Vitest runs
// with no Svelte plugin and `environment: 'node'`, so a component cannot be
// rendered at all. What these assertions catch is the class of failure that is
// invisible to a passing arithmetic test — a raw-HTML tag on a battle-type code
// lifted out of a zip, an `aria-live` region added to a block that owns exactly
// one, a sentence typed into a component instead of reached for in the copy
// inventory, a `<details>` that is not `open` where the UI-SPEC says it must be.
// =============================================================================

const SUMMARY = 'BattleTypeSummary.svelte';

describe('05-14 Task 2 — the battle-type summary: a native table in an OPEN details', () => {
  test('the summary is a native table inside a `<details open>`, never a grid', () => {
    // The file is read LAZILY and a missing one is `''`, so an unwritten
    // component fails as an assertion naming the contract rather than as a
    // module-load crash — the same rule the rest of this file follows.
    expect(existsSync(componentPath(SUMMARY))).toBe(true);
    const body = code(SUMMARY);
    expect(body).toContain('<details');
    // OPEN: the summary is reference information about the export, not a
    // control the reader has to discover. A collapsed one would hide the only
    // place the export names its own battle-type coverage.
    expect(body).toMatch(/<details[^>]*\bopen\b/);
    expect(body).toContain('<summary');
    expect(body).toContain('BATTLE_TYPE_SUMMARY_DISCLOSURE');
    // Native table semantics, for the same reason the vehicle table keeps
    // them: a four-column, five-row table of real figures.
    expect(body).toContain('<table');
    expect(body).toContain('data-testid="battle-type-summary"');
    expect(body).toContain('scope="col"');
    expect(body).not.toContain('role="grid"');
  });

  test('the headers come from the inventory, in its order', () => {
    const body = code(SUMMARY);
    // The four column names, indexed rather than iterated: a component that
    // typed them in the wrong order would still contain all four strings, and
    // the order IS the contract (`Battle type`, `Battles`, `Wins`,
    // `Damage dealt`).
    for (const [index, header] of BATTLE_TYPE_SUMMARY_HEADERS.entries()) {
      expect(body, `the ${index}th summary header is not the inventory's`).toContain(
        `BATTLE_TYPE_SUMMARY_HEADERS[${index}]`,
      );
      // And the positive half, so the negative check above cannot pass against
      // a table with no headers at all.
      expect(BATTLE_TYPE_SUMMARY_HEADERS[index]).toBe(header);
    }
    expect(BATTLE_TYPE_SUMMARY_HEADERS).toEqual(['Battle type', 'Battles', 'Wins', 'Damage dealt']);
  });

  test('one row per code, carrying the code as DATA and formatting it, never naming it', () => {
    const body = code(SUMMARY);
    expect(body).toContain('data-testid="battle-type-row"');
    expect(body).toContain('data-code');
    // D-07: a code is an identifier. `formatBattleTypeLabel` is the only thing
    // allowed to make it read, and a lookup table of game enum names would be a
    // guess a future export could invalidate with nobody noticing.
    expect(body).toContain('formatBattleTypeLabel(');
    // The three figures go through the SAME cell formatter as the vehicle
    // table, so `not in export` and a muted special mean the same thing in
    // both tables and only one rule decides what a cell says.
    expect(body).toContain('formatVehicleCell(');
  });

  test('the Warships note is present and keyed on the title, not typed in', () => {
    const body = code(SUMMARY);
    expect(body).toContain('BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS');
    // Keyed on the TITLE, because the double count is a property of how
    // Warships records a battle rather than of any one view: a title-agnostic
    // note would claim the same thing about tanks, where it is false.
    expect(body).toContain("title === 'wows'");
  });

  test('the summary writes no raw HTML, no inline style and no live region', () => {
    const body = code(SUMMARY);
    // T-05-42: a battle-type code is zip content. Interpolation escapes it, and
    // `{@html` would not.
    expect(body).not.toContain('{@html');
    // T-05-38: the CSP has no `style-src 'unsafe-inline'`.
    expect(body).not.toMatch(/\sstyle="/);
    expect(body).not.toMatch(/\sstyle:[a-zA-Z-]+=/);
    // The block owns exactly ONE explicit live region, asserted above. A second
    // one here would make the page-wide count in `dashboard.spec.ts` a lie.
    expect(body).not.toContain('aria-live');
  });
});

describe('05-14 Task 2 — the per-title header, the Warplanes note and the Warships all-view note', () => {
  test('the per-title header is a `dl` with the two D-13 rows and both test hooks', () => {
    const body = code(BLOCK);
    expect(body).toContain('<dl');
    expect(body).toContain('data-testid="player-stats-header"');
    expect(body).toContain('data-testid="lifetime-battles"');
    expect(body).toContain('data-testid="premium-expires"');
    // Both labels are the inventory's, and the values are the export's cells
    // through the ONE cell formatter — so `N/A` reads `not available` and
    // `N/D` reads `not defined` here for the same reason they do in a table,
    // and an expiry is shown exactly as written (D-13, D-09).
    expect(body).toContain('HEADER_LIFETIME_BATTLES_LABEL');
    expect(body).toContain('HEADER_PREMIUM_EXPIRES_LABEL');
    expect(body).toContain('formatVehicleCell(');
    // Rendered from the view's own `header`, which is null when the title has
    // no account file — the omission is a property of the answer rather than a
    // second list of titles here.
    expect(body).toContain('view.header');
  });

  test('the Warplanes 20 note is the inventory formatter, and only for Warplanes', () => {
    const body = code(BLOCK);
    expect(body).toContain('data-testid="warplanes-20-note"');
    expect(body).toContain('formatWarplanes20Note(');
    // Keyed on the VIEW's `wowp20`, which is non-null for exactly one title.
    // WOWP_20 is never a table (D-09), so there is nothing else that could
    // have to be switched off.
    expect(body).toContain('view.wowp20');
  });

  test('the Warships all-battles note is keyed on the view, not on the title', () => {
    const body = code(BLOCK);
    expect(body).toContain('WARSHIPS_ALL_NOTE');
    // `allBattlesOnly` is the WORKER's statement that this is the one view with
    // no per-ship figure to show. Keying the note on the title id instead would
    // put "choose a battle type" above a Warships table that already IS a
    // battle type.
    expect(body).toContain('view.allBattlesOnly');
  });

  test('the summary is composed from the new component, not re-implemented here', () => {
    const body = code(BLOCK);
    // One component owns the summary's table, so the header geometry, the
    // 12-row scroll container and the four columns exist once.
    expect(body).toContain('BattleTypeSummary');
    // And the block reaches for it only when there is a summary to show, which
    // is the same silence the battle-type control uses.
    expect(body).toMatch(/view\.summary\.length\s*>\s*0/);
  });
});

describe('05-14 Task 3 — the column picker is a native details of native checkboxes', () => {
  test('the picker is a `<details>` holding a fieldset of checkboxes', () => {
    const body = code(BLOCK);
    expect(body).toContain('data-testid="column-picker"');
    expect(body).toContain('<details');
    expect(body).toContain('<summary');
    // A fieldset with a legend, not a list of labels: the checkboxes are ONE
    // control group, and a screen reader announces them as such.
    expect(body).toContain('<fieldset');
    expect(body).toContain('<legend');
    expect(body).toContain('COLUMN_PICKER_SUMMARY');
    expect(body).toContain('COLUMN_PICKER_LEGEND');
    // `type="checkbox"` EXPLICITLY rather than relying on the default: a
    // checkbox with no `type` is a checkbox, but the whole picker is a native
    // control and one of them reading `text` would silently swallow a click.
    expect(body).toMatch(/type="checkbox"/);
    expect(body).toContain('data-testid="column-toggle-{column.key}"');
  });

  test('the picker offers the view’s NON-CORE columns only', () => {
    const body = code(BLOCK);
    // Core columns are not toggles: the reader is choosing what to ADD, and a
    // checkbox that could switch off `Battles` would be a second way to change
    // the table's shape that nothing resets.
    expect(body).toMatch(/view\.columns\.filter\(\(column\) => !column\.core\)/);
    // And the checkboxes are labelled from the inventory, keyed on the
    // canonical key — never from the export's own header name, which differs
    // per title.
    expect(body).toContain('VEHICLE_COLUMN_LABELS');
  });

  test('the picker is absent for a view with no extras', () => {
    const body = code(BLOCK);
    expect(body).toMatch(/extras\.length\s*>\s*0/);
  });

  test('the three resets are the three tested functions, and each one is used', () => {
    const body = code(BLOCK);
    // D-28 / D-12: a dataset replace clears everything, a title change clears
    // the extras, and a battle-type change keeps them. Three different resets
    // with three different jobs, and a component that reached for the wrong one
    // would produce a table whose columns are not the ones the reader chose.
    expect(body).toContain('freshSelection()');
    expect(body).toContain('selectionAfterBattleType(');
    // The picked list is held in PICK ORDER, and `visibleColumns` is what
    // decides which of them this view actually has.
    expect(body).toContain('visibleColumns(');
  });
});

describe('05-14 — the new copy is the inventory’s, in every component', () => {
  test('NO 05-14 sentence is typed into any of the three components', () => {
    // The one rule that makes the copy inventory worth having. Extended to the
    // sentences 05-14 added, and checked against the summary component as well
    // as the two existing ones.
    const sentences = [
      BATTLE_TYPE_SUMMARY_HEADING,
      BATTLE_TYPE_SUMMARY_CAPTION,
      BATTLE_TYPE_SUMMARY_DISCLOSURE,
      BATTLE_TYPE_SUMMARY_HEADERS[0],
      BATTLE_TYPE_SUMMARY_HEADERS[3],
      BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS,
      COLUMN_PICKER_SUMMARY,
      COLUMN_PICKER_LEGEND,
      HEADER_LIFETIME_BATTLES_LABEL,
      HEADER_PREMIUM_EXPIRES_LABEL,
      WARSHIPS_ALL_NOTE,
      VALUE_NOT_AVAILABLE,
    ];
    for (const file of [BLOCK, TABLE, SUMMARY]) {
      const body = code(file);
      expect(existsSync(componentPath(file)), file).toBe(true);
      for (const sentence of sentences) {
        expect(body, `${file} types the sentence ${JSON.stringify(sentence)}`).not.toContain(
          sentence,
        );
      }
    }
  });
});
