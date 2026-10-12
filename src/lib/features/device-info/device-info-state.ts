import type { DeviceInfoView, DeviceSourceId } from './device-info-shared.ts';
import { DEVICE_SOURCES } from './device-info-shared.ts';

// =============================================================================
// The Device info block's decisions, as pure functions (quick 261012-bog)
// =============================================================================
//
// The block asks ONE channel and renders the answer, so almost everything it
// needs is already decided by the shared state functions in `finance-state.ts`
// (`acceptDataOutcome`, `deriveFinanceState`, `ShownBlock`), exactly as the
// vehicles block reuses `acceptDataOutcome`. They apply unchanged because the
// view's top-level status is always `ready`: the three tables carry the real
// states.
//
// What is new is the counts summary. This module has no copy and no Svelte, so
// the wording never reaches a state test and a wording change never edits this
// file.
// =============================================================================

/** One source's line in the counts summary. */
export interface DeviceSourceSummary {
  id: DeviceSourceId;
  status: 'not-in-export' | 'no-rows' | 'no-usable' | 'ready';
  /** Data rows in the file; 0 when the file is absent or empty. */
  rows: number;
  /** Rows from which nothing could be read. */
  unreadable: number;
}

/** The counts summary the pane shows above its three tables. */
export interface DeviceInfoSummary {
  /** One entry per source, in the fixed pc, blitz, assistant order. */
  sources: DeviceSourceSummary[];
  totalRows: number;
  totalUnreadable: number;
  /** How many of the three files were in the export. */
  present: number;
}

/** Summarise a ready view: per-source status and counts, plus the totals. */
export function deviceInfoSummary(view: DeviceInfoView): DeviceInfoSummary {
  const sources = DEVICE_SOURCES.map((id): DeviceSourceSummary => {
    const table = view[id];
    if (table.status === 'ready' || table.status === 'no-usable') {
      return { id, status: table.status, rows: table.rowCount, unreadable: table.unreadable };
    }
    return { id, status: table.status, rows: 0, unreadable: 0 };
  });
  return {
    sources,
    totalRows: sources.reduce((sum, source) => sum + source.rows, 0),
    totalUnreadable: sources.reduce((sum, source) => sum + source.unreadable, 0),
    present: sources.filter((source) => source.status !== 'not-in-export').length,
  };
}
