<script lang="ts">
  import type { ClassifyResult } from '../types/worker-messages.ts';
  import {
    START_OVER_LABEL,
    formatAccountHeading,
    formatImportedOn,
    formatSummary,
  } from '../ui-copy.ts';
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
    3. Imported timestamp    (p, label-style)    D-10
    4. Badge list            (ul, flex, wrap)    D-01, D-02
    5. Start over button     (button)            D-13, D-14

  The badge list is keyed by entry.name (worker-ordered, no re-sort)
  so the worker's grouped order is the contract (D-01, D-03).
-->
<section class="results" data-testid="results">
  <h2 class="account-heading" data-testid="account-heading">
    {formatAccountHeading(result.accountRoot)}
  </h2>

  <p class="summary" data-testid="summary-line">{formatSummary(result.counts)}</p>

  <p class="imported-at" data-testid="imported-at">{formatImportedOn(result.importedAt ?? '')}</p>

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

  /* D-10: "Imported on ..." timestamp. Reuses the neutral-info /
     label-level typography already in use on the badge name span
     (14/600) so the timestamp reads as metadata next to the
     summary, not as a second headline. */
  .imported-at {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
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

  /* D-15 + D-16 + UI-SPEC "Destructive-trigger design rule":
     Start Over is now destructive (wipes the cached dataset, not
     just the view state), so the trigger button stops using the
     accent blue palette reserved for the primary, NON-destructive
     import action. The button itself stays neutral grey; the
     destructive red color is reserved for the ConfirmPanel's
     commit button (the actual point of no return). The neutral
     palette mirrors the persistent "Clear my cached data" control
     so the two destructive triggers visually pair. */
  .start-over {
    align-self: flex-start;
    padding: 8px 16px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #fff;
    color: #3c4043;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .start-over:hover {
    background: #f1f3f4;
  }

  /* :focus-visible outline ring stays accent blue app-wide (UI-SPEC
     Accent row: "Reserved for ... :focus-visible outlines app-wide").
     The accent is reserved for focus/focus-visible regardless of
     whether the underlying control is destructive — keeping the
     focus ring accent prevents the destructive-control palette
     from accidentally eating the focus-ring convention. */
  .start-over:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }
</style>
