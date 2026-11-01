import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import { ruleDeclarations, styleText } from '../../helpers/css.ts';

// =============================================================================
// Plan 12-09 - the Perks pane, asserted by what its SOURCE promises
// =============================================================================
//
// Vitest has no DOM here, so the pane and its Dashboard wiring are read as text,
// in the style of `new-data-blocks.test.ts`. Every test asserts the file EXISTS
// first, because an empty string contains no forbidden token and would pass
// vacuously. The rendered half (the four cards, the mask toggle, the 375px
// overflow, no value in any attribute) is proved in the browser by plan 12-13.
// =============================================================================

const PANE_FILE = 'PerksPane.svelte';
const DASHBOARD_FILE = 'Dashboard.svelte';

/** Strip comments, so a comment that explains a rule cannot trip the rule. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** The comment-free source of a component that must exist. */
function clean(filename: string): string {
  expect(existsSync(componentPath(filename)), `${filename} exists`).toBe(true);
  return stripComments(readFileSync(componentPath(filename), 'utf8'));
}

/** The markup between the script and the style, where text and attributes live. */
function markup(source: string): string {
  return source.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
}

describe('PerksPane: the query and the stamped answer (T-12-30)', () => {
  const pane = clean(PANE_FILE);

  it("asks the 'perks' channel and accepts the outcome with the same channel", () => {
    expect(pane).toContain("channel: 'perks'");
    expect(pane).toMatch(/acceptDataOutcome\(outcome, 'perks', wanted, importedAt\)/);
  });

  it('keeps the applied answer in one stamped raw cell and derives the state from it', () => {
    expect(pane).toMatch(/\$state\.raw<ShownBlock<PerksView> \| null>\(null\)/);
    expect(pane).toMatch(/deriveFinanceState\(\{ importedAt, shown \}\)/);
    expect(pane).toMatch(/shown\.importedAt === importedAt/);
  });

  it('adds no reveal state of its own: the shell owns it', () => {
    expect(pane).toMatch(/\{ result, client, revealed, onRevealChange \}: Props/);
    expect(pane).not.toMatch(/\$state\(\s*(false|true)\s*\)/);
    expect(pane).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
});

describe('PerksPane: the live region and the fixed sentences (T-12-29)', () => {
  const pane = clean(PANE_FILE);

  it('has exactly one explicit aria-live and one status paragraph', () => {
    expect(pane.match(/aria-live/g) ?? []).toHaveLength(1);
    expect(pane.match(/role="status"/g) ?? []).toHaveLength(1);
    expect(pane).toContain('data-testid="perks-status"');
  });

  it('shows the loading sentence in the status line while loading', () => {
    expect(pane).toMatch(/blockState === 'loading' \? PERKS_LOADING : announcement/);
  });

  it('renders the error as a role=alert holding only the fixed PERKS_ERROR', () => {
    const alert = /<p[^>]*role="alert"[^>]*>([^<]*)<\/p>/.exec(markup(pane));
    expect(alert, 'an alert paragraph').not.toBeNull();
    expect(alert![1]!.trim()).toBe('{PERKS_ERROR}');
  });
});

describe('PerksPane: the cards', () => {
  const pane = clean(PANE_FILE);

  it('carries every test id of the UI-SPEC', () => {
    for (const id of [
      'perks-block',
      'perks-status',
      'perks-merge-note',
      'perks-mask-toggle',
      'perks-mask-caption',
      'about-perks',
      'perks-card-subscriptions',
      'perks-card-coupons',
      'perks-card-bonus-codes',
      'perks-card-surveys',
    ]) {
      expect(pane, id).toContain(id);
    }
  });

  it('iterates PERKS_CARD_IDS in a keyed each over the fixed tuple', () => {
    expect(pane).toMatch(/\{#each PERKS_CARD_IDS as id \(id\)\}/);
  });

  it('renders the shared NewDataCard as a table and forks nothing', () => {
    expect(pane).toContain("import NewDataCard from './NewDataCard.svelte'");
    expect(pane).toContain('layout="table"');
    expect(pane).not.toMatch(/NewDataTable/);
  });

  it('sets severalTags from the subscriptions id only', () => {
    expect(pane.match(/severalTags=/g) ?? []).toHaveLength(1);
    expect(pane).toContain("severalTags={id === 'subscriptions'}");
  });

  it('orders each ready card by account and shows the merge note only with tags and merged rows', () => {
    expect(pane).toMatch(/orderRowsByAccount\(card\.rows, tags\)/);
    expect(pane).toMatch(/readyView !== null && tags !== null \? readyView\.mergedAway : 0/);
    expect(pane).toMatch(/\{#if mergedAway > 0\}/);
    expect(pane).toContain('formatMergeNote(mergedAway)');
  });
});

describe('PerksPane: the mask (T-12-28, D-13)', () => {
  it('puts the strong note role on the toggle and leaves the type to the role', () => {
    const source = clean(PANE_FILE);
    expect(markup(source)).toMatch(
      /<button\s+type="button"\s+class="t-note-strong"\s+data-testid="perks-mask-toggle"/,
    );
    const rule = ruleDeclarations(styleText(source), 'button');
    expect(rule, 'a rule for button').not.toBe('');
    expect(rule).not.toMatch(/font-(size|weight)|line-height/);
  });

  const pane = clean(PANE_FILE);

  it('gates the toggle by hasMaskableRows over the coupon and bonus-code cards', () => {
    expect(pane).toMatch(/hasMaskableRows\(\[cards\.coupons, cards\.bonusCodes\]\)/);
    expect(pane).toMatch(/\{#if canReveal\}/);
  });

  it('uses the PERKS_MASK copy and not the IP-only MASK set', () => {
    for (const name of [
      'PERKS_MASK_TOGGLE_SHOW',
      'PERKS_MASK_TOGGLE_HIDE',
      'PERKS_MASK_CAPTION_MASKED',
      'PERKS_MASK_CAPTION_REVEALED',
      'PERKS_MASK_ANNOUNCE_SHOWN',
      'PERKS_MASK_ANNOUNCE_MASKED',
    ]) {
      expect(pane, name).toContain(name);
    }
    expect(pane).not.toMatch(/(?<![A-Z_])MASK_(TOGGLE|CAPTION|ANNOUNCE)/);
  });

  it('drives the shell reveal from the next value', () => {
    expect(pane).toMatch(/const next = !revealed;\s*onRevealChange\(next\);/);
  });

  it('puts no title or aria-label attribute and no cell-bearing attribute in the markup', () => {
    const body = markup(pane);
    // A `title=` prop on the NewDataCard component is a card heading, not an
    // HTML attribute; only lower-case element tags are scanned.
    expect(body).not.toMatch(/<[a-z][^>]*\stitle=/);
    expect(body).not.toMatch(/\saria-label=/);
    expect(body).not.toMatch(/\sdata-(?!testid|state|masked)[a-z-]+=/);
    expect(body).not.toMatch(/\{@html/);
  });

  it('does not touch the cells itself: it never reads a row cell', () => {
    expect(pane).not.toMatch(/\.cells\b/);
    expect(pane).not.toMatch(/formatNewDataCell/);
  });

  it('imports nothing from the login aggregates', () => {
    expect(pane).not.toMatch(/from '[^']*logins?[^']*'/);
    expect(pane).not.toMatch(/geo\//);
  });

  it('introduces no new colour token, media query or transition', () => {
    expect(pane).not.toMatch(/@media/);
    expect(pane).not.toMatch(/transition|animation/);
    expect(pane).not.toMatch(/--[a-z-]+\s*:/);
  });
});

describe('Dashboard: the perks branch', () => {
  const dashboard = clean(DASHBOARD_FILE);

  it('mounts PerksPane with the shell reveal and the channel-scoped client', () => {
    expect(dashboard).toContain("import PerksPane from '../features/new-data/PerksPane.svelte'");
    expect(dashboard).toContain("{:else if active === 'perks'}");
    expect(dashboard).toContain("newDataSectionProps('perks')");
    expect(dashboard).toMatch(
      /<PerksPane\s+\{result\}\s+client=\{ingestClient\.data\}\s+\{revealed\}\s+onRevealChange=\{setRevealed\}\s*\/>/,
    );
  });

  it('passes no gameFilter to PerksPane', () => {
    const mount = /<PerksPane\b[^>]*>/s.exec(dashboard);
    expect(mount, 'a PerksPane mount').not.toBeNull();
    expect(mount![0]).not.toContain('gameFilter');
  });
});
