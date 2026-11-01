<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import type { CityClient } from './city-client.ts';
  import type { CityView } from './city-shared.ts';
  import type { LoginsView } from './login-shared.ts';
  import {
    ABOUT_NAME_LOGIN_TABLE,
    LOGIN_HISTORY_ERROR,
    LOGIN_HISTORY_HEADING,
    LOGIN_HISTORY_LOADING,
    LOGIN_HISTORY_NO_SOURCE,
    LOGIN_ACCOUNT_NOTE,
    LOGIN_EXCLUDED_EXPLANATION,
    LOGIN_HISTORY_NO_USABLE,
    LOGIN_TABLE_ARIA_NAME,
    LOGIN_TABLE_FIND_HINT,
    LOGIN_TABLE_HEADING,
    VEHICLE_SCROLL_HINT,
    MASK_ANNOUNCE_MASKED,
    MASK_ANNOUNCE_SHOWN,
    MASK_CAPTION_MASKED,
    MASK_CAPTION_REVEALED,
    MASK_TOGGLE_HIDE,
    MASK_TOGGLE_SHOW,
    formatLoginCapLine,
    formatLoginCountLine,
    formatLoginExcludedPill,
  } from '../../ui-copy.ts';
  import { acceptLoginsOutcome, deriveLoginState, type ShownLogins } from './login-state.ts';
  import {
    DEFAULT_LOGIN_SORT,
    accountCells,
    buildLoginRows,
    capFigures,
    excludedCount,
    hasAccountRow,
    listedFigures,
    loginTiles,
    nextSort,
    sortLoginRows,
    visibleLoginColumns,
    type LoginSort,
  } from './login-model.ts';
  import AboutDisclosure from '../../charts/AboutDisclosure.svelte';
  import ExcludedNotice from '../../shell/ExcludedNotice.svelte';
  import { accountTagsFor } from '../../shell/identity-model.ts';
  import LoginSummary from './LoginSummary.svelte';
  import LoginMapSection from './LoginMapSection.svelte';
  import LoginTable from './LoginTable.svelte';
  import CityOptIn from './CityOptIn.svelte';
  import CityList from './CityList.svelte';
  import { countryName } from '../../geo/country-names.ts';

  /**
   * The Login history sub-block of the Activity_history card (06-08, ACTIVITY-05).
   *
   * It is the SECOND sub-block in that card, after Playtime, exactly where
   * `LoginHistorySection`'s pending note stood until this plan. The `h3` text
   * and its style are unchanged — the note under it is not, because both
   * sub-blocks are real now and a `ready` card that still promises a dashboard
   * is a card that contradicts itself (D-04, 06-UI-SPEC section 1).
   *
   * ## No decision lives in this file
   *
   * Which state is on screen is `deriveLoginState`, whether an answer may be
   * shown is `acceptLoginsOutcome`, which address string is displayed is
   * `displayIp`, and whether the mask may still be revealed is `maskStateFor`.
   * All four are pure functions with unit tests, because the failures that
   * matter here are not visual: they are a previous export's addresses under a
   * new export's heading, or a mask that outlived the dataset it was opened
   * for. What is left here is the DOM wiring — two cells of state, one effect
   * that starts a load, and one click handler.
   *
   * ## The mask is ONE rune for the whole APP, owned by the shell (11-06, D-04)
   *
   * Until 11-06 `revealed` was a `$state` right here, and that was a cell that
   * died with the pane: switch to Playtime and back and the addresses were
   * masked again. The HEAT pane of plan 11-09 shows addresses too, and D-04 asks
   * for ONE global reveal rather than one per pane, so the cell now lives in
   * `Dashboard.svelte`, stamped with the dataset it was made under and read
   * through `resolveReveal`.
   *
   * This block still READS the same flag and still renders the same toggle, the
   * same captions and the same two announcements — the lift changed WHO owns
   * the boolean, and nothing a reader can see. The reset is still D-07's rule,
   * it just happens one level up. Nothing here touches a storage API, a cookie
   * or the URL, and `tests/unit/logins/login-model.test.ts` scans the feature
   * directory while `tests/unit/shell/reveal-state.test.ts` scans the shell to
   * keep that true across the new home (D-07, T-06-29).
   *
   * ## Why `untrack`, and why the effect reads only `importedAt`
   *
   * The effect depends on the primitive `importedAt` and nothing else, so a
   * replace is the only thing that can re-run it. Without `untrack` the client
   * handle and the applied answer would be read inside the effect's own
   * tracking scope, and writing `shown` would re-run the query that produced
   * it.
   *
   * ## Why `alive` is a plain flag
   *
   * A load that resolves after the block is gone writes into a component that
   * no longer exists, so the flag is cleared in `onMount`'s teardown — the one
   * place that runs exactly when the block leaves the page, including the
   * `clear` case, where the dataset disappears underneath it.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam (D-06) — the only way this block asks. */
    client: QueryClient;
    /** The opt-in city decode bridge (06-13). Not a query: it carries bytes. */
    cityClient: CityClient;
    /**
     * Whether addresses are shown in full, for the ONE reveal of the whole app
     * (11-06, D-04). A prop rather than a rune of this block's own: the cell
     * is in the shell, so it survives a pane switch and the HEAT pane reads the
     * same value. Masked on every dataset change, by the shell's stamp.
     */
    revealed: boolean;
    /** Ask the shell to reveal or re-mask, stamped with the current dataset. */
    onRevealChange: (revealed: boolean) => void;
  }

  let { result, client, cityClient, revealed, onRevealChange }: Props = $props();

  /**
   * Which dataset this block is describing. Absent before the first import, and
   * that is the only case where there is nothing to ask about: a pre-parse
   * classification is not a dashboard.
   */
  const importedAt = $derived(result?.importedAt ?? null);

  /**
   * The applied answer and the `importedAt` it answers for, in ONE cell.
   *
   * `raw` because a `ready` view holds every distinct address with its games
   * and dates, and a deep proxy would be walked by the whole block on every
   * write. One cell rather than two because the pairing IS the invariant
   * (T-06-30): a value that could be stamped separately from its dataset is a
   * value that can be shown under the wrong heading.
   */
  let shown = $state.raw<ShownLogins | null>(null);
  /**
   * The loaded city view and the `importedAt` it describes, in ONE cell, or
   * null before the user has asked (06-13, D-15).
   *
   * Session-only: this rune is the only place the view lives. It is never
   * written anywhere, a reload starts it null, and the dataset effect below
   * nulls it on a replace or a Clear, so there is nothing for Clear to wipe.
   */
  let cityShown = $state.raw<{ importedAt: string; view: CityView } | null>(null);
  /**
   * The `importedAt` the table was last set up for.
   *
   * NOT the mask's stamp any more (11-06): the reveal moved to the shell, so
   * this one drives the sort and city-view resets only — which are about the
   * TABLE, not about the mask. Keeping it means those resets still happen in
   * the same effect, on the same primitive, without the block having to own a
   * boolean it no longer sets.
   */
  let maskStamp = $state.raw<string | null>(null);
  /**
   * The table's sort. One rune, reset to the default in the same effect that
   * re-masks, so a replace and a Clear return the table to its default order by
   * construction. Never persisted, like the mask (D-07).
   */
  let sort = $state.raw<LoginSort>(DEFAULT_LOGIN_SORT);
  /**
   * What the live region says about the LAST thing the user did, or nothing.
   *
   * Component state, never derived from `revealed`: the region's job is to
   * announce a CHANGE, and a derived value would re-announce the same sentence
   * on every re-render. It is cleared by the dataset effect, because an
   * announcement about the previous export's mask is a claim about a dataset
   * this block has moved past (T-04-24's rule, restated).
   */
  let announcement = $state('');

  /** False once the block is off the page. Cleared, never set, outside mount. */
  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'logins' });
    if (!alive) return;
    const accepted = acceptLoginsOutcome(outcome, wanted, importedAt);
    // A dropped answer needs nothing: a newer ask owns the question now, or
    // the dataset on screen is not the one this answer is for, and the derived
    // state is `loading` in both cases by construction.
    if (accepted !== null) shown = accepted;
  }

  $effect(() => {
    const wanted = importedAt;
    untrack(() => {
      // The mask is NOT reset here any more (11-06, D-04): it is the shell's
      // stamped cell, and `resolveReveal` masks a different dataset by
      // construction. The announcement still goes with the dataset, so a
      // replace never reads out the previous export's mask.
      //
      // A different dataset opens on the default order; the same one keeps the
      // reader's own choice.
      if (wanted !== maskStamp) {
        sort = DEFAULT_LOGIN_SORT;
        // The city view describes the previous dataset, so it goes with it.
        cityShown = null;
      }
      maskStamp = wanted;
      announcement = '';
      if (wanted === null) return;
      void load(wanted);
    });
  });

  /** The state the whole block renders (06-UI-SPEC section 2). */
  const blockState = $derived(deriveLoginState({ importedAt, shown }));

  /**
   * The view on screen, and nothing for an answer that is not this dataset's.
   * The pairing lives in `shown`, so this is a narrowing rather than a reset.
   */
  const view = $derived<LoginsView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  /**
   * The city view for the dataset on screen, and nothing for another's. The
   * pairing lives in `cityShown`, so this is a narrowing, as `view` is.
   */
  const cityView = $derived<CityView | null>(
    cityShown !== null && cityShown.importedAt === importedAt ? cityShown.view : null,
  );

  /** The tiles' figures, or the empty model for a view that is not `ready`. */
  const tiles = $derived(view === null ? null : loginTiles(view, countryName));

  /**
   * The table's rows, parsed once per view and never again.
   *
   * Their own derived, keyed on the view and the city view: the mask flag is
   * read by the cells and not here, so toggling it re-renders text without
   * rebuilding a row. Loading city detail rebuilds them once, because the
   * city view's `placeOf` is aligned to the STORED order.
   */
  const rows = $derived(
    view !== null && view.status === 'ready'
      ? buildLoginRows(view.addresses, countryName, cityView)
      : [],
  );

  /**
   * What the map section reads: the per-country tallies, the unknown bucket and
   * the counted total (06-12).
   *
   * Counts only. A view's addresses never reach the map section, so nothing it
   * renders can carry one. Null for a view that is not `ready`.
   */
  const mapFigures = $derived(
    view !== null && view.status === 'ready'
      ? { countries: view.countries, unknown: view.unknown, totalLogins: view.totalLogins }
      : null,
  );

  /** The listed addresses and their logins: what the count line reads. */
  const listed = $derived(listedFigures(rows));

  /** The rows in the order the sort asks for. Never reads the mask. */
  const sortedRows = $derived(sortLoginRows(rows, sort));

  /**
   * The account tags to draw, or `null` with one account (D-18).
   *
   * The same gate every other pane uses, and it feeds both the column width and
   * the chips, so there is one condition rather than two that could disagree.
   */
  const tags = $derived(accountTagsFor(result));

  /**
   * The six default columns; City joins them once city detail is loaded, and the
   * first column widens to 224px when the dataset has tags (D-18).
   */
  const columns = $derived(visibleLoginColumns(cityView !== null, tags !== null));

  /**
   * The pinned Account record row's cells, or null when the export has none.
   * Built from the same mask flag as every other address, and never part of
   * `rows`, the count line or any tile (D-02).
   */
  const account = $derived(
    view !== null && view.status === 'ready' && hasAccountRow(view.account)
      ? accountCells(view.account, revealed, countryName)
      : null,
  );

  /** The figures behind the excluded pill and the cap line, both above zero only. */
  const excluded = $derived(excludedCount(view));
  const capped = $derived(view === null ? null : capFigures(view));

  /**
   * What the live region says, and nothing else.
   *
   * The loading line in `loading`, otherwise the last mask announcement. The
   * rule it never breaks is that this region carries STATE WORDS ONLY and never
   * an address (D-07, T-06-28): the mask's whole point is that nothing
   * readable is announced unless the reader asked for it, and a live region is
   * read aloud whether or not anyone is looking at the screen.
   */
  const statusText = $derived(blockState === 'loading' ? LOGIN_HISTORY_LOADING : announcement);

  /** A header click: the next sort of that column (UI-SPEC section 3 Sorting). */
  function onSort(key: string): void {
    sort = nextSort(sort, key);
  }

  /**
   * The one control, and the one place the mask changes.
   *
   * A native `<button>` whose visible text swaps between the two labels, with
   * NO `aria-pressed` (06-UI-SPEC section 3, a11y Decision): with a pressed
   * state a screen reader announces two changes where one is meant. Focus stays
   * where it is, because the button is never re-created — only its text
   * changes.
   *
   * The WRITE goes to the shell (11-06, D-04); the announcement is read from
   * the NEXT value rather than from the flag, so it says what the reader just
   * asked for rather than waiting for the prop to come back down.
   */
  function onToggle(): void {
    const next = !revealed;
    onRevealChange(next);
    announcement = next ? MASK_ANNOUNCE_SHOWN : MASK_ANNOUNCE_MASKED;
  }
</script>

<!--
  The block's own root, not a wrapper the card would have to know about.
  `data-state` is the single hook a test and every later Phase 6 plan read, and
  `aria-busy` is true only while the numbers are still being worked out — in
  every other state they are on screen and correct.
-->
<div
  data-testid="login-history"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  <h3 class="t-note-strong">{LOGIN_HISTORY_HEADING}</h3>

  <!--
    The block's ONE live region, present in EVERY state and empty when nothing
    is happening — 06-UI-SPEC section 9 requires it to exist in every state,
    because a region that appears together with its content is announced by the
    insertion of the element rather than by its text (RESEARCH Pitfall 10).

    Empty means visually hidden, not absent: this block is a flex column with a
    24px gap, so a paragraph with no text would still hold a gap slot and push
    the reveal row down by 24px in the one state that shows it. The clip
    pattern keeps the node in the accessibility tree — which is what makes the
    announcement work at all — while measuring nothing.
  -->
  <p
    class="status"
    class:hidden={statusText === ''}
    data-testid="login-history-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {statusText}
  </p>

  {#if blockState === 'loading'}
    <!--
      The loading line IS the status region, not a second paragraph: the UI-SPEC
      puts it "in the status line", and a reader with a screen reader would
      otherwise hear every state twice.
    -->
  {:else if blockState === 'no-source'}
    <p class="body">{LOGIN_HISTORY_NO_SOURCE}</p>
  {:else if blockState === 'no-usable'}
    <p class="body">{LOGIN_HISTORY_NO_USABLE}</p>
    <ExcludedNotice
      count={excluded}
      pill={formatLoginExcludedPill(excluded)}
      explanation={LOGIN_EXCLUDED_EXPLANATION}
      testId="login-excluded"
    />
  {:else if blockState === 'error'}
    <!--
      `role="alert"` and NO `aria-live` attribute. The role is what makes it
      announce, and it is an IMPLICIT live region — a screen reader treats
      `role="alert"` as `aria-live="assertive"` without the attribute being
      present. So this IS a live region in the accessibility tree, and that is
      the intent; what it is not is a fourth EXPLICIT `aria-live` attribute, so
      the page-wide count that `dashboard.spec.ts` asserts still holds. The copy
      is the fixed sentence from ui-copy.ts, never the worker's detail, and
      there is no retry button: dropping the export again is the retry, and the
      dataset on screen is unchanged either way (D-21, T-06-31).
    -->
    <p class="body error" role="alert" data-testid="login-history-error">{LOGIN_HISTORY_ERROR}</p>
  {:else if view !== null && tiles !== null}
    <!--
      The reveal row: the one control, then the mask-state caption. It is the
      first thing under the heading because it governs everything below it —
      every address in this block is masked or revealed by this one button.
    -->
    <div class="reveal-row">
      <button
        type="button"
        class="t-note-strong"
        data-testid="login-mask-toggle"
        data-masked={revealed ? 'false' : 'true'}
        onclick={onToggle}
      >
        {revealed ? MASK_TOGGLE_HIDE : MASK_TOGGLE_SHOW}
      </button>
      <p class="muted-note" data-testid="login-mask-caption">
        {revealed ? MASK_CAPTION_REVEALED : MASK_CAPTION_MASKED}
      </p>
    </div>

    <!--
      The six tiles, the reveal row's caption and D-01's multi-file note. The
      figures come from `loginTiles` and the mask flag from this block, so the
      summary has no state of its own to fall out of step with either.
    -->
    <LoginSummary {tiles} {revealed} />

    <!--
      The IP table section (06-10, D-05): one row per distinct address, under the
      tiles and governed by the same mask flag as everything above it.

      The two hints under the table are supplementary usage guidance, so they sit
      in an "About this table" disclosure (Phase 8 disclosure pattern). The Account
      record note stays above the table (Amendment A-3), and the city intro further
      down is deliberately NOT in a disclosure (Phase 6 D-14, D-16: it is the
      consent text for the one sanctioned request).
    -->
    <section class="table-section">
      <h4 class="t-note-strong">{LOGIN_TABLE_HEADING}</h4>
      <p class="muted-note" data-testid="login-count">
        {formatLoginCountLine(listed.addresses, listed.logins)}
      </p>
      <!--
        The Account record note labels the pinned row, so it is read with the
        row, directly above the table (Amendment A-3). The record is excluded from
        every tile (Phase 6 D-02), and this sentence is what says so.
      -->
      {#if account !== null}
        <p class="muted-note" data-testid="login-account-note">{LOGIN_ACCOUNT_NOTE}</p>
      {/if}
      <LoginTable
        {columns}
        rows={sortedRows}
        {revealed}
        {sort}
        {onSort}
        {account}
        {tags}
        regionName={LOGIN_TABLE_ARIA_NAME}
        resetKey={`${importedAt}|${sort.key}|${sort.dir}`}
      />
      <AboutDisclosure name={ABOUT_NAME_LOGIN_TABLE} testId="about-login-table">
        <p class="muted-note">{VEHICLE_SCROLL_HINT}</p>
        <p class="muted-note">{LOGIN_TABLE_FIND_HINT}</p>
      </AboutDisclosure>
      <ExcludedNotice
        count={excluded}
        pill={formatLoginExcludedPill(excluded)}
        explanation={LOGIN_EXCLUDED_EXPLANATION}
        testId="login-excluded"
      />
      {#if capped !== null}
        <p class="muted-note" data-testid="login-cap-line">
          {formatLoginCapLine(capped.addresses, capped.logins)}
        </p>
      {/if}
    </section>

    <!--
      The country map section (06-12, D-08..D-11), under the table section and
      governed by no mask: it holds counts per country, never an address.
    -->
    {#if mapFigures !== null}
      <!--
        Keyed on the dataset, so a replace starts the section from nothing: the
        roving stop, the open tooltip and the list's disclosure all belong to
        the export they were opened on.
      -->
      {#key importedAt}
        <LoginMapSection {...mapFigures} nameOf={countryName} />
      {/key}
    {/if}

    <!--
      The city-level opt-in (06-13, D-14..D-16). Last in the block, as the
      UI-SPEC's document order has it. It makes no request until its button is
      pressed.
    -->
    <section class="city-section">
      <CityOptIn
        {importedAt}
        city={cityClient}
        onLoaded={(loaded, stamp) => {
          // Belt and braces: the opt-in already checked, and a view for a
          // dataset that is not on screen any more is never kept.
          if (stamp === importedAt) cityShown = { importedAt: stamp, view: loaded };
        }}
        onAnnounce={(text) => (announcement = text)}
      />
      <!--
        The ranked list sits beneath the opt-in's ready content (the accuracy
        note is part of it), and only while a view for THIS dataset is held.
      -->
      {#if cityView !== null}
        <CityList view={cityView} nameOf={countryName} />
      {/if}
    </section>
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
    min-width: 0;
  }

  /* Label role with the group-heading affordance: the sub-heading reads as a
     level of its own inside the card rather than as another 14px line. This is
     the rule in Playtime.svelte, value for value — scoped styles cannot be
     shared, and a copy that drifts is worse than a copy that is visible. Keep
     the two in step. */
  h3 {
    margin: 0;
    padding-bottom: var(--space-8);
    border-bottom: 1px solid var(--border);
    color: var(--ink);
  }

  /* Body role, state messages. Empty in every state but `loading`, where it is
     the announcement — so it keeps the same box and there is no height jump. */
  .status {
    margin: 0;
    min-height: 0;
    min-width: 0;
    color: var(--text);
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    overflow-wrap: anywhere;

    /* The empty status line, hidden without leaving the accessibility tree. The
       clip pattern, not `display: none`: a region that is not in the tree
       cannot be announced, and this one is where the state change is read out. */
    &.hidden {
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
  }

  /* The reveal row wraps rather than compressing its caption: at 375px the
     button takes the first line and the caption the second, and the 8px row
     gap is the scale's `sm`. */
  .reveal-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8) var(--space-16);
    min-width: 0;
  }

  /* Label role, the same text treatment as the Phase 3 bar buttons, and the
     accent `:focus-visible` ring — this is a new member of "every interactive
     element", and the accent is reserved for exactly that. */
  button {
    padding: var(--space-8) var(--space-16);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--page);
    color: var(--text);

    &:hover {
      background: var(--hover);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }

  /* The table's own section: the h4, the count line, the scroller and the
     notes sit 8px apart, and the 24px block gap separates the section from the
     tiles above it. */
  .table-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  .city-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  h4 {
    margin: 0;
    color: var(--text);
  }
</style>
