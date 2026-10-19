import { describe, expect, it } from 'vitest';
import type { CapturedFile, CapturedHeaders } from '../../fixtures/new-data-headers.ts';

// =============================================================================
// Phase 11 captured-header constants guard (plan 11-02 Task 3, T-11-06).
// =============================================================================
//
// WHAT THIS FILE IS
// A names-only lint over `tests/fixtures/new-data-headers.ts`, the module that
// transcribes `.planning/phases/11-new-game-data/11-HEADERS.txt` — the header
// capture the USER produced by running `header_capture.py` on their own export
// zip. Every later plan (11-03, 11-07, 11-08, 11-10, 11-11) builds its
// allowlist specs, label maps and fixtures from those constants, so a value that
// leaked into them would be committed and would reach a shipped bundle.
//
// WHY A LINT RATHER THAN A SNAPSHOT
// A snapshot would only prove the file has not changed; it would happily accept a
// file that had an email address in it from the start. These assertions are
// properties of every token rather than of one expected list, so they also hold
// for a future capture that gains new columns.
//
// THE FOUR SHAPES A LEAK TAKES (T-11-06)
//   1. an at-sign — an email address or a login, the one personal value the
//      capture script's token pattern is designed to keep out;
//   2. an all-digit token — an account number or a numeric data row;
//   3. a run of four or more digits — a real Wargaming account id, which is
//      longer than any column name and never contains a letter;
//   4. a token that is not identifier-shaped at all — a nickname, a city name,
//      a free-text answer, or the `HDR [suppressed]` marker.
//
// The account-folder relabel is asserted separately for the same reason: the
// capture prints `ACCT-A`/`ACCT-B`, and a real numeric root must never appear.
//
// WHY THE IMPORT IS PROBED RATHER THAN STATIC
// This module is the artifact the task creates, so before it exists a static
// import would fail the whole FILE at load time — which is a collection fault,
// not a test failure, and says nothing about the lint. Probing the import turns
// "the names-only module is missing" into the first ordinary failing assertion
// and lets the shape assertions below run and fail on their own terms. Once the
// module exists the probe is a plain `await import` and the two paths are the
// same, so nothing about the GREEN behaviour is special-cased here.
//
// WHY THIS TEST NEVER READS `.planning/`
// The raw capture is the one file in the phase that came out of the user's real
// export, and it lives outside the test tree on purpose. This guard lints the
// TRANSCRIPTION, which is the thing every plan imports; making it re-read the
// raw file would couple a unit test to a planning artifact and would put the
// real-data path back on the unit-test read path it was kept off.

/** The capture's own refusal marker, which must never be stored as a column. */
const SUPPRESSED = '[suppressed]';

/** A column name, as `header_capture.py` defines identifier-like. */
const IDENTIFIER_TOKEN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Four or more consecutive digits: an account number, never a column name. */
const DIGIT_RUN = /\d{4,}/;

/** The one account label shape the capture may print (T-11-06). */
const ACCOUNT_LABEL = /^ACCT-[A-Z]$/;

const loaded = await import('../../fixtures/new-data-headers.ts').catch(() => null);

/** Empty before GREEN, the real capture after it. Every shape test reads this. */
const files: readonly CapturedFile[] = loaded?.CAPTURED_FILES ?? [];

/** Null before GREEN; the real helper after it. */
const headersOf: (key: string) => CapturedHeaders | null = loaded?.headersOf ?? (() => null);

const keysOf = (list: readonly CapturedFile[]): string[] => list.map((file) => file.key);

/**
 * Every file key plan 11-02's interface block names, except the Surveys file.
 *
 * `HEAT_Surveys.csv` is deliberately absent from the REQUIRED list: it sits in
 * the unknown `Surveys` folder and belongs to Phase 12 (PERKS-03), so a capture
 * may legitimately hold it or not. `HEAT_Device_Info.csv` IS required — it is a
 * target file with a deliberate "no spec, stores nothing (D-15)" decision, so
 * its absence would mean the capture silently missed a target file rather than
 * that it was out of scope.
 */
const REQUIRED_KEYS: readonly string[] = [
  'heat_game_sessions.csv',
  'heat_session_geolocation.csv',
  'wotc_game_sessions.csv',
  'heat_device_info.csv',
  'heat_account_statistics.csv',
  'heat_account_storage.csv',
  'heat_battle_types_statistics.csv',
  'wowp_19_account_statistics.csv',
  'wowp_19_plane_statistics.csv',
  'wowp_20_account_statistics.csv',
  'wowp_20_plane_statistics.csv',
  'wows_crews.csv',
  'wows_account_storage.csv',
];

describe('the names-only capture module', () => {
  it('exists and is importable', () => {
    expect(loaded, 'tests/fixtures/new-data-headers.ts').not.toBeNull();
  });

  it('holds one entry per FILE group of the capture', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });
});

describe('CAPTURED_FILES', () => {
  it('records only identifier-shaped header tokens', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).toMatch(IDENTIFIER_TOKEN);
      }
    }
  });

  it('records no token that is all digits', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).not.toMatch(/^\d+$/);
      }
    }
  });

  it('records no at-sign anywhere, which is the shape of an email or a login', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).not.toContain('@');
      }
      expect(file.key).not.toContain('@');
      expect(file.folder).not.toContain('@');
    }
  });

  it('records no run of four or more digits in a key, a folder or a header', () => {
    for (const file of files) {
      expect(file.key, 'key').not.toMatch(DIGIT_RUN);
      expect(file.folder, `${file.key} folder`).not.toMatch(DIGIT_RUN);
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).not.toMatch(DIGIT_RUN);
      }
    }
  });

  it('records the suppressed marker only as a whole header list, never as a token', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token).not.toBe(SUPPRESSED);
      }
    }
  });

  it('relabels every account folder as ACCT-X', () => {
    for (const file of files) {
      expect(file.account, `${file.key} account`).toMatch(ACCOUNT_LABEL);
    }
  });

  it('carries a comma, a semicolon or nothing — never another delimiter', () => {
    for (const file of files) {
      expect([null, ';', ','], `${file.key} delimiter`).toContain(file.delimiter);
    }
  });

  it('records positive sizes and line counts for every captured file', () => {
    for (const file of files) {
      expect(file.bytes, `${file.key} bytes`).toBeGreaterThan(0);
      expect(file.nonEmptyLines, `${file.key} nonEmptyLines`).toBeGreaterThan(0);
    }
  });

  it('keys every entry by its lower-cased file name', () => {
    for (const file of files) {
      expect(file.key).toBe(file.fileName.toLowerCase());
    }
  });

  it('carries a header list for every captured file in this capture', () => {
    for (const file of files) {
      expect(file.headers, `${file.key} headers`).not.toBeNull();
      expect(file.headers?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('holds every file key the plan interface block expects', () => {
    const seen = keysOf(files);
    for (const key of REQUIRED_KEYS) {
      expect(seen, `captured key ${key}`).toContain(key);
    }
  });

  it('repeats a key once per account that holds it, and never otherwise', () => {
    const seen = keysOf(files);
    for (const key of new Set(seen)) {
      const accounts = files.filter((file) => file.key === key).map((file) => file.account);
      expect(new Set(accounts).size, `${key} accounts`).toBe(accounts.length);
    }
  });
});

describe('headersOf', () => {
  it('returns the header list of a captured file key', () => {
    const found = headersOf('heat_game_sessions.csv');
    expect(found).not.toBeNull();
    expect(found?.headers).toContain('STARTED_AT');
  });

  it('reports no divergence for every key in this capture', () => {
    for (const key of new Set(keysOf(files))) {
      expect(headersOf(key)?.divergent, `${key} divergent`).toBe(false);
    }
  });

  it('returns null for a file key the capture does not hold', () => {
    expect(headersOf('not_a_captured_file.csv')).toBeNull();
  });

  it('never returns an empty or suppressed header list', () => {
    for (const key of new Set(keysOf(files))) {
      const found = headersOf(key);
      expect(found?.headers.length ?? 0).toBeGreaterThan(0);
      expect(found?.headers ?? []).not.toContain(SUPPRESSED);
    }
  });
});
