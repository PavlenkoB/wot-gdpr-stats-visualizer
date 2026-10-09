<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type { CurrencyEntry, CurrencyMonth, CurrencyView } from './finance-shared.ts';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ShownBlock } from './finance-state.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import type { TooltipRequest } from '../playtime/playtime-model.ts';
  import { acceptDataOutcome, currencyChartInput, deriveFinanceState } from './finance-state.ts';
  import { unitsToNumber } from '../../core/decimal.ts';
  import { buildBarChartModel } from '../../charts/bar-chart-model.ts';
  import AboutDisclosure from '../../charts/AboutDisclosure.svelte';
  import MonthlyBarChart from '../../charts/MonthlyBarChart.svelte';
  import MonthlyDataTable from '../../charts/MonthlyDataTable.svelte';
  import ExcludedNotice from '../../shell/ExcludedNotice.svelte';
  import FlowLegend from '../../charts/FlowLegend.svelte';
  import {
    ABOUT_NAME_CURRENCY,
    FINANCIAL_ERROR,
    FINANCIAL_LOADING,
    FINANCIAL_NOT_IN_EXPORT,
    FINANCIAL_CURRENCY_HEADING,
    CURRENCY_BLOCK_CAPTION,
    CURRENCY_NO_USABLE,
    CURRENCY_BLANK_CODE,
    CURRENCY_EXCLUDED_EXPLANATION,
    CURRENCY_TABLE_HEADERS,
    OTHER_CURRENCIES_HEADING,
    OTHER_CURRENCIES_CAPTION,
    MONTHLY_TABLE_DISCLOSURE,
    BAR_CHART_KEYBOARD_HINT,
    formatFinancialNoRows,
    formatCurrencySummary,
    formatCurrencyCellLabel,
    formatCurrencyTooltip,
    formatOtherCurrencyRow,
    formatOperationExcludedPill,
    formatMonthLabel,
    formatCompactNumber,
    formatFlowAmount,
    formatNumber,
    type CurrencyMonthFigure,
  } from '../../ui-copy.ts';

  /**
   * The Virtual currency sub-block of the Financial_data card (05-13, FINANCE-02).
   *
   * The Premium time sub-heading and its stylesheet rule are repeated here in
   * full rather than shared: Svelte's scoped styles cannot cross two files, and
   * the copy is deliberately visible so a change to one that misses the other
   * is visible in a diff rather than silent.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam (D-06) — the only way this block asks. */
    client: QueryClient;
    /** Callback to open/close the card's ONE shared tooltip. */
    onTip?: (request: TooltipRequest | null, anchor?: Element | null) => void;
  }

  let { result, client, onTip = () => {} }: Props = $props();

  const importedAt = $derived(result?.importedAt ?? null);

  /**
   * The answer, held WITH the dataset it answers for.
   *
   * `$state.raw` and stamped, not reset: a replace lands as a new `importedAt`,
   * the derived state below then reads this as "no answer for what is on
   * screen", and the block returns to `loading` by construction rather than
   * through a hand-written clear that a future code path could forget.
   */
  let shown = $state.raw<ShownBlock<CurrencyView> | null>(null);

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'currency' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'currency', wanted, importedAt);
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

  const view = $derived<CurrencyView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  const readyView = $derived(view?.status === 'ready' ? view : null);

  /**
   * The states that still carry an excluded count, and therefore a pill.
   *
   * `ready` and `no-usable` and nothing else: the two empty states are claims
   * about a file that was absent or held no rows at all, and a pill there would
   * report exclusions that cannot have happened. `no-usable` DOES show one,
   * because "every row was dropped" and "some rows were dropped" are the same
   * fact at two magnitudes (D-02).
   */
  const excludedView = $derived(
    view !== null && (view.status === 'ready' || view.status === 'no-usable') ? view : null,
  );

  /**
   * Which charts' monthly tables are open, by chart index.
   *
   * A sparse array rather than one flag, because these are eight independent
   * disclosures: one reader comparing two months of gold has no reason to have
   * opened the credits table, and a shared flag would open it for them.
   */
  let tableOpen = $state<boolean[]>([]);

  const noRowsText = formatFinancialNoRows('currency');

  /**
   * The code a reader sees, and the code the `data-currency` attribute carries.
   *
   * One function for both, because the two must never disagree: a heading that
   * said `(not recorded)` under an attribute saying `''` would make the
   * attribute useless for the test that reads it, and the reverse would make a
   * heading misleading. A `null` code is the blank-code group and is NEVER
   * rendered as an empty string, which would read as a broken row (D-16).
   */
  function codeText(code: string | null): string {
    return code ?? CURRENCY_BLANK_CODE;
  }

  /**
   * Whether a title earns its own caption.
   *
   * Non-blank, and different from the code. The export leaves some codes
   * untitled, and a caption reading `ru.wot.credits` under a heading reading
   * `ru.wot.credits` is noise that pushes the summary sentence down a line.
   */
  function titleFor(entry: CurrencyEntry): string | null {
    const title = entry.title?.trim() ?? '';
    if (title === '' || title === codeText(entry.code)) return null;
    return title;
  }

  /** One chart's whole derived set, keyed by its index rather than its code. */
  interface ChartView {
    entry: CurrencyEntry;
    code: string;
    title: string | null;
    model: ReturnType<typeof buildBarChartModel>;
    yTop: { text: string; exact: string };
    yBottom: { text: string; exact: string };
    summary: string;
    months: SvelteMap<number, CurrencyMonth>;
    /** The monthly table's rows, newest first, over every DRAWN month. */
    tableRows: readonly (readonly string[])[];
  }

  /**
   * Every charted currency, in the view's order — operation count descending
   * (D-15), which is the order the worker's `charts` array already holds.
   *
   * Built ONCE per answer rather than per render branch, because each entry
   * needs a month lookup for its cells, its tooltip and its table, and a
   * `Map` per chart is the only structure that answers "is this drawn month
   * empty?" without a scan. `SvelteMap` is what makes the derived value
   * recompute when the answer is replaced rather than when a cell is read.
   */
  const charts = $derived.by((): ChartView[] => {
    if (readyView === null) return [];
    return readyView.charts.map((entry) => {
      const { input, domainUpUnits, domainDownUnits } = currencyChartInput(entry);
      const model = buildBarChartModel(input);
      const months = new SvelteMap<number, CurrencyMonth>();
      for (const month of entry.months) {
        months.set(month.month, month);
      }
      // The axis is labelled from the EXACT extents, not from the model's
      // floats. Two reasons, and both are D-25.
      //
      // The first is compactness: a top extent of 1,029,000 units prints as
      // `1M`, so the `<title>` beside it has to carry the real figure or the
      // axis states a number the chart does not have.
      //
      // The second is that the plot is DIVIDED between the two directions
      // rather than split evenly, so the axis has two extents and they are not
      // always the same figure: a currency that only ever received money still
      // has a bottom extent, a quarter of its largest deposit, and the label
      // must name THAT — the value at the hairline the label sits against —
      // rather than a zero the plot does not have (05-21).
      const upText = formatCompactNumber(unitsToNumber(domainUpUnits));
      // Negated as a bigint, so an empty side reads `0` and not `-0`.
      const downExact = -domainDownUnits;
      const downText = formatCompactNumber(unitsToNumber(downExact));
      return {
        entry,
        code: codeText(entry.code),
        title: titleFor(entry),
        model,
        yTop: { text: upText, exact: formatFlowAmount(domainUpUnits) },
        yBottom: { text: downText, exact: formatFlowAmount(downExact) },
        summary: formatCurrencySummary({
          inUnits: BigInt(entry.inUnits || '0'),
          outUnits: BigInt(entry.outUnits || '0'),
          ops: entry.ops,
          firstMonth: entry.firstMonth,
          lastMonth: entry.lastMonth,
        }),
        months,
        // One row per DRAWN month, newest first. The list is the model's
        // `cells` reversed rather than the worker's sparse months, so a gap is
        // a row of zeros in the table exactly as it is an empty column in the
        // chart — the two must not disagree about how many months there were.
        tableRows: [...model.cells].reverse().map((cell) => {
          const found = months.get(cell.month);
          const inOps = found?.inOps ?? 0;
          const outOps = found?.outOps ?? 0;
          return [
            formatMonthLabel(cell.month),
            formatFlowAmount(BigInt(found?.inUnits ?? '0')),
            formatFlowAmount(BigInt(found?.outUnits ?? '0')),
            formatNumber(inOps + outOps),
          ];
        }),
      };
    });
  });

  /**
   * One month of a chart, as the tooltip, the cell label and the table read it.
   *
   * An ABSENT month is a real month with nothing in it, so every field is zero
   * rather than the entry's total: the sparse map is a lookup, and a miss is
   * the `No operations` case `formatCurrencyTooltip` and
   * `formatCurrencyCellLabel` both already have a form for.
   */
  function monthFigure(chart: ChartView, monthIndex: number): CurrencyMonthFigure {
    const found = chart.months.get(monthIndex);
    return {
      month: monthIndex,
      // The exact strings cross back to `bigint` for the copy layer. A value
      // the worker wrote is always parseable (T-05-10), and the `?? '0'` is
      // here so a hand-built entry cannot make a render throw.
      inUnits: BigInt(found?.inUnits ?? '0'),
      outUnits: BigInt(found?.outUnits ?? '0'),
      inOps: found?.inOps ?? 0,
      outOps: found?.outOps ?? 0,
    };
  }
</script>

<div
  data-testid="currency-block"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  <h3>{FINANCIAL_CURRENCY_HEADING}</h3>

  {#if blockState === 'loading'}
    <p class="body" role="status">{FINANCIAL_LOADING}</p>
  {:else if blockState === 'not-in-export'}
    <p class="body">{FINANCIAL_NOT_IN_EXPORT}</p>
  {:else if blockState === 'no-rows'}
    <p class="body">{noRowsText}</p>
  {:else if blockState === 'no-usable'}
    <p class="body">{CURRENCY_NO_USABLE}</p>
  {:else if blockState === 'error'}
    <p class="body error" role="alert">{FINANCIAL_ERROR}</p>
  {:else if readyView !== null}
    <p class="caption">{CURRENCY_BLOCK_CAPTION}</p>

    <!--
      The pill goes HERE and not at the foot of the block: a reader is told how
      many operations were left out BEFORE the first chart rather than after
      eight of them, because a chart that sums to less than the block's
      operation count is otherwise a discrepancy the reader has to notice
      themselves. `formatOperationExcludedPill` returns the empty string at
      zero, so nothing is rendered for an export with no exclusions.
    -->
    <ExcludedNotice
      count={readyView.excluded}
      pill={formatOperationExcludedPill(readyView.excluded)}
      explanation={CURRENCY_EXCLUDED_EXPLANATION}
      testId="currency-excluded"
    />

    {#each charts as chart, index (index)}
      <!--
        A SECTION, not a div: these are small multiples and each one is a
        figure with its own heading, so a screen reader can list them and a
        reader can find "the gold chart" rather than "the fourth thing in the
        card". The `data-currency` attribute carries the code as WRITTEN and is
        read by tests only — no selector anywhere concatenates it into a query,
        because a code is untrusted text from a zip (T-05-39).
      -->
      <section
        class="chart-container"
        data-testid="currency-chart"
        data-currency={chart.entry.code ?? CURRENCY_BLANK_CODE}
      >
        <h4>{chart.code}</h4>
        {#if chart.title !== null}
          <!--
            Its own class, because this caption is the one the tests name: a
            chart block holds a title caption, a summary and a keyboard hint,
            and `p.caption` alone would match two of the three.
          -->
          <p class="caption title">{chart.title}</p>
        {/if}
        <p class="body">{chart.summary}</p>
        <AboutDisclosure name={ABOUT_NAME_CURRENCY} testId="about-currency-{index}">
          <p class="caption hint" id="currency-keyboard-hint-{index}">
            {BAR_CHART_KEYBOARD_HINT}
          </p>
        </AboutDisclosure>

        <MonthlyBarChart
          model={chart.model}
          chartTestId="currency-svg"
          cellTestId="currency-cell"
          ariaLabel={chart.code}
          describedBy="currency-keyboard-hint-{index}"
          cellName={(cell) =>
            formatCurrencyCellLabel(monthFigure(chart, chart.entry.firstMonth + cell))}
          cellAttrs={(cell) => {
            const month = chart.entry.firstMonth + cell;
            const figure = monthFigure(chart, month);
            return {
              'data-month': formatMonthLabel(month),
              // Plain numbers of WHOLE units, which is exact for every
              // integer amount and is what the monthly table's own figures
              // sum to. A fractional amount is not rounded here — the cell
              // carries the exact form through its accessible name and the
              // table, and the bar is measured in pixels anyway.
              'data-in': unitsToNumber(figure.inUnits),
              'data-out': unitsToNumber(figure.outUnits),
              'data-ops': figure.inOps + figure.outOps,
            };
          }}
          tip={(cell) => formatCurrencyTooltip(monthFigure(chart, chart.entry.firstMonth + cell))}
          yTop={chart.yTop}
          yBottom={chart.yBottom}
          {onTip}
        />

        <FlowLegend />

        <details data-testid="monthly-table-disclosure" bind:open={tableOpen[index]}>
          <summary>{MONTHLY_TABLE_DISCLOSURE}</summary>
          {#if tableOpen[index]}
            <MonthlyDataTable columns={CURRENCY_TABLE_HEADERS} rows={chart.tableRows} />
          {/if}
        </details>
      </section>
    {/each}

    <!--
      Every other currency, and the last thing in the block. A code the cap or
      the threshold kept out of a chart is still a code the user's account has,
      and this list is the only place they learn it exists — so it is rendered
      whenever it is non-empty and never when it is not, because an empty
      "Other currencies" heading under eight charts is a claim that there were
      more.
    -->
    {#if readyView.others.length > 0}
      <section class="other" data-testid="currency-other">
        <h4>{OTHER_CURRENCIES_HEADING}</h4>
        <p class="caption">{OTHER_CURRENCIES_CAPTION}</p>
        <ul>
          {#each readyView.others as other, otherIndex (otherIndex)}
            <!--
              The code and the figures are SEPARATE elements, not one sentence:
              a screen reader then reads the code, pauses, and reads the
              figures, and a code that reads as `(not recorded)` is announced
              as the label it is rather than as the start of a number.
            -->
            <li data-testid="currency-other-row">
              <p class="code">{codeText(other.code)}</p>
              <p class="caption">
                {formatOtherCurrencyRow({
                  code: other.code,
                  inUnits: BigInt(other.inUnits || '0'),
                  outUnits: BigInt(other.outUnits || '0'),
                  ops: other.ops,
                  firstMonth: other.firstMonth,
                  lastMonth: other.lastMonth,
                })}
              </p>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}

  <!--
    The same notice again for `no-usable`, where EVERY row was excluded. It is
    the same fact at the other magnitude, and without it the count would be
    lost the moment a user had nothing else to look at.
  -->
  {#if excludedView !== null && blockState === 'no-usable'}
    <ExcludedNotice
      count={excludedView.excluded}
      pill={formatOperationExcludedPill(excludedView.excluded)}
      explanation={CURRENCY_EXCLUDED_EXPLANATION}
      testId="currency-excluded"
    />
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  /* The Premium block's sub-heading rule, repeated: Svelte's scoped styles
     cannot be shared, and a copy that drifts should be visible in a diff. */
  h3 {
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
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

  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
    overflow-wrap: anywhere;
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

  .hint {
    margin-top: 4px;
  }

  .other {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  /* A code is LABEL, not Body: it is the name of a row, and the caption under
     it is metadata. A code can be 200 characters of clamped zip text, so it
     wraps anywhere rather than pushing the card wide. */
  .code {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  details {
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--muted);
  }

  summary {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  summary:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
