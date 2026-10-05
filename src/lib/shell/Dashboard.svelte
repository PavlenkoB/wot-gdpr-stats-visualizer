<script lang="ts">
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { SECTIONS, sectionCounts, sectionStatus } from './dashboard-status.ts';
  import { ingestClient } from '../import/ingest-client.ts';
  import { SECTION_NOTE_PENDING, SECTION_NOTE_USER_INFO, SECTION_TITLES } from '../ui-copy.ts';
  import DashboardSection from './DashboardSection.svelte';
  import DashboardNav from './DashboardNav.svelte';
  import FinancialData from '../features/finance/FinancialData.svelte';
  import IdentityHeader from './IdentityHeader.svelte';
  import LoginHistory from '../features/logins/LoginHistory.svelte';
  import Playtime from '../features/playtime/Playtime.svelte';
  import PlayerStats from '../features/vehicles/PlayerStats.svelte';
  import SpendSummary from '../features/finance/SpendSummary.svelte';
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
   * The branches below are the sections that have a `ready` body, and there
   * are two of them: the activity column and the financial column. Both hold
   * their sub-blocks in D-02's document order inside the card, and both are
   * one 24px stack rather than a wrapper the section shell has to know about.
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
          the Login history block, which is D-02's document order inside the
          card (04-UI-SPEC Page Anatomy 1). The 24px is the page's lg
          rhythm, the same gap the cards use — the sub-blocks are siblings, not
          nested cards. Plans 04-09 and 04-10 add their charts INSIDE
          PlaytimeSummary, not here, so this column does not grow.

          BOTH sub-blocks are real as of 06-08, which is why the note above no
          longer rides this card: `DashboardSection` is handed `SECTION_NOTE_PENDING`
          for every section and shows it only while the section is not `ready`,
          and Activity_history stopped being `pending` when the Playtime block
          landed in 04-02 and stopped carrying the note itself when the login
          block replaced its placeholder in 06-08.
        -->
        {#if section.id === 'activity-history'}
          <div class="activity">
            <Playtime {result} client={ingestClient.playtime} />
            <!--
              The Login history block (06-08, ACTIVITY-05). It asks the
              `logins` channel of the same channel-scoped client the Financial
              and Player statistics blocks use, and superseding is per CHANNEL
              (05-07), so this block asking again releases only its own older
              question and cannot starve any of them.
            -->
            <LoginHistory {result} client={ingestClient.data} cityClient={ingestClient.city} />
          </div>
        {:else if section.id === 'financial-data'}
          <!--
            The second `ready` section (05-10, D-01). Its own client, not the
            playtime one: `ingestClient.data` supersedes per CHANNEL, so the
            premium block asking again releases only its own older question and
            the currency block joining it in 05-13 cannot starve it (05-07's
            rule — three blocks mounting in one tick under a globally
            superseding client is the bug that rule exists to prevent).
          -->
          <FinancialData {result} client={ingestClient.data} />
        {:else if section.id === 'player-statistics'}
          <!--
            The THIRD `ready` section (05-12, D-05). It asks the `vehicles`
            channel of the same channel-scoped client the Financial blocks use,
            and superseding is per CHANNEL (05-07), so the Premium block
            asking again releases only its own older question and cannot starve
            this one.
          -->
          <PlayerStats {result} client={ingestClient.data} />
        {:else if section.id === 'payment-history'}
          <!--
            The FOURTH `ready` section (05-15, D-21). It asks the `spend`
            channel of the same channel-scoped client, and superseding is per
            CHANNEL (05-07), so this block asking again releases only its own
            older question and cannot starve the Premium, Virtual currency or
            Vehicle statistics blocks.
          -->
          <SpendSummary {result} client={ingestClient.data} />
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
