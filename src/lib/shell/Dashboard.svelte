<script lang="ts">
  import { onMount, setContext, tick, type Snippet } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { SECTIONS, sectionCounts, sectionStatus, type SectionId } from './dashboard-status.ts';
  import { ingestClient } from '../import/ingest-client.ts';
  import {
    EMPTY_STATE_PRIVACY,
    PANE_TITLES,
    SECTION_NOTE_PENDING,
    SECTION_NOTE_USER_INFO,
  } from '../ui-copy.ts';
  import { CHART_ANNOUNCE_KEY } from '../charts/tooltip-pin.ts';
  import DashboardSection from './DashboardSection.svelte';
  import DetailPane from './DetailPane.svelte';
  import DeviceInfo from '../features/device-info/DeviceInfo.svelte';
  import FinancialData from '../features/finance/FinancialData.svelte';
  import ListPane from './ListPane.svelte';
  import LoginHistory from '../features/logins/LoginHistory.svelte';
  import Overview from './Overview.svelte';
  import PlayerStats from '../features/vehicles/PlayerStats.svelte';
  import Playtime from '../features/playtime/Playtime.svelte';
  import SpendSummary from '../features/finance/SpendSummary.svelte';
  import UnsupportedBlock from './UnsupportedBlock.svelte';
  import {
    DEFAULT_PANE,
    PHONE_MEDIA_QUERY,
    SIDE_BY_SIDE_MEDIA_QUERY,
    datasetStamp,
    resolvePhoneView,
    resolveSelection,
    type PaneId,
    type PhoneViewChoice,
    type SelectionChoice,
  } from './selection-state.ts';

  /**
   * The master-detail shell: the list pane on the left, the selected pane's
   * section on the right.
   *
   * This file is the composition root, and it is the ONLY place that decides
   * what a pane shows. Every status and every count comes from
   * `dashboard-status.ts`, the same pure module the list rows read through
   * `selection-state.ts`, so a row and its section cannot disagree (D-08).
   *
   * Exactly ONE pane is mounted at a time (D-01). The `{#if}` branches below are
   * the whole mechanism: no `display: none`, no hidden mount, so an unselected
   * block holds no worker query and no chart.
   *
   * `result` is the LAST KNOWN dataset rather than the current view state,
   * which is why the dashboard survives a replace, a duplicate drop and a
   * failed import: the user keeps looking at their data while the app works
   * (D-27). A `null` result is the first-visit state, where the detail pane
   * hosts the import region.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /**
     * The import region, owned by App (every import handler, the confirm panel
     * and the focus return live there). It is rendered in the detail pane while
     * nothing is loaded and at the bottom of the list pane afterwards, and is
     * never in the DOM twice.
     */
    importRegion: Snippet;
  }

  let { result, importRegion }: Props = $props();

  /**
   * The user's pane choice, stamped with the dataset it was made under (D-03).
   * Plain component state: no route, no hash, no storage.
   *
   * The reset is a pure read, not a write. A first import, a replace and a clear
   * each change `result.importedAt`, so the stamp no longer matches and
   * `resolveSelection` answers Overview; a duplicate drop or a failed replace
   * leaves the stamp alone and the selection stands (D-04). Setting state from a
   * `$derived` would throw `state_unsafe_mutation`, which is why this is not an
   * effect that resets `choice`.
   */
  let choice = $state<SelectionChoice>({ pane: DEFAULT_PANE, stamp: null });

  const active = $derived(resolveSelection(choice, result));

  /** Select a pane, and open it at the top rather than half-scrolled. */
  function select(id: PaneId): void {
    choice = { pane: id, stamp: datasetStamp(result) };
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  let list = $state<ListPane>();
  let detail = $state<DetailPane>();

  /**
   * Whether the viewport is phone width (the one 480px query), kept current by a
   * single `matchMedia` listener that is removed on teardown.
   */
  let phone = $state(false);

  onMount(() => {
    const query = window.matchMedia(PHONE_MEDIA_QUERY);
    phone = query.matches;
    const onChange = (event: MediaQueryListEvent): void => {
      phone = event.matches;
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });

  /**
   * Which phone screen the user chose, stamped with the dataset it was chosen
   * under, exactly like `choice`. `resolvePhoneView` answers `detail` while
   * nothing is loaded (the drop target lives there) and `list` after any dataset
   * change. Outside phone width the value is never read by the layout.
   */
  let viewChoice = $state<PhoneViewChoice>({ view: 'list', stamp: null });

  const view = $derived(resolvePhoneView(viewChoice, result));

  /**
   * Whether the detail pane's CONTENT exists. While the phone's list screen is
   * showing it does not, and that is a correctness rule rather than a saving:
   * `VehicleTable` and `LoginTable` measure their scroller's `clientHeight` once
   * at mount and again only on a window resize, so a table mounted inside a
   * `display: none` pane reads zero, windows zero rows and opens empty. The pane
   * ROOT stays in the DOM (hidden by the stylesheet) so `id="detail"` and
   * `data-pane` always exist; only what is inside it comes and goes.
   */
  const detailMounted = $derived(!(phone && view === 'list'));

  /** Show the phone's detail screen for the current dataset. */
  function openDetail(): void {
    viewChoice = { view: 'detail', stamp: datasetStamp(result) };
  }

  /**
   * Where focus goes, as small functions. There is deliberately no document or
   * window key listener here: every key is heard by the element that owns it
   * (the list's nav, the detail's root), so nothing can steal a key from a chart
   * or a field.
   */

  /**
   * A row changed the selection. A keyboard selection (j or k) changes neither
   * the phone screen nor the focus: the next key starts from the focused row.
   * A pointer selection opens the detail screen on a phone and, on any stacked
   * layout (the list above the detail), moves focus into the detail, which makes
   * the browser scroll it into view. On the side-by-side layout the detail is
   * already visible and focus stays on the row.
   */
  async function onselect(id: PaneId, how: 'pointer' | 'keyboard'): Promise<void> {
    select(id);
    if (how !== 'pointer') return;
    openDetail();
    if (phone || !window.matchMedia(SIDE_BY_SIDE_MEDIA_QUERY).matches) {
      await tick();
      detail?.focus();
    }
  }

  /** Enter (or the skip link): go into the detail, opening its screen on a phone. */
  async function onenter(): Promise<void> {
    openDetail();
    await tick();
    detail?.focus();
  }

  /**
   * An Overview card's control: select that pane, show its screen on a phone and
   * move focus into the detail (UI-SPEC: activating one selects that section in
   * the list and moves focus to its detail). The focus waits one tick so the
   * pane's content, which does not exist on the phone's list screen, is mounted
   * first.
   */
  async function openPane(id: PaneId): Promise<void> {
    select(id);
    openDetail();
    await tick();
    detail?.focus();
  }

  /** The phone's back button: the list screen, with focus on the selected row. */
  async function back(): Promise<void> {
    viewChoice = { view: 'list', stamp: datasetStamp(result) };
    await tick();
    list?.focusSelected();
  }

  /** Escape in the detail: back to the list screen on a phone, else to the selected row. */
  async function onescape(): Promise<void> {
    if (phone) {
      await back();
      return;
    }
    await tick();
    list?.focusSelected();
  }

  /**
   * The props every section shell takes, derived the way the old section loop
   * derived them: status and counts come from `dashboard-status.ts` and nowhere
   * else, and the note is the pending one except for the account section's own.
   * The heading is the pane's title; the canonical folder name travels as
   * `folder` and appears in the provenance line and the greyed sentences.
   */
  function sectionProps(id: SectionId, pane: PaneId) {
    const section = SECTIONS.find((candidate) => candidate.id === id)!;
    return {
      id,
      title: PANE_TITLES[pane],
      folder: section.folder,
      status: sectionStatus(id, result),
      counts: sectionCounts(section.folder, result),
      note: id === 'user-info' ? SECTION_NOTE_USER_INFO : SECTION_NOTE_PENDING,
    };
  }

  /**
   * The text the charts' touch announcements currently hold, and the one
   * function that puts it there (07-03, D-05).
   *
   * Context rather than a prop, because the three charts that own a
   * `ChartTooltip` sit in three different blocks — the activity column, the
   * financial column and the login block — and threading one announcement
   * channel through all three as a prop chain would be three chances for a
   * block to forget it. Every one of them is already a descendant of this
   * component, which is the whole of what context asks for.
   *
   * The text is ONE rune holding one string, never an accumulating log: a live
   * region announces a CHANGE, so holding a queue would announce whatever was
   * appended last and lose the rest.
   */
  let chartAnnouncement = $state('');

  setContext(CHART_ANNOUNCE_KEY, (text: string) => {
    chartAnnouncement = text;
  });
</script>

<div class="shell" data-view={view}>
  <ListPane bind:this={list} {result} selected={active} {onselect} {onenter} {importRegion} />

  <DetailPane
    bind:this={detail}
    pane={active}
    title={PANE_TITLES[active]}
    {onescape}
    showBack={result !== null}
    onback={back}
  >
    {#if !detailMounted}
      <!-- Phone list screen: no content is mounted, see `detailMounted`. -->
    {:else if result === null}
      <!--
        Nothing loaded: the import region IS the empty state, drawn as one large
        dashed drop target with the privacy sentence under it. The wrapper is a
        plain div with no role; the Dropzone inside keeps its own test id, name
        and single instance, so this is the same import region the list pane
        takes over once a dataset is loaded.
      -->
      <div class="empty" data-testid="empty-state">
        <div class="drop-main" data-testid="dropzone-main">
          {@render importRegion()}
        </div>
        <p class="privacy">{EMPTY_STATE_PRIVACY}</p>
      </div>
    {:else if active === 'overview'}
      <Overview {result} onopen={openPane} />
    {:else if active === 'playtime'}
      <!--
        Playtime and Login history both live in Activity_history, so both render
        this section id; only one is ever mounted. The block asks the `playtime`
        channel of its own client, and superseding is per CHANNEL (05-07), so a
        remount here cannot starve any other channel.
      -->
      <DashboardSection {...sectionProps('activity-history', 'playtime')}>
        <Playtime {result} client={ingestClient.playtime} />
      </DashboardSection>
    {:else if active === 'login-history'}
      <!--
        The Login history block (06-08, ACTIVITY-05). It asks the `logins`
        channel of the same channel-scoped client the Financial and Player
        statistics blocks use, and superseding is per CHANNEL (05-07), so this
        block asking again releases only its own older question.
      -->
      <DashboardSection {...sectionProps('activity-history', 'login-history')}>
        <LoginHistory {result} client={ingestClient.data} cityClient={ingestClient.city} />
      </DashboardSection>
    {:else if active === 'vehicles'}
      <!-- The `vehicles` channel (05-12, D-05); see the note above on channels. -->
      <DashboardSection {...sectionProps('player-statistics', 'vehicles')}>
        <PlayerStats {result} client={ingestClient.data} />
      </DashboardSection>
    {:else if active === 'finance'}
      <!-- The `premium` and `currency` channels (05-10, 05-13, D-01). -->
      <DashboardSection {...sectionProps('financial-data', 'finance')}>
        <FinancialData {result} client={ingestClient.data} />
      </DashboardSection>
    {:else if active === 'payments'}
      <!-- The `spend` channel (05-15, D-21). -->
      <DashboardSection {...sectionProps('payment-history', 'payments')}>
        <SpendSummary {result} client={ingestClient.data} />
      </DashboardSection>
    {:else if active === 'device-info'}
      <!--
        The `device-info` channel (quick 261012-bog): three per-source tables
        and a counts summary, asked through the same channel-scoped client the
        finance and statistics blocks use. Superseding is per CHANNEL (05-07),
        so this block asking again releases only its own older question.
      -->
      <DashboardSection {...sectionProps('device-info', 'device-info')}>
        <DeviceInfo {result} client={ingestClient.data} />
      </DashboardSection>
    {:else if active === 'account'}
      <!-- No block of its own: the identity lives in the list pane header, so
           this section stays `pending` and shows its note (D-17). -->
      <DashboardSection {...sectionProps('user-info', 'account')} />
    {:else}
      <!-- Not yet supported: one list, one style, every non-supported folder. -->
      <UnsupportedBlock {result} />
    {/if}
  </DetailPane>
</div>

<!--
  The ONE polite region the charts' touch announcements travel through.

  It is PAGE-LEVEL and outside every block, and that placement is the point.
  The three charts that own a tooltip live in three different blocks, so a
  region inside any one of them would be a region that only exists when that
  block's data is on screen — and the Playtime block's own UI-SPEC contract
  is exactly one `aria-live` of its own, which a nested region would break.
  One region at the page's root is the only shape that serves all three
  owners without a prop to any of them.

  `aria-atomic` because both strings are one whole sentence, and there is
  never more than one thing to say at a time.

  It is rendered ONLY while a dataset is on screen. On a first visit there
  is no chart, no tooltip and nothing to say, and the page's live-region
  count is asserted at one; a region created together with its first message
  is also not announced by most screen readers, so it has to exist before it
  speaks rather than appear with its first word.
-->
{#if result !== null}
  <p
    class="chart-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-testid="chart-status"
  >
    {chartAnnouncement}
  </p>
{/if}

<style>
  /* The first-visit page has one purpose, the drop target, so it is centred in
     the pane rather than pinned to the top of a mostly empty screen. */
  .empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    min-height: 60vh;
    max-width: 640px;
    margin: 0 auto;
  }

  .drop-main {
    min-width: 0;
  }

  .privacy {
    margin: 0;
    text-align: center;
    font-size: 14px;
    line-height: 1.5;
    color: var(--muted);
  }

  /*
    The chart announcement region, visually hidden with the clip pattern —
    `position: absolute` out of the flow, a 1px box, and `clip` on top of
    `overflow: hidden`.

    NOT `display: none`, and not a zero font size: both remove the element
    from the accessibility tree or from the rendered text, and a live region
    that a screen reader cannot reach announces nothing. This is the same
    pattern `Dropzone.svelte` uses for its file input and `Playtime.svelte`
    for its status line, and the reason those two are not `display: none` is
    written out in both of their stylesheets.

    No `font-size` is declared here at all: this component's own text is
    14px everywhere else, the region has no visible text, and
    tests/unit/guards/phase5-layout-guards.test.ts scans every stylesheet for
    a declaration below that floor.
  */
  .chart-status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
