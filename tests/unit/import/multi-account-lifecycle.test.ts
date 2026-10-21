import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import {
  MA_CHAT_CANARY,
  MA_EXPECTED_SESSION_COUNT,
  MA_FORUM_EMAIL_CANARY,
  MA_FORUM_IP_CANARY,
  MA_NICKNAME_EU,
  MA_ROOT_EU,
  MA_ROOT_NA,
  MA_ROOT_RU,
  MA_UNKNOWN_FOLDERS,
  buildOneAccountExport,
  buildRealShapeThreeAccountExport,
  buildTwoAccountExport,
} from '../../fixtures/multi-account-fixtures.ts';
import {
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_NICKNAME,
  buildSampleExport,
} from '../../fixtures/export-fixtures.ts';
import { classifyFolder } from '../../../src/lib/worker/categories.ts';
import { viewFromAggregates } from '../../../src/lib/features/playtime/playtime-aggregate.ts';
import { viewFromLogins } from '../../../src/lib/features/logins/login-aggregate.ts';
import type { LoginAggregates, LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import type {
  DataQuery,
  DataResult,
  IngestRequest,
  IngestResponse,
  PlaytimeAggregates,
  PlaytimeView,
} from '../../../src/lib/core/types/worker-messages.ts';
import type { AccountSessionSource } from '../../../src/lib/worker/db.ts';

// =============================================================================
// multi-account-lifecycle.test.ts — the ONE dataset, end to end (Phase 9, 09-03)
//
// Plan 09-02 made the IMPORT account-aware: every stored row carries the root
// that owns it and the meta record carries the ordered account list. This file
// covers the other side of ACCOUNT-03 and ACCOUNT-08 — everything that READS
// those rows back, and the whole lifecycle around them:
//
//   - the lazy rebuilds (playtime, logins) answer exactly what the import did,
//     even when two accounts contribute the SAME file name with DIFFERENT
//     headers (RESEARCH Pitfall 3);
//   - the login Account record exists only for a one-account dataset;
//   - reload / duplicate / replace / clear / an interrupted write behave with
//     one, two and three accounts;
//   - a returning v1.0 cache is purged of its unsupported-category rows on load
//     (D-21), without losing a supported row or touching the meta record.
//
// It is a WORKER test rather than a pure-function test because none of those is
// observable without the real module, a real archive and a real store: the
// guarantees are about what reaches IndexedDB and what crosses to the main
// thread. Every archive is synthetic
// (`tests/fixtures/multi-account-fixtures.ts`).
// =============================================================================

const RED_TIMEOUT_MS = 10_000;

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/**
 * Ingest one export and assert the terminal reply was `done`.
 *
 * The spy is cleared first, and that is load-bearing rather than cosmetic:
 * `waitForTerminal` scans the whole call history, so a second import in one
 * test would otherwise answer with the FIRST import's `done`.
 */
async function ingestDone(
  bytes: Uint8Array,
  name = 'export.zip',
): Promise<Extract<IngestResponse, { type: 'done' }>> {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
  if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
  return terminal;
}

/** Post one playtime query and return the view it answered with. */
async function askPlaytime(
  queryId: number,
  valueIndex: number | null = null,
): Promise<PlaytimeView> {
  post.mockClear();
  postRequest({ type: 'playtime-query', queryId, valueIndex } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < RED_TIMEOUT_MS) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'playtime-error') {
        throw new Error(`expected a playtime-result, got playtime-error (${msg.detail})`);
      }
      if (msg?.type === 'playtime-result' && msg.queryId === queryId) {
        if (msg.view === null) throw new Error('the worker answered a null playtime view');
        return msg.view;
      }
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askPlaytime(${queryId}): no reply within ${RED_TIMEOUT_MS} ms`);
}

/** Post one logins data-query and return the view it answered with. */
async function askLogins(queryId: number): Promise<LoginsView> {
  post.mockClear();
  postRequest({
    type: 'data-query',
    queryId,
    query: { channel: 'logins' },
  } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < RED_TIMEOUT_MS) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-error') {
        throw new Error(`expected a data-result, got data-error (${msg.detail})`);
      }
      if (msg?.type === 'data-result' && msg.queryId === queryId) {
        if (msg.result === null) throw new Error('expected a logins result, got null');
        if (msg.result.channel !== 'logins') {
          throw new Error(`expected the logins channel, got ${msg.result.channel}`);
        }
        return msg.result.view;
      }
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askLogins(${queryId}): no reply within ${RED_TIMEOUT_MS} ms`);
}

/**
 * Delete a stored aggregate — the state a returning user's cache is really in
 * when a build that knew nothing about it wrote the dataset, or when the
 * aggregation threw at import (T-04-03 discipline).
 */
async function deleteAggregate(field: 'playtime' | 'logins'): Promise<void> {
  const { db } = await importWorkerDb();
  // Two branches rather than a computed key: a computed `{ [field]: null }` is
  // not assignable to Dexie's `UpdateSpec<DatasetMeta>`, and a cast to
  // `Record<string, null>` would erase the very typing that makes a typo in the
  // field name a compile error.
  if (field === 'playtime') await db.meta.update('active', { playtime: null });
  else await db.meta.update('active', { logins: null });
  expect((await db.meta.get('active'))?.[field]).toBeNull();
}

/** The stored aggregate, or a named failure. */
async function storedAggregate<T>(field: 'playtime' | 'logins'): Promise<T> {
  const { db } = await importWorkerDb();
  const value = (await db.meta.get('active'))?.[field] as T | null | undefined;
  if (value == null) throw new Error(`no stored ${field} aggregate`);
  return value;
}

/**
 * Compile-time use of the two exported account-aware source interfaces.
 *
 * The field the readers stamp is `account`, and this is where the type is
 * asserted rather than by a cast at the use site: if a future plan narrows the
 * interface back to the bare `SessionSource`, this file stops type-checking.
 */
const _sourceTypes: readonly [AccountSessionSource, AccountSessionSource] = [
  { account: '', game: null, rows: [] },
  { account: '', game: null, rows: [] },
];
void _sourceTypes;

// =============================================================================
// Task 1 — rebuild equals import
// =============================================================================

describe('Phase 9 lifecycle: rebuild equals import', () => {
  it('rebuilds a deleted playtime aggregate to exactly the import-time view', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const remembered = await storedAggregate<PlaytimeAggregates>('playtime');

    await deleteAggregate('playtime');
    const rebuilt = await askPlaytime(1);

    // Equality, not a spot check: two aggregates built over the same rows by
    // the same function in two different places must be indistinguishable, or
    // "deleted aggregate" becomes a different dataset as far as a reader can
    // tell.
    expect(rebuilt).toEqual(viewFromAggregates(remembered, null));

    // Written back, so the next query is a single-key read again — and it is
    // the AGGREGATE that is compared, not only the view.
    expect(await storedAggregate<PlaytimeAggregates>('playtime')).toEqual(remembered);
  });

  it('counts every usable session of every account, including the one with a different header', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const remembered = await storedAggregate<PlaytimeAggregates>('playtime');

    await deleteAggregate('playtime');
    const rebuilt = await askPlaytime(2);
    if (rebuilt.status !== 'ready') throw new Error(`expected ready, got ${rebuilt.status}`);

    // THE teeth. The NA root's `WOT_Game_Sessions.csv` carries the ALIAS header
    // (`SESSION_START;SESSION_END;IP`), so a reader that merged the three
    // roots' same-named file into ONE source would resolve the columns from
    // whichever row landed first and EXCLUDE every row read through a column
    // that file does not have — 12 usable sessions instead of 13, silently.
    expect(rebuilt.slice.sessions).toBe(MA_EXPECTED_SESSION_COUNT);
    expect(rebuilt.slice.excluded).toBe(0);
    expect(rebuilt.slice.sessions).toBe(remembered.all.sessions);
    expect(rebuilt.slice.seconds).toBe(remembered.all.seconds);
  });

  it('rebuilds a deleted logins aggregate to exactly the import-time view', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const remembered = await storedAggregate<LoginAggregates>('logins');
    const atImport = viewFromLogins(remembered);

    await deleteAggregate('logins');
    const rebuilt = await askLogins(3);

    expect(rebuilt).toEqual(atImport);
    expect(await storedAggregate<LoginAggregates>('logins')).toEqual(remembered);
  });

  it('gives readSessionRowData one source per account for a repeated file name', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const { readSessionRowData } = await importWorkerDb();

    const snapshot = await readSessionRowData();
    if (snapshot === null) throw new Error('no stored dataset');

    // The three roots all contribute a `WOT_Game_Sessions.csv`, and they are
    // THREE sources rather than one — each carrying the account that owns it,
    // so the aggregator resolves each one's columns from its OWN first row.
    // That is what makes the rebuild agree with the import even though the NA
    // root's copy has a different header.
    const wot = snapshot.sources.filter((source) => source.game === 'WOT');
    expect(wot.map((source) => source.account).sort()).toEqual(
      [MA_ROOT_EU, MA_ROOT_NA, MA_ROOT_RU].sort(),
    );
    for (const source of wot) expect(source.rows.length).toBeGreaterThan(0);

    // And every stored session row is in exactly one of them — nothing dropped
    // and nothing counted twice. The header-only `WOWS_Game_Sessions.csv` stores
    // no row, so the row count is what the table holds, not the file count.
    const rowsInSources = snapshot.sources.reduce((sum, s) => sum + s.rows.length, 0);
    expect(rowsInSources).toBe(await storedSessionRows());
  });
});

/** The stored rows of every session file, counted straight off the table. */
async function storedSessionRows(): Promise<number> {
  const { db } = await importWorkerDb();
  const rows = await db.rows.toArray();
  return rows.filter((row) => /_game_sessions\.csv$/i.test(row.sourceFile)).length;
}

// =============================================================================
// Task 2 — the Account record, and the merging channels
// =============================================================================

/** Post one data-query and return the `data-result` it answered with. */
async function askData(queryId: number, query: DataQuery): Promise<DataResult> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId, query } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < RED_TIMEOUT_MS) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-error') {
        throw new Error(`expected a data-result, got data-error (${msg.detail})`);
      }
      if (msg?.type === 'data-result' && msg.queryId === queryId) {
        if (msg.result === null) throw new Error('expected a result, got null');
        return msg.result;
      }
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askData(${queryId}): no reply within ${RED_TIMEOUT_MS} ms`);
}

describe('Phase 9 lifecycle: readers and the Account record', () => {
  it('builds the Account record for a ONE-account dataset and rebuilds the same one', async () => {
    await ingestDone(buildOneAccountExport(), 'one.zip');
    const atImport = await storedAggregate<LoginAggregates>('logins');
    expect(atImport.account).not.toBeNull();
    if (atImport.account === null) throw new Error('unreachable: asserted above');

    await deleteAggregate('logins');
    const rebuilt = await askLogins(10);
    if (rebuilt.status !== 'ready') throw new Error(`expected ready, got ${rebuilt.status}`);

    // Equality again: the rebuild must not lose the record the import had.
    expect(rebuilt.account).toEqual(atImport.account);
    expect(await storedAggregate<LoginAggregates>('logins')).toEqual(atImport);
  });

  it('builds NO Account record for a two-or-more-account dataset, at import or on rebuild', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const atImport = await storedAggregate<LoginAggregates>('logins');
    // THE rule (UI-SPEC Surface 4): an Account record describes ONE account,
    // so a dataset of several has none. Presenting one account's address as the
    // login pane's account row is the D-11 transparency failure.
    expect(atImport.account).toBeNull();

    await deleteAggregate('logins');
    const rebuilt = await askLogins(11);
    if (rebuilt.status !== 'ready') throw new Error(`expected ready, got ${rebuilt.status}`);
    expect(rebuilt.account).toBeNull();
  });

  it('scopes the one-account pool to that account, ignoring a stray row of another root', async () => {
    await ingestDone(buildOneAccountExport(), 'one.zip');
    const { db, readLoginRowData } = await importWorkerDb();

    const before = await readLoginRowData();
    expect(before?.accountPool.length).toBeGreaterThan(0);

    // A hand-written User_Info-shaped row stamped with ANOTHER root. Nothing in
    // the import path can produce it; it is here because a reader that pooled
    // every account's rows would build this dataset's Account record out of a
    // row that belongs to nobody.
    await db.rows.add({
      category: 'User_Info',
      sourceFile: 'Account_Info.csv',
      rowIndex: 99,
      account: '999999999999',
      data: { ID: '999999999999', NAME: 'Stray Other Account', IP: '198.51.100.77' },
    });

    const after = await readLoginRowData();
    expect(after?.accountPool.length).toBe(before?.accountPool.length);
    expect(after?.accountPool.map((row) => row.ID)).not.toContain('999999999999');
    // `accountRoot` is unchanged by the scoping — it is the legacy field, and
    // the record is still built against the dataset's own account.
    expect(after?.accountRoot).toBe(MA_ROOT_EU);
  });

  it('answers "how many accounts" with the ONE normaliser, on an EMPTY list (WR-01)', async () => {
    await ingestDone(buildOneAccountExport(), 'one.zip');
    const { db, readLoginRowData, writeDataset } = await importWorkerDb();

    // Re-write through the SAME helper the import uses, with an EMPTY accounts
    // list. `accountsOfMeta` normalises that shape to ONE account built from the
    // legacy fields (D-22), so a reader that counts `meta.accounts?.length ?? 1`
    // answers zero where the cached result answers one — the two paths
    // disagreeing about the user's own dataset (09-09, WR-01, T-09-29).
    const stored = await db.meta.get('active');
    if (stored === undefined) throw new Error('no stored meta record');
    await writeDataset(
      stored.hash,
      stored.accountRoot,
      stored.categories,
      await db.rows.toArray(),
      stored.identity ?? null,
      stored.playtime ?? null,
      stored.files ?? null,
      stored.logins ?? null,
      [],
    );
    expect((await db.meta.get('active'))?.accounts).toEqual([]);

    // Side A — the replayed result: one account, from the legacy root.
    const cached = await checkCache();
    if (cached.cached === null) throw new Error('the cache was wiped instead of replayed');
    expect(cached.cached.accounts).toHaveLength(1);
    expect(cached.cached.accounts?.[0]?.root).toBe(MA_ROOT_EU);

    // Side B — the login rebuild: same count, and therefore the same pool.
    // A rebuild that published NO account for a one-account dataset would drop
    // the Account record the import stored.
    const rebuilt = await readLoginRowData();
    expect(rebuilt?.accountPool.length).toBeGreaterThan(0);
  });

  it('keeps the pool EMPTY for two accounts and present for a v1.0 cache, through the same normaliser', async () => {
    const { db, readLoginRowData, writeDataset } = await importWorkerDb();

    // Control 1 — a v1.0-shaped cache, written through the same helper with no
    // accounts list at all. `accountsOfMeta` calls it ONE account, so the pool
    // is published exactly as it was before 09-09.
    await ingestDone(buildOneAccountExport(), 'one.zip');
    const one = await db.meta.get('active');
    if (one === undefined) throw new Error('no stored meta record');
    await writeDataset(
      one.hash,
      one.accountRoot,
      one.categories,
      await db.rows.toArray(),
      one.identity ?? null,
      one.playtime ?? null,
      one.files ?? null,
      one.logins ?? null,
      null,
    );
    expect((await db.meta.get('active'))?.accounts).toBeNull();
    expect((await readLoginRowData())?.accountPool.length).toBeGreaterThan(0);

    // Control 2 — two or more accounts still publish NO pool, which is the rule
    // the empty-pool comment states and the one this plan does not change.
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const three = await db.meta.get('active');
    if (three === undefined) throw new Error('no stored meta record');
    expect(three.accounts).toHaveLength(3);
    expect((await readLoginRowData())?.accountPool.length).toBe(0);
  });

  it('answers the vehicles channel with the SUM of every account’s rows (D-11, D-12)', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const { db } = await importWorkerDb();

    const result = await askData(12, { channel: 'vehicles', title: 'wotb', battleType: null });
    if (result.channel !== 'vehicles') throw new Error('expected the vehicles channel');

    // Every root carries the same `WOTB_Vehicle_Statistics.csv`, so the merged
    // reader must return three times the fixture's Blitz rows — the sum, not
    // the first account's slice and not a de-duplicated merge by vehicle id
    // (per-account slicing and id merging are Phase 10's, D-12).
    const stored = await db.rows
      .where('sourceFile')
      .equals('WOTB_Vehicle_Statistics.csv')
      .toArray();
    expect(new Set(stored.map((row) => row.account)).size).toBe(3);
    const overview = result.view.overview.find((entry) => entry.title === 'wotb');
    expect(overview?.rows).toBe(stored.length);
    expect(result.view.rows.length).toBe(stored.length);
  });

  it('answers the battle-type summary with ONE row per code, summing the stored rows', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const result = await askData(13, { channel: 'vehicles', title: 'wotb', battleType: null });
    if (result.channel !== 'vehicles') throw new Error('expected the vehicles channel');

    // The battle-types file is carried by TWO of the three roots, and its codes
    // merge across them. The control that matters is that the pane is
    // ANSWERING: a reader that demanded every account hold the file would have
    // turned a pane into an error for a real export.
    const { db } = await importWorkerDb();
    const stored = await db.rows
      .where('sourceFile')
      .equals('WOTB_Battle_Types_Statistics.csv')
      .toArray();
    expect(stored.length).toBeGreaterThan(0);
    expect(new Set(stored.map((row) => row.account)).size).toBe(2);

    expect(result.view.title).toBe('wotb');
    expect(result.view.battleTypes.length).toBeGreaterThan(0);

    // Phase 10, D-09 — this assertion FLIPPED on purpose and its name says so.
    // Phase 9 emitted one summary row per stored battle-type row, so the two
    // roots' identical codes appeared twice; that was the correct Phase 9
    // behaviour and the merged-correctness question Phase 10 owns. The answer
    // now is ONE row per DISTINCT code, with the figures added up — and the
    // expectation below is computed from the STORED rows rather than from a
    // typed literal, so it is an independent sum and not a restatement of the
    // builder's own arithmetic.
    const distinctCodes = new Set(stored.map((row) => row.data['TYPE']?.trim() ?? ''));
    expect(result.view.summary.length).toBe(distinctCodes.size);

    let summedCodes = 0;
    for (const summaryRow of result.view.summary) {
      const mine = stored.filter((row) => (row.data['TYPE']?.trim() ?? '') === summaryRow.code);
      expect(mine.length, `${summaryRow.code} is stored by at least one account`).toBeGreaterThan(
        0,
      );
      let expectedBattles = 0;
      for (const row of mine) {
        const raw = row.data['BATTLES_COUNT']?.trim() ?? '';
        const value = Number(raw);
        if (raw !== '' && Number.isFinite(value)) expectedBattles += value;
      }
      if (summaryRow.battles.t === 'n') {
        expect(summaryRow.battles.v, `${summaryRow.code}'s battles are the stored sum`).toBe(
          expectedBattles,
        );
        summedCodes += 1;
      }
    }
    // The control that keeps the loop above from passing vacuously: a fixture
    // whose every battle figure were `N/A` would make it compare nothing.
    expect(summedCodes, 'at least one code has a numeric battle figure to sum').toBeGreaterThan(0);

    // Every code any contributing root declared is in the filter list, so no
    // account's battle types were dropped on the way in.
    const codes = new Set(result.view.battleTypes);
    for (const row of result.view.summary) expect(codes.has(row.code)).toBe(true);
  });

  it('leaves an ABSENT title absent rather than erroring the pane', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    // No root carries a Warplanes file, so the title is genuinely not in this
    // export. The pane must say so, not fail: one root's missing file is
    // exactly what a merged dataset looks like everywhere else in it.
    const result = await askData(14, { channel: 'vehicles', title: 'wowp', battleType: null });
    if (result.channel !== 'vehicles') throw new Error('expected the vehicles channel');
    const overview = result.view.overview.find((entry) => entry.title === 'wowp');
    expect(overview?.present).toBe(false);
    expect(result.view.rows).toEqual([]);
  });

  it('answers the finance, payments and device-info channels from the root that holds them', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');

    // Only the EU root carries a Financial_Data folder, and only EU and NA
    // carry Orders.csv. All three carry Device_info. None of that may turn a
    // pane into an error, and each answer must come from the whole dataset.
    for (const [queryId, channel] of [
      [15, 'premium'],
      [16, 'currency'],
      [17, 'spend'],
      [18, 'device-info'],
    ] as const) {
      const result = await askData(queryId, { channel });
      expect(result.channel, `channel ${channel}`).toBe(channel);
      expect((result.view as { status?: string }).status, `status of ${channel}`).not.toBe('error');
    }
  });

  it('folds repeated presence facts to the same title state (an OR, not a flip)', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');

    // Every root records the same Blitz file names, so `meta.files` holds three
    // presence facts for one file. `isPresent` is an OR fold over them, which
    // is why three facts cannot turn a present title into an absent one.
    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    const facts = (meta?.files ?? []).filter(
      (file) => file.sourceFile === 'WOTB_Vehicle_Statistics.csv',
    );
    expect(facts.length).toBe(3);

    const result = await askData(19, { channel: 'vehicles', title: 'wotb', battleType: null });
    if (result.channel !== 'vehicles') throw new Error('expected the vehicles channel');
    const overview = result.view.overview.find((entry) => entry.title === 'wotb');
    expect(overview?.present).toBe(true);
  });
});

// =============================================================================
// Task 3 — the one dataset's lifecycle: reload, duplicate, replace, clear,
// abort, a legacy cache, and the D-21 purge of a returning v1.0 cache
// =============================================================================

/** Post a `check-cache` and return the `cache-status` it answered with. */
async function checkCache(jobId = 30) {
  post.mockClear();
  postRequest({ type: 'check-cache', jobId });
  const status = await waitForMessage(post, 'cache-status', RED_TIMEOUT_MS);
  if (status.type !== 'cache-status') throw new Error(`expected cache-status, got ${status.type}`);
  return status;
}

/** Post a `clear-data` and wait for the `cleared` acknowledgement. */
async function clearViaWorker(jobId = 31) {
  post.mockClear();
  postRequest({ type: 'clear-data', jobId });
  const start = Date.now();
  while (Date.now() - start < RED_TIMEOUT_MS) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'error') throw new Error(`expected cleared, got error (${msg.detail})`);
      if (msg?.type === 'cleared') return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('clear-data: no `cleared` within the timeout');
}

/** Every stored row, read through the worker's own Dexie instance. */
async function storedRows() {
  const { db } = await importWorkerDb();
  return db.rows.toArray();
}

/** The stored meta record, or a named failure. */
async function storedMeta() {
  const { db } = await importWorkerDb();
  const meta = await db.meta.get('active');
  if (meta === undefined) throw new Error('no stored meta record');
  return meta;
}

interface LifecycleShape {
  name: string;
  bytes: () => Uint8Array;
  roots: readonly string[];
}

/**
 * ONE dataset through the same four flows, for one, two and three accounts.
 *
 * `bytes` is a FACTORY, not a value: fflate stamps each archive with a
 * second-resolution mtime, so two calls a second apart are different files with
 * different hashes and the worker would correctly treat the second as a
 * replacement rather than a duplicate. Each flow that needs "the same archive"
 * therefore asks for its own single byte array and reuses it.
 */
const LIFECYCLE_SHAPES: readonly LifecycleShape[] = [
  { name: 'one account', bytes: buildOneAccountExport, roots: [MA_ROOT_EU] },
  { name: 'two accounts', bytes: buildTwoAccountExport, roots: [MA_ROOT_EU, MA_ROOT_NA] },
  {
    name: 'three accounts',
    bytes: buildRealShapeThreeAccountExport,
    roots: [MA_ROOT_RU, MA_ROOT_EU, MA_ROOT_NA],
  },
];

describe('Phase 9 lifecycle: one dataset through reload, duplicate, replace and clear', () => {
  for (const shape of LIFECYCLE_SHAPES) {
    it(`reloads the same accounts in the same order (${shape.name})`, async () => {
      const done = await ingestDone(shape.bytes(), `${shape.name}.zip`);
      const first = await checkCache();
      if (first.cached === null) throw new Error('expected a cached result');

      // D-16 order, and the accounts the import published, unchanged.
      expect(first.cached.accounts).toEqual(done.result.accounts);
      expect(first.cached.accounts?.map((a) => a.root)).toEqual([...shape.roots]);

      // A SECOND reload equals the first: the replay is a pure read.
      const second = await checkCache();
      expect(second.cached).toEqual(first.cached);
    });

    it(`replays an identical zip as a duplicate (${shape.name})`, async () => {
      const same = shape.bytes();
      await ingestDone(same, `${shape.name}.zip`);
      post.mockClear();
      const again = await ingestExport(post, same, `${shape.name}-again.zip`);
      expect(again.type).toBe('duplicate');
      if (again.type !== 'duplicate') return;
      expect(again.result.accounts?.map((a) => a.root)).toEqual([...shape.roots]);
    });

    it(`replaces every account with a different zip and leaves no old row (${shape.name})`, async () => {
      // The BASELINE: the replacement zip imported into an empty database. Its
      // row count and account list are what the dataset must hold afterwards,
      // and comparing against it is what makes "no old row remains" a claim
      // rather than an assumption — a replace that merely ADDED the new rows
      // would leave a larger table.
      const baselineBytes = buildRealShapeThreeAccountExport({ reversed: true });
      const baseline = await ingestDone(baselineBytes, 'baseline.zip');
      const baselineRows = await storedRows();
      const baselineCount = baselineRows.length;
      const baselineRoots = baseline.result.accounts?.map((a) => a.root) ?? [];

      await ingestDone(shape.bytes(), `${shape.name}.zip`);
      expect((await storedRows()).length).toBeGreaterThan(0);

      // The SAME baseline bytes again: identical to the baseline import and
      // different from `shape`, so this is a real replace and not a duplicate.
      post.mockClear();
      const replacement = await ingestExport(post, baselineBytes, `${shape.name}-replacement.zip`);
      expect(replacement.type).toBe('done');

      const rows = await storedRows();
      const meta = await storedMeta();
      // Exactly the baseline: the whole previous dataset is gone, so no root,
      // no repeated file name and no row of it survives.
      expect(rows.length).toBe(baselineCount);
      expect(meta.accounts?.map((a) => a.root)).toEqual(baselineRoots);
      for (const row of rows) expect(baselineRoots).toContain(row.account);
    });

    it(`clears every row and the meta record (${shape.name})`, async () => {
      await ingestDone(shape.bytes(), `${shape.name}.zip`);
      expect((await storedRows()).length).toBeGreaterThan(0);

      const cleared = await clearViaWorker();
      expect(cleared.type).toBe('cleared');

      expect((await storedRows()).length).toBe(0);
      const { db } = await importWorkerDb();
      expect(await db.meta.get('active')).toBeUndefined();
    });
  }

  it('replacing removes the shared file names of the removed account too', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const before = await storedRows();
    const sharedBefore = before.filter((r) => r.sourceFile === 'WOT_Game_Sessions.csv');
    // Three accounts, one file name: the adjacency D-12 is about.
    expect(new Set(sharedBefore.map((r) => r.account)).size).toBe(3);

    await ingestDone(buildOneAccountExport(), 'one.zip');
    const after = await storedRows();
    const sharedAfter = after.filter((r) => r.sourceFile === 'WOT_Game_Sessions.csv');
    expect(new Set(sharedAfter.map((r) => r.account))).toEqual(new Set([MA_ROOT_EU]));
  });

  it('clear-data on an empty database is a safe no-op that still acknowledges', async () => {
    const { db } = await importWorkerDb();
    expect(await db.rows.count()).toBe(0);
    const cleared = await clearViaWorker();
    expect(cleared.type).toBe('cleared');
    expect(await db.rows.count()).toBe(0);
  });

  it('clearData() twice through the module is a no-op', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const { clearData } = await importWorkerDb();
    await expect(clearData()).resolves.toBeUndefined();
    await expect(clearData()).resolves.toBeUndefined();
    expect((await storedRows()).length).toBe(0);
  });

  it('an interrupted write leaves the previous dataset fully intact', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const rowsBefore = await storedRows();
    const metaBefore = await storedMeta();

    // The write fails at the LAST step — the `meta.put` that carries the
    // accounts list and the aggregate rides on. That is the one failure that
    // could leave rows without their meta.
    const { db } = await importWorkerDb();
    const spy = vi.spyOn(db.meta, 'put').mockRejectedValueOnce(new Error('synthetic write abort'));
    post.mockClear();
    const aborted = await ingestExport(post, buildTwoAccountExport(), 'two.zip');
    spy.mockRestore();

    expect(aborted.type).toBe('error');
    // The rows were cleared and re-written inside the same transaction that
    // then failed, so the whole write rolls back: the previous dataset is
    // exactly what it was, rows and meta.
    const rowsAfter = await storedRows();
    expect(rowsAfter.map((r) => r.id)).toEqual(rowsBefore.map((r) => r.id));
    expect((await storedMeta()).accounts).toEqual(metaBefore.accounts);

    // And a check-cache still reports the three accounts.
    const cached = await checkCache();
    expect(cached.cached?.accounts?.map((a) => a.root)).toEqual([
      MA_ROOT_RU,
      MA_ROOT_EU,
      MA_ROOT_NA,
    ]);
  });

  it('replays a v1.0-shaped cache as ONE account through the legacy fields', async () => {
    await ingestDone(buildSampleExport(), 'sample.zip');
    // Rewrite the store the way a build from BEFORE Phase 9 left it: no
    // `account` on any row and no `accounts` on the meta record.
    const { db } = await importWorkerDb();
    await db.transaction('rw', db.rows, db.meta, async () => {
      for (const row of await db.rows.toArray()) {
        await db.rows.update(row.id!, { account: undefined });
      }
      const meta = await db.meta.get('active');
      await db.meta.put({ ...meta!, accounts: undefined });
    });

    const cached = await checkCache();
    if (cached.cached === null) throw new Error('the cache was wiped instead of replayed');
    // D-22: one account built from the legacy fields, with no games and no
    // years — a v1.0 cache renders exactly as v1.0.
    expect(cached.cached.accounts).toHaveLength(1);
    expect(cached.cached.accounts?.[0]?.root).toBe(SAMPLE_ACCOUNT_ROOT);
    expect(cached.cached.accounts?.[0]?.games).toEqual([]);
    expect(cached.cached.accounts?.[0]?.firstYear).toBeNull();
    expect(cached.cached.identity?.nickname).toBe(SAMPLE_NICKNAME);

    // And both lazy queries still answer through the account-or-legacy rule,
    // where a row with no `account` field IS the legacy account.
    await deleteAggregate('playtime');
    const playtime = await askPlaytime(40);
    expect(playtime.status).not.toBe('no-session-file');
    await deleteAggregate('logins');
    const logins = await askLogins(41);
    if (logins.status !== 'ready') throw new Error(`expected ready, got ${logins.status}`);
    expect(logins.account).not.toBeNull();
  });
});

// =============================================================================
// Task 3, D-21 — a returning v1.0 cache is purged of its unsupported-category
// rows on LOAD
// =============================================================================
//
// D-18 (plan 09-02) stops NEW imports from storing unknown and known-deferred
// rows. It does nothing for a user who already imported with v1.0: their
// `Game_Forums` rows still hold the `EMAIL` and `IP_ADDRESS` columns and their
// `Chat_History` rows still hold message text, and they will keep holding them
// for as long as the cache lives. D-21 removes them on load.
//
// The load path is ONE line — the worker's check-cache handler, which the ready
// handshake posts on every page load — so the cases below drive the REAL worker
// rather than calling the purge directly. That is what makes them a privacy
// assertion rather than a unit test of a helper: the thing proven is that a
// returning user's dump is CLEAN after the app has loaded it.
// =============================================================================

/** The three canaries a v1.0 build stored and no later build may leave. */
const PURGE_CANARIES = [MA_FORUM_EMAIL_CANARY, MA_FORUM_IP_CANARY, MA_CHAT_CANARY] as const;

/**
 * The rows a v1.0 build would have stored for the unsupported folders of the
 * three-account archive's EU root: the forum file with its `EMAIL` and
 * `IP_ADDRESS` cells, a chat row with its message body, and one row of the
 * first UNKNOWN stand-in folder (12-04).
 *
 * No `account` field, exactly as v1.0 wrote it — so the purge has to decide on
 * the row's own CATEGORY and cannot lean on the account stamp.
 */
async function seedLegacyUnsupportedRows(): Promise<number> {
  const { db } = await importWorkerDb();
  const seeded: Parameters<typeof db.rows.bulkAdd>[0] = [
    {
      category: 'Game_Forums',
      sourceFile: 'WOT_Forum_User_Info.csv',
      rowIndex: 0,
      data: {
        NAME: MA_NICKNAME_EU,
        EMAIL: MA_FORUM_EMAIL_CANARY,
        IP_ADDRESS: MA_FORUM_IP_CANARY,
        POSTS: '128',
      },
    },
    {
      category: 'Chat_History',
      sourceFile: 'WOT_Chat_History.csv',
      rowIndex: 0,
      data: { MESSAGE_DT: '04.03.2024 21:11', CHANNEL_ID: '1', MESSAGE_BODY: MA_CHAT_CANARY },
    },
    {
      category: MA_UNKNOWN_FOLDERS[0],
      sourceFile: `${MA_UNKNOWN_FOLDERS[0]}.csv`,
      rowIndex: 0,
      data: { BAN_DT: '02.05.2020 12:00', BAN_REASON: 'synthetic_reason' },
    },
  ];
  await db.rows.bulkAdd(seeded);
  // Non-vacuity: the rows are PRESENT and counted immediately before the
  // check-cache, so a purge that deletes nothing fails this test rather than
  // passing on a store that never held them.
  const stored = await db.rows.toArray();
  return stored.filter((row) => classifyFolder(row.category) !== 'supported').length;
}

/** The whole dump as one searchable string, rows and meta together. */
async function dumpEverything(): Promise<string> {
  const { db } = await importWorkerDb();
  return JSON.stringify({ rows: await db.rows.toArray(), meta: await db.meta.get('active') });
}

/** How many stored rows each supported category holds, keyed by category. */
async function supportedCounts(): Promise<Record<string, number>> {
  const rows = await storedRows();
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (classifyFolder(row.category) !== 'supported') continue;
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return counts;
}

describe('Phase 9 lifecycle: a returning v1.0 cache is purged on load (D-21)', () => {
  it('deletes the seeded unsupported rows and every canary with them', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const seeded = await seedLegacyUnsupportedRows();
    expect(seeded, 'non-vacuity: the seeded rows must be present').toBe(3);
    expect(await dumpEverything()).toContain(MA_FORUM_EMAIL_CANARY);

    const cached = await checkCache();
    expect(cached.cached).not.toBeNull();

    // THE privacy assertion: a whole-dump scan, over every row AND the meta
    // record, finds no canary. Scanning one account would pass while a leak
    // from a sibling root looked identical (RESEARCH Pitfall 7).
    const dump = await dumpEverything();
    for (const canary of PURGE_CANARIES) expect(dump).not.toContain(canary);

    // And no stored row is left whose category the CURRENT classifier calls
    // anything but supported — decided per row through `classifyFolder`, never
    // from the stale status cached on meta.
    for (const row of await storedRows()) {
      expect(classifyFolder(row.category), `row of ${row.category}`).toBe('supported');
    }
  });

  it('keeps every supported row and leaves the meta record exactly as written', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    await seedLegacyUnsupportedRows();
    const countsBefore = await supportedCounts();
    const metaBefore = await storedMeta();

    await checkCache();

    // Every supported category keeps EXACTLY its earlier row count, so the
    // purge is a delete of the unsupported rows and not a wholesale clear.
    expect(await supportedCounts()).toEqual(countsBefore);

    // The meta record is untouched, category rowCount and skippedRowCount
    // included — so the "Not yet supported" banners keep their counts, exactly
    // as they do after a fresh D-18 import.
    expect(await storedMeta()).toEqual(metaBefore);
  });

  it('still posts the unsupported categories with their meta counts', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    await seedLegacyUnsupportedRows();

    const cached = await checkCache();
    const names = cached.cached?.categories.map((c) => c.name) ?? [];
    for (const name of ['Game_Forums', 'Chat_History', MA_UNKNOWN_FOLDERS[0]]) {
      const entry = cached.cached?.categories.find((c) => c.name === name);
      expect(entry, `category ${name}`).toBeDefined();
      expect(entry!.rowCount ?? 0, `rowCount of ${name}`).toBeGreaterThan(0);
    }
    expect(names.length).toBeGreaterThan(0);
  });

  it('is idempotent: a second load changes nothing', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    await seedLegacyUnsupportedRows();
    await checkCache();

    const rowsAfterFirst = await storedRows();
    const metaAfterFirst = await storedMeta();
    await checkCache();

    expect(await storedRows()).toEqual(rowsAfterFirst);
    expect(await storedMeta()).toEqual(metaAfterFirst);
  });

  it('deletes nothing after a FRESH import, because D-18 never stored those rows', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    const before = await storedRows();

    const cached = await checkCache();
    expect(cached.cached).not.toBeNull();

    // The purge runs and finds no unsupported key: not one row changes.
    expect(await storedRows()).toEqual(before);
  });

  it('cleans the legacy-cache replay too, without losing a supported row', async () => {
    await ingestDone(buildSampleExport(), 'sample.zip');
    const { db } = await importWorkerDb();
    // The v1.0 shape, PLUS the rows v1.0 would have stored for the sample's
    // own Chat_history and unknown folders — the extension of the case above to a
    // cache that never had an accounts list at all.
    await db.transaction('rw', db.rows, db.meta, async () => {
      for (const row of await db.rows.toArray()) {
        await db.rows.update(row.id!, { account: undefined });
      }
      const meta = await db.meta.get('active');
      await db.meta.put({ ...meta!, accounts: undefined });
    });
    await seedLegacyUnsupportedRows();
    const countsBefore = await supportedCounts();

    const cached = await checkCache();
    if (cached.cached === null) throw new Error('the cache was wiped instead of replayed');
    expect(cached.cached.accounts).toHaveLength(1);
    expect(cached.cached.accounts?.[0]?.root).toBe(SAMPLE_ACCOUNT_ROOT);

    const dump = await dumpEverything();
    for (const canary of PURGE_CANARIES) expect(dump).not.toContain(canary);
    expect(await supportedCounts()).toEqual(countsBefore);

    // And the replay still answers both queries after the cleanup.
    await deleteAggregate('playtime');
    expect((await askPlaytime(42)).status).not.toBe('no-session-file');
    await deleteAggregate('logins');
    expect((await askLogins(43)).status).toBe('ready');
  });

  it('keeps the Dexie schema at version 2 — the purge is a delete, not a migration', async () => {
    await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    await seedLegacyUnsupportedRows();
    await checkCache();
    const { db } = await importWorkerDb();
    expect(db.verno).toBe(2);
  });
});
