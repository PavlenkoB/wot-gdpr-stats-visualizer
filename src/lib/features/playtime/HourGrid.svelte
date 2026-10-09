<script lang="ts">
  import { tick } from 'svelte';
  import type { HourGridModel, HourGridKey, TooltipRequest } from './playtime-model.ts';
  import { hoursAttribute, hourGridNavigate } from './playtime-model.ts';
  import { HOUR_GRID_BASIS } from './playtime-shared.ts';
  import { scrollClear } from '../../core/focus-clear.ts';
  import {
    CHART_TITLE_HOUR_GRID,
    WEEKDAY_SHORT,
    formatHourCellLabel,
    formatHourCellLine1,
    formatHourCellLine2,
    formatHourLabel,
  } from '../../ui-copy.ts';

  /**
   * The weekday x hour heatmap: 168 cells, seven row groups, one fixed-size
   * SVG (ACTIVITY-03, D-01, D-04).
   *
   * ## Why there is no `viewBox`
   *
   * A `viewBox` is how an SVG is made to scale, and scaling is exactly what
   * this chart must not do: the axis text is set in the Caption role and must
   * stay 14px. So the svg carries fixed `width` and `height` attributes from
   * `model.layout` and nothing else: the measured pane width (plan 08-21,
   * G-08-3), or today's 624 x 192 below the floor, where 24 x 24 cells fit.
   * At 375px the SCROLLER moves, never the chart (UI-SPEC Phone width).
   *
   * ## Why 168 cells whatever the data says
   *
   * The cell count is the scale requirement: it is a property of the week, not
   * of the export, so a 50k-session export and a 3-session export draw the
   * same 168 rects. Cells are grouped by weekday row so the SVG mirrors the
   * data as seven `role="row"` groups inside one `role="grid"`.
   *
   * ## Why the basis is a constant and never a literal
   *
   * Every readable string here — the cell's accessible name, the tooltip
   * text, the caption the owner renders — reads `HOUR_GRID_BASIS`. That
   * constant is deliberately unresolved: both bases are stored in every
   * slice, so flipping it is a one-line change and this component must not
   * need an edit when it happens.
   */
  interface Props {
    /** The 168 cells, the scale and the legend, from `buildHourGridModel`. */
    model: HourGridModel;
    /** The id of the keyboard hint the owner renders (aria-describedby). */
    describedBy: string;
    /**
     * Ask the owner to open or close the one shared tooltip, and tell it which
     * element the request was measured from.
     *
     * The element is not part of `TooltipRequest` (04-05's type, and the
     * tested contract between this chart and the copy functions), and it is
     * not a DOM handle the owner should reach through: it is what lets the
     * tooltip tell a correction scroll apart from a reader scrolling away.
     * See `isStale` in `ChartTooltip`.
     */
    onTip: (request: TooltipRequest | null, anchor?: Element | null | undefined) => void;
  }

  let { model, describedBy, onTip }: Props = $props();
  /**
   * The roving stop, Monday 00:00 by default (UI-SPEC section 6: "Initial tab
   * stop is Monday 00:00 (predictable)"). One cell is `0` and the other 167
   * are `-1`, so Tab enters and leaves the whole grid in one stop.
   */
  let active = $state(0);

  /**
   * Whether the focus currently in the grid is the KEYBOARD's.
   *
   * The ring is drawn only when this is true: a ring left behind by a mouse
   * click tells a reader the pointer is somewhere it is not. Set on a key
   * press, cleared on a pointer press, and it is a flag rather than a
   * `:focus-visible` match because an SVG `<rect>` has no reliable
   * `:focus-visible` styling across engines.
   */
  let keyboardFocus = $state(false);

  /**
   * The index of the cell under the pointer, or null when it is on none.
   *
   * This is the pointer's position and NOT focus: it never moves `active`,
   * never sets `keyboardFocus`, and is deliberately not cleared by the inline
   * pointer-down handler on the svg (a press does not move the pointer, so the
   * pointer is still over the same cell).
   */
  let hoverIndex = $state.raw<number | null>(null);

  /**
   * Cells grouped for the row groups, Monday first.
   *
   * `model.cells` is the flat `weekday * 24 + hour` array the model already
   * publishes; a filter per row is the same arithmetic the index does, and it
   * keeps one source of truth for where a cell sits.
   */
  const rows = $derived(
    model.weekdayRows.map((row) => ({
      ...row,
      cells: model.cells.filter((cell) => cell.weekday === row.weekday),
    })),
  );

  /** The cell the roving focus is on, or undefined before the model loads. */
  const activeCell = $derived(model.cells[active]);

  /** The cell under the pointer, or null when there is none. */
  const hoverCell = $derived(hoverIndex === null ? null : (model.cells[hoverIndex] ?? null));

  /**
   * The cell under an event, found by its `data-index`.
   *
   * `closest` rather than a per-cell closure, because the handlers are
   * delegated to the svg: the event target is whatever the pointer or the
   * focus actually landed on, which may be the rect itself but is never
   * assumed to be. A `data-index` that is not one of the 168 returns null, so
   * a click on the axis text or the padding is a dismissal rather than a
   * focus on nothing.
   */
  function cellFrom(
    target: EventTarget | null,
  ): { index: number; cell: (typeof model.cells)[number] } | null {
    const node = target instanceof Element ? target.closest('[data-index]') : null;
    if (node === null) return null;
    const index = Number(node.getAttribute('data-index'));
    const cell = Number.isInteger(index) ? model.cells[index] : undefined;
    return cell === undefined ? null : { index, cell };
  }

  /** A cell's bounding rect in viewport coordinates, for the tooltip anchor. */
  function rectOf(node: Element): {
    left: number;
    top: number;
    width: number;
    height: number;
  } {
    const box = node.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  /**
   * Open the tooltip on a cell.
   *
   * The two lines are the same words the cell's accessible name is built
   * from, so a sighted reader and a screen-reader user are told the same thing
   * about the same cell (UI-SPEC section 8).
   */
  function showTip(node: Element, cell: (typeof model.cells)[number]): void {
    onTip(
      {
        anchor: rectOf(node),
        line1: formatHourCellLine1(cell.weekday, cell.hour),
        line2: formatHourCellLine2(cell.seconds, HOUR_GRID_BASIS),
      },
      node,
    );
  }

  function onPointerOver(event: PointerEvent): void {
    // A touch tap fires over, down, up and out in that order, so handling the
    // over for touch would open a tooltip that the very same tap then closes
    // at its `out`. Touch opens the tooltip on press instead — see
    // `onPointerDown`.
    if (event.pointerType === 'touch') return;
    const found = cellFrom(event.target);
    if (found === null) return;
    hoverIndex = found.index;
    const node = (event.target as Element).closest('[data-index]');
    if (node !== null) showTip(node, found.cell);
  }

  /**
   * Hide on pointer leave.
   *
   * `pointerout` rather than `pointerleave`, because `pointerleave` is not one
   * of the events Svelte 5 delegates (RESEARCH Pattern 6) — a per-node
   * binding on 168 rects is exactly what this component must not have. The
   * `relatedTarget` guard is what stops the tooltip flickering as the pointer
   * crosses from one cell to its neighbour: moving within the grid fires
   * `pointerout` for the cell being left and `pointerover` for the one being
   * entered, and closing on the first would blank the tooltip mid-move.
   */
  function onPointerOut(event: PointerEvent): void {
    // The touch counterpart of the guard in `onPointerOver`: the `out` half of
    // a tap is what would close the tooltip its own `over` opened. Touch
    // dismissal is decided in one place instead — `ChartTooltip`, which knows
    // whether the tooltip is pinned.
    if (event.pointerType === 'touch') return;
    if (cellFrom(event.relatedTarget) !== null) return;
    hoverIndex = null;
    onTip(null, null);
  }

  /**
   * A press clears the keyboard ring, and a TOUCH press opens the tooltip.
   *
   * The ring is cleared first and unconditionally: a finger landing on a cell
   * leaves no keyboard ring behind, exactly as a mouse click does. The press
   * does not move the pointer, so this never touches the pointer's own cell.
   *
   * The touch branch is what makes a tap show something. Whether the engine
   * also moves focus on a tap is its own decision and varies, so relying on
   * `focusin` alone would leave the tap's tooltip at the mercy of the
   * browser; resolving the cell here means the tap opens the tooltip whatever
   * the engine does afterwards. A tap on the chart's padding — an axis label,
   * the gutter, the space between cells — has no cell and closes the tooltip,
   * which is the same rule `cellFrom` already gives the mouse path.
   */
  function onPointerDown(event: PointerEvent): void {
    keyboardFocus = false;
    if (event.pointerType === 'touch') {
      const found = cellFrom(event.target);
      if (found === null) {
        onTip(null, null);
        return;
      }
      const node = (event.target as Element).closest('[data-index]');
      if (node !== null) showTip(node, found.cell);
    }
  }

  /**
   * Focus moves the roving stop with it, and opens the tooltip.
   *
   * The stop has to FOLLOW focus, not merely start at Monday 00:00, or the
   * first arrow press after arriving by Tab, by click or programmatically
   * would be computed from a cell the reader is no longer on: focus cell 100,
   * press Right, and focus would jump to 1. Setting the stop here makes the
   * arrows relative to the cell that actually has focus, and makes Tab leave
   * and return to the cell the reader last used instead of resetting the grid
   * to its first hour.
   */
  function onFocusIn(event: FocusEvent): void {
    const found = cellFrom(event.target);
    if (found === null) return;
    active = found.index;
    const node = (event.target as Element).closest('[data-index]');
    if (node !== null) showTip(node, found.cell);
  }

  function onFocusOut(event: FocusEvent): void {
    if (cellFrom(event.relatedTarget) !== null) return;
    onTip(null, null);
  }

  /**
   * The six navigation keys, plus Escape.
   *
   * The next index is `hourGridNavigate`'s, not arithmetic here: its edge
   * rules (no wrapping at a row boundary, Home/End the row's own first and
   * last hour) are 04-05's and are unit-tested. A component that computed the
   * neighbour itself would be free to wrap, and a wrapped roving focus is a
   * focus trap.
   *
   * `await tick()` before focusing because the `tabindex` attributes have to
   * move before the browser can focus the new cell: focusing a `tabindex="-1"`
   * rect works, but focusing while the OLD cell is still `0` fights the
   * browser's own sequential-focus bookkeeping. Then `scrollClear` corrects
   * what the browser did not, because `scroll-margin-top` is not honoured on
   * an SVG rect.
   */
  async function onKeyDown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Escape') {
      onTip(null, null);
      return;
    }

    const key = event.key as HourGridKey;
    const movable = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!movable.includes(key)) return;

    // These six keys belong to the grid, and the default is prevented whether
    // or not the focus actually moves. At a row edge — ArrowUp on the first
    // row, ArrowRight on hour 23 — the reducer returns the same cell, and an
    // unprevented arrow key there is the BROWSER scrolling the page: the grid
    // stays put while the page moves out from under the focused cell, which is
    // the one thing the roving model exists to prevent, and it closes the
    // tooltip on the way past.
    event.preventDefault();

    const next = hourGridNavigate(active, key);
    // A key that does not move focus is also a key that must not look like it
    // did, so the ring is switched on only below this line.
    if (next === active) return;

    keyboardFocus = true;
    active = next;
    await tick();

    const node = cellNode(next);
    if (node === null) return;

    // Focus the cell with the page's smooth scrolling suspended, and put it
    // back straight after.
    //
    // `node.focus()` scrolls the cell into view itself, and under
    // `scroll-behavior: smooth` (D-29) that is a GLIDE — so the cell is still
    // moving for a few hundred milliseconds after focus returns. Every frame of
    // it fires a scroll event, and the tooltip closes on a scroll whose cell has
    // moved, so a keyboard user who moved a cell up under the nav would watch
    // the tooltip open and close and open again. A 36px correction is not
    // navigation and this chart declares no motion of its own (UI-SPEC
    // section 9), so it is made instantaneous here and in `scrollClear`.
    const root = document.documentElement;
    const smooth = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    try {
      node.focus();
    } finally {
      root.style.scrollBehavior = smooth;
    }

    // No year head above this grid, so the head height is 0; 04-10's calendar
    // passes the real measured height of its own.
    scrollClear(node, 0);
    // Measure AFTER both scrolls, not before: the tooltip's anchor is the
    // cell's position on screen, and a position captured mid-correction is a
    // position the cell is about to leave.
    const moved = model.cells[next];
    if (moved !== undefined) showTip(node, moved);
  }

  /**
   * The `<rect>` for one index, or null if it is not in the DOM yet.
   *
   * Typed as `SVGRectElement` rather than the `Element` a bare querySelector
   * gives, because `focus()` is on the SVG element interface and not on the
   * base one — which is exactly the kind of place a wrong cast would hide a
   * real DOM error until the browser.
   */
  function cellNode(index: number): SVGRectElement | null {
    const root = element;
    return root === null ? null : root.querySelector<SVGRectElement>(`[data-index="${index}"]`);
  }

  let element = $state<SVGSVGElement | null>(null);
</script>

<!--
  The scroller is the phone-width answer (UI-SPEC Phone width): at 375px the
  card content is 295px and the chart is 624px, so the CHART scrolls and the
  page does not. `overflow-y: hidden` keeps the horizontal scrollbar from
  gaining a vertical partner; 4px of vertical padding leaves room for the
  focus ring, which is drawn 1.5px outside its cell.
-->
<!--
  The surface attribute names the region a touch tap belongs to. The shared
  tooltip reads it to tell "a tap inside the chart this tooltip belongs to"
  from "a tap somewhere else on the page", which is the difference between
  moving a pinned tooltip and dismissing it (07-03, `touchTapAction`). It is
  on the scroller rather than the svg because the scroller is the chart's
  whole addressable box.
-->
<div class="scroller" data-testid="hour-scroller" data-tooltip-surface>
  <svg
    bind:this={element}
    data-testid="hour-chart"
    role="grid"
    tabindex="-1"
    aria-label={CHART_TITLE_HOUR_GRID}
    aria-describedby={describedBy}
    width={model.layout.width}
    height={model.layout.height}
    onpointerover={onPointerOver}
    onpointerout={onPointerOut}
    onfocusin={onFocusIn}
    onfocusout={onFocusOut}
    onkeydown={onKeyDown}
    onpointerdown={onPointerDown}
  >
    <!--
      The hour labels first, so a cell rect painted later can never cover one:
      the band above row 0 is the only place they live, but drawing order is
      cheap insurance and costs nothing.
    -->
    {#each model.hourLabels as label (label.hour)}
      <text class="axis" x={label.x} y={16} text-anchor="middle" aria-hidden="true">
        {formatHourLabel(label.hour)}
      </text>
    {/each}

    {#each rows as row (row.weekday)}
      <g role="row" data-weekday={row.weekday}>
        <!--
          The weekday, in the left gutter, right-aligned against the first
          cell and vertically centred on its row. `aria-hidden` because the
          cell's own accessible name already says which weekday it is; the
          label is for a sighted reader scanning the grid.
        -->
        <text
          class="axis"
          x={model.layout.gutter - 8}
          y={row.y + Math.round(model.layout.rowPitch / 2) + 4}
          text-anchor="end"
          aria-hidden="true"
        >
          {WEEKDAY_SHORT[row.weekday]}
        </text>

        {#each row.cells as cell (cell.index)}
          <!--
            One rect per cell, 24 x 24, and the fill is the level class: the ramp
            is read from the one `--ramp-N` declaration in app.css, never
            restated as a hex here. The 1px white stroke is what separates two
            adjacent cells of the SAME level, where a 0px gap would merge them
            into one block.

            Every value is an ATTRIBUTE, not a style: `data-hours` and
            `data-seconds` are how plan 04-12 asserts from a browser that the
            basis-selected grid still sums to `slice.seconds`, and
            `data-index` is what the delegated key handler focuses by.
          -->
          <rect
            role="gridcell"
            class="cell level-{cell.level}"
            x={cell.x}
            y={cell.y}
            width={cell.width}
            height={model.layout.rowPitch}
            data-testid="hour-cell"
            data-weekday={cell.weekday}
            data-hour={cell.hour}
            data-level={cell.level}
            data-hours={hoursAttribute(cell.seconds)}
            data-seconds={cell.seconds}
            data-index={cell.index}
            aria-label={formatHourCellLabel(cell.weekday, cell.hour, cell.seconds, HOUR_GRID_BASIS)}
            tabindex={cell.index === active ? 0 : -1}
          />
        {/each}
      </g>
    {/each}

    <!--
      The hover outline: the keyboard ring's own two-tone construction and
      geometry, drawn on the cell under the pointer. It is an overlay and not a
      stroke on the hovered cell because the next cell to the right and the
      next one below cover a stroke drawn on the rect, and these cells touch, so
      the ring overlaps its neighbours by up to 4px.

      It is gated on the pointer's cell, not on `keyboardFocus`: hover is
      pointer position, not keyboard navigation, so it never draws or clears the
      keyboard ring. It goes before the keyboard ring so that one stays the last
      painted element. Neither rect carries a data attribute, because `cellFrom`
      and `cellNode` resolve cells by `data-index` and the ring is not a cell.
    -->
    {#if hoverCell !== null}
      <rect
        class="hover-ring"
        x={hoverCell.x - 1.5}
        y={hoverCell.y - 1.5}
        width={hoverCell.width + 3}
        height={model.layout.rowPitch + 3}
        aria-hidden="true"
      />
      <rect
        class="hover-ring hover-ring-inner"
        x={hoverCell.x - 3.5}
        y={hoverCell.y - 3.5}
        width={hoverCell.width + 7}
        height={model.layout.rowPitch + 7}
        aria-hidden="true"
      />
    {/if}

    <!--
      The focus ring, drawn LAST so no cell can paint over it. A `<rect>`'s own
      stroke is painted with the rect, which means every cell to the right of
      and below the focused one would cover a ring drawn in place — Pattern 6
      probed exactly that, and the fix is one overlay element at the end of the
      svg rather than a CSS outline (which the svg clips).

      Two rects, because the accent alone is unreadable on the dark end of the
      ramp (2.1:1 on level 5): a 3px var(--focus) stroke OUTSIDE a 1px #ffffff one,
      so there is always a light edge between the ring and the cell under it.
      Both are inset from the cell's own box, and both carry no fill and no
      pointer events, so the ring is decoration that cannot be clicked or
      selected.
    -->
    {#if keyboardFocus && activeCell !== undefined}
      <rect
        class="focus-ring"
        x={activeCell.x - 1.5}
        y={activeCell.y - 1.5}
        width={activeCell.width + 3}
        height={model.layout.rowPitch + 3}
        aria-hidden="true"
      />
      <rect
        class="focus-ring focus-ring-inner"
        x={activeCell.x - 3.5}
        y={activeCell.y - 3.5}
        width={activeCell.width + 7}
        height={model.layout.rowPitch + 7}
        aria-hidden="true"
      />
    {/if}
  </svg>
</div>

<style>
  /*
    The horizontal scroller. `overflow-y: hidden` is not cosmetic: with the
    default `visible` the browser computes a used `overflow-y` of `auto` and
    the focus ring's 1.5px overhang starts a second scroll axis. The padding
    is the room that overhang needs.
  */
  .scroller {
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    padding: 4px 0;
    min-width: 0;
  }

  /* No `viewBox` (see above), so these are CSS units at their declared size
     and the text below is genuinely 14px rather than "14 user units". */
  svg {
    display: block;
    /* The other half of an unclipped ring: the scroller's 4px of vertical
       padding is the room the ring's overhang needs, and this stops the svg
       cropping that overhang at its own edge, which matters most on the bottom
       row and the last column where the cell is flush with the svg edge. */
    overflow: visible;
  }

  /* Axis text: the Caption role, set in the style block rather than per
     element so the fourteen labels are one rule. `fill`, not `color` — SVG
     text takes its paint from `fill`. */
  .axis {
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    fill: var(--muted);
  }

  /*
    The 1px white stroke is the cell separator (UI-SPEC Color), drawn centred on
    the edge so the grid keeps its exact 24px pitch. Cells suppress the browser
    outline because the focus ring is drawn as an SVG overlay in Task 2: a CSS
    outline on a `<rect>` is clipped by the svg and covered by later siblings,
    which is the failure Pattern 6 probed.
  */
  .cell {
    stroke: #ffffff;
    stroke-width: 1;
    outline: none;
  }

  .level-0 {
    fill: var(--ramp-0);
  }
  .level-1 {
    fill: var(--ramp-1);
  }
  .level-2 {
    fill: var(--ramp-2);
  }
  .level-3 {
    fill: var(--ramp-3);
  }
  .level-4 {
    fill: var(--ramp-4);
  }
  .level-5 {
    fill: var(--ramp-5);
  }

  /*
    The two-tone ring, shared by the keyboard focus ring and the pointer hover
    outline so the two cannot drift apart. Nothing about it animates (UI-SPEC
    section 9). `stroke-width: 3` centred on the rect's own edge puts
    1.5px outside the cell; the inner rect is stroked at 1px and sits 3.5px
    out, so its stroke lands in the gap between them. `fill: none` is what
    keeps the cell's shade visible through the ring, and `pointer-events: none`
    keeps the overlay from becoming the thing a click lands on.
  */
  .focus-ring,
  .hover-ring {
    fill: none;
    stroke: var(--focus);
    stroke-width: 3;
    pointer-events: none;
  }

  .focus-ring-inner,
  .hover-ring-inner {
    stroke: #ffffff;
    stroke-width: 1;
  }
</style>
