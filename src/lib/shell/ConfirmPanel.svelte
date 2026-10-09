<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { message, confirmLabel, cancelLabel, onconfirm, oncancel }: Props = $props();

  let cancelButton: HTMLButtonElement | undefined = $state();
  let commitButton: HTMLButtonElement | undefined = $state();

  // Focus moves to the safe answer the moment the panel appears. The panel
  // can be opened from three different places, two of which are inside the
  // bar it is inserted into, so the caller's focus is not a reliable place
  // to leave the user: a keyboard user who opened this has to be told, in
  // the accessibility tree, that a dialog now owns the interaction. This is
  // done in code rather than with the element's own mount-time focus
  // attribute, which the svelte accessibility lint flags.
  onMount(() => cancelButton?.focus());

  // The panel declares `aria-modal`, so it also owns the keys a dialog owns
  // (WR-05). The handler is on the panel root ONLY (Phase 8 D-05: no window or
  // document listener, so no key is taken from a chart or a field). Escape
  // cancels. Tab wraps between the two buttons: forward from the last goes to
  // the first, and Shift+Tab from the first goes to the last. Any other Tab
  // press is left to the browser, which moves between the two buttons anyway.
  function onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && !event.shiftKey) {
      event.preventDefault();
      oncancel();
      return;
    }
    if (event.key !== 'Tab') return;
    if (!event.shiftKey && document.activeElement === commitButton) {
      event.preventDefault();
      cancelButton?.focus();
    } else if (event.shiftKey && document.activeElement === cancelButton) {
      event.preventDefault();
      commitButton?.focus();
    }
  }
</script>

<!--
  Shared in-app destructive confirm panel (D-13/D-14/D-16/D-17/D-22).
  Used for three entry points (replace-on-drop, Start Over, Clear my
  cached data) with three different copy pairs selected by App.svelte
  via the pendingAction.kind discriminator — one component, one
  mechanism, per D-22.

  Same alert-dialog panel family as FailureBanner.svelte (role=
  "alertdialog" vs. "alert" — semantically correct for a
  confirm/cancel), with Caution/amber chrome (UI-SPEC Color table)
  wrapping a neutral dismiss button and a red destructive commit
  button (UI-SPEC "Destructive-trigger design rule": destructive
  COMMIT uses red, not the trigger; the Start Over and Clear my
  cached data trigger buttons themselves stay neutral grey so the
  "point of no return" is unambiguous).

  Keys: Escape cancels, and Tab / Shift+Tab wrap between the two buttons, so
  focus cannot leave the panel by keyboard while it is open. The safe button is
  still focused first.

  Body copy and labels are passed in as props — never inline strings
  in this file — so all destructive-confirm copy lives in ui-copy.ts.
-->
<!--
  The panel root owns the dialog's keys but is never focused itself (focus lives
  on its two buttons), so it needs no tabindex.
-->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  role="alertdialog"
  aria-modal="true"
  data-testid="confirm-panel"
  class="confirm-panel"
  onkeydown={onKeydown}
>
  <p class="confirm-message">{message}</p>
  <div class="confirm-actions">
    <button
      type="button"
      class="confirm-cancel"
      data-testid="confirm-cancel"
      bind:this={cancelButton}
      onclick={oncancel}>{cancelLabel}</button
    >
    <button
      type="button"
      class="confirm-commit"
      data-testid="confirm-commit"
      bind:this={commitButton}
      onclick={onconfirm}>{confirmLabel}</button
    >
  </div>
</div>

<style>
  /* Caution/amber chrome (UI-SPEC Color table — "Caution/amber"). The
     panel border/background follows the same palette the existing
     known-deferred badge + skip-count tag use, so the destructive-
     confirm chrome reads as part of the established semantic family
     rather than a new color. The panel's text stays default body
     color for readability (the UI-SPEC explicitly: "the panel's own
     text stays default body color for readability"). */
  .confirm-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    /* The panel is the LAST child of the import bar, so the 12px that used
       to sit under it now sits above it, and the space below it comes from
       the bar's own place in the page gap. */
    margin: 12px 0 0;
    padding: 16px;
    border: 1px solid #f9ab00;
    border-radius: 6px;
    background: #fef7e0;
    color: var(--ink);
    font-size: 14px;
    line-height: 1.5;
  }

  .confirm-message {
    margin: 0;
  }

  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Neutral dismiss button (UI-SPEC "Destructive-trigger design rule"):
     the secondary button of every destructive confirm must be NEUTRAL,
     not red. Destructive color is reserved for the COMMIT button only.
     Reads the declared tokens (control border var(--faint), default text
     color, hover background var(--hover)), the neutral palette the
     duplicate-loaded banner and "Imported on ..." timestamp use. */
  .confirm-cancel {
    padding: 8px 16px;
    border: 1px solid var(--faint);
    border-radius: 6px;
    background: var(--page);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .confirm-cancel:hover {
    background: var(--hover);
  }

  .confirm-cancel:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  /* Destructive commit button (UI-SPEC Color table — "Destructive"):
     this is the actual point of irreversible commitment across all
     three destructive flows. Mirrors the hex values FailureBanner
     already uses (border #c5221f / background #fce8e6 / text
     #8a1c17), so the project's destructive error color is reused
     verbatim. */
  .confirm-commit {
    padding: 8px 16px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .confirm-commit:hover {
    background: #f5d4d1;
  }

  .confirm-commit:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
