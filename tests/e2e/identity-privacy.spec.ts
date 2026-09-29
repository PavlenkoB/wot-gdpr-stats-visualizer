import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import {
  SAMPLE_BIRTH_DATE,
  SAMPLE_LOGIN,
  SAMPLE_NICKNAME,
  SAMPLE_REGION,
  buildAccountInfoVariantExport,
  buildCaseVariantFoldersExport,
  buildLowercaseUserInfoFolderExport,
  buildSampleExport,
  VARIANT_NICKNAME,
  VARIANT_OVERFLOW_CANARY,
} from '../fixtures/export-fixtures.ts';

// =============================================================================
// 03-04 — SC1 / D-18 / D-20 / D-21 privacy-leak spec
// =============================================================================
//
// The worker strips LOGIN, BIRTH_DATE and BIRTH_DATE_SRC before anything
// crosses to the main thread (Plan 03-01), and only a three-field identity
// is published. This spec is the PROOF that the stripped values are not
// merely absent from the visible page but absent from every surface a user
// or a script can observe:
//
//   - the rendered text,
//   - `document.documentElement.outerHTML` (which includes <title>, every
//     attribute of every element, and any hidden node),
//   - the accessibility tree (accessible names, which a CSS-hidden or
//     attribute-only leak would still expose),
//   - the console, on BOTH the page and the web worker,
//   - IndexedDB, read through the raw `indexedDB` API rather than Dexie, so
//     the assertion is about what is actually at rest and not about what
//     the app's own read path chooses to load.
//
// The control assertion is as important as the negative ones: the IP column
// is NOT stripped, so the dump must still contain it. Without that, a spec
// that read an empty dump (wrong store names, wrong database version, an
// upgrade that wiped everything) would pass every negative assertion while
// proving nothing.
//
// The three variant exports are the shapes where a naive strip leaks:
// `buildAccountInfoVariantExport` uses lowercase headers, padded headers,
// a missing REGION column and an overflow cell, and the other two vary the
// folder's casing, so a strip keyed on an exact header string misses them.
// =============================================================================

/**
 * The static document title, asserted on every path (D-21): the nickname
 * must never be promoted out of the header's own visible text.
 */
const DOCUMENT_TITLE = 'WG Data Export Viewer';

/**
 * The distinctive substrings the strip must remove. The fixtures use an
 * `.invalid` TLD and a birth date far from `CREATED_AT`, so neither can
 * false-positive on a legitimately displayed value.
 */
const EMAIL_DOMAIN = SAMPLE_LOGIN.slice(SAMPLE_LOGIN.indexOf('@') + 1);
const STRIPPED_KEYS = ['LOGIN', 'BIRTH_DATE', 'BIRTH_DATE_SRC'] as const;

/**
 * Start collecting console output from the page AND from every web worker
 * the page creates.
 *
 * This MUST be called before the first navigation: the ingest worker is
 * spawned by `IngestClient`'s constructor during module init, and Playwright
 * emits `page.on('worker')` only at spawn time. A collector registered after
 * `goto` would therefore see the worker only if it happened to be respawned.
 */
function collectConsole(page: Page): string[] {
  const messages: string[] = [];
  const record = (message: ConsoleMessage): void => {
    messages.push(message.text());
  };
  page.on('console', record);
  page.on('worker', (worker) => {
    worker.on('console', record);
  });
  return messages;
}

/** Wait for the app shell to be up and the worker to have acknowledged. */
async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
}

/** Import in-memory zip bytes through the dropzone's real file input. */
async function importZip(page: Page, bytes: Uint8Array, name: string): Promise<void> {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
}

/** The raw export filename used for every synthetic archive. */
const ZIP_NAME = 'synthetic-export.zip';

/**
 * Everything a script on the page can read off the DOM, in one round-trip.
 */
interface PageSurface {
  outerHtml: string;
  title: string;
  innerText: string;
}

async function readPageSurface(page: Page): Promise<PageSurface> {
  return page.evaluate(() => ({
    outerHtml: document.documentElement.outerHTML,
    title: document.title,
    innerText: document.body.innerText,
  }));
}

/**
 * The accessibility snapshot, which covers accessible names that neither
 * `innerText` nor a substring search of the markup can see.
 */
async function readAriaSnapshot(page: Page): Promise<string> {
  return page.locator('body').ariaSnapshot();
}

/**
 * A raw, dependency-free dump of the `rows` and `meta` object stores.
 *
 * The raw `indexedDB` API is used on purpose: Dexie would only show what the
 * app decides to read, and this assertion is about what is AT REST.
 */
async function readIndexedDbDump(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('wg-export-viewer');
        open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
        open.onsuccess = () => {
          const db = open.result;
          const stores = ['rows', 'meta'].filter((name) => db.objectStoreNames.contains(name));
          if (stores.length === 0) {
            db.close();
            resolve('[]');
            return;
          }
          const out: unknown[] = [];
          const tx = db.transaction(stores, 'readonly');
          for (const name of stores) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => out.push(request.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(JSON.stringify(out));
          };
          tx.onerror = () => reject(tx.error ?? new Error('read transaction failed'));
        };
      }),
  );
}

/** Escape a literal needle before counting its occurrences in a document. */
function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The SC1 leak assertion, applied to whatever page state is loaded.
 *
 * Every negative assertion is paired with the nickname-exactly-once and
 * IP-still-stored controls, so this cannot pass on an empty or missing page.
 */
async function expectNoSensitiveLeak(
  page: Page,
  consoleMessages: readonly string[],
  nickname: string,
): Promise<void> {
  const surface = await readPageSurface(page);
  const ariaSnapshot = await readAriaSnapshot(page);
  const dump = await readIndexedDbDump(page);

  // Rendered text: neither stripped value is readable.
  expect(surface.innerText).not.toContain(EMAIL_DOMAIN);
  expect(surface.innerText).not.toContain(SAMPLE_BIRTH_DATE);

  // The whole document, including <title>, every attribute and hidden nodes.
  expect(surface.outerHtml).not.toContain(EMAIL_DOMAIN);
  expect(surface.outerHtml).not.toContain(SAMPLE_BIRTH_DATE);

  // The static title (D-21).
  expect(surface.title).toBe(DOCUMENT_TITLE);

  // Accessible names, which a hidden or attribute-only leak would still expose.
  expect(ariaSnapshot).not.toContain(EMAIL_DOMAIN);
  expect(ariaSnapshot).not.toContain(SAMPLE_BIRTH_DATE);

  // The nickname appears exactly ONCE in the document — as the header text.
  expect(surface.outerHtml.match(new RegExp(escapeForRegExp(nickname), 'g')) ?? []).toHaveLength(1);

  // Nothing the page or the worker printed carried the stripped values, and
  // nothing printed the nickname (D-21 "logs").
  const logged = consoleMessages.join('\n');
  expect(logged).not.toContain(EMAIL_DOMAIN);
  expect(logged).not.toContain(SAMPLE_BIRTH_DATE);
  expect(logged).not.toContain(nickname);

  // At rest: the strip happened BEFORE the write, not on the read path.
  expect(dump).not.toContain(EMAIL_DOMAIN);
  expect(dump).not.toContain(SAMPLE_BIRTH_DATE);
  for (const key of STRIPPED_KEYS) {
    expect(dump).not.toContain(`"${key}"`);
  }
  // Control: the IP column is deliberately NOT stripped, so the dump must
  // still contain it. Without this an empty dump would pass everything above.
  expect(dump).toContain('"IP"');
}

test.describe('identity privacy (SC1, D-18, D-20, D-21)', () => {
  test('(a) a fresh import shows the cached identity and leaks neither the email nor the birth date anywhere', async ({
    page,
  }) => {
    const consoleMessages = collectConsole(page);
    await gotoApp(page);

    await importZip(page, buildSampleExport(), ZIP_NAME);
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    // The identity itself is present and correct.
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    await expect(page.getByTestId('identity-region')).toHaveText(SAMPLE_REGION);
    await expect(page.getByTestId('identity-created')).toHaveText('2020-01-01');

    await expectNoSensitiveLeak(page, consoleMessages, SAMPLE_NICKNAME);
  });

  test('(b) a return visit replays the identity from cache and still leaks nothing', async ({
    page,
  }) => {
    const consoleMessages = collectConsole(page);
    await gotoApp(page);

    await importZip(page, buildSampleExport(), ZIP_NAME);
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    // The reload path: the identity is replayed off the cached meta record,
    // so this proves the leak assertions hold for the CACHE too, not only
    // for the freshly parsed result still held in memory.
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    await expect(page.getByTestId('identity-region')).toHaveText(SAMPLE_REGION);
    await expect(page.getByTestId('identity-created')).toHaveText('2020-01-01');

    await expectNoSensitiveLeak(page, consoleMessages, SAMPLE_NICKNAME);
  });

  // ---------------------------------------------------------------------------
  // The header-shape variants: the shapes in which a strip keyed on an exact
  // header string silently fails (RESEARCH Q6).
  // ---------------------------------------------------------------------------

  const headerVariants: ReadonlyArray<{
    label: string;
    build: () => Uint8Array;
    nickname: string;
    extraNeedle: string | null;
  }> = [
    {
      label: 'lowercase and padded headers, a missing REGION column and an overflow cell',
      build: buildAccountInfoVariantExport,
      nickname: VARIANT_NICKNAME,
      // A PapaParse overflow cell holds values that no header names. Nothing
      // in it may survive into the cache either.
      extraNeedle: VARIANT_OVERFLOW_CANARY,
    },
    {
      label: 'a lowercased user_info folder',
      build: buildLowercaseUserInfoFolderExport,
      nickname: SAMPLE_NICKNAME,
      extraNeedle: null,
    },
    {
      label: 'case-variant folders including a duplicate LOGIN column',
      build: buildCaseVariantFoldersExport,
      nickname: SAMPLE_NICKNAME,
      extraNeedle: null,
    },
  ];

  for (const variant of headerVariants) {
    test(`(c) ${variant.label} leaks nothing`, async ({ page }) => {
      const consoleMessages = collectConsole(page);
      await gotoApp(page);

      await importZip(page, variant.build(), ZIP_NAME);
      await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('identity-nickname')).toHaveText(variant.nickname);

      if (variant.extraNeedle !== null) {
        // The canary lives in a header-less overflow cell; if it survived the
        // parse it would be in the DOM, so assert the full leak surface.
        const surface = await readPageSurface(page);
        expect(surface.outerHtml).not.toContain(variant.extraNeedle);
        const dump = await readIndexedDbDump(page);
        expect(dump).not.toContain(variant.extraNeedle);
      }

      await expectNoSensitiveLeak(page, consoleMessages, variant.nickname);
    });
  }
});
