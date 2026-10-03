import { vi } from 'vitest';
import type {
  IngestRequest,
  IngestResponse,
  WorkerScopeLike,
} from '../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// worker-harness.ts — drive ingest.worker.ts under Vitest (05-03-PLAN Task 1)
//
// =============================================================================
//
// Why this file exists:
//
//   The two guarantees this plan adds are only observable at the WORKER's
//   boundary. `Financial_data` classifying as `supported` is decided inside
//   the worker (classify + parse), and repairing a stale `unknown` status in
//   a user's cache happens in `resultFromMeta`, which is reached only by the
//   `cache-status` and `duplicate` REPLAYS — not by an import. A unit test
//   of `classifyFolder` alone would prove neither: one needs a real ingest
//   through the module, the other needs the stored meta record written by
//   that ingest and then re-read.
//
//   So the technique is: fake `self`, dynamic-import the worker module, and
//   poke its wired `onmessage`. That technique already exists inline in
//   `tests/unit/import/ingest-worker.test.ts`, but as private helpers of ONE test
//   file. Plan 05-07 needs the same driver to read a dataset back through
//   the worker, and this plan needs it for the replay path — extracting it
//   here keeps one copy of the tricky part (install the fake `self` BEFORE
//   the import, because the worker captures `self` at module-init time) and
//   lets each test file state only what it is proving.
//
//   REUSE NOTE (plan 05-07): import these helpers rather than re-deriving
//   the fake-`self` dance. `tests/unit/import/ingest-worker.test.ts` deliberately
//   keeps its own copy: it was written first, its `waitForTerminal` carries
//   a per-call timeout parameter the scale tests need, and rewriting a file
//   four phases of tests depend on is not worth the dedup. Two copies of a
//   30-line harness is cheaper than one shared abstraction with a
//   superset-of-every-caller signature.
//
// Module-graph note: `loadWorker()` imports the worker through the dynamic
// import that `vi.resetModules()` (inside `installWorkerScope`) just
// invalidated, so a test that later statically imports `db.ts` gets the very
// same Dexie singleton instance the worker wrote through — one database, one
// instance, so an assertion about stored rows is an assertion about what the
// worker actually persisted.
// =============================================================================

/** The `postMessage` spy installed on the fake `self`. */
export type WorkerPostSpy = ReturnType<typeof vi.fn>;

/** The `onmessage` handler the worker module wires at import time. */
export type WorkerOnMessage = (event: MessageEvent<IngestRequest>) => void;

/** The fake `self` the worker module sees as `WorkerScopeLike`. */
function fakeSelf(postMessage: WorkerPostSpy): WorkerScopeLike {
  // The spy is typed as a Mock and assigned to a structural slot expecting
  // `(message: IngestResponse) => void`, so the cast is what keeps every
  // call site in the test files free of one.
  return {
    postMessage: postMessage as unknown as (message: IngestResponse) => void,
    onmessage: null,
  };
}

/**
 * Reset the module registry and install a fresh fake `self` carrying a
 * `postMessage` spy.
 *
 * The ORDER is load-bearing and is the whole trick: the worker reads `self`
 * at module-init time (`const scope = self as unknown as WorkerScopeLike`),
 * so the fake must be in place BEFORE `loadWorker()` runs, and
 * `vi.resetModules()` must run before that so a fresh `db` singleton is
 * created per test rather than inherited from the previous one.
 *
 * Returns the spy, so a test can read the calls it accumulates.
 */
export function installWorkerScope(): WorkerPostSpy {
  vi.resetModules();
  const postSpy = vi.fn();
  (globalThis as unknown as { self: WorkerScopeLike }).self = fakeSelf(postSpy);
  return postSpy;
}

/**
 * Dynamic-import the worker module, which wires `self.onmessage` and posts
 * its `{ type: 'ready' }` handshake.
 *
 * Call AFTER `installWorkerScope()`.
 */
export async function loadWorker(): Promise<void> {
  await import('../../src/lib/worker/ingest.worker.ts');
}

/** The `onmessage` the loaded worker module wired, or a clear failure. */
export function workerOnMessage(): WorkerOnMessage {
  const onmessage = (globalThis as unknown as { self: WorkerScopeLike }).self.onmessage;
  if (typeof onmessage !== 'function') {
    throw new Error(
      'workerOnMessage: self.onmessage is not a function — call installWorkerScope() then loadWorker() first',
    );
  }
  return onmessage;
}

/**
 * Hand the loaded worker one request, the way the main thread would.
 *
 * Fire-and-forget: the worker's handler is `async`, so this returns as soon
 * as the handler has started. Pair it with `waitForMessage` to await the
 * reply.
 */
export function postRequest(request: IngestRequest): void {
  workerOnMessage()({ data: request } as MessageEvent<IngestRequest>);
}

/**
 * Wait for the first posted message whose `type` matches, polling every
 * 5 ms up to `timeoutMs`.
 *
 * Matches by TYPE only and scans the spy's whole call history, so a test
 * that posts several requests must `mockClear()` the spy between phases if
 * it wants the later one rather than the earlier one of the same type.
 * Throws on timeout, naming the message types seen so far.
 */
export async function waitForMessage(
  spy: WorkerPostSpy,
  type: IngestResponse['type'],
  timeoutMs = 10_000,
): Promise<IngestResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg && msg.type === type) return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(
    `waitForMessage('${type}'): timed out after ${timeoutMs} ms. Calls so far: ${JSON.stringify(
      spy.mock.calls.map((c) => (c[0] as IngestResponse | undefined)?.type ?? 'no-type'),
    )}`,
  );
}

/**
 * Wait for the terminal reply of an ingest (`done` | `duplicate` | `error`)
 * and return it.
 */
export async function waitForTerminal(
  spy: WorkerPostSpy,
  timeoutMs = 10_000,
): Promise<IngestResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg && (msg.type === 'done' || msg.type === 'duplicate' || msg.type === 'error')) {
        return msg;
      }
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(
    `waitForTerminal: timed out after ${timeoutMs} ms. Calls so far: ${JSON.stringify(
      spy.mock.calls.map((c) => (c[0] as IngestResponse | undefined)?.type ?? 'no-type'),
    )}`,
  );
}

/** Build the `File` the worker expects for an ingest request. */
export function fileFromBytes(bytes: Uint8Array, name: string): File {
  // File's `BlobPart` type wants `ArrayBuffer` (not `SharedArrayBuffer`); the
  // bytes are the test's own buffer from `zipSync`, so the cast is sound.
  return new File([bytes as BlobPart], name, { type: 'application/zip' });
}

/**
 * Ingest one export through the loaded worker and return its terminal reply.
 *
 * Assumes `installWorkerScope()` + `loadWorker()` have already run. The spy
 * is NOT cleared here, so a test that asserts on intermediate `stage`
 * messages can still read them after this resolves.
 */
export async function ingestExport(
  spy: WorkerPostSpy,
  bytes: Uint8Array,
  name: string,
  timeoutMs = 10_000,
): Promise<IngestResponse> {
  postRequest({ type: 'ingest', jobId: 21, file: fileFromBytes(bytes, name) });
  return waitForTerminal(spy, timeoutMs);
}

/**
 * Delete the IndexedDB database db.ts uses, so the next test's worker starts
 * against an empty meta table.
 *
 * Resolves whether the delete succeeded, errored, or was blocked: a blocked
 * delete means another holder has the connection open, which in this
 * single-process test is safe to proceed past.
 */
export async function deleteActiveDatabase(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('wg-export-viewer');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/**
 * The worker's own Dexie module, imported AFTER `loadWorker()`.
 *
 * The dynamic import resolves through the registry `installWorkerScope()`
 * just reset, so this is the SAME module instance — and therefore the same
 * `db` singleton — the worker wrote through. That shared identity is what
 * makes "read the stored meta record" a real assertion about the worker's
 * own write.
 */
export async function importWorkerDb() {
  return import('../../src/lib/worker/db.ts');
}
