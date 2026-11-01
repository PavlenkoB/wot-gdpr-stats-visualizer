<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { cityAssetUrl, fetchCityBytes, readCityManifest } from '../../geo/city-fetch.ts';
  import {
    CITY_ACCURACY_NOTE,
    CITY_ANNOUNCE_CANCELLED,
    CITY_ANNOUNCE_DOWNLOADING,
    CITY_ANNOUNCE_READY,
    CITY_CANCELLED,
    CITY_CANCELLED_TONE,
    CITY_CANCEL_LABEL,
    CITY_DECODING,
    CITY_DECODING_NAME,
    CITY_ERROR,
    CITY_HEADING,
    CITY_PROGRESS_NAME,
    CITY_UNAVAILABLE,
    formatCityIntro,
    formatCityLoadLabel,
    formatCityProgress,
    formatCityReady,
  } from '../../ui-copy.ts';
  import type { CityClient } from './city-client.ts';
  import type { CityView } from './city-shared.ts';
  import {
    acceptCityOutcome,
    cityReduce,
    initialCityState,
    type CityEvent,
    type CityState,
  } from './city-state.ts';

  /**
   * The city-level opt-in (06-13, ACTIVITY-07, D-14, D-15, D-16).
   *
   * ## No decision lives in this file
   *
   * Which state follows which event is `cityReduce`, which worker answer may be
   * shown is `acceptCityOutcome`, and the copy is `ui-copy`'s. What is left is
   * the wiring: one controller per press, one fetch, one decode, and the focus
   * moves the UI-SPEC asks for.
   *
   * ## The only caller of `fetchCityBytes`
   *
   * The one network call of the product is made by `city-fetch.ts` on the main
   * thread, driven from here by an `AbortController`. Nothing is requested on
   * mount, on import, on reveal, on sort or on any map interaction: the request
   * exists only inside `onPress`.
   *
   * ## Abort is not failure, and cancel is not a dataset change
   *
   * Every abort goes through `controller.abort()`, and the one who aborts has
   * ALREADY moved the state: Cancel dispatches `cancel` first (the user's own
   * choice, a neutral line), a dataset change dispatches `dataset-change` (idle,
   * no line at all). So a handler that wakes up to find its signal aborted does
   * nothing, and one that finds a genuine failure with a live signal reports the
   * single fixed error sentence. `signal.aborted` therefore tells "somebody
   * already decided" from "nobody did", which is the only thing the handler
   * needs to know.
   *
   * ## What the block holds, and what it never does
   *
   * The loaded view is handed up through `onLoaded` and lives in the parent's
   * single rune, stamped with its `importedAt`. Nothing here is written to
   * storage, the URL or a cookie (D-15).
   */
  interface Props {
    /** The dataset this block describes; a view is applied only for it. */
    importedAt: string | null;
    /** The worker bridge for the decode. */
    city: CityClient;
    /** Called with a view the worker built for `importedAt`. */
    onLoaded: (view: CityView, importedAt: string) => void;
    /** Words for the block's one live region. Never an address, never a percent. */
    onAnnounce: (text: string) => void;
  }

  let { importedAt, city, onLoaded, onAnnounce }: Props = $props();

  /** The build-time manifest, or null when this build ships no city asset. */
  const manifest = readCityManifest();

  let st = $state.raw<CityState>(initialCityState(manifest));

  /** The controller of the load in flight, or null. Plain: nothing renders it. */
  let controller: AbortController | null = null;

  let loadEl: HTMLButtonElement | null = $state(null);
  let cancelEl: HTMLButtonElement | null = $state(null);
  let readyEl: HTMLParagraphElement | null = $state(null);

  const intro = manifest === null ? '' : formatCityIntro(manifest.bytes);
  const loadLabel = manifest === null ? '' : formatCityLoadLabel(manifest.bytes);
  const readyLine = manifest === null ? '' : formatCityReady(manifest.month);

  /** Run one event through the pure machine and carry out its effect. */
  function apply(event: CityEvent): void {
    const step = cityReduce(st, event);
    st = step.state;
    if (step.effect === 'abort-silently') {
      // The dataset this work was for is gone: stop it, show nothing.
      controller?.abort();
      controller = null;
    }
  }

  /** Move focus once the new state's markup is in the document. */
  async function focusOn(pick: () => HTMLElement | null): Promise<void> {
    await tick();
    pick()?.focus();
  }

  // A different dataset (a replace, or a Clear) returns the block to idle and
  // drops work in flight without a word, in step with the mask reset (D-07).
  $effect(() => {
    const wanted = importedAt;
    untrack(() => apply({ type: 'dataset-change', importedAt: wanted }));
  });

  // Leaving the page aborts a download in flight, so nothing keeps running for
  // a block that is no longer there.
  onMount(() => {
    return () => {
      controller?.abort();
      controller = null;
    };
  });

  /** A genuine failure: the one fixed sentence, the Load button again. */
  function fail(ctl: AbortController): void {
    if (controller === ctl) controller = null;
    apply({ type: 'failure' });
    void focusOn(() => loadEl);
  }

  async function onPress(): Promise<void> {
    if (manifest === null || importedAt === null) return;
    apply({ type: 'press' });
    // The press was refused (a load is already in flight, or the block is
    // ready): no second request can start.
    if (st.kind !== 'downloading') return;

    const wanted = importedAt;
    const ctl = new AbortController();
    controller = ctl;
    // Determinate from the first frame: the manifest knows the size.
    apply({ type: 'progress', received: 0, total: manifest.bytes });
    onAnnounce(CITY_ANNOUNCE_DOWNLOADING);
    void focusOn(() => cancelEl);

    // An unsupported browser would download 11.8 MB and then fail to inflate
    // it. Say so before spending the bytes: the same fixed sentence.
    if (typeof DecompressionStream === 'undefined') {
      fail(ctl);
      return;
    }

    try {
      // Built inside the try: a manifest or base path that does not validate
      // throws here and lands in the same fixed error as every other failure.
      const url = cityAssetUrl(manifest, import.meta.env.BASE_URL, location.href);
      const buffer = await fetchCityBytes(
        url,
        manifest.bytes,
        (received, total) => {
          // The count can pass the manifest size if a host re-encodes the body
          // (the worker then refuses it); clamp what is shown.
          if (!ctl.signal.aborted) {
            apply({ type: 'progress', received: Math.min(received, total), total });
          }
        },
        ctl.signal,
      );
      if (ctl.signal.aborted) return;
      apply({ type: 'bytes-in' });

      // `buffer` is TRANSFERRED here and is detached afterwards: it is not read
      // again, by anyone.
      const pending = city.load(buffer, manifest.bytes, manifest.sha256);
      const loadId = city.lastLoadId;
      const outcome = await pending;
      if (ctl.signal.aborted) return;

      const accepted = acceptCityOutcome(outcome, loadId, importedAt);
      // `null` for a load nobody aborted means nothing else is coming (a worker
      // that holds no dataset, say), so it is a failure, not a wait.
      if (accepted === null || accepted.kind === 'failed') {
        fail(ctl);
        return;
      }
      if (controller === ctl) controller = null;
      onLoaded(accepted.view, wanted);
      apply({ type: 'result' });
      onAnnounce(CITY_ANNOUNCE_READY);
      void focusOn(() => readyEl);
    } catch {
      // The thrown value is deliberately not read: it is text a response chose.
      if (ctl.signal.aborted) return;
      fail(ctl);
    }
  }

  /** The user's own choice: neutral line, Load button, nothing kept. */
  function onCancel(): void {
    const ctl = controller;
    apply({ type: 'cancel' });
    if (st.kind !== 'cancelled') return;
    ctl?.abort();
    controller = null;
    onAnnounce(CITY_ANNOUNCE_CANCELLED);
    void focusOn(() => loadEl);
  }

  /** The progress figures, clamped so the bar and the line never overshoot. */
  const total = $derived(st.total !== null && st.total > 0 ? st.total : null);
  const received = $derived(total === null ? 0 : Math.min(st.received, total));
</script>

{#snippet loadButton()}
  <button
    type="button"
    class="t-note-strong"
    data-testid="city-load"
    bind:this={loadEl}
    onclick={onPress}
  >
    {loadLabel}
  </button>
{/snippet}

{#snippet cancelledLine()}
  <!--
    The recorded presentation (06-02, UI-SPEC Delta 10): a neutral info line with
    no alert role, because Cancel is the user's own choice and not a fault. The
    destructive chrome is the other reading of D-14, kept reachable by the one
    constant.
  -->
  {#if CITY_CANCELLED_TONE === 'error'}
    <p class="body error" role="alert" data-testid="city-cancelled">{CITY_CANCELLED}</p>
  {:else}
    <p class="body info" data-testid="city-cancelled">{CITY_CANCELLED}</p>
  {/if}
{/snippet}

<div data-testid="city-optin" data-state={st.kind}>
  <h4 class="t-note-strong">{CITY_HEADING}</h4>
  {#if st.kind === 'unavailable'}
    <p class="body info" data-testid="city-unavailable">{CITY_UNAVAILABLE}</p>
  {:else if st.kind === 'downloading'}
    <p class="body" data-testid="city-progress-line">{formatCityProgress(received, total)}</p>
    <div class="bar-row">
      <progress
        data-testid="city-progress"
        aria-label={CITY_PROGRESS_NAME}
        max={total ?? undefined}
        value={total === null ? undefined : received}
      ></progress>
      <button
        type="button"
        class="t-note-strong"
        data-testid="city-cancel"
        bind:this={cancelEl}
        onclick={onCancel}
      >
        {CITY_CANCEL_LABEL}
      </button>
    </div>
  {:else if st.kind === 'decoding'}
    <p class="body">{CITY_DECODING}</p>
    <progress data-testid="city-decoding" aria-label={CITY_DECODING_NAME}></progress>
  {:else if st.kind === 'ready'}
    <p class="body" tabindex="-1" bind:this={readyEl} data-testid="city-ready">{readyLine}</p>
    <p class="muted-note" data-testid="city-note">{CITY_ACCURACY_NOTE}</p>
  {:else if st.kind === 'error'}
    <p class="body error" role="alert" data-testid="city-error">{CITY_ERROR}</p>
    {@render loadButton()}
  {:else if st.kind === 'cancelled'}
    {@render cancelledLine()}
    {@render loadButton()}
  {:else if st.kind === 'idle'}
    <p class="muted-note" data-testid="city-intro">{intro}</p>
    {@render loadButton()}
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-8);
    min-width: 0;
  }

  h4 {
    margin: 0;
    color: var(--text);
  }

  /* Neutral-info chrome: cancelled and unavailable (06-UI-SPEC Color).

     The message itself is the shared `.body` text block and the box is this
     rule; the destructive box is the shared `.error` utility, which carries
     the same border, radius and surface. */
  .info {
    padding: var(--space-8) var(--space-12);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--list);
    color: var(--text);
  }

  /* A native progress, 8px tall, track var(--track) and fill var(--text) (06-UI-SPEC
     Color). No animation or transition is declared: the indeterminate state is
     the user agent's own. */
  progress {
    align-self: stretch;
    min-width: 0;
    width: 100%;
    height: 8px;
    border: 0;
    border-radius: 4px;
    background: var(--track);
    color: var(--text);
    appearance: none;
    overflow: hidden;

    &::-webkit-progress-bar {
      background: var(--track);
    }

    &::-webkit-progress-value {
      background: var(--text);
    }

    &::-moz-progress-bar {
      background: var(--text);
    }
  }

  /* The bar and Cancel share a row; at 375px they stack, because the bar's
     minimum plus the button does not fit a 295px card.

     This rule comes AFTER the `progress` rule on purpose: the bar's compound
     inside the row has the SAME specificity as the bare `progress` rule, so
     the one that comes last is the one that wins - and the bar inside the
     row must win, or it would be full width and stretched again. */
  .bar-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-self: stretch;
    gap: var(--space-8) var(--space-16);
    min-width: 0;

    /* Inside the row the bar takes the free space, and wraps above Cancel when
       less than 160px is left. */
    & progress {
      flex: 1 1 160px;
      align-self: center;
      width: auto;
    }
  }

  button {
    padding: var(--space-8) var(--space-16);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--page);
    color: var(--text);

    &:hover {
      background: var(--hover);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }
</style>
