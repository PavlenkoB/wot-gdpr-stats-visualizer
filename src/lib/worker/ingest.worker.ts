/// <reference lib="webworker" />
import { unzipSync } from 'fflate';
import type {
  CategoryEntry,
  ClassifyResult,
  DataQuery,
  IngestRequest,
  IngestResponse,
  ParsingProgress,
  WorkerScopeLike,
} from '../core/types/worker-messages.ts';
import { analyzeExport, resolveCsvFileCategory, sortCategoryEntries } from './classify.ts';
import { CATEGORY_STATUS_ORDER, classifyFolder } from './categories.ts';
import { listEntryPaths } from './zip-paths.ts';
import { digestFile } from './hash.ts';
import { parseCsvFile } from './csv-parse.ts';
import {
  extractAccountRecord,
  extractIdentity,
  isUserInfoCategory,
  sanitizeUserInfoRow,
} from './identity.ts';
import {
  buildPlaytimeFromSources,
  isSessionsRow,
  sessionFileGame,
  viewFromAggregates,
  type SessionRow,
  type SessionSource,
} from '../features/playtime/playtime-aggregate.ts';
import { PLAYTIME_VERSION } from '../features/playtime/playtime-shared.ts';
import {
  buildLogins,
  isLoginsRow,
  viewFromLogins,
  type LoginSource,
} from '../features/logins/login-aggregate.ts';
import {
  LOGINS_VERSION,
  type LoginAddress,
  type LoginsView,
} from '../features/logins/login-shared.ts';
import { geoTableId, lookupCountry } from '../geo/country-lookup.ts';
import {
  CITY_DATA_ERROR,
  buildCityView,
  decodeCityTable,
  familiesOf,
  inflateIfGzip,
} from '../geo/city-table.ts';
import {
  answerDataQuery,
  clearDataQueryMemo,
  DATA_FILES,
  getDataQueryMemo,
  isDataQuery,
  setDataQueryMemo,
} from './data-queries.ts';
import {
  checkCache,
  clearData,
  MAX_PRESENCE_FILES,
  readLoginRowData,
  readRowsByFile,
  readSessionRowData,
  writeDataset,
  writeLoginsIfCurrent,
  writePlaytimeIfCurrent,
  type DatasetFile,
  type DatasetMeta,
  type DatasetRow,
} from './db.ts';

const scope = self as unknown as WorkerScopeLike;

/**
 * The categories whose per-file presence facts are recorded at import (05-07).
 *
 * These are exactly the three the Phase 5 blocks read, and the set is spelled
 * here in lower case because the comparison is: a folder spelled
 * `financial_data` classifies as the same supported category as
 * `Financial_data` and its files need the same facts.
 */
const PRESENCE_CATEGORIES: ReadonlySet<string> = new Set([
  'player_statistics',
  'financial_data',
  'payment_history',
]);

scope.onmessage = async (event: MessageEvent<IngestRequest>) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === 'ingest') {
    await handleIngest(msg.jobId, msg.file);
    return;
  }
  if (msg.type === 'check-cache') {
    await handleCheckCache(msg.jobId);
    return;
  }
  // DATA-02 + D-15/D-16: the persistent "Clear my cached data"
  // control AND the now-destructive Start Over button both end up
  // here. Wipe the IndexedDB cache atomically (the same transactional
  // discipline writeDataset uses — see db.ts RESEARCH.md Pitfall 4)
  // and acknowledge with a single 'cleared' message — the main thread
  // holds the confirm-pending state until this arrives.
  if (msg.type === 'clear-data') {
    await handleClearData(msg.jobId);
    return;
  }
  // D-06: the Activity_time charts ask for their numbers. Answered from the
  // aggregate stored on the meta record at import, so no rows are ever read
  // for a chart and no import is ever running on this path.
  if (msg.type === 'playtime-query') {
    await handlePlaytimeQuery(msg.queryId, msg.valueIndex);
    return;
  }
  // 05-07: the four Phase 5 blocks ask for their numbers the same way. Answered
  // ON DEMAND from the stored rows rather than from an aggregate on the meta
  // record: the builders are pure and the presence facts are recorded at
  // import, so there is nothing to precompute (CONTEXT Claude's discretion).
  if (msg.type === 'data-query') {
    await handleDataQuery(msg.queryId, msg.query);
    return;
  }
  // 06-09, ACTIVITY-07: the opt-in city container arrives here as BYTES. This
  // handler adds no network API — the file that might fetch is a main-thread
  // module, and `no-restricted-imports` keeps this directory from growing one.
  if (msg.type === 'city-load') {
    await handleCityLoad(msg.loadId, new Uint8Array(msg.buffer), msg.expectedBytes, msg.sha256);
    return;
  }
};

/**
 * Answer one `playtime-query` from the stored aggregate (D-06, D-02).
 *
 * Three outcomes, all on the same read:
 *   - nothing imported — `importedAt` and `view` both null, which is not the
 *     same statement as "imported, but this export has no session file"
 *   - a stored aggregate whose `v` is `PLAYTIME_VERSION` — the view
 *   - a stored aggregate that is absent, null or of an older version — the
 *     lazy backfill below
 *
 * ## Why a stale aggregate is rebuilt rather than refused
 *
 * A cache written before this build has no split in it, and a cache whose
 * aggregation threw at import has `playtime: null`. The rows are the dataset;
 * the aggregate is a derived convenience over them (T-04-03), so refusing to
 * answer would show the user an error for data the app still holds. What the
 * The aggregate may NOT do is be cast: an old one is rebuilt from the rows by the
 * same `buildPlaytimeFromSources` the import used, over the same per-file
 * grouping, so the numbers are the ones the current rules produce.
 *
 * ## Why the answer and its data come from ONE snapshot
 *
 * The rebuild reads meta and rows together in `readSessionRowData` and
 * answers with THAT snapshot's `importedAt`, never the `checkCache` one read
 * a moment earlier. A replace that lands between the two therefore cannot
 * produce an answer carrying the previous dataset's numbers under the new
 * dataset's date, and `writePlaytimeIfCurrent` refuses to store an aggregate
 * whose dataset is no longer the active one (T-04-11). A refused write costs
 * one recomputation; a mis-attached aggregate would cost the user their
 * numbers.
 *
 * A dataset with zero STORED SESSION ROWS cannot tell a missing file from a
 * header-only one, so its backfill reports `no-session-file`. New imports
 * record `sessionsFileSeen` from the parse loop and are exact.
 *
 * The detail on the error channel carries the error's name and message and
 * nothing else: no `jobId`, no error type beyond the name, and no row data
 * (T-04-01).
 */
async function handlePlaytimeQuery(queryId: number, valueIndex: number | null): Promise<void> {
  try {
    const meta = await checkCache();
    if (meta === null) {
      scope.postMessage({
        type: 'playtime-result',
        queryId,
        importedAt: null,
        view: null,
      } satisfies IngestResponse);
      return;
    }

    const stored = meta.playtime;
    if (stored != null && stored.v === PLAYTIME_VERSION) {
      scope.postMessage({
        type: 'playtime-result',
        queryId,
        importedAt: meta.importedAt,
        view: viewFromAggregates(stored, valueIndex),
      } satisfies IngestResponse);
      return;
    }

    const snapshot = await readSessionRowData();
    if (snapshot === null) {
      // The dataset was cleared between the two reads. That is the same
      // statement as "nothing imported", and it is what the user sees.
      scope.postMessage({
        type: 'playtime-result',
        queryId,
        importedAt: null,
        view: null,
      } satisfies IngestResponse);
      return;
    }

    const rebuilt = buildPlaytimeFromSources(snapshot.sources, snapshot.sources.length > 0);
    await writePlaytimeIfCurrent(snapshot.importedAt, rebuilt);
    scope.postMessage({
      type: 'playtime-result',
      queryId,
      importedAt: snapshot.importedAt,
      view: viewFromAggregates(rebuilt, valueIndex),
    } satisfies IngestResponse);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[ingest.worker] playtime-query failed', err);
    scope.postMessage({
      type: 'playtime-error',
      queryId,
      detail: `${e.name}: ${e.message}`,
    } satisfies IngestResponse);
  }
}

/**
 * Answer one `data-query` from ONE Dexie snapshot (05-07, T-05-19).
 *
 * The shape mirrors `handlePlaytimeQuery` and inherits its load-bearing rule:
 * the answer and the rows behind it come from the SAME read. `checkCache`
 * decides only whether anything is imported at all; the numbers and the date
 * the caller is told about both come from `readRowsByFile`'s snapshot. A
 * replace landing between the two reads therefore cannot produce an answer
 * carrying the previous dataset's numbers under the new dataset's date.
 *
 * ## Why a builder failure is this block's problem and not the import's
 *
 * The catch here answers with `data-error` and changes nothing else. A bug in
 * one builder costs that one block its numbers — the user sees an error in one
 * section, the dataset on screen is untouched, and a later query still works.
 * That is the same "a playtime bug must never cost the user their import"
 * discipline (T-04-03), applied to the query side.
 *
 * ## Why the detail is the error NAME only (T-05-20)
 *
 * A builder's message can echo a cell — `BigInt` on a non-numeric amount, a
 * decimal parser on a 200-character string — and Phase 3 D-21 keeps dataset
 * text off the screen and out of every outcome. The real error object goes to
 * the console, where it is a local debugging aid and never a message.
 */
async function handleDataQuery(queryId: number, query: DataQuery): Promise<void> {
  try {
    // T-05-18: the message is validated BEFORE anything reads it. A rejected
    // query never reaches a builder, and never reaches the channel table either
    // — `DATA_FILES[query.channel]` on an unknown channel would be undefined,
    // and the reader would then be handed undefined names.
    if (!isDataQuery(query)) {
      scope.postMessage({
        type: 'data-error',
        queryId,
        // FIXED, and the same for every malformed shape: the detail must not
        // echo the message that failed the check.
        detail: 'invalid query',
      } satisfies IngestResponse);
      return;
    }

    // 06-01, D-12: the login channel is answered from the META RECORD, not from
    // a row read, so it branches BEFORE the `DATA_FILES` lookup — and before
    // the memo, which it also has no use of. Two reasons, not one: the file
    // table has no `logins` entry by design (`DATA_FILES` is keyed by the
    // channels that read files, and `answerDataQuery` deliberately throws for
    // this one), and an answer read off the meta record is already a function of
    // the dataset it names, so there is nothing for the memo to save.
    if (query.channel === 'logins') {
      await answerLogins(queryId);
      return;
    }

    const meta = await checkCache();
    if (meta === null) {
      scope.postMessage({
        type: 'data-result',
        queryId,
        importedAt: null,
        result: null,
      } satisfies IngestResponse);
      return;
    }

    // The memo is consulted against the CURRENT meta's importedAt, so a hit is
    // by construction an answer for the dataset on screen. A hit therefore
    // skips the row read entirely — and still echoes the meta's own date, which
    // equals the entry's.
    const memoised = getDataQueryMemo(query, meta.importedAt);
    if (memoised !== null) {
      scope.postMessage({
        type: 'data-result',
        queryId,
        importedAt: memoised.importedAt,
        result: memoised.result,
      } satisfies IngestResponse);
      return;
    }

    const files = DATA_FILES[query.channel];
    const snapshot = await readRowsByFile(files.names, files.categories);
    if (snapshot === null) {
      // Cleared between the two reads — the same statement as "nothing
      // imported", and what the user sees.
      scope.postMessage({
        type: 'data-result',
        queryId,
        importedAt: null,
        result: null,
      } satisfies IngestResponse);
      return;
    }

    // Stored only after the builder SUCCEEDED, so a throwing builder leaves no
    // half-answer behind for a later query to find.
    const result = answerDataQuery(query, snapshot);
    setDataQueryMemo(query, snapshot.importedAt, result);
    scope.postMessage({
      type: 'data-result',
      queryId,
      importedAt: snapshot.importedAt,
      result,
    } satisfies IngestResponse);
  } catch (err) {
    console.error('[ingest.worker] data-query failed', err);
    scope.postMessage({
      type: 'data-error',
      queryId,
      // The NAME, never the message. `err` may be a non-Error thrown value,
      // in which case there is no name worth sending either.
      detail: err instanceof Error ? err.name : 'Error',
    } satisfies IngestResponse);
  }
}

/**
 * Answer one `logins` channel query from the stored aggregate (06-01, D-12).
 *
 * The single-key read, then three outcomes:
 *   - nothing imported — `importedAt` and `result` both null, which is not the
 *     same statement as "imported, but this export has no session file"
 *   - a stored aggregate that is CURRENT — the view, with the meta record's own
 *     `importedAt`
 *   - a stored aggregate that is ABSENT, null, of another `LOGINS_VERSION` or
 *     built against another `geoTableId()` — rebuilt from the stored rows
 *
 * ## Why the aggregate is never refused and never cast (T-04-03)
 *
 * A cache written before this build has no aggregate in it, and a cache whose
 * aggregation threw at import has `logins: null`. The rows are the dataset; the
 * aggregate is a derived convenience over them. So an old one is REBUILT by the
 * same `buildLogins` the import used, over the same per-file grouping, and the
 * numbers are the ones the current rules produce. Casting the old value instead
 * would show it with rules it was not built under, and refusing would show the
 * user an error for data the app still holds.
 *
 * ## Why the answer and its data come from ONE snapshot
 *
 * The rebuild reads meta and rows together in `readSessionRowData` and answers
 * with THAT snapshot's `importedAt`, never the `checkCache` one read a moment
 * earlier. A replace landing between the two therefore cannot produce an answer
 * carrying the previous dataset's numbers under the new dataset's date, and
 * `writeLoginsIfCurrent` refuses to store an aggregate whose dataset is no
 * longer the active one (T-06-03). Its boolean is IGNORED: a refused write
 * costs one recomputation, and the answer is already correct.
 *
 * A dataset with zero STORED SESSION ROWS cannot tell a missing file from a
 * header-only one, so its rebuild reports `no-source` — the same statement
 * playtime's backfill makes, and for the same reason. A fresh import records
 * `filesSeen` from the parse loop and is exact.
 *
 * ## Why the answer is read off the meta record at all (D-12)
 *
 * D-12 keeps the country lookup and the whole aggregation in the worker, at
 * import, so the main thread never loads a range table and never scans a row.
 * The `importedAt` echoed on the stored-aggregate path is the one read in the
 * SAME call as the aggregate, so a replace that lands between this answer and
 * the block that renders it is caught by the main thread's dataset stamp (the
 * D-28 discipline the other channels use) rather than by anything here.
 *
 * A throw anywhere below is caught by `handleDataQuery`, which answers
 * `data-error` carrying the error's NAME only (T-06-01): a name is a class name,
 * never a message, because a message from an aggregator can echo a cell.
 */
async function answerLogins(queryId: number): Promise<void> {
  const snapshot = await readLoginsSnapshot();
  if (snapshot === null) {
    // Nothing imported, or cleared between the two reads. That is the same
    // statement as "nothing imported", and it is what the user sees.
    scope.postMessage({
      type: 'data-result',
      queryId,
      importedAt: null,
      result: null,
    } satisfies IngestResponse);
    return;
  }
  scope.postMessage({
    type: 'data-result',
    queryId,
    importedAt: snapshot.importedAt,
    result: { channel: 'logins', view: snapshot.view },
  } satisfies IngestResponse);
}

/**
 * The listed addresses of the CURRENT dataset, and the `importedAt` they came
 * from (06-09).
 *
 * ## Why this is factored out of `answerLogins`
 *
 * The city view's `placeOf` is aligned to the logins view's `addresses`, so the
 * two have to be the same list from the same snapshot — and re-deriving the
 * list in a second handler is exactly the kind of duplication that shows up as
 * an off-by-one only after a rebuild, which is the rarer path. One read, one
 * list, two consumers.
 *
 * ## The same three outcomes as the login channel
 *
 * A stored aggregate that is CURRENT is used as it is; one that is absent, of
 * another `LOGINS_VERSION` or built against another `geoTableId()` is REBUILT
 * from the stored rows rather than refused or cast, for the reason
 * `answerLogins` states (T-04-03); and a cleared dataset is `null`, which is
 * the same statement as "nothing imported".
 *
 * `null` is also what a dataset with no usable login rows returns — `view` is
 * then `no-source` or `no-usable` and `addresses` is empty, so a city load
 * over it answers an empty view rather than a wrong one.
 *
 * The rebuilt aggregate is written back through `writeLoginsIfCurrent`, whose
 * boolean is deliberately not read: a refused write means a replace landed, and
 * the snapshot's answer is still the right answer for the dataset that was
 * asked about.
 */
async function readLoginsSnapshot(): Promise<{
  importedAt: string;
  view: LoginsView;
  addresses: readonly LoginAddress[];
} | null> {
  const meta = await checkCache();
  if (meta === null) return null;

  const stored = meta.logins;
  if (stored != null && stored.v === LOGINS_VERSION && stored.geo === geoTableId()) {
    const view = viewFromLogins(stored);
    return { importedAt: meta.importedAt, view, addresses: addressesOf(view) };
  }

  const snapshot = await readLoginRowData();
  if (snapshot === null) return null;

  // 06-05: `readLoginRowData` returns EVERY source the import used — both
  // session-file shapes AND the invented `Logins.csv`, each grouped per file
  // exactly as the import loop grouped it — plus the account pool and the
  // account root from the SAME snapshot. `readSessionRowData` screens the login
  // file out by name, so rebuilding through it would have dropped a whole
  // source the import had counted (RESEARCH Pitfall 10) and dropped the Account
  // record with it; a rebuild that answers fewer addresses than the import did
  // is a quiet disagreement nothing anywhere would report.
  const account = extractAccountRecord(snapshot.accountPool, snapshot.accountRoot);
  const rebuilt = buildLogins(snapshot.sources, lookupCountry, account);
  await writeLoginsIfCurrent(snapshot.importedAt, rebuilt);
  const view = viewFromLogins(rebuilt);
  return { importedAt: snapshot.importedAt, view, addresses: addressesOf(view) };
}

const EMPTY_ADDRESSES: readonly LoginAddress[] = [];

/** The listed addresses of a login view, or none when it has no data. */
function addressesOf(view: LoginsView): readonly LoginAddress[] {
  return view.status === 'ready' ? view.addresses : EMPTY_ADDRESSES;
}

/**
 * Answer one `city-load` with a city view for the current dataset (06-09,
 * ACTIVITY-07, D-15, D-16, T-06-33, T-06-34, T-06-35).
 *
 * ## The order, and why it is this order
 *
 * 1. Read the addresses. With no dataset there is nothing to resolve, and the
 *    answer is `importedAt: null, view: null` — the same shape every other
 *    channel uses for "nothing imported", so a main thread has one rule.
 * 2. Inflate, if the body is gzipped, under a size cap.
 * 3. Decode, requiring kind = city, for the FAMILIES the addresses contain.
 * 4. Resolve, build the view, answer, and let the table and the inflated buffer
 *    go out of scope.
 *
 * Step 3's families are what keeps an IPv4-only account from allocating 3.8
 * million IPv6 entries it can never look up (T-06-34). Step 4's locals are
 * scoped to this function precisely so nothing city-related is retained: there
 * is no module-level cache, because D-15 makes the data session-only and a
 * cached container would outlive the Clear the UI implies wipes everything.
 *
 * ## Why the answer echoes the snapshot, and is never cancelled
 *
 * A decode in flight is not cancellable, and that is deliberate: cancelling on a
 * replace would save nothing (the bytes are already in hand) and would risk a
 * partial view. The reply carries the `importedAt` of the snapshot it was built
 * from, so a replace that landed mid-decode produces an answer the main thread
 * DROPS by the D-28 stamp every other channel uses.
 *
 * ## Why the failure is one fixed string
 *
 * `detail` is {@link CITY_DATA_ERROR} and never the error's own message: these
 * bytes came off a network, and a message assembled from them is text a hostile
 * file chose (T-06-33, T-06-35). The real error object goes to the console.
 */
async function handleCityLoad(
  loadId: number,
  received: Uint8Array,
  expectedBytes: number,
  expectedSha256: string | null,
): Promise<void> {
  try {
    const snapshot = await readLoginsSnapshot();
    if (snapshot === null) {
      scope.postMessage({
        type: 'city-result',
        loadId,
        importedAt: null,
        view: null,
      } satisfies IngestResponse);
      return;
    }

    // The manifest is checked BEFORE a byte of the body is believed, and the
    // length is checked before the hash because it costs one comparison: a
    // body that disagrees with its own manifest about its size is refused
    // without decompressing any of it, which is the cheapest possible statement
    // of the same fact the inflate cap states (T-06-33).
    if (received.length !== expectedBytes) failCityData();
    if (expectedSha256 !== null) {
      // Hashed in the WORKER because the bytes are the worker's to answer with
      // and the result is the worker's to refuse on. The manifest's hash is of
      // the GZIPPED bytes — what the browser actually received — which is why
      // this runs before the inflate, not after it.
      if ((await digestFile(received)) !== expectedSha256) failCityData();
    }

    const families = familiesOf(snapshot.addresses);
    // `inflateIfGzip` caps the INFLATED size while streaming, which is the
    // check a gzip bomb needs. In production the body here is always the
    // gzipped file (the length and hash checks above are of the gzipped form,
    // so a host that decodes `Content-Encoding` is refused before this line); a
    // PLAIN body only reaches it from a caller with `sha256: null`, skips the
    // inflate and is bounded by the container reader's own
    // `MAX_CITY_TABLE_BYTES` a moment later. The
    // manifest's `bytes` is the gzipped size and so cannot bound the inflated
    // one — which is exactly why the cap above is a constant and not a number
    // read out of the manifest.
    const inflated = await inflateIfGzip(received);
    const table = decodeCityTable(inflated, families);
    const view = buildCityView(snapshot.addresses, table);
    scope.postMessage({
      type: 'city-result',
      loadId,
      importedAt: snapshot.importedAt,
      view,
    } satisfies IngestResponse);
  } catch (err) {
    console.error('[ingest.worker] city-load failed', err);
    scope.postMessage({
      type: 'city-error',
      loadId,
      detail: CITY_DATA_ERROR,
    } satisfies IngestResponse);
  }
}

/** The one refusal the manifest checks share, thrown rather than returned. */
function failCityData(): never {
  throw new Error(CITY_DATA_ERROR);
}

/**
 * Destructive-side counterpart of handleCheckCache: clear every row
 * and delete the 'active' meta record in one Dexie transaction, then
 * post a single 'cleared' message. The main thread is in
 * 'confirm-pending' state when this runs and transitions to 'idle'
 * (with the one-shot justCleared acknowledgment flag) on the
 * response. The single catch below routes any Dexie error through
 * the worker's existing structured 'error' channel — no parallel
 * error path for clear-data failures (mirrors handleCheckCache).
 */
async function handleClearData(jobId: number): Promise<void> {
  try {
    await clearData();
    // 05-07: a clear removes the dataset every remembered answer was computed
    // from. The importedAt check already refuses those, but emptying here is
    // what keeps the bound meaningful rather than full of dead entries.
    clearDataQueryMemo();
    scope.postMessage({ type: 'cleared', jobId } satisfies IngestResponse);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[ingest.worker] clear-data failed', err);
    scope.postMessage({
      type: 'error',
      jobId,
      detail: `${e.name}: ${e.message}`,
    } satisfies IngestResponse);
  }
}

/**
 * Return-visit auto-load from IndexedDB (D-07/D-08). Reads the active
 * meta record and posts a 'cache-status' with either the cached
 * ClassifyResult (the same shape 'done' / 'duplicate' carry — including
 * the per-status counts derived from `categories`) or `cached: null`
 * for a fresh page with no prior import. The single catch below routes
 * any Dexie read error through the worker's existing structured
 * 'error' channel — no parallel error path for cache-check failures
 * (mirrors the worker's single-error-handling convention).
 */
async function handleCheckCache(jobId: number): Promise<void> {
  try {
    const existing = await checkCache();
    scope.postMessage({
      type: 'cache-status',
      jobId,
      cached: existing ? resultFromMeta(existing) : null,
    } satisfies IngestResponse);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[ingest.worker] check-cache failed', err);
    scope.postMessage({
      type: 'error',
      jobId,
      detail: `${e.name}: ${e.message}`,
    } satisfies IngestResponse);
  }
}

/**
 * Build a `ClassifyResult` from a stored meta record — the ONE place the
 * two replay paths (`cache-status` on a return visit, `duplicate` on a
 * hash-identical re-drop) are constructed (D-20).
 *
 * Both replays read the same meta record and must therefore produce the
 * same object; when they were separate literals a field added to one and
 * not the other would surface as a page that renders a nickname after a
 * re-drop but not after a reload, which is exactly the kind of drift this
 * helper exists to prevent. It also guarantees the identity is served
 * straight off the meta record with no row query (D-20).
 *
 * ## Why every status is re-derived here (05-03, D-01, T-05-05)
 *
 * `meta.categories[].status` is a CACHE OF A CLASSIFICATION, not a fact
 * about the export. A record written by an older build therefore carries
 * statuses that are now wrong — concretely, `Financial_data: unknown`,
 * stored before Phase 5 promoted it to supported, while its rows sit
 * happily in the `rows` table because the worker has always parsed every
 * category regardless of status. Reading that stored label back would tell
 * a returning user "Not in this export" for a folder they demonstrably
 * have, and list it under "Not yet supported".
 *
 * So the status is recomputed from the stored NAME with `classifyFolder`
 * — the same call `analyzeExport` makes — and the list is re-sorted with
 * the same comparator, because a status change moves an entry between
 * groups and a repaired list left in the old order would show the folder
 * still sitting among the unknown ones.
 *
 * `counts` is derived AFTER the remap, never before: counting first would
 * report `supported: 4` over a list whose five entries all say supported.
 *
 * ## Why this is NOT a Dexie version bump
 *
 * The rows are valid and only a derived label is stale. `version(3)` with
 * an `upgrade` callback would discard a returning user's cached dataset —
 * their imported-at timestamp, their identity, every parsed row — to fix a
 * word. Re-deriving at read time is backward safe by construction: it
 * costs one `classifyFolder` call per stored category on a page load that
 * already read the whole meta record, and it cannot lose data because it
 * writes nothing. `db.verno` therefore stays 2 and the `version(2)`
 * upgrader is untouched (db.ts's two-rules comment still holds).
 */
function resultFromMeta(meta: DatasetMeta): ClassifyResult {
  const categories = sortCategoryEntries(
    meta.categories.map((entry) => ({ ...entry, status: classifyFolder(entry.name) })),
  );
  return {
    accountRoot: meta.accountRoot,
    categories,
    counts: recomputeStatusCounts(categories),
    importedAt: meta.importedAt,
    identity: meta.identity ?? null,
  };
}

async function handleIngest(jobId: number, file: File): Promise<void> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    // SC3: hash BEFORE any unzip work. The dedup gate posts
    // 'duplicate' (D-12) and returns without ever calling
    // listEntryPaths / unzipSync.
    scope.postMessage({ type: 'stage', jobId, stage: 'hashing' } satisfies IngestResponse);
    const hash = await digestFile(bytes);
    const existing = await checkCache();
    if (existing && existing.hash === hash) {
      scope.postMessage({
        type: 'duplicate',
        jobId,
        result: resultFromMeta(existing),
      } satisfies IngestResponse);
      return;
    }

    scope.postMessage({ type: 'stage', jobId, stage: 'unzipping' } satisfies IngestResponse);
    const entryNames = listEntryPaths(bytes);

    scope.postMessage({ type: 'stage', jobId, stage: 'classifying' } satisfies IngestResponse);
    const outcome = analyzeExport(entryNames);
    if (!outcome.ok) {
      throw new Error(`unrecognized export: ${outcome.reason} (${entryNames.length} entries)`);
    }

    // Per-category parse loop (D-01: every category, every status;
    // D-11: per-category progress; IMPORT-01: all in the worker).
    const recognized = new Set(outcome.result.categories.map((c) => c.name));
    const inflated = unzipSync(bytes, {
      filter(info) {
        return resolveCsvFileCategory(info.name, outcome.result.accountRoot, recognized) !== null;
      },
    });

    const allRows: DatasetRow[] = [];
    const updatedCategories: CategoryEntry[] = [];
    // Sanitised User_Info rows kept aside for the identity pick, split by
    // which file they came from: Account_Info.csv is the file that actually
    // carries NAME/REGION/CREATED_AT, so its rows win when there are any
    // (D-17's "prefer the account row" ordering). Both pools are already
    // sanitised, so extractIdentity cannot see a stripped column.
    const accountInfoRows: Record<string, string | undefined>[] = [];
    const otherUserInfoRows: Record<string, string | undefined>[] = [];
    // D-02: the session rows go to the playtime aggregator as well as to the
    // rows table, one SOURCE per session file. The flag is set per FILE, before
    // the row loop, because a header-only session file parses to zero rows and a
    // flag set inside the loop would stay false — which would report a file that
    // exists as an export that has none, and the UI copy treats those
    // differently.
    //
    // One source per file, and not one flat list, because each file has its own
    // HEADER: the synthetic `Sessions.csv` says `SESSION_START` while a real
    // `WOT_Game_Sessions.csv` says `STARTED_AT`, and an export can hold both.
    // The aggregator resolves the columns per source, so a flat list would
    // silently exclude every row of all but the first file.
    const sessionSources: SessionSource[] = [];
    let sessionsFileSeen = false;
    // 06-01, D-12: the SAME row objects are offered to the login aggregator
    // beside the playtime one. It is a second `LoginSource` holding the SAME
    // `rows` array reference, never a copy: a second aggregation over a
    // 71,000-row export then costs a second pass rather than a second copy of
    // every row in memory.
    //
    // It is a SEPARATE collection rather than a field on `SessionSource` because
    // the two aggregators read different columns and a source that one of them
    // cannot use must not become a source for the other. `playtime-aggregate.ts`
    // is not edited, and its guarantee that the `IP` column is never read
    // (T-04-01) stays true.
    const loginSources: LoginSource[] = [];
    // 05-07: one presence fact per file of the three categories this phase
    // reads, pushed BEFORE the row loop for the same reason the session flag
    // is set there — a header-only file parses to zero rows, and a fact set
    // inside the loop would never be recorded for exactly the file whose
    // presence the fact exists to prove (D-02, D-05).
    const presenceFiles: DatasetFile[] = [];
    const categoryTotal = outcome.result.categories.length;
    for (let i = 0; i < categoryTotal; i++) {
      const entry = outcome.result.categories[i]!;
      const progress: ParsingProgress = {
        category: entry.name,
        categoryIndex: i + 1,
        categoryTotal,
      };
      scope.postMessage({
        type: 'stage',
        jobId,
        stage: 'parsing',
        progress,
      } satisfies IngestResponse);

      // Case-insensitive on purpose: a `user_info` folder classifies as the
      // same supported category and would otherwise skip the strip
      // entirely (D-18, identity.ts isUserInfoCategory).
      const userInfo = isUserInfoCategory(entry.name);

      let rowCount = 0;
      let skippedRowCount = 0;
      for (const [rawName, fileBytes] of Object.entries(inflated)) {
        const resolved = resolveCsvFileCategory(rawName, outcome.result.accountRoot, recognized);
        if (!resolved || resolved.category !== entry.name) continue;
        const text = new TextDecoder('utf-8').decode(fileBytes);
        const parsed = parseCsvFile(text, entry.name, resolved.sourceFile);
        const game = sessionFileGame(entry.name, resolved.sourceFile);
        const isSessions = game !== null || isSessionsRow(entry.name, resolved.sourceFile);
        // 06-05, D-01: the invented `Logins.csv` is a THIRD source kind, beside
        // the two session-file shapes. It reaches the login aggregator and
        // nothing else — not the playtime one, whose module states that the `IP`
        // column is never read (T-04-01) — which is why the screen is a
        // separate predicate rather than a third shape `isSessionsRow` accepts.
        const isLoginsFile = isLoginsRow(entry.name, resolved.sourceFile);
        // The source is created BEFORE the row loop, for the same reason the
        // flag is set there: a header-only session file has no rows to create
        // one from, and it still has to appear as a file that was seen.
        //
        // Its `rows` is a mutable array for the length of the loop and is
        // typed as `SessionSource` — whose `rows` is readonly — the moment the
        // loop is done, so no consumer can append to it afterwards.
        const rows: SessionRow[] = [];
        const source: SessionSource = { game, rows };
        if (isSessions) {
          sessionsFileSeen = true;
          sessionSources.push(source);
          // The SAME before-the-loop rule, for the same reason: a header-only
          // session file has no rows to build a source from, and it still has to
          // reach the login aggregator as a file that was SEEN — that fact is
          // the only difference between `no-source` and `no-usable`.
          loginSources.push({ game, kind: 'sessions', rows });
        }
        // 06-05, D-01: the same before-the-loop rule for the `Logins.csv`. Its
        // source is pushed with `game: null` and SHARES the `rows` array, so a
        // header-only login file is still a file that was SEEN — the only
        // difference between `no-source` and `no-usable` — and a 2,000-row file
        // is never copied to be offered to a second aggregator.
        if (isLoginsFile) {
          loginSources.push({ game: null, kind: 'logins', rows });
        }
        // Same before-the-loop rule, for the same reason. The category is
        // matched LOWER-CASED because a folder spelled `player_statistics`
        // classifies as the same supported category (D-18) and its files are
        // exactly the ones these blocks need presence for. The cap bounds a
        // crafted archive (T-05-21): past it the facts stop, the rows do not.
        if (
          presenceFiles.length < MAX_PRESENCE_FILES &&
          PRESENCE_CATEGORIES.has(entry.name.toLowerCase())
        ) {
          presenceFiles.push({
            category: entry.name,
            sourceFile: resolved.sourceFile,
            rowCount: parsed.rows.length,
          });
        }
        for (let r = 0; r < parsed.rows.length; r++) {
          // THE single choke point every row passes through. Dropping the
          // three sensitive User_Info columns here — rather than at the
          // Dexie write — is what makes the guarantee airtight: a row that
          // is never pushed cannot be persisted, and the raw parsed object
          // stays inside this loop.
          const data = userInfo ? sanitizeUserInfoRow(parsed.rows[r]!.data) : parsed.rows[r]!.data;
          allRows.push({
            category: entry.name,
            sourceFile: resolved.sourceFile,
            rowIndex: rowCount + r,
            data,
          });
          // The aggregator reads four named columns off this reference and
          // keeps nothing else, so handing it the SAME object costs no copy
          // and cannot change what is persisted (T-04-01).
          //
          // 06-05: a `Logins.csv` row goes into the SAME array even though the
          // playtime aggregator never sees the source — the array is filled
          // before the `rows.push` is qualified, and what decides who may READ
          // it is which collection the source was pushed into above. Filling it
          // only for `isSessions` would hand the login aggregator an EMPTY
          // source and report a file that contributed nothing.
          if (isSessions || isLoginsFile) rows.push(data);
          if (userInfo) {
            const isAccountInfo = resolved.sourceFile.toLowerCase().endsWith('account_info.csv');
            (isAccountInfo ? accountInfoRows : otherUserInfoRows).push(data);
          }
        }
        rowCount += parsed.rows.length;
        skippedRowCount += parsed.skippedCount;
      }
      updatedCategories.push({
        ...entry,
        rowCount,
        skippedRowCount,
      });
    }

    // D-17/D-20: three fields, or null when no User_Info row parsed at all
    // (the D-16 fallback trigger). Never logged (D-21).
    const identity = extractIdentity(
      accountInfoRows.length > 0 ? accountInfoRows : otherUserInfoRows,
      outcome.result.accountRoot,
    );

    // 06-05, D-02: the one labelled "Account record" row, read from the SAME
    // sanitised pool and with the SAME account root as the identity pick, so
    // the two describe one account and neither can be handed an email or a
    // birth date. It is not a login: `buildLogins` stores it and never counts
    // it, so the account's own address is in no total, no country figure and
    // no `unknown` bucket.
    const account = extractAccountRecord(
      accountInfoRows.length > 0 ? accountInfoRows : otherUserInfoRows,
      outcome.result.accountRoot,
    );

    scope.postMessage({ type: 'stage', jobId, stage: 'writing' } satisfies IngestResponse);
    // T-04-03: a playtime bug must never cost the user their import. The
    // aggregate is a derived convenience — the rows are the dataset — so a
    // throw here logs the error object (never row contents) and the import
    // finishes with no stored aggregate, which a later query reports as an
    // error rather than as zero playtime.
    let playtime = null;
    try {
      playtime = buildPlaytimeFromSources(sessionSources, sessionsFileSeen);
    } catch (err) {
      console.error('[ingest.worker] playtime aggregation failed', err);
    }
    // 06-01, D-12 + T-04-03 restated: a login-aggregation bug must never cost
    // the user their import either. Its OWN try/catch, the same discipline, for
    // the same reason: the rows are the dataset and the aggregate is derived,
    // so a throw here logs the error OBJECT (never a cell — T-06-01) and the
    // import finishes with no stored aggregate, which a later query reports as
    // an error rather than as "this account has no logins".
    let logins = null;
    try {
      logins = buildLogins(loginSources, lookupCountry, account);
    } catch (err) {
      console.error('[ingest.worker] login aggregation failed', err);
    }
    const { importedAt } = await writeDataset(
      hash,
      outcome.result.accountRoot,
      updatedCategories,
      allRows,
      identity,
      playtime,
      // 05-07: the presence facts ride in the SAME meta.put as the rows, so a
      // dataset is either all rows with their facts or neither. A fact without
      // its rows would be exactly the state a `no-rows` claim is made of.
      presenceFiles,
      // 06-01: the login aggregate rides in that same `meta.put`, for the same
      // reason — an aggregate without its rows is a claim about data the
      // dataset does not hold.
      logins,
    );
    // 05-07: a successful import REPLACED the dataset, so every remembered
    // answer belongs to a dataset the user is no longer looking at.
    clearDataQueryMemo();

    const finalResult: ClassifyResult = {
      ...outcome.result,
      categories: updatedCategories,
      importedAt,
      identity,
    };
    scope.postMessage({ type: 'done', jobId, result: finalResult } satisfies IngestResponse);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[ingest.worker] ingest failed', err);
    scope.postMessage({
      type: 'error',
      jobId,
      detail: `${e.name}: ${e.message}`,
    } satisfies IngestResponse);
  }
}

/**
 * Re-derive the per-status count from a category list (matches
 * `analyzeExport`'s internal reduce; kept inline here so the
 * duplicate response carries the same `counts` shape the `done`
 * response produces).
 */
function recomputeStatusCounts(
  categories: readonly CategoryEntry[],
): Record<'supported' | 'known-deferred' | 'unknown', number> {
  const out: Record<'supported' | 'known-deferred' | 'unknown', number> = {
    supported: 0,
    'known-deferred': 0,
    unknown: 0,
  };
  for (const c of categories) {
    if (CATEGORY_STATUS_ORDER.includes(c.status)) out[c.status] += 1;
  }
  return out;
}

// Signal to the main thread that the worker script has finished loading
// and is ready to receive ingest requests. This is the handshake that
// proves the worker was spawned eagerly at app init (Pitfall 3 in RESEARCH).
scope.postMessage({ type: 'ready' } satisfies IngestResponse);
