<script lang="ts">
  import { PLAYTIME_EXCLUDED_EXPLANATION, formatExcludedPill } from '../ui-copy.ts';

  /**
   * The excluded-row notice (D-02), shared by every block that drops rows.
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
   *
   * ## Generalised in 05-10, without changing what it renders
   *
   * Phase 5 gives the premium, currency and spend blocks the same notice with
   * their own nouns: "7 premium rows excluded", "4 operation rows excluded",
   * "3 paid orders excluded". Four blocks that each name their own dropped rows
   * are four copies of the same amber pill, and a copy is a chrome that drifts
   * — the fourth one would end up a different radius or a different muted grey.
   *
   * So `pill`, `explanation` and `testId` became optional props, and the three
   * defaults are the Phase 4 values. That is the whole change: the two existing
   * callers pass `count` alone and are byte-for-byte unchanged, which is what
   * keeps the generalisation from being a rewrite of a shipped component.
   *
   * The alternative — a `noun` prop and a suffix built here — was rejected
   * because the three phrases are not one phrase with a different noun. Each
   * block's pill sentence is copy the Phase 5 inventory already owns and tests
   * (`formatPremiumExcludedPill` and its two siblings), and a component that
   * assembled them would be a second place for that wording to live.
   */
  interface Props {
    /** Rows that carried no usable start and end pair, for the slice on screen. */
    count: number;
    /**
     * The pill's own words, resolved by the caller. `undefined` falls back to
     * the Phase 4 playtime pill for `count`.
     */
    pill?: string;
    /** Why the rows were dropped. Defaults to the Phase 4 playtime wording. */
    explanation?: string;
    /** The `data-testid` on the notice. Defaults to `playtime-excluded`. */
    testId?: string;
  }

  let { count, pill, explanation, testId }: Props = $props();

  /**
   * The three resolved values, and the zero rule in one place.
   *
   * The `{#if}` below tests `pillText` — the RESOLVED pill — rather than
   * `count`. That is what keeps a caller honest: a block that passes
   * `formatXExcludedPill(0)` gets `''` and the notice disappears, so the zero
   * case is unrepresentable from outside instead of being a rule each caller
   * has to remember.
   */
  const pillText = $derived(pill ?? formatExcludedPill(count));
  const explanationText = $derived(explanation ?? PLAYTIME_EXCLUDED_EXPLANATION);
  const noticeTestId = $derived(testId ?? 'playtime-excluded');
</script>

{#if pillText !== ''}
  <p data-testid={noticeTestId}>
    <span class="pill">{pillText}</span>
    <span class="explanation">{explanationText}</span>
  </p>
{/if}

<style>
  p {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-4) var(--space-8);
    margin: 0;
    padding: var(--space-4) 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The Phase 3 skip tag's chrome, value for value: a pill that carries both
     its border and its words, so the information never depends on the colour.
     The amber is the shared warn palette (--warn-line, --warn-bg,
     --warn-ink), not a literal in this file. */
  .pill {
    display: inline-block;
    padding: 0 var(--space-8);
    border: 1px solid var(--warn-line);
    border-radius: 999px;
    background: var(--warn-bg);
    color: var(--warn-ink);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Caption role: the reason, in muted metadata weight rather than as another
     assertion in the Label weight the pill uses. */
  .explanation {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-tight);
    color: var(--muted);
  }
</style>
