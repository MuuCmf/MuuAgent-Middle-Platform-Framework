<template>
  <div class="rag-test-view">
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>📚 RAG问答测试</h3>
      </div>
      
      <div class="config-section">
        <div class="config-title">知识库选择</div>
        <el-select
          v-model="selectedKb"
          placeholder="请选择知识库"
          style="width: 100%"
          @change="handleKbChange"
        >
          <el-option
            v-for="kb in kbList"
            :key="kb.kbId"
            :label="kb.kbName"
            :value="kb.kbId"
          />
        </el-select>
      </div>
      
      <div class="config-section">
        <div class="config-title">检索模式</div>
        <el-radio-group v-model="searchMode" style="width: 100%">
          <el-radio-button label="rag">RAG问答</el-radio-button>
          <el-radio-button label="retrieval">向量检索</el-radio-button>
        </el-radio-group>
      </div>
      
      <div class="config-section">
        <div class="config-title">检索参数</div>
        <div class="param-item">
          <span class="param-label">返回数量 (TopN)</span>
          <el-input-number
            v-model="topN"
            :min="1"
            :max="20"
            :step="1"
            style="width: 100%"
          />
        </div>
        <div class="param-item">
          <span class="param-label">相似度阈值</span>
          <el-slider
            v-model="similarityThresh"
            :min="0"
            :max="1"
            :step="0.1"
            show-input
            :show-input-controls="false"
          />
        </div>
      </div>
      
      <div class="config-section" v-if="selectedKbInfo">
        <div class="config-title">知识库信息</div>
        <div class="kb-info">
          <div class="info-item">
            <span class="info-label">名称：</span>
            <span>{{ selectedKbInfo.kbName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">检索方式：</span>
            <span>{{ selectedKbInfo.retrievalMethod === 'bm25' ? 'BM25' : '向量检索' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">文档数量：</span>
            <span>{{ selectedKbInfo.documentCount || 0 }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">切片数量：</span>
            <span>{{ selectedKbInfo.chunkCount || 0 }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="main-content">
      <div class="chat-header">
        <h2>{{ searchMode === 'rag' ? 'RAG问答测试' : '向量检索测试' }}</h2>
        <el-button type="primary" @click="clearMessages">
          <el-icon><Delete /></el-icon>
          清空对话
        </el-button>
      </div>
      
      <div class="messages-container" ref="messagesRef">
        <div class="messages-wrapper">
          <ChatMessage
            v-for="(message, index) in messages"
            :key="index"
            :message="message"
            :is-streaming="isMessageStreaming(index)"
          />
          <div v-if="messages.length === 0" class="empty-state">
            <el-icon :size="80" color="#ddd"><Document /></el-icon>
            <h3>开始RAG问答测试</h3>
            <p>选择知识库后，输入问题进行测试</p>
          </div>
        </div>
      </div>
      
      <div class="input-container">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="请输入您的问题..."
          @keydown.enter.ctrl="sendMessage"
          :disabled="isLoading"
        />
        <div class="input-actions">
          <span class="tip">Ctrl + Enter 发送</span>
          <el-button
            type="primary"
            :loading="isLoading"
            :disabled="!inputText.trim() || !selectedKb"
            @click="sendMessage"
          >
            发送
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { Delete, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { kbApi, type KbInfo } from '../api/kb'
import { retrievalApi, type RetrievalItem } from '../api/retrieval'
import type { Message } from '../api'
import ChatMessage from '../components/ChatMessage.vue'

const kbList = ref<KbInfo[]>([])
const selectedKb = ref<string>('')
const searchMode = ref<'rag' | 'retrieval'>('rag')
const topN = ref(5)
const similarityThresh = ref(0.7)
const inputText = ref('')
const messages = ref<Message[]>([])
const isLoading = ref(false)
const messagesRef = ref<HTMLElement>()

const selectedKbInfo = computed(() => {
  return kbList.value.find(kb => kb.kbId === selectedKb.value)
})

/**
 * 判断指定索引的消息是否正在流式输出
 * @param index 消息索引
 * @returns 是否正在流式输出
 */
const isMessageStreaming = (index: number): boolean => {
  if (!isLoading.value) return false
  if (index !== messages.value.length - 1) return false
  return messages.value[index].role === 'assistant'
}

/**
 * 滚动到底部
 */
const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

/**
 * 加载知识库列表
 */
const loadKbList = async () => {
  try {
    const res = await kbApi.getList()
    kbList.value = res.data || []
  } catch (error) {
    console.error('加载知识库列表失败:', error)
    ElMessage.error('加载知识库列表失败')
  }
}

/**
 * 处理知识库变更
 */
const handleKbChange = () => {
  clearMessages()
}

/**
 * 发送消息
 */
const sendMessage = async () => {
  if (!inputText.value.trim() || isLoading.value || !selectedKb.value) return

  const userMessage: Message = { role: 'user', content: inputText.value.trim() }
  messages.value.push(userMessage)
  const query = inputText.value.trim()
  inputText.value = ''
  isLoading.value = true

  try {
    if (searchMode.value === 'rag') {
      await handleRagChat(query)
    } else {
      await handleRetrieval(query)
    }
  } catch (error: any) {
    const errorMsg = '调用失败: ' + (error.response?.data?.message || error.message)
    messages.value.push({ role: 'assistant', content: errorMsg })
    ElMessage.error(errorMsg)
  }

  isLoading.value = false
  scrollToBottom()
}

/**
 * 处理RAG问答
 * @param query 用户问题
 */
const handleRagChat = async (query: string) => {
  const assistantMessage: Message = {
    role: 'assistant',
    content: '',
    type: 'rag',
    sources: []
  }
  messages.value.push(assistantMessage)
  const assistantIndex = messages.value.length - 1

  await retrievalApi.ragChatStream(
    {
      kbId: selectedKb.value,
      query,
      topN: topN.value,
      similarityThresh: similarityThresh.value
    },
    {
      onMessage: (content: string) => {
        messages.value[assistantIndex].content += content
        scrollToBottom()
      },
      onError: (error: Error) => {
        messages.value[assistantIndex].content = '错误: ' + error.message
        ElMessage.error('RAG问答失败: ' + error.message)
      },
      onComplete: (sources?: RetrievalItem[]) => {
        if (sources && sources.length > 0) {
          messages.value[assistantIndex].sources = sources
        }
        isLoading.value = false
      }
    }
  )
}

/**
 * 处理向量检索
 * @param query 检索查询
 */
const handleRetrieval = async (query: string) => {
  const res = await retrievalApi.retrieval({
    kbId: selectedKb.value,
    query,
    topN: topN.value,
    similarityThresh: similarityThresh.value
  })

  const results = res.data?.list || []
  messages.value.push({
    role: 'assistant',
    content: '',
    type: 'retrieval',
    results
  })
}

/**
 * 清空消息
 */
const clearMessages = () => {
  messages.value = []
}

onMounted(() => {
  loadKbList()
})
</script>

<style scoped lang="scss">
.rag-test-view {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 320px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow-y: auto;

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid #e8e8e8;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  .config-section {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;

    .config-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }

    .param-item {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .param-label {
        display: block;
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
      }
    }

    .kb-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;

      .info-item {
        display: flex;
        font-size: 13px;
        margin-bottom: 8px;

        &:last-child {
          margin-bottom: 0;
        }

        .info-label {
          color: #999;
          width: 80px;
          flex-shrink: 0;
        }

        span:last-child {
          color: #333;
        }
      }
    }
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.messages-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;

  h3 {
    margin: 24px 0 12px;
    font-size: 24px;
    color: #333;
  }

  p {
    margin: 0;
    color: #999;
    font-size: 16px;
  }
}

.input-container {
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #e8e8e8;

  .input-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;

    .tip {
      font-size: 12px;
      color: #999;
    }
  }
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}
</style>
