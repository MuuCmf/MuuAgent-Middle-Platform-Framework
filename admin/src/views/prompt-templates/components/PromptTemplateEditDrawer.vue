<template>
  <el-drawer
    :model-value="visible"
    :title="editingTemplate ? $t('prompt.actions.edit') + ' Prompt ' + $t('prompt.title') : $t('prompt.actions.add') + ' Prompt ' + $t('prompt.title')"
    direction="rtl"
    size="700px"
    class="prompt-template-edit-drawer"
    @update:model-value="handleClose"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px" class="template-form">
      <div class="form-section">
        <div class="section-title">{{ $t('prompt.form.basicInfo') }}</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('prompt.form.templateName')" prop="name">
              <el-input v-model="form.name" :placeholder="$t('prompt.form.templateNamePlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('prompt.form.templateCode')" prop="code">
              <el-input
                v-model="form.code"
                :placeholder="$t('prompt.form.templateCodePlaceholder')"
                :disabled="!!editingTemplate"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="$t('prompt.form.category')" prop="category">
          <el-select v-model="form.category" class="w-full">
            <el-option :label="$t('prompt.categories.agent')" value="agent" />
            <el-option :label="$t('prompt.categories.rag')" value="rag" />
            <el-option :label="$t('prompt.categories.react')" value="react" />
            <el-option :label="$t('prompt.categories.skill')" value="skill" />
            <el-option :label="$t('prompt.categories.custom')" value="custom" />
          </el-select>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('prompt.form.appCode')">
              <AppSelector
                v-model="form.appCode"
                :placeholder="$t('prompt.form.appCodePlaceholder')"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('prompt.form.visibility')">
              <el-switch
                v-model="form.isPublic"
                :active-text="$t('prompt.list.public')"
                :inactive-text="$t('prompt.list.private')"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="$t('prompt.form.description')">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            :placeholder="$t('prompt.form.descriptionPlaceholder')"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('prompt.form.status')">
              <el-switch v-model="form.status" :active-text="$t('prompt.filter.enabled')"
                :inactive-text="$t('prompt.filter.disabled')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('prompt.form.defaultTemplate')">
              <el-switch v-model="form.isDefault" :active-text="$t('prompt.list.yes')"
                :inactive-text="$t('prompt.list.no')" />
              <el-tooltip :content="$t('prompt.form.defaultTemplateTip')" placement="top">
                <el-icon style="margin-left: 8px; color: #909399; cursor: help;"><QuestionFilled /></el-icon>
              </el-tooltip>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <div class="form-section">
        <div class="section-title">{{ $t('prompt.content.title') }}</div>
        <el-form-item :label="$t('prompt.content.promptContent')" prop="content">
          <div class="content-wrapper">
            <el-input
              v-model="form.content"
              type="textarea"
              :rows="12"
              :placeholder="$t('prompt.content.promptContentPlaceholder')"
            />
            <div class="content-help">
              <el-collapse>
                <el-collapse-item :title="$t('prompt.content.syntaxHelpTitle')">
                  <div class="help-content">
                    <p class="help-title">{{ $t('prompt.content.variableSyntax') }}</p>
                    <ul class="help-list">
                      <li>{{ $t('prompt.content.syntaxRule1') }}</li>
                      <li>{{ $t('prompt.content.syntaxRule2') }}</li>
                      <li>{{ $t('prompt.content.syntaxRule3') }}</li>
                    </ul>

                    <p class="help-title" style="margin-top: 12px;">{{ $t('prompt.content.exampleTitle') }}</p>
                    <pre class="example-code" v-pre>{{ exampleContent }}</pre>

                    <p class="help-tip">{{ $t('prompt.content.variableConfigTip') }}</p>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">
          {{ $t('prompt.variables.title') }}
          <el-button type="primary" size="small" @click="addVariable" style="margin-left: 12px;">
            <el-icon><Plus /></el-icon>
            {{ $t('prompt.actions.addVariable') }}
          </el-button>
        </div>

        <div v-if="form.variables && form.variables.length > 0" class="variables-list">
          <div v-for="(variable, index) in form.variables" :key="index" class="variable-item">
            <div class="variable-header">
              <span class="variable-index">{{ $t('prompt.variables.variableIndex', { index: index + 1 }) }}</span>
              <el-button type="danger" size="small" text @click="removeVariable(index)">
                <el-icon><Delete /></el-icon>
                {{ $t('prompt.actions.remove') }}
              </el-button>
            </div>

            <el-row :gutter="12">
              <el-col :span="10">
                <el-form-item :label="$t('prompt.variables.name')" :prop="`variables.${index}.name`">
                  <el-input v-model="variable.name" :placeholder="$t('prompt.variables.namePlaceholder')" />
                </el-form-item>
              </el-col>
              <el-col :span="10">
                <el-form-item :label="$t('prompt.variables.type')">
                  <el-select v-model="variable.type" class="w-full">
                    <el-option :label="$t('prompt.variables.types.string')" value="string" />
                    <el-option :label="$t('prompt.variables.types.number')" value="number" />
                    <el-option :label="$t('prompt.variables.types.boolean')" value="boolean" />
                    <el-option :label="$t('prompt.variables.types.object')" value="object" />
                    <el-option :label="$t('prompt.variables.types.array')" value="array" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item :label="$t('prompt.variables.required')" label-width="60px">
                  <el-switch v-model="variable.required" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item :label="$t('prompt.variables.description')">
              <el-input v-model="variable.description" :placeholder="$t('prompt.variables.descriptionPlaceholder')" />
            </el-form-item>

            <el-form-item v-if="!variable.required" :label="$t('prompt.variables.defaultValue')">
              <el-input v-model="variable.defaultValue" :placeholder="$t('prompt.variables.defaultValuePlaceholder')" />
            </el-form-item>
          </div>
        </div>

        <el-empty v-else :description="$t('prompt.variables.emptyDescription')" :image-size="80" />
      </div>

      <div class="form-section">
        <div class="section-title">{{ $t('prompt.advancedSettings.title') }}</div>
        <el-form-item :label="$t('prompt.advancedSettings.tags')">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            :placeholder="$t('prompt.advancedSettings.tagsPlaceholder')"
            class="w-full"
          >
            <el-option v-for="tag in defaultTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('prompt.advancedSettings.metadata')">
          <el-input
            v-model="metadataStr"
            type="textarea"
            :rows="3"
            :placeholder="$t('prompt.advancedSettings.metadataPlaceholder')"
          />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">{{ $t('prompt.actions.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          {{ editingTemplate ? $t('prompt.actions.save') : $t('prompt.actions.create') }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus, Delete, QuestionFilled } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { promptTemplateApi, type PromptTemplate, type PromptTemplateForm } from '@/api/prompt-template'
import AppSelector from '@/components/AppSelector.vue'

interface Props {
  visible: boolean
  template: PromptTemplate | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const formRef = ref<FormInstance>()
const saving = ref(false)

const form = reactive<PromptTemplateForm>({
  name: '',
  code: '',
  category: 'agent',
  content: '',
  variables: [],
  isDefault: false,
  status: true,
  description: '',
  tags: [],
  metadata: {},
  appCode: '',
  isPublic: false
})

const rules: FormRules = {
  name: [{ required: true, message: t('prompt.validation.nameRequired'), trigger: 'blur' }],
  code: [
    { required: true, message: t('prompt.validation.codeRequired'), trigger: 'blur' },
    {
      pattern: /^[a-z0-9-_]+$/,
      message: t('prompt.validation.codePattern'),
      trigger: 'blur'
    }
  ],
  category: [{ required: true, message: t('prompt.validation.categoryRequired'), trigger: 'change' }],
  content: [{ required: true, message: t('prompt.validation.contentRequired'), trigger: 'blur' }]
}

const defaultTags = ['推荐', '常用', '示例', '生产环境', '测试环境']

const exampleContent = computed(() => t('prompt.content.exampleContent'))

const metadataStr = computed({
  get: () => {
    try {
      return JSON.stringify(form.metadata, null, 2)
    } catch {
      return ''
    }
  },
  set: (value: string) => {
    try {
      form.metadata = JSON.parse(value)
    } catch {
    }
  }
})

const editingTemplate = computed(() => props.template)

const resetForm = () => {
  form.name = ''
  form.code = ''
  form.category = 'agent'
  form.content = ''
  form.variables = []
  form.isDefault = false
  form.status = true
  form.description = ''
  form.tags = []
  form.metadata = {}
  form.appCode = ''
  form.isPublic = false
}

watch(() => props.template, (newTemplate) => {
  if (newTemplate) {
    form.name = newTemplate.name
    form.code = newTemplate.code
    form.category = newTemplate.category
    form.content = newTemplate.content
    form.variables = newTemplate.variables ? JSON.parse(newTemplate.variables) : []
    form.isDefault = newTemplate.isDefault
    form.status = newTemplate.status
    form.description = newTemplate.description || ''
    form.tags = newTemplate.tags ? JSON.parse(newTemplate.tags) : []
    form.metadata = newTemplate.metadata ? JSON.parse(newTemplate.metadata) : {}
    form.appCode = newTemplate.appCode || ''
    form.isPublic = newTemplate.isPublic ?? false
  } else {
    resetForm()
  }
}, { immediate: true })

const addVariable = () => {
  if (!form.variables) {
    form.variables = []
  }
  form.variables.push({
    name: '',
    type: 'string',
    required: true,
    description: ''
  })
}

const removeVariable = (index: number) => {
  form.variables?.splice(index, 1)
}

const handleClose = () => {
  emit('update:visible', false)
  formRef.value?.resetFields()
}

const handleSave = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    saving.value = true

    if (editingTemplate.value) {
      await promptTemplateApi.update(form.code, form)
      ElMessage.success(t('prompt.messages.updateSuccess'))
    } else {
      await promptTemplateApi.create(form)
      ElMessage.success(t('prompt.messages.createSuccess'))
    }

    emit('save')
    handleClose()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || t('prompt.messages.saveFailed'))
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.prompt-template-edit-drawer {
  .template-form {
    padding: 0 20px;
  }

  .form-section {
    margin-bottom: 24px;

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
    }
  }

  .content-wrapper {
    width: 100%;

    .content-help {
      margin-top: 8px;
    }
  }

  .help-content {
    .help-title {
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 8px 0;
    }

    .help-list {
      margin: 0;
      padding-left: 20px;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.6;

      li {
        margin-bottom: 4px;
      }

      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
      }
    }

    .example-code {
      background: #1f2937;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
      overflow-x: auto;
      margin: 8px 0;
    }

    .help-tip {
      margin: 12px 0 0 0;
      padding: 8px 12px;
      background: #dbeafe;
      border-radius: 6px;
      font-size: 13px;
      color: #1e40af;
    }
  }

  .variables-list {
    .variable-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 12px;

      .variable-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .variable-index {
          font-weight: 600;
          color: #1f2937;
        }
      }
    }
  }

  .drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

.w-full {
  width: 100%;
}
</style>
