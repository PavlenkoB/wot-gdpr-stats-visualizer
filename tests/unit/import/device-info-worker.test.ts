import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDeviceInfo } from '../../../src/lib/features/device-info/device-info-aggregate.ts';
import {
  ASSISTANT_STORED_HEADERS,
  DEVICE_ROW_STATE_KEY,
  DEVICE_ROW_UNREADABLE,
} from '../../../src/lib/features/device-info/device-info-shared.ts';
import type { DeviceInfoView } from '../../../src/lib/features/device-info/device-info-shared.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import { isDataQuery } from '../../../src/lib/worker/data-queries.ts';
import {
  SAMPLE_EXPECTED_COUNTS,
  SAMPLE_UNKNOWN_FOLDER,
  buildCustomExport,
  buildSampleExport,
} from '../../fixtures/export-fixtures.ts';
import {
  buildDivergentHeaderTwoAccountExport,
  MA_DIVERGENT_CANONICAL_ROOT,
  MA_DIVERGENT_OS_CANONICAL,
  MA_DIVERGENT_OS_RENAMED,
  MA_DIVERGENT_RENAMED_ROOT,
} from '../../fixtures/multi-account-fixtures.ts';
import {
  DEVICE_ASSISTANT_CSV,
  DEVICE_ASSISTANT_HEADER_ONLY_CSV,
  DEVICE_BLITZ_CSV,
  DEVICE_BLOBS,
  DEVICE_FILE_NAMES,
  DEVICE_FLAGS_CANARY,
  DEVICE_INFO_COUNTS,
  DEVICE_PC_CSV,
  DEVICE_SPA_CANARY,
} from '../../fixtures/device-info-fixtures.ts';
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
import type { DataQuery, IngestResponse } from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// Quick 261012-bog Task 1 (tracer) — Device_info through the real worker
// =============================================================================
//
// One real-named file set is carried through every layer the data path has:
// parse, the import-time strip at the row choke point, Dexie, the data-query
// channel, the pure builder and the posted view. The expected view is computed
// IN THE TEST by running the pure builder over the fixtures' own parsed rows, so
// a wiring bug and a builder change both fail it.
//
// The wait ceiling is short on purpose so a pre-implementation RED fails fast.
// =============================================================================

const RED_TIMEOUT_MS = 1_500;

/** The account a single-account export stamps its rows with (09-07). */
const SAMPLE_ACCOUNT = '500000001';

const DEVICE_QUERY: DataQuery = { channel: 'device-info' };

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

function parsed(text: string, sourceFile: string): Record<string, string | undefined>[] {
  return parseCsvFile(text, 'Device_info', sourceFile).rows.map((r) => r.data);
}

/** One account's rows, as the grouped shape the builder now takes (09-07). */
function oneAccount(
  text: string,
  sourceFile: string,
): { groups: { account: string; rows: Record<string, string | undefined>[] }[]; seen: true } {
  return { groups: [{ account: SAMPLE_ACCOUNT, rows: parsed(text, sourceFile) }], seen: true };
}

/**
 * The view the pure builder gives over the fixtures' own parsed rows.
 *
 * One account, one group — the sample export is single-account, so this is the
 * shape the reader hands over for it and the answer must be byte-identical to
 * what it was before the grouping (09-07).
 */
function expectedView(): DeviceInfoView {
  return buildDeviceInfo({
    pc: oneAccount(DEVICE_PC_CSV, DEVICE_FILE_NAMES.pc),
    blitz: oneAccount(DEVICE_BLITZ_CSV, DEVICE_FILE_NAMES.blitz),
    assistant: oneAccount(DEVICE_ASSISTANT_CSV, DEVICE_FILE_NAMES.assistant),
  });
}

async function ask(queryId: number): Promise<{ importedAt: string | null; view: DeviceInfoView }> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId, query: DEVICE_QUERY });
  const reply = await waitForMessage(post, 'data-result', RED_TIMEOUT_MS);
  if (reply.type !== 'data-result') throw new Error('expected data-result');
  if (reply.result === null) throw new Error('expected a result');
  expect(reply.result.channel).toBe('device-info');
  return { importedAt: reply.importedAt, view: reply.result.view as DeviceInfoView };
}

/** Ask a non-device channel through the same harness. */
async function askChannel(query: DataQuery): Promise<unknown> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId: 41, query });
  const reply = await waitForMessage(post, 'data-result', RED_TIMEOUT_MS);
  if (reply.type !== 'data-result') throw new Error('expected data-result');
  if (reply.result === null) throw new Error('expected a result');
  return reply.result.view;
}

describe('261012-bog tracer: Device_info through the real worker and Dexie snapshot', () => {
  it('imports as supported and answers the hand-derived device-info view', async () => {
    const terminal = await ingestExport(post, buildSampleExport(), 'sample.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') throw new Error('expected done');

    // The import counts: six supported, Device_info among them.
    expect(terminal.result.counts).toEqual(SAMPLE_EXPECTED_COUNTS);
    expect(terminal.result.counts.supported).toBe(6);
    expect(terminal.result.counts.unknown).toBe(1);
    const entry = terminal.result.categories.find((c) => c.name === 'Device_info');
    expect(entry?.status).toBe('supported');
    expect(entry?.fileCount).toBe(3);
    expect(entry?.rowCount).toBe(DEVICE_INFO_COUNTS.total);
    // Not in the unsupported list.
    const unsupported = terminal.result.categories
      .filter((c) => c.status !== 'supported')
      .map((c) => c.name);
    expect(unsupported).not.toContain('Device_info');

    const answer = await ask(11);
    expect(answer.importedAt).toBe(terminal.result.importedAt);
    expect(answer.view).toEqual(expectedView());

    expect(answer.view.status).toBe('ready');
    expect(answer.view.pc.status).toBe('ready');
    expect(answer.view.blitz.status).toBe('ready');
    expect(answer.view.assistant.status).toBe('ready');
    if (answer.view.assistant.status !== 'ready') throw new Error('assistant not ready');
    expect(answer.view.assistant.rows).toHaveLength(4);
    expect(answer.view.assistant.unreadable).toBe(DEVICE_INFO_COUNTS.unreadable);
    expect(answer.view.assistant.unreadable).toBe(4);
  });

  it('answers importedAt null and result null with no dataset imported', async () => {
    postRequest({ type: 'data-query', queryId: 1, query: DEVICE_QUERY });
    const reply = await waitForMessage(post, 'data-result', RED_TIMEOUT_MS);
    if (reply.type !== 'data-result') throw new Error('expected data-result');
    expect(reply.importedAt).toBeNull();
    expect(reply.result).toBeNull();
  });
});

describe('261012-bog canary: the raw Assistant blob is never stored or posted', () => {
  it('stores only the four extracted fields or the unreadable marker per Assistant row', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const { db } = await importWorkerDb();

    const stored = await db.rows
      .where('sourceFile')
      .equals(DEVICE_FILE_NAMES.assistant)
      .sortBy('rowIndex');
    expect(stored).toHaveLength(DEVICE_BLOBS.length);

    const allowed = new Set<string>([
      ASSISTANT_STORED_HEADERS.deviceType,
      ASSISTANT_STORED_HEADERS.app,
      ASSISTANT_STORED_HEADERS.platform,
      ASSISTANT_STORED_HEADERS.version,
    ]);
    stored.forEach((row, i) => {
      const keys = Object.keys(row.data);
      const expected = DEVICE_BLOBS[i]!.expected;
      if (expected === null) {
        // The explicit unreadable marker, nothing else.
        expect(row.data).toEqual({ [DEVICE_ROW_STATE_KEY]: DEVICE_ROW_UNREADABLE });
      } else {
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) expect(allowed.has(key), `stored key ${key}`).toBe(true);
        expect(row.data[ASSISTANT_STORED_HEADERS.deviceType]).toBe(expected[0]);
        expect(row.data[ASSISTANT_STORED_HEADERS.app]).toBe(expected[1]);
        expect(row.data[ASSISTANT_STORED_HEADERS.platform]).toBe(expected[2]);
        expect(row.data[ASSISTANT_STORED_HEADERS.version]).toBe(expected[3]);
      }
    });
  });

  it('keeps both canaries, the key POST and the text Spa id out of every stored row and the posted view', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const { db } = await importWorkerDb();

    const everyRow = await db.rows.toArray();
    expect(everyRow.length).toBeGreaterThan(0);
    for (const row of everyRow) {
      for (const key of Object.keys(row.data)) expect(key.trim().toUpperCase()).not.toBe('POST');
    }
    const storedText = JSON.stringify(everyRow);
    expect(storedText).not.toContain(DEVICE_SPA_CANARY);
    expect(storedText).not.toContain(DEVICE_FLAGS_CANARY);
    expect(storedText).not.toContain('Spa id');
    expect(storedText).not.toContain('PC configuration');

    const meta = await db.meta.get('active');
    const metaText = JSON.stringify(meta);
    expect(metaText).not.toContain(DEVICE_SPA_CANARY);
    expect(metaText).not.toContain(DEVICE_FLAGS_CANARY);

    const viewText = JSON.stringify((await ask(12)).view);
    expect(viewText).not.toContain(DEVICE_SPA_CANARY);
    expect(viewText).not.toContain(DEVICE_FLAGS_CANARY);
    expect(viewText).not.toContain('POST');
    expect(viewText).not.toContain('Spa id');
  });
});

describe('261012-bog absent versus empty', () => {
  it('omitting one file gives not-in-export for that table only', async () => {
    await ingestExport(
      post,
      buildCustomExport({ omitFiles: [`Device_info/${DEVICE_FILE_NAMES.blitz}`] }),
      'no-blitz.zip',
    );
    const { view } = await ask(21);
    expect(view.blitz).toEqual({ status: 'not-in-export' });
    expect(view.pc.status).toBe('ready');
    expect(view.assistant.status).toBe('ready');
  });

  it('a header-only Assistant file is no-rows', async () => {
    await ingestExport(
      post,
      buildCustomExport({
        overrides: {
          [`Device_info/${DEVICE_FILE_NAMES.assistant}`]: DEVICE_ASSISTANT_HEADER_ONLY_CSV,
        },
      }),
      'header-only.zip',
    );
    const { view } = await ask(22);
    expect(view.assistant).toEqual({ status: 'no-rows' });
    expect(view.pc.status).toBe('ready');
  });

  it('omitting the whole folder gives three not-in-export tables', async () => {
    await ingestExport(post, buildCustomExport({ omitFolders: ['Device_info'] }), 'no-folder.zip');
    const { view } = await ask(23);
    expect(view.status).toBe('ready');
    expect(view.pc).toEqual({ status: 'not-in-export' });
    expect(view.blitz).toEqual({ status: 'not-in-export' });
    expect(view.assistant).toEqual({ status: 'not-in-export' });
  });

  it('a legacy snapshot (no presence list, raw POST rows) answers ready with no canary', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const { db } = await importWorkerDb();

    // Rewrite the dataset the way a cache from before this change holds it: the
    // raw POST cell in every Assistant row and no presence list at all.
    const stored = await db.rows
      .where('sourceFile')
      .equals(DEVICE_FILE_NAMES.assistant)
      .sortBy('rowIndex');
    // `rowIndex` runs across a category's files, so the position in the sorted
    // list (file order) is what pairs a stored row with its blob.
    for (const [i, row] of stored.entries()) {
      await db.rows.update(row.id!, { data: { POST: DEVICE_BLOBS[i]!.blob } });
    }
    await db.meta.update('active', { files: null });
    const legacyRows = await db.rows
      .where('sourceFile')
      .equals(DEVICE_FILE_NAMES.assistant)
      .toArray();
    expect(JSON.stringify(legacyRows)).toContain(DEVICE_SPA_CANARY);

    const { view } = await ask(24);
    expect(view.assistant.status).toBe('ready');
    if (view.assistant.status !== 'ready') throw new Error('assistant not ready');
    expect(view).toEqual(expectedView());
    expect(view.assistant.rows).toHaveLength(4);
    const text = JSON.stringify(view);
    expect(text).not.toContain(DEVICE_SPA_CANARY);
    expect(text).not.toContain(DEVICE_FLAGS_CANARY);
    expect(text).not.toContain('POST');
  });
});

describe('261012-bog validation and replay', () => {
  it('isDataQuery accepts the device-info channel and rejects a smuggled title', () => {
    expect(isDataQuery({ channel: 'device-info' })).toBe(true);
    expect(isDataQuery({ channel: 'device-info', title: 'wot' })).toBe(false);
    expect(isDataQuery({ channel: 'device-info', battleType: null })).toBe(false);
  });

  it('a cache-status replay lists Device_info as supported', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    post.mockClear();
    postRequest({ type: 'check-cache', jobId: 9 });
    const status = (await waitForMessage(post, 'cache-status', RED_TIMEOUT_MS)) as Extract<
      IngestResponse,
      { type: 'cache-status' }
    >;
    const byName = new Map(status.cached!.categories.map((c) => [c.name, c.status]));
    expect(byName.get('Device_info')).toBe('supported');
    expect(byName.get(SAMPLE_UNKNOWN_FOLDER)).toBe('unknown');
  });
});

// =============================================================================
// 09-07 tracer (CR-01) — a DIVERGENT per-account header
// =============================================================================
//
// `buildDivergentHeaderTwoAccountExport` writes the same three file NAMES under
// two roots, and the two copies of each file carry DIFFERENT headers: the first
// root writes `OS` as `OPERATING_SYSTEM`, `VEHICLE_NAME` as `VEHICLE_ID` and
// `AMOUNT` as `AMOUNT_VALUE`, while the second root writes the canonical
// spellings.
//
// The renamed root's file is stored FIRST, so a reader that resolved columns
// from the merged bucket's first row resolved the RENAMED header and reported
// the second account's values as absent — while its file was plainly in the
// archive. That is CR-01, and it is a false statement about the user's own data
// (DATA-04), not a rendering nicety.
//
// These cases are driven through the real worker and Dexie rather than at the
// builder, because the defect was invisible at the builder: a builder handed one
// account's rows resolves its columns correctly. It is the SEAM that lost the
// other account.
// =============================================================================

describe('09-07 CR-01: two accounts whose same-named files disagree on a header', () => {
  it('shows the second account own values, not the first account header keys', async () => {
    const terminal = await ingestExport(
      post,
      buildDivergentHeaderTwoAccountExport(),
      'divergent.zip',
    );
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') throw new Error('expected done');
    // Two accounts, or the fixture is not testing what its name says.
    expect(terminal.result.accounts).toHaveLength(2);

    const { view } = await ask(31);
    expect(view.pc.status).toBe('ready');
    if (view.pc.status !== 'ready') throw new Error('pc not ready');

    // The second account's `OS` cell, which the posted view must carry. On the
    // pre-change reader the canonical root's rows were read through the renamed
    // root's keys, so this was `null` for BOTH rows.
    const osIndex = view.pc.columns.indexOf('os');
    const osCells = view.pc.rows.map((row) => row[osIndex]);
    expect(osCells).toContain(MA_DIVERGENT_OS_CANONICAL);
    expect(osCells).not.toContain(MA_DIVERGENT_OS_RENAMED);

    // And the account that DID rename the column is reported honestly: its own
    // header declares no column the app reads, so its cell is `null` rather
    // than the other account's value read through the wrong key.
    const renamedRows = view.pc.rows.filter((_, i) => osCells[i] !== MA_DIVERGENT_OS_CANONICAL);
    expect(renamedRows).toHaveLength(1);
    expect(renamedRows[0]![osIndex]).toBeNull();

    // rowCount counts EVERY group's rows, so a per-group resolution never
    // drops a row off the table.
    expect(view.pc.rowCount).toBe(2);
    expect(view.pc.rows).toHaveLength(2);
  });

  it('carries the second account vehicles and currency through the real channels too', async () => {
    await ingestExport(post, buildDivergentHeaderTwoAccountExport(), 'divergent.zip');

    const vehicles = (await askChannel({
      channel: 'vehicles',
      title: 'wot',
      battleType: null,
    })) as {
      rows: { id: string; battles: number | null }[];
    };
    // Both accounts' rows, and NEITHER of them blanked by the other's header.
    const ids = vehicles.rows.map((row) => row.id);
    expect(ids).not.toContain('');
    expect(ids).toContain('SynthDivergentTank-Canonical');
    expect(ids).toContain('SynthDivergentTank-Renamed');
    expect(vehicles.rows.every((row) => row.battles === 100)).toBe(true);

    const currency = (await askChannel({ channel: 'currency' })) as {
      status: string;
      excluded: number;
      charts: { code: string; inUnits: string }[];
      others: { code: string; inUnits: string }[];
    };
    expect(currency.status).toBe('ready');
    const crystal = [...currency.charts, ...currency.others].filter(
      (entry) => entry.code === 'ru.wot.crystal',
    );
    // The canonical account's amount survived its own `AMOUNT` key. On the
    // pre-change reader the renamed root's first row resolved `AMOUNT` to null
    // and BOTH operations were excluded, so the currency answered `no-usable`.
    expect(crystal, 'the shared currency is answered').toHaveLength(1);
    expect(BigInt(crystal[0]!.inUnits)).toBeGreaterThanOrEqual(BigInt('4000000'));
  });

  it('the reader returns one group per account, each carrying its own first-row keys', async () => {
    await ingestExport(post, buildDivergentHeaderTwoAccountExport(), 'divergent.zip');
    const { readRowsByFile } = await importWorkerDb();

    const snapshot = await readRowsByFile(new Set(['wot_device_info.csv']), ['device_info']);
    expect(snapshot).not.toBeNull();
    if (snapshot === null) return;

    const groups = snapshot!.rows.get('wot_device_info.csv');
    // TWO groups for one file name — the merged single array is the defect.
    expect(groups).toHaveLength(2);
    // In first-seen account order, and each group's first row carries its OWN
    // header key rather than the other account's.
    expect(groups!.map((group) => group.account)).toEqual([
      MA_DIVERGENT_RENAMED_ROOT,
      MA_DIVERGENT_CANONICAL_ROOT,
    ]);
    expect(Object.keys(groups![0]!.rows[0]!)).toContain('OPERATING_SYSTEM');
    expect(Object.keys(groups![1]!.rows[0]!)).toContain('OS');
    expect(groups![1]!.rows[0]!.OS).toBe(MA_DIVERGENT_OS_CANONICAL);
  });
});
