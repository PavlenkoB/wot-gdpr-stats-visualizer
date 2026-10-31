<script lang="ts">
  import type { AccountIdentity, ClassifyResult } from '../core/types/worker-messages.ts';
  import { accountRows, hasMultipleRoots, letterOf } from './identity-model.ts';
  import AccountTag from './AccountTag.svelte';
  import {
    IDENTITY_ACTIVITY_LABEL,
    IDENTITY_ARIA_LABEL,
    IDENTITY_CAPTION,
    IDENTITY_CREATED_LABEL,
    IDENTITY_GAMES_LABEL,
    IDENTITY_MULTI_LIST_LABEL,
    IDENTITY_REGION_LABEL,
    IDENTITY_SKELETON_PROMPT,
    IDENTITY_SKELETON_TITLE,
    UNKNOWN_VALUE,
    formatAccountCount,
    formatAccountId,
    formatAccountLegendLabel,
    formatCreatedDate,
    formatIdentityFallbackTitle,
  } from '../ui-copy.ts';

  /**
   * The account identity header (D-12 … D-17, D-21, D-24; multi: D-13 … D-17).
   *
   * ONE card with four variants, derived from what the worker published —
   * nothing here re-derives identity, because the worker already stripped the
   * email and the birth data before publishing the three fields this renders
   * (D-18, D-20). The component therefore has nothing sensitive to leak, and
   * `tests/e2e/shell/identity-privacy.spec.ts` proves that end to end.
   *
   * `multi` is the only variant Phase 9 added, and it renders when the ARCHIVE
   * held two or more account folders (09-11), even if only one of them stores
   * data; ONE folder still renders byte-identically to v1.0, including its
   * four test ids. Every decision about what a row shows lives in
   * `./identity-model.ts` as a pure function, because `vitest.config.ts` runs in
   * Node with no Svelte plugin and a component cannot be rendered in a unit test
   * at all.
   *
   * Every untrusted value (nickname, account root) is rendered as plain text
   * through Svelte's normal interpolation, which escapes it. There is
   * deliberately no markup-building directive, no tooltip, no `title` and no
   * per-element accessible name anywhere in this file.
   *
   * D-21 RESTATED PER ROW: with one account the nickname appears exactly once in
   * the document; with several, it appears once in ITS OWN row and nowhere else.
   * Two accounts may share a nickname, so the rule is "once per row" rather than
   * "once in the document", and the single-account DOM and its assertions are
   * unchanged.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
  }

  let { result }: Props = $props();

  /**
   * `skeleton` — nothing loaded; `multi` — two or more account folders (D-13);
   * `fallback` — one account that yielded no User_Info row, so the account ID
   * stands in as the title (D-16); `loaded` — one account whose row was parsed
   * and whose three fields are shown.
   *
   * The two absences the worker can send are deliberately NOT conflated: a
   * parsed row with blank columns is `loaded` and renders "Unknown" per
   * field, while no parsed row at all is `fallback` and renders the ID.
   *
   * `multi` is checked BEFORE the legacy identity, because the legacy field is
   * the FIRST folder's: letting it decide would render one account as though it
   * were the whole dataset (T-09-20). It follows the ARCHIVE's folder count, not
   * the published list: a data-less sibling folder is absent from the list, and
   * must not turn the header into a single-account one (09-11, T-09-33).
   */
  const variant = $derived<'skeleton' | 'multi' | 'fallback' | 'loaded'>(
    result === null
      ? 'skeleton'
      : hasMultipleRoots(result)
        ? 'multi'
        : result.identity
          ? 'loaded'
          : 'fallback',
  );

  /** The parsed identity, or `null` for every non-`loaded` variant. */
  const identity = $derived<AccountIdentity | null>(
    result?.identity === undefined ? null : (result.identity ?? null),
  );

  /**
   * The rows the multi variant renders, in the order the worker stored (D-16).
   *
   * Keyed by INDEX in the template rather than by nickname, root or year: two
   * accounts may share all three, and a key that could repeat would make the
   * list throw or silently reuse a node. The order is never re-sorted here — the
   * worker's `sortAccounts` is the only comparator.
   */
  const rows = $derived(accountRows(result?.accounts ?? []));

  /**
   * D-10: whether the rows carry a letter chip, and so whether this header is
   * the LEGEND the data panes' tags refer to.
   *
   * The test is the ROW count, not the folder count: a multi variant whose
   * archive held a data-less sibling folder has ONE row, and a legend of one
   * letter explains nothing that the row does not already show in its own name
   * and ID line. With one row the header renders exactly as Phase 9 left it.
   */
  const showTagLegend = $derived(rows.length >= 2);

  /** D-16: an absent OR empty value shows "Unknown" in its slot, so a
   * half-populated row never renders a blank line. The worker's `pick()`
   * already trims, so the value is shown exactly as it was read. */
  function valueOrUnknown(value: string | null): string {
    return value === null || value.trim() === '' ? UNKNOWN_VALUE : value;
  }

  /** D-14: the ID line is omitted when the root is empty, so a rootless
   * export shows neither an empty line nor a duplicate of the title. */
  const showAccountId = $derived(identity !== null && result !== null && result.accountRoot !== '');
</script>

<section aria-label={IDENTITY_ARIA_LABEL} data-testid="identity-header" data-variant={variant}>
  {#if variant === 'skeleton'}
    <!-- D-24: the first-visit skeleton. Deliberately NOT the nickname test
         id — a test asking for the nickname must find nothing before an
         export is loaded, and a placeholder wearing the real test id would
         make that assertion lie. -->
    <h2 class="t-title skeleton-title" data-testid="identity-title">{IDENTITY_SKELETON_TITLE}</h2>
    <p class="skeleton-prompt">{IDENTITY_SKELETON_PROMPT}</p>
  {:else if variant === 'multi'}
    <!-- D-13 / UI-SPEC Surface 1. The title is the COUNT, not a nickname: with
         several accounts no single one stands for the export. The caption is
         the existing IDENTITY_CAPTION, reused as is — D-12's "as of export"
         qualifies the whole list, and the import-time dates are not per-row
         anyway. -->
    <h2 class="t-title multi-title" data-testid="identity-multi-title">
      {formatAccountCount(rows.length)}
    </h2>

    <p class="caption identity-caption">{IDENTITY_CAPTION}</p>

    <!-- `role="list"` is explicit because the list-style reset drops list
         semantics in some engines. The accessible name is the STATIC
         IDENTITY_MULTI_LIST_LABEL: a row carries no aria-label, no title and no
         describedby, so its text content is its name and a screen reader reads
         "name, Account ID: …, Games, Activity, years" in order. -->
    <ol
      class="multi-list"
      role="list"
      aria-label={IDENTITY_MULTI_LIST_LABEL}
      data-testid="identity-multi-list"
    >
      {#each rows as row, index (index)}
        <li
          class="multi-row"
          data-testid="identity-multi-row"
          data-user-info={row.idOnly ? 'absent' : undefined}
        >
          <!--
            D-10's legend: the letter chip, then the name, in one flex row.

            The `{#if}` and the `<AccountTag>` sit flush against the `<h3>`'s
            neighbours with NO whitespace between them, which is the same
            load-bearing adjacency `DashboardSection.svelte` uses for the
            combined caption: a newline here would put a whitespace text node
            inside a one-row header that is supposed to render unchanged.

            The letter is `letterOf(index)` on this list's own index — the SAME
            expression the data panes use through `accountTagsOf`, so the letter
            an account wears here is by construction the letter it wears in the
            Vehicles table (D-10, UI-SPEC ordering). The hidden phrase is
            `Account {letter}` and nothing more: the nickname and the ID are
            already visible text in this row, and repeating them in hidden text
            would break D-21's once-per-row rule that the e2e counts.
          -->
          {#if showTagLegend}<div class="multi-head">
              <AccountTag
                letter={letterOf(index)}
                label={formatAccountLegendLabel(letterOf(index))}
              />
              <h3
                class="t-heading multi-name"
                class:id-only={row.idOnly}
                data-testid="identity-multi-name"
              >
                {row.name}
              </h3>
            </div>{/if}{#if !showTagLegend}<h3
              class="t-heading multi-name"
              class:id-only={row.idOnly}
              data-testid="identity-multi-name"
            >
              {row.name}
            </h3>{/if}

          {#if row.idLine !== null}
            <p class="account-id" data-testid="identity-multi-id">{row.idLine}</p>
          {/if}

          <dl>
            {#if row.games !== null}
              <dt>{IDENTITY_GAMES_LABEL}</dt>
              <dd data-testid="identity-multi-games">{row.games}</dd>
            {/if}
            <dt>{IDENTITY_ACTIVITY_LABEL}</dt>
            <dd data-testid="identity-multi-years">{row.activity}</dd>
          </dl>
        </li>
      {/each}
    </ol>
  {:else if variant === 'fallback'}
    <!-- D-16: no User_Info row, so the account ID is the title. No caption,
         no value list and no ID line: the ID line would repeat the title,
         and an empty value list would suggest data that does not exist. -->
    <h2 class="t-title fallback-title" data-testid="identity-title">
      {formatIdentityFallbackTitle(result?.accountRoot ?? '')}
    </h2>
  {:else}
    <h2 class="t-title nickname" data-testid="identity-nickname">
      {valueOrUnknown(identity?.nickname ?? null)}
    </h2>

    <!-- D-12: the caption qualifies the values as the export's, not as a
         verified or current fact. It is a paragraph, not a heading, and it
         carries no date — `importedAt` is when WE parsed the file. -->
    <p class="caption identity-caption">{IDENTITY_CAPTION}</p>

    <dl class="identity-details">
      <!-- D-13 (amended after UAT G-05-7): the raw `REGION` string, never
           mapped to a friendly name. The label names it a location code
           because a real export stores a numeric regional code beside a
           city, not a game realm; the old "Region" wording read as one. -->
      <dt>{IDENTITY_REGION_LABEL}</dt>
      <dd data-testid="identity-region">{valueOrUnknown(identity?.region ?? null)}</dd>
      <!-- D-15: date-only, no time and no timezone (the field has neither). -->
      <dt>{IDENTITY_CREATED_LABEL}</dt>
      <dd data-testid="identity-created">{formatCreatedDate(identity?.createdAt ?? null)}</dd>
    </dl>

    {#if showAccountId}
      <!-- D-14: the account root, a secondary line. Untrusted zip-entry text
           (T-03-18): displayed because it is the requirement, and rendered
           as text only. -->
      <p class="account-id" data-testid="identity-account-id">
        {formatAccountId(result?.accountRoot ?? '')}
      </p>
    {/if}
  {/if}
</section>

<style>
  /* The header sits directly in the list pane, which is the container, so it
     has no card chrome of its own: one flex column with the pane's 20px side
     padding. `min-width: 0` and `overflow-wrap: anywhere` let a long unbroken
     nickname or account root wrap instead of widening the 320px pane — the
     values are untrusted, so their length is not knowable in advance. */
  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4) var(--layout-gutter) var(--space-4);
    min-width: 0;
  }

  /* The Title role (D-12): 32px from 900px up, 26px below. The role owns the
     size, the weight, the line height and the wrapping; this rule states only
     what a role may not: the margin, the colour and the shrink. The phone
     block of `src/app.css` no longer overrides the size — the role is the one
     answer to "how big is a title", and a rule of specificity (0,3,0) would
     have beaten it. */
  .nickname,
  .skeleton-title,
  .fallback-title,
  .multi-title {
    margin: 0;
    color: var(--ink);
    min-width: 0;
  }

  /* The shared caption block of `src/styles/utilities.css` (14 / 400 / 1.4 in
     `--muted`) with ONE difference: this caption is a label, so it is
     semibold. The hook class states only the difference, because a local copy
     of `.caption` would shadow the shared one and could drift from it. */
  .identity-caption {
    font-weight: var(--fw-semibold);
  }

  /* Two columns sized by content and 1fr, so the value column takes the
     remaining width and a long value wraps inside it. */
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-4) var(--space-16);
    margin: 0;
  }

  dt {
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    color: var(--muted);
  }

  /* Body role for the values (D-13, D-15). */
  dd {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* The Label-role ID line, 14/600/1.4 in `--muted`.

     D-17 / T-09-28: `.multi-name.id-only` shares THIS rule rather than
     restating the values. An account root with no User_Info is an absence, and
     an absence must not wear the row's most prominent type: its number takes
     the same Label role an ID line already takes, so the demotion is a change
     of TYPE only. The text, the `h3` and the row's accessible name are
     untouched — a rootless account keeps the only identifier it has. Sharing
     the selector means the two cannot drift apart in a later edit.

     The three type declarations STAY here even though the row name takes the
     Heading role: this rule is what demotes an ID-only row, and a rule that
     only stated the size would leave the weight and the line height to the
     role. It outranks the role on specificity, so the demotion holds. */
  .account-id,
  .multi-name.id-only {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* D-24 skeleton: "nothing loaded" is carried by its words (the title) and by
     the muted prompt line under it, never by a tint or a border alone. The title
     itself takes the shared ink heading rule above: D-24 asks for distinct
     wording, not a muted heading. */
  .skeleton-prompt {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-body);
    color: var(--muted);
  }

  /* ---------------------------------------------------------------------
     The multi-account list (D-13, UI-SPEC Surface 1).

     A stack of compact rows, all visible with no interaction: no "show more",
     no collapse, no pagination, and nothing focusable in the header at all.
     The desktop list pane already scrolls internally, so the list grows with
     the account count (up to the import cap) and costs the pane nothing.
     ----- */

  /* The list-style reset drops list semantics in some engines, which is why the
     template also carries an explicit `role="list"`. */
  .multi-list {
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }

  /* A hairline above each row rather than a card per account: several accounts
     read as one list, and the Day 10 chrome uses hairlines for exactly this. */
  .multi-row {
    border-top: 1px solid var(--border);
    padding: var(--space-8) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  /* D-10: the chip and the name on one line, the chip 8px ahead of the name.

     `align-items: baseline` rather than `center`: the chip's box is 20px tall
     and the name is an 18px heading, so centring them would leave the letter
     sitting a pixel low against the first line of the name. Baseline alignment
     puts the chip's own text on the name's first baseline whatever the glyph
     sizes are. `min-width: 0` and the flex child's `min-width: 0` in `.multi-name`
     let a long untrusted name wrap rather than widen the 320px pane. */
  .multi-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-8);
    min-width: 0;
  }

  /* The Heading role, for a row that HAS a nickname: 18 / 600 / 1.3. The role
     owns those three; this rule states the margin, the colour and the wrap.
     `--ink`, and `overflow-wrap: anywhere` for a long nickname or a 20-digit
     account root: both are untrusted, so their length is not knowable in
     advance and neither may widen the 320px pane. The id-only case opts out of
     the role above and takes the Label role instead, so an absence never looks
     like a presence. */
  .multi-name {
    margin: 0;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
