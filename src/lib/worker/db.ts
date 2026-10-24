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
import { classifyFolder } from './categories.ts';
import {
  fileMatchesSpec,
  isFamilyCategory,
  isNewDataFile,
  projectRow,
  specFor,
} from './new-data-allowlist.ts';
import type { AccountRowGroup } from './csv-columns.ts';
import { accountsOfMeta } from './account-summary.ts';

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
  /**
   * The account ROOT that owns this row — the archive folder name this row was
   * read from (Phase 9, D-07).
   *
   * NON-INDEXED, deliberately: the `rows` store keeps its
   * `++id, category, sourceFile` index definition, so a v1.0 cache survives
   * untouched and readers keep querying by the existing `category` index and
   * filtering in memory. Two accounts contributing the same file name are
   * therefore distinguishable, which they were not before Phase 9 — the reason
   * D-12 forbids keying, sorting or de-duplicating on `(sourceFile, rowIndex)`
   * alone, since `rowIndex` restarts per account and category.
   *
   * Absent on rows a v1.0 build wrote. A reader must treat absence as "this row
   * belongs to the dataset's legacy single account", which is exactly what
   * those rows say.
   */
  account?: string;
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
  /**
   * How many rows of this file were STORED (plan 11-04, D-09).
   *
   * For a NEW-GAME family file this is the count the per-file column allowlist
   * kept, which is what makes it differ from {@link DatasetFile.parsedRowCount}.
   * For every other file it is the whole parse, exactly as it has always been.
   */
  rowCount: number;
  /**
   * How many rows this file PARSED to, before the allowlist (plan 11-04, D-09).
   *
   * Present on facts of new-game FAMILY files only, and it is what turns the
   * presence list into a three-state answer the rows table cannot give (D-09):
   *
   *   - `parsedRowCount > 0 && rowCount === 0` — the file WAS in the export and
   *     the allowlist stored none of its rows ("skipped");
   *   - `parsedRowCount === 0` — the file was in the export and held no rows;
   *   - no fact at all — the file was not in the export.
   *
   * ABSENT on facts of non-family files (their `rowCount` IS the parse, so a
   * second number would say nothing) and on every fact written before this
   * plan, which a reader must treat as "parsed equals stored" — the state a
   * family file's fact had before, and the only honest reading of a cache that
   * predates the distinction.
   *
   * This is a NON-INDEXED property of the existing `meta` record, exactly like
   * `files` itself: NO Dexie version is added, `version(2)` and its wiping
   * upgrader are untouched, and `db.verno` stays 2 — a property
   * `tests/unit/import/db.test.ts` pins. Narrowing the rows this fact describes
   * is a DATA operation (11-04's `narrowStoredNewDataRows`), not a migration,
   * so a returning reader loses nothing to have it applied.
   */
  parsedRowCount?: number;
  /**
   * The account ROOT this file was read from (Phase 9, D-07), for the same
   * reason and with the same non-indexed shape as {@link DatasetRow.account}:
   * three accounts can contribute a file of the same name, and a presence fact
   * with no owner cannot be attributed.
   *
   * Absent on facts a v1.0 build recorded, which is every fact of a cache that
   * predates Phase 9.
   */
  account?: string;
}

/**
 * One account's slice of the stored dataset (Phase 9, D-08).
 *
 * Everything the top-level {@link DatasetMeta} fields hold, scoped to ONE
 * account: its own category list with its OWN row counts (the top-level list is
 * merged across accounts by folder name), its own identity (read from that
 * root's own sanitised User_Info rows and never another root's), its own
 * presence facts, and the games and activity years the identity header shows.
 *
 * ## Why this is a non-indexed field of the meta record and NOT a new store
 *
 * Same reasoning as `playtime`, `files` and `logins` above: the rows are the
 * dataset and this is a derived index over them, so it rides in the same
 * `meta.put` inside the same transaction as the rows and needs no Dexie version.
 * A cache written before Phase 9 reads it as absent and is normalised by
 * `accountsOfMeta`, which is the same single normaliser `done`, `duplicate` and
 * `cache-status` all go through.
 *
 * ## Why `identity` can be null here while the top-level one is the first
 * account's
 *
 * `null` means this root parsed NO User_Info row at all (D-17), which is a
 * fact about one account and must not be filled in from a sibling's. The
 * top-level `identity` field stays the FIRST account's for every v1.0 reader
 * that has no account list at all.
 */
export interface AccountMeta {
  /** The account root, as the archive spells it. `''` for a rootless export. */
  root: string;
  /** This account's OWN categories, with this account's OWN counts. */
  categories: CategoryEntry[];
  /** This account's identity, from its own sanitised rows, or null (D-17). */
  identity: AccountIdentity | null;
  /** This account's own per-file presence facts, tagged with its root. */
  files: DatasetFile[];
  /** This account's game tokens, code-unit ascending (D-14). */
  games: string[];
  /** First and last activity year, or null when none parses (D-15). */
  firstYear: number | null;
  lastYear: number | null;
  /**
   * Did this root contribute anything the dataset holds (plan 09-10,
   * `accountCountSemantics: option-a`)?
   *
   * True when the root stored at least one row in a supported category — which
   * includes a `User_Info` row — and false when every folder it holds is
   * `known-deferred`, so its rows were counted and never stored (D-18 / D-21).
   *
   * OPTIONAL and read as ABSENT-MEANS-DATA. That is the whole back-compat rule:
   * a record written before this field existed belongs to a build that stored
   * only roots worth listing, so every such record is published exactly as it
   * always was. Nothing is lost and nothing is guessed.
   *
   * The published list — not the STORE — is what this filters. The stored list
   * keeps every root, because the Account record gate counts roots: dropping a
   * root at write time would make a two-root archive look like a one-account
   * dataset and let one account's address stand for the whole (T-09-13).
   *
   * No Dexie version bump for this field: it is a non-indexed property of the
   * existing `meta` record, so `db.verno` stays 2 and the `version(2)` upgrader
   * is untouched — the same precedent {@link DatasetMeta.files} sets.
   */
  hasData?: boolean;
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
  /**
   * One entry per account in the export, in D-16 order (Phase 9, D-08).
   *
   * Stored ALREADY ORDERED, so `done`, `duplicate` and `cache-status` can
   * replay it through `accountsOfMeta` without re-deriving anything, and a
   * returning visitor sees the same list the import published.
   *
   * Absent (and `null`) on a cache written before Phase 9. `accountsOfMeta`
   * builds a one-entry list from the legacy fields in that case, so no reader
   * ever has to branch on the difference (D-22).
   */
  accounts?: AccountMeta[] | null;
}

/**
 * The cap on how many presence facts one ACCOUNT records (T-05-21).
 *
 * A crafted archive with thousands of files in those three folders must not be
 * able to make the meta record grow without bound. Overflowing the cap costs
 * only the presence facts of the files past it — their rows are still stored
 * and still answer `ready` — so the cap degrades a claim about a file rather
 * than the data behind it.
 *
 * PER ACCOUNT since Phase 9. With one account the cap is exactly what it was;
 * with several it is applied to each account's own list, so a root with 501
 * `Player_Statistics` files cannot starve a sibling's facts — one noisy
 * account would otherwise be able to silence the presence claim for every other
 * account in the same export. The flattened list is bounded by the cap times
 * the root cap (`MAX_ACCOUNT_ROOTS`).
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
 *
 * `accounts` is the ninth and is OPTIONAL for the same reason (Phase 9, D-08):
 * the ordered per-account index, written in that SAME `meta.put` so a dataset
 * is either all rows with their accounts or neither (T-09-10). `null` means the
 * caller is a v1.0-shaped write, and `accountsOfMeta` normalises it.
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
  accounts: AccountMeta[] | null = null,
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
      accounts,
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
 * A {@link SessionSource} that names the account it was read from.
 *
 * Phase 9, D-07/D-12. The field is carried so a reader can be audited against
 * the account that owns a row; the aggregator itself does not read it, exactly
 * as it never reads the `IP` column (T-04-01).
 */
export interface AccountSessionSource extends SessionSource {
  readonly account: string;
}

/** The login-history twin of {@link AccountSessionSource}. */
export interface AccountLoginSource extends LoginSource {
  readonly account: string;
}

/**
 * The account a stored row belongs to (D-07).
 *
 * Absent on a row a v1.0 build wrote, and such a row IS the dataset's legacy
 * single account — which is exactly what `meta.accountRoot` records. That is
 * the whole of the account-or-legacy rule, and it is stated once here because
 * three readers apply it.
 */
function accountOf(row: DatasetRow, meta: DatasetMeta): string {
  return row.account ?? meta.accountRoot;
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
 * ## Why one source per ACCOUNT, CATEGORY AND FILE, and not one flat row list
 *
 * Every session file has its own HEADER: the synthetic fixture's `Sessions.csv`
 * says `SESSION_START`/`SESSION_END`, a real `WOT_Game_Sessions.csv` says
 * `STARTED_AT`/`FINISHED_AT`, and an export can hold both. The aggregator
 * resolves its columns per source, so a flat list here would hand it the first
 * file's header to apply to every other one and every row of those would be
 * excluded. Handing back the same grouping the import path used is what keeps
 * the two paths from producing different numbers for one export (D-02).
 *
 * Since Phase 9 the ACCOUNT is the outermost level of that grouping (D-12,
 * RESEARCH Pitfall 3). Two accounts can contribute the same file name — and in
 * the real-shape export they do, with different headers — so grouping by file
 * alone would resolve one account's columns against another's and silently
 * EXCLUDE its sessions. The rebuilt aggregate would then disagree with the one
 * the import computed, and nothing anywhere would report it. The grouping is
 * the only change: the transaction, the index walk and the single-key reads
 * are exactly what they were.
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
 * Rows are grouped per ACCOUNT-AND-CATEGORY-AND-FILE triple in the order first
 * seen, so a dataset that somehow holds the same name in two folder cases is
 * aggregated with the same grouping the import loop produced.
 */
export async function readSessionRowData(): Promise<{
  importedAt: string;
  sources: AccountSessionSource[];
} | null> {
  return db.transaction('r', db.rows, db.meta, async () => {
    const meta = await db.meta.get('active');
    if (meta === undefined) return null;

    const keys = await db.rows.orderBy('sourceFile').uniqueKeys();
    // Grouped per ACCOUNT-AND-CATEGORY-AND-FILE triple, in the order first
    // seen, as a Map of Maps of Maps rather than a Map keyed by a joined
    // string: a root name, a folder name and a file name can each contain any
    // character a zip entry name can, and a separator that has to be excluded
    // from all three is one more thing to get wrong. A root may also be named
    // `__proto__`, which a plain object could never be trusted with (T-09-04).
    const grouped = new Map<string, Map<string, Map<string, AccountSessionSource>>>();
    for (const key of keys) {
      // The name-only screen: cheap, index-driven, and the same rule the
      // importer applied. A key it refuses is never read at all.
      if (typeof key !== 'string' || !isSessionFileName(key)) continue;
      const matches = await db.rows.where('sourceFile').equals(key).toArray();
      for (const row of matches) {
        // The full predicate, on the row's own category.
        if (!isSessionsRow(row.category, row.sourceFile)) continue;
        const account = accountOf(row, meta);
        const byCategory = grouped.get(account) ?? new Map();
        byCategory.set(row.category, byCategory.get(row.category) ?? new Map());
        grouped.set(account, byCategory);
        const byFile = byCategory.get(row.category)!;
        const source = byFile.get(row.sourceFile);
        if (source === undefined) {
          byFile.set(row.sourceFile, {
            account,
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
    const sources = [...grouped.values()].flatMap((byCategory) =>
      [...byCategory.values()].flatMap((byFile) => [...byFile.values()]),
    );
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
 * ## Why the grouping has an ACCOUNT level too (D-12, RESEARCH Pitfall 3)
 *
 * Identical to `readSessionRowData`, for the same reason and with the same
 * shape: a file name two accounts share is two sources, each resolving its own
 * columns from its own first row. Grouping by file alone would resolve one
 * account's login header against another's and drop rows the import counted.
 *
 * ## Why the pool is EMPTY for two or more accounts
 *
 * An Account record describes ONE account. A dataset with several has no single
 * "the account", so publishing one account's address as the login pane's
 * account row would present that account as the whole — which is what the D-11
 * caption and UI-SPEC Surface 4 exist to prevent. The IMPORT applies the same
 * rule (`ordered.length === 1` in `ingest.worker.ts`), so the pool is scoped
 * by that same count here and the rebuild stays EQUAL to the import rather than
 * merely close to it — which is the whole point of this reader. A rebuild that
 * added an Account record the import never stored would be a disagreement about
 * the user's own data, and one that would flip on and off with which query ran.
 *
 * The returned `accountRoot` is unchanged: it is the legacy single-account
 * field, and a v1.0 reader still names the first account in D-16 order.
 *
 * ## Why the count comes from the ONE normaliser (D-08, D-22; 09-09 WR-01)
 *
 * "How many accounts does this dataset hold?" is asked here and again by
 * `resultFromMeta`, and the two used to answer it independently — this reader
 * from a nullish-coalesced read of the stored list's own length, which calls an
 * EMPTY list zero accounts, while `accountsOfMeta` calls the same shape one. A
 * one-account dataset whose
 * meta record carries `accounts: []` therefore published an Account record on
 * replay and none on rebuild, depending on which query the user happened to run.
 * Both sides now ask `accountsOfMeta`; the count is no longer a local decision.
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
  sources: AccountLoginSource[];
  accountPool: Record<string, string | undefined>[];
  accountRoot: string;
} | null> {
  return db.transaction('r', db.rows, db.meta, async () => {
    const meta = await db.meta.get('active');
    if (meta === undefined) return null;

    // Grouped per ACCOUNT-AND-CATEGORY-AND-FILE triple, in the order first
    // seen, exactly as the import loop grouped them and exactly as
    // `readSessionRowData` does — see that function for why this is a Map of
    // Maps of Maps and not a joined key.
    const grouped = new Map<string, Map<string, Map<string, AccountLoginSource>>>();
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
        const account = accountOf(row, meta);
        const byCategory = grouped.get(account) ?? new Map();
        byCategory.set(row.category, byCategory.get(row.category) ?? new Map());
        grouped.set(account, byCategory);
        const byFile = byCategory.get(row.category)!;
        const source = byFile.get(row.sourceFile);
        if (source === undefined) {
          byFile.set(row.sourceFile, {
            account,
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
    //
    // Scoped to ONE account, and empty for two or more — see the doc comment
    // above. The account count and the single root BOTH come from
    // `accountsOfMeta`, the ONE normaliser `done`, `duplicate` and `cache-status`
    // go through (D-08, D-22, 09-09 WR-01): an absent OR an EMPTY `accounts` list
    // is one legacy account, so this reader cannot answer "zero accounts" where
    // the replayed result answers one. What the reader DOES with the count is
    // unchanged — still an empty pool for two or more.
    // 09-10, restated because it is the trap this plan exists to avoid: this
    // is `accountsOfMeta`, NOT `accountSummariesOf`. The gate must count ROOTS,
    // so an archive of two roots whose PUBLISHED list is one account still
    // builds no Account record — on the import path and on this rebuild alike.
    const storedAccounts = accountsOfMeta(meta);
    const accountCount = storedAccounts.length;
    const onlyRoot = storedAccounts[0]?.root ?? meta.accountRoot;
    const accountPool: Record<string, string | undefined>[] = [];
    const fallbackPool: Record<string, string | undefined>[] = [];
    if (accountCount === 1) {
      const categories = await db.rows.orderBy('category').uniqueKeys();
      for (const category of categories) {
        if (typeof category !== 'string' || category.toLowerCase() !== USER_INFO_CATEGORY) continue;
        const rows = await db.rows.where('category').equals(category).toArray();
        for (const row of rows) {
          // Scoped by the account-or-legacy rule, so a stray User_Info-shaped
          // row stamped with another root can never be used to describe the one
          // account that IS this dataset.
          if (accountOf(row, meta) !== onlyRoot) continue;
          // 12-08 (research Finding 4, T-12-25): a family file stores a
          // past-nickname column on purpose (the name history), so it is never
          // a pool row. ingest.worker.ts skips it at the same point on import;
          // the two paths must agree ("rebuild equals import", Phase 9).
          if (isNewDataFile(row.sourceFile)) continue;
          if (row.sourceFile.toLowerCase().endsWith(ACCOUNT_INFO_SUFFIX)) {
            accountPool.push(row.data);
          } else {
            fallbackPool.push(row.data);
          }
        }
      }
    }
    if (accountPool.length === 0) accountPool.push(...fallbackPool);

    return {
      importedAt: meta.importedAt,
      sources: [...grouped.values()].flatMap((byCategory) =>
        [...byCategory.values()].flatMap((byFile) => [...byFile.values()]),
      ),
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
  /**
   * The rows of each requested file, grouped per ACCOUNT then per file.
   *
   * The account is the outermost level for the reason the session and login
   * readers already carry (09-03, and CR-01 below): every consumer resolves its
   * columns from the FIRST row's keys, and two accounts' same-named files carry
   * their own headers.
   */
  rows: Map<string, AccountRowGroup[]>;
  /**
   * The roots of the stored account list, in stored order (one legacy root for an
   * absent or empty list), from `accountsOfMeta` like every other reader.
   *
   * It is the identity header's order, which is what breaks a tie between two
   * accounts' entries at the same instant in the Account timeline (UI-SPEC
   * Recorded Choice 2): the worker can sort once, in the pure builder, instead of
   * the page re-sorting a posted list.
   */
  accounts: readonly string[];
  /**
   * The meta record's playtime aggregate, read in the SAME transaction as the
   * rows above (13-01, D-01, T-13-04).
   *
   * A channel that needs it must never take a second snapshot: the answer and
   * its rows would then be able to describe two different datasets. So the
   * aggregate rides this read rather than being fetched separately.
   *
   * `null` means the dataset holds no stored aggregate at all — a cache whose
   * aggregation produced nothing, or a legacy dataset. It does NOT mean the
   * export has no session history: the caller rebuilds from the stored session
   * rows when it is absent or stale, and only then is the answer "no
   * sessions".
   */
  playtime?: PlaytimeAggregates | null;
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
 * ## Why rows are grouped per ACCOUNT, and what merging still means (D-11, D-12)
 *
 * Rows are grouped per account AND per file, in first-seen account order, with
 * each group's rows in stored order. The account is the OUTERMOST level for the
 * reason `readSessionRowData` already carries (09-03, RESEARCH Pitfall 3): every
 * consumer resolves its columns from the FIRST row's keys and then reads every
 * row through those keys, so a key may never cross an account boundary. Two
 * accounts' same-named CSVs carry their OWN headers — a real archive revision
 * writes `OS` where another wrote `OPERATING_SYSTEM`, `BATTLES_COUNT` where
 * another wrote `GAMES_PLAYED` — and resolving one account's keys for both
 * reports the other account's real values as ABSENT while its file is plainly in
 * the archive. That is CR-01, and it is a false statement about the user's own
 * data (DATA-04).
 *
 * ### What merging still means, because it is NOT this reader's job (D-11, D-12)
 *
 * Grouping is not slicing. Every pane fed by this reader still shows ALL
 * accounts' rows in Phase 9, with the "N accounts combined" caption so none of
 * them presents one account as the whole. Two consequences are worth naming
 * because they are correct and will look like bugs:
 *
 *   - A file name two accounts contribute is ONE entry here, so a code two
 *     accounts both wrote is TWO summary rows with the SAME code — asserted
 *     (D-12), not accidental. De-duplicating them would be a claim about which
 *     account won more.
 *   - Presence is an OR fold over the accounts' facts (`isPresent`), so the
 *     same file recorded by three accounts cannot flip a title's state: a
 *     repeated fact is idempotent by construction, not by a guard.
 *
 * Phase 10 owns the rest: per-account slicing of the panes, merging vehicles by
 * id rather than by row, and finance totals per currency (D-12).
 *
 * ### Why this reader USED not to read `row.account`, in one line
 *
 * Because the consumer-side premise was wrong, not because the field was
 * optional. The comment this section replaces asserted that the vehicles,
 * finance, payments and device-info channels were "builders over rows that carry
 * no header to resolve, so merging them changes no parse". Four of them DO
 * resolve a header, and they resolved it off one account's first row. A wrong
 * invariant written here is what let that survive code review the first time, so
 * it is stated above as what the reader does rather than as what it may assume.
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
    const rows = new Map<string, AccountRowGroup[]>();
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      const name = key.toLowerCase();
      // The name-only screen: cheap, index-driven. A name nobody asked for is
      // never read at all, so the cost of this reader tracks the files that
      // were requested rather than the size of the dataset.
      if (!names.has(name)) continue;
      const matches = await db.rows.where('sourceFile').equals(key).toArray();
      // Grouped per ACCOUNT inside this file, in the order first seen, as a Map
      // keyed by the root name rather than a joined account-and-file string: a
      // root may be named `__proto__`, and a joined key is one more collision
      // to get wrong (T-09-27). The account of a row is `row.account ??
      // meta.accountRoot` through the SAME `accountOf` helper the session and
      // login readers call, so the account-or-legacy rule is stated once.
      const byAccount = new Map<string, AccountRowGroup>();
      for (const row of matches) {
        if (!wanted.has(row.category.toLowerCase())) continue;
        const account = accountOf(row, meta);
        const group = byAccount.get(account);
        if (group === undefined) {
          byAccount.set(account, { account, rows: [row.data] });
        } else {
          // The accumulator behind the readonly group rows; see the same
          // pattern in the session reader above.
          (group.rows as Record<string, string | undefined>[]).push(row.data);
        }
      }
      if (byAccount.size > 0) rows.set(name, [...byAccount.values()]);
    }
    return {
      importedAt: meta.importedAt,
      files: meta.files ?? null,
      rows,
      accounts: accountsOfMeta(meta).map((account) => account.root),
      // 13-01, T-13-04. The aggregate is read HERE, inside this transaction,
      // so a channel that needs it answers from the same snapshot as its rows
      // and can never mix two datasets. An absent aggregate is null, not
      // undefined, so "no stored aggregate" has one spelling.
      playtime: meta.playtime ?? null,
    };
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

/**
 * Delete every stored row of a category this build does NOT support, and
 * return how many rows went (D-21).
 *
 * ## Why this exists
 *
 * D-18 (plan 09-02) stops NEW imports from writing rows of an unknown or
 * known-deferred category. It does nothing for a user who already imported
 * with v1.0: their cache still holds the real `Game_Forums` rows with their
 * `EMAIL` and `IP_ADDRESS` columns, and their `Chat_History` rows with their
 * message text — neither of which is on the three-column deny-list, so nothing
 * ever stripped them. Those rows are unread by every reader, which is exactly
 * why leaving them is indefensible: data at rest that nothing can use and
 * nothing can remove. D-21 removes them on load, which is the single point
 * where a returning user's cache is opened.
 *
 * ## Why it is NOT a Dexie version bump
 *
 * The obvious alternative — `version(3)` with an `upgrade` callback — would
 * cost every returning user their WHOLE cached dataset to delete a subset of
 * it: their rows, their identity, their imported-at, all of which are still
 * correct. The `version(2)` upgrader already exists and already wipes, for the
 * Phase-2 caches that held a raw email; the 06-01 precedent is that a purely
 * derived change costs a re-import and nothing else. So this is a delete
 * function called from the worker's check-cache path, and `db.verno` stays 2
 * — a property `tests/unit/import/db.test.ts` pins.
 *
 * ## Why the decision is made on the ROW, never on the cached status
 *
 * `meta.categories[].status` is a CACHE OF A CLASSIFICATION, and
 * `resultFromMeta` re-derives every one of them at read time precisely because
 * a stored status can be stale. Deciding from it here would delete rows a
 * folder's current classification says are supported. So the rule is
 * `classifyFolder` on the stored row's OWN category string, which also means
 * each CASING is its own index key judged on its own: `Activity_HISTORY` and
 * `financial_data` are supported and survive, while `CHAT_HISTORY` and
 * `game_forums` are not and go.
 *
 * ## Why the transaction's scope is the rows store ALONE
 *
 * `db.meta` is deliberately not opened here, so the meta record — every
 * category's `rowCount` and `skippedRowCount`, the aggregates, the identity
 * and `importedAt` — stays exactly as written. That is what keeps the "Not yet
 * supported" banners showing their counts after a purge, identically to what a
 * fresh D-18 import shows for the same archive.
 *
 * ## Idempotence, and what a later promotion costs
 *
 * A second run finds no unsupported key and returns 0: the function is a
 * no-op by construction rather than by a guard. A category a later phase
 * PROMOTES to supported needs its rows stored again, which means a re-import —
 * the same price Phase 5 and Phase 6's derived fields paid, and cheaper than
 * the alternative of keeping rows nobody has consented to.
 *
 * An empty database is a no-op too: the index walk returns nothing and the
 * transaction commits without a write.
 */
export async function purgeUnsupportedCategoryRows(): Promise<number> {
  return db.transaction('rw', db.rows, async () => {
    // The index walk `readSessionRowData` already uses: index-only, and the
    // list form of the query must never appear in this file (its cost is a
    // function of the number of KEYS, not of the rows).
    const keys = await db.rows.orderBy('category').uniqueKeys();
    let deleted = 0;
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      if (classifyFolder(key) === 'supported') continue;
      // One single-key delete per unsupported category, summing the counts
      // Dexie returns. A category with no rows deletes nothing.
      deleted += await db.rows.where('category').equals(key).delete();
    }
    return deleted;
  });
}

/**
 * Do two stored row bodies hold the same keys and the same cells?
 *
 * Key ORDER is not compared: the projection writes its keys in the row's own
 * order, so an already-narrowed row produces the same object again, and a row
 * whose keys merely arrive in a different order is not a change. `hasOwnProperty`
 * rather than a `key in b` test, because `in` answers true for `__proto__`
 * through the prototype chain and a legacy row may hold that key.
 */
function sameRowData(
  stored: Record<string, string | undefined>,
  projected: Record<string, string | undefined>,
): boolean {
  const keys = Object.keys(stored);
  if (keys.length !== Object.keys(projected).length) return false;
  return keys.every((key) => Object.hasOwn(projected, key) && stored[key] === projected[key]);
}

/**
 * The identity of one stored group of rows: the account that owns them, the
 * lower-cased file name and the lower-cased category.
 *
 * A joined string rather than a nested Map, because unlike the session reader's
 * grouping this key is never looked up in a plain object — a `Map` holds any
 * string, so a root named `__proto__` is an ordinary key here (T-09-04). The
 * separator is a NUL, which cannot occur in a zip entry name, a folder name or a
 * file name.
 */
function narrowGroupKey(account: string, sourceFile: string, category: string): string {
  return `${account} ${sourceFile.toLowerCase()} ${category.toLowerCase()}`;
}

/**
 * Narrow every already-stored row of a new-game FAMILY file to its allowlist
 * projection, deleting the rows that should no longer exist, and put the
 * presence facts back in agreement with the rows they describe. Returns the
 * number of rows deleted plus rewritten (plan 11-04, D-14/D-15).
 *
 * ## Why this exists
 *
 * The per-file column allowlist stops NEW imports from writing a column the spec
 * does not name. It does nothing for a user who imported before it existed: their
 * cache still holds the WOWP account rows' nickname-like `NAME`, and every other
 * column of every HEAT, WoT Console and Warplanes file that 11-03's specs exclude
 * — data at rest that no reader uses and nothing else would ever remove. This is
 * the removal, on the same single point where `purgeUnsupportedCategoryRows`
 * already runs: the returning visit's cache read.
 *
 * ## Why the decision is made on the ROW's own name and category
 *
 * Exactly the rule `purgeUnsupportedCategoryRows` follows, for the same reason:
 * a cached classification can be stale, while the row's own `sourceFile` and
 * `category` are what it really was read from. So `isNewDataFile` screens the
 * `sourceFile` index BY NAME (cheap, index-driven, and a non-family name is
 * never read at all), and the spec is looked up with the row's OWN category — so
 * a copy of a family file filed under a different folder is judged on the pair it
 * really has, and a family file this build has no spec for stores nothing.
 *
 * ## Why there are TWO walks (phase 12, D-03)
 *
 * The walk by NAME above misses a promoted folder entirely: `Bans`,
 * `Bonus_Codes`, `Personal_Coupons`, `Subscriptions`, `Authorized_Third_Parties`
 * and `Surveys` hold files whose names the app does not list, and an unlisted
 * name is not a family name. Promoting the folder is also exactly what makes the
 * D-21 purge stop deleting its legacy rows (the purge only removes categories
 * that are NOT supported), so without a second walk a v1.0 cache would keep those
 * rows — IPs, codes, possibly emails — at rest for good. The second walk goes
 * over the `category` index, `isFamilyCategory`, and decides every group the
 * name walk did not already visit. It is index-only for the same reason the
 * first is: the keys are read from the index, and only a family category's rows
 * are ever loaded.
 *
 * Both walks hand each group to ONE local function, so the delete-or-project
 * decision is a single piece of code. It is also the same pair of functions
 * (`specFor`, `projectRow`) the import calls, so an import and a narrowing of
 * the same rows cannot disagree.
 *
 * The group is per ACCOUNT as well as per category, because two accounts
 * contribute the same file name (D-12) and one account's drifted header must not
 * delete the other account's good rows.
 *
 * ## Why the file match is decided per GROUP, from the rows themselves
 *
 * `fileMatchesSpec` asks which HEADERS the file carried, so it is asked once per
 * group over the stored rows rather than per row — the same per-file decision
 * the import makes, so a narrow here and a narrow at import cannot disagree. A
 * group that matches nothing is deleted outright, because a row this build would
 * not have stored must not survive at rest.
 *
 * ## Why the transaction opens `db.meta` although the purge does not
 *
 * Because the presence facts must agree with the rows they describe. A fact that
 * still said five rows beside a table holding one would be a false statement
 * about the user's own data — the very claim D-09's `parsedRowCount` exists to
 * make honest. `purgeUnsupportedCategoryRows` can leave meta alone because it
 * leaves the unsupported folders' category counts intact; this step CHANGES the
 * stored row counts of files it already described, so it must move their facts in
 * the same transaction. Only `files` and `accounts[].files` are touched: the
 * hash, the identity, the aggregates, the categories and `importedAt` are spread
 * through untouched, and the record is written ONLY when a fact actually changed.
 *
 * A fact whose `parsedRowCount` is absent — every fact a pre-11-04 build wrote —
 * reads its OLD `rowCount` as the parsed count, which is what that field meant
 * then. A reader still treats an absent field as "parsed equals stored", so no
 * information is invented and no legacy cache is left in a state nothing
 * understands.
 *
 * ## Idempotence
 *
 * A row is rewritten only when its projection DIFFERS from what it holds, so a
 * second run finds every row already narrow, writes nothing, and returns 0; the
 * facts are then already equal to the stored counts, so the meta record is not
 * rewritten either. The step is a no-op by construction rather than by a guard,
 * which is what makes it safe to run on every page load. An empty database is a
 * no-op too: no meta record means no facts to keep in agreement.
 *
 * ## Why this is NOT a Dexie version bump
 *
 * `version(3)` with an `upgrade` callback would cost every returning user their
 * WHOLE cached dataset — rows, identity, imported-at — to narrow a subset of
 * their rows, and the `version(2)` upgrader already wipes. This is a data
 * operation on records whose shape is unchanged, exactly as the purge is:
 * `db.verno` stays 2, the `version(2)` upgrader is untouched, and a property
 * `tests/unit/import/db.test.ts` pins. A row this step deletes is recoverable by
 * re-importing the archive, which is the same price the D-21 purge named.
 */
export async function narrowStoredNewDataRows(): Promise<number> {
  return db.transaction('rw', db.rows, db.meta, async () => {
    const meta = await db.meta.get('active');
    // No dataset, no facts, nothing to narrow.
    if (meta === undefined) return 0;

    // How many rows each group HOLDS once this run is done, keyed as in
    // `narrowGroupKey`. A group absent from this map was never visited, so its
    // facts are left exactly as written. Summed, because two index keys that
    // differ only in letter case are one group as far as the facts go.
    const stored = new Map<string, number>();
    let changed = 0;

    /**
     * Decide one group and act on it: the ONE copy of the delete-or-project
     * rule, shared by the name walk and the category walk so the two cannot
     * disagree about what a row is allowed to keep.
     */
    const narrowGroup = async (
      groupKey: string,
      group: DatasetRow[],
      sourceFile: string,
    ): Promise<void> => {
      const spec = specFor(group[0]!.category, sourceFile);
      // No spec for this name in this category, or headers that match no
      // column of it: rows a current import would not have stored must not
      // survive at rest (D-15). Decided for the GROUP, so one account's
      // drifted copy cannot delete its sibling's rows.
      //
      // 12-08: a group whose every row is ALREADY an empty object is a file an
      // import stored whose allowlisted cells were all dropped (the email guard,
      // or an all-blank column). It has no header left to match, but it holds
      // nothing either, and deleting it on the SECOND run would make the
      // narrowing differ from the import that wrote it. So it is left alone.
      const alreadyEmpty = group.every((row) => Object.keys(row.data).length === 0);
      if (
        spec === null ||
        (!alreadyEmpty &&
          !fileMatchesSpec(
            group.map((row) => row.data),
            spec,
          ))
      ) {
        await db.rows.bulkDelete(group.map((row) => row.id!));
        changed += group.length;
        stored.set(groupKey, stored.get(groupKey) ?? 0);
        return;
      }
      const narrowed: DatasetRow[] = [];
      for (const row of group) {
        const projected = projectRow(row.data, spec);
        // Only the CHANGED rows are written: that is what makes a second run
        // write nothing at all.
        if (sameRowData(row.data, projected)) continue;
        // The spread keeps `id`, `category`, `sourceFile`, `rowIndex` and
        // `account` — this is the same row, narrower, never a replacement that
        // would renumber the file or move it to another account (D-12).
        (narrowed as DatasetRow[]).push({ ...row, data: projected });
      }
      if (narrowed.length > 0) {
        await db.rows.bulkPut(narrowed);
        changed += narrowed.length;
      }
      stored.set(groupKey, (stored.get(groupKey) ?? 0) + group.length);
    };

    /** Group rows by (account, file, category), the identity the facts use. */
    const groupRows = (
      rows: readonly DatasetRow[],
      fileOf: (row: DatasetRow) => string,
    ): Map<string, DatasetRow[]> => {
      const groups = new Map<string, DatasetRow[]>();
      for (const row of rows) {
        const groupKey = narrowGroupKey(accountOf(row, meta), fileOf(row), row.category);
        const group = groups.get(groupKey);
        // The accumulator behind the array; see the same pattern in the readers
        // above.
        if (group === undefined) groups.set(groupKey, [row]);
        else (group as DatasetRow[]).push(row);
      }
      return groups;
    };

    // Walk 1, by NAME. The index walk this file already uses: index-only, and
    // the LIST form of a `sourceFile` query must never appear here (its cost is
    // a function of the number of KEYS, not of the rows — RESEARCH Pattern 2,
    // measured).
    const visited = new Set<string>();
    const keys = await db.rows.orderBy('sourceFile').uniqueKeys();
    for (const key of keys) {
      if (typeof key !== 'string' || !isNewDataFile(key)) continue;
      const matches = await db.rows.where('sourceFile').equals(key).toArray();
      if (matches.length === 0) continue;

      for (const [groupKey, group] of groupRows(matches, () => key)) {
        visited.add(groupKey);
        await narrowGroup(groupKey, group, key);
      }
    }

    // Walk 2, by CATEGORY (phase 12, D-03). A promoted folder's files can carry
    // any name, and an unlisted name is not a family name, so the walk above
    // never reads them. Index-only again, with the same `uniqueKeys` form the
    // purge uses. A group the name walk already decided is skipped: its rows
    // were judged on the same pair by the same function.
    const categories = await db.rows.orderBy('category').uniqueKeys();
    for (const category of categories) {
      if (typeof category !== 'string' || !isFamilyCategory(category)) continue;
      const matches = await db.rows.where('category').equals(category).toArray();
      if (matches.length === 0) continue;

      for (const [groupKey, group] of groupRows(matches, (row) => row.sourceFile)) {
        if (visited.has(groupKey)) continue;
        await narrowGroup(groupKey, group, group[0]!.sourceFile);
      }
    }

    // The facts, in both lists that hold them. A fact is rewritten ONLY when its
    // group was visited and the counts disagree, so an idempotent run leaves the
    // record's own bytes alone.
    const rewrite = (
      files: DatasetFile[] | null | undefined,
    ): { files: DatasetFile[] | null | undefined; changed: boolean } => {
      if (files === null || files === undefined) return { files, changed: false };
      let touched = false;
      const next = files.map((file) => {
        if (!isNewDataFile(file.sourceFile) && !isFamilyCategory(file.category)) return file;
        const count = stored.get(
          narrowGroupKey(file.account ?? meta.accountRoot, file.sourceFile, file.category),
        );
        if (count === undefined) return file;
        // A fact written before `parsedRowCount` existed said "rows stored",
        // which for a family file is exactly how many rows it PARSED.
        const parsedRowCount = file.parsedRowCount ?? file.rowCount;
        if (file.rowCount === count && file.parsedRowCount === parsedRowCount) return file;
        touched = true;
        return { ...file, rowCount: count, parsedRowCount };
      });
      return { files: touched ? next : files, changed: touched };
    };

    const flattened = rewrite(meta.files);
    let accounts: AccountMeta[] | null | undefined = meta.accounts;
    let accountsChanged = false;
    if (Array.isArray(accounts)) {
      const next = accounts.map((account) => {
        const result = rewrite(account.files);
        if (!result.changed) return account;
        accountsChanged = true;
        return { ...account, files: result.files as DatasetFile[] };
      });
      if (accountsChanged) accounts = next;
    }

    if (flattened.changed || accountsChanged) {
      await db.meta.put({
        ...meta,
        files: flattened.files,
        accounts,
      });
    }
    return changed;
  });
}
