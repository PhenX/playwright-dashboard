<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <div v-if="config.public.demoMode" class="demo-banner">
    ⚠️ <strong>Demo mode</strong> — showing sample data only. Forms, actions, and file uploads are disabled. <a href="https://github.com/PhenX/playwright-dashboard" target="_blank" class="underline">Deploy your own instance</a> for live data.
  </div>
</template>

<style scoped>
.demo-banner {
  background-color: #fef3c7;
  color: #92400e;
  text-align: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-bottom: 1px solid #fcd34d;
}

.dark .demo-banner {
  background-color: #451a03;
  color: #fcd34d;
  border-bottom-color: #78350f;
}
</style>
