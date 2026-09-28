<script lang="ts">
  import { ingestClient } from './lib/ingest-client.ts';
  import { STAGE_TEXT } from './lib/ui-copy.ts';
  import type { IngestStage } from './lib/types/worker-messages.ts';
  import Dropzone from './lib/components/Dropzone.svelte';
  import FailureBanner from './lib/components/FailureBanner.svelte';
  import ResultsView from './lib/components/ResultsView.svelte';

  function onDropFiles(files: ArrayLike<File>): void {
    ingestClient.submitFiles(files);
  }

  function onStartOver(): void {
    // Single click, no confirmation (D-14). reset() returns false if
    // a job is still in flight — the user must wait — but the
    // ResultsView is only rendered after state 'done', so we are
    // never racing here.
    ingestClient.reset();
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
   */
  function statusTextFor(stage: IngestStage | null): string | null {
    if (stage === null) return STAGE_TEXT.unzipping;
    return STAGE_TEXT[stage];
  }
</script>

<svelte:window ondragover={onWindowDragOver} ondrop={onWindowDrop} />

<main data-worker-ready={ingestClient.workerReady ? 'true' : 'false'}>
  <h1>WG Data Export Viewer</h1>

  {#if ingestClient.state === 'done' && ingestClient.result}
    <ResultsView result={ingestClient.result} onstartover={onStartOver} />
  {:else}
    {#if ingestClient.state === 'error' && ingestClient.errorMessage}
      <FailureBanner message={ingestClient.errorMessage} />
    {/if}

    <Dropzone
      disabled={ingestClient.busy}
      statusText={ingestClient.busy ? statusTextFor(ingestClient.stage) : null}
      onfiles={onDropFiles}
    />
  {/if}
</main>
