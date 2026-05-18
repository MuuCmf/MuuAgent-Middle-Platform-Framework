import { defineStore } from 'pinia'
import { ref } from 'vue'
import { skillApi, type StandardSkill, type ScanResult, type ImportResult, type SyncResult, type SkillStats } from '@/api/skill'
import { ElMessage, ElMessageBox } from 'element-plus'

export const useSkillStore = defineStore('skill', () => {
  const standardSkills = ref<StandardSkill[]>([])
  const scanning = ref(false)
  const syncing = ref(false)
  const skillStats = ref<SkillStats | null>(null)

  /** 加载标准技能列表（经过L1缓存） */
  const loadStandardSkills = async (appCode?: string) => {
    try {
      const res = await skillApi.listStandardSkills(appCode)
      standardSkills.value = res.data?.data || []
    } catch (error) {
      console.error('加载标准技能失败', error)
      standardSkills.value = []
    }
  }

  /** 扫描技能并同步到数据库 */
  const scanSkills = async (): Promise<ScanResult | null> => {
    scanning.value = true
    try {
      const res = await skillApi.scanStandardSkills()
      const result = res.data?.data
      if (result) {
        await loadStandardSkills()
        ElMessage.success(`扫描完成：发现 ${result.scanned} 个技能，同步 ${result.synced} 个到数据库`)
      }
      return result || null
    } catch (error: any) {
      ElMessage.error('扫描失败: ' + (error.response?.data?.message || error.message))
      return null
    } finally {
      scanning.value = false
    }
  }

  /** 导入技能 */
  const importSkill = async (
    file: File,
    options?: { appCode?: string; isPublic?: boolean; overwrite?: boolean },
  ): Promise<ImportResult | null> => {
    try {
      const res = await skillApi.importSkill(file, options)
      const result = res.data?.data
      if (result?.success) {
        ElMessage.success(`技能 "${result.skillName}" 导入成功`)
        await loadStandardSkills()
      }
      return result || null
    } catch (error: any) {
      ElMessage.error('导入失败: ' + (error.response?.data?.message || error.message))
      return null
    }
  }

  /** 刷新索引（扫描 + 同步 + 清除缓存） */
  const refreshIndex = async () => {
    try {
      await skillApi.refreshSkills()
      await loadStandardSkills()
      ElMessage.success('索引已刷新，数据库已同步，缓存已清除')
    } catch (error: any) {
      ElMessage.error('刷新失败: ' + (error.response?.data?.message || error.message))
    }
  }

  /** 清除指定技能缓存 */
  const invalidateSkillCache = async (name: string) => {
    try {
      await skillApi.invalidateSkillCache(name)
      ElMessage.success(`技能 "${name}" 的缓存已清除`)
    } catch (error: any) {
      ElMessage.error('清除缓存失败: ' + (error.response?.data?.message || error.message))
    }
  }

  /** 清除所有技能缓存 */
  const clearAllCache = async () => {
    try {
      await skillApi.clearAllSkillCache()
      ElMessage.success('所有技能缓存已清除')
    } catch (error: any) {
      ElMessage.error('清除缓存失败: ' + (error.response?.data?.message || error.message))
    }
  }

  /** 同步技能到数据库 */
  const syncToDatabase = async (): Promise<SyncResult | null> => {
    syncing.value = true
    try {
      const res = await skillApi.syncSkillsToDatabase()
      const result = res.data?.data
      if (result) {
        ElMessage.success(`已同步 ${result.synced} 个技能到数据库`)
      }
      return result || null
    } catch (error: any) {
      ElMessage.error('同步失败: ' + (error.response?.data?.message || error.message))
      return null
    } finally {
      syncing.value = false
    }
  }

  /** 获取技能统计信息 */
  const loadSkillStats = async () => {
    try {
      const res = await skillApi.getSkillStats()
      skillStats.value = res.data?.data || null
    } catch (error) {
      console.error('获取技能统计失败', error)
      skillStats.value = null
    }
  }

  /** 确认并清除所有缓存 */
  const confirmClearAllCache = async () => {
    try {
      await ElMessageBox.confirm('确定要清除所有技能缓存吗？清除后下次访问会重新加载。', '确认清除缓存', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await clearAllCache()
    } catch {
      // 用户取消
    }
  }

  return {
    standardSkills,
    scanning,
    syncing,
    skillStats,
    loadStandardSkills,
    scanSkills,
    importSkill,
    refreshIndex,
    invalidateSkillCache,
    clearAllCache,
    syncToDatabase,
    loadSkillStats,
    confirmClearAllCache,
  }
})