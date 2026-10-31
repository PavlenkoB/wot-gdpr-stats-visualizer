<script lang="ts">
  import {
    TIMELINE_KIND_ALL,
    TIMELINE_KIND_FILTER_LABEL,
    TIMELINE_KIND_LABELS,
  } from '../../ui-copy.ts';
  import type { TimelineKind } from './timeline-shared.ts';

  /**
   * The Account timeline's kind chip row (plan 12-12, D-06; UI-SPEC Surface 2).
   *
   * The `GameFilter` pattern, pane-local: a native radio group in labels, so the
   * keyboard and screen-reader behaviour is the platform's (one tab stop, arrows
   * move and select, `checked` is the browser's). Nothing here writes
   * `role="radio"`, `aria-checked` or a key handler.
   *
   * ## What it does not decide
   *
   * Whether the row exists at all (two or more kinds), which chips it offers and
   * what the chosen kind resolves to are `timeline-state.ts`'s decisions; the
   * pane passes `kinds` already decided and mounts this component only when the
   * row should show. `kinds` is drawn from the fixed `TIMELINE_KINDS` tuple, and
   * every label is looked up in `TIMELINE_KIND_LABELS`, so no archive text can
   * reach a chip. There is no `title`, `aria-label` or tooltip.
   *
   * ## The label is the group's name, and it is on screen
   *
   * `aria-labelledby` points at the visible "Filter by kind" span, so the group a
   * screen reader announces is the sentence the sighted reader reads.
   */
  interface Props {
    /** The kinds to offer, already decided by `kindsPresent`, in the fixed order. */
    kinds: readonly TimelineKind[];
    /** The applied kind, or `null` for All entries. */
    selected: TimelineKind | null;
    /** A chip was chosen. Receives the kind, or `null` for All entries. */
    onchange: (kind: TimelineKind | null) => void;
  }

  let { kinds, selected, onchange }: Props = $props();

  /** The id the visible label carries and the radiogroup is named by (one call per component). */
  const groupId = $props.id();

  /** The test id suffix of a kind: `third-party` for `thirdParty`, derived rather than looked up. */
  function chipId(kind: TimelineKind): string {
    return kind.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }
</script>

<div class="kind-filter" data-testid="timeline-kind-filter">
  <span class="label" id={`${groupId}-label`}>{TIMELINE_KIND_FILTER_LABEL}</span>
  <div class="chips" role="radiogroup" aria-labelledby={`${groupId}-label`}>
    <label class="chip" data-testid="timeline-kind-chip-all">
      <input
        class="visually-hidden"
        type="radio"
        name={`${groupId}-kind`}
        value=""
        checked={selected === null}
        onchange={() => onchange(null)}
      />
      <span>{TIMELINE_KIND_ALL}</span>
    </label>
    <!--
      Position-keyed: the list is the fixed kind order `kindsPresent` returned,
      so there is no identity here worth keying on; an AUDITED row in
      `tests/unit/import/multi-account-keys.test.ts` records why.
    -->
    {#each kinds as kind, index (index)}
      <label class="chip" data-testid={`timeline-kind-chip-${chipId(kind)}`}>
        <input
          class="visually-hidden"
          type="radio"
          name={`${groupId}-kind`}
          value={kind}
          checked={selected === kind}
          onchange={() => onchange(kind)}
        />
        <span>{TIMELINE_KIND_LABELS[kind]}</span>
      </label>
    {/each}
  </div>
</div>

<style>
  .kind-filter {
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

  /* The chips wrap rather than scroll: seven of them exceed the phone's 448px
     content width and take a second 44px line with the 8px gap. The 44px height
     is declared on the chip itself because the global phone block reaches only
     `button`, `summary` and `a`, and a chip is a `label`. */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    min-width: 0;
  }

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

    &:hover {
      background: var(--hover);
    }

    /* Selected: the list's own selection language, same weight as unselected so a
       selection never shifts a chip's width. */
    &:has(input:checked) {
      background: var(--sel);
      color: var(--ink);
      border-color: var(--ink);
      box-shadow: inset 0 -3px 0 var(--ink);

      &:hover {
        background: var(--sel);
      }
    }

    &:has(input:focus-visible) {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }
</style>
