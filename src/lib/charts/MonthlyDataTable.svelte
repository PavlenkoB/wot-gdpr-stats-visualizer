<script lang="ts">
  interface Props {
    /** Column header strings. */
    columns: readonly string[];
    /** Row cell strings, newest first. */
    rows: readonly (readonly string[])[];
    /** Test ID for the table element. */
    testId?: string;
  }

  let { columns, rows, testId = 'monthly-table' }: Props = $props();
</script>

<div class="table-container">
  <table data-testid={testId}>
    <caption class="sr-only">Monthly data table</caption>
    <thead>
      <tr>
        {#each columns as col, i (col)}
          <th scope="col" class:numeric={i > 0}>{col}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, rIndex (rIndex)}
        <tr>
          {#each row as cell, cIndex (cIndex)}
            <td class:numeric={cIndex > 0}>{cell}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-container {
    overflow: auto;
    max-height: 320px;
    border-top: 1px solid var(--border);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    line-height: 1.4;
  }

  .sr-only {
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
    padding: 8px 12px;
    font-weight: 600;
    color: var(--muted);
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: 8px 12px;
    font-weight: 400;
    color: var(--text);
    border-bottom: 1px solid var(--border);
  }

  .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
