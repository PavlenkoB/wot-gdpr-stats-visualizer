import type { PlaytimeOutcome } from './playtime-client';
import type { SplitColumn } from './playtime-shared';
import type { PlaytimeView } from '../../core/types/worker-messages';
import {
  PLAYTIME_LOADING,
  PLAYTIME_UPDATING,
  formatGameName,
  formatSelectionAnnouncement,
  formatSplitValue,
} from '../../ui-copy';

// =============================================================================
// The Playtime block's decisions, as pure functions (04-08).
//
// ## Why this module exists at all
//
// `Playtime.svelte` holds the DOM wiring and nothing else. Everything that can
// be wrong while a query is in flight is here, because the failures this phase
// cares about are not visual: they are a previous export's numbers painted
// under a new export's heading, or an empty cell where a value should be. All
// six states of the 04-UI-SPEC matrix are decided by `derivePlaytimeState`,
// every answer is admitted or dropped by `acceptOutcome`, and both are
// ordinary functions over ordinary data — which is the only reason they can be
// tested at all (Vitest runs with no DOM; see vitest.config.ts).
//
// ## The two keys, and why there are two
//
// `importedAt` is the dataset identity, a primitive string. A replace changes
// it, a clear removes it, and an answer that carries a different one belongs to
// a dashboard that is no longer on screen. `shown` therefore holds the
// `importedAt` it answers for TOGETHER with the view (04-02's cell, unchanged),
// and a mismatch is "no answer" rather than a value to display.
//
// `requested` is the slice the user last asked for, also stamped with the
// dataset it was asked for. The difference between the request and what is on
// screen is exactly the `updating` state — and comparing the two indices
// rather than a flag is what stops a request left over from a replaced dataset
// from putting a healthy dashboard into a permanent "Updating" (D-03).
//
// ## T-04-15, T-04-16
//
// `acceptOutcome` is the trust boundary. It drops a superseded answer, an
// answer for a dataset other than the one on screen, a result stamped with no
// dataset or another one, and a result carrying no view. What survives is
// stamped with the ASK, not with anything the reply said about itself, so the
// block can never hold a view it did not request.
//
// `splitValue` is the other boundary: an untrusted `SERVER_NAME` or
// `CLIENT_PLATFORM` string reaching the DOM. It is a display concern, so it
// belongs with the state that decides what is displayed.
// =============================================================================

/** The six states of the 04-UI-SPEC "Playtime state matrix", plus nothing. */
export type PlaytimeState =
  | 'loading'
  | 'ready'
  | 'updating'
  | 'no-session-file'
  | 'no-usable-sessions'
  | 'no-game-sessions'
  | 'error';

/** A slice the block asked for, remembered with the dataset it was asked for. */
export interface RequestedSlice {
  /** The dataset on screen when the request was made. */
  importedAt: string;
  /** The requested value index; null means All. */
  valueIndex: number | null;
  /**
   * The requested game token, or null for All games (Phase 10, D-01).
   *
   * OPTIONAL and compared as `(a ?? null) !== (b ?? null)` everywhere: absent
   * and null mean the same thing here, so a caller written against the pre-game
   * contract keeps behaving exactly as it did.
   */
  game?: string | null;
}

/**
 * One applied answer, stamped with the ask that produced it.
 *
 * Two variants and no third: a view that can be rendered, or a failure that
 * cannot. A `view` holds the whole `PlaytimeView` including its own
 * `selected` index, so the component never re-derives which slice it is
 * showing from the request it happens to still be holding. `game` is the ask's
 * own token, for the same reason the index is the ask's: `awaiting` compares
 * the two, and a comparison against a value the reply reported about itself
 * could never settle.
 */
export type ShownPlaytime =
  | {
      kind: 'view';
      importedAt: string;
      valueIndex: number | null;
      game?: string | null;
      view: PlaytimeView;
    }
  | { kind: 'failed'; importedAt: string; valueIndex: number | null; game?: string | null };

/** Everything the state derivation reads, and nothing it has to compute. */
export interface PlaytimeStateInput {
  /** The dataset on screen now, or null when none is. */
  importedAt: string | null;
  /** The last applied answer, or null when there is none. */
  shown: ShownPlaytime | null;
  /** The slice the user last asked for, or null when they have not asked. */
  requested: RequestedSlice | null;
}

/**
 * The one state the block renders (04-UI-SPEC section 2).
 *
 * The order of the tests IS the order of the questions, cheapest and most
 * disqualifying first:
 *
 *   1. Is there a dataset, and is what we are showing an answer for THAT
 *      dataset? A replace that lands mid-query therefore returns the block to
 *      `loading` by construction rather than through a hand-written reset, and
 *      a `failed` answer for a replaced dataset never becomes an error about
 *      the export now on screen.
 *   2. Did the answer fail? `error` — the fixed sentence is the only one that
 *      is true whether the worker has no aggregate or the query failed
 *      (04-02, re-affirmed by 04-07: a `superseded` outcome is not a `result`
 *      and can never null a view).
 *   3. Is the answer asking for a DIFFERENT slice of THIS dataset? That is
 *      `updating`, and it is the only route to it — a request stamped with
 *      another dataset cannot produce it, and a request for the slice already
 *      displayed cannot either. A slice is the PAIR (value index, game), and
 *      comparing only the index was correct until Phase 10: a chip click always
 *      carries `valueIndex: null`, so a request that differed only by game
 *      compared equal to the All slice on screen and a stale slice looked
 *      final (D-03, T-10-06).
 *   4. Otherwise the view's own status, which is a claim about the export and
 *      is taken at face value.
 */
export function derivePlaytimeState({
  importedAt,
  shown,
  requested,
}: PlaytimeStateInput): PlaytimeState {
  if (importedAt === null) return 'loading';
  if (shown === null || shown.importedAt !== importedAt) return 'loading';
  if (shown.kind === 'failed') return 'error';

  const { status } = shown.view;
  if (status === 'no-session-file') return 'no-session-file';
  if (status === 'no-usable-sessions') return 'no-usable-sessions';

  const awaiting =
    requested !== null &&
    requested.importedAt === importedAt &&
    (requested.valueIndex !== shown.valueIndex ||
      (requested.game ?? null) !== (shown.game ?? null));

  // An empty GAME is a settled answer about a game, not about the export, so it
  // is its own state rather than a `ready` with no numbers — the tiles and the
  // charts are replaced by one body line and the chips stay. `updating` still
  // wins while a request for something else is in flight, exactly as it does
  // for `ready`, so the same comparison serves both (D-03).
  if (shown.view.status === 'no-game-sessions') {
    return awaiting ? 'updating' : 'no-game-sessions';
  }
  return awaiting ? 'updating' : 'ready';
}

/**
 * Admit one outcome, or drop it.
 *
 * Every rejection is a `null`, never an exception: a component awaiting a
 * query has to keep rendering, and an answer it must not show is not an error
 * condition (T-04-16, 04-07's rule that nothing on this path ever rejects).
 *
 * The dataset check runs against the dataset CURRENTLY on screen as well as
 * against the ask, because the two can differ: a replace can land while the
 * worker is reading, and then the answer is for a dataset nobody is looking at
 * any more. The surviving record is stamped with the ASK rather than with the
 * reply, so `shown` can only ever describe a question this block actually put.
 */
export function acceptOutcome(
  outcome: PlaytimeOutcome,
  ask: RequestedSlice,
  currentImportedAt: string | null,
): ShownPlaytime | null {
  // A newer query was issued, so this one is answered to nobody. Its numbers
  // are not wrong, they are simply not what is on screen; the newer query's own
  // answer is.
  if (outcome.kind === 'superseded') return null;
  if (currentImportedAt === null || currentImportedAt !== ask.importedAt) return null;

  if (outcome.kind === 'error') {
    // The worker's `detail` is deliberately not carried: it names worker
    // internals and belongs in the console, never in the DOM (T-04-24, D-21).
    return {
      kind: 'failed',
      importedAt: ask.importedAt,
      valueIndex: ask.valueIndex,
      game: ask.game ?? null,
    };
  }

  if (outcome.importedAt === null || outcome.importedAt !== ask.importedAt) return null;
  // A result with no view is the worker saying it has no stored aggregate for
  // the dataset. That is a fact about the worker's storage, not about the
  // user's export, so it is not rendered as one of the export's empty states
  // (04-02, re-affirmed in 04-07). Dropping it leaves the block loading rather
  // than painting an error about numbers the app may still hold.
  if (outcome.view === null) return null;

  return {
    kind: 'view',
    importedAt: ask.importedAt,
    valueIndex: ask.valueIndex,
    game: ask.game ?? null,
    view: outcome.view,
  };
}

/**
 * Whether this dropped answer means the worker's store was emptied under a tab
 * that still holds the dataset (04-16, G-04-5).
 *
 * `acceptOutcome` says what may be SHOWN; this says whether the silence is
 * worth breaking. The worker answers `importedAt: null, view: null` only when
 * the stored dataset is gone — no meta record, or the rows vanished between
 * the two reads — so a tab that was told that, while still showing the
 * dataset in memory, has just been handed a selector change it cannot apply.
 * Reconciling `requested` (the 04-14 fix) unsticks the status line; nothing
 * told the user WHY their choice was ignored, and a silently ignored control
 * reads as a broken app.
 *
 * The cases this is NOT, each a case where the sentence below would be false:
 *
 *   - a `superseded` or `error` outcome. Nothing failed and nothing was
 *     cleared; an error has its own state with its own copy.
 *   - a result stamped with ANOTHER non-null dataset. That is a different
 *     dataset being stored, not an empty store — a replace from another tab.
 *   - a result carrying the ask's stamp and no view. The worker holds a
 *     dataset but no stored aggregate for it, which is a fact about its
 *     storage and says nothing about a clear.
 *   - a result with a null stamp but a view. An inconsistent shape that the
 *     worker cannot produce; guessing at it would be a claim, not a report.
 *   - a dataset that was replaced while the ask was in flight, so the answer
 *     is about a dashboard nobody is looking at any more.
 *
 * It reads identifiers and returns only a boolean, and nothing it reads is
 * stored or rendered: the notice is one fixed sentence, and D-21 keeps the
 * stamp, the path and the worker's detail out of the DOM.
 */
export function isCacheClearedElsewhere(
  outcome: PlaytimeOutcome,
  ask: RequestedSlice,
  currentImportedAt: string | null,
): boolean {
  if (outcome.kind !== 'result') return false;
  if (outcome.importedAt !== null || outcome.view !== null) return false;
  // Nothing on screen means nothing for a clear to have happened underneath.
  if (currentImportedAt === null) return false;
  return currentImportedAt === ask.importedAt;
}

/**
 * The sentence the live region reads after a slice change, or ''.
 *
 * The full set is repeated rather than "Updated" because this is the only
 * feedback a screen-reader user gets that the numbers under it changed, and
 * the only place the three values are stated together (D-03).
 *
 * The subject is `null` for All and a STRING for a value, which is why the
 * blank server name goes through `splitValue` and then `formatSplitValue`
 * before it arrives: passing the raw `null` would make the formatter say "all
 * sessions", and a selection on the blank value is a selection like any other.
 *
 * An index the view does not hold cannot be named, so it is announced as All
 * rather than as a value that may be somebody else's. The worker answers
 * `selected: null` for any index outside its own list, so this is defensive.
 *
 * A GAME is part of the subject from Phase 10 (D-03), and this is the only
 * feedback a screen-reader user gets that the numbers under them changed: a
 * chip click that reported only hours and sessions would announce the same
 * sentence for WoT and for WoT Blitz. The game is joined with a comma and a
 * space when a split value is selected too, and the two are ordered
 * game-first because the game is the coarser of the two choices and the one the
 * reader just made.
 */
export function selectionAnnouncement(view: PlaytimeView): string {
  if (view.status !== 'ready') return '';
  const { split, selected, slice } = view;
  const value =
    selected === null || split === null
      ? null
      : formatSplitValue(splitValue(split.values[selected]?.value ?? ''));
  const game = view.game ?? null;
  const subject =
    game === null
      ? value
      : value === null
        ? formatGameName(game)
        : `${formatGameName(game)}, ${value}`;
  return formatSelectionAnnouncement(subject, slice.seconds, slice.sessions, slice.dayIndex.length);
}

/**
 * The status paragraph's text, in every state.
 *
 * `loading` and `updating` are fixed sentences, because in both of them the
 * numbers on screen are not the ones being asked about. Every other state
 * carries the announcement, which is empty until the user changes the
 * selection and is cleared when the dataset changes — so the paragraph exists
 * in the DOM at all times (a live region created together with its content is
 * not announced) and says nothing rather than repeating itself.
 *
 * `no-game-sessions` is one of those "every other" states, and deliberately so:
 * the answer carries no slice, so `selectionAnnouncement` returns '' for it and
 * the line says nothing. The empty-game BODY is the message there, not the live
 * region — a chip click is announced by "Updating charts..." and settled by the
 * body the reader can see, and adding a third sentence would mean two live
 * regions saying the same thing.
 */
export function statusLine(state: PlaytimeState, announcement: string): string {
  if (state === 'loading') return PLAYTIME_LOADING;
  if (state === 'updating') return PLAYTIME_UPDATING;
  return announcement;
}

/**
 * A stored split value as the display layer must see it.
 *
 * The worker stores a blank value as `null` and `viewFromAggregates` publishes
 * it as `''`, because `PlaytimeSplit.values[].value` is declared `string` (04-01)
 * and a blank string is a fine thing to put on a message. `formatSplitValue`
 * only returns `(not recorded)` for `null`, so the empty string has to be
 * translated back at the boundary or a blank server renders as an EMPTY CELL.
 *
 * This is a display boundary, not a normalisation pass: a non-empty value is
 * returned byte for byte. In particular a server genuinely named
 * `(not recorded)` stays that server — the two are told apart by index, which
 * is the only thing the export distinguishes (04-06).
 */
export function splitValue(raw: string): string | null {
  return raw === '' ? null : raw;
}

/**
 * The stored column name as one this build has words for, or null.
 *
 * The aggregate is JSON in IndexedDB, so the main thread receives a bare
 * `string` where the worker knows a `SplitColumn`. The label table is
 * exhaustive, so an unrecognised name must not reach it: `SPLIT_COLUMN_LABELS`
 * would answer `undefined` and the caption would throw inside a render. A
 * name outside the three the worker can produce therefore renders no selector,
 * no split table and no overlap note — the same presentation as an export
 * where no column qualifies, which the UI-SPEC requires to be silent. D-03's
 * rule that the selector never claims a column it cannot name is what this
 * implements.
 *
 * `GAME` is the third name and the one a REAL export needs: it carries
 * `STARTED_AT`, `FINISHED_AT` and `IP` and no server or platform column at
 * all, so before 04-15 the worker could produce a column with no words for it
 * and a perfectly good two-game export rendered as plain All.
 */
export function splitColumnOf(raw: string): SplitColumn | null {
  return raw === 'GAME' || raw === 'SERVER_NAME' || raw === 'CLIENT_PLATFORM' ? raw : null;
}
