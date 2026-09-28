import type { CategoryStatus, IngestStage } from './types/worker-messages.ts';

/**
 * Single source of truth for the D-04 generic failure message.
 * It is the only place this string may exist in src/. Per D-07, every
 * import failure mode (pre-check rejection, mid-processing exception,
 * structurally-unrecognizable zip) routes through this single banner.
 */
export const GENERIC_FAILURE_MESSAGE =
  "This doesn't look like a Wargaming data export. Drop the .zip file you received from Wargaming's GDPR export request.";

/**
 * The hand-rolled dropzone's prompt text (D-15). It must not echo the
 * failure sentence — the failure copy is for failures, the prompt is
 * for the idle state. Two different jobs, two different lines.
 */
export const DROPZONE_PROMPT =
  'Drop your Wargaming data export (.zip) here, or click to choose it.';

/**
 * Stage-driven copy the dropzone shows while busy. The map is keyed by
 * the worker's IngestStage contract (D-09, unchanged) so any new stage
 * added to the contract must be added here too — TypeScript catches a
 * missing key at the call site. The ellipsis is part of the copy so
 * the Playwright assertions can match the literal pattern.
 */
export const STAGE_TEXT: Record<IngestStage, string> = {
  unzipping: 'Unzipping...',
  classifying: 'Classifying folders...',
};

/**
 * One-line summary of how the export's category folders partition into
 * the three status buckets. All three buckets are ALWAYS rendered, in
 * a stable order, even when their counts are zero — the visual
 * fingerprint of the summary is its three parts, not its count values
 * (D-03, FA-01-05-2).
 *
 * The separator is U+00B7 (middle dot) flanked by single spaces. We
 * pick U+00B7 because it is the lightest glyph that still reads as a
 * separator on small fonts and at large font sizes, and because it
 * is unambiguous (no hyphen / em-dash confusion in copy review).
 */
export function formatSummary(counts: Record<CategoryStatus, number>): string {
  return `${counts.supported} supported · ${counts['known-deferred']} known-deferred · ${counts.unknown} unknown`;
}

/**
 * "1 file" / "N files" (the singular form is required — Phase 1's UI
 * displays the count inline with the folder name, so "1 files" would
 * read as a bug). The function takes a non-negative integer; callers
 * never pass a negative count.
 */
export function formatFileCount(n: number): string {
  return n === 1 ? '1 file' : `${n} files`;
}

/**
 * The account heading. The root folder name is treated as an
 * UNTRUSTED zip-entry string (an attacker can craft the archive);
 * the function deliberately does not interpolate it into HTML or
 * strip any character — Svelte's text interpolation in
 * ResultsView.svelte escapes it for us, and the heading is plain
 * text per the no-at-html-tags lint rule.
 *
 * Format is `Account: <root>` (D-11 — the raw numeric ID from the
 * detected root folder, presented without the "ID:" suffix and
 * without quotes).
 */
export function formatAccountHeading(root: string): string {
  return `Account: ${root}`;
}

/**
 * Label of the explicit "Start over" affordance on the results view.
 * Plain English, no emoji, no extra punctuation (D-13).
 */
export const START_OVER_LABEL = 'Start over';
