<script lang="ts">
  import { flushSync, getContext, tick } from 'svelte';
  import { CHART_ANNOUNCE_KEY, type ChartAnnounce } from '../../charts/tooltip-pin.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import { accountCountOf } from '../../shell/identity-model.ts';
  import FailureBanner from '../../shell/FailureBanner.svelte';
  import type { PaneId } from '../../shell/selection-state.ts';
  import {
    OVERVIEW_ABSENT_PREFIX,
    OVERVIEW_ATTRIBUTION_LINK_HREF,
    OVERVIEW_ATTRIBUTION_LINK_TEXT,
    OVERVIEW_ATTRIBUTION_NOTICE,
    OVERVIEW_ATTRIBUTION_OWNER,
    OVERVIEW_ATTRIBUTION_TEXT,
    OVERVIEW_SUPPORT_LINK_HREF,
    OVERVIEW_SUPPORT_LINK_TEXT,
    OVERVIEW_EMPTY,
    OVERVIEW_ERROR,
    OVERVIEW_GROUP_HEADINGS,
    OVERVIEW_HINT,
    OVERVIEW_LEGEND_LOW,
    OVERVIEW_LEGEND_PEAK,
    OVERVIEW_LIFE_LABEL,
    OVERVIEW_LOADING,
    OVERVIEW_NEED_TEXT,
    OVERVIEW_TILE_COPY,
    PANE_TITLES,
    formatAbsentRest,
    formatGameName,
    formatGames,
    formatPinnedAnnouncement,
    formatProvenance,
    formatProvenanceRange,
    formatUnpinnedAnnouncement,
  } from '../../ui-copy.ts';
  import { OVERVIEW_TILE_DEFS } from './overview-definitions.ts';
  import { spans } from './overview-dom.ts';
  import { formatMonthYear, lifeFigure, tileFace } from './overview-format.ts';
  import { domOrder, isEmptyScreen, layoutGroups, skeletonGroups } from './overview-layout.ts';
  import type { LayoutAbsent } from './overview-layout.ts';
  import {
    anchorDelta,
    browserExpanderEnv,
    createExpander,
    runTransition,
  } from './overview-motion.ts';
  import { isNavKey, nextTileIndex, rovingIndex } from './overview-nav.ts';
  import { readPins, togglePin, writePins } from './overview-pins.ts';
  import type { OverviewScreen } from './overview-state.ts';
  import type { OverviewTileId, OverviewView } from './overview-shared.ts';
  import OverviewGroup from './OverviewGroup.svelte';
  import OverviewTile from './OverviewTile.svelte';

  /**
   * The Overview's page body (13-12, D-02, D-03, D-06, D-10, D-12, D-13).
   *
   * It turns the view, the pins and the layout into the approved screen and
   * holds no business logic of its own: which tile sits where, and how wide,
   * is decided by `layoutGroups` and `skeletonGroups`; what a tile prints is
   * decided by `tileFace`. The component only binds those results to markup.
   *
   * ## Top to bottom
   *
   * The provenance line, the hint line, the read-only Wargaming life list, the
   * groups (Pinned, Time, Tanks, Records, Totals), each with at most ONE dashed
   * row that names what its missing tiles need, and the attribution footer.
   *
   * ## Absent is never a zero
   *
   * A tile whose source is missing is not drawn. Its group says so in a single
   * dashed row, naming the source (and the column, for a column-level
   * absence). A group whose every tile is absent keeps its heading and that one
   * row.
   *
   * ## Loading and error
   *
   * Both draw the REAL layout as a skeleton (same spans, no text, hidden from
   * assistive technology), so nothing moves when the answer arrives. The error
   * shows one banner above the same frame and no values.
   *
   * ## What it does not add
   *
   * No live region (the page keeps exactly two), no storage access outside
   * `overview-pins.ts`, no inline style, no request. The attribution link is an
   * ordinary anchor: it causes no request until it is clicked.
   */
  interface Props {
    /** The last known dataset; supplies the account folders and their games. */
    result: ClassifyResult | null;
    /** The accepted view, or null while loading and on error. */
    view: OverviewView | null;
    /** Which of the three screens to draw. */
    screen: OverviewScreen;
    /** A tile's link into its full pane. */
    onopen: (pane: PaneId) => void;
  }

  let { result, view, screen, onopen }: Props = $props();

  /** Read once at start; written only by an explicit pin or unpin. */
  let pins = $state<OverviewTileId[]>(readPins());

  /** The open tiles. Replaced, never mutated in place. */
  let openIds = $state<readonly string[]>([]);

  /** The last focused tile: the grid's one tab stop. */
  let rovingId = $state<string | null>(null);

  /** The groups container, for the tile rectangles. */
  let groupsEl = $state<HTMLElement | null>(null);

  /**
   * The page-level announcer the Dashboard provides: the Overview adds NO live
   * region of its own, the page keeps exactly two.
   */
  const announce = getContext<ChartAnnounce | undefined>(CHART_ANNOUNCE_KEY);

  const ready = $derived(screen === 'ready' && view !== null);

  const groups = $derived(
    view !== null && screen === 'ready' ? layoutGroups(view, OVERVIEW_TILE_DEFS, pins) : [],
  );

  const frame = $derived(screen === 'ready' ? [] : skeletonGroups(OVERVIEW_TILE_DEFS, pins));

  const order = $derived(domOrder(groups));
  const tabStop = $derived(order[rovingIndex(order, rovingId)] ?? null);

  const empty = $derived(view !== null && screen === 'ready' && isEmptyScreen(view));

  // ---------------------------------------------------------------------------
  // Provenance and the life list
  // ---------------------------------------------------------------------------

  /** The games each account folder holds. */
  const accountGames = $derived((result?.accounts ?? []).flatMap((account) => account.games));

  /** Every game present anywhere, ascending by token (code-unit order). */
  const gameTokens = $derived(
    [...new Set([...(view?.life.map((entry) => entry.game) ?? []), ...accountGames])].sort(),
  );

  const provenance = $derived.by(() => {
    if (screen === 'loading') return OVERVIEW_LOADING;
    const range =
      view !== null && view.firstDay !== null && view.lastDay !== null
        ? formatProvenanceRange(formatMonthYear(view.firstDay), formatMonthYear(view.lastDay))
        : null;
    return formatProvenance(accountCountOf(result), formatGames(gameTokens), range);
  });

  const life = $derived(
    view === null || screen !== 'ready'
      ? []
      : gameTokens.map((token) => ({
          token,
          seconds: view.life.find((entry) => entry.game === token)?.seconds ?? null,
        })),
  );

  // ---------------------------------------------------------------------------
  // The absent row
  // ---------------------------------------------------------------------------

  /** The need of one absent entry, with the missing column when it names one. */
  function needText(entry: LayoutAbsent): string {
    const text = OVERVIEW_NEED_TEXT[entry.need];
    return entry.column === null ? text : `${text} (${entry.column})`;
  }

  /** The tail of a group's absent row: the tile names and the distinct needs. */
  function absentRest(entries: readonly LayoutAbsent[]): string {
    const labels = entries.map((entry) => OVERVIEW_TILE_COPY[entry.id].label);
    const needs = [...new Set(entries.map(needText))];
    return formatAbsentRest(labels, needs);
  }

  // ---------------------------------------------------------------------------
  // Interaction (D-14, D-16)
  // ---------------------------------------------------------------------------

  /** A tile's wrapper (the element that carries the spans and the name). */
  function wrapperOf(id: string): HTMLElement | null {
    return groupsEl?.querySelector<HTMLElement>(`div[data-tile-id="${id}"]`) ?? null;
  }

  /** A tile's face button, or its star. */
  function controlOf(id: string, kind: 'face' | 'star'): HTMLElement | null {
    const testId = kind === 'face' ? 'ov-tile-button-' : 'ov-star-';
    return groupsEl?.querySelector<HTMLElement>(`[data-testid="${testId}${id}"]`) ?? null;
  }

  /** Where each tile was when its change was requested, for scroll anchoring. */
  let anchors: { id: string; top: number }[] = [];

  /**
   * Apply a tile's wanted state. The DOM is brought up to date at once, so the
   * tile can be measured again and the page scrolled by whatever it moved.
   */
  function commit(id: string, open: boolean): void {
    const present = openIds.includes(id);
    if (open && !present) openIds = [...openIds, id];
    if (!open && present) openIds = openIds.filter((entry) => entry !== id);
    flushSync();

    const before = anchors.find((anchor) => anchor.id === id)?.top;
    anchors = anchors.filter((anchor) => anchor.id !== id);
    const wrapper = wrapperOf(id);
    if (before === undefined || wrapper === null) return;
    const delta = anchorDelta(before, wrapper.getBoundingClientRect().top);
    if (delta !== 0) window.scrollBy(0, delta);
  }

  const env = browserExpanderEnv(flushSync);
  const expander = createExpander(env, commit);

  /** Ask for a tile to open or close. The wanted state is recorded at once. */
  function request(id: string, open: boolean): void {
    const top = wrapperOf(id)?.getBoundingClientRect().top;
    anchors = [
      ...anchors.filter((anchor) => anchor.id !== id),
      ...(top === undefined ? [] : [{ id, top }]),
    ];
    expander.request(id, open);
  }

  /**
   * Pin or unpin a tile. The ONLY place pins are written.
   *
   * The change runs through a view transition when the browser allows it, and
   * a tile that moves between two group blocks is RE-CREATED, so focus is
   * restored by id once the new node exists.
   *
   * The next list is derived INSIDE the update closure, from the pins as they
   * are when the update runs. A view transition runs its update callback
   * later (after the browser captures the old state, or at the fallback), so a
   * list derived before the transition would be stale for a second pin or
   * unpin issued in that window and would overwrite the first one, in the page
   * and in storage. The update runs at most once (`runTransition`), so the
   * write and the announcement happen exactly once per toggle.
   */
  function togglePinFor(id: OverviewTileId, origin: 'face' | 'star'): void {
    const label = OVERVIEW_TILE_COPY[id].label;
    runTransition(
      env,
      () => {
        const next = togglePin(pins, id);
        pins = next;
        writePins(next);
        announce?.(
          next.includes(id)
            ? formatPinnedAnnouncement(label, next.length)
            : formatUnpinnedAnnouncement(label, next.length),
        );
      },
      () => void restoreFocus(id, origin),
    );
  }

  async function restoreFocus(id: string, origin: 'face' | 'star'): Promise<void> {
    await tick();
    rovingId = id;
    (controlOf(id, origin) ?? controlOf(id, 'face'))?.focus();
  }

  /** The tile a key event came from: its id, and whether a face or star holds focus. */
  function tileOf(event: Event): { id: string; control: 'face' | 'star' | 'other' } | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const wrapper = target.closest('[data-tile-id]');
    const id = wrapper?.getAttribute('data-tile-id') ?? null;
    if (id === null) return null;
    if (target.closest('[data-testid^="ov-tile-button-"]') !== null) return { id, control: 'face' };
    if (target.closest('[data-testid^="ov-star-"]') !== null) return { id, control: 'star' };
    return { id, control: 'other' };
  }

  /** Browsers fire no focus events in an unfocused document: set the stop, then focus. */
  function focusTile(id: string): void {
    rovingId = id;
    controlOf(id, 'face')?.focus();
  }

  function onfocusin(event: FocusEvent): void {
    const hit = tileOf(event);
    if (hit !== null && hit.control === 'face') rovingId = hit.id;
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const hit = tileOf(event);
    if (hit === null) return;

    if (event.key === 'Escape') {
      // An open tile closes and keeps the key; a closed one lets it reach the pane.
      if (!expander.wanted(hit.id)) return;
      event.preventDefault();
      request(hit.id, false);
      focusTile(hit.id);
      return;
    }

    if (hit.control === 'other') return;

    if (isNavKey(event.key)) {
      const ids = order;
      const rects = ids.map((id) => wrapperOf(id)?.getBoundingClientRect());
      if (rects.some((rect) => rect === undefined)) return;
      const next = nextTileIndex(
        event.key,
        ids.indexOf(hit.id as OverviewTileId),
        rects as DOMRect[],
      );
      event.preventDefault();
      if (next !== null) focusTile(ids[next]);
      return;
    }

    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      togglePinFor(hit.id as OverviewTileId, hit.control);
    }
  }
</script>

<div class="bento" data-testid="ov-bento" aria-busy={screen === 'loading' ? 'true' : 'false'}>
  <div class="lead">
    <p class="t-caption note" data-testid="ov-provenance">{provenance}</p>
    <p class="t-caption note" data-testid="ov-hint">{OVERVIEW_HINT}</p>
  </div>

  {#if screen === 'error'}
    <FailureBanner message={OVERVIEW_ERROR} />
  {/if}

  {#if empty}
    <p class="t-body statement" data-testid="ov-empty">{OVERVIEW_EMPTY}</p>
  {/if}

  {#if life.length > 0}
    <div class="life" data-testid="ov-life">
      <p class="t-label label">{OVERVIEW_LIFE_LABEL}</p>
      <dl class="games">
        {#each life as game (game.token)}
          <div class="t-body game" data-testid="ov-life-{game.token}">
            <dt>{formatGameName(game.token)}</dt>
            <dd>
              {lifeFigure(game.seconds)}
            </dd>
          </div>
        {/each}
      </dl>
    </div>
  {/if}

  {#if ready && view !== null}
    <!-- The groups hold no role of their own; the handlers only hear keys and focus
         that come from the tile controls inside them. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="groups" bind:this={groupsEl} {onfocusin} {onkeydown}>
      {#each groups as group (group.id)}
        <OverviewGroup
          id={group.id}
          heading={OVERVIEW_GROUP_HEADINGS[group.id]}
          legend={group.legend}
          low={OVERVIEW_LEGEND_LOW}
          peak={OVERVIEW_LEGEND_PEAK}
        >
          {#each group.tiles as entry, index (entry.tile.id)}
            <OverviewTile
              tile={entry.tile}
              def={entry.def}
              face={tileFace(entry.tile)}
              label={OVERVIEW_TILE_COPY[entry.tile.id].label}
              groupId={group.id}
              pinned={pins.includes(entry.tile.id)}
              open={openIds.includes(entry.tile.id)}
              tabbable={entry.tile.id === tabStop}
              spans={group.spans[index]}
              paneTitle={PANE_TITLES[entry.def.pane]}
              onToggle={() => request(entry.tile.id, !expander.wanted(entry.tile.id))}
              onPin={() => togglePinFor(entry.tile.id, 'star')}
              onOpen={() => onopen(entry.def.pane)}
            />
          {/each}
          {#snippet absent()}
            {#if group.absent.length > 0}
              <p class="t-body absent" data-testid="ov-absent-{group.id}">
                <span class="absent-prefix">{OVERVIEW_ABSENT_PREFIX}</span>{absentRest(
                  group.absent,
                )}
              </p>
            {/if}
          {/snippet}
        </OverviewGroup>
      {/each}
    </div>

    <p class="t-caption note attribution" data-testid="ov-attribution">
      {OVERVIEW_ATTRIBUTION_TEXT}
      {OVERVIEW_ATTRIBUTION_NOTICE}
      <a
        href={OVERVIEW_ATTRIBUTION_LINK_HREF}
        target="_blank"
        rel="noreferrer noopener"
        data-testid="ov-attribution-link">{OVERVIEW_ATTRIBUTION_LINK_TEXT}</a
      >
      {OVERVIEW_ATTRIBUTION_OWNER}
      <a
        href={OVERVIEW_SUPPORT_LINK_HREF}
        target="_blank"
        rel="noreferrer noopener"
        data-testid="ov-support-link">{OVERVIEW_SUPPORT_LINK_TEXT}</a
      >
    </p>
  {:else}
    <div class="groups">
      {#each frame as group (group.id)}
        <OverviewGroup
          id={group.id}
          heading={OVERVIEW_GROUP_HEADINGS[group.id]}
          legend={false}
          low={OVERVIEW_LEGEND_LOW}
          peak={OVERVIEW_LEGEND_PEAK}
          busy={screen === 'loading'}
        >
          {#each group.sizes as size, index (index)}
            <div
              class="skeleton {size}"
              data-testid="ov-skeleton-tile"
              aria-hidden="true"
              use:spans={group.spans[index]}
            ></div>
          {/each}
        </OverviewGroup>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* The motion of a tile that expands or moves: a quarter of a second, and
     next to none when the reader asked for reduced motion. */
  :global(::view-transition-group(*)) {
    animation-duration: 0.26s;
    animation-timing-function: ease;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(::view-transition-group(*)) {
      animation-duration: 0.01s;
    }
  }

  /* The page body is the container the groups and tiles query: four columns
     from 880px, two from 480px, one below, by the width of THIS box and not
     the viewport. */
  .bento {
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
    min-width: 0;
    container-type: inline-size;
    font-variant-numeric: tabular-nums;
  }

  .lead {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  /* The type of the three text blocks is the shared role in the markup
     (`t-caption`, `t-body`, `t-label`); these hooks state only what a role
     never owns: the margin, the wrap and the colour. */
  .note {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--muted);
  }

  .statement {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--ink);
  }

  .label {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--muted);
  }

  /* The read-only life list: a label and one entry per game. */
  .life {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-8) var(--space-24);
    min-width: 0;
  }

  .games {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8) var(--space-24);
    margin: 0;
    min-width: 0;
  }

  .game {
    display: flex;
    gap: var(--space-8);
    align-items: baseline;
    min-width: 0;

    & dt {
      margin: 0;
      color: var(--muted);
    }

    & dd {
      margin: 0;
      color: var(--ink);
      font-weight: var(--fw-semibold);
    }
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
    min-width: 0;
  }

  /* One dashed row per group for the tiles that wait for their source. */
  .absent {
    margin: var(--space-16) 0 0;
    padding: var(--space-8) var(--space-16);
    border: 1px dashed var(--faint);
    border-radius: 8px;
    background: var(--list);
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .absent-prefix {
    font-weight: var(--fw-semibold);
  }

  .attribution {
    margin-top: var(--space-8);

    & a {
      color: var(--ink);
      text-decoration: underline;

      &:focus-visible {
        outline: 3px solid var(--focus);
        outline-offset: 2px;
      }
    }
  }

  /* The skeleton tile: the real footprint, a secondary fill, no text. */
  .skeleton {
    min-width: 0;
    min-height: 120px;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--list);
  }

  @container (max-width: 479.98px) {
    .skeleton {
      grid-column: auto;
      grid-row: auto;
    }
  }

  @container (min-width: 480px) and (max-width: 879.98px) {
    .skeleton.hero {
      grid-column: span 2;
      grid-row: span 2;
    }

    .skeleton.feat {
      grid-column: span calc(2 + var(--span2, 0));
    }

    .skeleton.met {
      grid-column: span calc(1 + var(--span2, 0));
    }
  }

  @container (min-width: 880px) {
    .skeleton.hero {
      grid-column: span calc(2 + var(--span4, 0));
      grid-row: span calc(2 + var(--rows4, 0));
    }

    .skeleton.feat {
      grid-column: span calc(2 + var(--span4, 0));
    }

    .skeleton.met {
      grid-column: span calc(1 + var(--span4, 0));
    }
  }

  @media (forced-colors: active) {
    .absent {
      border: 1px dashed CanvasText;
    }

    .skeleton {
      border: 1px solid CanvasText;
    }
  }
</style>
