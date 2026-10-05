/**
 * The shapes the opt-in city tier exchanges (phase 06, ACTIVITY-07, D-13,
 * D-14, D-15, D-16, UI-SPEC section 5).
 *
 * ## Why this module is PURE and sits beside `login-shared.ts`
 *
 * Exactly the same rule `login-shared.ts` states, and for the same reason: the
 * worker builds the view and the main thread renders it, and neither may need
 * the other's environment. No imports, no `Date`, no worker globals, no
 * `Intl`. A block can read {@link MAX_CITY_LIST} and the type of a place
 * without importing the worker, Dexie or the range table.
 *
 * ## Why a VIEW and not the addresses (T-06-35)
 *
 * The reply carries place STRINGS, two counts and one index per listed
 * address — and no address of its own. The addresses the index is aligned to
 * were already sent to the main thread by the `logins` channel, so echoing
 * them would add nothing, and a reply that carried a new address would be a
 * reply that could leak one. Nothing here can hold a full address: there is no
 * field for it.
 *
 * ## Why the addresses are ALIGNED rather than keyed
 *
 * `placeOf[i]` is the city of the i-th entry of the logins view's `addresses`,
 * or -1. Alignment is what lets the table render a city cell per row without
 * the worker re-sending an address list and the main thread re-deriving an
 * index — two chances for the two lists to disagree. The alignment is the
 * logins view's ORDER, which is a stored order (logins descending, then
 * address by code units), so it is the same for every consumer.
 */

/** How many places the ranked list carries, however many exist. */
export const MAX_CITY_LIST = 50;

/**
 * One city, split out of the container's `CC\tState\tCity` place string.
 *
 * `state` and `city` are empty strings rather than null for "the database has
 * no value here": DB-IP publishes rows with a country and no city name, and
 * D-16 renders those as the COUNTRY alone. A null would have to be rendered as
 * "unknown", which is a different sentence about a different fact.
 */
export interface CityPlace {
  /** The two-letter country code, upper case as the source wrote it. */
  cc: string;
  /** The state, subdivision or region, or empty when the source had none. */
  state: string;
  /** The city name, or empty when the source had none. */
  city: string;
}

/**
 * One row of the ranked city list (D-16): `(city, country, logins)`.
 *
 * `place` is an INDEX into {@link CityView.places}, not a copy of the place,
 * so fifty rows carry fifty small numbers rather than fifty strings — and so a
 * consumer cannot show two spellings of one place.
 */
export interface CityRankedPlace {
  readonly place: number;
  /** Counted login rows behind this place, summed over its addresses. */
  readonly logins: number;
  /** How many of the dataset's listed addresses sit in this place. */
  readonly ips: number;
}

/**
 * Everything the city tier tells the main thread about the current dataset.
 *
 * The view is only ever built for the addresses the logins view LISTS, so a
 * dataset past `MAX_LOGIN_IPS` is represented by the addresses already on
 * screen and nothing here re-derives the ones past the cap.
 */
export interface CityView {
  /** The source month the container carries, `YYYY-MM`. */
  readonly month: string;
  /**
   * The places this dataset actually resolved to, in first-use order.
   *
   * NOT the container's whole place table: the real table holds about 194,000
   * places and a dataset uses a handful, so only the used ones are carried
   * across. `placeOf` and every {@link CityRankedPlace.place} index into THIS
   * array, never into the container's ids.
   */
  readonly places: readonly CityPlace[];
  /**
   * One entry per listed address, in the logins view's order: the index into
   * {@link places}, or -1 when the city database has no usable record for it.
   */
  readonly placeOf: readonly number[];
  /** The top {@link MAX_CITY_LIST} places, logins descending. */
  readonly ranked: readonly CityRankedPlace[];
  /** Distinct places that did not fit the list, so the copy can say how many. */
  readonly moreCities: number;
  /**
   * Addresses the database placed in a country but gave no city name.
   *
   * Counted, not listed: a row for such an address renders as its country
   * alone, which is a real answer rather than a missing one, and the count is
   * what lets the copy say how many there were.
   */
  readonly noCityAddresses: number;
}

/**
 * The one thing {@link CityView} is built from, per listed address.
 *
 * Structurally satisfied by `LoginAddress`, and declared here rather than
 * imported so the geo module names the two facts it needs instead of the whole
 * login shape. `cc` is what makes "an address with no country is not ranked"
 * decidable: a country the account's own table could not name is not a place
 * the city table gets to invent.
 */
export interface CityAddressInput {
  readonly ip: string;
  readonly cc: string | null;
  /**
   * How many counted login rows carried this address, from the logins
   * aggregate. The city view never counts rows itself — it sums the numbers
   * the login aggregator already derived, so a city's logins total is the
   * same number the login table would show for those rows.
   */
  readonly logins: number;
}
