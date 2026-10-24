<script lang="ts">
  import { onMount, setContext, tick, type Snippet } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import { SECTIONS, sectionCounts, sectionStatus, type SectionId } from './dashboard-status.ts';
  import { ingestClient } from '../import/ingest-client.ts';
  import {
    EMPTY_STATE_PRIVACY,
    NEW_DATA_PROVENANCE_LABELS,
    PANE_TITLES,
    SECTION_NOTE_PENDING,
    SECTION_NOTE_USER_INFO,
  } from '../ui-copy.ts';
  import { CHART_ANNOUNCE_KEY } from '../charts/tooltip-pin.ts';
  import DashboardSection from './DashboardSection.svelte';
  import DetailPane from './DetailPane.svelte';
  import DeviceInfo from '../features/device-info/DeviceInfo.svelte';
  import FinancialData from '../features/finance/FinancialData.svelte';
  import HeatPane from '../features/new-data/HeatPane.svelte';
  import AccountTimelinePane from '../features/account-timeline/AccountTimelinePane.svelte';
  import PerksPane from '../features/new-data/PerksPane.svelte';
  import type { NewDataPaneId } from '../features/new-data/new-data-shared.ts';
  import WarshipsStoragePane from '../features/new-data/WarshipsStoragePane.svelte';
  import ListPane from './ListPane.svelte';
  import { accountCountOf } from './identity-model.ts';
  import {
    resolveGameFilter,
    resolveVehicleTitle,
    type AnyVehicleTitle,
    type GameFilterChoice,
    type VehicleTitleChoice,
  } from './game-filter-state.ts';
  import { resolveReveal, type RevealChoice } from './reveal-state.ts';
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
   * The shared game filter, stamped with the dataset it was chosen under
   * (Phase 10, D-01/D-21) — the SAME stamped-cell pattern as `choice` above,
   * and for the same reason: a replace changes `result.importedAt`, so the stamp
   * no longer matches and `resolveGameFilter` answers All games.
   *
   * It lives here, at the composition root, rather than in a pane because TWO
   * panes read and write it: Playtime offers it as a chip row, Vehicles as its
   * existing Game select (D-04), and a cell inside either one would be gone the
   * moment the reader switched panes. It is component state and nothing else —
   * no route, no hash, no storage (T-10-04) — so a reload and a new import both
   * return it to All games by construction.
   */
  let gameChoice = $state<GameFilterChoice>({ token: null, stamp: null });

  const gameFilter = $derived(resolveGameFilter(gameChoice, datasetStamp(result)));

  /** Apply a game the reader chose, stamped with the dataset it was chosen on. */
  function setGameFilter(token: string | null): void {
    gameChoice = { token, stamp: datasetStamp(result) };
  }

  /**
   * Whether IP addresses are shown in full, stamped with the dataset the reader
   * revealed them under (11-06, D-04, D-07) — the SAME stamped-cell pattern as
   * `choice` and `gameChoice` above, and for the same reason.
   *
   * It used to be a `$state` inside Login history, and that was a cell that
   * died with the pane: switch to Playtime and back and the addresses were
   * masked again. The HEAT pane of plan 11-09 shows addresses too, and D-04 asks
   * for ONE global reveal rather than one per pane, so both read this one.
   *
   * The reset is still a pure READ, now of `resolveReveal` — a first import, a
   * replace and a Clear each change `result.importedAt`, so the stamp no longer
   * matches and the addresses are masked again. Component state and nothing
   * else: no route, no hash, no storage, so a reload starts masked by
   * construction (T-11-18).
   */
  let revealChoice = $state<RevealChoice>({ revealed: false, stamp: null });

  const revealed = $derived(resolveReveal(revealChoice, datasetStamp(result)));

  /** Reveal or re-mask, stamped with the dataset it was done on. */
  function setRevealed(next: boolean): void {
    revealChoice = { revealed: next, stamp: datasetStamp(result) };
  }

  /**
   * The Vehicles title the reader last saw, stamped with the dataset it was
   * applied under (11-06, D-06) — the third stamped cell in a row, and the
   * same pattern for the same reason.
   *
   * It has to outlive the pane because it answers a question the reader cannot
   * answer without leaving: with the filter on HEAT or WoT Console there is no
   * vehicle table for that game, and D-06 says Vehicles keeps showing the
   * title it last showed IN THIS DATASET rather than falling back to whatever
   * the worker picks. A cell inside PlayerStats would be `null` on every mount
   * and the rule would never fire.
   *
   * Stamped for the reset, like the two above: a replace or a Clear changes
   * `result.importedAt`, so `resolveVehicleTitle` answers `null` and Vehicles
   * asks the worker's own question again — which is right, because a title from
   * a previous archive is not a title this one has.
   */
  let vehicleTitleChoice = $state<VehicleTitleChoice>({ title: null, stamp: null });

  const lastVehicleTitle = $derived(resolveVehicleTitle(vehicleTitleChoice, datasetStamp(result)));

  /** Remember the title the worker APPLIED, stamped with the dataset it was on. */
  function setVehicleTitle(title: AnyVehicleTitle): void {
    vehicleTitleChoice = { title, stamp: datasetStamp(result) };
  }

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
      // D-11: every pane whose rows are merged across accounts says so. The
      // Account section is the ONE exception and gets a fixed one, because that
      // pane IS the list of accounts — "3 accounts combined" there would repeat
      // the header above it rather than qualify anything (UI-SPEC Surface 2).
      accountCount: id === 'user-info' ? 1 : accountCountOf(result),
    };
  }

  /**
   * The section props of one optional new-game pane (11-09, D-01, D-03).
   *
   * Neither pane reads a single folder, so there is no `folder` and no
   * `SECTIONS` lookup: the provenance line names the pane's source through
   * `provenanceLabel`, and the counts are the two integers the worker published
   * for it in `result.newDataPanes`. The status is `ready` even at zero rows: a
   * pane whose files are in the export but stored nothing is not a greyed panel,
   * its body shows each card's own state in words (UI-SPEC Surface 3). With no
   * facts the pane is absent, which the list never offers; the status is then
   * `no-export` and the shell's existing sentence is shown.
   */
  function newDataSectionProps(pane: NewDataPaneId) {
    const facts = result?.newDataPanes?.[pane];
    return {
      id: pane,
      title: PANE_TITLES[pane],
      provenanceLabel: NEW_DATA_PROVENANCE_LABELS[pane],
      status: facts === undefined ? ('no-export' as const) : ('ready' as const),
      counts:
        facts === undefined
          ? null
          : { fileCount: facts.fileCount, rowCount: facts.rowCount, skippedRowCount: 0 },
      accountCount: accountCountOf(result),
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
      <Overview {result} client={ingestClient.data} onopen={openPane} />
    {:else if active === 'playtime'}
      <!--
        Playtime and Login history both live in Activity_history, so both render
        this section id; only one is ever mounted. The block asks the `playtime`
        channel of its own client, and superseding is per CHANNEL (05-07), so a
        remount here cannot starve any other channel.
      -->
      <DashboardSection {...sectionProps('activity-history', 'playtime')}>
        <Playtime
          {result}
          client={ingestClient.playtime}
          {gameFilter}
          onGameFilterChange={setGameFilter}
        />
      </DashboardSection>
    {:else if active === 'login-history'}
      <!--
        The Login history block (06-08, ACTIVITY-05). It asks the `logins`
        channel of the same channel-scoped client the Financial and Player
        statistics blocks use, and superseding is per CHANNEL (05-07), so this
        block asking again releases only its own older question.
      -->
      <DashboardSection {...sectionProps('activity-history', 'login-history')}>
        <LoginHistory
          {result}
          client={ingestClient.data}
          cityClient={ingestClient.city}
          {revealed}
          onRevealChange={setRevealed}
        />
      </DashboardSection>
    {:else if active === 'vehicles'}
      <!-- The `vehicles` channel (05-12, D-05); see the note above on channels. -->
      <DashboardSection {...sectionProps('player-statistics', 'vehicles')}>
        <PlayerStats
          {result}
          client={ingestClient.data}
          {gameFilter}
          onGameFilterChange={setGameFilter}
          lastTitle={lastVehicleTitle}
          onTitleApplied={setVehicleTitle}
        />
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
    {:else if active === 'heat'}
      <!--
        The `heat` channel (11-09, D-01, D-04): four cards of HEAT records. It
        asks through the same channel-scoped client as the blocks above, and
        superseding is per CHANNEL (05-07), so a remount here cannot starve any
        other channel. It takes the shell's ONE reveal for its geolocation
        addresses and NOT the game filter: HEAT is a pane of its own (D-07).
      -->
      <DashboardSection {...newDataSectionProps('heat')}>
        <HeatPane {result} client={ingestClient.data} {revealed} onRevealChange={setRevealed} />
      </DashboardSection>
    {:else if active === 'warships-storage'}
      <!--
        The `warships-storage` channel (11-09, D-03): crews and account storage,
        two cards. Per-channel superseding as above; no reveal and no game
        filter, because the pane shows no address and is not narrowed (D-07).
      -->
      <DashboardSection {...newDataSectionProps('warships-storage')}>
        <WarshipsStoragePane {result} client={ingestClient.data} />
      </DashboardSection>
    {:else if active === 'perks'}
      <!--
        The `perks` channel (12-09, D-08, D-13): subscriptions, personal coupons,
        bonus codes and surveys, four cards. Per-channel superseding as above. It
        takes the shell's ONE reveal for its codes and the bonus-code address and
        NOT the game filter: Perks is a pane of its own (D-07).
      -->
      <DashboardSection {...newDataSectionProps('perks')}>
        <PerksPane {result} client={ingestClient.data} {revealed} onRevealChange={setRevealed} />
      </DashboardSection>
    {:else if active === 'account-timeline'}
      <!--
        The `account-timeline` channel (12-12, D-05, D-06, D-07, D-14): five
        history files as one merged chronology with a pane-local kind filter. Per-
        channel superseding as above. It takes the shell's ONE reveal for the
        addresses in bans and third parties and NOT the game filter: the timeline
        is a pane of its own (D-07).
      -->
      <DashboardSection {...newDataSectionProps('account-timeline')}>
        <AccountTimelinePane
          {result}
          client={ingestClient.data}
          {revealed}
          onRevealChange={setRevealed}
        />
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
