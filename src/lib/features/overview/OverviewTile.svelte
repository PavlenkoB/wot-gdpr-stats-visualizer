<script lang="ts">
  import {
    OVERVIEW_HOW_HEADING,
    OVERVIEW_READS_HEADING,
    OVERVIEW_TILE_COPY,
    formatOpenSectionLink,
    formatStarLabel,
  } from '../../ui-copy.ts';
  import { setViewTransitionName, spans } from './overview-dom.ts';
  import type { OverviewTileDef } from './overview-definitions.ts';
  import type { TileFace } from './overview-format.ts';
  import type { OverviewGroupId, OverviewReadyTile } from './overview-shared.ts';
  import OverviewBars from './OverviewBars.svelte';
  import OverviewRows from './OverviewRows.svelte';

  /**
   * One Overview tile: the face, the star and the expanded panel (13-09,
   * D-13, D-15, D-16, D-17; 13-UI-SPEC Tile Anatomy).
   *
   * ## The anatomy
   *
   * A wrapper `div` holds three siblings:
   *
   *   1. the FACE, one `button` with `aria-expanded` whose content is phrasing
   *      only (spans with `display: block`, an `aria-hidden` chart, a visually
   *      hidden summary). A `div`, a `role="img"` or a heading inside a button
   *      is invalid content, so none is used;
   *   2. the STAR, a SIBLING `button` laid over the wrapper's top-right corner.
   *      It is never nested in the face: a button inside a button is invalid
   *      and a click on it would also toggle the tile;
   *   3. the PANEL, only while the tile is open: how the figure is computed,
   *      what it reads, and the link into the full pane.
   *
   * ## What this component does NOT do
   *
   * It draws and reports. Expanding, the keyboard, pinning and the motion
   * belong to the page that owns the state (OverviewBento), and arrive here as
   * props and callbacks. Nothing in this file reads storage, the worker or
   * the DOM.
   *
   * ## Colour
   *
   * Only two things on the tile are coloured: the group dot beside the label
   * and the amber star of a pinned tile. The dot is decorative; the label next
   * to it is the meaning. Charts use the value scale, never a group colour.
   *
   * ## Spans reach the DOM through the CSSOM
   *
   * The fill rule's extra spans are written by the `spans` action with
   * `style.setProperty`. A `style` attribute or a `style:` directive would be
   * refused by the page's CSP, and `svelte/no-inline-styles` refuses it here.
   */
  interface Props {
    /** The READY tile (only its id is read; the face is already built). */
    tile: OverviewReadyTile;
    /** The tile's catalogue definition: its size, group and pane. */
    def: OverviewTileDef;
    /** Everything the tile prints, from `tileFace`. */
    face: TileFace;
    /** The tile's label. */
    label: string;
    /**
     * The group the tile is drawn in. A pinned tile keeps the dot of its own
     * catalogue group, so `pinned` falls back to `def.group`.
     */
    groupId: 'pinned' | OverviewGroupId;
    /** Whether the tile is pinned (the star's pressed state). */
    pinned: boolean;
    /** Whether the panel is open. */
    open: boolean;
    /** Whether this is the grid's one tabbable tile (roving tabindex). */
    tabbable: boolean;
    /** The fill rule's extra spans for this tile. */
    spans: { c4: number; r4: number; c2: number };
    /** The title of the pane the "Open" link goes to. */
    paneTitle: string;
    /** The face was activated. */
    onToggle: () => void;
    /** The star was activated. */
    onPin: () => void;
    /** The "Open" link was activated. */
    onOpen: () => void;
  }

  let {
    tile,
    def,
    face,
    label,
    groupId,
    pinned,
    open,
    tabbable,
    spans: fill,
    paneTitle,
    onToggle,
    onPin,
    onOpen,
  }: Props = $props();

  /**
   * Name the wrapper for the View Transitions API (13-12). Every tile is named
   * and tile ids are unique, so no two elements share a name; the name is
   * cleared when the tile leaves the page.
   */
  function transitionName(node: HTMLElement, id: string) {
    setViewTransitionName(node, `ov-${id}`);
    return {
      update(next: string): void {
        setViewTransitionName(node, `ov-${next}`);
      },
      destroy(): void {
        setViewTransitionName(node, null);
      },
    };
  }

  const copy = $derived(OVERVIEW_TILE_COPY[tile.id]);

  /** The dot's group: a pinned tile keeps the colour of its own group. */
  const dotGroup = $derived(groupId === 'pinned' ? def.group : groupId);

  const panelId = $derived(`ov-detail-${tile.id}`);

  /** A hero whose value is short enough sets it as the large numeral. */
  const numeral = $derived(def.size === 'hero' && face.numeral);
</script>

<div
  class="tile {def.size} g-{dotGroup}"
  class:open
  data-testid="ov-tile-{tile.id}"
  data-tile-id={tile.id}
  use:spans={fill}
  use:transitionName={tile.id}
>
  <button
    type="button"
    class="face"
    data-testid="ov-tile-button-{tile.id}"
    data-tile-id={tile.id}
    aria-expanded={open}
    aria-controls={open ? panelId : undefined}
    aria-keyshortcuts="p"
    tabindex={tabbable ? 0 : -1}
    onclick={onToggle}
  >
    <span class="k t-label"><span class="dot" aria-hidden="true"></span>{label}</span>
    <span class="figure">
      <span class="v" class:numeral class:t-stat={!numeral} class:t-hero={numeral}
        >{face.value}</span
      >
      {#if face.unit !== null}<span class="unit t-body">{face.unit}</span>{/if}
    </span>
    <span class="rule t-caption">{face.rule}</span>
    {#if face.chart !== null}
      {#if face.chart.kind === 'rows'}
        <OverviewRows rows={face.chart.rows} />
      {:else}
        <OverviewBars
          kind={face.chart.kind}
          bars={face.chart.bars}
          peakLabel={face.chart.peakLabel}
        />
      {/if}
    {/if}
    {#if face.summary !== ''}<span class="sr">{face.summary}</span>{/if}
  </button>
  <button
    type="button"
    class="star"
    class:on={pinned}
    data-testid="ov-star-{tile.id}"
    aria-pressed={pinned}
    aria-label={formatStarLabel(label)}
    tabindex="-1"
    onclick={onPin}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  </button>
  {#if open}
    <div class="panel" id={panelId} data-testid="ov-tile-detail-{tile.id}">
      <p class="heading t-label">{OVERVIEW_HOW_HEADING}</p>
      <p class="how t-body">{copy.how}</p>
      <p class="heading t-label">{OVERVIEW_READS_HEADING}</p>
      <p class="reads t-caption">{copy.reads} · {copy.file}</p>
      <button
        type="button"
        class="link t-body"
        data-testid="ov-tile-open-{tile.id}"
        onclick={onOpen}
      >
        {formatOpenSectionLink(paneTitle)}
      </button>
    </div>
  {/if}
</div>

<style>
  .tile {
    position: relative;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    box-shadow: var(--elev-rest);
    transition: box-shadow 0.15s ease;
  }

  @media (hover: hover) {
    .tile:hover {
      box-shadow: var(--elev-hover);
    }
  }

  /* Open: the edge turns to ink and a second hairline inside it makes the
     two-pixel edge without moving the layout by a pixel. */
  .tile.open,
  .tile.open:hover {
    border-color: var(--ink);
    outline: 1px solid var(--ink);
    outline-offset: -2px;
    box-shadow: var(--elev-open);
  }

  /* While the face holds the keyboard focus, the focus ring replaces the ink
     outline: two outlines on one edge would read as noise. */
  .tile.open:has(.face:focus-visible),
  .tile.open:has(.star:focus-visible) {
    outline: none;
  }

  .face {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: var(--space-16);
    border: 0;
    border-radius: 8px;
    background: none;
    color: inherit;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .face:focus-visible,
  .star:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }

  /* Everything inside the face is a span set to block: a button holds phrasing
     content only. */
  .k,
  .rule {
    display: block;
    min-width: 0;
  }

  .k {
    padding-right: var(--layout-section);
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  /* A metric's label reserves two lines, so a label that wraps ("Most damage,
     one battle") does not push its figure below the figures of the tiles beside
     it in the same row. */
  .met .k {
    min-height: calc(2 * 1.4em);
  }

  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: var(--space-4);
    border-radius: 50%;
    vertical-align: 1px;
  }

  .g-time .dot {
    background: var(--ov-time);
  }

  .g-tanks .dot {
    background: var(--ov-tanks);
  }

  .g-records .dot {
    background: var(--ov-records);
  }

  .g-totals .dot {
    background: var(--ov-totals);
  }

  .figure {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-4);
    min-width: 0;
    margin: var(--space-8) 0 var(--space-4);
  }

  /* Display size. A long text value keeps this size and wraps; nothing is
     shrunk and nothing is cut. The size, the weight and the line height are the
     Stat role's, and the large numeral takes the Hero role instead - both are
     applied in the markup, so only one of them is ever on the element. */
  .v {
    display: block;
    min-width: 0;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .unit {
    display: block;
    color: var(--muted);
  }

  .rule {
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  /* The chart summary is for assistive technology only. */
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .star {
    position: absolute;
    top: 2px;
    right: 2px;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    cursor: pointer;

    & svg {
      display: block;
    }

    & path {
      fill: none;
      stroke: var(--faint);
      stroke-width: 1.5;
      stroke-linejoin: round;
    }

    &.on path {
      fill: var(--ov-star-fill);
      stroke: var(--ov-star-stroke);
    }
  }

  @media (hover: hover) {
    .star:hover {
      background: var(--hover);
    }
  }

  .panel {
    margin: 0 var(--space-16) var(--space-16);
    padding-top: var(--space-12);
    border-top: 1px solid var(--border);
  }

  .heading {
    margin: var(--space-8) 0 0;
    color: var(--muted);

    &:first-child {
      margin-top: 0;
    }
  }

  .how {
    margin: var(--space-4) 0 0;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .reads {
    margin: var(--space-4) 0 0;
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  .link {
    display: inline-block;
    min-height: 44px;
    margin: var(--space-4) 0 0;
    padding: 0;
    border: 0;
    background: none;
    font-family: inherit;
    color: var(--ink);
    text-align: left;
    text-decoration: underline;
    cursor: pointer;

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }

  /* Columns follow the Overview root's width, not the viewport. The root is the
     container; a tile is placed in a grid that sets the column count at the
     same two widths. Below 480px every span is auto and the grid is one
     column. */
  @container (max-width: 479.98px) {
    .hero,
    .feat,
    .met {
      grid-column: auto;
      grid-row: auto;
    }
  }

  @container (min-width: 480px) and (max-width: 879.98px) {
    .hero {
      grid-column: span 2;
      grid-row: span 2;
    }

    .feat {
      grid-column: span calc(2 + var(--span2, 0));
    }

    .met {
      grid-column: span calc(1 + var(--span2, 0));
    }
  }

  @container (min-width: 880px) {
    .hero {
      grid-column: span calc(2 + var(--span4, 0));
      grid-row: span calc(2 + var(--rows4, 0));
    }

    .feat {
      grid-column: span calc(2 + var(--span4, 0));
    }

    .met {
      grid-column: span calc(1 + var(--span4, 0));
    }
  }

  @media (forced-colors: active) {
    /* Shadows are dropped, so the border keeps the tile's edge; the dot, the
       star and the face get a visible system-colour outline. */
    .tile {
      border: 1px solid CanvasText;
    }

    .dot {
      outline: 1px solid CanvasText;
      background: CanvasText;
    }

    .face {
      outline: 1px solid CanvasText;
      outline-offset: -1px;
    }

    .star {
      outline: 1px solid CanvasText;
      outline-offset: -1px;

      & path {
        stroke: CanvasText;
      }

      &.on path {
        fill: Highlight;
        stroke: CanvasText;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile {
      transition: none;
    }
  }
</style>
