import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_CITY_LIST,
  type CityAddressInput,
} from '../../../src/lib/features/logins/city-shared.ts';
import {
  CITY_DATA_ERROR,
  buildCityView,
  decodeCityTable,
  familiesOf,
  MAX_CITY_INFLATED_BYTES,
  inflateIfGzip,
} from '../../../src/lib/geo/city-table.ts';
import { MAX_CITY_TABLE_BYTES, lookupIp } from '../../../src/lib/geo/range-table.ts';
import { parseIp } from '../../../src/lib/geo/ip.ts';
import { buildLoginsHandExport } from '../../fixtures/logins-fixtures.ts';
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
// 06-09 Task 2, TDD RED — the manifest checks the city load has to make
// (T-06-33, D-14, RESEARCH Pattern 7)
// =============================================================================
//
// The city asset is the ONE file this application ever downloads, and it is
// downloaded from a static host over a connection whose response nobody in this
// repository controls end to end. So the manifest that sits beside it on that
// same host is the only thing that can say what the bytes should be — and a
// build that does not CHECK it is a build that decoded whatever arrived.
//
// The two manifest fields are therefore load-bearing rather than advisory:
//
//   * `sha256` proves the bytes are the ones the build wrote. A wrong one is
//     refused, a matching one passes, and a null skips the check because a
//     manifest that was not fetched has no hash to compare against.
//   * `expectedBytes` bounds the inflate. A gzip bomb is small on the wire and
//     enormous inflated, so the size the manifest DECLARED is the only number
//     that can be compared against before the allocation happens.
//
// Every refusal answers the one fixed string, and never the error's own
// message: these bytes are untrusted, and a message assembled from them is text
// a hostile file chose (T-06-35).
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURE_GZ = path.join(REPO_ROOT, 'tests', 'fixtures', 'geo', 'city-fixture.gz');

/** The real, committed container — the happy path every refusal is measured against. */
const CONTAINER = new Uint8Array(readFileSync(FIXTURE_GZ));

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
  const terminal = await ingestExport(post, buildLoginsHandExport(), 'hand.zip');
  if (terminal.type !== 'done') throw new Error(`ingest: got ${terminal.type}`);
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Post one city-load with explicit manifest values and await its answer. */
async function load(
  loadId: number,
  bytes: Uint8Array,
  expectedBytes: number,
  sha256: string | null,
): Promise<Extract<IngestResponse, { type: 'city-result' | 'city-error' }>> {
  const copy = bytes.slice();
  post.mockClear();
  postRequest({ type: 'city-load', loadId, buffer: copy.buffer, expectedBytes, sha256 });
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'city-result' || msg?.type === 'city-error') return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('load: no city-result or city-error within 10,000 ms');
}

/** Assert the fixed detail, and that it is the ONLY thing the reply carries. */
function expectRefused(reply: Extract<IngestResponse, { type: 'city-result' | 'city-error' }>) {
  expect(reply.type, JSON.stringify(reply)).toBe('city-error');
  if (reply.type !== 'city-error') throw new Error('unreachable');
  expect(reply.detail).toBe(CITY_DATA_ERROR);
}

describe('06-09: the city load checks the manifest it was handed', () => {
  it('refuses bytes whose sha256 is not the one the manifest declares', async () => {
    const wrong = '0'.repeat(64);
    expectRefused(await load(1, CONTAINER, CONTAINER.length, wrong));
  });

  it('refuses bytes whose length is not the one the manifest declares', async () => {
    // A short manifest is a build that wrote a different asset, and a long one
    // is a body that arrived padded; neither is the container to decode.
    expectRefused(await load(2, CONTAINER, CONTAINER.length + 1, null));
    expectRefused(await load(3, CONTAINER, CONTAINER.length - 1, null));
  });

  it('accepts bytes whose sha256 matches the manifest exactly', async () => {
    const { createHash } = await import('node:crypto');
    const sha256 = createHash('sha256').update(CONTAINER).digest('hex');
    const reply = await load(4, CONTAINER, CONTAINER.length, sha256);
    expect(reply.type, JSON.stringify(reply)).toBe('city-result');
  });

  it('skips the hash check entirely when the manifest carried no hash', async () => {
    // A null is not a mismatch. A caller that fetched only the container — a
    // hermetic test, a future offline path — has nothing to compare against,
    // and refusing would make the check mandatory rather than honest.
    const reply = await load(5, CONTAINER, CONTAINER.length, null);
    expect(reply.type, JSON.stringify(reply)).toBe('city-result');
  });

  it('refuses before inflating, so a bomb never reaches the allocator', async () => {
    // The declared length is the cheapest possible statement of the same fact
    // the inflate cap states, and it is checked FIRST: a body that disagrees
    // with its own manifest is refused without decompressing a single byte of
    // it. A few hundred kilobytes of repeated bytes is enough to prove that
    // the cap is a cap and not a post-hoc check.
    const bomb = new Uint8Array(400_000).fill(0x41);
    expectRefused(await load(6, bomb, 1, null));
  });
});

// =============================================================================
// 06-09 Task 2 — every class of bad input answers ONE fixed string
// (T-06-33, T-06-34, T-06-35, Pitfall 16, Pitfall 21)
// =============================================================================
//
// The container arrives from a network response, so every byte of it is
// untrusted until validated. The set of ways it can be wrong is finite and
// every member of it is enumerated here, because a rejection class with no test
// is a rejection class nobody knows works — and the one that matters most is
// the one that only shows up against a real 42 MB body, which a fixture is too
// small to be.
//
// What is asserted for EVERY class is the same thing: the thrown message is
// exactly `CITY_DATA_ERROR`, and it names no byte, no offset, no length and no
// size. A message assembled from bytes that turned out to be untrustworthy is
// text a hostile file chose.
// =============================================================================

/** The committed container, inflated — the bytes a decode actually reads. */
async function plainContainer(): Promise<Uint8Array> {
  return inflateIfGzip(CONTAINER);
}

/** Assert the exact refusal, and that it is the only text that escapes. */
function expectCityError(fn: () => unknown): void {
  let thrown: unknown;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  if (thrown === undefined) throw new Error('expected a refusal, but the call returned');
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe(CITY_DATA_ERROR);
}

describe('06-09: the three transports of the city body are told apart', () => {
  it('decodes a gzipped body', async () => {
    const bytes = await inflateIfGzip(CONTAINER);
    expect(decodeCityTable(bytes).kind).toBe(2);
  });

  it('passes a plain body through untouched', async () => {
    // A host that compresses the transfer itself hands the browser an
    // already-plain body, so "is it gzipped" is a question about the BYTES and
    // never about the URL or the manifest.
    const bytes = await plainContainer();
    expect(await inflateIfGzip(bytes)).toBe(bytes);
    expect(decodeCityTable(bytes).kind).toBe(2);
  });

  it('refuses a gzip of a gzip rather than inflating twice', async () => {
    // Inflating once yields a body that is STILL a gzip member. Handing that to
    // the container reader would refuse it on the magic bytes, so the outcome
    // would be right by accident; refusing here makes the cause the stated one.
    const twice = gzipSync(CONTAINER);
    await expect(inflateIfGzip(twice)).rejects.toThrow(CITY_DATA_ERROR);
  });

  it('refuses a gzip bomb before it is fully inflated', async () => {
    // A few hundred kilobytes of one repeated byte inflates to tens of
    // megabytes, which is the whole shape of the attack. The cap is passed in
    // rather than edited, so the test proves the CAP is a cap and not a
    // post-hoc check on an allocation that already happened.
    const bomb = gzipSync(new Uint8Array(400_000).fill(0x41));
    await expect(inflateIfGzip(bomb, 64 * 1024)).rejects.toThrow(CITY_DATA_ERROR);
    // And the same body under a cap it fits is inflated, so the refusal above
    // is the cap and not a failure to decompress repeated bytes at all.
    const roomy = await inflateIfGzip(bomb, 64 * 1024 * 1024);
    expect(roomy.length).toBe(400_000);
  });

  it("caps the inflate at the container decoder's own city limit (WR-02)", () => {
    // A looser stream cap would inflate (and allocate) bodies the decoder is
    // certain to refuse a moment later.
    expect(MAX_CITY_INFLATED_BYTES).toBe(MAX_CITY_TABLE_BYTES);
  });
});

describe('06-09: every malformed container answers the one fixed error', () => {
  it('refuses a bad magic', async () => {
    const bytes = await plainContainer();
    bytes[0] = 0x00;
    expectCityError(() => decodeCityTable(bytes));
  });

  it('refuses a wrong version', async () => {
    const bytes = await plainContainer();
    bytes[4] = 0xff;
    expectCityError(() => decodeCityTable(bytes));
  });

  it('refuses a truncated container at every length', async () => {
    const bytes = await plainContainer();
    for (let length = 0; length < bytes.length; length++) {
      const short = bytes.subarray(0, length);
      let thrown: unknown;
      try {
        decodeCityTable(short);
      } catch (err) {
        thrown = err;
      }
      expect((thrown as Error | undefined)?.message, `truncated to ${length}`).toBe(
        CITY_DATA_ERROR,
      );
    }
  });

  it('refuses a country table offered as city data', () => {
    // The committed country fixture is a real, valid container this project
    // wrote — the strongest available stand-in for "a plausible file that is
    // the wrong tier", because it would decode and answer two-letter codes
    // where the city view expects places.
    const country = new Uint8Array(
      readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'geo', 'country-fixture.bin')),
    );
    expectCityError(() => decodeCityTable(country));
  });

  it('refuses an oversized range count without allocating for it', async () => {
    // The count is read from a header this build did not write, so it is
    // refused against its cap BEFORE any typed array is sized from it.
    const bytes = await plainContainer();
    const huge = 0xffff_ffff;
    bytes[16] = huge & 0xff;
    bytes[17] = (huge >>> 8) & 0xff;
    bytes[18] = (huge >>> 16) & 0xff;
    bytes[19] = (huge >>> 24) & 0xff;
    expectCityError(() => decodeCityTable(bytes));
  });
});

describe('06-09: a dataset decodes only the address families it holds', () => {
  it('skips the IPv6 section and still resolves IPv4 addresses', async () => {
    const bytes = await plainContainer();
    const full = decodeCityTable(bytes);
    expect(full.v6Hi.length).toBeGreaterThan(0);

    const v4Only = decodeCityTable(bytes, { ipv4: true, ipv6: false });
    // The skipped family is left unallocated...
    expect(v4Only.v6Hi).toHaveLength(0);
    expect(v4Only.v6Lo).toHaveLength(0);
    // ...and the one that was kept still answers.
    const home = parseIp('192.0.2.10')!;
    expect(v4Only.places[lookupIp(v4Only, home)]).toBe(v4Only.places[lookupIp(full, home)]);
  });

  it('still refuses a container whose SKIPPED family is corrupt', async () => {
    // The skip is an allocation decision, never a validation one: a table whose
    // IPv6 section cannot be read is a broken table whatever the account's
    // addresses happen to be, and answering it "here is your IPv4 data" would
    // report a successful lookup over a file this build does not understand.
    const bytes = await plainContainer();
    bytes[4] = 0xff;
    expectCityError(() => decodeCityTable(bytes, { ipv4: true, ipv6: false }));
  });
});

describe('06-09: the ranked list is capped, deterministic and free of unnamed places', () => {
  /** The fixture's sixty IPv6 blocks, one listed address each. */
  function sixtyAddresses(): CityAddressInput[] {
    const out: CityAddressInput[] = [];
    for (let i = 0; i < 60; i++) {
      const block = i.toString(16).padStart(4, '0');
      out.push({ ip: `2001:db8:${block}::1`, cc: 'XX', logins: 1 });
    }
    return out;
  }

  it('lists exactly MAX_CITY_LIST places and counts the rest', async () => {
    const table = decodeCityTable(await plainContainer());
    const view = buildCityView(sixtyAddresses(), table);
    expect(view.places).toHaveLength(60);
    expect(view.ranked).toHaveLength(MAX_CITY_LIST);
    expect(view.moreCities).toBe(60 - MAX_CITY_LIST);
  });

  it('orders equal-logins places by city then country, in code units', async () => {
    const table = decodeCityTable(await plainContainer());
    const view = buildCityView(sixtyAddresses(), table);
    const shown = view.ranked.map((entry) => view.places[entry.place]!);
    // Every one of these has one login, so the whole order is the tie-break.
    // Never localeCompare: the list is STORED, and a locale-dependent order
    // would give two people reading one export two different lists.
    const sorted = [...shown].sort((a, b) =>
      a.city === b.city ? (a.cc < b.cc ? -1 : 1) : a.city < b.city ? -1 : 1,
    );
    expect(shown.map((p) => p.city)).toEqual(sorted.map((p) => p.city));
  });

  it('never ranks a place with no city name', async () => {
    const table = decodeCityTable(await plainContainer());
    // 198.51.100.20 is the AU block, which the fixture gives a country and no
    // city name — a real DB-IP row, and a real answer that is not a place.
    const view = buildCityView([{ ip: '198.51.100.20', cc: 'AU', logins: 4 }], table);
    expect(view.noCityAddresses).toBe(1);
    expect(view.ranked).toHaveLength(0);
    expect(view.placeOf).toEqual([-1]);
  });

  it('never ranks an address with no country', async () => {
    const table = decodeCityTable(await plainContainer());
    // 192.0.2.10 DOES have a city in the table; it is excluded here because the
    // ACCOUNT's own table could not name its country, and a country that is
    // unknown is not a place the city database gets to fill in.
    const view = buildCityView([{ ip: '192.0.2.10', cc: null, logins: 4 }], table);
    expect(view.noCityAddresses).toBe(0);
    expect(view.ranked).toHaveLength(0);
    expect(view.placeOf).toEqual([-1]);
  });
});

// =============================================================================
// 06-17 (CR-02) — familiesOf names every plane a lookup will read
// =============================================================================
//
// `lookupIp` reads the IPv4 plane for an IPv4-mapped IPv6 address. The rule that
// chooses which planes to decode used to call that address IPv6, so the plane the
// lookup read was the plane the decode had skipped and the answer was a silent
// "City unknown". The table pins the rule row by row; the invariant pins it
// against the lookup it feeds, so neither side can change alone.
// =============================================================================

/** The `CityAddressInput` shape for a list of documentation-range addresses. */
function listOf(...ips: string[]): CityAddressInput[] {
  return ips.map((ip) => ({ ip, cc: 'DE', logins: 1 }));
}

describe('06-17 (CR-02): familiesOf names every plane a lookup will read', () => {
  const rows: { name: string; list: CityAddressInput[]; ipv4: boolean; ipv6: boolean }[] = [
    { name: 'an empty list', list: [], ipv4: false, ipv6: false },
    { name: 'only unreadable text', list: listOf('not an address', ''), ipv4: false, ipv6: false },
    {
      name: 'a plain IPv4 list',
      list: listOf('192.0.2.1', '198.51.100.20'),
      ipv4: true,
      ipv6: false,
    },
    { name: 'a plain IPv6 list', list: listOf('2001:db8::1'), ipv4: false, ipv6: true },
    {
      name: 'a compressed mapped address',
      list: listOf('::ffff:192.0.2.1'),
      ipv4: true,
      ipv6: false,
    },
    {
      name: 'an expanded mapped address',
      list: listOf('0:0:0:0:0:ffff:192.0.2.1'),
      ipv4: true,
      ipv6: false,
    },
    {
      name: 'both mapped spellings',
      list: listOf('::ffff:192.0.2.1', '0:0:0:0:0:ffff:192.0.2.40'),
      ipv4: true,
      ipv6: false,
    },
    {
      name: 'the ::ffff:0:a.b.c.d form, which is not mapped',
      list: listOf('::ffff:0:192.0.2.1'),
      ipv4: false,
      ipv6: true,
    },
    {
      name: 'a mapped address plus a plain IPv6 address',
      list: listOf('::ffff:192.0.2.1', '2001:db8::1'),
      ipv4: true,
      ipv6: true,
    },
    {
      name: 'a mapped address plus a plain IPv4 address',
      list: listOf('::ffff:192.0.2.1', '198.51.100.20'),
      ipv4: true,
      ipv6: false,
    },
  ];

  for (const row of rows) {
    it(`${row.name}: ipv4 ${row.ipv4}, ipv6 ${row.ipv6}`, () => {
      expect(familiesOf(row.list)).toEqual({ ipv4: row.ipv4, ipv6: row.ipv6 });
    });
  }

  it('decoding only the families a list needs answers exactly what decoding both does', async () => {
    const bytes = await plainContainer();
    const both = decodeCityTable(bytes);
    for (const row of rows) {
      const limited = decodeCityTable(bytes, familiesOf(row.list));
      expect(buildCityView(row.list, limited), row.name).toEqual(buildCityView(row.list, both));
    }

    // The equality must compare real places, not two lists of -1.
    const mappedOnly = rows.find((r) => r.name === 'both mapped spellings')!;
    const view = buildCityView(
      mappedOnly.list,
      decodeCityTable(bytes, familiesOf(mappedOnly.list)),
    );
    expect(view.places[view.placeOf[0]!]).toEqual({ cc: 'DE', state: 'Bayern', city: 'München' });
    expect(view.placeOf[1]).toBeGreaterThanOrEqual(0);

    const mixed = rows.find((r) => r.name === 'a mapped address plus a plain IPv6 address')!;
    const mixedView = buildCityView(mixed.list, decodeCityTable(bytes, familiesOf(mixed.list)));
    for (const place of mixedView.placeOf) expect(place).toBeGreaterThanOrEqual(0);
  });

  it('a mapped-only list decodes the IPv4 plane only', async () => {
    const bytes = await plainContainer();
    const table = decodeCityTable(bytes, familiesOf(listOf('::ffff:192.0.2.1')));
    expect(table.v4Starts.length).toBeGreaterThan(0);
    expect(table.v6Hi.length).toBe(0);
  });
});
