<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import {
    acceptDataOutcome,
    deriveFinanceState,
    type ShownBlock,
  } from '../finance/finance-state.ts';
  import { accountTagsFor } from '../../shell/identity-model.ts';
  import {
    NEW_DATA_FILE_LABELS,
    WOWS_STORAGE_CARD_TITLES,
    WOWS_STORAGE_ERROR,
    WOWS_STORAGE_INTRO,
    WOWS_STORAGE_LOADING,
  } from '../../ui-copy.ts';
  import NewDataCard from './NewDataCard.svelte';
  import {
    WOWS_CARD_FILES,
    WOWS_CARD_IDS,
    type NewDataCardView,
    type WarshipsStorageView,
    type WowsCardId,
  } from './new-data-shared.ts';
  import { orderRowsByAccount } from './new-data-state.ts';

  /**
   * The Warships crews and account storage pane body (plan 11-09, GAMES-04, D-03):
   * an intro paragraph and two stacked cards, Crews and Account storage.
   *
   * It is the HEAT pane's smaller sibling and follows the same load rules. It asks
   * ONE channel, `warships-storage`, and stamps the applied answer with the
   * dataset it answers for, so a replace lands as `loading` by construction and a
   * previous export's records are never shown under a new export's heading
   * (T-11-32). With two or more accounts every data row begins with its account
   * tag, through the shared table; with one account no tag, caption or extra
   * width exists.
   *
   * ## No mask control
   *
   * The pane takes no reveal and renders no mask control: no address column is
   * expected in these files. The cards are given `revealed` as false, so if a
   * later spec ever allows an address column in them the shared table keeps it
   * masked, with no way to reveal it from here. That is the safe failure, and
   * this comment is where a spec that adds such a column should notice it.
   *
   * The pane's single live region carries the loading sentence only. The error is
   * a fixed sentence, never the worker's detail (T-11-31).
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam: the only way this pane asks. */
    client: QueryClient;
  }

  let { result, client }: Props = $props();

  /** Each card's test id (UI-SPEC Test Hooks). */
  const CARD_TEST_IDS: Readonly<Record<WowsCardId, string>> = {
    crews: 'wows-card-crews',
    storage: 'wows-card-storage',
  };

  const importedAt = $derived(result?.importedAt ?? null);

  /**
   * The applied answer and the dataset it answers for, in ONE cell, so a value
   * cannot be stamped separately from its dataset.
   */
  let shown = $state.raw<ShownBlock<WarshipsStorageView> | null>(null);

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'warships-storage' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'warships-storage', wanted, importedAt);
    if (accepted !== null) shown = accepted;
  }

  $effect(() => {
    const wanted = importedAt;
    if (wanted === null) return;
    untrack(() => {
      void load(wanted);
    });
  });

  const blockState = $derived(deriveFinanceState({ importedAt, shown }));

  const readyView = $derived<WarshipsStorageView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  /** The account tags, or `null` for a single-account dataset (UI-SPEC A6). */
  const tags = $derived(accountTagsFor(result));

  /** A card with its rows in identity-header account order, then the file's own. */
  function ordered(card: NewDataCardView): NewDataCardView {
    return card.status === 'ready' ? { ...card, rows: orderRowsByAccount(card.rows, tags) } : card;
  }

  const cards = $derived<Record<WowsCardId, NewDataCardView> | null>(
    readyView === null
      ? null
      : {
          crews: ordered(readyView.cards.crews),
          storage: ordered(readyView.cards.storage),
        },
  );
</script>

<div
  class="block"
  data-testid="warships-storage-block"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  <!--
    The pane's ONE live region, present in EVERY state and empty when idle: a
    region that appears together with its content is announced by its insertion
    rather than by its text. Empty means visually hidden, not absent.
  -->
  <p
    class="status"
    class:hidden={blockState !== 'loading'}
    data-testid="warships-storage-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {blockState === 'loading' ? WOWS_STORAGE_LOADING : ''}
  </p>

  {#if blockState === 'loading'}
    <!-- The loading line IS the status region, not a second paragraph. -->
  {:else if blockState === 'error'}
    <!--
      The FIXED sentence, never the worker's detail (T-11-31). `role="alert"`
      only, with no live attribute: the role already announces.
    -->
    <p class="body error" role="alert">{WOWS_STORAGE_ERROR}</p>
  {:else if cards !== null}
    <p class="caption">{WOWS_STORAGE_INTRO}</p>

    {#each WOWS_CARD_IDS as id (id)}
      <NewDataCard
        title={WOWS_STORAGE_CARD_TITLES[id]}
        file={NEW_DATA_FILE_LABELS[WOWS_CARD_FILES[id]] ?? WOWS_CARD_FILES[id]}
        view={cards[id]}
        testId={CARD_TEST_IDS[id]}
        layout="table"
        fileKey={WOWS_CARD_FILES[id]}
        {tags}
        revealed={false}
        battleTypeColumnId={null}
      />
    {/each}
  {/if}
</div>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
  }

  .status {
    margin: 0;
    min-height: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;

    /* The empty status line, hidden without leaving the accessibility tree. The
       clip pattern, not `display: none`: a region that is not in the tree cannot
       be announced. */
    &.hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }
  }
</style>
