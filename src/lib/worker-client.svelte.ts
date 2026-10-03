import type {
  ClassifyResult,
  IngestRequest,
  IngestResponse,
  IngestStage,
  ParsingProgress,
  WorkerLike,
} from './types/worker-messages.ts';
import { precheckFiles } from './precheck.ts';
import { GENERIC_FAILURE_MESSAGE } from './ui-copy.ts';
import { PlaytimeClient } from './playtime-client.ts';
import { QueryClient } from './query-client.ts';

export type IngestViewState =
  'checking-cache' | 'idle' | 'processing' | 'done' | 'error' | 'duplicate' | 'confirm-pending';

/**
 * The pending action carried while state === 'confirm-pending'. One
 * discriminated union, NOT three separate pending states — a single
 * kind discriminator lets App.svelte render one ConfirmPanel and
 * select the copy/labels via a `kind`-switch (D-22's "one shared
 * confirm component"). The `replace` kind carries the dropped File
 * because confirmPending() must post it as a normal 'ingest' message
 * after the user confirms (D-13).
 */
export type PendingAction =
  { kind: 'replace'; file: File } | { kind: 'start-over' } | { kind: 'clear-data' };

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
 *      which violates PLATFORM-02. Any worker error event therefore
 *      marks #workerBroken — before OR after 'ready' (WR-01) — and
 *      any later submission fails fast without ever posting.
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
 *   6. Route every drop made while a dataset is displayed through the
 *      replace confirmation (D-13). The user must confirm before the
 *      worker sees the bytes, because an unconfirmed drop would
 *      overwrite the cached dataset. See `submitFiles` for the guard
 *      order; the guard is keyed on `result !== null`, so it holds in
 *      'done', 'duplicate' and 'error' alike (D-27).
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
  state = $state<IngestViewState>('checking-cache');
  stage = $state<IngestStage | null>(null);
  parsingProgress = $state<ParsingProgress | null>(null);
  /**
   * The LAST KNOWN CACHED DATASET (D-27) — not "the outcome of the job
   * in flight". `done`, `duplicate` and `cache-status` assign it;
   * `reset()`, the `cleared` handler and a `cache-status` with
   * `cached: null` are the only things that null it.
   *
   * A replacement import therefore leaves the old dataset on screen
   * while it runs and after it fails. That matches storage: the worker
   * writes through a single atomic Dexie transaction, so a failed
   * replace leaves the previous rows and meta completely intact
   * (RESEARCH Q2 probed this), and re-reading the cache afterwards
   * would return exactly this object.
   *
   * App.svelte derives the whole view from these two fields: the
   * dashboard-versus-skeleton choice is `result !== null`, and the
   * notice shown is a function of `state` (D-26/D-27).
   */
  result = $state<ClassifyResult | null>(null);
  errorMessage = $state<string | null>(null);
  workerReady = $state(false);
  /**
   * The destructive confirm-pending payload (02-03-PLAN Task 2).
   * Populated when state transitions to 'confirm-pending' via any
   * of the three destructive entry points (replace-on-drop,
   * requestStartOver, requestClearData); cleared by either
   * confirmPending() (after a successful post) or cancelPending()
   * (after a user-canceled confirm).
   */
  pendingAction = $state<PendingAction | null>(null);
  /**
   * The state to restore when cancelPending() is called. Set
   * alongside every transition into 'confirm-pending' so a cancel
   * returns to the view that was active before the pending action
   * started — typically 'done' (replace, start-over) or 'idle'
   * (clear-data while on the empty dropzone).
   */
  #pendingReturnState: IngestViewState | null = null;
  /**
   * One-shot acknowledgment flag for D-20: set true on the 'cleared'
   * response (i.e. when a confirmed wipe completes), cleared by the
   * next submitFiles() or reset() call. NEVER cleared by a timer —
   * matching the project's "nothing auto-dismisses" contract (D-06).
   */
  justCleared = $state(false);

  /**
   * The playtime query bridge (D-06, 04-01 Task 2).
   *
   * A separate object with its own `queryId` namespace so a chart asking for
   * its numbers can never move this class's import state machine, however the
   * two message families interleave. The `post` closes over the SAME private
   * worker, so there is still exactly one Worker for the page — the sole-owner
   * rule db.ts depends on.
   */
  readonly playtime: PlaytimeClient;

  /**
   * The four Phase 5 blocks' query bridge (05-07).
   *
   * A second object, and NOT a second instance of the playtime bridge: the two
   * families differ in the one rule that matters. `PlaytimeClient` supersedes
   * every pending query when a new one is issued, which is right for its single
   * selector and wrong for four blocks that each ask on mount — three mounting
   * in one tick would starve each other and two would load forever (RESEARCH
   * Pitfall 1). `QueryClient` narrows supersede to the channel, so a block
   * asking again releases only its own older question.
   *
   * The `post` closes over the SAME private worker, so the page still has
   * exactly one Worker — the sole-owner rule db.ts depends on.
   */
  readonly data: QueryClient;

  #worker: WorkerLike;
  #jobId = 0;
  #workerBroken = false;
  #submittedAt: number | null = null;
  #settleTimer: ReturnType<typeof setTimeout> | null = null;
  #minProcessingMs: number;

  constructor(createWorker: () => WorkerLike, options: IngestClientOptions = {}) {
    this.#worker = createWorker();
    this.#minProcessingMs = options.minProcessingMs ?? MIN_PROCESSING_MS;
    this.playtime = new PlaytimeClient(
      (message) => this.#worker.postMessage(message),
      // 04-07: the broken-worker flag IS the availability signal. A worker
      // that died before its `ready` handshake will never answer a query, so
      // the chart must be told at once rather than wait on a reply that
      // cannot come (T-04-14). The arrow body defers the read, so field
      // initialisation order is not an issue. Deliberately NOT `!workerReady`
      // as well: before `ready` arrives the worker is merely unproven, and
      // 04-01's contract lets a query go out from the moment the page loads.
      () => !this.#workerBroken,
    );
    // 05-07: same post closure, and the SAME availability probe with the same
    // reasoning — the four Phase 5 blocks are charts of the same kind, so a
    // dead worker is the same signal for them and the `ready` flag is no more
    // of a gate here than it is for playtime.
    this.data = new QueryClient(
      (message) => this.#worker.postMessage(message),
      () => !this.#workerBroken,
    );
    this.#worker.onmessage = (event) => this.#handle(event.data);
    this.#worker.onerror = (event) => {
      // Distinct console line for a worker error event (vs. an error
      // message routed through #fail, which already logs under
      // '[ingest] import failed:'). D-05: the cause is local-only.
      console.error('[ingest] worker error:', event.message || 'unknown');
      // Phase 4 (04-07) won the merge against WR-01: an `onerror` while
      // idle and ready is NOT treated as a dead worker — a real Worker
      // can survive an error event and serve new traffic. The hang WR-01
      // was filed for ("submit-to-dead-worker hangs on the busy floor")
      // therefore depends on the worker actually being dead, which is
      // not the same as an `onerror` having fired. Two release paths run
      // here without marking the client permanently broken:
      //   (a) every outstanding playtime query is released with a FIXED
      //       detail — never `event.message`, which can carry a file
      //       path (D-21). A chart's `query()` promise would otherwise
      //       wait forever, because the worker that owed it a reply is
      //       gone for that specific request.
      //   (b) the state-machine branches below cover the cases that
      //       truly need action: processing -> settle to fail, pre-ready
      //       -> mark broken AND fail (this is the only path that sets
      //       #workerBroken; see also D-19/D-28). Idle+ready is the
      //       pre-04-07 nothing case, retained as an informational log.
      // WR-01's specific hang-on-submit guard is therefore only reached
      // for the pre-ready case; the post-ready case relies on the
      // worker's own postMessage behaviour. Reopen WR-01 if real-world
      // idle+ready errors ever leave the busy floor stranded.
      this.playtime.failPending('worker error');
      // 05-07: the four Phase 5 blocks are released by the same event for the
      // same reason, with the same FIXED detail. A chart's `query()` promise
      // would otherwise wait forever on a reply that cannot come.
      this.data.failPending('worker error');
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
    };
    this.#worker.onmessageerror = () => {
      // 04-07: same contract as the onerror branch above. A message that
      // could not be deserialized will never be answered, so every pending
      // query is released rather than left hanging.
      this.playtime.failPending('worker message could not be deserialized');
      // 05-07: same release for the four data channels, same fixed detail.
      this.data.failPending('worker message could not be deserialized');
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
   *
   * As of 02-03, reset() also clears `pendingAction` /
   * `#pendingReturnState` and resets `justCleared` (the one-shot
   * D-20 acknowledgment flag) — the next submitFiles() call must
   * never inherit a stale confirm or a sticky "Cached data cleared"
   * banner from a prior clear. Internal-only after 02-03: callers
   * use `requestStartOver`/`requestClearData` for the destructive
   * user-visible transitions.
   */
  reset(): boolean {
    if (this.state === 'processing') return false;
    this.#clearSettleTimer();
    this.state = 'idle';
    this.stage = null;
    this.parsingProgress = null;
    this.result = null;
    this.errorMessage = null;
    this.#submittedAt = null;
    this.pendingAction = null;
    this.#pendingReturnState = null;
    this.justCleared = false;
    return true;
  }

  /**
   * D-16: Start Over is now destructive (it wipes the cached dataset,
   * not just the view) — calling it routes through the shared
   * in-app ConfirmPanel instead of going straight to reset(). Stashes
   * a `start-over` pendingAction and transitions to 'confirm-pending';
   * the App.svelte's Start Over button is bound to this method, NOT
   * to reset(), so a single click on Start Over always shows the
   * confirm panel before any wipe happens.
   *
   * No-op outside the views that actually have a dataset to wipe —
   * calling requestStartOver() while already in 'confirm-pending' or
   * 'processing' would race the in-flight job. Calling it from
   * 'duplicate' (an informational banner over a real dataset) is
   * allowed because the underlying dataset is real.
   */
  requestStartOver(): void {
    if (this.state === 'confirm-pending' || this.state === 'processing') return;
    this.#pendingReturnState = this.state;
    this.pendingAction = { kind: 'start-over' };
    this.state = 'confirm-pending';
  }

  /**
   * D-17/D-18: the persistent "Clear my cached data" control calls
   * this. Mirrors requestStartOver() exactly — same confirm-pending
   * state, same single ConfirmPanel, same copy (D-22). The
   * persistent control is gated by App.svelte to only render when
   * state is 'done' or 'duplicate' (D-18/D-19), so this method is
   * only ever called from those states in practice; the defensive
   * guards below match requestStartOver's.
   */
  requestClearData(): void {
    if (this.state === 'confirm-pending' || this.state === 'processing') return;
    this.#pendingReturnState = this.state;
    this.pendingAction = { kind: 'clear-data' };
    this.state = 'confirm-pending';
  }

  /**
   * D-13/D-16/D-22: confirm the pending destructive action. Three
   * branches keyed by `pendingAction.kind`:
   *
   *   - 'replace': post the stashed file as a normal 'ingest'
   *     message and transition to 'processing' — same as if the
   *     user had dropped the file on an empty dropzone.
   *   - 'start-over' / 'clear-data': bump the jobId and post
   *     'clear-data' to the worker. State STAYS 'confirm-pending'
   *     until the worker's 'cleared' response arrives (handled in
   *     #handle, which transitions to 'idle' with justCleared=true).
   *
   * Returns true on success, false when called outside of
   * 'confirm-pending' (defensive guard — the confirm button is
   * only rendered in that state, but a stray click in another
   * branch must never silently post a destructive message).
   */
  confirmPending(): boolean {
    if (this.state !== 'confirm-pending') return false;
    const action = this.pendingAction;
    if (action === null) return false;

    if (action.kind === 'replace') {
      // Re-run the EXACT happy-path body of submitFiles() with the
      // stashed file. We bypass submitFiles()'s guards because the
      // user has already pre-checked the file via the original drop
      // (it ran precheckFiles() before it ever set pendingAction).
      // Bumping #jobId here is the same submitFiles does — every
      // jobId the worker sees must be unique.
      this.#jobId += 1;
      const jobId = this.#jobId;
      this.state = 'processing';
      this.stage = 'unzipping';
      // D-27: `result` deliberately survives the start of a
      // replacement. It is the last known CACHED dataset, not the
      // outcome of the job in flight, and the worker only overwrites
      // IndexedDB inside one atomic transaction — so until a 'done'
      // reply lands, the dataset on screen is still the dataset on
      // disk.
      this.errorMessage = null;
      this.#submittedAt = Date.now();
      const message: IngestRequest = { type: 'ingest', jobId, file: action.file };
      this.#worker.postMessage(message);
      this.pendingAction = null;
      this.#pendingReturnState = null;
      return true;
    }

    // 'start-over' and 'clear-data' both post 'clear-data' and wait
    // for the worker's 'cleared' before transitioning out of
    // 'confirm-pending' (D-15/D-17 + D-22's shared underlying action).
    this.#jobId += 1;
    const jobId = this.#jobId;
    this.#worker.postMessage({ type: 'clear-data', jobId } satisfies IngestRequest);
    this.#submittedAt = null;
    // pendingAction / #pendingReturnState stay populated until the
    // 'cleared' response arrives — the App.svelte ConfirmPanel keeps
    // showing until then.
    return true;
  }

  /**
   * Cancel a pending destructive action WITHOUT taking it. Returns
   * to the state the user was in before the pending action started
   * (`#pendingReturnState`, typically 'done' for replace/start-over
   * or whatever the prior state was). The one exception: a confirm
   * opened from 'duplicate' or 'error' returns to 'done' instead —
   * those are notices over a dataset, and restoring them would undo
   * the dismissal the user just asked for (D-06). pendingAction and
   * #pendingReturnState are cleared, and justCleared is also cleared
   * (a cancel must never inherit a prior clear's acknowledgment).
   *
   * Safe no-op when called outside 'confirm-pending' — the cancel
   * button is only rendered in that state, but a stray click from
   * another view must never silently mutate state.
   */
  cancelPending(): void {
    if (this.state !== 'confirm-pending') return;
    const returnState = this.#pendingReturnState ?? 'idle';
    this.state = returnState;
    // 'duplicate' and 'error' are NOTICES drawn over a dataset, not
    // views of their own. Since the replace guard widened (D-27) a
    // confirm can now be opened from either, and returning there would
    // resurface the banner the user just dismissed by cancelling. The
    // next user action replaces notices (D-06), so land on 'done' —
    // the dataset view the notice was sitting on — with it cleared.
    if (this.result !== null && (returnState === 'duplicate' || returnState === 'error')) {
      this.state = 'done';
      this.errorMessage = null;
    }
    this.pendingAction = null;
    this.#pendingReturnState = null;
    this.justCleared = false;
  }

  submitFiles(files: ArrayLike<File>): boolean {
    // 1. The busy guard. A second submission while a job is in flight
    //    is a silent no-op — the user's drag/click is treated as a
    //    duplicate, not an error, so the banner doesn't flicker.
    if (this.busy) {
      console.error('[ingest] busy, submission ignored');
      return false;
    }

    // 2. A drop while a confirm is already open. Exactly one confirm
    //    can be pending (D-22 shares a single panel), so a second drop
    //    has nowhere to go: accepting it would overwrite the stashed
    //    file, and letting it fall through would move the machine to
    //    'processing' with a stale pendingAction still on the client.
    //    Touch no state at all — not even justCleared, so a drop the
    //    user cannot act on cannot dismiss the D-20 acknowledgment.
    if (this.state === 'confirm-pending') {
      console.error('[ingest] confirm pending, submission ignored');
      return false;
    }

    // 2b. The dead-worker fail-fast (WR-01). `#workerBroken` is set by
    //     EVERY worker error event, including one that lands between
    //     submissions while the client is idle and ready. A dead
    //     worker cannot ingest anything, so the submission fails fast
    //     on the canonical 'worker-not-ready' copy (D-04/D-07: one
    //     failure path, one banner) instead of posting into a void and
    //     parking the UI on the busy floor forever.
    //
    //     Order matters. This runs AFTER guards 1 and 2 — a busy or
    //     confirm-pending drop is ignored regardless of worker state,
    //     and the user is not told their worker died for a drop they
    //     could not make anyway. It runs BEFORE the justCleared reset,
    //     the pre-check and the replace confirm: a submission that can
    //     never be ingested must not dismiss the D-20 acknowledgment,
    //     must not burn a pre-check, and must not open a confirm whose
    //     confirmPending() would post to the dead worker anyway.
    //     Guard 5 below is kept as the not-yet-ready half of the same
    //     check; the flag is never cleared, so this guard is the only
    //     one a broken worker can reach.
    if (this.#workerBroken) {
      this.#fail('worker-not-ready');
      return false;
    }

    // A new submission implicitly dismisses the one-shot "Cached
    // data cleared" acknowledgment (D-20) — the user is taking an
    // action, so the stale banner from a prior clear must not
    // follow them into the next view. Cleared here rather than via
    // a timer (D-06: nothing auto-dismisses).
    this.justCleared = false;

    // 3. The pre-check, BEFORE the replace guard. UI-affordance
    //    rejections never reach the worker — the cause is logged for
    //    the developer (D-05) and the on-screen banner is the same
    //    generic D-04 copy as every other failure source. The
    //    pre-check is immediate — D-06 says nothing auto-dismisses,
    //    and there is no spinner to keep up.
    //
    //    Order matters once the guard below is keyed on `result`: a
    //    notes.txt dropped on a displayed dataset would otherwise open
    //    a replace prompt for a file that can never be ingested, and
    //    the user would confirm their way to the very same failure.
    const failure = precheckFiles(files);
    if (failure !== null) {
      this.#fail(`pre-check rejected: ${failure.cause}`);
      return false;
    }

    // 4. The replace guard (D-13). While a dataset is displayed, a new
    //    import must be confirmed: an unconfirmed drop would overwrite
    //    the cached dataset. The file is stashed as a 'replace'
    //    pendingAction and nothing is posted until the user confirms.
    //
    //    The guard is keyed on `this.result !== null` — "a dataset is
    //    displayed" — rather than on `state === 'done'`. Since 03-03
    //    `result` outlives a failed or duplicated import (D-27), so
    //    the dataset is on screen in 'duplicate' and 'error' too, and a
    //    guard that only knew about 'done' let a drop in either state
    //    straight through to the worker.
    if (this.result !== null) {
      const file = files[0]!;
      this.#pendingReturnState = this.state;
      this.pendingAction = { kind: 'replace', file };
      // The next user action replaces notices (D-06): opening a
      // confirm is that action, so a stale failure banner does not sit
      // behind the panel waiting to reappear.
      this.errorMessage = null;
      this.state = 'confirm-pending';
      return false;
    }

    // 5. The broken-worker / not-yet-ready fail-fast. A worker that
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
    this.errorMessage = null;
    this.#submittedAt = Date.now();

    const message: IngestRequest = { type: 'ingest', jobId, file };
    this.#worker.postMessage(message);
    return true;
  }

  #handle(msg: IngestResponse): void {
    // D-06, and the FIRST branch on purpose. The playtime replies share this
    // channel with the import flow, so they are routed to the bridge and
    // returned before any state-machine branch runs. Nothing below this line
    // may ever see a playtime message, which is what keeps #jobId, `state` and
    // the settle timer untouched by a chart query (04-01 Task 2).
    if (msg.type === 'playtime-result' || msg.type === 'playtime-error') {
      this.playtime.handle(msg);
      return;
    }

    // 05-07, and the SECOND query branch on purpose, for the same reason the
    // playtime one is first: the data replies share this channel with the
    // import flow, so they are routed to their bridge and returned before any
    // state-machine branch runs. Nothing below this line may ever see a data
    // message, which is what keeps #jobId, `state` and the settle timer
    // untouched by a block's question.
    if (msg.type === 'data-result' || msg.type === 'data-error') {
      this.data.handle(msg);
      return;
    }

    if (msg.type === 'ready') {
      this.workerReady = true;
      // Auto-load-from-cache (D-07/D-08) piggybacks on the worker's
      // existing 'ready' handshake: bump the jobId, post one
      // 'check-cache' request, and the worker will respond with
      // either a populated `cache-status` (→ state 'done' with that
      // result) or `cached: null` (→ state 'idle', empty dropzone).
      // No separate constructor-side trigger — the ready handshake
      // is the one signal that proves the worker is alive (Pitfall 3).
      this.#jobId += 1;
      this.#worker.postMessage({
        type: 'check-cache',
        jobId: this.#jobId,
      } satisfies IngestRequest);
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
      // D-11: per-category parsing progress — the worker posts a
      // `progress` object alongside the 'parsing' stage. Capture it
      // so App.svelte can render "Parsing <Category> (i/n)..."
      // rather than the static STAGE_TEXT.parsing copy.
      this.parsingProgress = msg.progress ?? null;
      return;
    }

    if (msg.type === 'done') {
      if (this.state !== 'processing') return;
      if (msg.jobId !== this.#jobId) return;
      const captured = msg.result;
      this.#scheduleSettle(() => {
        this.state = 'done';
        this.stage = null;
        this.parsingProgress = null;
        this.result = captured;
        this.errorMessage = null;
      });
      return;
    }

    if (msg.type === 'duplicate') {
      if (this.state !== 'processing') return;
      if (msg.jobId !== this.#jobId) return;
      const captured = msg.result;
      this.#scheduleSettle(() => {
        this.state = 'duplicate';
        this.stage = null;
        this.parsingProgress = null;
        this.result = captured;
        this.errorMessage = null;
      });
      return;
    }

    if (msg.type === 'cache-status') {
      // Auto-load-from-cache result (D-07/D-08). Only transitions out
      // of 'checking-cache' — if a job is already in flight the
      // cache-status is stale and ignored.
      if (this.state !== 'checking-cache') return;
      if (msg.jobId !== this.#jobId) return;
      if (msg.cached !== null) {
        this.state = 'done';
        this.result = msg.cached;
        this.stage = null;
        this.parsingProgress = null;
        this.errorMessage = null;
      } else {
        this.state = 'idle';
        this.result = null;
        this.stage = null;
        this.parsingProgress = null;
      }
      return;
    }

    if (msg.type === 'error') {
      // The on-load cache check can fail now that the v2 upgrade can
      // (D-19): a blocked or failed upgrade is a storage problem, not a
      // bad export. Without this branch the `state !== 'processing'`
      // guard below swallowed it and the page sat on the spinner
      // forever. Recover to 'idle' — the skeleton with a full dropzone —
      // and keep the cause in the console (D-05). Deliberately NOT the
      // generic banner: that copy says "This doesn't look like a
      // Wargaming data export", which is simply false here.
      if (this.state === 'checking-cache') {
        if (msg.jobId !== this.#jobId) return;
        console.error('[ingest] cache check failed:', msg.detail);
        this.state = 'idle';
        this.result = null;
        this.stage = null;
        this.parsingProgress = null;
        this.errorMessage = null;
        return;
      }

      // A confirmed clear the worker could not perform. State stays
      // 'confirm-pending' until a 'cleared' reply arrives, so an error
      // here would otherwise leave the confirm panel open forever with
      // no way out. The clear runs in one atomic transaction, so the
      // dataset is intact and the failure is the ordinary error notice
      // shown OVER the dataset that is still really there (D-27).
      //
      // Only the two clear kinds reach this: a 'replace' pendingAction
      // has not been posted yet, so its #jobId still belongs to the
      // PREVIOUS job and a late error for that job must not be
      // mistaken for a reply to the un-posted replace.
      if (this.state === 'confirm-pending' && this.pendingAction?.kind !== 'replace') {
        if (msg.jobId !== this.#jobId) return;
        this.pendingAction = null;
        this.#pendingReturnState = null;
        this.#fail(msg.detail);
        return;
      }

      if (this.state !== 'processing') return;
      if (msg.jobId !== this.#jobId) return;
      // The worker posts a structured detail string. Log it
      // verbatim — the on-screen banner is still the D-04 copy.
      this.#scheduleSettle(() => this.#fail(msg.detail));
      return;
    }

    if (msg.type === 'cleared') {
      // D-15/D-16/D-22: the destructive wipe completed in the
      // worker. Transition out of 'confirm-pending' (NOT 'processing'
      // — start-over / clear-data stay in 'confirm-pending' until
      // the worker acks, so this branch fires only for that flow).
      // jobId guard matches the existing pattern; a stale 'cleared'
      // for a prior request is ignored, and a 'cleared' that arrives
      // outside 'confirm-pending' is also a no-op.
      if (this.state !== 'confirm-pending') return;
      if (msg.jobId !== this.#jobId) return;
      this.state = 'idle';
      this.stage = null;
      this.parsingProgress = null;
      this.result = null;
      this.errorMessage = null;
      this.#submittedAt = null;
      this.pendingAction = null;
      this.#pendingReturnState = null;
      this.justCleared = true; // D-20: render "Cached data cleared" above the dropzone
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
