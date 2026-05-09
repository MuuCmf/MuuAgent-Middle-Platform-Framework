<template>
  <div class="plugin-function-selector">
    <el-form-item label="选择插件">
      <el-select
        v-model="localPluginName"
        placeholder="请选择插件"
        filterable
        @change="handlePluginChange"
      >
        <el-option
          v-for="plugin in plugins"
          :key="plugin.name"
          :label="plugin.name"
          :value="plugin.name"
        >
          <div class="plugin-option">
            <span class="plugin-name">{{ plugin.name }}</span>
            <span class="plugin-version">v{{ plugin.version }}</span>
            <span class="plugin-desc">{{ plugin.description }}</span>
          </div>
        </el-option>
      </el-select>
    </el-form-item>

    <el-form-item v-if="selectedPlugin" label="插件信息">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="名称">{{ selectedPlugin.name }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ selectedPlugin.version }}</el-descriptions-item>
        <el-descriptions-item label="作者">{{ selectedPlugin.author || '未知' }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ selectedPlugin.description }}</el-descriptions-item>
      </el-descriptions>
    </el-form-item>

    <el-form-item v-if="selectedPlugin" label="选择函数">
      <el-select
        v-model="localFunctionName"
        placeholder="请选择函数"
        filterable
        @change="handleFunctionChange"
      >
        <el-option
          v-for="func in selectedPlugin.functions"
          :key="func.name"
          :label="func.name"
          :value="func.name"
        >
          <div class="function-option">
            <span class="function-name">{{ func.name }}</span>
            <span class="function-desc">{{ func.description }}</span>
          </div>
        </el-option>
      </el-select>
    </el-form-item>

    <el-form-item v-if="selectedFunction" label="函数说明">
      <el-alert
        :title="selectedFunction.description"
        type="info"
        :closable="false"
        show-icon
      />
    </el-form-item>

    <el-form-item v-if="selectedFunction && selectedFunction.parameters.length > 0" label="参数列表">
      <el-table :data="selectedFunction.parameters" border size="small">
        <el-table-column prop="name" label="参数名" width="120" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="required" label="必填" width="80">
          <template #default="{ row }">
            <el-tag :type="row.required ? 'danger' : 'info'" size="small">
              {{ row.required ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" />
      </el-table>
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { skillApi, type Plugin } from '@/api/skill'

interface Props {
  pluginName?: string
  functionName?: string
}

interface Emits {
  (e: 'update:pluginName', value: string): void
  (e: 'update:functionName', value: string): void
  (e: 'change'): void
}

const props = withDefaults(defineProps<Props>(), {
  pluginName: '',
  functionName: '',
})

const emit = defineEmits<Emits>()

const plugins = ref<Plugin[]>([])
const localPluginName = ref(props.pluginName || '')
const localFunctionName = ref(props.functionName || '')

const selectedPlugin = computed(() => {
  return plugins.value.find((p) => p.name === localPluginName.value)
})

const selectedFunction = computed(() => {
  if (!selectedPlugin.value) return null
  return selectedPlugin.value.functions.find((f) => f.name === localFunctionName.value)
})

/**
 * 加载插件列表
 */
async function loadPlugins() {
  try {
    const { data } = await skillApi.getPlugins()
    if (data.data) {
      plugins.value = data.data
    }
  } catch (error) {
    console.error('加载插件列表失败:', error)
    ElMessage.error('加载插件列表失败')
  }
}

/**
 * 处理插件选择变化
 */
function handlePluginChange() {
  localFunctionName.value = ''
  emit('update:pluginName', localPluginName.value)
  emit('update:functionName', '')
  emit('change')
}

/**
 * 处理函数选择变化
 */
function handleFunctionChange() {
  emit('update:functionName', localFunctionName.value)
  emit('change')
}

watch(() => props.pluginName, (val) => {
  localPluginName.value = val || ''
})

watch(() => props.functionName, (val) => {
  localFunctionName.value = val || ''
})

onMounted(() => {
  loadPlugins()
})
</script>

<style scoped lang="scss">
.plugin-function-selector {
  width: 100%;
}

.plugin-option {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .plugin-name {
    font-weight: 500;
  }

  .plugin-version {
    font-size: 12px;
    color: #67c23a;
  }

  .plugin-desc {
    font-size: 12px;
    color: #909399;
  }
}

.function-option {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .function-name {
    font-weight: 500;
  }

  .function-desc {
    font-size: 12px;
    color: #909399;
  }
}
</style>
