/**
 * overview-pins.ts — the Overview's PIN STORE (13-06, D-11, D-14, T-13-16..18).
 *
 * ## What is stored
 *
 * IDS ONLY. The value under the key is a JSON array of tile ids and nothing
 * else: no figure, no date, no account name, no tank name. A pin says which
 * tile a reader wants on top, and that is all it says (T-13-18).
 *
 * ## Where it is stored
 *
 * `localStorage`, under ONE key, `wg-overview-pins`. This module is the only
 * file in `src/` that names the storage global or the key: the phase-8 shell
 * guard bans both tokens in the shell files, so the shell IMPORTS these
 * functions instead of touching storage itself.
 *
 * Pins survive replacing the dataset, because the key says nothing about
 * the dataset: a new export changes the tiles' figures, not which tiles the
 * reader pinned (D-14).
 *
 * ## How it is read
 *
 * Defensively, because anything on the origin can write this key: another
 * script, an extension, an older build, or a user with a devtools console.
 * Every read is inside a `try`, the value is validated against the closed
 * catalogue, duplicates are dropped, and anything that is not a usable array
 * of known ids falls back to the DEFAULT pins (T-13-16).
 *
 * Membership is a `Set` built from the catalogue tuple, so `'__proto__'` and
 * `'constructor'` are ordinary non-members rather than prototype keys
 * (T-13-17).
 *
 * ## When it is written
 *
 * ONLY on an explicit pin or unpin. A read never writes: loading the page
 * with a corrupt value must not silently "repair" it, because that would
 * turn a read into a write the reader never asked for.
 */

import { OVERVIEW_CATALOGUE_ORDER } from './overview-definitions.ts';
import type { OverviewTileId } from './overview-shared.ts';

/** The one key the pins live under. */
export const PINS_KEY = 'wg-overview-pins';

/**
 * The pins a reader starts with (D-11).
 *
 * Logged in and Most-played tank. The sketch seeded a third (Most damage);
 * D-11 locks two, and the sketch's third default is NOT included.
 */
export const DEFAULT_PINS: readonly OverviewTileId[] = ['logged', 'tank'];

/**
 * How many pins may be stored: one per tile in the catalogue.
 *
 * Derived from the catalogue rather than written down, so a catalogue change
 * cannot leave a stale cap behind.
 */
export const PIN_CAP = OVERVIEW_CATALOGUE_ORDER.length;

/**
 * The part of the `Storage` interface this module needs.
 *
 * Narrow on purpose: the pins store never removes a key and never reads
 * another one, so it never needs `removeItem`, `clear` or `key`.
 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The catalogue ids, as a membership set. */
const KNOWN_IDS: ReadonlySet<string> = new Set<string>(OVERVIEW_CATALOGUE_ORDER);

/** Where each catalogue id sits, so a list can be put back in catalogue order. */
const CATALOGUE_INDEX: ReadonlyMap<string, number> = new Map(
  OVERVIEW_CATALOGUE_ORDER.map((id, index): [string, number] => [id, index]),
);

/**
 * Normalise a list of ids: keep the known ones, drop duplicates, put them in
 * catalogue order and cap them.
 *
 * Returns null when the input is not an array at all, and an empty array
 * when the input is an array that holds nothing usable — the two are
 * different facts and the reader path treats them differently.
 */
function normalise(value: unknown): OverviewTileId[] | null {
  if (!Array.isArray(value)) return null;
  const kept = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!KNOWN_IDS.has(entry)) continue;
    kept.add(entry);
  }
  const ordered = [...kept].sort(
    (a, b) => (CATALOGUE_INDEX.get(a) ?? 0) - (CATALOGUE_INDEX.get(b) ?? 0),
  );
  return ordered.slice(0, PIN_CAP) as OverviewTileId[];
}

/**
 * The stored value, validated.
 *
 * Returns null when the value is not an array or holds no valid id — which
 * the reader treats as "nothing usable is stored" and answers with the
 * defaults.
 */
export function parsePins(raw: unknown): OverviewTileId[] | null {
  const normalised = normalise(raw);
  if (normalised === null) return null;
  if (normalised.length === 0) return null;
  return normalised;
}

/**
 * The browser's own storage, or null when there is none.
 *
 * Reading `globalThis.localStorage` can THROW (a browser with storage
 * blocked by policy raises on property access), so the access itself is
 * inside the `try` and not only the `getItem` call.
 */
function defaultStorage(): StorageLike | null {
  try {
    const storage: Storage | undefined = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

/**
 * The reader's pins.
 *
 * Returns the stored pins, or a copy of the DEFAULT pins when storage is
 * unavailable, the key is absent, the value is not JSON, or the value holds
 * nothing usable.
 *
 * This function NEVER writes. A read that repaired the stored value would
 * be a write the reader never asked for.
 */
export function readPins(storage?: StorageLike | null): OverviewTileId[] {
  const store = storage === undefined ? defaultStorage() : storage;
  if (store === null) return [...DEFAULT_PINS];

  let raw: string | null;
  try {
    raw = store.getItem(PINS_KEY);
  } catch {
    return [...DEFAULT_PINS];
  }
  if (raw === null) return [...DEFAULT_PINS];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [...DEFAULT_PINS];
  }

  const pins = parsePins(parsed);
  return pins === null ? [...DEFAULT_PINS] : pins;
}

/**
 * Store the reader's pins.
 *
 * The ids are written in catalogue order as a JSON array, so the stored value
 * reads the same however the caller ordered them. Returns false when there
 * is no storage or the write failed (a full quota, a blocked origin) — the
 * caller then keeps the pins in memory for this session.
 */
export function writePins(ids: readonly OverviewTileId[], storage?: StorageLike | null): boolean {
  const store = storage === undefined ? defaultStorage() : storage;
  if (store === null) return false;
  const normalised = normalise(ids);
  if (normalised === null) return false;
  try {
    store.setItem(PINS_KEY, JSON.stringify(normalised));
    return true;
  } catch {
    return false;
  }
}

/**
 * Add or remove one pin.
 *
 * PURE: the array it is given is never touched, and the result is a new
 * array in catalogue order, capped at the catalogue's length.
 */
export function togglePin(
  current: readonly OverviewTileId[],
  id: OverviewTileId,
): OverviewTileId[] {
  const next = current.includes(id) ? current.filter((pinned) => pinned !== id) : [...current, id];
  const normalised = normalise(next);
  return normalised ?? [];
}
