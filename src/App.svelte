<script lang="ts">
  import { tick } from 'svelte';
  import { ingestClient } from './lib/ingest-client.ts';
  import {
    CACHE_CHECK_TEXT,
    CONFIRM_CLEAR_MESSAGE,
    CONFIRM_REPLACE_MESSAGE,
    DELETE_CACHED_DATA_LABEL,
    KEEP_CACHED_DATA_LABEL,
    KEEP_CURRENT_DATA_LABEL,
    REPLACE_DATASET_LABEL,
    STAGE_TEXT,
    formatImportedOn,
    formatParsingProgress,
  } from './lib/ui-copy.ts';
  import type { PendingAction } from './lib/worker-client.svelte.ts';
  import ConfirmPanel from './lib/components/ConfirmPanel.svelte';
  import Dashboard from './lib/components/Dashboard.svelte';
  import ImportBar from './lib/components/ImportBar.svelte';

  let importBar: ReturnType<typeof ImportBar> | undefined = $state();

  /**
   * The element that opened the confirm panel, so a dismissal can put focus
   * back where the user left it (UI-SPEC focus management). Cleared when the
   * panel closes, and when the dataset is replaced by a drop rather than by
   * a button.
   */
  let confirmTrigger: HTMLElement | null = null;

  function onDropFiles(files: ArrayLike<File>): void {
    // Replace-on-drop has no button to come back to, so the focus target
    // recorded by the last trigger click is stale from here on.
    confirmTrigger = null;
    ingestClient.submitFiles(files);
  }

  function onStartOver(event: MouseEvent): void {
    // D-15/D-16: Start Over is now destructive (wipes the cached
    // IndexedDB dataset, not just the view state). Routes through
    // the shared in-app ConfirmPanel — calling requestStartOver
    // sets pendingAction={kind:'start-over'} and transitions to
    // 'confirm-pending'. The confirm panel renders for the user;
    // on confirm, ingestClient.confirmPending() posts the
    // 'clear-data' message and the worker wipes the dataset. reset()
    // is now internal-only — the public user-visible path is
    // requestStartOver() / confirmPending() / cancelPending().
    confirmTrigger = event.currentTarget as HTMLElement;
    ingestClient.requestStartOver();
  }

  /**
   * D-17/D-18: the persistent "Clear my cached data" control's
   * click handler. Identical underlying flow to onStartOver per
   * D-22 (one shared confirm component, one shared underlying
   * clear action) — only the `pendingAction.kind` differs, which
   * lets this file's confirm-panel branch apply the same copy
   * pair (CONFIRM_CLEAR_MESSAGE / KEEP_CACHED_DATA_LABEL /
   * DELETE_CACHED_DATA_LABEL) without any per-trigger copy drift.
   */
  function onClearData(event: MouseEvent): void {
    confirmTrigger = event.currentTarget as HTMLElement;
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
   * The notice slot's text while busy. Derived from STAGE_TEXT[stage]
   * (D-08). When stage is momentarily null (between submitFiles and the
   * worker's first stage message) the STAGE_TEXT lookup is type-safe only
   * when the key exists; we therefore use a small lookup with a fallback to
   * the unzipping copy so the user always sees a spinner with words.
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

  /**
   * A dataset is DISPLAYED, not merely imported: this is the last known
   * cached result, which by design outlives processing, a duplicate drop and
   * a failed import (D-27). It is the only thing that picks the import
   * region's variant, so the bar and the dashboard below it can never
   * disagree about whether an export is loaded.
   */
  const hasResult = $derived(ingestClient.result !== null);

  /**
   * The one transient message the import region shows, derived rather than
   * stored (RESEARCH Pattern 4 / UI-SPEC notice slot). At most one notice
   * can be live at a time, and 'checking-cache' and 'confirm-pending' carry
   * none — the former is the whole page body, the latter must not speak over
   * the panel the user is being asked to answer.
   */
  const notice = $derived.by<'processing' | 'error' | 'duplicate' | 'cleared' | null>(() => {
    switch (ingestClient.state) {
      case 'processing':
        return 'processing';
      case 'error':
        return ingestClient.errorMessage === null ? null : 'error';
      case 'duplicate':
        return 'duplicate';
      case 'idle':
        return ingestClient.justCleared ? 'cleared' : null;
      default:
        return null;
    }
  });

  /** "Imported on {date}", or null while no dataset is displayed. */
  const importedOn = $derived.by<string | null>(() => {
    const result = ingestClient.result;
    return result === null ? null : formatImportedOn(result.importedAt ?? '');
  });

  /**
   * Dismiss the confirm panel and hand focus back to whatever opened it
   * (UI-SPEC focus management). The trigger is checked for `isConnected`
   * because the clear flow removes it; falling through to the dropzone keeps
   * focus inside the app rather than dropping it on <body>.
   */
  async function onCancelConfirm(): Promise<void> {
    ingestClient.cancelPending();
    const trigger = confirmTrigger;
    confirmTrigger = null;
    await tick();
    if (trigger !== null && trigger.isConnected) {
      trigger.focus();
    } else {
      importBar?.focusDropzone();
    }
  }

  /**
   * After a CONFIRMED clear the button that opened the panel is gone, so
   * there is nothing to return focus to. The full-size dropzone is the only
   * sensible landing spot (UI-SPEC). The effect reads justCleared and nothing
   * else, so it runs once per clear rather than on every state change.
   */
  $effect(() => {
    if (!ingestClient.justCleared) return;
    void (async () => {
      await tick();
      importBar?.focusDropzone();
    })();
  });
</script>

<svelte:window ondragover={onWindowDragOver} ondrop={onWindowDrop} />

<main data-worker-ready={ingestClient.workerReady ? 'true' : 'false'}>
  <h1>WG Data Export Viewer</h1>

  <!--
    D-28: during the on-load cache check this block IS the page body. It
    renders alone so a returning user never sees a flash of the empty
    skeleton before their dataset appears, and so the section ids the
    scroll-spy observes exist by the time its effect runs.
  -->
  {#if ingestClient.state === 'checking-cache'}
    <p class="cache-check-status" data-testid="cache-check-status" role="status">
      <span class="spinner" data-testid="cache-check-spinner" aria-hidden="true"></span>
      <span class="cache-check-text">{CACHE_CHECK_TEXT}</span>
    </p>
  {:else}
    <ImportBar
      bind:this={importBar}
      variant={hasResult ? 'slim' : 'full'}
      {notice}
      statusText={statusTextFor}
      errorMessage={ingestClient.errorMessage}
      {importedOn}
      busy={ingestClient.busy}
      onfiles={onDropFiles}
      onstartover={onStartOver}
      onclear={onClearData}
    >
      <!--
        The one shared ConfirmPanel (Phase 2 D-22), rendered by the import
        bar below its controls so the destructive answer sits next to the
        controls it is about. The dataset behind it is NOT swapped out — the
        user's data stays on screen until they confirm or cancel.
      -->
      {#snippet confirm()}
        {#if ingestClient.state === 'confirm-pending' && ingestClient.pendingAction && confirmCopy}
          <ConfirmPanel
            message={confirmCopy.message}
            confirmLabel={confirmCopy.confirmLabel}
            cancelLabel={confirmCopy.cancelLabel}
            onconfirm={() => ingestClient.confirmPending()}
            oncancel={() => void onCancelConfirm()}
          />
        {/if}
      {/snippet}
    </ImportBar>

    <!--
      The dashboard is driven by `ingestClient.result`, the LAST KNOWN
      dataset, not by the current view state (D-27). A failed replace or
      a duplicate drop therefore leaves the user's data on screen
      instead of blanking the page (RESEARCH Pitfall 3), and a `null`
      result renders the first-visit skeleton (D-24).
    -->
    <Dashboard result={ingestClient.result} />
  {/if}
</main>

<style>
  /* One flex column, the spacing scale's lg (24px) between top-level
     blocks. The gap lives here rather than on each block so the document
     order below is the only thing that decides what sits where. */
  main {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
  }

  /* D-07/D-08 cache-check loading block. Layout matches the import bar's
     processing notice (flex, centered, spinner-then-text) so the
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

  /* CSS-only spinner, identical to ImportBar.svelte's `.spinner` —
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
</style>
