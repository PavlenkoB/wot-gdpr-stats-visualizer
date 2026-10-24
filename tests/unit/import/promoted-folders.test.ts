// =============================================================================
// promoted-folders.test.ts — the five remaining Phase 12 folders (12-04)
// =============================================================================
//
// WHAT THIS PROVES, in three halves.
//
// STATUS — `classifyFolder` answers `supported` for the five folders promoted
//   here (with `Surveys`, promoted by 12-02), `unknown` for `Game_Forums` and
//   for the test stand-ins, and `known-deferred` for `Chat_history` / `Clans`.
//   Promotion is a ONE-LINE edit whose consequence is asserted by name, because
//   the consequence is not local: the same list drives the import, the cache
//   replay and the "Not yet supported" footer.
//
// FOOTER — through the real worker, on a real archive: the promoted folders are
//   GONE from `unsupportedEntries`, the Overview chip agrees with that list, and
//   a `check-cache` replay of the same dataset produces the SAME list (no Dexie
//   version bump: status is re-derived from the stored folder NAME).
//   `Game_Forums` is still listed, which is D-09 and the whole reason it was not
//   promoted.
//
// FAIL CLOSED — the reason the promotion is safe at all. Every file of a
//   promoted folder is a FAMILY file whether or not its name is known
//   (`FAMILY_CATEGORIES`), so an unexpected file, a future revision, or a file
//   an attacker added lands in a folder the app cannot parse yet: it is counted,
//   it is named in the presence facts, and NOTHING of it is stored. The same is
//   true of the three `User_Info` history files, which are made family files by
//   an anchored whole-NAME pattern so `Account_Info.csv` beside them keeps
//   feeding the identity pick.
//
// The canaries are planted in THIS file's archive, and one test asserts the
// archive really carries them: a negative assertion over an input that holds no
// canary would pass against a build that stored the whole row.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { classifyFolder } from '../../../src/lib/worker/categories.ts';
import {
  unsupportedBlockStatus,
  unsupportedEntries,
} from '../../../src/lib/shell/dashboard-status.ts';
import type { ClassifyResult } from '../../../src/lib/core/types/worker-messages.ts';
import type { AccountMeta, DatasetFile, DatasetMeta } from '../../../src/lib/worker/db.ts';
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
import { zipSync } from '../../fixtures/pinned-zip.ts';

// -----------------------------------------------------------------------------
// The archive under test
// -----------------------------------------------------------------------------

const ROOT = '123456789';

/** The five folders promoted by this plan, in the spelling the zip writes. */
const PROMOTED_FOLDERS = [
  'Authorized_Third_Parties',
  'Bans',
  'Bonus_Codes',
  'Personal_Coupons',
  'Subscriptions',
] as const;

/** Every Phase 12 folder that is now readable: these five plus `Surveys` (12-02). */
const ALL_PROMOTED_FOLDERS = [...PROMOTED_FOLDERS, 'Surveys'] as const;

/** One email-shaped canary in EVERY planted file, so one assertion covers them all. */
const EMAIL_CANARY = 'promoted-folder-canary@example.invalid';

/** A per-file non-email canary: the "nothing stored" claim is not only about email. */
const CANARY_BY_FOLDER: Readonly<Record<string, string>> = {
  Authorized_Third_Parties: 'third-party-secret-4d21',
  Bans: 'ban-secret-9c07',
  Bonus_Codes: 'bonus-secret-1b83',
  Personal_Coupons: 'coupon-secret-6f52',
  Subscriptions: 'subscription-secret-2a96',
  Game_Forums: 'forum-secret-7e34',
  Account_Name_History: 'name-history-secret-8c15',
};

/** A CSV whose header carries an EMAIL column and whose one row carries both canaries. */
function emailBearingCsv(canary: string): string {
  return `ID;EMAIL;NOTE\r\n1;${EMAIL_CANARY};${canary}\r\n`;
}

/**
 * The archive: one account root, one unlisted `.csv` in each promoted folder, a
 * `Game_Forums` file with the same email-bearing shape, a `User_Info`
 * `Account_Name_History.csv`, and the `Account_Info.csv` that must keep working.
 *
 * Written inside this file rather than in a shared fixture because these cases
 * need EXACTLY these files: a fixture builder that also wrote the twelve
 * new-game spec files would put rows and facts in the lists being counted.
 */
function buildArchive(): Uint8Array {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  const entries: Record<string, Uint8Array> = {
    // The control: a supported, NON-family file with no email in it, whose rows
    // must still reach storage after every change in this plan.
    [`${ROOT}/User_Info/Account_Info.csv`]: encode(
      `ID;NAME;IP\r\n${ROOT};Synthetic Tanker;203.0.113.9\r\n`,
    ),
    // The narrowing: a User_Info file whose name the history pattern knows.
    [`${ROOT}/User_Info/Account_Name_History.csv`]: encode(
      emailBearingCsv(CANARY_BY_FOLDER['Account_Name_History']!),
    ),
  };
  for (const folder of PROMOTED_FOLDERS) {
    entries[`${ROOT}/${folder}/Unlisted_File.csv`] = encode(
      emailBearingCsv(CANARY_BY_FOLDER[folder]!),
    );
  }
  entries[`${ROOT}/Game_Forums/WOT_Forum_User_Info.csv`] = encode(
    emailBearingCsv(CANARY_BY_FOLDER['Game_Forums']!),
  );
  return zipSync(entries);
}

// -----------------------------------------------------------------------------
// 1. Status
// -----------------------------------------------------------------------------

describe('classifyFolder after 12-04', () => {
  it('is supported for every promoted folder, in any letter case', () => {
    for (const folder of ALL_PROMOTED_FOLDERS) {
      expect(classifyFolder(folder), folder).toBe('supported');
      expect(classifyFolder(folder.toLowerCase()), folder.toLowerCase()).toBe('supported');
      expect(classifyFolder(folder.toUpperCase()), folder.toUpperCase()).toBe('supported');
    }
  });

  it('is still unknown for Game_Forums and for the suite stand-ins', () => {
    // D-02 / D-09: `Game_Forums` is real and its header carries an EMAIL, so it
    // is deliberately NOT promoted — it stays counted and stays in the footer.
    expect(classifyFolder('Game_Forums')).toBe('unknown');
    expect(classifyFolder('game_forums')).toBe('unknown');
    expect(classifyFolder('Unmapped_Folder')).toBe('unknown');
    expect(classifyFolder('Extra_Unknown_One')).toBe('unknown');
  });

  it('is still known-deferred for Chat_history and Clans', () => {
    expect(classifyFolder('Chat_history')).toBe('known-deferred');
    expect(classifyFolder('Clans')).toBe('known-deferred');
  });
});

// -----------------------------------------------------------------------------
// 2 + 3. Through the real worker: the footer shrinks, the storage fails closed
// -----------------------------------------------------------------------------

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Ingest the archive and hand back the `done` result. */
async function ingestArchive(): Promise<ClassifyResult> {
  post.mockClear();
  const terminal = await ingestExport(post, buildArchive(), 'promoted.zip');
  if (terminal.type !== 'done') throw new Error(`import ended ${terminal.type}, not done`);
  return terminal.result;
}

/** The stored meta record, or a failure naming the import that wrote none. */
async function activeMeta(): Promise<DatasetMeta> {
  const { db } = await importWorkerDb();
  const meta = await db.meta.get('active');
  if (meta === undefined) throw new Error('no active meta record — did the import finish?');
  return meta;
}

/** The one account's own presence facts, read from `accounts[].files`. */
function factsOf(meta: DatasetMeta, root: string): readonly DatasetFile[] {
  const accounts = (meta.accounts ?? []) as AccountMeta[];
  const account = accounts.find((candidate) => candidate.root === root);
  if (account === undefined) throw new Error(`no account ${root} in the stored meta`);
  return account.files;
}

/** The one fact for a file name, case-insensitively, or undefined. */
function factFor(
  files: readonly DatasetFile[],
  sourceFile: string,
  category?: string,
): DatasetFile | undefined {
  return files.find(
    (file) =>
      file.sourceFile.toLowerCase() === sourceFile.toLowerCase() &&
      (category === undefined || file.category === category),
  );
}

/** Everything at rest, rows and meta together, as one searchable string. */
async function dumpEverything(): Promise<string> {
  const { db } = await importWorkerDb();
  return JSON.stringify({ rows: await db.rows.toArray(), meta: await db.meta.get('active') });
}

describe('12-04: the promoted folders through the real worker', () => {
  it('the archive really carries every canary the negative assertions rule out', () => {
    const inflated = unzipSync(buildArchive());
    const decode = (path: string): string => new TextDecoder().decode(inflated[path]!);

    // Every planted file, one by one: a negative assertion over an input that
    // carried nothing would pass against a build that stored the whole row.
    for (const folder of PROMOTED_FOLDERS) {
      const body = decode(`${ROOT}/${folder}/Unlisted_File.csv`);
      expect(body, folder).toContain(EMAIL_CANARY);
      expect(body, folder).toContain(CANARY_BY_FOLDER[folder]);
    }
    expect(decode(`${ROOT}/Game_Forums/WOT_Forum_User_Info.csv`)).toContain(
      CANARY_BY_FOLDER['Game_Forums'],
    );
    expect(decode(`${ROOT}/User_Info/Account_Name_History.csv`)).toContain(
      CANARY_BY_FOLDER['Account_Name_History'],
    );
    // And the control carries NO canary, so "the Account_Info rows stored"
    // cannot be satisfied by the same string the negatives rule out.
    expect(decode(`${ROOT}/User_Info/Account_Info.csv`)).not.toContain(EMAIL_CANARY);
  });

  it('stores the Account_Info rows and NOTHING from any promoted folder', async () => {
    const result = await ingestArchive();

    const { db } = await importWorkerDb();
    const rows = await db.rows.toArray();
    const byFile = new Map<string, number>();
    for (const row of rows) byFile.set(row.sourceFile, (byFile.get(row.sourceFile) ?? 0) + 1);

    // The control: a supported, non-family file in a supported folder.
    expect(byFile.get('Account_Info.csv')).toBe(1);
    // The five promoted folders, the forum file and the history file: all
    // family files with no spec, so all counted and none stored.
    for (const folder of PROMOTED_FOLDERS) {
      expect(byFile.get('Unlisted_File.csv') ?? 0, folder).toBe(0);
    }
    expect(byFile.get('WOT_Forum_User_Info.csv') ?? 0).toBe(0);
    expect(byFile.get('Account_Name_History.csv') ?? 0).toBe(0);
    // And the categories are exactly the ones that were read.
    expect(new Set(rows.map((row) => row.category))).toEqual(new Set(['User_Info']));

    // The import itself succeeded: a header that matches no spec is not an
    // error, it is an empty state (Phase 11 D-09).
    expect(result.categories.some((entry) => entry.name === 'User_Info')).toBe(true);
  });

  it('records a presence fact for each promoted folder file: 0 stored, 1 parsed', async () => {
    await ingestArchive();

    const facts = factsOf(await activeMeta(), ROOT);
    for (const folder of PROMOTED_FOLDERS) {
      // Five folders hold a file of the SAME name, so the fact is keyed by the
      // category as well — one fact per (account, file, folder), which is what
      // the presence list actually records.
      const fact = factFor(facts, 'Unlisted_File.csv', folder);
      expect(fact, folder).toBeDefined();
      // The state the rows table cannot express: the file WAS in the export,
      // one row parsed, and the allowlist kept none of it (12-04 behavior).
      expect(fact!.rowCount, folder).toBe(0);
      expect(fact!.parsedRowCount, folder).toBe(1);
    }
    // One fact per promoted folder — five files, five facts.
    expect(facts.filter((file) => file.sourceFile === 'Unlisted_File.csv')).toHaveLength(
      PROMOTED_FOLDERS.length,
    );
    // The history file is a family file by NAME in a supported folder, so it
    // gets the same two-number fact.
    const history = factFor(facts, 'Account_Name_History.csv');
    expect(history?.rowCount).toBe(0);
    expect(history?.parsedRowCount).toBe(1);
    // The control is NOT a family file, so the presence list says nothing about
    // it at all: `parsedRowCount` rides on family facts only, and this file is
    // proved non-family by its row reaching storage in the case above.
    expect(factFor(facts, 'Account_Info.csv')).toBeUndefined();
  });

  it('leaves no planted canary anywhere in the rows or the active meta', async () => {
    await ingestArchive();

    const dump = await dumpEverything();
    expect(dump).not.toContain(EMAIL_CANARY);
    for (const canary of Object.values(CANARY_BY_FOLDER)) {
      expect(dump, canary).not.toContain(canary);
    }
  });

  it('drops the five folders from the footer and keeps Game_Forums listed', async () => {
    const result = await ingestArchive();

    const listed = unsupportedEntries(result).map((entry) => entry.name);
    expect(listed).toEqual(['Game_Forums']);
    for (const folder of PROMOTED_FOLDERS) {
      expect(listed, folder).not.toContain(folder);
    }
    // The count of folders not shown is the length of this same list (the
    // retired Overview chip counted exactly these entries).
    expect(unsupportedEntries(result).length).toBe(1);
    expect(unsupportedBlockStatus(result)).toBe('has-items');
  });

  it('gives the same footer after a cache replay, with no Dexie version bump', async () => {
    const result = await ingestArchive();
    const imported = unsupportedEntries(result).map((entry) => entry.name);

    post.mockClear();
    postRequest({ type: 'check-cache', jobId: 3 });
    const status = await waitForMessage(post, 'cache-status');
    if (status.type !== 'cache-status') throw new Error('expected cache-status');

    const replayed = unsupportedEntries(status.cached).map((entry) => entry.name);
    expect(replayed).toEqual(imported);
    expect(replayed).toEqual(['Game_Forums']);
  });
});
