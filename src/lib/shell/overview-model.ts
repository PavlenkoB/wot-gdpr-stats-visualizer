import type { ClassifyResult } from '../core/types/worker-messages.ts';
import { unsupportedEntries } from './dashboard-status.ts';
import { accountCountOf, earliestCreated, hasMultipleRoots } from './identity-model.ts';
import { OPTIONAL_PANE_IDS, paneEntries, type PaneEntry, type PaneId } from './selection-state.ts';
import {
  IDENTITY_CREATED_LABEL,
  PANE_TITLES,
  formatAccountCount,
  formatCreatedDate,
  formatEarliestCreated,
} from '../ui-copy.ts';

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

/**
 * The ids that get a card when the pane exists: the seven above plus the two
 * optional new-game panes (HEAT, Warships crews and storage). An absent optional
 * pane has no `paneEntries` row, so it has no card and is in no chip count
 * (UI-SPEC assumption A2); a present-but-empty one carries reason `empty`.
 */
const CARD_PANE_IDS: ReadonlySet<PaneId> = new Set<PaneId>([
  ...OVERVIEW_CARD_IDS,
  ...OPTIONAL_PANE_IDS,
]);

/** One of the pane ids that can have a card. */
export type OverviewCardId =
  (typeof OVERVIEW_CARD_IDS)[number] | (typeof OPTIONAL_PANE_IDS)[number];

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

/** The `paneEntries` rows that have a card, in list (`PANE_ORDER`) order. */
function cardEntries(result: ClassifyResult | null): PaneEntry[] {
  return paneEntries(result).filter((entry) => CARD_PANE_IDS.has(entry.id));
}

/**
 * The three chips.
 *
 * `withData` counts the card panes that are not muted. `absent` counts only the
 * panes whose reason is `no-export`. An optional pane the export lacks has no
 * entry at all, so it is counted in neither. A pane that is PRESENT but has zero rows
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
 * The cards, in list order: the seven always-present ones, plus the optional
 * new-game panes when the export holds them.
 *
 * The headline and summary are the list row's own, so the two surfaces word the
 * same fact the same way. The one addition is the Account card's summary, which
 * names the creation date (the row's summary is a static description); the
 * nickname is never read here, because it appears exactly once in the document,
 * in the list pane's identity header (D-21).
 *
 * ## Phase 9, D-13: the Account card for two or more account folders
 *
 * "Account" / "Account created {date}" describes ONE account, so on an archive
 * that held several folders (09-11: the folder count, not the published list,
 * decides, even when only one folder stores data) the card's TITLE becomes the account count and its summary
 * becomes `formatEarliestCreated(earliestCreated(...))` — the MINIMUM across
 * accounts, and the unknown-date sentence when no account's `createdAt` parses.
 *
 * The single-account path is untouched and reads the legacy `identity` exactly
 * as before. That is deliberate: `earliestCreated` over a one-account list would
 * answer the same day in the same spelling, but keeping the branch makes "one
 * account renders v1.0" a structural fact rather than a coincidence.
 */
export function overviewCards(result: ClassifyResult | null): OverviewCard[] {
  const createdAt = result?.identity?.createdAt ?? null;
  const multiRoot = hasMultipleRoots(result);
  return cardEntries(result).map((entry): OverviewCard => {
    const id = entry.id as OverviewCardId;
    const available = !entry.muted;
    const multi = id === 'account' && available && multiRoot;
    const summary = multi
      ? formatEarliestCreated(earliestCreated(result?.accounts ?? []))
      : id === 'account' && available
        ? `${IDENTITY_CREATED_LABEL} ${formatCreatedDate(createdAt)}`
        : entry.summary;
    return {
      id,
      title: multi ? formatAccountCount(accountCountOf(result)) : PANE_TITLES[id],
      available,
      headline: entry.headline,
      summary,
      reason: entry.reason,
    };
  });
}
