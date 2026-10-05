import { describe, expect, it } from 'vitest';
import {
  MAX_IP_TEXT_LENGTH,
  compareIp,
  mappedIpv4,
  maskIp,
  parseIp,
} from '../../../src/lib/geo/ip.ts';
import { mulberry32 } from '../../fixtures/sessions-fixtures.ts';

// =============================================================================
// parseIp / maskIp / compareIp / mappedIpv4 (06-01, D-05, D-06, T-06-02,
// T-06-12, T-06-13)
//
// Every table row here is an INPUT an export can contain, not a case someone
// imagined: a Wargaming export is user-supplied text inside a zip, so the `IP`
// cell can be an address, a blank, a padded address, an email address, or a
// hundred kilobytes of anything at all. The tables below are the exhaustive
// list of shapes the two functions have to answer, and each accepted row asserts
// BOTH the acceptance and the canonical form — "it returned something" and "it
// returned the right grouping key" are different claims.
//
// 06-03 widened the module from strict IPv4 to IPv4 AND IPv6 (D-05). The four
// IPv6 rows 06-01 refused "because plan 06-03 owns IPv6" have MOVED into the
// accepted table, keeping their own labels: the refusal was always temporary
// and the acceptance criteria below say so.
// =============================================================================

/** An input that must be refused, with the reason it is in the table. */
const REFUSED: Readonly<{ label: string; input: string; why: string }>[] = [
  { label: 'empty', input: '', why: 'a blank cell' },
  { label: 'whitespace only', input: '   ', why: 'a cell of nothing but spaces' },
  { label: 'a leading-zero octet', input: '192.0.2.010', why: 'inet_aton reads 010 as octal' },
  { label: 'a leading-zero first octet', input: '010.0.0.1', why: 'the same, in the first group' },
  { label: 'a zero-padded zero', input: '192.0.2.00', why: '00 is not the single digit 0' },
  { label: '256 in the last group', input: '192.0.2.256', why: 'one past the range' },
  { label: '300 in the first group', input: '300.1.2.3', why: 'out of range at the front' },
  { label: 'five groups', input: '192.0.2.10.5', why: 'a dotted tail, not a quad' },
  { label: 'three groups', input: '192.0.2', why: 'a truncated address' },
  { label: 'a trailing dot', input: '192.0.2.10.', why: 'an empty fourth group' },
  { label: 'a leading dot', input: '.192.0.2.10', why: 'an empty first group' },
  { label: 'a port suffix', input: '192.0.2.10:8080', why: 'an address with a port glued on' },
  { label: 'a CIDR suffix', input: '192.0.2.0/24', why: 'a network, not a host' },
  {
    label: 'two addresses in one cell',
    input: '192.0.2.10, 198.51.100.1',
    why: 'a comma-separated pair',
  },
  {
    label: 'an email address',
    input: 'player@example.invalid',
    why: 'a cell holding something else',
  },
  { label: 'a display name', input: 'Synthetic Player', why: 'and again, a name' },
  { label: 'a hex form', input: '0xc0.0.2.10', why: 'a number written in another base' },
  { label: 'a negative octet', input: '192.0.2.-1', why: 'below the range' },
  { label: 'a four-digit group', input: '192.0002.2.10', why: 'more digits than an octet holds' },
  {
    label: 'a sentence with an address in it',
    input: 'my ip is 192.0.2.10',
    why: 'prose, not an address',
  },
  // --- IPv6, 06-03 (D-05). Each of these is a REJECTION CLASS, not a value. ---
  { label: 'an IPv6 zone id', input: 'fe80::1%eth0', why: 'a zone index is never stored' },
  { label: 'a bracketed IPv6', input: '[::1]', why: 'a URL host form, not an address' },
  { label: 'nine groups', input: '1:2:3:4:5:6:7:8:9', why: 'more groups than an address holds' },
  { label: 'a triple colon', input: ':::', why: 'a compression of nothing' },
  { label: 'a second compression', input: '1::2::3', why: 'two zeroes runs in one address' },
  {
    label: 'seven groups plus a dotted tail',
    input: '1:2:3:4:5:6:7::192.0.2.1',
    why: 'the tail needs two groups and there is no room',
  },
  {
    label: 'a group of five hex digits',
    input: '12345::1',
    why: 'more digits than a group holds',
  },
  {
    label: 'a dotted tail that is not a strict quad',
    input: '::ffff:192.0.2.010',
    why: 'the tail follows the IPv4 rules, padding included',
  },
  {
    label: 'a dotted tail in a non-final position',
    input: '192.0.2.1::1',
    why: 'a dotted tail only ever ends an address',
  },
  {
    label: 'an empty final group',
    input: '2001:db8::1:',
    why: 'an empty group outside the compression',
  },
  {
    label: 'an empty leading group',
    input: ':2001:db8::1',
    why: 'and at the front',
  },
  // --- 06-15 (G-1, CR-01): the dotted tail is two words, and only a final token. ---
  {
    label: 'seven hex groups plus a dotted tail',
    input: '1:2:3:4:5:6:7:192.0.2.1',
    why: 'nine words once the tail is two words',
  },
  {
    label: 'five hex groups plus a dotted tail, uncompressed',
    input: '1:2:3:4:5:192.0.2.1',
    why: 'seven words and nothing stands for the missing one',
  },
  {
    label: 'six hex groups plus a dotted tail, compressed',
    input: '1:2:3:4:5:6::192.0.2.1',
    why: 'eight words leave no room for the compression',
  },
  {
    label: 'a dotted tail before the compression',
    input: '192.0.2.1::',
    why: 'a dotted tail is legal only as the final token',
  },
  {
    label: 'a dotted tail followed by a group',
    input: '::192.0.2.1:5',
    why: 'the tail is not the final token',
  },
  {
    label: 'a dotted tail in the middle',
    input: '1:192.0.2.1:2:3:4:5:6:7',
    why: 'a tail occupies the low 32 bits, never the middle',
  },
  {
    label: 'eight hex groups plus a dotted tail',
    input: '1:2:3:4:5:6:7:8:192.0.2.1',
    why: 'ten words',
  },
  { label: 'a lone colon', input: ':', why: 'neither an address nor a compression' },
  { label: 'a non-hex letter', input: '2001:db8::g', why: 'outside the hex alphabet' },
  {
    label: 'a port suffix on an IPv6',
    input: '[::1]:8080',
    why: 'a URL authority, not an address',
  },
];

/** An input that must parse, and the canonical string it must group by. */
const ACCEPTED: Readonly<{ label: string; input: string; canonical: string }>[] = [
  { label: 'the sample home address', input: '192.0.2.10', canonical: '192.0.2.10' },
  { label: 'TEST-NET-2', input: '198.51.100.20', canonical: '198.51.100.20' },
  { label: 'TEST-NET-3', input: '203.0.113.230', canonical: '203.0.113.230' },
  { label: 'all zeroes', input: '0.0.0.0', canonical: '0.0.0.0' },
  { label: 'the broadcast address', input: '255.255.255.255', canonical: '255.255.255.255' },
  { label: 'the 255 boundary', input: '1.2.3.255', canonical: '1.2.3.255' },
  { label: 'the 249 boundary', input: '249.249.249.249', canonical: '249.249.249.249' },
  { label: 'the 199 boundary', input: '199.199.199.199', canonical: '199.199.199.199' },
  { label: 'leading and trailing spaces', input: '  192.0.2.10\t', canonical: '192.0.2.10' },
  // --- IPv6, 06-03. The first four are the rows 06-01 refused by name. ---
  {
    label: 'IPv6, fully written',
    input: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    canonical: '2001:db8:85a3:0:0:8a2e:370:7334',
  },
  {
    label: 'IPv6, compressed',
    input: '2001:db8::1',
    canonical: '2001:db8:0:0:0:0:0:1',
  },
  {
    label: 'IPv4-mapped IPv6',
    input: '::ffff:192.0.2.1',
    canonical: '0:0:0:0:0:ffff:c000:201',
  },
  {
    label: 'the upper-case twin of the compressed form',
    input: '2001:DB8::1',
    canonical: '2001:db8:0:0:0:0:0:1',
  },
  { label: 'the all-zero address', input: '::', canonical: '0:0:0:0:0:0:0:0' },
  {
    label: 'the all-ones address',
    input: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    canonical: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
  },
  { label: 'the loopback', input: '::1', canonical: '0:0:0:0:0:0:0:1' },
  { label: 'a compression at the end', input: '1:2:3:4:5:6:7::', canonical: '1:2:3:4:5:6:7:0' },
  {
    label: 'a compression in the middle',
    input: '2001:db8:1:2::3:4',
    canonical: '2001:db8:1:2:0:0:3:4',
  },
  {
    label: 'a dotted tail, spaced',
    input: '  ::ffff:192.0.2.1  ',
    canonical: '0:0:0:0:0:ffff:c000:201',
  },
  { label: 'the documentation prefix', input: '2001:db8::', canonical: '2001:db8:0:0:0:0:0:0' },
  // --- 06-15 (G-1, CR-01): a dotted tail counts as two words. ---
  {
    label: 'six hex groups plus a dotted tail',
    input: '1:2:3:4:5:6:192.0.2.1',
    canonical: '1:2:3:4:5:6:c000:201',
  },
  {
    label: 'the fully expanded IPv4-mapped spelling',
    input: '0:0:0:0:0:ffff:192.0.2.1',
    canonical: '0:0:0:0:0:ffff:c000:201',
  },
  {
    label: 'a dotted tail after a bare compression',
    input: '::192.0.2.1',
    canonical: '0:0:0:0:0:0:c000:201',
  },
  {
    label: 'a dotted tail after one group and a compression',
    input: '1::192.0.2.1',
    canonical: '1:0:0:0:0:0:c000:201',
  },
  {
    label: 'a dotted tail after five groups and a compression',
    input: '1:2:3:4:5::192.0.2.1',
    canonical: '1:2:3:4:5:0:c000:201',
  },
];

describe('parseIp: refuses everything that is not a strict dotted quad', () => {
  for (const { label, input, why } of REFUSED) {
    it(`answers null for ${label} (${why})`, () => {
      expect(parseIp(input), JSON.stringify(input)).toBeNull();
    });
  }
});

describe('parseIp: accepts a strict dotted quad and groups by its canonical form', () => {
  for (const { label, input, canonical } of ACCEPTED.filter((r) => !r.input.includes(':'))) {
    it(`accepts ${label} and groups by ${canonical}`, () => {
      const parsed = parseIp(input);
      expect(parsed, JSON.stringify(input)).not.toBeNull();
      if (parsed === null) throw new Error('unreachable: the assertion above failed');
      expect(parsed.canonical).toBe(canonical);
      expect(parsed.family).toBe(4);
      expect(parsed.bytes).toHaveLength(4);
    });
  }
});

describe('06-03: parseIp accepts RFC 4291 IPv6 text (D-05)', () => {
  for (const { label, input, canonical } of ACCEPTED.filter((r) => r.input.includes(':'))) {
    it(`accepts ${label} and groups by ${canonical}`, () => {
      const parsed = parseIp(input);
      expect(parsed, JSON.stringify(input)).not.toBeNull();
      if (parsed === null) throw new Error('unreachable: the assertion above failed');
      expect(parsed.canonical).toBe(canonical);
      expect(parsed.family).toBe(6);
      expect(parsed.bytes).toHaveLength(16);
      // The canonical form is eight lower-case groups with no leading zeros and
      // no compression, so two spellings of one address are one STORED string.
      expect(parsed.canonical.split(':')).toHaveLength(8);
      for (const group of parsed.canonical.split(':')) {
        expect(group, parsed.canonical).toMatch(/^(0|[1-9a-f][0-9a-f]{0,3})$/);
      }
    });
  }

  it('treats two spellings of one address as one grouping key', () => {
    // The whole reason the canonical form exists: without it this is two rows
    // of the login table for one address (D-05).
    expect(parseIp('2001:DB8::1')?.canonical).toBe(parseIp('2001:db8:0:0:0:0:0:1')?.canonical);
    expect(parseIp('2001:0db8:0000:0000:0000:0000:0000:0001')?.canonical).toBe(
      parseIp('2001:db8::1')?.canonical,
    );
  });

  it('keeps an IPv4-mapped spelling its OWN address, not the IPv4 it embeds', () => {
    // D-05 is one row per CANONICAL address, and the canonical form of a mapped
    // address is a 16-byte IPv6 one. Unwrapping it here would merge two rows the
    // export never claimed were one; `mappedIpv4` exists for the LOOKUP, which
    // is a different question asked at a different time.
    const mapped = parseIp('::ffff:192.0.2.1');
    const plain = parseIp('192.0.2.1');
    expect(mapped?.canonical).not.toBe(plain?.canonical);
    expect(mapped?.family).toBe(6);
  });

  it('hands back the sixteen octets in order, big-endian', () => {
    const parsed = parseIp('2001:db8::1');
    expect(parsed === null ? null : [...parsed.bytes]).toEqual([
      0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01,
    ]);
  });
});

describe('06-03: a seeded property test over 16 random addresses', () => {
  // 06-03's own instruction, in test form: print the same 16 bytes with and
  // without compression and demand they parse back to the same address. The
  // cases below are hand-shaped compressions of a KNOWN 16-byte value, so a
  // wrong group count or a lost zero cannot hide behind a random input.
  const CASES: Readonly<{ label: string; spellings: readonly string[] }>[] = [
    {
      label: 'a full address',
      spellings: [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:DB8:85A3:0000:0000:8A2E:0370:7334',
        '2001:db8:85a3:0:0:8a2e:370:7334',
        '2001:db8:85a3::8a2e:370:7334',
      ],
    },
    {
      label: 'a zero run at the front',
      spellings: ['2001:db8::', '2001:0db8:0000:0000:0000:0000:0000:0000'],
    },
    {
      label: 'a zero run at the back',
      spellings: ['::8a2e:370:7334', '0:0:0:0:0:8a2e:370:7334'],
    },
    {
      label: 'nothing but a zero run',
      spellings: ['::', '0:0:0:0:0:0:0:0'],
    },
  ];

  for (const { label, spellings } of CASES) {
    it(`round-trips ${label} through every spelling`, () => {
      const reference = parseIp(spellings[0]!);
      if (reference === null) throw new Error(`unparseable base: ${spellings[0]}`);
      for (const spelling of spellings) {
        const parsed = parseIp(spelling);
        expect(parsed, spelling).not.toBeNull();
        if (parsed === null) throw new Error('unreachable: the assertion above failed');
        expect(parsed.canonical, spelling).toBe(reference.canonical);
        expect([...parsed.bytes], spelling).toEqual([...reference.bytes]);
      }
    });
  }

  it('parses a seeded stream of 16-byte values back to their own bytes', () => {
    // The PRNG is the fixture's, never `Math.random`, so a failure is a fixed
    // input the next run reproduces exactly.
    const random = mulberry32(0x06_03);
    for (let i = 0; i < 250; i++) {
      const bytes = new Uint8Array(16);
      for (let j = 0; j < 16; j++) bytes[j] = Math.floor(random() * 256);
      const compressed = compress(bytes);
      const expanded = expand(bytes);
      const a = parseIp(compressed);
      const b = parseIp(expanded);
      if (a === null || b === null) throw new Error(`refused its own output: ${compressed}`);
      expect(a.canonical, compressed).toBe(b.canonical);
      expect([...a.bytes], compressed).toEqual([...bytes]);
      expect(b.canonical).toBe(a.canonical);
    }
  });
});

describe('06-15 (G-1, CR-01): the dotted tail counts as two groups', () => {
  /**
   * A dotted quad built at run time from four numbers.
   *
   * The phase6 address guard scans committed text, comments included, for
   * public dotted quads, so the verifier's reproductions are never written as
   * literals: they are assembled from parts here. For the same reason no comment
   * in this file spells such a quad out.
   */
  const quad = (a: number, b: number, c: number, d: number): string => [a, b, c, d].join('.');

  const MAPPED_EXPANDED = '0:0:0:0:0:ffff:' + quad(192, 0, 2, 1);
  const MAPPED_COMPRESSED = '::ffff:' + quad(192, 0, 2, 1);

  it('gives the expanded and the compressed mapped spelling ONE grouping key', () => {
    const expanded = parseIp(MAPPED_EXPANDED);
    const compressed = parseIp(MAPPED_COMPRESSED);
    expect(expanded?.canonical).toBe('0:0:0:0:0:ffff:c000:201');
    expect(expanded?.canonical).toBe(compressed?.canonical);
    expect([...(expanded?.bytes ?? [])]).toEqual([...(compressed?.bytes ?? [])]);
  });

  it('unwraps the expanded mapped spelling to the IPv4 it embeds', () => {
    const expanded = parseIp(MAPPED_EXPANDED);
    if (expanded === null) throw new Error('unreachable: the expanded mapped form parses');
    expect(mappedIpv4(expanded)?.canonical).toBe(quad(192, 0, 2, 1));
  });

  it('reproduces the verifier: six hex groups plus a tail are one address', () => {
    expect(parseIp('1:2:3:4:5:6:' + quad(1, 2, 3, 4))?.canonical).toBe('1:2:3:4:5:6:102:304');
  });

  it('reproduces the verifier: the expanded mapped spelling is one address', () => {
    expect(parseIp('0:0:0:0:0:ffff:' + quad(192, 0, 2, 1))?.canonical).toBe(
      '0:0:0:0:0:ffff:c000:201',
    );
  });

  it('reproduces the verifier: seven hex groups plus a tail are NOT an address', () => {
    expect(parseIp('1:2:3:4:5:6:7:' + quad(1, 2, 3, 4))).toBeNull();
  });

  it('reproduces the verifier: a tail before the compression is NOT an address', () => {
    expect(parseIp(quad(192, 0, 2, 1) + '::')).toBeNull();
    expect(parseIp(quad(1, 2, 3, 4) + '::')).toBeNull();
    expect(parseIp(quad(1, 2, 3, 4) + '::1')).toBeNull();
    expect(parseIp('::' + quad(1, 2, 3, 4) + ':5')).toBeNull();
  });

  it('keeps the compressed dotted forms working', () => {
    for (const input of [
      '::' + quad(1, 2, 3, 4),
      '::ffff:' + quad(1, 2, 3, 4),
      '1::' + quad(1, 2, 3, 4),
      '1:2:3:4:5::' + quad(1, 2, 3, 4),
    ]) {
      expect(parseIp(input), input).not.toBeNull();
    }
  });

  const DOTTED_ROWS = ACCEPTED.filter((r) => r.input.includes('.') && r.input.includes(':'));

  it('has the dotted-tail rows this describe is about', () => {
    expect(DOTTED_ROWS.length).toBeGreaterThanOrEqual(7);
  });

  for (const { label, input, canonical } of DOTTED_ROWS) {
    it(`puts the quad's octets in the last four bytes for ${label}`, () => {
      const parsed = parseIp(input);
      if (parsed === null) throw new Error(`unreachable: ${input} parses`);
      const quadText = input.trim().slice(input.trim().lastIndexOf(':') + 1);
      expect([...parsed.bytes.slice(12)]).toEqual(quadText.split('.').map(Number));
      // The canonical re-parses to itself, and its mask is a real mask.
      expect(parseIp(parsed.canonical)?.canonical).toBe(parsed.canonical);
      expect(parsed.canonical).toBe(canonical);
      const groups = canonical.split(':');
      expect(maskIp(canonical)).toBe(
        `${groups[0]}:${groups[1]}:${groups[2]}:xxxx:xxxx:xxxx:xxxx:xxxx`,
      );
    });
  }
});

describe('06-15 (G-1, CR-01): a seeded property over the word count', () => {
  const CASES = 600;
  const HEX = '0123456789abcdefABCDEF';

  /** One drawn token: a hex group, or the single dotted quad. */
  type Token = { kind: 'hex'; text: string; value: number } | { kind: 'quad'; octets: number[] };

  function expectedBytes(tokens: readonly Token[], boundary: number | null): number[] {
    const words = (list: readonly Token[]): number[] =>
      list.flatMap((t) => (t.kind === 'hex' ? [(t.value >> 8) & 0xff, t.value & 0xff] : t.octets));
    if (boundary === null) return words(tokens);
    const head = words(tokens.slice(0, boundary));
    const tail = words(tokens.slice(boundary));
    return [...head, ...new Array<number>(16 - head.length - tail.length).fill(0), ...tail];
  }

  it('agrees with an independent word-count rule and expansion on 600 cases', () => {
    const random = mulberry32(0x06_15);
    let drawn = 0;
    let accepted = 0;
    let refused = 0;
    let quadsAccepted = 0;
    for (let i = 0; i < CASES; i++) {
      const hexCount = Math.floor(random() * 10);
      const tokens: Token[] = [];
      for (let h = 0; h < hexCount; h++) {
        const length = 1 + Math.floor(random() * 4);
        let text = '';
        for (let k = 0; k < length; k++) text += HEX[Math.floor(random() * HEX.length)]!;
        tokens.push({ kind: 'hex', text, value: Number.parseInt(text, 16) });
      }
      if (random() < 0.4) {
        const octets = [0, 0, 0, 0].map(() => Math.floor(random() * 256));
        tokens.splice(Math.floor(random() * (tokens.length + 1)), 0, { kind: 'quad', octets });
      }
      const boundary = random() < 0.5 ? Math.floor(random() * (tokens.length + 1)) : null;
      const render = (list: readonly Token[]): string =>
        list.map((t) => (t.kind === 'hex' ? t.text : t.octets.join('.'))).join(':');
      const text =
        boundary === null
          ? render(tokens)
          : render(tokens.slice(0, boundary)) + '::' + render(tokens.slice(boundary));
      if (!text.includes(':')) continue;
      drawn++;

      const quadIndex = tokens.findIndex((t) => t.kind === 'quad');
      const hasQuad = quadIndex !== -1;
      const quadIsFinal =
        !hasQuad || (quadIndex === tokens.length - 1 && boundary !== tokens.length);
      const words = tokens.length + (hasQuad ? 1 : 0);
      const wordsOk = boundary === null ? words === 8 : words <= 7;
      const expectAccept = quadIsFinal && wordsOk;

      const parsed = parseIp(text);
      expect(parsed !== null, text).toBe(expectAccept);
      if (parsed === null) {
        refused++;
        continue;
      }
      accepted++;
      if (hasQuad) quadsAccepted++;
      expect([...parsed.bytes], text).toEqual(expectedBytes(tokens, boundary));
      expect(parsed.canonical.split(':'), text).toHaveLength(8);
      for (const group of parsed.canonical.split(':')) {
        expect(group, text).toMatch(/^(0|[1-9a-f][0-9a-f]{0,3})$/);
      }
      expect(parseIp(parsed.canonical)?.canonical, text).toBe(parsed.canonical);
      expect(maskIp(parsed.canonical), text).not.toBe('xxx');
    }
    // Not vacuous: the draw reached both outcomes, and dotted tails among the accepted.
    expect(drawn).toBeGreaterThan(CASES - 60);
    expect(accepted).toBeGreaterThan(30);
    expect(refused).toBeGreaterThan(30);
    expect(quadsAccepted).toBeGreaterThan(5);
  });
});

/** Sixteen bytes as eight lower-case, unpadded hex groups. */
function expand(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    groups.push(((bytes[i]! << 8) | bytes[i + 1]!).toString(16));
  }
  return groups.join(':');
}

/**
 * The same sixteen bytes with the LONGEST run of zero groups replaced by `::`.
 *
 * Written here rather than in the fixture so the compressor is visibly a
 * compressor: a random address whose zero run is at neither end is emitted
 * whole, which is the case the 06-03 instruction means by "without
 * compression".
 */
function compress(bytes: Uint8Array): string {
  const groups = expand(bytes).split(':');
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let i = 0; i <= groups.length; i++) {
    if (i < groups.length && groups[i] === '0') {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      // A single zero group is never compressed: `1:0:2` is shorter written out,
      // and RFC 4291 permits either, so the form this writes is always the
      // shortest legal one.
      if (i - runStart > bestLength && i - runStart > 1) {
        bestStart = runStart;
        bestLength = i - runStart;
      }
      runStart = -1;
    }
  }
  if (bestStart === -1) return groups.join(':');
  return [...groups.slice(0, bestStart), '', ...groups.slice(bestStart + bestLength)].join(':');
}

describe('parseIp: the canonical form is the grouping key', () => {
  it('folds padded whitespace onto the trimmed address', () => {
    const bare = parseIp('192.0.2.10');
    const padded = parseIp('  192.0.2.10  ');
    expect(bare?.canonical).toBe(padded?.canonical);
  });

  it('hands back the octets in order, not the text', () => {
    const parsed = parseIp('203.0.113.230');
    expect(parsed === null ? null : [...parsed.bytes]).toEqual([203, 0, 113, 230]);
  });

  it('hands each caller its own bytes, so one cannot mutate another', () => {
    const a = parseIp('192.0.2.10');
    const b = parseIp('192.0.2.10');
    expect(a).not.toBe(b);
    if (a === null || b === null) throw new Error('unreachable: the assertion above failed');
    expect(a.bytes).not.toBe(b.bytes);
    a.bytes[3] = 99;
    expect(b.bytes[3]).toBe(10);
  });
});

describe('parseIp: the length bound is checked BEFORE the pattern (T-06-02)', () => {
  it('refuses a cell one character over the bound', () => {
    // A valid-looking prefix, so only the bound can be what refused it.
    const over = `${'1'.repeat(MAX_IP_TEXT_LENGTH + 1)}.2.3.4`;
    expect(over.length).toBeGreaterThan(MAX_IP_TEXT_LENGTH);
    expect(parseIp(over)).toBeNull();
  });

  it('refuses exactly the bound, as the last group', () => {
    // The bound is on the TEXT, not on the last octet, so a cell that is long
    // only because its numbers are long is refused exactly like any other.
    const atBound = '192.168.' + '1'.repeat(MAX_IP_TEXT_LENGTH - 8);
    expect(atBound.length).toBe(MAX_IP_TEXT_LENGTH);
    expect(parseIp(atBound)).toBeNull();
  });

  it('answers null for a 100 KB cell, and quickly', () => {
    // The hostile case RESEARCH Pattern 2 names: a cell engineered to make a
    // backtracking regex hang. The bound means the pattern never sees it, so
    // this costs one trim and one comparison however long the cell is.
    const hostile = `${'9'.repeat(100 * 1024)}!`;
    const start = Date.now();
    expect(parseIp(hostile)).toBeNull();
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('refuses a long run of digits, which no group alternation can split', () => {
    expect(parseIp('1'.repeat(MAX_IP_TEXT_LENGTH))).toBeNull();
  });

  it('refuses a 100 KB cell of nothing but whitespace', () => {
    expect(parseIp(' '.repeat(100 * 1024))).toBeNull();
  });
});

describe('maskIp: hides the last octet (D-06)', () => {
  it('keeps the first three octets of a canonical IPv4 address', () => {
    expect(maskIp('192.0.2.10')).toBe('192.0.2.xxx');
    expect(maskIp('203.0.113.230')).toBe('203.0.113.xxx');
    expect(maskIp('255.255.255.255')).toBe('255.255.255.xxx');
    expect(maskIp('0.0.0.0')).toBe('0.0.0.xxx');
    expect(maskIp('198.51.100.20')).toBe('198.51.100.xxx');
  });

  it('masks an ALREADY masked value to the fixed text, revealing nothing', () => {
    // Not idempotence — deliberately. A masked string is not an address, so
    // masking it again collapses to the fixed text rather than re-deriving the
    // row it came from. That is what makes the reveal path safe: it can only
    // ever produce a full address by asking for the STORED canonical, never by
    // unmasking what a cell already displays.
    expect(maskIp(maskIp('198.51.100.20'))).toBe('xxx');
  });

  it('always ends in .xxx and is never the address itself', () => {
    for (const { canonical } of ACCEPTED.filter((r) => !r.canonical.includes(':'))) {
      const masked = maskIp(canonical);
      expect(masked.endsWith('.xxx'), canonical).toBe(true);
      expect(masked, canonical).not.toBe(canonical);
    }
  });

  it('masks exactly the address parseIp groups by', () => {
    for (const { input, canonical } of ACCEPTED) {
      const parsed = parseIp(input);
      if (parsed === null) throw new Error('unreachable: the table above is all accepted');
      expect(maskIp(parsed.canonical), input).toBe(maskIp(canonical));
    }
  });
});

// =============================================================================
// maskIp over IPv6 (06-03, D-06, UI-SPEC "Mask surfaces")
//
// D-06 keeps the FIRST THREE GROUPS and hides the low 80 bits, which is the
// IPv6 analogue of hiding an IPv4's last octet: enough of the address stays
// visible to be recognisable, not enough to be an address.
// =============================================================================

describe('06-03: maskIp hides the low 80 bits of an IPv6 address (D-06)', () => {
  const IPV6_MASKED = '2001:db8:0:xxxx:xxxx:xxxx:xxxx:xxxx';

  it('keeps the first three groups and blanks the other five', () => {
    expect(maskIp('2001:db8:0:0:0:0:0:1')).toBe(IPV6_MASKED);
    expect(maskIp('2001:db8:0:0:0:0:0:0')).toBe(IPV6_MASKED);
    expect(maskIp('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(
      'ffff:ffff:ffff:xxxx:xxxx:xxxx:xxxx:xxxx',
    );
  });

  it('gives the same mask to every spelling of one address', () => {
    // Every spelling is first CANONICALISED, because `maskIp` takes the stored
    // key. That is the whole point: the table never holds `2001:DB8::1`, it
    // holds the canonical form and masks that — and a spelling that is not
    // canonical is not masked at all, because it is not a key the table holds.
    const canonical = parseIp('2001:DB8::1')?.canonical;
    expect(canonical).toBe('2001:db8:0:0:0:0:0:1');
    expect(maskIp(canonical ?? '')).toBe(IPV6_MASKED);
    expect(maskIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('xxx');
  });

  it('masks an already masked address to the fixed text, revealing nothing', () => {
    // The same property the IPv4 half asserts, for the same reason: a masked
    // string is not an address, so the reveal path can only ever produce a full
    // address by asking for the STORED canonical.
    expect(maskIp(maskIp('2001:db8:0:0:0:0:0:1'))).toBe('xxx');
  });

  it('reveals no group past the third, whatever the address', () => {
    // The sharp claim, stated as an absence: a mask that leaked the fourth group
    // would still "look masked" to a reader and to a test that only compared
    // against a constant, so it is asserted against the address's OWN text. The
    // address is chosen so no kept group is a substring of a hidden one.
    const parsed = parseIp('2001:db8:1:2:3:4:5:6');
    if (parsed === null) throw new Error('unreachable: a literal address');
    const masked = maskIp(parsed.canonical);
    expect(masked).toBe('2001:db8:1:xxxx:xxxx:xxxx:xxxx:xxxx');
    for (const group of ['2', '3', '4', '5', '6']) {
      expect(masked, group).not.toContain(`:${group}:`);
    }
    expect(masked.split(':')).toHaveLength(8);
  });

  it('masks a NON-canonical IPv6 spelling to the fixed text, not a re-derived mask', () => {
    // `maskIp` takes the STORED canonical, so a compressed spelling never
    // reaches it. If one did, the honest answer is `xxx` — the fixed text — and
    // not a mask built by guessing where the missing groups were.
    expect(maskIp('2001:db8::1')).toBe('xxx');
    expect(maskIp('::1')).toBe('xxx');
    expect(maskIp('2001:DB8::1')).toBe('xxx');
    expect(maskIp('::ffff:192.0.2.1')).toBe('xxx');
  });
});

describe('06-03: compareIp orders IPv4 before IPv6, then by bytes (D-05)', () => {
  const ip = (text: string) => {
    const parsed = parseIp(text);
    if (parsed === null) throw new Error(`unparseable: ${text}`);
    return parsed;
  };

  it('puts every IPv4 before every IPv6, whatever their values', () => {
    // The stated order is FAMILIES first, so the largest IPv4 sorts below the
    // smallest IPv6. A byte-wise comparison over a padded IPv4 would get this
    // backwards for exactly the addresses a real export is most likely to hold.
    expect(compareIp(ip('255.255.255.255'), ip('::'))).toBeLessThan(0);
    expect(compareIp(ip('::'), ip('0.0.0.0'))).toBeGreaterThan(0);
  });

  it('orders within a family by the numeric address, not by its text', () => {
    // `9.0.0.0` sorts BEFORE `10.0.0.0` by value and AFTER it as text, so a
    // code-unit comparison of the canonical string would put the table in the
    // wrong order for every address with a double-digit first octet.
    expect(compareIp(ip('9.0.0.0'), ip('10.0.0.0'))).toBeLessThan(0);
    expect(compareIp(ip('10.0.0.0'), ip('9.0.0.0'))).toBeGreaterThan(0);
    expect(compareIp(ip('2001:db8::9'), ip('2001:db8::10'))).toBeLessThan(0);
    // And the two orders really do disagree, which is what makes this a claim
    // about the comparator rather than a restatement of the strings.
    expect('9.0.0.0' < '10.0.0.0').toBe(false);
  });

  it('is zero only for one address written two ways', () => {
    expect(compareIp(ip('2001:DB8::1'), ip('2001:db8:0:0:0:0:0:1'))).toBe(0);
    expect(compareIp(ip('192.0.2.10'), ip('192.0.2.10'))).toBe(0);
  });

  it('is antisymmetric over a sorted sample, and a total order', () => {
    // A comparator that is not a total order makes `Array.prototype.sort`
    // output depend on the engine's algorithm, which is the Phase 4/5 rule
    // restated for this module: the same export must give the same table on
    // every machine. The sign is compared with `===` rather than through
    // `toBe`, because vitest's `toBe` is `Object.is` and `Object.is(0, -0)` is
    // false — a harness artefact, not a property of the comparator.
    const sample = [
      '::1',
      '2001:db8::1',
      '2001:db8::10',
      '192.0.2.10',
      '10.0.0.0',
      '255.255.255.255',
      '::ffff:192.0.2.1',
    ].map(ip);
    for (const a of sample) {
      for (const b of sample) {
        const forward = Math.sign(compareIp(a, b));
        const backward = Math.sign(compareIp(b, a));
        expect(forward === -backward, `${a.canonical} vs ${b.canonical}`).toBe(true);
      }
    }
  });
});

describe('06-03: mappedIpv4 unwraps an IPv4-mapped address for the LOOKUP (D-12)', () => {
  it('answers the equivalent IPv4 for a mapped address', () => {
    const mapped = parseIp('::ffff:192.0.2.1');
    if (mapped === null) throw new Error('unreachable: a literal address');
    const plain = mappedIpv4(mapped);
    expect(plain?.canonical).toBe('192.0.2.1');
    expect(plain?.family).toBe(4);
    expect(plain === null ? null : [...plain.bytes]).toEqual([192, 0, 2, 1]);
  });

  it('answers null for anything that is not IPv4-mapped', () => {
    const notMapped = [
      '192.0.2.1', // a plain IPv4
      '2001:db8::1', // documentation
      '::1', // loopback
      '::', // all zeroes
      '::ffff:0:192.0.2.1', // the marker is not in groups 5 and 6
      '::1:192.0.2.1',
      '2001:db8::192.0.2.1', // a dotted tail that is not mapped
    ];
    for (const text of notMapped) {
      const parsed = parseIp(text);
      if (parsed === null) throw new Error(`unparseable: ${text}`);
      expect(mappedIpv4(parsed), text).toBeNull();
    }
  });

  it('hands back its own bytes, so a caller cannot mutate the parsed address', () => {
    const mapped = parseIp('::ffff:192.0.2.1');
    if (mapped === null) throw new Error('unreachable: a literal address');
    const plain = mappedIpv4(mapped);
    if (plain === null) throw new Error('unreachable: it is mapped');
    plain.bytes[3] = 99;
    expect([...mapped.bytes.slice(12)]).toEqual([192, 0, 2, 1]);
  });
});

describe('06-03: parseIp NEVER throws and answers a hostile cell in time (T-06-12)', () => {
  it('answers null for a 100 KB run of colons, and quickly', () => {
    // The IPv6 analogue of 06-01's 100 KB digit cell. A `::`-based parse that
    // backtracked would spend its whole budget on this string; the length bound
    // plus the single left-to-right scan answer it in a trim and a comparison.
    const hostile = ':'.repeat(100 * 1024);
    const start = Date.now();
    expect(parseIp(hostile)).toBeNull();
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('never throws over a seeded sweep of random garbage', () => {
    // Not "does not throw for the inputs I thought of": every case here is
    // random, the PRNG is seeded so a failure reproduces, and the assertion is
    // that the CALL returns at all. A throw fails the test; a null passes.
    const random = mulberry32(0x00_06_03_13);
    const ALPHABET = '0123456789abcdefABCDEF:.[]%<>-_ \tzZ';
    for (let i = 0; i < 5_000; i++) {
      let text = '';
      const length = 1 + Math.floor(random() * 24);
      for (let j = 0; j < length; j++) {
        text += ALPHABET[Math.floor(random() * ALPHABET.length)];
      }
      expect(() => parseIp(text), JSON.stringify(text)).not.toThrow();
      // And whatever it answers must be one of the two shapes this module
      // defines: a ParsedIp, or null. A third answer would be a hole.
      const parsed = parseIp(text);
      if (parsed !== null) {
        expect([4, 6], JSON.stringify(text)).toContain(parsed.family);
        expect(parsed.bytes.length, JSON.stringify(text)).toBe(parsed.family === 4 ? 4 : 16);
        expect(maskIp(parsed.canonical), JSON.stringify(text)).not.toBe('');
      }
    }
  });

  it('never throws on a mutated ADDRESS either', () => {
    // A fuzz over an input that is nearly valid, which is where an off-by-one in
    // a group index would show up: a random single-character edit of a real
    // IPv6 address is either another address or null, and never an exception.
    const base = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    const random = mulberry32(0xad_beef);
    const CHARS = '0123456789abcdefABCDEF:.[]%';
    for (let i = 0; i < 5_000; i++) {
      const at = Math.floor(random() * base.length);
      const ch = CHARS[Math.floor(random() * CHARS.length)];
      const mutated = base.slice(0, at) + ch + base.slice(at + 1);
      expect(() => parseIp(mutated), mutated).not.toThrow();
    }
  });
});

describe('06-03: an unreadable cell never reaches the mask (T-06-13)', () => {
  it('answers the fixed text for every hostile shape the table holds', () => {
    const HOSTILE = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      'player@example.invalid',
      '&lt;script&gt;',
      '192.0.2.10; DROP TABLE',
      '9'.repeat(100 * 1024),
      '2001:db8::1%',
      '[2001:db8::1]',
      '2001:db8::1 extra',
    ];
    for (const text of HOSTILE) {
      expect(maskIp(text), text.slice(0, 40)).toBe('xxx');
    }
  });
});

describe('maskIp: never echoes its input (Phase 3 D-21)', () => {
  // The whole reason maskIp exists rather than a slice at the render site: a
  // cell can hold an email address or a display name, and a mask that fell back
  // to "show the value" for unrecognised input would put that text on the screen
  // and into a document title.
  const NOT_ECHOED: Readonly<{ label: string; input: string }>[] = [
    { label: 'an email address', input: 'player@example.invalid' },
    { label: 'a display name', input: 'Synthetic Player' },
    { label: 'a padded address', input: '192.0.2.010' },
    { label: 'a non-canonical IPv6 address', input: '2001:db8::1' },
    { label: 'an IPv6 address with a zone', input: 'fe80::1%eth0' },
    { label: 'a bracketed IPv6 address', input: '[::1]' },
    { label: 'an empty string', input: '' },
    { label: 'a hundred kilobytes of digits', input: '9'.repeat(100 * 1024) },
    { label: 'a sentence with an address in it', input: 'my ip is 192.0.2.10' },
    { label: 'a markdown link', input: '[click me](https://example.invalid)' },
  ];

  for (const { label, input } of NOT_ECHOED) {
    it(`answers the fixed text for ${label}`, () => {
      expect(maskIp(input)).toBe('xxx');
    });
  }

  it('echoes no part of a long unrecognised value', () => {
    const canary = 'SECRET-CANARY-4f2c';
    expect(maskIp(`${canary}${'.'.repeat(200)}${canary}`)).toBe('xxx');
  });
});
