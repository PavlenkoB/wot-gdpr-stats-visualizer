// =============================================================================
// The shared game filter's rules (Phase 10, D-01, D-05, D-21)
// =============================================================================
//
// ## What this module is
//
// Pure functions over a token and a stamp. It has no runes, no DOM, no storage,
// no URL and no history — and that is a RULE, not an accident: the reset below
// is a pure READ (`resolveGameFilter`), because setting state from a `$derived`
// throws `state_unsafe_mutation`, which is the same reason `resolveSelection`
// in `selection-state.ts` reads rather than writes. The user's filter lives in
// ONE shell cell (`Dashboard.svelte`), stamped with the dataset it was chosen
// under, exactly like the pane choice beside it.
//
// ## Why the chip list is a fixed vocabulary
//
// A game token reaches the main thread from a FILE NAME inside an untrusted
// zip. `GAME_FILTER_TOKENS` is therefore the only source a chip label can come
// from (T-10-05): `filterChips` returns tokens from this list or it returns
// nothing, so an archive whose sessions are named `__proto__` or `<b>WOT</b>`
// can put at most an unknown-and-therefore-invisible token into the data the
// filter reads, and never into the DOM. A later phase appends tokens here and
// every chip, the panel and the empty-game copy follow without a markup change.
//
// ## Why HEAT and WOTC are tokens here (11-01, D-13)
//
// Phase 10 left them out on a correct-sounding premise that turned out to be
// false: that a chip "would claim a per-game scope the worker does not store".
// It does store one. `buildGameScopes` groups by the game token in the session
// FILE NAME, so `HEAT_Game_Sessions.csv` and `WOTC_Game_Sessions.csv` have
// always produced their own scopes; what was missing was the files themselves,
// and plan 11-01 gave them an allowlist and made them readable (D-08). The
// aggregate shape did not change, which is why `PLAYTIME_VERSION` is still 3 —
// see `tests/unit/playtime/playtime-new-games.test.ts` for the test that proved
// it rather than the comment that asserts it.
//
// A chip exists only for a token the DATA holds, plus the ACTIVE one. So a
// HEAT-only or WOTC-only export still renders no row at all: All games is that
// export's only view, and a row of one control that can only select what is
// already selected is noise, not a control. HEAT alongside WoT offers both; HEAT
// alongside WoT Console offers both of those.
//
// ## Why Warplanes is Vehicles-local
//
// The Vehicles `Game` select carries four titles; the shared filter carries the
// games that also have a Playtime scope. Warplanes is a choice about one pane's
// table rather than about the export, so `filterAfterTitleChange` returns the
// CURRENT filter unchanged for it rather than clearing it. Playtime is left
// exactly as the user left it (D-21, UI-SPEC Recorded Choice 4). For the same
// reason `filterToTitle` answers `null` for HEAT and WOTC: a chip is not a
// promise that Vehicles can be narrowed to that game, and it is not. 11-06 adds
// the other half of the answer — see the section at the foot of this file.
// =============================================================================

/**
 * The games the shared filter can narrow to, in the FIXED order they are
 * offered (D-05).
 *
 * Fixed rather than "whatever the export had" for two reasons already paid for
 * elsewhere in this codebase: a locale-aware comparison would make the chip
 * order differ between two people looking at one export, and a list assembled
 * from untrusted input is a list whose order is untrusted input's.
 *
 * A later phase APPENDS to this tuple — that is the whole extension mechanism,
 * and 11-01 is the plan that proved it by appending WOTC and HEAT.
 */
export const GAME_FILTER_TOKENS = ['WOT', 'WOTB', 'WOWS', 'WOTC', 'HEAT'] as const;

/** One of {@link GAME_FILTER_TOKENS}. */
export type GameFilterToken = (typeof GAME_FILTER_TOKENS)[number];

/**
 * The Vehicles title each filterable token means.
 *
 * A local union rather than an import from `vehicles/vehicle-shared.ts`: this
 * module is the shell's, and the shell should not reach into a feature's
 * vocabulary to learn a two-letter mapping. `VehicleTitleId` is a supertype of
 * this, so a `VehicleAsk.title` accepts what `filterToTitle` returns.
 */
export type GameFilterTitle = 'wot' | 'wotb' | 'wows';

/** The user's filter choice, stamped with the dataset it was made under. */
export interface GameFilterChoice {
  /** The chosen token, or `null` for All games. */
  token: string | null;
  /** `ClassifyResult.importedAt` of the dataset on screen when it was chosen. */
  stamp: string | null;
}

/**
 * The four Vehicles title ids, as a FIXED vocabulary.
 *
 * The same rule as {@link GAME_FILTER_TOKENS} from the other side: a title
 * travels as a query field to the worker, and the only thing that should be
 * able to reach one is a member of this list. Warplanes is here although it is
 * not a filter token, because it is a title the reader can leave the reader
 * looking at under HEAT or WOTC (D-06).
 */
const VEHICLE_TITLE_IDS = ['wot', 'wotb', 'wows', 'wowp'] as const;

/** One of the four Vehicles titles. A supertype of {@link GameFilterTitle}. */
export type AnyVehicleTitle = (typeof VEHICLE_TITLE_IDS)[number];

/** Is this a title id the Vehicles select can carry? */
function isVehicleTitle(title: string): title is AnyVehicleTitle {
  return (VEHICLE_TITLE_IDS as readonly string[]).includes(title);
}

/**
 * The two games that have sessions but no vehicle table (11-06, D-06).
 *
 * Spelled out rather than derived from {@link GAME_FILTER_TOKENS}: a chip list
 * that grows must not silently grow the set of games Vehicles explains itself
 * for, so the two names are a decision rather than a complement.
 */
export type NoVehicleTableToken = 'HEAT' | 'WOTC';

/**
 * The Vehicles title the reader last APPLIED, stamped with the dataset it was
 * applied under (11-06, D-06).
 *
 * A cell in the shell beside `GameFilterChoice`, for the same reason that one
 * is there: the title has to survive the pane unmounting. It is stamped rather
 * than reset for the same reason too — see `resolveGameFilter`.
 */
export interface VehicleTitleChoice {
  /** The applied title, or `null` before Vehicles has shown one. */
  title: string | null;
  /** `ClassifyResult.importedAt` of the dataset on screen when it was applied. */
  stamp: string | null;
}

/** Is this a token the filter offers a choice for? */
function isFilterable(token: string): token is GameFilterToken {
  return (GAME_FILTER_TOKENS as readonly string[]).includes(token);
}

/**
 * The filter to apply to the dataset on screen, or All.
 *
 * A choice whose stamp is not the current dataset's is DISCARDED, which is the
 * whole reset rule (D-01, T-10-06): a first import, a replace and a clear each
 * change `result.importedAt`, so a filter carried over from a previous archive
 * cannot be applied to a new one. `importedAt === null` answers All for the
 * same reason — with nothing on screen there is nothing to narrow.
 *
 * `null` and a token are the two answers and there is no third: a token that is
 * not in {@link GAME_FILTER_TOKENS} is not a filter the UI can offer, so it
 * degrades to All rather than becoming a chip nobody can see.
 */
export function resolveGameFilter(
  choice: GameFilterChoice,
  importedAt: string | null,
): string | null {
  if (importedAt === null) return null;
  if (choice.stamp !== importedAt) return null;
  return choice.token !== null && isFilterable(choice.token) ? choice.token : null;
}

/**
 * The Vehicles title a filter token means, or `null` for All games and for
 * anything this filter does not offer.
 *
 * Used on the FIRST ask when Vehicles opens (D-21): with a filter set the pane
 * asks for that title, and with All the worker applies its own first-title-with
 * rows rule exactly as it always did.
 *
 * `null` for HEAT and WOTC is NOT "these have no chip". They have chips as of
 * 11-01; they simply have no VEHICLES, so opening Vehicles under a HEAT filter
 * asks the worker's own first-title-with-rows question rather than naming a
 * game whose table would be empty. Choosing a title there replaces the filter
 * (see `filterAfterTitleChange`), which is the same rule D-21 already applies to
 * WoT, Blitz and Warships.
 */
export function filterToTitle(token: string | null): GameFilterTitle | null {
  switch (token) {
    case 'WOT':
      return 'wot';
    case 'WOTB':
      return 'wotb';
    case 'WOWS':
      return 'wows';
    default:
      return null;
  }
}

/**
 * The shared filter to store after the reader picks a Vehicles title.
 *
 * WoT, WoT Blitz and Warships ARE the filter, so they are stored — as the
 * TOKEN the filter speaks, converted here rather than stored as the title, so
 * one value never has two spellings depending on which pane wrote it. Warplanes
 * is not a filter choice (it is not in {@link GAME_FILTER_TOKENS}, so it has no
 * chip and no visible way back to it), so it leaves the filter EXACTLY as it was
 * — neither set nor cleared. That is the whole of D-21, and it is why the
 * second argument is the current value rather than a constant.
 *
 * Note that choosing one of the three titles REPLACES a HEAT or WOTC filter,
 * exactly as it replaces a WoT one: the reader picked a vehicle table, and the
 * shared filter now describes what that table shows.
 */
export function filterAfterTitleChange(title: string, current: string | null): string | null {
  switch (title) {
    case 'wot':
      return 'WOT';
    case 'wotb':
      return 'WOTB';
    case 'wows':
      return 'WOWS';
    default:
      // Warplanes, and anything a future select might carry: the filter is left
      // exactly as the reader left it.
      return current;
  }
}

/**
 * The tokens to offer as chips, or `null` when the row must not render at all.
 *
 * ## The visibility rule, one of them and no per-case exceptions
 *
 * The row exists when at least two chips would show DIFFERENT data. That holds
 * when the export has at least one filterable token (F below) and at least one
 * other game token of any kind — a second filterable one, or a game the worker
 * stores but this filter does not narrow to, because All games then differs
 * from that single game. So:
 *
 *   - F non-empty and |F| + |O| >= 2  ->  shown; a single-game export renders
 *     no node, because All games IS the only view it has;
 *   - OR the filter is ON a filterable token  ->  shown, so the active choice
 *     is always visible and always reversible (UI-SPEC amendment 6: the user
 *     can be looking at an empty game with no way back otherwise).
 *
 * ## Which tokens are filterable is D-13's answer, not a preference
 *
 * Since 11-01 that includes HEAT and WOTC. The membership test is
 * `GAME_FILTER_TOKENS.includes`, so making them chips took a tuple edit and
 * nothing else — and the ONE case that stays null is a game with no Vehicles
 * title (Warplanes), which `filterToTitle` and `filterAfterTitleChange` answer
 * for separately.
 *
 * ## Order and membership
 *
 * The answer is built by walking {@link GAME_FILTER_TOKENS} in its fixed order,
 * so the input list's order cannot reach the screen, and a token outside it
 * cannot be returned at all (T-10-05). `selected` is honoured only when it is
 * itself a filterable token, which is the same rule from the other side.
 */
export function filterChips(games: readonly string[], selected: string | null): string[] | null {
  const filterable = new Set(games.filter(isFilterable));
  const other = new Set(games.filter((token) => !isFilterable(token)));

  const wanted = filterable.size > 0 && filterable.size + other.size >= 2;
  const selectedIsChip = selected !== null && isFilterable(selected);
  if (!wanted && !selectedIsChip) return null;

  return GAME_FILTER_TOKENS.filter((token) => filterable.has(token) || token === selected);
}

// =============================================================================
// HEAT and WOTC in Vehicles (11-06, D-06)
// =============================================================================
//
// Phase 11 gave HEAT and WoT Console chips, and a chip is a promise the reader
// can act on in every pane. In Vehicles it cannot be: neither game contributes
// a vehicle file, so there is no table to narrow to. Three answers make that an
// honest screen rather than an empty one:
//
//   1. `hasNoVehicleTable` — the two games that earn the note, and no others;
//   2. `vehicleTitleForAsk` — what the pane asks the worker for on its first
//      query, which keeps the reader's last table for those two games and is
//      byte-identical to Phase 10 for every other value;
//   3. `resolveVehicleTitle` — the stamped read of that last title, the same
//      shape and the same stamp rule as `resolveGameFilter`.
//
// What none of them does is CLEAR the filter. The filter is the reader's
// choice and D-21 gives Playtime a claim on it; Vehicles explains itself in one
// sentence and leaves it alone (D-06).

/**
 * Is this a game that has sessions but no vehicle table?
 *
 * Exactly HEAT and WoT Console, and the test is equality rather than a
 * membership list so no future append to {@link GAME_FILTER_TOKENS} silently
 * starts claiming a note (T-11-20): a token that arrives from a session FILE
 * NAME inside an untrusted zip must never be able to produce the sentence
 * "… has no vehicle table" just by being present.
 *
 * A type guard rather than a plain boolean, so a caller that goes on to NAME the
 * game cannot reach `formatGameName` with the `null` All is spelled as.
 */
export function hasNoVehicleTable(token: string | null): token is NoVehicleTableToken {
  return token === 'HEAT' || token === 'WOTC';
}

/**
 * The title Vehicles should ask the worker for when it opens.
 *
 * ## The rule, and what it does NOT change
 *
 * `filterToTitle(filter)` for All, WoT, WoT Blitz and Warships — so with any of
 * those values the first ask is byte-identical to Phase 10 and D-21 stands as
 * written. All asks `null`, which is the worker's own first-title-with-rows
 * question.
 *
 * ## The two new cases (D-06)
 *
 * HEAT and WOTC mean no title of their own, so there is nothing to ask for. The
 * pane asks for the title the reader last APPLIED in THIS dataset instead, and
 * with nothing remembered it asks `null` and names whatever the worker applied
 * in the note. So the screen under HEAT is a real table with one honest
 * sentence above it, never an error and never a cleared filter.
 *
 * A remembered value that is not one of the four known ids is answered `null`
 * rather than passed through: the title becomes a query field, and the fixed
 * vocabulary above is the only thing that should be able to produce one
 * (T-11-20). `lastTitle` is a plain `string | null` rather than the narrower
 * title union for exactly this reason — the cell behind it is `string | null`,
 * and this gate is where that becomes a `VehicleAsk`. The worker validates the
 * query as well; this is the first gate.
 */
export function vehicleTitleForAsk(
  filter: string | null,
  lastTitle: string | null,
): AnyVehicleTitle | null {
  if (!hasNoVehicleTable(filter)) return filterToTitle(filter);
  return lastTitle !== null && isVehicleTitle(lastTitle) ? lastTitle : null;
}

/**
 * The Vehicles title the reader last saw in the dataset on screen, or `null`.
 *
 * The stamp is the whole reset rule and it is the same rule
 * `resolveGameFilter` and `resolveReveal` use: a first import, a replace and a
 * Clear each change `importedAt`, so a title remembered under a previous
 * archive cannot be asked for under this one. `null` on the right answers
 * `null` for the same reason the filter answers All there — with nothing on
 * screen there is no table to have been looking at.
 */
export function resolveVehicleTitle(
  choice: VehicleTitleChoice,
  importedAt: string | null,
): AnyVehicleTitle | null {
  if (importedAt === null) return null;
  if (choice.stamp !== importedAt) return null;
  return choice.title !== null && isVehicleTitle(choice.title) ? choice.title : null;
}
