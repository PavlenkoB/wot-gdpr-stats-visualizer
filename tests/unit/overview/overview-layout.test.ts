import { describe, expect, it } from 'vitest';

import {
  domOrder,
  isEmptyScreen,
  layoutGroups,
  skeletonGroups,
  type LayoutGroup,
} from '../../../src/lib/features/overview/overview-layout.ts';
import {
  OVERVIEW_TILE_DEFS,
  type OverviewTileDef,
} from '../../../src/lib/features/overview/overview-definitions.ts';
import { fillSpans } from '../../../src/lib/features/overview/overview-grid.ts';
import { DEFAULT_PINS } from '../../../src/lib/features/overview/overview-pins.ts';
import {
  OVERVIEW_TILE_IDS,
  OVERVIEW_TILE_NEEDS,
  type OverviewReadyTile,
  type OverviewTile,
  type OverviewTileId,
  type OverviewView,
} from '../../../src/lib/features/overview/overview-shared.ts';

// =============================================================================
// The LAYOUT (13-10 Task 2, D-11, D-15)
// =============================================================================
//
// One pure function decides every group, every tile position, every absent
// entry, every span and the empty screen from the view and the pins.
// =============================================================================

/** A ready tile of any id, with minimal valid fields. */
function ready(id: OverviewTileId): OverviewReadyTile {
  switch (id) {
    case 'logged':
      return {
        id,
        status: 'ok',
        seconds: 3600,
        firstDay: 1,
        lastDay: 2,
        battleSeconds: null,
        years: [],
      };
    case 'hour':
      return { id, status: 'ok', hours: new Array<number>(24).fill(0), peakHour: 0 };
    case 'streak':
      return { id, status: 'ok', days: 1, startDay: 1, endDay: 1 };
    case 'sess':
    case 'busy':
      return { id, status: 'ok', seconds: 60, day: 1 };
    case 'tank':
      return {
        id,
        status: 'ok',
        name: 'T',
        battles: 1,
        share: 1,
        classKey: 'heavyTank',
        tier: 8,
        top: [],
      };
    case 'cls':
      return { id, status: 'ok', classKey: 'heavyTank', share: 1, coverage: 1, rows: [] };
    case 'fleet':
      return { id, status: 'ok', count: 1 };
    case 'nat':
      return { id, status: 'ok', nation: 'germany', share: 1 };
    case 'dmg':
    case 'xp':
    case 'kills':
      return { id, status: 'ok', value: 1, tankName: null, accounts: 1 };
    case 'snip':
      return { id, status: 'ok', value: 1 };
    case 'cred':
      return { id, status: 'ok', units: '1000000' };
    case 'bat':
      return { id, status: 'ok', battles: 1, wins: null, winRate: null };
    case 'ord':
      return { id, status: 'ok', count: 1 };
  }
}

function absent(id: OverviewTileId, column: string | null = null): OverviewTile {
  return { id, status: 'absent', need: OVERVIEW_TILE_NEEDS[id], column };
}

/** A view with every tile ready except the listed ones, which are absent. */
function view(absentIds: readonly OverviewTileId[] = []): OverviewView {
  return {
    tiles: OVERVIEW_TILE_IDS.map((id) => (absentIds.includes(id) ? absent(id) : ready(id))),
    life: [],
    firstDay: 1,
    lastDay: 2,
    accountCount: 1,
  };
}

const ids = (group: LayoutGroup): OverviewTileId[] => group.tiles.map((entry) => entry.tile.id);
const absentIds = (group: LayoutGroup): OverviewTileId[] => group.absent.map((entry) => entry.id);
const byId = (groups: LayoutGroup[], id: LayoutGroup['id']): LayoutGroup | undefined =>
  groups.find((group) => group.id === id);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

describe('layoutGroups: the default pins on a full view', () => {
  const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, DEFAULT_PINS);

  it('orders the groups pinned, time, tanks, records, totals', () => {
    expect(groups.map((group) => group.id)).toEqual([
      'pinned',
      'time',
      'tanks',
      'records',
      'totals',
    ]);
  });

  it('puts the pinned tiles in Pinned, in catalogue order, with no spans', () => {
    const pinned = groups[0];
    expect(ids(pinned)).toEqual(['logged', 'tank']);
    expect(pinned.spans).toEqual([
      { c4: 0, r4: 0, c2: 0 },
      { c4: 0, r4: 0, c2: 0 },
    ]);
    expect(pinned.absent).toEqual([]);
    expect(pinned.legend).toBe(false);
  });

  it('keeps the other tiles in their own groups (the worked example)', () => {
    const time = byId(groups, 'time')!;
    expect(ids(time)).toEqual(['hour', 'streak', 'sess', 'busy']);
    // The feature widens by two columns at four columns; nothing else moves.
    expect(time.spans.map((span) => span.c4)).toEqual([2, 0, 0, 0]);
    expect(time.spans.map((span) => span.r4)).toEqual([0, 0, 0, 0]);

    expect(ids(byId(groups, 'tanks')!)).toEqual(['cls', 'fleet', 'nat']);
    expect(ids(byId(groups, 'records')!)).toEqual(['dmg', 'xp', 'kills', 'snip']);
    expect(ids(byId(groups, 'totals')!)).toEqual(['cred', 'bat', 'ord']);
  });

  it('gives every group one span per tile', () => {
    for (const group of groups) expect(group.spans).toHaveLength(group.tiles.length);
  });

  it('domOrder is the concatenation of the groups, Pinned first', () => {
    expect(domOrder(groups)).toEqual([
      'logged',
      'tank',
      'hour',
      'streak',
      'sess',
      'busy',
      'cls',
      'fleet',
      'nat',
      'dmg',
      'xp',
      'kills',
      'snip',
      'cred',
      'bat',
      'ord',
    ]);
  });

  it('carries each tile with its own definition', () => {
    for (const group of groups) {
      for (const entry of group.tiles) {
        expect(entry.def.id).toBe(entry.tile.id);
        expect(entry.def).toBe(OVERVIEW_TILE_DEFS.find((def) => def.id === entry.tile.id));
      }
    }
  });

  it("computes every group's spans by the fill rule over its tiles' sizes", () => {
    for (const group of groups) {
      const filled = fillSpans(
        group.tiles.map((entry) => entry.def.size),
        group.id === 'pinned' ? 'sparse' : 'dense',
      );
      expect(group.spans.map((span) => span.c4)).toEqual(filled.c4);
      expect(group.spans.map((span) => span.r4)).toEqual(filled.r4);
      expect(group.spans.map((span) => span.c2)).toEqual(filled.c2);
    }
    // A feature and two metrics already fill four columns: nothing widens.
    expect(byId(groups, 'tanks')!.spans.map((span) => span.c4)).toEqual([0, 0, 0]);
  });
});

describe('layoutGroups: pin counts', () => {
  it('zero pins omit Pinned and keep every tile in its group', () => {
    const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, []);
    expect(groups.map((group) => group.id)).toEqual(['time', 'tanks', 'records', 'totals']);
    expect(ids(byId(groups, 'time')!)).toEqual(['logged', 'hour', 'streak', 'sess', 'busy']);
    expect(ids(byId(groups, 'tanks')!)).toEqual(['tank', 'cls', 'fleet', 'nat']);
  });

  it('one pinned tile gives a one-tile Pinned group', () => {
    const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, ['cred']);
    expect(ids(groups[0])).toEqual(['cred']);
    expect(groups[0].id).toBe('pinned');
    expect(ids(byId(groups, 'totals')!)).toEqual(['bat', 'ord']);
  });

  it('all sixteen pinned gives a Pinned group in catalogue order and no other group', () => {
    const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, OVERVIEW_TILE_IDS);
    expect(groups.map((group) => group.id)).toEqual(['pinned']);
    expect(ids(groups[0])).toEqual([...OVERVIEW_TILE_IDS]);
  });

  it('all pinned leaves each group with only its absent entries when tiles are absent', () => {
    const groups = layoutGroups(view(['cls', 'bat']), OVERVIEW_TILE_DEFS, OVERVIEW_TILE_IDS);
    expect(groups.map((group) => group.id)).toEqual(['pinned', 'tanks', 'totals']);
    expect(ids(groups[0])).toHaveLength(14);
    expect(ids(byId(groups, 'tanks')!)).toEqual([]);
    expect(absentIds(byId(groups, 'tanks')!)).toEqual(['cls']);
    expect(absentIds(byId(groups, 'totals')!)).toEqual(['bat']);
  });

  it('is deterministic for a shuffled pins array', () => {
    const shuffled: OverviewTileId[] = ['ord', 'logged', 'snip', 'tank', 'hour'];
    const reversed = [...shuffled].reverse();
    const a = layoutGroups(view(), OVERVIEW_TILE_DEFS, shuffled);
    const b = layoutGroups(view(), OVERVIEW_TILE_DEFS, reversed);
    expect(a).toEqual(b);
    expect(ids(a[0])).toEqual(['logged', 'hour', 'tank', 'snip', 'ord']);
  });

  it('an unknown pin id selects nothing', () => {
    const hostile = ['__proto__', 'constructor', 'nope'] as unknown as OverviewTileId[];
    const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, hostile);
    expect(groups.map((group) => group.id)).toEqual(['time', 'tanks', 'records', 'totals']);
  });
});

describe('layoutGroups: absent tiles', () => {
  it('a pinned tile with no data is not in Pinned and appears once in its own group absent row', () => {
    const groups = layoutGroups(view(['cls']), OVERVIEW_TILE_DEFS, ['tank', 'cls']);
    expect(ids(groups[0])).toEqual(['tank']);
    const tanks = byId(groups, 'tanks')!;
    expect(absentIds(tanks)).toEqual(['cls']);
    const everywhere = groups.flatMap((group) => [...ids(group), ...absentIds(group)]);
    expect(everywhere.filter((id) => id === 'cls')).toHaveLength(1);
  });

  it('Logged in absent and pinned stays out of Pinned and lands in the Time absent row (OI-3)', () => {
    const groups = layoutGroups(view(['logged']), OVERVIEW_TILE_DEFS, ['logged', 'tank']);
    expect(ids(groups[0])).toEqual(['tank']);
    expect(absentIds(byId(groups, 'time')!)).toEqual(['logged']);
    expect(ids(byId(groups, 'time')!)).toEqual(['hour', 'streak', 'sess', 'busy']);
  });

  it('Pinned is omitted when the only pinned tile is absent', () => {
    const groups = layoutGroups(view(['logged']), OVERVIEW_TILE_DEFS, ['logged']);
    expect(groups.find((group) => group.id === 'pinned')).toBeUndefined();
  });

  it('keeps one absent entry per absent tile in catalogue order, with need and column', () => {
    const tiles = view().tiles.map((tile) =>
      tile.id === 'streak' || tile.id === 'busy'
        ? absent(tile.id, tile.id === 'busy' ? 'battle_time' : null)
        : tile,
    );
    const groups = layoutGroups({ ...view(), tiles }, OVERVIEW_TILE_DEFS, []);
    const time = byId(groups, 'time')!;
    expect(time.absent).toEqual([
      { id: 'streak', need: 'session-history', column: null },
      { id: 'busy', need: 'session-history', column: 'battle_time' },
    ]);
  });

  it('a group whose only tiles are absent still appears, with no tiles and an absent list', () => {
    const groups = layoutGroups(
      view(['logged', 'hour', 'streak', 'sess', 'busy']),
      OVERVIEW_TILE_DEFS,
      [],
    );
    const time = byId(groups, 'time')!;
    expect(time.tiles).toEqual([]);
    expect(time.spans).toEqual([]);
    expect(absentIds(time)).toEqual(['logged', 'hour', 'streak', 'sess', 'busy']);
    expect(time.legend).toBe(false);
  });

  it('every tile absent gives groups of absent entries only and no Pinned', () => {
    const all = view([...OVERVIEW_TILE_IDS]);
    expect(isEmptyScreen(all)).toBe(true);
    const groups = layoutGroups(all, OVERVIEW_TILE_DEFS, DEFAULT_PINS);
    expect(groups.map((group) => group.id)).toEqual(['time', 'tanks', 'records', 'totals']);
    for (const group of groups) {
      expect(group.tiles).toEqual([]);
      expect(group.absent.length).toBeGreaterThan(0);
    }
    expect(groups.reduce((sum, group) => sum + group.absent.length, 0)).toBe(16);
    expect(domOrder(groups)).toEqual([]);
  });

  it('treats a tile missing from a malformed view as absent with the catalogue need', () => {
    const malformed: OverviewView = {
      ...view(),
      tiles: view().tiles.filter((tile) => tile.id !== 'ord'),
    };
    const groups = layoutGroups(malformed, OVERVIEW_TILE_DEFS, []);
    expect(byId(groups, 'totals')!.absent).toEqual([
      { id: 'ord', need: 'payment-history', column: null },
    ]);
    expect(isEmptyScreen(malformed)).toBe(false);
  });
});

describe('isEmptyScreen', () => {
  it('is false when any tile is ready', () => {
    expect(isEmptyScreen(view())).toBe(false);
    expect(isEmptyScreen(view(OVERVIEW_TILE_IDS.filter((id) => id !== 'ord')))).toBe(false);
  });

  it('is true when every tile is absent', () => {
    expect(isEmptyScreen(view([...OVERVIEW_TILE_IDS]))).toBe(true);
  });
});

describe('layoutGroups: the legend flag', () => {
  it('is true for Time and Tanks when a chart-bearing tile is present', () => {
    const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, []);
    expect(byId(groups, 'time')!.legend).toBe(true);
    expect(byId(groups, 'tanks')!.legend).toBe(true);
    expect(byId(groups, 'records')!.legend).toBe(false);
    expect(byId(groups, 'totals')!.legend).toBe(false);
  });

  it('is true for Time on the signature hour alone, and for Tanks on either chart', () => {
    const noLogged = layoutGroups(view(), OVERVIEW_TILE_DEFS, ['logged']);
    expect(byId(noLogged, 'time')!.legend).toBe(true);
    const clsOnly = layoutGroups(view(['tank']), OVERVIEW_TILE_DEFS, []);
    expect(byId(clsOnly, 'tanks')!.legend).toBe(true);
  });

  it('is false when Time holds only streak, sess and busy', () => {
    const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, ['logged', 'hour']);
    const time = byId(groups, 'time')!;
    expect(ids(time)).toEqual(['streak', 'sess', 'busy']);
    expect(time.legend).toBe(false);
  });

  it('is false when the chart tiles are absent', () => {
    const groups = layoutGroups(view(['tank', 'cls']), OVERVIEW_TILE_DEFS, []);
    expect(byId(groups, 'tanks')!.legend).toBe(false);
  });

  it('is false for Pinned even when it holds Logged in', () => {
    const groups = layoutGroups(view(), OVERVIEW_TILE_DEFS, ['logged', 'hour', 'tank', 'cls']);
    expect(groups[0].id).toBe('pinned');
    expect(groups[0].legend).toBe(false);
  });
});

describe('layoutGroups: purity', () => {
  it('does not mutate its inputs', () => {
    const frozenView = deepFreeze(view(['cls']));
    const frozenDefs: readonly OverviewTileDef[] = deepFreeze(
      OVERVIEW_TILE_DEFS.map((def) => ({ ...def })),
    );
    const frozenPins = deepFreeze([...DEFAULT_PINS]);
    const groups = layoutGroups(frozenView, frozenDefs, frozenPins);
    expect(groups.length).toBeGreaterThan(0);
    expect(isEmptyScreen(frozenView)).toBe(false);
  });

  it('returns fresh arrays on every call', () => {
    const a = layoutGroups(view(), OVERVIEW_TILE_DEFS, DEFAULT_PINS);
    const b = layoutGroups(view(), OVERVIEW_TILE_DEFS, DEFAULT_PINS);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a[0].tiles).not.toBe(b[0].tiles);
    expect(a[0].spans).not.toBe(b[0].spans);
  });
});

describe('skeletonGroups: the frame has the shape of the loaded page', () => {
  it('equals the all-ready layout, group by group, for the default pins', () => {
    const frame = skeletonGroups(OVERVIEW_TILE_DEFS, DEFAULT_PINS);
    const loaded = layoutGroups(view(), OVERVIEW_TILE_DEFS, DEFAULT_PINS);
    expect(frame.map((group) => group.id)).toEqual(loaded.map((group) => group.id));
    for (const group of loaded) {
      const mine = frame.find((entry) => entry.id === group.id);
      expect(mine?.sizes, group.id).toEqual(group.tiles.map((entry) => entry.def.size));
      expect(mine?.spans, group.id).toEqual(group.spans);
    }
  });

  it('matches the all-ready layout for other pin sets too', () => {
    for (const pins of [
      [],
      ['hour'],
      ['logged', 'hour', 'tank', 'cls'],
      [...OVERVIEW_TILE_IDS],
    ] as OverviewTileId[][]) {
      const frame = skeletonGroups(OVERVIEW_TILE_DEFS, pins);
      const loaded = layoutGroups(view(), OVERVIEW_TILE_DEFS, pins);
      expect(
        frame.map((group) => [group.id, group.sizes, group.spans]),
        pins.join(','),
      ).toEqual(loaded.map((group) => [group.id, group.tiles.map((e) => e.def.size), group.spans]));
    }
  });

  it('zero pins omits Pinned', () => {
    const frame = skeletonGroups(OVERVIEW_TILE_DEFS, []);
    expect(frame.map((group) => group.id)).toEqual(['time', 'tanks', 'records', 'totals']);
  });

  it('omits a group left with no tiles', () => {
    const everyTimeTile = OVERVIEW_TILE_DEFS.filter((def) => def.group === 'time').map(
      (def) => def.id,
    );
    const frame = skeletonGroups(OVERVIEW_TILE_DEFS, everyTimeTile);
    expect(frame.map((group) => group.id)).toEqual(['pinned', 'tanks', 'records', 'totals']);
  });

  it('is pure: frozen inputs, fresh results', () => {
    const defs: readonly OverviewTileDef[] = deepFreeze(
      OVERVIEW_TILE_DEFS.map((def) => ({ ...def })),
    );
    const pins = deepFreeze([...DEFAULT_PINS]);
    const a = skeletonGroups(defs, pins);
    const b = skeletonGroups(defs, pins);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a[0].sizes).not.toBe(b[0].sizes);
  });
});
