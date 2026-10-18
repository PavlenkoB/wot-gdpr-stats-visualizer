<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { SpendCard, SpendView } from './finance-shared.ts';
  import type { QueryClient } from '../../core/query-client.ts';
  import type { ShownBlock } from './finance-state.ts';
  import type { ClassifyResult } from '../../core/types/worker-messages.ts';
  import { acceptDataOutcome, deriveFinanceState } from './finance-state.ts';
  import { parseUnitsString } from '../../core/decimal.ts';
  import ExcludedNotice from '../../shell/ExcludedNotice.svelte';
  import AccountTag from '../../shell/AccountTag.svelte';
  import { accountCountOf, accountTagsFor, tagLabel } from '../../shell/identity-model.ts';
  import {
    FINANCE_COMBINED_NOTE,
    HEADER_ACCOUNT,
    SPEND_BLANK_GAME,
    SPEND_BREAKDOWN_DISCLOSURE,
    SPEND_BREAKDOWN_HEADERS,
    SPEND_BY_GAME,
    SPEND_BY_YEAR,
    SPEND_ERROR,
    SPEND_EXCLUDED_EXPLANATION,
    SPEND_HEADING,
    SPEND_INTRO,
    SPEND_LABEL_FAILED,
    SPEND_LABEL_NEW,
    SPEND_LABEL_OTHER,
    SPEND_LOADING,
    SPEND_NO_USABLE,
    SPEND_PER_ACCOUNT_SUMMARY,
    SPEND_UNKNOWN_YEAR,
    UNKNOWN_CURRENCY_CAPTION,
    UNKNOWN_CURRENCY_HEADING,
    formatGiftLine,
    formatMoney,
    formatNumber,
    formatPaidExcludedPill,
    formatPaidOrders,
  } from '../../ui-copy.ts';

  /**
   * The Real-money spend sub-block of the Payment_history card (05-15,
   * FINANCE-03).
   *
   * The Premium and Virtual currency sub-heading and its stylesheet rule are
   * repeated here in full rather than shared: Svelte's scoped styles cannot
   * cross two files, and the copy is deliberately visible so a change to one
   * that misses the other is visible in a diff rather than silent.
   *
   * ## The one rule this block exists to hold
   *
   * **Nothing on this page may ever add two currencies together** (D-21, D-24,
   * FINANCE-03's roadmap criterion 4). There is no such field on `SpendCard`
   * — the worker never computes one — so the guarantee is structural rather
   * than arithmetic: each card is a closed box whose every figure sums rows of
   * ONE currency group, and the unit-less group is drawn as something that is
   * explicitly NOT a currency.
   *
   * That is also why the cards are the unit of the whole design. There is no
   * "total spend" line above them, no page footer with a grand figure, and no
   * cross-currency caption: a reader who wants "how much did I spend" reads one
   * card per currency and adds nothing, because nothing on the screen has
   * already added it for them.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The channel-scoped query seam (D-06) — the only way this block asks. */
    client: QueryClient;
  }

  let { result, client }: Props = $props();

  const importedAt = $derived(result?.importedAt ?? null);

  /**
   * The account tags, or `null` for one account (D-10, D-14).
   *
   * The same `accountTagsFor` gate every tagged pane asks, so `null` is the ONE
   * condition under which no tag, no disclosure and no whitespace text node
   * appears — which is what keeps the single-account DOM byte-identical to
   * Phase 9 rather than merely free of visible content.
   */
  const tags = $derived(accountTagsFor(result));

  /**
   * The answer, held WITH the dataset it answers for.
   *
   * `$state.raw` and stamped, not reset: a replace lands as a new `importedAt`,
   * the derived state below then reads this as "no answer for what is on
   * screen", and the block returns to `loading` by construction rather than
   * through a hand-written clear (D-28, T-05-48).
   */
  let shown = $state.raw<ShownBlock<SpendView> | null>(null);

  let alive = true;
  onMount(() => {
    return () => {
      alive = false;
    };
  });

  async function load(wanted: string): Promise<void> {
    const outcome = await client.query({ channel: 'spend' });
    if (!alive) return;

    const accepted = acceptDataOutcome(outcome, 'spend', wanted, importedAt);
    if (accepted !== null) shown = accepted;
  }

  $effect(() => {
    const wanted = importedAt;
    if (wanted === null) return;
    untrack(() => {
      void load(wanted);
    });
  });

  const blockState = $derived(deriveFinanceState({ importedAt, shown }));

  const view = $derived<SpendView | null>(
    shown !== null && shown.kind === 'view' && shown.importedAt === importedAt ? shown.view : null,
  );

  const readyView = $derived(view?.status === 'ready' ? view : null);

  /**
   * One card's money, rebuilt from the transported micro-unit string.
   *
   * `parseUnitsString` rather than `BigInt` directly: the value crossed the
   * message boundary as TEXT, and a stored value that is not a plain integer in
   * range is a corrupted dataset, which is not something to render as zero
   * (decimal.ts's own rule). The `?? '0'` keeps a hand-built card from throwing
   * inside a render — the card is already a figure of zero in that case, and a
   * zero is a true statement about a total nobody wrote down.
   */
  function unitsOf(card: SpendCard): bigint {
    return parseUnitsString(card.units) ?? 0n;
  }

  /**
   * The headline: the code exactly as written, a space, and the amount.
   *
   * `null` for the unit-less group, which is the whole reason `formatMoney`
   * takes a nullable code — a code that is not three letters names no currency,
   * so giving the amount one would be inventing a unit (D-24).
   */
  function headlineFor(card: SpendCard): string {
    return formatMoney(card.code, unitsOf(card));
  }

  /**
   * One breakdown row's money, through the card's OWN code.
   *
   * The year and game breakdowns are views of the same paid rows the headline
   * sums, so they take the card's code and not their own. That is the whole of
   * D-22: a `By year` total for the unit-less group carries no code for exactly
   * the same reason the card's headline does not.
   */
  function rowMoney(code: string | null, units: string): string {
    return formatMoney(code, parseUnitsString(units) ?? 0n);
  }

  /**
   * The two breakdown tables' rows, resolved to text.
   *
   * Built in the ORDER the worker returned rather than re-sorted here: the
   * ordering is a decision the worker already made and the answer key already
   * states, and sorting it a second time in the view is a second place for the
   * two to disagree. The order itself is D-22's — year descending, games by
   * paid count then plain code units — and the e2e test asserts it.
   */
  interface BreakdownRow {
    label: string;
    paid: string;
    total: string;
  }

  function yearRows(card: SpendCard): BreakdownRow[] {
    return card.byYear.map((row) => ({
      // A `ACTION_DT` that is not a date still paid money, so the row is
      // there; it just has no year to be filed under.
      label: row.year ?? SPEND_UNKNOWN_YEAR,
      paid: formatPaidOrders(row.paid),
      total: rowMoney(card.code, row.units),
    }));
  }

  function gameRows(card: SpendCard): BreakdownRow[] {
    return card.byGame.map((row) => ({
      // A blank `GAME_CODE` is a real group of paid orders, named rather than
      // left blank — an empty cell reads as a broken row.
      label: row.code ?? SPEND_BLANK_GAME,
      paid: formatPaidOrders(row.paid),
      total: rowMoney(card.code, row.units),
    }));
  }

  /**
   * The three cells of every breakdown table, as the shared header list reads
   * them.
   *
   * `SPEND_BREAKDOWN_HEADERS` is the copy inventory's own column vocabulary
   * (`Year`, `Game code`, `Paid orders`, `Total`), and the two tables take
   * three of its four — the year table has no game column and the game table
   * no year column. Indexing rather than writing three literals per table is
   * what keeps one vocabulary for both.
   */
  const HEADER_YEAR = SPEND_BREAKDOWN_HEADERS[0] ?? '';
  const HEADER_PAID = SPEND_BREAKDOWN_HEADERS[2] ?? '';
  const HEADER_TOTAL = SPEND_BREAKDOWN_HEADERS[3] ?? '';
  const HEADER_GAME = SPEND_BREAKDOWN_HEADERS[1] ?? '';

  /**
   * One row of the per-account split, resolved to what the table draws.
   *
   * The tag rides along rather than just a letter, because the row's identity
   * IS a tag: rendering the letter on its own would print `B` in a column whose
   * header says `Account`, with nothing naming whose account that is. The
   * visually-hidden phrase the tag carries is the accessible name (D-19).
   */
  interface PerAccountRow {
    letter: string;
    label: string;
    paid: string;
    total: string;
  }

  /**
   * The per-account rows of ONE card, in IDENTITY-HEADER ORDER.
   *
   * ## The ordering rule, which is the whole of this function's subtlety
   *
   * `SpendCard.byAccount` arrives in code-unit ascending ROOT order — that is a
   * STORAGE order, right for a reproducible record and wrong for a reader,
   * because the identity header directly above this pane publishes A, B, C and a
   * table drawn as `C, B, A` makes every row a lookup. So the rows are re-sorted
   * here by walking `tags`, which is the header's own order, rather than by
   * sorting the array with a second comparator that could disagree with it.
   * Plan 10-04 found exactly this bug in the Login chips (`C, A, B` under a
   * legend reading `A, B, C`) and fixed it there; this is that rule copied, not
   * a new one.
   *
   * An account with no entry in this currency contributes no row: a row of
   * zeros would claim it spent nothing here, which is a different claim from
   * "its rows were not counted" (D-21).
   *
   * `rowMoney` rather than a code of its own, so a unit-less card's split
   * carries no currency code for exactly the same reason its headline does not
   * (D-24).
   */
  function perAccountRows(card: SpendCard): PerAccountRow[] {
    if (tags === null) return [];
    const entries = new Map(card.byAccount.map((entry) => [entry.account, entry]));
    const rows: PerAccountRow[] = [];
    for (const tag of tags.values()) {
      const entry = entries.get(tag.root);
      if (entry === undefined) continue;
      rows.push({
        letter: tag.letter,
        label: tagLabel(tag),
        paid: formatPaidOrders(entry.paid),
        total: rowMoney(card.code, entry.units),
      });
    }
    return rows;
  }

  /** The status counts a card shows, in the order the UI-SPEC lists them. */
  function statusFigures(card: SpendCard): { label: string; count: number; hook: string }[] {
    return [
      { label: SPEND_LABEL_FAILED, count: card.failed, hook: 'spend-failed' },
      { label: SPEND_LABEL_NEW, count: card.new, hook: 'spend-new' },
      // `Other status` only above zero. "No order carried an unfamiliar
      // status" is not a fact a reader needs, and on a card whose export is
      // entirely PAID it would be the only row in the list.
      ...(card.other > 0
        ? [{ label: SPEND_LABEL_OTHER, count: card.other, hook: 'spend-other' }]
        : []),
    ];
  }
</script>

<div
  data-testid="spend-block"
  data-state={blockState}
  aria-busy={blockState === 'loading' ? 'true' : 'false'}
>
  <h3>{SPEND_HEADING}</h3>

  <!--
    `no-rows` and `not-in-export` are NOT branches here, and their absence is
    the contract rather than an omission. The spend view has exactly two
    statuses (finance-shared.ts): a missing Orders.csv is `no-usable`, and an
    empty card never renders the block at all — the SECTION status is what says
    "this export contains no rows for Payment_history", and that is a claim
    about a file, not about a sum.
  -->
  {#if blockState === 'loading'}
    <p class="body" role="status">{SPEND_LOADING}</p>
  {:else if blockState === 'no-usable'}
    <p class="body">{SPEND_NO_USABLE}</p>
  {:else if blockState === 'error'}
    <!--
      The FIXED sentence, and never the worker's `detail` (D-21, T-05-31). A
      worker string names worker internals and belongs in the console. No
      `aria-live`: a region created together with its content announces
      nothing, and a live error re-announces on every re-render.
    -->
    <p class="body error" role="alert">{SPEND_ERROR}</p>
  {:else if readyView !== null}
    <!--
      The intro, ONCE at the top of the block. It is what tells a reader the
      two things the cards cannot: that only paid orders are totalled, and that
      nothing is converted or added across currencies. Its second sentence is
      why the no-blended e2e test asserts the intro carries no DIGIT — a
      headline figure in the preamble would be a figure outside a card.

      Above it, for two or more accounts only (Phase 10, D-14): the one line that
      says the amounts are added per currency and never converted. The `{#if}`
      sits flush against the `<p>` after it so a single account leaves no
      whitespace text node here (the DOM stays Phase 9's).
    -->
    {#if accountCountOf(result) >= 2}<p class="body" data-testid="finance-combined-note">
        {FINANCE_COMBINED_NOTE}
      </p>{/if}
    <p class="caption">{SPEND_INTRO}</p>

    <ul>
      {#each readyView.cards as card, index (index)}
        <!--
          A `data-currency` attribute carrying the code as WRITTEN, for tests
          only: no selector anywhere concatenates it into a query, because a
          code is untrusted text from a zip (T-05-39). The unit-less group
          carries the EMPTY STRING, which is why the unknown-currency caption
          below exists — an attribute cannot say "this has no unit".
        -->
        <li data-testid="spend-card" data-currency={card.code ?? ''}>
          <h4>{card.code ?? UNKNOWN_CURRENCY_HEADING}</h4>
          <!--
            Display role: this is the figure the card exists for, and it is the
            ONLY money at that size on the page. `overflow-wrap: anywhere`
            because an unbroken unit-less value is 60 characters of zip text
            and must wrap rather than widen the card (T-05-46, UI-SPEC 14).
          -->
          <p class="headline" data-testid="spend-total">{headlineFor(card)}</p>

          <!--
            The unit-less warning, and only on the unit-less card. It is the
            one place on the page that says out loud what the bare headline
            cannot: this amount has no unit, so it may be mixing currencies a
            reader is about to mentally add together. A card with a real
            three-letter code has nothing to warn about.
          -->
          {#if card.code === null}
            <p class="caption">{UNKNOWN_CURRENCY_CAPTION}</p>
          {/if}

          <p class="caption" data-testid="spend-paid-count">{formatPaidOrders(card.paid)}</p>

          <!--
            A DEFINITION LIST rather than three paragraphs, so a screen reader
            pairs each number with the word it belongs to. The counts are never
            added into the headline (D-21): a FAILED order cost nothing and a
            NEW order has not been charged yet, so folding either into "what
            you spent" would be a false statement about money.
          -->
          <dl>
            {#each statusFigures(card) as figure (figure.hook)}
              <dt>{figure.label}</dt>
              <dd data-testid={figure.hook}>{formatNumber(figure.count)}</dd>
            {/each}
          </dl>

          <!--
            The gift line is a VIEW of rows already inside the headline, not an
            addition to it (D-23). It is here so a reader who finds a gift
            charge on their statement can see it accounted for rather than
            wondering what it was — and it is ABSENT at zero, because a card
            that says "Includes 0 gift orders" is a fact about nothing.
          -->
          {#if card.gifts > 0}
            <p class="caption" data-testid="spend-gift">
              {formatGiftLine(card.gifts, rowMoney(card.code, card.giftUnits))}
            </p>
          {/if}

          <!--
            The breakdown, CLOSED. A reader who came for the headline should
            not have to open anything to get it, and the rows are a view of
            figures already on screen rather than the only place they exist.
            Deliberately NOT copied from the currency block's `bind:open`:
            five cards would need five independent flags, and a reader
            comparing two months of gold has no reason to have opened this.
          -->
          <details class="breakdown" data-testid="spend-breakdown">
            <summary>{SPEND_BREAKDOWN_DISCLOSURE}</summary>
            <div class="tables">
              <table>
                <caption>{SPEND_BY_YEAR}</caption>
                <thead>
                  <tr>
                    <th scope="col">{HEADER_YEAR}</th>
                    <th scope="col" class="numeric">{HEADER_PAID}</th>
                    <th scope="col" class="numeric">{HEADER_TOTAL}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each yearRows(card) as row, rowIndex (rowIndex)}
                    <tr>
                      <td>{row.label}</td>
                      <td class="numeric">{row.paid}</td>
                      <td class="numeric">{row.total}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>

              <table>
                <caption>{SPEND_BY_GAME}</caption>
                <thead>
                  <tr>
                    <th scope="col">{HEADER_GAME}</th>
                    <th scope="col" class="numeric">{HEADER_PAID}</th>
                    <th scope="col" class="numeric">{HEADER_TOTAL}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each gameRows(card) as row, rowIndex (rowIndex)}
                    <tr>
                      <td>{row.label}</td>
                      <td class="numeric">{row.paid}</td>
                      <td class="numeric">{row.total}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </details>

          <!--
            The per-account split, CLOSED (Phase 10, D-14, D-10). It is a
            disclosure rather than a second table on the card because D-14 puts
            the division in detail ONLY: the headline above is the figure, and a
            table of per-account figures in the open would compete with it.

            Absent for one account (`tags === null`, so no node at all) and for a
            card no account ordered in — and flush against the `</details>` above
            and the notice below, so a single account leaves no whitespace text
            node between them either.
          -->
          {#if tags !== null && perAccountRows(card).length > 0}
            <details class="breakdown" data-testid="spend-per-account">
              <summary>{SPEND_PER_ACCOUNT_SUMMARY}</summary>
              <table>
                <caption class="sr-only">{SPEND_PER_ACCOUNT_SUMMARY}</caption>
                <thead>
                  <tr>
                    <th scope="col">{HEADER_ACCOUNT}</th>
                    <th scope="col" class="numeric">{HEADER_PAID}</th>
                    <th scope="col" class="numeric">{HEADER_TOTAL}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each perAccountRows(card) as row, rowIndex (rowIndex)}
                    <tr>
                      <td><AccountTag letter={row.letter} label={row.label} /></td>
                      <td class="numeric">{row.paid}</td>
                      <td class="numeric">{row.total}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </details>
          {/if}

          <!--
            The excluded pill, LAST in the card and inside it. Inside because
            the count is per CURRENCY, not per export: a card that silently
            understated itself by one order would be a total the user cannot
            reconcile with their statement. Last because a reader who wants the
            headline should meet it first, and a pill directly under the
            headline would read as qualifying the headline itself.
          -->
          <ExcludedNotice
            count={card.excluded}
            pill={formatPaidExcludedPill(card.excluded)}
            explanation={SPEND_EXCLUDED_EXPLANATION}
            testId="spend-excluded"
          />
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  /* The Premium block's sub-heading rule, repeated: Svelte's scoped styles
     cannot be shared, and a copy that drifts should be visible in a diff. */
  h3 {
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
  }

  .body {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .error {
    padding: 8px 12px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--list);
  }

  /* Label role, and the code as WRITTEN: `usd` stays `usd` and `USD` stays
     `USD`, because the code is data the user recognises from their own bank
     statement and re-casing it would make two of their own cards look like one
     (D-24). A code can be long clamped zip text, so it wraps anywhere. */
  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .headline {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* A two-column grid rather than a plain `dl`, so each label sits beside its
     own figure and a zero-width label row cannot make the numbers look
     detached from the words they belong to. The 4px row gap is the card's
     own rhythm. */
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 16px;
    margin: 0;
    min-width: 0;
  }

  dt {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  dd {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--text);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* 8px before the disclosure, per the UI-SPEC: it is a different KIND of
     thing from the figures above it — a way into rows rather than a row. */
  .breakdown {
    margin-top: 8px;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--muted);
  }

  summary:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .tables {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 8px;
    min-width: 0;
  }

  /* The per-account split's table sits directly under its own summary rather
     than in the two-table `.tables` wrapper: there is one table, so the
     wrapper's column stack and 16px gap would be a rule describing nothing. The
     8px is the `.tables` gap's, so the two disclosures open to the same
     indentation. */
  details > table {
    margin-top: 8px;
  }

  /* The clip pattern (`AccountTag.svelte`, `LoginTable.svelte`), NOT the visible
     `caption` rule above: the visible caption exists because two tables share
     one summary and a reader must know which one they are reading. The split has
     one table whose every column says what it is, so its caption is a name for a
     screen reader and nothing a reader sees — and the name is the summary's own
     string, so the two cannot drift. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    line-height: 1.4;
  }

  /* The caption is VISIBLE, not the visually-hidden pattern the monthly data
     table uses. There are two tables here under one summary, and a reader
     needs to know which one they are reading before they read a number —
     "By year" over a code column would otherwise be a puzzle. */
  caption {
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--muted);
    padding-bottom: 4px;
  }

  th {
    padding: 8px 12px;
    font-weight: 600;
    color: var(--muted);
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: 8px 12px;
    font-weight: 400;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    /* A game code is 80 characters of clamped zip text in the long-text
       fixture, so the FIRST column wraps anywhere and the numeric columns keep
       their alignment (T-05-46, UI-SPEC 14). */
    overflow-wrap: anywhere;
  }

  .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
