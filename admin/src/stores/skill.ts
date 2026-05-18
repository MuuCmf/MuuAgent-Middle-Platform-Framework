import { defineStore } from 'pinia'
import { ref } from 'vue'
import { skillApi, type Skill, type SkillForm, type StandardSkill, type ScanResult, type ImportResult } from '@/api/skill'
import { ElMessage } from 'element-plus'

export const useSkillStore = defineStore('skill', () => {
  const skills = ref<Skill[]>([])
  const standardSkills = ref<StandardSkill[]>([])
  const loading = ref(false)
  const scanning = ref(false)

  // ===== DB 技能 CRUD =====

  const loadSkills = async () => {
    loading.value = true
    try {
      const res = await skillApi.getList()
      if (res.data && res.data.data) {
        skills.value = res.data.data.list || []
      } else {
        skills.value = []
      }
    } catch (error) {
      console.error('加载技能失败', error)
      skills.value = []
    } finally {
      loading.value = false
    }
  }

  const createSkill = async (data: SkillForm) => {
    await skillApi.create(data)
    await loadSkills()
  }

  const updateSkill = async (id: number, data: SkillForm) => {
    await skillApi.update(id, data)
    await loadSkills()
  }

  const deleteSkill = async (id: number) => {
    await skillApi.delete(id)
    await loadSkills()
  }

  // ===== 标准技能操作 =====

  const loadStandardSkills = async () => {
    try {
      const res = await skillApi.listStandardSkills()
      standardSkills.value = res.data?.data || []
    } catch (error) {
      console.error('加载标准技能失败', error)
      standardSkills.value = []
    }
  }

  const scanSkills = async (): Promise<ScanResult | null> => {
    scanning.value = true
    try {
      const res = await skillApi.scanStandardSkills()
      const result = res.data?.data
      if (result) {
        standardSkills.value = result.skills || []
        ElMessage.success(`扫描完成，发现 ${result.skills?.length || 0} 个技能`)
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
    mode: 'database' | 'filesystem',
    options?: { appCode?: string; isPublic?: boolean; overwrite?: boolean }
  ): Promise<ImportResult | null> => {
    try {
      const res = await skillApi.importSkill(file, mode, options)
      const result = res.data?.data
      if (result?.success) {
        ElMessage.success(`技能 "${result.skillName}" 导入成功`)
        await loadSkills()
        await loadStandardSkills()
      }
      return result || null
    } catch (error: any) {
      ElMessage.error('导入失败: ' + (error.response?.data?.message || error.message))
      return null
    }
  }

  const exportSkill = async (id: number, skillName: string) => {
    try {
      const res = await skillApi.exportSkill(id)
      // 触发浏览器下载
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${skillName}.zip`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      ElMessage.success('导出成功')
    } catch (error: any) {
      ElMessage.error('导出失败: ' + (error.response?.data?.message || error.message))
    }
  }

  return {
    skills,
    standardSkills,
    loading,
    scanning,
    // DB CRUD
    loadSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    // 标准技能
    loadStandardSkills,
    scanSkills,
    importSkill,
    exportSkill,
  }
})
