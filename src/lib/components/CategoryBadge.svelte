<script lang="ts">
  import type { CategoryEntry } from '../types/worker-messages.ts';
  import { formatFileCount } from '../ui-copy.ts';

  interface Props {
    entry: CategoryEntry;
  }

  let { entry }: Props = $props();
</script>

<!--
  One badge per category folder (D-01, D-02). The badge is plain text:
  the folder name, an em dash, and the file count. Folder names come
  from untrusted zip entries, so Svelte's text interpolation handles
  escaping (and the svelte/no-at-html-tags lint rule keeps it that way).

  The status tint is driven by a data-status attribute selector so the
  same component can be reused by Phase 3's DATA-03 "detected but not
  yet supported" banner (CONTEXT integration point). Reusable means
  free of app-state coupling: no worker-client / ingest-client imports.
-->
<li data-testid="category-badge" data-status={entry.status} class="badge badge-{entry.status}">
  <span class="badge-name">{entry.name}</span>
  <span class="badge-sep"> — </span>
  <span class="badge-count">{formatFileCount(entry.fileCount)}</span>
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
</style>
