import type { Locator, Page } from '@playwright/test';

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
