import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

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
 *   - 01-04's spec (tests/e2e/import-failure.spec.ts) repeats the
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
