import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
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
  SAMPLE_LOGIN_DOMAIN,
  SAMPLE_NICKNAME,
  SAMPLE_REGION,
  LONG_NICKNAME,
  LONG_UNKNOWN_FOLDER,
  SAMPLE_ROW_COUNTS,
  VARIANT_CREATED_AT,
  VARIANT_NICKNAME,
  VARIANT_OVERFLOW_CANARY,
  VARIANT_REGION,
  buildAccountInfoVariantExport,
  buildCaseVariantFoldersExport,
  buildEmptyAccountInfoExport,
  buildLargeExport,
  buildLowercaseUserInfoFolderExport,
  buildMissingPaymentHistoryExport,
  buildMissingUserInfoExport,
  buildMultiRowAccountInfoExport,
  buildOnlySupportedExport,
  buildLongTextExport,
  buildCustomExport,
  buildSampleExport,
  buildZeroRowPaymentExport,
} from '../fixtures/export-fixtures.ts';
import type {
  IngestRequest,
  IngestResponse,
  WorkerScopeLike,
} from '../../src/lib/types/worker-messages.ts';

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
 */
async function ingestWith(spy: ReturnType<typeof vi.fn>, bytes: Uint8Array, name: string) {
  await import('../../src/lib/worker/ingest.worker.ts');
  const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
  spy.mockClear();
  onmessage!({
    data: { type: 'ingest', jobId: 21, file: makeFileFromBytes(bytes, name) } as IngestRequest,
  } as MessageEvent<IngestRequest>);
  return waitForTerminal(spy);
}

/**
 * Import the worker's Dexie singleton. Called AFTER the worker module has
 * been imported so the dynamic import resolves to the very module
 * registration `vi.resetModules()` created for this test — the two share
 * one `db` instance, which is the whole point of the no-leak assertions.
 */
async function importWorkerDb() {
  return import('../../src/lib/worker/db.ts');
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
    await import('../../src/lib/worker/ingest.worker.ts');
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
      // contract: one synthetic data row per file.
      expect(entry.rowCount).toBe(SAMPLE_ROW_COUNTS[entry.name]);
    }

    // Every category type ('supported', 'known-deferred', 'unknown')
    // is represented — the parse scope is universal, not filtered.
    const statuses = new Set(result.categories.map((c) => c.status));
    expect(statuses.has('supported')).toBe(true);
    expect(statuses.has('known-deferred')).toBe(true);
    expect(statuses.has('unknown')).toBe(true);
  });

  test('(b) a second ingest of identical bytes posts "duplicate" and NEVER posts stage: "unzipping" (SC3)', async () => {
    await import('../../src/lib/worker/ingest.worker.ts');
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
    await import('../../src/lib/worker/ingest.worker.ts');
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
    await import('../../src/lib/worker/ingest.worker.ts');
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
    await import('../../src/lib/worker/ingest.worker.ts');
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
    expect(terminal.result.counts).toEqual({ supported: 4, 'known-deferred': 0, unknown: 0 });
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
