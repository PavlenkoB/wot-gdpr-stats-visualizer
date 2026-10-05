/**
 * The range-table CONTAINER: one binary format, one pure reader and one pure
 * writer, shared by the worker, the build scripts and the tests (phase 06,
 * ACTIVITY-06, ACTIVITY-07, D-12, D-13, T-06-16, RESEARCH Pattern 1).
 *
 * ## Why ONE container for both tiers
 *
 * The country tier and the city tier are the same problem at two sizes: an
 * address in, a place id out, over a set of contiguous ranges. A second format
 * would mean a second reader to validate, a second lookup to test and a second
 * set of ways to be wrong about a boundary address. The `kind` byte in the
 * header is the only thing that differs — `KIND_COUNTRY` places are two-letter
 * codes, `KIND_CITY` places are `CC\tState\tCity` strings — so the writer, the
 * reader, the normaliser and the three lookups are written once.
 *
 * ## Why the table is an ARGUMENT and never a module global
 *
 * `lookupV4` / `lookupV6` / `lookupIp` all take the table as a parameter. That
 * is what lets a unit test inject a SYNTHETIC table mapping RFC 5737
 * documentation addresses to countries (RESEARCH Pitfall 2: against the real
 * table every documentation address is `ZZ`, so a table-injected lookup is the
 * only way a country assertion can be made at all), and it is what lets the
 * same three functions serve the worker, the build script and the city opt-in
 * without any of them reaching for shared state.
 *
 * ## Why the source is NORMALISED, not trusted
 *
 * The writer sorts the source, fills the leading hole and every gap with an
 * EXPLICIT unknown place, fills the trailing hole to the top of the address
 * space, and merges adjacent ranges of the same place. That is what makes a
 * lookup total: after normalisation the first range starts at address zero and
 * the ranges are contiguous, so the predecessor search always finds a range and
 * no address in either family is ever unanswerable. It is also what makes a
 * source WITHOUT reserved-space rows behave exactly like one with them — the
 * mirror CSV measured in RESEARCH (no `ZZ` rows at all) is normalised into the
 * same table as the official one.
 *
 * The container stores only the range STARTS. That is not a compression trick,
 * it is the consequence of normalisation: with no gap anywhere, the end of
 * range *i* is one below the start of range *i+1*, so a second plane of ends
 * would carry no information.
 *
 * ## Why IPv6 is stored EXACTLY and never truncated (RESEARCH Evidence)
 *
 * A start is a 128-bit value and it is stored as a 128-bit value: a
 * high-64 plane (delta-encoded against the previous start) plus a low-64 plane.
 * Measured on the real 2026-10 country file, 419 of 348,712 IPv6 starts have a
 * NON-ZERO low half, and truncating to the high 64 bits collapses 298 country
 * ranges onto the same key. A country table that answers "the same country" for
 * two different allocations is worse than one that answers unknown, so the low
 * plane is stored densely as varints even though almost every entry in it is a
 * single zero byte (the whole plane gzips to about 1 KB).
 *
 * ## Why the reader validates before it trusts a LENGTH (T-06-16)
 *
 * The same reader will later decode a FETCHED city asset, so it treats its
 * input as untrusted bytes rather than as a file this project wrote. It checks
 * the magic, the version, the kind, the flag bits, the reserved bytes, the
 * month shape, the counts against their caps, that the counts agree with the
 * byte lengths of the sections they describe, that every start is strictly
 * greater than the previous one, and that every place id is below the place
 * count — all before any of the typed arrays it is about to build is used.
 *
 * Every one of those failures throws the SAME fixed text, {@link
 * RANGE_TABLE_ERROR}, which contains no byte, no offset and no length. A
 * corrupted asset is a fact about a file, not text to be shown to a user or
 * pasted into a log.
 *
 * ## Why the writer is COLUMNAR, and why the object writer delegates to it
 *
 * The city tier is 7.8 million source rows. A writer that took them as a list
 * of objects would need one allocation per row for a build that has to hold
 * none of them, so the writer's real input is {@link RangeColumns} — typed
 * arrays a build script streams into — and the normalisation walks them with
 * two pending runs instead of a list it then folds. The small
 * {@link encodeRangeTable} overload is a shim over columns: it counts, fills
 * and delegates. That is what makes "the same exact layout" and "the same
 * normalisation" a checked fact — the committed 377-byte country fixture is
 * still byte-identical to a fresh encode of its CSV, which
 * `tests/unit/geo/range-table.test.ts` asserts on every run.
 *
 * ## Pure by construction
 *
 * The only import is `./ip.ts` — no DOM, no Node API, no worker global, no
 * clock, no network. The worker, the Node build scripts and the Vitest suite all
 * import this file directly, which is only possible because it depends on
 * nothing that distinguishes them.
 */

import { mappedIpv4, type ParsedIp } from './ip.ts';

// =============================================================================
// Constants and limits
// =============================================================================

/** A place is a two-letter country code; `ZZ` is DB-IP's unknown/reserved. */
export const KIND_COUNTRY = 1;

/** A place is `CC\tState\tCity`, joined by tabs. */
export const KIND_CITY = 2;

/** The container revision this module reads and writes. */
export const RANGE_TABLE_VERSION = 1;

/** The fixed header size, in bytes. Layout is documented on {@link RANGE_TABLE}. */
export const RANGE_TABLE_HEADER_BYTES = 28;

/**
 * The one text every decode failure throws (T-06-16).
 *
 * It is a constant rather than a formatted message because the alternative is
 * a message assembled from the very bytes that turned out to be untrustworthy:
 * an error string is logged, shown and copied, and a container whose header is
 * hostile would choose its own text.
 */
export const RANGE_TABLE_ERROR = 'geo range table: the table is not readable';

/**
 * The largest COUNTRY table this module will look at, in bytes.
 *
 * Twice the measured size of the production country table (about 3.1 MB).
 * A table over the cap is refused before a single length is believed.
 */
export const MAX_RANGE_TABLE_BYTES = 8 * 1024 * 1024;

/**
 * The largest CITY container this module will look at, in bytes.
 *
 * A different constant from {@link MAX_RANGE_TABLE_BYTES} because the two tiers
 * are two sizes of the same container, and 42.8 MB is the measured RAW city
 * container (plan 06-09) — about 11.85 MB gzipped, which is the part the
 * browser actually transfers. 96 MB is more than twice the measurement, so a
 * real month always fits and a hostile header still cannot claim an unbounded
 * buffer. The cap is applied AFTER the kind byte is read, because the kind is
 * what selects the cap: there is no window in which an unvalidated length is
 * used to size anything.
 */
export const MAX_CITY_TABLE_BYTES = 96 * 1024 * 1024;

/** How many places a header may claim. */
export const MAX_RANGE_TABLE_PLACES = 1_000_000;

/** How many ranges ONE family may claim. */
export const MAX_RANGE_TABLE_RANGES = 8_000_000;

/** The longest single place string, in UTF-16 code units. */
export const MAX_PLACE_LENGTH = 1024;

// =============================================================================
// The decoded table
// =============================================================================

/**
 * One decoded range table.
 *
 * Every field is either a number, a string or a typed array — there is no lazy
 * branch and no module state, so a caller can hold two tables at once (the
 * country table and a city table) and pass either to the same lookup.
 *
 * `v4Starts` and `v6Hi`/`v6Lo` are strictly increasing and CONTIGUOUS by
 * construction: `v4Starts[0]` is 0 and each range runs to one below the next
 * start. There are no end values because there are no gaps to end at.
 */
export interface RangeTable {
  /** {@link KIND_COUNTRY} or {@link KIND_CITY}. */
  readonly kind: number;
  /** The source month the table was built from, `YYYY-MM`. */
  readonly month: string;
  /** True when the table is a TEST fixture rather than real source data. */
  readonly fixture: boolean;
  /** The place strings, in id order. */
  readonly places: readonly string[];
  /** The id of the explicit unknown place for this `kind`. */
  readonly unknownId: number;
  /** IPv4 range starts, ascending, starting at 0. */
  readonly v4Starts: Uint32Array;
  /** The place id of each IPv4 range, index-aligned with {@link v4Starts}. */
  readonly v4Ids: Uint32Array;
  /** The high 64 bits of each IPv6 range start, ascending. */
  readonly v6Hi: BigUint64Array;
  /** The low 64 bits of each IPv6 range start, index-aligned with {@link v6Hi}. */
  readonly v6Lo: BigUint64Array;
  /** The place id of each IPv6 range, index-aligned with {@link v6Hi}. */
  readonly v6Ids: Uint32Array;
}

/** One row of the source a table is built from. */
export interface RangeInput {
  readonly start: ParsedIp;
  readonly end: ParsedIp;
  /** A two-letter code for a country table; a `CC\tState\tCity` string for a city one. */
  readonly place: string;
}

/** What an encoded table records about its own provenance. */
export interface EncodeOptions {
  readonly kind: number;
  /** `YYYY-MM`. `0000-00` is the fixture marker, so month `0` is legal. */
  readonly month: string;
  readonly fixture: boolean;
}

/**
 * Which address families a caller actually needs (T-06-34).
 *
 * ## Why this is an OPTION and not a behaviour change
 *
 * Omitted — the argument a country lookup makes — means both families, which
 * is exactly what the shipped country table has. The city container, whose IPv6
 * plane is 3.8 million entries of `BigUint64Array` pairs, is decoded with the
 * families the dataset's own addresses contain, so a v4-only account never
 * allocates it.
 *
 * ## What is NOT skipped
 *
 * A skipped family's bytes are still PARSED and still VALIDATED — the start
 * deltas, the ids and the strict increase are all checked, and the reader
 * still lands exactly on the final byte. Only the two or three typed arrays
 * are left empty. That distinction is the point: "the IPv6 section of this
 * container is not readable" is a fact about the file, and a lookup that
 * skipped the check would report it as a successful v4 answer.
 */
export interface DecodeFamilies {
  readonly ipv4: boolean;
  readonly ipv6: boolean;
}

// =============================================================================
// The layout, in one place
// =============================================================================

/**
 * The byte layout, offsets included, because the reader and the corruption
 * tests both need to name a position and neither should have to count bytes
 * twice.
 *
 * ```text
 *   0  magic 'RGTB'          4 bytes
 *   4  version               u8   == RANGE_TABLE_VERSION
 *   5  kind                  u8   1 or 2
 *   6  flags                 u8   bit 0 = fixture, every other bit reserved and zero
 *   7  reserved              u8   always 0
 *   8  year                  u16le
 *  10  month                 u8   0-12
 *  11  reserved              u8   always 0
 *  12  placeCount            u32le
 *  16  v4Count               u32le
 *  20  v6Count               u32le
 *  24  placeBytes            u32le
 *  28  place table           placeBytes, UTF-8, newline separated, no trailing newline
 *  ..  v4 start deltas       v4Count varints (the first is absolute)
 *  ..  v4 place ids          v4Count varints
 *  ..  v6 high deltas        v6Count varints (the first is absolute)
 *  ..  v6 low plane          v6Count varints
 *  ..  v6 place ids          v6Count varints
 * ```
 *
 * The three IPv6 planes and the two IPv4 planes are separate rather than
 * interleaved per range, which is what makes "the count agrees with the byte
 * length" a checkable statement: each plane is exactly N varints and the
 * reader must land on the final byte.
 */
const OFF_MAGIC = 0;
const OFF_VERSION = 4;
const OFF_KIND = 5;
const OFF_FLAGS = 6;
const OFF_RESERVED_A = 7;
const OFF_YEAR = 8;
const OFF_MONTH = 10;
const OFF_RESERVED_B = 11;
const OFF_PLACE_COUNT = 12;
const OFF_V4_COUNT = 16;
const OFF_V6_COUNT = 20;
const OFF_PLACE_BYTES = 24;

const MAGIC = [0x52, 0x47, 0x54, 0x42]; // 'RGTB'
const FLAG_FIXTURE = 0b1;
const RESERVED_BITS = ~FLAG_FIXTURE & 0xff;

const IPV4_MAX = 0xffff_ffff;
const IPV6_MAX = (1n << 128n) - 1n;
const LOW64 = 0xffff_ffff_ffff_ffffn;
const MAX_U32 = 0xffff_ffff;

// =============================================================================
// Varints
// =============================================================================

/** The longest legal encoding of a 32-bit varint. */
const MAX_U32_VARINT_BYTES = 5;

/** The longest legal encoding of a 64-bit varint. */
const MAX_U64_VARINT_BYTES = 10;

/**
 * A growable byte buffer.
 *
 * A plain `number[]` of 3.1 million bytes would hold three million boxed
 * doubles, which is both slower and far larger than the output; a doubling
 * `Uint8Array` is the same code with an eighth of the memory and no per-element
 * allocation.
 */
class ByteWriter {
  private buf: Uint8Array;
  private len = 0;

  constructor() {
    this.buf = new Uint8Array(1 << 16);
  }

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length;
    while (size < this.len + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
  }

  u8(value: number): void {
    this.ensure(1);
    this.buf[this.len] = value & 0xff;
    this.len += 1;
  }

  /** LEB128, unsigned, for a value that fits in 32 bits. */
  varint(value: number): void {
    let rest = value;
    while (rest >= 0x80) {
      this.u8((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 128);
    }
    this.u8(rest);
  }

  /** LEB128, unsigned, for a value that fits in 64 bits. */
  varint64(value: bigint): void {
    let rest = value;
    while (rest >= 0x80n) {
      this.u8(Number(rest & 0x7fn) | 0x80);
      rest >>= 7n;
    }
    this.u8(Number(rest));
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buf.set(bytes, this.len);
    this.len += bytes.length;
  }

  fill(count: number): void {
    this.ensure(count);
    this.len += count;
  }

  patchU8(at: number, value: number): void {
    this.buf[at] = value & 0xff;
  }

  patchU16(at: number, value: number): void {
    this.buf[at] = value & 0xff;
    this.buf[at + 1] = (value >>> 8) & 0xff;
  }

  patchU32(at: number, value: number): void {
    this.buf[at] = value & 0xff;
    this.buf[at + 1] = (value >>> 8) & 0xff;
    this.buf[at + 2] = (value >>> 16) & 0xff;
    this.buf[at + 3] = (value >>> 24) & 0xff;
  }

  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

/** A cursor over untrusted bytes, which every read may exhaust. */
class ByteReader {
  readonly bytes: Uint8Array;
  pos: number;

  constructor(bytes: Uint8Array, start: number) {
    this.bytes = bytes;
    this.pos = start;
  }

  u8(): number {
    if (this.pos >= this.bytes.length) throw new Error(RANGE_TABLE_ERROR);
    const value = this.bytes[this.pos]!;
    this.pos += 1;
    return value;
  }

  u16(): number {
    return this.u8() | (this.u8() << 8);
  }

  u32(): number {
    return (this.u8() | (this.u8() << 8) | (this.u8() << 16) | (this.u8() << 24)) >>> 0;
  }

  /** LEB128, unsigned, 32-bit range, with a hard bound on the encoded length. */
  varint(): number {
    let value = 0;
    let shift = 1;
    for (let i = 0; i < MAX_U32_VARINT_BYTES; i++) {
      const byte = this.u8();
      value += (byte & 0x7f) * shift;
      if ((byte & 0x80) === 0) {
        if (value > MAX_U32) throw new Error(RANGE_TABLE_ERROR);
        return value;
      }
      shift *= 128;
    }
    throw new Error(RANGE_TABLE_ERROR);
  }

  /** LEB128, unsigned, 64-bit range, with a hard bound on the encoded length. */
  varint64(): bigint {
    let value = 0n;
    let shift = 1n;
    for (let i = 0; i < MAX_U64_VARINT_BYTES; i++) {
      const byte = this.u8();
      value += BigInt(byte & 0x7f) * shift;
      if ((byte & 0x80) === 0) {
        if (value > 0xffff_ffff_ffff_ffffn) throw new Error(RANGE_TABLE_ERROR);
        return value;
      }
      shift <<= 7n;
    }
    throw new Error(RANGE_TABLE_ERROR);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function fail(): never {
  throw new Error(RANGE_TABLE_ERROR);
}

/** The place string that means "no data" for a kind: `ZZ`, or empty for a city. */
export function unknownPlaceFor(kind: number): string {
  if (kind === KIND_COUNTRY) return 'ZZ';
  if (kind === KIND_CITY) return '';
  return fail();
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) value = (value << 8n) | BigInt(bytes[i]!);
  return value;
}

/** `YYYY-MM`, with a month of 0 legal so a fixture can carry `0000-00`. */
const MONTH_RE = /^\d{4}-\d{2}$/;

function checkMonth(month: string): void {
  if (!MONTH_RE.test(month)) fail();
  const m = Number(month.slice(5));
  if (m > 12) fail();
}

function checkPlace(place: string): void {
  // A newline inside a place would be indistinguishable from the place-table
  // separator on read, so one is refused rather than written. The empty place
  // is legal and means "unknown" for a city table.
  if (place.length > MAX_PLACE_LENGTH) fail();
  if (place.indexOf('\n') !== -1) fail();
}

// =============================================================================
// Normalisation, over COLUMNS
// =============================================================================
//
// One pass turns a family's typed-array columns into the total, gapless,
// merged run of ranges the container stores, and it does so WITHOUT holding a
// list of the result and without ever building a per-range object. The build
// script for the city tier streams 7.8 million rows into those columns; a
// normaliser that allocated one object per row would cost several hundred
// megabytes for a build that needs none of them (T-06-18).
//
// Three things happen, in this order, and the order is the argument:
//
//   1. MERGE. Overlaps are resolved (the earlier start wins, a later start with
//      a different place cuts the earlier range short) and adjacent ranges of
//      one place become one range. This has to happen BEFORE the gaps are
//      filled, or two rows that are really one range would be separated by an
//      unknown range of zero width.
//   2. FILL. The leading hole, every gap, and the trailing hole from the last
//      end to the top of the family get the EXPLICIT unknown place. After this
//      the run starts at address zero and is contiguous, which is the whole
//      reason the container stores starts and nothing else.
//   3. MERGE AGAIN. A fill that lands against a range already carrying the
//      unknown place is the one way step 1 can have left an adjacent pair.
//
// Steps 1 and 2 are fused into a single streaming walk with TWO pending runs —
// the row being merged and the row being emitted — because both of those
// steps only ever mutate the LAST run of their accumulator. That is what makes
// the streaming form byte-identical to accumulating the whole list and folding
// it at the end, which is the shape the country build used before columns
// existed.

/** One family, read through accessors so the two encodings share one algorithm. */
interface FamilyView {
  readonly count: number;
  start(i: number): bigint;
  end(i: number): bigint;
  /** The SORTED place id — see `resolvePlaces`, which is what every id is. */
  placeId(i: number): number;
}

/** The place table a build's ids are remapped onto, plus that remapping. */
interface ResolvedPlaces {
  /** Sorted, with the kind's unknown place present. */
  readonly places: string[];
  readonly unknownId: number;
  /** Caller place id -> sorted place id, indexed by the caller's own ids. */
  readonly sortedIdOf: Uint32Array;
}

/**
 * Sort and de-duplicate the caller's places and build the id remapping.
 *
 * The caller's ids may be in ANY order — a build script that streams a CSV
 * numbers places by first appearance — and the container stores them SORTED.
 * Sorting here rather than in the script is what makes the "place ids follow
 * the sorted key order" property a property of the WRITER rather than a
 * convention every caller has to remember, and it is the property that takes
 * the measured city container from 13.6 MB to 11.85 MB gzipped.
 *
 * The caller's ids index its own `places` array and nothing else; the unknown
 * place is contributed HERE, so a build script that only ever numbers the
 * places it actually saw still resolves every gap and the whole trailing hole.
 */
function resolvePlaces(callerPlaces: readonly string[], unknown: string): ResolvedPlaces {
  const distinct = new Set<string>([unknown]);
  for (const place of callerPlaces) {
    checkPlace(place);
    distinct.add(place);
  }
  const places = [...distinct].sort();
  const idOf = new Map<string, number>();
  for (let i = 0; i < places.length; i++) idOf.set(places[i]!, i);

  // The caller's ids index `places` EXACTLY: id 0 is the first place the
  // caller saw, not the unknown place. The unknown place is added to the
  // OUTPUT table (so every gap and the trailing hole resolve) but it takes no
  // id in the caller's numbering, which is what lets a build script number its
  // places by first appearance and nothing else.
  const sortedIdOf = new Uint32Array(callerPlaces.length);
  for (let i = 0; i < callerPlaces.length; i++) {
    const id = idOf.get(callerPlaces[i]!);
    if (id === undefined) fail();
    sortedIdOf[i] = id;
  }
  // `unknownId` is deliberately NOT written to the header: the reader derives
  // it by finding the kind's unknown place in the place table, so the id can
  // never disagree with the table it indexes.
  return { places, unknownId: idOf.get(unknown)!, sortedIdOf };
}

function remapId(id: number, sortedIdOf: Uint32Array): number {
  if (id < 0 || id >= sortedIdOf.length) fail();
  return sortedIdOf[id]!;
}

function makeV4View(columns: RangeColumns, sortedIdOf: Uint32Array): FamilyView {
  const count = columns.v4Starts.length;
  if (columns.v4Ends.length !== count || columns.v4Ids.length !== count) fail();
  return {
    count,
    start: (i) => BigInt(columns.v4Starts[i]!),
    end: (i) => BigInt(columns.v4Ends[i]!),
    placeId: (i) => remapId(columns.v4Ids[i]!, sortedIdOf),
  };
}

function makeV6View(columns: RangeColumns, sortedIdOf: Uint32Array): FamilyView {
  const count = columns.v6StartHi.length;
  if (
    columns.v6StartLo.length !== count ||
    columns.v6EndHi.length !== count ||
    columns.v6EndLo.length !== count ||
    columns.v6Ids.length !== count
  ) {
    fail();
  }
  return {
    count,
    start: (i) => (columns.v6StartHi[i]! << 64n) | columns.v6StartLo[i]!,
    end: (i) => (columns.v6EndHi[i]! << 64n) | columns.v6EndLo[i]!,
    placeId: (i) => remapId(columns.v6Ids[i]!, sortedIdOf),
  };
}

/**
 * A total order over ranges, so normalisation is deterministic.
 *
 * Start, then end, then place id: with start and end equal the only thing that
 * can differ is which of two overlapping rows wins, and answering that by the
 * place means the same source always produces the same bytes. A build that
 * produced a different table from identical input would make the committed
 * fixture untrustworthy.
 */
function compareRange(view: FamilyView, a: number, b: number): number {
  const alo = view.start(a);
  const blo = view.start(b);
  if (alo !== blo) return alo < blo ? -1 : 1;
  const ahi = view.end(a);
  const bhi = view.end(b);
  if (ahi !== bhi) return ahi < bhi ? -1 : 1;
  const aid = view.placeId(a);
  const bid = view.placeId(b);
  return aid === bid ? 0 : aid < bid ? -1 : 1;
}

/**
 * The source rows in ascending order, or null when they already are.
 *
 * Null is the fast path and it is the one real data takes: DB-IP publishes its
 * monthly files sorted, so detecting that in one pass costs 7.8 million
 * comparisons and the sort below never runs. It runs only for a source that is
 * genuinely out of order, where correctness beats speed — and there the index
 * array is the only allocation the whole normalisation makes.
 */
function sortedOrder(view: FamilyView): Uint32Array | null {
  const count = view.count;
  for (let i = 1; i < count; i++) {
    if (compareRange(view, i - 1, i) > 0) {
      const order = new Array<number>(count);
      for (let j = 0; j < count; j++) order[j] = j;
      order.sort((a, b) => compareRange(view, a, b));
      return Uint32Array.from(order);
    }
  }
  return null;
}

/**
 * Emit one family's normalised, gapless, contiguous run of ranges.
 *
 * Called twice by {@link encodeRangeTableColumns}: once to COUNT the runs, so
 * the output typed arrays can be allocated at exactly the right size, and once
 * to fill them. Two passes over typed arrays cost less than the transient
 * doubling a growable buffer would, and neither pass holds a result.
 *
 * `order` is the output of {@link sortedOrder}, or null for identity.
 */
function forEachNormalisedRun(
  view: FamilyView,
  unknownId: number,
  max: bigint,
  order: Uint32Array | null,
  emit: (lo: bigint, hi: bigint, id: number) => void,
): void {
  // The run being merged (step 1) and the run being emitted (steps 2 and 3).
  let mLo = 0n;
  let mHi = -1n;
  let mId = 0;
  let mHave = false;
  let aLo = 0n;
  let aHi = -1n;
  let aId = 0;
  let aHave = false;
  let cursor = 0n;

  /** Step 3: absorb an adjacent-or-overlapping run of the same place. */
  function feed(lo: bigint, hi: bigint, id: number): void {
    if (aHave && aId === id && lo <= aHi + 1n && hi > aHi) {
      aHi = hi;
      return;
    }
    if (aHave) emit(aLo, aHi, aId);
    aLo = lo;
    aHi = hi;
    aId = id;
    aHave = true;
  }

  /** Steps 2 and 3: the gap below this run, then the run itself. */
  function accept(lo: bigint, hi: bigint, id: number): void {
    if (lo > cursor) feed(cursor, lo - 1n, unknownId);
    feed(lo, hi, id);
    cursor = hi + 1n;
  }

  for (let k = 0; k < view.count; k++) {
    const i = order === null ? k : order[k]!;
    const lo = view.start(i);
    const hi = view.end(i);
    if (lo > hi) fail();
    const id = view.placeId(i);

    if (!mHave) {
      mLo = lo;
      mHi = hi;
      mId = id;
      mHave = true;
      continue;
    }
    if (lo <= mLo) {
      // Same start: the total order put the wider end (or the later place)
      // second, so this row replaces the pending one entirely.
      mLo = lo;
      mHi = hi;
      mId = id;
      continue;
    }
    if (lo <= mHi) {
      if (id === mId) {
        if (hi > mHi) mHi = hi;
        continue;
      }
      // A real overlap between two places. The earlier start keeps the part
      // below this row; the row keeps the rest. Neither is invented data —
      // the source said both.
      mHi = lo - 1n;
    } else if (id === mId && lo === mHi + 1n) {
      mHi = hi;
      continue;
    }
    accept(mLo, mHi, mId);
    mLo = lo;
    mHi = hi;
    mId = id;
  }
  if (mHave) accept(mLo, mHi, mId);
  // The trailing hole from the last end to the top of the family.
  if (cursor <= max) feed(cursor, max, unknownId);
  // The accumulator holds the newest run back so that a later run of the same
  // place can still absorb it; with no later run, it has to be handed over
  // here or the last row of the source and the whole trailing hole are lost.
  if (aHave) emit(aLo, aHi, aId);
}

function countRuns(
  view: FamilyView,
  unknownId: number,
  max: bigint,
  order: Uint32Array | null,
): number {
  let total = 0;
  forEachNormalisedRun(view, unknownId, max, order, () => {
    total += 1;
  });
  return total;
}

// =============================================================================
// Writer
// =============================================================================

/**
 * One source family as COLUMNS rather than as a list of objects.
 *
 * IPv4 is a start and an end in `Uint32Array`s; IPv6 is each of those as a
 * `(high 64, low 64)` `BigUint64Array` PAIR, because the low half is real data
 * and not a compression trick (419 of 348,712 country starts and 7,836 of
 * 4,166,430 city starts have a non-zero low half). Every family's ids index
 * the caller's `places`.
 *
 * The three (or five) arrays of a family must be the same length; a mismatch
 * is refused rather than padded, because a padded column would encode a
 * range whose other half was never read.
 */
export interface RangeColumns {
  readonly v4Starts: Uint32Array;
  readonly v4Ends: Uint32Array;
  readonly v4Ids: Uint32Array;
  readonly v6StartHi: BigUint64Array;
  readonly v6StartLo: BigUint64Array;
  readonly v6EndHi: BigUint64Array;
  readonly v6EndLo: BigUint64Array;
  readonly v6Ids: Uint32Array;
}

/**
 * The columnar encode's input: the same provenance as {@link EncodeOptions}
 * plus the places and the columns those places are numbered by.
 */
export interface ColumnarEncodeInput extends EncodeOptions {
  /**
   * The distinct place strings, in ANY order.
   *
   * The writer sorts them and remaps every id, so first-appearance order — the
   * only order a streaming build can produce — is a legal input and is what
   * makes the sorted, gzip-friendly numbering a property of the writer.
   */
  readonly places: readonly string[];
  readonly columns: RangeColumns;
}

/**
 * Build a table from columnar source ranges.
 *
 * The columnar twin of {@link encodeRangeTable}, and the one that carries the
 * real city dataset: 7.8 million rows in typed arrays, streamed, normalised
 * and encoded without a per-range object ever existing (T-06-18). The layout,
 * the normalisation and the resulting bytes are the same as the object
 * writer's — {@link encodeRangeTable} delegates here, which is what makes that
 * a checked fact rather than a promise.
 *
 * Deterministic for a given (columns, places, kind, month, fixture).
 * Throws {@link RANGE_TABLE_ERROR} for a malformed source, exactly as the
 * object writer does.
 */
export function encodeRangeTableColumns(input: ColumnarEncodeInput): Uint8Array {
  const unknown = unknownPlaceFor(input.kind);
  checkMonth(input.month);
  const resolved = resolvePlaces(input.places, unknown);

  const v4 = makeV4View(input.columns, resolved.sortedIdOf);
  const v6 = makeV6View(input.columns, resolved.sortedIdOf);

  const v4Max = BigInt(IPV4_MAX);
  const v4Order = sortedOrder(v4);
  const v4Count = countRuns(v4, resolved.unknownId, v4Max, v4Order);
  const v4Starts = new Uint32Array(v4Count);
  const v4Ids = new Uint32Array(v4Count);
  let v4At = 0;
  forEachNormalisedRun(v4, resolved.unknownId, v4Max, v4Order, (lo, _hi, id) => {
    v4Starts[v4At] = Number(lo);
    v4Ids[v4At] = id;
    v4At += 1;
  });

  const v6Order = sortedOrder(v6);
  const v6Count = countRuns(v6, resolved.unknownId, IPV6_MAX, v6Order);
  const v6Hi = new BigUint64Array(v6Count);
  const v6Lo = new BigUint64Array(v6Count);
  const v6Ids = new Uint32Array(v6Count);
  let v6At = 0;
  forEachNormalisedRun(v6, resolved.unknownId, IPV6_MAX, v6Order, (lo, _hi, id) => {
    v6Hi[v6At] = lo >> 64n;
    v6Lo[v6At] = lo & 0xffff_ffff_ffff_ffffn;
    v6Ids[v6At] = id;
    v6At += 1;
  });

  return writeTable(input, resolved.places, v4Starts, v4Ids, v6Hi, v6Lo, v6Ids);
}

/**
 * Build a table from a list of source ranges.
 *
 * The result is deterministic for a given (ranges, kind, month, fixture): the
 * same source always produces the same bytes, which is what lets a test assert
 * that the committed fixture table equals a fresh encode of the committed
 * fixture CSV.
 *
 * Never throws for a well-formed source and a well-formed month. A malformed
 * source (a range whose end precedes its start, a mixed family, a place
 * holding a newline) throws {@link RANGE_TABLE_ERROR} rather than writing a
 * table that would decode into something else.
 *
 * Thin by design: the work is {@link encodeRangeTableColumns}, and this only
 * shapes the objects into columns.
 */
export function encodeRangeTable(
  ranges: readonly RangeInput[],
  options: EncodeOptions,
): Uint8Array {
  checkMonth(options.month);

  let v4Count = 0;
  let v6Count = 0;
  for (const row of ranges) {
    checkPlace(row.place);
    if (row.start.family !== row.end.family) fail();
    if (bytesToBigInt(row.start.bytes) > bytesToBigInt(row.end.bytes)) fail();
    if (row.start.family === 4) v4Count += 1;
    else v6Count += 1;
  }

  const v4Starts = new Uint32Array(v4Count);
  const v4Ends = new Uint32Array(v4Count);
  const v4Ids = new Uint32Array(v4Count);
  const v6StartHi = new BigUint64Array(v6Count);
  const v6StartLo = new BigUint64Array(v6Count);
  const v6EndHi = new BigUint64Array(v6Count);
  const v6EndLo = new BigUint64Array(v6Count);
  const v6Ids = new Uint32Array(v6Count);

  // The places are numbered by FIRST APPEARANCE, which is the only order a
  // forward pass can produce; `encodeRangeTableColumns` sorts them. A repeat
  // of a place already seen has to be LOOKED UP rather than numbered from the
  // list's length: a list's length is the id of its newest entry, and handing
  // that to a repeated place silently renames it to whatever was last added.
  const places: string[] = [];
  const callerIds = new Map<string, number>();
  let v4At = 0;
  let v6At = 0;
  for (const row of ranges) {
    let id = callerIds.get(row.place);
    if (id === undefined) {
      id = places.length;
      places.push(row.place);
      callerIds.set(row.place, id);
    }
    const lo = bytesToBigInt(row.start.bytes);
    const hi = bytesToBigInt(row.end.bytes);
    if (row.start.family === 4) {
      v4Starts[v4At] = Number(lo);
      v4Ends[v4At] = Number(hi);
      v4Ids[v4At] = id;
      v4At += 1;
    } else {
      v6StartHi[v6At] = lo >> 64n;
      v6StartLo[v6At] = lo & LOW64;
      v6EndHi[v6At] = hi >> 64n;
      v6EndLo[v6At] = hi & LOW64;
      v6Ids[v6At] = id;
      v6At += 1;
    }
  }

  return encodeRangeTableColumns({
    kind: options.kind,
    month: options.month,
    fixture: options.fixture,
    places,
    columns: { v4Starts, v4Ends, v4Ids, v6StartHi, v6StartLo, v6EndHi, v6EndLo, v6Ids },
  });
}

/** The header and the five planes, once both callers have their columns. */
function writeTable(
  options: EncodeOptions,
  places: readonly string[],
  v4Starts: Uint32Array,
  v4Ids: Uint32Array,
  v6Hi: BigUint64Array,
  v6Lo: BigUint64Array,
  v6Ids: Uint32Array,
): Uint8Array {
  // The header is reserved first and patched in place, so its width is one
  // constant rather than a sequence of appends whose order the reader would
  // have to mirror.
  const writer = new ByteWriter();
  writer.fill(RANGE_TABLE_HEADER_BYTES);
  for (let i = 0; i < MAGIC.length; i++) writer.patchU8(OFF_MAGIC + i, MAGIC[i]!);
  writer.patchU8(OFF_VERSION, RANGE_TABLE_VERSION);
  writer.patchU8(OFF_KIND, options.kind);
  writer.patchU8(OFF_FLAGS, options.fixture ? FLAG_FIXTURE : 0);
  writer.patchU8(OFF_RESERVED_A, 0);
  writer.patchU16(OFF_YEAR, Number(options.month.slice(0, 4)));
  writer.patchU8(OFF_MONTH, Number(options.month.slice(5)));
  writer.patchU8(OFF_RESERVED_B, 0);
  writer.patchU32(OFF_PLACE_COUNT, places.length);
  writer.patchU32(OFF_V4_COUNT, v4Starts.length);
  writer.patchU32(OFF_V6_COUNT, v6Hi.length);

  const placeEncoded = utf8Encode(places.join('\n'));
  writer.patchU32(OFF_PLACE_BYTES, placeEncoded.length);
  writer.raw(placeEncoded);

  // The IPv4 section. The first start is written absolute (the delta against an
  // imaginary start at address zero), and normalisation guarantees it IS zero,
  // so a well-formed table's first byte of this plane is a bare 0.
  let previousV4 = 0;
  for (let i = 0; i < v4Starts.length; i++) {
    const start = v4Starts[i]!;
    writer.varint(start - previousV4);
    previousV4 = start;
  }
  for (let i = 0; i < v4Ids.length; i++) writer.varint(v4Ids[i]!);

  // The IPv6 section, EXACT (RESEARCH Evidence: 419 of 348,712 real starts have
  // a non-zero low half, and a high-64-only key collapses 298 country ranges).
  let previousHi = 0n;
  for (let i = 0; i < v6Hi.length; i++) {
    const hi = v6Hi[i]!;
    writer.varint64(hi - previousHi);
    previousHi = hi;
  }
  for (let i = 0; i < v6Lo.length; i++) writer.varint64(v6Lo[i]!);
  for (let i = 0; i < v6Ids.length; i++) writer.varint(v6Ids[i]!);

  return writer.toUint8Array();
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

function utf8Encode(text: string): Uint8Array {
  return textEncoder.encode(text);
}

// =============================================================================
// Reader
// =============================================================================

function readTable(bytes: Uint8Array, families: DecodeFamilies | undefined): RangeTable {
  // The cap is chosen BY the kind byte, so the only read before the cap is the
  // byte that decides the cap. `unknownPlaceFor` below refuses a kind this
  // module does not know, and an unknown kind gets the country cap — the
  // stricter of the two.
  if (bytes.length < RANGE_TABLE_HEADER_BYTES) fail();
  const kind = bytes[OFF_KIND]!;
  if (bytes.length > (kind === KIND_CITY ? MAX_CITY_TABLE_BYTES : MAX_RANGE_TABLE_BYTES)) fail();

  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[OFF_MAGIC + i] !== MAGIC[i]) fail();
  }
  if (bytes[OFF_VERSION] !== RANGE_TABLE_VERSION) fail();

  const unknown = unknownPlaceFor(kind);

  const flags = bytes[OFF_FLAGS]!;
  if ((flags & RESERVED_BITS) !== 0) fail();
  if (bytes[OFF_RESERVED_A] !== 0 || bytes[OFF_RESERVED_B] !== 0) fail();

  const year = bytes[OFF_YEAR]! | (bytes[OFF_YEAR + 1]! << 8);
  const month = bytes[OFF_MONTH]!;
  if (year > 9999 || month > 12) fail();

  const placeCount = u32At(bytes, OFF_PLACE_COUNT);
  const v4Count = u32At(bytes, OFF_V4_COUNT);
  const v6Count = u32At(bytes, OFF_V6_COUNT);
  const placeBytes = u32At(bytes, OFF_PLACE_BYTES);

  if (placeCount < 1 || placeCount > MAX_RANGE_TABLE_PLACES) fail();
  if (v4Count > MAX_RANGE_TABLE_RANGES || v6Count > MAX_RANGE_TABLE_RANGES) fail();
  if (RANGE_TABLE_HEADER_BYTES + placeBytes > bytes.length) fail();

  // Every range costs at least one byte per plane: a start and an id for IPv4,
  // a high half, a low half and an id for IPv6. A header claiming more ranges
  // than the remaining bytes could encode is refused BEFORE the planes below
  // are allocated, so a few dozen bytes cannot ask for hundreds of megabytes.
  const minPlaneBytes = v4Count * 2 + v6Count * 3;
  if (RANGE_TABLE_HEADER_BYTES + placeBytes + minPlaneBytes > bytes.length) fail();

  const places = decodePlaces(bytes, placeBytes, placeCount);
  const unknownId = places.indexOf(unknown);
  if (unknownId === -1) fail();

  // A skipped family is PARSED AND VALIDATED and only not MATERIALISED: see
  // {@link DecodeFamilies} for why that distinction is the point.
  const wantV4 = families === undefined || families.ipv4;
  const wantV6 = families === undefined || families.ipv6;

  const reader = new ByteReader(bytes, RANGE_TABLE_HEADER_BYTES + placeBytes);

  const v4Starts = new Uint32Array(wantV4 ? v4Count : 0);
  const v4Ids = new Uint32Array(wantV4 ? v4Count : 0);
  // The first delta is ABSOLUTE — measured against an imaginary start at
  // address zero — so the running value begins at zero and the strict
  // increase is a property of the SECOND entry onward. Seeding the cursor at
  // -1 instead would make the first start one less than it says.
  let v4Previous = 0;
  for (let i = 0; i < v4Count; i++) {
    const start = v4Previous + reader.varint();
    if (start > MAX_U32) fail();
    if (i > 0 && start <= v4Previous) fail();
    if (wantV4) v4Starts[i] = start;
    v4Previous = start;
  }
  for (let i = 0; i < v4Count; i++) {
    const id = readId(reader, placeCount);
    if (wantV4) v4Ids[i] = id;
  }

  const v6Hi = new BigUint64Array(wantV6 ? v6Count : 0);
  const v6Lo = new BigUint64Array(wantV6 ? v6Count : 0);
  const v6Ids = new Uint32Array(wantV6 ? v6Count : 0);
  // Same absolute-first-delta shape as the IPv4 section, and for the same
  // reason: the high plane is a delta chain, and the first link is against
  // zero rather than against a previous entry.
  //
  // The high plane is only required to be NON-DECREASING, never strictly
  // increasing. Two ranges can share a high half and differ only in the low
  // one — the straddling-/64 case the whole low plane exists for — and a
  // delta of zero between them is the correct encoding, not a corruption. The
  // strict increase is a property of the PAIR, checked below.
  let previousHi = 0n;
  // One byte per entry, for the "this high half repeats the previous one"
  // fact, which the pair check below needs and which only the low plane can
  // resolve. It is 4.2 MB on the real city table against 66 MB for the two
  // `BigUint64Array`s it replaces when IPv6 is skipped, and it is allocated
  // either way so the check is one code path rather than two.
  const hiRepeated = new Uint8Array(v6Count);
  for (let i = 0; i < v6Count; i++) {
    const hi = previousHi + reader.varint64();
    if (i > 0 && hi < previousHi) fail();
    if (i > 0 && hi === previousHi) hiRepeated[i] = 1;
    if (wantV6) v6Hi[i] = hi;
    previousHi = hi;
  }
  let previousLo = 0n;
  for (let i = 0; i < v6Count; i++) {
    const lo = reader.varint64();
    // The pair is the key, so the pair is what must be strictly increasing: a
    // high plane that repeats while the low plane grows is a legal encoding of
    // the high plane on its own and an illegal table in this one.
    if (i > 0 && hiRepeated[i] === 1 && lo <= previousLo) fail();
    if (wantV6) v6Lo[i] = lo;
    previousLo = lo;
  }
  for (let i = 0; i < v6Count; i++) {
    const id = readId(reader, placeCount);
    if (wantV6) v6Ids[i] = id;
  }

  // Every plane was exactly the count it declared, so the cursor must now sit
  // on the last byte. A header whose counts do not agree with the section
  // lengths is caught here and nowhere else needs to guess.
  if (reader.pos !== bytes.length) fail();

  return {
    kind,
    month: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
    fixture: (flags & FLAG_FIXTURE) !== 0,
    places,
    unknownId,
    v4Starts,
    v4Ids,
    v6Hi,
    v6Lo,
    v6Ids,
  };
}

function u32At(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
  );
}

function readId(reader: ByteReader, placeCount: number): number {
  const id = reader.varint();
  if (id >= placeCount) fail();
  return id;
}

/**
 * Read the place table and require it to hold EXACTLY the declared number of
 * places.
 *
 * The count is the check that matters: a place table whose separators do not
 * line up with the header would otherwise silently shift every id by one, and
 * a shifted id is a country table that answers confidently and wrongly.
 *
 * `fatal: true` is what makes a byte sequence that is not valid UTF-8 a
 * failure here rather than a replacement-character place string.
 */
function decodePlaces(bytes: Uint8Array, placeBytes: number, placeCount: number): string[] {
  const section = bytes.subarray(RANGE_TABLE_HEADER_BYTES, RANGE_TABLE_HEADER_BYTES + placeBytes);
  // Count the separators BEFORE the text is decoded and split. `split('\n')`
  // allocates one string per line, so a section of nothing but newlines would
  // become a multi-million-element array before the count check below could
  // refuse it. 0x0a never occurs inside a multi-byte UTF-8 sequence, so a byte
  // count is the same count the split would see. A trailing newline is the
  // terminator of the last place, not a separator.
  let newlines = 0;
  for (let i = 0; i < section.length; i++) if (section[i] === 0x0a) newlines++;
  const terminated = section.length > 0 && section[section.length - 1] === 0x0a;
  if ((terminated ? newlines : newlines + 1) !== placeCount) fail();

  let text: string;
  try {
    text = textDecoder.decode(section);
  } catch {
    return fail();
  }
  const body = text.length > 0 && text.endsWith('\n') ? text.slice(0, -1) : text;
  const places = body.split('\n');
  if (places.length !== placeCount) fail();
  for (const place of places) {
    if (place.length > MAX_PLACE_LENGTH) fail();
  }
  return places;
}

/**
 * Decode a table from bytes that are not to be trusted (T-06-16).
 *
 * Every rejection path throws the same {@link RANGE_TABLE_ERROR}, and the
 * catch below is what makes that a structural guarantee rather than a
 * convention: an unexpected failure inside the reader is normalised into the
 * same text, so a caller can match one string and no other.
 *
 * The returned arrays are freshly allocated, so two decoded tables never share
 * a buffer and a caller can hold the country table and a city table at once.
 *
 * `families` (T-06-34) leaves the arrays of a family EMPTY while still parsing
 * and validating its bytes; see {@link DecodeFamilies}.
 */
export function decodeRangeTable(bytes: Uint8Array, families?: DecodeFamilies): RangeTable {
  try {
    return readTable(bytes, families);
  } catch {
    return fail();
  }
}

// =============================================================================
// Lookup
// =============================================================================

/**
 * The place id of the last IPv4 range whose start is at or below `addr`, or -1.
 *
 * A predecessor search over a `Uint32Array`: eleven comparisons for 362,122
 * ranges, which is why the table can be looked up once per DISTINCT address at
 * import time (D-12) without the worker noticing.
 *
 * -1 is only reachable for a table with no IPv4 section or a caller addressing
 * below the first start; a table written by {@link encodeRangeTable} starts at
 * address zero, so every address resolves.
 */
export function lookupV4(table: RangeTable, addr: number): number {
  const starts = table.v4Starts;
  const last = starts.length - 1;
  if (last < 0 || addr < starts[0]!) return -1;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (starts[mid]! <= addr) lo = mid;
    else hi = mid - 1;
  }
  return table.v4Ids[lo]!;
}

/**
 * The place id of the last IPv6 range whose start is at or below `(hi, lo)`, or -1.
 *
 * The comparison is lexicographic over the PAIR, and the low plane is a real
 * `BigUint64Array` rather than a widened 32-bit split: RESEARCH measured the
 * two within a few milliseconds over 3.8 M entries, so the exact comparison is
 * the cheaper decision in code, in review and in tests.
 */
export function lookupV6(table: RangeTable, hi: bigint, lo: bigint): number {
  const startsHi = table.v6Hi;
  const startsLo = table.v6Lo;
  const last = startsHi.length - 1;
  if (last < 0) return -1;
  if (startsHi[0]! > hi || (startsHi[0] === hi && startsLo[0]! > lo)) return -1;
  let low = 0;
  let high = last;
  while (low < high) {
    const mid = (low + high + 1) >>> 1;
    const midHi = startsHi[mid]!;
    if (midHi < hi || (midHi === hi && startsLo[mid]! <= lo)) low = mid;
    else high = mid - 1;
  }
  return table.v6Ids[low]!;
}

/**
 * The place id for one already-parsed address, or -1 when its family is absent.
 *
 * An IPv4-mapped IPv6 address is resolved through the IPv4 section with
 * {@link mappedIpv4}, which is the only reason that function exists: the
 * address is STORED as the 128-bit row the export wrote, and asked about as
 * the 32-bit value the country table is built from. A plain IPv6 address is
 * read as its sixteen octets, high half first.
 *
 * Pure and total: no branch here can throw, and every address in a table with
 * both sections resolves.
 */
export function lookupIp(table: RangeTable, ip: ParsedIp): number {
  if (ip.family === 4) return lookupV4(table, ipv4Number(ip.bytes));
  const mapped = mappedIpv4(ip);
  if (mapped !== null) return lookupV4(table, ipv4Number(mapped.bytes));
  let hi = 0n;
  let lo = 0n;
  for (let i = 0; i < 8; i++) hi = (hi << 8n) | BigInt(ip.bytes[i]!);
  for (let i = 8; i < 16; i++) lo = (lo << 8n) | BigInt(ip.bytes[i]!);
  return lookupV6(table, hi, lo);
}

/** Four octets to one unsigned 32-bit number, big-endian. */
function ipv4Number(bytes: Uint8Array): number {
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
}
