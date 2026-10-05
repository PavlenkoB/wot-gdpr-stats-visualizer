import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CityView } from '../../../src/lib/features/logins/city-shared.ts';
import { CITY_DATA_ERROR } from '../../../src/lib/geo/city-table.ts';
import {
  buildLoginsExportOfAddresses,
  buildLoginsHandExport,
  LOGINS_IP_HOME,
  LOGINS_IP_THIRD,
  LOGINS_IP_WORK,
} from '../../fixtures/logins-fixtures.ts';
import {
  deleteActiveDatabase,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import type { IngestResponse } from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// 06-09 Task 1 (tracer) — a committed city container to a city view, through
// the REAL worker, for the REAL hand export
// =============================================================================
//
// This is the tracer rather than a unit test of one helper because the property
// that matters is a property of the CHAIN. Four things cannot be seen by looking
// at any single file:
//
//   1. that the committed gzipped fixture actually decodes — the build script
//      and the reader agreeing about a format is the one thing every later
//      plan (the deploy job, the Phase 7 verification) rests on;
//   2. that the worker reads the SAME listed addresses the `logins` channel
//      answers with, so `placeOf` aligns with the table's rows rather than
//      being off by one against a list nobody else can see;
//   3. that the answer's `importedAt` is the one the import reported, so a
//      replace during a decode cannot leave a city list describing a dataset
//      that is no longer on screen (D-28);
//   4. that a container which is not a container answers with ONE fixed string
//      and no bytes of its own (T-06-33, T-06-35).
//
// The expected places are written out by hand from `city-fixture.csv`, never by
// calling the builder: a wrong wiring and a changed builder both fail the same
// assertion, which is the only thing that makes the assertion worth having.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURE_GZ = path.join(REPO_ROOT, 'tests', 'fixtures', 'geo', 'city-fixture.gz');
const FIXTURE_MANIFEST = path.join(
  REPO_ROOT,
  'tests',
  'fixtures',
  'geo',
  'city-fixture-manifest.json',
);

interface Manifest {
  file: string;
  bytes: number;
  month: string;
  sha256: string;
  source: string;
}

const manifest = JSON.parse(readFileSync(FIXTURE_MANIFEST, 'utf8')) as Manifest;

/** The container bytes, exactly as the bytes a browser would have received. */
function fixtureBytes(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE_GZ));
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

/** Ingest the hand export and return the import's own timestamp. */
async function importHandExport(): Promise<string> {
  const bytes = buildLoginsHandExport();
  const terminal = await ingestExport(post, bytes, 'hand.zip');
  if (terminal.type !== 'done') {
    throw new Error(`importHandExport: expected done, got ${terminal.type}`);
  }
  if (typeof terminal.result.importedAt !== 'string') {
    throw new Error('importHandExport: the import reported no importedAt');
  }
  return terminal.result.importedAt;
}

/** Post one city-load with a transferable-shaped buffer and await its answer. */
async function loadCity(
  loadId: number,
  bytes: Uint8Array,
  sha256: string | null = manifest.sha256,
): Promise<Extract<IngestResponse, { type: 'city-result' | 'city-error' }>> {
  // A copy, because the real main thread hands the buffer over TRANSFERRED and
  // a test that reused its own array would then read a detached buffer.
  const copy = bytes.slice();
  post.mockClear();
  postRequest({
    type: 'city-load',
    loadId,
    buffer: copy.buffer,
    expectedBytes: copy.length,
    sha256,
  });
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'city-result' || msg?.type === 'city-error') return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('loadCity: no city-result or city-error within 10,000 ms');
}

/** The successful answer, or a failure naming the reply that arrived. */
function resultOf(
  reply: Extract<IngestResponse, { type: 'city-result' | 'city-error' }>,
): Extract<IngestResponse, { type: 'city-result' }> {
  if (reply.type !== 'city-result') {
    throw new Error(`resultOf: expected city-result, got ${JSON.stringify(reply)}`);
  }
  return reply;
}

/** The view of a successful answer, or a failure naming the reply. */
function viewOf(reply: Extract<IngestResponse, { type: 'city-result' | 'city-error' }>): CityView {
  if (reply.type !== 'city-result' || reply.view === null) {
    throw new Error(`viewOf: expected a city view, got ${JSON.stringify(reply)}`);
  }
  return reply.view;
}

describe('06-09: the committed city container through the real worker', () => {
  it('answers a city view for the hand export, aligned to the logins addresses', async () => {
    await importHandExport();
    const view = viewOf(await loadCity(1, fixtureBytes()));

    // The fixture month reaches the view, so the UI can say which DB-IP month
    // the cities came from rather than implying "current".
    expect(view.month).toBe(manifest.month);

    // Three listed addresses: HOME and WORK carry IP text, THIRD carries one
    // too, and the blank and zero-padded cells are unreadable rows that never
    // became addresses. `placeOf` has exactly one entry per listed address.
    expect(view.placeOf).toHaveLength(3);

    // 192.0.2.0/27 is `DE`, Bayern, München in the fixture CSV.
    const home = view.places[view.placeOf[0]!];
    expect(home).toEqual({ cc: 'DE', state: 'Bayern', city: 'München' });

    // 198.51.100.0/27 is `AU` with NO city name, so it is a country the
    // database placed and did not name: counted, never ranked, and -1 so the
    // city column can fall back to the country.
    const work = view.places[view.placeOf[1]!];
    expect(work).toBeUndefined();

    // 203.0.113.224/27 is deliberately absent from the city CSV, and the
    // country table calls it `ZZ` — so this address has neither a country nor
    // a city, and the view must say so with -1 rather than inventing one.
    expect(view.placeOf[2]).toBe(-1);
    expect(view.noCityAddresses).toBe(1);
  });

  it('ranks only the places a city name exists for', async () => {
    await importHandExport();
    const view = viewOf(await loadCity(2, fixtureBytes()));

    // Exactly one rankable place survives: HOME's München. The AU block has
    // no city name and the THIRD block is uncovered, so neither is a place.
    expect(view.ranked).toHaveLength(1);
    expect(view.places[view.ranked[0]!.place]!.city).toBe('München');
    expect(view.ranked[0]!.ips).toBe(1);
    expect(view.ranked[0]!.logins).toBeGreaterThan(0);
    expect(view.moreCities).toBe(0);
  });

  it("echoes the import's own importedAt, so a replace can drop the answer", async () => {
    const importedAt = await importHandExport();
    expect(resultOf(await loadCity(3, fixtureBytes())).importedAt).toBe(importedAt);
  });

  it('answers no view, and no error, when nothing is imported', async () => {
    const reply = resultOf(await loadCity(4, fixtureBytes()));
    expect(reply.importedAt).toBeNull();
    expect(reply.view).toBeNull();
  });

  it('answers a fixed detail, and nothing else, for bytes that are not a container', async () => {
    await importHandExport();
    const reply = await loadCity(5, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(reply.type).toBe('city-error');
    if (reply.type !== 'city-error') throw new Error('unreachable');
    expect(reply.detail).toBe(CITY_DATA_ERROR);
  });

  it('is aligned to the logins view, not merely the same length as it', async () => {
    await importHandExport();
    // The alignment is the whole reason `placeOf` is an index array and not a
    // list of places: the city column renders one cell per row of the login
    // table, and the only way that is safe is for the two lists to be the same
    // list. So the logins view is asked for too, and matched entry by entry.
    post.mockClear();
    postRequest({ type: 'data-query', queryId: 40, query: { channel: 'logins' } });
    const start = Date.now();
    let addresses: readonly { ip: string }[] = [];
    while (Date.now() - start < 10_000) {
      for (const call of post.mock.calls) {
        const msg = call[0] as IngestResponse | undefined;
        if (msg?.type === 'data-result' && msg.result?.channel === 'logins') {
          const view = msg.result.view;
          if (view.status === 'ready') addresses = view.addresses;
        }
      }
      if (addresses.length > 0) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    const view = viewOf(await loadCity(6, fixtureBytes()));
    expect(addresses.map((a) => a.ip)).toEqual([LOGINS_IP_HOME, LOGINS_IP_WORK, LOGINS_IP_THIRD]);
    expect(view.placeOf).toHaveLength(addresses.length);
    // München for HOME, -1 for the unnamed AU block, -1 for the uncovered one.
    expect(view.places[view.placeOf[0]!]!.city).toBe('München');
    expect(view.placeOf[1]).toBe(-1);
    expect(view.placeOf[2]).toBe(-1);
  });
});

// =============================================================================
// 06-17 (G-2, CR-02) — an account whose addresses are all IPv4-mapped
// =============================================================================
//
// The families rule used to call `::ffff:a.b.c.d` an IPv6 address, so such an
// account decoded the city table with `{ ipv4: false, ipv6: true }` while
// `lookupIp` read the IPv4 plane for it: `placeOf` was -1 and the user saw a
// country and a silent "City unknown". These tests go through the REAL worker
// for the same reason the 06-09 tracer does: the property is that of the chain.
// Expected countries and places are hand-written from `country-fixture.csv` and
// `city-fixture.csv`, never taken from the code under test.
// =============================================================================

/** Import an export of the CHOSEN addresses and return the import's timestamp. */
async function importAddresses(addresses: readonly string[]): Promise<void> {
  const terminal = await ingestExport(
    post,
    buildLoginsExportOfAddresses(addresses),
    'addresses.zip',
  );
  if (terminal.type !== 'done') {
    throw new Error(`importAddresses: expected done, got ${terminal.type}`);
  }
}

/** The listed addresses of the logins view, with their ip text and country. */
async function listedAddresses(): Promise<readonly { ip: string; cc: string | null }[]> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId: 60, query: { channel: 'logins' } });
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-result' && msg.result?.channel === 'logins') {
        const view = msg.result.view;
        if (view.status === 'ready') return view.addresses.map((a) => ({ ip: a.ip, cc: a.cc }));
      }
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('listedAddresses: no ready logins view within 10,000 ms');
}

describe('06-17 (G-2, CR-02): an account whose addresses are all IPv4-mapped still gets its cities', () => {
  it('resolves both spellings of a mapped address to their cities', async () => {
    await importAddresses(['::ffff:192.0.2.1', '0:0:0:0:0:ffff:192.0.2.40']);

    // One login each, so the numeric byte order decides the listing order. The
    // countries are the ones country-fixture.csv gives 192.0.2.0/27 and /27+32.
    const listed = await listedAddresses();
    expect(listed).toEqual([
      { ip: '0:0:0:0:0:ffff:c000:201', cc: 'DE' },
      { ip: '0:0:0:0:0:ffff:c000:228', cc: 'FR' },
    ]);

    const view = viewOf(await loadCity(60, fixtureBytes()));
    expect(view.placeOf).toHaveLength(2);
    expect(view.placeOf[0]).toBeGreaterThanOrEqual(0);
    expect(view.placeOf[1]).toBeGreaterThanOrEqual(0);
    expect(view.places[view.placeOf[0]!]).toEqual({
      cc: 'DE',
      state: 'Bayern',
      city: 'München',
    });
    expect(view.places[view.placeOf[1]!]).toEqual({
      cc: 'FR',
      state: 'Île-de-France',
      city: 'Paris',
    });
    expect(view.ranked).toHaveLength(2);
    expect(view.noCityAddresses).toBe(0);
    expect(view.moreCities).toBe(0);
  });

  it('decodes both planes when a mapped address sits next to a plain IPv6 one', async () => {
    await importAddresses(['::ffff:192.0.2.1', '2001:db8::1']);
    const listed = await listedAddresses();
    const mappedAt = listed.findIndex((a) => a.ip === '0:0:0:0:0:ffff:c000:201');
    const plainAt = listed.findIndex((a) => a.ip === '2001:db8:0:0:0:0:0:1');
    expect(mappedAt).toBeGreaterThanOrEqual(0);
    expect(plainAt).toBeGreaterThanOrEqual(0);

    const view = viewOf(await loadCity(61, fixtureBytes()));
    expect(view.placeOf).toHaveLength(2);
    expect(view.places[view.placeOf[mappedAt]!]).toEqual({
      cc: 'DE',
      state: 'Bayern',
      city: 'München',
    });
    expect(view.places[view.placeOf[plainAt]!]).toEqual({
      cc: 'DE',
      state: 'Bayern',
      city: 'Nürnberg',
    });
  });

  it('control: a plain IPv6-only account still gets its city', async () => {
    await importAddresses(['2001:db8::1']);
    const view = viewOf(await loadCity(62, fixtureBytes()));
    expect(view.placeOf).toHaveLength(1);
    expect(view.places[view.placeOf[0]!]).toEqual({
      cc: 'DE',
      state: 'Bayern',
      city: 'Nürnberg',
    });
  });
});
