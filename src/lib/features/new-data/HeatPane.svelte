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
    HEAT_BATTLE_TYPE_COLUMN_ID,
    HEAT_CARD_TITLES,
    HEAT_ERROR,
    HEAT_GEO_NOTE,
    HEAT_INTRO,
    HEAT_LOADING,
    MASK_ANNOUNCE_MASKED,
    MASK_ANNOUNCE_SHOWN,
    MASK_CAPTION_MASKED,
    MASK_CAPTION_REVEALED,
    MASK_TOGGLE_HIDE,
    MASK_TOGGLE_SHOW,
    NEW_DATA_FILE_LABELS,
  } from '../../ui-copy.ts';
  import NewDataCard from './NewDataCard.svelte';
  import {
    HEAT_CARD_FILES,
    HEAT_CARD_IDS,
    type HeatCardId,
    type HeatView,
    type NewDataCardView,
  } from './new-data-shared.ts';
  import { orderRowsByAccount } from './new-data-state.ts';

  /**
   * The HEAT pane body (plan 11-09, GAMES-01, D-01, D-04): an intro paragraph and
   * four stacked single-column cards - Account statistics (one block per account
   * that has the record), Battle types, Storage and Geolocation.
   *
   * It is the Device info pane's twin. It asks ONE channel, `heat`, through the
   * channel-scoped client and derives its state with the same pure functions the
   * finance blocks use, so the pane cannot show a previous export's HEAT records
   * under a new export's heading: the applied answer is stamped with the dataset
   * it answers for and a replace lands as "no answer for what is on screen",
   * which is `loading` by construction (T-11-32).
   *
   * ## The geolocation addresses
   *
   * Addresses are masked by default and only through the shell's ONE reveal:
   * the pane takes `revealed` and `onRevealChange` from the shell (the cell Login
   * history reads too), so pressing the button here reveals or hides the Login
   * history addresses as well, and every new dataset opens masked. The pane
   * imports nothing from the login aggregates (T-11-30): HEAT addresses reach
   * the page only through the shared table's `displayIp`, and feed no map,
   * country list or tile.
   *
   * The pane's single live region carries the loading sentence and the mask
   * announcements - state words, never an address. The error is a fixed sentence,
   * never the worker's detail (T-11-31).
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

  /** Each card's test id (UI-SPEC Test Hooks). */
  const CARD_TEST_IDS: Readonly<Record<HeatCardId, string>> = {
    accountStats: 'heat-card-account-stats',
    battleTypes: 'heat-card-battle-types',
    storage: 'heat-card-storage',
    geolocation: 'heat-card-geolocation',
  };

  const importedAt = $derived(result?.importedAt ?? null);

  /**
   * The applied answer and the dataset it answers for, in ONE cell, so a value
   * cannot be stamped separately from its dataset.
   */
  let shown = $state.raw<ShownBlock<HeatView> | null>(null);

  /** What the live region says about the LAST thing the reader did, or nothing. */
  let announcement = $state('');

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'heat' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'heat', wanted, importedAt);
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

  const readyView = $derived<HeatView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  /** The account tags, or `null` for a single-account dataset (UI-SPEC A6). */
  const tags = $derived(accountTagsFor(result));

  /** A card with its rows in identity-header account order, then the file's own. */
  function ordered(card: NewDataCardView): NewDataCardView {
    return card.status === 'ready' ? { ...card, rows: orderRowsByAccount(card.rows, tags) } : card;
  }

  const cards = $derived<Record<HeatCardId, NewDataCardView> | null>(
    readyView === null
      ? null
      : {
          accountStats: ordered(readyView.cards.accountStats),
          battleTypes: ordered(readyView.cards.battleTypes),
          storage: ordered(readyView.cards.storage),
          geolocation: ordered(readyView.cards.geolocation),
        },
  );

  /**
   * Whether the geolocation card has anything the mask governs: it is ready, one
   * of its columns holds addresses and at least one row exists. Without that the
   * toggle would control nothing.
   */
  const canReveal = $derived.by(() => {
    const card = cards?.geolocation;
    return (
      card !== undefined &&
      card.status === 'ready' &&
      card.rows.length > 0 &&
      card.columns.some((column) => column.kind === 'address')
    );
  });

  /** The loading sentence in `loading`, otherwise the last mask announcement. */
  const statusText = $derived(blockState === 'loading' ? HEAT_LOADING : announcement);

  /**
   * The one control, and the one place the mask changes from this pane. The
   * announcement is read from the NEXT value, so it says what the reader just
   * asked for rather than waiting for the prop to come back down.
   */
  function onToggle(): void {
    const next = !revealed;
    onRevealChange(next);
    announcement = next ? MASK_ANNOUNCE_SHOWN : MASK_ANNOUNCE_MASKED;
  }
</script>

{#snippet geoHeader()}
  <p class="caption">{HEAT_GEO_NOTE}</p>
  {#if canReveal}
    <div class="reveal-row">
      <button
        type="button"
        data-testid="heat-mask-toggle"
        data-masked={revealed ? 'false' : 'true'}
        onclick={onToggle}
      >
        {revealed ? MASK_TOGGLE_HIDE : MASK_TOGGLE_SHOW}
      </button>
      <p class="caption" data-testid="heat-mask-caption">
        {revealed ? MASK_CAPTION_REVEALED : MASK_CAPTION_MASKED}
      </p>
    </div>
  {/if}
{/snippet}

<div
  class="block"
  data-testid="heat-block"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  <!--
    The pane's ONE live region, present in EVERY state and empty when idle: a
    region that appears together with its content is announced by its insertion
    rather than by its text. Empty means visually hidden, not absent, so it keeps
    its place in the accessibility tree while measuring nothing.
  -->
  <p
    class="status"
    class:hidden={statusText === ''}
    data-testid="heat-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {statusText}
  </p>

  {#if blockState === 'loading'}
    <!-- The loading line IS the status region, not a second paragraph. -->
  {:else if blockState === 'error'}
    <!--
      The FIXED sentence, never the worker's detail (T-11-31). `role="alert"`
      only, with no live attribute: the role already announces.
    -->
    <p class="body error" role="alert">{HEAT_ERROR}</p>
  {:else if cards !== null}
    <p class="caption">{HEAT_INTRO}</p>

    {#each HEAT_CARD_IDS as id (id)}
      <NewDataCard
        title={HEAT_CARD_TITLES[id]}
        file={NEW_DATA_FILE_LABELS[HEAT_CARD_FILES[id]] ?? HEAT_CARD_FILES[id]}
        view={cards[id]}
        testId={CARD_TEST_IDS[id]}
        layout={id === 'accountStats' ? 'blocks' : 'table'}
        fileKey={HEAT_CARD_FILES[id]}
        {tags}
        {revealed}
        battleTypeColumnId={id === 'battleTypes' ? HEAT_BATTLE_TYPE_COLUMN_ID : null}
        header={id === 'geolocation' ? geoHeader : undefined}
      />
    {/each}
  {/if}
</div>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .body {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The project's destructive error chrome, repeated from Device info:
     Svelte's scoped styles cannot be shared, and a copy that drifts should show
     in a diff. */
  .error {
    padding: 8px 12px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
  }

  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .status {
    margin: 0;
    min-height: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The empty status line, hidden without leaving the accessibility tree. The
     clip pattern, not `display: none`: a region that is not in the tree cannot
     be announced. */
  .status.hidden {
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

  /* The reveal row wraps rather than compressing its caption: at 375px the
     button takes the first line and the caption the second. The rules are
     Login history's, repeated for the same reason as above. */
  .reveal-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    min-width: 0;
  }

  button {
    padding: 8px 16px;
    border: 1px solid var(--faint);
    border-radius: 6px;
    background: var(--page);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }

  button:hover {
    background: var(--hover);
  }

  button:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
