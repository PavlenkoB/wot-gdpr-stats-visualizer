<script lang="ts">
  import type { AccountIdentity, ClassifyResult } from '../core/types/worker-messages.ts';
  import {
    IDENTITY_ARIA_LABEL,
    IDENTITY_CAPTION,
    IDENTITY_CREATED_LABEL,
    IDENTITY_REGION_LABEL,
    IDENTITY_SKELETON_PROMPT,
    IDENTITY_SKELETON_TITLE,
    UNKNOWN_VALUE,
    formatAccountId,
    formatCreatedDate,
    formatIdentityFallbackTitle,
  } from '../ui-copy.ts';

  /**
   * The account identity header (D-12 … D-17, D-21, D-24).
   *
   * One card with three variants, derived from what the worker published —
   * nothing here re-derives identity, because the worker already stripped the
   * email and the birth data before publishing the three fields this renders
   * (D-18, D-20). The component therefore has nothing sensitive to leak, and
   * `tests/e2e/shell/identity-privacy.spec.ts` proves that end to end.
   *
   * Every untrusted value (nickname, region, account root) is rendered as
   * plain text through Svelte's normal interpolation, which escapes it. There
   * is deliberately no markup-building directive, no tooltip, no `title` and
   * no per-element accessible name anywhere in this file: D-21 requires the
   * nickname to appear exactly once in the document, as the visible heading.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
  }

  let { result }: Props = $props();

  /**
   * `skeleton` — nothing loaded; `fallback` — an export is loaded but it
   * yielded no User_Info row, so the account ID stands in as the title
   * (D-16); `loaded` — a row was parsed and its three fields are shown.
   *
   * The two absences the worker can send are deliberately NOT conflated: a
   * parsed row with blank columns is `loaded` and renders "Unknown" per
   * field, while no parsed row at all is `fallback` and renders the ID.
   */
  const variant = $derived<'skeleton' | 'fallback' | 'loaded'>(
    result === null ? 'skeleton' : result.identity ? 'loaded' : 'fallback',
  );

  /** The parsed identity, or `null` for both non-loaded variants. */
  const identity = $derived<AccountIdentity | null>(
    result?.identity === undefined ? null : (result.identity ?? null),
  );

  /**
   * D-16: an absent OR empty value shows "Unknown" in its slot, so a
   * half-populated row never renders a blank line. The worker's `pick()`
   * already trims, so the value is shown exactly as it was read.
   */
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
    <h2 class="skeleton-title" data-testid="identity-title">{IDENTITY_SKELETON_TITLE}</h2>
    <p class="skeleton-prompt">{IDENTITY_SKELETON_PROMPT}</p>
  {:else if variant === 'fallback'}
    <!-- D-16: no User_Info row, so the account ID is the title. No caption,
         no value list and no ID line: the ID line would repeat the title,
         and an empty value list would suggest data that does not exist. -->
    <h2 class="fallback-title" data-testid="identity-title">
      {formatIdentityFallbackTitle(result?.accountRoot ?? '')}
    </h2>
  {:else}
    <h2 class="nickname" data-testid="identity-nickname">
      {valueOrUnknown(identity?.nickname ?? null)}
    </h2>

    <!-- D-12: the caption qualifies the values as the export's, not as a
         verified or current fact. It is a paragraph, not a heading, and it
         carries no date — `importedAt` is when WE parsed the file. -->
    <p class="caption">{IDENTITY_CAPTION}</p>

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
  /* The card shell, shared by all three variants: one flex column, the
     spacing scale's md padding and sm gap (UI-SPEC). `min-width: 0` and
     `overflow-wrap: anywhere` let a long unbroken nickname or account root
     wrap instead of forcing a horizontal scrollbar — the values are
     untrusted, so their length is not knowable in advance. */
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #fff;
    min-width: 0;
  }

  /* Display role (28 / 600 / 1.2) — the one place the size is spent, since
     the h1 is demoted to the Heading role in app.css. */
  .nickname,
  .skeleton-title,
  .fallback-title {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .nickname {
    color: #08060d;
  }

  .caption {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  /* Two columns sized by content and 1fr, so the value column takes the
     remaining width and a long value wraps inside it. */
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;
  }

  dt {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  /* Body role for the values (D-13, D-15). */
  dd {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #08060d;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .account-id {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* D-24 skeleton: a greyed card, told apart by surface AND by a dashed
     border as well as by its words, so "nothing loaded" is never carried by
     colour alone. Keyed on the variant attribute the tests already read. */
  section[data-variant='skeleton'] {
    border: 1px dashed #80868b;
    background: #f7f7fa;
  }

  .skeleton-title {
    color: #5f6368;
  }

  .skeleton-prompt {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    color: #5f6368;
  }
</style>
