import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PINS,
  PIN_CAP,
  PINS_KEY,
  parsePins,
  readPins,
  togglePin,
  writePins,
  type StorageLike,
} from '../../../src/lib/features/overview/overview-pins.ts';
import {
  OVERVIEW_TILE_IDS,
  type OverviewTileId,
} from '../../../src/lib/features/overview/overview-shared.ts';

// =============================================================================
// The Overview's PIN STORE (13-06 Task 2, D-11, D-14, T-13-16..18)
// =============================================================================
//
// The pins are IDS ONLY, under ONE key, and they are read from a store that
// anything on the origin can write. So the read is the interesting half:
// a corrupt, hostile or half-written value must fall back to the defaults
// rather than reaching the page.
//
// Three properties are pinned here:
//
//   1. THE FALLBACK. Anything that is not a usable array of known ids ends
//      up as the DEFAULT pins — never as an empty page, never as a crash,
//      and never as a tile id the catalogue does not know.
//   2. THE WRITE IS EXPLICIT. A read never writes, and a write never
//      happens without an action behind it.
//   3. THE STORE IS THE ONLY ONE. `wg-overview-pins` and the storage global
//      live in this module alone, so the shell cannot grow a second,
//      unguarded path to them.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');

/** A storage stub that records what was written. */
class StubStorage implements StorageLike {
  readonly items = new Map<string, string>();
  readonly writes: string[] = [];

  constructor(
    private readonly failGet = false,
    private readonly failSet = false,
  ) {}

  getItem(key: string): string | null {
    if (this.failGet) throw new Error('storage access denied');
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failSet) throw new Error('quota exceeded');
    this.writes.push(`${key}=${value}`);
    this.items.set(key, value);
  }
}

/** Every file under `src/`, relative to the repository root. */
function srcFiles(dir: string = SRC_ROOT): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...srcFiles(full));
    } else if (entry.isFile()) {
      found.push(full);
    }
  }
  return found;
}

describe('the pin store constants', () => {
  it('uses one key and the two default pins', () => {
    expect(PINS_KEY).toBe('wg-overview-pins');
    expect(DEFAULT_PINS).toEqual(['logged', 'tank']);
  });

  it('caps the pins at one per tile', () => {
    expect(PIN_CAP).toBe(OVERVIEW_TILE_IDS.length);
  });
});

describe('readPins', () => {
  it('returns the defaults for an empty store', () => {
    expect(readPins(new StubStorage())).toEqual([...DEFAULT_PINS]);
  });

  it('returns the stored ids in catalogue order', () => {
    const storage = new StubStorage();
    storage.items.set(PINS_KEY, JSON.stringify(['tank', 'logged']));
    expect(readPins(storage)).toEqual(['logged', 'tank']);
  });

  it('drops unknown ids, non-strings, duplicates and prototype keys', () => {
    const storage = new StubStorage();
    storage.items.set(
      PINS_KEY,
      JSON.stringify(['logged', 'logged', 'nope', 7, null, '__proto__', 'constructor', 'tank']),
    );
    expect(readPins(storage)).toEqual(['logged', 'tank']);
  });

  it('falls back to the defaults for a value that is not an array', () => {
    for (const raw of ['{"logged":true}', '"logged"', '42', 'null']) {
      const storage = new StubStorage();
      storage.items.set(PINS_KEY, raw);
      expect(readPins(storage), raw).toEqual([...DEFAULT_PINS]);
    }
  });

  it('falls back to the defaults for invalid JSON', () => {
    const storage = new StubStorage();
    storage.items.set(PINS_KEY, 'not json at all');
    expect(readPins(storage)).toEqual([...DEFAULT_PINS]);
  });

  it('falls back to the defaults for an empty array', () => {
    const storage = new StubStorage();
    storage.items.set(PINS_KEY, '[]');
    expect(readPins(storage)).toEqual([...DEFAULT_PINS]);
  });

  it('falls back to the defaults for an array of only invalid ids', () => {
    const storage = new StubStorage();
    storage.items.set(PINS_KEY, JSON.stringify(['nope', '__proto__', 7]));
    expect(readPins(storage)).toEqual([...DEFAULT_PINS]);
  });

  it('caps a longer array', () => {
    const storage = new StubStorage();
    storage.items.set(PINS_KEY, JSON.stringify([...OVERVIEW_TILE_IDS, 'logged', 'nope']));
    expect(readPins(storage)).toHaveLength(PIN_CAP);
  });

  it('falls back to the defaults when the storage throws', () => {
    expect(readPins(new StubStorage(true))).toEqual([...DEFAULT_PINS]);
  });

  it('falls back to the defaults when there is no storage at all', () => {
    expect(readPins(null)).toEqual([...DEFAULT_PINS]);
  });

  it('falls back to the defaults when reading the storage global throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage is blocked');
      },
    });
    try {
      expect(readPins()).toEqual([...DEFAULT_PINS]);
    } finally {
      if (descriptor === undefined) {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      } else {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    }
  });

  it('never writes', () => {
    const storage = new StubStorage();
    storage.items.set(PINS_KEY, JSON.stringify(['logged']));
    readPins(storage);
    expect(storage.writes).toEqual([]);
  });
});

describe('parsePins', () => {
  it('answers null for a value that is not an array', () => {
    expect(parsePins('logged')).toBeNull();
    expect(parsePins(null)).toBeNull();
    expect(parsePins({ 0: 'logged' })).toBeNull();
  });

  it('answers null for an array with nothing usable in it', () => {
    expect(parsePins([])).toBeNull();
    expect(parsePins(['nope', 7])).toBeNull();
  });

  it('keeps the known ids in catalogue order', () => {
    expect(parsePins(['ord', 'logged', 'hour'])).toEqual(['logged', 'hour', 'ord']);
  });
});

describe('writePins', () => {
  it('writes the exact JSON array in catalogue order', () => {
    const storage = new StubStorage();
    expect(writePins(['tank', 'logged'], storage)).toBe(true);
    expect(storage.items.get(PINS_KEY)).toBe('["logged","tank"]');
  });

  it('writes nothing that is not a known id', () => {
    const storage = new StubStorage();
    writePins(['logged', 'nope' as OverviewTileId], storage);
    expect(storage.items.get(PINS_KEY)).toBe('["logged"]');
  });

  it('reports failure when the write throws', () => {
    expect(writePins(['logged'], new StubStorage(false, true))).toBe(false);
  });

  it('reports failure when there is no storage', () => {
    expect(writePins(['logged'], null)).toBe(false);
  });

  it('round-trips a pin through the store', () => {
    const storage = new StubStorage();
    expect(writePins(['logged', 'hour'], storage)).toBe(true);
    expect(readPins(storage)).toEqual(['logged', 'hour']);
  });
});

describe('togglePin', () => {
  it('adds a pin that is not there', () => {
    expect(togglePin(['logged'], 'tank')).toEqual(['logged', 'tank']);
  });

  it('removes a pin that is there', () => {
    expect(togglePin(['logged', 'tank'], 'logged')).toEqual(['tank']);
  });

  it('keeps the catalogue order', () => {
    expect(togglePin([], 'ord')).toEqual(['ord']);
    expect(togglePin(['ord'], 'logged')).toEqual(['logged', 'ord']);
  });

  it('does not touch the array it is given', () => {
    const current: OverviewTileId[] = ['logged'];
    const frozen = [...current];
    togglePin(current, 'tank');
    expect(current).toEqual(frozen);
  });
});

describe('the store is the only one', () => {
  it('names the pins key in no other file under src/', () => {
    const offenders = srcFiles()
      .filter((file) => readFileSync(file, 'utf8').includes(PINS_KEY))
      .map((file) => path.relative(REPO_ROOT, file));
    expect(offenders).toEqual(['src/lib/features/overview/overview-pins.ts']);
  });

  it('names the storage global in no other file under src/', () => {
    const offenders = srcFiles()
      .filter((file) => readFileSync(file, 'utf8').includes('localStorage'))
      .map((file) => path.relative(REPO_ROOT, file));
    expect(offenders).toEqual(['src/lib/features/overview/overview-pins.ts']);
  });
});
