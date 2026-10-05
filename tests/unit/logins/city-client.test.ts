import { describe, expect, it } from 'vitest';
import { CityClient, type CityOutcome } from '../../../src/lib/features/logins/city-client.ts';
import type { CityView } from '../../../src/lib/features/logins/city-shared.ts';
import type { IngestRequest } from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// CityClient (06-13, Task 2)
//
// The bridge between a downloaded buffer and the worker's reply. It is its own
// id namespace and its own resolver map, it never rejects, and it never carries
// text it did not choose itself: the detail of a failure is a fixed string.
// =============================================================================

const VIEW: CityView = {
  month: '2026-09',
  places: [],
  placeOf: [],
  ranked: [],
  moreCities: 0,
  noCityAddresses: 0,
};

/** A client with a recording post, so each test reads what was sent and how. */
function makeClient(options: { available?: boolean; throws?: boolean } = {}) {
  const posts: { message: IngestRequest; transfer: Transferable[] }[] = [];
  const client = new CityClient(
    (message, transfer) => {
      if (options.throws === true) throw new Error('/private/path/leak');
      posts.push({ message, transfer });
    },
    () => options.available !== false,
  );
  return { client, posts };
}

const buffer = (): ArrayBuffer => new Uint8Array([1, 2, 3]).buffer;

describe('CityClient.load', () => {
  it('posts one city-load message with the buffer in the transfer list', () => {
    const { client, posts } = makeClient();
    const bytes = buffer();
    void client.load(bytes, 3, 'abc');
    expect(posts).toHaveLength(1);
    expect(posts[0]!.message).toEqual({
      type: 'city-load',
      loadId: 1,
      buffer: bytes,
      expectedBytes: 3,
      sha256: 'abc',
    });
    // The SAME buffer, by identity: a copy would be 11.8 MB moved twice.
    expect(posts[0]!.transfer).toHaveLength(1);
    expect(posts[0]!.transfer[0]).toBe(bytes);
  });

  it('really moves the buffer when the post is a structured clone with a transfer list', () => {
    const received: ArrayBuffer[] = [];
    const client = new CityClient((message, transfer) => {
      if (message.type !== 'city-load') return;
      const cloned = structuredClone(message, { transfer });
      received.push(cloned.buffer);
    });
    const bytes = buffer();
    void client.load(bytes, 3, null);
    expect(bytes.byteLength).toBe(0);
    expect(received[0]!.byteLength).toBe(3);
  });

  it('names the load it issued through lastLoadId, starting at 0', () => {
    const { client } = makeClient();
    expect(client.lastLoadId).toBe(0);
    void client.load(buffer(), 3, null);
    expect(client.lastLoadId).toBe(1);
    void client.load(buffer(), 3, null);
    expect(client.lastLoadId).toBe(2);
  });

  it('resolves a result for the id the worker answered', async () => {
    const { client } = makeClient();
    const outcome = client.load(buffer(), 3, null);
    client.handle({ type: 'city-result', loadId: 1, importedAt: 'T', view: VIEW });
    expect(await outcome).toEqual({ kind: 'result', loadId: 1, importedAt: 'T', view: VIEW });
    expect(client.pendingCount).toBe(0);
  });

  it('resolves an error reply with the worker fixed detail', async () => {
    const { client } = makeClient();
    const outcome = client.load(buffer(), 3, null);
    client.handle({ type: 'city-error', loadId: 1, detail: 'city data invalid' });
    expect(await outcome).toEqual({ kind: 'error', loadId: 1, detail: 'city data invalid' });
  });
});

describe('supersede, unknown ids and failPending', () => {
  it('a newer load supersedes an older pending one at once', async () => {
    const { client } = makeClient();
    const first = client.load(buffer(), 3, null);
    const second = client.load(buffer(), 3, null);
    expect(await first).toEqual({ kind: 'superseded', loadId: 1 });
    expect(client.pendingCount).toBe(1);
    client.handle({ type: 'city-result', loadId: 2, importedAt: 'T', view: VIEW });
    expect((await second).kind).toBe('result');
  });

  it('a late reply for a superseded load is ignored, and cannot settle the newer one', async () => {
    const { client } = makeClient();
    void client.load(buffer(), 3, null);
    const second = client.load(buffer(), 3, null);
    client.handle({ type: 'city-result', loadId: 1, importedAt: 'OLD', view: VIEW });
    expect(client.pendingCount).toBe(1);
    client.handle({ type: 'city-result', loadId: 2, importedAt: 'NEW', view: VIEW });
    expect(await second).toMatchObject({ kind: 'result', importedAt: 'NEW' });
  });

  it('ignores an unknown loadId without throwing', () => {
    const { client } = makeClient();
    expect(() => client.handle({ type: 'city-error', loadId: 99, detail: 'x' })).not.toThrow();
    expect(client.pendingCount).toBe(0);
  });

  it('failPending releases every pending load with the given fixed detail, and is idempotent', async () => {
    const { client } = makeClient();
    const outcome = client.load(buffer(), 3, null);
    client.failPending('worker error');
    expect(await outcome).toEqual({ kind: 'error', loadId: 1, detail: 'worker error' });
    expect(client.pendingCount).toBe(0);
    expect(() => client.failPending('worker error')).not.toThrow();
  });
});

describe('nothing ever rejects', () => {
  it('answers a worker that is not available with a fixed error, posting nothing', async () => {
    const { client, posts } = makeClient({ available: false });
    const outcome: CityOutcome = await client.load(buffer(), 3, null);
    expect(outcome).toEqual({ kind: 'error', loadId: 1, detail: 'worker unavailable' });
    expect(posts).toHaveLength(0);
    expect(client.pendingCount).toBe(0);
  });

  it('answers a post that throws with a fixed error that does not echo the thrown text', async () => {
    const { client } = makeClient({ throws: true });
    const outcome = await client.load(buffer(), 3, null);
    expect(outcome).toEqual({ kind: 'error', loadId: 1, detail: 'post failed' });
    expect(JSON.stringify(outcome)).not.toContain('private');
    expect(client.pendingCount).toBe(0);
  });

  it('a refused load still consumes its id, so a late reply cannot be matched to it', async () => {
    const { client } = makeClient({ throws: true });
    await client.load(buffer(), 3, null);
    expect(client.lastLoadId).toBe(1);
    expect(() =>
      client.handle({ type: 'city-result', loadId: 1, importedAt: 'T', view: VIEW }),
    ).not.toThrow();
  });
});
