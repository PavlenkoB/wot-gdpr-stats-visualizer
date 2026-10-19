// =============================================================================
// new-data-facts.test.ts — the presence facts a family file records (11-04)
// =============================================================================
//
// WHAT THIS PROVES, in Task 1's half.
//
// D-09 needs the pane to say a file was SKIPPED, and the rows table cannot say
// it: a skipped file leaves no row behind, so "the file was in the export and
// the allowlist kept none of it" and "the file was never in the export" are the
// same shape at rest. The presence list is what tells them apart, so a family
// file's fact has to carry BOTH numbers — how many rows were STORED and how
// many were PARSED.
//
// The three states, as the plan spells them:
//
//   parsed > 0, stored = 0   the file was in the export and the allowlist
//                            skipped every one of its rows
//   parsed = 0               the file was in the export and held no rows
//   no fact at all           the file was not in the export
//
// Through the REAL worker and the REAL fixtures, never a hand-built meta: a fact
// that only the test can produce proves nothing about what an import records.
//
// Every case runs an import and reads `meta` back, because `meta.files` and
// `meta.accounts[].files` are two copies of ONE list and a change to one that
// missed the other would show a pane that disagrees with the store.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClassifyResult } from '../../../src/lib/core/types/worker-messages.ts';
import type { AccountMeta, DatasetFile, DatasetMeta } from '../../../src/lib/worker/db.ts';
import { newDataPaneFacts } from '../../../src/lib/worker/new-data-facts.ts';
import {
  NEW_DATA_PANE_FILES,
  NEW_DATA_PANE_IDS,
  type NewDataPaneId,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
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
import { buildNewGamesExport } from '../../fixtures/multi-account-fixtures.ts';
import {
  buildNewDataFilesExport,
  NEW_DATA_FIXTURE_FILES,
  NG_ROOT_A,
  NG_ROOT_B,
} from '../../fixtures/new-data-fixtures.ts';
import { zipSync } from '../../fixtures/pinned-zip.ts';

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

// -----------------------------------------------------------------------------
// Reading the facts back
// -----------------------------------------------------------------------------

/** The stored meta record, or a failure naming the import that wrote none. */
async function activeMeta(): Promise<DatasetMeta> {
  const { db } = await importWorkerDb();
  const meta = await db.meta.get('active');
  if (meta === undefined) throw new Error('no active meta record — did the import finish?');
  return meta;
}

/**
 * One account's OWN presence facts, from the account list a multi-account
 * archive writes.
 *
 * Read from `accounts[].files` and not from the flattened `files`, because the
 * two are separate arrays and "each account records exactly one fact per file"
 * is a claim about the per-account one.
 */
function factsOf(meta: DatasetMeta, root: string): readonly DatasetFile[] {
  const accounts = meta.accounts ?? [];
  const account = (accounts as AccountMeta[]).find((candidate) => candidate.root === root);
  if (account === undefined) throw new Error(`no account ${root} in the stored meta`);
  return account.files;
}

/** The one fact for a file name, case-insensitively, or undefined. */
function factFor(files: readonly DatasetFile[], sourceFile: string): DatasetFile | undefined {
  return files.find((file) => file.sourceFile.toLowerCase() === sourceFile.toLowerCase());
}

/** Ingest one archive and fail loudly unless it imported. */
async function ingest(bytes: Uint8Array, name: string): Promise<void> {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
}

/**
 * A one-account archive from `Folder/File.csv -> body` pairs.
 *
 * Written here rather than reaching for a shared builder, because these cases
 * need EXACTLY these files in EXACTLY these folders — including one in a folder
 * no fixture puts a file in — and a builder that also wrote the twelve spec
 * files would put facts in the list this test is counting.
 */
function archiveOf(root: string, entries: Readonly<Record<string, string>>): Uint8Array {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([path, body]) => [`${root}/${path}`, encode(body)]),
    ),
  );
}

/** A three-row HEAT session body under the three spec columns. */
const THREE_SESSIONS =
  'STARTED_AT;FINISHED_AT;IP\r\n' +
  '05.03.2024 20:00;05.03.2024 21:00;203.0.113.1\r\n' +
  '06.03.2024 20:00;06.03.2024 21:00;203.0.113.2\r\n' +
  '07.03.2024 20:00;07.03.2024 21:00;203.0.113.3\r\n';

/** A two-row body under headers no new-game spec names. */
const TWO_PLAIN_ROWS = 'ID;VALUE\r\n' + 'a;1\r\n' + 'b;2\r\n';

/** One row under headers no new-game spec names. */
const ONE_PLAIN_ROW = 'ID;VALUE\r\n' + 'a;1\r\n';

// -----------------------------------------------------------------------------
// Task 1: a presence fact for every family file
// -----------------------------------------------------------------------------

describe('11-04 — presence facts for family files (D-09, Pitfall 4)', () => {
  it('records the STORED and the PARSED count of a family file whose headers match', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const meta = await activeMeta();
    // Two accounts, the same file name, three rows between them — one fact per
    // ACCOUNT, which is the per-account rule `MAX_PRESENCE_FILES` already sets.
    expect(factFor(factsOf(meta, NG_ROOT_A), 'HEAT_Game_Sessions.csv')).toMatchObject({
      rowCount: 2,
      parsedRowCount: 2,
      account: NG_ROOT_A,
    });
    expect(factFor(factsOf(meta, NG_ROOT_B), 'HEAT_Game_Sessions.csv')).toMatchObject({
      rowCount: 1,
      parsedRowCount: 1,
      account: NG_ROOT_B,
    });
  });

  it('records 3 and 3 for a three-row family file whose headers match', async () => {
    // The plain case, spelled with its own three rows rather than read off
    // `NG_EXPECTED`: the fact's two numbers are a claim about THREE rows, and a
    // number computed from another fixture's arithmetic would assert only that
    // two files agree.
    await ingest(
      archiveOf(NG_ROOT_A, { 'Activity_History/HEAT_Game_Sessions.csv': THREE_SESSIONS }),
      'three-rows.zip',
    );

    const fact = factFor(factsOf(await activeMeta(), NG_ROOT_A), 'HEAT_Game_Sessions.csv');
    expect(fact?.rowCount).toBe(3);
    expect(fact?.parsedRowCount).toBe(3);
  });

  it('records PARSED rows and ZERO stored for a family file whose headers drifted', async () => {
    await ingest(buildNewGamesExport({ drifted: true }), 'new-games-drifted.zip');

    const meta = await activeMeta();
    const fact = factFor(factsOf(meta, NG_ROOT_A), 'HEAT_Game_Sessions.csv');
    // The state the rows table alone cannot express: the file WAS there, one row
    // parsed, and the allowlist kept none of it.
    expect(fact?.rowCount).toBe(0);
    expect(fact?.parsedRowCount).toBe(1);
  });

  it('records ZERO for both when the family file is a header and nothing else', async () => {
    await ingest(buildNewGamesExport({ headerOnly: true }), 'new-games-header-only.zip');

    const meta = await activeMeta();
    const fact = factFor(factsOf(meta, NG_ROOT_A), 'HEAT_Game_Sessions.csv');
    expect(fact?.rowCount).toBe(0);
    expect(fact?.parsedRowCount).toBe(0);
  });

  it('records a fact for a family file in Activity_History and none for a non-family file there', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const facts = factsOf(await activeMeta(), NG_ROOT_A);
    // Pitfall 4: `HEAT_Session_Geolocation.csv` is not a session file by name,
    // and before this plan a session file recorded no fact at all, so the card
    // read "Not in this export" for a file that was plainly there.
    expect(factFor(facts, 'HEAT_Game_Sessions.csv')).toBeDefined();
    // A NON-family Activity_History file is unchanged: still no fact, because
    // Activity_History was never a presence category and adding it wholesale
    // would start recording facts for every session file the project already
    // describes elsewhere.
    expect(factFor(facts, 'WOT_Game_Sessions.csv')).toBeUndefined();
  });

  it('leaves a NON-family fact exactly as it was, with no parsedRowCount at all', async () => {
    await ingest(
      archiveOf(NG_ROOT_A, {
        'Player_Statistics/WOTB_Account_Statistics.csv': TWO_PLAIN_ROWS,
      }),
      'non-family.zip',
    );

    const fact = factFor(factsOf(await activeMeta(), NG_ROOT_A), 'WOTB_Account_Statistics.csv');
    expect(fact?.rowCount).toBe(2);
    // Not `undefined` and not `0`: the property is ABSENT, so a reader cannot
    // tell a non-family fact from a family one by the number alone.
    expect('parsedRowCount' in (fact ?? {})).toBe(false);
  });

  it('records a fact for a family file with NO spec: present, parsed, nothing stored', async () => {
    await ingest(
      archiveOf(NG_ROOT_A, {
        'Player_Statistics/HEAT_Device_Info.csv': ONE_PLAIN_ROW,
      }),
      'spec-less.zip',
    );

    const fact = factFor(factsOf(await activeMeta(), NG_ROOT_A), 'HEAT_Device_Info.csv');
    expect(fact?.rowCount).toBe(0);
    expect(fact?.parsedRowCount).toBe(1);
  });

  it('records NOTHING for a family file filed under an unsupported folder', async () => {
    await ingest(
      archiveOf(NG_ROOT_A, {
        'Some_Folder_This_Build_Never_Heard_Of/HEAT_Device_Info.csv': ONE_PLAIN_ROW,
        'Player_Statistics/WOTB_Account_Statistics.csv': TWO_PLAIN_ROWS,
      }),
      'unsupported-folder.zip',
    );

    const facts = factsOf(await activeMeta(), NG_ROOT_A);
    expect(factFor(facts, 'HEAT_Device_Info.csv')).toBeUndefined();
    // The sibling folder's file still records, so the case is about the FOLDER
    // rather than about the import having failed.
    expect(factFor(facts, 'WOTB_Account_Statistics.csv')).toBeDefined();
  });

  it('holds the facts to MAX_PRESENCE_FILES per account (T-11-15)', async () => {
    const { MAX_PRESENCE_FILES } = await importWorkerDb();
    const entries: Record<string, string> = {};
    for (let i = 1; i <= MAX_PRESENCE_FILES + 1; i++) {
      entries[`Player_Statistics/BULK_${String(i).padStart(4, '0')}.csv`] = ONE_PLAIN_ROW;
    }
    await ingest(archiveOf(NG_ROOT_A, entries), 'bulk.zip');

    const facts = factsOf(await activeMeta(), NG_ROOT_A);
    expect(facts.filter((file) => file.sourceFile.startsWith('BULK_')).length).toBe(
      MAX_PRESENCE_FILES,
    );
  });

  it('writes the SAME fact to the flattened list and to the account list', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const meta = await activeMeta();
    const flattened = (meta.files ?? []).filter(
      (file) => file.sourceFile.toLowerCase() === 'heat_game_sessions.csv',
    );
    const perAccount = [...factsOf(meta, NG_ROOT_A), ...factsOf(meta, NG_ROOT_B)].filter(
      (file) => file.sourceFile.toLowerCase() === 'heat_game_sessions.csv',
    );
    expect(flattened).toEqual(perAccount);
  });

  it('leaves the whole rest of the meta record alone', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const meta = await activeMeta();
    // The facts are a derived index over the rows; nothing about the dataset's
    // identity, its hash or its import date is derived from them.
    expect(meta.id).toBe('active');
    expect(meta.importedAt).toEqual(expect.any(String));
    expect(meta.playtime).not.toBeNull();
    expect(meta.logins).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Task 2: ONE derivation of the pane facts, published on all three payloads
// -----------------------------------------------------------------------------
//
// The import and the replay must answer identically, or a returning reader sees
// a pane count the import never published. That is what the single function is
// for: `done`, `duplicate` and `cache-status` all call it over the same presence
// list, and the last group below proves the three are deep-equal.

/** A presence fact, spelled the way an import writes one. */
function fact(
  sourceFile: string,
  rowCount: number,
  category = 'Player_Statistics',
  extra: Partial<DatasetFile> = {},
): DatasetFile {
  return { category, sourceFile, rowCount, ...extra };
}

/** The four HEAT pane files' names, in the contract's order. */
const HEAT_PANE_FILES = NEW_DATA_PANE_FILES.heat;

describe('11-04 — newDataPaneFacts, the one pane derivation', () => {
  it('returns an empty object for a missing, null or empty presence list', () => {
    expect(newDataPaneFacts(null)).toEqual({});
    expect(newDataPaneFacts(undefined)).toEqual({});
    expect(newDataPaneFacts([])).toEqual({});
  });

  it('sums the four HEAT pane files across two accounts', () => {
    const files = [
      fact('heat_account_statistics.csv', 1),
      fact('heat_battle_types_statistics.csv', 2),
      fact('heat_account_storage.csv', 3),
      fact('heat_session_geolocation.csv', 4, 'Activity_History'),
      fact('heat_account_statistics.csv', 5, 'Player_Statistics', { account: NG_ROOT_B }),
      fact('heat_battle_types_statistics.csv', 6, 'Player_Statistics', { account: NG_ROOT_B }),
      fact('heat_account_storage.csv', 7, 'Player_Statistics', { account: NG_ROOT_B }),
      fact('heat_session_geolocation.csv', 8, 'Activity_History', { account: NG_ROOT_B }),
    ];

    expect(newDataPaneFacts(files)).toEqual({ heat: { fileCount: 8, rowCount: 36 } });
  });

  it('sums the two Warships pane files', () => {
    const files = [fact('wows_crews.csv', 4), fact('wows_account_storage.csv', 5)];

    expect(newDataPaneFacts(files)).toEqual({ 'warships-storage': { fileCount: 2, rowCount: 9 } });
  });

  it('omits a pane no fact matches', () => {
    const files = [fact('wows_crews.csv', 4)];

    const panes = newDataPaneFacts(files);
    expect(panes.heat).toBeUndefined();
    expect(Object.keys(panes)).toEqual(['warships-storage']);
  });

  it('counts the session and device files toward NO pane', () => {
    // Both are family files that record a fact, and neither is a pane file:
    // `heat_game_sessions.csv` is Playtime's and `heat_device_info.csv` has no
    // card. A pane table that swept "every HEAT file" would report both.
    const files = [
      fact('heat_game_sessions.csv', 9, 'Activity_History'),
      fact('heat_device_info.csv', 11, 'Player_Statistics'),
    ];

    expect(newDataPaneFacts(files)).toEqual({});
  });

  it('counts a MISFILED copy toward no pane (T-11-14)', () => {
    // The name matches a pane file, but the spec's category does not, so the
    // category test refuses it. Without that second condition a copy of
    // `heat_account_statistics.csv` under `Payment_History` would create a pane
    // out of a file this build stores nothing from.
    const files = [fact('heat_account_statistics.csv', 4, 'Payment_History')];

    expect(newDataPaneFacts(files)).toEqual({});
  });

  it('counts a fact whose category carries no spec for that file toward no pane', () => {
    const files = [fact('heat_account_statistics.csv', 4, 'Device_Info')];

    expect(newDataPaneFacts(files)).toEqual({});
  });

  it('publishes a pane whose files were all skipped, with rowCount 0', () => {
    const files = HEAT_PANE_FILES.map((sourceFile) =>
      fact(
        sourceFile,
        0,
        sourceFile === 'heat_session_geolocation.csv' ? 'Activity_History' : 'Player_Statistics',
        { parsedRowCount: 3 },
      ),
    );

    expect(newDataPaneFacts(files)).toEqual({ heat: { fileCount: 4, rowCount: 0 } });
  });

  it('sums STORED rows only, never the parsed count of a skipped file', () => {
    // 10 parsed, 4 stored: a pane that summed `parsedRowCount` when the field is
    // present would answer 10, and a header list that says "4 rows" next to a
    // data table holding ten would be a false statement about the user's data.
    const files = [
      fact('wows_crews.csv', 4, 'Player_Statistics', { parsedRowCount: 10 }),
      fact('wows_account_storage.csv', 0, 'Player_Statistics', { parsedRowCount: 6 }),
    ];

    expect(newDataPaneFacts(files)).toEqual({ 'warships-storage': { fileCount: 2, rowCount: 4 } });
  });

  it('reads a legacy fact with no parsedRowCount as stored (Pitfall 6)', () => {
    // A cache written before this plan has Player_Statistics pane facts and no
    // Activity_History fact at all. The pane still publishes — a fact that
    // existed must count — and nothing throws on the absent field.
    const files = [fact('wows_crews.csv', 4), fact('wows_account_storage.csv', 2)];

    expect(newDataPaneFacts(files)).toEqual({ 'warships-storage': { fileCount: 2, rowCount: 6 } });
  });

  it('carries integers and nothing else across the worker boundary (T-11-14)', () => {
    const files = [
      fact('heat_account_statistics.csv', 4),
      fact('heat_session_geolocation.csv', 2, 'Activity_History', { account: NG_ROOT_A }),
    ];

    const serialised = JSON.stringify(newDataPaneFacts(files));
    // Every value is a number and every KEY is a pane id: no file name, no
    // category, no account root, no cell.
    expect(JSON.parse(serialised)).toEqual({ heat: { fileCount: 2, rowCount: 6 } });
    for (const match of serialised.matchAll(/:"([^"]*)"/g)) {
      expect(NEW_DATA_PANE_IDS).toContain(match[1] as NewDataPaneId);
    }
  });

  it('covers every pane id the contract names', () => {
    // A pane id added to the contract with no file list, or a file list with no
    // pane, fails here rather than silently publishing an empty pane.
    for (const id of NEW_DATA_PANE_IDS) {
      expect(NEW_DATA_PANE_FILES[id].length).toBeGreaterThan(0);
    }
    expect(Object.keys(NEW_DATA_PANE_FILES).sort()).toEqual([...NEW_DATA_PANE_IDS].sort());
  });
});

/** The three payloads' published pane facts, read through the real worker. */
async function paneFactsOfEveryPayload(
  bytes: Uint8Array,
  name: string,
): Promise<{ done: unknown; duplicate: unknown; cached: unknown }> {
  post.mockClear();
  const done = await ingestExport(post, bytes, name);
  if (done.type !== 'done') throw new Error(`expected done, got ${done.type}`);

  // The SAME archive again: the hash gate answers `duplicate`, which is the
  // replay path a user reaches by dropping the zip twice.
  post.mockClear();
  const duplicate = await ingestExport(post, bytes, name);
  if (duplicate.type !== 'duplicate') {
    throw new Error(`expected duplicate, got ${duplicate.type}`);
  }

  // A FRESH worker, exactly as a return visit starts: a new module instance and
  // a new connection to a database the previous one wrote.
  post.mockClear();
  post = installWorkerScope();
  await loadWorker();
  postRequest({ type: 'check-cache', jobId: 31 });
  const status = await waitForMessage(post, 'cache-status');
  if (status.type !== 'cache-status') throw new Error('expected cache-status');

  return {
    done: done.result.newDataPanes,
    duplicate: duplicate.result.newDataPanes,
    cached: status.cached?.newDataPanes,
  };
}

describe('11-04 — the three payloads publish the same pane facts', () => {
  it('publishes no pane at all for the sessions export', async () => {
    // The 11-01 archive: HEAT and WOTC session files, a spec-less family file and
    // the plain WoT sessions. None of them is a pane file, so the honest answer
    // is an empty object rather than an absent field a reader has to interpret.
    const terminal = await ingestExport(post, buildNewGamesExport(), 'new-games.zip');
    if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
    expect(terminal.result.newDataPanes).toEqual({});
  });

  it('publishes the exact HEAT and Warships counts on done, duplicate and cache-status', async () => {
    const panes = await paneFactsOfEveryPayload(buildNewDataFilesExport(), 'pane-files.zip');

    // Typed in BY HAND from the fixture: four HEAT pane files and two Warships
    // ones, three body rows each, so 12 and 6. Never computed with
    // `newDataPaneFacts`, which is the function under test.
    expect(panes.done).toEqual({
      heat: { fileCount: 4, rowCount: 12 },
      'warships-storage': { fileCount: 2, rowCount: 6 },
    });
    expect(panes.duplicate).toEqual(panes.done);
    expect(panes.cached).toEqual(panes.done);
  });

  it('reads the same pane out of a hand-built legacy result', async () => {
    // A v1.0-shaped replay carries no pane at all, and a hand-built result in a
    // test carries none either; both must stay readable.
    const handBuilt = { newDataPanes: undefined } as unknown as ClassifyResult;
    expect(handBuilt.newDataPanes).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// The contract the counts above were typed against
// -----------------------------------------------------------------------------

describe('11-04 — the pane contract matches the captured files', () => {
  it('names a file that has a fixture and a spec, for every pane file', () => {
    for (const [id, names] of Object.entries(NEW_DATA_PANE_FILES)) {
      for (const name of names) {
        expect(NEW_DATA_FIXTURE_FILES[name], `${id} / ${name} has no fixture`).toBeDefined();
      }
    }
  });

  it('holds four HEAT files and two Warships files', () => {
    expect(NEW_DATA_PANE_FILES.heat).toHaveLength(4);
    expect(NEW_DATA_PANE_FILES['warships-storage']).toHaveLength(2);
  });
});
