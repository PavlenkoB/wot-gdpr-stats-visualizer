import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { viewFromLogins } from '../../../src/lib/features/logins/login-aggregate.ts';
import { geoTableId, lookupCountry } from '../../../src/lib/geo/country-lookup.ts';
import { parseIp, type ParsedIp } from '../../../src/lib/geo/ip.ts';
import { isDataQuery } from '../../../src/lib/worker/data-queries.ts';
import {
  buildLoginsExportOfAddresses,
  buildLoginsHandExport,
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

// =============================================================================
// 06-06 tracer — a documentation address to a country, through the real worker
// =============================================================================
//
// This is the slice. One fixture address goes from a row in a real-shaped
// `WOT_Game_Sessions.csv`, through the production parser, the aggregator, the
// injected lookup, the LAZILY decoded inlined table and back out as a
// `cc` in the logins view the worker posts to the page.
//
// The expectation is read out of `tests/fixtures/geo/country-fixture.csv` —
// the committed SOURCE the fixture table is built from — rather than from the
// table itself or from a previous run of the lookup. Asserting against the
// binary would be the implementation agreeing with itself; asserting against
// the CSV keeps the test a statement about the data.
//
// Under Vitest the alias always points at the fixture table
// (`vitest.config.ts`), which is the only way a documentation address can
// resolve to a country at all: against the shipped table every one of them is
// `ZZ` (D-17, RESEARCH Pitfall 2). The shipped table is covered separately by
// `tests/unit/geo/country-table-shipped.test.ts` and by `pnpm run build`.
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

/** The fixture table's own CSV, as start/end/CC rows with comments stripped. */
const FIXTURE_CSV = readFileSync(
  new URL('../../fixtures/geo/country-fixture.csv', import.meta.url),
  'utf8',
);

/**
 * The country `country-fixture.csv` gives an address, or `ZZ`.
 *
 * Independent of the range table: it is a linear scan of the committed source
 * rows, so a bug in the encoder or the reader cannot make this answer agree
 * with the implementation.
 */
function csvCountryOf(raw: string): string {
  const parsed = parseIp(raw);
  if (parsed === null) throw new Error(`not an address: ${raw}`);
  const target = ipToTuple(parsed);
  if (target === null) throw new Error(`unreachable: ${raw} parsed and produced no bytes`);
  let answer = 'ZZ';
  for (const line of FIXTURE_CSV.split(/\r?\n/)) {
    const row = line.trim();
    if (row === '' || row.startsWith('#')) continue;
    const [start, end, cc] = row.split(',');
    if (start === undefined || end === undefined || cc === undefined) continue;
    const lo = ipToTuple(parseIp(start));
    const hi = ipToTuple(parseIp(end));
    if (lo === null || hi === null) continue;
    if (compareTuple(target, lo) >= 0 && compareTuple(target, hi) <= 0) answer = cc;
  }
  return answer;
}

/** An address's bytes as one comparable string (IPv4 before IPv6). */
function ipToTuple(parsed: ParsedIp | null): string | null {
  if (parsed === null) return null;
  const bytes = parsed.bytes;
  return `${bytes.length}:${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function compareTuple(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Post one query and return whichever of the two replies arrives. */
async function askLogins(spy: WorkerPostSpy, queryId: number): Promise<LoginsView> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query: { channel: 'logins' } } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < 5_000) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-result' && msg.result?.channel === 'logins') return msg.result.view;
      if (msg?.type === 'data-error') throw new Error(`data-error (${msg.detail})`);
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('askLogins: no data-result within 5,000 ms');
}

/** The `ready` view, or a failure naming the status that came back. */
function ready(view: LoginsView): Extract<LoginsView, { status: 'ready' }> {
  if (view.status !== 'ready') throw new Error(`expected a ready view, got ${view.status}`);
  return view;
}

describe('06-06 tracer: a documentation address resolves through the inlined table', () => {
  it('gives every listed address the country the fixture CSV gives it', async () => {
    const terminal = await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    expect(terminal.type).toBe('done');

    const view = ready(await askLogins(post, 1));

    // Not vacuous: every address here is inside one of the fixture's /27s, so
    // an empty list would pass a for-loop and prove nothing.
    expect(view.addresses.length).toBe(3);
    for (const address of view.addresses) {
      const csv = csvCountryOf(address.ip);
      const expected = csv === 'ZZ' ? null : csv;
      expect(address.cc, `${address.ip} (CSV says ${csv})`).toBe(expected);
    }
  });

  it('counts the explicit ZZ address as unknown country, never as a code', async () => {
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const view = ready(await askLogins(post, 2));

    // The one fixture block written as ZZ: 203.0.113.224/27, holding the hand
    // export's third address. A documentation address reaching the unknown
    // bucket is the sharp case — in production this is where a user's own
    // router address lands.
    const unknown = view.addresses.filter((a) => csvCountryOf(a.ip) === 'ZZ');
    expect(unknown.length).toBeGreaterThan(0);
    for (const address of unknown) expect(address.cc, address.ip).toBeNull();

    expect(view.unknown.addresses).toBe(unknown.length);
    expect(view.unknown.logins).toBe(unknown.reduce((sum, a) => sum + a.logins, 0));
    // And the bucket is not the whole answer: the other two resolved.
    expect(view.unknown.addresses).toBeLessThan(view.addresses.length);
  });

  it('tallies logins and distinct addresses per country, summing to the total', async () => {
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const view = ready(await askLogins(post, 3));

    // Rebuilt from the listed rows rather than copied: this is the shape the
    // map shades and the country list ranks, and a per-country total that
    // disagrees with the rows behind it is the failure that matters.
    const rolled = new Map<string, { logins: number; ips: number }>();
    for (const address of view.addresses) {
      if (address.cc === null) continue;
      const entry = rolled.get(address.cc) ?? { logins: 0, ips: 0 };
      entry.logins += address.logins;
      entry.ips += 1;
      rolled.set(address.cc, entry);
    }
    const expected = [...rolled.entries()]
      .map(([cc, v]) => ({ cc, logins: v.logins, ips: v.ips }))
      .sort((a, b) => (b.logins !== a.logins ? b.logins - a.logins : a.cc < b.cc ? -1 : 1));

    expect(view.countries).toEqual(expected);
    // The UI-SPEC's invariant: drawn countries plus the unknown row equal the
    // stated total, so the map and the tile can never disagree.
    expect(view.countries.reduce((sum, c) => sum + c.logins, 0) + view.unknown.logins).toBe(
      view.totalLogins,
    );
    expect(view.countries.reduce((sum, c) => sum + c.ips, 0) + view.unknown.addresses).toBe(
      view.addresses.length,
    );
  });

  it('stamps the aggregate with a fixture-qualified geo table id', async () => {
    // The `fixture-` prefix is what stops a browser run against the fixture
    // table and a real run against the shipped table from being mistaken for
    // one another: `answerLogins` treats a differing `geo` as stale and
    // rebuilds from the stored rows.
    expect(geoTableId().startsWith('fixture-')).toBe(true);

    const terminal = await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    expect(terminal.type).toBe('done');
    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    const stored = (meta as { logins?: { geo?: string } }).logins;
    expect(stored?.geo).toBe(geoTableId());
  });

  it('agrees with a rebuild from the stored rows, country for country', async () => {
    // The rebuild path (06-05) is what a stale `geo` or version triggers. If it
    // reached a different country than the import did, a user would see the
    // map change under them.
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const first = ready(await askLogins(post, 4));

    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    const stored = (meta as { logins?: unknown }).logins;
    await db.meta.update('active', { logins: null });

    const rebuilt = ready(await askLogins(post, 5));
    expect(rebuilt.addresses).toEqual(first.addresses);
    expect(rebuilt.countries).toEqual(first.countries);
    expect(rebuilt.unknown).toEqual(first.unknown);

    // Not a tautology: the record really was dropped and really was rewritten.
    const after = await db.meta.get('active');
    expect((after as { logins?: unknown }).logins).not.toBeNull();
    expect(ready(viewFromLogins(stored as never)).addresses).toEqual(rebuilt.addresses);
  });

  it('leaves the unit lookup and the worker agreeing, address for address', async () => {
    await ingestExport(post, buildLoginsHandExport(), 'logins.zip');
    const view = ready(await askLogins(post, 6));
    for (const address of view.addresses) {
      const parsed = parseIp(address.ip);
      if (parsed === null) throw new Error(`unreachable: ${address.ip} came from a parse`);
      expect(lookupCountry(parsed), address.ip).toBe(address.cc);
    }
  });

  it('still answers the same query with no extra field', () => {
    // Untouched by 06-06 and asserted anyway, because the country wiring added
    // an import to the worker's graph and a query contract is easy to disturb
    // while adding one.
    expect(isDataQuery({ channel: 'logins' })).toBe(true);
  });
});

// =============================================================================
// 06-15 tracer (G-1, CR-01) - the dotted tail counts as two groups
// =============================================================================
//
// The verifier's reproduction, through the real worker. Three spellings, in this
// order, one session row each:
//
//   1. 0:0:0:0:0:ffff:192.0.2.40  five zero groups, ffff, then a dotted tail:
//      eight words once the tail is two words. 192.0.2.40 is inside
//      192.0.2.32 to 192.0.2.63, which country-fixture.csv gives FR, and the
//      lookup unwraps the mapped address. Canonical 0:0:0:0:0:ffff:c000:228
//      (192 = c0, 0 = 00, 2 = 02, 40 = 28).
//   2. 1:2:3:4:5:6:198.51.100.7   six hex groups plus a tail: eight words.
//      Canonical 1:2:3:4:5:6:c633:6407 (198 = c6, 51 = 33, 100 = 64, 7 = 07).
//      No row of the fixture covers it, so its country is null.
//   3. 1:2:3:4:5:6:7:192.0.2.1    seven hex groups plus a tail: NINE words, not
//      an address. The old code stored it under a nine-group key ending
//      c000:201 and counted the first two spellings as unreadable.
//
// Both listed addresses have one login, so compareIp's byte order decides: the
// second byte is 0 for the first and 1 for the second, so the mapped one leads.
describe('06-15 tracer (G-1, CR-01): the dotted tail counts as two groups, through the real worker', () => {
  it('lists the eight-word spellings and counts the nine-word one as unreadable', async () => {
    const terminal = await ingestExport(
      post,
      buildLoginsExportOfAddresses([
        '0:0:0:0:0:ffff:192.0.2.40',
        '1:2:3:4:5:6:198.51.100.7',
        '1:2:3:4:5:6:7:192.0.2.1',
      ]),
      'logins-g1.zip',
    );
    expect(terminal.type).toBe('done');

    const view = ready(await askLogins(post, 20));
    expect(view.addresses.map((a) => a.ip)).toEqual([
      '0:0:0:0:0:ffff:c000:228',
      '1:2:3:4:5:6:c633:6407',
    ]);
    expect(view.addresses.map((a) => a.cc)).toEqual(['FR', null]);
    expect(view.totalLogins).toBe(2);
    expect(view.unreadableRows).toBe(1);
    expect(view.unknown.addresses).toBe(1);
    // The tail of the nine-group key the old code stored.
    expect(JSON.stringify(view)).not.toContain('c000:201');
  });
});
