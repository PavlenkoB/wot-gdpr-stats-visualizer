// =============================================================================
// The country map's figures, as pure functions (06-12, ACTIVITY-06, D-09).
//
// ## What this module holds, and what it deliberately does not
//
// It holds every DECISION the map makes: which country is on which shade, in
// which order the countries are ranked, and what a rank means. It holds no DOM,
// no `Intl` and no sentence. The country NAME arrives as a `nameOf` parameter
// (06-08's reason, restated: a unit test names countries without depending on
// the platform's CLDR build), and every sentence is `ui-copy`'s.
//
// ## Aggregation, never per login
//
// Everything here reads per-COUNTRY tallies (`LoginCountryTotal`). Nothing in
// this file can be handed an address or a login row, so the map's node count is
// a function of the country count and cannot follow the login count (D-09, the
// AGENTS.md chart-scale rule).
// =============================================================================

/** One country on the map or in the list: a name, two tallies, and whether it has a shape. */
export interface CountryRow {
  /** Two-letter code, as the aggregate carries it. */
  readonly cc: string;
  /** The English name, or the code itself when no name can be produced. */
  readonly name: string;
  /** Counted logins from every address in this country. */
  readonly logins: number;
  /** Distinct addresses that contributed to it. */
  readonly ips: number;
  /** True when the generated map has a polygon for this code. */
  readonly drawn: boolean;
  /** False when `name` is the code standing in because no English name exists. */
  readonly named: boolean;
}

/** The shade levels the stylesheet knows: 0 is "no logins", 1 to 5 are the ramp. */
export const MAP_LEVELS = [0, 1, 2, 3, 4, 5] as const;

/** The deepest level. The formula reaches it exactly at the largest count. */
const TOP_LEVEL = 5;

/**
 * The smallest count that reaches level `level` when the largest country has
 * `max` logins, as an exact integer. `level` is 1 to 5, and `max` is above 1.
 *
 * The UI-SPEC's rule is `1 + min(4, floor(4 * ln(count) / ln(max)))`. Level L
 * (L above 1) therefore starts at the first count with `4 * ln(count) >= (L - 1)
 * * ln(max)`, which is `count^4 >= max^(L - 1)` — and that comparison between
 * two integers is EXACT in BigInt, where the logarithm form is not. `Math.log`
 * is correctly rounded to the last bit at best, so at a count that sits exactly
 * on a boundary (2 of 16, 10 of 10,000) the quotient can come out a hair under
 * an integer and shade a country one step too light, while the legend says it
 * starts one step higher. One definition, in integers, is what keeps the shade a
 * country is painted with and the boundary the legend prints from ever
 * disagreeing.
 */
function levelStart(level: number, max: number): number {
  if (level <= 1) return 1;
  const target = BigInt(max) ** BigInt(level - 1);
  // The real-valued root is the starting guess; the two loops make it exact.
  let count = Math.max(1, Math.ceil(max ** ((level - 1) / 4)));
  while (count > 1 && BigInt(count - 1) ** 4n >= target) count -= 1;
  while (BigInt(count) ** 4n < target) count += 1;
  return count;
}

/**
 * The shade level of a country with `count` logins, when the largest country has
 * `max` (D-09, UI-SPEC "Scale rule").
 *
 * Zero for no logins. Otherwise `1 + min(4, floor(4 * ln(count) / ln(max)))`:
 * a count of 1 is level 1 and `max` is level 5, with the steps between spaced
 * geometrically, so an export where one address supplies 94 percent of the
 * logins still shows its minor countries instead of one shade. When `max` is 1
 * there is no range to grade, so every shaded country is level 1.
 *
 * Computed over INTEGERS (see `levelStart`). A non-integer input is not a
 * login count; it falls back to the logarithm so a hand-built value cannot
 * throw inside a render.
 */
export function mapLevel(count: number, max: number): number {
  if (!(count > 0)) return 0;
  if (!(max > 1)) return 1;
  if (!Number.isInteger(count) || !Number.isInteger(max)) {
    return 1 + Math.min(4, Math.floor((4 * Math.log(count)) / Math.log(max)));
  }
  let level = 1;
  for (let next = 2; next <= TOP_LEVEL; next++) {
    if (count >= levelStart(next, max)) level = next;
  }
  return level;
}

/**
 * Rank the countries for the map, the keyboard, the list and the sentence.
 *
 * Logins DESCENDING, then English name, then code, both in code-unit order
 * (never `localeCompare`: the order is what two readers of one export must agree
 * on). `drawable` is the set of codes the generated map has a polygon for, which
 * is NOT the same as "not in `NO_POLYGON_CODES`": a code is drawn exactly when
 * the module holds a shape for it.
 *
 * A country `nameOf` cannot name keeps its own code as its name. The aggregate
 * only ever holds well-formed codes other than `ZZ`, so this is a guard for a
 * hand-built input and not a branch a real export reaches; it keeps the country
 * in the list, because dropping it would break the sum the UI-SPEC requires.
 */
export function rankCountries(
  countries: readonly { cc: string; logins: number; ips: number }[],
  nameOf: (cc: string) => string | null,
  drawable: ReadonlySet<string>,
): CountryRow[] {
  const rows = countries.map((country) => {
    const name = nameOf(country.cc);
    return {
      cc: country.cc,
      name: name ?? country.cc,
      logins: country.logins,
      ips: country.ips,
      drawn: drawable.has(country.cc),
      named: name !== null,
    };
  });
  return rows.sort((a, b) => {
    if (b.logins !== a.logins) return b.logins - a.logins;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.cc < b.cc ? -1 : a.cc > b.cc ? 1 : 0;
  });
}

/**
 * The distinct shades the DRAWN countries are painted with, ascending (1 to 5).
 *
 * A country with no shape paints nothing, so it contributes no swatch to the
 * legend even when it sets the top of the scale: the legend explains what is on
 * the map.
 */
export function levelsInUse(rows: readonly CountryRow[], max: number): number[] {
  const levels: number[] = [];
  for (const row of rows) {
    if (!row.drawn) continue;
    const level = mapLevel(row.logins, max);
    if (level >= 1 && !levels.includes(level)) levels.push(level);
  }
  return levels.sort((a, b) => a - b);
}

/**
 * The first login count of each level in use, ascending, duplicates collapsed
 * (UI-SPEC section 4 Legend: `ceil(max^((L-1)/4))`).
 *
 * Derived from `levelStart`, which is that formula made exact, so each start is
 * the smallest count `mapLevel` paints at that level and the legend can never
 * name a boundary a country on the map does not follow. Two levels can begin on
 * the same count (a maximum of 2 puts levels 2 to 5 all at 2), which is why the
 * list is de-duplicated here as well as in the note formatter.
 *
 * `levels` are the shades in use; level 0 and anything outside 1 to 5 are not
 * steps. A maximum of 1 has no range, so its one step is 1.
 */
export function legendSteps(max: number, levels: readonly number[]): number[] {
  const wanted = levels.filter(
    (level) => Number.isInteger(level) && level >= 1 && level <= TOP_LEVEL,
  );
  if (wanted.length === 0) return [];
  if (!(max > 1)) return [1];
  const top = Number.isInteger(max) ? max : Math.ceil(max);
  const starts: number[] = [];
  for (const level of wanted) {
    const start = levelStart(level, top);
    if (!starts.includes(start)) starts.push(start);
  }
  return starts.sort((a, b) => a - b);
}

/**
 * The roving stop's next position in the ranked order (UI-SPEC section 4).
 *
 * Left and Up go to the previous country and Right and Down to the next,
 * stopping at both ends: wrapping would turn a roving tab stop into a loop a
 * keyboard user cannot leave by pressing the same key. Home and End jump to the
 * ends. Any other key leaves the stop where it is, and an index left over from a
 * longer order is clamped into the current one first.
 */
export function mapNavigate(index: number, key: string, length: number): number {
  if (length <= 0) return index;
  const last = length - 1;
  const at = Math.min(Math.max(index, 0), last);
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, at - 1);
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(last, at + 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return index;
  }
}

/** Which of the summary sentence's shapes applies (UI-SPEC section 4, UIC zero-one-many). */
export type MapSummaryForm = 'none' | 'many' | 'one' | 'all';

/** The summary sentence's form and the arguments `formatMapSummary` takes. */
export interface MapSummary {
  readonly form: MapSummaryForm;
  /** `[countries, leader, leaderLogins, totalLogins, unknownAddresses, unknownLogins]`. */
  readonly args: readonly [number, string, number, number, number, number] | null;
}

/**
 * The map's summary sentence, as a form and the arguments for the frozen formatter.
 *
 * `totalLogins` is ALL counted logins, the Top country tile's denominator, and
 * not the sum of the resolved countries: the two percentages on screen would
 * otherwise disagree whenever some addresses have no known country.
 *
 * The leader is the first country with an English name, which is the Top
 * country tile's own rule (a country with no name is not a candidate there), so
 * the sentence and the tile can never name different countries. The count of
 * countries is every country with logins, drawn or not: the sentence is about
 * the logins and not about the polygons.
 */
export function mapSummaryArgs(
  rows: readonly CountryRow[],
  totalLogins: number,
  unknown: { addresses: number; logins: number },
): MapSummary {
  const leader = rows.find((row) => row.named) ?? rows[0];
  if (leader === undefined) return { form: 'none', args: null };
  const form: MapSummaryForm =
    rows.length === 1 ? (leader.logins === totalLogins ? 'all' : 'one') : 'many';
  return {
    form,
    args: [rows.length, leader.name, leader.logins, totalLogins, unknown.addresses, unknown.logins],
  };
}
