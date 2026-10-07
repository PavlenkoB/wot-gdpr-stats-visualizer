<script lang="ts">
  import {
    CITY_COL_CITY,
    CITY_COL_COUNTRY,
    CITY_COL_IPS,
    CITY_COL_LOGINS,
    CITY_LIST_SUMMARY,
    formatCityMoreCities,
    formatCityNoCity,
    formatNumber,
  } from '../../ui-copy.ts';
  import type { CityView } from './city-shared.ts';
  import { cityPlaceText } from './login-model.ts';

  /**
   * The ranked city list (06-13, D-16): where the logins came from, place by
   * place, once the user has loaded city detail.
   *
   * ## Bounded by construction
   *
   * The worker caps the ranked places at `MAX_CITY_LIST` (50) and counts the rest
   * in `moreCities`, so this component draws at most that many rows however many
   * places the export maps to. The one place in this phase whose node count would
   * follow the data is therefore the one that is cut, and the caption says how
   * many were left out rather than letting the list claim to be whole.
   *
   * ## What it can show
   *
   * A place string, a country name and two counts. The view carries no address
   * and no account value, so there is nothing here for the mask to hide.
   * Addresses the database placed in a country but gave no city are counted, not
   * listed, and addresses with no country are in neither: a country the account's
   * own table could not name is not a place the city table gets to invent.
   */
  interface Props {
    /** The loaded city view for the dataset on screen. */
    view: CityView;
    /** English country name for a code, or null (the shared guarded function). */
    nameOf: (cc: string) => string | null;
  }

  let { view, nameOf }: Props = $props();
</script>

<details class="list" open data-testid="city-list">
  <summary>{CITY_LIST_SUMMARY}</summary>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="scroller" role="region" tabindex="0" aria-label={CITY_LIST_SUMMARY}>
    <table>
      <thead>
        <tr>
          <th scope="col" class="name">{CITY_COL_CITY}</th>
          <th scope="col" class="name">{CITY_COL_COUNTRY}</th>
          <th scope="col">{CITY_COL_LOGINS}</th>
          <th scope="col">{CITY_COL_IPS}</th>
        </tr>
      </thead>
      <tbody>
        {#each view.ranked as row (row.place)}
          {@const place = view.places[row.place]}
          {#if place !== undefined}
            <tr data-testid="city-row">
              <td class="name">{cityPlaceText(place)}</td>
              <td class="name">{nameOf(place.cc) ?? place.cc}</td>
              <td>{formatNumber(row.logins)}</td>
              <td>{formatNumber(row.ips)}</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
  {#if view.moreCities > 0}
    <p class="caption" data-testid="city-more">{formatCityMoreCities(view.moreCities)}</p>
  {/if}
  {#if view.noCityAddresses > 0}
    <p class="caption" data-testid="city-no-city">{formatCityNoCity(view.noCityAddresses)}</p>
  {/if}
</details>

<style>
  details {
    min-width: 0;
  }

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

  /* Prophylactic (G-07-5): this list's header is `position: sticky` with no
     z-index and paints below the nav's z-index 1 today, so nothing here overlaps
     the nav. The isolation keeps the four table scrollers one pattern and
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

  .caption {
    margin: 8px 0 0;
    min-width: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
    overflow-wrap: anywhere;
  }
</style>
