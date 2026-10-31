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
  <div class="scroller list-scroll" role="region" tabindex="0" aria-label={CITY_LIST_SUMMARY}>
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
    <p class="caption after-list" data-testid="city-more">
      {formatCityMoreCities(view.moreCities)}
    </p>
  {/if}
  {#if view.noCityAddresses > 0}
    <p class="caption after-list" data-testid="city-no-city">
      {formatCityNoCity(view.noCityAddresses)}
    </p>
  {/if}
</details>

<style>
  details {
    min-width: 0;
  }

  summary {
    display: inline-block;
    padding: var(--space-8) var(--space-12);
    border: 1px solid var(--faint);
    border-radius: var(--radius-sm);
    background: var(--page);
    color: var(--text);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    cursor: pointer;

    &:hover {
      background: var(--hover);
    }

    &:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
  }

  /* The shared `.scroller` utility in `src/styles/utilities.css` is the
     region: `min-width: 0`, `overflow: auto`, `isolation: isolate` and the
     focus ring.

     Prophylactic (G-07-5): this list's header is `position: sticky` with no
     z-index and paints below the nav's z-index 1 today, so nothing here
     overlaps the nav. The isolation keeps the four table scrollers one pattern
     and contains any z-index a header is given later.

     The list's own box - the 320px cap and the 8px gap under the summary - is
     this file's business, not the region's, so it is the hook's. */
  .list-scroll {
    max-height: 320px;
    margin-top: var(--space-8);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-body);
    line-height: var(--lh-tight);
  }

  th {
    position: sticky;
    top: 0;
    padding: var(--space-8);
    border-bottom: 1px solid var(--border);
    background: var(--list);
    color: var(--muted);
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    text-align: right;
    white-space: nowrap;
  }

  td {
    padding: var(--space-8);
    border-bottom: 1px solid var(--hover);
    color: var(--text);
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* The name columns read as text, not as figures. The rule is a LIST of two
     selectors, so it stays top-level: a list can neither extend a sibling nor
     be extended by one (the same rule plan 14-10 settled for the playtime
     summary's `th:last-child, td:last-child`). */
  th.name,
  td.name {
    min-width: 0;
    text-align: left;
    font-variant-numeric: normal;
    overflow-wrap: anywhere;
  }

  /* The two captions under the list sit 8px below it. The shared `.caption`
     states the rest, so the hook states only this one difference. */
  .after-list {
    margin-top: var(--space-8);
  }
</style>
