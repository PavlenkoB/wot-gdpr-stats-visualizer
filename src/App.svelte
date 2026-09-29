<script lang="ts">
  import { ingestClient } from './lib/ingest-client.ts';
  import {
    CACHE_CHECK_TEXT,
    CLEARED_ACK_MESSAGE,
    CLEAR_DATA_LABEL,
    CONFIRM_CLEAR_MESSAGE,
    CONFIRM_REPLACE_MESSAGE,
    DELETE_CACHED_DATA_LABEL,
    KEEP_CACHED_DATA_LABEL,
    KEEP_CURRENT_DATA_LABEL,
    REPLACE_DATASET_LABEL,
    STAGE_TEXT,
    formatParsingProgress,
  } from './lib/ui-copy.ts';
  import type { PendingAction } from './lib/worker-client.svelte.ts';
  import ConfirmPanel from './lib/components/ConfirmPanel.svelte';
  import Dropzone from './lib/components/Dropzone.svelte';
  import FailureBanner from './lib/components/FailureBanner.svelte';
  import ResultsView from './lib/components/ResultsView.svelte';

  function onDropFiles(files: ArrayLike<File>): void {
    ingestClient.submitFiles(files);
  }

  function onStartOver(): void {
    // D-15/D-16: Start Over is now destructive (wipes the cached
    // IndexedDB dataset, not just the view state). Routes through
    // the shared in-app ConfirmPanel — calling requestStartOver
    // sets pendingAction={kind:'start-over'} and transitions to
    // 'confirm-pending'. The confirm panel renders for the user;
    // on confirm, ingestClient.confirmPending() posts the
    // 'clear-data' message and the worker wipes the dataset. reset()
    // is now internal-only — the public user-visible path is
    // requestStartOver() / confirmPending() / cancelPending().
    ingestClient.requestStartOver();
  }

  /**
   * D-17/D-18: the persistent "Clear my cached data" control's
   * click handler. Identical underlying flow to onStartOver per
   * D-22 (one shared confirm component, one shared underlying
   * clear action) — only the `pendingAction.kind` differs, which
   * lets App.svelte's confirm-panel branch apply the same copy
   * pair (CONFIRM_CLEAR_MESSAGE / KEEP_CACHED_DATA_LABEL /
   * DELETE_CACHED_DATA_LABEL) without any per-trigger copy drift.
   */
  function onClearData(): void {
    ingestClient.requestClearData();
  }

  /**
   * Window-level dragover/drop guard. A drop or dragover OUTSIDE the
   * dropzone would otherwise cause the browser to navigate to the
   * dropped file (replacing the app with a `file://` view of the
   * bytes — the privacy tool is now leaking the export off the page).
   * The dropzone's own drop handler calls preventDefault on its own
   * copy of the event, so it still works; this handler is a backstop
   * for everywhere else on the page.
   */
  function onWindowDragOver(event: DragEvent): void {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  }

  function onWindowDrop(event: DragEvent): void {
    if (event.defaultPrevented) return;
    event.preventDefault();
  }

  /**
   * The dropzone's statusText prop. While busy, derive from
   * STAGE_TEXT[stage] (D-08). When stage is momentarily null
   * (between submitFiles and the worker's first stage message) the
   * STAGE_TEXT lookup is type-safe only when the key exists; we
   * therefore use a small lookup with a fallback to the unzipping
   * copy so the user always sees a spinner with words.
   *
   * D-11: when stage is 'parsing' AND the worker has posted a
   * `progress` object for the current category, override the
   * generic "Parsing categories..." text with the per-category
   * format `Parsing <Category> (i/n)...` so the user sees
   * genuinely advancing progress rather than a static spinner.
   *
   * `$derived` so the read of `ingestClient.parsingProgress` inside
   * this expression registers a dependency — a plain function would
   * not re-run on per-category progress changes, only on stage
   * changes (Svelte 5 tracks arguments but not deep state reads
   * inside helper functions).
   */
  const statusTextFor = $derived.by<string | null>(() => {
    const stage = ingestClient.stage;
    if (stage === null) return STAGE_TEXT.unzipping;
    if (stage === 'parsing' && ingestClient.parsingProgress) {
      return formatParsingProgress(ingestClient.parsingProgress);
    }
    return STAGE_TEXT[stage];
  });

  /**
   * D-13/D-16/D-22: select the copy/labels for the ConfirmPanel
   * based on the pendingAction.kind discriminator. Per D-22, the
   * 'start-over' and 'clear-data' kinds share the EXACT same copy
   * pair (CONFIRM_CLEAR_MESSAGE / KEEP_CACHED_DATA_LABEL /
   * DELETE_CACHED_DATA_LABEL) — collapsing both into a single
   * branch enforces this at compile time: any future drift would
   * require explicitly breaking the shared branch.
   */
  const confirmCopy = $derived.by<{
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  } | null>(() => {
    const action: PendingAction | null = ingestClient.pendingAction;
    if (action === null) return null;
    if (action.kind === 'replace') {
      return {
        message: CONFIRM_REPLACE_MESSAGE,
        confirmLabel: REPLACE_DATASET_LABEL,
        cancelLabel: KEEP_CURRENT_DATA_LABEL,
      };
    }
    // 'start-over' and 'clear-data' share copy (D-22).
    return {
      message: CONFIRM_CLEAR_MESSAGE,
      confirmLabel: DELETE_CACHED_DATA_LABEL,
      cancelLabel: KEEP_CACHED_DATA_LABEL,
    };
  });
</script>

<svelte:window ondragover={onWindowDragOver} ondrop={onWindowDrop} />

<main data-worker-ready={ingestClient.workerReady ? 'true' : 'false'}>
  <h1>WG Data Export Viewer</h1>

  {#if ingestClient.state === 'checking-cache'}
    <!--
      D-07/D-08: the brief loading spinner between page init and the
      cache check resolving. The spinner CSS mirrors Dropzone.svelte's
      `.spinner` exactly — duplicated here intentionally per UI-SPEC's
      note that the spinner is not extracted into a shared component.
    -->
    <p class="cache-check-status" data-testid="cache-check-status" role="status">
      <span class="spinner" data-testid="cache-check-spinner" aria-hidden="true"></span>
      <span class="cache-check-text">{CACHE_CHECK_TEXT}</span>
    </p>
  {:else if ingestClient.state === 'confirm-pending' && ingestClient.pendingAction && confirmCopy}
    <!--
      D-13/D-16/D-22: ONE shared ConfirmPanel renders above any
      other content when state === 'confirm-pending'. The pending
      drop's results view (or dropzone) is NOT swapped out — the
      panel overlays it so the existing dataset remains visible
      behind the panel until the user confirms or cancels
      (must_haves: "the old dataset remains visible and unchanged
      until the user confirms"). Copy/labels selected by
      pendingAction.kind (D-22's single-mechanism rule).
    -->
    <ConfirmPanel
      message={confirmCopy.message}
      confirmLabel={confirmCopy.confirmLabel}
      cancelLabel={confirmCopy.cancelLabel}
      onconfirm={() => ingestClient.confirmPending()}
      oncancel={() => ingestClient.cancelPending()}
    />
  {/if}

  {#if ingestClient.state === 'done' && ingestClient.result}
    <!--
      D-13: <Dropzone> co-renders alongside <ResultsView> when a
      dataset is cached so the user can drop a DIFFERENT zip to
      trigger the replace-on-drop confirm flow. The existing
      submitFiles() guard at worker-client.svelte.ts:341-347
      intercepts the drop, sets pendingAction={kind:'replace', file},
      and transitions to 'confirm-pending' — no worker message
      posts until the user confirms. The <ResultsView> stays
      visible behind the ConfirmPanel overlay so the cached
      dataset is preserved until confirm.
    -->
    <ResultsView result={ingestClient.result} onstartover={onStartOver} />
    <Dropzone
      disabled={ingestClient.busy}
      statusText={ingestClient.busy ? statusTextFor : null}
      onfiles={onDropFiles}
    />
  {:else if ingestClient.state === 'duplicate' && ingestClient.result}
    <!--
      D-12: the duplicate-loaded banner is rendered alongside the
      results view (the cached dataset is still the active one).
      Kept inline here for the same reason FailureBanner lives in
      App.svelte rather than ResultsView — the banner is part of
      the page-level state, not the results view's render.

      D-13: <Dropzone> co-renders so the user can drop a different
      zip to trigger the replace-on-drop confirm flow, identical
      mechanism to the 'done' branch above.
    -->
    <ResultsView result={ingestClient.result} onstartover={onStartOver} />
    <Dropzone
      disabled={ingestClient.busy}
      statusText={ingestClient.busy ? statusTextFor : null}
      onfiles={onDropFiles}
    />
  {:else if ingestClient.state === 'confirm-pending' && ingestClient.pendingAction?.kind === 'replace' && ingestClient.result}
    <!--
      D-13: keep <ResultsView> mounted during the replace-on-drop
      confirm so the existing dataset remains visible behind the
      <ConfirmPanel> overlay. Before this branch existed, the
      'done' → 'confirm-pending' transition fell through to the
      {:else} branch (which only renders <Dropzone>), unmounting
      <ResultsView> — a latent 02-03 bug that was unreachable until
      02-04 co-rendered <Dropzone> in the 'done' branch and so made
      it possible for a drop to reach submitFiles() → 'confirm-pending'
      with pendingAction.kind === 'replace'. The confirm panel
      overlay at lines 149-166 sits on TOP of this <ResultsView>.

      Only the 'replace' kind reaches this branch — 'start-over'
      and 'clear-data' kinds fall through to the {:else} branch
      (no result to keep visible behind an empty-state confirm;
      D-16/D-22 destructive confirmation before an empty dropzone).
    -->
    <ResultsView result={ingestClient.result} onstartover={onStartOver} />
  {:else}
    {#if ingestClient.state === 'error' && ingestClient.errorMessage}
      <FailureBanner message={ingestClient.errorMessage} />
    {/if}

    {#if ingestClient.state === 'idle' && ingestClient.justCleared}
      <!--
        D-20: one-shot "Cached data cleared" acknowledgment, shown
        above the dropzone in the idle state right after a
        confirmed clear. Rendered here (NOT in ResultsView) because
        the dropzone is the post-clear view. The justCleared flag
        is cleared by IngestClient itself on the next submitFiles()
        or reset() call — never by a timer (D-06). If the user
        immediately drops a new file after seeing the banner, the
        flag resets and the banner does not follow them into the
        processing view.
      -->
      <p class="cleared-ack" data-testid="cleared-ack" role="status">{CLEARED_ACK_MESSAGE}</p>
    {/if}

    <Dropzone
      disabled={ingestClient.busy}
      statusText={ingestClient.busy ? statusTextFor : null}
      onfiles={onDropFiles}
    />
  {/if}

  <!--
    D-17/D-18/D-19: the persistent "Clear my cached data" control.
    Rendered OUTSIDE the state-branching conditional so it appears
    alongside BOTH the results view AND the dropzone — visible on
    every state that has a cached dataset (D-18). Gated by an
    {#if} on (state === 'done' || state === 'duplicate') so the
    control is hidden ENTIRELY (not shown-disabled) when nothing is
    cached (D-19). The button is bound to ingestClient.requestClearData()
    which sets pendingAction={kind:'clear-data'} and transitions to
    'confirm-pending' — the same ConfirmPanel as Start Over (D-22).
  -->
  {#if ingestClient.state === 'done' || ingestClient.state === 'duplicate'}
    <div class="persistent-bar" data-testid="persistent-bar">
      <button
        type="button"
        class="clear-data-control"
        data-testid="clear-data-control"
        onclick={onClearData}>{CLEAR_DATA_LABEL}</button
      >
    </div>
  {/if}
</main>

<style>
  main {
    padding: 24px;
  }

  h1 {
    margin: 0 0 16px;
  }

  /* D-07/D-08 cache-check loading block. Layout matches Dropzone's
     .processing-status (flex, centered, spinner-then-text) so the
     loading feedback reads as one family — only the literal text
     and the data-testid differ. */
  .cache-check-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 0;
    padding: 0;
    font-size: 16px;
    line-height: 1.5;
  }

  .cache-check-text {
    text-align: center;
  }

  /* CSS-only spinner, identical to Dropzone.svelte's `.spinner` —
     1.25em circular border with one quarter coloured, rotated
     continuously. prefers-reduced-motion disables the animation. */
  .spinner {
    display: inline-block;
    width: 1.25em;
    height: 1.25em;
    border: 3px solid rgba(26, 115, 232, 0.25);
    border-top-color: #1a73e8;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex: 0 0 auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
      border-top-color: rgba(26, 115, 232, 0.6);
    }
  }

  /* D-20 one-shot acknowledgment above the post-clear dropzone.
     Neutral-info palette (UI-SPEC Color table) — same family as
     the duplicate-loaded banner and the "Imported on ..." timestamp.
     No timer to dismiss; justCleared is cleared on the next action. */
  .cleared-ack {
    margin: 0 0 16px;
    padding: 12px 16px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #f1f3f4;
    color: #3c4043;
    font-size: 16px;
    line-height: 1.5;
  }

  /* D-17/D-18: persistent bar hosting the "Clear my cached data"
     control. Background uses the Secondary (neutral) 30% palette
     (UI-SPEC Color table) so the bar reads as a persistent
     page-level chrome element rather than competing with the
     primary results content above it. The button itself is the
     same neutral-info palette Start Over uses (D-22 visual
     coherence between the two destructive triggers). */
  .persistent-bar {
    margin: 16px 0 0;
    padding: 12px 16px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #f7f7fa;
  }

  .clear-data-control {
    padding: 8px 16px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #fff;
    color: #3c4043;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .clear-data-control:hover {
    background: #f1f3f4;
  }

  .clear-data-control:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }
</style>
