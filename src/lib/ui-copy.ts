import type { NavId, NavMutedReason, SectionStatus } from './shell/dashboard-status.ts';
import type { IngestStage, ParsingProgress } from './core/types/worker-messages.ts';
// Type-only: the split-column keys label strings, and a runtime import would
// put a module in the bundle that this one only needs a union from.
import type { HourGridBasis, SplitColumn } from './features/playtime/playtime-shared.ts';
// A RUNTIME import, unlike the two above: `civilFromDays` and `weekdayOfDay`
// are the pure integer date arithmetic every calendar string is built from
// (04-01). They construct no `Date`, which is what keeps a cell's date the
// export's date rather than the viewer's — see formatCalendarDate.
import { civilFromDays, weekdayOfDay } from './core/civil-date.ts';

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
 * category badge to display both the file count and the row count, with the
 * singular form preserved ("1 row", not "1 rows"). The count groups through
 * `formatNumber`, so it follows the viewer's locale like every other number on
 * the page (D-25) — CONTEXT.md's D-05 example "1,204 rows" is a comma-grouping
 * illustration, not a locale mandate.
 */
export function formatRowCount(n: number): string {
  return n === 1 ? '1 row' : `${formatNumber(n)} rows`;
}

/**
 * D-04: "1 row skipped" / "N rows skipped". The skip-count tag is
 * ONLY rendered when `skippedRowCount > 0` (the conditional lives in
 * CategoryBadge.svelte, not here) — this helper exists purely to
 * keep the singular/plural copy consistent with formatRowCount /
 * formatFileCount, and to centralise the literal text for any future
 * Playwright assertion. Grouped through `formatNumber` for the same
 * reason as its sibling: one locale rule for the page, not two.
 */
export function formatSkippedRowCount(n: number): string {
  return n === 1 ? '1 row skipped' : `${formatNumber(n)} rows skipped`;
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
 * The five folder names are written EXACTLY as they appear in the export,
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
  'financial-data': 'Financial_data',
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
 * The `dt` label for the region row (D-13, amended after UAT G-05-7).
 *
 * The value is still the raw `REGION` cell, never mapped to a friendly
 * name. What changed is the WORD: a real export's `REGION` is a numeric
 * regional code stored beside a city ("30", next to a city name), not a
 * game realm, so a label starting with "Region" invited the reader to look
 * for a server that the value is not. "Location code" says the value is
 * opaque, and "(per export)" still attributes it to the file rather than to
 * the reader's account.
 */
export const IDENTITY_REGION_LABEL = 'Location code (per export)';

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

// =============================================================================
// Phase 4 — Playtime copy (04-02-PLAN Task 1)
// =============================================================================
//
// IP (Product): state the outcome, not the mechanism. Nothing below names a
// file, a query or a worker; the one string that names a file ("session file")
// does so as the reason the user can already see, not as an internal.
//
// Every literal is the approved 04-UI-SPEC.md wording. Each comment names the
// table and row it was copied from, and `tests/unit/shell/ui-copy.test.ts` pins the
// pair, so a paraphrase is a deliberate edit to that test rather than a
// silent change to a string a user reads.
//
// These six are the tracer copy. Plan 04-04 adds the rest of the Activity
// dashboard's strings and owns the tile component they are read by.
// =============================================================================

/** Sub-heading of the playtime block. */
export const PLAYTIME_HEADING = 'Playtime';

/**
 * The loading state. Progress is indeterminate — the worker does not report
 * playtime progress — so this is a plain sentence, not a percentage.
 */
export const PLAYTIME_LOADING = 'Calculating playtime...';

/**
 * Empty state when the export has no session file at all.
 *
 * Distinct from `PLAYTIME_NO_USABLE_SESSIONS` on purpose: 04-01 tracks
 * `sessionsFileSeen` per file precisely so "there is nothing to show" and
 * "nothing in there was usable" stay two different claims.
 */
export const PLAYTIME_NO_SESSION_FILE =
  'This export has no session file, so there is no playtime to show.';

/**
 * Empty state when the session file is present but no row could be used —
 * a different fact about the same export, with a different remedy.
 */
export const PLAYTIME_NO_USABLE_SESSIONS = 'No usable sessions were found in this export.';

/**
 * The error state.
 *
 * Deliberately NOT `GENERIC_FAILURE_MESSAGE`: that one claims the file is
 * not a Wargaming export, which would be false here — the import worked and
 * the user's data is intact. D-19 requires this copy to state what happened,
 * that the data is unchanged, and how to retry; all three are in the
 * sentence, in that order.
 */
export const PLAYTIME_ERROR =
  'Playtime could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.';

/**
 * Label of the Sessions tile.
 *
 * One label per export column this dashboard actually reads: sessions, and
 * (from 04-04) total playtime and active days. A label the dashboard cannot
 * fill is not added.
 */
export const TILE_LABEL_SESSIONS = 'Sessions';

// =============================================================================
// Phase 4 — number formatting and the hours rule (04-04-PLAN Task 1)
// =============================================================================
//
// A duration is the most repeated string on the Playtime dashboard: the
// total-playtime tile, three chart axes, every tooltip, every accessible name
// and each year head. 04-UI-SPEC Page Anatomy 4 therefore fixes the rule ONCE
// and names `formatHours` as the single implementation. Everything below exists
// so that a tile, a tooltip and an aria-label cannot each invent their own
// rounding or unit decision.
// =============================================================================

/**
 * The locale every number in this module groups by when no explicit locale is
 * given, and the single seam that changes it.
 *
 * `undefined` is the deliberate production value. It is the platform's own
 * locale — the browser's, in the app — which is the whole point: every number
 * on the page should group the way the reader's other numbers group (D-25,
 * 05-UI-SPEC "UI Considerations"). A comma in Berlin and a dot in Kyiv are not
 * bugs, they are the reader's own conventions, and Phase 4's blanket `en-US`
 * pin was quietly imposing the author's locale on everyone else's screen.
 *
 * Why the setter exists at all, given `undefined` is the right default: Node
 * gives tests a different default than the browser gives the app, so a test
 * asserting `1,234,567` is asserting about the machine it ran on rather than
 * about this code. `tests/unit/setup.ts` calls this once with `en-US` so every
 * expectation in the unit suite is written in one grouping style, and
 * `tests/e2e/_support/pin-locale.ts` does the same for the Node side of a Playwright
 * assertion. The determinism belongs to the tests; the app keeps the viewer's.
 *
 * Application code must not import this (05-08 guards that at the source
 * level): a page whose grouping could be changed underneath the reader is a
 * page whose copy we can no longer promise.
 */
let defaultNumberLocale: string | undefined = undefined;

/**
 * Pin the default grouping locale for every formatter in this module that is
 * not given an explicit locale.
 *
 * @param locale A BCP 47 tag such as `'en-US'`; `undefined` restores the
 *   platform default the app actually runs with.
 */
export function setDefaultNumberLocale(locale: string | undefined): void {
  defaultNumberLocale = locale;
}

/**
 * A count with thousands separators, grouped by the viewer's locale.
 *
 * The locale is the viewer's rather than a hardcoded `en-US`: the UI-SPEC
 * writes `1,204 hours` and `1,203 sessions` as *illustrations of magnitude*,
 * not as literal expected text, and a viewer in a dot-grouping locale should
 * see `1.204 hours`. A single grouping style across the whole page is the
 * requirement; which style is the reader's.
 *
 * Tests pin the default in `tests/unit/setup.ts`, so `en-US` remains the
 * expected output there and on a CI box set to `en_US.UTF-8`.
 */
export function formatNumber(n: number, locale?: string): string {
  return numberFormatter(locale ?? defaultNumberLocale).format(n);
}

/** The number and unit of a formatted duration, as two separately styled parts. */
export type HoursParts = {
  /** The numeral exactly as it appears, including `<1` and any separators. */
  value: string;
  /** `min`, `hour` or `hours` — the unit, in the Label style beside the number. */
  unit: string;
};

/**
 * A duration in whole seconds, split into the numeral and the unit (04-UI-SPEC
 * Page Anatomy 4, the Decision labelled "Hours formatting").
 *
 * The rule, once, for every duration this app shows:
 *   - under one hour: whole minutes, unit `min`. A total of zero is `0 min`;
 *     a non-zero total under a minute is `<1 min`, because "0 min" for a
 *     session that really did play is a false statement.
 *   - one hour up to but not including 100 hours: one decimal, with a trailing
 *     `.0` dropped — `3.5 hours`, `42 hours`, and `1 hour` rather than `1.0`.
 *   - 100 hours and up: a rounded integer with thousands separators, because
 *     a tenth of an hour is noise at that magnitude and `1,204.0` is not.
 *
 * The unit is `hour` when the NUMERAL is exactly `1` and `hours` otherwise, so
 * the singular is decided by what the reader sees, not by the duration: 3601
 * seconds renders `1 hour`, and would render `1.1 hours` had it been 3960.
 *
 * Non-finite or negative input reads as zero. Aggregation can only produce a
 * non-negative finite total, so this is defensive — and it matters because the
 * alternative is a tile reading "NaN hours" in front of a user.
 */
export function formatHoursParts(seconds: number): HoursParts {
  const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;

  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    if (minutes === 0) {
      // Zero minutes is either no play at all, or a play so short it has no
      // whole minute. Those are different facts, and the second one is the
      // only place in this app where `<` appears.
      return total === 0 ? { value: '0', unit: 'min' } : { value: '<1', unit: 'min' };
    }
    return { value: String(minutes), unit: 'min' };
  }

  const hours = total / 3600;
  if (hours < 100) {
    // One decimal, then drop a trailing ".0" so 3600 reads "1 hour".
    const oneDecimal = hours.toFixed(1);
    const value = oneDecimal.endsWith('.0') ? oneDecimal.slice(0, -2) : oneDecimal;
    return { value, unit: value === '1' ? 'hour' : 'hours' };
  }
  return { value: formatNumber(Math.round(hours)), unit: 'hours' };
}

/**
 * A duration as the single string a tile, a tooltip or an accessible name
 * shows: the numeral and unit from {@link formatHoursParts}, one space apart.
 *
 * Prefer the two parts over this when the UI can style the number as Display
 * and the unit as Label (the tiles do); this is the form for the places that
 * take plain text — tooltips, axis labels, `aria-label`.
 */
export function formatHours(seconds: number): string {
  const { value, unit } = formatHoursParts(seconds);
  return `${value} ${unit}`;
}

// =============================================================================
// Phase 4 — static copy and count formatters (04-04-PLAN Task 2)
// =============================================================================
//
// Every constant below implements one row of a 04-UI-SPEC.md copy table, and
// the doc-comment names that row. The section header stays as it is because
// these are the same dashboard's strings; the 04-02 header is a heading, not a
// fence.
//
// Nothing here returns markup. D-03 values are untrusted export data (T-04-07)
// and the renderer escapes them, so a formatter that "helpfully" built a tag
// would be the only place in the app that did not.
// =============================================================================

/**
 * The status line while a re-selection recomputes. 04-UI-SPEC "New copy",
 * Loading / Updating rows: `Calculating playtime...` on first load,
 * `Updating charts...` on a split change. Two sentences for two states,
 * because a re-selection is a smaller claim than a first load.
 */
export const PLAYTIME_UPDATING = 'Updating charts...';

/**
 * The notice for a selection the app could not apply, because the worker's
 * store was emptied under a tab that still held the dataset. "New copy" table,
 * Cache-cleared notice row (04-16, G-04-5).
 *
 * It is deliberately NOT `PLAYTIME_ERROR`, and the difference is the whole
 * point of the sentence. `PLAYTIME_ERROR` claims the imported data is
 * unchanged, which here would be a lie — the data WAS cleared, just not by
 * anything the user did on this page — and it asks for a calculation to be
 * retried, which would not help, because there is nothing left to calculate
 * from until the export is dropped again.
 *
 * It says ANOTHER TAB because that is the one way the worker can report an
 * emptied store to a tab that still holds the dataset: this page is holding
 * its numbers in memory, its own store was cleared, and the next thing the
 * user learns is that the selector ignored them. Naming the cause the app can
 * actually produce is what makes the sentence useful rather than alarming, and
 * the remedy is the same whatever emptied the store.
 *
 * No dataset id, no path, no worker detail (D-21): this string is a claim
 * about what happened, and the identifiers that prove it stay in the
 * predicate that decides whether to show it.
 */
export const PLAYTIME_CACHE_CLEARED =
  'Your cached data was cleared in another tab, so your selection could not be applied. Drop your export again to keep exploring it.';

/**
 * The `Login_history` sub-heading. "New copy" table, Login history sub-heading
 * row: `Login history` (its note reuses `SECTION_NOTE_PENDING`).
 *
 * D-07 keeps the section visible and explicitly not-yet-implemented rather
 * than hidden, so the heading is the honest label for a placeholder.
 */
export const LOGIN_HISTORY_HEADING = 'Login history';

/**
 * Labels of the other two totals tiles. "New copy" table, Tile labels row:
 * `Total playtime` · `Sessions` · `Active days` (04-02 owns the Sessions one).
 */
export const TILE_LABEL_TOTAL_PLAYTIME = 'Total playtime';
export const TILE_LABEL_ACTIVE_DAYS = 'Active days';

/**
 * The split selector's first option and the display of a blank column value.
 * "New copy" table, Selector rows: all option `All`, blank value
 * `(not recorded)`.
 *
 * The blank case is a real, visible state (04-08 builds the group), and
 * "(not recorded)" is a claim about the export rather than about the account.
 */
export const SPLIT_ALL_OPTION = 'All';
export const SPLIT_BLANK_VALUE = '(not recorded)';

/** The split table's second header cell. "New copy" table, Split table headers
 *  row: `{Column label}` · `Hours`. The first cell is the column's own label. */
export const SPLIT_HOURS_HEADER = 'Hours';

/**
 * The three split columns and the label each shows. "New copy" table, Selector
 * label row: `Game` (`GAME`, 04-15) / `Server name` (`SERVER_NAME`) /
 * `Client platform` (`CLIENT_PLATFORM`).
 *
 * `GAME` is the label a REAL export needs and `Sessions.csv` never had: the
 * export names the game in the session file's name and carries no server or
 * platform column at all, so before 04-15 the only two labels here could not
 * have named what a real export splits on (D-03).
 *
 * Typed as a `Record` over `SplitColumn` rather than as three constants so that
 * a fourth split column is a compile error here until someone labels it.
 */
export const SPLIT_COLUMN_LABELS: Record<SplitColumn, string> = {
  GAME: 'Game',
  SERVER_NAME: 'Server name',
  CLIENT_PLATFORM: 'Client platform',
};

/**
 * Why some rows appear nowhere on the page. "New copy" table, Excluded
 * explanation row.
 *
 * D-02: an excluded row is a session row the aggregation could not use, and
 * "not counted anywhere on this page" is the accurate claim — it is counted
 * nowhere, but it was not lost either.
 */
export const PLAYTIME_EXCLUDED_EXPLANATION =
  'Sessions with a missing or invalid time, or an end before the start, are not counted anywhere on this page.';

/** Chart titles. "New copy" table, Chart titles row. */
export const CHART_TITLE_CALENDAR = 'Hours per day';
export const CHART_TITLE_HOUR_GRID = 'Hours by weekday and time of day';
export const CHART_TITLE_DURATION = 'Session length';

/**
 * The calendar's basis caption and keyboard hint. "New copy" table, Calendar
 * rows.
 *
 * The basis caption is not decoration: D-01 dates the cells exactly as the
 * export records them, so a user comparing them with a calendar app needs to
 * be told the two are not the same frame.
 */
export const CALENDAR_BASIS_CAPTION = 'Dates are as recorded in the export.';
export const CALENDAR_KEYBOARD_HINT = 'Use the arrow keys to move between days.';

/**
 * The weekday × hour grid's basis caption and keyboard hint. "New copy" table,
 * Weekday × hour rows.
 *
 * D-01 is stronger here than on the calendar: the grid bins by hour, so if the
 * export is in UTC and the reader is not, whole cells move and the caption is
 * the only thing that says so.
 */
export const HOUR_GRID_BASIS_CAPTION =
  'Hours are as recorded in the export (likely UTC or server time), not converted to your local time.';
export const HOUR_GRID_KEYBOARD_HINT = 'Use the arrow keys to move between cells.';

/**
 * The words either side of the heatmap legend. "New copy" table, Legend words
 * row. The swatches between them are `aria-hidden` (UI-SPEC Legend), so these
 * two words are what a screen reader hears for the scale.
 */
export const LEGEND_LESS = 'Less';
export const LEGEND_MORE = 'More';

/**
 * Why the duration histogram's bins are uneven. "New copy" table, Duration
 * explanation row.
 *
 * The bins widen with duration (playtime-shared's `DURATION_BIN_EDGES_SECONDS`),
 * so a reader who assumed equal widths would read the bar lengths wrong.
 */
export const DURATION_EXPLANATION =
  'Each bar covers a longer range of session lengths than the one before it, so short and long sessions are both visible.';

/** The duration list's accessible name. "New copy" table, Duration list
 *  `aria-label` row: `Sessions by length`. The visible chart title is
 *  "Session length", so the list needs its own plural name. */
export const DURATION_LIST_ARIA_LABEL = 'Sessions by length';

/**
 * The twelve duration-bin labels. "New copy" table, Duration bins row.
 *
 * Index-aligned with `DURATION_BIN_EDGES_SECONDS` in playtime-shared, so
 * `DURATION_BIN_LABELS[i]` names bin `i`. `tests/unit/shell/ui-copy.test.ts` asserts
 * the length against `DURATION_BIN_COUNT`; the two arrays must change together.
 */
export const DURATION_BIN_LABELS: readonly string[] = [
  'Under 1 min',
  '1-2 min',
  '2-5 min',
  '5-10 min',
  '10-20 min',
  '20-30 min',
  '30-60 min',
  '1-2 hours',
  '2-4 hours',
  '4-8 hours',
  '8-16 hours',
  '16+ hours',
];

/**
 * The session count as a phrase. "New copy" table, Year head summary row.
 *
 * `1 session` is not derivable from a shared pluraliser that also has to say
 * "1 active day", so each count has its own function and its own test.
 */
export function formatSessionCount(n: number): string {
  return n === 1 ? '1 session' : `${formatNumber(n)} sessions`;
}

/** The active-day count as a phrase. "New copy" table, Year head summary row. */
export function formatActiveDayCount(n: number): string {
  return n === 1 ? '1 active day' : `${formatNumber(n)} active days`;
}

/**
 * How a split value is displayed: `null` becomes `SPLIT_BLANK_VALUE`, any
 * string is returned unchanged.
 *
 * A value that literally reads "(not recorded)" renders identically to a blank
 * one. The UI-SPEC accepts that collision: the alternative is a two-way
 * distinction the export cannot actually support, and the display is the
 * honest one. The value is returned as text — never trimmed, truncated or
 * escaped here (D-03, T-04-07).
 */
export function formatSplitValue(value: string | null): string {
  return value ?? SPLIT_BLANK_VALUE;
}

/**
 * The column's name in lower case, for the places the UI-SPEC writes it that
 * way — the split caption and the overlap note. "New copy" table, Split table
 * caption and Overlap consequence rows.
 */
export function formatSplitColumnLower(column: SplitColumn): string {
  return SPLIT_COLUMN_LABELS[column].toLowerCase();
}

/** The split table's caption. "New copy" table, Split table caption row:
 *  `Hours by {column name lower case}`, e.g. `Hours by server name`. */
export function formatSplitCaption(column: SplitColumn): string {
  return `Hours by ${formatSplitColumnLower(column)}`;
}

/**
 * The final row of the split table when the selector holds more values than
 * the table shows. "New copy" table, Split table overflow row.
 *
 * This is a real limitation shown rather than hidden, which is why the number
 * is the whole message and no values are named.
 */
export function formatSplitOverflowRow(n: number): string {
  return `${formatNumber(n)} more in the selector`;
}

/**
 * The consequence of D-02, spelled out under the split table. "New copy"
 * table, Overlap consequence note row.
 *
 * The arithmetic is genuinely surprising: splitting on any column makes the
 * parts sum to MORE than the All total, because All merges sessions that
 * overlap and the parts do not. The column name appears three times and is
 * built from one helper, so the three cannot drift apart.
 */
export function formatSplitOverlapNote(column: SplitColumn): string {
  const name = formatSplitColumnLower(column);
  return (
    `Hours by ${name} can add up to more than the All total, because All also ` +
    `merges sessions that overlap across different ${name}s.`
  );
}

/**
 * The amber excluded-rows pill. "New copy" table, Excluded pill row.
 *
 * Returns the empty string for zero rather than "0 session rows excluded":
 * the UI-SPEC says the pill is only rendered when the count is > 0, and
 * making that unconditional here means a caller cannot get it wrong by
 * forgetting a conditional.
 */
export function formatExcludedPill(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 session row excluded' : `${formatNumber(n)} session rows excluded`;
}

/**
 * The year head's caption. "New copy" table, Year head summary row:
 * `{h} · {n} sessions · {d} active days`, e.g. `412 hours · 1,203 sessions ·
 * 201 active days`.
 *
 * Three facts in one string, because the year head is the only per-year
 * summary and a reader comparing two years needs all three.
 */
export function formatYearSummary(seconds: number, sessions: number, activeDays: number): string {
  return `${formatHours(seconds)} · ${formatSessionCount(sessions)} · ${formatActiveDayCount(activeDays)}`;
}

/**
 * A run of consecutive years with no sessions. "New copy" table, Empty year
 * run row: `{yyyy}-{yyyy}: no sessions recorded` / `{yyyy}: no sessions
 * recorded`.
 *
 * One line for the whole run, so a seven-year gap in the export is one
 * sentence rather than seven year heads with nothing under them.
 */
export function formatEmptyYearRun(from: number, to: number): string {
  return `${from === to ? from : `${from}-${to}`}: no sessions recorded`;
}

/**
 * The heatmap legend's note. "New copy" table, Legend note row.
 *
 * `null` is the one-level case: with only one level in use there is no
 * "darkest" boundary to state, and saying "more than 0 hours" would be a
 * sentence about nothing. That is also why the parameter is nullable rather
 * than 0 — a zero boundary and an absent one are different facts.
 *
 * The first sentence is the accessibility relief for a rank-based ramp: it
 * tells the reader the scale is ranked, not proportional.
 */
export function formatCalendarLegendNote(darkestSeconds: number | null): string {
  const base = 'Shades rank your active days, so ordinary days stay distinguishable from outliers.';
  return darkestSeconds === null
    ? base
    : `${base} Darkest: more than ${formatHours(darkestSeconds)}.`;
}

/** The weekday × hour legend's note. "New copy" table, Legend note row, whose
 *  second variant reads `Shades rank the busiest hours of the week. Darkest:
 *  more than {hours}.`. The `null` case is the same as the calendar's. */
export function formatHourGridLegendNote(darkestSeconds: number | null): string {
  const base = 'Shades rank the busiest hours of the week.';
  return darkestSeconds === null
    ? base
    : `${base} Darkest: more than ${formatHours(darkestSeconds)}.`;
}

/**
 * One row of the duration histogram. "New copy" table, Duration row text row:
 * `{n} · {p}%` (`<1%` for a non-zero share under 0.5%; `0` for an empty bin).
 *
 * A bin holding sessions but under 0.5% of them reads `<1%` rather than `0%`,
 * because "0%" next to a non-zero count says the sessions did not happen.
 * An empty bin is the one case that is genuinely zero, and it reads `0` alone
 * rather than "0 · 0%".
 *
 * The share itself comes from `formatSharePercent`, shared with the Phase 6
 * login copy since 06-02: the under-half-percent rule is one rule across the
 * app, and two implementations of it is how a page ends up with `0%` beside a
 * non-zero count in one card and `<1%` in another.
 */
export function formatDurationRowText(count: number, sessions: number): string {
  if (count === 0) return '0';
  return `${formatNumber(count)} · ${formatSharePercent(count, sessions)}%`;
}

/**
 * What the status live region announces after a split change. "New copy"
 * table, Selection announcement row: `Showing {value}: {hours}, {n} sessions,
 * {d} active days.`, and for All `Showing all sessions: …`.
 *
 * The full set is repeated rather than "Updated" because the live region is
 * the only feedback a screen-reader user gets that the numbers under it
 * changed, and it is the only place the three values are stated together.
 * `null` is All, which is a selection like any other.
 */
export function formatSelectionAnnouncement(
  value: string | null,
  seconds: number,
  sessions: number,
  activeDays: number,
): string {
  const subject = value === null ? 'all sessions' : value;
  return `Showing ${subject}: ${formatHours(seconds)}, ${formatSessionCount(sessions)}, ${formatActiveDayCount(activeDays)}.`;
}

// =============================================================================
// Phase 4 — dates, tooltips and accessible names (04-04-PLAN Task 3)
// =============================================================================
//
// The strings below are what a screen reader hears for 224 grid cells and what
// a tooltip shows on hover. They are assembled from the recorded date parts
// rather than from a locale-sensitive formatter, and never through `Date`,
// for two reasons that are the same reason:
//
//   D-01: the cells are the dates the EXPORT records. A formatter that
//   converted to the viewer's timezone would re-date them, which is the exact
//   thing `CALENDAR_BASIS_CAPTION` and `HOUR_GRID_BASIS_CAPTION` promise does
//   not happen. `civilFromDays` and `weekdayOfDay` (04-01) do pure integer
//   arithmetic and construct no `Date`, so the two agree on every day index
//   the worker can produce.
//
// The name tables are exported because the axes need them and because their
// ORDER is a contract: Monday-first, matching `weekdayOfDay`'s 0 = Monday.
// =============================================================================

/** Three-letter weekday names, Monday first. UI-SPEC, "Weekday names" note:
 *  "the three-letter forms on the axes". Index 0 is Monday, matching
 *  `weekdayOfDay` in civil-date.ts. */
export const WEEKDAY_SHORT: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Full weekday names, Monday first. UI-SPEC, "Weekday names" note: "the full
 *  English names in tooltips". */
export const WEEKDAY_LONG: readonly string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** Three-letter month names. UI-SPEC, "Weekday names" note: "month names in
 *  tooltips and axes are the three-letter English forms". */
export const MONTH_SHORT: readonly string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * One calendar year grid's accessible name: `Playtime calendar {year}`.
 * UI-SPEC section 5, Accessible structure.
 *
 * The year is in the name, not only in the visible head, because the head is
 * `position: sticky` and a screen reader moving between the year grids by
 * `PageUp`/`PageDown` hears the grid announce itself: without the year, every
 * grid on the page has the same name and there is nothing to tell them apart.
 *
 * A plain number rather than a padded or abbreviated one, because the year is
 * also the heading above it and a reader comparing a head with a name must see
 * the same digits — 1970 and 9999 are both real years here (a stray far-past
 * or far-future row is exactly what a calendar must survive, T-04-08).
 */
export function formatCalendarYearLabel(year: number): string {
  return `Playtime calendar ${year}`;
}

/**
 * A calendar cell's date: `{Weekday short}, {Mon} {d}, {yyyy}` — e.g.
 * `Sun, Mar 3, 2019`. "New copy" table, Calendar cell accessible name row.
 *
 * `day` is a day index (days since 1970-01-01), the same integer the calendar
 * keys its cells by, so no string is ever parsed back out of a date. Negative
 * indexes work, which is what a pre-1970 export needs.
 */
export function formatCalendarDate(day: number): string {
  const { y, m, d } = civilFromDays(day);
  const weekday = WEEKDAY_SHORT[weekdayOfDay(day)];
  const month = MONTH_SHORT[m - 1];
  if (weekday === undefined || month === undefined) return '';
  return `${weekday}, ${month} ${d}, ${y}`;
}

/**
 * The calendar tooltip's second line. "New copy" table, Calendar tooltip line
 * 2 row: `{hours} · {n} sessions` (`1 session`) or `No sessions`.
 *
 * Keyed off the SESSION COUNT, never the seconds (04-RESEARCH Pitfall 4): a
 * day can hold a session whose span rounds to zero and still be a session, and
 * "0 min · 1 session" is the truthful reading where "No sessions" would not
 * be. The hour grid below cannot make the same distinction, because it stores
 * seconds only.
 */
export function formatCalendarTooltipLine2(seconds: number, sessions: number): string {
  if (sessions === 0) return 'No sessions';
  return `${formatHours(seconds)} · ${formatSessionCount(sessions)}`;
}

/**
 * A calendar cell's accessible name. "New copy" table, Calendar cell accessible
 * name row: `{Sun, Mar 3, 2019}: {hours}, {n} sessions` or `{Sun, Mar 3,
 * 2019}: no sessions`.
 *
 * The date comes FIRST, because a screen reader user navigating cells one at
 * a time needs to know where they are before they hear how much play it held.
 * The empty form is lower-case `no sessions` here and capitalised on the
 * tooltip line, because this string continues the date it follows.
 */
export function formatCalendarCellLabel(day: number, seconds: number, sessions: number): string {
  const date = formatCalendarDate(day);
  return sessions === 0
    ? `${date}: no sessions`
    : `${date}: ${formatHours(seconds)}, ${formatSessionCount(sessions)}`;
}

/**
 * One hour on the weekday × hour axis: `{HH}:00`, zero-padded — e.g. `00:00`,
 * `09:00`, `21:00`.
 *
 * Zero-padded because the axis is a fixed-width column of 24 labels, and
 * because `9:00` next to `09:00`-style neighbours reads as a typo.
 */
export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * The first line of an hour cell's tooltip. "New copy" table, Weekday × hour
 * tooltip line 1 row: `{Weekday}, {HH}:00-{HH+1}:00` e.g. `Tuesday,
 * 21:00-22:00`, and hour 23 reads `23:00-24:00`.
 *
 * The 24:00 is not a twenty-fifth hour: it is the end of the day's last span,
 * and formatting it `00:00` would read as a cell that starts at midnight.
 * `weekday` is 0 = Monday, matching `weekdayOfDay` and WEEKDAY_LONG.
 */
export function formatHourCellLine1(weekday: number, hour: number): string {
  const name = WEEKDAY_LONG[weekday];
  if (name === undefined) return '';
  return `${name}, ${formatHourLabel(hour)}-${formatHourLabel(hour + 1)}`;
}

/**
 * The second line of an hour cell's tooltip. "New copy" table, Weekday × hour
 * tooltip line 2 row: `{hours} played` or `No sessions`, plus the start-basis
 * suffix.
 *
 * The basis only ever changes the SUFFIX, never the number: under
 * `HOUR_GRID_BASIS` the cell holds the same hours either way, and the reader
 * only needs to know how a session that spans the hour boundary was counted.
 * A zero-second cell is `No sessions` under both bases — the grid stores
 * seconds only, so unlike the calendar it has no session count to key off.
 */
export function formatHourCellLine2(seconds: number, basis: HourGridBasis): string {
  if (seconds === 0) return 'No sessions';
  const played = `${formatHours(seconds)} played`;
  return basis === 'start' ? `${played} in sessions starting this hour` : played;
}

/**
 * An hour cell's accessible name: the span, then the value. "New copy" table,
 * Weekday × hour tooltip line 2 / accessible name suffix row.
 *
 * Same order as the calendar cell's, for the same reason — the reader needs
 * the coordinates before the value, and the coordinates are the part this grid
 * cannot omit (a weekday × hour cell is meaningless without its hour).
 */
export function formatHourCellLabel(
  weekday: number,
  hour: number,
  seconds: number,
  basis: HourGridBasis,
): string {
  return `${formatHourCellLine1(weekday, hour)}: ${formatHourCellLine2(seconds, basis)}`;
}

/**
 * The caption shown when the hour grid counts a session in the hour it STARTS
 * rather than across the hours it spans.
 *
 * **Planner-authored wording** (Plan 04-04 flag): the UI-SPEC gives the
 * start-basis tooltip swap but no caption wording for it, so this one
 * sentence is this plan's to write. It is a constant, not a branch, because
 * `HOUR_GRID_BASIS` is currently `overlap` and the decision is still open:
 * a reader told the wrong attribution rule is worse off than one told
 * nothing. Rendered only when `HOUR_GRID_BASIS === 'start'`; under `overlap`
 * the grid's own note is `HOUR_GRID_BASIS_CAPTION` instead.
 */
export const HOUR_GRID_START_BASIS_NOTE =
  'Each session is counted in the weekday and hour it starts.';

// =============================================================================
// Phase 5 — the vehicle-statistics, financial and spend copy (05-08)
// =============================================================================
//
// Everything a Phase 5 component can say, in one file, before any of those
// components exist. Plans 05-10 to 05-15 build in parallel waves and must not
// edit this module concurrently, so the inventory is settled here and every
// later plan is a pure consumer. Each constant below carries the UI-SPEC row it
// implements; `tests/unit/shell/ui-copy.test.ts` asserts the same literal, so a
// wording change has to edit the spec, the test and this file, in that order.
//
// Three rules run through all of it:
//
//   - Numbers are grouped by the VIEWER's locale (D-25). Every formatter takes
//     an optional trailing `locale` and falls back to the module default, which
//     the test setup pins to en-US and the app leaves as the platform's.
//   - Exact figures are exact everywhere except a chart's axis. A compacted
//     number in a table cell is a number the reader cannot add up.
//   - No formatter takes an account nickname, an order id or a coupon, so none
//     can print one (T-05-25). Currency codes, vehicle ids and battle-type codes
//     come from the export and are interpolated as plain text, never as markup.
// =============================================================================

import { formatDecimalAmount, formatMoneyAmount, numberFormatter } from './core/decimal.ts';
import { monthParts, SECONDS_PER_DAY } from './features/finance/finance-shared.ts';
import type {
  ColumnKind,
  SpecialKey,
  TitleState,
  VehicleCell,
  VehicleTitleId,
} from './features/vehicles/vehicle-shared.ts';

/** The character a negative axis label uses: U+2212, not the ASCII hyphen. */
const MINUS_SIGN = '−';

// -----------------------------------------------------------------------------
// Shared formatters
// -----------------------------------------------------------------------------

const COMPACT_OPTIONS: Intl.NumberFormatOptions = { notation: 'compact', maximumFractionDigits: 1 };

/**
 * A compact magnitude for a chart axis label — `27M`, `26.1M`, `1.2K`.
 *
 * Compact notation with at most one fraction digit (D-25), and the spec's own
 * example is corrected to match what this produces: 26,986,204 renders `27M`,
 * never `26.9M`, because one fraction digit cannot express both the 26 and the
 * 9. Axis labels only — a table cell, a tooltip or a summary sentence carries
 * the exact figure, and every axis label also carries the exact value in an
 * SVG `<title>` so the abbreviation is never the only record of the number.
 *
 * A negative value is the real minus sign followed by the magnitude, formatted
 * separately. Doing it that way rather than formatting the negative number is
 * what guarantees the label is `−27M` and not a locale's own negative spelling
 * or an ASCII hyphen, which is both a different character to a screen reader
 * and narrower than the digit it sits beside.
 */
export function formatCompactNumber(n: number, locale?: string): string {
  const effective = locale ?? defaultNumberLocale;
  if (n < 0) {
    return `${MINUS_SIGN}${numberFormatter(effective, COMPACT_OPTIONS).format(-n)}`;
  }
  return numberFormatter(effective, COMPACT_OPTIONS).format(n);
}

/**
 * A percentage with exactly one decimal and a percent sign: `55.3%`.
 *
 * The input is already a percentage, not a 0-to-1 ratio — `55.333` is
 * fifty-five and a third percent, not five thousand. The vehicle percent cells
 * scale their ratio before calling this, so there is one formatter and one
 * rounding rule for win rate, hit ratio, survival rate and the cells that show
 * them.
 */
export function formatPercent(value: number, locale?: string): string {
  return `${numberFormatter(locale ?? defaultNumberLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

/**
 * A rounded, grouped integer: the average-damage column's `714`.
 *
 * Rounds half away from zero through `Intl`, never through a hand-rolled
 * `Math.round` on a string, so 714.28 and 714.5 group identically in every
 * locale rather than picking up a locale-specific separator the caller did not
 * ask for.
 */
export function formatWholeNumber(value: number, locale?: string): string {
  return numberFormatter(locale ?? defaultNumberLocale, { maximumFractionDigits: 0 }).format(value);
}

/**
 * A month as `YYYY-MM`, built from the month index with integer arithmetic.
 *
 * No `Date`, deliberately (D-26). The index is a count of months from year zero
 * and the label is a restatement of the year and month the export wrote, so
 * routing it through a `Date` would put it through the viewer's timezone and
 * shift the label by a month for anyone west of UTC — a chart whose bars sit
 * under the wrong month, and an axis that disagrees with the data table below
 * it. Four-digit year, two-digit month, both zero-padded.
 */
export function formatMonthLabel(monthIndexValue: number): string {
  const { year, month } = monthParts(monthIndexValue);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/**
 * Premium time as a day count with its unit: `1 day`, `2.5 days`, `0 days`.
 *
 * The same rule `formatHoursParts` applies to hours, for the same reason: a
 * whole number shows no decimal, anything else shows exactly one, and the unit
 * is decided by the RENDERED NUMERAL rather than by the value. That is why 90
 * seconds is `0 days` and not `0.0 days` — rounding a real, non-zero amount
 * down to `0.0` reads as a measurement, where `0` reads as "effectively
 * nothing", and it is the numeral that decides, so a value rounding to exactly
 * 1 day says `1 day`.
 *
 * The input is seconds, an integer, because the sum is accumulated in integer
 * seconds and only converted here. No rounding can therefore enter the total.
 */
export function formatPremiumDays(seconds: number, locale?: string): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const days = total / SECONDS_PER_DAY;
  const rounded = Math.round(days * 10) / 10;
  // `String` drops a trailing `.0` on its own, which is the whole trick: a
  // whole number renders as an integer and a fraction keeps exactly one digit.
  const numeral = numberFormatter(locale ?? defaultNumberLocale, {
    maximumFractionDigits: 1,
  }).format(rounded);
  const isOne = rounded === 1;
  return `${numeral} ${isOne ? 'day' : 'days'}`;
}

/**
 * A real-money amount as the code as written, a space, and two decimals:
 * `USD 15.50`.
 *
 * Three rules from the UI-SPEC, each of which is a decision rather than a
 * default. Never a symbol: `$15.50` is ambiguous to a reader who has seen two
 * currencies in one card, and the code is what the export and the bank both
 * use. Never converted: this app cannot know a rate, and a converted total is a
 * number the user cannot check. Never re-cased: `usd` stays `usd`, because the
 * code is data the user recognises from their own statement.
 *
 * A null code is the unknown-currency case — the UI-SPEC's "no valid
 * three-letter currency code, so the amount has no unit" — and renders the bare
 * amount rather than inventing a unit, because inventing one is exactly the
 * false statement the UI-SPEC warns about. The amount itself is computed by the
 * decimal module, so no float ever touches a currency value.
 */
export function formatMoney(code: string | null, units: bigint, locale?: string): string {
  const amount = formatMoneyAmount(units, locale ?? defaultNumberLocale);
  return code === null ? amount : `${code} ${amount}`;
}

/**
 * A virtual-currency amount, exact and grouped: `30,435,000`.
 *
 * Unlike money, these are NOT money and are not two-decimal: the UI-SPEC carries
 * the raw export figure, and rounding a virtual balance to cents would be
 * inventing precision the data does not have. Compact notation appears on a
 * chart axis only, via {@link formatCompactNumber}.
 */
export function formatFlowAmount(units: bigint, locale?: string): string {
  return formatDecimalAmount(units, locale ?? defaultNumberLocale);
}

// -----------------------------------------------------------------------------
// Vehicle statistics — STATS-01, D-05..D-14
// -----------------------------------------------------------------------------

/** UI-SPEC New copy: Player sub-heading. */
export const PLAYER_STATS_HEADING = 'Vehicle statistics';
/** UI-SPEC New copy: Loading. */
export const PLAYER_STATS_LOADING = 'Calculating vehicle statistics...';
/** UI-SPEC New copy: Updating. */
export const PLAYER_STATS_UPDATING = 'Updating table...';
/** UI-SPEC Error state — vehicle statistics. Destructive chrome, `role="alert"`. */
export const PLAYER_STATS_ERROR =
  'Vehicle statistics could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.';

/** UI-SPEC New copy: Game control label and options. */
export const TITLE_CONTROL_LABEL = 'Game';
/** UI-SPEC Battle type control: label. */
export const BATTLE_TYPE_CONTROL_LABEL = 'Battle type';
/** UI-SPEC Battle type control: the all-battles option. */
export const BATTLE_TYPE_ALL_OPTION = 'All battles';
/** UI-SPEC New copy: Search. */
export const VEHICLE_SEARCH_LABEL = 'Search vehicles';
/** UI-SPEC Per-title header labels. */
export const HEADER_LIFETIME_BATTLES_LABEL = 'Lifetime battles';
export const HEADER_PREMIUM_EXPIRES_LABEL = 'Premium expires';

/**
 * The four game labels, keyed by the id the export and the shared types use.
 *
 * The labels are the reader's names for the games, not the export's folder
 * names: the section card says `Financial_data` because that is what the export
 * calls the folder, but a `<select>` saying `Player_statistics` would be
 * meaningless to anyone who has not opened the zip.
 */
export const VEHICLE_TITLE_LABELS: Readonly<Record<VehicleTitleId, string>> = {
  wot: 'WoT',
  wotb: 'WoT Blitz',
  wows: 'Warships',
  wowp: 'Warplanes',
};

/**
 * One option in the Game control: the label, plus a suffix when the title is
 * not chartable.
 *
 * The suffixes are in the option text rather than beside it so a reader can see,
 * in the list they are choosing from, that a title has no data. `ready` carries
 * no suffix: "Warplanes (no rows in this export)" on a title that does have rows
 * would be a lie, and the empty state exists to say the other thing.
 */
export function formatTitleOption(title: VehicleTitleId, state: TitleState): string {
  const label = VEHICLE_TITLE_LABELS[title];
  if (state === 'not-in-export') return `${label} (not in this export)`;
  if (state === 'no-rows') return `${label} (no rows in this export)`;
  return label;
}

/**
 * A battle type as the export numbers it: `Battle type 3`.
 *
 * Never named. The export records a code and no label, and a lookup table would
 * be a guess about a game's internal enum that a future version could renumber
 * without anyone noticing.
 */
export function formatBattleTypeLabel(code: string): string {
  return `Battle type ${code}`;
}

/** UI-SPEC Special values: the six non-numeric cell readings. */
export const VALUE_NOT_DEFINED = 'not defined';
export const VALUE_NOT_AVAILABLE = 'not available';
export const VALUE_NOT_IN_EXPORT = 'not in export';
export const VALUE_DASH = '—';
export const VALUE_NO_BATTLES_HIDDEN = 'no battles';
export const VALUE_NO_SHOTS_HIDDEN = 'no shots';
export const VALUE_PER_BATTLE_TYPE = 'Available per battle type';
/** UI-SPEC Garage values. */
export const GARAGE_YES = 'Yes';
export const GARAGE_NO = 'No';
/** Shown in the Vehicle column when the export wrote no usable name. */
export const VEHICLE_BLANK_NAME = '(not recorded)';

/**
 * The 17 column headers, keyed by the canonical column key.
 *
 * The keys are canonical and the export's own header names are not: the same
 * logical column is `FRAGS_COUNT` in one title's file and `FRAGS` in another's,
 * so a key per export header would give the table 17 names per view.
 *
 * They are the worker's own `VehicleColumn.key` values — `winRate`,
 * `avgDamage`, `xp` and so on, from `src/lib/features/vehicles/vehicle-aggregate.ts` — and
 * they are the keys that reach the DOM in `data-testid="vehicle-sort-{key}"`
 * and 05-14's `column-toggle-{key}`. Spelling them differently here would put
 * a second vocabulary between the worker and the table, and the table's header
 * would fall through to printing the key itself: a column headed `winRate`
 * instead of `Win rate`. `tests/unit/vehicles/vehicle-blocks.test.ts` builds a real view
 * and fails if any column key is missing from this object, which is what keeps
 * the two sides from drifting apart again.
 */
export const VEHICLE_COLUMN_LABELS = {
  vehicle: 'Vehicle',
  battles: 'Battles',
  winRate: 'Win rate',
  avgDamage: 'Avg damage',
  frags: 'Frags',
  xp: 'Total XP',
  survival: 'Survival rate',
  hitRatio: 'Hit ratio',
  maxDamage: 'Max damage',
  maxFrags: 'Max frags',
  maxXp: 'Max XP',
  damageReceived: 'Damage received',
  spotted: 'Spotted',
  planesDestroyed: 'Planes destroyed',
  distance: 'Distance',
  lastBattle: 'Last battle',
  inGarage: 'In garage',
} as const;

/** UI-SPEC Column picker: summary and legend. */
export const COLUMN_PICKER_SUMMARY = 'Choose columns';
export const COLUMN_PICKER_LEGEND = 'Extra columns';

/** UI-SPEC Vehicle table title and hints. */
export const VEHICLE_TABLE_TITLE = 'Vehicles';
export const VEHICLE_SCROLL_HINT =
  'Focus the table, then use the arrow keys or Page Up and Page Down to scroll.';
export const VEHICLE_FIND_HINT =
  "Only the rows on screen are loaded into the page, so use Search vehicles rather than your browser's find.";

/** UI-SPEC New copy: No search match, Derived-value note, Warships note. */
export const VEHICLE_NO_MATCH = 'No vehicles match your search.';
export const VEHICLE_DERIVED_NOTE =
  "Win rate and average damage are calculated here from the export's totals (wins ÷ battles, damage dealt ÷ battles).";
export const WARSHIPS_ALL_NOTE =
  'Warships all-battles rows only record battles. Choose a battle type to see wins and damage.';

/** UI-SPEC Battle-type notes: WoT/Blitz, and Warships. */
export const BATTLE_TYPE_NOTE_TANKS =
  'Battle-type data covers only part of your battles, so these rows will not add up to the All battles totals.';
export const BATTLE_TYPE_NOTE_WARSHIPS =
  'Each Warships battle is counted under two battle types, so rows from different battle types cannot be added together.';

/** UI-SPEC Battle-type summary heading, caption, disclosure, headers, note. */
export const BATTLE_TYPE_SUMMARY_HEADING = 'Battles by battle type';
export const BATTLE_TYPE_SUMMARY_CAPTION =
  'Battle types are numbered in the export but not named, so they are shown as "Battle type N".';
export const BATTLE_TYPE_SUMMARY_DISCLOSURE = 'Battle types';
export const BATTLE_TYPE_SUMMARY_HEADERS = ['Battle type', 'Battles', 'Wins', 'Damage dealt'];
export const BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS =
  'In Warships each battle is counted under two battle types, so these rows add up to more than your battle count.';

/**
 * The Warplanes 20-row note, with all four of its singular/plural decisions.
 *
 * A four-part sentence with two counts in it, and the UI-SPEC gives its
 * singular forms explicitly: `1 plane record ... has` and `1 battle`. The verb
 * agrees with the record count and the trailing verb with the battle count, so
 * one record and one battle reads correctly, four and eight reads correctly, and
 * four records with one battle — the shape an export with one flown plane
 * actually has — reads correctly too.
 */
export function formatWarplanes20Note(records: number, battles: number, locale?: string): string {
  const n = formatNumber(records, locale);
  const b = formatNumber(battles, locale);
  // Both verbs key on the RECORD count, not the battle count. The sentence has
  // one subject — the plane records — so "1 plane record ... has ... It records
  // 1 battle" has to agree twice; a note that said "They" about a single record
  // is the kind of thing that makes a reader distrust the count next to it.
  return (
    `${n} plane record${records === 1 ? '' : 's'} in the newer Warplanes file ` +
    `${records === 1 ? 'has' : 'have'} no names in the export. ` +
    `${records === 1 ? 'It records' : 'They record'} ${b} ` +
    `battle${battles === 1 ? '' : 's'} in total.`
  );
}

/**
 * The table's accessible name: `Vehicle statistics, WoT, all battles`.
 *
 * The same string the region's `aria-label` and the hidden `<caption>` carry,
 * so a screen reader announces the scroller with its context rather than as an
 * unlabelled region. A null battle type reads `all battles`; a code reads
 * `Battle type {code}`, the same words the control and the note use, so the
 * three never disagree about what is being shown.
 */
export function formatVehicleRegionName(title: VehicleTitleId, battleType: string | null): string {
  const label = VEHICLE_TITLE_LABELS[title];
  const scope = battleType === null ? 'all battles' : `Battle type ${battleType}`;
  return `Vehicle statistics, ${label}, ${scope}`;
}

/**
 * What the live region announces when the title or battle type changes:
 * `Showing WoT, all battles: 42 vehicles.`
 *
 * The count is in the announcement because the row count changes with the
 * filter and a reader who is not watching the table has no other way to know
 * that a change landed, or how much of their data is now on screen. The
 * singular is explicit, because "1 vehicles" is the kind of thing a reader stops
 * trusting the rest of the page over.
 */
export function formatVehicleAnnouncement(
  title: VehicleTitleId,
  battleType: string | null,
  count: number,
  locale?: string,
): string {
  const label = VEHICLE_TITLE_LABELS[title];
  const scope = battleType === null ? 'all battles' : `Battle type ${battleType}`;
  return `Showing ${label}, ${scope}: ${formatNumber(count, locale)} vehicle${count === 1 ? '' : 's'}.`;
}

/**
 * The count line above the table: `1,204 vehicles · 3 with no battles`.
 *
 * The zero-battle part is omitted entirely at zero rather than shown as
 * "· 0 with no battles": a vehicle list where every row has battles is the
 * ordinary case, and a trailing zero there is noise that costs a clause of
 * reading for no information. Both counts have explicit singulars, and a single
 * vehicle with no battles is the case most likely to be seen and least likely to
 * be written by hand.
 */
export function formatVehicleCount(total: number, zeroBattle: number, locale?: string): string {
  const t = formatNumber(total, locale);
  const first = `${t} vehicle${total === 1 ? '' : 's'}`;
  if (zeroBattle === 0) return first;
  return `${first} · ${formatNumber(zeroBattle, locale)} with no battles`;
}

/** The count line with a search active: `3 of 5,000 vehicles shown`. */
export function formatVehicleSearchCount(shown: number, total: number, locale?: string): string {
  return `${formatNumber(shown, locale)} of ${formatNumber(total, locale)} vehicles shown`;
}

/** UI-SPEC Empty state body — title absent, and title with no rows. */
export function formatTitleNotInExport(titleLabel: string): string {
  return `${titleLabel} is not in this export`;
}

/** UI-SPEC Empty state body — title with no rows. */
export function formatTitleNoRows(titleLabel: string): string {
  return `This export contains no vehicle rows for ${titleLabel}`;
}

/** One table cell as the page renders it: what it says, and how it is styled. */
export type VehicleCellView = {
  /** The visible text. */
  text: string;
  /** True when the cell is a non-value and should read as muted chrome. */
  muted: boolean;
  /** Text for a screen reader when the visible text says too little, else null. */
  hidden: string | null;
};

/** What each non-numeric special key renders as. */
const SPECIAL_VALUES: Readonly<Record<SpecialKey, { text: string; hidden: string | null }>> = {
  nd: { text: VALUE_NOT_DEFINED, hidden: null },
  na: { text: VALUE_NOT_AVAILABLE, hidden: null },
  missing: { text: VALUE_NOT_IN_EXPORT, hidden: null },
  'no-battles': { text: VALUE_DASH, hidden: VALUE_NO_BATTLES_HIDDEN },
  'no-shots': { text: VALUE_DASH, hidden: VALUE_NO_SHOTS_HIDDEN },
  'per-type': { text: VALUE_PER_BATTLE_TYPE, hidden: null },
};

/**
 * One table cell, as text plus the two things a cell needs beyond its text.
 *
 * The kind decides the format, so the table never has to guess (D-25): `count`
 * and `whole` are exact grouped integers, `percent` is one decimal with a `%`,
 * `text` and `date` pass the export's characters through untouched, and `garage`
 * is Yes/No.
 *
 * A `percent` cell's number IS the percentage — 55, not 0.55 — because the
 * worker's `derived` spec scales the ratio once, when it builds the cell, and
 * `formatPercent` is named for the value it is given. There is deliberately NO
 * second multiply here: doing it in both places is what made plan 05-14 find a
 * Warplanes win rate of `5,000.0%` where the export says two wins in four
 * games. One place scales, and it is the builder.
 *
 * Every special is muted and none is, which is the whole reason the flag
 * exists: a row of `not available` must not read as a row of numbers, and a
 * muted number would be a real value made unreadable. The two dashes carry
 * hidden text because a dash on its own tells a screen-reader user that nothing
 * is there and not why; `no battles` and `no shots` are different facts, and the
 * difference is the point of the column.
 *
 * A date cell prints the export's own text. Parsing it into a local date and
 * reformatting would move it by a day for a reader west of UTC (D-01), and the
 * export's string is the one the user recognises from their own file.
 */
export function formatVehicleCell(
  cell: VehicleCell,
  kind: ColumnKind,
  locale?: string,
): VehicleCellView {
  if (cell.t === 'x') {
    const special = SPECIAL_VALUES[cell.v];
    return { text: special.text, muted: true, hidden: special.hidden };
  }
  if (cell.t === 's' || cell.t === 'd') {
    return { text: cell.v, muted: false, hidden: null };
  }
  if (cell.t === 'b') {
    return { text: cell.v ? GARAGE_YES : GARAGE_NO, muted: false, hidden: null };
  }
  // `t === 'n'`: the only kind any arithmetic may touch, and the only one the
  // column's kind has an opinion about.
  const value = cell.v;
  switch (kind) {
    case 'count':
      return { text: formatNumber(value, locale), muted: false, hidden: null };
    case 'whole':
      return { text: formatWholeNumber(value, locale), muted: false, hidden: null };
    case 'percent':
      return { text: formatPercent(value, locale), muted: false, hidden: null };
    default:
      return { text: String(value), muted: false, hidden: null };
  }
}

// -----------------------------------------------------------------------------
// Financial data — FINANCE-01..02, D-15..D-20
// -----------------------------------------------------------------------------

/** UI-SPEC New copy: Financial sub-headings. */
export const FINANCIAL_PREMIUM_HEADING = 'Premium time';
export const FINANCIAL_CURRENCY_HEADING = 'Virtual currency';
/** UI-SPEC New copy: Financial loading. */
export const FINANCIAL_LOADING = 'Calculating financial data...';
/** UI-SPEC Empty state body — Financial sub-blocks: the whole file is absent. */
export const FINANCIAL_NOT_IN_EXPORT = 'Not in this export';
/** UI-SPEC Error state — financial data. */
export const FINANCIAL_ERROR =
  'Financial data could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.';
/** UI-SPEC Empty state body — nothing usable, per sub-block. */
export const PREMIUM_NO_USABLE =
  'No premium operations with a recognisable duration were found in this export.';
export const CURRENCY_NO_USABLE =
  'No virtual-currency operations with a known type and a numeric amount were found in this export.';
/** UI-SPEC Premium chart title. */
export const PREMIUM_CHART_TITLE = 'Premium days granted per month';

/** Which Financial sub-block an empty-state string is for. */
export type FinancialBlock = 'premium' | 'currency';

/**
 * The per-block empty state when the file was present but held no rows:
 * `This export contains no rows for Premium time`.
 *
 * Naming the file, not the category, because "no rows" and "not in this export"
 * are different problems for the reader: the first means the export omitted this
 * game's data, the second means this export has no such file at all, and only
 * one of them is fixed by exporting a wider date range.
 */
export function formatFinancialNoRows(block: FinancialBlock): string {
  return `This export contains no rows for ${block === 'premium' ? FINANCIAL_PREMIUM_HEADING : FINANCIAL_CURRENCY_HEADING}`;
}

/**
 * The premium exclusion explanation, amended in 05-08.
 *
 * All three reasons, because a row dropped without being counted is a row the
 * chart silently omits while the pill reports a smaller number: a premium value
 * that is not a duration, a value that is a withdrawal (a removal of time, not a
 * grant), and a date that cannot be read (no month to place it in). The wording
 * is asserted in `tests/unit/shell/ui-copy.test.ts` against the amended UI-SPEC row.
 */
export const PREMIUM_EXCLUDED_EXPLANATION =
  'Rows whose premium value is not a recognisable duration or is a withdrawal, or whose date cannot be read, are not counted in the chart.';

/**
 * The currency exclusion explanation, amended in 05-08.
 *
 * Same reason as the premium side, plus the date clause for the same reason. A
 * negative amount is covered by "non-numeric" on purpose: an export that records
 * a withdrawal as a negative deposit must not have it summed as an inflow, and
 * the reader is told the row is excluded rather than that it was reversed.
 */
export const CURRENCY_EXCLUDED_EXPLANATION =
  'Operations with an unknown type, a non-numeric amount or a date that cannot be read are not counted in any chart or total below.';

/** UI-SPEC New copy: Currency block caption, and the basis caption. */
export const CURRENCY_BLOCK_CAPTION =
  'Each currency has its own scale, so bar heights cannot be compared between charts. Dates are as recorded in the export.';
export const BAR_CHART_BASIS_CAPTION = 'Dates are as recorded in the export.';
/** UI-SPEC New copy: Chart keyboard hint. */
export const BAR_CHART_KEYBOARD_HINT = 'Use the left and right arrow keys to move between months.';
/** The tooltip's final line, which is the caption without its full stop. */
export const TOOLTIP_BASIS_LINE = 'Dates as recorded in the export';

/** UI-SPEC New copy: Flow legend. The words, not the swatches, carry it. */
export const FLOW_LEGEND_DEPOSITED = 'Deposited (above the line)';
export const FLOW_LEGEND_WITHDRAWN = 'Withdrawn (below the line)';

/** UI-SPEC New copy: Other currencies. */
export const OTHER_CURRENCIES_HEADING = 'Other currencies';
export const OTHER_CURRENCIES_CAPTION = 'These currencies have too few operations for a chart.';
/** The label for a currency code the export left blank. */
export const CURRENCY_BLANK_CODE = '(not recorded)';

/** UI-SPEC New copy: Monthly data table. */
export const MONTHLY_TABLE_DISCLOSURE = 'Monthly data table';
export const PREMIUM_TABLE_HEADERS = ['Month', 'Days granted', 'Grants'];
export const CURRENCY_TABLE_HEADERS = ['Month', 'Deposited', 'Withdrawn', 'Operations'];

/**
 * The excluded-row pill: `7 premium rows excluded`, or the empty string at zero.
 *
 * Zero is the empty string so the component has one condition instead of two —
 * the UI-SPEC says the pill is never rendered at zero, and returning a label
 * there would invite a caller to render it. Each of the three pills follows
 * this shape and each has an explicit singular, because a lone excluded row is
 * a normal thing to see in a small export and "1 premium rows excluded" is the
 * kind of error that makes a reader distrust the count itself.
 */
export function formatPremiumExcludedPill(n: number, locale?: string): string {
  if (n === 0) return '';
  return `${formatNumber(n, locale)} premium row${n === 1 ? '' : 's'} excluded`;
}

/** The currency block's excluded-row pill: `4 operation rows excluded`. */
export function formatOperationExcludedPill(n: number, locale?: string): string {
  if (n === 0) return '';
  return `${formatNumber(n, locale)} operation row${n === 1 ? '' : 's'} excluded`;
}

/** The spend block's excluded-row pill: `3 paid orders excluded`. */
export function formatPaidExcludedPill(n: number, locale?: string): string {
  if (n === 0) return '';
  return `${formatNumber(n, locale)} paid order${n === 1 ? '' : 's'} excluded`;
}

/**
 * The premium disclosure heading: `Premium values not charted (3)`.
 *
 * Renamed in 05-08 from a heading that said "unrecognised". It no longer lists
 * only unrecognised values: a withdrawal row's premium string parses fine and is
 * still not charted, so the old heading told the reader something false about
 * the string in front of them. The `data-testid` stays `premium-unrecognised` so
 * the consumer plan and its tests keep the hook they were written against.
 */
export function formatPremiumUnrecognisedDisclosure(count: number): string {
  return `Premium values not charted (${formatNumber(count)})`;
}

/**
 * The disclosure's overflow line: `and 12 more`.
 *
 * The listed strings are capped at 20, so the count is of what was NOT listed.
 * A reader who needs to know which of their rows were dropped has to be able to
 * see that the list is partial rather than assuming it is everything.
 */
export function formatUnrecognisedOverflow(remaining: number): string {
  return `and ${formatNumber(remaining)} more`;
}

/** The figures a premium summary sentence is built from. */
export type PremiumSummaryFigures = {
  /** How many drawn months had at least one grant. */
  monthsWithGrants: number;
  /** How many months the chart draws in total. */
  spanMonths: number;
  /** Total granted time in whole seconds — an integer, never a rounded float. */
  totalSeconds: number;
  /** How many operations contributed. */
  grants: number;
  /** Month index of the largest month. */
  peakMonth: number;
  /** The largest month's granted time in whole seconds. */
  peakSeconds: number;
};

/**
 * The premium block's summary sentence: `Premium time was granted in 2 of 5
 * months: 5 in total across 3 operations. The largest month was 2019-03 with 3.`
 *
 * "2 of 5 months" rather than "5 days in March" because the gaps are the finding:
 * a block that granted time in two of five months is a different fact from one
 * that granted five days' worth in total, and only the first says the export is
 * sparse. The largest month is named because that is the row a reader will want
 * next, and it is rendered through the same day formatter as everything else, so
 * a single day reads `1 day`.
 */
export function formatPremiumSummary(figures: PremiumSummaryFigures, locale?: string): string {
  const { monthsWithGrants, spanMonths, totalSeconds, grants, peakMonth, peakSeconds } = figures;
  return (
    `Premium time was granted in ${formatNumber(monthsWithGrants, locale)} of ` +
    `${formatNumber(spanMonths, locale)} months: ` +
    `${formatPremiumDays(totalSeconds, locale)} in total across ` +
    `${formatNumber(grants, locale)} operation${grants === 1 ? '' : 's'}. ` +
    `The largest month was ${formatMonthLabel(peakMonth)} with ` +
    `${formatPremiumDays(peakSeconds, locale)}.`
  );
}

/** The figures a currency block's summary sentence is built from. */
export type CurrencySummaryFigures = {
  /** Deposited total, in micro-units. */
  inUnits: bigint;
  /** Withdrawn total, in micro-units. */
  outUnits: bigint;
  /** Usable operations in the block. */
  ops: number;
  firstMonth: number;
  lastMonth: number;
};

/**
 * The shared "one month versus many" clause.
 *
 * `from 2019-01 to 2019-07` and `in 2019-03` are the same fact stated honestly:
 * a single-month block is a currency with one month of history, and "from
 * 2019-03 to 2019-03" reads like a bug in the date handling.
 */
function monthSpan(firstMonth: number, lastMonth: number): string {
  if (firstMonth === lastMonth) return `in ${formatMonthLabel(firstMonth)}`;
  return `from ${formatMonthLabel(firstMonth)} to ${formatMonthLabel(lastMonth)}`;
}

/**
 * A currency block's summary: `Deposited 1 and withdrew 2.5 across 9 operations,
 * from 2019-01 to 2019-07.`
 *
 * Both directions are named, not just the net, because a currency can be heavily
 * two-way and a single figure would hide the churn. The amounts are exact —
 * the compact form is for the axis only, and the axis carries the exact value in
 * its `<title>`.
 */
export function formatCurrencySummary(figures: CurrencySummaryFigures, locale?: string): string {
  const { inUnits, outUnits, ops, firstMonth, lastMonth } = figures;
  return (
    `Deposited ${formatFlowAmount(inUnits, locale)} and withdrew ` +
    `${formatFlowAmount(outUnits, locale)} across ${formatNumber(ops, locale)} ` +
    `operation${ops === 1 ? '' : 's'}, ${monthSpan(firstMonth, lastMonth)}.`
  );
}

/** The figures one "Other currencies" row is built from. */
export type OtherCurrencyFigures = {
  /** The code as the export wrote it, or null when it wrote none. */
  code: string | null;
  inUnits: bigint;
  outUnits: bigint;
  ops: number;
  firstMonth: number;
  lastMonth: number;
};

/**
 * One row of the Other currencies list: `Deposited 0 · Withdrawn 0 · 2019-05 ·
 * 1 operation`.
 *
 * Every currency code in the export appears in either a chart or this list, so
 * this row is the only place a reader learns a currency exists at all. It
 * therefore shows the same span and operation count as a charted block, with the
 * separator dots of a compact line rather than a sentence, because a list of
 * eight one-line rows of full sentences is unreadable.
 */
export function formatOtherCurrencyRow(figures: OtherCurrencyFigures, locale?: string): string {
  const { inUnits, outUnits, ops, firstMonth, lastMonth } = figures;
  // A single month shows the bare `YYYY-MM`, exactly as the summary sentence
  // does: "2019-05 to 2019-05" reads like a date-range bug rather than like one
  // month of history. The code is not in this string — the component renders it
  // in the Label role beside the Caption, so a screen reader reads the code and
  // the figures as one row without the code being part of the sentence.
  const span =
    firstMonth === lastMonth
      ? formatMonthLabel(firstMonth)
      : `${formatMonthLabel(firstMonth)} to ${formatMonthLabel(lastMonth)}`;
  return (
    `Deposited ${formatFlowAmount(inUnits, locale)} · ` +
    `Withdrawn ${formatFlowAmount(outUnits, locale)} · ` +
    `${span} · ` +
    `${formatNumber(ops, locale)} operation${ops === 1 ? '' : 's'}`
  );
}

/** One month of premium time, as the tooltip and the cell label receive it. */
export type PremiumMonthFigure = {
  /** Month index. */
  month: number;
  /** Granted time in whole seconds; 0 for an empty month. */
  seconds: number;
  /** Grants in the month; 0 for an empty month. */
  grants: number;
  /** Distinct grant sizes as `[seconds, count]`, already ordered and truncated. */
  sizes: ReadonlyArray<readonly [seconds: number, count: number]>;
  /** How many sizes were dropped from `sizes`. */
  moreSizes: number;
};

/** A tooltip's two fixed lines and its extra lines, in render order. */
export type TooltipLines = {
  line1: string;
  line2: string;
  extra: string[];
};

/**
 * The premium tooltip: month, grant line, one sizes line, then the basis line.
 *
 * The sizes are ONE line joined by commas rather than one line per size, because
 * the tooltip is capped at 240px and a month with four sizes would push the basis
 * line — the one that stops the reader assuming a timezone conversion — off the
 * bottom. Dropped sizes leave a trailing `+{k} more sizes` so the line never
 * looks complete when it is not.
 *
 * An empty month says so in line 2 and keeps only the basis line: there is no
 * grant line to restate and no sizes to show, and an empty chart column is a
 * fact rather than a gap in the data.
 */
export function formatPremiumTooltip(month: PremiumMonthFigure, locale?: string): TooltipLines {
  const line1 = formatMonthLabel(month.month);
  const basis = [TOOLTIP_BASIS_LINE];
  if (month.grants === 0) {
    return { line1, line2: 'No premium granted', extra: basis };
  }
  const days = formatPremiumDays(month.seconds, locale);
  const line2 = `${days} granted · ${formatNumber(month.grants, locale)} grant${month.grants === 1 ? '' : 's'}`;
  const extra: string[] = [];
  if (month.sizes.length > 0) {
    const parts = month.sizes.map(
      ([seconds, count]) =>
        `${formatPremiumDays(seconds, locale)} × ${formatNumber(count, locale)}`,
    );
    if (month.moreSizes > 0) {
      parts.push(`+${formatNumber(month.moreSizes, locale)} more sizes`);
    }
    extra.push(parts.join(', '));
  }
  extra.push(TOOLTIP_BASIS_LINE);
  return { line1, line2, extra };
}

/** One month of virtual-currency flow, as the tooltip and cell label receive it. */
export type CurrencyMonthFigure = {
  month: number;
  /** Micro-units deposited; 0n for an empty month. */
  inUnits: bigint;
  /** Micro-units withdrawn; 0n for an empty month. */
  outUnits: bigint;
  inOps: number;
  outOps: number;
};

/**
 * The currency tooltip: month, deposit line, withdrawal line, basis line.
 *
 * The two directions get one line each rather than being netted, matching the
 * legend and the table. An empty month reads `No operations` — "no operations"
 * rather than "no deposits", because a month with withdrawals and no deposits
 * is a real month the reader is looking at, not an empty one.
 */
export function formatCurrencyTooltip(month: CurrencyMonthFigure, locale?: string): TooltipLines {
  const line1 = formatMonthLabel(month.month);
  if (month.inOps === 0 && month.outOps === 0) {
    return { line1, line2: 'No operations', extra: [TOOLTIP_BASIS_LINE] };
  }
  const inOps = formatNumber(month.inOps, locale);
  const outOps = formatNumber(month.outOps, locale);
  return {
    line1,
    line2: `Deposited ${formatFlowAmount(month.inUnits, locale)} · ${inOps} operation${month.inOps === 1 ? '' : 's'}`,
    extra: [
      `Withdrawn ${formatFlowAmount(month.outUnits, locale)} · ${outOps} operation${month.outOps === 1 ? '' : 's'}`,
      TOOLTIP_BASIS_LINE,
    ],
  };
}

/**
 * The accessible name of a premium month cell, read by a screen reader when the
 * month takes focus: `2019-03: 5 days granted, 3 grants`.
 *
 * The figures are restated rather than pointing at the tooltip, because the cell
 * a keyboard user has focused is the only thing they are told about, and the
 * tooltip is a pointer affordance they have not opened. The empty month's form
 * is the one that matters most here — a bare dash or an empty cell would
 * announce as nothing at all.
 */
export function formatPremiumCellLabel(month: PremiumMonthFigure, locale?: string): string {
  const label = formatMonthLabel(month.month);
  if (month.grants === 0) return `${label}: no premium granted`;
  const days = formatPremiumDays(month.seconds, locale);
  return `${label}: ${days} granted, ${formatNumber(month.grants, locale)} grant${month.grants === 1 ? '' : 's'}`;
}

/** The accessible name of a currency month cell. */
export function formatCurrencyCellLabel(month: CurrencyMonthFigure, locale?: string): string {
  const label = formatMonthLabel(month.month);
  if (month.inOps === 0 && month.outOps === 0) return `${label}: no operations`;
  const ops = formatNumber(month.inOps + month.outOps, locale);
  return (
    `${label}: deposited ${formatFlowAmount(month.inUnits, locale)}, ` +
    `withdrawn ${formatFlowAmount(month.outUnits, locale)}, ` +
    `${ops} operation${ops === '1' ? '' : 's'}`
  );
}

// -----------------------------------------------------------------------------
// Real-money spend — FINANCE-03, D-21..D-24
// -----------------------------------------------------------------------------

/** UI-SPEC New copy: Spend sub-heading and intro. */
export const SPEND_HEADING = 'Real-money spend';
export const SPEND_INTRO =
  'Only paid orders are totalled. Failed and new orders are counted separately. Each currency has its own total: nothing is converted or added across currencies.';
/** UI-SPEC Spend loading. */
export const SPEND_LOADING = 'Calculating spend...';
/** UI-SPEC Empty state body — nothing usable. */
export const SPEND_NO_USABLE = 'No orders with a recognisable status were found in this export.';
/** UI-SPEC Error state — spend summary. */
export const SPEND_ERROR =
  'The spend summary could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.';

/** UI-SPEC Spend card figure labels. */
export const SPEND_LABEL_FAILED = 'Failed';
export const SPEND_LABEL_NEW = 'New';
export const SPEND_LABEL_OTHER = 'Other status';

/** UI-SPEC New copy: Spend breakdown. */
export const SPEND_BREAKDOWN_DISCLOSURE = 'Breakdown by year and game code';
export const SPEND_BY_YEAR = 'By year';
export const SPEND_BY_GAME = 'By game code';
export const SPEND_BREAKDOWN_HEADERS = ['Year', 'Game code', 'Paid orders', 'Total'];
export const SPEND_UNKNOWN_YEAR = 'Unknown year';
export const SPEND_BLANK_GAME = '(not recorded)';

/** UI-SPEND Spend excluded pill and explanation. */
export const SPEND_EXCLUDED_EXPLANATION =
  'Paid orders with a non-numeric amount are not included in any total.';

/** UI-SPEND Unknown currency: heading and caption. */
export const UNKNOWN_CURRENCY_HEADING = 'Unknown currency';
export const UNKNOWN_CURRENCY_CAPTION =
  'These orders have no valid three-letter currency code, so the amount has no unit and may mix different currencies.';

/** The spend card's paid-order count: `1 paid order`, `4 paid orders`. */
export function formatPaidOrders(n: number, locale?: string): string {
  return `${formatNumber(n, locale)} paid order${n === 1 ? '' : 's'}`;
}

/**
 * The gift-order line: `Includes 2 gift orders worth USD 5.01.`
 *
 * The worth arrives already formatted by the caller, deliberately. This
 * formatter is about the COUNT and its singular; the amount is a currency value
 * and currency values go through {@link formatMoney} at the point they are
 * computed, so there is exactly one place a currency is rendered and this one
 * cannot invent a second code or a symbol for it.
 */
export function formatGiftLine(count: number, worth: string): string {
  return `Includes ${formatNumber(count)} gift order${count === 1 ? '' : 's'} worth ${worth}.`;
}

// =============================================================================
// Phase 6 — Login history copy and formatters (06-02-PLAN Task 3)
// =============================================================================
//
// One row of 06-UI-SPEC's Copywriting Contract per constant, and the doc
// comment names that row. Nothing here returns markup (D-04/D-21): untrusted
// export data is interpolated by the renderer, so a formatter that built a tag
// would be the only place in the app that did.
//
// The inventory lives in this one plan so that the four capability plans
// (06-08, 06-10, 06-12, 06-13) read these strings and never edit this file.
// =============================================================================

/**
 * The city download's Cancel button. 06-UI-SPEC Copywriting Contract, "City
 * button and Cancel" row.
 *
 * **Decision (06-02 execution checkpoint, option-b), recorded as 06-UI-SPEC
 * Delta 11.** The contract originally read `Cancel`. The review chose
 * `Cancel download`, and the reason is the button's context, not its style:
 * the control is rendered only while a download is in progress, so a
 * screen-reader user who tabs straight to it hears "Cancel" as a bare verb with
 * no object and no state attached. The visible progress line beside it names
 * the object, but a label is read before the surrounding text is scanned, and
 * the button is reachable on its own.
 *
 * This is a deliberate departure from a checked-in design document, so it is
 * written down in two places rather than contradicted in one: Delta 11 in
 * 06-UI-SPEC records the deviation and the reason, and the contract's copy
 * table, state matrix and section 5 are amended to agree. A departure from the
 * contract that is not recorded is indistinguishable from a drift, and the next
 * reader of the contract would be reading a string this app never ships.
 *
 * Consequence for the plans that read it: the e2e selector text is
 * `Cancel download`, not `Cancel`.
 */
export const CITY_CANCEL_LABEL = 'Cancel download';

/**
 * How a cancelled city download is presented. 06-UI-SPEC Copywriting Contract,
 * "City cancelled, unavailable" row, read together with D-14.
 *
 * **Decision (06-02 execution checkpoint, option-a), recorded as 06-UI-SPEC
 * Delta 10.** `'neutral'`, not `'error'`.
 *
 * D-14 says cancel or failure leaves the country view intact "with a visible
 * error". The UI-SPEC review took the departure deliberately, and this comment
 * records exactly what the departure is and is not. It is not: that a cancel is
 * quieter, hidden, or unreported. Everything D-14 protects still holds —
 *   - nothing is kept (the bytes are discarded, never stored, D-15);
 *   - the country view is untouched, byte for byte, by both paths;
 *   - the outcome is visible text either way. The sentence
 *     `City-level download cancelled. Nothing was kept.` is not a hover title
 *     and not a console message; it is in the block, on screen, permanently.
 * What differs is only the CHROME and the ANNOUNCEMENT: cancel gets neutral
 * border `#80868b` / background `#f1f3f4` / text `#3c4043` and a polite
 * live-region announcement; a genuine failure keeps the destructive border
 * `#c5221f` / background `#fce8e6` / text `#8a1c17` and `role="alert"`.
 *
 * The reason a deliberate action should not wear a failure's colours is the
 * whole of it. Styling the user's own choice as a fault, and announcing it as
 * an alert, spends the destructive treatment on the one outcome that is not a
 * fault — which makes the treatment mean less on the outcomes that are.
 *
 * `'error'` remains in the type because it is the value the contract's literal
 * D-14 reading would use, and because a reader comparing this file to the
 * contract should be able to see that the other reading exists. It is not
 * dead code by accident; it is the recorded alternative.
 */
export const CITY_CANCELLED_TONE: 'neutral' | 'error' = 'neutral';

// -----------------------------------------------------------------------------
// Block states
// -----------------------------------------------------------------------------

/** Copywriting Contract, "Loading" row: `Calculating login history...`. */
export const LOGIN_HISTORY_LOADING = 'Calculating login history...';

/**
 * Copywriting Contract, "Empty state body — no file" row.
 *
 * `no-source` is the state where `Activity_history` has rows but none of the
 * files that carry IP addresses is present, so there is nothing to say about
 * logins either way. The sentence names that absence rather than an absence of
 * logins, because those are different facts and only the first one is true.
 */
export const LOGIN_HISTORY_NO_SOURCE =
  'This export has no session or login file, so there is no login history to show.';

/** Copywriting Contract, "Empty state body — nothing usable" row. */
export const LOGIN_HISTORY_NO_USABLE = 'No readable IP addresses were found in this export.';

/**
 * Copywriting Contract, "Error state — login history" row. Destructive chrome,
 * `role="alert"`, and no `aria-live` attribute so it is announced once.
 *
 * The remedy is stated because the alternative is not obvious: a reader who
 * has just seen a failure on a card is being told the data they are looking at
 * is still the data they imported, which is the fact that matters most here.
 */
export const LOGIN_HISTORY_ERROR =
  'Login history could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.';

// -----------------------------------------------------------------------------
// Reveal control (D-07)
// -----------------------------------------------------------------------------

/**
 * Copywriting Contract, "Reveal button" row, masked.
 *
 * A label swap and NOT `aria-pressed` (UI-SPEC section 3, a11y Decision): with
 * a pressed state the control announces two changes where one is meant, and
 * the pressed state would also have to be kept in step with the caption.
 * `data-masked` is the test hook instead.
 */
export const MASK_TOGGLE_SHOW = 'Show full IP addresses';

/** Copywriting Contract, "Reveal button" row, revealed. */
export const MASK_TOGGLE_HIDE = 'Hide full IP addresses';

/** Copywriting Contract, "Mask caption" row, masked. */
export const MASK_CAPTION_MASKED = 'IP addresses are masked: the last part of each one is hidden.';

/**
 * Copywriting Contract, "Mask caption" row, revealed.
 *
 * The second sentence is an instruction rather than a warning, because the
 * reveal is a one-way door for anyone else in the room and the reader is the
 * only one who can close it.
 */
export const MASK_CAPTION_REVEALED =
  'Full IP addresses are shown. Hide them again before sharing your screen.';

/** Copywriting Contract, "Mask announcements" row, revealed. State words only, never an address. */
export const MASK_ANNOUNCE_SHOWN = 'Full IP addresses are now shown.';

/** Copywriting Contract, "Mask announcements" row, masked. */
export const MASK_ANNOUNCE_MASKED = 'IP addresses are now masked.';

// -----------------------------------------------------------------------------
// Summary tiles (D-04, D-08)
// -----------------------------------------------------------------------------

/** Copywriting Contract, "Count tile labels" row, tile 1. */
export const LOGIN_TILE_IPS = 'IP addresses';

/** Copywriting Contract, "Count tile labels" row, tile 2. */
export const LOGIN_TILE_COUNTRIES = 'Countries';

/**
 * Copywriting Contract, "Count tile labels" row, tile 3.
 *
 * `IPs`, not `IP addresses`, because the tile is short and this label is the
 * one that has to fit beside the other two at 375px. The value is a count of
 * addresses either way; the table's column header keeps the full form.
 */
export const LOGIN_TILE_UNKNOWN = 'IPs with unknown country';

/** Copywriting Contract, "Fact tile labels" row, tile 4. */
export const LOGIN_TILE_TOP_IP = 'Most-used IP address';

/** Copywriting Contract, "Fact tile labels" row, tile 5. */
export const LOGIN_TILE_TOP_COUNTRY = 'Top country';

/** Copywriting Contract, "Fact tile labels" row, tile 6. */
export const LOGIN_TILE_RANGE = 'First to last login';

/**
 * Copywriting Contract, "Multi-file note" row (RESEARCH Pitfall 11, D-01).
 *
 * A SEPARATE constant rather than a variant of another sentence, because it is
 * conditional in a way nothing else in this block is: it appears only when more
 * than one file contributed login rows. When an export carries both a
 * `Logins.csv` and the session files, both sets of rows are counted and the
 * totals can exceed the account's real login count. That is a deliberate
 * consequence of D-01, and a reader comparing the tile against what the game
 * shows them deserves to be told where the extra rows came from.
 */
export const LOGIN_MULTI_FILE_NOTE =
  'This export lists logins in more than one file, and each file’s rows are counted.';

// -----------------------------------------------------------------------------
// Special values
// -----------------------------------------------------------------------------

/** Copywriting Contract, "Special values" row: an address with no country match (D-08). */
export const LOGIN_UNKNOWN_COUNTRY = 'Unknown country';

/** Copywriting Contract, "Special values" row: the Games cell for a file that names no game. */
export const LOGIN_GAMES_NOT_RECORDED = 'not recorded';

/** Copywriting Contract, "Special values" row: a country the database has, a city it does not. */
export const LOGIN_CITY_UNKNOWN = 'City unknown';

/** Copywriting Contract, "Special values" row: a field the export does not carry. */
export const LOGIN_NOT_IN_EXPORT = 'not in export';

/** Copywriting Contract, "Special values" row: a value that is present but unparseable. */
export const LOGIN_NOT_READABLE = 'not readable';

/**
 * Copywriting Contract, "Special values" row: the em dash shown where a value is
 * genuinely absent and has nothing better to say.
 *
 * An em dash and not a hyphen or a blank: a blank cell in a table is read as a
 * rendering failure, and the dash is a mark the reader already knows from the
 * rest of the app. Every dash is paired with one of the four hidden strings
 * below, so it is never the only thing a screen reader hears.
 */
export const LOGIN_NO_VALUE = '—';

/** Hidden replacement for the dash in the Top country tile. */
export const LOGIN_HIDDEN_NO_KNOWN_COUNTRY = 'no known country';

/** Hidden replacement for the dash in the First-to-last tile when NO row has a date. */
export const LOGIN_HIDDEN_NO_READABLE_DATES = 'no readable dates';

/** Hidden replacement for the dash in a single row's date cell. */
export const LOGIN_HIDDEN_NO_READABLE_DATE = 'no readable date';

/** Hidden replacement for the dash in the Account record row's three figure cells. */
export const LOGIN_HIDDEN_NOT_COUNTED = 'not counted as a login';

// -----------------------------------------------------------------------------
// The IP table (D-05)
// -----------------------------------------------------------------------------

/** Copywriting Contract, "Table title, count line" row: the `h4` above the table. */
export const LOGIN_TABLE_HEADING = 'IP addresses';

/**
 * Copywriting Contract, "Table accessible name" row.
 *
 * One name for the scroller's `aria-label` and the visually hidden `<caption>`,
 * because a table whose caption and its region disagree is read twice with two
 * different answers.
 */
export const LOGIN_TABLE_ARIA_NAME = 'Login history by IP address';

/** Copywriting Contract, "Column headers" row, 1 of 7. */
export const LOGIN_COL_IP = 'IP address';
/** Copywriting Contract, "Column headers" row, 2 of 7. */
export const LOGIN_COL_COUNTRY = 'Country';
/** Copywriting Contract, "Column headers" row, 3 of 7. */
export const LOGIN_COL_LOGINS = 'Logins';
/** Copywriting Contract, "Column headers" row, 4 of 7. */
export const LOGIN_COL_FIRST = 'First seen';
/** Copywriting Contract, "Column headers" row, 5 of 7. */
export const LOGIN_COL_LAST = 'Last seen';
/** Copywriting Contract, "Column headers" row, 6 of 7. */
export const LOGIN_COL_GAMES = 'Games';
/** Copywriting Contract, "Column headers" row, 7 of 7; added only after the city opt-in. */
export const LOGIN_COL_CITY = 'City';

/** Copywriting Contract, "Account record tag and note" row, the tag. */
export const LOGIN_ACCOUNT_TAG = 'Account record';

/**
 * Copywriting Contract, "Account record tag and note" row, the note.
 *
 * The note exists because the row is shown as RECORDED and never re-resolved
 * through the offline table (RESEARCH Open Question 2), so when the recorded
 * country and the table's resolution of the same address disagree, both are
 * right about different things and only this sentence says which is which. It
 * also states the two exclusions, so a reader is not left wondering why the
 * row's figures are dashes or why its country is absent from the map.
 */
export const LOGIN_ACCOUNT_NOTE =
  'The Account record row is the address stored in your account details, shown as recorded. It is not counted as a login and is not on the map.';

/**
 * Copywriting Contract, "Table hints" row, the find-in-page hint.
 *
 * The Phase 5 hint is reused verbatim in the other slot — the component reads
 * `VEHICLE_SCROLL_HINT` rather than restating it — because the keyboard
 * behaviour of the two tables is identical and one edit should reach both.
 */
export const LOGIN_TABLE_FIND_HINT =
  "Only the rows on screen are loaded into the page, so your browser's find cannot see the rest. Sort a column to bring other rows to the top.";

/** Copywriting Contract, "Excluded pill and explanation" row, the explanation. */
export const LOGIN_EXCLUDED_EXPLANATION =
  'Rows whose IP address is blank or cannot be read are not counted in any figure here and are never shown.';

// -----------------------------------------------------------------------------
// The country map (D-08..D-11)
// -----------------------------------------------------------------------------

/** Copywriting Contract, "Map title" row: the `h4` above the map. */
export const MAP_HEADING = 'Logins by country';

/**
 * Copywriting Contract, "Empty state body — no country resolved" row.
 *
 * The `h4` stays and this replaces the summary sentence; the map, legend,
 * attribution and list are not rendered. It says "could not be matched"
 * rather than "unknown", because the addresses are perfectly readable and the
 * gap is between them and this build's table, not in the export.
 */
export const MAP_NO_COUNTRIES =
  'No login IP addresses could be matched to a country, so there is nothing to show on the map.';

/** Copywriting Contract, "Map keyboard hint" row. */
export const MAP_KEYBOARD_HINT = 'Use the arrow keys to move between countries, most logins first.';

/** Copywriting Contract, "Map accessible names" row, the `role="group"` label. */
export const MAP_GROUP_LABEL = 'World map of logins by country';

/**
 * Copywriting Contract, "Attribution" row, the link text.
 *
 * A link and not a bare mention: DB-IP's licence is CC BY 4.0, which asks for
 * a visible link back. It is underlined rather than colour-coded for the same
 * reason — the accent is reserved, and a link needs a non-colour affordance.
 */
export const MAP_ATTRIBUTION_LINK_TEXT = 'IP Geolocation by DB-IP';

/**
 * Copywriting Contract, "Attribution" row, what follows the link.
 *
 * A separate constant INCLUDING its leading comma, so the rendered line is the
 * link followed by this with no template of its own: `…, licensed under CC BY
 * 4.0.` The comma belongs to the punctuation of the sentence, not to the
 * component, and a component that owns it would own the spacing too.
 */
export const MAP_ATTRIBUTION_SUFFIX = ', licensed under CC BY 4.0.';

// -----------------------------------------------------------------------------
// The country list (D-10)
// -----------------------------------------------------------------------------

/** Copywriting Contract, "Country list" row, the `<summary>`. */
export const COUNTRY_LIST_SUMMARY = 'Countries by logins';

/** Copywriting Contract, "Country list" row, header 1 of 3. */
export const COUNTRY_COL_COUNTRY = 'Country';
/** Copywriting Contract, "Country list" row, header 2 of 3. */
export const COUNTRY_COL_LOGINS = 'Logins';
/** Copywriting Contract, "Country list" row, header 3 of 3. */
export const COUNTRY_COL_IPS = 'IP addresses';

/**
 * Copywriting Contract, "Country list" row, the not-drawn suffix.
 *
 * With its LEADING SPACE, so a component concatenates it onto a name rather
 * than composing `name + ' ' + '(not drawn)'` in two places. The list is the
 * guaranteed route to every value for a country too small to shade or to draw,
 * and the suffix is how the reader knows why its shade is missing.
 */
export const COUNTRY_LIST_NOT_DRAWN_SUFFIX = ' (not drawn)';

// -----------------------------------------------------------------------------
// The city block (D-13..D-16)
// -----------------------------------------------------------------------------

/** Copywriting Contract, "City heading and intro" row, the `h4`. */
export const CITY_HEADING = 'City-level detail';

/** Copywriting Contract, "Empty state body — no city asset" row. */
export const CITY_UNAVAILABLE = 'This copy of the page does not include city-level data.';

/**
 * Copywriting Contract, "Error state — city detail" row. Destructive chrome,
 * `role="alert"`, no `aria-live`.
 *
 * ONE FIXED SENTENCE for a failed download, a corrupt file and an unsupported
 * browser alike (RESEARCH Pattern 7). It never echoes a system message, a path
 * or a status code: none of those means anything to a viewer, and a `fetch`
 * failure message is attacker-influenced text on its way to the screen. The
 * remedies are the same in all three cases anyway — the Load button returns and
 * the country view is untouched.
 */
export const CITY_ERROR =
  'City-level detail could not be loaded. Your country view is unchanged. You can try again.';

/**
 * Copywriting Contract, "City cancelled, unavailable" row, the cancelled line.
 *
 * The SENTENCE is identical whichever tone `CITY_CANCELLED_TONE` selects; only
 * the chrome and the live-region behaviour differ. See that constant for the
 * recorded deviation from D-14's literal "visible error" wording (UI-SPEC
 * Delta 10). The sentence is neutral-info, and it ends by saying what actually
 * happened — nothing was kept — rather than by asking the reader to do
 * anything about it.
 */
export const CITY_CANCELLED = 'City-level download cancelled. Nothing was kept.';

/** Copywriting Contract, "City progress" row: the decoding state. */
export const CITY_DECODING = 'Preparing city detail...';

/** Copywriting Contract, "City progress" row, the determinate bar's accessible name. */
export const CITY_PROGRESS_NAME = 'City detail download progress';

/** Copywriting Contract, "City progress" row, the indeterminate bar's accessible name. */
export const CITY_DECODING_NAME = 'Preparing city detail';

/**
 * Copywriting Contract, "City ready" row, the accuracy caption.
 *
 * ALWAYS shown alongside city data, never only on request: a reader who is not
 * told this will take "Warsaw" for a fact about the player. The sentence names
 * the specific wrong answer (an ISP's location rather than the player's) rather
 * than hedging in the abstract, because the hedge is the one this database
 * invites and the concrete case is the one a reader recognises.
 */
export const CITY_ACCURACY_NOTE =
  "City locations are estimates from a public database. They often point to an internet provider's location rather than your own.";

/** Copywriting Contract, "City list" row, the `<summary>`. */
export const CITY_LIST_SUMMARY = 'Cities by logins';

/** Copywriting Contract, "City list" row, header 1 of 4. */
export const CITY_COL_CITY = 'City';
/** Copywriting Contract, "City list" row, header 2 of 4. */
export const CITY_COL_COUNTRY = 'Country';
/** Copywriting Contract, "City list" row, header 3 of 4. */
export const CITY_COL_LOGINS = 'Logins';
/** Copywriting Contract, "City list" row, header 4 of 4. */
export const CITY_COL_IPS = 'IP addresses';

/** Copywriting Contract, "City announcements" row, downloading. */
export const CITY_ANNOUNCE_DOWNLOADING = 'Downloading city-level detail.';

/** Copywriting Contract, "City announcements" row, ready. */
export const CITY_ANNOUNCE_READY = 'City-level detail loaded.';

/**
 * Copywriting Contract, "City announcements" row, cancelled.
 *
 * Distinct from `CITY_CANCELLED`, and the difference is the live region: this
 * is the polite announcement, that is the persistent visible line. They are two
 * facts for two surfaces, and they stay two constants so a screen-reader user
 * hears the state change once at the moment it happens and can re-read the
 * line afterwards.
 */
export const CITY_ANNOUNCE_CANCELLED = 'City-level download cancelled.';

/**
 * The ready line for a manifest whose `month` is not a `YYYY-MM` string.
 *
 * Not a Copywriting Contract row: this is the guard the contract's own
 * formatter needs, because the month is a build-artefact value and a
 * hand-edited or truncated `manifest.json` must not become a DOM string. The
 * parenthetical is dropped rather than the whole sentence, so the reader still
 * learns that city detail loaded and that the City column appeared.
 */
export const CITY_READY_NO_MONTH =
  'City detail loaded from DB-IP. The City column is now in the table above.';

// -----------------------------------------------------------------------------
// Formatters — shared pieces
// -----------------------------------------------------------------------------

/**
 * A share as a whole percent, with the Phase 4 under-half-percent rule.
 *
 * ONE helper for every share in this module, including
 * {@link formatDurationRowText}, because the rule is one rule: a NON-ZERO
 * share under 0.5% reads `<1`, a zero share reads `0`, and everything else
 * rounds to a whole percent. Two implementations of that is how a page ends up
 * with `0%` beside a non-zero count in one card and `<1%` in another.
 *
 * A total of zero reads `0` rather than dividing. Aggregation cannot produce a
 * non-zero numerator over a zero denominator, so this is defensive — and it
 * matters because the alternative is `NaN%` in front of a user.
 */
function formatSharePercent(part: number, total: number): string {
  if (!(part > 0) || !(total > 0)) return '0';
  const percent = (part / total) * 100;
  return percent < 0.5 ? '<1' : String(Math.round(percent));
}

/** `{n} logins` with its singular. */
function loginsLabel(n: number, locale?: string): string {
  return `${formatNumber(n, locale)} login${n === 1 ? '' : 's'}`;
}

/** `{n} IP addresses` with its singular. */
function ipAddressesLabel(n: number, locale?: string): string {
  return `${formatNumber(n, locale)} IP address${n === 1 ? '' : 'es'}`;
}

/** `{n} countries` with its singular. */
function countriesLabel(n: number, locale?: string): string {
  return `${formatNumber(n, locale)} ${n === 1 ? 'country' : 'countries'}`;
}

// -----------------------------------------------------------------------------
// Formatters — shares, counts and dates
// -----------------------------------------------------------------------------

/**
 * The fact-tile sub-line: `{n} logins ({p}%)`, e.g. `1 login (25%)`.
 *
 * The share is of ALL counted logins, the same denominator the map summary
 * sentence and the Top country tile use, so the two percentages on screen can
 * never disagree — including when some addresses have no country and are
 * therefore in the denominator but not on the map.
 *
 * See {@link formatSharePercent} for the `<1%` rule.
 */
export function formatLoginShareLine(count: number, total: number, locale?: string): string {
  return `${loginsLabel(count, locale)} (${formatSharePercent(count, total)}%)`;
}

/**
 * The count line above the IP table: `{n} IP addresses · {l} logins`.
 *
 * A middle dot, the same separator the duration rows and the map tooltip use,
 * so a count line reads the same wherever it appears.
 */
export function formatLoginCountLine(addresses: number, logins: number, locale?: string): string {
  return `${ipAddressesLabel(addresses, locale)} · ${loginsLabel(logins, locale)}`;
}

/**
 * The amber excluded-rows pill: `1 login row without a readable IP address`.
 *
 * The empty string at zero rather than "0 rows", for the same reason
 * {@link formatExcludedPill} returns one: the pill is only rendered above
 * zero, and making that unconditional means a caller cannot get it wrong by
 * forgetting a conditional.
 */
export function formatLoginExcludedPill(n: number): string {
  if (n <= 0) return '';
  return n === 1
    ? '1 login row without a readable IP address'
    : `${formatNumber(n)} login rows without a readable IP address`;
}

/**
 * The honest-count line for addresses the table's cap folded away:
 * `{m} more IP addresses ({k} logins) are counted in the totals but not
 * listed in the table.`
 *
 * The cap exists to bound memory against a hostile archive (D-05). Whatever it
 * folds away has to stay visible as one count, because a table that silently
 * lists fewer rows than its own total implies is a table the reader cannot
 * trust — and a capped export is exactly the case where the reader is most
 * likely to be looking for a number that is not there.
 */
export function formatLoginCapLine(addresses: number, logins: number, locale?: string): string {
  return (
    `${formatNumber(addresses, locale)} more IP address${addresses === 1 ? '' : 'es'} ` +
    `(${loginsLabel(logins, locale)}) ${addresses === 1 ? 'is' : 'are'} ` +
    'counted in the totals but not listed in the table.'
  );
}

/**
 * One login timestamp as a calendar date, `YYYY-MM-DD` (RESEARCH Decision 8,
 * D-03).
 *
 * The day number is `floor(seconds / 86400)` and the date comes from
 * {@link civilFromDays} — no `Date` object anywhere on this path. A `Date`
 * would parse or render in the HOST's zone, so the same export would show a
 * different day for a viewer in Kyiv than for one in Lisbon; a day is a label
 * on a calendar here, never an instant. The floor is what keeps the last second
 * of a leap day ON that day rather than tipping into the next one.
 */
export function formatLoginDate(seconds: number): string {
  const { y, m, d } = civilFromDays(Math.floor(seconds / 86400));
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * The First-to-last tile's value: one date, or `{first} to {last}`.
 *
 * `null` when either end is `null`, and `null` rather than a dash: a dash is
 * what the COMPONENT shows in that case (paired with a hidden
 * `no readable dates`), and a formatter that returned the dash itself would
 * make two places responsible for deciding the same thing.
 */
export function formatLoginDateRange(first: number | null, last: number | null): string | null {
  if (first === null || last === null) return null;
  const a = formatLoginDate(first);
  const b = formatLoginDate(last);
  return a === b ? a : `${a} to ${b}`;
}

// -----------------------------------------------------------------------------
// Formatters — games
// -----------------------------------------------------------------------------

/** The four known game tokens, in the order the Games cell and the list use. */
const GAME_NAMES: Record<string, string> = {
  WOT: 'WoT',
  WOTB: 'WoT Blitz',
  WOWS: 'Warships',
  WOWP: 'Warplanes',
};

/** The fixed display order, longest-known first, matching the contract's Games row. */
const GAME_ORDER: readonly string[] = ['WOT', 'WOTB', 'WOWS', 'WOWP'];

/**
 * One game token as its display name, or the token unchanged if unknown.
 *
 * The token arrives from an archive FILE NAME inside an untrusted zip, so an
 * export with a game this build has never heard of is a real input, not a
 * hypothetical one (T-06-05). Returning it unchanged is the whole of the
 * mitigation: there is no error path, so no error message can be reached, and
 * the token is already bounded to letters, digits and underscores by the
 * session file-name rule before it gets here.
 */
export function formatGameName(token: string): string {
  return GAME_NAMES[token] ?? token;
}

/**
 * The Games cell: the known names in the FIXED order, then any unknown tokens
 * ascending, joined by `, `.
 *
 * Fixed order rather than the order the files happened to be read in, because
 * the same address appearing in WOT and WOWS rows must produce the same string
 * every time, or a re-sorted table shuffles text that did not change. Unknown
 * tokens sort ascending in code-unit order (the Phase 4/5 rule: never
 * `localeCompare`).
 */
export function formatGames(tokens: readonly string[]): string {
  const known = GAME_ORDER.filter((t) => tokens.includes(t));
  const unknown = [...new Set(tokens.filter((t) => !GAME_ORDER.includes(t)))].sort();
  return [...known, ...unknown].map(formatGameName).join(', ');
}

// -----------------------------------------------------------------------------
// Formatters — map sentences
// -----------------------------------------------------------------------------

/**
 * The map's summary sentence, in the four forms the UIC zero-one-many row
 * requires.
 *
 * `countryCount === 1` is the singular. On top of that there is a separate
 * case: when ONE country holds EVERY counted login, the sentence changes shape
 * entirely to `All {t} logins with a known country came from {Country}.` — it
 * names its own base, because "came from 1 country" against a total that
 * includes logins nobody could place would read as a claim about all of them.
 *
 * The unknown-country sentence is appended whenever addresses have no match,
 * so the reader is never left to infer from the percentages that some logins
 * are missing from the map. `topCountry` is an already-resolved English name
 * from the worker: no formatter here takes an address, an ISO code or a raw
 * dataset string.
 */
export function formatMapSummary(
  countryCount: number,
  topCountry: string,
  topLogins: number,
  totalLogins: number,
  unknownAddresses = 0,
  unknownLogins = 0,
  locale?: string,
): string {
  const leader =
    countryCount === 1 && topLogins === totalLogins
      ? `All ${loginsLabel(totalLogins, locale)} with a known country came from ${topCountry}.`
      : `Logins came from ${countriesLabel(countryCount, locale)}. ${topCountry} had the most, ` +
        `with ${formatNumber(topLogins, locale)} of ${loginsLabel(totalLogins, locale)} ` +
        `(${formatSharePercent(topLogins, totalLogins)}%).`;

  if (!(unknownAddresses > 0)) return leader;
  return (
    `${leader} ${ipAddressesLabel(unknownAddresses, locale)} ` +
    `(${loginsLabel(unknownLogins, locale)}) ` +
    `${unknownAddresses === 1 ? 'has' : 'have'} no known country and ` +
    `${unknownAddresses === 1 ? 'is' : 'are'} not on the map.`
  );
}

/** A country's accessible name: `{Country}: {n} logins from {m} IP addresses`. */
export function formatMapCountryLabel(
  name: string,
  logins: number,
  ips: number,
  locale?: string,
): string {
  return `${name}: ${loginsLabel(logins, locale)} from ${ipAddressesLabel(ips, locale)}`;
}

/**
 * The map tooltip's two lines, in order: the country name, then the figures.
 *
 * An array because the tooltip takes two separately styled lines, and a single
 * joined string would force the component to split a sentence apart to style
 * its halves. There is no third line and never an address: the map is
 * country-level, so a country has no address to show.
 */
export function formatMapTooltipLines(
  name: string,
  logins: number,
  ips: number,
  locale?: string,
): readonly [string, string] {
  return [name, `${loginsLabel(logins, locale)} · ${ipAddressesLabel(ips, locale)}`];
}

/**
 * The legend's note: the logarithmic rule in words, then the step starts.
 *
 * The FIRST sentence is the accessibility relief for a ramp whose lightest
 * steps sit below the 3:1 non-text floor on white. Shading is never the only
 * carrier of a value, and this line is what tells the reader the scale is
 * logarithmic rather than proportional — the same job the Phase 4 legend note
 * does for a rank-based ramp.
 *
 * Duplicate step starts are collapsed: two levels can round to the same
 * boundary, and naming it twice reads as two steps that start in the same
 * place. A maximum of 1 gets its own sentence, because there is no range to
 * describe and "Steps start at 1 logins" is a sentence about nothing.
 */
export function formatMapLegendNote(stepStarts: readonly number[], locale?: string): string {
  const base = 'Shading is logarithmic, so each darker step covers a wider range of logins.';
  if (stepStarts.length === 0) return base;
  if (Math.max(...stepStarts) === 1) return 'Every shaded country has 1 login.';

  const unique = [...new Set(stepStarts)].sort((a, b) => a - b).map((n) => formatNumber(n, locale));
  const last = unique[unique.length - 1]!;
  const list = unique.length === 1 ? last : `${unique.slice(0, -1).join(', ')} and ${last}`;
  return `${base} Steps start at ${list} logins.`;
}

/** The not-drawn line: `{k} countries in the list below are not drawn on the map.` */
export function formatMapNotDrawn(k: number, locale?: string): string {
  return `${countriesLabel(k, locale)} in the list below ${k === 1 ? 'is' : 'are'} not drawn on the map.`;
}

// -----------------------------------------------------------------------------
// Formatters — city block
// -----------------------------------------------------------------------------

/** A megabyte is 1,000,000 bytes, because the sizes in 06-RESEARCH are decimal. */
const BYTES_PER_MB = 1_000_000;

/** Whole megabytes, minimum 1. A rounded-down 0 would be "about 0 MB". */
function wholeMegabytes(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 1;
  return Math.max(1, Math.round(bytes / BYTES_PER_MB));
}

/** One decimal of megabytes, with a trailing `.0` dropped, like the hour rule. */
function decimalMegabytes(bytes: number, locale?: string): string {
  const oneDecimal = (bytes / BYTES_PER_MB).toFixed(1);
  const value = oneDecimal.endsWith('.0') ? oneDecimal.slice(0, -2) : oneDecimal;
  return formatNumber(Number(value), locale);
}

/**
 * The idle intro, with the size: "about {N} MB", no tilde.
 *
 * The tilde is reserved for the button label, which is the control the reader
 * is about to press; the intro is prose, and prose that hedges a sentence
 * reads as uncertainty about a fact.
 */
export function formatCityIntro(bytes: number, locale?: string): string {
  return (
    'Add the city for each IP address. This downloads a database of about ' +
    `${formatNumber(wholeMegabytes(bytes), locale)} MB from this site when you press the button. ` +
    'Nothing is downloaded until then, and nothing from your export is sent with the request.'
  );
}

/** The Load button: `Load city-level detail (~{N} MB)`. */
export function formatCityLoadLabel(bytes: number, locale?: string): string {
  return `Load city-level detail (~${formatNumber(wholeMegabytes(bytes), locale)} MB)`;
}

/**
 * The downloading line: `Downloading city detail: {x} of {y} MB`.
 *
 * A `null` total is the unknown-length case (`Content-Length` is unreliable on
 * GitHub Pages, RESEARCH Pattern 7) and drops the sizes rather than showing a
 * zero, because "0 of 0 MB" beside a running download is a contradiction.
 */
export function formatCityProgress(
  received: number,
  total: number | null,
  locale?: string,
): string {
  if (total === null) return 'Downloading city detail...';
  return `Downloading city detail: ${decimalMegabytes(received, locale)} of ${decimalMegabytes(total, locale)} MB`;
}

/**
 * The ready line, naming the data month: `City detail loaded from DB-IP
 * ({YYYY-MM}). …`
 *
 * The month comes from the build-time manifest, and is checked rather than
 * trusted: a corrupt or hand-edited `manifest.json` must not become a DOM
 * string, so anything that is not `YYYY-MM` falls back to
 * {@link CITY_READY_NO_MONTH} rather than being printed. The month itself is
 * NOT derived from the export — a stale asset is a data-quality question the
 * build answers, not something the viewer needs to see guessed at.
 */
export function formatCityReady(month: string): string {
  const stamped = /^\d{4}-\d{2}$/.test(month)
    ? `City detail loaded from DB-IP (${month}). The City column is now in the table above.`
    : CITY_READY_NO_MONTH;
  return stamped;
}

/** The city list's truncation caption: `and {k} more cities not listed`. */
export function formatCityMoreCities(k: number, locale?: string): string {
  return `and ${formatNumber(k, locale)} more ${k === 1 ? 'city' : 'cities'} not listed`;
}

/** The city list's no-city caption: `{n} IP addresses have no city in the database.` */
export function formatCityNoCity(n: number, locale?: string): string {
  return `${ipAddressesLabel(n, locale)} ${n === 1 ? 'has' : 'have'} no city in the database.`;
}
