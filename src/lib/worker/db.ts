import Dexie, { type Table, type Transaction } from 'dexie';
import type {
  AccountIdentity,
  CategoryEntry,
  PlaytimeAggregates,
} from '../core/types/worker-messages.ts';
import type { LoginAggregates } from '../features/logins/login-shared.ts';
import {
  isLegacySessionsFileName,
  isSessionsRow,
  sessionFileGame,
  sessionFileNameGame,
  type SessionRow,
  type SessionSource,
} from '../features/playtime/playtime-aggregate.ts';
import { isLoginsFileName, isLoginsRow } from '../features/logins/login-aggregate.ts';
import type { LoginSource } from '../features/logins/login-aggregate.ts';

/**
 * Dexie schema + transactional write (RESEARCH.md Pattern 3, DATA-01).
 *
 * Why this exists (02-01-PLAN Task 3, DATA-01, IMPORT-06, D-02):
 *   Phase 2's persistence layer: a single active dataset (rows table
 *   + meta record) per import, replaced atomically on every new
 *   ingest. The transaction wrapping the clear + bulkPut + meta.put
 *   is the one piece that prevents a crash mid-import from leaving
 *   the meta record pointing at a hash whose row table is incomplete
 *   (RESEARCH.md Pitfall 4 / DATA-01 / T-02-04).
 *
 * Sole-owner rule (RESEARCH.md Common Pitfalls Pitfall 1):
 *   This module is imported ONLY by `ingest.worker.ts`. Main-thread
 *   reads and deletes go through new worker request/response
 *   message types (`check-cache`, `clear-data`), not a second
 *   Dexie instance — opening the same IndexedDB database from both
 *   worker and main thread module graphs is a documented Dexie bug
 *   class we explicitly avoid.
 *
 * The chunked `bulkPut` (ROWS_PER_BULKPUT_CHUNK) keeps any single
 * IndexedDB request bounded at 1,000 rows. Progress `postMessage`
 * calls between chunks stay SYNCHRONOUS so the Dexie transaction
 * does not auto-commit early (RESEARCH.md Anti-Patterns).
 */

export interface DatasetRow {
  id?: number;
  category: string;
  sourceFile: string;
  rowIndex: number;
  data: Record<string, string | undefined>;
}

/**
 * One file the import saw, recorded so a later query can tell a file that was
 * NEVER in the archive from one that was in it and parsed to no data rows
 * (D-02, D-05). The rows table alone cannot: a header-only file stores no row,
 * so it is indistinguishable from an absent one.
 *
 * `category` and `sourceFile` are kept EXACTLY as the export wrote them, not
 * lower-cased, so a later plan can show the user's own spelling. Matching is
 * the reader's job and is done case-insensitively there.
 */
export interface DatasetFile {
  category: string;
  sourceFile: string;
  rowCount: number;
}

export interface DatasetMeta {
  id: 'active';
  hash: string;
  accountRoot: string;
  importedAt: string;
  categories: CategoryEntry[];
  /**
   * The three-field account identity computed by the worker at import
   * (D-20). Persisted here so a return visit replays it straight off the
   * meta record — the main thread never queries rows to render the
   * identity header. `null` means no User_Info row was parsed (D-16
   * fallback); an object with `null` fields means a row parsed but that
   * column was missing.
   */
  identity?: AccountIdentity | null;
  /**
   * The playtime aggregate computed by the worker at import (D-02), following
   * the same precedent as `identity`: persisted here so a `playtime-query`
   * answers from one single-key read with no row scan on the main thread.
   *
   * `null` when aggregation produced nothing to store — no Sessions.csv was
   * seen, or the aggregator threw and the import continued without it. The
   * two are not distinguished here on purpose: both mean "this dataset has no
   * stored aggregate", and `ingest.worker.ts` only answers a query whose `v`
   * matches.
   *
   * No Dexie version bump for this field: it lives inside the `meta` record,
   * whose store definition is unchanged, so existing databases read it as a
   * normal optional property and the `version(2)` upgrader above is untouched.
   */
  playtime?: PlaytimeAggregates | null;
  /**
   * The per-file presence facts recorded at import, for the Player_statistics,
   * Financial_data and Payment_history files (05-07). One entry per file the
   * parse loop actually read, holding its category, its name and how many data
   * rows it produced.
   *
   * This is the ONE new stored field of the phase and it is what lets D-02 and
   * D-05 say "not in this export" about a file that was absent and "no rows"
   * about one that was present and empty — a distinction the rows table cannot
   * make, because the empty file leaves no row behind.
   *
   * A cache written before this plan has no list. Consumers must treat `null`
   * and `undefined` as LEGACY and answer the sentence that is true of both
   * cases (no rows) rather than the absence claim they cannot support.
   *
   * No Dexie version bump and NO migration: this is a non-indexed field of the
   * existing `meta` record, whose store definition is unchanged, so an existing
   * database reads it as a normal optional property and the `version(2)`
   * upgrader is untouched.
   */
  files?: DatasetFile[] | null;
  /**
   * The login-history aggregate computed by the worker at import (06-01, D-12),
   * following the `playtime` precedent exactly: a NON-INDEXED field of this
   * same record, written in the same `meta.put` as the rows, so a dataset is
   * either all rows with their login aggregate or neither.
   *
   * `null` when aggregation produced nothing to store or when it threw and the
   * import continued without it (T-04-03 discipline, restated for this
   * channel). The two are not distinguished here on purpose — both mean "no
   * stored aggregate" — and `ingest.worker.ts` rebuilds either one from the
   * stored rows on the next query.
   *
   * No Dexie version bump for this field, DELIBERATELY, and the reason is
   * recorded in the SUMMARY of 06-01 because it is a decision the phase's own
   * context (D-12, "schema bump per Phase 3 D-19 pattern") reads the other way:
   * the `version(2)` upgrader above CLEARS both stores, so the D-19 pattern
   * applied to a purely derived field would cost every returning user their
   * cached dataset — their rows, their identity, their imported-at — to
   * recompute something the rows already answer. The rows still carry the `IP`
   * column, so a rebuild is lossless, and `ingest.worker.ts` performs it.
   *
   * The precedent is BOTH earlier phases' third field, and neither of them
   * bumped: Phase 4's `playtime` (D-02) and Phase 5's `files` (05-07) each added
   * a non-indexed property of this same record, each left `version(2)` and its
   * upgrader exactly as they were, and each rebuilds a missing or stale value
   * lazily from the stored rows. `tests/unit/import/db.test.ts` pins the version
   * number and the wiping upgrader so a later phase cannot quietly add a
   * `version(3)` for a field of the same kind.
   */
  logins?: LoginAggregates | null;
}

/**
 * The cap on how many presence facts one dataset records (T-05-21).
 *
 * A crafted archive with thousands of files in those three folders must not be
 * able to make the meta record grow without bound. Overflowing the cap costs
 * only the presence facts of the files past it — their rows are still stored
 * and still answer `ready` — so the cap degrades a claim about a file rather
 * than the data behind it.
 */
export const MAX_PRESENCE_FILES = 500;

export const ROWS_PER_BULKPUT_CHUNK = 1000;

export class AppDb extends Dexie {
  rows!: Table<DatasetRow, number>;
  meta!: Table<DatasetMeta, string>;

  constructor() {
    super('wg-export-viewer');
    // D-19 / 03-01 threat T-03-02: v1 caches hold the raw LOGIN email at
    // rest, because D-18's strip only landed in phase 3. The schema is
    // unchanged, so a bare version bump would PRESERVE that data — the
    // discard has to be an `upgrade` callback, which Dexie runs inside the
    // versionchange transaction and only for databases that already exist
    // (a fresh install initializes at the last version with no upgrader,
    // and it never runs again on later opens).
    //
    // Both `clear()` calls are awaited, not chained with `&&`: a
    // `clear() && clear()` one-liner would fire the second call but never
    // wait for it, so the meta clear could land after the transaction
    // commits.
    //
    // TWO RULES FOR LATER PHASES:
    //   1. If a phase declares `version(3)`, KEEP this `version(2)` block
    //      WITH its upgrader. Dexie reads the installed schema, so
    //      dropping it would silently stop the v1 wipe for any device that
    //      has not yet upgraded to v2.
    //   2. A second browser tab still holding a v1 connection is closed by
    //      Dexie's default versionchange handler, so that stale tab's next
    //      call throws DatabaseClosedError until it reloads. Acceptable
    //      for a single-user, local-only tool: the tab must be reloaded
    //      once, and the alternative (waiting on the stale connection)
    //      would leave the email on disk indefinitely.
    //
    // The database NAME must not change. A new name would leave the
    // emailed `wg-export-viewer` store in the user's browser forever,
    // which is exactly what D-19 exists to prevent.
    this.version(2)
      .stores({
        rows: '++id, category, sourceFile',
        meta: 'id',
      })
      .upgrade(async (tx: Transaction) => {
        await tx.table('rows').clear();
        await tx.table('meta').clear();
      });
  }
}

/**
 * Sole Dexie connection for the page. Imported ONLY by
 * `ingest.worker.ts` — main-thread code must go through the
 * worker's message contract, never import this directly.
 */
export const db = new AppDb();

/**
 * Atomically replace the active dataset (clear → bulkPut → meta.put
 * inside one transaction). The `importedAt` timestamp is generated
 * here so the worker can re-use the same string for the `done`
 * response's `result.importedAt` (D-10) without a second clock read.
 *
 * `identity` is the fifth parameter and is OPTIONAL, so the four-argument
 * calls elsewhere (and in db.test.ts) keep compiling unchanged; it rides
 * along in the same `meta.put` inside the same transaction as the rows,
 * so a crash mid-write can never leave an identity pointing at a rows
 * table that was never written.
 *
 * `playtime` is the sixth parameter and is OPTIONAL for the same reason
 * (D-02). It is a NON-INDEXED field of the same `meta` record, written in
 * that same `meta.put`, so the aggregate is as atomic as the rows and
 * needs no schema version: a dataset is either all rows plus its aggregate
 * or neither.
 *
 * `files` is the seventh parameter and is OPTIONAL for the same reason (05-07).
 * It rides in that same `meta.put`, so presence facts are as atomic as the rows
 * they describe: a crash mid-write can never leave a file listed with no rows,
 * which is precisely the state a `no-rows` claim is made of.
 *
 * `logins` is the eighth and is OPTIONAL for the same reason (06-01, D-12). It
 * is the login-history aggregate and, like the playtime aggregate, a non-indexed
 * field of the same record in the same `meta.put`.
 */
export async function writeDataset(
  hash: string,
  accountRoot: string,
  categories: CategoryEntry[],
  rows: DatasetRow[],
  identity: AccountIdentity | null = null,
  playtime: PlaytimeAggregates | null = null,
  files: DatasetFile[] | null = null,
  logins: LoginAggregates | null = null,
): Promise<{ importedAt: string }> {
  const importedAt = new Date().toISOString();
  await db.transaction('rw', db.rows, db.meta, async () => {
    await db.rows.clear();
    for (let i = 0; i < rows.length; i += ROWS_PER_BULKPUT_CHUNK) {
      await db.rows.bulkPut(rows.slice(i, i + ROWS_PER_BULKPUT_CHUNK));
    }
    await db.meta.put({
      id: 'active',
      hash,
      accountRoot,
      importedAt,
      categories,
      identity,
      playtime,
      files,
      logins,
    });
  });
  return { importedAt };
}

/**
 * Read the active dataset's meta record (or null when the page has
 * never had a successful import). Used by the hash dedup gate
 * (SC3) and the future 'check-cache' / 'cache-status' handshake
 * (declared in worker-messages.ts; behavior lands in 02-02).
 */
export async function checkCache(): Promise<DatasetMeta | null> {
  return (await db.meta.get('active')) ?? null;
}

/**
 * Read ONE atomic snapshot of the active dataset's session rows, for the lazy
 * playtime backfill (04-06, T-04-11, T-04-30).
 *
 * ## Why meta and rows are read in the same transaction
 *
 * `writeDataset` replaces the whole record with `meta.put` inside a
 * transaction, so a dataset is either all rows plus its meta or neither. A
 * backfill that read the meta first and the rows afterwards could be handed a
 * NEW dataset's meta and an OLD dataset's rows, and would then write the old
 * dataset's playtime onto the new one. Reading both inside one read
 * transaction is what makes the answer and its data come from the same
 * dataset; `writePlaytimeIfCurrent` is the second half of the guard.
 *
 * ## Why one source per FILE, and not one flat row list
 *
 * Every session file has its own HEADER: the synthetic fixture's `Sessions.csv`
 * says `SESSION_START`/`SESSION_END`, a real `WOT_Game_Sessions.csv` says
 * `STARTED_AT`/`FINISHED_AT`, and an export can hold both. The aggregator
 * resolves its columns per source, so a flat list here would hand it the first
 * file's header to apply to every other one and every row of those would be
 * excluded. Handing back the same grouping the import path used is what keeps
 * the two paths from producing different numbers for one export (D-02).
 *
 * ## Why the distinct keys are listed rather than a multi-key query
 *
 * Dexie's multi-key `where('sourceFile')` form — the one that takes a LIST of
 * keys in a single call — took 2,243 ms on 3,000 rows in fake-indexeddb
 * (RESEARCH Pattern 2, measured). This walks the index with
 * `orderBy().uniqueKeys()` — index-only, 9 ms there — keeps the keys
 * `sessionFileNameGame` accepts, and issues one single-key `equals` per
 * survivor. No multi-key query form appears anywhere in this file and must
 * not: its cost is a function of the number of keys, not of the rows.
 *
 * ## Why the import path's own predicate, twice
 *
 * `sessionFileNameGame` screens the stored `sourceFile` index BY NAME, which
 * is all an index entry holds; `sessionFileGame` then decides with the row's
 * OWN category, exactly as the import path does. The name-only screen is what
 * keeps the number of indexed reads to one per candidate FILE rather than one
 * per category spelling of it, and it is the same predicate the importer used,
 * so the two cannot diverge. The second call is also what rejects a session
 * file nested one folder deeper — deliberately, because the import path stores
 * only the basename.
 *
 * Rows are grouped per CATEGORY-AND-FILE pair in the order first seen, so a
 * dataset that somehow holds the same name in two folder cases is aggregated
 * with the same grouping the import loop produced.
 */
export async function readSessionRowData(): Promise<{
  importedAt: string;
  sources: SessionSource[];
} | null> {
  return db.transaction('r', db.rows, db.meta, async () => {
    const meta = await db.meta.get('active');
    if (meta === undefined) return null;

    const keys = await db.rows.orderBy('sourceFile').uniqueKeys();
    // Grouped per CATEGORY-AND-FILE pair, in the order first seen, as a Map of
    // Maps rather than a Map keyed by a joined string: a folder name and a file
    // name can both contain any character a zip entry name can, and a separator
    // that has to be excluded from both is one more thing to get wrong.
    const grouped = new Map<string, Map<string, SessionSource>>();
    for (const key of keys) {
      // The name-only screen: cheap, index-driven, and the same rule the
      // importer applied. A key it refuses is never read at all.
      if (typeof key !== 'string' || !isSessionFileName(key)) continue;
      const matches = await db.rows.where('sourceFile').equals(key).toArray();
      for (const row of matches) {
        // The full predicate, on the row's own category.
        if (!isSessionsRow(row.category, row.sourceFile)) continue;
        const byFile = grouped.get(row.category) ?? new Map<string, SessionSource>();
        grouped.set(row.category, byFile);
        const source = byFile.get(row.sourceFile);
        if (source === undefined) {
          byFile.set(row.sourceFile, {
            game: sessionFileGame(row.category, row.sourceFile),
            rows: [row.data],
          });
        } else {
          // The accumulator behind the readonly `rows`; see the same pattern
          // in the worker's import loop.
          (source.rows as SessionRow[]).push(row.data);
        }
      }
    }
    const sources = [...grouped.values()].flatMap((byFile) => [...byFile.values()]);
    return { importedAt: meta.importedAt, sources };
  });
}

/**
 * The name-only half of the import path's session-file test, used to screen the
 * `sourceFile` index before paying for a read of the rows behind each key.
 *
 * `sessionFileNameGame` answers null for BOTH "not a session file" and "the
 * legacy `Sessions.csv`, which names no game", so it cannot screen by name on
 * its own; `isSessionsRow` needs a category it does not have here. The rule is
 * therefore spelled out once, from the same two exported predicates, so this
 * screen and the import path cannot drift apart: a name is worth reading when
 * it is the legacy file OR it carries a game token. Both halves are the
 * predicates themselves rather than literals re-spelled here, so a second
 * legacy file shape added to `playtime.ts` cannot reach the import path and
 * miss this screen.
 */
function isSessionFileName(sourceFile: string): boolean {
  return sessionFileNameGame(sourceFile) !== null || isLegacySessionsFileName(sourceFile);
}

/**
 * The `User_Info` folder's lower-cased name, for the account-pool walk below.
 *
 * The same spelling `isUserInfoCategory` matches, for the same reason: the
 * classifier preserves the export's own folder casing, so a `user_info` folder
 * classifies as the same supported category and a literal compare would find no
 * rows to build an Account record from.
 */
const USER_INFO_CATEGORY = 'user_info';

/** The account file's lower-cased name — the pool that wins when both hold rows. */
const ACCOUNT_INFO_SUFFIX = 'account_info.csv';

/**
 * ONE read of everything the login history is built from, for the lazy backfill
 * (06-05, D-01, D-02, T-06-21).
 *
 * ## Why this is a SIBLING of `readSessionRowData` and not a widening of it
 *
 * `readSessionRowData` is a playtime-module reader. Its contract is "the
 * session files", its callers are the playtime backfill, and `playtime.ts`
 * states that the `IP` column is never read and its tests assert it (T-04-01).
 * Widening it to return `Logins.csv` rows would hand the playtime aggregator
 * files it has no rule for, and widening `isSessionFileName` would put a login
 * file into every playtime rebuild. So the two stay separate, and the shared
 * machinery — the index walk, the single-key reads, the per-category-and-file
 * grouping — is re-used by construction rather than extracted: three screens
 * and two return shapes are not yet a shared abstraction, and a helper both
 * readers call would exist only to have two callers whose rules have to differ.
 *
 * ## Why the same ONE-transaction rule (T-06-21)
 *
 * `writeDataset` replaces the whole record inside a transaction, so a dataset is
 * either all rows plus its meta or neither. Reading `importedAt` first and the
 * rows afterwards could hand a backfill a NEW dataset's date and an OLD
 * dataset's rows, and the aggregate it then wrote would be the previous
 * dataset's. The answer carries the SNAPSHOT's `importedAt` and
 * `writeLoginsIfCurrent` refuses a write for any other one.
 *
 * ## Why the account rows come back at all
 *
 * The Account record (D-02) is a fact about the export, not a login, so a
 * rebuild that dropped it would answer a smaller aggregate than the import did
 * — the same quiet disagreement this reader exists to prevent. The pool is
 * returned RAW and the record is built by the worker with the same
 * `extractAccountRecord` the import used, so the row choice and the
 * `readable`/`unreadable`/`blank` states are computed by one function rather
 * than two.
 *
 * The pool is the ALREADY-SANITISED rows the worker wrote: the email and birth
 * data were dropped at write time by `sanitizeUserInfoRow` (D-18), so there is
 * nothing sensitive to filter here and this reader must never add a filter of
 * its own that could disagree with the strip.
 *
 * ## Why the index walk is the index walk
 *
 * The list form of a `sourceFile` query took 2,243 ms on 3,000 rows in
 * fake-indexeddb (RESEARCH Pattern 2, measured) against 9 ms for
 * `orderBy().uniqueKeys()` plus one single-key read per survivor. That form
 * appears nowhere in this file and must not: the login reader's cost is a
 * function of the number of LOGIN FILES, which is a handful, and not of the
 * 71,000 session rows behind them.
 */
export async function readLoginRowData(): Promise<{
  importedAt: string;
  sources: LoginSource[];
  accountPool: Record<string, string | undefined>[];
  accountRoot: string;
} | null> {
  return db.transaction('r', db.rows, db.meta, async () => {
    const meta = await db.meta.get('active');
    if (meta === undefined) return null;

    // Grouped per CATEGORY-AND-FILE pair, in the order first seen, exactly as
    // the import loop grouped them and exactly as `readSessionRowData` does —
    // see that function for why this is a Map of Maps and not a joined key.
    const grouped = new Map<string, Map<string, LoginSource>>();
    const keys = await db.rows.orderBy('sourceFile').uniqueKeys();
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      // The name-only screen, the union of the two source kinds' own rules: a
      // key neither predicate accepts is never read at all.
      if (!isSessionFileName(key) && !isLoginsFileName(key)) continue;
      const matches = await db.rows.where('sourceFile').equals(key).toArray();
      for (const row of matches) {
        // The FULL predicate, on the row's own category — the same two-step
        // split `readSessionRowData` uses, for the same reason: the name screen
        // cannot know which folder the rows came from.
        const isLogins = isLoginsRow(row.category, row.sourceFile);
        if (!isLogins && !isSessionsRow(row.category, row.sourceFile)) continue;
        const byFile = grouped.get(row.category) ?? new Map<string, LoginSource>();
        grouped.set(row.category, byFile);
        const source = byFile.get(row.sourceFile);
        if (source === undefined) {
          byFile.set(row.sourceFile, {
            kind: isLogins ? 'logins' : 'sessions',
            // A login file names no title, so it carries no token rather than a
            // fabricated one (T-04-27: the token comes from a file name).
            game: isLogins ? null : sessionFileGame(row.category, row.sourceFile),
            rows: [row.data],
          });
        } else {
          // The accumulator behind the readonly `rows`; see the same pattern
          // in the worker's import loop.
          (source.rows as SessionRow[]).push(row.data);
        }
      }
    }

    // The account pool: a SECOND walk, over the CATEGORY index, because the
    // login files and the User_Info rows are in different folders and a reader
    // that asked one index for both would read either everything or nothing.
    // The partition is the import loop's own: Account_Info.csv's rows first,
    // the rest as the fallback, so the record describes the same row the
    // identity does.
    const accountPool: Record<string, string | undefined>[] = [];
    const fallbackPool: Record<string, string | undefined>[] = [];
    const categories = await db.rows.orderBy('category').uniqueKeys();
    for (const category of categories) {
      if (typeof category !== 'string' || category.toLowerCase() !== USER_INFO_CATEGORY) continue;
      const rows = await db.rows.where('category').equals(category).toArray();
      for (const row of rows) {
        if (row.sourceFile.toLowerCase().endsWith(ACCOUNT_INFO_SUFFIX)) accountPool.push(row.data);
        else fallbackPool.push(row.data);
      }
    }
    if (accountPool.length === 0) accountPool.push(...fallbackPool);

    return {
      importedAt: meta.importedAt,
      sources: [...grouped.values()].flatMap((byFile) => [...byFile.values()]),
      accountPool,
      accountRoot: meta.accountRoot,
    };
  });
}

/**
 * One dataset read for the Phase 5 query path (05-07).
 *
 * `files` is the stored presence list, or null for a legacy cache written
 * before this plan recorded one. It is returned rather than interpreted here so
 * the LEGACY case stays visible to the caller: a null list must not be read as
 * "no file was present", which would turn every file of an older cache into a
 * "not in this export" claim the data cannot support.
 */
export interface RowsSnapshot {
  importedAt: string;
  files: DatasetFile[] | null;
  rows: Map<string, Record<string, string | undefined>[]>;
}

/**
 * Read the rows of the named files, plus the meta record, in ONE read
 * transaction (05-07).
 *
 * ## Why the answer and its data come from ONE snapshot
 *
 * Exactly the discipline `readSessionRowData` established (T-04-11, repeated
 * here for T-05-19): `importedAt` is read inside the same transaction as the
 * rows, and the answer carries THAT string. A caller that read meta first and
 * rows afterwards could be handed a NEW dataset's date and an OLD dataset's
 * rows, and would then show one export's numbers under another's date — the
 * exact tear the playtime pair had to defend against.
 *
 * ## Why the distinct keys are listed rather than the multi-key form
 *
 * The `sourceFile` index offers a form that takes a LIST of keys in a single
 * call. Phase 4 measured it at 2,243 ms on 3,000 rows in fake-indexeddb
 * (RESEARCH Pattern 2), against 9 ms for the index-only walk below, because its
 * cost is a function of the number of KEYS rather than of the rows. This walks
 * the index with `orderBy().uniqueKeys()` — index-only, no row is touched —
 * keeps the keys whose lower-cased text is in `names`, and issues ONE
 * single-key read per survivor. That form is never used in this file and must
 * not be: the sixteen vehicle file names alone would put every query on the
 * slow path.
 *
 * ## Why the file screen is lower-cased, and why the category check is too
 *
 * `names` is a set of already-lower-cased exact file names, because the
 * `sourceFile` index holds what the export wrote and a real archive spells a
 * file `WOT_Vehicle_Statistics.csv` while a fixture may not. The stored
 * category is compared the same way, and deliberately so: a folder spelled
 * `player_statistics` classifies as the same supported category as
 * `Player_statistics`, so a case-sensitive compare would drop those rows and
 * report a title as absent when the export plainly had it.
 *
 * Rows are pushed in stored order and keyed by the LOWER-CASED file name, which
 * is the same key the builders' file maps use, so a reader and a builder cannot
 * disagree about which file a row came from.
 */
export async function readRowsByFile(
  names: ReadonlySet<string>,
  categories: readonly string[],
): Promise<RowsSnapshot | null> {
  return db.transaction('r', db.rows, db.meta, async () => {
    const meta = await db.meta.get('active');
    if (meta === undefined) return null;

    // The category test is a lower-cased set, built once per read rather than
    // per row: it is consulted once per stored row.
    const wanted = new Set(categories.map((c) => c.toLowerCase()));
    const keys = await db.rows.orderBy('sourceFile').uniqueKeys();
    const rows = new Map<string, Record<string, string | undefined>[]>();
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      const name = key.toLowerCase();
      // The name-only screen: cheap, index-driven. A name nobody asked for is
      // never read at all, so the cost of this reader tracks the files that
      // were requested rather than the size of the dataset.
      if (!names.has(name)) continue;
      const matches = await db.rows.where('sourceFile').equals(key).toArray();
      for (const row of matches) {
        if (!wanted.has(row.category.toLowerCase())) continue;
        const bucket = rows.get(name);
        if (bucket === undefined) {
          rows.set(name, [row.data]);
        } else {
          // The accumulator behind the map's value type, for the same reason
          // the session reader casts: the map is built inside this function and
          // handed out as readonly data.
          (bucket as Record<string, string | undefined>[]).push(row.data);
        }
      }
    }
    return { importedAt: meta.importedAt, files: meta.files ?? null, rows };
  });
}

/**
 * Store a freshly computed playtime aggregate, but ONLY while the active
 * dataset is still the one the aggregate was computed from (T-04-11).
 *
 * Returns whether it wrote. A false return is not a failure: it means a
 * replace landed between the snapshot and this call, and the aggregate that
 * caller holds belongs to a dataset the user is no longer looking at. The
 * backfill answers the caller with the SNAPSHOT's numbers either way — this
 * is a cache, and a missed cache write costs one recomputation, not
 * correctness.
 *
 * Only the `playtime` field is updated, so a hash, an identity, a category
 * list and an `importedAt` can never be rewritten by a backfill. No Dexie
 * version is added: this is a property of the existing `meta` record, and the
 * `version(2)` upgrader above must stay exactly as it is.
 */
export async function writePlaytimeIfCurrent(
  importedAt: string,
  playtime: PlaytimeAggregates,
): Promise<boolean> {
  return db.transaction('rw', db.meta, async () => {
    const current = await db.meta.get('active');
    if (current === undefined || current.importedAt !== importedAt) return false;
    await db.meta.update('active', { playtime });
    return true;
  });
}

/**
 * Store a freshly computed login-history aggregate, but ONLY while the active
 * dataset is still the one the aggregate was computed from (06-01, T-06-03).
 *
 * The same guard, and the same reasons, as `writePlaytimeIfCurrent` — a copy
 * rather than a generalization, because the two aggregates are written by
 * different branches and a shared helper would exist only to have one caller.
 * A false return is not a failure: it means a replace landed between the
 * snapshot and this call, and the aggregate that caller holds belongs to a
 * dataset the user is no longer looking at. The backfill answers the caller
 * with the SNAPSHOT's numbers either way — this is a cache, and a missed cache
 * write costs one recomputation, not correctness.
 *
 * Only the `logins` field is updated, so a hash, an identity, a category list,
 * the presence facts and an `importedAt` can never be rewritten by a rebuild.
 * No Dexie version is added: this is a property of the existing `meta` record,
 * and the `version(2)` upgrader above must stay exactly as it is (the 06-01
 * checkpoint answered option-a, and `tests/unit/import/db.test.ts` pins it).
 */
export async function writeLoginsIfCurrent(
  importedAt: string,
  logins: LoginAggregates,
): Promise<boolean> {
  return db.transaction('rw', db.meta, async () => {
    const current = await db.meta.get('active');
    if (current === undefined || current.importedAt !== importedAt) return false;
    await db.meta.update('active', { logins });
    return true;
  });
}

/**
 * Atomically wipe the cached dataset (DATA-02, 02-03-PLAN Task 1):
 * clear every row from `db.rows` AND delete the 'active' meta record
 * inside ONE Dexie transaction. Same transactional-atomicity
 * discipline as writeDataset — a crash mid-clear can never leave the
 * meta record pointing at a rows table that has been partially
 * emptied (RESEARCH.md Pitfall 4 / DATA-01 / T-02-04, applied in
 * reverse for the destructive side).
 *
 * Calling clearData() when no dataset was ever written is a safe
 * no-op — Dexie's `table.clear()` on an empty table resolves
 * immediately, and `table.delete(key)` on a missing key is also a
 * no-op (Dexie explicitly does not throw). This is a load-bearing
 * guarantee for the persistent "Clear my cached data" control: even
 * if a defensive guard ever lets it fire with no cached data
 * present (D-19 says it should be hidden in that case, but the
 * underlying function must still be crash-safe).
 */
export async function clearData(): Promise<void> {
  await db.transaction('rw', db.rows, db.meta, async () => {
    await db.rows.clear();
    await db.meta.delete('active');
  });
}
