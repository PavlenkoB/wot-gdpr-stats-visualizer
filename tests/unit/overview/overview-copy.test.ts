import { describe, expect, it } from 'vitest';

import {
  OVERVIEW_ABSENT_PREFIX,
  OVERVIEW_ATTRIBUTION_LINK_HREF,
  OVERVIEW_ATTRIBUTION_LINK_TEXT,
  OVERVIEW_ATTRIBUTION_NOTICE,
  OVERVIEW_ATTRIBUTION_TEXT,
  OVERVIEW_CREDITS_BILLION,
  OVERVIEW_CREDITS_MILLION,
  OVERVIEW_CRED_RULE,
  OVERVIEW_EMPTY,
  OVERVIEW_HINT,
  OVERVIEW_LIFE_LABEL,
  OVERVIEW_LIFE_NO_SESSIONS,
  OVERVIEW_LIFE_UNDER_TENTH,
  formatAbsentRest,
  formatLifeDays,
  formatProvenance,
  formatProvenanceRange,
  OVERVIEW_FLEET_RULE,
  OVERVIEW_GROUP_HEADINGS,
  OVERVIEW_HOUR_RULE,
  OVERVIEW_HOW_HEADING,
  OVERVIEW_LEGEND_LOW,
  OVERVIEW_LEGEND_PEAK,
  OVERVIEW_NEED_TEXT,
  OVERVIEW_ORD_RULE,
  OVERVIEW_READS_HEADING,
  OVERVIEW_SNIP_RULE,
  OVERVIEW_TILE_COPY,
  OVERVIEW_TOO_FEW_BATTLES,
  OVERVIEW_VEHICLE_NOT_RECORDED,
  formatBatRule,
  formatBusyRule,
  formatClassName,
  formatClsRule,
  formatLoggedRule,
  formatNatRule,
  formatNationName,
  formatPinnedAnnouncement,
  formatRecordRule,
  formatClassesChartSummary,
  formatHourChartSummary,
  formatSessRule,
  formatStarLabel,
  formatStreakRule,
  formatTankRule,
  formatTanksChartSummary,
  formatUnpinnedAnnouncement,
  formatYearPeakLabel,
  formatYearsChartSummary,
} from '../../../src/lib/ui-copy.ts';
import { OVERVIEW_TILE_IDS } from '../../../src/lib/features/overview/overview-shared.ts';

// =============================================================================
// The Overview's TILE COPY (13-06 Task 1, D-17, D-19, D-20, D-21)
// =============================================================================
//
// D-17: every headline figure shows the rule behind it, the rule says what
// was counted, and the copy NEVER names a measurement the data cannot
// support. The last of those is a GUARD here: every string this module
// exports is collected and matched against the banned measurements, so a
// future tile cannot quietly introduce one.
//
// The banned list is D-17's own: no WN8, no mastery, no marks of excellence,
// no mode mix. The battle-type table covers about 5% of a real export's
// battles, so a mode mix would be a claim the data does not support.
// =============================================================================

/** Every measurement D-17 forbids in Overview copy. */
const BANNED_MEASUREMENT = /WN8|mastery|marks? of excellence|mode[- ]mix/i;

/** The labels the UI-SPEC Tile Catalogue fixes. */
const LABELS: Readonly<Record<string, string>> = {
  logged: 'Logged in',
  hour: 'Signature hour',
  streak: 'Longest streak',
  sess: 'Longest session',
  busy: 'Busiest day',
  tank: 'Most-played tank',
  cls: 'Favourite class',
  fleet: 'Tanks played',
  nat: 'Favourite nation',
  dmg: 'Most damage, one battle',
  xp: 'Most XP, one battle',
  kills: 'Most kills, one battle',
  snip: 'Sniper series',
  cred: 'Credits earned',
  bat: 'Battles',
  ord: 'Orders',
};

describe('the tile copy table', () => {
  it('has an entry for every catalogue id', () => {
    expect(Object.keys(OVERVIEW_TILE_COPY).sort()).toEqual([...OVERVIEW_TILE_IDS].sort());
  });

  it('gives every tile a non-empty label, definition, source and file', () => {
    for (const id of OVERVIEW_TILE_IDS) {
      const copy = OVERVIEW_TILE_COPY[id];
      expect(copy.label.length, `${id} has a label`).toBeGreaterThan(0);
      expect(copy.how.length, `${id} has a definition`).toBeGreaterThan(0);
      expect(copy.reads.length, `${id} names its source`).toBeGreaterThan(0);
      expect(copy.file.length, `${id} names its file`).toBeGreaterThan(0);
    }
  });

  it('uses the catalogue labels verbatim', () => {
    for (const id of OVERVIEW_TILE_IDS) {
      expect(OVERVIEW_TILE_COPY[id].label, `${id} label`).toBe(LABELS[id]);
    }
  });

  it('uses the catalogue units verbatim', () => {
    expect(OVERVIEW_TILE_COPY.logged.unit).toBe('days');
    expect(OVERVIEW_TILE_COPY.streak.unit).toBe('days');
    expect(OVERVIEW_TILE_COPY.sess.unit).toBe('h');
    expect(OVERVIEW_TILE_COPY.busy.unit).toBe('h');
    for (const id of OVERVIEW_TILE_IDS) {
      if (id === 'logged' || id === 'streak' || id === 'sess' || id === 'busy') continue;
      expect(OVERVIEW_TILE_COPY[id].unit, `${id} has no unit`).toBeNull();
    }
  });

  it('names the export file each tile reads', () => {
    expect(OVERVIEW_TILE_COPY.logged.file).toBe('*_Game_Sessions.csv');
    expect(OVERVIEW_TILE_COPY.hour.file).toBe('WOT_Game_Sessions.csv');
    expect(OVERVIEW_TILE_COPY.streak.file).toBe('WOT_Game_Sessions.csv');
    expect(OVERVIEW_TILE_COPY.sess.file).toBe('WOT_Game_Sessions.csv');
    expect(OVERVIEW_TILE_COPY.busy.file).toBe('WOT_Game_Sessions.csv');
    expect(OVERVIEW_TILE_COPY.tank.file).toBe('WOT_Vehicle_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.cls.file).toBe('WOT_Vehicle_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.fleet.file).toBe('WOT_Vehicle_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.nat.file).toBe('WOT_Vehicle_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.dmg.file).toBe('WOT_Account_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.xp.file).toBe('WOT_Account_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.kills.file).toBe('WOT_Account_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.snip.file).toBe('WOT_Account_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.bat.file).toBe('WOT_Account_Statistics.csv');
    expect(OVERVIEW_TILE_COPY.cred.file).toBe('Virtual_Currencies_Operations.csv');
    expect(OVERVIEW_TILE_COPY.ord.file).toBe('Orders.csv');
  });

  it('names its source in friendly words', () => {
    expect(OVERVIEW_TILE_COPY.logged.reads).toBe('session history');
    expect(OVERVIEW_TILE_COPY.tank.reads).toBe('vehicle statistics');
    expect(OVERVIEW_TILE_COPY.dmg.reads).toBe('account statistics');
    expect(OVERVIEW_TILE_COPY.cred.reads).toBe('currency operations');
    expect(OVERVIEW_TILE_COPY.ord.reads).toBe('payment history');
  });

  it('names the source the same way the absent row does', () => {
    const wordings = Object.values(OVERVIEW_NEED_TEXT);
    for (const id of OVERVIEW_TILE_IDS) {
      expect(wordings, `${id} reads a source with an absent-row wording`).toContain(
        OVERVIEW_TILE_COPY[id].reads,
      );
    }
  });
});

describe('the rule lines', () => {
  it('says the Logged in figure counts every game', () => {
    const rule = formatLoggedRule('1,234.5', '3 Jan 2014', null);
    expect(rule).toContain('across all games');
    expect(rule).not.toContain('In battle');
  });

  it('adds the battle figure only when there is one', () => {
    const rule = formatLoggedRule('1,234.5', '3 Jan 2014', '117');
    expect(rule).toContain('across all games');
    expect(rule).toContain('In battle');
    expect(rule).toContain('117 days');
  });

  it('says the habit rules count WoT sessions', () => {
    expect(formatStreakRule('3 Jan 2014', '19 Jan 2014')).toContain('WoT sessions');
    expect(formatSessRule('19 Jan 2014')).toContain('WoT sessions');
    expect(formatBusyRule('19 Jan 2014')).toContain('WoT sessions');
  });

  it('says a session runs from login to logout', () => {
    expect(formatSessRule('19 Jan 2014')).toContain('One login to logout');
  });

  it('says the signature hour is wall clock as recorded', () => {
    expect(OVERVIEW_HOUR_RULE).toBe('Logged hours by hour of day, wall clock as recorded.');
  });

  it('says how much of the data the class tile could classify', () => {
    expect(formatClsRule('60%', '97%')).toBe('60% of battles. Class known for 97% of battles.');
  });

  it('says how many tanks have battles and how much of the fleet one tank is', () => {
    expect(OVERVIEW_FLEET_RULE).toBe('Different tanks with battles.');
    expect(formatTankRule('900', '60%')).toBe('900 battles, 60% of all battles.');
    expect(formatNatRule('60%')).toBe('60% of battles.');
  });

  it('names the record tank and the accounts it is the best of', () => {
    expect(formatRecordRule('Synth One', 2)).toBe('Synth One, best of 2 accounts.');
    expect(formatRecordRule('Synth One', 3)).toBe('Synth One, best of 3 accounts.');
    expect(formatRecordRule('Synth One', 1)).toBe('Synth One.');
  });

  it('says a record without a tank is not recorded', () => {
    expect(formatRecordRule(null, 2)).toBe(`${OVERVIEW_VEHICLE_NOT_RECORDED}, best of 2 accounts.`);
    expect(formatRecordRule(null, 1)).toBe(`${OVERVIEW_VEHICLE_NOT_RECORDED}.`);
  });

  it('says the sniper series is the longest run recorded', () => {
    expect(OVERVIEW_SNIP_RULE).toBe('Longest run recorded.');
  });

  it('counts credits the way the Finance pane does', () => {
    expect(OVERVIEW_CRED_RULE).toContain('Deposits plus income');
    expect(OVERVIEW_CRED_RULE).toContain('Finance');
  });

  it('counts orders and shows no amount', () => {
    expect(OVERVIEW_ORD_RULE).toContain('Count only');
    expect(OVERVIEW_ORD_RULE).toContain('Amounts are never shown here');
  });

  it('guards a win rate that rests on too few battles', () => {
    expect(formatBatRule(null)).toBe(OVERVIEW_TOO_FEW_BATTLES);
    expect(formatBatRule('52%')).toBe('52% wins.');
  });
});

describe('the pin copy', () => {
  it('keeps the star label fixed', () => {
    expect(formatStarLabel('Logged in')).toBe('Pin Logged in');
    expect(formatStarLabel('Logged in')).not.toContain('Unpin');
  });

  it('announces a pin and an unpin without a data value', () => {
    expect(formatPinnedAnnouncement('Logged in', 3)).toBe('Pinned Logged in, 3 pinned.');
    expect(formatUnpinnedAnnouncement('Logged in', 2)).toBe('Unpinned Logged in, 2 pinned.');
  });
});

describe('the class and nation names', () => {
  it('names every class the tank table spells', () => {
    expect(formatClassName('mediumTank')).toBe('Medium');
    expect(formatClassName('AT-SPG')).toBe('Tank destroyer');
    expect(formatClassName('heavyTank')).toBe('Heavy');
    expect(formatClassName('lightTank')).toBe('Light');
    expect(formatClassName('SPG')).toBe('SPG');
  });

  it('calls an unnamed class Unknown rather than guessing', () => {
    expect(formatClassName('unknown')).toBe('Unknown');
    expect(formatClassName('somethingElse')).toBe('Unknown');
  });

  it('names every nation prefix the export uses', () => {
    expect(formatNationName('ussr')).toBe('USSR');
    expect(formatNationName('usa')).toBe('USA');
    expect(formatNationName('germany')).toBe('Germany');
    expect(formatNationName('france')).toBe('France');
    expect(formatNationName('china')).toBe('China');
    expect(formatNationName('uk')).toBe('UK');
    expect(formatNationName('japan')).toBe('Japan');
    expect(formatNationName('sweden')).toBe('Sweden');
    expect(formatNationName('czech')).toBe('Czechoslovakia');
    expect(formatNationName('poland')).toBe('Poland');
    expect(formatNationName('italy')).toBe('Italy');
  });

  it('returns an unknown prefix unchanged rather than guessing', () => {
    expect(formatNationName('zz')).toBe('zz');
    expect(formatNationName('')).toBe('');
  });
});

describe('the D-17 copy guard', () => {
  it('names no banned measurement in any Overview string', () => {
    const strings: string[] = [];

    for (const id of OVERVIEW_TILE_IDS) {
      const copy = OVERVIEW_TILE_COPY[id];
      strings.push(copy.label, copy.how, copy.reads, copy.file);
      if (copy.unit !== null) strings.push(copy.unit);
    }

    strings.push(
      ...Object.values(OVERVIEW_GROUP_HEADINGS),
      ...Object.values(OVERVIEW_NEED_TEXT),
      OVERVIEW_HOW_HEADING,
      OVERVIEW_READS_HEADING,
      OVERVIEW_LEGEND_LOW,
      OVERVIEW_LEGEND_PEAK,
      OVERVIEW_VEHICLE_NOT_RECORDED,
      OVERVIEW_TOO_FEW_BATTLES,
      OVERVIEW_HOUR_RULE,
      OVERVIEW_FLEET_RULE,
      OVERVIEW_SNIP_RULE,
      OVERVIEW_CRED_RULE,
      OVERVIEW_ORD_RULE,
      OVERVIEW_HINT,
      OVERVIEW_LIFE_LABEL,
      OVERVIEW_LIFE_NO_SESSIONS,
      OVERVIEW_LIFE_UNDER_TENTH,
      OVERVIEW_EMPTY,
      OVERVIEW_ABSENT_PREFIX,
      OVERVIEW_ATTRIBUTION_TEXT,
      OVERVIEW_ATTRIBUTION_NOTICE,
      OVERVIEW_ATTRIBUTION_LINK_TEXT,
      OVERVIEW_CREDITS_MILLION,
      OVERVIEW_CREDITS_BILLION,
      formatLifeDays('0.6'),
      formatAbsentRest(['Favourite class'], ['vehicle statistics']),
      formatProvenance(2, 'World of Tanks, World of Tanks Blitz', 'Mar 2020 to Jun 2021'),
      formatProvenance(1, '', null),
      formatProvenanceRange('Mar 2020', 'Jun 2021'),
    );

    strings.push(
      formatLoggedRule('1,234.5', '3 Jan 2014', '117'),
      formatStreakRule('3 Jan 2014', '19 Jan 2014'),
      formatSessRule('19 Jan 2014'),
      formatBusyRule('19 Jan 2014'),
      formatTankRule('900', '60%'),
      formatClsRule('60%', '97%'),
      formatNatRule('60%'),
      formatRecordRule('Synth One', 2),
      formatRecordRule(null, 2),
      formatBatRule('52%'),
      formatBatRule(null),
      formatStarLabel('Logged in'),
      formatPinnedAnnouncement('Logged in', 3),
      formatUnpinnedAnnouncement('Logged in', 2),
      formatClassName('mediumTank'),
      formatClassName('unknown'),
      formatNationName('ussr'),
      formatNationName('zz'),
      formatYearPeakLabel('1,234.5', 2019),
      formatYearsChartSummary(1, 2019, '1,234.5'),
      formatYearsChartSummary(3, 2019, '1,234.5'),
      formatHourChartSummary('21:00'),
      formatTanksChartSummary(2, 'Synth One 900, Synth Two 40'),
      formatClassesChartSummary('Medium tank 60%'),
    );

    expect(strings.length).toBeGreaterThan(90);
    for (const value of strings) {
      expect(value, `Overview copy must not name a banned measurement: ${value}`).not.toMatch(
        BANNED_MEASUREMENT,
      );
    }
  });
});

describe('the composed page copy (13-12)', () => {
  it('uses the approved strings verbatim', () => {
    expect(OVERVIEW_HINT).toBe(
      'Click a tile to see how it is computed. Star a tile to pin it to the top. Arrow keys move between tiles, P pins the focused tile, Esc closes.',
    );
    expect(OVERVIEW_LIFE_LABEL).toBe('Wargaming life');
    expect(OVERVIEW_LIFE_NO_SESSIONS).toBe('no sessions in this export');
    expect(OVERVIEW_LIFE_UNDER_TENTH).toBe('under 0.1 days');
    expect(formatLifeDays('0.6')).toBe('0.6 days');
    expect(OVERVIEW_EMPTY).toBe(
      'None of these tiles has data in this export. Each group says what it needs.',
    );
    expect(OVERVIEW_ABSENT_PREFIX).toBe('Not in this export:');
    expect(OVERVIEW_ATTRIBUTION_TEXT).toBe(
      'Tank names, nations and classes: Wargaming.net API data.',
    );
    expect(OVERVIEW_ATTRIBUTION_NOTICE).toBe(
      '© Wargaming.net. All rights reserved. Unofficial fan tool, not affiliated with or endorsed by Wargaming.net.',
    );
    expect(OVERVIEW_ATTRIBUTION_LINK_TEXT).toBe('World of Tanks');
    expect(OVERVIEW_ATTRIBUTION_LINK_HREF).toBe('https://worldoftanks.eu/');
  });

  it('formatAbsentRest joins the names and the needs', () => {
    expect(formatAbsentRest(['Favourite class'], ['vehicle statistics'])).toBe(
      ' Favourite class · needs vehicle statistics',
    );
    expect(
      formatAbsentRest(
        ['Most damage, one battle', 'Most XP, one battle'],
        ['account statistics (DAMAGE_MAX)', 'account statistics (XP_MAX)'],
      ),
    ).toBe(
      ' Most damage, one battle, Most XP, one battle · needs account statistics (DAMAGE_MAX), account statistics (XP_MAX)',
    );
  });

  it('formatProvenance pluralises: 1 folder, 2 folders', () => {
    expect(formatProvenance(1, 'World of Tanks', null)).toBe(
      'Computed on this device from 1 account folder · World of Tanks',
    );
    expect(formatProvenance(2, 'World of Tanks', null)).toBe(
      'Computed on this device from 2 account folders · World of Tanks',
    );
  });

  it('formatProvenance adds the range only when there is one', () => {
    expect(
      formatProvenance(2, 'World of Tanks', formatProvenanceRange('Mar 2020', 'Jun 2021')),
    ).toBe(
      'Computed on this device from 2 account folders · World of Tanks · Mar 2020 to Jun 2021',
    );
    expect(formatProvenance(2, 'World of Tanks', null)).not.toContain(' to ');
  });

  it('formatProvenance groups large counts', () => {
    expect(formatProvenance(1234, '', null)).toBe(
      'Computed on this device from 1,234 account folders',
    );
  });
});

describe('the chart summaries and credits words (IN-02)', () => {
  it('words the credits magnitude with a leading space', () => {
    expect(OVERVIEW_CREDITS_MILLION).toBe(' million');
    expect(OVERVIEW_CREDITS_BILLION).toBe(' billion');
  });

  it('words the hours-per-year chart and pluralises the years', () => {
    expect(formatYearPeakLabel('1,234.5', 2019)).toBe('1,234.5 h · 2019');
    expect(formatYearsChartSummary(1, 2019, '1,234.5')).toBe(
      'Chart: hours logged per year, 1 year, peak 2019 with 1,234.5 hours.',
    );
    expect(formatYearsChartSummary(3, 2019, '1,234.5')).toBe(
      'Chart: hours logged per year, 3 years, peak 2019 with 1,234.5 hours.',
    );
  });

  it('words the hour, tank and class summaries', () => {
    expect(formatHourChartSummary('21:00')).toBe(
      'Chart: hours logged by hour of day, peak at 21:00.',
    );
    expect(formatTanksChartSummary(2, 'A 9, B 4')).toBe('Top 2 tanks by battles: A 9, B 4.');
    expect(formatClassesChartSummary('Medium tank 60%')).toBe('Battles by class: Medium tank 60%.');
  });
});
