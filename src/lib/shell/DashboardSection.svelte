<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { SectionCounts, SectionStatus } from './dashboard-status.ts';
  import type { GreyedSectionStatus } from '../ui-copy.ts';
  import { formatSectionStatus } from '../ui-copy.ts';
  import ImportSummary from './ImportSummary.svelte';

  /**
   * The one section shell every category card and the "Not yet supported"
   * block render through (D-07).
   *
   * Two properties of this component are load-bearing and easy to break:
   *
   *   1. **The root element is never swapped.** It is one element whose
   *      `id` and `data-status` exist for every status, and only its INNER
   *      content branches. The sticky nav's scroll spy and the in-page
   *      anchor links both hold references to these elements; a version that
   *      mounted a different element per status would leave the spy
   *      observing nodes that no longer exist.
   *
   *   2. **A greyed state is always in words.** Every greyed card renders a
   *      visible status line, and the greyed look adds a dashed border as a
   *      shape cue on top of the surface tint. A user who cannot see the
   *      tint can still read why the section is empty (D-10, DATA-04).
   */
  interface Props {
    /** Anchor id — also the `data-testid` suffix. */
    id: string;
    /** The heading text, written exactly as the export spells the folder. */
    title: string;
    status: SectionStatus;
    /** Summed counts, or `null` when the category is not in the export. */
    counts: SectionCounts | null;
    /** The line under a populated section's summary. */
    note?: string;
    /**
     * Overrides the default status wording. Used by the unsupported block,
     * whose "none detected" sentence is about the archive rather than about
     * a single category.
     */
    statusText?: string;
    /** The `ready` body. Phases 4 to 6 supply it; until then it is absent. */
    children?: Snippet;
  }

  let { id, title, status, counts, note, statusText, children }: Props = $props();

  /** The three statuses that render a status line, narrowed for the formatter. */
  const greyedStatus = $derived<GreyedSectionStatus | null>(
    status === 'not-loaded' || status === 'no-export' || status === 'empty' ? status : null,
  );

  /**
   * The status line's text, or `null` when this status has none.
   *
   * Computed here rather than in the markup so the formatter's narrow
   * `GreyedSectionStatus` parameter is satisfied by construction: a
   * `pending` or `ready` status cannot be passed to it by mistake.
   */
  const statusLine = $derived(
    statusText ?? (greyedStatus === null ? null : formatSectionStatus(greyedStatus, title)),
  );

  /**
   * A category that IS in the export but parsed no rows still has a
   * diagnostic worth showing, so its skip tag rides under the status line
   * (RESEARCH Open Question 2). The counts text is suppressed: "0 files" is
   * already the status line's meaning.
   */
  const emptySkip = $derived(status === 'empty' && counts !== null && counts.skippedRowCount > 0);
</script>

<section
  {id}
  aria-labelledby="{id}-heading"
  data-testid="dashboard-section-{id}"
  data-status={status}
>
  <h2 id="{id}-heading">{title}</h2>

  {#if statusLine !== null}
    <p class="status" data-testid="section-status">{statusLine}</p>
  {/if}

  {#if emptySkip && counts !== null}
    <ImportSummary {counts} variant="caption" showCounts={false} />
  {/if}

  {#if status === 'pending'}
    {#if counts !== null}
      <ImportSummary {counts} variant="summary" />
    {/if}
    {#if note !== undefined}
      <p class="note">{note}</p>
    {/if}
  {:else if status === 'ready'}
    {@render children?.()}
    <!-- D-09: the import diagnostics follow the dashboard content, so a
         built dashboard never hides how much was actually imported. -->
    {#if counts !== null}
      <ImportSummary {counts} variant="caption" />
    {/if}
  {/if}
</section>

<style>
  /*
    The card. `scroll-margin-top` keeps an in-page anchor from tucking the
    heading under the sticky nav, which the nav's own height budget sets
    through the one custom property in app.css (03-05 reads the same value
    for its observer band). `min-width: 0` plus `overflow-wrap: anywhere`
    let an untrusted heading or note wrap rather than widen the page.
  */
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #fff;
    scroll-margin-top: var(--nav-offset);
    min-width: 0;
  }

  /* Heading role, matching the global rule so the page title and every card
     title read as one family. */
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .status {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .note {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #3c4043;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /*
    The greyed family: nothing loaded, not in this export, present but empty.
    Selected by the same `data-status` attribute the nav reads, so the card
    and the nav link cannot disagree about why a section is greyed. The
    dashed border is a shape cue on top of the tint, and the text colour is
    a real colour rather than reduced opacity, which would fail contrast.
  */
  section[data-status='not-loaded'],
  section[data-status='no-export'],
  section[data-status='empty'] {
    border: 1px dashed #80868b;
    background: #f7f7fa;
  }

  section[data-status='not-loaded'] :is(h2, .status),
  section[data-status='no-export'] :is(h2, .status),
  section[data-status='empty'] :is(h2, .status) {
    color: #5f6368;
  }
</style>
