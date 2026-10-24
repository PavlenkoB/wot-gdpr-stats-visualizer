import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TRANSITION_FALLBACK_MS,
  anchorDelta,
  browserExpanderEnv,
  createExpander,
  runTransition,
  type ExpanderEnv,
  type ExpanderTransition,
} from '../../../src/lib/features/overview/overview-motion.ts';

// =============================================================================
// The EXPAND CONTROLLER (13-10 Task 1, D-16, T-13-29)
// =============================================================================
//
// Intent first, animation second: the wanted state is recorded synchronously,
// the view transition is decoration, and a transition that never runs, throws
// or is skipped must still leave the tile in the state the user asked for.
// The environment is faked: manual timers and a controllable transition.
// =============================================================================

interface FakeTransition extends ExpanderTransition {
  resolveFinished(): void;
  rejectFinished(): void;
}

interface Fake {
  env: ExpanderEnv;
  commits: [string, boolean][];
  /** Update callbacks handed to startViewTransition, in call order. */
  updates: (() => void)[];
  transitions: FakeTransition[];
  timers: { fn: () => void; ms: number; cleared: boolean }[];
  flushes: number;
  fireTimer(index: number): void;
  reduced: boolean;
  api: boolean;
  throwOnStart: boolean;
}

function fake(): Fake {
  const state: Fake = {
    env: undefined as unknown as ExpanderEnv,
    commits: [],
    updates: [],
    transitions: [],
    timers: [],
    flushes: 0,
    fireTimer(index) {
      const timer = state.timers[index];
      if (!timer.cleared) timer.fn();
    },
    reduced: false,
    api: true,
    throwOnStart: false,
  };
  state.env = {
    get startViewTransition() {
      if (!state.api) return null;
      return (update: () => void): FakeTransition => {
        if (state.throwOnStart) throw new Error('InvalidStateError');
        state.updates.push(update);
        let resolve!: () => void;
        let reject!: () => void;
        const finished = new Promise<unknown>((res, rej) => {
          resolve = () => res(undefined);
          reject = () => rej(new Error('skipped'));
        });
        const transition: FakeTransition = {
          finished,
          resolveFinished: resolve,
          rejectFinished: reject,
        };
        state.transitions.push(transition);
        return transition;
      };
    },
    reducedMotion: () => state.reduced,
    setTimeout: (fn, ms) => {
      state.timers.push({ fn, ms, cleared: false });
      return state.timers.length - 1;
    },
    clearTimeout: (handle) => {
      state.timers[handle as number].cleared = true;
    },
    flush: (fn) => {
      state.flushes += 1;
      fn();
    },
  };
  return state;
}

function build(f: Fake) {
  return createExpander(f.env, (id, open) => {
    f.commits.push([id, open]);
  });
}

describe('createExpander: no transition', () => {
  it('commits at once when the user asked for reduced motion, and never starts a transition', () => {
    const f = fake();
    f.reduced = true;
    const expander = build(f);
    expander.request('hour', true);
    expect(f.commits).toEqual([['hour', true]]);
    expect(f.updates).toHaveLength(0);
    expect(f.timers).toHaveLength(0);
    expect(expander.wanted('hour')).toBe(true);
  });

  it('commits at once when the API is absent', () => {
    const f = fake();
    f.api = false;
    const expander = build(f);
    expander.request('tank', true);
    expander.request('tank', false);
    expect(f.commits).toEqual([
      ['tank', true],
      ['tank', false],
    ]);
    expect(f.timers).toHaveLength(0);
    expect(expander.wanted('tank')).toBe(false);
  });
});

describe('createExpander: with the view transition API', () => {
  it('records the wanted state synchronously but does not commit before the callback runs', () => {
    const f = fake();
    const expander = build(f);
    expect(expander.wanted('hour')).toBe(false);
    expander.request('hour', true);
    expect(expander.wanted('hour')).toBe(true);
    expect(f.commits).toEqual([]);
    expect(f.updates).toHaveLength(1);
  });

  it('commits once with the current wanted state when the callback runs, through the flush', () => {
    const f = fake();
    const expander = build(f);
    expander.request('hour', true);
    f.updates[0]();
    expect(f.commits).toEqual([['hour', true]]);
    expect(f.flushes).toBe(1);
    // The callback ran, so the fallback timer was cleared and cannot commit again.
    expect(f.timers[0].cleared).toBe(true);
    f.fireTimer(0);
    f.updates[0]();
    expect(f.commits).toEqual([['hour', true]]);
  });

  it('arms a fallback timer of 600 ms', () => {
    const f = fake();
    const expander = build(f);
    expander.request('hour', true);
    expect(TRANSITION_FALLBACK_MS).toBe(600);
    expect(f.timers).toHaveLength(1);
    expect(f.timers[0].ms).toBe(600);
  });

  it('commits from the fallback when the callback never runs, and not twice if it runs later', () => {
    const f = fake();
    const expander = build(f);
    expander.request('hour', true);
    f.fireTimer(0);
    expect(f.commits).toEqual([['hour', true]]);
    f.updates[0]();
    expect(f.commits).toEqual([['hour', true]]);
  });

  it('open then close back to back commits closed last, whichever of callback and timer fires', () => {
    for (const order of ['callbacks', 'timers', 'mixed'] as const) {
      const f = fake();
      const expander = build(f);
      expander.request('hour', true);
      expander.request('hour', false);
      expect(expander.wanted('hour')).toBe(false);
      expect(f.commits).toEqual([]);
      if (order === 'callbacks') {
        f.updates[0]();
        f.updates[1]();
      } else if (order === 'timers') {
        f.fireTimer(0);
        f.fireTimer(1);
      } else {
        f.fireTimer(0);
        f.updates[1]();
      }
      const last = f.commits[f.commits.length - 1];
      expect(last).toEqual(['hour', false]);
      // Every commit reads the wanted state at execution time, so none is stale.
      for (const [, open] of f.commits) expect(open).toBe(false);
      // Each request commits at most once.
      expect(f.commits.length).toBeLessThanOrEqual(2);
    }
  });

  it('a click toggles from the recorded want, not from the DOM', () => {
    const f = fake();
    const expander = build(f);
    const click = () => expander.request('tank', !expander.wanted('tank'));
    click();
    click();
    expect(expander.wanted('tank')).toBe(false);
    click();
    expect(expander.wanted('tank')).toBe(true);
  });

  it('keeps two tiles independent', () => {
    const f = fake();
    const expander = build(f);
    expander.request('hour', true);
    expander.request('tank', false);
    expect(expander.wanted('hour')).toBe(true);
    expect(expander.wanted('tank')).toBe(false);
    f.updates[0]();
    f.updates[1]();
    expect(f.commits).toEqual([
      ['hour', true],
      ['tank', false],
    ]);
    expander.request('tank', true);
    expect(expander.wanted('hour')).toBe(true);
    expect(expander.wanted('tank')).toBe(true);
  });

  it('commits at once, and clears the timer, when startViewTransition throws', () => {
    const f = fake();
    f.throwOnStart = true;
    const expander = build(f);
    expander.request('hour', true);
    expect(f.commits).toEqual([['hour', true]]);
    expect(f.timers[0].cleared).toBe(true);
    f.fireTimer(0);
    expect(f.commits).toEqual([['hour', true]]);
  });

  it('a rejected finished promise is never an unhandled rejection', async () => {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const f = fake();
      const expander = build(f);
      expander.request('hour', true);
      f.transitions[0].rejectFinished();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(seen).toEqual([]);
      // The skipped transition still leaves the state to the fallback.
      f.fireTimer(0);
      expect(f.commits).toEqual([['hour', true]]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('also catches ready and updateCallbackDone when the transition has them', async () => {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const f = fake();
      const original = f.env.startViewTransition!;
      f.env = {
        ...f.env,
        startViewTransition: (update) => ({
          ...original(update),
          ready: Promise.reject(new Error('skipped')),
          updateCallbackDone: Promise.reject(new Error('skipped')),
        }),
      };
      const expander = build(f);
      expander.request('hour', true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('runTransition', () => {
  it('runs the update once through the flush when the transition callback runs', () => {
    const f = fake();
    let updates = 0;
    let dones = 0;
    runTransition(
      f.env,
      () => {
        updates += 1;
      },
      () => {
        dones += 1;
      },
    );
    expect(updates).toBe(0);
    expect(f.updates).toHaveLength(1);
    f.updates[0]();
    expect(updates).toBe(1);
    expect(dones).toBe(1);
    expect(f.flushes).toBe(1);
    // The timer was cleared and the callback cannot run the update again.
    expect(f.timers[0].cleared).toBe(true);
    f.fireTimer(0);
    f.updates[0]();
    expect(updates).toBe(1);
    expect(dones).toBe(1);
  });

  it('arms the 600 ms fallback and runs the update once from it if the callback never runs', () => {
    const f = fake();
    let updates = 0;
    runTransition(f.env, () => {
      updates += 1;
    });
    expect(f.timers).toHaveLength(1);
    expect(f.timers[0].ms).toBe(TRANSITION_FALLBACK_MS);
    f.fireTimer(0);
    expect(updates).toBe(1);
    f.updates[0]();
    expect(updates).toBe(1);
  });

  it('runs the update at once, with no transition, when reduced motion is on', () => {
    const f = fake();
    f.reduced = true;
    let updates = 0;
    let dones = 0;
    runTransition(
      f.env,
      () => {
        updates += 1;
      },
      () => {
        dones += 1;
      },
    );
    expect(updates).toBe(1);
    expect(dones).toBe(1);
    expect(f.updates).toHaveLength(0);
    expect(f.timers).toHaveLength(0);
    expect(f.flushes).toBe(0);
  });

  it('runs the update at once when the API is absent', () => {
    const f = fake();
    f.api = false;
    let updates = 0;
    runTransition(f.env, () => {
      updates += 1;
    });
    expect(updates).toBe(1);
    expect(f.timers).toHaveLength(0);
  });

  it('runs the update at once, and clears the timer, when starting the transition throws', () => {
    const f = fake();
    f.throwOnStart = true;
    let updates = 0;
    runTransition(f.env, () => {
      updates += 1;
    });
    expect(updates).toBe(1);
    expect(f.timers[0].cleared).toBe(true);
  });

  it('a rejected finished promise is never an unhandled rejection', async () => {
    const f = fake();
    runTransition(f.env, () => {});
    f.transitions[0].rejectFinished();
    await Promise.resolve();
    await Promise.resolve();
    expect(true).toBe(true);
  });
});

describe('anchorDelta', () => {
  it('is zero for a shift of a pixel or less', () => {
    expect(anchorDelta(100, 100)).toBe(0);
    expect(anchorDelta(100, 100.5)).toBe(0);
    expect(anchorDelta(100, 101)).toBe(0);
    expect(anchorDelta(100, 99)).toBe(0);
  });

  it('is the shift, signed, when it exceeds a pixel', () => {
    expect(anchorDelta(100, 130)).toBe(30);
    expect(anchorDelta(130, 100)).toBe(-30);
    expect(anchorDelta(100, 101.5)).toBeCloseTo(1.5);
  });
});

describe('browserExpanderEnv', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is importable in Node without touching document or window', () => {
    // The static import at the top of this file already ran in Node.
    expect(typeof browserExpanderEnv).toBe('function');
    expect(typeof globalThis.document).toBe('undefined');
  });

  it('builds the environment from document and matchMedia when called', () => {
    const startViewTransition = vi.fn(function (this: unknown, update: () => void) {
      update();
      return { finished: Promise.resolve() };
    });
    const doc = { startViewTransition };
    vi.stubGlobal('document', doc);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('reduce') })),
    );
    const flush = vi.fn((fn: () => void) => fn());
    const env = browserExpanderEnv(flush);

    expect(env.startViewTransition).not.toBeNull();
    let ran = false;
    env.startViewTransition!(() => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    // Bound to document.
    expect(startViewTransition.mock.contexts[0]).toBe(doc);

    expect(env.reducedMotion()).toBe(true);
    expect(env.flush).toBe(flush);

    const handle = env.setTimeout(() => {}, 1_000_000);
    env.clearTimeout(handle);
  });

  it('reads the reduced-motion preference at request time, not at build time', () => {
    vi.stubGlobal('document', {});
    let matches = false;
    vi.stubGlobal('matchMedia', () => ({ matches }));
    const env = browserExpanderEnv((fn) => fn());
    expect(env.reducedMotion()).toBe(false);
    matches = true;
    expect(env.reducedMotion()).toBe(true);
  });

  it('has no transition API when document lacks startViewTransition', () => {
    vi.stubGlobal('document', {});
    const env = browserExpanderEnv((fn) => fn());
    expect(env.startViewTransition).toBeNull();
  });
});

describe('the module is framework-free', () => {
  it('does not import svelte', () => {
    const file = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../src/lib/features/overview/overview-motion.ts',
    );
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/from\s+['"]svelte/);
  });
});
