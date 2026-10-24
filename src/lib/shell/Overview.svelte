<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '../core/query-client.ts';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import {
    acceptDataOutcome,
    deriveOverviewScreen,
    type OverviewShown,
  } from '../features/overview/overview-state.ts';
  import OverviewBento from '../features/overview/OverviewBento.svelte';
  import { PANE_TITLES } from '../ui-copy.ts';
  import type { PaneId } from './selection-state.ts';

  /**
   * The Overview: the landing view after every import, and the phase-13
   * personal-insights page.
   *
   * ## One channel, one answer (13-01, D-01)
   *
   * The page asks the worker for the `overview` channel and nothing else.
   * Supersede is per channel, so an Overview ask can never release an open
   * pane's question, and the answer is memoised per import, so returning to
   * the Overview is instant.
   *
   * ## The ask-and-accept pattern
   *
   * This is the Account timeline pane's pattern, copied rather than reinvented:
   * the applied answer and the dataset it answers for live in ONE `$state.raw`
   * cell, and the state is derived from that cell and the dataset. A replace
   * that lands mid-query therefore returns the page to `loading` by
   * construction — there is no hand-written reset to forget.
   *
   * ## The composer
   *
   * This file asks the channel, derives the screen and mounts the bento
   * (`OverviewBento`), which draws the page. It holds no layout.
   *
   * ## The live regions
   *
   * None of its own. The page keeps exactly two page-level live regions, and
   * this surface adds no third: the loading sentence and the failure banner
   * are ordinary content, and the banner carries `role="alert"`.
   */
  interface Props {
    /** The last known dataset. */
    result: ClassifyResult;
    /** The channel-scoped query seam: the only way this page asks. */
    client: QueryClient;
    /**
     * A tile's "Open {Section}" link was activated: select that pane and go
     * into it (the shell's `openPane`).
     */
    onopen?: (id: PaneId) => void;
  }

  let { result, client, onopen }: Props = $props();

  const importedAt = $derived(result?.importedAt ?? null);

  /** The applied answer and the dataset it answers for, in ONE cell. */
  let shown = $state.raw<OverviewShown | null>(null);

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'overview' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'overview', wanted, importedAt);
    if (accepted !== null) shown = accepted;
  }

  $effect(() => {
    const wanted = importedAt;
    untrack(() => {
      if (wanted === null) return;
      void load(wanted);
    });
  });

  const screen = $derived(deriveOverviewScreen({ importedAt, shown }));

  const view = $derived(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );
</script>

<div class="overview" data-testid="overview" aria-busy={screen === 'loading' ? 'true' : 'false'}>
  <h2 id="overview-heading" class="section-title">{PANE_TITLES.overview}</h2>

  <OverviewBento {result} {view} {screen} onopen={(pane) => onopen?.(pane)} />
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
</style>
