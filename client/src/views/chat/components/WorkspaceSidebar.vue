<template>
  <div class="workspace-sidebar">
    <div class="sidebar-header">
      <div class="header-title">
        <el-icon :size="16"><FolderOpened /></el-icon>
        <span>{{ dirName }}</span>
      </div>
      <div class="header-actions">
        <el-button
          type="primary"
          link
          size="small"
          :loading="isLoading"
          @click="emit('refresh')"
          title="刷新"
        >
          <el-icon :size="14"><Refresh /></el-icon>
        </el-button>
        <el-button
          type="primary"
          link
          size="small"
          @click="emit('close')"
          title="关闭"
        >
          <el-icon :size="14"><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="sidebar-body">
      <div v-if="isLoading" class="loading-state">
        <el-icon :size="24" class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <div v-else-if="fileTree.length === 0" class="empty-state">
        <el-icon :size="40" color="var(--text-tertiary)"><Folder /></el-icon>
        <span>目录为空</span>
      </div>

      <div v-else class="file-tree">
        <FileTreeNode
          v-for="node in fileTree"
          :key="node.name"
          :node="node"
          :depth="0"
          @file-click="handleFileClick"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderOpened, Folder, Refresh, Close, Loading } from '@element-plus/icons-vue'
import FileTreeNode from './FileTreeNode.vue'
import type { FileTreeNode as IFileTreeNode } from '../../../composables/useWorkspace'

interface Props {
  /** 目录名称 */
  dirName: string | null
  /** 文件树数据 */
  fileTree: IFileTreeNode[]
  /** 是否正在加载 */
  isLoading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 刷新文件树 */
  refresh: []
  /** 关闭边栏 */
  close: []
  /** 点击文件 */
  fileClick: [node: IFileTreeNode]
}>()

/**
 * 处理文件点击
 * @param node 文件节点
 */
const handleFileClick = (node: IFileTreeNode) => {
  emit('fileClick', node)
}
</script>

<style lang="scss" scoped>
.workspace-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--white);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);

  .el-icon {
    color: var(--primary-color);
  }
}

.header-actions {
  display: flex;
  gap: 4px;
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.file-tree {
  padding: 0 8px;
}
</style>