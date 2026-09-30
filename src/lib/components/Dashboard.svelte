<script lang="ts">
  import type { ClassifyResult } from '../types/worker-messages.ts';
  import { SECTIONS, sectionCounts, sectionStatus } from '../dashboard-status.ts';
  import { ingestClient } from '../ingest-client.ts';
  import { SECTION_NOTE_PENDING, SECTION_NOTE_USER_INFO, SECTION_TITLES } from '../ui-copy.ts';
  import DashboardSection from './DashboardSection.svelte';
  import DashboardNav from './DashboardNav.svelte';
  import IdentityHeader from './IdentityHeader.svelte';
  import LoginHistorySection from './LoginHistorySection.svelte';
  import Playtime from './Playtime.svelte';
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
   * The activity-history branch below is the one that grows: it is the only
   * section with a `ready` body, and it holds both of the card's sub-headings
   * in D-02's order.
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
      >
        <!--
          The `ready` body, and the only section that has one so far (04-02,
          04-08). The branch is on the id already in scope, so no id or order
          is re-derived here, and the note above still rides along: it is
          DashboardSection's to show or drop, not this snippet's business.

          The activity column is one 24px stack: the Playtime block and then
          the Login history sub-heading, which is D-02's document order inside
          the card (04-UI-SPEC Page Anatomy 1). The 24px is the page's lg
          rhythm, the same gap the cards use — the sub-blocks are siblings, not
          nested cards. Plans 04-09 and 04-10 add their charts INSIDE
          PlaytimeSummary, not here, so this column does not grow.
        -->
        {#if section.id === 'activity-history'}
          <div class="activity">
            <Playtime {result} client={ingestClient.playtime} />
            <LoginHistorySection />
          </div>
        {/if}
      </DashboardSection>
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

  /* The Activity_history card's inner column: Playtime, then Login history.
     `min-width: 0` so a long value or a wide table inside either block wraps
     instead of widening the card. */
  .activity {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
</style>
