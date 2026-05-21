<template>
  <div class="logo" :class="isCollapsed ? 'closed' : 'opened'">
    <template v-if="!isCollapsed">
      <span class="name">{{ appConfig.appTitle }}</span>
      <span v-if="version" class="version">v{{ version }}</span>
    </template>
    <template v-else>
      <span class="name">{{ firstCharName }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { appConfig } from '@/config'

interface Props {
  isCollapsed?: boolean
  version?: string
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false,
  version: ''
})

const firstCharName = computed(() => {
  return props.isCollapsed ? appConfig.appTitle.charAt(0) : appConfig.appTitle
})
</script>

<style lang="scss" scoped>
.logo {
  display: flex;
  border: 0;
  border-right: 1px solid #eee;
  height: 50px;
  color: var(--el-color-primary);
  font-size: 20px;
  font-weight: 700;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
  transition: width 0.3s ease;

  .name {
    padding-right: 5px;
  }

  .version {
    font-size: 12px;
    color: #909399;
    font-weight: 400;
    margin-left: 5px;
    margin-top: 8px;
  }
}

.opened {
  width: 219px;
}

.closed {
  width: 60px;
}
</style>
