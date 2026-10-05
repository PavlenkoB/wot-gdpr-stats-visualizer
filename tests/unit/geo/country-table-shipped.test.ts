import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseIp } from '../../../src/lib/geo/ip.ts';
import {
  KIND_COUNTRY,
  decodeRangeTable,
  lookupIp,
  type RangeTable,
} from '../../../src/lib/geo/range-table.ts';

// =============================================================================
// The COMMITTED production country table (06-04 Task 3, ACTIVITY-06, D-12,
// D-17, T-06-17)
//
// This file is the guard on the one binary in the repository that is derived
// from data nobody can see reviewed. `scripts/geo/build-country-table.ts` prints
// the source month and the source hash when it generates the table, so a
// regenerated table is checkable; this is what makes the COMMITTED one so.
//
// Every assertion here is STRUCTURAL, and deliberately so. Under D-17 no real
// address of any kind may be committed, which means the file cannot assert that
// a particular address resolves to a particular country — against the real
// table every documentation address is `ZZ` by design. What it CAN assert is
// the set of properties that make the table safe to ship at all:
//
//   - it exists, is under the size cap, and decodes
//   - it is a country table from a real month, not a fixture
//   - no address in either family is left unanswered
//   - private and documentation space resolves to the EXPLICIT unknown
//   - the ranges are contiguous, so the sum of their lengths is the whole
//     address space
//
// It reads the file off disk rather than importing it, so a table that is
// missing from the commit is a failure here rather than an import error that
// takes the whole file down (an empty string passes every "must not contain"
// assertion, which is the trap 04-09 recorded).
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHIPPED = path.join(REPO_ROOT, 'src/lib/geo/assets/country-table.bin');

/** The stated ceiling, kept here so the plan's number and the test cannot drift. */
const SIZE_CAP_BYTES = 3_500_000;

const IPV4_SPACE = 0x1_0000_0000; // 2^32

function shippedBytes(): Uint8Array {
  expect(existsSync(SHIPPED), `${SHIPPED} must exist and be committed`).toBe(true);
  return new Uint8Array(readFileSync(SHIPPED));
}

function shippedTable(): RangeTable {
  return decodeRangeTable(shippedBytes());
}

// Decoded ONCE. The file is 3.4 MB over 710,000 ranges, so decoding it per test
// cost about a second each and made this file the slowest in the suite; the
// decoded table is read-only here, so one copy is both faster and a stronger
// statement (every assertion here is about the same bytes).
let decoded: RangeTable | null = null;
let decodedAgain: RangeTable | null = null;

function shipped(): RangeTable {
  if (decoded === null) decoded = shippedTable();
  return decoded;
}

function tableDecodedASecondTime(): RangeTable {
  if (decodedAgain === null) decodedAgain = decodeRangeTable(shippedBytes());
  return decodedAgain;
}

function lookupText(table: RangeTable, address: string): string {
  const ip = parseIp(address);
  expect(ip, `${address} must parse`).not.toBeNull();
  const id = lookupIp(table, ip!);
  expect(id, `${address} must resolve to a place`).toBeGreaterThanOrEqual(0);
  return table.places[id]!;
}

describe('the shipped country table (06-04 Task 3)', () => {
  it('is committed and under the size cap', () => {
    expect(existsSync(SHIPPED)).toBe(true);
    expect(statSync(SHIPPED).size).toBeLessThan(SIZE_CAP_BYTES);
  });

  it('is a country table from a real month, with the fixture flag clear', () => {
    const table = shipped();
    expect(table.kind).toBe(KIND_COUNTRY);
    expect(table.fixture).toBe(false);
    // `0000-00` is the fixture marker the build script writes, so a real month
    // has a real month in it.
    expect(table.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('carries the explicit unknown place, and it is the one the kind names', () => {
    const table = shipped();
    expect(table.places[table.unknownId]).toBe('ZZ');
  });

  it('resolves private and documentation IPv4 to the explicit unknown', () => {
    const table = shipped();
    // RFC 5737 documentation space, plus the two RFC 1918 / loopback blocks a
    // reader is most likely to see in a real export. None of these is a real
    // address (D-17), and DB-IP carries all of them as explicit ZZ.
    for (const address of ['192.0.2.1', '198.51.100.1', '203.0.113.1', '10.0.0.1', '127.0.0.1']) {
      expect(lookupText(table, address), address).toBe('ZZ');
    }
  });

  it('resolves RFC 3849 documentation IPv6 to the explicit unknown', () => {
    const table = shipped();
    expect(lookupText(table, '2001:db8::1')).toBe('ZZ');
  });

  it('answers at every edge of the IPv4 space, with no gap', () => {
    const table = shipped();
    // These four are the addresses a "did you normalise the ends" bug shows up
    // on: 0.0.0.0 is the leading fill, 255.255.255.255 the trailing one.
    for (const address of ['0.0.0.0', '255.255.255.255', '1.0.0.0', '8.8.8.8']) {
      expect(lookupText(table, address).length, address).toBeGreaterThan(0);
    }
  });

  it('answers at every edge of the IPv6 space, with no gap', () => {
    const table = shipped();
    for (const address of [
      '::',
      'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
      '2606:4700:4700::1111',
    ]) {
      expect(lookupText(table, address).length, address).toBeGreaterThan(0);
    }
  });

  it('covers the whole IPv4 space: the range lengths sum to 2^32', () => {
    const table = shipped();
    const starts = table.v4Starts;
    expect(starts.length).toBeGreaterThan(1);
    // The container stores range STARTS only, because normalisation leaves no
    // gap for a range to end at: range i runs to one below start i+1, and the
    // last runs to the top of the space. So this sum is not an independent
    // measurement of coverage — it telescopes to 2^32 + v4Starts[0], and it
    // equals 2^32 exactly when the leading hole was filled. Both structural
    // facts are asserted separately below, so the arithmetic is a statement
    // about the table rather than a second way of saying "it decoded".
    let total = 0;
    for (let i = 0; i < starts.length; i++) {
      const end = i + 1 < starts.length ? starts[i + 1]! - 1 : IPV4_SPACE - 1;
      total += end - starts[i]! + 1;
    }
    expect(total).toBe(IPV4_SPACE);
    // The leading hole is the one end a reader can see: the first range has to
    // START at zero, or every address below it is unanswerable. The trailing
    // hole is NOT visible in the file and there is deliberately no assertion
    // trying to see it — the last START is 224.0.0.0 in the real table, because
    // the final range runs from there to the top of the space. Asserting that
    // the last start is 2^32-1 would be asserting that the container stores
    // ends, which is the design this format exists to avoid. The sum above is
    // what proves the trailing fill, and the edge test proves 255.255.255.255
    // answers.
    expect(starts[0]).toBe(0);
  });

  it('orders the IPv6 starts strictly, as (high, low) PAIRS', () => {
    const table = shipped();
    expect(table.v6Hi.length).toBeGreaterThan(0);
    // The high plane alone is only NON-DECREASING: two ranges can share a high
    // half and differ only in the low one, which is the straddling-/64 case the
    // low plane exists for. Asserting a strict increase on the high plane would
    // reject the exact encoding the format is built to support — so the claim
    // is made on the PAIR, and the high plane's non-decrease is what falls out
    // of it rather than a second thing to check.
    //
    // The loop records the first offending index and asserts ONCE. An `expect`
    // per iteration is correct and costs about seven seconds over 348,712
    // entries, which is why the assertion is not where the check is.
    let violation = -1;
    let previousHi = table.v6Hi[0]!;
    let previousLo = table.v6Lo[0]!;
    for (let i = 1; i < table.v6Hi.length && violation === -1; i++) {
      const hi = table.v6Hi[i]!;
      const lo = table.v6Lo[i]!;
      if (hi < previousHi || (hi === previousHi && lo <= previousLo)) violation = i;
      previousHi = hi;
      previousLo = lo;
    }
    expect(violation, `IPv6 pair at index ${violation} does not strictly grow`).toBe(-1);
  });

  it('reads back the same table from the same bytes', () => {
    // The reader and the committed file agreeing is what makes the artifact a
    // build product rather than an opaque blob. Compared by shape plus a
    // strided sample rather than by deep equality: `toEqual` over two
    // 362,122-entry typed arrays takes seconds and says nothing the sample and
    // the counts do not.
    const first = shipped();
    const second = tableDecodedASecondTime();
    expect(second.kind).toBe(first.kind);
    expect(second.month).toBe(first.month);
    expect(second.fixture).toBe(first.fixture);
    expect(second.places).toEqual(first.places);
    expect(second.v4Starts.length).toBe(first.v4Starts.length);
    expect(second.v6Hi.length).toBe(first.v6Hi.length);
    for (let i = 0; i < first.v4Starts.length; i += 997) {
      expect(second.v4Starts[i]).toBe(first.v4Starts[i]);
      expect(second.v4Ids[i]).toBe(first.v4Ids[i]);
    }
    for (let i = 0; i < first.v6Hi.length; i += 997) {
      expect(second.v6Hi[i]).toBe(first.v6Hi[i]);
      expect(second.v6Lo[i]).toBe(first.v6Lo[i]);
    }
  });
});
