import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_ROW_COUNTS,
  buildSampleExport,
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
});
