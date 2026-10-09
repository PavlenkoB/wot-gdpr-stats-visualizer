<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { SectionCounts, SectionStatus } from './dashboard-status.ts';
  import type { GreyedSectionStatus } from '../ui-copy.ts';
  import { formatProvenanceFrom, formatSectionStatus } from '../ui-copy.ts';
  import ImportSummary from './ImportSummary.svelte';

  /**
   * The one section shell every category card and the "Not yet supported"
   * block render through (D-07).
   *
   * Two properties of this component are load-bearing and easy to break:
   *
   *   1. **The root element is never swapped.** It is one element whose
   *      `id` and `data-status` exist for every status, and only its INNER
   *      content branches. Tests and the pane's `aria-labelledby` hold
   *      references to these ids; a version that mounted a different element
   *      per status would leave them pointing at nodes that no longer exist.
   *
   *   2. **A greyed state is always in words.** Every greyed card renders a
   *      visible status line, and the greyed look adds a dashed border as a
   *      shape cue on top of the surface tint. A user who cannot see the
   *      tint can still read why the section is empty (D-10, DATA-04).
   */
  interface Props {
    /** Anchor id — also the `data-testid` suffix. */
    id: string;
    /** The heading text: the pane's title. */
    title: string;
    /**
     * The canonical folder name this section reads, for the provenance line and
     * the greyed sentences. Falls back to `title` for the one section that is
     * not a folder (the unsupported block).
     */
    folder?: string;
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

  let { id, title, folder, status, counts, note, statusText, children }: Props = $props();

  /** The name the provenance line and the greyed sentences use for this section. */
  const source = $derived(folder ?? title);

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
    statusText ?? (greyedStatus === null ? null : formatSectionStatus(greyedStatus, source)),
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
  <h2 id="{id}-heading" class="section-title">{title}</h2>

  {#if statusLine !== null}
    <p class="status" data-testid="section-status">{statusLine}</p>
  {/if}

  <!--
    The provenance line: where the numbers came from, in one 14px line under the
    title (`From Activity_history · 3 files, 287 rows`). It replaces the raw
    folder name that used to be the heading, and it carries the import counts
    that used to sit below the content, so `importLine` still resolves to exactly
    one element. An `empty` section shows only the skip tag after the "From"
    text, because "0 files" is already the status line's meaning.
  -->
  {#if counts !== null && (status === 'pending' || status === 'ready' || emptySkip)}
    <div class="provenance" data-testid="provenance">
      <span class="from">{formatProvenanceFrom(source)}</span>
      <ImportSummary
        {counts}
        variant={status === 'pending' ? 'summary' : 'caption'}
        showCounts={status !== 'empty'}
      />
    </div>
  {/if}

  {#if status === 'pending'}
    {#if note !== undefined}
      <p class="note">{note}</p>
    {/if}
  {:else if status === 'ready'}
    {@render children?.()}
  {/if}
</section>

<style>
  /*
    The section shell. The detail pane is the container now, so a populated
    section is flat: no border, no background and no padding of its own. Only the
    greyed family below keeps a panel. `min-width: 0` plus `overflow-wrap:
    anywhere` let an untrusted note wrap rather than widen the page.
  */
  section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  /* The Display role (26 / 600 / 1.3), collapsing to the 18px Heading role at
     phone width, where the phone block of `src/app.css` also hides it visually
     (the detail's top bar already shows the title). The title wraps instead of
     overflowing: it can be a long untrusted string. */
  .section-title {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The provenance line: one 14px/400 line that wraps on a phone. */
  .provenance {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 4px;
    min-width: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
  }

  .from {
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
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /*
    The greyed family: nothing loaded, not in this export, present but empty.
    Selected by the same `data-status` attribute the list rows read, so the panel
    and the row cannot disagree about why a section is greyed. The dashed border
    is a shape cue on top of the tint, and the text colour is a real colour
    rather than reduced opacity, which would fail contrast.
  */
  section[data-status='not-loaded'],
  section[data-status='no-export'],
  section[data-status='empty'] {
    padding: 20px;
    border: 1px dashed var(--faint);
    border-radius: 8px;
    background: var(--list);
  }

  section[data-status='not-loaded'] :is(.section-title, .status),
  section[data-status='no-export'] :is(.section-title, .status),
  section[data-status='empty'] :is(.section-title, .status) {
    color: var(--muted);
  }
</style>
