// =============================================================================
// account-timeline-perks-export.test.ts - the Node proof of the composed Phase 12
// archive (plan 12-13)
// =============================================================================
//
// WHAT THIS PROVES, in one line: the archive the browser tests import goes
// through the REAL worker to exactly the hand-derived figures in ATP_EXPECTED,
// and nothing planted (an email, a free-text canary, an excluded address) reaches
// storage or a posted view. The browser tests assert the same literals against
// the page, so an oracle that disagreed with the worker would be found HERE, in
// Node, before any browser runs.
//
// Every expected value is read from ATP_EXPECTED, whose literals were derived by
// hand in the two source fixtures (`timeline-fixtures.ts`, `perks-fixtures.ts`)
// and re-stated in this archive's tag letters. Nothing is computed by the code
// under test.

import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataQuery } from '../../../src/lib/core/types/worker-messages.ts';
import {
  NEW_DATA_PANE_IDS,
  PERKS_CARD_IDS,
  type NewDataCardView,
  type PerksView,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
import type { TimelineView } from '../../../src/lib/features/account-timeline/timeline-shared.ts';
import { paneEntries } from '../../../src/lib/shell/selection-state.ts';
import {
  formatPerksRowSummary,
  formatRowCount,
  formatTimelineRowSummary,
} from '../../../src/lib/ui-copy.ts';
import {
  ATP_ADDRESSES,
  ATP_CANARY_EMAILS,
  ATP_CODES,
  ATP_EXPECTED,
  ATP_FORUM_ADDRESS,
  ATP_FORUM_EMAIL,
  ATP_LARGE_ROOT,
  ATP_NEVER_ADDRESSES,
  ATP_NEVER_TEXT,
  ATP_ROOTS,
  ATP_UNLISTED_EMAIL,
  ATP_UNLISTED_HEADER,
  buildAccountTimelinePerksExport,
  buildAccountTimelinePerksVariantExport,
  buildLargeAccountTimelineExport,
} from '../../fixtures/account-timeline-perks-export.ts';
import type { PkCardId } from '../../fixtures/perks-fixtures.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';

const WAIT_MS = 10_000;

let post: WorkerPostSpy;
let nextQueryId = 1300;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Ingest one archive and fail loudly unless the import finished `done`. */
async function ingest(bytes: Uint8Array, name: string) {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
  if (terminal.type !== 'done') throw new Error('expected done');
  return terminal.result;
}

/** The JSON of everything at rest: every row and the active meta record. */
async function everythingAtRest(): Promise<string> {
  const { db } = await importWorkerDb();
  return JSON.stringify([await db.rows.toArray(), (await db.meta.get('active')) ?? null]);
}

/** Ask one query and return the posted reply's view. */
async function ask(query: DataQuery): Promise<unknown> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId: nextQueryId++, query });
  const reply = await waitForMessage(post, 'data-result', WAIT_MS);
  if (reply.type !== 'data-result') throw new Error('expected data-result');
  if (reply.result === null) throw new Error('expected a result');
  expect(reply.result.channel).toBe(query.channel);
  return reply.result.view;
}

const askTimeline = async (): Promise<TimelineView> =>
  (await ask({ channel: 'account-timeline' })) as TimelineView;

const askPerks = async (): Promise<PerksView> => (await ask({ channel: 'perks' })) as PerksView;

/** The tag letter of an account root: A for the first of the D-16 order. */
function letterOf(root: string): string {
  const index = ATP_ROOTS.indexOf(root);
  if (index < 0) throw new Error(`${root} is not a root of the archive`);
  return String.fromCharCode(65 + index);
}

/** A card id to the key of the Perks view. */
const CARD_KEY: Readonly<Record<PkCardId, 'subscriptions' | 'coupons' | 'bonusCodes' | 'surveys'>> =
  {
    subscriptions: 'subscriptions',
    coupons: 'coupons',
    bonusCodes: 'bonusCodes',
    surveys: 'surveys',
  };

/** The ready card of a Perks view, or a failure naming the card that was not ready. */
function readyCard(view: PerksView, id: PkCardId) {
  const card: NewDataCardView = view.cards[CARD_KEY[id]];
  if (card.status !== 'ready') throw new Error(`expected ${id} ready, got ${card.status}`);
  return card;
}

/** Every row of a card as its sorted tag letters joined, sorted: order-independent. */
function lettersOfCard(card: Extract<NewDataCardView, { status: 'ready' }>): string[] {
  return card.rows
    .map((row) => (row.accounts ?? [row.account]).map(letterOf).sort().join(''))
    .sort();
}

// ---------------------------------------------------------------------------
// The archive itself
// ---------------------------------------------------------------------------

describe('the composed archive', () => {
  it('has exactly the three real-shape account roots at the top level', () => {
    const roots = new Set(
      Object.keys(unzipSync(buildAccountTimelinePerksExport()))
        .filter((path) => path.includes('/'))
        .map((path) => path.slice(0, path.indexOf('/'))),
    );
    expect([...roots].sort()).toEqual([...ATP_ROOTS].sort());
  });

  it('carries every planted canary the assertions rule out', () => {
    // Without this, each negative assertion below would pass against a build that
    // stored nothing, because there would be nothing to store.
    const text = Object.values(unzipSync(buildAccountTimelinePerksExport()))
      .map((bytes) => new TextDecoder('utf-8').decode(bytes))
      .join('\n');
    for (const value of [
      ...ATP_CANARY_EMAILS,
      ...ATP_NEVER_TEXT,
      ...ATP_NEVER_ADDRESSES,
      ...ATP_ADDRESSES,
      ...ATP_CODES,
      ATP_UNLISTED_HEADER,
    ]) {
      expect(text, `${value} in the archive`).toContain(value);
    }
  });

  it('puts the forum file and the unlisted Bans file under the first root', () => {
    const paths = Object.keys(unzipSync(buildAccountTimelinePerksExport()));
    expect(paths).toContain(`${ATP_ROOTS[0]}/Game_Forums/WOT_Forum_User_Info.csv`);
    expect(paths).toContain(`${ATP_ROOTS[0]}/Bans/Unlisted_Extra.csv`);
  });

  it('drops the overlay identity file: no root holds a second Account_Info', () => {
    const paths = Object.keys(unzipSync(buildAccountTimelinePerksExport()));
    const identities = paths.filter((path) => path.endsWith('/User_Info/Account_Info.csv'));
    // The real-shape RU root has none (its identity is misfiled), EU and NA have one.
    expect(identities).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// The pane facts and the two list rows
// ---------------------------------------------------------------------------

describe('the pane facts reach the list', () => {
  it('publishes presence facts and STORED rows for exactly the two Phase 12 panes', async () => {
    const result = await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    expect(result.newDataPanes).toEqual({
      'account-timeline': {
        fileCount: ATP_EXPECTED.timeline.fileCount,
        rowCount: ATP_EXPECTED.timeline.rowCount,
      },
      perks: { fileCount: ATP_EXPECTED.perks.fileCount, rowCount: ATP_EXPECTED.perks.rowCount },
    });
    expect(NEW_DATA_PANE_IDS).toContain('perks');
    expect(NEW_DATA_PANE_IDS).toContain('account-timeline');
  });

  it('renders both rows with the stored-row headline and the file-count summary', async () => {
    const result = await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const entries = paneEntries(result);
    const timeline = entries.find((entry) => entry.id === 'account-timeline');
    const perks = entries.find((entry) => entry.id === 'perks');
    expect(timeline?.headline).toBe(formatRowCount(ATP_EXPECTED.timeline.rowCount));
    expect(timeline?.summary).toBe(formatTimelineRowSummary(ATP_EXPECTED.timeline.fileCount));
    expect(perks?.headline).toBe(formatRowCount(ATP_EXPECTED.perks.rowCount));
    expect(perks?.summary).toBe(formatPerksRowSummary(ATP_EXPECTED.perks.fileCount));
    expect(timeline?.muted).toBe(false);
    expect(perks?.muted).toBe(false);
  });

  it('counts the three accounts', async () => {
    const result = await ingest(buildAccountTimelinePerksExport(), 'atp.zip');
    expect(result.accounts?.map((account) => account.root).sort()).toEqual([...ATP_ROOTS].sort());
  });
});

// ---------------------------------------------------------------------------
// The two channels
// ---------------------------------------------------------------------------

describe('the account-timeline channel answers the hand-derived chronology', () => {
  it('lists the entries in the oracle order with its kinds, dates, parts and tag letters', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const view = await askTimeline();
    expect(view.status).toBe('ready');
    expect(
      view.entries.map((entry) => ({
        kind: entry.kind,
        date: entry.date,
        parts: entry.parts.map((part) => part.cell),
        letters: entry.accounts.map(letterOf).sort(),
      })),
    ).toEqual(
      ATP_EXPECTED.timeline.entries.map((entry) => ({
        kind: entry.kind,
        date: entry.date,
        parts: [...entry.parts],
        letters: [...entry.letters],
      })),
    );
  });

  it('reports the stored rows and the rows merged away', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const view = await askTimeline();
    expect(view.storedRows).toBe(ATP_EXPECTED.timeline.rowCount);
    expect(view.mergedAway).toBe(ATP_EXPECTED.timeline.mergedAway);
  });

  it('has the kinds the chip row is built from, in the fixed order', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const view = await askTimeline();
    const order = ['name', 'service', 'language', 'country', 'ban', 'thirdParty'];
    const kinds = [...new Set(view.entries.map((entry) => entry.kind))].sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );
    expect(kinds).toEqual(ATP_EXPECTED.timeline.kindsPresent);
    expect(ATP_EXPECTED.timeline.chipCount).toBe(kinds.length >= 2 ? kinds.length + 1 : 0);
    if (ATP_EXPECTED.timeline.filterKind !== undefined) {
      expect(kinds).toContain(ATP_EXPECTED.timeline.filterKind);
    }
  });

  it('merges a service entry across the three accounts into one carrying A, B and C', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const view = await askTimeline();
    const widest = Math.max(...view.entries.map((entry) => entry.accounts.length));
    expect(widest).toBe(
      Math.max(...ATP_EXPECTED.timeline.entries.map((entry) => entry.letters.length)),
    );
  });
});

describe('the perks channel answers the hand-derived cards', () => {
  it('has every mapped card ready with its displayed rows and tag letters', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const view = await askPerks();
    expect(view.status).toBe('ready');
    for (const id of ATP_EXPECTED.perks.cardsPresent) {
      const expected = ATP_EXPECTED.perks.cards[id]!;
      const card = readyCard(view, id);
      expect(card.rows, `${id} displayed rows`).toHaveLength(expected.displayedRows);
      expect(lettersOfCard(card), `${id} tag letters`).toEqual(
        expected.rowLetters.map((letters) => [...letters].sort().join('')).sort(),
      );
    }
  });

  it('answers not-in-export for a card that is not mapped', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const view = await askPerks();
    for (const id of PERKS_CARD_IDS) {
      if (!ATP_EXPECTED.perks.cardsPresent.includes(id as PkCardId)) {
        expect(view.cards[id].status, id).toBe('not-in-export');
      }
    }
  });

  it('reports the Subscriptions rows merged away', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    expect((await askPerks()).mergedAway).toBe(ATP_EXPECTED.perks.mergedAway);
  });

  it('keeps the coupon code with its leading zeros and the address canonical', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const view = await askPerks();
    if (ATP_EXPECTED.perks.cardsPresent.includes('coupons')) {
      const coupons = readyCard(view, 'coupons');
      const codes = coupons.rows.flatMap((row) => row.cells.map(String));
      for (const code of ATP_CODES) expect(codes).toContain(code);
    }
    if (ATP_EXPECTED.perks.cardsPresent.includes('bonusCodes')) {
      const bonus = readyCard(view, 'bonusCodes');
      const cells = bonus.rows.flatMap((row) => row.cells.map(String));
      for (const address of ATP_ADDRESSES) expect(cells).toContain(address);
    }
  });
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

describe('nothing planted reaches storage or a posted view', () => {
  it('stores no email, no excluded address, no free-text canary and no unlisted-file value', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const atRest = await everythingAtRest();
    const timeline = JSON.stringify(await askTimeline());
    const perks = JSON.stringify(await askPerks());
    for (const value of [
      ...ATP_CANARY_EMAILS,
      ...ATP_NEVER_TEXT,
      ...ATP_NEVER_ADDRESSES,
      ATP_UNLISTED_HEADER,
      ATP_UNLISTED_EMAIL,
      ATP_FORUM_EMAIL,
      ATP_FORUM_ADDRESS,
    ]) {
      expect(atRest, `${value} reached storage`).not.toContain(value);
      expect(timeline, `${value} reached the timeline view`).not.toContain(value);
      expect(perks, `${value} reached the perks view`).not.toContain(value);
    }
  });

  it('keeps the allowlisted codes and addresses OUT of the timeline view', async () => {
    await ingest(buildAccountTimelinePerksExport(), 'atp.zip');

    const timeline = JSON.stringify(await askTimeline());
    for (const value of [...ATP_CODES, ...ATP_ADDRESSES]) {
      expect(timeline, `${value} in the timeline view`).not.toContain(value);
    }
  });
});

// ---------------------------------------------------------------------------
// The variant builder
// ---------------------------------------------------------------------------

describe('the variant builder', () => {
  it('leaves out the named folder: its card answers not-in-export, the others are unchanged', async () => {
    const { card: omitted, folder } = ATP_EXPECTED.perks.omittedCard;
    await ingest(buildAccountTimelinePerksVariantExport({ omitFolders: [folder] }), 'variant.zip');

    const view = await askPerks();
    expect(view.cards[CARD_KEY[omitted]].status).toBe('not-in-export');
    for (const id of ATP_EXPECTED.perks.cardsPresent.filter((c) => c !== omitted)) {
      const card = readyCard(view, id);
      expect(card.rows, `${id} displayed rows`).toHaveLength(
        ATP_EXPECTED.perks.cards[id]!.displayedRows,
      );
    }
  });

  it('drifts the Surveys headers: the card is skipped and the import still succeeds', async () => {
    if (!ATP_EXPECTED.perks.cardsPresent.includes('surveys')) return;
    await ingest(buildAccountTimelinePerksVariantExport({ driftSurveys: true }), 'drift.zip');

    const view = await askPerks();
    expect(view.cards.surveys.status).toBe('skipped');
    // The other cards read exactly as in the full archive.
    for (const id of ATP_EXPECTED.perks.cardsPresent.filter((c) => c !== 'surveys')) {
      expect(readyCard(view, id).rows).toHaveLength(ATP_EXPECTED.perks.cards[id]!.displayedRows);
    }
  });

  it('leaves the timeline alone when only Perks folders are omitted', async () => {
    const { folder } = ATP_EXPECTED.perks.omittedCard;
    await ingest(buildAccountTimelinePerksVariantExport({ omitFolders: [folder] }), 'variant.zip');

    const view = await askTimeline();
    expect(view.entries).toHaveLength(ATP_EXPECTED.timeline.entries.length);
  });
});

// ---------------------------------------------------------------------------
// The large builder
// ---------------------------------------------------------------------------

describe('the large builder', () => {
  it('holds one account, more than 500 timeline entries and more than 500 coupon rows', async () => {
    const count = ATP_EXPECTED.large.count;
    await ingest(buildLargeAccountTimelineExport(count), 'large.zip');

    const timeline = await askTimeline();
    expect(timeline.entries).toHaveLength(ATP_EXPECTED.large.timelineEntries);
    expect(ATP_EXPECTED.large.timelineEntries).toBeGreaterThan(500);
    expect(
      timeline.entries.every((entry) => entry.accounts.every((r) => r === ATP_LARGE_ROOT)),
    ).toBe(true);

    const perks = await askPerks();
    expect(readyCard(perks, 'coupons').rows).toHaveLength(ATP_EXPECTED.large.couponRows);
    expect(ATP_EXPECTED.large.couponRows).toBeGreaterThan(500);
  });

  it('orders the services newest first', async () => {
    await ingest(buildLargeAccountTimelineExport(ATP_EXPECTED.large.count), 'large.zip');

    const timeline = await askTimeline();
    const dates = timeline.entries.map((entry) => entry.date ?? '');
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });
});
