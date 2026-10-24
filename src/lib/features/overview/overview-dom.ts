/**
 * overview-dom.ts — the Overview's only route from script into a style (13-09).
 *
 * ## Why the CSSOM
 *
 * The page's CSP is `default-src 'self'` with no `unsafe-inline`, so a `style`
 * attribute is refused by the browser, and `svelte/no-inline-styles` refuses it
 * in the source. A custom property written with `style.setProperty` goes
 * through the CSSOM instead, which the CSP does not govern. `ChartTooltip`
 * positions itself the same way, with `left` and `top`.
 *
 * ## What is written
 *
 * The bento's fill rule hands each tile the EXTRA columns and rows it takes
 * (`--span4`, `--rows4`, `--span2`), the expand motion names a tile for the
 * View Transitions API (`view-transition-name`), and a bar chart places its
 * peak label over the peak bar (`--peak-at`, a number from 0 to 100). All are
 * plain numbers or identifiers the app built itself; nothing from the export
 * is written here.
 */

/** The extra spans one tile takes: at four columns, extra rows, at two columns. */
export interface TileSpans {
  c4: number;
  r4: number;
  c2: number;
}

/** The three custom properties the stylesheet reads. */
const SPAN_PROPERTIES = ['--span4', '--rows4', '--span2'] as const;

function write(node: HTMLElement, value: TileSpans): void {
  node.style.setProperty('--span4', String(Math.trunc(value.c4)));
  node.style.setProperty('--rows4', String(Math.trunc(value.r4)));
  node.style.setProperty('--span2', String(Math.trunc(value.c2)));
}

/**
 * A Svelte action: write a tile's fill spans as custom properties.
 *
 * `update` rewrites them when the fill rule is re-run (a pin or an unpin), and
 * `destroy` removes them so a recycled node carries nothing stale.
 */
export function spans(node: HTMLElement, value: TileSpans) {
  write(node, value);
  return {
    update(next: TileSpans): void {
      write(node, next);
    },
    destroy(): void {
      for (const property of SPAN_PROPERTIES) node.style.removeProperty(property);
    },
  };
}

/**
 * Name an element for the View Transitions API, or clear the name.
 *
 * A null name removes the property, which is how an element leaves the
 * transition once the change has been applied.
 */
export function setViewTransitionName(node: HTMLElement, name: string | null): void {
  if (name === null) {
    node.style.removeProperty('view-transition-name');
    return;
  }
  node.style.setProperty('view-transition-name', name);
}

/**
 * A Svelte action: place a chart's peak label over its peak bar.
 *
 * `percent` is the bar's centre as a share of the plot's width, 0 to 100. The
 * stylesheet turns it into `left: P%` and `translateX(-P%)`, so the label is
 * centred over the bar in the middle of the chart, flush left at the left edge
 * and flush right at the right edge, and its box always spans the bar's centre.
 * A value that is not a finite number is written as 0.
 */
export function peakAt(node: HTMLElement, percent: number) {
  const write = (value: number): void => {
    const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
    node.style.setProperty('--peak-at', String(Math.round(clamped * 100) / 100));
  };
  write(percent);
  return {
    update(next: number): void {
      write(next);
    },
    destroy(): void {
      node.style.removeProperty('--peak-at');
    },
  };
}
