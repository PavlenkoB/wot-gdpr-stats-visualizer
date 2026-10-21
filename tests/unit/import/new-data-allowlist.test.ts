// =============================================================================
// new-data-allowlist.test.ts — the per-file column allowlist (11-01, D-08/D-15)
// =============================================================================
//
// WHAT THIS PROVES, in two halves.
//
// PURE — the four functions, with no worker and no archive:
//   1. `specFor` answers a spec for a family file in the RIGHT category and
//      null for a wrong category, an unknown name, and a name outside the
//      family (T-11-03).
//   2. `isNewDataFile` is by NAME and case-insensitive, and a family name with
//      no spec is still a family name (D-15).
//   3. `projectRow` keeps only spec columns, under the SPEC's header constants,
//      whatever the file wrote: lower case, padded, BOM-prefixed, duplicated,
//      `__proto__`, `__parsed_extra`, an over-long cell (T-11-02).
//   4. `fileMatchesSpec` is decided per FILE, so a ragged row inside a matching
//      file does not drop it (11-RESEARCH Pitfall 3).
//
// WORKER — through the real ingest path: the two-account archive stores HEAT
// and WOTC session rows under spec keys only, no canary string appears anywhere
// in `db.rows` or in `meta`, a family file with no spec stores nothing, and a
// spec file whose headers match nothing stores nothing while the import still
// succeeds and the aggregators still see its rows.
//
// The canaries are planted in the FIXTURE (`tests/fixtures/new-data-fixtures.ts`).
// A negative assertion over an input that carries no canary would pass against
// any build, including one that stored the whole row.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_NEW_DATA_CELL,
  fileMatchesSpec,
  isFamilyCategory,
  isNewDataFile,
  looksLikeEmail,
  projectRow,
  specFor,
  type AllowlistSpec,
} from '../../../src/lib/worker/new-data-allowlist.ts';
import { NEW_DATA_SPEC_FILES, type SpecColumn } from '../../../src/lib/worker/new-data-specs.ts';
import {
  CAPTURED_FILES,
  COLUMN_RISK_ANSWERS,
  PANE_MAPPING,
  headersOf,
  type ColumnRisk,
} from '../../fixtures/new-data-headers.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import { buildNewGamesExport } from '../../fixtures/multi-account-fixtures.ts';
import {
  NG_CANARY_ACCOUNT_ID,
  NG_CANARY_EMAIL,
  NG_CANARY_NICKNAME,
  NG_EXPECTED,
  NG_HEAT_SESSIONS_A,
  NG_ROOT_A,
} from '../../fixtures/new-data-fixtures.ts';

/** The spec this file's whole worker half is about. */
const HEAT_SPEC = specFor('activity_history', 'HEAT_Game_Sessions.csv');
const WOTC_SPEC = specFor('activity_history', 'WOTC_Game_Sessions.csv');

/** A spec that is known to exist, for the pure cases that do not care which. */
function aSpec() {
  if (HEAT_SPEC === null) throw new Error('no spec for heat_game_sessions.csv');
  return HEAT_SPEC;
}

// -----------------------------------------------------------------------------
// 11-03: the captured headers, the two vocabularies, and the decision table
// -----------------------------------------------------------------------------

/**
 * The files the spec table must name: the two session specs plan 11-01 wrote,
 * plus one entry per pane and Warplanes file in `11-HEADERS.md`, plus the
 * Surveys file plan 12-02 gave a spec, plus the Phase 12 timeline and Perks
 * files plan 12-08 transcribed from `12-HEADERS.md`.
 *
 * Spelled out rather than derived from the spec table, because a list derived
 * from the thing it checks asserts only that the check reads what it wrote.
 */
const SPEC_KEYS: readonly string[] = [
  'account_name_history.csv',
  'authorized_third_parties.csv',
  'bans.csv',
  'bonus_code_usage.csv',
  'external_services_history.csv',
  'heat_account_statistics.csv',
  'heat_account_storage.csv',
  'heat_battle_types_statistics.csv',
  'heat_game_sessions.csv',
  'heat_session_geolocation.csv',
  'heat_surveys.csv',
  'language_and_country_history.csv',
  'personal_coupons.csv',
  'subscriptions.csv',
  'wotc_game_sessions.csv',
  'wowp_19_account_statistics.csv',
  'wowp_19_plane_statistics.csv',
  'wowp_20_account_statistics.csv',
  'wowp_20_plane_statistics.csv',
  'wows_account_storage.csv',
  'wows_crews.csv',
];

/** The folder the CAPTURE filed one spec file in, lower-cased as a category. */
function folderOf(key: string): string {
  const file = CAPTURED_FILES.find((entry) => entry.key === key);
  if (file === undefined) throw new Error(`no capture for ${key}`);
  return file.folder.toLowerCase();
}

/** The folder the CAPTURE filed one file in, spelled as the archive spells it. */
function capturedFolderOf(key: string): string {
  const file = CAPTURED_FILES.find((entry) => entry.key === key);
  if (file === undefined) throw new Error(`no capture for ${key}`);
  return file.folder;
}

/** The captured header list of one spec file, as a set. */
function capturedHeaders(key: string): Set<string> {
  const captured = headersOf(key);
  if (captured === null || captured.headers === null) {
    throw new Error(`no captured headers for ${key}`);
  }
  return new Set(captured.headers);
}

/** The two session specs, whose vocabulary is the aggregators' rather than the capture's. */
const SESSION_KEYS: readonly string[] = ['heat_game_sessions.csv', 'wotc_game_sessions.csv'];

/** The four WOWP files, whose vocabulary is the Vehicles builder's. */
const WOWP_KEYS: readonly string[] = [
  'wowp_19_account_statistics.csv',
  'wowp_19_plane_statistics.csv',
  'wowp_20_account_statistics.csv',
  'wowp_20_plane_statistics.csv',
];

/**
 * The seven headers the Playtime and Login aggregators read off a session row.
 *
 * A third allowance source beside the capture and the builder vocabulary, and
 * scoped to the two session files ONLY. The captured headers of a real session
 * file carry some of these and not others, and narrowing a session spec to the
 * capture would change which sessions those two aggregators count (D-08, D-10) —
 * so both session specs hold all seven whatever the capture says, and the
 * source-text case below pins the list to the code that reads it.
 */
const SESSION_AGGREGATOR_VOCABULARY: readonly string[] = [
  // `resolveSessionColumns` in playtime-aggregate.ts accepts the alias pair.
  'STARTED_AT',
  'FINISHED_AT',
  'SESSION_START',
  'SESSION_END',
  // `resolveSessionColumns` again: the two split columns the Playtime pane reads.
  'SERVER_NAME',
  'CLIENT_PLATFORM',
  // `TIME_COLUMN_NAMES` in login-aggregate.ts takes STARTED_AT and SESSION_START;
  // `IP_COLUMN_NAME` there is the address the Logins pane masks (D-04).
  'IP',
];

/**
 * `WOWP_FILE_HEADER_VOCABULARY`, read through a cast rather than a named import.
 *
 * A STATIC import of an export this plan creates would fail the whole FILE at
 * load, which is a collection fault rather than a failing assertion and proves
 * nothing about the lints below (the rule 11-02 set out). The module itself
 * exists, so the dynamic import always resolves and the missing export is an
 * ordinary `undefined` the assertions report.
 */
const vehicleModule =
  (await import('../../../src/lib/features/vehicles/vehicle-aggregate.ts')) as unknown as {
    WOWP_FILE_HEADER_VOCABULARY?: ReadonlyMap<string, readonly string[]>;
  };

const WOWP_VOCABULARY: ReadonlyMap<string, readonly string[]> =
  vehicleModule.WOWP_FILE_HEADER_VOCABULARY ?? new Map<string, readonly string[]>();

/** Repo-relative source text, for the case that pins the vocabulary to its reader. */
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const sourceOf = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

/**
 * The personal-identity words a stored header may not contain.
 *
 * Substring tests, deliberately: `FIRST_LOGIN_DT` catches `LOGIN` and
 * `CLIENT_PLATFORM` catches `LAT` inside `PLATFORM`, which is exactly why the
 * exceptions map below exists and why it is required to carry a reason.
 */
const IDENTITY_TOKENS: readonly string[] = [
  'NAME',
  'NICK',
  'LOGIN',
  'MAIL',
  'BIRTH',
  'BDAY',
  'PHONE',
  'PASS',
  'TOKEN',
  'SECRET',
  'HASH',
  'UUID',
  'GUID',
  'SPA',
  'USER',
  'ACCOUNT',
  'DEVICE',
  'IP',
  'LAT',
  'LON',
  'COORD',
  'CITY',
  'TOWN',
  'POSTAL',
  'ZIP',
  'STREET',
];

/** Does this stored header suggest a person, an account or a device identity? */
function matchesIdentityPattern(header: string): boolean {
  if (header === 'ID') return true;
  return IDENTITY_TOKENS.some((token) => header.includes(token));
}

/**
 * Every spec column that matches {@link matchesIdentityPattern}, with the reason
 * it is stored anyway — keyed `file key -> header`, nothing else in it.
 *
 * Three families and nothing else: a game-object id or name the decision table
 * allowed, the address of the three files rule (c) admits it into, and the two
 * session columns the aggregators read. Every reason cites the rule that decided
 * it, so a later reader can disagree with the DECISION rather than with a
 * comment.
 */
const IDENTITY_EXCEPTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'heat_game_sessions.csv': {
    IP: 'Rule (c): the two session files may carry the address, and the Logins pane masks it (D-04).',
    SERVER_NAME: 'A server label the Playtime split columns read, not a person.',
    CLIENT_PLATFORM:
      'A platform label the Playtime split columns read; the match is the LAT inside PLATFORM.',
  },
  'wotc_game_sessions.csv': {
    IP: 'Rule (c): the two session files may carry the address, and the Logins pane masks it (D-04).',
    SERVER_NAME: 'A server label the Playtime split columns read, not a person.',
    CLIENT_PLATFORM:
      'A platform label the Playtime split columns read; the match is the LAT inside PLATFORM.',
  },
  'heat_session_geolocation.csv': {
    IP: 'Rule (c): this file is one of the three that may store a masked address (D-04).',
  },
  'heat_account_statistics.csv': {
    FIRST_LOGIN_DT: 'Rule (e): a lifecycle timestamp; the word LOGIN is not a login NAME.',
    FIRST_LOGIN_PLATFORM: 'Rule (e): an enumeration of the first client, not an identity.',
  },
  'heat_account_storage.csv': {
    ASSET_NAME: 'Rule (d): an in-game item label, not a person (11-HEADERS.md Notes 7).',
  },
  'wows_crews.csv': {
    CREW_SHIP:
      'Rule (d): the ship a crew belongs to — a game object; the match is the IP at the end of SHIP.',
    CREW_SHIP_TRAINED:
      'Rule (e): a flag saying which ship the crew was trained on; the match is the IP at the end of SHIP.',
  },
  'wowp_19_plane_statistics.csv': {
    VEHICLE_NAME: 'Rule (d): the vehicle identifier the Vehicles builder reads, not a person.',
  },
  'heat_surveys.csv': {
    SKIPPED_BY_PLAYER:
      'Rule (a) would exclude it, but the column is a flag; the match is the IP inside SKIPPED.',
  },
  // 12-08. The Phase 12 columns the identity pattern flags, each with the decision rule that admits it.
  'account_name_history.csv': {
    OLD_NAME:
      'Rule (c) of 12-HEADERS.md: a past nickname is admitted in this one file only (orchestrator default 4).',
    NEW_NAME:
      'Rule (c) of 12-HEADERS.md: a past nickname is admitted in this one file only (orchestrator default 4).',
  },
  'external_services_history.csv': {
    NAME: 'Rule (f): a lower-case service token the user rated no risk, not a person (12-HEADERS.md).',
  },
  'language_and_country_history.csv': {
    NAME: 'Rule (f): it discriminates whether VALUE holds a language or a country, not a person.',
  },
  'bonus_code_usage.csv': {
    USER_IP:
      'Rule (d) of 12-HEADERS.md: the Bonus_Codes file may store the redeeming address, masked on screen (D-14).',
  },
};

// -----------------------------------------------------------------------------
// 12-08: the Phase 12 specs against the user's own per-column risk answers
// -----------------------------------------------------------------------------

/**
 * The nine Phase 12 spec keys, spelled out. They are the rows of the Pane mapping
 * of `12-HEADERS.md`; a test below pins the list to the typed mapping so neither
 * can drift on its own.
 */
const PHASE12_KEYS: readonly string[] = [
  'account_name_history.csv',
  'authorized_third_parties.csv',
  'bans.csv',
  'bonus_code_usage.csv',
  'external_services_history.csv',
  'heat_surveys.csv',
  'language_and_country_history.csv',
  'personal_coupons.csv',
  'subscriptions.csv',
];

/** The only files a coupon or bonus code may be stored in (D-13). */
const CODE_FILES: readonly string[] = ['personal_coupons.csv', 'bonus_code_usage.csv'];

/** The only files an IP address may be stored in (D-14). */
const ADDRESS_FILES: readonly string[] = [
  'bans.csv',
  'authorized_third_parties.csv',
  'bonus_code_usage.csv',
];

/** The name history file key: the mapped Name row of the Pane mapping. */
const NAME_HISTORY_KEY: string | null =
  PANE_MAPPING.find((row) => row.cardOrKind === 'Name' && row.status === 'mapped')?.fileKey ?? null;

/** A yes or an unsure counts as a yes for every risk question (12-HEADERS.md). */
const flagged = (answer: ColumnRisk[keyof ColumnRisk]): boolean =>
  answer === 'yes' || answer === 'unsure';

/**
 * Every way ONE spec column breaks the user's own answers about it.
 *
 * Pure: it takes the column, the answers recorded for it (or `undefined`) and the
 * name history file key. Each message names the file, the column and the field,
 * so a failing lint says which decision was overruled.
 */
function riskViolations(
  fileKey: string,
  column: { readonly header: string; readonly kind: string },
  answers: ColumnRisk | undefined,
  nameHistoryKey: string | null,
): string[] {
  const where = `${fileKey} / ${column.header}`;
  if (answers === undefined) return [`${where}: no recorded answer`];
  const out: string[] = [];
  if (flagged(answers.email)) out.push(`${where}: email answer is ${answers.email}`);
  if (flagged(answers.freeText)) out.push(`${where}: freeText answer is ${answers.freeText}`);
  if (flagged(answers.personName) && fileKey !== nameHistoryKey) {
    out.push(`${where}: personName answer is ${answers.personName} outside the name history`);
  }
  if (flagged(answers.ip) && column.kind !== 'address') {
    out.push(`${where}: ip answer is ${answers.ip} but the kind is ${column.kind}`);
  }
  if (flagged(answers.code) && column.kind !== 'code') {
    out.push(`${where}: code answer is ${answers.code} but the kind is ${column.kind}`);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Pure: which file is a new-data file, and which spec applies to it
// -----------------------------------------------------------------------------

describe('isNewDataFile: the family test is by NAME and ignores the folder', () => {
  it('matches the HEAT and WOTC families whatever the rest of the name is', () => {
    expect(isNewDataFile('HEAT_Game_Sessions.csv')).toBe(true);
    expect(isNewDataFile('WOTC_Game_Sessions.csv')).toBe(true);
    expect(isNewDataFile('heat_anything.csv')).toBe(true);
    expect(isNewDataFile('wotc_anything.csv')).toBe(true);
    expect(isNewDataFile('HEAT_Device_Info.csv')).toBe(true);
  });

  it('matches EVERY wowp_ name, so a revision the table has no spec for stores nothing', () => {
    // Deliberately wider than the two revisions the capture holds: a future
    // revision is in the family, has no spec, and therefore fails closed.
    expect(isNewDataFile('WOWP_19_Plane_Statistics.csv')).toBe(true);
    expect(isNewDataFile('WOWP_21_Anything.csv')).toBe(true);
    expect(isNewDataFile('wowp_anything_at_all.csv')).toBe(true);
  });

  it('matches exactly the two WoWS names this app reads, and no others', () => {
    expect(isNewDataFile('WOWS_Crews.csv')).toBe(true);
    expect(isNewDataFile('WOWS_Account_Storage.csv')).toBe(true);
    // Anchored on the whole name, so the Vehicles-owned Warships files stay
    // outside the family and keep being stored exactly as they always were.
    expect(isNewDataFile('WOWS_Ship_Statistics.csv')).toBe(false);
    expect(isNewDataFile('WOWS_Account_Statistics.csv')).toBe(false);
    expect(isNewDataFile('WOWS_Battle_Types_Statistics.csv')).toBe(false);
    expect(isNewDataFile('WOWS_Crews_Extra.csv')).toBe(false);
    expect(isNewDataFile('WOWS_Account_Storage_Extra.csv')).toBe(false);
  });

  it('is case-insensitive and folder-blind', () => {
    // The caller passes a bare file name, so the folder cannot even reach it —
    // which is the point: a family file filed anywhere is still a family file.
    expect(isNewDataFile('heat_game_sessions.csv')).toBe(true);
    expect(isNewDataFile('HeAt_Game_Sessions.CSV')).toBe(true);
  });

  it('does not match a file that is not in a family', () => {
    expect(isNewDataFile('WOT_Game_Sessions.csv')).toBe(false);
    expect(isNewDataFile('WOWS_Game_Sessions.csv')).toBe(false);
    expect(isNewDataFile('Game_Active_Sessions.csv')).toBe(false);
    expect(isNewDataFile('Sessions.csv')).toBe(false);
    // Anchored: the family must START the name, not merely appear in it.
    expect(isNewDataFile('OLD_HEAT_Game_Sessions.csv')).toBe(false);
    expect(isNewDataFile('')).toBe(false);
  });
});

describe('isFamilyCategory: the CATEGORY half of the family test (12-02, T-12-04)', () => {
  it('is true for each of the SIX promoted folders, in either spelling', () => {
    expect(isFamilyCategory('Surveys')).toBe(true);
    expect(isFamilyCategory('surveys')).toBe(true);
    expect(isFamilyCategory('SURVEYS')).toBe(true);
    // 12-04 promoted the other five Phase 12 folders. Each one is now a folder
    // the app READS, so each one has to be a folder whose every file fails
    // closed until a spec names it (D-03, T-12-09).
    expect(isFamilyCategory('Authorized_Third_Parties')).toBe(true);
    expect(isFamilyCategory('Bans')).toBe(true);
    expect(isFamilyCategory('Bonus_Codes')).toBe(true);
    expect(isFamilyCategory('Personal_Coupons')).toBe(true);
    expect(isFamilyCategory('Subscriptions')).toBe(true);
    expect(isFamilyCategory('bans')).toBe(true);
    expect(isFamilyCategory('BONUS_CODES')).toBe(true);
    expect(isFamilyCategory('personal_coupons')).toBe(true);
    expect(isFamilyCategory('subscriptions')).toBe(true);
    expect(isFamilyCategory('authorized_third_parties')).toBe(true);
  });

  it('is false for every other category, and for the empty one', () => {
    // The set holds the six promoted folders and nothing else. A category that
    // opts in has EVERY file in it fail closed, so the set is the promotion's
    // ledger and grows only beside the `SUPPORTED` change that made the folder
    // readable.
    //
    // `Game_Forums` is the one that must NOT be here: D-02 leaves it
    // unpromoted precisely because its header carries an EMAIL, and putting it
    // in this set would be the quiet way to promote it (T-12-10).
    expect(isFamilyCategory('Game_Forums')).toBe(false);
    expect(isFamilyCategory('game_forums')).toBe(false);
    expect(isFamilyCategory('Activity_History')).toBe(false);
    expect(isFamilyCategory('Player_Statistics')).toBe(false);
    expect(isFamilyCategory('User_Info')).toBe(false);
    expect(isFamilyCategory('')).toBe(false);
  });
});

describe('isNewDataFile: the three User_Info history files join the family (12-04)', () => {
  it('is true for each of the three history file names, in any case', () => {
    // These three are not in a promoted folder: they sit in `User_Info`,
    // beside `Account_Info.csv`, which is SUPPORTED since Phase 1 — so without
    // this rule they are stored column for column today (12-RESEARCH
    // Finding 1). Making them family files is the NARROWING, not a promotion,
    // and it fails closed: with no spec yet (plan 12-08) they store nothing.
    expect(isNewDataFile('Account_Name_History.csv')).toBe(true);
    expect(isNewDataFile('External_Services_History.csv')).toBe(true);
    expect(isNewDataFile('Language_And_Country_History.csv')).toBe(true);
    expect(isNewDataFile('account_name_history.csv')).toBe(true);
    expect(isNewDataFile('EXTERNAL_SERVICES_HISTORY.CSV')).toBe(true);
    expect(isNewDataFile('language_and_country_history.csv')).toBe(true);
  });

  it('leaves Account_Info.csv — and every near-miss name — outside the family', () => {
    // The pattern is deliberately NOT a prefix. `Account_Info.csv` is the file
    // the identity pick and the Account record read; a prefix rule would make
    // it a family file with no spec and the whole account header would stop
    // storing, which is the opposite of what this change is for.
    expect(isNewDataFile('Account_Info.csv')).toBe(false);
    expect(isNewDataFile('account_info.csv')).toBe(false);
    // Anchored at BOTH ends: a longer or shorter name is a different file.
    expect(isNewDataFile('Account_Name_History_Extra.csv')).toBe(false);
    expect(isNewDataFile('OLD_Account_Name_History.csv')).toBe(false);
    expect(isNewDataFile('Account_Name_History')).toBe(false);
    expect(isNewDataFile('External_Services_History_Extra.csv')).toBe(false);
    expect(isNewDataFile('Language_And_Country.csv')).toBe(false);
    expect(isNewDataFile('Account_History.csv')).toBe(false);
    expect(isNewDataFile('')).toBe(false);
  });
});

describe('specFor: a name, a category, or neither', () => {
  it('answers a spec for each of the two session files', () => {
    expect(HEAT_SPEC).not.toBeNull();
    expect(WOTC_SPEC).not.toBeNull();
    expect(HEAT_SPEC?.key).toBe('heat_game_sessions.csv');
    expect(WOTC_SPEC?.key).toBe('wotc_game_sessions.csv');
    expect(HEAT_SPEC?.category).toBe('activity_history');
  });

  it('answers null in the WRONG category (T-11-03)', () => {
    // The same file name, filed under a different folder. Storing it would let
    // the folder decide the rules, and the folder is attacker-controlled.
    expect(specFor('payment_history', 'HEAT_Game_Sessions.csv')).toBeNull();
    expect(specFor('player_statistics', 'WOTC_Game_Sessions.csv')).toBeNull();
  });

  it('answers null for a family name with no spec (D-15)', () => {
    expect(specFor('device_info', 'HEAT_Device_Info.csv')).toBeNull();
    expect(specFor('player_statistics', 'HEAT_Unlisted_File.csv')).toBeNull();
  });

  it('answers null for a name outside the family at all', () => {
    expect(specFor('activity_history', 'WOT_Game_Sessions.csv')).toBeNull();
    expect(specFor('activity_history', 'Sessions.csv')).toBeNull();
  });

  it('answers the Surveys spec for its own category, and null in any other', () => {
    // Four columns, each mapping to itself, and the two captured columns it
    // excludes (PROFILE_ID, BATTLE_ID) absent by OMISSION.
    const surveys = specFor('surveys', 'HEAT_Surveys.csv');
    expect(surveys).not.toBeNull();
    expect(surveys?.category).toBe('surveys');
    expect(surveys?.key).toBe('heat_surveys.csv');
    expect([...(surveys?.columns.keys() ?? [])].sort()).toEqual([
      'MESSAGE_TS',
      'PLAYER_ANSWER',
      'QUESTION_ID',
      'SKIPPED_BY_PLAYER',
    ]);
    // The same name under another category stores nothing.
    expect(specFor('payment_history', 'HEAT_Surveys.csv')).toBeNull();
  });

  it('is case-insensitive on BOTH arguments', () => {
    expect(specFor('Activity_History', 'HEAT_GAME_SESSIONS.CSV')).not.toBeNull();
  });

  it('the spec table names every pane and Warplanes file the capture holds', () => {
    expect([...NEW_DATA_SPEC_FILES].map((spec) => spec.key).sort()).toEqual([...SPEC_KEYS].sort());
  });

  it('gives every spec the category its file was CAPTURED in, lower-cased', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      expect(spec.category, spec.key).toBe(folderOf(spec.key));
    }
  });
});

// -----------------------------------------------------------------------------
// Pure: the projection
// -----------------------------------------------------------------------------

describe('projectRow: only spec columns, under spec constants', () => {
  it('keeps the three session columns and drops everything else', () => {
    const out = projectRow(
      {
        STARTED_AT: '05.03.2024 20:00',
        FINISHED_AT: '05.03.2024 21:30',
        IP: '192.0.2.10',
        EMAIL: NG_CANARY_EMAIL,
        NICKNAME: NG_CANARY_NICKNAME,
        ACCOUNT_ID: NG_CANARY_ACCOUNT_ID,
      },
      aSpec(),
    );

    expect(out).toEqual({
      STARTED_AT: '05.03.2024 20:00',
      FINISHED_AT: '05.03.2024 21:30',
      IP: '192.0.2.10',
    });
    expect(Object.keys(out)).not.toContain('EMAIL');
    expect(Object.keys(out)).not.toContain('NICKNAME');
    expect(Object.keys(out)).not.toContain('ACCOUNT_ID');
  });

  it('matches a lower-case, padded or BOM-prefixed header, and stores the SPEC spelling', () => {
    const out = projectRow(
      {
        '﻿started_at': '05.03.2024 20:00',
        '  finished_at  ': '05.03.2024 21:30',
        ip: '192.0.2.10',
      },
      aSpec(),
    );

    expect(out).toEqual({
      STARTED_AT: '05.03.2024 20:00',
      FINISHED_AT: '05.03.2024 21:30',
      IP: '192.0.2.10',
    });
  });

  it('drops the second key that normalises to a header the first already claimed', () => {
    const out = projectRow(
      {
        STARTED_AT: '05.03.2024 20:00',
        started_at_2: '06.03.2024 20:00',
      },
      aSpec(),
    );

    expect(out).toEqual({ STARTED_AT: '05.03.2024 20:00' });
  });

  it('never copies the overflow bucket or a prototype-shaped key (T-11-02)', () => {
    const raw = {
      __parsed_extra: ['a', 'b'],
      __proto__: 'polluted',
      IP: '192.0.2.10',
    } as unknown as Record<string, string>;
    const out = projectRow(raw, aSpec());

    expect(Object.keys(out)).toEqual(['IP']);
    expect(JSON.stringify(out)).not.toContain('parsed_extra');
    // The output is a plain object with no inherited pollution from the input.
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('clamps a cell longer than MAX_NEW_DATA_CELL and leaves an absent cell absent', () => {
    const long = 'x'.repeat(MAX_NEW_DATA_CELL + 50);
    const out = projectRow({ STARTED_AT: long }, aSpec());

    expect(out.STARTED_AT).toHaveLength(MAX_NEW_DATA_CELL);
    // A ragged row carries absent cells; turning one into '' would be inventing
    // a value the export never wrote.
    expect('FINISHED_AT' in out).toBe(false);
    expect(out.FINISHED_AT).toBeUndefined();
  });

  it('a cell at exactly the bound is untouched', () => {
    const exact = 'y'.repeat(MAX_NEW_DATA_CELL);
    expect(projectRow({ IP: exact }, aSpec()).IP).toBe(exact);
  });
});

describe('projectRow: the value-level email guard (12-06, D-01, T-12-16)', () => {
  /** A hand-built spec: two text columns, with the guard on or off. */
  function guarded(emailGuard: boolean): AllowlistSpec {
    const columns = new Map<string, SpecColumn>([
      ['SERVICE', { header: 'SERVICE', id: 'SERVICE', kind: 'text' }],
      ['NOTE', { header: 'NOTE', id: 'NOTE', kind: 'text' }],
    ]);
    return { category: 'bans', key: 'x.csv', columns, emailGuard };
  }

  it('omits a cell whose value is an email and leaves the others unchanged', () => {
    const out = projectRow(
      { SERVICE: 'twitch', NOTE: 'write to someone@example.com' },
      guarded(true),
    );
    expect(out).toEqual({ SERVICE: 'twitch' });
    expect('NOTE' in out).toBe(false);
  });

  it('keeps an at-sign with no dot after it, a lone at-sign, a spaced handle and a nickname', () => {
    const row = { SERVICE: 'a@b', NOTE: '@' };
    expect(projectRow(row, guarded(true))).toEqual({ SERVICE: 'a@b', NOTE: '@' });
    expect(projectRow({ SERVICE: 'someone @ home', NOTE: 'Tank_Ace_77' }, guarded(true))).toEqual({
      SERVICE: 'someone @ home',
      NOTE: 'Tank_Ace_77',
    });
  });

  it('drops an over-long cell with an at-sign near its start even when the clamp cuts the address', () => {
    const cut = 'x'.repeat(MAX_NEW_DATA_CELL - 5) + 'someone@exa' + 'mple.com';
    const out = projectRow({ SERVICE: cut, NOTE: 'ok' }, guarded(true));
    expect(out).toEqual({ NOTE: 'ok' });
  });

  it('clamps and keeps a long cell that has no at-sign', () => {
    const long = 'y'.repeat(MAX_NEW_DATA_CELL + 500);
    const out = projectRow({ SERVICE: long }, guarded(true));
    expect(out.SERVICE).toHaveLength(MAX_NEW_DATA_CELL);
  });

  it('is byte-for-byte the old projection with the guard off', () => {
    const row = { SERVICE: 'someone@example.com', NOTE: 'z'.repeat(MAX_NEW_DATA_CELL + 9) };
    const out = projectRow(row, guarded(false));
    expect(out.SERVICE).toBe('someone@example.com');
    expect(out.NOTE).toHaveLength(MAX_NEW_DATA_CELL);
  });

  it('is idempotent: projecting its own output again gives the same contents', () => {
    const spec = guarded(true);
    const once = projectRow(
      { SERVICE: 'someone@example.com', NOTE: 'w'.repeat(MAX_NEW_DATA_CELL + 40) },
      spec,
    );
    expect(projectRow(once, spec)).toEqual(once);
  });

  it('looksLikeEmail needs a dot after the at-sign and is cheap on a hostile string', () => {
    expect(looksLikeEmail('a@b.c')).toBe(true);
    expect(looksLikeEmail('a@b')).toBe(false);
    expect(looksLikeEmail('@@@@@@@@@@' + '.'.repeat(190))).toBe(false);
  });

  it('leaves fileMatchesSpec unchanged by the flag', () => {
    expect(fileMatchesSpec([{ SERVICE: 'x' }], guarded(true))).toBe(true);
    expect(fileMatchesSpec([{ OTHER: 'x' }], guarded(true))).toBe(false);
    expect(fileMatchesSpec([{ SERVICE: 'x' }], guarded(false))).toBe(true);
  });

  it('exactly the nine Phase 12 specs set the flag, and no Phase 11 spec does (12-08)', () => {
    // The guard is value-level and would re-narrow an existing Phase 11 cache, so
    // it stays off there (D-03). Every Phase 12 file can carry an email as the
    // VALUE of an allowlisted column, so it is on for all of them (D-01, PRIV-01).
    const guarded = NEW_DATA_SPEC_FILES.filter((spec) => spec.emailGuard === true).map(
      (spec) => spec.key,
    );
    expect([...guarded].sort()).toEqual([...PHASE12_KEYS].sort());
    expect(PHASE12_KEYS).toHaveLength(9);
    for (const spec of NEW_DATA_SPEC_FILES) {
      if (!PHASE12_KEYS.includes(spec.key)) expect(spec.emailGuard === true, spec.key).toBe(false);
    }
  });
});

describe('fileMatchesSpec: decided per FILE, never per row', () => {
  it('is true when ONE row of many carries a spec column', () => {
    expect(
      fileMatchesSpec([{ NICKNAME: 'x' }, {}, { STARTED_AT: '05.03.2024 20:00' }], aSpec()),
    ).toBe(true);
  });

  it('is false when no row carries any spec column', () => {
    expect(fileMatchesSpec([{ NICKNAME: 'x' }, { SESSION_BEGIN: 'y' }], aSpec())).toBe(false);
  });

  it('is false for an empty file and for no spec at all', () => {
    expect(fileMatchesSpec([], aSpec())).toBe(false);
    expect(fileMatchesSpec([{ STARTED_AT: 'x' }], null)).toBe(false);
  });

  it('a ragged row does not drop a matching file', () => {
    // The row the header did not cover is EMPTY, and it must not be the reason
    // the whole file is treated as unmatched (11-RESEARCH Pitfall 3).
    const rows = [{ STARTED_AT: '05.03.2024 20:00' }, {}];
    expect(fileMatchesSpec(rows, aSpec())).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 11-03: the spec table itself — where every stored column has to come from
// -----------------------------------------------------------------------------

describe('the spec table: every stored column is evidence-backed', () => {
  it('names a spec column only where a captured header, a builder vocabulary or the session vocabulary allows it', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      const captured = capturedHeaders(spec.key);
      const extra: ReadonlySet<string> = new Set(
        SESSION_KEYS.includes(spec.key)
          ? SESSION_AGGREGATOR_VOCABULARY
          : (WOWP_VOCABULARY.get(spec.key) ?? []),
      );
      for (const column of spec.columns) {
        expect(
          captured.has(column.header) || extra.has(column.header),
          `${spec.key}: ${column.header} is in neither the capture nor a vocabulary`,
        ).toBe(true);
      }
    }
  });

  it('scopes the allowances: a pane file gets neither vocabulary, and the two do not cross', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      const captured = capturedHeaders(spec.key);
      if (SESSION_KEYS.includes(spec.key) || WOWP_KEYS.includes(spec.key)) continue;
      // A HEAT or WoWS pane file may be NO WIDER than what its own capture holds.
      for (const column of spec.columns) {
        expect(captured.has(column.header), `${spec.key}: ${column.header}`).toBe(true);
      }
    }
    // And a session spec never borrows the builder's Warplanes vocabulary,
    // nor a Warplanes spec the session vocabulary.
    const builderHeaders = new Set(
      [...WOWP_VOCABULARY.values()].flatMap((headers) => [...headers]),
    );
    const sessionOnly = new Set(
      SESSION_AGGREGATOR_VOCABULARY.filter(
        (header) => !capturedHeaders('heat_game_sessions.csv').has(header),
      ),
    );
    for (const key of SESSION_KEYS) {
      const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
      expect(spec, `${key} has a spec`).toBeDefined();
      for (const column of spec?.columns ?? []) {
        expect(
          builderHeaders.has(column.header),
          `${key}: ${column.header} is a builder header`,
        ).toBe(false);
      }
    }
    for (const key of WOWP_KEYS) {
      const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
      for (const column of spec?.columns ?? []) {
        expect(
          sessionOnly.has(column.header),
          `${key}: ${column.header} is a session-aggregator header`,
        ).toBe(false);
      }
    }
  });

  it('gives every column a unique id equal to its header and one of the five kinds', () => {
    const kinds = new Set(['text', 'number', 'date', 'address', 'code']);
    for (const spec of NEW_DATA_SPEC_FILES) {
      const ids = new Set<string>();
      for (const column of spec.columns) {
        expect(ids.has(column.id), `${spec.key}: duplicate id ${column.id}`).toBe(false);
        ids.add(column.id);
        expect(kinds.has(column.kind), `${spec.key}: ${column.kind}`).toBe(true);
        // The stored key IS the header today (11-01), so no column may be an
        // alias rewrite the decision table never asked for. The camelCase
        // `id` column of 11-HEADERS.md is a pane LABEL key, not a stored key.
        expect(column.id, `${spec.key}: ${column.header}`).toBe(column.header);
        expect(column.id, `${spec.key}: ${column.id} is not an identifier-shaped name`).toMatch(
          /^[A-Z][A-Z0-9_]*$/,
        );
      }
    }
  });

  it('stores no column matching the personal-identity pattern except a documented one', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      const allowed = IDENTITY_EXCEPTIONS[spec.key] ?? {};
      for (const column of spec.columns) {
        if (!matchesIdentityPattern(column.header)) continue;
        const reason = allowed[column.header];
        expect(reason, `${spec.key}: ${column.header} matches the identity pattern`).toBeTypeOf(
          'string',
        );
        expect((reason ?? '').length).toBeGreaterThan(20);
      }
    }
  });

  it('holds nothing else in the exceptions map than a column that needs it', () => {
    const byKey = new Map(NEW_DATA_SPEC_FILES.map((spec) => [spec.key, spec]));
    for (const [key, headers] of Object.entries(IDENTITY_EXCEPTIONS)) {
      const spec = byKey.get(key);
      expect(spec, `exceptions for a file with no spec: ${key}`).toBeDefined();
      for (const [header, reason] of Object.entries(headers)) {
        expect(
          spec?.columns.some((column) => column.header === header),
          `${key}: exception for a column the spec does not name (${header})`,
        ).toBe(true);
        expect(matchesIdentityPattern(header), `${key}: ${header} needs no exception`).toBe(true);
        expect(reason.length).toBeGreaterThan(20);
      }
    }
  });

  it('keeps the nickname out of both WOWP account specs (T-11-09)', () => {
    for (const key of ['wowp_19_account_statistics.csv', 'wowp_20_account_statistics.csv']) {
      const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
      const headers = (spec?.columns ?? []).map((column) => column.header);
      expect(headers, `${key} names NAME`).not.toContain('NAME');
      // And the capture really does carry it, so this is a narrowing and not a
      // file that never had one.
      expect(capturedHeaders(key).has('NAME'), `${key} capture carries NAME`).toBe(true);
    }
  });
});

describe("every Phase 12 spec column against the user's per-column risk answers (12-08, T-12-23)", () => {
  it('walks every spec the risk answers cover, and the answers cover the nine Phase 12 files', () => {
    expect(Object.keys(COLUMN_RISK_ANSWERS).sort()).toEqual([...PHASE12_KEYS].sort());
    const mapped = PANE_MAPPING.filter((row) => row.status === 'mapped').map((row) => row.fileKey);
    expect([...mapped].sort()).toEqual([...PHASE12_KEYS].sort());
    expect(NAME_HISTORY_KEY).toBe('account_name_history.csv');
  });

  it('passes for every column of every spec that has recorded answers', () => {
    const violations: string[] = [];
    for (const spec of NEW_DATA_SPEC_FILES) {
      const answers = COLUMN_RISK_ANSWERS[spec.key];
      if (answers === undefined) continue;
      for (const column of spec.columns) {
        violations.push(
          ...riskViolations(
            spec.key,
            column,
            Object.hasOwn(answers, column.header) ? answers[column.header] : undefined,
            NAME_HISTORY_KEY,
          ),
        );
      }
    }
    expect(violations).toEqual([]);
  });

  describe('the lint itself fails on a hand-built column', () => {
    const no: ColumnRisk = { email: 'no', personName: 'no', freeText: 'no', ip: 'no', code: 'no' };

    it('accepts a column whose answers are all no', () => {
      expect(riskViolations('bans.csv', { header: 'STATUS', kind: 'text' }, no, 'n.csv')).toEqual(
        [],
      );
    });

    it('names file, column and field when the email answer is unsure', () => {
      const out = riskViolations(
        'bans.csv',
        { header: 'REASON', kind: 'text' },
        { ...no, email: 'unsure' },
        'n.csv',
      );
      expect(out).toEqual(['bans.csv / REASON: email answer is unsure']);
    });

    it('fails a free-text yes, with no exception for an address or code kind', () => {
      for (const kind of ['text', 'address', 'code']) {
        const out = riskViolations(
          'bans.csv',
          { header: 'DESCRIPTION', kind },
          { ...no, freeText: 'yes' },
          'n.csv',
        );
        expect(out.join(), kind).toContain('freeText answer is yes');
      }
    });

    it('fails an IP yes with kind text and passes it with kind address', () => {
      const answers = { ...no, ip: 'yes' } as const;
      expect(
        riskViolations('bans.csv', { header: 'IP', kind: 'text' }, answers, 'n.csv').join(),
      ).toContain('ip answer is yes but the kind is text');
      expect(
        riskViolations('bans.csv', { header: 'IP', kind: 'address' }, answers, 'n.csv'),
      ).toEqual([]);
    });

    it('fails a code yes with kind text and passes it with kind code', () => {
      const answers = { ...no, code: 'unsure' } as const;
      expect(
        riskViolations('personal_coupons.csv', { header: 'CODE', kind: 'text' }, answers, 'n.csv')
          .length,
      ).toBe(1);
      expect(
        riskViolations('personal_coupons.csv', { header: 'CODE', kind: 'code' }, answers, 'n.csv'),
      ).toEqual([]);
    });

    it('allows a person-name yes in the name history file only', () => {
      const answers = { ...no, personName: 'yes' } as const;
      const column = { header: 'OLD_NAME', kind: 'text' };
      expect(riskViolations('n.csv', column, answers, 'n.csv')).toEqual([]);
      expect(riskViolations('other.csv', column, answers, 'n.csv').join()).toContain(
        'personName answer is yes outside the name history',
      );
    });

    it('fails a column with no recorded answer', () => {
      expect(
        riskViolations('bans.csv', { header: 'NEW', kind: 'text' }, undefined, 'n.csv'),
      ).toEqual(['bans.csv / NEW: no recorded answer']);
    });
  });
});

describe('the Phase 12 kind placement (12-08, D-13, D-14)', () => {
  it('stores a code column only in the coupon and bonus-code specs', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      if (!PHASE12_KEYS.includes(spec.key)) continue;
      for (const column of spec.columns) {
        if (column.kind !== 'code') continue;
        expect(CODE_FILES, `${spec.key} / ${column.header} is a code column`).toContain(spec.key);
      }
    }
  });

  it('stores an address column only in the bans, third-party and bonus-code specs', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      if (!PHASE12_KEYS.includes(spec.key)) continue;
      for (const column of spec.columns) {
        if (column.kind !== 'address') continue;
        expect(ADDRESS_FILES, `${spec.key} / ${column.header} is an address column`).toContain(
          spec.key,
        );
      }
    }
  });

  it('names a past-nickname column only in the name history spec', () => {
    for (const spec of NEW_DATA_SPEC_FILES) {
      for (const column of spec.columns) {
        if (column.header !== 'OLD_NAME' && column.header !== 'NEW_NAME') continue;
        expect(spec.key, `${spec.key} / ${column.header} is a past nickname`).toBe(
          NAME_HISTORY_KEY,
        );
        expect(column.kind).toBe('text');
      }
    }
  });

  it('names PLAYER_ANSWER only because the recorded answers allow it, as kind text', () => {
    // Orchestrator default 3: the column stays out unless the user's checkpoint
    // statement says it is an enumerated rating. The statement is recorded as
    // `no` on email, person name and free text in COLUMN_RISK_ANSWERS.
    const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === 'heat_surveys.csv');
    const column = spec?.columns.find((candidate) => candidate.header === 'PLAYER_ANSWER');
    const answers = COLUMN_RISK_ANSWERS['heat_surveys.csv']?.['PLAYER_ANSWER'];
    expect(answers, 'no recorded answer for PLAYER_ANSWER').toBeDefined();
    const allowed =
      answers !== undefined &&
      !flagged(answers.email) &&
      !flagged(answers.personName) &&
      !flagged(answers.freeText);
    expect(column !== undefined, 'PLAYER_ANSWER presence follows the recorded answers').toBe(
      allowed,
    );
    if (column !== undefined) expect(column.kind).toBe('text');
  });

  it('names no column the decision table excluded, in any Phase 12 spec', () => {
    // The excluded columns of 12-HEADERS.md, by file. Absent from a spec by
    // omission, which is the fail-closed direction (D-01).
    const excluded: Readonly<Record<string, readonly string[]>> = {
      'bans.csv': ['DESCRIPTION', 'REASON'],
      'personal_coupons.csv': ['PREREQUISITE'],
      'subscriptions.csv': ['SUBSCRIPTION'],
      'heat_surveys.csv': ['PROFILE_ID', 'BATTLE_ID'],
      'account_name_history.csv': ['IP'],
      'external_services_history.csv': ['IP', 'UID'],
    };
    for (const [key, headers] of Object.entries(excluded)) {
      const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
      if (spec === undefined) continue;
      const named = new Set(spec.columns.map((column) => column.header));
      for (const header of headers) expect(named.has(header), `${key} names ${header}`).toBe(false);
    }
  });
});

describe('the WOWP specs are a superset of the builder vocabulary (Pitfall 2, T-11-10)', () => {
  it('exports the vocabulary for exactly the four WOWP files', () => {
    expect([...WOWP_VOCABULARY.keys()].sort()).toEqual([...WOWP_KEYS].sort());
  });

  it.each(WOWP_KEYS)('%s names every header the Vehicles builder reads from it', (key) => {
    const vocabulary = WOWP_VOCABULARY.get(key);
    expect(vocabulary, `no vocabulary exported for ${key}`).toBeDefined();
    const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
    expect(spec, `no spec for ${key}`).toBeDefined();
    const headers = new Set((spec?.columns ?? []).map((column) => column.header));
    for (const header of vocabulary ?? []) {
      expect(headers.has(header), `${key}: the builder reads ${header}, the spec drops it`).toBe(
        true,
      );
    }
  });

  it('reads the same four file names the title actually owns', () => {
    // A vocabulary keyed on a name the builder never fetches would be a guard
    // over nothing, so the key list is checked against the builder's own table.
    expect(WOWP_VOCABULARY.has('wowp_19_plane_statistics.csv')).toBe(true);
    expect(WOWP_VOCABULARY.has('wowp_20_plane_statistics.csv')).toBe(true);
    expect(WOWP_VOCABULARY.has('wowp_19_account_statistics.csv')).toBe(true);
    expect(WOWP_VOCABULARY.has('wowp_20_account_statistics.csv')).toBe(true);
    expect(WOWP_VOCABULARY.has('wows_ship_statistics.csv')).toBe(false);
  });
});

describe('the session specs are a superset of the aggregators vocabulary (D-08, D-10)', () => {
  it('holds exactly the seven headers, in the documented order', () => {
    expect([...SESSION_AGGREGATOR_VOCABULARY].sort()).toEqual([
      'CLIENT_PLATFORM',
      'FINISHED_AT',
      'IP',
      'SERVER_NAME',
      'SESSION_END',
      'SESSION_START',
      'STARTED_AT',
    ]);
  });

  it.each(SESSION_KEYS)('%s names all seven whatever the capture carries', (key) => {
    const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
    const headers = new Set((spec?.columns ?? []).map((column) => column.header));
    for (const header of SESSION_AGGREGATOR_VOCABULARY) {
      expect(headers.has(header), `${key} dropped ${header}`).toBe(true);
    }
  });

  it('finds each of the seven as a quoted literal in the module that reads it', () => {
    const playtime = sourceOf('src/lib/features/playtime/playtime-aggregate.ts');
    const logins = sourceOf('src/lib/features/logins/login-aggregate.ts');
    const readers: Readonly<Record<string, string>> = {
      STARTED_AT: playtime,
      FINISHED_AT: playtime,
      SESSION_START: playtime,
      SESSION_END: playtime,
      SERVER_NAME: playtime,
      CLIENT_PLATFORM: playtime,
      IP: logins,
    };
    for (const header of SESSION_AGGREGATOR_VOCABULARY) {
      const source = readers[header] ?? '';
      expect(source, `${header} is not a quoted literal in its reader`).toContain(`'${header}'`);
    }
    // The alias pair is read by the LOGIN aggregator too, which is why those two
    // are not narrowed away even though the capture may not carry them.
    expect(logins).toContain("'STARTED_AT'");
    expect(logins).toContain("'SESSION_START'");
    expect(logins).toContain("'IP'");
  });
});

// -----------------------------------------------------------------------------
// Worker: what actually reaches IndexedDB
// -----------------------------------------------------------------------------

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/**
 * Every stored row of one file name, as written.
 *
 * `sourceFile` is the NAME and both roots carry the same game file names, so an
 * optional account narrows the read; the header-only and drifted cases change
 * one ROOT's file, and asserting "nothing stored" without naming the root would
 * be satisfied-or-failed by the sibling's rows rather than by the case.
 */
async function storedRows(
  sourceFile: string,
  account: string | null = null,
): Promise<Record<string, unknown>[]> {
  const { db } = await importWorkerDb();
  const all = await db.rows.toArray();
  return all
    .filter((row) => row.sourceFile === sourceFile && (account === null || row.account === account))
    .map((row) => row.data as Record<string, unknown>);
}

async function ingest(bytes: Uint8Array, name: string): Promise<void> {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
}

describe('the worker: the allowlist at the row choke point', () => {
  it('stores the HEAT and WOTC session rows under spec keys only', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const heat = await storedRows('HEAT_Game_Sessions.csv');
    expect(heat.length).toBe(3);
    for (const row of heat) {
      expect(Object.keys(row).sort()).toEqual(['FINISHED_AT', 'IP', 'STARTED_AT']);
    }
    const wotc = await storedRows('WOTC_Game_Sessions.csv');
    expect(wotc.length).toBe(1);
    expect(Object.keys(wotc[0]!).sort()).toEqual(['FINISHED_AT', 'IP', 'STARTED_AT']);
  });

  it('leaves no canary anywhere in the stored rows or the stored meta', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const { db } = await importWorkerDb();
    const rowsJson = JSON.stringify(await db.rows.toArray());
    const metaJson = JSON.stringify((await db.meta.get('active')) ?? null);

    for (const canary of [NG_CANARY_EMAIL, NG_CANARY_NICKNAME, NG_CANARY_ACCOUNT_ID]) {
      expect(rowsJson, `${canary} in db.rows`).not.toContain(canary);
      expect(metaJson, `${canary} in meta`).not.toContain(canary);
    }
  });

  it('stores no IP in the playtime aggregate', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const { db } = await importWorkerDb();
    const playtime = (await db.meta.get('active'))?.playtime;
    expect(playtime).not.toBeNull();
    // The aggregate is built from session files and carries no address in any
    // shape; the IP is at rest only in the row the login pane reads and masks.
    expect(JSON.stringify(playtime)).not.toContain('192.0.2.');
  });

  it('stores a family file with NO spec in NO folder', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    // One in Device_Info and one in Player_Statistics, both in the family by
    // name and both in a supported folder. Neither has a spec, so neither is
    // stored (D-15).
    expect(await storedRows('HEAT_Device_Info.csv')).toEqual([]);
    expect(await storedRows('HEAT_Unlisted_File.csv')).toEqual([]);
  });

  it('stores nothing for a header-only HEAT file', async () => {
    await ingest(buildNewGamesExport({ headerOnly: true }), 'new-games-header-only.zip');

    expect(await storedRows('HEAT_Game_Sessions.csv', NG_ROOT_A)).toEqual([]);
  });

  it('stores nothing for a spec file whose headers match nothing, and still imports', async () => {
    await ingest(buildNewGamesExport({ drifted: true }), 'new-games-drifted.zip');

    expect(await storedRows('HEAT_Game_Sessions.csv', NG_ROOT_A)).toEqual([]);
    // The sibling root's HEAT row still lands, so the archive is not empty and
    // the skip is a fact about the FILE rather than about the import failing.
    expect(await storedRows('HEAT_Game_Sessions.csv')).toHaveLength(1);
  });

  it('stores nothing outside the supported category the spec names', async () => {
    await ingest(buildNewGamesExport(), 'new-games.zip');

    const { db } = await importWorkerDb();
    const everyRow = await db.rows.toArray();
    expect(everyRow.length).toBeGreaterThan(0);
    for (const row of everyRow) {
      expect(row.category.toLowerCase()).toBe('activity_history');
    }
  });

  it('the fixture really does carry the canaries the assertions rule out', async () => {
    // Without this, every negative assertion above would pass against a build
    // that stored the whole row, because the input would have nothing to store.
    const body = NG_HEAT_SESSIONS_A;
    expect(body).toContain(NG_CANARY_EMAIL);
    expect(body).toContain(NG_CANARY_NICKNAME);
    expect(body).toContain(NG_CANARY_ACCOUNT_ID);
    expect(NG_ROOT_A).not.toBe(NG_CANARY_ACCOUNT_ID);
  });

  it('the hand-written key still describes the archive this fixture builds', async () => {
    // A cheap guard on NG_EXPECTED itself: the fixture rows are six sessions
    // across five days, and the key is the answer a reader will trust.
    expect(NG_EXPECTED.ALL.sessions).toBe(6);
    expect(NG_EXPECTED.ALL.days).toBe(5);
  });
});

// -----------------------------------------------------------------------------
// 11-03: the worker matrix — one named test per CAPTURED file header
// -----------------------------------------------------------------------------

/**
 * The per-header fixture module, read through a locally-declared interface.
 *
 * The exports are what THIS task creates, so a static named import would fail the
 * whole file at load before any assertion ran, which proves nothing. The
 * namespace import always resolves and a missing export is an ordinary
 * `undefined` the assertions below report.
 */
interface NewDataFixtureApi {
  readonly NEW_DATA_FIXTURE_FILES?: Readonly<
    Record<string, { folder: string; fileName: string; csv: string }>
  >;
  readonly canaryColumnsFor?: (key: string) => readonly { header: string; value: string }[];
  readonly withCanaries?: (key: string) => string;
  readonly bomPaddedLowerCsv?: (key: string) => string;
  readonly driftedCsv?: (key: string) => string;
  readonly headerOnlyCsv?: (key: string) => string;
  readonly hostileHeaderCsv?: (key: string) => string;
  readonly bareCrQuotedCsv?: (key: string) => string;
  readonly buildLargeTableCsv?: (key: string, rowCount: number) => string;
  readonly buildNewDataFilesExport?: (
    files?: Readonly<Record<string, string>>,
    options?: { folders?: Readonly<Record<string, string>>; root?: string },
  ) => Uint8Array;
  readonly buildMisfiledNewDataFilesExport?: () => Uint8Array;
}

const fx = (await import('../../fixtures/new-data-fixtures.ts')) as unknown as NewDataFixtureApi;

const FIXTURE_FILES = fx.NEW_DATA_FIXTURE_FILES ?? {};

/** Every builder the matrix drives, failing loudly rather than silently skipping. */
function need<T>(value: T | undefined, name: string): T {
  if (value === undefined)
    throw new Error(`tests/fixtures/new-data-fixtures.ts does not export ${name}`);
  return value;
}

/** The stored key set this file's PLAIN fixture should produce: spec ∩ capture. */
function expectedStoredKeys(key: string): string[] {
  const captured = capturedHeaders(key);
  const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  return (spec?.columns ?? []).map((column) => column.header).filter((h) => captured.has(h));
}

/** Every stored row of one file name, across accounts. */
async function rowsOf(sourceFile: string): Promise<Record<string, unknown>[]> {
  const { db } = await importWorkerDb();
  const all = await db.rows.toArray();
  return all
    .filter((row) => row.sourceFile === sourceFile)
    .map((row) => row.data as Record<string, unknown>);
}

describe('11-03 the per-header matrix: one archive, one named test per file', () => {
  it('a fixture exists for every spec file, with the folder the capture filed it in', () => {
    expect(Object.keys(FIXTURE_FILES).sort()).toEqual([...SPEC_KEYS].sort());
    for (const key of SPEC_KEYS) {
      expect(FIXTURE_FILES[key]?.folder, key).toBe(capturedFolderOf(key));
      expect(FIXTURE_FILES[key]?.csv.split('\n')[0], key).not.toBe('');
    }
  });

  it('the fixtures are COMMA-delimited, as every captured file is (11-HEADERS Notes 4)', () => {
    for (const key of SPEC_KEYS) {
      const header = FIXTURE_FILES[key]!.csv.slice(0, FIXTURE_FILES[key]!.csv.indexOf('\n'));
      expect(header, `${key} header`).not.toContain(';');
      expect(header.split(',').length, key).toBe(capturedHeaders(key).size);
    }
  });

  it.each(SPEC_KEYS)(
    '%s stores only spec keys, keeps an allowlisted value, and leaks no canary',
    async (key) => {
      const withCanaries = need(fx.withCanaries, 'withCanaries');
      const canaryColumnsFor = need(fx.canaryColumnsFor, 'canaryColumnsFor');
      const build = need(fx.buildNewDataFilesExport, 'buildNewDataFilesExport');
      const overrides = Object.fromEntries(SPEC_KEYS.map((k) => [k, withCanaries(k)]));
      await ingest(build(overrides), 'new-data-canaries.zip');

      const fileName = FIXTURE_FILES[key]!.fileName;
      const rows = await rowsOf(fileName);
      const stored = expectedStoredKeys(key);

      // The POSITIVE control first: a pass may not come from storing nothing.
      expect(rows.length, `${key} stored rows`).toBe(3);
      for (const header of stored) {
        expect(rows[0]![header], `${key} dropped the allowlisted ${header}`).toBeTypeOf('string');
      }

      // Only spec keys, in the spec's own spelling.
      const allowed = new Set(
        (NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key)?.columns ?? []).map(
          (c) => c.id,
        ),
      );
      for (const row of rows) {
        for (const storedKey of Object.keys(row)) {
          expect(allowed.has(storedKey), `${key} stored ${storedKey}`).toBe(true);
        }
      }

      // And nothing planted anywhere in the stored rows or the stored meta.
      const { db } = await importWorkerDb();
      const haystack = JSON.stringify([
        await db.rows.toArray(),
        (await db.meta.get('active')) ?? null,
      ]);
      const canaries = canaryColumnsFor(key);
      expect(canaries.length, `${key} planted no canary`).toBeGreaterThan(0);
      for (const canary of canaries) {
        expect(haystack, `${key}: canary ${canary.header} reached storage`).not.toContain(
          canary.value,
        );
      }
      // The duplicate header and the surplus cell are the two shapes a projection
      // must absorb without either becoming a stored key.
      expect(haystack, `${key} stored the duplicate`).not.toContain('duplicate-');
      expect(haystack, `${key} stored the surplus cell`).not.toContain('surplus-beyond-the-header');
    },
  );
});

describe('11-03 the matrix variants: the same file under a different spelling', () => {
  it.each([
    ['plain', (key: string) => FIXTURE_FILES[key]!.csv],
    ['bare-CR quote-all', (key: string) => need(fx.bareCrQuotedCsv, 'bareCrQuotedCsv')(key)],
    [
      'BOM, padded, lower case',
      (key: string) => need(fx.bomPaddedLowerCsv, 'bomPaddedLowerCsv')(key),
    ],
  ] as const)(
    '%s stores the same keys and the same values as the plain file',
    async (_label, build) => {
      const archive = need(
        fx.buildNewDataFilesExport,
        'buildNewDataFilesExport',
      )(Object.fromEntries(SPEC_KEYS.map((key) => [key, build(key)])));
      await ingest(archive, 'new-data-variant.zip');

      for (const key of SPEC_KEYS) {
        const rows = await rowsOf(FIXTURE_FILES[key]!.fileName);
        expect(rows.length, `${key} rows`).toBe(3);
        for (const row of rows) {
          expect(Object.keys(row).sort(), `${key} keys`).toEqual(expectedStoredKeys(key).sort());
        }
        // The positive control: the first allowlisted column's value really landed.
        const first = expectedStoredKeys(key)[0]!;
        expect(rows[0]![first], `${key} ${first}`).toBeTypeOf('string');
      }
    },
  );

  it.each([
    ['drift', (key: string) => need(fx.driftedCsv, 'driftedCsv')(key)],
    ['header-only', (key: string) => need(fx.headerOnlyCsv, 'headerOnlyCsv')(key)],
  ] as const)('%s stores nothing for any file and still imports', async (_label, build) => {
    const archive = need(
      fx.buildNewDataFilesExport,
      'buildNewDataFilesExport',
    )(Object.fromEntries(SPEC_KEYS.map((key) => [key, build(key)])));
    await ingest(archive, 'new-data-empty.zip');

    for (const key of SPEC_KEYS) {
      expect(await rowsOf(FIXTURE_FILES[key]!.fileName), key).toEqual([]);
    }
  });

  it('a copy filed under Payment_History stores nothing, whoever filed it', async () => {
    await ingest(
      need(fx.buildMisfiledNewDataFilesExport, 'buildMisfiledNewDataFilesExport')(),
      'new-data-misfiled.zip',
    );

    const { db } = await importWorkerDb();
    const stored = await db.rows.toArray();
    for (const key of SPEC_KEYS) {
      expect(
        stored.filter((row) => row.sourceFile === FIXTURE_FILES[key]!.fileName),
        key,
      ).toEqual([]);
    }
    // And the archive was not simply empty: the misfiled files were seen.
    expect((await db.meta.get('active'))?.importedAt).toBeTypeOf('string');
  });

  it('hostile headers import without throwing and store no prototype key', async () => {
    const build = need(fx.buildNewDataFilesExport, 'buildNewDataFilesExport');
    await ingest(
      build(
        Object.fromEntries(
          SPEC_KEYS.map((key) => [key, need(fx.hostileHeaderCsv, 'hostileHeaderCsv')(key)]),
        ),
      ),
      'new-data-hostile.zip',
    );

    const { db } = await importWorkerDb();
    const haystack = JSON.stringify([
      await db.rows.toArray(),
      (await db.meta.get('active')) ?? null,
    ]);
    expect(haystack).not.toContain('__proto__');
    expect(haystack).not.toContain('CANARY-PROTO-');
    expect(haystack).not.toContain('CANARY-LONG-');
    // Whatever the wrapper made of the 100 KB name, no stored key is one.
    for (const row of await db.rows.toArray()) {
      for (const storedKey of Object.keys(row.data as Record<string, unknown>)) {
        expect(storedKey.length, `a stored key of ${storedKey.length} chars`).toBeLessThan(200);
      }
    }
  });
});

describe('11-03 the scale fixture the later windowing plans read', () => {
  it('builds a header and exactly rowCount deterministic rows', () => {
    const build = need(fx.buildLargeTableCsv, 'buildLargeTableCsv');
    for (const key of ['wowp_19_plane_statistics.csv', 'heat_battle_types_statistics.csv']) {
      const csv = build(key, 250);
      const lines = csv.split('\n').filter((line) => line.length > 0);
      expect(lines.length, key).toBe(251);
      expect(lines[0], key).toBe([...capturedHeaders(key)].join(','));
      // Deterministic: the same call twice is byte-identical.
      expect(build(key, 250), key).toBe(csv);
    }
  });
});
