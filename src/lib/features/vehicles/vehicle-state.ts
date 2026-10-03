import { acceptDataOutcome, type ShownBlock } from '../finance/finance-state.ts';
import type { DataOutcome } from '../../core/query-client.ts';
import type { DataQuery } from '../../core/types/worker-messages.ts';
import type { VehicleTitleId, VehicleView } from './vehicle-shared.ts';
import { DEFAULT_SORT, type SortState } from './vehicle-model.ts';
import { PLAYER_STATS_ERROR, PLAYER_STATS_LOADING, PLAYER_STATS_UPDATING } from '../../ui-copy.ts';

// =============================================================================
// The Vehicle statistics block's decisions, as pure functions (05-12).
//
// ## Why this module exists at all
//
// `PlayerStats.svelte` holds DOM wiring and nothing else. Everything that can
// be wrong while a query is in flight is here, because the failures that
// matter are not visual: they are a previous export's vehicles under a new
// export's heading, a title switch that leaves the table reading "Updating
// table..." forever, or a worker's internal detail printed under a heading
// that promises the user their data is fine.
//
// ## The two keys, and why two are needed here (Phase 4's rule, unchanged)
//
// `importedAt` is the dataset identity, a primitive string. A replace changes
// it, a clear removes it, and an answer stamped with a different one belongs to
// a dashboard nobody is looking at any more. `shown` therefore holds the
// `importedAt` it answers for TOGETHER WITH the view, and a mismatch is "no
// answer" rather than a value to display.
//
// `requested` is the ask that is in flight. The difference between the request
// and what is on screen IS the `updating` state, and comparing the two —
// rather than setting a flag — is what stops a request left over from a
// replaced dataset, or a battle type the worker declined, from holding a
// healthy table at "Updating table..." forever (T-05-37).
//
// ## `appliedAsk` is the reconcile, and it is not optional
//
// The worker answers with the values it APPLIED, not the ones it was asked
// for: a battle-type code the export does not have comes back as All battles,
// and a `null` title comes back as the first title with rows (D-05). So after
// an answer is applied, `requested` is rewritten to what the view actually
// applied. Without that the block would compare an ask the worker deliberately
// declined against a view that never intended to honour it, and sit in
// `updating` with nothing on the way to change that.
//
// ## T-05-35, T-05-37
//
// `acceptVehicleOutcome` is the trust boundary. It drops a superseded answer,
// an answer for a dataset other than the one on screen, a result stamped with
// no dataset or another one, a result with no view, and a result carrying
// another channel's view. The worker's `detail` is deliberately NOT carried
// into the failed block: it can name a file path, so the fixed sentence in
// `ui-copy.ts` is the only one that is true either way, and there is nowhere
// in this module for a worker string to be read from.
// =============================================================================

/** The four states of the 05-UI-SPEC "player-stats" matrix, plus nothing. */
export type PlayerState = 'loading' | 'ready' | 'updating' | 'error';

/**
 * One ask of the `vehicles` channel, remembered with the dataset it was asked
 * for.
 *
 * A `null` title or battle type is not a request for "nothing" — it is the
 * request that lets the worker PICK: the first title that has rows (else WoT)
 * and All battles (D-05). The block never guesses, because the guess would
 * have to be re-guessed in the table model and could disagree with it.
 */
export interface VehicleAsk {
  /** The dataset on screen when the request was made. */
  importedAt: string;
  /** The requested title; null means "whichever the worker applies". */
  title: VehicleTitleId | null;
  /** The requested battle type; null means All battles. */
  battleType: string | null;
}

/**
 * One applied answer, stamped with the ask that produced it.
 *
 * Two variants and no third: a view that can be rendered, or a failure that
 * cannot. A `view` holds the whole view including the `overview` the title
 * selector draws its four options from, so the component never re-derives the
 * export's presence facts from the one title on screen.
 */
export type ShownVehicles = ShownBlock<VehicleView>;

/** Everything the state derivation reads, and nothing it has to compute. */
export interface PlayerStateInput {
  /** The dataset on screen now, or null when none is. */
  importedAt: string | null;
  /** The last applied answer, or null when there is none. */
  shown: ShownVehicles | null;
  /** The ask in flight, or null when nothing is being asked for. */
  requested: VehicleAsk | null;
}

/**
 * The one state the block renders (05-UI-SPEC section 2).
 *
 * The order of the tests IS the order of the questions, cheapest and most
 * disqualifying first:
 *
 *   1. Is there a dataset, and is what we are showing an answer for THAT
 *      dataset? A replace that lands mid-query therefore returns the block to
 *      `loading` by construction rather than through a hand-written reset.
 *   2. Did the answer fail? `error`.
 *   3. Does the ask on screen still differ from what the view applied? That
 *      difference is `updating` — the previous table stays visible, correct,
 *      and not the one being asked about.
 *
 * A `requested` stamped with ANOTHER dataset is not an ask this dataset is
 * waiting on, so it cannot put the block in `updating`: comparing the stamps is
 * what keeps a request left over from a replaced export from reading as a
 * pending one forever.
 */
export function derivePlayerState({ importedAt, shown, requested }: PlayerStateInput): PlayerState {
  if (importedAt === null || shown === null || shown.importedAt !== importedAt) {
    return 'loading';
  }
  if (shown.kind === 'failed') {
    return 'error';
  }
  if (requested !== null && requested.importedAt === importedAt) {
    if (requested.title !== null && requested.title !== shown.view.title) {
      return 'updating';
    }
    if (requested.battleType !== shown.view.battleType) {
      return 'updating';
    }
  }
  return 'ready';
}

/** The `vehicles` channel's own outcome, as `QueryClient` settles it. */
type VehiclesOutcome = DataOutcome<'vehicles'>;

/**
 * Admit one outcome, or drop it.
 *
 * Every rejection is a `null`, never an exception, and what survives is
 * stamped with the ASK rather than anything the reply said about itself, so the
 * block can never hold a view it did not request. The gate order and its
 * reasons are documented on `acceptDataOutcome`, which this delegates to.
 */
export function acceptVehicleOutcome(
  outcome: VehiclesOutcome,
  ask: VehicleAsk,
  currentImportedAt: string | null,
): ShownVehicles | null {
  // The gates are the trust boundary and live once, in `acceptDataOutcome`
  // (T-05-31, T-05-35, T-05-37); this only names the channel and the ask.
  return acceptDataOutcome(outcome, 'vehicles', ask.importedAt, currentImportedAt);
}

/**
 * The request that DESCRIBES what the view actually applied.
 *
 * This is the reconcile, and it is what keeps `derivePlayerState` honest: the
 * worker answers with applied values, so a declined battle type or a defaulted
 * title would otherwise compare unequal against the ask forever and hold the
 * block at "Updating table..." with nothing on the way to change it.
 */
export function appliedAsk(importedAt: string, view: VehicleView): VehicleAsk {
  return { importedAt, title: view.title, battleType: view.battleType };
}

/** The selectors this block owns, as one value (D-28: never persisted). */
export interface VehicleSelection {
  /** The search box's text; empty means no filter. */
  query: string;
  /** The sorted column and its direction. */
  sort: SortState;
  /** Extra column keys the user picked; plan 05-14's picker writes this. */
  pickedExtraKeys: string[];
}

/**
 * The selection a fresh dataset or a TITLE change opens with (D-12, D-28,
 * UI-SPEC section 3).
 *
 * A different game is a different table, so the sort, the search and the picked
 * extras all describe the one that was on screen and all go back to their
 * defaults. That is battles descending, an empty search and no picked extras.
 * Returned as a new value rather than a shared constant so a caller can hold it
 * in `$state` without the block's own writes reaching the module-level object.
 */
export function freshSelection(): VehicleSelection {
  return { query: '', sort: { ...DEFAULT_SORT }, pickedExtraKeys: [] };
}

/**
 * The selection a BATTLE TYPE change opens with (UI-SPEC section 3, D-12).
 *
 * The sort and the search both go back to their defaults, exactly as a title
 * change does, because both of them describe the list that was on screen and
 * neither is about a battle type. The picked extras are KEPT, and this is the
 * one difference between the two resets: the All-battles file and the by_Type
 * file of the same title mostly carry the same fields, so dropping the
 * reader's chosen columns every time they narrow the table would be churn
 * rather than clarity. A title change is a different game and a different
 * file, which is why a title change opens with {@link freshSelection} and clears them.
 *
 * The picked list is returned AS GIVEN — the same array, not a filtered or
 * reordered copy. Which of the reader's columns the new view actually has is
 * `visibleColumns`' decision (05-09), which ignores a key this view does not
 * have; a reset that also filtered would be a second place deciding it, and
 * the two could disagree.
 */
export function selectionAfterBattleType(previous: VehicleSelection): VehicleSelection {
  return {
    query: '',
    sort: { ...DEFAULT_SORT },
    pickedExtraKeys: previous.pickedExtraKeys,
  };
}

/**
 * The status paragraph's text (05-UI-SPEC section 2).
 *
 * The announcement is returned ONLY for `ready`, and is passed straight
 * through, because it was written by the applied answer that produced this
 * state and there is nothing to reconcile it against. `loading` and `updating`
 * are fixed sentences that describe the block rather than its data, and the
 * error state reads the same fixed sentence the error paragraph shows, so a
 * screen reader is told the same thing the sighted reader is.
 */
export function playerStatusLine(state: PlayerState, announcement: string): string {
  switch (state) {
    case 'loading':
      return PLAYER_STATS_LOADING;
    case 'updating':
      return PLAYER_STATS_UPDATING;
    case 'error':
      return PLAYER_STATS_ERROR;
    case 'ready':
      return announcement;
  }
}

/**
 * The channel a `VehicleAsk` is asked on, as the query message reads it.
 *
 * A one-line adapter rather than an object literal at the call site, so the
 * `DataQuery` shape is built in one place: a widening of the query union would
 * otherwise be a type error in the component and a decision made there.
 */
export function vehiclesQuery(ask: VehicleAsk): Extract<DataQuery, { channel: 'vehicles' }> {
  return { channel: 'vehicles', title: ask.title, battleType: ask.battleType };
}
