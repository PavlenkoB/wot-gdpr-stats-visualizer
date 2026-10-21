// =============================================================================
// game-forums-guard.test.ts — Game_Forums is counted, never stored, never
// promoted (12-07, D-02)
// =============================================================================
//
// WHAT THIS GUARDS.
//
// `Game_Forums/WOT_Forum_User_Info.csv` carries `EMAIL`, `IP_ADDRESS` and
// `BDAY_*` columns. D-02 asked for an email test on the forum folder; the code
// already fails closed, so this file is the regression guard that keeps it so
// instead of a promotion. The chain was verified before the test was written:
//
//   1. STATUS DECIDES STORAGE. The parse loop decides `storeRows` from the
//      folder's classification (supported only). `Game_Forums` is in neither
//      `SUPPORTED` nor `FAMILY_CATEGORIES`, so it is `unknown` and its rows are
//      never handed to the store. (Phase 11 D-15 and the code supersede the
//      Phase 9 research sentence that said unknown folders were stored raw.)
//   2. COUNTS SIT OUTSIDE THE STORING LOOP. An unknown folder's row and skip
//      counts are taken without keeping a row, so the "Not yet supported"
//      footer still names it with its parsed row count (D-09).
//   3. THE PURGE ON CHECK-CACHE. `purgeUnsupportedCategoryRows` deletes every
//      row whose category is not supported on every cache read, so a raw forum
//      row a v1.0 build left at rest is gone after the next page load.
//
// The render-level half of the claim (no pane or page SHOWS the email) is
// asserted in the browser by plan 12-13; this file proves the DATA half: the
// email reaches neither Dexie rows, the stored meta record, nor the facts the
// worker publishes to the panes.
//
// Promoting the folder, giving a file a spec, listing a file in a pane or
// adding it to the family set each fails a named test below.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { KNOWN_DEFERRED, SUPPORTED, classifyFolder } from '../../../src/lib/worker/categories.ts';
import {
  FAMILY_CATEGORIES,
  FAMILY_PATTERNS,
  isFamilyCategory,
  isNewDataFile,
  specFor,
} from '../../../src/lib/worker/new-data-allowlist.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import {
  NEW_DATA_PANE_FILES,
  NEW_DATA_PANE_IDS,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
import { unsupportedEntries } from '../../../src/lib/shell/dashboard-status.ts';
import type { ClassifyResult } from '../../../src/lib/core/types/worker-messages.ts';
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

const ROOT = '123456789';
const FORUM_FILE = 'WOT_Forum_User_Info.csv';

/** Synthetic canaries: reserved `.invalid` domain, TEST-NET address, made-up dates. */
const EMAIL_CANARY = 'forum-guard@forum.example.invalid';
const IP_CANARY = '203.0.113.88';
const BDAY_CANARIES = [
  'bday-day-canary-17',
  'bday-month-canary-23',
  'bday-year-canary-31',
] as const;
const FORUM_CANARIES = [EMAIL_CANARY, IP_CANARY, ...BDAY_CANARIES] as const;

/** The forum file: five risky headers and two data rows. */
const FORUM_CSV =
  'EMAIL;IP_ADDRESS;BDAY_DAY;BDAY_MONTH;BDAY_YEAR\r\n' +
  `${EMAIL_CANARY};${IP_CANARY};${BDAY_CANARIES[0]};${BDAY_CANARIES[1]};${BDAY_CANARIES[2]}\r\n` +
  `${EMAIL_CANARY};${IP_CANARY};${BDAY_CANARIES[0]};${BDAY_CANARIES[1]};${BDAY_CANARIES[2]}\r\n`;

/** One control file in a supported folder, so the dataset is a real one. */
const ACCOUNT_INFO_CSV = `ID;NAME\r\n${ROOT};Synthetic Tanker\r\n`;

function buildArchive(): Uint8Array {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  return zipSync({
    [`${ROOT}/User_Info/Account_Info.csv`]: encode(ACCOUNT_INFO_CSV),
    [`${ROOT}/Game_Forums/${FORUM_FILE}`]: encode(FORUM_CSV),
  });
}

// -----------------------------------------------------------------------------
// 1. The tables: nothing names the forum folder
// -----------------------------------------------------------------------------

describe('12-07 D-02: no table names Game_Forums', () => {
  it('classifies the folder unknown in every letter case', () => {
    for (const spelling of ['Game_Forums', 'game_forums', 'GAME_FORUMS', 'gAmE_fOrUmS']) {
      expect(classifyFolder(spelling), spelling).toBe('unknown');
    }
  });

  it('is in neither SUPPORTED, KNOWN_DEFERRED nor FAMILY_CATEGORIES', () => {
    const forumLike = (name: string): boolean => name.toLowerCase().includes('forum');
    expect(SUPPORTED.some(forumLike)).toBe(false);
    expect(KNOWN_DEFERRED.some(forumLike)).toBe(false);
    expect([...FAMILY_CATEGORIES].some(forumLike)).toBe(false);
    expect(isFamilyCategory('Game_Forums')).toBe(false);
    expect(isFamilyCategory('game_forums')).toBe(false);
  });

  it('is in no family name pattern, and no spec answers for a forum file', () => {
    expect(isNewDataFile(FORUM_FILE)).toBe(false);
    expect(FAMILY_PATTERNS.some((pattern) => pattern.test('wot_forum_user_info.csv'))).toBe(false);
    expect(specFor('Game_Forums', FORUM_FILE)).toBeNull();
    expect(specFor('User_Info', FORUM_FILE)).toBeNull();
  });

  it('names no forum in any spec key or category, and stores no risky column id', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      expect(spec.key.toLowerCase(), spec.key).not.toContain('forum');
      expect(spec.category.toLowerCase(), spec.key).not.toContain('forum');
      for (const column of spec.columns) {
        const id = column.id.toUpperCase();
        expect(id, `${spec.key} ${column.id}`).not.toBe('EMAIL');
        expect(id, `${spec.key} ${column.id}`).not.toBe('IP_ADDRESS');
        expect(id.startsWith('BDAY'), `${spec.key} ${column.id}`).toBe(false);
      }
    }
  });

  it('lists no forum file in any pane', () => {
    for (const pane of NEW_DATA_PANE_IDS) {
      for (const file of NEW_DATA_PANE_FILES[pane]) {
        expect(file.toLowerCase(), `${pane} ${file}`).not.toContain('forum');
      }
    }
  });
});

// -----------------------------------------------------------------------------
// 2. Through the real worker
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

async function ingestArchive(): Promise<ClassifyResult> {
  post.mockClear();
  const terminal = await ingestExport(post, buildArchive(), 'forum-guard.zip');
  if (terminal.type !== 'done') throw new Error(`import ended ${terminal.type}, not done`);
  return terminal.result;
}

/** Everything at rest, rows and meta together, as one searchable string. */
async function dumpEverything(): Promise<string> {
  const { db } = await importWorkerDb();
  return JSON.stringify({ rows: await db.rows.toArray(), meta: await db.meta.get('active') });
}

describe('12-07 D-02: an imported forum file is counted and never stored', () => {
  it('the archive really carries every canary the negative assertions rule out', () => {
    const body = new TextDecoder().decode(
      unzipSync(buildArchive())[`${ROOT}/Game_Forums/${FORUM_FILE}`]!,
    );
    for (const canary of FORUM_CANARIES) expect(body, canary).toContain(canary);
  });

  it('imports done and stores no row of category Game_Forums', async () => {
    await ingestArchive();
    const { db } = await importWorkerDb();
    const rows = await db.rows.toArray();

    expect(rows.filter((row) => row.category.toLowerCase() === 'game_forums')).toHaveLength(0);
    expect(rows.filter((row) => row.sourceFile === FORUM_FILE)).toHaveLength(0);
    // The control: the supported file DID reach storage, so the empty forum
    // result is the guard working and not an import that stored nothing.
    expect(rows.filter((row) => row.sourceFile === 'Account_Info.csv')).toHaveLength(1);
  });

  it('puts no canary in the rows or the active meta record', async () => {
    await ingestArchive();
    const dump = await dumpEverything();
    for (const canary of FORUM_CANARIES) expect(dump, canary).not.toContain(canary);
  });

  it('reports the folder as unknown with its parsed row count, and the footer names it', async () => {
    const result = await ingestArchive();

    const entry = result.categories.find((candidate) => candidate.name === 'Game_Forums');
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('unknown');
    expect(entry!.rowCount).toBe(2);
    expect(unsupportedEntries(result).map((candidate) => candidate.name)).toContain('Game_Forums');
  });

  it('publishes no pane fact beyond the registered pane ids, and none carrying a canary', async () => {
    const result = await ingestArchive();

    const registered: readonly string[] = NEW_DATA_PANE_IDS;
    for (const key of Object.keys(result.newDataPanes ?? {})) {
      expect(registered, `pane key ${key}`).toContain(key);
    }
    const published = JSON.stringify(result.newDataPanes ?? {});
    for (const canary of FORUM_CANARIES) expect(published, canary).not.toContain(canary);
    // And the whole published result, not only the pane facts.
    const everything = JSON.stringify(result);
    for (const canary of FORUM_CANARIES) expect(everything, canary).not.toContain(canary);
  });
});

// -----------------------------------------------------------------------------
// 3. A legacy raw forum row at rest
// -----------------------------------------------------------------------------

describe('12-07 D-02: a legacy raw forum row is purged by check-cache', () => {
  it('deletes a v1.0-shaped Game_Forums row and its canaries from rows and meta', async () => {
    await ingestArchive();
    const { db } = await importWorkerDb();
    // The v1.0 shape: raw cells, no `account` field.
    await db.rows.add({
      category: 'Game_Forums',
      sourceFile: FORUM_FILE,
      rowIndex: 0,
      data: {
        EMAIL: EMAIL_CANARY,
        IP_ADDRESS: IP_CANARY,
        BDAY_DAY: BDAY_CANARIES[0],
        BDAY_MONTH: BDAY_CANARIES[1],
        BDAY_YEAR: BDAY_CANARIES[2],
      },
    });
    // Non-vacuity: the canaries are at rest immediately before the check.
    const before = await dumpEverything();
    for (const canary of FORUM_CANARIES) expect(before, canary).toContain(canary);

    post.mockClear();
    postRequest({ type: 'check-cache', jobId: 9 });
    await waitForMessage(post, 'cache-status');

    const after = await dumpEverything();
    for (const canary of FORUM_CANARIES) expect(after, canary).not.toContain(canary);
    const rows = await db.rows.toArray();
    expect(rows.filter((row) => row.category === 'Game_Forums')).toHaveLength(0);
  });
});
