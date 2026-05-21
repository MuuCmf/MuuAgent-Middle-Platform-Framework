<template>
  <div class="builtin-tool-selector">
    <div v-if="loading" class="loading-wrapper">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else class="tool-grid">
      <div
        v-for="tool in builtinTools"
        :key="tool.name"
        class="tool-card"
        :class="{
          active: selectedTools.includes(tool.name),
          disabled: !tool.enabled,
        }"
        @click="tool.enabled && toggleTool(tool.name)"
      >
        <div class="tool-header">
          <el-checkbox
            :model-value="selectedTools.includes(tool.name)"
            :disabled="!tool.enabled"
            @change="toggleTool(tool.name)"
          >
            <div class="tool-title">
              <el-icon v-if="tool.icon" class="tool-icon">
                <component :is="tool.icon" />
              </el-icon>
              <span class="tool-name">{{ tool.displayName }}</span>
            </div>
          </el-checkbox>
        </div>

        <div class="tool-desc">{{ tool.description }}</div>

        <div class="tool-footer">
          <div class="tool-tags">
            <el-tag v-if="tool.sensitive" type="danger" size="small">
              <el-icon><Warning /></el-icon>
              敏感
            </el-tag>
            <el-tag v-if="tool.category" type="info" size="small">
              {{ tool.category }}
            </el-tag>
          </div>

          <el-popover
            v-if="tool.examples && tool.examples.length > 0"
            placement="top"
            :width="300"
            trigger="hover"
          >
            <template #reference>
              <el-button text size="small">
                <el-icon><QuestionFilled /></el-icon>
                示例
              </el-button>
            </template>
            <div class="tool-examples">
              <div class="examples-title">使用示例：</div>
              <ul>
                <li v-for="(example, index) in tool.examples" :key="index">
                  {{ example }}
                </li>
              </ul>
            </div>
          </el-popover>
        </div>
      </div>
    </div>

    <div v-if="!loading && builtinTools.length > 0" class="quick-actions">
      <el-button size="small" @click="selectAll">
        <el-icon><Check /></el-icon>
        全选
      </el-button>
      <el-button size="small" @click="clearAll">
        <el-icon><Close /></el-icon>
        清空
      </el-button>
      <el-button size="small" @click="selectSafe">
        <el-icon><Check /></el-icon>
        仅安全工具
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useToolStore } from '@/stores/tool'
import { Check, Close, Warning, QuestionFilled } from '@element-plus/icons-vue'

/**
 * 组件属性
 */
interface Props {
  modelValue: string[]
}

const props = defineProps<Props>()

/**
 * 组件事件
 */
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const toolStore = useToolStore()

const loading = computed(() => toolStore.loading)
const builtinTools = computed(() => toolStore.builtinTools)

const selectedTools = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

/**
 * 切换工具选择
 */
function toggleTool(toolName: string) {
  const tools = [...selectedTools.value]
  const index = tools.indexOf(toolName)

  if (index > -1) {
    tools.splice(index, 1)
  } else {
    tools.push(toolName)
  }

  selectedTools.value = tools
}

/**
 * 全选
 */
function selectAll() {
  const tools = toolStore.getAllToolNames()
  selectedTools.value = Array.isArray(tools) ? tools : []
}

/**
 * 清空
 */
function clearAll() {
  selectedTools.value = []
}

/**
 * 仅选择安全工具
 */
function selectSafe() {
  const tools = toolStore.getSafeToolNames()
  selectedTools.value = Array.isArray(tools) ? tools : []
}

/**
 * 组件挂载时加载工具列表
 */
onMounted(() => {
  toolStore.loadBuiltinTools()
})
</script>

<style scoped lang="scss">
.builtin-tool-selector {
  .loading-wrapper {
    padding: 20px;
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .tool-card {
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.3s;
    background: var(--el-bg-color);

    &:hover:not(.disabled) {
      border-color: var(--el-color-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    &.active {
      border-color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .tool-header {
      margin-bottom: 8px;

      .tool-title {
        display: flex;
        align-items: center;
        gap: 6px;

        .tool-icon {
          font-size: 16px;
          color: var(--el-color-primary);
        }

        .tool-name {
          font-weight: 500;
          font-size: 14px;
        }
      }
    }

    .tool-desc {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 12px;
      line-height: 1.6;
      min-height: 36px;
    }

    .tool-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .tool-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
    }
  }

  .quick-actions {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.tool-examples {
  .examples-title {
    font-weight: 500;
    margin-bottom: 8px;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      margin: 4px 0;
      color: var(--el-text-color-regular);
    }
  }
}
</style>
