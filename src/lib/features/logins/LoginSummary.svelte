<script lang="ts">
  import {
    LOGIN_HIDDEN_NO_KNOWN_COUNTRY,
    LOGIN_HIDDEN_NO_READABLE_DATES,
    LOGIN_MULTI_FILE_NOTE,
    LOGIN_NO_VALUE,
    LOGIN_TILE_COUNTRIES,
    LOGIN_TILE_IPS,
    LOGIN_TILE_RANGE,
    LOGIN_TILE_TOP_COUNTRY,
    LOGIN_TILE_TOP_IP,
    LOGIN_TILE_UNKNOWN,
    formatLoginDateRange,
    formatLoginShareLine,
    formatNumber,
  } from '../../ui-copy.ts';
  import { displayIp, type LoginTileFacts } from './login-model.ts';

  /**
   * The six summary tiles, and the one note that explains the totals (D-04,
   * D-08; D-01, RESEARCH Pitfall 11).
   *
   * ## Numbers arrive; words are `ui-copy`'s
   *
   * `LoginSummary` holds the LAYOUT, the test ids and the three null branches.
   * Every figure comes from `loginTiles` and every sentence from the exports
   * plan 06-02 settled, so the tiles here and the strings in `ui-copy` cannot
   * drift and this file contains no prose of its own.
   *
   * ## Two tile variants, one chrome
   *
   * The count tiles carry a Display-size numeral; the fact tiles carry a
   * Heading-size value, because a revealed IPv6 address is 39 characters and a
   * Display numeral would wrap it mid-token at tile width. The chrome around
   * them is the Phase 4 Playtime tile, value for value, and the two grids
   * differ only in their minimum track: 128px so three counts fit a 638px card,
   * 200px so a masked IPv4 fits on one line inside a fact tile.
   *
   * ## The three dashes
   *
   * A dash with hidden text, per the UI-SPEC's Special values row, so a screen
   * reader hears WHY rather than only that something is absent:
   *
   *   - `Top country`, when no address resolved to a country (D-08);
   *   - `First to last login`, when no row carried a usable timestamp;
   *   - `Most-used IP address`, which is UNREACHABLE and carries no hidden text
   *     for that reason. A `ready` view exists because at least one row was
   *     readable, and every readable row created an address entry, so
   *     `topIp` cannot be null here. The branch exists to satisfy the type
   *     rather than because a reader can reach it, and a dash with a hidden
   *     explanation of a case that cannot happen would be a sentence about
   *     nothing.
   */
  interface Props {
    /** The figures, from `loginTiles` for this dataset's view. */
    tiles: LoginTileFacts;
    /** The block's single mask flag. Never a prop of its own, never persisted. */
    revealed: boolean;
  }

  let { tiles, revealed }: Props = $props();

  /**
   * The range string, or null when either end is missing.
   *
   * `formatLoginDateRange` returns `null` rather than a dash precisely so the
   * CHOICE of what to show in its place is made here, beside the hidden text
   * that explains it.
   */
  const range = $derived(formatLoginDateRange(tiles.first, tiles.last));
</script>

<!--
  One flex column at 16px: the two grids and the multi-file note are three
  parts of ONE summary under ONE heading, and the block's 24px gaps are the
  gaps between sub-blocks one level up.
-->
<div class="summary login-summary">
  <!--
    `auto-fit` with a 128px minimum is what makes the count tiles wrap to two
    per row at 375px rather than overflow, and `min-width: 0` lets a track
    shrink to that minimum instead of widening the card. What happens INSIDE a
    tile is the `dd` rule's business, not the grid's.
  -->
  <dl data-testid="login-summary-counts">
    <div class="tile">
      <dt class="t-note-strong">{LOGIN_TILE_IPS}</dt>
      <dd class="t-display" data-testid="login-tile-ips">{formatNumber(tiles.ips)}</dd>
    </div>
    <div class="tile">
      <dt class="t-note-strong">{LOGIN_TILE_COUNTRIES}</dt>
      <dd class="t-display" data-testid="login-tile-countries">{formatNumber(tiles.countries)}</dd>
    </div>
    <div class="tile">
      <dt class="t-note-strong">{LOGIN_TILE_UNKNOWN}</dt>
      <dd class="t-display" data-testid="login-tile-unknown">{formatNumber(tiles.unknownIps)}</dd>
    </div>
  </dl>

  <!--
    D-01's note, and only when it applies. It sits BETWEEN the two grids
    because the UI-SPEC puts it under the COUNT tiles: the counts are the
    figures the note is about, and a reader meets the number and the reason for
    it before the prose tiles below.

    `multiFile` is a figure, not a template condition, so "does the note belong
    here" is a value with a unit test rather than an expression in a markup
    file no test in this repository can render.
  -->
  {#if tiles.multiFile}
    <p class="muted-note" data-testid="login-multi-file-note">{LOGIN_MULTI_FILE_NOTE}</p>
  {/if}

  <dl data-testid="login-summary-facts">
    <div class="tile">
      <dt class="t-note-strong">{LOGIN_TILE_TOP_IP}</dt>
      <!--
        The ONE place this surface chooses an address string: `displayIp` with
        the block's single mask flag. Never the raw `ip`, never a CSS toggle
        over two strings (D-07, T-06-28).
      -->
      <dd data-testid="login-tile-top-ip" class="fact t-heading">
        {#if tiles.topIp !== null}
          {displayIp(tiles.topIp, revealed)}
        {:else}
          {LOGIN_NO_VALUE}
        {/if}
      </dd>
      {#if tiles.topIp !== null}
        <p class="muted-note" data-testid="login-tile-top-ip-share">
          {formatLoginShareLine(tiles.topIp.logins, tiles.totalLogins)}
        </p>
      {/if}
    </div>

    <div class="tile">
      <dt class="t-note-strong">{LOGIN_TILE_TOP_COUNTRY}</dt>
      <dd data-testid="login-tile-top-country" class="fact t-heading">
        {#if tiles.topCountry !== null}
          {tiles.topCountry.name}
        {:else}
          {LOGIN_NO_VALUE}
          <span class="hidden">{LOGIN_HIDDEN_NO_KNOWN_COUNTRY}</span>
        {/if}
      </dd>
      {#if tiles.topCountry !== null}
        <p class="muted-note" data-testid="login-tile-top-country-share">
          {formatLoginShareLine(tiles.topCountry.logins, tiles.totalLogins)}
        </p>
      {/if}
    </div>

    <div class="tile">
      <dt class="t-note-strong">{LOGIN_TILE_RANGE}</dt>
      <dd data-testid="login-tile-range" class="fact t-heading">
        {#if range !== null}
          {range}
        {:else}
          {LOGIN_NO_VALUE}
          <span class="hidden">{LOGIN_HIDDEN_NO_READABLE_DATES}</span>
        {/if}
      </dd>
    </div>
  </dl>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
  }

  /*
    Two grids, one chrome. The fact grid's 200px minimum is derived from the
    longest value it has to hold: a masked IPv4 at Heading size is about 153px,
    and 200px minus the tile's 2 x 16px padding leaves 168px for it. Three fit a
    638px card; one fits a 295px phone column.
  */
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
    gap: var(--space-16);
    margin: 0;
    min-width: 0;

    &[data-testid='login-summary-facts'] {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
  }

  /* The Phase 4 Playtime tile, value for value: `dt` above `dd`, 4px apart,
     16px of padding, the muted label and the near-black value. */
  .tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-16);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--list);
    min-width: 0;
  }

  dt {
    color: var(--muted);
  }

  /* Display role for a count numeral. A grouped number is not untrusted text
     and never wraps mid-token, so this tile does not take `anywhere`.

     The role owns the size, the weight and the line height, so this rule does
     not declare them: the phone block's `.shell .login-summary dd` rule in
     `src/styles/shell.css` outranks the role and sets 18px at 375px, which is why the
     rule stays top-level and un-nested (D-08). */
  dd {
    margin: 0;
    min-width: 0;
    color: var(--ink);

    /*
      Heading role for a fact value — a masked or revealed address, a country
      name, a date range. Heading rather than Display so an address never wraps
      mid-token at tile width, and `anywhere` so a full IPv6 wraps INSIDE the
      tile rather than widening it (06-UI-SPEC section 12).
    */
    &.fact {
      overflow-wrap: anywhere;
    }
  }

  /*
    The hidden replacement for a dash. The clip pattern, not `display: none`:
    a dash alone tells a screen-reader user that nothing is there and not why,
    and the two dash cases here are different facts. It is clipped rather than
    out of flow for the same reason the Phase 3 nav suffixes are not clipped —
    an out-of-flow descendant makes Chromium insert a separator into a name
    computed from content.
  */
  .hidden {
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
