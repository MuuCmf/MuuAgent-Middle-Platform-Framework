<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">💬 AI对话</h1>
      <p class="page-description">测试AI模型、智能体和知识库检索功能</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 AI对话说明</div>
      <ul>
        <li><strong>MCP调度</strong>：系统自动选择最优模型进行对话</li>
        <li><strong>选择模型</strong>：手动指定要使用的模型</li>
        <li><strong>智能体对话</strong>：选择已创建的智能体，它会根据系统提示词和绑定的技能进行智能回复</li>
        <li><strong>知识库检索</strong>：在知识库中检索相关文档片段</li>
        <li><strong>RAG问答</strong>：基于知识库内容进行智能问答</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">💬 AI对话测试</div>
      
      <el-form :inline="true" style="margin-bottom: 16px;">
        <el-form-item label="对话模式">
          <el-select v-model="chatMode" style="width: 200px;">
            <el-option label="MCP调度 (自动选择最优模型)" value="mcp" />
            <el-option label="选择模型 (手动指定模型)" value="model" />
            <el-option label="智能体对话 (使用智能体)" value="agent" />
            <el-option label="知识库检索 (向量检索)" value="kb-retrieval" />
            <el-option label="RAG问答 (知识库问答)" value="kb-rag" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="chatMode === 'model'" label="选择模型">
          <el-select v-model="selectedModel" placeholder="请选择模型" style="width: 250px;">
            <el-option
              v-for="model in enabledModels"
              :key="model.id"
              :label="`${model.name} (${model.code}) - ${model.provider}`"
              :value="model.code"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="chatMode === 'agent'" label="选择智能体">
          <el-select v-model="selectedAgent" placeholder="请选择智能体" style="width: 250px;">
            <el-option
              v-for="agent in enabledAgents"
              :key="agent.id"
              :label="`🤖 ${agent.name} (${agent.code})`"
              :value="agent.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="chatMode === 'kb-retrieval' || chatMode === 'kb-rag'" label="选择知识库">
          <el-select v-model="selectedKb" placeholder="请选择知识库" style="width: 250px;">
            <el-option
              v-for="kb in enabledKbs"
              :key="kb.kbId"
              :label="`📚 ${kb.kbName} (${kb.kbCode})`"
              :value="kb.kbId"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="chatMode === 'agent' && selectedAgent" style="margin-bottom: 16px;">
        <span style="color: #666; font-size: 12px; margin-right: 8px;">快速测试：</span>
        <el-button
          v-for="q in quickQuestions"
          :key="q"
          size="small"
          @click="chatInput = q"
        >
          {{ q }}
        </el-button>
      </div>

      <div v-if="chatMode === 'kb-retrieval' || chatMode === 'kb-rag'" style="margin-bottom: 16px;">
        <el-form :inline="true" size="small">
          <el-form-item label="召回条数">
            <el-input-number v-model="retrievalTopN" :min="1" :max="20" style="width: 100px;" />
          </el-form-item>
          <el-form-item label="相似度阈值">
            <el-input-number v-model="retrievalThreshold" :min="0" :max="1" :step="0.1" :precision="1" style="width: 100px;" />
          </el-form-item>
        </el-form>
        <div style="margin-top: 8px;">
          <span style="color: #666; font-size: 12px; margin-right: 8px;">快速测试：</span>
          <el-button
            v-for="q in kbQuickQuestions"
            :key="q"
            size="small"
            @click="chatInput = q"
          >
            {{ q }}
          </el-button>
        </div>
      </div>

      <div class="chat-container">
        <div class="chat-messages" ref="chatMessagesRef">
          <div v-if="!chatMessages.length" class="empty">
            <p>👋 开始对话吧！</p>
            <p style="font-size: 12px; color: #999; margin-top: 8px">
              <template v-if="chatMode === 'mcp'">当前为MCP调度模式，系统将自动选择最优模型</template>
              <template v-else-if="chatMode === 'model'">当前为模型选择模式，请选择一个模型</template>
              <template v-else-if="chatMode === 'agent'">当前为智能体对话模式，请选择一个智能体</template>
              <template v-else-if="chatMode === 'kb-retrieval'">当前为知识库检索模式，请选择一个知识库</template>
              <template v-else>当前为RAG问答模式，请选择一个知识库</template>
            </p>
          </div>
          <div
            v-for="(msg, idx) in chatMessages"
            :key="idx"
            class="message"
            :class="msg.role === 'user' ? 'message-user' : 'message-assistant'"
          >
            <div class="message-content">
              <div v-if="msg.role === 'assistant' && msg.type === 'retrieval'">
                <div v-if="msg.results && msg.results.length > 0">
                  <div style="margin-bottom: 8px; color: #667eea; font-weight: 600;">
                    📊 找到 {{ msg.results.length }} 个相关结果：
                  </div>
                  <div
                    v-for="(result, rIdx) in msg.results"
                    :key="rIdx"
                    class="retrieval-result"
                  >
                    <div class="result-index">{{ rIdx + 1 }}.</div>
                    <div class="result-content">{{ result.content }}</div>
                    <div class="result-meta">
                      <span class="result-source">📄 来源：{{ result.docName }}</span>
                      <span class="result-score">📊 相似度：{{ (result.score * 100).toFixed(1) }}%</span>
                    </div>
                  </div>
                </div>
                <div v-else style="color: #999;">未找到相关内容</div>
              </div>
              <div v-else-if="msg.role === 'assistant' && msg.type === 'rag'">
                <div style="white-space: pre-wrap;">{{ msg.content }}</div>
                <div v-if="msg.sources && msg.sources.length > 0" class="rag-sources">
                  <div style="margin-top: 12px; color: #667eea; font-weight: 600;">📚 参考来源：</div>
                  <div
                    v-for="(source, sIdx) in msg.sources"
                    :key="sIdx"
                    class="source-item"
                  >
                    <span>• {{ source.docName }}</span>
                    <span class="source-score">（相似度：{{ (source.score * 100).toFixed(1) }}%）</span>
                  </div>
                </div>
              </div>
              <div v-else-if="msg.role === 'assistant' && msg.tools && msg.tools.length > 0">
                <div v-if="msg.tools.length > 0" class="agent-tools">
                  <div style="margin-bottom: 8px; color: #667eea; font-weight: 600;">
                    🛠️ 执行的工具：
                  </div>
                  <div
                    v-for="(tool, tIdx) in msg.tools"
                    :key="tIdx"
                    class="tool-result"
                  >
                    <div class="tool-name">• {{ tool.skill }}</div>
                    <div class="tool-content">{{ typeof tool.result === 'object' ? JSON.stringify(tool.result, null, 2) : tool.result }}</div>
                  </div>
                </div>
                <div style="white-space: pre-wrap; margin-top: 12px;">{{ msg.content }}</div>
              </div>
              <div v-else>{{ msg.content }}</div>
            </div>
          </div>
          <div v-if="chatLoading" class="loading">
            <span>🤔 AI正在思考...</span>
          </div>
        </div>
        <div class="chat-input">
          <el-input
            v-model="chatInput"
            placeholder="输入消息..."
            @keyup.enter="sendMessage"
            :disabled="chatLoading"
          />
          <el-button type="primary" @click="sendMessage" :disabled="chatLoading || !chatInput.trim()">
            发送
          </el-button>
          <el-button @click="chatMessages = []" :disabled="chatMessages.length === 0">
            清空
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useModelStore, useAgentStore } from '@/stores'
import { aiApi } from '@/api/ai'
import { agentApi } from '@/api/agent'
import { kbApi } from '@/api/kb'
import { retrievalApi } from '@/api/retrieval'
import type { RetrievalItem } from '@/api/retrieval'
import type { KbInfo } from '@/api/kb'

const modelStore = useModelStore()
const agentStore = useAgentStore()

const { loadModels, enabledModels } = modelStore
const { loadAgents, enabledAgents } = agentStore

const chatMode = ref('mcp')
const selectedModel = ref('')
const selectedAgent = ref<number | null>(null)
const selectedKb = ref('')
const retrievalTopN = ref(5)
const retrievalThreshold = ref(0.7)
const chatInput = ref('')
const chatMessages = ref<Array<any>>([])
const chatLoading = ref(false)
const chatMessagesRef = ref<HTMLElement | null>(null)

const enabledKbs = ref<KbInfo[]>([])

const quickQuestions = ['今天天气怎么样？', '现在几点了？', '帮我查一下北京的情况']
const kbQuickQuestions = ['订单如何取消？', '退款流程是什么？', '配送需要多长时间？']

const loadKbs = async () => {
  try {
    const res = await kbApi.getList({ status: true })
    enabledKbs.value = res.data.data.list || []
  } catch (error) {
    console.error('加载知识库列表失败:', error)
  }
}

const sendMessage = async () => {
  if (!chatInput.value.trim() || chatLoading.value) return

  if (chatMode.value === 'model' && !selectedModel.value) {
    ElMessage.warning('请选择一个模型')
    return
  }

  if (chatMode.value === 'agent' && !selectedAgent.value) {
    ElMessage.warning('请选择一个智能体')
    return
  }

  if ((chatMode.value === 'kb-retrieval' || chatMode.value === 'kb-rag') && !selectedKb.value) {
    ElMessage.warning('请选择一个知识库')
    return
  }

  const userMsg = chatInput.value
  chatMessages.value.push({ role: 'user', content: userMsg })
  chatInput.value = ''
  chatLoading.value = true

  try {
    if (chatMode.value === 'kb-retrieval') {
      const res = await retrievalApi.retrieval({
        kbId: selectedKb.value,
        query: userMsg,
        topN: retrievalTopN.value,
        similarityThresh: retrievalThreshold.value
      })
      
      const results = res.data.data.results || []
      chatMessages.value.push({
        role: 'assistant',
        type: 'retrieval',
        results: results
      })
    } else if (chatMode.value === 'kb-rag') {
      chatMessages.value.push({ role: 'assistant', type: 'rag', content: '', sources: [] })
      const assistantMsgIndex = chatMessages.value.length - 1
      
      await retrievalApi.ragChatStream(
        {
          kbId: selectedKb.value,
          query: userMsg,
          topN: retrievalTopN.value,
          similarityThresh: retrievalThreshold.value
        },
        (data: string) => {
          chatMessages.value[assistantMsgIndex].content += data
          nextTick(() => {
            if (chatMessagesRef.value) {
              chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
            }
          })
        },
        (error: any) => {
          console.error('RAG流式调用错误:', error)
          chatMessages.value[assistantMsgIndex].content = '调用失败: ' + (error.message || '未知错误')
        },
        (sources?: RetrievalItem[]) => {
          if (sources && sources.length > 0) {
            chatMessages.value[assistantMsgIndex].sources = sources
          }
          chatLoading.value = false
        }
      )
    } else if (chatMode.value === 'agent') {
      chatMessages.value.push({ role: 'assistant', content: '', tools: [] })
      const assistantMsgIndex = chatMessages.value.length - 1
      
      await agentApi.streamChat(
        selectedAgent.value!,
        userMsg,
        (content: string) => {
          chatMessages.value[assistantMsgIndex].content += content
          nextTick(() => {
            if (chatMessagesRef.value) {
              chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
            }
          })
        },
        (skill: string, result: any) => {
          if (!chatMessages.value[assistantMsgIndex].tools) {
            chatMessages.value[assistantMsgIndex].tools = []
          }
          chatMessages.value[assistantMsgIndex].tools.push({ skill, result })
          nextTick(() => {
            if (chatMessagesRef.value) {
              chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
            }
          })
        },
        (error: any) => {
          console.error('智能体流式调用错误:', error)
          chatMessages.value[assistantMsgIndex].content = '调用失败: ' + (error.message || '未知错误')
        },
        () => {
          chatLoading.value = false
        }
      )
    } else {
      const payload: any = {
        modelType: 'llm',
        messages: [{ role: 'user', content: userMsg }]
      }
      
      if (chatMode.value === 'model') {
        payload.modelCode = selectedModel.value
      }
      
      chatMessages.value.push({ role: 'assistant', content: '' })
      const assistantMsgIndex = chatMessages.value.length - 1
      
      await aiApi.stream(
        payload,
        (data: string) => {
          chatMessages.value[assistantMsgIndex].content += data
          nextTick(() => {
            if (chatMessagesRef.value) {
              chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
            }
          })
        },
        (error: any) => {
          console.error('流式调用错误:', error)
          chatMessages.value[assistantMsgIndex].content = '调用失败: ' + (error.message || '未知错误')
        },
        () => {
          chatLoading.value = false
        }
      )
    }
  } catch (error: any) {
    const errorMsg = '调用失败: ' + (error.response?.data?.message || error.message)
    chatMessages.value.push({ role: 'assistant', content: errorMsg })
  }

  chatLoading.value = false
  
  await nextTick()
  if (chatMessagesRef.value) {
    chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
  }
}

onMounted(() => {
  loadModels()
  loadAgents()
  loadKbs()
})
</script>

<style lang="scss" scoped>
.chat-container {
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  overflow: hidden;
}

.chat-messages {
  height: 400px;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
}

.message {
  margin-bottom: 16px;
  
  &.message-user {
    text-align: right;
  }
}

.message-content {
  display: inline-block;
  padding: 10px 16px;
  border-radius: 12px;
  max-width: 85%;
  word-wrap: break-word;
  white-space: pre-wrap;
  text-align: left;
  
  .message-user & {
    background: #667eea;
    color: white;
  }
  
  .message-assistant & {
    background: white;
    border: 1px solid #e8e8e8;
  }
}

.retrieval-result {
  margin-bottom: 12px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #667eea;
  
  .result-index {
    font-weight: 600;
    color: #667eea;
    margin-bottom: 4px;
  }
  
  .result-content {
    color: #333;
    margin-bottom: 6px;
    line-height: 1.6;
  }
  
  .result-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #666;
    
    .result-source {
      color: #667eea;
    }
    
    .result-score {
      color: #52c41a;
    }
  }
}

.rag-sources {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e8e8e8;
  
  .source-item {
    padding: 4px 0;
    font-size: 13px;
    color: #666;
    
    .source-score {
      color: #52c41a;
      margin-left: 8px;
    }
  }
}

.agent-tools {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #10b981;
  
  .tool-result {
    margin-bottom: 8px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .tool-name {
      font-weight: 600;
      color: #10b981;
      margin-bottom: 4px;
    }
    
    .tool-content {
      font-size: 13px;
      color: #666;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}

.chat-input {
  display: flex;
  gap: 10px;
  padding: 16px;
  background: white;
  border-top: 1px solid #e8e8e8;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #999;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
