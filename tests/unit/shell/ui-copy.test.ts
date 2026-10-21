import { afterEach, describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monthIndex } from '../../../src/lib/features/finance/finance-shared.ts';
import {
  COMPACT_DROPZONE_PROMPT,
  DROPZONE_ARIA_LABEL,
  DROPZONE_PROMPT,
  GENERIC_FAILURE_MESSAGE,
  IDENTITY_ARIA_LABEL,
  IDENTITY_CAPTION,
  IDENTITY_CREATED_LABEL,
  IDENTITY_REGION_LABEL,
  IDENTITY_SKELETON_PROMPT,
  IDENTITY_SKELETON_TITLE,
  IDENTITY_UNKNOWN_ACCOUNT_TITLE,
  IMPORT_ARIA_LABEL,
  NAV_ARIA_LABEL,
  SECTION_NOTE_PENDING,
  SECTION_NOTE_USER_INFO,
  STAGE_TEXT,
  START_OVER_LABEL,
  UNKNOWN_VALUE,
  UNSUPPORTED_BANNER_SUFFIX,
  UNSUPPORTED_INTRO,
  UNSUPPORTED_NONE_DETECTED,
  formatAccountId,
  formatCreatedDate,
  formatFileCount,
  formatIdentityFallbackTitle,
  formatImportSummary,
  formatSectionStatus,
  NAV_STATUS_SUFFIX,
  SECTION_TITLES,
} from '../../../src/lib/ui-copy.ts';
import type { IngestStage } from '../../../src/lib/core/types/worker-messages.ts';
// A NAMESPACE import on purpose: a named import of a constant that does not
// exist yet is a link error that takes the whole file down, so the RED run
// would report zero discovered tests instead of six failing ones. With a
// namespace the six tests each fail on their own value assertion. Plan 04-04
// reuses this import.
import * as playtimeCopy from '../../../src/lib/ui-copy.ts';
import { DURATION_BIN_COUNT } from '../../../src/lib/features/playtime/playtime-shared.ts';
import {
  NEW_DATA_PANE_FILES,
  PERKS_CARD_FILES,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { CAPTURED_FILES, PANE_MAPPING } from '../../fixtures/new-data-headers.ts';
import { wowpAccountColumns } from '../../../src/lib/features/vehicles/vehicle-aggregate.ts';

/**
 * Every file the new-data label table may name, sorted.
 *
 * The PANE files plus the PERKS card files: a card caption is a caption
 * whichever pane shows it, so the label table covers both. The Perks pane joins
 * the pane tables in plan 12-02's Task 2 and the union is the same set before
 * and after that, so this one list serves both stages. Plan 12-08 adds the
 * Account timeline files (the mapped timeline rows of the Pane mapping): the
 * timeline shows no column heading, but the label table stays complete.
 */
const LABELLED_FILES: readonly string[] = [
  ...new Set([
    ...Object.values(NEW_DATA_PANE_FILES).flat(),
    ...Object.values(PERKS_CARD_FILES).filter((file): file is string => file !== null),
    ...PANE_MAPPING.filter((row) => row.pane === 'timeline' && row.status === 'mapped').flatMap(
      (row) => (row.fileKey === null ? [] : [row.fileKey]),
    ),
  ]),
].sort();

// =============================================================================
// ui-copy — formatter tests (01-05-PLAN Task 1, RED then GREEN)
// =============================================================================
//
// Why this file exists:
//   ui-copy.ts is the single source of truth for the user-visible
//   copy shown around the ingest flow (D-03, D-08, D-11, D-13). Every
//   formatter is a tiny pure function with a stable shape — testing
//   them locks the exact wording the Playwright specs match against,
//   and protects against silent regressions in case someone reorders
//   status buckets, swaps " · " for " | ", or drops the singular
//   "1 file" case.
//
// All exports are pure: no DOM, no Date, no random. The tests run
// under Node with no setup beyond the default Vitest environment.
// =============================================================================

// -----------------------------------------------------------------------------
// Stable strings — wording-locked by Playwright spec matches
// -----------------------------------------------------------------------------

describe('stable copy', () => {
  test('GENERIC_FAILURE_MESSAGE is the D-04 single-source copy', () => {
    expect(GENERIC_FAILURE_MESSAGE).toBe(
      "This doesn't look like a Wargaming data export. Drop the .zip file you received from Wargaming's GDPR export request.",
    );
  });

  test('DROPZONE_PROMPT is the idle-state prompt, distinct from the failure banner', () => {
    expect(DROPZONE_PROMPT).toBe(
      'Drop your Wargaming data export (.zip) here, or click to choose it.',
    );
    // The two strings must never overlap — the failure copy is for
    // failures, the prompt is for the idle state (01-04 ui-copy
    // rationale).
    expect(GENERIC_FAILURE_MESSAGE).not.toBe(DROPZONE_PROMPT);
  });

  test('START_OVER_LABEL is "Start over" with no trailing punctuation', () => {
    expect(START_OVER_LABEL).toBe('Start over');
  });
});

// -----------------------------------------------------------------------------
// STAGE_TEXT — keyed by every IngestStage value (D-08)
// -----------------------------------------------------------------------------

describe('STAGE_TEXT', () => {
  test('covers every IngestStage value (TS exhaustive)', () => {
    // If a new stage is added to the worker contract, this test
    // fails until STAGE_TEXT is updated.
    const stages: IngestStage[] = ['unzipping', 'classifying'];
    for (const s of stages) {
      expect(STAGE_TEXT[s]).toBeTypeOf('string');
    }
  });

  test('unzipping maps to "Unzipping..."', () => {
    expect(STAGE_TEXT.unzipping).toBe('Unzipping...');
  });

  test('classifying maps to "Classifying folders..."', () => {
    expect(STAGE_TEXT.classifying).toBe('Classifying folders...');
  });
});

// -----------------------------------------------------------------------------
// formatFileCount — singular form for 1, plural otherwise (including 0)
// -----------------------------------------------------------------------------

describe('formatFileCount', () => {
  test('returns "1 file" for n=1 (singular)', () => {
    expect(formatFileCount(1)).toBe('1 file');
  });

  test('returns "0 files" for n=0', () => {
    expect(formatFileCount(0)).toBe('0 files');
  });

  test('returns "N files" for n>1', () => {
    expect(formatFileCount(2)).toBe('2 files');
    expect(formatFileCount(42)).toBe('42 files');
  });

  test('handles the 20k-entry scale fixture (FA-01-05-4)', () => {
    expect(formatFileCount(2500)).toBe('2500 files');
    expect(formatFileCount(20_000)).toBe('20000 files');
  });
});

// =============================================================================
// Phase 3 dashboard shell — copy and formatters (03-02-PLAN Task 2)
// =============================================================================
//
// Every string here is transcribed from the 03-UI-SPEC.md Copywriting
// Contract. They are asserted with exact-string `toBe` on purpose: a
// paraphrase is a copy-review change, and copy changes should be a
// deliberate edit to this file, not a side effect of a refactor.
// =============================================================================

describe('Phase 3 section, nav and banner copy', () => {
  test('SECTION_TITLES writes the folder names exactly as the export does', () => {
    expect(SECTION_TITLES).toEqual({
      'activity-history': 'Activity_history',
      'player-statistics': 'Player_statistics',
      // 05-03 D-01: the fifth section, third in the nav. Written as the
      // export spells it, underscore and all — the same rule as the four
      // above it, and the reason this is an exact-object assertion.
      'financial-data': 'Financial_data',
      'payment-history': 'Payment_history',
      // quick 261012-bog: the Device info pane's section, written as the
      // export spells the folder.
      'device-info': 'Device_info',
      'user-info': 'User_Info',
      'not-yet-supported': 'Not yet supported',
    });
  });

  test('NAV_ARIA_LABEL names the nav landmark', () => {
    expect(NAV_ARIA_LABEL).toBe('Dashboard sections');
  });

  test('every muted nav reason has its own visible-text suffix', () => {
    expect(NAV_STATUS_SUFFIX).toEqual({
      'no-export': ', not in this export',
      empty: ', no rows in this export',
      'not-loaded': ', no export loaded',
      none: ', none detected',
    });
  });

  test('the three greyed section statuses have three distinct messages', () => {
    expect(formatSectionStatus('not-loaded', 'Payment_history')).toBe(
      'Drop an export to see this section',
    );
    expect(formatSectionStatus('no-export', 'Payment_history')).toBe('Not in this export');
    expect(formatSectionStatus('empty', 'Payment_history')).toBe(
      'This export contains no rows for Payment_history',
    );
  });

  test('SECTION_NOTE_PENDING is the D-09 note for a populated section', () => {
    expect(SECTION_NOTE_PENDING).toBe('Dashboard coming in a later update');
  });

  test('SECTION_NOTE_USER_INFO overrides the note — no phase builds that dashboard', () => {
    // 08-01: the identity header moved into the list pane, so "above" stopped
    // being true. The note now points at where the nickname actually is.
    expect(SECTION_NOTE_USER_INFO).toBe(
      'Account details are shown under your nickname in the section list',
    );
    expect(SECTION_NOTE_USER_INFO).not.toContain('above');
  });

  test('the unsupported block intro, empty state and banner suffix', () => {
    expect(UNSUPPORTED_INTRO).toBe(
      "These folders are in your export, but this viewer can't show them yet.",
    );
    expect(UNSUPPORTED_NONE_DETECTED).toBe(
      'No unsupported categories were detected in this export',
    );
    // Leading space + em dash: the banner renders the folder name first and
    // this follows it inline, so a missing space reads as a typo.
    expect(UNSUPPORTED_BANNER_SUFFIX).toBe(' — detected but not yet supported');
  });
});

describe('formatImportSummary', () => {
  test('keeps the singular form for both counts', () => {
    expect(formatImportSummary(1, 1)).toBe('1 file, 1 row');
  });

  test('uses the existing thousands separator for the row count', () => {
    expect(formatImportSummary(3, 1204)).toBe('3 files, 1,204 rows');
  });

  test('renders zeroes rather than hiding them', () => {
    expect(formatImportSummary(0, 0)).toBe('0 files, 0 rows');
  });
});

describe('identity header copy', () => {
  test('the landmark name is static and never carries the nickname', () => {
    // D-21: the nickname appears in the header text only. An aria-label
    // naming the account would leak it into an accessible name.
    expect(IDENTITY_ARIA_LABEL).toBe('Account identity');
  });

  test('the caption, the two dt labels and the missing-value word', () => {
    expect(IDENTITY_CAPTION).toBe('As of export');
    expect(IDENTITY_REGION_LABEL).toBe('Location code (per export)');
    expect(IDENTITY_CREATED_LABEL).toBe('Account created');
    expect(UNKNOWN_VALUE).toBe('Unknown');
  });

  test('the region label cannot be read as a game realm', () => {
    // UAT G-05-7: a real export stores a numeric regional code ("30") in
    // `REGION`, beside a city, not a game server. A label that leads with
    // "Region" invites the reader to look for a realm name, and "code" is
    // the word that says the value is opaque and not something to decode.
    expect(IDENTITY_REGION_LABEL.startsWith('Region')).toBe(false);
    expect(IDENTITY_REGION_LABEL).toContain('code');
  });

  test('the skeleton title and prompt', () => {
    expect(IDENTITY_SKELETON_TITLE).toBe('No export loaded');
    expect(IDENTITY_SKELETON_PROMPT).toBe('Drop an export to see the account details');
  });
});

describe('formatAccountId', () => {
  test('prefixes the raw root with "Account ID: "', () => {
    expect(formatAccountId('123456789')).toBe('Account ID: 123456789');
  });

  test("returns untrusted text unchanged — escaping is the renderer's job", () => {
    // The root is a zip-entry name from an archive anyone can craft. This
    // function concatenates; it never emits markup (threat T-03-07).
    expect(formatAccountId('a<b>&')).toBe('Account ID: a<b>&');
  });
});

describe('formatCreatedDate', () => {
  test('takes the date portion of a space-separated value', () => {
    expect(formatCreatedDate('2015-03-11 10:00:00')).toBe('2015-03-11');
  });

  test('takes the date portion of an ISO T-separated value', () => {
    expect(formatCreatedDate('2015-03-11T10:00:00Z')).toBe('2015-03-11');
  });

  test('trims padding around the value', () => {
    expect(formatCreatedDate(' 2015-03-11 ')).toBe('2015-03-11');
  });

  test('null is Unknown — the field was never there', () => {
    expect(formatCreatedDate(null)).toBe('Unknown');
  });

  test('an empty string is Unknown', () => {
    expect(formatCreatedDate('')).toBe('Unknown');
  });

  test('a whitespace-only value is Unknown', () => {
    expect(formatCreatedDate('   ')).toBe('Unknown');
  });

  test('a value that starts with T has no date portion and is Unknown', () => {
    // D-15: the text before the first space or T. If that text is empty
    // there is no date to show, and "Unknown" beats an empty <dd>.
    expect(formatCreatedDate('T10:00')).toBe('Unknown');
  });

  test('a value with no separator at all is returned as written', () => {
    // No Date parsing anywhere: the field carries no timezone, so a locale
    // conversion would invent one (and can shift the day).
    expect(formatCreatedDate('2015-03-11')).toBe('2015-03-11');
    expect(formatCreatedDate('March 2015')).toBe('March');
  });
});

describe('formatIdentityFallbackTitle', () => {
  test('uses the account root when there is one', () => {
    expect(formatIdentityFallbackTitle('123456789')).toBe('123456789');
  });

  test('a rootless export gets a title instead of an empty heading', () => {
    // A re-zip whose entries are not under a single root folder gives
    // accountRoot === '' (RESEARCH Pitfall 6). An empty <h2> would leave a
    // blank card with no explanation.
    expect(formatIdentityFallbackTitle('')).toBe('Unknown account');
    expect(IDENTITY_UNKNOWN_ACCOUNT_TITLE).toBe('Unknown account');
  });
});

describe('import region copy', () => {
  test('the landmark name and the compact dropzone prompt', () => {
    expect(IMPORT_ARIA_LABEL).toBe('Import');
    expect(COMPACT_DROPZONE_PROMPT).toBe(
      'Drop a new export (.zip) here to replace this one, or click to choose it.',
    );
  });

  test('the compact prompt must not repeat the full-size prompt', () => {
    // Two states, two sentences: the slim bar already has a dataset, and
    // the full-size prompt's "your" would be wrong there.
    expect(COMPACT_DROPZONE_PROMPT).not.toBe(DROPZONE_PROMPT);
    expect(COMPACT_DROPZONE_PROMPT).toContain('replace this one');
  });

  test('the dropzone name, which the compact variant must NOT use', () => {
    // W-02: `aria-label` REPLACES an element's content as its accessible
    // name, so the full-size dropzone names itself here and the compact
    // one deliberately carries no label at all — its accessible name falls
    // back to the visible COMPACT_DROPZONE_PROMPT, which is the only place
    // the replace-on-drop affordance is stated. The two strings must
    // therefore stay distinct, or the two variants become interchangeable
    // to a screen reader.
    expect(DROPZONE_ARIA_LABEL).toBe('Wargaming data export dropzone');
    expect(DROPZONE_ARIA_LABEL).not.toBe(COMPACT_DROPZONE_PROMPT);
    expect(DROPZONE_ARIA_LABEL).not.toBe(DROPZONE_PROMPT);
  });
});

// =============================================================================
// Phase 4 Playtime copy — 04-02-PLAN Task 1
// =============================================================================
//
// Every literal below is COPIED from a 04-UI-SPEC.md copy table, and each row
// names the table and row it came from. The same discipline as the Phase 3
// block above: the UI-SPEC is the approved copy contract, so a paraphrase is a
// deliberate edit to THIS file, never a side effect of editing the component.
// A wording drift fails here as a unit test rather than only in a browser.
//
// The constants are read off the namespace import rather than named, so the
// RED run is six failing assertions instead of one file-level link error.
describe('04-02 tracer: Playtime state strings pinned to the UI-SPEC copy tables', () => {
  const PLAYTIME_COPY_ROWS = [
    // "New copy" table, Sub-heading row: `Playtime`
    ['PLAYTIME_HEADING', 'Playtime'],
    // "New copy" table, Loading row: `Calculating playtime...` (three ASCII
    // dots — Page Anatomy 2's `loading` row names the same string).
    ['PLAYTIME_LOADING', 'Calculating playtime...'],
    // "Empty and error copy" table, Empty state body — no session file row
    // (and the `no-session-file` row of the state matrix).
    [
      'PLAYTIME_NO_SESSION_FILE',
      'This export has no session file, so there is no playtime to show.',
    ],
    // "Empty and error copy" table, Empty state body — no usable sessions row
    // (and the `no-usable-sessions` row of the state matrix).
    ['PLAYTIME_NO_USABLE_SESSIONS', 'No usable sessions were found in this export.'],
    // "Empty and error copy" table, Error state row. Deliberately NOT
    // GENERIC_FAILURE_MESSAGE: that one claims the file is not a Wargaming
    // export, which would be false here.
    [
      'PLAYTIME_ERROR',
      'Playtime could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.',
    ],
    // "New copy" table, Tile labels row: `Total playtime` · `Sessions` ·
    // `Active days` — this plan owns the Sessions tile only.
    ['TILE_LABEL_SESSIONS', 'Sessions'],
    // "New copy" table, Cache-cleared notice row (04-16, G-04-5). Typed out
    // here, not read back from the constant, so a paraphrase in ui-copy.ts
    // fails here rather than silently reaching a user.
    [
      'PLAYTIME_CACHE_CLEARED',
      'Your cached data was cleared in another tab, so your selection could not be applied. Drop your export again to keep exploring it.',
    ],
  ] as const;

  test.each(PLAYTIME_COPY_ROWS)('%s is the UI-SPEC wording', (name, literal) => {
    expect(playtimeCopy[name]).toBe(literal);
  });

  test('the error copy is not the generic import failure message (D-19, T-04-24)', () => {
    // Two different failures must not share one sentence: the generic banner
    // says the file is not a Wargaming export, which a failed playtime query
    // would be lying about.
    expect(playtimeCopy.PLAYTIME_ERROR).not.toBe(playtimeCopy.GENERIC_FAILURE_MESSAGE);
  });

  test('the two empty-state sentences are different statements (04-01 sessionsFileSeen)', () => {
    // "No Sessions.csv at all" and "the file is there but no row is usable"
    // are two different facts about the user's export, and 04-01 goes to
    // real trouble to keep them apart (sessionsFileSeen is set per file,
    // before the row loop). Collapsing the copy would undo that.
    expect(playtimeCopy.PLAYTIME_NO_SESSION_FILE).not.toBe(
      playtimeCopy.PLAYTIME_NO_USABLE_SESSIONS,
    );
  });
});

// =============================================================================
// The cache-cleared notice (04-16, G-04-5)
// =============================================================================
//
// The sentence is pinned as a literal in the table above. What is left to
// prove is the two properties that make it safe to show: it is not the error
// sentence it sits beside, and it carries nothing that identifies anything.
// The predicate that decides to show it receives dataset stamps and worker
// replies; this is the boundary where those must stop (D-21, T-04-36).
describe('04-16: the cache-cleared notice is honest and leaks nothing', () => {
  test('it names the cause and the way forward', () => {
    // Both halves are the point. Without the cause the user cannot tell a bug
    // from a cleared cache; without the remedy they are told a thing went
    // wrong and given nothing to do about it.
    expect(playtimeCopy.PLAYTIME_CACHE_CLEARED).toContain('cleared in another tab');
    expect(playtimeCopy.PLAYTIME_CACHE_CLEARED).toContain('Drop your export again');
  });

  test('it is not the error sentence, which would be false here', () => {
    // `PLAYTIME_ERROR` says the imported data is unchanged and asks for a
    // calculation to be retried. In the cache-cleared case the data WAS
    // cleared and retrying the calculation would find nothing, so reusing it
    // would state the opposite of the truth and suggest a useless fix.
    expect(playtimeCopy.PLAYTIME_CACHE_CLEARED).not.toBe(playtimeCopy.PLAYTIME_ERROR);
  });

  test('it carries no dataset id, no path and no markup', () => {
    // The predicate reads the dataset stamp and the worker's reply; neither
    // may reach the DOM. A digit, a path separator or an angle bracket in
    // this fixed string would be the first place one did (T-04-36, D-21).
    expect(playtimeCopy.PLAYTIME_CACHE_CLEARED).not.toMatch(/[0-9/\\<>]/);
  });
});

// =============================================================================
// formatHours — the one hours-formatting rule (04-04-PLAN Task 1)
// =============================================================================
//
// 04-UI-SPEC Page Anatomy 4 fixes this rule once, for every place a duration
// is shown: under an hour, whole minutes with the unit `min` and a non-zero
// total under a minute rendered `<1`; from an hour up to (not including) 100
// hours, one decimal with a trailing `.0` dropped; 100 hours and up, a rounded
// integer with thousands separators. The unit is `hour` when the numeral is
// exactly 1 and `hours` otherwise. This describe exists to make that rule
// executable: a duration is the single most repeated string on the dashboard
// (tiles, tooltips, axis labels, accessible names), so a rounding or unit
// decision made in a component would be invisible until a browser showed it.
//
// The boundary cases are the ones where the rule has a decision to make, so
// they are the ones listed: 59 is the last `<1 min`, 60 the first `1 min`,
// 3599 the last minute, 3600 the first hour, 359856 the last value that is
// still one decimal (99.96 h), and 4332600 the first grouped figure (1,203.5 h
// rounds to 1,204).
describe('formatHours (Phase 4, UI-SPEC Page Anatomy 4)', () => {
  // [seconds, value, unit] — `value` and `unit` are exactly what the tile
  // shows, not a number the formatter would re-derive.
  const BOUNDARY_CASES = [
    [0, '0', 'min'],
    [1, '<1', 'min'],
    [59, '<1', 'min'],
    [60, '1', 'min'],
    [119, '1', 'min'],
    [120, '2', 'min'],
    [3599, '59', 'min'],
    [3600, '1', 'hour'],
    // 3601 h-frac is 0.00028 h, so the one-decimal rendering is 1.0 and the
    // trailing `.0` is dropped. The unit rule keys on the numeral, not the
    // duration, so this is `1 hour` and not `1.0 hours`.
    [3601, '1', 'hour'],
    [5400, '1.5', 'hours'],
    [12600, '3.5', 'hours'],
    [151200, '42', 'hours'],
    [359784, '99.9', 'hours'],
    [359856, '100', 'hours'],
    [360000, '100', 'hours'],
    [4332600, '1,204', 'hours'],
    [44445600, '12,346', 'hours'],
  ] as const;

  test.each(BOUNDARY_CASES)(
    '%i seconds is "%s %s"',
    (seconds: number, value: string, unit: string) => {
      expect(playtimeCopy.formatHoursParts(seconds)).toEqual({ value, unit });
    },
  );

  test('formatHours joins the value and the unit with one space', () => {
    expect(playtimeCopy.formatHours(0)).toBe('0 min');
    expect(playtimeCopy.formatHours(5400)).toBe('1.5 hours');
    expect(playtimeCopy.formatHours(3600)).toBe('1 hour');
    expect(playtimeCopy.formatHours(4332600)).toBe('1,204 hours');
  });

  test('a duration that is not a usable number reads as zero, not as NaN', () => {
    // Aggregation can only ever produce a non-negative finite total, so this
    // is defensive rather than a state the UI can reach. It matters because
    // the alternative is a tile reading "NaN hours" in front of a user.
    for (const bad of [-1, -3600, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(playtimeCopy.formatHours(bad)).toBe('0 min');
    }
  });
});

// =============================================================================
// Phase 4 static copy and count formatters (04-04-PLAN Task 2)
// =============================================================================
//
// Everything below is either a literal copied from a 04-UI-SPEC.md copy table
// or a count rendered through formatNumber. The literals are asserted HERE,
// not derived from the constants, for the same reason as the 04-02 block: the
// UI-SPEC is the approved copy contract, so a paraphrase is a deliberate edit
// to this file and never a side effect of editing the component.
//
// The zero-one-many row of the UI Considerations table is the reason the
// singular cases have their own assertions rather than falling out of a
// shared pluralising helper. "1 session", "1 active day", "1 hour", "1 session
// row excluded" and "1 more in the selector" are five different decisions, and
// a helper that handles four of them is a helper that gets the fifth wrong.
describe('Phase 4 static copy and count formatters', () => {
  const STATIC_ROWS = [
    // "New copy" table, Updating row: `Updating charts...`
    ['PLAYTIME_UPDATING', 'Updating charts...'],
    // "New copy" table, Login history sub-heading row: `Login history`
    ['LOGIN_HISTORY_HEADING', 'Login history'],
    // "New copy" table, Tile labels row: `Total playtime` · `Sessions` · `Active days`
    ['TILE_LABEL_TOTAL_PLAYTIME', 'Total playtime'],
    ['TILE_LABEL_ACTIVE_DAYS', 'Active days'],
    // "New copy" table, Selector: all option row: `All`
    ['SPLIT_ALL_OPTION', 'All'],
    // "New copy" table, Selector: blank value row: `(not recorded)`
    ['SPLIT_BLANK_VALUE', '(not recorded)'],
    // "New copy" table, Split table headers row: `{Column label}` · `Hours`
    ['SPLIT_HOURS_HEADER', 'Hours'],
    // "New copy" table, Excluded explanation row
    [
      'PLAYTIME_EXCLUDED_EXPLANATION',
      'Sessions with a missing or invalid time, or an end before the start, are not counted anywhere on this page.',
    ],
    // "New copy" table, Chart titles row
    ['CHART_TITLE_CALENDAR', 'Hours per day'],
    ['CHART_TITLE_HOUR_GRID', 'Hours by weekday and time of day'],
    ['CHART_TITLE_DURATION', 'Session length'],
    // "New copy" table, Calendar basis caption row
    ['CALENDAR_BASIS_CAPTION', 'Dates are as recorded in the export.'],
    // "New copy" table, Calendar keyboard hint row
    ['CALENDAR_KEYBOARD_HINT', 'Use the arrow keys to move between days.'],
    // "New copy" table, Weekday × hour basis caption row (D-01)
    [
      'HOUR_GRID_BASIS_CAPTION',
      'Hours are as recorded in the export (likely UTC or server time), not converted to your local time.',
    ],
    // "New copy" table, Weekday × hour keyboard hint row
    ['HOUR_GRID_KEYBOARD_HINT', 'Use the arrow keys to move between cells.'],
    // "New copy" table, Legend words row
    ['LEGEND_LESS', 'Less'],
    ['LEGEND_MORE', 'More'],
    // "New copy" table, Duration explanation row
    [
      'DURATION_EXPLANATION',
      'Each bar covers a longer range of session lengths than the one before it, so short and long sessions are both visible.',
    ],
    // "New copy" table, Duration list `aria-label` row
    ['DURATION_LIST_ARIA_LABEL', 'Sessions by length'],
  ] as const;

  test.each(STATIC_ROWS)('%s is the UI-SPEC wording', (name, literal) => {
    expect(playtimeCopy[name]).toBe(literal);
  });

  test('all three split columns carry the label the selector shows', () => {
    // "New copy" table, Selector label row: `Game` (`GAME`, 04-15) /
    // `Server name` (`SERVER_NAME`) / `Client platform` (`CLIENT_PLATFORM`).
    expect(playtimeCopy.SPLIT_COLUMN_LABELS).toEqual({
      GAME: 'Game',
      SERVER_NAME: 'Server name',
      CLIENT_PLATFORM: 'Client platform',
    });
  });

  test('the duration bins are the twelve the aggregation already produces', () => {
    // "New copy" table, Duration bins row. DURATION_BIN_COUNT is imported so
    // that a change to the bin count in playtime-shared.ts fails HERE rather
    // than shipping a legend whose last bar has no label.
    expect(playtimeCopy.DURATION_BIN_LABELS).toEqual([
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
    ]);
    expect(playtimeCopy.DURATION_BIN_LABELS).toHaveLength(DURATION_BIN_COUNT);
  });

  test('session and active-day counts are pluralised and grouped', () => {
    // "New copy" table, Year head summary row: `{h} · {n} sessions · {d}
    // active days` with singulars, e.g. `412 hours · 1,203 sessions · 201
    // active days`.
    expect(playtimeCopy.formatSessionCount(0)).toBe('0 sessions');
    expect(playtimeCopy.formatSessionCount(1)).toBe('1 session');
    expect(playtimeCopy.formatSessionCount(1203)).toBe('1,203 sessions');
    expect(playtimeCopy.formatActiveDayCount(1)).toBe('1 active day');
    expect(playtimeCopy.formatActiveDayCount(201)).toBe('201 active days');
  });

  test('a split value is shown as recorded, and a blank one as not recorded', () => {
    // "New copy" table, Selector: blank value row. A value that literally
    // reads "(not recorded)" is indistinguishable from the blank case in the
    // data, and the UI-SPEC accepts that collision rather than losing the
    // distinction.
    expect(playtimeCopy.formatSplitValue(null)).toBe('(not recorded)');
    expect(playtimeCopy.formatSplitValue('(not recorded)')).toBe('(not recorded)');
    expect(playtimeCopy.formatSplitValue('eu-1')).toBe('eu-1');
  });

  test('a split value is returned as text, never as markup', () => {
    // D-03 values are untrusted (T-04-07). The renderer escapes, so this
    // function must not invent a tag, a sanitiser, or a truncation of its own.
    const hostile = '<b>eu-1</b>';
    expect(playtimeCopy.formatSplitValue(hostile)).toBe(hostile);
  });

  test('the split table names the column in lower case, twice, consistently', () => {
    // "New copy" table, Split table caption row: `Hours by {column name lower
    // case}` e.g. `Hours by server name`. The overlap note is the same phrase
    // three times, so it is built from the same helper rather than retyped.
    expect(playtimeCopy.formatSplitColumnLower('SERVER_NAME')).toBe('server name');
    expect(playtimeCopy.formatSplitColumnLower('CLIENT_PLATFORM')).toBe('client platform');
    expect(playtimeCopy.formatSplitCaption('SERVER_NAME')).toBe('Hours by server name');
    expect(playtimeCopy.formatSplitOverlapNote('SERVER_NAME')).toBe(
      'Hours by server name can add up to more than the All total, because All also merges sessions that overlap across different server names.',
    );
    expect(playtimeCopy.formatSplitOverlapNote('CLIENT_PLATFORM')).toBe(
      'Hours by client platform can add up to more than the All total, because All also merges sessions that overlap across different client platforms.',
    );
    // 04-15. GAME needs no formatter of its own: the caption and the note are
    // built from the one label table, so adding the column to it gave these
    // two strings. They are pinned here because the split table's heading and
    // its whole reason for existing both read "game" on a real export.
    expect(playtimeCopy.formatSplitColumnLower('GAME')).toBe('game');
    expect(playtimeCopy.formatSplitCaption('GAME')).toBe('Hours by game');
    expect(playtimeCopy.formatSplitOverlapNote('GAME')).toBe(
      'Hours by game can add up to more than the All total, because All also merges sessions that overlap across different games.',
    );
  });

  test('the overflow row names how many values the selector still holds', () => {
    // "New copy" table, Split table overflow row: `{n} more in the selector`
    // (`1 more in the selector`).
    expect(playtimeCopy.formatSplitOverflowRow(1)).toBe('1 more in the selector');
    expect(playtimeCopy.formatSplitOverflowRow(12)).toBe('12 more in the selector');
    expect(playtimeCopy.formatSplitOverflowRow(1204)).toBe('1,204 more in the selector');
  });

  test('the excluded pill is pluralised, grouped, and never reads zero', () => {
    // "New copy" table, Excluded pill row. The empty string for zero is a
    // decision, not an oversight: a conditional in a component is a place for
    // "0 session rows excluded" to reach a user, and the UI-SPEC says it never
    // renders.
    expect(playtimeCopy.formatExcludedPill(0)).toBe('');
    expect(playtimeCopy.formatExcludedPill(1)).toBe('1 session row excluded');
    expect(playtimeCopy.formatExcludedPill(2)).toBe('2 session rows excluded');
    expect(playtimeCopy.formatExcludedPill(1204)).toBe('1,204 session rows excluded');
  });

  test('the year head summary states hours, sessions and active days together', () => {
    // "New copy" table, Year head summary row.
    expect(playtimeCopy.formatYearSummary(151200, 1203, 201)).toBe(
      '42 hours · 1,203 sessions · 201 active days',
    );
    expect(playtimeCopy.formatYearSummary(3600, 1, 1)).toBe('1 hour · 1 session · 1 active day');
  });

  test('a run of empty years collapses into one line', () => {
    // "New copy" table, Empty year run row: `{yyyy}-{yyyy}: no sessions
    // recorded` / `{yyyy}: no sessions recorded`.
    expect(playtimeCopy.formatEmptyYearRun(2011, 2013)).toBe('2011-2013: no sessions recorded');
    expect(playtimeCopy.formatEmptyYearRun(2012, 2012)).toBe('2012: no sessions recorded');
  });

  test("a year's grid is named for the year it draws", () => {
    // UI-SPEC section 5, Accessible structure: `aria-label="Playtime calendar
    // {year}"`. Without the year a screen-reader user moving between the year
    // grids hears a name that is identical on all of them and has no way to
    // tell which year they are standing in — the one fact the roving focus
    // exists to move through.
    expect(playtimeCopy.formatCalendarYearLabel(2019)).toBe('Playtime calendar 2019');
    expect(playtimeCopy.formatCalendarYearLabel(2024)).toBe('Playtime calendar 2024');
    // The boundaries the calendar has to survive: a stray 1970 row (T-04-08)
    // and a far-future one both draw a grid, and neither may be truncated or
    // padded into a five-digit year.
    expect(playtimeCopy.formatCalendarYearLabel(1970)).toBe('Playtime calendar 1970');
    expect(playtimeCopy.formatCalendarYearLabel(9999)).toBe('Playtime calendar 9999');
  });

  test('the legend note omits the Darkest sentence when only one level is in use', () => {
    // "New copy" table, Legend note row. `null` is the one-level case, which
    // is why the parameter is nullable rather than 0: a zero boundary is not
    // the same statement as an absent one.
    expect(playtimeCopy.formatCalendarLegendNote(null)).toBe(
      'Shades rank your active days, so ordinary days stay distinguishable from outliers.',
    );
    expect(playtimeCopy.formatCalendarLegendNote(5400)).toBe(
      'Shades rank your active days, so ordinary days stay distinguishable from outliers. Darkest: more than 1.5 hours.',
    );
    expect(playtimeCopy.formatHourGridLegendNote(null)).toBe(
      'Shades rank the busiest hours of the week.',
    );
    expect(playtimeCopy.formatHourGridLegendNote(5400)).toBe(
      'Shades rank the busiest hours of the week. Darkest: more than 1.5 hours.',
    );
  });

  test('a duration row states its count and its share of sessions', () => {
    // "New copy" table, Duration row text row: `{n} · {p}%` (`<1%` for a
    // non-zero share under 0.5%; `0` for an empty bin). A 0% row for a bin
    // that holds sessions would be a rounding lie, hence `<1%`.
    expect(playtimeCopy.formatDurationRowText(0, 100)).toBe('0');
    expect(playtimeCopy.formatDurationRowText(5, 100)).toBe('5 · 5%');
    expect(playtimeCopy.formatDurationRowText(1, 1000)).toBe('1 · <1%');
    expect(playtimeCopy.formatDurationRowText(4, 1000)).toBe('4 · <1%');
    expect(playtimeCopy.formatDurationRowText(5, 1000)).toBe('5 · 1%');
    expect(playtimeCopy.formatDurationRowText(12345, 68583)).toBe('12,345 · 18%');
  });

  test('the live region announces the new selection in full', () => {
    // "New copy" table, Selection announcement row: `Showing {value}: {hours},
    // {n} sessions, {d} active days.` For All: `Showing all sessions: …`.
    expect(playtimeCopy.formatSelectionAnnouncement(null, 5430, 3, 2)).toBe(
      'Showing all sessions: 1.5 hours, 3 sessions, 2 active days.',
    );
    expect(playtimeCopy.formatSelectionAnnouncement('eu-1', 12630, 4, 3)).toBe(
      'Showing eu-1: 3.5 hours, 4 sessions, 3 active days.',
    );
  });

  test('the announcement and the year head state the same numbers the same way', () => {
    // The live region and the static caption describe the same slice. If they
    // diverged, a screen-reader user and a sighted user would be told
    // different things about the same selection.
    expect(playtimeCopy.formatSelectionAnnouncement(null, 151200, 1203, 201)).toContain(
      playtimeCopy.formatYearSummary(151200, 1203, 201).replaceAll(' · ', ', '),
    );
  });
});

// =============================================================================
// Phase 4 date, tooltip and accessible-name formatters (04-04-PLAN Task 3)
// =============================================================================
//
// Everything a chart shows that is not a count: weekday and month names, the
// date in a calendar cell, the two tooltip lines, the hour-axis labels and the
// accessible names of 224 grid cells. These are the strings a screen reader
// hears, so they are built from the recorded date parts rather than from a
// locale-sensitive formatter — D-01 dates the cells exactly as the export
// records them, and a `toLocaleDateString` would additionally re-date them in
// the viewer's timezone, which is the one thing the basis caption promises
// does not happen.
//
// The expected day indexes below are computed with Date.UTC in THIS file,
// independently of civil-date.ts. A test that imported the implementation's own
// day arithmetic would pass if that arithmetic were wrong in both places.
describe('Phase 4 date, tooltip and accessible-name formatters', () => {
  /** Days since 1970-01-01, computed without civil-date.ts. */
  const dayIndex = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d) / 86_400_000;

  test('the weekday and month name tables are complete and Monday-first', () => {
    // UI-SPEC: "Weekday names are the full English names in tooltips and the
    // three-letter forms on the axes; month names … are the three-letter
    // English forms."
    expect(playtimeCopy.WEEKDAY_SHORT).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(playtimeCopy.WEEKDAY_LONG).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(playtimeCopy.MONTH_SHORT).toEqual([
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
    ]);
  });

  test('a calendar date is weekday, month, day and year, from recorded parts', () => {
    expect(playtimeCopy.formatCalendarDate(dayIndex(2019, 3, 3))).toBe('Sun, Mar 3, 2019');
    // A leap day, and the epoch itself, so a hard-coded year cannot pass.
    expect(playtimeCopy.formatCalendarDate(dayIndex(2020, 2, 29))).toBe('Sat, Feb 29, 2020');
    expect(playtimeCopy.formatCalendarDate(dayIndex(1970, 1, 1))).toBe('Thu, Jan 1, 1970');
  });

  test('a date before 1970 still formats (day indexes are signed)', () => {
    expect(playtimeCopy.formatCalendarDate(dayIndex(1969, 12, 31))).toBe('Wed, Dec 31, 1969');
  });

  test('a calendar date does not move with the process timezone', () => {
    // D-01: the cells are the export's dates, and the basis caption promises
    // they are not converted. A formatter that went through `new Date(...)` or
    // `toLocaleDateString` would shift the date for a reader west of UTC and
    // quietly break that promise, so this asserts the property directly: the
    // same day index, under UTC+14 and UTC-8, formats identically.
    const original = process.env.TZ;
    const index = dayIndex(2019, 3, 3);
    try {
      for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles']) {
        process.env.TZ = tz;
        expect(playtimeCopy.formatCalendarDate(index)).toBe('Sun, Mar 3, 2019');
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  test('the calendar tooltip states hours and sessions, keyed off sessions', () => {
    // "New copy" table, Calendar tooltip line 2 row: `{hours} · {n} sessions`
    // (`1 session`) or `No sessions`.
    //
    // Research Pitfall 4: a day can have sessions and no playtime (a session
    // with a zero-length span that still parsed), so "No sessions" must key
    // off the COUNT, not off the seconds. Keying off the seconds would print
    // "0 min · 1 session" here.
    expect(playtimeCopy.formatCalendarTooltipLine2(5400, 4)).toBe('1.5 hours · 4 sessions');
    expect(playtimeCopy.formatCalendarTooltipLine2(0, 1)).toBe('0 min · 1 session');
    expect(playtimeCopy.formatCalendarTooltipLine2(60, 1)).toBe('1 min · 1 session');
    expect(playtimeCopy.formatCalendarTooltipLine2(0, 0)).toBe('No sessions');
  });

  test('the calendar cell announces its date before its value', () => {
    // "New copy" table, Calendar cell accessible name row: `{Sun, Mar 3,
    // 2019}: {hours}, {n} sessions` or `{Sun, Mar 3, 2019}: no sessions`.
    const day = dayIndex(2019, 3, 3);
    expect(playtimeCopy.formatCalendarCellLabel(day, 5400, 4)).toBe(
      'Sun, Mar 3, 2019: 1.5 hours, 4 sessions',
    );
    expect(playtimeCopy.formatCalendarCellLabel(day, 0, 0)).toBe('Sun, Mar 3, 2019: no sessions');
  });

  test('an hour axis label is two digits and :00', () => {
    // "New copy" table, Weekday × hour tooltip line 1 row: `{HH}:00`, e.g.
    // `21:00`.
    expect(playtimeCopy.formatHourLabel(0)).toBe('00:00');
    expect(playtimeCopy.formatHourLabel(9)).toBe('09:00');
    expect(playtimeCopy.formatHourLabel(21)).toBe('21:00');
  });

  test('an hour cell names its weekday and its one-hour span', () => {
    // "New copy" table, Weekday × hour tooltip line 1 row: `{Weekday},
    // {HH}:00-{HH+1}:00` e.g. `Tuesday, 21:00-22:00` (hour 23 reads
    // `23:00-24:00`). The 24:00 is not a 25th hour: the span ENDS at midnight.
    expect(playtimeCopy.formatHourCellLine1(1, 21)).toBe('Tuesday, 21:00-22:00');
    expect(playtimeCopy.formatHourCellLine1(6, 23)).toBe('Sunday, 23:00-24:00');
  });

  test('an hour cell states what was played, and the basis changes only that', () => {
    // "New copy" table, Weekday × hour tooltip line 2 row: `{hours} played` or
    // `No sessions`. The grid stores seconds only, so under BOTH bases a
    // zero-second cell is genuinely "No sessions" — with no count to key off,
    // seconds are all there is.
    expect(playtimeCopy.formatHourCellLine2(151200, 'overlap')).toBe('42 hours played');
    expect(playtimeCopy.formatHourCellLine2(0, 'overlap')).toBe('No sessions');
    expect(playtimeCopy.formatHourCellLine2(151200, 'start')).toBe(
      '42 hours played in sessions starting this hour',
    );
    expect(playtimeCopy.formatHourCellLine2(0, 'start')).toBe('No sessions');
  });

  test('an hour cell announces its span before its value', () => {
    const label = playtimeCopy.formatHourCellLabel(1, 21, 151200, 'overlap');
    expect(label).toBe('Tuesday, 21:00-22:00: 42 hours played');
    expect(playtimeCopy.formatHourCellLabel(6, 23, 0, 'overlap')).toBe(
      'Sunday, 23:00-24:00: No sessions',
    );
  });

  test('the start-basis note is only shown when the basis is start', () => {
    // Planner-authored (Plan 04-04 flag): the UI-SPEC gives the tooltip swap
    // for the `start` basis but no caption wording for it, so this one
    // sentence is this plan's to word. It is a constant rather than a branch
    // because HOUR_GRID_BASIS is currently `overlap` and must not be written
    // by this plan — the decision is still open.
    expect(playtimeCopy.HOUR_GRID_START_BASIS_NOTE).toBe(
      'Each session is counted in the weekday and hour it starts.',
    );
  });

  test('no formatter output can be mistaken for an IP address', () => {
    // A dot-separated group of numbers is what an IP looks like, and the
    // duration row text ("12,345 · 18%") and the date text ("Sun, Mar 3,
    // 2019") both contain digits and dots. This is a cheap tripwire against a
    // future formatter reaching for a numeric type's default `toString` or an
    // unformatted float, both of which can emit a bare dotted quad.
    const IP_SHAPED = /\b\d{1,3}(\.\d{1,3}){3}\b/;
    for (let seconds = 0; seconds <= 40000; seconds += 997) {
      expect(playtimeCopy.formatHours(seconds)).not.toMatch(IP_SHAPED);
      expect(playtimeCopy.formatCalendarTooltipLine2(seconds, 3)).not.toMatch(IP_SHAPED);
      expect(playtimeCopy.formatHourCellLine2(seconds, 'overlap')).not.toMatch(IP_SHAPED);
      expect(playtimeCopy.formatDurationRowText(seconds, 40000)).not.toMatch(IP_SHAPED);
    }
    expect(playtimeCopy.formatCalendarDate(dayIndex(2019, 3, 3))).not.toMatch(IP_SHAPED);
  });
});

// =============================================================================
// 05-08 tracer: number grouping follows the VIEWER's locale (D-25)
// =============================================================================
//
// Phase 4 pinned `formatNumber` to `en-US` so the 04-UI-SPEC's literal examples
// would render as written. The user later decided (05-UI-SPEC, the "data" row
// in UI Considerations, and CONTEXT D-25) that grouping follows the viewer's
// locale so the whole page speaks one grouping style — which means the
// machine's locale stops being the tests' business and the TESTS become the
// thing that is pinned.
//
// The shape of the change is deliberately small and one-directional:
//
//   - production default is `undefined`, which is the platform's own locale
//     (the browser's, in the app);
//   - a single exported seam pins it, and the setup file calls that seam with
//     `en-US` so every expectation in this file is written in one grouping;
//   - a source-level test holds the seam unreachable from application code,
//     because a locale that application code can change is a locale the user
//     cannot rely on.
//
// The two source-level tests are the point of the tracer. A number formatter
// that reads the environment is the exact defect these two assertions exist to
// make impossible: one on the production side, one on the test side.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Every source file under `src/`, as repo-relative posix paths. */
function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(REPO_ROOT, dir), { recursive: true })) {
    if (typeof entry !== 'string') continue;
    if (!/\.(ts|svelte)$/.test(entry)) continue;
    out.push(`${dir}/${entry.split(path.sep).join('/')}`);
  }
  return out;
}

describe('05-08 tracer: viewer-locale number grouping', () => {
  // The setup file pins en-US once for this file; a test that changes the
  // default has to put it back, or the grouped-number expectations of every
  // later test would depend on this describe's order.
  afterEach(() => {
    playtimeCopy.setDefaultNumberLocale('en-US');
  });

  test('exposes setDefaultNumberLocale as the single test seam', () => {
    // THE target behaviour of this tracer. Without the seam nothing below can
    // be expressed: the default has to be changeable from a test and from
    // nowhere else.
    expect(typeof playtimeCopy.setDefaultNumberLocale).toBe('function');
  });

  test('groups by the default locale the seam pinned', () => {
    playtimeCopy.setDefaultNumberLocale('de-DE');
    expect(playtimeCopy.formatNumber(1234567)).toBe('1.234.567');
    playtimeCopy.setDefaultNumberLocale('en-US');
    expect(playtimeCopy.formatNumber(1234567)).toBe('1,234,567');
  });

  test('an explicit locale argument wins over the default', () => {
    playtimeCopy.setDefaultNumberLocale('de-DE');
    expect(playtimeCopy.formatNumber(1234567, 'en-US')).toBe('1,234,567');
  });

  test('the two row-count formatters follow the same default', () => {
    // These two are the reason the deferred `formatImportSummary` failure
    // existed at all: they grouped with the ambient locale instead of going
    // through the one formatter, so they are pinned in the same edit.
    playtimeCopy.setDefaultNumberLocale('de-DE');
    expect(playtimeCopy.formatRowCount(1234)).toBe('1.234 rows');
    expect(playtimeCopy.formatSkippedRowCount(1234)).toBe('1.234 rows skipped');
  });

  test('only the copy module mentions the locale seam', () => {
    // T-05-24. Application code that could reach this setter would be able to
    // change how every number on the page groups, for a user who did not ask
    // for it. The seam is a test facility and nothing else.
    const offenders = sourceFilesUnder('src').filter((file) =>
      readFileSync(path.join(REPO_ROOT, file), 'utf8').includes('setDefaultNumberLocale'),
    );
    expect(offenders).toEqual(['src/lib/ui-copy.ts']);
  });

  test('every e2e spec that formats numbers in Node also pins the locale', () => {
    // A spec that calls a formatter in Node against text the browser rendered
    // compares two independently-grouped numbers. Pinning the browser in
    // playwright.config.ts is not enough: the Node side has its own default,
    // which is whatever the machine running the suite happens to be set to.
    const e2eDir = path.join(REPO_ROOT, 'tests/e2e');
    const specs = readdirSync(e2eDir, { recursive: true }).filter(
      (name): name is string => typeof name === 'string' && name.endsWith('.spec.ts'),
    );
    expect(specs.length).toBeGreaterThan(0);
    const unpinned = specs.filter((name) => {
      const source = readFileSync(path.join(e2eDir, name), 'utf8');
      return source.includes('ui-copy') && !source.includes('_support/pin-locale');
    });
    expect(unpinned).toEqual([]);
  });
});

// =============================================================================
// 05-08 Task 3: the whole Phase 5 copy inventory
// =============================================================================
//
// Plans 05-10 to 05-15 build components in parallel waves and must not edit
// ui-copy.ts concurrently, so the complete inventory lands here first and every
// later plan is a pure consumer. That only works if the wording is pinned to
// the approved UI-SPEC, so every constant below is asserted against a literal
// copied from a named spec table row, with the row named in the comment.
//
// Each describe group names the spec table its literals come from. A wording
// change in the spec is a deliberate act that has to edit these tests too,
// which is the point: there is one authority, and it is the spec.
//
// The month fixtures use `monthIndex(year, month)` from finance-shared rather
// than a literal, because the index arithmetic is the shared module's contract
// and hard-coding `2019 * 12 + 2` here would assert the arithmetic twice.
// =============================================================================

describe('05-08 shared formatters', () => {
  test('formatCompactNumber renders the spec example the formatter can produce', () => {
    // RESEARCH Pitfall 6 / UI-SPEC section 9: 26,986,204 is 27M at one fraction
    // digit, never 26.9M. The spec was corrected in 05-08; these two values are
    // the pair that pins it.
    expect(playtimeCopy.formatCompactNumber(26986204, 'en-US')).toBe('27M');
    expect(playtimeCopy.formatCompactNumber(26100000, 'en-US')).toBe('26.1M');
    expect(playtimeCopy.formatCompactNumber(0, 'en-US')).toBe('0');
  });

  test('a negative compact label is the real minus then the magnitude', () => {
    // U+2212 MINUS SIGN, not the ASCII hyphen: the y-axis label sits next to a
    // digit and a hyphen is both shorter and a different character to a reader
    // with a screen reader that announces it.
    expect(playtimeCopy.formatCompactNumber(-26986204, 'en-US')).toBe('−27M');
    expect(playtimeCopy.formatCompactNumber(-26986204, 'en-US')).toContain('−');
  });

  test('formatPercent is one decimal and a percent sign', () => {
    // UI-SPEC Formatting: "Win rate, hit ratio, survival rate | One decimal and
    // % (55.3%)". The input is already a percentage, not a 0-1 ratio.
    expect(playtimeCopy.formatPercent(55.333, 'en-US')).toBe('55.3%');
    expect(playtimeCopy.formatPercent(100, 'en-US')).toBe('100.0%');
    expect(playtimeCopy.formatPercent(0, 'en-US')).toBe('0.0%');
  });

  test('formatWholeNumber rounds then groups', () => {
    // The average-damage column: an average that displays without a decimal.
    expect(playtimeCopy.formatWholeNumber(714.28, 'en-US')).toBe('714');
    expect(playtimeCopy.formatWholeNumber(1234.5, 'en-US')).toBe('1,235');
  });

  test('formatMonthLabel is YYYY-MM from the index, with no Date', () => {
    // D-26: built from the month index with integer arithmetic, never through
    // the viewer's timezone. A Date here would shift a month for any viewer
    // west of UTC.
    expect(playtimeCopy.formatMonthLabel(monthIndex(2019, 3))).toBe('2019-03');
    expect(playtimeCopy.formatMonthLabel(monthIndex(2001, 12))).toBe('2001-12');
    expect(playtimeCopy.formatMonthLabel(monthIndex(1970, 1))).toBe('1970-01');
  });

  test('formatPremiumDays is whole or one decimal, unit keyed on the numeral', () => {
    // UI-SPEC Formatting: "Premium days | Integer when whole, otherwise one
    // decimal; unit day when the rendered numeral is exactly 1, else days".
    expect(playtimeCopy.formatPremiumDays(86400, 'en-US')).toBe('1 day');
    expect(playtimeCopy.formatPremiumDays(172800, 'en-US')).toBe('2 days');
    expect(playtimeCopy.formatPremiumDays(216000, 'en-US')).toBe('2.5 days');
    expect(playtimeCopy.formatPremiumDays(2721600, 'en-US')).toBe('31.5 days');
  });

  test('a premium amount that rounds to nothing never renders as 0.0 days', () => {
    // 90 seconds is 0.001 days. The trailing `.0` a one-decimal format leaves
    // behind is noise, and "0.0 days" reads as a measured value rather than
    // as nothing.
    expect(playtimeCopy.formatPremiumDays(90, 'en-US')).toBe('0 days');
    expect(playtimeCopy.formatPremiumDays(90, 'en-US')).not.toContain('0.0');
  });

  test('formatMoney is the code as written, a space, and exactly two decimals', () => {
    // UI-SPEC Formatting: "Money | Code as written, a space, then the amount
    // with exactly two decimals (USD 1,234.56); never a symbol, never
    // converted". 15,495,000 micro-units is 15.495 and rounds to 15.50.
    expect(playtimeCopy.formatMoney('USD', 15495000n, 'en-US')).toBe('USD 15.50');
    // The code's case is the export's, never normalised to upper case.
    expect(playtimeCopy.formatMoney('usd', 3000000n, 'en-US')).toBe('usd 3.00');
  });

  test('a null currency code gives the bare amount with no unit', () => {
    // UI-SPEC Unknown currency: orders with no valid code "have no unit and may
    // mix different currencies", so a code is never invented.
    expect(playtimeCopy.formatMoney(null, 13340000n, 'en-US')).toBe('13.34');
  });

  test('formatMoney never emits a currency symbol', () => {
    for (const [code, units] of [
      ['USD', 15495000n],
      ['EUR', 1n],
      ['JPY', 123456789n],
    ] as const) {
      expect(playtimeCopy.formatMoney(code, units, 'en-US')).not.toMatch(/[$€£¥]/);
    }
  });

  test('formatFlowAmount is exact and grouped, never compacted', () => {
    // The monthly table and the tooltip carry the exact figure; only the axis
    // is compact (UI-SPEC section 9).
    expect(playtimeCopy.formatFlowAmount(30435000000000n, 'en-US')).toBe('30,435,000');
  });
});

describe('05-08 vehicle statistics copy', () => {
  // UI-SPEC "New copy" rows: Player sub-heading, Loading / Updating, Game
  // control, Battle type control, Search, Per-title header labels, Special
  // values, Garage values, Column headers, Column picker, Count line,
  // No search match, Derived-value note, Warships all-battles note,
  // Battle-type notes, Battle-type summary, Warplanes 20 note, Table title
  // and hints, Table accessible name, Selection announcement.
  test('the block headings and loading strings', () => {
    expect(playtimeCopy.PLAYER_STATS_HEADING).toBe('Vehicle statistics');
    expect(playtimeCopy.PLAYER_STATS_LOADING).toBe('Calculating vehicle statistics...');
    expect(playtimeCopy.PLAYER_STATS_UPDATING).toBe('Updating table...');
    expect(playtimeCopy.PLAYER_STATS_ERROR).toBe(
      'Vehicle statistics could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.',
    );
  });

  test('the control labels', () => {
    expect(playtimeCopy.TITLE_CONTROL_LABEL).toBe('Game');
    expect(playtimeCopy.BATTLE_TYPE_CONTROL_LABEL).toBe('Battle type');
    expect(playtimeCopy.BATTLE_TYPE_ALL_OPTION).toBe('All battles');
    expect(playtimeCopy.VEHICLE_SEARCH_LABEL).toBe('Search vehicles');
    expect(playtimeCopy.HEADER_LIFETIME_BATTLES_LABEL).toBe('Lifetime battles');
    expect(playtimeCopy.HEADER_PREMIUM_EXPIRES_LABEL).toBe('Premium expires');
  });

  test('every game title has its label', () => {
    // UI-SPEC Game control: WoT / WoT Blitz / Warships / Warplanes.
    expect(playtimeCopy.VEHICLE_TITLE_LABELS).toEqual({
      wot: 'WoT',
      wotb: 'WoT Blitz',
      wows: 'Warships',
      wowp: 'Warplanes',
    });
  });

  test('a title option carries the absent and empty suffixes, and neither when ready', () => {
    expect(playtimeCopy.formatTitleOption('wowp', 'not-in-export')).toBe(
      'Warplanes (not in this export)',
    );
    expect(playtimeCopy.formatTitleOption('wowp', 'no-rows')).toBe(
      'Warplanes (no rows in this export)',
    );
    expect(playtimeCopy.formatTitleOption('wowp', 'ready')).toBe('Warplanes');
  });

  test('a battle type is numbered, never named', () => {
    // UI-SPEC: "Battle types are numbered in the export but not named, so they
    // are shown as "Battle type N"." No lookup, ever.
    expect(playtimeCopy.formatBattleTypeLabel('3')).toBe('Battle type 3');
  });

  test('the special cell values and their hidden text', () => {
    // UI-SPEC Special values: `not defined` (N/D) · `not available` (N/A) ·
    // `not in export` (missing column) · — with hidden `no battles` /
    // `no shots` · `Available per battle type`.
    expect(playtimeCopy.VALUE_NOT_DEFINED).toBe('not defined');
    expect(playtimeCopy.VALUE_NOT_AVAILABLE).toBe('not available');
    expect(playtimeCopy.VALUE_NOT_IN_EXPORT).toBe('not in export');
    expect(playtimeCopy.VALUE_DASH).toBe('—');
    expect(playtimeCopy.VALUE_NO_BATTLES_HIDDEN).toBe('no battles');
    expect(playtimeCopy.VALUE_NO_SHOTS_HIDDEN).toBe('no shots');
    expect(playtimeCopy.VALUE_PER_BATTLE_TYPE).toBe('Available per battle type');
    expect(playtimeCopy.GARAGE_YES).toBe('Yes');
    expect(playtimeCopy.GARAGE_NO).toBe('No');
  });

  test('every column has a header label, under the worker’s own column key', () => {
    // The UI-SPEC Column headers row, verbatim, in order — and keyed by the
    // worker's `VehicleColumn.key` rather than by a slug of our own. 05-12
    // found the difference the only way it could be found: the table is the
    // first place the two vocabularies meet, and a key the inventory does not
    // know falls through to printing the key itself, so a column headed
    // `winRate` appeared where `Win rate` was specified.
    expect(playtimeCopy.VEHICLE_COLUMN_LABELS).toEqual({
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
    });
  });

  test('the column picker and the table hints', () => {
    expect(playtimeCopy.COLUMN_PICKER_SUMMARY).toBe('Choose columns');
    expect(playtimeCopy.COLUMN_PICKER_LEGEND).toBe('Extra columns');
    expect(playtimeCopy.VEHICLE_TABLE_TITLE).toBe('Vehicles');
    expect(playtimeCopy.VEHICLE_SCROLL_HINT).toBe(
      'Focus the table, then use the arrow keys or Page Up and Page Down to scroll.',
    );
    expect(playtimeCopy.VEHICLE_FIND_HINT).toBe(
      "Only the rows on screen are loaded into the page, so use Search vehicles rather than your browser's find.",
    );
  });

  test('the count line has explicit singular forms and drops the zero part', () => {
    // UI-SPEC Count line: `{n} vehicles · {z} with no battles` (`1 vehicle`,
    // `1 with no battles`; the second part omitted at 0).
    expect(playtimeCopy.formatVehicleCount(1, 1, 'en-US')).toBe('1 vehicle · 1 with no battles');
    expect(playtimeCopy.formatVehicleCount(2, 1, 'en-US')).toBe('2 vehicles · 1 with no battles');
    expect(playtimeCopy.formatVehicleCount(5000, 0, 'en-US')).toBe('5,000 vehicles');
  });

  test('the searched count line', () => {
    expect(playtimeCopy.formatVehicleSearchCount(3, 5000, 'en-US')).toBe(
      '3 of 5,000 vehicles shown',
    );
  });

  test('the notes a reader needs before trusting a derived number', () => {
    expect(playtimeCopy.VEHICLE_NO_MATCH).toBe('No vehicles match your search.');
    expect(playtimeCopy.VEHICLE_DERIVED_NOTE).toBe(
      "Win rate and average damage are calculated here from the export's totals (wins ÷ battles, damage dealt ÷ battles).",
    );
    expect(playtimeCopy.WARSHIPS_ALL_NOTE).toBe(
      'Warships all-battles rows only record battles. Choose a battle type to see wins and damage.',
    );
    expect(playtimeCopy.BATTLE_TYPE_NOTE_TANKS).toBe(
      'Battle-type data covers only part of your battles, so these rows will not add up to the All battles totals.',
    );
    expect(playtimeCopy.BATTLE_TYPE_NOTE_WARSHIPS).toBe(
      'Each Warships battle is counted under two battle types, so rows from different battle types cannot be added together.',
    );
  });

  test('the battle-type summary table copy', () => {
    expect(playtimeCopy.BATTLE_TYPE_SUMMARY_HEADING).toBe('Battles by battle type');
    expect(playtimeCopy.BATTLE_TYPE_SUMMARY_CAPTION).toBe(
      'Battle types are numbered in the export but not named, so they are shown as "Battle type N".',
    );
    expect(playtimeCopy.BATTLE_TYPE_SUMMARY_DISCLOSURE).toBe('Battle types');
    expect(playtimeCopy.BATTLE_TYPE_SUMMARY_HEADERS).toEqual([
      'Battle type',
      'Battles',
      'Wins',
      'Damage dealt',
    ]);
    expect(playtimeCopy.BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS).toBe(
      'In Warships each battle is counted under two battle types, so these rows add up to more than your battle count.',
    );
  });

  test('the Warplanes 20 note has explicit singular and plural forms', () => {
    // UI-SPEC Warplanes 20 note, with both its parenthetical forms: `1 plane
    // record ... has`; `1 battle`.
    expect(playtimeCopy.formatWarplanes20Note(4, 8, 'en-US')).toBe(
      '4 plane records in the newer Warplanes file have no names in the export. They record 8 battles in total.',
    );
    expect(playtimeCopy.formatWarplanes20Note(1, 1, 'en-US')).toBe(
      '1 plane record in the newer Warplanes file has no names in the export. It records 1 battle in total.',
    );
  });

  test('the table accessible name and the selection announcement', () => {
    // UI-SPEC: `Vehicle statistics, {Title}, {battle type}` where the battle
    // type reads `all battles` or `Battle type {code}`.
    expect(playtimeCopy.formatVehicleRegionName('wot', null)).toBe(
      'Vehicle statistics, WoT, all battles',
    );
    expect(playtimeCopy.formatVehicleRegionName('wot', '3')).toBe(
      'Vehicle statistics, WoT, Battle type 3',
    );
    expect(playtimeCopy.formatVehicleAnnouncement('wot', null, 1, 'en-US')).toBe(
      'Showing WoT, all battles: 1 vehicle.',
    );
    expect(playtimeCopy.formatVehicleAnnouncement('wows', '12', 42, 'en-US')).toBe(
      'Showing Warships, Battle type 12: 42 vehicles.',
    );
  });

  test('the empty-state title helpers', () => {
    // UI-SPEC Empty state: `Warplanes is not in this export` and `This export
    // contains no vehicle rows for {Title}`.
    expect(playtimeCopy.formatTitleNotInExport('Warplanes')).toBe(
      'Warplanes is not in this export',
    );
    expect(playtimeCopy.formatTitleNoRows('Warplanes')).toBe(
      'This export contains no vehicle rows for Warplanes',
    );
  });

  test('formatVehicleCell maps every numeric kind exactly', () => {
    // D-25: count and whole are exact grouped, percent is one decimal with a
    // sign, text and date are as written, garage is Yes/No.
    expect(playtimeCopy.formatVehicleCell({ t: 'n', v: 1204 }, 'count', 'en-US')).toEqual({
      text: '1,204',
      muted: false,
      hidden: null,
    });
    expect(playtimeCopy.formatVehicleCell({ t: 'n', v: 714.28 }, 'whole', 'en-US')).toEqual({
      text: '714',
      muted: false,
      hidden: null,
    });
    expect(playtimeCopy.formatVehicleCell({ t: 'n', v: 55.33 }, 'percent', 'en-US')).toEqual({
      text: '55.3%',
      muted: false,
      hidden: null,
    });
  });

  test('a percent cell is NOT scaled again on the way out (05-14)', () => {
    // The worker's `derived` spec multiplies a ratio by 100 when it builds the
    // cell, so a `percent` cell's number is already the percentage. The
    // formatter used to multiply by 100 a second time, which is how a
    // Warplanes plane with 2 wins in 4 games reached a reader as `5,000.0%`.
    //
    // The assertion is a whole number precisely because it is the case the
    // double scale distorted most legibly, and because a formatter that scaled
    // again would turn the plan 05-14 answer key's 50.0% into 5,000.0%.
    expect(playtimeCopy.formatVehicleCell({ t: 'n', v: 50 }, 'percent', 'en-US')).toEqual({
      text: '50.0%',
      muted: false,
      hidden: null,
    });
    expect(playtimeCopy.formatVehicleCell({ t: 'n', v: 0.5 }, 'percent', 'en-US')).toEqual({
      text: '0.5%',
      muted: false,
      hidden: null,
    });
  });

  test('formatVehicleCell maps text, date and garage as written', () => {
    expect(playtimeCopy.formatVehicleCell({ t: 's', v: 'Ch24_Type64' }, 'text', 'en-US')).toEqual({
      text: 'Ch24_Type64',
      muted: false,
      hidden: null,
    });
    expect(
      playtimeCopy.formatVehicleCell(
        { t: 'd', v: '2019-03-04 11:22:33', k: 1551699753 },
        'date',
        'en-US',
      ),
    ).toEqual({ text: '2019-03-04 11:22:33', muted: false, hidden: null });
    expect(playtimeCopy.formatVehicleCell({ t: 'b', v: true }, 'garage', 'en-US')).toEqual({
      text: 'Yes',
      muted: false,
      hidden: null,
    });
    expect(playtimeCopy.formatVehicleCell({ t: 'b', v: false }, 'garage', 'en-US')).toEqual({
      text: 'No',
      muted: false,
      hidden: null,
    });
  });

  test('every special cell is muted, and the dash carries its hidden reason', () => {
    // A dash with no accessible text is a hole in the table: the reader is told
    // nothing is there and not what. The two dashes therefore carry hidden
    // text, and every special is muted so a real number never looks like one.
    for (const [key, text] of [
      ['nd', 'not defined'],
      ['na', 'not available'],
      ['missing', 'not in export'],
      ['per-type', 'Available per battle type'],
    ] as const) {
      expect(playtimeCopy.formatVehicleCell({ t: 'x', v: key }, 'count', 'en-US')).toEqual({
        text,
        muted: true,
        hidden: null,
      });
    }
    for (const [key, hidden] of [
      ['no-battles', 'no battles'],
      ['no-shots', 'no shots'],
    ] as const) {
      expect(playtimeCopy.formatVehicleCell({ t: 'x', v: key }, 'count', 'en-US')).toEqual({
        text: '—',
        muted: true,
        hidden,
      });
    }
  });
});

describe('05-08 financial data copy', () => {
  test('the sub-headings, loading and error strings', () => {
    // UI-SPEC: Financial sub-headings / Financial loading / Error state.
    expect(playtimeCopy.FINANCIAL_PREMIUM_HEADING).toBe('Premium time');
    expect(playtimeCopy.FINANCIAL_CURRENCY_HEADING).toBe('Virtual currency');
    expect(playtimeCopy.FINANCIAL_LOADING).toBe('Calculating financial data...');
    expect(playtimeCopy.FINANCIAL_ERROR).toBe(
      'Financial data could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.',
    );
    expect(playtimeCopy.FINANCIAL_NOT_IN_EXPORT).toBe('Not in this export');
  });

  test('the per-block empty state names the file that was missing', () => {
    // UI-SPEC Empty state body — Financial sub-blocks.
    expect(playtimeCopy.formatFinancialNoRows('premium')).toBe(
      'This export contains no rows for Premium time',
    );
    expect(playtimeCopy.formatFinancialNoRows('currency')).toBe(
      'This export contains no rows for Virtual currency',
    );
  });

  test('the nothing-usable bodies', () => {
    expect(playtimeCopy.PREMIUM_NO_USABLE).toBe(
      'No premium operations with a recognisable duration were found in this export.',
    );
    expect(playtimeCopy.CURRENCY_NO_USABLE).toBe(
      'No virtual-currency operations with a known type and a numeric amount were found in this export.',
    );
  });

  test('the exclusion explanations are the amended wording, verbatim', () => {
    // The two strings 05-08 amended the spec for: each names all three reasons
    // a row is left out, because a row dropped without being counted made the
    // pill disagree with the chart.
    expect(playtimeCopy.PREMIUM_EXCLUDED_EXPLANATION).toBe(
      'Rows whose premium value is not a recognisable duration or is a withdrawal, or whose date cannot be read, are not counted in the chart.',
    );
    expect(playtimeCopy.CURRENCY_EXCLUDED_EXPLANATION).toBe(
      'Operations with an unknown type, a non-numeric amount or a date that cannot be read are not counted in any chart or total below.',
    );
  });

  test('the premium summary sentence with explicit singular forms', () => {
    // UI-SPEC Premium summary, with `1 month` and `1 operation` singulars.
    expect(
      playtimeCopy.formatPremiumSummary(
        {
          monthsWithGrants: 1,
          spanMonths: 1,
          totalSeconds: 5 * 86400,
          grants: 1,
          peakMonth: monthIndex(2019, 3),
          peakSeconds: 5 * 86400,
        },
        'en-US',
      ),
    ).toBe(
      'Premium time was granted in 1 of 1 months: 5 days in total across 1 operation. The largest month was 2019-03 with 5 days.',
    );
  });

  test('the premium summary over several months', () => {
    expect(
      playtimeCopy.formatPremiumSummary(
        {
          monthsWithGrants: 2,
          spanMonths: 5,
          totalSeconds: 5 * 86400,
          grants: 3,
          peakMonth: monthIndex(2019, 3),
          peakSeconds: 3 * 86400,
        },
        'en-US',
      ),
    ).toBe(
      'Premium time was granted in 2 of 5 months: 5 days in total across 3 operations. The largest month was 2019-03 with 3 days.',
    );
  });

  test('the premium excluded pill has explicit singular and plural, and is empty at zero', () => {
    // The pill is never rendered at zero, so zero is the empty string and the
    // component has one condition to write rather than two.
    expect(playtimeCopy.formatPremiumExcludedPill(0, 'en-US')).toBe('');
    expect(playtimeCopy.formatPremiumExcludedPill(1, 'en-US')).toBe('1 premium row excluded');
    expect(playtimeCopy.formatPremiumExcludedPill(7, 'en-US')).toBe('7 premium rows excluded');
  });

  test('the operation and paid-order pills follow the same pattern', () => {
    expect(playtimeCopy.formatOperationExcludedPill(0, 'en-US')).toBe('');
    expect(playtimeCopy.formatOperationExcludedPill(1, 'en-US')).toBe('1 operation row excluded');
    expect(playtimeCopy.formatOperationExcludedPill(4, 'en-US')).toBe('4 operation rows excluded');
    expect(playtimeCopy.formatPaidExcludedPill(0, 'en-US')).toBe('');
    expect(playtimeCopy.formatPaidExcludedPill(1, 'en-US')).toBe('1 paid order excluded');
    expect(playtimeCopy.formatPaidExcludedPill(3, 'en-US')).toBe('3 paid orders excluded');
  });

  test('the disclosure is the renamed heading, with its overflow line', () => {
    // 05-08 renamed this: it lists excluded values, and a withdrawal's premium
    // string is perfectly readable, so the old heading was false.
    expect(playtimeCopy.formatPremiumUnrecognisedDisclosure(3)).toBe(
      'Premium values not charted (3)',
    );
    expect(playtimeCopy.formatUnrecognisedOverflow(12)).toBe('and 12 more');
  });

  test('the currency block caption, legend and other-currencies copy', () => {
    expect(playtimeCopy.CURRENCY_BLOCK_CAPTION).toBe(
      'Each currency has its own scale, so bar heights cannot be compared between charts. Dates are as recorded in the export.',
    );
    expect(playtimeCopy.FLOW_LEGEND_DEPOSITED).toBe('Deposited (above the line)');
    expect(playtimeCopy.FLOW_LEGEND_WITHDRAWN).toBe('Withdrawn (below the line)');
    expect(playtimeCopy.OTHER_CURRENCIES_HEADING).toBe('Other currencies');
    expect(playtimeCopy.OTHER_CURRENCIES_CAPTION).toBe(
      'These currencies have too few operations for a chart.',
    );
    expect(playtimeCopy.CURRENCY_BLANK_CODE).toBe('(not recorded)');
  });

  test('the currency summary reads "in {month}" when the span is one month', () => {
    // UI-SPEC Currency summary: `1 operation`; a single month reads
    // `in {YYYY-MM}`.
    expect(
      playtimeCopy.formatCurrencySummary(
        {
          inUnits: 30435000000000n,
          outUnits: 0n,
          ops: 1,
          firstMonth: monthIndex(2019, 3),
          lastMonth: monthIndex(2019, 3),
        },
        'en-US',
      ),
    ).toBe('Deposited 30,435,000 and withdrew 0 across 1 operation, in 2019-03.');
  });

  test('the currency summary over a span', () => {
    expect(
      playtimeCopy.formatCurrencySummary(
        {
          inUnits: 1000000n,
          outUnits: 2500000n,
          ops: 9,
          firstMonth: monthIndex(2019, 1),
          lastMonth: monthIndex(2019, 7),
        },
        'en-US',
      ),
    ).toBe('Deposited 1 and withdrew 2.5 across 9 operations, from 2019-01 to 2019-07.');
  });

  test('an uncharted currency row, with the single-month and 1-operation forms', () => {
    // UI-SPEC Other currencies: a single month shows `{ym}`; `1 operation`.
    expect(
      playtimeCopy.formatOtherCurrencyRow(
        {
          code: 'UAH',
          inUnits: 0n,
          outUnits: 0n,
          ops: 1,
          firstMonth: monthIndex(2019, 5),
          lastMonth: monthIndex(2019, 5),
        },
        'en-US',
      ),
    ).toBe('Deposited 0 · Withdrawn 0 · 2019-05 · 1 operation');
  });

  test('the chart chrome strings', () => {
    expect(playtimeCopy.PREMIUM_CHART_TITLE).toBe('Premium days granted per month');
    expect(playtimeCopy.MONTHLY_TABLE_DISCLOSURE).toBe('Monthly data table');
    expect(playtimeCopy.PREMIUM_TABLE_HEADERS).toEqual(['Month', 'Days granted', 'Grants']);
    expect(playtimeCopy.CURRENCY_TABLE_HEADERS).toEqual([
      'Month',
      'Deposited',
      'Withdrawn',
      'Operations',
    ]);
    expect(playtimeCopy.BAR_CHART_BASIS_CAPTION).toBe('Dates are as recorded in the export.');
    expect(playtimeCopy.BAR_CHART_KEYBOARD_HINT).toBe(
      'Use the left and right arrow keys to move between months.',
    );
    expect(playtimeCopy.TOOLTIP_BASIS_LINE).toBe('Dates as recorded in the export');
  });

  test('the premium tooltip: month, grant line, one sizes line, then the basis', () => {
    // UI-SPEC Premium tooltip. March 2019: 5 days across 3 grants, sized one day
    // twice and three days once.
    expect(
      playtimeCopy.formatPremiumTooltip(
        {
          month: monthIndex(2019, 3),
          seconds: 5 * 86400,
          grants: 3,
          sizes: [
            [86400, 2],
            [3 * 86400, 1],
          ],
          moreSizes: 0,
        },
        'en-US',
      ),
    ).toEqual({
      line1: '2019-03',
      line2: '5 days granted · 3 grants',
      extra: ['1 day × 2, 3 days × 1', 'Dates as recorded in the export'],
    });
  });

  test('dropped sizes leave a trailing count, and an empty month is one line', () => {
    // Four sizes, three shown: the reader is told four existed rather than
    // shown a list that silently stops.
    expect(
      playtimeCopy.formatPremiumTooltip(
        {
          month: monthIndex(2019, 7),
          seconds: 10 * 86400,
          grants: 4,
          sizes: [
            [86400, 1],
            [2 * 86400, 1],
            [3 * 86400, 1],
          ],
          moreSizes: 1,
        },
        'en-US',
      ).extra[0],
    ).toBe('1 day × 1, 2 days × 1, 3 days × 1, +1 more sizes');

    expect(
      playtimeCopy.formatPremiumTooltip(
        { month: monthIndex(2019, 4), seconds: 0, grants: 0, sizes: [], moreSizes: 0 },
        'en-US',
      ),
    ).toEqual({
      line1: '2019-04',
      line2: 'No premium granted',
      extra: ['Dates as recorded in the export'],
    });
  });

  test('the currency tooltip carries both directions and the basis', () => {
    expect(
      playtimeCopy.formatCurrencyTooltip(
        {
          month: monthIndex(2019, 3),
          inUnits: 30435000000000n,
          outUnits: 1000000n,
          inOps: 2,
          outOps: 1,
        },
        'en-US',
      ),
    ).toEqual({
      line1: '2019-03',
      line2: 'Deposited 30,435,000 · 2 operations',
      extra: ['Withdrawn 1 · 1 operation', 'Dates as recorded in the export'],
    });
  });

  test('an empty currency month reads No operations and only the basis line', () => {
    expect(
      playtimeCopy.formatCurrencyTooltip(
        { month: monthIndex(2019, 4), inUnits: 0n, outUnits: 0n, inOps: 0, outOps: 0 },
        'en-US',
      ),
    ).toEqual({
      line1: '2019-04',
      line2: 'No operations',
      extra: ['Dates as recorded in the export'],
    });
  });

  test('the bar-chart cell accessible names carry the same facts as the tooltip', () => {
    // UI-SPEC Bar-chart cell accessible names. These are what a screen reader
    // announces for a focused month, so they restate the figures rather than
    // pointing at the tooltip the reader cannot see.
    expect(
      playtimeCopy.formatPremiumCellLabel(
        {
          month: monthIndex(2019, 3),
          seconds: 5 * 86400,
          grants: 3,
          sizes: [],
          moreSizes: 0,
        },
        'en-US',
      ),
    ).toBe('2019-03: 5 days granted, 3 grants');
    expect(
      playtimeCopy.formatPremiumCellLabel(
        { month: monthIndex(2019, 4), seconds: 0, grants: 0, sizes: [], moreSizes: 0 },
        'en-US',
      ),
    ).toBe('2019-04: no premium granted');
    expect(
      playtimeCopy.formatCurrencyCellLabel(
        {
          month: monthIndex(2019, 3),
          inUnits: 30435000000000n,
          outUnits: 0n,
          inOps: 2,
          outOps: 0,
        },
        'en-US',
      ),
    ).toBe('2019-03: deposited 30,435,000, withdrawn 0, 2 operations');
    expect(
      playtimeCopy.formatCurrencyCellLabel(
        { month: monthIndex(2019, 4), inUnits: 0n, outUnits: 0n, inOps: 0, outOps: 0 },
        'en-US',
      ),
    ).toBe('2019-04: no operations');
  });
});

describe('05-08 spend copy', () => {
  test('the sub-heading, intro, loading and error strings', () => {
    expect(playtimeCopy.SPEND_HEADING).toBe('Real-money spend');
    expect(playtimeCopy.SPEND_INTRO).toBe(
      'Only paid orders are totalled. Failed and new orders are counted separately. Each currency has its own total: nothing is converted or added across currencies.',
    );
    expect(playtimeCopy.SPEND_LOADING).toBe('Calculating spend...');
    expect(playtimeCopy.SPEND_NO_USABLE).toBe(
      'No orders with a recognisable status were found in this export.',
    );
    expect(playtimeCopy.SPEND_ERROR).toBe(
      'The spend summary could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.',
    );
  });

  test('the card figure labels', () => {
    expect(playtimeCopy.SPEND_LABEL_FAILED).toBe('Failed');
    expect(playtimeCopy.SPEND_LABEL_NEW).toBe('New');
    expect(playtimeCopy.SPEND_LABEL_OTHER).toBe('Other status');
  });

  test('paid orders and the gift line have explicit singular forms', () => {
    // UI-SPEND Spend card `1 paid order`; Spend gift line `1 gift order`. The
    // gift line's worth is already formatted by the caller, so this formatter
    // cannot invent a currency.
    expect(playtimeCopy.formatPaidOrders(1, 'en-US')).toBe('1 paid order');
    expect(playtimeCopy.formatPaidOrders(4, 'en-US')).toBe('4 paid orders');
    expect(playtimeCopy.formatGiftLine(1, 'USD 5.01')).toBe(
      'Includes 1 gift order worth USD 5.01.',
    );
    expect(playtimeCopy.formatGiftLine(2, 'USD 5.01')).toBe(
      'Includes 2 gift orders worth USD 5.01.',
    );
  });

  test('the breakdown table copy', () => {
    expect(playtimeCopy.SPEND_BREAKDOWN_DISCLOSURE).toBe('Breakdown by year and game code');
    expect(playtimeCopy.SPEND_BY_YEAR).toBe('By year');
    expect(playtimeCopy.SPEND_BY_GAME).toBe('By game code');
    expect(playtimeCopy.SPEND_BREAKDOWN_HEADERS).toEqual([
      'Year',
      'Game code',
      'Paid orders',
      'Total',
    ]);
    expect(playtimeCopy.SPEND_UNKNOWN_YEAR).toBe('Unknown year');
    expect(playtimeCopy.SPEND_BLANK_GAME).toBe('(not recorded)');
  });

  test('the finance note says the sums are per currency and nothing is converted', () => {
    // Phase 10, D-14: said once per pane, verbatim, because both halves matter —
    // "added across all accounts" is what the figure is, "never converted" is
    // what it is not.
    expect(playtimeCopy.FINANCE_COMBINED_NOTE).toBe(
      'Amounts in the same currency are added across all accounts. Currencies are never converted.',
    );
  });

  test('the per-account split copy names a division, not a total', () => {
    // Phase 10, D-14: the disclosure holds the DIVISION of a figure already on
    // screen, so its name says "per account" rather than repeating "total" —
    // two tables both called a total would invite the reader to compare them as
    // if they were peers. `Account` is the one header the split adds; the Paid
    // orders and Total columns are the breakdown's own vocabulary, reused rather
    // than restated so one word never means two things in one pane.
    expect(playtimeCopy.SPEND_PER_ACCOUNT_SUMMARY).toBe('Per account');
    expect(playtimeCopy.HEADER_ACCOUNT).toBe('Account');
    expect(playtimeCopy.SPEND_BREAKDOWN_HEADERS).not.toContain('Account');
  });

  test('the excluded-row explanation and the unknown-currency copy', () => {
    // UI-SPEND Spend excluded pill and explanation / Unknown currency. A
    // missing code is stated as a reason the total is unreliable, never
    // guessed at.
    expect(playtimeCopy.SPEND_EXCLUDED_EXPLANATION).toBe(
      'Paid orders with a non-numeric amount are not included in any total.',
    );
    expect(playtimeCopy.UNKNOWN_CURRENCY_HEADING).toBe('Unknown currency');
    expect(playtimeCopy.UNKNOWN_CURRENCY_CAPTION).toBe(
      'These orders have no valid three-letter currency code, so the amount has no unit and may mix different currencies.',
    );
  });
});

describe('05-08 export inventory', () => {
  // The contract the consumer plans rely on: every name the Artifacts table
  // promises exists, so a later plan importing one fails to compile here rather
  // than at the end of its own wave.
  const REQUIRED_EXPORTS = [
    // shared formatters
    'formatNumber',
    'setDefaultNumberLocale',
    'formatCompactNumber',
    'formatPercent',
    'formatWholeNumber',
    'formatMonthLabel',
    'formatPremiumDays',
    'formatMoney',
    'formatFlowAmount',
    // vehicle statistics
    'PLAYER_STATS_HEADING',
    'PLAYER_STATS_LOADING',
    'PLAYER_STATS_UPDATING',
    'PLAYER_STATS_ERROR',
    'TITLE_CONTROL_LABEL',
    'VEHICLE_TITLE_LABELS',
    'formatTitleOption',
    'BATTLE_TYPE_CONTROL_LABEL',
    'BATTLE_TYPE_ALL_OPTION',
    'formatBattleTypeLabel',
    'VEHICLE_SEARCH_LABEL',
    'HEADER_LIFETIME_BATTLES_LABEL',
    'HEADER_PREMIUM_EXPIRES_LABEL',
    'VALUE_NOT_DEFINED',
    'VALUE_NOT_AVAILABLE',
    'VALUE_NOT_IN_EXPORT',
    'VALUE_DASH',
    'VALUE_NO_BATTLES_HIDDEN',
    'VALUE_NO_SHOTS_HIDDEN',
    'VALUE_PER_BATTLE_TYPE',
    'GARAGE_YES',
    'GARAGE_NO',
    'VEHICLE_BLANK_NAME',
    'VEHICLE_COLUMN_LABELS',
    'COLUMN_PICKER_SUMMARY',
    'COLUMN_PICKER_LEGEND',
    'formatVehicleCount',
    'formatVehicleSearchCount',
    'VEHICLE_NO_MATCH',
    'VEHICLE_DERIVED_NOTE',
    'WARSHIPS_ALL_NOTE',
    'BATTLE_TYPE_NOTE_TANKS',
    'BATTLE_TYPE_NOTE_WARSHIPS',
    'BATTLE_TYPE_SUMMARY_HEADING',
    'BATTLE_TYPE_SUMMARY_CAPTION',
    'BATTLE_TYPE_SUMMARY_DISCLOSURE',
    'BATTLE_TYPE_SUMMARY_HEADERS',
    'BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS',
    'formatWarplanes20Note',
    'VEHICLE_TABLE_TITLE',
    'VEHICLE_SCROLL_HINT',
    'VEHICLE_FIND_HINT',
    'formatVehicleRegionName',
    'formatVehicleAnnouncement',
    'formatTitleNotInExport',
    'formatTitleNoRows',
    'formatVehicleCell',
    // financial data
    'FINANCIAL_PREMIUM_HEADING',
    'FINANCIAL_CURRENCY_HEADING',
    'FINANCIAL_LOADING',
    'FINANCIAL_NOT_IN_EXPORT',
    'formatFinancialNoRows',
    'PREMIUM_NO_USABLE',
    'CURRENCY_NO_USABLE',
    'FINANCIAL_ERROR',
    'PREMIUM_CHART_TITLE',
    'formatPremiumSummary',
    'PREMIUM_EXCLUDED_EXPLANATION',
    'formatPremiumExcludedPill',
    'formatPremiumUnrecognisedDisclosure',
    'formatUnrecognisedOverflow',
    'CURRENCY_BLOCK_CAPTION',
    'formatCurrencySummary',
    'CURRENCY_EXCLUDED_EXPLANATION',
    'formatOperationExcludedPill',
    'FLOW_LEGEND_DEPOSITED',
    'FLOW_LEGEND_WITHDRAWN',
    'OTHER_CURRENCIES_HEADING',
    'OTHER_CURRENCIES_CAPTION',
    'formatOtherCurrencyRow',
    'CURRENCY_BLANK_CODE',
    'MONTHLY_TABLE_DISCLOSURE',
    'PREMIUM_TABLE_HEADERS',
    'CURRENCY_TABLE_HEADERS',
    'BAR_CHART_BASIS_CAPTION',
    'BAR_CHART_KEYBOARD_HINT',
    'TOOLTIP_BASIS_LINE',
    'formatPremiumTooltip',
    'formatCurrencyTooltip',
    'formatPremiumCellLabel',
    'formatCurrencyCellLabel',
    // spend
    'SPEND_HEADING',
    'SPEND_INTRO',
    'SPEND_LOADING',
    'SPEND_NO_USABLE',
    'SPEND_ERROR',
    'formatPaidOrders',
    'SPEND_LABEL_FAILED',
    'SPEND_LABEL_NEW',
    'SPEND_LABEL_OTHER',
    'formatGiftLine',
    'SPEND_BREAKDOWN_DISCLOSURE',
    'SPEND_BY_YEAR',
    'SPEND_BY_GAME',
    'SPEND_BREAKDOWN_HEADERS',
    'SPEND_UNKNOWN_YEAR',
    'SPEND_BLANK_GAME',
    'SPEND_PER_ACCOUNT_SUMMARY',
    'HEADER_ACCOUNT',
    'FINANCE_COMBINED_NOTE',
    'formatPaidExcludedPill',
    'SPEND_EXCLUDED_EXPLANATION',
    'UNKNOWN_CURRENCY_HEADING',
    'UNKNOWN_CURRENCY_CAPTION',
  ] as const;

  test('every name the Artifacts table promises is exported', () => {
    const missing = REQUIRED_EXPORTS.filter(
      (name) => (playtimeCopy as unknown as Record<string, unknown>)[name] === undefined,
    );
    expect(missing).toEqual([]);
  });
});

// =============================================================================
// Phase 8 master-detail shell copy (08-01-PLAN Task 1)
// =============================================================================
//
// The pane titles and list-row strings from the 08-UI-SPEC Copywriting Contract.
// Literals are typed out here, not read back from the constants, so a paraphrase
// in ui-copy.ts fails here rather than reaching a user.
describe('08-01 pane and row copy', () => {
  test('PANE_TITLES names the nine panes and the four optional ones (11-05, 12-02, 12-11)', () => {
    expect(playtimeCopy.PANE_TITLES).toEqual({
      overview: 'Overview',
      playtime: 'Playtime',
      'login-history': 'Login history',
      vehicles: 'Vehicles',
      finance: 'Finance',
      payments: 'Payments',
      'device-info': 'Device info',
      account: 'Account',
      'not-yet-supported': 'Not yet supported',
      heat: 'HEAT',
      'warships-storage': 'Warships crews & storage',
      perks: 'Perks',
      'account-timeline': 'Account timeline',
    });
  });

  test('the Account timeline row summary joins its four kinds with the file count (12-11)', () => {
    expect(playtimeCopy.formatTimelineRowSummary(1)).toBe(
      'Names, services, bans, third parties \u00b7 1 file',
    );
    expect(playtimeCopy.formatTimelineRowSummary(4)).toBe(
      'Names, services, bans, third parties \u00b7 4 files',
    );
    // Its own words: never the Perks or HEAT summary.
    expect(playtimeCopy.formatTimelineRowSummary(2)).not.toBe(
      playtimeCopy.formatPerksRowSummary(2),
    );
  });

  test('the row constants', () => {
    expect(playtimeCopy.ROW_HEADLINE_NONE).toBe('\u2014');
    expect(playtimeCopy.OVERVIEW_ROW_SUMMARY).toBe('What your export contains');
    expect(playtimeCopy.ACCOUNT_ROW_SUMMARY).toBe('Location code and creation date');
  });

  test('formatRowSummary joins the folder and the file count with a middle dot', () => {
    expect(playtimeCopy.formatRowSummary('Activity_history', 2)).toBe(
      'Activity_history \u00b7 2 files',
    );
    expect(playtimeCopy.formatRowSummary('User_Info', 1)).toBe('User_Info \u00b7 1 file');
  });

  test('formatFolderCount singularises at 1', () => {
    expect(playtimeCopy.formatFolderCount(1)).toBe('1 folder');
    expect(playtimeCopy.formatFolderCount(2)).toBe('2 folders');
    expect(playtimeCopy.formatFolderCount(1204)).toBe('1,204 folders');
  });
});

// =============================================================================
// Phase 8 shell, Overview and phone-bar copy (08-01-PLAN Task 2)
// =============================================================================
//
// These are the strings the e2e specs compute their expectations from, so the
// pin is deliberate: a paraphrase is an edit to this file.
describe('08-01 shell, Overview and phone-bar copy', () => {
  test('the sections-with-data chip singularises at 1', () => {
    expect(playtimeCopy.formatChipWithData(0)).toBe('0 sections with data');
    expect(playtimeCopy.formatChipWithData(1)).toBe('1 section with data');
    expect(playtimeCopy.formatChipWithData(6)).toBe('6 sections with data');
  });

  test('the not-in-this-export chip has one form', () => {
    expect(playtimeCopy.formatChipAbsent(0)).toBe('0 not in this export');
    expect(playtimeCopy.formatChipAbsent(1)).toBe('1 not in this export');
    expect(playtimeCopy.formatChipAbsent(3)).toBe('3 not in this export');
  });

  test('the unsupported chip singularises at 1', () => {
    expect(playtimeCopy.formatChipUnsupported(1)).toBe('1 folder not yet supported');
    expect(playtimeCopy.formatChipUnsupported(2)).toBe('2 folders not yet supported');
  });

  test('the Open link names the pane and ends with an arrow', () => {
    expect(playtimeCopy.formatOpenSectionLink('Playtime')).toBe('Open Playtime \u2192');
    expect(playtimeCopy.formatOpenSectionLink('Login history')).toBe('Open Login history \u2192');
  });

  test('provenance leads with the folder and a trailing middle dot', () => {
    expect(playtimeCopy.formatProvenanceFrom('Activity_history')).toBe(
      'From Activity_history \u00b7',
    );
  });

  const STATIC_ROWS = [
    ['OVERVIEW_INTRO', 'What your export contains. Open a section for the full charts.'],
    ['BACK_TO_SECTIONS_LABEL', '\u2039 Sections'],
    ['LIST_KEYBOARD_HINT', 'Move with j and k'],
    ['SKIP_TO_DETAIL_LABEL', 'Skip to section detail'],
    ['EMPTY_STATE_PRIVACY', 'Your data stays in this tab.'],
    ['PRODUCT_LABEL', 'WG Data Export Viewer'],
  ] as const;

  test.each(STATIC_ROWS)('%s is the UI-SPEC wording', (name, literal) => {
    expect(playtimeCopy[name]).toBe(literal);
  });
});

// 08-06: the "About this <name>" disclosure summary. The chart names are part of
// the visible summary, so a paraphrase is an edit to this file.
describe('08-06 About-this disclosure copy', () => {
  test('formatAboutThis prefixes the chart name', () => {
    expect(playtimeCopy.formatAboutThis('calendar')).toBe('About this calendar');
    expect(playtimeCopy.formatAboutThis('hour grid')).toBe('About this hour grid');
  });

  const NAME_ROWS = [
    ['ABOUT_NAME_CALENDAR', 'calendar'],
    ['ABOUT_NAME_HOUR_GRID', 'hour grid'],
    ['ABOUT_NAME_PREMIUM', 'chart'],
    ['ABOUT_NAME_CURRENCY', 'chart'],
    ['ABOUT_NAME_MAP', 'map'],
    ['ABOUT_NAME_LOGIN_TABLE', 'table'],
    // Phase 10: the merged totals' disclosure reads "About this summary".
    ['ABOUT_NAME_PLAYTIME_TOTALS', 'summary'],
  ] as const;

  test.each(NAME_ROWS)('%s is the UI-SPEC name', (name, literal) => {
    expect(playtimeCopy[name]).toBe(literal);
  });
});

// =============================================================================
// Phase 10 — the shared game filter's words (10-02 Task 2)
//
// These three strings are the whole of the filter's user-visible copy, and two
// of them make CLAIMS about how numbers were counted. `PLAYTIME_MERGE_ABOUT`
// is pinned verbatim rather than loosely, and the negative assertions below it
// are the reason: the UI-SPEC's first draft said "hours, sessions and active
// days all come from those stretches", which is false — sessions are usable
// rows and active days are distinct start days; only hours take the union. A
// wording that can drift into a false claim about the reader's own data is a
// wording this file must fail on.
// =============================================================================
describe('10-02 the game filter and the merge explanation', () => {
  test('the filter label and the All option are the UI-SPEC strings', () => {
    expect(playtimeCopy.GAME_FILTER_LABEL).toBe('Filter by game');
    expect(playtimeCopy.GAME_FILTER_ALL).toBe('All games');
  });

  test('the empty-game line names the game and the way out', () => {
    expect(playtimeCopy.formatNoGameSessions('WOWS')).toBe(
      'No Warships sessions in this export. Choose All games to see all of your playtime.',
    );
    expect(playtimeCopy.formatNoGameSessions('WOT')).toBe(
      'No WoT sessions in this export. Choose All games to see all of your playtime.',
    );
    // A token with no name of its own is announced as the token (T-06-05).
    expect(playtimeCopy.formatNoGameSessions('XYZ')).toBe(
      'No XYZ sessions in this export. Choose All games to see all of your playtime.',
    );
  });

  test('the merge explanation is the corrected wording, verbatim', () => {
    expect(playtimeCopy.PLAYTIME_MERGE_ABOUT).toBe(
      'Playtime is counted once. When sessions overlap, whether on different accounts or in different games, ' +
        'the overlap counts as a single stretch of play, so hours are the time covered by at least one session. ' +
        'Sessions and active days are counted from the sessions recorded. ' +
        "A game's hours are worked out from that game alone, so All games can show fewer hours than the games added together.",
    );
  });

  test('it claims nothing the counting rule does not support (D-07 as amended)', () => {
    const about = playtimeCopy.PLAYTIME_MERGE_ABOUT;
    // The withdrawn sentence, and the phrase that carried it.
    expect(about).not.toContain('merged stretches');
    expect(about).not.toMatch(/all come from those stretches/i);
    // And the three rules, each stated on its own.
    expect(about).toContain('Sessions and active days are counted from the sessions recorded');
    expect(about).toContain('the time covered by at least one session');
    expect(about).toContain('All games can show fewer hours than the games added together');
  });
});

// quick 261012-bog: the Device info pane's copy. Every string the pane shows
// is pinned here, so a paraphrase is an edit to ui-copy.ts and a failure here.
describe('261012-bog Device info copy', () => {
  const CONSTANT_ROWS = [
    ['DEVICE_INFO_LOADING', 'Reading device information...'],
    [
      'DEVICE_INFO_ERROR',
      'Device information could not be read from this export. Your imported data is unchanged. Drop the export again to retry.',
    ],
    [
      'DEVICE_INFO_INTRO',
      'The computers and devices your export lists, one table for each source file.',
    ],
    ['DEVICE_SUMMARY_HEADING', 'In this export'],
    ['DEVICE_NOT_REPORTED', 'not reported'],
    ['DEVICE_TABLE_NOT_IN_EXPORT', 'Not in this export'],
    [
      'DEVICE_UNREADABLE_EXPLANATION',
      'These rows held no device type, app, platform or version this viewer can read, so they are counted but not listed.',
    ],
    [
      'DEVICE_MEMORY_NOTE',
      'Memory is shown in GB (1 GB = 1,024 MB). Values under 1 GB stay in MB.',
    ],
  ] as const;

  test.each(CONSTANT_ROWS)('%s is the approved wording', (name, literal) => {
    expect(playtimeCopy[name]).toBe(literal);
  });

  test('the record constants name the three sources, files and columns', () => {
    expect(playtimeCopy.DEVICE_HEADINGS).toEqual({
      pc: 'PC hardware',
      blitz: 'Blitz devices',
      assistant: 'Assistant app devices',
    });
    expect(playtimeCopy.DEVICE_FILE_LABELS).toEqual({
      pc: 'WOT_Device_Info.csv',
      blitz: 'WOTB_Device_Info.csv',
      assistant: 'WOT_Assistant_Device_Info.csv',
    });
    expect(playtimeCopy.DEVICE_COLUMN_LABELS).toEqual({
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
    });
  });

  test.each([
    [0, '0 MB'],
    [512, '512 MB'],
    [1023, '1,023 MB'],
    [1024, '1 GB'],
    [1536, '1.5 GB'],
    [3000, '2.9 GB'],
    [4096, '4 GB'],
    [16384, '16 GB'],
    [1048576, '1,024 GB'],
    [Number.NaN, '0 MB'],
    [Number.POSITIVE_INFINITY, '0 MB'],
    [-5, '0 MB'],
  ])('formatMemoryFromMb(%s) is %s', (mb, text) => {
    expect(playtimeCopy.formatMemoryFromMb(mb)).toBe(text);
  });

  test('the provenance and empty-state sentences name the file', () => {
    expect(playtimeCopy.formatDeviceFromFile('WOT_Device_Info.csv')).toBe(
      'From WOT_Device_Info.csv',
    );
    expect(playtimeCopy.formatDeviceNoRows('WOTB_Device_Info.csv')).toBe(
      'WOTB_Device_Info.csv is in this export but holds no rows',
    );
  });

  test('the no-usable sentence singularises', () => {
    expect(playtimeCopy.formatDeviceNoUsable(1)).toBe('The 1 row in this file could not be read');
    expect(playtimeCopy.formatDeviceNoUsable(2)).toBe(
      'None of the 2 rows in this file could be read',
    );
    expect(playtimeCopy.formatDeviceNoUsable(1204)).toBe(
      'None of the 1,204 rows in this file could be read',
    );
  });

  test('the unreadable pill is empty at zero and singularises', () => {
    expect(playtimeCopy.formatDeviceUnreadablePill(0)).toBe('');
    expect(playtimeCopy.formatDeviceUnreadablePill(1)).toBe('1 row could not be read');
    expect(playtimeCopy.formatDeviceUnreadablePill(4)).toBe('4 rows could not be read');
  });

  test('the more-rows line singularises', () => {
    expect(playtimeCopy.formatDeviceMoreRows(1)).toBe('and 1 more row not listed');
    expect(playtimeCopy.formatDeviceMoreRows(37)).toBe('and 37 more rows not listed');
  });

  test('the per-source summary value covers all four statuses', () => {
    expect(playtimeCopy.formatDeviceSourceCount('not-in-export', 0, 0)).toBe('not in this export');
    expect(playtimeCopy.formatDeviceSourceCount('no-rows', 0, 0)).toBe('no rows');
    expect(playtimeCopy.formatDeviceSourceCount('ready', 4, 0)).toBe('4 rows');
    expect(playtimeCopy.formatDeviceSourceCount('ready', 1, 0)).toBe('1 row');
    expect(playtimeCopy.formatDeviceSourceCount('ready', 8, 4)).toBe('8 rows, 4 could not be read');
    expect(playtimeCopy.formatDeviceSourceCount('no-usable', 3, 3)).toBe(
      '3 rows, 3 could not be read',
    );
    expect(playtimeCopy.formatDeviceSourceCount('no-usable', 1, 1)).toBe(
      '1 row, 1 could not be read',
    );
  });

  test('the table label appends the word table', () => {
    expect(playtimeCopy.formatDeviceTableLabel('PC hardware')).toBe('PC hardware table');
  });
});

// =============================================================================
// Phase 9, plan 09-04 — the multi-account identity header's copy
// =============================================================================
//
// Every string the multi variant shows, pinned to the UI-SPEC Surface 1 /
// Copywriting Contract wording, and every formatter's edge: the empty games
// list, the one-year range, the unknown token, the duplicate token.
//
// The file is the ONE owner of user-visible wording, so a paraphrase is a
// deliberate edit to one of these assertions rather than a silent change to a
// sentence a user reads. The `namespace` import (`playtimeCopy`) is what makes
// a RED run report a failing value rather than a module-load link error.
describe('Phase 9: the multi-account identity header copy', () => {
  test('the list label, the two fact labels and the no-activity sentence', () => {
    expect(playtimeCopy.IDENTITY_MULTI_LIST_LABEL).toBe('Accounts in this export');
    expect(playtimeCopy.IDENTITY_GAMES_LABEL).toBe('Games');
    expect(playtimeCopy.IDENTITY_ACTIVITY_LABEL).toBe('Activity');
    expect(playtimeCopy.IDENTITY_NO_ACTIVITY).toBe('No activity recorded');
  });

  test('the Account list row summary names what a row carries, not a region', () => {
    expect(playtimeCopy.ACCOUNT_ROW_MULTI_SUMMARY).toBe(
      "Each account's ID, games and activity years",
    );
    // The single-account summary is a location code and a date; showing either
    // here would present one account's facts as the export's (UI-SPEC Surface 3).
    expect(playtimeCopy.ACCOUNT_ROW_MULTI_SUMMARY).not.toContain('Location');
    expect(playtimeCopy.ACCOUNT_ROW_MULTI_SUMMARY).not.toContain('creation date');
  });

  test('the account count has a singular for exactly one and a plural for the rest', () => {
    // One is reachable since 09-11: an archive of several folders in which only
    // one stores data. Zero is reachable when none does.
    expect(playtimeCopy.formatAccountCount(0)).toBe('0 accounts');
    expect(playtimeCopy.formatAccountCount(1)).toBe('1 account');
    expect(playtimeCopy.formatAccountCount(2)).toBe('2 accounts');
    expect(playtimeCopy.formatAccountCount(3)).toBe('3 accounts');
  });

  test('the combined caption names what the PANE is showing, not the dataset', () => {
    expect(playtimeCopy.formatCombinedCaption(2)).toBe('All 2 accounts combined');
    expect(playtimeCopy.formatCombinedCaption(3)).toBe('All 3 accounts combined');
    // Distinct from the header's title: a pane that read "3 accounts" would be
    // indistinguishable from the header above it.
    expect(playtimeCopy.formatCombinedCaption(3)).not.toBe(playtimeCopy.formatAccountCount(3));
  });

  test('the year range joins with an en dash and no spaces', () => {
    // The dash is written as U+2013 in ui-copy.ts; a plain hyphen would read as
    // a minus sign and be announced as one.
    expect(playtimeCopy.formatActivityYears(2014, 2026)).toBe('2014–2026');
    expect(playtimeCopy.formatActivityYears(2014, 2026)).not.toContain(' ');
    expect(playtimeCopy.formatActivityYears(2014, 2026)).not.toContain('-');
  });

  test('one year reads alone, and a null last year falls back to the first', () => {
    expect(playtimeCopy.formatActivityYears(2021, 2021)).toBe('2021');
    expect(playtimeCopy.formatActivityYears(2021, null)).toBe('2021');
  });

  test('the earliest-created summary has an unknown-date sentence', () => {
    expect(playtimeCopy.formatEarliestCreated(null)).toBe('Earliest account creation date unknown');
    expect(playtimeCopy.formatEarliestCreated('2018-02-14')).toBe(
      'Earliest account created 2018-02-14',
    );
  });

  test('the long game names map the six known tokens', () => {
    expect(playtimeCopy.formatGameLongName('WOT')).toBe('World of Tanks');
    expect(playtimeCopy.formatGameLongName('WOTB')).toBe('WoT Blitz');
    expect(playtimeCopy.formatGameLongName('WOWS')).toBe('World of Warships');
    expect(playtimeCopy.formatGameLongName('WOTC')).toBe('WoT Console');
    expect(playtimeCopy.formatGameLongName('HEAT')).toBe('World of Tanks HEAT');
    // WOWP is in the long table although D-14 lists five names, so a Warplanes
    // session shows a name rather than a raw token (UI-SPEC recorded choice).
    expect(playtimeCopy.formatGameLongName('WOWP')).toBe('World of Warplanes');
  });

  test('an unknown game token is returned unchanged', () => {
    // The token comes from an untrusted archive FILE NAME and is already
    // bounded to letters, digits and underscores; there is no error path.
    expect(playtimeCopy.formatGameLongName('XYZ')).toBe('XYZ');
    expect(playtimeCopy.formatGameLongName('WOWP_19')).toBe('WOWP_19');
  });

  test('an account list orders known games by the fixed order, de-duplicated, unknowns last', () => {
    expect(playtimeCopy.formatAccountGames(['HEAT', 'WOT', 'XYZ', 'WOTB', 'WOT'])).toBe(
      'World of Tanks, WoT Blitz, World of Tanks HEAT, XYZ',
    );
  });

  test('the account list puts WOTC and WOWP in the declared positions', () => {
    expect(playtimeCopy.formatAccountGames(['WOWP', 'WOTC', 'WOWS'])).toBe(
      'World of Warships, WoT Console, World of Warplanes',
    );
  });

  test('two unknown tokens sort in code-unit order, never by locale', () => {
    // `localeCompare` would make the order depend on the viewer's locale, so
    // two people could read one export's rows in a different order.
    expect(playtimeCopy.formatAccountGames(['ZZ', 'AA', 'MM'])).toBe('AA, MM, ZZ');
  });

  test('an empty games list is the empty string, and the caller omits the row', () => {
    expect(playtimeCopy.formatAccountGames([])).toBe('');
  });

  test('the existing short labels are unchanged', () => {
    // The existing panes read GAME_NAMES in a column headed "Game"; a long name
    // there would wrap, which is why there are two tables.
    expect(playtimeCopy.formatGameName('WOT')).toBe('WoT');
    expect(playtimeCopy.formatGameName('WOWS')).toBe('Warships');
    expect(playtimeCopy.formatGames(['WOT', 'WOWS'])).toBe('WoT, Warships');
  });

  test('the two new games have SHORT names in this table (11-01)', () => {
    // The panes read this table in a column headed "Game"; "World of Tanks
    // HEAT" would wrap there. The long names stay in GAME_LONG_NAMES, which
    // only the identity list has the width for.
    expect(playtimeCopy.formatGameName('WOTC')).toBe('WoT Console');
    expect(playtimeCopy.formatGameName('HEAT')).toBe('HEAT');
    // And the long table still says something different for the same tokens.
    expect(playtimeCopy.formatGameLongName('WOTC')).toBe('WoT Console');
    expect(playtimeCopy.formatGameLongName('HEAT')).toBe('World of Tanks HEAT');
  });
});

// =============================================================================
// Phase 10 — the account tag's words (D-10, D-19)
// =============================================================================
//
// The tag chip shows one letter and says everything else in a visually-hidden
// span. These two formatters are the ONLY place that sentence is written, so
// the wording is pinned here rather than in whichever component renders it.

describe('the account tag label', () => {
  test('letter, ID and nickname, in that order', () => {
    expect(playtimeCopy.formatAccountTagLabel('B', '500000001', 'Synthetic EU Captain')).toBe(
      'Account B, ID 500000001, nickname Synthetic EU Captain',
    );
  });

  test('an account with no nickname gets no nickname clause', () => {
    // Not "Account A, ID 2000002, nickname" — an absent value is omitted
    // rather than named and then left empty, which is the identity header's
    // own rule for its ID line.
    expect(playtimeCopy.formatAccountTagLabel('A', '2000002', null)).toBe('Account A, ID 2000002');
  });

  test('a BLANK nickname is an absent nickname', () => {
    // The user's own RU account has no `User_Info` row at all, and an account
    // whose `NAME` cell is whitespace is the same situation as far as the label
    // is concerned.
    expect(playtimeCopy.formatAccountTagLabel('A', '2000002', '   ')).toBe('Account A, ID 2000002');
    expect(playtimeCopy.formatAccountTagLabel('A', '2000002', '')).toBe('Account A, ID 2000002');
  });

  test('a two-letter chip reads as well as a one-letter one', () => {
    // Past the import cap's Z, the letter grows; the phrase has to carry it
    // unchanged rather than clipping the chip's own text.
    expect(playtimeCopy.formatAccountTagLabel('AA', '500000001', null)).toBe(
      'Account AA, ID 500000001',
    );
  });

  test('untrusted text is concatenated, never transformed (T-03-07, T-09-18)', () => {
    const hostile = '<b onclick="x">nick</b>';
    expect(playtimeCopy.formatAccountTagLabel('A', '../../etc', hostile)).toBe(
      'Account A, ID ../../etc, nickname <b onclick="x">nick</b>',
    );
  });

  test('the header legend says the letter and nothing else', () => {
    // The header row already SHOWS the nickname and the ID, so the hidden
    // phrase repeats neither — that is what keeps D-21's once-per-row rule and
    // the e2e's occurrence count intact.
    expect(playtimeCopy.formatAccountLegendLabel('A')).toBe('Account A');
    expect(playtimeCopy.formatAccountLegendLabel('AA')).toBe('Account AA');
  });

  test('the overflow count reads as a count of accounts, not as another letter', () => {
    // D-18: the cells beside it are the chips, so a chip-shaped `+2` would be
    // read as an account named `+2`. It is a plain `+N` and nothing else.
    expect(playtimeCopy.formatAccountOverflow(1)).toBe('+1');
    expect(playtimeCopy.formatAccountOverflow(2)).toBe('+2');
    expect(playtimeCopy.formatAccountOverflow(29)).toBe('+29');
  });
});

describe('the Vehicles search hint', () => {
  test('the sentence is exactly what the UI-SPEC Copywriting Contract names', () => {
    expect(playtimeCopy.VEHICLE_SEARCH_ACCOUNT_HINT).toBe(
      'Also matches account letters and account IDs.',
    );
  });

  test('it names BOTH things the search really matches on', () => {
    // D-11: the letter and the account ID. A hint that mentioned only one would
    // leave the other discoverable only by accident.
    expect(playtimeCopy.VEHICLE_SEARCH_ACCOUNT_HINT).toMatch(/letters/i);
    expect(playtimeCopy.VEHICLE_SEARCH_ACCOUNT_HINT).toMatch(/IDs/i);
  });

  test('it is a sentence, not a fragment, and claims nothing about sorting', () => {
    // There is no sort-by-account and no account picker (D-11), so a hint that
    // implied either would describe a control that does not exist.
    expect(playtimeCopy.VEHICLE_SEARCH_ACCOUNT_HINT.endsWith('.')).toBe(true);
    expect(playtimeCopy.VEHICLE_SEARCH_ACCOUNT_HINT).not.toMatch(
      /sort|order|picker|choose an account/i,
    );
  });
});

describe('the no-vehicle-table note (11-06, D-06)', () => {
  test('it names the game AND the table being shown instead', () => {
    // The honest sentence: not an error, not an empty state. A reader narrowed
    // to HEAT has to learn both facts — that the game they chose has no
    // vehicles, and which table they are looking at.
    expect(playtimeCopy.formatNoVehicleTable('WoT Console', 'WoT')).toBe(
      'WoT Console has no vehicle table. Showing WoT instead.',
    );
    expect(playtimeCopy.formatNoVehicleTable('HEAT', 'Warplanes')).toBe(
      'HEAT has no vehicle table. Showing Warplanes instead.',
    );
  });

  test('it is two sentences and never blames the export', () => {
    // D-06 says a TABLE plus one honest sentence, never an error: the export is
    // fine, the reader's filter simply names a game with no vehicles in it.
    const line = playtimeCopy.formatNoVehicleTable('HEAT', 'WoT');
    expect(line.endsWith('.')).toBe(true);
    expect(line).not.toMatch(/error|failed|corrupt|missing|invalid/i);
  });

  test('it interpolates only, so an unknown label cannot become markup', () => {
    // The two arguments are labels from this module's own vocabularies in every
    // real call, and the function only concatenates them (T-05-35's rule).
    expect(playtimeCopy.formatNoVehicleTable('x', 'y')).toBe(
      'x has no vehicle table. Showing y instead.',
    );
  });
});

// =============================================================================
// Phase 11, plan 11-05 — the two optional panes' copy (D-01, D-03, D-09)
// =============================================================================
//
// Literals typed out again, never read back from the constants, so a paraphrase
// fails here rather than reaching a reader. Every string here is CONSTANT or an
// integer count: no zip entry name and no cell can reach a list row, an Overview
// card or a pane header through these (T-11-16).
describe('11-05 optional pane copy', () => {
  test('the two row summaries name the files and take their count from formatFileCount', () => {
    expect(playtimeCopy.formatHeatRowSummary(4)).toBe('Battle types, stats, storage · 4 files');
    expect(playtimeCopy.formatHeatRowSummary(1)).toBe('Battle types, stats, storage · 1 file');
    expect(playtimeCopy.formatWowsStorageRowSummary(2)).toBe('Crews and account storage · 2 files');
    expect(playtimeCopy.formatWowsStorageRowSummary(1)).toBe('Crews and account storage · 1 file');
  });

  test('the Perks row summary names the four cards and takes its count from formatFileCount', () => {
    // 12-UI-SPEC Surface 1: `Subscriptions, coupons, codes, surveys · {n files}`.
    expect(playtimeCopy.formatPerksRowSummary(1)).toBe(
      'Subscriptions, coupons, codes, surveys · 1 file',
    );
    expect(playtimeCopy.formatPerksRowSummary(3)).toBe(
      'Subscriptions, coupons, codes, surveys · 3 files',
    );
  });

  test('the provenance labels are prose, used with formatProvenanceFrom', () => {
    expect(playtimeCopy.NEW_DATA_PROVENANCE_LABELS).toEqual({
      heat: 'HEAT data',
      'warships-storage': 'Warships crews and storage files',
      perks: 'perks files',
      'account-timeline': 'account history files',
    });
    expect(
      playtimeCopy.formatProvenanceFrom(
        playtimeCopy.NEW_DATA_PROVENANCE_LABELS['account-timeline'],
      ),
    ).toBe('From account history files \u00b7');
    expect(playtimeCopy.formatProvenanceFrom(playtimeCopy.NEW_DATA_PROVENANCE_LABELS.heat)).toBe(
      'From HEAT data ·',
    );
    expect(playtimeCopy.formatProvenanceFrom(playtimeCopy.NEW_DATA_PROVENANCE_LABELS.perks)).toBe(
      'From perks files ·',
    );
  });

  test('the skipped sentence names the file and the reason, once (D-09)', () => {
    expect(playtimeCopy.formatNewDataSkipped('Account statistics')).toBe(
      'Account statistics is in this export, but none of its columns are ones this viewer reads, so it was skipped.',
    );
  });

  test('the skipped sentence is a fixed template: one file label, no count, no path', () => {
    const line = playtimeCopy.formatNewDataSkipped('Geolocation');
    expect(line.endsWith('so it was skipped.')).toBe(true);
    expect(line).toMatch(/^Geolocation is in this export, but /);
    // A zip-derived name must not be smuggled in through the label: the caller
    // passes a canonical label, and the function only interpolates it.
    expect(playtimeCopy.formatNewDataSkipped('HEAT_Account_Statistics.csv')).toContain(
      'HEAT_Account_Statistics.csv',
    );
  });
});

// =============================================================================
// 11-08 - HEAT and Warships crews & storage pane copy
// =============================================================================
//
// Every sentence the two panes show is a named constant or a formatter, pinned
// here with its exact text, and the file and column label tables are
// cross-checked against the worker's spec table so a renamed column fails a
// test by name instead of printing an id (T-11-23, UI-SPEC copy rules).
// =============================================================================

describe('11-08 HEAT and Warships pane copy', () => {
  const CONSTANT_ROWS = [
    [
      'HEAT_INTRO',
      'Your HEAT account statistics, battle types, storage and geolocation records. HEAT play sessions are counted in Playtime.',
    ],
    [
      'WOWS_STORAGE_INTRO',
      'The crews and account storage your export lists for Warships. Warships vehicle statistics are in Vehicles.',
    ],
    ['HEAT_GEO_NOTE', 'These addresses are not added to the Login history map or country list.'],
    ['HEAT_LOADING', 'Reading HEAT data...'],
    ['WOWS_STORAGE_LOADING', 'Reading Warships crews and storage...'],
    [
      'HEAT_ERROR',
      'HEAT data could not be read from this export. Your imported data is unchanged. Drop the export again to retry.',
    ],
    [
      'WOWS_STORAGE_ERROR',
      'Warships crews and storage could not be read from this export. Your imported data is unchanged. Drop the export again to retry.',
    ],
  ] as const;

  test.each(CONSTANT_ROWS)('%s is the approved wording', (name, literal) => {
    expect(playtimeCopy[name]).toBe(literal);
  });

  test('the error sentences are fixed and never carry a placeholder', () => {
    for (const sentence of [playtimeCopy.HEAT_ERROR, playtimeCopy.WOWS_STORAGE_ERROR]) {
      expect(
        sentence.endsWith('Your imported data is unchanged. Drop the export again to retry.'),
      ).toBe(true);
      expect(sentence).not.toMatch(/[{}$]/);
    }
  });

  test('the card titles are pinned', () => {
    expect(playtimeCopy.HEAT_CARD_TITLES).toEqual({
      accountStats: 'Account statistics',
      battleTypes: 'Battle types',
      storage: 'Storage',
      geolocation: 'Geolocation',
    });
    expect(playtimeCopy.WOWS_STORAGE_CARD_TITLES).toEqual({
      crews: 'Crews',
      storage: 'Account storage',
    });
  });

  test('the file labels are the captured file names, one per pane file, and no other key', () => {
    expect(playtimeCopy.NEW_DATA_FILE_LABELS).toEqual({
      'heat_account_statistics.csv': 'HEAT_Account_Statistics.csv',
      'heat_battle_types_statistics.csv': 'HEAT_Battle_Types_Statistics.csv',
      'heat_account_storage.csv': 'HEAT_Account_Storage.csv',
      'heat_session_geolocation.csv': 'HEAT_Session_Geolocation.csv',
      'wows_crews.csv': 'WOWS_Crews.csv',
      'wows_account_storage.csv': 'WOWS_Account_Storage.csv',
      'heat_surveys.csv': 'HEAT_Surveys.csv',
      'account_name_history.csv': 'Account_Name_History.csv',
      'external_services_history.csv': 'External_Services_History.csv',
      'language_and_country_history.csv': 'Language_And_Country_History.csv',
      'bans.csv': 'Bans.csv',
      'authorized_third_parties.csv': 'Authorized_Third_Parties.csv',
      'subscriptions.csv': 'Subscriptions.csv',
      'personal_coupons.csv': 'Personal_Coupons.csv',
      'bonus_code_usage.csv': 'Bonus_Code_Usage.csv',
    });
  });

  test('the file-label keys equal the labelled file set and the captured display names', () => {
    // The labelled set is the PANE files plus the PERKS card files: the label
    // table covers every file a card may name, whichever pane shows it. The
    // Perks pane joins the pane tables in plan 12-02's Task 2, and the union is
    // the same set before and after that.
    const paneKeys = LABELLED_FILES;
    // heat_game_sessions.csv and heat_device_info.csv are not pane files (11-01, D-15).
    expect(Object.keys(playtimeCopy.NEW_DATA_FILE_LABELS).sort()).toEqual(paneKeys);
    for (const key of paneKeys) {
      const captured = CAPTURED_FILES.find((entry) => entry.key === key);
      expect(captured, `${key} is in the header capture`).toBeDefined();
      expect(playtimeCopy.NEW_DATA_FILE_LABELS[key], key).toBe(captured!.fileName);
    }
  });

  test('every spec column of every labelled file has a non-empty label', () => {
    const missing: string[] = [];
    for (const key of LABELLED_FILES) {
      const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
      expect(spec, `${key} has a spec`).toBeDefined();
      for (const column of spec!.columns) {
        const label = playtimeCopy.NEW_DATA_COLUMN_LABELS[key]?.[column.id];
        if (label === undefined || label.trim() === '') missing.push(`${key} / ${column.id}`);
      }
    }
    expect(missing, `columns without a label: ${missing.join(', ')}`).toEqual([]);
  });

  test('the column-label table names no file that is not a labelled file and no column that is not in its spec', () => {
    const paneKeys = new Set(LABELLED_FILES);
    for (const [key, labels] of Object.entries(playtimeCopy.NEW_DATA_COLUMN_LABELS)) {
      expect(paneKeys.has(key), `${key} is a labelled file`).toBe(true);
      const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key)!;
      const ids = new Set(spec.columns.map((column) => column.id));
      for (const id of Object.keys(labels)) expect(ids.has(id), `${key} / ${id}`).toBe(true);
    }
  });

  test('a label is plain language, not the raw header text', () => {
    for (const [key, labels] of Object.entries(playtimeCopy.NEW_DATA_COLUMN_LABELS)) {
      for (const [id, label] of Object.entries(labels)) {
        expect(label, `${key} / ${id}`).not.toBe(id);
        expect(label, `${key} / ${id} has no underscore`).not.toContain('_');
      }
    }
  });

  test('formatNewDataColumnLabel returns the label and falls back to the id, never a zip header', () => {
    expect(playtimeCopy.formatNewDataColumnLabel('wows_account_storage.csv', 'AMOUNT')).toBe(
      playtimeCopy.NEW_DATA_COLUMN_LABELS['wows_account_storage.csv']!['AMOUNT'],
    );
    expect(playtimeCopy.formatNewDataColumnLabel('wows_crews.csv', 'SOMETHING_NEW')).toBe(
      'SOMETHING_NEW',
    );
    expect(playtimeCopy.formatNewDataColumnLabel('not_a_pane_file.csv', 'AMOUNT')).toBe('AMOUNT');
    // An inherited property name is an ordinary unknown id, not a label.
    expect(playtimeCopy.formatNewDataColumnLabel('wows_crews.csv', 'constructor')).toBe(
      'constructor',
    );
    expect(playtimeCopy.formatNewDataColumnLabel('__proto__', 'AMOUNT')).toBe('AMOUNT');
  });

  test('the battle-type column is a real column of the battle-types spec', () => {
    const id = playtimeCopy.HEAT_BATTLE_TYPE_COLUMN_ID;
    expect(id === null || typeof id === 'string').toBe(true);
    if (id !== null) {
      const spec = NEW_DATA_SPEC_FILES.find(
        (candidate) => candidate.key === 'heat_battle_types_statistics.csv',
      );
      expect(spec!.columns.map((column) => column.id)).toContain(id);
    }
  });
});

describe('Warplanes account statistics copy (plan 11-10)', () => {
  test('the heading is the contract wording', () => {
    expect(playtimeCopy.WOWP_ACCOUNT_STATS_HEADING).toBe('Account statistics');
  });

  test('WOWP_FILE_LABELS holds exactly the four Warplanes file keys, as the capture printed them', () => {
    const keys = [
      'wowp_19_plane_statistics.csv',
      'wowp_20_plane_statistics.csv',
      'wowp_19_account_statistics.csv',
      'wowp_20_account_statistics.csv',
    ];
    expect(Object.keys(playtimeCopy.WOWP_FILE_LABELS).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const captured = CAPTURED_FILES.find((entry) => entry.key === key);
      expect(captured, `${key} is in the header capture`).toBeDefined();
      expect(playtimeCopy.WOWP_FILE_LABELS[key], key).toBe(captured!.fileName);
    }
  });

  test('WOWP_FILE_LABELS stays a separate table from the pane file labels', () => {
    for (const key of Object.keys(playtimeCopy.WOWP_FILE_LABELS)) {
      expect(Object.hasOwn(playtimeCopy.NEW_DATA_FILE_LABELS, key), key).toBe(false);
    }
  });

  test('every column the account block can show has a non-empty plain label', () => {
    const missing: string[] = [];
    for (const column of wowpAccountColumns()) {
      const label = playtimeCopy.WOWP_ACCOUNT_COLUMN_LABELS[column.id];
      if (label === undefined || label.trim() === '') missing.push(column.id);
    }
    expect(missing, `columns without a label: ${missing.join(', ')}`).toEqual([]);
  });

  test('the column-label table names only block columns and no label is raw header text', () => {
    const ids = new Set(wowpAccountColumns().map((column) => column.id));
    for (const [id, label] of Object.entries(playtimeCopy.WOWP_ACCOUNT_COLUMN_LABELS)) {
      expect(ids.has(id), `${id} is a block column`).toBe(true);
      expect(label, id).not.toBe(id);
      expect(label, `${id} has no underscore`).not.toContain('_');
    }
    expect(Object.keys(playtimeCopy.WOWP_ACCOUNT_COLUMN_LABELS)).not.toContain('NAME');
  });
});

// =============================================================================
// 12-05 - Account timeline and Perks pane copy
// =============================================================================
//
// Every sentence the two new panes show is a named constant or a formatter,
// pinned here with its exact text. Three of the pins are about what the copy
// may NOT do: it may not interpolate anything but a number (T-12-15), the Perks
// mask wording differs from the IP-only wording the timeline reuses, and the
// word "email" appears in the About body and nowhere else (UI-SPEC copy rules).
// =============================================================================

describe('12-05 Account timeline and Perks copy', () => {
  const CONSTANT_ROWS = [
    [
      'TIMELINE_INTRO',
      'What your accounts were called, which services were linked, which language and country they were registered under, what was enforced against them and which third parties were authorised. Newest first.',
    ],
    [
      'PERKS_INTRO',
      'The subscriptions, personal coupons, bonus codes and surveys your export lists.',
    ],
    ['TIMELINE_KIND_FILTER_LABEL', 'Filter by kind'],
    ['TIMELINE_KIND_ALL', 'All entries'],
    ['PERKS_MASK_TOGGLE_SHOW', 'Show full codes and IP addresses'],
    ['PERKS_MASK_TOGGLE_HIDE', 'Hide full codes and IP addresses'],
    [
      'PERKS_MASK_CAPTION_MASKED',
      'Codes and IP addresses are masked: most of each code and the last part of each address are hidden.',
    ],
    [
      'PERKS_MASK_CAPTION_REVEALED',
      'Full codes and IP addresses are shown. Hide them again before sharing your screen.',
    ],
    ['PERKS_MASK_ANNOUNCE_SHOWN', 'Full codes and IP addresses are now shown.'],
    ['PERKS_MASK_ANNOUNCE_MASKED', 'Codes and IP addresses are now masked.'],
    ['ABOUT_NAME_TIMELINE', 'timeline'],
    [
      'TIMELINE_ABOUT',
      'Entries from your name, service, language and country, ban and authorised-third-party files are listed together, newest first; entries without a usable date come last. Email addresses in these files are never read, stored or shown. IP addresses stay masked until you choose to show them. When accounts hold an identical service, language or country entry, it is shown once with a tag for each account.',
    ],
    ['ABOUT_NAME_PERKS', 'perks pane'],
    [
      'PERKS_ABOUT',
      'Coupon codes, bonus codes and the IP address used to redeem a bonus code stay masked until you choose to show them. Only the fields this viewer reads are listed. When accounts hold an identical subscription, it is shown once with a tag for each account.',
    ],
    ['TIMELINE_LOADING', 'Reading account timeline...'],
    ['PERKS_LOADING', 'Reading perks...'],
    [
      'TIMELINE_ERROR',
      'Account timeline could not be read from this export. Your imported data is unchanged. Drop the export again to retry.',
    ],
    [
      'PERKS_ERROR',
      'Perks could not be read from this export. Your imported data is unchanged. Drop the export again to retry.',
    ],
  ] as const;

  test.each(CONSTANT_ROWS)('%s is the approved wording', (name, literal) => {
    expect(playtimeCopy[name]).toBe(literal);
  });

  test('the kind labels, column headers and card titles are pinned', () => {
    expect(playtimeCopy.TIMELINE_KIND_LABELS).toEqual({
      name: 'Name',
      service: 'Service',
      language: 'Language',
      country: 'Country',
      ban: 'Ban',
      thirdParty: 'Third party',
    });
    expect(playtimeCopy.TIMELINE_COLUMN_LABELS).toEqual({
      date: 'Date',
      kind: 'Kind',
      entry: 'Entry',
    });
    expect(playtimeCopy.PERKS_CARD_TITLES).toEqual({
      subscriptions: 'Subscriptions',
      coupons: 'Personal coupons',
      bonusCodes: 'Bonus codes',
      surveys: 'Surveys',
    });
  });

  test('the showing line reads "all" when nothing is filtered out', () => {
    expect(playtimeCopy.formatTimelineShowing(3, 3)).toBe('Showing all 3 entries');
    expect(playtimeCopy.formatTimelineShowing(0, 0)).toBe('Showing all 0 entries');
  });

  test('the showing line counts both figures through the locale formatter', () => {
    expect(playtimeCopy.formatTimelineShowing(3, 1200)).toBe(
      `Showing 3 of ${playtimeCopy.formatNumber(1200)} entries`,
    );
    expect(playtimeCopy.formatTimelineShowing(3, 1200)).toContain(playtimeCopy.formatNumber(1200));
  });

  test('the merge note is singular for exactly one merged row', () => {
    expect(playtimeCopy.formatMergeNote(1)).toBe(
      '1 entry is identical on more than one account and is shown once, with a tag for each account.',
    );
    expect(playtimeCopy.formatMergeNote(4)).toBe(
      `${playtimeCopy.formatNumber(4)} entries are identical on more than one account and are shown once, with a tag for each account.`,
    );
    expect(playtimeCopy.formatMergeNote(2)).toContain('entries are identical');
    expect(playtimeCopy.formatMergeNote(1)).not.toContain('entries are identical');
  });

  test('the Perks mask set says codes AND addresses, and the IP-only set is untouched', () => {
    // The timeline reuses the IP-only constants verbatim; Perks needs its own
    // wording because a coupon code sits under the same reveal.
    expect(playtimeCopy.PERKS_MASK_TOGGLE_SHOW).not.toBe(playtimeCopy.MASK_TOGGLE_SHOW);
    expect(playtimeCopy.PERKS_MASK_TOGGLE_HIDE).not.toBe(playtimeCopy.MASK_TOGGLE_HIDE);
    expect(playtimeCopy.PERKS_MASK_CAPTION_MASKED).not.toBe(playtimeCopy.MASK_CAPTION_MASKED);
    expect(playtimeCopy.PERKS_MASK_CAPTION_REVEALED).not.toBe(playtimeCopy.MASK_CAPTION_REVEALED);
    expect(playtimeCopy.PERKS_MASK_ANNOUNCE_SHOWN).not.toBe(playtimeCopy.MASK_ANNOUNCE_SHOWN);
    expect(playtimeCopy.PERKS_MASK_ANNOUNCE_MASKED).not.toBe(playtimeCopy.MASK_ANNOUNCE_MASKED);
    expect(playtimeCopy.PERKS_MASK_CAPTION_MASKED).toContain('Codes and IP addresses');
    expect(playtimeCopy.MASK_CAPTION_MASKED).not.toContain('Codes');

    // The IP-only wording Login history and HEAT already ship, byte for byte.
    expect(playtimeCopy.MASK_TOGGLE_SHOW).toBe('Show full IP addresses');
    expect(playtimeCopy.MASK_TOGGLE_HIDE).toBe('Hide full IP addresses');
    expect(playtimeCopy.MASK_CAPTION_MASKED).toBe(
      'IP addresses are masked: the last part of each one is hidden.',
    );
    expect(playtimeCopy.MASK_CAPTION_REVEALED).toBe(
      'Full IP addresses are shown. Hide them again before sharing your screen.',
    );
    expect(playtimeCopy.MASK_ANNOUNCE_SHOWN).toBe('Full IP addresses are now shown.');
    expect(playtimeCopy.MASK_ANNOUNCE_MASKED).toBe('IP addresses are now masked.');
  });

  test('every loading sentence ends in three ASCII dots and every error is fixed text', () => {
    for (const loading of [playtimeCopy.TIMELINE_LOADING, playtimeCopy.PERKS_LOADING]) {
      expect(loading.endsWith('...')).toBe(true);
      expect(loading).not.toContain('…');
    }
    for (const error of [playtimeCopy.TIMELINE_ERROR, playtimeCopy.PERKS_ERROR]) {
      expect(
        error.endsWith('Your imported data is unchanged. Drop the export again to retry.'),
      ).toBe(true);
      expect(error).not.toMatch(/[{}$]/);
      // No file, no account and no worker's detail: the sentence names the pane
      // and nothing else (T-12-15).
      expect(error).not.toMatch(/\.csv|account id|A1|Error:/i);
    }
  });

  test('the About disclosures read the way the headings promise', () => {
    expect(playtimeCopy.formatAboutThis(playtimeCopy.ABOUT_NAME_TIMELINE)).toBe(
      'About this timeline',
    );
    expect(playtimeCopy.formatAboutThis(playtimeCopy.ABOUT_NAME_PERKS)).toBe(
      'About this perks pane',
    );
  });

  test('the word email appears in the timeline About body and in no other Phase 12 string', () => {
    const strings: readonly (string | Record<string, string>)[] = [
      playtimeCopy.TIMELINE_INTRO,
      playtimeCopy.PERKS_INTRO,
      playtimeCopy.TIMELINE_KIND_FILTER_LABEL,
      playtimeCopy.TIMELINE_KIND_ALL,
      playtimeCopy.TIMELINE_KIND_LABELS,
      playtimeCopy.TIMELINE_COLUMN_LABELS,
      playtimeCopy.PERKS_CARD_TITLES,
      playtimeCopy.PERKS_MASK_TOGGLE_SHOW,
      playtimeCopy.PERKS_MASK_TOGGLE_HIDE,
      playtimeCopy.PERKS_MASK_CAPTION_MASKED,
      playtimeCopy.PERKS_MASK_CAPTION_REVEALED,
      playtimeCopy.PERKS_MASK_ANNOUNCE_SHOWN,
      playtimeCopy.PERKS_MASK_ANNOUNCE_MASKED,
      playtimeCopy.TIMELINE_LOADING,
      playtimeCopy.PERKS_LOADING,
      playtimeCopy.TIMELINE_ERROR,
      playtimeCopy.PERKS_ERROR,
      playtimeCopy.PERKS_ABOUT,
    ];
    for (const value of strings) {
      const text = typeof value === 'string' ? value : Object.values(value).join(' ');
      expect(text.toLowerCase()).not.toContain('email');
    }
    expect(playtimeCopy.TIMELINE_ABOUT.toLowerCase()).toContain('email');
  });

  test('the Phase 12 block interpolates a NUMBER and nothing else (T-12-15)', () => {
    // A zip entry name, a nickname or an account id is untrusted content: if a
    // formatter ever takes one, the only thing that can be true of the result
    // is that the copy lied about where the word came from. The scan reads the
    // block with its comments stripped, so prose about the rule cannot satisfy
    // the rule.
    const source = readFileSync(path.join(REPO_ROOT, 'src/lib/ui-copy.ts'), 'utf8');
    const marker = source.indexOf('// Phase 12 - Account timeline and Perks');
    expect(marker, 'the Phase 12 block carries its own header').toBeGreaterThan(-1);
    const block = source
      .slice(marker)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');

    const templates = [...block.matchAll(/`([^`]*)`/g)].map((match) => match[1] ?? '');
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      for (const interpolation of template.matchAll(/\$\{([^}]*)\}/g)) {
        expect(interpolation[1]).toMatch(/^formatNumber\(/);
      }
    }
  });
});
