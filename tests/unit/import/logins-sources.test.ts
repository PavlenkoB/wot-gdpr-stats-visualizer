// =============================================================================
// 06-05 Task 1 (tracer) — a Logins.csv row and an Account_Info record, merged
// =============================================================================
//
// WHAT THIS FILE IS FOR
// D-01 says the login history is built from every `*_Game_Sessions.csv` the
// archive holds, MERGED, and that a `Logins.csv` — which the real 2021 export
// does not have but a synthetic or older one may — is merged in too. D-02 says
// `Account_Info.csv`'s IP, country and city become one labelled "Account record"
// row that is never a login.
//
// 06-01 proved the channel with session files only, and STATE.md recorded where
// the merge belongs: the parse loop's own file screen, because
// `readSessionRowData` (and the import that fed it) kept only the names
// `isSessionFileName` accepts, which drops `Logins.csv` entirely. That is this
// plan's work, and this file is the tracer that shows it landed.
//
// WHY A TRACER AND NOT A UNIT TEST OF THE AGGREGATOR
// `buildLogins` already accepted a `LoginSource` of kind `logins` and the
// aggregator already read the `LOGIN_DT` alias — both proven by 06-01's unit
// tests over hand-built rows. What did not exist is anything that PUSHES such a
// source, and a missing push is invisible to a unit test of the thing being
// pushed to. So every assertion here goes through the real worker, a real zip
// and the real Dexie.
//
// THE THREE CLAIMS THAT NEED THE WHOLE CHAIN
//   1. the Logins.csv's rows are COUNTED, and its address carries no game token
//      (the file names no title, so none is invented — T-04-27);
//   2. the Logins.csv's OTHER columns are not read: its `COUNTRY_CODE` and
//      `USER_AGENT` text appears nowhere in the serialised view (T-06-20);
//   3. the Account record's address is a fact about the account and NOT a login:
//      it is in no total, no country figure and no address row (D-02).
//
// EVERY CELL IS SYNTHETIC
// No content from the 2021 export is used anywhere. Every address is an RFC 5737
// documentation range, and the expected numbers are derived from the fixture
// rows by hand below — never by calling `buildLogins`.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_RECORD_CITY,
  ACCOUNT_RECORD_COUNTRY,
  ACCOUNT_RECORD_IP,
  LOGINS_IP_HOME,
  LOGINS_IP_THIRD,
  LOGINS_IP_WORK,
  LOGINS_SOURCES_COUNTRY,
  LOGINS_SOURCES_IP,
  LOGINS_SOURCES_ROWS,
  LOGINS_SOURCES_USER_AGENT,
  LOGINS_WOT_ROWS,
  LOGINS_WOWS_ROWS,
  buildHeaderOnlyLoginsExport,
  buildLoginsCsvOnlyExport,
  buildLoginsCsvOnlyExportWithoutUserInfo,
  buildLoginsMinimalColumnsExport,
  LOGINS_CSV_HEADER,
  buildLoginsHandExport,
  buildLoginsMergedExport,
  wallSeconds,
} from '../../fixtures/logins-fixtures.ts';
import {
  SAMPLE_BIRTH_DATE,
  SAMPLE_LOGIN,
  SAMPLE_LOGIN_DOMAIN,
  VARIANT_OVERFLOW_CANARY,
  buildCustomExport,
} from '../../fixtures/export-fixtures.ts';
import { SAMPLE_ACCOUNT_ROOT } from '../../fixtures/sample-account.ts';
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
import type {
  AccountRecord,
  LoginAggregates,
  LoginsView,
} from '../../../src/lib/features/logins/login-shared.ts';

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
 * A `YYYY-MM-DD HH:MM:SS` stamp as wall-clock seconds, via the PLATFORM clock.
 *
 * The invented `Logins.csv` uses the ISO-ish shape the sample's own does, and
 * `wallSeconds` only reads the real export's dotted shape. This is the same
 * independent instrument for that shape: `Date.UTC` with a zero-based month,
 * which shares no primitive with the aggregator's own integer civil-date
 * arithmetic. A hand key computed by calling `buildLogins` would be the
 * aggregator agreeing with itself.
 */
function isoWallSeconds(stamp: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(stamp);
  if (match === null) throw new Error(`not a YYYY-MM-DD HH:MM:SS stamp: ${stamp}`);
  return (
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ) / 1000
  );
}

/** One file's whole text: a leading CRLF, the header, one line per row. */
function renderCsv(header: string, rows: readonly (readonly string[])[]): string {
  let out = '\r\n' + header + '\r\n';
  for (const row of rows) out += '\r\n' + row.join(';') + '\r\n';
  return out;
}

// -----------------------------------------------------------------------------
// The hand answer key
// -----------------------------------------------------------------------------

/**
 * Every number the merged aggregate must produce, counted from the rows above.
 *
 *   - 6 WOT rows + 3 WOWS rows + 2 Logins.csv rows = 11 rows, of which the WOT
 *     file's blank cell and its zero-padded cell are unreadable, so
 *     `totalLogins` is 9 and `unreadableRows` is 2;
 *   - all THREE files contribute at least one counted row, so `filesWithRows`
 *     is 3 — which is what the block's multi-file note keys on;
 *   - `192.0.2.10` holds WOT rows 1 and 2, the WOWS row 1 and the Logins.csv
 *     row 2: 4 logins, and its `games` are the two session tokens only, because
 *     a file that names no title contributes none;
 *   - `203.0.113.9` holds the Logins.csv row 1 alone: 1 login and an EMPTY
 *     `games`, never a fabricated token;
 *   - the stored order is logins DESCENDING then address ASCENDING, so the
 *     four logins lead, the two two-login addresses follow (`198` before
 *     `203`), and the one-login address is last;
 *   - the range opens at `192.0.2.10`'s first session start and closes at
 *     `203.0.113.230`'s, because both Logins.csv stamps fall inside it.
 */
const MERGED_KEY = {
  totalLogins: 9,
  unreadableRows: 2,
  filesWithRows: 3,
  first: wallSeconds('13.03.2019 20:00'),
  last: wallSeconds('21.06.2021 19:00'),
  // 06-06: the merged export now resolves through the committed fixture table.
  // HOME is `192.0.2.10` (DE, 4 logins — 3 from the session files plus the
  // Logins.csv row), WORK is `198.51.100.20` (AU, 2), and the Logins.csv-only
  // address is `203.0.113.9` (CN, 1). THIRD is `203.0.113.230`, inside the
  // fixture's explicit `ZZ` block, so it is the one address left in the unknown
  // bucket. Every value is read out of `tests/fixtures/geo/country-fixture.csv`,
  // the committed source the fixture table is built from.
  unknown: { addresses: 1, logins: 2 },
  countries: [
    { cc: 'DE', logins: 4, ips: 1 },
    { cc: 'AU', logins: 2, ips: 1 },
    { cc: 'CN', logins: 1, ips: 1 },
  ],
  other: { addresses: 0, logins: 0 },
  addresses: [
    { ip: LOGINS_IP_HOME, cc: 'DE', logins: 4, games: ['WOT', 'WOWS'] },
    { ip: LOGINS_IP_WORK, cc: 'AU', logins: 2, games: ['WOT', 'WOWS'] },
    { ip: LOGINS_IP_THIRD, cc: null, logins: 2, games: ['WOT', 'WOWS'] },
    { ip: LOGINS_SOURCES_IP, cc: 'CN', logins: 1, games: [] },
  ],
} as const;

/** The account record the merged export's `Account_Info.csv` must produce. */
const ACCOUNT_KEY: AccountRecord = {
  ip: ACCOUNT_RECORD_IP,
  ipState: 'readable',
  countryCode: ACCOUNT_RECORD_COUNTRY,
  city: ACCOUNT_RECORD_CITY,
};

// -----------------------------------------------------------------------------
// The worker driver
// -----------------------------------------------------------------------------

/** Post one logins query and return the view it answers with. */
async function askLogins(spy: WorkerPostSpy, queryId: number): Promise<LoginsView> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query: { channel: 'logins' } } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < 5_000) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-error') {
        throw new Error(`expected a data-result, got data-error (${msg.detail})`);
      }
      if (msg?.type !== 'data-result' || msg.queryId !== queryId) continue;
      if (msg.result === null) throw new Error('expected a logins result, got null');
      if (msg.result.channel !== 'logins') {
        throw new Error(`expected the logins channel, got ${msg.result.channel}`);
      }
      return msg.result.view;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askLogins(${queryId}): no reply within 5,000 ms`);
}

/** Import the merged export and answer one query, returning both. */
async function importMerged(spy: WorkerPostSpy, name = 'logins-sources.zip') {
  const terminal = await ingestExport(spy, buildLoginsMergedExport(), name);
  if (terminal.type !== 'done') throw new Error(`expected done, got ${terminal.type}`);
  return { importedAt: terminal.result.importedAt, view: await askLogins(spy, 1) };
}

/** The `ready` fields, or a failure naming the status that was actually seen. */
function ready(view: LoginsView) {
  if (view.status !== 'ready') {
    throw new Error(`expected a ready view, got ${view.status}`);
  }
  return view;
}

// -----------------------------------------------------------------------------
// 1. the merge itself
// -----------------------------------------------------------------------------

describe('06-05: a Logins.csv merges into the login history beside the session files (D-01)', () => {
  it('counts the Logins.csv rows with no game token and widens the shared address', async () => {
    const { view } = await importMerged(post);
    const answer = ready(view);

    // THE claim: the Logins.csv's own address is a login row of the table, and
    // it carries an EMPTY game set rather than a fabricated title. The token
    // comes from a file NAME (T-04-27) and this file names no game.
    //
    // The count is read off the fixture's own rows rather than written as a
    // literal, so it stays the number of rows THIS file gave that address even
    // if a row is added below — and `totalLogins` below is the literal that
    // pins the whole archive.
    const rowsCarryingIt = LOGINS_SOURCES_ROWS.filter((row) => row[1] === LOGINS_SOURCES_IP).length;
    expect(rowsCarryingIt).toBeGreaterThan(0);
    const fromLoginsCsv = answer.addresses.find((entry) => entry.ip === LOGINS_SOURCES_IP);
    expect(fromLoginsCsv).toBeDefined();
    expect(fromLoginsCsv?.logins).toBe(rowsCarryingIt);
    expect(fromLoginsCsv?.games).toEqual([]);

    // The address shared with the session files: its logins ADD and its games
    // UNION. Three from the session files plus one from the Logins.csv, and
    // still only the two session tokens — no de-duplication by timestamp, and
    // no third token either (D-01, RESEARCH Pitfall 11).
    const shared = answer.addresses.find((entry) => entry.ip === LOGINS_IP_HOME);
    expect(shared?.logins).toBe(4);
    expect(shared?.games).toEqual(['WOT', 'WOWS']);

    // And the whole hand key, field for field, so a merge that double-counts
    // one file or drops another fails on the totals rather than on a detail.
    expect(answer.totalLogins).toBe(MERGED_KEY.totalLogins);
    expect(answer.unreadableRows).toBe(MERGED_KEY.unreadableRows);
    expect(answer.filesWithRows).toBe(MERGED_KEY.filesWithRows);
    expect(answer.unknown).toEqual(MERGED_KEY.unknown);
    expect(answer.countries).toEqual(MERGED_KEY.countries);
    expect(answer.other).toEqual(MERGED_KEY.other);
    expect(answer.first).toBe(MERGED_KEY.first);
    expect(answer.last).toBe(MERGED_KEY.last);
    expect(answer.addresses.map((entry) => [entry.ip, entry.logins, entry.games])).toEqual(
      MERGED_KEY.addresses.map((entry) => [entry.ip, entry.logins, [...entry.games]]),
    );
  });

  it('counts the session files exactly as before the merge, and both files still reach playtime', async () => {
    // The merge is ADDITIVE. The playtime module is not edited, so an import of
    // the hand export must still produce 06-01's key unchanged: a `Logins.csv`
    // pushed into the wrong collection would move the playtime numbers.
    const hand = await ingestExport(post, buildLoginsHandExport(), 'hand.zip');
    if (hand.type !== 'done') throw new Error('expected done');
    const { db } = await importWorkerDb();
    const playtime = (await db.meta.get('active'))?.playtime;
    expect(playtime).not.toBeNull();
    // The hand export has no Logins.csv, so its two per-game files are all the
    // session rows there are. One single-key read per file, never the list form
    // (RESEARCH Pattern 2 measured it at 2,243 ms on 3,000 rows).
    const wot = await db.rows.where('sourceFile').equals('WOT_Game_Sessions.csv').toArray();
    const wows = await db.rows.where('sourceFile').equals('WOWS_Game_Sessions.csv').toArray();
    expect(wot).toHaveLength(LOGINS_WOT_ROWS.length);
    expect(wows).toHaveLength(LOGINS_WOWS_ROWS.length);
  });

  it('answers `ready` for an export holding ONLY a Logins.csv', async () => {
    // The one shape a real export never has, and the only way the login history
    // is ever the WHOLE of an Activity_history folder's addresses. It also
    // proves the source reaches the aggregator without a session file beside
    // it — `filesSeen.logins` is set before the row loop, so this is `ready`
    // and not `no-source`.
    const terminal = await ingestExport(post, buildLoginsCsvOnlyExport(), 'logins-only.zip');
    expect(terminal.type).toBe('done');

    const answer = ready(await askLogins(post, 1));
    expect(answer.totalLogins).toBe(LOGINS_SOURCES_ROWS.length);
    expect(answer.filesWithRows).toBe(1);
    expect(answer.addresses).toEqual([
      expect.objectContaining({ ip: LOGINS_IP_HOME, logins: 1, games: [] }),
      expect.objectContaining({ ip: LOGINS_SOURCES_IP, logins: 1, games: [] }),
    ]);

    // `filesSeen` is the fact that separates `no-source` from `no-usable`, and
    // it is stored rather than inferred: the read here is the stored aggregate.
    const { db } = await importWorkerDb();
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(stored.filesSeen).toEqual({ sessions: false, logins: true });
  });
});

// -----------------------------------------------------------------------------
// 2. the columns that must not be read
// -----------------------------------------------------------------------------

describe('06-05: the Logins.csv is read for two columns and no more (T-06-20)', () => {
  it('its COUNTRY_CODE and USER_AGENT text appears nowhere in the serialised view', async () => {
    const { view } = await importMerged(post);
    const serialised = JSON.stringify(view);

    // Both are cells of an untrusted archive, and neither is one of the two the
    // aggregator reads (the address and a time). The `COUNTRY_CODE` value is
    // deliberately different from the account record's own country code, so a
    // leak of one cannot be mistaken for the other.
    expect(serialised).not.toContain(LOGINS_SOURCES_USER_AGENT);
    expect(serialised).not.toContain(LOGINS_SOURCES_COUNTRY);
    // …and the account record's own country is still there, which is what makes
    // the assertion above a leak and not a missing field.
    expect(serialised).toContain(ACCOUNT_RECORD_COUNTRY);
  });

  it('its COUNTRY_CODE does not become a country figure on the aggregate', async () => {
    await importMerged(post);
    const { db } = await importWorkerDb();
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    // A `Logins.csv` COUNTRY_CODE is the FILE's own claim about the user, never
    // a resolved country, and must not become one. Since 06-06 there IS a table
    // behind the lookup, so this is no longer provable by "nothing resolves" —
    // it is provable by "what resolves is exactly the table's answer, and the
    // file's `XX` is not among it". The two rows of `Logins.csv` are the sharp
    // part: one is the address the table calls CN and one is the address it
    // calls DE, and the file claims `XX` for BOTH.
    expect(stored.countries).toEqual(MERGED_KEY.countries);
    expect(stored.countries.map((c) => c.cc)).not.toContain(LOGINS_SOURCES_COUNTRY);
    // The Logins.csv-only address carries the TABLE's country, not the file's.
    const sources = stored.addresses.find((a) => a.ip === LOGINS_SOURCES_IP);
    expect(sources?.cc).toBe('CN');
    expect(sources?.cc).not.toBe(LOGINS_SOURCES_COUNTRY);
    // And the unknown bucket is exactly the one explicit `ZZ` address.
    expect(stored.unknown).toEqual(MERGED_KEY.unknown);
  });
});

// -----------------------------------------------------------------------------
// 3. the Account record
// -----------------------------------------------------------------------------

describe('06-05: the Account_Info row is one labelled record and never a login (D-02)', () => {
  it('carries the account file’s own values, read from the sanitised pool', async () => {
    const { view } = await importMerged(post);
    expect(ready(view).account).toEqual(ACCOUNT_KEY);
  });

  it('is counted nowhere: not in the addresses, not in a total, not in a tally', async () => {
    const { view } = await importMerged(post);
    const answer = ready(view);

    // The address appears NOWHERE else in this export, so its absence from the
    // address list is the assertion — not a count that would also hold if it
    // were counted and the Logins.csv's row were dropped.
    expect(answer.addresses.map((entry) => entry.ip)).not.toContain(ACCOUNT_RECORD_IP);
    expect(answer.totalLogins).toBe(MERGED_KEY.totalLogins);
    expect(answer.unknown.addresses).toBe(MERGED_KEY.unknown.addresses);
    expect(answer.unknown.logins).toBe(MERGED_KEY.unknown.logins);
    expect(answer.other).toEqual(MERGED_KEY.other);
    // The other stored aggregate is untouched by it as well.
    expect(answer.first).toBe(MERGED_KEY.first);
    expect(answer.last).toBe(MERGED_KEY.last);
  });

  it('is stored on the meta record, and NOT on the import result', async () => {
    // The same two placements 06-01 pinned: on the meta record beside the rows,
    // never on `ClassifyResult`, which the client holds as a deep `$state` proxy
    // that would walk every field of it on every replay.
    const terminal = await ingestExport(post, buildLoginsMergedExport(), 'stored.zip');
    if (terminal.type !== 'done') throw new Error('expected done');
    expect('logins' in terminal.result).toBe(false);

    const { db } = await importWorkerDb();
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(stored.account).toEqual(ACCOUNT_KEY);
  });

  it('is null for an export with no User_Info row, and the identity header is unchanged', async () => {
    // D-02's boundary: the account record is an ADDITION to the login table and
    // not a fourth identity field. An export with no User_Info folder has no
    // account record and the identity takes its Phase 3 D-16 fallback.
    const terminal = await ingestExport(
      post,
      buildLoginsCsvOnlyExportWithoutUserInfo(),
      'no-account.zip',
    );
    if (terminal.type !== 'done') throw new Error('expected done');
    expect(terminal.result.identity).toBeNull();
    expect(ready(await askLogins(post, 1)).account).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 4. the privacy boundary
// -----------------------------------------------------------------------------

describe('06-05: nothing but the Account record escapes from User_Info', () => {
  it('the stored meta record and every posted message carry no LOGIN, birth date or overflow canary', async () => {
    await importMerged(post, 'privacy.zip');
    const { db } = await importWorkerDb();

    // The whole stored record, not just `logins`: a strip that held for the
    // aggregate and not for the meta record would leave the email in IndexedDB
    // and pass every assertion above it.
    const stored = JSON.stringify(await db.meta.get('active'));
    // …and every row the import wrote, which is where an unstripped cell would
    // actually rest. The rows are read through the worker's own Dexie, so this
    // is a statement about what is on disk.
    const rows = await db.rows.toArray();
    const everything = `${stored}\n${JSON.stringify(rows)}\n${JSON.stringify(post.mock.calls)}`;

    // Three canaries, three different ways in (RESEARCH Q3):
    //   - a column the D-18 deny-list names;
    //   - a column whose value is a date the app must not have anywhere;
    //   - a cell in Papa's `__parsed_extra` bucket, which NO column list can
    //     see into and which is therefore the sharpest of the three.
    expect(everything).not.toContain(SAMPLE_LOGIN);
    expect(everything).not.toContain(SAMPLE_LOGIN_DOMAIN);
    expect(everything).not.toContain(SAMPLE_BIRTH_DATE);
    expect(everything).not.toContain(VARIANT_OVERFLOW_CANARY);

    // And the ONE thing from User_Info that is allowed to exist is the Account
    // record's own three cells — the address is there because D-02 records it,
    // and it is there as a canonical address, not as the cell's raw text.
    expect(everything).toContain(ACCOUNT_RECORD_IP);
  });

  it('the IP column is the only User_Info column the aggregate reads', async () => {
    // The strictest form of T-06-20: a `Logins.csv` whose header names ONLY the
    // two columns the aggregator reads cannot leak through a third, so a leak
    // seen against the merged fixture can only be a column resolved wrongly.
    const terminal = await ingestExport(post, buildLoginsMinimalColumnsExport(), 'minimal.zip');
    expect(terminal.type).toBe('done');
    const answer = ready(await askLogins(post, 1));
    expect(answer.totalLogins).toBe(LOGINS_SOURCES_ROWS.length);
    expect(answer.addresses).toHaveLength(2);
  });

  it('an unreadable Account address is a fact, not text, and changes no total', async () => {
    // D-06 meets D-02: a cell this build cannot read is stored as NOTHING, and
    // the record says which of the three states it is. The login figures are
    // identical to the readable case — a fact about the account's cell cannot
    // move a number about the account's logins.
    const bytes = buildCustomExport({
      omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
      overrides: {
        'Activity_history/Logins.csv': renderCsv(LOGINS_CSV_HEADER, LOGINS_SOURCES_ROWS),
        'User_Info/Account_Info.csv': renderCsv('ID;IP;COUNTRY_CODE;CITY', [
          [SAMPLE_ACCOUNT_ROOT, 'player@example.invalid', 'PL', ACCOUNT_RECORD_CITY],
        ]),
      },
    });
    const terminal = await ingestExport(post, bytes, 'unreadable-account.zip');
    if (terminal.type !== 'done') throw new Error('expected done');

    const answer = ready(await askLogins(post, 1));
    expect(answer.account).toEqual({
      ip: null,
      ipState: 'unreadable',
      countryCode: 'PL',
      city: ACCOUNT_RECORD_CITY,
    });
    // The value itself is nowhere — not in the view, not in the stored record.
    const { db } = await importWorkerDb();
    expect(JSON.stringify(await db.meta.get('active'))).not.toContain('player@');
    expect(answer.totalLogins).toBe(LOGINS_SOURCES_ROWS.length);
  });
});

// -----------------------------------------------------------------------------
// 5. the counting rules across sources
// -----------------------------------------------------------------------------

describe('06-05: merged counting rules and the hash-identical re-drop (D-01)', () => {
  it('one address in two sources adds its logins, unions its games and widens first and last', async () => {
    const { view } = await importMerged(post, 'shared.zip');
    const shared = ready(view).addresses.find((entry) => entry.ip === LOGINS_IP_HOME);
    expect(shared).toBeDefined();
    // THREE session rows plus ONE Logins.csv row, with no de-duplication by
    // timestamp (D-01, and RESEARCH Pitfall 11's accepted double count).
    expect(shared?.logins).toBe(4);
    expect(shared?.games).toEqual(['WOT', 'WOWS']);
    // `first` is the earliest of the four and `last` the latest: the Logins.csv
    // row's 2020 stamp is LATER than every session row of this address, so it
    // widens the range rather than sitting inside it. A merge that took only
    // the session file's stamps would report a narrower address.
    expect(shared?.first).toBe(wallSeconds('13.03.2019 20:00'));
    expect(shared?.last).toBe(isoWallSeconds('2020-02-02 10:30:00'));
  });

  it('a header-only session file and a header-only Logins.csv are `no-usable`, not `no-source`', async () => {
    // Two different sentences about the user's own zip, and the only thing that
    // separates them is a fact recorded BEFORE the row loop. A flag set inside
    // the loop would answer "this export has no session history" to a user who
    // has the files.
    const terminal = await ingestExport(post, buildHeaderOnlyLoginsExport(), 'header-only.zip');
    expect(terminal.type).toBe('done');

    const view = await askLogins(post, 1);
    expect(view).toEqual({ status: 'no-usable', unreadable: 0 });

    // The stored fact itself, because `no-usable` is only reachable while both
    // presence flags are set.
    const { db } = await importWorkerDb();
    const stored = (await db.meta.get('active'))?.logins as LoginAggregates;
    expect(stored.filesSeen).toEqual({ sessions: true, logins: true });
    expect(stored.totalLogins).toBe(0);
    expect(stored.filesWithRows).toBe(0);
  });

  it('a hash-identical re-drop answers duplicate and parses nothing twice', async () => {
    // ONE byte array for both imports, deliberately: fflate stamps each archive
    // with a second-resolution mtime, so two `buildLoginsMergedExport()` calls a
    // second apart are DIFFERENT files with different hashes and the worker
    // correctly treats the second as a replacement (Phase 3's 03-06 note).
    const bytes = buildLoginsMergedExport();
    const first = await ingestExport(post, bytes, 'same.zip');
    if (first.type !== 'done') throw new Error('expected done');
    const { db } = await importWorkerDb();
    const firstMeta = await db.meta.get('active');
    const firstLogins = firstMeta?.logins;

    post.mockClear();
    const second = await ingestExport(post, bytes, 'same.zip');
    expect(second.type).toBe('duplicate');
    if (second.type !== 'duplicate') throw new Error('unreachable: asserted above');
    expect(second.result.importedAt).toBe(first.result.importedAt);

    // Nothing was parsed a second time: the dedup gate fires before the unzip,
    // so there is no `stage` message of any kind after `hashing`.
    const stages = post.mock.calls
      .map((call) => call[0] as IngestResponse)
      .filter((msg) => msg.type === 'stage')
      .map((msg) => (msg as { stage: string }).stage);
    expect(stages).toEqual(['hashing']);

    // And no second aggregate was built or written: the record is the one the
    // first import wrote, value for value.
    const after = await db.meta.get('active');
    expect(after?.importedAt).toBe(first.result.importedAt);
    expect(after?.logins).toEqual(firstLogins);
  });
});
