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
import { analyzeExport, resolveCsvFileOwner, sortCategoryEntries } from './classify.ts';
import { CATEGORY_STATUS_ORDER, classifyFolder } from './categories.ts';
import { listEntryPaths } from './zip-paths.ts';
import { createInflateFilter } from './inflate-bounds.ts';
import { digestFile } from './hash.ts';
import { parseCsvFile } from './csv-parse.ts';
import {
  fileMatchesSpec,
  isFamilyCategory,
  isNewDataFile,
  projectRow,
  specFor,
} from './new-data-allowlist.ts';
import { newDataPaneFacts } from './new-data-facts.ts';
import {
  extractAccountRecord,
  extractIdentity,
  hasSensitiveColumn,
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
import { PLAYTIME_VERSION, isGameToken } from '../features/playtime/playtime-shared.ts';
import {
  hasBlobColumn,
  isDeviceInfoCategory,
  reduceBlobRow,
} from '../features/device-info/device-info-aggregate.ts';
import { DEVICE_INFO_CATEGORY } from '../features/device-info/device-info-shared.ts';
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
  narrowStoredNewDataRows,
  purgeUnsupportedCategoryRows,
  readLoginRowData,
  readRowsByFile,
  readSessionRowData,
  writeDataset,
  writeLoginsIfCurrent,
  writePlaytimeIfCurrent,
  type AccountMeta,
  type DatasetFile,
  type DatasetMeta,
  type DatasetRow,
  type RowsSnapshot,
} from './db.ts';
import {
  accountSummariesOf,
  accountsOfMeta,
  sortAccounts,
  summarizeSessionSources,
} from './account-summary.ts';

const scope = self as unknown as WorkerScopeLike;

/**
 * The categories whose per-file presence facts are recorded at import (05-07).
 *
 * These are the three the Phase 5 blocks read plus `device_info` (quick task
 * 261012-bog: the Device info pane tells a missing file from an empty one), and
 * the set is spelled here in lower case because the comparison is: a folder
 * spelled `financial_data` classifies as the same supported category as
 * `Financial_data` and its files need the same facts.
 *
 * Phase 11, D-09: this set is NOT the whole rule. A new-game FAMILY file in a
 * supported category records a fact too, whatever folder it is filed under —
 * which is how `HEAT_Session_Geolocation.csv` and the HEAT session files get
 * one without `activity_history` being added here and start recording a fact
 * for every WoT session file (11-RESEARCH Pitfall 4). The extra half lives in
 * the push, beside the family decision it reads, so the two cannot drift.
 */
const PRESENCE_CATEGORIES: ReadonlySet<string> = new Set([
  'player_statistics',
  'financial_data',
  'payment_history',
  DEVICE_INFO_CATEGORY,
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
    await handlePlaytimeQuery(msg.queryId, msg.valueIndex, msg.game);
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
 * Answer one `playtime-query` from the stored aggregate (D-06, D-02, D-21).
 *
 * Three outcomes, all on the same read:
 *   - nothing imported — `importedAt` and `view` both null, which is not the
 *     same statement as "imported, but this export has no session file"
 *   - a stored aggregate whose `v` is `PLAYTIME_VERSION` — the view
 *   - a stored aggregate that is absent, null or of an older version — the
 *     lazy backfill below
 *
 * ## The game dimension, and the one place it is validated (D-21, T-10-01)
 *
 * The answer has an optional game dimension: `msg.game` names one stored
 * per-game scope instead of the all-games one, and the view carries the token
 * list so the main thread can render a filter without a second query.
 *
 * `msg.game` is a `postMessage` field this worker did not author, so it is
 * validated ONCE, here, with `isGameToken` — a strict anchored predicate that
 * cannot throw. Anything that is not a token (a number, a lower-case string, a
 * 25-character string, an object, absent) degrades to All. The RAW value is
 * never copied into a reply, in either branch: a rejected token is not even
 * echoed back as itself, so a hostile string cannot reach a reply and from
 * there a Svelte template. A token that IS valid but that no usable session
 * carries answers `no-game-sessions`, carrying only the stored token list.
 *
 * ## Why a stale aggregate is rebuilt rather than refused
 *
 * A cache written before this build has no split in it, and a cache whose
 * aggregation threw at import has `playtime: null`. The rows are the dataset;
 * the aggregate is a derived convenience over them (T-04-03), so refusing to
 * answer would show the user an error for data the app still holds. What the
 * aggregate may NOT do is be cast: an old one is rebuilt from the rows by the
 * same `buildPlaytimeFromSources` the import used, over the same per-file
 * grouping, so the numbers are the ones the current rules produce. `v: 2` is
 * exactly the shape that case now takes, since 3 added the per-game scopes.
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
async function handlePlaytimeQuery(
  queryId: number,
  valueIndex: number | null,
  game?: string | null,
): Promise<void> {
  // The one validation, above the two branches, so the stored and the rebuilt
  // path cannot answer a game question differently.
  const wanted = isGameToken(game) ? game : null;
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
        view: viewFromAggregates(stored, valueIndex, wanted),
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
      view: viewFromAggregates(rebuilt, valueIndex, wanted),
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
 * The snapshot the `overview` channel answers from, with a CURRENT playtime
 * aggregate (13-01, D-01, T-13-04).
 *
 * ## Why the aggregate may need a second read
 *
 * The aggregate rides the rows' own transaction, so the answer and its rows
 * can never describe two different datasets. A stored aggregate whose `v` is
 * not `PLAYTIME_VERSION` is STALE — it was built under rules this build no
 * longer uses — and it is rebuilt from the stored session rows by the same
 * `buildPlaytimeFromSources` the import used, so the numbers are the ones the
 * current rules produce.
 *
 * ## Why a rebuild that lands on another dataset answers NOTHING (T-04-11)
 *
 * The rebuild reads the session rows in a second transaction, so a replace can
 * land between the two reads. When it does, the rows belong to a dataset the
 * user is no longer looking at, and answering with them would show one
 * export's numbers under another's date. So a mismatched `importedAt` answers
 * null — the same statement as "nothing imported" — and writes nothing. The
 * write-back goes through `writePlaytimeIfCurrent` for the same reason: a
 * refused write costs one recomputation, and a mis-attached aggregate would
 * cost the user their numbers.
 *
 * Returns null for "answer with `importedAt: null` and no result", which is
 * the one statement true both of a cleared dataset and of a replaced one.
 */
async function withCurrentPlaytime(snapshot: RowsSnapshot): Promise<RowsSnapshot | null> {
  const stored = snapshot.playtime;
  if (stored != null && stored.v === PLAYTIME_VERSION) return snapshot;

  const sessionData = await readSessionRowData();
  // Null: the dataset was cleared between the two reads.
  if (sessionData === null) return null;
  // A different date: a replace landed between the two reads.
  if (sessionData.importedAt !== snapshot.importedAt) return null;

  const rebuilt = buildPlaytimeFromSources(sessionData.sources, sessionData.sources.length > 0);
  // The boolean is IGNORED on purpose: a refused write means a replace landed
  // between the read and the write, and the answer below is already correct.
  await writePlaytimeIfCurrent(snapshot.importedAt, rebuilt);
  return { ...snapshot, playtime: rebuilt };
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

    // 13-01, D-01. The `overview` channel needs the playtime aggregate, and
    // the aggregate rides the rows' own transaction — unless it is stale or
    // absent, in which case it is rebuilt from the stored session rows. A
    // rebuild that finds another dataset answers nothing at all, because a
    // snapshot's rows and an aggregate from another dataset would be one
    // answer describing two exports (T-13-04).
    const withPlaytime =
      query.channel === 'overview' ? await withCurrentPlaytime(snapshot) : snapshot;
    if (withPlaytime === null) {
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
    const result = answerDataQuery(query, withPlaytime);
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
    // D-21, FIRST: a cache written by a build that stored rows of categories
    // this build does not support is cleaned before the page is told what is
    // cached, so `cache-status` describes a dataset whose rows are already
    // clean. The ready handshake posts this on every page load and the duplicate
    // branch of `handleIngest` only replays a record this handler already read,
    // so this is the ONE entry for a returning cache.
    //
    // No catch of its own, deliberately: a failed purge must route to the same
    // error channel as a failed cache read rather than report a clean load
    // while the rows remain.
    await purgeUnsupportedCategoryRows();
    // Phase 11, D-14: and then the NEW-GAME rows a cache written before the
    // per-file column allowlist still holds in full. Same placement and the same
    // discipline — before the cache is described, with no catch of its own, so a
    // failed narrowing reports an error rather than a clean load while the
    // un-narrowed rows (and the WOWP account rows' nickname-like NAME) remain.
    // The two steps are independent: one judges a row by its CATEGORY, the other
    // by its file NAME and the spec filed under its own category.
    await narrowStoredNewDataRows();
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
  // Bound once: the published list and the root count of one result must come
  // from one read of the stored list (09-11).
  const storedAccounts = accountsOfMeta(meta);
  const categories = sortCategoryEntries(
    meta.categories.map((entry) => ({ ...entry, status: classifyFolder(entry.name) })),
  );
  return {
    accountRoot: meta.accountRoot,
    categories,
    counts: recomputeStatusCounts(categories),
    importedAt: meta.importedAt,
    identity: meta.identity ?? null,
    // D-08/D-22 + 09-10: the ONE place a replay builds its account list, so
    // `done`, `duplicate` and `cache-status` cannot drift apart. A cache written
    // before Phase 9 normalises to a one-entry list here rather than to none,
    // and the projection is the same one the import's `done` payload uses — the
    // count the header shows after a reload is the count it showed at import.
    accounts: accountSummariesOf(storedAccounts),
    // 09-11: the folders the archive held, data-less ones included, derived from
    // the same list as `accounts` above. The import's `finalResult` sets the same
    // figure; edit the pair together.
    rootCount: storedAccounts.length,
    // 11-04, D-09: the new-game panes' file and row counts, from the stored
    // presence list. The import's `finalResult` publishes the same figure from
    // the same function; edit the pair together. INTEGERS ONLY (T-11-14).
    newDataPanes: newDataPaneFacts(meta.files),
  };
}

/**
 * One inflated CSV entry with the account that OWNS it (Phase 9, D-06).
 *
 * The resolution happened once, in the loop that grouped the inflated entries
 * by category; this is the result of that resolution plus the bytes, so the
 * parse loop cannot reach a different owner than the inflate filter did.
 */
interface OwnedFile {
  root: string;
  sourceFile: string;
  bytes: Uint8Array;
}

/** One account's running row counts for one category (D-08). */
interface CategoryCounts {
  rowCount: number;
  skippedRowCount: number;
}

/**
 * Everything the import collects for ONE account root (Phase 9, D-07 to D-09,
 * D-17).
 *
 * ## Why this exists rather than five parallel arrays
 *
 * The import reads every root's files through ONE loop, so each of these needs
 * a per-account home: the identity pool, the presence facts, the session
 * sources, and the per-category counts that become that account's stored
 * category list. Keeping them in one object makes "which account does this row
 * belong to" a single lookup instead of five parallel keyed structures that
 * could disagree about the owner.
 *
 * ## Why every member is a Map or an array, and none is a plain object
 *
 * A root may be named `__proto__` or `constructor` (T-09-04), and a plain
 * object keyed by a root name would return `Object.prototype` for one of them —
 * so a root's "session sources" would read as a prototype object and its rows
 * would be attributed to a sibling, or the import would throw. Maps and arrays
 * have no such member.
 */
interface RootState {
  /** Sanitised rows of `Account_Info.csv` files, which win the identity pick. */
  accountInfoRows: Record<string, string | undefined>[];
  /** Sanitised rows of every OTHER User_Info-family file (the fallback pool). */
  otherUserInfoRows: Record<string, string | undefined>[];
  /** This account's own presence facts, capped per account (T-05-21). */
  presenceFiles: DatasetFile[];
  /** This account's own session sources, for D-14 games and D-15 years. */
  sessionSources: SessionSource[];
  /**
   * How many rows this account STORED (09-10, `accountCountSemantics: option-a`).
   *
   * A count and not a boolean because the rule is "stored at least one row in a
   * supported category" — and a `User_Info` row is such a row, so the identity
   * pools need no separate term. It is the one fact about this root that no
   * summary can answer after the fact: a root whose sessions all failed to parse
   * looks exactly like a root that was never there.
   */
  storedRows: number;
  /** This account's running counts, per CATEGORY NAME as the archive spells it. */
  readonly counts: Map<string, CategoryCounts>;

  /**
   * The running counts for one category of this account, created on first use.
   *
   * Created rather than pre-seeded from `analyzeExport`'s category list because
   * a category can legitimately hold zero files for this root: pre-seeding
   * would then have to guess 0/0, and a getter would need a null branch on
   * every read of the parse loop's hot path.
   */
  categoryCounts(name: string): CategoryCounts;
}

/** A fresh, empty per-account state. */
function newRootState(): RootState {
  const counts = new Map<string, CategoryCounts>();
  return {
    accountInfoRows: [],
    otherUserInfoRows: [],
    presenceFiles: [],
    sessionSources: [],
    storedRows: 0,
    counts,
    categoryCounts(name: string): CategoryCounts {
      let entry = counts.get(name);
      if (entry === undefined) {
        entry = { rowCount: 0, skippedRowCount: 0 };
        counts.set(name, entry);
      }
      return entry;
    },
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
    // Phase 9 D-06: the ONE root set every per-entry resolution goes through.
    // `analyzeExport` already resolved each entry to a root; re-resolving with
    // the same set is what makes the inflate filter and the per-category counts
    // agree about WHICH account a file belongs to. A set, because a root may be
    // named `__proto__` and an object literal would collide with
    // `Object.prototype` (T-09-04).
    const rootNames = new Set(outcome.roots.map((r) => r.root));
    // WR-03 / T-01-52: the entries this selects are the ones fflate inflates,
    // and it allocates from the DECLARED size first. The filter therefore
    // enforces the declared-size caps (inflate-bounds.ts) and a rejected archive
    // lands in the single catch below like any other failure (D-04, D-05, D-07).
    // One filter per import: its running total must not outlive the archive.
    const inflated = unzipSync(bytes, {
      filter: createInflateFilter(
        (name) => resolveCsvFileOwner(name, rootNames, recognized) !== null,
      ),
    });

    // Every inflated entry is resolved EXACTLY ONCE, here, and grouped by the
    // category it belongs to. The category loop below then reads its own group
    // instead of re-walking every entry for every category, which is both the
    // cost bound the plan asks for and the structural reason the filter and the
    // counts cannot disagree: they are two consumers of one resolution.
    //
    // The group preserves INFLATED ORDER within a category, which is the order
    // the previous `Object.entries(inflated)` scan saw, so row indexes and file
    // order are unchanged for a one-account export.
    const filesByCategory = new Map<string, OwnedFile[]>();
    for (const [rawName, fileBytes] of Object.entries(inflated)) {
      const resolved = resolveCsvFileOwner(rawName, rootNames, recognized);
      if (!resolved) continue;
      const group = filesByCategory.get(resolved.category);
      const owned: OwnedFile = {
        root: resolved.root,
        sourceFile: resolved.sourceFile,
        bytes: fileBytes,
      };
      if (group === undefined) filesByCategory.set(resolved.category, [owned]);
      else group.push(owned);
    }

    const allRows: DatasetRow[] = [];
    const updatedCategories: CategoryEntry[] = [];
    // Per-root state (Phase 9, D-07/D-08/D-17). A Map keyed by the root name,
    // never a plain object: a root may be literally `__proto__` or
    // `constructor` (T-09-04).
    const byRoot = new Map<string, RootState>();
    for (const root of rootNames) byRoot.set(root, newRootState());
    const stateOf = (root: string): RootState => {
      const existing = byRoot.get(root);
      // A resolution can only name a root from `rootNames`, so this is the
      // belt-and-braces branch rather than an expected path — and it fails LOUD
      // (a throw into the single catch) instead of silently dropping an
      // account's rows into a shared bucket.
      if (existing !== undefined) return existing;
      const created = newRootState();
      byRoot.set(root, created);
      return created;
    };
    // D-02: the session rows go to the playtime aggregator as well as to the
    // rows table, one SOURCE per session file, ACROSS every account — playtime
    // stays ONE aggregate over the whole dataset (D-09). The flag is set per
    // FILE, before the row loop, because a header-only session file parses to
    // zero rows and a flag set inside the loop would stay false — which would
    // report a file that exists as an export that has none, and the UI copy
    // treats those differently.
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
      //
      // This flag is NOT the strip guarantee (CR-01 layer 2). The header test
      // at the row choke point below is: it sanitises any row that carries a
      // deny-listed column wherever the file was filed. The folder test now
      // decides only two things: the always-sanitise family (the overflow
      // bucket goes too, even for a row with no deny-listed header) and which
      // rows may feed the identity pick and the Account record, so a misfiled
      // copy never changes what the header shows.
      const userInfo = isUserInfoCategory(entry.name);
      // The Device_info family (case-insensitive, for the same reason). It
      // decides one thing: whether a row that carries the Assistant `POST`
      // header is reduced at the choke point below.
      const deviceInfo = isDeviceInfoCategory(entry.name);
      // Phase 9 D-18: rows of an UNKNOWN or KNOWN-DEFERRED category are parsed
      // for their counts and never stored. The counts are not decoration — the
      // "Not yet supported" pane tells the user how many rows a folder they
      // hold actually has, and that sentence must survive the skip.
      //
      // Why it has to be a skip rather than a strip. The real sample's
      // `Game_Forums/WOT_Forum_User_Info.csv` carries `EMAIL`, `IP_ADDRESS`
      // and `BDAY_DAY`/`BDAY_MONTH`/`BDAY_YEAR`, and `Chat_History` carries
      // `MESSAGE_BODY`. None of those columns is on the three-column D-19
      // deny-list, so a per-column strip would have to grow to hold them — and
      // a deny-list that grows with every new folder shape is the same
      // catch-all this rule exists to close. Promoting a category later
      // (Phase 11 / 12, PRIV-01) stores its rows again behind its OWN
      // header-level strip, one category at a time.
      //
      // Decided from the CATEGORY, not from the file's folder name, so the
      // classifier's own answer is the single thing both the counts and this
      // skip read.
      const storeRows = entry.status === 'supported';

      let rowCount = 0;
      let skippedRowCount = 0;
      for (const file of filesByCategory.get(entry.name) ?? []) {
        const resolved = { root: file.root, category: entry.name, sourceFile: file.sourceFile };
        const root = stateOf(resolved.root);
        // This root's OWN running counts for THIS category. `rowIndex` restarts
        // per account and category, which is what makes the adjacency case real:
        // the same source file from several accounts is stored with the same
        // indexes, so nothing may key on (sourceFile, rowIndex) alone (D-12).
        const own = root.categoryCounts(entry.name);
        const text = new TextDecoder('utf-8').decode(file.bytes);
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
          // The owning account's OWN sources, for D-15's per-account years and
          // D-14's per-account games. The SAME array reference as the global
          // list, so the aggregate and the summary cannot disagree about a row.
          root.sessionSources.push(source);
          // The SAME before-the-loop rule, for the same reason: a header-only
          // session file has no rows to build a source from, and it still has to
          // reach the login aggregator as a file that was SEEN — that fact is
          // the only difference between `no-source` and `no-usable`.
          loginSources.push({ game, kind: 'sessions', rows, account: resolved.root });
        }
        // 06-05, D-01: the same before-the-loop rule for the `Logins.csv`. Its
        // source is pushed with `game: null` and SHARES the `rows` array, so a
        // header-only login file is still a file that was SEEN — the only
        // difference between `no-source` and `no-usable` — and a 2,000-row file
        // is never copied to be offered to a second aggregator.
        if (isLoginsFile) {
          loginSources.push({ game: null, kind: 'logins', rows, account: resolved.root });
        }
        // Phase 11 (D-08), restated at the top of the loop so the fact below can
        // count STORED rows: the file-level SKIP for a new-game file, decided
        // before anything is written rather than inside the row loop. The three
        // conditions fail CLOSED, and the reasons are the ones the block below
        // spells out at length:
        //
        //   - `family` is by NAME and ignores the folder, because the folder is
        //     attacker-controlled and classification can be wrong;
        //   - a family file with no spec stores NOTHING (`spec === null`), which
        //     is how `heat_device_info.csv` fails closed until a plan gives it a
        //     spec (D-15);
        //   - a spec file whose headers match nothing stores NOTHING, and the
        //     match is decided per FILE rather than per row, so one ragged row
        //     cannot drop its siblings (11-RESEARCH Pitfall 3).
        //
        // Moving it here changed NOTHING about what it decides: `storeFile` still
        // guards the row loop below, so an unsupported category feeds nothing
        // even when its file is in the family. What it buys is that the presence
        // fact below can be written from the same decision the rows were written
        // from, instead of from the parse alone.
        //
        // Phase 12, D-03: the family test has a CATEGORY half as well as the
        // NAME half. A freshly promoted folder (`Surveys`) is a container whose
        // contents the app has not seen, and a name-only rule leaves a hole in
        // it: a file whose name no pattern knows would fall through to the last
        // branch of the storage expression and be stored RAW. So a file in a
        // family CATEGORY is a family file whatever its name, and — because
        // `spec` is still looked up with the entry's OWN category, and
        // `storeFile` still requires a spec and a per-file header match — it
        // stores NOTHING unless a spec names it in that very category
        // (12-RESEARCH Finding 2, T-12-04). The category half only ever makes
        // a file fail CLOSED; it never widens what is stored.
        const rowData = parsed.rows.map((row) => row.data);
        const family = isNewDataFile(resolved.sourceFile) || isFamilyCategory(entry.name);
        const spec = family ? specFor(entry.name, resolved.sourceFile) : null;
        const storeFile =
          storeRows && (!family || (spec !== null && fileMatchesSpec(rowData, spec)));
        // Same before-the-loop rule, for the same reason. The category is
        // matched LOWER-CASED because a folder spelled `player_statistics`
        // classifies as the same supported category (D-18) and its files are
        // exactly the ones these blocks need presence for. The cap bounds a
        // crafted archive (T-05-21) and is PER ACCOUNT since Phase 9, so one
        // noisy root cannot starve a sibling's facts: past the cap the facts
        // stop, the rows do not.
        //
        // Phase 11, D-09: the OR half is the FAMILY rule, and it exists because
        // `Activity_History` is deliberately NOT in `PRESENCE_CATEGORIES` above.
        // Adding that category wholesale would start recording facts for every
        // session file the Playtime and Login panes already describe elsewhere;
        // the family rule records a fact for `HEAT_Session_Geolocation.csv` and
        // for the session files themselves, and for nothing else (Pitfall 4).
        // `storeRows` is part of it, so a family file in an unsupported folder
        // records nothing — the same sentence its rows get.
        if (
          root.presenceFiles.length < MAX_PRESENCE_FILES &&
          (PRESENCE_CATEGORIES.has(entry.name.toLowerCase()) || (family && storeRows))
        ) {
          root.presenceFiles.push({
            category: entry.name,
            sourceFile: resolved.sourceFile,
            // For a family file this is what the allowlist STORED, which is zero
            // for a drifted header and for a file with no spec; the projection
            // never drops a row of a file that matched, so the stored count is
            // knowable here, before the loop.
            rowCount: family && !storeFile ? 0 : parsed.rows.length,
            // `parsedRowCount` rides on FAMILY facts only, and only because it
            // distinguishes "skipped" from "absent" — a state the rows table
            // cannot express, since a skipped file leaves no row behind. Spread
            // conditionally so a non-family fact stays byte-identical to what
            // Phase 5 recorded, property for property.
            ...(family ? { parsedRowCount: parsed.rows.length } : {}),
            account: resolved.root,
          });
        }
        // D-18: `storeRows` short-circuits the loop, so an unsupported category's
        // rows are neither sanitised nor pushed anywhere. The counts at the
        // foot of this loop still read `parsed.rows.length` and
        // `parsed.skippedCount`, which is why the sentence the "Not yet
        // supported" pane shows is unchanged by the skip.
        //
        // Phase 11, D-08/D-15: the file-level SKIP for a new-game file. Three
        // conditions decide whether this file stores anything at all, and all
        // three fail CLOSED:
        //
        //   - `family` is by NAME and ignores the folder, because the folder is
        //     attacker-controlled and classification can be wrong — the same
        //     argument as CR-01 layer 2 below;
        //   - a family file with no spec stores NOTHING (`spec === null`), which
        //     is how `heat_device_info.csv` fails closed until a plan gives it a
        //     spec;
        //   - a spec file whose headers match nothing stores NOTHING, and the
        //     match is decided per FILE rather than per row, so one ragged row
        //     cannot drop its siblings (11-RESEARCH Pitfall 3).
        //
        // `storeRows` still guards the LOOP, so an unsupported category feeds
        // nothing even when its file is in the family. The three conditions
        // themselves — and why each fails closed — are stated where the
        // decision is made, at the top of this loop.
        for (let r = 0; storeRows && r < parsed.rows.length; r++) {
          // THE single choke point every row passes through. Dropping the
          // three sensitive columns here — rather than at the Dexie write —
          // is what makes the guarantee airtight: a row that is never pushed
          // cannot be persisted, and the raw parsed object stays inside this
          // loop.
          //
          // The guarantee is keyed on the HEADER (CR-01 layer 2, D-18 widened
          // by plan 01-13): a row is sanitised when its folder is in the
          // User_Info family OR it carries a LOGIN / BIRTH_DATE /
          // BIRTH_DATE_SRC header, because the folder a file is filed under is
          // attacker-controlled and classification can be wrong. A row with
          // neither is stored untouched, `__parsed_extra` included (Phase 2
          // stores everything outside the three columns). Nothing about it is
          // account-specific: the same choke point strips every root (D-19).
          //
          // 261012-bog, PD-02: the Assistant blob is reduced HERE, keyed on the
          // folder AND the header. A Device_info row that carries a `POST`
          // header is replaced by a NEW object holding only the four
          // allow-listed fields it yields, or by an explicit unreadable marker;
          // the overflow bucket and every other key go with it, so the blob
          // (the account id and an opaque flags value) is never stored. This
          // runs BEFORE the User_Info strip in the same expression, so a row
          // that is both is reduced and never merely sanitised.
          //
          // Accepted residual (T-bog-07), the same class as the D-18 deny-list
          // residual: a copy of the Assistant file misfiled OUTSIDE Device_info
          // keeps its cells at rest. They still never reach a view, because the
          // device-info channel reads three exact file names of one category.
          const raw = parsed.rows[r]!.data;
          // 11-01, D-08/D-15: a new-game row is PROJECTED, and never merely
          // sanitised. The projection replaces both expressions below rather
          // than running beside them, so a family row cannot be reduced by the
          // blob rule, sanitised by the deny-list, or stored raw — there is one
          // path for these files and it ends at the spec's own columns. A family
          // file with no spec projects to `{}`: its cells never reach storage,
          // while its rows still feed the aggregators below so a drifted header
          // is counted as EXCLUDED rather than vanishing from the file's counts.
          const data = family
            ? spec === null
              ? {}
              : projectRow(raw, spec)
            : deviceInfo && hasBlobColumn(raw)
              ? reduceBlobRow(raw)
              : userInfo || hasSensitiveColumn(raw)
                ? sanitizeUserInfoRow(raw)
                : raw;
          if (storeFile) {
            allRows.push({
              category: entry.name,
              sourceFile: resolved.sourceFile,
              rowIndex: own.rowCount + r,
              data,
              // D-07: the owning root, stamped on EVERY row, so two accounts
              // contributing the same file name stay distinguishable at rest.
              account: resolved.root,
            });
          }
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
          //
          // 11-01: the feed is deliberately NOT gated on `storeFile`. A family
          // file that matches no spec column still reaches the aggregators as
          // rows, which is what makes "no usable sessions, N rows excluded" the
          // honest sentence for it; gating the feed would report a file that
          // contributed nothing instead.
          if (isSessions || isLoginsFile) rows.push(data);
          // 09-10: one stored row for the owning account. It is counted HERE,
          // inside the single choke point every stored row passes through, so
          // "this root stored something" is a fact about rows that really
          // reached `allRows` and never about folders that merely existed.
          if (storeFile) root.storedRows += 1;
          // 12-08 (research Finding 4, T-12-25): a FAMILY file never feeds the
          // identity or Account-record pools. The three history files sit in
          // User_Info and now store a past-nickname column on purpose, and
          // `extractIdentity` falls back to the first pooled row's NAME when no
          // ID matches the root, so a historic nickname could otherwise become
          // the account's nickname. The lazy rebuild in db.ts applies the same
          // exclusion: the two paths must agree ("rebuild equals import",
          // Phase 9).
          if (storeFile && userInfo && !family) {
            const isAccountInfo = resolved.sourceFile.toLowerCase().endsWith('account_info.csv');
            // Into the OWNING ROOT's pools only. A per-root pool is what stops
            // an account with no User_Info inheriting a sibling's nickname, and
            // it is applied to the pools themselves rather than to the pick
            // afterwards — a pick that filtered could still be handed the wrong
            // pool (RESEARCH Pitfall 1).
            (isAccountInfo ? root.accountInfoRows : root.otherUserInfoRows).push(data);
          }
        }
        rowCount += parsed.rows.length;
        skippedRowCount += parsed.skippedCount;
        own.rowCount += parsed.rows.length;
        own.skippedRowCount += parsed.skippedCount;
      }
      updatedCategories.push({
        ...entry,
        rowCount,
        skippedRowCount,
      });
    }

    // D-17/D-20: three fields per root, read from that root's OWN sanitised
    // pool, or null when that root parsed no User_Info row at all (the D-16
    // fallback trigger). Never logged (D-21).
    const accounts: AccountMeta[] = outcome.roots.map((analysis) => {
      const root = stateOf(analysis.root);
      const pool = root.accountInfoRows.length > 0 ? root.accountInfoRows : root.otherUserInfoRows;
      const facts = summarizeSessionSources(root.sessionSources);
      return {
        root: analysis.root,
        categories: sortCategoryEntries(
          analysis.categories.map((category) => {
            const own = root.categoryCounts(category.name);
            return {
              ...category,
              rowCount: own.rowCount,
              skippedRowCount: own.skippedRowCount,
            };
          }),
        ),
        identity: extractIdentity(pool, analysis.root),
        files: root.presenceFiles,
        games: facts.games,
        firstYear: facts.firstYear,
        lastYear: facts.lastYear,
        // 09-10: written HERE, in the same `meta.put` the rest of this record
        // rides in, and never derived at read time — a reader cannot tell a
        // root that stored nothing from one whose sessions all failed to parse.
        hasData: root.storedRows > 0,
      };
    });
    // D-16: first activity year ascending, ties and no-activity accounts last,
    // all broken by root in code-unit order. Applied HERE rather than in the
    // classifier because years exist only once the rows have been parsed — and
    // the list is STORED in this order, so a replay is identical to the import.
    const ordered = sortAccounts(accounts);
    const primary = ordered[0];
    const identity = primary?.identity ?? null;

    // 06-05, D-02: the one labelled "Account record" row, read from the SAME
    // sanitised pool and with the SAME account root as the identity pick, so
    // the two describe one account and neither can be handed an email or a
    // birth date. It is not a login: `buildLogins` stores it and never counts
    // it, so the account's own address is in no total, no country figure and
    // no `unknown` bucket.
    //
    // Built ONLY for a dataset with exactly ONE account (UI-SPEC Surface 4). A
    // multi-account dataset has no single "the account", so publishing one
    // account's address as the login pane's account row would present one
    // account as the whole — exactly the D-11 caption's job to prevent. Per-
    // account logins are Phase 10's if they need them.
    const singleRoot = ordered.length === 1 ? ordered[0]! : null;
    const account =
      singleRoot === null
        ? null
        : extractAccountRecord(
            stateOf(singleRoot.root).accountInfoRows.length > 0
              ? stateOf(singleRoot.root).accountInfoRows
              : stateOf(singleRoot.root).otherUserInfoRows,
            singleRoot.root,
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
      primary?.root ?? '',
      updatedCategories,
      allRows,
      identity,
      playtime,
      // 05-07 + D-08: the presence facts ride in the SAME meta.put as the rows,
      // so a dataset is either all rows with their facts or neither. A fact
      // without its rows would be exactly the state a `no-rows` claim is made
      // of. The top-level list is the accounts' own facts CONCATENATED, so a
      // v1.0 reader that knows nothing about accounts still sees every file
      // this dataset holds.
      ordered.flatMap((a) => a.files),
      // 06-01: the login aggregate rides in that same `meta.put`, for the same
      // reason — an aggregate without its rows is a claim about data the
      // dataset does not hold.
      logins,
      // D-08/D-10: the ordered account list rides in that same `meta.put` too,
      // so a dataset is never rows without their accounts or accounts without
      // their rows (T-09-10).
      ordered,
    );
    // 05-07: a successful import REPLACED the dataset, so every remembered
    // answer belongs to a dataset the user is no longer looking at.
    clearDataQueryMemo();

    const finalResult: ClassifyResult = {
      ...outcome.result,
      // D-08: the legacy single-account fields are the FIRST account's in D-16
      // order — NOT the classifier's code-unit-first root — so a v1.0 reader
      // sees the same account the header leads with.
      accountRoot: primary?.root ?? '',
      categories: updatedCategories,
      importedAt,
      identity,
      // D-16 + 09-10: the list the main thread renders, in the order it reads as a
      // migration timeline. Published through the SAME `accountSummariesOf` the
      // replays use, so `done`, `duplicate` and `cache-status` cannot disagree
      // and the header's count is the count the store will produce.
      accounts: accountSummariesOf(ordered),
      // 09-11: every folder the archive held, including one that stored nothing,
      // which `accounts` leaves out. `resultFromMeta` sets the same figure from the
      // stored list; edit the pair together.
      rootCount: ordered.length,
      // 11-04, D-09: the new-game panes' file and row counts. Over the SAME
      // flattened presence list `writeDataset` just stored, through the SAME
      // function `resultFromMeta` replays it with — so `done`, `duplicate` and
      // `cache-status` cannot publish two different answers (11-UI-SPEC A3).
      newDataPanes: newDataPaneFacts(ordered.flatMap((account) => account.files)),
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
