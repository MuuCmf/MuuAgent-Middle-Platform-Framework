<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? $t('knowledge.editDialog.editTitle') : $t('knowledge.editDialog.createTitle')"
    width="600px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      label-position="top"
    >
      <el-form-item :label="$t('knowledge.editDialog.form.kbName')" prop="kbName">
        <el-input v-model="formData.kbName" :placeholder="$t('knowledge.editDialog.form.kbNamePlaceholder')" />
      </el-form-item>

      <el-form-item :label="$t('knowledge.editDialog.form.kbCode')" prop="kbCode">
        <el-input v-model="formData.kbCode" :placeholder="$t('knowledge.editDialog.form.kbCodePlaceholder')" />
      </el-form-item>

      <el-form-item :label="$t('knowledge.editDialog.form.appCode')">
        <el-select v-model="formData.appCode" :placeholder="$t('knowledge.editDialog.form.appCodePlaceholder')"
          clearable style="width: 100%">
          <el-option v-for="app in appList" :key="app.appCode" :label="app.appName" :value="app.appCode" />
        </el-select>
      </el-form-item>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item :label="$t('knowledge.editDialog.form.isPublic')">
            <el-switch v-model="formData.isPublic" :active-text="$t('knowledge.filter.public')"
              :inactive-text="$t('knowledge.filter.private')" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('knowledge.editDialog.form.retrievalMethod')">
            <el-select v-model="formData.retrievalMethod" :placeholder="$t('knowledge.editDialog.form.retrievalMethodPlaceholder')"
              style="width: 100%" @change="handleRetrievalMethodChange">
              <el-option :label="$t('knowledge.editDialog.form.vectorRetrieval')" value="vector" />
              <el-option :label="$t('knowledge.editDialog.form.bm25Retrieval')" value="bm25" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div class="retrieval-tip" v-if="formData.retrievalMethod === 'vector'">
        <el-alert type="info" show-icon :closable="false">
          {{ $t('knowledge.editDialog.form.retrievalMethodTip') }}
        </el-alert>
      </div>

      <template v-if="formData.retrievalMethod === 'vector'">
        <el-form-item :label="$t('knowledge.editDialog.form.embeddingModel')" prop="embeddingModel">
          <el-select v-model="formData.embeddingModel" :placeholder="$t('knowledge.editDialog.form.embeddingModelPlaceholder')"
            style="width: 100%" :no-data-text="$t('knowledge.editDialog.form.noEmbeddingModelTip')">
            <el-option v-for="model in embeddingModelList" :key="model.modelId" :label="model.modelName"
              :value="model.modelId" />
          </el-select>
        </el-form-item>
      </template>

      <el-divider />

      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item :label="$t('knowledge.editDialog.form.chunkSize')">
            <el-input-number v-model="formData.chunkSize" :min="50" :max="2000" :step="50" controls-position="right"
              style="width: 100%" />
            <span class="unit">{{ $t('knowledge.editDialog.form.chunkSizeUnit') }}</span>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item :label="$t('knowledge.editDialog.form.chunkOverlap')">
            <el-input-number v-model="formData.chunkOverlap" :min="0" :max="500" :step="10" controls-position="right"
              style="width: 100%" />
            <span class="unit">{{ $t('knowledge.editDialog.form.chunkOverlapUnit') }}</span>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item :label="$t('knowledge.editDialog.form.similarityThreshold')">
            <el-slider v-model="formData.similarityThresh" :min="0" :max="1" :step="0.01" show-stops />
            <span class="tip">{{ $t('knowledge.editDialog.form.similarityThresholdRange') }}</span>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item :label="$t('knowledge.editDialog.form.topN')">
            <el-input-number v-model="formData.topN" :min="1" :max="20" :step="1" controls-position="right"
              style="width: 100%" />
            <span class="unit">{{ $t('knowledge.editDialog.form.topNUnit') }}</span>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('knowledge.editDialog.form.description')">
        <el-input v-model="formData.description" type="textarea" :rows="3"
          :placeholder="$t('knowledge.editDialog.form.descriptionPlaceholder')" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ $t('knowledge.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('knowledge.actions.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { kbApi, modelApi, appApi } from '@/api'
import type { KbInfo } from '@/api/kb'

const props = defineProps<{
  visible: boolean
  editData?: KbInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const { t } = useI18n()

const formRef = ref<FormInstance>()
const submitLoading = ref(false)
const appList = ref<any[]>([])
const embeddingModelList = ref<any[]>([])

const isEdit = computed(() => !!props.editData)

const formData = ref({
  kbName: '',
  kbCode: '',
  appCode: '',
  isPublic: false,
  retrievalMethod: 'vector',
  embeddingModel: '',
  chunkSize: 500,
  chunkOverlap: 50,
  similarityThresh: 0.7,
  topN: 3,
  description: ''
})

const formRules: FormRules = {
  kbName: [
    { required: true, message: t('knowledge.editDialog.validation.kbNameRequired'), trigger: 'blur' }
  ],
  kbCode: [
    { required: true, message: t('knowledge.editDialog.validation.kbCodeRequired'), trigger: 'blur' }
  ]
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal && props.editData) {
      formData.value = {
        kbName: props.editData.kbName || '',
        kbCode: props.editData.kbCode || '',
        appCode: props.editData.appCode || '',
        isPublic: props.editData.isPublic || false,
        retrievalMethod: props.editData.retrievalMethod || 'vector',
        embeddingModel: props.editData.embeddingModel || '',
        chunkSize: props.editData.chunkSize || 500,
        chunkOverlap: props.editData.chunkOverlap || 50,
        similarityThresh: props.editData.similarityThresh || 0.7,
        topN: props.editData.topN || 3,
        description: props.editData.description || ''
      }
    } else if (newVal) {
      formData.value = {
        kbName: '',
        kbCode: '',
        appCode: '',
        isPublic: false,
        retrievalMethod: 'vector',
        embeddingModel: '',
        chunkSize: 500,
        chunkOverlap: 50,
        similarityThresh: 0.7,
        topN: 3,
        description: ''
      }
    }
  }
)

onMounted(async () => {
  try {
    const [appsRes, modelsRes] = await Promise.all([
      appApi.getList({ page: 1, pageSize: 1000 }),
      modelApi.getList()
    ])
    appList.value = appsRes.data.data.list
    embeddingModelList.value = modelsRes.data.data.list.filter((m: any) => m.modelType === 'embedding')
  } catch (error: any) {
    ElMessage.error(error.message || t('knowledge.messages.fetchModelListFailed'))
  }
})

const handleRetrievalMethodChange = () => {
  if (formData.value.retrievalMethod === 'bm25') {
    formData.value.embeddingModel = ''
  }
}

const handleClose = () => {
  emit('update:visible', false)
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  if (formData.value.retrievalMethod === 'vector' && !formData.value.embeddingModel) {
    ElMessage.warning(t('knowledge.editDialog.validation.embeddingModelRequired'))
    return
  }

  submitLoading.value = true

  try {
    const userStr = localStorage.getItem('admin_user')
    const user = userStr ? JSON.parse(userStr) : null

    if (!user?.id) {
      ElMessage.error(t('knowledge.messages.getUserInfoFailed'))
      return
    }

    if (isEdit.value) {
      await kbApi.update({
        uid: user.id,
        kbId: props.editData!.kbId,
        ...formData.value
      })
      ElMessage.success(t('knowledge.messages.updateSuccess'))
    } else {
      await kbApi.create({
        uid: user.id,
        ...formData.value
      })
      ElMessage.success(t('knowledge.messages.createSuccess'))
    }

    handleClose()
    emit('success')
  } catch (error: any) {
    ElMessage.error(error.message || t('knowledge.messages.operationFailed'))
  } finally {
    submitLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.unit {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.tip {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.retrieval-tip {
  margin-bottom: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
