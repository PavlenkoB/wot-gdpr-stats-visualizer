<script lang="ts">
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import type { TooltipRequest } from '../playtime/playtime-model.ts';
  import PremiumBlock from './PremiumBlock.svelte';
  import CurrencyBlock from './CurrencyBlock.svelte';
  import ChartTooltip from '../../charts/ChartTooltip.svelte';
  import { accountCountOf } from '../../shell/identity-model.ts';
  import { FINANCE_COMBINED_NOTE } from '../../ui-copy.ts';

  /**
   * The `Financial_data` card's body (05-10, 05-11).
   *
   * The card holds TWO files with two different headers and two different sets
   * of answers, and D-01 gave them a section of their own rather than folding
   * them into `Payment_history`'s card — so a card's counts stay traceable back
   * to a file the user can find in the zip they unzipped.
   *
   * Hosts the single shared `finance-tooltip` instance for all Financial charts,
   * passing `onTip` down to its sub-blocks.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam (D-06). */
    client: QueryClient;
  }

  let { result, client }: Props = $props();

  let tipRequest = $state.raw<TooltipRequest | null>(null);
  let tipAnchor = $state<Element | null>(null);

  function handleTip(request: TooltipRequest | null, anchor?: Element | null): void {
    tipRequest = request;
    tipAnchor = anchor ?? null;
  }
</script>

<!--
  One 24px stack, the page's lg rhythm — the same gap the section cards use.
-->
<div class="financial">
  <!--
    For two or more accounts only (Phase 10, D-14): the one line saying the
    amounts are added per currency and never converted. The conditional tag sits
    flush against the block after it so a single account leaves no whitespace
    text node, and the DOM stays Phase 9's. Not a live region.
  -->
  {#if accountCountOf(result) >= 2}<p class="body" data-testid="finance-combined-note">
      {FINANCE_COMBINED_NOTE}
    </p>{/if}<PremiumBlock {result} {client} onTip={handleTip} />
  <!--
    The currency block AFTER the premium one, and both on the SAME `onTip`.
    Order is D-01's (the two files keep the order the export lists them), and
    the shared handler is what keeps the card at ONE tooltip: a second
    `ChartTooltip` would mean two elements racing for the pointer, and a
    reader hovering a gold bar would see a premium tooltip's lines.
  -->
  <CurrencyBlock {result} {client} onTip={handleTip} />
  <ChartTooltip
    request={tipRequest}
    anchor={tipAnchor}
    onDismiss={() => handleTip(null, null)}
    testId="finance-tooltip"
  />
</div>

<style>
  .financial {
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
    min-width: 0;
  }

  /* The text block comes from the shared layer now. The local `.body` is
     deleted, not tokenised: the shared `.body` in `src/styles/utilities.css`
     declares the same seven values (margin 0, min-width 0, 14/400/1.5,
     `--text`, wrap anywhere), and a scoped local copy would outrank the
     shared one. The markup keeps `class="body"`. */
</style>
