export type CategoryStatus = 'supported' | 'known-deferred' | 'unknown';

export interface CategoryEntry {
  name: string;
  status: CategoryStatus;
  fileCount: number;
}

export interface ClassifyResult {
  accountRoot: string;
  categories: CategoryEntry[]; // ordered: supported, then known-deferred, then unknown; name asc within a group
  counts: Record<CategoryStatus, number>;
}

export type IngestStage = 'unzipping' | 'classifying';

export interface IngestRequest {
  type: 'ingest';
  jobId: number;
  file: File;
}

export type IngestResponse =
  | { type: 'ready' }
  | { type: 'stage'; jobId: number; stage: IngestStage }
  | { type: 'done'; jobId: number; result: ClassifyResult }
  | { type: 'error'; jobId: number; detail: string };

/** Main-thread view of the worker (a real Worker satisfies it structurally). */
export interface WorkerLike {
  postMessage(message: IngestRequest): void;
  onmessage: ((event: MessageEvent<IngestResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

/** Worker-side view of its own global scope. */
export interface WorkerScopeLike {
  postMessage(message: IngestResponse): void;
  onmessage: ((event: MessageEvent<IngestRequest>) => void) | null;
}
