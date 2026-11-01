<script lang="ts">
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { unsupportedEntries, unsupportedSectionStatus } from './dashboard-status.ts';
  import {
    SECTION_TITLES,
    UNSUPPORTED_BANNER_SUFFIX,
    UNSUPPORTED_INTRO,
    UNSUPPORTED_NONE_DETECTED,
  } from '../ui-copy.ts';
  import DashboardSection from './DashboardSection.svelte';
  import ImportSummary from './ImportSummary.svelte';

  /**
   * The "Not yet supported" block (D-22, DATA-03).
   *
   * It renders through the SAME section shell as the four supported
   * categories rather than as a special case, so it carries the same anchor
   * id, the same status vocabulary and the same card geometry — which is
   * what lets the sticky nav treat it as a fifth link.
   *
   * The one rule this component exists to enforce: **every non-supported
   * folder gets the same banner.** A `known-deferred` folder and an
   * `unknown` one are rendered from one list, with one template, one
   * sentence and one style. There is deliberately no per-tier branch and no
   * `data-status` selector anywhere in the stylesheet; the attribute is
   * emitted for tests only. Telling a user which folders are "planned"
   * would be a roadmap promise this project has not made, and a colour or
   * wording difference would let them infer one anyway.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
  }

  let { result }: Props = $props();

  /** `not-loaded`, `empty` (nothing to list) or `ready` (banners to show). */
  const status = $derived(unsupportedSectionStatus(result));

  /** The folders, in the worker's order. Empty until an export is loaded. */
  const entries = $derived(unsupportedEntries(result));
</script>

<!--
  The block's own greyed state gets its own sentence: the shared default
  would read "This export contains no rows for Not yet supported", which is
  nonsense — the block is not a folder and it is not out of rows. It is
  greyed precisely because there is nothing here to list.
-->
<DashboardSection
  id="not-yet-supported"
  title={SECTION_TITLES['not-yet-supported']}
  {status}
  counts={null}
  statusText={status === 'empty' ? UNSUPPORTED_NONE_DETECTED : undefined}
>
  <p class="intro">{UNSUPPORTED_INTRO}</p>
  <!-- No bullets: each banner is a full-width card, and a bullet would
       read as a nested list item rather than a standalone statement.
       There is no inner scroll region — a user must be able to scroll the
       whole page and see every folder their export contains. -->
  <ul class="banners">
    {#each entries as entry (entry.name)}
      <li class="banner" data-testid="unsupported-banner" data-status={entry.status}>
        <p class="banner-line">
          <!-- The folder name is an untrusted zip-entry string. It is
               interpolated as text, wraps, and is never truncated: a user
               needs the real name to look it up in their own archive. -->
          <span class="banner-folder t-note-strong" data-testid="banner-folder">{entry.name}</span>
          <span class="banner-suffix">{UNSUPPORTED_BANNER_SUFFIX}</span>
        </p>
        <ImportSummary
          counts={{
            fileCount: entry.fileCount,
            rowCount: entry.rowCount ?? 0,
            skippedRowCount: entry.skippedRowCount ?? 0,
          }}
          variant="banner"
        />
      </li>
    {/each}
  </ul>
</DashboardSection>

<style>
  .intro {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    color: var(--text);
  }

  .banners {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /*
    The one banner style. Note what is NOT here: no rule keys off the
    element's `data-status`, so a known-deferred folder and an unknown one
    cannot drift apart without someone writing a new selector on purpose.

    The neutral-info palette is a deliberate choice, not a default: it is
    the same surface the app uses for its own informational notices, which
    is exactly what these are — "we found this, we are not showing it".
  */
  .banner {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-12) var(--space-16);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--list);
    color: var(--text);
    min-width: 0;
  }

  .banner-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-4);
    margin: 0;
    min-width: 0;
  }

  /* The type comes from the strong-note role (the folder name is what the
     user scans the block for); this rule keeps only the wrap. */
  .banner-folder {
    overflow-wrap: anywhere;
    min-width: 0;
  }

  /* Body role: the suffix is a sentence, not a label. */
  .banner-suffix {
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    overflow-wrap: anywhere;
    min-width: 0;
  }
</style>
