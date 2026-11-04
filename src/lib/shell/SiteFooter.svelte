<script lang="ts">
  import {
    SITE_FOOTER_REPO_LINK_HREF,
    SITE_FOOTER_REPO_LINK_TEXT,
    SITE_FOOTER_TEXT,
  } from '../ui-copy.ts';
</script>

<!--
  The page footer: on every screen, the empty first-visit one included. It sits
  below the shell, which leaves room for it (`--footer-height` in tokens.css).
-->
<footer class="site-footer t-note" data-testid="site-footer">
  <span>{SITE_FOOTER_TEXT}</span>
  <a
    href={SITE_FOOTER_REPO_LINK_HREF}
    target="_blank"
    rel="noreferrer noopener"
    data-testid="site-footer-repo-link">{SITE_FOOTER_REPO_LINK_TEXT}</a
  >
</footer>

<style>
  .site-footer {
    box-sizing: border-box;
    min-height: var(--footer-height);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-4) var(--space-16);
    padding: var(--space-8) var(--layout-gutter);
    color: var(--muted);
    border-top: 1px solid var(--border);
    background: var(--page);
  }
</style>
