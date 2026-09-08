<script setup lang="ts">
/**
 * A git branch name, always with the branch icon in front so a branch reads as
 * a branch wherever it appears — a header, a table cell, a sentence, a select.
 * Renders "no branch" (muted) when the run has none.
 */
defineProps<{
  name: string | null | undefined;
  /** Inherit the surrounding text color instead of the default muted icon. */
  inherit?: boolean;
}>();
</script>

<template>
  <span
    class="inline-flex items-center gap-1 align-baseline min-w-0 max-w-full"
    :class="!name && 'text-muted'"
    :title="name ?? undefined"
  >
    <UIcon name="i-lucide-git-branch" class="size-3 shrink-0" :class="inherit ? '' : 'text-muted'" />
    <span class="truncate">{{ name ?? 'no branch' }}</span>
  </span>
</template>
