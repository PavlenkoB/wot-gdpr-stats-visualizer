import { describe, expect, test } from 'vitest';
import {
  GAME_FILTER_TOKENS,
  filterAfterTitleChange,
  filterChips,
  filterToTitle,
  hasNoVehicleTable,
  resolveGameFilter,
  resolveVehicleTitle,
  vehicleTitleForAsk,
  type GameFilterChoice,
  type VehicleTitleChoice,
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
//   5. 11-01: HEAT and WoT Console are tokens now, so the matrix above has two
//      new members and the HEAT title/stamp cases join the WOT ones.
//
// Pure and DOM-free, so it runs under Node. The style is copied from
// `tests/unit/shell/selection-state.test.ts`; test files do not import each
// other in this repository, so the shape is repeated rather than shared.
// =============================================================================

/** A choice stamped for `stamp`, as `Dashboard.svelte` writes it. */
function choice(token: string | null, stamp: string | null = '2026-10-18T10:00:00.000Z') {
  return { token, stamp } satisfies GameFilterChoice;
}

/** The one dataset the 11-06 cases below talk about. */
const DATASET = '2026-10-18T10:00:00.000Z';
/** A second one, so a stamp mismatch is a real case rather than a null literal. */
const OTHER_DATASET = '2026-10-18T11:00:00.000Z';

/** A remembered-title cell stamped for `stamp`, as `Dashboard.svelte` writes it. */
function titleChoice(title: string | null, stamp: string | null) {
  return { title, stamp } satisfies VehicleTitleChoice;
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

  test('one filterable token plus HEAT renders BOTH, in the FIXED order', () => {
    // HEAT is a token as of 11-01: the worker already stores a per-game scope
    // for it, so a reader can narrow to it and the row offers the way back.
    expect(filterChips(['WOT', 'HEAT'], null)).toEqual(['WOT', 'HEAT']);
  });

  test('HEAT and WoT Console are filterable, and only together render no node', () => {
    // Each ALONE still renders no node: All games is that export's only view.
    expect(filterChips(['HEAT'], null)).toBeNull();
    expect(filterChips(['WOTC'], null)).toBeNull();
    // Together they are two distinct games, so both chips are offered.
    expect(filterChips(['HEAT', 'WOTC'], null)).toEqual(['WOTC', 'HEAT']);
    expect(filterChips(['WOTC', 'HEAT'], null)).toEqual(['WOTC', 'HEAT']);
  });

  test('a hostile token never becomes a chip, whatever else is in the list', () => {
    const chips = filterChips(['WOT', '<b>WOTB</b>', '__proto__', 'WOWP'], null);
    expect(chips).toEqual(['WOT']);
    // And the same when the hostile token is the only other entry: the row is
    // still warranted (two game tokens) and still offers only the real one.
    expect(filterChips(['WOTB', 'constructor'], null)).toEqual(['WOTB']);
  });

  test('every token the export holds gets a chip, in the fixed order (11-01)', () => {
    // The whole matrix, in one place, because the two new tokens are the first
    // time the tuple has grown and the ORDER is part of the contract.
    expect(filterChips(['HEAT'], null)).toBeNull();
    expect(filterChips(['WOTC'], null)).toBeNull();
    expect(filterChips(['WOT', 'HEAT'], null)).toEqual(['WOT', 'HEAT']);
    expect(filterChips(['HEAT', 'WOTC'], null)).toEqual(['WOTC', 'HEAT']);
    expect(filterChips(['HEAT', 'WOTC', 'WOT', 'WOTB', 'WOWS', 'WOWP'], null)).toEqual([
      'WOT',
      'WOTB',
      'WOWS',
      'WOTC',
      'HEAT',
    ]);
    // WOWP is still not a filter token, so it never earns a chip of its own.
    expect(filterChips(['WOT', 'WOWP'], null)).toEqual(['WOT']);
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
    expect(GAME_FILTER_TOKENS).toEqual(['WOT', 'WOTB', 'WOWS', 'WOTC', 'HEAT']);
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

  test('a HEAT or WOTC choice is stamped exactly like any other token', () => {
    expect(resolveGameFilter(choice('HEAT', stamp), stamp)).toBe('HEAT');
    expect(resolveGameFilter(choice('WOTC', stamp), stamp)).toBe('WOTC');
    // And it is discarded by a new dataset, which is the whole reset rule.
    expect(resolveGameFilter(choice('HEAT', stamp), '2026-10-18T11:00:00.000Z')).toBeNull();
  });

  test('choosing WoT or Warplanes on Vehicles replaces a HEAT filter (D-21)', () => {
    expect(filterAfterTitleChange('wot', 'HEAT')).toBe('WOT');
    expect(filterAfterTitleChange('wows', 'WOTC')).toBe('WOWS');
    // And Warplanes leaves a HEAT filter alone, because it is not the filter.
    expect(filterAfterTitleChange('wowp', 'HEAT')).toBe('HEAT');
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
    // HEAT and WOTC have chips but no Vehicles title: neither game contributes
    // a vehicle table, so asking for one would name a game with no vehicles
    // (D-21, and the reason `filterToTitle` still answers null for them).
    expect(filterToTitle('WOWP')).toBeNull();
    expect(filterToTitle('HEAT')).toBeNull();
    expect(filterToTitle('WOTC')).toBeNull();
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

// -----------------------------------------------------------------------------
// hasNoVehicleTable / vehicleTitleForAsk / resolveVehicleTitle (11-06, D-06)
// -----------------------------------------------------------------------------
//
// D-06: HEAT and WoT Console have SESSIONS but no vehicle table. Vehicles does
// not clear the shared filter for them (that is the reader's choice, and D-21
// gives Playtime a claim on it); it keeps showing the table it last showed in
// this dataset and says so in one line. These three helpers are the whole of
// that, and they are pure because every failure reachable here is a claim
// about the reader's own export rather than a visual one.

describe('hasNoVehicleTable: which games the note is for', () => {
  test('exactly HEAT and WoT Console', () => {
    expect(hasNoVehicleTable('HEAT')).toBe(true);
    expect(hasNoVehicleTable('WOTC')).toBe(true);
  });

  test('not a game that DOES contribute vehicles, and not All', () => {
    expect(hasNoVehicleTable('WOT')).toBe(false);
    expect(hasNoVehicleTable('WOTB')).toBe(false);
    expect(hasNoVehicleTable('WOWS')).toBe(false);
    expect(hasNoVehicleTable(null)).toBe(false);
  });

  test('not Warplanes and not a hostile token from a file name', () => {
    // Warplanes is a Vehicles TITLE rather than a shared filter token, and a
    // token from an untrusted archive must never produce the note.
    expect(hasNoVehicleTable('WOWP')).toBe(false);
    expect(hasNoVehicleTable('<b>HEAT</b>')).toBe(false);
    expect(hasNoVehicleTable('')).toBe(false);
  });
});

describe('vehicleTitleForAsk: the title Vehicles asks for on its first query', () => {
  test('a filterable game asks for its own title, whatever was remembered', () => {
    // Phase 10's first-ask rule, byte for byte: the remembered title is
    // consulted ONLY for the two games with no table of their own.
    expect(vehicleTitleForAsk('WOT', 'wowp')).toBe('wot');
    expect(vehicleTitleForAsk('WOTB', null)).toBe('wotb');
    expect(vehicleTitleForAsk('WOTB', 'wows')).toBe('wotb');
    expect(vehicleTitleForAsk('WOWS', 'wot')).toBe('wows');
  });

  test('All asks the worker own rule and never the remembered title', () => {
    // D-21 stands: with All, `null` is the worker's first-title-with-rows
    // question, exactly as it was before the new games existed.
    expect(vehicleTitleForAsk(null, 'wowp')).toBeNull();
    expect(vehicleTitleForAsk(null, null)).toBeNull();
  });

  test('HEAT and WoT Console keep the title the reader last saw in this dataset', () => {
    expect(vehicleTitleForAsk('HEAT', 'wows')).toBe('wows');
    expect(vehicleTitleForAsk('WOTC', 'wowp')).toBe('wowp');
    // And with nothing remembered there is nothing to keep, so it falls back to
    // the same `null` All asks — the worker picks, and the note names whatever
    // it applied.
    expect(vehicleTitleForAsk('HEAT', null)).toBeNull();
    expect(vehicleTitleForAsk('WOTC', null)).toBeNull();
  });

  test('an unknown remembered title is never asked for', () => {
    // T-11-20: the cell is component state, but a value that is not one of the
    // four known ids must not travel into a worker query.
    expect(vehicleTitleForAsk('HEAT', 'junk')).toBeNull();
    expect(vehicleTitleForAsk('HEAT', 'WOT')).toBeNull();
    expect(vehicleTitleForAsk('HEAT', '')).toBeNull();
  });
});

describe('resolveVehicleTitle: the remembered title, stamped (11-06)', () => {
  test('the title the reader applied under this dataset is remembered', () => {
    expect(resolveVehicleTitle(titleChoice('wowp', DATASET), DATASET)).toBe('wowp');
  });

  test('a replace or a Clear discards it', () => {
    // The same rule `resolveGameFilter` and `resolveReveal` use: the stamp IS
    // the reset, so there is no hook that can be forgotten on one path.
    expect(resolveVehicleTitle(titleChoice('wowp', DATASET), OTHER_DATASET)).toBeNull();
    expect(resolveVehicleTitle(titleChoice('wowp', DATASET), null)).toBeNull();
  });

  test('the initial cell remembers nothing, and an unstamped one cannot either', () => {
    expect(resolveVehicleTitle({ title: null, stamp: null }, DATASET)).toBeNull();
    expect(resolveVehicleTitle({ title: 'wowp', stamp: null }, DATASET)).toBeNull();
  });

  test('an unknown title under a matching stamp still answers null', () => {
    expect(resolveVehicleTitle(titleChoice('junk', DATASET), DATASET)).toBeNull();
  });
});
