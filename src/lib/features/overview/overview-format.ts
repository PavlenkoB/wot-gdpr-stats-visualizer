/**
 * overview-format.ts — what every Overview tile SAYS (13-09, D-17, D-21).
 *
 * ## What this module is
 *
 * One pure function, `tileFace`, turns a READY tile into everything the page
 * prints for it: the value text, the unit, the rule line, a hidden one-line
 * chart summary and an optional chart spec. The components draw what this
 * module hands them and decide nothing about wording, so the words, the
 * numbers and the chart data can all be tested in Node, where a Svelte
 * component cannot be mounted.
 *
 * ## Why the formatting happens HERE and not in the worker
 *
 * The worker's answer is locale-free: seconds, day numbers, ratios and
 * micro-unit strings. A date or a thousands separator is a fact about the
 * READER, so it is produced on the page with `Intl`, with the browser's
 * locale unless a caller names one (the tests name `en`).
 *
 * ## Money is never a float (D-21)
 *
 * `formatCredits` takes the micro-unit decimal STRING and does every step in
 * `bigint`, so a figure above 2^53 micro-units is still exact and a rounding
 * boundary (1,235,000,000 is 1.24 billion, half up) is decided on integers.
 *
 * ## Privacy
 *
 * Every string returned here is built from the tile's own fields. The tile
 * type has nowhere to hold an order amount, chat text or a clan name, so none
 * can reach the face (T-13-28).
 */

import { civilFromDays } from '../../core/civil-date.ts';
import { numberFormatter } from '../../core/decimal.ts';
import {
  OVERVIEW_LIFE_NO_SESSIONS,
  OVERVIEW_LIFE_UNDER_TENTH,
  formatLifeDays,
  OVERVIEW_CREDITS_BILLION,
  OVERVIEW_CREDITS_MILLION,
  OVERVIEW_CRED_RULE,
  OVERVIEW_FLEET_RULE,
  OVERVIEW_HOUR_RULE,
  OVERVIEW_ORD_RULE,
  OVERVIEW_SNIP_RULE,
  OVERVIEW_TILE_COPY,
  formatBatRule,
  formatBusyRule,
  formatClassName,
  formatClassesChartSummary,
  formatClsRule,
  formatHourChartSummary,
  formatLoggedRule,
  formatNatRule,
  formatNationName,
  formatRecordRule,
  formatSessRule,
  formatStreakRule,
  formatTankRule,
  formatTanksChartSummary,
  formatYearPeakLabel,
  formatYearsChartSummary,
} from '../../ui-copy.ts';
import type { OverviewReadyTile } from './overview-shared.ts';

// -----------------------------------------------------------------------------
// Numbers
// -----------------------------------------------------------------------------

/** Seconds in a 24-hour day. */
const SECONDS_PER_DAY = 86_400;

/** Seconds in an hour. */
const SECONDS_PER_HOUR = 3_600;

/**
 * Seconds as 24-hour days: one decimal below ten days, none from ten.
 *
 * Below ten days a tenth of a day is worth printing; from ten days it is
 * noise, and a whole number is the figure a reader can hold in their head.
 */
export function formatDays(seconds: number, locale?: string): string {
  const days = seconds / SECONDS_PER_DAY;
  if (days < 10) {
    return numberFormatter(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(days);
  }
  return numberFormatter(locale, { maximumFractionDigits: 0 }).format(days);
}

/**
 * One game's line in the Wargaming life list: the logged days, `under 0.1
 * days` when there is a little time but not a tenth of a day of it, and `no
 * sessions in this export` when the game has none (null, or not above zero).
 * A game is never shown as "0.0 days".
 */
export function lifeFigure(seconds: number | null, locale?: string): string {
  if (seconds === null || !(seconds > 0)) return OVERVIEW_LIFE_NO_SESSIONS;
  if (seconds < SECONDS_PER_DAY / 10) return OVERVIEW_LIFE_UNDER_TENTH;
  return formatLifeDays(formatDays(seconds, locale));
}

/** Seconds as hours, to one decimal: what a rule line quotes. */
export function formatHours(seconds: number, locale?: string): string {
  return numberFormatter(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(seconds / SECONDS_PER_HOUR);
}

/** A count with the reader's thousands separators. */
export function formatCount(n: number, locale?: string): string {
  return numberFormatter(locale, { maximumFractionDigits: 0 }).format(n);
}

/** A fraction 0..1 as a whole percent: `0.6` is `60%`. */
export function formatPercent(fraction: number, locale?: string): string {
  return numberFormatter(locale, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

/** An hour of day 0..23 as `HH:00`. */
export function formatHourOfDay(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

// -----------------------------------------------------------------------------
// Dates
// -----------------------------------------------------------------------------

/**
 * A formatter per locale and shape.
 *
 * Constructing an `Intl.DateTimeFormat` resolves locale data and costs far
 * more than `format`; the key space is the handful of shapes below times the
 * locales in use, so the cache cannot grow with the export.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: string | undefined, shape: 'day' | 'month'): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${shape}`;
  let formatter = dateFormatters.get(key);
  if (formatter === undefined) {
    formatter =
      shape === 'day'
        ? new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * A day number as an instant at UTC midnight of that civil date.
 *
 * The day number IS a civil date (days since 1970-01-01, wall clock as the
 * export wrote it), so the date is rebuilt from its civil parts and printed in
 * UTC. The viewer's time zone never touches it: a local-zone `Date` would move
 * the export's date across midnight.
 */
function dayToDate(day: number): Date {
  const { y, m, d } = civilFromDays(day);
  const date = new Date(0);
  // setUTCFullYear takes the year, month and day together, so a year below 100
  // is not remapped to 19xx the way `Date.UTC` would.
  date.setUTCFullYear(y, m - 1, d);
  return date;
}

/** A day number as a medium date: `14 Mar 2020`, in the reader's order. */
export function formatDay(day: number, locale?: string): string {
  return dateFormatter(locale, 'day').format(dayToDate(day));
}

/** A day number as a month and year: `Mar 2020`. */
export function formatMonthYear(day: number, locale?: string): string {
  return dateFormatter(locale, 'month').format(dayToDate(day));
}

// -----------------------------------------------------------------------------
// Money
// -----------------------------------------------------------------------------

/** Micro-units in one whole credit. */
const MICRO = 1_000_000n;

/** Micro-units in one million credits. */
const MICRO_PER_MILLION = 1_000_000_000_000n;

/** Micro-units in one hundredth of a billion credits. */
const MICRO_PER_HUNDREDTH_BILLION = 10_000_000_000_000n;

/** An optional sign and digits: the only shape the money layer writes. */
const SIGNED_INTEGER = /^[+-]?\d+$/;

/**
 * Credits from their micro-unit string, in the Overview's three forms:
 *
 *   - below one million: the whole figure with separators (the fraction is
 *     truncated, never rounded up into a larger number);
 *   - from one million: whole millions, rounded half up (`12 million`);
 *   - from one billion: two decimals, rounded half up (`1.24 billion`).
 *
 * Every step is `bigint`. A string that is not an optional sign and digits is
 * returned UNFORMATTED: showing the raw text is honest, and guessing a number
 * out of it is not.
 */
export function formatCredits(units: string, locale?: string): string {
  if (!SIGNED_INTEGER.test(units)) return units;

  const value = BigInt(units);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const integers = numberFormatter(locale, { maximumFractionDigits: 0 });

  if (magnitude < MICRO_PER_MILLION) {
    const whole = magnitude / MICRO;
    const text = integers.format(whole);
    return negative && whole > 0n ? `-${text}` : text;
  }

  const millions = (magnitude + MICRO_PER_MILLION / 2n) / MICRO_PER_MILLION;
  const sign = negative ? '-' : '';
  if (millions < 1_000n) return `${sign}${integers.format(millions)}${OVERVIEW_CREDITS_MILLION}`;

  const hundredths = (magnitude + MICRO_PER_HUNDREDTH_BILLION / 2n) / MICRO_PER_HUNDREDTH_BILLION;
  const decimal = `${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}`;
  // The exact decimal text goes to the formatter as text: it only inserts the
  // reader's separators, and a number that had been through a float could not
  // be grouped back to what it was. The cast is the one place the installed
  // typings and the platform disagree (decimal.ts documents the same call).
  const billions = numberFormatter(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(decimal as unknown as number);
  return `${sign}${billions}${OVERVIEW_CREDITS_BILLION}`;
}

// -----------------------------------------------------------------------------
// The face
// -----------------------------------------------------------------------------

/**
 * A chart's data, already shaped for drawing.
 *
 * `years` and `hours` are bar charts with a peak label; `rows` is a list of
 * named rows (the top tanks, the class split). A row with `bar: false` is a
 * text row with an empty bar cell: the Unknown class is counted but never
 * drawn as if it were a measured class (D-09).
 */
export type ChartSpec =
  | {
      kind: 'years' | 'hours';
      bars: { label: string; value: number }[];
      peakLabel: string;
    }
  | {
      kind: 'rows';
      rows: { name: string; sub: string | null; value: number; text: string; bar: boolean }[];
    };

/**
 * Everything a tile prints.
 *
 * `numeral` says the value is nine characters or fewer, so a hero may set it
 * at its 56px numeral; a longer value stays at the 32px Display size and
 * wraps. `summary` is the hidden one-line description of the chart, and is the
 * empty string when the tile has no chart.
 */
export interface TileFace {
  value: string;
  unit: string | null;
  rule: string;
  summary: string;
  chart: ChartSpec | null;
  numeral: boolean;
}

/** What `tileFace` needs besides the tile. */
export interface TileFaceContext {
  /** A BCP 47 tag; undefined is the browser's locale. */
  locale?: string;
}

/** The longest value a hero may set as its large numeral. */
const NUMERAL_MAX_CHARACTERS = 9;

/** The index of the largest value, the first one on a tie; -1 for none. */
function peakIndex(values: readonly number[]): number {
  let best = -1;
  let bestValue = -Infinity;
  values.forEach((value, index) => {
    if (value > bestValue) {
      bestValue = value;
      best = index;
    }
  });
  return best;
}

function face(
  id: OverviewReadyTile['id'],
  value: string,
  rule: string,
  chart: ChartSpec | null = null,
  summary = '',
): TileFace {
  return {
    value,
    unit: OVERVIEW_TILE_COPY[id].unit,
    rule,
    summary,
    chart,
    numeral: value.length <= NUMERAL_MAX_CHARACTERS,
  };
}

/**
 * The face of one ready tile.
 *
 * One branch per tile id. The switch is exhaustive over the wire contract's
 * union, so a tile added to `OverviewReadyTile` without a face is a compile
 * error and not a blank tile.
 */
export function tileFace(tile: OverviewReadyTile, ctx: TileFaceContext = {}): TileFace {
  const { locale } = ctx;

  switch (tile.id) {
    case 'logged': {
      const bars = tile.years.map(({ year, seconds }) => ({
        label: String(year),
        value: seconds / SECONDS_PER_HOUR,
      }));
      const peak = peakIndex(tile.years.map((entry) => entry.seconds));
      const peakEntry = peak < 0 ? undefined : tile.years[peak];
      const rule = formatLoggedRule(
        formatHours(tile.seconds, locale),
        formatDay(tile.firstDay, locale),
        tile.battleSeconds === null ? null : formatDays(tile.battleSeconds, locale),
      );
      const chart: ChartSpec | null =
        peakEntry === undefined
          ? null
          : {
              kind: 'years',
              bars,
              peakLabel: formatYearPeakLabel(
                formatHours(peakEntry.seconds, locale),
                peakEntry.year,
              ),
            };
      const summary =
        peakEntry === undefined
          ? ''
          : formatYearsChartSummary(
              tile.years.length,
              peakEntry.year,
              formatHours(peakEntry.seconds, locale),
            );
      return face('logged', formatDays(tile.seconds, locale), rule, chart, summary);
    }

    case 'hour': {
      const bars = tile.hours.map((seconds, hour) => ({
        label: formatHourOfDay(hour),
        value: seconds / SECONDS_PER_HOUR,
      }));
      const peakText = formatHourOfDay(tile.peakHour);
      return face(
        'hour',
        peakText,
        OVERVIEW_HOUR_RULE,
        { kind: 'hours', bars, peakLabel: peakText },
        formatHourChartSummary(peakText),
      );
    }

    case 'streak':
      return face(
        'streak',
        formatCount(tile.days, locale),
        formatStreakRule(formatDay(tile.startDay, locale), formatDay(tile.endDay, locale)),
      );

    case 'sess':
      return face(
        'sess',
        formatHours(tile.seconds, locale),
        formatSessRule(formatDay(tile.day, locale)),
      );

    case 'busy':
      return face(
        'busy',
        formatHours(tile.seconds, locale),
        formatBusyRule(formatDay(tile.day, locale)),
      );

    case 'tank': {
      const rows = tile.top.slice(0, 5).map((entry) => ({
        name: entry.name,
        sub: formatClassName(entry.classKey),
        value: entry.battles,
        text: formatCount(entry.battles, locale),
        bar: true,
      }));
      const listing = rows.map((row) => `${row.name} ${row.text}`).join(', ');
      return face(
        'tank',
        tile.name,
        formatTankRule(formatCount(tile.battles, locale), formatPercent(tile.share, locale)),
        { kind: 'rows', rows },
        formatTanksChartSummary(rows.length, listing),
      );
    }

    case 'cls': {
      const total = tile.rows.reduce((sum, row) => sum + row.battles, 0);
      const rows = tile.rows.map((row) => ({
        name: formatClassName(row.classKey),
        sub: null,
        value: row.battles,
        text: formatPercent(total > 0 ? row.battles / total : 0, locale),
        bar: row.classKey !== 'unknown',
      }));
      const listing = rows.map((row) => `${row.name} ${row.text}`).join(', ');
      return face(
        'cls',
        formatClassName(tile.classKey),
        formatClsRule(formatPercent(tile.share, locale), formatPercent(tile.coverage, locale)),
        { kind: 'rows', rows },
        formatClassesChartSummary(listing),
      );
    }

    case 'fleet':
      return face('fleet', formatCount(tile.count, locale), OVERVIEW_FLEET_RULE);

    case 'nat':
      return face(
        'nat',
        formatNationName(tile.nation),
        formatNatRule(formatPercent(tile.share, locale)),
      );

    case 'dmg':
    case 'xp':
    case 'kills':
      return face(
        tile.id,
        formatCount(tile.value, locale),
        formatRecordRule(tile.tankName, tile.accounts),
      );

    case 'snip':
      return face('snip', formatCount(tile.value, locale), OVERVIEW_SNIP_RULE);

    case 'cred':
      return face('cred', formatCredits(tile.units, locale), OVERVIEW_CRED_RULE);

    case 'bat':
      return face(
        'bat',
        formatCount(tile.battles, locale),
        formatBatRule(tile.winRate === null ? null : formatPercent(tile.winRate, locale)),
      );

    case 'ord':
      return face('ord', formatCount(tile.count, locale), OVERVIEW_ORD_RULE);
  }
}
