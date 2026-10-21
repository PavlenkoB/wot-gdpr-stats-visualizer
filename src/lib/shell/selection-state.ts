import type { ClassifyResult } from '../core/types/worker-messages.ts';
// A RUNTIME import, and a safe one: `new-data-shared.ts` has no imports at all
// (that is what lets the worker and the page agree on the pane ids), so reading
// the tuple here cannot create a cycle. Re-exporting it rather than repeating
// the literals is what stops the shell and the worker from disagreeing about
// which panes exist (11-05).
import {
  NEW_DATA_PANE_IDS,
  type NewDataPaneFacts,
  type NewDataPaneId,
} from '../features/new-data/new-data-shared.ts';
import {
  SECTIONS,
  navEntries,
  sectionCounts,
  unsupportedEntries,
  type NavId,
  type NavMutedReason,
} from './dashboard-status.ts';
import {
  ACCOUNT_ROW_MULTI_SUMMARY,
  ACCOUNT_ROW_SUMMARY,
  OVERVIEW_ROW_SUMMARY,
  PANE_TITLES,
  ROW_HEADLINE_NONE,
  UNKNOWN_VALUE,
  UNSUPPORTED_NONE_DETECTED,
  formatAccountCount,
  formatFolderCount,
  formatHeatRowSummary,
  formatPerksRowSummary,
  formatTimelineRowSummary,
  formatRowCount,
  formatRowSummary,
  formatSectionStatus,
  formatWowsStorageRowSummary,
  type GreyedSectionStatus,
} from '../ui-copy.ts';
import { accountCountOf, hasMultipleRoots } from './identity-model.ts';

// =============================================================================
// The pane model of the master-detail shell (Phase 8, plan 08-01)
//
// =============================================================================
//
// The list pane, the Overview grid and the detail pane all describe the same
// export. This module is the ONE place that turns a `ClassifyResult` into the
// rows the list shows — the nine always-present ones plus the three optional
// new-game panes of 11-05 and 12-02 — so a list row, an Overview card and a
// detail pane cannot disagree (the Phase 3 D-08 rule, carried forward).
//
// Three consequences worth stating, because all three are load-bearing:
//
//   1. **Pure.** No DOM, no runes, no side effects, no network, no storage. Every
//      export is a plain function over data the worker already computed, so the
//      module is testable under Node with no jsdom, and a `$derived` can call it
//      freely. Nothing here writes state.
//
//   2. **No second status derivation.** Row availability comes from
//      `navEntries`, counts from `sectionCounts`, the footer row from
//      `unsupportedEntries`. This file only adds the pane vocabulary and the
//      headline/summary strings on top.
//
//   3. **No worker query.** Headlines and summaries are derived from the
//      ClassifyResult alone. The list is always mounted, and a query issued from
//      it would compete with the open section's query, because supersede is per
//      channel.
//
// ## Phase 9: what the Account row may read (D-13)
//
// The Account row is the one row whose source changes with the archive's
// FOLDER count, and the rule is a restriction rather than an addition: with two
// or more folders it reads NEITHER `result.identity.region` NOR any single
// account's fields. The legacy `identity` block is the FIRST folder's, so
// reading it here would present one account's region as the export's — exactly
// what T-09-20 exists to prevent, and whether or not the other folders stored
// data (09-11). The multi row therefore reads the account COUNT (the accounts
// that hold data) and nothing else, and the nickname is never read here at all
// (it belongs to its own row in the header, v1.0 D-21).

/**
 * The nine panes, in the fixed order the list shows them. The ids are the
 * vocabulary of every `list-row-*`, `data-pane` and `openSection` test hook
 * downstream, so renaming one is a change to about twenty-five spec files.
 */
export const PANE_IDS = [
  'overview',
  'playtime',
  'login-history',
  'vehicles',
  'finance',
  'payments',
  // Quick 261012-bog: the Device info pane, after Payments and before Account.
  'device-info',
  'account',
  'not-yet-supported',
] as const;

/** One of the pane ids: the nine always-present ones and the optional ones. */
export type PaneId = (typeof PANE_IDS)[number] | NewDataPaneId;

/**
 * The panes an export may or may not hold (11-05, D-01/D-03; 12-02 for Perks).
 *
 * THE SHARED CONSTANT, not a copy of it: `NEW_DATA_PANE_IDS` is the one
 * vocabulary the ingest worker and this shell both read, so a pane cannot be
 * spelled one way in the worker and another here. `new-data-shared.ts` has no
 * imports at all, which is exactly what makes that import legal.
 *
 * The ORDER of this tuple is the order the panes were added, NOT the order the
 * list shows them: the two game-data panes sit after Vehicles and the Perks
 * pane sits with the money rows, so `PANE_ORDER` names the positions.
 */
export const OPTIONAL_PANE_IDS = NEW_DATA_PANE_IDS;

/**
 * The thirteen panes in the order the list shows them (UI-SPEC Surface 2).
 *
 * EXPLICIT, and no longer a spread of `OPTIONAL_PANE_IDS` (12-02, 12-RESEARCH
 * Pitfall 6). A spread cannot say where an optional pane belongs: the two
 * game-data panes sit directly after `vehicles`, the Perks pane sits with the
 * money rows, and the Account timeline pane (plan 12-11) sits directly above
 * `account`. A spread puts every optional pane in one place, so the order had
 * to become a list a reader can read.
 *
 * `paneEntries` walks THIS, not `PANE_IDS`, and drops an optional pane the
 * result does not carry.
 */
export const PANE_ORDER = [
  'overview',
  'playtime',
  'login-history',
  'vehicles',
  'heat',
  'warships-storage',
  'finance',
  'payments',
  'perks',
  'device-info',
  'account-timeline',
  'account',
  'not-yet-supported',
] as const satisfies readonly PaneId[];

/** The pane shown when nothing else has been chosen (D-03). */
export const DEFAULT_PANE: PaneId = 'overview';

/**
 * The dashboard-status `NavId` each pane reads its availability from, or `null`
 * for Overview, which reads no single folder.
 *
 * `playtime` and `login-history` BOTH map to `activity-history`: they are two
 * views of one folder, so they are muted or available together. A folder with
 * zero rows mutes both, and a missing folder mutes both, with the same reason.
 *
 * The optional panes are `null` (11-05): none of them reads ONE folder — a
 * HEAT or a Warships crews pane is built from files the export may place
 * anywhere — so there is no `NavId` whose availability could stand for the
 * pane's. Their availability comes from `result.newDataPanes` instead, and
 * `paneEntries` never routes them through `navEntries`.
 *
 * The Perks pane (12-02) is `null` for the same reason: its four cards live in
 * four different folders, and one folder's status could not stand for the
 * pane's. So is the Account timeline (12-11): its five files live in three
 * folders (User_Info, Bans and Authorized_Third_Parties).
 */
export const PANE_SECTION: Record<PaneId, NavId | null> = {
  overview: null,
  playtime: 'activity-history',
  'login-history': 'activity-history',
  vehicles: 'player-statistics',
  finance: 'financial-data',
  payments: 'payment-history',
  'device-info': 'device-info',
  account: 'user-info',
  'not-yet-supported': 'not-yet-supported',
  heat: null,
  'warships-storage': null,
  perks: null,
  'account-timeline': null,
};

/** One row of the list pane. */
export interface PaneEntry {
  id: PaneId;
  /** Muted rows are still selectable: their detail is the "Not in this export" panel. */
  muted: boolean;
  /** Why the row is muted, or `null` when it is available. */
  reason: NavMutedReason | null;
  /** The right-hand figure: a row count, the account's location code, a folder count or an em dash. */
  headline: string;
  /** The line under the title. */
  summary: string;
}

/** The statuses `formatSectionStatus` can word; `none` is the footer row's own. */
function greyedStatus(reason: NavMutedReason | null): GreyedSectionStatus {
  return reason === 'no-export' || reason === 'empty' ? reason : 'not-loaded';
}

/** The canonical `SECTIONS` folder constant for a pane's section, never a zip-entry name. */
function folderOf(section: NavId | null): string {
  return SECTIONS.find((candidate) => candidate.id === section)?.folder ?? '';
}

/** Is this pane one of the optional new-game panes? */
function isOptionalPane(id: PaneId): id is NewDataPaneId {
  return (OPTIONAL_PANE_IDS as readonly PaneId[]).includes(id);
}

/**
 * One optional pane's row, from the facts the worker published for it
 * (11-05, UI-SPEC Surface 2).
 *
 * The two states D-09 exists to tell apart are both here and they read
 * differently: a pane whose files are IN the export but stored nothing is
 * MUTED with reason `empty` and the existing no-rows sentence, and it stays
 * selectable, because its detail explains which of its files was header-only
 * or skipped. An ABSENT pane produces no row at all — that is decided by
 * {@link paneEntries}, and it is what keeps an absent pane out of the
 * Overview's "not in this export" count.
 *
 * Headline and summary come from constants and the pane's two integers; no
 * file name and no cell can reach either (T-11-16).
 *
 * ## Why the summary is a `switch` and not a ternary
 *
 * A two-way ternary over the pane id reads well with two panes and silently
 * mislabels every pane after the second: a third optional pane would inherit
 * the Warships summary without a word of complaint (12-RESEARCH Pitfall 5). A
 * `switch` with a `never`-typed default turns that silence into a TYPE ERROR
 * — the fifth optional pane cannot be added without saying what its row says.
 */
function optionalPaneEntry(id: NewDataPaneId, facts: NewDataPaneFacts): PaneEntry {
  if (facts.rowCount === 0) {
    return {
      id,
      muted: true,
      reason: 'empty',
      headline: ROW_HEADLINE_NONE,
      summary: formatSectionStatus('empty', PANE_TITLES[id]),
    };
  }
  let summary: string;
  switch (id) {
    case 'heat':
      summary = formatHeatRowSummary(facts.fileCount);
      break;
    case 'warships-storage':
      summary = formatWowsStorageRowSummary(facts.fileCount);
      break;
    case 'perks':
      summary = formatPerksRowSummary(facts.fileCount);
      break;
    case 'account-timeline':
      summary = formatTimelineRowSummary(facts.fileCount);
      break;
    default: {
      // The exhaustiveness check: an optional pane this switch does not name
      // has no row of its own, and a pane with no row of its own must not
      // borrow another pane's words.
      const unhandled: never = id;
      throw new Error(`optional pane without a row summary: ${String(unhandled)}`);
    }
  }
  return { id, muted: false, reason: null, headline: formatRowCount(facts.rowCount), summary };
}

/**
 * The list rows, in `PANE_ORDER`, for the last known result (`null` for
 * "nothing loaded").
 *
 * The nine always-present panes are derived exactly as they were in v1.0, in
 * the same order, so every existing spec and fixture sees identical output.
 * The three optional ones are ADDED: a row exists only when
 * `result.newDataPanes` names that pane, which is why an export with no HEAT
 * data has no HEAT row, no muted placeholder and no "not in this export"
 * sentence (D-01: shown only when the export holds HEAT data).
 *
 * Every folder name that reaches a summary is the canonical constant from
 * `SECTIONS`. The only untrusted string read is the identity region, returned
 * as a plain string for the renderer's text interpolation to escape (T-08-01).
 */
export function paneEntries(result: ClassifyResult | null): PaneEntry[] {
  const nav = navEntries(result);
  const unsupportedCount = unsupportedEntries(result).length;

  /**
   * One always-present pane's row — the v1.0 derivation, byte for byte.
   *
   * A local closure rather than a module function so `result` stays in scope
   * and so the optional panes can be interleaved by `PANE_ORDER` without this
   * body having to know they exist.
   */
  const entryOf = (id: Exclude<PaneId, NewDataPaneId>): PaneEntry => {
    if (id === 'overview') {
      const muted = result === null;
      return {
        id,
        muted,
        reason: muted ? 'not-loaded' : null,
        headline: '',
        summary: muted ? formatSectionStatus('not-loaded', PANE_TITLES[id]) : OVERVIEW_ROW_SUMMARY,
      };
    }

    const section = PANE_SECTION[id];
    const state = nav.find((entry) => entry.id === section);
    const reason = state?.reason ?? 'not-loaded';
    const muted = state?.muted ?? true;

    if (id === 'not-yet-supported') {
      if (!muted) {
        return {
          id,
          muted,
          reason: null,
          headline: formatFolderCount(unsupportedCount),
          summary: '',
        };
      }
      return {
        id,
        muted,
        reason,
        headline: ROW_HEADLINE_NONE,
        summary:
          reason === 'none'
            ? UNSUPPORTED_NONE_DETECTED
            : formatSectionStatus('not-loaded', PANE_TITLES[id]),
      };
    }

    const folder = folderOf(section);
    if (muted) {
      return {
        id,
        muted,
        reason,
        headline: ROW_HEADLINE_NONE,
        summary: formatSectionStatus(greyedStatus(reason), folder),
      };
    }

    const counts = sectionCounts(folder, result);
    if (id === 'account') {
      // Phase 9, D-13. An archive of two or more FOLDERS is a DIFFERENT row, not
      // a decorated one: "30 / Location code and creation date" would be false,
      // because no single account's region or creation date stands for the
      // export. What the pane actually shows is the header's account list, so the
      // row says that. The decision is the folder count (09-11): the legacy
      // `identity` is the first folder's, so the row never reads its region once
      // the archive held several, even if only one of them stores data. The
      // headline is still the accounts that hold data, `accountCountOf`.
      //
      // The one-folder path below is byte-identical to v1.0 — same region
      // read, same `Unknown` fallback, same summary.
      if (hasMultipleRoots(result)) {
        return {
          id,
          muted,
          reason: null,
          headline: formatAccountCount(accountCountOf(result)),
          summary: ACCOUNT_ROW_MULTI_SUMMARY,
        };
      }
      const region = result?.identity?.region?.trim() ?? '';
      return {
        id,
        muted,
        reason: null,
        headline: region === '' ? UNKNOWN_VALUE : region,
        summary: ACCOUNT_ROW_SUMMARY,
      };
    }
    return {
      id,
      muted,
      reason: null,
      headline: formatRowCount(counts?.rowCount ?? 0),
      summary: formatRowSummary(folder, counts?.fileCount ?? 0),
    };
  };

  return PANE_ORDER.flatMap((id): PaneEntry[] => {
    if (isOptionalPane(id)) {
      const facts = result?.newDataPanes?.[id];
      return facts === undefined ? [] : [optionalPaneEntry(id, facts)];
    }
    return [entryOf(id)];
  });
}

/** The user's pane choice, stamped with the dataset it was made under. */
export interface SelectionChoice {
  pane: PaneId;
  stamp: string | null;
}

/**
 * The identity of the dataset on screen: its import timestamp, or `null` when
 * nothing is loaded (or the result is pre-parse and carries none).
 */
export function datasetStamp(result: ClassifyResult | null): string | null {
  return result?.importedAt ?? null;
}

/**
 * The pane to show, given the user's last choice and the current result.
 *
 * This reconciles D-03 (a first import, a replace and a clear all land on
 * Overview) with D-04 (a selected pane that is absent from the new dataset falls
 * back to Overview): a dataset change of any kind changes the stamp, a changed
 * stamp discards the choice, and that single rule covers both. A duplicate drop
 * or a failed replace leaves the stamp alone, so the selection survives it.
 *
 * It deliberately does NOT veto a muted pane. A user's own click on a muted row
 * is allowed and shows the dashed "Not in this export" panel; only a dataset
 * change resets the choice.
 *
 * Pure, and writes nothing: a `$derived` calls this, so it must not set state.
 */
export function resolveSelection(choice: SelectionChoice, result: ClassifyResult | null): PaneId {
  if (result === null) return DEFAULT_PANE;
  if (choice.stamp !== datasetStamp(result)) return DEFAULT_PANE;
  return choice.pane;
}

/**
 * The pane one step up or down the list, for the keyboard (`j`/`k`, arrows).
 *
 * Clamped, not wrapped: a held key must not loop from the footer back to
 * Overview. Every row of the given order is reachable, muted ones included,
 * because a muted row's detail is the "Not in this export" panel and a keyboard
 * user is entitled to read it.
 *
 * `order` is what is RENDERED, and the caller passes the ids of the rows it is
 * showing (11-05): a keyboard step must skip an optional pane a dataset does not
 * hold, because a step that selected an unrendered row would move the selection
 * somewhere the reader cannot see. The default is `PANE_IDS`, so the two-argument
 * call and every existing caller keep their v1.0 meaning.
 *
 * A `current` that is not in `order` is returned unchanged: the selection can
 * name a pane a NEW dataset no longer carries until the stamp rule falls back to
 * Overview (D-04), and stepping must not guess a neighbour for it.
 */
export function stepSelection(
  current: PaneId,
  direction: 1 | -1,
  order: readonly PaneId[] = PANE_IDS,
): PaneId {
  const from = order.indexOf(current);
  // `indexOf` answers -1 for a pane this order does not render. Stepping from
  // "nowhere" would silently land on row 0 (Overview) or on the last row, so the
  // unknown case returns `current` unchanged and the key does nothing.
  if (from === -1) return current;
  const index = from + direction;
  if (index < 0 || index >= order.length) return current;
  return order[index] ?? current;
}

/** Which of the two phone screens is showing. */
export type PhoneView = 'list' | 'detail';

/** The phone screen the user chose, stamped with the dataset it was chosen under. */
export interface PhoneViewChoice {
  view: PhoneView;
  stamp: string | null;
}

/**
 * The phone screen to show.
 *
 * With nothing loaded the answer is `detail`: the drop target lives in the
 * detail screen, and an empty list of muted rows is not somewhere to land. A
 * dataset change (stale stamp) returns to the list, the same rule that sends the
 * selection back to Overview. Otherwise the stored choice stands.
 */
export function resolvePhoneView(
  choice: PhoneViewChoice,
  result: ClassifyResult | null,
): PhoneView {
  if (result === null) return 'detail';
  return choice.stamp === datasetStamp(result) ? choice.view : 'list';
}

/**
 * The phone width in CSS pixels. This must match the one `max-width` block in
 * `src/app.css` (a guard test arrives in plan 08-07). It is the SAME width, not
 * a second breakpoint: the matchMedia query and the stylesheet are two readers
 * of one number.
 */
export const PHONE_MAX_WIDTH_PX = 480;

/** The media query matching the phone layout, built from {@link PHONE_MAX_WIDTH_PX}. */
export const PHONE_MEDIA_QUERY = `(max-width: ${PHONE_MAX_WIDTH_PX}px)`;

/**
 * The width from which the list pane is a sticky column beside the detail pane,
 * in CSS pixels. This must match the `min-width` of the sticky-list block in
 * `src/app.css`; below it the panes stack and a pointer selection moves focus to
 * the detail pane so the browser scrolls it into view.
 */
export const SIDE_BY_SIDE_MIN_WIDTH_PX = 900;

/** The media query matching the side-by-side layout, built from {@link SIDE_BY_SIDE_MIN_WIDTH_PX}. */
export const SIDE_BY_SIDE_MEDIA_QUERY = `(min-width: ${SIDE_BY_SIDE_MIN_WIDTH_PX}px)`;
