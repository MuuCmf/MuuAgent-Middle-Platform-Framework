<template>
  <div class="builtin-function-selector">
    <el-form-item label="选择函数">
      <el-select
        v-model="localFunctionName"
        placeholder="请选择内置函数"
        filterable
        @change="handleChange"
      >
        <el-option
          v-for="func in functions"
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
import { skillApi, type BuiltinFunction } from '@/api/skill'

interface Props {
  functionName?: string
}

interface Emits {
  (e: 'update:functionName', value: string): void
  (e: 'change'): void
}

const props = withDefaults(defineProps<Props>(), {
  functionName: '',
})

const emit = defineEmits<Emits>()

const functions = ref<BuiltinFunction[]>([])
const localFunctionName = ref(props.functionName)

const selectedFunction = computed(() => {
  return functions.value.find((f) => f.name === localFunctionName.value)
})

/**
 * 加载内置函数列表
 */
async function loadBuiltinFunctions() {
  try {
    const { data } = await skillApi.getBuiltinFunctions()
    if (data.data) {
      functions.value = data.data
    }
  } catch (error) {
    console.error('加载内置函数列表失败:', error)
    ElMessage.error('加载内置函数列表失败')
  }
}

/**
 * 处理选择变化
 */
function handleChange() {
  emit('update:functionName', localFunctionName.value)
  emit('change')
}

watch(() => props.functionName, (val) => {
  localFunctionName.value = val || ''
})

onMounted(() => {
  loadBuiltinFunctions()
})
</script>

<style scoped lang="scss">
.builtin-function-selector {
  width: 100%;
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
