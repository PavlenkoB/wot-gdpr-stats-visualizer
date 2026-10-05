import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { parseIp } from '../../../src/lib/geo/ip.ts';
import {
  KIND_CITY,
  KIND_COUNTRY,
  MAX_RANGE_TABLE_BYTES,
  MAX_RANGE_TABLE_RANGES,
  RANGE_TABLE_ERROR,
  RANGE_TABLE_HEADER_BYTES,
  decodeRangeTable,
  encodeRangeTable,
  lookupIp,
  lookupV4,
  lookupV6,
  unknownPlaceFor,
  type RangeInput,
  type RangeTable,
} from '../../../src/lib/geo/range-table.ts';
import { parseCountryLine, splitCsvLine } from '../../../scripts/geo/lib/csv-ranges.ts';
import { mulberry32 } from '../../fixtures/sessions-fixtures.ts';

// =============================================================================
// The container, its writer, its reader and its three lookups
// (06-04, ACTIVITY-06, D-12, D-17, T-06-16, RESEARCH Pattern 1)
//
// Every address in this file is an RFC 5737 / RFC 3849 documentation address.
// There is no real address of any kind, including in the corruption cases: a
// corrupted table is built by patching BYTES, so it names no address at all.
//
// The tests are grouped by the claim they defend:
//
//   1. Round trip       — every endpoint, and the address on either side of it
//   2. Boundary         — the four addresses at the edge of each family, and a
//                         /64 that straddles two ranges
//   3. Normalisation    — merging, gaps, leading and trailing holes
//   4. Mapping          — ::ffff:a.b.c.d resolves through the IPv4 section
//   5. Refusal          — one fixed message for every class of bad bytes, and
//                         truncation at every single byte
//   6. The committed    — the fixture CSV and the fixture .bin cannot drift
//   7. The shape        — the module imports nothing but the IP parser
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURE_CSV = path.join(REPO_ROOT, 'tests/fixtures', 'geo', 'country-fixture.csv');
const FIXTURE_BIN = path.join(REPO_ROOT, 'tests', 'fixtures', 'geo', 'country-fixture.bin');
const RANGE_TABLE_SOURCE = path.join(REPO_ROOT, 'src', 'lib', 'geo', 'range-table.ts');

const IPV4_MAX = 0xffff_ffff;
const IPV6_MAX = (1n << 128n) - 1n;
const LOW64 = 0xffff_ffff_ffff_ffffn;

/** One source row, with the addresses parsed by the PRODUCTION parser. */
function row(start: string, end: string, place: string): RangeInput {
  const from = parseIp(start);
  const to = parseIp(end);
  if (from === null) throw new Error(`fixture start does not parse: ${start}`);
  if (to === null) throw new Error(`fixture end does not parse: ${end}`);
  return { start: from, end: to, place };
}

function build(rows: readonly RangeInput[], month = '2026-10'): RangeTable {
  return decodeRangeTable(encodeRangeTable(rows, { kind: KIND_COUNTRY, month, fixture: false }));
}

function toBig(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function countryV4(table: RangeTable, addr: number): string {
  const id = lookupV4(table, addr);
  return id < 0 ? '<unresolved>' : table.places[id]!;
}

function countryV6(table: RangeTable, addr: bigint): string {
  const id = lookupV6(table, addr >> 64n, addr & LOW64);
  return id < 0 ? '<unresolved>' : table.places[id]!;
}

function countryAt(table: RangeTable, address: string): string {
  const ip = parseIp(address);
  if (ip === null) throw new Error(`fixture address does not parse: ${address}`);
  return table.places[lookupIp(table, ip)] ?? '<unresolved>';
}

/** Assert that a byte string is refused, and with WHICH text. */
function expectRefused(bytes: Uint8Array, label: string): void {
  let thrown: unknown;
  try {
    decodeRangeTable(bytes);
  } catch (error) {
    thrown = error;
  }
  if (thrown === undefined) throw new Error(`${label}: decodeRangeTable accepted the bytes`);
  expect(thrown, label).toBeInstanceOf(Error);
  expect((thrown as Error).message, label).toBe(RANGE_TABLE_ERROR);
}

/** A byte-level varint scan, so the corruption cases do not trust the writer. */
function scanVarint(bytes: Uint8Array, at: number): { value: number; next: number } {
  let value = 0;
  let shift = 1;
  let index = at;
  for (;;) {
    const byte = bytes[index]!;
    index += 1;
    value += (byte & 0x7f) * shift;
    if ((byte & 0x80) === 0) return { value, next: index };
    shift *= 128;
  }
}

function u32le(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
  );
}

function patchU32le(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = value & 0xff;
  bytes[at + 1] = (value >>> 8) & 0xff;
  bytes[at + 2] = (value >>> 16) & 0xff;
  bytes[at + 3] = (value >>> 24) & 0xff;
}

// =============================================================================
// A tiny table the corruption cases patch. It is deliberately small enough that
// a test can find a plane by counting varints, and it has one range per shape
// it needs: an unknown hole at each end of each family, and one real range in
// the middle.
// =============================================================================

const TINY_ROWS: readonly RangeInput[] = [
  row('192.0.2.0', '192.0.2.255', 'DE'),
  row('2001:db8::', '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff', 'DE'),
];

/** Where the IPv4 section begins, and where each of its two planes begins. */
function tinyLayout(bytes: Uint8Array): { v4: number; v4Ids: number; v4Count: number } {
  const v4 = RANGE_TABLE_HEADER_BYTES + u32le(bytes, 24);
  const v4Count = u32le(bytes, 16);
  let at = v4;
  for (let i = 0; i < v4Count; i++) at = scanVarint(bytes, at).next;
  return { v4, v4Ids: at, v4Count };
}

// =============================================================================

describe('06-04: the range-table container round-trips every endpoint', () => {
  const table = build([
    row('192.0.2.0', '192.0.2.31', 'DE'),
    row('192.0.2.64', '192.0.2.95', 'FR'),
    row('198.51.100.0', '198.51.100.255', 'SG'),
    row('2001:db8:0000::', '2001:db8:0000:ffff:ffff:ffff:ffff:ffff', 'JP'),
    row('2001:db8:0002::', '2001:db8:0002:7fff:ffff:ffff:ffff:ffff', 'GI'),
  ]);

  it('reads back the header the writer was given', () => {
    expect(table.kind).toBe(KIND_COUNTRY);
    expect(table.month).toBe('2026-10');
    expect(table.fixture).toBe(false);
    expect(table.places).toContain('DE');
    expect(table.places[table.unknownId]).toBe('ZZ');
  });

  it('resolves the first and the last address of every source range', () => {
    for (const source of [
      ['192.0.2.0', '192.0.2.31', 'DE'],
      ['192.0.2.64', '192.0.2.95', 'FR'],
      ['198.51.100.0', '198.51.100.255', 'SG'],
      ['2001:db8:0000::', '2001:db8:0000:ffff:ffff:ffff:ffff:ffff', 'JP'],
      ['2001:db8:0002::', '2001:db8:0002:7fff:ffff:ffff:ffff:ffff', 'GI'],
    ] as const) {
      const [start, end, place] = source;
      expect(countryAt(table, start), start).toBe(place);
      expect(countryAt(table, end), end).toBe(place);
    }
  });

  it('resolves the address on either side of every range to the explicit unknown', () => {
    // Every one of these is a hole the writer had to invent: a leading hole, a
    // gap between two source ranges, and a trailing hole. If the writer left
    // any of them out, a predecessor search would hand the address the wrong
    // neighbour's country — which is the failure this table asserts against.
    const probes: readonly [string, string][] = [
      ['191.255.255.255', 'ZZ'],
      ['192.0.2.32', 'ZZ'],
      ['192.0.2.63', 'ZZ'],
      ['192.0.2.96', 'ZZ'],
      ['198.51.100.255', 'SG'],
      ['198.51.101.0', 'ZZ'],
      ['2001:db7:ffff:ffff:ffff:ffff:ffff:ffff', 'ZZ'],
      ['2001:db8:0001::', 'ZZ'],
      ['2001:db8:0002:8000::', 'ZZ'],
    ];
    for (const [address, place] of probes) {
      expect(countryAt(table, address), address).toBe(place);
    }
  });

  it('resolves the address on either side of a /48 boundary through the low half', () => {
    const last = toBig(parseIp('2001:db8:0000:ffff:ffff:ffff:ffff:ffff')!.bytes);
    const first = toBig(parseIp('2001:db8:0002::')!.bytes);
    expect(countryV6(table, last)).toBe('JP');
    expect(countryV6(table, last + 1n)).not.toBe('JP');
    expect(countryV6(table, first - 1n)).not.toBe('GI');
    expect(countryV6(table, first)).toBe('GI');
  });
});

describe('06-04: the four addresses at the edge of each family resolve', () => {
  const table = build(TINY_ROWS);

  it('resolves 0.0.0.0 and 255.255.255.255', () => {
    expect(lookupV4(table, 0)).toBeGreaterThanOrEqual(0);
    expect(lookupV4(table, IPV4_MAX)).toBeGreaterThanOrEqual(0);
    // Both are inside the leading and trailing UNKNOWN ranges the writer
    // filled, so they resolve — to the explicit unknown, not to nothing.
    expect(countryV4(table, 0)).toBe('ZZ');
    expect(countryV4(table, IPV4_MAX)).toBe('ZZ');
  });

  it('resolves :: and the all-ones IPv6 address', () => {
    expect(lookupV6(table, 0n, 0n)).toBeGreaterThanOrEqual(0);
    expect(lookupV6(table, IPV6_MAX >> 64n, IPV6_MAX & LOW64)).toBeGreaterThanOrEqual(0);
    expect(countryV6(table, 0n)).toBe('ZZ');
    expect(countryV6(table, IPV6_MAX)).toBe('ZZ');
  });

  it('is deterministic — encoding the same rows twice gives the same bytes', () => {
    const first = encodeRangeTable(TINY_ROWS, {
      kind: KIND_COUNTRY,
      month: '2026-10',
      fixture: false,
    });
    const second = encodeRangeTable([...TINY_ROWS].reverse(), {
      kind: KIND_COUNTRY,
      month: '2026-10',
      fixture: false,
    });
    expect(Array.from(second)).toEqual(Array.from(first));
  });
});

describe('06-04: a /64 that straddles two ranges resolves by its low half', () => {
  // Two ranges that split ONE /64 down the middle: the upper half is one place
  // and the lower half another. A table keyed on anything coarser than the full
  // 128 bits cannot tell the two halves apart, which is the whole reason the
  // low-64 plane is stored at all (RESEARCH Evidence: 298 country ranges
  // collide on the high 64 bits alone).
  const table = build([
    row('2001:db8:0:bbbb:8000:0000:0000:0000', '2001:db8:0:bbbb:ffff:ffff:ffff:ffff', 'SG'),
    row('2001:db8:0:bbbb:0:0:0:0', '2001:db8:0:bbbb:7fff:ffff:ffff:ffff', 'GI'),
  ]);

  it('gives the upper half of the straddling /64 the upper range and the lower half the lower one', () => {
    expect(countryAt(table, '2001:db8:0:bbbb:0:0:0:0')).toBe('GI');
    expect(countryAt(table, '2001:db8:0:bbbb:7fff:ffff:ffff:ffff')).toBe('GI');
    expect(countryAt(table, '2001:db8:0:bbbb:8000:0000:0000:0000')).toBe('SG');
    expect(countryAt(table, '2001:db8:0:bbbb:ffff:ffff:ffff:ffff')).toBe('SG');
  });

  it('separates two ranges that share every bit but their last 65', () => {
    // The two starts differ only in the low 64 bits, so a high-64-only key
    // would merge them into one range and answer SG for a GI address.
    const hiOnly = build([
      row('2001:db8:0:bbbb:0:0:0:0', '2001:db8:0:bbbb:ffff:ffff:ffff:ffff', 'ZZ'),
    ]);
    expect(countryAt(hiOnly, '2001:db8:0:bbbb:8000::')).toBe('ZZ');
    expect(countryAt(table, '2001:db8:0:bbbb:8000::')).toBe('SG');
  });
});

describe('06-04: normalising the source never changes what a lookup answers', () => {
  // The unmerged source and the merged source describe the SAME addresses with
  // the same places. Everything else differs: the number of ranges, the
  // varint planes, the byte length. The lookups must be identical.
  const unmerged: readonly RangeInput[] = [
    row('192.0.2.0', '192.0.2.63', 'DE'),
    row('192.0.2.64', '192.0.2.127', 'DE'),
    row('192.0.2.128', '192.0.2.191', 'DE'),
    row('198.51.100.0', '198.51.100.127', 'FR'),
    row('198.51.100.128', '198.51.100.255', 'FR'),
    row('2001:db8:0001::', '2001:db8:0001:ffff:ffff:ffff:ffff:7fff', 'JP'),
    row('2001:db8:0001:8000::', '2001:db8:0001:ffff:ffff:ffff:ffff:ffff', 'JP'),
  ];
  const merged: readonly RangeInput[] = [
    row('192.0.2.0', '192.0.2.191', 'DE'),
    row('198.51.100.0', '198.51.100.255', 'FR'),
    row('2001:db8:0001::', '2001:db8:0001:ffff:ffff:ffff:ffff:ffff', 'JP'),
  ];

  it('collapses the split source to the same table as the joined one, byte for byte', () => {
    // The unmerged source is five rows; the merged one is two. They describe
    // the same addresses with the same places, so the writer's merge makes the
    // split INVISIBLE — which is a stronger claim than "the lookups agree",
    // because it also says the varint planes and the byte length are the same.
    const options = { kind: KIND_COUNTRY, month: '2026-10', fixture: false };
    expect(Array.from(encodeRangeTable(unmerged, options))).toEqual(
      Array.from(encodeRangeTable(merged, options)),
    );
  });

  it('keeps two ranges of the same place that are NOT adjacent', () => {
    // The control for the test above: without adjacency there is nothing to
    // merge, and the unknown hole between them becomes a range of its own.
    const apart = build([
      row('192.0.2.0', '192.0.2.63', 'DE'),
      row('192.0.2.96', '192.0.2.127', 'DE'),
    ]);
    const joined = build([row('192.0.2.0', '192.0.2.191', 'DE')]);
    expect(apart.v4Starts.length).toBeGreaterThan(joined.v4Starts.length);
    expect(countryAt(apart, '192.0.2.70')).toBe('ZZ');
    expect(countryAt(apart, '192.0.2.100')).toBe('DE');
  });

  it('answers identically at 3000 seeded addresses per family', () => {
    const a = build(unmerged);
    const b = build(merged);
    const random = mulberry32(0x0c14a6);
    for (let i = 0; i < 3000; i++) {
      const v4 = Math.floor(random() * 0x1_0000_0000) >>> 0;
      expect(countryV4(a, v4), `${v4}`).toBe(countryV4(b, v4));
    }
    for (let i = 0; i < 3000; i++) {
      let v6 = 0n;
      for (let group = 0; group < 4; group++) {
        v6 = (v6 << 64n) | BigInt(Math.floor(random() * 0x1_0000_0000) >>> 0);
      }
      expect(countryV6(a, v6), `${v6}`).toBe(countryV6(b, v6));
    }
  });

  it('treats a source WITHOUT unknown rows the same as one with them', () => {
    // A mirror CSV with no reserved-space rows normalises to the same table as
    // the official one, because the writer fills the holes itself (RESEARCH
    // measured the npm mirror at 0 ZZ rows).
    const withoutUnknown = build([row('192.0.2.0', '192.0.2.255', 'DE')]);
    const withUnknown = build([
      row('0.0.0.0', '191.255.255.255', 'ZZ'),
      row('192.0.2.0', '192.0.2.255', 'DE'),
      row('192.0.3.0', '255.255.255.255', 'ZZ'),
    ]);
    expect(Array.from(withoutUnknown.v4Starts)).toEqual(Array.from(withUnknown.v4Starts));
    expect(Array.from(withoutUnknown.v4Ids)).toEqual(Array.from(withUnknown.v4Ids));
  });

  it('refuses a range whose end precedes its start rather than inventing one', () => {
    expect(() =>
      encodeRangeTable([row('192.0.2.255', '192.0.2.0', 'DE')], {
        kind: KIND_COUNTRY,
        month: '2026-10',
        fixture: false,
      }),
    ).toThrow(RANGE_TABLE_ERROR);
  });
});

describe('06-04: an IPv4-mapped IPv6 address resolves through the IPv4 section', () => {
  const table = build([row('192.0.2.0', '192.0.2.255', 'DE')]);

  it('answers the mapped form with the same id as the plain form', () => {
    const plain = parseIp('192.0.2.1')!;
    const mapped = parseIp('::ffff:192.0.2.1')!;
    expect(mapped.family).toBe(6);
    expect(lookupIp(table, plain)).toBe(lookupIp(table, mapped));
    expect(countryAt(table, '::ffff:192.0.2.1')).toBe('DE');
  });

  it('does not treat every IPv6 address as IPv4', () => {
    expect(countryAt(table, '2001:db8::1')).toBe('ZZ');
  });
});

describe('06-04: a city table uses the empty place for unknown', () => {
  it('numbers the empty place and resolves an uncovered address to it', () => {
    const bytes = encodeRangeTable(
      [
        {
          start: parseIp('192.0.2.0')!,
          end: parseIp('192.0.2.255')!,
          place: 'DE\tBavaria\tMunich',
        },
      ],
      { kind: KIND_CITY, month: '2026-10', fixture: false },
    );
    const table = decodeRangeTable(bytes);
    expect(table.kind).toBe(KIND_CITY);
    expect(unknownPlaceFor(KIND_CITY)).toBe('');
    expect(table.places[table.unknownId]).toBe('');
    expect(countryAt(table, '192.0.2.7')).toBe('DE\tBavaria\tMunich');
    expect(countryAt(table, '198.51.100.7')).toBe('');
  });
});

describe('06-04: the reader refuses bad bytes with ONE fixed message (T-06-16)', () => {
  const good = encodeRangeTable(TINY_ROWS, {
    kind: KIND_COUNTRY,
    month: '2026-10',
    fixture: false,
  });
  const clone = (): Uint8Array => new Uint8Array(good);

  it('refuses bytes that are not a table at all', () => {
    expectRefused(new Uint8Array(0), 'empty');
    expectRefused(new Uint8Array(8), 'shorter than the header');
  });

  it('refuses a size over the cap', () => {
    expectRefused(new Uint8Array(MAX_RANGE_TABLE_BYTES + 1), 'over the cap');
  });

  it('refuses a bad magic', () => {
    const bytes = clone();
    bytes[1] = 0x00;
    expectRefused(bytes, 'bad magic');
  });

  it('refuses a version this module does not read', () => {
    const bytes = clone();
    bytes[4] = 2;
    expectRefused(bytes, 'wrong version');
  });

  it('refuses a kind that is neither country nor city', () => {
    const bytes = clone();
    bytes[5] = 7;
    expectRefused(bytes, 'wrong kind');
  });

  it('refuses a flag bit that is not the fixture bit', () => {
    const bytes = clone();
    bytes[6] = 0b0000_0010;
    expectRefused(bytes, 'reserved flag bit');
  });

  it('refuses a non-zero reserved byte', () => {
    const bytes = clone();
    bytes[7] = 1;
    expectRefused(bytes, 'reserved byte');
  });

  it('refuses a month outside 0-12', () => {
    const bytes = clone();
    bytes[10] = 13;
    expectRefused(bytes, 'impossible month');
  });

  it('refuses a count over the cap', () => {
    const bytes = clone();
    patchU32le(bytes, 16, MAX_RANGE_TABLE_RANGES + 1);
    expectRefused(bytes, 'v4 count over the cap');
  });

  it('refuses a place count the place table does not hold', () => {
    const bytes = clone();
    patchU32le(bytes, 12, u32le(bytes, 12) + 1);
    expectRefused(bytes, 'place count disagrees with the place table');
  });

  it('refuses a count that disagrees with its SECTION', () => {
    // Claiming no IPv6 ranges at all leaves the whole IPv6 section unconsumed,
    // and "the cursor must land on the last byte" is where that shows.
    const bytes = clone();
    patchU32le(bytes, 20, 0);
    expectRefused(bytes, 'v6 count disagrees with the section length');
  });

  it('refuses a start that does not increase', () => {
    const { v4, v4Count } = tinyLayout(good);
    expect(v4Count).toBe(3);
    // The second delta in the IPv4 start plane, located by scanning rather
    // than by counting, so the test does not inherit the writer's idea of how
    // many bytes that delta takes. Zeroing it makes the second start EQUAL the
    // first, which is the corruption, and it changes no length.
    const first = scanVarint(good, v4);
    const second = scanVarint(good, first.next);
    const bytes = clone();
    for (let i = first.next; i < second.next; i++) bytes[i] = 0;
    expectRefused(bytes, 'two ranges with the same start');
  });

  it('refuses a place id past the place count', () => {
    const { v4Ids, v4Count } = tinyLayout(good);
    expect(v4Count).toBe(3);
    const bytes = clone();
    // The first IPv4 id is a single-byte varint; raising it past the two
    // places is the corruption, and it leaves every byte LENGTH intact, so
    // only the id-bound check can catch it.
    bytes[v4Ids] = 9;
    expectRefused(bytes, 'id past the place count');
  });

  it('refuses an oversized range count BEFORE allocating the planes (WR-01)', () => {
    // A header of a few dozen bytes claiming the maximum for both families.
    // The refusal is the same either way; what matters is that no multi-megabyte
    // plane was allocated first, so every typed-array construction is counted.
    const bytes = clone();
    patchU32le(bytes, 16, MAX_RANGE_TABLE_RANGES);
    patchU32le(bytes, 20, MAX_RANGE_TABLE_RANGES);
    const large: number[] = [];
    type TypedArrayCtor = new (...args: unknown[]) => object;
    const watch = <T extends TypedArrayCtor>(ctor: T): T =>
      new Proxy(ctor, {
        construct(target, args, newTarget) {
          if (typeof args[0] === 'number' && args[0] > 1_000_000) large.push(args[0]);
          return Reflect.construct(target, args, newTarget);
        },
      });
    vi.stubGlobal('Uint32Array', watch(Uint32Array as unknown as TypedArrayCtor));
    vi.stubGlobal('BigUint64Array', watch(BigUint64Array as unknown as TypedArrayCtor));
    vi.stubGlobal('Uint8Array', watch(Uint8Array as unknown as TypedArrayCtor));
    try {
      expectRefused(bytes, 'counts the buffer cannot hold');
    } finally {
      vi.unstubAllGlobals();
    }
    expect(large).toEqual([]);
  });

  it('refuses a place section of bare newlines BEFORE splitting it (WR-01)', () => {
    const section = 4096;
    const bytes = new Uint8Array(RANGE_TABLE_HEADER_BYTES + section);
    bytes.set(good.subarray(0, RANGE_TABLE_HEADER_BYTES));
    patchU32le(bytes, 12, 2); // place count
    patchU32le(bytes, 16, 0);
    patchU32le(bytes, 20, 0);
    patchU32le(bytes, 24, section); // place bytes
    bytes.fill(0x0a, RANGE_TABLE_HEADER_BYTES);
    const split = vi.spyOn(String.prototype, 'split');
    try {
      expectRefused(bytes, 'newlines that disagree with the place count');
      expect(split).not.toHaveBeenCalled();
    } finally {
      split.mockRestore();
    }
  });

  it('refuses truncation at EVERY byte of a small table', () => {
    for (let length = 0; length < good.length; length++) {
      expectRefused(good.subarray(0, length), `truncated to ${length}`);
    }
  });

  it('refuses one appended byte', () => {
    const bytes = clone();
    const padded = new Uint8Array(bytes.length + 1);
    padded.set(bytes);
    expectRefused(padded, 'one byte too long');
  });
});

describe('06-04: the committed fixture table matches the committed fixture CSV', () => {
  const csv = readFileSync(FIXTURE_CSV, 'utf8');
  const rows = csv
    .split('\n')
    .map((line) => parseCountryLine(line))
    .filter((value): value is RangeInput => value !== null);
  const table = decodeRangeTable(readFileSync(FIXTURE_BIN));

  it('parses a row for every data line and skips the header and the comments', () => {
    expect(rows.length).toBe(65);
  });

  it('is byte-identical to a fresh encode of that CSV, so the pair cannot drift', () => {
    const fresh = encodeRangeTable(rows, { kind: KIND_COUNTRY, month: '0000-00', fixture: true });
    const committed = readFileSync(FIXTURE_BIN);
    expect(committed.length).toBe(fresh.length);
    expect(Array.from(committed)).toEqual(Array.from(fresh));
  });

  it('carries the fixture flag and the fixture month', () => {
    expect(table.fixture).toBe(true);
    expect(table.month).toBe('0000-00');
  });

  it('resolves a documentation address to the country the CSV gave it', () => {
    expect(countryAt(table, '192.0.2.1')).toBe('DE');
    expect(countryAt(table, '198.51.100.20')).toBe('AU');
    // The one deliberately tiny country, and the one code the world map will
    // have no polygon for.
    expect(countryAt(table, '192.0.2.100')).toBe('SG');
    expect(countryAt(table, '198.51.100.100')).toBe('GI');
  });

  it('resolves the explicitly-unknown documentation block to the unknown id', () => {
    // 203.0.113.230 is the hand fixture's third address from plan 06-01, and
    // it sits inside the one block the CSV maps to ZZ on purpose.
    expect(lookupIp(table, parseIp('203.0.113.230')!)).toBe(table.unknownId);
  });

  it('merged the two adjacent /28s of one country on the way in', () => {
    // The CSV writes 198.51.100.32-47 and 48-63 as two rows of CA; the
    // encoded table must hold ONE range spanning both.
    const both = countryAt(table, '198.51.100.40');
    expect(both).toBe(countryAt(table, '198.51.100.55'));
    expect(both).toBe('CA');
  });

  it('resolves a mapped documentation address like the plain one', () => {
    expect(lookupIp(table, parseIp('::ffff:192.0.2.1')!)).toBe(
      lookupIp(table, parseIp('192.0.2.1')!),
    );
  });
});

describe('06-04: the CSV helpers', () => {
  it('splits a quoted field that holds the delimiter', () => {
    expect(splitCsvLine('1.0.0.0,1.0.0.255,AU')).toEqual(['1.0.0.0', '1.0.0.255', 'AU']);
    expect(splitCsvLine('1.0.0.0,1.0.0.255,"DE\tBavaria\tMunich, Germany"')).toEqual([
      '1.0.0.0',
      '1.0.0.255',
      'DE\tBavaria\tMunich, Germany',
    ]);
    expect(splitCsvLine('1.0.0.0,1.0.0.255,"a""b"')).toEqual(['1.0.0.0', '1.0.0.255', 'a"b']);
  });

  it('answers null for a header, a blank line, a comment and a short line', () => {
    expect(parseCountryLine('start,end,CC')).toBeNull();
    expect(parseCountryLine('')).toBeNull();
    expect(parseCountryLine('   ')).toBeNull();
    expect(parseCountryLine('# a comment, with, commas')).toBeNull();
    expect(parseCountryLine('1.0.0.0,1.0.0.255')).toBeNull();
  });

  it('answers null for a malformed address and for a mixed-family range', () => {
    expect(parseCountryLine('1.0.0,1.0.0.255,AU')).toBeNull();
    expect(parseCountryLine('not-an-ip,1.0.0.255,AU')).toBeNull();
    expect(parseCountryLine('1.0.0.0,2001:db8::,AU')).toBeNull();
    expect(parseCountryLine('1.0.0.0,1.0.0.255,')).toBeNull();
  });
});

describe('06-04: the container is a pure module with one import', () => {
  it('imports nothing except ./ip.ts', () => {
    const source = readFileSync(RANGE_TABLE_SOURCE, 'utf8');
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]!);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers).toEqual(['./ip.ts']);
  });

  it('names no network, DOM or Node API', () => {
    const source = readFileSync(RANGE_TABLE_SOURCE, 'utf8');
    for (const banned of [
      'fetch(',
      'XMLHttpRequest',
      'document.',
      'window.',
      'process.',
      'Date.',
    ]) {
      expect(source.includes(banned), banned).toBe(false);
    }
  });
});
