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
    ABOUT_NAME_PERKS,
    NEW_DATA_FILE_LABELS,
    PERKS_ABOUT,
    PERKS_CARD_TITLES,
    PERKS_ERROR,
    PERKS_INTRO,
    PERKS_LOADING,
    PERKS_MASK_ANNOUNCE_MASKED,
    PERKS_MASK_ANNOUNCE_SHOWN,
    PERKS_MASK_CAPTION_MASKED,
    PERKS_MASK_CAPTION_REVEALED,
    PERKS_MASK_TOGGLE_HIDE,
    PERKS_MASK_TOGGLE_SHOW,
    formatMergeNote,
  } from '../../ui-copy.ts';
  import NewDataCard from './NewDataCard.svelte';
  import {
    PERKS_CARD_FILES,
    PERKS_CARD_IDS,
    type NewDataCardView,
    type PerksCardId,
    type PerksView,
  } from './new-data-shared.ts';
  import { hasMaskableRows, orderRowsByAccount } from './new-data-state.ts';

  /**
   * The Perks pane body (plan 12-09, PERKS-01 to PERKS-03, D-08, D-13): an intro
   * paragraph, the merge note, the code-aware mask control, the About disclosure
   * and four stacked cards - Subscriptions, Personal coupons, Bonus codes and
   * Surveys, in that fixed order.
   *
   * It is the HEAT pane's twin. It asks ONE channel, `perks`, through the
   * channel-scoped client and derives its state with the same pure functions the
   * finance blocks use, so the pane cannot show a previous export's perks under a
   * new export's heading: the applied answer is stamped with the dataset it
   * answers for and a replace lands as "no answer for what is on screen", which
   * is `loading` by construction (T-12-30).
   *
   * ## The codes and the redeeming address
   *
   * Coupon codes, bonus codes and the bonus-code user IP are masked by default and
   * only through the shell's ONE reveal: the pane takes `revealed` and
   * `onRevealChange` from the shell (the cell Login history and HEAT read too) and
   * holds no reveal state of its own, so every new dataset opens masked and one
   * press here reveals or hides the other panes' addresses as well. The toggle
   * renders only when a rendered card has a row and a code or address column to
   * govern (`hasMaskableRows`). A value reaches the page only through
   * `formatNewDataCell`, as text: no title, aria-label, test id or data attribute
   * carries one (T-12-28).
   *
   * The pane's single live region carries the loading sentence and the mask
   * announcements - state words, never a value. The error is a fixed sentence,
   * never the worker's detail (T-12-29).
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam: the only way this pane asks. */
    client: QueryClient;
    /** Whether codes and addresses are shown in full: the shell's ONE reveal. */
    revealed: boolean;
    /** Ask the shell to reveal or re-mask, stamped with the current dataset. */
    onRevealChange: (revealed: boolean) => void;
  }

  let { result, client, revealed, onRevealChange }: Props = $props();

  /** Each card's test id (UI-SPEC Test Hooks). */
  const CARD_TEST_IDS: Readonly<Record<PerksCardId, string>> = {
    subscriptions: 'perks-card-subscriptions',
    coupons: 'perks-card-coupons',
    bonusCodes: 'perks-card-bonus-codes',
    surveys: 'perks-card-surveys',
  };

  const importedAt = $derived(result?.importedAt ?? null);

  /**
   * The applied answer and the dataset it answers for, in ONE cell, so a value
   * cannot be stamped separately from its dataset.
   */
  let shown = $state.raw<ShownBlock<PerksView> | null>(null);

  /** What the live region says about the LAST thing the reader did, or nothing. */
  let announcement = $state('');

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'perks' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'perks', wanted, importedAt);
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

  const readyView = $derived<PerksView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  /** The account tags, or `null` for a single-account dataset (UI-SPEC A6). */
  const tags = $derived(accountTagsFor(result));

  /** A card with its rows in identity-header account order, then the file's own. */
  function ordered(card: NewDataCardView): NewDataCardView {
    return card.status === 'ready' ? { ...card, rows: orderRowsByAccount(card.rows, tags) } : card;
  }

  const cards = $derived<Record<PerksCardId, NewDataCardView> | null>(
    readyView === null
      ? null
      : {
          subscriptions: ordered(readyView.cards.subscriptions),
          coupons: ordered(readyView.cards.coupons),
          bonusCodes: ordered(readyView.cards.bonusCodes),
          surveys: ordered(readyView.cards.surveys),
        },
  );

  /** The merge note count, or zero: a note needs rows removed AND two or more accounts. */
  const mergedAway = $derived(readyView !== null && tags !== null ? readyView.mergedAway : 0);

  /**
   * Whether anything the mask governs is on screen: a rendered coupon or
   * bonus-code card that is ready, holds a row and has a code or address column.
   * Without that the toggle would control nothing (D-13).
   */
  const canReveal = $derived(cards !== null && hasMaskableRows([cards.coupons, cards.bonusCodes]));

  /** The loading sentence in `loading`, otherwise the last mask announcement. */
  const statusText = $derived(blockState === 'loading' ? PERKS_LOADING : announcement);

  /**
   * The one control, and the one place the mask changes from this pane. The
   * announcement is read from the NEXT value, so it says what the reader just
   * asked for rather than waiting for the prop to come back down.
   */
  function onToggle(): void {
    const next = !revealed;
    onRevealChange(next);
    announcement = next ? PERKS_MASK_ANNOUNCE_SHOWN : PERKS_MASK_ANNOUNCE_MASKED;
  }
</script>

<div
  class="block"
  data-testid="perks-block"
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
    data-testid="perks-status"
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
      The FIXED sentence, never the worker's detail (T-12-29). `role="alert"`
      only, with no live attribute: the role already announces.
    -->
    <p class="body error" role="alert">{PERKS_ERROR}</p>
  {:else if cards !== null}
    <p class="muted-note">{PERKS_INTRO}</p>

    {#if mergedAway > 0}
      <p class="muted-note" data-testid="perks-merge-note">{formatMergeNote(mergedAway)}</p>
    {/if}

    {#if canReveal}
      <div class="reveal-row">
        <button
          type="button"
          class="t-note-strong"
          data-testid="perks-mask-toggle"
          data-masked={revealed ? 'false' : 'true'}
          onclick={onToggle}
        >
          {revealed ? PERKS_MASK_TOGGLE_HIDE : PERKS_MASK_TOGGLE_SHOW}
        </button>
        <p class="muted-note" data-testid="perks-mask-caption">
          {revealed ? PERKS_MASK_CAPTION_REVEALED : PERKS_MASK_CAPTION_MASKED}
        </p>
      </div>
    {/if}

    <AboutDisclosure name={ABOUT_NAME_PERKS} testId="about-perks">
      <p class="muted-note">{PERKS_ABOUT}</p>
    </AboutDisclosure>

    {#each PERKS_CARD_IDS as id (id)}
      {@const file = PERKS_CARD_FILES[id]}
      <NewDataCard
        title={PERKS_CARD_TITLES[id]}
        file={file === null ? PERKS_CARD_TITLES[id] : (NEW_DATA_FILE_LABELS[file] ?? file)}
        view={cards[id]}
        testId={CARD_TEST_IDS[id]}
        layout="table"
        fileKey={file ?? ''}
        {tags}
        {revealed}
        battleTypeColumnId={null}
        severalTags={id === 'subscriptions'}
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

  /* The reveal row wraps rather than compressing its caption: at 375px the
     button takes the first line and the caption the second. The rules are
     Login history's, repeated for the same reason as above. */
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

    &:hover {
      background: var(--hover);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }
</style>
