// =============================================================================
// playtime-state — the Playtime block's decisions, as pure functions.
//
// WHY THIS FILE EXISTS
//
// The 04-UI-SPEC "Playtime state matrix" is six states, and only one of them
// (`ready`) is what a first-visit user sees for longer than a frame. The rest
// are reached by races: a replace landing while a query is in flight, a
// selector dragged fast enough that the first answer arrives after the second
// was asked for, a worker that dies between two questions. Every one of those
// races is the SAME question — "may this answer be shown?" — and T-04-16 makes
// it a security property, because a stale answer is the previous export's
// numbers on screen under the new export's heading.
//
// Vitest runs with `environment: 'node'` and no jsdom (see vitest.config.ts
// and the Svelte-plugin note there), so a component cannot be rendered here.
// That is why the decision is not in the component: `Playtime.svelte` holds
// the DOM wiring and nothing else, and every rule below is stated once as a
// function that can be tested against hand-written views with no page.
//
// D-03 owns the state lifetime (a selection is never shown for the wrong
// dataset) and T-04-15 owns the trust boundary (a split value is text, and
// this module is where `''` is turned back into the blank value it was
// stored as).
//
// The module under test is loaded through a cached dynamic import rather than
// a static one, so a missing export is a failure IN THE TEST THAT NEEDS IT —
// naming the symbol — instead of a load-time crash that takes the whole file
// down and hides which behaviours are and are not implemented.
// =============================================================================

import { describe, expect, test } from 'vitest';

import type { PlaytimeOutcome } from '../../src/lib/playtime-client';
import type {
  PlaytimeSlice,
  PlaytimeSplit,
  PlaytimeView,
} from '../../src/lib/types/worker-messages';
import { PLAYTIME_LOADING, PLAYTIME_UPDATING, SPLIT_BLANK_VALUE } from '../../src/lib/ui-copy';

type StateModule = typeof import('../../src/lib/playtime-state');

let cached: Promise<StateModule> | null = null;

const load = (): Promise<StateModule> => {
  cached ??= import('../../src/lib/playtime-state');
  return cached;
};

// -----------------------------------------------------------------------------
// Hand-written views. Every number here is a literal rather than an aggregate,
// so a change in the worker's arithmetic cannot move this file's expectations.
// -----------------------------------------------------------------------------

/** A slice with `days` active days, whatever the hour grid holds. */
function sliceOf(days: number, seconds = 5430, sessions = 3): PlaytimeSlice {
  return {
    seconds,
    sessions,
    excluded: 0,
    dayIndex: Array.from({ length: days }, (_, i) => 20_000 + i),
    daySeconds: Array.from({ length: days }, (_, i) => seconds / days - i * 0),
    daySessions: Array.from({ length: days }, () => 1),
    hourOverlap: new Array<number>(168).fill(0),
    hourStart: new Array<number>(168).fill(0),
    bins: new Array<number>(12).fill(0),
  };
}

/** A split whose values are the given raw strings, in the worker's order. */
function splitOf(values: readonly string[], allSeconds = 18000): PlaytimeSplit {
  return {
    column: 'SERVER_NAME',
    values: values.map((value, index) => ({ value, seconds: 6000 * (index + 1) })),
    allSeconds,
  };
}

const READY_ALL: PlaytimeView = {
  status: 'ready',
  split: splitOf(['eu-1']),
  selected: null,
  slice: sliceOf(2),
};

const READY_SELECTED: PlaytimeView = {
  status: 'ready',
  split: splitOf(['', 'eu-1']),
  selected: 1,
  slice: sliceOf(3, 12630, 4),
};

const NO_SESSION_FILE: PlaytimeView = { status: 'no-session-file' };
const NO_USABLE: PlaytimeView = { status: 'no-usable-sessions', excluded: 4 };

/** The dataset stamps every test uses, kept distinct so a mix-up is visible. */
const DATASET = '2026-09-30T10:00:00.000Z';
const OTHER_DATASET = '2026-09-30T11:00:00.000Z';

// -----------------------------------------------------------------------------
// derivePlaytimeState
// -----------------------------------------------------------------------------

describe('derivePlaytimeState', () => {
  test('no dataset at all is loading: there is nothing to ask about', async () => {
    const { derivePlaytimeState } = await load();
    expect(derivePlaytimeState({ importedAt: null, shown: null, requested: null })).toBe('loading');
  });

  test('no answer yet is loading', async () => {
    const { derivePlaytimeState } = await load();
    expect(derivePlaytimeState({ importedAt: DATASET, shown: null, requested: null })).toBe(
      'loading',
    );
  });

  test("an answer for another dataset is loading, not that dataset's numbers", async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: OTHER_DATASET, valueIndex: null, view: READY_ALL },
      requested: null,
    });
    expect(state).toBe('loading');
  });

  test('a failed answer is error', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'failed', importedAt: DATASET, valueIndex: null },
      requested: null,
    });
    expect(state).toBe('error');
  });

  test('a failure for another dataset is still loading, not an error about this one', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'failed', importedAt: OTHER_DATASET, valueIndex: null },
      requested: null,
    });
    expect(state).toBe('loading');
  });

  test('a ready answer with no request is ready', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: DATASET, valueIndex: null, view: READY_ALL },
      requested: null,
    });
    expect(state).toBe('ready');
  });

  test('a same-dataset request for a DIFFERENT index is updating', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: DATASET, valueIndex: null, view: READY_ALL },
      requested: { importedAt: DATASET, valueIndex: 1 },
    });
    expect(state).toBe('updating');
  });

  test('a same-dataset request for the index already shown is ready, not updating', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: DATASET, valueIndex: 1, view: READY_SELECTED },
      requested: { importedAt: DATASET, valueIndex: 1 },
    });
    expect(state).toBe('ready');
  });

  test('a request for ANOTHER dataset never makes this one updating', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: DATASET, valueIndex: null, view: READY_ALL },
      requested: { importedAt: OTHER_DATASET, valueIndex: 1 },
    });
    expect(state).toBe('ready');
  });

  test('a request for a dataset that is no longer displayed does not mask an empty state', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: {
        kind: 'view',
        importedAt: DATASET,
        valueIndex: null,
        view: NO_USABLE,
      },
      requested: { importedAt: OTHER_DATASET, valueIndex: 0 },
    });
    expect(state).toBe('no-usable-sessions');
  });

  test('no-session-file and no-usable-sessions are their own states, not empty ready', async () => {
    const { derivePlaytimeState } = await load();
    const asked = { importedAt: DATASET, valueIndex: 0 };
    const shown = (view: PlaytimeView) => ({
      kind: 'view' as const,
      importedAt: DATASET,
      valueIndex: null,
      view,
    });
    expect(
      derivePlaytimeState({ importedAt: DATASET, shown: shown(NO_SESSION_FILE), requested: null }),
    ).toBe('no-session-file');
    expect(
      derivePlaytimeState({ importedAt: DATASET, shown: shown(NO_SESSION_FILE), requested: asked }),
    ).toBe('no-session-file');
    expect(
      derivePlaytimeState({ importedAt: DATASET, shown: shown(NO_USABLE), requested: null }),
    ).toBe('no-usable-sessions');
    expect(
      derivePlaytimeState({ importedAt: DATASET, shown: shown(NO_USABLE), requested: asked }),
    ).toBe('no-usable-sessions');
  });

  test('every one of the six states is reachable, and only those six', async () => {
    const { derivePlaytimeState } = await load();
    const view = (v: PlaytimeView) => ({
      kind: 'view' as const,
      importedAt: DATASET,
      valueIndex: null,
      view: v,
    });
    const seen = new Set([
      derivePlaytimeState({ importedAt: null, shown: null, requested: null }),
      derivePlaytimeState({ importedAt: DATASET, shown: view(READY_ALL), requested: null }),
      derivePlaytimeState({
        importedAt: DATASET,
        shown: view(READY_ALL),
        requested: { importedAt: DATASET, valueIndex: 1 },
      }),
      derivePlaytimeState({ importedAt: DATASET, shown: view(NO_SESSION_FILE), requested: null }),
      derivePlaytimeState({ importedAt: DATASET, shown: view(NO_USABLE), requested: null }),
      derivePlaytimeState({
        importedAt: DATASET,
        shown: { kind: 'failed', importedAt: DATASET, valueIndex: null },
        requested: null,
      }),
    ]);
    expect([...seen].sort()).toEqual(
      ['error', 'loading', 'no-session-file', 'no-usable-sessions', 'ready', 'updating'].sort(),
    );
  });
});

// -----------------------------------------------------------------------------
// acceptOutcome — T-04-16, the trust boundary between a reply and the screen
// -----------------------------------------------------------------------------

/** The `ask` the component hands to every load, and the outcome a worker sends. */
const ask = { importedAt: DATASET, valueIndex: 1 };

describe('acceptOutcome', () => {
  test('a superseded outcome is dropped: newer numbers are already on the way', async () => {
    const { acceptOutcome } = await load();
    const outcome: PlaytimeOutcome = { kind: 'superseded', queryId: 1 };
    expect(acceptOutcome(outcome, ask, DATASET)).toBeNull();
  });

  test('an answer is dropped once the dataset on screen has moved on', async () => {
    const { acceptOutcome } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: DATASET,
      view: READY_SELECTED,
    };
    expect(acceptOutcome(outcome, ask, OTHER_DATASET)).toBeNull();
  });

  test('a result with a null importedAt is dropped: the worker said no dataset', async () => {
    const { acceptOutcome } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: null,
      view: READY_ALL,
    };
    expect(acceptOutcome(outcome, ask, DATASET)).toBeNull();
  });

  test('a result the worker stamped with another dataset is dropped', async () => {
    const { acceptOutcome } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: OTHER_DATASET,
      view: READY_SELECTED,
    };
    expect(acceptOutcome(outcome, ask, DATASET)).toBeNull();
  });

  test('a result carrying no view is dropped, never rendered as a null slice', async () => {
    const { acceptOutcome } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: DATASET,
      view: null,
    };
    expect(acceptOutcome(outcome, ask, DATASET)).toBeNull();
  });

  test('an error outcome becomes a failed shown stamped with the ask, not the worker detail', async () => {
    const { acceptOutcome } = await load();
    const outcome: PlaytimeOutcome = { kind: 'error', queryId: 1, detail: 'worker unavailable' };
    expect(acceptOutcome(outcome, ask, DATASET)).toEqual({
      kind: 'failed',
      importedAt: DATASET,
      valueIndex: 1,
    });
  });

  test('a matching result becomes a shown view carrying the ask and the view', async () => {
    const { acceptOutcome } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: DATASET,
      view: READY_SELECTED,
    };
    expect(acceptOutcome(outcome, ask, DATASET)).toEqual({
      kind: 'view',
      importedAt: DATASET,
      valueIndex: 1,
      view: READY_SELECTED,
    });
  });
});

// -----------------------------------------------------------------------------
// isCacheClearedElsewhere — 04-16, G-04-5, when the silence is worth breaking
// -----------------------------------------------------------------------------
//
// `acceptOutcome` above answers "may this be shown?". This one answers "was
// the store emptied under a tab that still holds the dataset?", and the notice
// it gates is a CLAIM about what happened, so a false positive would tell a
// user their data was cleared when it was not.
//
// That is why the matrix is one true case against seven false ones rather than
// a couple of examples: a `true` is a sentence on screen, and every false case
// here is a real shape `PlaytimeClient` can hand back. The dataset is
// `DATASET` throughout and `OTHER_DATASET` is the replace, so a test that mixed
// the two up would read as a false negative rather than a typo.
describe('isCacheClearedElsewhere (04-16, G-04-5)', () => {
  test('a result with no dataset and no view means the store was emptied', async () => {
    // The one true case: the worker could not name a dataset, and this tab is
    // still showing one. That combination is what a second tab clearing the
    // origin's cache produces, and it is why the notice exists.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = { kind: 'result', queryId: 1, importedAt: null, view: null };
    expect(isCacheClearedElsewhere(outcome, ask, DATASET)).toBe(true);
  });

  test('a superseded answer cleared nothing', async () => {
    // A newer ask already took over. Nothing failed, nothing was cleared, and
    // the user has numbers on the way — a notice here would be a lie about a
    // store that is perfectly intact.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = { kind: 'superseded', queryId: 1 };
    expect(isCacheClearedElsewhere(outcome, ask, DATASET)).toBe(false);
  });

  test('an error is an error, not a clear', async () => {
    // A failed query has its own state with its own copy (PLAYTIME_ERROR). It
    // says nothing about the store, and reusing it for this would put a second
    // sentence on the same state.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = { kind: 'error', queryId: 1, detail: 'worker unavailable' };
    expect(isCacheClearedElsewhere(outcome, ask, DATASET)).toBe(false);
  });

  test('a result stamped with another dataset is a replace, not a clear', async () => {
    // Another tab imported something else. The store is NOT empty, so
    // "your cached data was cleared" would be false, and the remedy would be
    // wrong: this tab's dataset is stale, not gone. Deliberately left as the
    // silent drop 04-14 made it.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: OTHER_DATASET,
      view: READY_SELECTED,
    };
    expect(isCacheClearedElsewhere(outcome, ask, DATASET)).toBe(false);
  });

  test('a dataset with no stored aggregate is not a cleared cache', async () => {
    // The worker holds a dataset but has no aggregate for it. That is a fact
    // about the worker's storage, not about the origin's cache, and it is the
    // neighbouring case the plan named as deliberately left alone.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: DATASET,
      view: null,
    };
    expect(isCacheClearedElsewhere(outcome, ask, DATASET)).toBe(false);
  });

  test('a null stamp WITH a view is an inconsistent shape, not a clear', async () => {
    // The worker cannot produce this, so the predicate refuses to guess at it.
    // Reading it as a clear would turn a worker bug into a sentence on the
    // user's screen.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = {
      kind: 'result',
      queryId: 1,
      importedAt: null,
      view: READY_ALL,
    };
    expect(isCacheClearedElsewhere(outcome, ask, DATASET)).toBe(false);
  });

  test('with no dataset on screen there is nothing for a clear to have emptied', async () => {
    // The page is showing nothing, so there is no cached data of the user's to
    // have lost — and the block renders no tiles for a notice to sit above.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = { kind: 'result', queryId: 1, importedAt: null, view: null };
    expect(isCacheClearedElsewhere(outcome, ask, null)).toBe(false);
  });

  test('an answer for a dataset that was replaced mid-flight cleared nothing', async () => {
    // The ask belongs to a dashboard nobody is looking at any more. The same
    // reply would be a clear if it had arrived in time, and the gate is what
    // stops a stale answer from speaking about the new dataset.
    const { isCacheClearedElsewhere } = await load();
    const outcome: PlaytimeOutcome = { kind: 'result', queryId: 1, importedAt: null, view: null };
    expect(isCacheClearedElsewhere(outcome, ask, OTHER_DATASET)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// selectionAnnouncement — the one live region (D-03)
// -----------------------------------------------------------------------------

describe('selectionAnnouncement', () => {
  test('All is named as all sessions, with the slice behind it', async () => {
    const { selectionAnnouncement } = await load();
    expect(selectionAnnouncement(READY_ALL)).toBe(
      'Showing all sessions: 1.5 hours, 3 sessions, 2 active days.',
    );
  });

  test('a chosen value is named with its own slice', async () => {
    const { selectionAnnouncement } = await load();
    expect(selectionAnnouncement(READY_SELECTED)).toBe(
      'Showing eu-1: 3.5 hours, 4 sessions, 3 active days.',
    );
  });

  test("a blank value announces the blank value's label, not an empty name", async () => {
    const { selectionAnnouncement } = await load();
    const view: PlaytimeView = { ...READY_SELECTED, selected: 0 };
    expect(selectionAnnouncement(view)).toBe(
      `Showing ${SPLIT_BLANK_VALUE}: 3.5 hours, 4 sessions, 3 active days.`,
    );
  });

  test('a real value that literally reads like the blank label stays a real value', async () => {
    const { selectionAnnouncement } = await load();
    const view: PlaytimeView = {
      ...READY_SELECTED,
      split: splitOf([SPLIT_BLANK_VALUE, 'eu-1']),
      selected: 0,
    };
    // Identical text, different value: the two are told apart by index, which
    // is the only thing the export can actually distinguish.
    expect(selectionAnnouncement(view)).toBe(
      `Showing ${SPLIT_BLANK_VALUE}: 3.5 hours, 4 sessions, 3 active days.`,
    );
    expect(view.split?.values[0]?.value).toBe(SPLIT_BLANK_VALUE);
  });

  test('a view that is not ready announces nothing', async () => {
    const { selectionAnnouncement } = await load();
    expect(selectionAnnouncement(NO_SESSION_FILE)).toBe('');
    expect(selectionAnnouncement(NO_USABLE)).toBe('');
  });
});

// -----------------------------------------------------------------------------
// statusLine
// -----------------------------------------------------------------------------

describe('statusLine', () => {
  test('loading and updating read their own fixed sentences', async () => {
    const { statusLine } = await load();
    expect(statusLine('loading', '')).toBe(PLAYTIME_LOADING);
    expect(statusLine('updating', 'Showing eu-1: 3.5 hours.')).toBe(PLAYTIME_UPDATING);
  });

  test('every other state carries the announcement, which may be empty', async () => {
    const { statusLine } = await load();
    expect(statusLine('ready', 'Showing eu-1: 3.5 hours.')).toBe('Showing eu-1: 3.5 hours.');
    expect(statusLine('ready', '')).toBe('');
    expect(statusLine('no-session-file', '')).toBe('');
    expect(statusLine('no-usable-sessions', '')).toBe('');
    expect(statusLine('error', 'stale text from an earlier selection')).toBe(
      'stale text from an earlier selection',
    );
  });
});

// -----------------------------------------------------------------------------
// The two boundary rules the components depend on
// -----------------------------------------------------------------------------

describe('splitValue — the blank value crossing back into the display layer', () => {
  test('the empty string is the blank value the worker stored as null', async () => {
    const { splitValue } = await load();
    expect(splitValue('')).toBeNull();
  });

  test('every non-empty value passes through untouched, including one that looks like the label', async () => {
    const { splitValue } = await load();
    expect(splitValue('eu-1')).toBe('eu-1');
    expect(splitValue(' eu-1 ')).toBe(' eu-1 ');
    expect(splitValue(SPLIT_BLANK_VALUE)).toBe(SPLIT_BLANK_VALUE);
    expect(splitValue('<b>eu-1</b>')).toBe('<b>eu-1</b>');
  });

  test('the boundary value renders through ui-copy as the blank label, not as an empty cell', async () => {
    const { splitValue } = await load();
    const { formatSplitValue } = await import('../../src/lib/ui-copy');
    expect(formatSplitValue(splitValue(''))).toBe(SPLIT_BLANK_VALUE);
  });
});

describe('splitColumnOf — the stored column name as a label this build has words for', () => {
  test('the two legacy columns the worker can choose are recognised', async () => {
    const { splitColumnOf } = await load();
    expect(splitColumnOf('SERVER_NAME')).toBe('SERVER_NAME');
    expect(splitColumnOf('CLIENT_PLATFORM')).toBe('CLIENT_PLATFORM');
  });

  test('GAME is recognised beside them, since the export names the game in the file', async () => {
    // 04-15. The real export carries no SERVER_NAME and no CLIENT_PLATFORM at
    // all, so GAME is the only column it can ever produce — and before this
    // name was recognised the block rendered no selector, no split table and
    // no overlap note for a perfectly good two-game export, because it could
    // not name the column it had been given.
    const { splitColumnOf } = await load();
    expect(splitColumnOf('GAME')).toBe('GAME');
    expect(splitColumnOf('SERVER_NAME')).toBe('SERVER_NAME');
    expect(splitColumnOf('CLIENT_PLATFORM')).toBe('CLIENT_PLATFORM');

    // Case is not forgiven, and nothing else is a column. An unrecognised name
    // must not reach the label table, which would answer `undefined` and throw
    // inside a render.
    expect(splitColumnOf('game')).toBeNull();
    expect(splitColumnOf('IP')).toBeNull();
    expect(splitColumnOf('CLIENT_BUILD')).toBeNull();
    expect(splitColumnOf('')).toBeNull();
  });

  test('any other name is not a split column this app can label', async () => {
    const { splitColumnOf } = await load();
    expect(splitColumnOf('IP')).toBeNull();
    expect(splitColumnOf('CLIENT_BUILD')).toBeNull();
    expect(splitColumnOf('')).toBeNull();
    expect(splitColumnOf('server_name')).toBeNull();
  });
});
