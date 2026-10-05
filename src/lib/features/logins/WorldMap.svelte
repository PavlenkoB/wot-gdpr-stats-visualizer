<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { WORLD_SHAPES, WORLD_VIEWBOX, type WorldShape } from '../../geo/world-map.generated.ts';
  import { MAP_GROUP_LABEL, formatMapCountryLabel, formatMapTooltipLines } from '../../ui-copy.ts';
  import ChartTooltip from '../../charts/ChartTooltip.svelte';
  import type { TooltipRequest } from '../playtime/playtime-model.ts';
  import { mapLevel, mapNavigate, type CountryRow } from './map-model.ts';

  /**
   * The country map: one static SVG, one `<path>` per country shape (06-12,
   * ACTIVITY-06, D-09, D-10).
   *
   * ## What it is handed, and why that is the privacy argument
   *
   * The ranked country rows and nothing else: a code, a name, a login count and
   * an address COUNT. No address, no login row and no coordinate ever reaches
   * this component, so there is nothing here that could leak one into the DOM,
   * and the node count follows the number of countries rather than the number of
   * logins (the AGENTS.md chart-scale rule).
   *
   * ## Why the shapes are imported STATICALLY
   *
   * A dynamic `import()` would emit a lazy chunk the browser requests after the
   * page has loaded, and the zero-network guard counts that as a request. The
   * generated module is plain data that imports nothing, so a static import puts
   * it in the main chunk and keeps the page's request set unchanged.
   *
   * ## Why the fill is a class
   *
   * `level-N` paints `var(--ramp-N)` from the ONE declaration in `src/app.css`.
   * A shade restated as a hex value here would be a second place for the ramp to
   * be wrong in, and `contrast.test.ts` fails on it.
   *
   * ## Why the SVG holds no text
   *
   * A country's name and figures live in its accessible name, the tooltip and the
   * list. With no text inside it, scaling the SVG to its container cannot make
   * anything illegible, which is why this is the one SVG in the project that is
   * allowed to scale (06-UI-SPEC section 4, Decision).
   *
   * ## One tab stop, one ring, six delegated listeners
   *
   * The map is ONE tab stop (roving focus): a hostile or well-travelled export
   * can have 200 countries, and 200 tab stops would trap a keyboard user. The
   * handlers are delegated to the `<svg>` and find the country through
   * `data-iso`, so the listener count does not grow with the data. The focus ring
   * is a separate overlay copy of the active shape drawn last, because an SVG
   * paints in document order and a stroke on the country itself would be hidden
   * under every neighbour drawn after it.
   */
  interface Props {
    /** Every country with logins, ranked. Rows with no shape are simply never drawn. */
    rows: readonly CountryRow[];
    /** The largest per-country login count, the top of the shading scale. */
    max: number;
    /** The id of the keyboard hint the group is described by. */
    hintId: string;
  }

  let { rows, max, hintId }: Props = $props();

  /** The shape of every drawable code. Read, never written, after this line. */
  const SHAPES: Readonly<Record<string, WorldShape>> = Object.fromEntries(
    WORLD_SHAPES.map((shape) => [shape.iso, shape]),
  );

  /** The keys the map handles, so every other key keeps its default. */
  const NAV_KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End'];

  /** Each drawn country's row and shade, by code. Built once per dataset. */
  const drawnByIso = $derived.by(() => {
    const byIso = new SvelteMap<string, { row: CountryRow; level: number }>();
    for (const row of rows) {
      if (row.drawn) byIso.set(row.cc, { row, level: mapLevel(row.logins, max) });
    }
    return byIso;
  });

  /** The countries the keyboard can reach: logins and a shape, in ranked order. */
  const order = $derived(rows.filter((row) => row.drawn).map((row) => row.cc));

  /** Countries too small to see as a shape, which get a marker instead. */
  const tinyRows = $derived(rows.filter((row) => row.drawn && SHAPES[row.cc]?.tiny === true));

  /** The country the roving stop was last on, which may no longer be drawn. */
  let activeCc = $state.raw<string | null>(null);
  /** The country under the pointer. Never moves `activeCc`. */
  let hoverCc = $state.raw<string | null>(null);
  /** Whether the focus in the map is the keyboard's, so the ring is meant. */
  let keyboardRing = $state(false);
  /** The open tooltip request, or null. */
  let tip = $state.raw<TooltipRequest | null>(null);
  /** The element a keyboard tooltip was measured from, for the stale check. */
  let tipAnchor = $state.raw<Element | null>(null);
  /** Where the keyboard tooltip's zero-size anchor sits, in viewBox units. */
  let centroid = $state.raw<{ cx: number; cy: number } | null>(null);
  let anchorEl = $state<SVGCircleElement | null>(null);
  let svgEl = $state<SVGSVGElement | null>(null);
  /** Set just before a key-driven focus, so the focus handler knows it was the keyboard. */
  let keyNavPending = false;
  /**
   * True from a Tab into the map until the page's scroll, if there was one, ends.
   *
   * Tabbing into a map that is off screen makes the browser scroll it into view,
   * and under the page's smooth scrolling that is a glide of several hundred
   * milliseconds. Every frame of it moves the country, so the shared tooltip
   * correctly closes the tooltip it had just opened for a country that is no
   * longer where it was measured. `scrollend` is the moment the glide is over, so
   * the tooltip is opened once more there and the keyboard reader still gets it.
   */
  let settling = false;

  /**
   * The single tab stop: the last focused country if it is still drawn,
   * otherwise the highest-ranked country that has a shape.
   */
  const stopCc = $derived(
    activeCc !== null && drawnByIso.has(activeCc) ? activeCc : (order[0] ?? null),
  );

  /** The country the overlay ring is drawn on: the pointer's first, then the keyboard's. */
  const ringCc = $derived(hoverCc ?? (keyboardRing ? stopCc : null));
  const ringShape = $derived(ringCc === null ? undefined : SHAPES[ringCc]);

  /** The drawn country an event came from, found by its `data-iso`. */
  function countryFrom(target: EventTarget | null): string | null {
    const node = target instanceof Element ? target.closest('[data-iso]') : null;
    const cc = node === null ? null : node.getAttribute('data-iso');
    return cc !== null && drawnByIso.has(cc) ? cc : null;
  }

  /** The tooltip's two lines for one country: the name, then the two figures. */
  function linesFor(cc: string): { line1: string; line2: string } | null {
    const entry = drawnByIso.get(cc);
    if (entry === undefined) return null;
    const [line1, line2] = formatMapTooltipLines(entry.row.name, entry.row.logins, entry.row.ips);
    return { line1, line2 };
  }

  function dismiss(): void {
    tip = null;
    tipAnchor = null;
  }

  /** Open the tooltip at the pointer, as a zero-size anchor. */
  function showAtPointer(cc: string, event: PointerEvent): void {
    const lines = linesFor(cc);
    if (lines === null) return;
    tip = { anchor: { left: event.clientX, top: event.clientY, width: 0, height: 0 }, ...lines };
    tipAnchor = null;
  }

  /**
   * Open the tooltip at a country's centroid.
   *
   * The centroid is in viewBox units, so a tiny anchor circle is moved there and
   * MEASURED: the browser's own transform puts it in viewport coordinates at any
   * scale, with no matrix arithmetic here to get wrong. The circle is also the
   * element the shared tooltip checks to tell a reader scrolling away from a
   * focus that merely moved the page.
   */
  async function showAtCentroid(cc: string): Promise<void> {
    const lines = linesFor(cc);
    const shape = SHAPES[cc];
    if (lines === null || shape === undefined) return;
    centroid = { cx: shape.cx, cy: shape.cy };
    await tick();
    if (anchorEl === null) return;
    const box = anchorEl.getBoundingClientRect();
    tip = {
      anchor: { left: box.left, top: box.top, width: box.width, height: box.height },
      ...lines,
    };
    tipAnchor = anchorEl;
  }

  function onPointerOver(event: PointerEvent): void {
    const cc = countryFrom(event.target);
    if (cc === null) return;
    hoverCc = cc;
    showAtPointer(cc, event);
  }

  /** Follow the pointer inside a large country, so the tooltip stays where it points. */
  function onPointerMove(event: PointerEvent): void {
    const cc = countryFrom(event.target);
    if (cc === null || cc !== hoverCc) return;
    showAtPointer(cc, event);
  }

  /**
   * Close on leaving every country.
   *
   * `pointerout` and its `relatedTarget`, because moving from a country into its
   * own marker or into a neighbour fires `pointerout` for the one being left, and
   * closing on that would blank the tooltip mid-move; the `pointerover` on the
   * one being entered reopens it.
   */
  function onPointerOut(event: PointerEvent): void {
    if (countryFrom(event.relatedTarget) !== null) return;
    hoverCc = null;
    dismiss();
  }

  /** Whether the browser itself would draw a keyboard focus ring on this element. */
  function isFocusVisible(node: Element): boolean {
    try {
      return node.matches(':focus-visible');
    } catch {
      // An engine without the pseudo-class: treat the focus as the keyboard's,
      // because a ring that is missing is worse than one that is extra.
      return true;
    }
  }

  function onFocusIn(event: FocusEvent): void {
    const cc = countryFrom(event.target);
    if (cc === null) return;
    activeCc = cc;
    const fromKeyNav = keyNavPending;
    const viaKeyboard = fromKeyNav || isFocusVisible(event.target as Element);
    keyNavPending = false;
    // A click that focused a country is the POINTER's: the hover ring and
    // tooltip already say so, and a keyboard ring would claim otherwise.
    if (!viaKeyboard) return;
    keyboardRing = true;
    // An arrow move never scrolls (see `onKeyDown`); a Tab into the map may. An
    // arrow pressed while that scroll is still gliding must not forget it.
    if (!fromKeyNav) settling = true;
    void showAtCentroid(cc);
  }

  function onFocusOut(event: FocusEvent): void {
    if (countryFrom(event.relatedTarget) !== null) return;
    keyboardRing = false;
    settling = false;
    centroid = null;
    dismiss();
  }

  /** Reopen the tooltip once the scroll a Tab caused is over, if nothing closed it on purpose. */
  function onScrollEnd(): void {
    if (!settling) return;
    settling = false;
    if (keyboardRing && stopCc !== null && tip === null) void showAtCentroid(stopCc);
  }

  /**
   * The six navigation keys and Escape.
   *
   * The next country is `mapNavigate`'s, in ranked order and stopping at both
   * ends, so the map cannot wrap into a loop. The default is prevented for the
   * six keys whether or not the focus moves: at an end the unprevented arrow is
   * the browser scrolling the page out from under the focused country.
   * `preventScroll` on the focus call is for the same reason: the map is already
   * on screen, and a scroll would close the tooltip the move had just opened.
   */
  async function onKeyDown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Escape') {
      settling = false;
      dismiss();
      return;
    }
    if (!NAV_KEYS.includes(event.key)) return;
    event.preventDefault();

    const from = stopCc === null ? -1 : order.indexOf(stopCc);
    if (from < 0) return;
    const next = mapNavigate(from, event.key, order.length);
    if (next === from) return;

    const cc = order[next]!;
    keyboardRing = true;
    activeCc = cc;
    // The tabindex values move before the focus does, so the browser's own
    // sequential-focus bookkeeping never sees two zeros.
    await tick();
    const node = svgEl?.querySelector<SVGElement>(
      `[data-testid="login-country"][data-iso="${cc}"]`,
    );
    if (node === null || node === undefined) return;
    keyNavPending = true;
    node.focus({ preventScroll: true });
  }
</script>

<svelte:window onscrollend={onScrollEnd} />

<!--
  Six delegated handlers on the group, none per country. A `role="group"` is not
  an interactive role, so the compiler would warn about handlers on it; the group
  IS the keyboard owner for the whole map (one tab stop), which is the roving
  focus pattern's own shape and the one CalendarHeatmap uses on its grid.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svgEl}
  class="map"
  data-testid="login-map"
  viewBox={WORLD_VIEWBOX}
  role="group"
  aria-label={MAP_GROUP_LABEL}
  aria-describedby={hintId}
  onpointerover={onPointerOver}
  onpointermove={onPointerMove}
  onpointerout={onPointerOut}
  onfocusin={onFocusIn}
  onfocusout={onFocusOut}
  onkeydown={onKeyDown}
>
  {#each WORLD_SHAPES as shape (shape.iso)}
    {@const entry = drawnByIso.get(shape.iso)}
    {#if entry !== undefined}
      <!--
        A country with logins: an image with its figures as its name, and the one
        roving tab stop. `role="img"` is not an interactive role, so a tabindex
        on it is flagged; the roving stop is the specified keyboard model, and
        the focus ring is the overlay below.
      -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <path
        class="shape level-{entry.level}"
        d={shape.d}
        role="img"
        tabindex={shape.iso === stopCc ? 0 : -1}
        data-testid="login-country"
        data-iso={shape.iso}
        data-logins={entry.row.logins}
        data-ips={entry.row.ips}
        data-level={entry.level}
        aria-label={formatMapCountryLabel(entry.row.name, entry.row.logins, entry.row.ips)}
      />
    {:else}
      <path class="shape level-0" d={shape.d} aria-hidden="true" />
    {/if}
  {/each}

  <!--
    One marker and one hit circle per tiny country WITH logins, never per login.
    The hit circle is invisible and larger, so a country a few pixels across can
    still be pointed at. Neither carries the country hook: the path is the
    country, and a second hook would double-count it.
  -->
  {#each tinyRows as row (row.cc)}
    {@const shape = SHAPES[row.cc]!}
    {@const entry = drawnByIso.get(row.cc)!}
    <circle
      class="marker level-{entry.level}"
      cx={shape.cx}
      cy={shape.cy}
      r="6"
      data-iso={row.cc}
      aria-hidden="true"
    />
    <circle class="hit" cx={shape.cx} cy={shape.cy} r="10" data-iso={row.cc} aria-hidden="true" />
  {/each}

  <!--
    The ring: a copy of the active shape, drawn last so no later neighbour can
    paint over it. A 3px accent stroke around a 1px white one, both the same
    weight at every scale. Hover and keyboard share it, hover first, and hover is
    never treated as keyboard focus.
  -->
  {#if ringShape !== undefined}
    <path class="ring-outer" d={ringShape.d} aria-hidden="true" />
    <path class="ring-inner" d={ringShape.d} aria-hidden="true" />
  {/if}

  <!-- The keyboard tooltip's zero-size anchor: moved to a centroid, then measured. -->
  {#if centroid !== null}
    <circle
      bind:this={anchorEl}
      class="anchor"
      cx={centroid.cx}
      cy={centroid.cy}
      r="1"
      aria-hidden="true"
    />
  {/if}
</svg>

<!-- The third shared-tooltip instance. `aria-hidden` inside it: every country
     already carries the same two lines as its accessible name. -->
<ChartTooltip request={tip} anchor={tipAnchor} onDismiss={dismiss} testId="map-tooltip" />

<style>
  /* The one SVG in the project that scales to its container: it holds no text,
     so `height: auto` from the viewBox cannot make anything illegible. `display:
     block` removes the inline baseline gap under it. */
  .map {
    display: block;
    width: 100%;
    height: auto;
  }

  /* A country's outline: a 1px hairline that stays 1px at every scale, so a
     295px phone overview and a 638px desktop map draw the same weight. */
  .shape {
    stroke: #dadce0;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  /* The ring is the only focus mark, so the browser's own box around a focused
     country is switched off. */
  .shape:focus {
    outline: none;
  }

  .level-0 {
    fill: var(--ramp-0);
  }
  .level-1 {
    fill: var(--ramp-1);
  }
  .level-2 {
    fill: var(--ramp-2);
  }
  .level-3 {
    fill: var(--ramp-3);
  }
  .level-4 {
    fill: var(--ramp-4);
  }
  .level-5 {
    fill: var(--ramp-5);
  }

  /* The marker for a country too small to see: its own shade and a muted stroke,
     so it reads against both the ocean and a neighbour. */
  .marker {
    stroke: #5f6368;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  /* Invisible but hit-testable: no paint, and the pointer still lands on it. */
  .hit {
    fill: none;
    pointer-events: all;
  }

  .ring-outer,
  .ring-inner,
  .anchor {
    fill: none;
    pointer-events: none;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }

  .ring-outer {
    stroke: #1a73e8;
    stroke-width: 3px;
  }

  .ring-inner {
    stroke: #ffffff;
    stroke-width: 1px;
  }

  /* The anchor is measured and never seen. */
  .anchor {
    stroke: none;
  }
</style>
