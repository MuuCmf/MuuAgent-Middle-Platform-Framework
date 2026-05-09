<template>
  <div class="sandbox-code-editor">
    <el-form-item label="代码编辑">
      <div class="editor-container">
        <el-input
          v-model="localCode"
          type="textarea"
          :rows="15"
          placeholder="请输入 JavaScript 代码"
          @change="handleChange"
        />
      </div>
    </el-form-item>

    <el-form-item>
      <el-space>
        <el-button type="primary" @click="analyzeCode" :loading="analyzing">
          代码分析
        </el-button>
        <el-button type="success" @click="showTestDialog = true">
          测试代码
        </el-button>
      </el-space>
    </el-form-item>

    <el-form-item v-if="analysisResult" label="分析结果">
      <div class="analysis-result">
        <el-alert
          v-if="analysisResult.valid"
          title="代码验证通过"
          type="success"
          :closable="false"
          show-icon
        />
        <el-alert
          v-else
          title="代码验证失败"
          type="error"
          :closable="false"
          show-icon
        />

        <div v-if="analysisResult.errors.length > 0" class="error-list">
          <div class="section-title">错误：</div>
          <el-tag
            v-for="(error, index) in analysisResult.errors"
            :key="index"
            type="danger"
            class="error-tag"
          >
            {{ error }}
          </el-tag>
        </div>

        <div v-if="analysisResult.warnings.length > 0" class="warning-list">
          <div class="section-title">警告：</div>
          <el-tag
            v-for="(warning, index) in analysisResult.warnings"
            :key="index"
            type="warning"
            class="warning-tag"
          >
            {{ warning }}
          </el-tag>
        </div>

        <div v-if="analysisResult.suggestions.length > 0" class="suggestion-list">
          <div class="section-title">建议：</div>
          <el-tag
            v-for="(suggestion, index) in analysisResult.suggestions"
            :key="index"
            type="info"
            class="suggestion-tag"
          >
            {{ suggestion }}
          </el-tag>
        </div>
      </div>
    </el-form-item>

    <el-dialog
      v-model="showTestDialog"
      title="测试代码"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="testForm" label-width="100px">
        <el-form-item label="测试参数">
          <el-input
            v-model="testForm.paramsJson"
            type="textarea"
            :rows="5"
            placeholder='请输入 JSON 格式的参数，例如：{"key": "value"}'
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showTestDialog = false">取消</el-button>
        <el-button type="primary" @click="testCode" :loading="testing">
          执行测试
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showResultDialog"
      title="测试结果"
      width="600px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="状态">
          <el-tag :type="testResult?.success ? 'success' : 'danger'">
            {{ testResult?.success ? '成功' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="testResult?.duration" label="耗时">
          {{ testResult.duration }}ms
        </el-descriptions-item>
        <el-descriptions-item v-if="testResult?.error" label="错误信息">
          <el-alert :title="testResult.error" type="error" :closable="false" />
        </el-descriptions-item>
        <el-descriptions-item v-if="testResult?.data" label="返回数据">
          <pre class="result-data">{{ JSON.stringify(testResult.data, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button type="primary" @click="showResultDialog = false">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { skillApi, type CodeAnalysisResult, type FunctionResult } from '@/api/skill'

interface Props {
  code?: string
}

interface Emits {
  (e: 'update:code', value: string): void
  (e: 'change'): void
}

const props = withDefaults(defineProps<Props>(), {
  code: '',
})

const emit = defineEmits<Emits>()

const localCode = ref(props.code || '')
const analyzing = ref(false)
const testing = ref(false)
const showTestDialog = ref(false)
const showResultDialog = ref(false)
const analysisResult = ref<CodeAnalysisResult | null>(null)
const testResult = ref<FunctionResult | null>(null)
const testForm = ref({
  paramsJson: '{}',
})

watch(() => props.code, (val) => {
  localCode.value = val || ''
})

/**
 * 处理代码变化
 */
function handleChange() {
  emit('update:code', localCode.value)
  emit('change')
}

/**
 * 分析代码
 */
async function analyzeCode() {
  if (!localCode.value.trim()) {
    ElMessage.warning('请先输入代码')
    return
  }

  analyzing.value = true
  try {
    const { data } = await skillApi.analyzeCode(localCode.value)
    if (data.data) {
      analysisResult.value = data.data
      if (data.data.valid) {
        ElMessage.success('代码验证通过')
      } else {
        ElMessage.error('代码验证失败，请查看详细信息')
      }
    }
  } catch (error) {
    console.error('代码分析失败:', error)
    ElMessage.error('代码分析失败')
  } finally {
    analyzing.value = false
  }
}

/**
 * 测试代码
 */
async function testCode() {
  if (!localCode.value.trim()) {
    ElMessage.warning('请先输入代码')
    return
  }

  let params: Record<string, unknown> = {}
  try {
    params = JSON.parse(testForm.value.paramsJson)
  } catch (error) {
    ElMessage.error('参数格式错误，请输入有效的 JSON')
    return
  }

  testing.value = true
  try {
    const { data } = await skillApi.testFunction({
      codeType: 'sandbox',
      codeContent: localCode.value,
      params,
    })
    
    if (data.data) {
      testResult.value = data.data
      showTestDialog.value = false
      showResultDialog.value = true
    }
  } catch (error) {
    console.error('代码测试失败:', error)
    ElMessage.error('代码测试失败')
  } finally {
    testing.value = false
  }
}
</script>

<style scoped lang="scss">
.sandbox-code-editor {
  width: 100%;
}

.editor-container {
  width: 100%;
}

.analysis-result {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .section-title {
    font-weight: 500;
    margin-bottom: 8px;
  }

  .error-tag,
  .warning-tag,
  .suggestion-tag {
    margin-right: 8px;
    margin-bottom: 8px;
  }
}

.result-data {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}
</style>
