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
  buildCustomExport,
  buildSampleExport,
  SAMPLE_EXPECTED_COUNTS,
} from '../../fixtures/export-fixtures.ts';
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

/** The view the pure builder gives over the fixtures' own parsed rows. */
function expectedView(): DeviceInfoView {
  return buildDeviceInfo({
    pc: { rows: parsed(DEVICE_PC_CSV, DEVICE_FILE_NAMES.pc), seen: true },
    blitz: { rows: parsed(DEVICE_BLITZ_CSV, DEVICE_FILE_NAMES.blitz), seen: true },
    assistant: { rows: parsed(DEVICE_ASSISTANT_CSV, DEVICE_FILE_NAMES.assistant), seen: true },
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
    expect(byName.get('Bans')).toBe('unknown');
  });
});
