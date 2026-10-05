import type { CityOutcome } from './city-client.ts';
import type { CityView } from './city-shared.ts';

// =============================================================================
// The city opt-in's state machine, as pure functions (06-13, D-14, D-15).
//
// No Svelte import, no copy, no DOM. The component wires three things and
// decides nothing: which state follows which event (`cityReduce`), whether work
// in flight must be dropped (`CityEffect`), and which worker answer may be shown
// (`acceptCityOutcome`). They are functions with tests because the failures that
// matter here are not visual: a download that outlives the dataset it was
// started for, a cancel reported as a fault, a decode landing on a replaced
// export.
//
// The states and their transitions (06-UI-SPEC section 2):
//
//   idle ──press──▶ downloading ──bytes-in──▶ decoding ──result──▶ ready
//     ▲                 │  │                     │
//     │                 │  └──cancel──▶ cancelled│
//     │                 └──failure───▶ error ◀───┘ (failure)
//     └──── press, from cancelled or error
//
//   unavailable accepts nothing: the build carries no city asset.
//   ready accepts no press: there is no unload control.
//   dataset-change returns idle from ANYTHING and asks for a silent abort.
// =============================================================================

/** The seven states of the opt-in, which are also its `data-state` values. */
export type CityStateKind =
  'idle' | 'downloading' | 'decoding' | 'ready' | 'error' | 'cancelled' | 'unavailable';

/**
 * One state of the opt-in.
 *
 * `importedAt` is the dataset the state describes, so a dataset change is
 * recognisable from the state alone. `received` and `total` are the bytes of the
 * download in flight and are zero and null in every other state.
 */
export interface CityState {
  readonly kind: CityStateKind;
  readonly importedAt: string | null;
  readonly received: number;
  readonly total: number | null;
}

/** What can happen to the opt-in. */
export type CityEvent =
  | { readonly type: 'press' }
  | { readonly type: 'progress'; readonly received: number; readonly total: number | null }
  | { readonly type: 'bytes-in' }
  | { readonly type: 'result' }
  | { readonly type: 'failure' }
  | { readonly type: 'cancel' }
  | { readonly type: 'dataset-change'; readonly importedAt: string | null };

/**
 * What the caller must do besides rendering the new state.
 *
 * `abort-silently` means: abort the download and ignore the decode in flight,
 * and show NO cancelled line. The user did not press Cancel; the dataset the
 * work was for is gone.
 */
export type CityEffect = 'none' | 'abort-silently';

/** One transition's result. */
export interface CityStep {
  readonly state: CityState;
  readonly effect: CityEffect;
}

/**
 * The state a block starts in: `unavailable` exactly when the build carries no
 * manifest, `idle` otherwise.
 *
 * Decided from the build-time constant alone (UI-SPEC Decision for the
 * unavailable state): a button whose size cannot be computed and whose click
 * can only fail is worse than no button.
 */
export function initialCityState(
  manifest: { readonly bytes: number } | null,
  importedAt: string | null = null,
): CityState {
  return { kind: manifest === null ? 'unavailable' : 'idle', importedAt, received: 0, total: null };
}

const NO_EFFECT: CityEffect = 'none';

function stay(state: CityState): CityStep {
  return { state, effect: NO_EFFECT };
}

function to(state: CityState, kind: CityStateKind): CityStep {
  return { state: { ...state, kind }, effect: NO_EFFECT };
}

/**
 * The next state for one event, and whether work must be dropped.
 *
 * An event a state does not accept leaves it exactly as it was, which is what
 * makes "at most one request per press" a property of the table and not a
 * discipline: pressing while a load is in flight is a no-op here.
 */
export function cityReduce(state: CityState, event: CityEvent): CityStep {
  // The build carries no asset: nothing can move this block, not even a
  // dataset change, because there is nothing for it to forget.
  if (state.kind === 'unavailable') return stay(state);

  if (event.type === 'dataset-change') {
    if (event.importedAt === state.importedAt) return stay(state);
    return {
      state: { kind: 'idle', importedAt: event.importedAt, received: 0, total: null },
      effect: 'abort-silently',
    };
  }

  switch (state.kind) {
    case 'idle':
    case 'error':
    case 'cancelled':
      // A new press starts from zero bytes, never from the download it follows.
      return event.type === 'press'
        ? { state: { ...state, kind: 'downloading', received: 0, total: null }, effect: NO_EFFECT }
        : stay(state);

    case 'downloading':
      switch (event.type) {
        case 'progress':
          return stay({ ...state, received: event.received, total: event.total });
        case 'bytes-in':
          return to(state, 'decoding');
        case 'cancel':
          return to(state, 'cancelled');
        case 'failure':
          return to(state, 'error');
        default:
          return stay(state);
      }

    case 'decoding':
      // Not interruptible: the step is brief, so `cancel` is not offered and is
      // ignored here.
      switch (event.type) {
        case 'result':
          return to(state, 'ready');
        case 'failure':
          return to(state, 'error');
        default:
          return stay(state);
      }

    case 'ready':
      return stay(state);
  }
}

/** A worker answer that may be shown. */
export type AcceptedCity =
  | { readonly kind: 'view'; readonly importedAt: string; readonly view: CityView }
  | { readonly kind: 'failed' };

/**
 * Admit one outcome, or drop it (`null`).
 *
 * Every rejection is a `null`, never an exception: the opt-in has to keep
 * rendering, and an answer it must not show is not an error condition. The
 * order is the order of the disqualifications:
 *
 *   1. a superseded load is not an answer at all;
 *   2. an answer for another load is another question's;
 *   3. an error for THIS load is a failure, and the detail is dropped on the
 *      spot so the one place a worker string could enter the screen is the one
 *      place that does not take it (T-06-50);
 *   4. a result must be for the dataset on screen NOW, and must carry a view: a
 *      view-less result means the worker holds no dataset, which contradicts a
 *      screen that has one.
 *
 * A caller that gets `null` for a load it did not abort has to treat it as a
 * failure rather than wait: nothing else is coming.
 */
export function acceptCityOutcome(
  outcome: CityOutcome,
  loadId: number,
  currentImportedAt: string | null,
): AcceptedCity | null {
  if (outcome.kind === 'superseded') return null;
  if (outcome.loadId !== loadId) return null;
  if (outcome.kind === 'error') return { kind: 'failed' };
  if (currentImportedAt === null || outcome.importedAt !== currentImportedAt) return null;
  if (outcome.view === null) return null;
  return { kind: 'view', importedAt: currentImportedAt, view: outcome.view };
}
