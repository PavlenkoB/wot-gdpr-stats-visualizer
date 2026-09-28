import type {
  ClassifyResult,
  IngestRequest,
  IngestResponse,
  IngestStage,
  WorkerLike,
} from './types/worker-messages.ts';
import { precheckFiles } from './precheck.ts';
import { GENERIC_FAILURE_MESSAGE } from './ui-copy.ts';

export type IngestViewState = 'idle' | 'processing' | 'done' | 'error';

/**
 * Minimum visible-processing window, in milliseconds. The worker may
 * return its terminal outcome in well under this — for instance a
 * synthetic sample classifies in a few milliseconds — but the UI must
 * show the spinner + per-stage text for at least this long so the
 * feedback reads as deliberate, not glitchy (D-10, FA-01-05-1).
 *
 * The window sits inside D-10's 300–500 ms band; tests assert the
 * floor for the success, worker-error, and worker-event branches.
 *
 * Set to 0 to opt out (used by 01-04's pre-existing tests, which need
 * to observe immediate state transitions without fake-timer juggling).
 */
export const MIN_PROCESSING_MS = 400;

/**
 * Per-instance overrides for the constructor. Today only the floor is
 * overridable — kept minimal so future opts do not silently appear in
 * the public surface.
 */
export interface IngestClientOptions {
  minProcessingMs?: number;
}

/**
 * Single long-lived main-thread view of the ingest worker.
 *
 * Responsibilities:
 *   1. Run a quick, console-only pre-check on every submission (count,
 *      extension, size) before anything is posted. A pre-check failure
 *      goes through the same `#fail` path as a worker-side error, so
 *      the on-screen banner is identical (D-07, Pitfall 2).
 *   2. Hold one Worker for the lifetime of the page. We never respawn
 *      it: a respawn would trigger a second post-load script fetch,
 *      which violates PLATFORM-02. A worker that errors BEFORE
 *      reporting 'ready' is therefore marked #workerBroken, and any
 *      later submission fails fast without ever posting.
 *   3. Treat `onerror` (script error) and `onmessageerror`
 *      (deserialization error) as fatal-for-this-job: each routes to
 *      `#fail` so a crash mid-processing cannot leave the UI stuck
 *      in 'processing'.
 *   4. Ignore messages whose jobId does not match the in-flight one.
 *      The IngestClient only ever runs one job at a time, so any
 *      other jobId is either a stale echo from before the current
 *      submission or a forged one (the worker is the only sender).
 *   5. Apply a minimum-visible-processing floor. Terminal outcomes
 *      (`done`, worker `error`, `onerror`, `onmessageerror`) that
 *      arrive before MIN_PROCESSING_MS have elapsed since submission
 *      are settled via `setTimeout(remaining)`. While the timer is
 *      pending the state stays 'processing' (busy stays true) so the
 *      dropzone stays disabled and the spinner stays visible (D-10).
 *   6. Refuse a new submission while results are shown (state 'done')
 *      until the caller invokes `reset()`. The refuse is a no-op
 *      console.error, never an error banner (D-13, D-14).
 *
 * The `#fail` method is the single failure path. Pre-check rejection,
 * broken worker, worker error event, deserialization error, and worker
 * error message all route through it. It logs the specific cause to
 * console.error (D-05) and sets state/errorMessage to the generic D-04
 * copy. Settling-path failures use a private `#settleFail` helper that
 * routes the same way once the floor has elapsed.
 *
 * Note on the `$state(...)` rune: under Svelte's compiler this is
 * rewritten into a reactive backing store. In the unit test runner
 * (see tests/unit/setup.ts) the rune is shimmed to a passthrough,
 * which is sufficient because the unit tests observe state through
 * plain field reads and never depend on reactivity.
 */
export class IngestClient {
  state = $state<IngestViewState>('idle');
  stage = $state<IngestStage | null>(null);
  result = $state<ClassifyResult | null>(null);
  errorMessage = $state<string | null>(null);
  workerReady = $state(false);

  #worker: WorkerLike;
  #jobId = 0;
  #workerBroken = false;
  #submittedAt: number | null = null;
  #settleTimer: ReturnType<typeof setTimeout> | null = null;
  #minProcessingMs: number;

  constructor(createWorker: () => WorkerLike, options: IngestClientOptions = {}) {
    this.#worker = createWorker();
    this.#minProcessingMs = options.minProcessingMs ?? MIN_PROCESSING_MS;
    this.#worker.onmessage = (event) => this.#handle(event.data);
    this.#worker.onerror = (event) => {
      // Distinct console line for a worker error event (vs. an error
      // message routed through #fail, which already logs under
      // '[ingest] import failed:'). D-05: the cause is local-only.
      console.error('[ingest] worker error:', event.message || 'unknown');
      if (this.state === 'processing') {
        this.#scheduleSettle(() => this.#fail(`worker error: ${event.message || 'unknown'}`));
      } else if (!this.workerReady) {
        // The worker died before it ever signalled ready. Mark the
        // client as broken so later submissions fail fast without
        // posting to a dead worker (and without triggering a respawn
        // script fetch that PLATFORM-02 forbids).
        this.#workerBroken = true;
        this.#fail('worker-not-ready');
      }
      // If we're idle AND ready, the error is informational only —
      // nothing in flight, nothing to fail.
    };
    this.#worker.onmessageerror = () => {
      if (this.state === 'processing') {
        this.#scheduleSettle(() => this.#fail('worker message could not be deserialized'));
      }
    };
  }

  get busy(): boolean {
    return this.state === 'processing';
  }

  /**
   * Reset the view back to idle. No confirmation (D-14). The 'done'
   * view must be cleared explicitly — `submitFiles` does NOT auto-
   * clear it (D-13: a file dropped on the results view is ignored).
   *
   * Returns true on a successful reset (was 'done' or 'error' or
   * 'idle'), false if a job is in flight (D-14: do not interrupt a
   * job, the user must wait for it to finish before resetting).
   */
  reset(): boolean {
    if (this.state === 'processing') return false;
    this.#clearSettleTimer();
    this.state = 'idle';
    this.stage = null;
    this.result = null;
    this.errorMessage = null;
    this.#submittedAt = null;
    return true;
  }

  submitFiles(files: ArrayLike<File>): boolean {
    // 1. The busy guard. A second submission while a job is in flight
    //    is a silent no-op — the user's drag/click is treated as a
    //    duplicate, not an error, so the banner doesn't flicker.
    if (this.busy) {
      console.error('[ingest] busy, submission ignored');
      return false;
    }

    // 2. The done-state guard. While results are shown, the only way
    //    to start a new import is "Start over" -> reset(). A file
    //    dropped on the results view is a silent no-op (D-13).
    if (this.state === 'done') {
      console.error('[ingest] results shown, drop ignored');
      return false;
    }

    // 3. The pre-check. UI-affordance rejections never reach the
    //    worker — the cause is logged for the developer (D-05) and
    //    the on-screen banner is the same generic D-04 copy as every
    //    other failure source. The pre-check is immediate — D-06 says
    //    nothing auto-dismisses, and there is no spinner to keep up.
    const failure = precheckFiles(files);
    if (failure !== null) {
      this.#fail(`pre-check rejected: ${failure.cause}`);
      return false;
    }

    // 4. The broken-worker / not-yet-ready fail-fast. A worker that
    //    errored before it ever reported ready is permanently
    //    unavailable for the session; the owner recovers by
    //    reloading the page (FA-01-04-3). We do NOT respawn: a
    //    respawn would fetch a second worker script, which violates
    //    PLATFORM-02.
    //
    //    The simpler case — `!workerReady` because 'ready' has not
    //    arrived yet — is also a fail-fast: posting to an unready
    //    worker risks a race where the worker hasn't installed its
    //    onmessage handler, dropping the message.
    if (this.#workerBroken || !this.workerReady) {
      this.#fail('worker-not-ready');
      return false;
    }

    const file = files[0]!;
    this.#jobId += 1;
    const jobId = this.#jobId;

    this.state = 'processing';
    this.stage = 'unzipping';
    this.result = null;
    this.errorMessage = null;
    this.#submittedAt = Date.now();

    const message: IngestRequest = { type: 'ingest', jobId, file };
    this.#worker.postMessage(message);
    return true;
  }

  #handle(msg: IngestResponse): void {
    if (msg.type === 'ready') {
      this.workerReady = true;
      return;
    }

    if (msg.type === 'stage') {
      // While we are settling (terminal outcome already received,
      // floor not yet elapsed) we are deliberately ignoring stage
      // updates — the user has already been told the outcome is
      // coming, no spinner churn.
      if (this.state !== 'processing') return;
      if (msg.jobId !== this.#jobId) return;
      this.stage = msg.stage;
      return;
    }

    if (msg.type === 'done') {
      if (this.state !== 'processing') return;
      if (msg.jobId !== this.#jobId) return;
      const captured = msg.result;
      this.#scheduleSettle(() => {
        this.state = 'done';
        this.stage = null;
        this.result = captured;
        this.errorMessage = null;
      });
      return;
    }

    if (msg.type === 'error') {
      if (this.state !== 'processing') return;
      if (msg.jobId !== this.#jobId) return;
      // The worker posts a structured detail string. Log it
      // verbatim — the on-screen banner is still the D-04 copy.
      this.#scheduleSettle(() => this.#fail(msg.detail));
      return;
    }
  }

  /**
   * The ONE failure path. Called for every failure source: pre-check
   * rejection, broken worker, settling path worker error event,
   * settling path deserialization error, and settling path worker
   * error message. It schedules no timer (D-06: nothing auto-
   * dismisses the banner).
   *
   * Note: when this is called from a settling callback, state is
   * 'processing' at the moment of the call (the settle callback runs
   * exactly when the floor elapses). The transition to 'error' is
   * what the user finally sees.
   */
  #fail(detail: string): void {
    console.error('[ingest] import failed:', detail);
    this.state = 'error';
    this.stage = null;
    this.result = null;
    this.errorMessage = GENERIC_FAILURE_MESSAGE;
  }

  /**
   * Schedule a terminal-state transition to fire once the visible-
   * processing floor has elapsed. While waiting, state stays
   * 'processing' (so the dropzone stays disabled and the spinner
   * stays visible), and any further terminal events for the same
   * jobId become no-ops. If a settle is already pending, a second
   * one is a no-op (the first wins).
   *
   * The floor gates when the transition is applied, not whether it
   * ever happens: if `Date.now() - submittedAt >= floor`, the apply
   * runs SYNCHRONOUSLY (no setTimeout queued). This is the fast path
   * for a worker that took longer than MIN_PROCESSING_MS to answer —
   * the spinner is already gone from the user's perspective, so the
   * apply should be visible right now, not behind an async tick.
   *
   * When the floor is 0 (opt-out) the apply also runs synchronously,
   * for the same reason: there is no spinner to keep up.
   */
  #scheduleSettle(apply: () => void): void {
    if (this.#settleTimer !== null) return;
    const submittedAt = this.#submittedAt;
    const floor = this.#minProcessingMs;
    let delay = 0;
    if (floor > 0 && submittedAt !== null) {
      const elapsed = Date.now() - submittedAt;
      delay = Math.max(0, floor - elapsed);
    }
    if (delay <= 0) {
      apply();
      return;
    }
    this.#settleTimer = setTimeout(() => {
      this.#settleTimer = null;
      apply();
    }, delay);
  }

  #clearSettleTimer(): void {
    if (this.#settleTimer !== null) {
      clearTimeout(this.#settleTimer);
      this.#settleTimer = null;
    }
  }
}
