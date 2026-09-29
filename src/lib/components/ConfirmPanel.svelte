<script lang="ts">
  interface Props {
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { message, confirmLabel, cancelLabel, onconfirm, oncancel }: Props = $props();
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

  Body copy and labels are passed in as props — never inline strings
  in this file — so all destructive-confirm copy lives in ui-copy.ts.
-->
<div role="alertdialog" aria-modal="true" data-testid="confirm-panel" class="confirm-panel">
  <p class="confirm-message">{message}</p>
  <div class="confirm-actions">
    <button type="button" class="confirm-cancel" data-testid="confirm-cancel" onclick={oncancel}
      >{cancelLabel}</button
    >
    <button type="button" class="confirm-commit" data-testid="confirm-commit" onclick={onconfirm}
      >{confirmLabel}</button
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
    margin: 0 0 16px;
    padding: 16px;
    border: 1px solid #f9ab00;
    border-radius: 6px;
    background: #fef7e0;
    color: #202124;
    font-size: 16px;
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
     Reuses the neutral-info palette (border #80868b, default text
     color, hover background #f1f3f4) the duplicate-loaded banner and
     "Imported on ..." timestamp use. */
  .confirm-cancel {
    padding: 8px 16px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #fff;
    color: #3c4043;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .confirm-cancel:hover {
    background: #f1f3f4;
  }

  .confirm-cancel:focus-visible {
    outline: 3px solid #1a73e8;
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
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }
</style>
