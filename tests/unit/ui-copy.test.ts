import { describe, expect, test } from 'vitest';
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
} from '../../src/lib/ui-copy.ts';
import type { IngestStage } from '../../src/lib/types/worker-messages.ts';
// A NAMESPACE import on purpose: a named import of a constant that does not
// exist yet is a link error that takes the whole file down, so the RED run
// would report zero discovered tests instead of six failing ones. With a
// namespace the six tests each fail on their own value assertion. Plan 04-04
// reuses this import.
import * as playtimeCopy from '../../src/lib/ui-copy.ts';
import { DURATION_BIN_COUNT } from '../../src/lib/playtime-shared.ts';

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
      'payment-history': 'Payment_history',
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
    expect(SECTION_NOTE_USER_INFO).toBe('Account details are shown in the header above');
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
    expect(IDENTITY_REGION_LABEL).toBe('Region (per export)');
    expect(IDENTITY_CREATED_LABEL).toBe('Account created');
    expect(UNKNOWN_VALUE).toBe('Unknown');
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
