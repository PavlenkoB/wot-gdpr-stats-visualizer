/**
 * overview-motion.ts — the EXPAND CONTROLLER (13-10, D-16, T-13-29).
 *
 * ## The rule this module enforces: intent first, animation second
 *
 * A tile opens or closes. The view transition that animates it is decoration,
 * and the state must never depend on it. So:
 *
 *   1. `request(id, open)` records the WANTED state of that tile SYNCHRONOUSLY.
 *      Two quick clicks mean open, then close — the second click toggles from
 *      the recorded want (`!wanted(id)`), never from the DOM, which may not
 *      have caught up yet.
 *   2. The change is committed through `document.startViewTransition` only when
 *      the API exists and `prefers-reduced-motion` is not `reduce`. Otherwise it
 *      is committed at once.
 *   3. A transition can be skipped, can throw, or can never run its callback
 *      (a hidden tab). A 600 ms fallback commits the current want if the
 *      callback has not run, a throwing API commits at once, and every
 *      transition promise is caught so a skipped one is never an unhandled
 *      rejection.
 *   4. A request commits AT MOST ONCE (its callback and its timer share one
 *      `done` flag), and what it commits is the wanted state AT EXECUTION TIME,
 *      so the newest request wins whichever of callback and timer fires first.
 *
 * ## Why the environment is injected
 *
 * Unit tests run in Node and cannot mount a component, and `document` does not
 * exist there. The browser's pieces — the transition API, the media query,
 * timers, and the synchronous Svelte flush — arrive through `ExpanderEnv`, and
 * `browserExpanderEnv` builds the real one. Importing this module touches no
 * global.
 *
 * Ported from the sketch's `anchored` / `setOpen`
 * (`sketch-findings-wot-gdpr-stats-visualizer/sources/overview-final`).
 */

/** The fallback: if the transition's callback has not run after this, commit anyway. */
export const TRANSITION_FALLBACK_MS = 600;

/**
 * What a started transition hands back.
 *
 * Only `finished` is required. `ready` and `updateCallbackDone` are optional
 * because the real `ViewTransition` has them and each rejects when a newer
 * transition skips this one; they are caught when present.
 */
export interface ExpanderTransition {
  finished: Promise<unknown>;
  ready?: Promise<unknown>;
  updateCallbackDone?: Promise<unknown>;
}

/** The browser pieces the controller needs, injected. */
export interface ExpanderEnv {
  /** `document.startViewTransition`, bound — or null when the API is absent. */
  startViewTransition: ((update: () => void) => ExpanderTransition) | null;
  /** Whether the user asked for reduced motion, read at request time. */
  reducedMotion: () => boolean;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  /** Runs `fn` and applies the resulting state to the DOM synchronously. */
  flush: (fn: () => void) => void;
}

/** The expand controller. */
export interface Expander {
  /** Record the wanted state now and commit it (maybe through a transition). */
  request(id: string, open: boolean): void;
  /** The state last requested for a tile; false for a tile never requested. */
  wanted(id: string): boolean;
}

/**
 * Build the controller.
 *
 * `commit` applies a tile's state to the page. It is called with the wanted
 * state at the moment it runs, never with a stale one.
 */
export function createExpander(
  env: ExpanderEnv,
  commit: (id: string, open: boolean) => void,
): Expander {
  const want = new Map<string, boolean>();
  const wanted = (id: string): boolean => want.get(id) ?? false;

  function request(id: string, open: boolean): void {
    want.set(id, open);

    const start = env.startViewTransition;
    if (start === null || env.reducedMotion()) {
      commit(id, wanted(id));
      return;
    }

    let done = false;
    let timer: unknown = null;

    const run = (): void => {
      if (done) return;
      done = true;
      if (timer !== null) env.clearTimeout(timer);
      env.flush(() => commit(id, wanted(id)));
    };

    // The safety net is armed BEFORE the transition starts, so a transition
    // that throws, stalls or is skipped still commits.
    timer = env.setTimeout(run, TRANSITION_FALLBACK_MS);

    try {
      const transition = start(run);
      for (const promise of [
        transition.finished,
        transition.ready,
        transition.updateCallbackDone,
      ]) {
        // A newer transition may skip this one; that is fine.
        promise?.catch(() => {});
      }
    } catch {
      run();
    }
  }

  return { request, wanted };
}

/**
 * Run a change that has no per-id intent (a pin moving a tile between groups)
 * through the same safety rules as an expand.
 *
 * - API absent or reduced motion on: `update()` runs at once and no transition
 *   is started.
 * - Otherwise a view transition runs `update` through `env.flush` EXACTLY once.
 *   The 600 ms fallback (armed before the transition starts) runs it if the
 *   transition's callback never does, a `finished` rejection is caught, and a
 *   throwing API runs it at once.
 *
 * `done`, when given, runs right after `update` has been applied (so a caller
 * can restore focus on a node the update re-created). It runs at most once.
 */
export function runTransition(env: ExpanderEnv, update: () => void, done?: () => void): void {
  const start = env.startViewTransition;
  if (start === null || env.reducedMotion()) {
    update();
    done?.();
    return;
  }

  let ran = false;
  let timer: unknown = null;

  const run = (): void => {
    if (ran) return;
    ran = true;
    if (timer !== null) env.clearTimeout(timer);
    env.flush(update);
    done?.();
  };

  timer = env.setTimeout(run, TRANSITION_FALLBACK_MS);

  try {
    const transition = start(run);
    for (const promise of [transition.finished, transition.ready, transition.updateCallbackDone]) {
      promise?.catch(() => {});
    }
  } catch {
    run();
  }
}

/**
 * The scroll correction that keeps a tile at the same screen position across a
 * layout change: `after - before`, or zero when the shift is a pixel or less.
 */
export function anchorDelta(before: number, after: number): number {
  const delta = after - before;
  return Math.abs(delta) > 1 ? delta : 0;
}

/**
 * The real environment.
 *
 * Touches `document` and `matchMedia` only when called (and `matchMedia` only
 * when a request asks), so importing this module in Node is safe. `flush` is
 * supplied by the component (Svelte's `flushSync`), keeping this module free of
 * any framework import.
 */
export function browserExpanderEnv(flush: (fn: () => void) => void): ExpanderEnv {
  const startViewTransition =
    typeof document.startViewTransition === 'function'
      ? document.startViewTransition.bind(document)
      : null;
  return {
    startViewTransition,
    reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    flush,
  };
}
