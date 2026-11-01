<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import {
    acceptDataOutcome,
    deriveFinanceState,
    type ShownBlock,
  } from '../finance/finance-state.ts';
  import { DEVICE_SOURCES, type DeviceInfoView } from './device-info-shared.ts';
  import { deviceInfoSummary } from './device-info-state.ts';
  import DeviceTable from './DeviceTable.svelte';
  import {
    DEVICE_HEADINGS,
    DEVICE_INFO_ERROR,
    DEVICE_INFO_INTRO,
    DEVICE_INFO_LOADING,
    DEVICE_MEMORY_NOTE,
    DEVICE_SUMMARY_HEADING,
    formatDeviceSourceCount,
  } from '../../ui-copy.ts';

  /**
   * The Device info pane body (quick task 261012-bog): a counts summary and one
   * table per source file (PC hardware, Blitz devices, Assistant app devices).
   *
   * It asks ONE channel, `device-info`, through the channel-scoped client and
   * derives its state with the same pure functions the finance blocks use, so
   * the pane cannot show a previous export's devices under a new export's
   * heading. The `shown` answer is stamped with the dataset it answers for and
   * a replace lands as "no answer for what is on screen", which is `loading` by
   * construction rather than through a hand-written clear.
   *
   * What it never shows: the Assistant file's raw blob, its `POST` key, the
   * account id or the flags value. The view it reads carries only cells.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam: the only way this block asks. */
    client: QueryClient;
  }

  let { result, client }: Props = $props();

  const importedAt = $derived(result?.importedAt ?? null);

  let shown = $state.raw<ShownBlock<DeviceInfoView> | null>(null);

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'device-info' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'device-info', wanted, importedAt);
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

  const readyView = $derived<DeviceInfoView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  const summary = $derived(readyView === null ? null : deviceInfoSummary(readyView));
</script>

<div
  class="block"
  data-testid="device-info-block"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  {#if blockState === 'loading'}
    <p class="body" role="status">{DEVICE_INFO_LOADING}</p>
  {:else if blockState === 'error'}
    <!--
      The FIXED sentence, never the worker's detail (T-bog-05). No `aria-live`:
      a region created together with its content announces nothing, and a live
      error re-announces on every re-render.
    -->
    <p class="body error" role="alert">{DEVICE_INFO_ERROR}</p>
  {:else if readyView !== null && summary !== null}
    <p class="muted-note">{DEVICE_INFO_INTRO}</p>

    <h3 class="t-note-strong">{DEVICE_SUMMARY_HEADING}</h3>
    <!--
      The counts summary: one row per source in the fixed order, each with its
      heading and its formatted count. A definition list, so a screen reader
      pairs each number with the source it belongs to.
    -->
    <dl data-testid="device-info-summary">
      {#each summary.sources as source (source.id)}
        <dt class="t-note-strong">{DEVICE_HEADINGS[source.id]}</dt>
        <dd class="t-note" data-testid="device-info-summary-{source.id}">
          {formatDeviceSourceCount(source.status, source.rows, source.unreadable)}
        </dd>
      {/each}
    </dl>

    <p class="muted-note" data-testid="device-info-memory-note">{DEVICE_MEMORY_NOTE}</p>

    {#each DEVICE_SOURCES as id (id)}
      <DeviceTable source={id} table={readyView[id]} />
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

  /* The sub-heading rule the finance blocks use, repeated: Svelte's scoped
     styles cannot be shared, and a copy that drifts should show in a diff. */
  h3 {
    margin: 0;
    padding-bottom: var(--space-8);
    border-bottom: 1px solid var(--border);
    color: var(--ink);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-4) var(--space-16);
    margin: 0;
    min-width: 0;
  }

  dt {
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  dd {
    margin: 0;
    color: var(--text);
    text-align: right;
    font-variant-numeric: tabular-nums;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
