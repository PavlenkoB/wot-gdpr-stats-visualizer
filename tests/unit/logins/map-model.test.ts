import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  legendSteps,
  levelsInUse,
  mapLevel,
  mapNavigate,
  mapSummaryArgs,
  rankCountries,
  type CountryRow,
} from '../../../src/lib/features/logins/map-model.ts';
import { loginTiles } from '../../../src/lib/features/logins/login-model.ts';
import type { LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import { formatMapLegendNote, formatMapSummary } from '../../../src/lib/ui-copy.ts';

// =============================================================================
// The country map's pure model (06-12, ACTIVITY-06, D-09)
//
// The level function is checked two ways, on purpose. Away from a boundary it is
// compared with the UI-SPEC's logarithmic formula written out literally, which is
// a different instrument from the implementation's integer comparison. AT a
// boundary the logarithm is not trustworthy (that is why the implementation does
// not use it), so the exact counts are listed by hand from the arithmetic.
// =============================================================================

/** The UI-SPEC formula, verbatim, in floating point. */
function specLevel(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max === 1) return 1;
  return 1 + Math.min(4, Math.floor((4 * Math.log(count)) / Math.log(max)));
}

describe('mapLevel (UI-SPEC "Scale rule")', () => {
  it('is zero for a country with no logins', () => {
    expect(mapLevel(0, 100)).toBe(0);
    expect(mapLevel(-3, 100)).toBe(0);
    expect(mapLevel(0, 1)).toBe(0);
  });

  it('is level 1 for a count of 1 and level 5 for the maximum, at every maximum', () => {
    for (const max of [2, 3, 10, 16, 81, 1000, 10_000, 1_000_000, 100_000_000]) {
      expect(mapLevel(1, max), `count 1 of ${max}`).toBe(1);
      expect(mapLevel(max, max), `count ${max} of ${max}`).toBe(5);
    }
  });

  it('makes every shaded country level 1 when the maximum is 1', () => {
    expect(mapLevel(1, 1)).toBe(1);
  });

  it('puts a country exactly on a boundary at the higher level, where the logarithm may not', () => {
    // 16^(k/4) is 1, 2, 4, 8, 16: the boundaries are exact integers.
    expect([1, 2, 3, 4, 7, 8, 15, 16].map((n) => mapLevel(n, 16))).toEqual([
      1, 2, 2, 3, 3, 4, 4, 5,
    ]);
    // 81^(k/4) is 1, 3, 9, 27, 81.
    expect([1, 2, 3, 8, 9, 26, 27, 80, 81].map((n) => mapLevel(n, 81))).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5,
    ]);
    // 10,000^(k/4) is 1, 10, 100, 1,000, 10,000.
    expect([9, 10, 99, 100, 999, 1000, 9999, 10_000].map((n) => mapLevel(n, 10_000))).toEqual([
      1, 2, 2, 3, 3, 4, 4, 5,
    ]);
    // 100,000,000^(k/4) is 1, 100, 10,000, 1,000,000, 100,000,000: counts whose
    // fourth power is far beyond 2^53, which is why the comparison is BigInt.
    expect(
      [99, 100, 9999, 10_000, 999_999, 1_000_000, 99_999_999, 100_000_000].map((n) =>
        mapLevel(n, 100_000_000),
      ),
    ).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it('agrees with the logarithmic formula everywhere it is not on a boundary', () => {
    for (const max of [2, 3, 7, 10, 50, 1000, 12_345, 1_000_000]) {
      const samples = new Set<number>([1, 2, 3, max, max - 1]);
      for (let k = 1; k <= 60; k++) samples.add(Math.max(1, Math.round(max ** (k / 60))));
      for (const count of samples) {
        if (count < 1 || count > max) continue;
        const position = (4 * Math.log(count)) / Math.log(max);
        // A boundary is where the float and the exact answer may legitimately
        // differ; those are pinned by hand above.
        if (Math.abs(position - Math.round(position)) < 1e-9) continue;
        expect(mapLevel(count, max), `${count} of ${max}`).toBe(specLevel(count, max));
      }
    }
  });

  it('never decreases as the count grows, and never leaves 1 to 5 for a shaded country', () => {
    for (const max of [2, 5, 100, 4096, 999_999]) {
      let previous = 0;
      for (let count = 1; count <= Math.min(max, 5000); count++) {
        const level = mapLevel(count, max);
        expect(level).toBeGreaterThanOrEqual(previous);
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(5);
        previous = level;
      }
    }
  });

  it('keeps minor countries visible when one country holds 94 percent of the logins', () => {
    // 9,400 of 10,000 logins in one country, the rest spread thin: a linear
    // scale would shade every one of them the same.
    const levels = [9400, 300, 120, 40, 12, 3, 1].map((n) => mapLevel(n, 9400));
    expect(levels[0]).toBe(5);
    expect(new Set(levels).size).toBeGreaterThanOrEqual(4);
  });

  it('does not throw on a value that is not a login count', () => {
    expect(mapLevel(2.5, 10)).toBe(specLevel(2.5, 10));
    expect(mapLevel(Number.NaN, 10)).toBe(0);
  });
});

const names: Record<string, string> = {
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  GI: 'Gibraltar',
  AU: 'Australia',
};

const nameOf = (cc: string): string | null => names[cc] ?? null;

function ranked(
  countries: { cc: string; logins: number; ips?: number }[],
  drawable: string[],
): CountryRow[] {
  return rankCountries(
    countries.map((c) => ({ ips: 1, ...c })),
    nameOf,
    new Set(drawable),
  );
}

describe('rankCountries (specless-probe ACTIVITY-06 ordering)', () => {
  it('ranks by logins descending', () => {
    const rows = ranked(
      [
        { cc: 'FR', logins: 5 },
        { cc: 'DE', logins: 9 },
        { cc: 'JP', logins: 1 },
      ],
      ['FR', 'DE', 'JP'],
    );
    expect(rows.map((r) => r.cc)).toEqual(['DE', 'FR', 'JP']);
  });

  it('breaks ties by English name, not by code', () => {
    // DE sorts before FR by code, but Germany sorts after France by name, so the
    // two orders disagree and only one of them can be right.
    const rows = ranked(
      [
        { cc: 'DE', logins: 4 },
        { cc: 'FR', logins: 4 },
      ],
      ['DE', 'FR'],
    );
    expect(rows.map((r) => r.name)).toEqual(['France', 'Germany']);
  });

  it('breaks a name tie by code in code-unit order', () => {
    const duplicateNames = (cc: string): string => (cc === 'AA' || cc === 'AB' ? 'Same' : 'Other');
    const rows = rankCountries(
      [
        { cc: 'AB', logins: 2, ips: 1 },
        { cc: 'AA', logins: 2, ips: 1 },
      ],
      duplicateNames,
      new Set(['AA', 'AB']),
    );
    expect(rows.map((r) => r.cc)).toEqual(['AA', 'AB']);
  });

  it('orders names by code unit, so an upper-case name precedes a lower-case one', () => {
    const odd: Record<string, string> = { AA: 'zeta', AB: 'Zulu' };
    const rows = rankCountries(
      [
        { cc: 'AA', logins: 1, ips: 1 },
        { cc: 'AB', logins: 1, ips: 1 },
      ],
      (cc) => odd[cc] ?? null,
      new Set(['AA', 'AB']),
    );
    // 'Zulu' < 'zeta' in code-unit order; a locale compare would put zeta first.
    expect(rows.map((r) => r.name)).toEqual(['Zulu', 'zeta']);
  });

  it('marks a country with no shape as not drawn, and every other as drawn', () => {
    const rows = ranked(
      [
        { cc: 'DE', logins: 3 },
        { cc: 'GI', logins: 2 },
      ],
      ['DE'],
    );
    expect(rows.find((r) => r.cc === 'DE')?.drawn).toBe(true);
    expect(rows.find((r) => r.cc === 'GI')?.drawn).toBe(false);
  });

  it('carries the tallies through unchanged', () => {
    const [row] = ranked([{ cc: 'JP', logins: 7, ips: 3 }], ['JP']);
    expect(row).toEqual({ cc: 'JP', name: 'Japan', logins: 7, ips: 3, drawn: true, named: true });
  });

  it('keeps a country it cannot name, under its own code', () => {
    const [row] = ranked([{ cc: 'QQ', logins: 1 }], ['QQ']);
    expect(row?.name).toBe('QQ');
    expect(row?.named).toBe(false);
  });

  it('does not mutate its input', () => {
    const input = [
      { cc: 'FR', logins: 1, ips: 1 },
      { cc: 'DE', logins: 2, ips: 1 },
    ];
    rankCountries(input, nameOf, new Set());
    expect(input.map((c) => c.cc)).toEqual(['FR', 'DE']);
  });
});

// -----------------------------------------------------------------------------
// The legend (D-09, UI-SPEC section 4 Legend)
// -----------------------------------------------------------------------------

/** A drawn row with a given count, for the level and legend cases. */
function drawnRow(cc: string, logins: number): CountryRow {
  return { cc, name: cc, logins, ips: 1, drawn: true, named: true };
}

describe('levelsInUse', () => {
  it('lists the distinct shades the DRAWN countries use, ascending', () => {
    const rows = [
      drawnRow('AA', 1000),
      drawnRow('AB', 1000),
      drawnRow('AC', 1),
      drawnRow('AD', 40),
    ];
    expect(levelsInUse(rows, 1000)).toEqual([1, 3, 5]);
  });

  it('ignores a country that has no shape, because it paints nothing', () => {
    const rows: CountryRow[] = [{ ...drawnRow('GI', 1000), drawn: false }, drawnRow('AA', 1)];
    expect(levelsInUse(rows, 1000)).toEqual([1]);
  });

  it('is empty when nothing is drawn', () => {
    expect(levelsInUse([], 5)).toEqual([]);
  });
});

describe('legendSteps', () => {
  it('is the single step 1 when the maximum is 1, and none when no level is in use', () => {
    expect(legendSteps(1, [1])).toEqual([1]);
    expect(legendSteps(1000, [])).toEqual([]);
  });

  it('gives ceil(max^((L-1)/4)) for each level in use at a maximum of 1000', () => {
    expect(legendSteps(1000, [1, 2, 3, 4, 5])).toEqual([1, 6, 32, 178, 1000]);
    expect(legendSteps(1000, [1, 5])).toEqual([1, 1000]);
  });

  it('collapses duplicate starts, because two levels can begin on the same count', () => {
    // Levels 2 to 5 of a maximum of 2 all begin at 2.
    expect(legendSteps(2, [1, 2, 3, 4, 5])).toEqual([1, 2]);
  });

  it('lands exactly on an integer boundary where a floating-point root would not', () => {
    // 16^(1/4) is exactly 2 and 10,000^(1/4) is exactly 10; `Math.pow` may answer
    // 2.0000000000000004 and 10.000000000000002, which a bare ceil turns into 3
    // and 11.
    expect(legendSteps(16, [1, 2, 3, 4, 5])).toEqual([1, 2, 4, 8, 16]);
    expect(legendSteps(10_000, [1, 2, 3, 4, 5])).toEqual([1, 10, 100, 1000, 10_000]);
    expect(legendSteps(81, [2, 3, 4])).toEqual([3, 9, 27]);
    expect(legendSteps(100_000_000, [2, 3, 4])).toEqual([100, 10_000, 1_000_000]);
  });

  it('maps every step start back to its own level through mapLevel, for each maximum', () => {
    for (const max of [2, 10, 16, 81, 1000, 10_000, 1_000_000, 100_000_000]) {
      for (let level = 1; level <= 5; level++) {
        const [start] = legendSteps(max, [level]);
        expect(start, `level ${level} of ${max}`).toBeGreaterThanOrEqual(1);
        const at = mapLevel(start!, max);
        if (at === level) {
          // The level is in use at all: nothing smaller reaches it.
          expect(mapLevel(start! - 1, max), `just below ${start} of ${max}`).toBeLessThan(level);
        } else {
          // No integer count lands on this level at this maximum (a maximum of
          // 2 jumps from level 1 to level 5), so its start belongs to a deeper one.
          expect(at, `level ${level} of ${max}`).toBeGreaterThan(level);
        }
      }
    }
  });

  it('feeds the frozen note formatter, which states the steps in words', () => {
    expect(formatMapLegendNote(legendSteps(1000, [1, 2, 3, 4, 5]), 'en-US')).toBe(
      'Shading is logarithmic, so each darker step covers a wider range of logins. ' +
        'Steps start at 1, 6, 32, 178 and 1,000 logins.',
    );
    expect(formatMapLegendNote(legendSteps(1, [1]), 'en-US')).toBe(
      'Every shaded country has 1 login.',
    );
    expect(formatMapLegendNote(legendSteps(1000, [1, 5]), 'en-US')).toContain(
      'Steps start at 1 and 1,000 logins.',
    );
  });
});

// -----------------------------------------------------------------------------
// The keyboard model (UI-SPEC section 4 Interaction)
// -----------------------------------------------------------------------------

describe('mapNavigate', () => {
  it('moves to the previous country on Left and Up and to the next on Right and Down', () => {
    expect(mapNavigate(2, 'ArrowLeft', 5)).toBe(1);
    expect(mapNavigate(2, 'ArrowUp', 5)).toBe(1);
    expect(mapNavigate(2, 'ArrowRight', 5)).toBe(3);
    expect(mapNavigate(2, 'ArrowDown', 5)).toBe(3);
  });

  it('stops at both ends rather than wrapping', () => {
    expect(mapNavigate(0, 'ArrowLeft', 5)).toBe(0);
    expect(mapNavigate(0, 'ArrowUp', 5)).toBe(0);
    expect(mapNavigate(4, 'ArrowRight', 5)).toBe(4);
    expect(mapNavigate(4, 'ArrowDown', 5)).toBe(4);
  });

  it('jumps to the first on Home and the last on End', () => {
    expect(mapNavigate(3, 'Home', 5)).toBe(0);
    expect(mapNavigate(1, 'End', 5)).toBe(4);
  });

  it('leaves the stop alone for any other key and for an empty order', () => {
    expect(mapNavigate(2, 'PageDown', 5)).toBe(2);
    expect(mapNavigate(2, 'a', 5)).toBe(2);
    expect(mapNavigate(0, 'ArrowRight', 0)).toBe(0);
  });

  it('clamps a stale index into the order instead of walking off it', () => {
    expect(mapNavigate(9, 'ArrowLeft', 3)).toBe(1);
    expect(mapNavigate(-4, 'ArrowRight', 3)).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// The summary sentence (UI-SPEC section 4, UIC zero-one-many)
// -----------------------------------------------------------------------------

const NONE_UNKNOWN = { addresses: 0, logins: 0 };

describe('mapSummaryArgs', () => {
  it('names the many-country form with every counted login as the base', () => {
    const rows = [drawnRow('DE', 6), drawnRow('FR', 3)];
    const summary = mapSummaryArgs(rows, 10, { addresses: 1, logins: 1 });
    expect(summary.form).toBe('many');
    // t is ALL counted logins (10), not the resolved total (9).
    expect(summary.args).toEqual([2, 'DE', 6, 10, 1, 1]);
  });

  it('names the one-country form when the country has some of the logins', () => {
    const summary = mapSummaryArgs([drawnRow('DE', 3)], 5, { addresses: 1, logins: 2 });
    expect(summary.form).toBe('one');
    expect(summary.args).toEqual([1, 'DE', 3, 5, 1, 2]);
  });

  it('names the all-logins form when one country holds every counted login', () => {
    const summary = mapSummaryArgs([drawnRow('DE', 5)], 5, NONE_UNKNOWN);
    expect(summary.form).toBe('all');
    expect(formatMapSummary(...summary.args!, 'en-US')).toBe(
      'All 5 logins with a known country came from DE.',
    );
  });

  it('names no form, and carries no arguments, when no country resolved', () => {
    const summary = mapSummaryArgs([], 4, { addresses: 2, logins: 4 });
    expect(summary).toEqual({ form: 'none', args: null });
  });

  it('counts a country with no shape too, because the sentence is about the logins', () => {
    const rows: CountryRow[] = [{ ...drawnRow('GI', 9), drawn: false }, drawnRow('DE', 1)];
    const summary = mapSummaryArgs(rows, 10, NONE_UNKNOWN);
    expect(summary.args?.[0]).toBe(2);
    expect(summary.args?.[1]).toBe('GI');
  });

  it('makes the sentence a plain English claim in the many form', () => {
    const rows = [drawnRow('DE', 6), drawnRow('FR', 3)];
    const summary = mapSummaryArgs(rows, 10, NONE_UNKNOWN);
    expect(formatMapSummary(...summary.args!, 'en-US')).toBe(
      'Logins came from 2 countries. DE had the most, with 6 of 10 logins (60%).',
    );
  });
});

describe('the leader the sentence names is the leader the Top country tile names', () => {
  const NAMES: Record<string, string> = {
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan',
    AU: 'Australia',
  };
  const nameOf = (cc: string): string | null => NAMES[cc] ?? null;

  /** A ready view holding only what these two readers use. */
  function viewOf(
    countries: { cc: string; logins: number; ips: number }[],
    unknown = NONE_UNKNOWN,
  ): LoginsView {
    return {
      status: 'ready',
      filesWithRows: 1,
      addresses: [],
      totalLogins: countries.reduce((sum, c) => sum + c.logins, unknown.logins),
      unreadableRows: 0,
      unknown,
      countries,
      other: { addresses: 0, logins: 0 },
      first: null,
      last: null,
      account: null,
    };
  }

  const cases: [string, { cc: string; logins: number; ips: number }[]][] = [
    [
      'a clear leader',
      [
        { cc: 'DE', logins: 9, ips: 2 },
        { cc: 'FR', logins: 2, ips: 1 },
      ],
    ],
    [
      'a tie, broken by English name rather than by code',
      [
        { cc: 'DE', logins: 4, ips: 1 },
        { cc: 'FR', logins: 4, ips: 1 },
        { cc: 'JP', logins: 1, ips: 1 },
      ],
    ],
    [
      'a country the name function cannot name, which the tile skips',
      [
        { cc: 'QQ', logins: 20, ips: 1 },
        { cc: 'JP', logins: 5, ips: 1 },
        { cc: 'AU', logins: 5, ips: 1 },
      ],
    ],
  ];

  for (const [label, countries] of cases) {
    it(`agrees for ${label}`, () => {
      const view = viewOf(countries);
      const tile = loginTiles(view, nameOf).topCountry;
      const rows = rankCountries(countries, nameOf, new Set(countries.map((c) => c.cc)));
      const summary = mapSummaryArgs(
        rows,
        view.status === 'ready' ? view.totalLogins : 0,
        NONE_UNKNOWN,
      );
      expect(tile).not.toBeNull();
      expect(summary.args?.[1]).toBe(tile?.name);
      expect(summary.args?.[2]).toBe(tile?.logins);
    });
  }
});

// -----------------------------------------------------------------------------
// The components: no inline style, no motion, no markup injection (06-12)
// -----------------------------------------------------------------------------

describe('the map components are plain, scoped and still', () => {
  const dir = join(process.cwd(), 'src/lib/features/logins');
  const names = ['WorldMap.svelte', 'CountryList.svelte', 'LoginMapSection.svelte'];

  /** The file's text with every comment removed. */
  function codeOf(name: string): string {
    const path = join(dir, name);
    expect(existsSync(path), `${path} does not exist`).toBe(true);
    return readFileSync(path, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
  }

  for (const name of names) {
    it(`${name} has no style attribute, style directive, transition, animation or raw HTML`, () => {
      const code = codeOf(name);
      expect(code).not.toMatch(/\sstyle\s*=/);
      expect(code).not.toMatch(/\sstyle:/);
      expect(code).not.toMatch(/transition/i);
      expect(code).not.toMatch(/\banimation(-[a-z-]+)?\s*:|@keyframes|\banimate:/i);
      expect(code).not.toContain('{@html');
    });
  }

  it('paints with the ramp tokens and never restates a ramp hex value', () => {
    const css = readFileSync(join(process.cwd(), 'src/app.css'), 'utf8');
    const ramp = [...css.matchAll(/--ramp-[0-5]:\s*(#[0-9a-fA-F]{6})/g)].map((m) =>
      m[1]!.toLowerCase(),
    );
    expect(ramp).toHaveLength(6);
    for (const name of names) {
      const code = codeOf(name).toLowerCase();
      for (const hex of ramp) expect(code, `${name} restates ${hex}`).not.toContain(hex);
    }
    const map = codeOf('WorldMap.svelte');
    for (let level = 0; level <= 5; level++) expect(map).toContain(`var(--ramp-${level})`);
  });

  it('imports the generated map statically, never with a dynamic import', () => {
    const map = codeOf('WorldMap.svelte');
    expect(map).toMatch(/from '\.\.\/\.\.\/geo\/world-map\.generated\.ts'/);
    expect(map).not.toMatch(/\bimport\s*\(/);
  });
});
