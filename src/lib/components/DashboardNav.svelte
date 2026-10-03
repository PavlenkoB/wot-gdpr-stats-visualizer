<script lang="ts">
  import { navEntries, NAV_ORDER, type NavId } from '../dashboard-status.ts';
  import { NAV_ARIA_LABEL, NAV_STATUS_SUFFIX, SECTION_TITLES } from '../ui-copy.ts';
  import {
    buildRootMargin,
    isAtPageBottom,
    navScrollLeftFor,
    parseNavOffset,
    pickActiveSection,
  } from '../scroll-spy.ts';
  import type { ClassifyResult } from '../types/worker-messages.ts';

  interface Props {
    /** The last known classification, or `null` before anything is loaded. */
    result: ClassifyResult | null;
  }

  let { result }: Props = $props();

  /** One link's view model. `suffix` is the screen-reader-only reason. */
  interface NavLink {
    readonly id: NavId;
    readonly title: string;
    /**
     * Non-null exactly when the link is muted; carries the hidden suffix.
     * `NAV_STATUS_SUFFIX` already includes its leading comma, so the value
     * is rendered verbatim — prefixing it here would read "…, , not in…".
     */
    readonly suffix: string | null;
  }

  // The first section is the starting answer, not "nothing": the spy keeps
  // the previous pick whenever no section is in the band, so a spy that
  // started with no answer would leave every link unmarked until the first
  // intersection arrives (RESEARCH Q5 finding 2).
  const INITIAL_ID = NAV_ORDER[0];

  let activeId = $state<string>(INITIAL_ID);

  // One derivation from `navEntries`, the same pure module the section
  // cards read — so a nav link and its card cannot disagree about whether a
  // section is muted (D-08). `suffix` doubles as the muted flag, which is
  // why there is no second boolean to keep in step.
  const links = $derived(
    navEntries(result).map((entry): NavLink => ({
      id: entry.id,
      title: SECTION_TITLES[entry.id],
      suffix: entry.reason === null ? null : NAV_STATUS_SUFFIX[entry.reason],
    })),
  );

  // The observer is armed once, after mount, and torn down with the
  // component. Everything it needs is read from the DOM at that moment: the
  // section roots are stable elements and `--nav-offset` is a page-level
  // constant. No reactive value is READ here on purpose — reading
  // `activeId` would make this effect depend on the value it writes, and it
  // would re-arm the observer on every scroll. Only `activeId` is written.
  $effect(() => {
    // A missing id means a section is not mounted (the checking-cache state
    // renders none). Bail out rather than observe a partial set: the spy
    // would then mark a section current that the reader cannot see.
    const targets: Element[] = [];
    for (const id of NAV_ORDER) {
      const element = document.getElementById(id);
      if (element === null) return;
      targets.push(element);
    }

    const navOffset = parseNavOffset(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-offset'),
    );

    // Observers report CHANGES, not states: each callback lists the entries
    // that entered or left, never the full set. This set is the full set,
    // and the callback is the only thing that mutates it.
    //
    // A plain Set, deliberately: it is a closure local of the effect, not
    // reactive state. Making it `SvelteSet` would add a dependency the
    // template never reads and the spy never needs.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const intersecting = new Set<string>();
    let previous: string = INITIAL_ID;

    function recompute(): void {
      // The band is empty at the very top of the document: the identity
      // header and the nav together are taller than the band, so no
      // section intersects it and `pickActiveSection` — correctly, per its
      // own rule — would keep the previous pick. Coming back up from the
      // bottom would then leave the LAST link marked while the reader is
      // looking at the header. The section in view at the top of the
      // document is the first one, so the spy says that before it asks.
      previous =
        window.scrollY <= 0
          ? INITIAL_ID
          : pickActiveSection({
              order: NAV_ORDER,
              intersecting,
              previous,
              atBottom: isAtPageBottom(
                { scrollY: window.scrollY, innerHeight: window.innerHeight },
                document.documentElement.scrollHeight,
              ),
            });
      activeId = previous;
    }

    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) intersecting.add(id);
          else intersecting.delete(id);
        }
        recompute();
      },
      // The band starts below the nav and ends 60% down the viewport, so a
      // section counts as in view only once it has cleared the sticky
      // chrome and is genuinely on screen. Built from `--nav-offset` so the
      // band and every anchor's scroll margin can never disagree.
      { rootMargin: buildRootMargin(navOffset) },
    );
    for (const target of targets) observer.observe(target);

    // The bottom-of-page rule has no intersection to announce it: a section
    // that has scrolled past the band stays "exited" while the last pixels
    // of the page come into view. One rAF throttle over passive listeners
    // covers that, and a resize moves the bottom threshold with the band.
    let frame = 0;
    function onViewportChange(): void {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        recompute();
      });
    }
    window.addEventListener('scroll', onViewportChange, { passive: true });
    window.addEventListener('resize', onViewportChange, { passive: true });

    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
    };
  });

  /**
   * The nav element itself, for the horizontal scroll below.
   *
   * A plain `let`, NOT `$state`, on purpose: the nav is the component's root
   * element, so it is never re-created, and making it reactive would add a
   * dependency to every effect that reads it for no benefit. `bind:this` on a
   * non-reactive variable is the Svelte 5 idiom for "a handle, not state".
   */
  let navEl: HTMLElement | null = null;

  // Six links no longer fit the 720px column, so the nav scrolls inside itself
  // and has to MOVE ITS OWN SCROLL to follow the spy (D-01, 05-09).
  //
  // `activeId` is the ONLY reactive value read here, so this runs exactly when
  // the spy moves the highlight and never for any other reason. The rule itself
  // is `navScrollLeftFor`, out in `scroll-spy.ts`, because it is arithmetic over
  // five numbers and this repo's Vitest has no DOM to test it in.
  //
  // The native scroll-into-view call is deliberately NOT used: it scrolls every
  // scrollable ancestor, the PAGE included, so marking a section current would
  // move the page vertically as a side effect of a horizontal convenience.
  $effect(() => {
    const currentId: string = activeId;

    const nav: HTMLElement | null = navEl;
    if (nav === null) return;

    // Found by the attribute the spy writes, so the highlight and this scroll
    // can never be driven by two different sources of truth. The href check
    // pins the two together: if they ever disagreed, nothing would scroll
    // rather than the wrong link being brought into view.
    const link: HTMLElement | null = nav.querySelector('a[aria-current="location"]');
    if (link === null || link.getAttribute('href') !== `#${currentId}`) return;

    // The inset is the nav's own padding, read rather than repeated, so the
    // rule and the stylesheet cannot drift apart. It is what keeps a link's 3px
    // underline and its focus ring from being clipped at either end.
    const inset: number = Number.parseFloat(getComputedStyle(nav).paddingLeft) || 0;
    const navRect: DOMRect = nav.getBoundingClientRect();
    const linkRect: DOMRect = link.getBoundingClientRect();
    // `scrollLeft` and `clientWidth` are both measured from the padding box, so
    // the link's edges are reported from the same origin rather than from the
    // viewport.
    const origin: number = navRect.left + nav.clientLeft;

    const next: number = navScrollLeftFor({
      scrollLeft: nav.scrollLeft,
      clientWidth: nav.clientWidth,
      linkLeft: linkRect.left - origin,
      linkRight: linkRect.right - origin,
      inset,
    });
    // The write is instant: `scroll-behavior` is not inherited and the nav
    // declares none, so this never animates. The guard skips the no-op write
    // that would otherwise fire on every spy tick.
    if (next !== nav.scrollLeft) {
      nav.scrollLeft = next;
    }
  });
</script>

<!--
  The nav IS the root element, deliberately. `position: sticky` is scoped to
  the element itself: wrap it in a div and the div would stay in flow while
  the nav appeared to hang outside it (RESEARCH Pitfall 11).

  Nothing here reacts to a click. The links are native `<a href="#id">`
  anchors, so the browser does the scrolling and the hash appears and
  disappears on its own. A handler that set `aria-current` on click would
  make the highlight claim a position the reader never moved to (D-04, D-05);
  the spy is the only writer.

  The visible title is a bare text node and the status suffix is a span
  directly after it with no whitespace between them, so the accessible name
  concatenates to `Payment_history, not in this export`. Both halves matter:
  the class on that span keeps it IN the inline flow rather than out of it
  (see the stylesheet), and the absence of whitespace in the markup keeps the
  two runs adjacent (D-03).
-->
<nav aria-label={NAV_ARIA_LABEL} data-testid="dashboard-nav" bind:this={navEl}>
  <ul>
    {#each links as link (link.id)}
      <li>
        <a
          href={`#${link.id}`}
          data-testid={`nav-link-${link.id}`}
          class:muted={link.suffix !== null}
          aria-current={link.id === activeId ? 'location' : undefined}
          >{link.title}{#if link.suffix}<span class="screen-reader-only">{link.suffix}</span
            >{/if}</a
        >
      </li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    /* Sticky at every width; the only sticky element on the page. Opaque
       background so scrolled content never reads through it. */
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f7f7fa;
    border: 1px solid #dadce0;
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-wrap: nowrap;
    /* The row never wraps. Six links no longer fit the 720px column, so it
       scrolls inside this box and the page never gains a horizontal
       scrollbar. The current link is brought into view by the nav's OWN scroll
       position — see the effect in the script, and `navScrollLeftFor`. */
    overflow-x: auto;
    overflow-y: hidden;

    /* The scrollbar is hidden, and this is a HEIGHT contract rather than a
       taste one (RESEARCH Pitfall 12, 05-09).

       The nav's height is `auto` and the page has exactly one `--nav-offset` for
       every anchor's `scroll-margin-top` and for the observer band. A classic
       scrollbar is ~15px of height on the platforms that draw one, so with the
       nav's own scrollbar visible its height — and therefore that one constant —
       would differ between a machine that shows scrollbars and one that does
       not. Headless Chromium draws none, so CI would never see the difference
       and a reader on a desktop browser would get an off-by-15px anchor offset.

       Both engines are covered because they take different declarations:
       `scrollbar-width` is the standard property, and the WebKit pseudo-element
       is what older WebKit actually honours.

       Nothing is lost. The nav still scrolls — by wheel, by trackpad, by
       dragging, and by keyboard focus, which scrolls the focused link into view
       natively — and the rule above is what a screen-reader and keyboard reader
       get as a visible highlight rather than an invisible one. */
    scrollbar-width: none;
  }

  nav::-webkit-scrollbar {
    display: none;
  }

  ul {
    display: flex;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    flex: none;
  }

  a {
    display: block;
    padding: 8px;
    /* The border reserves the underline's 3px whether or not it is showing,
       so marking a section current does not shift the row by 3px. */
    border-bottom: 3px solid transparent;
    border-radius: 6px;
    white-space: nowrap;
    text-decoration: none;
    color: #3c4043;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }

  /* The hover has to be a VISIBLE step off the `#f7f7fa` surface, not just
     a different value: `#ffffff` here measured 1.069:1 and the Phase 2
     `#f1f3f4` 1.041:1, so neither read as a hover at all (UI-SPEC Color
     table, amended by W-03). `#dadce0` measures 1.284:1 — the clearest step
     that does not read as a selected or outlined state, and the nav links
     carry no border of their own to be confused with. */
  a:hover {
    background: #dadce0;
  }

  /* Muted is a weight change as well as a colour change: weight survives
     greyscale, a high-contrast mode, and a screen reader, which never
     reports colour at all. */
  a.muted {
    color: #5f6368;
    font-weight: 400;
  }

  /* Current wins over muted for weight and underline, so a muted current
     link reads "lighter text, blue underline, weight 600" (UI-SPEC). The
     attribute IS the hook, so the style cannot drift from the state the
     spy maintains. */
  a[aria-current='location'] {
    color: #08060d;
    font-weight: 600;
    border-bottom-color: #1a73e8;
  }

  a.muted[aria-current='location'] {
    color: #5f6368;
  }

  a:focus-visible {
    outline: 3px solid #1a73e8;
    outline-offset: 2px;
  }

  /* The screen-reader-only status suffix.

     The clip pattern that Dropzone.svelte uses (`position: absolute` at 1px)
     is deliberately NOT used here, because it costs the contract string. An
     accessible name is the concatenation of an element's children, and
     Chromium inserts a separator before an OUT-OF-FLOW child: absolutely
     positioning this span — or making it an inline-block — announces
     "Payment_history , not in this export", with the comma one character
     detached from the folder name the Copywriting Contract fixes (D-03).

     Staying in the inline formatting context and collapsing the text itself
     is what makes the name exact. `font-size: 0` gives the run no advance
     width, so the nav row's layout is unchanged at every viewport — the same
     property the phone-width test measures. */
  .screen-reader-only {
    display: inline;
    position: static;
    font-size: 0;
    line-height: 0;
  }
</style>
