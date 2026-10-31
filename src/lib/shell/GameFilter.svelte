<script lang="ts">
  import { GAME_FILTER_ALL, GAME_FILTER_LABEL, formatGameName } from '../ui-copy.ts';

  /**
   * The game filter chip row (Phase 10, D-01; UI-SPEC Surface 1).
   *
   * ## What it renders, and what it refuses to render
   *
   * A native radio group in labels, so the keyboard and screen-reader
   * behaviour is the platform's: ONE tab stop for the whole group, arrows move
   * and select, Space is native, and `checked` is the browser's rather than a
   * re-implementation. Nothing here writes `role="radio"` or `aria-checked` by
   * hand, and nothing declares its own key handler.
   *
   * The row itself is not this component's decision: `Playtime.svelte` passes
   * `games` already resolved by `filterChips`, and passes nothing at all when
   * that is `null`. So a single-game export, an export with no session file and
   * an export of only HEAT and WOTC all mount NO NODE rather than an empty row
   * with a heading over it.
   *
   * ## Why the tokens are never interpolated as markup
   *
   * `games` comes from an untrusted zip's file names, and every chip can only
   * hold a token from the fixed `GAME_FILTER_TOKENS` list — the visibility rule
   * in `game-filter-state.ts` guarantees it (T-10-05). The label is rendered as
   * text by interpolation regardless, and there is no `title`, no `aria-label`
   * and no tooltip carrying the raw token: a hostile token would otherwise
   * reach an attribute the visible text never shows.
   *
   * ## The label is the group's name, and it is on screen
   *
   * `aria-labelledby` points at the visible "Filter by game" span, so the group
   * a screen reader announces is the same sentence the sighted reader reads. A
   * visually hidden duplicate would be one more thing to drift from the copy.
   *
   * ## The radios are hidden by the SHARED utility
   *
   * The inputs carry the class `visually-hidden`, which `src/styles/utilities.css`
   * defines once: the clip pattern is a project-wide contract, not a per-file
   * copy. This file used to carry its own copy of the same clip block, and a
   * scoped copy outranks the global one, so the two could drift apart without
   * anybody noticing. The local copy is deleted, and the shared block states
   * the same declarations, so the computed style is unchanged.
   */
  interface Props {
    /** The tokens to offer, already decided by `filterChips`; never hostile. */
    games: readonly string[];
    /** The applied token, or `null` for All games. */
    selected: string | null;
    /** A chip was chosen. Receives the token, or `null` for All games. */
    onchange: (token: string | null) => void;
  }

  let { games, selected, onchange }: Props = $props();

  /**
   * The id the visible label carries and the radiogroup is named by. From
   * `$props.id()` rather than a literal, so two blocks on one page could not
   * share an `aria-labelledby` target. Svelte allows the call once per
   * component, so the radios' shared `name` is that id with a suffix.
   */
  const groupId = $props.id();

  /**
   * Lower case for the test ids: `game-filter-chip-wot`, `…-wotb`, `…-wows`,
   * `…-wotc`, `…-heat`.
   *
   * Derived from the token rather than looked up, so a new filter token is
   * addressable in a spec without an edit here — the tests, not this function,
   * decide which chips an export warrants.
   */
  function chipId(token: string | null): string {
    return token === null ? 'all' : token.toLowerCase();
  }
</script>

<div class="game-filter" data-testid="game-filter">
  <span class="label" id={`${groupId}-label`}>{GAME_FILTER_LABEL}</span>
  <div class="chips" role="radiogroup" aria-labelledby={`${groupId}-label`}>
    <!--
      All games first, then the tokens `filterChips` decided on, in the fixed
      order that function returns. `ALL` is not a token: it is the absence of
      one, so it is offered first and named in the copy rather than in
      `GAME_FILTER_TOKENS`.
    -->
    <label class="chip" data-testid="game-filter-chip-all">
      <input
        class="visually-hidden"
        type="radio"
        name={`${groupId}-game`}
        value=""
        checked={selected === null}
        onchange={() => onchange(null)}
      />
      <span>{GAME_FILTER_ALL}</span>
    </label>
    <!--
      Position-keyed: the list is the fixed token order, deduplicated by
      `filterChips`, so there is no identity here worth keying on and an
      `AUDITED` row in `tests/unit/import/multi-account-keys.test.ts` records
      why.
    -->
    {#each games as game, index (index)}
      <label class="chip" data-testid={`game-filter-chip-${chipId(game)}`}>
        <input
          class="visually-hidden"
          type="radio"
          name={`${groupId}-game`}
          value={game}
          checked={selected === game}
          onchange={() => onchange(game)}
        />
        <span>{formatGameName(game)}</span>
      </label>
    {/each}
  </div>
</div>

<style>
  /* Label above the chips, 4px apart, the same treatment as `.selector-row`
     label in `Playtime.svelte` — scoped styles cannot be shared, so the rule
     is repeated rather than promoted to a global sheet. */
  .game-filter {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .label {
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    color: var(--text);
  }

  /*
    The chips wrap rather than scroll: at 375px the four of them fit one line in
    the 448px content width, and a locale or font that pushes them past it gets
    a second 44px line with the 8px gap rather than a horizontal scroller. The
    44px height is declared HERE rather than left to the global phone block
    because that block reaches only `button`, `summary` and `a`, and a chip is a
    `label` — so this rule is what holds the touch floor at EVERY width, which
    is also why this component needs no media query of its own.
  */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    min-width: 0;
  }

  /* The chip's own states are NESTED under it (D-05): `&:hover`,
     `&:has(input:checked)` and `&:has(input:focus-visible)` flatten to the
     compound selectors the flat rules had, so the specificity and the source
     order are exactly what they were. */
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    box-sizing: border-box;
    padding: 0 var(--space-16);
    border: 1px solid var(--faint);
    border-radius: var(--radius-control);
    background: var(--page);
    color: var(--text);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    white-space: nowrap;
    cursor: pointer;

    /* Hover only on an unselected chip: a selected chip is already showing where
       the choice went, and swapping its fill under the pointer would make the
       selection look like it moved. */
    &:hover {
      background: var(--hover);
    }

    /* Selected: the list's own selection language — the `--sel` fill with an ink
       border and an ink bottom bar, NOT the filled-ink primary button. Status is
       never colour alone: the checked radio state says the same thing to a
       screen reader and in the DOM. */
    &:has(input:checked) {
      background: var(--sel);
      color: var(--ink);
      border-color: var(--ink);
      box-shadow: inset 0 -3px 0 var(--ink);

      /* The plain `:hover` above outranks the selected rule on specificity, so
         a selected chip would lose its fill under the pointer. This puts it
         back, and it is NESTED under the selected rule because it extends it
         (D-05): `&:hover` flattens to the compound the flat rule had. */
      &:hover {
        background: var(--sel);
      }
    }

    /* The focus ring is on the visible chip, never on the hidden input, so it is
       where the reader's attention already is. No transition and no animation:
       motion is for meaning in this project, and a selection already has three. */
    &:has(input:focus-visible) {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }
</style>
