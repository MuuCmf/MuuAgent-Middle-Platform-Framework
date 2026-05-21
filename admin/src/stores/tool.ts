import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toolApi, type BuiltinTool } from '@/api/tool'

/**
 * 工具Store
 */
export const useToolStore = defineStore('tool', () => {
  /** 内置工具列表 */
  const builtinTools = ref<BuiltinTool[]>([])

  /** 加载状态 */
  const loading = ref(false)

  /** 是否已加载 */
  const loaded = ref(false)

  /**
   * 加载内置工具列表
   * @param force 是否强制重新加载
   */
  async function loadBuiltinTools(force = false) {
    if (loaded.value && !force) return

    loading.value = true
    try {
      const tools = await toolApi.getBuiltinTools()
      // 确保数据是数组
      builtinTools.value = Array.isArray(tools) ? tools : []
      loaded.value = true
    } catch (error) {
      console.error('加载内置工具列表失败:', error)
      builtinTools.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据名称获取工具信息
   * @param name 工具名称
   * @returns 工具信息或undefined
   */
  function getToolByName(name: string): BuiltinTool | undefined {
    return builtinTools.value.find(t => t.name === name)
  }

  /**
   * 获取敏感工具列表
   * @returns 敏感工具列表
   */
  function getSensitiveTools(): BuiltinTool[] {
    return builtinTools.value.filter(t => t.sensitive)
  }

  /**
   * 按分类获取工具
   * @param category 分类名称
   * @returns 该分类下的工具列表
   */
  function getToolsByCategory(category: string): BuiltinTool[] {
    return builtinTools.value.filter(t => t.category === category)
  }

  /**
   * 获取启用的工具列表
   * @returns 启用的工具列表
   */
  function getEnabledTools(): BuiltinTool[] {
    return builtinTools.value.filter(t => t.enabled)
  }

  /**
   * 获取所有工具名称列表
   * @returns 工具名称列表
   */
  function getAllToolNames(): string[] {
    if (!Array.isArray(builtinTools.value)) return []
    return builtinTools.value.map(t => t.name)
  }

  /**
   * 获取安全工具名称列表（非敏感且启用）
   * @returns 安全工具名称列表
   */
  function getSafeToolNames(): string[] {
    if (!Array.isArray(builtinTools.value)) return []
    return builtinTools.value
      .filter(t => t.enabled && !t.sensitive)
      .map(t => t.name)
  }

  return {
    builtinTools,
    loading,
    loaded,
    loadBuiltinTools,
    getToolByName,
    getSensitiveTools,
    getToolsByCategory,
    getEnabledTools,
    getAllToolNames,
    getSafeToolNames,
  }
})
