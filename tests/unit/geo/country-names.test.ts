import { afterEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// countryName — English display names, guarded (06-06, D-11, UI-SPEC section 7)
// =============================================================================
//
// The names come from `Intl.DisplayNames(['en'], { type: 'region' })`, never
// from a bundled list: a list would be a few hundred strings to keep current,
// and this project does not ship dependencies it does not need.
//
// The guards are the point of the file, not the names. `Intl.DisplayNames`
// THROWS on a structurally invalid code, and the caller's answer for an
// unmatched address is the muted `Unknown country` (D-08) — so `ZZ` and every
// malformed shape have to be answered null BEFORE the call, not caught after
// it. A `try/catch` alone would also render `ZZ` as a name on any ICU that
// happens to accept it.
//
// The two cases that need `Intl.DisplayNames` REPLACED re-import the module
// under test with `vi.resetModules()`, because the module caches one instance
// after its first use (which is the right production behaviour and the wrong
// thing for a test to inherit: without the reset the "never constructs" case
// would pass on a cache rather than on the guard, and the "throws" case would
// never see the throw at all).
//
// The name assertions are deliberately limited to names that are stable across
// ICU versions. `Germany` and `United States` are not; `Czechia`, `Türkiye`
// and `Bosnia & Herzegovina` are (RESEARCH Pitfall 13), and a test pinning one
// of those would fail on a browser upgrade rather than on a defect here.
// =============================================================================

type CountryNamesModule = typeof import('../../../src/lib/geo/country-names.ts');

/** A fresh copy of the module, with a cold `Intl.DisplayNames` cache. */
async function freshModule(): Promise<CountryNamesModule> {
  vi.resetModules();
  return import('../../../src/lib/geo/country-names.ts');
}

const original = Intl.DisplayNames;

afterEach(() => {
  (Intl as { DisplayNames: typeof Intl.DisplayNames }).DisplayNames = original;
  vi.resetModules();
});

describe('countryName: English names from Intl', () => {
  it("names a country in English whatever the viewer's locale is", async () => {
    // D-11 pins the locale to `en` rather than following the viewer: the copy
    // in this project is English throughout, and a country list that renames
    // itself per reader is not the same table.
    const { countryName } = await freshModule();
    expect(countryName('DE')).toBe('Germany');
    expect(countryName('US')).toBe('United States');
  });

  it('returns the code itself for a well-formed code the platform does not know', async () => {
    // `ZZ` is special-cased by this module, so the "unrecognised" case needs a
    // different code. `XX` is user-assigned: structurally valid, never
    // allocated. Echoing it is the honest answer — the code is all the export
    // ever claimed, and inventing a name for it would be a fiction.
    const { countryName } = await freshModule();
    expect(new Intl.DisplayNames(['en'], { type: 'region' }).of('XX')).toBe('XX');
    expect(countryName('XX')).toBe('XX');
  });

  it('never lets the platform name ZZ (D-08)', async () => {
    // The reason `ZZ` is guarded before the call rather than caught after it:
    // on this runtime `Intl` is perfectly happy to answer it, and the answer
    // is a real-looking name for a row that means "reserved space". A
    // try/catch-only implementation would put that string in a country column.
    expect(new Intl.DisplayNames(['en'], { type: 'region' }).of('ZZ')).not.toBe('ZZ');
    const { countryName } = await freshModule();
    expect(countryName('ZZ')).toBeNull();
  });
});

describe('countryName: the codes that never reach Intl', () => {
  it('answers null for ZZ, so the caller shows Unknown country (D-08)', async () => {
    const { countryName } = await freshModule();
    expect(countryName('ZZ')).toBeNull();
  });

  it('answers null for every malformed shape, without throwing', async () => {
    const { countryName } = await freshModule();
    for (const code of ['', ' ', 'zz', 'ZZZ', '1A', 'D', 'A1', 'A-', ' DE', 'DE ']) {
      expect(countryName(code), JSON.stringify(code)).toBeNull();
    }
  });

  it('never constructs Intl.DisplayNames for a code it will answer null for', async () => {
    // The distinction the guard exists for: a `try/catch` around the call
    // would make these cases PASS while still constructing the object and
    // still calling it. Replacing the constructor proves the early return is
    // an early return — and the module is re-imported first, so a cached
    // instance cannot make this vacuously true.
    let constructed = 0;
    (Intl as { DisplayNames: unknown }).DisplayNames = function Patched(
      locales: string | string[],
      options: Intl.DisplayNamesOptions,
    ) {
      constructed += 1;
      return new original(locales, options);
    } as unknown as typeof Intl.DisplayNames;

    const { countryName } = await freshModule();
    expect(countryName('ZZ')).toBeNull();
    expect(countryName('1A')).toBeNull();
    expect(countryName('')).toBeNull();
    expect(countryName(null)).toBeNull();
    expect(constructed).toBe(0);

    // …and the control: a code that IS nameable still constructs it, so the
    // zero above is the guard and not a module that never calls Intl at all.
    expect(countryName('DE')).toBe('Germany');
    expect(constructed).toBe(1);
  });
});

describe('countryName: a throwing Intl falls back to the raw code', () => {
  it('returns the code rather than nothing (T-06-25)', async () => {
    (Intl as { DisplayNames: unknown }).DisplayNames = function Throwing() {
      throw new RangeError('invalid region');
    } as unknown as typeof Intl.DisplayNames;

    const { countryName } = await freshModule();
    // The code is never a message, a path or a row, so echoing it is safe —
    // and a cell with a raw code is a far better outcome than a cell with
    // nothing, or an exception thrown inside a render.
    expect(countryName('DE')).toBe('DE');
    expect(countryName('BR')).toBe('BR');
    // The guards still run first: a throwing Intl does not turn ZZ into a name.
    expect(countryName('ZZ')).toBeNull();
  });
});
