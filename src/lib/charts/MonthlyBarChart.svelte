<script lang="ts">
  import { tick } from 'svelte';
  import type { BarChartModel, BarChartKey, BarCell } from './bar-chart-model.ts';
  import {
    BAR_LAYOUT,
    barChartNavigate,
    buildBarChartModel,
    initialBarFocus,
  } from './bar-chart-model.ts';
  import type { TooltipRequest } from '../features/playtime/playtime-model.ts';
  import { scrollClear } from '../core/focus-clear.ts';

  interface Props {
    /** The chart's geometry and axis details from buildBarChartModel. */
    model: BarChartModel;
    /** Test ID for the svg element. */
    chartTestId?: string;
    /** Test ID for hit rect cells. */
    cellTestId?: string;
    /** Accessible label for the grid. */
    ariaLabel: string;
    /** ID of the hint element describing keyboard navigation. */
    describedBy: string;
    /** Function returning the accessible name for cell at index. */
    cellName: (index: number) => string;
    /** Function returning data attributes for cell at index. */
    cellAttrs: (index: number) => Record<string, number | string>;
    /** Function returning tooltip lines for cell at index. */
    tip: (index: number) => { line1: string; line2: string; extra?: readonly string[] };
    /** Top y-axis label with text and exact value. */
    yTop: { text: string; exact: string };
    /** Optional bottom y-axis label for currency charts. */
    yBottom?: { text: string; exact: string };
    /** Callback to open/close shared tooltip. */
    onTip?: (request: TooltipRequest | null, anchor?: Element | null) => void;
  }

  let {
    model,
    chartTestId = 'monthly-chart',
    cellTestId = 'monthly-cell',
    ariaLabel,
    describedBy,
    cellName,
    cellAttrs,
    tip,
    yTop,
    yBottom,
    onTip = () => {},
  }: Props = $props();

  // eslint-disable-next-line svelte/prefer-writable-derived
  let active = $state(0);
  let keyboardFocus = $state(false);
  let hoverIndex = $state.raw<number | null>(null);
  let element = $state<SVGSVGElement | null>(null);

  // The scroller's own content box, delivered by a ResizeObserver. The scroller
  // is a block whose width its parent sets (never the svg), so measuring it cannot
  // feed back. `contentRect.width` is fractional and the model floors it, so a
  // filled chart is never wider than its box. Until the first observation it
  // reads 0, which means today's geometry (plan 08-20, G-08-3).
  let rect = $state<DOMRectReadOnly | null | undefined>(undefined);
  const measured = $derived(rect?.width ?? 0);
  const laid = $derived(buildBarChartModel(model.input, measured));

  // Keyed to the DATA model, never to `laid`: a resize must not reset roving focus.
  $effect(() => {
    active = initialBarFocus(model) ?? 0;
  });

  const activeCell = $derived(laid.cells[active]);
  const hoverCell = $derived(hoverIndex === null ? null : (laid.cells[hoverIndex] ?? null));

  function cellFrom(target: EventTarget | null): { index: number; cell: BarCell } | null {
    const node = target instanceof Element ? target.closest('[data-index]') : null;
    if (node === null) return null;
    const index = Number(node.getAttribute('data-index'));
    const cell = Number.isInteger(index) ? laid.cells[index] : undefined;
    return cell === undefined ? null : { index, cell };
  }

  function rectOf(node: Element): { left: number; top: number; width: number; height: number } {
    const box = node.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  function showTip(node: Element, index: number): void {
    const t = tip(index);
    onTip(
      {
        anchor: rectOf(node),
        line1: t.line1,
        line2: t.line2,
        extra: t.extra,
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
    hoverIndex = found.index;
    const node = (event.target as Element).closest('[data-index]');
    if (node !== null) showTip(node, found.index);
  }

  function onPointerOut(event: PointerEvent): void {
    // The touch counterpart of the guard in `onPointerOver`. Touch dismissal
    // is decided in one place instead — `ChartTooltip`, which knows whether
    // the tooltip is pinned and which chart owns it.
    if (event.pointerType === 'touch') return;
    if (cellFrom(event.relatedTarget) !== null) return;
    hoverIndex = null;
    onTip(null, null);
  }

  /**
   * A press clears the keyboard ring, and a TOUCH press opens the tooltip.
   *
   * The ring is cleared first and unconditionally, exactly as it was by the
   * inline arrow this replaced: a finger landing on a cell leaves no keyboard
   * ring behind, just as a mouse click does.
   *
   * The touch branch is what makes a tap show something. Whether the engine
   * also moves focus on a tap is its own decision and varies, so relying on
   * `focusin` alone would leave the tap's tooltip at the mercy of the browser;
   * resolving the cell here means the tap opens the tooltip whatever the engine
   * does afterwards. A tap on the chart's padding — an axis label, the gutter,
   * the space between cells — has no cell and closes the tooltip, which is the
   * same rule `cellFrom` already gives the mouse path.
   *
   * The two Financial charts share ONE `onTip` and therefore one tooltip
   * element, so this handler serves both: the surface it is read against is
   * this chart's own scroller, and a tap in the other chart is a MOVE across
   * charts rather than a tap inside this one.
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
      if (node !== null) showTip(node, found.index);
    }
  }

  function onFocusIn(event: FocusEvent): void {
    const found = cellFrom(event.target);
    if (found === null) return;
    active = found.index;
    const node = (event.target as Element).closest('[data-index]');
    if (node !== null) showTip(node, found.index);
  }

  function onFocusOut(event: FocusEvent): void {
    if (cellFrom(event.relatedTarget) !== null) return;
    onTip(null, null);
  }

  async function onKeyDown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Escape') {
      onTip(null, null);
      return;
    }

    const key = event.key as BarChartKey;
    const movable = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!movable.includes(key)) return;

    event.preventDefault();

    const next = barChartNavigate(active, key, model.monthCount);
    if (next === active) return;

    keyboardFocus = true;
    active = next;
    await tick();

    const node = cellNode(next);
    if (node === null) return;

    const root = document.documentElement;
    const smooth = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    try {
      node.focus();
    } finally {
      root.style.scrollBehavior = smooth;
    }

    scrollClear(node, 0);
    showTip(node, next);
  }

  function cellNode(index: number): SVGRectElement | null {
    const root = element;
    return root === null ? null : root.querySelector<SVGRectElement>(`[data-index="${index}"]`);
  }

  function tickOffset(index: number): number {
    return Math.floor((laid.cells[index]?.hitWidth ?? laid.pitch) / 2);
  }

  /** A ring follows its own cell's width, with an 8px floor so a narrow cell still shows one. */
  function ringWidthOf(cell: BarCell): number {
    return Math.max(cell.hitWidth, 8);
  }
</script>

<!--
  `data-tooltip-surface` is what makes a touch tap attributable to THIS chart
  (07-03, `touchTapAction`): a tap inside it is this chart's business, and a tap
  anywhere else on the page dismisses the pinned tooltip. It is on the scroller
  rather than the svg because the scroller is the chart's whole addressable box.
-->
<div class="chart-scroll" data-testid="bar-scroller" data-tooltip-surface bind:contentRect={rect}>
  <svg
    bind:this={element}
    data-testid={chartTestId}
    role="grid"
    tabindex="-1"
    aria-label={ariaLabel}
    aria-describedby={describedBy}
    width={laid.width}
    height={laid.height}
    onpointerover={onPointerOver}
    onpointerout={onPointerOut}
    onfocusin={onFocusIn}
    onfocusout={onFocusOut}
    onkeydown={onKeyDown}
    onpointerdown={onPointerDown}
  >
    <!-- Top & bottom plot boundary hairlines -->
    <line
      class="hairline"
      x1={BAR_LAYOUT.gutterPx}
      y1={laid.plotTop}
      x2={laid.plotRight}
      y2={laid.plotTop}
    />
    <line
      class="hairline"
      x1={BAR_LAYOUT.gutterPx}
      y1={laid.plotTop + laid.plotHeight}
      x2={laid.plotRight}
      y2={laid.plotTop + laid.plotHeight}
    />
    <!-- Zero / baseline -->
    <line
      class="zero-line"
      x1={BAR_LAYOUT.gutterPx}
      y1={laid.zeroY}
      x2={laid.plotRight}
      y2={laid.zeroY}
    />

    <!-- Y Axis Labels -->
    <text class="axis y-axis" x={48} y={laid.plotTop + 4} text-anchor="end" aria-hidden="true">
      {yTop.text}
      <title>{yTop.exact}</title>
    </text>
    <text class="axis y-axis" x={48} y={laid.zeroY + 4} text-anchor="end" aria-hidden="true">
      0
    </text>
    {#if yBottom}
      <text
        class="axis y-axis"
        x={48}
        y={laid.plotTop + laid.plotHeight + 4}
        text-anchor="end"
        aria-hidden="true"
      >
        {yBottom.text}
        <title>{yBottom.exact}</title>
      </text>
    {/if}

    <!-- Single row for gridcell elements -->
    <g role="row">
      {#each laid.cells as cell (cell.index)}
        <!-- Render bars first so hit rect covers them -->
        {#if cell.up !== null}
          <rect
            class="bar bar-in"
            x={cell.up.x}
            y={cell.up.y}
            width={cell.up.width}
            height={cell.up.height}
            data-testid="in-bar"
            data-month={cell.month}
            aria-hidden="true"
          />
        {/if}
        {#if cell.down !== null}
          <rect
            class="bar bar-out"
            x={cell.down.x}
            y={cell.down.y}
            width={cell.down.width}
            height={cell.down.height}
            data-testid="out-bar"
            data-month={cell.month}
            aria-hidden="true"
          />
        {/if}

        <!-- Hit rect carrying role gridcell -->
        <rect
          role="gridcell"
          class="cell-hit"
          x={cell.x}
          y={laid.plotTop}
          width={cell.hitWidth}
          height={laid.plotHeight}
          data-testid={cellTestId}
          data-index={cell.index}
          {...cellAttrs(cell.index)}
          aria-label={cellName(cell.index)}
          tabindex={cell.index === active ? 0 : -1}
        />
      {/each}
    </g>

    <!-- X Axis Month Labels and ticks -->
    {#each laid.labels as label (label.index)}
      <line
        class="tick"
        x1={label.x + tickOffset(label.index)}
        y1={laid.plotTop + laid.plotHeight}
        x2={label.x + tickOffset(label.index)}
        y2={laid.plotTop + laid.plotHeight + 4}
        aria-hidden="true"
      />
      <text
        class="axis x-axis"
        x={label.x + tickOffset(label.index)}
        y={laid.plotTop + laid.plotHeight + 18}
        text-anchor="middle"
        aria-hidden="true"
      >
        {cellAttrs(label.index)['data-month'] ?? cellAttrs(label.index)['month'] ?? ''}
      </text>
    {/each}

    <!-- Hover ring -->
    {#if hoverCell !== null}
      <rect
        class="hover-ring"
        data-testid="bar-hover-ring"
        x={hoverCell.x - 1.5}
        y={laid.plotTop - 1.5}
        width={ringWidthOf(hoverCell) + 3}
        height={laid.plotHeight + 3}
        aria-hidden="true"
      />
      <rect
        class="hover-ring hover-ring-inner"
        x={hoverCell.x - 3.5}
        y={laid.plotTop - 3.5}
        width={ringWidthOf(hoverCell) + 7}
        height={laid.plotHeight + 7}
        aria-hidden="true"
      />
    {/if}

    <!-- Focus ring -->
    {#if keyboardFocus && activeCell !== undefined}
      <rect
        class="focus-ring"
        data-testid="bar-focus-ring"
        x={activeCell.x - 1.5}
        y={laid.plotTop - 1.5}
        width={ringWidthOf(activeCell) + 3}
        height={laid.plotHeight + 3}
        aria-hidden="true"
      />
      <rect
        class="focus-ring focus-ring-inner"
        x={activeCell.x - 3.5}
        y={laid.plotTop - 3.5}
        width={ringWidthOf(activeCell) + 7}
        height={laid.plotHeight + 7}
        aria-hidden="true"
      />
    {/if}
  </svg>
</div>

<style>
  /*
    The horizontal scroller. It is a CHART scroller and not a focusable region,
    so it does NOT take the shared `.scroller`: that one is the focusable scroll
    region with `isolation: isolate` and a focus ring, and a chart scroller must
    not gain either. This is the local `chart-scroll` hook, and it keeps its own
    declarations. `overflow-y: hidden` is not cosmetic: with the default
    `visible` the browser computes a used `overflow-y` of `auto` and the focus
    ring's 1.5px overhang starts a second scroll axis on a chart that should
    have one. The 4px of vertical padding is the room that overhang needs.
  */
  .chart-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    padding: var(--space-4) 0;
    min-width: 0;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .axis {
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-tight);
    fill: var(--muted);
  }

  /* The 05-UI-SPEC Color table, "Chart zero line / bound lines". */
  .hairline {
    stroke: var(--border);
    stroke-width: 1;
  }

  /* The Color table's zero line. This is the non-colour cue the diverging chart
     leans on, so it is a dark line and not a hairline. */
  .zero-line {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .tick {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .cell-hit {
    fill: transparent;
    outline: none;
  }

  .bar-in {
    fill: var(--flow-in);
  }

  .bar-out {
    fill: var(--flow-out);
  }

  .focus-ring,
  .hover-ring {
    fill: none;
    stroke: var(--focus);
    stroke-width: 3;
    pointer-events: none;
  }

  .focus-ring-inner,
  .hover-ring-inner {
    stroke: var(--white);
    stroke-width: 1;
  }
</style>
