import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

/**
 * A single file payload as it is passed from the test runner into the
 * page. The test code holds the bytes as a plain number array (the
 * serialisable form that survives `page.evaluate`'s cross-realm
 * boundary); the page-side code constructs a real `File` from them.
 */
export interface DropFileSpec {
  name: string;
  mimeType: string;
  bytes: number[];
}

/**
 * Synthesise a DataTransfer and dispatch a `dragenter` + `dragover` +
 * `drop` sequence on the target locator. The DataTransfer carries the
 * given files, which are built from the page-side `Uint8Array` +
 * `File` constructors (so the drop is indistinguishable from a real
 * OS-level drop in the running app — no synthetic events, no
 * setInputFiles shim).
 *
 * Usage:
 *   await dropFiles(page, page.getByTestId('dropzone'), [
 *     { name: 'export.zip', mimeType: 'application/zip', bytes: [...buildSampleExport()] },
 *   ]);
 *
 * Why a single helper (instead of inline `page.evaluate` blocks):
 *   - 01-04's spec (tests/e2e/import/import-failure.spec.ts) repeats the
 *     same shape across 7+ failure modes.
 *   - 01-05 will use the same dropFiles for the happy-path drag
 *     test alongside the click path. A shared helper means future
 *     plans do not reinvent the DataTransfer dance.
 *
 * Why `dispatchEvent` rather than the deprecated
 * `page.dispatchEvent` with a JSHandle: Playwright's synthetic event
 * pathway accepts a native DragEvent with a DataTransfer payload,
 * but the receiving handler reads `event.dataTransfer.files`. We
 * dispatch the event with a real DataTransfer (constructed inside
 * `page.evaluateHandle`) attached, so the Svelte handler sees the
 * exact same shape it would see from a real OS drop.
 */
export async function dropFiles(
  page: Page,
  target: Locator,
  files: ReadonlyArray<DropFileSpec>,
): Promise<void> {
  // Build the DataTransfer on the page side so its constructor and
  // the File list live in the same realm as the listeners.
  const dataTransferHandle = await page.evaluateHandle((filesJson: DropFileSpec[]) => {
    const dt = new DataTransfer();
    for (const { name, mimeType, bytes } of filesJson) {
      const u8 = new Uint8Array(bytes);
      const f = new File([u8], name, { type: mimeType });
      dt.items.add(f);
    }
    return dt;
  }, files as DropFileSpec[]);

  // Element handle on the dropzone — dispatchEvent on the locator
  // would not accept our DataTransfer payload, so we go through the
  // element directly.
  const elementHandle = await target.elementHandle();
  if (!elementHandle) {
    throw new Error('dropFiles: target locator did not resolve to an element handle');
  }

  // Playwright's dispatchEvent accepts a JSHandle for the
  // dataTransfer init detail. We pass it through.
  await elementHandle.dispatchEvent('dragenter', { dataTransfer: dataTransferHandle });
  await elementHandle.dispatchEvent('dragover', { dataTransfer: dataTransferHandle });
  await elementHandle.dispatchEvent('drop', { dataTransfer: dataTransferHandle });

  await dataTransferHandle.dispose();
}

/**
 * The import counts line of one section card, whichever variant it renders.
 *
 * A section shows its counts in one of two elements, and which one is a
 * property of its status, not of the counts: a `pending`, `empty`,
 * `no-export` or `not-loaded` card renders them as the body
 * (`section-summary`), while a `ready` card renders them as the caption
 * AFTER the dashboard it belongs to (`section-caption`) — D-09, so a built
 * dashboard can never hide how much was actually imported.
 *
 * Since 04-02 the set of ready sections is not empty, so a test that reads a
 * card's counts cannot name a test id: asking for the one that section
 * happens to use would make every status change a test rewrite, and would
 * make this helper's callers silently pass on an empty locator rather than
 * fail. This returns the single line either way, and still resolves to
 * exactly one element — `toHaveText` on a locator matching two nodes fails
 * rather than comparing the concatenation.
 */
export function importLine(card: Locator): Locator {
  return card.locator('[data-testid="section-summary"], [data-testid="section-caption"]');
}

/**
 * The import counts line of every section card on the page, in document
 * order.
 *
 * The page-wide form of `importLine`, for the tests that snapshot all four
 * summaries and compare the collection before and after a reload. Using
 * this rather than a bare `section-summary` selector is what keeps the
 * collection at four once a section is ready: the counts are always on
 * screen, only the element carrying them changes.
 */
export function importLines(page: Page): Locator {
  return page.locator('[data-testid="section-summary"], [data-testid="section-caption"]');
}

// =============================================================================
// Phase 4, plan 04-11 — the import-path helpers the Playtime specs share
// =============================================================================
//
// Every one of these is a thin wrapper over a step the specs would otherwise
// repeat, and none of them asserts a phase-4 value: the numbers come from
// `tests/fixtures/playtime-hand-fixture.ts` as literals, and a helper that
// returned a reading from the page would let an expectation be computed from
// the thing it is supposed to check. What these helpers wait for is
// STRUCTURE — "the shell is up", "a dataset is on screen" — and every wait is
// on a hook that exists in every state, so a helper cannot paper over a state
// the spec meant to observe.

/** The raw export filename every synthetic archive is dropped under. */
export const SYNTHETIC_ZIP_NAME = 'synthetic-export.zip';

/**
 * Open the app and wait for the shell and the worker.
 *
 * The `data-worker-ready` attribute is set by the ingest worker itself, so
 * waiting on it is waiting for the pipeline to exist — not for any particular
 * dataset. Nothing about playtime is waited for here.
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
}

/**
 * The Activity_history card: the section whose dashboard carries the Playtime
 * block, the split table and all three charts.
 */
export function openActivity(page: Page): Locator {
  return page.getByTestId('dashboard-section-activity-history');
}

/**
 * The Playtime block itself, the element that carries `data-state`.
 *
 * A test that asserted on the block rather than on a descendant can name the
 * state in one step and cannot accidentally match a `playtime-*` test id that
 * belongs to a different card.
 */
export function playtimeBlock(page: Page): Locator {
  return page.getByTestId('playtime');
}

// =============================================================================
// Phase 5 — the four block locators and the financial section (plan 05-10)
// =============================================================================
//
// Declared HERE, all five at once, and not added to as later plans land. Two
// reasons, and the second is the one that matters: plans 05-12 to 05-15 run in
// the same wave as this one, so a helper added later would be a file two of
// them edit at once. One owner, one commit, no merge conflict in a test helper.
//
// Each is a one-line wrapper returning one locator, and none of them asserts a
// value — the expected numbers come from `tests/fixtures/finance-fixtures.ts`
// and `vehicle-*-fixtures.ts` as literals, computed through the `ui-copy`
// formatters. A locator that returned a reading from the page would let an
// expectation be computed from the thing it is meant to check.

/**
 * The Premium time sub-block, the element that carries `data-state` (05-10).
 *
 * One of the two Financial sub-blocks D-02 gave a state of its own, and the
 * first to reach the screen.
 */
export function premiumBlock(page: Page): Locator {
  return page.getByTestId('premium-block');
}

/** The Virtual currency sub-block (plan 05-13). */
export function currencyBlock(page: Page): Locator {
  return page.getByTestId('currency-block');
}

/** The Real-money spend block of the Payment_history card (plan 05-15). */
export function spendBlock(page: Page): Locator {
  return page.getByTestId('spend-block');
}

/** The Player statistics block, the element that carries `data-state` (plan 05-12). */
export function playerStatsBlock(page: Page): Locator {
  return page.getByTestId('player-stats');
}

// =============================================================================
// Phase 6 — the login block's locators and the failing-query helper (plan 06-08)
// =============================================================================
//
// Declared HERE, all of them at once, and NOT added to as the later Phase 6
// plans land. The reason is the one 05-10 recorded for its own five: plans
// 06-10, 06-12 and 06-13 build the table, the map and the city opt-in, and a
// locator added by one of them would be a file the other two also edit. One
// owner, one commit, no merge conflict in a test helper.
//
// Each is a one-line wrapper returning one locator, and NONE of them asserts a
// value — the expected numbers come from `tests/fixtures/logins-fixtures.ts` as
// literals, computed through the `ui-copy` formatters. A locator that returned a
// reading from the page would let an expectation be computed from the thing it
// is meant to check.
//
// Five of these six are for surfaces plans 06-10 to 06-13 build, so they are
// declared here and return a locator that currently matches nothing. That is
// deliberate and harmless: a locator that resolves to zero elements fails the
// assertion that uses it, exactly as it should, rather than being written later
// in a file two plans share.

/**
 * The Login history block, the element that carries `data-state` (06-08).
 *
 * The one locator a test names to read the block's state in a single step, so
 * it cannot accidentally match a `login-*` hook belonging to a sub-block.
 */
export function loginHistoryBlock(page: Page): Locator {
  return page.getByTestId('login-history');
}

/** The IP table itself (plan 06-10). */
export function loginTable(page: Page): Locator {
  return page.getByTestId('login-table');
}

/** The table's scroller, the one focus stop for both axes (plan 06-10). */
export function loginScroller(page: Page): Locator {
  return page.getByTestId('login-scroller');
}

/** The world map's `<svg>` (plan 06-12). */
export function loginMap(page: Page): Locator {
  return page.getByTestId('login-map');
}

/** The collapsible ranked country list (plan 06-12). */
export function countryList(page: Page): Locator {
  return page.getByTestId('country-list');
}

/** The city-level opt-in block, the element that carries `data-state` (plan 06-13). */
export function cityOptIn(page: Page): Locator {
  return page.getByTestId('city-optin');
}

/**
 * Make the post of every `data-query` for the `logins` channel throw.
 *
 * The same seam as `failPlaytimeQueryFor`, and the same reasoning: a query that
 * cannot be asked is a state the block renders, so this is the real path and
 * not a stub of the worker — `QueryClient.query` already wraps its post in a
 * `try`/`catch` and turns a throw into `{ kind: 'error' }` (05-07, D-21). A
 * structured-clone failure is a real thing a `postMessage` can do, and it is
 * the cheapest way to reach the block's `error` state from a browser.
 *
 * It matches on the CHANNEL rather than on a call counter, so the test does not
 * depend on how many queries the page happened to make first: the Financial,
 * Player statistics and Spend blocks all post `data-query` messages too, and
 * only the login one is made to fail.
 *
 * MUST be called before the first navigation, because the worker is spawned
 * during module init and the client posts through the prototype this wraps.
 */
export async function failLoginsQuery(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function patched(
      this: Worker,
      message: unknown,
      ...rest: unknown[]
    ) {
      const query =
        typeof message === 'object' && message !== null
          ? (message as { type?: unknown; query?: { channel?: unknown } })
          : null;
      if (query?.type === 'data-query' && query.query?.channel === 'logins') {
        // The app never reads the thrown value (D-21), so nothing here can
        // reach the DOM; the console is the only place it exists.
        throw new Error('synthetic post failure');
      }
      original.apply(this, [message, ...rest] as never);
    };
  });
}

/**
 * The `Financial_data` card, the section whose dashboard holds both sub-blocks.
 *
 * `data-status` on this element is the SECTION's status and not a sub-block's:
 * the section is `ready` when EITHER of its two files has rows, so a card can
 * be `ready` while one of the sub-blocks inside it reads `not-in-export`.
 */
export function financialSection(page: Page): Locator {
  return page.getByTestId('dashboard-section-financial-data');
}

/** Set the dropzone's real file input and wait for a dataset to be on screen. */
export async function importExport(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  await waitForImported(page);
}

/**
 * Pick a synthetic archive into the dropzone's real file input BY PATH.
 *
 * Use this, and not `setInputFiles({ buffer })`, in a spec whose assertion
 * measures the MAIN THREAD between the pick and the dashboard (a `longtask`
 * observer). An in-memory payload is not handed to the browser as a file: it is
 * base64-encoded over the protocol and decoded INSIDE THE PAGE, on its main
 * thread, by playwright-core's injected script
 *
 *     Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
 *
 * and only then is the `change` event dispatched. That is one main-thread task
 * proportional to the payload (3.6 MB of zip is a 140 ms long task on a fast
 * machine, 1,052-1,420 ms under 8-10x CPU throttling, and 1,216 ms on the CI
 * runner that failed import-flow (f)), it ends BEFORE the app has seen the file,
 * and it is the harness's, not the app's. A path goes through DOM.setFileInputFiles
 * instead: the page receives a disk-backed `File` with no decode at all, which is
 * also what a real pick or drop hands the app.
 *
 * The bytes are synthetic (every caller builds them from `tests/fixtures`) and
 * are written under the test's own output directory, which is git-ignored and
 * wiped at the start of the next run. `name` must keep the `.zip` extension: the
 * app's pre-check rejects anything else.
 */
export async function pickExportFromDisk(
  page: Page,
  testInfo: TestInfo,
  name: string,
  bytes: Uint8Array,
): Promise<void> {
  const path = testInfo.outputPath(name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  await page.getByTestId('file-input').setInputFiles(path);
}

/**
 * Wait until an import has landed, without waiting for any particular
 * dashboard's numbers.
 *
 * The signal is the Activity_history section's `data-status` LEAVING
 * `not-loaded`. `not-loaded` is the only status a page with no dataset can
 * show, and every completed import moves it to `ready`, `empty`, `pending` or
 * `no-export` — so this waits for "the import finished" and nothing more.
 *
 * The identity header is deliberately NOT the signal. The hand fixture is
 * built from Sessions.csv alone, so it has no `User_Info` row and the header
 * renders the D-16 FALLBACK (the account ID as the title) with no
 * `identity-nickname` element at all. A wait on the nickname would time out on
 * the very fixture the specs are built around, and adding a `User_Info` folder
 * to reach it would put an unrelated claim into these tests.
 *
 * A spec that wants the numbers waits for `playtime[data-state]` itself, which
 * is a strictly later moment and is what every playtime assertion uses.
 */
export async function waitForImported(page: Page): Promise<void> {
  await expect(openActivity(page)).not.toHaveAttribute('data-status', 'not-loaded', {
    timeout: 30_000,
  });
}

/**
 * Import a second export, confirming the replace.
 *
 * A drop onto a page that already holds a dataset opens the confirm panel
 * BEFORE anything is processed (Phase 3's replace-on-drop rule), so a test
 * that sets the file input twice without confirming waits for a panel nobody
 * dismisses. Confirming here and waiting for the new dataset's identity is the
 * whole difference between this and `importExport`.
 */
export async function replaceExport(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  // A different zip is a different archive, so fflate's mtime stamp cannot
  // make the two byte-identical and the duplicate path is not reachable here.
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });

  const panel = page.getByTestId('confirm-panel');
  await expect(panel).toBeVisible();
  await panel.getByTestId('confirm-commit').click();
  await expect(panel).toHaveCount(0);
  await waitForImported(page);
  // The block settles on the new dataset's numbers. Proving that the dataset
  // actually CHANGED is the caller's job and the selector-reset test does it
  // by reading the option list; what this helper guarantees is only that the
  // replace completed and the page is no longer mid-confirm.
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', /ready|updating|error/, {
    timeout: 30_000,
  });
}

/**
 * Start over, and commit the destructive clear.
 *
 * Returns once the persistent bar is back, which is the state that means the
 * cached dataset is gone and a fresh import will be treated as a first import
 * rather than a replace.
 */
export async function startOver(page: Page): Promise<void> {
  await page.getByTestId('start-over').click();
  const panel = page.getByTestId('confirm-panel');
  await expect(panel).toBeVisible();
  await panel.getByTestId('confirm-commit').click();
  await expect(page.getByTestId('start-over')).toHaveCount(0);
}

/**
 * Delay every `playtime-query` message the worker is sent, by `ms`.
 *
 * `loading` and `updating` are the only two states that exist while an answer
 * is in flight, so neither is observable without making the answer late. There
 * is no network involved and no stub of the worker: this wraps
 * `Worker.prototype.postMessage` and defers the message, so the real worker
 * runs, really parses, and really answers — the page simply has not heard yet.
 *
 * MUST be called before the first navigation, because the worker is spawned
 * during module init and there is nothing to wrap afterwards.
 */
/**
 * Make the post of every `playtime-query` for ONE split index throw.
 *
 * A query that cannot be asked is a state the block renders, so this is the
 * real seam and not a stub of the worker: `PlaytimeClient.query` already wraps
 * its post in a `try`/`catch` and turns a throw into `{ kind: 'error' }`
 * (04-07, D-21). A structured-clone failure is a real thing a `postMessage` can
 * do, and it is the cheapest way to reach the error state from a browser.
 *
 * Indexed by `valueIndex` rather than by a call counter so the test does not
 * depend on how many queries the page happened to make first: the initial load
 * and the `All` option both ask for `null`, and only a real selection change
 * carries an index.
 *
 * MUST be called before the first navigation, because the worker is spawned
 * during module init and the client posts through the prototype this wraps.
 */
export async function failPlaytimeQueryFor(page: Page, valueIndex: number): Promise<void> {
  await page.addInitScript((target: number) => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function patched(
      this: Worker,
      message: unknown,
      ...rest: unknown[]
    ) {
      const query =
        typeof message === 'object' && message !== null
          ? (message as { type?: unknown; valueIndex?: unknown })
          : null;
      if (query?.type === 'playtime-query' && query.valueIndex === target) {
        // The app never reads the thrown value (D-21), so nothing here can
        // reach the DOM; the console is the only place it exists.
        throw new Error('synthetic post failure');
      }
      original.apply(this, [message, ...rest] as never);
    };
  }, valueIndex);
}

/**
 * Delete the origin's cached dataset from a SECOND page, the way a second tab
 * clearing its data does (D-27).
 *
 * The first page is not told. It keeps its in-memory `ClassifyResult` and the
 * last answer it applied, so the next query it issues reaches a worker whose
 * store is gone — which is exactly the window `acceptOutcome` has to survive
 * and that no single-tab flow can open. Dexie closes its connection on
 * `versionchange` with `disableAutoOpen: false`, so the worker's next read
 * reopens an EMPTY database and answers `importedAt: null, view: null` rather
 * than throwing.
 *
 * The database name is the literal from `src/lib/worker/db.ts`; the module
 * itself is not imported, because it instantiates a Dexie connection on load
 * and a test must never open the app's store from the test process.
 */
export async function clearCachedDatasetFromSecondTab(context: BrowserContext): Promise<void> {
  const other = await context.newPage();
  try {
    await other.goto('/');
    await other.evaluate(
      (name: string) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
          request.onblocked = () => reject(new Error('deleteDatabase blocked'));
        }),
      'wg-export-viewer',
    );
  } finally {
    await other.close();
  }
}

export async function delayPlaytimeQueries(page: Page, ms: number): Promise<void> {
  await page.addInitScript((delay: number) => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function patched(
      this: Worker,
      message: unknown,
      ...rest: unknown[]
    ) {
      const isQuery =
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === 'playtime-query';
      if (!isQuery) {
        original.apply(this, [message, ...rest] as never);
        return;
      }
      // `structuredClone` rather than the original object: a caller may reuse
      // or mutate the message after posting, and the delay is long enough for
      // that to matter.
      const copy = structuredClone(message);
      window.setTimeout(() => {
        original.apply(this, [copy, ...rest] as never);
      }, delay);
    };
  }, ms);
}
