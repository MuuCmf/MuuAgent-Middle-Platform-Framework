<template>
  <div class="conversation-selector">
    <el-select
      v-model="selectedConversationId"
      placeholder="选择历史会话"
      clearable
      filterable
      @change="handleConversationChange"
      style="width: 100%"
    >
      <el-option
        v-for="conv in conversations"
        :key="conv.id"
        :label="conv.title || '未命名会话'"
        :value="conv.id"
      >
        <div class="conversation-option">
          <span class="conversation-title">{{ conv.title || '未命名会话' }}</span>
          <span class="conversation-meta">
            {{ formatConversationMeta(conv) }}
          </span>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useConversationStore } from '@/stores/conversation'
import { ConversationType, Conversation } from '@/api/conversation'
import { formatDate } from '@/utils/format'

interface Props {
  conversationType: ConversationType
  targetId: string
  modelValue?: string | null
}

interface Emits {
  (e: 'update:modelValue', value: string | null): void
  (e: 'change', conversationId: string | null): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const conversationStore = useConversationStore()

const selectedConversationId = ref<string | null>(props.modelValue || null)

const conversations = computed(() => {
  return conversationStore.conversations.filter(
    (c: Conversation) =>
      c.conversationType === props.conversationType &&
      c.targetId === props.targetId
  )
})

const handleConversationChange = (value: string | null) => {
  emits('update:modelValue', value)
  emits('change', value)
}

const formatConversationMeta = (conv: Conversation) => {
  const date = formatDate(conv.lastMessageAt)
  const count = conv.messageCount || 0
  return `${count}条消息 · ${date}`
}

const loadConversations = async () => {
  try {
    await conversationStore.fetchConversations({
      conversationType: props.conversationType,
      targetId: props.targetId,
      pageSize: 20,
    })
  } catch (error) {
    console.error('加载会话列表失败:', error)
  }
}

watch(
  () => props.conversationType,
  () => {
    loadConversations()
  }
)

watch(
  () => props.targetId,
  () => {
    loadConversations()
  }
)

watch(
  () => props.modelValue,
  (newValue) => {
    selectedConversationId.value = newValue || null
  }
)

onMounted(() => {
  loadConversations()
})
</script>

<style lang="scss" scoped>
.conversation-selector {
  margin-bottom: 16px;
}

.conversation-option {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .conversation-title {
    font-size: 14px;
    color: #164e63;
  }

  .conversation-meta {
    font-size: 12px;
    color: #64748b;
  }
}
</style>
