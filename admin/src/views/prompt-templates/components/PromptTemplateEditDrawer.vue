<template>
  <el-drawer
    :model-value="visible"
    :title="editingTemplate ? '编辑 Prompt 模板' : '添加 Prompt 模板'"
    direction="rtl"
    size="700px"
    class="prompt-template-edit-drawer"
    @update:model-value="handleClose"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px" class="template-form">
      <div class="form-section">
        <div class="section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="form.name" placeholder="如：RAG 问答提示词" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模板标识" prop="code">
              <el-input
                v-model="form.code"
                placeholder="如：rag-chat-default"
                :disabled="!!editingTemplate"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" class="w-full">
            <el-option label="Agent - 智能体提示词" value="agent" />
            <el-option label="RAG - 知识库问答" value="rag" />
            <el-option label="ReAct - 推理模式" value="react" />
            <el-option label="Skill - 技能调用" value="skill" />
            <el-option label="Custom - 自定义" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="描述该模板的用途和适用场景"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="状态">
              <el-switch v-model="form.status" active-text="启用" inactive-text="禁用" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="默认模板">
              <el-switch v-model="form.isDefault" active-text="是" inactive-text="否" />
              <el-tooltip content="设为默认后，该分类下的智能体会自动使用此模板" placement="top">
                <el-icon style="margin-left: 8px; color: #909399; cursor: help;"><QuestionFilled /></el-icon>
              </el-tooltip>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <div class="form-section">
        <div class="section-title">模板内容</div>
        <el-form-item label="Prompt 内容" prop="content">
          <div class="content-wrapper">
            <el-input
              v-model="form.content"
              type="textarea"
              :rows="12"
              placeholder="输入 Prompt 模板内容，使用 {{变量名}} 作为变量占位符"
            />
            <div class="content-help">
              <el-collapse>
                <el-collapse-item title="📝 查看模板语法说明">
                  <div class="help-content">
                    <p class="help-title">变量语法：</p>
                    <ul class="help-list">
                      <li>使用 <code v-pre>{{变量名}}</code> 定义变量占位符</li>
                      <li>变量名建议使用驼峰命名，如：<code v-pre>{{userName}}</code></li>
                      <li>渲染时会自动替换为实际值</li>
                    </ul>

                    <p class="help-title" style="margin-top: 12px;">示例：</p>
                    <pre class="example-code" v-pre>你是一个专业的问答助手。

## 参考信息
{{context}}

## 用户问题
{{query}}

请基于参考信息回答用户问题。</pre>

                    <p class="help-tip">💡 变量会在下方"变量定义"中配置</p>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">
          变量定义
          <el-button type="primary" size="small" @click="addVariable" style="margin-left: 12px;">
            <el-icon><Plus /></el-icon>
            添加变量
          </el-button>
        </div>

        <div v-if="form.variables && form.variables.length > 0" class="variables-list">
          <div v-for="(variable, index) in form.variables" :key="index" class="variable-item">
            <div class="variable-header">
              <span class="variable-index">变量 {{ index + 1 }}</span>
              <el-button type="danger" size="small" text @click="removeVariable(index)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>

            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="变量名" :prop="`variables.${index}.name`">
                  <el-input v-model="variable.name" placeholder="如：userName" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="类型">
                  <el-select v-model="variable.type">
                    <el-option label="字符串" value="string" />
                    <el-option label="数字" value="number" />
                    <el-option label="布尔值" value="boolean" />
                    <el-option label="对象" value="object" />
                    <el-option label="数组" value="array" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="必填">
                  <el-switch v-model="variable.required" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="描述">
              <el-input v-model="variable.description" placeholder="描述该变量的用途" />
            </el-form-item>

            <el-form-item v-if="!variable.required" label="默认值">
              <el-input v-model="variable.defaultValue" placeholder="可选变量的默认值" />
            </el-form-item>
          </div>
        </div>

        <el-empty v-else description="暂无变量定义" :image-size="80" />
      </div>

      <div class="form-section">
        <div class="section-title">高级设置</div>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入标签后回车添加"
            class="w-full"
          >
            <el-option v-for="tag in defaultTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>

        <el-form-item label="元数据">
          <el-input
            v-model="metadataStr"
            type="textarea"
            :rows="3"
            placeholder='JSON 格式的元数据，如：{"author": "admin", "version": "1.0"}'
          />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          {{ editingTemplate ? '保存' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, QuestionFilled } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { promptTemplateApi, type PromptTemplate, type PromptTemplateForm } from '@/api/prompt-template'

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
  metadata: {}
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  code: [
    { required: true, message: '请输入模板标识', trigger: 'blur' },
    { pattern: /^[a-z0-9-_]+$/, message: '标识只能包含小写字母、数字、中划线和下划线', trigger: 'blur' }
  ],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  content: [{ required: true, message: '请输入 Prompt 内容', trigger: 'blur' }]
}

const defaultTags = ['推荐', '常用', '示例', '生产环境', '测试环境']

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
      // 忽略解析错误
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
      ElMessage.success('更新成功')
    } else {
      await promptTemplateApi.create(form)
      ElMessage.success('创建成功')
    }

    emit('save')
    handleClose()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '保存失败')
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
