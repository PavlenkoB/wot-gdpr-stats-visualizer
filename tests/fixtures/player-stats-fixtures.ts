// =============================================================================
// The Player_statistics fixture module (phase 05, plan 05-02, Task 1).
//
// WHY THIS IS A MODULE AND NOT A SPEC
// The rows, the headers and every number derived from them are read by Node unit
// tests, by the worker round trip of plan 05-07, by the windowed table of plan
// 05-12 and by the browser specs of plan 05-16 and later. So they live here,
// once, in a plain module with no Vitest and no Playwright import and no side
// effect at load — the same contract `playtime-hand-fixture.ts`,
// `finance-fixtures.ts` and `sessions-fixtures.ts` already satisfy. It
// deliberately does not import the shared sample builder, so that builder is
// free to import THIS file without a cycle (and plan 05-01 established the same
// rule for `renderStatsCsv`, since both plans run in wave 1 and neither may
// depend on the other).
//
// IT HAS EXACTLY TWO IMPORTS, BOTH OF THEM DELIBERATE
// `mulberry32` from `sessions-fixtures.ts`, so there is ONE PRNG in the repo
// instead of a second copy that could drift from it, and `oracleDefaultOrder`
// from `tests/helpers/vehicle-oracle.ts`, so the scale spec's answer key is
// derived by the zero-import oracle rather than by the generator that produced
// the rows. The independence direction matters and is not symmetric: the ORACLE
// imports nothing at all, while this fixture is allowed to import the oracle.
// Nothing here imports anything from `src/`.
//
//
// DATA POLICY (see tests/fixtures/README.md, fixture=synthetic; T-05-04)
// Everything below is FABRICATED. No real export row is committed here, and
// nothing is ANONYMISED either — nothing real was ever read. Vehicle ids,
// battle counts and timestamps are invented; the account nickname is the canary
// `STATS_NAME_CANARY` rather than anything resembling a real one. A real sample
// zip must never be opened by this module.
//
// ONLY 16 OF THE REAL 47 COLUMNS
// `WOT_Vehicle_Statistics.csv` has 47 columns in the 2021 evidence. The research
// recorded the names of the columns Phase 5 READS, not all 47, so this fixture
// reproduces those plus `ACHIEVEMENTS` and `FRAGS` (the two columns with blank
// cells in the real sample) — sixteen in all. It is therefore not a byte copy
// of any real file, and a plan that needs one of the other 31 columns must add
// it here rather than guess it. The builder has to tolerate absent columns
// anyway (PROJECT.md's defensive-parsing constraint), so a short header is the
// shape that proves that tolerance rather than hiding it.
//
// WHY THE HOSTILE IDS ARE HERE
// Two of the six WoT rows carry ids that break naive code, and they are here so
// that plans 05-05, 05-07 and 05-12 have inputs whose tests can actually FAIL:
//
//   - `china:Ch99_<b>bold_markup` carries the unterminated `<b>` opener used by
//     `LONG_UNKNOWN_FOLDER` in the shared fixtures. It is a zip-derived string,
//     so it may only ever be interpolated as PLAIN TEXT.
//   - `__proto__` collides with `Object.prototype`, so it must stay an opaque
//     string and must never become an unquoted object key.
//
// Decisions: D-04 (real-shaped Player_statistics fixtures), D-06/D-07 (the file
// set), D-09 (special values), D-11 (nation-prefixed ids), D-12 (zero-battle
// vehicles are rows).
// =============================================================================

import { mulberry32 } from './sessions-fixtures.ts';
import { oracleDefaultOrder, type OracleVehicleRow } from '../helpers/vehicle-oracle.ts';

/**
 * The account nickname written into EVERY account file.
 *
 * Phase 3 D-21 confines the nickname to the identity header, so it must never
 * reach a vehicle view, a worker message, a DOM attribute or a DOM text node.
 * A distinctive single string is what makes that greppable: plans 05-05, 05-07
 * and 05-12 assert over the PARSED rows that this literal never appears.
 *
 * It is a canary, not a pseudonym — there is no real nickname behind it.
 */
export const STATS_NAME_CANARY = 'CANARY-ACCOUNT-NAME-9f3';

/**
 * One data cell: double-quoted, with any embedded `"` doubled.
 *
 * The export quotes every data cell, so a reader cannot be allowed to rely on
 * "only quote when needed". The CSV-standard doubling is the only escaping in
 * play, which is what makes an id containing a quote or a `<b>` round trip
 * through PapaParse unchanged.
 */
function quoteCell(cell: string): string {
  return `"${cell.replaceAll('"', '""')}"`;
}

/**
 * Write one fixture CSV in the export's own physical format.
 *
 *   - the header line is bare, NOT quoted;
 *   - every data cell is wrapped in `"` and cells are joined with `;`;
 *   - EVERY line, including the last, ends with a BARE CR.
 *
 * Why the bare CR matters: the payments-era files in a real export are written
 * with `\r` line endings and PapaParse's auto-detection handles them. A fixture
 * written with `\n` would pass while proving nothing about the file it stands
 * in for.
 *
 * The header may be given as the raw `;`-joined line (`WOT_MAIN_HEADER`, the
 * form the real file's header line has) or as a list of names, because a caller
 * holding the header constant does not have to re-split it to render a file.
 *
 * A row with FEWER cells than the header is padded with empty cells rather than
 * written ragged, so a header-keyed read never sees a column vanish. A row with
 * MORE cells is written as given: ragged rows are a real export quirk the
 * parser tolerates, and a fixture that hid the quirk would not be testing it.
 */
export function renderStatsCsv(
  header: string | readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const names = typeof header === 'string' ? header.split(';') : header;
  const lines: string[] = [names.join(';')];
  for (const row of rows) {
    const cells: string[] = [];
    for (let i = 0; i < names.length; i++) cells.push(quoteCell(row[i] ?? ''));
    lines.push(cells.join(';'));
  }
  return lines.map((line) => `${line}\r`).join('');
}

/**
 * `Player_statistics/WOT_Vehicle_Statistics.csv`'s header line, verbatim and in
 * the export's own column order — SIXTEEN of the real file's 47 columns.
 *
 * The five the core columns are computed from are `BATTLES_COUNT`,
 * `WINS_COUNT`, `DAMAGE_DEALT`, `FRAGS_COUNT` and `XP_AMOUNT`, keyed against
 * `VEHICLE_NAME`. The extras `SURVIVED_BATTLES` / `HITS_COUNT` / `SHOTS_COUNT`
 * (the survival and hit ratios), `FRAGS_MAX`, `XP_MAX`, `DAMAGE_RECEIVED` and
 * `SPOTTED_COUNT` are the row-expand fields, and `LAST_BATTLE_AT` is the last
 * battle column. `ACHIEVEMENTS` and `FRAGS` are the two columns the real sample
 * leaves blank; they are reproduced so a reader cannot conclude the export never
 * writes them.
 */
export const WOT_MAIN_HEADER =
  'VEHICLE_NAME;LAST_BATTLE_AT;BATTLES_COUNT;WINS_COUNT;DAMAGE_DEALT;FRAGS_COUNT;XP_AMOUNT;SURVIVED_BATTLES;HITS_COUNT;SHOTS_COUNT;FRAGS_MAX;XP_MAX;DAMAGE_RECEIVED;SPOTTED_COUNT;ACHIEVEMENTS;FRAGS';

/**
 * The six hand-written WoT vehicle rows.
 *
 * Every figure is invented. The row ORDER is file order, not sorted order — the
 * default sort (battles descending, ties by cleaned id ascending) is the oracle's
 * job and is recorded as an answer key in `PLAYER_STATS_EXPECTED`, so sorting
 * the rows here would quietly destroy the input the sort is checked against.
 *
 * The numbers were chosen so that every derived value is hand-checkable and the
 * awkward cases are all present:
 *
 *   - 162 battles in total, which is exactly what `WOT_Account_Statistics.csv`
 *     reports, so the reconciliation property the research recorded (the main
 *     file sums to the account total) actually holds;
 *   - 55/100, 15/40, 3/7, -, 6/12 and 1/3 — two terminating ratios, one
 *     repeating one (42.857...) and one repeating three (33.33...), so a
 *     two-decimal rounding rule cannot be satisfied by accident;
 *   - average damage 1200, 750, 714.28..., -, 750 and 500, including the
 *     tie at 750 that stops "sort by average damage" from accidentally matching
 *     the battles order;
 *   - one zero-battle garage-only vehicle (`ussr:R04_T-34`), which D-12 keeps as
 *     a visible row with its count.
 */
const WOT_MAIN_ROWS: readonly (readonly string[])[] = [
  [
    'china:Ch24_Type64',
    '2021-09-30 18:00:00',
    '100',
    '55',
    '120000',
    '150',
    '90000',
    '40',
    '800',
    '1000',
    '6',
    '2100',
    '90000',
    '120',
    '',
    '',
  ],
  [
    'usa:A12_T29',
    '2021-08-01 12:00:00',
    '40',
    '15',
    '30000',
    '30',
    '20000',
    '10',
    '300',
    '500',
    '4',
    '1500',
    '36000',
    '25',
    '',
    '',
  ],
  [
    'germany:G32_PzV_PzIV',
    '2020-05-05 09:00:00',
    '7',
    '3',
    '5000',
    '6',
    '3000',
    '2',
    '40',
    '60',
    '2',
    '900',
    '6000',
    '4',
    '',
    '',
  ],
  // Zero-battle garage-only vehicle: every count 0, no last battle, blank
  // ACHIEVEMENTS and FRAGS like every other row.
  ['ussr:R04_T-34', '', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '', ''],
  // Hostile id #1: an unterminated `<b>` opener (T-05-03). 12 battles, 6 wins.
  [
    'china:Ch99_<b>bold_markup',
    '2021-01-01 00:00:00',
    '12',
    '6',
    '9000',
    '10',
    '6000',
    '5',
    '70',
    '100',
    '3',
    '1100',
    '8000',
    '9',
    '',
    '',
  ],
  // Hostile id #2: collides with `Object.prototype` (T-05-03). 3 battles, 1 win.
  [
    '__proto__',
    '2021-02-02 00:00:00',
    '3',
    '1',
    '1500',
    '2',
    '900',
    '1',
    '10',
    '20',
    '1',
    '600',
    '2000',
    '1',
    '',
    '',
  ],
];

// =============================================================================
// THE REMAINING REAL-NAMED FILES (Task 2)
//
// Every header below is the export's own, verbatim and in its own column order,
// as recorded in the 2021 evidence. They differ PER TITLE for the same idea —
// WoT says `WINS_COUNT`, Blitz says `WINS`, Warplanes 19 says `GAMES_PLAYED`
// and Warplanes 20 says `BATTLES` — which is the whole reason the builder has
// to map columns by header name and tolerate an absent one.
//
// The row values are invented. What is NOT invented is the SHAPE: every figure
// that the research recorded as a property of the real export is reproduced
// here, so a builder that mishandles it fails here.
// =============================================================================

/** `WOT_Vehicle_Statistics_by_Type.csv` — FIFTEEN columns, `TYPE` second. */
const WOT_BY_TYPE_HEADER =
  'VEHICLE_NAME;TYPE;XP_AMOUNT;BATTLES_COUNT;WINS_COUNT;SURVIVED_BATTLES;FRAGS_COUNT;SHOTS_COUNT;HITS_COUNT;SPOTTED_COUNT;DAMAGE_DEALT;DAMAGE_RECEIVED;XP_MAX;FRAGS_MAX;DAMAGE_MAX';

/**
 * WoT by_Type rows.
 *
 * Three codes only — 1, 2 and 10 — against a Battle_Types summary that lists
 * five. That gap is the point: the battle-type select lists codes that HAVE
 * by_Type rows and the summary lists codes that do not, so a summary row with
 * no selectable option is expected rather than a bug. The 98 battles here are
 * deliberately far fewer than the 162 in the main file, because by_Type data
 * covers only part of a real export's battles.
 */
const WOT_BY_TYPE_ROWS: readonly (readonly string[])[] = [
  [
    'china:Ch24_Type64',
    '1',
    '54000',
    '60',
    '33',
    '24',
    '90',
    '600',
    '480',
    '72',
    '72000',
    '54000',
    '1600',
    '5',
    '3600',
  ],
  [
    'usa:A12_T29',
    '1',
    '10000',
    '20',
    '8',
    '4',
    '15',
    '250',
    '150',
    '12',
    '15000',
    '18000',
    '800',
    '3',
    '1800',
  ],
  [
    'china:Ch24_Type64',
    '2',
    '3000',
    '10',
    '5',
    '3',
    '8',
    '80',
    '60',
    '8',
    '9000',
    '6000',
    '700',
    '3',
    '1200',
  ],
  [
    'china:Ch24_Type64',
    '10',
    '1500',
    '5',
    '2',
    '1',
    '4',
    '40',
    '25',
    '4',
    '4500',
    '3500',
    '600',
    '2',
    '900',
  ],
  [
    'germany:G32_PzV_PzIV',
    '10',
    '1200',
    '3',
    '1',
    '0',
    '2',
    '25',
    '15',
    '2',
    '2100',
    '2500',
    '500',
    '2',
    '700',
  ],
];

/** `WOT_Battle_Types_Statistics.csv` — the per-code summary. */
const WOT_BATTLE_TYPES_HEADER = 'TYPE;BATTLES_COUNT;WINS_COUNT;DAMAGE_DEALT;XP_AMOUNT';

/**
 * Five codes — 1, 2, 10, 11 and 13 — with battles 80, 10, 8, 4 and 4.
 *
 * Codes 11 and 13 appear ONLY here. The 4/4 tie is deliberate too: it forces the
 * summary's tie-break (code ascending) to be a rule rather than a coincidence.
 */
const WOT_BATTLE_TYPES_ROWS: readonly (readonly string[])[] = [
  ['1', '80', '44', '96000', '72000'],
  ['2', '10', '5', '9000', '6000'],
  ['10', '8', '4', '7200', '4800'],
  ['11', '4', '2', '3000', '2000'],
  ['13', '4', '1', '2800', '1600'],
];

/**
 * `WOT_Account_Statistics.csv`.
 *
 * `BATTLES_COUNT` is 162, which is exactly the sum of the main file's six
 * rows — the reconciliation property the research recorded, and a cheap check
 * that a later builder cannot break by mis-mapping a column. `CREDITS`,
 * `GOLD`, `FREE_XP` and `PREMIUM_PLUS_EXPIRES_AT` are fabricated: they are real
 * columns no aggregation reads (balances are deferred by D-13 and the phase
 * CONTEXT), and writing blanks would suggest the export never writes them.
 *
 * `PREMIUM_EXPIRES_AT` is the Unix epoch, which D-13 shows AS WRITTEN — an
 * export artefact rather than a date to reformat.
 */
const WOT_ACCOUNT_HEADER =
  'NAME;CREDITS;GOLD;FREE_XP;BATTLES_COUNT;PREMIUM_EXPIRES_AT;PREMIUM_PLUS_EXPIRES_AT';

const WOT_ACCOUNT_ROWS: readonly (readonly string[])[] = [
  [
    STATS_NAME_CANARY,
    '250000',
    '1200',
    '45000',
    '162',
    '1970-01-01 00:00:00',
    '2021-12-24 18:00:00',
  ],
];

/** `WOTB_Vehicle_Statistics.csv` — Blitz drops the `_COUNT` suffixes. */
const WOTB_MAIN_HEADER =
  'VEHICLE_NAME;BATTLES_COUNT;WINS;DAMAGE_DEALT;FRAGS;XP;SURVIVED_BATTLES;HITS;SHOTS;MAX_FRAGS;MAX_XP;DAMAGE_RECEIVED;SPOTTED;LAST_BATTLE_TIME;IN_GARAGE';

/**
 * Blitz rows, 20 + 8 + 0 = 28 battles, which is the account total.
 *
 * Only ONE of the three ids carries a nation prefix. The research verified that
 * only WoT ids do, so this file deliberately mixes prefixed and unprefixed ids
 * and the split-on-first-colon rule has to survive both — an id with no colon
 * has no nation tag and is shown as written (D-11).
 */
const WOTB_MAIN_ROWS: readonly (readonly string[])[] = [
  [
    'blitz_alpha',
    '20',
    '12',
    '24000',
    '18',
    '15000',
    '6',
    '150',
    '200',
    '4',
    '1200',
    '27000',
    '20',
    '2021-07-07 07:07:07',
    '1',
  ],
  [
    'ussr:R12_Blitz',
    '8',
    '3',
    '6000',
    '6',
    '5000',
    '1',
    '60',
    '80',
    '2',
    '900',
    '8000',
    '6',
    '2021-06-06 06:06:06',
    '0',
  ],
  // Zero-battle garage-only vehicle with a blank last battle, like the WoT one.
  ['blitz_gamma', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '', '1'],
];

/** `WOTB_Vehicle_Statistics_by_Type.csv` — fourteen columns, no `XP_MAX`. */
const WOTB_BY_TYPE_HEADER =
  'VEHICLE_NAME;TYPE;XP;BATTLES_COUNT;WINS;SURVIVED_BATTLES;FRAGS;SHOTS;HITS;SPOTTED;DAMAGE_DEALT;DAMAGE_RECEIVED;MAX_XP;MAX_FRAGS';

const WOTB_BY_TYPE_ROWS: readonly (readonly string[])[] = [
  [
    'blitz_alpha',
    '1',
    '11000',
    '15',
    '9',
    '5',
    '14',
    '150',
    '110',
    '15',
    '18000',
    '20000',
    '1100',
    '4',
  ],
  ['ussr:R12_Blitz', '3', '2000', '2', '1', '1', '2', '20', '12', '2', '1500', '1800', '700', '2'],
];

/** `WOTB_Battle_Types_Statistics.csv` — four columns, as in WoT. */
const WOTB_BATTLE_TYPES_HEADER = 'TYPE;BATTLES_COUNT;WINS;DAMAGE_DEALT';

const WOTB_BATTLE_TYPES_ROWS: readonly (readonly string[])[] = [
  ['1', '17', '10', '20400'],
  ['3', '2', '1', '1500'],
];

/**
 * `WOTB_Account_Statistics.csv`.
 *
 * The premium expiry is `N/A`, the export's documented "not available". D-13
 * shows it AS WRITTEN and the UI-SPEC maps `N/A` to "not available", so this is
 * a value the header must render rather than a parse failure to swallow.
 */
const WOTB_ACCOUNT_HEADER = 'NAME;BATTLES_COUNT;PREMIUM_EXPIRY_TIME';

const WOTB_ACCOUNT_ROWS: readonly (readonly string[])[] = [[STATS_NAME_CANARY, '28', 'N/A']];

/**
 * `WOWS_Ship_Statistics.csv` — FIVE columns only.
 *
 * No wins, no damage, no frags, no XP: in a real Warships export those exist
 * only in the by_Type file. That absence is D-08's whole reason — the All
 * battles view shows battles, last battle and in-garage, and the win-rate and
 * average-damage cells read "available per battle type" rather than guessing.
 */
const WOWS_MAIN_HEADER = 'VEHICLE_NAME;IN_GARAGE;DISTANCE;LAST_BATTLE_TIME;BATTLES_COUNT';

const WOWS_MAIN_ROWS: readonly (readonly string[])[] = [
  ['PJSD001_Fake_Alpha', '1', '123.4', '2021-05-05 05:05:05', '7'],
  // Zero-battle ship, in the garage, no last battle. `DISTANCE` is written as a
  // plain decimal so a reader cannot assume integers throughout.
  ['PASD002_Fake_Beta', '1', '0', '', '0'],
  ['PJSC003_Fake_Gamma', '0', '45.6', '2021-04-04 04:04:04', '2'],
];

/** `WOWS_Ship_Statistics_by_Type.csv` — twelve columns. */
const WOWS_BY_TYPE_HEADER =
  'VEHICLE_NAME;TYPE;EXP;BATTLES_COUNT;WINS;SURVIVED;FRAGS;PLANES_KILLED;DAMAGE_DEALT;MAX_EXP;MAX_FRAGS;MAX_DAMAGE_DEALT';

/**
 * Warships by_Type rows: 7 + 7 + 2 + 2 = 18 battles against 9 real ones.
 *
 * EACH BATTLE IS COUNTED UNDER TWO BATTLE TYPES, so these rows add to exactly
 * twice the truth and per-ship rows must never be summed across types (D-08).
 * Two of the four rows share a ship, so a naive per-ship aggregation would
 * double Alpha's and Gamma's damage as well as their battles.
 */
const WOWS_BY_TYPE_ROWS: readonly (readonly string[])[] = [
  ['PJSD001_Fake_Alpha', '1', '40000', '7', '4', '3', '5', '1', '28000', '1500', '3', '4200'],
  ['PJSD001_Fake_Alpha', '2', '30000', '7', '4', '2', '4', '0', '21000', '1200', '2', '3600'],
  ['PJSC003_Fake_Gamma', '1', '8000', '2', '1', '1', '1', '0', '6000', '600', '1', '3000'],
  ['PJSC003_Fake_Gamma', '2', '6000', '2', '0', '0', '0', '0', '3000', '400', '0', '2000'],
];

/** `WOWS_Battle_Types_Statistics.csv` — also double-counted: 9 + 9 against 9. */
const WOWS_BATTLE_TYPES_HEADER = 'TYPE;BATTLES_COUNT;WINS;DAMAGE_DEALT';

const WOWS_BATTLE_TYPES_ROWS: readonly (readonly string[])[] = [
  ['1', '9', '5', '34000'],
  ['2', '9', '5', '24000'],
];

/** `WOWS_Account_Statistics.csv` — nine battles, a real fabricated expiry. */
const WOWS_ACCOUNT_HEADER = 'NAME;BATTLES_COUNT;PREMIUM_EXPIRY_TIME';

const WOWS_ACCOUNT_ROWS: readonly (readonly string[])[] = [
  [STATS_NAME_CANARY, '9', '2021-12-31 00:00:00'],
];

/** `WOWP_19_Plane_Statistics.csv` — the Warplanes 19 header, thirteen columns. */
const WOWP_19_MAIN_HEADER =
  'VEHICLE_NAME;GAMES_PLAYED;WINS;TOTAL_DAMAGE_DEALT;TOTAL_KILLED;GAIN_EXPERIENCE;SURVIVED;TOTAL_HITS;TOTAL_SHOTS;MAX_DAMAGE_DEALT;MAX_GAIN_EXPERIENCE;LAST_GAME_TIME;IN_GARAGE';

/**
 * Warplanes 19 rows: 0 + 4 + 0 = 4 games, two of the three planes on zero.
 *
 * `TOTAL_DAMAGE_DEALT` is `N/D` ("not defined", per the export's readme) on
 * EVERY row, including the one that has played four games. `MAX_DAMAGE_DEALT`
 * carries `N/D` too: it is the same undefined quantity, and writing a number
 * there would imply the export defines damage at all — which the `N/D` in the
 * row's total says it does not. D-09 requires both to display as "not defined"
 * and never as 0, and a reader that special-cased only the total column would
 * still be right on this data but wrong on a newer export.
 */
const WOWP_19_MAIN_ROWS: readonly (readonly string[])[] = [
  ['plane_fake_one', '0', '0', 'N/D', '0', '0', '0', '0', '0', 'N/D', '0', '', '1'],
  [
    'plane_fake_two',
    '4',
    '2',
    'N/D',
    '3',
    '2400',
    '1',
    '10',
    '20',
    'N/D',
    '900',
    '2021-02-02 02:02:02',
    '1',
  ],
  ['plane_fake_three', '0', '0', 'N/D', '0', '0', '0', '0', '0', 'N/D', '0', '', '1'],
];

/**
 * `WOWP_19_Account_Statistics.csv` — `GAMES_PLAYED`, NOT `BATTLES_COUNT`.
 *
 * RESEARCH Pitfall 9: with only `BATTLES_COUNT` the Warplanes per-title header
 * would always read "not in export", so the account header has to be looked up
 * with a spelling list.
 */
const WOWP_19_ACCOUNT_HEADER = 'NAME;GAMES_PLAYED;PREMIUM_EXPIRY_TIME';

const WOWP_19_ACCOUNT_ROWS: readonly (readonly string[])[] = [
  [STATS_NAME_CANARY, '4', '2021-01-01 00:00:00'],
];

/**
 * `WOWP_20_Plane_Statistics.csv` — THREE columns and NO vehicle identifier.
 *
 * There is nothing to put in a Vehicle cell, so D-09 makes this file a note, not
 * a table: four plane records with no names and eight battles in total.
 */
const WOWP_20_MAIN_HEADER = 'BATTLES;WINS;IN_GARAGE';

const WOWP_20_MAIN_ROWS: readonly (readonly string[])[] = [
  ['0', '0', '1'],
  ['2', '1', '1'],
  ['5', '3', '1'],
  ['1', '0', '0'],
];

/** `WOWP_20_Account_Statistics.csv` — `BATTLES` again, not `BATTLES_COUNT`. */
const WOWP_20_ACCOUNT_HEADER = 'NAME;BATTLES;PREMIUM_EXPIRY_TIME';

const WOWP_20_ACCOUNT_ROWS: readonly (readonly string[])[] = [
  [STATS_NAME_CANARY, '8', '2020-06-30 12:00:00'],
];

/** `WOT_Fallout_Vehicle_Statistics.csv` — recognised, counted, never shown. */
const WOT_FALLOUT_HEADER = 'VEHICLE_NAME;BATTLES_COUNT';

const WOT_FALLOUT_ROWS: readonly (readonly string[])[] = [['wot_fake_fallout_vehicle', '4']];

/** `WOWS_Crews.csv` — recognised, counted, never shown. */
const WOWS_CREWS_HEADER = 'CREW_ID;CREW_TITLE';

const WOWS_CREWS_ROWS: readonly (readonly string[])[] = [
  ['crew_fake_0001', 'Fake Commander Title'],
];

/** `WOWS_Account_Storage.csv` — recognised, counted, never shown. */
const WOWS_STORAGE_HEADER = 'ITEM_ID;ITEM_COUNT';

const WOWS_STORAGE_ROWS: readonly (readonly string[])[] = [['storage_fake_item_0001', '2']];

/**
 * The real-named Player_statistics files, file name to CSV text.
 *
 * NINETEEN files: four titles x four files, plus the three that are recognised
 * on import and never displayed (D-07). Keyed on the real file name INCLUDING
 * the `.csv` extension, because that is the string the worker matches on.
 */
export const PLAYER_STATS_SAMPLE_FILES: Readonly<Record<string, string>> = {
  'WOT_Vehicle_Statistics.csv': renderStatsCsv(WOT_MAIN_HEADER, WOT_MAIN_ROWS),
  'WOT_Vehicle_Statistics_by_Type.csv': renderStatsCsv(WOT_BY_TYPE_HEADER, WOT_BY_TYPE_ROWS),
  'WOT_Battle_Types_Statistics.csv': renderStatsCsv(WOT_BATTLE_TYPES_HEADER, WOT_BATTLE_TYPES_ROWS),
  'WOT_Account_Statistics.csv': renderStatsCsv(WOT_ACCOUNT_HEADER, WOT_ACCOUNT_ROWS),
  'WOTB_Vehicle_Statistics.csv': renderStatsCsv(WOTB_MAIN_HEADER, WOTB_MAIN_ROWS),
  'WOTB_Vehicle_Statistics_by_Type.csv': renderStatsCsv(WOTB_BY_TYPE_HEADER, WOTB_BY_TYPE_ROWS),
  'WOTB_Battle_Types_Statistics.csv': renderStatsCsv(
    WOTB_BATTLE_TYPES_HEADER,
    WOTB_BATTLE_TYPES_ROWS,
  ),
  'WOTB_Account_Statistics.csv': renderStatsCsv(WOTB_ACCOUNT_HEADER, WOTB_ACCOUNT_ROWS),
  'WOWS_Ship_Statistics.csv': renderStatsCsv(WOWS_MAIN_HEADER, WOWS_MAIN_ROWS),
  'WOWS_Ship_Statistics_by_Type.csv': renderStatsCsv(WOWS_BY_TYPE_HEADER, WOWS_BY_TYPE_ROWS),
  'WOWS_Battle_Types_Statistics.csv': renderStatsCsv(
    WOWS_BATTLE_TYPES_HEADER,
    WOWS_BATTLE_TYPES_ROWS,
  ),
  'WOWS_Account_Statistics.csv': renderStatsCsv(WOWS_ACCOUNT_HEADER, WOWS_ACCOUNT_ROWS),
  'WOWP_19_Plane_Statistics.csv': renderStatsCsv(WOWP_19_MAIN_HEADER, WOWP_19_MAIN_ROWS),
  'WOWP_19_Account_Statistics.csv': renderStatsCsv(WOWP_19_ACCOUNT_HEADER, WOWP_19_ACCOUNT_ROWS),
  'WOWP_20_Plane_Statistics.csv': renderStatsCsv(WOWP_20_MAIN_HEADER, WOWP_20_MAIN_ROWS),
  'WOWP_20_Account_Statistics.csv': renderStatsCsv(WOWP_20_ACCOUNT_HEADER, WOWP_20_ACCOUNT_ROWS),
  'WOT_Fallout_Vehicle_Statistics.csv': renderStatsCsv(WOT_FALLOUT_HEADER, WOT_FALLOUT_ROWS),
  'WOWS_Crews.csv': renderStatsCsv(WOWS_CREWS_HEADER, WOWS_CREWS_ROWS),
  'WOWS_Account_Storage.csv': renderStatsCsv(WOWS_STORAGE_HEADER, WOWS_STORAGE_ROWS),
};

/**
 * Every data row across all nineteen files: 47.
 *
 * Derived, not guessed: 17 WoT (6 main + 5 by_Type + 5 Battle_Types + 1
 * account) + 8 Blitz (3 + 2 + 2 + 1) + 10 Warships (3 + 4 + 2 + 1) + 9
 * Warplanes (3 + 1 + 4 + 1) + 3 recognised-not-displayed (one each).
 *
 * The three never-displayed files are counted here but NOT in any title's
 * `totalRows`, because they belong to no title's table — a Fallout vehicle is
 * not a WoT vehicle.
 */
export const PLAYER_STATS_SAMPLE_ROW_COUNT = 47;

/**
 * The hand-derived answer key for the whole file set.
 *
 * Every number below is DERIVED BY HAND from the rows above, with the
 * arithmetic in the comment beside it, and
 * `tests/unit/player-stats-fixtures.test.ts` recomputes every one of them with
 * the INDEPENDENT oracle in `tests/helpers/vehicle-oracle.ts` — which imports
 * nothing at all, shares no ratio rule, no sort comparator and no code ordering
 * with any implementation. A wrong hand number therefore fails in Node in
 * seconds rather than in a browser run hours later. Plans 05-05 (the builder),
 * 05-07 (the worker round trip), 05-12 (the windowed table) and 05-16 (the
 * scale spec) import these SAME names and must not rename them.
 *
 * `totalRows` is the per-title file total; `vehicleRows` is the count of rows in
 * the MAIN per-vehicle file, which is the "All battles" table D-06 names.
 */
export const PLAYER_STATS_EXPECTED = {
  /**
   * Per-file row counts, keyed on the real file name. Each is a hand count of
   * the row array above it, and the test asserts each one against the PRODUCTION
   * parser rather than against this object.
   */
  rowCountsByFile: {
    'WOT_Vehicle_Statistics.csv': 6, // six hand rows
    'WOT_Vehicle_Statistics_by_Type.csv': 5, // 2 under TYPE 1, 1 under 2, 2 under 10
    'WOT_Battle_Types_Statistics.csv': 5, // codes 1, 2, 10, 11, 13
    'WOT_Account_Statistics.csv': 1,
    'WOTB_Vehicle_Statistics.csv': 3,
    'WOTB_Vehicle_Statistics_by_Type.csv': 2, // codes 1 and 3
    'WOTB_Battle_Types_Statistics.csv': 2, // codes 1 and 3
    'WOTB_Account_Statistics.csv': 1,
    'WOWS_Ship_Statistics.csv': 3,
    'WOWS_Ship_Statistics_by_Type.csv': 4, // two ships x two types: the double count
    'WOWS_Battle_Types_Statistics.csv': 2,
    'WOWS_Account_Statistics.csv': 1,
    'WOWP_19_Plane_Statistics.csv': 3,
    'WOWP_19_Account_Statistics.csv': 1,
    'WOWP_20_Plane_Statistics.csv': 4,
    'WOWP_20_Account_Statistics.csv': 1,
    'WOT_Fallout_Vehicle_Statistics.csv': 1,
    'WOWS_Crews.csv': 1,
    'WOWS_Account_Storage.csv': 1,
  },

  titles: {
    wot: {
      totalRows: 17, // 6 + 5 + 5 + 1
      vehicleRows: 6,
      battlesSum: 162, // 100 + 40 + 7 + 0 + 12 + 3, and it equals the account's 162
      zeroBattleCount: 1, // ussr:R04_T-34
      byTypeCodes: ['1', '2', '10'], // NUMERIC order; string order would be 1, 10, 2
      summaryCodes: ['1', '2', '10', '11', '13'], // 80, 10, 8, then the 4/4 tie by code
    },
    blitz: {
      totalRows: 8, // 3 + 2 + 2 + 1
      vehicleRows: 3,
      battlesSum: 28, // 20 + 8 + 0, and it equals the account's 28
      zeroBattleCount: 1, // blitz_gamma
      byTypeCodes: ['1', '3'],
      summaryCodes: ['1', '3'], // 17 then 2
    },
    warships: {
      totalRows: 10, // 3 + 4 + 2 + 1
      vehicleRows: 3,
      battlesSum: 9, // 7 + 0 + 2, and it equals the account's 9
      zeroBattleCount: 1, // PASD002_Fake_Beta
      byTypeCodes: ['1', '2'],
      summaryCodes: ['1', '2'], // 9 and 9 — a tie, resolved by code ascending
      // by_Type adds to 18, exactly twice 9: every Warships battle is counted
      // under two types, so per-ship rows cannot be summed across them (D-08).
      byTypeBattlesSum: 18,
    },
    warplanes: {
      totalRows: 9, // 3 + 1 + 4 + 1
      vehicleRows: 3, // the named WOWP_19 planes; WOWP_20 has no names at all
      battlesSum: 4, // 0 + 4 + 0 from WOWP_19, which is the account's GAMES_PLAYED
      zeroBattleCount: 2, // plane_fake_one and plane_fake_three
      // No by_Type file exists for Warplanes, so the battle-type control is not
      // rendered at all (UI-SPEC section 3) and neither is the summary.
      byTypeCodes: [] as string[],
      summaryCodes: [] as string[],
    },
  },

  /**
   * The three files D-07 says are recognised and counted on import but never
   * displayed. One row each, and belonging to no title's table.
   */
  recognisedNotDisplayed: {
    totalRows: 3,
    files: ['WOT_Fallout_Vehicle_Statistics.csv', 'WOWS_Crews.csv', 'WOWS_Account_Storage.csv'],
  },

  /**
   * The Warplanes 20 note's two figures (D-09): four plane records with no names
   * in the export, recording eight battles in total — 0 + 2 + 5 + 1. This is
   * deliberately NOT the Warplanes title's `battlesSum` of 4, which is the
   * WOWP_19 total: the two files describe different planes and must not be
   * added or reconciled.
   */
  warplanes20: {
    records: 4,
    battles: 8,
  },

  /**
   * The hand-derived WoT numbers, keyed by vehicle id IN FILE ORDER.
   *
   * `winRatePercent` is `oracleRatio(WINS_COUNT, BATTLES_COUNT)` — that is,
   * `(wins / battles) * 100` as the oracle computes it. Two of the five figures
   * are NOT the mathematical value, because the multiply by 100 is a real float
   * operation:
   *
   *   china:Ch24_Type64       55 of 100 -> 55.00000000000001, not 55
   *   usa:A12_T29             15 of  40 -> 37.5 exactly
   *   germany:G32_PzV_PzIV     3 of   7 -> 42.857142857142854 (repeating)
   *   ussr:R04_T-34            0 of   0 -> 'dash', never 0% (D-09)
   *   china:Ch99_<b>bold_markup 6 of  12 -> 50 exactly
   *   __proto__                1 of   3 -> 33.33333333333333 (repeating)
   *
   * `averageDamage` is the same ratio scaled back down by 100 — an average, not
   * a percent — so it holds the mathematical values, because dividing the
   * product by 100 returns exactly `damage / battles` for every figure here:
   *
   *   120000 / 100 = 1200,  30000 / 40 = 750,  5000 / 7 = 714.2857142857143,
   *   0 / 0 = 'dash',      9000 / 12 = 750,  1500 / 3 = 500
   *
   * Note the tie at 750: average damage does NOT reproduce the battles order, so
   * a table sorted by one and accidentally sorted by the other would be caught
   * rather than looking plausible.
   *
   * `defaultOrderIds` is D-12's sort — battles descending, ties by cleaned id
   * ascending in code-unit order — over all six rows, including the zero-battle
   * one, which sorts last rather than being filtered out:
   *   100 china:Ch24_Type64, 40 usa:A12_T29, 12 china:Ch99_<b>bold_markup,
   *   7 germany:G32_PzV_PzIV, 3 __proto__, 0 ussr:R04_T-34.
   */
  wotHandDerived: {
    // BOTH maps below are built with `Object.fromEntries` rather than as object
    // literals, and that is load bearing rather than stylistic. One of the six
    // keys is `__proto__`, and `{'__proto__': 500}` in a literal does NOT create
    // a property named `__proto__` — it assigns the prototype, and a primitive
    // there is silently ignored, so the key VANISHES and a lookup returns
    // `Object.prototype` instead of 500. `Object.fromEntries` defines own data
    // properties, so the hostile id survives as an ordinary key.
    //
    // This is the same collision 05-01 flagged at
    // `src/lib/worker/csv-parse.ts:79` (`fixed[k] = v` drops a column NAME
    // literally called `__proto__`), met from the other side: an app that groups
    // vehicles into a plain object loses this row in exactly the same way, which
    // is why plan 05-05 is told to group with `Map`.
    winRatePercent: Object.fromEntries([
      ['china:Ch24_Type64', 55.00000000000001],
      ['usa:A12_T29', 37.5],
      ['germany:G32_PzV_PzIV', 42.857142857142854],
      ['ussr:R04_T-34', 'dash'],
      ['china:Ch99_<b>bold_markup', 50],
      ['__proto__', 33.33333333333333],
    ]),
    averageDamage: Object.fromEntries([
      ['china:Ch24_Type64', 1200],
      ['usa:A12_T29', 750],
      ['germany:G32_PzV_PzIV', 714.2857142857143],
      ['ussr:R04_T-34', 'dash'],
      ['china:Ch99_<b>bold_markup', 750],
      ['__proto__', 500],
    ]),
    defaultOrderIds: [
      'china:Ch24_Type64',
      'usa:A12_T29',
      'china:Ch99_<b>bold_markup',
      'germany:G32_PzV_PzIV',
      '__proto__',
      'ussr:R04_T-34',
    ],
  },
} as const;

// =============================================================================
// THE SEEDED SCALE GENERATOR (Task 3)
//
// WHY A GENERATOR AND NOT MORE HAND ROWS
// UI-SPEC section 15 puts hard counts on a 5,000-vehicle fixture — at most 30
// rendered rows, an `aria-rowcount` of 5,001, and a first row that holds the
// largest battle count — and plan 05-16 has to check them. Five thousand hand
// written rows would prove nothing extra and could not be reviewed, so the file
// is generated from a seed instead.
//
// DETERMINISM IS PER SPEC VERSION
// Every figure is drawn from `mulberry32(spec.seed)`, taken from
// `sessions-fixtures.ts` rather than copied, so the same spec produces
// byte-identical CSV. No `Date.now`, no `Math.random`, no iteration over a `Set`
// whose insertion order carries meaning. The consequence is deliberate and
// worth stating plainly: EDITING ANY DRAW IN THIS SECTION REGENERATES EVERY BYTE
// AND INVALIDATES THE DERIVED ANSWER KEY below. That is the point — a fixture
// that drifts silently is worse than no fixture — but it means a change here
// must be a single atomic commit that updates the generator AND the key AND the
// tests together.
//
// WHY THE ANSWER KEY IS THE ORACLE'S, NOT A CLOSED FORM
// Only ONE figure here has a formula: the zero-battle count, because it is
// positional — every twentieth vehicle is on zero, so 5,000 / 20 = 250. The
// largest battle count and the first row's id come out of a seeded draw, and a
// draw has no formula beyond the generator that made it. So those come from
// `oracleDefaultOrder`, which imports nothing and shares no comparator with any
// implementation, and the test recomputes them a THIRD time from the parsed rows.
// A number frozen into this file by hand would be a snapshot, and a snapshot of
// today's draw is exactly the kind of constant nobody can later check.
// =============================================================================

/**
 * The eight nation tokens the generated ids cycle through.
 *
 * Eight real WoT nation prefixes, applied on a plain index cycle rather than a
 * random draw so the ids stay evenly spread and the RNG stream is untouched by
 * them. Only the INDEX is generated here: an id is always `nation:V<index>Tank`,
 * so the index alone makes it unique.
 */
const SCALE_NATIONS: readonly string[] = [
  'china',
  'usa',
  'germany',
  'ussr',
  'france',
  'japan',
  'ukraine',
  'sweden',
];

/** The window the generated last-battle timestamps are drawn from. */
const SCALE_FIRST_YEAR = 2013;
const SCALE_LAST_YEAR = 2021;

/** Every twentieth generated vehicle is the garage-only, zero-battle one. */
const SCALE_ZERO_BATTLE_EVERY = 20;

/** Zero-pad a number to two digits, for the timestamp fields. */
function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * The inputs of a generated vehicle file. Deliberately two numbers and nothing
 * else: every knob that could make the answer key unfalsifiable stays out, and a
 * spec whose meaning is not obvious from its two fields cannot be reviewed.
 */
export interface VehicleScaleSpec {
  /** The 32-bit seed handed to `mulberry32`. */
  seed: number;
  /** How many data rows to write. */
  count: number;
}

/**
 * Generate a `WOT_Vehicle_Statistics.csv`-shaped file with `spec.count` rows.
 *
 * The output goes through `renderStatsCsv` with `WOT_MAIN_HEADER`, so the
 * generated file is byte-shaped exactly like the six hand rows above and a
 * parser cannot tell the two apart — which is the point: plan 05-16 exercises
 * windowing on the same physical format the hand fixture teaches the builder.
 *
 * EVERY COUNT IS INSIDE ITS OWN ROW. Wins never exceed battles, survived never
 * exceeds wins, hits never exceed shots, and damage, XP and frags are bounded by
 * multiples of the battle count. A generated row that contradicted itself would
 * make an average damage of -1,200 possible, and a table would then be asked to
 * display nonsense produced by the FIXTURE rather than by a bug it is meant to
 * catch.
 */
export function generateVehicleMainCsv(spec: VehicleScaleSpec): string {
  const rand = mulberry32(spec.seed);
  // Wide enough for the largest index this spec can produce, so ids stay a
  // uniform width at any count; four digits is the floor, which is what the
  // 5,000-vehicle spec needs.
  const idWidth = Math.max(4, String(Math.max(0, spec.count - 1)).length);
  const rows: string[][] = [];

  for (let i = 0; i < spec.count; i++) {
    const nation = SCALE_NATIONS[i % SCALE_NATIONS.length]!;
    const id = `${nation}:V${String(i).padStart(idWidth, '0')}Tank`;

    // The zero-battle vehicle. Every draw is SKIPPED rather than made and
    // discarded, so the RNG stream position is a pure function of the spec and
    // not of how many branches happened to run.
    if (i % SCALE_ZERO_BATTLE_EVERY === 0) {
      rows.push([id, '', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '', '']);
      continue;
    }

    // 1 .. 3,000 battles: never zero here, because zero is the positional case
    // above and the two must not overlap.
    const battles = 1 + Math.floor(rand() * 3000);
    // floor(rand() * (battles + 1)) is 0 .. battles INCLUSIVE, so a win rate can
    // legitimately reach 100%.
    const wins = Math.floor(rand() * (battles + 1));
    const survived = Math.floor(rand() * (wins + 1));
    const shots = Math.floor(rand() * (battles * 20 + 1));
    const hits = Math.floor(rand() * (shots + 1));
    const spotted = Math.floor(rand() * (battles * 3 + 1));
    const frags = Math.floor(rand() * (battles * 3 + 1));
    const damageReceived = Math.floor(rand() * (battles * 2500 + 1));
    const damageDealt = Math.floor(rand() * (battles * 2000 + 1));
    const xpAmount = Math.floor(rand() * (battles * 1200 + 1));
    // Capped by the row's own totals, so a best-of can never exceed the sum.
    const fragsMax = Math.min(frags, 1 + Math.floor(rand() * 10));
    const xpMax = 1 + Math.floor(rand() * 2500);
    // Day 1..28 only: every month of every year in the window then has a real
    // day, so the file can never contain a date that does not exist and a
    // reader is not forced to reason about month lengths.
    const year = SCALE_FIRST_YEAR + Math.floor(rand() * (SCALE_LAST_YEAR - SCALE_FIRST_YEAR + 1));
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    const hour = Math.floor(rand() * 24);
    const minute = Math.floor(rand() * 60);
    const second = Math.floor(rand() * 60);

    rows.push([
      id,
      `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
      String(battles),
      String(wins),
      String(damageDealt),
      String(frags),
      String(xpAmount),
      String(survived),
      String(hits),
      String(shots),
      String(fragsMax),
      String(xpMax),
      String(damageReceived),
      String(spotted),
      '',
      '',
    ]);
  }

  return renderStatsCsv(WOT_MAIN_HEADER, rows);
}

/**
 * The 5,000-vehicle scale spec, for the windowing and scale specs.
 *
 * The seed is an arbitrary constant and nothing else depends on it — change it
 * and every byte of the generated file changes with it, which is the intended
 * behaviour and the reason the answer key below is the oracle's.
 */
export const VEHICLE_SCALE_5K_SPEC: VehicleScaleSpec = { seed: 987_654_321, count: 5_000 };

/**
 * Read one quote-all, semicolon-separated data line back into header-keyed cells.
 *
 * A PLAIN SPLIT, deliberately. `vehicleScaleExpected` must not import PapaParse,
 * because the point of this function is to be a SECOND, independent read of the
 * same bytes: if the renderer and the reader were the same code, a quoting bug
 * would cancel out on both sides and the key would be derived from the bug.
 */
function readQuoteAllLine(header: readonly string[], line: string): OracleVehicleRow {
  const values = line.split(';');
  const row: Record<string, string> = {};
  header.forEach((name, index) => {
    const raw = values[index] ?? '';
    const unquoted =
      raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    row[name] = unquoted.replaceAll('""', '"');
  });
  return row;
}

/** D-11: the text after the first colon, or the whole cell when there is none. */
function cleanVehicleId(raw: string): string {
  const colon = raw.indexOf(':');
  return colon === -1 ? raw : raw.slice(colon + 1);
}

/** What `vehicleScaleExpected` reports for a spec. */
export interface VehicleScaleExpected {
  /** Data rows in the generated file. */
  rowCount: number;
  /** Rows whose battle count is zero — the every-twentieth vehicles. */
  zeroBattleCount: number;
  /** The largest battle count anywhere in the file. */
  largestBattles: number;
  /** The first vehicle id under the default order. */
  firstRowId: string;
  /**
   * The first three ids under the default order.
   *
   * Fewer than three when the spec has fewer than three rows, which is stated
   * rather than padded so a small spec cannot look like a three-row answer.
   */
  firstThreeIds: string[];
  /**
   * The first row's CLEANED id — the part after the first colon, D-11.
   *
   * A second field rather than a slice of {@link firstRowId}, because the two
   * are not the same string: the table draws the nation as a separate chip and
   * the id as its own text, so a browser spec asserts them separately and a
   * reader wanting the cell's own text wants the CLEANED one. The tie-break
   * this is ordered by is the cleaned id, not the raw `nation:Name`, because
   * that is what D-12 says and what the table does.
   */
  firstRowCleanId: string;
}

/**
 * The answer key for a generated spec, derived from the generated rows.
 *
 * The ordering comes from `oracleDefaultOrder`, the zero-import oracle, so this
 * is not the generator agreeing with itself. `tests/unit/player-stats-fixtures
 * .test.ts` then recomputes every field a THIRD time from the rows as the
 * PRODUCTION parser reads them, which is what catches a renderer/reader
 * disagreement rather than merely a wrong constant.
 */
export function vehicleScaleExpected(spec: VehicleScaleSpec): VehicleScaleExpected {
  const text = generateVehicleMainCsv(spec);
  const lines = text.split('\r');
  const header = lines[0]!.split(';');

  const rows: OracleVehicleRow[] = [];
  // Start at 1 to skip the header line, and skip the empty element the trailing
  // terminator leaves behind — the same off-by-one 05-01's 50k generator hit.
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line === '') continue;
    rows.push(readQuoteAllLine(header, line));
  }

  const battlesOf = (row: OracleVehicleRow): number => Number(row['BATTLES_COUNT'] ?? '0');

  /**
   * The first row under D-12's tie-break, which is the CLEANED id.
   *
   * `oracleDefaultOrder` above breaks ties on the id column it is given, and
   * the default is `VEHICLE_NAME` — the `nation:Name` the export wrote. D-12
   * says the table breaks ties on the CLEANED id, the part after the colon,
   * and the two are different strings: with 5,000 rows the top battle count is
   * a tie, and `ussr:V1467Tank` and `sweden:V4655Tank` are not the same key.
   *
   * So the SAME oracle is asked again, over the same rows, with a `CLEAN_ID`
   * column it can order by. The only thing written here is the colon split
   * itself — D-11's rule, one line — and the ordering, the comparison and the
   * "largest wins" rule stay in `tests/helpers/vehicle-oracle.ts`, which
   * imports nothing at all.
   */
  const byCleanId = oracleDefaultOrder(
    rows.map((row) => ({ ...row, CLEAN_ID: cleanVehicleId(row['VEHICLE_NAME'] ?? '') })),
    'CLEAN_ID',
  );
  const ordered = oracleDefaultOrder(rows);

  return {
    rowCount: rows.length,
    zeroBattleCount: rows.filter((row) => battlesOf(row) === 0).length,
    largestBattles: rows.reduce((largest, row) => Math.max(largest, battlesOf(row)), 0),
    firstRowId: ordered[0] ?? '',
    firstThreeIds: ordered.slice(0, 3),
    // The oracle's own answer over the `CLEAN_ID` column: the cleaned id of
    // whichever row has the largest battle count, ties broken by that id.
    firstRowCleanId: byCleanId[0] ?? '',
  };
}
