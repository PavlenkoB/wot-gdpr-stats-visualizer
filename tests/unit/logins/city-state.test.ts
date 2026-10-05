import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CityOutcome } from '../../../src/lib/features/logins/city-client.ts';
import type { CityView } from '../../../src/lib/features/logins/city-shared.ts';
import {
  acceptCityOutcome,
  cityReduce,
  initialCityState,
  type CityEvent,
  type CityState,
  type CityStateKind,
} from '../../../src/lib/features/logins/city-state.ts';

// =============================================================================
// The city opt-in's state machine, without a DOM (06-13, Task 2)
//
// Every decision the opt-in makes is a pure function here: which state follows
// which event, whether a dataset change must abort work in flight, and which
// worker answers may be shown. The component only wires them. That matters
// because the failures that count are not visual: a download that outlives the
// dataset it was started for, a cancel that is reported as a fault, a decode
// that lands on a replaced export.
// =============================================================================

const MANIFEST = { bytes: 11_877_710 };
const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-02-02T00:00:00.000Z';

/** Build a state in `kind` for the dataset `T0`. */
function stateIn(kind: CityStateKind, importedAt: string | null = T0): CityState {
  return { kind, importedAt, received: 0, total: null };
}

const ALL_KINDS: readonly CityStateKind[] = [
  'idle',
  'downloading',
  'decoding',
  'ready',
  'error',
  'cancelled',
  'unavailable',
];

/** The next kind for one event from one kind (the transition table's one cell). */
function next(kind: CityStateKind, event: CityEvent): CityStateKind {
  return cityReduce(stateIn(kind), event).state.kind;
}

describe('initialCityState', () => {
  it('is unavailable exactly when the manifest is null, idle otherwise', () => {
    expect(initialCityState(null).kind).toBe('unavailable');
    expect(initialCityState(MANIFEST).kind).toBe('idle');
    expect(initialCityState(MANIFEST, T0).importedAt).toBe(T0);
  });
});

describe('cityReduce transitions', () => {
  it('idle on press goes to downloading, with no bytes yet', () => {
    const { state, effect } = cityReduce(stateIn('idle'), { type: 'press' });
    expect(state).toMatchObject({ kind: 'downloading', received: 0, total: null });
    expect(effect).toBe('none');
  });

  it('downloading on bytes-in goes to decoding', () => {
    expect(next('downloading', { type: 'bytes-in' })).toBe('decoding');
  });

  it('decoding on a result goes to ready', () => {
    expect(next('decoding', { type: 'result' })).toBe('ready');
  });

  it('downloading on cancel goes to cancelled, and never to error', () => {
    expect(next('downloading', { type: 'cancel' })).toBe('cancelled');
  });

  it('downloading or decoding on failure goes to error', () => {
    expect(next('downloading', { type: 'failure' })).toBe('error');
    expect(next('decoding', { type: 'failure' })).toBe('error');
  });

  it('cancelled and error on press go back to downloading', () => {
    expect(next('cancelled', { type: 'press' })).toBe('downloading');
    expect(next('error', { type: 'press' })).toBe('downloading');
  });

  it('ready accepts no press, and unavailable accepts nothing', () => {
    const events: CityEvent[] = [
      { type: 'press' },
      { type: 'progress', received: 5, total: 10 },
      { type: 'bytes-in' },
      { type: 'result' },
      { type: 'failure' },
      { type: 'cancel' },
    ];
    for (const event of events) {
      expect(next('ready', event), `ready on ${event.type}`).toBe('ready');
      expect(next('unavailable', event), `unavailable on ${event.type}`).toBe('unavailable');
    }
    expect(cityReduce(stateIn('unavailable'), { type: 'dataset-change', importedAt: T1 })).toEqual({
      state: stateIn('unavailable'),
      effect: 'none',
    });
  });

  it('a press while a load is in flight is ignored: at most one request per press', () => {
    expect(next('downloading', { type: 'press' })).toBe('downloading');
    expect(next('decoding', { type: 'press' })).toBe('decoding');
  });

  it('cancel is only offered while downloading: decoding is not interruptible', () => {
    expect(next('decoding', { type: 'cancel' })).toBe('decoding');
    expect(next('idle', { type: 'cancel' })).toBe('idle');
  });

  it('progress is recorded while downloading and ignored in every other state', () => {
    const event: CityEvent = { type: 'progress', received: 40, total: 100 };
    expect(cityReduce(stateIn('downloading'), event).state).toMatchObject({
      kind: 'downloading',
      received: 40,
      total: 100,
    });
    for (const kind of ALL_KINDS.filter((k) => k !== 'downloading')) {
      expect(cityReduce(stateIn(kind), event).state, kind).toEqual(stateIn(kind));
    }
  });

  it('a later press starts from zero bytes, not from the cancelled download', () => {
    const cancelled: CityState = { kind: 'cancelled', importedAt: T0, received: 70, total: 100 };
    expect(cityReduce(cancelled, { type: 'press' }).state).toMatchObject({
      kind: 'downloading',
      received: 0,
      total: null,
    });
  });
});

describe('a dataset change (replace or Clear)', () => {
  it('returns idle from every state that can hold work or a result, flagging a silent abort', () => {
    for (const kind of ALL_KINDS.filter((k) => k !== 'unavailable')) {
      const { state, effect } = cityReduce(stateIn(kind), {
        type: 'dataset-change',
        importedAt: T1,
      });
      expect(state, kind).toMatchObject({ kind: 'idle', importedAt: T1, received: 0, total: null });
      expect(effect, kind).toBe('abort-silently');
    }
  });

  it('never enters the cancelled state, from downloading or decoding', () => {
    for (const kind of ['downloading', 'decoding'] as const) {
      const { state } = cityReduce(stateIn(kind), { type: 'dataset-change', importedAt: T1 });
      expect(state.kind).not.toBe('cancelled');
    }
  });

  it('treats a Clear (no dataset) as a change too', () => {
    const { state, effect } = cityReduce(stateIn('downloading'), {
      type: 'dataset-change',
      importedAt: null,
    });
    expect(state.kind).toBe('idle');
    expect(effect).toBe('abort-silently');
  });

  it('is a no-op for the dataset the state already describes', () => {
    for (const kind of ALL_KINDS) {
      const before = stateIn(kind);
      expect(cityReduce(before, { type: 'dataset-change', importedAt: T0 })).toEqual({
        state: before,
        effect: 'none',
      });
    }
  });
});

describe('acceptCityOutcome', () => {
  const VIEW: CityView = {
    month: '2026-09',
    places: [],
    placeOf: [],
    ranked: [],
    moreCities: 0,
    noCityAddresses: 0,
  };
  const result = (over: Partial<Extract<CityOutcome, { kind: 'result' }>> = {}): CityOutcome => ({
    kind: 'result',
    loadId: 3,
    importedAt: T0,
    view: VIEW,
    ...over,
  });

  it('admits a result for this load and this dataset', () => {
    expect(acceptCityOutcome(result(), 3, T0)).toEqual({
      kind: 'view',
      importedAt: T0,
      view: VIEW,
    });
  });

  it('drops a superseded load', () => {
    expect(acceptCityOutcome({ kind: 'superseded', loadId: 3 }, 3, T0)).toBeNull();
  });

  it('drops a result for another dataset, and one for another load', () => {
    expect(acceptCityOutcome(result({ importedAt: T1 }), 3, T0)).toBeNull();
    expect(acceptCityOutcome(result(), 3, T1)).toBeNull();
    expect(acceptCityOutcome(result({ loadId: 2 }), 3, T0)).toBeNull();
  });

  it('drops a view-less result and any result when no dataset is on screen', () => {
    expect(acceptCityOutcome(result({ view: null, importedAt: null }), 3, T0)).toBeNull();
    expect(acceptCityOutcome(result(), 3, null)).toBeNull();
  });

  it('admits an error for this load as a failure and drops one for another load', () => {
    expect(acceptCityOutcome({ kind: 'error', loadId: 3, detail: 'x' }, 3, T0)).toEqual({
      kind: 'failed',
    });
    expect(acceptCityOutcome({ kind: 'error', loadId: 2, detail: 'x' }, 3, T0)).toBeNull();
  });

  it('never carries the error detail forward', () => {
    const accepted = acceptCityOutcome(
      { kind: 'error', loadId: 3, detail: '/secret/path.txt' },
      3,
      T0,
    );
    expect(JSON.stringify(accepted)).not.toContain('secret');
  });
});

// -----------------------------------------------------------------------------
// Source contracts
//
// A component cannot be rendered under Vitest, so the parts of the opt-in that
// are MARKUP are read off disk, with the two rules the other feature scans keep:
// the file must be asserted to EXIST first, and comments are stripped before a
// prohibition runs.
// -----------------------------------------------------------------------------

const FEATURE_DIR = join(process.cwd(), 'src/lib/features/logins');

function codeOfRequired(name: string): string {
  const path = join(FEATURE_DIR, name);
  expect(existsSync(path), `${path} does not exist`).toBe(true);
  return readFileSync(path, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/** The markup of a branch of the `{#if kind === ...}` chain, by its state name. */
function branchOf(code: string, state: string): string {
  const marker = `st.kind === '${state}'`;
  const at = code.indexOf(marker);
  expect(at, `no branch for ${state}`).toBeGreaterThan(-1);
  const rest = code.slice(at + marker.length);
  const end = rest.search(/\{:else|\{\/if\}/);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the Load button is gated behind idle, error and cancelled', () => {
  const code = codeOfRequired('CityOptIn.svelte');

  /** The one place the Load button is written; branches only render it. */
  const RENDER_LOAD = '{@render loadButton()}';

  it('writes the Load button once, in a snippet', () => {
    expect(code.match(/data-testid="city-load"/g)).toHaveLength(1);
    expect(code).toContain('{#snippet loadButton()}');
  });

  it('renders the Load button in idle, error and cancelled', () => {
    for (const state of ['idle', 'error', 'cancelled']) {
      expect(branchOf(code, state), state).toContain(RENDER_LOAD);
    }
  });

  it('does not render it in unavailable, downloading, decoding or ready', () => {
    for (const state of ['unavailable', 'downloading', 'decoding', 'ready']) {
      expect(branchOf(code, state), state).not.toContain(RENDER_LOAD);
      expect(branchOf(code, state), state).not.toContain('data-testid="city-load"');
    }
  });

  it('offers Cancel only while downloading', () => {
    expect(branchOf(code, 'downloading')).toContain('data-testid="city-cancel"');
    for (const state of ['idle', 'decoding', 'ready', 'error', 'cancelled', 'unavailable']) {
      expect(branchOf(code, state), state).not.toContain('data-testid="city-cancel"');
    }
  });

  it('puts role="alert" on the error only, and an aria-live attribute nowhere', () => {
    expect(branchOf(code, 'error')).toContain('role="alert"');
    for (const state of ['idle', 'downloading', 'decoding', 'ready', 'unavailable']) {
      expect(branchOf(code, state), state).not.toContain('role="alert"');
    }
    // Neutral cancel is the recorded presentation, so an alert role may only
    // appear in the cancelled branch behind the tone switch.
    expect(code).not.toContain('aria-live');
  });

  it('calls only fetchCityBytes, never the platform fetch', () => {
    expect(code).toContain('fetchCityBytes(');
    expect(code).not.toMatch(/(^|[^.\w])fetch\(/);
  });
});

describe('nothing city-related is persisted (D-15, T-06-51)', () => {
  for (const name of ['CityOptIn.svelte', 'CityList.svelte', 'city-state.ts', 'city-client.ts']) {
    it(`${name} touches no storage API, cookie or URL write`, () => {
      const code = codeOfRequired(name);
      for (const token of [
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'document.cookie',
        'history.pushState',
        'history.replaceState',
        'caches.',
      ]) {
        expect(code, `${name} must not touch ${token}`).not.toContain(token);
      }
    });
  }
});
