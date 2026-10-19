import { zipSync } from './pinned-zip.ts';
import {
  CURRENCY_2K_SPEC,
  CURRENCY_500_SPEC,
  CURRENCY_54K_SPEC,
  CURRENCY_HAND_CSV,
  CURRENCY_OPS_HEADER,
  ORDERS_HAND_CSV,
  PREMIUM_HAND_CSV,
  generateCurrencyOpsCsv,
  renderQuoteAllCsv,
} from './finance-fixtures.ts';
import { DEVICE_INFO_SAMPLE_FILES, DEVICE_PC_HEADER } from './device-info-fixtures.ts';
import {
  PLAYER_STATS_SAMPLE_FILES,
  WOT_MAIN_HEADER,
  generateVehicleMainCsv,
  renderStatsCsv,
} from './player-stats-fixtures.ts';
import { mulberry32 } from './sessions-fixtures.ts';
import { buildRealShapeCsv, type RealShapeRow } from './playtime-real-shape-fixture.ts';
import {
  NEW_DATA_FIXTURE_FILES,
  NG_HEAT_PANE_KEYS,
  NG_WOWP_KEYS,
  NG_WOWS_PANE_KEYS,
  buildLargeTableCsv,
  withCanaries,
  NG_HEAT_DRIFTED,
  NG_HEAT_HEADER_ONLY,
  NG_HEAT_SESSIONS_A,
  NG_HEAT_SESSIONS_B,
  NG_ROOT_A,
  NG_ROOT_B,
  NG_UNLISTED_BODY,
  NG_WOT_SESSIONS_A,
  NG_WOT_SESSIONS_B,
  NG_WOTC_SESSIONS_A,
} from './new-data-fixtures.ts';

/**
 * Synthetic MULTI-ACCOUNT export fixtures (Phase 9, plan 09-01).
 *
 * ## What this module is for
 *
 * Phase 9 replaces the classifier's single-account-root assumption with an
 * N-root resolver. Every later plan in the phase (09-02 worker, 09-03 cache,
 * 09-04 readers, 09-05 header, 09-06 lifecycle) needs archives with ONE, TWO
 * and THREE account roots, so this module owns that fixture set once instead of
 * every plan transcribing its own. The builder here is the one the plan's
 * tracer test drives from zip bytes to a per-file owner.
 *
 * ## Every value is fabricated
 *
 * fixture=synthetic (see `tests/fixtures/README.md`). No real Wargaming
 * account number, nickname, e-mail address or IP address appears here or in
 * any archive this module builds:
 *   - account folders are made-up numeric ids (`2000002`, `500000001`, ...);
 *   - every e-mail uses an RFC 2606 reserved domain under `.example.invalid`;
 *   - IP addresses are RFC 5737 documentation ranges (`192.0.2.0/24` TEST-NET-1
 *     and `198.51.100.0/24` TEST-NET-2).
 *
 * ## Per-root canaries, not shared ones (RESEARCH Pitfall 7)
 *
 * Each root carries its OWN login, birth date and overflow cell. A shared
 * canary would prove only that ONE root was stripped: a leak from a second
 * root would look identical to a leak from the first. `MA_CANARIES` is the
 * single map a privacy test walks, so adding a root forces a new canary.
 *
 * ## The module import rule (leaf-module rule, `tests/fixtures/README.md`)
 *
 * This module imports the shared `zipSync` and the four data modules, and
 * imports NOTHING from `export-fixtures.ts` — it is itself a data module, so
 * reaching back into the shared-sample builder would close the cycle that rule
 * exists to prevent.
 */

// -----------------------------------------------------------------------------
// Account roots
// -----------------------------------------------------------------------------

/** The old RU account: no User_Info, no Financial_Data (the real sample's). */
export const MA_ROOT_RU = '2000002';

/** The EU account: every category, created first (2018). */
export const MA_ROOT_EU = '500000001';

/** The NA Blitz account: WOTB data plus one WOT row, created last (2021). */
export const MA_ROOT_NA = '1000000003';

/**
 * D-16 order: first activity year ascending, so the list reads as a
 * migration timeline. RU (2012), then EU (2018), then NA (2021).
 */
export const MA_ROOTS_D16_ORDER: readonly string[] = [MA_ROOT_RU, MA_ROOT_EU, MA_ROOT_NA];

/**
 * Code-unit (plain `<`) order of the three root names: `1000000003` <
 * `2000002` < `500000001`, so NA, RU, EU.
 *
 * This is deliberately a DIFFERENT order from {@link MA_ROOTS_D16_ORDER} and
 * from numeric order, so a test that sorts roots the wrong way cannot pass by
 * accident. `analyzeExport` lists roots in code-unit order; the worker applies
 * D-16 order later (plan 09-02), because years exist only after parsing.
 */
export const MA_ROOTS_CODE_UNIT_ORDER: readonly string[] = [MA_ROOT_NA, MA_ROOT_RU, MA_ROOT_EU];

export const MA_NICKNAME_EU = 'Synthetic EU Captain';
export const MA_NICKNAME_NA = 'Synthetic NA Commander';
export const MA_REGION_EU = 'EU';
export const MA_REGION_NA = 'NA';

/**
 * The EU account is the EARLIEST created, which is what plan 09-05's Overview
 * test expects as its headline creation date on a multi-account dataset.
 */
export const MA_CREATED_EU = '2018-02-14 18:00:00';
export const MA_CREATED_NA = '2021-05-10 15:00:00';

/**
 * A 40-character nickname for the long-text shape. Exactly 40 — the identity
 * header's own bound (`MAX_ACCOUNT_TEXT_LENGTH`) is longer than this, so the
 * fixture is "long enough to be interesting", not "at the bound".
 */
export const MA_LONG_NICKNAME = 'Synthetic Long Nickname For EU Account!!';

/** A 20-digit account folder name, longer than any real Wargaming id. */
export const MA_LONG_ROOT = '12345678901234567890';

/** The real sample's two loose top-level PDFs, which D-05 says to ignore. */
export const MA_README_FILES: readonly string[] = ['Readme_en.pdf', 'Readme_ru.pdf'];

/**
 * The root that holds an archive entry and nothing the import stores
 * (plan 09-10, the UI audit's count semantics).
 *
 * A real entry: it is a folder in the zip with a CSV under it, so the
 * classifier accepts it as an account root exactly as it accepts any other.
 * A data-less root: every folder it holds is `known-deferred`, so its rows are
 * counted and never stored (D-18 / D-21) and it carries no `User_Info` row.
 */
export const MA_ROOT_DATALESS = '700000004';

/**
 * How many accounts {@link buildDataLessAccountExport} PUBLISHES: the two roots
 * that hold data, and NOT {@link MA_ROOT_DATALESS}.
 */
export const MA_DATALESS_PUBLISHED_COUNT = 2;

/** The published roots, in D-16 order (EU 2018, NA 2021, then no activity). */
export const MA_DATALESS_PUBLISHED_ROOTS: readonly string[] = [MA_ROOT_EU, MA_ROOT_NA];

/** One root's privacy canaries. Every field is distinct from every other. */
export interface AccountCanary {
  /** The `LOGIN` cell. RFC 2606 reserved domain, never a real address. */
  login: string;
  /** The domain part of {@link login}, asserted absent on its own. */
  loginDomain: string;
  /** The `BIRTH_DATE` cell. */
  birthDate: string;
  /** The extra 14th cell, which no header declares. */
  overflow: string;
}

/**
 * Per-root canaries. RU's live in a User_Info-SHAPED file MISFILED under its
 * `Activity_History` folder, because the real sample's RU account has no
 * User_Info folder at all — so the root without one still exercises the
 * header-keyed strip rather than skipping it.
 */
export const MA_CANARIES: Readonly<Record<string, AccountCanary>> = {
  [MA_ROOT_RU]: {
    login: 'canary-ru.player@canary-ru.example.invalid',
    loginDomain: 'canary-ru.example.invalid',
    birthDate: '1988-11-03',
    overflow: 'CANARY-OVERFLOW-RU-4f21',
  },
  [MA_ROOT_EU]: {
    login: 'canary-eu.player@canary-eu.example.invalid',
    loginDomain: 'canary-eu.example.invalid',
    birthDate: '1994-06-17',
    overflow: 'CANARY-OVERFLOW-EU-8c07',
  },
  [MA_ROOT_NA]: {
    login: 'canary-na.player@canary-na.example.invalid',
    loginDomain: 'canary-na.example.invalid',
    birthDate: '1999-01-09',
    overflow: 'CANARY-OVERFLOW-NA-2b93',
  },
};

/**
 * The `EMAIL` cell of the unsupported `Game_Forums` file. Phase 9's D-18
 * decision parses unknown / known-deferred rows for counts only, and this
 * literal is what a later plan asserts never reaches storage.
 */
export const MA_FORUM_EMAIL_CANARY = 'forum-user@canary-eu.example.invalid';

/** The `IP_ADDRESS` cell of the same file. TEST-NET-2 (RFC 5737). */
export const MA_FORUM_IP_CANARY = '198.51.100.42';

/** A chat message body in the known-deferred `Chat_History` category. */
export const MA_CHAT_CANARY = 'CANARY-CHAT-MESSAGE-EU-6d41';

// -----------------------------------------------------------------------------
// Hand-derived answer keys
// -----------------------------------------------------------------------------

/**
 * The game tokens of each root's `*_Game_Sessions.csv` files that hold AT LEAST
 * ONE ROW (D-14), code-unit ascending.
 *
 * Hand-derived from the session rows below, file by file:
 *   RU — WOT (2 rows), WOTB (1), WOTC (1), WOWS (1)  →  WOT, WOTB, WOTC, WOWS
 *   EU — WOT (2 rows), WOTB (1), HEAT (2)            →  HEAT, WOT, WOTB
 *   NA — WOTB (2 rows), WOT (1), WOWS (HEADER ONLY)  →  WOT, WOTB
 *
 * NA's header-only WOWS file is the point of that third line: it proves the
 * games list counts files WITH ROWS, not files. `Game_Active_Sessions.csv`
 * names no game and is never a game source (D-14).
 */
export const MA_EXPECTED_GAMES: Readonly<Record<string, readonly string[]>> = {
  [MA_ROOT_RU]: ['WOT', 'WOTB', 'WOTC', 'WOWS'],
  [MA_ROOT_EU]: ['HEAT', 'WOT', 'WOTB'],
  [MA_ROOT_NA]: ['WOT', 'WOTB'],
};

/**
 * First-to-last activity year per root (D-15), from the same session rows:
 *   RU — 2012-06-01 (WOT) … 2021-11-11 (WOWS)  →  [2012, 2021]
 *   EU — 2018-02-14 (WOT) … 2026-06-05 (WOT)  →  [2018, 2026]
 *   NA — 2021-05-09 (WOTB) … 2026-07-12 (WOTB) →  [2021, 2026]
 *
 * EU's `Game_Active_Sessions.csv` row is dated 2009 and MUST NOT appear here:
 * that file names no game and is not a session source, so it cannot move the
 * years. NA's 2023 WOT row falls inside its own range, so it is invisible to
 * the answer key while still proving the alias-header row parses.
 */
export const MA_EXPECTED_YEARS: Readonly<Record<string, readonly [number, number]>> = {
  [MA_ROOT_RU]: [2012, 2021],
  [MA_ROOT_EU]: [2018, 2026],
  [MA_ROOT_NA]: [2021, 2026],
};

/**
 * Every USABLE game-session row across the three roots: 13.
 *
 * Derived by hand from the row lists below, file by file — RU 2+1+1+1 = 5,
 * EU 2+1+2 = 5, NA 2+1 = 3, so 5 + 5 + 3 = 13. Three files contribute nothing
 * and are NOT counted here: NA's header-only `WOWS_Game_Sessions.csv`,
 * EU's `Game_Active_Sessions.csv` (no game token), and the Player_statistics
 * files, which are statistics rather than sessions.
 */
export const MA_EXPECTED_SESSION_COUNT = 13;

/**
 * The merged playtime figures for the three-account archive, hand-derived from
 * the same session rows, as LITERALS (D-06, ACCOUNT-06).
 *
 * Nothing here is read back off the worker: each number is the arithmetic of the
 * rows above, written out so a change in the aggregator's behaviour cannot move
 * the expectation. Sessions are counted as ROWS and active days as distinct
 * start days (D-07 as amended); only hours take the union of intervals, and on
 * this archive no row overlaps another, so the union is the plain sum.
 *
 * Per game, from the rows:
 *   WOT   RU 5400 + 4500, EU 3600 + 5400, NA 3600  =  22,500 s / 5 rows / 5 days
 *   WOTB  RU 3600,             EU 3600,   NA 3600 x2 =  14,400 s / 4 rows / 4 days
 *   WOWS  RU 4500  (NA's file is header-only, so it contributes nothing) = 4,500 / 1 / 1
 *   HEAT  EU 3600 x2           (no chip: counted under All only, D-05) = 7,200 / 2 / 2
 *   WOTC  RU 3600              (same)                                = 3,600 / 1 / 1
 *   ALL   22,500 + 14,400 + 4,500 + 7,200 + 3,600 = 52,200 s / 13 rows / 13 days
 *
 * `games` is the token list the chip row is built from, and the sum of the four
 * filterable entries is EQUAL to All here — which is the whole point of typing
 * it out: the e2e asserts the numbers, and the "All can be smaller than the sum"
 * rule only becomes visible on an archive WITH overlap (the two-account overlap
 * fixture's literals, below).
 */
export const MA_EXPECTED_PLAYTIME = {
  /** The all-games answer: every account's rows merged. */
  all: { seconds: 52_200, sessions: 13, days: 13 },
  /** Per token, in `GAME_FILTER_TOKENS` order plus the two non-filterable ones. */
  byGame: {
    WOT: { seconds: 22_500, sessions: 5, days: 5 },
    WOTB: { seconds: 14_400, sessions: 4, days: 4 },
    WOWS: { seconds: 4_500, sessions: 1, days: 1 },
    HEAT: { seconds: 7_200, sessions: 2, days: 2 },
    WOTC: { seconds: 3_600, sessions: 1, days: 1 },
  },
  /** Every token with at least one usable row, ascending — the chip list's input. */
  games: ['HEAT', 'WOT', 'WOTB', 'WOTC', 'WOWS'],
} as const;

// -----------------------------------------------------------------------------
// Folder names, spelled the way the real archive spells them
// -----------------------------------------------------------------------------

const F_ACTIVITY = 'Activity_History';
const F_PLAYER = 'Player_Statistics';
const F_FINANCIAL = 'Financial_Data';
const F_PAYMENT = 'Payment_History';
const F_DEVICE = 'Device_Info';
const F_USER_INFO = 'User_Info';
const F_CHAT = 'Chat_History';
const F_FORUMS = 'Game_Forums';
const F_BANS = 'Bans';
const F_SUBSCRIPTIONS = 'Subscriptions';
const F_BONUS = 'Bonus_Codes';

/** Wargaming's own export-wrapper folder: transparent (D-03). */
const MA_WRAPPER = 'personal_data_export';

// -----------------------------------------------------------------------------
// CSV bodies (all synthetic)
// -----------------------------------------------------------------------------

const CRLF = '\r\n';

const ACCOUNT_INFO_HEADER =
  'ID;NAME;CREATED_AT;ACTIVATED_AT;IP;COUNTRY_CODE;REGION;CITY;LOGIN;USER_LANGUAGE;USER_STATED_COUNTRY;BIRTH_DATE;BIRTH_DATE_SRC';

const FORUM_HEADER =
  'NAME;BDAY_DAY;BDAY_MONTH;BDAY_YEAR;LAST_VISIT;JOINED;POSTS;LAST_POST;EMAIL;IP_ADDRESS';
const FORUM_ROW = [
  MA_NICKNAME_EU,
  '17',
  '6',
  '1994',
  '04.03.2024 21:10',
  '14.02.2018 18:05',
  '128',
  '04.03.2024 21:10',
  MA_FORUM_EMAIL_CANARY,
  MA_FORUM_IP_CANARY,
].join(';');

const CHAT_HEADER = 'MESSAGE_DT;CHANNEL_ID;MESSAGE_BODY';
const CHAT_ROW = `04.03.2024 21:11;1;${MA_CHAT_CANARY}`;

const GAME_ACTIVE_HEADER = 'GAME_NAME;CREATED_AT;UPDATED_AT;STATE;IP';
const GAME_ACTIVE_ROW = 'Blitz;15.01.2009 10:00;15.01.2009 11:00;ACTIVE;192.0.2.55';

const BANS_HEADER = 'BAN_DT;BAN_REASON;BAN_EXPIRES_AT';
const BANS_ROW = '02.05.2020 12:00;synthetic_reason;09.05.2020 12:00';

const SUBSCRIPTIONS_HEADER = 'START_DT;END_DT;SUBSCRIPTION_TYPE';
const SUBSCRIPTIONS_ROW = '14.02.2018 18:10;;premium';

const BONUS_HEADER = 'BONUS_ID;BONUS_NAME;CREATED_AT';
const BONUS_ROW = 'bonus-0001;Synthetic bonus;20.02.2018 12:00';

/**
 * The synthetic ALIAS session header the NA root's single WOT row uses:
 * `SESSION_START;SESSION_END;IP` with an ISO stamp. The real export writes
 * three uppercase columns, so a fixture that only ever used the real header
 * would not show that a legacy-shaped session file still parses.
 */
const ALIAS_SESSION_HEADER = 'SESSION_START;SESSION_END;IP';
const ALIAS_SESSION_ROW = '2023-04-02 15:00:00;2023-04-02 16:00:00;192.0.2.66';

// -----------------------------------------------------------------------------
// Session rows, per root
// -----------------------------------------------------------------------------

interface SessionFileSpec {
  /** The real file name, e.g. `WOTB_Game_Sessions.csv`. */
  name: string;
  /** The rows to write; absent or empty means a HEADER-ONLY file. */
  rows?: readonly RealShapeRow[];
  /** Render the alias header + ISO row instead of the real one. */
  alias?: boolean;
}

const RU_SESSIONS: readonly SessionFileSpec[] = [
  {
    name: 'WOT_Game_Sessions.csv',
    rows: [
      ['01.06.2012 19:00', '01.06.2012 20:30'],
      ['07.09.2021 18:00', '07.09.2021 19:15'],
    ],
  },
  { name: 'WOTB_Game_Sessions.csv', rows: [['12.12.2015 20:00', '12.12.2015 21:00']] },
  { name: 'WOTC_Game_Sessions.csv', rows: [['03.03.2018 17:00', '03.03.2018 18:00']] },
  { name: 'WOWS_Game_Sessions.csv', rows: [['11.11.2021 19:30', '11.11.2021 20:45']] },
];

const EU_SESSIONS: readonly SessionFileSpec[] = [
  {
    name: 'WOT_Game_Sessions.csv',
    rows: [
      ['14.02.2018 21:00', '14.02.2018 22:00'],
      ['05.06.2026 20:00', '05.06.2026 21:30'],
    ],
  },
  { name: 'WOTB_Game_Sessions.csv', rows: [['23.07.2020 18:30', '23.07.2020 19:30']] },
  {
    name: 'HEAT_Game_Sessions.csv',
    rows: [
      ['18.06.2019 17:00', '18.06.2019 18:00'],
      ['19.06.2019 17:00', '19.06.2019 18:00'],
    ],
  },
];

const NA_SESSIONS: readonly SessionFileSpec[] = [
  {
    name: 'WOTB_Game_Sessions.csv',
    rows: [
      ['09.05.2021 19:00', '09.05.2021 20:00'],
      ['12.07.2026 19:00', '12.07.2026 20:00'],
    ],
  },
  {
    name: 'WOT_Game_Sessions.csv',
    rows: [['2023-04-02 15:00:00', '2023-04-02 16:00:00']],
    alias: true,
  },
  // Header-only on purpose: a game file the account never played.
  { name: 'WOWS_Game_Sessions.csv', rows: [] },
];

/** The statistics files EVERY root carries, so repeated file names exist. */
const SHARED_PLAYER_STATS: readonly string[] = [
  'WOTB_Vehicle_Statistics.csv',
  'WOTB_Vehicle_Statistics_by_Type.csv',
  'WOTB_Account_Statistics.csv',
];

/** EU and NA also carry the battle-type file, as the real sample does. */
const BATTLE_TYPES_STATS = 'WOTB_Battle_Types_Statistics.csv';

// -----------------------------------------------------------------------------
// The per-root entry generator
// -----------------------------------------------------------------------------

/** Everything one account root contributes to an archive. */
export interface RootSpec {
  /** The account folder name, as written. */
  root: string;
  /** Write a `User_Info/Account_Info.csv` carrying this root's own canaries. */
  identity?: boolean;
  /** Override the `NAME` cell (the duplicate-nickname shape). */
  nickname?: string;
  /** Override this root's canaries (the small synthetic roots). */
  canary?: AccountCanary;
  /** Override the folder that holds it (`user_info` in the case-variant shape). */
  userInfoFolder?: string;
  /** Write the same file MISFILED under `Activity_History` instead. */
  misfiledIdentity?: boolean;
  /** The `*_Game_Sessions.csv` files this root carries. */
  sessions?: readonly SessionFileSpec[];
  /** Write `Activity_History/Game_Active_Sessions.csv` (names no game). */
  activeSessions?: boolean;
  /** Extra `Player_Statistics` file names on top of {@link SHARED_PLAYER_STATS}. */
  playerStats?: readonly string[];
  /**
   * Write NONE of {@link SHARED_PLAYER_STATS} (plan 09-10).
   *
   * Every root carries those three files by default, so without this opt-out no
   * root can be genuinely data-less — one of the shared files is a supported
   * category, so its rows are stored and the root holds data by definition. An
   * opt-out in the EXISTING generator is a smaller claim than a second
   * file-writing path, and it keeps "this root stored nothing" a property of the
   * archive rather than of the importer.
   */
  noSharedPlayerStats?: boolean;
  /** Write the two Financial_Data operations files. */
  financial?: boolean;
  /** Write the twelve-column Orders file. */
  payment?: boolean;
  /** Write the three Device_Info files. */
  deviceInfo?: boolean;
  /**
   * Extra files this root carries, keyed `Folder/File.csv`, written AFTER the
   * blocks above so one of them REPLACES the standard body of the same name.
   *
   * This is what a divergent-header account needs: every root in the phase's
   * other builders shares one body per file name, so the only way to give two
   * accounts the same FILE NAME with different HEADERS is to write the file
   * per root.
   */
  files?: Readonly<Record<string, string>>;
  /** Write one synthetic CSV in each of these unsupported folders. */
  unsupported?: readonly string[];
  /** Emit a directory entry (`<root>/` and `<root>/<folder>/`) per folder. */
  directoryEntries?: boolean;
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * The canaries a small synthetic root (one the three real-shape roots do not
 * cover) carries. Derived from the root name, so two such roots never share a
 * value and the file stays free of anything that could be mistaken for a real
 * account (RESEARCH Pitfall 7).
 */
function canaryFor(spec: RootSpec): AccountCanary {
  return (
    spec.canary ??
    MA_CANARIES[spec.root] ?? {
      login: `synthetic.${spec.root}@canary-${spec.root}.example.invalid`,
      loginDomain: `canary-${spec.root}.example.invalid`,
      birthDate: '1980-01-01',
      overflow: `CANARY-OVERFLOW-${spec.root}`,
    }
  );
}

/** The 13-column Account_Info file, with this root's own cells and a ragged 14th. */
function accountInfoCsv(spec: RootSpec): string {
  const canary = canaryFor(spec);
  const row = [
    spec.root, // ID
    spec.nickname ?? (spec.root === MA_ROOT_NA ? MA_NICKNAME_NA : MA_NICKNAME_EU), // NAME
    spec.root === MA_ROOT_NA ? MA_CREATED_NA : MA_CREATED_EU, // CREATED_AT
    '2018-03-01 00:00:00', // ACTIVATED_AT
    spec.root === MA_ROOT_RU
      ? '192.0.2.101'
      : spec.root === MA_ROOT_EU
        ? '192.0.2.102'
        : '192.0.2.103', // IP
    'US', // COUNTRY_CODE
    spec.root === MA_ROOT_NA ? MA_REGION_NA : MA_REGION_EU, // REGION
    'Testville', // CITY
    canary.login, // LOGIN — stripped before write (D-18 / D-19)
    'en', // USER_LANGUAGE
    'US', // USER_STATED_COUNTRY
    canary.birthDate, // BIRTH_DATE — stripped before write
    'self', // BIRTH_DATE_SRC — stripped before write
    canary.overflow, // the extra cell no header declares
  ].join(';');
  return CRLF + ACCOUNT_INFO_HEADER + CRLF + row + CRLF;
}

function sessionCsv(file: SessionFileSpec): string {
  if (file.alias === true) return ALIAS_SESSION_HEADER + CRLF + ALIAS_SESSION_ROW + CRLF;
  return buildRealShapeCsv(file.rows ?? []);
}

/** The unsupported folders' one-file bodies, by folder name. */
const UNSUPPORTED_BODY: Readonly<Record<string, string>> = {
  [F_BANS]: CRLF + BANS_HEADER + CRLF + BANS_ROW + CRLF,
  [F_SUBSCRIPTIONS]: CRLF + SUBSCRIPTIONS_HEADER + CRLF + SUBSCRIPTIONS_ROW + CRLF,
  [F_BONUS]: CRLF + BONUS_HEADER + CRLF + BONUS_ROW + CRLF,
  [F_CHAT]: CRLF + CHAT_HEADER + CRLF + CHAT_ROW + CRLF,
  [F_FORUMS]: CRLF + FORUM_HEADER + CRLF + FORUM_ROW + CRLF,
};

/**
 * Render one account root's entries, keyed by full archive path.
 *
 * `prefix` is `''` for a root at the zip top level and
 * `${MA_WRAPPER}/` for the wrapped shapes (D-03); the root's own name is
 * always the next segment.
 */
function rootEntries(spec: RootSpec, prefix: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  const base = `${prefix}${spec.root}`;
  const add = (folder: string, name: string, text: string): void => {
    out[`${base}/${folder}/${name}`] = encode(text);
  };

  for (const file of spec.sessions ?? []) add(F_ACTIVITY, file.name, sessionCsv(file));
  if (spec.activeSessions === true) {
    add(
      F_ACTIVITY,
      'Game_Active_Sessions.csv',
      CRLF + GAME_ACTIVE_HEADER + CRLF + GAME_ACTIVE_ROW + CRLF,
    );
  }
  if (spec.misfiledIdentity === true) add(F_ACTIVITY, 'Account_Info.csv', accountInfoCsv(spec));

  for (const name of [
    ...(spec.noSharedPlayerStats === true ? [] : SHARED_PLAYER_STATS),
    ...(spec.playerStats ?? []),
  ]) {
    const csv = PLAYER_STATS_SAMPLE_FILES[name];
    if (csv === undefined) throw new Error(`unknown Player_statistics fixture file ${name}`);
    add(F_PLAYER, name, csv);
  }

  if (spec.financial === true) {
    add(F_FINANCIAL, 'Operations_with_Premium_Days.csv', PREMIUM_HAND_CSV);
    add(F_FINANCIAL, 'Virtual_Currencies_Operations.csv', CURRENCY_HAND_CSV);
  }
  if (spec.payment === true) add(F_PAYMENT, 'Orders.csv', ORDERS_HAND_CSV);

  if (spec.deviceInfo === true) {
    for (const [relative, csv] of Object.entries(DEVICE_INFO_SAMPLE_FILES)) {
      // The data module keys its files with the `Device_info/` spelling; the
      // real archive spells the folder `Device_Info`, and this fixture keeps
      // the real spelling.
      add(F_DEVICE, relative.slice(relative.indexOf('/') + 1), csv);
    }
  }

  // Written AFTER every block above, so an entry naming a file one of those
  // blocks already wrote REPLACES that body. That is what lets two roots carry
  // the same file NAME with different HEADERS: the blocks above give every root
  // one shared body, and this is the per-root override.
  for (const [path, text] of Object.entries(spec.files ?? {})) {
    const slash = path.indexOf('/');
    add(path.slice(0, slash), path.slice(slash + 1), text);
  }

  if (spec.identity === true)
    add(spec.userInfoFolder ?? F_USER_INFO, 'Account_Info.csv', accountInfoCsv(spec));

  for (const folder of spec.unsupported ?? []) {
    const body = UNSUPPORTED_BODY[folder];
    if (body === undefined) throw new Error(`no unsupported body declared for ${folder}`);
    const name = folder === F_FORUMS ? 'WOT_Forum_User_Info.csv' : `${folder}.csv`;
    add(folder, name, body);
  }

  if (spec.directoryEntries === true) {
    const empty = new Uint8Array(0);
    out[`${base}/`] = empty;
    for (const folder of foldersOf(out, base)) out[`${base}/${folder}/`] = empty;
  }

  return out;
}

/** The distinct folder names one root's entries sit in, in first-seen order. */
function foldersOf(entries: Record<string, Uint8Array>, base: string): string[] {
  const seen = new Set<string>();
  for (const path of Object.keys(entries)) {
    const rest = path.slice(`${base}/`.length);
    const slash = rest.indexOf('/');
    if (slash > 0) seen.add(rest.slice(0, slash));
  }
  return [...seen];
}

/** Merge per-root entry maps into one archive, with optional loose files. */
function assemble(
  specs: readonly RootSpec[],
  options: { prefix?: string; loose?: Record<string, string>; reverse?: boolean } = {},
): Uint8Array {
  const prefix = options.prefix ?? '';
  const merged: Record<string, Uint8Array> = {};
  for (const spec of specs) Object.assign(merged, rootEntries(spec, prefix));
  for (const [name, text] of Object.entries(options.loose ?? {})) {
    merged[name] = encode(text);
  }
  if (options.reverse !== true) return zipSync(merged);
  // The same entries, inserted in reverse: classification must not depend on
  // the order the zip happens to store them in.
  const reversed: Record<string, Uint8Array> = {};
  for (const name of Object.keys(merged).reverse()) reversed[name] = merged[name];
  return zipSync(reversed);
}

// -----------------------------------------------------------------------------
// The three named roots
// -----------------------------------------------------------------------------

const RU_ROOT: RootSpec = {
  root: MA_ROOT_RU,
  // No `identity`: the real sample's RU account has no User_Info folder.
  misfiledIdentity: true,
  sessions: RU_SESSIONS,
  deviceInfo: true,
  unsupported: [F_BONUS],
  directoryEntries: true,
};

const EU_ROOT: RootSpec = {
  root: MA_ROOT_EU,
  identity: true,
  sessions: EU_SESSIONS,
  activeSessions: true,
  playerStats: [BATTLE_TYPES_STATS],
  financial: true,
  payment: true,
  deviceInfo: true,
  unsupported: [F_BANS, F_SUBSCRIPTIONS, F_FORUMS, F_CHAT],
  directoryEntries: true,
};

const NA_ROOT: RootSpec = {
  root: MA_ROOT_NA,
  identity: true,
  sessions: NA_SESSIONS,
  playerStats: [BATTLE_TYPES_STATS],
  payment: true,
  deviceInfo: true,
  unsupported: [F_CHAT],
  directoryEntries: true,
};

// -----------------------------------------------------------------------------
/**
 * A root whose folders are all `known-deferred`: a real archive entry that
 * yields no stored row and no `User_Info` row.
 *
 * Built from the same {@link RootSpec} generator as every other root rather than
 * from a new file-writing path, so "this root stored nothing" is a fact about
 * the D-18 skip rather than a shape hand-built to be missing.
 */
const DATA_LESS_ROOT: RootSpec = {
  root: MA_ROOT_DATALESS,
  noSharedPlayerStats: true,
  unsupported: [F_FORUMS, F_CHAT],
  directoryEntries: true,
};

// Builders — one, two and three roots at the top level
// -----------------------------------------------------------------------------

/**
 * The real sample's shape, as a synthetic copy: three account folders directly
 * at the zip top level with NO `personal_data_export/` wrapper, beside two
 * loose `Readme_*.pdf` files (D-05), each with its directory entries.
 *
 * This is the shape the user's own `2026-10-14.zip` has and that v1.0 rejected
 * as `no-single-root`.
 *
 * `reversed: true` inserts the entries in reverse order. The two archives hold
 * the same entries, so classification must be identical (ACCOUNT-08).
 */
export function buildRealShapeThreeAccountExport(options: { reversed?: boolean } = {}): Uint8Array {
  const loose: Record<string, string> = {};
  for (const name of MA_README_FILES) loose[name] = '%PDF-1.4\nsynthetic readme\n%%EOF\n';
  return assemble([RU_ROOT, EU_ROOT, NA_ROOT], { loose, reverse: options.reversed === true });
}

/** Two roots at the top level, repeating the same file names in both. */
export function buildTwoAccountExport(): Uint8Array {
  return assemble([EU_ROOT, NA_ROOT]);
}

/**
 * ONE root: the agreement twin for `resolveCsvFileCategory`. Everything the
 * multi-root path does must reduce to the single-root answer here.
 */
export function buildOneAccountExport(): Uint8Array {
  return assemble([EU_ROOT]);
}

/** Two roots under Wargaming's own transparent wrapper (D-03). */
export function buildWrappedTwoAccountExport(): Uint8Array {
  return assemble([EU_ROOT, NA_ROOT], { prefix: `${MA_WRAPPER}/` });
}

/**
 * THREE roots, the third of which holds no data (plan 09-10).
 *
 * The shape the UI audit's first finding is about: the archive contains three
 * account folders, and only two of them hold anything the dashboard can show.
 * Under `accountCountSemantics: option-a` the import publishes TWO accounts, so
 * the header's count, the list's length and every pane caption read 2.
 */
export function buildDataLessAccountExport(): Uint8Array {
  return assemble([EU_ROOT, NA_ROOT, DATA_LESS_ROOT]);
}

/**
 * TWO roots, ONE of which holds data — the Account record gate's case (T-09-32).
 *
 * A published list of exactly one account is what the gate must NOT read: one
 * account's address row standing in for a dataset of two roots is T-09-13's
 * defect. The gate therefore counts ROOTS, not the published list.
 */
export function buildOneDataLessOfTwoExport(): Uint8Array {
  return assemble([EU_ROOT, DATA_LESS_ROOT]);
}

/**
 * The same wrapped two roots plus a loose file DIRECTLY under the wrapper.
 *
 * This is the flagged assumption of plan 09-01: a loose file beside the roots
 * is ignored the way a loose top-level file is (D-05). v1.0 already ignored
 * such a file for one root, because folder counting skips files that sit
 * directly under a prefix.
 */
export function buildWrappedTwoAccountWithLooseFileExport(): Uint8Array {
  return assemble([EU_ROOT, NA_ROOT], {
    prefix: `${MA_WRAPPER}/`,
    loose: { [`${MA_WRAPPER}/Readme_en.pdf`]: '%PDF-1.4\nsynthetic readme\n%%EOF\n' },
  });
}

// -----------------------------------------------------------------------------
// Builders — the shapes that must FAIL CLOSED
// -----------------------------------------------------------------------------

/** What a stray-folder builder puts beside the roots. */
export interface StrayFolderOptions {
  /** Nest the stray CSV one folder deeper (`Misc/y/z.csv`). */
  nested?: boolean;
}

/**
 * A stray unknown FOLDER beside two roots (D-02). `Misc` holds no recognised
 * category, so it is not a root and the whole import must fail.
 */
export function buildStrayFolderExport(options: StrayFolderOptions = {}): Uint8Array {
  const path = options.nested === true ? 'Misc/y/z.csv' : 'Misc/x.csv';
  return assemble([EU_ROOT, NA_ROOT], { loose: { [path]: 'A;B\r\n1;2\r\n' } });
}

/**
 * A RECOGNISED category folder at the top level beside two roots (D-04). It
 * cannot be attributed to an account, and it is exactly the shape that could
 * let a `User_Info` file dodge the strip.
 */
export function buildTopLevelCategoryBesideRootsExport(): Uint8Array {
  return assemble([EU_ROOT, NA_ROOT], { loose: { [`${F_ACTIVITY}/a.csv`]: 'A;B\r\n1;2\r\n' } });
}

/**
 * Two roots whose `Account_Info` rows carry the SAME `NAME`. Only the ID
 * tells them apart, which is what the identity pick must use.
 */
export function buildDuplicateNicknameExport(): Uint8Array {
  const shared = 'Shared Synthetic Name';
  return assemble([
    { root: '100', identity: true, nickname: shared },
    { root: '200', identity: true, nickname: shared },
  ]);
}

/**
 * Two roots whose first activity year TIES, plus a third with no activity at
 * row — the ordering inputs plan 09-02's D-16 sort needs.
 */
export function buildTiedYearsExport(): Uint8Array {
  const tiedYear = [['01.03.2019 20:00', '01.03.2019 21:00']] as const;
  const a: RootSpec = {
    root: '300',
    identity: true,
    sessions: [{ name: 'WOT_Game_Sessions.csv', rows: tiedYear }],
  };
  const b: RootSpec = {
    root: '400',
    identity: true,
    sessions: [{ name: 'WOTB_Game_Sessions.csv', rows: tiedYear }],
  };
  const c: RootSpec = { root: '500', identity: true };
  return assemble([a, b, c]);
}

/**
 * One root with only a HEADER-ONLY session file and one with no session file
 * at all: the "no activity recorded" shape (D-15).
 */
export function buildNoActivityAccountsExport(): Uint8Array {
  const headerOnly: RootSpec = {
    root: '600',
    identity: true,
    sessions: [{ name: 'WOT_Game_Sessions.csv', rows: [] }],
  };
  const noSessions: RootSpec = { root: '700', identity: true, financial: true };
  return assemble([headerOnly, noSessions]);
}

/** Two roots whose names differ only in case (RESEARCH Pitfall 14, T-09-03). */
export function buildCaseCollisionRootsExport(): Uint8Array {
  const a: RootSpec = { root: 'abc', identity: true };
  const b: RootSpec = { root: 'ABC', identity: true };
  return assemble([a, b]);
}

/** What a many-roots builder generates. */
export interface ManyRootsOptions {
  /** Give each folder a recognised category (so it is a ROOT); default true. */
  recognised?: boolean;
  /** Add one real account root beside the generated folders. */
  withRoot?: boolean;
}

/**
 * `count` top-level folders, for the root-count cap and the cost guard.
 *
 * With `recognised: true` every folder is an account root, so the cap fires
 * (`too-many-roots`). With `recognised: false` every folder is a stray
 * unknown folder, so a `withRoot: true` build fails as a stray (D-02) — the
 * shape that must be rejected after ONE linear pass, not after candidates
 * times entries (T-09-02).
 */
export function buildManyRootsExport(count: number, options: ManyRootsOptions = {}): Uint8Array {
  const recognised = options.recognised !== false;
  const entries: Record<string, Uint8Array> = {};
  if (options.withRoot === true) {
    Object.assign(entries, rootEntries({ root: 'root-0', identity: true }, ''));
  }
  for (let i = 0; i < count; i++) {
    const folder = recognised ? F_ACTIVITY : 'Misc';
    entries[`account_${i}/${folder}/a.csv`] = encode('A;B\r\n1;2\r\n');
  }
  return zipSync(entries);
}

/** What a long-root-name builder generates. */
export interface LongRootNameOptions {
  /** Fold the roots under the transparent wrapper. */
  wrapped?: boolean;
}

/**
 * One root whose folder name is exactly `length` characters, so the
 * `MAX_ROOT_NAME_LENGTH` bound can be tested at and one past the limit
 * (D-20). The name is a letter `a` repeated, which no category claims.
 */
export function buildLongRootNameExport(
  length: number,
  options: LongRootNameOptions = {},
): Uint8Array {
  const name = 'a'.repeat(length);
  const prefix = options.wrapped === true ? `${MA_WRAPPER}/` : '';
  return assemble([{ root: name, identity: true }], { prefix });
}

/**
 * Roots named `__proto__` and `constructor` (T-09-04). Any per-root structure
 * keyed by root name must be a Map or a Set; a plain object would collide
 * with `Object.prototype`.
 */
export function buildHostileRootNamesExport(): Uint8Array {
  return assemble([
    { root: '__proto__', identity: true },
    { root: 'constructor', identity: true },
  ]);
}

/** `User_Info` in one root and `user_info` in the other (case-insensitive). */
export function buildCaseVariantUserInfoAcrossRootsExport(): Uint8Array {
  return assemble([
    { root: '800', identity: true, userInfoFolder: F_USER_INFO },
    { root: '900', identity: true, userInfoFolder: 'user_info' },
  ]);
}

// -----------------------------------------------------------------------------
// The divergent-header archive — CR-01's reproduction
// -----------------------------------------------------------------------------

/**
 * The root whose files are written with a RENAMED column, and the root whose
 * files carry the canonical header.
 *
 * The order matters and is the whole point of the fixture. `assemble` writes the
 * roots in the order the specs are given, and the import stores rows in that
 * order, so {@link MA_DIVERGENT_RENAMED_ROOT}'s row is the FIRST row of the
 * merged `wot_device_info.csv` bucket. Every reader that resolved columns from
 * that first row therefore resolved the RENAMED header and reported the other
 * account's values as absent — while its file was plainly in the archive.
 *
 * The names are ordered so the renamed root also sorts first in code-unit order,
 * so the fixture does not depend on which order the classifier happens to list
 * roots in.
 */
export const MA_DIVERGENT_RENAMED_ROOT = '1000000004';

/** The root whose same-named files carry the header this app reads. */
export const MA_DIVERGENT_CANONICAL_ROOT = '500000002';

/**
 * The three headers the renamed root writes, each the canonical one with ONE
 * column spelled differently — the kind of drift a real archive revision
 * carries, and each chosen so the defect and the fix are both OBSERVABLE:
 *
 *   - `OS` → `OPERATING_SYSTEM` (device) and `AMOUNT` → `AMOUNT_VALUE` (finance)
 *     name no column this app reads, so the renamed account's own cell is
 *     legitimately `null`/excluded. What the MERGED reader cost is the OTHER
 *     account's value with it: resolving off the renamed row made the canonical
 *     account's `OS` null and excluded both operations outright, so the shared
 *     currency answered `no-usable` while its file was plainly in the archive;
 *   - `BATTLES_COUNT` → `GAMES_PLAYED` (vehicles) IS an accepted spelling —
 *     Warplanes writes it — so per-group resolution recovers this account's own
 *     battle count, where the merged reader read every canonical row through
 *     this account's `GAMES_PLAYED` key and found nothing.
 *
 * The vehicle-name divergence that produces the empty-name shape is NOT here:
 * `VEHICLE_NAME` has one accepted spelling, so renaming it would make the
 * renamed account's own row blank under ANY resolution. That case is written
 * where it belongs — in `vehicle-stats.test.ts`, as a group whose header
 * declares no vehicle column at all.
 */
export const MA_DIVERGENT_PC_HEADER: readonly string[] = DEVICE_PC_HEADER.map((name) =>
  name === 'OS' ? 'OPERATING_SYSTEM' : name,
);
export const MA_DIVERGENT_VEHICLE_HEADER: readonly string[] = WOT_MAIN_HEADER.split(';').map(
  (name) => (name === 'BATTLES_COUNT' ? 'GAMES_PLAYED' : name),
);
export const MA_DIVERGENT_CURRENCY_HEADER: readonly string[] = CURRENCY_OPS_HEADER.map((name) =>
  name === 'AMOUNT' ? 'AMOUNT_VALUE' : name,
);

/** The renamed root's `OS` cell — under a header no column in the app names. */
export const MA_DIVERGENT_OS_RENAMED = 'SynthDivergentOS-Renamed';

/** The canonical root's `OS` cell, which the pane must show. */
export const MA_DIVERGENT_OS_CANONICAL = 'SynthDivergentOS-Canonical';

/** The renamed root's vehicle name, under a header the app does not read. */
export const MA_DIVERGENT_VEHICLE_RENAMED = 'germany:SynthDivergentTank-Renamed';

/** The canonical root's vehicle name, which the table must show. */
export const MA_DIVERGENT_VEHICLE_CANONICAL = 'usa:SynthDivergentTank-Canonical';

/** The renamed root's currency amount, in micro-units of the fixture's scale. */
export const MA_DIVERGENT_AMOUNT_RENAMED = '9000000';

/** The canonical root's currency amount, which the chart must total. */
export const MA_DIVERGENT_AMOUNT_CANONICAL = '4000000';

/** The currency code BOTH roots' operations carry, so the totals must combine. */
export const MA_DIVERGENT_CURRENCY_CODE = 'ru.wot.crystal';

/** The month both rows are dated in, so the two amounts land in one bucket. */
export const MA_DIVERGENT_CURRENCY_CREATED = '2019-03-05 10:00:00';

/** The `WOT_Device_Info.csv` file name both divergent roots write. */
const DIVERGENT_PC_FILE_NAME = 'WOT_Device_Info.csv';

/** The `WOT_Vehicle_Statistics.csv` file name both divergent roots write. */
const DIVERGENT_VEHICLE_FILE_NAME = 'WOT_Vehicle_Statistics.csv';

const DIVERGENT_DEVICE_FILE = `${F_DEVICE}/${DIVERGENT_PC_FILE_NAME}`;
const DIVERGENT_VEHICLE_FILE = `${F_PLAYER}/${DIVERGENT_VEHICLE_FILE_NAME}`;
const DIVERGENT_CURRENCY_FILE = `${F_FINANCIAL}/Virtual_Currencies_Operations.csv`;

/** The `OS` column's index, so the two hand rows line up with their headers. */
const PC_OS_INDEX = DEVICE_PC_HEADER.indexOf('OS');

/**
 * The two roots whose same-named files disagree on a column spelling.
 *
 * Every value is synthetic, and each root's cells are its OWN canaries, so a
 * pane that shows only one account's values — or shows the wrong account's —
 * fails on a value that exists in exactly one file.
 *
 * Only the three files the phase's merged channels read are written; a two-root
 * archive of nothing else would still classify as two accounts, and a smaller
 * archive is a smaller thing to read.
 */
export function buildDivergentHeaderTwoAccountExport(): Uint8Array {
  const renamed: RootSpec = {
    root: MA_DIVERGENT_RENAMED_ROOT,
    files: {
      [DIVERGENT_DEVICE_FILE]: renderQuoteAllCsv(MA_DIVERGENT_PC_HEADER, [
        withPcOs('SynthDivergentDesktop', MA_DIVERGENT_OS_RENAMED),
      ]),
      [DIVERGENT_VEHICLE_FILE]: renderStatsCsv(MA_DIVERGENT_VEHICLE_HEADER, [
        [
          MA_DIVERGENT_VEHICLE_RENAMED,
          '2021-09-30 18:00:00',
          '100',
          '55',
          '120000',
          '150',
          '90000',
        ],
      ]),
      [DIVERGENT_CURRENCY_FILE]: renderQuoteAllCsv(MA_DIVERGENT_CURRENCY_HEADER, [
        [
          MA_DIVERGENT_CURRENCY_CREATED,
          MA_DIVERGENT_CURRENCY_CODE,
          'Synthetic crystal',
          MA_DIVERGENT_AMOUNT_RENAMED,
          'deposit',
        ],
      ]),
    },
  };
  const canonical: RootSpec = {
    root: MA_DIVERGENT_CANONICAL_ROOT,
    files: {
      [DIVERGENT_DEVICE_FILE]: renderQuoteAllCsv(DEVICE_PC_HEADER, [
        withPcOs('SynthDivergentLaptop', MA_DIVERGENT_OS_CANONICAL),
      ]),
      [DIVERGENT_VEHICLE_FILE]: renderStatsCsv(WOT_MAIN_HEADER, [
        [
          MA_DIVERGENT_VEHICLE_CANONICAL,
          '2021-08-01 12:00:00',
          '100',
          '55',
          '120000',
          '150',
          '90000',
        ],
      ]),
      [DIVERGENT_CURRENCY_FILE]: renderQuoteAllCsv(CURRENCY_OPS_HEADER, [
        [
          MA_DIVERGENT_CURRENCY_CREATED,
          MA_DIVERGENT_CURRENCY_CODE,
          'Synthetic crystal',
          MA_DIVERGENT_AMOUNT_CANONICAL,
          'deposit',
        ],
      ]),
    },
  };
  return assemble([renamed, canonical]);
}

/** The ten PC cells, with the `OS` slot carrying `os` and the rest plausible. */
function withPcOs(pcType: string, os: string): readonly string[] {
  const row = [
    pcType,
    '64',
    'SynthCpuCo',
    'SynthCore 4000',
    '8',
    'SynthGpuCo',
    '4096',
    '3000',
    '0',
  ];
  row.splice(PC_OS_INDEX, 0, os);
  return row;
}

/**
 * The twenty-digit root carrying the forty-character nickname beside a normal
 * root — the long-text identity shape.
 *
 * `nickname` is explicit on the long root rather than left to the default: the
 * default is `MA_NICKNAME_EU`, so without it BOTH roots would carry the same
 * nickname and this fixture would carry no long text at all — `MA_LONG_NICKNAME`
 * would be an unused export and the shape its own name describes would be
 * absent. `classify.test.ts` reads only the root NAMES, so it passed either
 * way; the phone-width e2e step is what reads the nickname.
 */
export function buildLongTextAccountsExport(): Uint8Array {
  return assemble([
    { root: MA_LONG_ROOT, identity: true, nickname: MA_LONG_NICKNAME },
    { root: '1000000002', identity: true },
  ]);
}

// -----------------------------------------------------------------------------
// The cross-account OVERLAP export (10-01, D-06..D-08, D-21)
// -----------------------------------------------------------------------------

/**
 * The two synthetic account roots of the overlap fixture.
 *
 * `600000001` and `600000002` rather than an existing pair, because this fixture
 * is about MERGE arithmetic and nothing else: no `User_Info` shape, no repeated
 * file name with a differing header, no unsupported folder. The only thing the
 * two roots share is playtime, and they share it by overlapping.
 *
 * Both accounts' first activity year TIES on 2024, so the D-16 account
 * ordering falls to the account id in code-unit order, which makes A first and
 * B second. That is what makes "whichever account's rows arrive first" a real
 * question for the merge rather than a formality.
 */
export const MA_OVERLAP_ROOT_A = '600000001';
export const MA_OVERLAP_ROOT_B = '600000002';

/** Synthetic nicknames, so the two rows in the identity list read as two people. */
export const MA_OVERLAP_NICKNAME_A = 'Overlap Captain A';
export const MA_OVERLAP_NICKNAME_B = 'Overlap Captain B';

/**
 * Account A's session files.
 *
 * Three WOT rows on three different days and one WOWS row. Every row carries
 * its own address, so the login half of this archive (Plan 10-04) is a
 * five-address shape too.
 */
const OVERLAP_SESSIONS_A: readonly SessionFileSpec[] = [
  {
    name: 'WOT_Game_Sessions.csv',
    rows: [
      ['04.03.2024 10:00', '04.03.2024 11:00', '192.0.2.10'],
      ['05.03.2024 20:00', '05.03.2024 21:00', '192.0.2.10'],
      ['08.03.2024 09:00', '08.03.2024 10:00', '192.0.2.11'],
    ],
  },
  {
    name: 'WOWS_Game_Sessions.csv',
    rows: [['06.03.2024 18:00', '06.03.2024 19:00', '192.0.2.12']],
  },
];

/**
 * Account B's session files.
 *
 * Every row here is one of the three interesting shapes, which is the point of
 * the archive: `04.03 10:30-11:30` OVERLAPS A's WOT row, `05.03 21:00-22:00`
 * TOUCHES A's WOT row at its end, and `10.03 12:00-12:30` is DISJOINT from
 * everything. The WOTB file then holds a session wholly INSIDE two WOT
 * sessions, and one that overlaps A's WOWS row across games.
 */
const OVERLAP_SESSIONS_B: readonly SessionFileSpec[] = [
  {
    name: 'WOT_Game_Sessions.csv',
    rows: [
      ['04.03.2024 10:30', '04.03.2024 11:30', '192.0.2.10'],
      // Touches A's 05.03 20:00-21:00 exactly at 21:00. Under v1.0 counting
      // this stays TWO sessions and the day's seconds are the two lengths
      // summed, which is what makes D-07's rule observable.
      ['05.03.2024 21:00', '05.03.2024 22:00', '192.0.2.20'],
      ['10.03.2024 12:00', '10.03.2024 12:30', '192.0.2.20'],
    ],
  },
  {
    name: 'WOTB_Game_Sessions.csv',
    rows: [
      // Wholly inside A's 04.03 WOT row AND inside B's own 04.03 WOT row.
      ['04.03.2024 10:45', '04.03.2024 11:15', '192.0.2.21'],
      // Overlaps A's WOWS row by half an hour.
      ['06.03.2024 18:30', '06.03.2024 19:30', '192.0.2.12'],
    ],
  },
];

/**
 * TWO accounts whose sessions OVERLAP each other, across accounts and across
 * games — the fixture success criterion 1 is checked against (D-06, D-08).
 *
 * Every expected number is in {@link MA_OVERLAP_EXPECTED} as a LITERAL,
 * derived by hand from the interval union and never read back from the code
 * under test. The archive is synthetic and every address is from the
 * documentation-only TEST-NET-1 block (`tests/fixtures/README.md`).
 *
 * `reversed: true` inserts the same entries in reverse zip order, so a test can
 * prove that neither the entry order nor the account order moves a number.
 */
export function buildOverlapTwoAccountExport(options: { reversed?: boolean } = {}): Uint8Array {
  return assemble(
    [
      {
        root: MA_OVERLAP_ROOT_A,
        identity: true,
        nickname: MA_OVERLAP_NICKNAME_A,
        noSharedPlayerStats: true,
        sessions: OVERLAP_SESSIONS_A,
      },
      {
        root: MA_OVERLAP_ROOT_B,
        identity: true,
        nickname: MA_OVERLAP_NICKNAME_B,
        noSharedPlayerStats: true,
        sessions: OVERLAP_SESSIONS_B,
      },
    ],
    { reverse: options.reversed === true },
  );
}

/**
 * The answer key, computed BY HAND from {@link OVERLAP_SESSIONS_A} and
 * {@link OVERLAP_SESSIONS_B} by taking the union of the intervals per day.
 * Nothing here is produced by the aggregator.
 *
 * ## All games — 23,400 s (6 h 30 m), 9 sessions, 5 active days
 *
 * Union of all nine intervals, day by day:
 *   - 04.03: 10:00-11:00, 10:30-11:30, 10:45-11:15 (WOTB)
 *     -> 10:00-11:30 = 5,400 s. The WOTB session is wholly inside, so it adds
 *        a session and no seconds.
 *   - 05.03: 20:00-21:00 and 21:00-22:00 TOUCH -> 20:00-22:00 = 7,200 s, and
 *        they remain TWO sessions (D-07 amended: a session is a usable row and
 *        only the hours dedupe).
 *   - 06.03: 18:00-19:00 (WOWS) and 18:30-19:30 (WOTB)
 *     -> 18:00-19:30 = 5,400 s.
 *   - 08.03: 09:00-10:00 = 3,600 s.
 *   - 10.03: 12:00-12:30 = 1,800 s.
 *   Sum 5,400 + 7,200 + 5,400 + 3,600 + 1,800 = 23,400 s over 5 days,
 *   9 usable sessions, 0 excluded rows.
 *
 * ## Per game — only that game's intervals are unioned
 *   - WOT (6 rows, two accounts): 04.03 10:00-11:30 = 5,400; 05.03
 *     20:00-22:00 = 7,200; 08.03 3,600; 10.03 1,800 -> 18,000 s, 4 days,
 *     6 sessions.
 *   - WOTB (2 rows, one account): 04.03 10:45-11:15 = 1,800; 06.03
 *     18:30-19:30 = 3,600 -> 5,400 s, 2 days, 2 sessions.
 *   - WOWS (1 row, one account): 06.03 18:00-19:00 -> 3,600 s, 1 day, 1 session.
 *
 * ## Why the per-game sum is LARGER than All
 *
 * 18,000 + 5,400 + 3,600 = 27,000 s, which is 3,600 s MORE than All. Each
 * per-game scope merges overlap among its OWN sessions only, so playtime that
 * two accounts spent in DIFFERENT games at the same time is counted once under
 * All and twice under the two games. That is the documented shape (D-06), and
 * it is the number the UI explains rather than a discrepancy to reconcile.
 */
export const MA_OVERLAP_EXPECTED = {
  /** All nine usable sessions, ungrouped, merged across accounts and games. */
  all: { seconds: 23_400, sessions: 9, days: 5, excluded: 0 },
  /** The WOT sessions of BOTH accounts, merged among themselves. */
  wot: { seconds: 18_000, sessions: 6, days: 4, excluded: 0 },
  /** The WOTB sessions, both from account B. */
  wotb: { seconds: 5_400, sessions: 2, days: 2, excluded: 0 },
  /** The WOWS session, from account A. */
  wows: { seconds: 3_600, sessions: 1, days: 1, excluded: 0 },
  /** The stored token list, code-unit ascending. */
  games: ['WOT', 'WOTB', 'WOWS'] as const,
  /** The sum of the per-game seconds — deliberately GREATER than `all.seconds`. */
  sumOfGames: 27_000,
  /** The 05.03 touching pair: continuous time, still two sessions. */
  touchingDay: {
    day: '05.03.2024',
    seconds: 7_200,
    sessions: 2,
  },
} as const;

/**
 * The login addresses this archive produces, in the order the login aggregate
 * stores them: logins DESCENDING, then the numeric address ASCENDING.
 *
 * Hand-written here for Plan 10-04 rather than read off the worker, for the same
 * reason {@link MA_OVERLAP_EXPECTED} is: an expected value computed by the code
 * under test asserts only that the code agrees with itself.
 *
 *   192.0.2.10 — 3 logins: A on 04.03 and 05.03, B on 04.03.
 *   192.0.2.12 — 2 logins: A's WOWS row and B's WOTB row, both on 06.03.
 *   192.0.2.20 — 2 logins: B's two March rows.
 *   192.0.2.11 — 1 login:  A's 08.03 WOT row.
 *   192.0.2.21 — 1 login:  B's 04.03 WOTB row.
 *
 * `games` lists the tokens of the sessions that carried the address, ascending
 * — note `192.0.2.12` carries one session of each game.
 */
export const MA_OVERLAP_ADDRESSES = [
  {
    address: '192.0.2.10',
    logins: 3,
    accounts: [MA_OVERLAP_ROOT_A, MA_OVERLAP_ROOT_B],
    games: ['WOT'],
  },
  {
    address: '192.0.2.12',
    logins: 2,
    accounts: [MA_OVERLAP_ROOT_A, MA_OVERLAP_ROOT_B],
    games: ['WOTB', 'WOWS'],
  },
  { address: '192.0.2.20', logins: 2, accounts: [MA_OVERLAP_ROOT_B], games: ['WOT'] },
  { address: '192.0.2.11', logins: 1, accounts: [MA_OVERLAP_ROOT_A], games: ['WOT'] },
  { address: '192.0.2.21', logins: 1, accounts: [MA_OVERLAP_ROOT_B], games: ['WOTB'] },
] as const;

// -----------------------------------------------------------------------------
// The LARGE three-account export (10-06, D-16, D-17, SCALE-01)
// -----------------------------------------------------------------------------

/**
 * The three synthetic roots of the large archive.
 *
 * Their CODE-UNIT order (`720000001` < `720000005` < `720000009`) is the REVERSE
 * of the D-16 order (first activity year ascending: 2012, 2016, 2019), on purpose:
 * a reader that kept the storage order, or sorted the roots as numbers, would
 * letter the accounts the wrong way round and every tag would be a lie.
 *
 * Letters, as the identity header prints them: A is `720000009` (2012), B is
 * `720000005` (2016) and C is `720000001` (2019).
 */
export const MA_LARGE_ROOT_A = '720000009';
export const MA_LARGE_ROOT_B = '720000005';
export const MA_LARGE_ROOT_C = '720000001';

/** The roots in D-16 order, which is the order the identity header lists them. */
export const MA_LARGE_ROOTS_D16_ORDER: readonly string[] = [
  MA_LARGE_ROOT_A,
  MA_LARGE_ROOT_B,
  MA_LARGE_ROOT_C,
];

/** The roots in code-unit order, which is the order the archive stores them. */
export const MA_LARGE_ROOTS_CODE_UNIT_ORDER: readonly string[] = [
  MA_LARGE_ROOT_C,
  MA_LARGE_ROOT_B,
  MA_LARGE_ROOT_A,
];

/** The three synthetic nicknames, in D-16 order. */
export const MA_LARGE_NICKNAMES: readonly string[] = [
  'Large Captain A',
  'Large Captain B',
  'Large Captain C',
];

/** First activity year per root: the oldest account is 2012, then 2016, then 2019. */
const LARGE_FIRST_YEARS: readonly number[] = [2012, 2016, 2019];

/** Last day (UTC) any generated session may start on: 30 September 2026. */
const LARGE_LAST_START_MS = Date.UTC(2026, 8, 30);

/**
 * How many vehicle rows each account carries, in D-16 order: 5,000 + 1,500 + 500
 * = 7,000 (D-17).
 */
export const MA_LARGE_VEHICLE_COUNTS: readonly number[] = [5_000, 1_500, 500];

/**
 * Sessions per account and game file, in D-16 order: the oldest account WOT 9,000,
 * WOTB 3,000, WOWS 1,000; the second WOT 3,000, WOTB 1,500; the third WOTB 2,000,
 * WOWS 500 — 20,000 in all (D-17). The counts are NOT shrunk: the unit file ran
 * inside its budget on the development machine (see the unit test's header).
 */
const LARGE_SESSION_PLAN: readonly (readonly (readonly [string, number])[])[] = [
  [
    ['WOT_Game_Sessions.csv', 9_000],
    ['WOTB_Game_Sessions.csv', 3_000],
    ['WOWS_Game_Sessions.csv', 1_000],
  ],
  [
    ['WOT_Game_Sessions.csv', 3_000],
    ['WOTB_Game_Sessions.csv', 1_500],
  ],
  [
    ['WOTB_Game_Sessions.csv', 2_000],
    ['WOWS_Game_Sessions.csv', 500],
  ],
];

/** The currency presets, in D-16 order: 54,000, 2,000 and 500 rows. */
const LARGE_CURRENCY_SPECS = [CURRENCY_54K_SPEC, CURRENCY_2K_SPEC, CURRENCY_500_SPEC] as const;

/** Seeds for the vehicle files and the session generators, one per account. */
const LARGE_VEHICLE_SEEDS: readonly number[] = [1_061, 1_062, 1_063];
const LARGE_SESSION_SEEDS: readonly number[] = [10_601, 10_602, 10_603];

/**
 * ONE pool of 600 documentation addresses shared by all three accounts, so the
 * same address recurs across accounts: 192.0.2.1-200 (TEST-NET-1),
 * 198.51.100.1-200 (TEST-NET-2) and 203.0.113.1-200 (TEST-NET-3), RFC 5737.
 */
const LARGE_ADDRESS_POOL: readonly string[] = (() => {
  const pool: string[] = [];
  for (const prefix of ['192.0.2', '198.51.100', '203.0.113']) {
    for (let host = 1; host <= 200; host++) pool.push(`${prefix}.${host}`);
  }
  return pool;
})();

/** A `[startSeconds, endSeconds]` pair, in wall-clock Unix seconds. */
export type LargeSessionPair = readonly [number, number];

/** What {@link buildLargeThreeAccountExport} says the archive holds. */
export interface LargeThreeAccountExpected {
  /** The roots in D-16 order (A, B, C). */
  roots: readonly string[];
  /** The three currency CSV texts, in D-16 order (54,000 / 2,000 / 500 rows). */
  currencyCsvs: readonly string[];
  /** Every generated session as a second pair, per game and for all games. */
  sessions: {
    all: readonly LargeSessionPair[];
    WOT: readonly LargeSessionPair[];
    WOTB: readonly LargeSessionPair[];
    WOWS: readonly LargeSessionPair[];
  };
  /** Vehicle rows per root. */
  vehicleCounts: Readonly<Record<string, number>>;
  /** Every distinct address any session row carries, ascending as text. */
  addresses: readonly string[];
}

/** `DD.MM.YYYY HH:MM` of a UTC millisecond instant, as the export writes it. */
function exportStamp(ms: number): string {
  const d = new Date(ms);
  const two = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return (
    `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ` +
    `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`
  );
}

/**
 * Build the LARGE three-account archive and the facts about it that a test can
 * check an aggregation against (Phase 10, D-17, SCALE-01).
 *
 * ## What is in it
 *
 * Three accounts in code-unit order `720000001`, `720000005`, `720000009`
 * (D-16 order is the reverse): a 54,000-row `Virtual_Currencies_Operations.csv`
 * on the oldest, 2,000 and 500 rows on the others; 5,000 + 1,500 + 500 = 7,000
 * `WOT_Vehicle_Statistics.csv` rows; and 20,000 sessions over WoT, WoT Blitz and
 * Warships whose IP cells draw from ONE shared pool of 600 documentation
 * addresses. Every account also carries the hand Orders file, so the per-account
 * Payments split has three contributors.
 *
 * ## Why it never touches disk
 *
 * The bytes are built in memory from seeds and returned. There is no real export
 * anywhere in the repository (T-10-19) and every address is an RFC 5737
 * documentation address.
 *
 * ## Independence
 *
 * Stamps are converted to Unix seconds here with `Date.UTC`, not through a
 * calendar helper from the app or from `export-fixtures.ts`, so the oracle a
 * test builds from `expected` shares no code with the parser it checks.
 *
 * ## Counts
 *
 * Sessions 20,000 (WOT 12,000, WOTB 6,500, WOWS 1,500); vehicles 7,000
 * (5,000 / 1,500 / 500); currency 54,000 + 2,000 + 500 rows.
 */
export function buildLargeThreeAccountExport(): {
  bytes: Uint8Array;
  expected: LargeThreeAccountExpected;
} {
  const sessionPairs: Record<'all' | 'WOT' | 'WOTB' | 'WOWS', LargeSessionPair[]> = {
    all: [],
    WOT: [],
    WOTB: [],
    WOWS: [],
  };
  const addresses = new Set<string>();
  const specs: RootSpec[] = [];
  const currencyCsvs: string[] = [];

  MA_LARGE_ROOTS_D16_ORDER.forEach((root, account) => {
    const rand = mulberry32(LARGE_SESSION_SEEDS[account]!);
    const firstYear = LARGE_FIRST_YEARS[account]!;
    const rangeStart = Date.UTC(firstYear, 0, 1);
    const spanMinutes = Math.floor((LARGE_LAST_START_MS - rangeStart) / 60_000);
    let pinned = false;

    const sessions: SessionFileSpec[] = [];
    for (const [name, count] of LARGE_SESSION_PLAN[account]!) {
      const game = name.slice(0, name.indexOf('_')) as 'WOT' | 'WOTB' | 'WOWS';
      const rows: RealShapeRow[] = [];
      for (let i = 0; i < count; i++) {
        let startMs: number;
        let lengthMinutes: number;
        if (!pinned) {
          // One session pinned to 15 January of the account's first year, so
          // its first-activity year (D-16) cannot drift with the random draws.
          pinned = true;
          startMs = Date.UTC(firstYear, 0, 15, 12, 0);
          lengthMinutes = 60;
        } else {
          startMs = rangeStart + Math.floor(rand() * spanMinutes) * 60_000;
          lengthMinutes = 1 + Math.floor(rand() * 240);
        }
        const endMs = startMs + lengthMinutes * 60_000;
        const ip = LARGE_ADDRESS_POOL[Math.floor(rand() * LARGE_ADDRESS_POOL.length)]!;
        rows.push([exportStamp(startMs), exportStamp(endMs), ip]);
        const pair: LargeSessionPair = [startMs / 1000, endMs / 1000];
        sessionPairs.all.push(pair);
        sessionPairs[game].push(pair);
        addresses.add(ip);
      }
      sessions.push({ name, rows });
    }

    const currency = generateCurrencyOpsCsv(LARGE_CURRENCY_SPECS[account]!);
    currencyCsvs.push(currency);

    specs.push({
      root,
      identity: true,
      nickname: MA_LARGE_NICKNAMES[account],
      noSharedPlayerStats: true,
      payment: true,
      sessions,
      files: {
        [`${F_FINANCIAL}/Virtual_Currencies_Operations.csv`]: currency,
        [`${F_PLAYER}/WOT_Vehicle_Statistics.csv`]: generateVehicleMainCsv({
          seed: LARGE_VEHICLE_SEEDS[account]!,
          count: MA_LARGE_VEHICLE_COUNTS[account]!,
        }),
      },
    });
  });

  const vehicleCounts: Record<string, number> = {};
  MA_LARGE_ROOTS_D16_ORDER.forEach((root, account) => {
    vehicleCounts[root] = MA_LARGE_VEHICLE_COUNTS[account]!;
  });

  return {
    // The archive stores its roots in code-unit order, the reverse of D-16.
    bytes: assemble([...specs].reverse()),
    expected: {
      roots: MA_LARGE_ROOTS_D16_ORDER,
      currencyCsvs,
      sessions: sessionPairs,
      vehicleCounts,
      addresses: [...addresses].sort(),
    },
  };
}

// -----------------------------------------------------------------------------
// The new-game archive (plan 11-01)
// -----------------------------------------------------------------------------

/**
 * TWO roots whose session files are HEAT, WOTC and WOT, each row carrying an
 * email, a nickname and an account id no spec names — the archive the
 * per-file allowlist is proved against (D-08, PRIV-01).
 *
 * Built through the same private {@link assemble} as every other builder here,
 * so the roots, the folder names and the entry shapes are the ones the
 * classifier already handles. The session CSVs are written through the `files`
 * override rather than through `sessions`, because `sessionCsv` renders the
 * three-column real header and these files need six — the three spec columns
 * and the three planted canaries.
 *
 * Root A additionally carries TWO family files with NO spec:
 * `Device_Info/HEAT_Device_Info.csv` and
 * `Player_Statistics/HEAT_Unlisted_File.csv`. Both are in the new-game family by
 * name and both are in a supported folder, so both must store nothing (D-15) —
 * and each carries a canary so the test can prove the rows were never WRITTEN
 * rather than merely never read.
 */
export function buildNewGamesExport(
  options: { drifted?: boolean; headerOnly?: boolean; reversed?: boolean } = {},
): Uint8Array {
  const filesA: Record<string, string> = {
    [`${F_ACTIVITY}/HEAT_Game_Sessions.csv`]: NG_HEAT_SESSIONS_A,
    [`${F_ACTIVITY}/WOTC_Game_Sessions.csv`]: NG_WOTC_SESSIONS_A,
    [`${F_ACTIVITY}/WOT_Game_Sessions.csv`]: NG_WOT_SESSIONS_A,
    [`${F_DEVICE}/HEAT_Device_Info.csv`]: NG_UNLISTED_BODY,
    [`${F_PLAYER}/HEAT_Unlisted_File.csv`]: NG_UNLISTED_BODY,
  };
  // The two variants that prove the FILE-level skip: `headerOnly` replaces the
  // HEAT file with a header and no rows, and `drifted` gives it headers that
  // match no spec column. Each is applied to root A alone, so the archive always
  // holds the same number of accounts.
  if (options.headerOnly === true) {
    filesA[`${F_ACTIVITY}/HEAT_Game_Sessions.csv`] = NG_HEAT_HEADER_ONLY;
  } else if (options.drifted === true) {
    filesA[`${F_ACTIVITY}/HEAT_Game_Sessions.csv`] = NG_HEAT_DRIFTED;
  }

  const filesB: Record<string, string> = {
    [`${F_ACTIVITY}/HEAT_Game_Sessions.csv`]: NG_HEAT_SESSIONS_B,
    [`${F_ACTIVITY}/WOT_Game_Sessions.csv`]: NG_WOT_SESSIONS_B,
  };

  return assemble(
    [
      { root: NG_ROOT_A, noSharedPlayerStats: true, files: filesA },
      { root: NG_ROOT_B, noSharedPlayerStats: true, files: filesB },
    ],
    { reverse: options.reversed === true },
  );
}

// -----------------------------------------------------------------------------
// Phase 11, plan 11-11 — the three-account archive with the new pane files
// -----------------------------------------------------------------------------

/**
 * The `files` map of one root for a set of new-data spec keys, every file in its
 * canary-laden form (RESEARCH Pitfall 9). Folder and file name are the capture's
 * own spelling; `overrides` replaces one body by spec key.
 */
function newDataFilesFor(
  keys: readonly string[],
  overrides: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const fixture = NEW_DATA_FIXTURE_FILES[key];
    if (fixture === undefined) throw new Error(`no new-data fixture for ${key}`);
    out[`${fixture.folder}/${fixture.fileName}`] = overrides[key] ?? withCanaries(key);
  }
  return out;
}

/**
 * The real-shape archive's three roots (same RU, EU, NA, same loose README
 * files) PLUS the new pane files: the four HEAT files in EU, the two Warships
 * files in RU and NA, the four Warplanes files in RU alone.
 *
 * The roots are spread copies, so no existing builder changes by a byte. Every
 * file is laden with canary columns; the one exception is the large storage file
 * (`largeStorageRows`), which is the generated scale table with no canaries.
 */
export function buildNewGamesThreeAccountExport(
  options: { reversed?: boolean; largeStorageRows?: number } = {},
): Uint8Array {
  const storageKey = 'wows_account_storage.csv';
  const ruOverrides: Record<string, string> =
    options.largeStorageRows === undefined
      ? {}
      : { [storageKey]: buildLargeTableCsv(storageKey, options.largeStorageRows) };
  const ru: RootSpec = {
    ...RU_ROOT,
    files: { ...newDataFilesFor(NG_WOWS_PANE_KEYS, ruOverrides), ...newDataFilesFor(NG_WOWP_KEYS) },
  };
  const eu: RootSpec = { ...EU_ROOT, files: newDataFilesFor(NG_HEAT_PANE_KEYS) };
  const na: RootSpec = { ...NA_ROOT, files: newDataFilesFor(NG_WOWS_PANE_KEYS) };
  const loose: Record<string, string> = {};
  for (const name of MA_README_FILES) loose[name] = '%PDF-1.4\nsynthetic readme\n%%EOF\n';
  return assemble([ru, eu, na], { loose, reverse: options.reversed === true });
}

/**
 * ONE account whose only session file is `HEAT_Game_Sessions.csv`: its game list
 * is HEAT alone, so the game filter has nothing to choose between and renders no
 * chip row. Built through the same generator as every other root.
 */
export function buildHeatOnlyExport(): Uint8Array {
  const heatOnly: RootSpec = {
    root: MA_ROOT_EU,
    identity: true,
    sessions: EU_SESSIONS.filter((file) => file.name === 'HEAT_Game_Sessions.csv'),
  };
  return assemble([heatOnly]);
}
