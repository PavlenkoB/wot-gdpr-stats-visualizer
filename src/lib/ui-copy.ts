import type { NavId, NavMutedReason, SectionStatus } from './dashboard-status.ts';
import type { IngestStage, ParsingProgress } from './types/worker-messages.ts';
// Type-only: the split-column keys label strings, and a runtime import would
// put a module in the bundle that this one only needs a union from.
import type { HourGridBasis, SplitColumn } from './playtime-shared.ts';
// A RUNTIME import, unlike the two above: `civilFromDays` and `weekdayOfDay`
// are the pure integer date arithmetic every calendar string is built from
// (04-01). They construct no `Date`, which is what keeps a cell's date the
// export's date rather than the viewer's — see formatCalendarDate.
import { civilFromDays, weekdayOfDay } from './civil-date.ts';

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

// =============================================================================
// Phase 4 — Playtime copy (04-02-PLAN Task 1)
// =============================================================================
//
// IP (Product): state the outcome, not the mechanism. Nothing below names a
// file, a query or a worker; the one string that names a file ("session file")
// does so as the reason the user can already see, not as an internal.
//
// Every literal is the approved 04-UI-SPEC.md wording. Each comment names the
// table and row it was copied from, and `tests/unit/ui-copy.test.ts` pins the
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
 * A count with `en-US` thousands separators.
 *
 * The locale is pinned rather than left to the viewer's: the UI-SPEC gives
 * `1,204 hours` and `1,203 sessions` as literal expected text (D-06), and a
 * viewer in a comma-grouping locale would otherwise see the spec's own example
 * render differently from the spec.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
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
 * `DURATION_BIN_LABELS[i]` names bin `i`. `tests/unit/ui-copy.test.ts` asserts
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
 */
export function formatDurationRowText(count: number, sessions: number): string {
  if (count === 0) return '0';
  const share = sessions > 0 ? (count / sessions) * 100 : 0;
  const percent = share < 0.5 ? '<1' : String(Math.round(share));
  return `${formatNumber(count)} · ${percent}%`;
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
