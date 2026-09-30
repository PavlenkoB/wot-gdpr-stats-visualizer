import { describe, expect, test } from 'vitest';
import { PlaytimeClient } from '../../src/lib/playtime-client.ts';
import type { IngestRequest, PlaytimeView } from '../../src/lib/types/worker-messages.ts';

// =============================================================================
// PlaytimeClient — the request-seam behaviour matrix (04-07 Task 2)
// =============================================================================
//
// Why this file exists:
//   `PlaytimeClient` is the ONLY place a stale playtime answer is
//   neutralised. Plan 04-01 built the shape (own `queryId` namespace, a
//   resolver map, a delegation seam at the top of `IngestClient.#handle`)
//   and plan 04-07 Task 1 gave it `failPending` for a dead worker. What is
//   still unproven is the ordinary case: a user dragging the split selector
//   (D-03, UI-SPEC `updating` — "the latest request wins; a response for an
//   older selection is ignored"). A selector change issues a second query
//   while the first is usually still in flight, and the two replies can
//   arrive in either order. If the older one were allowed to settle the
//   newer one, the charts would paint one slice's numbers under another's
//   heading — T-04-13.
//
// The five ways a query must settle, all of them:
//   1. a result reply,           -> { kind: 'result', … }
//   2. a playtime-error reply,   -> { kind: 'error', detail }
//   3. a newer query,            -> { kind: 'superseded' }   (D-03 latest wins)
//   4. the worker is unavailable -> { kind: 'error', 'worker unavailable' }
//   5. the post itself threw     -> { kind: 'error', 'post failed' }
//   plus `failPending` from the worker-error path (04-07 Task 1, covered
//   through `IngestClient` in ingest-client.test.ts, and directly here).
//
// Environment: Node, no fake timers. This module is rune-free and DOM-free
// by contract (04-01), so the whole file running in the Node environment is
// itself part of what is being asserted: a `svelte` import or a `window`
// reference would throw at load time here.
// =============================================================================

/** A recording post: the messages this client sent, in order. */
function recordingPost(): { posts: IngestRequest[]; post: (message: IngestRequest) => void } {
  const posts: IngestRequest[] = [];
  return { posts, post: (message) => void posts.push(message) };
}

/** A minimal ready view; the aggregation core is 04-03's concern, not this one's. */
const READY_VIEW: PlaytimeView = {
  status: 'ready',
  split: null,
  selected: null,
  slice: {
    seconds: 3600,
    sessions: 12,
    excluded: 0,
    dayIndex: [],
    daySeconds: [],
    daySessions: [],
    hourOverlap: [],
    hourStart: [],
    bins: [],
  },
};

/**
 * The marker a never-settling query loses the race to. A plain string, so a
 * query that is never released fails on an assertion diff that NAMES the
 * cause instead of hanging until the test timeout.
 */
const NEVER_SETTLED = 'never-settled: the playtime query was not released';

/** Resolve the query, or report the marker if nothing settled it. */
function settleOrMarker(outcome: Promise<unknown>): Promise<unknown> {
  return Promise.race([outcome, Promise.resolve(NEVER_SETTLED)]);
}

// -----------------------------------------------------------------------------
// The id namespace — own counter, per instance, starting at 1
// -----------------------------------------------------------------------------

describe('the queryId namespace', () => {
  test('the counter starts at 1 per instance and increments by one per query', () => {
    const { posts, post } = recordingPost();
    const client = new PlaytimeClient(post);

    void client.query(null);
    void client.query(3);
    void client.query(0);

    expect(posts).toEqual([
      { type: 'playtime-query', queryId: 1, valueIndex: null },
      { type: 'playtime-query', queryId: 2, valueIndex: 3 },
      { type: 'playtime-query', queryId: 3, valueIndex: 0 },
    ]);
  });

  test('two instances do not share ids', () => {
    const first = recordingPost();
    const second = recordingPost();

    void new PlaytimeClient(first.post).query(null);
    void new PlaytimeClient(second.post).query(null);

    expect(first.posts).toEqual([{ type: 'playtime-query', queryId: 1, valueIndex: null }]);
    expect(second.posts).toEqual([{ type: 'playtime-query', queryId: 1, valueIndex: null }]);
  });
});

// -----------------------------------------------------------------------------
// Latest request wins (D-03, UI-SPEC `updating`, T-04-13)
// -----------------------------------------------------------------------------

describe('latest request wins', () => {
  test('issuing a second query supersedes the first immediately, before any reply', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    const first = client.query(null);
    void client.query(1);

    // The FIRST promise is released the moment the second is issued — not
    // when a reply arrives, and not only if one ever does. A selector drag
    // must never leave an earlier request's `await` parked.
    expect(await settleOrMarker(first)).toEqual({ kind: 'superseded', queryId: 1 });
    // The newest query is still live: the older one did not take its slot,
    // and nothing has been posted for it twice.
    expect(client.pendingCount).toBe(1);
  });

  test('a late reply for a superseded id is ignored, and the newest query still resolves', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    const first = client.query(null);
    const second = client.query(1);
    expect(await settleOrMarker(first)).toEqual({ kind: 'superseded', queryId: 1 });

    // Out-of-order worker: the answer to the OLD request arrives last.
    client.handle({ type: 'playtime-result', queryId: 1, importedAt: 'a', view: READY_VIEW });
    expect(client.pendingCount).toBe(1);

    client.handle({ type: 'playtime-result', queryId: 2, importedAt: 'a', view: READY_VIEW });
    expect(await settleOrMarker(second)).toEqual({
      kind: 'result',
      queryId: 2,
      importedAt: 'a',
      view: READY_VIEW,
    });
  });
});

// -----------------------------------------------------------------------------
// Replies — matched, or dropped without a sound
// -----------------------------------------------------------------------------

describe('reply routing', () => {
  test('an unknown queryId is ignored: no throw, no resolution, pending count unchanged', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    const outcome = client.query(null);

    expect(() =>
      client.handle({ type: 'playtime-error', queryId: 99, detail: 'nope' }),
    ).not.toThrow();
    expect(client.pendingCount).toBe(1);
    expect(await settleOrMarker(outcome)).toBe(NEVER_SETTLED);
  });

  test('a duplicate reply for an already-resolved id is ignored', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    const outcome = client.query(null);
    client.handle({ type: 'playtime-result', queryId: 1, importedAt: 'a', view: READY_VIEW });
    expect(await outcome).toMatchObject({ kind: 'result', queryId: 1 });

    expect(() =>
      client.handle({ type: 'playtime-result', queryId: 1, importedAt: 'a', view: READY_VIEW }),
    ).not.toThrow();
    expect(client.pendingCount).toBe(0);
  });

  test('a playtime-error reply resolves an error outcome carrying the detail and frees the slot', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    const outcome = client.query(0);
    client.handle({ type: 'playtime-error', queryId: 1, detail: 'aggregate read failed' });

    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'error',
      queryId: 1,
      detail: 'aggregate read failed',
    });
    expect(client.pendingCount).toBe(0);
  });

  test('a result reply for a dataset the worker never stored resolves with both nulls', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    const outcome = client.query(null);
    client.handle({ type: 'playtime-result', queryId: 1, importedAt: null, view: null });

    // The nulls are the ANSWER, not a failure: the worker is reporting that
    // it has no stored aggregate for the dataset it was asked about. How the
    // block renders that is the component's decision (04-02 recorded one,
    // revisited at the end of this plan).
    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'result',
      queryId: 1,
      importedAt: null,
      view: null,
    });
  });
});

// -----------------------------------------------------------------------------
// The two fast-fail paths — no hang, no rejection
// -----------------------------------------------------------------------------

describe('an unavailable worker', () => {
  test('a query resolves at once as an error, posts nothing and leaves nothing pending', async () => {
    const { posts, post } = recordingPost();
    const client = new PlaytimeClient(post, () => false);

    const outcome = client.query(null);

    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'error',
      queryId: 1,
      detail: 'worker unavailable',
    });
    // Nothing was posted to a worker that is known to be dead — the same
    // fail-fast rule `submitFiles` follows for `#workerBroken`.
    expect(posts).toEqual([]);
    expect(client.pendingCount).toBe(0);
  });

  test('the id counter still advances, so ids stay unique across an unavailable worker', () => {
    const { posts, post } = recordingPost();
    let available = false;
    const client = new PlaytimeClient(post, () => available);

    void client.query(null);
    void client.query(null);
    available = true;
    void client.query(null);

    // Ids 1 and 2 were consumed by the refused queries, so the live one is 3.
    // A late reply can never collide with a refused query's id.
    expect(posts).toEqual([{ type: 'playtime-query', queryId: 3, valueIndex: null }]);
  });
});

describe('a post that throws', () => {
  test('the query resolves as an error outcome rather than rejecting or hanging', async () => {
    const client = new PlaytimeClient(() => {
      // A structured-clone failure is the realistic case: a value that
      // cannot be cloned across the worker boundary.
      throw new Error('DataCloneError: could not be cloned');
    });

    // A rejection is the bug: it is reported as the marker so the failure
    // is a diff naming the cause rather than a raw throw out of `await`.
    const outcome = await client.query(null).then(
      (value) => value,
      () => 'rejected: the playtime query rejected',
    );

    expect(outcome).toEqual({ kind: 'error', queryId: 1, detail: 'post failed' });
    expect(client.pendingCount).toBe(0);
  });

  test('the thrown text is not copied into the detail', async () => {
    const client = new PlaytimeClient(() => {
      throw new Error('DataCloneError: /Users/someone/Downloads/export.zip');
    });

    const outcome = await client.query(null).then(
      (value) => value,
      () => 'rejected: the playtime query rejected',
    );

    // D-21: the outcome is local bookkeeping and must not carry a path out
    // of the page. A fixed detail names the failure; the console has the
    // real one.
    expect(outcome).toMatchObject({ kind: 'error', detail: 'post failed' });
    if (typeof outcome === 'string' || outcome.kind !== 'error') {
      throw new Error(`unreachable: kind guard, got ${JSON.stringify(outcome)}`);
    }
    expect(outcome.detail).not.toContain('Downloads');
  });
});

// -----------------------------------------------------------------------------
// failPending — the worker-died path, direct
// -----------------------------------------------------------------------------

describe('failPending', () => {
  test('the live query is released with the fixed detail and its own id', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    const outcome = client.query(null);
    expect(client.pendingCount).toBe(1);

    client.failPending('worker error');

    expect(await settleOrMarker(outcome)).toEqual({
      kind: 'error',
      queryId: 1,
      detail: 'worker error',
    });
    expect(client.pendingCount).toBe(0);
  });

  test('it releases exactly the live query: an already-superseded one is not touched again', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    // Two queries in a row. The FIRST is already settled as superseded by
    // the time failPending runs, so the map holds one live entry and the
    // loop must settle that one exactly once.
    const first = client.query(null);
    const live = client.query(1);
    expect(await settleOrMarker(first)).toEqual({ kind: 'superseded', queryId: 1 });

    client.failPending('worker error');

    // The superseded query keeps its own outcome — a second settlement of
    // the same promise would be a no-op at best and a lie at worst.
    expect(await settleOrMarker(first)).toEqual({ kind: 'superseded', queryId: 1 });
    expect(await settleOrMarker(live)).toEqual({
      kind: 'error',
      queryId: 2,
      detail: 'worker error',
    });
  });

  test('it is idempotent and safe to call with nothing pending', () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    expect(() => {
      client.failPending('worker error');
      client.failPending('worker error');
    }).not.toThrow();
    expect(client.pendingCount).toBe(0);
  });

  test('the client stays usable for a fresh query afterwards', async () => {
    const { post } = recordingPost();
    const client = new PlaytimeClient(post);

    void client.query(null);
    client.failPending('worker error');

    const next = client.query(1);
    client.handle({ type: 'playtime-result', queryId: 2, importedAt: 'a', view: READY_VIEW });

    // A released client is not a dead one: the next query is a normal
    // round-trip, and it is the one that resolves.
    expect(await settleOrMarker(next)).toEqual({
      kind: 'result',
      queryId: 2,
      importedAt: 'a',
      view: READY_VIEW,
    });
  });
});
