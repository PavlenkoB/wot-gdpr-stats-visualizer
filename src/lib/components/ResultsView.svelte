<script lang="ts">
  import type { ClassifyResult } from '../types/worker-messages.ts';
  import { START_OVER_LABEL, formatAccountHeading, formatSummary } from '../ui-copy.ts';
  import CategoryBadge from './CategoryBadge.svelte';

  interface Props {
    result: ClassifyResult;
    onstartover: () => void;
  }

  let { result, onstartover }: Props = $props();
</script>

<!--
  The success view that replaces the dropzone once an export has
  classified successfully (D-01, D-02, D-03, D-11, D-12, D-13).

  Document order matters for Playwright's bounding-box assertions
  (heading, summary-line, first badge must have strictly increasing
  tops). The order is fixed here:

    1. Account heading       (h2, small)        D-11
    2. Summary line          (p)                 D-03
    3. Badge list            (ul, flex, wrap)   D-01, D-02
    4. Start over button     (button)            D-13, D-14

  The badge list is keyed by entry.name (worker-ordered, no re-sort)
  so the worker's grouped order is the contract (D-01, D-03).
-->
<section class="results" data-testid="results">
  <h2 class="account-heading" data-testid="account-heading">
    {formatAccountHeading(result.accountRoot)}
  </h2>

  <p class="summary" data-testid="summary-line">{formatSummary(result.counts)}</p>

  <ul class="badge-list">
    {#each result.categories as entry (entry.name)}
      <CategoryBadge {entry} />
    {/each}
  </ul>

  <button type="button" class="start-over" data-testid="start-over" onclick={onstartover}>
    {START_OVER_LABEL}
  </button>
</section>

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* The account heading is intentionally SMALL — it is metadata, not
     a primary title (D-12). Modest font size keeps the badges the
     visual focus. */
  .account-heading {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .summary {
    margin: 0;
    font-size: 15px;
    color: #3c4043;
  }

  /* Flat row of pills; wrap is intentional so the badges never
     overflow on phone-width viewports. */
  .badge-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .start-over {
    align-self: flex-start;
    padding: 8px 16px;
    border: 1px solid #1a73e8;
    border-radius: 6px;
    background: #fff;
    color: #1a73e8;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .start-over:hover {
    background: #1a73e8;
    color: #fff;
  }

  .start-over:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }
</style>
