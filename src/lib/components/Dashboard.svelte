<script lang="ts">
  import type { ClassifyResult } from '../types/worker-messages.ts';
  import { SECTIONS, sectionCounts, sectionStatus } from '../dashboard-status.ts';
  import { SECTION_NOTE_PENDING, SECTION_NOTE_USER_INFO, SECTION_TITLES } from '../ui-copy.ts';
  import DashboardSection from './DashboardSection.svelte';
  import DashboardNav from './DashboardNav.svelte';
  import IdentityHeader from './IdentityHeader.svelte';
  import UnsupportedBlock from './UnsupportedBlock.svelte';

  /**
   * The dashboard: the identity header, then one card per supported
   * category, in D-02 order.
   *
   * This file is the composition root, and it is the ONLY place that decides
   * what a section shows. Every status and every count comes from
   * `dashboard-status.ts`, the same pure module the sticky nav reads in
   * 03-05, so a nav link and its card cannot disagree (D-08).
   *
   * `result` is the LAST KNOWN dataset rather than the current view state,
   * which is why the dashboard survives a replace, a duplicate drop and a
   * failed import: the user keeps looking at their data while the app works
   * (D-27). A `null` result is the first-visit skeleton.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
  }

  let { result }: Props = $props();
</script>

<div class="dashboard">
  <IdentityHeader {result} />

  <!--
    The nav is a direct child of this flex column, not wrapped: sticky
    positioning is scoped to its containing block, and a wrapper would
    confine the nav to the wrapper's own (non-scrolling) box. The 24px gap
    above it is the page's lg rhythm, and the nav is the only sticky
    element — the import bar scrolls away (D-01).
  -->
  <DashboardNav {result} />

  <!--
    Phases 4 to 6 EXTEND THIS FILE and nothing else: each passes its
    `ready` content to the matching DashboardSection as a children snippet.
    The section ids below are the anchor and nav contract, and their order
    is D-02's, not the worker's — do not re-derive either from the result.
  -->
  <div class="sections">
    {#each SECTIONS as section (section.id)}
      <DashboardSection
        id={section.id}
        title={SECTION_TITLES[section.id]}
        status={sectionStatus(section.id, result)}
        counts={sectionCounts(section.folder, result)}
        note={section.id === 'user-info' ? SECTION_NOTE_USER_INFO : SECTION_NOTE_PENDING}
      />
    {/each}

    <!--
      The block is last, and it is a sibling of the four cards rather than a
      special branch: it owns the fifth anchor id, renders through the same
      shell, and lists every folder the worker reported as non-supported
      from ONE list with no per-tier field (D-22, DATA-03).
    -->
    <UnsupportedBlock {result} />
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
</style>
