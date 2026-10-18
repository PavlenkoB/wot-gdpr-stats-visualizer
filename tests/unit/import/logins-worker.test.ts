import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLogins, viewFromLogins } from '../../../src/lib/features/logins/login-aggregate.ts';
import { isDataQuery } from '../../../src/lib/worker/data-queries.ts';
import { lookupCountry } from '../../../src/lib/geo/country-lookup.ts';
import {
  LOGINS_HAND_KEY,
  LOGINS_IP_HOME,
  buildLoginsHandExport,
  handAddressesOwnedBy,
} from '../../fixtures/logins-fixtures.ts';
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
import type { LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import { SAMPLE_IP } from '../../fixtures/export-fixtures.ts';
import { SAMPLE_ACCOUNT_ROOT } from '../../fixtures/sample-account.ts';

// =============================================================================
// 06-01 Task 1 (tracer) — one session row to a logins answer, end to end
// =============================================================================
//
// This is the tracer rather than a unit test of one helper because the property
// that matters is a property of the CHAIN. Four things cannot be seen by looking
// at any single file:
//
//   1. that the parse loop offers its rows to the login aggregator at all, and
//      that a header-only file still reaches it;
//   2. that the aggregate lands on the META record in the same `meta.put` as
//      the rows, and stays off `ClassifyResult`;
//   3. that the answer's `importedAt` is the one the import reported, so a
//      replace cannot tear the block's numbers from the dataset they describe;
//   4. that a throwing aggregation costs the user their import NOTHING (T-04-03
//      restated for this channel) and that the error detail that escapes the
//      worker is a NAME and never a message (T-06-01).
//
// The expected view is `LOGINS_HAND_KEY`, derived from the fixture rows by hand
// and computed with the platform clock — never by calling `buildLogins`. A
// wrong wiring and a changed aggregator both fail the same assertion.
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

/** Post one query and return whichever of the two replies arrives. */
async function ask(
  spy: WorkerPostSpy,
  query: unknown,
  queryId: number,
): Promise<Extract<IngestResponse, { type: 'data-result' | 'data-error' }>> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < 5_000) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-result' || msg?.type === 'data-error') return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('ask: no data-result or data-error within 5,000 ms');
}

/** The `ready` view of a logins reply, or a failure naming the reply. */
function loginsView(
  reply: Extract<IngestResponse, { type: 'data-result' | 'data-error' }>,
): LoginsView {
  if (reply.type === 'data-error') {
    throw new Error(`expected a data-result, got data-error (${reply.detail})`);
  }
  if (reply.result === null) throw new Error('expected a logins result, got null');
  if (reply.result.channel !== 'logins') {
    throw new Error(`expected the logins channel, got ${reply.result.channel}`);
  }
  return reply.result.view;
}

describe('06-01 tracer: the logins channel through the real worker', () => {
  it('answers a posted logins query with the hand-derived view and the done importedAt', async () => {
    const terminal = await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') throw new Error('expected done');
    const importedAt = terminal.result.importedAt;

    const reply = await ask(post, { channel: 'logins' }, 7);
    expect(reply.type).toBe('data-result');
    if (reply.type !== 'data-result') throw new Error('unreachable: asserted above');
    expect(reply.queryId).toBe(7);

    // The answer belongs to the dataset the import just wrote — the same
    // pairing the playtime and data channels use (T-05-19).
    expect(reply.importedAt).toBe(importedAt);

    const view = loginsView(reply);
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') throw new Error('unreachable: asserted above');

    // THE assertion: the worker produced the hand key, field for field. The
    // one projection is the OWNER (Phase 10, D-18): the hand key is derived
    // from rows, which name no account, and the worker stamps the files' one
    // root onto every source — so every address here is owned by it.
    expect(view.addresses).toEqual(handAddressesOwnedBy(SAMPLE_ACCOUNT_ROOT));
    expect(view.totalLogins).toBe(LOGINS_HAND_KEY.totalLogins);
    expect(view.unreadableRows).toBe(LOGINS_HAND_KEY.unreadableRows);
    expect(view.unknown).toEqual(LOGINS_HAND_KEY.unknown);
    expect(view.first).toBe(LOGINS_HAND_KEY.first);
    expect(view.last).toBe(LOGINS_HAND_KEY.last);
    expect(view.addresses[0]?.ip).toBe(LOGINS_IP_HOME);
  });

  it('answers importedAt null and result null with no dataset imported', async () => {
    const reply = await ask(post, { channel: 'logins' }, 1);
    expect(reply.type).toBe('data-result');
    if (reply.type !== 'data-result') throw new Error('unreachable: asserted above');
    expect(reply.importedAt).toBeNull();
    expect(reply.result).toBeNull();
  });

  it('answers exactly one data-result for the id that was asked', async () => {
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const reply = await ask(post, { channel: 'logins' }, 7);
    const results = post.mock.calls
      .map((c) => c[0] as IngestResponse)
      .filter((m) => m.type === 'data-result');
    expect(results).toHaveLength(1);
    expect(reply.queryId).toBe(7);
  });

  it('answers from the stored aggregate, and the done result carries no logins field', async () => {
    const terminal = await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();

    // Stored on the meta record (D-12), in the same `meta.put` as the rows.
    const stored = (meta as { logins?: { addresses?: unknown[] } | null }).logins;
    expect(stored).not.toBeNull();
    expect(Array.isArray(stored?.addresses)).toBe(true);

    // And NOT on the import result: `IngestClient` holds that as a deep `$state`
    // proxy, which would walk every address on every replay (the reason 04-01
    // put playtime on the meta record rather than here).
    if (terminal.type !== 'done') throw new Error('expected done');
    expect('logins' in terminal.result).toBe(false);

    // The answer is the stored aggregate projected, not a second aggregation.
    const view = loginsView(await ask(post, { channel: 'logins' }, 1));
    expect(view).toEqual(viewFromLogins(stored as never));
  });

  it('leaves the four Phase 5 channels answering after a logins query', async () => {
    // One channel's branch running before `DATA_FILES` must not have narrowed
    // the other four: `DATA_FILES` was re-keyed to exclude `logins`, and a
    // channel silently falling out of it would be invisible until a user
    // switched dashboards.
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    for (const channel of ['premium', 'currency', 'spend'] as const) {
      const reply = await ask(post, { channel }, 1);
      expect(reply.type, channel).toBe('data-result');
    }
    const vehicles = await ask(post, { channel: 'vehicles', title: 'wot', battleType: null }, 1);
    expect(vehicles.type).toBe('data-result');
  });
});

describe('06-01: logins query validation (T-05-18, T-06-01)', () => {
  it('accepts a bare logins query and rejects it carrying either extra field', () => {
    expect(isDataQuery({ channel: 'logins' })).toBe(true);
    // Rejected rather than ignored: silently dropping a field this code does
    // not understand is how a future field starts being trusted by accident.
    expect(isDataQuery({ channel: 'logins', title: 'wot' })).toBe(false);
    expect(isDataQuery({ channel: 'logins', battleType: '1' })).toBe(false);
    expect(isDataQuery({ channel: 'logins', title: null, battleType: null })).toBe(false);
    expect(isDataQuery({ channel: 'nope' })).toBe(false);
    expect(isDataQuery({})).toBe(false);
  });

  it('answers a smuggled field with the fixed detail and never reaches a builder', async () => {
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const reply = await ask(post, { channel: 'logins', title: 'wot' }, 9);
    expect(reply.type).toBe('data-error');
    if (reply.type !== 'data-error') throw new Error('unreachable: asserted above');
    expect(reply.detail).toBe('invalid query');

    // And a well-formed query still answers, so the rejection is a message and
    // not a poisoned channel.
    expect(loginsView(await ask(post, { channel: 'logins' }, 10)).status).toBe('ready');
  });
});

describe('06-01: an aggregation that throws costs the import nothing (T-04-03)', () => {
  it('finishes the import with no stored aggregate and a name-only error', async () => {
    // Mock the aggregator BEFORE the worker loads, so buildLogins throws inside
    // the real handler. The message carries a cell-like string on purpose: that
    // string is what must never leave the worker (T-06-01).
    const LEAK = 'ip-cell-shaped-secret-4f2c';
    vi.resetModules();
    vi.doMock('../../../src/lib/features/logins/login-aggregate.ts', async (importOriginal) => {
      const actual =
        await importOriginal<
          typeof import('../../../src/lib/features/logins/login-aggregate.ts')
        >();
      return {
        ...actual,
        buildLogins: () => {
          throw new Error(`range table unavailable for ${LEAK}`);
        },
      };
    });
    const spy = installWorkerScope();
    await deleteActiveDatabase();
    await loadWorker();

    try {
      const terminal = await ingestExport(spy, buildLoginsHandExport(), 'logins.zip');
      // The import still SUCCEEDED. The rows are the dataset; the aggregate is
      // derived, so a bug in one must not cost the user the other.
      expect(terminal.type).toBe('done');

      const { db } = await importWorkerDb();
      const meta = await db.meta.get('active');
      expect(meta).toBeDefined();
      // Nothing stored rather than a half-written aggregate.
      const stored = (meta as { logins?: unknown }).logins;
      expect(stored === null || stored === undefined).toBe(true);

      // Task 3's rebuild path now runs: it reads the stored rows and calls the
      // SAME buildLogins, which throws again. The answer is therefore still an
      // error — and it is still the error's NAME, never the message that
      // carries the cell-shaped text.
      const reply = await ask(spy, { channel: 'logins' }, 1);
      expect(reply.type).toBe('data-error');
      if (reply.type !== 'data-error') throw new Error('unreachable: asserted above');
      expect(reply.detail).toBe('Error');

      // A rebuild that throws wrote NOTHING: no half-derived aggregate reached
      // the record, so the next build that aggregates correctly still finds the
      // null this import left.
      const after = await importWorkerDb();
      const metaAfter = (await after.db.meta.get('active')) as { logins?: unknown };
      expect(metaAfter.logins === null || metaAfter.logins === undefined).toBe(true);

      // The message text is absent from EVERY posted message, not just this one.
      const everything = JSON.stringify(spy.mock.calls.map((c) => c[0]));
      expect(everything).not.toContain(LEAK);

      // And the OTHER channels are unaffected, because the throw was contained.
      expect((await ask(spy, { channel: 'premium' }, 2)).type).toBe('data-result');
    } finally {
      // Unconditional: a registered `doMock` would make every LATER test in
      // this file build its aggregate from a throwing function, which is a
      // confusing failure that looks like a product bug.
      vi.doUnmock('../../../src/lib/features/logins/login-aggregate.ts');
      vi.resetModules();
    }
  });
});

describe('06-01: the stored aggregate is what the aggregator produced', () => {
  it('equals buildLogins over the same parsed rows, country for country', async () => {
    // An independent check that the WORKER wired the same columns the unit
    // test does: parsed here by the production parser from the fixture's own
    // rendered text, aggregated by the production aggregator, and compared with
    // what the worker stored. It is not a substitute for the hand key above —
    // it is a second pair of eyes on the parse step between them.
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    const stored = (meta as { logins?: unknown }).logins;
    expect(stored).not.toBeNull();

    const rows = await db.rows.where('sourceFile').equals('WOT_Game_Sessions.csv').toArray();
    const wows = await db.rows.where('sourceFile').equals('WOWS_Game_Sessions.csv').toArray();
    // 06-05, D-02: the hand export's `Account_Info.csv` is still in it, so the
    // aggregate now carries the one labelled Account record beside the session
    // figures. It is handed in as the same literal the worker builds from the
    // same sanitised pool — `extractAccountRecord` over `SAMPLE_ACCOUNT_ROOT`'s
    // row, whose `IP` is the sample's own `192.0.2.10` and whose `COUNTRY_CODE`
    // and `CITY` are the sample's `US` and `Testville`. The check this case
    // exists for is the WIRING, so the record is part of the expected value
    // rather than excluded from the comparison.
    const expected = buildLogins(
      [
        // Phase 10, D-18: the sources carry the OWNER, exactly as the import
        // loop stamps it. A rebuild that dropped the stamp would store addresses
        // with no accounts, and this equality is where that would show.
        {
          kind: 'sessions',
          game: 'WOT',
          rows: rows.map((r) => r.data),
          account: SAMPLE_ACCOUNT_ROOT,
        },
        {
          kind: 'sessions',
          game: 'WOWS',
          rows: wows.map((r) => r.data),
          account: SAMPLE_ACCOUNT_ROOT,
        },
      ],
      // 06-06: the worker's real lookup, not a null stand-in. The stored record
      // now carries the fixture table's countries, so an expectation built with
      // `() => null` would be asserting the shape the worker stopped producing.
      lookupCountry,
      { ip: SAMPLE_IP, ipState: 'readable', countryCode: 'US', city: 'Testville' },
    );
    expect(stored).toEqual(expected);
  });
});
