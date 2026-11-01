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
  <table class="t-note-strong" data-testid={testId}>
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

  /* The table takes the strong note role in the markup (the weight the baseline
     records for it, which the caption and the head rows inherit); `th` and `td`
     state their own weight below. */
  table {
    width: 100%;
    border-collapse: collapse;
  }

  /*
    The clip block, under its own local name. It is not the shared
    `.visually-hidden` utility: that one is named `visually-hidden`, and a clip
    block under any other name stays local (D-02). The `margin: -1px` is the
    visually-hidden idiom, and it is allowed because this rule declares `clip`.
  */
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
    padding: var(--space-8) var(--space-12);
    font-weight: var(--fw-semibold);
    color: var(--muted);
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: var(--space-8) var(--space-12);
    font-weight: var(--fw-regular);
    color: var(--text);
    border-bottom: 1px solid var(--border);
  }

  .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
