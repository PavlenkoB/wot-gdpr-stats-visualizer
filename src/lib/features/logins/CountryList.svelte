<script lang="ts">
  import {
    COUNTRY_COL_COUNTRY,
    COUNTRY_COL_IPS,
    COUNTRY_COL_LOGINS,
    COUNTRY_LIST_NOT_DRAWN_SUFFIX,
    COUNTRY_LIST_SUMMARY,
    LOGIN_UNKNOWN_COUNTRY,
    formatNumber,
  } from '../../ui-copy.ts';
  import type { CountryRow } from './map-model.ts';

  /**
   * The ranked country list (06-12, D-10): every number the map shades, as text.
   *
   * It is the guaranteed route to every value for a country too small to shade,
   * a country with no shape at all, and a reader who cannot see the lightest
   * shades or cannot use a pointer. It is therefore NOT windowed and not
   * collapsed into a "top N": its row count is bounded by the number of
   * countries, which is at most a couple of hundred, and a list that hid the
   * long tail would hide exactly the countries the map cannot show.
   *
   * ## One row per country, and one more for the addresses nobody could place
   *
   * The rows arrive ranked (logins descending, then English name, then code), the
   * same order the keyboard walks and the summary sentence reads. A country with
   * no polygon carries the not-drawn suffix after its name, which is how a reader
   * learns why it has no shade. The final muted row is the unknown-country bucket
   * with its counts, shown whenever any address has no country, so that the
   * drawn rows, the not-drawn rows and this row add up to the logins counted.
   *
   * Rows are not interactive, and the scroller is the one focus stop so its
   * overflow can be reached with the arrow keys.
   */
  interface Props {
    /** Every country with logins, ranked. */
    rows: readonly CountryRow[];
    /** The addresses with no known country, and their logins (D-08). */
    unknown: { addresses: number; logins: number };
  }

  let { rows, unknown }: Props = $props();
</script>

<details class="list" data-testid="country-list">
  <summary>{COUNTRY_LIST_SUMMARY}</summary>
  <!--
    A scrolling region is a keyboard-scrollable box only if it can take focus, so
    it is a focusable `region` with the summary's own words as its name, the same
    pattern as the other secondary tables. The rule fires because `region` is not
    one of the interactive roles.
  -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="scroller" role="region" tabindex="0" aria-label={COUNTRY_LIST_SUMMARY}>
    <table>
      <thead>
        <tr>
          <th scope="col" class="name">{COUNTRY_COL_COUNTRY}</th>
          <th scope="col">{COUNTRY_COL_LOGINS}</th>
          <th scope="col">{COUNTRY_COL_IPS}</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.cc)}
          <tr data-testid="country-row" data-iso={row.cc}>
            <td class="name">
              {row.name}{row.drawn ? '' : COUNTRY_LIST_NOT_DRAWN_SUFFIX}
            </td>
            <td>{formatNumber(row.logins)}</td>
            <td>{formatNumber(row.ips)}</td>
          </tr>
        {/each}
        {#if unknown.addresses > 0}
          <tr class="muted" data-testid="login-unknown-row">
            <td class="name">{LOGIN_UNKNOWN_COUNTRY}</td>
            <td>{formatNumber(unknown.logins)}</td>
            <td>{formatNumber(unknown.addresses)}</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</details>

<style>
  details {
    min-width: 0;
  }

  /* The `<summary>` is a button-looking control and still a `<summary>`: the
     shared control chrome, the 1px `#80868b` border, 6px radius and 8px/12px
     padding of the column picker, with the accent focus ring every interactive
     element carries. */
  summary {
    display: inline-block;
    padding: 8px 12px;
    border: 1px solid #80868b;
    border-radius: 6px;
    background: #ffffff;
    color: #3c4043;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    cursor: pointer;
  }

  summary:hover {
    background: #f1f3f4;
  }

  summary:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  /* The 8px `sm` gap between the summary and the table inside the disclosure.

     Prophylactic (G-07-5): this list's header is `position: sticky` with no
     z-index and paints below the nav's z-index 1 today, so nothing here overlaps
     the nav. `isolation: isolate` keeps the four table scrollers one pattern and
     contains any z-index a header is given later. */
  .scroller {
    isolation: isolate;
    min-width: 0;
    max-height: 320px;
    margin-top: 8px;
    overflow: auto;
  }

  .scroller:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    line-height: 1.4;
  }

  /* Label role, muted, on the header surface. */
  th {
    position: sticky;
    top: 0;
    padding: 8px;
    border-bottom: 1px solid #dadce0;
    background: #f7f7fa;
    color: #5f6368;
    font-size: 14px;
    font-weight: 600;
    text-align: right;
    white-space: nowrap;
  }

  /* Caption role cells, right-aligned with tabular figures so the digits line up
     down a column; the country name is the exception, a label to scan down. */
  td {
    padding: 8px;
    border-bottom: 1px solid #f1f3f4;
    color: #3c4043;
    font-size: 14px;
    font-weight: 400;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  th.name,
  td.name {
    min-width: 0;
    text-align: left;
    font-variant-numeric: normal;
    overflow-wrap: anywhere;
  }

  /* The unknown-country row is a special value, so it reads as one. */
  .muted td {
    color: #5f6368;
  }
</style>
