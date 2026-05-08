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
            <el-option v-for="model in enabledModels" :key="model.id"
              :label="`${model.name} (${model.code}) - ${model.provider}`" :value="model.code" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="chatMode === 'agent'" label="选择智能体">
          <el-select v-model="selectedAgent" placeholder="请选择智能体" style="width: 250px;">
            <el-option v-for="agent in enabledAgents" :key="agent.id" :label="`🤖 ${agent.name} (${agent.code})`"
              :value="agent.id" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="chatMode === 'kb-retrieval' || chatMode === 'kb-rag'" label="选择知识库">
          <el-select v-model="selectedKb" placeholder="请选择知识库" style="width: 250px;">
            <el-option v-for="kb in enabledKbs" :key="kb.kbId" :label="`📚 ${kb.kbName} (${kb.kbCode})`"
              :value="kb.kbId" />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="chatMode === 'agent' && selectedAgent" style="margin-bottom: 16px;">
        <span style="color: #666; font-size: 12px; margin-right: 8px;">快速测试：</span>
        <el-button v-for="q in quickQuestions" :key="q" size="small" @click="chatInput = q">
          {{ q }}
        </el-button>
      </div>

      <div v-if="chatMode === 'kb-retrieval' || chatMode === 'kb-rag'" style="margin-bottom: 16px;">
        <el-form :inline="true" size="small">
          <el-form-item label="召回条数">
            <el-input-number v-model="retrievalTopN" :min="1" :max="20" style="width: 100px;" />
          </el-form-item>
          <el-form-item label="相似度阈值">
            <el-input-number v-model="retrievalThreshold" :min="0" :max="1" :step="0.1" :precision="1"
              style="width: 100px;" />
          </el-form-item>
        </el-form>
        <div style="margin-top: 8px;">
          <span style="color: #666; font-size: 12px; margin-right: 8px;">快速测试：</span>
          <el-button v-for="q in kbQuickQuestions" :key="q" size="small" @click="chatInput = q">
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
          <div v-for="(msg, idx) in chatMessages" :key="idx" class="message"
            :class="msg.role === 'user' ? 'message-user' : 'message-assistant'">
            <div class="message-content">
              <div v-if="msg.role === 'assistant' && msg.type === 'retrieval'">
                <div v-if="msg.results && msg.results.length > 0">
                  <div style="margin-bottom: 8px; color: #667eea; font-weight: 600;">
                    📊 找到 {{ msg.results.length }} 个相关结果：
                  </div>
                  <div v-for="(result, rIdx) in msg.results" :key="rIdx" class="retrieval-result">
                    <div class="result-index">{{ Number(rIdx) + 1 }}.</div>
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
                  <div v-for="(source, sIdx) in msg.sources" :key="sIdx" class="source-item">
                    <span>• {{ source.docName }}</span>
                    <span class="source-score">（相似度：{{ (source.score * 100).toFixed(1) }}%）</span>
                  </div>
                </div>
              </div>
              <div v-else-if="msg.role === 'assistant' && msg.reasoningMode !== 'NONE' && (msg.tools && msg.tools.length > 0 || msg.reasoningSteps && msg.reasoningSteps.length > 0)">
                <!-- 大厂风格推理过程展示 -->
                <div v-if="msg.reasoningSteps && filterReasoningSteps(msg.reasoningSteps).length > 0" class="reasoning-container">
                  <div class="reasoning-header">
                    <div class="reasoning-title-row">
                      <span class="reasoning-brain-icon">🧠</span>
                      <span class="reasoning-title">思维链</span>
                      <span class="reasoning-subtitle">Reasoning Process</span>
                    </div>
                    <div class="reasoning-steps-badge">
                      <span class="step-count">{{ filterReasoningSteps(msg.reasoningSteps).length }}</span>
                      <span class="step-text">步</span>
                    </div>
                  </div>
                  
                  <!-- 流程指示器 -->
                  <div class="reasoning-flow">
                    <div class="flow-item" v-for="(step, sIdx) in filterReasoningSteps(msg.reasoningSteps)" :key="sIdx">
                      <span class="flow-dot" :class="'flow-' + step.stepType"></span>
                      <span class="flow-label">{{ getStepLabel(step) }}</span>
                    </div>
                  </div>

                  <!-- 详细步骤卡片 -->
                  <div class="reasoning-cards">
                    <div 
                      v-for="(step, sIdx) in filterReasoningSteps(msg.reasoningSteps)" 
                      :key="sIdx" 
                      class="step-card-wrapper"
                    >
                      <!-- 步骤序号 -->
                      <div class="step-number" :class="'number-' + step.stepType">
                        <span>{{ sIdx + 1 }}</span>
                      </div>
                      
                      <!-- 步骤内容卡片 -->
                      <div class="step-card" :class="'card-' + step.stepType">
                        <!-- 卡片头部 -->
                        <div class="step-card-header">
                          <div class="step-type-badge" :class="'badge-' + step.stepType">
                            <span class="step-type-icon">
                              <template v-if="step.stepType === 'thought'">💭</template>
                              <template v-else-if="step.stepType === 'action'">⚡</template>
                              <template v-else>📊</template>
                            </span>
                            <span class="step-type-text">
                              <template v-if="step.stepType === 'thought'">思考</template>
                              <template v-else-if="step.stepType === 'action'">工具调用</template>
                              <template v-else>执行结果</template>
                            </span>
                          </div>
                          <div class="step-card-actions">
                            <span class="step-time">步骤 {{ sIdx + 1 }}</span>
                          </div>
                        </div>
                        
                        <!-- 卡片内容 -->
                        <div class="step-card-body">
                          <template v-if="step.stepType === 'thought'">
                            <div class="thought-content">
                              <p>{{ formatThoughtContent(step.content) }}</p>
                            </div>
                          </template>
                          <template v-else-if="step.stepType === 'action'">
                            <div class="action-content">
                              <div class="action-tool-header">
                                <span class="tool-icon">🔧</span>
                                <span class="tool-name">{{ step.toolName || step.action }}</span>
                              </div>
                              <div v-if="step.actionInput || step.toolArgs" class="action-args">
                                <span class="args-label">调用参数</span>
                                <div class="args-content">
                                  <code>{{ formatArgs(step.actionInput || step.toolArgs) }}</code>
                                </div>
                              </div>
                              <div v-if="step.content" class="action-thought">
                                <span class="thought-label">思考依据</span>
                                <p>{{ formatThoughtContent(step.content) }}</p>
                              </div>
                            </div>
                          </template>
                          <template v-else>
                            <div class="observation-content">
                              <div class="observation-header">
                                <span class="result-icon">✅</span>
                                <span class="result-label">工具 <strong>{{ step.toolName }}</strong> 返回结果</span>
                              </div>
                              <div class="observation-data">
                                <pre>{{ formatObservation(step.content || step.toolOutput) }}</pre>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 最终回答卡片 -->
                <div class="final-answer-card" v-if="getFinalAnswer(msg.reasoningSteps)">
                  <div class="final-answer-header">
                    <div class="final-badge">
                      <span class="final-icon">🎯</span>
                      <span class="final-label">最终结论</span>
                    </div>
                    <div class="final-confidence">
                      <span class="confidence-label">置信度</span>
                      <div class="confidence-bar">
                        <div class="confidence-fill"></div>
                      </div>
                      <span class="confidence-value">高</span>
                    </div>
                  </div>
                  <div class="final-answer-body">
                    {{ getFinalAnswer(msg.reasoningSteps) }}
                  </div>
                </div>
                
                <!-- 备用：如果没有推理步骤，直接显示内容 -->
                <div v-else-if="msg.content" style="white-space: pre-wrap;">{{ msg.content }}</div>
              </div>
              <div v-else>{{ msg.content }}</div>
            </div>
          </div>
          <div v-if="chatLoading" class="loading">
            <span>🤔 AI正在思考...</span>
          </div>
        </div>
        <div class="chat-input">
          <el-input v-model="chatInput" placeholder="输入消息..." @keyup.enter="sendMessage" :disabled="chatLoading" />
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
import type { ReasoningStep } from '@/api/agent'

const formatThoughtContent = (content?: string) => {
  if (!content) return ''
  // 移除 Thought: 前缀和其他格式标记
  let cleaned = content
    .replace(/^(Thought|Thought:)\s*/i, '')
    .replace(/^[:：]\s*/, '')
    .trim()
  
  // 移除 Action:、Action Input:、Observation: 等内部逻辑行
  cleaned = cleaned.split('\n').filter(line => {
    const trimmedLine = line.trim()
    return !trimmedLine.startsWith('Action:') && 
           !trimmedLine.startsWith('Action Input:') &&
           !trimmedLine.startsWith('Observation:') &&
           !trimmedLine.startsWith('Thought:')
  }).join('\n').trim()
  
  return cleaned || content.trim()
}

const formatFinalAnswer = (content?: string) => {
  if (!content) return ''
  // 后端已经处理好了答案格式，这里只做简单的清理
  let cleaned = content.trim()
  // 移除 Observation: 及其内容（如果后端漏掉了）
  cleaned = cleaned.replace(/Observation:\s*\{[\s\S]*?\}\s*/g, '')
  // 清理多余空白
  cleaned = cleaned.replace(/\n{2,}/g, '\n').trim()
  return cleaned
}

const formatArgs = (args: any) => {
  if (!args) return ''
  if (typeof args === 'object') {
    return JSON.stringify(args, null, 2)
  }
  return String(args)
}

const formatObservation = (observation: any) => {
  if (!observation) return ''
  if (typeof observation === 'object') {
    return JSON.stringify(observation, null, 2)
  }
  return String(observation)
}

const getFinalAnswer = (steps?: ReasoningStep[]) => {
  if (!steps) return ''
  const finalStep = steps.find(s => s.stepType === 'final_answer')
  if (finalStep) {
    const content = (finalStep.content || '').replace(/^(Final Answer|Final Answer:)\s*/i, '').trim()
    return formatFinalAnswer(content)
  }
  return ''
}

const filterReasoningSteps = (steps?: ReasoningStep[]) => {
  if (!steps || steps.length === 0) return []
  
  const finalAnswer = getFinalAnswer(steps)
  const filteredSteps: ReasoningStep[] = []
  
  for (const step of steps) {
    // 跳过 final_answer 类型（单独显示）
    if (step.stepType === 'final_answer') continue
    
    // 如果有最终答案，检查当前thought是否是最终答案的开头部分
    if (finalAnswer && step.stepType === 'thought' && step.content) {
      const thoughtContent = formatThoughtContent(step.content)
      // 如果thought内容是最终答案的开头（超过50%重叠），跳过这个thought
      if (finalAnswer.startsWith(thoughtContent) && thoughtContent.length > 5) {
        continue
      }
    }
    
    filteredSteps.push(step)
  }
  
  return filteredSteps
}

const getStepLabel = (step: ReasoningStep) => {
  if (step.stepType === 'thought') return '思考'
  if (step.stepType === 'action') return step.toolName || '工具调用'
  if (step.stepType === 'observation') return '结果'
  return '步骤'
}

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

      const results = res.data.data.list || []
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
      chatMessages.value.push({ role: 'assistant', content: '', tools: [], reasoningSteps: [] })
      const assistantMsgIndex = chatMessages.value.length - 1

      console.log('[Chat] Starting agent stream chat')
      await agentApi.streamChat(
        selectedAgent.value!,
        userMsg,
        (content: string) => {
          console.log('[Chat] Received chunk:', content)
          // 检查是否是重置信号
          if (content === '\x00') {
            chatMessages.value[assistantMsgIndex].content = ''
          } else {
            chatMessages.value[assistantMsgIndex].content += content
          }
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
        (step: any) => {
          // 显示推理步骤（小字形式）
          if (!chatMessages.value[assistantMsgIndex].reasoningSteps) {
            chatMessages.value[assistantMsgIndex].reasoningSteps = []
          }
          chatMessages.value[assistantMsgIndex].reasoningSteps.push(step)
          nextTick(() => {
            if (chatMessagesRef.value) {
              chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
            }
          })
        },
        (error: any) => {
          console.error('智能体流式调用错误:', error)
          chatMessages.value[assistantMsgIndex].content = '调用失败: ' + (error.message || error)
        },
        (steps: any[], response?: string) => {
          // 如果有完整的响应，使用完整响应替换流式内容
          if (response) {
            chatMessages.value[assistantMsgIndex].content = response
          }
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

.reasoning-steps {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f0f4ff;
  border-radius: 6px;
  border-left: 3px solid #6366f1;

  .reasoning-step {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 4px;
    font-size: 12px;
    color: #64748b;
    line-height: 1.5;

    &:last-child {
      margin-bottom: 0;
    }

    .step-type {
      font-size: 12px;
      flex-shrink: 0;
    }

    .step-content {
      font-style: italic;
    }
  }
}

/* 大厂风格推理过程样式 */
.reasoning-container {
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.reasoning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  color: white;
}

.reasoning-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reasoning-brain-icon {
  font-size: 22px;
}

.reasoning-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.reasoning-subtitle {
  font-size: 12px;
  opacity: 0.8;
  font-weight: 400;
  margin-left: 4px;
}

.reasoning-steps-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;

  .step-count {
    font-weight: 700;
    font-size: 15px;
  }

  .step-text {
    opacity: 0.9;
  }
}

/* 流程指示器 */
.reasoning-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}

.flow-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  white-space: nowrap;
}

.flow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.flow-thought {
    background: #8b5cf6;
  }

  &.flow-action {
    background: #f59e0b;
  }

  &.flow-observation {
    background: #10b981;
  }
}

.flow-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

/* 详细步骤卡片 */
.reasoning-cards {
  padding: 16px 20px;
}

.step-card-wrapper {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;

  &.number-thought {
    background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
    color: #7c3aed;
  }

  &.number-action {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    color: #d97706;
  }

  &.number-observation {
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    color: #059669;
  }
}

.step-card {
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }

  &.card-thought {
    background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
    border: 1px solid #e9d5ff;
  }

  &.card-action {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border: 1px solid #fcd34d;
  }

  &.card-observation {
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    border: 1px solid #86efac;
  }
}

.step-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.step-type-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;

  &.badge-thought {
    background: rgba(124, 58, 237, 0.1);
  }

  &.badge-action {
    background: rgba(217, 119, 6, 0.1);
  }

  &.badge-observation {
    background: rgba(5, 150, 105, 0.1);
  }
}

.step-type-icon {
  font-size: 14px;
}

.step-type-text {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.step-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-time {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.step-card-body {
  padding: 14px 16px;
}

/* 思考内容 */
.thought-content {
  p {
    font-size: 14px;
    line-height: 1.7;
    color: #374151;
    font-style: italic;
    margin: 0;
  }
}

/* 工具调用内容 */
.action-content {
  .action-tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .tool-icon {
    font-size: 16px;
  }

  .tool-name {
    font-size: 14px;
    font-weight: 600;
    color: #92400e;
  }

  .action-args {
    margin-bottom: 10px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.03);
    border-radius: 8px;

    .args-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .args-content {
      background: white;
      border-radius: 6px;
      padding: 8px;
      overflow-x: auto;

      code {
        font-size: 12px;
        color: #374151;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
      }
    }
  }

  .action-thought {
    .thought-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    p {
      font-size: 13px;
      line-height: 1.6;
      color: #4b5563;
      font-style: italic;
      margin: 0;
    }
  }
}

/* 工具返回结果 */
.observation-content {
  .observation-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;

    .result-icon {
      font-size: 14px;
    }

    .result-label {
      font-size: 13px;
      font-weight: 600;
      color: #065f46;
    }
  }

  .observation-data {
    background: white;
    border-radius: 8px;
    padding: 12px;
    border: 1px solid #d1fae5;
    overflow-x: auto;

    pre {
      font-size: 13px;
      color: #374151;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
    }
  }
}

/* 最终回答卡片样式 */
.final-answer-card {
  margin-top: 16px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #86efac;
  box-shadow: 0 4px 16px rgba(22, 101, 52, 0.12);
}

.final-answer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(22, 101, 52, 0.1);
}

.final-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(5, 150, 105, 0.1);
  border-radius: 20px;

  .final-icon {
    font-size: 18px;
  }

  .final-label {
    font-size: 13px;
    font-weight: 600;
    color: #166534;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.final-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 20px;

  .confidence-label {
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
  }

  .confidence-bar {
    width: 40px;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;

    .confidence-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      border-radius: 3px;
      animation: confidenceGrow 0.5s ease-out;
    }
  }

  .confidence-value {
    font-size: 11px;
    font-weight: 600;
    color: #059669;
  }
}

@keyframes confidenceGrow {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

.final-answer-body {
  padding: 18px;
  font-size: 15px;
  line-height: 1.8;
  color: #14532d;
  white-space: pre-wrap;
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
