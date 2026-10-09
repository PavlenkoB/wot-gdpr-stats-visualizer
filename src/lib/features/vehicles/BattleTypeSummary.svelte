<script lang="ts">
  import type {
    BattleTypeSummaryRow,
    ColumnKind,
    VehicleCell,
    VehicleTitleId,
  } from './vehicle-shared.ts';
  import {
    BATTLE_TYPE_SUMMARY_CAPTION,
    BATTLE_TYPE_SUMMARY_DISCLOSURE,
    BATTLE_TYPE_SUMMARY_HEADERS,
    BATTLE_TYPE_SUMMARY_HEADING,
    BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS,
    formatBattleTypeLabel,
    formatVehicleCell,
  } from '../../ui-copy.ts';

  /**
   * The battle-type summary (D-07), plan 05-14.
   *
   * ## Why the table is OPEN
   *
   * This is reference information about the export rather than a control the
   * reader has to discover. A collapsed disclosure would hide the only place
   * the export names its own battle-type coverage — and the fact that the
   * coverage is INCOMPLETE is the whole reason the per-battle-type views carry
   * a note. The `open` attribute is on the element, not in a binding, so the
   * summary is open on first paint with no script involved.
   *
   * ## Why the summary lists MORE codes than the select
   *
   * The rows come from the `*_Battle_Types_Statistics.csv` file and the select's
   * options from the `*_Vehicle_Statistics_by_Type.csv` file, and the two are
   * not the same list. On the 05-01 fixture the summary has codes 1, 2, 10, 11
   * and 13 and the select offers 1, 2 and 10: codes 11 and 13 exist in the
   * export's own summary of itself and have no by_Type rows to switch to. That
   * gap is a PROPERTY OF THE EXPORT, not a defect, and showing both lists is
   * the honest rendering of it (RESEARCH Pitfall 10). The summary is not
   * interactive — the select is the only control, and a row here that looked
   * clickable would be a promise the component does not keep.
   *
   * ## Why the cells go through `formatVehicleCell`
   *
   * The same formatter the vehicle table uses, with the same three column
   * kinds. A missing column reads `not in export` in both tables for the same
   * reason and through the same code, and a special is muted in both — so the
   * one rule that decides what a cell says exists once (D-09, D-25).
   *
   * ## No decision lives in this file
   *
   * Which codes exist, in what order, and what each figure is are the worker's
   * (plan 05-05). What each cell SAYS is `formatVehicleCell`'s. What is left is
   * the markup and the geometry.
   */
  interface Props {
    /** The view's summary rows, in the order the worker resolved them. */
    summary: readonly BattleTypeSummaryRow[];
    /** The applied title, because the double-count note is Warships'. */
    title: VehicleTitleId;
  }

  let { summary, title }: Props = $props();

  /**
   * D-08: a Warships battle is counted under TWO battle types, so the summary's
   * rows add up to more than the account's battle count.
   *
   * Keyed on the title rather than on the numbers, because the numbers being
   * wrong is not how you know: a Warships account whose two types happened to
   * balance would still have this rule, and a tanks account whose rows do not
   * add up would not. It is a property of how the game records a battle.
   */
  const isWarships = $derived(title === 'wows');

  /**
   * Above this many codes the table gets its own scroll box.
   *
   * A dozen is a lot of battle types and the UI-SPEC's ceiling for an
   * UNSCROLLED summary; beyond it the block would push the vehicle table below
   * the fold, and the summary is reference material the reader came to on
   * purpose. It is a class, not a style attribute, because the build-time CSP
   * has no `style-src 'unsafe-inline'` and `svelte/no-inline-styles` is an error
   * in this repo (T-05-38).
   */
  const SCROLL_AFTER = 12;
  const scrolls = $derived(summary.length > SCROLL_AFTER);

  /** One figure cell: the export's own cell, through the shared formatter. */
  function cell(cellValue: VehicleCell, kind: ColumnKind): string {
    return formatVehicleCell(cellValue, kind).text;
  }
</script>

<!--
  The heading and its caption sit OUTSIDE the disclosure, so the block still
  says what it is when the reader has collapsed the table — the caption is the
  sentence that explains why a code reads the way it does, and it is the reason
  to open the table at all.
-->
<h4>{BATTLE_TYPE_SUMMARY_HEADING}</h4>
<p class="caption">{BATTLE_TYPE_SUMMARY_CAPTION}</p>

<details open data-testid="battle-type-summary-disclosure">
  <summary>{BATTLE_TYPE_SUMMARY_DISCLOSURE}</summary>
  <!--
    The scroll box wraps the TABLE and not the details, so the summary control
    stays put at the top of the block while the codes scroll under it.

    It is also a focusable scrolling REGION, which is the 05-20 fix for the one
    place this block spilled its card (G-05-10). Four nowrap columns have a
    fixed minimum width that no export can reduce, so at 375px the table was
    316px inside a 293px box and the card's scrollWidth went to 332 against 325.
    `role="region"` with `tabindex="0"` is WCAG 2.1.1 rather than a mistake: a
    keyboard-scrollable box that cannot take focus cannot be scrolled with the
    arrow, Page Up or Page Down keys at all, which would leave the out-of-view
    columns unreachable rather than merely off screen. The rule fires because
    `region` is not one of the ARIA interactive roles.

    The accessible name is `BATTLE_TYPE_SUMMARY_HEADING` — the h4 already on
    screen directly above, so this adds NO copy, and it is the same naming the
    vehicle table's region does through `formatVehicleRegionName`.

    This is ONE extra tab stop, and it sits in document order before the column
    picker: the reader reaches the region, scrolls it if they want to, and
    continues to the picker. The table's cells are untouched, so every existing
    assertion about the summary — five rows in battles order, four headers, no
    buttons, a hostile code shown as text (T-05-42) — still describes exactly
    the same table.
  -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="scroll-box"
    class:scrolls
    data-testid="battle-type-scroller"
    role="region"
    tabindex="0"
    aria-label={BATTLE_TYPE_SUMMARY_HEADING}
  >
    <table data-testid="battle-type-summary">
      <thead>
        <tr>
          <!--
            The four headers by INDEX rather than by a loop. The list is a
            fixed four-column contract, and naming each cell is what makes
            "Battle type, Battles, Wins, Damage dealt" a thing a reader can
            check against the copy inventory rather than a thing they have to
            take on trust.
          -->
          <th scope="col">{BATTLE_TYPE_SUMMARY_HEADERS[0]}</th>
          <th scope="col">{BATTLE_TYPE_SUMMARY_HEADERS[1]}</th>
          <th scope="col">{BATTLE_TYPE_SUMMARY_HEADERS[2]}</th>
          <th scope="col">{BATTLE_TYPE_SUMMARY_HEADERS[3]}</th>
        </tr>
      </thead>
      <tbody>
        <!--
          `data-code` carries the code as a DATA attribute, written by Svelte
          and therefore escaped: a hostile code is a value here and never a
          selector or a concatenation (T-05-42). It is the same clamped string
          the view holds, not a lookup and not a name.
        -->
        {#each summary as row (row.code)}
          <tr data-testid="battle-type-row" data-code={row.code}>
            <td class="label">{formatBattleTypeLabel(row.code)}</td>
            <td>{cell(row.battles, 'count')}</td>
            <td>{cell(row.wins, 'count')}</td>
            <td>{cell(row.damage, 'count')}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if isWarships}
    <p class="caption note" data-testid="battle-type-summary-note">
      {BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS}
    </p>
  {/if}
</details>

<style>
  /* The table title, an h4 so the outline is h1 > h2 section > h3 block >
     h4 and nothing skips a level (05-UI-SPEC section 1). Label role in the
     chart-title colour, which is what the UI-SPEC's "chart / table titles" row
     specifies. `PlayerStats.svelte` repeats this rule in full, because scoped
     styles cannot be shared. */
  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
  }

  /* Caption role: the sentence that explains the numbering, and the two notes
     under the table. `overflow-wrap: anywhere` so a long sentence cannot widen
     the card at 375px. 14/400/1.4 is the UI-SPEC's Caption row exactly — this
     rule was 12px until 05-20, below the floor that same spec sets (G-05-10). */
  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .note {
    margin-top: 8px;
  }

  details {
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--muted);
  }

  /* The accent focus ring, exactly as every other interactive element in the
     project carries it: the accent is reserved for focus. */
  summary:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  /* The horizontal scroll region around the table (05-20, G-05-10).

     `overflow-x: auto` is the containment, and removing it is what makes the
     375px test fail: the table's four `nowrap` columns have a minimum width
     nothing in the export can reduce, so without this the width escapes the
     box and reaches the card.

     `min-width: 0` says what a scroll container is for — it may be narrower
     than its content. In today's markup this box is a block inside `<details>`
     and is already constrained by the parent's content box, so the declaration
     is not what fixes the spill (measured: deleting it leaves the 375px
     containment test green). It stays because it is the declaration that
     KEEPS the containment if this box is ever made a flex or grid item, where
     the automatic minimum size would otherwise restore the max-content width.

     Desktop output is unchanged by design: nothing overflows at 1024px, so
     `auto` never draws a scrollbar and the box lays out exactly as the plain
     div did. */
  .scroll-box {
    min-width: 0;
    overflow-x: auto;
  }

  /* The accent focus ring, exactly as the summary above it and the vehicle
     table's scroller both carry it: the accent is reserved for focus, and this
     region is a new member of "every interactive element". */
  .scroll-box:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  /* The scroll box for an export with a great many battle types. A class
     rather than an inline style — see `SCROLL_AFTER`. This is the VERTICAL
     bound and it is unchanged by 05-20: `overflow: auto` here still scrolls
     the codes under a fixed 320px cap, exactly as the UI-SPEC's "more than 12
     rows" line asks. */
  .scrolls {
    max-height: 320px;
    overflow: auto;
  }

  table {
    width: 100%;
    margin-top: 8px;
    border-collapse: collapse;
    font-size: 14px;
    line-height: 1.4;
  }

  /* Label role, muted, on the UI-SPEC's header surface. */
  th {
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--list);
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
  }

  /* Caption role cells, the table's body colour, right-aligned with tabular
     figures so digits line up down a column and a grouped number can be
     compared by length (D-25). The code cell is the exception: it is a label
     the reader scans down, not a figure, so it is left-aligned. 14px is the
     Caption size the UI-SPEC's "Table body cells" row names, and these cells
     were 12px until 05-20 (G-05-10). */
  td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--hover);
    color: var(--text);
    font-size: 14px;
    font-weight: 400;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  td.label {
    text-align: left;
    font-variant-numeric: normal;
  }
</style>
