import { describe, expect, test } from 'vitest';
// A NAMESPACE import on purpose, for the same reason tests/unit/shell/ui-copy.test.ts
// uses one: a named import of a constant that does not exist yet is a link error
// that takes the whole file down, so a RED run would report zero discovered tests
// instead of one failing test per assertion. With a namespace each test fails on
// its own value assertion and the rest of the file still runs.
import * as loginCopy from '../../../src/lib/ui-copy.ts';

// =============================================================================
// login-copy — the Phase 6 copy inventory (06-02-PLAN Task 3)
// =============================================================================
//
// Every string in 06-UI-SPEC's Copywriting Contract, pinned byte for byte, and
// every rule of its section 7, pinned by a table-driven test.
//
// Why this file and not the UI plans' tests: the four capability plans
// (06-08 table, 06-10 map, 06-12 list, 06-13 city) read these exports and
// assert that they RENDER the right string for a given dataset. This file
// asserts that the string itself is the one the contract specifies. A
// component test cannot catch a sentence that was reworded in both places at
// once; this file can.
//
// Locale: `tests/unit/setup.ts` pins the default to `en-US`, so every
// expectation here is comma-grouped. The one place the locale is passed
// explicitly is the grouping test, which is about the parameter existing.
const EN = 'en-US';

// -----------------------------------------------------------------------------
// The two recorded UI-SPEC review decisions
// -----------------------------------------------------------------------------
// 06-UI-SPEC Delta 10 and Delta 11. Both are decisions rather than strings: a
// reviewer reading this file should see WHICH of the two offered options was
// chosen without opening the SUMMARY. Each test below pins the chosen value
// AND the fact that the unchosen one was a value the plan explicitly allowed,
// so a later "tidying" of a constant back toward the contract text fails here
// rather than in a component that reads it.
describe('CITY_CANCEL_LABEL — 06-UI-SPEC Delta 11', () => {
  test('is the self-describing label the checkpoint chose (option-b)', () => {
    expect(loginCopy.CITY_CANCEL_LABEL).toBe('Cancel download');
  });

  test('is one of the two values the checkpoint offered', () => {
    // The checkpoint offered `Cancel` (option-a, the contract's original text)
    // and `Cancel download` (option-b, chosen). Either is a legal answer; a
    // third value would mean the constant and the recorded decision disagree.
    expect(['Cancel', 'Cancel download']).toContain(loginCopy.CITY_CANCEL_LABEL);
  });

  test('does not reuse the contract text the deviation moved away from', () => {
    // Not a tautology: this is the assertion that fails if someone reverts the
    // constant to `Cancel` while leaving the Delta 11 note in place.
    expect(loginCopy.CITY_CANCEL_LABEL).not.toBe('Cancel');
  });
});

describe('CITY_CANCELLED_TONE — 06-UI-SPEC Delta 10, the D-14 deviation', () => {
  test("is the checkpoint's neutral tone (option-a), not the error tone", () => {
    expect(loginCopy.CITY_CANCELLED_TONE).toBe('neutral');
  });

  test('is one of the two tones the checkpoint offered', () => {
    // D-14's literal wording ("with a visible error") would be 'error'; the
    // UI-SPEC review's proposal was 'neutral'. The checkpoint chose 'neutral'.
    expect(['neutral', 'error']).toContain(loginCopy.CITY_CANCELLED_TONE);
  });

  test("is not D-14's literal 'visible error' reading", () => {
    expect(loginCopy.CITY_CANCELLED_TONE).not.toBe('error');
  });
});

// -----------------------------------------------------------------------------
// The pinned strings
// -----------------------------------------------------------------------------
// Copywriting Contract "New copy" table, row by row. `null` is not a legal
// entry in any of these tuples: a missing constant has to be an absent key,
// which TypeScript and a red test both report, rather than an empty string
// that reads as a designed choice.
const PINNED_STRINGS: ReadonlyArray<readonly [string, string]> = [
  // Block states.
  ['LOGIN_HISTORY_LOADING', 'Calculating login history...'],
  [
    'LOGIN_HISTORY_NO_SOURCE',
    'This export has no session or login file, so there is no login history to show.',
  ],
  ['LOGIN_HISTORY_NO_USABLE', 'No readable IP addresses were found in this export.'],
  [
    'LOGIN_HISTORY_ERROR',
    'Login history could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry.',
  ],

  // Reveal control.
  ['MASK_TOGGLE_SHOW', 'Show full IP addresses'],
  ['MASK_TOGGLE_HIDE', 'Hide full IP addresses'],
  ['MASK_CAPTION_MASKED', 'IP addresses are masked: the last part of each one is hidden.'],
  [
    'MASK_CAPTION_REVEALED',
    'Full IP addresses are shown. Hide them again before sharing your screen.',
  ],
  ['MASK_ANNOUNCE_SHOWN', 'Full IP addresses are now shown.'],
  ['MASK_ANNOUNCE_MASKED', 'IP addresses are now masked.'],

  // Tile labels. The three count tiles and the three fact tiles.
  ['LOGIN_TILE_IPS', 'IP addresses'],
  ['LOGIN_TILE_COUNTRIES', 'Countries'],
  ['LOGIN_TILE_UNKNOWN', 'IPs with unknown country'],
  ['LOGIN_TILE_TOP_IP', 'Most-used IP address'],
  ['LOGIN_TILE_TOP_COUNTRY', 'Top country'],
  ['LOGIN_TILE_RANGE', 'First to last login'],

  // Multi-file note: shown only when more than one file contributed logins.
  [
    'LOGIN_MULTI_FILE_NOTE',
    'This export lists logins in more than one file, and each file’s rows are counted.',
  ],

  // Special values.
  ['LOGIN_UNKNOWN_COUNTRY', 'Unknown country'],
  ['LOGIN_GAMES_NOT_RECORDED', 'not recorded'],
  ['LOGIN_CITY_UNKNOWN', 'City unknown'],
  ['LOGIN_NOT_IN_EXPORT', 'not in export'],
  ['LOGIN_NOT_READABLE', 'not readable'],
  ['LOGIN_NO_VALUE', '—'],
  // The hidden text that replaces a dash for a screen reader.
  ['LOGIN_HIDDEN_NO_KNOWN_COUNTRY', 'no known country'],
  ['LOGIN_HIDDEN_NO_READABLE_DATES', 'no readable dates'],
  ['LOGIN_HIDDEN_NO_READABLE_DATE', 'no readable date'],
  ['LOGIN_HIDDEN_NOT_COUNTED', 'not counted as a login'],

  // Table copy.
  ['LOGIN_TABLE_HEADING', 'IP addresses'],
  ['LOGIN_TABLE_ARIA_NAME', 'Login history by IP address'],
  ['LOGIN_COL_IP', 'IP address'],
  ['LOGIN_COL_COUNTRY', 'Country'],
  ['LOGIN_COL_LOGINS', 'Logins'],
  ['LOGIN_COL_FIRST', 'First seen'],
  ['LOGIN_COL_LAST', 'Last seen'],
  ['LOGIN_COL_GAMES', 'Games'],
  ['LOGIN_COL_CITY', 'City'],
  ['LOGIN_ACCOUNT_TAG', 'Account record'],
  [
    'LOGIN_ACCOUNT_NOTE',
    'The Account record row is the address stored in your account details, shown as recorded. It is not counted as a login and is not on the map.',
  ],
  [
    'LOGIN_TABLE_FIND_HINT',
    "Only the rows on screen are loaded into the page, so your browser's find cannot see the rest. Sort a column to bring other rows to the top.",
  ],
  [
    'LOGIN_EXCLUDED_EXPLANATION',
    'Rows whose IP address is blank or cannot be read are not counted in any figure here and are never shown.',
  ],

  // Map copy.
  ['MAP_HEADING', 'Logins by country'],
  [
    'MAP_NO_COUNTRIES',
    'No login IP addresses could be matched to a country, so there is nothing to show on the map.',
  ],
  ['MAP_KEYBOARD_HINT', 'Use the arrow keys to move between countries, most logins first.'],
  ['MAP_GROUP_LABEL', 'World map of logins by country'],
  ['MAP_ATTRIBUTION_LINK_TEXT', 'IP Geolocation by DB-IP'],
  ['MAP_ATTRIBUTION_SUFFIX', ', licensed under CC BY 4.0.'],

  // Country list.
  ['COUNTRY_LIST_SUMMARY', 'Countries by logins'],
  ['COUNTRY_COL_COUNTRY', 'Country'],
  ['COUNTRY_COL_LOGINS', 'Logins'],
  ['COUNTRY_COL_IPS', 'IP addresses'],
  ['COUNTRY_LIST_NOT_DRAWN_SUFFIX', ' (not drawn)'],

  // City block.
  ['CITY_HEADING', 'City-level detail'],
  ['CITY_UNAVAILABLE', 'This copy of the page does not include city-level data.'],
  [
    'CITY_ERROR',
    'City-level detail could not be loaded. Your country view is unchanged. You can try again.',
  ],
  ['CITY_CANCELLED', 'City-level download cancelled. Nothing was kept.'],
  ['CITY_DECODING', 'Preparing city detail...'],
  ['CITY_PROGRESS_NAME', 'City detail download progress'],
  ['CITY_DECODING_NAME', 'Preparing city detail'],
  [
    'CITY_ACCURACY_NOTE',
    "City locations are estimates from a public database. They often point to an internet provider's location rather than your own.",
  ],
  ['CITY_LIST_SUMMARY', 'Cities by logins'],
  ['CITY_COL_CITY', 'City'],
  ['CITY_COL_COUNTRY', 'Country'],
  ['CITY_COL_LOGINS', 'Logins'],
  ['CITY_COL_IPS', 'IP addresses'],
  ['CITY_ANNOUNCE_DOWNLOADING', 'Downloading city-level detail.'],
  ['CITY_ANNOUNCE_READY', 'City-level detail loaded.'],
  ['CITY_ANNOUNCE_CANCELLED', 'City-level download cancelled.'],
];

describe('pinned copy constants', () => {
  test.each(PINNED_STRINGS)('%s matches the Copywriting Contract', (name, expected) => {
    const actual = (loginCopy as unknown as Record<string, unknown>)[name];
    expect(actual).toBe(expected);
  });

  test('no Phase 6 string contains an angle bracket', () => {
    // The renderer escapes whatever it interpolates, so a copy string has no
    // business carrying a tag delimiter: if one ever does, it means a
    // formatter has started building markup. Scoped to the Phase 6 exports
    // rather than the whole module, because `formatHoursParts` legitimately
    // returns `<1` and this is a claim about THIS inventory.
    for (const [name] of PINNED_STRINGS) {
      const value = (loginCopy as unknown as Record<string, unknown>)[name];
      expect(typeof value).toBe('string');
      expect(value as string).not.toMatch(/[<>]/);
    }
  });

  test('the multi-file note is a separate constant from every other string', () => {
    // It is shown ONLY when more than one file contributed logins, so it has to
    // be a constant a component can test for rather than a fragment glued onto
    // another sentence.
    expect(loginCopy.LOGIN_MULTI_FILE_NOTE).not.toBe(loginCopy.LOGIN_HISTORY_NO_SOURCE);
    expect(loginCopy.LOGIN_MULTI_FILE_NOTE.endsWith('.')).toBe(true);
  });

  test('LOGIN_HISTORY_HEADING keeps its Phase 4 value', () => {
    expect(loginCopy.LOGIN_HISTORY_HEADING).toBe('Login history');
  });

  test('the Phase 5 table keyboard hint is reused, not restated', () => {
    // 06-UI-SPEC "reused verbatim, no change": the IP table shows the same
    // hint the vehicle table does, so the component reads the existing export
    // and a future edit to the hint reaches both tables at once.
    expect(loginCopy.VEHICLE_SCROLL_HINT).toBe(
      'Focus the table, then use the arrow keys or Page Up and Page Down to scroll.',
    );
  });
});

// -----------------------------------------------------------------------------
// Shares and counts
// -----------------------------------------------------------------------------
describe('formatLoginShareLine', () => {
  const cases: ReadonlyArray<readonly [number, number, string]> = [
    [1, 4, '1 login (25%)'],
    [4000, 4200, '4,000 logins (95%)'],
    // A non-zero share under half a percent reads `<1%`: "0%" next to a
    // non-zero count says the logins did not happen. The Phase 4 rule.
    [1, 300, '1 login (<1%)'],
    [1, 200, '1 login (1%)'],
    [0, 0, '0 logins (0%)'],
    [0, 12, '0 logins (0%)'],
    [3, 3, '3 logins (100%)'],
    [1, 2000, '1 login (<1%)'],
  ];

  test.each(cases)('(%i of %i) reads %s', (count, total, expected) => {
    expect(loginCopy.formatLoginShareLine(count, total, EN)).toBe(expected);
  });

  test('the half-percent boundary is inclusive of 1%, per the contract wording', () => {
    // The contract says "a NON-ZERO share UNDER 0.5% reads <1%". 1 of 200 is
    // exactly 0.5%, so it is not under it and rounds to 1%. Pinned because the
    // boundary is the whole rule: a `<=` here would flip this string and the
    // Phase 4 duration rows with it.
    expect(loginCopy.formatLoginShareLine(1, 200, EN)).toBe('1 login (1%)');
    expect(loginCopy.formatLoginShareLine(1, 201, EN)).toBe('1 login (<1%)');
  });

  test('a zero total does not divide by zero', () => {
    expect(() => loginCopy.formatLoginShareLine(5, 0, EN)).not.toThrow();
    expect(loginCopy.formatLoginShareLine(5, 0, EN)).toBe('5 logins (0%)');
  });

  test("uses the viewer's locale grouping, like every other count here", () => {
    expect(loginCopy.formatLoginShareLine(4000, 4200, 'de-DE')).toContain('4.000');
  });
});

describe('formatLoginCountLine', () => {
  const cases: ReadonlyArray<readonly [number, number, string]> = [
    [1, 1, '1 IP address · 1 login'],
    [2, 4200, '2 IP addresses · 4,200 logins'],
    [69, 4200, '69 IP addresses · 4,200 logins'],
  ];

  test.each(cases)('(%i addresses, %i logins) reads %s', (addresses, logins, expected) => {
    expect(loginCopy.formatLoginCountLine(addresses, logins, EN)).toBe(expected);
  });
});

describe('formatLoginExcludedPill', () => {
  test('is empty at zero, so a caller cannot render "0 rows excluded"', () => {
    expect(loginCopy.formatLoginExcludedPill(0)).toBe('');
  });

  test.each([
    [1, '1 login row without a readable IP address'],
    [2, '2 login rows without a readable IP address'],
    [1500, '1,500 login rows without a readable IP address'],
  ])('(%i) reads %s', (n, expected) => {
    expect(loginCopy.formatLoginExcludedPill(n)).toBe(expected);
  });
});

describe('formatLoginCapLine', () => {
  test.each([
    [1, 1, '1 more IP address (1 login) is counted in the totals but not listed in the table.'],
    [
      40,
      512,
      '40 more IP addresses (512 logins) are counted in the totals but not listed in the table.',
    ],
  ])('(%i more, %i logins) reads %s', (addresses, logins, expected) => {
    expect(loginCopy.formatLoginCapLine(addresses, logins, EN)).toBe(expected);
  });
});

// -----------------------------------------------------------------------------
// Dates
// -----------------------------------------------------------------------------
describe('formatLoginDate', () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [0, '1970-01-01'],
    [86399, '1970-01-01'],
    [86400, '1970-01-02'],
    // The last second of a leap day stays ON that day: floor, not round.
    [951782400 + 86399, '2000-02-29'],
    [951782400, '2000-02-29'],
    [Date.UTC(2015, 4, 6) / 1000, '2015-05-06'],
  ];

  test.each(cases)('(%i) reads %s', (seconds, expected) => {
    expect(loginCopy.formatLoginDate(seconds)).toBe(expected);
  });

  test('is the same date at any second of the day', () => {
    for (const seconds of [951782400, 951782400 + 1, 951782400 + 43200, 951782400 + 86399]) {
      expect(loginCopy.formatLoginDate(seconds)).toBe('2000-02-29');
    }
  });
});

describe('formatLoginDateRange', () => {
  test('is null when either end is null', () => {
    expect(loginCopy.formatLoginDateRange(null, null)).toBeNull();
    expect(loginCopy.formatLoginDateRange(0, null)).toBeNull();
    expect(loginCopy.formatLoginDateRange(null, 0)).toBeNull();
  });

  test('is one date alone when both ends fall on the same day', () => {
    expect(loginCopy.formatLoginDateRange(951782400, 951782400 + 86399)).toBe('2000-02-29');
  });

  test('joins two dates with " to "', () => {
    expect(loginCopy.formatLoginDateRange(0, 86400 * 100)).toBe('1970-01-01 to 1970-04-11');
  });

  test('does not care which end is later', () => {
    // First and last come from the aggregate, which orders them; this asserts
    // the formatter does not reorder, so a caller cannot pass them backwards
    // without the sentence reading backwards too.
    expect(loginCopy.formatLoginDateRange(86400 * 100, 0)).toBe('1970-04-11 to 1970-01-01');
  });
});

// -----------------------------------------------------------------------------
// Games
// -----------------------------------------------------------------------------
describe('formatGameName', () => {
  test.each([
    ['WOT', 'WoT'],
    ['WOTB', 'WoT Blitz'],
    ['WOWS', 'Warships'],
    ['WOTC', 'WoT Console'],
    ['HEAT', 'HEAT'],
    ['WOWP', 'Warplanes'],
  ])('%s reads %s', (token, expected) => {
    expect(loginCopy.formatGameName(token)).toBe(expected);
  });

  test('returns an unknown token unchanged rather than failing', () => {
    // The token comes from an archive file name, so an export with a game this
    // build has never heard of must still render. An error message here would
    // be a worse answer than the token.
    expect(loginCopy.formatGameName('WOXC')).toBe('WOXC');
    expect(loginCopy.formatGameName('')).toBe('');
  });
});

describe('formatGames', () => {
  test('joins in the fixed order, not the order given', () => {
    expect(loginCopy.formatGames(['WOWS', 'WOT'])).toBe('WoT, Warships');
    expect(loginCopy.formatGames(['WOWP', 'WOTB', 'WOT', 'WOWS'])).toBe(
      'WoT, WoT Blitz, Warships, Warplanes',
    );
  });

  test('prints the two new games in ONE fixed app-wide order (11-01)', () => {
    // The order is the identity header's: WOT, WOTB, WOWS, WOTC, HEAT, WOWP.
    // Warplanes stays LAST even though it is the newest entry alphabetically,
    // because the order is a display contract and not a sort.
    expect(loginCopy.formatGames(['WOT', 'WOTC', 'HEAT', 'WOWP'])).toBe(
      'WoT, WoT Console, HEAT, Warplanes',
    );
    // And the Games cell now prints a NAME for WoT Console rather than the raw
    // token, which is the change D-13's chip labels depend on.
    expect(loginCopy.formatGames(['WOTC'])).toBe('WoT Console');
  });

  test('puts unknown tokens after the known ones, ascending', () => {
    expect(loginCopy.formatGames(['WOT', 'WOXC', 'WOXA'])).toBe('WoT, WOXA, WOXC');
  });

  test('deduplicates', () => {
    expect(loginCopy.formatGames(['WOT', 'WOT'])).toBe('WoT');
  });

  test('is empty for no tokens', () => {
    expect(loginCopy.formatGames([])).toBe('');
  });

  test('joins with a comma and a space, not a comma-space-space or a comma', () => {
    expect(loginCopy.formatGames(['WOT', 'WOWS'])).toBe('WoT, Warships');
  });
});

// -----------------------------------------------------------------------------
// Map sentences
// -----------------------------------------------------------------------------
describe('formatMapSummary', () => {
  test('reads as a two-sentence line when several countries have logins', () => {
    expect(loginCopy.formatMapSummary(3, 'Poland', 4000, 4200, 0, 0, EN)).toBe(
      'Logins came from 3 countries. Poland had the most, with 4,000 of 4,200 logins (95%).',
    );
  });

  test('says "1 country" in the singular, keeping the second sentence', () => {
    // "Logins came from 1 country." alone is the case where ONE country holds
    // EVERY login; one country that holds some of them still needs the second
    // sentence, so the singular and the two-sentence form are separate cases.
    expect(loginCopy.formatMapSummary(1, 'Poland', 4000, 4200, 0, 0, EN)).toBe(
      'Logins came from 1 country. Poland had the most, with 4,000 of 4,200 logins (95%).',
    );
  });

  test('names its own base when one country holds every login', () => {
    expect(loginCopy.formatMapSummary(1, 'Poland', 4200, 4200, 0, 0, EN)).toBe(
      'All 4,200 logins with a known country came from Poland.',
    );
  });

  test('says "All 1 login", not "All 1 logins", when the total is one', () => {
    // The contract writes `{t} logins` as an illustration; the one-login
    // export is the case where that literal would be a grammar bug in front
    // of the only reader who can check it.
    expect(loginCopy.formatMapSummary(1, 'Poland', 1, 1, 0, 0, EN)).toBe(
      'All 1 login with a known country came from Poland.',
    );
  });

  test('appends the unknown-country sentence when addresses have no match', () => {
    expect(loginCopy.formatMapSummary(1, 'Poland', 4200, 4200, 2, 3, EN)).toBe(
      'All 4,200 logins with a known country came from Poland. 2 IP addresses (3 logins) have no known country and are not on the map.',
    );
  });

  test('appends it in the singular too', () => {
    expect(loginCopy.formatMapSummary(2, 'Poland', 5, 6, 1, 1, EN)).toBe(
      'Logins came from 2 countries. Poland had the most, with 5 of 6 logins (83%). 1 IP address (1 login) has no known country and is not on the map.',
    );
  });

  test('omits the unknown-country sentence when there is nothing to append', () => {
    const line = loginCopy.formatMapSummary(1, 'Poland', 6, 6, 0, 0, EN);
    expect(line).not.toContain('no known country');
  });
});

describe('formatMapCountryLabel', () => {
  test.each([
    ['Poland', 4, 2, 'Poland: 4 logins from 2 IP addresses'],
    ['Poland', 1, 1, 'Poland: 1 login from 1 IP address'],
  ])('(%s, %i, %i) reads %s', (name, logins, ips, expected) => {
    expect(loginCopy.formatMapCountryLabel(name, logins, ips)).toBe(expected);
  });
});

describe('formatMapTooltipLines', () => {
  test('is the country name then the two figures', () => {
    expect(loginCopy.formatMapTooltipLines('Poland', 4, 2)).toEqual([
      'Poland',
      '4 logins · 2 IP addresses',
    ]);
  });

  test('is singular in both figures', () => {
    expect(loginCopy.formatMapTooltipLines('Poland', 1, 1)).toEqual([
      'Poland',
      '1 login · 1 IP address',
    ]);
  });
});

describe('formatMapLegendNote', () => {
  const base = 'Shading is logarithmic, so each darker step covers a wider range of logins.';

  test('names the step starts it is given', () => {
    expect(loginCopy.formatMapLegendNote([1, 8], EN)).toBe(
      `${base} Steps start at 1 and 8 logins.`,
    );
    expect(loginCopy.formatMapLegendNote([1, 2, 3, 4, 5], EN)).toBe(
      `${base} Steps start at 1, 2, 3, 4 and 5 logins.`,
    );
  });

  test('collapses duplicate step starts', () => {
    // Two levels can round to the same boundary; naming it twice is a bug a
    // reader would read as two steps that start at the same place.
    expect(loginCopy.formatMapLegendNote([2, 2, 8], EN)).toBe(
      `${base} Steps start at 2 and 8 logins.`,
    );
  });

  test('is the one-level sentence when the maximum is 1', () => {
    // With every shaded country at 1 login there is no range to describe, and
    // "Steps start at 1 logins" is a sentence about nothing.
    expect(loginCopy.formatMapLegendNote([1], EN)).toBe('Every shaded country has 1 login.');
  });

  test("groups the step starts in the viewer's locale", () => {
    expect(loginCopy.formatMapLegendNote([1200, 8000], 'de-DE')).toContain('1.200');
  });

  test('keeps the base sentence when there are no steps', () => {
    expect(loginCopy.formatMapLegendNote([], EN)).toBe(base);
  });
});

describe('formatMapNotDrawn', () => {
  test.each([
    [1, '1 country in the list below is not drawn on the map.'],
    [3, '3 countries in the list below are not drawn on the map.'],
  ])('(%i) reads %s', (k, expected) => {
    expect(loginCopy.formatMapNotDrawn(k)).toBe(expected);
  });
});

// -----------------------------------------------------------------------------
// City block
// -----------------------------------------------------------------------------
// A megabyte is 1,000,000 bytes everywhere in this section, because the sizes
// measured in 06-RESEARCH are decimal (11,850,000 bytes for the shipped city
// file). A 1,048,576-byte megabyte would round that to 11 and misstate the
// size the user is about to download.
describe('formatCityIntro', () => {
  test('names the whole-megabyte size with no tilde', () => {
    expect(loginCopy.formatCityIntro(11_850_000, EN)).toBe(
      'Add the city for each IP address. This downloads a database of about 12 MB from this site when you press the button. Nothing is downloaded until then, and nothing from your export is sent with the request.',
    );
  });

  test('never says "about 0 MB"', () => {
    expect(loginCopy.formatCityIntro(0, EN)).toContain('about 1 MB');
    expect(loginCopy.formatCityIntro(200_000, EN)).toContain('about 1 MB');
  });
});

describe('formatCityLoadLabel', () => {
  test('reads the shipped city file size', () => {
    expect(loginCopy.formatCityLoadLabel(11_850_000, EN)).toBe('Load city-level detail (~12 MB)');
  });

  test('is a minimum of one megabyte, and keeps the tilde', () => {
    expect(loginCopy.formatCityLoadLabel(200_000, EN)).toBe('Load city-level detail (~1 MB)');
    expect(loginCopy.formatCityLoadLabel(0, EN)).toBe('Load city-level detail (~1 MB)');
  });
});

describe('formatCityProgress', () => {
  test('reads one decimal of each size, grouped by locale', () => {
    expect(loginCopy.formatCityProgress(4_200_000, 12_400_000, EN)).toBe(
      'Downloading city detail: 4.2 of 12.4 MB',
    );
  });

  test('drops a trailing zero decimal, like the hour rule', () => {
    // "5 of 12 MB" reads better than "5.0 of 12.0 MB", and the module already
    // makes this exact choice in formatHoursParts.
    expect(loginCopy.formatCityProgress(5_000_000, 12_000_000, EN)).toBe(
      'Downloading city detail: 5 of 12 MB',
    );
  });

  test('groups a size over a thousand megabytes', () => {
    expect(loginCopy.formatCityProgress(1_234_500_000, 2_000_000_000, EN)).toBe(
      'Downloading city detail: 1,234.5 of 2,000 MB',
    );
  });

  test('omits the sizes when the total is unknown', () => {
    expect(loginCopy.formatCityProgress(4_200_000, null, EN)).toBe('Downloading city detail...');
  });
});

describe('formatCityReady', () => {
  test('names the data month from the manifest', () => {
    expect(loginCopy.formatCityReady('2026-10')).toBe(
      'City detail loaded from DB-IP (2026-10). The City column is now in the table above.',
    );
  });

  test('does not echo a month that is not a build-time YYYY-MM', () => {
    // The month comes from manifest.json, which is a build artefact, not from
    // the export. A corrupt or hand-edited manifest must not become a DOM
    // string, so the fallback drops the parenthetical rather than printing it.
    expect(loginCopy.formatCityReady('not a month')).toBe(
      'City detail loaded from DB-IP. The City column is now in the table above.',
    );
  });
});

describe('formatCityMoreCities', () => {
  test.each([
    [1, 'and 1 more city not listed'],
    [2, 'and 2 more cities not listed'],
  ])('(%i) reads %s', (k, expected) => {
    expect(loginCopy.formatCityMoreCities(k, EN)).toBe(expected);
  });
});

describe('formatCityNoCity', () => {
  test.each([
    [1, '1 IP address has no city in the database.'],
    [4, '4 IP addresses have no city in the database.'],
  ])('(%i) reads %s', (n, expected) => {
    expect(loginCopy.formatCityNoCity(n, EN)).toBe(expected);
  });
});
