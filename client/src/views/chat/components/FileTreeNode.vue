<template>
  <div class="file-tree-node" :style="{ paddingLeft: `${depth * 16}px` }">
    <div
      :class="['node-content', { 'is-directory': node.kind === 'directory', 'is-expanded': isExpanded }]"
      @click="handleClick"
    >
      <el-icon
        v-if="node.kind === 'directory'"
        :size="14"
        class="expand-icon"
        @click.stop="toggleExpand"
      >
        <component :is="isExpanded ? ArrowDown : ArrowRight" />
      </el-icon>
      <span v-else class="expand-placeholder" />

      <el-icon :size="14" class="file-icon">
        <component :is="getFileIcon(node)" />
      </el-icon>

      <span class="node-name">{{ node.name }}</span>
    </div>

    <div v-if="node.kind === 'directory' && isExpanded && node.children" class="node-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.name"
        :node="child"
        :depth="depth + 1"
        @file-click="emit('fileClick', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowRight, Folder, FolderOpened, Document, Picture } from '@element-plus/icons-vue'
import type { FileTreeNode as IFileTreeNode } from '../../../composables/useWorkspace'

interface Props {
  /** 文件树节点 */
  node: IFileTreeNode
  /** 当前深度 */
  depth: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 点击文件 */
  fileClick: [node: IFileTreeNode]
}>()

/** 是否展开 */
const isExpanded = ref(false)

/**
 * 切换展开状态
 */
const toggleExpand = () => {
  if (props.node.kind === 'directory') {
    isExpanded.value = !isExpanded.value
  }
}

/**
 * 处理点击
 */
const handleClick = () => {
  if (props.node.kind === 'directory') {
    toggleExpand()
  } else {
    emit('fileClick', props.node)
  }
}

/**
 * 获取文件图标
 * @param node 文件节点
 * @returns 图标组件
 */
const getFileIcon = (node: IFileTreeNode) => {
  if (node.kind === 'directory') {
    return isExpanded.value ? FolderOpened : Folder
  }

  const ext = node.extension || ''
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  
  if (imageExtensions.includes(ext)) {
    return Picture
  }

  return Document
}
</script>

<style lang="scss" scoped>
.file-tree-node {
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.is-directory {
    color: var(--text-color);

    .file-icon {
      color: var(--primary-color);
    }
  }

  &:not(.is-directory) {
    color: var(--text-secondary);
  }
}

.expand-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.expand-placeholder {
  width: 14px;
  flex-shrink: 0;
}

.file-icon {
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-children {
  overflow: hidden;
}
</style>