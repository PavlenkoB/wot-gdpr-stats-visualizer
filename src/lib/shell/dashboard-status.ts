import type { CategoryEntry, ClassifyResult } from '../core/types/worker-messages.ts';

// =============================================================================
// The one place section, block and nav state are derived (D-08)
//
// =============================================================================
//
// The nav, the section cards and the "Not yet supported" block all describe
// the same export. D-08 makes them read this module rather than each growing
// its own `{#if}`, because a nav link and its card disagreeing is exactly the
// bug a user reads as "the app is lying to me".
//
// Two consequences worth stating, because both are load-bearing:
//
//   1. **No DOM, no copy strings, no reactivity.** Every export here is a
//      plain function over data the worker already computed, so the whole
//      module is testable under Node with no jsdom — the repo's Vitest setup
//      has no DOM environment, by design. That is why this logic lives here
//      and not inside a Svelte component.
//
//   2. **Folder names are untrusted zip-entry strings.** An attacker crafts
//      the archive. This module compares them case-insensitively and returns
//      them, but never interprets them: no HTML, no template, no eval. The
//      rendering layer interpolates them as text.
//
// The distinction that must never blur (DATA-04): a folder that is ABSENT
// from the export and a folder that is PRESENT BUT EMPTY are different
// facts, get different statuses, and get different wording (D-10).

/**
 * The six supported dashboard sections, in D-02 order.
 *
 * The order is declared HERE, explicitly, and not derived from `SUPPORTED`
 * in `worker/categories.ts` — that array is `Activity_history`,
 * `Player_statistics`, `User_Info`, `Payment_history`, `Financial_data`,
 * `Device_info`, which is a different order (and exists for the worker, not
 * for the page).
 * The same trap waits for anyone tempted to reuse `SAMPLE_BADGE_ORDER` from
 * the fixtures.
 */
export const SECTIONS = [
  { id: 'activity-history', folder: 'Activity_history' },
  { id: 'player-statistics', folder: 'Player_statistics' },
  // Third since Phase 5 D-01: Financial_data joins the page as a section of
  // its own rather than sharing Payment_history's card. Both folders hold
  // money data, but they are different files with different headers, and one
  // section summing two folders would make a card's counts untraceable back
  // to a file the user can find in the zip they unzipped.
  { id: 'financial-data', folder: 'Financial_data' },
  { id: 'payment-history', folder: 'Payment_history' },
  // Fifth since quick task 261012-bog: Device_info is a supported category with
  // a read-only pane of its own (three per-source tables). It sits after
  // Payment_history and before User_Info, so the account row stays the last of
  // the data rows.
  { id: 'device-info', folder: 'Device_info' },
  { id: 'user-info', folder: 'User_Info' },
] as const;

/** Anchor id of one of the six supported sections. */
export type SectionId = (typeof SECTIONS)[number]['id'];

/**
 * Anchor id of the "Not yet supported" block. It shares the section shell
 * and the nav with the six above, so it is modelled as a seventh id rather
 * than as a special case (D-22).
 */
export const NOT_YET_SUPPORTED_ID = 'not-yet-supported';

/** Any anchor id the sticky nav can link to. */
export type NavId = SectionId | typeof NOT_YET_SUPPORTED_ID;

/**
 * The nav's link order: the six sections in D-02 order, then the
 * unsupported block. Fixed, and independent of the order the worker's
 * `ClassifyResult` happens to list its categories in (D-02).
 */
export const NAV_ORDER = [
  'activity-history',
  'player-statistics',
  'financial-data',
  'payment-history',
  'device-info',
  'user-info',
  NOT_YET_SUPPORTED_ID,
] as const satisfies readonly NavId[];

/**
 * What a section (or the unsupported block) shows.
 *
 *   not-loaded — no export loaded at all; the skeleton state
 *   no-export  — supported category, but not in THIS export
 *   empty      — in the export, but it yielded zero parsed rows
 *   pending    — has rows; its dashboard is not built yet (D-09)
 *   ready      — has rows; its dashboard exists (Phases 4-6)
 */
export type SectionStatus = 'not-loaded' | 'no-export' | 'empty' | 'pending' | 'ready';

/**
 * Section ids whose dashboard has shipped. Phases 4, 5 and 6 add their id
 * here when their dashboard lands; until then every populated section is
 * `pending` and shows the "Dashboard coming in a later update" note.
 *
 * A parameter rather than a hard-coded check, so a phase can pass its own
 * set and so a test can exercise `ready` without shipping a dashboard.
 *
 * Five ids, and each was added by the plan that gave its section a body rather
 * than by the plan that gave the section its card:
 *
 *   `activity-history` — Phase 4, plan 04-02, which shipped the playtime
 *     block's states and its tile.
 *   `player-statistics` — Phase 5, plan 05-12, which flipped the card to
 *     `ready` in the same commit that mounted the Vehicle statistics block.
 *   `financial-data`   — Phase 5, plan 05-10, which flipped the card to
 *     `ready` in the same commit that mounted the Premium block.
 *   `payment-history`  — Phase 5, plan 05-15, which flipped the card to
 *     `ready` in the same commit that mounted the Real-money spend block.
 *   `device-info`      — quick task 261012-bog, which added the section, flipped
 *     it to `ready` and mounted the Device info pane in the same commit.
 *
 * The flip and the body land together on purpose, in every Phase 5 case: a
 * `ready` section with no body is a card that promises a dashboard and shows an
 * empty one, and a body with no flip is a dashboard no card will ever render.
 *
 * `user-info` is the one id that stays `pending` forever, which is why its card
 * promises no dashboard at all (`SECTION_NOTE_USER_INFO`) rather than the
 * "coming in a later update" note the other `pending` states use. The
 * `SECTION_NOTE_PENDING` loop in `tests/e2e/shell/dashboard.spec.ts` is therefore
 * empty, and that is the shape the phase ends in — not a gap in it.
 */
export const BUILT_DASHBOARDS: ReadonlySet<SectionId> = new Set<SectionId>([
  'activity-history',
  'player-statistics',
  'financial-data',
  'payment-history',
  'device-info',
]);

/** Import diagnostics for one section, summed across every matching entry. */
export interface SectionCounts {
  fileCount: number;
  rowCount: number;
  skippedRowCount: number;
}

/** Every supported entry whose name is `folder`, ignoring case. */
function entriesFor(folder: string, result: ClassifyResult): CategoryEntry[] {
  const target = folder.toLowerCase();
  return result.categories.filter(
    (entry) => entry.status === 'supported' && entry.name.toLowerCase() === target,
  );
}

/**
 * Summed import counts for a section, or `null` when the section is not in
 * the export at all.
 *
 * `null` is the answer for "absent" and is deliberately distinct from a
 * zero count, which is the answer for "present but nothing parsed" (DATA-04).
 * `analyzeExport` only creates an entry for a folder it actually saw, so
 * absence is the absence of an entry, not a `fileCount: 0` entry.
 *
 * Matching is case-insensitive and SUMMED: `classifyFolder` accepts any
 * casing, so an export can legitimately hold both `User_Info` and
 * `user_info`. Two entries, one section, one total.
 *
 * `rowCount` and `skippedRowCount` are absent on a pre-parse result and are
 * read as 0, which is also what makes "every row was skipped" (0 rows, 3
 * skipped) readable as `empty` without losing the diagnostic.
 */
export function sectionCounts(folder: string, result: ClassifyResult | null): SectionCounts | null {
  if (result === null) return null;
  const entries = entriesFor(folder, result);
  if (entries.length === 0) return null;
  return entries.reduce<SectionCounts>(
    (total, entry) => ({
      fileCount: total.fileCount + entry.fileCount,
      rowCount: total.rowCount + (entry.rowCount ?? 0),
      skippedRowCount: total.skippedRowCount + (entry.skippedRowCount ?? 0),
    }),
    { fileCount: 0, rowCount: 0, skippedRowCount: 0 },
  );
}

/**
 * The status of one section, given the last known result.
 *
 * `result` is the last known `ClassifyResult` or `null` for "nothing
 * loaded" — note that it stays non-null through a replace, an import error
 * and a duplicate drop, because the dashboard is driven by the last known
 * result rather than by the transient state name (D-27).
 *
 * The ladder is the DATA-04 contract: absent is `no-export`, present with
 * nothing parsed is `empty`, and the two never collapse into each other.
 */
export function sectionStatus(
  id: SectionId,
  result: ClassifyResult | null,
  built: ReadonlySet<SectionId> = BUILT_DASHBOARDS,
): SectionStatus {
  if (result === null) return 'not-loaded';
  const section = SECTIONS.find((candidate) => candidate.id === id);
  /* c8 ignore next 3 -- unreachable: `id` is typed to a value in SECTIONS */
  if (section === undefined) return 'not-loaded';
  const counts = sectionCounts(section.folder, result);
  if (counts === null) return 'no-export';
  if (counts.rowCount === 0) return 'empty';
  return built.has(id) ? 'ready' : 'pending';
}

/**
 * Every non-supported category, in the order the worker gave them
 * (known-deferred, then unknown, name ascending within a group).
 *
 * The returned array is a new one; the entries are the worker's own objects.
 *
 * There is deliberately no per-tier field on anything this returns: D-22
 * renders known-deferred and unknown identically, and a list that still
 * carried `status` is a list one careless `{#if}` later will style.
 */
export function unsupportedEntries(result: ClassifyResult | null): CategoryEntry[] {
  if (result === null) return [];
  return result.categories.filter((entry) => entry.status !== 'supported');
}

/** What the "Not yet supported" block is showing. */
export type UnsupportedBlockStatus = 'not-loaded' | 'none' | 'has-items';

export function unsupportedBlockStatus(result: ClassifyResult | null): UnsupportedBlockStatus {
  if (result === null) return 'not-loaded';
  return unsupportedEntries(result).length === 0 ? 'none' : 'has-items';
}

/**
 * The block's status in the shared `SectionStatus` vocabulary, so the block
 * renders through the same D-07 section shell as the five sections. A block
 * with nothing to list is `empty` (with its own status text), and a block
 * with banners is `ready` — its content is the banner list.
 */
export function unsupportedSectionStatus(result: ClassifyResult | null): SectionStatus {
  const block = unsupportedBlockStatus(result);
  if (block === 'not-loaded') return 'not-loaded';
  return block === 'none' ? 'empty' : 'ready';
}

/**
 * Why a nav link is muted. Each value maps to a visually-hidden suffix that
 * puts the reason in the link's accessible name as visible text (D-03) —
 * there is no `aria-label`, which would override the text the user sees.
 */
export type NavMutedReason = 'no-export' | 'empty' | 'not-loaded' | 'none';

/** One nav link's state, in the fixed `NAV_ORDER`. */
export interface NavEntry {
  id: NavId;
  /** Muted links are weight 400 in a lighter tint; unmuted links are 600. */
  muted: boolean;
  /** The suffix reason, or `null` when the link is not muted. */
  reason: NavMutedReason | null;
}

/** Section statuses that make a nav link muted — the other two are not. */
function mutedReasonFor(status: SectionStatus): NavMutedReason | null {
  if (status === 'no-export' || status === 'empty' || status === 'not-loaded') return status;
  return null;
}

/**
 * The seven nav links, in `NAV_ORDER`, each with its muted state and the
 * reason behind it.
 *
 * Derived by calling `sectionStatus` and `unsupportedBlockStatus` — the same
 * two functions the cards read. There is no second derivation to drift (D-08).
 */
export function navEntries(result: ClassifyResult | null): NavEntry[] {
  return NAV_ORDER.map((id) => {
    if (id === NOT_YET_SUPPORTED_ID) {
      const block = unsupportedBlockStatus(result);
      const reason: NavMutedReason | null = block === 'has-items' ? null : block;
      return { id, muted: reason !== null, reason };
    }
    const reason = mutedReasonFor(sectionStatus(id, result));
    return { id, muted: reason !== null, reason };
  });
}
