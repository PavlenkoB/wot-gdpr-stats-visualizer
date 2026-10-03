/**
 * Main-thread quick check for a dropped or picked File list.
 *
 * Runs synchronously on the main thread before any postMessage to the
 * ingest worker. Every failure here is a UI affordance rejection
 * (wrong extension, wrong count, empty file) — the worker would have
 * surfaced exactly the same conclusion via fflate / classify errors,
 * but doing the check here means:
 *
 *   1. The failure banner shows up before the user sees a "working"
 *      flicker (success criterion 2 — same banner, no surprise).
 *   2. The cause names the UI-level reason, which the worker can't
 *      see (extension, count). The cause goes to console.error only
 *      (D-05); the on-screen message is the single D-04 sentence.
 *   3. The worker is reserved for actual zip bytes, so a wrong-type
 *      file can't waste its CPU on a parse it can never finish.
 *
 * The function is intentionally order-sensitive: a single check at a
 * time so each cause has a stable meaning. Order matches the plan:
 *
 *   1. length === 0           → "no file in the selection"
 *   2. length > 1             → "expected exactly one file, got <n>"
 *   3. ! /\.zip$/i.test(name) → "file name does not end in .zip"
 *   4. size === 0             → "file is empty (0 bytes)"
 *
 * The MIME type is deliberately NOT inspected: browsers disagree
 * (application/zip, application/x-zip-compressed, an empty string,
 * or even text/plain when dragged from a Finder window that strips
 * the type). The extension is the stable signal (FA-01-04-2).
 *
 * The returned string is a CONSOLE-ONLY cause. It is never rendered
 * anywhere in src/ — the on-screen banner is GENERIC_FAILURE_MESSAGE.
 */
export type PrecheckCause =
  | 'no file in the selection'
  | 'expected exactly one file'
  | 'file name does not end in .zip'
  | 'file is empty (0 bytes)';

export interface PrecheckFailure {
  cause: PrecheckCause;
  detail: string;
}

export function precheckFiles(files: ArrayLike<File>): PrecheckFailure | null {
  if (files.length === 0) {
    return { cause: 'no file in the selection', detail: 'the drop or pick contained zero files' };
  }
  if (files.length > 1) {
    return {
      cause: 'expected exactly one file',
      detail: `the selection contained ${files.length} files; only one is allowed`,
    };
  }
  const file = files[0]!;
  if (!/\.zip$/i.test(file.name)) {
    return {
      cause: 'file name does not end in .zip',
      detail: `file name "${file.name}" does not end in .zip`,
    };
  }
  if (file.size === 0) {
    return { cause: 'file is empty (0 bytes)', detail: `file "${file.name}" has 0 bytes` };
  }
  return null;
}
