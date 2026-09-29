export type CategoryStatus = 'supported' | 'known-deferred' | 'unknown';

export interface CategoryEntry {
  name: string;
  status: CategoryStatus;
  fileCount: number;
  /**
   * Total data rows the worker parsed for this category. Set by
   * `ingest.worker.ts` after the per-category parse loop; `analyzeExport`
   * itself does not parse, so the field is absent (treated as 0) on
   * a pre-parse `ClassifyResult`.
   */
  rowCount?: number; // D-05
  /**
   * Rows skipped due to a `Quotes`-type PapaParse error
   * (D-03 / RESEARCH Pitfall 3). Set by the worker; absent on a
   * pre-parse `ClassifyResult`.
   */
  skippedRowCount?: number; // D-04, D-09
}

export interface ClassifyResult {
  accountRoot: string;
  categories: CategoryEntry[]; // ordered: supported, then known-deferred, then unknown; name asc within a group
  counts: Record<CategoryStatus, number>;
  /**
   * ISO 8601 timestamp of the import. Set by `db.writeDataset` and
   * passed back in the `done` / `duplicate` / `cache-status` responses
   * (D-10). Absent on a pre-parse `ClassifyResult` (analyzeExport alone
   * never sets it).
   */
  importedAt?: string;
  /**
   * The three-field account identity (D-20). Computed once at import by the
   * worker, persisted on the dataset meta record and replayed on the
   * `done` / `duplicate` / `cache-status` responses, so a return visit
   * needs no row query.
   *
   * Two distinct absences, which the UI must not conflate (D-16):
   *   - `null` — NO User_Info row was parsed at all (folder absent, or
   *     present but holding zero data rows). The header falls back to the
   *     account ID.
   *   - an object whose fields are `null` — a row WAS parsed but that
   *     column was missing or blank, so the field renders as "Unknown".
   *
   * Absent (undefined) on a pre-parse `ClassifyResult` (analyzeExport
   * alone never computes it), same convention as `importedAt`.
   */
  identity?: AccountIdentity | null;
}

/**
 * The three-field account identity computed once, in the worker, at import
 * time (D-20).
 *
 * This object is the ONLY account-derived data allowed to cross to the main
 * thread: the raw User_Info rows never leave the worker, and the email
 * (LOGIN) plus birth data are dropped before anything is persisted (D-18),
 * so no field here can be one of the stripped columns by construction.
 *
 * Each field is `string | null` rather than optional so a consumer can tell
 * "the export has no value for this field" from "this build of the contract
 * does not carry the field".
 */
export interface AccountIdentity {
  /** `NAME` from the chosen Account_Info row (D-12). */
  nickname: string | null;
  /** Raw `REGION`, never mapped to a friendly name (D-13). */
  region: string | null;
  /** Raw `CREATED_AT`, shown date-only with no timezone conversion (D-15). */
  createdAt: string | null;
}

export type IngestStage = 'hashing' | 'unzipping' | 'classifying' | 'parsing' | 'writing';

export interface ParsingProgress {
  category: string;
  categoryIndex: number; // 1-based
  categoryTotal: number;
}

export type IngestRequest =
  | { type: 'ingest'; jobId: number; file: File }
  | { type: 'check-cache'; jobId: number } // NEW — D-07/D-08, sent once at app init
  | { type: 'clear-data'; jobId: number }; // NEW — D-15/D-17

export type IngestResponse =
  | { type: 'ready' }
  | { type: 'stage'; jobId: number; stage: IngestStage; progress?: ParsingProgress }
  | { type: 'duplicate'; jobId: number; result: ClassifyResult } // NEW — D-12
  | { type: 'done'; jobId: number; result: ClassifyResult }
  | { type: 'cache-status'; jobId: number; cached: ClassifyResult | null } // NEW — D-07
  | { type: 'cleared'; jobId: number } // NEW — D-20 ack
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
