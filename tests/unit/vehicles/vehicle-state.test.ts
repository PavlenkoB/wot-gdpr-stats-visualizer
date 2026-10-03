import { describe, expect, it } from 'vitest';
import {
  acceptVehicleOutcome,
  appliedAsk,
  derivePlayerState,
  freshSelection,
  playerStatusLine,
  selectionAfterBattleType,
  vehiclesQuery,
  type ShownVehicles,
  type VehicleAsk,
  type VehicleSelection,
} from '../../../src/lib/features/vehicles/vehicle-state';
import type { VehicleView } from '../../../src/lib/features/vehicles/vehicle-shared';
import { DEFAULT_SORT } from '../../../src/lib/features/vehicles/vehicle-model';
import {
  PLAYER_STATS_ERROR,
  PLAYER_STATS_LOADING,
  PLAYER_STATS_UPDATING,
} from '../../../src/lib/ui-copy';
import type { DataOutcome } from '../../../src/lib/core/query-client';

function mockView(title: 'wot' | 'wotb' = 'wot', battleType: string | null = null): VehicleView {
  return {
    overview: [
      { title: 'wot', present: true, rows: 6 },
      { title: 'wotb', present: true, rows: 3 },
      { title: 'wows', present: true, rows: 3 },
      { title: 'wowp', present: true, rows: 3 },
    ],
    title,
    titleState: 'ready',
    battleType,
    battleTypes: [],
    summary: [],
    header: null,
    wowp20: null,
    allBattlesOnly: false,
    columns: [],
    rows: [],
  };
}

/** A `result` outcome carrying a view stamped with `importedAt`. */
function result(importedAt: string, view: VehicleView): DataOutcome<'vehicles'> {
  return { kind: 'result', queryId: 1, importedAt, result: { channel: 'vehicles', view } };
}

describe('05-12 tracer: vehicle block state', () => {
  describe('derivePlayerState', () => {
    it('is loading with no dataset, no answer, or an answer for another dataset', () => {
      expect(derivePlayerState({ importedAt: null, shown: null, requested: null })).toBe('loading');

      const shown: ShownVehicles = { kind: 'view', importedAt: 'ts1', view: mockView() };
      // The replace case: a fresh dataset is on screen and the view belongs to
      // the previous one, so the block is loading rather than showing it.
      expect(derivePlayerState({ importedAt: 'ts2', shown, requested: null })).toBe('loading');
    });

    it('is error for a failed answer of this dataset', () => {
      const shown: ShownVehicles = { kind: 'failed', importedAt: 'ts1' };
      expect(derivePlayerState({ importedAt: 'ts1', shown, requested: null })).toBe('error');
      // A failure for a REPLACED dataset is still just "no answer" — otherwise
      // a clear would show the error of a dataset that no longer exists.
      expect(derivePlayerState({ importedAt: 'ts2', shown, requested: null })).toBe('loading');
    });

    it('is updating when the ask names a title or a battle type the view did not apply', () => {
      const shown: ShownVehicles = { kind: 'view', importedAt: 'ts1', view: mockView('wot', null) };
      expect(
        derivePlayerState({
          importedAt: 'ts1',
          shown,
          requested: { importedAt: 'ts1', title: 'wotb', battleType: null },
        }),
      ).toBe('updating');
      expect(
        derivePlayerState({
          importedAt: 'ts1',
          shown,
          requested: { importedAt: 'ts1', title: 'wot', battleType: '2' },
        }),
      ).toBe('updating');
    });

    it('is ready when the ask and the applied view agree, and a null ask is not pending', () => {
      const shown: ShownVehicles = { kind: 'view', importedAt: 'ts1', view: mockView('wot', null) };
      expect(
        derivePlayerState({
          importedAt: 'ts1',
          shown,
          requested: { importedAt: 'ts1', title: 'wot', battleType: null },
        }),
      ).toBe('ready');
      // The reconcile's whole purpose: after `appliedAsk` rewrites the request
      // to what the view applied, a DEFAULTED title (the ask was `null`) is
      // ready rather than updating forever.
      expect(
        derivePlayerState({
          importedAt: 'ts1',
          shown,
          requested: appliedAsk('ts1', mockView('wot', null)),
        }),
      ).toBe('ready');
      expect(derivePlayerState({ importedAt: 'ts1', shown, requested: null })).toBe('ready');
    });

    it('ignores an ask stamped with another dataset', () => {
      const shown: ShownVehicles = { kind: 'view', importedAt: 'ts1', view: mockView('wot', null) };
      expect(
        derivePlayerState({
          importedAt: 'ts1',
          shown,
          requested: { importedAt: 'ts0', title: 'wows', battleType: '1' },
        }),
      ).toBe('ready');
    });
  });

  describe('acceptVehicleOutcome', () => {
    const ask: VehicleAsk = { importedAt: 'ts1', title: 'wot', battleType: null };

    it('drops a superseded answer and a null result', () => {
      // T-05-37: a newer question of the same channel owns the block now.
      expect(acceptVehicleOutcome({ kind: 'superseded', queryId: 1 }, ask, 'ts1')).toBeNull();
      // A null result means the worker holds no stored dataset for the channel,
      // which is a fact about its storage, not an empty state to render.
      expect(
        acceptVehicleOutcome(
          { kind: 'result', queryId: 1, importedAt: 'ts1', result: null },
          ask,
          'ts1',
        ),
      ).toBeNull();
    });

    it('drops an answer for a dataset that is not the one on screen', () => {
      const view = mockView();
      // Stamped for another dataset than the ask.
      expect(acceptVehicleOutcome(result('ts2', view), ask, 'ts1')).toBeNull();
      // Stamped with no dataset at all.
      expect(
        acceptVehicleOutcome(
          { kind: 'result', queryId: 1, importedAt: null, result: { channel: 'vehicles', view } },
          ask,
          'ts1',
        ),
      ).toBeNull();
      // A replace landed while the worker was reading.
      expect(acceptVehicleOutcome(result('ts1', view), ask, 'ts2')).toBeNull();
      expect(acceptVehicleOutcome(result('ts1', view), ask, null)).toBeNull();
    });

    it('drops a result carrying another channel, and keeps this channel’s', () => {
      const view = mockView();
      const wrong = {
        kind: 'result',
        queryId: 1,
        importedAt: 'ts1',
        result: { channel: 'premium', view: {} },
      } as unknown as DataOutcome<'vehicles'>;
      expect(acceptVehicleOutcome(wrong, ask, 'ts1')).toBeNull();

      const accepted = acceptVehicleOutcome(result('ts1', view), ask, 'ts1');
      expect(accepted).toEqual({ kind: 'view', importedAt: 'ts1', view });
    });

    it('turns a failure into a failed block with no detail, stamped with the ask', () => {
      const failed = acceptVehicleOutcome(
        { kind: 'error', queryId: 1, detail: 'worker/secret/path' },
        ask,
        'ts1',
      );
      expect(failed).toEqual({ kind: 'failed', importedAt: 'ts1' });
      // T-05-31 / D-21: the worker's string is nowhere in the result.
      expect(JSON.stringify(failed)).not.toContain('secret');
    });
  });

  describe('helpers', () => {
    it('appliedAsk describes what the view actually applied, not what was asked', () => {
      // The reconcile: a battle type the worker declined comes back as null,
      // and a defaulted title comes back as the one it picked.
      expect(appliedAsk('ts1', mockView('wotb', '2'))).toEqual({
        importedAt: 'ts1',
        title: 'wotb',
        battleType: '2',
      });
    });

    it('freshSelection returns the D-12 defaults', () => {
      // D-28: a new dataset, and a title change, both open at battles
      // descending with an empty search.
      expect(freshSelection()).toEqual({ query: '', sort: DEFAULT_SORT, pickedExtraKeys: [] });
      // A fresh VALUE each call, so a caller can hold it in $state without the
      // block's own writes reaching a module-level object.
      const first = freshSelection();
      first.sort.dir = 'asc';
      expect(freshSelection().sort).toEqual(DEFAULT_SORT);
    });

    it('selectionAfterBattleType resets the sort and the search but KEEPS the picked extras', () => {
      // 05-14 / D-12. The same fields mostly exist in the All view and the
      // per-battle-type view, so dropping the reader's chosen columns on every
      // battle-type change would be churn. The picked list is handed back AS
      // GIVEN — the same array, not a copy of it — because the picker's
      // validation against the new view belongs to `visibleColumns` (which
      // ignores a key this view does not have) and not to the reset.
      const picked = ['survival', 'hitRatio'];
      expect(
        selectionAfterBattleType({
          query: 'ch24',
          sort: { key: 'vehicle', dir: 'asc' },
          pickedExtraKeys: picked,
        }),
      ).toEqual({
        query: '',
        sort: DEFAULT_SORT,
        pickedExtraKeys: picked,
      });
      // And it is the SAME list, not a filtered or reordered copy: the block
      // holds one array, and a battle-type change must not be a second place
      // that decides which of the reader's columns survive.
      const previous = {
        query: '',
        sort: { key: 'battles', dir: 'desc' },
        pickedExtraKeys: picked,
      } satisfies VehicleSelection;
      expect(selectionAfterBattleType(previous).pickedExtraKeys).toBe(picked);
      // The contrast that makes the rule visible: a TITLE change is a different
      // game and a different file, so it clears the picked list entirely.
      expect(freshSelection().pickedExtraKeys).toEqual([]);
    });

    it('playerStatusLine reads the fixed sentence for every state but ready', () => {
      expect(playerStatusLine('loading', 'announcement')).toBe(PLAYER_STATS_LOADING);
      expect(playerStatusLine('updating', 'announcement')).toBe(PLAYER_STATS_UPDATING);
      expect(playerStatusLine('error', 'announcement')).toBe(PLAYER_STATS_ERROR);
      // Ready passes the announcement through untouched, and an empty one is
      // an empty live region rather than a placeholder sentence.
      expect(playerStatusLine('ready', 'Showing WoT, all battles: 6 vehicles.')).toBe(
        'Showing WoT, all battles: 6 vehicles.',
      );
      expect(playerStatusLine('ready', '')).toBe('');
    });

    it('vehiclesQuery is the ask on the vehicles channel, with both nulls kept', () => {
      expect(vehiclesQuery({ importedAt: 'ts1', title: null, battleType: null })).toEqual({
        channel: 'vehicles',
        title: null,
        battleType: null,
      });
      expect(vehiclesQuery({ importedAt: 'ts1', title: 'wows', battleType: '2' })).toEqual({
        channel: 'vehicles',
        title: 'wows',
        battleType: '2',
      });
    });
  });
});
