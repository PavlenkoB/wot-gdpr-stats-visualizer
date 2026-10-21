// =============================================================================
// new-data-specs.ts — every column of every new-game file the app may store
// =============================================================================
//
// THIS FILE IS THE ALLOWLIST, and it is the only place in the application that
// names a stored column of a new-game file (D-08, PRIV-01).
//
// The direction of the rule is the whole point. The Worker already stores what
// a CSV says, column for column, and every legacy file in a supported folder is
// stored that way. A NEW game's file is not: its headers were unverified until
// plan 11-02 captured them off the user's own export, and the shape they take
// in the wild is attacker-controlled (an email, a nickname and an account id
// are exactly the columns Wargaming's own export carries elsewhere). So for
// these files the question flips from "which columns must be dropped?" to
// "which columns may be KEPT?", and the answer is the list below. A column that
// is not named here cannot reach IndexedDB, however loudly the file's own header
// announces it.
//
// ## Where every column below comes from
//
// A stored column is named here only if ONE of four sources admits it, and the
// scope of each source is narrow (D-08, D-12, D-15):
//
//   1. THE CAPTURE. Every HEAT, WoWS-crews/storage and Warplanes column comes
//      from `.planning/phases/11-new-game-data/11-HEADERS.md`, transcribed from
//      the `allow` rows of the user's own header capture and committed as names
//      in `tests/fixtures/new-data-headers.ts`. A column the decision table
//      marked `exclude` is never named here — `CITY`, `REGION`, `ISP_NAME`,
//      `ASN`, `ACCOUNT_ID`, the Warplanes `NAME`, and the rest of them are
//      excluded BY OMISSION, which is the fail-closed direction.
//   2. THE BUILDER VOCABULARY, for the four Warplanes files only. The Vehicles
//      builder already reads a set of headers from them, and an allowlist
//      narrower than its reader blanks a column the table shows today
//      (11-RESEARCH Pitfall 2, T-11-10). Those headers are exported as
//      `WOWP_FILE_HEADER_VOCABULARY` and a test asserts the union.
//   3. THE SESSION VOCABULARY, for the two session files only. The Playtime and
//      Login aggregators already resolve seven headers off a session row, and
//      narrowing a session spec to the capture would change which sessions they
//      count (D-08, D-10). Those seven are pinned in the test that also proves
//      each one is a quoted literal in the module that reads it.
//
//   4. THE PHASE 12 CAPTURE, for the nine Phase 12 files only (the five Account
//      timeline files, the three Perks files and the Surveys file). Every
//      column comes from the `allow` rows of
//      `.planning/phases/12-account-timeline-perks/12-HEADERS.md`, which is the
//      user's own per-column risk answers applied to the rules there. Those nine
//      specs ALL set `emailGuard`, because an allowlisted column can still hold
//      an email as its VALUE (D-01, PRIV-01), and an email-bearing,
//      person-identifying, free-text or surrogate-identifier column is excluded
//      BY OMISSION (`IP` in the two history files, `UID`, `DESCRIPTION`,
//      `REASON`, `PREREQUISITE`, `SUBSCRIPTION`, `PROFILE_ID`, `BATTLE_ID`).
//
// A column admitted by source 2 or 3 is a SUPERSET of the capture, never a
// substitute for it: the two session specs keep all seven whatever the captured
// headers carry, and the Warplanes specs keep every builder header whatever the
// capture omitted.
//
// ## Why widening this table is expensive
//
// Every stored row is keyed by the spec header, and a row stored by an older
// build keeps whatever key that build wrote. Widening a spec therefore does not
// retroactively change a returning user's cache: the old rows are still there
// under the old shape, and a reader that has been reading both shapes has to
// keep reading both. That is why each new-game plan APPENDS an entry rather than
// editing one, and why `heat_device_info.csv` alone has no entry at all — it
// is a family file that counts as present and stores nothing.
//
// `heat_surveys.csv` is the entry phase 12 (D-03) added first, and it is the
// reason the rule above is stated as it is. It stores four columns
// (`QUESTION_ID`, `PLAYER_ANSWER`, `SKIPPED_BY_PLAYER`, `MESSAGE_TS`) and
// excludes `PROFILE_ID` and `BATTLE_ID` BY OMISSION. `PLAYER_ANSWER` was
// excluded by default until the user stated, at the plan 12-01 checkpoint, that
// it is an enumerated rating (one numeric character, no free text); widening an
// entry costs a cache rebuild, narrowing it is free, so the default held until
// that statement was recorded in `12-HEADERS.md`.
//
// ## Why `id` equals `header` here
//
// `SpecColumn` carries an `id` so a LATER plan can rewrite one export header
// onto a different stored header without touching the reader. No spec does that
// yet, deliberately: an alias rewrite would change what a hybrid header means,
// and the aggregators' own alias pairs (SESSION_START vs STARTED_AT) are read
// by ONE rule in ONE module. Until a real header forces the question, every
// column maps to itself and the aggregators behave exactly as they always have.
// (The camelCase label key in `11-HEADERS.md` is a PANE label map's key, not a
// stored key — the header above that table says so.)
// =============================================================================

/**
 * What a stored column's value is, for a reader that has to know whether to
 * parse it.
 *
 * `date` is a wall-clock stamp with no timezone (D-01); `address` is an IP the
 * login pane masks before it reaches the screen; `code` is a coupon or bonus
 * code (stored in clear in the user's own IndexedDB because the single reveal
 * requires it, masked on screen); `number` is a count. The kind
 * is documentation and a check-in seam — nothing in the worker branches on it
 * today, because the aggregators already resolve their own columns and validate
 * their own values, and a second validation path would be a second answer.
 */
export type SpecColumnKind = 'text' | 'number' | 'date' | 'address' | 'code';

/**
 * ONE column a new-game file may contribute, and the stored header it becomes.
 *
 * `header` is the MATCH key (compared through `headerKey`, so a lower-case,
 * padded or BOM-prefixed file header still matches) AND, because every spec
 * currently maps a column to itself, the stored key.
 */
export interface SpecColumn {
  /** The header constant: trimmed and upper-cased by `headerKey` before matching. */
  readonly header: string;
  /** The stored header this column is written under. Equal to `header` today. */
  readonly id: string;
  /** What the value is, for a reader that must know before it parses. */
  readonly kind: SpecColumnKind;
}

/** ONE new-game file: which file it is, which category may hold it, what it stores. */
export interface SpecFile {
  /** The lower-cased file name, e.g. `heat_game_sessions.csv`. */
  readonly key: string;
  /**
   * The lower-cased stored CATEGORY this file belongs in.
   *
   * The folder the capture filed the file under, lower-cased — so the app
   * refuses a name in a folder it was never seen in. A name match in the wrong
   * category stores nothing (D-15); the folder an archive files a CSV under is
   * attacker-controlled, so the spec's own category is a second, independent
   * condition rather than a hint.
   */
  readonly category: string;
  /** The columns this file may store, in no particular order. */
  readonly columns: readonly SpecColumn[];
  /**
   * When true, `projectRow` also drops any cell whose VALUE looks like an email
   * address.
   *
   * A header allowlist cannot see inside an allowlisted column: a service
   * identifier, a ban comment or a third-party contact can carry an email as
   * its value, and D-01 says emails are never stored. Set on the nine Phase 12
   * specs; deliberately left unset on the Phase 11 specs so no existing cache
   * is re-narrowed by it (D-03, PRIV-01).
   */
  readonly emailGuard?: boolean;
}

/**
 * The session columns shared by every per-game session file.
 *
 * Source 3 above, and the reason this plan cannot narrow them to the capture.
 * Two aliases each, and each maps to ITSELF. `resolveSessionColumns` already
 * reads `SESSION_START` before `STARTED_AT` (or the other way round) and takes
 * whichever the file carries, so writing both under their own names leaves a
 * hybrid header behaving exactly as it did before the allowlist existed.
 *
 * Which of the seven the real capture carries is a property of the user's
 * export, not of this table: `SERVER_NAME` and `CLIENT_PLATFORM` do not appear
 * in the captured HEAT header and the alias pair is absent from both captured
 * session files, and they are kept anyway because the aggregators read them.
 */
function sessionColumns(): readonly SpecColumn[] {
  return [
    // Two aliases each, resolved by `resolveSessionColumns` in
    // playtime-aggregate.ts; the LOGIN aggregator reads STARTED_AT and
    // SESSION_START through its own `TIME_COLUMN_NAMES`.
    { header: 'STARTED_AT', id: 'STARTED_AT', kind: 'date' },
    { header: 'FINISHED_AT', id: 'FINISHED_AT', kind: 'date' },
    { header: 'SESSION_START', id: 'SESSION_START', kind: 'date' },
    { header: 'SESSION_END', id: 'SESSION_END', kind: 'date' },
    // The two split columns the Playtime dashboard reads. A server label and a
    // platform label, never a person — the guard test says so in as many words.
    { header: 'SERVER_NAME', id: 'SERVER_NAME', kind: 'text' },
    { header: 'CLIENT_PLATFORM', id: 'CLIENT_PLATFORM', kind: 'text' },
    // The address. It is named because the LOGIN aggregator reads it (06-01),
    // and it is at rest in the user's own IndexedDB for exactly as long as the
    // rows are — the pane masks it, nothing leaves the machine (T-04-01).
    { header: 'IP', id: 'IP', kind: 'address' },
  ];
}

/**
 * Every new-game file the app may store a row of.
 *
 * A file in the new-game FAMILY that has no entry here stores NOTHING at all —
 * see `specFor` in `new-data-allowlist.ts`. That is the fail-closed direction,
 * and it is why this list growing is the mechanism by which a new game becomes
 * readable rather than a step in a general rule that happens to admit it.
 *
 * `heat_device_info.csv` is named NOWHERE in this file, on purpose: it is a
 * family file, it is counted as present, and it stores no cell
 * (11-HEADERS.md, D-15 Open Question 7). A guard test asserts its absence so a
 * later plan cannot add it by reflex.
 *
 * `heat_surveys.csv` IS named here, since phase 12 (D-03): the `Surveys` folder
 * was promoted, and its one file's four allowlisted columns are the whole of
 * what the Perks pane may ever show of a survey answer.
 *
 * The eight other Phase 12 files are named here too (plan 12-08), each with
 * `emailGuard`: three Account timeline history files filed under `User_Info`,
 * the Bans and Authorized_Third_Parties files, and the Subscriptions,
 * Personal_Coupons and Bonus_Codes files the Perks pane reads.
 */
export const NEW_DATA_SPEC_FILES: readonly SpecFile[] = [
  {
    key: 'heat_game_sessions.csv',
    category: 'activity_history',
    columns: sessionColumns(),
  },
  {
    key: 'wotc_game_sessions.csv',
    category: 'activity_history',
    columns: sessionColumns(),
  },
  {
    key: 'heat_session_geolocation.csv',
    category: 'activity_history',
    // HEAT / Geolocation card. Rule (c) admits the masked address; rule (b) keeps the country and refuses the region, city and both network-identity columns.
    columns: [
      { header: 'IP', id: 'IP', kind: 'address' },
      { header: 'COUNTRY_CODE_ALPHA_3', id: 'COUNTRY_CODE_ALPHA_3', kind: 'text' },
      { header: 'CONNECTION_SPEED', id: 'CONNECTION_SPEED', kind: 'number' },
      { header: 'LAST_SESSION_STARTED_DT', id: 'LAST_SESSION_STARTED_DT', kind: 'date' },
      { header: 'LAST_SESSION_FINISHED_DT', id: 'LAST_SESSION_FINISHED_DT', kind: 'date' },
    ],
  },
  {
    key: 'heat_account_statistics.csv',
    category: 'player_statistics',
    // HEAT / Account statistics card. Seven rule (e) lifecycle facts and one country code; no identifier of any kind survives.
    columns: [
      { header: 'REGISTRATION_DT', id: 'REGISTRATION_DT', kind: 'date' },
      { header: 'ACTIVATION_DT', id: 'ACTIVATION_DT', kind: 'date' },
      { header: 'FIRST_LOGIN_DT', id: 'FIRST_LOGIN_DT', kind: 'date' },
      { header: 'FIRST_LOGIN_PLATFORM', id: 'FIRST_LOGIN_PLATFORM', kind: 'text' },
      { header: 'FIRST_BATTLE_DT', id: 'FIRST_BATTLE_DT', kind: 'date' },
      { header: 'FIRST_PAYMENT_DT', id: 'FIRST_PAYMENT_DT', kind: 'date' },
      { header: 'COUNTRY_CODE', id: 'COUNTRY_CODE', kind: 'text' },
    ],
  },
  {
    key: 'heat_battle_types_statistics.csv',
    category: 'player_statistics',
    // HEAT / Battle types card. Enumerations, counters and two timestamps — the whole file is rule (e).
    columns: [
      { header: 'GAME_MODE', id: 'GAME_MODE', kind: 'text' },
      { header: 'GAME_SOURCE', id: 'GAME_SOURCE', kind: 'text' },
      { header: 'BATTLES', id: 'BATTLES', kind: 'number' },
      { header: 'WINS', id: 'WINS', kind: 'number' },
      { header: 'LOSSES', id: 'LOSSES', kind: 'number' },
      { header: 'DRAWS', id: 'DRAWS', kind: 'number' },
      { header: 'ND', id: 'ND', kind: 'number' },
      { header: 'DAMAGE', id: 'DAMAGE', kind: 'number' },
      { header: 'DAMAGE_TAKEN', id: 'DAMAGE_TAKEN', kind: 'number' },
      { header: 'FRAGS', id: 'FRAGS', kind: 'number' },
      { header: 'KILL_ASSIST', id: 'KILL_ASSIST', kind: 'number' },
      { header: 'DEATHS', id: 'DEATHS', kind: 'number' },
      { header: 'SHOOT_DONE', id: 'SHOOT_DONE', kind: 'number' },
      { header: 'HITS_DONE', id: 'HITS_DONE', kind: 'number' },
      { header: 'CAPTURE_POINTS', id: 'CAPTURE_POINTS', kind: 'number' },
      { header: 'TIME_PLAYED_BY_HUMAN', id: 'TIME_PLAYED_BY_HUMAN', kind: 'number' },
      { header: 'VEHICLE_EXPERIENCE', id: 'VEHICLE_EXPERIENCE', kind: 'number' },
      { header: 'FRONTMAN_EXPERIENCE', id: 'FRONTMAN_EXPERIENCE', kind: 'number' },
      { header: 'ARENA_START_TS', id: 'ARENA_START_TS', kind: 'date' },
      { header: 'ARENA_END_TS', id: 'ARENA_END_TS', kind: 'date' },
    ],
  },
  {
    key: 'heat_account_storage.csv',
    category: 'player_statistics',
    // HEAT / Storage card. Game-object codes and labels (rule d) plus a realm enumeration and a date.
    columns: [
      { header: 'ASSET_CODE', id: 'ASSET_CODE', kind: 'text' },
      { header: 'FIRST_OWNED_TS', id: 'FIRST_OWNED_TS', kind: 'date' },
      { header: 'REALM_CODE', id: 'REALM_CODE', kind: 'text' },
      { header: 'ASSET_NAME', id: 'ASSET_NAME', kind: 'text' },
    ],
  },
  {
    key: 'wows_crews.csv',
    category: 'player_statistics',
    // Warships crews list row. Six game-object and counter columns; the capture found no personal column in this file at all.
    columns: [
      { header: 'CREW_ID', id: 'CREW_ID', kind: 'text' },
      { header: 'CREW_SHIP', id: 'CREW_SHIP', kind: 'text' },
      { header: 'CREW_TYPE', id: 'CREW_TYPE', kind: 'text' },
      { header: 'CREW_LEVEL', id: 'CREW_LEVEL', kind: 'number' },
      { header: 'CREW_SHIP_TRAINED', id: 'CREW_SHIP_TRAINED', kind: 'text' },
      { header: 'CREW_EXPERIENCE', id: 'CREW_EXPERIENCE', kind: 'number' },
    ],
  },
  {
    key: 'wows_account_storage.csv',
    category: 'player_statistics',
    // Warships storage list row. An in-game item label (rule d) and a counter.
    columns: [
      { header: 'ITEM_DESC', id: 'ITEM_DESC', kind: 'text' },
      { header: 'AMOUNT', id: 'AMOUNT', kind: 'number' },
    ],
  },
  {
    key: 'wowp_19_plane_statistics.csv',
    category: 'player_statistics',
    // Warplanes 19 table. The capture allow rows first, then the builder vocabulary, so an older export revision keeps filling the table (Pitfall 2).
    columns: [
      { header: 'GAIN_EXPERIENCE', id: 'GAIN_EXPERIENCE', kind: 'number' },
      { header: 'GAMES_PLAYED', id: 'GAMES_PLAYED', kind: 'number' },
      { header: 'IN_GARAGE', id: 'IN_GARAGE', kind: 'text' },
      { header: 'LAST_GAME_TIME', id: 'LAST_GAME_TIME', kind: 'date' },
      { header: 'MAX_DAMAGE_DEALT', id: 'MAX_DAMAGE_DEALT', kind: 'number' },
      { header: 'MAX_GAIN_EXPERIENCE', id: 'MAX_GAIN_EXPERIENCE', kind: 'number' },
      { header: 'VEHICLE_NAME', id: 'VEHICLE_NAME', kind: 'text' },
      { header: 'SPOTTED', id: 'SPOTTED', kind: 'number' },
      { header: 'SURVIVED', id: 'SURVIVED', kind: 'number' },
      { header: 'TOTAL_DAMAGE_DEALT', id: 'TOTAL_DAMAGE_DEALT', kind: 'number' },
      { header: 'TOTAL_HITS', id: 'TOTAL_HITS', kind: 'number' },
      { header: 'TOTAL_KILLED', id: 'TOTAL_KILLED', kind: 'number' },
      { header: 'TOTAL_SHOTS', id: 'TOTAL_SHOTS', kind: 'number' },
      { header: 'WINS', id: 'WINS', kind: 'number' },
      // Source 2: the headers the Vehicles builder reads from this file
      // (WOWP_FILE_HEADER_VOCABULARY). None is present in the capture, so
      // they admit an older export revision rather than this one.
      { header: 'BATTLES_COUNT', id: 'BATTLES_COUNT', kind: 'number' },
      { header: 'BATTLES', id: 'BATTLES', kind: 'number' },
      { header: 'WINS_COUNT', id: 'WINS_COUNT', kind: 'number' },
      { header: 'DAMAGE_DEALT', id: 'DAMAGE_DEALT', kind: 'number' },
      { header: 'FRAGS_COUNT', id: 'FRAGS_COUNT', kind: 'number' },
      { header: 'FRAGS', id: 'FRAGS', kind: 'number' },
      { header: 'XP_AMOUNT', id: 'XP_AMOUNT', kind: 'number' },
      { header: 'XP', id: 'XP', kind: 'number' },
      { header: 'EXP', id: 'EXP', kind: 'number' },
      { header: 'SURVIVED_BATTLES', id: 'SURVIVED_BATTLES', kind: 'number' },
      { header: 'HITS_COUNT', id: 'HITS_COUNT', kind: 'number' },
      { header: 'HITS', id: 'HITS', kind: 'number' },
      { header: 'SHOTS_COUNT', id: 'SHOTS_COUNT', kind: 'number' },
      { header: 'SHOTS', id: 'SHOTS', kind: 'number' },
      { header: 'DAMAGE_MAX', id: 'DAMAGE_MAX', kind: 'number' },
      { header: 'FRAGS_MAX', id: 'FRAGS_MAX', kind: 'number' },
      { header: 'MAX_FRAGS', id: 'MAX_FRAGS', kind: 'number' },
      { header: 'XP_MAX', id: 'XP_MAX', kind: 'number' },
      { header: 'MAX_XP', id: 'MAX_XP', kind: 'number' },
      { header: 'MAX_EXP', id: 'MAX_EXP', kind: 'number' },
      { header: 'DAMAGE_RECEIVED', id: 'DAMAGE_RECEIVED', kind: 'number' },
      { header: 'SPOTTED_COUNT', id: 'SPOTTED_COUNT', kind: 'number' },
      { header: 'PLANES_KILLED', id: 'PLANES_KILLED', kind: 'number' },
      { header: 'DISTANCE', id: 'DISTANCE', kind: 'number' },
      { header: 'LAST_BATTLE_AT', id: 'LAST_BATTLE_AT', kind: 'date' },
      { header: 'LAST_BATTLE_TIME', id: 'LAST_BATTLE_TIME', kind: 'date' },
    ],
  },
  {
    key: 'wowp_19_account_statistics.csv',
    category: 'player_statistics',
    // Warplanes account block. Every non-identifying numeric and date column rule (g) admits, and `NAME` is the one header it does not.
    columns: [
      { header: 'CREATED_AT', id: 'CREATED_AT', kind: 'date' },
      { header: 'UPDATED_AT', id: 'UPDATED_AT', kind: 'date' },
      { header: 'PREMIUM_EXPIRY_TIME', id: 'PREMIUM_EXPIRY_TIME', kind: 'date' },
      { header: 'AUTO_BAN_TIME', id: 'AUTO_BAN_TIME', kind: 'date' },
      { header: 'ACC_OFFLINE', id: 'ACC_OFFLINE', kind: 'text' },
      { header: 'GOLD', id: 'GOLD', kind: 'text' },
      { header: 'ACC_ONLINE', id: 'ACC_ONLINE', kind: 'text' },
      { header: 'EXPERIENCE', id: 'EXPERIENCE', kind: 'text' },
      { header: 'LOGOUT_TIME', id: 'LOGOUT_TIME', kind: 'date' },
      { header: 'CREDITS', id: 'CREDITS', kind: 'text' },
      { header: 'SLOTS', id: 'SLOTS', kind: 'text' },
      { header: 'SPOTTED', id: 'SPOTTED', kind: 'number' },
      { header: 'SHOTS_RECEIVED', id: 'SHOTS_RECEIVED', kind: 'text' },
      { header: 'SQUAD_GAMES', id: 'SQUAD_GAMES', kind: 'text' },
      { header: 'LAST_GAME_TIME', id: 'LAST_GAME_TIME', kind: 'date' },
      { header: 'BASE_GAIN_EXPERIENCE', id: 'BASE_GAIN_EXPERIENCE', kind: 'text' },
      { header: 'SUPERIORITY_POINTS', id: 'SUPERIORITY_POINTS', kind: 'text' },
      { header: 'SURVIVED', id: 'SURVIVED', kind: 'number' },
      { header: 'SQUAD_WINS', id: 'SQUAD_WINS', kind: 'text' },
      { header: 'GAIN_EXPERIENCE', id: 'GAIN_EXPERIENCE', kind: 'number' },
      { header: 'WINS', id: 'WINS', kind: 'number' },
      { header: 'LOSSES', id: 'LOSSES', kind: 'text' },
      { header: 'GAMES_PLAYED', id: 'GAMES_PLAYED', kind: 'number' },
      { header: 'MAX_STRUCTURE_DAMAGE', id: 'MAX_STRUCTURE_DAMAGE', kind: 'text' },
      { header: 'MAX_GAIN_CREDITS', id: 'MAX_GAIN_CREDITS', kind: 'text' },
      {
        header: 'MAX_STRUCTURE_DES_BY_WEAP_TYPE',
        id: 'MAX_STRUCTURE_DES_BY_WEAP_TYPE',
        kind: 'text',
      },
      { header: 'MAX_GROUND_OBJECTS_DESTROYED', id: 'MAX_GROUND_OBJECTS_DESTROYED', kind: 'text' },
      { header: 'MAX_DAMAGE_DEALT', id: 'MAX_DAMAGE_DEALT', kind: 'number' },
      { header: 'MAX_KILLED', id: 'MAX_KILLED', kind: 'text' },
      { header: 'MAX_ASSISTS_GROUND', id: 'MAX_ASSISTS_GROUND', kind: 'text' },
      { header: 'MAX_KILLED_BY_WEAPON_TYPE', id: 'MAX_KILLED_BY_WEAPON_TYPE', kind: 'text' },
      {
        header: 'MAX_GRO_OB_DEST_BY_WEAPON_TYPE',
        id: 'MAX_GRO_OB_DEST_BY_WEAPON_TYPE',
        kind: 'text',
      },
      { header: 'MAX_ASSISTS', id: 'MAX_ASSISTS', kind: 'text' },
      { header: 'MAX_GAIN_EXPERIENCE', id: 'MAX_GAIN_EXPERIENCE', kind: 'number' },
      { header: 'TOTAL_ASSISTS', id: 'TOTAL_ASSISTS', kind: 'text' },
      { header: 'TOTAL_DAMAGE_DEALT', id: 'TOTAL_DAMAGE_DEALT', kind: 'number' },
      { header: 'TOTAL_TEAM_OBJECTS_DESTROYED', id: 'TOTAL_TEAM_OBJECTS_DESTROYED', kind: 'text' },
      { header: 'TOTAL_KILLED', id: 'TOTAL_KILLED', kind: 'number' },
      { header: 'TOTAL_HITS', id: 'TOTAL_HITS', kind: 'number' },
      {
        header: 'TOTAL_GROUND_OBJECTS_DESTROYED',
        id: 'TOTAL_GROUND_OBJECTS_DESTROYED',
        kind: 'text',
      },
      { header: 'TOTAL_ASSISTS_GROUND', id: 'TOTAL_ASSISTS_GROUND', kind: 'text' },
      { header: 'TOTAL_SHOTS', id: 'TOTAL_SHOTS', kind: 'number' },
      { header: 'TOTAL_TURRETS_DESTROYED', id: 'TOTAL_TURRETS_DESTROYED', kind: 'text' },
      { header: 'TOTAL_STRUCTURE_DAMAGE', id: 'TOTAL_STRUCTURE_DAMAGE', kind: 'text' },
      { header: 'ACHIEVEMENTS', id: 'ACHIEVEMENTS', kind: 'text' },
      { header: 'MEDALS', id: 'MEDALS', kind: 'text' },
      { header: 'RIBBONS', id: 'RIBBONS', kind: 'text' },
      { header: 'LANGUAGE', id: 'LANGUAGE', kind: 'text' },
      { header: 'CBT_GAMES_PLAYED', id: 'CBT_GAMES_PLAYED', kind: 'text' },
      { header: 'OBT_GAMES_PLAYED', id: 'OBT_GAMES_PLAYED', kind: 'text' },
      { header: 'EMPTY_SLOTS', id: 'EMPTY_SLOTS', kind: 'text' },
      { header: 'GLOBAL_RATING', id: 'GLOBAL_RATING', kind: 'text' },
      // Source 2: the headers the Vehicles builder reads from this file
      // (WOWP_FILE_HEADER_VOCABULARY). None is present in the capture, so
      // they admit an older export revision rather than this one.
      { header: 'BATTLES_COUNT', id: 'BATTLES_COUNT', kind: 'number' },
      { header: 'BATTLES', id: 'BATTLES', kind: 'number' },
      { header: 'PREMIUM_EXPIRES_AT', id: 'PREMIUM_EXPIRES_AT', kind: 'date' },
    ],
  },
  {
    key: 'wowp_20_plane_statistics.csv',
    category: 'player_statistics',
    // Warplanes 20 NOTE. Four columns: the note's own `BATTLES` total plus the three `ALL_FIELDS` headers the capture happens to carry. No vehicle identifier exists in this file at all (D-09).
    columns: [
      { header: 'BATTLES', id: 'BATTLES', kind: 'number' },
      { header: 'LAST_GAME_TIME', id: 'LAST_GAME_TIME', kind: 'date' },
      { header: 'WINS', id: 'WINS', kind: 'number' },
      { header: 'IN_GARAGE', id: 'IN_GARAGE', kind: 'text' },
    ],
  },
  {
    key: 'wowp_20_account_statistics.csv',
    category: 'player_statistics',
    // Warplanes 20 account block. The union of the capture allow rows and the builder vocabulary, `NAME` excepted.
    columns: [
      { header: 'CREATED_AT', id: 'CREATED_AT', kind: 'date' },
      { header: 'UPDATED_AT', id: 'UPDATED_AT', kind: 'date' },
      { header: 'PREMIUM_EXPIRY_TIME', id: 'PREMIUM_EXPIRY_TIME', kind: 'date' },
      { header: 'AUTO_BAN_TIME', id: 'AUTO_BAN_TIME', kind: 'date' },
      { header: 'AT_DAMAGE_MAX', id: 'AT_DAMAGE_MAX', kind: 'text' },
      { header: 'B_ASSIST', id: 'B_ASSIST', kind: 'text' },
      { header: 'B_DAMAGE', id: 'B_DAMAGE', kind: 'text' },
      { header: 'B_DAMAGE_MAX', id: 'B_DAMAGE_MAX', kind: 'text' },
      { header: 'B_KILL', id: 'B_KILL', kind: 'text' },
      { header: 'B_KILL_MAX', id: 'B_KILL_MAX', kind: 'text' },
      { header: 'B_SCORE', id: 'B_SCORE', kind: 'text' },
      { header: 'B_SCORE_AVG', id: 'B_SCORE_AVG', kind: 'text' },
      { header: 'B_SCORE_MAX', id: 'B_SCORE_MAX', kind: 'text' },
      { header: 'BASE_XP', id: 'BASE_XP', kind: 'text' },
      { header: 'BASE_XP_AVG', id: 'BASE_XP_AVG', kind: 'text' },
      { header: 'BASE_XP_MAX', id: 'BASE_XP_MAX', kind: 'text' },
      { header: 'BATTLES', id: 'BATTLES', kind: 'number' },
      { header: 'CBT_GAMES_PLAYED', id: 'CBT_GAMES_PLAYED', kind: 'text' },
      { header: 'CREDITS', id: 'CREDITS', kind: 'text' },
      { header: 'D_ASSIST', id: 'D_ASSIST', kind: 'text' },
      { header: 'D_DAMAGE', id: 'D_DAMAGE', kind: 'text' },
      { header: 'D_DAMAGE_MAX', id: 'D_DAMAGE_MAX', kind: 'text' },
      { header: 'D_KILL', id: 'D_KILL', kind: 'text' },
      { header: 'D_KILL_MAX', id: 'D_KILL_MAX', kind: 'text' },
      { header: 'DB_DAMAGE_MAX', id: 'DB_DAMAGE_MAX', kind: 'text' },
      { header: 'DB_KILL_MAX', id: 'DB_KILL_MAX', kind: 'text' },
      { header: 'DEATHS', id: 'DEATHS', kind: 'text' },
      { header: 'DRAWS', id: 'DRAWS', kind: 'text' },
      { header: 'EMPTY_SLOTS', id: 'EMPTY_SLOTS', kind: 'text' },
      { header: 'EXPERIENCE', id: 'EXPERIENCE', kind: 'text' },
      { header: 'FLIGHTS', id: 'FLIGHTS', kind: 'text' },
      { header: 'FLIGHTTIME', id: 'FLIGHTTIME', kind: 'text' },
      { header: 'G_ASSIST', id: 'G_ASSIST', kind: 'text' },
      { header: 'G_DAMAGE', id: 'G_DAMAGE', kind: 'text' },
      { header: 'G_DAMAGE_MAX', id: 'G_DAMAGE_MAX', kind: 'text' },
      { header: 'G_KILL', id: 'G_KILL', kind: 'text' },
      { header: 'G_KILL_MAX', id: 'G_KILL_MAX', kind: 'text' },
      { header: 'GLOBAL_RATING', id: 'GLOBAL_RATING', kind: 'text' },
      { header: 'GOLD', id: 'GOLD', kind: 'text' },
      { header: 'KD_RATION', id: 'KD_RATION', kind: 'text' },
      { header: 'LANGUAGE', id: 'LANGUAGE', kind: 'text' },
      { header: 'LAST_COMPENSATION_TIME', id: 'LAST_COMPENSATION_TIME', kind: 'date' },
      { header: 'LAST_GAME_TIME', id: 'LAST_GAME_TIME', kind: 'date' },
      { header: 'LOGOUT_TIME', id: 'LOGOUT_TIME', kind: 'date' },
      { header: 'LOSSES', id: 'LOSSES', kind: 'text' },
      { header: 'OBT_GAMES_PLAYED', id: 'OBT_GAMES_PLAYED', kind: 'text' },
      { header: 'P_ASSIST', id: 'P_ASSIST', kind: 'text' },
      { header: 'P_DAMAGE', id: 'P_DAMAGE', kind: 'text' },
      { header: 'P_DAMAGE_MAX', id: 'P_DAMAGE_MAX', kind: 'text' },
      { header: 'P_KILL', id: 'P_KILL', kind: 'text' },
      { header: 'P_KILL_DEF_ZONE', id: 'P_KILL_DEF_ZONE', kind: 'text' },
      { header: 'P_KILL_DEF_ZONE_MAX', id: 'P_KILL_DEF_ZONE_MAX', kind: 'text' },
      { header: 'P_KILL_MAX', id: 'P_KILL_MAX', kind: 'text' },
      { header: 'SLOTS', id: 'SLOTS', kind: 'text' },
      { header: 'WINS', id: 'WINS', kind: 'number' },
      { header: 'ZONE_CAPTURE', id: 'ZONE_CAPTURE', kind: 'text' },
      { header: 'AT_KILL_AVG_DF', id: 'AT_KILL_AVG_DF', kind: 'text' },
      { header: 'G_KILL_AVG_DF', id: 'G_KILL_AVG_DF', kind: 'text' },
      { header: 'P_KILL_AVG', id: 'P_KILL_AVG', kind: 'text' },
      { header: 'DB_KILL_AVG', id: 'DB_KILL_AVG', kind: 'text' },
      { header: 'G_KILL_AVG', id: 'G_KILL_AVG', kind: 'text' },
      // Source 2: the headers the Vehicles builder reads from this file
      // (WOWP_FILE_HEADER_VOCABULARY). None is present in the capture, so
      // they admit an older export revision rather than this one.
      { header: 'BATTLES_COUNT', id: 'BATTLES_COUNT', kind: 'number' },
      { header: 'GAMES_PLAYED', id: 'GAMES_PLAYED', kind: 'number' },
      { header: 'PREMIUM_EXPIRES_AT', id: 'PREMIUM_EXPIRES_AT', kind: 'date' },
    ],
  },
  {
    key: 'heat_surveys.csv',
    category: 'surveys',
    emailGuard: true,
    // The survey answer, reduced to the four columns that are neither an identifier
    // of a person or a battle nor free text (phase 12, D-03). `QUESTION_ID` is a
    // survey-question identifier, a game object. `PLAYER_ANSWER` is admitted by
    // rule (h): the user stated it is an enumerated rating, one character, no free
    // text. `SKIPPED_BY_PLAYER` is a flag and `MESSAGE_TS` the answer's stamp.
    //
    // Excluded BY OMISSION, whatever the file's header says: `PROFILE_ID` is a
    // profile identifier and `BATTLE_ID` a battle identifier (rules a and b). The
    // email guard stays on even for the rating, so a hand-edited file that puts an
    // address in that cell cannot store it.
    columns: [
      { header: 'QUESTION_ID', id: 'QUESTION_ID', kind: 'text' },
      { header: 'PLAYER_ANSWER', id: 'PLAYER_ANSWER', kind: 'text' },
      { header: 'SKIPPED_BY_PLAYER', id: 'SKIPPED_BY_PLAYER', kind: 'text' },
      { header: 'MESSAGE_TS', id: 'MESSAGE_TS', kind: 'date' },
    ],
  },
  {
    key: 'account_name_history.csv',
    category: 'user_info',
    emailGuard: true,
    // Account timeline / Name. Rule (c) admits the two past-nickname columns in THIS file only; `IP` is excluded by rule (d) (an address is admitted only in the Bans, Authorized_Third_Parties and Bonus_Codes files).
    columns: [
      { header: 'CREATED_AT', id: 'CREATED_AT', kind: 'date' },
      { header: 'OLD_NAME', id: 'OLD_NAME', kind: 'text' },
      { header: 'NEW_NAME', id: 'NEW_NAME', kind: 'text' },
    ],
  },
  {
    key: 'external_services_history.csv',
    category: 'user_info',
    emailGuard: true,
    // Account timeline / Service. An operation enumeration, a lower-case service token and a stamp; `IP` is excluded by rule (d) and `UID` by rules (a) and (g) (it carries an at-sign).
    columns: [
      { header: 'CREATED_AT', id: 'CREATED_AT', kind: 'date' },
      { header: 'OPERATION', id: 'OPERATION', kind: 'text' },
      { header: 'NAME', id: 'NAME', kind: 'text' },
    ],
  },
  {
    key: 'language_and_country_history.csv',
    category: 'user_info',
    emailGuard: true,
    // Account timeline / Language and country. `VALUE` is a two-letter code and `NAME` says whether it is a language or a country; both are enumerations the user rated no risk.
    columns: [
      { header: 'CREATED_AT', id: 'CREATED_AT', kind: 'date' },
      { header: 'OPERATION', id: 'OPERATION', kind: 'text' },
      { header: 'NAME', id: 'NAME', kind: 'text' },
      { header: 'VALUE', id: 'VALUE', kind: 'text' },
    ],
  },
  {
    key: 'bans.csv',
    category: 'bans',
    emailGuard: true,
    // Account timeline / Ban. Two stamps (`EXPIRED_AT` may hold the `\N` null marker for an open ban) and a status enumeration; `DESCRIPTION` and `REASON` are free text, excluded by rule (g).
    columns: [
      { header: 'STARTED_AT', id: 'STARTED_AT', kind: 'date' },
      { header: 'EXPIRED_AT', id: 'EXPIRED_AT', kind: 'date' },
      { header: 'STATUS', id: 'STATUS', kind: 'text' },
    ],
  },
  {
    key: 'authorized_third_parties.csv',
    category: 'authorized_third_parties',
    emailGuard: true,
    // Account timeline / Third party. A site name the user rated no risk and the stamp it was authorized; the email guard still drops a site cell that is an address.
    columns: [
      { header: 'THIRD_PARTY_SITE', id: 'THIRD_PARTY_SITE', kind: 'text' },
      { header: 'CREATED_AT', id: 'CREATED_AT', kind: 'date' },
    ],
  },
  {
    key: 'subscriptions.csv',
    category: 'subscriptions',
    emailGuard: true,
    // Perks / Subscriptions. One column: the TRUE/FALSE flag. `SUBSCRIPTION` is excluded because the user could not rule out free text (rule g, recorded unsure), so the card can say subscribed or not and never what to.
    columns: [{ header: 'SUBSCRIBED', id: 'SUBSCRIBED', kind: 'text' }],
  },
  {
    key: 'personal_coupons.csv',
    category: 'personal_coupons',
    emailGuard: true,
    // Perks / Personal coupons. Three stamps, a status enumeration and the coupon code, which rule (e) admits in THIS file and the bonus-code file only (stored in clear, masked on screen, D-13); `PREREQUISITE` is free text up to about 10k characters, excluded by rule (g).
    columns: [
      { header: 'INSERTED_AT', id: 'INSERTED_AT', kind: 'date' },
      { header: 'UPDATED_AT', id: 'UPDATED_AT', kind: 'date' },
      { header: 'EXPIRED_AT', id: 'EXPIRED_AT', kind: 'date' },
      { header: 'STATUS', id: 'STATUS', kind: 'text' },
      { header: 'CODE', id: 'CODE', kind: 'code' },
    ],
  },
  {
    key: 'bonus_code_usage.csv',
    category: 'bonus_codes',
    emailGuard: true,
    // Perks / Bonus codes. The stamp, the bonus code (rule e) and the IP the user redeemed it from (rule d admits an address in this file, the Bans file and the third-party file only, masked on screen, D-14).
    columns: [
      { header: 'CREATED_AT', id: 'CREATED_AT', kind: 'date' },
      { header: 'CODE_KEY', id: 'CODE_KEY', kind: 'code' },
      { header: 'USER_IP', id: 'USER_IP', kind: 'address' },
    ],
  },
];
