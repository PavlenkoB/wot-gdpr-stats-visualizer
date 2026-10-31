<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import AboutDisclosure from '../../charts/AboutDisclosure.svelte';
  import {
    acceptDataOutcome,
    deriveFinanceState,
    type ShownBlock,
  } from '../finance/finance-state.ts';
  import { accountTagsFor } from '../../shell/identity-model.ts';
  import {
    ABOUT_NAME_TIMELINE,
    MASK_ANNOUNCE_MASKED,
    MASK_ANNOUNCE_SHOWN,
    MASK_CAPTION_MASKED,
    MASK_CAPTION_REVEALED,
    MASK_TOGGLE_HIDE,
    MASK_TOGGLE_SHOW,
    NEW_DATA_FILE_LABELS,
    TIMELINE_ABOUT,
    TIMELINE_ERROR,
    TIMELINE_INTRO,
    TIMELINE_LOADING,
    formatDeviceNoRows,
    formatMergeNote,
    formatNewDataSkipped,
    formatTimelineShowing,
  } from '../../ui-copy.ts';
  import { TIMELINE_FILE_KEYS } from '../new-data/new-data-shared.ts';
  import type { TimelineKind, TimelineView } from './timeline-shared.ts';
  import {
    fileStateLines,
    filterEntries,
    hasMaskableEntries,
    isWholePaneEmpty,
    kindsPresent,
    resolveKindFilter,
    showKindFilter,
    type KindChoice,
  } from './timeline-state.ts';
  import TimelineKindFilter from './TimelineKindFilter.svelte';
  import TimelineTable from './TimelineTable.svelte';

  /**
   * The Account timeline pane body (plan 12-12, TIMELINE-01, TIMELINE-02, D-05,
   * D-06, D-07, D-14, D-15): an intro, the merge note, one info line per skipped
   * or header-only file, the IP mask control, the About disclosure, the kind chip
   * row, the showing line and the one windowed table.
   *
   * It is the Perks pane's twin. It asks ONE channel, `account-timeline`, through
   * the channel-scoped client and derives its state with the same pure functions
   * the finance blocks use, so the pane cannot show a previous export's history
   * under a new export's heading: the applied answer is stamped with the dataset
   * it answers for and a replace lands as "no answer for what is on screen",
   * which is `loading` by construction.
   *
   * ## The addresses
   *
   * Bans and third parties may carry an address. It is masked by default and only
   * through the shell's ONE reveal: the pane takes `revealed` and
   * `onRevealChange` from the shell and holds no reveal state of its own. The
   * toggle renders only when a rendered entry holds an address part
   * (`hasMaskableEntries`). A value reaches the page only through
   * `formatNewDataCell` inside the table, as text: no title, aria-label, test id
   * or data attribute carries one (T-12-38, T-12-39).
   *
   * ## The kind choice
   *
   * Pane-local component state, stamped with the dataset it was made under. The
   * effective kind is a pure READ (`resolveKindFilter`), so a new dataset returns
   * to All entries without this pane writing anything, and the choice is written
   * to no route, storage or URL. A chip change issues no worker query: the filter
   * runs over the in-memory entries (T-12-40).
   *
   * ## The one live region
   *
   * The showing line is the pane's ONLY explicit `aria-live`. It carries the
   * loading sentence while the model builds and the showing sentence after, with
   * the mask announcement (state words, never a value) as a visually hidden span
   * inside it. It sits outside every `{#if}` that changes with the state, so it is
   * one persistent element rather than one re-inserted per state. The error is a
   * fixed sentence, never the worker's detail.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam: the only way this pane asks. */
    client: QueryClient;
    /** Whether addresses are shown in full: the shell's ONE reveal. */
    revealed: boolean;
    /** Ask the shell to reveal or re-mask, stamped with the current dataset. */
    onRevealChange: (revealed: boolean) => void;
  }

  let { result, client, revealed, onRevealChange }: Props = $props();

  const importedAt = $derived(result?.importedAt ?? null);

  /** The applied answer and the dataset it answers for, in ONE cell. */
  let shown = $state.raw<ShownBlock<TimelineView> | null>(null);

  /** What the live region says about the LAST thing the reader did, or nothing. */
  let announcement = $state('');

  /** The reader's kind choice, stamped with the dataset it was made under. */
  let choice = $state<KindChoice>({ kind: null, stamp: null });

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'account-timeline' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'account-timeline', wanted, importedAt);
    if (accepted !== null) shown = accepted;
  }

  $effect(() => {
    const wanted = importedAt;
    untrack(() => {
      // An announcement about the previous export's mask is a claim about a
      // dataset this pane has moved past, so it goes with the dataset.
      announcement = '';
      if (wanted === null) return;
      void load(wanted);
    });
  });

  const blockState = $derived(deriveFinanceState({ importedAt, shown }));

  const view = $derived<TimelineView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  /** The account tags, or `null` for a single-account dataset. */
  const tags = $derived(accountTagsFor(result));

  const entries = $derived(view === null ? [] : view.entries);

  /** The kinds that have an entry, in the fixed chip order. */
  const present = $derived(kindsPresent(entries));

  /** The kind that applies to THIS dataset; a pure read, never a write. */
  const kind = $derived(resolveKindFilter(choice, importedAt, present));

  const filtered = $derived(filterEntries(entries, kind));

  const wholePaneEmpty = $derived(view !== null && isWholePaneEmpty(view.files));

  const stateLines = $derived(view === null ? [] : fileStateLines(view.files));

  /** The merge note count, or zero: a note needs rows removed AND two or more accounts. */
  const mergedAway = $derived(view !== null && tags !== null ? view.mergedAway : 0);

  /** Whether anything the mask governs is on screen. */
  const canReveal = $derived(view !== null && !wholePaneEmpty && hasMaskableEntries(entries));

  /** The showing line: the loading sentence, then the showing sentence; empty when idle. */
  const showingText = $derived(
    blockState === 'loading'
      ? TIMELINE_LOADING
      : view !== null && !wholePaneEmpty
        ? formatTimelineShowing(filtered.length, entries.length)
        : '',
  );

  /** The canonical label of one file, never a zip entry name. */
  function fileLabel(file: keyof typeof TIMELINE_FILE_KEYS): string {
    const key = TIMELINE_FILE_KEYS[file];
    return key === null ? '' : (NEW_DATA_FILE_LABELS[key] ?? key);
  }

  function onKindChange(next: TimelineKind | null): void {
    choice = { kind: next, stamp: importedAt };
  }

  /** The one control; the announcement is read from the NEXT value. */
  function onToggle(): void {
    const next = !revealed;
    onRevealChange(next);
    announcement = next ? MASK_ANNOUNCE_SHOWN : MASK_ANNOUNCE_MASKED;
  }
</script>

<div
  class="block"
  data-testid="account-timeline-block"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  {#if blockState === 'error'}
    <!-- The FIXED sentence, never the worker's detail. `role="alert"` only. -->
    <p class="body error" role="alert">{TIMELINE_ERROR}</p>
  {:else if view !== null}
    <p class="caption">{TIMELINE_INTRO}</p>

    {#if mergedAway > 0}
      <p class="caption" data-testid="timeline-merge-note">{formatMergeNote(mergedAway)}</p>
    {/if}

    <!--
      One info line per file that is skipped or header-only (D-03). The label is
      the canonical constant, never a zip entry name; an absent file has no line.
      Keyed by position: the list is the fixed file order, one entry per file.
    -->
    {#each stateLines as line, lineIndex (lineIndex)}
      <p class="body info" data-testid="timeline-file-state" data-status={line.status}>
        {line.status === 'skipped'
          ? formatNewDataSkipped(fileLabel(line.file))
          : formatDeviceNoRows(fileLabel(line.file))}
      </p>
    {/each}

    {#if !wholePaneEmpty}
      {#if canReveal}
        <div class="reveal-row">
          <button
            type="button"
            data-testid="timeline-mask-toggle"
            data-masked={revealed ? 'false' : 'true'}
            onclick={onToggle}
          >
            {revealed ? MASK_TOGGLE_HIDE : MASK_TOGGLE_SHOW}
          </button>
          <p class="caption" data-testid="timeline-mask-caption">
            {revealed ? MASK_CAPTION_REVEALED : MASK_CAPTION_MASKED}
          </p>
        </div>
      {/if}

      <AboutDisclosure name={ABOUT_NAME_TIMELINE} testId="about-account-timeline">
        <p class="caption">{TIMELINE_ABOUT}</p>
      </AboutDisclosure>

      {#if showKindFilter(present)}
        <TimelineKindFilter kinds={present} selected={kind} onchange={onKindChange} />
      {/if}
    {/if}
  {/if}

  <!--
    The pane's ONE live region, present in EVERY non-error state and empty when
    idle: a region that appears together with its content is announced by its
    insertion rather than by its text. Empty means visually hidden, not absent.
  -->
  <p
    class="caption"
    class:visually-hidden={showingText === ''}
    data-testid="timeline-showing"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {showingText}
    {#if announcement !== ''}<span class="visually-hidden">{announcement}</span>{/if}
  </p>

  {#if view !== null && !wholePaneEmpty && blockState !== 'error'}
    <TimelineTable entries={filtered} {tags} {revealed} />
  {/if}
</div>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
  }

  /* The reveal row wraps rather than compressing its caption: at 375px the
     button takes the first line and the caption the second. */
  .reveal-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8) var(--space-16);
    min-width: 0;
  }

  button {
    padding: var(--space-8) var(--space-16);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--page);
    color: var(--text);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);

    &:hover {
      background: var(--hover);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }
</style>
