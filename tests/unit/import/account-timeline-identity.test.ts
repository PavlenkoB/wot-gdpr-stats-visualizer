// =============================================================================
// account-timeline-identity.test.ts — history files never become an identity
// (12-08, research Finding 4, T-12-25)
// =============================================================================
//
// WHAT THIS PROVES
//
// The three User_Info history files now store a past-nickname column (and a
// service token in `NAME`) on purpose. `extractIdentity` falls back to the FIRST
// pooled row's `NAME` when no row's `ID` matches the account root, and
// `extractAccountRecord` reads `IP`, `COUNTRY_CODE` and `CITY` off the same row,
// so a history row in the pool would make a service token the account's nickname
// and a blank record the account's address.
//
// So family files are kept out of both pools, and this file proves it on BOTH
// paths that build them, because the two must agree ("rebuild equals import",
// Phase 9):
//
//   - the import path (`ingest.worker.ts`, the root's identity pool and the
//     single-root Account record), and
//   - the lazy rebuild (`db.ts`, the logins channel re-deriving the aggregate
//     from stored rows after `meta.logins` is cleared).
//
// Two archives: history files ALONE (no Account_Info.csv, so identity and the
// Account record must be null), and history files BESIDE Account_Info.csv (the
// identity must come from Account_Info.csv only). Every value is hand-typed and
// on a reserved `.example.invalid` host or in TEST-NET-3.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IngestRequest, IngestResponse } from '../../../src/lib/core/types/worker-messages.ts';
import type { LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import { buildCustomExport, SAMPLE_NICKNAME } from '../../fixtures/export-fixtures.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';

/** A past nickname no real account could hold, in the name history only. */
const HISTORIC_OLD = 'HistoricNickOne';
const HISTORIC_NEW = 'HistoricNickTwo';
/** A service token, which sits in a column literally called NAME. */
const SERVICE_TOKEN = 'historic-service-token';
const LANGUAGE_SETTING = 'historic-setting-name';

const NAME_HISTORY_CSV = [
  'CREATED_AT,IP,OLD_NAME,NEW_NAME',
  `2021-01-02 03:04:05.000,203.0.113.5,${HISTORIC_OLD},${HISTORIC_NEW}`,
].join('\n');

const SERVICES_CSV = [
  'CREATED_AT,IP,OPERATION,NAME,UID',
  `2021-01-03 03:04:05.000,203.0.113.5,link,${SERVICE_TOKEN},uid@history.example.invalid`,
].join('\n');

const LANGUAGE_CSV = [
  'CREATED_AT,OPERATION,NAME,VALUE',
  `2021-01-04 03:04:05.000,change,${LANGUAGE_SETTING},xx`,
].join('\n');

const HISTORY_OVERRIDES = {
  'User_Info/Account_Name_History.csv': NAME_HISTORY_CSV,
  'User_Info/External_Services_History.csv': SERVICES_CSV,
  'User_Info/Language_And_Country_History.csv': LANGUAGE_CSV,
} as const;

/** Every string that must appear in no identity, account summary or Account record. */
const HISTORIC_VALUES = [HISTORIC_OLD, HISTORIC_NEW, SERVICE_TOKEN, LANGUAGE_SETTING] as const;

/** History files and NO Account_Info.csv: the whole of User_Info is the three history files. */
function historyOnlyArchive(): Uint8Array {
  return buildCustomExport({ omitFolders: ['User_Info'], overrides: HISTORY_OVERRIDES });
}

/** The sample (which carries Account_Info.csv) with the three history files beside it. */
function historyBesideAccountInfoArchive(): Uint8Array {
  return buildCustomExport({ overrides: HISTORY_OVERRIDES });
}

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Post one logins query and return the view (or null), failing on a data-error. */
async function askLogins(spy: WorkerPostSpy, queryId: number): Promise<LoginsView | null> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query: { channel: 'logins' } } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < 5_000) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-error') throw new Error(`data-error: ${msg.detail}`);
      if (msg?.type !== 'data-result' || msg.queryId !== queryId) continue;
      if (msg.result === null) return null;
      if (msg.result.channel !== 'logins') throw new Error(`channel ${msg.result.channel}`);
      return msg.result.view;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askLogins(${queryId}): no reply within 5,000 ms`);
}

/** Import an archive and return the terminal `done` result. */
async function importDone(bytes: Uint8Array, name: string) {
  const terminal = await ingestExport(post, bytes, name);
  if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
  return terminal.result;
}

/** The account record a ready logins view carries, or null. */
function accountOf(view: LoginsView | null) {
  if (view === null || view.status !== 'ready') throw new Error('the logins view is not ready');
  return view.account;
}

describe('12-08: history files only (no Account_Info.csv)', () => {
  it('stores the history rows, so the exclusion below is not a vacuous pass', async () => {
    await importDone(historyOnlyArchive(), 'history-only.zip');

    const { db } = await importWorkerDb();
    const rows = await db.rows.toArray();
    const named = rows.filter((row) => row.sourceFile === 'Account_Name_History.csv');
    expect(named).toHaveLength(1);
    expect(named[0]!.data['OLD_NAME']).toBe(HISTORIC_OLD);
    const services = rows.filter((row) => row.sourceFile === 'External_Services_History.csv');
    expect(services[0]!.data['NAME']).toBe(SERVICE_TOKEN);
    // The email guard dropped the UID cell, and the IP column is not allowlisted.
    expect(JSON.stringify(rows)).not.toContain('history.example.invalid');
    expect(JSON.stringify(rows)).not.toContain('203.0.113.5');
  });

  it('imports with identity null on the legacy result and on the account summary', async () => {
    const result = await importDone(historyOnlyArchive(), 'history-only.zip');

    expect(result.identity ?? null).toBeNull();
    expect(result.accounts).toBeDefined();
    expect(result.accounts?.length).toBe(1);
    expect(result.accounts?.[0]?.identity ?? null).toBeNull();
    const published = JSON.stringify({ identity: result.identity, accounts: result.accounts });
    for (const value of HISTORIC_VALUES) expect(published, value).not.toContain(value);
  });

  it('answers a ready logins view with account null at import and again after a rebuild', async () => {
    await importDone(historyOnlyArchive(), 'history-only.zip');

    const atImport = await askLogins(post, 1);
    expect(atImport?.status).toBe('ready');
    expect(accountOf(atImport)).toBeNull();

    // Clear the stored aggregate: the next query re-derives it from stored rows
    // through the lazy rebuild, which has its own pool walk (db.ts).
    const { db } = await importWorkerDb();
    await db.meta.update('active', { logins: null });
    expect((await db.meta.get('active'))?.logins).toBeNull();

    const rebuilt = await askLogins(post, 2);
    expect(rebuilt?.status).toBe('ready');
    expect(accountOf(rebuilt)).toBeNull();
    expect(rebuilt).toEqual(atImport);
    expect(((await db.meta.get('active'))?.logins ?? null)?.account ?? null).toBeNull();
  });
});

describe('12-08: history files beside Account_Info.csv', () => {
  it('takes the identity from Account_Info.csv only; no historic value reaches it', async () => {
    const result = await importDone(historyBesideAccountInfoArchive(), 'history-beside.zip');

    expect(result.identity?.nickname).toBe(SAMPLE_NICKNAME);
    expect(result.accounts?.[0]?.identity?.nickname).toBe(SAMPLE_NICKNAME);
    const published = JSON.stringify({ identity: result.identity, accounts: result.accounts });
    for (const value of HISTORIC_VALUES) expect(published, value).not.toContain(value);
  });

  it('builds the same Account record on import and on rebuild, from Account_Info.csv alone', async () => {
    await importDone(historyBesideAccountInfoArchive(), 'history-beside.zip');

    const atImport = await askLogins(post, 1);
    const importRecord = accountOf(atImport);
    expect(importRecord).not.toBeNull();
    expect(JSON.stringify(importRecord)).not.toContain('historic');

    const { db } = await importWorkerDb();
    await db.meta.update('active', { logins: null });
    const rebuilt = await askLogins(post, 2);
    expect(accountOf(rebuilt)).toEqual(importRecord);
    for (const value of HISTORIC_VALUES) {
      expect(JSON.stringify(rebuilt), value).not.toContain(value);
    }
  });
});
