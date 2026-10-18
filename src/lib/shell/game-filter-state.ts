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
// filter reads, and never into the DOM. Phase 11 appends tokens here and every
// chip, the panel and the empty-game copy follow without a markup change.
//
// ## Why HEAT and WOTC are not tokens here
//
// They are real games with real sessions, and they are counted under All games
// (D-05). They are simply not CHOICES: a chip for them would claim a per-game
// scope the worker does not store. So a dataset of only HEAT and WOTC renders
// no chip node at all — All games IS the only view, and a row of one control
// that can only select what is already selected is noise, not a control.
//
// ## Why Warplanes is Vehicles-local
//
// The Vehicles `Game` select carries four titles; the shared filter carries
// three. Choosing Warplanes is a choice about one pane's table, not about the
// export, so `filterAfterTitleChange` returns the CURRENT filter unchanged for
// it rather than clearing it. Playtime is left exactly as the user left it
// (D-21, UI-SPEC Recorded Choice 4).
// =============================================================================

/**
 * The games the shared filter can narrow to, in the FIXED order they are
 * offered (D-05).
 *
 * Fixed rather than "whatever the export had" for two reasons already paid for
 * elsewhere in this codebase: a locale-aware comparison would make the chip
 * order differ between two people looking at one export, and a list assembled
 * from untrusted input is a list whose order is untrusted input's. Phase 11
 * APPENDS to this tuple — that is the whole extension mechanism.
 */
export const GAME_FILTER_TOKENS = ['WOT', 'WOTB', 'WOWS'] as const;

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
 * is not a filter choice (there is no chip for it and the worker stores no
 * scope for it), so it leaves the filter EXACTLY as it was — neither set nor
 * cleared. That is the whole of D-21, and it is why the second argument is the
 * current value rather than a constant.
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
 * other game token of any kind — a second filterable one, or HEAT/WOTC,
 * because All games then differs from that single game. So:
 *
 *   - F non-empty and |F| + |O| >= 2  ->  shown; HEAT-only or WOT-only exports
 *     render no node, because All games IS the only view they have;
 *   - OR the filter is ON a filterable token  ->  shown, so the active choice
 *     is always visible and always reversible (UI-SPEC amendment 6: the user
 *     can be looking at an empty game with no way back otherwise).
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
