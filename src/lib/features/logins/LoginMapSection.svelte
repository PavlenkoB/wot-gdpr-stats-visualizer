<script lang="ts">
  import { WORLD_SHAPES } from '../../geo/world-map.generated.ts';
  import AboutDisclosure from '../../charts/AboutDisclosure.svelte';
  import ChartLegend from '../../charts/ChartLegend.svelte';
  import {
    ABOUT_NAME_MAP,
    MAP_ATTRIBUTION_LINK_TEXT,
    MAP_ATTRIBUTION_SUFFIX,
    MAP_HEADING,
    MAP_KEYBOARD_HINT,
    MAP_NO_COUNTRIES,
    formatMapLegendNote,
    formatMapNotDrawn,
    formatMapSummary,
  } from '../../ui-copy.ts';
  import { legendSteps, levelsInUse, mapSummaryArgs, rankCountries } from './map-model.ts';
  import type { LoginCountryTotal } from './login-shared.ts';
  import CountryList from './CountryList.svelte';
  import WorldMap from './WorldMap.svelte';

  /**
   * The "Logins by country" section of the Login history block (06-12,
   * ACTIVITY-06, D-08..D-11).
   *
   * It takes the per-country tallies the aggregate already holds, the unknown
   * bucket and the counted total, plus the name function, and composes the
   * heading, the summary sentence, the map, its legend, the attribution and the
   * ranked list. It is handed no address: every figure here is a count, so
   * nothing it renders can carry one.
   *
   * ## What every shade is backed by
   *
   * The lightest steps of the ramp sit below the 3:1 non-text floor on white by
   * design, so a shade is never the only carrier of a value. The summary
   * sentence names the leader, the legend note states every step in words, each
   * country's accessible name and tooltip give its two figures, and the list
   * gives every number as table text.
   *
   * ## The sums that hold at every size
   *
   * Drawn countries, countries with no shape and the unknown-country row add up
   * to the logins counted, because the aggregate tallies capped addresses too
   * (the recorded cap outcome). `totalLogins` is that counted total and is also
   * the denominator of the Top country tile, so the share in the sentence and the
   * share on the tile cannot disagree.
   */
  interface Props {
    /** Every country with logins, as the view carries them. */
    countries: readonly LoginCountryTotal[];
    /** The addresses with no known country, and their logins. */
    unknown: { addresses: number; logins: number };
    /** Every counted login, resolved or not. */
    totalLogins: number;
    /** The English name of a code, or null (06-06's guarded `countryName`). */
    nameOf: (cc: string) => string | null;
  }

  let { countries, unknown, totalLogins, nameOf }: Props = $props();

  /** The keyboard hint's id, so the map group can be described by it. */
  const hintId = $props.id();

  /**
   * The codes the generated map has a polygon for.
   *
   * "Drawn" means the module HOLDS a shape for the code, never "absent from the
   * undrawable list": the two are the same today, and only one of them is the
   * fact the map depends on.
   */
  const DRAWABLE: ReadonlySet<string> = new Set(WORLD_SHAPES.map((shape) => shape.iso));

  const rows = $derived(rankCountries(countries, nameOf, DRAWABLE));

  /** The top of the shading scale: the largest per-country count, drawn or not. */
  const max = $derived(rows.reduce((top, row) => Math.max(top, row.logins), 0));

  /** The shades the drawn countries actually use. */
  const levels = $derived(levelsInUse(rows, max));

  /** The legend: level 0, then the levels in use, and the note that states the steps. */
  const legendLevels = $derived([0, ...levels]);
  const legendNote = $derived(formatMapLegendNote(legendSteps(max, levels)));

  const summary = $derived(mapSummaryArgs(rows, totalLogins, unknown));

  /** How many countries with logins have no shape, for the line under the legend. */
  const notDrawn = $derived(rows.filter((row) => !row.drawn).length);
</script>

<section class="map-section" data-testid="login-map-section">
  <h4>{MAP_HEADING}</h4>
  {#if summary.args === null}
    <p class="body" data-testid="login-map-summary">{MAP_NO_COUNTRIES}</p>
  {:else}
    <p class="body" data-testid="login-map-summary" data-form={summary.form}>
      {formatMapSummary(...summary.args)}
    </p>
    <AboutDisclosure name={ABOUT_NAME_MAP} testId="about-map">
      <p class="caption" id={hintId}>{MAP_KEYBOARD_HINT}</p>
    </AboutDisclosure>
    <div class="frame" data-testid="login-map-frame">
      <WorldMap {rows} {max} {hintId} />
    </div>
    <ChartLegend levels={legendLevels} note={legendNote} testId="map-legend" />
    <p class="caption" data-testid="map-attribution">
      <a
        href="https://db-ip.com"
        target="_blank"
        rel="noreferrer noopener"
        data-testid="map-attribution-link">{MAP_ATTRIBUTION_LINK_TEXT}</a
      >{MAP_ATTRIBUTION_SUFFIX}
    </p>
    {#if notDrawn > 0}
      <p class="caption" data-testid="map-not-drawn">{formatMapNotDrawn(notDrawn)}</p>
    {/if}
    <CountryList {rows} {unknown} />
  {/if}
</section>

<style>
  /* The section's own column: the h4, its sentence and its graphic sit 8px apart
     (the `sm` step), and the block's 24px gap separates the section from the
     table above it. */
  .map-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  /* Label role in the chart-title colour: the same rule as every other h4 in the
     block. Scoped styles cannot be shared, and a copy that drifts is worse than
     a copy that is visible. */
  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
  }

  /* Body role: the summary sentence is the text equivalent of the map. */
  .body {
    margin: 0;
    min-width: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text);
    overflow-wrap: anywhere;
  }

  /* Caption role: the hint, the attribution and the not-drawn line. */
  .caption {
    margin: 0;
    min-width: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  /* The frame: a hairline border and the tile radius around a white ocean. No
     padding, so the map fills the card's inner width. */
  .frame {
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
  }

  /* The attribution link: a link needs a non-colour affordance, so it is
     underlined, in the body-text colour with no hover change; the accent is for
     the focus ring alone. */
  a {
    color: var(--text);
    text-decoration: underline;
  }

  a:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
