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

import type { PlaytimeOutcome } from '../../../src/lib/features/playtime/playtime-client';
import type {
  PlaytimeSlice,
  PlaytimeSplit,
  PlaytimeView,
} from '../../../src/lib/core/types/worker-messages';
import { PLAYTIME_LOADING, PLAYTIME_UPDATING, SPLIT_BLANK_VALUE } from '../../../src/lib/ui-copy';

type StateModule = typeof import('../../../src/lib/features/playtime/playtime-state');

let cached: Promise<StateModule> | null = null;

const load = (): Promise<StateModule> => {
  cached ??= import('../../../src/lib/features/playtime/playtime-state');
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
/** Phase 10: a VALID token with no usable session in this export. */
const NO_GAME: PlaytimeView = { status: 'no-game-sessions', game: 'WOWS', games: ['WOT', 'WOTB'] };

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

  test('every state is reachable, and only those', async () => {
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
      // Phase 10 adds the seventh: an export that HAS sessions, just not this
      // game's (D-03).
      derivePlaytimeState({ importedAt: DATASET, shown: view(NO_GAME), requested: null }),
      derivePlaytimeState({
        importedAt: DATASET,
        shown: { kind: 'failed', importedAt: DATASET, valueIndex: null },
        requested: null,
      }),
    ]);
    expect([...seen].sort()).toEqual(
      [
        'error',
        'loading',
        'no-game-sessions',
        'no-session-file',
        'no-usable-sessions',
        'ready',
        'updating',
      ].sort(),
    );
  });
});

// -----------------------------------------------------------------------------
// The game dimension (Phase 10, D-01/D-03, T-10-06)
// -----------------------------------------------------------------------------
//
// A slice is the PAIR (value index, game). These tests exist because comparing
// only the index was correct until Phase 10 and is now WRONG in one specific
// way: a chip click always carries `valueIndex: null`, so a request that
// differed from what is on screen only by game compared EQUAL, the status line
// never said "Updating charts...", and the previous game's numbers sat on
// screen looking final.

describe('derivePlaytimeState: the game half of the slice', () => {
  /** A `ready` answer for `game`, applied at All. */
  const shownFor = (game: string | null) => ({
    kind: 'view' as const,
    importedAt: DATASET,
    valueIndex: null,
    game,
    view: { ...READY_ALL, games: ['WOT', 'WOTB'], game },
  });

  test('a request differing only by game is updating, not ready', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      // All games is on screen; the reader just clicked WoT, which carries
      // `valueIndex: null` exactly like the answer on screen does.
      shown: shownFor(null),
      requested: { importedAt: DATASET, valueIndex: null, game: 'WOT' },
    });
    expect(state).toBe('updating');
  });

  test('the same game at the same index is ready, so the state can settle', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: shownFor('WOT'),
      requested: { importedAt: DATASET, valueIndex: null, game: 'WOT' },
    });
    expect(state).toBe('ready');
  });

  test('going back to All games from a game is updating too', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: shownFor('WOT'),
      requested: { importedAt: DATASET, valueIndex: null, game: null },
    });
    expect(state).toBe('updating');
  });

  test('an ABSENT game equals a null game, on both sides of the comparison', async () => {
    // The optional field exists so a caller written against the pre-game
    // contract keeps working; the two spellings must be indistinguishable.
    const { derivePlaytimeState } = await load();
    expect(
      derivePlaytimeState({
        importedAt: DATASET,
        shown: { kind: 'view', importedAt: DATASET, valueIndex: null, view: READY_ALL },
        requested: { importedAt: DATASET, valueIndex: null },
      }),
    ).toBe('ready');
    expect(
      derivePlaytimeState({
        importedAt: DATASET,
        shown: { kind: 'view', importedAt: DATASET, valueIndex: null, game: null, view: READY_ALL },
        requested: { importedAt: DATASET, valueIndex: null, game: null },
      }),
    ).toBe('ready');
    // And absent on one side only is still the same answer, not `updating`.
    expect(
      derivePlaytimeState({
        importedAt: DATASET,
        shown: { kind: 'view', importedAt: DATASET, valueIndex: null, view: READY_ALL },
        requested: { importedAt: DATASET, valueIndex: null, game: null },
      }),
    ).toBe('ready');
  });

  test('a request for another dataset never makes this one updating, game or not', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: shownFor(null),
      requested: { importedAt: OTHER_DATASET, valueIndex: null, game: 'WOT' },
    });
    expect(state).toBe('ready');
  });
});

describe('acceptOutcome stamps the game from the ASK', () => {
  const result = (view: PlaytimeView): PlaytimeOutcome => ({
    kind: 'result',
    queryId: 1,
    importedAt: DATASET,
    view,
  });

  test('an applied answer carries the ask’s game, not the reply’s account of itself', async () => {
    const { acceptOutcome } = await load();
    // The reply says it was scoped to WOT; the ask said WOWS. The ASK wins, so
    // `awaiting` can settle — a stamp taken from the reply could never do so.
    const accepted = acceptOutcome(
      result({ ...READY_ALL, game: 'WOT' }),
      { importedAt: DATASET, valueIndex: null, game: 'WOWS' },
      DATASET,
    );
    expect(accepted).toMatchObject({
      kind: 'view',
      importedAt: DATASET,
      valueIndex: null,
      game: 'WOWS',
    });
  });

  test('an absent game on the ask is stamped as null', async () => {
    const { acceptOutcome } = await load();
    const accepted = acceptOutcome(result(READY_ALL), ask, DATASET);
    expect(accepted).toMatchObject({ kind: 'view', game: null });
  });

  test('a failure is stamped with the ask’s game too', async () => {
    // The rollback in `Playtime.svelte` reconciles `requested` against `shown`,
    // so the two must agree on the game or the status line never clears.
    const { acceptOutcome } = await load();
    const accepted = acceptOutcome(
      { kind: 'error', queryId: 1, detail: 'worker unavailable' },
      { importedAt: DATASET, valueIndex: null, game: 'WOTB' },
      DATASET,
    );
    expect(accepted).toMatchObject({ kind: 'failed', game: 'WOTB' });
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
    // `game: null` is part of the stamp from Phase 10 on, even though this ask
    // carries none: absent and null mean the same thing, and writing the key
    // explicitly is what lets `derivePlaytimeState` compare the pair without
    // first having to know whether the caller used the other spelling.
    expect(acceptOutcome(outcome, ask, DATASET)).toEqual({
      kind: 'failed',
      importedAt: DATASET,
      valueIndex: 1,
      game: null,
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
      game: null,
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
    // And an empty GAME announces nothing either: it carries no slice, and the
    // body line beside the chips is the message. A live region repeating it
    // would be a second sentence saying the same thing.
    expect(selectionAnnouncement(NO_GAME)).toBe('');
  });
});

// -----------------------------------------------------------------------------
// The game in the announcement (Phase 10, D-03)
// -----------------------------------------------------------------------------

describe('selectionAnnouncement names the applied game', () => {
  const readyFor = (game: string | null, selected: number | null = null): PlaytimeView =>
    selected === null
      ? { ...READY_ALL, games: ['WOT', 'WOTB'], game }
      : { ...READY_SELECTED, selected, games: ['WOT', 'WOTB'], game };

  test('a game with no split value names the game alone', async () => {
    const { selectionAnnouncement } = await load();
    expect(selectionAnnouncement(readyFor('WOT'))).toBe(
      'Showing WoT: 1.5 hours, 3 sessions, 2 active days.',
    );
  });

  test('a game and a split value are joined, game first', async () => {
    const { selectionAnnouncement } = await load();
    expect(selectionAnnouncement(readyFor('WOTB', 1))).toBe(
      'Showing WoT Blitz, eu-1: 3.5 hours, 4 sessions, 3 active days.',
    );
  });

  test('All games is unchanged — the subject stays "all sessions"', async () => {
    const { selectionAnnouncement } = await load();
    // `null`, `undefined` and an absent `game` all mean All, and none of them
    // may leak into the sentence.
    expect(selectionAnnouncement(readyFor(null))).toBe(
      'Showing all sessions: 1.5 hours, 3 sessions, 2 active days.',
    );
    expect(selectionAnnouncement(readyFor(null, 1))).toBe(
      'Showing eu-1: 3.5 hours, 4 sessions, 3 active days.',
    );
  });

  test('a blank split value inside a game keeps its own label', async () => {
    const { selectionAnnouncement } = await load();
    const view: PlaytimeView = { ...READY_SELECTED, selected: 0, games: ['WOT'], game: 'WOT' };
    expect(selectionAnnouncement(view)).toBe(
      `Showing WoT, ${SPLIT_BLANK_VALUE}: 3.5 hours, 4 sessions, 3 active days.`,
    );
  });

  test('a game token with no name of its own is announced as the token', async () => {
    // T-06-05's rule, in the one place a game reaches the accessibility tree
    // rather than the screen: the token was validated by the worker, and an
    // unknown one is still the honest answer.
    const { selectionAnnouncement } = await load();
    expect(selectionAnnouncement(readyFor('SOME_NEW_GAME'))).toBe(
      'Showing SOME_NEW_GAME: 1.5 hours, 3 sessions, 2 active days.',
    );
  });
});

// -----------------------------------------------------------------------------
// The empty-game state (Phase 10, D-03)
// -----------------------------------------------------------------------------

describe("derivePlaytimeState: 'no-game-sessions'", () => {
  test('an empty game is its own state, not an error and not a ready with no numbers', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: DATASET, valueIndex: null, game: 'WOWS', view: NO_GAME },
      requested: { importedAt: DATASET, valueIndex: null, game: 'WOWS' },
    });
    expect(state).toBe('no-game-sessions');
  });

  test('a request for a DIFFERENT game while an empty one is shown is updating', async () => {
    const { derivePlaytimeState } = await load();
    // The same rule as `ready`: what is on screen is not what is being asked
    // about, so the body stays up and the status line says "Updating charts...".
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: DATASET, valueIndex: null, game: 'WOWS', view: NO_GAME },
      requested: { importedAt: DATASET, valueIndex: null, game: 'WOT' },
    });
    expect(state).toBe('updating');
  });

  test('a request for ANOTHER dataset does not mask the empty game', async () => {
    const { derivePlaytimeState } = await load();
    const state = derivePlaytimeState({
      importedAt: DATASET,
      shown: { kind: 'view', importedAt: DATASET, valueIndex: null, game: 'WOWS', view: NO_GAME },
      requested: { importedAt: OTHER_DATASET, valueIndex: null, game: 'WOT' },
    });
    expect(state).toBe('no-game-sessions');
  });

  test('statusLine leaves the empty game to the body line rather than announcing it', async () => {
    const { statusLine } = await load();
    // The live region carries the announcement, and an empty-game answer has
    // none — so the status paragraph says nothing and the body says the message.
    expect(statusLine('no-game-sessions', '')).toBe('');
    expect(statusLine('no-game-sessions', 'Showing WoT: 1.5 hours.')).toBe(
      'Showing WoT: 1.5 hours.',
    );
    expect(statusLine('updating', 'Showing WoT: 1.5 hours.')).toBe(PLAYTIME_UPDATING);
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
    const { formatSplitValue } = await import('../../../src/lib/ui-copy');
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
