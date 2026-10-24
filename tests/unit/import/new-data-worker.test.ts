import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HEAT_CARD_FILES,
  HEAT_CARD_IDS,
  NEW_DATA_PANE_FILES,
  WOWS_CARD_FILES,
  WOWS_CARD_IDS,
  type HeatView,
  type NewDataCardView,
  type WarshipsStorageView,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
import type { DataQuery } from '../../../src/lib/core/types/worker-messages.ts';
import { DATA_FILES, isDataQuery } from '../../../src/lib/worker/data-queries.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { buildSampleExport } from '../../fixtures/export-fixtures.ts';
import { zipSync } from '../../fixtures/pinned-zip.ts';
import {
  buildLargeTableCsv,
  buildNewDataFilesExport,
  buildNewDataTwoAccountExport,
  canaryColumnsFor,
  driftedCsv,
  headerOnlyCsv,
  NEW_DATA_FIXTURE_FILES,
  NG_HEAT_PANE_KEYS,
  NG_ROOT_A,
  NG_ROOT_B,
  NG_TWO_ACCOUNT_B_WOWS_ROWS,
  NG_WOWS_PANE_KEYS,
  withCanaries,
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
// Plan 11-07 Task 2 — the heat and warships-storage channels, through the worker
// =============================================================================
//
// Every case runs a real zip through the real worker and Dexie and asks the
// posted data-query, so a wiring bug (the file table, the presence facts, the
// builder inputs) fails here and not only a builder change.
// =============================================================================

const WAIT_MS = 5_000;

let post: WorkerPostSpy;
let nextQueryId = 100;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

const HEAT_QUERY: DataQuery = { channel: 'heat' };
const WOWS_QUERY: DataQuery = { channel: 'warships-storage' };

/** Ask one query and return the posted reply's view. */
async function ask(query: DataQuery): Promise<{ importedAt: string | null; view: unknown }> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId: nextQueryId++, query });
  const reply = await waitForMessage(post, 'data-result', WAIT_MS);
  if (reply.type !== 'data-result') throw new Error('expected data-result');
  if (reply.result === null) throw new Error('expected a result');
  expect(reply.result.channel).toBe(query.channel);
  return { importedAt: reply.importedAt, view: reply.result.view };
}

async function askHeat(): Promise<HeatView> {
  return (await ask(HEAT_QUERY)).view as HeatView;
}

async function askWows(): Promise<WarshipsStorageView> {
  return (await ask(WOWS_QUERY)).view as WarshipsStorageView;
}

function ready(card: NewDataCardView) {
  if (card.status !== 'ready') throw new Error(`expected ready, got ${card.status}`);
  return card;
}

/** The ready row count of a card, zero for every other state. */
function readyRows(card: NewDataCardView): number {
  return card.status === 'ready' ? card.rowCount : 0;
}

describe('the two channels are strict field-less queries', () => {
  it('accepts a bare query and rejects a smuggled title, battleType or other field', () => {
    // 13-01: the `overview` channel joined this loop when it was registered.
    // It is field-less for the same reason the other two are, and its own
    // validator cases live in `overview-worker.test.ts`.
    for (const channel of ['heat', 'warships-storage', 'overview']) {
      expect(isDataQuery({ channel })).toBe(true);
      expect(isDataQuery({ channel, title: 'wot' })).toBe(false);
      expect(isDataQuery({ channel, title: null })).toBe(false);
      expect(isDataQuery({ channel, battleType: null })).toBe(false);
    }
  });

  it('answers a malformed heat query with the fixed invalid query detail', async () => {
    postRequest({
      type: 'data-query',
      queryId: 7,
      query: { channel: 'heat', title: 'wot' } as unknown as DataQuery,
    });
    const reply = await waitForMessage(post, 'data-error', WAIT_MS);
    if (reply.type !== 'data-error') throw new Error('expected data-error');
    expect(reply.detail).toBe('invalid query');
  });

  it('answers a malformed warships-storage query with the fixed invalid query detail', async () => {
    postRequest({
      type: 'data-query',
      queryId: 8,
      query: { channel: 'warships-storage', battleType: 'x' } as unknown as DataQuery,
    });
    const reply = await waitForMessage(post, 'data-error', WAIT_MS);
    if (reply.type !== 'data-error') throw new Error('expected data-error');
    expect(reply.detail).toBe('invalid query');
  });
});

describe('the card-to-file maps and the pane contract cannot drift', () => {
  it('HEAT cards map onto exactly the pane files, and Warships likewise', () => {
    expect(new Set(Object.values(HEAT_CARD_FILES))).toEqual(new Set(NEW_DATA_PANE_FILES.heat));
    expect(new Set(Object.values(WOWS_CARD_FILES))).toEqual(
      new Set(NEW_DATA_PANE_FILES['warships-storage']),
    );
    expect(Object.keys(HEAT_CARD_FILES)).toEqual([...HEAT_CARD_IDS]);
    expect(Object.keys(WOWS_CARD_FILES)).toEqual([...WOWS_CARD_IDS]);
  });

  it('DATA_FILES names exactly each pane file set', () => {
    expect(DATA_FILES.heat.names).toEqual(new Set(NEW_DATA_PANE_FILES.heat));
    expect(DATA_FILES['warships-storage'].names).toEqual(
      new Set(NEW_DATA_PANE_FILES['warships-storage']),
    );
  });

  it('every pane file has a spec, so no card can be silently empty', () => {
    const keys = new Set(NEW_DATA_SPEC_FILES.map((spec) => spec.key));
    for (const key of [...NG_HEAT_PANE_KEYS, ...NG_WOWS_PANE_KEYS])
      expect(keys.has(key)).toBe(true);
  });
});

describe('the four card states through the worker', () => {
  it('an export with no HEAT files gives four not-in-export cards', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const view = await askHeat();
    expect(view.status).toBe('ready');
    for (const id of HEAT_CARD_IDS) expect(view.cards[id], id).toEqual({ status: 'not-in-export' });
  });

  it('an export with only HEAT files gives two not-in-export Warships cards', async () => {
    const entries: Record<string, Uint8Array> = {};
    for (const key of NG_HEAT_PANE_KEYS) {
      const fixture = NEW_DATA_FIXTURE_FILES[key]!;
      entries[`${NG_ROOT_A}/${fixture.folder}/${fixture.fileName}`] = new TextEncoder().encode(
        fixture.csv,
      );
    }
    await ingestExport(post, zipSync(entries), 'heat-only.zip');
    const wows = await askWows();
    expect(wows.status).toBe('ready');
    for (const id of WOWS_CARD_IDS) expect(wows.cards[id], id).toEqual({ status: 'not-in-export' });
    expect((await askHeat()).cards.geolocation.status).toBe('ready');
  });

  it('plain files give ready cards with the fixture rows, spec-order columns and the account', async () => {
    const terminal = await ingestExport(post, buildNewDataFilesExport(), 'all.zip');
    expect(terminal.type).toBe('done');

    const heat = await askHeat();
    for (const id of HEAT_CARD_IDS) expect(heat.cards[id].status, id).toBe('ready');
    const geo = ready(heat.cards.geolocation);
    expect(geo.rowCount).toBe(3);
    expect(geo.rows.every((row) => row.account === NG_ROOT_A)).toBe(true);
    // Spec order: the allowlisted columns the capture carries, whatever order
    // the capture lists them in.
    const specOrder = NEW_DATA_SPEC_FILES.find(
      (s) => s.key === 'heat_session_geolocation.csv',
    )!.columns.map((column) => column.id);
    expect(geo.columns.map((column) => column.id)).toEqual(
      specOrder.filter((id) => geo.columns.some((column) => column.id === id)),
    );
    // The address column holds the canonical TEST-NET-3 address and nothing else.
    const ipIndex = geo.columns.findIndex((column) => column.id === 'IP');
    expect(ipIndex).toBeGreaterThanOrEqual(0);
    for (const row of geo.rows) expect(String(row.cells[ipIndex])).toMatch(/^203\.0\.113\.\d+$/);

    const wows = await askWows();
    const crews = ready(wows.cards.crews);
    expect(crews.columns.map((column) => column.id)).toEqual([
      'CREW_ID',
      'CREW_SHIP',
      'CREW_TYPE',
      'CREW_LEVEL',
      'CREW_SHIP_TRAINED',
      'CREW_EXPERIENCE',
    ]);
    expect(crews.rows[0]!.cells[0]).toBe('Synthetic CREW_ID 1');
    // A number-kind cell is a number: row 0, column 3 is (0 + 1) * 10 + 3.
    expect(crews.rows[0]!.cells[3]).toBe(13);
  });

  it('a header-only file is no-rows', async () => {
    await ingestExport(
      post,
      buildNewDataFilesExport({ 'wows_crews.csv': headerOnlyCsv('wows_crews.csv') }),
      'header-only.zip',
    );
    const wows = await askWows();
    expect(wows.cards.crews).toEqual({ status: 'no-rows' });
    expect(wows.cards.storage.status).toBe('ready');
  });

  it('a drifted-header file is skipped: rows parsed, none stored', async () => {
    await ingestExport(
      post,
      buildNewDataFilesExport({
        'heat_account_storage.csv': driftedCsv('heat_account_storage.csv'),
      }),
      'drifted.zip',
    );
    const heat = await askHeat();
    expect(heat.cards.storage).toEqual({ status: 'skipped' });
    expect(heat.cards.accountStats.status).toBe('ready');
    expect(JSON.stringify(heat)).not.toContain('CANARY-DRIFT');
  });

  it('a canary-laden file is ready with no canary anywhere in the posted JSON', async () => {
    const files: Record<string, string> = {};
    for (const key of [...NG_HEAT_PANE_KEYS, ...NG_WOWS_PANE_KEYS]) files[key] = withCanaries(key);
    await ingestExport(post, buildNewDataFilesExport(files), 'canaries.zip');

    const texts = [JSON.stringify(await askHeat()), JSON.stringify(await askWows())];
    for (const text of texts) {
      for (const key of [...NG_HEAT_PANE_KEYS, ...NG_WOWS_PANE_KEYS]) {
        for (const canary of canaryColumnsFor(key)) expect(text).not.toContain(canary.value);
      }
      expect(text).not.toContain('surplus-beyond-the-header');
      expect(text).not.toContain('duplicate-');
      // The geolocation capture's own excluded columns carry synthetic values.
      expect(text).not.toContain('Synthetic ACCOUNT_ID');
      expect(text).not.toContain('Synthetic CITY');
      expect(text).not.toContain('Synthetic REGION');
      expect(text).not.toContain('.csv');
    }
    const geo = ready((await askHeat()).cards.geolocation);
    expect(geo.rowCount).toBe(3);
  });
});

describe('two accounts', () => {
  it('stamps Warships rows with their own account and HEAT rows with root B alone', async () => {
    const terminal = await ingestExport(post, buildNewDataTwoAccountExport(), 'two.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    expect(terminal.result.accounts).toHaveLength(2);

    const wows = await askWows();
    for (const id of WOWS_CARD_IDS) {
      const card = ready(wows.cards[id]);
      const accounts = card.rows.map((row) => row.account);
      expect(accounts.filter((a) => a === NG_ROOT_A)).toHaveLength(3);
      expect(accounts.filter((a) => a === NG_ROOT_B)).toHaveLength(NG_TWO_ACCOUNT_B_WOWS_ROWS);
      expect(card.rowCount).toBe(3 + NG_TWO_ACCOUNT_B_WOWS_ROWS);
      // First-seen account order: every row of one account, then the other.
      const first = accounts[0]!;
      const firstBlock = accounts.findIndex((a) => a !== first);
      expect(accounts.slice(firstBlock).every((a) => a !== first)).toBe(true);
    }

    const heat = await askHeat();
    for (const id of HEAT_CARD_IDS) {
      const card = ready(heat.cards[id]);
      expect(
        card.rows.every((row) => row.account === NG_ROOT_B),
        id,
      ).toBe(true);
    }
    // No nickname or account id rides in a view beyond the root itself.
    const text = JSON.stringify(wows) + JSON.stringify(heat);
    expect(text).not.toContain('NICKNAME');
    expect(text).not.toContain('Synthetic ACCOUNT_ID');
  });
});

describe('legacy caches', () => {
  it('a stored row that still holds a canary column answers a view without it', async () => {
    await ingestExport(post, buildNewDataFilesExport(), 'all.zip');
    const { db } = await importWorkerDb();
    const canary = 'CANARY-LEGACY-NICKNAME-11-07';

    const stored = await db.rows
      .where('sourceFile')
      .equals(NEW_DATA_FIXTURE_FILES['wows_crews.csv']!.fileName)
      .toArray();
    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      await db.rows.update(row.id!, {
        data: { ...row.data, NICKNAME: canary, EMAIL: `${canary}@x.example.invalid` },
      });
    }
    const seeded = await db.rows
      .where('sourceFile')
      .equals(NEW_DATA_FIXTURE_FILES['wows_crews.csv']!.fileName)
      .toArray();
    expect(JSON.stringify(seeded)).toContain(canary);

    const wows = await askWows();
    expect(ready(wows.cards.crews).rowCount).toBe(3);
    expect(JSON.stringify(wows)).not.toContain(canary);
  });

  it('a cache with no presence list answers ready cards and no-rows, never not-in-export', async () => {
    await ingestExport(
      post,
      buildNewDataFilesExport({ 'wows_crews.csv': headerOnlyCsv('wows_crews.csv') }),
      'legacy.zip',
    );
    const { db } = await importWorkerDb();
    await db.meta.update('active', { files: null });

    const wows = await askWows();
    expect(wows.cards.crews).toEqual({ status: 'no-rows' });
    expect(wows.cards.storage.status).toBe('ready');
  });
});

describe('scale', () => {
  it('a 3000-row table arrives whole', async () => {
    const key = 'wows_account_storage.csv';
    await ingestExport(
      post,
      buildNewDataFilesExport({ [key]: buildLargeTableCsv(key, 3000) }),
      'large.zip',
    );
    const card = ready((await askWows()).cards.storage);
    expect(card.rowCount).toBe(3000);
    expect(card.rows).toHaveLength(3000);
  });
});

describe('the pane facts agree with the views', () => {
  it('the headline row counts equal the sum of the cards ready rows', async () => {
    const terminal = await ingestExport(post, buildNewDataFilesExport(), 'all.zip');
    if (terminal.type !== 'done') throw new Error('expected done');
    const panes = terminal.result.newDataPanes;
    expect(panes).toBeDefined();

    const heat = await askHeat();
    const heatSum = HEAT_CARD_IDS.reduce((sum, id) => sum + readyRows(heat.cards[id]), 0);
    expect(heatSum).toBeGreaterThan(0);
    expect(panes!.heat!.rowCount).toBe(heatSum);

    const wows = await askWows();
    const wowsSum = WOWS_CARD_IDS.reduce((sum, id) => sum + readyRows(wows.cards[id]), 0);
    expect(wowsSum).toBeGreaterThan(0);
    expect(panes!['warships-storage']!.rowCount).toBe(wowsSum);
  });

  it('agree on a two-account archive too', async () => {
    const terminal = await ingestExport(post, buildNewDataTwoAccountExport(), 'two.zip');
    if (terminal.type !== 'done') throw new Error('expected done');
    const wows = await askWows();
    const wowsSum = WOWS_CARD_IDS.reduce((sum, id) => sum + readyRows(wows.cards[id]), 0);
    expect(terminal.result.newDataPanes!['warships-storage']!.rowCount).toBe(wowsSum);
  });
});

describe('the memo', () => {
  it('returns deep-equal views for two queries in a row, and a replace import invalidates it', async () => {
    await ingestExport(post, buildNewDataFilesExport(), 'first.zip');
    const first = await ask(WOWS_QUERY);
    const again = await ask(WOWS_QUERY);
    expect(again.importedAt).toBe(first.importedAt);
    expect(again.view).toEqual(first.view);

    // A different archive: the second import must not be answered from the first.
    const key = 'wows_crews.csv';
    await ingestExport(
      post,
      buildNewDataFilesExport({ [key]: buildLargeTableCsv(key, 5) }),
      'second.zip',
    );
    const second = await ask(WOWS_QUERY);
    expect(second.importedAt).not.toBe(first.importedAt);
    expect(ready((second.view as WarshipsStorageView).cards.crews).rowCount).toBe(5);
  });
});
