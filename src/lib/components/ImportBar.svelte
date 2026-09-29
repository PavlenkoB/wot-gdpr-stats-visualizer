<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    CLEAR_DATA_LABEL,
    CLEARED_ACK_MESSAGE,
    DUPLICATE_BANNER_MESSAGE,
    IMPORT_ARIA_LABEL,
    START_OVER_LABEL,
  } from '../ui-copy.ts';
  import Dropzone from './Dropzone.svelte';
  import FailureBanner from './FailureBanner.svelte';

  /**
   * The single transient message the import region shows, derived from the
   * client state by the caller (UI-SPEC App-state matrix, RESEARCH Pattern 4).
   * At most one is ever rendered: processing, error, duplicate or cleared.
   */
  type Notice = 'processing' | 'error' | 'duplicate' | 'cleared' | null;

  interface Props {
    /** 'full' on a first visit, 'slim' once a cached dataset is displayed. */
    variant: 'full' | 'slim';
    notice: Notice;
    /** The stage or per-category progress line shown with the spinner. */
    statusText: string | null;
    /** The generic failure copy; only read when `notice === 'error'`. */
    errorMessage: string | null;
    /** "Imported on {date}"; only read in the slim variant. */
    importedOn: string | null;
    /** True while a job is in flight. */
    busy: boolean;
    onfiles: (files: ArrayLike<File>) => void;
    onstartover: (event: MouseEvent) => void;
    onclear: (event: MouseEvent) => void;
    /** The shared ConfirmPanel, rendered last, inside this element. */
    confirm?: Snippet;
  }

  let {
    variant,
    notice,
    statusText,
    errorMessage,
    importedOn,
    busy,
    onfiles,
    onstartover,
    onclear,
    confirm,
  }: Props = $props();

  let dropzone: Dropzone | undefined = $state();

  /**
   * Move focus to the dropzone. Called by the parent after a confirmed
   * clear, when the button that opened the confirm panel no longer exists
   * and the bar is back to its full variant (UI-SPEC focus management).
   */
  export function focusDropzone(): void {
    dropzone?.focus();
  }
</script>

<!--
  ONE import region for both modes (D-24, D-25). The element is never
  re-created — the `data-variant` attribute changes, the children of the
  slim-only meta row come and go, and the dropzone below them is the same
  instance in both cases. Everything transient the user needs to be told
  goes through the notice slot (D-26); nothing here owns a message string
  of its own except the two Phase 2 constants it is required to render.

  Children in order: the notice slot, the slim-only meta row, the single
  dropzone, then the confirm panel. The panel is last so that a dismissal
  lands the user's eye — and focus — back on the controls above it.
-->
<section
  class="import-bar"
  aria-label={IMPORT_ARIA_LABEL}
  data-testid="import-bar"
  data-variant={variant}
>
  <!--
    The live region is ALWAYS in the DOM and only its child is
    conditional: a region created together with its content is not
    announced, which is the whole point of having one (RESEARCH Pitfall
    10). It carries no margin or padding of its own, so an empty slot
    adds no gap between the bar's blocks.
  -->
  <div data-testid="notice-slot" role="status" aria-live="polite" aria-atomic="true">
    {#if notice === 'processing'}
      <!--
        The spinner and the progress line moved here from the dropzone
        (D-26). No `role` on this element: the slot is the region, and a
        nested one would announce the same update twice.
      -->
      <p class="notice processing" data-testid="processing-status">
        <span class="spinner" data-testid="spinner" aria-hidden="true"></span>
        <span class="processing-text">{statusText}</span>
      </p>
    {:else if notice === 'error' && errorMessage !== null}
      <FailureBanner message={errorMessage} />
    {:else if notice === 'duplicate'}
      <p class="notice" data-testid="duplicate-notice">{DUPLICATE_BANNER_MESSAGE}</p>
    {:else if notice === 'cleared'}
      <p class="notice" data-testid="cleared-ack">{CLEARED_ACK_MESSAGE}</p>
    {/if}
  </div>

  <!--
    The meta row exists only once there is a dataset to describe. It is
    the Phase 2 `.persistent-bar`, moved inside the bar it belongs to: it
    is no longer a separate block below the dashboard.
  -->
  {#if variant === 'slim'}
    <div class="persistent-bar" data-testid="persistent-bar">
      <span class="imported-at" data-testid="imported-at">{importedOn}</span>
      <button type="button" class="bar-button" data-testid="start-over" onclick={onstartover}
        >{START_OVER_LABEL}</button
      >
      <button type="button" class="bar-button" data-testid="clear-data-control" onclick={onclear}
        >{CLEAR_DATA_LABEL}</button
      >
    </div>
  {/if}

  <Dropzone bind:this={dropzone} disabled={busy} compact={variant === 'slim'} {onfiles} />

  {@render confirm?.()}
</section>

<style>
  /* The slim variant is a bar; the full variant has no chrome at all, so a
     first visit does not read as a framed empty card. There is deliberately
     no flex `gap` on this element: the children below carry their own
     12px bottom margin, and a gap would put a second 12px under a notice
     that already has one (or under the empty slot, which must be free). */
  .import-bar {
    margin: 0;
  }

  .import-bar[data-variant='slim'] {
    padding: 12px 16px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #f7f7fa;
  }

  /* The slot itself is transparent to layout: no margin, no padding, no
     minimum height. Its single child, when there is one, brings 12px. */
  [data-testid='notice-slot'] {
    margin: 0;
    padding: 0;
  }

  /* Neutral-info chrome for every non-destructive notice (UI-SPEC Color
     table). The error keeps FailureBanner's own destructive palette, and
     `role="alert"` on it, because an error is meant to interrupt. */
  .notice {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 0 12px;
    padding: 12px 16px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #f1f3f4;
    color: #3c4043;
    font-size: 16px;
    line-height: 1.5;
  }

  .processing-text {
    /* Nothing extra — the spinner carries the motion, and the text keeps
       the notice's colour so the visual swap is small. */
    text-align: left;
  }

  /* CSS-only spinner, carried over from Dropzone.svelte unchanged: a 1.25em
     circular border with one quarter coloured, rotated continuously. The
     animation is disabled under prefers-reduced-motion per WCAG 2.3.3,
     and D-29 adds nothing else. */
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

  .persistent-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    margin: 0 0 12px;
  }

  /* Label role: a neutral fact about when the file was parsed, never styled
     as a warning. It takes the slack on a wide bar; on a narrow one the row
     wraps and the buttons take a line of their own. */
  .imported-at {
    margin-right: auto;
    color: #3c4043;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }

  /* Start over and Clear my cached data are NEUTRAL, not red (Phase 2 D-22):
     red is reserved for the confirm panel's commit button, which is the
     actual point of no return. */
  .bar-button {
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

  .bar-button:hover {
    background: #f1f3f4;
  }

  .bar-button:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }
</style>
