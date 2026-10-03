import type {
  DataQuery,
  DataResult,
  IngestRequest,
  IngestResponse,
} from './types/worker-messages.ts';

// =============================================================================
// query-client.ts — the main-thread side of a Phase 5 block's question (05-07)
// =============================================================================

/** The two worker replies a `data-query` can produce. */
export type DataResponse = Extract<IngestResponse, { type: 'data-result' | 'data-error' }>;

/** The `DataResult` a given channel's answer carries. */
export type ResultOf<C extends DataQuery['channel']> = Extract<DataResult, { channel: C }>;

/**
 * What one query resolved to.
 *
 * The three settlements mirror `PlaytimeOutcome` exactly, and the reasons they
 * exist are the same: a block must be able to RENDER a failure, so `error` is a
 * discriminated member rather than a rejected promise. Nothing here ever
 * rejects, so a chart can never take the page down by throwing inside a render.
 *
 * `superseded` is not an error. It means this block asked a NEWER question of
 * the same channel and this one is no longer the one being waited on (D-03's
 * latest-wins rule, kept from Phase 4). The component receiving it has newer
 * numbers on the way.
 */
export type DataOutcome<C extends DataQuery['channel'] = DataQuery['channel']> =
  | { kind: 'result'; queryId: number; importedAt: string | null; result: ResultOf<C> | null }
  | { kind: 'error'; queryId: number; detail: string }
  | { kind: 'superseded'; queryId: number };

/** Posts one message to the worker. Injected so this class holds no Worker. */
export type DataPost = (message: IngestRequest) => void;

/**
 * Whether the worker can still be reached. Injected because only the owner of
 * the Worker knows: one that died before its `ready` handshake will never
 * answer (T-04-14). Defaults to available.
 */
export type DataAvailability = () => boolean;

/** One pending question: the channel it asked about, and who is waiting. */
interface Pending {
  readonly channel: DataQuery['channel'];
  // Deliberately untyped in the channel dimension: a resolver is a
  // `DataOutcome<SomeChannel>`, and the class stores the union of every
  // channel's resolver because it cannot know which one at construction time.
  // The channel check in `handle` is what keeps a result from reaching the
  // wrong caller, and the assertion below is where that check is paid for.
  readonly resolve: (outcome: DataOutcome) => void;
}

/**
 * The main-thread side of the four Phase 5 blocks.
 *
 * ## Why this exists BESIDE `PlaytimeClient`, which is left untouched
 *
 * `PlaytimeClient` supersedes EVERY pending query when a new one is issued.
 * That is correct for its single caller: one chart, one selector, where a user
 * dragging the control genuinely wants only the newest answer. This phase has
 * FOUR blocks, each asking on mount (RESEARCH Pitfall 1). Reused as it stands,
 * three blocks mounting in the same tick would supersede each other, the
 * superseded outcomes would be dropped as not-applicable, and two blocks would
 * sit in `loading` forever — no error, no timeout, just a block that never
 * resolves. The warning sign is a block stuck in `loading` only while another
 * block is on screen.
 *
 * So the rule here is narrower and the counter is deliberately NOT narrowed:
 * supersede is PER CHANNEL, so a block asking again releases only its OWN older
 * question, while the `queryId` counter stays shared across channels so a reply
 * can be routed by id alone with no channel on the wire. `PlaytimeClient` keeps
 * its global rule because its own tests assert it and its one caller wants it.
 *
 * ## Why there is no rune here
 *
 * The resolver map is bookkeeping, not rendered state. A block holds the
 * resolved outcome in its own reactive field, so a query issued while the
 * section is unmounted costs nothing and leaves nothing behind. The counterpart
 * of that rule is that a late reply for a query nobody awaits is dropped on the
 * floor — see `handle`.
 */
export class QueryClient {
  #post: DataPost;
  #isAvailable: DataAvailability;
  #queryId = 0;
  #pending = new Map<number, Pending>();

  constructor(post: DataPost, isAvailable: DataAvailability = () => true) {
    this.#post = post;
    this.#isAvailable = isAvailable;
  }

  /**
   * How many queries are waiting for a reply. The one invariant that matters
   * to a block: a query must never sit in here forever.
   */
  get pendingCount(): number {
    return this.#pending.size;
  }

  /**
   * Ask the worker one question.
   *
   * Three rules, in this order, and the order is load-bearing:
   *
   * 1. The id is consumed FIRST and unconditionally, so uniqueness never
   *    depends on the query reaching the worker. A refused query still burns
   *    its id, which is what makes a late reply for it unmatchable rather than
   *    matchable to a later, different question.
   * 2. Then this channel's older pending queries are released as superseded.
   *    On ISSUE, not on reply, for the same reason Phase 4 did it there: a
   *    component awaiting the older promise is freed even if the worker never
   *    answers it, and the late reply then finds an unknown id and is dropped.
   * 3. Only then the two fast-fail paths, which resolve with FIXED details
   *    instead of rejecting or posting.
   */
  query<C extends DataQuery['channel']>(query: Extract<DataQuery, { channel: C }>) {
    this.#queryId += 1;
    const queryId = this.#queryId;

    this.#supersedeChannel(query.channel);

    if (!this.#isAvailable()) {
      return Promise.resolve<DataOutcome<C>>({
        kind: 'error',
        queryId,
        detail: 'worker unavailable',
      });
    }

    return new Promise<DataOutcome<C>>((resolve) => {
      this.#pending.set(queryId, {
        channel: query.channel,
        resolve: resolve as (outcome: DataOutcome) => void,
      });
      try {
        this.#post({ type: 'data-query', queryId, query });
      } catch {
        // The thrown value is deliberately NOT read: it can carry a path or an
        // internal name (Phase 3 D-21). The console keeps the real cause; the
        // UI only learns the numbers could not be worked out.
        this.#pending.delete(queryId);
        resolve({ kind: 'error', queryId, detail: 'post failed' });
      }
    });
  }

  /** Release every pending query OF ONE CHANNEL as superseded — see `query`. */
  #supersedeChannel(channel: DataQuery['channel']): void {
    for (const [queryId, pending] of this.#pending) {
      if (pending.channel !== channel) continue;
      this.#pending.delete(queryId);
      pending.resolve({ kind: 'superseded', queryId });
    }
  }

  /**
   * Release every pending query as an ERROR carrying `detail`.
   *
   * The worker died (an `onerror` / `onmessageerror`) or will never answer, so
   * a promise left outstanding is a spinner that never stops. `detail` is a
   * FIXED string chosen by the caller, never an event's `message`, which can
   * carry a file path.
   *
   * Safe with nothing pending and safe twice: the first call empties the map,
   * so the second is a no-op.
   */
  failPending(detail: string): void {
    for (const [queryId, pending] of this.#pending) {
      this.#pending.delete(queryId);
      pending.resolve({ kind: 'error', queryId, detail });
    }
  }

  /**
   * Route one worker reply to the query that asked for it.
   *
   * An unknown `queryId` returns without doing anything: a late reply for a
   * query whose block was unmounted, or one a newer question superseded, is not
   * an error condition and must not throw. Every OTHER message type is ignored
   * too, which is what lets `IngestClient.#handle` delegate blindly.
   *
   * ## Why a wrong channel is an error and not a result
   *
   * A reply whose channel is not the one this id asked about cannot be applied.
   * Handing a `spend` view to the block that asked for `premium` would paint
   * one section's numbers under another's heading — the same class of tear the
   * importedAt pairing defends against, reached by a different route. It is
   * therefore settled as an error with a FIXED detail, so the block renders its
   * error state instead of someone else's numbers.
   */
  handle(msg: DataResponse): void {
    const pending = this.#pending.get(msg.queryId);
    if (pending === undefined) return;
    this.#pending.delete(msg.queryId);

    if (msg.type === 'data-error') {
      pending.resolve({ kind: 'error', queryId: msg.queryId, detail: msg.detail });
      return;
    }

    if (msg.result !== null && msg.result.channel !== pending.channel) {
      pending.resolve({ kind: 'error', queryId: msg.queryId, detail: 'channel mismatch' });
      return;
    }

    pending.resolve({
      kind: 'result',
      queryId: msg.queryId,
      importedAt: msg.importedAt,
      // A null result is a legitimate answer (nothing imported), and the
      // channel cannot be read off it, so the caller's own channel is what
      // types the outcome.
      result: msg.result as ResultOf<typeof pending.channel> | null,
    });
  }
}
