<script lang="ts">
  import { LOGIN_HISTORY_HEADING, SECTION_NOTE_PENDING } from '../ui-copy.ts';

  /**
   * The Login history sub-heading and its placeholder note.
   *
   * ## Why this is a placeholder at all
   *
   * Phase 3 D-02 fixes BOTH sub-headings inside the Activity_history card, and
   * Phase 6 replaces this note with the masked table and the login map. The
   * sub-heading and its note exist now for two reasons that are not cosmetic:
   * the document order is part of the D-02 contract and a card with one
   * heading where the contract says two is a card that has to be re-laid-out
   * later; and the `(sections-pending)` e2e asserts the pending note per
   * section, so a real section with a real placeholder is what keeps that
   * assertion meaningful instead of special-cased.
   *
   * ## What is deliberately not here
   *
   * No address, no email, no login row — and no value is READ, not merely not
   * shown. D-01 puts the app in the login history's local scope, and Phase 3
   * established the rule that decides what a viewer sees: the plan never reads
   * the sensitive columns, so they cannot leak through a heading, a tooltip or
   * a count. This component therefore takes NO props at all — a component with
   * nothing to render has nothing to leak, and a later plan that adds the
   * table has to be the one that widens this signature.
   */
</script>

<section data-testid="login-history-placeholder">
  <h3>{LOGIN_HISTORY_HEADING}</h3>
  <p>{SECTION_NOTE_PENDING}</p>
</section>

<style>
  /* Both sub-headings are siblings inside the Activity_history card and must
     read as the same kind of heading, so this rule is the one in
     Playtime.svelte, value for value — scoped styles cannot be shared, and a
     copy that drifts is worse than a copy that is visible. Keep the two in
     step. */
  h3 {
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #dadce0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #08060d;
  }

  /* Body role. `min-width: 0` and the wrap are the usual pair for a note in a
     flex column: a long unbroken token in a dataset-derived sentence must wrap
     rather than widen the card at 375px. */
  p {
    margin: 0;
    min-width: 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #3c4043;
    overflow-wrap: anywhere;
  }
</style>
