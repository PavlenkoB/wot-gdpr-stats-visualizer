import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { parseIp } from '../../../src/lib/geo/ip.ts';
import {
  LOGINS_CSV_HEADER,
  LOGINS_SESSION_HEADER,
  LOGINS_UNREADABLE_IPS,
  buildLoginsOverCapSpec,
  buildLoginsScaleExport,
  buildLoginsScaleSpec,
  compareCanonicalIp,
  type LoginsScaleSpec,
} from '../../fixtures/logins-fixtures.ts';
import { cells } from '../../helpers/login-oracle.ts';

// =============================================================================
// The scale fixture is itself a test subject (06-03, D-17)
//
// Every claim the aggregate makes over 12,000 rows rests on this file being what
// it says it is, and nothing else in the suite would notice if it were not. A
// generator that emitted a real address, or 200 rows, or one date format, or
// only already-canonical spellings, would make the oracle comparison pass while
// proving nothing — so those four properties are asserted HERE, in Node, in
// seconds, rather than being discovered in a browser run hours later.
//
// The address-range assertion is also the D-17 privacy rule: nothing in this
// repository may contain a real host, and a generator that reached for one would
// otherwise put it in a committed fixture.
// =============================================================================

/** RFC 5737 TEST-NET-1, -2 and -3, the only IPv4 blocks this fixture may use. */
const IPV4_BLOCKS = ['192.0.2.', '198.51.100.', '203.0.113.'] as const;

/** RFC 3849, the only IPv6 block this fixture may use. */
const IPV6_PREFIX = '2001:db8:';

const SCALE = buildLoginsScaleSpec();
const OVER_CAP = buildLoginsOverCapSpec(20_500);

/** True when the address is inside one of the four documentation ranges. */
function isDocumentationAddress(canonical: string): boolean {
  if (canonical.includes(':')) return canonical.startsWith(IPV6_PREFIX);
  return IPV4_BLOCKS.some((block) => canonical.startsWith(block));
}

/** Every cell of every generated row, split by the naive reader. */
function everyCell(spec: LoginsScaleSpec): { file: string; cell: string }[] {
  const out: { file: string; cell: string }[] = [];
  for (const file of spec.files) {
    for (const line of file.text.split('\r\n').slice(1)) {
      if (line === '') continue;
      for (const cell of cells(line)) out.push({ file: file.path, cell });
    }
  }
  return out;
}

describe('06-03: the scale fixture is big enough for its claims', () => {
  it('emits 10,000 or more rows over four files', () => {
    expect(SCALE.files).toHaveLength(4);
    expect(SCALE.rowCount).toBeGreaterThanOrEqual(10_000);
    expect(SCALE.readableRows).toBeGreaterThanOrEqual(10_000);
    // Both counters non-zero: a fixture with no unreadable cell could not tell
    // a correct unreadable count from a total that is simply the row count.
    expect(SCALE.unreadableRows).toBeGreaterThan(0);
    expect(SCALE.rowCount).toBe(SCALE.readableRows + SCALE.unreadableRows);
  });

  it('spans many addresses, with one dominant and a long tail', () => {
    expect(SCALE.distinctAddresses).toBeGreaterThan(500);
    expect(SCALE.addresses).toHaveLength(SCALE.distinctAddresses);
    // The heavy tail is the claim that makes `logins DESCENDING` observable: a
    // uniform fixture would order by the secondary rule and prove nothing.
    const counts = SCALE.readableRows / SCALE.distinctAddresses;
    expect(counts).toBeGreaterThan(5);
  });

  it('records one intended spelling per row, and they line up with the text', () => {
    for (const file of SCALE.files) {
      const lines = file.text
        .split('\r\n')
        .slice(1)
        .filter((line) => line !== '');
      expect(file.intended.length, file.path).toBe(lines.length);
    }
  });
});

describe('06-03: every address in the fixture is a documentation range (D-17)', () => {
  it('holds no address outside the four documentation blocks', () => {
    for (const spec of [SCALE, OVER_CAP]) {
      for (const canonical of spec.addresses) {
        expect(isDocumentationAddress(canonical), canonical).toBe(true);
      }
    }
  });

  it('holds no IPv4 host of 0 or 255, so no network or broadcast address', () => {
    for (const canonical of SCALE.addresses.filter((ip) => !ip.includes(':'))) {
      const host = Number(canonical.split('.')[3]);
      expect(host).toBeGreaterThan(0);
      expect(host).toBeLessThan(255);
    }
  });

  it('holds no intended spelling that does not parse to the address it claims', () => {
    // The sharpest form of the claim, and the one a hand-written compressor
    // fails: every cell the generator labels with a canonical spelling must
    // ACTUALLY parse back to that spelling. A "compression" that collapses
    // groups which are not zero is a different address wearing the same clothes,
    // and the oracle would then disagree with the aggregator for a reason that
    // has nothing to do with either of them.
    for (const spec of [SCALE, OVER_CAP]) {
      for (const file of spec.files) {
        const ipColumn = cells(file.header).indexOf('IP');
        expect(ipColumn, file.path).toBeGreaterThanOrEqual(0);
        const lines = file.text
          .split('\r\n')
          .slice(1)
          .filter((line) => line !== '');
        for (let i = 0; i < lines.length; i++) {
          const intended = file.intended[i];
          if (intended === null) continue;
          const ip = cells(lines[i]!)[ipColumn] ?? '';
          expect(parseIp(ip)?.canonical, `${file.path} row ${i}: ${ip}`).toBe(intended);
        }
      }
    }
  });

  it('spells at least one address in each of three non-canonical ways', () => {
    // If every cell were already canonical, the whole of D-05 — one row per
    // distinct FULL address — would be untested at 12,000 rows.
    const spellings = new Set<string>();
    for (const file of SCALE.files) {
      for (const line of file.text.split('\r\n').slice(1)) {
        if (line === '') continue;
        const ip = cells(line)[2] ?? cells(line)[1] ?? '';
        if (parseIp(ip) !== null) spellings.add(ip);
      }
    }
    const canonicalCells = [...spellings].filter((cell) => !cell.startsWith('2001:db8:'));
    const compressed = [...spellings].filter((cell) => cell.includes('::'));
    const padded = [...spellings].filter((cell) => /:0[0-9a-f]{3}:/.test(cell));
    const mixedCase = [...spellings].filter((cell) => /[A-F]/.test(cell));
    expect(canonicalCells.length).toBeGreaterThan(0);
    expect(compressed.length).toBeGreaterThan(0);
    expect(padded.length).toBeGreaterThan(0);
    expect(mixedCase.length).toBeGreaterThan(0);
  });
});

describe('06-03: the fixture is hostile in the shapes a real export is hostile in', () => {
  it('carries a blank, a padded octet, a zone, a bracket, an email and markup', () => {
    const written = new Set(everyCell(SCALE).map((c) => c.cell));
    for (const cell of LOGINS_UNREADABLE_IPS) {
      expect(written.has(cell), JSON.stringify(cell)).toBe(true);
    }
  });

  it('carries cells that must be refused AND cells that must parse', () => {
    const cellsOfScale = everyCell(SCALE).map((c) => c.cell);
    expect(cellsOfScale.some((cell) => parseIp(cell) === null)).toBe(true);
    expect(cellsOfScale.some((cell) => parseIp(cell) !== null)).toBe(true);
  });

  it('never writes a double quote or a semicolon into a cell', () => {
    // Two constraints the CSV shapes impose, and both are the FIXTURE's to
    // keep: a double quote would need RFC 4180 escaping, and a semicolon is this
    // export's own DELIMITER, so a cell carrying one is not one cell at all and
    // a test using it would be measuring the CSV parser rather than the
    // address parser.
    for (const { cell } of everyCell(SCALE)) {
      expect(cell.includes('"'), JSON.stringify(cell)).toBe(false);
      expect(cell.includes(';'), JSON.stringify(cell)).toBe(false);
    }
  });

  it('holds a cell long enough to prove the length bound runs first', () => {
    const longest = Math.max(...everyCell(SCALE).map((c) => c.cell.length));
    expect(longest).toBeGreaterThan(64);
  });
});

describe('06-03: one export carries TWO date formats (D-03)', () => {
  it('writes WOT in the real dotted shape and the other two in quoted ISO', () => {
    const wot = SCALE.files.find((f) => f.game === 'WOT');
    const wotb = SCALE.files.find((f) => f.game === 'WOTB');
    if (wot === undefined || wotb === undefined) throw new Error('unreachable: four files');
    expect(wot.header).toBe(LOGINS_SESSION_HEADER);
    expect(wotb.header).toBe(LOGINS_SESSION_HEADER);
    expect(cells(wot.text.split('\r\n')[1]!)[0]).toMatch(/^\d{2}\.\d{2}\.\d{4} /);
    expect(cells(wotb.text.split('\r\n')[1]!)[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('writes the invented Logins.csv under the header it is supposed to carry', () => {
    const logins = SCALE.files.find((f) => f.game === null);
    if (logins === undefined) throw new Error('unreachable: one file names no game');
    expect(logins.path).toBe('Activity_history/Logins.csv');
    expect(logins.header).toBe(LOGINS_CSV_HEADER);
    expect(cells(logins.header)).toEqual(['LOGIN_DT', 'IP', 'COUNTRY_CODE', 'USER_AGENT']);
    // A login file contributes NO game token, which is what makes the per-address
    // `games` set a THREE-token union across the whole export and not a
    // four-token one: the session files name WOT, WOTB and WOWS in their own
    // names, and an invented `Logins.csv` names none.
    expect(
      SCALE.files
        .map((file) => file.game)
        .filter((game) => game !== null)
        .sort(),
    ).toEqual(['WOT', 'WOTB', 'WOWS']);
  });

  it('carries unreadable stamps on purpose, so the range fold is exercised', () => {
    const stamps = everyCell(SCALE)
      .map((c) => c.cell)
      .filter((cell) => /not-a-date|yesterday|^\s*$/.test(cell));
    expect(stamps.length).toBeGreaterThan(0);
  });
});

describe('06-03: the over-cap generator really is over the cap', () => {
  it('emits 20,500 distinct IPv6 addresses and 20,501 rows', () => {
    expect(OVER_CAP.distinctAddresses).toBe(20_500);
    expect(OVER_CAP.rowCount).toBe(20_501);
    expect(new Set(OVER_CAP.addresses).size).toBe(20_500);
    expect(OVER_CAP.unreadableRows).toBe(0);
  });

  it('gives every address the same first three groups, so all of them mask alike', () => {
    for (const canonical of OVER_CAP.addresses.slice(0, 200)) {
      expect(canonical.split(':').slice(0, 3).join(':')).toBe('2001:db8:0');
    }
  });

  it('sorts ascending by numeric address, so the cut is exactly arithmetic', () => {
    for (let i = 1; i < OVER_CAP.addresses.length; i++) {
      expect(
        compareCanonicalIp(OVER_CAP.addresses[i - 1]!, OVER_CAP.addresses[i]!),
        `index ${i}`,
      ).toBeLessThan(0);
    }
  });
});

describe('06-03: the zipped scale export carries the four generated files', () => {
  const bytes = buildLoginsScaleExport(SCALE);
  const entries = unzipSync(bytes);

  it('is a zip, and a big one', () => {
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(bytes.length).toBeGreaterThan(100_000);
  });

  it('carries every generated file, byte for byte, and no other session file', () => {
    // The archive is unzipped rather than read as text: `pinned-zip` DEFLATES
    // its entries, so the bytes hold the names in the clear and the contents
    // not at all. The sample's own `Sessions.csv` would contribute rows with no
    // game token and a `SESSION_START` column the unit test never sees, so a
    // fixture that left it in would describe a DIFFERENT export than the one
    // `oracleLogins` recomputes.
    const activity = Object.keys(entries).filter((name) => name.includes('Activity_history/'));
    for (const file of SCALE.files) {
      const key = activity.find((name) => name.endsWith(`/${file.path.split('/').pop()}`));
      expect(key, file.path).toBeDefined();
      expect(new TextDecoder().decode(entries[key!]), file.path).toBe(file.text);
    }
    expect(
      activity.filter((name) => name.endsWith('Sessions.csv') && !name.includes('Game_Sessions')),
    ).toEqual([]);
  });

  it('replaces the sample own Logins.csv rather than adding to it', () => {
    // The override writes the SAME path the sample already ships, so the archive
    // must hold one `Logins.csv` and it must be the generated one. Counting the
    // entries is the check; reading the header is the confirmation.
    const logins = Object.keys(entries).filter((name) =>
      name.endsWith('Activity_history/Logins.csv'),
    );
    expect(logins).toHaveLength(1);
    expect(new TextDecoder().decode(entries[logins[0]!]).split('\r\n')[0]).toBe(LOGINS_CSV_HEADER);
  });
});
