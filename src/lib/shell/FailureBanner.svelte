<script lang="ts">
  interface Props {
    message: string;
  }

  let { message }: Props = $props();
</script>

<!--
  D-04 single generic failure banner. D-06: inline, above the dropzone,
  no auto-dismiss timer, no links, no buttons (the prohibition in
  must_haves forbids any off-device reporting affordance).
-->
<div role="alert" data-testid="failure-banner" class="failure-banner">{message}</div>

<style>
  .failure-banner {
    /* 12px, not 16px: the banner now renders inside the import bar's
       notice slot, whose children all carry the same 12px bottom margin. */
    margin: 0 0 var(--space-12);
    padding: var(--space-12) var(--space-16);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    background: var(--danger-bg);
    color: var(--danger-ink);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }
</style>
