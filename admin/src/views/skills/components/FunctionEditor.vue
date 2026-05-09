<template>
  <div class="function-editor">
    <el-form-item label="函数类型">
      <el-radio-group v-model="localCodeType" @change="handleCodeTypeChange">
        <el-radio value="builtin">内置函数</el-radio>
        <el-radio value="plugin">插件函数</el-radio>
        <el-radio value="sandbox">自定义代码</el-radio>
      </el-radio-group>
    </el-form-item>

    <builtin-function-selector
      v-if="localCodeType === 'builtin'"
      v-model:function-name="localFunctionName"
      @change="handleBuiltinChange"
    />

    <plugin-function-selector
      v-else-if="localCodeType === 'plugin'"
      v-model:plugin-name="localPluginName"
      v-model:function-name="localFunctionName"
      @change="handlePluginChange"
    />

    <sandbox-code-editor
      v-else-if="localCodeType === 'sandbox'"
      v-model:code="localCodeContent"
      @change="handleSandboxChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BuiltinFunctionSelector from './BuiltinFunctionSelector.vue'
import PluginFunctionSelector from './PluginFunctionSelector.vue'
import SandboxCodeEditor from './SandboxCodeEditor.vue'

interface Props {
  codeType?: 'builtin' | 'plugin' | 'sandbox'
  pluginName?: string
  functionName?: string
  codeContent?: string
}

interface Emits {
  (e: 'update:codeType', value: 'builtin' | 'plugin' | 'sandbox'): void
  (e: 'update:pluginName', value: string): void
  (e: 'update:functionName', value: string): void
  (e: 'update:codeContent', value: string): void
  (e: 'change'): void
}

const props = withDefaults(defineProps<Props>(), {
  codeType: 'builtin',
  pluginName: '',
  functionName: '',
  codeContent: '',
})

const emit = defineEmits<Emits>()

const localCodeType = ref<'builtin' | 'plugin' | 'sandbox'>(props.codeType || 'builtin')
const localPluginName = ref(props.pluginName || '')
const localFunctionName = ref(props.functionName || '')
const localCodeContent = ref(props.codeContent || '')

watch(() => props.codeType, (val) => {
  localCodeType.value = val || 'builtin'
})

watch(() => props.pluginName, (val) => {
  localPluginName.value = val || ''
})

watch(() => props.functionName, (val) => {
  localFunctionName.value = val || ''
})

watch(() => props.codeContent, (val) => {
  localCodeContent.value = val || ''
})

/**
 * 处理函数类型变化
 */
function handleCodeTypeChange() {
  emit('update:codeType', localCodeType.value)
  localPluginName.value = ''
  localFunctionName.value = ''
  localCodeContent.value = ''
  emit('update:pluginName', '')
  emit('update:functionName', '')
  emit('update:codeContent', '')
  emit('change')
}

/**
 * 处理内置函数变化
 */
function handleBuiltinChange() {
  emit('update:functionName', localFunctionName.value)
  emit('change')
}

/**
 * 处理插件函数变化
 */
function handlePluginChange() {
  emit('update:pluginName', localPluginName.value)
  emit('update:functionName', localFunctionName.value)
  emit('change')
}

/**
 * 处理沙箱代码变化
 */
function handleSandboxChange() {
  emit('update:codeContent', localCodeContent.value)
  emit('change')
}
</script>

<style scoped lang="scss">
.function-editor {
  width: 100%;
}
</style>
