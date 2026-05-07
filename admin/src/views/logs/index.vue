<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">📋 调用日志</h1>
      <p class="page-description">记录所有AI模型调用、技能执行、智能体对话的历史记录</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 调用日志说明</div>
      <p>记录所有AI模型调用、技能执行、智能体对话的历史记录，可用于问题排查和性能分析。</p>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- AI调用日志 -->
      <div class="card">
        <el-tab-pane label="🤖 AI调用日志" name="ai">
          <div class="filter-section">
            <el-input v-model="aiFilters.modelCode" placeholder="模型代码" clearable style="width: 200px"
              @clear="handleAiSearch" @keyup.enter="handleAiSearch" />
            <el-select v-model="aiFilters.modelType" placeholder="模型类型" clearable style="width: 150px"
              @change="handleAiSearch">
              <el-option label="LLM" value="llm" />
              <el-option label="Embedding" value="embedding" />
              <el-option label="图像生成" value="image" />
              <el-option label="语音合成" value="tts" />
              <el-option label="语音识别" value="asr" />
            </el-select>
            <el-select v-model="aiFilters.success" placeholder="调用状态" clearable style="width: 120px"
              @change="handleAiSearch">
              <el-option label="成功" :value="true" />
              <el-option label="失败" :value="false" />
            </el-select>
            <el-date-picker v-model="aiFilters.timeRange" type="datetimerange" range-separator="至"
              start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 360px"
              @change="handleAiSearch" />
            <el-button type="primary" @click="handleAiSearch">查询</el-button>
            <el-button @click="handleAiReset">重置</el-button>
          </div>

          <el-table :data="aiLogs" stripe v-loading="aiLoading">
            <el-table-column label="调用时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="模型信息" width="200">
              <template #default="{ row }">
                <div>
                  <el-tag type="info" size="small">{{ row.modelCode }}</el-tag>
                  <div v-if="row.model" style="font-size: 12px; color: #999; margin-top: 4px">
                    {{ row.model.name }}
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="modelType" label="类型" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.modelType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="耗时" width="100" align="right">
              <template #default="{ row }">
                <span :style="{ color: row.costMs > 5000 ? '#ff4d4f' : '#52c41a' }">
                  {{ row.costMs }}ms
                </span>
              </template>
            </el-table-column>
            <el-table-column label="Token使用" width="140" align="right">
              <template #default="{ row }">
                <div v-if="row.inputTokens || row.outputTokens" style="font-size: 12px">
                  <div>输入: {{ row.inputTokens || 0 }}</div>
                  <div>输出: {{ row.outputTokens || 0 }}</div>
                </div>
                <span v-else style="color: #999">-</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                  {{ row.success ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="客户端IP" width="140">
              <template #default="{ row }">
                <span style="font-size: 12px; color: #666">{{ row.clientIp || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="错误信息" min-width="200">
              <template #default="{ row }">
                <el-tooltip v-if="row.errorMessage" :content="row.errorMessage" placement="top">
                  <span style="color: #ff4d4f; font-size: 12px; cursor: pointer">
                    {{ truncateText(row.errorMessage, 30) }}
                  </span>
                </el-tooltip>
                <span v-else style="color: #999">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleViewAiDetail(row)">
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-section">
            <el-pagination v-model:current-page="aiPagination.page" v-model:page-size="aiPagination.pageSize"
              :page-sizes="[10, 20, 50, 100]" :total="aiPagination.total"
              layout="total, sizes, prev, pager, next, jumper" @size-change="loadAiLogs" @current-change="loadAiLogs" />
          </div>
        </el-tab-pane>

        <!-- Agent调用日志 -->
        <el-tab-pane label="🧠 Agent调用日志" name="agent">
          <div class="filter-section">
            <el-input v-model="agentFilters.agentCode" placeholder="Agent代码" clearable style="width: 200px"
              @clear="handleAgentSearch" @keyup.enter="handleAgentSearch" />
            <el-select v-model="agentFilters.success" placeholder="调用状态" clearable style="width: 120px"
              @change="handleAgentSearch">
              <el-option label="成功" :value="true" />
              <el-option label="失败" :value="false" />
            </el-select>
            <el-date-picker v-model="agentFilters.timeRange" type="datetimerange" range-separator="至"
              start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 360px"
              @change="handleAgentSearch" />
            <el-button type="primary" @click="handleAgentSearch">查询</el-button>
            <el-button @click="handleAgentReset">重置</el-button>
          </div>

          <el-table :data="agentLogs" stripe v-loading="agentLoading">
            <el-table-column label="调用时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="Agent信息" width="200">
              <template #default="{ row }">
                <div>
                  <el-tag type="primary" size="small">{{ row.agent?.code || row.agentId }}</el-tag>
                  <div style="font-size: 12px; color: #999; margin-top: 4px">
                    {{ row.agent?.name || '-' }}
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="耗时" width="100" align="right">
              <template #default="{ row }">
                <span :style="{ color: row.costMs > 5000 ? '#ff4d4f' : '#52c41a' }">
                  {{ row.costMs }}ms
                </span>
              </template>
            </el-table-column>
            <el-table-column label="Token使用" width="140" align="right">
              <template #default="{ row }">
                <div v-if="row.inputTokens || row.outputTokens" style="font-size: 12px">
                  <div>输入: {{ row.inputTokens || 0 }}</div>
                  <div>输出: {{ row.outputTokens || 0 }}</div>
                </div>
                <span v-else style="color: #999">-</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                  {{ row.success ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="客户端IP" width="140">
              <template #default="{ row }">
                <span style="font-size: 12px; color: #666">{{ row.clientIp || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="错误信息" min-width="200">
              <template #default="{ row }">
                <el-tooltip v-if="row.errorMessage" :content="row.errorMessage" placement="top">
                  <span style="color: #ff4d4f; font-size: 12px; cursor: pointer">
                    {{ truncateText(row.errorMessage, 30) }}
                  </span>
                </el-tooltip>
                <span v-else style="color: #999">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleViewAgentDetail(row)">
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-section">
            <el-pagination v-model:current-page="agentPagination.page" v-model:page-size="agentPagination.pageSize"
              :page-sizes="[10, 20, 50, 100]" :total="agentPagination.total"
              layout="total, sizes, prev, pager, next, jumper" @size-change="loadAgentLogs"
              @current-change="loadAgentLogs" />
          </div>
        </el-tab-pane>

        <!-- Skill调用日志 -->
        <el-tab-pane label="⚡ Skill调用日志" name="skill">
          <div class="filter-section">
            <el-input v-model="skillFilters.skillCode" placeholder="技能代码" clearable style="width: 200px"
              @clear="handleSkillSearch" @keyup.enter="handleSkillSearch" />
            <el-select v-model="skillFilters.success" placeholder="调用状态" clearable style="width: 120px"
              @change="handleSkillSearch">
              <el-option label="成功" :value="true" />
              <el-option label="失败" :value="false" />
            </el-select>
            <el-date-picker v-model="skillFilters.timeRange" type="datetimerange" range-separator="至"
              start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 360px"
              @change="handleSkillSearch" />
            <el-button type="primary" @click="handleSkillSearch">查询</el-button>
            <el-button @click="handleSkillReset">重置</el-button>
          </div>

          <el-table :data="skillLogs" stripe v-loading="skillLoading">
            <el-table-column label="调用时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="技能信息" width="200">
              <template #default="{ row }">
                <div>
                  <el-tag type="warning" size="small">{{ row.skillCode }}</el-tag>
                  <div style="font-size: 12px; color: #999; margin-top: 4px">
                    {{ row.skillName }}
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="耗时" width="100" align="right">
              <template #default="{ row }">
                <span :style="{ color: row.costMs > 5000 ? '#ff4d4f' : '#52c41a' }">
                  {{ row.costMs }}ms
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                  {{ row.success ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="客户端IP" width="140">
              <template #default="{ row }">
                <span style="font-size: 12px; color: #666">{{ row.clientIp || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="错误信息" min-width="200">
              <template #default="{ row }">
                <el-tooltip v-if="row.errorMessage" :content="row.errorMessage" placement="top">
                  <span style="color: #ff4d4f; font-size: 12px; cursor: pointer">
                    {{ truncateText(row.errorMessage, 30) }}
                  </span>
                </el-tooltip>
                <span v-else style="color: #999">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleViewSkillDetail(row)">
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-section">
            <el-pagination v-model:current-page="skillPagination.page" v-model:page-size="skillPagination.pageSize"
              :page-sizes="[10, 20, 50, 100]" :total="skillPagination.total"
              layout="total, sizes, prev, pager, next, jumper" @size-change="loadSkillLogs"
              @current-change="loadSkillLogs" />
          </div>
        </el-tab-pane>
      </div>
    </el-tabs>

    <!-- AI日志详情抽屉 -->
    <el-drawer v-model="aiDetailVisible" title="AI调用日志详情" direction="rtl" size="60%">
      <div v-if="currentAiLog" class="log-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日志ID">{{ currentAiLog.id }}</el-descriptions-item>
          <el-descriptions-item label="调用时间">{{ formatTime(currentAiLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="模型代码">{{ currentAiLog.modelCode }}</el-descriptions-item>
          <el-descriptions-item label="模型类型">{{ currentAiLog.modelType }}</el-descriptions-item>
          <el-descriptions-item label="模型名称">
            {{ currentAiLog.model?.name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="提供商">
            {{ currentAiLog.model?.provider || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentAiLog.costMs }}ms</el-descriptions-item>
          <el-descriptions-item label="调用状态">
            <el-tag :type="currentAiLog.success ? 'success' : 'danger'">
              {{ currentAiLog.success ? '成功' : '失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="输入Token">{{ currentAiLog.inputTokens || 0 }}</el-descriptions-item>
          <el-descriptions-item label="输出Token">{{ currentAiLog.outputTokens || 0 }}</el-descriptions-item>
          <el-descriptions-item label="客户端IP">{{ currentAiLog.clientIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户代理">{{ currentAiLog.userAgent || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentAiLog.errorMessage" class="error-section">
          <h4>错误信息</h4>
          <el-alert type="error" :closable="false">
            <pre>{{ currentAiLog.errorMessage }}</pre>
          </el-alert>
        </div>

        <div class="request-section">
          <h4>请求数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentAiLog.request)" :rows="10" readonly />
        </div>

        <div class="response-section">
          <h4>响应数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentAiLog.response)" :rows="10" readonly />
        </div>
      </div>
    </el-drawer>

    <!-- Agent日志详情抽屉 -->
    <el-drawer v-model="agentDetailVisible" title="Agent调用日志详情" direction="rtl" size="60%">
      <div v-if="currentAgentLog" class="log-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日志ID">{{ currentAgentLog.id }}</el-descriptions-item>
          <el-descriptions-item label="调用时间">{{ formatTime(currentAgentLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="Agent代码">{{ currentAgentLog.agent?.code || currentAgentLog.agentId
          }}</el-descriptions-item>
          <el-descriptions-item label="Agent名称">{{ currentAgentLog.agent?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentAgentLog.costMs }}ms</el-descriptions-item>
          <el-descriptions-item label="输入Token">{{ currentAgentLog.inputTokens || 0 }}</el-descriptions-item>
          <el-descriptions-item label="输出Token">{{ currentAgentLog.outputTokens || 0 }}</el-descriptions-item>
          <el-descriptions-item label="调用状态">
            <el-tag :type="currentAgentLog.success ? 'success' : 'danger'">
              {{ currentAgentLog.success ? '成功' : '失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户端IP">{{ currentAgentLog.clientIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户代理">{{ currentAgentLog.userAgent || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentAgentLog.errorMessage" class="error-section">
          <h4>错误信息</h4>
          <el-alert type="error" :closable="false">
            <pre>{{ currentAgentLog.errorMessage }}</pre>
          </el-alert>
        </div>

        <div class="request-section">
          <h4>请求数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentAgentLog.request)" :rows="10" readonly />
        </div>

        <div class="response-section">
          <h4>响应数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentAgentLog.response)" :rows="10" readonly />
        </div>
      </div>
    </el-drawer>

    <!-- Skill日志详情抽屉 -->
    <el-drawer v-model="skillDetailVisible" title="Skill调用日志详情" direction="rtl" size="60%">
      <div v-if="currentSkillLog" class="log-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日志ID">{{ currentSkillLog.id }}</el-descriptions-item>
          <el-descriptions-item label="调用时间">{{ formatTime(currentSkillLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="技能代码">{{ currentSkillLog.skillCode }}</el-descriptions-item>
          <el-descriptions-item label="技能名称">{{ currentSkillLog.skillName }}</el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentSkillLog.costMs }}ms</el-descriptions-item>
          <el-descriptions-item label="调用状态">
            <el-tag :type="currentSkillLog.success ? 'success' : 'danger'">
              {{ currentSkillLog.success ? '成功' : '失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户端IP">{{ currentSkillLog.clientIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户代理">{{ currentSkillLog.userAgent || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentSkillLog.errorMessage" class="error-section">
          <h4>错误信息</h4>
          <el-alert type="error" :closable="false">
            <pre>{{ currentSkillLog.errorMessage }}</pre>
          </el-alert>
        </div>

        <div class="request-section">
          <h4>请求数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentSkillLog.request)" :rows="10" readonly />
        </div>

        <div class="response-section">
          <h4>响应数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentSkillLog.response)" :rows="10" readonly />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { logApi, type Log, type AgentLog, type SkillLog } from '@/api/log'

const activeTab = ref('ai')

// AI日志相关
const aiLoading = ref(false)
const aiLogs = ref<Log[]>([])
const aiDetailVisible = ref(false)
const currentAiLog = ref<Log | null>(null)

const aiFilters = reactive({
  modelCode: '',
  modelType: '',
  success: undefined as boolean | undefined,
  timeRange: null as [string, string] | null,
})

const aiPagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

// Agent日志相关
const agentLoading = ref(false)
const agentLogs = ref<AgentLog[]>([])
const agentDetailVisible = ref(false)
const currentAgentLog = ref<AgentLog | null>(null)

const agentFilters = reactive({
  agentCode: '',
  success: undefined as boolean | undefined,
  timeRange: null as [string, string] | null,
})

const agentPagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

// Skill日志相关
const skillLoading = ref(false)
const skillLogs = ref<SkillLog[]>([])
const skillDetailVisible = ref(false)
const currentSkillLog = ref<SkillLog | null>(null)

const skillFilters = reactive({
  skillCode: '',
  success: undefined as boolean | undefined,
  timeRange: null as [string, string] | null,
})

const skillPagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const truncateText = (text: string, maxLength: number) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

const formatJson = (jsonStr?: string) => {
  if (!jsonStr) return ''
  try {
    const obj = JSON.parse(jsonStr)
    return JSON.stringify(obj, null, 2)
  } catch {
    return jsonStr
  }
}

// AI日志加载
const loadAiLogs = async () => {
  aiLoading.value = true
  try {
    const params: Record<string, unknown> = {
      page: aiPagination.page,
      pageSize: aiPagination.pageSize,
    }

    if (aiFilters.modelCode) params.modelCode = aiFilters.modelCode
    if (aiFilters.modelType) params.modelType = aiFilters.modelType
    if (aiFilters.success !== undefined) params.success = aiFilters.success
    if (aiFilters.timeRange && aiFilters.timeRange.length === 2) {
      params.startTime = aiFilters.timeRange[0]
      params.endTime = aiFilters.timeRange[1]
    }

    const res = await logApi.getAiLogs(params)
    aiLogs.value = res.data.data?.list || []
    aiPagination.total = res.data.data?.total || 0
  } catch (error) {
    console.error('加载AI日志失败', error)
  } finally {
    aiLoading.value = false
  }
}

const handleAiSearch = () => {
  aiPagination.page = 1
  loadAiLogs()
}

const handleAiReset = () => {
  aiFilters.modelCode = ''
  aiFilters.modelType = ''
  aiFilters.success = undefined
  aiFilters.timeRange = null
  aiPagination.page = 1
  loadAiLogs()
}

const handleViewAiDetail = async (log: Log) => {
  try {
    const res = await logApi.getAiLogById(log.id)
    currentAiLog.value = res.data.data
    aiDetailVisible.value = true
  } catch (error) {
    console.error('加载AI日志详情失败', error)
  }
}

// Agent日志加载
const loadAgentLogs = async () => {
  agentLoading.value = true
  try {
    const params: Record<string, unknown> = {
      page: agentPagination.page,
      pageSize: agentPagination.pageSize,
    }

    if (agentFilters.agentCode) params.agentCode = agentFilters.agentCode
    if (agentFilters.success !== undefined) params.success = agentFilters.success
    if (agentFilters.timeRange && agentFilters.timeRange.length === 2) {
      params.startTime = agentFilters.timeRange[0]
      params.endTime = agentFilters.timeRange[1]
    }

    const res = await logApi.getAgentLogs(params)
    agentLogs.value = res.data.data?.list || []
    agentPagination.total = res.data.data?.total || 0
  } catch (error) {
    console.error('加载Agent日志失败', error)
  } finally {
    agentLoading.value = false
  }
}

const handleAgentSearch = () => {
  agentPagination.page = 1
  loadAgentLogs()
}

const handleAgentReset = () => {
  agentFilters.agentCode = ''
  agentFilters.success = undefined
  agentFilters.timeRange = null
  agentPagination.page = 1
  loadAgentLogs()
}

const handleViewAgentDetail = async (log: AgentLog) => {
  try {
    const res = await logApi.getAgentLogById(log.id)
    currentAgentLog.value = res.data.data
    agentDetailVisible.value = true
  } catch (error) {
    console.error('加载Agent日志详情失败', error)
  }
}

// Skill日志加载
const loadSkillLogs = async () => {
  skillLoading.value = true
  try {
    const params: Record<string, unknown> = {
      page: skillPagination.page,
      pageSize: skillPagination.pageSize,
    }

    if (skillFilters.skillCode) params.skillCode = skillFilters.skillCode
    if (skillFilters.success !== undefined) params.success = skillFilters.success
    if (skillFilters.timeRange && skillFilters.timeRange.length === 2) {
      params.startTime = skillFilters.timeRange[0]
      params.endTime = skillFilters.timeRange[1]
    }

    const res = await logApi.getSkillLogs(params)
    skillLogs.value = res.data.data?.list || []
    skillPagination.total = res.data.data?.total || 0
  } catch (error) {
    console.error('加载Skill日志失败', error)
  } finally {
    skillLoading.value = false
  }
}

const handleSkillSearch = () => {
  skillPagination.page = 1
  loadSkillLogs()
}

const handleSkillReset = () => {
  skillFilters.skillCode = ''
  skillFilters.success = undefined
  skillFilters.timeRange = null
  skillPagination.page = 1
  loadSkillLogs()
}

const handleViewSkillDetail = async (log: SkillLog) => {
  try {
    const res = await logApi.getSkillLogById(log.id)
    currentSkillLog.value = res.data.data
    skillDetailVisible.value = true
  } catch (error) {
    console.error('加载Skill日志详情失败', error)
  }
}

const handleTabChange = () => {
  if (activeTab.value === 'ai' && aiLogs.value.length === 0) {
    loadAiLogs()
  } else if (activeTab.value === 'agent' && agentLogs.value.length === 0) {
    loadAgentLogs()
  } else if (activeTab.value === 'skill' && skillLogs.value.length === 0) {
    loadSkillLogs()
  }
}

onMounted(() => {
  loadAiLogs()
})
</script>

<style lang="scss" scoped>
.filter-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.pagination-section {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.log-detail {
  h4 {
    margin: 20px 0 10px;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }
}

.error-section {
  margin-top: 20px;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
}

.request-section,
.response-section {
  margin-top: 20px;
}
</style>