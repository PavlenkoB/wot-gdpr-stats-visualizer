<script lang="ts">
  import { heatColor } from './overview-heat.ts';

  /**
   * Named rows with a bar: the top five tanks and the class split (13-09,
   * D-09, D-13).
   *
   * ## Layout
   *
   * The block is ONE three-column grid: the name (which wraps and never
   * collapses below 72px), a bar column that takes a third of the width
   * between 60 and 152px, and the figure sized to its widest text. Each row is
   * a SUBGRID of it, so every row uses the same three tracks: every bar starts
   * at the same x and every figure ends at the same x. A grid per row sized
   * the figure column to its own text, so a wider figure ("1,240") pushed its
   * bar left of a narrower one's ("717") and the bars read as unaligned. A row
   * is at least 28px tall whatever the data is, so the chart's height depends
   * on the row COUNT only, never on the export.
   *
   * ## The Unknown class
   *
   * A row with `bar` false is a text row with an EMPTY bar cell. A tank missing
   * from the built-in table is counted as unknown and not guessed (D-09), and a
   * bar for it would draw a class the data never measured.
   *
   * ## Colour
   *
   * A bar's fill is the heat scale at `value / max`, where the maximum is taken
   * over the rows that draw a bar. Bars sit on white with no track behind them.
   * The whole block is `aria-hidden`: the tile's hidden summary carries the
   * same names and figures.
   */
  interface Props {
    rows: { name: string; sub: string | null; value: number; text: string; bar: boolean }[];
  }

  let { rows }: Props = $props();

  /** The viewBox width: a bar's width is its share of this. */
  const FULL = 100;

  /** The largest value among the rows that draw a bar. */
  const max = $derived(
    rows.reduce((best, row) => (row.bar && row.value > best ? row.value : best), 0),
  );

  const drawn = $derived(
    rows.map((row) => {
      const t = max > 0 ? Math.min(Math.max(row.value / max, 0), 1) : 0;
      return {
        ...row,
        width: row.value > 0 && max > 0 ? Math.max(2, t * FULL) : 0,
        fill: heatColor(t),
      };
    }),
  );
</script>

<span class="rows" aria-hidden="true">
  {#each drawn as row, index (index)}
    <span class="row">
      <span class="t-body name">
        {row.name}
        {#if row.sub !== null}<span class="t-caption sub">{row.sub}</span>{/if}
      </span>
      <span class="cell">
        {#if row.bar}
          <svg
            class="bar"
            width="100%"
            height="12"
            viewBox="0 0 {FULL} 12"
            preserveAspectRatio="none"
            focusable="false"
          >
            <rect class="fill" x="0" y="0" width={row.width} height="12" fill={row.fill} />
          </svg>
        {/if}
      </span>
      <span class="t-body num">{row.text}</span>
    </span>
  {/each}
</span>

<style>
  .rows {
    display: grid;
    grid-template-columns: minmax(72px, 1fr) clamp(60px, 30%, 152px) auto;
    column-gap: var(--space-8);
    min-width: 0;
    margin-top: var(--space-8);
  }

  .row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    min-height: 28px;
    min-width: 0;
  }

  .name {
    display: block;
    min-width: 0;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .sub {
    display: block;
    color: var(--muted);
  }

  .cell {
    display: block;
    min-width: 0;
  }

  .bar {
    display: block;
    width: 100%;
  }

  .num {
    display: block;
    color: var(--text);
    text-align: right;
  }

  @media (forced-colors: active) {
    .fill {
      fill: CanvasText;
    }
  }
</style>
