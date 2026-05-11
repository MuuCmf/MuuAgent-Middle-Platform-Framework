<template>
  <div class="conversation-list">
    <div class="list-header">
      <h3>历史会话</h3>
      <el-button
        type="primary"
        size="small"
        @click="handleNewConversation"
        circle
      >
        <el-icon><Plus /></el-icon>
      </el-button>
    </div>
    <div class="list-content">
      <el-scrollbar>
        <div
          v-for="conv in conversations"
          :key="conv.id"
          :class="['conversation-item', { active: conv.id === currentId }]"
          @click="handleSelect(conv.id)"
        >
          <div class="conv-icon">
            <el-icon><ChatLineRound /></el-icon>
          </div>
          <div class="conv-info">
            <div class="conv-title">{{ conv.title }}</div>
            <div class="conv-meta">
              {{ formatTime(conv.lastMessageAt) }} · {{ conv.messageCount }}条消息
            </div>
          </div>
          <el-button
            class="delete-btn"
            type="danger"
            size="small"
            text
            @click.stop="handleDelete(conv.id)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <el-empty v-if="conversations.length === 0" description="暂无历史会话" />
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChatLineRound, Plus, Delete } from '@element-plus/icons-vue'
import type { Conversation } from '../api'

interface Props {
  conversations: Conversation[]
  currentId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  new: []
}>()

const formatTime = (time: string) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString()
}

const handleSelect = (id: string) => {
  emit('select', id)
}

const handleDelete = (id: string) => {
  emit('delete', id)
}

const handleNewConversation = () => {
  emit('new')
}
</script>

<style scoped>
.conversation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.list-content {
  flex: 1;
  overflow: hidden;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s;
  border-bottom: 1px solid #f0f0f0;
}

.conversation-item:hover {
  background: #f5f7fa;
}

.conversation-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.conv-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conversation-item.active .conv-icon {
  background: rgba(255, 255, 255, 0.2);
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-meta {
  font-size: 12px;
  color: #999;
}

.conversation-item.active .conv-meta {
  color: rgba(255, 255, 255, 0.8);
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.3s;
}

.conversation-item:hover .delete-btn {
  opacity: 1;
}
</style>
