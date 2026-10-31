<script lang="ts">
  import { COMPACT_DROPZONE_PROMPT, DROPZONE_ARIA_LABEL, DROPZONE_PROMPT } from '../ui-copy.ts';

  interface Props {
    /** True while a job is in flight; gates every affordance below. */
    disabled: boolean;
    /** The slim-bar variant: a one-line replace target inside the bar. */
    compact?: boolean;
    onfiles: (files: ArrayLike<File>) => void;
  }

  let { disabled, compact = false, onfiles }: Props = $props();

  // The root element, so the parent can move focus to it after a confirmed
  // clear — the button that opened the confirm is gone by then, and the
  // dropzone is the only sensible landing spot (UI-SPEC focus management).
  let label: HTMLLabelElement | undefined = $state();

  export function focus(): void {
    label?.focus();
  }

  // Track the drag depth so child nodes entering/leaving don't
  // flicker the highlight off and back on (the browser fires
  // dragenter/dragleave for every child the cursor crosses). A
  // non-zero counter means "a drag is over us right now".
  let dragDepth = $state(0);

  let highlighted = $derived(dragDepth > 0 && !disabled);

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

  There is exactly ONE dropzone in the DOM, in both the full first-visit
  layout and the slim import bar (D-24, D-25) — `compact` changes how
  this element looks, never how many of them there are. The processing
  text and its spinner no longer live here either: D-26 moved both into
  the import bar's notice slot, so this element keeps its prompt while
  busy and is disabled instead. That is why `aria-busy` follows
  `disabled` — a "processing" flag would now never be true.

  The aria-label is applied to the FULL variant only. An `aria-label`
  replaces the element's content as its accessible name, so labelling
  the compact one would silence its prompt — and D-25's whole job is
  that prompt saying a drop here REPLACES the export already loaded
  above it. Unlabelled, the compact variant is named by the text it
  shows, which is the affordance itself (W-02).
-->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<label
  bind:this={label}
  data-testid="dropzone"
  class="dropzone"
  class:compact
  class:highlighted
  class:disabled
  role="button"
  tabindex="0"
  aria-label={compact ? undefined : DROPZONE_ARIA_LABEL}
  aria-disabled={disabled ? 'true' : undefined}
  aria-busy={disabled ? 'true' : undefined}
  ondragenter={onDragEnter}
  ondragleave={onDragLeave}
  ondragover={onDragOver}
  ondrop={onDrop}
  onkeydown={onLabelKeyDown}
>
  <input type="file" accept=".zip" data-testid="file-input" {disabled} onchange={onInputChange} />
  <span class="prompt">{compact ? COMPACT_DROPZONE_PROMPT : DROPZONE_PROMPT}</span>
</label>

<style>
  /* The dropzone is hand-rolled (PROJECT.md Key Decisions), so all
     styling lives here in a component style block. The build-time CSP
     does not allow inline styles (default-src 'self', no 'unsafe-inline'
     for style-src), and the 01-02 lint rules enforce that via
     svelte/no-inline-styles.

     The dropzone's own states are NESTED under it (D-05): `&.compact`,
     `&:focus-within`, `&.highlighted` and `&.disabled` flatten to the
     compound selectors the flat rules had, so the specificity and the
     source order are exactly what they were. */
  .dropzone {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    padding: var(--layout-gutter);
    border: 2px dashed var(--faint);
    border-radius: var(--radius-card);
    background: var(--list);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
    transition:
      background-color 120ms ease,
      border-color 120ms ease;

    /* Declared BEFORE .highlighted and .disabled on purpose. The compact
       variant is a *resting* look, not a state: the drag highlight and the
       busy treatment must both still win over it, or a slim bar being
       dragged onto would show no sign that it is a drop target. */
    &.compact {
      justify-content: flex-start;
      min-height: 44px;
      padding: var(--space-8) var(--space-12);
      border-width: 1px;
      border-color: var(--faint);
      border-radius: var(--radius-control);
      background: transparent;
    }

    /* Visible focus ring when the label is tabbed to, and when focus() moves
       it there after a confirmed clear. Identical in both variants — only the
       resting chrome above differs. */
    &:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }

    &.highlighted {
      background: color-mix(in srgb, var(--focus) 10%, var(--page));
      border-color: var(--focus);
    }

    &.disabled {
      cursor: not-allowed;
      opacity: 0.85;
      pointer-events: none;
    }
  }

  .prompt {
    text-align: center;
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }

  /* The slim bar's prompt sits on one line against the list pane, so it reads
     as a quiet 14px line in a row rather than as a centred headline. */
  .compact .prompt {
    text-align: left;
    font-size: var(--fs-body);
    color: var(--text);
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
