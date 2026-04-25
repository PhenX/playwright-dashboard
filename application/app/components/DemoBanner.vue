<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <div v-if="config.public.demoMode" class="demo-banner">
    ⚠️ Demo mode — showing sample data. Deploy your own instance for live data.
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
  position: sticky;
  top: 0;
  z-index: 50;
}

.dark .demo-banner {
  background-color: #451a03;
  color: #fcd34d;
  border-bottom-color: #78350f;
}
</style>
