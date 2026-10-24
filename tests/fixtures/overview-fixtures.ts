// =============================================================================
// The Overview insight fixture module (phase 13, plan 13-03, Task 1).
//
// WHY THIS MODULE EXISTS
// Phase 13 turns the Overview into a personal-insights page whose every tile is
// a NUMBER. A number needs an answer key, and the answer key needs an archive
// whose numbers are hand-derivable rather than captured from a player's real
// export. This module owns that archive: ONE synthetic two-account export whose
// every figure is invented and whose every tile can be computed with arithmetic
// a reader can check on paper.
//
// The answer key itself lives in `tests/helpers/overview-oracle.ts`, which
// imports NOTHING — not this module, not `src/`. That direction is deliberate:
// the oracle restates this file's rows by hand, so a wrong aggregator and a
// wrong fixture cannot agree by accident.
//
// EVERY VALUE HERE IS INVENTED
// No real account id, nickname, e-mail address, IP address, order id, clan name
// or battle count appears in this file or in any archive it builds. The two
// account roots are made-up numeric ids; the tank tags are `Synth`-prefixed
// inventions; every timestamp, amount and count is fabricated. The e-mail is
// on an RFC 2606 reserved domain (`.example.invalid`). The no-real-data guard
// (`tests/unit/guards/no-real-data.test.ts`) is re-run by this plan's verify.
//
// THE IMPORT RULE
// This module imports the shared pinned `zipSync` and the two existing data
// modules (the player-stats renderer and the finance headers/canaries), and it
// imports NOTHING from `src/`. The tank table it publishes (`OV_SYNTHETIC_TABLE`)
// is declared LOCALLY with its own tuple type, precisely so the fixture never
// reaches into the application for the thing it is supposed to stand in for.
//
// THE OPTIONS ARE THE ABSENCE MATRIX
// Phase 13 has to render an "absent" state for every source it reads (D-03:
// one dashed row per group, never a zero). Each `omit` option removes exactly
// one source, so every absent state is reachable by construction rather than
// by a second hand-written archive that could drift from this one.
//
// Decisions: D-03 (absent rows), D-04 (sums across accounts), D-05 (the
// session union), D-09 (the tag-derived fallback), D-18 (sensitive values are
// count-only), D-19 (records are a maximum), D-20 (habits are WoT-only),
// D-21 (credits are deposits plus income).
// =============================================================================

import { zipSync } from './pinned-zip.ts';
import { STATS_NAME_CANARY, renderStatsCsv } from './player-stats-fixtures.ts';
import {
  CURRENCY_OPS_HEADER,
  FINANCE_CANARIES,
  ORDERS_HEADER_12,
  renderQuoteAllCsv,
} from './finance-fixtures.ts';

// -----------------------------------------------------------------------------
// The two account roots
// -----------------------------------------------------------------------------

/**
 * The first account root: the one that owns the whole hand-designed timeline.
 *
 * A made-up seven-digit id. It is NOT a real Wargaming account number and it
 * is not an anonymised one — nothing real was ever read to produce it.
 */
export const OV_ROOT_A = '1234567';

/**
 * The second account root: the ISO-timestamp account.
 *
 * It exists for three reasons, and each of them is a shape the first root
 * cannot carry: the ISO timestamp format with its `.000` fraction, a session
 * that OVERLAPS one of the first root's sessions (so the union has something
 * to merge), and a second account's account-statistics row (so the sums and
 * the record maximum have something to combine).
 */
export const OV_ROOT_B = '2345678';

// -----------------------------------------------------------------------------
// The synthetic tanks
// -----------------------------------------------------------------------------

/**
 * The slots of {@link OV_TAGS}, named.
 *
 * A slot rather than a tag, because the `tanks: 'known'` option swaps the tag
 * a slot carries and the rest of the archive — the row order, the battle
 * counts, the answer key — has to stay identical.
 */
export type TankSlot = 'one' | 'two' | 'three' | 'four' | 'garage';

/**
 * The invented tank tags, one per slot.
 *
 * `garage` is the vehicle that sits in the garage with no battles, and `four`
 * is the tank that is deliberately ABSENT from {@link OV_SYNTHETIC_TABLE} — so
 * the retired-tank path (D-09: a tag the table does not have falls back to the
 * tag-derived name and an unknown class) is exercised by the default archive
 * rather than only by an option.
 *
 * Every tag is `nation:Ch99_SynthOne` shaped, so the fallback name drops the
 * nation prefix and the leading index token and reads `SynthOne`.
 */
export const OV_TAGS = {
  one: 'china:Ch99_SynthOne',
  two: 'usa:A99_SynthTwo',
  three: 'germany:G99_SynthThree',
  four: 'ussr:R99_SynthFour',
  garage: 'usa:A98_SynthGarage',
} as const;

/**
 * The fourth tag under `tanks: 'hostile'`: markup text inside a vehicle name.
 *
 * Everything else about the slot (its id, its 40 battles, its place in the top
 * five) is unchanged, so the only difference is the characters in the name.
 */
export const OV_HOSTILE_TAG = 'ussr:R99_<b>bold</b>_Four';

/**
 * The REAL-LOOKING tags, for the `tanks: 'known'` option.
 *
 * These three are the tags the existing vehicle fixture already uses
 * (`player-stats-fixtures.ts`), so the option swaps the invented tags for tags
 * a REAL tank table would carry — which is what lets a later plan prove table
 * resolution without changing any other figure in the archive. The ids, the
 * battle counts, the timestamps and every other figure are untouched by the
 * swap, so a difference in a result can only be a difference in resolution.
 *
 * `four` and `garage` are NOT swapped: they stay invented, because a real
 * table has no row for them either, and the retired-tank path must survive
 * the swap.
 */
export const OV_KNOWN_TAGS = {
  one: 'china:Ch24_Type64',
  two: 'usa:A12_T29',
  three: 'germany:G32_PzV_PzIV',
} as const;

/**
 * The invented tank ids the record columns carry.
 *
 * A record column names its tank with a NUMERIC id, and these four are what
 * `MAX_DAMAGE_VEHICLE`, `MAX_XP_VEHICLE` and `MAX_FRAGS_VEHICLE` hold. They
 * are strings, because that is what a cell holds, and `four` deliberately has
 * NO row in {@link OV_SYNTHETIC_TABLE} — so the XP record of root B points at
 * a tank no table knows.
 */
export const OV_IDS = {
  one: '990001',
  two: '990002',
  three: '990003',
  four: '990004',
} as const;

/**
 * One row of the synthetic tank table, declared LOCALLY.
 *
 * The same tuple shape the committed table uses — `[tank_id, "nation:tag",
 * name, type, tier]` — but declared here rather than imported, because this
 * module must not reach into `src/` for the thing it stands in for. A test that
 * wants to build a lookup over it uses this type; the application has its own.
 */
export type OvSyntheticTankRow = readonly [
  tankId: number,
  key: string,
  name: string,
  type: string,
  tier: number,
];

/**
 * The three-row synthetic tank table.
 *
 * It resolves the first three tanks and NOT the fourth, so the archive
 * exercises both worlds at once: a resolved tank (name `Synth One`, class
 * `heavyTank`, tier 8) and an unresolved one (name `SynthFour`, class
 * unknown). The oracle states both readings.
 *
 * The names carry a SPACE (`Synth One`) while the tag-derived fallback does
 * not (`SynthOne`) — that difference is the whole point of the table, so a
 * test can tell a resolved name from a fallback one by value.
 */
export const OV_SYNTHETIC_TABLE: readonly OvSyntheticTankRow[] = [
  [990001, OV_TAGS.one, 'Synth One', 'heavyTank', 8],
  [990002, OV_TAGS.two, 'Synth Two', 'mediumTank', 7],
  [990003, OV_TAGS.three, 'Synth Three', 'AT-SPG', 6],
];

// -----------------------------------------------------------------------------
// The planted sensitive values
// -----------------------------------------------------------------------------

/**
 * The order AMOUNT canary.
 *
 * An amount is money, and D-18 makes order amounts count-only on the Overview.
 * The literal lives in the `PAYED_IN_CURR_AMT` cell of every order row, so a
 * leak is assertable by value — and because the same string is in EVERY row,
 * a leak of any single row is caught.
 */
export const OV_ORDER_AMOUNT_CANARY = '31415.92';

/**
 * The chat-line canary, planted in `Chat_history/Messages.csv`.
 *
 * `Chat_history` is a KNOWN-DEFERRED category: the importer COUNTS the file
 * and never stores a row of it. The canary is therefore absent at rest — which
 * this plan's own fixture test proves — and it exists so a later plan can
 * assert it never reaches a worker reply or the DOM either.
 */
export const OV_CHAT_CANARY = 'CANARY-OV-CHAT-LINE-4c2e';

/**
 * The clan-name canary, planted in `Clans/Clan_membership.csv`.
 *
 * `Clans` is known-deferred for the same reason as `Chat_history`, and a clan
 * name is a personal value D-18 forbids on the Overview.
 */
export const OV_CLAN_CANARY = 'CANARY-OV-CLAN-NAME-7b1d';

/**
 * The e-mail canary, planted in the `LOGIN` cell of both `Account_Info.csv`
 * files.
 *
 * The worker strips `LOGIN`, `BIRTH_DATE` and `BIRTH_DATE_SRC` before a row is
 * written (Phase 3 D-18), so this string never reaches IndexedDB. The plan
 * names ONE e-mail canary for both roots, and this module uses one: a second
 * literal would need a second exported constant, which the plan's artifact
 * list does not have, and the point of the canary is to be greppable.
 */
export const OV_EMAIL_CANARY = 'ov.player@example.invalid';

/**
 * The two accounts' identity nicknames, as the identity header shows them.
 *
 * They are NOT canaries: the header prints them by design. The Overview page
 * itself must not (D-18), which a page test asserts against these two strings.
 */
export const OV_NICKNAME_A = 'Synthetic Overview Alpha';
export const OV_NICKNAME_B = 'Synthetic Overview Beta';

/** The nickname canary this archive reuses from the player-stats fixture. */
export const OV_NAME_CANARY = STATS_NAME_CANARY;

/** The finance canaries this archive reuses from the finance fixture. */
export const OV_FINANCE_CANARIES = FINANCE_CANARIES;

/**
 * EVERY string in this archive that must never reach a worker reply or a page.
 *
 * Two kinds live here, and the difference matters:
 *
 *   - values in a KNOWN-DEFERRED category (`OV_CHAT_CANARY`, `OV_CLAN_CANARY`)
 *     and the stripped `LOGIN` (`OV_EMAIL_CANARY`) are absent at REST as well
 *     as downstream — the fixture test proves that;
 *   - values in a STORED category (`OV_NAME_CANARY`, the finance canaries,
 *     `OV_ORDER_AMOUNT_CANARY`) are PRESENT at rest, because those rows are
 *     stored raw. That is exactly why a later plan asserts their absence
 *     DOWNSTREAM (a worker reply, a view, the DOM) rather than at rest.
 */
export const OV_CANARIES: readonly string[] = [
  OV_NAME_CANARY,
  OV_FINANCE_CANARIES.coupon,
  OV_FINANCE_CANARIES.aggregator,
  OV_FINANCE_CANARIES.package,
  OV_FINANCE_CANARIES.orderId,
  OV_ORDER_AMOUNT_CANARY,
  OV_CHAT_CANARY,
  OV_CLAN_CANARY,
  OV_EMAIL_CANARY,
];

// -----------------------------------------------------------------------------
// The options
// -----------------------------------------------------------------------------

/**
 * One source that can be switched off.
 *
 * Every option removes exactly ONE source, so each absent state the Overview
 * has to render is reachable from the default archive rather than from a
 * second hand-written one that could drift.
 */
export type OverviewOmit =
  /** Every session file of every root. */
  | 'sessions'
  /** The `WOT_Game_Sessions.csv` files only; the Blitz file stays. */
  | 'wot-sessions'
  /** `Player_statistics/WOT_Account_Statistics.csv`. */
  | 'account-statistics'
  /** `Player_statistics/WOT_Vehicle_Statistics.csv`. */
  | 'vehicle-statistics'
  /** `Financial_data/Virtual_Currencies_Operations.csv`. */
  | 'currency'
  /** `Payment_history/Orders.csv`. */
  | 'orders'
  /** The record columns of the account-statistics file. */
  | 'record-columns';

/** What to build and what to leave out. */
export interface OverviewFixtureOptions {
  /** The sources to leave out. Empty (the default) keeps every source. */
  omit?: readonly OverviewOmit[];
  /**
   * Which tags the vehicle-statistics rows carry.
   *
   * `'synthetic'` (the default) writes {@link OV_TAGS}, the invented ones that
   * {@link OV_SYNTHETIC_TABLE} resolves. `'known'` writes {@link OV_KNOWN_TAGS}
   * for the first three slots and leaves the other two alone, so a later plan
   * can drive the same archive through the COMMITTED table. `'hostile'` keeps
   * the invented tags and renames only the fourth to {@link OV_HOSTILE_TAG},
   * a tag that carries markup text, so a page test can prove a vehicle name
   * renders as text and creates no element (D-18).
   */
  tanks?: 'synthetic' | 'known' | 'hostile';
}

// -----------------------------------------------------------------------------
// The file bodies
// -----------------------------------------------------------------------------

/** The real export's session header: two columns, no third. */
const SESSION_HEADER = 'STARTED_AT;FINISHED_AT';

/** The `Account_Info` header, trimmed to the six columns this archive uses. */
const ACCOUNT_INFO_HEADER = 'ID;NAME;CREATED_AT;REGION;LOGIN;BIRTH_DATE';

/** The `Chat_history` file's header, as the sample export spells it. */
const CHAT_HEADER = 'MESSAGE_DT;CHANNEL_ID;MESSAGE_BODY';

/** The `Clans` file's header, as the sample export spells it. */
const CLAN_HEADER = 'CLAN_ID;CLAN_NAME;JOINED_AT;LEFT_AT;ROLE';

/**
 * The account-statistics header: SEVENTEEN columns, in the export's own order.
 *
 * The four the Overview always needs come first (`NAME`, `BATTLES_COUNT`,
 * `WINS_COUNT`, `BATTLE_LIFE_TIME`), then the lifetime totals, then the RECORD
 * columns — the per-battle maxima, the tank id each maximum belongs to, and the
 * two series maxima.
 */
const ACCOUNT_STATS_HEADER = [
  'NAME',
  'BATTLES_COUNT',
  'WINS_COUNT',
  'BATTLE_LIFE_TIME',
  'DAMAGE_DEALT',
  'FRAGS_COUNT',
  'XP_AMOUNT',
  'DAMAGE_BLOCKED_BY_ARMOR',
  'TREES_CUT_COUNT',
  'DAMAGE_MAX',
  'XP_MAX',
  'FRAGS_MAX',
  'MAX_DAMAGE_VEHICLE',
  'MAX_XP_VEHICLE',
  'MAX_FRAGS_VEHICLE',
  'KILLING_SERIES_MAX',
  'SNIPER_SERIES_MAX',
] as const;

/**
 * The account-statistics header WITHOUT the record columns.
 *
 * The `record-columns` option writes this one instead, so the file still
 * carries the counts and the battle time and carries no maximum at all. A
 * record tile then has no column to read, which is a different absence from
 * the file being missing altogether — and the Overview must tell them apart.
 */
const ACCOUNT_STATS_HEADER_NO_RECORDS = [
  'NAME',
  'BATTLES_COUNT',
  'WINS_COUNT',
  'BATTLE_LIFE_TIME',
] as const;

/** The vehicle-statistics header, in the export's own column order. */
const VEHICLE_STATS_HEADER = [
  'VEHICLE_NAME',
  'BATTLES_COUNT',
  'WINS_COUNT',
  'DAMAGE_DEALT',
  'BATTLE_LIFE_TIME_SEC',
  'IN_GARAGE',
] as const;

/**
 * Root A's account-statistics row.
 *
 * Every figure is invented. The ones the answer key names:
 *
 *   - 1,200 battles, 660 wins, 864,000 s of battle life;
 *   - `DAMAGE_MAX` 5,200 on tank 990001, `XP_MAX` 2,100 on tank 990002,
 *     `FRAGS_MAX` 7 on tank 990001, `SNIPER_SERIES_MAX` 9.
 *
 * The battle life is 864,000 s — exactly ten days — and it is also the sum of
 * root A's four `BATTLE_LIFE_TIME_SEC` cells, so the reconciliation the
 * spike recorded (the vehicle file sums to the account total) holds here.
 */
const ACCOUNT_STATS_ROW_A: readonly string[] = [
  OV_NAME_CANARY,
  '1200',
  '660',
  '864000',
  '1840000',
  '910',
  '2260000',
  '315000',
  '240',
  '5200',
  '2100',
  '7',
  OV_IDS.one,
  OV_IDS.two,
  OV_IDS.one,
  '5',
  '9',
];

/**
 * Root B's account-statistics row.
 *
 *   - 300 battles, 120 wins, 259,200 s of battle life (exactly three days);
 *   - `DAMAGE_MAX` 6,100 on tank 990003 — the archive's damage record, and it
 *     is held by the SECOND account, so a "maximum across accounts" rule and a
 *     "sum" rule cannot both be right;
 *   - `XP_MAX` 1,900 on tank 990004, which no tank table row carries, so the
 *     XP record resolves to nothing;
 *   - `FRAGS_MAX` 8 with the vehicle id `0`, which is the export's "not
 *     recorded" spelling and resolves to nothing in either world;
 *   - `SNIPER_SERIES_MAX` is `\N` — the export's own "no value" marker — so the
 *     series record is root A's 9 and not a zero.
 */
const ACCOUNT_STATS_ROW_B: readonly string[] = [
  OV_NAME_CANARY,
  '300',
  '120',
  '259200',
  '412000',
  '205',
  '604000',
  '72000',
  '61',
  '6100',
  '1900',
  '8',
  OV_IDS.three,
  OV_IDS.four,
  '0',
  '3',
  '\\N',
];

/**
 * Root A's vehicle-statistics rows: 700 + 350 + 150 + 0 = 1,200 battles and
 * 600,000 + 220,000 + 44,000 + 0 = 864,000 s of battle life.
 *
 * The LAST row is the garage-only vehicle: no battles, no damage, and
 * `IN_GARAGE` 1. It is the row an aggregator must EXCLUDE from the fleet, the
 * class split and the coverage figure while keeping it visible as a row.
 *
 * `IN_GARAGE` is 1 on that row only, so "in the garage with no battles" has
 * exactly one shape in the archive and a test can count it.
 */
const VEHICLE_STATS_ROWS_A: readonly (readonly string[])[] = [
  ['one', '700', '380', '986000', '600000', '0'],
  ['two', '350', '175', '451000', '220000', '0'],
  ['three', '150', '60', '152000', '44000', '0'],
  ['garage', '0', '0', '0', '0', '1'],
];

/**
 * Root B's vehicle-statistics rows: 200 + 60 + 40 = 300 battles and
 * 200,000 + 40,000 + 19,200 = 259,200 s of battle life.
 *
 * The first tank is root A's first tank, so the two roots share one tag and a
 * per-account reading that forgot to group would report two tanks instead of
 * one. The third is tag `four`, which no tank table row carries.
 */
const VEHICLE_STATS_ROWS_B: readonly (readonly string[])[] = [
  ['one', '200', '82', '271000', '200000', '0'],
  ['two', '60', '24', '78000', '40000', '0'],
  ['four', '40', '14', '63000', '19200', '0'],
];

/**
 * Root A's currency operations.
 *
 * Three credits rows and one gold row. The in-flow of the credits is
 * 9,000,000 + 2,000,000 = 11,000,000 (a deposit and an income), the
 * withdrawal is 3,000,000 and is NOT in-flow, and the gold row is a different
 * currency and is not credits at all.
 */
const CURRENCY_ROWS_A: readonly (readonly string[])[] = [
  [
    '2020-03-02 09:00:00',
    'ru.wot.credits',
    'Credits',
    '9000000.00',
    'deposit',
    OV_FINANCE_CANARIES.orderId,
  ],
  [
    '2020-03-03 09:00:00',
    'ru.wot.credits',
    'Credits',
    '2000000.00',
    'income',
    OV_FINANCE_CANARIES.orderId,
  ],
  [
    '2020-03-04 09:00:00',
    'ru.wot.credits',
    'Credits',
    '3000000.00',
    'withdrawal',
    OV_FINANCE_CANARIES.orderId,
  ],
  [
    '2020-03-02 10:30:00',
    'ru.shared_currency.gold',
    'Gold',
    '100.00',
    'deposit',
    OV_FINANCE_CANARIES.orderId,
  ],
];

/** Root B's single currency operation: a credits deposit of 1,000,000. */
const CURRENCY_ROWS_B: readonly (readonly string[])[] = [
  [
    '2020-06-11 08:20:00',
    'ru.wot.credits',
    'Credits',
    '1000000.00',
    'deposit',
    OV_FINANCE_CANARIES.orderId,
  ],
];

/**
 * One order row, in the export's twelve-column order.
 *
 * The three finance canaries go in the coupon, aggregator and package cells,
 * the all-zero uuid in the order id cell, and the amount canary in the amount
 * cell. The amount is the same string on every row, so a leak of any single
 * row is caught.
 */
function orderRow(actionDt: string): readonly string[] {
  return [
    actionDt,
    'WOT',
    '1',
    'USD',
    OV_ORDER_AMOUNT_CANARY,
    '0',
    OV_FINANCE_CANARIES.orderId,
    OV_FINANCE_CANARIES.coupon,
    'PAID',
    OV_FINANCE_CANARIES.aggregator,
    'premium',
    OV_FINANCE_CANARIES.package,
  ];
}

/** Root A's two order rows; root B carries the third. */
const ORDER_ROWS_A: readonly (readonly string[])[] = [
  orderRow('2020-04-11 12:00:00'),
  orderRow('2021-02-03 15:30:00'),
];

const ORDER_ROWS_B: readonly (readonly string[])[] = [orderRow('2021-07-19 09:45:00')];

// -----------------------------------------------------------------------------
// The rows that are written per root
// -----------------------------------------------------------------------------

/** Root A's `Account_Info` row: a distinct invented nickname per root. */
const ACCOUNT_INFO_ROW_A: readonly string[] = [
  OV_ROOT_A,
  OV_NICKNAME_A,
  '2019-11-02 09:15:00',
  'EU',
  OV_EMAIL_CANARY,
  '1988-04-17',
];

/** Root B's `Account_Info` row. */
const ACCOUNT_INFO_ROW_B: readonly string[] = [
  OV_ROOT_B,
  OV_NICKNAME_B,
  '2020-05-19 18:40:00',
  'NA',
  OV_EMAIL_CANARY,
  '1993-09-30',
];

/**
 * Root A's six World of Tanks sessions, in the export's DOTTED timestamp
 * shape (`DD.MM.YYYY HH:MM`, day first, no seconds, no zone).
 *
 * Their durations are 9,000 s, 2,700 s, 15,000 s, 3,600 s, 10,800 s and
 * 3,600 s. The fourth, fifth and sixth rows all fall on 10 March, and the
 * sixth OVERLAPS root B's first session by thirty minutes — so the union has
 * a real overlap to merge, and the busiest day has three sessions to add up.
 */
const WOT_SESSIONS_A: readonly (readonly string[])[] = [
  ['01.03.2020 20:00', '01.03.2020 22:30'],
  ['02.03.2020 21:00', '02.03.2020 21:45'],
  ['03.03.2020 19:30', '03.03.2020 23:40'],
  ['10.03.2020 08:00', '10.03.2020 09:00'],
  ['10.03.2020 12:00', '10.03.2020 15:00'],
  ['10.03.2020 20:00', '10.03.2020 21:00'],
];

/** Root A's one World of Tanks Blitz session: 3,600 s. */
const WOTB_SESSIONS_A: readonly (readonly string[])[] = [['01.03.2020 22:00', '01.03.2020 23:00']];

/**
 * Root B's two World of Tanks sessions, in the ISO shape with the `.000`
 * fraction the real export writes.
 *
 * The first (5,400 s) overlaps root A's sixth row by thirty minutes; the
 * second (3,600 s) is two years later and is the archive's last session.
 */
const WOT_SESSIONS_B: readonly (readonly string[])[] = [
  ['2020-03-10 20:30:00.000', '2020-03-10 22:00:00.000'],
  ['2021-06-05 18:00:00.000', '2021-06-05 19:00:00.000'],
];

// -----------------------------------------------------------------------------
// The builder
// -----------------------------------------------------------------------------

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * Render a session file.
 *
 * The header is bare and the cells are NOT quoted, exactly as the real export
 * writes a session file. The terminator is a parameter because the real
 * archive mixes them: root A's files are CRLF and root B's file is a bare CR.
 * A fixture that normalised the terminator would stop proving that the
 * importer reads both.
 */
function sessionCsv(rows: readonly (readonly string[])[], terminator: string): string {
  let out = `${SESSION_HEADER}${terminator}`;
  for (const row of rows) out += `${row[0]};${row[1]}${terminator}`;
  return out;
}

/**
 * Build the synthetic two-account Overview archive.
 *
 * The default archive carries every source, so it is the one the oracle
 * answers for. Each `omit` option removes exactly one source, so every absent
 * state the Overview must render is reachable from the same builder.
 */
export function buildOverviewInsightExport(options: OverviewFixtureOptions = {}): Uint8Array {
  const omit = new Set<OverviewOmit>(options.omit ?? []);
  const known = options.tanks === 'known';
  const hostile = options.tanks === 'hostile';

  /**
   * The tag of a slot, honouring the `tanks` option.
   *
   * The swap covers the first three slots only: `four` and `garage` stay
   * invented, because a real table has no row for them either and the
   * retired-tank path must survive the swap.
   */
  const tag = (slot: TankSlot): string => {
    if (hostile && slot === 'four') return OV_HOSTILE_TAG;
    if (!known) return OV_TAGS[slot];
    if (slot === 'one') return OV_KNOWN_TAGS.one;
    if (slot === 'two') return OV_KNOWN_TAGS.two;
    if (slot === 'three') return OV_KNOWN_TAGS.three;
    return OV_TAGS[slot];
  };

  const entries: Record<string, Uint8Array> = {};
  const add = (root: string, folder: string, name: string, text: string): void => {
    entries[`${root}/${folder}/${name}`] = encode(text);
  };

  for (const [root, infoRow, sessionRoot] of [
    [OV_ROOT_A, ACCOUNT_INFO_ROW_A, 'a'],
    [OV_ROOT_B, ACCOUNT_INFO_ROW_B, 'b'],
  ] as const) {
    // 1. Identity. The LOGIN cell carries the e-mail canary and the BIRTH_DATE
    //    cell a fabricated date; the worker strips both before the row is
    //    written, which is what makes the canary absent at rest.
    add(
      root,
      'User_info',
      'Account_Info.csv',
      `${ACCOUNT_INFO_HEADER}\r\n${infoRow.join(';')}\r\n`,
    );

    // 2. Sessions.
    if (!omit.has('sessions') && !omit.has('wot-sessions')) {
      add(
        root,
        'Activity_history',
        'WOT_Game_Sessions.csv',
        sessionCsv(
          sessionRoot === 'a' ? WOT_SESSIONS_A : WOT_SESSIONS_B,
          sessionRoot === 'a' ? '\r\n' : '\r',
        ),
      );
    }
    if (!omit.has('sessions') && sessionRoot === 'a') {
      add(root, 'Activity_history', 'WOTB_Game_Sessions.csv', sessionCsv(WOTB_SESSIONS_A, '\r\n'));
    }

    // 3. Account statistics.
    if (!omit.has('account-statistics')) {
      const noRecords = omit.has('record-columns');
      const header = noRecords ? ACCOUNT_STATS_HEADER_NO_RECORDS : ACCOUNT_STATS_HEADER;
      const row = sessionRoot === 'a' ? ACCOUNT_STATS_ROW_A : ACCOUNT_STATS_ROW_B;
      const cells = noRecords ? row.slice(0, 4) : row;
      add(root, 'Player_statistics', 'WOT_Account_Statistics.csv', renderStatsCsv(header, [cells]));
    }

    // 4. Vehicle statistics.
    if (!omit.has('vehicle-statistics')) {
      const rows = (sessionRoot === 'a' ? VEHICLE_STATS_ROWS_A : VEHICLE_STATS_ROWS_B).map(
        (row) => [tag(row[0] as TankSlot), ...row.slice(1)],
      );
      add(
        root,
        'Player_statistics',
        'WOT_Vehicle_Statistics.csv',
        renderStatsCsv(VEHICLE_STATS_HEADER, rows),
      );
    }

    // 5. Currency operations.
    if (!omit.has('currency')) {
      const rows = sessionRoot === 'a' ? CURRENCY_ROWS_A : CURRENCY_ROWS_B;
      add(
        root,
        'Financial_data',
        'Virtual_Currencies_Operations.csv',
        renderQuoteAllCsv(CURRENCY_OPS_HEADER, rows),
      );
    }

    // 6. Orders.
    if (!omit.has('orders')) {
      const rows = sessionRoot === 'a' ? ORDER_ROWS_A : ORDER_ROWS_B;
      add(root, 'Payment_history', 'Orders.csv', renderQuoteAllCsv(ORDERS_HEADER_12, rows));
    }

    // 7. The known-deferred folders, for root A only: the chat line and the
    //    clan name are counted by the importer and stored by neither.
    if (sessionRoot === 'a') {
      add(
        root,
        'Chat_history',
        'Messages.csv',
        `${CHAT_HEADER}\r\n2020-03-05 19:00:00;1;${OV_CHAT_CANARY}\r\n`,
      );
      add(
        root,
        'Clans',
        'Clan_membership.csv',
        `${CLAN_HEADER}\r\n7;${OV_CLAN_CANARY};2020-03-06 10:00:00;;member\r\n`,
      );
    }
  }

  return zipSync(entries);
}
