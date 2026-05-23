import { ref, watch } from 'vue'

/**
 * 侧边栏面板类型
 */
export type SidebarPanel = 'conversations' | 'settings' | 'tools'

/**
 * 侧边栏组合式函数
 * 管理侧边栏的展开/折叠状态和面板切换
 */
export function useSidebar() {
  /** 侧边栏是否展开 */
  const isCollapsed = ref(false)

  /** 当前激活的面板 */
  const activePanel = ref<SidebarPanel>('conversations')

  /** 侧边栏宽度 */
  const sidebarWidth = ref(300)

  /**
   * 切换侧边栏展开/折叠
   */
  const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value
  }

  /**
   * 设置激活的面板
   * @param panel 面板类型
   */
  const setActivePanel = (panel: SidebarPanel) => {
    activePanel.value = panel
    if (isCollapsed.value) {
      isCollapsed.value = false
    }
  }

  /**
   * 设置侧边栏宽度
   * @param width 宽度值
   */
  const setWidth = (width: number) => {
    sidebarWidth.value = Math.max(200, Math.min(500, width))
  }

  return {
    isCollapsed,
    activePanel,
    sidebarWidth,
    toggleCollapse,
    setActivePanel,
    setWidth,
  }
}
