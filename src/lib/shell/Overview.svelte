<script lang="ts">
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import {
    OVERVIEW_INTRO,
    PANE_TITLES,
    ROW_HEADLINE_NONE,
    formatChipAbsent,
    formatChipUnsupported,
    formatChipWithData,
    formatOpenSectionLink,
  } from '../ui-copy.ts';
  import { overviewCards, overviewChips } from './overview-model.ts';
  import type { PaneId } from './selection-state.ts';

  /**
   * The Overview: the landing view after every import. A heading, one intro
   * sentence, three status chips and one summary card per data section.
   *
   * Everything here is derived from the already-loaded `ClassifyResult` through
   * `overview-model.ts`, which filters the same `paneEntries` the list rows read,
   * so a chip, a card and a row cannot disagree. There is NO worker query and no
   * worker client import: supersede is per channel, and a query from this surface
   * could only compete with an open section's own.
   *
   * The account card prints the location code and the created date, never the
   * nickname (D-21: the nickname appears exactly once, in the list pane header).
   * Every string is interpolated as text.
   */
  interface Props {
    /** The last known dataset. */
    result: ClassifyResult;
    /** An available card's control was activated: select that pane and go into it. */
    onopen: (id: PaneId) => void;
  }

  let { result, onopen }: Props = $props();

  const chips = $derived(overviewChips(result));
  const cards = $derived(overviewCards(result));
</script>

<div class="overview" data-testid="overview">
  <h2 id="overview-heading" class="section-title">{PANE_TITLES.overview}</h2>
  <p class="intro">{OVERVIEW_INTRO}</p>

  <ul class="chips">
    <li class="chip" data-testid="ov-chip-with-data">{formatChipWithData(chips.withData)}</li>
    <li class="chip" data-testid="ov-chip-absent">{formatChipAbsent(chips.absent)}</li>
    <li class="chip" data-testid="ov-chip-unsupported">
      {formatChipUnsupported(chips.unsupported)}
    </li>
  </ul>

  <div class="ov-grid">
    {#each cards as card (card.id)}
      <div class="ov-card" class:na={!card.available} data-testid="ov-card-{card.id}">
        <span class="label">{card.title}</span>
        <span class="headline" class:none={!card.available}>
          {card.available ? card.headline : ROW_HEADLINE_NONE}
        </span>
        <span class="summary">{card.summary}</span>
        {#if card.available}
          <button
            type="button"
            class="link"
            data-testid="ov-open-{card.id}"
            onclick={() => onopen(card.id)}
          >
            {formatOpenSectionLink(card.title)}
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .overview {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .section-title {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .intro {
    margin: 0;
    min-width: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text);
    overflow-wrap: anywhere;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chip {
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--chip);
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .ov-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
    gap: 16px;
  }

  .ov-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--card);
  }

  .ov-card:hover {
    border-color: var(--ink);
  }

  /* A section that is not in this export: a dashed panel, not a link, and no
     hover change. --faint is decoration and dashed borders only, never text. */
  .ov-card.na {
    border: 1px dashed var(--faint);
    background: var(--list);
    cursor: default;
  }

  .ov-card.na:hover {
    border-color: var(--faint);
  }

  .label {
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  .headline {
    font-size: 30px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .headline.none {
    color: var(--muted);
  }

  .summary {
    font-size: 14px;
    color: var(--text);
    overflow-wrap: anywhere;
  }

  /* The open control: an underlined ink link-style button. The focus ring is
     the global button:focus-visible one in app.css. 44px tall for a thumb. */
  .link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
    overflow-wrap: anywhere;
  }
</style>
