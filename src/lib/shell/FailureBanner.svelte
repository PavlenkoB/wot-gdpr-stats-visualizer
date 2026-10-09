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
    margin: 0 0 12px;
    padding: 12px 16px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
    font-size: 14px;
    line-height: 1.5;
  }
</style>
