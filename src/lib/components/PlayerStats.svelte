<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '../query-client.ts';
  import type { ClassifyResult } from '../types/worker-messages.ts';
  import type { TitleState, VehicleTitleId, VehicleView } from '../vehicle-shared.ts';
  import { VEHICLE_TITLES } from '../vehicle-shared.ts';
  import {
    filterRows,
    nextSort,
    sortRows,
    visibleColumns,
    zeroBattleCount,
  } from '../vehicle-model.ts';
  import {
    BATTLE_TYPE_ALL_OPTION,
    BATTLE_TYPE_CONTROL_LABEL,
    BATTLE_TYPE_NOTE_TANKS,
    BATTLE_TYPE_NOTE_WARSHIPS,
    COLUMN_PICKER_LEGEND,
    COLUMN_PICKER_SUMMARY,
    HEADER_LIFETIME_BATTLES_LABEL,
    HEADER_PREMIUM_EXPIRES_LABEL,
    PLAYER_STATS_ERROR,
    PLAYER_STATS_HEADING,
    TITLE_CONTROL_LABEL,
    VEHICLE_COLUMN_LABELS,
    VEHICLE_DERIVED_NOTE,
    VEHICLE_FIND_HINT,
    VEHICLE_NO_MATCH,
    VEHICLE_SCROLL_HINT,
    VEHICLE_SEARCH_LABEL,
    VEHICLE_TABLE_TITLE,
    VEHICLE_TITLE_LABELS,
    WARSHIPS_ALL_NOTE,
    formatBattleTypeLabel,
    formatTitleNoRows,
    formatTitleNotInExport,
    formatTitleOption,
    formatVehicleAnnouncement,
    formatVehicleCell,
    formatVehicleCount,
    formatVehicleRegionName,
    formatVehicleSearchCount,
    formatWarplanes20Note,
  } from '../ui-copy.ts';
  import {
    acceptVehicleOutcome,
    appliedAsk,
    derivePlayerState,
    freshSelection,
    playerStatusLine,
    selectionAfterBattleType,
    vehiclesQuery,
    type ShownVehicles,
    type VehicleAsk,
    type VehicleSelection,
  } from '../vehicle-state.ts';
  import BattleTypeSummary from './BattleTypeSummary.svelte';
  import VehicleTable from './VehicleTable.svelte';

  /**
   * The Vehicle statistics block of the Player_statistics card (05-12).
   *
   * It is the composition of four things that already exist and were each
   * tested on their own: the pure decisions in `vehicle-state.ts`, the pure
   * table model in `vehicle-model.ts`, the channel-scoped client in
   * `query-client.ts`, and the copy in `ui-copy.ts`. What is left here is the
   * wiring — two cells of state, one effect that starts a load, and one handler
   * that starts another.
   *
   * ## Why `untrack`, and why the effect reads only `importedAt`
   *
   * Same reason as `Playtime.svelte` (04-08): the effect depends on the
   * primitive `importedAt` and nothing else, so a replace is the only thing
   * that re-runs it. Without `untrack` the client handle and the resolved view
   * would be read inside the effect's own tracking scope, and writing `shown`
   * would re-run the query that produced it.
   *
   * ## Why `requested` is reconciled to the APPLIED ask
   *
   * The worker answers with the values it applied, not the ones it was asked
   * for (D-05): a `null` title comes back as the first title with rows. If
   * `requested` kept naming the original ask, `derivePlayerState` would compare
   * it against the view for ever and the status line would say "Updating
   * table..." with nothing on the way to change it. `appliedAsk` is the write
   * that ends that.
   *
   * ## Why the D-11 name is plain text
   *
   * A vehicle id is zip content (T-05-35). The nation's chip and the id are two
   * interpolations into a `<td>`, never markup, so an unterminated `<b>` in a
   * cell shows as those characters. The full text rides in `title` because the
   * cell is one ellipsised line.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The data query seam — the only way this block asks for vehicles. */
    client: QueryClient;
  }

  let { result, client }: Props = $props();

  /**
   * The control ids for the two labels, generated rather than hand-written so
   * two blocks on one page could not share a `for`. `$props.id()` yields one
   * id, so the second is that id with a suffix rather than a second call —
   * Svelte allows the call exactly once per component.
   */
  const selectId = $props.id();
  const searchId = `${selectId}-search`;
  const battleTypeId = `${selectId}-battle-type`;

  /** The dataset this block is describing; `null` before the first import. */
  const importedAt = $derived(result?.importedAt ?? null);

  // `raw`: a view holds every row of the title's vehicle file plus its
  // overview, and a deep proxy would be walked by the whole block on every
  // write. Same reasoning as `Playtime.svelte`'s two cells.
  let shown = $state.raw<ShownVehicles | null>(null);
  let requested = $state.raw<VehicleAsk | null>(null);
  let announcement = $state('');

  /** False once the block is off the page. Cleared, never set, outside mount. */
  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  /**
   * Ask for one title and show it, if it is still the title being asked for.
   *
   * `userInitiated` is what makes an announcement a response to the user rather
   * than a repeat of what the page already said on load; the initial load and
   * every dataset change pass false.
   */
  async function load(ask: VehicleAsk, userInitiated: boolean): Promise<void> {
    const outcome = await client.query(vehiclesQuery(ask));
    if (!alive) return;

    const accepted = acceptVehicleOutcome(outcome, ask, importedAt);
    if (accepted === null) {
      // Phase 4's WR-2, kept: `requested` is written BEFORE the query goes
      // out, so a dropped answer to the ask this block is still waiting for
      // would leave the status line on "Updating table..." with no recovery.
      // The roll-back is gated twice — a SUPERSEDED answer must not pull the
      // request back over a newer one, and an ask that is no longer the
      // requested one must not rewrite it either.
      if (
        outcome.kind !== 'superseded' &&
        wantedImportedAt === importedAt &&
        requestedMatches(ask)
      ) {
        requested =
          shown !== null && shown.kind === 'view'
            ? appliedAsk(shown.importedAt, shown.view)
            : { importedAt: wantedImportedAt, title: null, battleType: null };
      }
      return;
    }

    shown = accepted;
    // The announcement is written on an applied answer, or CLEARED — never
    // left alone, so a failed query cannot leave the previous title's sentence
    // in the live region above its error box (T-04-24's rule).
    //
    // Only a user-initiated answer announces, and only a READY one: an
    // absent or row-less title has no table to say the count of, and the
    // neutral line under the controls already says what is wrong.
    if (userInitiated && accepted.kind === 'view' && accepted.view.titleState === 'ready') {
      announcement = formatVehicleAnnouncement(
        accepted.view.title,
        accepted.view.battleType,
        accepted.view.rows.length,
      );
    } else {
      announcement = '';
    }
    // The reconcile: `requested` becomes the ask the view actually applied, so
    // a defaulted title or a declined battle type cannot hold the block at
    // "Updating table..." for ever.
    if (accepted.kind === 'view') {
      requested = appliedAsk(ask.importedAt, accepted.view);
    } else {
      requested = { importedAt: ask.importedAt, title: ask.title, battleType: ask.battleType };
    }
  }

  /** The dataset the in-flight ask was made against, read at issue time. */
  let wantedImportedAt: string | null = null;

  /** Is the ask this load issued still the request the block is waiting on? */
  function requestedMatches(ask: VehicleAsk): boolean {
    return (
      requested !== null && requested.title === ask.title && requested.battleType === ask.battleType
    );
  }

  $effect(() => {
    const wanted = importedAt;
    // Nothing loaded: no query, no empty-query error, no `aria-busy`.
    if (wanted === null) return;
    untrack(() => {
      wantedImportedAt = wanted;
      // D-28's state lifetime, in three lines: a new dataset starts at "the
      // worker picks" and says nothing about the old one. The selection is
      // component state, so there is nothing to persist and nothing to
      // migrate — and a title, a search or a sort from the previous export is
      // exactly the stale value that must not survive.
      const ask: VehicleAsk = { importedAt: wanted, title: null, battleType: null };
      requested = ask;
      selection = freshSelection();
      resetKey += 1;
      announcement = '';
      void load(ask, false);
    });
  });

  /**
   * The user's choice of game.
   *
   * A request made with no dataset on screen is dropped rather than stored:
   * there is no query to send, so a request could only be a stale one. Focus
   * stays on the control, which is the native behaviour of a `<select>` and
   * the reason this is a handler on the element rather than a replacement.
   */
  function onTitleChange(event: Event): void {
    const control = event.currentTarget as HTMLSelectElement;
    if (importedAt === null) return;
    const ask: VehicleAsk = {
      importedAt,
      title: control.value as VehicleTitleId,
      battleType: null,
    };
    requested = ask;
    // D-12 / D-28: a different game is a different table, so the search, the
    // sort AND the picked extras all go back to their defaults.
    selection = freshSelection();
    resetKey += 1;
    void load(ask, true);
  }

  /**
   * The reader's choice of battle type (D-07).
   *
   * The ask names the APPLIED title, not the applied battle type: the applied
   * battle type is whatever the view says it is, and the view is the only thing
   * that knows. A code the export does not have comes back as All battles, and
   * the select's value is the view's own `battleType` — so a request the worker
   * declined can never be displayed as though it were on screen.
   */
  function onBattleTypeChange(event: Event): void {
    const control = event.currentTarget as HTMLSelectElement;
    if (importedAt === null || view === null) return;
    const ask: VehicleAsk = {
      importedAt,
      title: view.title,
      // An empty option value IS "All battles" (D-07): the code is an
      // identifier, so `null` is the only honest way to say "no scope" rather
      // than an empty string that the worker would have to recognise.
      battleType: control.value === '' ? null : control.value,
    };
    requested = ask;
    // D-12: the sort and the search describe the previous list, so both go
    // back to their defaults; the picked extras stay (see
    // `selectionAfterBattleType`).
    selection = selectionAfterBattleType(selection);
    resetKey += 1;
    void load(ask, true);
  }

  /**
   * The reader's choice of extra columns (D-10).
   *
   * The list is held in PICK ORDER, and `visibleColumns` (05-09) is what turns
   * it into drawn columns — so this handler's only job is to add a key at the
   * end or take it out, and it never has to know which of the reader's columns
   * the current view happens to have. `visibleColumns` ignores a key this view
   * does not have, which is the whole reason a key left over from a previous
   * view is neither drawn nor an error.
   *
   * The picker does NOT bump `resetKey`: adding a column changes the table's
   * width, not which rows it holds, and sending the scroller home every time
   * the reader tries a column would be a scroll they did not ask for.
   */
  function onExtraToggle(key: string, checked: boolean): void {
    selection = {
      ...selection,
      pickedExtraKeys: checked
        ? [...selection.pickedExtraKeys, key]
        : selection.pickedExtraKeys.filter((picked) => picked !== key),
    };
  }

  /**
   * The reader's search text.
   *
   * Filtering is over the drawn rows in memory, never over the export's raw
   * `rows` (Phase 2's rule): the worker already mapped and clamped every
   * cell, and re-reading the CSV here would put a 5,000-row parse on the main
   * thread. Escape clears the box through `type="search"`'s own behaviour, so
   * there is no key handler to keep in step with it.
   */
  function onSearchInput(event: Event): void {
    const control = event.currentTarget as HTMLInputElement;
    selection = { ...selection, query: control.value };
    // A search that shrinks the list must return the scroller to the top:
    // a 5,000-row list narrowed to 30 would otherwise keep an offset from the
    // old list and window onto nothing (RESEARCH Pitfall 15).
    resetKey += 1;
  }

  /**
   * A click on a header button.
   *
   * `nextSort` is 05-09's decision — a new key takes its first direction, the
   * current key flips, and a non-sortable key is returned untouched — so a
   * component that flipped on its own would have to re-derive the first
   * direction and could disagree with the model the tests assert.
   */
  function onSort(key: string): void {
    if (view === null) return;
    selection = { ...selection, sort: nextSort(selection.sort, key, view.columns) };
    resetKey += 1;
  }

  /** The selectors this block owns: the search text, the sort and the extras. */
  let selection = $state<VehicleSelection>(freshSelection());

  /**
   * Bumped by every change that can leave the scroller somewhere the new list
   * has no rows, and read by the table to send it back to the top.
   */
  let resetKey = $state(0);

  /** The state the whole block renders (05-UI-SPEC section 2). */
  const playerState = $derived(derivePlayerState({ importedAt, shown, requested }));

  /**
   * The view on screen, and nothing for an answer that is not this dataset's.
   *
   * The stamp lives with the view, so a replace that lands mid-query returns
   * the block to `loading` by construction rather than through a hand-written
   * reset.
   */
  const view = $derived<VehicleView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  /**
   * The title state inside `ready`, and `ready` in every other state: the
   * attribute is read by tests and by plan 05-14's branches, so it must exist
   * in all of them rather than appearing only when a title has rows.
   */
  const titleState = $derived<TitleState>(view?.titleState ?? 'ready');

  /** The option label for one title, with its absent/empty suffix (D-05). */
  function optionText(title: VehicleTitleId): string {
    const entry = view?.overview.find((candidate) => candidate.title === title);
    if (entry === undefined) return VEHICLE_TITLE_LABELS[title];
    if (!entry.present) return formatTitleOption(title, 'not-in-export');
    if (entry.rows === 0) return formatTitleOption(title, 'no-rows');
    return formatTitleOption(title, 'ready');
  }

  /** The one neutral-info line for the two states with no table (D-05). */
  const titleStateLine = $derived.by(() => {
    if (view === null) return '';
    const label = VEHICLE_TITLE_LABELS[view.title];
    if (view.titleState === 'not-in-export') return formatTitleNotInExport(label);
    if (view.titleState === 'no-rows') return formatTitleNoRows(label);
    return '';
  });

  /**
   * D-13's two per-title figures, formatted through the ONE cell formatter the
   * table uses.
   *
   * The lifetime battle count is a `count` (an exact grouped integer) and the
   * premium expiry is `text` — passed through exactly as the export wrote it.
   * That is load-bearing rather than lazy: `1970-01-01 00:00:00` is an export
   * ARTEFACT, and parsing it into a local date would move it by a day for a
   * reader west of UTC and claim a timezone the file does not carry (D-01,
   * D-13). An `N/A` expiry reads `not available` and an `N/D` one `not defined`
   * for the same reason they do in a table cell, because it is the same code.
   *
   * Both are null when the title has no account file, which is what omits the
   * whole header — the omission is a property of the ANSWER rather than a
   * second list of titles kept here. Never the account's `NAME` column: that
   * is the nickname, and Phase 3 D-21 confines it to the identity header
   * (T-05-12c). `ViewHeader.battles` has no field for it either.
   */
  const headerBattles = $derived(
    view?.header === null || view === null ? null : formatVehicleCell(view.header.battles, 'count'),
  );
  const headerExpires = $derived(
    view === null || view.header === null
      ? null
      : formatVehicleCell(view.header.premiumExpires, 'text'),
  );

  /**
   * D-09's Warplanes 20 note, for the one title whose newer plane file has no
   * vehicle identifier at all.
   *
   * Keyed on the VIEW's `wowp20` rather than on the title id, because that is
   * the worker's statement that the file was in the zip AND held records; an
   * export without the file has nothing to say about it and a sentence about a
   * file that is not there would be a claim about the user's own data.
   */
  const wowp20Note = $derived(
    view?.wowp20 === null || view === null
      ? ''
      : formatWarplanes20Note(view.wowp20.records, view.wowp20.battles),
  );

  /**
   * D-07's partial-coverage note, and when there is one at all.
   *
   * It appears only when a CODE is applied, because it is a claim about a
   * filtered table: before a code is chosen the table IS the whole export and
   * there is nothing to qualify. Warplanes gets the tanks wording rather than a
   * third sentence, because it can never reach this branch — it has no
   * by_Type file, so it has no code to choose (E3, empty).
   */
  const battleTypeNote = $derived.by(() => {
    if (view === null || view.battleType === null) return '';
    return view.title === 'wows' ? BATTLE_TYPE_NOTE_WARSHIPS : BATTLE_TYPE_NOTE_TANKS;
  });

  /**
   * The extras the CURRENT view offers, in the view's own order (D-10).
   *
   * Derived from the view rather than from a fixed list, and that is the whole
   * design: the builder already resolves each extra's own header in THIS
   * file, so a list here would be a second, hand-maintained answer to "what
   * does this export have" that could disagree with the worker's. WoT's All
   * view offers seven and its battle-type view eight, and `maxDamage` is the
   * difference — the by_Type file has a `DAMAGE_MAX` column and the main file
   * does not.
   *
   * Core columns are excluded, and that is a decision rather than an
   * oversight: a checkbox that could switch off `Battles` would be a second
   * way to change the table's shape that no reset rule covers.
   */
  const extras = $derived(view === null ? [] : view.columns.filter((column) => !column.core));

  /** The drawn columns: the core six, plus whatever 05-14's picker adds. */
  const columns = $derived(
    view === null ? [] : visibleColumns(view.columns, selection.pickedExtraKeys),
  );

  /**
   * The drawn rows, filtered then ordered.
   *
   * Filter BEFORE sort, never after: `filterRows` explicitly does not reorder,
   * so the sort the reader chose survives typing in the box (D-11). Filtering
   * after sorting would work for the same data and would not survive a sort
   * whose key the filtered view no longer has.
   */
  const rows = $derived(
    view === null
      ? []
      : sortRows(filterRows(view.rows, selection.query), view.columns, selection.sort),
  );

  /**
   * The count line (D-12).
   *
   * Two sentences, and which one is shown says whether a filter is active —
   * a reader who typed a query and sees a bare total has no way to tell the
   * filter did nothing from the filter not being applied.
   */
  const countLine = $derived.by(() => {
    if (view === null) return '';
    if (selection.query.trim() !== '') {
      return formatVehicleSearchCount(rows.length, view.rows.length);
    }
    return formatVehicleCount(view.rows.length, zeroBattleCount(view.rows));
  });

  /** A search that matched nothing: the message replaces the table. */
  const noMatch = $derived(selection.query.trim() !== '' && rows.length === 0);

  /** The scroller's accessible name, and the hidden caption's text. */
  const regionName = $derived(
    view === null ? '' : formatVehicleRegionName(view.title, view.battleType),
  );

  /** The status paragraph's text; empty whenever there is nothing to say. */
  const statusText = $derived(playerStatusLine(playerState, announcement));
</script>

<!--
  The block's own root. `data-state` is the single hook a test and plan 05-14's
  branches both read, and `data-title-state` is D-05's second half: `ready` is a
  block state, and a title with no table is a title state, and they are not the
  same thing. `aria-busy` is true only in `loading` — in `updating` the
  previous table is on screen and correct, which `loading` is not.
-->
<div
  data-testid="player-stats"
  data-state={playerState}
  data-title-state={titleState}
  aria-busy={playerState === 'loading' ? 'true' : 'false'}
>
  <h3>{PLAYER_STATS_HEADING}</h3>

  <!--
    The block's one EXPLICIT live region, present in EVERY state and empty when
    nothing is happening: an empty live region announces nothing and adds no
    height, while a region that appeared only while loading would be announced
    by the insertion of the element rather than by its text.

    Empty means visually hidden, not absent. The block is a flex column with a
    24px gap, so a paragraph with no text would still hold a gap slot and push
    the table down by 24px in the one state that shows it; the clip pattern
    keeps the node in the accessibility tree — which is what makes the
    announcement work at all — while measuring nothing.
  -->
  <p
    class="status"
    class:hidden={statusText === ''}
    data-testid="player-stats-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {statusText}
  </p>

  {#if playerState === 'error'}
    <!--
      `role="alert"` and NO `aria-live` attribute. The role is what makes it
      announce, and it is an IMPLICIT live region — a screen reader treats
      `role="alert"` as `aria-live="assertive"` without the attribute being
      present. So this IS a live region, and it is not a third *explicit* one:
      the block still owns exactly one `aria-live` attribute, and the page-wide
      count `dashboard.spec.ts` asserts is unaffected by it. The copy is the
      fixed sentence from ui-copy.ts, never the worker's detail (T-05-31).
    -->
    <p class="body error" role="alert" data-testid="player-stats-error">{PLAYER_STATS_ERROR}</p>
  {:else if view !== null}
    <!--
      The controls row. `flex-wrap` with a 16px gap: at 375px the Game control
      and the search box stack rather than overflowing, and each control keeps
      its own max width so a long option name cannot widen the card. The row's
      own `flex-direction` lives in the stylesheet, where the reason it has to
      be explicit is written down.
    -->
    <div class="controls" data-testid="player-stats-controls">
      <div class="control">
        <label for={selectId}>{TITLE_CONTROL_LABEL}</label>
        <!--
          A native `<select>` (D-05): its keyboard and screen-reader behaviour
          is the platform's, and its options are export-derived text, which is
          rendered as text and never as markup (T-05-35).

          Options are NEVER disabled. A disabled option cannot be read in the
          content area, so the reason a title has no table has to live in the
          option text itself — which is what the suffix is for.
        -->
        <select
          id={selectId}
          data-testid="player-stats-title-selector"
          value={view.title}
          onchange={onTitleChange}
        >
          {#each VEHICLE_TITLES as title (title)}
            <option value={title} selected={view.title === title}>{optionText(title)}</option>
          {/each}
        </select>
      </div>

      <!--
        The Battle type control (D-07), between the Game control and the search
        box in DOM order so the tab order is Game, Battle type, Search, then
        the sort buttons left to right, then the scroller (05-UI-SPEC section 1
        and section 3, Keyboard).

        Rendered ONLY when the applied view has battle-type codes. A title with
        no by_Type file — Warplanes, or a tank title whose export held none —
        has nothing to choose between, and the control is ABSENT rather than
        disabled or reduced to one option: a control that can only ever hold its
        own value is a control the reader has to read past to find there is
        nothing there (E3, empty).

        `view.battleType` is the APPLIED code, never the requested one, so a
        request the worker declined renders as All battles rather than as a
        selection the data does not support. The value is the empty string for
        All battles, and the handler turns that back into `null` — see
        `onBattleTypeChange`.
      -->
      {#if view.battleTypes.length > 0}
        <div class="control">
          <label for={battleTypeId}>{BATTLE_TYPE_CONTROL_LABEL}</label>
          <select
            id={battleTypeId}
            data-testid="player-stats-battle-type-selector"
            value={view.battleType ?? ''}
            onchange={onBattleTypeChange}
          >
            <option value="" selected={view.battleType === null}>{BATTLE_TYPE_ALL_OPTION}</option>
            <!--
              One option per code in the view's own order, which the builder
              already sorted by the code's NUMERIC value (RESEARCH Pitfall 10:
              1, 2, 10 — not 1, 10, 2). A code is never named: the export records
              an identifier and no label, and a lookup table would be a guess
              about a game's internal enum.
            -->
            {#each view.battleTypes as code (code)}
              <option value={code} selected={view.battleType === code}>
                {formatBattleTypeLabel(code)}
              </option>
            {/each}
          </select>
        </div>
      {/if}

      <!--
        The search box, after the Game control in DOM order so the tab order
        is Game, then search, then the sort buttons left to right, then the
        scroller (05-UI-SPEC section 3, Keyboard).

        No placeholder: a placeholder is not a label — it disappears the moment
        the reader types, which is exactly when they need to know what the box
        is for. `type="search"` for the native clear affordance and the native
        Escape behaviour, so there is no key handler here to keep in step with
        the browser's.
      -->
      <div class="control">
        <label for={searchId}>{VEHICLE_SEARCH_LABEL}</label>
        <input
          id={searchId}
          type="search"
          data-testid="vehicle-search"
          value={selection.query}
          oninput={onSearchInput}
        />
      </div>
    </div>

    <!--
      D-13's per-title header, after the controls row and before everything
      else, exactly where the UI-SPEC's document order puts it: the two figures
      describe the ACCOUNT, while everything below describes one file of it.

      A `dl` and not a table or a pair of paragraphs, because it is a list of
      terms with their values and that is what a `dl` is for. The grid is
      `max-content 1fr` so the two labels line up in a column and the values
      wrap under each other at 375px rather than pushing the card wide.

      It is shown for a title with NO ROWS as well as a title with a table: the
      account file is a different file, and its figures are true whatever the
      vehicle file holds.
    -->
    {#if headerBattles !== null && headerExpires !== null}
      <dl class="header" data-testid="player-stats-header">
        <dt>{HEADER_LIFETIME_BATTLES_LABEL}</dt>
        <dd data-testid="lifetime-battles">
          {headerBattles.text}
          {#if headerBattles.hidden !== null}
            <span class="sr-only">{headerBattles.hidden}</span>
          {/if}
        </dd>
        <dt>{HEADER_PREMIUM_EXPIRES_LABEL}</dt>
        <dd data-testid="premium-expires">
          {headerExpires.text}
          {#if headerExpires.hidden !== null}
            <span class="sr-only">{headerExpires.hidden}</span>
          {/if}
        </dd>
      </dl>
    {/if}

    {#if titleStateLine !== ''}
      <p class="body info" data-testid="player-stats-title-state">{titleStateLine}</p>
    {/if}

    <!--
      D-09's Warplanes 20 note. A neutral-info line, not a warning: the file is
      there and it is real, it simply has no vehicle identifier and so cannot
      be a table. Saying so is more useful than omitting it, because a reader
      looking for a fourth plane would otherwise conclude the export lost it.
    -->
    {#if wowp20Note !== ''}
      <p class="body info" data-testid="warplanes-20-note">{wowp20Note}</p>
    {/if}

    <!--
      D-07's summary, above the `Vehicles` heading. It lists the codes of the
      Battle_Types file, which is a LONGER list than the select's: a code the
      export summarises but has no by_Type rows for cannot be selected, and the
      summary is the only place the reader learns it exists.
    -->
    {#if view.summary.length > 0}
      <BattleTypeSummary summary={view.summary} title={view.title} />
    {/if}

    {#if titleStateLine === ''}
      <h4>{VEHICLE_TABLE_TITLE}</h4>

      <!--
        The count line and the derived-value note sit ABOVE the table and the
        hints BELOW it, which is where the UI-SPEC puts them: the count is
        about the table the reader is about to look at, and the hints are about
        the scroller they have just scrolled.

        The count line renders in every state that has a table, INCLUDING a
        search that matched nothing — the no-match message replaces the table,
        not the count, because a reader has to be able to see that the filter
        is what emptied it.
      -->
      <p class="caption count" data-testid="vehicle-count">{countLine}</p>
      <!--
        D-07's note, under the count line and before the derived-value note: it
        qualifies the COUNT the reader is looking at, so it belongs beside it
        rather than at the foot of the block. Neutral-info chrome, not chrome
        for a failure — partial battle-type coverage is a fact about a real
        export, not an error.
      -->
      {#if battleTypeNote !== ''}
        <p class="body info" data-testid="battle-type-note">{battleTypeNote}</p>
      {/if}
      <p class="caption note">{VEHICLE_DERIVED_NOTE}</p>

      <!--
        D-10's column picker, and the reason it is a picker and not a row
        expand: expanding a row changes its height, and the windowing divides
        by a CONSTANT row height, so one expanded row would put the window out
        of step with the pad that reserved space for it (RESEARCH Pitfall 15).
        Choosing columns changes the WIDTH, which the scroller already handles.

        A native `<details>` and a native `<fieldset>` of native checkboxes,
        because every one of those behaviours is the platform's and none of
        them needs a keyboard handler that could drift from the browser's. The
        summary is a button-LOOKING control and is still a `<summary>`: it is
        the disclosure, so wrapping it in a button would be two tab stops for
        one action.
      -->
      {#if extras.length > 0}
        <details class="picker" data-testid="column-picker">
          <summary>{COLUMN_PICKER_SUMMARY}</summary>
          <fieldset>
            <legend>{COLUMN_PICKER_LEGEND}</legend>
            {#each extras as column (column.key)}
              <label class="toggle">
                <input
                  type="checkbox"
                  data-testid="column-toggle-{column.key}"
                  checked={selection.pickedExtraKeys.includes(column.key)}
                  onchange={(event) =>
                    onExtraToggle(column.key, (event.currentTarget as HTMLInputElement).checked)}
                />
                <span>{VEHICLE_COLUMN_LABELS[column.key]}</span>
              </label>
            {/each}
          </fieldset>
        </details>
      {/if}

      {#if noMatch}
        <p class="body info" data-testid="vehicle-no-match">{VEHICLE_NO_MATCH}</p>
      {:else}
        <!--
          D-08's note, above the table and only for the one view it is true of.
          `allBattlesOnly` is the WORKER's statement that this view has no
          per-ship figure to show, so the note cannot drift onto a Warships
          battle-type view — which does have the figures and where "choose a
          battle type" would be a reader looking at a table they are already
          in.
        -->
        {#if view.allBattlesOnly}
          <p class="caption note" data-testid="warships-all-note">{WARSHIPS_ALL_NOTE}</p>
        {/if}
        <VehicleTable
          {columns}
          {rows}
          sort={selection.sort}
          {onSort}
          {regionName}
          {resetKey}
          updating={playerState === 'updating'}
        />
      {/if}

      <!--
        The two hints, as real text rather than tooltips. The windowing's cost
        is that a browser's find-in-page skips the rows that are not in the
        DOM; saying so, and naming the box that does find them, is the honest
        thing to do and is why the search is a control at all.
      -->
      <p class="caption hint">{VEHICLE_SCROLL_HINT}</p>
      <p class="caption hint">{VEHICLE_FIND_HINT}</p>
    {/if}
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
     (04-UI-SPEC Typography, the sub-heading h3 row). `Playtime.svelte` repeats
     this rule in full, because scoped styles cannot be shared. */
  h3 {
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #dadce0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #08060d;
  }

  /* The table title, an h4 so the outline is h1 > h2 section > h3 block >
     h4 table and nothing skips a level (05-UI-SPEC section 1). */
  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #3c4043;
  }

  .status {
    margin: 0;
    min-height: 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #3c4043;
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
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #3c4043;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Caption role: the count line, the derived-value note and the two hints.
     Real text under the table rather than tooltips, because they describe the
     table for a reader who is looking AT it, and `overflow-wrap: anywhere` so
     a 60-character vehicle id cannot widen the card at 375px. 14/400/1.4 is the
     UI-SPEC's Caption row exactly — Label size at Body weight — and this rule
     was 12px until 05-20, which put it below the floor the same spec sets
     (G-05-10). */
  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The count line is the one Caption a reader looks FOR, so it is the one
     that gets the body's weight — it is a figure, not an aside. */
  .count {
    font-size: 14px;
    font-weight: 600;
    color: #3c4043;
  }

  /* Neutral info, not chrome for a failure: an absent title or a title with
     no rows is a fact about the export, and the destructive red is reserved
     for a query that failed. */
  .info {
    padding: 8px 12px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #f7f7fa;
    color: #3c4043;
  }

  /* The project's destructive error colour, reused verbatim from
     FailureBanner rather than re-picked (05-UI-SPEC Color). */
  .error {
    padding: 8px 12px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
  }

  /* The controls row: a flex row that WRAPS, so at 375px the Game control and
     the search box stack rather than overflowing (UI-SPEC section 14). Each
     control is a column of a Label above the control with a 4px gap (the Phase
     4 selector-row).

     `flex-direction: row` is EXPLICIT and load-bearing. The bare `div` rule at
     the top of this stylesheet gives every div in the component
     `flex-direction: column`, so a flex container here is a column until it
     says otherwise — which is what made these controls stack at 215px tall at
     every width until 05-20 (G-05-8). A row cannot fix that by removing the
     wrap: `flex-wrap` is what keeps the row honest at 375px, and the unit
     guard in `tests/unit/phase5-layout-guards.test.ts` pins both declarations
     together for exactly that reason. */
  .controls {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px;
    min-width: 0;
  }

  .control {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .control label {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #3c4043;
  }

  /* Label role, the Phase 4 select exactly (05-UI-SPEC section 3). The
     `:focus-visible` ring is the project's accent ring, exactly: the accent is
     reserved for focus, and this is a new member of "every interactive
     element". */
  select {
    max-width: 100%;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #ffffff;
    color: #3c4043;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }

  select:hover {
    background: #f1f3f4;
  }

  select:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  /* The search box: the select's chrome exactly (05-UI-SPEC section 3), with
     Body 16/400 text rather than Label 14/600 — what is typed into a box is
     the reader's own words, not a label. The same accent focus ring, because
     it is a new member of "every interactive element" and the accent is
     reserved for focus. */
  input {
    max-width: 100%;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #ffffff;
    color: #3c4043;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.4;
  }

  input:hover {
    background: #f1f3f4;
  }

  input:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  /* D-13's per-title header. A two-column grid rather than a table, so it is
     two labelled facts and not a two-row table competing with the one below
     it; `max-content 1fr` lines the labels up in a column and gives the values
     everything else, so an expiry written as a long string wraps under itself
     at 375px rather than widening the card. */
  .header {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;
    min-width: 0;
  }

  /* Label role, the muted colour the UI-SPEC's "Per-title header dt" row
     specifies. */
  .header dt {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  /* Body role in the body colour, wrapping. The expiry is the export's own
     string and may be anything the game wrote, so the wrap rule is the same
     one every other untrusted string in the project uses. */
  .header dd {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #08060d;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* D-10's column picker. The `<summary>` is styled as a button — the shared
     control chrome, the same 1px `#80868b` border, 6px radius and 8px/12px
     padding as the two selects above it — because it IS the control, and a
     reader should not have to tell one kind of control from another by shape.
     The accent focus ring is the project's, exactly: the accent is reserved
     for focus, and this is a new member of "every interactive element". */
  .picker {
    min-width: 0;
  }

  .picker > summary {
    display: inline-block;
    padding: 8px 12px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #ffffff;
    color: #3c4043;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    cursor: pointer;
  }

  .picker > summary:hover {
    background: #f1f3f4;
  }

  .picker > summary:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  /* A fieldset rather than a div: the checkboxes are ONE control group, and a
     screen reader announces them as one thing with a name. The legend is the
     Label role, muted, matching the two control labels above. */
  .picker fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 12px 0 0;
    padding: 8px 12px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    min-width: 0;
  }

  .picker legend {
    padding: 0 4px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  /* Body-weight Caption label beside a native checkbox, per the UI-SPEC — 14px
     like every other Caption, which it was not until 05-20 (G-05-10). The
     native input is left at the platform's own size: restyling a checkbox is
     how a control stops looking like the one every other platform shows. */
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
    cursor: pointer;
  }

  .toggle input:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  /* Visually hidden but in the accessibility tree, the same clip pattern the
     status line uses: a cell that says `—` needs its `no battles` beside it,
     and a hidden span is the only way to add words without adding width. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
