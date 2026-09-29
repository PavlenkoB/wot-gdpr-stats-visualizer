import Dexie, { type Table, type Transaction } from 'dexie';
import type { AccountIdentity, CategoryEntry } from '../types/worker-messages.ts';

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
}

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
 */
export async function writeDataset(
  hash: string,
  accountRoot: string,
  categories: CategoryEntry[],
  rows: DatasetRow[],
  identity: AccountIdentity | null = null,
): Promise<{ importedAt: string }> {
  const importedAt = new Date().toISOString();
  await db.transaction('rw', db.rows, db.meta, async () => {
    await db.rows.clear();
    for (let i = 0; i < rows.length; i += ROWS_PER_BULKPUT_CHUNK) {
      await db.rows.bulkPut(rows.slice(i, i + ROWS_PER_BULKPUT_CHUNK));
    }
    await db.meta.put({ id: 'active', hash, accountRoot, importedAt, categories, identity });
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
