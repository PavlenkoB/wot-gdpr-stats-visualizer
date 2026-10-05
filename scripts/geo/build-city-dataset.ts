/**
 * Build the opt-in city range table from a DB-IP city CSV (phase 06,
 * ACTIVITY-07, plan 06-09, D-13, D-14, D-15, T-06-17, T-06-18, RESEARCH
 * Pattern 9, Pitfall 16, Pitfall 21).
 *
 * ## What this produces, and why it is NOT committed
 *
 * One gzipped container plus a manifest `{ file, bytes, month, sha256,
 * source }`, written under `public/geo-city-data/` — a path the repository
 * already gitignores, because the real output is about 11.85 MB gzipped
 * (42.8 MB raw) of a licensed dataset nobody chose to commit. Phase 7's deploy
 * job runs the real generation with a cache keyed on the DB-IP month and ships
 * the result in the Pages artifact. The dev-time and PR path is `--fixture`,
 * which writes a few-hundred-byte container built from documentation ranges
 * into `tests/fixtures/geo/`, and those two files ARE committed — named so
 * they match none of the city gitignore patterns, which is what keeps
 * `git check-ignore` silent and the fixture honest.
 *
 * ## Why ONE file and not shards (D-13, RESEARCH "route-fulfil e2e design")
 *
 * Shards would make the browser request only the shards it needs, and the
 * request URLs are built from the account's own addresses — so a sharded load
 * would tell the static host which IP prefixes the account used, before the
 * user has seen a single city. One file is the shape that leaks nothing: the
 * only request a viewer can see is for the whole dataset, or for none of it.
 *
 * ## Why the input is STREAMED and never materialised (T-06-18)
 *
 * The real CSV is 693 MB raw / 85.8 MB gzipped with 7.8 million rows. The
 * script reads it line by line through `readline` and pushes each row into
 * growing typed-array columns; the peak cost is those columns and the
 * container, not the text and not a list of seven million objects. The gzip is
 * detected from the first two BYTES rather than from the extension, for the
 * same reason the country script does it: a hermetic fixture ships the same
 * bytes under a different name, and a wrong answer from a name is a
 * decompression error a long way from its cause.
 *
 * ## Why it runs as a plain Node `.ts` file
 *
 * `node scripts/geo/build-city-dataset.ts` uses native type stripping, so
 * there is no build step for the build step. That only works while the file
 * stays ERASABLE — no `enum`, no `namespace`, no constructor parameter
 * property, no decorators — which `erasableSyntaxOnly` in
 * `tsconfig.node.json` keeps honest.
 *
 * ## What it prints
 *
 * Exactly one line, carrying everything needed to decide whether a regenerated
 * asset is the asset that shipped: the month, the source (a URL or a path), the
 * range count per family, the places, how many lines were skipped, the
 * container and gzipped sizes, the wall time, and the sha256 of the bytes a
 * browser will actually download (T-06-17 — a derived artifact that nobody
 * can check is not reviewable).
 */

import { createHash } from 'node:crypto';
import { open, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { createGunzip, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

import {
  KIND_CITY,
  encodeRangeTableColumns,
  type RangeColumns,
} from '../../src/lib/geo/range-table.ts';
import { parseCityLine } from './lib/csv-ranges.ts';
import { downloadToFile, headStatus, resolveDbipUrl } from './lib/download.ts';
// The same sniffer the country build uses, imported rather than copied. The
// module's `main()` is behind the `import.meta.url` guard, so importing it
// runs no build.
import { isGzip } from './build-country-table.ts';

/** Where a real build writes, and the name its manifest points at. */
const DEFAULT_OUT_DIR = 'public/geo-city-data';

/** The committed fixture's inputs and outputs, all four by path. */
const FIXTURE_CSV = 'tests/fixtures/geo/city-fixture.csv';
const FIXTURE_OUT_DIR = 'tests/fixtures/geo';
const FIXTURE_FILE = 'city-fixture.gz';
const FIXTURE_MANIFEST = 'city-fixture-manifest.json';
/** The name the URL will carry. Deliberately NOT the committed name. */
const FIXTURE_ASSET_NAME = 'city-fixture.citydb.bin';
/** The fixture marker month, so a fixture is never mistaken for a real one. */
const FIXTURE_MONTH = '0000-00';

interface Options {
  fixture: boolean;
  csv: string | null;
  download: boolean;
  month: string | null;
  outDir: string;
}

/** Parse the flags. Unknown flags are an error rather than a silent no-op. */
export function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    fixture: false,
    csv: null,
    download: false,
    month: null,
    outDir: DEFAULT_OUT_DIR,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      // pnpm 12 forwards the separator literally, so the GNU convention is
      // honoured here rather than left to fail as an unknown flag.
      case '--':
        break;
      case '--fixture':
        options.fixture = true;
        break;
      case '--download':
        options.download = true;
        break;
      case '--csv':
        options.csv = argv[++i] ?? null;
        if (options.csv === null) usage('--csv needs a path');
        break;
      case '--month':
        options.month = argv[++i] ?? null;
        if (options.month === null) usage('--month needs YYYY-MM');
        break;
      case '--out-dir':
        options.outDir = argv[++i] ?? null;
        if (options.outDir === null) usage('--out-dir needs a path');
        break;
      default:
        usage(`unknown flag: ${arg}`);
    }
  }
  if (options.fixture && options.download) {
    // A downloaded file is real, licensed data; stamping it as a fixture would
    // write ~42 MB of it into the committed fixture path under a fixture label.
    usage('--fixture marks a table as test data; a downloaded file is not');
  }
  if (options.fixture) {
    // Fixture mode is a fixed, named shape: the CSV, the month marker and the
    // two committed outputs. Taking any of them from the command line would
    // make "regenerate the fixture" mean something different per invocation,
    // and the fixture's whole value is that one command reproduces it.
    if (options.csv !== null) usage('--fixture reads the committed fixture CSV; drop --csv');
    if (options.month !== null) usage('--fixture is stamped 0000-00; drop --month');
    if (options.outDir !== DEFAULT_OUT_DIR)
      usage('--fixture writes to tests/fixtures/geo; drop --out-dir');
    options.csv = FIXTURE_CSV;
    options.month = FIXTURE_MONTH;
    options.outDir = FIXTURE_OUT_DIR;
  } else if (options.download) {
    // Exactly one source. A build that took both would have two answers to
    // which month's data it is.
    if (options.csv !== null) usage('give either --csv or --download, not both');
    // The month is FORBIDDEN with --download: the resolution already knows it,
    // and a --month that was quietly ignored would label the asset with a
    // month it does not hold.
    if (options.month !== null) usage('--download records the month it resolved; drop --month');
  } else if (options.csv === null || options.month === null) {
    usage('give --csv <path> --month YYYY-MM, --download, or --fixture');
  }
  return options;
}

function usage(problem: string): never {
  process.stderr.write(
    [
      'build-city-dataset: ' + problem,
      '',
      'Usage:',
      '  node scripts/geo/build-city-dataset.ts --csv <path> --month YYYY-MM [--out-dir <dir>]',
      '  node scripts/geo/build-city-dataset.ts --download [--out-dir <dir>]',
      '  node scripts/geo/build-city-dataset.ts --fixture',
      '',
      'The CSV may be plain or gzipped; which one it is comes from its first two bytes.',
      'The month is recorded in the container header, so a --csv build must say which source month it read.',
      '--download resolves the current UTC month from download.db-ip.com and falls back one month on a 404.',
      '--fixture rebuilds the committed container and manifest from the committed fixture CSV.',
    ].join('\n') + '\n',
  );
  process.exit(2);
}

/**
 * The streaming columns a row is pushed into, doubling as they fill.
 *
 * One class rather than eight growable arrays, because the growth is the only
 * state that has to stay consistent: every plane of a family grows in lockstep
 * and a family that grew its id plane but not its start plane would encode a
 * range whose other half was never read.
 *
 * Doubling is deliberate over growing by a constant: 7.8 million rows at a
 * constant 65536 would be 119 reallocations, and each one copies the whole
 * column. At doubling there are 24.
 */
class CityColumns {
  v4Starts = new Uint32Array(0);
  v4Ends = new Uint32Array(0);
  v4Ids = new Uint32Array(0);
  v4Count = 0;
  v6StartHi = new BigUint64Array(0);
  v6StartLo = new BigUint64Array(0);
  v6EndHi = new BigUint64Array(0);
  v6EndLo = new BigUint64Array(0);
  v6Ids = new Uint32Array(0);
  v6Count = 0;

  private static readonly FIRST = 1 << 16;

  push4(start: number, end: number, id: number): void {
    if (this.v4Count === this.v4Starts.length) this.grow4();
    this.v4Starts[this.v4Count] = start;
    this.v4Ends[this.v4Count] = end;
    this.v4Ids[this.v4Count] = id;
    this.v4Count += 1;
  }

  push6(startHi: bigint, startLo: bigint, endHi: bigint, endLo: bigint, id: number): void {
    if (this.v6Count === this.v6StartHi.length) this.grow6();
    this.v6StartHi[this.v6Count] = startHi;
    this.v6StartLo[this.v6Count] = startLo;
    this.v6EndHi[this.v6Count] = endHi;
    this.v6EndLo[this.v6Count] = endLo;
    this.v6Ids[this.v6Count] = id;
    this.v6Count += 1;
  }

  /** Only the first `count` entries are ever read, so the tails are not copied. */
  columns(): RangeColumns {
    return {
      v4Starts: this.v4Starts.subarray(0, this.v4Count),
      v4Ends: this.v4Ends.subarray(0, this.v4Count),
      v4Ids: this.v4Ids.subarray(0, this.v4Count),
      v6StartHi: this.v6StartHi.subarray(0, this.v6Count),
      v6StartLo: this.v6StartLo.subarray(0, this.v6Count),
      v6EndHi: this.v6EndHi.subarray(0, this.v6Count),
      v6EndLo: this.v6EndLo.subarray(0, this.v6Count),
      v6Ids: this.v6Ids.subarray(0, this.v6Count),
    };
  }

  private grow4(): void {
    const size = this.v4Starts.length === 0 ? CityColumns.FIRST : this.v4Starts.length * 2;
    const starts = new Uint32Array(size);
    const ends = new Uint32Array(size);
    const ids = new Uint32Array(size);
    starts.set(this.v4Starts);
    ends.set(this.v4Ends);
    ids.set(this.v4Ids);
    this.v4Starts = starts;
    this.v4Ends = ends;
    this.v4Ids = ids;
  }

  private grow6(): void {
    const size = this.v6StartHi.length === 0 ? CityColumns.FIRST : this.v6StartHi.length * 2;
    const startHi = new BigUint64Array(size);
    const startLo = new BigUint64Array(size);
    const endHi = new BigUint64Array(size);
    const endLo = new BigUint64Array(size);
    const ids = new Uint32Array(size);
    startHi.set(this.v6StartHi);
    startLo.set(this.v6StartLo);
    endHi.set(this.v6EndHi);
    endLo.set(this.v6EndLo);
    ids.set(this.v6Ids);
    this.v6StartHi = startHi;
    this.v6StartLo = startLo;
    this.v6EndHi = endHi;
    this.v6EndLo = endLo;
    this.v6Ids = ids;
  }
}

/** The 128-bit value a parsed address carries, split into the two planes. */
function halves(bytes: Uint8Array): { hi: bigint; lo: bigint } {
  let hi = 0n;
  let lo = 0n;
  for (let i = 0; i < 8; i++) hi = (hi << 8n) | BigInt(bytes[i]!);
  for (let i = 8; i < 16; i++) lo = (lo << 8n) | BigInt(bytes[i]!);
  return { hi, lo };
}

/** The 32-bit value a parsed IPv4 address carries. */
function quad(bytes: Uint8Array): number {
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
}

/** What one streamed pass produced, and what it had to skip on the way. */
interface Collected {
  columns: CityColumns;
  places: string[];
  skipped: number;
  v4: number;
  v6: number;
}

/**
 * Stream a city CSV into the columns, line by line.
 *
 * The places are numbered by FIRST APPEARANCE — the only order a forward pass
 * can produce — and `encodeRangeTableColumns` sorts them and renumbers, which
 * is the property that takes the real container from 13.6 MB to 11.85 MB
 * gzipped. Nothing here ever sees a whole row set: a row lives in one typed
 * array cell and is gone on the next iteration.
 */
async function readCity(filePath: string): Promise<Collected> {
  const gzipped = await isGzip(filePath);
  const handle = await open(filePath, 'r');
  const columns = new CityColumns();
  const places: string[] = [];
  const placeIds = new Map<string, number>();
  let skipped = 0;
  let v4 = 0;
  let v6 = 0;
  try {
    // The WHOLE file goes to the gunzip, magic bytes included: a gzip member
    // begins with its own 10-byte header, so stripping the first two bytes
    // asks zlib to parse a header out of deflate data and fails.
    const source = handle.createReadStream();
    const input = gzipped ? source.pipe(createGunzip()) : source;
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      const row = parseCityLine(line);
      if (row === null) {
        skipped += 1;
        continue;
      }
      let id = placeIds.get(row.place);
      if (id === undefined) {
        id = places.length;
        places.push(row.place);
        placeIds.set(row.place, id);
      }
      if (row.start.family === 4) {
        columns.push4(quad(row.start.bytes), quad(row.end.bytes), id);
        v4 += 1;
      } else {
        const from = halves(row.start.bytes);
        const to = halves(row.end.bytes);
        columns.push6(from.hi, from.lo, to.hi, to.lo, id);
        v6 += 1;
      }
    }
  } finally {
    await handle.close();
  }
  return { columns, places, skipped, v4, v6 };
}

/** What a completed build wrote, for the one summary line and the manifest. */
interface Manifest {
  file: string;
  bytes: number;
  month: string;
  sha256: string;
  source: 'dbip' | 'fixture';
}

/**
 * The DB-IP licence note, written beside every real asset (RESEARCH A8).
 *
 * CC BY 4.0 asks for attribution and a link to the licence; DB-IP's own
 * instruction is a visible "IP Geolocation by DB-IP" link-back. A binary the
 * repository ships with neither beside it is a licence problem the repository
 * caused, and the note is written BY THE BUILD rather than kept by hand for
 * exactly the reason the container is: a file nobody regenerates is a file that
 * goes stale, and a stale licence file is worse than none because it looks
 * current.
 *
 * The month is IN the note, because the thing a reader needs to check is
 * whether the data beside it is this month's.
 */
function attribution(month: string): string {
  return [
    'IP Geolocation by DB-IP',
    '',
    `Source month: ${month}`,
    'Source: https://download.db-ip.com/free/dbip-city-lite-' + month + '.csv.gz',
    'Data: https://db-ip.com',
    `Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)`,
    'Licence text: https://creativecommons.org/licenses/by/4.0/',
    '',
    `Derived file: city-${month}.citydb.bin (a compacted, gzipped range table).`,
    'The derived file is a transformation of the data above and is distributed',
    'under the same terms.',
    '',
  ].join('\n');
}

async function main(argv: readonly string[]): Promise<void> {
  const started = Date.now();
  const options = parseArgs(argv);

  // The download lands in a temp file, not in the working tree, and is deleted
  // below whether or not the build succeeds: an 86 MB CSV left in the
  // repository is both untracked noise and a copy of a licensed dataset nobody
  // chose to commit. Same rule as the country build.
  let csvPath = options.csv;
  let source: string = options.csv ?? '';
  let month = options.month ?? '';
  let sourceBytes = 0;
  let sourceSha256 = '';
  let tempPath: string | null = null;

  if (options.download) {
    const resolved = await resolveDbipUrl('city', new Date(), headStatus);
    tempPath = path.join(tmpdir(), `dbip-city-lite-${resolved.month}-${process.pid}.csv.gz`);
    const result = await downloadToFile(resolved.url, tempPath);
    csvPath = tempPath;
    source = resolved.url;
    month = resolved.month;
    sourceBytes = result.bytes;
    sourceSha256 = result.sha256;
  }

  try {
    const collected = await readCity(csvPath!);
    const container = encodeRangeTableColumns({
      kind: KIND_CITY,
      month,
      fixture: options.fixture,
      places: collected.places,
      columns: collected.columns.columns(),
    });

    // Pre-gzipped, level 9, because whether GitHub Pages compresses an
    // `application/octet-stream` response is unknown (RESEARCH A1). The browser
    // sniffs the magic bytes, so a host that DOES re-encode simply hands it an
    // already-plain body and the same code path handles it.
    const gzipped = gzipSync(container, { level: 9 });
    // The committed fixture is `.gz` and the real asset is `.citydb.bin`, which
    // the repository gitignores — the whole reason the fixture is renamed
    // rather than given the production name.
    // The name is computed ONCE and used twice: the file on disk and the `file`
    // the manifest points the URL at. They are the same string by definition —
    // a manifest naming a different file than the one beside it is a build that
    // shipped an asset nothing can fetch.
    const assetName = `city-${month}.citydb.bin`;
    const file = options.fixture ? FIXTURE_FILE : assetName;
    const manifest: Manifest = {
      file: options.fixture ? FIXTURE_ASSET_NAME : assetName,
      bytes: gzipped.length,
      month,
      sha256: createHash('sha256').update(gzipped).digest('hex'),
      source: options.fixture ? 'fixture' : 'dbip',
    };

    await mkdir(options.outDir, { recursive: true });
    await writeFile(path.join(options.outDir, file), gzipped);
    const manifestPath = options.fixture ? FIXTURE_MANIFEST : 'manifest.json';
    await writeFile(
      path.join(options.outDir, manifestPath),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    // Fixture mode writes NO note: the fixture is documentation ranges, not
    // anyone's data, and a licence note beside it would be a false claim.
    if (!options.fixture) {
      await writeFile(path.join(options.outDir, 'ATTRIBUTION.txt'), attribution(month));
    }

    process.stdout.write(
      [
        'kind=city',
        `month=${month}`,
        `source=${source}`,
        `source_bytes=${sourceBytes}`,
        `source_sha256=${sourceSha256}`,
        `source_v4=${collected.v4}`,
        `source_v6=${collected.v6}`,
        `places=${collected.places.length}`,
        `skipped=${collected.skipped}`,
        `container_bytes=${container.length}`,
        `bytes=${manifest.bytes}`,
        `fixture=${options.fixture}`,
        `sha256=${manifest.sha256}`,
        `ms=${Date.now() - started}`,
        `out=${path.join(options.outDir, file)}`,
      ].join(' ') + '\n',
    );
  } finally {
    if (tempPath !== null) await rm(tempPath, { force: true });
  }
}

// A module-local check rather than a bare call, so a test can import the flag
// parser without running a build.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
