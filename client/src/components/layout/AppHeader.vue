<template>
  <div class="app-header">
    <div class="header-left">
      <slot name="left" />
    </div>
    <div class="header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--white, #ffffff);
  border-bottom: 1px solid var(--border-color, #e8e8e8);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-left {
  flex: 1;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
</style>
