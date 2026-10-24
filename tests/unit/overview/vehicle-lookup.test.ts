import { describe, expect, it } from 'vitest';

import {
  createVehicleLookup,
  nationOfKey,
  tagFallbackName,
  type VehicleTableRow,
} from '../../../src/lib/features/overview/overview-lookup.ts';
import { defaultVehicleLookup } from '../../../src/lib/features/overview/vehicle-table.ts';
import { VEHICLE_TABLE_META } from '../../../src/lib/features/overview/vehicle-table.generated.ts';

// =============================================================================
// The vehicle LOOKUP (13-02 Task 2, D-08, D-09, T-13-09)
// =============================================================================
//
// Two keys, one table, and a fallback that never guesses:
//
//   byTag('nation:tag')  -> the vehicle statistics row's own key
//   byId('12345')        -> a record column's numeric tank id
//
// A miss is an ordinary miss: null, never a throw, and never a wrong tank.
// The `__proto__` and `constructor` probes are there because the lookup is
// built on `Map`s, and a `Map` has no prototype keys — a plain object keyed
// by user-supplied text would hand back `Object.prototype` for `__proto__`.
//
// Everything here is SYNTHETIC: invented tags, invented ids from 990,001.
// =============================================================================

/** A hand-written synthetic table of five rows. */
const SYNTHETIC_TABLE: readonly VehicleTableRow[] = [
  [990001, 'synth:SynthAlpha', 'SynthAlpha', 'mediumTank', 5],
  [990002, 'synth:SynthBravo', 'SynthBravo', 'heavyTank', 8],
  [990003, 'synth:SynthCharlie', 'SynthCharlie', 'lightTank', 3],
  [990004, 'synth:SynthDelta', 'SynthDelta', 'AT-SPG', 6],
  [990005, 'synth:SynthEcho', 'SynthEcho', 'SPG', 7],
];

const lookup = createVehicleLookup(SYNTHETIC_TABLE);

describe('tagFallbackName: the name of a tank the table does not have', () => {
  it.each([
    ['china:Ch24_Type64', 'Type64'],
    ['usa:A12_T29', 'T29'],
    ['germany:G32_PzV_PzIV', 'PzV_PzIV'],
    ['ussr:R61_Object252', 'Object252'],
  ])('reads %s as %s', (key, expected) => {
    expect(tagFallbackName(key)).toBe(expected);
  });

  it('keeps a tag with no index token whole', () => {
    expect(tagFallbackName('synth:Leopard_1')).toBe('Leopard_1');
    expect(tagFallbackName('synth:PlainName')).toBe('PlainName');
  });

  it('keeps a tag that is only an index token', () => {
    // Removing the token would leave nothing, so the tag itself is the name.
    expect(tagFallbackName('synth:G32_')).toBe('G32_');
  });

  it('handles a key with no nation prefix', () => {
    expect(tagFallbackName('Ch24_Type64')).toBe('Type64');
  });

  it('clamps a very long name', () => {
    expect(tagFallbackName(`synth:${'x'.repeat(200)}`)).toHaveLength(60);
  });
});

describe('nationOfKey: the nation prefix', () => {
  it('reads the text before the first colon', () => {
    expect(nationOfKey('germany:G32_PzV_PzIV')).toBe('germany');
    expect(nationOfKey('usa:A12_T29')).toBe('usa');
  });

  it('answers null when there is no nation', () => {
    expect(nationOfKey('NoColonHere')).toBeNull();
    expect(nationOfKey('')).toBeNull();
  });
});

describe('createVehicleLookup: both keys answer', () => {
  it('has one row per entry', () => {
    expect(lookup.size).toBe(SYNTHETIC_TABLE.length);
  });

  it('finds a vehicle by its nation:tag key', () => {
    const found = lookup.byTag('synth:SynthAlpha');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('SynthAlpha');
    expect(found?.classKey).toBe('mediumTank');
    expect(found?.tier).toBe(5);
    expect(found?.nation).toBe('synth');
    expect(found?.tankId).toBe(990001);
  });

  it('finds a vehicle by its numeric record id', () => {
    const found = lookup.byId('990002');
    expect(found?.name).toBe('SynthBravo');
    expect(found?.classKey).toBe('heavyTank');
    expect(found?.tier).toBe(8);
  });

  it('is case sensitive', () => {
    expect(lookup.byTag('synth:SynthAlpha')).not.toBeNull();
    expect(lookup.byTag('Synth:SynthAlpha')).toBeNull();
    expect(lookup.byTag('synth:synthalpha')).toBeNull();
    expect(lookup.byTag('SYNTH:SynthAlpha')).toBeNull();
  });

  it.each(['0', '', '007', '1e3', '-5', ' 12', '12 ', '990001 ', 'abc', '99.1'])(
    'resolves the id %s to nothing',
    (raw) => {
      expect(lookup.byId(raw)).toBeNull();
    },
  );

  it('resolves an absent id to nothing', () => {
    expect(lookup.byId('123456')).toBeNull();
    expect(lookup.byId(undefined)).toBeNull();
  });

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'treats the key %s as an ordinary miss',
    (key) => {
      expect(lookup.byTag(key)).toBeNull();
      expect(lookup.byId(key)).toBeNull();
    },
  );

  it('stores a type it does not know as unknown, and a tier outside 1 to 11 as null', () => {
    const odd = createVehicleLookup([[990009, 'synth:SynthOdd', 'SynthOdd', 'battlecruiser', 42]]);
    const found = odd.byTag('synth:SynthOdd');
    expect(found?.classKey).toBe('unknown');
    expect(found?.tier).toBeNull();
  });

  it('keeps the new tier XI and refuses the one above it', () => {
    const eleven = createVehicleLookup([
      [990011, 'synth:SynthEleven', 'SynthEleven', 'heavyTank', 11],
    ]);
    const twelve = createVehicleLookup([
      [990012, 'synth:SynthTwelve', 'SynthTwelve', 'heavyTank', 12],
    ]);
    expect(eleven.byTag('synth:SynthEleven')?.tier).toBe(11);
    expect(twelve.byTag('synth:SynthTwelve')?.tier).toBeNull();
  });

  it('never throws for any input', () => {
    expect(() => lookup.byTag('')).not.toThrow();
    expect(() => lookup.byId(undefined)).not.toThrow();
  });
});

describe('defaultVehicleLookup: the committed table', () => {
  it('holds as many rows as the table metadata counts', () => {
    expect(defaultVehicleLookup.size).toBe(VEHICLE_TABLE_META.count);
  });

  it('answers a real tag and a real id, and still misses an invented one (D-09)', () => {
    expect(defaultVehicleLookup.size).toBeGreaterThanOrEqual(500);
    // Real rows of the committed table: the hyphenated T-34 and a tier-V medium.
    expect(defaultVehicleLookup.byTag('ussr:R04_T-34')).toMatchObject({ name: 'T-34' });
    expect(defaultVehicleLookup.byTag('germany:G32_PzV_PzIV')).toMatchObject({
      classKey: 'mediumTank',
      tier: 5,
    });
    expect(defaultVehicleLookup.byId('1')).toMatchObject({ name: 'T-34' });
    // The invented tags and ids of the synthetic archives stay unknown.
    expect(defaultVehicleLookup.byTag('synth:SynthAlpha')).toBeNull();
    expect(defaultVehicleLookup.byId('990001')).toBeNull();
  });
});
