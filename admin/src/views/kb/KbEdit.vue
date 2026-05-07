<template>
  <div class="kb-edit">
    <div class="header">
      <el-button @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>{{ isEdit ? '编辑知识库' : '创建知识库' }}</h2>
    </div>

    <el-card>
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="知识库名称" prop="kbName">
          <el-input v-model="formData.kbName" placeholder="请输入知识库名称" />
        </el-form-item>
        <el-form-item label="知识库标识" prop="kbCode">
          <el-input v-model="formData.kbCode" placeholder="请输入知识库标识" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="向量模型" prop="embeddingModel">
          <el-input v-model="formData.embeddingModel" placeholder="请输入向量模型" />
        </el-form-item>
        <el-form-item label="切片大小" prop="chunkSize">
          <el-input-number v-model="formData.chunkSize" :min="100" :max="2000" />
          <span class="tip">（字符数）</span>
        </el-form-item>
        <el-form-item label="切片重叠" prop="chunkOverlap">
          <el-input-number v-model="formData.chunkOverlap" :min="0" :max="500" />
          <span class="tip">（字符数）</span>
        </el-form-item>
        <el-form-item label="相似度阈值" prop="similarityThresh">
          <el-input-number v-model="formData.similarityThresh" :min="0" :max="1" :step="0.1" :precision="1" />
          <span class="tip">（0-1之间）</span>
        </el-form-item>
        <el-form-item label="召回条数" prop="topN">
          <el-input-number v-model="formData.topN" :min="1" :max="20" />
          <span class="tip">（检索时返回的文档片段数量）</span>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">保存</el-button>
          <el-button @click="handleBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { kbApi } from '@/api'
import type { FormInstance, FormRules } from 'element-plus'

const route = useRoute()
const router = useRouter()

const isEdit = ref(false)
const kbId = route.params.id as string
const loading = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const formData = reactive({
  kbName: '',
  kbCode: '',
  embeddingModel: '',
  chunkSize: 500,
  chunkOverlap: 100,
  similarityThresh: 0.7,
  topN: 5,
  description: ''
})

const rules: FormRules = {
  kbName: [{ required: true, message: '请输入知识库名称', trigger: 'blur' }],
  kbCode: [{ required: true, message: '请输入知识库标识', trigger: 'blur' }]
}

const fetchKbDetail = async () => {
  if (!kbId) return
  
  loading.value = true
  isEdit.value = true
  try {
    const response = await kbApi.getDetail(kbId)
    const data = response.data.data
    Object.assign(formData, {
      kbName: data.kbName,
      kbCode: data.kbCode,
      embeddingModel: data.embeddingModel,
      chunkSize: data.chunkSize,
      chunkOverlap: data.chunkOverlap,
      similarityThresh: data.similarityThresh,
      topN: data.topN,
      description: data.description
    })
  } catch (error: any) {
    ElMessage.error(error.message || '获取知识库详情失败')
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  router.push('/kb/list')
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        if (isEdit.value) {
          await kbApi.update({
            kbId,
            ...formData
          })
          ElMessage.success('更新成功')
        } else {
          await kbApi.create(formData)
          ElMessage.success('创建成功')
        }
        router.push('/kb/list')
      } catch (error: any) {
        ElMessage.error(error.message || '操作失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

onMounted(() => {
  if (kbId) {
    fetchKbDetail()
  }
})
</script>

<style scoped lang="scss">
.kb-edit {
  padding: 20px;

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    gap: 20px;

    h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
  }

  .tip {
    margin-left: 12px;
    color: #909399;
    font-size: 12px;
  }
}
</style>
