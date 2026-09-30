// Headless driver for the WG Data Export Viewer (Phase 1 build).
//
// What this does:
//   1. Launches headless Chromium against a running preview/dev server
//      (default http://localhost:4173).
//   2. Runs a representative demo flow that exercises every layer the
//      app exposes: page load, worker ready handshake, dropzone,
//      synthetic zip upload, worker classification, the dashboard
//      (identity header, section cards, unsupported banners), the
//      Playtime block (totals, split selector, calendar, hour grid and
//      duration list), Start over with its confirmation, and the
//      failure path.
//   3. Writes a screenshot at each milestone to /tmp/wot-viewer-shots/.
//
// Usage:
//   node .claude/skills/run-data-export-viewer/driver.mjs [--url URL]
//
// Prereq: the preview server must already be running (the Playwright
// config's webServer launches it, or `pnpm run preview` after
// `pnpm run build`).

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';

import { buildDemoSessionsCsv } from './sessions-csv.mjs';

const url = (() => {
  const i = process.argv.indexOf('--url');
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : 'http://localhost:4173';
})();

const shotsDir = '/tmp/wot-viewer-shots';
mkdirSync(shotsDir, { recursive: true });

// Build a small synthetic Wargaming-shaped export in memory with fflate
// (already a dep of the project). Same shape as tests/fixtures/export-fixtures.ts
// buildSampleExport(), minus the macOS-rezipped/directory-entries variants
// that aren't useful in a screenshot demo.
//
// The Sessions.csv entry carries the REAL six-column shape
// (SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP) and
// is built by sessions-csv.mjs, not written inline. The demo used to inline a
// two-column file, which the Phase 4 pipeline classifies as
// `no-usable-sessions` — the Playtime block came up empty and the screenshots
// proved nothing about the charts.
async function buildSampleZip() {
  const { zipSync, strToU8 } = await import('fflate');
  const root = '123456789';
  const entries = {
    [`${root}/Activity_history/Sessions.csv`]: strToU8(buildDemoSessionsCsv()),
    [`${root}/Activity_history/Logins.csv`]: strToU8('LOGIN_AT\n2024-01-01\n'),
    [`${root}/Player_statistics/WOT_stats.csv`]: strToU8('x\n1\n2\n3\n'),
    [`${root}/Player_statistics/WOTB_stats.csv`]: strToU8('x\n1\n'),
    [`${root}/Player_statistics/WOWS_stats.csv`]: strToU8('x\n1\n'),
    [`${root}/Player_statistics/WOWP_19_stats.csv`]: strToU8('x\n1\n'),
    [`${root}/User_Info/Account_Info.csv`]: strToU8('ID;NAME;CREATED_AT;ACTIVATED_AT;IP;COUNTRY_CODE;REGION;CITY;LOGIN;USER_LANGUAGE;USER_STATED_COUNTRY;BIRTH_DATE;BIRTH_DATE_SRC\n1;Tester;2024-01-01;2024-01-02;192.0.2.10;UA;EU;Kyiv;synthetic.player@example.invalid;en;UA;1990-01-01;id\n'),
    [`${root}/Payment_history/Orders.csv`]: strToU8('ACTION_DT;GAME_CODE;ITEM_CNT;PAYMENT_CURRENCY;PAYED_IN_CURR_AMT;IS_GIFT;ORDER_UUID;PAY_COUPON_NAME;PAY_ORDER_STATUS_CODE\n2024-01-01;WOT;1;USD;9.99;0;uuid;NONE;PAID\n'),
    [`${root}/Chat_history/Messages.csv`]: strToU8('m\n1\n'),
    [`${root}/Clans/Clan_membership.csv`]: strToU8('m\n1\n'),
    [`${root}/Bans/Bans.csv`]: strToU8('b\n1\n'),
    [`${root}/Device_info/Devices.csv`]: strToU8('d\n1\n'),
  };
  return Buffer.from(zipSync(entries));
}

function logShot(name) {
  const p = resolve(shotsDir, `${name}.png`);
  console.log(`  screenshot -> ${p}`);
  return p;
}

// Dev-driver only: --no-sandbox is required in sandboxed agent runtimes, where the agent process is already sandboxed and a second sandbox layer stops Chromium from launching; the shipped app never launches Chromium.
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

// Surface page errors so a broken page is loud, not silent.
page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error(`[console.error] ${msg.text()}`);
});

console.log(`Navigating to ${url} ...`);
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Wait for the eager worker to report ready (max 10 s).
await page.locator('main').waitFor({ state: 'visible' });
await page
  .locator('main[data-worker-ready="true"]')
  .waitFor({ timeout: 10_000 });
console.log('  worker ready');
await page.screenshot({ path: logShot('01-empty-dropzone'), fullPage: true });

// Drop the synthetic export through the visible file input (same path
// a real drag-and-drop takes once the dataTransfer is wired).
const sampleZip = await buildSampleZip();
console.log('Uploading synthetic zip ...');
await page.getByTestId('file-input').setInputFiles({
  name: 'sample-export.zip',
  mimeType: 'application/zip',
  buffer: sampleZip,
});

// Catch the processing-status paragraph while it's still visible. Since
// the dashboard shell (D-26) it lives inside the import bar's notice
// slot rather than inside the dropzone. MIN_PROCESSING_MS = 400ms floor;
// often captured mid-spinner.
try {
  await page.getByTestId('processing-status').waitFor({ state: 'visible', timeout: 1000 });
  await page.screenshot({ path: logShot('02-processing'), fullPage: true });
  console.log('  processing visible');
} catch {
  console.log('  processing not captured (too fast on this machine)');
}

// Wait for the dashboard: the bar goes slim and the identity header
// fills in once the worker has classified the export.
await page.getByTestId('identity-nickname').waitFor({ state: 'visible', timeout: 30_000 });
const nickname = await page.getByTestId('identity-nickname').innerText();
const accountId = await page.getByTestId('identity-account-id').innerText();
const sectionCount = await page.locator('[data-testid^="dashboard-section-"]').count();
const bannerCount = await page.getByTestId('unsupported-banner').count();
console.log(`  nickname: "${nickname}"`);
console.log(`  account id: "${accountId}"`);
console.log(`  sections: ${sectionCount}, unsupported banners: ${bannerCount}`);
await page.screenshot({ path: logShot('03-dashboard'), fullPage: true });

// Playtime block. The demo data is 30 usable sessions over 21 days in three
// servers plus one excluded row, so the block reaches `ready` with hand-
// derivable tiles: 31.2 hours, 30 sessions, 21 active days, 366 calendar
// cells (2024 is a leap year), 168 hour cells and 12 duration bins, and a
// four-option selector (All, EU1, EU2, NA1).
//
// Only TILE TEXT and ELEMENT COUNTS are logged. Never a CSV row and never an
// address: this output is pasted into notes and commits, and the Sessions
// address column is never rendered by the app (T-04-01).
await page
  .locator('[data-testid="playtime"][data-state="ready"]')
  .waitFor({ state: 'visible', timeout: 30_000 });
const tileText = async (testId) =>
  ((await page.getByTestId(testId).innerText()) ?? '').replace(/\s+/g, ' ').trim();
console.log(`  playtime hours: "${await tileText('playtime-total-hours')}"`);
console.log(`  playtime sessions: "${await tileText('playtime-total-sessions')}"`);
console.log(`  playtime active days: "${await tileText('playtime-active-days')}"`);
console.log(
  `  playtime selector options: ${await page.locator('[data-testid="playtime-selector"] option').count()}`,
);
console.log(
  `  playtime cells: ${await page.locator('[data-testid="calendar-cell"]').count()} calendar, ` +
    `${await page.locator('[data-testid="hour-cell"]').count()} hour, ` +
    `${await page.locator('[data-testid="duration-bin"]').count()} duration bins`,
);
await page.screenshot({ path: logShot('03b-playtime'), fullPage: true });

// Click Start over — it CONFIRMS first (D-15/D-16), so wait for the
// confirm panel and commit before expecting the bar to go full again.
await page.getByTestId('start-over').click();
await page.getByTestId('confirm-panel').waitFor({ state: 'visible', timeout: 5_000 });
await page.screenshot({ path: logShot('04-start-over-confirm'), fullPage: true });
await page.getByTestId('confirm-commit').click();
await page
  .locator('[data-testid="import-bar"][data-variant="full"]')
  .waitFor({ state: 'visible', timeout: 5_000 });
await page.getByTestId('dropzone').waitFor({ state: 'visible', timeout: 5_000 });
await page.screenshot({ path: logShot('05-start-over-cleared'), fullPage: true });
console.log('  start-over confirmed, dropzone re-armed');

// Demonstrate the failure path: drop a non-zip.
console.log('Uploading a non-zip to exercise failure path ...');
await page.getByTestId('file-input').setInputFiles({
  name: 'readme.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('not a wargaming export'),
});
await page.getByTestId('failure-banner').waitFor({ state: 'visible', timeout: 5_000 });
await page.screenshot({ path: logShot('06-failure-banner'), fullPage: true });
const banner = await page.getByTestId('failure-banner').innerText();
console.log(`  banner: "${banner.slice(0, 80)}..."`);

await browser.close();
console.log('Done. Screenshots in /tmp/wot-viewer-shots/');
