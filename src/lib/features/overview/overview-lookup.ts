/**
 * overview-lookup.ts — the key-free vehicle lookup (13-02, D-08, D-09, T-13-09).
 *
 * ## What this module is for
 *
 * A vehicle statistics row names its tank with a `nation:tag` key, and a
 * record column names it with a numeric `tank_id`. The table the build script
 * generates carries both, so a lookup has to answer BOTH questions:
 *
 *   byTag('germany:G32_PzV_PzIV')  -> the tank's name, class, tier, nation
 *   byId('12345')                  -> the same, for a record column
 *
 * ## Why this module does NOT import the generated table
 *
 * The table is worker-only (D-08): it is inlined into the worker chunk, like
 * the geo country table, and the page must never pull it into the main
 * bundle. The ESLint rule that keeps it out names the IMPORT SPECIFIER, so a
 * module that imported the table here would itself be banned from the page.
 *
 * So the table arrives as an ARGUMENT. `vehicle-table.ts` — the one module
 * allowed to import the generated table — passes it in, and this module never
 * knows where the rows came from. That is also what makes it testable: the
 * unit test builds a synthetic table of five rows and never touches the
 * committed one.
 *
 * ## Why a miss is an ordinary miss
 *
 * A tank the table does not have is not an error and is not a guess (D-09).
 * `byTag` and `byId` return `null`, the page falls back to the tag-derived
 * name and an unknown class, and the Overview states its class coverage.
 *
 * A key of `__proto__` or `constructor` is an ordinary miss for the same
 * reason: both lookups are `Map`s, and a `Map` has no prototype keys. There
 * is no object keyed by user-supplied text anywhere in this module.
 *
 * ## Why the id is matched by a pattern and not by a number
 *
 * A record column holds a STRING that is sometimes empty, sometimes `0`, and
 * sometimes a `\N`. Parsing it as a number and looking the number up would
 * find `0` or `NaN` or nothing at all, and would quietly turn "not recorded"
 * into a wrong tank. Only `/^[1-9][0-9]{0,9}$/` is looked up, so `'0'`,
 * `''`, `'007'`, `'1e3'`, `'-5'`, `' 12'` and `'12 '` all resolve to nothing
 * (RESEARCH Pitfall 9).
 */

/**
 * A tank class, as the built-in table spells it.
 *
 * `unknown` is a real value and not a marker: a tank missing from the table
 * is counted as unknown and NOT guessed (D-09). The literals are the ones
 * `overview-shared.ts` declares, so a class key is assignable to the tile
 * contract's class key without a conversion.
 */
export type VehicleClassKey =
  'mediumTank' | 'AT-SPG' | 'heavyTank' | 'lightTank' | 'SPG' | 'unknown';

/**
 * One row of the table.
 *
 * The same tuple the generated module declares: `[tank_id, "nation:tag",
 * name, type, tier]`.
 */
export type VehicleTableRow = readonly [
  tankId: number,
  key: string,
  name: string,
  type: string,
  tier: number,
];

/**
 * One resolved vehicle.
 *
 * `tier` is null when the row does not name a usable one, and `classKey` is
 * `unknown` when the row's type is not one of the five the page knows. The
 * generator rejects both, so these are defensive rather than expected.
 */
export interface VehicleInfo {
  tankId: number;
  key: string;
  name: string;
  classKey: VehicleClassKey;
  tier: number | null;
  nation: string;
}

/**
 * The lookup the page asks.
 *
 * Both methods answer `null` for a miss and never throw.
 */
export interface VehicleLookup {
  /** How many rows the table holds. */
  readonly size: number;
  /** The tank behind a `nation:tag` key, or null. */
  byTag(key: string): VehicleInfo | null;
  /** The tank behind a numeric record id, or null. */
  byId(raw: string | undefined): VehicleInfo | null;
}

/** The five classes the table may carry. */
const CLASS_KEYS: readonly string[] = ['mediumTank', 'AT-SPG', 'heavyTank', 'lightTank', 'SPG'];

/**
 * The only shape a record id may have.
 *
 * A positive integer with no leading zero, at most ten digits. Everything
 * else — `'0'`, `''`, `'007'`, `'1e3'`, `'-5'`, `' 12'`, `'12 '` — is not an
 * id and resolves to nothing.
 */
const RECORD_ID_PATTERN = /^[1-9][0-9]{0,9}$/;

/**
 * The leading index token of a tag: letters, then digits, then an underscore.
 *
 * `Ch24_Type64` starts with `Ch24_`, `A12_T29` with `A12_`, `G32_PzV_PzIV`
 * with `G32_`. A tag with no such token (`Leopard_1`) keeps its whole text.
 */
const INDEX_TOKEN_PATTERN = /^[A-Za-z]*[0-9]+_/;

/** The longest a fallback name may be, so a page can interpolate it. */
const MAX_NAME_LENGTH = 60;

/**
 * The nation prefix of a key, or null.
 *
 * The text before the first colon. A key with no colon, or with nothing
 * before the colon, has no nation.
 */
export function nationOfKey(key: string): string | null {
  const separator = key.indexOf(':');
  if (separator <= 0) return null;
  return key.slice(0, separator);
}

/**
 * The name to show for a tank the table does not have (D-09).
 *
 * The nation prefix is dropped and ONE leading index token is removed, so
 * `china:Ch24_Type64` reads `Type64`, `usa:A12_T29` reads `T29` and
 * `germany:G32_PzV_PzIV` reads `PzV_PzIV`. Nothing else is guessed: a tag
 * with no index token keeps its whole text, and a tag that IS only an index
 * token keeps that text too, because removing it would leave nothing.
 *
 * The result is plain text, clamped to 60 characters.
 */
export function tagFallbackName(key: string): string {
  const separator = key.indexOf(':');
  const tag = separator === -1 ? key : key.slice(separator + 1);
  const withoutIndex = tag.replace(INDEX_TOKEN_PATTERN, '');
  const name = withoutIndex === '' ? tag : withoutIndex;
  return name.slice(0, MAX_NAME_LENGTH);
}

/**
 * The highest tier a row may carry before it reads as "no usable tier". It
 * equals `MAX_TIER` in the generator (a test holds the two equal): Wargaming's
 * tier XI exists, so the ceiling is 11, not 10.
 */
export const MAX_TIER = 11;

/**
 * Build a lookup over a table.
 *
 * Two `Map`s: one keyed by `nation:tag` and one by the decimal tank id. The
 * size is the number of ROWS, which is what the table's metadata counts.
 */
export function createVehicleLookup(rows: readonly VehicleTableRow[]): VehicleLookup {
  const byTag = new Map<string, VehicleInfo>();
  const byId = new Map<string, VehicleInfo>();

  for (const row of rows) {
    const [tankId, key, name, type, tier] = row;
    const info: VehicleInfo = {
      tankId,
      key,
      name,
      classKey: CLASS_KEYS.includes(type) ? (type as VehicleClassKey) : 'unknown',
      tier: Number.isInteger(tier) && tier >= 1 && tier <= MAX_TIER ? tier : null,
      nation: nationOfKey(key) ?? '',
    };
    byTag.set(key, info);
    byId.set(String(tankId), info);
  }

  return {
    size: rows.length,
    byTag(key: string): VehicleInfo | null {
      return byTag.get(key) ?? null;
    },
    byId(raw: string | undefined): VehicleInfo | null {
      if (typeof raw !== 'string') return null;
      if (!RECORD_ID_PATTERN.test(raw)) return null;
      return byId.get(raw) ?? null;
    },
  };
}
