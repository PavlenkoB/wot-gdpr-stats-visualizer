import type { NavId, NavMutedReason, SectionStatus } from './dashboard-status.ts';
import type { IngestStage, ParsingProgress } from './types/worker-messages.ts';

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
 * the worker's IngestStage contract (D-09, extended in 02-01) so any
 * new stage added to the contract must be added here too — TypeScript
 * catches a missing key at the call site. The ellipsis is part of the
 * copy so the Playwright assertions can match the literal pattern.
 */
export const STAGE_TEXT: Record<IngestStage, string> = {
  hashing: 'Checking for a duplicate...',
  unzipping: 'Unzipping...',
  classifying: 'Classifying folders...',
  parsing: 'Parsing categories...',
  writing: 'Saving to local storage...',
};

/**
 * Per-category parsing progress text (D-11). The literal pattern
 * `Parsing <category> (i/n)...` is what the dropzone displays while
 * the worker reports the per-category parsing stage. Playwright
 * assertions match against this exact format.
 */
export function formatParsingProgress(progress: ParsingProgress): string {
  return `Parsing ${progress.category} (${progress.categoryIndex}/${progress.categoryTotal})...`;
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
 * "1 row" / "N rows" — sibling of formatFileCount. D-05 requires every
 * category badge to display both the file count and the row count,
 * with the singular form preserved ("1 row", not "1 rows"). Locale-
 * aware thousands separators match the D-05 example in CONTEXT.md
 * ("1,204 rows").
 */
export function formatRowCount(n: number): string {
  return n === 1 ? '1 row' : `${n.toLocaleString()} rows`;
}

/**
 * D-04: "1 row skipped" / "N rows skipped". The skip-count tag is
 * ONLY rendered when `skippedRowCount > 0` (the conditional lives in
 * CategoryBadge.svelte, not here) — this helper exists purely to
 * keep the singular/plural copy consistent with formatRowCount /
 * formatFileCount, and to centralise the literal text for any future
 * Playwright assertion.
 */
export function formatSkippedRowCount(n: number): string {
  return n === 1 ? '1 row skipped' : `${n.toLocaleString()} rows skipped`;
}

/**
 * Label of the explicit "Start over" affordance on the results view.
 * Plain English, no emoji, no extra punctuation (D-13).
 */
export const START_OVER_LABEL = 'Start over';

/**
 * D-12: the duplicate-drop banner. Shown when the user re-drops the
 * exact same zip while a dataset is already cached. Verbatim from
 * 02-CONTEXT.md "Specific Ideas" — the on-screen banner, no emoji,
 * no extra punctuation.
 */
export const DUPLICATE_BANNER_MESSAGE = 'This export is already loaded — skipping re-import';

/**
 * D-08: brief loading text shown while the IndexedDB existence check
 * resolves on page init, BEFORE the empty dropzone or cached results
 * are decided. Coin of Claude's discretion — the phrasing matches the
 * existing STAGE_TEXT ellipsis pattern ("Checking for a duplicate...",
 * "Unzipping...", etc.) so the spinner block reads as one family.
 */
export const CACHE_CHECK_TEXT = 'Checking for a saved export...';

/**
 * D-10: "Imported on {Month D, YYYY}" e.g. "Imported on Sep 28, 2026".
 * The cached `importedAt` ISO string is fed through the browser's
 * `Date` constructor with `en-US` short-month formatting — the only
 * stable cross-locale lock-in the project relies on for v1. Centralised
 * here so 02-02's ResultsView render and any future Playwright assertion
 * both source the same string.
 */
export function formatImportedOn(isoDate: string): string {
  return `Imported on ${new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

/**
 * D-13: the ConfirmPanel body shown when a user drops a different
 * (hash-mismatched) zip while a dataset is already cached. Verbatim
 * from 02-UI-SPEC.md's Copywriting Contract table.
 */
export const CONFIRM_REPLACE_MESSAGE = 'Replace your current dataset with this new import?';

/**
 * D-13: ConfirmPanel dismiss-button label for the replace-on-drop
 * flow. The user can keep their current dataset without taking any
 * further action.
 */
export const KEEP_CURRENT_DATA_LABEL = 'Keep current data';

/**
 * D-13: ConfirmPanel commit-button label for the replace-on-drop
 * flow. This is the Primary CTA string for the destructive replace
 * confirmation (per the UI-SPEC Copywriting Contract's first row).
 */
export const REPLACE_DATASET_LABEL = 'Replace dataset';

/**
 * D-21: ConfirmPanel body shown when the user clicks either the
 * newly-destructive Start Over button OR the persistent "Clear my
 * cached data" control. Per D-22, the two entry points use the
 * IDENTICAL copy — a single source of truth here prevents the two
 * flows from drifting.
 */
export const CONFIRM_CLEAR_MESSAGE =
  "This will permanently delete your cached export data. You'll need to re-upload the zip to view it again.";

/**
 * D-21: ConfirmPanel dismiss-button label for the clear-data flows.
 * Paired with CONFIRM_CLEAR_MESSAGE; the user can keep their cached
 * data without taking any further action.
 */
export const KEEP_CACHED_DATA_LABEL = 'Keep cached data';

/**
 * D-21: ConfirmPanel commit-button label for the clear-data flows.
 * The destructive commit string — paired with the red button chrome
 * (UI-SPEC Color table's Destructive row).
 */
export const DELETE_CACHED_DATA_LABEL = 'Delete cached data';

/**
 * D-17 / D-18: label of the persistent "Clear my cached data"
 * control surfaced on every app state that has a cached dataset.
 * Verbatim DATA-02 phrasing per the UI-SPEC Copywriting Contract.
 */
export const CLEAR_DATA_LABEL = 'Clear my cached data';

/**
 * D-20: one-shot acknowledgment shown above/alongside the empty
 * dropzone immediately after a confirmed clear. Rendered by
 * App.svelte gated on `state === 'idle' && justCleared`. The flag
 * is cleared by IngestClient itself on the next submitFiles() /
 * reset() call (02-03-PLAN Task 2), never by a timer — matching the
 * project's "nothing auto-dismisses" contract (D-06).
 */
export const CLEARED_ACK_MESSAGE = 'Cached data cleared';

// =============================================================================
// Phase 3 — dashboard shell copy (03-02-PLAN Task 1)
// =============================================================================
//
// D-02, D-03, D-08, D-10 and D-24. The retired Phase 2 copy
// (`formatSummary`, `formatAccountHeading`) was deleted in Plan 03-07,
// once the specs that still imported it had been re-pointed at the
// dashboard.
// =============================================================================

/**
 * The visible title of each nav link and section card, keyed by nav id.
 *
 * The four folder names are written EXACTLY as they appear in the export,
 * not prettified — `Activity_history` with its underscore is what the user
 * sees in the zip they unzipped, and matching it is the point (D-02).
 * The block's title is prose rather than a folder name because it has none.
 *
 * `Record<NavId, string>` rather than an object literal type: adding a
 * section id to `dashboard-status.ts` without a title here is a type error
 * at build time, not a blank link in production.
 */
export const SECTION_TITLES: Record<NavId, string> = {
  'activity-history': 'Activity_history',
  'player-statistics': 'Player_statistics',
  'payment-history': 'Payment_history',
  'user-info': 'User_Info',
  'not-yet-supported': 'Not yet supported',
};

/**
 * The sticky nav's landmark name. "Dashboard sections" rather than a
 * nickname or an "Account" label, because the nav lists sections and has
 * nothing to do with the account (D-03).
 */
export const NAV_ARIA_LABEL = 'Dashboard sections';

/**
 * The visually-hidden suffix appended to a MUTED nav link, so its accessible
 * name states the reason as visible text (D-03).
 *
 * These are suffixes, not sentences: a screen reader reads
 * "Payment_history, not in this export" because the link's own text is the
 * title and the suffix rides along inside it. `aria-label` is deliberately
 * NOT used anywhere here — it would replace the visible text the user can
 * actually read (UI-SPEC "Accessible name carries status").
 *
 * Every leading comma is part of the contract, and so is the absence of
 * trailing punctuation.
 */
export const NAV_STATUS_SUFFIX: Record<NavMutedReason, string> = {
  'no-export': ', not in this export',
  empty: ', no rows in this export',
  'not-loaded': ', no export loaded',
  none: ', none detected',
};

/**
 * The three statuses a GREYED card carries a status line for.
 *
 * `pending` and `ready` are absent by design: a populated card's body is its
 * import summary and note (D-09) or its dashboard content, and a "status
 * line" there would be a fourth, redundant sentence. Typing the parameter
 * this narrowly means a caller must narrow the card's status before asking
 * for a status line, so the impossible call does not compile.
 */
export type GreyedSectionStatus = Extract<SectionStatus, 'not-loaded' | 'no-export' | 'empty'>;

/**
 * The status line of a greyed section card.
 *
 * The three greyed states are told apart in WORDS, not only in colour, and
 * each name what actually happened (D-10, and the DATA-04 prohibition):
 * nothing loaded yet / not in this export / in it but with no rows. The
 * `empty` sentence interpolates the folder name, so a user can see which
 * category the message is about without reading the heading.
 */
export function formatSectionStatus(status: GreyedSectionStatus, folder: string): string {
  if (status === 'no-export') return 'Not in this export';
  if (status === 'empty') return `This export contains no rows for ${folder}`;
  return 'Drop an export to see this section';
}

/**
 * The note under a populated (`pending`) section's import summary (D-09).
 *
 * It tells the truth about why there is no dashboard yet, instead of
 * leaving an empty card that looks broken.
 */
export const SECTION_NOTE_PENDING = 'Dashboard coming in a later update';

/**
 * The same note, overridden for User_Info (UI-SPEC discretion, refining
 * D-09). No phase ever builds a User_Info dashboard — that data is the
 * identity header — so "coming in a later update" there would be a
 * promise the project will never keep.
 */
export const SECTION_NOTE_USER_INFO = 'Account details are shown in the header above';

/**
 * The unsupported block's intro, shown above the banner list (D-22).
 *
 * It says plainly that the folders ARE in the export and the viewer cannot
 * show them, which is the honest framing: nothing is missing from the
 * user's data.
 */
export const UNSUPPORTED_INTRO =
  "These folders are in your export, but this viewer can't show them yet.";

/**
 * The unsupported block's greyed state: an export loaded, and every folder
 * in it is one this viewer supports. "None detected" rather than "none
 * found" because a folder can be absent from the zip entirely, and the
 * sentence is about the archive's contents, not about our search.
 */
export const UNSUPPORTED_NONE_DETECTED = 'No unsupported categories were detected in this export';

/**
 * Appended to the folder name in an unsupported banner (D-22).
 *
 * IDENTICAL for known-deferred and unknown tiers: a user cannot act on the
 * difference, and showing it would only promise a roadmap. The leading
 * space and em dash are part of the string because the banner renders the
 * name first and this inline after it.
 *
 * The folder name is untrusted and is never concatenated in here — the
 * banner joins name + suffix at the call site, as text.
 */
export const UNSUPPORTED_BANNER_SUFFIX = ' — detected but not yet supported';

/**
 * The import region's landmark name. Static and generic: it names the
 * region, never the file or the account.
 */
export const IMPORT_ARIA_LABEL = 'Import';

/**
 * The dropzone prompt in the slim (replace) bar (D-25).
 *
 * Different sentence from `DROPZONE_PROMPT` on purpose: a dataset is
 * already loaded and visible right above it, so the prompt's job is to say
 * what dropping will DO, not to introduce the feature.
 */
export const COMPACT_DROPZONE_PROMPT =
  'Drop a new export (.zip) here to replace this one, or click to choose it.';

/**
 * The full-size dropzone's accessible name — a NAME for the control, not a
 * second prompt, and the string the landmark would be announced with.
 *
 * Applied to the NON-compact variant only, and that restriction is the
 * point rather than a detail: `aria-label` REPLACES an element's content
 * as its accessible name, so a label on the compact variant would silence
 * `COMPACT_DROPZONE_PROMPT` — the one sentence that tells a screen-reader
 * user dropping there replaces the export already loaded above it. With no
 * label the compact variant falls back to its visible prompt, which is
 * exactly the affordance the wording carries.
 */
export const DROPZONE_ARIA_LABEL = 'Wargaming data export dropzone';

/**
 * The import summary line: "{n file(s)}, {n row(s)}" (D-09).
 *
 * Composed from the two existing count formatters so the singular/plural
 * rules and the thousands separator have exactly one implementation, and
 * so a section card and an unsupported banner can never disagree about
 * how a count reads. The skip tag is NOT here — `formatSkippedRowCount`
 * stays a separate element rendered only when the count is above 0 (D-04).
 */
export function formatImportSummary(fileCount: number, rowCount: number): string {
  return `${formatFileCount(fileCount)}, ${formatRowCount(rowCount)}`;
}

/**
 * The identity header's landmark name (D-21).
 *
 * Static, and deliberately NOT the nickname: the nickname must never
 * appear in an aria-label or any other accessible name, only in the
 * header's own visible heading.
 */
export const IDENTITY_ARIA_LABEL = 'Account identity';

/**
 * The caption under the nickname (D-12). "As of export", not "Imported
 * on {date}": the identity describes the export, whereas `importedAt` is
 * when WE parsed it. No date is shown here on purpose.
 */
export const IDENTITY_CAPTION = 'As of export';

/**
 * The `dt` label for the region row (D-13). The value is the raw `REGION`
 * string from the export, never mapped to a friendly name; "(per export)"
 * says so before the user wonders why it reads as a code.
 */
export const IDENTITY_REGION_LABEL = 'Region (per export)';

/** The `dt` label for the creation-date row (D-15). */
export const IDENTITY_CREATED_LABEL = 'Account created';

/**
 * What any absent or empty identity field shows (D-16).
 *
 * One word for all three fields, so "we have no value" looks the same
 * wherever it appears instead of inventing a different excuse per slot.
 */
export const UNKNOWN_VALUE = 'Unknown';

/**
 * The identity header's title in the skeleton state (D-24).
 *
 * The Display-size heading of the no-export dashboard. It is NOT a status
 * sentence — it is the card's title, which is why it matches nothing else.
 */
export const IDENTITY_SKELETON_TITLE = 'No export loaded';

/** The one line under the skeleton title (D-24). */
export const IDENTITY_SKELETON_PROMPT = 'Drop an export to see the account details';

/**
 * The title shown when the export has no account root to fall back on
 * (RESEARCH Pitfall 6, RESEARCH Q3).
 *
 * A re-zip whose entries do not all sit under one root folder yields
 * `accountRoot === ''`. The D-16 fallback title is then the account ID, so
 * with an empty root it would be an empty `<h2>`: a blank card with no
 * explanation at all. This is the copy for that case, decided here because
 * `ui-copy.ts` is where all such strings live.
 */
export const IDENTITY_UNKNOWN_ACCOUNT_TITLE = 'Unknown account';

/**
 * The "Account ID: {root}" line (D-14).
 *
 * Replaces `formatAccountHeading`'s "Account: …" wording, and is rendered
 * only when the title did not already fall back to the root — otherwise
 * the card would show the same value twice.
 *
 * The root is an UNTRUSTED zip-entry string. This function concatenates
 * and returns; it never builds markup, never escapes, and never inspects
 * the value (threat T-03-07). Escaping belongs to the Svelte text
 * interpolation layer, which does it for every interpolation in the app.
 */
export function formatAccountId(root: string): string {
  return `Account ID: ${root}`;
}

/**
 * The account creation date, shown as written and date-only (D-15).
 *
 * Returns the text before the first space or `T` — no `Date` parsing, no
 * locale formatting, no timezone conversion — because the field carries no
 * timezone. A `Date` round-trip would either invent one or, for a bare
 * date, reinterpret it in the viewer's zone and silently shift the day
 * for anyone west of UTC. This is also why the style differs on purpose
 * from `formatImportedOn`: the two dates must not be confused.
 *
 * A value with nothing before the first separator (empty, whitespace-only,
 * or one starting with `T`) has no date portion, and shows `Unknown` rather
 * than an empty `<dd>`.
 */
export function formatCreatedDate(raw: string | null): string {
  if (raw === null) return UNKNOWN_VALUE;
  const date = raw.trim().split(/[ T]/)[0] ?? '';
  return date === '' ? UNKNOWN_VALUE : date;
}

/**
 * The identity header's title when no nickname is available: the account
 * root, per the D-16 fallback.
 *
 * The empty-root case is why this exists at all — see
 * `IDENTITY_UNKNOWN_ACCOUNT_TITLE`. Any other root, including markup-ish
 * text, is returned unchanged.
 */
export function formatIdentityFallbackTitle(root: string): string {
  return root === '' ? IDENTITY_UNKNOWN_ACCOUNT_TITLE : root;
}
