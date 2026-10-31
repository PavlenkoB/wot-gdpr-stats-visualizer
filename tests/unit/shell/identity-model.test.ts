import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import { ruleDeclarations, styleText } from '../../helpers/css.ts';
import { readTokenSource } from '../../helpers/styles.ts';
import {
  accountCountOf,
  accountRows,
  accountTagsFor,
  accountTagsOf,
  earliestCreated,
  hasMultipleRoots,
  letterOf,
  rootCountOf,
  tagLabel,
} from '../../../src/lib/shell/identity-model.ts';
import { IDENTITY_NO_ACTIVITY, UNKNOWN_VALUE, formatAccountId } from '../../../src/lib/ui-copy.ts';
import type {
  AccountSummary,
  ClassifyResult,
} from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// identity-model.ts — the multi-account identity header's decisions
// (Phase 9, plan 09-04; D-13 … D-17, UI-SPEC Surface 1)
// =============================================================================
//
// WHAT THIS FILE IS
// Every decision the multi header makes about DATA — is this a multi dataset,
// what does one row show, whose identity does it show, what is the earliest
// creation date — lives in a pure module, because `vitest.config.ts` runs in
// Node with no Svelte plugin and a component cannot be rendered in a unit test at
// all. The component keeps the wiring and nothing else.
//
// WHY THE SHAPES MATTER MORE THAN THE HAPPY PATH
// Every one of these inputs is reachable from a real export:
//   - an account folder with NO User_Info at all (the user's own RU account);
//   - a User_Info row whose NAME cell is blank;
//   - an account that played no game, or never played at all;
//   - a `CREATED_AT` the export wrote in the European dotted shape, or not at
//     all, or in a shape that is not a date;
//   - two accounts sharing a nickname, a first year, or both;
//   - untrusted text that tries to be markup.
//
// A model that only handles the three-account happy path would pass the browser
// test and fail the user's own zip.
//
// THE TWO PRIVACY INVARIANTS PINNED HERE
//   T-09-18 a nickname and an account ID are passed through as TEXT and are
//           never transformed, trimmed or escaped here;
//   T-09-20 a row reads ONLY its own AccountSummary, so the legacy first-account
//           identity cannot stand in for a root that has none of its own.
// =============================================================================

/** One account summary, as the worker would publish it. */
function account(over: Partial<AccountSummary> = {}): AccountSummary {
  return {
    root: '1000000003',
    identity: {
      nickname: 'Synthetic NA Commander',
      region: 'NA',
      createdAt: '2021-05-10 15:00:00',
    },
    games: ['WOT', 'WOTB'],
    firstYear: 2021,
    lastYear: 2026,
    ...over,
  };
}

/** A `ClassifyResult` carrying `accounts`, with no legacy identity by default. */
function result(accounts: AccountSummary[] | undefined, over: Partial<ClassifyResult> = {}) {
  return {
    accountRoot: accounts?.[0]?.root ?? '',
    categories: [],
    counts: { supported: 0, 'known-deferred': 0, unknown: 0 },
    ...(accounts === undefined ? {} : { accounts }),
    ...over,
  } satisfies ClassifyResult;
}

describe('accountCountOf', () => {
  test('no export is zero accounts', () => {
    expect(accountCountOf(null)).toBe(0);
  });

  test('a result with no accounts field is ONE account — the v1.0 shape', () => {
    // D-22: a cache written before Phase 9 normalises to a one-entry list, and
    // the single-account header must keep rendering exactly as it did.
    expect(accountCountOf(result(undefined))).toBe(1);
  });

  test('an explicitly empty list is also ONE account', () => {
    expect(accountCountOf(result([]))).toBe(1);
  });

  test('an empty list beside a rootCount of 2 is ZERO accounts, not one', () => {
    // An archive of several folders in which none stores data holds no accounts.
    expect(accountCountOf(result([], { rootCount: 2 }))).toBe(0);
  });

  test('a non-empty list is its own length', () => {
    expect(accountCountOf(result([account(), account({ root: '2000002' })]))).toBe(2);
    expect(
      accountCountOf(result([account(), account({ root: '200' }), account({ root: '300' })])),
    ).toBe(3);
  });
});

describe('rootCountOf', () => {
  test('no export is zero folders', () => {
    expect(rootCountOf(null)).toBe(0);
  });

  test('a result with no accounts and no rootCount is ONE folder', () => {
    expect(rootCountOf(result(undefined))).toBe(1);
  });

  test('a rootCount of 3 beside one published account is 3', () => {
    expect(rootCountOf(result([account()], { rootCount: 3 }))).toBe(3);
  });

  test('no rootCount beside two published accounts falls back to 2', () => {
    // The fallback that keeps every pre-09-11 fixture and cache multi.
    expect(rootCountOf(result([account(), account({ root: '200' })]))).toBe(2);
  });

  test('a rootCount smaller than the published length yields the published length', () => {
    expect(
      rootCountOf(
        result([account(), account({ root: '200' }), account({ root: '300' })], { rootCount: 1 }),
      ),
    ).toBe(3);
  });
});

describe('hasMultipleRoots', () => {
  test('two or more folders, and nothing else', () => {
    expect(hasMultipleRoots(null)).toBe(false);
    expect(hasMultipleRoots(result(undefined))).toBe(false);
    expect(hasMultipleRoots(result([]))).toBe(false);
    expect(hasMultipleRoots(result([account()]))).toBe(false);
    expect(hasMultipleRoots(result([account(), account({ root: '200' })]))).toBe(true);
  });

  test('one published account from a two-folder archive is multi (Truth 21)', () => {
    const oneOfTwo = result([account()], { rootCount: 2 });
    expect(hasMultipleRoots(oneOfTwo)).toBe(true);
    // The published meaning of the count is untouched.
    expect(accountCountOf(oneOfTwo)).toBe(1);
  });

  test('a rootCount of 1 beside one account is not multi', () => {
    expect(hasMultipleRoots(result([account()], { rootCount: 1 }))).toBe(false);
  });
});

describe('accountRows', () => {
  test('an account with no User_Info is an ID-only row (D-17, T-09-20)', () => {
    const rows = accountRows([account({ root: '2000002', identity: null })]);
    expect(rows[0]?.idOnly).toBe(true);
    expect(rows[0]?.name).toBe('2000002');
    // The ID line is omitted, because the ID is already the title (v1.0 D-16).
    expect(rows[0]?.idLine).toBeNull();
  });

  test('an ID-only row never shows another account nickname', () => {
    const rows = accountRows([
      account({ root: '500000001' }),
      account({ root: '2000002', identity: null }),
    ]);
    expect(rows[1]?.name).toBe('2000002');
    expect(rows[1]?.name).not.toContain('Synthetic');
  });

  test('a row with an identity keeps its own ID line', () => {
    const rows = accountRows([account({ root: '500000001' })]);
    expect(rows[0]?.idOnly).toBe(false);
    expect(rows[0]?.idLine).toBe(formatAccountId('500000001'));
  });

  test('a null nickname is Unknown and the ID line survives', () => {
    const rows = accountRows([
      account({ identity: { nickname: null, region: 'EU', createdAt: null } }),
    ]);
    expect(rows[0]?.name).toBe(UNKNOWN_VALUE);
    expect(rows[0]?.idLine).not.toBeNull();
  });

  test('a blank nickname is Unknown too — a blank line is not an answer', () => {
    const rows = accountRows([
      account({ identity: { nickname: '   ', region: null, createdAt: null } }),
    ]);
    expect(rows[0]?.name).toBe(UNKNOWN_VALUE);
  });

  test('an account with no game token has NO games value at all', () => {
    // UI-SPEC, empty/identity header/Games row: the caller omits the term AND
    // the value rather than rendering an empty <dd>.
    const rows = accountRows([account({ games: [] })]);
    expect(rows[0]?.games).toBeNull();
  });

  test('games read as the long names, comma separated', () => {
    const rows = accountRows([account({ games: ['WOT', 'WOTB', 'WOTC'] })]);
    expect(rows[0]?.games).toBe('World of Tanks, WoT Blitz, WoT Console');
  });

  test('no usable session is the no-activity sentence (D-15)', () => {
    const rows = accountRows([account({ firstYear: null, lastYear: null })]);
    expect(rows[0]?.activity).toBe(IDENTITY_NO_ACTIVITY);
  });

  test('a first year with no last year falls back to the first', () => {
    const rows = accountRows([account({ firstYear: 2014, lastYear: null })]);
    expect(rows[0]?.activity).toBe('2014');
  });

  test('a full range reads first to last', () => {
    const rows = accountRows([account({ firstYear: 2012, lastYear: 2021 })]);
    expect(rows[0]?.activity).toBe('2012–2021');
  });

  test('two accounts sharing a nickname and a year are two rows (adjacency)', () => {
    // The template keys by INDEX for exactly this: a key built from a nickname
    // or a year could repeat.
    const shared = 'Shared Synthetic Name';
    const rows = accountRows([
      account({ root: '100', identity: { nickname: shared, region: null, createdAt: null } }),
      account({ root: '200', identity: { nickname: shared, region: null, createdAt: null } }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.name).toBe(shared);
    expect(rows[1]?.name).toBe(shared);
  });

  test('the rows come out in the order given — the shell never re-sorts (D-16)', () => {
    // The worker stores D-16 order and every producer sorts with `sortAccounts`;
    // a second comparator here could disagree with the first.
    const rows = accountRows([
      account({ root: '300', firstYear: 2019 }),
      account({ root: '100', firstYear: 2011 }),
    ]);
    expect(rows.map((row) => row.idLine)).toEqual([formatAccountId('300'), formatAccountId('100')]);
  });

  test('a hostile nickname and a 200-character root pass through unchanged as text', () => {
    // T-09-18: the model concatenates and returns; escaping belongs to the
    // renderer's interpolation, which does it for every value in the app.
    const markup = '<b>x</b>';
    const longRoot = 'a'.repeat(200);
    const rows = accountRows([
      account({
        root: longRoot,
        identity: { nickname: markup, region: null, createdAt: null },
      }),
    ]);
    expect(rows[0]?.name).toBe(markup);
    expect(rows[0]?.idLine).toBe(formatAccountId(longRoot));
  });

  test('the legacy first-account identity is ignored entirely (T-09-20)', () => {
    // The result carries a DIFFERENT account's identity; the row must not read
    // it. `accountRows` is handed only the list, which is what makes this
    // structural rather than a rule someone has to remember.
    const rows = accountRows([account({ root: '2000002', identity: null })]);
    expect(rows[0]?.name).toBe('2000002');
    expect(rows[0]?.idOnly).toBe(true);
  });

  test('an empty list gives no rows, not a blank row', () => {
    expect(accountRows([])).toEqual([]);
  });
});

// =============================================================================
// Phase 10, D-10 — the account tag: its letter, its order and its visibility
// =============================================================================
//
// The letter is DERIVED from the position in the worker's published list, which
// is what makes the identity header's legend and a Vehicles row's chip agree
// without either of them storing a letter. These tests therefore pin three
// things at once: the letter sequence (including past Z), that the projection
// never re-sorts, and that a root named `__proto__` is an ordinary key (T-10-09).

describe('letterOf', () => {
  test('zero is A and twenty-five is Z — bijective base-26, not plain base-26', () => {
    expect(letterOf(0)).toBe('A');
    expect(letterOf(1)).toBe('B');
    expect(letterOf(25)).toBe('Z');
  });

  test('twenty-six is AA and twenty-seven is AB, not BA', () => {
    // Plain base-26 would put twenty-six at `BA` and leave `AA` after `Z` with
    // nothing before it; the chip row would then read A..Z, BA, BB, which is
    // not a count the reader can check.
    expect(letterOf(26)).toBe('AA');
    expect(letterOf(27)).toBe('AB');
  });

  test('the thirty-second account is AF — the import cap ends here', () => {
    // `MAX_ACCOUNT_ROOTS` is 32, so AF is the longest letter a real archive can
    // produce; the test says so rather than trusting the constant to stay put.
    expect(letterOf(31)).toBe('AF');
    expect(letterOf(51)).toBe('AZ');
    expect(letterOf(52)).toBe('BA');
  });

  test('a negative index is the empty string, not a throw', () => {
    // The value comes from a list this module walks, so a negative index is a
    // bug elsewhere — and an empty chip draws nothing rather than taking the
    // page down on a render.
    expect(letterOf(-1)).toBe('');
  });
});

describe('accountTagsOf', () => {
  test('letters follow the GIVEN order, and the given order is never re-sorted', () => {
    // Deliberately NOT in D-16 order (NA first, then RU, then EU). The letters
    // are positions in the list the worker gave, so a re-sort here would put a
    // different letter on the same account than the header row above it does.
    const tags = accountTagsOf([
      account({ root: '1000000003' }),
      account({ root: '2000002', identity: null }),
      account({ root: '500000001' }),
    ]);
    expect([...tags.values()].map((tag) => tag.letter)).toEqual(['A', 'B', 'C']);
    expect([...tags.keys()]).toEqual(['1000000003', '2000002', '500000001']);
  });

  test('the same list yields the same letters the header rows use (D-10, D-16)', () => {
    // The real fixture's D-16 order: RU 2012, EU 2018, NA 2021.
    const tags = accountTagsOf([
      account({ root: '2000002', identity: null }),
      account({ root: '500000001' }),
      account({ root: '1000000003' }),
    ]);
    expect(tags.get('2000002')?.letter).toBe('A');
    expect(tags.get('500000001')?.letter).toBe('B');
    expect(tags.get('1000000003')?.letter).toBe('C');
  });

  test('a root named __proto__ or constructor is an ordinary key (T-10-09)', () => {
    // The key is a zip folder name. An object would drop `__proto__` on
    // assignment and answer `tags.get('constructor')` from the prototype chain;
    // a Map makes both ordinary, and `get` cannot walk a chain.
    const tags = accountTagsOf([
      account({ root: '__proto__', identity: null }),
      account({ root: 'constructor', identity: null }),
    ]);
    expect(tags.size, 'both hostile roots are stored').toBe(2);
    expect(tags.get('__proto__')?.letter).toBe('A');
    expect(tags.get('constructor')?.letter).toBe('B');
    expect(Object.prototype.hasOwnProperty.call(tags, '__proto__')).toBe(false);
  });

  test('a missing, null or blank nickname is null — never the Unknown placeholder', () => {
    const tags = accountTagsOf([
      account({ root: '1', identity: null }),
      account({ root: '2', identity: { nickname: null, region: null, createdAt: null } }),
      account({ root: '3', identity: { nickname: '   ', region: null, createdAt: null } }),
      account({ root: '4', identity: { nickname: 'Real', region: null, createdAt: null } }),
    ]);
    expect(tags.get('1')?.nickname).toBeNull();
    expect(tags.get('2')?.nickname).toBeNull();
    expect(tags.get('3')?.nickname).toBeNull();
    expect(tags.get('4')?.nickname).toBe('Real');
    // `Unknown` is the visible HEADING's word; repeating it inside a hidden
    // phrase would announce an absence as though it were a value.
    expect(tagLabel(tags.get('2')!)).not.toContain(UNKNOWN_VALUE);
  });

  test('a repeated root keeps its FIRST letter', () => {
    // A malformed result, not an expected one: the answer has to be stable
    // rather than "whatever the last entry said".
    const tags = accountTagsOf([account({ root: 'dup' }), account({ root: 'dup' })]);
    expect(tags.size).toBe(1);
    expect(tags.get('dup')?.letter).toBe('A');
  });

  test('an empty list is an empty map, not a tag', () => {
    expect(accountTagsOf([]).size).toBe(0);
  });
});

describe('accountTagsFor', () => {
  test('null with no export at all', () => {
    expect(accountTagsFor(null)).toBeNull();
  });

  test('null for a one-account result, in both published shapes', () => {
    // The v1.0 shape carries no `accounts` field at all and counts as one
    // account; the one-account list is the other published shape.
    expect(accountTagsFor(result(undefined))).toBeNull();
    expect(accountTagsFor(result([account({ root: 'only' })]))).toBeNull();
  });

  test('null for a two-folder archive in which no folder stored data', () => {
    // `accountCountOf` is zero here — the published list is empty and the folder
    // count is two — so there is no account to letter and no legend to draw.
    expect(accountTagsFor(result([], { rootCount: 2 }))).toBeNull();
  });

  test('the map for two accounts or more', () => {
    const tags = accountTagsFor(
      result([account({ root: '2000002', identity: null }), account({ root: '500000001' })]),
    );
    expect(tags).not.toBeNull();
    expect(tags!.size).toBe(2);
    expect(tags!.get('500000001')?.letter).toBe('B');
  });

  test('the tag phrase names the letter, the ID and the nickname — as TEXT', () => {
    const tags = accountTagsOf([
      account({
        root: '500000001',
        identity: { nickname: 'Synthetic EU Captain', region: null, createdAt: null },
      }),
      account({ root: '2000002', identity: null }),
    ]);
    expect(tagLabel(tags.get('500000001')!)).toBe(
      'Account A, ID 500000001, nickname Synthetic EU Captain',
    );
    expect(tagLabel(tags.get('2000002')!)).toBe('Account B, ID 2000002');
  });

  test('a hostile nickname passes through unchanged (T-09-18)', () => {
    const hostile = '<b onclick="x">nick</b>';
    const tags = accountTagsOf([
      account({ root: '1', identity: { nickname: hostile, region: null, createdAt: null } }),
    ]);
    // Concatenated, never escaped or trimmed: escaping is Svelte's job at the
    // interpolation, which does it for every string in this app.
    expect(tagLabel(tags.get('1')!)).toBe(`Account A, ID 1, nickname ${hostile}`);
  });
});

describe('earliestCreated', () => {
  test('the minimum across accounts, from an ISO value', () => {
    const earliest = earliestCreated([
      account({ identity: { nickname: 'b', region: null, createdAt: '2021-05-10 15:00:00' } }),
      account({
        root: '500000001',
        identity: { nickname: 'a', region: null, createdAt: '2018-02-14 18:00:00' },
      }),
    ]);
    expect(earliest).toBe('2018-02-14');
  });

  test('a dotted European value is understood and compares correctly', () => {
    // `DD.MM.YYYY` sorts AFTER every ISO string lexicographically, so a naive
    // string comparison would pick the 2018 account. It is parsed into numbers
    // and compared as a date instead.
    const earliest = earliestCreated([
      account({ identity: { nickname: 'a', region: null, createdAt: '2018-02-14' } }),
      account({
        root: '500000001',
        identity: { nickname: 'b', region: null, createdAt: '02.03.2015' },
      }),
    ]);
    // The winner is shown AS THE EXPORT WROTE IT, which is what
    // `formatCreatedDate` does everywhere else: this viewer never reformats a
    // date the export owns, because doing so would need a timezone it does not
    // have. The comparison is normalised; the rendering is not.
    expect(earliest).toBe('02.03.2015');
  });

  test('two dotted values compare by their numbers, not their digits', () => {
    // Read as DIGITS, `01.01.2020` sorts before `31.12.2019` — which is the
    // right answer here, but only because the comparison reads month 12 against
    // month 01. Swapping the two inputs makes each shape win in turn.
    const earliest = earliestCreated([
      account({ identity: { nickname: 'a', region: null, createdAt: '02.03.2015' } }),
      account({
        root: '500000001',
        identity: { nickname: 'b', region: null, createdAt: '01.03.2015' },
      }),
    ]);
    expect(earliest).toBe('01.03.2015');
    expect(
      earliestCreated([
        account({ identity: { nickname: 'a', region: null, createdAt: '01.03.2015' } }),
        account({ root: '2', identity: { nickname: 'b', region: null, createdAt: '02.03.2015' } }),
      ]),
    ).toBe('01.03.2015');
    // A year boundary is the case a lexicographic comparison gets right by
    // accident and a DAY comparison would get wrong.
    expect(
      earliestCreated([
        account({ identity: { nickname: 'a', region: null, createdAt: '31.12.2019' } }),
        account({ root: '2', identity: { nickname: 'b', region: null, createdAt: '01.01.2020' } }),
      ]),
    ).toBe('31.12.2019');
  });

  test('months are compared as months, not as strings', () => {
    const earliest = earliestCreated([
      account({ identity: { nickname: 'a', region: null, createdAt: '2020-09-01' } }),
      account({ root: '2', identity: { nickname: 'b', region: null, createdAt: '2020-10-01' } }),
    ]);
    expect(earliest).toBe('2020-09-01');
  });

  test('an unparseable value is skipped, not guessed at', () => {
    const earliest = earliestCreated([
      account({ identity: { nickname: 'a', region: null, createdAt: 'sometime in 2015' } }),
      account({ root: '2', identity: { nickname: 'b', region: null, createdAt: '2020-01-01' } }),
    ]);
    expect(earliest).toBe('2020-01-01');
  });

  test('an account with no identity contributes nothing', () => {
    expect(
      earliestCreated([
        account({ identity: null }),
        account({ root: '2', identity: { nickname: 'b', region: null, createdAt: '2020-01-01' } }),
      ]),
    ).toBe('2020-01-01');
  });

  test('null when nothing parses — the card then says the date is unknown', () => {
    expect(earliestCreated([])).toBeNull();
    expect(earliestCreated([account({ identity: null })])).toBeNull();
    expect(
      earliestCreated([account({ identity: { nickname: 'a', region: null, createdAt: null } })]),
    ).toBeNull();
  });

  test('2020-02-30 is not a date', () => {
    // `daysInMonth` is the check: accepting it would silently normalise to a
    // March day, and a card would name a day the export never wrote.
    expect(
      earliestCreated([
        account({ identity: { nickname: 'a', region: null, createdAt: '2020-02-30' } }),
      ]),
    ).toBeNull();
    // 2020 IS a leap year, so the same day in 2019 is genuinely invalid.
    expect(
      earliestCreated([
        account({ identity: { nickname: 'a', region: null, createdAt: '2019-02-29' } }),
      ]),
    ).toBeNull();
    // ...and 2020-02-29 is fine.
    expect(
      earliestCreated([
        account({ identity: { nickname: 'a', region: null, createdAt: '2020-02-29' } }),
      ]),
    ).toBe('2020-02-29');
  });

  test('13.13.2020 is rejected — month 13 does not exist', () => {
    expect(
      earliestCreated([
        account({ identity: { nickname: 'a', region: null, createdAt: '13.13.2020' } }),
      ]),
    ).toBeNull();
  });

  test('the module never constructs a Date, so no timezone can shift a day', () => {
    // The reason the comparison is integer arithmetic (D-01 of civil-date.ts):
    // a wall-clock stamp in an export is not an instant.
    const source = readFileSync(
      new URL('../../../src/lib/shell/identity-model.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/new Date|Date\.UTC|toLocaleDateString/);
  });
});

// =============================================================================
// The header's SOURCE contract (the wiring a pure-function test cannot see)
// =============================================================================
//
// Read LAZILY through `componentPath`, so a component that has not been written
// yet fails as an assertion naming the missing contract rather than as a
// module-load crash. The forbidden patterns live HERE and in no other file.

/** The component's source, with comments stripped. */
function headerSource(): string {
  let source: string;
  try {
    source = readFileSync(componentPath('IdentityHeader.svelte'), 'utf8');
  } catch {
    return '';
  }
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

describe('IdentityHeader.svelte — the multi variant wiring', () => {
  test('the seven multi test ids are all present', () => {
    const source = headerSource();
    for (const id of [
      'identity-multi-title',
      'identity-multi-list',
      'identity-multi-row',
      'identity-multi-name',
      'identity-multi-id',
      'identity-multi-games',
      'identity-multi-years',
    ]) {
      expect(source, `${id} is rendered`).toContain(`data-testid="${id}"`);
    }
  });

  test('the variant switch asks hasMultipleRoots and never the published count', () => {
    const source = headerSource();
    expect(source).toContain('hasMultipleRoots(result)');
    expect(source).not.toContain('accountCountOf');
  });

  test('the v1.0 single-account ids are still there, unchanged', () => {
    const source = headerSource();
    for (const id of [
      'identity-nickname',
      'identity-region',
      'identity-created',
      'identity-account-id',
    ]) {
      expect(source, `${id} is still rendered`).toContain(`data-testid="${id}"`);
    }
  });

  test('the list is an explicit role="list" and carries the static label', () => {
    // The list-style reset drops list semantics in some engines, which is why
    // the role is explicit rather than implied by the <ol>.
    const source = headerSource();
    expect(source).toMatch(/role="list"/);
    expect(source).toContain('aria-label={IDENTITY_MULTI_LIST_LABEL}');
  });

  test('an ID-only row is marked with data-user-info', () => {
    const source = headerSource();
    expect(source).toContain("data-user-info={row.idOnly ? 'absent' : undefined}");
  });

  test('the row title takes a conditional ID-only modifier, and keeps its text and element', () => {
    // D-17 / T-09-28: an account with no User_Info must not wear the row's
    // most prominent type. The demotion is a TYPE change on the SAME `h3`, and
    // the account root stays inside it — a row that hid or moved its ID would
    // take away the only identifier a rootless account has.
    const source = headerSource();
    expect(source, 'the title binds a modifier off row.idOnly').toContain(
      'class:id-only={row.idOnly}',
    );

    // ONE element carries all three: the `h3`, the documented test id and the
    // row's own name as its text. The `[\s\S]*?` hops attribute line breaks, so
    // this survives a Prettier reflow rather than pinning a formatting choice.
    const title = source.match(
      /<h3\b(?=[^>]*data-testid="identity-multi-name")(?=[^>]*class:id-only=\{row\.idOnly\})[^>]*>([\s\S]*?)<\/h3>/,
    );
    expect(title, 'the ID-only title is the same h3, with the modifier').not.toBeNull();
    expect(title?.[1]?.trim(), 'the title renders the row name, not a prefix or a fallback').toBe(
      '{row.name}',
    );
  });

  test('both fact labels come from constants, never from a literal in the template', () => {
    const source = headerSource();
    expect(source).toContain('{IDENTITY_GAMES_LABEL}');
    expect(source).toContain('{IDENTITY_ACTIVITY_LABEL}');
    expect(source).not.toMatch(/<dt>Games<\/dt>|<dt>Activity<\/dt>/);
  });

  test('the each block is keyed by index, never by a value two accounts may share', () => {
    const source = headerSource();
    expect(source).toMatch(/\{#each rows as row, index \(index\)\}/);
  });

  test('no raw-markup directive: untrusted values are interpolated as text', () => {
    // T-09-18. `{@html}` would let an untrusted nickname or account ID become
    // markup; there is no such directive in this file.
    expect(headerSource()).not.toContain('{@html');
  });

  test('no title attribute and no tooltip anywhere in the file', () => {
    // D-21 restated per row: a nickname in a title would be a second copy of it
    // in the markup and a second announcement in the accessibility tree.
    const source = headerSource();
    expect(source).not.toMatch(/\btitle\s*=/);
    expect(source).not.toMatch(/aria-describedby/);
  });

  test('no aria-label interpolates a row value', () => {
    const source = headerSource();
    const labels = [...source.matchAll(/aria-label=\{([^}]*)\}/g)].map((match) => match[1] ?? '');
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label, 'an aria-label must be a constant').not.toMatch(
        /row\.|\.nickname|\.name|\.root/,
      );
    }
  });

  test('no media query, no transition and no animation in the component', () => {
    // One phone block lives in src/app.css; a component query would be a second
    // one, and the phase8 UI-review guard pins that there is exactly one.
    const source = headerSource();
    expect(source).not.toContain('@media');
    expect(source).not.toMatch(/transition|animation|@keyframes/);
  });

  test('no aria-live: the caption is static text (UI-SPEC Surface 2)', () => {
    expect(headerSource()).not.toContain('aria-live');
  });

  test('the identity titles follow the shared title role, not a phone override', () => {
    // The four heading elements carry the shared Title role. The role reads
    // `--fs-title`, which is the display size by default and the stat size
    // from 900px up.
    const source = headerSource();
    for (const className of ['nickname', 'skeleton-title', 'fallback-title', 'multi-title']) {
      expect(source, `${className} takes the title role`).toContain(`class="t-title ${className}"`);
    }

    const tokens = readTokenSource();
    expect(tokens, 'the title size is the display size by default').toMatch(
      /--fs-title:\s*var\(--fs-display\)/,
    );
    expect(tokens, 'the title size is the stat size from 900px up').toMatch(
      /@media\s*\(min-width:\s*900px\)\s*\{[\s\S]*?--fs-title:\s*var\(--fs-stat\)/,
    );

    // The phone block no longer names the titles. The old rule had a
    // specificity of (0,3,0) and would have beaten the role of (0,1,0), so it
    // was DELETED rather than restated: an override is a second answer to
    // "how big is a title", and the role is the one answer.
    const appCss = readFileSync(new URL('../../../src/app.css', import.meta.url), 'utf8');
    expect(appCss).not.toContain('.multi-title');
    const phoneBlocks = appCss.match(/max-width\s*:\s*480px/g) ?? [];
    expect(phoneBlocks, 'exactly one phone block under src').toHaveLength(1);
  });

  test('the row name takes the heading role, and an ID-only row is still demoted', () => {
    // The named row's title is a row title, not a pane title: the Heading
    // role (18 / 600 / 1.3), never the Title role.
    const source = headerSource();
    expect(source).toContain('class="t-heading multi-name"');

    // The demotion is a TYPE change and it has to survive the role: the
    // ID-only rule still declares the 14px token, the semibold weight and the
    // muted colour, and it outranks the role on specificity.
    const body = ruleDeclarations(styleText(source), '.multi-name.id-only');
    expect(body, 'the ID-only rule exists').not.toBe('');
    expect(body).toContain('font-size: var(--fs-body);');
    expect(body).toContain('font-weight: var(--fw-semibold);');
    expect(body).toContain('color: var(--muted);');
  });
});
