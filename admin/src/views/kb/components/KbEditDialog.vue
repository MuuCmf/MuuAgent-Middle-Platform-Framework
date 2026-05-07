<template>
  <el-dialog v-model="dialogVisibleLocal" :title="isEdit ? '编辑知识库' : '创建知识库'" width="600px">
    <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px">
      <el-form-item label="知识库名称" prop="kbName">
        <el-input v-model="formData.kbName" placeholder="请输入知识库名称" />
      </el-form-item>
      <el-form-item label="知识库标识" prop="kbCode">
        <el-input v-model="formData.kbCode" placeholder="请输入知识库标识" :disabled="isEdit" />
      </el-form-item>
      <el-form-item label="检索方式" prop="retrievalMethod">
        <el-select v-model="formData.retrievalMethod" placeholder="请选择检索方式" style="width: 100%">
          <el-option label="向量检索" value="vector" />
          <el-option label="BM25检索" value="bm25" />
        </el-select>
        <span style="margin-left: 8px; color: #909399; font-size: 12px;">向量检索需要Embedding模型</span>
      </el-form-item>
      <el-form-item v-if="formData.retrievalMethod === 'vector'" label="向量模型" prop="embeddingModel">
        <el-select 
          v-model="formData.embeddingModel" 
          placeholder="请选择向量模型" 
          style="width: 100%"
          :disabled="embeddingModels.length === 0"
        >
          <el-option
            v-for="model in embeddingModels"
            :key="model.id"
            :label="model.name"
            :value="model.code"
          >
            <span style="float: left">{{ model.name }}</span>
            <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">
              {{ model.provider }}
            </span>
          </el-option>
        </el-select>
        <div v-if="embeddingModels.length === 0" style="color: var(--el-text-color-secondary); font-size: 12px; margin-top: 4px">
          暂无可用的向量模型，请先在「模型配置」中添加向量模型
        </div>
      </el-form-item>
      <el-form-item label="切片大小" prop="chunkSize">
        <el-input-number v-model="formData.chunkSize" :min="100" :max="2000" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px;">字符数</span>
      </el-form-item>
      <el-form-item label="切片重叠" prop="chunkOverlap">
        <el-input-number v-model="formData.chunkOverlap" :min="0" :max="500" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px;">字符数</span>
      </el-form-item>
      <el-form-item label="相似度阈值" prop="similarityThresh">
        <el-input-number v-model="formData.similarityThresh" :min="0" :max="1" :step="0.1" :precision="1" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px;">范围 0-1</span>
      </el-form-item>
      <el-form-item label="召回条数" prop="topN">
        <el-input-number v-model="formData.topN" :min="1" :max="20" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px;">条</span>
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="请输入描述" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { kbApi, modelApi } from '@/api'
import type { KbInfo } from '@/api/kb'
import type { Model } from '@/api/model'
import type { FormInstance, FormRules } from 'element-plus'

const props = defineProps<{
  visible: boolean
  editData?: KbInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const submitting = ref(false)
const formRef = ref<FormInstance>()
const embeddingModels = ref<Model[]>([])
const dialogVisibleLocal = ref(false)

const isEdit = ref(false)
const currentKbId = ref('')

const formData = reactive({
  kbName: '',
  kbCode: '',
  embeddingModel: '',
  chunkSize: 500,
  chunkOverlap: 100,
  similarityThresh: 0.7,
  topN: 5,
  retrievalMethod: 'vector',
  description: ''
})

const rules: FormRules = {
  kbName: [{ required: true, message: '请输入知识库名称', trigger: 'blur' }],
  kbCode: [{ required: true, message: '请输入知识库标识', trigger: 'blur' }],
  embeddingModel: [
    { 
      validator: (_rule, value, callback) => {
        if (formData.retrievalMethod === 'vector' && !value) {
          callback(new Error('请选择向量模型'))
        } else {
          callback()
        }
      }, 
      trigger: 'change' 
    }
  ]
}

const fetchEmbeddingModels = async () => {
  try {
    const response = await modelApi.getList()
    const allModels = response.data.data.list || []
    embeddingModels.value = allModels.filter((model: Model) => {
      if (!model.status) return false
      const isEmbeddingType = model.type === 'embedding'
      const hasEmbeddingTag = model.tags && model.tags.includes('embedding')
      return isEmbeddingType || hasEmbeddingTag
    })
  } catch (error: any) {
    console.error('获取模型列表失败:', error)
  }
}

const resetForm = () => {
  Object.assign(formData, {
    kbName: '',
    kbCode: '',
    embeddingModel: '',
    chunkSize: 500,
    chunkOverlap: 100,
    similarityThresh: 0.7,
    topN: 5,
    retrievalMethod: 'vector',
    description: ''
  })
}

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        const userStr = localStorage.getItem('admin_user')
        const user = userStr ? JSON.parse(userStr) : null
        
        if (!user?.id) {
          ElMessage.error('用户信息获取失败，请重新登录')
          return
        }
        
        if (isEdit.value) {
          await kbApi.update({
            uid: user.id,
            kbId: currentKbId.value,
            ...formData
          })
          ElMessage.success('更新成功')
        } else {
          await kbApi.create({
            uid: user.id,
            ...formData
          })
          ElMessage.success('创建成功')
        }
        
        emit('update:visible', false)
        emit('success')
      } catch (error: any) {
        ElMessage.error(error.message || '操作失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

watch(() => props.visible, (val) => {
  dialogVisibleLocal.value = val
  if (val) {
    if (props.editData) {
      isEdit.value = true
      currentKbId.value = props.editData.kbId
      Object.assign(formData, {
        kbName: props.editData.kbName,
        kbCode: props.editData.kbCode,
        embeddingModel: props.editData.embeddingModel,
        chunkSize: props.editData.chunkSize,
        chunkOverlap: props.editData.chunkOverlap,
        similarityThresh: props.editData.similarityThresh,
        topN: props.editData.topN,
        retrievalMethod: props.editData.retrievalMethod || 'vector',
        description: props.editData.description
      })
    } else {
      isEdit.value = false
      currentKbId.value = ''
      resetForm()
    }
  }
})

watch(dialogVisibleLocal, (val) => {
  emit('update:visible', val)
})

onMounted(() => {
  fetchEmbeddingModels()
})
</script>
