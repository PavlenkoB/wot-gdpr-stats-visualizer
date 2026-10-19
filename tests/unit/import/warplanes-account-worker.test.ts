import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataQuery } from '../../../src/lib/core/types/worker-messages.ts';
import type { VehicleView } from '../../../src/lib/features/vehicles/vehicle-shared.ts';
import { wowpAccountColumns } from '../../../src/lib/features/vehicles/vehicle-aggregate.ts';
import {
  canaryColumnsFor,
  driftedCsv,
  NEW_DATA_FIXTURE_FILES,
  NG_ROOT_A,
  NG_ROOT_B,
  withCanaries,
} from '../../fixtures/new-data-fixtures.ts';
import { zipSync } from '../../fixtures/pinned-zip.ts';
import {
  deleteActiveDatabase,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';

// =============================================================================
// Plan 11-10 Task 1 - the Warplanes account block through the real worker
// =============================================================================
//
// A real zip runs through the real worker and Dexie, and the posted `vehicles`
// view for the Warplanes title is asserted, so a wiring bug in the presence
// facts (the parsed counts) fails here and not only a builder change.
// =============================================================================

const WAIT_MS = 5_000;
const PLANE_19 = 'wowp_19_plane_statistics.csv';
const PLANE_20 = 'wowp_20_plane_statistics.csv';
const ACCOUNT_19 = 'wowp_19_account_statistics.csv';
const ACCOUNT_20 = 'wowp_20_account_statistics.csv';

let post: WorkerPostSpy;
let nextQueryId = 500;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** A two-root archive: A has all four files, B only the 20 account file. */
function buildTwoAccountArchive(overrides: Readonly<Record<string, string>> = {}): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  const put = (root: string, key: string): void => {
    const fixture = NEW_DATA_FIXTURE_FILES[key]!;
    entries[`${root}/${fixture.folder}/${fixture.fileName}`] = encode(
      overrides[`${root}:${key}`] ?? fixture.csv,
    );
  };
  for (const key of [PLANE_19, PLANE_20, ACCOUNT_19, ACCOUNT_20]) put(NG_ROOT_A, key);
  put(NG_ROOT_B, ACCOUNT_20);
  return zipSync(entries);
}

/** The Warplanes `vehicles` view the worker posts. */
async function askWowp(): Promise<VehicleView> {
  post.mockClear();
  const query: DataQuery = { channel: 'vehicles', title: 'wowp', battleType: null };
  postRequest({ type: 'data-query', queryId: nextQueryId++, query });
  const reply = await waitForMessage(post, 'data-result', WAIT_MS);
  if (reply.type !== 'data-result' || reply.result === null) throw new Error('expected a result');
  return reply.result.view as VehicleView;
}

describe('Warplanes account statistics through the worker', () => {
  it('lists A from the 19 file and B from the 20 file, each once, with the block columns', async () => {
    await ingestExport(post, buildTwoAccountArchive(), 'wowp-two.zip');
    const view = await askWowp();
    const block = view.wowpAccount!;
    expect(block).not.toBeNull();
    expect(block.skipped).toEqual([]);
    expect(block.accounts.map((entry) => entry.account).sort()).toEqual(
      [NG_ROOT_A, NG_ROOT_B].sort(),
    );
    const known = new Set(wowpAccountColumns().map((column) => column.id));
    expect(block.columns.length).toBeGreaterThan(0);
    for (const column of block.columns) expect(known.has(column.id)).toBe(true);
    for (const entry of block.accounts) expect(entry.cells).toHaveLength(block.columns.length);
    // The columns the header owns are not repeated.
    const ids = block.columns.map((column) => column.id);
    for (const owned of ['BATTLES', 'BATTLES_COUNT', 'GAMES_PLAYED', 'PREMIUM_EXPIRY_TIME']) {
      expect(ids).not.toContain(owned);
    }
  });

  it('leaves the plane table, the Warplanes 20 note and the header exactly as they are', async () => {
    await ingestExport(post, buildTwoAccountArchive(), 'wowp-two.zip');
    const view = await askWowp();
    expect(view.titleState).toBe('ready');
    expect(view.rows.length).toBeGreaterThan(0);
    expect(view.wowp20).not.toBeNull();
    expect(view.header).not.toBeNull();
    // The table is the 19 plane file's three rows, all A's.
    expect(view.rows.every((row) => row.account === NG_ROOT_A)).toBe(true);

    // The same archive without any account file: only the block changes.
    const entries: Record<string, Uint8Array> = {};
    for (const key of [PLANE_19, PLANE_20]) {
      const fixture = NEW_DATA_FIXTURE_FILES[key]!;
      entries[`${NG_ROOT_A}/${fixture.folder}/${fixture.fileName}`] = new TextEncoder().encode(
        fixture.csv,
      );
    }
    await deleteActiveDatabase();
    await loadWorker();
    await ingestExport(post, zipSync(entries), 'planes-only.zip');
    const without = await askWowp();
    expect(without.wowpAccount).toBeNull();
    expect(without.rows).toEqual(view.rows);
    expect(without.columns).toEqual(view.columns);
    expect(without.wowp20).toEqual(view.wowp20);
  });

  it('names a drifted account file in skipped and keeps the other account', async () => {
    const archive = buildTwoAccountArchive({
      [`${NG_ROOT_A}:${ACCOUNT_19}`]: driftedCsv(ACCOUNT_19),
    });
    await ingestExport(post, archive, 'wowp-drifted.zip');
    const view = await askWowp();
    expect(view.wowpAccount!.skipped).toEqual([ACCOUNT_19]);
    // A's 19 file stored nothing, so A falls back to its own 20 file; B is there.
    expect(view.wowpAccount!.accounts.map((entry) => entry.account).sort()).toEqual(
      [NG_ROOT_A, NG_ROOT_B].sort(),
    );
    expect(JSON.stringify(view)).not.toContain('CANARY-DRIFT');
  });

  it('shows only the skipped line when every account file is drifted', async () => {
    const archive = buildTwoAccountArchive({
      [`${NG_ROOT_A}:${ACCOUNT_19}`]: driftedCsv(ACCOUNT_19),
      [`${NG_ROOT_A}:${ACCOUNT_20}`]: driftedCsv(ACCOUNT_20),
      [`${NG_ROOT_B}:${ACCOUNT_20}`]: driftedCsv(ACCOUNT_20),
    });
    await ingestExport(post, archive, 'wowp-all-drifted.zip');
    const view = await askWowp();
    expect(view.wowpAccount).toEqual({
      columns: [],
      accounts: [],
      skipped: [ACCOUNT_19, ACCOUNT_20],
    });
  });

  it('has no block for an export with no Warplanes file, and the title is not in the export', async () => {
    const fixture = NEW_DATA_FIXTURE_FILES['wows_crews.csv']!;
    const archive = zipSync({
      [`${NG_ROOT_A}/${fixture.folder}/${fixture.fileName}`]: new TextEncoder().encode(fixture.csv),
    });
    await ingestExport(post, archive, 'no-wowp.zip');
    const view = await askWowp();
    expect(view.wowpAccount).toBeNull();
    expect(view.titleState).toBe('not-in-export');
  });

  it('never carries a planted nickname, address or surplus column', async () => {
    const archive = buildTwoAccountArchive({
      [`${NG_ROOT_A}:${ACCOUNT_19}`]: withCanaries(ACCOUNT_19),
      [`${NG_ROOT_A}:${ACCOUNT_20}`]: withCanaries(ACCOUNT_20),
      [`${NG_ROOT_B}:${ACCOUNT_20}`]: withCanaries(ACCOUNT_20),
      [`${NG_ROOT_A}:${PLANE_19}`]: withCanaries(PLANE_19),
    });
    await ingestExport(post, archive, 'wowp-canaries.zip');
    const view = await askWowp();
    expect(view.wowpAccount!.accounts.length).toBe(2);
    const text = JSON.stringify(view);
    for (const key of [ACCOUNT_19, ACCOUNT_20, PLANE_19]) {
      for (const canary of canaryColumnsFor(key)) expect(text).not.toContain(canary.value);
    }
    expect(text).not.toContain('surplus-beyond-the-header');
    expect(text).not.toContain('NICKNAME');
    expect(text).not.toContain('.csv');
  });
});
