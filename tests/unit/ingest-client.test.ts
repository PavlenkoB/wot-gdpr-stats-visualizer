import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GENERIC_FAILURE_MESSAGE, STAGE_TEXT } from '../../src/lib/ui-copy.ts';
import { MIN_PROCESSING_MS, IngestClient } from '../../src/lib/worker-client.svelte.ts';
import type {
  IngestRequest,
  IngestResponse,
  WorkerLike,
} from '../../src/lib/types/worker-messages.ts';

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

  postMessage(message: IngestRequest): void {
    this.posts.push(message);
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
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0]).toEqual({ type: 'ingest', jobId: 1, file });
    expect(client.state).toBe('processing');
    expect(client.stage).toBe('unzipping');
    expect(client.errorMessage).toBeNull();
  });

  test('a single non-empty .zip named "EXPORT.ZIP" (uppercase) is accepted', () => {
    fake.emit({ type: 'ready' });
    const file = makeFile('EXPORT.ZIP', 50);
    const ok = client.submitFiles([file]);
    expect(ok).toBe(true);
    expect(fake.posts).toHaveLength(1);
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
    expect(fake.posts).toHaveLength(0);
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
    expect(fake.posts).toHaveLength(0);
    expect(client.state).toBe('error');
    expect(consoleSpyContains('pre-check')).toBe(true);
  });

  test('a non-empty notes.txt returns false, posts nothing, lands in error state with cause in the console', () => {
    fake.emit({ type: 'ready' });
    const file = makeFile('notes.txt', 10, 'text/plain');
    const ok = client.submitFiles([file]);
    expect(ok).toBe(false);
    expect(fake.posts).toHaveLength(0);
    expect(client.state).toBe('error');
    expect(consoleSpyContains('pre-check')).toBe(true);
  });

  test('a zero-byte empty.zip returns false, posts nothing, lands in error state with cause in the console', () => {
    fake.emit({ type: 'ready' });
    const file = makeFile('empty.zip', 0);
    expect(file.size).toBe(0);
    const ok = client.submitFiles([file]);
    expect(ok).toBe(false);
    expect(fake.posts).toHaveLength(0);
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

import { precheckFiles } from '../../src/lib/precheck.ts';

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

    fake.emit({
      type: 'error',
      jobId: 1,
      detail: 'Error: unrecognized export: no-recognized-category (2 entries)',
    });

    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);
    expect(consoleSpyContains('no-recognized-category')).toBe(true);
  });

  test("a { type: 'done' } for a stale jobId while job 1 is in flight is ignored; state stays 'processing'", () => {
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

  test("a { type: 'error', jobId: 99 } for a stale jobId while job 1 is in flight is ignored; state stays 'processing'", () => {
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
    expect(fake.posts).toHaveLength(1);

    const second = client.submitFiles([makeFile('other.zip', 100)]);
    expect(second).toBe(false);
    expect(fake.posts).toHaveLength(1);
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
    // No 'ready' emitted. onerror fires while still idle.
    fake.emitError('crashed during init');
    expect(client.state).toBe('error');
    expect(client.errorMessage).toBe(GENERIC_FAILURE_MESSAGE);

    fake.emit({ type: 'ready' });
    const ok = client.submitFiles([makeFile('export.zip', 100)]);
    expect(ok).toBe(false);
    expect(fake.posts).toHaveLength(0);
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
    expect(fake.posts).toHaveLength(1);
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
    vi.advanceTimersByTime(50);
    f.emit({
      type: 'done',
      jobId: 1,
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
      jobId: 1,
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
    f.emit({ type: 'error', jobId: 1, detail: 'synthetic worker error' });

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
      jobId: 1,
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
      jobId: 1,
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
  test('submitFiles while state is "done" returns false, posts nothing, leaves the result intact', () => {
    const f = new FakeWorker();
    const c = new IngestClient(() => f, { minProcessingMs: 0 });
    f.emit({ type: 'ready' });

    // Land in 'done'.
    c.submitFiles([makeFile('export.zip', 100)]);
    const result = {
      accountRoot: 'stale',
      categories: [],
      counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
    };
    f.emit({ type: 'done', jobId: 1, result });
    expect(c.state).toBe('done');

    // A second submission must be a silent no-op (D-13).
    const ok = c.submitFiles([makeFile('other.zip', 100)]);
    expect(ok).toBe(false);
    expect(f.posts).toHaveLength(1); // only the first submission was posted
    expect(c.state).toBe('done');
    expect(c.result).toEqual(result); // still the original result
    expect(consoleSpyContains('results shown, drop ignored')).toBe(true);
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
    expect(f.posts).toHaveLength(1);
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

    c.submitFiles([makeFile('export.zip', 100)]);
    f.emit({
      type: 'done',
      jobId: 1,
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
      jobId: 1,
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
    expect(f.posts).toHaveLength(2);
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
    expect(f.posts).toHaveLength(1); // submission was posted
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
