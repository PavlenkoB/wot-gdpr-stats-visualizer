import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installWorkerScope,
  loadWorker,
  ingestExport,
  importWorkerDb,
  postRequest,
  waitForMessage,
  deleteActiveDatabase,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import {
  MA_CANARIES,
  MA_CHAT_CANARY,
  MA_CREATED_EU,
  MA_CREATED_NA,
  MA_DATALESS_PUBLISHED_COUNT,
  MA_DATALESS_PUBLISHED_ROOTS,
  MA_EXPECTED_GAMES,
  MA_EXPECTED_YEARS,
  MA_FORUM_EMAIL_CANARY,
  MA_FORUM_IP_CANARY,
  MA_NICKNAME_EU,
  MA_NICKNAME_NA,
  MA_REGION_EU,
  MA_REGION_NA,
  MA_ROOT_DATALESS,
  MA_ROOT_EU,
  MA_ROOT_NA,
  MA_ROOT_RU,
  MA_ROOTS_D16_ORDER,
  buildCaseVariantUserInfoAcrossRootsExport,
  buildDataLessAccountExport,
  buildDuplicateNicknameExport,
  buildHostileRootNamesExport,
  buildNoActivityAccountsExport,
  buildOneAccountExport,
  buildOneDataLessOfTwoExport,
  buildRealShapeThreeAccountExport,
  buildTiedYearsExport,
} from '../../fixtures/multi-account-fixtures.ts';
import {
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_BADGE_ORDER,
  SAMPLE_CREATED_AT,
  SAMPLE_NICKNAME,
  SAMPLE_REGION,
  SAMPLE_ROW_COUNTS,
  buildRootlessExport,
  buildSampleExport,
} from '../../fixtures/export-fixtures.ts';
import { zipSync } from '../../fixtures/pinned-zip.ts';
import type {
  AccountSummary,
  ClassifyResult,
  IngestResponse,
} from '../../../src/lib/core/types/worker-messages.ts';
import type { DatasetMeta, DatasetRow } from '../../../src/lib/worker/db.ts';
import { accountCountOf, hasMultipleRoots } from '../../../src/lib/shell/identity-model.ts';

// =============================================================================
// multi-account-import.test.ts — the worker imports EVERY account on its own
// (Phase 9, plan 09-02)
// =============================================================================
//
// Plan 09-01 made the CLASSIFIER accept several account folders. This file
// proves the other half of ACCOUNT-02: that the ingest worker parses each root
// on its own, stamps every stored row with the account that owns it (D-07), and
// publishes ONE ordered account list (D-16) that the two replay paths —
// `duplicate` on a hash-identical re-drop and `cache-status` on a return visit
// — reproduce exactly, so a page reloaded after an import shows what the import
// showed.
//
// Why the worker boundary and not a pure-function test: the guarantees here are
// about what reaches IndexedDB and what crosses to the main thread. Neither is
// observable without the real module, a real archive and a real store, so this
// file drives `ingest.worker.ts` through the shared harness (fake `self`, then a
// deleted database and a fresh module per test) and reads the rows back through
// the worker's own Dexie singleton.
//
// Every archive here is synthetic (`tests/fixtures/multi-account-fixtures.ts`).
// =============================================================================

const RED_TIMEOUT_MS = 10_000;

/** Every account root the real-shape archive declares, in code-unit order. */
const ALL_ROOTS = [MA_ROOT_NA, MA_ROOT_RU, MA_ROOT_EU];

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** The terminal `done` reply of one import, or a named failure. */
async function ingestDone(bytes: Uint8Array, name = 'export.zip'): Promise<ClassifyResult> {
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type).toBe('done');
  if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
  return terminal.result;
}

/** Every stored row, read through the worker's own Dexie instance. */
async function storedRows(): Promise<DatasetRow[]> {
  const { db } = await importWorkerDb();
  return db.rows.toArray();
}

/** The stored meta record. */
async function storedMeta(): Promise<DatasetMeta> {
  const { db } = await importWorkerDb();
  const meta = await db.meta.get('active');
  if (meta === undefined) throw new Error('no stored meta record');
  return meta;
}

function accountsOf(result: ClassifyResult): AccountSummary[] {
  if (result.accounts === undefined) throw new Error('the result carries no accounts list');
  return result.accounts;
}

/**
 * The byte array the duplicate test re-drops.
 *
 * Built once and reused, because fflate stamps each archive with a
 * second-resolution mtime: two `buildRealShapeThreeAccountExport()` calls a
 * second apart are DIFFERENT files with different hashes, and the worker would
 * correctly treat the second as a replacement (the same fixture trap
 * `tests/e2e` records for `buildSampleExport`).
 */
let cachedBytes: Uint8Array | null = null;
function buildSameBytes(): Uint8Array {
  cachedBytes ??= buildRealShapeThreeAccountExport();
  return cachedBytes;
}

describe('Phase 9 tracer: the worker imports every account', () => {
  it('posts done with the accounts in D-16 order and one identity per root', async () => {
    const result = await ingestDone(buildRealShapeThreeAccountExport());

    // D-16: first activity year ascending — RU 2012, EU 2018, NA 2021 — which
    // is NOT code-unit order and NOT numeric order, so this pins the sort.
    expect(accountsOf(result).map((a) => a.root)).toEqual([...MA_ROOTS_D16_ORDER]);

    // The legacy single-account fields are the FIRST account's, so every
    // v1.0 reader keeps working unchanged (D-08).
    expect(result.accountRoot).toBe(MA_ROOT_RU);
    expect(result.identity).toBeNull();

    const [ru, eu, na] = accountsOf(result);
    expect(ru!.identity).toBeNull(); // no User_Info folder at all (D-17)
    expect(eu!.identity).toEqual({
      nickname: MA_NICKNAME_EU,
      region: MA_REGION_EU,
      createdAt: MA_CREATED_EU,
    });
    expect(na!.identity).toEqual({
      nickname: MA_NICKNAME_NA,
      region: MA_REGION_NA,
      createdAt: MA_CREATED_NA,
    });
  });

  it('reports each root its own games and activity years', async () => {
    const result = await ingestDone(buildRealShapeThreeAccountExport());
    for (const account of accountsOf(result)) {
      expect(account.games, `games of ${account.root}`).toEqual([
        ...MA_EXPECTED_GAMES[account.root]!,
      ]);
      const [first, last] = MA_EXPECTED_YEARS[account.root]!;
      expect([account.firstYear, account.lastYear], `years of ${account.root}`).toEqual([
        first,
        last,
      ]);
    }
  });

  it('stamps every stored row with its owning root and keeps every root’s rows', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const rows = await storedRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(ALL_ROOTS, `row ${row.category}/${row.sourceFile}`).toContain(row.account);
    }
    for (const root of ALL_ROOTS) {
      expect(rows.filter((r) => r.account === root).length, `rows of ${root}`).toBeGreaterThan(0);
    }

    // The same file name from three accounts is stored three times, never
    // merged: the three roots all carry `WOTB_Vehicle_Statistics.csv`.
    const shared = rows.filter((r) => r.sourceFile === 'WOTB_Vehicle_Statistics.csv');
    expect(new Set(shared.map((r) => r.account)).size).toBe(3);
    expect(shared.length).toBeGreaterThanOrEqual(3);
  });

  it('stores an accounts list whose per-root category counts sum to the merged ones', async () => {
    const result = await ingestDone(buildRealShapeThreeAccountExport());
    const meta = await storedMeta();

    expect(meta.accounts?.map((a) => a.root)).toEqual([...MA_ROOTS_D16_ORDER]);
    expect(meta.accountRoot).toBe(MA_ROOT_RU);
    expect(meta.identity).toBeNull();
    expect(meta.files?.length).toBeGreaterThan(0);
    for (const file of meta.files ?? []) expect(ALL_ROOTS).toContain(file.account);

    // The merged list and the per-root lists must agree row for row: a
    // per-root count the merged count cannot be assembled from would mean the
    // two were computed from different files.
    for (const merged of result.categories) {
      const summed = (meta.accounts ?? [])
        .flatMap((a) => a.categories)
        .filter((c) => c.name === merged.name)
        .reduce((sum, c) => sum + (c.rowCount ?? 0), 0);
      expect(summed, `rowCount of ${merged.name}`).toBe(merged.rowCount ?? 0);
    }
  });

  it('keeps the Dexie schema at version 2 — account is a non-indexed field', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const { db } = await importWorkerDb();
    expect(db.verno).toBe(2);
  });

  it('replays through check-cache and duplicate exactly as the import published it', async () => {
    const result = await ingestDone(buildRealShapeThreeAccountExport());

    post.mockClear();
    postRequest({ type: 'check-cache', jobId: 7 });
    const cached = await waitForMessage(post, 'cache-status', RED_TIMEOUT_MS);
    if (cached.type !== 'cache-status' || cached.cached === null) {
      throw new Error('expected a cached result');
    }
    expect(cached.cached.accounts).toEqual(result.accounts);
    expect(cached.cached.accountRoot).toBe(result.accountRoot);
    expect(cached.cached.identity).toEqual(result.identity);
    expect(cached.cached.categories.map((c) => c.name)).toEqual(
      result.categories.map((c) => c.name),
    );

    // The hash-identical re-drop is refused BEFORE any unzip work: no
    // `unzipping` stage is posted for the second request (SC3).
    post.mockClear();
    const duplicate = await ingestExport(post, buildSameBytes(), 'again.zip');
    expect(duplicate.type).toBe('duplicate');
    if (duplicate.type !== 'duplicate') throw new Error('expected duplicate');
    expect(duplicate.result.accounts).toEqual(result.accounts);
    const stages = post.mock.calls
      .map((c) => c[0] as IngestResponse | undefined as { stage?: string })
      .filter((m) => typeof m?.stage === 'string')
      .map((m) => m.stage);
    expect(stages).not.toContain('unzipping');
  });

  it('behaves as v1.0 for a one-account export', async () => {
    const result = await ingestDone(buildSampleExport(), 'sample.zip');

    const accounts = accountsOf(result);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.root).toBe(SAMPLE_ACCOUNT_ROOT);
    expect(accounts[0]!.identity).toEqual({
      nickname: SAMPLE_NICKNAME,
      region: SAMPLE_REGION,
      createdAt: SAMPLE_CREATED_AT,
    });
    expect(result.accountRoot).toBe(SAMPLE_ACCOUNT_ROOT);
    expect(result.categories.map((c) => c.name)).toEqual([...SAMPLE_BADGE_ORDER]);
    for (const category of result.categories) {
      expect(category.rowCount, `rowCount of ${category.name}`).toBe(
        SAMPLE_ROW_COUNTS[category.name] ?? 0,
      );
    }

    const rows = await storedRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.account).toBe(SAMPLE_ACCOUNT_ROOT);
  });
});

// =============================================================================
// Phase 9 privacy (D-18, D-19, D-07) — Task 2
// =============================================================================
//
// Every value below is a CANARY: a cell that must never reach IndexedDB. They
// are asserted against the WHOLE dump — every stored row and the whole meta
// record serialised — rather than against one account, because a leak from the
// second or third root looks exactly like a leak from the first unless the scan
// is over everything (RESEARCH Pitfall 7).
//
// D-18 is the load-bearing one: the real sample's `Game_Forums` file carries
// `EMAIL`, `IP_ADDRESS` and `BDAY_*` columns and its `Chat_History` files carry
// message text, none of which is on the three-column deny-list. Those rows are
// therefore parsed for their counts and never stored at all.
// =============================================================================

/** The full dump, as one searchable string. */
async function dumpEverything(): Promise<string> {
  const { db } = await importWorkerDb();
  const [rows, meta] = await Promise.all([db.rows.toArray(), db.meta.get('active')]);
  return JSON.stringify({ rows, meta });
}

describe('Phase 9 privacy', () => {
  it('stores no login, birth date or overflow cell of ANY root', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const dump = await dumpEverything();
    for (const root of ALL_ROOTS) {
      const canary = MA_CANARIES[root]!;
      expect(dump, `login of ${root}`).not.toContain(canary.login);
      expect(dump, `login domain of ${root}`).not.toContain(canary.loginDomain);
      expect(dump, `birth date of ${root}`).not.toContain(canary.birthDate);
      expect(dump, `overflow cell of ${root}`).not.toContain(canary.overflow);
    }
  });

  it('stores no email, IP or message body of an unsupported category', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const dump = await dumpEverything();
    expect(dump).not.toContain(MA_FORUM_EMAIL_CANARY);
    expect(dump).not.toContain(MA_FORUM_IP_CANARY);
    expect(dump).not.toContain(MA_CHAT_CANARY);
  });

  it('still reports the row counts the "Not yet supported" pane needs', async () => {
    const result = await ingestDone(buildRealShapeThreeAccountExport());
    for (const name of ['Game_Forums', 'Chat_History', 'Bans', 'Subscriptions']) {
      const entry = result.categories.find((c) => c.name === name);
      expect(entry, `category ${name}`).toBeDefined();
      expect(entry!.rowCount ?? 0, `rowCount of ${name}`).toBeGreaterThan(0);
    }
  });

  it('stores no row of a category whose classification is not supported', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const { classifyFolder } = await import('../../../src/lib/worker/categories.ts');
    const rows = await storedRows();
    for (const row of rows) {
      expect(classifyFolder(row.category), `row of ${row.category}`).toBe('supported');
    }
  });

  it('keeps the IP column of a stored misfiled User_Info copy (the control)', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const rows = await storedRows();
    const misfiled = rows.filter(
      (r) => r.account === MA_ROOT_RU && r.sourceFile === 'Account_Info.csv',
    );
    // RU has NO User_Info folder, so its copy sits under Activity_History. It is
    // stored (a supported category) and stripped (a sensitive header), and the
    // IP — which D-18 does NOT deny-list — survives, which is how this proves
    // the strip ran and was not a wholesale drop.
    expect(misfiled.length).toBeGreaterThan(0);
    expect(misfiled[0]!.data.IP).toBe('192.0.2.101');
  });

  it("strips each root's OWN User_Info row, one root at a time", async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const rows = await storedRows();
    const userInfo = rows.filter((r) => r.category.toLowerCase() === 'user_info');
    // Both roots that HAVE a User_Info folder are represented, so this is a
    // per-root claim rather than a single-file one.
    expect(new Set(userInfo.map((r) => r.account)).size).toBe(2);
    for (const row of userInfo) {
      for (const key of Object.keys(row.data)) {
        expect(key, `key ${key} of ${row.account}`).not.toMatch(
          /^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/,
        );
        expect(key).not.toBe('__parsed_extra');
      }
    }
  });

  it('keeps the IP of every stored copy, so the strip is a strip and not a drop', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const rows = await storedRows();
    const copies = rows.filter(
      (r) => r.sourceFile === 'Account_Info.csv' && r.data['IP'] !== undefined,
    );
    // RU's misfiled copy plus EU's and NA's own User_Info rows: three accounts,
    // three stored IP cells. This is the control that proves the D-19 strip
    // removes three columns and not the row.
    expect(new Set(copies.map((r) => r.account)).size).toBe(3);
    for (const row of copies) {
      expect(row.data['IP'], `IP of ${row.account}`).toMatch(/^192\.0\.2\./);
    }
  });

  it('strips a misfiled copy for every User_Info family spelling', async () => {
    await ingestDone(buildCaseVariantUserInfoAcrossRootsExport());
    const rows = await storedRows();
    const userInfo = rows.filter((r) => r.category.toLowerCase() === 'user_info');
    expect(userInfo.length).toBeGreaterThan(0);
    for (const row of userInfo) {
      for (const key of Object.keys(row.data)) {
        expect(key).not.toMatch(/^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/);
      }
    }
    // Two spellings in two roots are TWO category entries, and BOTH stripped.
    const names = new Set(rows.map((r) => r.category));
    expect(names).toContain('User_Info');
    expect(names).toContain('user_info');
  });
});

// =============================================================================
// Phase 9 edge matrix (ACCOUNT-02, ACCOUNT-05) — Task 3
// =============================================================================
//
// The shapes below are the ones ACCOUNT-02 and ACCOUNT-05 name explicitly, plus
// the two hostile-name shapes from Phase 9's classifier. Every one of them is
// pinned HERE, on the import path, because that is where they are decided: the
// classifier agrees to accept them, and only the worker can prove what it then
// stores and publishes.
// =============================================================================

/** A tiny Player_statistics CSV body, repeated 501 times for the cap test. */
const TINY_STATS_CSV = 'VEHICLE_ID;BATTLES\r\n1;2\r\n';

describe('Phase 9 edge matrix', () => {
  it('keeps two accounts with the IDENTICAL nickname as two accounts', async () => {
    const result = await ingestDone(buildDuplicateNicknameExport(), 'dup.zip');
    const accounts = accountsOf(result);
    expect(accounts.map((a) => a.root)).toEqual(['100', '200']);
    for (const account of accounts) {
      expect(account.identity?.nickname).toBe('Shared Synthetic Name');
    }
    const rows = await storedRows();
    const ids = rows.filter((r) => r.category.toLowerCase() === 'user_info');
    expect(new Set(ids.map((r) => r.account)).size).toBe(2);
  });

  it('restarts rowIndex per account and category, so one (file, index) pair can name two accounts', async () => {
    await ingestDone(buildRealShapeThreeAccountExport());
    const rows = await storedRows();
    const activity = rows.filter((r) => r.category === 'Activity_History');
    expect(activity.length).toBeGreaterThan(0);

    // Per account, the indexes of one category are a contiguous run from 0 —
    // which is only true because the counter restarts per account and category.
    const byRoot = new Map<string, number[]>();
    for (const row of activity) {
      const list = byRoot.get(row.account!) ?? [];
      list.push(row.rowIndex);
      byRoot.set(row.account!, list);
    }
    expect(byRoot.size).toBe(3);
    for (const [root, indexes] of byRoot) {
      const sorted = [...indexes].sort((a, b) => a - b);
      expect(sorted, `rowIndexes of ${root}`).toEqual(sorted.map((_, i) => i));
    }

    // The consequence D-12 is about: at least one (sourceFile, rowIndex) pair
    // belongs to MORE THAN ONE account, so nothing may key, sort or de-duplicate
    // on that pair alone.
    const owners = new Map<string, Set<string>>();
    for (const row of activity) {
      const key = `${row.sourceFile}|${row.rowIndex}`;
      const set = owners.get(key) ?? new Set<string>();
      set.add(row.account!);
      owners.set(key, set);
    }
    const collided = [...owners.values()].filter((set) => set.size > 1);
    expect(collided.length).toBeGreaterThan(0);

    // And every account's rows are stored: none collapsed into a sibling's.
    for (const root of ALL_ROOTS) {
      expect(activity.filter((r) => r.account === root).length).toBeGreaterThan(0);
    }
  });

  it('imports accounts with no activity, a header-only file and no session file', async () => {
    const result = await ingestDone(buildNoActivityAccountsExport(), 'quiet.zip');
    const accounts = accountsOf(result);
    expect(accounts.map((a) => a.root)).toEqual(['600', '700']);
    for (const account of accounts) {
      expect(account.games).toEqual([]);
      expect(account.firstYear).toBeNull();
      expect(account.lastYear).toBeNull();
      expect(account.identity).not.toBeNull(); // both carry a User_Info row
    }
    // The header-only file was still SEEN, so the dataset has a stored
    // playtime aggregate rather than the "no session file" answer (D-15).
    const meta = await storedMeta();
    expect(meta.playtime).not.toBeNull();
    expect(meta.playtime?.sessionsFileSeen).toBe(true);
  });

  it('breaks a tie on first activity year by root and puts no-activity accounts last', async () => {
    const result = await ingestDone(buildTiedYearsExport(), 'tied.zip');
    expect(accountsOf(result).map((a) => a.root)).toEqual(['300', '400', '500']);
    expect(accountsOf(result)[2]!.firstYear).toBeNull();
  });

  it('imports the same archive with its entries reversed to the same answer', async () => {
    const forward = await ingestDone(buildRealShapeThreeAccountExport(), 'fwd.zip');
    // The two archives hold the same entries in a different order, so their
    // bytes differ and the second import REPLACES the first (that is the point:
    // classification and per-root attribution must not depend on zip order).
    const reversed = await ingestDone(
      buildRealShapeThreeAccountExport({ reversed: true }),
      'rev.zip',
    );
    expect(reversed.accounts).toEqual(forward.accounts);
    expect(reversed.accountRoot).toBe(forward.accountRoot);
    expect(reversed.categories).toEqual(forward.categories);
  });

  it('imports roots named __proto__ and constructor without touching Object.prototype', async () => {
    const result = await ingestDone(buildHostileRootNamesExport(), 'hostile.zip');
    expect(
      accountsOf(result)
        .map((a) => a.root)
        .sort(),
    ).toEqual(['__proto__', 'constructor']);
    const rows = await storedRows();
    expect(rows.filter((r) => r.account === '__proto__').length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.account === 'constructor').length).toBeGreaterThan(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('applies the presence cap PER ACCOUNT, so one root cannot starve another', async () => {
    // One root with 501 statistics files, one with two. Built inline from the
    // pinned `zipSync` — never fflate directly (tests/fixtures/README.md).
    const big: Record<string, Uint8Array> = {};
    const body = new TextEncoder().encode(TINY_STATS_CSV);
    for (let i = 0; i < 501; i++) big[`huge/Player_Statistics/V${i}.csv`] = body;
    big['huge/User_Info/Account_Info.csv'] = new TextEncoder().encode(
      'ID;NAME;CREATED_AT\r\nhuge;Big;2020-01-01 00:00:00\r\n',
    );
    big['small/User_Info/Account_Info.csv'] = new TextEncoder().encode(
      'ID;NAME;CREATED_AT\r\nsmall;Small;2021-01-01 00:00:00\r\n',
    );
    for (const name of ['A.csv', 'B.csv']) {
      big[`small/Player_Statistics/${name}`] = body;
    }

    await ingestDone(zipSync(big), 'cap.zip');
    const meta = await storedMeta();
    const huge = meta.accounts?.find((a) => a.root === 'huge');
    const small = meta.accounts?.find((a) => a.root === 'small');
    expect(huge?.files.length).toBe(500);
    expect(small?.files.length).toBe(2);
    expect(meta.files?.length).toBe(502);
  });

  it('stamps a rootless export’s rows with the empty root', async () => {
    const result = await ingestDone(buildRootlessExport(), 'rootless.zip');
    const accounts = accountsOf(result);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.root).toBe('');
    const rows = await storedRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.account).toBe('');
  });
});

// =============================================================================
// The account count counts the accounts that hold data (plan 09-10,
// `accountCountSemantics: option-a`)
// =============================================================================
//
// The UI audit's first-ranked finding: the header's "N accounts" and every
// pane's "N accounts combined" counted archive ROOTS, so a root whose folders
// are all `known-deferred` was counted and listed while contributing no row to
// anything the dashboard shows — a title reading "3 accounts" beside one row
// reading "No activity recorded".
//
// These cases live HERE, on the import path, and not in a component test: the
// count is decided where the account list is built, and what has to be proved is
// that the import, `duplicate` and `cache-status` all publish the SAME list. The
// header, the Overview card and the six pane captions read that one list, so
// agreement here is agreement everywhere.
//
// The Account record gate is asserted from this file too, because the shape that
// would break it is exactly the one this plan introduces: an archive of two
// roots whose published list is ONE account.
describe('The account count (09-10): only the accounts that hold data', () => {
  it('publishes the two roots that hold data and NOT the root that stored nothing', async () => {
    const result = await ingestDone(buildDataLessAccountExport(), 'dataless.zip');

    // The archive really does hold three roots — the data-less one is a real
    // entry with a CSV under it, so the classifier accepts it like any other.
    const meta = await storedMeta();
    expect(meta.accounts?.map((a) => a.root)).toContain(MA_ROOT_DATALESS);

    // And the PUBLISHED list is the other two, in D-16 order.
    const published = accountsOf(result);
    expect(published).toHaveLength(MA_DATALESS_PUBLISHED_COUNT);
    expect(published.map((a) => a.root)).toEqual([...MA_DATALESS_PUBLISHED_ROOTS]);

    // The count every reader derives is this list's length — so the title, the
    // list and the captions are ONE number, which is the whole point.
    expect(accountCountOf(result)).toBe(MA_DATALESS_PUBLISHED_COUNT);
  });

  it('replays the identical list through duplicate and through cache-status', async () => {
    const result = await ingestDone(buildDataLessAccountExport(), 'dataless.zip');
    const published = accountsOf(result);

    // The return-visit path: ask the worker what it has cached, the way the
    // shell does on load.
    post.mockClear();
    postRequest({ type: 'check-cache', jobId: 71 });
    const cached = await waitForMessage(post, 'cache-status', RED_TIMEOUT_MS);
    if (cached.type !== 'cache-status' || cached.cached === null) {
      throw new Error('expected a cache-status reply carrying the dataset');
    }
    expect(accountsOf(cached.cached)).toEqual(published);
    expect(accountCountOf(cached.cached)).toBe(MA_DATALESS_PUBLISHED_COUNT);

    const duplicate = await ingestExport(post, buildDataLessBytes(), 'again.zip');
    expect(duplicate.type).toBe('duplicate');
    if (duplicate.type !== 'duplicate') throw new Error('expected duplicate');
    expect(duplicate.result.accounts).toEqual(published);
  });

  it('stores every root with its own flag, so the list is filtered and never the store', async () => {
    await ingestDone(buildDataLessAccountExport(), 'dataless.zip');
    const meta = await storedMeta();
    const stored = meta.accounts ?? [];
    expect(stored).toHaveLength(3);

    const dataLess = stored.find((a) => a.root === MA_ROOT_DATALESS);
    expect(dataLess).toBeDefined();
    expect(dataLess?.hasData).toBe(false);
    for (const root of MA_DATALESS_PUBLISHED_ROOTS) {
      expect(stored.find((a) => a.root === root)?.hasData).toBe(true);
    }
  });

  it('publishes NO account record for a two-root archive where one root holds data', async () => {
    // THE trap of this plan (T-09-32). The published list here is ONE account,
    // and a gate that read the published list would publish that account's
    // address as the login pane's account row for a dataset of two roots — the
    // defect D-11's caption exists to prevent. The gate counts ROOTS.
    const result = await ingestDone(buildOneDataLessOfTwoExport(), 'one-of-two.zip');
    expect(accountsOf(result)).toHaveLength(1);

    const meta = await storedMeta();
    expect(meta.accounts).toHaveLength(2);
    expect(meta.logins?.account ?? null).toBeNull();
  });

  it('leaves a dataset whose roots all hold data completely unaffected', async () => {
    const three = await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    expect(accountsOf(three).map((a) => a.root)).toEqual([...MA_ROOTS_D16_ORDER]);
    expect(accountCountOf(three)).toBe(3);
  });

  it('leaves a single-account export publishing exactly one account', async () => {
    // A v1.0 dataset renders exactly as v1.0, and the count layer's own
    // "an empty list is one" rule is what a lone data-less root falls back to.
    const one = accountsOf(await ingestDone(buildOneAccountExport(), 'one.zip'));
    expect(one).toHaveLength(1);
    expect(one[0]!.root).toBe(MA_ROOT_EU);
    expect(accountCountOf({ accounts: one } as ClassifyResult)).toBe(1);
  });
});

/**
 * The byte array the duplicate case re-drops, built once (fflate stamps each
 * archive with a second-resolution mtime, so two builds a second apart are two
 * files).
 */
let cachedDataLessBytes: Uint8Array | null = null;
function buildDataLessBytes(): Uint8Array {
  cachedDataLessBytes ??= buildDataLessAccountExport();
  return cachedDataLessBytes;
}

// =============================================================================
// The root count (plan 09-11): the archive's folders and the accounts that hold
// data are two numbers
// =============================================================================
//
// 09-10 made the published list the accounts that hold data. The header then
// asked that list "does this archive hold more than one account?", and for a
// two-folder archive whose second folder stores nothing the answer was no, so
// the single-account header presented the first folder's region and creation
// date as the export's (VERIFICATION Truth 21). `rootCount` is the second
// number: the account folders the archive held. These cases pin it at the worker
// boundary, on all three producers, because the header, the Account list row and
// the Overview card all read one result and the three producers must agree.
//
// One import per `it`: the harness shares one worker scope per test, so a second
// import in the same body would return the first import's result (09-10 summary).
describe('The root count (09-11): the account folders the archive held', () => {
  const ONE_OF_TWO_ROOT_COUNT = 2;
  const ONE_OF_TWO_PUBLISHED_COUNT = 1;
  const DATALESS_ROOT_COUNT = 3;
  const THREE_ROOT_COUNT = 3;

  it('publishes rootCount 2 beside one account for one-data-less-of-two', async () => {
    const result = await ingestDone(buildOneDataLessOfTwoExport(), 'one-of-two.zip');

    expect(result.rootCount).toBe(ONE_OF_TWO_ROOT_COUNT);
    expect(accountsOf(result)).toHaveLength(ONE_OF_TWO_PUBLISHED_COUNT);
    // The published meaning is intact (09-10 option-a): the count of accounts
    // that hold data is still one.
    expect(accountCountOf(result)).toBe(ONE_OF_TWO_PUBLISHED_COUNT);
    expect(hasMultipleRoots(result)).toBe(true);
    // The control that keeps the case honest: the legacy first-account field is
    // populated, so a header that read it would present EU as the export's.
    expect(result.identity?.region).toBe(MA_REGION_EU);
  });

  it('replays the same rootCount through cache-status', async () => {
    const result = await ingestDone(buildOneDataLessOfTwoExport(), 'one-of-two.zip');

    post.mockClear();
    postRequest({ type: 'check-cache', jobId: 91 });
    const cached = await waitForMessage(post, 'cache-status', RED_TIMEOUT_MS);
    if (cached.type !== 'cache-status' || cached.cached === null) {
      throw new Error('expected a cache-status reply carrying the dataset');
    }
    expect(cached.cached.rootCount).toBe(result.rootCount);
    expect(cached.cached.rootCount).toBe(ONE_OF_TWO_ROOT_COUNT);
    expect(hasMultipleRoots(cached.cached)).toBe(true);
  });

  it('replays the same rootCount through duplicate', async () => {
    const bytes = buildOneDataLessOfTwoBytes();
    const result = await ingestDone(bytes, 'one-of-two.zip');

    post.mockClear();
    const duplicate = await ingestExport(post, bytes, 'again.zip');
    expect(duplicate.type).toBe('duplicate');
    if (duplicate.type !== 'duplicate') throw new Error('expected duplicate');
    expect(duplicate.result.rootCount).toBe(result.rootCount);
    expect(duplicate.result.rootCount).toBe(ONE_OF_TWO_ROOT_COUNT);
    expect(hasMultipleRoots(duplicate.result)).toBe(true);
  });

  it('counts the data-less folder of the three-folder archive', async () => {
    const result = await ingestDone(buildDataLessAccountExport(), 'dataless.zip');
    expect(result.rootCount).toBe(DATALESS_ROOT_COUNT);
    expect(accountsOf(result)).toHaveLength(MA_DATALESS_PUBLISHED_COUNT);
    expect(hasMultipleRoots(result)).toBe(true);
  });

  it('equals the published length when every folder holds data', async () => {
    const result = await ingestDone(buildRealShapeThreeAccountExport(), 'three.zip');
    expect(result.rootCount).toBe(THREE_ROOT_COUNT);
    expect(accountsOf(result)).toHaveLength(THREE_ROOT_COUNT);
  });

  it('is 1 and not multi for a one-folder archive', async () => {
    const result = await ingestDone(buildOneAccountExport(), 'one.zip');
    expect(result.rootCount).toBe(1);
    expect(hasMultipleRoots(result)).toBe(false);
  });
});

/** The one-of-two archive, built once so the duplicate case re-drops identical bytes. */
let cachedOneOfTwoBytes: Uint8Array | null = null;
function buildOneDataLessOfTwoBytes(): Uint8Array {
  cachedOneOfTwoBytes ??= buildOneDataLessOfTwoExport();
  return cachedOneOfTwoBytes;
}
