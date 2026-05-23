<template>
  <div class="tool-policy-panel">
    <div v-for="modulePolicy in policies" :key="modulePolicy.moduleName" class="module-section">
      <div class="module-header">
        <span class="module-name">{{ getModuleLabel(modulePolicy.moduleName) }}</span>
        <span class="module-badge">{{ modulePolicy.tools.length }} 个工具</span>
      </div>
      <div class="tool-list">
        <div
          v-for="tool in modulePolicy.tools"
          :key="tool.toolName"
          class="tool-item"
        >
          <div class="tool-info">
            <span class="tool-name">{{ tool.toolName }}</span>
            <span v-if="tool.confirmMessage" class="tool-msg" :title="interpolateMsg(tool.confirmMessage)">
              {{ interpolateMsg(tool.confirmMessage) }}
            </span>
          </div>
          <div class="tool-controls">
            <select
              :value="getEffectiveMode(modulePolicy.moduleName, tool)"
              :class="['mode-select', `mode-${getEffectiveMode(modulePolicy.moduleName, tool)}`]"
              @change="onModeChange(modulePolicy.moduleName, tool.toolName, ($event.target as HTMLSelectElement).value)"
            >
              <option value="auto">自动执行</option>
              <option value="confirm">需确认</option>
              <option value="deny">禁止</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    <div v-if="policies.length === 0" class="empty-hint">
      暂无客户端工具权限策略，开始对话后将自动加载
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClientToolModulePolicy, ToolPermissionPolicy } from '../../../executor/types'
import { clientToolRouter } from '../../../executor/client-tool-router'

const props = defineProps<{
  /** 工具权限策略列表 */
  policies: ClientToolModulePolicy[]
}>()

/**
 * 模块标签映射
 */
const MODULE_LABELS: Record<string, string> = {
  workspace: '工作目录',
}

/**
 * 获取模块标签
 * @param name 模块名称
 * @returns 模块标签
 */
function getModuleLabel(name: string): string {
  return MODULE_LABELS[name] || name
}

/**
 * 获取工具生效的确认模式
 * @param moduleName 模块名称
 * @param tool 工具权限策略
 * @returns 确认模式
 */
function getEffectiveMode(moduleName: string, tool: ToolPermissionPolicy): string {
  const policy = clientToolRouter.getToolPolicy(moduleName, tool.toolName)
  return policy.confirmMode
}

/**
 * 处理确认模式变更
 * @param moduleName 模块名称
 * @param toolName 工具名称
 * @param mode 确认模式
 */
function onModeChange(moduleName: string, toolName: string, mode: string): void {
  clientToolRouter.setLocalOverride(moduleName, toolName, {
    confirmMode: mode as 'auto' | 'confirm' | 'deny',
  })
}

/**
 * 插值消息模板
 * @param template 消息模板
 * @returns 插值后的消息
 */
function interpolateMsg(template: string): string {
  return template.replace(/\{args\.(\w+)\}/g, (_, key) => `<${key}>`)
}
</script>

<style lang="scss" scoped>
.tool-policy-panel {
  font-size: 13px;
}

.module-section {
  margin-bottom: 14px;
}

.module-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}

.module-name {
  font-weight: 500;
  color: var(--text-color);
}

.module-badge {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 10px;
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--text-color);
}

.tool-msg {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-controls {
  flex-shrink: 0;
  margin-left: 12px;
}

.mode-select {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--white);
  color: var(--text-color);
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary-color);
  }

  &.mode-auto {
    color: #67c23a;
  }

  &.mode-confirm {
    color: #e6a23c;
  }

  &.mode-deny {
    color: #f56c6c;
  }
}

.empty-hint {
  text-align: center;
  color: var(--text-tertiary);
  padding: 20px 0;
  font-size: 12px;
}
</style>
