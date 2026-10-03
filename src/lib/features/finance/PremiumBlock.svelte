<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { SECONDS_PER_DAY, type PremiumMonth, type PremiumView } from './finance-shared.ts';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ShownBlock } from './finance-state.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import type { TooltipRequest } from '../playtime/playtime-model.ts';
  import { acceptDataOutcome, deriveFinanceState, premiumFigures } from './finance-state.ts';
  import { buildBarChartModel } from '../../charts/bar-chart-model.ts';
  import MonthlyBarChart from '../../charts/MonthlyBarChart.svelte';
  import MonthlyDataTable from '../../charts/MonthlyDataTable.svelte';
  import ExcludedNotice from '../../shell/ExcludedNotice.svelte';
  import {
    FINANCIAL_ERROR,
    FINANCIAL_LOADING,
    FINANCIAL_NOT_IN_EXPORT,
    FINANCIAL_PREMIUM_HEADING,
    PREMIUM_CHART_TITLE,
    BAR_CHART_BASIS_CAPTION,
    BAR_CHART_KEYBOARD_HINT,
    MONTHLY_TABLE_DISCLOSURE,
    PREMIUM_TABLE_HEADERS,
    PREMIUM_EXCLUDED_EXPLANATION,
    PREMIUM_NO_USABLE,
    formatFinancialNoRows,
    formatPremiumExcludedPill,
    formatPremiumSummary,
    formatPremiumUnrecognisedDisclosure,
    formatUnrecognisedOverflow,
    formatPremiumCellLabel,
    formatPremiumTooltip,
    formatMonthLabel,
    formatCompactNumber,
    formatPremiumDays,
    formatNumber,
    type PremiumMonthFigure,
  } from '../../ui-copy.ts';

  /**
   * The Premium time sub-block of the Financial_data card (05-10, 05-11, FINANCE-01).
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam (D-06) — the only way this block asks. */
    client: QueryClient;
    /** Callback to open/close shared tooltip. */
    onTip?: (request: TooltipRequest | null, anchor?: Element | null) => void;
  }

  let { result, client, onTip = () => {} }: Props = $props();

  const importedAt = $derived(result?.importedAt ?? null);

  let shown = $state.raw<ShownBlock<PremiumView> | null>(null);
  let tableOpen = $state(false);

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'premium' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'premium', wanted, importedAt);
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

  const view = $derived<PremiumView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  const readyView = $derived(view?.status === 'ready' ? view : null);

  const excludedView = $derived(
    view !== null && (view.status === 'ready' || view.status === 'no-usable') ? view : null,
  );

  const listedCount = $derived(
    excludedView === null ? 0 : excludedView.unrecognised.length + excludedView.unrecognisedMore,
  );

  const summary = $derived(
    readyView === null ? '' : formatPremiumSummary(premiumFigures(readyView)),
  );

  const noRowsText = formatFinancialNoRows('premium');

  const premiumMonthMap = $derived.by(() => {
    const map = new SvelteMap<number, PremiumMonth>();
    if (readyView !== null) {
      for (const m of readyView.months) {
        map.set(m.month, m);
      }
    }
    return map;
  });

  const chartModel = $derived.by(() => {
    if (readyView === null) return null;
    return buildBarChartModel({
      kind: 'premium',
      firstMonth: readyView.firstMonth,
      lastMonth: readyView.lastMonth,
      months: readyView.months.map((m) => ({
        month: m.month,
        up: m.seconds / SECONDS_PER_DAY,
        down: 0,
      })),
    });
  });

  function getMonthFigure(monthIndex: number): PremiumMonthFigure {
    const m = premiumMonthMap.get(monthIndex);
    if (m !== undefined) {
      return {
        month: monthIndex,
        seconds: m.seconds,
        grants: m.grants,
        sizes: m.sizes,
        moreSizes: m.moreSizes,
      };
    }
    return {
      month: monthIndex,
      seconds: 0,
      grants: 0,
      sizes: [],
      moreSizes: 0,
    };
  }

  const yTop = $derived.by(() => {
    if (chartModel === null) return { text: '0', exact: '0 days' };
    const maxDays = chartModel.domainMax;
    const exactSecs = Math.round(maxDays * SECONDS_PER_DAY);
    return {
      text: formatCompactNumber(maxDays),
      exact: formatPremiumDays(exactSecs),
    };
  });

  const tableRows = $derived.by(() => {
    if (chartModel === null) return [];
    const reversed = [...chartModel.cells].reverse();
    return reversed.map((cell) => {
      const fig = getMonthFigure(cell.month);
      return [
        formatMonthLabel(cell.month),
        formatPremiumDays(fig.seconds),
        formatNumber(fig.grants),
      ];
    });
  });
</script>

<div
  data-testid="premium-block"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  <h3>{FINANCIAL_PREMIUM_HEADING}</h3>

  {#if blockState === 'loading'}
    <p class="body" role="status">{FINANCIAL_LOADING}</p>
  {:else if blockState === 'not-in-export'}
    <p class="body">{FINANCIAL_NOT_IN_EXPORT}</p>
  {:else if blockState === 'no-rows'}
    <p class="body">{noRowsText}</p>
  {:else if blockState === 'no-usable'}
    <p class="body">{PREMIUM_NO_USABLE}</p>
  {:else if blockState === 'error'}
    <p class="body error" role="alert">{FINANCIAL_ERROR}</p>
  {:else if readyView !== null}
    <p class="body" data-testid="premium-summary">{summary}</p>

    {#if chartModel !== null}
      <div class="chart-container">
        <h4 class="chart-title">{PREMIUM_CHART_TITLE}</h4>
        <p class="caption">{BAR_CHART_BASIS_CAPTION}</p>
        <p class="caption hint" id="premium-keyboard-hint">{BAR_CHART_KEYBOARD_HINT}</p>

        <MonthlyBarChart
          model={chartModel}
          chartTestId="premium-chart"
          cellTestId="premium-cell"
          ariaLabel={PREMIUM_CHART_TITLE}
          describedBy="premium-keyboard-hint"
          cellName={(index) => formatPremiumCellLabel(getMonthFigure(readyView.firstMonth + index))}
          cellAttrs={(index) => {
            const fig = getMonthFigure(readyView.firstMonth + index);
            return {
              'data-month': formatMonthLabel(fig.month),
              'data-days': fig.seconds / SECONDS_PER_DAY,
              'data-grants': fig.grants,
            };
          }}
          tip={(index) => formatPremiumTooltip(getMonthFigure(readyView.firstMonth + index))}
          {yTop}
          {onTip}
        />

        <details data-testid="monthly-table-disclosure" bind:open={tableOpen}>
          <summary>{MONTHLY_TABLE_DISCLOSURE}</summary>
          {#if tableOpen}
            <MonthlyDataTable columns={PREMIUM_TABLE_HEADERS} rows={tableRows} />
          {/if}
        </details>
      </div>
    {/if}
  {/if}

  {#if excludedView !== null}
    <ExcludedNotice
      count={excludedView.excluded}
      pill={formatPremiumExcludedPill(excludedView.excluded)}
      explanation={PREMIUM_EXCLUDED_EXPLANATION}
      testId="premium-excluded"
    />

    {#if listedCount > 0}
      <details data-testid="premium-unrecognised">
        <summary>{formatPremiumUnrecognisedDisclosure(listedCount)}</summary>
        <ul class="unrecognised">
          {#each excludedView.unrecognised as value (value)}
            <li>{value}</li>
          {/each}
          {#if excludedView.unrecognisedMore > 0}
            <li class="overflow">{formatUnrecognisedOverflow(excludedView.unrecognisedMore)}</li>
          {/if}
        </ul>
      </details>
    {/if}
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  h3 {
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #dadce0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #08060d;
  }

  .body {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #3c4043;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .error {
    padding: 8px 12px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
  }

  .chart-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  h4.chart-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #08060d;
  }

  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
  }

  .hint {
    margin-top: 4px;
  }

  details {
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  summary:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  .unrecognised {
    margin: 8px 0 0;
    padding-left: 20px;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: #3c4043;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .overflow {
    margin-top: 4px;
    color: #5f6368;
    font-style: italic;
  }
</style>
