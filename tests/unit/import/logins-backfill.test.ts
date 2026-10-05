import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { geoTableId } from '../../../src/lib/geo/country-lookup.ts';
import { LOGINS_VERSION, type LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import { buildLogins } from '../../../src/lib/features/logins/login-aggregate.ts';
import { extractAccountRecord } from '../../../src/lib/worker/identity.ts';
import {
  ACCOUNT_RECORD_CITY,
  ACCOUNT_RECORD_COUNTRY,
  ACCOUNT_RECORD_IP,
  LOGINS_HAND_KEY,
  LOGINS_IP_HOME,
  LOGINS_SOURCES_IP,
  LOGINS_SOURCES_ROWS,
  LOGINS_WOT_ROWS,
  buildLoginsCsvOnlyExport,
  buildLoginsExportOfAddresses,
  buildLoginsHandExport,
  buildLoginsMergedExport,
} from '../../fixtures/logins-fixtures.ts';
import { SAMPLE_IP } from '../../fixtures/export-fixtures.ts';
import { SAMPLE_ACCOUNT_ROOT } from '../../fixtures/sample-account.ts';
import { buildCustomExport } from '../../fixtures/export-fixtures.ts';
import { buildRealShapeCsv } from '../../fixtures/playtime-real-shape-fixture.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import type { IngestRequest, IngestResponse } from '../../../src/lib/core/types/worker-messages.ts';
import type { LoginAggregates } from '../../../src/lib/features/logins/login-shared.ts';

// =============================================================================
// 06-01 Task 3 — the lazy rebuild, and the guard that keeps a replace honest
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The `logins` field rides on the dataset meta record with NO Dexie version
//   bump (checkpoint option-a), so a cache in a user's browser is never rebuilt
//   by a schema change. That is only safe because the rows still carry the `IP`
//   column: when the stored aggregate is missing, `null`, of another
//   `LOGINS_VERSION` or built against another `geoTableId()`, the worker
//   re-derives it from those rows with the same `buildLogins` the import used.
//
//   Three things can only be seen at the WORKER's boundary, which is why this
//   drives the real module through the harness rather than calling
//   `writeLoginsIfCurrent` alone:
//
//     1. that the rebuild path really is reached and answers the same numbers
//        the import produced, rather than an error or a cast of the old value;
//     2. that the rebuilt value is written back, so the next query is cheap and
//        a user who never re-imports still gets an answer;
//     3. that a replace landing between the snapshot and the write cannot
//        receive the previous dataset's aggregate (T-06-03).
//
//   Test 3 is the one that is about the WORKER and not about the storage: the
//   guard `writeLoginsIfCurrent` applies is called by the worker's own rebuild
//   path, and a writer that overwrote unconditionally would put dataset A's
//   numbers under dataset B's date — which is a correct-looking answer, and the
//   worst kind.
// =============================================================================

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Post one logins query and return whichever of the two replies arrives. */
async function askLogins(spy: WorkerPostSpy, queryId: number): Promise<LoginsView | null> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query: { channel: 'logins' } } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < 5_000) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-error') {
        throw new Error(`expected a data-result, got data-error (${msg.detail})`);
      }
      if (msg?.type !== 'data-result') continue;
      if (msg.queryId !== queryId) continue;
      if (msg.result === null) return null;
      if (msg.result.channel !== 'logins') {
        throw new Error(`expected the logins channel, got ${msg.result.channel}`);
      }
      return msg.result.view;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askLogins(${queryId}): no reply within 5,000 ms`);
}

/** Import the hand export and answer one logins query, returning both. */
async function importAndAsk(spy: WorkerPostSpy, name = 'logins-backfill.zip') {
  const terminal = await ingestExport(spy, buildLoginsHandExport(), name);
  if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
  return { importedAt: terminal.result.importedAt, view: await askLogins(spy, 1) };
}

/**
 * The hand export with ONE extra row, so a second import of it is a different
 * archive with a different hash. Two imports of byte-identical bytes would be
 * refused by the dedup gate, and the replace race needs a real replace.
 */
function buildSecondLoginsExport(): Uint8Array {
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides: {
      'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv([
        ...LOGINS_WOT_ROWS,
        ['06.11.2020 10:00', '06.11.2020 10:30', '198.51.100.20'],
      ]),
    },
  });
}

describe('06-01 — a missing or stale aggregate is rebuilt from the stored rows', () => {
  it('rebuilds and writes back when meta.logins is deleted, answering the import-time view', async () => {
    const { importedAt, view: atImport } = await importAndAsk(post);
    expect(atImport?.status).toBe('ready');

    const { db } = await importWorkerDb();
    const before = await db.meta.get('active');
    expect(before?.logins).not.toBeNull();
    // The state a cache is really in when a build that knew nothing about
    // logins wrote it, or when an aggregation threw at import (T-04-03).
    await db.meta.update('active', { logins: null });
    expect((await db.meta.get('active'))?.logins).toBeNull();

    const rebuilt = await askLogins(post, 2);
    expect(rebuilt).toEqual(atImport);
    if (rebuilt?.status !== 'ready') throw new Error('unreachable: asserted above');
    expect(rebuilt.addresses).toEqual(LOGINS_HAND_KEY.addresses);
    expect(rebuilt.totalLogins).toBe(LOGINS_HAND_KEY.totalLogins);
    expect(rebuilt.unreadableRows).toBe(LOGINS_HAND_KEY.unreadableRows);

    // Written back, so the next query is a single-key read — and the answer
    // still names the dataset it came from.
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates | null;
    expect(stored).not.toBeNull();
    expect(stored?.v).toBe(LOGINS_VERSION);
    expect(stored?.geo).toBe(geoTableId());
    expect(stored?.totalLogins).toBe(LOGINS_HAND_KEY.totalLogins);
    expect((await db.meta.get('active'))?.importedAt).toBe(importedAt);
  });

  it('rebuilds an aggregate whose v is behind LOGINS_VERSION', async () => {
    await importAndAsk(post);
    const { db } = await importWorkerDb();
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    await db.meta.update('active', { logins: { ...stored, v: LOGINS_VERSION - 1 } });

    const view = await askLogins(post, 2);
    expect(view?.status).toBe('ready');
    if (view?.status !== 'ready') throw new Error('unreachable: asserted above');
    expect(view.totalLogins).toBe(LOGINS_HAND_KEY.totalLogins);

    // And the answer was RE-DERIVED, not read with the new rules: the stored
    // copy is current again, which is the only way a stale `v` is a rebuild
    // rather than a cast.
    const after = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(after.v).toBe(LOGINS_VERSION);
    expect(after.addresses).toEqual(stored.addresses);
  });

  it('06-15: rebuilds an aggregate stored under the previous parse rules, so a corrected parser reaches an existing dataset', async () => {
    const terminal = await ingestExport(
      post,
      buildLoginsExportOfAddresses(['0:0:0:0:0:ffff:192.0.2.40']),
      'logins-g1-backfill.zip',
    );
    if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
    const { db } = await importWorkerDb();
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(stored.addresses.map((a) => a.ip)).toEqual(['0:0:0:0:0:ffff:c000:228']);

    // What the PREVIOUS parser stored for this export: the expanded mapped
    // spelling refused, so no address and one unreadable row. The version is the
    // literal 1 (the version that stored that answer), not LOGINS_VERSION minus
    // one, so a future bump cannot make this test vacuous.
    await db.meta.update('active', {
      logins: {
        ...stored,
        v: 1,
        addresses: [],
        totalLogins: 0,
        unreadableRows: 1,
        unknown: { addresses: 0, logins: 0 },
        countries: [],
        other: { addresses: 0, logins: 0 },
      },
    });

    const view = await askLogins(post, 2);
    expect(view?.status).toBe('ready');
    if (view?.status !== 'ready') throw new Error('unreachable: asserted above');
    expect(view.addresses.map((a) => a.ip)).toEqual(['0:0:0:0:0:ffff:c000:228']);
    expect(view.unreadableRows).toBe(0);

    const after = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(after.v).toBe(LOGINS_VERSION);
    expect(after.addresses.map((a) => a.ip)).toEqual(['0:0:0:0:0:ffff:c000:228']);
  });

  it('rebuilds an aggregate built against another geo table', async () => {
    await importAndAsk(post);
    const { db } = await importWorkerDb();
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    // The case a build that ships the DB-IP table creates: a cache written
    // against no table must not keep answering `unknown` for every address
    // once this build's table would say otherwise.
    await db.meta.update('active', {
      logins: { ...stored, geo: 'some-other-table-v1' },
    });

    const view = await askLogins(post, 2);
    expect(view?.status).toBe('ready');
    const after = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(after.geo).toBe(geoTableId());
  });

  it('reports no-source for a dataset whose stored rows hold no session file', async () => {
    // The same statement playtime makes and for the same reason: stored rows
    // cannot distinguish a file that was absent from one that was header-only,
    // so the rebuild answers "no source" and a fresh import answers exactly.
    const { db } = await importWorkerDb();
    await db.meta.put({
      id: 'active',
      hash: 'no-sessions'.padEnd(64, 'n'),
      accountRoot: '123456789',
      importedAt: '2020-01-01T00:00:00.000Z',
      categories: [],
      logins: null,
    });

    const view = await askLogins(post, 1);
    expect(view).toEqual({ status: 'no-source' });

    // The rebuilt answer IS stored, empty as it is: it is a function of rows
    // that are already on disk, so re-deriving it on every query would be a
    // second pass for an answer that cannot change until the next import. What
    // must never happen is an answer here that claims a session file existed.
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(stored.filesSeen).toEqual({ sessions: false, logins: false });
    expect(stored.totalLogins).toBe(0);
    expect(stored.addresses).toEqual([]);
  });
});

describe('06-01 — a replace can never receive the previous dataset aggregate (T-06-03)', () => {
  it('refuses a write carrying the first dataset’s importedAt after a second import', async () => {
    const { writeLoginsIfCurrent } = await importWorkerDb();

    const first = await ingestExport(post, buildLoginsHandExport(), 'first.zip');
    if (first.type !== 'done') throw new Error('expected done');
    const { db } = await importWorkerDb();
    const firstMeta = await db.meta.get('active');
    const firstImportedAt = first.result.importedAt;
    if (firstImportedAt === undefined) throw new Error('the done result carried no importedAt');
    expect(firstMeta?.importedAt).toBe(firstImportedAt);
    const firstLogins = firstMeta?.logins as LoginAggregates;

    // The replace lands: a second, DIFFERENT export is imported over the first.
    // The spy must be cleared first, or `waitForTerminal` would answer with the
    // FIRST import's `done` (it scans the whole call history), and the wait is
    // not cosmetic: `writeDataset` stamps `importedAt` from `Date.now()`, so two
    // imports inside the same millisecond carry the SAME string and the guard
    // could not tell the two datasets apart. That is a bound of the millisecond
    // stamp itself, shared with the playtime backfill and not a property of this
    // guard; a real re-import parses a whole archive and lands in a different
    // millisecond.
    post.mockClear();
    await new Promise((r) => setTimeout(r, 5));
    const second = await ingestExport(post, buildSecondLoginsExport(), 'second.zip');
    if (second.type !== 'done') throw new Error('expected done');
    expect(second.result.importedAt).not.toBe(firstImportedAt);
    const secondLogins = (await db.meta.get('active'))?.logins as LoginAggregates;

    // The first dataset's backfill now tries to store what it computed. It is
    // refused outright — not merged, not applied to the new record.
    const staleAggregate = {
      ...firstLogins,
      totalLogins: 999,
    } as unknown as LoginAggregates;
    expect(await writeLoginsIfCurrent(firstImportedAt, staleAggregate)).toBe(false);

    const after = await db.meta.get('active');
    expect(after?.importedAt).toBe(second.result.importedAt);
    expect(after?.logins).toEqual(secondLogins);
    expect((after?.logins as LoginAggregates).totalLogins).not.toBe(999);

    // And the new dataset answers from its OWN rows, not the old aggregate.
    const view = await askLogins(post, 1);
    expect(view?.status).toBe('ready');
    if (view?.status !== 'ready') throw new Error('unreachable: asserted above');
    expect(view.totalLogins).toBe(secondLogins.totalLogins);
  });

  it('updates only the logins field, and returns false with no record to update', async () => {
    const { db, writeLoginsIfCurrent } = await importWorkerDb();
    const terminal = await ingestExport(post, buildLoginsHandExport(), 'only-field.zip');
    if (terminal.type !== 'done') throw new Error('expected done');

    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    const before = (await db.meta.get('active'))!;
    const importedAt = terminal.result.importedAt;
    if (importedAt === undefined) throw new Error('the done result carried no importedAt');
    const replacement = { ...stored, totalLogins: stored.totalLogins + 1 };
    expect(await writeLoginsIfCurrent(importedAt, replacement)).toBe(true);

    const after = (await db.meta.get('active'))!;
    expect(after.logins).toEqual(replacement);
    // Nothing else moved: a hash, an identity, a category list and an
    // importedAt can never be rewritten by a backfill.
    expect(after.hash).toBe(before.hash);
    expect(after.accountRoot).toBe(before.accountRoot);
    expect(after.categories).toEqual(before.categories);
    expect(after.importedAt).toBe(terminal.result.importedAt);

    await clearForGuard(db);
    expect(await writeLoginsIfCurrent('2020-01-01T00:00:00.000Z', replacement)).toBe(false);
  });
});

/**
 * Delete the active record through the worker's own exported function, so the
 * "no record to update" branch is reached the way a cleared cache reaches it.
 */
async function clearForGuard(db: Awaited<ReturnType<typeof importWorkerDb>>['db']): Promise<void> {
  const { clearData } = await importWorkerDb();
  await clearData();
  expect(await db.meta.get('active')).toBeUndefined();
}

// =============================================================================
// 06-05 Task 2 — the rebuild reads EVERY source the import used
// =============================================================================
//
// WHY THIS BLOCK EXISTS
// 06-01 built the backfill on `readSessionRowData`, which screens the stored
// `sourceFile` index by the names `isSessionFileName` accepts — `Sessions.csv`
// and `*_Game_Sessions.csv`. A `Logins.csv` is in NEITHER set, so a rebuild
// through that reader silently dropped a whole source the import had counted
// (RESEARCH Pitfall 10, which the plan that found it deferred to exactly this
// one). It also had no account rows to hand back, so the D-02 Account record
// vanished on every rebuild.
//
// The failure this would have shipped is quiet and expensive: a dataset whose
// aggregate was deleted answers with FEWER addresses than it did at import, and
// nothing anywhere says the two disagree. So the cases below compare the two
// answers to each other, for an export that has all three source kinds AND an
// account row — the only shape in which a reader that drops a source is
// detectable at all.
//
// NOT REDUNDANT WITH 06-01'S CASES ABOVE
// Those import an archive with session files only, where a reader that ignored
// `Logins.csv` would be indistinguishable from a correct one.
// =============================================================================

/** The whole logins `data-result`, so the pairing with `importedAt` is assertable. */
async function askLoginsReply(
  spy: WorkerPostSpy,
  queryId: number,
): Promise<Extract<IngestResponse, { type: 'data-result' }>> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query: { channel: 'logins' } } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < 5_000) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-error') {
        throw new Error(`expected a data-result, got data-error (${msg.detail})`);
      }
      if (msg?.type === 'data-result' && msg.queryId === queryId) return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askLoginsReply(${queryId}): no reply within 5,000 ms`);
}

/** Import the given archive and answer one query, returning the reply. */
async function importAndReply(spy: WorkerPostSpy, bytes: Uint8Array, name: string) {
  const terminal = await ingestExport(spy, bytes, name);
  if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
  return {
    importedAt: terminal.result.importedAt,
    reply: await askLoginsReply(spy, 1),
  };
}

function viewOf(reply: Extract<IngestResponse, { type: 'data-result' }>) {
  if (reply.result === null) throw new Error('expected a logins result, got null');
  if (reply.result.channel !== 'logins')
    throw new Error(`expected logins, got ${reply.result.channel}`);
  return reply.result.view;
}

describe('06-05: a rebuild reads every source the import used (RESEARCH Pitfall 10)', () => {
  it('answers the import-time view exactly, for a three-source export', async () => {
    const atImport = await importAndReply(post, buildLoginsMergedExport(), 'merged.zip');
    const { db } = await importWorkerDb();
    // The state a cache is really in when a build that knew nothing about logins
    // wrote it, or when the aggregation threw at import (T-04-03).
    await db.meta.update('active', { logins: null });

    const rebuilt = viewOf(await askLoginsReply(post, 2));

    // THE assertion, and it is an equality rather than a spot check: two
    // aggregates built over the same rows by the same function in two different
    // places must be indistinguishable, or "deleted aggregate" becomes a
    // different dataset as far as a reader can tell.
    expect(rebuilt).toEqual(viewOf(atImport.reply));
    if (rebuilt.status !== 'ready') throw new Error('unreachable: asserted by the equality above');

    // Spelled out so a failure says WHICH source went missing rather than
    // "objects differ": the Logins.csv's address, the shared address's merged
    // count, the three files that contributed, and the Account record.
    expect(rebuilt.filesWithRows).toBe(3);
    expect(rebuilt.addresses.map((entry) => entry.ip)).toContain(LOGINS_SOURCES_IP);
    expect(rebuilt.addresses.find((e) => e.ip === LOGINS_IP_HOME)?.logins).toBe(4);
    expect(rebuilt.account).toEqual({
      ip: ACCOUNT_RECORD_IP,
      ipState: 'readable',
      countryCode: ACCOUNT_RECORD_COUNTRY,
      city: ACCOUNT_RECORD_CITY,
    });

    // And written back, so the next query is a single-key read again.
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(stored).not.toBeNull();
    expect(stored.totalLogins).toBe(rebuilt.status === 'ready' ? rebuilt.totalLogins : -1);
  });

  it('answers the import-time view exactly for a Logins.csv-only export', async () => {
    // The shape where the dropped source WAS the whole history: a reader that
    // kept only session files would answer `no-source` here, which is a
    // different sentence about the user's export rather than a wrong number.
    const atImport = await importAndReply(post, buildLoginsCsvOnlyExport(), 'logins-only.zip');
    const { db } = await importWorkerDb();
    await db.meta.update('active', { logins: null });

    const rebuilt = viewOf(await askLoginsReply(post, 2));
    expect(rebuilt).toEqual(viewOf(atImport.reply));
    if (rebuilt.status !== 'ready') throw new Error('unreachable: asserted by the equality above');
    expect(rebuilt.totalLogins).toBe(LOGINS_SOURCES_ROWS.length);
    expect(rebuilt.addresses.every((entry) => entry.games.length === 0)).toBe(true);
    // The sample's own User_Info row is in this archive too, so the record has
    // to survive the rebuild as well as the login rows.
    expect(rebuilt.account?.ip).toBe(SAMPLE_IP);
  });

  it('answers with the SNAPSHOT’s importedAt, not the one read a moment earlier (T-06-21)', async () => {
    const atImport = await importAndReply(post, buildLoginsMergedExport(), 'stamped.zip');
    const { db } = await importWorkerDb();
    await db.meta.update('active', { logins: null });

    const reply = await askLoginsReply(post, 2);
    // The rebuild reads meta and rows in ONE transaction and answers with THAT
    // record's date. A reader that read `importedAt` first and the rows after
    // could be handed a new dataset's date with the old dataset's rows, and the
    // answer would then describe one export under another's date.
    expect(reply.importedAt).toBe(atImport.importedAt);
    expect((await db.meta.get('active'))?.importedAt).toBe(atImport.importedAt);
  });
});

describe('06-05: the reader and the playtime reader are two readers', () => {
  it('readLoginRowData returns every source and the account pool; readSessionRowData still returns only sessions', async () => {
    await importAndReply(post, buildLoginsMergedExport(), 'readers.zip');
    const { readLoginRowData, readSessionRowData } = await importWorkerDb();

    const login = await readLoginRowData();
    expect(login).not.toBeNull();
    expect(login?.sources.map((source) => source.kind).sort()).toEqual([
      'logins',
      'sessions',
      'sessions',
    ]);
    expect(login?.sources.filter((s) => s.kind === 'logins')[0]?.game).toBeNull();
    expect(login?.accountPool.length).toBeGreaterThan(0);
    expect(login?.accountRoot).toBe(SAMPLE_ACCOUNT_ROOT);
    // The snapshot's own stamp, read inside the same transaction as the rows.
    const { db } = await importWorkerDb();
    expect(login?.importedAt).toBe((await db.meta.get('active'))?.importedAt);

    // The playtime backfill is UNCHANGED (T-04-01: this plan does not edit a
    // playtime-module function). A login file leaking into its sources would
    // move the playtime numbers of every account that has one.
    const sessions = await readSessionRowData();
    expect(sessions?.sources.map((source) => source.game).sort()).toEqual(['WOT', 'WOWS']);
    expect(sessions?.sources.every((source) => source.rows.length > 0)).toBe(true);
  });

  it('readLoginRowData returns null for a page with no dataset at all', async () => {
    const { readLoginRowData } = await importWorkerDb();
    expect(await readLoginRowData()).toBeNull();
  });
});

describe('06-05: buildLogins over the same sources twice is deeply equal (D-01 idempotency)', () => {
  it('is deterministic for a mixed source list', async () => {
    await importAndReply(post, buildLoginsMergedExport(), 'determinism.zip');
    const { readLoginRowData } = await importWorkerDb();
    const snapshot = await readLoginRowData();
    if (snapshot === null) throw new Error('no dataset');

    const account = extractAccountRecord(snapshot.accountPool, snapshot.accountRoot);
    const first = buildLogins(snapshot.sources, () => null, account);
    const second = buildLogins(snapshot.sources, () => null, account);
    expect(second).toEqual(first);
  });
});
