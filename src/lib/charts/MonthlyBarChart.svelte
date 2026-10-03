<script lang="ts">
  import { tick } from 'svelte';
  import type { BarChartModel, BarChartKey, BarCell } from './bar-chart-model.ts';
  import { barChartNavigate, initialBarFocus } from './bar-chart-model.ts';
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

  $effect(() => {
    active = initialBarFocus(model) ?? 0;
  });

  const activeCell = $derived(model.cells[active]);
  const hoverCell = $derived(hoverIndex === null ? null : (model.cells[hoverIndex] ?? null));

  function cellFrom(target: EventTarget | null): { index: number; cell: BarCell } | null {
    const node = target instanceof Element ? target.closest('[data-index]') : null;
    if (node === null) return null;
    const index = Number(node.getAttribute('data-index'));
    const cell = Number.isInteger(index) ? model.cells[index] : undefined;
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
    const found = cellFrom(event.target);
    if (found === null) return;
    hoverIndex = found.index;
    const node = (event.target as Element).closest('[data-index]');
    if (node !== null) showTip(node, found.index);
  }

  function onPointerOut(event: PointerEvent): void {
    if (cellFrom(event.relatedTarget) !== null) return;
    hoverIndex = null;
    onTip(null, null);
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

  const ringWidth = $derived(Math.max(model.pitch, 8));
</script>

<div class="scroller" data-testid="bar-scroller">
  <svg
    bind:this={element}
    data-testid={chartTestId}
    role="grid"
    tabindex="-1"
    aria-label={ariaLabel}
    aria-describedby={describedBy}
    width={model.width}
    height={model.height}
    onpointerover={onPointerOver}
    onpointerout={onPointerOut}
    onfocusin={onFocusIn}
    onfocusout={onFocusOut}
    onkeydown={onKeyDown}
    onpointerdown={() => {
      keyboardFocus = false;
    }}
  >
    <!-- Top & bottom plot boundary hairlines -->
    <line class="hairline" x1={56} y1={model.plotTop} x2={model.width - 4} y2={model.plotTop} />
    <line
      class="hairline"
      x1={56}
      y1={model.plotTop + model.plotHeight}
      x2={model.width - 4}
      y2={model.plotTop + model.plotHeight}
    />
    <!-- Zero / baseline -->
    <line class="zero-line" x1={56} y1={model.zeroY} x2={model.width - 4} y2={model.zeroY} />

    <!-- Y Axis Labels -->
    <text class="axis y-axis" x={48} y={model.plotTop + 4} text-anchor="end" aria-hidden="true">
      {yTop.text}
      <title>{yTop.exact}</title>
    </text>
    <text class="axis y-axis" x={48} y={model.zeroY + 4} text-anchor="end" aria-hidden="true">
      0
    </text>
    {#if yBottom}
      <text
        class="axis y-axis"
        x={48}
        y={model.plotTop + model.plotHeight + 4}
        text-anchor="end"
        aria-hidden="true"
      >
        {yBottom.text}
        <title>{yBottom.exact}</title>
      </text>
    {/if}

    <!-- Single row for gridcell elements -->
    <g role="row">
      {#each model.cells as cell (cell.index)}
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
          y={model.plotTop}
          width={cell.hitWidth}
          height={model.plotHeight}
          data-testid={cellTestId}
          data-index={cell.index}
          {...cellAttrs(cell.index)}
          aria-label={cellName(cell.index)}
          tabindex={cell.index === active ? 0 : -1}
        />
      {/each}
    </g>

    <!-- X Axis Month Labels and ticks -->
    {#each model.labels as label (label.index)}
      <line
        class="tick"
        x1={label.x + Math.floor(model.pitch / 2)}
        y1={model.plotTop + model.plotHeight}
        x2={label.x + Math.floor(model.pitch / 2)}
        y2={model.plotTop + model.plotHeight + 4}
        aria-hidden="true"
      />
      <text
        class="axis x-axis"
        x={label.x + Math.floor(model.pitch / 2)}
        y={model.plotTop + model.plotHeight + 18}
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
        y={model.plotTop - 1.5}
        width={ringWidth + 3}
        height={model.plotHeight + 3}
        aria-hidden="true"
      />
      <rect
        class="hover-ring hover-ring-inner"
        x={hoverCell.x - 3.5}
        y={model.plotTop - 3.5}
        width={ringWidth + 7}
        height={model.plotHeight + 7}
        aria-hidden="true"
      />
    {/if}

    <!-- Focus ring -->
    {#if keyboardFocus && activeCell !== undefined}
      <rect
        class="focus-ring"
        data-testid="bar-focus-ring"
        x={activeCell.x - 1.5}
        y={model.plotTop - 1.5}
        width={ringWidth + 3}
        height={model.plotHeight + 3}
        aria-hidden="true"
      />
      <rect
        class="focus-ring focus-ring-inner"
        x={activeCell.x - 3.5}
        y={model.plotTop - 3.5}
        width={ringWidth + 7}
        height={model.plotHeight + 7}
        aria-hidden="true"
      />
    {/if}
  </svg>
</div>

<style>
  .scroller {
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    padding: 4px 0;
    min-width: 0;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .axis {
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    fill: #5f6368;
  }

  /* The 05-UI-SPEC Color table, "Chart zero line / bound lines". */
  .hairline {
    stroke: #dadce0;
    stroke-width: 1;
  }

  /* The Color table's zero line. This is the non-colour cue the diverging chart
     leans on, so it is a dark line and not a hairline. */
  .zero-line {
    stroke: #5f6368;
    stroke-width: 1;
  }

  .tick {
    stroke: #5f6368;
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
    stroke: #1a73e8;
    stroke-width: 3;
    pointer-events: none;
  }

  .focus-ring-inner,
  .hover-ring-inner {
    stroke: #ffffff;
    stroke-width: 1;
  }
</style>
