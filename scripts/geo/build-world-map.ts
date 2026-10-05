/**
 * Generate the committed world map from the world-atlas TopoJSON (phase 06,
 * ACTIVITY-06, plan 06-07, RESEARCH Pattern 5 and Pitfall 14, T-06-26).
 *
 * ## Why this is a build script and not a runtime map
 *
 * AGENTS.md commits to "geo-map assets are build-time only": `world-atlas`,
 * `d3-geo` and `topojson-client` run HERE, in Node, once — and none of the
 * three is a runtime dependency, because shipping them would reintroduce a
 * charting library at runtime against the project's hand-rolled-charts
 * decision. The output is a TypeScript module of plain committed strings, so
 * the browser gets a list of `<path d="...">` and nothing else.
 *
 * The three are reached through `createRequire` rather than an import because
 * they ship no types and the project installs no `@types` for them (RESEARCH
 * Standard Stack, A6). `tsconfig.node.json` does not enable `noImplicitAny`,
 * so an untyped `require` is a checked script rather than an unchecked one,
 * and the unit test runs this file as a CHILD PROCESS rather than importing
 * it, which keeps the strict browser test project out of it entirely.
 *
 * ## Why numeric ids need no ISO table
 *
 * Natural Earth ids are ISO 3166-1 numeric, and ECMA-402's UND region aliases
 * turn every one of them into a canonical alpha-2 code with no hand-typed
 * table to mistype: `Intl.getCanonicalLocales('und-276')` is `und-DE`. That is
 * measured over the whole atlas, not assumed.
 *
 * ## Why it is deterministic
 *
 * The committed file is reviewed, so a regeneration that differs from it is a
 * diff a human has to judge. Everything that could vary is pinned: the
 * package versions are read from this repository's own devDependencies (so
 * bumping one FAILS `--check` instead of silently changing the output), the
 * features are sorted by iso, coordinates are rounded by `geoPath.digits(1)`,
 * and the centroid is rounded to one decimal. `--check` regenerates in memory
 * and compares byte for byte without writing.
 *
 * ## Why it runs as a plain Node `.ts` file
 *
 * `node scripts/geo/build-world-map.ts` uses native type stripping, so the
 * build step for the build step does not exist. That only works while the file
 * stays erasable — no `enum`, no `namespace`, no parameter properties — which
 * `erasableSyntaxOnly` in `tsconfig.node.json` enforces.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The ONLY place in the repository that may name these three. The world-map
// test scans `src/` for their specifiers and fails on one, because a build-time
// package reaching the bundle is the failure this whole script exists to make
// impossible.
const require = createRequire(import.meta.url);
const { geoNaturalEarth1, geoPath } = require('d3-geo');
const { feature } = require('topojson-client');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT = 'src/lib/geo/world-map.generated.ts';

/** The three build-time packages, in the order the header prints them. */
const ATLAS_PACKAGES = ['world-atlas', 'd3-geo', 'topojson-client'];

/** The projection target the UI-SPEC fixes for the map `viewBox`. */
const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 500;

/** A projected shape under this many square pixels needs the tiny-country marker. */
const TINY_AREA_PX2 = 12;

/**
 * DB-IP codes the shipped hybrid has no polygon for.
 *
 * Written by the generator so the list is part of the generated output and
 * cannot drift from the shapes beside it: the map caption says how many codes
 * are undrawable, and that number is only honest if it comes from the same
 * run that drew the shapes. `XK` is NOT here — the hybrid does draw it, from
 * the feature named Kosovo.
 */
const NO_POLYGON_CODES = [
  'RE',
  'GI',
  'YT',
  'MQ',
  'GP',
  'GF',
  'TK',
  'TV',
  'UM',
  'BQ',
  'BV',
  'SJ',
  'CC',
  'CX',
];

/** Round a coordinate to one decimal, so regeneration is byte-stable. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Natural Earth's Antarctica. Dropped: it is a sixth of the map and holds no logins. */
const ANTARCTICA_ID = '010';

/** The one feature with no id that DB-IP can name. */
const KOSOVO_NAME = 'Kosovo';
const KOSOVO_ISO = 'XK';

interface Options {
  out: string;
  check: boolean;
  against: string | null;
}

/** Parse the flags. An unknown flag is an error rather than a silent no-op. */
export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { out: DEFAULT_OUT, check: false, against: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = (): string => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`${arg} needs a value`);
      }
      i += 1;
      return next;
    };
    if (arg === '--check') options.check = true;
    else if (arg === '--out') options.out = value();
    // `--against` exists so a test can prove `--check` FAILS, which a check
    // that is only ever run against the committed file cannot. It changes the
    // file that is COMPARED, never the file that is written, so running it can
    // still not touch the working tree.
    else if (arg === '--against') options.against = value();
    else throw new Error(`unknown flag: ${arg}`);
  }
  return options;
}

/**
 * A numeric Natural Earth id to an alpha-2 code, with no ISO table.
 *
 * `und-<id>` is an ECMA-402 UND region alias, so the platform's own CLDR data
 * is the table. A malformed tag throws `RangeError`, which is the answer for an
 * id that is not a region.
 */
export function alpha2Of(id: unknown): string | null {
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  try {
    const code = Intl.getCanonicalLocales(`und-${id}`)[0]!.split('-')[1];
    return code !== undefined && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** The code a feature is keyed by, or null when it has neither an id nor a known name. */
function isoOf(feature: AtlasFeature): string | null {
  // The name check comes FIRST: Kosovo carries no id, and if a future atlas
  // revision gave it one the name is still the only honest source for `XK`.
  if (feature.properties?.name === KOSOVO_NAME) return KOSOVO_ISO;
  return alpha2Of(feature.id);
}

/**
 * The shape of a `world-atlas` feature, as far as this generator reads it.
 *
 * `world-atlas` and `topojson-client` ship no types and the project installs no
 * `@types` for them (RESEARCH Standard Stack, A6), so the untyped values they
 * return are narrowed here to the three fields this file actually touches. The
 * `geometry` stays opaque: d3-geo reads it and nothing here does.
 */
interface AtlasFeature {
  readonly id?: string | number;
  readonly properties?: { readonly name?: string };
  readonly geometry: unknown;
}

/** The projection/serialiser pair d3-geo builds, as far as this file calls it. */
interface PathGenerator {
  (feature: AtlasFeature): string | null;
  centroid(feature: AtlasFeature): [number, number];
  bounds(feature: AtlasFeature): [[number, number], [number, number]];
}

/** The `world-atlas` TopoJSON object, as far as this file reads it. */
interface AtlasTopology {
  readonly objects: { readonly countries: unknown };
}

interface Shape {
  iso: string;
  d: string;
  cx: number;
  cy: number;
  tiny: boolean;
}

/**
 * One feature to one shape, or null when the feature is dropped.
 *
 * A micro-state can project to a sub-pixel polygon, so `tiny` records that the
 * shape needs the UI-SPEC's marker circle rather than being invisible.
 */
function shapeFor(feature: AtlasFeature, path: PathGenerator): Shape | null {
  if (String(feature.id ?? '') === ANTARCTICA_ID) return null;
  const iso = isoOf(feature);
  if (iso === null) return null;
  const d = path(feature);
  if (typeof d !== 'string' || d === '') return null;
  const [cx, cy] = path.centroid(feature);
  const [[x0, y0], [x1, y1]] = path.bounds(feature);
  return { iso, d, cx: round1(cx), cy: round1(cy), tiny: (x1 - x0) * (y1 - y0) < TINY_AREA_PX2 };
}

/** The feature list of a `world-atlas` countries object. */
function featuresOf(topology: AtlasTopology): AtlasFeature[] {
  return feature(topology, topology.objects.countries).features as AtlasFeature[];
}

function loadTopology(file: string): AtlasTopology {
  return JSON.parse(readFileSync(require.resolve(file), 'utf8')) as AtlasTopology;
}

/**
 * Single-quote a string, refusing one that would need escaping.
 *
 * The generated module is a reviewable file, so a path string containing a
 * quote has to stop the build rather than produce a file Prettier is not
 * allowed to reformat (it is `.prettierignore`d) and nobody is reading closely.
 */
function quote(value: string): string {
  if (value.includes("'")) throw new Error(`unexpected quote in generated value: ${value}`);
  return `'${value}'`;
}

/** The pinned versions, read from this repository's own devDependencies. */
function atlasVersions(): string {
  const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const dev: Record<string, string> = manifest.devDependencies ?? {};
  return ATLAS_PACKAGES.map((name) => `${name}@${dev[name] ?? 'unknown'}`).join(', ');
}

/** Every shape in the map, sorted by iso so the output is byte-stable. */
function buildShapes(): { shapes: Shape[]; dropped: number } {
  const projection = geoNaturalEarth1().fitSize([VIEWBOX_WIDTH, VIEWBOX_HEIGHT], {
    type: 'Sphere',
  });
  const path = geoPath(projection).digits(1);
  const byIso = new Map<string, Shape>();
  let dropped = 0;
  const add = (raw: AtlasFeature): void => {
    const shape = shapeFor(raw, path);
    if (shape === null) {
      dropped += 1;
    } else if (!byIso.has(shape.iso)) {
      byIso.set(shape.iso, shape);
    }
  };

  // The 110m atlas is the base: the whole world at a resolution the 960 x 500
  // viewBox can actually show, and its path data is what keeps the module
  // inside the main chunk. A 110m-only map is missing 61 DB-IP codes, though,
  // and every one of them is a real place a login history reaches.
  for (const raw of featuresOf(loadTopology('world-atlas/countries-110m.json'))) add(raw);
  // The 50m atlas is the supplement, and it is added ONLY for an alpha-2 the
  // base did not already take — the guard is what makes this a hybrid rather
  // than a 50m map wearing a 110m label, and it is why a country is never
  // drawn twice at two different resolutions.
  for (const raw of featuresOf(loadTopology('world-atlas/countries-50m.json'))) add(raw);

  const shapes = [...byIso.values()].sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
  return { shapes, dropped };
}

/** The committed module, as a string. Nothing else writes this file. */
function renderModule(shapes: readonly Shape[]): string {
  const rows = shapes
    .map(
      (shape) =>
        `  { iso: ${quote(shape.iso)}, d: ${quote(shape.d)}, cx: ${shape.cx}, cy: ${shape.cy}, tiny: ${shape.tiny} },`,
    )
    .join('\n');
  const noPolygon = NO_POLYGON_CODES.map((code) => `  ${quote(code)},`).join('\n');
  return `// GENERATED FILE — do not edit by hand. Run \`pnpm run geo:map\`, and prove
// it is current with \`pnpm run geo:map:check\`.
//
// Source: ${atlasVersions()}
// Projection: geoNaturalEarth1 fitted to a ${VIEWBOX_WIDTH} x ${VIEWBOX_HEIGHT} sphere,
//             rendered with geoPath().digits(1).
// Coverage: the 110m countries, plus every 50m country whose alpha-2 the 110m
//           set does not have, so micro-states such as SG, HK, MT, BH, MC and
//           LI are drawn rather than reported as undrawable. Antarctica is
//           dropped; the feature named Kosovo becomes XK.
//
// This file is plain data and imports NOTHING. world-atlas, d3-geo and
// topojson-client ran in scripts/geo/build-world-map.ts and are build-time only
// (AGENTS.md: "Geo-map assets are build-time only"), so no mapping library can
// reach the shipped bundle through it.

/** The map's viewBox, in the units cx/cy and the path data are expressed in. */
export const WORLD_VIEWBOX = '0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}';

/**
 * One country shape.
 *
 * \`tiny\` is true when the projected bounding box is under ${TINY_AREA_PX2} square pixels, so the
 * map draws the UI-SPEC's marker circle instead of a polygon nobody can see or
 * hover. \`cx\`/\`cy\` is the centroid, used only by that marker.
 */
export interface WorldShape {
  readonly iso: string;
  readonly d: string;
  readonly cx: number;
  readonly cy: number;
  readonly tiny: boolean;
}

export const WORLD_SHAPES: readonly WorldShape[] = [
${rows}
];

/**
 * DB-IP country codes this map cannot draw.
 *
 * They stay reachable through the ranked country list, and the map caption
 * says how many there are. None of them appears in WORLD_SHAPES.
 */
export const NO_POLYGON_CODES: readonly string[] = [
${noPolygon}
];
`;
}

async function main(argv: readonly string[]): Promise<void> {
  const options = parseArgs(argv);
  const { shapes, dropped } = buildShapes();
  const generated = renderModule(shapes);

  if (options.check) {
    // `--against` changes only WHICH file is compared, never which file would
    // be written, so a check run against a copy cannot touch the working tree.
    const compared = path.resolve(options.against ?? options.out);
    const committed = await readFile(compared, 'utf8').catch(() => null);
    if (committed === null) {
      process.stderr.write(`world-map: ${compared} is missing; run pnpm run geo:map\n`);
      process.exitCode = 1;
      return;
    }
    if (committed !== generated) {
      process.stderr.write(
        `world-map: ${compared} differs from a fresh generation; run pnpm run geo:map\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`shapes=${shapes.length} dropped=${dropped} up-to-date=${compared}\n`);
    return;
  }

  const target = path.resolve(options.out);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, generated);
  process.stdout.write(
    `shapes=${shapes.length} dropped=${dropped} no_polygon=${NO_POLYGON_CODES.length} out=${target}\n`,
  );
}

// A module-local check rather than a bare call, so a test can import the flag
// parser and the id mapping without running a generation.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
