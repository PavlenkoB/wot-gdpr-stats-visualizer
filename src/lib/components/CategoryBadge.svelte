<script lang="ts">
  import type { CategoryEntry } from '../types/worker-messages.ts';
  import { formatFileCount, formatRowCount, formatSkippedRowCount } from '../ui-copy.ts';

  interface Props {
    entry: CategoryEntry;
  }

  let { entry }: Props = $props();
</script>

<!--
  One badge per category folder (D-01, D-02, D-04, D-05, D-09). The
  badge is plain text: the folder name, an em dash, the file count
  followed by a comma and the row count (D-05: every category shows
  BOTH counts, never just one), and — when at least one row was
  skipped — an additional skip-count tag (D-04). Folder names come
  from untrusted zip entries, so Svelte's text interpolation handles
  escaping (and the svelte/no-at-html-tags lint rule keeps it that
  way).

  Example rendered text: "Activity_history — 2 files, 2 rows, 1 row
  skipped" (the skipped tag only appears when applicable).

  The status tint is driven by a data-status attribute selector so the
  same component can be reused by Phase 3's DATA-03 "detected but not
  yet supported" banner (CONTEXT integration point). Reusable means
  free of app-state coupling: no worker-client / ingest-client imports.

  `rowCount` / `skippedRowCount` are optional on CategoryEntry
  (pre-parse / synthetic ClassifyResult objects may not have them);
  we default rowCount to 0 so the badge never renders a blank "0
  rows" segment. The skip-count tag is conditional on
  `skippedRowCount > 0` so it does not appear on a category with no
  skips at all (prohibition: "never show '0 rows skipped'").
-->
<li data-testid="category-badge" data-status={entry.status} class="badge badge-{entry.status}">
  <span class="badge-name">{entry.name}</span>
  <span class="badge-sep"> — </span>
  <span class="badge-count"
    >{formatFileCount(entry.fileCount)}, {formatRowCount(entry.rowCount ?? 0)}</span
  >{#if entry.skippedRowCount && entry.skippedRowCount > 0}<span
      class="badge-skipped"
      data-testid="badge-skipped-count">{formatSkippedRowCount(entry.skippedRowCount)}</span
    >{/if}
</li>

<style>
  /* Pill shape — rounded, inline-flex, small padding. Tints come from
     attribute selectors keyed off `data-status`, so the same class
     works for every status without an if/else. */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid;
    border-radius: 999px;
    font-size: 14px;
    line-height: 1.4;
    list-style: none;
  }

  .badge-name {
    font-weight: 600;
  }

  .badge-sep {
    opacity: 0.7;
  }

  /* supported — green */
  .badge-supported {
    background: #e6f4ea;
    border-color: #34a853;
    color: #0d652d;
  }

  /* known-deferred — amber */
  .badge-known-deferred {
    background: #fef7e0;
    border-color: #f9ab00;
    color: #8a5a00;
  }

  /* unknown — grey */
  .badge-unknown {
    background: #f1f3f4;
    border-color: #80868b;
    color: #3c4043;
  }

  /* D-04 skip-count tag — Caution/amber, distinct from the
     per-category status tint (so a known-deferred category's skip
     count is still recognisable as a separate signal). Lives inside
     the existing flex-wrap badge-list container (D-09 overflow
     rule). */
  .badge-skipped {
    margin-left: 6px;
    padding: 1px 8px;
    border: 1px solid #f9ab00;
    border-radius: 999px;
    background: #fef7e0;
    color: #8a5a00;
    font-size: 13px;
    font-weight: 600;
  }
</style>
