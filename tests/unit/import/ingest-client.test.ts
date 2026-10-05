import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GENERIC_FAILURE_MESSAGE, STAGE_TEXT } from '../../../src/lib/ui-copy.ts';
import { MIN_PROCESSING_MS, IngestClient } from '../../../src/lib/import/worker-client.svelte.ts';
import type {
  IngestRequest,
  IngestResponse,
  WorkerLike,
} from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// IngestClient — state-machine tests
// =============================================================================
//
// Why this file exists (01-04-PLAN Task 1, RED then GREEN):
//   01-01's baseline client left every failure branch as a #fail stub.
//   01-03 wired the worker's error detail format. This plan hardens the
//   client: a main-thread pre-check, full worker onerror/onmessageerror
//   handling, fail-fast when the worker dies before 'ready', stale-jobId
//   rejection, and a busy no-op. The single `#fail` path is the only
//   way to reach 'error' — D-07 (one error path) and Pitfall 2 (one
//   copy, not two) in the project research.
//
// Each test below targets ONE behavior bullet from 01-04-PLAN's <behavior>
// block. The `FakeWorker` is the seam 01-05 will reuse (its `makeClient`
// helper is the single construction point in this file).
//
// Environment: Node, vitest fake timers. The fake timers let us assert
// `vi.getTimerCount()` is 0 after a pre-check rejection (D-06: nothing
// auto-dismisses the banner).
// =============================================================================

/**
 * A structural fake of the WorkerLike interface. It records every
 * postMessage, exposes typed `emit*` helpers for the test to invoke
 * the corresponding on* handlers, and never spawns a real Worker.
 */
class FakeWorker implements WorkerLike {
  posts: IngestRequest[] = [];
  onmessage: ((event: MessageEvent<IngestResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  /** The transfer list of each post, aligned with `posts` (06-13: the city buffer). */
  transfers: (Transferable[] | undefined)[] = [];

  postMessage(message: IngestRequest, transfer?: Transferable[]): void {
    this.posts.push(message);
    this.transfers.push(transfer);
  }

  emit(response: IngestResponse): void {
    // Plain-object mocks: MessageEvent/ErrorEvent are browser globals
    // (Node ≥ 22 only — not portable to older runtimes). The handlers
    // only read event.data / event.message, so a structural cast is
    // enough and the tests run on any Node version.
    this.onmessage?.({ data: response } as MessageEvent<IngestResponse>);
  }

  emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  emitMessageError(): void {
    this.onmessageerror?.({} as MessageEvent);
  }
}

let fake: FakeWorker;
let client: IngestClient;

/**
 * Single construction point — plan 01-05 extends this helper. The
 * default floor is 0 ms so the pre-existing 01-04 immediate-transition
 * tests keep observing immediate terminal outcomes. New floor tests
 * in this file pass `{ minProcessingMs: undefined }` (or an explicit
 * number) to exercise the floor.
 */
function makeClient(options: { minProcessingMs?: number } = { minProcessingMs: 0 }): {
  client: IngestClient;
  fake: FakeWorker;
} {
  const f = new FakeWorker();
  const c = new IngestClient(() => f, options);
  // The constructor wires handlers synchronously, so we can return now.
  return { client: c, fake: f };
}

function makeFile(name: string, size = 10, type = 'application/zip'): File {
  // Node ≥ 22 has the global File constructor. We use empty buffer plus
  // explicit size where needed (Node's File respects an explicit size
  // argument; an empty array defaults to 0).
  const content = size === 0 ? new Uint8Array(0) : new Uint8Array(size).fill(0x20);
  return new File([content], name, { type });
}

beforeEach(() => {
  vi.useFakeTimers();
  ({ client, fake } = makeClient());
});

afterEach(() => {
  vi.useRealTimers();
});

// -----------------------------------------------------------------------------
// Handshake — 'ready' is required for any submission to post
// -----------------------------------------------------------------------------

describe("'ready' handshake", () => {
  test("the 'ready' message sets workerReady to true", () => {
    expect(client.workerReady).toBe(false);
    fake.emit({ type: 'ready' });
    expect(client.workerReady).toBe(true);
  });

  test("a submission while workerReady is false fails fast with 'worker-not-ready' and posts nothing", () => {
    expect(client.workerReady).toBe(false);
    const file = makeFile('export.zip', 10);
    const result = client.submitFiles([file]);

    expect(result).toBe(false);
    expect(fake.posts).toHaveLength(0);
    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(consoleSpyContains('worker-not-ready')).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Happy path — a single non-empty .zip posts exactly one ingest message
// -----------------------------------------------------------------------------

describe('submitFiles — happy path', () => {
  test('a single non-empty .zip returns true, posts one ingest message, sets processing/unzipping, clears the prior errorMessage', () => {
    // Seed a pre-check rejection first to prove the next submission re-arms.
    // (We do NOT seed a worker error event — by FA-01-04-3, a worker that
    // errors before 'ready' is permanently broken for the session, so it
    // would NOT recover. Pre-check rejections, by contrast, do not affect
    // the worker at all.)
    client.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);
    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);

    fake.emit({ type: 'ready' });
    const file = makeFile('export.zip', 100);
    const ok = client.submitFiles([file]);

    expect(ok).toBe(true);
    // After 02-02: the 'ready' handshake also posts a 'check-cache'
    // request (D-07/D-08). The ingest message is now jobId 2 (the
    // ready handler bumps #jobId to 1 first).
    const ingestPosts = fake.posts.filter((m) => m.type === 'ingest');
    expect(ingestPosts).toHaveLength(1);
    expect(ingestPosts[0]).toEqual({ type: 'ingest', jobId: 2, file });
    expect(client.state).toBe('processing');
    expect(client.stage).toBe('unzipping');
    expect(client.errorMessage).toBeNull();
  });

  test('a single non-empty .zip named "EXPORT.ZIP" (uppercase) is accepted', () => {
    fake.emit({ type: 'ready' });
    const file = makeFile('EXPORT.ZIP', 50);
    const ok = client.submitFiles([file]);
    expect(ok).toBe(true);
    // Same as the lowercase happy path: exactly one ingest message
    // (the check-cache handshake is filtered out).
    expect(fake.posts.filter((m) => m.type === 'ingest')).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// Pre-check rejection — console-only cause, never posts to the worker
// -----------------------------------------------------------------------------

describe('submitFiles — pre-check rejection', () => {
  test('zero files returns false, posts nothing, lands in error state with cause in the console', () => {
    fake.emit({ type: 'ready' });
    const ok = client.submitFiles([] as unknown as ArrayLike<File>);
    expect(ok).toBe(false);
    // After 02-02: the ready handshake posts a check-cache request
    // (D-07/D-08). The pre-check rejects BEFORE any ingest message
    // would be posted, so only the check-cache is on the wire.
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0]!.type).toBe('check-cache');
    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(consoleSpyContains('pre-check')).toBe(true);
  });

  test('two files returns false, posts nothing, lands in error state with cause in the console', () => {
    fake.emit({ type: 'ready' });
    const a = makeFile('a.zip', 10);
    const b = makeFile('b.zip', 10);
    const ok = client.submitFiles([a, b]);
    expect(ok).toBe(false);
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0]!.type).toBe('check-cache');
    expect(client.state).toBe('error');
    expect(consoleSpyContains('pre-check')).toBe(true);
  });

  test('a non-empty notes.txt returns false, posts nothing, lands in error state with cause in the console', () => {
    fake.emit({ type: 'ready' });
    const file = makeFile('notes.txt', 10, 'text/plain');
    const ok = client.submitFiles([file]);
    expect(ok).toBe(false);
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0]!.type).toBe('check-cache');
    expect(client.state).toBe('error');
    expect(consoleSpyContains('pre-check')).toBe(true);
  });

  test('a zero-byte empty.zip returns false, posts nothing, lands in error state with cause in the console', () => {
    fake.emit({ type: 'ready' });
    const file = makeFile('empty.zip', 0);
    expect(file.size).toBe(0);
    const ok = client.submitFiles([file]);
    expect(ok).toBe(false);
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0]!.type).toBe('check-cache');
    expect(client.state).toBe('error');
    expect(consoleSpyContains('pre-check')).toBe(true);
  });

  test('after a pre-check rejection, no timer is scheduled (D-06: nothing auto-dismisses)', () => {
    fake.emit({ type: 'ready' });
    client.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// precheckFiles — pure-function coverage of the four named causes
// -----------------------------------------------------------------------------

import { precheckFiles } from '../../../src/lib/import/precheck.ts';

describe('precheckFiles — pure function', () => {
  test('returns null for a valid single non-empty .zip', () => {
    expect(precheckFiles([makeFile('export.zip', 10)])).toBeNull();
  });

  test('returns null for EXPORT.ZIP (case-insensitive)', () => {
    expect(precheckFiles([makeFile('EXPORT.ZIP', 10)])).toBeNull();
  });

  test('returns a "no file in the selection" cause for zero files', () => {
    const out = precheckFiles([] as unknown as ArrayLike<File>);
    expect(out).not.toBeNull();
    expect(out!.cause).toBe('no file in the selection');
  });

  test('returns an "expected exactly one file" cause for two files', () => {
    const out = precheckFiles([makeFile('a.zip', 10), makeFile('b.zip', 10)]);
    expect(out).not.toBeNull();
    expect(out!.cause).toBe('expected exactly one file');
  });

  test('returns a "file name does not end in .zip" cause for notes.txt', () => {
    const out = precheckFiles([makeFile('notes.txt', 10, 'text/plain')]);
    expect(out).not.toBeNull();
    expect(out!.cause).toBe('file name does not end in .zip');
  });

  test('returns a "file is empty (0 bytes)" cause for an empty.zip of size 0', () => {
    const out = precheckFiles([makeFile('empty.zip', 0)]);
    expect(out).not.toBeNull();
    expect(out!.cause).toBe('file is empty (0 bytes)');
  });
});

// -----------------------------------------------------------------------------
// Worker-driven failure — error message, error event, deserialization error
// -----------------------------------------------------------------------------

describe('submitFiles — worker error responses', () => {
  test("a { type: 'error', jobId } for the in-flight job lands in the same error state as a pre-check rejection, with the worker's detail in the console", () => {
    fake.emit({ type: 'ready' });
    client.submitFiles([makeFile('export.zip', 100)]);
    expect(client.state).toBe('processing');

    // After 02-02: ingest messages carry jobId 2 (the ready handshake
    // bumped the counter from 0 to 1 first).
    fake.emit({
      type: 'error',
      jobId: 2,
      detail: 'Error: unrecognized export: no-recognized-category (2 entries)',
    });

    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(consoleSpyContains('no-recognized-category')).toBe(true);
  });

  test("a { type: 'done' } for a stale jobId while the ingest is in flight is ignored; state stays 'processing'", () => {
    fake.emit({ type: 'ready' });
    client.submitFiles([makeFile('export.zip', 100)]);
    expect(client.state).toBe('processing');

    fake.emit({
      type: 'done',
      jobId: 99,
      result: {
        accountRoot: '999',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    expect(client.state).toBe('processing');
  });

  test("a { type: 'error', jobId: 99 } for a stale jobId while the ingest is in flight is ignored; state stays 'processing'", () => {
    fake.emit({ type: 'ready' });
    client.submitFiles([makeFile('export.zip', 100)]);
    expect(client.state).toBe('processing');

    fake.emit({ type: 'error', jobId: 99, detail: 'should be ignored' });

    expect(client.state).toBe('processing');
    expect(client.errorMessage).toBeNull();
  });

  test('a second submission while processing returns false and posts nothing', () => {
    fake.emit({ type: 'ready' });
    const first = client.submitFiles([makeFile('export.zip', 100)]);
    expect(first).toBe(true);
    expect(fake.posts).toHaveLength(2); // check-cache (from ready) + ingest

    const second = client.submitFiles([makeFile('other.zip', 100)]);
    expect(second).toBe(false);
    // No new posts — the busy guard blocks before any postMessage.
    expect(fake.posts).toHaveLength(2);
  });

  test('onerror while processing lands in the generic error state', () => {
    fake.emit({ type: 'ready' });
    client.submitFiles([makeFile('export.zip', 100)]);
    expect(client.state).toBe('processing');

    fake.emitError('script crashed');

    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(consoleSpyContains('worker error')).toBe(true);
  });

  test('onmessageerror while processing lands in the generic error state', () => {
    fake.emit({ type: 'ready' });
    client.submitFiles([makeFile('export.zip', 100)]);
    expect(client.state).toBe('processing');

    fake.emitMessageError();

    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
  });

  test('onerror before ready: a later submission fails fast without posting', () => {
    // No 'ready' emitted. onerror fires while still idle (now
    // 'checking-cache' before any handshake has arrived).
    fake.emitError('crashed during init');
    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);

    fake.emit({ type: 'ready' });
    const ok = client.submitFiles([makeFile('export.zip', 100)]);
    expect(ok).toBe(false);
    // check-cache was attempted in the ready handler but the worker
    // is broken — the only post recorded is the check-cache request.
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0]!.type).toBe('check-cache');
    expect(client.state).toBe('error');
  });

  test('after any error, submitFiles with a valid file returns true and enters processing (re-armed)', () => {
    fake.emit({ type: 'ready' });
    // First a pre-check rejection.
    client.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);
    expect(client.state).toBe('error');

    // Then a valid submission must clear the error and move into processing.
    const ok = client.submitFiles([makeFile('export.zip', 100)]);
    expect(ok).toBe(true);
    // Exactly one ingest message on the wire (the check-cache handshake
    // is filtered out — pre-check rejections don't add ingest posts).
    expect(fake.posts.filter((m) => m.type === 'ingest')).toHaveLength(1);
    expect(client.state).toBe('processing');
    expect(client.errorMessage).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Test helpers — capture console.error without polluting test output
// -----------------------------------------------------------------------------

const consoleErrors: string[] = [];
const originalError = console.error;

beforeEach(() => {
  consoleErrors.length = 0;
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(stringify).join(' '));
  };
});

afterEach(() => {
  console.error = originalError;
});

function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function consoleSpyContains(needle: string): boolean {
  return consoleErrors.some((line) => line.includes(needle));
}

// =============================================================================
// 01-05 — MIN_PROCESSING_MS floor, done-state guard, reset()
// =============================================================================
//
// Why this block is its own world (not appended to the describe above):
//   The default makeClient() in this file passes minProcessingMs: 0 so
//   the 01-04 immediate-transition tests keep their synchronous
//   expectations. The tests below need the REAL floor (MIN_PROCESSING_MS
//   = 400), so each test builds its own client via makeClient({}) which
//   picks up the IngestClient's default of 400 ms.
//
// Fake-timer semantics in Vitest 5 (FA-01-05-1):
//   vi.useFakeTimers() in the file's beforeEach already fakes
//   setTimeout AND Date.now(), so 'advance by 50 ms' makes Date.now()
//   return 50 and resolves any setTimeout(_, 50). MIN_PROCESSING_MS
//   minus the elapsed time gives the precise settle delay. Each test
//   asserts both BEFORE the floor and AFTER the floor to prove the
//   transition is gated, not coincidental.
// =============================================================================

describe('MIN_PROCESSING_MS floor', () => {
  test("the constant is inside D-10's 300–500 ms window", () => {
    expect(MIN_PROCESSING_MS).toBeGreaterThanOrEqual(300);
    expect(MIN_PROCESSING_MS).toBeLessThanOrEqual(500);
  });

  test("a 'done' at +50 ms keeps state 'processing' until +400 ms, then becomes 'done'", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    // Submit a valid file at t=0.
    expect(c.submitFiles([makeFile('export.zip', 100)])).toBe(true);
    expect(c.state).toBe('processing');
    expect(c.stage).toBe('unzipping');

    // Worker answers at t=+50 ms — much earlier than the 400 ms floor.
    // After 02-02: ingest messages carry jobId 2 (the ready handshake
    // bumped the counter from 0 to 1 first).
    vi.advanceTimersByTime(50);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: '123456789',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    // The transition is queued but not applied — the UI must keep the
    // spinner visible for the floor window (D-10).
    expect(c.state).toBe('processing');
    expect(c.result).toBeNull();

    // Just before the floor: still processing.
    vi.advanceTimersByTime(349); // total elapsed: 399 ms
    expect(c.state).toBe('processing');

    // Crossing the floor: the timer fires and the transition applies.
    vi.advanceTimersByTime(1); // total elapsed: 400 ms
    expect(c.state).toBe('done');
    expect(c.stage).toBeNull();
    expect(c.result).toBeTruthy();
    expect(c.result?.accountRoot).toBe('123456789');
  });

  test("a 'done' arriving AFTER the floor applies immediately", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    // Pretend 600 ms of work happened (worker took longer than floor).
    vi.advanceTimersByTime(600);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: '999',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });
    // No setTimeout is queued — the transition is applied synchronously.
    expect(c.state).toBe('done');
    expect(c.result?.accountRoot).toBe('999');
  });

  test("a worker 'error' at +10 ms keeps 'processing' until +400 ms, then becomes 'error' with GENERIC_FAILURE_MESSAGE", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    vi.advanceTimersByTime(10);
    f.emit({ type: 'error', jobId: 2, detail: 'synthetic worker error' });

    expect(c.state).toBe('processing');
    expect(c.errorMessage).toBeNull();

    vi.advanceTimersByTime(389); // total: 399 ms
    expect(c.state).toBe('processing');

    vi.advanceTimersByTime(1); // total: 400 ms
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    // The worker's detail string is in the console (D-05), not in the banner.
    expect(consoleSpyContains('synthetic worker error')).toBe(true);
  });

  test('onerror while processing is gated by the same floor', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    vi.advanceTimersByTime(20);
    f.emitError('script crashed');

    expect(c.state).toBe('processing');
    vi.advanceTimersByTime(380); // 400 ms total
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
  });

  test('onmessageerror while processing is gated by the same floor', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    vi.advanceTimersByTime(0); // immediate
    f.emitMessageError();

    expect(c.state).toBe('processing');
    vi.advanceTimersByTime(399);
    expect(c.state).toBe('processing');
    vi.advanceTimersByTime(1);
    expect(c.state).toBe('error');
  });

  test('a second terminal outcome during the settle wait is a no-op (the first wins)', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    vi.advanceTimersByTime(50);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'first',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    // A second 'done' (impossible in practice, but the worker is the
    // only sender and we want defensive behaviour) is ignored.
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'second',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    vi.advanceTimersByTime(400);
    expect(c.state).toBe('done');
    expect(c.result?.accountRoot).toBe('first');
  });

  test('a pre-check rejection is still immediate (no timer, no floor)', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);

    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    // No scheduled timer — pre-check rejections never queue a settle.
    expect(vi.getTimerCount()).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// done-state guard (D-13: a file dropped on the results view is ignored)
// -----------------------------------------------------------------------------

describe('done-state guard', () => {
  test('submitFiles while state is "done" transitions to "confirm-pending" with a replace pendingAction (D-13)', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Land in 'done'. After 02-02: ingest messages carry jobId 2
    // (the ready handshake bumped #jobId from 0 to 1 first).
    c.submitFiles([makeFile('export.zip', 100)]);
    const result = {
      accountRoot: 'stale',
      categories: [],
      counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
    };
    f.emit({ type: 'done', jobId: 2, result });
    expect(c.state).toBe('done');

    // As of 02-03, a drop while 'done' transitions to
    // 'confirm-pending' with the file stashed for confirm-time
    // posting (D-13). Returns false (no ingest message posted
    // until the user confirms) — supersedes the Phase 1
    // "results shown, drop ignored" silent-no-op behavior.
    const dropped = makeFile('other.zip', 100);
    const ok = c.submitFiles([dropped]);
    expect(ok).toBe(false);
    // No new posts — the replace-guard blocks before any
    // postMessage. The check-cache handshake (from ready) and the
    // original ingest message are already on the wire, so the
    // count stays at 2.
    expect(f.posts).toHaveLength(2);
    expect(c.state).toBe('confirm-pending');
    // The original result is preserved untouched behind the
    // pending confirm (must_haves prohibition: a cancelled confirm
    // must never alter the existing dataset / view state).
    expect(c.result).toEqual(result);
    expect(c.pendingAction).toEqual({ kind: 'replace', file: dropped });
  });

  test('submitFiles while state is "error" still posts (reset is opt-in)', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);
    expect(c.state).toBe('error');

    // Error state must NOT block a new submission; only 'done' does.
    const ok = c.submitFiles([makeFile('export.zip', 100)]);
    expect(ok).toBe(true);
    // Exactly one ingest message on the wire (the check-cache
    // handshake is filtered out).
    expect(f.posts.filter((m) => m.type === 'ingest')).toHaveLength(1);
    expect(c.state).toBe('processing');
  });
});

// -----------------------------------------------------------------------------
// reset() — explicit, no confirmation, single-call return to idle (D-14)
// -----------------------------------------------------------------------------

describe('reset()', () => {
  test('after "done", reset returns true and restores idle', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // After 02-02: ingest messages carry jobId 2 (the ready handshake
    // bumped #jobId from 0 to 1 first).
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [{ name: 'A', status: 'supported', fileCount: 1 }],
        counts: { supported: 1, 'known-deferred': 0, unknown: 0 },
      },
    });
    expect(c.state).toBe('done');
    expect(c.result).not.toBeNull();

    const ok = c.reset();
    expect(ok).toBe(true);
    expect(c.state).toBe('idle');
    expect(c.stage).toBeNull();
    expect(c.result).toBeNull();
    expect(c.errorMessage).toBeNull();
  });

  test('after "done" + reset, a new submission goes through and lands in "processing"', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });
    c.reset();

    const ok = c.submitFiles([makeFile('next.zip', 100)]);
    expect(ok).toBe(true);
    expect(c.state).toBe('processing');
    // check-cache (jobId 1) + first ingest (jobId 2) + second ingest (jobId 3).
    expect(f.posts).toHaveLength(3);
  });

  test('after "error", reset returns true and clears errorMessage', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);

    const ok = c.reset();
    expect(ok).toBe(true);
    expect(c.state).toBe('idle');
    expect(c.stage).toBeNull();
    expect(c.result).toBeNull();
    expect(c.errorMessage).toBeNull();
  });

  test('while "processing", reset returns false and changes nothing', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: MIN_PROCESSING_MS });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    expect(c.state).toBe('processing');

    const ok = c.reset();
    expect(ok).toBe(false);
    expect(c.state).toBe('processing');
    // check-cache (from ready) + ingest = 2 posts on the wire.
    expect(f.posts).toHaveLength(2);
  });

  test('in idle state, reset returns true and is a no-op', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    const ok = c.reset();
    expect(ok).toBe(true);
    expect(c.state).toBe('idle');
  });
});

// -----------------------------------------------------------------------------
// STAGE_TEXT — wiring verification (the dropzone uses STAGE_TEXT[stage])
// -----------------------------------------------------------------------------

describe('STAGE_TEXT plumbing', () => {
  test('STAGE_TEXT.unzipping and STAGE_TEXT.classifying are the documented strings', () => {
    // The dropzone's statusText prop is derived from STAGE_TEXT[stage]
    // while busy (App.svelte wiring). The map's values are the contract.
    expect(STAGE_TEXT.unzipping).toBe('Unzipping...');
    expect(STAGE_TEXT.classifying).toBe('Classifying folders...');
  });
});

// =============================================================================
// 02-02 — check-cache handshake, 'checking-cache' state, auto-load from cache
// =============================================================================
//
// Why this block is its own world:
//   02-02's DATA-01 close-the-loop plan adds:
//     - 'checking-cache' as the initial IngestViewState (before 'ready'
//       AND before 'cache-status'), so App.svelte can render a spinner
//       instead of flashing the empty dropzone (D-08).
//     - On 'ready', the client posts exactly one 'check-cache' request
//       to the worker — auto-load piggybacks on the same handshake.
//     - On 'cache-status' (the worker's reply), the client transitions
//       to 'done' (with result set) if a cached dataset was returned,
//       or to 'idle' if there is no cached dataset yet.
//
// These tests use FakeWorker (same seam 01-04 / 01-05 used). Note the
// FakeWorker's `emit` helper carries an IngestResponse whose types
// match the new 'cache-status' variant in worker-messages.ts — that
// variant was added in 02-01 so the tests can compile against the
// existing contract.
// =============================================================================

describe("'checking-cache' initial state (D-08)", () => {
  test("a freshly constructed client starts in 'checking-cache' (NOT 'idle'), so the UI can show a spinner before the cache check resolves", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f);
    expect(c.state).toBe('checking-cache');
    expect(c.result).toBeNull();
  });

  test("state stays 'checking-cache' after a 'ready' arrives but before the worker has responded to check-cache", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f);
    f.emit({ type: 'ready' });
    // After ready, the workerReady flag flipped to true (so the dropzone
    // will be allowed to submit later), but the cache-status response has
    // not yet arrived — the UI must keep showing the loading state.
    expect(c.workerReady).toBe(true);
    expect(c.state).toBe('checking-cache');
  });
});

describe("check-cache request — sent once on 'ready' (D-07, D-08)", () => {
  test("the 'ready' message triggers exactly one { type: 'check-cache' } post (no 'ingest' message)", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f);
    f.emit({ type: 'ready' });

    // Exactly one post, and it's the check-cache request — not an ingest.
    expect(f.posts).toHaveLength(1);
    expect(f.posts[0]).toEqual({ type: 'check-cache', jobId: 1 });
    expect(f.posts[0]!.type).not.toBe('ingest');
    // Reference the client so the unused-var lint sees a use; the
    // constructor wires the worker→client handshake (the side effect
    // this test is exercising).
    expect(c.workerReady).toBe(true);
  });
});

describe("cache-status response — transitions out of 'checking-cache'", () => {
  test("a 'cache-status' with a non-null cached result transitions to 'done' with the cached result, without ever having posted an 'ingest' message", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f);
    f.emit({ type: 'ready' });

    // No ingest message yet — only the check-cache handshake.
    expect(f.posts.filter((m) => m.type === 'ingest')).toEqual([]);

    const cached = {
      accountRoot: 'cached-root',
      categories: [{ name: 'A', status: 'supported' as const, fileCount: 1, rowCount: 5 }],
      counts: { supported: 1, 'known-deferred': 0, unknown: 0 },
      importedAt: '2026-09-28T18:00:00.000Z',
    };
    f.emit({ type: 'cache-status', jobId: 1, cached });

    // Auto-loaded straight to the results view (D-07), without re-upload.
    expect(c.state).toBe('done');
    expect(c.result).toEqual(cached);
    // The whole session posted exactly one message — the check-cache handshake.
    expect(f.posts.filter((m) => m.type === 'ingest')).toEqual([]);
  });

  test("a 'cache-status' with cached=null transitions to 'idle' (empty dropzone, no results)", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f);
    f.emit({ type: 'ready' });

    f.emit({ type: 'cache-status', jobId: 1, cached: null });

    expect(c.state).toBe('idle');
    expect(c.result).toBeNull();
  });

  test("a 'cache-status' with a stale jobId is ignored; state stays 'checking-cache'", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f);
    f.emit({ type: 'ready' });

    // JobId mismatch — should not transition.
    f.emit({ type: 'cache-status', jobId: 99, cached: null });
    expect(c.state).toBe('checking-cache');
  });
});

// =============================================================================
// 02-03 — confirm-pending state machine (D-13/D-16/D-17/D-22, IMPORT-06/DATA-02)
//
// Why this block exists:
//   Phase 2 closes the destructive-action loop. The 02-02 client had
//   a single 'done' guard that silently ignored drops on the results
//   view (D-13 at the time meant "ignore the drop"). With persistent
//   data, ignoring the drop would silently leave the user stuck — so
//   02-03 introduces a 'confirm-pending' state, a `pendingAction`
//   discriminated-union payload, and three new public methods
//   (requestStartOver, requestClearData, confirmPending,
//   cancelPending) that route every destructive flow through ONE
//   shared confirm mechanism (D-22).
//
// The shared mechanism is a single 'confirm-pending' state plus a
// `pendingAction.kind` discriminator — three separate confirm states
// would have been equivalent but would have made the App.svelte
// switch three-way. ONE state with ONE kind discriminator is the
// pattern the 02-03-PLAN locks.
// =============================================================================

describe("replace-on-drop — submitFiles while 'done' transitions to 'confirm-pending' (D-13)", () => {
  test("submitFiles while state is 'done' sets pendingAction={kind:'replace',file} and transitions to 'confirm-pending', WITHOUT posting any worker message", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Land in 'done' first.
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });
    expect(c.state).toBe('done');

    const postsBefore = f.posts.length;
    const newFile = makeFile('other.zip', 100);
    const ok = c.submitFiles([newFile]);

    // Returns false (no worker message posted yet — the user must
    // confirm first). The check-cache (jobId 1) and the original
    // ingest (jobId 2) are already on the wire.
    expect(ok).toBe(false);
    expect(f.posts).toHaveLength(postsBefore);
    // D-13: a NEW 'confirm-pending' state, with the file stashed
    // for confirm-time posting.
    expect(c.state).toBe('confirm-pending');
    expect(c.pendingAction).not.toBeNull();
    expect(c.pendingAction!.kind).toBe('replace');
    if (c.pendingAction!.kind === 'replace') {
      expect(c.pendingAction!.file).toBe(newFile);
    }
  });
});

describe("confirmPending — replace flow posts the stashed file as a normal 'ingest' (D-13)", () => {
  test("confirmPending() with kind 'replace' posts one 'ingest' message for the pending file and clears pendingAction", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Land in 'done'.
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    // Drop a different file — moves to confirm-pending.
    const newFile = makeFile('other.zip', 100);
    c.submitFiles([newFile]);
    expect(c.state).toBe('confirm-pending');

    // User confirms — the pending file posts as a normal ingest.
    const returned = c.confirmPending();
    expect(returned).toBe(true);
    expect(c.state).toBe('processing');
    expect(c.pendingAction).toBeNull();

    // Exactly one new 'ingest' message on the wire — the pending file.
    const ingestPosts = f.posts.filter((m) => m.type === 'ingest');
    expect(ingestPosts).toHaveLength(2); // original + confirmed
    expect(ingestPosts[1]).toEqual({ type: 'ingest', jobId: 3, file: newFile });
  });

  test("confirmPending() with kind 'start-over' posts 'clear-data' and stays 'confirm-pending' until 'cleared' arrives (D-16)", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Land in 'done'.
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    c.requestStartOver();
    expect(c.state).toBe('confirm-pending');
    expect(c.pendingAction!.kind).toBe('start-over');

    const returned = c.confirmPending();
    expect(returned).toBe(true);
    // Still in 'confirm-pending' until the worker's 'cleared' lands.
    expect(c.state).toBe('confirm-pending');
    // One 'clear-data' message posted.
    const clears = f.posts.filter((m) => m.type === 'clear-data');
    expect(clears).toHaveLength(1);
    expect(clears[0]).toEqual({ type: 'clear-data', jobId: 3 });

    // Worker acknowledges — transitions to 'idle' with the
    // one-shot acknowledgment flag set (D-20).
    f.emit({ type: 'cleared', jobId: 3 });
    expect(c.state).toBe('idle');
    expect(c.result).toBeNull();
    expect(c.pendingAction).toBeNull();
    expect(c.justCleared).toBe(true);
  });

  test("confirmPending() with kind 'clear-data' follows the identical confirm + clear flow (D-22)", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Land in 'done' so the persistent clear-data control is visible
    // (D-18 — D-19 hides it on idle). Test exercises the same path
    // the App.svelte wiring uses.
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    c.requestClearData();
    expect(c.state).toBe('confirm-pending');
    expect(c.pendingAction!.kind).toBe('clear-data');

    c.confirmPending();
    const clears = f.posts.filter((m) => m.type === 'clear-data');
    expect(clears).toHaveLength(1);
    f.emit({ type: 'cleared', jobId: 3 });
    expect(c.state).toBe('idle');
    expect(c.justCleared).toBe(true);
  });

  test("confirmPending() while state is NOT 'confirm-pending' is a no-op (defensive guard)", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });
    // No confirm pending — just idle.
    const returned = c.confirmPending();
    expect(returned).toBe(false);
    expect(f.posts).toHaveLength(1); // only the check-cache handshake
  });
});

describe('cancelPending — returns to the pre-confirm state and discards the pending action', () => {
  test("cancelPending() after a replace-on-drop returns to 'done' with the original result untouched, pending file discarded (D-13)", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    const originalResult = {
      accountRoot: 'stale',
      categories: [{ name: 'A', status: 'supported' as const, fileCount: 1, rowCount: 1 }],
      counts: { supported: 1, 'known-deferred': 0, unknown: 0 },
      importedAt: '2026-09-28T00:00:00.000Z',
    };
    f.emit({ type: 'done', jobId: 2, result: originalResult });
    expect(c.state).toBe('done');

    const dropped = makeFile('different.zip', 100);
    c.submitFiles([dropped]);
    expect(c.state).toBe('confirm-pending');

    c.cancelPending();
    // Back to 'done' — the user's existing dataset is completely
    // untouched by a cancelled replace (must_haves prohibition:
    // a cancelled confirm must never alter the existing dataset).
    expect(c.state).toBe('done');
    expect(c.result).toEqual(originalResult);
    expect(c.pendingAction).toBeNull();
  });

  test("cancelPending() after requestStartOver returns to 'done' with the original result untouched (D-16)", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });

    c.requestStartOver();
    expect(c.state).toBe('confirm-pending');

    c.cancelPending();
    expect(c.state).toBe('done');
    expect(c.pendingAction).toBeNull();
    expect(c.result?.accountRoot).toBe('stale');
  });

  test("cancelPending() while NOT in 'confirm-pending' is a no-op", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // No pending action — cancelPending should be a safe no-op so the
    // App.svelte cancel-button click is harmless in any state.
    c.cancelPending();
    expect(c.state).toBe('checking-cache');
    expect(c.pendingAction).toBeNull();
  });
});

describe("'cleared' message — transitions out of 'confirm-pending' to 'idle' with the acknowledgment flag (D-20)", () => {
  test("the 'cleared' message for a non-pending state is ignored", () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Land in 'idle' (no confirm pending).
    f.emit({ type: 'cache-status', jobId: 1, cached: null });
    expect(c.state).toBe('idle');

    // A late 'cleared' for a different jobId must NOT clobber state.
    f.emit({ type: 'cleared', jobId: 99 });
    expect(c.state).toBe('idle');
    expect(c.justCleared).toBe(false);
  });

  test('a subsequent submitFiles() clears the justCleared acknowledgment flag (D-20: nothing auto-dismisses)', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Trigger a clear-data flow end-to-end.
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 2,
      result: {
        accountRoot: 'stale',
        categories: [],
        counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
      },
    });
    c.requestStartOver();
    c.confirmPending();
    f.emit({ type: 'cleared', jobId: 3 });
    expect(c.justCleared).toBe(true);

    // Submitting a new file must reset the flag — the acknowledgment
    // is one-shot and tied to the cleared dropzone, not to anything
    // that would survive a subsequent action.
    c.submitFiles([makeFile('next.zip', 100)]);
    expect(c.justCleared).toBe(false);
  });
});

// =============================================================================
// 03-03 — the displayed dataset survives a replace and its failure (D-27)
//
// Why this block exists:
//   `result` used to mean "the outcome of the job in flight", so three
//   assignments nulled it the moment a replacement started or failed
//   (confirmPending's replace branch, submitFiles, #fail). The worker's
//   write is a single atomic Dexie transaction (RESEARCH Q2 probed it), so
//   the OLD dataset was still sitting in IndexedDB while the UI showed an
//   empty page — the "unresolved" row of the approved UI-SPEC state
//   matrix. Re-typing `result` as "the last known cached dataset" makes
//   the dashboard stay on screen across processing, duplicate and error
//   (D-27: the current dashboard stays visible until a replace is
//   confirmed AND finished).
//
//   Nothing re-reads the cache after a failure: the old rows and meta are
//   intact by construction, and the client simply stopped throwing the
//   displayed copy away.
// =============================================================================

/** The dataset a client holds once a first import has landed. */
const DISPLAYED_RESULT = {
  accountRoot: 'stale',
  categories: [
    { name: 'Activity_history', status: 'supported' as const, fileCount: 1, rowCount: 2 },
  ],
  counts: { supported: 1, 'known-deferred': 0, unknown: 0 },
  importedAt: '2026-09-28T00:00:00.000Z',
};

/**
 * Drive a client to 'done' with DISPLAYED_RESULT as its result. Job id
 * convention in this file: the ready handshake bumps #jobId to 1, the
 * first ingest is 2, and a confirmed replace is 3.
 */
function makeClientWithDisplayedDataset(): { c: IngestClient; f: FakeWorker } {
  const f = new FakeWorker();
  const c = new IngestClient(() => f, { minProcessingMs: 0 });
  f.emit({ type: 'ready' });
  c.submitFiles([makeFile('export.zip', 100)]);
  f.emit({ type: 'done', jobId: 2, result: DISPLAYED_RESULT });
  expect(c.state).toBe('done');
  return { c, f };
}

describe('the displayed dataset survives a replace confirm and a failed replace (D-27)', () => {
  test('confirming a replace moves to processing but KEEPS the displayed result', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    c.submitFiles([makeFile('other.zip', 100)]);
    expect(c.state).toBe('confirm-pending');

    c.confirmPending();
    // D-27: the dashboard stays visible for the whole replacement.
    expect(c.state).toBe('processing');
    expect(c.result).toEqual(DISPLAYED_RESULT);
    // The stashed file is now on the wire as job 3.
    expect(f.posts.filter((m) => m.type === 'ingest').map((m) => m.jobId)).toEqual([2, 3]);
  });

  test('a worker error mid-replace lands on error and STILL KEEPS the displayed result', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    c.submitFiles([makeFile('other.zip', 100)]);
    c.confirmPending();
    f.emit({ type: 'error', jobId: 3, detail: 'Error: unzip blew up' });

    // The old rows and meta are intact in IndexedDB (one atomic
    // transaction), so the screen must match storage: the failure
    // notice over the dataset that is still really there.
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test('a successful replace SWAPS the result for the new dataset', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    c.submitFiles([makeFile('other.zip', 100)]);
    c.confirmPending();

    const fresh = {
      accountRoot: 'fresh',
      categories: [],
      counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
    };
    f.emit({ type: 'done', jobId: 3, result: fresh });

    expect(c.state).toBe('done');
    expect(c.result).toEqual(fresh);
  });

  test('a first import with no cache keeps result null while processing and after a worker error', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    c.submitFiles([makeFile('export.zip', 100)]);
    // Nothing cached to preserve, so nothing is invented.
    expect(c.result).toBeNull();

    f.emit({ type: 'error', jobId: 2, detail: 'Error: nope' });
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(c.result).toBeNull();
  });
});

// =============================================================================
// 03-03 — the replace guard covers every state that DISPLAYS a dataset
//
// Why this block exists:
//   The replace guard was `if (this.state === 'done')`, but after 03-03's
//   first task `result` — and therefore the dashboard — is also displayed
//   in 'duplicate' and in 'error'. In those two states the old guard fell
//   straight through to postMessage: a drop would overwrite the cached
//   dataset with NO confirmation, contradicting Phase 2 D-13. Keying the
//   guard on "a dataset is displayed" (result !== null) closes that hole
//   for every state at once.
//
//   Three smaller gaps travel with it, all found while tracing:
//     - a drop while a confirm is already open used to move the machine
//       to 'processing' and leave a stale pendingAction behind;
//     - the pre-check ran AFTER the guard, so a notes.txt dropped on a
//       displayed dataset opened a replace prompt for an unusable file
//       instead of showing the failure notice;
//     - a worker error during the on-load cache check was swallowed by the
//       `state !== 'processing'` guard, leaving the page on the spinner
//       forever. D-19's v2 upgrade gives that first read a new way to
//       fail, so this was no longer theoretical.
// =============================================================================

describe('the replace guard covers every state that displays a dataset (D-13, D-27)', () => {
  test('a drop while state is "duplicate" with a displayed dataset goes to confirm-pending, posts nothing', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    // Reach 'duplicate' the real way: a confirmed replace whose bytes
    // hash to the dataset already cached.
    c.submitFiles([makeFile('same.zip', 100)]);
    c.confirmPending();
    f.emit({ type: 'duplicate', jobId: 3, result: DISPLAYED_RESULT });
    expect(c.state).toBe('duplicate');
    const postsBefore = f.posts.length;

    const dropped = makeFile('third.zip', 100);
    const ok = c.submitFiles([dropped]);

    expect(ok).toBe(false);
    expect(f.posts).toHaveLength(postsBefore);
    expect(c.state).toBe('confirm-pending');
    expect(c.pendingAction).toEqual({ kind: 'replace', file: dropped });
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test('a drop while state is "error" WITH a result goes to confirm-pending, posts nothing', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    c.submitFiles([makeFile('other.zip', 100)]);
    c.confirmPending();
    f.emit({ type: 'error', jobId: 3, detail: 'Error: unzip blew up' });
    expect(c.state).toBe('error');
    expect(c.result).toEqual(DISPLAYED_RESULT);
    const postsBefore = f.posts.length;

    const dropped = makeFile('third.zip', 100);
    const ok = c.submitFiles([dropped]);

    expect(ok).toBe(false);
    expect(f.posts).toHaveLength(postsBefore);
    expect(c.state).toBe('confirm-pending');
    expect(c.pendingAction).toEqual({ kind: 'replace', file: dropped });
    // The dataset that prompted the failure is still the one on screen.
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test('a drop while state is "error" with NO result still posts an ingest (nothing to protect)', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // A pre-check rejection: error state, and result is null.
    c.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);
    expect(c.state).toBe('error');
    expect(c.result).toBeNull();

    const ok = c.submitFiles([makeFile('export.zip', 100)]);
    expect(ok).toBe(true);
    expect(f.posts.filter((m) => m.type === 'ingest')).toHaveLength(1);
    expect(c.state).toBe('processing');
  });

  test('a drop while a confirm is already pending is ignored: no state change, no post, no stale action', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    const first = makeFile('other.zip', 100);
    c.submitFiles([first]);
    expect(c.state).toBe('confirm-pending');
    const postsBefore = f.posts.length;

    // A second drop must not replace the stashed file, nor move the
    // machine into 'processing' with a stale pendingAction left over.
    const second = makeFile('third.zip', 100);
    const ok = c.submitFiles([second]);

    expect(ok).toBe(false);
    expect(c.state).toBe('confirm-pending');
    expect(c.pendingAction).toEqual({ kind: 'replace', file: first });
    expect(f.posts).toHaveLength(postsBefore);
    expect(consoleSpyContains('confirm pending, submission ignored')).toBe(true);
  });

  test('the pre-check runs BEFORE the replace guard: a notes.txt drop fails without opening a confirm', () => {
    const { c, f } = makeClientWithDisplayedDataset();
    const postsBefore = f.posts.length;

    const ok = c.submitFiles([makeFile('notes.txt', 10, 'text/plain')]);

    expect(ok).toBe(false);
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    // No replace prompt for a file that could never be ingested...
    expect(c.pendingAction).toBeNull();
    expect(f.posts).toHaveLength(postsBefore);
    // ...and the dashboard behind the notice is untouched (D-27).
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test('the pre-check runs BEFORE the replace guard: a two-file drop fails without opening a confirm', () => {
    const { c, f } = makeClientWithDisplayedDataset();
    const postsBefore = f.posts.length;

    const ok = c.submitFiles([makeFile('a.zip', 100), makeFile('b.zip', 100)]);

    expect(ok).toBe(false);
    expect(c.state).toBe('error');
    expect(c.pendingAction).toBeNull();
    expect(f.posts).toHaveLength(postsBefore);
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });
});

describe('a worker error during the on-load cache check never leaves the spinner (D-19, D-28)', () => {
  test('an error for the check-cache jobId lands on idle with the cause in the console and no banner', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });
    expect(c.state).toBe('checking-cache');

    f.emit({ type: 'error', jobId: 1, detail: 'Error: upgrade blocked' });

    // Skeleton + full dropzone, NOT a permanent spinner and NOT the
    // generic banner: that copy claims "This doesn't look like a
    // Wargaming data export", which is nonsense for a storage failure.
    expect(c.state).toBe('idle');
    expect(c.result).toBeNull();
    expect(c.errorMessage).toBeNull();
    expect(c.stage).toBeNull();
    expect(c.parsingProgress).toBeNull();
    expect(consoleSpyContains('cache check failed: Error: upgrade blocked')).toBe(true);
  });

  test('a cache-check error carrying a stale jobId is ignored; the spinner state is left alone', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    f.emit({ type: 'error', jobId: 99, detail: 'Error: someone else' });

    expect(c.state).toBe('checking-cache');
  });
});

describe('a worker error answering a confirmed clear does not strand the confirm panel', () => {
  test('an error for the clear jobId lands on error with the dataset retained and the confirm closed', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    c.requestClearData();
    c.confirmPending();
    expect(c.state).toBe('confirm-pending');
    expect(f.posts.filter((m) => m.type === 'clear-data')).toHaveLength(1);

    f.emit({ type: 'error', jobId: 3, detail: 'Error: clear refused' });

    // The clear transaction is atomic, so the dataset really is still
    // there: the screen must say so (D-27 / T-03-13).
    expect(c.state).toBe('error');
    expect(c.pendingAction).toBeNull();
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });
});

describe('cancelling a confirm that began from a notice returns to the dataset view (D-06)', () => {
  test('cancelling a replace confirm opened from "duplicate" returns to done with the notice cleared', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    c.submitFiles([makeFile('same.zip', 100)]);
    c.confirmPending();
    f.emit({ type: 'duplicate', jobId: 3, result: DISPLAYED_RESULT });
    expect(c.state).toBe('duplicate');

    c.submitFiles([makeFile('third.zip', 100)]);
    c.cancelPending();

    // 'duplicate' is a notice over a real dataset, not a view of its
    // own — the next user action replaces notices (D-06), so going back
    // to 'duplicate' would resurface a banner the user just dismissed.
    expect(c.state).toBe('done');
    expect(c.errorMessage).toBeNull();
    expect(c.pendingAction).toBeNull();
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test('cancelling a replace confirm opened from "error" with a result returns to done', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    c.submitFiles([makeFile('other.zip', 100)]);
    c.confirmPending();
    f.emit({ type: 'error', jobId: 3, detail: 'Error: unzip blew up' });
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);

    c.submitFiles([makeFile('third.zip', 100)]);
    c.cancelPending();

    expect(c.state).toBe('done');
    expect(c.errorMessage).toBeNull();
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test('cancelling a replace confirm opened from "done" still returns to done', () => {
    const { c } = makeClientWithDisplayedDataset();

    c.submitFiles([makeFile('other.zip', 100)]);
    c.cancelPending();

    expect(c.state).toBe('done');
    expect(c.pendingAction).toBeNull();
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });
});

// =============================================================================
// 04-07 Task 1 — TRACER: a worker failure releases a pending playtime query
//
// Why this block exists:
//   Plan 04-01 gave `PlaytimeClient` its own id namespace and a delegation
//   seam at the TOP of `#handle`, so playtime traffic cannot move the import
//   state machine. What that seam did NOT cover is the worker DYING. A query
//   is an outstanding promise, and a promise nobody settles is a spinner
//   that never stops: `onerror` / `onmessageerror` only ever reached the
//   ingest branches, so a chart awaiting a slice while the worker crashed
//   waited forever (T-04-14, UI-SPEC error state).
//
//   The tracer drives the real `IngestClient` rather than a stub, because
//   the whole point is that the fix lives in the WORKER-side handler, not in
//   the client: an `IngestClient` that wires its own handlers can fail its
//   own queries, and one that does not, cannot.
//
// Fail-fast discipline (04-07 Task 1):
//   Every await here races the query against an already-resolved marker, so
//   a query that never settles produces an assertion diff NAMES THE MARKER
//   rather than a test timeout. A timeout would be a 5-second wait and a
//   much less legible failure; this is the RED this plan was written around.
// =============================================================================

describe('04-07 tracer: a worker failure releases a pending playtime query', () => {
  /**
   * The marker a never-settling query loses the race to. It is a plain
   * string so the RED diff reads `expected 'never-settled…' to deeply equal
   * { kind: 'error', … }` — the failure names the cause.
   */
  const NEVER_SETTLED = 'never-settled: the playtime query was not released';

  /** Resolve the query, or report the marker if nothing released it. */
  function settleOrMarker(outcome: Promise<unknown>): Promise<unknown> {
    return Promise.race([outcome, Promise.resolve(NEVER_SETTLED)]);
  }

  test('a query posts exactly one playtime-query with queryId 1, valueIndex null and no jobId', () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.posts.length = 0;

    void c.playtime.query(null);

    // 04-01's contract, pinned: own id namespace, no jobId, and the All
    // slice asked for as `valueIndex: null`.
    const queries = f.posts.filter((m) => m.type === 'playtime-query');
    expect(queries).toEqual([{ type: 'playtime-query', queryId: 1, valueIndex: null }]);
    expect('jobId' in queries[0]!).toBe(false);
  });

  test('a worker error event while a query is pending resolves it as an error outcome and empties the pending set', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });

    const outcome = c.playtime.query(null);
    expect(c.playtime.pendingCount).toBe(1);

    f.emitError('boom');

    // The FIXED detail, never the event's message: an error event can carry
    // a file path, and Phase 3 D-21 keeps such text off the screen.
    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'error',
      queryId: 1,
      detail: 'worker error',
    });
    expect(c.playtime.pendingCount).toBe(0);
  });

  test('a deserialization error while a query is pending resolves it as an error outcome', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });

    const outcome = c.playtime.query(null);

    f.emitMessageError();

    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'error',
      queryId: 1,
      detail: 'worker message could not be deserialized',
    });
    expect(c.playtime.pendingCount).toBe(0);
  });

  test('a worker error while idle and ready leaves the ingest machine exactly as it was', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.emit({ type: 'cache-status', jobId: 1, cached: null });
    expect(c.state).toBe('idle');

    const outcome = c.playtime.query(null);
    f.emitError('boom');
    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'error',
      queryId: 1,
      detail: 'worker error',
    });

    // Releasing the chart's query must not fail an IMPORT that was never
    // running: idle + ready means the error event is informational only,
    // which is the Phase 3 rule this plan must not disturb.
    expect(c.state).toBe('idle');
    expect(c.errorMessage).toBeNull();
    expect(c.result).toBeNull();
  });

  test('a worker error while an import is in flight still fails the import exactly as before', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    c.submitFiles([makeFile('export.zip', 100)]);
    expect(c.state).toBe('processing');

    const outcome = c.playtime.query(null);
    f.emitError('boom');
    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'error',
      queryId: 1,
      detail: 'worker error',
    });

    // The pre-existing onerror branch is untouched: the settle floor is 0
    // here, so the failure applies synchronously, as the tests above expect.
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
  });
});

// =============================================================================
// 04-07 Task 3 — the ingest state machine ignores playtime traffic
//
// Why this block exists:
//   Plan 04-01 put the delegation seam at the TOP of `#handle`, before any
//   state-machine branch, and left a comment saying that was what kept
//   `#jobId`, `state` and the settle timer untouched. A comment is not a
//   proof, and the next plans add real traffic to prove it against: a
//   selector change posts a `playtime-query` while an import is mid-flight,
//   while a confirm is open, and while a dataset is on screen. Every one of
//   those windows is a chance for a stray `queryId` to be read as a `jobId`
//   and hang or corrupt the import.
//
//   The idle case is not idle in name only: the on-load cache check leaves
//   the machine in 'checking-cache', which is the state a playtime reply
//   most easily could have been mistaken for a 'cache-status'.
//
// What is pinned here, in the order the plan lists it:
//   - one `playtime` instance for the client's lifetime;
//   - the `queryId` counter and `#jobId` are independent namespaces;
//   - a playtime message is INERT in every state, and the in-flight import
//     still completes normally afterwards;
//   - a worker that died before `ready` answers queries as unavailable
//     without posting to a dead worker;
//   - a worker that is merely idle-and-ready is NOT marked broken, so
//     queries keep working after an informational error event.
// =============================================================================

describe('04-07 the ingest state machine ignores playtime traffic', () => {
  /** A result reply the client must not act on, whatever state it is in. */
  const STRAY_RESULT = {
    type: 'playtime-result',
    queryId: 1,
    importedAt: '2026-01-01T00:00:00.000Z',
    view: null,
  } as const;

  /** An error reply the client must not act on, whatever state it is in. */
  const STRAY_ERROR = {
    type: 'playtime-error',
    queryId: 1,
    detail: 'query failed',
  } as const;

  test('the playtime field is the same instance for the whole client lifetime', () => {
    const { client: c } = makeClient();
    const first = c.playtime;

    c.submitFiles([makeFile('export.zip', 100)]);
    c.playtime.failPending('worker error');
    c.playtime.query(null);

    // A field that were ever re-created would orphan every pending query
    // in flight at the moment of the swap.
    expect(c.playtime).toBe(first);
  });

  test('five playtime queries leave the ingest jobId counter untouched', () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.posts.length = 0;

    for (let i = 0; i < 5; i += 1) void c.playtime.query(i);

    // The counter is a SEPARATE namespace (04-RESEARCH Pattern 1). If a
    // query bumped #jobId, the first ingest would be posted as job 6 and
    // the worker's `done` would be discarded as stale — the dropzone would
    // spin forever. The ready handshake owns jobId 1.
    expect(f.posts.filter((m) => m.type === 'playtime-query')).toHaveLength(5);
    c.submitFiles([makeFile('export.zip', 100)]);
    expect(f.posts.filter((m) => m.type === 'ingest').map((m) => m.jobId)).toEqual([2]);
  });

  test('a confirmed replace is still job 3 after several playtime queries', () => {
    const { c, f } = makeClientWithDisplayedDataset();

    void c.playtime.query(null);
    void c.playtime.query(0);

    c.submitFiles([makeFile('other.zip', 100)]);
    c.confirmPending();

    expect(f.posts.filter((m) => m.type === 'ingest').map((m) => m.jobId)).toEqual([2, 3]);
  });

  test("during 'processing' both playtime messages are inert and the import still completes", () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.emit({ type: 'cache-status', jobId: 1, cached: null });
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({ type: 'stage', jobId: 2, stage: 'parsing' });

    const before = {
      state: c.state,
      stage: c.stage,
      result: c.result,
      errorMessage: c.errorMessage,
      timers: vi.getTimerCount(),
    };

    f.emit(STRAY_RESULT);
    f.emit(STRAY_ERROR);

    // Not one field moved, and no timer was armed by either message.
    expect(c.state).toBe(before.state);
    expect(c.stage).toBe(before.stage);
    expect(c.result).toBe(before.result);
    expect(c.errorMessage).toBe(before.errorMessage);
    expect(vi.getTimerCount()).toBe(before.timers);

    // And the real answer still lands: the import was never disturbed.
    f.emit({ type: 'done', jobId: 2, result: DISPLAYED_RESULT });
    expect(c.state).toBe('done');
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test("during 'idle' both playtime messages are inert", () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.emit({ type: 'cache-status', jobId: 1, cached: null });
    expect(c.state).toBe('idle');

    f.emit(STRAY_RESULT);
    f.emit(STRAY_ERROR);

    expect(c.state).toBe('idle');
    expect(c.result).toBeNull();
    expect(c.errorMessage).toBeNull();
    expect(c.stage).toBeNull();
  });

  test("during 'confirm-pending' both playtime messages leave the confirm and its return state alone", () => {
    const { c, f } = makeClientWithDisplayedDataset();
    c.submitFiles([makeFile('other.zip', 100)]);
    expect(c.state).toBe('confirm-pending');
    const action = c.pendingAction;

    f.emit(STRAY_RESULT);
    f.emit(STRAY_ERROR);

    // The confirm is the user's open question about a destructive action.
    // A playtime reply must not close it and must not stash a new one.
    expect(c.state).toBe('confirm-pending');
    expect(c.pendingAction).toEqual(action);
    expect(c.result).toEqual(DISPLAYED_RESULT);

    // And cancelling it still returns to the dataset view, which is the
    // behaviour the confirm exists to offer.
    c.cancelPending();
    expect(c.state).toBe('done');
  });

  test("during 'done' both playtime messages are inert", () => {
    const { c, f } = makeClientWithDisplayedDataset();

    f.emit(STRAY_RESULT);
    f.emit(STRAY_ERROR);

    expect(c.state).toBe('done');
    expect(c.result).toEqual(DISPLAYED_RESULT);
    expect(c.errorMessage).toBeNull();
  });

  test("during 'error' both playtime messages leave the banner and the dataset alone", () => {
    const { c, f } = makeClientWithDisplayedDataset();
    c.submitFiles([makeFile('other.zip', 100)]);
    c.confirmPending();
    f.emit({ type: 'error', jobId: 3, detail: 'Error: unzip blew up' });
    expect(c.state).toBe('error');

    f.emit(STRAY_RESULT);
    f.emit(STRAY_ERROR);

    // A chart's failure is the CHART's business. The import banner on
    // screen describes the import, and the dataset behind it is real.
    expect(c.state).toBe('error');
    expect(c.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(c.result).toEqual(DISPLAYED_RESULT);
  });

  test('after a confirmed clear both playtime messages leave the acknowledgment alone', () => {
    const { c, f } = makeClientWithDisplayedDataset();
    c.requestClearData();
    c.confirmPending();
    f.emit({ type: 'cleared', jobId: 3 });
    expect(c.state).toBe('idle');
    expect(c.justCleared).toBe(true);

    f.emit(STRAY_RESULT);
    f.emit(STRAY_ERROR);

    expect(c.justCleared).toBe(true);
    expect(c.state).toBe('idle');
    expect(c.result).toBeNull();
  });

  test('a playtime-result between a stage message and the done message does not disturb the stage', () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.emit({ type: 'cache-status', jobId: 1, cached: null });
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({ type: 'stage', jobId: 2, stage: 'parsing' });
    expect(c.stage).toBe('parsing');

    f.emit(STRAY_RESULT);

    // The stage line is what tells the user the parse is still working; a
    // chart's numbers arriving in the same breath must not blank it.
    expect(c.stage).toBe('parsing');
    expect(c.state).toBe('processing');
  });

  test('a worker that died before ready answers queries as unavailable and posts nothing', async () => {
    const { client: c, fake: f } = makeClient();

    // No 'ready' ever arrives: the worker is dead from the start.
    f.emitError('crashed during init');
    expect(c.state).toBe('error');
    const postsBefore = f.posts.length;

    // The sentinel race, as in the Task 1 tracer: with no availability
    // probe the query is posted to the dead worker and never settles, so
    // the race must be armed BEFORE the wait, not after it.
    const outcome = await Promise.race([
      c.playtime.query(null),
      Promise.resolve('never-settled: the query was neither answered nor refused'),
    ]);

    // The broken-worker flag is the availability signal. Posting to a dead
    // worker would be a message into the void, and the query would hang
    // for want of a reply that can never come.
    expect(outcome).toEqual({ kind: 'error', queryId: 1, detail: 'worker unavailable' });
    expect(f.posts).toHaveLength(postsBefore);
    expect(c.playtime.pendingCount).toBe(0);
  });

  test('a worker that is idle and ready is not marked broken: queries still work after an error', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.emit({ type: 'cache-status', jobId: 1, cached: null });

    f.emitError('informational');
    expect(c.state).toBe('idle');

    const outcome = c.playtime.query(null);
    // Ready means reachable, so the query goes out and is answered
    // normally — an error event with no job in flight is not a dead worker.
    f.emit({
      type: 'playtime-result',
      queryId: 1,
      importedAt: '2026-01-01T00:00:00.000Z',
      view: null,
    });

    expect(await outcome).toEqual({
      kind: 'result',
      queryId: 1,
      importedAt: '2026-01-01T00:00:00.000Z',
      view: null,
    });
  });

  test('a query after a confirmed clear resolves normally when the worker replies', async () => {
    const { c, f } = makeClientWithDisplayedDataset();
    c.requestClearData();
    c.confirmPending();
    f.emit({ type: 'cleared', jobId: 3 });
    expect(c.result).toBeNull();

    const outcome = c.playtime.query(null);
    f.emit({ type: 'playtime-result', queryId: 1, importedAt: null, view: null });

    // A cleared dataset is not a broken worker: the query still goes out,
    // and the worker's null-dataset answer is a real answer, not a failure.
    expect(await outcome).toEqual({ kind: 'result', queryId: 1, importedAt: null, view: null });
  });
});

// =============================================================================
// 06-13 — the city bridge is a delegation seam too
//
// `city-result` and `city-error` share the worker channel with the import flow,
// so they are routed to `CityClient` from the FIRST branch of `#handle`, before
// any state-machine branch can read them as something else. A city load that
// moved `#jobId`, `state` or the settle timer would strand the dropzone.
// =============================================================================

describe('06-13 the city bridge', () => {
  const CITY_VIEW = {
    month: '2026-09',
    places: [],
    placeOf: [],
    ranked: [],
    moreCities: 0,
    noCityAddresses: 0,
  };

  test('a load posts city-load with the buffer transferred, through the same worker', () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.posts.length = 0;
    f.transfers.length = 0;

    const bytes = new Uint8Array([1, 2, 3]).buffer;
    void c.city.load(bytes, 3, 'abc');

    expect(f.posts).toEqual([
      { type: 'city-load', loadId: 1, buffer: bytes, expectedBytes: 3, sha256: 'abc' },
    ]);
    expect(f.transfers[0]).toEqual([bytes]);
  });

  test('a city-result and a city-error reach the city client and never move the import state machine', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.emit({ type: 'cache-status', jobId: 1, cached: null });
    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({ type: 'stage', jobId: 2, stage: 'parsing' });
    const before = {
      state: c.state,
      stage: c.stage,
      result: c.result,
      errorMessage: c.errorMessage,
      timers: vi.getTimerCount(),
    };

    const first = c.city.load(new ArrayBuffer(4), 4, null);
    f.emit({ type: 'city-error', loadId: 1, detail: 'city data invalid' });
    const second = c.city.load(new ArrayBuffer(4), 4, null);
    f.emit({ type: 'city-result', loadId: 2, importedAt: 'T', view: CITY_VIEW });

    expect(await first).toEqual({ kind: 'error', loadId: 1, detail: 'city data invalid' });
    expect(await second).toMatchObject({ kind: 'result', loadId: 2 });
    expect(c.state).toBe(before.state);
    expect(c.stage).toBe(before.stage);
    expect(c.result).toBe(before.result);
    expect(c.errorMessage).toBe(before.errorMessage);
    expect(vi.getTimerCount()).toBe(before.timers);

    // The import still completes: nothing was disturbed.
    f.emit({ type: 'done', jobId: 2, result: DISPLAYED_RESULT });
    expect(c.state).toBe('done');
  });

  test('a load leaves the ingest jobId counter untouched', () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    void c.city.load(new ArrayBuffer(4), 4, null);
    void c.city.load(new ArrayBuffer(4), 4, null);
    f.posts.length = 0;
    c.submitFiles([makeFile('export.zip', 100)]);
    expect(f.posts.filter((m) => m.type === 'ingest').map((m) => m.jobId)).toEqual([2]);
  });

  test('a worker error releases a pending city load with a FIXED detail, never the event text', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    f.emit({ type: 'cache-status', jobId: 1, cached: null });
    const outcome = c.city.load(new ArrayBuffer(4), 4, null);

    f.emitError('/Users/someone/secret/ingest.worker.js:1 boom');

    expect(await outcome).toEqual({ kind: 'error', loadId: 1, detail: 'worker error' });
    expect(c.city.pendingCount).toBe(0);
  });

  test('a message that cannot be deserialized releases a pending city load too', async () => {
    const { client: c, fake: f } = makeClient();
    f.emit({ type: 'ready' });
    const outcome = c.city.load(new ArrayBuffer(4), 4, null);

    f.emitMessageError();

    expect(await outcome).toEqual({
      kind: 'error',
      loadId: 1,
      detail: 'worker message could not be deserialized',
    });
  });

  test('the city field is the same instance for the whole client lifetime', () => {
    const { client: c, fake: f } = makeClient();
    const first = c.city;
    f.emit({ type: 'ready' });
    c.city.failPending('worker error');
    expect(c.city).toBe(first);
  });
});
