import { describe, expect, it } from 'vitest';

import {
  OVERVIEW_CATALOGUE_ORDER,
  OVERVIEW_DEFINITION_LISTS,
  OVERVIEW_GROUP_ORDER,
  OVERVIEW_TILE_DEFS,
  isTileId,
  tileDef,
  tileDefsOf,
} from '../../../src/lib/features/overview/overview-definitions.ts';
import type { OverviewDefinitionList } from '../../../src/lib/features/overview/overview-definitions.ts';
import {
  OVERVIEW_TILE_IDS,
  OVERVIEW_TILE_NEEDS,
  type OverviewTileId,
} from '../../../src/lib/features/overview/overview-shared.ts';
import { PANE_IDS } from '../../../src/lib/shell/selection-state.ts';
import { OVERVIEW_GROUP_HEADINGS } from '../../../src/lib/ui-copy.ts';

// =============================================================================
// The Overview's TILE CATALOGUE (13-06 Task 1, D-06, D-12, D-15)
// =============================================================================
//
// The catalogue is DATA the whole page reads: the grid, the bento, the pins
// store, the e2e specs and the absent rows all ask it which tiles exist.
//
// These tests pin it in four directions:
//
//   1. THE ORDER. There is ONE tile order in the codebase, and it is the
//      wire contract's `OVERVIEW_TILE_IDS`. The catalogue must reproduce it
//      exactly, once each, whatever order the per-game lists are written in.
//   2. THE TABLE. Every tile's size, group and pane, asserted as literals
//      against the UI-SPEC Tile Catalogue, so a change is a deliberate edit
//      to this test and not a silent drift.
//   3. THE NEED. Each definition's `need` must equal the contract's
//      `OVERVIEW_TILE_NEEDS`, or the worker and the page disagree about what
//      a tile reads.
//   4. THE GUARDS. `tileDefsOf` refuses a duplicate id and an id outside the
//      catalogue, which is what makes "another game adds its own list" safe.
// =============================================================================

/** The UI-SPEC Tile Catalogue as literals: id, group, size and pane. */
const UI_SPEC_TABLE: readonly (readonly [OverviewTileId, string, string, string])[] = [
  ['logged', 'time', 'hero', 'playtime'],
  ['hour', 'time', 'feat', 'playtime'],
  ['streak', 'time', 'met', 'playtime'],
  ['sess', 'time', 'met', 'playtime'],
  ['busy', 'time', 'met', 'playtime'],
  ['tank', 'tanks', 'hero', 'vehicles'],
  ['cls', 'tanks', 'feat', 'vehicles'],
  ['fleet', 'tanks', 'met', 'vehicles'],
  ['nat', 'tanks', 'met', 'vehicles'],
  ['dmg', 'records', 'met', 'vehicles'],
  ['xp', 'records', 'met', 'vehicles'],
  ['kills', 'records', 'met', 'vehicles'],
  ['snip', 'records', 'met', 'vehicles'],
  ['cred', 'totals', 'feat', 'finance'],
  ['bat', 'totals', 'met', 'vehicles'],
  ['ord', 'totals', 'met', 'payments'],
];

describe('the Overview tile catalogue', () => {
  it('holds the sixteen ids in catalogue order, once each', () => {
    expect(OVERVIEW_TILE_DEFS.map((def) => def.id)).toEqual([...OVERVIEW_TILE_IDS]);
    expect(OVERVIEW_TILE_DEFS).toHaveLength(16);
    expect(new Set(OVERVIEW_TILE_DEFS.map((def) => def.id)).size).toBe(16);
  });

  it('exposes the same order as the catalogue order constant', () => {
    expect(OVERVIEW_CATALOGUE_ORDER).toEqual([...OVERVIEW_TILE_IDS]);
  });

  it('matches the UI-SPEC catalogue table exactly', () => {
    const actual = OVERVIEW_TILE_DEFS.map((def) => [def.id, def.group, def.size, def.pane]);
    expect(actual).toEqual(UI_SPEC_TABLE.map((row) => [...row]));
  });

  it('gives every tile the need the wire contract declares', () => {
    for (const def of OVERVIEW_TILE_DEFS) {
      expect(def.need, `${def.id} must read the source the contract names`).toBe(
        OVERVIEW_TILE_NEEDS[def.id],
      );
    }
  });

  it('opens only panes that exist', () => {
    for (const def of OVERVIEW_TILE_DEFS) {
      expect(PANE_IDS as readonly string[], `${def.id} opens a real pane`).toContain(def.pane);
    }
  });

  it('holds two heroes, three features and eleven metrics', () => {
    const counts = { hero: 0, feat: 0, met: 0 };
    for (const def of OVERVIEW_TILE_DEFS) counts[def.size] += 1;
    expect(counts).toEqual({ hero: 2, feat: 3, met: 11 });
    // The cells the bento has to place: 2x4 + 3x2 + 11x1.
    expect(counts.hero * 4 + counts.feat * 2 + counts.met).toBe(25);
  });

  it('reads the per-game lists: a shared list and a WoT list', () => {
    expect(OVERVIEW_DEFINITION_LISTS.map((list) => list.list)).toEqual(['shared', 'WOT']);
    const shared = OVERVIEW_DEFINITION_LISTS[0];
    expect(shared?.defs.map((def) => def.id)).toEqual(['logged']);
    const wot = OVERVIEW_DEFINITION_LISTS[1];
    expect(wot?.defs).toHaveLength(15);
    expect(wot?.defs.map((def) => def.id)).not.toContain('logged');
  });

  it('finds the one definition of a tile and refuses an unknown one', () => {
    expect(tileDef('logged').size).toBe('hero');
    expect(tileDef('ord').pane).toBe('payments');
    expect(() => tileDef('nope' as OverviewTileId)).toThrow(/unknown tile id/);
  });

  it('recognises a catalogue id and nothing else', () => {
    expect(isTileId('logged')).toBe(true);
    expect(isTileId('__proto__')).toBe(false);
    expect(isTileId('constructor')).toBe(false);
    expect(isTileId(7)).toBe(false);
  });
});

describe('tileDefsOf', () => {
  it('refuses a tile two lists both claim', () => {
    const clashing = {
      list: 'WWS',
      defs: [
        { id: 'logged', group: 'time', size: 'hero', pane: 'playtime', need: 'session-history' },
      ],
    } as const;
    expect(() => tileDefsOf([...OVERVIEW_DEFINITION_LISTS, clashing])).toThrow(
      /duplicate tile id: logged/,
    );
  });

  it('refuses an id outside the catalogue', () => {
    // The fake id is cast locally on purpose: the closed type is what makes
    // the guard unreachable in production, and the guard is what has to be
    // proved here.
    const future: OverviewDefinitionList = {
      list: 'WWS',
      defs: [
        {
          id: 'wowsLogged' as OverviewTileId,
          group: 'time',
          size: 'hero',
          pane: 'playtime',
          need: 'session-history',
        },
      ],
    };
    expect(() => tileDefsOf([...OVERVIEW_DEFINITION_LISTS, future])).toThrow(
      /unknown tile id in list "WWS": wowsLogged/,
    );
  });

  it('accepts a second-game list that claims no existing id', () => {
    // Adding a game must not collide with World of Tanks' tiles: the only
    // reason today's second-game list fails is that its ids are not in the
    // catalogue yet, and the failure says so. A duplicate would be a
    // different failure, and this is the assertion that it is NOT one.
    const future: OverviewDefinitionList = {
      list: 'WWS',
      defs: [
        {
          id: 'wowsLogged' as OverviewTileId,
          group: 'time',
          size: 'hero',
          pane: 'playtime',
          need: 'session-history',
        },
      ],
    };
    const attempt = () => tileDefsOf([...OVERVIEW_DEFINITION_LISTS, future]);
    expect(attempt).toThrow(/unknown tile id/);
    expect(attempt).not.toThrow(/duplicate tile id/);
  });

  it('orders the result by the catalogue, whatever order the lists are in', () => {
    const reversed = [...OVERVIEW_DEFINITION_LISTS].reverse();
    expect(tileDefsOf(reversed).map((def) => def.id)).toEqual([...OVERVIEW_TILE_IDS]);
  });
});

describe('the group order', () => {
  it('is Pinned, Time, Tanks, Records, Totals', () => {
    expect([...OVERVIEW_GROUP_ORDER]).toEqual(['pinned', 'time', 'tanks', 'records', 'totals']);
  });

  it('names the fifth group Totals', () => {
    expect(OVERVIEW_GROUP_HEADINGS.totals).toBe('Totals');
    expect(OVERVIEW_GROUP_HEADINGS.pinned).toBe('Pinned');
    expect(OVERVIEW_GROUP_HEADINGS.time).toBe('Time');
    expect(OVERVIEW_GROUP_HEADINGS.tanks).toBe('Tanks');
    expect(OVERVIEW_GROUP_HEADINGS.records).toBe('Records');
  });

  it('never makes Pinned a definition group', () => {
    for (const def of OVERVIEW_TILE_DEFS) {
      expect(def.group).not.toBe('pinned');
    }
  });
});
