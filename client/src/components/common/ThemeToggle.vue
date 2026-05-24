<template>
  <div class="theme-toggle" @click="toggleTheme" :title="themeTooltip">
    <el-icon :size="18">
      <component :is="themeIcon" />
    </el-icon>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Sunny, Moon } from '@element-plus/icons-vue'
import { useTheme } from '../../composables/useTheme'

const { toggleTheme, effectiveTheme } = useTheme()

/**
 * 主题图标
 */
const themeIcon = computed(() => {
  return effectiveTheme.value === 'dark' ? Moon : Sunny
})

/**
 * 主题提示文本
 */
const themeTooltip = computed(() => {
  return effectiveTheme.value === 'dark' ? '切换到亮色模式' : '切换到暗色模式'
})
</script>

<style lang="scss" scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-tertiary);
    color: var(--primary-color);
  }
}
</style>
