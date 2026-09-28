<script lang="ts">
  import { DROPZONE_PROMPT } from '../ui-copy.ts';

  interface Props {
    disabled: boolean;
    statusText: string | null;
    onfiles: (files: ArrayLike<File>) => void;
  }

  let { disabled, statusText, onfiles }: Props = $props();

  // Track the drag depth so child nodes entering/leaving don't
  // flicker the highlight off and back on (the browser fires
  // dragenter/dragleave for every child the cursor crosses). A
  // non-zero counter means "a drag is over us right now".
  let dragDepth = $state(0);

  let highlighted = $derived(dragDepth > 0 && !disabled);

  // The spinner + status paragraph only render while busy (D-08).
  // The statusText prop is the App's STAGE_TEXT[stage] lookup, or
  // null when the dropzone is idle. While statusText is non-null
  // the dropzone is always disabled — the disabled prop gates the
  // rest of the affordance.
  let showProcessing = $derived(disabled && statusText !== null);

  function onDragEnter(event: DragEvent): void {
    event.preventDefault();
    if (disabled) return;
    dragDepth += 1;
  }

  function onDragLeave(event: DragEvent): void {
    event.preventDefault();
    if (disabled) return;
    dragDepth = Math.max(0, dragDepth - 1);
  }

  function onDragOver(event: DragEvent): void {
    // Always preventDefault on dragover — without it, the browser
    // refuses to fire a 'drop' event for this element.
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    }
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    dragDepth = 0;
    if (disabled) return;
    const files = event.dataTransfer?.files ?? [];
    onfiles(files);
  }

  function onLabelKeyDown(event: KeyboardEvent): void {
    // Space / Enter on the label triggers the click — that's the
    // browser's native behaviour for <label> wrapping <input>, but
    // we make it explicit so screen-reader users on browsers that
    // don't auto-activate a label get the same affordance.
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLLabelElement).click();
    }
  }

  function onInputChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      onfiles(files);
    }
    // Reset so choosing the same file twice still fires `change`.
    input.value = '';
  }
</script>

<!--
  The root is a <label> wrapping a visually-hidden file input. The
  label-as-root is the standard click-to-browse pattern, AND it is the
  drag-and-drop target. The `role="button"` annotation is intentional:
  the dropzone behaves like a button (Enter / Space activates it via
  the keydown handler) even though its native semantics are "label
  for an input". The svelte a11y rule does not know about this dual
  semantic, hence the suppression below — see also 01-04-PLAN.md
  interfaces block which specifies role="button" on this element.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<label
  data-testid="dropzone"
  class="dropzone"
  class:highlighted
  class:disabled
  role="button"
  tabindex="0"
  aria-label="Wargaming data export dropzone"
  aria-disabled={disabled ? 'true' : undefined}
  aria-busy={showProcessing ? 'true' : undefined}
  ondragenter={onDragEnter}
  ondragleave={onDragLeave}
  ondragover={onDragOver}
  ondrop={onDrop}
  onkeydown={onLabelKeyDown}
>
  <input type="file" accept=".zip" data-testid="file-input" {disabled} onchange={onInputChange} />
  {#if showProcessing}
    <p class="processing-status" data-testid="processing-status" role="status">
      <span class="spinner" data-testid="spinner" aria-hidden="true"></span>
      <span class="processing-text">{statusText}</span>
    </p>
  {:else}
    <span class="prompt">{DROPZONE_PROMPT}</span>
  {/if}
</label>

<style>
  /* The dropzone is hand-rolled (PROJECT.md Key Decisions), so all
     styling lives here in a component style block. The build-time CSP
     does not allow inline styles (default-src 'self', no 'unsafe-inline'
     for style-src), and the 01-02 lint rules enforce that via
     svelte/no-inline-styles. */
  .dropzone {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 140px;
    padding: 20px;
    border: 2px dashed #888;
    border-radius: 8px;
    background: #f7f7fa;
    color: #08060d;
    cursor: pointer;
    user-select: none;
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .dropzone:focus-within {
    /* Visible focus ring when the label is tabbed to. */
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  .dropzone.highlighted {
    background: #e8f0fe;
    border-color: #1a73e8;
  }

  .dropzone.disabled {
    cursor: not-allowed;
    opacity: 0.85;
    pointer-events: none;
  }

  .prompt {
    text-align: center;
    font-size: 16px;
    line-height: 1.5;
  }

  .processing-status {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    padding: 0;
    font-size: 16px;
    line-height: 1.5;
  }

  .processing-text {
    /* Nothing extra — the spinner carries the motion; the text stays
       in the same colour as the prompt so the visual swap is small. */
    text-align: center;
  }

  /* CSS-only spinner: a 1.5em circular border with one quarter
     coloured, rotated continuously. The animation is disabled under
     prefers-reduced-motion per WCAG 2.3.3. */
  .spinner {
    display: inline-block;
    width: 1.25em;
    height: 1.25em;
    border: 3px solid rgba(26, 115, 232, 0.25);
    border-top-color: #1a73e8;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex: 0 0 auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
      border-top-color: rgba(26, 115, 232, 0.6);
    }
  }

  /* Visually-hidden but still focusable (clip pattern, not display:none).
     Screen readers and the browser focus ring still reach the input.
     The label is what the user actually clicks/drags onto; the input
     is the click-to-browse affordance. */
  input[type='file'] {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
