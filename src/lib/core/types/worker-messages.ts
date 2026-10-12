// Type-only imports of the four view types. The worker owns the pure builders
// (05-04 vehicle, 05-05 finance) and this module names only their output
// shapes, so a block can render a view without importing the worker or Dexie.
import type { VehicleTitleId, VehicleView } from '../../features/vehicles/vehicle-shared.ts';
import type {
  CurrencyView,
  PremiumView,
  SpendView,
} from '../../features/finance/finance-shared.ts';
import type { LoginsView } from '../../features/logins/login-shared.ts';
import type { DeviceInfoView } from '../../features/device-info/device-info-shared.ts';
import type { CityView } from '../../features/logins/city-shared.ts';

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

/**
 * One bucket of the playtime charts: every total the Activity_time section
 * draws, for a single slice (all sessions, or one split value).
 *
 * The three grid arrays are stored FINAL rather than recomputed on read, so
 * switching the hour basis or widening a chart never re-scans rows. 04-01
 * creates them zero-filled; the plans that own each chart fill its own cells.
 */
export interface PlaytimeSlice {
  /** Merged playtime seconds: overlapping sessions counted once (D-02). */
  seconds: number;
  /** Sessions that contributed a usable start and end. */
  sessions: number;
  /** Sessions dropped as unusable — see `buildPlaytime` for the three causes. */
  excluded: number;
  /**
   * Day numbers, ascending, one entry per day with any usable session.
   * A day number is `floor(startSeconds / 86400)`, so `dayIndex.length` IS
   * the active-day count: no separate field could drift out of step.
   */
  dayIndex: number[];
  /** Merged seconds attributed to each `dayIndex` entry, by session START day. */
  daySeconds: number[];
  /** Usable sessions that started on each `dayIndex` entry. */
  daySessions: number[];
  /**
   * 168 cells indexed `weekday * 24 + hourOfDay`, Monday = 0. Each cell holds
   * the seconds of playtime that OVERLAPPED that weekday hour, so a session
   * spanning an hour boundary contributes to both cells.
   */
  hourOverlap: number[];
  /**
   * The same 168 cells, but each session's whole merged length credited to
   * the hour it started in. Stored beside `hourOverlap` so the basis is a
   * constant to switch rather than a re-import (see `HOUR_GRID_BASIS`).
   */
  hourStart: number[];
  /**
   * 12 duration bins, one session per bin, edges from
   * `DURATION_BIN_EDGES_SECONDS`.
   */
  bins: number[];
}

/**
 * The whole-dataset playtime aggregate, computed once in the worker at import
 * and persisted on the dataset meta record.
 *
 * It is stored on the meta record and NOT on `ClassifyResult` on purpose:
 * `IngestClient` holds the import result as a deep `$state` proxy, which
 * would walk thousands of numbers on every replay, and the aggregate is far
 * too large to clone across `postMessage` on each query.
 */
export interface PlaytimeAggregates {
  /** `PLAYTIME_VERSION` at aggregation time; a mismatch is an error, not a cast. */
  v: number;
  /**
   * True when a session file was SEEN by the classifier — the legacy
   * `Sessions.csv` or a real `<GAME>_Game_Sessions.csv` — as opposed to parsed
   * successfully. A header-only file sets it with zero usable rows, which is
   * what separates `no-usable-sessions` from `no-session-file`.
   */
  sessionsFileSeen: boolean;
  /**
   * The column a later import split on, or null when no split was made.
   *
   * One of `GAME`, `SERVER_NAME` or `CLIENT_PLATFORM`, in the order the
   * aggregator considers them. `GAME` leads because the real export names the
   * game in the session file's name and carries neither of the other two
   * columns (04-15).
   */
  splitColumn: string | null;
  /** Every distinct split value, ascending, as stored in `byValue`. */
  values: (string | null)[];
  /** Every session, ungrouped. Always present, even when a split exists. */
  all: PlaytimeSlice;
  /** One slice per entry of `values`, in the same order. */
  byValue: PlaytimeSlice[];
}

/** The "split by" menu: which column, and how many seconds each value holds. */
export interface PlaytimeSplit {
  column: string;
  values: { value: string; seconds: number }[];
  allSeconds: number;
}

/**
 * What a `playtime-query` answers with.
 *
 * Three statuses, and the copy treats them as three different sentences:
 *   - `no-session-file` — this export has no session file at all (neither
 *     `Sessions.csv` nor a per-game one, only `Logins.csv`), so there is
 *     nothing to say about playtime and no column to split by.
 *   - `no-usable-sessions` — the file was there, but no row carried a usable
 *     start and end pair, so the chart is empty and the copy names the
 *     excluded count.
 *   - `ready` — the charts have their numbers.
 */
export type PlaytimeView =
  | { status: 'no-session-file' }
  | { status: 'no-usable-sessions'; excluded: number }
  | {
      status: 'ready';
      split: PlaytimeSplit | null;
      /**
       * The index of the value the answer is actually showing, or null for
       * All.
       *
       * An INDEX and not the slice, because every consumer needs to name
       * the value: `buildSplitTable(split, selected)` flags the row it is on
       * by index, and the live-region summary reads `split.values[selected]`
       * to say which value it is. It is the APPLIED index, so an invalid
       * request — negative, fractional, NaN, Infinity, past the end, or
       * left over from a replaced dataset — answers null over the All slice
       * and the selector shows All instead of a value the view is not
       * holding.
       */
      selected: number | null;
      /** The slice the main thread is showing: the selected value's, or All. */
      slice: PlaytimeSlice;
    };

export type IngestStage = 'hashing' | 'unzipping' | 'classifying' | 'parsing' | 'writing';

/**
 * What one block asks for. Every field a channel does not use is absent rather
 * than null, so a malformed or hostile message is a shape the validator can
 * reject (T-05-18) instead of a set of defaults to guess at.
 *
 * `title` and `battleType` are nullable because D-05's default title and D-07's
 * "All battles" are real requests, not missing ones.
 *
 * The channel is one per dashboard block (D-01, D-02, FINANCE-01..03, STATS-01)
 * and is what scopes the client's supersede: a block asking again supersedes
 * only its OWN pending question, so three blocks mounting in one tick cannot
 * starve each other (RESEARCH Pitfall 1).
 */
export type DataQuery =
  | { channel: 'vehicles'; title: VehicleTitleId | null; battleType: string | null }
  | { channel: 'premium' }
  | { channel: 'currency' }
  | { channel: 'spend' }
  // 06-01. The login history asks through the SAME channel union rather than a
  // dedicated `login-query` triple, so the existing per-channel supersede in
  // `QueryClient` applies to it for free and a second request namespace would be
  // a second thing to get wrong. It takes NO further fields — like the three
  // finance channels — so `isDataQuery` rejects a `title` or `battleType`
  // smuggled into it rather than ignoring fields this code does not understand.
  | { channel: 'logins' }
  // 261012-bog. The Device info pane asks for its three per-source tables
  // through the same channel union. It takes no further fields, so
  // `isDataQuery` rejects a `title` or `battleType` smuggled into it exactly as
  // it does for the finance channels.
  | { channel: 'device-info' };

/**
 * The answer to one `DataQuery`, discriminated by the same channel as the
 * question, so a client can route a reply without a second lookup.
 */
export type DataResult =
  | { channel: 'vehicles'; view: VehicleView }
  | { channel: 'premium'; view: PremiumView }
  | { channel: 'currency'; view: CurrencyView }
  | { channel: 'spend'; view: SpendView }
  | { channel: 'logins'; view: LoginsView }
  | { channel: 'device-info'; view: DeviceInfoView };

export interface ParsingProgress {
  category: string;
  categoryIndex: number; // 1-based
  categoryTotal: number;
}

export type IngestRequest =
  | { type: 'ingest'; jobId: number; file: File }
  | { type: 'check-cache'; jobId: number } // NEW — D-07/D-08, sent once at app init
  | { type: 'clear-data'; jobId: number } // NEW — D-15/D-17
  // NEW — D-06. Its own `queryId` namespace, deliberately NOT the ingest
  // `jobId`: charts are asked for while no import is running, and reusing
  // `jobId` would drag the import state machine into every query.
  | { type: 'playtime-query'; queryId: number; valueIndex: number | null }
  // 05-07. The four Phase 5 blocks share ONE request variant rather than four:
  // a channel per message would multiply the union and drift. `queryId` is the
  // same shared namespace idea the playtime pair established, and deliberately
  // NOT the ingest `jobId` — a block asking for numbers must not move the
  // import state machine.
  | { type: 'data-query'; queryId: number; query: DataQuery }
  // 06-09, ACTIVITY-07, D-13/D-15. The opt-in city asset, handed over as
  // BYTES: this message is the only sanctioned way the city container reaches
  // the worker, and it carries the buffer rather than a URL because the worker
  // has no network access at all (the lint ban is the enforcement, and this
  // contract is what makes it possible to keep).
  //
  // `loadId` rather than `queryId`, and deliberately not a channel in
  // `DataQuery`: a city load is a DECODE, not a question about a dataset, and
  // the two must be able to be in flight at once without either superseding the
  // other. `expectedBytes` and `sha256` come from the build's manifest; both
  // are checked before a byte of the container is believed.
  | {
      type: 'city-load';
      loadId: number;
      buffer: ArrayBuffer;
      expectedBytes: number;
      /** Null skips the check — a manifest that was not fetched has no hash. */
      sha256: string | null;
    };

export type IngestResponse =
  | { type: 'ready' }
  | { type: 'stage'; jobId: number; stage: IngestStage; progress?: ParsingProgress }
  | { type: 'duplicate'; jobId: number; result: ClassifyResult } // NEW — D-12
  | { type: 'done'; jobId: number; result: ClassifyResult }
  | { type: 'cache-status'; jobId: number; cached: ClassifyResult | null } // NEW — D-07
  | { type: 'cleared'; jobId: number } // NEW — D-20 ack
  | { type: 'error'; jobId: number; detail: string }
  // NEW — D-06. `importedAt` echoes the dataset the view belongs to, so the
  // main thread can drop a reply for a dataset it is no longer showing; both
  // it and `view` are null when nothing is imported.
  | {
      type: 'playtime-result';
      queryId: number;
      importedAt: string | null;
      view: PlaytimeView | null;
    }
  // NEW — D-06. `detail` is a name and a message only: never the error type
  // and never a jobId, so a failed query leaks nothing about the dataset.
  | { type: 'playtime-error'; queryId: number; detail: string }
  // 05-07. `importedAt` echoes the ONE Dexie snapshot the answer was computed
  // from, so the main thread can drop a reply for a dataset it is no longer
  // showing (D-28) — the same pairing the playtime pair uses. Both it and
  // `result` are null when nothing is imported.
  | {
      type: 'data-result';
      queryId: number;
      importedAt: string | null;
      result: DataResult | null;
    }
  // 05-07 (T-05-20). `detail` is the error NAME only, never its message: a
  // message from a builder can echo a cell, and Phase 3 D-21 keeps dataset
  // text off the screen and out of the outcome.
  | { type: 'data-error'; queryId: number; detail: string }
  // 06-09, ACTIVITY-07. `importedAt` echoes the ONE Dexie snapshot the view was
  // computed from, exactly as the playtime and data pairs do (D-28): a replace
  // landing while a decode is in flight produces an answer the main thread
  // drops, rather than a city list described against the wrong dataset. Both it
  // and `view` are null when nothing is imported.
  | {
      type: 'city-result';
      loadId: number;
      importedAt: string | null;
      view: CityView | null;
    }
  // 06-09 (T-06-33, T-06-35). `detail` is the one fixed CITY_DATA_ERROR string
  // and never the error's own message: these bytes came off a network, so a
  // message assembled from them is text a hostile file chose.
  | { type: 'city-error'; loadId: number; detail: string };

/** Main-thread view of the worker (a real Worker satisfies it structurally). */
export interface WorkerLike {
  /**
   * `transfer` exists for the city container and nothing else: an 11.8 MB
   * `ArrayBuffer` COPIED across `postMessage` would be 11.8 MB of allocation
   * and a stall on the main thread for a transfer that is free. Every other
   * message has no transfer list, and the parameter is optional so no caller
   * has to pass one.
   */
  postMessage(message: IngestRequest, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<IngestResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

/** Worker-side view of its own global scope. */
export interface WorkerScopeLike {
  postMessage(message: IngestResponse): void;
  onmessage: ((event: MessageEvent<IngestRequest>) => void) | null;
}
