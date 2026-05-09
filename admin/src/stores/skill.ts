import { defineStore } from 'pinia'
import { ref } from 'vue'
import { skillApi, type Skill, type SkillForm } from '@/api/skill'

export const useSkillStore = defineStore('skill', () => {
  const skills = ref<Skill[]>([])
  const loading = ref(false)

  const loadSkills = async () => {
    loading.value = true
    try {
      const res = await skillApi.getList()
      console.log('技能列表响应:', res)
      
      if (res.data && res.data.data) {
        skills.value = res.data.data.list || []
        console.log('加载技能成功，数量:', skills.value.length)
      } else {
        console.error('技能列表响应数据格式错误:', res.data)
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

  return {
    skills,
    loading,
    loadSkills,
    createSkill,
    updateSkill,
    deleteSkill
  }
})
