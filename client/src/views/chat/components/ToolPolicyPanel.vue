<template>
  <div class="tool-policy-panel">
    <div class="panel-header">
      <span class="panel-title">客户端工具权限</span>
      <button class="btn-reset" @click="resetAll" title="恢复全部默认">重置</button>
    </div>
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
              class="mode-select"
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
import { computed } from 'vue'
import type { ClientToolModulePolicy, ToolPermissionPolicy } from '../../../executor/types'
import { clientToolRouter } from '../../../executor/client-tool-router'

const props = defineProps<{
  policies: ClientToolModulePolicy[]
}>()

const MODULE_LABELS: Record<string, string> = {
  workspace: '工作目录',
  system_control: '系统控制',
}

function getModuleLabel(name: string): string {
  return MODULE_LABELS[name] || name
}

function getEffectiveMode(moduleName: string, tool: ToolPermissionPolicy): string {
  const policy = clientToolRouter.getToolPolicy(moduleName, tool.toolName)
  return policy.confirmMode
}

function onModeChange(moduleName: string, toolName: string, mode: string): void {
  clientToolRouter.setLocalOverride(moduleName, toolName, {
    confirmMode: mode as 'auto' | 'confirm' | 'deny',
  })
}

function resetAll(): void {
  for (const policy of props.policies) {
    for (const tool of policy.tools) {
      clientToolRouter.deleteLocalOverride(policy.moduleName, tool.toolName)
    }
  }
}

function interpolateMsg(template: string): string {
  return template.replace(/\{args\.(\w+)\}/g, (_, key) => `<${key}>`)
}
</script>

<style scoped>
.tool-policy-panel {
  padding: 12px;
  font-size: 13px;
  max-height: 400px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.btn-reset {
  background: none;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #909399;
}

.btn-reset:hover {
  color: #409eff;
  border-color: #409eff;
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
  border-bottom: 1px solid #f0f0f0;
}

.module-name {
  font-weight: 500;
  color: #606266;
}

.module-badge {
  font-size: 11px;
  color: #909399;
  background: #f5f7fa;
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
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.tool-item:hover {
  background: #f5f7fa;
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
  color: #303133;
}

.tool-msg {
  font-size: 11px;
  color: #909399;
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
  padding: 2px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  cursor: pointer;
  outline: none;
}

.mode-select:focus {
  border-color: #409eff;
}

.mode-select option[value="auto"] {
  color: #67c23a;
}

.mode-select option[value="confirm"] {
  color: #e6a23c;
}

.mode-select option[value="deny"] {
  color: #f56c6c;
}

.empty-hint {
  text-align: center;
  color: #c0c4cc;
  padding: 20px 0;
  font-size: 12px;
}
</style>
