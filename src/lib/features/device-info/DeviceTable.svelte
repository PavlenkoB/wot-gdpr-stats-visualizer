<script lang="ts">
  import type { DeviceSourceId, DeviceTableView } from './device-info-shared.ts';
  import ExcludedNotice from '../../shell/ExcludedNotice.svelte';
  import {
    DEVICE_COLUMN_LABELS,
    DEVICE_FILE_LABELS,
    DEVICE_HEADINGS,
    DEVICE_NOT_REPORTED,
    DEVICE_TABLE_NOT_IN_EXPORT,
    DEVICE_UNREADABLE_EXPLANATION,
    formatDeviceFromFile,
    formatDeviceMoreRows,
    formatDeviceNoRows,
    formatDeviceNoUsable,
    formatDeviceTableLabel,
    formatDeviceUnreadablePill,
    formatMemoryFromMb,
  } from '../../ui-copy.ts';

  /**
   * One source's table (quick task 261012-bog).
   *
   * Every state is stated, never implied: a file that is not in the export, one
   * that holds no rows, one whose rows could not be read, and the table itself.
   * A `null` cell renders the muted words "not reported" so the meaning never
   * depends on colour. A number is a memory value in MB and renders in GB
   * through one formatter. Text is interpolated, never injected as markup.
   */
  interface Props {
    source: DeviceSourceId;
    table: DeviceTableView;
  }

  let { source, table }: Props = $props();

  const heading = $derived(DEVICE_HEADINGS[source]);
  const file = $derived(DEVICE_FILE_LABELS[source]);
  const labels = $derived<Record<string, string>>(DEVICE_COLUMN_LABELS[source]);
  const tableLabel = $derived(formatDeviceTableLabel(heading));
</script>

<section
  data-testid="device-info-source"
  data-source={source}
  data-status={table.status}
  aria-labelledby="device-info-heading-{source}"
>
  <h3 id="device-info-heading-{source}">{heading}</h3>
  <p class="caption">{formatDeviceFromFile(file)}</p>

  {#if table.status === 'not-in-export'}
    <p class="body" data-testid="device-info-not-in-export">{DEVICE_TABLE_NOT_IN_EXPORT}</p>
  {:else if table.status === 'no-rows'}
    <p class="body" data-testid="device-info-no-rows">{formatDeviceNoRows(file)}</p>
  {:else if table.status === 'no-usable'}
    <p class="body" data-testid="device-info-no-usable">{formatDeviceNoUsable(table.rowCount)}</p>
    <!--
      The explanation is about the Assistant blob (no device type, app, platform
      or version could be read), so it is shown for that source only. A PC or
      Blitz file with no resolvable column is already fully described by the
      sentence above, and it must not carry a blob-specific reason (PD-08).
    -->
    {#if source === 'assistant'}
      <ExcludedNotice
        count={table.unreadable}
        pill={formatDeviceUnreadablePill(table.unreadable)}
        explanation={DEVICE_UNREADABLE_EXPLANATION}
        testId="device-info-unreadable-{source}"
      />
    {/if}
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="scroller"
      data-testid="device-info-scroller"
      role="region"
      tabindex="0"
      aria-label={tableLabel}
    >
      <table data-testid="device-info-table">
        <caption class="visually-hidden">{tableLabel}</caption>
        <thead>
          <tr>
            {#each table.columns as column (column)}
              <th scope="col">{labels[column] ?? column}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each table.rows as row, rowIndex (rowIndex)}
            <tr>
              {#each row as value, cellIndex (cellIndex)}
                <td>
                  {#if value === null}
                    <span class="not-reported" data-testid="device-info-not-reported"
                      >{DEVICE_NOT_REPORTED}</span
                    >
                  {:else if typeof value === 'number'}
                    {formatMemoryFromMb(value)}
                  {:else}
                    {value}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if table.more > 0}
      <p class="caption" data-testid="device-info-more">{formatDeviceMoreRows(table.more)}</p>
    {/if}

    <ExcludedNotice
      count={table.unreadable}
      pill={formatDeviceUnreadablePill(table.unreadable)}
      explanation={DEVICE_UNREADABLE_EXPLANATION}
      testId="device-info-unreadable-{source}"
    />
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  h3 {
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
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

  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* A named, focusable horizontal scroll region: a wide table scrolls inside
     its own box and the page itself never scrolls sideways. */
  .scroller {
    position: relative;
    overflow: auto;
    max-height: 480px;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
  }

  .scroller:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    line-height: 1.4;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  th {
    position: sticky;
    top: 0;
    padding: 8px 12px;
    background: var(--list);
    color: var(--muted);
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: 8px 12px;
    color: var(--text);
    font-weight: 400;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }

  /* The not-reported word: muted ink, and it is WORDS, so the meaning never
     rests on the colour alone. */
  .not-reported {
    color: var(--muted);
  }
</style>
