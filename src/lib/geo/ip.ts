/**
 * Parsing, canonicalising, ordering and masking of the IP cell of an export's
 * session files (phase 06, D-05, D-06, T-06-02, T-06-12, T-06-13).
 *
 * ## Why this exists, and why it is separate from the playtime aggregator
 *
 * `playtime-aggregate.ts` states, in its own header, that the `IP` column is
 * NEVER read, and `tests/unit/playtime/` asserts that (T-04-01). The login
 * history is the one feature that has to read it, so it reads it HERE and the
 * playtime module stays untouched — an IP can never reach a playtime slice, and
 * a playtime bug can never be an IP bug.
 *
 * ## Why the length bound comes FIRST (T-06-02, T-06-12)
 *
 * An export is untrusted input: the `IP` cell can hold an email address, a
 * display name, a megabyte of text, or a string engineered to make a
 * backtracking regex hang. The bound is therefore checked BEFORE any pattern
 * runs, so the pattern only ever sees at most
 * `MAX_IP_TEXT_LENGTH + 2` characters (the bound plus whatever whitespace
 * `trim` removed) and the cost of a hostile cell is a `trim` and a comparison.
 *
 * ## Why a leading zero is REJECTED, never normalised
 *
 * `inet_aton` reads a padded group as OCTAL, so `192.168.001.001` is
 * 192.168.1.1 to a C library and 192.168.001.001 to a browser. Which reading a
 * user's own export got is a question this tool cannot answer, so a padded
 * group is not an address: it is counted as unreadable (D-06) and never stored.
 * Normalising it would silently pick one of the two readings. The same rule
 * governs the dotted tail of an IPv6 address, so `::ffff:192.0.2.010` is
 * refused rather than unwrapped.
 *
 * ## Why IPv6 is canonicalised, and what the canonical form is (D-05)
 *
 * IPv6 has many legal spellings for one address: `2001:DB8::1`,
 * `2001:db8:0:0:0:0:0:1` and `2001:0db8:0000:0000:0000:0000:0000:0001` are the
 * same 16 bytes. Grouping on the text would make them THREE rows of the login
 * table for one address, and two of them would look identical once masked —
 * which is the D-05 statement "two rows can look identical because the group
 * key is the full address" turning into a bug. So the grouping key is a
 * canonical form this module defines and nothing else produces: EIGHT
 * lower-case groups, no leading zeros, no compression, and any dotted tail
 * already converted to its two hex groups (`::ffff:192.0.2.1` becomes
 * `0:0:0:0:0:ffff:c000:201`).
 *
 * An IPv4-mapped address keeps its 16-byte identity. Unwrapping it at parse
 * time would merge rows the export never claimed were one; the unwrapping is a
 * question the country LOOKUP asks, which is why it is a separate exported
 * function ({@link mappedIpv4}) and not part of parsing.
 *
 * ## Why the IPv6 parse is a single left-to-right scan
 *
 * `::` is a run, not a token, so every regex that accepts it needs an
 * alternation over "at least one group" and "no group" — which is exactly the
 * shape that backtracks. This parser therefore splits on the ONE `::` it finds,
 * counts what is on either side, and reads each group with a fixed-width
 * anchored pattern. Words are counted AFTER a dotted tail is expanded to two
 * words (exactly eight uncompressed, at most seven compressed), and a dotted
 * quad is legal only as the final colon-separated token. A string carrying two `::` (which is also how `:::` and
 * `::::` arrive) is refused before either side is looked at, so there is no
 * input on which the work is more than linear in the length bound.
 *
 * Pure: no imports, no `Date`, no DOM, no worker globals. Nothing here ever
 * throws, and nothing here ever echoes its input (Phase 3 D-21).
 */

/**
 * The longest IP cell this module will even look at.
 *
 * 64 characters is the longest textual form of an IPv6 address with a zone
 * index, so it is not a bound that could exclude a real address — a canonical
 * IPv6 is 39 and a zone-decorated one is at most 64. It exists to bound the
 * cost of a hostile cell, and it is checked before any pattern runs.
 */
export const MAX_IP_TEXT_LENGTH = 64;

/**
 * One parsed address, or the null that answers everything else.
 *
 * `bytes` and `canonical` carry the same information in two forms: bytes for a
 * range-table comparison, the string for grouping, for storage and for display.
 * A caller that keys a `Map` MUST key it on `canonical` — two spellings of one
 * address would otherwise become two rows of the login table.
 */
export interface ParsedIp {
  /** 4 for IPv4, 6 for IPv6. Never another value. */
  family: 4 | 6;
  /** The address as four or sixteen octets, big-endian. */
  bytes: Uint8Array;
  /**
   * The one spelling this module will ever group, store or display by.
   *
   * IPv4: the trimmed dotted quad, which for a STRICT quad is the input itself
   * (a padded group is rejected, so there is nothing to normalise).
   * IPv6: the lower-case fully expanded eight groups, so `2001:DB8::1` and
   * `2001:db8:0:0:0:0:0:1` are one row and one table entry.
   */
  canonical: string;
}

/**
 * One decimal octet: `0`, one or two digits with no leading zero, or `1`/`2`
 * with exactly three.
 *
 * Written as a sub-pattern so the four groups of the address are spelled ONCE.
 * The alternation is ordered shortest-first, which is what makes the
 * leading-zero rejection fall out of the match instead of needing a second
 * check: `0` matches the first character of `01` and leaves `1` where the `\.`
 * must be, and no other branch can start with `0`.
 */
const OCTET = '(?:0|[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-5])';

/**
 * The strict dotted quad, anchored at both ends, one capture per octet.
 *
 * No nested quantifier anywhere: every group inside it is a fixed-width class
 * with at most one optional character, so the engine's backtracking is bounded
 * by a small constant on any input — which is what makes the length bound a
 * belt-and-braces measure rather than the only thing standing between a hostile
 * cell and a frozen worker.
 *
 * Built with `RegExp` rather than written as one literal so the four groups are
 * visibly identical; a copy-paste typo in a hand-written literal is invisible at
 * a glance and is exactly the kind of drift {@link ParsedIp.canonical} cannot
 * repair after the rows are already stored.
 */
const IPV4_RE = new RegExp(`^(${OCTET})\\.(${OCTET})\\.(${OCTET})\\.(${OCTET})$`);

/**
 * One IPv6 group: one to four hex digits, either case, anchored.
 *
 * Fixed width with a single bounded quantifier, so it cannot backtrack. It is
 * also what rejects a group of five digits, a group holding a dot or a colon,
 * and any character outside the hex alphabet — the "any character outside hex,
 * colon and dot" rule falls out of this pattern rather than needing a
 * separate alphabet scan.
 */
const IPV6_GROUP_RE = /^[0-9a-fA-F]{1,4}$/;

/** The fixed text a masked address ends in, and the whole of anything else. */
const MASKED = 'xxx';

/** The five groups an IPv6 mask replaces, spelled once. */
const IPV6_MASK_TAIL = 'xxxx:xxxx:xxxx:xxxx:xxxx';

/** How many groups a fully expanded IPv6 address has. */
const IPV6_GROUP_COUNT = 8;

/**
 * Read the sixteen octets of a strict dotted quad into `bytes`, or answer
 * false. Shared by the IPv4 parse and the IPv6 dotted tail so the two spell
 * the padding rule ONCE.
 */
function readIpv4(text: string, bytes: Uint8Array, at: number): boolean {
  const match = IPV4_RE.exec(text);
  if (match === null) return false;
  for (let i = 0; i < 4; i++) bytes[at + i] = Number(match[i + 1]);
  return true;
}

/**
 * Parse one IPv6 group into a 16-bit value, or answer null.
 *
 * `Number.parseInt` on a validated group of at most four hex digits cannot
 * produce anything surprising, and the value is used only to write two octets.
 */
function readGroup(group: string): number | null {
  if (!IPV6_GROUP_RE.test(group)) return null;
  return Number.parseInt(group, 16);
}

/**
 * Parse RFC 4291 IPv6 TEXT into its sixteen octets, or answer null.
 *
 * The one entry point for the whole IPv6 grammar. It never throws.
 *
 * The order of the checks is the argument, so it is written as an argument
 * rather than as a pile of guards:
 *
 *   1. a `%`, `[` or `]` can only be a zone id or a URL host form, and neither
 *      is an address — refused before anything is counted;
 *   2. the `::` compression is located, and a SECOND one is refused. This one
 *      check is also what refuses `:::` and `::::`, because each contains two
 *      overlapping occurrences;
 *   3. the text is split at the compression, or at its end when there is none,
 *      and each side is split on `:` into groups;
 *   4. only a cheap bound is applied to the TOKEN count (more than eight
 *      tokens is never an address);
 *   5. each group is read, and a dotted tail is expanded into two words by the
 *      same strict IPv4 rules ONLY when it is the final colon-separated token
 *      of the text (so a quad before the compression is refused);
 *   6. the word COUNT is settled AFTER that expansion — exactly eight with no
 *      compression, and at most seven with one, because `::` stands for at least
 *      one group of zeroes. Counting tokens instead would be wrong in both
 *      directions: a tail is one token and two words.
 */
function parseIpv6(text: string): ParsedIp | null {
  if (text.indexOf('%') !== -1) return null;
  if (text.indexOf('[') !== -1 || text.indexOf(']') !== -1) return null;

  const compression = text.indexOf('::');
  const compressed = compression !== -1;
  // Two occurrences means two runs of zeroes, and it also catches `:::` and
  // `::::`, both of which contain two overlapping `::`.
  if (compressed && text.indexOf('::', compression + 1) !== -1) return null;

  const head = compressed ? text.slice(0, compression) : text;
  const tail = compressed ? text.slice(compression + 2) : '';
  // An empty side is the all-zeroes or leading/trailing compression case, and it
  // is legal: `::` is all zeroes and `::1` is loopback.
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' ? [] : tail.split(':');
  const groups = [...headGroups, ...tailGroups];

  // One cheap early bound: no legal address has more than eight colon-separated
  // tokens, compressed or not. The exact rule is applied to WORDS below, after a
  // dotted tail has been expanded, because a tail is one token and two words.
  if (groups.length > IPV6_GROUP_COUNT) return null;

  // The values, still in the order they were written, with a dotted tail
  // already expanded into its two groups.
  // The part after the last colon. A dotted quad is expanded only when it IS
  // this token, so `<quad>::` (whose final token is empty) is never expanded.
  const finalToken = text.slice(text.lastIndexOf(':') + 1);
  const values: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!;
    if (group.indexOf('.') !== -1 && i === groups.length - 1 && group === finalToken) {
      // A dotted tail only ever ENDS an address, and it occupies the low 32
      // bits, so it is the last two words. Any other group holding a dot falls
      // through to the hex read below, which refuses it.
      //
      // Because the quad can only be the final token, it can never sit on the
      // head side of the compression: the head keeps exactly
      // `headGroups.length` words, which is why the splice index below is not
      // recomputed after expansion.
      const tailBytes = new Uint8Array(4);
      if (!readIpv4(group, tailBytes, 0)) return null;
      values.push((tailBytes[0]! << 8) | tailBytes[1]!);
      values.push((tailBytes[2]! << 8) | tailBytes[3]!);
      continue;
    }
    const value = readGroup(group);
    if (value === null) return null;
    values.push(value);
  }
  // The ONE count rule, for both branches: exactly eight words with no
  // compression, and at most seven with one (the compression stands for at least
  // one zero group).
  if (compressed ? values.length >= IPV6_GROUP_COUNT : values.length !== IPV6_GROUP_COUNT) {
    return null;
  }

  // The compression stands for however many groups are missing, all of them
  // zero, and it sits BETWEEN the head and the tail — which is why the fill is
  // inserted there rather than appended.
  const fill = IPV6_GROUP_COUNT - values.length;
  const words = compressed
    ? [
        ...values.slice(0, headGroups.length),
        ...new Array<number>(fill).fill(0),
        ...values.slice(headGroups.length),
      ]
    : values;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < IPV6_GROUP_COUNT; i++) {
    bytes[i * 2] = (words[i]! >>> 8) & 0xff;
    bytes[i * 2 + 1] = words[i]! & 0xff;
  }
  return {
    family: 6,
    bytes,
    canonical: words.map((word) => word.toString(16)).join(':'),
  };
}

/**
 * Parse one IP cell, or answer null for everything that is not an address.
 *
 * Trimmed, then length-bounded, then routed on the presence of a colon — in
 * that order (T-06-02). Routing is the honest split: a colon cannot appear in
 * an IPv4 address, and its absence is what tells the two grammars apart without
 * either one being asked to guess.
 *
 * The returned `bytes` are a fresh array the caller may keep; the input string
 * is never stored, never echoed and never retained, so a hostile cell leaves
 * this function having cost one comparison.
 *
 * Never throws.
 */
export function parseIp(raw: string): ParsedIp | null {
  const text = raw.trim();
  if (text.length === 0 || text.length > MAX_IP_TEXT_LENGTH) return null;
  if (text.indexOf(':') === -1) {
    const bytes = new Uint8Array(4);
    if (!readIpv4(text, bytes, 0)) return null;
    // A strict quad is already canonical: the padding rule means there is
    // nothing to normalise, so the trimmed text IS the grouping key.
    return { family: 4, bytes, canonical: text };
  }
  return parseIpv6(text);
}

/**
 * Order two parsed addresses: every IPv4 before every IPv6, then byte-wise.
 *
 * The family rule is the UI-SPEC's "IPv4 before IPv6" and it is a rule about
 * FAMILIES, not about values: the largest IPv4 address sorts BELOW the smallest
 * IPv6 one. Comparing the bytes directly would say the opposite, because an
 * IPv4 address is four octets and an IPv6 one is sixteen.
 *
 * Within a family the comparison is NUMERIC. That is not the same as comparing
 * the canonical strings: `9.0.0.0` sorts after `10.0.0.0` by value and before
 * it as text, so a code-unit comparison would put every table with a
 * double-digit first octet in the wrong order.
 *
 * Never throws, and never compares anything but two {@link ParsedIp}.
 */
export function compareIp(a: ParsedIp, b: ParsedIp): number {
  if (a.family !== b.family) return a.family === 4 ? -1 : 1;
  for (let i = 0; i < a.bytes.length; i++) {
    const left = a.bytes[i]!;
    const right = b.bytes[i]!;
    if (left !== right) return left - right;
  }
  return 0;
}

/**
 * The IPv4 an IPv4-mapped IPv6 address stands for, or null.
 *
 * `::ffff:a.b.c.d` and `::ffff:0:a.b.c.d` are how a socket records "an IPv4
 * address, reached over IPv6", and the country range table is an IPv4 table —
 * so the LOOKUP needs the 32-bit form while the ROW keeps the 128-bit one.
 *
 * This is deliberately not part of {@link parseIp}. Grouping is a question
 * about what the export wrote, and `::ffff:192.0.2.1` is not the row
 * `192.0.2.1`; this is a question about which table to search, asked at a
 * different time by a different caller.
 *
 * Answers null for a plain IPv4, for an IPv6 that is not mapped, and for the
 * `::ffff:0:…` form, whose 32 bits sit one group lower.
 *
 * Never throws. The bytes are a fresh array, so a caller cannot mutate the
 * address it unwrapped.
 */
export function mappedIpv4(ip: ParsedIp): ParsedIp | null {
  if (ip.family !== 6) return null;
  for (let i = 0; i < 10; i++) {
    if (ip.bytes[i] !== 0) return null;
  }
  if (ip.bytes[10] !== 0xff || ip.bytes[11] !== 0xff) return null;
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) bytes[i] = ip.bytes[12 + i]!;
  return { family: 4, bytes, canonical: `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}` };
}

/**
 * The masked form of a canonical address (D-06).
 *
 * An IPv4 address keeps its first three octets and loses its last:
 * `192.0.2.10` reads `192.0.2.xxx`. An IPv6 address keeps its first three
 * groups and loses the remaining 80 bits: `2001:db8:0:0:0:0:0:1` reads
 * `2001:db8:0:xxxx:xxxx:xxxx:xxxx:xxxx`. Both are the same rule — enough
 * stays visible to recognise the address, not enough to be one.
 *
 * Anything that is not a CANONICAL address answers the FIXED text `xxx` and
 * nothing else: this function never echoes, slices or repeats its input, so a
 * cell holding an email address cannot put that address on the screen by being
 * masked (Phase 3 D-21, T-06-13). A non-canonical IPv6 spelling is therefore
 * `xxx` too, not a mask guessed at from a compressed string — the caller is
 * handed the STORED canonical and nothing else ever reaches here.
 *
 * The mask is derived by matching the parsed form, not by slicing on a `.` or a
 * `:` — a `lastIndexOf('.')` slice is the anti-pattern RESEARCH Pattern 2
 * names, because it is correct for exactly one input shape and silently wrong
 * for the rest.
 *
 * Never throws.
 */
export function maskIp(canonical: string): string {
  const parsed = parseIp(canonical);
  // Re-parse rather than pattern-match the text: it is the one check that
  // answers "is this exactly a canonical address" for BOTH families, and it
  // costs one bounded scan of a string the length bound has already capped.
  if (parsed === null || parsed.canonical !== canonical) return MASKED;
  if (parsed.family === 4) {
    const groups = canonical.split('.');
    return `${groups[0]}.${groups[1]}.${groups[2]}.${MASKED}`;
  }
  const groups = canonical.split(':');
  return `${groups[0]}:${groups[1]}:${groups[2]}:${IPV6_MASK_TAIL}`;
}
