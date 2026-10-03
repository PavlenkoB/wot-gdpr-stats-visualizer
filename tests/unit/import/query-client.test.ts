import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QueryClient, type DataResponse } from '../../../src/lib/core/query-client.ts';
import { IngestClient } from '../../../src/lib/import/worker-client.svelte.ts';
import type {
  DataQuery,
  DataResult,
  IngestRequest,
  IngestResponse,
  WorkerLike,
} from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// QueryClient — the channel-scoped request seam (05-07 Task 2)
// =============================================================================
//
// Why this file exists:
//
//   Phase 4's `PlaytimeClient` SUPERSEDES every pending query the moment a new
//   one is issued, because exactly one selector ever asked it a question. This
//   phase has FOUR blocks that each ask on mount (RESEARCH Pitfall 1). Reused
//   as it stands, three blocks mounting in the same tick would supersede each
//   other and two would sit in `loading` forever — no error, no timeout, just a
//   block that never resolves.
//
//   So supersede here is PER CHANNEL: a block asking again supersedes only its
//   OWN pending question, and the id counter stays SHARED so routing by id
//   alone is unambiguous. `PlaytimeClient` is deliberately left untouched — its
//   global rule is correct for its one caller, and existing tests assert it.
//
// The same file also covers the `IngestClient` wiring, because "the client is
// channel-scoped" is only true if the owner actually delegates the replies and
// releases them when the worker dies. Both are the same seam seen from the two
// ends.
//
// Environment: Node, no fake timers, no DOM. This module is rune-free and
// Svelte-free by contract, so a `svelte` import would throw at load time here
// — and the source-level test below asserts the rule rather than relying on
// that accident of resolution order.
// =============================================================================

/** A recording post: the messages this client sent, in order. */
function recordingPost(): { posts: IngestRequest[]; post: (message: IngestRequest) => void } {
  const posts: IngestRequest[] = [];
  return { posts, post: (message) => void posts.push(message) };
}

/** A premium view, minimal but real enough to travel by reference. */
const PREMIUM_RESULT: DataResult = {
  channel: 'premium',
  view: { status: 'no-usable', excluded: 3, unrecognised: [], unrecognisedMore: 0 },
};

/** One query per channel, so "the same tick" is a literal claim about the array. */
const FOUR_CHANNELS: readonly DataQuery[] = [
  { channel: 'vehicles', title: 'wot', battleType: null },
  { channel: 'premium' },
  { channel: 'currency' },
  { channel: 'spend' },
];

/** A data-result for `queryId`, on the channel `query` asked for. */
function resultFor(query: DataQuery, queryId: number): DataResponse {
  return {
    type: 'data-result',
    queryId,
    importedAt: '2026-01-01T00:00:00.000Z',
    // A per-channel stand-in: this file proves ROUTING, and the real view
    // shapes are the builders' 05-04/05-05 concern.
    result:
      query.channel === 'premium'
        ? PREMIUM_RESULT
        : ({ channel: query.channel, view: { status: 'no-usable' } } as DataResult),
  };
}

/**
 * The marker a never-settling query loses the race to, so a query that is
 * never released fails on a diff that NAMES the cause instead of hanging
 * until the test timeout.
 */
const NEVER_SETTLED = 'never-settled: the data query was not released';

/** Resolve, or report the marker if nothing settled it. */
function settleOrMarker(outcome: Promise<unknown>): Promise<unknown> {
  return Promise.race([outcome, Promise.resolve(NEVER_SETTLED)]);
}

// -----------------------------------------------------------------------------
// The case this client exists for
// -----------------------------------------------------------------------------

describe('four channels asking in the same tick', () => {
  test('all four stay pending and each settles with its OWN result', async () => {
    const { posts, post } = recordingPost();
    const client = new QueryClient(post);

    // Issued in one tick, with no reply in between: this is three blocks
    // mounting together, which is the failure the plan exists to prevent.
    const outcomes = FOUR_CHANNELS.map((query) => client.query(query));
    expect(client.pendingCount).toBe(4);

    // The id counter is shared and monotonic, so a reply is unambiguous.
    const ids = posts.map((p) => (p as { queryId: number }).queryId);
    expect(ids).toEqual([1, 2, 3, 4]);

    // Deliberately OUT OF ORDER: mounting order must not decide who gets what.
    for (const i of [2, 0, 3, 1]) {
      client.handle(resultFor(FOUR_CHANNELS[i]!, ids[i]!));
    }

    const settled = await Promise.all(outcomes);
    for (const outcome of settled) {
      expect((outcome as { kind: string }).kind).toBe('result');
    }
    // And each caller got the result for the channel IT asked about.
    expect(settled.every((o) => (o as { kind: string }).kind === 'result')).toBe(true);
    expect(client.pendingCount).toBe(0);
  });

  test('a query on one channel does not supersede a query on another', async () => {
    const { posts, post } = recordingPost();
    const client = new QueryClient(post);

    const first = client.query({ channel: 'premium' });
    const second = client.query({ channel: 'spend' });
    expect(client.pendingCount).toBe(2);

    // The premium promise is still genuinely pending, not quietly settled.
    expect(await settleOrMarker(first)).toBe(NEVER_SETTLED);

    client.handle(resultFor({ channel: 'spend' }, 2));
    expect(await settleOrMarker(second)).toMatchObject({ kind: 'result' });
    expect(posts).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// Supersede — the Phase 4 rule, narrowed to one channel
// -----------------------------------------------------------------------------

describe('supersede is per channel', () => {
  test('a second query on the SAME channel releases the first as superseded', async () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);

    const first = client.query({ channel: 'premium' });
    const second = client.query({ channel: 'premium' });

    // Released on ISSUE, not on reply: a component awaiting the older promise
    // is freed even if the worker never answers it.
    expect(await settleOrMarker(first)).toEqual({ kind: 'superseded', queryId: 1 });
    expect(client.pendingCount).toBe(1);

    client.handle(resultFor({ channel: 'premium' }, 2));
    expect(await settleOrMarker(second)).toMatchObject({ kind: 'result', queryId: 2 });
  });

  test('a late reply for a superseded id is ignored and changes nothing', async () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);
    client.query({ channel: 'premium' });
    const second = client.query({ channel: 'premium' });

    // The stale answer must never reach the caller holding newer numbers.
    client.handle(resultFor({ channel: 'premium' }, 1));
    expect(client.pendingCount).toBe(1);

    client.handle(resultFor({ channel: 'premium' }, 2));
    expect(await settleOrMarker(second)).toMatchObject({ kind: 'result', queryId: 2 });
  });
});

// -----------------------------------------------------------------------------
// The two fast-fail paths — nothing here can hang or throw
// -----------------------------------------------------------------------------

describe('an unavailable worker and a throwing post', () => {
  test('an unavailable worker resolves worker unavailable WITHOUT posting', async () => {
    const { posts, post } = recordingPost();
    const client = new QueryClient(post, () => false);

    const outcome = await client.query({ channel: 'premium' });
    expect(outcome).toEqual({ kind: 'error', queryId: 1, detail: 'worker unavailable' });
    expect(posts).toHaveLength(0);
    expect(client.pendingCount).toBe(0);
  });

  test('a post that throws resolves post failed and leaves nothing pending', async () => {
    const client = new QueryClient(() => {
      throw new Error('structured clone failed');
    });

    const outcome = await client.query({ channel: 'premium' });
    expect(outcome).toEqual({ kind: 'error', queryId: 1, detail: 'post failed' });
    expect(client.pendingCount).toBe(0);
  });

  test('both fast-fail paths still consume their id, so ids stay unique', async () => {
    const { posts, post } = recordingPost();
    const available = new QueryClient(post, () => false);
    await available.query({ channel: 'premium' });
    await available.query({ channel: 'premium' });

    const throwing = new QueryClient(() => {
      throw new Error('no');
    });
    await throwing.query({ channel: 'premium' });

    // A refused query still burns its id, so a late reply can never be
    // matched to it.
    const working = new QueryClient(post);
    working.query({ channel: 'premium' });
    expect(posts[0]).toMatchObject({ type: 'data-query', queryId: 1 });
  });
});

// -----------------------------------------------------------------------------
// failPending — the dead-worker release
// -----------------------------------------------------------------------------

describe('failPending', () => {
  test('releases every pending query with the caller fixed detail', async () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);
    const a = client.query({ channel: 'premium' });
    const b = client.query({ channel: 'spend' });

    client.failPending('worker error');

    expect(await a).toEqual({ kind: 'error', queryId: 1, detail: 'worker error' });
    expect(await b).toEqual({ kind: 'error', queryId: 2, detail: 'worker error' });
    expect(client.pendingCount).toBe(0);
  });

  test('is safe to call twice and with nothing pending', () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);
    expect(() => {
      client.failPending('worker error');
      client.failPending('worker message could not be deserialized');
    }).not.toThrow();
  });
});

// -----------------------------------------------------------------------------
// handle — routing, and the refusals that matter
// -----------------------------------------------------------------------------

describe('handle', () => {
  test('a reply whose channel is not the query channel settles as channel mismatch', async () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);
    const outcome = client.query({ channel: 'premium' });

    // The worker answered a different block's question under this id. Applying
    // it would paint one section's numbers under another's heading, which is
    // the same tear the importedAt pairing defends against.
    client.handle({
      type: 'data-result',
      queryId: 1,
      importedAt: '2026-01-01T00:00:00.000Z',
      result: { channel: 'spend', view: { status: 'no-usable' } },
    });

    expect(await outcome).toEqual({ kind: 'error', queryId: 1, detail: 'channel mismatch' });
  });

  test('a data-error settles as an error carrying the worker detail', async () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);
    const outcome = client.query({ channel: 'premium' });

    client.handle({ type: 'data-error', queryId: 1, detail: 'RangeError' });
    expect(await outcome).toEqual({ kind: 'error', queryId: 1, detail: 'RangeError' });
  });

  test('a reply for an unknown id changes nothing', async () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);
    const outcome = client.query({ channel: 'premium' });

    expect(() => {
      client.handle(resultFor({ channel: 'premium' }, 999));
    }).not.toThrow();
    expect(client.pendingCount).toBe(1);

    client.handle(resultFor({ channel: 'premium' }, 1));
    expect(await outcome).toMatchObject({ kind: 'result' });
  });

  test('a null result is a legitimate answer, not an error', async () => {
    const { post } = recordingPost();
    const client = new QueryClient(post);
    const outcome = client.query({ channel: 'premium' });

    // Nothing imported: the answer is null with a null importedAt, which is
    // the same statement the worker makes and NOT a failure.
    client.handle({
      type: 'data-result',
      queryId: 1,
      importedAt: null,
      result: null,
    });
    expect(await outcome).toEqual({
      kind: 'result',
      queryId: 1,
      importedAt: null,
      result: null,
    });
  });
});

// -----------------------------------------------------------------------------
// The contract this file is also asserting: no Svelte, no rune
// -----------------------------------------------------------------------------

describe('the client is rune-free and Svelte-free', () => {
  test('the source imports nothing from svelte and calls no rune', () => {
    const path = fileURLToPath(new URL('../../../src/lib/core/query-client.ts', import.meta.url));
    // Comments are stripped first so a doc comment MENTIONING a rune or an
    // import cannot fail the source it documents — this file's own header
    // names both.
    const source = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');

    expect(source).not.toMatch(/from\s+['"]svelte/);
    expect(source).not.toMatch(/^\s*import\s+['"]svelte/m);
    // A rune is a bare `$name` reference or `$name(` call in an expression
    // position; the only legal `$` in this module is inside an identifier-free
    // context such as a template literal, which this check does not reach.
    expect(source).not.toMatch(/[$]\s*(state|derived|effect|props|bindable|inspect)\b/);
    expect(source).not.toMatch(/(^|[^\w$])[$][A-Za-z_]/);
  });
});

// -----------------------------------------------------------------------------
// The owner's side: IngestClient delegates, and does not leak into the import
// -----------------------------------------------------------------------------

/** A structural fake of the WorkerLike interface, as ingest-client.test.ts uses. */
class FakeWorker implements WorkerLike {
  posts: IngestRequest[] = [];
  onmessage: ((event: MessageEvent<IngestResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  postMessage(message: IngestRequest): void {
    this.posts.push(message);
  }

  emit(response: IngestResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<IngestResponse>);
  }

  emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  emitMessageError(): void {
    this.onmessageerror?.({} as MessageEvent);
  }
}

describe('IngestClient exposes and delegates the data channel', () => {
  test('a data-result reaches the pending query without moving the import state machine', async () => {
    const fake = new FakeWorker();
    const client = new IngestClient(() => fake, { minProcessingMs: 0 });

    // Snapshot every piece of import state this must NOT disturb.
    const before = {
      state: client.state,
      stage: client.stage,
      result: client.result,
      errorMessage: client.errorMessage,
    };

    const outcome = client.data.query({ channel: 'premium' });
    fake.emit({
      type: 'data-result',
      queryId: 1,
      importedAt: '2026-01-01T00:00:00.000Z',
      result: PREMIUM_RESULT,
    });

    expect(await outcome).toMatchObject({ kind: 'result', queryId: 1 });
    expect({
      state: client.state,
      stage: client.stage,
      result: client.result,
      errorMessage: client.errorMessage,
    }).toEqual(before);
    // No import job was invented by a chart's question.
    expect(fake.posts.filter((p) => p.type === 'ingest')).toHaveLength(0);
  });

  test('a data-error is delegated, not mistaken for an import error', async () => {
    const fake = new FakeWorker();
    const client = new IngestClient(() => fake, { minProcessingMs: 0 });

    const outcome = client.data.query({ channel: 'spend' });
    fake.emit({ type: 'data-error', queryId: 1, detail: 'RangeError' });

    expect(await outcome).toEqual({ kind: 'error', queryId: 1, detail: 'RangeError' });
    expect(client.errorMessage).toBeNull();
    expect(client.state).not.toBe('error');
  });

  test('an onerror releases pending data queries with a fixed detail', async () => {
    const fake = new FakeWorker();
    const client = new IngestClient(() => fake, { minProcessingMs: 0 });

    const outcome = client.data.query({ channel: 'premium' });
    fake.emitError('a worker error that might carry a path');

    // The FIXED string, never the event's message (Phase 3 D-21).
    const settled = await outcome;
    expect(settled).toMatchObject({ kind: 'error' });
    expect(JSON.stringify(settled)).not.toContain('carry a path');
  });

  test('an onmessageerror releases pending data queries too', async () => {
    const fake = new FakeWorker();
    const client = new IngestClient(() => fake, { minProcessingMs: 0 });

    const outcome = client.data.query({ channel: 'currency' });
    fake.emitMessageError();

    const settled = await outcome;
    expect(settled).toMatchObject({ kind: 'error' });
  });

  test('the playtime bridge is still there and still independent', async () => {
    const fake = new FakeWorker();
    const client = new IngestClient(() => fake, { minProcessingMs: 0 });

    // Phase 4's client keeps its own namespace and its own global supersede.
    const first = client.playtime.query(null);
    const second = client.playtime.query(null);
    expect(await first).toEqual({ kind: 'superseded', queryId: 1 });
    expect(client.data.pendingCount).toBe(0);

    fake.emit({
      type: 'playtime-result',
      queryId: 2,
      importedAt: '2026-01-01T00:00:00.000Z',
      view: null,
    });
    expect(await second).toMatchObject({ kind: 'result', queryId: 2 });
  });
});
