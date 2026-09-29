import type { CategoryEntry, ClassifyResult } from './types/worker-messages.ts';

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
 * The four supported dashboard sections, in D-02 order.
 *
 * The order is declared HERE, explicitly, and not derived from `SUPPORTED`
 * in `worker/categories.ts` — that array is `Activity_history`,
 * `Player_statistics`, `User_Info`, `Payment_history`, which is a different
 * order (and exists for the worker, not for the page). The same trap waits
 * for anyone tempted to reuse `SAMPLE_BADGE_ORDER` from the fixtures.
 */
export const SECTIONS = [
  { id: 'activity-history', folder: 'Activity_history' },
  { id: 'player-statistics', folder: 'Player_statistics' },
  { id: 'payment-history', folder: 'Payment_history' },
  { id: 'user-info', folder: 'User_Info' },
] as const;

/** Anchor id of one of the four supported sections. */
export type SectionId = (typeof SECTIONS)[number]['id'];

/**
 * Anchor id of the "Not yet supported" block. It shares the section shell
 * and the nav with the four above, so it is modelled as a fifth id rather
 * than as a special case (D-22).
 */
export const NOT_YET_SUPPORTED_ID = 'not-yet-supported';

/** Any anchor id the sticky nav can link to. */
export type NavId = SectionId | typeof NOT_YET_SUPPORTED_ID;

/**
 * The nav's link order: the four sections in D-02 order, then the
 * unsupported block. Fixed, and independent of the order the worker's
 * `ClassifyResult` happens to list its categories in (D-02).
 */
export const NAV_ORDER = [
  'activity-history',
  'player-statistics',
  'payment-history',
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
 */
export const BUILT_DASHBOARDS: ReadonlySet<SectionId> = new Set();

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
 * renders through the same D-07 section shell as the four sections. A block
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
 * The five nav links, in `NAV_ORDER`, each with its muted state and the
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
