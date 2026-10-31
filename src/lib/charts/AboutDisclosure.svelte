<script lang="ts">
  import type { Snippet } from 'svelte';
  import { formatAboutThis } from '../ui-copy.ts';

  /**
   * The shared "About this <name>" disclosure (08-06, UI-SPEC copy row
   * "Disclosure summary").
   *
   * It wraps SUPPLEMENTARY copy only: a chart's keyboard-use hint and the
   * conditional hour-grid start-basis note. A basis caption (Phase 4 D-01), the
   * session-length explanation (D-05) and the map's licence attribution are
   * requirement-bearing and stay visible beside their chart; the guard test in
   * `tests/unit/charts/about-disclosure.test.ts` keeps it that way.
   *
   * The children stay in the DOM while the details is closed (a collapsed
   * `details` hides its content from sight but not from the tree), so a hint
   * paragraph inside it keeps its `id` and the chart's `aria-describedby` still
   * resolves.
   *
   * `name` is a fixed ui-copy constant. No prop takes export data and nothing is
   * rendered as raw HTML (T-08-20).
   */
  interface Props {
    /** The thing the copy is about, from the `ABOUT_NAME_*` constants. */
    name: string;
    /** The `data-testid` the owner gives this disclosure. */
    testId?: string;
    children: Snippet;
  }

  let { name, testId = 'about-chart', children }: Props = $props();
</script>

<details class="about" data-testid={testId}>
  <summary>{formatAboutThis(name)}</summary>
  <div class="about-body">
    {@render children()}
  </div>
</details>

<style>
  .about {
    min-width: 0;
  }

  summary {
    display: inline-flex;
    align-items: center;
    /* The 44px touch floor. It is a hit area, not a spacing value, so it stays
       a length (D-04, UI-SPEC "Non-spacing sizes"). */
    min-height: 44px;
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    color: var(--ink);
    text-decoration: underline;
    cursor: pointer;
  }

  .about-body {
    padding-top: var(--space-8);
    min-width: 0;
  }
</style>
