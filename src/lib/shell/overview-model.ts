import type { ClassifyResult } from '../core/types/worker-messages.ts';
import { unsupportedEntries } from './dashboard-status.ts';
import { paneEntries, type PaneEntry, type PaneId } from './selection-state.ts';
import { IDENTITY_CREATED_LABEL, PANE_TITLES, formatCreatedDate } from '../ui-copy.ts';

// =============================================================================
// The Overview model (Phase 8, plan 08-05)
// =============================================================================
//
// The Overview shows three status chips and one summary card per data section.
// Both are FILTERS over `paneEntries(result)`, the same derivation the list rows
// read, so a chip, a card and a row cannot disagree (the Phase 3 D-08 rule).
//
// Pure: no DOM, no runes, no copy literals of its own, no worker client. The
// Overview issues no worker query at all, because supersede is per channel and a
// query from a surface that is mounted beside no other section could only
// compete with the open section's own. Every number here comes from the
// ClassifyResult the worker already produced.

/**
 * The seven panes that get a card, in list order. A subset of `PaneId`: Overview
 * does not summarise itself, and the unsupported footer is a chip, not a card.
 */
export const OVERVIEW_CARD_IDS = [
  'playtime',
  'login-history',
  'vehicles',
  'finance',
  'payments',
  'device-info',
  'account',
] as const satisfies readonly PaneId[];

/** One of the seven card pane ids. */
export type OverviewCardId = (typeof OVERVIEW_CARD_IDS)[number];

/** The three chip counts. */
export interface OverviewChips {
  /** Card panes that are available (not muted). */
  withData: number;
  /** Card panes whose folder is not in the export. */
  absent: number;
  /** Folders the export holds that the viewer cannot show yet. */
  unsupported: number;
}

/** One summary card. */
export interface OverviewCard {
  id: OverviewCardId;
  /** The pane's visible title. */
  title: string;
  /** `false` renders the dashed "not in this export" panel with no link. */
  available: boolean;
  /** The big figure: a row count, the location code, or an em dash. */
  headline: string;
  /** The line under the figure. */
  summary: string;
  /** Why the card is unavailable, or `null` when it is available. */
  reason: PaneEntry['reason'];
}

/** The `paneEntries` rows that have a card, in `OVERVIEW_CARD_IDS` order. */
function cardEntries(result: ClassifyResult | null): PaneEntry[] {
  const entries = paneEntries(result);
  return OVERVIEW_CARD_IDS.flatMap((id) => entries.filter((entry) => entry.id === id));
}

/**
 * The three chips.
 *
 * `withData` counts the card panes that are not muted. `absent` counts only the
 * panes whose reason is `no-export`. A pane that is PRESENT but has zero rows
 * (reason `empty`) is counted in neither: absent and empty are different facts
 * (DATA-04), and the chip that says "not in this export" must not claim a
 * folder the export does hold. Its card carries the "no rows" wording instead.
 *
 * A `null` result (nothing loaded) is all zeros.
 */
export function overviewChips(result: ClassifyResult | null): OverviewChips {
  if (result === null) return { withData: 0, absent: 0, unsupported: 0 };
  const entries = cardEntries(result);
  return {
    withData: entries.filter((entry) => !entry.muted).length,
    absent: entries.filter((entry) => entry.reason === 'no-export').length,
    unsupported: unsupportedEntries(result).length,
  };
}

/**
 * The seven cards, in list order.
 *
 * The headline and summary are the list row's own, so the two surfaces word the
 * same fact the same way. The one addition is the Account card's summary, which
 * names the creation date (the row's summary is a static description); the
 * nickname is never read here, because it appears exactly once in the document,
 * in the list pane's identity header (D-21).
 */
export function overviewCards(result: ClassifyResult | null): OverviewCard[] {
  const createdAt = result?.identity?.createdAt ?? null;
  return cardEntries(result).map((entry): OverviewCard => {
    const id = entry.id as OverviewCardId;
    const available = !entry.muted;
    const summary =
      id === 'account' && available
        ? `${IDENTITY_CREATED_LABEL} ${formatCreatedDate(createdAt)}`
        : entry.summary;
    return {
      id,
      title: PANE_TITLES[id],
      available,
      headline: entry.headline,
      summary,
      reason: entry.reason,
    };
  });
}
