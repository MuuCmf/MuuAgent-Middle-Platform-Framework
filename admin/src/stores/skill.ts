import { defineStore } from 'pinia'
import { ref } from 'vue'
import { skillApi, type StandardSkill, type ScanResult, type ImportResult } from '@/api/skill'
import { ElMessage } from 'element-plus'

export const useSkillStore = defineStore('skill', () => {
  const standardSkills = ref<StandardSkill[]>([])
  const scanning = ref(false)

  // ===== 标准技能操作 =====

  const loadStandardSkills = async (appCode?: string) => {
    try {
      const res = await skillApi.listStandardSkills(appCode)
      standardSkills.value = res.data?.data || []
    } catch (error) {
      console.error('加载标准技能失败', error)
      standardSkills.value = []
    }
  }

  const scanSkills = async (appCode?: string): Promise<ScanResult | null> => {
    scanning.value = true
    try {
      const res = await skillApi.scanStandardSkills()
      const result = res.data?.data
      if (result) {
        await loadStandardSkills(appCode)
        ElMessage.success(`扫描完成，发现 ${standardSkills.value.length} 个技能`)
      }
      return result || null
    } catch (error: any) {
      ElMessage.error('扫描失败: ' + (error.response?.data?.message || error.message))
      return null
    } finally {
      scanning.value = false
    }
  }

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

  const refreshIndex = async () => {
    try {
      await skillApi.refreshSkills()
      await loadStandardSkills()
      ElMessage.success('索引已刷新')
    } catch (error: any) {
      ElMessage.error('刷新失败: ' + (error.response?.data?.message || error.message))
    }
  }

  return {
    standardSkills,
    scanning,
    loadStandardSkills,
    scanSkills,
    importSkill,
    refreshIndex,
  }
})
