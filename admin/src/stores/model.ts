import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { modelApi, type Model, type ModelForm } from '@/api/model'

export const useModelStore = defineStore('model', () => {
  const models = ref<Model[]>([])
  const loading = ref(false)

  const loadModels = async () => {
    loading.value = true
    try {
      const res = await modelApi.getList()
      const modelList = res.data?.data?.list || []
      models.value = modelList
      console.log('模型列表已更新，共', modelList.length, '个模型')
    } catch (error) {
      console.error('加载模型失败', error)
      models.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  const createModel = async (data: ModelForm) => {
    await modelApi.create(data)
    await loadModels()
  }

  const updateModel = async (id: number, data: ModelForm) => {
    await modelApi.update(id, data)
    await loadModels()
  }

  const deleteModel = async (id: number) => {
    try {
      await modelApi.delete(id)
      await loadModels()
    } catch (error) {
      console.error('删除模型失败', error)
      throw error
    }
  }

  const enabledModels = computed(() => models.value.filter(m => m.status))

  return {
    models,
    loading,
    loadModels,
    createModel,
    updateModel,
    deleteModel,
    enabledModels
  }
})
