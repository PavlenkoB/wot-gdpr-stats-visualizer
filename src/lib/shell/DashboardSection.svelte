<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { SectionCounts, SectionStatus } from './dashboard-status.ts';
  import type { GreyedSectionStatus } from '../ui-copy.ts';
  import { formatCombinedCaption, formatProvenanceFrom, formatSectionStatus } from '../ui-copy.ts';
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
   *
   * ## The combined caption (D-11)
   *
   *   `accountCount` defaults to one, which renders NO caption node at all —
   *   not an empty one and not a hidden one. The caption appears only when the
   *   dataset holds two or more accounts, because a pane whose numbers merge
   *   every account's rows must say so rather than presenting a combined figure
   *   as if one account produced it (UI-SPEC Surface 2).
   *
   *   Two consequences worth stating, both structural rather than remembered:
   *
   *     - **No provenance block, no caption.** The caption is the FIRST child
   *       of that block, so a `muted` or loading pane — which shows no
   *       provenance at all — shows no caption either. There is nothing on
   *       screen for it to qualify.
   *
   *     - **The Account section never carries it**, because `Dashboard.svelte`
   *       passes a count of one for `user-info`: that pane IS the list of
   *       accounts, so "3 accounts combined" there would say nothing the header
   *       above it has not already said.
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
    /**
     * What the provenance line names when the pane reads no single folder (HEAT,
     * Warships crews & storage): their files are spread across the export, so
     * the pane names its source here instead of faking a folder. Wins over
     * `folder` and `title`; absent for every other pane, whose text is unchanged.
     */
    provenanceLabel?: string;
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
    /**
     * How many accounts the dataset holds. One — the default, and therefore
     * every pre-Phase-9 caller — renders no combined caption (D-11).
     */
    accountCount?: number;
    /** The `ready` body. Phases 4 to 6 supply it; until then it is absent. */
    children?: Snippet;
  }

  let {
    id,
    title,
    folder,
    provenanceLabel,
    status,
    counts,
    note,
    statusText,
    accountCount = 1,
    children,
  }: Props = $props();

  /** The name the provenance line and the greyed sentences use for this section. */
  const source = $derived(provenanceLabel ?? folder ?? title);

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

  /**
   * The "{N} accounts combined" line, or `null` for one account.
   *
   * Derived rather than tested twice in the template, so the "two or more"
   * threshold exists in exactly one place — the same reason `statusLine` is
   * computed here instead of inline.
   */
  const combinedCaption = $derived(accountCount >= 2 ? formatCombinedCaption(accountCount) : null);
</script>

<section
  {id}
  aria-labelledby="{id}-heading"
  data-testid="dashboard-section-{id}"
  data-status={status}
>
  <h2 id="{id}-heading" class="t-title section-title">{title}</h2>

  {#if statusLine !== null}
    <p class="status t-note-strong" data-testid="section-status">{statusLine}</p>
  {/if}

  <!--
    The provenance line: where the numbers came from, in one 14px line under the
    title (`From Activity_history · 3 files, 287 rows`). It replaces the raw
    folder name that used to be the heading, and it carries the import counts
    that used to sit below the content, so `importLine` still resolves to exactly
    one element. An `empty` section shows only the skip tag after the "From"
    text, because "0 files" is already the status line's meaning.

    D-11's combined caption is inside this block and is its FIRST child on
    purpose: the caption is a statement about the pane's numbers, so it belongs
    ABOVE the source line rather than after a "From …" that would read as if it
    were about that line. `flex-basis: 100%` gives it its own line, and the
    source line and import counts follow on the next one. It is static text and
    NOT a live region: the import notice slot already announces the change.

    The `{#if}` and its `<p>` sit flush against the `<div>` and the "From" span
    with NO whitespace between them, which is deliberate and load-bearing. A
    newline there would put a whitespace TEXT NODE between the div and its first
    element, so a one-account dataset's provenance would begin with a space —
    which the `toHaveText(/^From …/)` in `master-detail-nav.spec.ts` rightly
    fails. A conditional element cannot avoid that whitespace; only the
    conditional TAG being adjacent to its neighbours can.
  -->
  {#if counts !== null && (status === 'pending' || status === 'ready' || emptySkip)}
    <div class="provenance t-note" data-testid="provenance">
      {#if combinedCaption !== null}<p
          class="combined t-note-strong"
          data-testid="combined-caption"
        >
          {combinedCaption}
        </p>{/if}<span class="from">{formatProvenanceFrom(source)}</span>
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
    gap: var(--space-12);
    min-width: 0;
  }

  /* The Title role (D-12): 32px from 900px up, 26px below. The role owns the
     size, the weight, the line height and the wrapping, so this rule states
     only what a role may not: the margin, the colour and the shrink. At
     phone width the phone block of `src/styles/shell.css` hides the title visually
     (the detail's top bar already shows it), so the rule stays top-level and
     carries no scope class of its own: a nested rule would raise its
     specificity above the phone block's. */
  .section-title {
    margin: 0;
    color: var(--ink);
    min-width: 0;
  }

  /* The provenance line: one line in the Note role (14 / 400 / 1.4) that wraps
     on a phone. The role is the class on the element; this rule keeps the layout
     and the colour.

     The 4px ROW gap is why: D-11's combined caption takes `flex-basis: 100%`,
     so it becomes its own flex line, and with a zero row gap the 600-weight
     caption sat exactly one line-height from the 400-weight line it
     introduces. This is the only block in the phase where two lines of
     different weight sit adjacent, so it is also the only place the 4px
     block rhythm had to be added by hand. The 4px COLUMN gap is unchanged:
     it is what makes the inline "From … · N files" run read as one line, and
     widening or removing it would change that run, which is not the fix. */
  .provenance {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--space-4);
    row-gap: var(--space-4);
    min-width: 0;
    color: var(--muted);
  }

  .from {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /*
    The combined caption: the Strong Note role (`.t-note-strong`, 14 / 600 /
    1.4) in `--muted`, which is the measured text colour that already passes
    4.5:1 on both surfaces. The role owns the type; this rule keeps the layout
    and the colour. No new colour, no media query, no transition, no
    `aria-live` — the role is the one the single-account header labels already
    use, so the line reads as part of the provenance block rather than as an
    alert.
  */
  .combined {
    flex-basis: 100%;
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--muted);
  }

  .status {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .note {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
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
    padding: var(--layout-gutter);
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
