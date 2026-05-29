<template>
  <el-drawer
    :model-value="visible"
    :title="voice ? $t('voice.editVoice') : $t('voice.addVoice')"
    :size="500"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      label-position="top"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('voice.voiceName')" prop="name">
            <el-input
              v-model="form.name"
              :placeholder="$t('voice.namePlaceholder')"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('voice.voiceCode')" prop="code">
            <el-input
              v-model="form.code"
              :placeholder="$t('voice.codePlaceholder')"
              :disabled="!!voice"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('voice.voiceId')" prop="voiceId">
            <el-input
              v-model="form.voiceId"
              :placeholder="$t('voice.voiceIdPlaceholder')"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('voice.provider')" prop="provider">
            <el-select v-model="form.provider" style="width: 100%;">
              <el-option :label="$t('voice.providerOpenai')" value="openai" />
              <el-option :label="$t('voice.providerAzure')" value="azure" />
              <el-option :label="$t('voice.providerAliyun')" value="aliyun" />
              <el-option :label="$t('voice.providerVolcengine')" value="volcengine" />
              <el-option :label="$t('voice.providerLocal')" value="local" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('voice.modelCode')" prop="modelCode">
        <el-select v-model="form.modelCode" style="width: 100%;" clearable :placeholder="$t('voice.modelCodePlaceholder')">
          <el-option
            v-for="model in ttsModels"
            :key="model.code"
            :label="model.name"
            :value="model.code"
          />
        </el-select>
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item :label="$t('voice.language')" prop="language">
            <el-select v-model="form.language" style="width: 100%;">
              <el-option :label="$t('voice.languageZh')" value="zh-CN" />
              <el-option :label="$t('voice.languageEn')" value="en-US" />
              <el-option :label="$t('voice.languageJa')" value="ja-JP" />
              <el-option :label="$t('voice.languageKo')" value="ko-KR" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('voice.gender')" prop="gender">
            <el-select v-model="form.gender" style="width: 100%;" clearable>
              <el-option :label="$t('voice.male')" value="male" />
              <el-option :label="$t('voice.female')" value="female" />
              <el-option :label="$t('voice.neutral')" value="neutral" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('voice.sampleRate')" prop="sampleRate">
        <el-select v-model="form.sampleRate" style="width: 100%;">
          <el-option label="8000 Hz" :value="8000" />
          <el-option label="16000 Hz" :value="16000" />
          <el-option label="22050 Hz" :value="22050" />
          <el-option label="24000 Hz" :value="24000" />
          <el-option label="44100 Hz" :value="44100" />
          <el-option label="48000 Hz" :value="48000" />
        </el-select>
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('voice.status')" prop="status">
            <el-switch v-model="form.status" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('voice.isDefault')" prop="isDefault">
            <el-switch v-model="form.isDefault" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { voiceProfileApi, type VoiceProfile, type VoiceProfileForm } from '@/api/voice-profile'
import { modelApi, type Model } from '@/api/model'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  visible: boolean
  voice: VoiceProfile | null
}>(), {
  visible: false,
  voice: null,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const ttsModels = ref<Model[]>([])

/**
 * 获取启用的TTS模型列表
 */
async function fetchTTSModels() {
  try {
    const res = await modelApi.getByType('tts')
    ttsModels.value = res.data.data?.list || []
  } catch (error) {
    ttsModels.value = []
  }
}

// 监听抽屉打开状态，打开时获取TTS模型列表
watch(() => props.visible, (visible) => {
  if (visible) {
    fetchTTSModels()
  }
}, { immediate: true })

const formRef = ref()
const saving = ref(false)

const form = reactive<VoiceProfileForm>({
  name: '',
  code: '',
  voiceId: '',
  provider: 'openai',
  modelCode: '',
  language: 'zh-CN',
  gender: '',
  sampleRate: 24000,
  isDefault: false,
  status: true,
})

const rules = {
  name: [{ required: true, message: t('voice.nameRequired'), trigger: 'blur' }],
  code: [{ required: true, message: t('voice.codeRequired'), trigger: 'blur' }],
  voiceId: [{ required: true, message: t('voice.voiceIdRequired'), trigger: 'blur' }],
  provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
  language: [{ required: true, message: '请选择语言', trigger: 'change' }],
}

watch(() => props.voice, (voice) => {
  if (voice) {
    form.name = voice.name
    form.code = voice.code
    form.voiceId = voice.voiceId
    form.provider = voice.provider
    form.modelCode = voice.modelCode || ''
    form.language = voice.language
    form.gender = voice.gender || ''
    form.sampleRate = voice.sampleRate
    form.isDefault = voice.isDefault
    form.status = voice.status
  } else {
    form.name = ''
    form.code = ''
    form.voiceId = ''
    form.provider = 'openai'
    form.modelCode = ''
    form.language = 'zh-CN'
    form.gender = ''
    form.sampleRate = 24000
    form.isDefault = false
    form.status = true
  }
}, { immediate: true })

/**
 * 保存
 */
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (props.voice) {
      await voiceProfileApi.update(props.voice.id, form)
    } else {
      await voiceProfileApi.create(form)
    }
    ElMessage.success(t('voice.saveSuccess'))
    emit('success')
    emit('update:visible', false)
  } catch (error: any) {
    if (error?.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    }
  } finally {
    saving.value = false
  }
}

/**
 * 关闭
 */
function handleClose() {
  emit('update:visible', false)
}
</script>
