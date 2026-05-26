<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': isCollapsed, 'right-sidebar-visible': showRightSidebar }">
    <aside
      class="app-sidebar-left"
      :style="{ width: isCollapsed ? '0px' : `${sidebarWidth}px` }"
    >
      <div v-if="!isCollapsed" class="sidebar-content">
        <slot name="sidebar" />
      </div>
      <div
        v-if="!isCollapsed"
        class="sidebar-resize-handle"
        @mousedown="startResizeLeft"
      />
    </aside>

    <main class="app-main">
      <div class="main-content">
        <slot name="main" />
      </div>
    </main>

    <aside
      v-if="showRightSidebar"
      class="app-sidebar-right"
      :style="{ width: `${rightSidebarWidth}px` }"
    >
      <div class="sidebar-content">
        <slot name="right-sidebar" />
      </div>
      <div
        class="sidebar-resize-handle-right"
        @mousedown="startResizeRight"
      />
    </aside>

    <button class="sidebar-toggle" @click="toggleCollapse" :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'">
      <el-icon :size="16">
        <component :is="isCollapsed ? 'DArrowRight' : 'DArrowLeft'" />
      </el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useSidebar } from '../../composables/useSidebar'

interface Props {
  /** 是否显示右侧边栏 */
  showRightSidebar?: boolean
  /** 右侧边栏宽度 */
  rightSidebarWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  showRightSidebar: false,
  rightSidebarWidth: 280,
})

const emit = defineEmits<{
  /** 右侧边栏宽度变更 */
  rightSidebarWidthChange: [width: number]
}>()

const { isCollapsed, sidebarWidth, toggleCollapse } = useSidebar()

/**
 * 开始拖拽调整左侧边栏宽度
 * @param event 鼠标事件
 */
const startResizeLeft = (event: MouseEvent) => {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = sidebarWidth.value

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX
    sidebarWidth.value = Math.max(200, Math.min(500, startWidth + delta))
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

/**
 * 开始拖拽调整右侧边栏宽度
 * @param event 鼠标事件
 */
const startResizeRight = (event: MouseEvent) => {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = props.rightSidebarWidth

  const onMouseMove = (e: MouseEvent) => {
    const delta = startX - e.clientX
    const newWidth = Math.max(200, Math.min(400, startWidth + delta))
    emit('rightSidebarWidthChange', newWidth)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

/**
 * 响应式布局：窗口过窄时自动折叠侧边栏
 */
const handleResize = () => {
  if (window.innerWidth < 768 && !isCollapsed.value) {
    isCollapsed.value = true
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.app-shell {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  position: relative;
  background: var(--bg-color);

  &.sidebar-collapsed {
    .app-sidebar-left {
      width: 0 !important;
    }
  }

  &:not(.sidebar-collapsed) .sidebar-toggle {
    left: v-bind(sidebarWidth + 'px');
  }

  &.right-sidebar-visible .sidebar-toggle {
    left: calc(v-bind(sidebarWidth + 'px') + 4px);
  }
}

.app-sidebar-left {
  position: relative;
  background: var(--white);
  border-right: 1px solid var(--border-color);
  transition: width 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
}

.app-sidebar-right {
  position: relative;
  background: var(--white);
  border-left: 1px solid var(--border-color);
  transition: width 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar-content {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 200px;
}

.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 10;

  &:hover {
    background: var(--primary-color);
  }
}

.sidebar-resize-handle-right {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 10;

  &:hover {
    background: var(--primary-color);
  }
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-toggle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  width: 24px;
  height: 48px;
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-color);
    width: 28px;
    color: var(--primary-color);
  }
}

@media (max-width: 768px) {
  .app-sidebar-left {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 30;
    box-shadow: var(--shadow-lg);
  }

  .app-sidebar-right {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    box-shadow: var(--shadow-lg);
  }

  .sidebar-toggle {
    display: none;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .sidebar-content {
    min-width: 180px;
  }
}
</style>