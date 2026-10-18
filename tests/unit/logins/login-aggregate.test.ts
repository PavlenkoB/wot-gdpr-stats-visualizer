import { describe, expect, it } from 'vitest';
import {
  buildLogins,
  viewFromLogins,
  type LoginSource,
} from '../../../src/lib/features/logins/login-aggregate.ts';
import { LOGINS_VERSION, MAX_LOGIN_IPS } from '../../../src/lib/features/logins/login-shared.ts';
import {
  lookupCountry,
  geoTableId,
  type CountryLookup,
} from '../../../src/lib/geo/country-lookup.ts';
import { maskIp, type ParsedIp } from '../../../src/lib/geo/ip.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import {
  LOGINS_HAND_KEY,
  LOGINS_IP_HOME,
  LOGINS_IP_THIRD,
  LOGINS_IP_WORK,
  LOGINS_WOT_ROWS,
  LOGINS_WOWS_ROWS,
  buildLoginsHandExport,
  buildLoginsOverCapSpec,
  buildLoginsScaleSpec,
  wallSeconds,
  type LoginsScaleFile,
  type LoginsScaleSpec,
} from '../../fixtures/logins-fixtures.ts';
import { oracleLogins } from '../../helpers/login-oracle.ts';
import {
  buildRealShapeCsv,
  type RealShapeRow,
} from '../../fixtures/playtime-real-shape-fixture.ts';

// =============================================================================
// buildLogins / viewFromLogins (06-01, D-01, D-06, D-08, D-12)
//
// The expected aggregate is `LOGINS_HAND_KEY`, derived from the fixture ROWS
// by hand and computed with the platform clock — not read back from this
// implementation. A test that built its expectation by calling `buildLogins`
// would be the aggregator agreeing with itself.
//
// The other thing proved here is that the country lookup is a SEAM and is
// called once per DISTINCT ADDRESS. On a real 71,000-row export the difference
// is one range search instead of seventy thousand, and a test that only counted
// rows could not tell the two apart.
// =============================================================================

/** Parse one real-shaped session file into the rows the aggregator takes. */
function rowsOf(text: string): Record<string, string | undefined>[] {
  return parseCsvFile(text, 'Activity_history', 'WOT_Game_Sessions.csv').rows.map((r) => r.data);
}

/**
 * The two real-shaped files as sources, parsed by the PRODUCTION parser — the
 * same call the import loop makes — so the aggregator is handed what the worker
 * stores rather than a hand-typed object.
 */
function handSources(): LoginSource[] {
  return [
    { kind: 'sessions', game: 'WOT', rows: rowsOf(buildRealShapeCsv(LOGINS_WOT_ROWS)) },
    { kind: 'sessions', game: 'WOWS', rows: rowsOf(buildRealShapeCsv(LOGINS_WOWS_ROWS)) },
  ];
}

/**
 * A lookup that answers null for everything.
 *
 * Still the right instrument for the cases that are about the aggregator's own
 * arithmetic — the cap, the ordering, the unreadable rows — because it removes
 * the table from the picture entirely. The cases that are about a COUNTRY run
 * the real `lookupCountry` below instead, and read their expectations out of
 * the committed fixture CSV.
 */
const NO_TABLE: CountryLookup = () => null;

describe('06-01: buildLogins over the hand fixture', () => {
  // 06-06: the worker is wired to the real table now, so the aggregate the rest
  // of this block inspects is the one the worker produces. Under Vitest the
  // alias always points at the committed fixture table, so "the real table"
  // here means the fixture — see `vitest.config.ts` and the seam guard.
  const aggregates = buildLogins(handSources(), lookupCountry);

  it('counts every readable row and no unreadable one', () => {
    expect(aggregates.totalLogins).toBe(LOGINS_HAND_KEY.totalLogins);
    expect(aggregates.unreadableRows).toBe(LOGINS_HAND_KEY.unreadableRows);
    // Not vacuous: the fixture really does carry both shapes, so a build that
    // dropped the blank and the padded cell outright would fail the first line.
    expect(aggregates.unreadableRows).toBe(2);
  });

  it('groups one row per distinct address, in the stored order', () => {
    // `handSources()` are parsed rows and carry no owner, so the accounts field
    // is `[]` on all three — read through the key's projection rather than by
    // editing the key, which is derived from rows and rows name no account.
    expect(aggregates.addresses).toEqual(
      LOGINS_HAND_KEY.addresses.map((address) => ({ ...address, accounts: [] })),
    );
    expect(aggregates.addresses.map((a) => a.ip)).toEqual([
      LOGINS_IP_HOME,
      LOGINS_IP_WORK,
      LOGINS_IP_THIRD,
    ]);
  });

  it('orders logins descending, then address ascending, on a tie', () => {
    // The tie is what makes the SECONDARY ordering observable: WORK and THIRD
    // both hold 2 logins, and only the address decides which comes first.
    expect(aggregates.addresses[1]?.logins).toBe(2);
    expect(aggregates.addresses[2]?.logins).toBe(2);
    expect(aggregates.addresses[1]!.ip < aggregates.addresses[2]!.ip).toBe(true);
  });

  it('reads first and last from the START column, never the session end', () => {
    // HOME's last login starts at 21:30 and its row ENDS at 23:00; a 23:00
    // answer would be the end of a session rather than a moment the account was
    // seen, and would move the address's last-seen by ninety minutes.
    const home = aggregates.addresses[0]!;
    expect(home.first).toBe(LOGINS_HAND_KEY.addresses[0]!.first);
    expect(home.last).toBe(LOGINS_HAND_KEY.addresses[0]!.last);
  });

  it('keeps the set of game tokens per address, from the file NAME', () => {
    for (const address of aggregates.addresses) {
      expect(address.games, address.ip).toEqual(['WOT', 'WOWS']);
    }
  });

  it('folds the overall range from the readable rows only', () => {
    expect(aggregates.first).toBe(LOGINS_HAND_KEY.first);
    expect(aggregates.last).toBe(LOGINS_HAND_KEY.last);
  });

  it('counts the files that contributed, and the files that were seen', () => {
    expect(aggregates.filesWithRows).toBe(LOGINS_HAND_KEY.filesWithRows);
    expect(aggregates.filesSeen).toEqual({ sessions: true, logins: false });
  });

  it('stamps the version and the geo table it was built against', () => {
    expect(aggregates.v).toBe(LOGINS_VERSION);
    expect(aggregates.geo).toBe(geoTableId());
  });

  it('never carries the unreadable cells anywhere in the record', () => {
    const serialised = JSON.stringify(aggregates);
    // The two unreadable cells are a blank and a zero-padded address; neither
    // may be stored, echoed or logged (D-06, T-06-01).
    expect(serialised).not.toContain('192.0.2.010');
    expect(aggregates.addresses.some((a) => a.ip.includes('010'))).toBe(false);
  });
});

describe('06-01: the country lookup is an injected seam (D-12)', () => {
  it('runs ONCE per distinct address, never once per row', () => {
    let calls = 0;
    const spy: CountryLookup = () => {
      calls += 1;
      return null;
    };
    const aggregates = buildLogins(handSources(), spy);
    // Seven counted rows, three distinct addresses: seven would mean a lookup
    // per session, which is the thing a range table makes expensive.
    expect(calls).toBe(3);
    expect(calls).toBe(aggregates.addresses.length);
  });

  it('is handed the PARSED address, so a table never sees an unvalidated cell', () => {
    const seen: string[] = [];
    const spy: CountryLookup = (ip) => {
      seen.push(ip.canonical);
      return null;
    };
    buildLogins(handSources(), spy);
    expect([...seen].sort()).toEqual([LOGINS_IP_HOME, LOGINS_IP_THIRD, LOGINS_IP_WORK].sort());
  });

  it('resolves the fixture table, leaving only the explicit unknown unassigned', () => {
    // 06-06 replaced the null seam. The two resolved addresses and the one
    // `ZZ` address are all read out of `tests/fixtures/geo/country-fixture.csv`
    // into `LOGINS_HAND_KEY`, so this asserts the data rather than a copy of
    // the answer.
    const aggregates = buildLogins(handSources(), lookupCountry);
    expect(aggregates.countries).toEqual(LOGINS_HAND_KEY.countries);
    expect(aggregates.unknown).toEqual(LOGINS_HAND_KEY.unknown);
    for (const address of aggregates.addresses) {
      const expected = LOGINS_HAND_KEY.addresses.find((a) => a.ip === address.ip);
      expect(expected, address.ip).toBeDefined();
      expect(address.cc, address.ip).toBe(expected!.cc);
    }
    // The unknown bucket is reachable from a DOCUMENTATION address, not only
    // from a private range: THIRD is the fixture's explicit `ZZ` block.
    const third = aggregates.addresses.find((a) => a.ip === LOGINS_IP_THIRD);
    expect(third?.cc).toBeNull();
  });

  it('tallies a resolved country per address, keeping each address in ONE bucket', () => {
    // The seam working in both directions: an injected table splits the unknown
    // bucket without the aggregator changing at all, which is the whole reason
    // the lookup is a parameter.
    const byIp: Record<string, string> = {
      [LOGINS_IP_HOME]: 'AA',
      [LOGINS_IP_WORK]: 'BB',
    };
    const aggregates = buildLogins(handSources(), (ip) => byIp[ip.canonical] ?? null);

    expect(aggregates.countries).toEqual([
      { cc: 'AA', logins: 3, ips: 1 },
      { cc: 'BB', logins: 2, ips: 1 },
    ]);
    // THIRD resolves to nothing, so it alone carries the unknown bucket.
    expect(aggregates.unknown).toEqual({ addresses: 1, logins: 2 });
    expect(aggregates.addresses.map((a) => a.cc)).toEqual(['AA', 'BB', null]);
  });

  it('orders countries by logins descending, then code ascending', () => {
    const aggregates = buildLogins(handSources(), () => 'AA');
    // One country holding every address: 7 logins over 3 IPs.
    expect(aggregates.countries).toEqual([{ cc: 'AA', logins: 7, ips: 3 }]);
    expect(aggregates.unknown).toEqual({ addresses: 0, logins: 0 });
  });
});

describe('06-01: the empty states are different sentences', () => {
  it('answers no-source when no file was supplied at all', () => {
    expect(viewFromLogins(buildLogins([], NO_TABLE))).toEqual({ status: 'no-source' });
  });

  it('answers no-usable, with the unreadable count, for a header-only file', () => {
    // A header-only file parses to zero rows and STILL has to appear as a file
    // that was seen — that is the whole difference between this state and
    // `no-source`, and it is decided by the presence flag, not by the row count.
    const headerOnly: LoginSource[] = [
      { kind: 'sessions', game: 'WOT', rows: rowsOf(buildRealShapeCsv([])) },
    ];
    const aggregates = buildLogins(headerOnly, NO_TABLE);
    expect(aggregates.filesSeen).toEqual({ sessions: true, logins: false });
    expect(aggregates.filesWithRows).toBe(0);
    expect(viewFromLogins(aggregates)).toEqual({ status: 'no-usable', unreadable: 0 });
  });

  it('counts unreadable rows even when nothing at all is readable', () => {
    // Every row unreadable is a real export, and the sentence the user gets is
    // "N rows could not be read" rather than an empty table with no reason.
    const onlyJunk = buildRealShapeCsv([
      ['13.03.2019 20:00', '13.03.2019 21:30', '192.0.2.010'],
      ['14.03.2019 20:00', '14.03.2019 21:30', ''],
    ]);
    const aggregates = buildLogins(
      [{ kind: 'sessions', game: 'WOT', rows: rowsOf(onlyJunk) }],
      NO_TABLE,
    );
    expect(aggregates.totalLogins).toBe(0);
    expect(aggregates.unreadableRows).toBe(2);
    expect(viewFromLogins(aggregates)).toEqual({ status: 'no-usable', unreadable: 2 });
  });
});

describe('06-01: viewFromLogins carries the stored figures verbatim', () => {
  it('answers ready with every data field, and drops the build metadata', () => {
    const aggregates = buildLogins(handSources(), NO_TABLE);
    const view = viewFromLogins(aggregates);
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') throw new Error('unreachable: the assertion above failed');

    expect(view.addresses).toEqual(aggregates.addresses);
    expect(view.totalLogins).toBe(aggregates.totalLogins);
    expect(view.unreadableRows).toBe(aggregates.unreadableRows);
    expect(view.unknown).toEqual(aggregates.unknown);
    expect(view.countries).toEqual(aggregates.countries);
    expect(view.other).toEqual(aggregates.other);
    expect(view.first).toBe(aggregates.first);
    expect(view.last).toBe(aggregates.last);

    // `v`, `geo` and `filesSeen` are how the WORKER decides staleness. They
    // must not cross to the main thread: the main thread has no table and no
    // rule set, so a version string there would be a number it cannot act on.
    expect('v' in view).toBe(false);
    expect('geo' in view).toBe(false);
    expect('filesSeen' in view).toBe(false);
  });
});

describe('06-01: column resolution follows the file it is given', () => {
  it('reads the synthetic fixture spellings as aliases of the real ones', () => {
    // A real export says STARTED_AT; the synthetic fixture says SESSION_START;
    // an invented Logins.csv says LOGIN_DT. They are one field, not three.
    const sources: LoginSource[] = [
      {
        kind: 'sessions',
        game: null,
        rows: [
          {
            SESSION_START: '13.03.2019 20:00',
            SESSION_END: '13.03.2019 21:00',
            IP: LOGINS_IP_HOME,
          },
          {
            SESSION_START: '13.03.2019 22:00',
            SESSION_END: '13.03.2019 23:00',
            IP: LOGINS_IP_HOME,
          },
        ],
      },
    ];
    const aggregates = buildLogins(sources, NO_TABLE);
    expect(aggregates.addresses[0]?.logins).toBe(2);
    expect(aggregates.addresses[0]?.first).not.toBeNull();
    // A source whose file names no game contributes no token rather than a
    // fabricated one (D-01).
    expect(aggregates.addresses[0]?.games).toEqual([]);
  });

  it('reads a padded and lower-case header through headerKey', () => {
    const sources: LoginSource[] = [
      {
        kind: 'logins',
        game: null,
        rows: [{ ' login_dt ': '13.03.2019 20:00', ' ip ': LOGINS_IP_WORK }],
      },
    ];
    const aggregates = buildLogins(sources, NO_TABLE);
    expect(aggregates.addresses).toHaveLength(1);
    expect(aggregates.addresses[0]?.ip).toBe(LOGINS_IP_WORK);
    expect(aggregates.filesSeen).toEqual({ sessions: false, logins: true });
  });

  it('contributes nothing from a file with no IP column, rather than guessing', () => {
    const sources: LoginSource[] = [
      {
        kind: 'sessions',
        game: 'WOT',
        rows: [{ STARTED_AT: '13.03.2019 20:00', SERVER_NAME: 'eu-1' }],
      },
    ];
    const aggregates = buildLogins(sources, NO_TABLE);
    // No column to read, so every row is unreadable — which is the honest
    // outcome, and a counted one rather than a silent drop.
    expect(aggregates.addresses).toHaveLength(0);
    expect(aggregates.unreadableRows).toBe(1);
    expect(viewFromLogins(aggregates)).toEqual({ status: 'no-usable', unreadable: 1 });
  });

  it('never reads any column but IP and the start time', () => {
    // A row carrying a large unrelated blob must not change the aggregate: the
    // aggregator names two columns and reads values by direct property access,
    // so there is no "pass the whole row" path for a cell to ride out on.
    const sources: LoginSource[] = [
      {
        kind: 'sessions',
        game: 'WOT',
        rows: [
          {
            STARTED_AT: '13.03.2019 20:00',
            FINISHED_AT: '13.03.2019 21:00',
            IP: LOGINS_IP_HOME,
            USER_AGENT: 'x'.repeat(5_000),
            LOGIN: 'player@example.invalid',
          },
        ],
      },
    ];
    const aggregates = buildLogins(sources, NO_TABLE);
    expect(aggregates.addresses[0]?.logins).toBe(1);
    // The last-seen is the START, not the end: reading FINISHED_AT would make
    // this address last seen an hour after the account was actually seen.
    expect(aggregates.last).toBe(aggregates.first);
    expect(JSON.stringify(aggregates)).not.toContain('player@example.invalid');
  });
});

// =============================================================================
// 06-03 tracer: one IPv6 address through parse, canonical grouping, aggregation
// and mask (D-05).
//
// The thin slice, end to end in one test group: two SPELLINGS of one address
// and one mapped spelling, all through the PRODUCTION parser and the PRODUCTION
// aggregator. What it proves is the one thing the whole plan rests on — the
// grouping key is the CANONICAL address, so `2001:DB8::1` and
// `2001:db8:0:0:0:0:0:1` are ONE row and not two (D-05). Before 06-03 every one
// of these three cells was unreadable and this suite had no IPv6 in it at all.
// =============================================================================

describe('06-03: IPv6 canonical grouping through the real parser (D-05)', () => {
  /** One real-shaped file carrying exactly the given IP cells, in order. */
  function sourcesOf(ips: readonly string[]): LoginSource[] {
    const rows: RealShapeRow[] = ips.map((ip, i) => [
      `13.03.2019 ${String(20 + (i % 4)).padStart(2, '0')}:00`,
      `13.03.2019 ${String(20 + (i % 4)).padStart(2, '0')}:30`,
      ip,
    ]);
    return [{ kind: 'sessions', game: 'WOT', rows: rowsOf(buildRealShapeCsv(rows)) }];
  }

  it('groups two spellings of one address into ONE row, and keeps a mapped one apart', () => {
    // The acceptance criterion, stated as one test: three cells, TWO addresses.
    // `::ffff:192.0.2.1` is deliberately NOT merged into 192.0.2.1 — D-05 is one
    // row per CANONICAL address, and its canonical form is a 16-byte IPv6 one.
    // Merging it here would merge two rows the export never claimed were one;
    // `mappedIpv4` exists for the country LOOKUP, which is a different question.
    const aggregates = buildLogins(
      sourcesOf(['2001:DB8::1', '2001:db8:0:0:0:0:0:1', '::ffff:192.0.2.1']),
      NO_TABLE,
    );

    expect(aggregates.addresses).toHaveLength(2);
    expect(aggregates.unreadableRows).toBe(0);
    expect(aggregates.totalLogins).toBe(3);

    const byIp = new Map(aggregates.addresses.map((a) => [a.ip, a]));
    expect(byIp.get('2001:db8:0:0:0:0:0:1')?.logins).toBe(2);
    expect(byIp.get('0:0:0:0:0:ffff:c000:201')?.logins).toBe(1);
    // And the merged address kept the first and last of BOTH its rows, which is
    // the proof that grouping happened before the fold rather than after it.
    // `sourcesOf` stamps row i at hour 20 + i, so the two spellings are 20:00
    // and 21:00 and the mapped one is 22:00.
    expect(byIp.get('2001:db8:0:0:0:0:0:1')?.first).toBe(wallSeconds('13.03.2019 20:00'));
    expect(byIp.get('2001:db8:0:0:0:0:0:1')?.last).toBe(wallSeconds('13.03.2019 21:00'));
    expect(byIp.get('0:0:0:0:0:ffff:c000:201')?.first).toBe(wallSeconds('13.03.2019 22:00'));
  });

  it('masks a grouped IPv6 row to the D-06 form, the same string for both spellings', () => {
    const aggregates = buildLogins(sourcesOf(['2001:DB8::1', '2001:db8:0:0:0:0:0:1']), NO_TABLE);
    const address = aggregates.addresses[0];
    if (address === undefined) throw new Error('unreachable: the fixture has one address');
    expect(address.ip).toBe('2001:db8:0:0:0:0:0:1');
    expect(maskIp(address.ip)).toBe('2001:db8:0:xxxx:xxxx:xxxx:xxxx:xxxx');
  });

  it('counts a hostile cell beside a real one, and stores neither the cell nor a row', () => {
    // The same D-06 property the 06-01 fixture proves for IPv4, on the shapes an
    // IPv6 column actually meets: a zone id, a bracketed form and a script.
    const aggregates = buildLogins(
      sourcesOf(['2001:db8::1', 'fe80::1%eth0', '[::1]', '<script>alert(1)</script>']),
      NO_TABLE,
    );
    expect(aggregates.addresses).toHaveLength(1);
    expect(aggregates.unreadableRows).toBe(3);
    expect(aggregates.totalLogins).toBe(1);
    const serialised = JSON.stringify(aggregates);
    expect(serialised).not.toContain('alert');
    expect(serialised).not.toContain('eth0');
  });

  it('never throws on any cell, whatever the file holds (T-06-12)', () => {
    // No `;` in any of these: a semicolon is this export's own DELIMITER, so a
    // cell carrying one is not one cell at all and a test that used it would be
    // measuring the CSV parser rather than the address parser.
    const hostile = [
      ':'.repeat(500),
      '9'.repeat(500),
      '<b>bold</b>',
      '192.0.2.1 192.0.2.2',
      '::'.repeat(40),
      '2001:db8:' + '0:'.repeat(40) + '1',
    ];
    // Each hostile cell is aggregated ALONGSIDE the one real address, and the
    // unreadable counts are summed, so a cell that merely survived the call
    // without being counted would show up as a shortfall at the end.
    let unreadable = 0;
    for (const cell of hostile) {
      let aggregates = buildLogins([], NO_TABLE);
      expect(
        () => {
          aggregates = buildLogins(sourcesOf(['2001:db8::1', cell]), NO_TABLE);
        },
        cell.slice(0, 40),
      ).not.toThrow();
      expect(aggregates.addresses, cell.slice(0, 40)).toHaveLength(1);
      expect(aggregates.totalLogins, cell.slice(0, 40)).toBe(1);
      unreadable += aggregates.unreadableRows;
    }
    expect(unreadable).toBe(hostile.length);
  });
});

describe('06-01: the fixture archive is shaped the way the aggregator expects', () => {
  it('is a real-shaped export with no invented Activity_history file', () => {
    // The key is only a key if the archive really produces it. This asserts the
    // ARCHITECTURE (both invented files gone, both real-shaped files present)
    // without going near the worker, so a fixture that stopped being the real
    // shape fails here in a Node test rather than in a browser run.
    const bytes = buildLoginsHandExport();
    expect(bytes.length).toBeGreaterThan(0);
    // A zip is a zip: the local file header at offset 0 is the signature.
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

// =============================================================================
// 06-03 Task 3: the seeded 10k fixture against the INDEPENDENT oracle (D-17)
//
// The hand key above is nine rows a human can read. It cannot see a wrong cap, a
// wrong tie order, a wrong fold or a lookup that ran per row instead of per
// address, because at nine rows those are all the same answer. So the seeded
// 12,000-row export is compared field for field with `oracleLogins`, which
// shares no code with the aggregator: its own CSV splitter, its own timestamp
// validation by `Date` round-trip, its own address comparator, and the group
// key READ FROM THE FIXTURE rather than re-derived.
// =============================================================================

/** The scale spec, built once: 12,000 rows is not something to rebuild per test. */
const SCALE = buildLoginsScaleSpec();

/** Every generated file as a source, parsed by the PRODUCTION parser. */
function scaleSources(spec: LoginsScaleSpec = SCALE): LoginSource[] {
  return spec.files.map((file) => ({
    kind: file.game === null ? ('logins' as const) : ('sessions' as const),
    game: file.game,
    rows: parseCsvFile(file.text, 'Activity_history', file.path.split('/').pop()!).rows.map(
      (r) => r.data,
    ),
  }));
}

/**
 * A country assignment for two addresses in five and nothing for the rest, so
 * BOTH the country rollups and the unknown bucket are populated at scale rather
 * than one of them being trivially right.
 *
 * Two spellings of it, because the two sides of the comparison take different
 * arguments: the aggregator is handed a {@link ParsedIp} and the oracle a
 * canonical STRING. Neither side can see the other's, which is the point.
 */
function scaleCountryOf(canonical: string): string | null {
  const value = canonical.slice(-1).charCodeAt(0);
  if (value % 5 !== 0) return null;
  return ['AA', 'BB', 'CC', 'DD'][value % 4]!;
}

const scaleLookup: CountryLookup = (ip: ParsedIp) => scaleCountryOf(ip.canonical);

const SCALE_MAX_LISTED = MAX_LOGIN_IPS;

describe('06-03: the seeded 12,000-row export agrees with the independent oracle (D-17)', () => {
  const aggregates = buildLogins(scaleSources(), scaleLookup);
  const oracle = oracleLogins(SCALE, { countryOf: scaleCountryOf, maxListed: SCALE_MAX_LISTED });

  it('is a fixture big enough for the claims to mean anything', () => {
    // Not a vacuous guard: every comparison below is over these numbers, and a
    // generator that quietly emitted 200 rows would make all of them trivial.
    expect(SCALE.rowCount).toBeGreaterThanOrEqual(10_000);
    expect(SCALE.readableRows).toBeGreaterThanOrEqual(10_000);
    expect(SCALE.unreadableRows).toBeGreaterThan(0);
    expect(SCALE.distinctAddresses).toBeGreaterThan(500);
    expect(aggregates.totalLogins).toBe(SCALE.readableRows);
    expect(aggregates.unreadableRows).toBe(SCALE.unreadableRows);
  });

  it('agrees on the two headline counts', () => {
    expect(aggregates.totalLogins).toBe(oracle.totalLogins);
    expect(aggregates.unreadableRows).toBe(oracle.unreadableRows);
    expect(aggregates.filesWithRows).toBe(oracle.filesWithRows);
    expect(aggregates.filesSeen).toEqual(oracle.filesSeen);
  });

  it('agrees on the overall range and on the per-file presence facts', () => {
    expect(aggregates.first).toBe(oracle.first);
    expect(aggregates.last).toBe(oracle.last);
    // Not vacuous: the generator writes unreadable stamps on purpose, and this
    // is what proves an unreadable stamp is EXCLUDED from the range while the
    // row still counts as a login.
    expect(aggregates.first).not.toBeNull();
    expect(aggregates.last).not.toBeNull();
  });

  it('agrees on every listed address, field for field', () => {
    expect(aggregates.addresses).toHaveLength(oracle.addresses.length);
    expect(aggregates.addresses).toEqual(oracle.addresses);
  });

  it('agrees on the country rollups and on the unknown bucket', () => {
    expect(aggregates.countries).toEqual(oracle.countries);
    expect(aggregates.unknown).toEqual(oracle.unknown);
    // The sum the UI-SPEC requires, stated here on the 10k fixture: the drawn
    // countries, the not-drawn countries and the unknown row account for every
    // counted login, at any size.
    const tallied = aggregates.countries.reduce((sum, c) => sum + c.logins, 0);
    expect(tallied + aggregates.unknown.logins).toBe(aggregates.totalLogins);
  });

  it('agrees on the cap bucket, which is zero on a fixture under the cap', () => {
    expect(aggregates.other).toEqual(oracle.other);
    expect(aggregates.other).toEqual({ addresses: 0, logins: 0 });
  });

  it('reaches the same answer on a second build, byte for byte (D-05)', () => {
    // The order is STORED, so a rebuild that ordered differently would give two
    // readers of one export two different tables. Comparing the serialised form
    // rather than a couple of fields is what makes that the claim.
    const again = buildLogins(scaleSources(), scaleLookup);
    expect(JSON.stringify(again.addresses)).toBe(JSON.stringify(aggregates.addresses));
  });

  it('resolves each distinct address EXACTLY once, listed or not (D-12)', () => {
    const seen: string[] = [];
    const spy: CountryLookup = (ip) => {
      seen.push(ip.canonical);
      return scaleCountryOf(ip.canonical);
    };
    const spyRun = buildLogins(scaleSources(), spy);
    expect(seen).toHaveLength(SCALE.distinctAddresses);
    expect(new Set(seen).size).toBe(SCALE.distinctAddresses);
    // And the totals are unchanged by the spy, so a counting lookup is not a
    // different aggregation.
    expect(spyRun.totalLogins).toBe(aggregates.totalLogins);
    expect(spyRun.countries).toEqual(aggregates.countries);
  });
});

describe('06-03: the cap is the PRODUCTION constant, exercised by a real archive', () => {
  // 20,500 distinct addresses, no override: the constant decides where the cut
  // falls, and a test that lowered MAX_LOGIN_IPS to 5 would prove the branch
  // rather than the bound (T-06-14).
  const OVER_CAP = buildLoginsOverCapSpec(20_500);

  it('emits more distinct addresses than the cap allows to be listed', () => {
    expect(OVER_CAP.distinctAddresses).toBeGreaterThan(MAX_LOGIN_IPS);
    expect(OVER_CAP.rowCount).toBe(OVER_CAP.distinctAddresses + 1);
  });

  it('lists exactly the cap, folds the remainder, and still tallies all of them', () => {
    const aggregates = buildLogins(scaleSources(OVER_CAP), () => 'AA');
    expect(aggregates.addresses).toHaveLength(MAX_LOGIN_IPS);
    expect(aggregates.other.addresses).toBe(OVER_CAP.distinctAddresses - MAX_LOGIN_IPS);
    // The one address that appears TWICE is the LEADER (two logins beats one),
    // so it is always listed and never folded: the folded logins are exactly the
    // 500 folded addresses' single rows each, and not 501.
    expect(aggregates.other.logins).toBe(OVER_CAP.distinctAddresses - MAX_LOGIN_IPS);
    expect(aggregates.addresses[0]?.logins).toBe(2);
    // The recorded checkpoint outcome, as arithmetic: the folded logins are in
    // the country figures and in totalLogins, so the tile and the map cannot
    // disagree with each other.
    const tallied = aggregates.countries.reduce((sum, c) => sum + c.logins, 0);
    expect(tallied + aggregates.unknown.logins).toBe(aggregates.totalLogins);
    // And the OTHER relationship the cap line in the copy rests on: the listed
    // rows plus `other` are also the whole of totalLogins.
    const listed = aggregates.addresses.reduce((sum, a) => sum + a.logins, 0);
    expect(listed + aggregates.other.logins).toBe(aggregates.totalLogins);
    expect(aggregates.countries).toEqual([
      { cc: 'AA', logins: OVER_CAP.rowCount, ips: OVER_CAP.distinctAddresses },
    ]);
  });

  it('keeps the whole stored record at the cap, not at the archive size (Pitfall 9)', () => {
    const aggregates = buildLogins(scaleSources(OVER_CAP), () => 'AA');
    // The meta record is read whole on every query, so the size claim is the
    // one that matters: rows are bounded by the cap however big the archive is.
    expect(aggregates.addresses.length).toBe(MAX_LOGIN_IPS);
    expect(aggregates.countries.length).toBeLessThanOrEqual(250);
    // The view carries per-ADDRESS rows, never per-login data. A row is a
    // canonical address plus five short fields, so 200 characters per row is a
    // generous ceiling; a per-login record for this archive would need 20,501 of
    // them, and the assertion below is what says it is not one.
    expect(JSON.stringify(aggregates).length).toBeLessThan(MAX_LOGIN_IPS * 200);
  });

  it('agrees with the independent oracle on the over-cap fixture', () => {
    // A country for every address whose canonical form ends in `1`, and nothing
    // for the rest, so BOTH buckets carry a five-figure number here.
    const countryOf = (canonical: string): string | null => (canonical.endsWith('1') ? 'AA' : null);
    const lookup: CountryLookup = (ip) => countryOf(ip.canonical);
    const aggregates = buildLogins(scaleSources(OVER_CAP), lookup);
    const oracle = oracleLogins(OVER_CAP, { countryOf, maxListed: MAX_LOGIN_IPS });
    expect(aggregates.totalLogins).toBe(oracle.totalLogins);
    expect(aggregates.unreadableRows).toBe(oracle.unreadableRows);
    expect(aggregates.addresses).toEqual(oracle.addresses);
    expect(aggregates.other).toEqual(oracle.other);
    expect(aggregates.countries).toEqual(oracle.countries);
    expect(aggregates.unknown).toEqual(oracle.unknown);
    expect(aggregates.first).toBe(oracle.first);
    expect(aggregates.last).toBe(oracle.last);
  });

  it('lists twenty thousand rows that ALL mask to the same string (D-05)', () => {
    // The statement "two rows can look identical once masked" is an edge case at
    // nine addresses and the NORMAL case at twenty thousand. The full canonical
    // addresses differ; the masks do not, and only the sort tells them apart.
    const aggregates = buildLogins(scaleSources(OVER_CAP), () => 'AA');
    const masks = new Set(aggregates.addresses.map((a) => maskIp(a.ip)));
    expect(masks.size).toBe(1);
    expect(new Set(aggregates.addresses.map((a) => a.ip)).size).toBe(MAX_LOGIN_IPS);
  });

  it('names the accounts on the LISTED addresses only, and still totals all of them (D-18)', () => {
    // The cap bounds what is STORED, and the accounts ride on the stored rows —
    // so the question a reader asks at the cap is whether an address past it lost
    // its owner along with its row. It did: an unlisted address is not drawn, so
    // it can carry no chip. What must NOT move is the arithmetic.
    const stamped = scaleSources(OVER_CAP).map((source, index) => ({
      ...source,
      account: index % 2 === 0 ? 'root-a' : 'root-b',
    }));
    const aggregates = buildLogins(stamped, () => 'AA');

    expect(aggregates.addresses).toHaveLength(MAX_LOGIN_IPS);
    expect(
      aggregates.addresses.every((entry) => entry.accounts !== undefined),
      'every listed address names its accounts',
    ).toBe(true);
    // The two relationships MAX_LOGIN_IPS exists to keep, restated with the
    // accounts present: the listed rows plus `other` are the whole of
    // totalLogins, and so are the country figures plus the unknown bucket.
    const listed = aggregates.addresses.reduce((sum, a) => sum + a.logins, 0);
    expect(listed + aggregates.other.logins).toBe(aggregates.totalLogins);
    const tallied = aggregates.countries.reduce((sum, c) => sum + c.logins, 0);
    expect(tallied + aggregates.unknown.logins).toBe(aggregates.totalLogins);
    // And the accounts themselves changed no figure at all against the same
    // archive run without them.
    const unstamped = buildLogins(scaleSources(OVER_CAP), () => 'AA');
    expect(aggregates.totalLogins).toBe(unstamped.totalLogins);
    expect(aggregates.countries).toEqual(unstamped.countries);
    expect(aggregates.addresses.map((a) => a.ip)).toEqual(unstamped.addresses.map((a) => a.ip));
  });
});

describe('06-03: the account record is stored and NEVER counted (D-02)', () => {
  const ACCOUNT = {
    ip: '198.51.100.77',
    ipState: 'readable' as const,
    countryCode: 'PL',
    city: 'Warszawa',
  };

  it('is stored unchanged, and the aggregate is identical with it and without', () => {
    const without = buildLogins(scaleSources(), scaleLookup);
    const with_ = buildLogins(scaleSources(), scaleLookup, ACCOUNT);
    expect(with_.account).toEqual(ACCOUNT);
    // Every OTHER field is identical, which is the whole claim: the account row
    // is stored and is not a login, so it cannot move a tile, a country, the
    // unknown bucket or `other`.
    expect({ ...with_, account: null }).toEqual(without);
  });

  it('is absent by default, so a caller that has none says so rather than faking one', () => {
    expect(buildLogins(scaleSources(), scaleLookup).account).toBeNull();
  });

  it('keeps a BLANK cell and an UNREADABLE one as two different facts', () => {
    // The reason `ipState` exists: `ip: null` alone would render "not in export"
    // for a cell that was present and could not be read.
    const blank = buildLogins(scaleSources(), scaleLookup, {
      ip: null,
      ipState: 'blank',
      countryCode: null,
      city: null,
    });
    const unreadable = buildLogins(scaleSources(), scaleLookup, {
      ip: null,
      ipState: 'unreadable',
      countryCode: 'DE',
      city: 'Berlin',
    });
    expect(blank.account?.ipState).toBe('blank');
    expect(unreadable.account?.ipState).toBe('unreadable');
    expect(blank.account).not.toEqual(unreadable.account);
  });
});

describe('06-03: mixed and unreadable timestamps across one export (D-03)', () => {
  /** One source per date shape, so the range spans both. */
  function mixedSources(): LoginSource[] {
    const iso = '2019-03-13T20:00:00Z';
    const dotted = '13.03.2019 20:00';
    const rows = (
      stamps: readonly string[],
      column: string,
    ): Record<string, string | undefined>[] =>
      stamps.map((stamp) => ({ [column]: stamp, IP: LOGINS_IP_HOME }));
    return [
      { kind: 'logins', game: null, rows: rows([dotted, '14.03.2019 09:30'], 'LOGIN_DT') },
      { kind: 'logins', game: null, rows: rows([iso, 'not-a-date'], 'LOGIN_DT') },
    ];
  }

  it('counts every login and excludes only the unreadable stamps from the range', () => {
    const aggregates = buildLogins(mixedSources(), NO_TABLE);
    // Four rows, all readable addresses, so four logins.
    expect(aggregates.totalLogins).toBe(4);
    // Two stamps are readable and they are the SAME INSTANT in two formats,
    // which is what "two source date formats in one export read alike" means.
    expect(aggregates.first).toBe(wallSeconds('13.03.2019 20:00'));
    expect(aggregates.last).toBe(wallSeconds('14.03.2019 09:30'));
  });

  it('leaves first and last null when no stamp in the export is readable', () => {
    const aggregates = buildLogins(
      [{ kind: 'logins', game: null, rows: [{ LOGIN_DT: 'nope', IP: LOGINS_IP_HOME }] }],
      NO_TABLE,
    );
    expect(aggregates.totalLogins).toBe(1);
    expect(aggregates.first).toBeNull();
    expect(aggregates.last).toBeNull();
    // And the view still answers ready: rows exist, only their stamps did not.
    expect(viewFromLogins(aggregates).status).toBe('ready');
  });
});

describe('06-03: the three view statuses, at scale', () => {
  it('answers no-usable for an archive whose every address is unreadable', () => {
    const spec = buildLoginsScaleSpec();
    const junk: LoginsScaleFile[] = spec.files.map((file) => ({
      ...file,
      text: csvText(
        file.header,
        dataLines(file.text).map(() => 'x;nope;player@example.invalid'),
      ),
      intended: dataLines(file.text).map(() => null),
    }));
    const junkSpec: LoginsScaleSpec = { ...spec, files: junk };
    const aggregates = buildLogins(scaleSources(junkSpec), scaleLookup);
    expect(aggregates.totalLogins).toBe(0);
    expect(aggregates.unreadableRows).toBeGreaterThan(10_000);
    expect(viewFromLogins(aggregates)).toEqual({
      status: 'no-usable',
      unreadable: aggregates.unreadableRows,
    });
  });
});

/** The lines of a file after its header, CRLF dropped, blanks removed. */
function dataLines(text: string): string[] {
  return text
    .split('\r\n')
    .slice(1)
    .filter((line) => line !== '');
}

/** A file's whole text: the header, then one CRLF-terminated line per row. */
function csvText(header: string, lines: readonly string[]): string {
  return header + '\r\n' + lines.map((line) => line + '\r\n').join('');
}

// =============================================================================
// Phase 10, D-18 — an address NAMES its accounts, and names nothing else
//
// The whole block is about what the account set does and does NOT change. An
// address is still ONE row however many accounts logged in from it (D-05), the
// ranking is untouched, and the country and unknown figures are the numbers
// Phase 6 pinned. So every case here pairs its account assertion with a
// comparison against the SAME sources run without accounts — if accounts ever
// started splitting rows or moving a country total, that pair fails.
// =============================================================================

/** One WOT file holding one row per address, given as `[address]` per row. */
function ownedSource(account: string | undefined, addresses: readonly string[]): LoginSource {
  return {
    kind: 'sessions',
    game: 'WOT',
    rows: rowsOf(
      buildRealShapeCsv(addresses.map((ip) => ['06.03.2024 10:00', '06.03.2024 11:00', ip])),
    ),
    ...(account === undefined ? {} : { account }),
  };
}

describe('Phase 10: an address names the accounts that logged in from it (D-18)', () => {
  it('gives one address every account that contributed a row to it, sorted', () => {
    const aggregates = buildLogins(
      [
        ownedSource('root-b', ['192.0.2.10', '192.0.2.10']),
        ownedSource('root-a', ['192.0.2.10']),
        ownedSource('root-c', ['192.0.2.99']),
      ],
      NO_TABLE,
    );
    const home = aggregates.addresses.find((a) => a.ip === '192.0.2.10');
    // Three rows from root-b, one from root-a, and the SET is what makes it two
    // accounts rather than four "contributions".
    expect(home?.accounts).toEqual(['root-a', 'root-b']);
    expect(home?.logins).toBe(3);
    expect(aggregates.addresses.find((a) => a.ip === '192.0.2.99')?.accounts).toEqual(['root-c']);
  });

  it('does not split an address into a row per account, and moves no total', () => {
    const addresses = ['192.0.2.10', '192.0.2.11', '192.0.2.12'];
    const withAccounts = buildLogins(
      [ownedSource('root-a', addresses), ownedSource('root-b', addresses)],
      () => 'AA',
    );
    const without = buildLogins(
      [ownedSource(undefined, addresses), ownedSource(undefined, addresses)],
      () => 'AA',
    );

    // Three rows, not six: an address is an address (D-05), and a reader counting
    // "how many addresses have I logged in from" must not get a bigger answer
    // because there are two accounts.
    expect(withAccounts.addresses).toHaveLength(3);
    // `buildLogins` ALWAYS emits the field — the optionality in the type is for a
    // stored aggregate written before version 3, which is a cache shape and not
    // this function's output. So this asserts the presence, not a `?? []`.
    expect(
      withAccounts.addresses.every((address) => address.accounts !== undefined),
      'a fresh aggregate stamps every address',
    ).toBe(true);
    expect(withAccounts.addresses.map((a) => a.accounts?.length)).toEqual([2, 2, 2]);
    // Every other figure is byte-identical: the ranking, the country rollups,
    // the unknown bucket and the two totals the UI-SPEC's sums rest on.
    expect(withAccounts.addresses.map((a) => a.ip)).toEqual(without.addresses.map((a) => a.ip));
    expect(withAccounts.countries).toEqual(without.countries);
    expect(withAccounts.unknown).toEqual(without.unknown);
    expect(withAccounts.other).toEqual(without.other);
    expect(withAccounts.totalLogins).toBe(without.totalLogins);
    expect(withAccounts.unreadableRows).toBe(without.unreadableRows);
    const tallied = withAccounts.countries.reduce((sum, c) => sum + c.logins, 0);
    expect(tallied + withAccounts.unknown.logins).toBe(withAccounts.totalLogins);
  });

  it('gives an address an empty list when no source named an owner', () => {
    // A legacy or hand-built source carries no account. It must contribute
    // NOTHING — not `undefined` on the row, not a fabricated root — and it must
    // not throw, because `buildLogins` never throws on data.
    const aggregates = buildLogins([ownedSource(undefined, ['192.0.2.10'])], NO_TABLE);
    expect(aggregates.addresses[0]?.accounts).toEqual([]);
    expect(aggregates.totalLogins).toBe(1);
  });

  it('treats a root named __proto__ as an ordinary account string (T-10-09)', () => {
    // The account is a zip folder name, so a hostile one is a string and must
    // round-trip through the set, the sort and the stored array like any other.
    const aggregates = buildLogins(
      [ownedSource('__proto__', ['192.0.2.10']), ownedSource('constructor', ['192.0.2.10'])],
      NO_TABLE,
    );
    expect(aggregates.addresses[0]?.accounts).toEqual(['__proto__', 'constructor']);
  });

  it('passes the addresses through the view verbatim, accounts included', () => {
    // `viewFromLogins` copies the stored array, so a filter that dropped the
    // field here would leave the table silently untagged with no error.
    const aggregates = buildLogins([ownedSource('root-a', ['192.0.2.10'])], NO_TABLE);
    const view = viewFromLogins(aggregates);
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') throw new Error('unreachable: asserted above');
    expect(view.addresses).toBe(aggregates.addresses);
    expect(view.addresses[0]?.accounts).toEqual(['root-a']);
  });
});
