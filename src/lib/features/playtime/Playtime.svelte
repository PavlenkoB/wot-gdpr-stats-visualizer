<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { PlaytimeClient } from './playtime-client.ts';
  import type { ClassifyResult, PlaytimeView } from '../../core/types/worker-messages.ts';
  import type { RequestedSlice, ShownPlaytime } from './playtime-state.ts';
  import {
    ABOUT_NAME_PLAYTIME_TOTALS,
    PLAYTIME_CACHE_CLEARED,
    PLAYTIME_ERROR,
    PLAYTIME_HEADING,
    PLAYTIME_MERGE_ABOUT,
    PLAYTIME_NO_SESSION_FILE,
    PLAYTIME_NO_USABLE_SESSIONS,
    SPLIT_ALL_OPTION,
    SPLIT_COLUMN_LABELS,
    formatNoGameSessions,
    formatSplitValue,
  } from '../../ui-copy.ts';
  import {
    acceptOutcome,
    derivePlaytimeState,
    isCacheClearedElsewhere,
    selectionAnnouncement,
    splitColumnOf,
    splitValue,
    statusLine,
  } from './playtime-state.ts';
  import { effectiveSelection } from './playtime-model.ts';
  import PlaytimeSummary from './PlaytimeSummary.svelte';
  import PlaytimeCharts from './PlaytimeCharts.svelte';
  import ExcludedNotice from '../../shell/ExcludedNotice.svelte';
  import GameFilter from '../../shell/GameFilter.svelte';
  import { filterChips } from '../../shell/game-filter-state.ts';
  import { accountCountOf } from '../../shell/identity-model.ts';
  import AboutDisclosure from '../../charts/AboutDisclosure.svelte';

  /**
   * The Playtime block of the Activity_history card (04-02, grown in 04-08,
   * with the charts in 04-09).
   *
   * It is the slice of the dashboard above the charts: the six states, the
   * split selector and the totals for the slice it selects. The charts
   * themselves live in `PlaytimeCharts` below the totals, and the state machine
   * below is what they all read.
   *
   * ## No decision lives in this file
   *
   * Which state is on screen is `derivePlaytimeState`, whether an answer may
   * be shown is `acceptOutcome`, what the status line says is `statusLine`, and
   * which value the selector may hold is `effectiveSelection` (04-05). All four
   * are pure functions with unit tests, because the failures that matter here
   * are not visual: they are a previous export's numbers under a new export's
   * heading. What is left here is the DOM wiring — three cells of state, one
   * effect that starts a load, and one handler that starts another.
   *
   * ## Why `untrack`, and why the effect reads only `importedAt`
   *
   * The effect depends on the primitive `importedAt` and nothing else, so a
   * replace is the only thing that can re-run it. Without `untrack` the client
   * handle and the resolved view would be read inside the effect's own
   * tracking scope and writing `shown` would re-run the query that produced it.
   *
   * ## Why `alive` is a plain flag and not the effect's own
   *
   * A load started by the SELECT handler is not owned by the effect that
   * started the first one, so a per-effect `live` would not cover it. A load
   * that resolves after the block is gone writes into a component that no
   * longer exists, so the flag is cleared in `onMount`'s teardown — the one
   * place that runs exactly when the block leaves the page, including the
   * `clear` case, where the dataset disappears underneath it.
   *
   * ## The cache-cleared notice, and what it deliberately does not change
   *
   * `cacheCleared` is the one boolean here, and it answers a question no
   * other piece of state does: should the block SAY something, rather than
   * which state it renders. 04-14 made a dropped answer reconcile
   * `requested`, which stopped the stuck "Updating charts..." — but left the
   * drop silent, so after a second tab cleared the origin's store a selector
   * change looked like it had done nothing. This flag is the missing word,
   * and it is orthogonal to the state machine by construction: it is never
   * read by `derivePlaytimeState`, it never changes `data-state`, and
   * clearing it is a second write next to the ones the dataset effect already
   * made. The decision is `isCacheClearedElsewhere`, a pure function, so
   * "may this show?" is a matrix in a unit test rather than a condition
   * buried in a component.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The playtime query seam (D-06) — the only way this block asks for numbers. */
    client: PlaytimeClient;
    /**
     * The shared game filter (Phase 10, D-01): the applied token, or `null` for
     * All games. It is read ONLY inside the dataset effect's `untrack` and in
     * the chip handler — never as a dependency, because a filter change is a
     * NEW QUERY, not a new dataset.
     */
    gameFilter: string | null;
    /** A chip was chosen. Writes the shared filter in the shell cell. */
    onGameFilterChange: (token: string | null) => void;
  }

  let { result, client, gameFilter, onGameFilterChange }: Props = $props();

  /**
   * The control id for the label. From `$props.id()` rather than a literal so
   * two blocks on one page could not share a `for`, and so the id is generated
   * rather than hand-written.
   */
  const selectId = $props.id();

  /** The option value for "every server", which is not an index. */
  const ALL_OPTION = 'all';

  /**
   * Which dataset this block is describing. Absent before the first import
   * (`ClassifyResult.importedAt` is optional), and that is the only case where
   * there is nothing to ask about: a pre-parse classification is not a
   * dashboard, so the block stays empty instead of querying for a dataset the
   * worker has not stored.
   */
  const importedAt = $derived(result?.importedAt ?? null);

  // `raw`: a view holds two 168-cell arrays plus every session's day buckets,
  // and a deep proxy would be walked by the whole block on every write.
  let shown = $state.raw<ShownPlaytime | null>(null);
  let requested = $state.raw<RequestedSlice | null>(null);
  let announcement = $state('');
  /**
   * Whether to tell the user their cached data was cleared in another tab.
   *
   * `$state.raw` like the two above: it is one boolean, written from an
   * `await` boundary and read by one `{#if}`, so there is nothing to proxy.
   */
  let cacheCleared = $state.raw(false);

  /** False once the block is off the page. Cleared, never set, outside mount. */
  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  /**
   * Ask for one slice and show it, if it is still the slice being asked for.
   *
   * A slice is the PAIR (value index, game) since Phase 10, and both travel in
   * the ask so `acceptOutcome` stamps the answer with the QUESTION rather than
   * with anything the reply says about itself. The game is null for All games.
   *
   * The acceptance rule is `acceptOutcome`'s, and it is handed THREE facts: the
   * outcome, the ask it answers, and the dataset on screen now. The third is
   * the one a hand-written reset would forget — a replace can land while the
   * worker is reading, and then the answer is for a dashboard nobody is looking
   * at any more.
   *
   * `userInitiated` is what makes an announcement a response to the user rather
   * than a repeat of what the page already said on load. The initial load and
   * every dataset change pass false.
   */
  async function load(
    valueIndex: number | null,
    game: string | null,
    userInitiated: boolean,
  ): Promise<void> {
    const wanted = importedAt;
    if (wanted === null) return;

    const ask: RequestedSlice = { importedAt: wanted, valueIndex, game };
    const outcome = await client.query(valueIndex, game);
    if (!alive) return;

    const accepted = acceptOutcome(outcome, ask, importedAt);
    if (accepted === null) {
      // A dropped answer normally needs nothing: a newer ask has taken over,
      // or the dataset on screen is not the one this answer is for, and in
      // both cases something else owns `requested` now.
      //
      // The other rejections are not like that. `requested` is written by
      // `onSelectChange` BEFORE the query goes out, so a dropped answer to the
      // ask this block is still waiting for leaves `requested` naming a slice
      // that no outcome will ever answer for — and `derivePlaytimeState` reads
      // that as `awaiting`, so the status line said "Updating charts..." with
      // no recovery short of a new import or a reload. Two of `acceptOutcome`'s
      // rejections reach it with no worker bug at all: a result with no view,
      // and a stamp that is not the ask's. A second tab clearing the origin's
      // cache is one way to ask for the first (D-27), and the worker then
      // answers `importedAt: null, view: null`.
      //
      // So the ask that is being abandoned is handed back to `shown`, which is
      // the slice actually on screen. Both gates are load-bearing and neither
      // is a formality: a SUPERSEDED answer means a newer request is already
      // in flight, and rolling `requested` back under it would strand THAT one
      // instead; and if `requested` is not this ask, then something newer owns
      // it and this code would be overwriting a live request with a guess.
      //
      // 04-16 (G-04-5): that reconcile unsticks the status line, and it says
      // NOTHING. A selector that quietly ignores the user reads as a broken
      // app, so the flag is set here — BEFORE the reconcile, and without
      // touching it — for the one case the worker can actually report: the
      // store was emptied under a tab that still holds the dataset. Gated on
      // `userInitiated` because the sentence claims a SELECTION could not be
      // applied, and the initial load made no selection to fail.
      if (userInitiated && isCacheClearedElsewhere(outcome, ask, importedAt)) {
        cacheCleared = true;
      }
      if (
        outcome.kind !== 'superseded' &&
        wanted === importedAt &&
        requested?.valueIndex === ask.valueIndex &&
        (requested?.game ?? null) === ask.game
      ) {
        requested = {
          importedAt: wanted,
          valueIndex: shown?.valueIndex ?? null,
          game: shown?.game ?? null,
        };
      }
      return;
    }

    shown = accepted;
    // An applied answer is the end of the notice: whatever was cleared has
    // been replaced by numbers that exist, so leaving it up would describe a
    // dataset the block has moved past (T-04-39).
    cacheCleared = false;
    // The announcement is written on an applied answer, or CLEARED — never
    // left alone. `statusLine` returns it for every state that is not loading
    // or updating, and `announcement` is component state, so without this the
    // previous slice's sentence survives a failed query: the live region
    // announced eu-1's numbers at the instant na-1's error box appeared, and
    // the sentence sat above that box describing numbers no longer on screen.
    // This is T-04-24's own rule — an answer that is not on screen is never
    // read out — applied to the one line that talks about the answer.
    if (userInitiated && accepted.kind === 'view' && accepted.view.status === 'ready') {
      announcement = selectionAnnouncement(accepted.view);
    } else {
      announcement = '';
    }
  }

  $effect(() => {
    const wanted = importedAt;
    // Nothing loaded: no query, no empty-query error, no `aria-busy`.
    if (wanted === null) return;
    untrack(() => {
      // D-03's state lifetime, in three lines: a new dataset starts at All and
      // says nothing about the old one. The selection is component state, so
      // there is nothing to persist and nothing to migrate. The notice clears
      // with them (04-16): a notice is a claim about ONE dataset, and the way
      // back from it is dropping the export again — which is exactly what
      // re-runs this effect.
      requested = { importedAt: wanted, valueIndex: null, game: gameFilter };
      announcement = '';
      cacheCleared = false;
      void load(null, gameFilter, false);
    });
  });

  /**
   * The reader's choice of game (Phase 10, D-01).
   *
   * Two things are worth spelling out, because both were the obvious mistake:
   *
   *   - the split index ALWAYS resets to All. The split value list belongs to
   *     the game scope, so an index chosen under WoT names nothing under Warships
   *     and the worker would answer All for it anyway; carrying it would leave
   *     the selector showing a value the new answer does not hold.
   *   - `requested` is written BEFORE the query, and with the game, because
   *     `derivePlaytimeState` compares the pair. A request differing only by
   *     game is `updating`, which is what keeps the previous slice on screen
   *     with "Updating charts..." rather than swapping it for a blank block
   *     mid-flight (D-03).
   *
   * The filter itself is written to the shell cell through the callback rather
   * than here, so this block holds no state the reader can leave behind.
   */
  function onGameChange(token: string | null): void {
    if (importedAt === null) return;
    onGameFilterChange(token);
    requested = { importedAt, valueIndex: null, game: token };
    void load(null, token, true);
  }

  /**
   * The user's choice of slice.
   *
   * The option's value is a string, and `'all'` is the only one that is not an
   * index — a value like `'0'` is the first server, never All. A request made
   * with no dataset on screen is dropped rather than stored: there is no query
   * to send, so a request could only be a stale one.
   *
   * The ask carries the game of the slice ON SCREEN (`shown.game`), not the
   * shell's current filter: while a game change is still in flight this control
   * belongs to the previous game's value list, so asking for the new game with
   * an index from the old one would ask for a list that does not exist. That
   * also supersedes the in-flight game request, which is what "the latest
   * request wins" means here.
   */
  function onSelectChange(event: Event): void {
    const control = event.currentTarget as HTMLSelectElement;
    if (importedAt === null) return;
    const valueIndex = control.value === ALL_OPTION ? null : Number(control.value);
    const game = shown?.game ?? null;
    requested = { importedAt, valueIndex, game };
    void load(valueIndex, game, true);
  }

  /** The state the whole block renders (04-UI-SPEC section 2). */
  const playtimeState = $derived(derivePlaytimeState({ importedAt, shown, requested }));

  /**
   * The view on screen, and nothing for an answer that is not this dataset's.
   * 04-02's cell, unchanged: the stamp lives with the view, so a replace that
   * lands mid-query returns the block to `loading` by construction.
   */
  const view = $derived<PlaytimeView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  /** A `ready` view, which is the only kind that carries a slice to total. */
  const readyView = $derived(view?.status === 'ready' ? view : null);

  const split = $derived(readyView?.split ?? null);
  const valueCount = $derived(split?.values.length ?? 0);
  /**
   * The value the selector may hold, validated against this dataset and this
   * value list. Three refusals in one function (04-05): another dataset, an
   * index past the end, anything that is not a whole number. So a stale value
   * is never displayed, and no reset hook exists to be forgotten.
   */
  const displayedSelection = $derived(effectiveSelection(requested, importedAt, valueCount));

  /**
   * The column this build can put a label to, or null. A name outside the three
   * the worker can produce — `GAME`, `SERVER_NAME`, `CLIENT_PLATFORM` — renders
   * no selector, no table and no overlap note, which is the same silence an
   * export with no qualifying column gets.
   */
  const column = $derived(split === null ? null : splitColumnOf(split.column));

  /** The status paragraph's text; empty whenever there is nothing to say. */
  const statusText = $derived(statusLine(playtimeState, announcement));

  /**
   * The game tokens the ON-SCREEN answer carries, and the chip row they warrant.
   *
   * Read from `view` rather than from the shell's filter or from the worker
   * directly, for the reason the rest of this block reads `shown`: while a chip
   * click is in flight the previous answer is the truth on screen, and the chips
   * must not move or vanish under the reader's cursor (UI-SPEC Surface 1).
   *
   * `null` means the row renders no node at all — a single-game export, no
   * session file, or one where All games is the only view there is. Since
   * 11-01 HEAT and WOTC are filter tokens like any other, so "only HEAT and
   * WOTC" is no longer one of these cases: two distinct games render two chips.
   */
  const chipGames = $derived(
    view !== null && (view.status === 'ready' || view.status === 'no-game-sessions')
      ? (view.games ?? [])
      : [],
  );

  const chipTokens = $derived(filterChips(chipGames, gameFilter));

  /**
   * Whether the "About this summary" disclosure belongs on screen (Phase 10,
   * D-06).
   *
   * It explains two things a single-account, single-game export cannot show:
   * that overlapping sessions are counted once, and that All games can read
   * smaller than the games added together. Either is reachable exactly when the
   * filter row is there (the reader can choose a game and compare) or the
   * dataset holds two or more accounts (the totals are merged). With neither,
   * the disclosure would be an essay about a case the reader cannot reach, so
   * it renders no node and a one-account one-game dataset's DOM stays
   * byte-identical to v1.0.
   */
  const showAboutTotals = $derived(chipTokens !== null || accountCountOf(result) >= 2);
</script>

<!--
  The block's own root, not a wrapper the card would have to know about. A
  `ready` card renders this as its children snippet; `data-state` is the single
  hook a test and plan 04-09's chart branches both read. `aria-busy` says the
  numbers are still being worked out, which is true only in `loading`: in
  `updating` they are on screen and correct, just not the ones being asked
  about.
-->
<div
  data-testid="playtime"
  data-state={playtimeState}
  aria-busy={playtimeState === 'loading' ? 'true' : 'false'}
>
  <h3>{PLAYTIME_HEADING}</h3>

  <!--
    The one live region of the phase, present in EVERY state and empty when
    nothing is happening: an empty live region announces nothing and adds no
    height, while a region that appears only while loading is announced by the
    insertion of the element rather than by its text.

    Empty means visually hidden, not absent. The block is a flex column with a
    24px gap, so a paragraph with no text would still hold a gap slot and push
    the tiles down by 24px in the one state that shows them; the clip pattern
    keeps the node in the accessibility tree — which is what makes the
    announcement work at all — while measuring nothing. `Dropzone.svelte` uses
    the same pattern for the file input.
  -->
  <p
    class="status"
    class:hidden={statusText === ''}
    data-testid="playtime-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {statusText}
  </p>

  <!--
    The one notice this block owns (04-16, G-04-5). It sits directly under the
    status line and OUTSIDE every state branch, because it is not a state:
    `data-state` is unchanged by it, and it can be on screen above a `ready`
    slice, above an `updating` one, or above an error box. Putting it inside a
    branch would have meant deciding which state may carry a complaint about
    storage, which is the state machine's job and would have been the one
    change to `derivePlaytimeState` this plan is not allowed to make.

    `role="alert"` and NO `aria-live` attribute. The role is what makes it
    announce, and it is an IMPLICIT live region: a screen reader treats
    `role="alert"` as `aria-live="assertive"` without the attribute being
    present. So this IS a live region in the accessibility tree, and that is
    the intent. What it is not is a third *explicit* `aria-live` attribute —
    the block still owns exactly one, so the page-wide count of exactly two
    that `dashboard.spec.ts` asserts by that attribute still holds, as does
    the 04-UI-SPEC's "one new live region" claim. Both facts are load-bearing:
    dropping the role would stop the notice announcing, and adding the
    attribute would break the count.

    Amber, the chrome the excluded-row pill already uses: a fact about
    storage, not a failure of the import. The error red is reserved for a
    query that failed, and this query did not fail — it answered truthfully
    that there was nothing stored to answer from.
  -->
  {#if cacheCleared}
    <p class="body notice" role="alert" data-testid="playtime-cache-cleared">
      {PLAYTIME_CACHE_CLEARED}
    </p>
  {/if}

  <!--
    The game filter chip row (Phase 10, D-01; UI-SPEC Surface 1).

    Placed AFTER the status live region and the storage notice and BEFORE the
    `GAME` selector row, so the tab order is: filter group, split selector,
    charts — one stop per group, and the filter (the coarser choice) is the one
    a reader lands on first. It sits OUTSIDE the `ready` branch on purpose: the
    chips come from the view's own `games` list, which an empty-game answer
    carries too, so a game with no sessions keeps its chips and All games stays
    one tap away (D-03).

    No conditional node at all when the row is not warranted — `filterChips`
    answers null and nothing is drawn, so a single-game dataset's DOM is
    byte-identical to v1.0.
  -->
  {#if chipTokens !== null}
    <GameFilter games={chipTokens} selected={gameFilter} onchange={onGameChange} />
  {/if}

  {#if readyView !== null}
    {#if split !== null && column !== null}
      <!--
        The only control this phase adds. A native `<select>` (D-03): its
        keyboard and screen-reader behaviour is the platform's, and its options
        are untrusted `SERVER_NAME` / `CLIENT_PLATFORM` text, which is rendered
        as text and never as markup (T-04-15). The label is the column's true
        name, so nothing here ever claims a game.
      -->
      <div class="selector-row">
        <label for={selectId}>{SPLIT_COLUMN_LABELS[column]}</label>
        <!--
          The `value` and the per-option `selected` are the same
          `displayedSelection`, so the control cannot disagree with itself: a
          request this dataset cannot apply has already been refused by
          `effectiveSelection` and both fall back to All.
        -->
        <select
          id={selectId}
          data-testid="playtime-selector"
          value={displayedSelection === null ? ALL_OPTION : String(displayedSelection)}
          onchange={onSelectChange}
        >
          <option value={ALL_OPTION}>{SPLIT_ALL_OPTION}</option>
          {#each split.values as entry, index (index)}
            <option value={String(index)} selected={displayedSelection === index}>
              {formatSplitValue(splitValue(entry.value))}
            </option>
          {/each}
        </select>
      </div>
    {/if}

    <PlaytimeSummary
      slice={readyView.slice}
      {split}
      selected={readyView.selected}
    />{#if showAboutTotals}
      <!--
        How the merged totals are counted (Phase 10, D-06), directly under the
        tiles it explains. It is a `details`, so collapsed by default and adding
        no height the reader did not ask for; the `About this summary` summary
        is the one added tab stop.

        The `{#if}` tag is flush against the `<PlaytimeSummary />` above it with
        NO whitespace between them, exactly as `DashboardSection.svelte`'s
        combined caption is: a newline here would put a whitespace TEXT NODE
        between the totals and whatever follows them on a dataset that does not
        warrant the disclosure, which is the v1.0 DOM this plan promises to
        leave byte-identical.
      -->
      <AboutDisclosure name={ABOUT_NAME_PLAYTIME_TOTALS} testId="about-playtime-totals">
        <p class="caption">{PLAYTIME_MERGE_ABOUT}</p>
      </AboutDisclosure>
    {/if}

    <!--
      The charts, mounted under the totals in every state that HAS a slice —
      `ready` and `updating` alike, because in `updating` the previous slice is
      still the truth on screen (UI-SPEC state matrix: "Previous slice's tiles
      and charts stay on screen unchanged"). `updating` is a comparison and not
      a flag: a request for the same dataset at a different index only, because
      a request stamped with the old dataset outlives it and a flag would have
      held the charts in "Updating" forever.

      The slice passed is `readyView.slice` — the APPLIED one, not
      `requested` — so the charts can never show numbers the totals above them
      are not showing.
    -->
    <PlaytimeCharts slice={readyView.slice} updating={playtimeState === 'updating'} />
  {:else if view !== null && view.status === 'no-game-sessions'}
    <!--
      The empty GAME (Phase 10, D-03): this export HAS sessions, just not this
      game's, so the tiles and the charts are replaced by the one body line and
      the chip row above stays. Decided from the VIEW rather than from
      `playtimeState`, and that is the point: while a chip click is in flight
      the state is `updating` but the empty game is still the answer on screen,
      and a body that vanished mid-click would leave the block blank for a
      frame with no explanation and no numbers.
    -->
    <p class="body" data-testid="playtime-game-empty">{formatNoGameSessions(view.game)}</p>
  {:else if playtimeState === 'no-session-file'}
    <p class="body">{PLAYTIME_NO_SESSION_FILE}</p>
  {:else if playtimeState === 'no-usable-sessions'}
    <p class="body">{PLAYTIME_NO_USABLE_SESSIONS}</p>
    <!--
      A header-only `Sessions.csv` has no rows at all, so this usually renders
      nothing; an export whose every row was unusable has some, and saying so is
      the difference between "no sessions" and "no USABLE sessions" (D-02). The
      count is the view's own — the worker already knows how many rows it
      dropped, and re-deriving it here would be a second source of truth.
    -->
    <ExcludedNotice count={view?.status === 'no-usable-sessions' ? view.excluded : 0} />
  {:else if playtimeState === 'error'}
    <!--
      `role="alert"`: the error is the answer to a question the user asked by
      dropping a file, so it interrupts rather than waits for a gap in the
      chatter. The copy is the fixed sentence from ui-copy.ts, never the
      worker's detail, and there is no retry button — dropping the export again
      is the retry, and the dataset on screen is unchanged either way.
    -->
    <p class="body error" role="alert" data-testid="playtime-error">{PLAYTIME_ERROR}</p>
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 24px;
    position: relative;
    min-width: 0;
  }

  /* Label role with the group-heading affordance: the sub-heading reads as a
     level of its own inside the card rather than as another 14px line
     (04-UI-SPEC Typography, the sub-heading h3 row). `LoginHistory.svelte`
     repeats this rule in full, because scoped styles cannot be shared. */
  h3 {
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
  }

  /* Body role, state messages. Empty in every state but `loading`, where it
     is the announcement — so it keeps the same box and no height jump. */
  .status {
    margin: 0;
    min-height: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The empty status line, hidden without leaving the accessibility tree. The
     clip pattern, not `display: none`: a region that is not in the tree cannot
     be announced, and this one is where the selection change is read out. */
  .status.hidden {
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

  .body {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The project's destructive error colour, reused verbatim from
     FailureBanner rather than re-picked: this is a failure the user needs to
     see, and a second error red would drift from the first. The box is the
     Body role's own 8px/12px, not the banner's, because this is body text
     inside a card and not a notice above the dropzone. */
  /* The "About this summary" body (Phase 10, D-06). Body role's own metrics
     with the muted ink the other captions in this app use, and the same
     `overflow-wrap` so the 340-character counting rule cannot widen the card at
     375px. It is a caption rather than a `.body` because it is supplementary
     reading, never a state message. */
  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .error {
    padding: 8px 12px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
  }

  /* The cache-cleared notice's chrome, the amber `ExcludedNotice` already
     uses value for value (#f9ab00 / #fef7e0 / #8a5a00): a fact about storage
     the user should notice, not a failure of their import and not an error.
     The Body role's own type scale, and the same `overflow-wrap` the excluded
     explanation carries so a long sentence cannot widen the card at 375px. */
  .notice {
    padding: 8px 12px;
    border: 1px solid #f9ab00;
    border-radius: 6px;
    background: #fef7e0;
    color: #8a5a00;
  }

  /* Label above the control, in a row that wraps: at 375px the two fit, and
     the control keeps its own max width so a 60-character server name cannot
     widen the card. */
  .selector-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .selector-row label {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--text);
  }

  /* Label role, the same text treatment as the Phase 3 bar buttons. The
     `:focus-visible` ring is that ring, exactly: the accent is reserved for
     focus, and this is a new member of "every interactive element". */
  select {
    max-width: 100%;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--faint);
    border-radius: 6px;
    background: var(--page);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }

  select:hover {
    background: var(--hover);
  }

  select:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
