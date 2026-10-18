import { describe, expect, test } from 'vitest';
import {
  GAME_FILTER_TOKENS,
  filterAfterTitleChange,
  filterChips,
  filterToTitle,
  resolveGameFilter,
  type GameFilterChoice,
} from '../../../src/lib/shell/game-filter-state.ts';

// =============================================================================
// game-filter-state — the shared game filter's rules (10-02 Task 1)
// =============================================================================
//
// WHAT THIS PROVES
//   1. `filterChips`' VISIBILITY MATRIX — one rule, no per-case exceptions:
//      the row appears only when at least two chips would show different data,
//      or when a filterable token is applied (so the active choice is always
//      visible and reversible).
//   2. The row's ORDER and MEMBERSHIP: the fixed `GAME_FILTER_TOKENS` order,
//      and a token from the export that is not on that list can never become a
//      chip (T-10-05). An archive names its session files, so `games` is
//      untrusted input the worker validated but the UI must not re-trust.
//   3. The STAMP RESET (D-01, T-10-06): a filter chosen under one dataset must
//      not be applied to the next one, which is what makes a replace return the
//      filter to All games without a reset hook.
//   4. Token <-> title, including Warplanes leaving the filter untouched
//      (D-21, UI-SPEC Recorded Choice 4).
//
// Pure and DOM-free, so it runs under Node. The style is copied from
// `tests/unit/shell/selection-state.test.ts`; test files do not import each
// other in this repository, so the shape is repeated rather than shared.
// =============================================================================

/** A choice stamped for `stamp`, as `Dashboard.svelte` writes it. */
function choice(token: string | null, stamp: string | null = '2026-10-18T10:00:00.000Z') {
  return { token, stamp } satisfies GameFilterChoice;
}

// -----------------------------------------------------------------------------
// filterChips — the visibility matrix
// -----------------------------------------------------------------------------

describe('filterChips: when the row exists at all', () => {
  test('no games at all renders no node', () => {
    expect(filterChips([], null)).toBeNull();
  });

  test('ONE filterable token and nothing else renders no node', () => {
    // All games IS the only view this export has, so a row of chips could only
    // ever select what is already selected (UI-SPEC zero-one-many).
    expect(filterChips(['WOT'], null)).toBeNull();
  });

  test('two filterable tokens render both, in the FIXED order', () => {
    expect(filterChips(['WOTB', 'WOT'], null)).toEqual(['WOT', 'WOTB']);
  });

  test('one filterable token plus HEAT renders the row with that one token', () => {
    // All games differs from WoT here, because HEAT's sessions are counted
    // under All and have no chip of their own (D-05).
    expect(filterChips(['WOT', 'HEAT'], null)).toEqual(['WOT']);
  });

  test('only non-filterable tokens render no node', () => {
    expect(filterChips(['HEAT', 'WOTC'], null)).toBeNull();
    expect(filterChips(['WOTC', 'HEAT'], null)).toBeNull();
  });

  test('a hostile token never becomes a chip, whatever else is in the list', () => {
    const chips = filterChips(['WOT', '<b>WOTB</b>', '__proto__', 'WOWP'], null);
    expect(chips).toEqual(['WOT']);
    // And the same when the hostile token is the only other entry: the row is
    // still warranted (two game tokens) and still offers only the real one.
    expect(filterChips(['WOTB', 'constructor'], null)).toEqual(['WOTB']);
  });

  test('a repeated token is one game, so it does not warrant the row by itself', () => {
    // The worker's list is deduplicated, so this is a defensive answer rather
    // than a reachable one — and the RIGHT answer is "one game", not "two
    // chips that say the same thing". With a second DISTINCT token the row is
    // warranted as usual.
    expect(filterChips(['WOT', 'WOT'], null)).toBeNull();
    expect(filterChips(['WOT', 'WOT', 'WOTB'], null)).toEqual(['WOT', 'WOTB']);
  });
});

describe('filterChips: the active choice is always visible and reversible', () => {
  test('an applied filterable token renders the row even on a single-game export', () => {
    // The case UI-SPEC amendment 6 exists for: the reader can be looking at a
    // game with no sessions, and a row that vanished would leave no way back.
    expect(filterChips([], 'WOT')).toEqual(['WOT']);
    expect(filterChips(['WOT'], 'WOT')).toEqual(['WOT']);
  });

  test('an applied token is deduplicated against the tokens already present', () => {
    expect(filterChips(['WOT', 'WOTB'], 'WOT')).toEqual(['WOT', 'WOTB']);
  });

  test('an applied token joins the fixed order rather than the end', () => {
    expect(filterChips(['WOWS'], 'WOT')).toEqual(['WOT', 'WOWS']);
  });

  test('an applied token OUTSIDE the fixed list is not honoured, and hides nothing', () => {
    // Vehicles has no chip for Warplanes and the worker stores no scope for it,
    // so a filter set to it must not conjure a row on a single-game export.
    expect(filterChips(['WOT'], 'WOWP')).toBeNull();
  });

  test('the fixed order holds whatever order the export arrived in', () => {
    expect(filterChips(['WOT', 'WOTB', 'WOWS'], null)).toEqual(['WOT', 'WOTB', 'WOWS']);
    expect(filterChips(['WOWS', 'WOTB', 'WOT'], null)).toEqual(['WOT', 'WOTB', 'WOWS']);
    expect(GAME_FILTER_TOKENS).toEqual(['WOT', 'WOTB', 'WOWS']);
  });
});

// -----------------------------------------------------------------------------
// resolveGameFilter — the stamp reset
// -----------------------------------------------------------------------------

describe('resolveGameFilter', () => {
  const stamp = '2026-10-18T10:00:00.000Z';

  test('a choice made under this dataset stands', () => {
    expect(resolveGameFilter(choice('WOT', stamp), stamp)).toBe('WOT');
  });

  test('All games is null, both when it was chosen and by default', () => {
    expect(resolveGameFilter(choice(null, stamp), stamp)).toBeNull();
    expect(resolveGameFilter({ token: null, stamp: null }, stamp)).toBeNull();
  });

  test('a NEW dataset discards the previous filter', () => {
    // The rule that makes a replace return to All games with no reset effect:
    // the stamp changed, so the choice is not this dataset's.
    expect(resolveGameFilter(choice('WOT', stamp), '2026-10-18T11:00:00.000Z')).toBeNull();
  });

  test('no dataset on screen answers All', () => {
    expect(resolveGameFilter(choice('WOT', stamp), null)).toBeNull();
  });

  test('a token outside the fixed list degrades to All rather than becoming a filter', () => {
    expect(resolveGameFilter(choice('WOWP', stamp), stamp)).toBeNull();
    expect(resolveGameFilter(choice('<b>WOT</b>', stamp), stamp)).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// filterToTitle / filterAfterTitleChange
// -----------------------------------------------------------------------------

describe('the token and the Vehicles title', () => {
  test('each filterable token means its title, and All means none', () => {
    expect(filterToTitle('WOT')).toBe('wot');
    expect(filterToTitle('WOTB')).toBe('wotb');
    expect(filterToTitle('WOWS')).toBe('wows');
    expect(filterToTitle(null)).toBeNull();
  });

  test('a title the filter does not offer means no title', () => {
    expect(filterToTitle('WOWP')).toBeNull();
    expect(filterToTitle('HEAT')).toBeNull();
    expect(filterToTitle('')).toBeNull();
  });

  test('choosing WoT, WoT Blitz or Warships on Vehicles sets the filter', () => {
    expect(filterAfterTitleChange('wot', null)).toBe('WOT');
    expect(filterAfterTitleChange('wotb', null)).toBe('WOTB');
    expect(filterAfterTitleChange('wows', null)).toBe('WOWS');
    // And it REPLACES whatever was there before.
    expect(filterAfterTitleChange('wows', 'WOT')).toBe('WOWS');
  });

  test('choosing Warplanes leaves the filter EXACTLY as it was', () => {
    // D-21: Warplanes is Vehicles-local. It is neither written nor cleared, so
    // Playtime is left as the reader left it.
    expect(filterAfterTitleChange('wowp', 'WOT')).toBe('WOT');
    expect(filterAfterTitleChange('wowp', null)).toBeNull();
  });

  test('an unknown title value leaves the filter unchanged rather than guessing', () => {
    expect(filterAfterTitleChange('', 'WOTB')).toBe('WOTB');
    expect(filterAfterTitleChange('wtb', null)).toBeNull();
  });
});
