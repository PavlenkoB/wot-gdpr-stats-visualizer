<script lang="ts">
  import type { QueryClient } from '../query-client.ts';
  import type { ClassifyResult } from '../types/worker-messages.ts';
  import type { TooltipRequest } from '../playtime-model.ts';
  import PremiumBlock from './PremiumBlock.svelte';
  import CurrencyBlock from './CurrencyBlock.svelte';
  import ChartTooltip from './ChartTooltip.svelte';

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
  <PremiumBlock {result} {client} onTip={handleTip} />
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
    gap: 24px;
    min-width: 0;
  }
</style>
