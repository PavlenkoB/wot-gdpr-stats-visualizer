/// <reference lib="webworker" />
import type { IngestRequest, IngestResponse, WorkerScopeLike } from '../types/worker-messages.ts';
import { analyzeExport } from './classify.ts';
import { listEntryPaths } from './zip-paths.ts';

const scope = self as unknown as WorkerScopeLike;

scope.onmessage = async (event: MessageEvent<IngestRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'ingest') return;
  const { jobId, file } = msg;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    scope.postMessage({
      type: 'stage',
      jobId,
      stage: 'unzipping',
    } satisfies IngestResponse);

    const entryNames = listEntryPaths(bytes);

    scope.postMessage({
      type: 'stage',
      jobId,
      stage: 'classifying',
    } satisfies IngestResponse);

    const outcome = analyzeExport(entryNames);
    if (!outcome.ok) {
      throw new Error(`unrecognized export: ${outcome.reason} (${entryNames.length} entries)`);
    }

    scope.postMessage({
      type: 'done',
      jobId,
      result: outcome.result,
    } satisfies IngestResponse);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[ingest.worker] ingest failed', err);
    scope.postMessage({
      type: 'error',
      jobId,
      detail: `${e.name}: ${e.message}`,
    } satisfies IngestResponse);
  }
};

// Signal to the main thread that the worker script has finished loading
// and is ready to receive ingest requests. This is the handshake that
// proves the worker was spawned eagerly at app init (Pitfall 3 in RESEARCH).
scope.postMessage({ type: 'ready' } satisfies IngestResponse);
