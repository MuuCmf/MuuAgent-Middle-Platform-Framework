<template>
  <div class="conversation-list">
    <div v-if="showSearch" class="search-bar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索会话..."
        prefix-icon="Search"
        clearable
        size="small"
      />
    </div>
    <div class="list-content">
      <el-scrollbar>
        <template v-if="filteredConversations.length > 0">
          <div v-for="group in groupedConversations" :key="group.label" class="conv-group">
            <div class="group-label">{{ group.label }}</div>
            <div
              v-for="conv in group.items"
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
              <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, conv.id)">
                <el-button class="more-btn" type="default" size="small" text @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">
                      <el-icon><Edit /></el-icon>重命名
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <el-icon><Delete /></el-icon>删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </template>
        <el-empty v-else description="暂无历史会话" />
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChatLineRound, MoreFilled, Edit, Delete } from '@element-plus/icons-vue'
import type { Conversation } from '../../../services/ConversationService'

interface Props {
  /** 会话列表 */
  conversations: Conversation[]
  /** 当前选中的会话ID */
  currentId: string | null
  /** 是否显示搜索栏 */
  showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSearch: true,
})

const emit = defineEmits<{
  /** 选择会话 */
  select: [id: string]
  /** 删除会话 */
  delete: [id: string]
  /** 重命名会话 */
  rename: [id: string]
  /** 新建会话 */
  new: []
}>()

/** 搜索关键词 */
const searchQuery = ref('')

/**
 * 按关键词过滤会话
 */
const filteredConversations = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.conversations
  return props.conversations.filter(conv =>
    conv.title.toLowerCase().includes(q)
  )
})

/**
 * 按时间分组会话
 */
const groupedConversations = computed(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '最近7天', items: [] },
    { label: '更早', items: [] },
  ]

  for (const conv of filteredConversations.value) {
    const date = new Date(conv.lastMessageAt)
    if (date >= today) {
      groups[0].items.push(conv)
    } else if (date >= yesterday) {
      groups[1].items.push(conv)
    } else if (date >= weekAgo) {
      groups[2].items.push(conv)
    } else {
      groups[3].items.push(conv)
    }
  }

  return groups.filter(g => g.items.length > 0)
})

/**
 * 格式化时间显示
 * @param time 时间字符串
 * @returns 格式化后的时间文本
 */
const formatTime = (time: string): string => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

/**
 * 选择会话
 * @param id 会话ID
 */
const handleSelect = (id: string) => {
  emit('select', id)
}

/**
 * 处理下拉菜单命令
 * @param command 命令类型
 * @param id 会话ID
 */
const handleCommand = (command: string, id: string) => {
  if (command === 'delete') {
    emit('delete', id)
  } else if (command === 'rename') {
    emit('rename', id)
  }
}
</script>

<style lang="scss" scoped>
.conversation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.list-content {
  flex: 1;
  overflow: hidden;
}

.conv-group {
  margin-bottom: 4px;
}

.group-label {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.active {
    background: var(--primary-gradient);
    color: white;

    .conv-icon {
      background: rgba(255, 255, 255, 0.2);
    }

    .conv-meta {
      color: rgba(255, 255, 255, 0.75);
    }

    .more-btn {
      opacity: 1;
      color: white;
    }
  }
}

.conv-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.more-btn {
  opacity: 0;
  transition: opacity 0.2s;
  color: var(--text-tertiary);
}

.conversation-item:hover .more-btn {
  opacity: 1;
}
</style>
