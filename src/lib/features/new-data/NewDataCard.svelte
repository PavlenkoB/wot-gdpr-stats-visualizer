<script lang="ts">
  import type { Snippet } from 'svelte';
  import AccountTag from '../../shell/AccountTag.svelte';
  import { tagLabel, type AccountTagModel } from '../../shell/identity-model.ts';
  import {
    DEVICE_TABLE_NOT_IN_EXPORT,
    formatDeviceFromFile,
    formatDeviceNoRows,
    formatNewDataColumnLabel,
    formatNewDataSkipped,
  } from '../../ui-copy.ts';
  import NewDataTable from './NewDataTable.svelte';
  import { formatNewDataCell } from './new-data-cell.ts';
  import type { NewDataCardView, NewDataRowView } from './new-data-shared.ts';
  import { firstRowPerAccount } from './new-data-state.ts';

  /**
   * One card of a new-game pane (plan 11-08, D-09, UI-SPEC "Card anatomy").
   *
   * A card is exactly ONE of four states, each with its own sentence and a
   * `data-status` attribute, and it never reorders or disappears when a sibling
   * is empty:
   *
   *   - `not-in-export`: the file is not in the archive; no caption, because
   *     there is no file to name;
   *   - `no-rows`: the file is there and holds no rows;
   *   - `skipped`: the file is there and none of its columns are ones this viewer
   *     reads (D-09). A dashed card whose caption names the file. The import
   *     succeeded: this is information, not a failure, so there is no banner and
   *     no error wording;
   *   - `ready`: the table, or one `dl` block per account.
   *
   * ## What the card is given and what it never sees
   *
   * `file` is a DISPLAY LABEL the pane takes from `NEW_DATA_FILE_LABELS`, a
   * constant table keyed by record type; the card receives no zip entry name, so
   * an untrusted archive cannot put text in a caption (T-11-23). Every value is
   * interpolated as text, there is no raw-HTML directive, and the only
   * account-derived string is the visually hidden phrase inside `AccountTag`
   * (T-11-26, T-11-27).
   */
  interface Props {
    /** The card's title (the pane takes it from a constant title table). */
    title: string;
    /** The file's display label, from `NEW_DATA_FILE_LABELS`. */
    file: string;
    /** The card's state and, when ready, its columns and ordered rows. */
    view: NewDataCardView;
    /** The card's test id, set by the pane. */
    testId: string;
    /** A table of rows, or one `dl` block per account built from its first row. */
    layout?: 'table' | 'blocks';
    /** The lower-cased record type, keying the column headings. */
    fileKey: string;
    /** The account tags, or `null` for a single-account dataset. */
    tags: ReadonlyMap<string, AccountTagModel> | null;
    /** The single global IP reveal. */
    revealed: boolean;
    /** The id of the column shown as `Battle type {code}`, or null. */
    battleTypeColumnId: string | null;
    /** Content under the caption (the geolocation note and the mask toggle). */
    header?: Snippet;
    /** Whether a row may carry several account tags (a merged row); forwarded to the table. */
    severalTags?: boolean;
  }

  let {
    title,
    file,
    view,
    testId,
    layout = 'table',
    fileKey,
    tags,
    revealed,
    battleTypeColumnId,
    header,
    severalTags = false,
  }: Props = $props();

  /** The first row of each account, for the `blocks` layout; empty unless ready. */
  const blocks = $derived(view.status === 'ready' ? firstRowPerAccount(view.rows) : []);

  /** The tag for one row; `null` for one account or a root the map does not hold. */
  function tagOf(row: NewDataRowView): AccountTagModel | null {
    return tags === null ? null : (tags.get(row.account) ?? null);
  }
</script>

<section
  class="card"
  class:skipped={view.status === 'skipped'}
  data-testid={testId}
  data-status={view.status}
  aria-labelledby="{testId}-title"
>
  <h3 id="{testId}-title" class="t-note-strong">{title}</h3>
  {#if view.status !== 'not-in-export'}
    <p class="muted-note under-title">{formatDeviceFromFile(file)}</p>
  {/if}
  {@render header?.()}

  {#if view.status === 'not-in-export'}
    <p class="body">{DEVICE_TABLE_NOT_IN_EXPORT}</p>
  {:else if view.status === 'no-rows'}
    <p class="body">{formatDeviceNoRows(file)}</p>
  {:else if view.status === 'skipped'}
    <p class="body" data-testid="new-data-skipped">{formatNewDataSkipped(file)}</p>
  {:else if layout === 'blocks'}
    {#each blocks as block, blockIndex (blockIndex)}
      <div class="block">
        {#if tagOf(block) !== null}
          <p class="tag-line">
            <AccountTag letter={tagOf(block)!.letter} label={tagLabel(tagOf(block)!)} />
          </p>
        {/if}
        <dl>
          {#each view.columns as column, columnIndex (columnIndex)}
            {@const cell = formatNewDataCell(block.cells[columnIndex], column, {
              revealed,
              battleTypeColumnId,
            })}
            <dt class="t-note-strong">{formatNewDataColumnLabel(fileKey, column.id)}</dt>
            <dd>
              {#if cell.muted}
                <span class="not-reported">{cell.text}</span>
              {:else}
                {cell.text}
              {/if}
            </dd>
          {/each}
        </dl>
      </div>
    {/each}
  {:else}
    <NewDataTable
      columns={view.columns}
      rows={view.rows}
      {fileKey}
      tableLabel={title}
      {tags}
      {revealed}
      {battleTypeColumnId}
      {severalTags}
    />
  {/if}
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
    padding: var(--space-16);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--page);

    /* D-09: a file that is in the export but that this viewer reads none of. The
       same dashed language as the shell's unavailable panels; the sentence carries
       the meaning, colour never does. */
    &.skipped {
      border: 1px dashed var(--faint);
      background: var(--list);
    }
  }

  h3 {
    margin: 0;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The caption sits 4px below the title: the card's 8px gap less 4px. The shared
     `.muted-note` in `src/styles/utilities.css` supplies the margin, the muted ink
     and the type, so this hook states the difference and nothing else. */
  .under-title {
    margin-top: calc(var(--space-4) * -1);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  /* The tag on its own line above its account's block. */
  .tag-line {
    margin: 0;
    min-width: 0;
  }

  /* The per-account statistics block: the same look as the Vehicles header. */
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-4) var(--space-16);
    margin: 0;
    min-width: 0;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    color: var(--ink);
    text-align: right;
    font-variant-numeric: tabular-nums;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The not-reported words: muted ink, and they are WORDS, so the meaning never
     rests on the colour alone. */
  .not-reported {
    color: var(--muted);
  }
</style>
