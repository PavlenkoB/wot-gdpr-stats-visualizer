<script lang="ts">
  import { LEGEND_LESS, LEGEND_MORE } from '../ui-copy.ts';

  /**
   * The Less-to-More legend both heatmaps share (04-UI-SPEC Color, "Legend").
   *
   * One row: the word "Less", one swatch per level, the word "More", then the
   * boundary note on its own full-width line under that row. The swatches are
   * `aria-hidden` because they carry nothing a screen reader needs — the two
   * words either side of them are what a reader hears for the scale, the note
   * states the darkest boundary as text, and every cell already carries its
   * exact value in its accessible name. Shading is therefore never the only
   * carrier of a value, which is why the swatches can stay hidden.
   *
   * ## Why the swatches need no relief rule any more
   *
   * The heat scale (D-11) is five DATA steps plus one NEUTRAL empty swatch.
   * Each of the five data steps clears 3:1 on white, so a level is legible as
   * a mark on its own; only the empty swatch is below that floor, and it means
   * "no data" rather than "a little". The old ramp needed a relief rule
   * because its low steps sat below 3:1 by design; this scale does not, so
   * the legend says what the scale is and the colours carry their own
   * contrast.
   *
   * ## Why all six levels are declared for the levels actually in use
   *
   * `levels` is sparse by design (`legendModel`): a slice with one shade in
   * use prints two swatches, not six, and two values can leave a genuine gap.
   * But the CLASS vocabulary is the full six-swatch scale, declared once here
   * and read from `var(--heat-empty)` and `var(--heat-1)` to `var(--heat-5)`
   * exactly as `HourGrid` reads it — a scale is a sequence, and a class that
   * exists only for the data in front of us is a class that silently stops
   * existing the moment the selector changes.
   */
  interface Props {
    /** Level 0 plus the levels in use, ascending (`legendModel`). */
    levels: readonly number[];
    /** The boundary note, or the rank sentence when no level is at the top. */
    note: string;
    /** The `data-testid` the owner gives this legend (`hour-legend`). */
    testId: string;
  }

  let { levels, note, testId }: Props = $props();
</script>

<div class="legend" data-testid={testId}>
  <p class="row">
    <span class="word">{LEGEND_LESS}</span>
    {#each levels as level (level)}
      <span class="swatch level-{level}" aria-hidden="true"></span>
    {/each}
    <span class="word">{LEGEND_MORE}</span>
    <!--
      Real text inside the row, not a tooltip and not a title. The note is its
      own line BY RULE (a full-width basis), not by luck: the weekday-by-hour
      legend's shorter sentence used to run on from "More" on one line at
      1280px, and the calendar's longer one was on its own line only because it
      did not fit beside More. Both now start below the swatch row, and a
      legend that scrolls horizontally to be read is still not a legend.
    -->
    <span class="note">{note}</span>
  </p>
</div>

<style>
  .legend {
    min-width: 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    /* The row value is the 8px `sm` step between the swatch row and the note
       below it (04-UI-SPEC Spacing, the `sm` row); the column value is the 4px
       the words and the swatches keep between themselves. */
    gap: var(--space-8) var(--space-4);
    margin: 0;
    min-width: 0;
    /* Caption role (14px / 400 / 1.4, var(--muted)) for the words, the swatches
       and the note alike — the whole legend is explanatory text. */
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-tight);
    color: var(--muted);
  }

  /* A swatch, not a border: the mark is the fill, and it is the ONLY thing
     that tells a reader which step of the scale a cell uses. */
  .swatch {
    width: 12px;
    height: 12px;
    flex: none;
  }

  .level-0 {
    background: var(--heat-empty);
  }
  .level-1 {
    background: var(--heat-1);
  }
  .level-2 {
    background: var(--heat-2);
  }
  .level-3 {
    background: var(--heat-3);
  }
  .level-4 {
    background: var(--heat-4);
  }
  .level-5 {
    background: var(--heat-5);
  }

  /* The boundary sentence wraps within itself rather than widening the card:
     it embeds a formatted hours value and the note can be long. It also always
     starts its own line: a full-width basis is what makes the note a separate
     sentence in both heatmaps instead of one that runs on from "More" whenever
     it happens to fit beside it. */
  .note {
    min-width: 0;
    flex-basis: 100%;
    overflow-wrap: anywhere;
  }
</style>
