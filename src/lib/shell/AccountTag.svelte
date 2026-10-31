<script lang="ts">
  /**
   * The account tag chip (Phase 10, D-10, D-19; UI-SPEC Surface 5).
   *
   * ONE inert letter, and the whole of what it means in a visually-hidden span
   * beside it. Two root nodes and no wrapper: a wrapper would be a third node
   * per windowed row for no layout gain, and the two spans sit inside whatever
   * cell the caller renders them in.
   *
   * ## Why the phrase is TEXT and nothing else
   *
   * The phrase names an account ID and a nickname, and both are untrusted zip
   * content. The v1.0 rule (D-21) confines them to text, and D-19 relaxes it
   * only far enough to let a nickname ride along in a hidden span inside a
   * tagged row. So the letter is hidden from assistive technology, the phrase
   * is a text node, and this file deliberately carries NO attribute that could
   * hold either value: no hover bubble, no accessible-name override, no
   * description link, no data attribute, no tooltip and no listener of any kind.
   * `tests/e2e/shell/multi-account.spec.ts` asserts that from the outside, by
   * counting occurrences in the rendered text and in the markup and requiring
   * them to be equal (T-10-08).
   *
   * ## Why there is no `visual` false default to worry about
   *
   * Every call site in this phase shows the letter, so `visual` exists for the
   * one case a future caller may want (a tag with the phrase alone) rather than
   * because anything needs it today. When it is false the chip node is not
   * rendered at all — there is no empty span left behind to hold the gap.
   *
   * ## The phrase is hidden by the SHARED utility
   *
   * The span carries the class `visually-hidden`, which `src/styles/utilities.css`
   * defines once: the clip pattern is a project-wide contract, not a per-file
   * copy. This file used to carry its own copy of the same clip block, and a
   * scoped copy outranks the global one, so the two could drift apart without
   * anybody noticing. The local copy is deleted, and the shared block states
   * the same declarations, so the computed style is unchanged: the phrase is in
   * the accessibility tree and nowhere else, and `position: absolute` inside a
   * positioned ancestor keeps it inside a scrolling cell's clip rather than
   * letting it lay out at the far right of a wide table and widen the page at
   * 375px.
   */
  interface Props {
    /** The letter to draw: `A`, `B`, … `AA`. Derived from the header order. */
    letter: string;
    /**
     * The full phrase a screen reader reads in this row's place.
     *
     * Built by `formatAccountTagLabel` (data rows) or
     * `formatAccountLegendLabel` (the identity header's legend). Passed in
     * rather than assembled here so the wording lives in `ui-copy.ts`, the one
     * file that owns user-visible strings.
     */
    label: string;
    /** False renders the phrase alone, with no chip node. */
    visual?: boolean;
  }

  let { letter, label, visual = true }: Props = $props();
</script>

{#if visual}<span class="tag" data-testid="account-tag"
    ><span aria-hidden="true">{letter}</span></span
  >{/if}<span class="visually-hidden">{label}</span>

<style>
  /* The `.tag` look, copied from `LoginTable.svelte`'s account-record chip
     rather than shared through a new stylesheet: two components, one look, and
     a shared class would mean a global CSS file this phase does not need.
     `font-weight: 600`, `min-width: 24px` and `text-align: center` are the
     three deliberate additions (UI-SPEC Surface 5) — one capital letter has to
     read at a glance, and it has to stay the same width whether it is `A` or
     `AA`.

     The 18px line box is fixed and the chip has no vertical padding, so it can
     never make a windowed 40px row taller — the constant `windowRange` divides
     by. It is INERT text, not a control, so the 44px touch floor does not
     apply to it (UI-SPEC Recorded Choice 2): the floor belongs to the
     interactive controls around it.

     No ellipsis and no overflow rule: the chip grows with its text instead, so
     `AA` is never clipped into something that reads as `A` (UI-SPEC, overflow). */
  .tag {
    display: inline-block;
    min-width: 24px;
    padding: 0 var(--space-8);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--chip);
    color: var(--muted);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: 18px;
    text-align: center;
    white-space: nowrap;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
