<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import type { TitleState, VehicleTitleId, VehicleRow, VehicleView } from './vehicle-shared.ts';
  import { VEHICLE_TITLES } from './vehicle-shared.ts';
  import {
    filterRows,
    nextSort,
    sortRows,
    visibleColumns,
    zeroBattleCount,
  } from './vehicle-model.ts';
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
    VEHICLE_SEARCH_ACCOUNT_HINT,
    VEHICLE_SEARCH_LABEL,
    VEHICLE_TABLE_TITLE,
    VEHICLE_TITLE_LABELS,
    WARSHIPS_ALL_NOTE,
    WOWP_ACCOUNT_COLUMN_LABELS,
    WOWP_ACCOUNT_STATS_HEADING,
    WOWP_FILE_LABELS,
    formatBattleTypeLabel,
    formatGameName,
    formatNewDataSkipped,
    formatNoVehicleTable,
    formatTitleNoRows,
    formatTitleNotInExport,
    formatTitleOption,
    formatVehicleAnnouncement,
    formatVehicleCell,
    formatVehicleCount,
    formatVehicleRegionName,
    formatVehicleSearchCount,
    formatWarplanes20Note,
  } from '../../ui-copy.ts';
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
  } from './vehicle-state.ts';
  import BattleTypeSummary from './BattleTypeSummary.svelte';
  import VehicleTable from './VehicleTable.svelte';
  import {
    filterAfterTitleChange,
    hasNoVehicleTable,
    vehicleTitleForAsk,
    type AnyVehicleTitle,
  } from '../../shell/game-filter-state.ts';
  import { accountTagsFor, tagLabel } from '../../shell/identity-model.ts';
  import AccountTag from '../../shell/AccountTag.svelte';
  import { orderRowsByAccount } from '../new-data/new-data-state.ts';

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
    /**
     * The shared game filter (Phase 10, D-04/D-21): the applied token, or `null`
     * for All games.
     *
     * This block has NO chip row and no widget of its own: the existing Game
     * select IS the filter's face here (UI-SPEC Recorded Choice 1), so the filter
     * travels in and out through two pure functions and nothing else.
     */
    gameFilter: string | null;
    /** Write the shared filter after the reader picks a title in the select. */
    onGameFilterChange: (token: string | null) => void;
    /**
     * The title this block last APPLIED under the dataset on screen, or `null`
     * (11-06, D-06).
     *
     * It is a prop rather than a cell here because it has to survive this pane
     * unmounting, and `Dashboard.svelte` already holds it stamped with its
     * dataset. Only HEAT and WoT Console read it: those two games have sessions
     * but no vehicle table, so `vehicleTitleForAsk` keeps showing the reader's
     * last table instead of falling back to whatever the worker picks.
     */
    lastTitle: AnyVehicleTitle | null;
    /**
     * Report the title the worker APPLIED, so the shell can remember it.
     *
     * APPLIED, never requested: a `null` ask comes back as the worker's first
     * title with rows, and that is the table the reader is looking at, so it is
     * the title that has to be remembered for next time (T-11-20).
     */
    onTitleApplied: (title: VehicleTitleId) => void;
  }

  let { result, client, gameFilter, onGameFilterChange, lastTitle, onTitleApplied }: Props =
    $props();

  /**
   * The control ids for the two labels, generated rather than hand-written so
   * two blocks on one page could not share a `for`. `$props.id()` yields one
   * id, so the second is that id with a suffix rather than a second call —
   * Svelte allows the call exactly once per component.
   */
  const selectId = $props.id();
  const searchId = `${selectId}-search`;
  const battleTypeId = `${selectId}-battle-type`;
  /** The hint's own id, so the input can point at it (D-11). */
  const searchHintId = `${selectId}-search-hint`;

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
      //
      // `wantedImportedAt !== null` narrows the stamp to a string for the
      // else-branch below. `load` is only issued after the effect saw a dataset,
      // which is also when the stamp is set, so a null here means no dataset was
      // ever requested and there is nothing to roll back.
      if (
        outcome.kind !== 'superseded' &&
        wantedImportedAt !== null &&
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
      // D-06: the shell remembers the APPLIED title, because that is the table
      // on screen and therefore the one HEAT and WOTC will fall back to next
      // time. A title the worker DECLINED is never recorded, and the worker's
      // own first-title-with-rows choice becomes the remembered one instead.
      onTitleApplied(accepted.view.title);
    } else {
      requested = { importedAt: ask.importedAt, title: ask.title, battleType: ask.battleType };
    }
  }

  /**
   * The picker label for a column key, from the copy inventory.
   *
   * The same widening `VehicleTable.svelte`'s `headerLabel` uses: the inventory
   * is a frozen object with known keys and a column key is a plain string. A key
   * the copy does not name yet is shown as itself rather than as an empty label;
   * `vehicle-blocks.test.ts` fails if a real view's column falls through here.
   */
  function columnLabel(key: string): string {
    return (VEHICLE_COLUMN_LABELS as Record<string, string>)[key] ?? key;
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
      //
      // Phase 10's half of that line: the first ask now names the shared
      // filter's title, read INSIDE `untrack` so the effect still depends on
      // `importedAt` alone. With a filter set, opening Vehicles opens that
      // game; with All it is `null` and the worker's first-title-with-rows rule
      // applies exactly as it always did (D-21).
      //
      // 11-06 adds D-06's case to that sentence: HEAT and WoT Console have no
      // vehicle table, so `vehicleTitleForAsk` asks for the title this dataset
      // last showed rather than clearing the filter to explain itself. Every
      // other filter value goes through `filterToTitle` unchanged, which is why
      // the helper rather than an `if`.
      const ask: VehicleAsk = {
        importedAt: wanted,
        title: vehicleTitleForAsk(gameFilter, lastTitle),
        battleType: null,
      };
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
    // D-21: WoT, WoT Blitz and Warships ARE the shared filter; Warplanes is
    // Vehicles-local and leaves it exactly as it was. The write happens AFTER
    // the load, so a title the worker then declines cannot leave the filter
    // claiming a game the select is not showing — the select always renders
    // `view.title`, the APPLIED one.
    onGameFilterChange(filterAfterTitleChange(control.value, gameFilter));
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
   * D-06's note: the shared filter names a game with no vehicle table, and the
   * table below is the reader's last one rather than that game's.
   *
   * Keyed on `view`, not on `gameFilter` alone, so it is ABSENT in the loading
   * and error states and present only over a table that is really on screen —
   * naming a table that is still loading would be a claim about data nobody
   * can see yet. The game's LABEL goes through `formatGameName` rather than
   * the raw token, because a chip reading `WOTC` is not an explanation.
   *
   * No `aria-live`, deliberately: the block owns exactly one live region and the
   * page-wide count `dashboard.spec.ts` asserts must stay true. A note that
   * appeared silently while the filter changed elsewhere is also not a change
   * the reader made here — Vehicles and Playtime are never mounted together, so
   * the filter cannot move while this line is on screen (UI-SPEC Surface 5).
   */
  const noTableNote = $derived.by(() => {
    if (view === null || !hasNoVehicleTable(gameFilter)) return '';
    return formatNoVehicleTable(formatGameName(gameFilter), VEHICLE_TITLE_LABELS[view.title]);
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
   *
   * D-20: `headerBattles` is the SUM across the accounts that contribute, and
   * `headerExpires` is `null` as soon as two or more do — the expiry belongs to
   * one account's premium status and has no combined form, so the header shows
   * one figure instead of two rather than showing a figure that is not true
   * (T-10-11). With ONE account both are exactly what v1.0 showed.
   */
  const headerBattles = $derived(
    view?.header === null || view === null ? null : formatVehicleCell(view.header.battles, 'count'),
  );
  const headerExpires = $derived(
    view === null || view.header === null || view.header.premiumExpires === null
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
   * The Warplanes files named in words because every column of them was
   * dropped (D-09), as their constant labels.
   *
   * The key is looked up in a closed table and an unknown one is dropped, so a
   * zip entry name can never be what the page prints (T-11-35).
   */
  const wowpSkippedFiles = $derived(
    view === null || view.wowpAccount === null
      ? []
      : view.wowpAccount.skipped
          .filter((key) => Object.hasOwn(WOWP_FILE_LABELS, key))
          .map((key) => WOWP_FILE_LABELS[key]!),
  );

  /** The heading of one block column; an unlabelled id is shown as itself. */
  function wowpColumnLabel(id: string): string {
    return Object.hasOwn(WOWP_ACCOUNT_COLUMN_LABELS, id) ? WOWP_ACCOUNT_COLUMN_LABELS[id]! : id;
  }

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
   * D-10's tags: `null` for a single-account dataset, the map otherwise.
   *
   * Derived from `result` rather than from the view, because the letters belong
   * to the ACCOUNT list — the identity header's own D-16 order — and not to
   * whichever title's rows happen to be on screen. The same expression therefore
   * gives every pane the same letter for the same account by construction.
   */
  const tags = $derived(accountTagsFor(result));

  /**
   * D-02's Warplanes account statistics: the accounts in the identity header's
   * order, so this block and the table below it read the same way.
   *
   * Ordered through the tag map by `orderRowsByAccount`, which consults a `Map`
   * and never an object keyed by account, so a root literally named `__proto__`
   * is an ordinary key (T-10-09). With one account the tag map is null and the
   * list comes back unchanged. The block's values are the view's own cells and
   * never carry a nickname: the type has no field for one.
   */
  const wowpAccounts = $derived(
    view === null || view.wowpAccount === null
      ? []
      : orderRowsByAccount(view.wowpAccount.accounts, tags),
  );

  /**
   * D-11: the extra strings one row matches on — its account's LETTER and its
   * account's ROOT, each compared on its own by `filterRows`.
   *
   * `undefined` (not an empty array) when there are no tags, so `filterRows`
   * takes its third argument as absent and behaves exactly as v1.0's caller
   * did. A row whose root the map does not hold contributes nothing, which is
   * what stops an unrecognised account from matching an empty string.
   */
  const accountTextOf = $derived(
    tags === null
      ? undefined
      : (row: VehicleRow): readonly string[] => {
          const tag = tags.get(row.account);
          return tag === undefined ? [] : [tag.letter, tag.root];
        },
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
      : sortRows(
          filterRows(view.rows, selection.query, accountTextOf),
          view.columns,
          selection.sort,
        ),
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

        D-11: `aria-describedby` appears only when the hint does. With one
        account the attribute is ABSENT rather than pointing at nothing, so the
        single-account input is exactly the element v1.0 rendered — an empty
        `aria-describedby` would still be an attribute a test and a screen
        reader both have to interpret.
      -->
      <div class="control">
        <label for={searchId}>{VEHICLE_SEARCH_LABEL}</label>
        <input
          id={searchId}
          type="search"
          data-testid="vehicle-search"
          value={selection.query}
          oninput={onSearchInput}
          aria-describedby={tags === null ? undefined : searchHintId}
        />
        <!--
          The hint, directly under the input and inside the same `.control`, so
          the 4px gap the CSS puts between a label and its control is the gap
          between the input and this line too. The `{#if}` and the `<p>` sit
          flush against the `<input>`'s closing tag: a newline there would put a
          whitespace text node inside every single-account control, which the
          layout specs read.
        -->
        {#if tags !== null}<p
            class="caption search-hint"
            id={searchHintId}
            data-testid="vehicle-search-hint"
          >
            {VEHICLE_SEARCH_ACCOUNT_HINT}
          </p>{/if}
      </div>
    </div>

    <!--
      D-06's note, directly under the controls and above everything else. It is
      a neutral-info line in the same chrome as the title-state note below —
      this is a fact about the filter, not a failure of the export — and it
      carries no `aria-live`; see `noTableNote`.
    -->
    {#if noTableNote !== ''}
      <p class="body info" data-testid="vehicles-no-table-note">{noTableNote}</p>
    {/if}

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

      D-20: the OUTER gate is the lifetime figure alone, and the expiry term is
      its own inner gate. Two or more accounts sum their battles and leave the
      expiry out, rather than dropping the whole header — a combined header with
      one honest figure beats either no header or a header whose second figure
      belongs to one account out of several (T-10-11). With one account both
      gates are true and this markup is byte-identical to what v1.0 rendered.
    -->
    {#if headerBattles !== null}
      <dl class="header" data-testid="player-stats-header">
        <dt>{HEADER_LIFETIME_BATTLES_LABEL}</dt>
        <dd data-testid="lifetime-battles">
          {headerBattles.text}
          {#if headerBattles.hidden !== null}
            <span class="sr-only">{headerBattles.hidden}</span>
          {/if}
        </dd>
        {#if headerExpires !== null}
          <dt>{HEADER_PREMIUM_EXPIRES_LABEL}</dt>
          <dd data-testid="premium-expires">
            {headerExpires.text}
            {#if headerExpires.hidden !== null}
              <span class="sr-only">{headerExpires.hidden}</span>
            {/if}
          </dd>
        {/if}
      </dl>
    {/if}

    <!--
      D-02's Warplanes account statistics, directly after the per-title header and
      before the title-state line: they describe the ACCOUNT, as the header does,
      while everything below describes the plane files.

      Gated on the view's own `wowpAccount`, which the worker sets for the
      Warplanes title alone and only when there is something to show, so every
      other title and the loading and error states render byte-identically to
      before. An account without the record has no entry and nothing stands in
      for it. Every value is text-interpolated and goes through the one cell
      formatter the table and the header use. It adds no live region: the block is
      shown with the view it belongs to and the page already announces that view.

      The tag line is drawn only when the identity header has a tag map (two or
      more accounts), flush against the `dl` with no whitespace between them.
    -->
    {#if view.wowpAccount !== null}
      <h4>{WOWP_ACCOUNT_STATS_HEADING}</h4>
      {#each wowpAccounts as entry (entry.account)}
        {@const tag = tags === null ? null : (tags.get(entry.account) ?? null)}
        <div class="wowp-account">
          {#if tag !== null}<p class="wowp-tag">
              <AccountTag letter={tag.letter} label={tagLabel(tag)} />
            </p>{/if}
          <dl class="header" data-testid="wowp-account-stats">
            {#each view.wowpAccount.columns as column, index (column.id)}
              {@const shown = formatVehicleCell(entry.cells[index]!, column.kind)}
              <dt>{wowpColumnLabel(column.id)}</dt>
              <dd>
                {shown.text}
                {#if shown.hidden !== null}
                  <span class="sr-only">{shown.hidden}</span>
                {/if}
              </dd>
            {/each}
          </dl>
        </div>
      {/each}
      {#each wowpSkippedFiles as file (file)}
        <p class="body info" data-testid="wowp-skipped">{formatNewDataSkipped(file)}</p>
      {/each}
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
                <span>{columnLabel(column.key)}</span>
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
          {tags}
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
    gap: var(--space-24);
    position: relative;
    min-width: 0;
  }

  /* Label role with the group-heading affordance: the sub-heading reads as a
     level of its own inside the card rather than as another 14px line
     (04-UI-SPEC Typography, the sub-heading h3 row). `Playtime.svelte` repeats
     this rule in full, because scoped styles cannot be shared. */
  h3 {
    margin: 0;
    padding-bottom: var(--space-8);
    border-bottom: 1px solid var(--border);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    color: var(--ink);
  }

  /* The table title, an h4 so the outline is h1 > h2 section > h3 block >
     h4 table and nothing skips a level (05-UI-SPEC section 1). */
  h4 {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    color: var(--text);
  }

  .status {
    margin: 0;
    min-height: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;

    /* The empty status line, hidden without leaving the accessibility tree. The
       clip pattern, not `display: none`: a region that is not in the tree cannot
       be announced, and this one is where the selection change is read out. */
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

  /* The text block comes from the shared layer now. The local `.body` is
     deleted, not tokenised: the shared `.body` in `src/styles/utilities.css`
     declares the same seven values (margin 0, min-width 0, 14/400/1.5, `--text`,
     `overflow-wrap: anywhere`), and a scoped local copy would outrank the
     shared one - the migration would have been a no-op with extra steps. The
     markup keeps `class="body"`, `class="body error"` and `class="body info"`. */

  /* Caption role: the count line, the derived-value note and the two hints.
     Real text under the table rather than tooltips, because they describe the
     table for a reader who is looking AT it, and `overflow-wrap: anywhere` so
     a 60-character vehicle id cannot widen the card at 375px. 14/400/1.4 is the
     UI-SPEC's Caption row exactly — Label size at Body weight — and this rule
     was 12px until 05-20, which put it below the floor the same spec sets
     (G-05-10).

     The rule itself is deleted, not tokenised: the shared `.caption` in
     `src/styles/utilities.css` declares the same seven values, and a scoped
     local copy would outrank the shared one. The markup keeps `class="caption"`
     and `class="caption search-hint"`. */

  /* The count line is the one Caption a reader looks FOR, so it is the one
     that gets the body's weight — it is a figure, not an aside. The hook stays
     local and only lifts the weight and the colour: the shared `.caption`
     supplies the margin, the min-width, the 1.4 leading, the muted colour and
     the wrap, exactly as the deleted local `.caption` did. */
  .count {
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    color: var(--text);
  }

  /* Neutral info, not chrome for a failure: an absent title or a title with
     no rows is a fact about the export, and the destructive red is reserved
     for a query that failed. */
  .info {
    padding: var(--space-8) var(--space-12);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--list);
    color: var(--text);
  }

  /* The project's destructive error colour, reused verbatim from
     FailureBanner rather than re-picked (05-UI-SPEC Color). The rule itself is
     deleted, not tokenised: the shared `.error` in `src/styles/utilities.css`
     declares the same chrome with the same three status colours as tokens
     (`--danger`, `--danger-bg`, `--danger-ink`), and the markup keeps
     `class="body error"`. */

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
     guard in `tests/unit/guards/phase5-layout-guards.test.ts` pins both declarations
     together for exactly that reason. */
  .controls {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-16);
    min-width: 0;
  }

  .control {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;

    & label {
      font-size: var(--fs-body);
      font-weight: var(--fw-semibold);
      line-height: var(--lh-tight);
      color: var(--text);
    }
  }

  /* D-11's search hint: the shared `.caption` rule with ONE addition, a 1.5
     line height instead of the captions' 1.4. A hint sits under a control the
     eye is about to use, so it gets the airier leading of a line the reader
     reads rather than the tight leading of a table caption; everything else —
     the 14px, the 400 weight, the `--muted` colour and the zero margin, the
     `.control` column's own `gap: 4px` doing the separating — is the caption
     family unchanged, which is what stops a later edit styling this hint as a
     label and making it look like a second control. The margin 0 comes from
     the shared caption, so this hook declares the leading and nothing else. */
  .search-hint {
    line-height: var(--lh-body);
  }

  /* Label role, the Phase 4 select exactly (05-UI-SPEC section 3). The
     `:focus-visible` ring is the project's accent ring, exactly: the accent is
     reserved for focus, and this is a new member of "every interactive
     element". */
  select {
    max-width: 100%;
    min-width: 0;
    padding: var(--space-8) var(--space-12);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--page);
    color: var(--text);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);

    &:hover {
      background: var(--hover);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }

  /* The search box: the select's chrome exactly (05-UI-SPEC section 3), with
     Body 16/400 text rather than Label 14/600 — what is typed into a box is
     the reader's own words, not a label. The same accent focus ring, because
     it is a new member of "every interactive element" and the accent is
     reserved for focus. */
  input {
    max-width: 100%;
    min-width: 0;
    padding: var(--space-8) var(--space-12);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--page);
    color: var(--text);
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-tight);

    &:hover {
      background: var(--hover);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }

  /* D-13's per-title header. A two-column grid rather than a table, so it is
     two labelled facts and not a two-row table competing with the one below
     it; `max-content 1fr` lines the labels up in a column and gives the values
     everything else, so an expiry written as a long string wraps under itself
     at 375px rather than widening the card. */
  .header {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-4) var(--space-16);
    margin: 0;
    min-width: 0;

    /* Label role, the muted colour the UI-SPEC's "Per-title header dt" row
       specifies. */
    & dt {
      font-size: var(--fs-body);
      font-weight: var(--fw-semibold);
      line-height: var(--lh-tight);
      color: var(--muted);
    }

    /* Body role in the body colour, wrapping. The expiry is the export's own
       string and may be anything the game wrote, so the wrap rule is the same
       one every other untrusted string in the project uses. */
    & dd {
      margin: 0;
      font-size: var(--fs-body);
      font-weight: var(--fw-regular);
      line-height: var(--lh-body);
      color: var(--ink);
      min-width: 0;
      overflow-wrap: anywhere;
    }
  }

  /* D-02's per-account block: the tag line, when there is one, sits 4px above
     its `dl` (UI-SPEC Surface 5). A plain column; the bare `div` rule above gives
     every div a 24px gap, which is the gap BETWEEN blocks and not inside one. */
  .wowp-account {
    gap: var(--space-4);
  }

  .wowp-tag {
    margin: 0;
    font-size: var(--fs-body);
    line-height: var(--lh-tight);
    color: var(--text);
  }

  /* D-10's column picker. The `<summary>` is styled as a button — the shared
     control chrome, the same 1px `var(--faint)` border, 6px radius and 8px/12px
     padding as the two selects above it — because it IS the control, and a
     reader should not have to tell one kind of control from another by shape.
     The accent focus ring is the project's, exactly: the accent is reserved
     for focus, and this is a new member of "every interactive element". */
  .picker {
    min-width: 0;

    & > summary {
      display: inline-block;
      padding: var(--space-8) var(--space-12);
      border: 1px solid var(--faint);
      border-radius: var(--radius-sm);
      background: var(--page);
      color: var(--text);
      font-size: var(--fs-body);
      font-weight: var(--fw-semibold);
      line-height: var(--lh-tight);
      cursor: pointer;

      &:hover {
        background: var(--hover);
      }

      &:focus-visible {
        outline: 3px solid var(--focus);
        outline-offset: 2px;
      }
    }

    /* A fieldset rather than a div: the checkboxes are ONE control group, and a
       screen reader announces them as one thing with a name. The legend is the
       Label role, muted, matching the two control labels above. */
    & fieldset {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4) var(--space-16);
      margin: var(--space-12) 0 0;
      padding: var(--space-8) var(--space-12);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      min-width: 0;
    }

    & legend {
      padding: 0 var(--space-4);
      font-size: var(--fs-body);
      font-weight: var(--fw-semibold);
      line-height: var(--lh-tight);
      color: var(--muted);
    }
  }

  /* Body-weight Caption label beside a native checkbox, per the UI-SPEC — 14px
     like every other Caption, which it was not until 05-20 (G-05-10). The
     native input is left at the platform's own size: restyling a checkbox is
     how a control stops looking like the one every other platform shows.

     The 4px gap between the checkbox and its label is the phase's ONE spacing
     snap (D-04, UI-SPEC Spacing Scale): the rule said 6px, and 6px is off the
     4 / 8 / 12 / 16 / 24 scale. The value is the owner's, not the executor's. */
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-tight);
    color: var(--muted);
    cursor: pointer;

    & input:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
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
