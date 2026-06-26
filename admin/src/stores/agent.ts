import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { agentApi, type Agent, type AgentForm, type AgentQueryParams } from '@/api/agent'

export const useAgentStore = defineStore('agent', () => {
  const agents = ref<Agent[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const queryParams = ref<AgentQueryParams>({})

  /**
   * 加载智能体列表
   * @param params 查询参数
   */
  const loadAgents = async (params?: AgentQueryParams) => {
    loading.value = true
    try {
      // 合并查询参数
      if (params) {
        queryParams.value = { ...queryParams.value, ...params }
        if (params.page !== undefined) page.value = params.page
        if (params.pageSize !== undefined) pageSize.value = params.pageSize
      }

      const res = await agentApi.getList({
        page: page.value,
        pageSize: pageSize.value,
        ...queryParams.value
      })

      agents.value = res.data.data?.list || []
      total.value = res.data.data?.total || 0
    } catch (error) {
      console.error('加载智能体失败', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 重置查询参数并重新加载
   */
  const resetAndLoad = async () => {
    page.value = 1
    queryParams.value = {}
    await loadAgents()
  }

  /**
   * 翻页
   * @param newPage 新页码
   */
  const changePage = async (newPage: number) => {
    page.value = newPage
    await loadAgents()
  }

  /**
   * 改变每页数量
   * @param newSize 新的每页数量
   */
  const changePageSize = async (newSize: number) => {
    pageSize.value = newSize
    page.value = 1
    await loadAgents()
  }

  /**
   * 搜索智能体
   * @param searchParams 搜索参数
   */
  const searchAgents = async (searchParams: AgentQueryParams) => {
    page.value = 1
    queryParams.value = { ...searchParams }
    await loadAgents()
  }

  /**
   * 创建智能体
   * @param data 智能体数据
   */
  const createAgent = async (data: AgentForm) => {
    await agentApi.create(data)
    await loadAgents()
  }

  /**
   * 更新智能体
   * @param id 智能体ID
   * @param data 智能体数据
   */
  const updateAgent = async (id: number, data: AgentForm) => {
    await agentApi.update(id, data)
    await loadAgents()
  }

  /**
   * 删除智能体
   * @param id 智能体ID
   */
  const deleteAgent = async (id: number) => {
    await agentApi.delete(id)
    await loadAgents()
  }

  const enabledAgents = computed(() => agents.value.filter(a => a.status))

  return {
    agents,
    loading,
    total,
    page,
    pageSize,
    queryParams,
    loadAgents,
    resetAndLoad,
    changePage,
    changePageSize,
    searchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    enabledAgents
  }
})
