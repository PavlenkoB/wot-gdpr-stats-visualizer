// =============================================================================
// overview-format.test.ts — what every Overview tile says (13-09, Task 1)
// =============================================================================
//
// `tileFace` is the one place the words, the numbers and the chart data of a
// tile are produced, so this suite holds all sixteen faces to the plan 13-03
// answer key. The tiles are built by hand from `OV_EXPECTED` (not through the
// worker): the figures under test are the ones the key states, and the key
// imports nothing from `src/`.
//
// Every expectation names the locale `en`, so a machine whose own locale groups
// digits with dots cannot turn this suite red. The date expectations are built
// from `Date.UTC`, which is a different route to the same civil date than the
// project's own `civilFromDays`.
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatCredits,
  formatDay,
  lifeFigure,
  formatDays,
  formatHourOfDay,
  formatHours,
  formatMonthYear,
  formatPercent,
  tileFace,
} from '../../../src/lib/features/overview/overview-format.ts';
import type { TileFace } from '../../../src/lib/features/overview/overview-format.ts';
import type { OverviewReadyTile } from '../../../src/lib/features/overview/overview-shared.ts';
import { OV_EXPECTED } from '../../helpers/overview-oracle.ts';

const EN = 'en';

type Ready<Id extends OverviewReadyTile['id']> = Extract<OverviewReadyTile, { id: Id }>;

/** A calendar date the way `en` writes it, built from `Date.UTC` and no zone. */
function expectedDay(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat(EN, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const { sessions, stats, money } = OV_EXPECTED;

/** One ready tile per id, built from the answer key. */
const TILES: { [Id in OverviewReadyTile['id']]: Ready<Id> } = {
  logged: {
    id: 'logged',
    status: 'ok',
    seconds: sessions.allSeconds,
    firstDay: sessions.firstDay,
    lastDay: sessions.lastDay,
    battleSeconds: sessions.battleSeconds,
    years: sessions.years.map((entry) => ({ ...entry })),
  },
  hour: { id: 'hour', status: 'ok', hours: [...sessions.hours], peakHour: sessions.peakHour },
  streak: {
    id: 'streak',
    status: 'ok',
    days: sessions.streak,
    startDay: 18322,
    endDay: 18324,
  },
  sess: {
    id: 'sess',
    status: 'ok',
    seconds: sessions.longestSession.seconds,
    day: sessions.longestSession.day,
  },
  busy: {
    id: 'busy',
    status: 'ok',
    seconds: sessions.busiestDay.seconds,
    day: sessions.busiestDay.day,
  },
  tank: {
    id: 'tank',
    status: 'ok',
    name: stats.mostPlayedResolved.name,
    battles: stats.mostPlayed.battles,
    share: stats.mostPlayed.share,
    classKey: 'heavyTank',
    tier: stats.mostPlayedResolved.tier,
    top: [
      { name: 'Synth One', classKey: 'heavyTank', battles: 900 },
      { name: 'Synth Two', classKey: 'mediumTank', battles: 410 },
      { name: 'Synth Three', classKey: 'AT-SPG', battles: 150 },
      { name: 'SynthFour', classKey: 'unknown', battles: 40 },
    ],
  },
  cls: {
    id: 'cls',
    status: 'ok',
    classKey: 'heavyTank',
    share: stats.favouriteClass.share,
    coverage: stats.coverageBattles / stats.coverageTotal,
    rows: [
      { classKey: 'heavyTank', battles: 900 },
      { classKey: 'mediumTank', battles: 410 },
      { classKey: 'AT-SPG', battles: 150 },
      { classKey: 'unknown', battles: 40 },
    ],
  },
  fleet: { id: 'fleet', status: 'ok', count: stats.fleet },
  nat: { id: 'nat', status: 'ok', nation: 'china', share: 0.6 },
  dmg: {
    id: 'dmg',
    status: 'ok',
    value: stats.records.damage.value,
    tankName: stats.records.damage.nameWithTable,
    accounts: 2,
  },
  xp: {
    id: 'xp',
    status: 'ok',
    value: stats.records.xp.value,
    tankName: stats.records.xp.nameWithTable,
    accounts: 2,
  },
  kills: {
    id: 'kills',
    status: 'ok',
    value: stats.records.kills.value,
    tankName: null,
    accounts: 2,
  },
  snip: { id: 'snip', status: 'ok', value: stats.records.sniperSeries.value },
  cred: { id: 'cred', status: 'ok', units: money.creditsInFlowMicro },
  bat: {
    id: 'bat',
    status: 'ok',
    battles: stats.battles,
    wins: stats.wins,
    winRate: stats.winRate,
  },
  ord: { id: 'ord', status: 'ok', count: money.orders },
};

/**
 * The face of a tile. A record tile carries the number of accounts it was
 * chosen from (WR-04); `accounts` overrides it for the cases that vary it.
 */
function faceOf(tile: OverviewReadyTile, accounts?: number): TileFace {
  const shown = accounts !== undefined && 'accounts' in tile ? { ...tile, accounts } : tile;
  return tileFace(shown, { locale: EN });
}

describe('formatCredits (bigint arithmetic, D-21)', () => {
  const cases: [micro: string, expected: string][] = [
    // Below one million: the whole figure with separators, fraction truncated.
    ['999999990000', '999,999'],
    ['5000000', '5'],
    ['0', '0'],
    // One million exactly, and the half-up edge of the millions form.
    ['1000000000000', '1 million'],
    ['1499999999999', '1 million'],
    ['1500000000000', '2 million'],
    // The oracle's credits in flow: 12,000,000 credits.
    ['12000000000000', '12 million'],
    ['880000000000000', '880 million'],
    // 999,500,000 rounds to 1,000 million, which is the billion form.
    ['999500000000000', '1.00 billion'],
    ['1234567890000000', '1.23 billion'],
    // Half up on the third decimal of a billion: 1.235 is 1.24.
    ['1235000000000000', '1.24 billion'],
    // Above 2^53 micro-units: a float would round 9,014,999,999.999999 up to
    // 9.02; integers keep it 9.01.
    ['9014999999999999', '9.01 billion'],
    // A negative figure keeps its sign in every form.
    ['-5000000000', '-5,000'],
    ['-12000000000000', '-12 million'],
    // A figure that rounds to zero credits carries no sign.
    ['-500000', '0'],
  ];

  for (const [micro, expected] of cases) {
    it(`${micro} micro-units reads ${expected}`, () => {
      expect(formatCredits(micro, EN)).toBe(expected);
    });
  }

  it('is exact far above 2^53 and groups the billions', () => {
    const huge = `1${'0'.repeat(30)}`;
    expect(formatCredits(huge, EN)).toBe('1,000,000,000,000,000.00 billion');
  });

  it('returns a malformed string unformatted rather than guessing', () => {
    for (const text of ['abc', '12.5', '', '1e9', ' 5', '--5']) {
      expect(formatCredits(text, EN)).toBe(text);
    }
  });
});

describe('lifeFigure: one line of the Wargaming life list, per game', () => {
  it('says there are no sessions for a game that has none', () => {
    expect(lifeFigure(null, EN)).toBe('no sessions in this export');
    expect(lifeFigure(0, EN)).toBe('no sessions in this export');
    expect(lifeFigure(Number.NaN, EN)).toBe('no sessions in this export');
  });

  it('never prints "0.0 days" for a little time: it says under 0.1 days', () => {
    expect(lifeFigure(1, EN)).toBe('under 0.1 days');
    expect(lifeFigure(3_600, EN)).toBe('under 0.1 days');
    expect(lifeFigure(8_639, EN)).toBe('under 0.1 days');
    for (const seconds of [1, 600, 3_600, 8_639]) {
      expect(lifeFigure(seconds, EN)).not.toContain('0.0');
    }
  });

  it('prints days from a tenth of a day: one decimal below ten, none from ten', () => {
    expect(lifeFigure(8_640, EN)).toBe('0.1 days');
    expect(lifeFigure(86_400, EN)).toBe('1.0 days');
    expect(lifeFigure(3_628_800, EN)).toBe('42 days');
  });
});

describe('the number and date helpers', () => {
  it('formatDays keeps one decimal below ten days and none from ten', () => {
    expect(formatDays(sessions.allSeconds, EN)).toBe('0.6');
    expect(formatDays(864_000, EN)).toBe('10');
    expect(formatDays(sessions.battleSeconds, EN)).toBe('13');
  });

  it('formatHours keeps one decimal', () => {
    expect(formatHours(sessions.allSeconds, EN)).toBe('14.9');
    expect(formatHours(3_600, EN)).toBe('1.0');
  });

  it('formatCount groups thousands and formatPercent rounds to a whole percent', () => {
    expect(formatCount(1_234_567, EN)).toBe('1,234,567');
    expect(formatPercent(0.52, EN)).toBe('52%');
    expect(formatPercent(0.6, EN)).toBe('60%');
  });

  it('formatHourOfDay pads to HH:00', () => {
    expect(formatHourOfDay(0)).toBe('00:00');
    expect(formatHourOfDay(5)).toBe('05:00');
    expect(formatHourOfDay(21)).toBe('21:00');
  });

  it('formatDay is the export civil date, whatever the machine zone is', () => {
    // 18,322 is 1 March 2020 (the oracle counts it by hand).
    expect(formatDay(18322, EN)).toBe(expectedDay(2020, 3, 1));
    expect(formatDay(18783, EN)).toBe(expectedDay(2021, 6, 5));
    // Day 0 is the epoch, and a pre-epoch day still reads as a civil date.
    expect(formatDay(0, EN)).toBe(expectedDay(1970, 1, 1));
    expect(formatDay(-1, EN)).toBe(expectedDay(1969, 12, 31));
  });

  it('formatMonthYear names the month and the year only', () => {
    const expected = new Intl.DateTimeFormat(EN, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2020, 2, 1)));
    expect(formatMonthYear(18322, EN)).toBe(expected);
  });
});

describe('tileFace: all sixteen faces against the answer key', () => {
  it('logged: days, the rule with the first date and the battle days, and a years chart', () => {
    const result = faceOf(TILES.logged);
    expect(result.value).toBe('0.6');
    expect(result.unit).toBe('days');
    expect(result.rule).toBe(
      `14.9 h across all games (24-hour days) since ${expectedDay(2020, 3, 1)}. In battle: 13 days.`,
    );
    expect(result.rule).toContain('across all games');

    expect(result.chart?.kind).toBe('years');
    if (result.chart?.kind !== 'years') throw new Error('expected a years chart');
    expect(result.chart.bars).toHaveLength(2);
    expect(result.chart.bars.map((bar) => bar.label)).toEqual(['2020', '2021']);
    expect(result.chart.bars[0]?.value).toBeCloseTo(50_100 / 3_600, 9);
    expect(result.chart.peakLabel).toBe('13.9 h · 2020');
    expect(result.chart.peakLabel).toContain('2020');
    expect(result.summary).toBe(
      'Chart: hours logged per year, 2 years, peak 2020 with 13.9 hours.',
    );
  });

  it('logged: no battle figure leaves the battle sentence out entirely', () => {
    const result = faceOf({ ...TILES.logged, battleSeconds: null });
    expect(result.rule).not.toContain('In battle');
  });

  it('logged: a single active year reads in the singular and no year leaves no chart', () => {
    const one = faceOf({ ...TILES.logged, years: [{ year: 2020, seconds: 3_600 }] });
    expect(one.summary).toContain('1 year,');
    const none = faceOf({ ...TILES.logged, years: [] });
    expect(none.chart).toBeNull();
    expect(none.summary).toBe('');
  });

  it('hour: the peak hour, 24 labelled bars and the hidden summary', () => {
    const result = faceOf(TILES.hour);
    expect(result.value).toBe('21:00');
    expect(result.unit).toBeNull();
    expect(result.rule).toBe('Logged hours by hour of day, wall clock as recorded.');
    expect(result.chart?.kind).toBe('hours');
    if (result.chart?.kind !== 'hours') throw new Error('expected an hours chart');
    expect(result.chart.bars).toHaveLength(24);
    expect(result.chart.bars[0]?.label).toBe('00:00');
    expect(result.chart.bars[23]?.label).toBe('23:00');
    expect(result.chart.bars[21]?.value).toBeCloseTo(13_500 / 3_600, 9);
    expect(result.chart.peakLabel).toBe('21:00');
    expect(result.summary).toBe('Chart: hours logged by hour of day, peak at 21:00.');
  });

  it('streak, sess and busy: counts, hours and the WoT sessions wording', () => {
    const streak = faceOf(TILES.streak);
    expect(streak.value).toBe('3');
    expect(streak.unit).toBe('days');
    expect(streak.rule).toBe(
      `${expectedDay(2020, 3, 1)} to ${expectedDay(2020, 3, 3)}, WoT sessions.`,
    );
    expect(streak.chart).toBeNull();

    const sess = faceOf(TILES.sess);
    expect(sess.value).toBe('4.2');
    expect(sess.unit).toBe('h');
    expect(sess.rule).toContain('WoT sessions');
    expect(sess.rule).toContain(expectedDay(2020, 3, 3));

    const busy = faceOf(TILES.busy);
    expect(busy.value).toBe('6.0');
    expect(busy.unit).toBe('h');
    expect(busy.rule).toBe(`${expectedDay(2020, 3, 10)}, WoT sessions.`);
  });

  it('tank: the name, the rule, at most five rows and a hidden summary', () => {
    const result = faceOf(TILES.tank);
    expect(result.value).toBe('Synth One');
    expect(result.unit).toBeNull();
    expect(result.rule).toBe('900 battles, 60% of all battles.');
    expect(result.chart?.kind).toBe('rows');
    if (result.chart?.kind !== 'rows') throw new Error('expected rows');
    expect(result.chart.rows).toHaveLength(4);
    expect(result.chart.rows[0]).toEqual({
      name: 'Synth One',
      sub: 'Heavy',
      value: 900,
      text: '900',
      bar: true,
    });
    expect(result.chart.rows[3]?.sub).toBe('Unknown');
    expect(result.summary.startsWith('Top 4 tanks by battles:')).toBe(true);
  });

  it('tank: more than five tanks are cut to five', () => {
    const top = Array.from({ length: 8 }, (_, index) => ({
      name: `Tank ${index}`,
      classKey: 'heavyTank' as const,
      battles: 100 - index,
    }));
    const result = faceOf({ ...TILES.tank, top });
    if (result.chart?.kind !== 'rows') throw new Error('expected rows');
    expect(result.chart.rows).toHaveLength(5);
    expect(result.summary.startsWith('Top 5 tanks by battles:')).toBe(true);
  });

  it('cls: the class, the coverage rule and a row per class with the unknown row bar-less', () => {
    const result = faceOf(TILES.cls);
    expect(result.value).toBe('Heavy');
    expect(result.rule).toBe('60% of battles. Class known for 97% of battles.');
    if (result.chart?.kind !== 'rows') throw new Error('expected rows');
    expect(result.chart.rows.map((row) => row.name)).toEqual([
      'Heavy',
      'Medium',
      'Tank destroyer',
      'Unknown',
    ]);
    expect(result.chart.rows.map((row) => row.text)).toEqual(['60%', '27%', '10%', '3%']);
    const unknown = result.chart.rows.find((row) => row.name === 'Unknown');
    expect(unknown?.bar).toBe(false);
    expect(result.chart.rows.filter((row) => row.bar)).toHaveLength(3);
    expect(result.summary.startsWith('Battles by class:')).toBe(true);
  });

  it('fleet and nat', () => {
    const fleet = faceOf(TILES.fleet);
    expect(fleet.value).toBe('4');
    expect(fleet.rule).toBe('Different tanks with battles.');
    const nat = faceOf(TILES.nat);
    expect(nat.value).toBe('China');
    expect(nat.rule).toBe('60% of battles.');
  });

  it('records: the value, the tank, "best of 2 accounts" only with two accounts', () => {
    const dmg = faceOf(TILES.dmg, 2);
    expect(dmg.value).toBe('6,100');
    expect(dmg.rule).toBe('Synth Three, best of 2 accounts.');
    expect(faceOf(TILES.dmg, 1).rule).toBe('Synth Three.');

    const xp = faceOf(TILES.xp, 2);
    expect(xp.value).toBe('2,100');
    expect(xp.rule).toContain('Synth Two');

    const kills = faceOf(TILES.kills, 2);
    expect(kills.value).toBe('8');
    expect(kills.rule).toContain('vehicle not recorded');
    expect(faceOf(TILES.kills, 1).rule).toBe('vehicle not recorded.');
    expect(faceOf(TILES.kills, 1).rule).not.toContain('best of');

    const snip = faceOf(TILES.snip);
    expect(snip.value).toBe('9');
    expect(snip.rule).toBe('Longest run recorded.');
  });

  it('cred, bat and ord: the money, the rate and the count-only order figure', () => {
    const cred = faceOf(TILES.cred);
    expect(cred.value).toBe('12 million');
    expect(cred.rule).toContain('Deposits plus income');

    const bat = faceOf(TILES.bat);
    expect(bat.value).toBe('1,500');
    expect(bat.rule).toBe('52% wins.');
    expect(faceOf({ ...TILES.bat, winRate: null, wins: null }).rule).toBe(
      'Too few battles for a rate.',
    );

    const ord = faceOf(TILES.ord);
    expect(ord.value).toBe('3');
    expect(ord.rule).toContain('Count only');
  });

  it('only the three chart tiles carry a chart, and only they carry a summary', () => {
    const withChart = Object.values(TILES)
      .filter((tile) => faceOf(tile).chart !== null)
      .map((tile) => tile.id);
    expect(withChart.sort()).toEqual(['cls', 'hour', 'logged', 'tank']);
    for (const tile of Object.values(TILES)) {
      const result = faceOf(tile);
      expect(result.summary === '', `${tile.id} summary`).toBe(result.chart === null);
    }
  });

  it('every id has a face', () => {
    expect(Object.keys(TILES)).toHaveLength(16);
    for (const tile of Object.values(TILES)) {
      const result = faceOf(tile);
      expect(result.value.length, `${tile.id} value`).toBeGreaterThan(0);
      expect(result.rule.length, `${tile.id} rule`).toBeGreaterThan(0);
    }
  });

  it('numeral is true for a value of nine characters or fewer and false beyond', () => {
    // 'Synth One' is exactly nine characters.
    expect(faceOf(TILES.tank).numeral).toBe(true);
    expect(faceOf(TILES.logged).numeral).toBe(true);
    // 'Czechoslovakia' is fourteen.
    expect(faceOf({ ...TILES.nat, nation: 'czech' }).value).toBe('Czechoslovakia');
    expect(faceOf({ ...TILES.nat, nation: 'czech' }).numeral).toBe(false);
    // Ten characters is already over.
    expect(faceOf({ ...TILES.tank, name: 'Synth Four' }).numeral).toBe(false);
  });
});

describe('tileFace: hostile text stays text (T-13-26, T-13-28)', () => {
  it('no returned string carries an angle bracket unless the input name did', () => {
    const everything = (result: TileFace): string[] => [
      result.value,
      result.unit ?? '',
      result.rule,
      result.summary,
      ...(result.chart === null
        ? []
        : result.chart.kind === 'rows'
          ? result.chart.rows.flatMap((row) => [row.name, row.sub ?? '', row.text])
          : [result.chart.peakLabel, ...result.chart.bars.map((bar) => bar.label)]),
    ];
    for (const tile of Object.values(TILES)) {
      for (const text of everything(faceOf(tile))) {
        expect(text, `${tile.id}: ${text}`).not.toMatch(/[<>]/);
      }
    }
  });

  it('a hostile tank name appears only where the name is printed, unchanged', () => {
    const hostile = '<b>x';
    const result = faceOf({
      ...TILES.tank,
      name: hostile,
      top: [{ name: hostile, classKey: 'heavyTank', battles: 900 }],
    });
    expect(result.value).toBe(hostile);
    if (result.chart?.kind !== 'rows') throw new Error('expected rows');
    expect(result.chart.rows[0]?.name).toBe(hostile);
    // The rule line is built from numbers only.
    expect(result.rule).not.toMatch(/[<>]/);
  });
});
