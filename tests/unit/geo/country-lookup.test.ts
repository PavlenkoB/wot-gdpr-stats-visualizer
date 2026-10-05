import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lookupCountryIn } from '../../../src/lib/geo/country-lookup.ts';
import { parseIp } from '../../../src/lib/geo/ip.ts';
import {
  decodeRangeTable,
  encodeRangeTable,
  KIND_COUNTRY,
} from '../../../src/lib/geo/range-table.ts';

// =============================================================================
// The table-argument lookup (06-06 Task 3, D-08, T-06-16)
// =============================================================================
//
// `lookupCountryIn(table, ip)` is the form that takes the table as an argument,
// and this file is what makes it worth having: the two jobs it does cannot be
// done through `lookupCountry`.
//
//   1. A synthetic table can carry a MALFORMED place, because the same reader
//      decodes the CITY table, whose places are `CC<TAB>State<TAB>City`
//      strings. A country table built from a real source has no such place, so
//      this is the only way to prove the shape check is doing something.
//   2. The committed fixture is decoded HERE, off disk, so the assertions are
//      about the data rather than about whatever the build inlined.
//
// The module under test is still a WORK-ONLY module; this test lives under
// tests/, which is outside the `no-restricted-imports` scope by design (see
// `tests/unit/guards/lint-guards.test.ts`).
// =============================================================================

/** The committed fixture table, decoded once from the bytes on disk. */
const FIXTURE = decodeRangeTable(
  new Uint8Array(readFileSync(new URL('../../fixtures/geo/country-fixture.bin', import.meta.url))),
);

function lookupOf(raw: string, table = FIXTURE): string | null {
  const parsed = parseIp(raw);
  if (parsed === null) throw new Error(`not an address: ${raw}`);
  return lookupCountryIn(table, parsed);
}

describe('lookupCountryIn over the committed fixture table', () => {
  it('answers both ends of a range, and the address between them', () => {
    // The first and last addresses of `192.0.2.0-192.0.2.31` (DE) plus one
    // just outside each end. The boundaries are where a predecessor search
    // goes wrong: an off-by-one at the end of a range would report the
    // neighbouring country here rather than in a rare combination.
    expect(lookupOf('192.0.2.0')).toBe('DE');
    expect(lookupOf('192.0.2.15')).toBe('DE');
    expect(lookupOf('192.0.2.31')).toBe('DE');
    expect(lookupOf('192.0.2.32')).toBe('FR');
  });

  it('resolves an IPv4-mapped IPv6 address through the IPv4 section', () => {
    // D-12 / RESEARCH Pitfall 12: `::ffff:192.0.2.10` is the same address as
    // `192.0.2.10`. It must not fall through to the IPv6 plane and pick up
    // whatever IPv6 range happens to contain the mapped form — which for these
    // two would be a COUNTRY, because the leading hole of the IPv6 plane is
    // unknown but the space around `::ffff:0:0/96` is not where a country
    // lives. The strongest form of the assertion is the `ZZ` address: the
    // mapped form must be unknown, and a missed mapping would answer a
    // different country.
    expect(lookupOf('::ffff:192.0.2.10')).toBe('DE');
    expect(lookupOf('::FFFF:192.0.2.10')).toBe('DE');
    expect(lookupOf('::ffff:c000:20a')).toBe('DE');
    expect(lookupOf('::ffff:203.0.113.230')).toBeNull();
    // The hex spelling of the same address, for the parser rather than the
    // mapping: `c000:20a` is `192.0.2.10`.
    expect(lookupOf('::ffff:192.0.2.32')).toBe('FR');
  });

  it('answers null for the explicit ZZ block, not for the code ZZ', () => {
    // 203.0.113.224/27 is written as an explicit unknown in the fixture source.
    expect(lookupOf('203.0.113.224')).toBeNull();
    expect(lookupOf('203.0.113.230')).toBeNull();
    expect(lookupOf('203.0.113.255')).toBeNull();
    // …while its neighbour is a real country, so the null is the unknown id
    // and not a range that failed to resolve at all.
    expect(lookupOf('203.0.113.223')).toBe('FI');
  });

  it('rejects a place that is not a two-letter code (T-06-16)', () => {
    // Built here rather than committed, because no real country table has such
    // a place. It is the city table's shape, and the same reader serves it.
    const table = encodeRangeTable(
      [
        { start: parseIp('192.0.2.0')!, end: parseIp('192.0.2.127')!, place: 'DE' },
        {
          start: parseIp('198.51.100.0')!,
          end: parseIp('198.51.100.127')!,
          place: 'US\tCA\tFresno',
        },
        { start: parseIp('203.0.113.0')!, end: parseIp('203.0.113.127')!, place: 'us' },
      ],
      { kind: KIND_COUNTRY, month: '0000-00', fixture: true },
    );
    const decoded = decodeRangeTable(table);
    expect(decoded.unknownId).toBeGreaterThanOrEqual(0);

    // The lowercase place and the city-shaped place are both refused, and the
    // gap the source left (the whole tail of the address space, which the
    // writer fills with the explicit unknown) is refused too.
    expect(lookupOf('192.0.2.1', decoded)).toBe('DE');
    expect(lookupOf('198.51.100.1', decoded)).toBeNull();
    expect(lookupOf('203.0.113.1', decoded)).toBeNull();
    expect(lookupOf('9.9.9.9', decoded)).toBeNull();
  });

  it('answers null for an address the table cannot place, never a wrong country', () => {
    // The table is TOTAL by construction, so there is no "no range" answer —
    // this asserts the other half of the rule: the leading and trailing holes
    // the writer filled are unknown, not the first country's country.
    expect(lookupOf('0.0.0.0')).toBeNull();
    expect(lookupOf('255.255.255.255')).toBeNull();
    expect(lookupOf('::')).toBeNull();
  });
});
