import { zipSync } from './pinned-zip.ts';
import {
  CURRENCY_HAND_CSV,
  CURRENCY_OPS_HEADER,
  ORDERS_HAND_CSV,
  PREMIUM_HAND_CSV,
  renderQuoteAllCsv,
} from './finance-fixtures.ts';
import { DEVICE_INFO_SAMPLE_FILES, DEVICE_PC_HEADER } from './device-info-fixtures.ts';
import {
  PLAYER_STATS_SAMPLE_FILES,
  WOT_MAIN_HEADER,
  renderStatsCsv,
} from './player-stats-fixtures.ts';
import { buildRealShapeCsv, type RealShapeRow } from './playtime-real-shape-fixture.ts';

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
