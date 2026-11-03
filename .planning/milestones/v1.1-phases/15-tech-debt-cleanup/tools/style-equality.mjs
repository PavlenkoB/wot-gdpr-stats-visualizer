#!/usr/bin/env node
// =============================================================================
// style-equality.mjs - the instrument that judges every plan of Phase 15.
//
// Phase 15 moves sites onto shared type roles and changes nothing visible. This
// script proves "nothing visible changed": it builds the commit before the
// phase (the BASELINE) and the working tree, drives the same synthetic exports
// through both builds in headless Chromium, and compares per element the
// computed style and the bounding rect, plus a hash of a full-page screenshot.
//
//   node style-equality.mjs check [--panes a,b] [--widths n,n]
//   node style-equality.mjs capture --label before|after [--tree <dir>] [--panes ..] [--widths ..]
//   node style-equality.mjs show --label before|after (--testid <id> | --class <name>) [--pane <id>] [--width <n>]
//   node style-equality.mjs selftest
//   node style-equality.mjs clean
//   node style-equality.mjs evidence --section baseline|tracer|final
//
// Rules this file keeps (threat register T-15-01, T-15-02):
//   - Zip bytes come ONLY from the fixture builders under tests/fixtures/. There
//     is no argument that names a zip, and a loader that is handed a path
//     outside that directory refuses it. A real export is never read.
//   - Output (builds, JSON dumps) lives in the scratch directory, never in the
//     repository. The evidence file holds counts, hashes and commit ids only.
//   - No absolute path is written to a committed file: paths printed here are
//     repo-relative or scratch-relative.
//
// Class names are NEVER part of the comparison key: classes are what the later
// plans change. An element is keyed by its tag and nth-of-type chain (and its
// data-testid), so a renamed class cannot hide a moved element.
// =============================================================================

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const EVIDENCE_FILE = path.join(HERE, '..', '15-STYLE-EQUALITY-EVIDENCE.md');
const FIXTURES_DIR = path.join(REPO, 'tests', 'fixtures');

/** The commit before Phase 15. */
const BASELINE_COMMIT = '2cb5359';

/**
 * The version of what is recorded. Adding a state (plan 15-07 added `tooltip`,
 * version 2) bumps it, which invalidates the cached `before` capture; it is then rebuilt
 * from the same baseline commit.
 */
const HARNESS_VERSION = 2;

const WIDTHS_MAIN = [1280, 375];
const WIDTHS_EDGE = [900, 899, 481, 480];
const VIEWPORT_HEIGHT = 800;
const CONCURRENCY = 3;

const SCRATCH = path.join(process.env.WG_PHASE15_SCRATCH || os.tmpdir(), 'wg-phase15');

/** The computed properties compared, in recorded order. */
const PROPS = [
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'font-family',
  'font-style',
  'color',
  'background-color',
  'display',
  'position',
  'overflow-wrap',
  'white-space',
  'text-align',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'min-height',
];
const RECT_NAMES = ['rect.x', 'rect.y', 'rect.width', 'rect.height'];
const TOLERANCE = 0.01;

// -----------------------------------------------------------------------------
// The exports: fixture builders only (T-15-01).
// -----------------------------------------------------------------------------

/**
 * The archives driven. Chosen so that all 13 pane ids render at least once;
 * coverage is asserted after a full run, not hoped for. `edge` marks the one
 * archive that is also driven at the four widths on either side of the two
 * breakpoints.
 */
const ARCHIVES = [
  {
    id: 'new-games-three-account',
    file: 'multi-account-fixtures.ts',
    builder: 'buildNewGamesThreeAccountExport',
  },
  {
    id: 'account-timeline-perks',
    file: 'account-timeline-perks-export.ts',
    builder: 'buildAccountTimelinePerksExport',
  },
  { id: 'perks-three-account', file: 'perks-fixtures.ts', builder: 'buildPerksThreeAccountExport' },
  {
    id: 'real-shape-three-account',
    file: 'multi-account-fixtures.ts',
    builder: 'buildRealShapeThreeAccountExport',
  },
  { id: 'sample', file: 'export-fixtures.ts', builder: 'buildSampleExport' },
];

/** The archive that is additionally driven at the edge widths. */
const EDGE_ARCHIVE_ID = 'real-shape-three-account';

/** The panes the edge archive must render. */
const EDGE_REQUIRED_PANES = [
  'overview',
  'playtime',
  'login-history',
  'vehicles',
  'finance',
  'payments',
  'device-info',
  'account',
];

/** Loads one fixture builder. Refuses anything outside tests/fixtures/. */
async function loadExport(archive) {
  const file = path.resolve(FIXTURES_DIR, archive.file);
  if (path.dirname(file) !== FIXTURES_DIR || archive.file.includes('/')) {
    throw new Error('refusing to load an export from outside tests/fixtures/');
  }
  const module = await import(pathToFileURL(file).href);
  const bytes = module[archive.builder]();
  if (!(bytes instanceof Uint8Array)) throw new Error(`${archive.builder} did not return bytes`);
  return bytes;
}

// -----------------------------------------------------------------------------
// Small helpers.
// -----------------------------------------------------------------------------

const require = createRequire(path.join(REPO, 'package.json'));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** JSON with sorted object keys, so a hash does not depend on insertion order. */
function canonical(value) {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1)));
    }
    return val;
  });
}

function git(args, options = {}) {
  const out = execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', ...options });
  return out === null ? '' : out.trim();
}

function ensureScratch() {
  fs.mkdirSync(SCRATCH, { recursive: true });
}

function scratchPath(name) {
  return path.join(SCRATCH, name);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(scratchPath(name), 'utf8'));
}

function writeJson(name, value) {
  ensureScratch();
  fs.writeFileSync(scratchPath(name), canonical(value));
}

function exists(name) {
  return fs.existsSync(scratchPath(name));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[arg.slice(2)] = true;
      else {
        args[arg.slice(2)] = next;
        i += 1;
      }
    } else args._.push(arg);
  }
  return args;
}

function listArg(value) {
  return typeof value === 'string' ? value.split(',').filter(Boolean) : null;
}

// -----------------------------------------------------------------------------
// Building and serving.
// -----------------------------------------------------------------------------

function build(treeDir, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  execFileSync(
    path.join(REPO, 'node_modules', '.bin', 'vite'),
    ['build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'],
    { cwd: treeDir, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  if (!fs.existsSync(path.join(outDir, 'index.html'))) throw new Error('build produced no index.html');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Serves a directory from an ephemeral port. No request leaves the machine. */
function serve(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    let relative = decodeURIComponent(url.pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(root, '.' + relative);
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      response.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

// -----------------------------------------------------------------------------
// The baseline worktree.
// -----------------------------------------------------------------------------

function baselineHash() {
  return git(['rev-parse', '--verify', BASELINE_COMMIT + '^{commit}']);
}

function ensureBaselineBuild() {
  ensureScratch();
  const hash = baselineHash();
  const tree = scratchPath('baseline-tree');
  const dist = scratchPath('before-dist');
  const stamp = scratchPath('before-dist.stamp');
  const stampText = `${hash}:city=${fs.existsSync(path.join(REPO, 'public', 'geo-city-data'))}`;
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === stampText && fs.existsSync(dist)) {
    return { hash, dist };
  }
  if (!fs.existsSync(tree)) {
    git(['worktree', 'prune']);
    git(['worktree', 'add', '--detach', tree, hash], { stdio: 'ignore' });
  } else if (execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== hash) {
    throw new Error('the cached baseline worktree is at another commit; run clean');
  }
  const modules = path.join(tree, 'node_modules');
  if (!fs.existsSync(modules)) fs.symlinkSync(path.join(REPO, 'node_modules'), modules, 'dir');
  // The opt-in city file is a gitignored local build input. The working tree
  // build bakes its manifest into the bundle (it changes the login-history
  // pane), so the baseline build must see the same input or the two builds
  // would differ for a reason that has nothing to do with the code.
  const cityData = path.join(REPO, 'public', 'geo-city-data');
  const cityLink = path.join(tree, 'public', 'geo-city-data');
  if (fs.existsSync(cityData) && !fs.existsSync(cityLink)) fs.symlinkSync(cityData, cityLink, 'dir');
  console.log(`building the baseline (${BASELINE_COMMIT})...`);
  build(tree, dist);
  fs.writeFileSync(stamp, stampText);
  return { hash, dist };
}

// -----------------------------------------------------------------------------
// Driving the app and recording.
// -----------------------------------------------------------------------------

/** Runs in the page: records every element under the given roots. */
function recordInPage({ roots, props }) {
  const out = [];
  const seen = new Set();
  const sx = window.scrollX;
  const sy = window.scrollY;
  const round = (n) => Math.round(n * 100) / 100;

  function keyOf(el) {
    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const tag = node.localName;
      let index = 1;
      for (let s = node.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.localName === tag) index += 1;
      }
      const testid = node.getAttribute('data-testid');
      parts.push(tag + ':' + index + (testid ? '[' + testid + ']' : ''));
    }
    return parts.reverse().join('/');
  }

  function add(el) {
    if (seen.has(el)) return;
    seen.add(el);
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    out.push([
      keyOf(el),
      el.getAttribute('class') || '',
      [round(rect.x + sx), round(rect.y + sy), round(rect.width), round(rect.height)],
      props.map((p) => style.getPropertyValue(p)),
    ]);
  }

  for (const selector of roots) {
    for (const root of document.querySelectorAll(selector)) {
      add(root);
      for (const el of root.querySelectorAll('*')) add(el);
    }
  }
  return out;
}

async function settle(page) {
  await page.waitForFunction(
    () => {
      const detail = document.querySelector('[data-testid="detail-pane"]');
      if (detail === null) return false;
      if (detail.querySelector('[data-state="loading"], [aria-busy="true"]') !== null) return false;
      if (document.querySelector('[data-testid="processing-status"]') !== null) return false;
      return true;
    },
    undefined,
    { timeout: 60000 },
  );
  await page.evaluate(
    () =>
      document.fonts.ready.then(
        () =>
          new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      ),
  );
}

async function neutralise(page) {
  // The imported-at text shows a calendar date; the font properties are still measured.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="imported-at"]')) {
      el.textContent = 'IMPORTED';
    }
  });
  await page.mouse.move(0, 0);
}

async function shot(page) {
  const buffer = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  return sha256(buffer);
}

async function ensureList(page) {
  const list = page.locator('[data-testid="list-pane"]');
  if (await list.isVisible()) return;
  await page.locator('[data-testid="back-button-sections"]').click();
  await list.waitFor({ state: 'visible' });
}

/** The shared tooltip elements, shown or hidden (ChartTooltip is always mounted). */
const TOOLTIP_SELECTOR =
  '[data-testid="chart-tooltip"], [data-testid="map-tooltip"], [data-testid="finance-tooltip"]';

/**
 * The tooltip state of one pane: for each chart surface in the detail pane,
 * focus its first mark so the shared tooltip renders, record the tooltip
 * subtree and a viewport screenshot hash, then clear the focus.
 *
 * A surface with no focusable mark, or one whose tooltip never shows, is
 * counted in `skipped` (printed by the check, never an error). The rows of
 * the n-th surface carry the prefix `s<n>:` on their key, because several
 * charts of one pane share one tooltip element.
 */
async function recordTooltipState(page, recordArgs) {
  const surfaces = await page.evaluate(
    () => document.querySelectorAll('[data-testid="detail-pane"] [data-tooltip-surface]').length,
  );
  const rows = [];
  const hashes = [];
  let skipped = 0;
  for (let index = 0; index < surfaces; index += 1) {
    const focused = await page.evaluate((i) => {
      const surface = document.querySelectorAll('[data-testid="detail-pane"] [data-tooltip-surface]')[i];
      // A chart inside a closed disclosure cannot take focus: open the
      // disclosures that wrap it (the open state opens all of them next anyway).
      for (let node = surface.parentElement; node !== null; node = node.parentElement) {
        if (node instanceof HTMLDetailsElement) node.open = true;
      }
      const mark = surface.querySelector('[tabindex="0"], [data-index][tabindex], [data-iso][tabindex]');
      if (mark === null) return false;
      mark.focus();
      return true;
    }, index);
    let shown = false;
    if (focused) {
      try {
        await page.waitForFunction(
          (selector) => [...document.querySelectorAll(selector)].some((el) => !el.hidden),
          TOOLTIP_SELECTOR,
          { timeout: 3000 },
        );
        shown = true;
      } catch {
        shown = false;
      }
    }
    if (shown) {
      await page.evaluate(
        () =>
          new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const recorded = await page.evaluate(recordInPage, { roots: [TOOLTIP_SELECTOR], props: recordArgs.props });
      for (const row of recorded) rows.push([`s${index}:${row[0]}`, ...row.slice(1)]);
      const buffer = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      hashes.push(sha256(buffer));
    } else {
      skipped += 1;
    }
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page
      .waitForFunction(
        (selector) => [...document.querySelectorAll(selector)].every((el) => el.hidden),
        TOOLTIP_SELECTOR,
        { timeout: 3000 },
      )
      .catch(() => {});
  }
  return { rows, hash: hashes.length > 0 ? sha256(hashes.join(',')) : null, skipped, surfaces };
}

async function runOne({ browser, baseUrl, archive, bytes, width, paneFilter }) {
  const context = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT },
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message ?? error)));
  try {
    await page.goto(baseUrl);
    await page.waitForSelector('main[data-worker-ready="true"]', { timeout: 60000 });
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(bytes),
    });
    await page.waitForSelector('[data-testid="list-row-overview"]', { timeout: 60000 });
    await settle(page);

    const rows = await page.$$eval('[data-testid^="list-row-"]', (els) =>
      els.map((el) => ({
        id: el.getAttribute('data-testid').slice('list-row-'.length),
        muted: el.classList.contains('muted'),
      })),
    );

    const run = { rows, chrome: [], panes: {}, shots: {} };

    await ensureList(page);
    await neutralise(page);
    run.chrome = await page.evaluate(recordInPage, {
      roots: ['[data-testid="list-pane"]', 'main > :not(.shell)'],
      props: PROPS,
    });
    run.shots.chrome = await shot(page);

    for (const { id } of rows) {
      if (paneFilter && !paneFilter.includes(id)) continue;
      await ensureList(page);
      await page.locator(`[data-testid="list-row-${id}"]`).click();
      await page.waitForSelector(`[data-testid="detail-pane"][data-pane="${id}"]`);
      await settle(page);
      await neutralise(page);
      const recordArgs = { roots: ['[data-testid="detail-pane"]'], props: PROPS };
      const rest = await page.evaluate(recordInPage, recordArgs);
      run.shots[`${id}:rest`] = await shot(page);

      const tooltipState = await recordTooltipState(page, recordArgs);
      if (tooltipState.hash !== null) run.shots[`${id}:tooltip`] = tooltipState.hash;
      await neutralise(page);

      await page.evaluate(() => {
        for (const el of document.querySelectorAll('[data-testid="detail-pane"] details')) {
          el.open = true;
        }
      });
      await settle(page);
      await neutralise(page);
      const open = await page.evaluate(recordInPage, recordArgs);
      // No screenshot hash in the open state: it was measured to be unstable
      // across identical captures (an opened disclosure animates a layout shift
      // that `animations: 'disabled'` does not cover); the open state is compared
      // by computed style and rect, which is what a role can change.
      run.panes[id] = {
        rest,
        open,
        tooltip: tooltipState.rows,
        tooltipSurfaces: tooltipState.surfaces,
        tooltipSkipped: tooltipState.skipped,
      };
    }
    if (errors.length > 0) throw new Error(`page errors in ${archive.id}@${width}: ${errors[0]}`);
    return run;
  } finally {
    await context.close();
  }
}

/** Runs async jobs with a bounded pool. */
async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
  return results;
}

function planJobs({ archives, widths, edgeOnlyWidths }) {
  const jobs = [];
  for (const archive of archives) {
    const list = [...WIDTHS_MAIN];
    if (archive.id === EDGE_ARCHIVE_ID) list.push(...WIDTHS_EDGE);
    for (const width of list) {
      if (widths && !widths.includes(width)) continue;
      if (edgeOnlyWidths === false && WIDTHS_EDGE.includes(width)) continue;
      jobs.push({ archive, width });
    }
  }
  return jobs;
}

/** Captures one dist directory. Returns { dump, shots }. */
async function captureDist({ distDir, label, commit, archives, widths, paneFilter, edgeWidths }) {
  const { chromium } = require('@playwright/test');
  const server = await serve(distDir);
  const browser = await chromium.launch();
  try {
    const jobs = planJobs({ archives, widths, edgeOnlyWidths: edgeWidths });
    const bytesById = new Map();
    for (const archive of archives) bytesById.set(archive.id, await loadExport(archive));
    const results = await pool(jobs, CONCURRENCY, async (job) => {
      const run = await runOne({
        browser,
        baseUrl: server.url,
        archive: job.archive,
        bytes: bytesById.get(job.archive.id),
        width: job.width,
        paneFilter,
      });
      return run;
    });
    const dump = {
      meta: { version: HARNESS_VERSION, label, commit, full: !paneFilter && !widths },
      runs: {},
    };
    const shots = {};
    jobs.forEach((job, index) => {
      const key = `${job.archive.id}@${job.width}`;
      const { shots: runShots, ...rest } = results[index];
      dump.runs[key] = rest;
      shots[key] = runShots;
    });
    return { dump, shots };
  } finally {
    await browser.close();
    await server.close();
  }
}

/** The pane ids that the whole dump rendered (a row existed and was opened). */
function renderedPanes(dump) {
  const set = new Set();
  for (const run of Object.values(dump.runs)) for (const id of Object.keys(run.panes)) set.add(id);
  return [...set];
}

async function allPaneIds() {
  const source = fs.readFileSync(path.join(REPO, 'src', 'lib', 'ui-copy.ts'), 'utf8');
  const start = source.indexOf('export const PANE_TITLES');
  const end = source.indexOf('};', start);
  const body = source.slice(start, end);
  const ids = [...body.matchAll(/^\s*(?:'([a-z-]+)'|([a-z]+)):\s*'/gm)].map((m) => m[1] ?? m[2]);
  if (ids.length !== 13) throw new Error(`expected 13 pane ids in PANE_TITLES, found ${ids.length}`);
  return ids;
}

async function assertCoverage(dump) {
  const ids = await allPaneIds();
  const rendered = new Set(renderedPanes(dump));
  const missing = ids.filter((id) => !rendered.has(id));
  if (missing.length > 0) throw new Error(`coverage: pane(s) never rendered: ${missing.join(', ')}`);
  const edge = dump.runs[`${EDGE_ARCHIVE_ID}@1280`];
  const edgeMissing = EDGE_REQUIRED_PANES.filter((id) => !(edge && edge.panes[id]));
  if (edgeMissing.length > 0) {
    throw new Error(`coverage: the edge archive did not render: ${edgeMissing.join(', ')}`);
  }
}

// -----------------------------------------------------------------------------
// Comparing.
// -----------------------------------------------------------------------------

function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= TOLERANCE;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ta = a.split(/\s+/);
  const tb = b.split(/\s+/);
  if (ta.length !== tb.length) return false;
  return ta.every((token, i) => {
    if (token === tb[i]) return true;
    const na = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(token);
    const nb = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(tb[i]);
    return na && nb && na[2] === nb[2] && Math.abs(Number(na[1]) - Number(nb[1])) <= TOLERANCE;
  });
}

function compareRows(before, after, where, report) {
  const byKey = new Map(before.map((row) => [row[0], row]));
  const seen = new Set();
  for (const row of after) {
    report.elements += 1;
    const other = byKey.get(row[0]);
    seen.add(row[0]);
    if (other === undefined) {
      report.differences.push({ where, key: row[0], property: '<element>', before: 'absent', after: 'present' });
      continue;
    }
    RECT_NAMES.forEach((name, i) => {
      if (!sameValue(other[2][i], row[2][i])) {
        report.differences.push({ where, key: row[0], property: name, before: other[2][i], after: row[2][i] });
      }
    });
    PROPS.forEach((name, i) => {
      if (!sameValue(other[3][i], row[3][i])) {
        report.differences.push({ where, key: row[0], property: name, before: other[3][i], after: row[3][i] });
      }
    });
  }
  for (const row of before) {
    if (!seen.has(row[0])) {
      report.differences.push({ where, key: row[0], property: '<element>', before: 'present', after: 'absent' });
    }
  }
}

function emptyReport() {
  return { archives: new Set(), panes: new Set(), widths: new Set(), elements: 0, screenshots: 0, differences: [], screenshotDifferences: [], byWidth: {}, tooltipSurfaces: 0, tooltipSkipped: 0 };
}

/** Compares everything that `after` recorded against `before`. */
function compare(before, beforeShots, after, afterShots) {
  const report = emptyReport();
  for (const [runKey, run] of Object.entries(after.runs)) {
    const [archiveId, widthText] = runKey.split('@');
    const width = Number(widthText);
    const other = before.runs[runKey];
    if (other === undefined) throw new Error(`the baseline has no capture for ${runKey}; run clean`);
    report.archives.add(archiveId);
    report.widths.add(width);
    const slot = (report.byWidth[width] ??= { elements: 0, screenshots: 0, differingElements: 0, differingScreenshots: 0 });
    const elementsBefore = report.elements;
    const differencesBefore = report.differences.length;
    compareRows(other.chrome, run.chrome, `${runKey} chrome`, report);
    for (const [id, states] of Object.entries(run.panes)) {
      report.panes.add(id);
      const otherPane = other.panes[id];
      if (otherPane === undefined) {
        report.differences.push({ where: `${runKey} ${id}`, key: '', property: '<pane>', before: 'absent', after: 'present' });
        continue;
      }
      compareRows(otherPane.rest, states.rest, `${runKey} ${id} rest`, report);
      compareRows(otherPane.open, states.open, `${runKey} ${id} open`, report);
      compareRows(otherPane.tooltip ?? [], states.tooltip ?? [], `${runKey} ${id} tooltip`, report);
      if (otherPane.tooltipSkipped !== states.tooltipSkipped) {
        report.differences.push({
          where: `${runKey} ${id} tooltip`,
          key: '',
          property: '<tooltip-skipped>',
          before: otherPane.tooltipSkipped,
          after: states.tooltipSkipped,
        });
      }
      report.tooltipSurfaces += states.tooltipSurfaces ?? 0;
      report.tooltipSkipped += states.tooltipSkipped ?? 0;
    }
    slot.elements += report.elements - elementsBefore;
    slot.differingElements += new Set(report.differences.slice(differencesBefore).map((d) => d.where + d.key)).size;
    for (const [name, hash] of Object.entries(afterShots[runKey])) {
      report.screenshots += 1;
      slot.screenshots += 1;
      if (beforeShots[runKey]?.[name] !== hash) {
        report.screenshotDifferences.push({ where: `${runKey} ${name}` });
        slot.differingScreenshots += 1;
      }
    }
  }
  return report;
}

function printReport(report) {
  console.log(
    `archives: ${report.archives.size}  panes: ${report.panes.size}  widths: ${[...report.widths].sort((a, b) => a - b).join(',')}`,
  );
  console.log(
    `elements compared: ${report.elements}  screenshots compared: ${report.screenshots}  differing elements/properties: ${report.differences.length}  differing screenshots: ${report.screenshotDifferences.length}`,
  );
  console.log(
    `tooltip state: ${report.tooltipSurfaces - report.tooltipSkipped} of ${report.tooltipSurfaces} chart surfaces recorded, ${report.tooltipSkipped} skipped (no focusable mark or no tooltip shown)`,
  );
  for (const d of report.differences.slice(0, 40)) {
    console.log(`DIFF ${d.where} ${d.key} ${d.property}: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`);
  }
  for (const d of report.screenshotDifferences.slice(0, 40)) console.log(`SHOT ${d.where}`);
}

function isEqual(report) {
  return report.differences.length === 0 && report.screenshotDifferences.length === 0;
}

/** Per width: element count and sha-256 of the canonical JSON of that width. */
function widthStats(dump) {
  const widths = {};
  for (const [runKey, run] of Object.entries(dump.runs)) {
    const width = Number(runKey.split('@')[1]);
    const slot = (widths[width] ??= { runs: {}, elements: 0 });
    slot.runs[runKey] = run;
    slot.elements += run.chrome.length;
    for (const states of Object.values(run.panes)) slot.elements += states.rest.length + states.open.length + (states.tooltip?.length ?? 0);
  }
  return Object.fromEntries(
    Object.entries(widths).map(([width, slot]) => [width, { elements: slot.elements, sha256: sha256(canonical(slot.runs)) }]),
  );
}

// -----------------------------------------------------------------------------
// Baseline capture (cached) and the commands.
// -----------------------------------------------------------------------------

async function ensureBaselineCapture() {
  const { hash, dist } = ensureBaselineBuild();
  if (exists('before.json') && exists('before-shots.json')) {
    const existing = readJson('before.json');
    if (existing.meta.version === HARNESS_VERSION && existing.meta.commit === hash && existing.meta.full) {
      return { hash, dump: existing, shots: readJson('before-shots.json') };
    }
    console.log('the cached baseline capture is out of date; recapturing');
  }
  console.log('capturing the baseline twice (the two captures must be identical)...');
  const first = await captureDist({ distDir: dist, label: 'before', commit: hash, archives: ARCHIVES });
  const second = await captureDist({ distDir: dist, label: 'before', commit: hash, archives: ARCHIVES });
  if (canonical(first.dump) !== canonical(second.dump) || canonical(first.shots) !== canonical(second.shots)) {
    writeJson('before-first.json', first);
    writeJson('before-second.json', second);
    throw new Error('the baseline is not stable: two captures differ (see the scratch directory)');
  }
  await assertCoverage(first.dump);
  first.dump.meta.capturedAt = new Date().toISOString();
  first.dump.meta.capturedTwiceIdentical = true;
  writeJson('before.json', first.dump);
  writeJson('before-shots.json', first.shots);
  return { hash, dump: first.dump, shots: first.shots };
}

async function commandCapture(args) {
  const label = args.label;
  if (label !== 'before' && label !== 'after') throw new Error('--label before|after is required');
  ensureScratch();
  if (label === 'before' && !args.tree) {
    await ensureBaselineCapture();
    console.log('before capture is in the scratch directory');
    return 0;
  }
  const tree = args.tree ? path.resolve(String(args.tree)) : REPO;
  const dist = scratchPath(`${label}-dist`);
  build(tree, dist);
  const commit = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const paneFilter = listArg(args.panes);
  const widths = listArg(args.widths)?.map(Number) ?? null;
  const { dump, shots } = await captureDist({
    distDir: dist,
    label,
    commit,
    archives: ARCHIVES,
    widths,
    paneFilter,
  });
  writeJson(`${label}.json`, dump);
  writeJson(`${label}-shots.json`, shots);
  console.log(`${label}: ${Object.keys(dump.runs).length} runs, panes rendered: ${renderedPanes(dump).sort().join(', ')}`);
  return 0;
}

async function commandCheck(args) {
  const started = Date.now();
  const { dump: before, shots: beforeShots } = await ensureBaselineCapture();
  const paneFilter = listArg(args.panes);
  const widths = listArg(args.widths)?.map(Number) ?? null;
  const dist = scratchPath('after-dist');
  build(REPO, dist);
  const commit = git(['rev-parse', 'HEAD']);
  const { dump: after, shots: afterShots } = await captureDist({
    distDir: dist,
    label: 'after',
    commit,
    archives: ARCHIVES,
    widths,
    paneFilter,
  });
  writeJson('after.json', after);
  writeJson('after-shots.json', afterShots);
  if (!paneFilter && !widths) await assertCoverage(after);
  const report = compare(before, beforeShots, after, afterShots);
  printReport(report);
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`wall time: ${seconds}s`);
  const equal = isEqual(report);
  const full = !paneFilter && !widths;
  writeJson('last-check.json', {
    at: new Date().toISOString(),
    commit,
    full,
    equal,
    seconds,
    srcClean: git(['status', '--porcelain', '--', 'src']) === '',
    byWidth: report.byWidth,
  });
  console.log(equal ? 'EQUAL' : 'DIFFERS');
  return equal ? 0 : 1;
}

function commandShow(args) {
  const label = args.label;
  if (label !== 'before' && label !== 'after') throw new Error('--label before|after is required');
  if (!args.testid && !args.class) throw new Error('--testid <id> or --class <name> is required');
  const dump = readJson(`${label}.json`);
  const width = args.width ? Number(args.width) : null;
  let printed = 0;
  const wanted = (row) => {
    if (args.testid && !row[0].includes(`[${args.testid}]`)) return false;
    if (args.class && !row[1].split(/\s+/).includes(String(args.class))) return false;
    return true;
  };
  const print = (where, row) => {
    printed += 1;
    const values = Object.fromEntries(PROPS.map((name, i) => [name, row[3][i]]));
    console.log(JSON.stringify({ where, key: row[0], classes: row[1], rect: row[2], ...values }));
  };
  for (const [runKey, run] of Object.entries(dump.runs)) {
    if (width !== null && Number(runKey.split('@')[1]) !== width) continue;
    for (const row of run.chrome) if (!args.pane && wanted(row)) print(`${runKey} chrome`, row);
    for (const [id, states] of Object.entries(run.panes)) {
      if (args.pane && args.pane !== id) continue;
      for (const state of ['rest', 'open', 'tooltip']) {
        for (const row of states[state] ?? []) if (wanted(row)) print(`${runKey} ${id} ${state}`, row);
      }
    }
  }
  console.log(`${printed} row(s)`);
  return 0;
}

async function commandSelftest() {
  const { hash, dist } = ensureBaselineBuild();
  const richest = ARCHIVES.find((a) => a.id === EDGE_ARCHIVE_ID);
  const probe = await captureDist({ distDir: dist, label: 'probe', commit: hash, archives: [richest], widths: [1280] });
  const paneFilter = Object.keys(probe.dump.runs[`${EDGE_ARCHIVE_ID}@1280`].panes).slice(0, 3);
  if (paneFilter.length === 0) throw new Error('selftest: no pane rendered');
  const matrix = { distDir: dist, label: 'selftest', commit: hash, archives: [richest], widths: WIDTHS_MAIN, paneFilter };
  console.log(`selftest panes: ${paneFilter.join(', ')}`);
  const first = await captureDist(matrix);
  const second = await captureDist(matrix);
  if (canonical(first.dump) !== canonical(second.dump)) {
    console.error('SELFTEST FAILED: two baseline captures differ in the dump');
    return 1;
  }
  if (canonical(first.shots) !== canonical(second.shots)) {
    console.error('SELFTEST FAILED: two baseline captures differ in the screenshot hashes');
    return 1;
  }
  console.log('selftest (a): two baseline captures are identical (dump and screenshot hashes)');

  // (b) a one-property change in memory is detected, exactly once.
  const mutated = JSON.parse(canonical(first.dump));
  const runKey = Object.keys(mutated.runs)[0];
  const paneId = Object.keys(mutated.runs[runKey].panes)[0];
  const target = mutated.runs[runKey].panes[paneId].rest.find((row) => row[3][PROPS.indexOf('font-weight')] !== '');
  const weightIndex = PROPS.indexOf('font-weight');
  const originalWeight = target[3][weightIndex];
  target[3][weightIndex] = originalWeight === '600' ? '400' : '600';
  const report = compare(first.dump, first.shots, mutated, second.shots);
  const ok =
    report.differences.length === 1 &&
    report.differences[0].property === 'font-weight' &&
    report.differences[0].key === target[0] &&
    report.screenshotDifferences.length === 0;
  if (!ok) {
    console.error('SELFTEST FAILED: the perturbation was not detected exactly once');
    printReport(report);
    return 1;
  }
  console.log('selftest (b): a one-property perturbation is detected exactly once');
  writeJson('selftest.json', { at: new Date().toISOString(), ok: true });
  console.log('SELFTEST PASSED');
  return 0;
}

function commandClean() {
  const tree = scratchPath('baseline-tree');
  if (fs.existsSync(tree)) {
    try {
      git(['worktree', 'remove', '--force', tree], { stdio: 'ignore' });
    } catch {
      fs.rmSync(tree, { recursive: true, force: true });
    }
  }
  git(['worktree', 'prune']);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  console.log('removed the baseline worktree and the scratch directory');
  return 0;
}

// -----------------------------------------------------------------------------
// The evidence file: counts, hashes and commit ids only (T-15-02).
// -----------------------------------------------------------------------------

const EVIDENCE_HEADER = `# Phase 15 style-equality evidence

Written by \`tools/style-equality.mjs evidence\`. This file holds widths, counts, hashes and commit ids only: no screenshot, no fixture byte, no export content, no absolute path. The comparison is per element (computed style and bounding rect) plus a sha-256 of a full-page screenshot in the rest state; class names are never part of the key.
`;

function replaceSection(markdown, heading, body) {
  const marker = `## ${heading}`;
  const section = `${marker}\n\n${body.trim()}\n`;
  const start = markdown.indexOf(`\n${marker}\n`);
  if (start < 0) return `${markdown.trimEnd()}\n\n${section}`;
  const from = start + 1;
  const next = markdown.indexOf('\n## ', from + marker.length);
  const tail = next < 0 ? '' : markdown.slice(next + 1);
  return `${markdown.slice(0, from)}${section}${tail ? '\n' + tail : ''}`;
}

function commandEvidence(args) {
  const section = args.section;
  let markdown = fs.existsSync(EVIDENCE_FILE) ? fs.readFileSync(EVIDENCE_FILE, 'utf8') : EVIDENCE_HEADER;
  if (section === 'baseline') {
    const before = readJson('before.json');
    const stats = widthStats(before);
    const archives = Object.keys(before.runs)
      .map((key) => key.split('@')[0])
      .filter((id, i, all) => all.indexOf(id) === i);
    const lines = [
      `- Baseline commit: \`${before.meta.commit}\` (${BASELINE_COMMIT}, the commit before Phase 15).`,
      `- Captured (UTC): ${before.meta.capturedAt}.`,
      `- Harness version: ${before.meta.version}.`,
      `- Archives driven (synthetic builders under tests/fixtures/): ${archives.join(', ')}.`,
      `- Panes rendered (${renderedPanes(before).length} of 13): ${renderedPanes(before).sort().join(', ')}.`,
      `- Widths: ${Object.keys(stats).sort((a, b) => a - b).join(', ')} (the edge widths 900, 899, 481, 480 for one archive).`,
      `- States: rest (computed style, rect and a screenshot hash), tooltip (from plan 15-07: the first mark of each chart surface focused so the shared tooltip renders; the tooltip subtree and a viewport screenshot hash) and open (every details element opened; computed style and rect only).`,
      `- The baseline was captured twice with identical results (dump and screenshot hashes): ${before.meta.capturedTwiceIdentical === true ? 'yes' : 'no'}.`,
      '',
      '| width | elements | sha-256 of the canonical JSON |',
      '|---|---|---|',
      ...Object.keys(stats)
        .sort((a, b) => a - b)
        .map((width) => `| ${width} | ${stats[width].elements} | ${stats[width].sha256} |`),
    ];
    markdown = replaceSection(markdown, 'Baseline', lines.join('\n'));
  } else if (section === 'tracer' || section === 'final') {
    const last = readJson('last-check.json');
    if (!last.full) throw new Error('the last check was narrowed (--panes/--widths); run a full check first');
    const rows = Object.keys(last.byWidth)
      .map(Number)
      .sort((a, b) => a - b)
      .map((width) => {
        const w = last.byWidth[width];
        const verdict = w.differingElements === 0 && w.differingScreenshots === 0 ? 'EQUAL' : 'DIFFERS';
        return `| ${width} | ${w.elements} | ${w.screenshots} | ${w.differingElements} | ${w.differingScreenshots} | ${verdict} |`;
      });
    const lines = [
      `- Date (UTC): ${last.at}.`,
      `- Commit: \`${last.commit.slice(0, 7)}\`.`,
      `- Working tree (src/): ${last.srcClean ? 'clean' : 'dirty'}.`,
      `- Wall time of the full check${section === 'final' ? '' : ' (baseline cached)'}: ${last.seconds}s.`,
      '',
      '| width | elements | screenshots | differing elements | differing screenshots | verdict |',
      '|---|---|---|---|---|---|',
      ...rows,
    ];
    if (section === 'final') {
      const out = execFileSync(
        process.execPath,
        [path.join(path.dirname(fileURLToPath(import.meta.url)), 'note-sites.mjs'), '--count', 'src'],
        { cwd: REPO, encoding: 'utf8' },
      );
      const total = /total:\s*(\d+)/.exec(out);
      if (!total) throw new Error('note-sites printed no total');
      lines.push('', `Every width above covers the rest, open and tooltip states.`, '');
      lines.push(`- note-sites total: ${total[1]} (102 at the start of the phase).`);
      markdown = replaceSection(markdown, 'Final result', lines.join('\n'));
    } else {
      markdown = replaceSection(markdown, 'Tracer result', lines.join('\n'));
    }
  } else {
    throw new Error('--section baseline|tracer|final is required');
  }
  fs.writeFileSync(EVIDENCE_FILE, markdown);
  console.log(`wrote the ${section} section of ${path.relative(REPO, EVIDENCE_FILE)}`);
  return 0;
}

// -----------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
try {
  let code;
  if (command === 'check') code = await commandCheck(args);
  else if (command === 'capture') code = await commandCapture(args);
  else if (command === 'show') code = commandShow(args);
  else if (command === 'selftest') code = await commandSelftest();
  else if (command === 'clean') code = commandClean();
  else if (command === 'evidence') code = commandEvidence(args);
  else {
    console.error('usage: style-equality.mjs check|capture|show|selftest|clean|evidence');
    code = 2;
  }
  process.exit(code);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
