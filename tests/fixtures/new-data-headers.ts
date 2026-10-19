// =============================================================================
// new-data-headers.ts — the REAL column names of the new-game export files
// =============================================================================
//
// WHAT THIS FILE IS
// A transcription of `.planning/phases/11-new-game-data/11-HEADERS.txt`, which
// the USER produced by running `header_capture.py` on their own Wargaming export
// zip (plan 11-02, D-12). It holds, for every family file in that capture: the
// account label, the folder, the delimiter, the COLUMN NAMES in file order, and
// the byte size and non-empty line count.
//
// It holds names only. The capture script prints a header line only when every
// token on it is identifier-like, and the raw capture was committed after a
// structural check: 18 FILE lines, 18 HDR lines, no other line kind, and no
// malformed token. Nothing here is a cell value, a nickname, an email, an
// account number or a coordinate. `tests/unit/guards/new-data-headers.test.ts`
// re-proves that on every run (T-11-06).
//
// WHY IT IS A LEAF MODULE
// It imports nothing, for the same reason `player-stats-fixtures.ts` and
// `finance-fixtures.ts` do: those modules are imported by the shared sample
// builder, and a data module that reaches back for anything closes a cycle that
// fails at runtime rather than at compile time (see `tests/fixtures/README.md`,
// "The leaf-module rule"). This one is a pure constant list, so the rule costs
// nothing.
//
// WHY IT IS COMMITTED AT ALL
// Because the allowlist is only as good as the names it lists, and every later
// plan in the phase reads these constants rather than guessing a header from the
// shape of a legacy file. Plan 11-03 appends the specs built from here; plans
// 11-07, 11-08, 11-10 and 11-11 build their fixtures and label maps from them.
// A later reader can therefore answer "where did `WOWP_20_Plane_Statistics.csv`
// actually end?" by reading one committed file instead of re-running a script
// against a zip that is not in the repository.
//
// ## The accounts are relabelled, and the relabel is load-bearing
//
// `ACCT-A` and `ACCT-B` are sort-order stand-ins assigned by the capture script,
// not Wargaming account numbers. The real roots are numeric and never printed.
// A key may therefore appear more than once, once per account that holds the
// file, and `headersOf` reports whether two accounts disagreed about it.
//
// ## `divergent` exists because "the first one wins" is a silent failure
//
// Four files are held by both accounts. In this capture all four agree exactly,
// and the guard asserts that. The flag is here anyway because the opposite
// outcome is invisible if you only keep one list: a second account with a
// different header set would silently inherit the first account's allowlist, and
// the pane would read "not in export" for a column the export does carry.

// =============================================================================

/** What a capture's `DELIM` line said, when the file's first line had one. */
export type CapturedDelimiter = ';' | ',';

/** ONE `FILE` group of the capture: one file, in one account, in one folder. */
export interface CapturedFile {
  /** The lower-cased file name, e.g. `heat_game_sessions.csv`. Matches a spec key. */
  readonly key: string;
  /** The file name exactly as the capture printed it — the display form. */
  readonly fileName: string;
  /** The folder inside the account, exactly as the capture printed it. */
  readonly folder: string;
  /** `ACCT-A`, `ACCT-B` or `ACCT-C`. Never a numeric Wargaming account id. */
  readonly account: string;
  /** The delimiter detected on the file's first line, or null if suppressed. */
  readonly delimiter: CapturedDelimiter | null;
  /**
   * The column names in file order, or null when the capture printed
   * `HDR [suppressed]` because the first line was not identifier-only.
   *
   * Null means "this capture declined to record it", never "this file has no
   * columns" — a reader must treat the two differently.
   */
  readonly headers: readonly string[] | null;
  /** The file's byte size, as the capture printed it. */
  readonly bytes: number;
  /** Its non-empty line count. The real files are tiny; scale proofs are synthetic. */
  readonly nonEmptyLines: number;
}

/** What {@link headersOf} answers for one file key. */
export interface CapturedHeaders {
  /** The key that was asked about. */
  readonly key: string;
  /** The first non-null header list captured for that key, in file order. */
  readonly headers: readonly string[];
  /**
   * True when two accounts captured DIFFERENT header lists for this key.
   *
   * False for every key in this capture, and asserted so — but it is reported
   * rather than assumed so that a future capture with a disagreement surfaces
   * as one flag instead of as a silently borrowed allowlist.
   */
  readonly divergent: boolean;
}

/**
 * The capture, one entry per `FILE` group, in the order the script printed them.
 *
 * The order is the archive's own iteration order and is kept verbatim so the
 * list reads as a transcript rather than as a curated selection. Nothing depends
 * on it: every consumer goes through `headersOf`.
 */
export const CAPTURED_FILES: readonly CapturedFile[] = [
  {
    key: 'heat_game_sessions.csv',
    fileName: 'HEAT_Game_Sessions.csv',
    folder: 'Activity_History',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'STARTED_AT',
      'FINISHED_AT',
      'IP',
      'COUNTRY_CODE',
      'CITY_NAME',
      'CLIENT_PLATFORM_CODE',
    ],
    bytes: 523,
    nonEmptyLines: 6,
  },
  {
    key: 'heat_session_geolocation.csv',
    fileName: 'HEAT_Session_Geolocation.csv',
    folder: 'Activity_History',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'ACCOUNT_ID',
      'IP',
      'COUNTRY_CODE_ALPHA_3',
      'REGION',
      'CITY',
      'ISP_NAME',
      'ASN',
      'ASN_NAME',
      'CONNECTION_SPEED',
      'LAST_SESSION_STARTED_DT',
      'LAST_SESSION_FINISHED_DT',
    ],
    bytes: 502,
    nonEmptyLines: 3,
  },
  {
    key: 'heat_device_info.csv',
    fileName: 'HEAT_Device_Info.csv',
    folder: 'Device_Info',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'PROFILE_ID',
      'BATTLE_ID',
      'MESSAGE_TS',
      'CPU',
      'GPU',
      'GPU_RAM',
      'GPU_DRIVER',
      'RAM',
      'OS',
      'OS_VERSION',
      'DISPLAY_WIDTH',
      'DISPLAY_HEIGHT',
      'DISPLAY_MODE',
      'GRAPHICS_API',
      'PRESET',
      'AUTODETECTED_PRESET',
    ],
    bytes: 1502,
    nonEmptyLines: 6,
  },
  {
    key: 'heat_account_statistics.csv',
    fileName: 'HEAT_Account_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'REGISTRATION_DT',
      'ACTIVATION_DT',
      'FIRST_LOGIN_DT',
      'FIRST_LOGIN_PLATFORM',
      'FIRST_BATTLE_DT',
      'FIRST_PAYMENT_DT',
      'COUNTRY_CODE',
    ],
    bytes: 269,
    nonEmptyLines: 2,
  },
  {
    key: 'heat_account_storage.csv',
    fileName: 'HEAT_Account_Storage.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-B',
    delimiter: ',',
    headers: ['ASSET_CODE', 'FIRST_OWNED_TS', 'REALM_CODE', 'ASSET_NAME'],
    bytes: 2193,
    nonEmptyLines: 34,
  },
  {
    key: 'heat_battle_types_statistics.csv',
    fileName: 'HEAT_Battle_Types_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'GAME_MODE',
      'GAME_SOURCE',
      'BATTLES',
      'WINS',
      'LOSSES',
      'DRAWS',
      'ND',
      'DAMAGE',
      'DAMAGE_TAKEN',
      'FRAGS',
      'KILL_ASSIST',
      'DEATHS',
      'SHOOT_DONE',
      'HITS_DONE',
      'CAPTURE_POINTS',
      'TIME_PLAYED_BY_HUMAN',
      'VEHICLE_EXPERIENCE',
      'FRONTMAN_EXPERIENCE',
      'ARENA_START_TS',
      'ARENA_END_TS',
    ],
    bytes: 998,
    nonEmptyLines: 6,
  },
  {
    key: 'wowp_20_account_statistics.csv',
    fileName: 'WOWP_20_Account_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'NAME',
      'CREATED_AT',
      'UPDATED_AT',
      'PREMIUM_EXPIRY_TIME',
      'AUTO_BAN_TIME',
      'AT_DAMAGE_MAX',
      'B_ASSIST',
      'B_DAMAGE',
      'B_DAMAGE_MAX',
      'B_KILL',
      'B_KILL_MAX',
      'B_SCORE',
      'B_SCORE_AVG',
      'B_SCORE_MAX',
      'BASE_XP',
      'BASE_XP_AVG',
      'BASE_XP_MAX',
      'BATTLES',
      'CBT_GAMES_PLAYED',
      'CREDITS',
      'D_ASSIST',
      'D_DAMAGE',
      'D_DAMAGE_MAX',
      'D_KILL',
      'D_KILL_MAX',
      'DB_DAMAGE_MAX',
      'DB_KILL_MAX',
      'DEATHS',
      'DRAWS',
      'EMPTY_SLOTS',
      'EXPERIENCE',
      'FLIGHTS',
      'FLIGHTTIME',
      'G_ASSIST',
      'G_DAMAGE',
      'G_DAMAGE_MAX',
      'G_KILL',
      'G_KILL_MAX',
      'GLOBAL_RATING',
      'GOLD',
      'KD_RATION',
      'LANGUAGE',
      'LAST_COMPENSATION_TIME',
      'LAST_GAME_TIME',
      'LOGOUT_TIME',
      'LOSSES',
      'OBT_GAMES_PLAYED',
      'P_ASSIST',
      'P_DAMAGE',
      'P_DAMAGE_MAX',
      'P_KILL',
      'P_KILL_DEF_ZONE',
      'P_KILL_DEF_ZONE_MAX',
      'P_KILL_MAX',
      'SLOTS',
      'WINS',
      'ZONE_CAPTURE',
      'AT_KILL_AVG_DF',
      'G_KILL_AVG_DF',
      'P_KILL_AVG',
      'DB_KILL_AVG',
      'G_KILL_AVG',
    ],
    bytes: 1143,
    nonEmptyLines: 2,
  },
  {
    key: 'wowp_20_plane_statistics.csv',
    fileName: 'WOWP_20_Plane_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'UPDATED_AT',
      'AT_DAMAGE_MAX',
      'AT_KILL_MAX_DF',
      'B_SCORE',
      'B_SCORE_AVG',
      'B_SCORE_MAX',
      'BASE_XP',
      'BASE_XP_AVG',
      'BASE_XP_MAX',
      'B_ASSIST',
      'B_DAMAGE',
      'B_DAMAGE_MAX',
      'B_KILL',
      'B_KILL_MAX',
      'D_ASSIST',
      'D_DAMAGE',
      'D_DAMAGE_MAX',
      'D_KILL',
      'D_KILL_MAX',
      'G_ASSIST',
      'G_DAMAGE',
      'G_DAMAGE_MAX',
      'G_KILL',
      'G_KILL_MAX',
      'G_KILL_MAX_DF',
      'DB_DAMAGE_MAX',
      'DB_KILL_MAX',
      'DEATHS',
      'DRAWS',
      'BATTLES',
      'FLIGHTS',
      'FLIGHTTIME',
      'FLIGHTTIME_AVG',
      'LAST_GAME_TIME',
      'LOSSES',
      'WINS',
      'P_ASSIST',
      'P_DAMAGE',
      'P_DAMAGE_MAX',
      'P_KILL',
      'P_KILL_DEF_ZONE',
      'P_KILL_DEF_ZONE_MAX',
      'P_KILL_MAX',
      'ZONE_CAPTURE',
      'CHOSEN',
      'FIRST_CHOSEN',
      'RANKS',
      'P_KILL_AVG',
      'DB_KILL_AVG',
      'G_KILL_AVG',
      'AT_KILL_AVG_DF',
      'G_KILL_AVG_DF',
      'AT_DAMAGE_AVG_DF',
      'G_DAMAGE_AVG_DF',
      'IN_GARAGE',
      'IN_GARAGE_UPDATED',
    ],
    bytes: 2402,
    nonEmptyLines: 7,
  },
  {
    key: 'wows_account_storage.csv',
    fileName: 'WOWS_Account_Storage.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-B',
    delimiter: ',',
    headers: ['ITEM_DESC', 'AMOUNT'],
    bytes: 4295,
    nonEmptyLines: 150,
  },
  {
    key: 'wows_crews.csv',
    fileName: 'WOWS_Crews.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'CREW_ID',
      'CREW_SHIP',
      'CREW_TYPE',
      'CREW_LEVEL',
      'CREW_SHIP_TRAINED',
      'CREW_EXPERIENCE',
    ],
    bytes: 1308,
    nonEmptyLines: 17,
  },
  {
    key: 'heat_surveys.csv',
    fileName: 'HEAT_Surveys.csv',
    folder: 'Surveys',
    account: 'ACCT-B',
    delimiter: ',',
    headers: [
      'PROFILE_ID',
      'BATTLE_ID',
      'QUESTION_ID',
      'PLAYER_ANSWER',
      'SKIPPED_BY_PLAYER',
      'MESSAGE_TS',
    ],
    bytes: 653,
    nonEmptyLines: 7,
  },
  {
    key: 'wotc_game_sessions.csv',
    fileName: 'WOTC_Game_Sessions.csv',
    folder: 'Activity_History',
    account: 'ACCT-A',
    delimiter: ',',
    headers: ['STARTED_AT', 'FINISHED_AT', 'IP'],
    bytes: 225,
    nonEmptyLines: 4,
  },
  {
    key: 'wowp_19_account_statistics.csv',
    fileName: 'WOWP_19_Account_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-A',
    delimiter: ',',
    headers: [
      'NAME',
      'CREATED_AT',
      'UPDATED_AT',
      'PREMIUM_EXPIRY_TIME',
      'AUTO_BAN_TIME',
      'ACC_OFFLINE',
      'GOLD',
      'ACC_ONLINE',
      'EXPERIENCE',
      'LOGOUT_TIME',
      'CREDITS',
      'SLOTS',
      'SPOTTED',
      'SHOTS_RECEIVED',
      'SQUAD_GAMES',
      'LAST_GAME_TIME',
      'BASE_GAIN_EXPERIENCE',
      'SUPERIORITY_POINTS',
      'SURVIVED',
      'SQUAD_WINS',
      'GAIN_EXPERIENCE',
      'WINS',
      'LOSSES',
      'GAMES_PLAYED',
      'MAX_STRUCTURE_DAMAGE',
      'MAX_GAIN_CREDITS',
      'MAX_STRUCTURE_DES_BY_WEAP_TYPE',
      'MAX_GROUND_OBJECTS_DESTROYED',
      'MAX_DAMAGE_DEALT',
      'MAX_KILLED',
      'MAX_ASSISTS_GROUND',
      'MAX_KILLED_BY_WEAPON_TYPE',
      'MAX_GRO_OB_DEST_BY_WEAPON_TYPE',
      'MAX_ASSISTS',
      'MAX_GAIN_EXPERIENCE',
      'TOTAL_ASSISTS',
      'TOTAL_DAMAGE_DEALT',
      'TOTAL_TEAM_OBJECTS_DESTROYED',
      'TOTAL_KILLED',
      'TOTAL_HITS',
      'TOTAL_GROUND_OBJECTS_DESTROYED',
      'TOTAL_ASSISTS_GROUND',
      'TOTAL_SHOTS',
      'TOTAL_TURRETS_DESTROYED',
      'TOTAL_STRUCTURE_DAMAGE',
      'ACHIEVEMENTS',
      'MEDALS',
      'RIBBONS',
      'LANGUAGE',
      'CBT_GAMES_PLAYED',
      'OBT_GAMES_PLAYED',
      'EMPTY_SLOTS',
      'GLOBAL_RATING',
    ],
    bytes: 1249,
    nonEmptyLines: 2,
  },
  {
    key: 'wowp_19_plane_statistics.csv',
    fileName: 'WOWP_19_Plane_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-A',
    delimiter: ',',
    headers: [
      'ACHIEVEMENTS',
      'BASE_GAIN_EXPERIENCE',
      'CREATED_AT',
      'GAIN_EXPERIENCE',
      'GAMES_PLAYED',
      'IN_GARAGE',
      'IN_GARAGE_UPDATED',
      'LAST_GAME_TIME',
      'LOSSES',
      'MAX_ASSISTS',
      'MAX_ASSISTS_GROUND',
      'MAX_DAMAGE_DEALT',
      'MAX_GAIN_CREDITS',
      'MAX_GAIN_EXPERIENCE',
      'MAX_GRO_OB_DEST_BY_WEAPON_TYPE',
      'MAX_GROUND_OBJECTS_DESTROYED',
      'MAX_KILLED',
      'MAX_KILLED_BY_WEAPON_TYPE',
      'MAX_STRUCTURE_DAMAGE',
      'MAX_STRUCTURE_DES_BY_WEAP_TYPE',
      'MEDALS',
      'VEHICLE_NAME',
      'RIBBONS',
      'SHOTS_RECEIVED',
      'SPOTTED',
      'SQUAD_GAMES',
      'SQUAD_WINS',
      'SUPERIORITY_POINTS',
      'SURVIVED',
      'TOTAL_ASSISTS',
      'TOTAL_ASSISTS_GROUND',
      'TOTAL_DAMAGE_DEALT',
      'TOTAL_GROUND_OBJECTS_DESTROYED',
      'TOTAL_HITS',
      'TOTAL_KILLED',
      'TOTAL_SHOTS',
      'TOTAL_STRUCTURE_DAMAGE',
      'TOTAL_TEAM_OBJECTS_DESTROYED',
      'TOTAL_TURRETS_DESTROYED',
      'UPDATED_AT',
      'WINS',
    ],
    bytes: 2109,
    nonEmptyLines: 7,
  },
  {
    key: 'wowp_20_account_statistics.csv',
    fileName: 'WOWP_20_Account_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-A',
    delimiter: ',',
    headers: [
      'NAME',
      'CREATED_AT',
      'UPDATED_AT',
      'PREMIUM_EXPIRY_TIME',
      'AUTO_BAN_TIME',
      'AT_DAMAGE_MAX',
      'B_ASSIST',
      'B_DAMAGE',
      'B_DAMAGE_MAX',
      'B_KILL',
      'B_KILL_MAX',
      'B_SCORE',
      'B_SCORE_AVG',
      'B_SCORE_MAX',
      'BASE_XP',
      'BASE_XP_AVG',
      'BASE_XP_MAX',
      'BATTLES',
      'CBT_GAMES_PLAYED',
      'CREDITS',
      'D_ASSIST',
      'D_DAMAGE',
      'D_DAMAGE_MAX',
      'D_KILL',
      'D_KILL_MAX',
      'DB_DAMAGE_MAX',
      'DB_KILL_MAX',
      'DEATHS',
      'DRAWS',
      'EMPTY_SLOTS',
      'EXPERIENCE',
      'FLIGHTS',
      'FLIGHTTIME',
      'G_ASSIST',
      'G_DAMAGE',
      'G_DAMAGE_MAX',
      'G_KILL',
      'G_KILL_MAX',
      'GLOBAL_RATING',
      'GOLD',
      'KD_RATION',
      'LANGUAGE',
      'LAST_COMPENSATION_TIME',
      'LAST_GAME_TIME',
      'LOGOUT_TIME',
      'LOSSES',
      'OBT_GAMES_PLAYED',
      'P_ASSIST',
      'P_DAMAGE',
      'P_DAMAGE_MAX',
      'P_KILL',
      'P_KILL_DEF_ZONE',
      'P_KILL_DEF_ZONE_MAX',
      'P_KILL_MAX',
      'SLOTS',
      'WINS',
      'ZONE_CAPTURE',
      'AT_KILL_AVG_DF',
      'G_KILL_AVG_DF',
      'P_KILL_AVG',
      'DB_KILL_AVG',
      'G_KILL_AVG',
    ],
    bytes: 1154,
    nonEmptyLines: 2,
  },
  {
    key: 'wowp_20_plane_statistics.csv',
    fileName: 'WOWP_20_Plane_Statistics.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-A',
    delimiter: ',',
    headers: [
      'UPDATED_AT',
      'AT_DAMAGE_MAX',
      'AT_KILL_MAX_DF',
      'B_SCORE',
      'B_SCORE_AVG',
      'B_SCORE_MAX',
      'BASE_XP',
      'BASE_XP_AVG',
      'BASE_XP_MAX',
      'B_ASSIST',
      'B_DAMAGE',
      'B_DAMAGE_MAX',
      'B_KILL',
      'B_KILL_MAX',
      'D_ASSIST',
      'D_DAMAGE',
      'D_DAMAGE_MAX',
      'D_KILL',
      'D_KILL_MAX',
      'G_ASSIST',
      'G_DAMAGE',
      'G_DAMAGE_MAX',
      'G_KILL',
      'G_KILL_MAX',
      'G_KILL_MAX_DF',
      'DB_DAMAGE_MAX',
      'DB_KILL_MAX',
      'DEATHS',
      'DRAWS',
      'BATTLES',
      'FLIGHTS',
      'FLIGHTTIME',
      'FLIGHTTIME_AVG',
      'LAST_GAME_TIME',
      'LOSSES',
      'WINS',
      'P_ASSIST',
      'P_DAMAGE',
      'P_DAMAGE_MAX',
      'P_KILL',
      'P_KILL_DEF_ZONE',
      'P_KILL_DEF_ZONE_MAX',
      'P_KILL_MAX',
      'ZONE_CAPTURE',
      'CHOSEN',
      'FIRST_CHOSEN',
      'RANKS',
      'P_KILL_AVG',
      'DB_KILL_AVG',
      'G_KILL_AVG',
      'AT_KILL_AVG_DF',
      'G_KILL_AVG_DF',
      'AT_DAMAGE_AVG_DF',
      'G_DAMAGE_AVG_DF',
      'IN_GARAGE',
      'IN_GARAGE_UPDATED',
    ],
    bytes: 2124,
    nonEmptyLines: 6,
  },
  {
    key: 'wows_account_storage.csv',
    fileName: 'WOWS_Account_Storage.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-A',
    delimiter: ',',
    headers: ['ITEM_DESC', 'AMOUNT'],
    bytes: 1844,
    nonEmptyLines: 63,
  },
  {
    key: 'wows_crews.csv',
    fileName: 'WOWS_Crews.csv',
    folder: 'Player_Statistics',
    account: 'ACCT-A',
    delimiter: ',',
    headers: [
      'CREW_ID',
      'CREW_SHIP',
      'CREW_TYPE',
      'CREW_LEVEL',
      'CREW_SHIP_TRAINED',
      'CREW_EXPERIENCE',
    ],
    bytes: 840,
    nonEmptyLines: 11,
  },
];

// Built as a mutable Map and only ever READ as one: the divergence pass below
// has to write, and a `ReadonlyMap` annotation would make that a type error at
// exactly the point where the second pass needs to run.
const byKey = new Map<string, CapturedHeaders>();

for (const file of CAPTURED_FILES) {
  if (file.headers === null || byKey.has(file.key)) continue;
  byKey.set(file.key, { key: file.key, headers: file.headers, divergent: false });
}

// Second pass: mark any key whose accounts disagreed, rather than letting the
// first account's list stand unchallenged. Empty in this capture; the guard
// asserts it stays empty.
for (const file of CAPTURED_FILES) {
  const known = byKey.get(file.key);
  if (!known || file.headers === null) continue;
  const sameLength = known.headers.length === file.headers.length;
  const sameOrder = known.headers.every((header, index) => header === file.headers?.[index]);
  if (!sameLength || !sameOrder) byKey.set(file.key, { ...known, divergent: true });
}

/** The header list and divergence flag for one file key. Read-only from here on. */
const BY_KEY: ReadonlyMap<string, CapturedHeaders> = byKey;

/**
 * The captured header list of one file key, plus whether accounts disagreed.
 *
 * Returns null for a key the capture does not hold, and for a key whose every
 * capture was suppressed — a caller that gets null cannot tell those apart from
 * the return type alone, and should treat both as "not captured" rather than as
 * "no columns".
 *
 * The key is matched EXACTLY, lower-cased, against {@link CAPTURED_FILES} keys:
 * these are the same strings `NEW_DATA_SPEC_FILES` uses, so a spec and a capture
 * line up by construction and a typo is a lookup miss rather than a silent
 * borrow of another file's columns.
 */
export function headersOf(key: string): CapturedHeaders | null {
  return BY_KEY.get(key) ?? null;
}
