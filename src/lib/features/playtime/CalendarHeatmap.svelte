<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type {
    CalendarCell,
    CalendarKey,
    CalendarModel,
    TooltipRequest,
  } from './playtime-model.ts';
  import {
    calendarNavigate,
    hoursAttribute,
    initialCalendarFocus,
    isDrawnDay,
  } from './playtime-model.ts';
  import { scrollClear } from '../../core/focus-clear.ts';
  import {
    ABOUT_NAME_CALENDAR,
    CALENDAR_KEYBOARD_HINT,
    MONTH_SHORT,
    WEEKDAY_SHORT,
    formatCalendarCellLabel,
    formatCalendarDate,
    formatCalendarLegendNote,
    formatCalendarTooltipLine2,
    formatCalendarYearLabel,
    formatEmptyYearRun,
    formatYearSummary,
  } from '../../ui-copy.ts';
  import AboutDisclosure from '../../charts/AboutDisclosure.svelte';
  import ChartLegend from '../../charts/ChartLegend.svelte';

  /**
   * The year-by-year calendar heatmap (ACTIVITY-02, D-04).
   *
   * ## What one year block is, and why the head is a SIBLING of the scroller
   *
   * A block is a sticky head and a horizontal scroller, as siblings (RESEARCH
   * Pitfall 6, UI-SPEC section 5). A `position: sticky` element inside an
   * `overflow` container sticks to THAT CONTAINER rather than to the page, so
   * a head nested in the scroller would stop sticking the moment the year slid
   * sideways — which at 375px is the normal state, not an edge case. The head
   * carries the year, so it is the one thing a reader scrolling a 634px grid
   * inside a 295px card must never lose.
   *
   * ## Why every day of an active year is drawn
   *
   * Not every day with a session. D-04's node-count rule is the whole point:
   * the cell count is the days in the active years and never the session
   * count, so a 50,000-session export and a 500-session export draw the same
   * rectangles. It is also what makes the grid informative — the empty runs
   * inside it are the shape of the account's play, and a grid that drew only
   * the busy days would hide them.
   *
   * ## Why the svg is never scaled
   *
   * No `viewBox`, for the same reason the hour grid has none: the month and
   * weekday labels are set in the Caption role and must stay 14px. The svg has
   * a fixed pixel size equal to the measured pane width (`model.layout`), and
   * is never scaled. Below the floor, today's 634 x 97 geometry fits 54 week
   * columns and at 375px the SCROLLER moves and the chart does not.
   *
   * ## Why the fill is a class and never an attribute
   *
   * `src/styles/tokens.css` declares `--heat-empty` and `--heat-1` to
   * `--heat-5` once and `tests/unit/charts/contrast.test.ts` fails on any
   * component restating a step. The scale is rank-based (D-04), so the six
   * tokens are the whole vocabulary: interpolating a level would be a second
   * declaration and a shade no test could pin to the Color table.
   */
  interface Props {
    /** The blocks, the shared scale and the legend, from `buildCalendarModel`. */
    model: CalendarModel;
    /**
     * Ask the owner to open or close the one shared tooltip, and tell it which
     * element the request was measured from.
     *
     * The element is the SECOND argument, not part of `TooltipRequest` (04-05's
     * type, and the tested contract between the chart and the copy functions):
     * it is what lets the tooltip tell a focus-correction scroll apart from a
     * reader scrolling away, so a keyboard user who moves a cell up under the
     * nav does not watch the tooltip open and vanish. See `isStale` in
     * `ChartTooltip`.
     */
    onTip: (request: TooltipRequest | null, anchor?: Element | null | undefined) => void;
  }

  let { model, onTip }: Props = $props();

  /**
   * The keyboard hint's id, generated so a second calendar on one page could
   * not share it — the same reason `Playtime.svelte` takes its `<label for>`
   * from `$props.id()`.
   */
  const hintId = $props.id();

  /**
   * The day the roving stop is on, as a DAY NUMBER rather than a cell index.
   *
   * A day is the only identifier that survives moving between years: the
   * calendar is a stack of separate svgs, so an index into one year's cells
   * means nothing in the next one. Left/Right and PageUp/PageDown both cross
   * year boundaries, and the keys are `day + 7` and a same-date-in-another-
   * year in `calendarNavigate`, so the component never has to know which svg a
   * day is drawn in.
   */
  let activeDay = $state.raw<number | null>(null);

  /**
   * Whether the focus currently in the calendar is the KEYBOARD's.
   *
   * The ring is drawn only when this is true: a ring left behind by a mouse
   * click tells a reader the pointer is somewhere it is not. Set on a key
   * press, cleared on a pointer press, and it is a flag rather than a
   * `:focus-visible` match because an SVG `<rect>` has no reliable
   * `:focus-visible` styling across engines (RESEARCH Pattern 6).
   */
  let keyboardFocus = $state(false);

  /**
   * The day under the POINTER, for the hover outline.
   *
   * This is pointer position and nothing else: it never moves `activeDay`,
   * never sets `keyboardFocus`, and so cannot draw, move or clear the keyboard
   * ring. It is deliberately NOT cleared by `onPointerDown` — a click does not
   * move the pointer, so the cell under it is still the cell under it.
   */
  let hoverDay = $state.raw<number | null>(null);

  /**
   * The day that holds the single tab stop, which is not always `activeDay`.
   *
   * A selector change replaces the slice, and the new slice may not draw the
   * year the stop was on: 2018 and 2012 both have sessions but 2015 does not,
   * so filtering to 2012 leaves the stop pointing at a cell that no longer
   * exists and Tab lands nowhere. Falling back to the model's own initial day
   * keeps exactly one cell at `0` in every state.
   */
  const focusDay = $derived(
    activeDay !== null && isDrawnDay(model, activeDay) ? activeDay : initialCalendarFocus(model),
  );

  /**
   * Every drawn cell by day, built ONCE per model.
   *
   * The key handler has to find the cell for an arbitrary day — which may be
   * in any of the year blocks — and a linear scan of up to 366 cells per year
   * on every key press is a cost that grows with the years drawn. The map is
   * a `$derived`, so switching the selector rebuilds it exactly once rather
   * than once per key press.
   *
   * It is filled and then only ever READ, which is why it is a snapshot rather
   * than reactive state: nothing observes a mutation of it, and the whole
   * point is that the DOM is the source of truth for what is drawn. It is a
   * `SvelteMap` because that is what `svelte/prefer-svelte-reactivity` asks
   * for in a component, and a reactive map is a correct map.
   */
  const cellsByDay = $derived.by(() => {
    const map = new SvelteMap<number, CalendarCell>();
    for (const block of model.blocks) {
      if (block.kind !== 'year') continue;
      for (const row of block.rows) for (const cell of row) map.set(cell.day, cell);
    }
    return map;
  });

  /**
   * The cell the hover outline is drawn on, or null.
   *
   * Resolved through `cellsByDay` rather than trusted, so a day that a selector
   * change has since removed draws nothing instead of outlining a cell that is
   * not under the pointer.
   */
  const hoverCell = $derived(hoverDay === null ? null : (cellsByDay.get(hoverDay) ?? null));

  /** The container, for the delegated handlers' cell lookups. */
  let element = $state<HTMLDivElement | null>(null);

  /**
   * The cell under an event, found by its `data-day`.
   *
   * `closest` rather than a per-cell closure, because the handlers are
   * delegated to the svg: the event target is whatever the pointer or the focus
   * actually landed on, which may be the rect itself but is never assumed to
   * be. A `data-day` that is not a drawn day returns null, so a click on the
   * month labels or the padding is a dismissal rather than a focus on nothing.
   */
  function cellFrom(target: EventTarget | null): { day: number; cell: CalendarCell } | null {
    const node = target instanceof Element ? target.closest('[data-day]') : null;
    if (node === null) return null;
    const day = Number(node.getAttribute('data-day'));
    const cell = Number.isInteger(day) ? cellsByDay.get(day) : undefined;
    return cell === undefined ? null : { day, cell };
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
   * Open the tooltip on a cell, and record WHICH cell it was measured from.
   *
   * The two lines are the same words the cell's accessible name is built from,
   * so a sighted reader and a screen-reader user are told the same thing about
   * the same cell (UI-SPEC section 8). The anchor is the second argument
   * because `TooltipRequest` is 04-05's and holds numbers by design: without a
   * real element the shared tooltip cannot tell the focus-correction scroll
   * apart from a reader scrolling away, and dismisses the tooltip the focus
   * that caused the correction had just opened.
   */
  function showTip(node: Element, cell: CalendarCell): void {
    onTip(
      {
        anchor: rectOf(node),
        line1: formatCalendarDate(cell.day),
        line2: formatCalendarTooltipLine2(cell.seconds, cell.sessions),
      },
      node,
    );
  }

  function onPointerOver(event: PointerEvent): void {
    // A touch tap fires over, down, up and out in that order, so handling the
    // over for touch would open a tooltip the very same tap then closes at its
    // `out`. Touch opens the tooltip on press instead — see `onPointerDown`.
    if (event.pointerType === 'touch') return;
    const found = cellFrom(event.target);
    if (found === null) return;
    hoverDay = found.day;
    const node = (event.target as Element).closest('[data-day]');
    if (node !== null) showTip(node, found.cell);
  }

  /**
   * Hide on pointer leave.
   *
   * `pointerout` rather than `pointerleave`, because `pointerleave` is not one
   * of the events Svelte 5 delegates (RESEARCH Pattern 6) — a per-node
   * binding on 2,922 rects is exactly what this component must not have. The
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
    hoverDay = null;
    onTip(null, null);
  }

  /**
   * Focus moves the roving stop with it, and opens the tooltip.
   *
   * The stop has to FOLLOW focus, not merely start at January 1 of the newest
   * year, or the first arrow press after arriving by Tab, by click or
   * programmatically would be computed from a cell the reader is no longer
   * on: focus a cell 200 days in, press Right, and focus would jump to a week
   * from the top of the grid (04-09's D3, applied here).
   */
  function onFocusIn(event: FocusEvent): void {
    const found = cellFrom(event.target);
    if (found === null) return;
    activeDay = found.day;
    const node = (event.target as Element).closest('[data-day]');
    if (node !== null) showTip(node, found.cell);
  }

  function onFocusOut(event: FocusEvent): void {
    if (cellFrom(event.relatedTarget) !== null) return;
    onTip(null, null);
  }

  /**
   * The eight navigation keys, plus Escape.
   *
   * The next day is `calendarNavigate`'s, not arithmetic here: its edge rules
   * (no wrapping at a week column edge, Home/End the year's own first and last
   * week, PageUp/PageDown skipping collapsed empty runs and clamping February
   * 29) are 04-05's and are unit-tested. A component that computed the
   * neighbour itself would be free to wrap, and a wrapped roving focus is a
   * focus trap.
   */
  async function onKeyDown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Escape') {
      onTip(null, null);
      return;
    }

    const key = event.key as CalendarKey;
    const movable = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ];
    if (!movable.includes(key)) return;

    // These eight keys belong to the calendar, and the default is prevented
    // whether or not the focus actually moves. At a week-column edge — ArrowUp
    // on the first row, ArrowRight on December 31 — the reducer returns the
    // same day, and an unprevented arrow key there is the BROWSER scrolling the
    // page: the calendar stays put while the page moves out from under the
    // focused cell, which is the one thing the roving model exists to prevent,
    // and it closes the tooltip on the way past (04-09's D4).
    event.preventDefault();

    const from = focusDay;
    if (from === null) return;
    const next = calendarNavigate(model, from, key);
    // A key that does not move focus is also a key that must not look like it
    // did, so the ring is switched on only below this line.
    if (next === from) return;

    keyboardFocus = true;
    activeDay = next;
    // The `tabindex` attributes have to move before the browser can focus the
    // new cell: focusing a `tabindex="-1"` rect works, but focusing while the
    // OLD cell is still `0` fights the browser's own sequential-focus
    // bookkeeping.
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
    // navigation and this chart declares no motion of its own (UI-SPEC section
    // 9), so it is made instantaneous here and in `scrollClear`.
    const root = document.documentElement;
    const smooth = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    try {
      node.focus();
    } finally {
      root.style.scrollBehavior = smooth;
    }

    // The MEASURED height of the year head the focused cell now sits under.
    // Not 32: the head is a wrapping row, its summary drops to a second line
    // at 375px, and RESEARCH Pitfall 6 is explicit that a head assumed to be
    // 32px is a head the grid disappears under. The hour grid passes 0 because
    // nothing is above it.
    scrollClear(node, headHeightFor(node));
    // Measure AFTER both scrolls, not before: the tooltip's anchor is the
    // cell's position on screen, and a position captured mid-correction is a
    // position the cell is about to leave.
    const moved = cellsByDay.get(next);
    if (moved !== undefined) showTip(node, moved);
  }

  /**
   * The `<rect>` for one day, or null if it is not in the DOM yet.
   *
   * Queried on the CONTAINER rather than on one year's svg, because Left and
   * Right cross into the adjacent year and PageUp/PageDown skip whole runs:
   * the cell a key press lands on is routinely in a different svg than the one
   * the press happened in.
   */
  function cellNode(day: number): SVGRectElement | null {
    const root = element;
    return root === null ? null : root.querySelector<SVGRectElement>(`[data-day="${day}"]`);
  }

  /**
   * The real height of the sticky head the given cell sits under, or 0.
   *
   * Measured from the cell's OWN year block, so a focus that crossed a year
   * boundary is corrected against the head that is actually above it. Read
   * after the focus has settled, when the head is stuck at its `top`.
   */
  function headHeightFor(cell: Element): number {
    const year = cell.closest('[data-testid^="calendar-year-"]');
    if (year === null) return 0;
    const head = year.querySelector('[data-testid^="calendar-year-head-"]');
    return head instanceof HTMLElement ? head.offsetHeight : 0;
  }

  /**
   * Which year block a cell belongs to.
   *
   * From the CELL'S OWN `data-date` rather than from the day number, so there
   * is no second date rule in a component: the year is the first four
   * characters of the `YYYY-MM-DD` the model already produced, and the ring is
   * rendered inside whichever year's svg is being drawn and has to know whether
   * the focused day is even in that year. Without the check a ring would be
   * drawn in EVERY year's grid at the same x and y, which on a stack of
   * decade-long grids is up to eight rings on eight different days.
   */
  function isInYear(cell: CalendarCell, year: number): boolean {
    return cell.date.slice(0, 4) === String(year);
  }

  /**
   * A pointer press is not keyboard navigation, so it clears the ring.
   *
   * Delegated alongside the others for the same reason, and handled on
   * `pointerdown` rather than `pointerup` so the ring disappears in the same
   * frame the button goes down. Without it a reader who arrow-keys to a day
   * and then clicks a different cell is left looking at a ring pointing at a
   * cell they are not on.
   */
  function onPointerDown(event: PointerEvent): void {
    keyboardFocus = false;
    // The touch branch is what makes a tap show something. Whether the engine
    // also moves focus on a tap is its own decision and varies, so relying on
    // `focusin` alone would leave the tap's tooltip at the mercy of the
    // browser; resolving the day here means the tap opens the tooltip whatever
    // the engine does afterwards. A tap on the chart's padding — a month
    // label, the gutter, the space between days — has no cell and closes the
    // tooltip, which is the same rule `cellFrom` already gives the mouse path.
    if (event.pointerType === 'touch') {
      const found = cellFrom(event.target);
      if (found === null) {
        onTip(null, null);
        return;
      }
      const node = (event.target as Element).closest('[data-day]');
      if (node !== null) showTip(node, found.cell);
    }
  }
</script>

<!--
  `data-tooltip-surface` is what makes a touch tap attributable to THIS chart
  (07-03, `touchTapAction`): a tap inside it is this chart's business, and a tap
  anywhere else on the page dismisses the pinned tooltip. It is on the root
  because the root holds every year block — the whole chart is the surface.
-->
<div class="calendar" data-testid="calendar-chart" data-tooltip-surface bind:this={element}>
  <!--
    The key model as real text rather than a title attribute, linked with
    `aria-describedby` so a screen-reader user meets it before the first cell
    instead of having to go looking for it. It is inside the calendar and not
    in the container because the calendar owns the keys it describes. It sits
    inside the "About this calendar" disclosure (08-06): a collapsed details
    keeps its content in the tree, so the id still resolves for the cells.
  -->
  <AboutDisclosure name={ABOUT_NAME_CALENDAR} testId="about-calendar">
    <p class="muted-note" id={hintId}>{CALENDAR_KEYBOARD_HINT}</p>
  </AboutDisclosure>

  {#each model.blocks as block (block.kind === 'year' ? `y${block.year}` : `e${block.fromYear}`)}
    {#if block.kind === 'empty'}
      <!--
        A run of consecutive years with no sessions is ONE line, never a grid
        (D-04, T-04-08). Without it, a stray 1970 or 9999 row would draw
        dozens of empty 366-cell rectangles between two real years, and the
        node count would stop being a function of the active years.
      -->
      <p class="muted-note" data-testid="calendar-empty-run">
        {formatEmptyYearRun(block.fromYear, block.toYear)}
      </p>
    {:else}
      <div class="year" data-testid="calendar-year-{block.year}">
        <!--
          The head, SIBLING of the scroller below it (RESEARCH Pitfall 6). A
          wrapping flex row rather than a breakpoint: on a wide screen the
          summary sits beside the year, at 375px it wraps below, and the real
          height is measured at focus time in both cases, so a head assumed to
          be 32px is never the height the focus correction uses.

          There is no sticky chrome over the content (the list pane is a column
          beside it), so `top: calc(var(--nav-offset) - 16px)` resolves to 0:
          the head sticks at the very top of the viewport; `z-index: 0` keeps it
          below the tooltip and anything else that is positioned.
        -->
        <div class="year-head" data-testid="calendar-year-head-{block.year}">
          <h5 class="t-note-strong">{block.year}</h5>
          <p class="muted-note">
            {formatYearSummary(block.seconds, block.sessions, block.activeDays)}
          </p>
        </div>

        <div class="chart-scroll" data-testid="calendar-scroller-{block.year}">
          <!--
            The six delegated event attributes, SIX on each year svg rather
            than on each of up to 366 cells. Svelte 5 attaches its listeners at
            the element carrying the attribute and resolves the target as the
            event bubbles, so this is six listeners per year and none per cell:
            a per-cell closure would be a listener count that grows with the
            data, which is the thing the scale requirement forbids (RESEARCH
            Pattern 6).
          -->
          <svg
            role="grid"
            tabindex="-1"
            aria-label={formatCalendarYearLabel(block.year)}
            aria-describedby={hintId}
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
              Month labels first, so a cell rect painted later can never cover
              one. `aria-hidden` because a cell's own accessible name carries its
              full date; these are for a sighted reader scanning the columns.
            -->
            {#each block.monthLabels as label (label.month)}
              <text class="axis t-note" x={label.x} y={14} aria-hidden="true">
                {MONTH_SHORT[label.month - 1]}
              </text>
            {/each}

            <!--
              The weekday labels for the three rows that carry one (Mon, Wed,
              Fri), right-aligned `labelPad` inside the first column's edge and
              vertically centred on their row, at the same place the UI-SPEC
              geometry row puts them: the left gutter, `text-anchor: end`.

              The pad is `model.layout.labelPad` and not a literal, because
              the room these labels have is the gutter MINUS it: at an 8px pad
              the 32px gutter left 24px for a 29px "Wed", which started at a
              negative x and had its first letter clipped by the scroller in
              every year (UAT G-04-UI-1, 04-UI-SPEC Amendment A-1).
            -->
            {#each model.layout.weekdayLabelRows as row (row)}
              <text
                class="axis t-note"
                x={model.layout.gutter - model.layout.labelPad}
                y={model.layout.band +
                  row * model.layout.rowPitch +
                  Math.round(model.layout.cellHeight / 2) +
                  2}
                text-anchor="end"
                aria-hidden="true"
              >
                {WEEKDAY_SHORT[row]}
              </text>
            {/each}

            {#each block.rows as row, rowIndex (rowIndex)}
              <g role="row">
                {#each row as cell (cell.day)}
                  <!--
                    One 10 x 10 rect per day, on an 11px pitch, the fill a
                    level class and the value every attribute. `data-day` is the
                    key the delegated handlers resolve a cell by, and the day
                    the roving stop is compared against, so it is additive to
                    the UI-SPEC hook table and carries nothing but a date.

                    `tabindex` is `-1` on every cell except the ONE that holds
                    the chart's single tab stop, so Tab enters the calendar once
                    and leaves on the next Tab (UI-SPEC's keyboard model). It is
                    the model's `focusDay` rather than the focus day: when a
                    selector change removes the year the focus was on, the stop
                    falls back to the model's own initial day instead of
                    pointing at a cell that no longer exists, and so exactly one
                    cell in the whole chart is at `0` in every state.
                  -->
                  <rect
                    role="gridcell"
                    class="cell level-{cell.level}"
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={model.layout.cellHeight}
                    data-testid="calendar-cell"
                    data-date={cell.date}
                    data-day={cell.day}
                    data-level={cell.level}
                    data-hours={hoursAttribute(cell.seconds)}
                    data-seconds={cell.seconds}
                    data-sessions={cell.sessions}
                    aria-label={formatCalendarCellLabel(cell.day, cell.seconds, cell.sessions)}
                    tabindex={cell.day === focusDay ? 0 : -1}
                  />
                {/each}
              </g>
            {/each}

            <!--
              The hover outline: the cell under the pointer, in THIS year's svg
              only, drawn with the keyboard ring's own two-rect construction.

              An overlay and not a stroke on the hovered cell, for the reason
              the focus ring below records: an SVG `<rect>` paints with its own
              geometry, so a stroke on a cell is covered on its right and bottom
              by the later sibling cells, and the result is a lopsided ring.
              There is no CSS z-index for SVG children to fix that, so the ring
              is drawn after every cell instead.

              It is not gated on `keyboardFocus`: hover is where the pointer is,
              not keyboard navigation, and must neither draw nor clear the
              keyboard ring. It sits BEFORE the keyboard ring so that, where the
              two touch, the keyboard ring stays the last painted element.

              No `data-*`, no `tabindex`, no `role`: `cellFrom` resolves through
              `closest('[data-day]')` and a ring must never be mistaken for a
              cell, and nothing but dates may sit on a hook.
            -->
            {#if hoverCell !== null && isInYear(hoverCell, block.year)}
              <rect
                class="hover-ring"
                x={hoverCell.x - 1.5}
                y={hoverCell.y - 1.5}
                width={hoverCell.width + 3}
                height={model.layout.cellHeight + 3}
              />
              <rect
                class="hover-ring hover-ring-inner"
                x={hoverCell.x - 3.5}
                y={hoverCell.y - 3.5}
                width={hoverCell.width + 7}
                height={model.layout.cellHeight + 7}
              />
            {/if}

            <!--
              The focus ring, LAST inside the svg and only for the focused day
              of THIS year.

              Last, because an SVG `<rect>` paints with its own geometry: a ring
              drawn in among the row groups is covered by the cells to its right
              and below, which at a 10px cell and an 11px pitch is most of the
              ring (RESEARCH Pattern 6). It is also why the scroller carries 4px
              of vertical padding and the svg allows overflow — a 3px stroke
              centred on the cell's edge overhangs by 1.5px, and at the bottom
              row and the rightmost column that overhang is the whole visible
              ring.

              Two rects, because the accent alone is unreadable on the dark end
              of the heat scale: a 3px var(--focus) stroke outside a 1px
              var(--white) one, so there is always a light edge between the
              ring and the cell under it (UI-SPEC's Color table, same
              construction as the hour grid's).
            -->
            {#if keyboardFocus && focusDay !== null && cellsByDay.get(focusDay) !== undefined}
              {@const focusCell = cellsByDay.get(focusDay)!}
              {#if isInYear(focusCell, block.year)}
                <rect
                  class="focus-ring"
                  x={focusCell.x - 1.5}
                  y={focusCell.y - 1.5}
                  width={focusCell.width + 3}
                  height={model.layout.cellHeight + 3}
                />
                <rect
                  class="focus-ring focus-ring-inner"
                  x={focusCell.x - 3.5}
                  y={focusCell.y - 3.5}
                  width={focusCell.width + 7}
                  height={model.layout.cellHeight + 7}
                />
              {/if}
            {/if}
          </svg>
        </div>
      </div>
    {/if}
  {/each}

  <!--
    ONE legend for the whole chart, after the last block: the scale is computed
    across all years together (D-04), so a per-year legend would imply a
    per-year scale and a dark day in 2012 would not mean the same as one in
    2024. `ChartLegend` is the same component the hour grid uses, and it is
    that component that reads the six heat swatches.
  -->
  <ChartLegend
    levels={model.legend.levels}
    note={formatCalendarLegendNote(model.legend.darkestAbove)}
    testId="calendar-legend"
  />
</div>

<style>
  /*
    The chart: the hint, then the year blocks, then the one legend. `min-width:
    0` is what lets each year's scroller shrink inside the card instead of the
    card widening to 634px.
  */
  .calendar {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
  }

  .year {
    min-width: 0;
  }

  /*
    The sticky head. A WRAPPING row rather than a breakpoint: at 375px the
    summary wraps below the year and the head grows past its 32px minimum, and
    RESEARCH Pitfall 6 is explicit that a head whose height is assumed to be
    32px overlaps the grid at that width. Task 2 measures it instead.
  */
  .year-head {
    position: sticky;
    top: calc(var(--nav-offset) - 16px);
    z-index: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-4) var(--space-8);
    min-height: 32px;
    padding: var(--space-4) 0;
    min-width: 0;
    background: var(--page);
    border-bottom: 1px solid var(--border);

    /* The year itself is the strong note role (`.t-note-strong`, on the `h5`),
       var(--ink) — the same role the chart titles use, so a year reads as a
       level of the same kind rather than introducing a sixth size. `h1` ->
       `h2` section -> `h3` Playtime -> `h4` chart title -> `h5` year: nothing
       skips a level. */
    & h5 {
      margin: 0;
      color: var(--ink);
    }
  }

  /*
    The horizontal scroller. `overflow-y: hidden` is not cosmetic, and is the
    same reason the hour grid has it: with the default `visible` the browser
    computes a used `overflow-y` of `auto` and the focus ring's 1.5px overhang
    starts a second scroll axis on a chart that should have one. The 4px of
    vertical padding is the room that overhang needs.
  */
  .chart-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    padding: var(--space-4) 0;
    min-width: 0;
  }

  /*
    No `viewBox` (see above), so these are CSS units at their declared size
    and the text below is genuinely 14px rather than "14 user units".

    `overflow: visible` is the other half of the unclipped ring: the scroller
    below carries 4px of vertical padding for the 1.5px the 3px stroke
    overhangs, and this is what lets the overhang exist at all rather than being
    cropped at the svg's edge — the bottom row and the rightmost column are
    where a cropped ring is most visible, and a ring that is missing its
    bottom edge reads as no ring at all.
  */
  svg {
    display: block;
    overflow: visible;
  }

  /*
    The two-tone ring, drawn with no `fill` and no pointer events so it is an
    outline and not a target: the cell underneath must keep receiving the
    clicks and the focus, or the ring would be a hole in the grid.

    One rule for the keyboard ring and the hover ring, so the two cannot drift
    apart. There is no `transition` (UI-SPEC section 9): the ring appears and
    disappears, it does not animate.
  */
  .focus-ring,
  .hover-ring {
    fill: none;
    stroke: var(--focus);
    stroke-width: 3;
    pointer-events: none;
  }

  /*
    The 1px white stroke OUTSIDE the 3px accent, so there is always a light
    edge between the ring and the cell under it. The accent is at its weakest
    against the darkest fill of the heat scale, so the light edge is what keeps
    the ring readable on the busiest days of the busiest year (UI-SPEC's Color
    table). The colour is the `--white` token, and the level is named here
    only as a level so the one-declaration guard does not read this as a
    second declaration.

    Shared by both rings for the same reason as the rule above, and after it:
    equal specificity, so source order makes the inner stroke win.
  */
  .focus-ring-inner,
  .hover-ring-inner {
    stroke: var(--white);
    stroke-width: 1;
  }

  /* Axis text: the type comes from the note role (`.t-note`, on each label);
     this rule keeps the paint. `fill`, not `color` — SVG text takes its paint
     from `fill`. */
  .axis {
    fill: var(--muted);
  }

  /*
    The 1px white stroke is the cell separator, drawn centred on the edge so
    the grid keeps its exact 11px pitch. Cells suppress the browser outline
    because the focus ring is drawn as an SVG overlay in Task 2: a CSS outline
    on a `<rect>` is clipped by the svg and covered by later siblings, which
    is the failure RESEARCH Pattern 6 probed.
  */
  .cell {
    stroke: var(--white);
    stroke-width: 1;
    outline: none;
  }

  .level-0 {
    fill: var(--heat-empty);
  }
  .level-1 {
    fill: var(--heat-1);
  }
  .level-2 {
    fill: var(--heat-2);
  }
  .level-3 {
    fill: var(--heat-3);
  }
  .level-4 {
    fill: var(--heat-4);
  }
  .level-5 {
    fill: var(--heat-5);
  }
</style>
