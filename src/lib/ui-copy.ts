import type { NavId, NavMutedReason, SectionStatus } from './shell/dashboard-status.ts';
// Type-only: selection-state.ts imports this module at runtime, so the pane id
// union must come across without a runtime cycle.
import type { PaneId } from './shell/selection-state.ts';
import type { IngestStage, ParsingProgress } from './core/types/worker-messages.ts';
// Type-only: the column labels are keyed by the Device info column ids.
import type { DeviceColumnIds, DeviceSourceId } from './features/device-info/device-info-shared.ts';
// Type-only: the split-column keys label strings, and a runtime import would
// put a module in the bundle that this one only needs a union from.
import type { HourGridBasis, SplitColumn } from './features/playtime/playtime-shared.ts';
// Type-only: the new-game pane ids the optional rows and their provenance
// labels are keyed by (11-05). `new-data-shared.ts` has no imports at all, so a
// type read across it is free of runtime cycles in either direction.
import type {
  HeatCardId,
  NewDataPaneId,
  PerksCardId,
  WowsCardId,
} from './features/new-data/new-data-shared.ts';
// Type-only: the kind labels are keyed by the timeline's own kind union. The
// contract module has no runtime import at all, so reading a type across it
// cannot create a cycle in either direction (12-05).
import type { TimelineKind } from './features/account-timeline/timeline-shared.ts';
// Type-only: the tile copy is keyed by the Overview's tile ids, its group
// headings by the group ids and its source wording by the need ids. The
// contract module has no runtime import at all (13-01), so a type read across
// it cannot create a cycle in either direction.
import type {
  OverviewGroupId,
  OverviewNeed,
  OverviewTileId,
} from './features/overview/overview-shared.ts';
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
  // quick 261012-bog: the folder the Device info pane reads, as the export
  // spells it. `Record<NavId, string>` is what forces this entry to exist.
  'device-info': 'Device_info',
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
export const SECTION_NOTE_USER_INFO =
  'Account details are shown under your nickname in the section list';

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
// Phase 9 — the multi-account identity header (09-04; D-13 … D-17)
// =============================================================================
//
// UI-SPEC Surface 1 ("Identity header, several accounts") and its Copywriting
// Contract. The header's zero-one-many rule is that ONE account renders exactly
// as v1.0 did and TWO or more render this list, so every string below belongs to
// the multi branch only and none of it is on the single-account path.
//
// The strings the Overview card and the Account list row use (Surface 3) are
// defined HERE on purpose even though plan 09-05 renders them: `ui-copy.ts` is
// the one file that owns user-visible wording, and one plan owning the file is
// cheaper than two plans sharing it.
// =============================================================================

/**
 * The multi-account list's accessible name (UI-SPEC Surface 1, item 3;
 * Copywriting Contract "List accessible name").
 *
 * The list's NAME, not a per-row name: `role="list"` is explicit because the
 * list-style reset drops list semantics in some engines, and a name says what
 * the reader is walking through. It is static, and deliberately NOT a nickname
 * (D-21, restated per row).
 */
export const IDENTITY_MULTI_LIST_LABEL = 'Accounts in this export';

/** The `dt` for an account row's games (UI-SPEC Surface 1, item 4). */
export const IDENTITY_GAMES_LABEL = 'Games';

/** The `dt` for an account row's activity years (UI-SPEC Surface 1, item 4). */
export const IDENTITY_ACTIVITY_LABEL = 'Activity';

/**
 * What an account with no usable session shows in the Activity slot (D-15).
 *
 * A sentence rather than a dash or an empty `<dd>`: "no activity recorded" is
 * a claim about the account's own history, and the value column carries all
 * state as text — no tint, dot or badge encodes it.
 */
export const IDENTITY_NO_ACTIVITY = 'No activity recorded';

/**
 * The Account list row's summary when the dataset holds two or more accounts
 * (UI-SPEC Surface 3, Copywriting Contract).
 *
 * Replaces the single-account "Location code and creation date", which would be
 * false here: neither the location code nor one account's creation date stands
 * for several. A per-row region and creation date are deliberately not shown
 * either (D-13).
 */
export const ACCOUNT_ROW_MULTI_SUMMARY = "Each account's ID, games and activity years";

/** The en dash that joins two years, written as an escape so it cannot be
 * silently replaced by a hyphen in a refactor. */
const EN_DASH = '–';

/**
 * `{N} account(s)` — the multi-account title, the Overview card title and the
 * Account list row headline (UI-SPEC Copywriting Contract).
 *
 * Singular for exactly one, plural for every other count, zero included. One is
 * reachable since plan 09-11: an archive of several folders in which only one
 * stores data keeps the multi variant and is titled "1 account"; zero is
 * reachable when none does. It is a branch inside this formatter, not a new
 * constant, and rendering is still gated on the folder count, never on this
 * function.
 */
export function formatAccountCount(count: number): string {
  return count === 1 ? '1 account' : `${count} accounts`;
}

/**
 * The "All {N} accounts combined" caption a pane shows when it merges every
 * account's rows (D-11, D-12; UI-SPEC Surface 2, Copywriting Contract).
 *
 * Distinct from {@link formatAccountCount} on purpose: one names the dataset
 * ("3 accounts"), the other names what a PANE is showing ("All 3 accounts
 * combined"). A pane that said only "3 accounts" would be indistinguishable
 * from the header above it. Phase 10 prefixes "All" because the panes now
 * really do merge every account (Phase 9 only announced the intent), and the
 * word is what tells a reader no account was left out of the figures below.
 */
export function formatCombinedCaption(count: number): string {
  return `All ${count} accounts combined`;
}

/**
 * An account's activity years: `{first}`, or `{first}–{last}` (D-15).
 *
 * A null `last` falls back to the first, so a dataset that recorded a start but
 * no end still shows one year rather than a dangling dash. Only the first and
 * last year ever reach here, which is what keeps the value a short fixed string
 * however long the account's history is.
 */
export function formatActivityYears(first: number, last: number | null): string {
  if (last === null || last === first) return String(first);
  return `${first}${EN_DASH}${last}`;
}

/**
 * The six game tokens of the identity list, by their LONG display names
 * (UI-SPEC Copywriting Contract; D-14).
 *
 * A separate table from `GAME_NAMES` on purpose: the existing panes read the
 * short labels ("WoT", "Warships") in a column headed "Game", where the long
 * names would wrap, and only the identity list has the width for them. WOWP is
 * here although D-14 lists five names, so a Warplanes session shows a name
 * rather than a raw token; that is the UI-SPEC's recorded choice.
 */
const GAME_LONG_NAMES: Record<string, string> = {
  WOT: 'World of Tanks',
  WOTB: 'WoT Blitz',
  WOWS: 'World of Warships',
  WOTC: 'WoT Console',
  HEAT: 'World of Tanks HEAT',
  WOWP: 'World of Warplanes',
};

/** The fixed order the identity list shows game names in (D-14). */
const GAME_LONG_ORDER: readonly string[] = ['WOT', 'WOTB', 'WOWS', 'WOTC', 'HEAT', 'WOWP'];

/**
 * One game token as its LONG name, or the token unchanged if unknown.
 *
 * Same no-error-path rule as `formatGameName` (T-06-05): the token arrives from
 * an archive FILE NAME inside an untrusted zip, and it is already bounded to
 * letters, digits and underscores by the session file-name rule before it gets
 * here, so returning it unchanged is the whole of the mitigation.
 */
export function formatGameLongName(token: string): string {
  return GAME_LONG_NAMES[token] ?? token;
}

/**
 * One account's games as a single string, for the identity row's Games slot.
 *
 * De-duplicated, in the FIXED order WOT, WOTB, WOWS, WOTC, HEAT, WOWP, then any
 * unknown token in code-unit order, joined with ", " — the same shape as
 * `formatGames` and for the same two reasons: a re-sorted list must not shuffle
 * text that did not change, and `localeCompare` would make the order depend on
 * the VIEWER's locale.
 *
 * An empty list gives `''`, and the CALLER omits the whole Games row rather
 * than rendering an empty `<dd>` (UI-SPEC, empty/identity header/Games row).
 */
export function formatAccountGames(tokens: readonly string[]): string {
  const known = GAME_LONG_ORDER.filter((token) => tokens.includes(token));
  const unknown = [...new Set(tokens.filter((token) => !GAME_LONG_ORDER.includes(token)))].sort();
  return [...known, ...unknown].map(formatGameLongName).join(', ');
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
 * The empty-game body line (Phase 10, D-03; UI-SPEC Copywriting, "Playtime
 * empty game, body").
 *
 * One sentence pair and no heading: the export HAS sessions — the chips above it
 * are still there and one of them is All games — so this is not "no data", it
 * is "not this game", and the sentence names the game rather than describing an
 * absence. It ends with the way out rather than only the fact, because the state
 * is reachable by a single chip click away and the reader should not have to
 * work out which control does it.
 *
 * The token goes through `formatGameName`, exactly like every other place a
 * game reaches the screen (T-06-05).
 */
export function formatNoGameSessions(token: string): string {
  return `No ${formatGameName(token)} sessions in this export. Choose All games to see all of your playtime.`;
}

/**
 * The "About this summary" disclosure's explanation of how merged playtime is
 * counted (Phase 10, D-06; UI-SPEC Copywriting, amended by D-07 as amended).
 *
 * The wording is load-bearing and was corrected at plan-phase: the sentence the
 * UI-SPEC first drafted claimed "hours, sessions and active days all come from
 * those stretches", which is FALSE. Sessions are usable CSV rows and active days
 * are the distinct start days; only HOURS take the union of intervals. The
 * sentence below therefore states each rule on its own, which is also why a
 * reader who checks the two tiles against the three charts finds them
 * consistent.
 *
 * The last clause exists because the tile can genuinely read smaller than the
 * games added together — each game's scope merges overlap among its own
 * sessions only, so an overlap that spans two games is counted in both. Saying
 * so is the difference between a bug report and an understood number.
 */
export const PLAYTIME_MERGE_ABOUT =
  'Playtime is counted once. When sessions overlap, whether on different accounts or in different games, ' +
  'the overlap counts as a single stretch of play, so hours are the time covered by at least one session. ' +
  'Sessions and active days are counted from the sessions recorded. ' +
  "A game's hours are worked out from that game alone, so All games can show fewer hours than the games added together.";

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

/**
 * The Vehicles search hint when the dataset holds two or more accounts (D-11).
 *
 * A capability the reader cannot otherwise discover: the box is labelled
 * "Search vehicles", and a tag letter or an account ID matching is not
 * something one would try unprompted. It is linked to the input with
 * `aria-describedby`, so a screen reader reads it with the field rather than as
 * an unrelated paragraph below it.
 *
 * Absent entirely for one account, with no node and no `describedby` — a hint
 * about a capability that does not exist would be a lie about the search.
 */
export const VEHICLE_SEARCH_ACCOUNT_HINT = 'Also matches account letters and account IDs.';

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

/**
 * The note Vehicles shows when the shared filter names a game with no vehicle
 * table (11-06, D-06): `HEAT has no vehicle table. Showing WoT instead.`
 *
 * ## Why this is not an empty state and not an error
 *
 * The reader chose a game with sessions in it, and there is a perfectly good
 * table on screen. Both facts belong in one sentence, so the note names the
 * game that has no table AND the table being shown instead — a reader who sees
 * only "no vehicle table" would think the export lost something.
 *
 * Neither argument is the export's own text: `gameLabel` is a display name
 * from this module and `titleLabel` a {@link VEHICLE_TITLE_LABELS} entry, and
 * the function only concatenates them (T-05-35's rule).
 */
export function formatNoVehicleTable(gameLabel: string, titleLabel: string): string {
  return `${gameLabel} has no vehicle table. Showing ${titleLabel} instead.`;
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

/**
 * The Payments per-account disclosure's summary, and the heading of the split it
 * holds (Phase 10, D-14, D-10; UI-SPEC Surface 6).
 *
 * A DISCLOSURE rather than a table on the card, which is D-14's rule in one
 * word: the combined figure is the headline, and the per-account division lives
 * in detail only so the pane never grows a second set of headline numbers that
 * a reader could mistake for the total. The same string is the summary and the
 * visually-hidden table caption, so the name a screen reader hears and the name a
 * reader clicks are one string and cannot drift.
 */
export const SPEND_PER_ACCOUNT_SUMMARY = 'Per account';

/**
 * The one line under the Finance and Payments panes when several accounts are
 * combined (Phase 10, D-14; UI-SPEC Surface 6).
 *
 * It is said ONCE per pane, as a body line, rather than repeated on every card:
 * the rule is the same for every currency, and a note on each card would read
 * like a warning about that card. "Never converted" is the half that matters —
 * a reader seeing a combined figure must not wonder whether two currencies were
 * blended into it.
 */
export const FINANCE_COMBINED_NOTE =
  'Amounts in the same currency are added across all accounts. Currencies are never converted.';

/** The per-account split's first column: the account tag chip and its phrase. */
export const HEADER_ACCOUNT = 'Account';

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

/**
 * The known game tokens, by their SHORT display name.
 *
 * "Short" is the constraint, not a preference: the panes read this table in a
 * column headed `Game`, where `World of Tanks HEAT` would wrap. The identity
 * list is the one place with the width, and it reads `GAME_LONG_NAMES` instead.
 *
 * `WOTC` and `HEAT` arrived in 11-01, when their session files became readable
 * (D-05). Before that the Logins Games cell printed the raw token `WOTC` for a
 * game it otherwise named everywhere else; there is now one name table and the
 * cell joins it like every other.
 */
const GAME_NAMES: Record<string, string> = {
  WOT: 'WoT',
  WOTB: 'WoT Blitz',
  WOWS: 'Warships',
  WOTC: 'WoT Console',
  HEAT: 'HEAT',
  WOWP: 'Warplanes',
};

/**
 * The fixed display order, matching the identity header's `GAME_LONG_ORDER`.
 *
 * ONE order for the app rather than one per surface: the Games cell, the chip
 * row and the identity list now walk the same sequence, so the same export
 * never names its games in two different orders (D-05, 11-01). Warplanes stays
 * LAST: the order is a display contract, not a sort, so a new entry is placed
 * deliberately rather than appended by alphabet.
 */
const GAME_ORDER: readonly string[] = ['WOT', 'WOTB', 'WOWS', 'WOTC', 'HEAT', 'WOWP'];

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
// -----------------------------------------------------------------------------
// Phase 10 — the shared game filter's words
// -----------------------------------------------------------------------------

/**
 * The filter chip row's visible label, and the accessible name of its
 * radiogroup (D-01).
 *
 * One string for both is the point: a group named by text that is not on screen
 * is a name the sighted reader cannot check, and the label role above the chips
 * is a line the block would otherwise not have.
 */
export const GAME_FILTER_LABEL = 'Filter by game';

/**
 * The chip that answers no narrowing (D-01).
 *
 * Not "All": that word already names the split selector's unfiltered view
 * (`SPLIT_ALL_OPTION`) one row below, and two controls two rows apart both
 * reading "All" invite the reader to apply them as one setting.
 */
export const GAME_FILTER_ALL = 'All games';

// -----------------------------------------------------------------------------
// Phase 10 — the account tag's words (D-10, D-19)
// -----------------------------------------------------------------------------
//
// The tag chip is one inert letter, and everything it means for a screen reader
// lives in this text. Both functions return STRINGS: the callers interpolate
// them as text content, and neither this module nor any caller puts the result
// in an attribute, a title, a tooltip or a describedby (D-19, T-10-08).

/**
 * The account tag's accessible phrase in a DATA ROW (D-10, D-19):
 * `Account B, ID 500000001, nickname Synthetic EU Captain`.
 *
 * The `nickname` clause is present only for a non-blank nickname, so an account
 * with no `User_Info` row — or one whose `NAME` column is blank — still names
 * itself by its letter and its ID rather than reading "nickname" and then
 * nothing. The half-blank case is what makes the test matrix three rows rather
 * than two.
 *
 * Both the ID and the nickname are UNTRUSTED zip text and this function only
 * concatenates them: escaping is Svelte's job at the interpolation, which it
 * does for every string in this app.
 */
export function formatAccountTagLabel(letter: string, id: string, nickname: string | null): string {
  const base = `Account ${letter}, ID ${id}`;
  return nickname === null || nickname.trim() === '' ? base : `${base}, nickname ${nickname}`;
}

/**
 * The account tag's phrase in the IDENTITY HEADER legend (D-10):
 * `Account A`, and nothing else.
 *
 * Deliberately shorter than {@link formatAccountTagLabel}: the header row
 * already SHOWS the nickname and the account ID as visible text beside the chip,
 * so repeating them in hidden text would announce the same account three times
 * and break D-21's "once in its own row" rule that `expectNoLeak` counts.
 */
export function formatAccountLegendLabel(letter: string): string {
  return `Account ${letter}`;
}

/**
 * The overflow count beside a row's account chips (D-18): `+2`.
 *
 * Plain text and deliberately NOT a chip: the cells beside it are the tags, and
 * a third chip-shaped thing reading `+2` would be read as an account named `+2`.
 *
 * The accounts it counts are still named to a screen reader through their own
 * hidden phrases, so this is a visual convenience rather than the only record of
 * them (T-10-15).
 */
export function formatAccountOverflow(count: number): string {
  return `+${count}`;
}

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

// =============================================================================
// Phase 8 - master-detail shell copy (08-01-PLAN Task 1)
// =============================================================================
//
// The pane titles and the list-row strings. Every row string comes from here so
// a list row, an Overview card and a detail header cannot word the same fact
// two ways. The wording is the 08-UI-SPEC Copywriting Contract; each constant is
// pinned by `tests/unit/shell/ui-copy.test.ts`.
// =============================================================================

/**
 * The visible title of each pane, in the list and as the detail heading.
 *
 * Prose titles rather than folder names: the folder a pane reads from is shown
 * in its provenance line instead (`formatProvenanceFrom`). `Record<PaneId,
 * string>` so a pane without a title is a type error, not a blank row.
 */
export const PANE_TITLES: Record<PaneId, string> = {
  overview: 'Overview',
  playtime: 'Playtime',
  'login-history': 'Login history',
  vehicles: 'Vehicles',
  finance: 'Finance',
  payments: 'Payments',
  'device-info': 'Device info',
  account: 'Account',
  'not-yet-supported': 'Not yet supported',
  // The two OPTIONAL panes of 11-05 (D-01, D-03) and the Perks pane of 12-02.
  // They are titled here whether or not the export holds them: the title is a
  // constant, and which rows are RENDERED is `paneEntries`' decision, not this
  // table's.
  heat: 'HEAT',
  'warships-storage': 'Warships crews & storage',
  perks: 'Perks',
  'account-timeline': 'Account timeline',
};

/** The headline of a row that has nothing to count: an em dash. */
export const ROW_HEADLINE_NONE = '—';

/** The Overview row's summary line when an export is loaded. */
export const OVERVIEW_ROW_SUMMARY = 'What your export contains';

/** The Account row's summary line. The headline beside it is the location code. */
export const ACCOUNT_ROW_SUMMARY = 'Location code and creation date';

/**
 * A data row's summary: `{folder} · {n file(s)}`, with a middle dot.
 *
 * `folder` is the canonical `SECTIONS` constant, never a zip-entry name, so an
 * untrusted entry name cannot reach a row (T-08-01).
 */
export function formatRowSummary(folder: string, fileCount: number): string {
  return `${folder} · ${formatFileCount(fileCount)}`;
}

/** The Not-yet-supported row's headline: `1 folder` / `N folders`. */
export function formatFolderCount(n: number): string {
  return n === 1 ? '1 folder' : `${formatNumber(n)} folders`;
}

// =============================================================================
// Phase 11 — the optional new-game panes (11-05-PLAN Task 1), extended by
// phase 12 with the Perks row (12-02)
// =============================================================================
//
// D-01 gives HEAT its own list row and D-03 gives the Warships crews and
// storage files theirs, each shown only when the export holds that data
// (UI-SPEC Surface 2, assumption A2). These are the strings those rows, their
// Overview cards and their pane headers read.
//
// Two properties hold across every line below:
//
//   1. **No zip-derived string.** A label here is a constant or a canonical
//      file label, and the only interpolation is a count. A file's own name
//      reaches a reader only through the canonical label table plan 11-08
//      builds, never through `formatNewDataSkipped`'s argument in any real call
//      (T-11-16, the same rule as `formatRowSummary`).
//   2. **The counts are the pane's two integers**, already summed by the worker
//      over every account (`NewDataPaneFacts`). Nothing here re-derives them.
// =============================================================================

/**
 * The HEAT list row's summary: `Battle types, stats, storage · {n files}`.
 *
 * The three words are the record types the pane's four files hold, not the
 * files themselves, so the row says what the reader will find rather than what
 * the export happened to name. The count goes through {@link formatFileCount},
 * so "1 file" never reads "1 files".
 */
export function formatHeatRowSummary(fileCount: number): string {
  return `Battle types, stats, storage · ${formatFileCount(fileCount)}`;
}

/**
 * The Warships crews & storage row's summary: `Crews and account storage ·
 * {n files}` (D-03).
 */
export function formatWowsStorageRowSummary(fileCount: number): string {
  return `Crews and account storage · ${formatFileCount(fileCount)}`;
}

/**
 * The Perks row's summary: `Subscriptions, coupons, codes, surveys · {n
 * files}` (12-02, 12-UI-SPEC Surface 1).
 *
 * The four words are the four CARDS the pane stacks, not the files themselves,
 * so the row says what the reader will find rather than what the export
 * happened to name. The count goes through {@link formatFileCount}, so "1 file"
 * never reads "1 files".
 */
export function formatPerksRowSummary(fileCount: number): string {
  return `Subscriptions, coupons, codes, surveys · ${formatFileCount(fileCount)}`;
}

/**
 * The Account timeline row's summary: `Names, services, bans, third parties ·
 * {n files}` (12-11, 12-UI-SPEC Surface 1).
 *
 * The four words are the wording UI-SPEC fixes for the row (language and
 * country entries are in the pane, the row's brevity does not name them), not
 * the files themselves. The count goes through {@link formatFileCount}, so
 * "1 file" never reads "1 files".
 */
export function formatTimelineRowSummary(fileCount: number): string {
  return `Names, services, bans, third parties · ${formatFileCount(fileCount)}`;
}

/**
 * What each optional pane's provenance line names, for
 * {@link formatProvenanceFrom}: `From HEAT data ·` and `From Warships crews and
 * storage files ·`.
 *
 * Prose rather than folder names because neither pane reads ONE folder: a HEAT
 * pane is built from files spread across the export, so there is no canonical
 * folder to show (UI-SPEC assumption A3).
 */
export const NEW_DATA_PROVENANCE_LABELS: Record<NewDataPaneId, string> = {
  heat: 'HEAT data',
  'warships-storage': 'Warships crews and storage files',
  // 12-02. The Perks pane's files live in four folders, so there is no single
  // folder to name; the line reads "From perks files · N files, N rows".
  perks: 'perks files',
  // 12-11. The timeline's files live in three folders, so there is no single
  // folder to name; the line reads "From account history files · N files, N rows".
  'account-timeline': 'account history files',
};

/**
 * The sentence a card shows for a file that is in the export but whose columns
 * this viewer reads none of (D-09): `{file} is in this export, but none of its
 * columns are ones this viewer reads, so it was skipped.`
 *
 * It NAMES the file, and it says the file was skipped rather than that the data
 * is missing: the distinction is the whole point of D-09, because a drifted
 * column set looks exactly like an absent one from the outside.
 *
 * `file` is the canonical label from plan 11-08's label table in every real
 * call; the function concatenates and returns, so an untrusted zip entry name
 * can only ever reach the screen as escaped text (T-11-16).
 */
export function formatNewDataSkipped(file: string): string {
  return `${file} is in this export, but none of its columns are ones this viewer reads, so it was skipped.`;
}

// =============================================================================
// Phase 8 - list chrome and phone bar copy (08-01-PLAN Task 2)
// =============================================================================
//
// What remains of the Phase 8 Overview block after plan 13-13 retired the chips,
// the intro and the per-section cards: the open-section link (the insight tile's
// Open link), and the small strings the shell chrome carries. Copied exactly
// from the 08-UI-SPEC Copywriting Contract and the sketch layout notes.
// =============================================================================

/** An Overview tile's link: `Open Playtime →`, with the arrow character. */
export function formatOpenSectionLink(title: string): string {
  return `Open ${title} →`;
}

/** The phone detail screen's back button. */
export const BACK_TO_SECTIONS_LABEL = '‹ Sections';

/** The hint shown while the list pane has focus. */
export const LIST_KEYBOARD_HINT = 'Move with j and k';

/** The skip link that jumps past the list to the detail pane. */
export const SKIP_TO_DETAIL_LABEL = 'Skip to section detail';

/** The line under the large empty-state drop target. */
export const EMPTY_STATE_PRIVACY = 'Your data stays in this tab.';

/**
 * The start of a detail pane's provenance line: `From {folder} ·`, with a
 * trailing middle dot so the counts line can follow it on the same row.
 * `folder` is the canonical `SECTIONS` constant, never a zip-entry name.
 */
export function formatProvenanceFrom(folder: string): string {
  return `From ${folder} ·`;
}

// =============================================================================
// Phase 13 - the Overview personal-insights page (13-01-PLAN Task 2)
// =============================================================================
//
// Everything below is the new page's copy. The rule it follows is D-17: every
// headline figure shows the rule behind it, and the rule says what was counted
// rather than how pretty the number is.
/** The sentence shown while the one answer is being computed. */
export const OVERVIEW_LOADING = 'Computing on this device.';

/**
 * The Overview's failure sentence.
 *
 * Its own wording, NOT `GENERIC_FAILURE_MESSAGE`: that sentence claims the
 * file is not a Wargaming export, which is false here — the export loaded, and
 * the failure is in working the Overview out of it. This one says exactly
 * that, and tells the reader their data is still loaded.
 */
export const OVERVIEW_ERROR =
  'The overview could not be worked out from this export. Your data is still loaded. Open another section and come back to try again.';
/**
 * One tile's copy: its label, its unit, how it is computed, what it reads and
 * the file it reads it from.
 *
 * `unit` is null for a tile whose value has no unit (a name, a percentage in
 * its own text), and `reads` names the SOURCE in friendly words rather than a
 * file name — `file` is the file name itself, shown in Caption role under the
 * "Reads" heading.
 */
export interface OverviewTileCopy {
  /** The tile's visible label. */
  label: string;
  /** The unit the value is shown in, or null when it has none. */
  unit: string | null;
  /** The "How it is computed" text the expanded tile carries. */
  how: string;
  /** The source the tile reads, in friendly words. */
  reads: string;
  /** The export file the tile reads, as the export spells it. */
  file: string;
}

/**
 * The copy for EVERY tile, in a COMPLETE record.
 *
 * The record is complete on purpose: a tile without copy is a tile the page
 * cannot draw, and a `Partial` would let that happen silently. With the
 * compiler holding all sixteen entries, adding a tile to the catalogue
 * without writing its copy is a build error, not a blank tile.
 */
export const OVERVIEW_TILE_COPY: Readonly<Record<OverviewTileId, OverviewTileCopy>> = {
  logged: {
    label: 'Logged in',
    unit: 'days',
    how: 'Union of session intervals across all games and all account folders, so overlapping sessions count once. Counted in 24-hour days. "In battle" is the separate lifetime battle-time figure, not logged-in time.',
    reads: 'session history',
    file: '*_Game_Sessions.csv',
  },
  hour: {
    label: 'Signature hour',
    unit: null,
    how: 'Logged hours summed per hour of day across the WoT sessions, wall clock as recorded.',
    reads: 'session history',
    file: 'WOT_Game_Sessions.csv',
  },
  streak: {
    label: 'Longest streak',
    unit: 'days',
    how: 'Most consecutive calendar days with at least one WoT session.',
    reads: 'session history',
    file: 'WOT_Game_Sessions.csv',
  },
  sess: {
    label: 'Longest session',
    unit: 'h',
    how: 'Longest single WoT session, login to logout. Disconnects or idle time can inflate it.',
    reads: 'session history',
    file: 'WOT_Game_Sessions.csv',
  },
  busy: {
    label: 'Busiest day',
    unit: 'h',
    how: 'Most logged WoT hours on one calendar day, by session start.',
    reads: 'session history',
    file: 'WOT_Game_Sessions.csv',
  },
  tank: {
    label: 'Most-played tank',
    unit: null,
    how: 'Battles per tank from the vehicle statistics, summed across account folders. Tank names come from the built-in tank table.',
    reads: 'vehicle statistics',
    file: 'WOT_Vehicle_Statistics.csv',
  },
  cls: {
    label: 'Favourite class',
    unit: null,
    how: 'Battles grouped by class via the built-in tank table. Tanks missing from the table are counted as unknown and not guessed; the rule line states the class coverage.',
    reads: 'vehicle statistics',
    file: 'WOT_Vehicle_Statistics.csv',
  },
  fleet: {
    label: 'Tanks played',
    unit: null,
    how: 'Tanks with a row in the vehicle statistics, across account folders.',
    reads: 'vehicle statistics',
    file: 'WOT_Vehicle_Statistics.csv',
  },
  nat: {
    label: 'Favourite nation',
    unit: null,
    how: 'Nation from the vehicle id prefix, summed across account folders.',
    reads: 'vehicle statistics',
    file: 'WOT_Vehicle_Statistics.csv',
  },
  dmg: {
    label: 'Most damage, one battle',
    unit: null,
    how: 'Best single-battle value across account folders. The tank named is from the account that holds the maximum.',
    reads: 'account statistics',
    file: 'WOT_Account_Statistics.csv',
  },
  xp: {
    label: 'Most XP, one battle',
    unit: null,
    how: 'Best single-battle value across account folders. The tank named is from the account that holds the maximum.',
    reads: 'account statistics',
    file: 'WOT_Account_Statistics.csv',
  },
  kills: {
    label: 'Most kills, one battle',
    unit: null,
    how: 'Best single-battle value across account folders. The tank named is from the account that holds the maximum.',
    reads: 'account statistics',
    file: 'WOT_Account_Statistics.csv',
  },
  snip: {
    label: 'Sniper series',
    unit: null,
    how: 'Longest run recorded in the account statistics. Series definitions differ by mode, so this is not a medal.',
    reads: 'account statistics',
    file: 'WOT_Account_Statistics.csv',
  },
  cred: {
    label: 'Credits earned',
    unit: null,
    how: 'Deposits plus income in the currency operations log, as the Finance pane defines it.',
    reads: 'currency operations',
    file: 'Virtual_Currencies_Operations.csv',
  },
  bat: {
    label: 'Battles',
    unit: null,
    how: 'Lifetime battles and wins from the account statistics, summed across account folders. Win rate depends on teammates.',
    reads: 'account statistics',
    file: 'WOT_Account_Statistics.csv',
  },
  ord: {
    label: 'Orders',
    unit: null,
    how: 'Number of payment orders. No amount, product or order detail is shown.',
    reads: 'payment history',
    file: 'Orders.csv',
  },
};

/**
 * The rule line under the Logged in figure.
 *
 * `{hours} h across all games (24-hour days) since {firstDate}.`
 *
 * The word "across all games" is load-bearing (D-20): the figure is the union
 * of every game's sessions, so a copy that said "in WoT" would be a claim the
 * number does not support. The "In battle" sentence appears ONLY when there is
 * a battle-time figure — it is a separate, lifetime number, and a page that
 * printed "0 days in battle" would be stating an absence as a zero.
 */
export function formatLoggedRule(
  hours: string,
  firstDate: string,
  battleDays: string | null,
): string {
  const base = `${hours} h across all games (24-hour days) since ${firstDate}.`;
  if (battleDays === null) return base;
  return `${base} In battle: ${battleDays} days.`;
}

// -----------------------------------------------------------------------------
// The Overview's group headings, source wording and rule lines (13-06)
//
// D-17 is the rule this whole block exists for: EVERY headline figure shows
// the rule behind it, and the rule says what was COUNTED rather than how
// pretty the number is. The formatters below take ALREADY-FORMATTED strings
// and return a sentence — the page formats the numbers and the dates, this
// module only words them, so a formatter can never disagree with the locale
// the rest of the app uses.
//
// Two measurements are BANNED by D-17 and appear nowhere in this block: no
// WN8, no mastery, no marks of excellence, and no mode mix. The battle-type
// table covers about 5% of the battles in a real export, so a mode mix would
// be a claim the data cannot support.
// -----------------------------------------------------------------------------

/**
 * The heading text of each group of the bento.
 *
 * `pinned` is the derived group of the user's pinned tiles; the other four
 * are the catalogue's groups. The fifth group is "Totals" (D-12).
 */
export const OVERVIEW_GROUP_HEADINGS: Readonly<Record<'pinned' | OverviewGroupId, string>> = {
  pinned: 'Pinned',
  time: 'Time',
  tanks: 'Tanks',
  records: 'Records',
  totals: 'Totals',
};

/**
 * What each source is called in the absent row and under "Reads".
 *
 * The wording is friendly rather than a file name: the absent row says
 * "needs session history", not "needs WOT_Game_Sessions.csv".
 */
export const OVERVIEW_NEED_TEXT: Readonly<Record<OverviewNeed, string>> = {
  'session-history': 'session history',
  'vehicle-statistics': 'vehicle statistics',
  'account-statistics': 'account statistics',
  'currency-operations': 'currency operations',
  'payment-history': 'payment history',
};

/** The heading of the expanded tile's "How it is computed" block. */
export const OVERVIEW_HOW_HEADING = 'How it is computed';

/** The heading of the expanded tile's "Reads" block. */
export const OVERVIEW_READS_HEADING = 'Reads';

/** The word under the low end of a group's heat-scale legend. */
export const OVERVIEW_LEGEND_LOW = 'low';

/** The word under the high end of a group's heat-scale legend. */
export const OVERVIEW_LEGEND_PEAK = 'peak';

/**
 * What a record whose tank id is not recorded says.
 *
 * D-09: the viewer never guesses a tank name, so a record without a
 * resolvable tank says so.
 */
export const OVERVIEW_VEHICLE_NOT_RECORDED = 'vehicle not recorded';

/**
 * What a rate says when the sample is too small for it (D-17).
 *
 * Counts and totals are never guarded; only RATES are, and this sentence is
 * what a guarded rate says instead of a number.
 */
export const OVERVIEW_TOO_FEW_BATTLES = 'Too few battles for a rate.';

/** The rule line of the Signature hour tile. */
export const OVERVIEW_HOUR_RULE = 'Logged hours by hour of day, wall clock as recorded.';

/**
 * The rule line of the Longest streak tile.
 *
 * The words "WoT sessions" are load-bearing (D-20): the habit tiles count
 * World of Tanks sessions only, while the Logged in figure counts every
 * game. A rule that said "sessions" would leave the reader guessing which.
 */
export function formatStreakRule(start: string, end: string): string {
  return `${start} to ${end}, WoT sessions.`;
}

/** The rule line of the Longest session tile. */
export function formatSessRule(date: string): string {
  return `${date}, WoT sessions. One login to logout.`;
}

/** The rule line of the Busiest day tile. */
export function formatBusyRule(date: string): string {
  return `${date}, WoT sessions.`;
}

/** The rule line of the Most-played tank tile. */
export function formatTankRule(battles: string, share: string): string {
  return `${battles} battles, ${share} of all battles.`;
}

/**
 * The rule line of the Favourite class tile.
 *
 * The coverage sentence is the honest half: a tank missing from the built-in
 * table is counted as unknown and NOT guessed (D-09), so the tile states how
 * much of the data it could classify.
 */
export function formatClsRule(share: string, coverage: string): string {
  return `${share} of battles. Class known for ${coverage} of battles.`;
}

// The hidden chart summaries and the credits magnitude words (13-09, IN-02).
//
// These used to be written inside the formatter, outside this module, so the
// copy tests could not read them and a copy change would have missed them.
// Every formatter takes ALREADY-FORMATTED numbers: the page formats, this
// module only words.

/** The word after a credits figure in the millions, with its leading space. */
export const OVERVIEW_CREDITS_MILLION = ' million';

/** The word after a credits figure in the billions, with its leading space. */
export const OVERVIEW_CREDITS_BILLION = ' billion';

/** The label of the peak year's bar: hours and the year, as `1,234.5 h · 2019`. */
export function formatYearPeakLabel(hours: string, year: number): string {
  return `${hours} h · ${year}`;
}

/** The hidden summary of the hours-per-year chart. */
export function formatYearsChartSummary(
  yearCount: number,
  peakYear: number,
  hours: string,
): string {
  const years = yearCount === 1 ? '1 year' : `${yearCount} years`;
  return `Chart: hours logged per year, ${years}, peak ${peakYear} with ${hours} hours.`;
}

/** The hidden summary of the hour-of-day chart. */
export function formatHourChartSummary(peakHour: string): string {
  return `Chart: hours logged by hour of day, peak at ${peakHour}.`;
}

/** The hidden summary of the top-tanks list, `listing` being the joined rows. */
export function formatTanksChartSummary(count: number, listing: string): string {
  return `Top ${count} tanks by battles: ${listing}.`;
}

/** The hidden summary of the battles-by-class list. */
export function formatClassesChartSummary(listing: string): string {
  return `Battles by class: ${listing}.`;
}

/** The rule line of the Tanks played tile. */
export const OVERVIEW_FLEET_RULE = 'Different tanks with battles.';

/** The rule line of the Favourite nation tile. */
export function formatNatRule(share: string): string {
  return `${share} of battles.`;
}

/**
 * The rule line of a record tile (most damage, most XP, most kills).
 *
 * Records are the MAXIMUM across account folders, and the tank named is the
 * one from the account holding that maximum (D-19). `accounts` is the number of
 * accounts that had a figure to compare, not the number of account folders
 * (WR-04). The "best of N accounts" clause appears only when more than one
 * account was compared, because with one it would say nothing.
 */
export function formatRecordRule(tankName: string | null, accounts: number): string {
  const name = tankName ?? OVERVIEW_VEHICLE_NOT_RECORDED;
  if (accounts > 1) return `${name}, best of ${accounts} accounts.`;
  return `${name}.`;
}

/** The rule line of the Sniper series tile. */
export const OVERVIEW_SNIP_RULE = 'Longest run recorded.';

/**
 * The rule line of the Credits earned tile.
 *
 * "Deposits plus income" is the Finance pane's own definition (D-21), so the
 * two panes can never disagree about the same figure.
 */
export const OVERVIEW_CRED_RULE = 'Deposits plus income, as in Finance. Exact figure in Finance.';

/**
 * The rule line of the Battles tile.
 *
 * A win rate is a RATE, so it is guarded: below the plain-rate threshold the
 * line says the sample is too small instead of showing a number (D-17).
 */
export function formatBatRule(winRate: string | null): string {
  if (winRate === null) return OVERVIEW_TOO_FEW_BATTLES;
  return `${winRate} wins.`;
}

/**
 * The rule line of the Orders tile.
 *
 * Count only. An amount is a sensitive value and is never shown here
 * (D-18); the Finance pane holds the figures.
 */
export const OVERVIEW_ORD_RULE = 'Count only. Amounts are never shown here.';

/**
 * The star button's accessible label: `Pin {name}`.
 *
 * FIXED, never "Unpin": a label that changes with the state reads as
 * "Unpin X, pressed", which announces the action twice. The state is carried
 * by `aria-pressed` instead.
 */
export function formatStarLabel(name: string): string {
  return `Pin ${name}`;
}

/**
 * What the live region says after a tile is pinned.
 *
 * It carries the tile's NAME and the count of pinned tiles and nothing else:
 * no figure, no date, no account detail (D-18).
 */
export function formatPinnedAnnouncement(name: string, count: number): string {
  return `Pinned ${name}, ${count} pinned.`;
}

/**
 * What the live region says after a tile is unpinned.
 *
 * The same shape as the pin announcement, for the same reason.
 */
export function formatUnpinnedAnnouncement(name: string, count: number): string {
  return `Unpinned ${name}, ${count} pinned.`;
}

// -----------------------------------------------------------------------------
// Phase 13 - the composed page (13-12): provenance, hint, life list, absent
// rows and the attribution footer
// -----------------------------------------------------------------------------

/** The hint line under the provenance line. */
export const OVERVIEW_HINT =
  'Click a tile to see how it is computed. Star a tile to pin it to the top. Arrow keys move between tiles, P pins the focused tile, Esc closes.';

/** The label of the read-only Wargaming life list. */
export const OVERVIEW_LIFE_LABEL = 'Wargaming life';

/** What a game with no sessions in the export says in the life list. */
export const OVERVIEW_LIFE_NO_SESSIONS = 'no sessions in this export';

/** One game's logged days: `{days} days`. `days` is already formatted. */
export function formatLifeDays(days: string): string {
  return `${days} days`;
}

/**
 * A game with sessions, but under a tenth of a day of them: one decimal would
 * print "0.0 days", which states an absence the data does not hold.
 */
export const OVERVIEW_LIFE_UNDER_TENTH = 'under 0.1 days';

/** The line shown when no tile of the page has data. */
export const OVERVIEW_EMPTY =
  'None of these tiles has data in this export. Each group says what it needs.';

/** The start of a group's dashed absent row. */
export const OVERVIEW_ABSENT_PREFIX = 'Not in this export:';

/**
 * The rest of a group's dashed absent row, after the prefix.
 *
 * A leading space so the prefix span and this text read as one sentence:
 * ` Favourite class, Tanks played · needs vehicle statistics`.
 */
export function formatAbsentRest(labels: readonly string[], needs: readonly string[]): string {
  return ` ${labels.join(', ')} · needs ${needs.join(', ')}`;
}

/**
 * The provenance line: where the numbers were computed, from what, and when.
 *
 * `range` is null when the export has no session history to name a period.
 */
export function formatProvenance(accounts: number, games: string, range: string | null): string {
  const folders = accounts === 1 ? 'account folder' : 'account folders';
  const head = `Computed on this device from ${formatNumber(accounts)} ${folders}`;
  const withGames = games === '' ? head : `${head} · ${games}`;
  return range === null ? withGames : `${withGames} · ${range}`;
}

/** The period in the provenance line: `{first} to {last}`. */
export function formatProvenanceRange(first: string, last: string): string {
  return `${first} to ${last}`;
}

/**
 * The attribution footer's wording. APPROVED text: plan 13-15's blocking
 * checkpoint confirmed it as written before the real tank table was
 * committed (D-23).
 */
export const OVERVIEW_ATTRIBUTION_TEXT = 'Tank names, nations and classes: Wargaming.net API data.';

/** The notice that follows the attribution text. */
export const OVERVIEW_ATTRIBUTION_NOTICE = '© Wargaming.net. All rights reserved.';

/** The text of the outbound attribution link. */
export const OVERVIEW_ATTRIBUTION_LINK_TEXT = 'World of Tanks';

/** The attribution link's target. An ordinary anchor: no request until clicked. */
export const OVERVIEW_ATTRIBUTION_LINK_HREF = 'https://worldoftanks.eu/';

/**
 * A tank class as the reader sees it.
 *
 * The built-in tank table spells classes `mediumTank`, `AT-SPG`,
 * `heavyTank`, `lightTank` and `SPG`; the page shows words. Anything the
 * table does not name — including `unknown` — reads "Unknown" rather than
 * being guessed (D-09).
 */
export function formatClassName(key: string): string {
  switch (key) {
    case 'mediumTank':
      return 'Medium';
    case 'AT-SPG':
      return 'Tank destroyer';
    case 'heavyTank':
      return 'Heavy';
    case 'lightTank':
      return 'Light';
    case 'SPG':
      return 'SPG';
    default:
      return 'Unknown';
  }
}

/**
 * A nation as the reader sees it.
 *
 * The nation is the vehicle id's prefix, so the prefix is a FACT and not a
 * guess. A prefix this table does not know is returned unchanged, because an
 * unknown prefix shown raw is honest and a prefix translated into the wrong
 * nation is not.
 */
export function formatNationName(prefix: string): string {
  switch (prefix) {
    case 'ussr':
      return 'USSR';
    case 'usa':
      return 'USA';
    case 'germany':
      return 'Germany';
    case 'france':
      return 'France';
    case 'china':
      return 'China';
    case 'uk':
      return 'UK';
    case 'japan':
      return 'Japan';
    case 'sweden':
      return 'Sweden';
    case 'czech':
      return 'Czechoslovakia';
    case 'poland':
      return 'Poland';
    case 'italy':
      return 'Italy';
    default:
      return prefix;
  }
}

/** The product's name, shown in the list pane's masthead. */
export const PRODUCT_LABEL = 'WG Data Export Viewer';

/**
 * The summary of an "About this <name>" disclosure (UI-SPEC copy row
 * "Disclosure summary"). `name` is always one of the `ABOUT_NAME_*` constants.
 */
export function formatAboutThis(name: string): string {
  return `About this ${name}`;
}

/** What the calendar's disclosure calls its chart: `About this calendar`. */
export const ABOUT_NAME_CALENDAR = 'calendar';

/** What the weekday-by-hour grid's disclosure calls its chart: `About this hour grid`. */
export const ABOUT_NAME_HOUR_GRID = 'hour grid';

/** What the premium chart's disclosure calls it: `About this chart`. */
export const ABOUT_NAME_PREMIUM = 'chart';

/** What each currency chart's disclosure calls it: `About this chart`. */
export const ABOUT_NAME_CURRENCY = 'chart';

/** What the login map's disclosure calls it: `About this map`. */
export const ABOUT_NAME_MAP = 'map';

/** What the Login history table's disclosure calls it: `About this table`. */
export const ABOUT_NAME_LOGIN_TABLE = 'table';

/**
 * What the Playtime totals' disclosure calls itself: `About this summary`
 * (Phase 10, D-06).
 *
 * "summary" and not "chart": the explanation is about the TILES (hours counted
 * once, sessions as recorded) and sits under them, so it names the thing it is
 * about rather than a chart it does not sit beside.
 */
export const ABOUT_NAME_PLAYTIME_TOTALS = 'summary';

// =============================================================================
// Quick 261012-bog - Device info pane copy
// =============================================================================
//
// The pane's three per-source tables, its counts summary and its honest states.
// Every sentence the pane shows is here, pinned by
// `tests/unit/shell/ui-copy.test.ts`. The file names keep their original
// capitalisation because they are what the user sees in the zip they unzipped.
// =============================================================================

/** The line shown while the device-info query is in flight. */
export const DEVICE_INFO_LOADING = 'Reading device information...';

/**
 * The FIXED sentence for a failed device-info query. The worker's detail is
 * never shown (T-bog-05): it can name a path, and this is true whatever failed.
 */
export const DEVICE_INFO_ERROR =
  'Device information could not be read from this export. Your imported data is unchanged. Drop the export again to retry.';

/** The one-line description under the section title. */
export const DEVICE_INFO_INTRO =
  'The computers and devices your export lists, one table for each source file.';

/** The heading of the counts summary. */
export const DEVICE_SUMMARY_HEADING = 'In this export';

/** What a null cell says: the export wrote `N/D` or nothing at all. */
export const DEVICE_NOT_REPORTED = 'not reported';

/** A source whose file is not in this export. */
export const DEVICE_TABLE_NOT_IN_EXPORT = 'Not in this export';

/** Why unreadable Assistant rows are counted but not listed. */
export const DEVICE_UNREADABLE_EXPLANATION =
  'These rows held no device type, app, platform or version this viewer can read, so they are counted but not listed.';

/** The one-line memory rule (PD-07). */
export const DEVICE_MEMORY_NOTE =
  'Memory is shown in GB (1 GB = 1,024 MB). Values under 1 GB stay in MB.';

/** The heading of each source's table. */
export const DEVICE_HEADINGS: Record<DeviceSourceId, string> = {
  pc: 'PC hardware',
  blitz: 'Blitz devices',
  assistant: 'Assistant app devices',
};

/** Each source's file name, as the export spells it. */
export const DEVICE_FILE_LABELS: Record<DeviceSourceId, string> = {
  pc: 'WOT_Device_Info.csv',
  blitz: 'WOTB_Device_Info.csv',
  assistant: 'WOT_Assistant_Device_Info.csv',
};

/** The column header of every table column, per source. */
export const DEVICE_COLUMN_LABELS: {
  [S in DeviceSourceId]: Record<DeviceColumnIds[S], string>;
} = {
  pc: {
    pcType: 'PC type',
    os: 'OS',
    osBit: 'OS bits',
    cpuVendor: 'CPU vendor',
    cpuName: 'CPU',
    cpuCores: 'CPU cores',
    gpuVendor: 'GPU vendor',
    gpuMemory: 'GPU memory',
    mainMemory: 'Main memory',
    multiGpu: 'Multi-GPU',
  },
  blitz: {
    platformName: 'Platform',
    vendorName: 'Vendor',
    modelName: 'Model',
    os: 'OS',
    region: 'Region',
    shopName: 'Shop',
    countryByIp: 'Country by IP',
    countryByTz: 'Country by time zone',
  },
  assistant: {
    deviceType: 'Device type',
    app: 'App',
    platform: 'Platform',
    version: 'Version',
  },
};

/**
 * A memory value in MB as the pane shows it (PD-07): under 1,024 MB stays in
 * MB; from 1,024 MB up it is GB at 1,024 MB per GB, one decimal, with a
 * trailing `.0` dropped. Goes through `formatNumber`, so the locale rules stay
 * in one place. A non-finite or negative input reads `0 MB`, never `NaN`.
 */
export function formatMemoryFromMb(mb: number): string {
  const value = Number.isFinite(mb) && mb > 0 ? mb : 0;
  if (value < 1024) return `${formatNumber(Math.round(value))} MB`;
  return `${formatNumber(Math.round((value / 1024) * 10) / 10)} GB`;
}

/** A table's provenance caption: `From WOT_Device_Info.csv`. */
export function formatDeviceFromFile(file: string): string {
  return `From ${file}`;
}

/** A file that was in the archive and held no data rows. */
export function formatDeviceNoRows(file: string): string {
  return `${file} is in this export but holds no rows`;
}

/** A file whose rows could not be read at all. */
export function formatDeviceNoUsable(rowCount: number): string {
  return rowCount === 1
    ? 'The 1 row in this file could not be read'
    : `None of the ${formatNumber(rowCount)} rows in this file could be read`;
}

/** The unreadable-rows pill: empty at zero, so no "0 rows" is ever shown. */
export function formatDeviceUnreadablePill(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 row could not be read' : `${formatNumber(n)} rows could not be read`;
}

/** The line after a capped table. */
export function formatDeviceMoreRows(k: number): string {
  return k === 1 ? 'and 1 more row not listed' : `and ${formatNumber(k)} more rows not listed`;
}

/** One source's value in the counts summary. */
export function formatDeviceSourceCount(
  status: 'not-in-export' | 'no-rows' | 'no-usable' | 'ready',
  rowCount: number,
  unreadable: number,
): string {
  if (status === 'not-in-export') return 'not in this export';
  if (status === 'no-rows') return 'no rows';
  const rows = formatRowCount(rowCount);
  return unreadable > 0 ? `${rows}, ${formatNumber(unreadable)} could not be read` : rows;
}

/** The accessible name of a source's table: `PC hardware table`. */
export function formatDeviceTableLabel(heading: string): string {
  return `${heading} table`;
}

// =============================================================================
// Phase 11 plan 08 - HEAT and Warships crews & storage pane copy
// =============================================================================
//
// Every sentence the two new-game panes show, plus the two label tables that
// keep a zip entry's own text off the screen. The wording is the 11-UI-SPEC
// Copywriting Contract's, pinned by `tests/unit/shell/ui-copy.test.ts`.
//
// The label tables are the T-08-01 pattern again: a card's `From {file}` caption
// is looked up by the lower-cased RECORD TYPE the worker matched, never read off
// the archive, so an untrusted zip entry name cannot reach a caption; and a
// column header is looked up by the allowlisted column ID, never by a header
// string from the zip, so a header the allowlist does not name cannot become a
// column heading. A lookup that misses falls back to the allowlisted id (or the
// card is not drawn), never to archive text (T-11-23).
//
// `DEVICE_TABLE_NOT_IN_EXPORT`, `DEVICE_NOT_REPORTED`, `formatDeviceFromFile`,
// `formatDeviceNoRows`, `formatDeviceTableLabel` and `formatNewDataSkipped` are
// reused from above and deliberately not redefined here.
// =============================================================================

/** The HEAT pane's intro paragraph (UI-SPEC Copywriting Contract). */
export const HEAT_INTRO =
  'Your HEAT account statistics, battle types, storage and geolocation records. HEAT play sessions are counted in Playtime.';

/** The Warships crews & storage pane's intro; it points to Vehicles for ship statistics. */
export const WOWS_STORAGE_INTRO =
  'The crews and account storage your export lists for Warships. Warships vehicle statistics are in Vehicles.';

/** The four HEAT card titles, in pane order. */
export const HEAT_CARD_TITLES: Record<HeatCardId, string> = {
  accountStats: 'Account statistics',
  battleTypes: 'Battle types',
  storage: 'Storage',
  geolocation: 'Geolocation',
};

/** The two Warships card titles, in pane order. */
export const WOWS_STORAGE_CARD_TITLES: Record<WowsCardId, string> = {
  crews: 'Crews',
  storage: 'Account storage',
};

/** The caption under the Geolocation card title (D-04): these addresses stay out of Logins. */
export const HEAT_GEO_NOTE =
  'These addresses are not added to the Login history map or country list.';

/** The status line while the HEAT query is in flight. */
export const HEAT_LOADING = 'Reading HEAT data...';

/** The status line while the Warships crews & storage query is in flight. */
export const WOWS_STORAGE_LOADING = 'Reading Warships crews and storage...';

/** The FIXED sentence for a failed HEAT query; the worker's detail is never shown (T-11-29). */
export const HEAT_ERROR =
  'HEAT data could not be read from this export. Your imported data is unchanged. Drop the export again to retry.';

/** The FIXED sentence for a failed Warships crews & storage query (T-11-29). */
export const WOWS_STORAGE_ERROR =
  'Warships crews and storage could not be read from this export. Your imported data is unchanged. Drop the export again to retry.';

/**
 * Each pane file's name as the export spells it, keyed by the lower-cased record
 * type. Taken from the header capture (`tests/fixtures/new-data-headers.ts`), so
 * a card caption is a constant and an archive's own entry name is never printed.
 *
 * The Perks pane's card files are in this table too (12-02): a card caption is
 * a caption whichever pane shows it, and a Perks file with no label would print
 * its lower-cased key instead.
 */
export const NEW_DATA_FILE_LABELS: Readonly<Record<string, string>> = {
  'heat_account_statistics.csv': 'HEAT_Account_Statistics.csv',
  'heat_battle_types_statistics.csv': 'HEAT_Battle_Types_Statistics.csv',
  'heat_account_storage.csv': 'HEAT_Account_Storage.csv',
  'heat_session_geolocation.csv': 'HEAT_Session_Geolocation.csv',
  'wows_crews.csv': 'WOWS_Crews.csv',
  'wows_account_storage.csv': 'WOWS_Account_Storage.csv',
  // 12-02. The Perks pane's Surveys card, from the one captured file name.
  'heat_surveys.csv': 'HEAT_Surveys.csv',
  // 12-08. The five Account timeline files, as the Phase 12 capture spelled them.
  'account_name_history.csv': 'Account_Name_History.csv',
  'external_services_history.csv': 'External_Services_History.csv',
  'language_and_country_history.csv': 'Language_And_Country_History.csv',
  'bans.csv': 'Bans.csv',
  'authorized_third_parties.csv': 'Authorized_Third_Parties.csv',
  // 12-08. The three Perks card files the capture named.
  'subscriptions.csv': 'Subscriptions.csv',
  'personal_coupons.csv': 'Personal_Coupons.csv',
  'bonus_code_usage.csv': 'Bonus_Code_Usage.csv',
};

/**
 * A short plain-language heading for every allowlisted column of every pane
 * file, keyed by the lower-cased file key and then the spec's stored column id.
 *
 * Complete by construction: a unit test walks the worker's spec table and fails,
 * naming the file and the id, if a column has no entry here. Warplanes files are
 * not in this table (they feed Vehicles, plan 11-10).
 *
 * The Perks pane's card files are covered by the same rule (12-02), so a
 * Survey column can never reach a card without a plain-language heading.
 */
export const NEW_DATA_COLUMN_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'heat_account_statistics.csv': {
    REGISTRATION_DT: 'Registered',
    ACTIVATION_DT: 'Activated',
    FIRST_LOGIN_DT: 'First login',
    FIRST_LOGIN_PLATFORM: 'First login platform',
    FIRST_BATTLE_DT: 'First battle',
    FIRST_PAYMENT_DT: 'First payment',
    COUNTRY_CODE: 'Country',
  },
  'heat_battle_types_statistics.csv': {
    GAME_MODE: 'Game mode',
    GAME_SOURCE: 'Source',
    BATTLES: 'Battles',
    WINS: 'Wins',
    LOSSES: 'Losses',
    DRAWS: 'Draws',
    ND: 'No decision',
    DAMAGE: 'Damage',
    DAMAGE_TAKEN: 'Damage taken',
    FRAGS: 'Frags',
    KILL_ASSIST: 'Assists',
    DEATHS: 'Deaths',
    SHOOT_DONE: 'Shots fired',
    HITS_DONE: 'Hits',
    CAPTURE_POINTS: 'Capture points',
    TIME_PLAYED_BY_HUMAN: 'Time played',
    VEHICLE_EXPERIENCE: 'Vehicle experience',
    FRONTMAN_EXPERIENCE: 'Frontman experience',
    ARENA_START_TS: 'First arena',
    ARENA_END_TS: 'Last arena',
  },
  'heat_account_storage.csv': {
    ASSET_CODE: 'Asset code',
    FIRST_OWNED_TS: 'First owned',
    REALM_CODE: 'Realm',
    ASSET_NAME: 'Asset',
  },
  'heat_session_geolocation.csv': {
    IP: 'IP address',
    COUNTRY_CODE_ALPHA_3: 'Country',
    CONNECTION_SPEED: 'Connection speed',
    LAST_SESSION_STARTED_DT: 'Last session started',
    LAST_SESSION_FINISHED_DT: 'Last session ended',
  },
  'wows_crews.csv': {
    CREW_ID: 'Crew',
    CREW_SHIP: 'Ship',
    CREW_TYPE: 'Crew type',
    CREW_LEVEL: 'Level',
    CREW_SHIP_TRAINED: 'Trained for ship',
    CREW_EXPERIENCE: 'Experience',
  },
  'wows_account_storage.csv': {
    ITEM_DESC: 'Item',
    AMOUNT: 'Amount',
  },
  // 12-02, widened by 12-08. The Surveys card's four allowlisted columns. Plain-language
  // headings, never the export's own header text, and never a column the
  // allowlist does not name.
  'heat_surveys.csv': {
    QUESTION_ID: 'Question',
    PLAYER_ANSWER: 'Answer',
    SKIPPED_BY_PLAYER: 'Skipped',
    MESSAGE_TS: 'Answered',
  },
  // 12-08. The Account timeline files. The timeline shows no column heading, but
  // the table stays complete so a later view cannot print a raw header.
  'account_name_history.csv': {
    CREATED_AT: 'Changed',
    OLD_NAME: 'Previous nickname',
    NEW_NAME: 'New nickname',
  },
  'external_services_history.csv': {
    CREATED_AT: 'Changed',
    OPERATION: 'Operation',
    NAME: 'Service',
  },
  'language_and_country_history.csv': {
    CREATED_AT: 'Changed',
    OPERATION: 'Operation',
    NAME: 'Setting',
    VALUE: 'Value',
  },
  'bans.csv': {
    STARTED_AT: 'Started',
    EXPIRED_AT: 'Ends',
    STATUS: 'Status',
  },
  'authorized_third_parties.csv': {
    THIRD_PARTY_SITE: 'Site',
    CREATED_AT: 'Authorized',
  },
  // 12-08. The Perks cards' columns. A code column reads Code and the redeeming
  // address reads IP address; both are masked by the shared cell formatter.
  'subscriptions.csv': {
    SUBSCRIBED: 'Subscribed',
  },
  'personal_coupons.csv': {
    INSERTED_AT: 'Added',
    UPDATED_AT: 'Updated',
    EXPIRED_AT: 'Expires',
    STATUS: 'Status',
    CODE: 'Code',
  },
  'bonus_code_usage.csv': {
    CREATED_AT: 'Redeemed',
    CODE_KEY: 'Code',
    USER_IP: 'IP address',
  },
};

/**
 * A column heading by file key and allowlisted column id.
 *
 * A miss returns the id string itself: the id is already an allowlisted
 * constant, so the fallback can never print a header taken from the zip. Own
 * properties only, so an id such as `constructor` is an unknown id and not an
 * inherited function.
 */
export function formatNewDataColumnLabel(fileKey: string, id: string): string {
  const labels = Object.hasOwn(NEW_DATA_COLUMN_LABELS, fileKey)
    ? NEW_DATA_COLUMN_LABELS[fileKey]
    : undefined;
  if (labels === undefined || !Object.hasOwn(labels, id)) return id;
  return labels[id] ?? id;
}

/**
 * The HEAT battle-types column whose cell is shown as `Battle type {value}`.
 *
 * `GAME_MODE` is the file's grouping key (11-HEADERS.md: "an enumeration, and
 * the grouping key of the battle-types card"), the one per-row name the export
 * gives, and the export records it as a code rather than a label. A card shows it
 * through `formatBattleTypeLabel`, as Vehicles shows its codes, and never maps it
 * to a name (a lookup would be a guess about a game's internal enum).
 */
export const HEAT_BATTLE_TYPE_COLUMN_ID: string | null = 'GAME_MODE';

// =============================================================================
// Plan 11-10 - Warplanes account statistics inside Vehicles (D-02, GAMES-03)
// =============================================================================
//
// Three constants for the `Account statistics` block under the Warplanes title:
// its heading, the label of each Warplanes file the page may NAME when a file's
// columns were all dropped, and a heading for every column the block may show.
//
// The file labels are a SEPARATE table from `NEW_DATA_FILE_LABELS` on purpose:
// that one is pinned to the pane file set (the HEAT and Warships files), and the
// Warplanes files feed Vehicles, not a pane. Neither table is ever fed by a zip
// entry name: the page looks a label up by a lower-cased KEY from a closed set,
// so an archive can never choose a word the page prints (T-11-35).
//
// The column labels describe a header by its words. Where the export abbreviates
// with a prefix whose game meaning the export does not state (`B_`, `D_`, `G_`,
// `P_`, `AT_`, `DB_`), the label keeps the prefix letters rather than naming a
// plane type: a lookup would be a guess about a game's internal enumeration.
// =============================================================================

/** The `Account statistics` block heading (UI-SPEC Copywriting Contract). */
export const WOWP_ACCOUNT_STATS_HEADING = 'Account statistics';

/** The four Warplanes file keys mapped to the file names as the capture printed them. */
export const WOWP_FILE_LABELS: Readonly<Record<string, string>> = {
  'wowp_19_plane_statistics.csv': 'WOWP_19_Plane_Statistics.csv',
  'wowp_20_plane_statistics.csv': 'WOWP_20_Plane_Statistics.csv',
  'wowp_19_account_statistics.csv': 'WOWP_19_Account_Statistics.csv',
  'wowp_20_account_statistics.csv': 'WOWP_20_Account_Statistics.csv',
};

/**
 * A short sentence-case heading for every column the Warplanes account block
 * can show, keyed by the allowlisted column id. Complete by construction: a unit
 * test walks the builder's column list and fails, naming the id, if one has no
 * entry here.
 */
export const WOWP_ACCOUNT_COLUMN_LABELS: Readonly<Record<string, string>> = {
  CREATED_AT: 'Account created',
  UPDATED_AT: 'Record updated',
  AUTO_BAN_TIME: 'Automatic ban time',
  LAST_COMPENSATION_TIME: 'Last compensation',
  LOGOUT_TIME: 'Last logout',
  LAST_GAME_TIME: 'Last game',
  ACC_OFFLINE: 'Offline',
  ACC_ONLINE: 'Online',
  GOLD: 'Gold',
  CREDITS: 'Credits',
  EXPERIENCE: 'Experience',
  SLOTS: 'Slots',
  EMPTY_SLOTS: 'Empty slots',
  SPOTTED: 'Spotted',
  SHOTS_RECEIVED: 'Shots received',
  SQUAD_GAMES: 'Squad games',
  SQUAD_WINS: 'Squad wins',
  BASE_GAIN_EXPERIENCE: 'Base experience gained',
  GAIN_EXPERIENCE: 'Experience gained',
  MAX_GAIN_EXPERIENCE: 'Most experience gained',
  MAX_GAIN_CREDITS: 'Most credits gained',
  SUPERIORITY_POINTS: 'Superiority points',
  SURVIVED: 'Survived',
  WINS: 'Wins',
  LOSSES: 'Losses',
  DRAWS: 'Draws',
  DEATHS: 'Deaths',
  MAX_STRUCTURE_DAMAGE: 'Most structure damage',
  MAX_STRUCTURE_DES_BY_WEAP_TYPE: 'Most structures destroyed by weapon type',
  MAX_GROUND_OBJECTS_DESTROYED: 'Most ground objects destroyed',
  MAX_DAMAGE_DEALT: 'Most damage dealt',
  MAX_KILLED: 'Most kills',
  MAX_ASSISTS_GROUND: 'Most ground assists',
  MAX_KILLED_BY_WEAPON_TYPE: 'Most kills by weapon type',
  MAX_GRO_OB_DEST_BY_WEAPON_TYPE: 'Most ground objects destroyed by weapon type',
  MAX_ASSISTS: 'Most assists',
  TOTAL_ASSISTS: 'Total assists',
  TOTAL_DAMAGE_DEALT: 'Total damage dealt',
  TOTAL_TEAM_OBJECTS_DESTROYED: 'Total team objects destroyed',
  TOTAL_KILLED: 'Total kills',
  TOTAL_HITS: 'Total hits',
  TOTAL_GROUND_OBJECTS_DESTROYED: 'Total ground objects destroyed',
  TOTAL_ASSISTS_GROUND: 'Total ground assists',
  TOTAL_SHOTS: 'Total shots',
  TOTAL_TURRETS_DESTROYED: 'Total turrets destroyed',
  TOTAL_STRUCTURE_DAMAGE: 'Total structure damage',
  ACHIEVEMENTS: 'Achievements',
  MEDALS: 'Medals',
  RIBBONS: 'Ribbons',
  LANGUAGE: 'Language',
  CBT_GAMES_PLAYED: 'Closed beta games',
  OBT_GAMES_PLAYED: 'Open beta games',
  GLOBAL_RATING: 'Global rating',
  AT_DAMAGE_MAX: 'AT most damage',
  AT_KILL_AVG_DF: 'AT average kills (defence)',
  B_ASSIST: 'B assists',
  B_DAMAGE: 'B damage',
  B_DAMAGE_MAX: 'B most damage',
  B_KILL: 'B kills',
  B_KILL_MAX: 'B most kills',
  B_SCORE: 'B score',
  B_SCORE_AVG: 'B average score',
  B_SCORE_MAX: 'B best score',
  BASE_XP: 'Base experience',
  BASE_XP_AVG: 'Base experience, average',
  BASE_XP_MAX: 'Base experience, best',
  D_ASSIST: 'D assists',
  D_DAMAGE: 'D damage',
  D_DAMAGE_MAX: 'D most damage',
  D_KILL: 'D kills',
  D_KILL_MAX: 'D most kills',
  DB_DAMAGE_MAX: 'DB most damage',
  DB_KILL_MAX: 'DB most kills',
  DB_KILL_AVG: 'DB average kills',
  FLIGHTS: 'Flights',
  FLIGHTTIME: 'Flight time',
  G_ASSIST: 'G assists',
  G_DAMAGE: 'G damage',
  G_DAMAGE_MAX: 'G most damage',
  G_KILL: 'G kills',
  G_KILL_MAX: 'G most kills',
  G_KILL_AVG: 'G average kills',
  G_KILL_AVG_DF: 'G average kills (defence)',
  KD_RATION: 'Kill to death ratio',
  P_ASSIST: 'P assists',
  P_DAMAGE: 'P damage',
  P_DAMAGE_MAX: 'P most damage',
  P_KILL: 'P kills',
  P_KILL_AVG: 'P average kills',
  P_KILL_DEF_ZONE: 'P kills in the defence zone',
  P_KILL_DEF_ZONE_MAX: 'P most kills in the defence zone',
  P_KILL_MAX: 'P most kills',
  ZONE_CAPTURE: 'Zone captures',
};

// =============================================================================
// Phase 12 - Account timeline and Perks
// =============================================================================
//
// Every sentence the two new panes show, worded by the 12-UI-SPEC Copywriting
// Contract and pinned by `tests/unit/shell/ui-copy.test.ts`.
//
// ## Nothing here can print an untrusted string (T-12-15)
//
// A zip entry name, a nickname and an account id are untrusted content. The two
// formatters below therefore take COUNTS and nothing else, and every
// interpolation goes through `formatNumber`, so no sentence in this block can
// carry a word out of the archive. File labels are not here at all: they come
// from the constant `NEW_DATA_FILE_LABELS` table keyed by record type, above.
//
// ## Two mask wordings over ONE reveal (UI-SPEC conditional copy)
//
// The Account timeline reuses the IP-only `MASK_*` constants verbatim, so this
// block does not redefine them. Perks needs its own because a coupon code and
// a bonus code sit under the same global reveal, and a toggle that says "IP
// addresses" while hiding a coupon code understates what it is hiding. The
// IP-only wording that Login history and HEAT already ship is unchanged.
//
// Reused from above and deliberately not redefined here:
// `formatAboutThis`, `DEVICE_NOT_REPORTED`, `DEVICE_TABLE_NOT_IN_EXPORT`,
// `formatDeviceNoRows`, `formatNewDataSkipped`, `formatCombinedCaption`,
// `formatOpenSectionLink` and `formatDeviceTableLabel`.
// =============================================================================

/** Copywriting Contract, "Timeline intro". Says the direction, so it is never implicit. */
export const TIMELINE_INTRO =
  'What your accounts were called, which services were linked, which language and country they were registered under, what was enforced against them and which third parties were authorised. Newest first.';

/** Copywriting Contract, "Perks intro". */
export const PERKS_INTRO =
  'The subscriptions, personal coupons, bonus codes and surveys your export lists.';

/** Copywriting Contract, "Kind filter label"; it is also the radiogroup's accessible name. */
export const TIMELINE_KIND_FILTER_LABEL = 'Filter by kind';

/** Copywriting Contract, "Kind filter all option". */
export const TIMELINE_KIND_ALL = 'All entries';

/**
 * Copywriting Contract, "Kind labels": the badge word and the chip word are
 * ONE table, so a kind cannot be labelled two ways in two places.
 */
export const TIMELINE_KIND_LABELS: Readonly<Record<TimelineKind, string>> = {
  name: 'Name',
  service: 'Service',
  language: 'Language',
  country: 'Country',
  ban: 'Ban',
  thirdParty: 'Third party',
};

/** Copywriting Contract, "Timeline column headers": three columns, fixed. */
export const TIMELINE_COLUMN_LABELS = {
  date: 'Date',
  kind: 'Kind',
  entry: 'Entry',
} as const;

/**
 * Copywriting Contract, "Showing line": how many entries are on screen out of
 * how many the pane holds.
 *
 * This line is also the pane's one live region, so it carries the loading
 * sentence while the model builds and the showing sentence after. The
 * "all {n}" variant exists because "Showing 3 of 3 entries" states a filter
 * that was never applied, and there is no filter to remove.
 */
export function formatTimelineShowing(shown: number, total: number): string {
  return shown === total
    ? `Showing all ${formatNumber(total)} entries`
    : `Showing ${formatNumber(shown)} of ${formatNumber(total)} entries`;
}

/**
 * Copywriting Contract, "Merge note".
 *
 * It reconciles two numbers a reader would otherwise have to reconcile alone:
 * the list headline and the provenance count STORED rows (UI-SPEC Recorded
 * Choice 7), while the table shows the rows the merge kept. Singular at
 * exactly one, because "1 entries" is a sentence no careful writer ships.
 */
export function formatMergeNote(k: number): string {
  return k === 1
    ? '1 entry is identical on more than one account and is shown once, with a tag for each account.'
    : `${formatNumber(k)} entries are identical on more than one account and are shown once, with a tag for each account.`;
}

/** Copywriting Contract, "Perks card titles", in the pane's fixed card order (D-08). */
export const PERKS_CARD_TITLES: Readonly<Record<PerksCardId, string>> = {
  subscriptions: 'Subscriptions',
  coupons: 'Personal coupons',
  bonusCodes: 'Bonus codes',
  surveys: 'Surveys',
};

/** Copywriting Contract, "Perks mask toggle", masked. */
export const PERKS_MASK_TOGGLE_SHOW = 'Show full codes and IP addresses';

/** Copywriting Contract, "Perks mask toggle", revealed. */
export const PERKS_MASK_TOGGLE_HIDE = 'Hide full codes and IP addresses';

/** Copywriting Contract, "Perks mask caption, masked". */
export const PERKS_MASK_CAPTION_MASKED =
  'Codes and IP addresses are masked: most of each code and the last part of each address are hidden.';

/** Copywriting Contract, "Perks mask caption, revealed". */
export const PERKS_MASK_CAPTION_REVEALED =
  'Full codes and IP addresses are shown. Hide them again before sharing your screen.';

/** Copywriting Contract, "Perks mask announcements", revealed. State words only, never a value. */
export const PERKS_MASK_ANNOUNCE_SHOWN = 'Full codes and IP addresses are now shown.';

/** Copywriting Contract, "Perks mask announcements", masked. */
export const PERKS_MASK_ANNOUNCE_MASKED = 'Codes and IP addresses are now masked.';

/**
 * Copywriting Contract, "Timeline About name". It is a NAME, not a heading:
 * `formatAboutThis` builds "About this timeline" from it.
 */
export const ABOUT_NAME_TIMELINE = 'timeline';

/**
 * Copywriting Contract, "Timeline About body".
 *
 * This is the ONLY place in the whole copy module where the word "email"
 * appears, and it says the guarantee rather than the mechanism: no address in
 * these files is read, stored or shown. A reader who asks about their email
 * here gets the answer; a cell, a state line or a tooltip never names one.
 */
export const TIMELINE_ABOUT =
  'Entries from your name, service, language and country, ban and authorised-third-party files are listed together, newest first; entries without a usable date come last. Email addresses in these files are never read, stored or shown. IP addresses stay masked until you choose to show them. When accounts hold an identical service, language or country entry, it is shown once with a tag for each account.';

/** Copywriting Contract, "Perks About name"; `formatAboutThis` builds "About this perks pane". */
export const ABOUT_NAME_PERKS = 'perks pane';

/** Copywriting Contract, "Perks About body". Says what the pane leaves out, in the reader's terms. */
export const PERKS_ABOUT =
  'Coupon codes, bonus codes and the IP address used to redeem a bonus code stay masked until you choose to show them. Only the fields this viewer reads are listed. When accounts hold an identical subscription, it is shown once with a tag for each account.';

/** Copywriting Contract, "Loading"; the ellipsis is part of the copy, as elsewhere. */
export const TIMELINE_LOADING = 'Reading account timeline...';

/** Copywriting Contract, "Loading". */
export const PERKS_LOADING = 'Reading perks...';

/**
 * Copywriting Contract, "Error state". FIXED text: the worker's detail is never
 * shown (T-11-29's rule, carried forward), because a failure message carrying a
 * file or column name would put archive text on the screen.
 */
export const TIMELINE_ERROR =
  'Account timeline could not be read from this export. Your imported data is unchanged. Drop the export again to retry.';

/** Copywriting Contract, "Error state". Fixed text, same rule. */
export const PERKS_ERROR =
  'Perks could not be read from this export. Your imported data is unchanged. Drop the export again to retry.';
