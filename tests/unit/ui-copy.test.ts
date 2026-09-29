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
