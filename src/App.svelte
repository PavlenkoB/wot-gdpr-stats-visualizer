<script lang="ts">
  import { tick } from 'svelte';
  import { ingestClient } from './lib/import/ingest-client.ts';
  import {
    CACHE_CHECK_TEXT,
    CLEARED_ACK_MESSAGE,
    CONFIRM_CLEAR_MESSAGE,
    CONFIRM_REPLACE_MESSAGE,
    DELETE_CACHED_DATA_LABEL,
    DUPLICATE_BANNER_MESSAGE,
    KEEP_CACHED_DATA_LABEL,
    KEEP_CURRENT_DATA_LABEL,
    REPLACE_DATASET_LABEL,
    STAGE_TEXT,
    formatImportedOn,
    formatParsingProgress,
  } from './lib/ui-copy.ts';
  import type { PendingAction } from './lib/import/worker-client.svelte.ts';
  import ConfirmPanel from './lib/shell/ConfirmPanel.svelte';
  import Dashboard from './lib/shell/Dashboard.svelte';
  import ImportBar from './lib/shell/ImportBar.svelte';
  import SiteFooter from './lib/shell/SiteFooter.svelte';

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

  /**
   * What the persistent notice announcer says (WR-01). The visible notice lives
   * in the import bar, which is torn down and rebuilt when the dataset appears
   * or disappears, so a live region owned by the bar would be created together
   * with its own text, and a region created with its content is not announced
   * (RESEARCH Pitfall 10). This one is mounted once, before every branch. An
   * error says nothing here: the failure banner is `role="alert"` and speaks for
   * itself. Plain text only; the stage or progress line is the one processing
   * already shows.
   */
  const announcement = $derived.by<string>(() => {
    switch (notice) {
      case 'processing':
        return statusTextFor ?? '';
      case 'duplicate':
        return DUPLICATE_BANNER_MESSAGE;
      case 'cleared':
        return CLEARED_ACK_MESSAGE;
      default:
        return '';
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
   * Confirm the pending action. A confirmed REPLACE leaves focus on the dropzone
   * (WR-05): the panel and the control that opened it are gone, so focus would
   * otherwise fall to <body>. A drop has no trigger button to return to, and the
   * dropzone is where the user's attention already was. The new dataset still
   * lands on Overview (Phase 8 D-03); only keyboard focus is placed here. A
   * confirmed clear or start-over is handled by the `justCleared` effect below.
   */
  async function onConfirmPending(): Promise<void> {
    const isReplace = ingestClient.pendingAction?.kind === 'replace';
    ingestClient.confirmPending();
    confirmTrigger = null;
    if (!isReplace) return;
    await tick();
    importBar?.focusDropzone();
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
  <!--
    The ONE live region for import notices (WR-01). It is mounted before every
    conditional below and never moves, so it survives a first import, a replace
    and a confirmed clear. The bar's notice slot only shows the same messages.
  -->
  <p
    class="notice-announcer"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-testid="notice-announcer"
  >
    {announcement}
  </p>

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
    <!--
      The import region, passed down as a snippet so App keeps ownership of
      every import handler, the `importBar` binding, the confirm panel and the
      focus return. Dashboard decides WHERE it renders (the detail pane while
      nothing is loaded, the foot of the list pane afterwards) and renders it
      once, so there is never more than one dropzone or file input in the DOM.
    -->
    {#snippet importRegion()}
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
              onconfirm={() => void onConfirmPending()}
              oncancel={() => void onCancelConfirm()}
            />
          {/if}
        {/snippet}
      </ImportBar>
    {/snippet}

    <!--
      The dashboard is driven by `ingestClient.result`, the LAST KNOWN
      dataset, not by the current view state (D-27). A failed replace or
      a duplicate drop therefore leaves the user's data on screen
      instead of blanking the page (RESEARCH Pitfall 3), and a `null`
      result renders the first-visit skeleton (D-24).
    -->
    <Dashboard result={ingestClient.result} {importRegion} />
  {/if}
</main>

<SiteFooter />

<style>
  /* The app root is a plain block: the shell owns the page layout and each
     pane pads itself (Phase 8), so `main` declares no padding, no gap and no
     flex column. A scoped rule here would outrank the global `main` rule in
     `src/app.css` (the element resets; the shell layout is in
     `src/styles/shell.css`), which is why this one deliberately says less than it used
     to rather than repeating it. */
  main {
    display: block;
  }

  /* D-07/D-08 cache-check loading block. Layout matches the import bar's
     processing notice (flex, centered, spinner-then-text) so the
     loading feedback reads as one family — only the literal text
     and the data-testid differ. */
  .cache-check-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-12);
    margin: 0;
    /* `main` no longer pads, so the on-load check carries its own padding. */
    padding: var(--layout-page-y) var(--space-16);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }

  .cache-check-text {
    text-align: center;
  }

  /* Visually hidden, but not display none or hidden, which would remove it from
     the accessibility tree and silence it. The same clip pattern as the
     dashboard's chart announcement region. No font-size on purpose: the 14px
     floor guard scans every stylesheet. */
  .notice-announcer {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* CSS-only spinner, identical to ImportBar.svelte's `.spinner` —
     1.25em circular border with one quarter coloured, rotated
     continuously. prefers-reduced-motion disables the animation. The two
     colours are the shared spinner tokens: the focus blue at 25% for the
     track and at 60% for the still arc. */
  .spinner {
    display: inline-block;
    width: 1.25em;
    height: 1.25em;
    border: 3px solid var(--spinner-track);
    border-top-color: var(--focus);
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
      border-top-color: var(--spinner-arc-still);
    }
  }
</style>
