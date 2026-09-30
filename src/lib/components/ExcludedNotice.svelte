<script lang="ts">
  import { PLAYTIME_EXCLUDED_EXPLANATION, formatExcludedPill } from '../ui-copy.ts';

  /**
   * The excluded-row notice (D-02).
   *
   * Two rules, both of which are why this is a component and not a paragraph:
   *
   *   1. **Never "0 rows excluded".** `formatExcludedPill` returns the empty
   *      string for zero, and this component renders nothing for it. A user who
   *      has excluded nothing should not be told they excluded nothing, and the
   *      check cannot be forgotten by a caller because there is no way to ask
   *      for a zero pill.
   *   2. **The pill carries its own words.** "3 rows" and "1 row excluded" are
   *      not the same claim, and they are separated by the tag rather than
   *      folded into one sentence — the same decision the Phase 3 skip tag made
   *      for parse-level skipped rows. Amber, not red: an excluded row is a fact
   *      about the export's own formatting, not a failure of the import.
   *
   * It renders in two places — under a ready slice, and under the
   * `no-usable-sessions` message — because "every row was excluded" and "some
   * rows were excluded" are the same fact at different magnitudes.
   */
  interface Props {
    /** Rows that carried no usable start and end pair, for the slice on screen. */
    count: number;
  }

  let { count }: Props = $props();

  /** Empty for zero, which is the whole of the "render nothing" rule. */
  const pill = $derived(formatExcludedPill(count));
</script>

{#if pill !== ''}
  <p data-testid="playtime-excluded">
    <span class="pill">{pill}</span>
    <span class="explanation">{PLAYTIME_EXCLUDED_EXPLANATION}</span>
  </p>
{/if}

<style>
  p {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    margin: 0;
    padding: 4px 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The Phase 3 skip tag's chrome, value for value: a pill that carries both
     its border and its words, so the information never depends on the colour. */
  .pill {
    display: inline-block;
    padding: 0 8px;
    border: 1px solid #f9ab00;
    border-radius: 999px;
    background: #fef7e0;
    color: #8a5a00;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }

  /* Caption role: the reason, in muted metadata weight rather than as another
     assertion in the Label weight the pill uses. */
  .explanation {
    min-width: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
  }
</style>
