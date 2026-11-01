<script lang="ts">
  import type { SectionCounts } from './dashboard-status.ts';
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

  /**
   * The class the line wears. The variant is a name in the prop contract and
   * the source of the test id; the class is a style hook. `caption` is the
   * shared muted note and `banner` adds the Strong Note role (`.t-note-strong`)
   * to its hook class; both differ from the variant name, so the two are mapped
   * here and not left to coincide.
   */
  const VARIANT_CLASS = {
    summary: 'summary',
    caption: 'muted-note',
    banner: 'banner t-note-strong',
  } as const;
  const variantClass = $derived(VARIANT_CLASS[variant]);
</script>

<p class={variantClass} data-testid={testId}>
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
    <span class="skip-tag t-note-strong" data-testid="skip-tag"
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
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    color: var(--text);
  }

  /* The `caption` variant has no local rule any more: it wears the
     shared `.muted-note` of src/styles/utilities.css, which states exactly
     the same muted 14px/400/1.4 note, and the `p` element rule above already
     supplies the margin, the minimum width and the wrap. The dynamic class value therefore resolves
     to the shared block with an unchanged computed style. */

  /* Strong Note role (`.t-note-strong`, from the variant map): metadata, not
     the thing the card is about. The role owns the type; this rule keeps the
     colour. */
  .banner {
    color: var(--text);
  }

  /*
    A pill that rides along inline with the counts. It carries its border
    AND its words, so the information does not depend on the colour. The
    amber is the shared warn palette (--warn-line, --warn-bg, --warn-ink).
  */
  .skip-tag {
    display: inline-block;
    margin-left: var(--space-4);
    padding: 0 var(--space-8);
    border: 1px solid var(--warn-line);
    border-radius: 999px;
    background: var(--warn-bg);
    color: var(--warn-ink);
  }
</style>
