/// <reference lib="webworker" />
import { unzipSync } from 'fflate';
import type {
  CategoryEntry,
  ClassifyResult,
  IngestRequest,
  IngestResponse,
  ParsingProgress,
  WorkerScopeLike,
} from '../types/worker-messages.ts';
import { analyzeExport, resolveCsvFileCategory } from './classify.ts';
import { CATEGORY_STATUS_ORDER } from './categories.ts';
import { listEntryPaths } from './zip-paths.ts';
import { digestFile } from './hash.ts';
import { parseCsvFile } from './csv-parse.ts';
import { extractIdentity, isUserInfoCategory, sanitizeUserInfoRow } from './identity.ts';
import { checkCache, clearData, writeDataset, type DatasetMeta, type DatasetRow } from './db.ts';

const scope = self as unknown as WorkerScopeLike;

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
};

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
 */
function resultFromMeta(meta: DatasetMeta): ClassifyResult {
  return {
    accountRoot: meta.accountRoot,
    categories: meta.categories,
    counts: recomputeStatusCounts(meta.categories),
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

    scope.postMessage({ type: 'stage', jobId, stage: 'writing' } satisfies IngestResponse);
    const { importedAt } = await writeDataset(
      hash,
      outcome.result.accountRoot,
      updatedCategories,
      allRows,
      identity,
    );

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
