import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClassifyResult, DataQuery } from '../../../src/lib/core/types/worker-messages.ts';
import type { VehicleView } from '../../../src/lib/features/vehicles/vehicle-shared.ts';
import {
  MA_EXPECTED_GAMES,
  MA_ROOT_EU,
  MA_ROOT_NA,
  MA_ROOT_RU,
  MA_ROOTS_D16_ORDER,
  buildHeatOnlyExport,
  buildNewGamesThreeAccountExport,
  buildRealShapeThreeAccountExport,
} from '../../fixtures/multi-account-fixtures.ts';
import {
  NG3_EXPECTED,
  NG3_LARGE_STORAGE_ROWS,
  NG3_ROOTS,
  ng3PaneCanaryValues,
} from '../../fixtures/new-data-fixtures.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';

// =============================================================================
// Plan 11-11 Task 1 - the browser fixtures, through the real worker
// =============================================================================
//
// The e2e tests import these archives, so they have to be right BEFORE a browser
// sees them: the account order, which account holds which record, the pane row
// counts (typed in `NG3_EXPECTED` from the three-rows-per-file rule), the large
// table, and the planted canaries absent from every stored row (Pitfall 9).
// =============================================================================

const WAIT_MS = 5_000;

let post: WorkerPostSpy;
let nextQueryId = 900;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

async function ingestDone(bytes: Uint8Array, name = 'export.zip'): Promise<ClassifyResult> {
  const terminal = await ingestExport(post, bytes, name, 20_000);
  if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
  return terminal.result;
}

async function askWowp(): Promise<VehicleView> {
  post.mockClear();
  const query: DataQuery = { channel: 'vehicles', title: 'wowp', battleType: null };
  postRequest({ type: 'data-query', queryId: nextQueryId++, query });
  const reply = await waitForMessage(post, 'data-result', WAIT_MS);
  if (reply.type !== 'data-result' || reply.result === null) throw new Error('expected a result');
  return reply.result.view as VehicleView;
}

describe('the answer key agrees with the root constants', () => {
  it('NG3_ROOTS is the D-16 order of the real-shape roots', () => {
    expect([...NG3_ROOTS]).toEqual([...MA_ROOTS_D16_ORDER]);
    expect(NG3_EXPECTED.roots.heat).toEqual([MA_ROOT_EU]);
    expect(NG3_EXPECTED.roots.warships).toEqual([MA_ROOT_RU, MA_ROOT_NA]);
    expect(NG3_EXPECTED.roots.warplanes).toEqual([MA_ROOT_RU]);
  });
});

describe('buildNewGamesThreeAccountExport', () => {
  it('is three accounts in D-16 order, imports to done and holds both optional panes', async () => {
    const result = await ingestDone(buildNewGamesThreeAccountExport());
    expect(result.accounts!.map((a) => a.root)).toEqual([...MA_ROOTS_D16_ORDER]);
    expect(result.newDataPanes).toEqual({
      heat: { ...NG3_EXPECTED.heat },
      'warships-storage': { ...NG3_EXPECTED.warshipsStorage },
    });
  });

  it('leaves every account game list as the real-shape archive has it', async () => {
    const result = await ingestDone(buildNewGamesThreeAccountExport());
    for (const account of result.accounts!) {
      expect(account.games, `games of ${account.root}`).toEqual([
        ...MA_EXPECTED_GAMES[account.root]!,
      ]);
    }
  });

  it('holds the HEAT rows in EU alone and the Warships rows in RU and NA', async () => {
    await ingestDone(buildNewGamesThreeAccountExport());
    const { db } = await importWorkerDb();
    const rows = await db.rows.toArray();
    const ownersOf = (pattern: RegExp): string[] =>
      [
        ...new Set(rows.filter((r) => pattern.test(r.sourceFile)).map((r) => r.account ?? '')),
      ].sort();
    expect(ownersOf(/^HEAT_(Account|Battle|Session_Geo)/i)).toEqual([...NG3_EXPECTED.roots.heat]);
    expect(ownersOf(/^WOWS_(Crews|Account_Storage)/i)).toEqual(
      [...NG3_EXPECTED.roots.warships].sort(),
    );
    expect(ownersOf(/^WOWP_/i)).toEqual([...NG3_EXPECTED.roots.warplanes]);
  });

  it('gives exactly one account a Warplanes account record', async () => {
    await ingestDone(buildNewGamesThreeAccountExport());
    const view = await askWowp();
    expect(view.wowpAccount).not.toBeNull();
    expect(view.wowpAccount!.accounts.map((entry) => entry.account)).toEqual([
      ...NG3_EXPECTED.roots.warplanes,
    ]);
    expect(view.wowpAccount!.accounts).toHaveLength(NG3_EXPECTED.warplanesAccountCount);
  });

  it('stores no planted canary anywhere in db.rows or meta', async () => {
    await ingestDone(buildNewGamesThreeAccountExport());
    const { db } = await importWorkerDb();
    const text = JSON.stringify(await db.rows.toArray()) + JSON.stringify(await db.meta.toArray());
    const canaries = ng3PaneCanaryValues();
    expect(canaries.length).toBeGreaterThan(20);
    for (const value of canaries) expect(text, value).not.toContain(value);
    // The address canary is an address-shaped value of the same planted kind.
    expect(text).not.toContain('203.0.113.250');
  });

  it('with a large storage file the Warships row count rises by exactly that many rows', async () => {
    const result = await ingestDone(
      buildNewGamesThreeAccountExport({ largeStorageRows: NG3_LARGE_STORAGE_ROWS }),
    );
    expect(result.newDataPanes!['warships-storage']).toEqual({
      ...NG3_EXPECTED.warshipsStorageLarge,
    });
    expect(NG3_EXPECTED.warshipsStorageLarge.rowCount).toBe(
      NG3_EXPECTED.warshipsStorage.rowCount - 3 + NG3_LARGE_STORAGE_ROWS,
    );
    // The HEAT pane is untouched by the option.
    expect(result.newDataPanes!.heat).toEqual({ ...NG3_EXPECTED.heat });
  });

  it('is byte-stable in its entry set when reversed', async () => {
    const forward = await ingestDone(buildNewGamesThreeAccountExport(), 'a.zip');
    await deleteActiveDatabase();
    await loadWorker();
    const reversed = await ingestDone(buildNewGamesThreeAccountExport({ reversed: true }), 'b.zip');
    expect(reversed.accounts!.map((a) => a.root)).toEqual(forward.accounts!.map((a) => a.root));
    expect(reversed.newDataPanes).toEqual(forward.newDataPanes);
  });
});

describe('the existing builders are unchanged by the new ones', () => {
  it('the real-shape archive has no optional pane', async () => {
    const result = await ingestDone(buildRealShapeThreeAccountExport());
    expect(result.newDataPanes ?? {}).toEqual({});
  });
});

describe('buildHeatOnlyExport', () => {
  it('is one account whose game list is HEAT alone', async () => {
    const result = await ingestDone(buildHeatOnlyExport());
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts![0]!.games).toEqual(['HEAT']);
    expect(result.accounts![0]!.root).toBe(MA_ROOT_EU);
    expect(MA_ROOT_RU).not.toBe(MA_ROOT_EU);
  });
});
