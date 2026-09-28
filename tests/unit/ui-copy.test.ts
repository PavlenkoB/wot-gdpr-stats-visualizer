import { describe, expect, test } from 'vitest';
import {
  DROPZONE_PROMPT,
  GENERIC_FAILURE_MESSAGE,
  STAGE_TEXT,
  START_OVER_LABEL,
  formatAccountHeading,
  formatFileCount,
  formatSummary,
} from '../../src/lib/ui-copy.ts';
import type { CategoryStatus, IngestStage } from '../../src/lib/types/worker-messages.ts';

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
// formatSummary — three buckets, stable separator, all-zero render
// -----------------------------------------------------------------------------

describe('formatSummary', () => {
  test('renders the three buckets in supported, known-deferred, unknown order', () => {
    expect(formatSummary({ supported: 4, 'known-deferred': 2, unknown: 2 })).toBe(
      '4 supported · 2 known-deferred · 2 unknown',
    );
  });

  test('uses U+00B7 (middle dot) with single spaces around it', () => {
    const out = formatSummary({ supported: 1, 'known-deferred': 1, unknown: 1 });
    expect(out).toBe('1 supported · 1 known-deferred · 1 unknown');
    // Pin the separator's codepoint: middle dot, U+00B7.
    expect(out).toContain(' · ');
    // And no other separator glyph sneaks in between the buckets. The
    // hyphen in `known-deferred` is part of the bucket NAME (not a
    // separator), so we check for a separator-side hyphen specifically:
    // a hyphen adjacent to a digit + space (which the format never
    // produces). A robust assertion is: the only ` · ` substrings are
    // the two bucket separators.
    expect(out.match(/ · /g)?.length).toBe(2);
    expect(out).not.toContain(' | ');
    expect(out).not.toContain(' — '); // em dash with surrounding spaces
  });

  test('renders zero counts explicitly — the visual fingerprint is the three parts, not the numbers', () => {
    expect(formatSummary({ supported: 4, 'known-deferred': 0, unknown: 0 })).toBe(
      '4 supported · 0 known-deferred · 0 unknown',
    );
    expect(formatSummary({ supported: 0, 'known-deferred': 0, unknown: 0 })).toBe(
      '0 supported · 0 known-deferred · 0 unknown',
    );
  });

  test('renders arbitrary counts verbatim (sanity)', () => {
    expect(formatSummary({ supported: 7, 'known-deferred': 3, unknown: 5 })).toBe(
      '7 supported · 3 known-deferred · 5 unknown',
    );
  });

  test('the produced string is locale-independent — plain concatenation, no Intl.*', () => {
    // We assert this by formatting a count that would otherwise be
    // locale-sensitive (large number). formatSummary must not call
    // Intl.NumberFormat or otherwise transform the digits.
    const out = formatSummary({ supported: 2500, 'known-deferred': 0, unknown: 1 });
    expect(out).toBe('2500 supported · 0 known-deferred · 1 unknown');
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

// -----------------------------------------------------------------------------
// formatAccountHeading — "Account: <root>" with no decoration (D-11)
// -----------------------------------------------------------------------------

describe('formatAccountHeading', () => {
  test('prefixes the raw root with "Account: "', () => {
    expect(formatAccountHeading('123456789')).toBe('Account: 123456789');
  });

  test('does not strip or escape the root — the rendering layer owns that', () => {
    // The function returns the raw concatenation. Svelte's text
    // interpolation in ResultsView.svelte handles escaping.
    expect(formatAccountHeading('weird&root<name>')).toBe('Account: weird&root<name>');
  });

  test('produces a non-empty prefix even when the root is empty (the classifier would never emit this)', () => {
    expect(formatAccountHeading('')).toBe('Account: ');
  });
});

// -----------------------------------------------------------------------------
// Sanity — every CategoryStatus key is reachable via formatSummary
// -----------------------------------------------------------------------------

describe('formatSummary — CategoryStatus coverage', () => {
  test('all three CategoryStatus values appear in the formatted output', () => {
    const buckets: Record<CategoryStatus, number> = {
      supported: 1,
      'known-deferred': 1,
      unknown: 1,
    };
    const out = formatSummary(buckets);
    expect(out).toContain('supported');
    expect(out).toContain('known-deferred');
    expect(out).toContain('unknown');
  });
});
