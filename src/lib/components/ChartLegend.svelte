<script lang="ts">
  import { LEGEND_LESS, LEGEND_MORE } from '../ui-copy.ts';

  /**
   * The Less-to-More legend both heatmaps share (04-UI-SPEC Color, "Legend").
   *
   * One row: the word "Less", one swatch per level, the word "More", then the
   * boundary note. The swatches are `aria-hidden` because they carry nothing a
   * screen reader needs — the two words either side of them are what a reader
   * hears for the scale, the note states the darkest boundary as text, and
   * every cell already carries its exact value in its accessible name. That is
   * also the dataviz relief rule: the ramp's low steps sit below 3:1 on white
   * by design, and they are covered by text three times over.
   *
   * ## Why all six levels are declared for the levels actually in use
   *
   * `levels` is sparse by design (`legendModel`): a slice with one shade in
   * use prints two swatches, not six, and two values can leave a genuine gap.
   * But the CLASS vocabulary is the full six-step ramp, declared once here and
   * read from `var(--ramp-N)` exactly as `HourGrid` reads it — a ramp is a
   * sequence, and a class that exists only for the data in front of us is a
   * class that silently stops existing the moment the selector changes.
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
      Real text inside the wrapping row, not a tooltip and not a title. The row
      wraps because at 375px "Less [swatches] More Shades rank the busiest
      hours of the week. Darkest: more than 42.5 hours." does not fit on one
      line, and a legend that scrolls horizontally to be read is not a legend.
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
    gap: 4px;
    margin: 0;
    min-width: 0;
    /* Caption role (14px / 400 / 1.4, #5f6368) for the words, the swatches
       and the note alike — the whole legend is explanatory text. */
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
  }

  /* A swatch, not a border: the mark is the fill, and it is the ONLY thing
     that tells a reader which step of the ramp a cell uses. */
  .swatch {
    width: 12px;
    height: 12px;
    flex: none;
  }

  .level-0 {
    background: var(--ramp-0);
  }
  .level-1 {
    background: var(--ramp-1);
  }
  .level-2 {
    background: var(--ramp-2);
  }
  .level-3 {
    background: var(--ramp-3);
  }
  .level-4 {
    background: var(--ramp-4);
  }
  .level-5 {
    background: var(--ramp-5);
  }

  /* The boundary sentence wraps within itself rather than widening the card:
     it embeds a formatted hours value and the note can be long. */
  .note {
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
