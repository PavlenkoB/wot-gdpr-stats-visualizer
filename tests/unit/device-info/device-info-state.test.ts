import { describe, expect, test } from 'vitest';
import { deviceInfoSummary } from '../../../src/lib/features/device-info/device-info-state.ts';
import type {
  DeviceInfoView,
  DeviceTableView,
} from '../../../src/lib/features/device-info/device-info-shared.ts';
import {
  acceptDataOutcome,
  deriveFinanceState,
  type ShownBlock,
  type ViewOf,
} from '../../../src/lib/features/finance/finance-state.ts';
import type { DataOutcome } from '../../../src/lib/core/query-client.ts';

// =============================================================================
// Quick 261012-bog Task 2 — the Device info block's decisions
// =============================================================================
//
// The pane reuses the finance state functions unchanged (the vehicles block
// precedent), so what is new and testable here is `deviceInfoSummary`, plus
// proof that the shared functions do the right thing for the `device-info`
// channel: admit the dataset on screen, drop everything else, and never carry
// the worker's detail into the failed block.
// =============================================================================

const NOT_IN: DeviceTableView = { status: 'not-in-export' };
const NO_ROWS: DeviceTableView = { status: 'no-rows' };
const NO_USABLE: DeviceTableView = { status: 'no-usable', rowCount: 3, unreadable: 3 };
const READY = (rowCount: number, unreadable: number): DeviceTableView => ({
  status: 'ready',
  columns: ['x'],
  rows: [['a']],
  rowCount,
  more: 0,
  unreadable,
});

function viewOf(pc: DeviceTableView, blitz: DeviceTableView, assistant: DeviceTableView) {
  return { status: 'ready', pc, blitz, assistant } as unknown as DeviceInfoView;
}

describe('deviceInfoSummary', () => {
  test('reports per-source status, rows and unreadable for every table status', () => {
    const summary = deviceInfoSummary(viewOf(READY(4, 0), NOT_IN, READY(8, 4)));
    expect(summary.sources).toEqual([
      { id: 'pc', status: 'ready', rows: 4, unreadable: 0 },
      { id: 'blitz', status: 'not-in-export', rows: 0, unreadable: 0 },
      { id: 'assistant', status: 'ready', rows: 8, unreadable: 4 },
    ]);
    expect(summary.totalRows).toBe(12);
    expect(summary.totalUnreadable).toBe(4);
    expect(summary.present).toBe(2);
  });

  test('no-rows counts as present with zero rows, and no-usable keeps its counts', () => {
    const summary = deviceInfoSummary(viewOf(NO_ROWS, NO_USABLE, NOT_IN));
    expect(summary.sources).toEqual([
      { id: 'pc', status: 'no-rows', rows: 0, unreadable: 0 },
      { id: 'blitz', status: 'no-usable', rows: 3, unreadable: 3 },
      { id: 'assistant', status: 'not-in-export', rows: 0, unreadable: 0 },
    ]);
    expect(summary.totalRows).toBe(3);
    expect(summary.totalUnreadable).toBe(3);
    expect(summary.present).toBe(2);
  });

  test('three absent tables are zero present', () => {
    const summary = deviceInfoSummary(viewOf(NOT_IN, NOT_IN, NOT_IN));
    expect(summary.present).toBe(0);
    expect(summary.totalRows).toBe(0);
  });
});

const VIEW = viewOf(READY(1, 0), NOT_IN, NO_ROWS);

describe('the shared state functions on the device-info channel', () => {
  test('the view type is the one ViewOf resolves for the channel', () => {
    const resolved: ViewOf<'device-info'> = VIEW;
    expect(resolved.status).toBe('ready');
  });

  test('acceptDataOutcome admits a result for the dataset on screen', () => {
    const outcome: DataOutcome<'device-info'> = {
      kind: 'result',
      queryId: 1,
      importedAt: 'A',
      result: { channel: 'device-info', view: VIEW },
    } as DataOutcome<'device-info'>;
    expect(acceptDataOutcome(outcome, 'device-info', 'A', 'A')).toEqual({
      kind: 'view',
      importedAt: 'A',
      view: VIEW,
    });
  });

  test('drops a superseded outcome, a wrong-dataset answer and a null result', () => {
    const superseded = { kind: 'superseded', queryId: 1 } as DataOutcome<'device-info'>;
    expect(acceptDataOutcome(superseded, 'device-info', 'A', 'A')).toBeNull();

    const wrongDataset = {
      kind: 'result',
      queryId: 1,
      importedAt: 'B',
      result: { channel: 'device-info', view: VIEW },
    } as DataOutcome<'device-info'>;
    expect(acceptDataOutcome(wrongDataset, 'device-info', 'A', 'A')).toBeNull();
    // The dataset on screen changed while the ask was in flight.
    const stale = {
      kind: 'result',
      queryId: 1,
      importedAt: 'A',
      result: { channel: 'device-info', view: VIEW },
    } as DataOutcome<'device-info'>;
    expect(acceptDataOutcome(stale, 'device-info', 'A', 'B')).toBeNull();

    const nullResult = {
      kind: 'result',
      queryId: 1,
      importedAt: 'A',
      result: null,
    } as DataOutcome<'device-info'>;
    expect(acceptDataOutcome(nullResult, 'device-info', 'A', 'A')).toBeNull();
  });

  test('drops another channel result', () => {
    const other = {
      kind: 'result',
      queryId: 1,
      importedAt: 'A',
      result: { channel: 'spend', view: { status: 'no-usable' } },
    } as unknown as DataOutcome<'device-info'>;
    expect(acceptDataOutcome(other, 'device-info', 'A', 'A')).toBeNull();
  });

  test('turns an error outcome into a failed block with no worker detail', () => {
    const error = {
      kind: 'error',
      queryId: 1,
      detail: 'TypeError: secret path /Users/x',
    } as unknown as DataOutcome<'device-info'>;
    const shown = acceptDataOutcome(error, 'device-info', 'A', 'A');
    expect(shown).toEqual({ kind: 'failed', importedAt: 'A' });
    expect(JSON.stringify(shown)).not.toContain('secret');
  });

  test('deriveFinanceState gives loading, ready and error', () => {
    const view: ShownBlock<DeviceInfoView> = { kind: 'view', importedAt: 'A', view: VIEW };
    const failed: ShownBlock<DeviceInfoView> = { kind: 'failed', importedAt: 'A' };
    expect(deriveFinanceState<DeviceInfoView>({ importedAt: 'A', shown: null })).toBe('loading');
    expect(deriveFinanceState<DeviceInfoView>({ importedAt: null, shown: view })).toBe('loading');
    expect(deriveFinanceState<DeviceInfoView>({ importedAt: 'B', shown: view })).toBe('loading');
    expect(deriveFinanceState<DeviceInfoView>({ importedAt: 'A', shown: view })).toBe('ready');
    expect(deriveFinanceState<DeviceInfoView>({ importedAt: 'A', shown: failed })).toBe('error');
  });
});
