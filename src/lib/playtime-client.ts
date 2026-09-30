import type { IngestResponse, IngestRequest, PlaytimeView } from './types/worker-messages.ts';

/** The two worker replies a `playtime-query` can produce. */
export type PlaytimeResponse = Extract<
  IngestResponse,
  { type: 'playtime-result' | 'playtime-error' }
>;

/**
 * What one query resolved to.
 *
 * `error` is a discriminated member rather than a rejected promise: a query
 * that cannot be answered (a dataset with no stored aggregate, a read failure)
 * is a state the UI has to render, not an exception. Nothing here ever
 * rejects, so a chart cannot take the page down by throwing inside a render.
 *
 * `superseded` is the THIRD settlement, and the one that keeps the UI-SPEC
 * `updating` state honest (D-03, T-04-13). A user dragging the split selector
 * issues a second query while the first is usually still in flight. The first
 * is released the moment the second is issued, so a component awaiting it is
 * never left holding a promise that belongs to a question it has stopped
 * asking. It is NOT an error: nothing failed, and the component that receives
 * it has newer numbers on the way.
 */
export type PlaytimeOutcome =
  | { kind: 'result'; queryId: number; importedAt: string | null; view: PlaytimeView | null }
  | { kind: 'error'; queryId: number; detail: string }
  | { kind: 'superseded'; queryId: number };

/** Posts one message to the worker. Injected so this class holds no Worker. */
export type PlaytimePost = (message: IngestRequest) => void;

/**
 * Whether the worker can still be reached. Injected because only the owner of
 * the Worker knows: a worker that died before its `ready` handshake will never
 * answer anything (T-04-14). Defaults to available, which is the 04-01
 * behaviour this class shipped with.
 */
export type PlaytimeAvailability = () => boolean;

/**
 * The main-thread side of the playtime query (D-06).
 *
 * ## Why this is a separate class from `IngestClient`
 *
 * The import flow owns a state machine keyed on its own `jobId`: `stage`,
 * `done`, `duplicate`, `cache-status` and `cleared` all move it. A chart
 * asking for numbers is none of those things — no import is running, no
 * spinner should appear, and a slow chart must never leave the dropzone
 * looking busy. So the playtime replies get their OWN id namespace
 * (`queryId`), their own resolver map, and a single delegation point at the
 * top of the ingest client's message handler, before any state-machine branch
 * can see them.
 *
 * ## Why there is no rune here
 *
 * This file is deliberately free of `$state` and of every Svelte import: the
 * resolver map is bookkeeping, not rendered state. A chart holds the
 * resolved `PlaytimeOutcome` in its own reactive field, so a query that
 * arrives while the section is unmounted costs nothing and leaves nothing
 * behind. The counterpart of that rule is that a late reply for a query
 * nobody awaits is dropped on the floor — see `handle`.
 */
export class PlaytimeClient {
  #post: PlaytimePost;
  #isAvailable: PlaytimeAvailability;
  #queryId = 0;
  #pending = new Map<number, (outcome: PlaytimeOutcome) => void>();

  constructor(post: PlaytimePost, isAvailable: PlaytimeAvailability = () => true) {
    this.#post = post;
    this.#isAvailable = isAvailable;
  }

  /**
   * How many queries are waiting for a reply. Read-only bookkeeping for
   * tests and for the one invariant that matters to a component: a query
   * must never sit in here forever.
   */
  get pendingCount(): number {
    return this.#pending.size;
  }

  /**
   * Release every pending query as an ERROR outcome carrying `detail`.
   *
   * The worker has died (an `onerror` / `onmessageerror` event) or will
   * never answer, so a promise left outstanding is a spinner that never
   * stops. This is the plan's T-04-14 mitigation and the reason nothing in
   * this class ever rejects: a failed query is a state the UI renders, not
   * an exception.
   *
   * `detail` is a FIXED string chosen by the caller, never an error
   * event's `message`: an uncaught worker error can carry a file path, and
   * Phase 3 D-21 keeps such text off the screen and out of the outcome.
   *
   * Safe to call with nothing pending, and safe to call twice: the map is
   * emptied by the first call, so the second is a no-op.
   */
  failPending(detail: string): void {
    for (const [queryId, resolve] of this.#pending) {
      resolve({ kind: 'error', queryId, detail });
    }
    this.#pending.clear();
  }

  /**
   * Ask the worker for one slice's numbers. `valueIndex` is null for the All
   * chart and otherwise an index into the stored split.
   *
   * The returned promise is kept in a map keyed by its own id, so two charts
   * asking at once cannot settle each other and a reply that arrives out of
   * order is still matched to the right caller.
   *
   * ## Latest request wins (D-03, T-04-13)
   *
   * Issuing a query SUPERSEDES every older pending one. The supersede happens
   * here, on issue, rather than when a reply arrives, for two reasons: a
   * component awaiting the older promise is released even if the worker never
   * answers it, and a late reply for the older id then finds an UNKNOWN id
   * and is dropped by `handle` — so a stale answer can never overwrite a
   * newer one, and it cannot even reach the component.
   *
   * ## Nothing here can hang or throw
   *
   * Both fast-fail paths resolve with a FIXED detail instead of rejecting or
   * posting: an unavailable worker (the probe) and a post that throws (a
   * structured-clone failure, say). The id counter is advanced before either
   * check, so a refused query still consumes its id and a late reply can
   * never be matched to it.
   */
  query(valueIndex: number | null): Promise<PlaytimeOutcome> {
    this.#queryId += 1;
    const queryId = this.#queryId;

    // The id is consumed first, unconditionally: uniqueness must not depend
    // on the query actually reaching the worker.
    this.#supersedePending();

    if (!this.#isAvailable()) {
      return Promise.resolve({ kind: 'error', queryId, detail: 'worker unavailable' });
    }

    return new Promise<PlaytimeOutcome>((resolve) => {
      this.#pending.set(queryId, resolve);
      try {
        this.#post({ type: 'playtime-query', queryId, valueIndex });
      } catch {
        // The thrown value is deliberately NOT read: it can carry a path or
        // an internal name, and the outcome is local bookkeeping (D-21).
        // The console keeps the real cause; the UI only learns that the
        // numbers could not be worked out.
        this.#pending.delete(queryId);
        resolve({ kind: 'error', queryId, detail: 'post failed' });
      }
    });
  }

  /** Release every pending query as superseded — see `query`. */
  #supersedePending(): void {
    for (const [queryId, resolve] of this.#pending) {
      resolve({ kind: 'superseded', queryId });
    }
    this.#pending.clear();
  }

  /**
   * Route one worker reply to the query that asked for it.
   *
   * An unknown `queryId` is ignored and returns undefined: a late reply for a
   * query whose section was unmounted, or one the page already replaced, is
   * not an error condition and must not throw. Every OTHER message type is
   * ignored too, which is what lets `IngestClient.#handle` delegate blindly.
   */
  handle(msg: PlaytimeResponse): void {
    const resolve = this.#pending.get(msg.queryId);
    if (resolve === undefined) return;
    this.#pending.delete(msg.queryId);
    resolve(
      msg.type === 'playtime-error'
        ? { kind: 'error', queryId: msg.queryId, detail: msg.detail }
        : {
            kind: 'result',
            queryId: msg.queryId,
            importedAt: msg.importedAt,
            view: msg.view,
          },
    );
  }
}
