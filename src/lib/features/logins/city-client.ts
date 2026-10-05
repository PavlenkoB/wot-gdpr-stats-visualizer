import type { IngestRequest, IngestResponse } from '../../core/types/worker-messages.ts';
import type { CityView } from './city-shared.ts';

/** The two worker replies a `city-load` can produce. */
export type CityResponse = Extract<IngestResponse, { type: 'city-result' | 'city-error' }>;

/**
 * What one city load resolved to.
 *
 * The same three settlements the playtime bridge uses, for the same reason: a
 * failure is a state the screen renders, not an exception that can take a
 * render down, and a load a newer one replaced is released at once rather than
 * left pending on a question nobody is asking any more.
 *
 * `result.view` is null when the worker holds no dataset (`importedAt` is then
 * null too). `error.detail` is ALWAYS a fixed string this file or the worker
 * chose: these bytes came off a network, and a message assembled from them is
 * text a hostile file picked (T-06-50).
 */
export type CityOutcome =
  | { kind: 'result'; loadId: number; importedAt: string | null; view: CityView | null }
  | { kind: 'error'; loadId: number; detail: string }
  | { kind: 'superseded'; loadId: number };

/**
 * Posts one message to the worker, with the transfer list the buffer rides in.
 * Injected so this class holds no Worker.
 */
export type CityPost = (message: IngestRequest, transfer: Transferable[]) => void;

/** Whether the worker can still be reached; injected for the same reason. */
export type CityAvailability = () => boolean;

/**
 * The main-thread side of the opt-in city decode (06-13, D-14, D-15).
 *
 * ## Why this is its own class, with its own id namespace
 *
 * A city load is a DECODE of bytes the user asked for, not a question about a
 * dataset, so it must neither move the import state machine nor supersede (or
 * be superseded by) a query channel. `loadId` is its own counter, its replies
 * are routed to {@link CityClient.handle} from the FIRST branch of
 * `IngestClient`'s message handler, and nothing in here ever rejects.
 *
 * ## Why there is no rune
 *
 * The resolver map is bookkeeping, not rendered state. The component holds the
 * resolved view in its own cell, stamped with the `importedAt` it describes.
 */
export class CityClient {
  #post: CityPost;
  #isAvailable: CityAvailability;
  #loadId = 0;
  #pending = new Map<number, (outcome: CityOutcome) => void>();

  constructor(post: CityPost, isAvailable: CityAvailability = () => true) {
    this.#post = post;
    this.#isAvailable = isAvailable;
  }

  /** How many loads are waiting for a reply. */
  get pendingCount(): number {
    return this.#pending.size;
  }

  /**
   * The id of the load most recently issued, or 0 before the first.
   *
   * Read right after `load()` returns, so the caller can name the load it is
   * about to await: `acceptCityOutcome` drops a reply that is not for it.
   */
  get lastLoadId(): number {
    return this.#loadId;
  }

  /**
   * Release every pending load as an ERROR carrying `detail`.
   *
   * The worker died, or will never answer, and a load left pending is a
   * progress bar that never ends. `detail` is chosen by the caller and is never
   * an event's `message`, which can carry a file path (D-21).
   */
  failPending(detail: string): void {
    for (const [loadId, resolve] of this.#pending) {
      resolve({ kind: 'error', loadId, detail });
    }
    this.#pending.clear();
  }

  /**
   * Hand the downloaded bytes to the worker.
   *
   * The buffer is TRANSFERRED, not copied: an 11.8 MB `ArrayBuffer` copied
   * across `postMessage` is 11.8 MB of allocation and a stall for a move that
   * costs nothing. It is therefore DETACHED on return, and the caller must not
   * read it again.
   *
   * Issuing a load supersedes every older pending one on issue, so a late reply
   * for the older id finds an unknown id and is dropped by `handle`. The id is
   * consumed before either fast-fail path, so a refused load still advances the
   * counter and a late reply can never be matched to it.
   */
  load(buffer: ArrayBuffer, expectedBytes: number, sha256: string | null): Promise<CityOutcome> {
    this.#loadId += 1;
    const loadId = this.#loadId;
    this.#supersedePending();

    if (!this.#isAvailable()) {
      return Promise.resolve({ kind: 'error', loadId, detail: 'worker unavailable' });
    }

    return new Promise<CityOutcome>((resolve) => {
      this.#pending.set(loadId, resolve);
      try {
        this.#post({ type: 'city-load', loadId, buffer, expectedBytes, sha256 }, [buffer]);
      } catch {
        // The thrown value is deliberately not read: it can carry an internal
        // name, and the outcome is local bookkeeping.
        this.#pending.delete(loadId);
        resolve({ kind: 'error', loadId, detail: 'post failed' });
      }
    });
  }

  #supersedePending(): void {
    for (const [loadId, resolve] of this.#pending) {
      resolve({ kind: 'superseded', loadId });
    }
    this.#pending.clear();
  }

  /**
   * Route one worker reply to the load that asked for it. An unknown `loadId`
   * is ignored: a late reply for a superseded load, or one the page already
   * replaced, is not an error and must not throw.
   */
  handle(msg: CityResponse): void {
    const resolve = this.#pending.get(msg.loadId);
    if (resolve === undefined) return;
    this.#pending.delete(msg.loadId);
    resolve(
      msg.type === 'city-error'
        ? { kind: 'error', loadId: msg.loadId, detail: msg.detail }
        : { kind: 'result', loadId: msg.loadId, importedAt: msg.importedAt, view: msg.view },
    );
  }
}
