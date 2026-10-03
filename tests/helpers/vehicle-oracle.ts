// =============================================================================
// The vehicle oracle (phase 05, plan 05-02, Task 2).
//
// WHY THIS FILE EXISTS
// The vehicle tables of plans 05-05 (the builder), 05-12 (the windowed table)
// and 05-16 (the scale spec) are checked against hand fixtures. A hand fixture
// checked only against the implementation that reads it proves nothing, because
// both sides can be wrong in the same direction. So this module recomputes
// every derived vehicle answer from the RAW rows with logic of its own, and
// `tests/unit/player-stats-fixtures.test.ts` compares the fixture to THIS,
// never to itself.
//
// ORACLE INDEPENDENCE — the hard rule
// This file has ZERO import statements. Not "no import from `src/`" — no
// imports at all, not even of a type. It shares no ratio rule, no sort
// comparator, no code ordering and no CSV reader with the code it checks, and
// it does not import the fixtures it checks. The two sides are deliberately
// written in different shapes:
//
//   ratio    here: raw cell STRINGS in, `Number` arithmetic out, with the
//            special values decided by string equality BEFORE any parse. The
//            export writes `N/D` ("not defined"), `N/A` ("not available"),
//            `F`/`T` for booleans and a blank for "this export has nothing
//            here" — four different things, none of which is a zero.
//            the app: the vehicle builder's own column mapping and helpers.
//   order    here: an explicit comparator over `{id, battles, usable}` tuples
//            using `<` and `>` on strings, which IS plain code-unit order.
//   codes    here: distinct codes collected into a plain array and sorted with
//            an integer-vs-code-unit comparator.
//
// NO `localeCompare`, ANYWHERE
// Two viewers in two locales must agree on one order, so every string
// comparison here is the JavaScript relational operator on strings — code-unit
// order — and never a locale collation. The Phase 4 rule applies to the vehicle
// table too, and an oracle that used `localeCompare` could not tell an app that
// had.
//
// NO FORMATTING
// This module returns NUMBERS and the four special-value strings. It never
// renders "55.3%", never rounds and never groups: display formatting is the
// app's `ui-copy` (D-25), so an answer key that formatted its own numbers would
// be asserting the wrong thing.
//
// A MISSING CELL IS NOT A BLANK CELL
// `Record` lookups yield `undefined` for an absent column and `''` for a cell
// the export wrote empty, and they mean different things here: an absent column
// means the export does not have that field (`not in export`), an empty cell
// means it has the field and the value is unusable (`not available`).
//
// Decisions: D-08 (Warships per-battle-type values), D-09 (N/D and N/A are
// never 0), D-10 (derived win rate and average damage), D-11 (nation-prefixed
// ids), D-12 (default sort, zero-battle rows included), D-07 (battle-type
// codes), D-25 (no formatting here).
// =============================================================================

/**
 * One raw row of a Player_statistics file, as a header-keyed map of cells.
 *
 * A `Record` rather than a tuple, because the four titles have different
 * headers AND different column names for the same idea (`BATTLES_COUNT` for
 * WoT and Blitz, `GAMES_PLAYED` for Warplanes 19, `BATTLES` for Warplanes 20).
 * A cell may be missing entirely — an absent column is a real export quirk, and
 * PROJECT.md's defensive-parsing rule requires every read to tolerate it.
 */
export type OracleVehicleRow = Readonly<Record<string, string | undefined>>;

/**
 * A cell read defensively: a missing key and an empty cell are one thing.
 *
 * Only safe where the two genuinely mean the same thing (an id, a code read for
 * sorting). It is deliberately NOT used by `oracleRatio`, which distinguishes
 * them.
 */
function cell(row: OracleVehicleRow, name: string): string {
  return row[name] ?? '';
}

/** A cell value that is not a number but still has to be displayable. */
export type OracleSpecial = 'dash' | 'nd' | 'na' | 'missing';

/** What a derived ratio can be: a number, or one of four special values. */
export type OracleRatioValue = number | OracleSpecial;

/** The export's "not defined" spelling, compared case-insensitively. */
const NOT_DEFINED = 'N/D';

/** The export's "not available" spelling, compared case-insensitively. */
const NOT_AVAILABLE = 'N/A';

/**
 * Parse a raw cell as a finite number, or null when it is not one.
 *
 * `Number('')` is 0 and `Number(' 12 ')` is 12, both of which are traps: a
 * blank cell must never read as a zero, so blankness is rejected before the
 * parse. `Number.isFinite` rejects `Infinity` and `NaN`.
 */
function finiteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * The derived ratio of two raw cells: a win rate, an average, a hit ratio.
 *
 * The decision order is the whole contract, and it matters: the special values
 * are recognised as STRINGS before anything is parsed, because the export's
 * `N/D` and `N/A` are not malformed numbers that should read as 0 — they are
 * documented abbreviations meaning "not defined" and "not available", and D-09
 * forbids displaying either as 0 or counting either as 0 in a sort.
 *
 *   1. either side is `undefined` (the column is absent)  -> 'missing'
 *   2. either side is `N/D`                               -> 'nd'
 *   3. either side is `N/A`, blank, or unparseable         -> 'na'
 *   4. the denominator parses to zero                      -> 'dash'
 *   5. otherwise, `(numerator / denominator) * 100`
 *
 * Rule 1 comes before rule 2 and 3 so that an absent column reports itself
 * rather than borrowing the absent cell's spelling. Rule 4 comes after them so
 * that `N/D` over zero battles is 'nd', not 'dash'.
 *
 * WHY THE RESULT IS SCALED BY 100
 * The callers in this phase are percent-shaped: a win rate is wins ÷ battles
 * and is displayed with a `%`. Scaling here means the caller reads one number
 * for a percentage and divides it again for an absolute quantity — an average
 * damage is `oracleRatio(damage, battles) / 100`. Two consequences are load
 * bearing and are asserted in the test rather than left implicit:
 *
 *   - the multiply is a real float operation, so `(55 / 100) * 100` is
 *     `55.00000000000001` and NOT `55`. An answer key that recorded the
 *     mathematical value would disagree with the oracle for the wrong reason;
 *     the key records the product, and the arithmetic is shown beside it.
 *   - `Number` is exact below 2^53 = 9.007e15, and the largest quantity this
 *     phase divides is a generated 5,000-vehicle file's per-vehicle total, so
 *     no integer overflow is reachable here.
 */
export function oracleRatio(
  numerator: string | undefined,
  denominator: string | undefined,
): OracleRatioValue {
  // Rule 1: an absent column, on either side.
  if (numerator === undefined || denominator === undefined) return 'missing';

  const sides = [numerator, denominator];

  // Rule 2: the export's documented "not defined".
  for (const side of sides) {
    if (side.trim().toUpperCase() === NOT_DEFINED) return 'nd';
  }

  // Rule 3: "not available", blank, and anything that is not a finite number.
  for (const side of sides) {
    if (side.trim().toUpperCase() === NOT_AVAILABLE) return 'na';
  }
  const top = finiteNumber(numerator);
  if (top === null) return 'na';
  const bottom = finiteNumber(denominator);
  if (bottom === null) return 'na';

  // Rule 4: nothing to divide by. A win rate over zero battles is a dash, not
  // 0% — D-09.
  if (bottom === 0) return 'dash';

  // Rule 5: the plain quotient, scaled for a percent caller.
  return (top / bottom) * 100;
}

/** A row reduced to what the default order actually compares. */
interface OrderedRow {
  id: string;
  battles: number;
  /** False when the battles cell is absent, blank, `N/D`, `N/A` or unparseable. */
  usable: boolean;
}

/**
 * Plain code-unit string comparison — `<` on two strings, never `localeCompare`.
 *
 * Spelled out as a named helper so the rule appears once and the "no locale
 * collation anywhere in this file" claim is checkable by reading it.
 */
function codeUnitLess(a: string, b: string): boolean {
  return a < b;
}

/**
 * The DEFAULT ORDER of a vehicle table: battles descending, ties broken by
 * cleaned vehicle id ascending in code-unit order.
 *
 * D-12 fixes this as the sort the table opens with, and the Phase 4 rule fixes
 * the tie-break, so the answer key can state an exact id sequence and a later
 * plan can be checked against it. Every row is returned, INCLUDING rows with no
 * battles — D-12 keeps a garage-only vehicle visible with its count — so the
 * length of the result is the number of rows in, not a filtered subset.
 *
 * A row whose battles cell is not a finite number sorts LAST, in both
 * directions, because D-09 says a special value never counts as 0 in a sort: a
 * vehicle with no battles sorts below every vehicle that has fought, and a
 * vehicle whose battle count is unreadable sorts below both.
 *
 * The id and battle columns are PARAMETERS, not constants, because the four
 * titles spell the same idea differently (`BATTLES_COUNT`, `GAMES_PLAYED`,
 * `BATTLES`). Naming them here keeps this oracle from growing the per-title
 * column map that the implementation owns — the whole point is that the two
 * sides do not share that mapping. The defaults are the WoT main file's names,
 * which is what the hand answer key is derived from.
 */
export function oracleDefaultOrder(
  rows: readonly OracleVehicleRow[],
  idColumn = 'VEHICLE_NAME',
  battlesColumn = 'BATTLES_COUNT',
): string[] {
  const prepared: OrderedRow[] = [];
  for (const row of rows) {
    const battles = finiteNumber(cell(row, battlesColumn));
    prepared.push({
      id: cell(row, idColumn),
      battles: battles === null ? 0 : battles,
      usable: battles !== null,
    });
  }

  prepared.sort((a, b) => {
    // Unusable rows go last, then by id, whatever the two battles values are.
    if (a.usable !== b.usable) return a.usable ? -1 : 1;
    if (a.usable && b.usable && a.battles !== b.battles) return b.battles - a.battles;
    if (codeUnitLess(a.id, b.id)) return -1;
    if (codeUnitLess(b.id, a.id)) return 1;
    return 0;
  });

  return prepared.map((entry) => entry.id);
}

/**
 * The distinct `TYPE` codes of a by_Type file, NUMERICALLY ascending.
 *
 * The numeric order is a decided rule, not an accident: codes are identifiers,
 * and a stable numeric order is easier to scan than a data-dependent one. Plain
 * code-unit order would put `10` between `1` and `2` — which is exactly the
 * wrong answer the fixture's WoT by_Type codes are shaped to catch.
 *
 * A code that is not an integer (blank, `N/A`, a decimal, a future code with a
 * suffix) falls back to code-unit order, and an unparseable code sorts after
 * every integer code. Distinctness is by the code STRING, so `1` and `01` are
 * two codes here; the export does not write the latter and inventing a numeric
 * equivalence would be a guess.
 */
export function oracleBattleTypeCodes(
  rows: readonly OracleVehicleRow[],
  typeColumn = 'TYPE',
): string[] {
  const distinct: string[] = [];
  for (const row of rows) {
    const code = cell(row, typeColumn);
    if (!distinct.includes(code)) distinct.push(code);
  }

  distinct.sort((a, b) => {
    const numberA = finiteNumber(a);
    const numberB = finiteNumber(b);
    const integerA = numberA !== null && Number.isInteger(numberA);
    const integerB = numberB !== null && Number.isInteger(numberB);
    if (integerA && integerB) {
      if (numberA !== numberB) return numberA! - numberB!;
      return 0;
    }
    // Anything that is not an integer code sorts after every integer code, and
    // then in code-unit order. The comparator stays a total order either way.
    if (integerA !== integerB) return integerA ? -1 : 1;
    if (codeUnitLess(a, b)) return -1;
    if (codeUnitLess(b, a)) return 1;
    return 0;
  });

  return distinct;
}
