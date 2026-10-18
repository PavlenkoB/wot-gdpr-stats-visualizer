import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  MULTIROW_DECOY_NICKNAME,
  MULTIROW_DECOY_REGION,
  MULTIROW_MATCH_NICKNAME,
  MULTIROW_MATCH_REGION,
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_BADGE_ORDER,
  SAMPLE_BIRTH_DATE,
  SAMPLE_CREATED_AT,
  SAMPLE_CREATED_DATE,
  SAMPLE_IP,
  SAMPLE_LOGIN,
  SAMPLE_LOGIN_DOMAIN,
  SAMPLE_NICKNAME,
  SAMPLE_REGION,
  LONG_NICKNAME,
  LONG_UNKNOWN_FOLDER,
  MALFORMED_ROW_EXPECTED_ROW_COUNT,
  MALFORMED_BANS_CSV,
  MALFORMED_ROW_EXPECTED_SKIPPED_COUNT,
  RAGGED_OVERFLOW_MARKER,
  SAMPLE_ROW_COUNTS,
  VARIANT_CREATED_AT,
  VARIANT_NICKNAME,
  VARIANT_OVERFLOW_CANARY,
  VARIANT_REGION,
  buildAccountInfoVariantExport,
  buildAmbiguousRootExport,
  buildBeyondBoundNestExport,
  buildCaseVariantFoldersExport,
  buildEmptyAccountInfoExport,
  buildLargeExport,
  buildLowercaseUserInfoFolderExport,
  buildMalformedRowsExport,
  buildMissingPaymentHistoryExport,
  buildMissingUserInfoExport,
  buildMultiRowAccountInfoExport,
  buildOnlySupportedExport,
  buildLongTextExport,
  buildMisfiledAccountInfoExport,
  buildOversizedEntryExport,
  buildCustomExport,
  buildSampleExport,
  buildZeroRowPaymentExport,
} from '../../fixtures/export-fixtures.ts';
import {
  PLATFORM_FALLBACK_SPEC,
  SCALE_60K_SPEC,
  SESSION_FIXTURE_IP,
  buildSessionsCsvFromRows,
  buildSessionsExport,
  buildSessionsExportFromCsv,
  type SessionsExpected,
} from '../../fixtures/sessions-fixtures.ts';
import {
  REAL_SHAPE_ALL,
  REAL_SHAPE_IP,
  REAL_SHAPE_WOT,
  REAL_SHAPE_WOT_ROWS,
  REAL_SHAPE_WOWS,
  buildHeaderOnlyRealShapeExport,
  buildRealShapeCsv,
  buildRealShapeExport,
  buildTwoGameExport,
  type RealShapeSlice,
} from '../../fixtures/playtime-real-shape-fixture.ts';
import {
  DURATION_BIN_COUNT,
  HOUR_CELL_COUNT,
  HOUR_GRID_BASIS,
} from '../../../src/lib/features/playtime/playtime-shared.ts';
import {
  buildCalendarModel,
  buildDurationRows,
  buildHourGridModel,
} from '../../../src/lib/features/playtime/playtime-model.ts';
import type {
  IngestRequest,
  IngestResponse,
  PlaytimeSlice,
  WorkerScopeLike,
} from '../../../src/lib/core/types/worker-messages.ts';
import type { DatasetRow } from '../../../src/lib/worker/db.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import { MAX_ENTRY_BYTES } from '../../../src/lib/worker/inflate-bounds.ts';

/** The two worker replies the client bridge routes; both existed at RED. */
type PlaytimeResponse = Extract<IngestResponse, { type: 'playtime-result' | 'playtime-error' }>;

// =============================================================================
// ingest.worker.ts — full pipeline drive (02-01-PLAN Task 3, Test 5)
// =============================================================================
//
// Why this file exists (02-01-PLAN Task 3, Behavior Test 5, RED then GREEN):
//   The full pipeline (hash → cache-check → unzip → per-category parse →
//   mojibake fix → chunked Dexie write) can only be exercised end-to-end
//   against the worker module — unit-testing the helpers in isolation
//   would not catch a wiring regression (e.g. a missing `await` between
//   hash and cache-check, or a wrong jobId in the 'duplicate' response).
//
// The harness drives ingest.worker.ts directly via a mocked `self`:
//   1. BEFORE the dynamic import, install
//      `globalThis.self = { postMessage: vi.fn(), onmessage: null }`.
//   2. Dynamic-import the worker module. Its module-level code sets
//      `self.onmessage = ...` and posts `{ type: 'ready' }`.
//   3. Capture the wired `self.onmessage` and invoke it with a fake
//      `MessageEvent`-shaped object carrying the IngestRequest.
//   4. Poll the postMessage spy until a terminal response (done /
//      duplicate / error) is observed, with a timeout.
//
// The two testable invariants per the plan's Behavior block:
//   (a) The FIRST 'ingest' message for the sample export posts 'done'
//       with every category's rowCount matching its actual parsed
//       row total, INCLUDING known-deferred and unknown categories
//       (D-01).
//   (b) A SECOND 'ingest' message carrying the identical file bytes
//       posts 'duplicate' WITHOUT ever posting a `stage: 'unzipping'`
//       message for that second call (SC3 — skipped before any unzip
//       or parse work starts).
//
// Each test uses a fresh module load (vi.resetModules + deleted
// IndexedDB) so the worker's `db` singleton starts with an empty
// meta table, but the two scenarios within a single test share a
// module load so the FIRST scenario's writeDataset populates the
// cache the SECOND scenario's hash-check reads back.
// =============================================================================

/**
 * Wait for a terminal response (done | duplicate | error) to be posted.
 * Polls the spy every 5 ms with a 10 s ceiling. Resolves with the
 * response; throws if the ceiling elapses.
 */
async function waitForTerminal(
  spy: ReturnType<typeof vi.fn>,
  timeoutMs = 10_000,
): Promise<IngestResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse;
      if (msg && (msg.type === 'done' || msg.type === 'duplicate' || msg.type === 'error')) {
        return msg;
      }
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(
    `waitForTerminal: timed out after ${timeoutMs} ms. Calls so far: ${JSON.stringify(
      spy.mock.calls.map((c) => (c[0] as IngestResponse).type ?? 'no-type'),
    )}`,
  );
}

/**
 * Delete the IndexedDB database that db.ts uses. Resolves whether the
 * delete succeeded, errored, or was blocked (a blocked delete usually
 * means another tab is holding the connection — in this single-process
 * test it is safe to proceed).
 */
async function deleteActiveDatabase(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('wg-export-viewer');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function makeFileFromBytes(bytes: Uint8Array, name: string): File {
  // File's `BlobPart` type wants `ArrayBuffer` (not `SharedArrayBuffer`);
  // the bytes are our own buffer from `zipSync`/`TextEncoder`, so the
  // cast is sound.
  return new File([bytes as BlobPart], name, { type: 'application/zip' });
}

// =============================================================================
// 03-01 Task 1 — identity extraction, the D-18 strip and the meta replay
// =============================================================================
//
// Why these three tests exist (03-01-PLAN Task 1, behavior block):
//   D-18 says LOGIN / BIRTH_DATE / BIRTH_DATE_SRC never reach IndexedDB, and
//   D-20 says the three-field identity rides on the meta record so the
//   return visit never needs a row query. Both are privacy guarantees that
//   only hold if the WORKER is where they are enforced, so they are proven
//   by driving the real worker and then reading the Dexie singleton it wrote.
//
//   (identity)  the posted 'done' result carries exactly the three identity
//               fields for the sample's Account_Info row (D-17/D-20).
//   (no-leak)   nothing sensitive rests in IndexedDB, while the IP column
//               is still stored (D-18 keeps IP/city/country).
//   (replay)    'cache-status' and 'duplicate' replay the identity straight
//               off the meta record (D-20) — the two replay paths must not
//               be allowed to diverge from the 'done' path.
//
// The literal identity below is deliberately duplicated from the fixture
// file: Task 2 swaps it for the exported `SAMPLE_*` fixture constants. Until
// then a fixture change surfaces here first, which is the point.
// =============================================================================

/**
 * The identity the sample export's Account_Info row must yield (D-17).
 * Built from the exported fixture constants (03-01 Task 2) so a fixture
 * change surfaces here first instead of being mirrored as a literal.
 */
const EXPECTED_SAMPLE_IDENTITY = {
  nickname: SAMPLE_NICKNAME,
  region: SAMPLE_REGION,
  createdAt: SAMPLE_CREATED_AT,
} as const;

/**
 * D-18 deny-list, restated here so the leak assertion does not depend on the
 * implementation's own regex: any key whose trimmed, upper-cased form is
 * LOGIN / BIRTH_DATE / BIRTH_DATE_SRC (optionally with Papa's `_N` duplicate
 * suffix) is a leak.
 */
const SENSITIVE_KEY = /^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/;

/** Values that must not appear anywhere in the persisted dataset. */
const SAMPLE_EMAIL_DOMAIN = SAMPLE_LOGIN_DOMAIN;
const SAMPLE_BIRTH_DATE_VALUE = SAMPLE_BIRTH_DATE;

/**
 * Wait for the first posted message of a given `type`. `waitForTerminal`
 * cannot serve the replay test: 'cache-status' is deliberately not a
 * terminal type, so polling for it there would hang.
 */
async function waitForMessageOfType(
  spy: ReturnType<typeof vi.fn>,
  type: IngestResponse['type'],
  timeoutMs = 10_000,
): Promise<IngestResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse;
      if (msg && msg.type === type) return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(
    `waitForMessageOfType('${type}'): timed out after ${timeoutMs} ms. Calls so far: ${JSON.stringify(
      spy.mock.calls.map((c) => (c[0] as IngestResponse).type ?? 'no-type'),
    )}`,
  );
}

/**
 * Ingest one export through a freshly-loaded worker module and return its
 * terminal response. Module scope (rather than a per-describe closure) so
 * the 03-01 describes that each bring their own `postSpy` can share it.
 *
 * `timeoutMs` is the terminal-message ceiling, forwarded to `waitForTerminal`.
 * It exists for plan 04-12, whose 60,000-session tracer writes more than
 * 70,000 rows into fake-indexeddb and legitimately needs longer than the
 * 10 s default — a scale test that timed out would look like a product
 * failure when it is only a slow in-memory index. Every existing caller is
 * left untouched by the default.
 */
async function ingestWith(
  spy: ReturnType<typeof vi.fn>,
  bytes: Uint8Array,
  name: string,
  timeoutMs = 10_000,
) {
  await import('../../../src/lib/worker/ingest.worker.ts');
  const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
  spy.mockClear();
  onmessage!({
    data: { type: 'ingest', jobId: 21, file: makeFileFromBytes(bytes, name) } as IngestRequest,
  } as MessageEvent<IngestRequest>);
  return waitForTerminal(spy, timeoutMs);
}

/**
 * Import the worker's Dexie singleton. Called AFTER the worker module has
 * been imported so the dynamic import resolves to the very module
 * registration `vi.resetModules()` created for this test — the two share
 * one `db` instance, which is the whole point of the no-leak assertions.
 */
async function importWorkerDb() {
  return import('../../../src/lib/worker/db.ts');
}

describe('ingest.worker.ts — end-to-end drive via mocked self', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    // Capture the host's `self` (if any) so afterEach can restore it.
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    // Reset modules so a fresh db singleton is created per test.
    vi.resetModules();
    // Delete any persisted Dexie database from a prior test.
    await deleteActiveDatabase();
    // Install a fresh postMessage spy on `self` BEFORE the worker
    // module loads. The worker captures `self` at module-init time.
    // The postSpy is typed as Mock (vitest's internal) and assigned
    // to a structural slot expecting `(message: IngestResponse) => void`,
    // so the `self` object is typed with a structural intersection that
    // accepts the mock — this keeps the call-site free of casts in
    // every test below.
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  test('(a) the first ingest of the sample posts "done" with row counts for every category (D-01)', async () => {
    await import('../../../src/lib/worker/ingest.worker.ts');
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');

    // The first spy call is the module-load 'ready' message.
    expect(postSpy).toHaveBeenCalled();
    const ready = postSpy.mock.calls[0]?.[0] as IngestResponse;
    expect(ready.type).toBe('ready');

    // Clear the spy so we observe only ingest-driven calls.
    postSpy.mockClear();

    const file = makeFileFromBytes(buildSampleExport(), 'sample.zip');
    const message: IngestRequest = { type: 'ingest', jobId: 1, file };
    onmessage!({ data: message } as MessageEvent<IngestRequest>);

    const terminal = await waitForTerminal(postSpy);
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    const { result } = terminal;
    expect(result.accountRoot).toBe(SAMPLE_ACCOUNT_ROOT);

    // Every category from the sample has a rowCount > 0 (D-01: parse
    // every category, not just 'supported').
    for (const entry of result.categories) {
      expect(entry.rowCount, `category ${entry.name} rowCount`).toBeGreaterThan(0);
      // The row count per category matches the SAMPLE_ROW_COUNTS
      // contract, which is DERIVED from the fixture modules rather than
      // typed (05-06): the sample's row totals follow the data.
      expect(entry.rowCount).toBe(SAMPLE_ROW_COUNTS[entry.name]);
    }

    // Every category type ('supported', 'known-deferred', 'unknown')
    // is represented — the parse scope is universal, not filtered.
    const statuses = new Set(result.categories.map((c) => c.status));
    expect(statuses.has('supported')).toBe(true);
    expect(statuses.has('known-deferred')).toBe(true);
    expect(statuses.has('unknown')).toBe(true);
  });

  test('(a-real-shape) the sample imports the real-shaped Phase 5 folders with exact file and row counts and NOTHING is skipped (05-06)', async () => {
    await import('../../../src/lib/worker/ingest.worker.ts');
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    postSpy.mockClear();

    const file = makeFileFromBytes(buildSampleExport(), 'sample.zip');
    onmessage!({
      data: { type: 'ingest', jobId: 1, file } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const terminal = await waitForTerminal(postSpy);
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // The LITERALS are the point of this test, and they are what makes it a
    // tracer rather than a tautology: the same numbers are recomputed from
    // the fixture modules by `SAMPLE_FILE_COUNTS` / `SAMPLE_ROW_COUNTS`
    // (asserted above and in classify.test.ts), so a fixture that grows a
    // file or a row has to change BOTH sides or this fails.
    //
    //   Player_statistics — 05-02's nineteen real-named files, 47 rows
    //   Financial_data    — 05-01's premium (18) + currency (125) rows
    //   Payment_history   — 05-01's 16-row hand Orders file
    const expected = {
      Player_statistics: { fileCount: 19, rowCount: 47 },
      Financial_data: { fileCount: 2, rowCount: 143 },
      Payment_history: { fileCount: 1, rowCount: 16 },
    } as const;

    for (const [name, counts] of Object.entries(expected)) {
      const entry = terminal.result.categories.find((c) => c.name === name);
      expect(entry, `category ${name} present`).toBeDefined();
      expect(entry!.fileCount, `${name} fileCount`).toBe(counts.fileCount);
      expect(entry!.rowCount, `${name} rowCount`).toBe(counts.rowCount);
    }

    // The quote-all / bare-CR physical shape the real export writes is the
    // thing the Phase 2 parser has to survive: a row the parser could not
    // read would land here as a skip, so a clean import of all 29 sample
    // files is the proof the real shape goes through unchanged.
    for (const entry of terminal.result.categories) {
      expect(entry.skippedRowCount, `category ${entry.name} skippedRowCount`).toBe(0);
    }
  });

  test('(b) a second ingest of identical bytes posts "duplicate" and NEVER posts stage: "unzipping" (SC3)', async () => {
    await import('../../../src/lib/worker/ingest.worker.ts');
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');

    postSpy.mockClear();

    const sampleBytes = buildSampleExport();
    const fileA = makeFileFromBytes(sampleBytes, 'sample.zip');
    onmessage!({
      data: { type: 'ingest', jobId: 1, file: fileA } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const firstTerminal = await waitForTerminal(postSpy);
    expect(firstTerminal.type).toBe('done');

    // Reset the spy so the second ingest's calls are isolated.
    postSpy.mockClear();

    const fileB = makeFileFromBytes(sampleBytes, 'sample-again.zip');
    onmessage!({
      data: { type: 'ingest', jobId: 2, file: fileB } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const secondTerminal = await waitForTerminal(postSpy);
    expect(secondTerminal.type).toBe('duplicate');
    if (secondTerminal.type !== 'duplicate') return;

    // SC3: the 'unzipping' stage must NEVER have been posted for the
    // second ingest — the hash check must short-circuit before any
    // unzip or parse work starts.
    const stageCalls = postSpy.mock.calls
      .map((c) => c[0] as IngestResponse)
      .filter((m) => m && m.type === 'stage' && m.stage === 'unzipping');
    expect(stageCalls).toEqual([]);

    // The duplicate response carries the same categories the first
    // ingest produced — so the results view can render underneath the
    // duplicate banner without any new work.
    if (firstTerminal.type === 'done') {
      expect(secondTerminal.result.categories).toEqual(firstTerminal.result.categories);
      expect(secondTerminal.result.accountRoot).toBe(firstTerminal.result.accountRoot);
    }
  });

  // ===========================================================================
  // 03-01 Task 1 — (identity) D-17/D-20: the done result carries the identity
  // ===========================================================================

  test('(identity) the done result carries exactly nickname, region and createdAt for the sample (D-17, D-20)', async () => {
    await import('../../../src/lib/worker/ingest.worker.ts');
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    postSpy.mockClear();

    const file = makeFileFromBytes(buildSampleExport(), 'identity.zip');
    onmessage!({
      data: { type: 'ingest', jobId: 7, file } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const terminal = await waitForTerminal(postSpy);
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // The three fields, and NOTHING else: the identity object is the only
    // thing allowed to cross to the main thread, so a fourth key would be a
    // leak of the very columns D-18 strips.
    expect(terminal.result.identity).toEqual(EXPECTED_SAMPLE_IDENTITY);
    expect(Object.keys(terminal.result.identity ?? {}).sort()).toEqual([
      'createdAt',
      'nickname',
      'region',
    ]);
  });

  // ===========================================================================
  // 03-01 Task 1 — (no-leak) D-18: nothing sensitive rests in IndexedDB
  // ===========================================================================

  test('(no-leak) no persisted row or meta record carries LOGIN, birth data or Papa overflow cells (D-18)', async () => {
    await import('../../../src/lib/worker/ingest.worker.ts');
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    postSpy.mockClear();

    const file = makeFileFromBytes(buildSampleExport(), 'no-leak.zip');
    onmessage!({
      data: { type: 'ingest', jobId: 8, file } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const terminal = await waitForTerminal(postSpy);
    expect(terminal.type).toBe('done');

    // Read the very Dexie singleton the worker wrote through.
    const { db } = await importWorkerDb();
    const allRows = await db.rows.toArray();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();

    const userInfoRows = allRows.filter((r) => r.category.toLowerCase() === 'user_info');
    expect(userInfoRows.length).toBeGreaterThan(0);

    // (1) No sensitive key and no overflow bucket on any User_Info row.
    for (const row of userInfoRows) {
      for (const key of Object.keys(row.data)) {
        expect(
          SENSITIVE_KEY.test(key.trim().toUpperCase()),
          `row key ${key} must not survive the D-18 strip`,
        ).toBe(false);
        expect(key, `overflow bucket ${key} must not survive`).not.toBe('__parsed_extra');
      }
    }

    // (2) Neither the email domain nor the birth date occurs anywhere in
    // the persisted payload — not as a value under a renamed key either.
    const dump = JSON.stringify({ rows: allRows, meta });
    expect(dump).not.toContain(SAMPLE_EMAIL_DOMAIN);
    expect(dump).not.toContain(SAMPLE_BIRTH_DATE_VALUE);

    // (3) Control: D-18 narrows User_Info for these three columns only —
    // IP / city / country are still stored.
    expect(userInfoRows[0]!.data['IP']).toBe(SAMPLE_IP);
  });

  // ===========================================================================
  // 03-01 Task 1 — (replay) D-20: cache-status and duplicate replay identity
  // ===========================================================================

  test('(replay) cache-status and duplicate both replay the identity off the meta record (D-20)', async () => {
    await import('../../../src/lib/worker/ingest.worker.ts');
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    postSpy.mockClear();

    const sampleBytes = buildSampleExport();
    onmessage!({
      data: {
        type: 'ingest',
        jobId: 11,
        file: makeFileFromBytes(sampleBytes, 'replay.zip'),
      } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const first = await waitForTerminal(postSpy);
    expect(first.type).toBe('done');
    if (first.type !== 'done') return;

    // Return visit: the app asks for the cache without a file. The
    // identity must come back with no row query at all (D-20).
    postSpy.mockClear();
    onmessage!({
      data: { type: 'check-cache', jobId: 12 } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const cacheStatus = await waitForMessageOfType(postSpy, 'cache-status');
    if (cacheStatus.type !== 'cache-status') return;
    expect(cacheStatus.cached).not.toBeNull();
    expect(cacheStatus.cached?.identity).toEqual(first.result.identity);

    // Re-dropping the same file: the dedup gate replays the same object.
    postSpy.mockClear();
    onmessage!({
      data: {
        type: 'ingest',
        jobId: 13,
        file: makeFileFromBytes(sampleBytes, 'replay-again.zip'),
      } as IngestRequest,
    } as MessageEvent<IngestRequest>);

    const duplicate = await waitForTerminal(postSpy);
    expect(duplicate.type).toBe('duplicate');
    if (duplicate.type !== 'duplicate') return;
    expect(duplicate.result.identity).toEqual(first.result.identity);
    expect(duplicate.result.identity).toEqual(EXPECTED_SAMPLE_IDENTITY);
  });
});

// =============================================================================
// 03-01 Task 2 — the hostile-header and null-identity cases, through the worker
// =============================================================================
//
// The pure unit tests in identity.test.ts prove the helpers behave. These
// tests prove the WORKER calls them correctly, on exports whose column names
// and folder names are the shapes a real archive can have and that a naive
// strip would leak (RESEARCH Q3's probe table). Each is a separate `test`,
// matching the harness above: a fresh module and a fresh database per case,
// so no case can pass on state another left behind.
// =============================================================================

describe('03-01 — hostile User_Info shapes through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  /** Ingest one export and return its terminal response. */
  async function ingest(bytes: Uint8Array, name: string): Promise<IngestResponse> {
    return ingestWith(postSpy, bytes, name);
  }

  /** Every User_Info-family row currently persisted. */
  async function readUserInfoRows() {
    const { db } = await importWorkerDb();
    const all = await db.rows.toArray();
    return all.filter((r) => r.category.toLowerCase() === 'user_info');
  }

  test('padded, lower-case, duplicate and over-wide headers: nothing leaks and the identity still resolves', async () => {
    const terminal = await ingest(buildAccountInfoVariantExport(), 'variant.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // The strip survived padded (' NAME '), lower-case ('region'),
    // duplicated (LOGIN / LOGIN_1), padded-dropped ('BIRTH_DATE ') and
    // over-wide (a ninth cell) headers — and the identity still reads
    // through them, because it uses the same normalisation.
    expect(terminal.result.identity).toEqual({
      nickname: VARIANT_NICKNAME,
      region: VARIANT_REGION,
      createdAt: VARIANT_CREATED_AT,
    });

    const rows = await readUserInfoRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const key of Object.keys(row.data)) {
        expect(SENSITIVE_KEY.test(key.trim().toUpperCase()), `key ${key}`).toBe(false);
        expect(key).not.toBe('__parsed_extra');
      }
    }

    const { db } = await importWorkerDb();
    const dump = JSON.stringify({
      rows: await db.rows.toArray(),
      meta: await db.meta.get('active'),
    });
    expect(dump).not.toContain(VARIANT_OVERFLOW_CANARY);
    expect(dump).not.toContain(SAMPLE_EMAIL_DOMAIN);
    expect(dump).not.toContain(SAMPLE_BIRTH_DATE_VALUE);
    // Control: IP is still stored.
    expect(rows[0]!.data['IP']).toBe(SAMPLE_IP);
  });

  test('a user_info folder (lower case) is stripped exactly like User_Info', async () => {
    const terminal = await ingest(buildLowercaseUserInfoFolderExport(), 'lowercase.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    expect(terminal.result.identity).toEqual(EXPECTED_SAMPLE_IDENTITY);
    const rows = await readUserInfoRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const key of Object.keys(row.data)) {
        expect(SENSITIVE_KEY.test(key.trim().toUpperCase()), `key ${key}`).toBe(false);
      }
    }
  });

  test('User_Info and user_info side by side: two entries, both stripped', async () => {
    const terminal = await ingest(buildCaseVariantFoldersExport(), 'case-variants.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // classifyFolder is case-insensitive and preserves the raw name, so
    // both folders classify as supported and BOTH need the strip.
    const userInfoEntries = terminal.result.categories.filter(
      (c) => c.name.toLowerCase() === 'user_info',
    );
    expect(userInfoEntries).toHaveLength(2);

    const rows = await readUserInfoRows();
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      for (const key of Object.keys(row.data)) {
        expect(
          SENSITIVE_KEY.test(key.trim().toUpperCase()),
          `key ${key} in ${row.sourceFile}`,
        ).toBe(false);
        expect(key).not.toBe('__parsed_extra');
      }
    }
    const { db } = await importWorkerDb();
    expect(JSON.stringify(await db.rows.toArray())).not.toContain(SAMPLE_EMAIL_DOMAIN);
  });

  test('D-17: with a decoy row first, the account-root row is the one that is read', async () => {
    const terminal = await ingest(
      buildMultiRowAccountInfoExport({ matchingRow: true }),
      'multirow.zip',
    );
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    expect(terminal.result.identity).toEqual({
      nickname: MULTIROW_MATCH_NICKNAME,
      region: MULTIROW_MATCH_REGION,
      createdAt: expect.any(String),
    });
  });

  test('D-17 fallback: with no row matching the account root, row 1 is read', async () => {
    const terminal = await ingest(
      buildMultiRowAccountInfoExport({ matchingRow: false }),
      'multirow-nomatch.zip',
    );
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    expect(terminal.result.identity?.nickname).toBe(MULTIROW_DECOY_NICKNAME);
    expect(terminal.result.identity?.region).toBe(MULTIROW_DECOY_REGION);
  });

  test('no User_Info folder at all: identity is null (the D-16 fallback trigger)', async () => {
    const terminal = await ingest(buildMissingUserInfoExport(), 'no-user-info.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    expect(terminal.result.identity).toBeNull();
    expect(terminal.result.categories.some((c) => c.name.toLowerCase() === 'user_info')).toBe(
      false,
    );
  });

  test('a header-only Account_Info.csv: identity is null and User_Info rowCount is 0', async () => {
    const terminal = await ingest(buildEmptyAccountInfoExport(), 'empty-account-info.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    expect(terminal.result.identity).toBeNull();
    const entry = terminal.result.categories.find((c) => c.name.toLowerCase() === 'user_info');
    expect(entry).toBeDefined();
    expect(entry!.rowCount).toBe(0);
  });

  test('User_Info files with none of the identity columns: an object with three null slots', async () => {
    // The large fixture's User_Info CSVs carry PART_ID;VALUE — a category
    // present and parsed, but with no NAME/REGION/CREATED_AT anywhere. That
    // is an identity object with null fields, NOT the null identity.
    const terminal = await ingest(buildLargeExport(3), 'large-3.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    expect(terminal.result.identity).toEqual({ nickname: null, region: null, createdAt: null });
  });

  test('a missing Payment_history folder: no entry at all (DATA-04 absent)', async () => {
    const terminal = await ingest(buildMissingPaymentHistoryExport(), 'no-payment.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    expect(terminal.result.identity).toEqual(EXPECTED_SAMPLE_IDENTITY);
    expect(terminal.result.categories.some((c) => c.name.toLowerCase() === 'payment_history')).toBe(
      false,
    );
  });

  test('a Payment_history CSV holding only its header: present, with rowCount 0 (DATA-04 empty)', async () => {
    const terminal = await ingest(buildZeroRowPaymentExport(), 'empty-payment.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    const entry = terminal.result.categories.find(
      (c) => c.name.toLowerCase() === 'payment_history',
    );
    expect(entry).toBeDefined();
    expect(entry!.rowCount).toBe(0);
  });

  test('a supported-only export: no known-deferred or unknown category remains', async () => {
    const terminal = await ingest(buildOnlySupportedExport(), 'only-supported.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;
    // Six since quick 261012-bog added Device_info to SUPPORTED (five before
    // that, since 05-03 added Financial_data).
    expect(terminal.result.counts).toEqual({ supported: 6, 'known-deferred': 0, unknown: 0 });
    expect(terminal.result.identity).toEqual(EXPECTED_SAMPLE_IDENTITY);
  });

  test('long unbroken values survive parsing: a 70-char nickname and a long unknown folder name', async () => {
    const terminal = await ingest(buildLongTextExport(), 'long-text.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // The nickname is never truncated by the worker — the UI owns wrapping.
    expect(terminal.result.identity?.nickname).toBe(LONG_NICKNAME);
    expect(LONG_NICKNAME).toHaveLength(70);
    expect(LONG_NICKNAME).not.toMatch(/\s/);

    // The unknown folder keeps its raw name — including the literal
    // `<b>` characters, which is what makes the Playwright
    // "rendered as text, never as HTML" assertion observable. (A zip
    // entry name can never contain `/`, so the probe is an unterminated
    // tag rather than a `<b>bold</b>` pair.)
    const unknown = terminal.result.categories.filter((c) => c.status === 'unknown');
    expect(unknown.map((c) => c.name)).toContain(LONG_UNKNOWN_FOLDER);
    expect(LONG_UNKNOWN_FOLDER.length).toBeGreaterThanOrEqual(60);
    expect(LONG_UNKNOWN_FOLDER).not.toMatch(/\s/);
  });
});

describe('03-01 — the sample identity constants match the fixture file', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  const ingest = (bytes: Uint8Array, name: string) => ingestWith(postSpy, bytes, name);

  test('CREATED_AT is the date CREATED_DATE renders, and the strip denylist covers LOGIN', () => {
    expect(SAMPLE_CREATED_AT.slice(0, 10)).toBe(SAMPLE_CREATED_DATE);
    expect(SAMPLE_NICKNAME).not.toContain(SAMPLE_LOGIN_DOMAIN);
    expect(SAMPLE_IP).not.toContain(SAMPLE_LOGIN_DOMAIN);
  });

  test('buildCustomExport honours root, omitFolders and overrides independently', async () => {
    const renamed = buildCustomExport({ root: '987654321' });
    const onRenamed = await ingest(renamed, 'custom-root.zip');
    expect(onRenamed.type).toBe('done');
    if (onRenamed.type !== 'done') return;
    // `root` re-keys every path, so the detected account root follows it
    // and the identity row is no longer found by ID — the documented
    // row-1 fallback, which still reads the sample's Account_Info row.
    expect(onRenamed.result.accountRoot).toBe('987654321');
    expect(onRenamed.result.identity).toEqual(EXPECTED_SAMPLE_IDENTITY);

    // `omitFolders` matches the first path segment CASE-SENSITIVELY: the
    // sample spells the folder `User_Info`, so omitting the lower-case
    // `user_info` removes nothing at all and all eight categories remain.
    const omitted = buildCustomExport({ omitFolders: ['user_info'] });
    const onOmitted = await ingest(omitted, 'custom-omit.zip');
    expect(onOmitted.type).toBe('done');
    if (onOmitted.type !== 'done') return;
    const names = onOmitted.result.categories.map((c) => c.name.toLowerCase());
    expect(names).toContain('user_info');
    expect(names).toHaveLength(SAMPLE_BADGE_ORDER.length);

    // `overrides` can ADD a file in a folder the sample never had.
    const added = buildCustomExport({
      overrides: { 'Bans/Extra.csv': 'ID;REASON\n1;synthetic\n' },
    });
    const onAdded = await ingest(added, 'custom-override.zip');
    expect(onAdded.type).toBe('done');
    if (onAdded.type !== 'done') return;
    const bans = onAdded.result.categories.find((c) => c.name.toLowerCase() === 'bans');
    expect(bans?.fileCount).toBe(2);
  });
});

// =============================================================================
// 04-01 Task 1 — the playtime tracer: one Sessions.csv path from the import
// worker through Dexie to a playtime-query answer
// =============================================================================
//
// Why this describe exists (04-01-PLAN Task 1, behaviour block):
//   The phase's whole architecture rests on four seams, and every later plan
//   (04-02 … 04-13) builds on them. If any ONE of them is wrong, the cost is
//   reworking every stored bucket and every chart input:
//
//     1. Aggregation happens at IMPORT, in the worker, and is PERSISTED on
//        the meta record — the main thread never scans rows (D-02).
//     2. The persistence is a NON-INDEXED meta field written in the same
//        transaction as the rows, so no Dexie version bump is involved and
//        the aggregate never rides `ClassifyResult` (where `IngestClient`'s
//        deep `$state` proxy would wrap thousands of numbers on every replay).
//     3. `playtime-query` answers from that stored aggregate, and it
//        distinguishes a MISSING Sessions.csv (`no-session-file`) from a
//        HEADER-ONLY one (`no-usable-sessions` with excluded 0).
//     4. The reply carries its own `queryId` namespace, so the IngestClient
//        jobId state machine is untouched (04-02 wires the delegation).
//
// The expected numbers below are HAND ARITHMETIC and `Date.UTC`, never the
// output of the code under test:
//
//   A 12:00 → 13:30            = 5400 s
//   B 13:00 → 14:00            = 3600 s, but 1800 s of it overlaps A
//   A ∪ B (merge-aware, D-02)  = 5400 + 3600 - 1800 = 7200 s on 2020-06-01
//   C 2020-06-02 23:30 → 2020-06-03 00:30  = 3600 s, attributed to its START
//                                       day 2020-06-02 (D-02)
//   total                      = 7200 + 3600 = 10800 s
//   excluded                   = 2 (end before start; empty end)
//
// The `TRACER_IP` on every row is the T-04-01 canary: the aggregator must
// never read the IP column, so it can appear nowhere in the persisted
// aggregate.
// =============================================================================

/**
 * The Sessions.csv header 04-01 reads (RESEARCH A1: the ONLY evidence in the
 * repo is the synthetic fixture; a real-export check is scheduled in 04-12).
 */
const TRACER_SESSIONS_HEADER =
  'SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP';

/** Bare CR, the line ending the sample's own Sessions.csv uses. */
const TRACER_CR = '\r';

/** The T-04-01 canary IP carried by every tracer row. */
const TRACER_IP = '192.0.2.99';

/**
 * A 168-cell hour grid as a cell-to-seconds record of its NON-ZERO cells only.
 *
 * The answer keys hold the non-zero cells, because a 168-entry literal per key
 * would be unreadable; the comparison against the full array above still runs,
 * so a grid that dropped a cell leaves a zero in one of these records.
 */
function nonZeroCells(grid: readonly number[]): Record<number, number> {
  const cells: Record<number, number> = {};
  grid.forEach((value, cell) => {
    if (value > 0) cells[cell] = value;
  });
  return cells;
}

function tracerSessionRow(start: string, end: string): string {
  return [start, end, '1.0.0', 'win', 'eu-1', TRACER_IP].join(';');
}

/** Sessions A/B/C plus one end-before-start row and one empty-end row. */
const TRACER_SESSIONS_CSV =
  TRACER_SESSIONS_HEADER +
  TRACER_CR +
  [
    tracerSessionRow('2020-06-01 12:00:00', '2020-06-01 13:30:00'),
    tracerSessionRow('2020-06-01 13:00:00', '2020-06-01 14:00:00'),
    tracerSessionRow('2020-06-02 23:30:00', '2020-06-03 00:30:00'),
    tracerSessionRow('2020-06-04 10:00:00', '2020-06-04 09:00:00'),
    tracerSessionRow('2020-06-05 10:00:00', ''),
  ].join(TRACER_CR) +
  TRACER_CR;

/** The sample export with the tracer Sessions.csv dropped in. */
function buildTracerExport(): Uint8Array {
  return buildCustomExport({
    overrides: { 'Activity_history/Sessions.csv': TRACER_SESSIONS_CSV },
  });
}

/** The same, with a Sessions.csv that holds the header and nothing else. */
function buildHeaderOnlySessionsExport(): Uint8Array {
  return buildCustomExport({
    overrides: { 'Activity_history/Sessions.csv': TRACER_SESSIONS_HEADER + TRACER_CR },
  });
}

/** Activity_history with a Logins.csv but NO Sessions.csv at all. */
function buildNoSessionsFileExport(): Uint8Array {
  return buildCustomExport({
    omitFolders: ['Activity_history'],
    overrides: {
      'Activity_history/Logins.csv':
        'LOGIN_DT;IP;COUNTRY_CODE;USER_AGENT\r\n2020-06-01 12:00:00;192.0.2.30;US;Mozilla/5.0\r\n',
    },
  });
}

// =============================================================================
// 04-14 tracer — UAT gap G-04-1: the REAL export shape, through the real worker
// =============================================================================
//
// The real Wargaming export keeps playtime in per-game files,
// `Activity_history/{WOT,WOTB,WOWS}_Game_Sessions.csv`, each with the header
// `STARTED_AT;FINISHED_AT;IP` and timestamps written `DD.MM.YYYY HH:MM`. Phase 4
// was built against a synthetic `Sessions.csv` with `SESSION_START` and ISO
// stamps with seconds, so a real export reached this worker and answered
// `no-session-file` — the exact report in UAT gap G-04-1.
//
// These three tests drive the REAL worker and the REAL Dexie database over an
// archive with that exact shape, and compare the answer field for field with
// the hand-derived key in `tests/fixtures/playtime-real-shape-fixture.ts`.
//
// Test 1 is the reporter's case. Test 2 is the asymmetry: three files that WERE
// there and held nothing are not the same statement as three files that were
// not there. Test 3 is T-04-01 on the real header, where the IP column is the
// third of three and the aggregator still reads only two.
// =============================================================================

describe('04-14 tracer: a real-shape export through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  function workerOnmessage(): (event: MessageEvent<IngestRequest>) => void {
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    return onmessage!;
  }

  async function query(queryId: number, valueIndex: number | null = null): Promise<IngestResponse> {
    postSpy.mockClear();
    workerOnmessage()({
      data: { type: 'playtime-query', queryId, valueIndex } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    return waitForMessageOfType(postSpy, 'playtime-result', 1500);
  }

  async function ingestThenQuery(
    bytes: Uint8Array,
    name: string,
    queryId = 7,
  ): Promise<{ done: IngestResponse; reply: IngestResponse }> {
    const done = await ingestWith(postSpy, bytes, name);
    return { done, reply: await query(queryId) };
  }

  test('the WOT file alone answers a ready view equal to the answer key, field for field', async () => {
    const { done, reply } = await ingestThenQuery(buildRealShapeExport(), 'real-shape-wot.zip', 11);
    expect(done.type).toBe('done');
    expect(reply.type).toBe('playtime-result');
    if (done.type !== 'done' || reply.type !== 'playtime-result') return;
    expect(reply.importedAt).toBe(done.result.importedAt);
    expect(reply.view?.status).toBe('ready');
    if (reply.view?.status !== 'ready') return;

    // No server and no platform column on the real header, so there is nothing
    // to split on and the view carries no split at all.
    expect(reply.view.split).toBeNull();
    const slice = reply.view.slice;

    expect(slice.seconds).toBe(REAL_SHAPE_WOT.seconds);
    expect(slice.sessions).toBe(REAL_SHAPE_WOT.sessions);
    expect(slice.excluded).toBe(REAL_SHAPE_WOT.excluded);
    expect(slice.dayIndex).toEqual([...REAL_SHAPE_WOT.dayIndex]);
    expect(slice.daySeconds).toEqual([...REAL_SHAPE_WOT.daySeconds]);
    expect(slice.daySessions).toEqual([...REAL_SHAPE_WOT.daySessions]);
    expect(slice.bins).toEqual([...REAL_SHAPE_WOT.bins]);

    // Both hour bases, as full 168-cell arrays. The key holds only the
    // non-zero cells, so the comparison is against the zeros too: a grid that
    // left a stale non-zero behind would pass a keys-only check.
    expect(slice.hourOverlap).toHaveLength(HOUR_CELL_COUNT);
    expect(slice.hourStart).toHaveLength(HOUR_CELL_COUNT);
    expect(nonZeroCells(slice.hourOverlap)).toEqual(REAL_SHAPE_WOT.hourOverlapNonZero);
    expect(nonZeroCells(slice.hourStart)).toEqual(REAL_SHAPE_WOT.hourStartNonZero);
  });

  test('three header-only game files answer no-usable-sessions with excluded 0', async () => {
    // The files WERE there and parsed to zero rows. That is a different
    // statement from an export with no session file at all, and the copy tells
    // them apart, so the answer must too.
    const { reply } = await ingestThenQuery(
      buildHeaderOnlyRealShapeExport(),
      'real-shape-header-only.zip',
      12,
    );
    // The status itself is asserted, not guarded away: a worker that reported
    // `no-session-file` for files that were present and empty would be making a
    // different claim, and the copy tells the two apart.
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result') return;
    expect(reply.view?.status).toBe('no-usable-sessions');
    if (reply.view?.status !== 'no-usable-sessions') return;
    expect(reply.view.excluded).toBe(0);
  });

  test('the stored aggregate carries sessionsFileSeen and no IP string (T-04-01)', async () => {
    // Dynamic import: a RED run must fail per-test here, never crash the whole
    // file's module scope.
    const { PLAYTIME_VERSION } =
      await import('../../../src/lib/features/playtime/playtime-shared.ts');
    const done = await ingestWith(postSpy, buildRealShapeExport(), 'real-shape-meta.zip');
    expect(done.type).toBe('done');
    if (done.type !== 'done') return;

    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();
    expect(meta?.playtime?.v).toBe(PLAYTIME_VERSION);
    expect(meta?.playtime?.sessionsFileSeen).toBe(true);
    expect(meta?.playtime?.all.sessions).toBe(REAL_SHAPE_WOT.sessions);
    // The address is in the DATA of every row, including the two excluded ones.
    // A single occurrence here is the whole of T-04-27.
    expect(JSON.stringify(meta?.playtime)).not.toContain(REAL_SHAPE_IP);
  });

  test('a legacy Sessions.csv and a real per-game file in ONE export are both counted', async () => {
    // Two files, two different headers, one import. Resolving the columns once
    // from whichever file happened to be read first would read 5,400 seconds
    // over 1 session and silently drop the other file's five, which is the
    // failure this plan's per-source aggregation exists to prevent.
    //
    // The sample's own Sessions.csv is 5,400 seconds on 2020-06-01 and the
    // real-shape WOT rows are 12,600 with 2 excluded. The files are three years
    // apart, so the two never overlap and the total is simply the sum.
    //
    // Only the All slice is asserted: what a MIXED export splits on is plan
    // 04-15's decision, not this one's.
    const bytes = buildCustomExport({
      overrides: {
        'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv(REAL_SHAPE_WOT_ROWS),
      },
    });
    const { reply } = await ingestThenQuery(bytes, 'real-shape-mixed.zip', 13);
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result') return;
    expect(reply.view?.status).toBe('ready');
    if (reply.view?.status !== 'ready') return;

    const slice = reply.view.slice;
    expect(slice.sessions).toBe(REAL_SHAPE_WOT.sessions + 1);
    expect(slice.excluded).toBe(REAL_SHAPE_WOT.excluded);
    expect(slice.seconds).toBe(REAL_SHAPE_WOT.seconds + 5400);
  });
});

// =============================================================================
// 04-15 tracer: split by GAME through the real worker
// =============================================================================
//
// D-03's rule stays ONE rule in ONE order — GAME, then SERVER_NAME, then
// CLIENT_PLATFORM, and the first column holding 2 to 50 distinct values among
// USABLE sessions is the split — but the real export finally answers the
// question that order used to leave open: which column identifies the title.
// It is the session FILE. `WOT_Game_Sessions.csv` and its two siblings carry
// the game in the name, and the real header holds neither SERVER_NAME nor
// CLIENT_PLATFORM, so on a real export GAME is the only column that can ever
// qualify.
//
// The two-game export is therefore the smallest shape on which the column is a
// split at all, and the one-game export is the shape most real users have (the
// 2021 sample: WOT has rows, WOTB and WOWS are header-only). Both are driven
// through the real worker and the real Dexie database, so what is asserted is
// what an import STORES — the column, the values, their order, and every
// per-slice number — rather than what a helper would say if it were called on
// its own. Every expected number is a hand-derived fixture key.
// =============================================================================

/**
 * Assert one stored slice against a fixture key, field for field.
 *
 * Both hour grids are compared as FULL 168-cell arrays against the key's
 * non-zero cells, so a grid that left a stale non-zero behind fails here — a
 * keys-only comparison would let it through.
 */
function expectSliceMatchesKey(slice: PlaytimeSlice, key: RealShapeSlice): void {
  expect(slice.seconds).toBe(key.seconds);
  expect(slice.sessions).toBe(key.sessions);
  expect(slice.excluded).toBe(key.excluded);
  expect(slice.dayIndex).toEqual([...key.dayIndex]);
  expect(slice.daySeconds).toEqual([...key.daySeconds]);
  expect(slice.daySessions).toEqual([...key.daySessions]);
  expect(slice.bins).toEqual([...key.bins]);

  expect(slice.hourOverlap).toHaveLength(HOUR_CELL_COUNT);
  expect(slice.hourStart).toHaveLength(HOUR_CELL_COUNT);
  expect(nonZeroCells(slice.hourOverlap)).toEqual(key.hourOverlapNonZero);
  expect(nonZeroCells(slice.hourStart)).toEqual(key.hourStartNonZero);
}

describe('04-15 tracer: split by game through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  function workerOnmessage(): (event: MessageEvent<IngestRequest>) => void {
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    return onmessage!;
  }

  async function query(
    queryId: number,
    valueIndex: number | null = null,
  ): Promise<PlaytimeResponse> {
    postSpy.mockClear();
    workerOnmessage()({
      data: { type: 'playtime-query', queryId, valueIndex } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    const reply = await waitForMessageOfType(postSpy, 'playtime-result', 1500);
    return reply as PlaytimeResponse;
  }

  /** Import the two-game export once, then answer a query against it. */
  async function importTwoGames(zipName: string, queryId: number): Promise<PlaytimeResponse> {
    const done = await ingestWith(postSpy, buildTwoGameExport(), zipName);
    expect(done.type).toBe('done');
    return query(queryId);
  }

  test('a two-game export answers column GAME with both games and the All total', async () => {
    const reply = await importTwoGames('two-game-all.zip', 21);
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    // The column is the one the export NAMES: the game in the file name,
    // upper-cased. Nothing here was read out of a cell, so the selector can
    // claim the column truthfully (D-03).
    expect(reply.view.split?.column).toBe('GAME');
    // WOT holds 12,600 s and WOWS 6,600, so the selector order is hours
    // descending — the same order the split table will use.
    expect(reply.view.split?.values).toEqual([
      { value: 'WOT', seconds: REAL_SHAPE_WOT.seconds },
      { value: 'WOWS', seconds: REAL_SHAPE_WOWS.seconds },
    ]);
    expect(reply.view.split?.allSeconds).toBe(REAL_SHAPE_ALL.seconds);
    expect(reply.view.selected).toBeNull();

    // D-02 on the real shape: All merges the 30 minutes the WOWS row overlaps
    // the WOT span, so the two game totals add to MORE than All. Both numbers
    // are right at once, which is what the overlap note exists to explain.
    expect(REAL_SHAPE_WOT.seconds + REAL_SHAPE_WOWS.seconds).toBeGreaterThan(
      REAL_SHAPE_ALL.seconds,
    );
    expectSliceMatchesKey(reply.view.slice, REAL_SHAPE_ALL);
  });

  test('valueIndex 0 answers WOT, 1 answers WOWS, and past the end answers All', async () => {
    const done = await ingestWith(postSpy, buildTwoGameExport(), 'two-game-values.zip');
    expect(done.type).toBe('done');

    const wot = await query(22, 0);
    if (wot.type !== 'playtime-result' || wot.view?.status !== 'ready') return;
    expect(wot.view.selected).toBe(0);
    expect(wot.view.split?.values[0]?.value).toBe('WOT');
    expectSliceMatchesKey(wot.view.slice, REAL_SHAPE_WOT);

    const wows = await query(23, 1);
    if (wows.type !== 'playtime-result' || wows.view?.status !== 'ready') return;
    expect(wows.view.selected).toBe(1);
    expect(wows.view.split?.values[1]?.value).toBe('WOWS');
    // WOWS has no excluded row of its own: the two excluded WOT rows are WOT's.
    expectSliceMatchesKey(wows.view.slice, REAL_SHAPE_WOWS);

    // An index from a replaced dataset cannot break the section, and it must
    // not answer a slice that does not exist.
    const past = await query(24, 2);
    if (past.type !== 'playtime-result' || past.view?.status !== 'ready') return;
    expect(past.view.selected).toBeNull();
    expectSliceMatchesKey(past.view.slice, REAL_SHAPE_ALL);
  });

  test('one game with rows is not a split: the WOT-only export answers no split at all', async () => {
    // This is the shape the real 2021 export has — WOT has rows, WOTB and WOWS
    // are header-only — and it is PINNED, not RED: one game with rows is one
    // distinct value, which is not a split, and no single-value state was
    // added, so the page makes no claim at all about which game a lone file
    // holds. Exactly what 04-14 produced.
    const done = await ingestWith(postSpy, buildRealShapeExport(), 'one-game.zip');
    expect(done.type).toBe('done');
    const reply = await query(25);
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    expect(reply.view.split).toBeNull();
    expect(reply.view.selected).toBeNull();
    expectSliceMatchesKey(reply.view.slice, REAL_SHAPE_WOT);
  });
});

describe('04-01 tracer: playtime-query round trip through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  /** The worker's wired handler, captured after a fresh module load. */
  function workerOnmessage(): (event: MessageEvent<IngestRequest>) => void {
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    return onmessage!;
  }

  /**
   * Post one `playtime-query` and wait for its answer. The 1,500 ms ceiling
   * is deliberate: a missing handler must FAIL FAST so the RED run reports a
   * timeout naming `playtime-result` rather than hanging on the 10 s default.
   */
  async function query(queryId: number, valueIndex: number | null = null): Promise<IngestResponse> {
    postSpy.mockClear();
    workerOnmessage()({
      data: { type: 'playtime-query', queryId, valueIndex } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    return waitForMessageOfType(postSpy, 'playtime-result', 1500);
  }

  /** Import one export, then ask the worker for its All slice. */
  async function ingestThenQuery(
    bytes: Uint8Array,
    name: string,
    queryId = 7,
  ): Promise<{ done: IngestResponse; reply: IngestResponse }> {
    const done = await ingestWith(postSpy, bytes, name);
    return { done, reply: await query(queryId) };
  }

  test('answers a playtime-query for the All slice after a real import (D-02, D-06)', async () => {
    const { done, reply } = await ingestThenQuery(buildTracerExport(), 'tracer.zip', 7);

    expect(done.type).toBe('done');
    expect(reply.type).toBe('playtime-result');
    if (done.type !== 'done' || reply.type !== 'playtime-result') return;

    // Its OWN id namespace: the reply quotes the queryId it answers, never an
    // ingest jobId, so the IngestClient state machine is untouched.
    expect(reply.queryId).toBe(7);
    // The dataset identity rides the reply so the main thread can drop a
    // response that belongs to a dataset it is no longer showing.
    expect(reply.importedAt).toBe(done.result.importedAt);
    expect(reply.view?.status).toBe('ready');
  });

  test('the All slice is exact: 3 usable, 2 excluded, 10800 merged seconds, two start days', async () => {
    const { reply } = await ingestThenQuery(buildTracerExport(), 'tracer-slice.zip');
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;
    const slice = reply.view.slice;

    expect(slice.sessions).toBe(3);
    expect(slice.excluded).toBe(2);
    expect(slice.seconds).toBe(10800);

    // Day numbers come from `Date.UTC`, not from the civil-date code under
    // test, so the two independent paths cross-check each other.
    const day0 = Date.UTC(2020, 5, 1) / 86400000;
    expect(slice.dayIndex).toEqual([day0, day0 + 1]);
    expect(slice.daySeconds).toEqual([7200, 3600]);
    expect(slice.daySessions).toEqual([2, 1]);

    // The three arrays 04-03 fills are already final in the stored shape, so
    // their length is pinned here rather than re-pinned in every later plan.
    expect(slice.hourOverlap).toHaveLength(168);
    expect(slice.hourStart).toHaveLength(168);
    expect(slice.bins).toHaveLength(12);
  });

  test('the meta record carries the aggregate at PLAYTIME_VERSION and never the IP (T-04-01)', async () => {
    // Dynamic import: the RED run must fail per-test here, never crash the
    // whole file's module scope.
    const { PLAYTIME_VERSION } =
      await import('../../../src/lib/features/playtime/playtime-shared.ts');

    const done = await ingestWith(postSpy, buildTracerExport(), 'tracer-meta.zip');
    expect(done.type).toBe('done');
    if (done.type !== 'done') return;

    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();
    expect(meta?.playtime?.v).toBe(PLAYTIME_VERSION);
    expect(meta?.playtime?.all.sessions).toBe(3);
    expect(JSON.stringify(meta?.playtime)).not.toContain(TRACER_IP);

    // The aggregate stays on the meta record: it never rides the import
    // result, which `IngestClient.result` holds as a deep `$state` proxy.
    expect(Object.keys(done.result)).not.toContain('playtime');
  });

  test('a playtime-query before any import answers importedAt null and no view', async () => {
    await import('../../../src/lib/worker/ingest.worker.ts');
    postSpy.mockClear();

    const reply = await query(3);
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result') return;
    expect(reply.queryId).toBe(3);
    expect(reply.importedAt).toBeNull();
    expect(reply.view).toBeNull();
  });

  test('an export with no Sessions.csv answers no-session-file, not no-usable-sessions', async () => {
    const { reply } = await ingestThenQuery(buildNoSessionsFileExport(), 'no-sessions.zip');
    if (reply.type !== 'playtime-result') return;
    expect(reply.view?.status).toBe('no-session-file');
  });

  test('a header-only Sessions.csv answers no-usable-sessions with excluded 0', async () => {
    const { reply } = await ingestThenQuery(
      buildHeaderOnlySessionsExport(),
      'header-only-sessions.zip',
    );
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'no-usable-sessions') return;
    // The FILE exists and parsed to zero rows: that is a different statement
    // from "this export has no Sessions.csv at all", and the copy tells them
    // apart.
    expect(reply.view.excluded).toBe(0);
  });
});

// =============================================================================
// 04-01 Task 2 — the client bridge: PlaytimeClient over the real worker
// =============================================================================
//
// The seam 04-02 wires the section into. A chart asks `playtime.query(null)`
// and gets a promise back; the worker answers on the same channel the import
// uses, so SOMETHING has to route the two playtime replies away from the
// import state machine before it ever looks at them. That routing is the only
// thing under test here — the numbers themselves are Task 1's job.
//
// Both tests run against the real worker module and the real Dexie database,
// so a bridge that passed against a stub could still be wired to a message
// the worker never sends.
// =============================================================================

/**
 * Reject rather than hang. A bridge that never routes leaves its promise
 * pending forever, and a hanging test is far harder to read than a named
 * timeout — the 1,500 ms is the same fail-fast ceiling Task 1 uses.
 */
function withDeadline<T>(promise: Promise<T>, label: string, ms = 1500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`withDeadline('${label}'): timed out after ${ms} ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

describe('04-01 client bridge: PlaytimeClient over the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  /**
   * Import the tracer export, then wire a client to the SAME worker: its
   * `post` reaches the worker's `onmessage`, and the worker's replies come
   * back out of the same `self.postMessage` the spy records.
   */
  async function bridgeOverRealWorker(): Promise<{
    query: (valueIndex: number | null) => Promise<unknown>;
    handle: (msg: PlaytimeResponse) => void;
  }> {
    // Dynamic import so a missing module is a PER-TEST failure, never a
    // whole-file crash that would take Task 1's six green tests with it.
    const { PlaytimeClient } =
      await import('../../../src/lib/features/playtime/playtime-client.ts');
    const scope = (globalThis as unknown as { self: WorkerScopeLike }).self;
    const done = await ingestWith(postSpy, buildTracerExport(), 'bridge.zip');
    expect(done.type).toBe('done');

    let client: InstanceType<typeof PlaytimeClient> | null = null;
    // Give the SAME spy a routing implementation, so every reply is still
    // recorded on the raw channel and a later test can assert on it, while
    // the playtime ones also reach the bridge.
    postSpy.mockImplementation((message: IngestResponse) => {
      // The delegation 04-02 will put at the top of IngestClient.#handle:
      // both playtime replies go to the bridge, neither reaches the import
      // state machine.
      if (message.type === 'playtime-result' || message.type === 'playtime-error') {
        client?.handle(message);
      }
    });
    client = new PlaytimeClient((request) => {
      scope.onmessage!({ data: request } as MessageEvent<IngestRequest>);
    });
    return {
      query: (valueIndex) => client!.query(valueIndex),
      handle: (msg) => client!.handle(msg),
    };
  }

  test('resolves query(null) with the All slice over the real worker', async () => {
    const { query } = await bridgeOverRealWorker();

    const outcome = (await withDeadline(query(null), 'query(null)')) as {
      kind: string;
      view: { status: string; slice: { sessions: number; seconds: number } } | null;
    };
    expect(outcome.kind).toBe('result');
    expect(outcome.view?.status).toBe('ready');
    expect(outcome.view?.slice.sessions).toBe(3);
    expect(outcome.view?.slice.seconds).toBe(10800);
  });

  test('a reply for an unknown queryId is ignored — no throw, no resolution', async () => {
    const { PlaytimeClient } =
      await import('../../../src/lib/features/playtime/playtime-client.ts');
    // No worker at all: this is about the client's own bookkeeping, so a
    // post that goes nowhere is the point.
    const client = new PlaytimeClient(() => {});

    const pending = client.query(null);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    // A reply for an id nobody is waiting on — a stale query, or one the
    // page already gave up on. It must not throw and must not settle the
    // live query.
    expect(() =>
      client.handle({ type: 'playtime-result', queryId: 999, importedAt: null, view: null }),
    ).not.toThrow();
    await Promise.resolve();
    expect(settled).toBe(false);

    // The live query still resolves on its OWN id, which is 1 — the first
    // one this client hands out.
    client.handle({
      type: 'playtime-result',
      queryId: 1,
      importedAt: '2020-01-01T00:00:00.000Z',
      view: { status: 'no-session-file' },
    });
    const outcome = await pending;
    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;
    expect(outcome.queryId).toBe(1);
    expect(outcome.view?.status).toBe('no-session-file');
  });
});

// =============================================================================
// 04-06 tracer: split by SERVER_NAME through the real worker
// =============================================================================
//
// Plan 04-06 Task 1. The column rule, the per-value merge (D-02) and the
// per-value excluded counts only matter if they survive the trip: this is
// the one place the whole path is driven end to end — a real zip, the real
// worker module, the real Dexie database, a real `playtime-query`.
//
// The five rows are chosen so the three things that can go wrong are all
// reachable by hand arithmetic:
//
//   eu-1  12:00 -> 13:30   the longer eu-1 session
//   eu-1  13:00 -> 14:00   OVERLAPS the one above, so eu-1 merges to 2 h
//   na-1  13:30 -> 13:45   15 min, and fully COVERED by the eu-1 union once
//                          the merge sweep runs over All (13:30-13:45 sits
//                          inside 12:00-14:00) — so All is 7200 and na-1
//                          alone is 900
//   eu-1  (empty end)      excluded, and it belongs to eu-1's excluded count
//   zz-9  (empty end)      excluded, and NO USABLE SESSION EVER CARRIES IT,
//                          so it is not a value at all (RESEARCH A6)
//
// Every number below is arithmetic on these five rows, never something read
// back out of the code under test.
// =============================================================================

/** The 04-06 tracer rows, in SESSIONS_HEADER order. */
const SPLIT_SESSIONS_ROWS: readonly (string | null)[][] = [
  ['2020-06-01 12:00:00', '2020-06-01 13:30:00', '12931', 'win', 'eu-1', SESSION_FIXTURE_IP],
  ['2020-06-01 13:00:00', '2020-06-01 14:00:00', '12931', 'win', 'eu-1', SESSION_FIXTURE_IP],
  ['2020-06-01 13:30:00', '2020-06-01 13:45:00', '12931', 'win', 'na-1', SESSION_FIXTURE_IP],
  ['2020-06-01 15:00:00', null, '12931', 'win', 'eu-1', SESSION_FIXTURE_IP],
  ['2020-06-01 16:00:00', null, '12931', 'win', 'zz-9', SESSION_FIXTURE_IP],
];

/** 7200 s: 12:00 to 14:00 merged across the two overlapping eu-1 rows. */
const SPLIT_ALL_SECONDS = 7200;
/** 900 s: na-1's 13:30 to 13:45 on its own. */
const SPLIT_NA1_SECONDS = 900;

function buildSplitTracerExport(): Uint8Array {
  return buildSessionsExportFromCsv(buildSessionsCsvFromRows(SPLIT_SESSIONS_ROWS));
}

describe('04-06 tracer: split by SERVER_NAME through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  function workerOnmessage(): (event: MessageEvent<IngestRequest>) => void {
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    return onmessage!;
  }

  async function query(
    queryId: number,
    valueIndex: number | null = null,
  ): Promise<PlaytimeResponse> {
    postSpy.mockClear();
    workerOnmessage()({
      data: { type: 'playtime-query', queryId, valueIndex } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    const reply = await waitForMessageOfType(postSpy, 'playtime-result', 1500);
    return reply as PlaytimeResponse;
  }

  /** Import the five-row export once, then answer queries against it. */
  async function importSplitTracer(): Promise<PlaytimeResponse> {
    const done = await ingestWith(postSpy, buildSplitTracerExport(), 'split-tracer.zip');
    expect(done.type).toBe('done');
    return query(1, null);
  }

  test('a real two-server import answers SERVER_NAME with both values and the All total', async () => {
    const reply = await importSplitTracer();
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    // eu-1 holds 7,200 s and na-1 900 s, so the selector order is hours
    // descending — the same order the split table will use.
    expect(reply.view.split?.column).toBe('SERVER_NAME');
    expect(reply.view.split?.values).toEqual([
      { value: 'eu-1', seconds: SPLIT_ALL_SECONDS },
      { value: 'na-1', seconds: SPLIT_NA1_SECONDS },
    ]);
    expect(reply.view.split?.allSeconds).toBe(SPLIT_ALL_SECONDS);
    expect(reply.view.selected).toBeNull();
  });

  test('the All slice merges the overlap once and counts both excluded rows', async () => {
    const reply = await importSplitTracer();
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;
    const slice = reply.view.slice;

    // 12:00 to 14:00 is two hours, and na-1's 15 minutes fall INSIDE it, so
    // the union is 7,200 s even though the three raw lengths sum to 8,100.
    expect(slice.sessions).toBe(3);
    expect(slice.seconds).toBe(SPLIT_ALL_SECONDS);
    expect(slice.excluded).toBe(2);
    // All three sessions start on 2020-06-01, so there is one active day.
    expect(slice.dayIndex).toEqual([Date.UTC(2020, 5, 1) / 86400000]);
    expect(slice.daySessions).toEqual([3]);
  });

  test('valueIndex 1 answers the na-1 slice, which has no excluded row of its own', async () => {
    const done = await ingestWith(postSpy, buildSplitTracerExport(), 'split-tracer-na1.zip');
    expect(done.type).toBe('done');
    const reply = await query(4, 1);
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    expect(reply.view.selected).toBe(1);
    expect(reply.view.slice.sessions).toBe(1);
    expect(reply.view.slice.seconds).toBe(SPLIT_NA1_SECONDS);
    // na-1's 15 minutes are the only na-1 playtime there is, and the
    // excluded rows are both eu-1 or unknown.
    expect(reply.view.slice.excluded).toBe(0);
  });

  test('valueIndex 0 answers the eu-1 slice with exactly its one excluded row', async () => {
    const done = await ingestWith(postSpy, buildSplitTracerExport(), 'split-tracer-eu1.zip');
    expect(done.type).toBe('done');
    const reply = await query(5, 0);
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    expect(reply.view.selected).toBe(0);
    // The two eu-1 rows merge to the same 7,200 s the All slice reports,
    // because na-1 contributed no seconds the merge did not already cover.
    expect(reply.view.slice.sessions).toBe(2);
    expect(reply.view.slice.seconds).toBe(SPLIT_ALL_SECONDS);
    expect(reply.view.slice.excluded).toBe(1);
  });

  test('zz-9 is not a value: it appears on an excluded row only (RESEARCH A6)', async () => {
    const reply = await importSplitTracer();
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    expect(reply.view.split?.values.map((entry) => entry.value)).toEqual(['eu-1', 'na-1']);
    // Its row still counts under All — dropped from a value, not from the
    // dataset (D-02).
    expect(reply.view.slice.excluded).toBe(2);
  });

  test.each([
    ['past the last value', 5],
    ['before the first value', -1],
  ])(
    'valueIndex %s falls back to All rather than answering a slice that does not exist',
    async (_label, valueIndex) => {
      const done = await ingestWith(
        postSpy,
        buildSplitTracerExport(),
        'split-tracer-bad-index.zip',
      );
      expect(done.type).toBe('done');
      const reply = await query(6, valueIndex);
      if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

      expect(reply.view.selected).toBeNull();
      expect(reply.view.slice.sessions).toBe(3);
      expect(reply.view.slice.seconds).toBe(SPLIT_ALL_SECONDS);
      expect(reply.view.slice.excluded).toBe(2);
    },
  );
});

// =============================================================================
// 04-06 backfill: legacy, stale and failed playtime aggregates
// =============================================================================
//
// Every import this app has ever written before 04-06 stored no split, and a
// cache whose aggregation FAILED stores `playtime: null`. Neither is a reason
// to show the user an error for data the app still holds: the rows are the
// dataset, and the aggregate is a derived convenience over them (T-04-03).
//
// So a query against a missing, null or older-versioned aggregate recomputes
// it from the stored rows, in ONE snapshot, and writes it back only if the
// dataset is still the one it read. Everything below is driven through the
// real worker against the real Dexie database.
// =============================================================================

/** Build a Sessions-only export from the seeded CLIENT_PLATFORM fixture. */
function buildFewHundredRowSessionsExport(): Uint8Array {
  return buildSessionsExport(PLATFORM_FALLBACK_SPEC).bytes;
}

describe('04-06 backfill: legacy, stale and failed playtime aggregates', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  function workerOnmessage(): (event: MessageEvent<IngestRequest>) => void {
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    return onmessage!;
  }

  async function query(queryId: number, valueIndex: number | null = null): Promise<IngestResponse> {
    postSpy.mockClear();
    workerOnmessage()({
      data: { type: 'playtime-query', queryId, valueIndex } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    return waitForMessageOfType(postSpy, 'playtime-result', 1500);
  }

  /** The worker's own Dexie singleton, after the module has been imported. */
  async function workerDb() {
    return (await importWorkerDb()).db;
  }

  /**
   * Strip the stored aggregate, the way a cache written by a build from
   * before 04-06 has it: the meta record is there and the field is not.
   */
  async function deleteStoredPlaytime(): Promise<void> {
    const db = await workerDb();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();
    delete meta!.playtime;
    await db.meta.put(meta!);
    expect((await db.meta.get('active'))?.playtime).toBeUndefined();
  }

  test('a legacy cache with no playtime field recomputes and repairs the record', async () => {
    const done = await ingestWith(postSpy, buildSplitTracerExport(), 'backfill-legacy.zip');
    expect(done.type).toBe('done');
    if (done.type !== 'done') return;
    const before = await query(1, null);
    if (before.type !== 'playtime-result') return;

    await deleteStoredPlaytime();
    const after = await query(2, null);

    expect(after.type).toBe('playtime-result');
    if (after.type !== 'playtime-result') return;
    // Same dataset, and the same answer it gave with a stored aggregate —
    // recomputing is not allowed to change what the user sees.
    expect(after.importedAt).toBe(before.importedAt);
    expect(after.view).toEqual(before.view);

    const { PLAYTIME_VERSION } =
      await import('../../../src/lib/features/playtime/playtime-shared.ts');
    const db = await workerDb();
    expect((await db.meta.get('active'))?.playtime?.v).toBe(PLAYTIME_VERSION);
  });

  test('a version mismatch recomputes instead of being cast', async () => {
    await ingestWith(postSpy, buildSplitTracerExport(), 'backfill-version.zip');
    const db = await workerDb();
    const meta = await db.meta.get('active');
    await db.meta.update('active', { playtime: { v: 0 } as never });

    const reply = await query(3, null);
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    // 04-14: the literals these two assertions used to carry read 1, which was
    // the value at the time. They now read the constant, so bumping it — which
    // is what repairs a dataset cached by the previous build — does not turn
    // them into a second place the version is written down.
    const { PLAYTIME_VERSION } =
      await import('../../../src/lib/features/playtime/playtime-shared.ts');

    // Not an error and not a silent cast: the numbers are recomputed.
    expect(reply.view.split?.column).toBe('SERVER_NAME');
    expect((await db.meta.get('active'))?.playtime?.v).toBe(PLAYTIME_VERSION);
    expect(meta!.playtime?.v).toBe(PLAYTIME_VERSION);
  });

  test('a null playtime (an aggregation that failed at import) recomputes and repairs', async () => {
    await ingestWith(postSpy, buildSplitTracerExport(), 'backfill-null.zip');
    const db = await workerDb();
    await db.meta.update('active', { playtime: null });

    const reply = await query(4, 1);
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

    expect(reply.view.selected).toBe(1);
    expect(reply.view.slice.seconds).toBe(SPLIT_NA1_SECONDS);
    expect((await db.meta.get('active'))?.playtime).not.toBeNull();
  });

  test('a legacy cache whose export had no Sessions.csv answers no-session-file', async () => {
    await ingestWith(postSpy, buildNoSessionsFileExport(), 'backfill-no-sessions.zip');
    await deleteStoredPlaytime();

    const reply = await query(5, null);
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'no-session-file') return;
    // Documented limitation: a cache with zero Sessions rows cannot tell a
    // missing file from a header-only one, and reports the first. A NEW
    // import records `sessionsFileSeen` exactly and is not affected.
    expect(reply.view.status).toBe('no-session-file');
  });

  test('a new header-only import still answers no-usable-sessions, and its backfill does not', async () => {
    // The asymmetry is the point: the exact answer comes from the stored
    // `sessionsFileSeen`, and a recomputation from zero rows can only guess.
    const done = await ingestWith(
      postSpy,
      buildSessionsExportFromCsv(TRACER_SESSIONS_HEADER + TRACER_CR),
      'backfill-header-only.zip',
    );
    expect(done.type).toBe('done');

    const stored = await query(6, null);
    if (stored.type !== 'playtime-result' || stored.view?.status !== 'no-usable-sessions') return;
    expect(stored.view.excluded).toBe(0);

    await deleteStoredPlaytime();
    const recomputed = await query(7, null);
    if (recomputed.type !== 'playtime-result') return;
    expect(recomputed.view?.status).toBe('no-session-file');
  });

  // ---------------------------------------------------------------------------
  // 04-14 — the reporter's case: a dataset cached by the PREVIOUS build
  // ---------------------------------------------------------------------------
  //
  // A user who reported G-04-1 has the real export already imported and sitting
  // in their browser, with an aggregate that says `sessionsFileSeen: false`
  // because the build that wrote it did not know about
  // `WOT_Game_Sessions.csv`. Nothing about their file changed. So the repair
  // cannot be "re-import the export" — it has to be the version bump plus a
  // backfill that reads the per-game files, or the gap never closes for the
  // person who reported it.
  test('a real-shape dataset cached with the previous version repairs on the next query', async () => {
    const done = await ingestWith(postSpy, buildRealShapeExport(), 'reporter-cached.zip');
    expect(done.type).toBe('done');
    if (done.type !== 'done') return;
    const importedAt = done.result.importedAt;

    // Stamp the stored aggregate the way the previous build left it: the OLD
    // version, and a claim that the export had no session file at all.
    const db = await workerDb();
    await db.meta.update('active', {
      playtime: {
        v: 1,
        sessionsFileSeen: false,
        splitColumn: null,
        values: [],
        byValue: [],
        all: {
          seconds: 0,
          sessions: 0,
          excluded: 0,
          dayIndex: [],
          daySeconds: [],
          daySessions: [],
          hourOverlap: [],
          hourStart: [],
          bins: [],
        },
      } as never,
    });

    const reply = await query(21, null);
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result') return;
    expect(reply.importedAt).toBe(importedAt);
    expect(reply.view?.status).toBe('ready');
    if (reply.view?.status !== 'ready') return;

    // The answer key's numbers, from STORED rows, with no re-import.
    const slice = reply.view.slice;
    expect(slice.sessions).toBe(REAL_SHAPE_WOT.sessions);
    expect(slice.excluded).toBe(REAL_SHAPE_WOT.excluded);
    expect(slice.seconds).toBe(REAL_SHAPE_WOT.seconds);
    expect(slice.dayIndex).toEqual([...REAL_SHAPE_WOT.dayIndex]);
    expect(nonZeroCells(slice.hourOverlap)).toEqual(REAL_SHAPE_WOT.hourOverlapNonZero);

    // And the repair is PERSISTED at the current version, so the next visit
    // reads it instead of recomputing it again.
    const { PLAYTIME_VERSION } =
      await import('../../../src/lib/features/playtime/playtime-shared.ts');
    const repaired = (await db.meta.get('active'))?.playtime;
    expect(repaired?.v).toBe(PLAYTIME_VERSION);
    expect(repaired?.sessionsFileSeen).toBe(true);
    expect(JSON.stringify(repaired)).not.toContain(REAL_SHAPE_IP);
  });

  test('a real-shape dataset whose stored aggregate is deleted is rebuilt identically', async () => {
    const done = await ingestWith(postSpy, buildRealShapeExport(), 'reporter-deleted.zip');
    expect(done.type).toBe('done');
    if (done.type !== 'done') return;

    const before = await query(22, null);
    if (before.type !== 'playtime-result') return;

    await deleteStoredPlaytime();
    const after = await query(23, null);
    expect(after.type).toBe('playtime-result');
    if (after.type !== 'playtime-result') return;

    // Same dataset, same view: recomputing is not allowed to change what the
    // user sees between the two visits.
    expect(after.importedAt).toBe(before.importedAt);
    expect(after.view).toEqual(before.view);
  });

  test('a real-shape dataset whose three game files were header-only backfills to no-session-file', async () => {
    // The documented asymmetry, on the real shape. A header-only file stores
    // ZERO rows, so a recomputation from stored rows cannot tell "the file was
    // there and held nothing" from "there was no file" — and reports the first
    // shape's worse-tasting cousin, `no-session-file`. The exact answer comes
    // from the stored `sessionsFileSeen` a fresh import records, which is what
    // the tracer describe above proves.
    const done = await ingestWith(
      postSpy,
      buildHeaderOnlyRealShapeExport(),
      'reporter-header-only.zip',
    );
    expect(done.type).toBe('done');

    const stored = await query(24, null);
    expect(stored.type).toBe('playtime-result');
    if (stored.type !== 'playtime-result') return;
    expect(stored.view?.status).toBe('no-usable-sessions');

    await deleteStoredPlaytime();
    const recomputed = await query(25, null);
    expect(recomputed.type).toBe('playtime-result');
    if (recomputed.type !== 'playtime-result') return;
    expect(recomputed.view?.status).toBe('no-session-file');
  });

  test('PLAYTIME_VERSION is 3, so an aggregate from the previous build is stale', async () => {
    // The one place the number is written down. Every other test reads the
    // constant, so reverting this is a deliberate act with a failing test, not
    // a silent consequence of editing something else (T-04-30).
    //
    // Flipped 2 -> 3 by 10-01: a stored aggregate now carries a per-game scope
    // beside the all-games one, which a v2 record has no room for. The lazy
    // rebuild is what absorbs it — a v2 cache is recomputed from its own rows
    // on the next playtime query and written back, with no re-import (D-21).
    const { PLAYTIME_VERSION } =
      await import('../../../src/lib/features/playtime/playtime-shared.ts');
    expect(PLAYTIME_VERSION).toBe(3);
  });

  test('a query after clear-data answers importedAt null and no view', async () => {
    await ingestWith(postSpy, buildSplitTracerExport(), 'backfill-cleared.zip');
    postSpy.mockClear();
    workerOnmessage()({
      data: { type: 'clear-data', jobId: 41 } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    await waitForMessageOfType(postSpy, 'cleared', 1500);

    const reply = await query(8, 2);
    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result') return;
    expect(reply.importedAt).toBeNull();
    expect(reply.view).toBeNull();
  });

  test('a backfill that throws answers playtime-error and touches nothing (T-04-03)', async () => {
    await ingestWith(postSpy, buildSplitTracerExport(), 'backfill-throws.zip');
    await deleteStoredPlaytime();

    // A row whose data was corrupted in storage: the aggregator resolves its
    // columns off `Object.keys(row)` and there is no object any more.
    const db = await workerDb();
    const row = await db.rows.where('sourceFile').equals('Sessions.csv').first();
    expect(row).toBeDefined();
    await db.rows.update(row!.id!, { data: null as unknown as DatasetRow['data'] });

    postSpy.mockClear();
    workerOnmessage()({
      data: { type: 'playtime-query', queryId: 9, valueIndex: null } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    const reply = await waitForMessageOfType(postSpy, 'playtime-error', 1500);

    expect(reply.type).toBe('playtime-error');
    if (reply.type !== 'playtime-error') return;
    // The query's OWN id, and a detail carrying the error's name and message
    // and nothing else — no row contents, no paths beyond the name.
    expect(reply.queryId).toBe(9);
    expect(reply.detail).toMatch(/^TypeError: /);
    // A chart's failure must never look like an import failure: nothing went
    // out on the ingest error channel.
    expect(postSpy.mock.calls.some((call) => (call[0] as IngestResponse).type === 'error')).toBe(
      false,
    );

    // The dataset is untouched: the corrupt row is still there, the meta
    // record still has NO playtime (a partial write is worse than none), and
    // the import the user already completed still stands.
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();
    expect(meta!.playtime).toBeUndefined();
    expect(meta!.categories.length).toBeGreaterThan(0);
    expect(await db.rows.count()).toBeGreaterThan(0);
  });

  test('rebuilds a few-hundred-row export well inside the 1,500 ms ceiling', async () => {
    await ingestWith(postSpy, buildFewHundredRowSessionsExport(), 'backfill-scale.zip');
    const { csv } = buildSessionsExport(PLATFORM_FALLBACK_SPEC);
    expect(csv.split('\r').filter((line) => line.length > 0).length).toBeGreaterThan(200);
    await deleteStoredPlaytime();

    const started = Date.now();
    const reply = await query(10, 0);
    const elapsed = Date.now() - started;

    expect(reply.type).toBe('playtime-result');
    if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;
    // The 1,500 ms ceiling above is the whole assertion: a key-list query
    // form (RESEARCH measured 2,243 ms for `anyOf` on 3,000 rows) would have
    // missed it, and so would any per-row read.
    expect(elapsed).toBeLessThan(1500);
    expect(reply.view.split?.column).toBe('CLIENT_PLATFORM');
  });
});

// =============================================================================
// 04-12 tracer: a 60,000-session export through the REAL import worker
// =============================================================================
//
// WHY THIS EXISTS, AND WHY IT IS THE ONLY PLACE THE CLAIM CAN BE PROVEN
// `tests/unit/playtime/playtime-scale.test.ts` runs the same 60,000-session preset
// through parse, aggregate, view and the three model builders, and that is
// where the time budgets live. It cannot, however, notice the two failures
// that would be most damaging at this size and invisible at 240 rows:
//
//   1. a worker that stopped calling `buildPlaytime` at import (the aggregate
//      would then be built lazily on first query, and the "precomputed at
//      import" promise would quietly become false);
//   2. a STORED aggregate whose size grew with row count rather than with
//      days and values — 60,000 sessions is where that would first show up on
//      disk, and it is the number the user pays for in IndexedDB.
//
// So this describe ingests the 60,000-session export ONCE through the real
// worker, against the real Dexie database, and the three tests below only
// post `playtime-query` messages and read what came back. Keeping the import
// in a single `beforeAll` is not an optimisation: the write is the expensive
// part (more than 70,000 rows through chunked `bulkPut` into
// fake-indexeddb), and doing it per test would make this file's wall-clock
// time a function of the test count.
//
// The two tests that could tolerate it still share the one import, because a
// second import of the same bytes would answer `duplicate` and prove nothing.
//
// WHY IT IS CHARACTERIZATION, NOT TDD
// Nothing in `src/` changes here. This task verifies code shipped by 04-01 to
// 04-06 and 04-10, so the first run passes and that is recorded as
// characterization. A failure here is a REAL defect in the code under test and
// is fixed in the code, never in the expectation.
//
// EVERY EXPECTATION IS THE FIXTURE'S ANALYTIC ANSWER KEY
// `SCALE_60K_SPEC.expected` is closed-form arithmetic over the fixture's own
// layout (see `tests/fixtures/sessions-fixtures.ts`), computed without calling
// the aggregator. Nothing below reads a number back out of `buildPlaytime`,
// `viewFromAggregates` or a model builder to assert it.
//
// Decisions: D-02 (merge-aware seconds), D-03 (split values and per-value
// slices), D-05 (twelve bins), D-06 (totals). T-04-01: the address column is
// never read, stored or rendered, and this is where that is checked at scale.
// =============================================================================

/** Terminal-message ceiling for the shared 60,000-session import. */
const SCALE_IMPORT_TIMEOUT_MS = 150_000;

/**
 * Budget for that same import, deliberately TIGHTER than the ceiling above.
 *
 * `waitForTerminal` throws at 150 s, so the ceiling only says "not absurd";
 * this is the number that would catch a regression — a Dexie write that
 * stopped chunking, or a `bulkPut` that went quadratic, would still finish
 * inside the ceiling while doubling the time a real user waits on 70,000
 * rows. This is T-04-22's worker-level half; the aggregation-only budgets
 * live in `tests/unit/playtime/playtime-scale.test.ts`.
 */
const SCALE_IMPORT_BUDGET_MS = 60_000;

/**
 * `beforeAll` ceiling for the same import.
 *
 * A HOOK timeout, not a test timeout: the default 5 s would fail the whole
 * describe before its first test ever ran, and the failure would name a hook
 * rather than the import. 180 s is three orders of magnitude above the
 * measured cost (the SUMMARY records it) because the number that matters is
 * the recorded one, not the ceiling.
 */
const SCALE_BEFORE_ALL_TIMEOUT_MS = 180_000;

/** Per-test ceiling: each of the three tests is a query, not an import. */
const SCALE_TEST_TIMEOUT_MS = 30_000;

/**
 * Upper bound on the JSON length of a stored `playtime` aggregate, from DAYS
 * and VALUES only.
 *
 * THE SAME FORMULA IS WRITTEN OUT A SECOND TIME in
 * `tests/unit/playtime/playtime-scale.test.ts` (`storedSizeBound`). Two copies is
 * deliberate: a single shared helper would let the constant be changed in the
 * pure test while the worker-level bound silently moved with it, and the two
 * claims are meant to be independent — one is about the pipeline, the other
 * about what lands in IndexedDB.
 *
 * Per slice: `calendarCells x 20` for the three per-day arrays (a five-digit
 * day index, a seven-digit seconds figure, a four-digit session count and
 * three commas is nineteen, so twenty cannot be crossed by a day that
 * exists), `(168 x 2 + 12) x 9` for the two hour grids and the twelve bins,
 * and 200 characters of keys and the split label. Plus 2,000 for the
 * aggregate record's own keys and value list.
 *
 * WHAT THIS BOUND IS NOT: it is not a multiple of the session count. A bound
 * like "12x the sessions, so at most 12x the size" would be wrong — a
 * per-value slice fills its day array faster than the All slice as sessions
 * grow — and a bare 3,000,000-character cap would pass at any scale. The
 * bound is the same NUMBER for the 5,000- and 60,000-session presets, which
 * is the whole claim: the stored size is a function of days and values.
 */
function storedSizeBound(calendarCells: number, valueCount: number): number {
  const perSlice = calendarCells * 20 + (HOUR_CELL_COUNT * 2 + DURATION_BIN_COUNT) * 9 + 200;
  return (1 + valueCount) * perSlice + 2_000;
}

describe('04-12 scale tracer: a 60,000-session export through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;
  let terminal: IngestResponse;
  let expected: SessionsExpected;
  let importMs = 0;

  // No `beforeEach` here, on purpose. Every other describe in this file resets
  // modules and deletes the database before each test, which would tear down
  // the worker module this describe's `beforeAll` loaded and make every
  // `playtime-query` below answer from an empty database. The reset and the
  // delete therefore happen ONCE, in the hook that also does the import.
  beforeAll(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };

    const built = buildSessionsExport(SCALE_60K_SPEC);
    expected = built.expected;

    const started = Date.now();
    terminal = await ingestWith(postSpy, built.bytes, 'scale-60k.zip', SCALE_IMPORT_TIMEOUT_MS);
    importMs = Date.now() - started;
  }, SCALE_BEFORE_ALL_TIMEOUT_MS);

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  /**
   * Post one `playtime-query` and wait for its answer.
   *
   * The 1,500 ms ceiling is the SAME fail-fast one the 04-01 and 04-06
   * describes use, and it is still the right number at this size: a query
   * reads one slice off the stored aggregate, so the answer does not get
   * slower with the export. A missing handler must fail fast and name
   * `playtime-result` rather than hang until the test timeout.
   */
  async function query(
    queryId: number,
    valueIndex: number | null = null,
  ): Promise<PlaytimeResponse> {
    postSpy.mockClear();
    const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
    expect(typeof onmessage).toBe('function');
    onmessage!({
      data: { type: 'playtime-query', queryId, valueIndex } as IngestRequest,
    } as MessageEvent<IngestRequest>);
    return (await waitForMessageOfType(postSpy, 'playtime-result', 1500)) as PlaytimeResponse;
  }

  test(
    'answers the All slice equal to the analytic key, and the three models from it (ACTIVITY-01/02/03/04)',
    async () => {
      // The import itself: CSV parse, classification, a chunked Dexie write of
      // more than 70,000 rows and the precomputed aggregate, all inside the
      // budget. T-04-22 at the worker level.
      expect(
        importMs,
        `the 60,000-session import took ${importMs} ms (budget ${SCALE_IMPORT_BUDGET_MS} ms)`,
      ).toBeLessThan(SCALE_IMPORT_BUDGET_MS);

      // The import completed and the aggregate rode the meta record, not the
      // import result (D-20's shape): a 300,000-number object on a `$state`
      // proxy would be walked on every replay.
      expect(terminal.type).toBe('done');
      if (terminal.type !== 'done') return;
      expect(Object.keys(terminal.result)).not.toContain('playtime');

      const reply = await query(1, null);
      expect(reply.type).toBe('playtime-result');
      if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

      const slice = reply.view.slice;
      // D-06, at the scale that makes a rounding error visible.
      expect(slice.sessions).toBe(expected.sessions);
      expect(slice.excluded).toBe(expected.excluded);
      expect(slice.seconds).toBe(expected.seconds);
      // ACTIVITY-02, day for day across twelve years.
      expect(slice.dayIndex).toEqual(expected.dayIndex);
      expect(slice.daySeconds).toEqual(expected.daySeconds);
      expect(slice.daySessions).toEqual(expected.daySessions);
      expect(slice.dayIndex.length).toBe(expected.activeDays.length);
      // ACTIVITY-03, both stored bases.
      expect(slice.hourOverlap).toEqual(expected.hourOverlap);
      expect(slice.hourStart).toEqual(expected.hourStart);
      // ACTIVITY-04, the twelve bins.
      expect(slice.bins).toEqual(expected.bins);

      // The three chart models, built from the slice the WORKER answered with —
      // so the chart inputs are the worker's output, not the fixture's.
      const calendar = buildCalendarModel(slice);
      expect(calendar.cellCount).toBe(expected.calendarCells);
      const hourGrid = buildHourGridModel(slice, HOUR_GRID_BASIS);
      expect(hourGrid.cells).toHaveLength(HOUR_CELL_COUNT);
      const durations = buildDurationRows(slice.bins, slice.sessions);
      expect(durations).toHaveLength(DURATION_BIN_COUNT);
      expect(durations.reduce((total, row) => total + row.count, 0)).toBe(expected.sessions);
    },
    SCALE_TEST_TIMEOUT_MS,
  );

  test(
    'answers every split value equal to the analytic key (D-02 within D-03)',
    async () => {
      expect(expected.splitColumn).toBe('SERVER_NAME');
      expect(expected.values.length).toBeGreaterThan(1);

      const all = await query(10, null);
      expect(all.type).toBe('playtime-result');
      if (all.type !== 'playtime-result' || all.view?.status !== 'ready') return;
      expect(all.view.split?.column).toBe(expected.splitColumn);
      // The display projection flattens the blank server to `''`; the STORED
      // value list keeps `null`, and `splitValue` in playtime-state maps the
      // former back to the latter.
      expect(all.view.split?.values.map((entry) => entry.value)).toEqual(
        expected.values.map((value) => value ?? ''),
      );
      expect(all.view.split?.values.map((entry) => entry.seconds)).toEqual(expected.valueSeconds);
      expect(all.view.split?.allSeconds).toBe(expected.seconds);

      // One query per value, each answered over the SAME ingested dataset.
      // `queryId` is its own namespace and never an ingest jobId.
      for (let index = 0; index < expected.values.length; index += 1) {
        const reply = await query(11 + index, index);
        expect(reply.type, `value ${index} reply type`).toBe('playtime-result');
        if (reply.type !== 'playtime-result' || reply.view?.status !== 'ready') return;

        const slice = reply.view.slice;
        expect(reply.queryId).toBe(11 + index);
        expect(reply.view.selected, `value ${index} selected`).toBe(index);
        expect(slice.seconds, `value ${index} seconds`).toBe(expected.valueSeconds[index]);
        expect(slice.sessions, `value ${index} sessions`).toBe(expected.valueSessions[index]);
        expect(slice.excluded, `value ${index} excluded`).toBe(expected.valueExcluded[index]);
        // A per-value slice can never draw more days than the active years
        // have. The SESSION RATIO is deliberately not used as the bound: at
        // 60,000 sessions a value's day array fills faster than the All
        // slice's, so a 12x bound would be a bound on the wrong quantity.
        expect(
          slice.dayIndex.length,
          `value ${index} day count (${expected.values[index]})`,
        ).toBeLessThanOrEqual(expected.calendarCells);
      }
    },
    SCALE_TEST_TIMEOUT_MS,
  );

  test(
    'stores an aggregate bounded by days times values, and never the address (T-04-01 at scale)',
    async () => {
      const { db } = await importWorkerDb();
      const meta = await db.meta.get('active');
      expect(meta).toBeDefined();
      // `playtime` is `PlaytimeAggregates | null` on the record: 04-06 made a
      // FAILED aggregation store null rather than a partial object, so the
      // undefined check alone would not narrow it.
      const aggregate = meta?.playtime ?? undefined;
      expect(aggregate).toBeDefined();
      if (aggregate === undefined) return;

      // The bound is computed from the fixture's key — the days in the active
      // years and the number of split values — and is the SAME number the
      // 5,000-session preset produces, because both fixtures cover the same
      // years with the same number of values.
      const bound = storedSizeBound(expected.calendarCells, expected.values.length);
      const measured = JSON.stringify(aggregate).length;
      expect(measured, `stored aggregate JSON length (bound ${bound})`).toBeLessThanOrEqual(bound);

      // T-04-01, at the size where a leaked column would actually hurt: the
      // Sessions address is read by no part of the aggregation, so it cannot be
      // anywhere in the stored aggregate.
      expect(JSON.stringify(aggregate)).not.toContain(SESSION_FIXTURE_IP);

      // The aggregate really is the worker's, and it is complete: one slice per
      // value plus All, each with the full per-day and per-hour shape.
      expect(aggregate.values).toEqual(expected.values);
      expect(aggregate.splitColumn).toBe(expected.splitColumn);
      expect(aggregate.all.sessions).toBe(expected.sessions);
      expect(aggregate.byValue).toHaveLength(expected.values.length);
      for (const slice of [aggregate.all, ...aggregate.byValue]) {
        expect(slice.dayIndex.length).toBeLessThanOrEqual(expected.calendarCells);
        expect(slice.hourOverlap).toHaveLength(HOUR_CELL_COUNT);
        expect(slice.hourStart).toHaveLength(HOUR_CELL_COUNT);
        expect(slice.bins).toHaveLength(DURATION_BIN_COUNT);
      }
    },
    SCALE_TEST_TIMEOUT_MS,
  );
});

// =============================================================================
// 01-11 -- CR-01 / W-1: an ambiguous root fails closed through the real worker
// =============================================================================
//
// 01-REVIEW.md CR-01: `123/User_Info/Account_Info.csv`,
// `123/Activity_history/a.csv` and `Clans/b.csv` used to classify ok with
// `accountRoot: ''` and the real account folder `123` filed as an unknown
// category. The worker then parsed `123/User_Info/Account_Info.csv` under
// category '123', the folder-name strip never ran, and LOGIN plus the birth
// columns were written to IndexedDB. The importer must refuse the archive
// instead (T-01-42): an `error` response, nothing persisted, no email.
// =============================================================================

describe('01-11 — CR-01: an ambiguous root fails closed through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  test('(a) the review repro posts "error", persists nothing and leaves no email in IndexedDB', async () => {
    const terminal = await ingestWith(postSpy, buildAmbiguousRootExport(), 'ambiguous-root.zip');
    expect(terminal.type).toBe('error');

    const { db } = await importWorkerDb();
    expect(await db.rows.count()).toBe(0);
    expect(await db.meta.get('active')).toBeUndefined();

    const dump = JSON.stringify({
      rows: await db.rows.toArray(),
      meta: await db.meta.toArray(),
    });
    expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
  });
});

// =============================================================================
// 01-13 -- CR-01 layer 2: the strip is keyed on the header, not the folder
// =============================================================================
//
// 01-REVIEW.md CR-01 fix layer 2. Plan 01-11 closed the reproduced
// classification path; this describe pins the guarantee independent of
// classification being right. The folder a CSV is filed under is
// attacker-controlled, and a User_Info-shaped file filed under any category
// name that classification still accepts must lose LOGIN, BIRTH_DATE and
// BIRTH_DATE_SRC before it is written (03-CONTEXT D-18, widened by this plan
// from "User_Info only" to "any row carrying the header"; T-01-48).
// =============================================================================

// Phase 9 (D-18) rewrote the three tests in this describe. The worker now
// parses rows of an unknown category for their COUNTS and does not store them,
// so a test that asserted "the misfiled copy under `UserInfo/` was persisted
// with its sensitive columns removed" had nothing left to assert against. Each
// test keeps its own question and its non-vacuity, restated for the new rule:
//
//   - `UserInfo/` and `Weird/` are UNKNOWN categories: their row counts must
//     still be reported (that is the sentence the UI shows), and zero rows of
//     theirs may be stored;
//   - `Activity_history/` is SUPPORTED: its copy is stored and stripped, which
//     is where the header-keyed strip is now exercised end to end.
//
// The whole-dump value scans are unchanged and still carry the weight — a
// leak is a leak whether the row was dropped by the strip or by D-18, and the
// tests must not become satisfied by a rule that stops storing rows at all.
describe('01-13 — CR-01 layer 2: the strip is keyed on the header, not the folder', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  test('(a) Account_Info files filed under UserInfo, Weird/User_Info and Activity_history persist without LOGIN or birth columns', async () => {
    const terminal = await ingestWith(
      postSpy,
      buildMisfiledAccountInfoExport(),
      'misfiled-account-info.zip',
    );
    // Classification accepts the shape: UserInfo and Weird are unknown
    // categories under the real account root, so the export is not refused.
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // Non-vacuity (D-18): the unknown folders are still PARSED, so their counts
    // are still reported — the sentence the "Not yet supported" pane shows is
    // not affected by the rows not being stored.
    for (const name of ['UserInfo', 'Weird']) {
      const entry = terminal.result.categories.find((c) => c.name === name);
      expect(entry, `category ${name}`).toBeDefined();
      expect(entry!.rowCount ?? 0, `rowCount of ${name}`).toBeGreaterThan(0);
    }

    const { db } = await importWorkerDb();
    const all = await db.rows.toArray();
    // D-18: nothing of an unknown category reaches storage, under either
    // folder spelling.
    expect(all.filter((r) => r.category === 'UserInfo')).toHaveLength(0);
    expect(all.filter((r) => r.category === 'Weird')).toHaveLength(0);

    // The supported-folder copy IS stored, and the header-keyed strip is what
    // stands between it and IndexedDB — unchanged and root-agnostic (D-19).
    const supported = all.filter(
      (r) => r.category === 'Activity_history' && r.sourceFile === 'Account_Info.csv',
    );
    expect(supported.length).toBeGreaterThan(0);
    for (const row of supported) {
      for (const key of Object.keys(row.data)) {
        expect(SENSITIVE_KEY.test(key.trim().toUpperCase()), `key ${key}`).toBe(false);
        expect(key).not.toBe('__parsed_extra');
      }
    }

    const dump = JSON.stringify({ rows: all, meta: await db.meta.toArray() });
    expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
    expect(dump).not.toContain(SAMPLE_BIRTH_DATE);

    // The strip narrows three columns only: IP is still stored.
    expect(supported[0]!.data['IP']).toBe(SAMPLE_IP);
  });

  test('(b) a rootless archive whose User_Info sits beyond the 01-11 depth bound persists without LOGIN or birth columns', async () => {
    const terminal = await ingestWith(
      postSpy,
      buildBeyondBoundNestExport(),
      'beyond-bound-nest.zip',
    );
    // Layer 1 deliberately accepts this shape (the nest is one level past
    // MAX_WRAPPER_DEPTH), so reaching 'done' documents that only the
    // header-keyed strip stands between the file and IndexedDB.
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // Non-vacuity: the account file was parsed under the unknown category, and
    // D-18 keeps the count even though it keeps none of the rows.
    const wrapper = terminal.result.categories.find((c) => c.name === 'Wrapper');
    expect(wrapper, 'category Wrapper').toBeDefined();
    expect(wrapper!.rowCount ?? 0).toBeGreaterThan(0);

    const { db } = await importWorkerDb();
    const all = await db.rows.toArray();
    expect(all.filter((r) => r.category === 'Wrapper')).toHaveLength(0);

    const dump = JSON.stringify({ rows: all, meta: await db.meta.toArray() });
    expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
    expect(dump).not.toContain(SAMPLE_BIRTH_DATE);
  });

  test('(c) controls: LOGIN_DT survives, a row with no deny-listed header keeps its overflow bucket, real User_Info is stripped as before', async () => {
    const terminal = await ingestWith(
      postSpy,
      buildMisfiledAccountInfoExport(),
      'misfiled-controls.zip',
    );
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    // The identity pick still reads only the real User_Info rows: the three
    // misfiled copies must not change what the header shows.
    expect(terminal.result.identity).toEqual(EXPECTED_SAMPLE_IDENTITY);

    const { db } = await importWorkerDb();
    const all = await db.rows.toArray();

    // A header only LIKE the deny-list is not touched: LOGIN_DT is the login
    // time column and `_\d+` needs digits.
    const logins = all.filter(
      (r) => r.category === 'Activity_history' && r.sourceFile === 'Logins.csv',
    );
    expect(logins.length).toBeGreaterThan(0);
    for (const row of logins) expect(Object.keys(row.data)).toContain('LOGIN_DT');

    // No deny-listed header, outside User_Info: stored exactly as before,
    // overflow bucket included (T-01-49). Sanitising every row would drop it.
    // The file sits in the SUPPORTED `Activity_history` folder since Phase 9
    // (D-18) — a control in an unknown folder would no longer be stored at all,
    // and the assertion would go quiet rather than fail.
    const ragged = all.filter(
      (r) => r.category === 'Activity_history' && r.sourceFile === 'Ragged.csv',
    );
    expect(ragged.length).toBeGreaterThan(0);
    for (const row of ragged) {
      expect((row.data as Record<string, unknown>)['__parsed_extra']).toEqual([
        RAGGED_OVERFLOW_MARKER,
      ]);
    }

    // The other half of the same rule (D-18): the UNKNOWN folders of this same
    // fixture are counted and not stored.
    for (const name of ['UserInfo', 'Weird']) {
      const entry = terminal.result.categories.find((c) => c.name === name);
      expect(entry!.rowCount ?? 0, `rowCount of ${name}`).toBeGreaterThan(0);
      expect(
        all.filter((r) => r.category === name),
        `stored rows of ${name}`,
      ).toHaveLength(0);
    }

    // The sample's real User_Info rows are stripped exactly as before.
    const realUserInfo = all.filter((r) => r.category === 'User_Info');
    expect(realUserInfo.length).toBeGreaterThan(0);
    for (const row of realUserInfo) {
      for (const key of Object.keys(row.data)) {
        expect(SENSITIVE_KEY.test(key.trim().toUpperCase()), `key ${key}`).toBe(false);
        expect(key).not.toBe('__parsed_extra');
      }
    }
  });
});

// =============================================================================
// 01-14 -- WR-03: an over-declared entry is rejected before it is inflated
// =============================================================================
//
// 01-REVIEW.md WR-03 / 01-VERIFICATION.md W-2. `unzipSync` in handleIngest used
// to inflate every entry that resolved to a category CSV with no size check, so
// a small archive whose central directory declares a huge uncompressed size
// could force a very large allocation in the worker. The cap is enforced in the
// filter, which fflate calls BEFORE it allocates for an entry (T-01-52).
//
// The archive here is not large: one STORED entry whose central-directory
// uncompressed-size field is patched. A worker with no cap accepts it (a stored
// entry never allocates from the declared size), so this test is red against
// the old worker without ever allocating anything.
// =============================================================================

describe('01-14 — WR-03: an over-declared entry is rejected before it is inflated', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  test('(a) an entry declaring more than MAX_ENTRY_BYTES posts "error" with a fixed detail and persists nothing', async () => {
    const terminal = await ingestWith(
      postSpy,
      buildOversizedEntryExport(MAX_ENTRY_BYTES + 1),
      'oversized-entry.zip',
    );
    expect(terminal.type).toBe('error');
    if (terminal.type !== 'error') return;

    // The fixed phrase, and nothing the archive chose: the detail crosses the
    // worker boundary (T-01-53, 01-UAT test 17).
    expect(terminal.detail).toContain('entry too large');
    expect(terminal.detail).not.toContain('Sessions.csv');

    const { db } = await importWorkerDb();
    expect(await db.rows.count()).toBe(0);
    expect(await db.meta.get('active')).toBeUndefined();
  });
});

// =============================================================================
// 02-05 Task 1 (tracer) -- CR-03: a ragged row must not let LOGIN;BIRTH_DATE
// content past the header-keyed strip
// =============================================================================
//
// 02-REVIEW.md CR-03. PapaParse sniffed the delimiter from the body, so one
// short row in a two-column file flipped it to a comma and glued every line
// under the single key `LOGIN;BIRTH_DATE`, which the anchored D-18 deny-list
// does not match. The email then rested in IndexedDB.
//
// FIXTURE SHAPE (load-bearing): the file starts DIRECTLY with the header, no
// leading CRLF and no blank line, and the short row is the ninth record, inside
// PapaParse's ten-record sniffing window. A CRLF-wrapped file would be sniffed
// correctly and this test would pass against the unfixed parser.
// =============================================================================

describe('02-05 -- CR-03: a ragged LOGIN;BIRTH_DATE file persists no sensitive value', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  /** Header, seven sensitive rows, one short row: nine records, CRLF, no blanks. */
  function raggedSensitiveCsv(): string {
    const lines = ['LOGIN;BIRTH_DATE'];
    for (let i = 0; i < 7; i++) lines.push(`${SAMPLE_LOGIN};${SAMPLE_BIRTH_DATE}`);
    lines.push('99');
    return lines.join('\r\n') + '\r\n';
  }

  test('a User_Info file and a misfiled copy both persist without the email or the birth date', async () => {
    const csv = raggedSensitiveCsv();
    // The misfiled copy moved from `Weird/` to the SUPPORTED
    // `Activity_history/` folder in Phase 9 (D-18): a copy under an unknown
    // folder is counted and dropped now, so the assertion that it is persisted
    // *stripped* — which is the point of this test — would have nothing to
    // look at. A second copy stays in `Weird/` as the D-18 control.
    const bytes = buildCustomExport({
      overrides: {
        'User_Info/Account_Info.csv': csv,
        'Activity_history/Contacts.csv': csv,
        'Weird/Contacts.csv': csv,
      },
    });
    const terminal = await ingestWith(postSpy, bytes, 'ragged-sensitive.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    const { db } = await importWorkerDb();
    const all = await db.rows.toArray();

    // Non-vacuity: both SUPPORTED files produced rows, so the scans below have
    // something to scan.
    expect(all.filter((r) => r.category === 'User_Info').length).toBeGreaterThan(0);
    expect(
      all.filter((r) => r.category === 'Activity_history' && r.sourceFile === 'Contacts.csv')
        .length,
    ).toBeGreaterThan(0);
    // The unknown folder is counted and not stored.
    const weird = terminal.result.categories.find((c) => c.name === 'Weird');
    expect(weird, 'category Weird').toBeDefined();
    expect(weird!.rowCount ?? 0).toBeGreaterThan(0);
    expect(all.filter((r) => r.category === 'Weird')).toHaveLength(0);

    const dump = JSON.stringify({ rows: all, meta: await db.meta.toArray() });
    expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
    expect(dump).not.toContain(SAMPLE_BIRTH_DATE);

    for (const row of all) {
      for (const key of Object.keys(row.data)) {
        expect(key, `row key ${key}`).not.toContain(';');
        expect(SENSITIVE_KEY.test(key.trim().toUpperCase()), `key ${key}`).toBe(false);
      }
    }
  });
});

// =============================================================================
// 02-05 Task 2 -- CR-01 / CR-02: the restored real-shape malformed fixture
// =============================================================================
//
// `buildMalformedRowsExport` was bent in 02-02 (no leading CRLF, the malformed
// row LAST) to dodge the CR-02 index shift. It is restored to the real export
// shape: a leading CRLF, a blank line between every record, and the malformed
// record BETWEEN valid ones. The parser is what is fixed.
// =============================================================================

describe('02-05 -- CR-01/CR-02: the real-shape malformed Bans file through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  test('Bans keeps its three valid rows and counts exactly one skip; no other category skips', async () => {
    const terminal = await ingestWith(postSpy, buildMalformedRowsExport(), 'malformed.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    const bans = terminal.result.categories.find((c) => c.name === 'Bans');
    expect(bans, 'Bans category present').toBeDefined();
    expect(bans!.rowCount).toBe(MALFORMED_ROW_EXPECTED_ROW_COUNT);
    expect(bans!.skippedRowCount).toBe(MALFORMED_ROW_EXPECTED_SKIPPED_COUNT);

    for (const entry of terminal.result.categories) {
      if (entry.name === 'Bans') continue;
      expect(entry.skippedRowCount ?? 0, `category ${entry.name} skippedRowCount`).toBe(0);
    }

    // Phase 9 (D-18): `Bans` is an unknown category, so its rows are parsed for
    // these counts and never stored. The counts above are therefore read from
    // the WORKER result — the only place they now exist — and the per-row
    // values are asserted on the function the worker calls, on the same bytes.
    const { db } = await importWorkerDb();
    expect((await db.rows.toArray()).filter((r) => r.category === 'Bans')).toHaveLength(0);

    const parsed = parseCsvFile(MALFORMED_BANS_CSV, 'Bans', 'Bans.csv');
    expect(parsed.rows.length).toBe(MALFORMED_ROW_EXPECTED_ROW_COUNT);
    expect(parsed.skippedCount).toBe(MALFORMED_ROW_EXPECTED_SKIPPED_COUNT);
    // The three surviving rows are the valid ones, in source order.
    expect(parsed.rows.map((r) => r.data['BAN_REASON'])).toEqual([
      'reason_alpha',
      'reason_beta',
      'reason_gamma',
    ]);
  });
});

// =============================================================================
// 02-06 Task 1 (tracer) -- W-1: a lookalike LOGIN / BIRTH_DATE header must not
// let the e-mail or the birth date reach IndexedDB
// =============================================================================
//
// 02-VERIFICATION.md W-1. `normalizeKey` was trim plus upper-case, so a header
// spelled with fullwidth letters or a Cyrillic / Greek lookalike matched neither
// the header-keyed D-18 strip nor the 02-05 glued withhold. The existing
// ASCII-only SENSITIVE_KEY scan proves nothing for such a key, so the guards
// here are value dumps plus EXACT key lists.
//
// Every Unicode string is written with \u escapes so the code point in use is
// visible in review.
// =============================================================================

describe('02-06 -- W-1: a lookalike LOGIN / BIRTH_DATE header persists no sensitive value', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  /** `ID;<login>;<birth>;NAME` plus eight rows, CRLF, no blank line. */
  function lookalikeCsv(loginKey: string, birthKey: string): string {
    const lines = [`ID;${loginKey};${birthKey};NAME`];
    for (let i = 0; i < 8; i++) {
      lines.push(`${i};${SAMPLE_LOGIN};${SAMPLE_BIRTH_DATE};n${i}`);
    }
    return lines.join('\r\n') + '\r\n';
  }

  const STRIPPED: ReadonlyArray<{ label: string; login: string; birth: string }> = [
    { label: 'Cyrillic O in LOGIN', login: 'L\u041EGIN', birth: 'BIRTH_DATE' },
    {
      label: 'fullwidth LOGIN and BIRTH_DATE',
      login: '\uFF2C\uFF2F\uFF27\uFF29\uFF2E',
      birth: '\uFF22\uFF29\uFF32\uFF34\uFF28_\uFF24\uFF21\uFF34\uFF25',
    },
    {
      label: 'Greek Omicron and Nu in LOGIN, Greek Alpha and Epsilon in BIRTH_DATE',
      login: 'L\u039FGI\u039D',
      birth: 'BIRTH_D\u0391T\u0395',
    },
  ];

  for (const c of STRIPPED) {
    test(`stripped: ${c.label} -- User_Info and a misfiled folder persist exactly [ID, NAME]`, async () => {
      const csv = lookalikeCsv(c.login, c.birth);
      // Phase 9 (D-18): the misfiled copy lives in the SUPPORTED
      // `Activity_history/` folder, so it is stored and the assertion below has
      // rows to inspect; a copy in the unknown `Weird/` folder is counted and
      // dropped, and is asserted as that instead.
      const bytes = buildCustomExport({
        overrides: {
          'User_Info/Account_Info.csv': csv,
          'Activity_history/Contacts.csv': csv,
          'Weird/Contacts.csv': csv,
        },
      });
      const terminal = await ingestWith(postSpy, bytes, 'lookalike.zip');
      expect(terminal.type).toBe('done');
      if (terminal.type !== 'done') return;

      const { db } = await importWorkerDb();
      const all = await db.rows.toArray();
      for (const [category, sourceFile] of [
        ['User_Info', 'Account_Info.csv'],
        ['Activity_history', 'Contacts.csv'],
      ]) {
        const persisted = all.filter((r) => r.category === category && r.sourceFile === sourceFile);
        expect(persisted, `${category} rows`).toHaveLength(8);
        for (const row of persisted) {
          expect(Object.keys(row.data), `${category} key list`).toEqual(['ID', 'NAME']);
        }
      }

      // The D-18 half: counted, reported, not stored.
      const weird = terminal.result.categories.find((entry) => entry.name === 'Weird');
      expect(weird, 'Weird category present').toBeDefined();
      expect(weird!.rowCount ?? 0).toBe(8);
      expect(all.filter((r) => r.category === 'Weird')).toHaveLength(0);

      const dump = JSON.stringify({ rows: all, meta: await db.meta.toArray() });
      expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
      expect(dump).not.toContain(SAMPLE_BIRTH_DATE);
    });
  }

  const WITHHELD: ReadonlyArray<{ label: string; login: string }> = [
    { label: 'Armenian Oh inside LOGIN', login: 'L\u0555GIN' },
    { label: 'zero-width space inside LOGIN', login: 'LO\u200BGIN' },
  ];

  for (const c of WITHHELD) {
    test(`withheld: ${c.label} -- the category reports 0 rows and 8 skipped, nothing persists`, async () => {
      const csv = lookalikeCsv(c.login, 'BIRTH_DATE');
      const bytes = buildCustomExport({
        overrides: { 'User_Info/Account_Info.csv': csv, 'Weird/Contacts.csv': csv },
      });
      const terminal = await ingestWith(postSpy, bytes, 'lookalike-withheld.zip');
      expect(terminal.type).toBe('done');
      if (terminal.type !== 'done') return;

      const weird = terminal.result.categories.find((entry) => entry.name === 'Weird');
      expect(weird, 'Weird category present').toBeDefined();
      expect(weird!.rowCount).toBe(0);
      expect(weird!.skippedRowCount).toBe(8);

      // The SUPPORTED folder's copy is withheld by the 02-05 rule, so it is
      // stored zero rows too \u2014 which is a DIFFERENT reason from D-18 and is
      // what keeps this test honest about the withhold itself.
      const userInfo = terminal.result.categories.find((entry) => entry.name === 'User_Info');
      expect(userInfo!.rowCount).toBe(0);
      expect(userInfo!.skippedRowCount).toBe(8);

      const { db } = await importWorkerDb();
      const all = await db.rows.toArray();
      expect(all.filter((r) => r.category === 'Weird')).toHaveLength(0);
      expect(all.filter((r) => r.category === 'User_Info')).toHaveLength(0);
      const dump = JSON.stringify({ rows: all, meta: await db.meta.toArray() });
      expect(dump).not.toContain(SAMPLE_LOGIN_DOMAIN);
      expect(dump).not.toContain(SAMPLE_BIRTH_DATE);
    });
  }
});

// =============================================================================
// 02-06 Task 2 -- W-2: a file that mixes CRLF, bare CR and LF through the real
// worker
// =============================================================================
//
// 02-VERIFICATION.md W-2. Before the change the Bans file below imported two
// rows (the others were glued into neighbouring cells) with skippedRowCount 0.
// =============================================================================

describe('02-06 -- W-2: mixed terminators through the real worker', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    vi.resetModules();
    await deleteActiveDatabase();
    postSpy = vi.fn();
    (globalThis as unknown as { self: WorkerScopeLike }).self = {
      postMessage: postSpy as unknown as (message: IngestResponse) => void,
      onmessage: null,
    };
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  const BANS_HEADER = 'BAN_DT;BAN_REASON;BAN_EXPIRES_AT';
  const record = (n: number): string => `2020-0${n}-01 00:00:00;reason_${n};2020-0${n}-08 00:00:00`;

  async function ingestBans(text: string) {
    const bytes = buildCustomExport({ overrides: { 'Bans/Bans.csv': text } });
    const terminal = await ingestWith(postSpy, bytes, 'mixed-terminators.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') throw new Error('not done');
    const bans = terminal.result.categories.find((c) => c.name === 'Bans');
    expect(bans, 'Bans category present').toBeDefined();
    const { db } = await importWorkerDb();
    const rows = (await db.rows.toArray()).filter((r) => r.category === 'Bans');
    return { bans: bans!, rows };
  }

  test('CRLF, LF, CR, CRLF, LF: every record is its own row, values hold no line break', async () => {
    const text =
      BANS_HEADER +
      '\r\n' +
      record(1) +
      '\n' +
      record(2) +
      '\r' +
      record(3) +
      '\r\n' +
      record(4) +
      '\n';
    const { bans, rows } = await ingestBans(text);

    expect(bans.rowCount).toBe(4);
    expect(bans.skippedRowCount).toBe(0);
    // D-18: `Bans` is unknown, so none of those rows is stored. The per-record
    // assertions move to the function the worker calls, on the same text.
    expect(rows).toHaveLength(0);

    const parsed = parseCsvFile(text, 'Bans', 'Bans.csv');
    expect(parsed.rows.map((r) => r.data['BAN_REASON'])).toEqual([
      'reason_1',
      'reason_2',
      'reason_3',
      'reason_4',
    ]);
    for (const row of parsed.rows) {
      expect(Object.keys(row.data)).toEqual(['BAN_DT', 'BAN_REASON', 'BAN_EXPIRES_AT']);
      for (const value of Object.values(row.data)) {
        expect(String(value)).not.toMatch(/[\r\n]/);
      }
    }
  });

  test('a stray-quote record between mixed terminators costs exactly one row and counts one skip', async () => {
    const stray = '2020-02-01 00:00:00;"unterminated;2020-02-08';
    const text =
      BANS_HEADER +
      '\r\n' +
      record(1) +
      '\n' +
      stray +
      '\r\n' +
      record(3) +
      '\r' +
      record(4) +
      '\r\n';
    const { bans, rows } = await ingestBans(text);

    expect(bans.rowCount).toBe(3);
    expect(bans.skippedRowCount).toBe(1);
    expect(rows).toHaveLength(0);

    const parsed = parseCsvFile(text, 'Bans', 'Bans.csv');
    expect(parsed.rows.map((r) => r.data['BAN_REASON'])).toEqual([
      'reason_1',
      'reason_3',
      'reason_4',
    ]);
  });
});
