<template>
  <div class="workspace-indicator" v-if="isActive">
    <span class="workspace-icon">&#128193;</span>
    <span class="workspace-name">{{ dirName }}</span>
    <button class="workspace-btn" @click="$emit('change')">更换</button>
    <button class="workspace-btn workspace-btn-danger" @click="$emit('clear')">清除</button>
  </div>
  <div class="workspace-indicator workspace-placeholder" v-else>
    <button class="workspace-btn workspace-btn-primary" @click="$emit('select')">
      <span class="workspace-icon">&#128193;</span>
      选择工作目录
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isActive: boolean
  dirName?: string | null
}>()

defineEmits<{
  select: []
  change: []
  clear: []
}>()
</script>

<style scoped>
.workspace-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  background: #f0f9eb;
  border: 1px solid #c2e7b0;
  color: #67c23a;
}

.workspace-placeholder {
  background: transparent;
  border: 1px dashed #dcdfe6;
  color: #909399;
}

.workspace-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-icon {
  font-size: 14px;
}

.workspace-btn {
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: #409eff;
}

.workspace-btn:hover {
  background: rgba(64, 158, 255, 0.1);
}

.workspace-btn-danger {
  color: #f56c6c;
}

.workspace-btn-danger:hover {
  background: rgba(245, 108, 108, 0.1);
}

.workspace-btn-primary {
  color: #409eff;
}
</style>
