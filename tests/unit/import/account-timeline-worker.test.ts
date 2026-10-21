// =============================================================================
// account-timeline-worker.test.ts — the Account timeline, end to end through the
// real worker (plan 12-11)
// =============================================================================
//
// WHAT THIS PROVES, in one line: the five history files go through the per-file
// column allowlist at the worker's row choke point, are answered by the strict
// field-less `account-timeline` channel as ONE merged, newest-first chronology,
// and nothing planted in an excluded column or an email-valued allowlisted cell
// reaches storage or a posted view.
//
// Every expected value is read from TL_EXPECTED, whose literals were derived by
// hand in `timeline-fixtures.ts`. The oracle lists the files PANE_MAPPING marks
// mapped only: a removed kind writes no file, is absent from the oracle and must
// answer not-in-export.

import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataQuery } from '../../../src/lib/core/types/worker-messages.ts';
import {
  TIMELINE_FILE_IDS,
  type TimelineView,
} from '../../../src/lib/features/account-timeline/timeline-shared.ts';
import { TIMELINE_FILE_KEYS } from '../../../src/lib/features/new-data/new-data-shared.ts';
import { paneEntries } from '../../../src/lib/shell/selection-state.ts';
import { formatRowCount, formatTimelineRowSummary } from '../../../src/lib/ui-copy.ts';
import { isDataQuery } from '../../../src/lib/worker/data-queries.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { CAPTURED_FILES, headersOf } from '../../fixtures/new-data-headers.ts';
import { zipSync } from '../../fixtures/pinned-zip.ts';
import {
  TL_CANARIES,
  TL_EMAIL_OLD_NAME,
  TL_EMAIL_OPERATION,
  TL_EMAIL_SITE,
  TL_EMAIL_STATUS,
  TL_EMAIL_UID,
  TL_EMAIL_VALUE,
  TL_EXPECTED,
  TL_NICKNAME_CANARY,
  TL_ROOT_A,
  TL_ROOT_B,
  TL_ROOT_C,
  buildTimelineThreeAccountExport,
  tlCsvFor,
  tlFileKey,
  tlLocation,
  type TlFileId,
} from '../../fixtures/timeline-fixtures.ts';
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

const WAIT_MS = 5_000;

let post: WorkerPostSpy;
let nextQueryId = 900;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Ingest one archive and fail loudly unless the import finished `done`. */
async function ingest(bytes: Uint8Array, name: string) {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
  if (terminal.type !== 'done') throw new Error('expected done');
  return terminal.result;
}

/** The JSON of everything at rest: every row and the active meta record. */
async function everythingAtRest(): Promise<string> {
  const { db } = await importWorkerDb();
  return JSON.stringify([await db.rows.toArray(), (await db.meta.get('active')) ?? null]);
}

/** Ask one query and return the posted reply's view. */
async function ask(query: DataQuery): Promise<unknown> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId: nextQueryId++, query });
  const reply = await waitForMessage(post, 'data-result', WAIT_MS);
  if (reply.type !== 'data-result') throw new Error('expected data-result');
  if (reply.result === null) throw new Error('expected a result');
  expect(reply.result.channel).toBe(query.channel);
  return reply.result.view;
}

/** Ask the account-timeline channel and return its view. */
async function askTimeline(): Promise<TimelineView> {
  return (await ask({ channel: 'account-timeline' })) as TimelineView;
}

/** A one-root archive of explicit `Folder/File.csv -> body` pairs. */
function archiveOf(root: string, entries: Readonly<Record<string, string>>): Uint8Array {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([path, body]) => [`${root}/${path}`, encode(body)]),
    ),
  );
}

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

describe('the account-timeline channel is a strict field-less query (T-12-34)', () => {
  it('accepts a bare query and rejects a title, battleType or any other field', () => {
    expect(isDataQuery({ channel: 'account-timeline' })).toBe(true);
    expect(isDataQuery({ channel: 'account-timeline', title: 'wot' })).toBe(false);
    expect(isDataQuery({ channel: 'account-timeline', title: null })).toBe(false);
    expect(isDataQuery({ channel: 'account-timeline', battleType: null })).toBe(false);
    expect(isDataQuery({ channel: 'account-timeline', battleType: 'x' })).toBe(false);
    expect(isDataQuery({ channel: 'account-timeline', kind: 'ban' })).toBe(false);
    expect(isDataQuery({ channel: 'account-timeline', queryId: 1 })).toBe(false);
  });

  it('answers a malformed account-timeline query with the fixed invalid query detail', async () => {
    postRequest({
      type: 'data-query',
      queryId: 7,
      query: { channel: 'account-timeline', title: 'wot' } as unknown as DataQuery,
    });
    const reply = await waitForMessage(post, 'data-error', WAIT_MS);
    if (reply.type !== 'data-error') throw new Error('expected data-error');
    expect(reply.detail).toBe('invalid query');
  });
});

// ---------------------------------------------------------------------------
// The snapshot's account order
// ---------------------------------------------------------------------------

describe('readRowsByFile carries the stored account order', () => {
  const names = new Set(
    TIMELINE_FILE_IDS.map((id) => TIMELINE_FILE_KEYS[id]).filter((key) => key !== null),
  );
  const categories = ['user_info', 'bans', 'authorized_third_parties'];

  it('lists the roots of the stored account list in stored order', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const { readRowsByFile, db } = await importWorkerDb();
    const snapshot = await readRowsByFile(names, categories);
    const meta = await db.meta.get('active');
    expect(snapshot?.accounts).toEqual((meta?.accounts ?? []).map((account) => account.root));
    expect([...(snapshot?.accounts ?? [])].sort()).toEqual([TL_ROOT_A, TL_ROOT_B, TL_ROOT_C]);
  });

  it('answers one legacy root for an absent account list', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const { readRowsByFile, db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    await db.meta.put({ ...meta!, accounts: undefined });
    const snapshot = await readRowsByFile(names, categories);
    expect(snapshot?.accounts).toEqual([meta!.accountRoot]);
  });
});

// ---------------------------------------------------------------------------
// The three-account archive
// ---------------------------------------------------------------------------

/** Sorted copy of an entry's roots; the first-seen order is the builder test's job. */
const sortedRoots = (accounts: readonly string[]): string[] => [...accounts].sort();

describe('the three-account archive through the real worker', () => {
  it('answers the chronology with the hand-derived order, dates, parts and accounts', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const view = await askTimeline();
    expect(view.status).toBe('ready');
    expect(
      view.entries.map((entry) => ({
        kind: entry.kind,
        date: entry.date,
        parts: entry.parts.map((part) => part.cell),
        accounts: sortedRoots(entry.accounts),
      })),
    ).toEqual(
      TL_EXPECTED.entries.map((entry) => ({
        kind: entry.kind,
        date: entry.date,
        parts: [...entry.parts],
        accounts: sortedRoots(entry.accounts),
      })),
    );
  });

  it('reports the stored rows and the rows merged away', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const view = await askTimeline();
    expect(view.storedRows).toBe(TL_EXPECTED.storedRows);
    expect(view.mergedAway).toBe(TL_EXPECTED.mergedAway);
    // Rows removed, not entries: 17 entries from 23 stored rows, of which 4 were
    // merged away and 2 more (a timezone row and an email-valued language row)
    // yield no entry.
    if (TL_EXPECTED.filesPresent.length === TIMELINE_FILE_IDS.length) {
      expect(view.entries).toHaveLength(17);
    }
  });

  it('shares one date between the language and the country entry of a setting', async () => {
    if (!TL_EXPECTED.filesPresent.includes('languageCountry')) return;
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const view = await askTimeline();
    const language = view.entries.filter((entry) => entry.kind === 'language');
    const country = view.entries.filter((entry) => entry.kind === 'country');
    expect(language).toHaveLength(1);
    expect(country).toHaveLength(1);
    expect(language[0]!.date).toBe(country[0]!.date);
    expect(sortedRoots(language[0]!.accounts)).toEqual(sortedRoots(country[0]!.accounts));
  });

  it('puts the undated entry last and the kinds in the fixed chip order', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const view = await askTimeline();
    const last = view.entries[view.entries.length - 1]!;
    const hasUndated = TL_EXPECTED.entries.some((entry) => entry.date === null);
    if (hasUndated) expect(last.date).toBeNull();
    for (const entry of view.entries.slice(0, hasUndated ? -1 : undefined)) {
      expect(entry.date).not.toBeNull();
    }
    const kinds = [...new Set(view.entries.map((entry) => entry.kind))];
    const order = ['name', 'service', 'language', 'country', 'ban', 'thirdParty'];
    expect(kinds.sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual([
      ...TL_EXPECTED.kindsPresent,
    ]);
  });

  it('reports every present file ready and every removed one not-in-export', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const view = await askTimeline();
    for (const file of TIMELINE_FILE_IDS) {
      expect(view.files[file], file).toBe(
        TL_EXPECTED.filesPresent.includes(file) ? 'ready' : 'not-in-export',
      );
    }
  });

  it('names only parts of the text kind: no timeline spec column is an address', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    // The capture admits no address in a history, ban or third-party file (rule d
    // keeps `IP` in Bans, Authorized_Third_Parties and Bonus_Codes only, and the
    // user's answers left none in the first two). So no part is address-kind, and
    // the planted TEST-NET address in the excluded `IP` columns is absent.
    const view = await askTimeline();
    for (const entry of view.entries) {
      for (const part of entry.parts) expect(part.kind, JSON.stringify(entry)).not.toBe('address');
    }
  });

  it('a second identical query is answered from the memo with the same view', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const first = JSON.stringify(await askTimeline());
    expect(JSON.stringify(await askTimeline())).toBe(first);
    // A genuine second import.
    const { db } = await importWorkerDb();
    await db.rows.clear();
    await db.meta.clear();
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three-again.zip');
    expect(JSON.stringify(await askTimeline())).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// The pane fact, and the row it becomes
// ---------------------------------------------------------------------------

describe('the Account timeline pane fact reaches the list', () => {
  it('publishes presence facts and STORED rows for the timeline pane', async () => {
    const result = await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    expect(result.newDataPanes).toEqual({ 'account-timeline': TL_EXPECTED.pane });
  });

  it('renders an unmuted row directly above Account, headlined with the stored rows', async () => {
    const result = await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const entries = paneEntries(result);
    const row = entries.find((entry) => entry.id === 'account-timeline');
    expect(row, 'the Account timeline row exists').toBeDefined();
    expect(row?.muted).toBe(false);
    // STORED rows, not the merged entry count (UI-SPEC Recorded Choice 7).
    expect(row?.headline).toBe(formatRowCount(TL_EXPECTED.pane.rowCount));
    expect(row?.summary).toBe(formatTimelineRowSummary(TL_EXPECTED.pane.fileCount));
    expect(entries[entries.indexOf(row!) + 1]?.id).toBe('account');
    expect(entries[entries.indexOf(row!) - 1]?.id).toBe('device-info');
  });
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

/** Every file name and every EXCLUDED header of the present timeline files. */
function forbiddenNames(): string[] {
  const out: string[] = [];
  for (const id of TL_EXPECTED.filesPresent) {
    const key = tlFileKey(id);
    out.push(CAPTURED_FILES.find((file) => file.key === key)!.fileName);
    const allowed = new Set(
      NEW_DATA_SPEC_FILES.find((spec) => spec.key === key)!.columns.map((column) => column.header),
    );
    // Short headers (`IP`, `UID`) are common substrings of ordinary words, so only
    // the names that are unambiguous in a JSON view are searched for.
    for (const header of headersOf(key)!.headers) {
      if (!allowed.has(header) && header.length >= 6) out.push(header);
    }
  }
  return out;
}

describe('nothing planted reaches storage or a posted view', () => {
  it('the fixture really carries every canary the assertions rule out', () => {
    // Without this, each negative assertion below would pass against a build that
    // stored nothing, because there would be nothing to store.
    const text = Object.values(unzipSync(buildTimelineThreeAccountExport()))
      .map((bytes) => new TextDecoder('utf-8').decode(bytes))
      .join('\n');
    const present = new Set<TlFileId>(TL_EXPECTED.filesPresent);
    const required: [TlFileId | null, string[]][] = [
      ['name', [TL_EMAIL_OLD_NAME]],
      ['service', [TL_EMAIL_OPERATION, TL_EMAIL_UID]],
      ['languageCountry', [TL_EMAIL_VALUE]],
      ['bans', [TL_EMAIL_STATUS]],
      ['thirdParties', [TL_EMAIL_SITE]],
      [null, [TL_NICKNAME_CANARY]],
    ];
    for (const [file, canaries] of required) {
      if (file !== null && !present.has(file)) continue;
      for (const canary of canaries) expect(text, `${canary} in the archive`).toContain(canary);
    }
  });

  it('plants an email or an address and finds it nowhere at rest or in the view', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const atRest = await everythingAtRest();
    const viewText = JSON.stringify(await askTimeline());
    for (const canary of TL_CANARIES) {
      // The nickname is stored on purpose, in the meta identity (the identity
      // header shows it); what matters is that the VIEW never carries it.
      if (canary !== TL_NICKNAME_CANARY) {
        expect(atRest, `${canary} reached storage`).not.toContain(canary);
      }
      expect(viewText, `${canary} reached the posted view`).not.toContain(canary);
    }
  });

  it('the view carries no file name, no excluded header text and no nickname', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const viewText = JSON.stringify(await askTimeline());
    for (const name of forbiddenNames()) {
      expect(viewText, `${name} in the posted view`).not.toContain(name);
    }
    expect(viewText).not.toContain(TL_NICKNAME_CANARY);
    // The name HISTORY values do appear: they are the entries.
    if (TL_EXPECTED.filesPresent.includes('name')) expect(viewText).toContain('AlphaOld');
  });

  it('the stored rows of the present files carry spec keys only', async () => {
    await ingest(buildTimelineThreeAccountExport(), 'timeline-three.zip');

    const { db } = await importWorkerDb();
    const all = await db.rows.toArray();
    for (const id of TL_EXPECTED.filesPresent) {
      const key = tlFileKey(id);
      const fileName = CAPTURED_FILES.find((file) => file.key === key)!.fileName;
      const allowed = new Set(
        NEW_DATA_SPEC_FILES.find((spec) => spec.key === key)!.columns.map((column) => column.id),
      );
      const rows = all.filter((row) => row.sourceFile === fileName);
      expect(rows, id).toHaveLength(TL_EXPECTED.perFile[id]!.storedRows);
      for (const row of rows) {
        for (const column of Object.keys(row.data)) {
          expect(allowed.has(column), `${id}.${column}`).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The per-file states
// ---------------------------------------------------------------------------

describe('a file that cannot contribute is a state, never an error', () => {
  // The first present file stands in for "one file"; the others are the control.
  const target = TL_EXPECTED.filesPresent[0]!;
  const others = TL_EXPECTED.filesPresent.filter((file) => file !== target);

  /** The full archive with one present file's CSV replaced, or removed when `body` is null. */
  function archiveWith(body: string | null): Uint8Array {
    const entries = unzipSync(buildTimelineThreeAccountExport());
    const { folder, fileName } = tlLocation(target);
    for (const path of Object.keys(entries)) {
      if (!path.endsWith(`/${folder}/${fileName}`)) continue;
      if (body === null) delete entries[path];
      else entries[path] = new TextEncoder().encode(body);
    }
    return zipSync(entries);
  }

  it('answers a drifted copy skipped and still answers the other files', async () => {
    await ingest(archiveWith('DRIFTED_ALPHA,DRIFTED_BETA\nx,y\nz,w\n'), 'drifted.zip');

    const view = await askTimeline();
    expect(view.files[target]).toBe('skipped');
    for (const file of others) expect(view.files[file], file).toBe('ready');
    // The other files' entries are all still there.
    const expected = TL_EXPECTED.entries.filter((entry) => entry.file !== target);
    expect(view.entries).toHaveLength(expected.length);
  });

  it('answers a header-only copy no-rows', async () => {
    const header = headersOf(tlFileKey(target))!.headers.join(',');
    await ingest(archiveWith(`${header}\n`), 'header-only.zip');

    const view = await askTimeline();
    expect(view.files[target]).toBe('no-rows');
    for (const file of others) expect(view.files[file], file).toBe('ready');
  });

  it('answers an absent copy not-in-export', async () => {
    await ingest(archiveWith(null), 'absent.zip');

    const view = await askTimeline();
    expect(view.files[target]).toBe('not-in-export');
    for (const file of others) expect(view.files[file], file).toBe('ready');
  });

  it('answers every file not-in-export for an export with no timeline file at all', async () => {
    await ingest(
      archiveOf(TL_ROOT_A, { 'Payment_History/orders.csv': 'ID;AMOUNT\n1;2\n' }),
      'none.zip',
    );

    const view = await askTimeline();
    for (const file of TIMELINE_FILE_IDS) expect(view.files[file], file).toBe('not-in-export');
    expect(view.entries).toEqual([]);
    expect(view.storedRows).toBe(0);
    expect(view.mergedAway).toBe(0);
  });

  it('builds a single-file archive through the helper the fixture exports', async () => {
    const key = tlFileKey(target);
    const { folder, fileName } = tlLocation(target);
    const header = headersOf(key)!.headers;
    const row = Object.fromEntries(header.map((name) => [name, '']));
    await ingest(
      archiveOf(TL_ROOT_A, { [`${folder}/${fileName}`]: tlCsvFor(key, [row]) }),
      'single.zip',
    );

    const view = await askTimeline();
    expect(view.files[target]).not.toBe('not-in-export');
    for (const file of others) expect(view.files[file], file).toBe('not-in-export');
  });
});
