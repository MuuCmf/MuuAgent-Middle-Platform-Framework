import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { agentApi, type Agent, type AgentForm } from '@/api/agent'

export const useAgentStore = defineStore('agent', () => {
  const agents = ref<Agent[]>([])
  const loading = ref(false)

  const loadAgents = async () => {
    loading.value = true
    try {
      const res = await agentApi.getList()
      agents.value = res.data.data?.list || []
    } catch (error) {
      console.error('加载智能体失败', error)
    } finally {
      loading.value = false
    }
  }

  const createAgent = async (data: AgentForm) => {
    await agentApi.create(data)
    await loadAgents()
  }

  const updateAgent = async (id: number, data: AgentForm) => {
    await agentApi.update(id, data)
    await loadAgents()
  }

  const deleteAgent = async (id: number) => {
    await agentApi.delete(id)
    await loadAgents()
  }

  const enabledAgents = computed(() => agents.value.filter(a => a.status))

  return {
    agents,
    loading,
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    enabledAgents
  }
})
