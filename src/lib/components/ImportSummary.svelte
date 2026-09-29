<script lang="ts">
  import type { SectionCounts } from '../dashboard-status.ts';
  import { formatImportSummary, formatSkippedRowCount } from '../ui-copy.ts';

  /**
   * The import diagnostics line: "N files, M rows", optionally followed by a
   * skip tag (D-09).
   *
   * One component in three roles, because a section's summary, a `ready`
   * section's caption and an unsupported banner's counts line are the same
   * sentence at different emphasis — and three copies of one sentence is how
   * a section ends up saying "3 files" where a banner says "3 file".
   */
  interface Props {
    /** Summed import counts for whatever this line describes. */
    counts: SectionCounts;
    /**
     * `summary` — a `pending` section's body (Body role).
     * `caption` — muted metadata under `ready` content, and the standalone
     *   skip tag of an `empty` section.
     * `banner` — the counts line of an unsupported banner (Label role).
     */
    variant: 'summary' | 'caption' | 'banner';
    /**
     * Render the counts text. `false` renders only the skip tag, for the one
     * case where the counts were already stated (or would be a boastful
     * "0 files" about a category that parsed nothing).
     */
    showCounts?: boolean;
  }

  let { counts, variant, showCounts = true }: Props = $props();

  /** D-04: the tag exists only when rows were actually skipped. */
  const hasSkipped = $derived(counts.skippedRowCount > 0);

  /**
   * The root test id is the contract every e2e spec reads, and each variant
   * names a different thing: a section's body, a muted caption, a banner's
   * counts. Derived here so a variant can never render under another's name.
   */
  const testId = $derived(
    variant === 'summary'
      ? 'section-summary'
      : variant === 'caption'
        ? 'section-caption'
        : 'banner-counts',
  );
</script>

<p class={variant} data-testid={testId}>
  {#if showCounts}
    <span class="counts">{formatImportSummary(counts.fileCount, counts.rowCount)}</span>
  {/if}
  {#if hasSkipped}
    <!--
      The skipped-row count. Rendered as a tag, not folded into the counts
      sentence, so "3 rows" and "1 row skipped" are never mistaken for one
      number. Amber, not red: a skipped row is a parse diagnostic about the
      export's own formatting, not a failure of the user's data.
    -->
    <span class="skip-tag" data-testid="skip-tag"
      >{formatSkippedRowCount(counts.skippedRowCount)}</span
    >
  {/if}
</p>

<style>
  p {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Body role: this line is the section's primary content. */
  .summary {
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #08060d;
  }

  /* Label role, muted: metadata, not the thing the card is about. */
  .caption {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  .banner {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #3c4043;
  }

  /*
    A pill that rides along inline with the counts. It carries its border
    AND its words, so the information does not depend on the colour.
  */
  .skip-tag {
    display: inline-block;
    margin-left: 4px;
    padding: 0 8px;
    border: 1px solid #f9ab00;
    border-radius: 999px;
    background: #fef7e0;
    color: #8a5a00;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }
</style>
