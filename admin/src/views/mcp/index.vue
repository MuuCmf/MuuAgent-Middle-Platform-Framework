<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">MCP调度管理</h1>
      <p class="page-description">监控模型状态、熔断保护、并发控制、QPS限制和策略配置</p>
    </div>


    <el-tabs v-model="activeTab">
      <el-tab-pane label="模型状态监控" name="status">

        <div class="card">
          <div class="card-title">
            状态监控
          </div>
          <div class="help-tip" style="margin-bottom: 20px;">
            <div class="help-tip-title">💡 状态说明</div>
            <ul>
              <li><strong>并发控制</strong>：限制同时进行的请求数，防止过载</li>
              <li><strong>QPS限制</strong>：每秒最大请求数</li>
              <li><strong>重置熔断</strong>：手动将熔断的模型恢复正常</li>
              <li><strong>熔断状态</strong>：
                <ul>
                  <li><code>closed</code>：正常状态，可正常调用</li>
                  <li><code>open</code>：熔断状态，模型暂时不可用（错误次数过多触发）</li>
                  <li><code>half_open</code>：半开状态，正在尝试恢复</li>
                </ul>
              </li>
            </ul>
          </div>

          <el-table :data="modelStatus" stripe v-loading="statusLoading">
            <el-table-column label="模型">
              <template #default="{ row }">
                <strong>{{ row.modelName }}</strong>
                <br>
                <small style="color: #999">{{ row.modelCode }}</small>
              </template>
            </el-table-column>
            <el-table-column prop="circuitStatus" label="熔断状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getCircuitTagType(row.circuitStatus)">
                  {{ getCircuitStatusText(row.circuitStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="errorCount" label="错误次数" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.errorCount > 0" type="danger">{{ row.errorCount }}</el-tag>
                <span v-else>{{ row.errorCount }}</span>
              </template>
            </el-table-column>
            <el-table-column label="当前并发" width="120">
              <template #default="{ row }">
                {{ row.currentConcurrent }} / {{ row.maxConcurrent }}
              </template>
            </el-table-column>
            <el-table-column prop="maxConcurrent" label="最大并发" width="100" />
            <el-table-column prop="qpsLimit" label="QPS限制" width="100" />
            <el-table-column label="操作" width="120" align="right">
              <template #default="{ row }">
                <el-button v-if="row.circuitStatus !== 'closed'" size="small" type="primary"
                  @click="handleResetCircuit(row.modelId)">
                  重置熔断
                </el-button>
                <el-button v-else size="small" type="primary" disabled>
                  重置熔断
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="策略配置" name="strategy">
        <div class="card">
          <div class="card-title">
            策略配置
          </div>
          <div class="help-tip" style="margin-bottom: 20px;">
            <div class="help-tip-title">💡 策略配置说明</div>
            <ul>
              <li><strong>调度策略</strong>：
                <ul>
                  <li><code>weight</code>：权重调度，根据模型权重分配请求</li>
                  <li><code>random</code>：随机调度，随机选择可用模型</li>
                  <li><code>round_robin</code>：轮询调度，依次调用各个模型</li>
                  <li><code>failover</code>：故障转移，主模型不可用时切换到备用模型</li>
                </ul>
              </li>
              <li><strong>重试机制</strong>：请求失败后自动重试，提高成功率</li>
              <li><strong>熔断保护</strong>：错误次数达到阈值时自动熔断，保护系统稳定性</li>
              <li><strong>降级模型</strong>：主模型不可用时自动切换到降级模型</li>
            </ul>
          </div>

          <div style="margin-bottom: 16px;">
            <el-button type="primary" @click="handleAddStrategy">
              <el-icon>
                <Plus />
              </el-icon>
              新建策略
            </el-button>
          </div>

          <el-table :data="strategies" stripe v-loading="strategyLoading">
            <el-table-column prop="modelType" label="模型类型">
              <template #default="{ row }">
                <el-tag>{{ row.modelType }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="strategy" label="调度策略" width="120">
              <template #default="{ row }">
                <el-tag :type="getStrategyType(row.strategy)">
                  {{ getStrategyLabel(row.strategy) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="重试配置" width="180">
              <template #default="{ row }">
                <el-space direction="vertical" :size="4">
                  <el-tag size="small">重试次数: {{ row.retryCount }}</el-tag>
                  <el-tag size="small">超时: {{ row.timeout }}ms</el-tag>
                </el-space>
              </template>
            </el-table-column>

            <el-table-column label="熔断配置" width="220">
              <template #default="{ row }">
                <div v-if="row.enableCircuit">
                  <el-space direction="vertical" :size="4">
                    <el-tag size="small" type="success">熔断已启用</el-tag>
                    <el-tag size="small">错误阈值: {{ row.circuitThreshold }}</el-tag>
                    <el-tag size="small">恢复时间: {{ row.circuitTimeout }}ms</el-tag>
                  </el-space>
                </div>
                <el-tag v-else size="small" type="info">熔断未启用</el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="fallbackModelId" label="降级模型" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.fallbackModelId" type="warning">{{ row.fallbackModelId }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="180" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleEditStrategy(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteStrategy(row.modelType)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="意图关键词" name="keyword">
        <div class="help-tip" style="margin-bottom: 20px;">
          <div class="help-tip-title">💡 关键词规则说明</div>
          <ul>
            <li><strong>意图类型</strong>：general(通用)、code(代码)、math(数学)、creative(创意)、image(生图)、tts(语音合成)、asr(语音识别)</li>
            <li><strong>关键词</strong>：用于匹配用户消息的关键词，支持正则表达式</li>
            <li><strong>权重</strong>：数值越大优先级越高，当多个意图同时匹配时，权重高的优先</li>
            <li><strong>修改后实时生效</strong>：增删改操作会自动刷新运行时缓存，无需重启服务</li>
          </ul>
        </div>

        <div class="card">
          <div class="card-title">
            关键词列表
            <el-tag type="info" size="small">{{ keywordTotal }} 条</el-tag>
          </div>

          <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <el-button type="primary" @click="handleAddKeyword">
              <el-icon><Plus /></el-icon>
              添加关键词
            </el-button>

            <el-button @click="showBatchImport = true">
              <el-icon><Upload /></el-icon>
              批量导入
            </el-button>

            <el-select v-model="keywordFilterIntent" placeholder="意图类型" clearable style="width: 140px;" @change="loadKeywords">
              <el-option label="通用(general)" value="general" />
              <el-option label="代码(code)" value="code" />
              <el-option label="数学(math)" value="math" />
              <el-option label="创意(creative)" value="creative" />
              <el-option label="生图(image)" value="image" />
              <el-option label="语音合成(tts)" value="tts" />
              <el-option label="语音识别(asr)" value="asr" />
            </el-select>

            <el-select v-model="keywordFilterStatus" placeholder="状态" clearable style="width: 120px;" @change="loadKeywords">
              <el-option label="启用" :value="true" />
              <el-option label="禁用" :value="false" />
            </el-select>

            <el-input v-model="keywordFilterText" placeholder="搜索关键词" clearable style="width: 200px;" @clear="loadKeywords" @keyup.enter="loadKeywords">
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>

            <el-button @click="loadKeywords">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

          <el-table :data="keywordList" stripe v-loading="keywordLoading">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="intent" label="意图类型" width="140">
              <template #default="{ row }">
                <el-tag :type="getKeywordIntentTagType(row.intent)">{{ getKeywordIntentLabel(row.intent) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="keyword" label="关键词" min-width="200">
              <template #default="{ row }">
                <code style="background: #f5f7fa; padding: 2px 8px; border-radius: 4px;">{{ row.keyword }}</code>
                <el-tag v-if="row.isRegex" type="warning" size="small" style="margin-left: 8px;">正则</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="weight" label="权重" width="80" align="center" />
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.status"
                  @change="(val: boolean) => handleToggleKeywordStatus(row.id, val)"
                  active-text="启用"
                  inactive-text="禁用"
                />
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
            <el-table-column prop="updatedAt" label="更新时间" width="170">
              <template #default="{ row }">
                {{ formatKeywordTime(row.updatedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" align="right" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleEditKeyword(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteKeyword(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
            <el-pagination
              v-model:current-page="keywordPage"
              v-model:page-size="keywordPageSize"
              :total="keywordTotal"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @change="loadKeywords"
            />
          </div>
        </div>

        <el-dialog v-model="keywordDialogVisible" :title="editingKeyword ? '编辑关键词' : '添加关键词'" width="550px">
          <el-form :model="keywordForm" label-width="100px">
            <el-form-item label="意图类型" required>
              <el-select v-model="keywordForm.intent" style="width: 100%;">
                <el-option label="通用 (general)" value="general" />
                <el-option label="代码 (code)" value="code" />
                <el-option label="数学 (math)" value="math" />
                <el-option label="创意 (creative)" value="creative" />
                <el-option label="生图 (image)" value="image" />
                <el-option label="语音合成 (tts)" value="tts" />
                <el-option label="语音识别 (asr)" value="asr" />
              </el-select>
            </el-form-item>

            <el-form-item label="关键词" required>
              <el-input v-model="keywordForm.keyword" placeholder="输入关键词，如：写代码、画图、翻译" />
            </el-form-item>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="权重">
                  <el-input-number v-model="keywordForm.weight" :min="1" :max="100" style="width: 100%;" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="正则表达式">
                  <el-switch v-model="keywordForm.isRegex" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="描述">
              <el-input v-model="keywordForm.description" type="textarea" :rows="2" placeholder="可选，描述该关键词的用途" />
            </el-form-item>
          </el-form>

          <template #footer>
            <el-button @click="keywordDialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="keywordSubmitting" @click="handleSubmitKeyword">
              {{ editingKeyword ? '更新' : '创建' }}
            </el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="showBatchImport" title="批量导入关键词" width="650px">
          <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
            <template #title>
              每行一条，格式：<code>意图类型,关键词,权重,是否正则,描述</code>
            </template>
            <p style="margin-top: 4px;">示例：<code>code,写代码,5,false,代码相关</code></p>
          </el-alert>

          <el-input
            v-model="batchText"
            type="textarea"
            :rows="10"
            placeholder="code,写代码,5,false,代码相关&#10;math,计算,3,false,数学计算&#10;image,/画.*图/,8,true,图像生成"
          />

          <template #footer>
            <el-button @click="showBatchImport = false">取消</el-button>
            <el-button type="primary" :loading="batchImporting" @click="handleBatchImport">
              导入
            </el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane label="意图监控" name="dashboard">
        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
          <el-date-picker
            v-model="dashboardDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 280px;"
            @change="loadDashboardAll"
          />
          <el-select v-model="dashboardFilterAppCode" placeholder="应用" clearable style="width: 160px;" @change="loadDashboardAll">
            <el-option v-for="app in dashboardApps" :key="app.code" :label="app.name" :value="app.code" />
          </el-select>
          <el-button @click="loadDashboardAll">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-value">{{ dashboardOverview?.totalRequests || 0 }}</div>
              <div class="stat-label">总请求数</div>
            </div>
          </div>
          <div class="stat-card success">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <div class="stat-value">{{ (dashboardOverview?.successRate || 0).toFixed(1) }}%</div>
              <div class="stat-label">成功率</div>
            </div>
          </div>
          <div class="stat-card info">
            <div class="stat-icon">⚡</div>
            <div class="stat-content">
              <div class="stat-value">{{ dashboardOverview?.avgCostMs || 0 }}ms</div>
              <div class="stat-label">平均路由耗时</div>
            </div>
          </div>
          <div class="stat-card warning">
            <div class="stat-icon">⚠️</div>
            <div class="stat-content">
              <div class="stat-value">{{ (dashboardOverview?.degradeRate || 0).toFixed(1) }}%</div>
              <div class="stat-label">降级率</div>
            </div>
          </div>
        </div>

        <el-row :gutter="20" style="margin-bottom: 20px;">
          <el-col :span="12">
            <div class="card">
              <div class="card-title">
                <el-icon><PieChart /></el-icon>
                意图分布
              </div>
              <div v-if="dashboardOverview?.intentDistribution?.length" class="distribution-list">
                <div
                  v-for="item in dashboardOverview.intentDistribution"
                  :key="item.intent"
                  class="distribution-item"
                >
                  <div class="distribution-header">
                    <el-tag :type="getDashboardIntentTagType(item.intent)" size="small">{{ getDashboardIntentLabel(item.intent) }}</el-tag>
                    <span class="distribution-count">{{ item.count }} 次</span>
                  </div>
                  <el-progress
                    :percentage="item.percentage"
                    :color="getDashboardIntentColor(item.intent)"
                    :stroke-width="8"
                  />
                </div>
              </div>
              <el-empty v-else description="暂无数据" />
            </div>
          </el-col>

          <el-col :span="12">
            <div class="card">
              <div class="card-title">
                <el-icon><DataLine /></el-icon>
                模型使用排行
              </div>
              <el-table v-if="dashboardModelUsage.length" :data="dashboardModelUsage" stripe size="small">
                <el-table-column type="index" label="#" width="50" />
                <el-table-column prop="modelCode" label="模型" min-width="150">
                  <template #default="{ row }">
                    <el-tag type="info">{{ row.modelCode }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="count" label="调用次数" width="100" align="center" />
                <el-table-column label="占比" width="120">
                  <template #default="{ row }">
                    <el-progress :percentage="row.percentage" :stroke-width="6" />
                  </template>
                </el-table-column>
                <el-table-column label="成功率" width="90" align="center">
                  <template #default="{ row }">
                    <span :style="{ color: row.successRate >= 95 ? '#52c41a' : '#ff4d4f' }">
                      {{ row.successRate.toFixed(1) }}%
                    </span>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无数据" />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-bottom: 20px;">
          <el-col :span="12">
            <div class="card">
              <div class="card-title">
                <el-icon><TrendCharts /></el-icon>
                请求趋势
                <el-radio-group v-model="dashboardTrendGranularity" size="small" style="margin-left: auto;" @change="loadDashboardTrend">
                  <el-radio-button value="hour">按小时</el-radio-button>
                  <el-radio-button value="day">按天</el-radio-button>
                </el-radio-group>
              </div>
              <div v-if="dashboardTrendData.length" class="trend-chart">
                <div class="trend-bars">
                  <div
                    v-for="(item, index) in dashboardTrendData"
                    :key="index"
                    class="trend-bar-wrapper"
                  >
                    <div class="trend-bar-container">
                      <div
                        class="trend-bar success-bar"
                        :style="{ height: getDashboardBarHeight(item.successCount, dashboardMaxTrendValue) }"
                        :title="`成功: ${item.successCount}`"
                      />
                      <div
                        class="trend-bar fail-bar"
                        :style="{ height: getDashboardBarHeight(item.failCount, dashboardMaxTrendValue) }"
                        :title="`失败: ${item.failCount}`"
                      />
                    </div>
                    <div class="trend-label">{{ formatDashboardTrendLabel(item.time) }}</div>
                  </div>
                </div>
                <div class="trend-legend">
                  <span class="legend-item"><span class="legend-color success-color" /> 成功</span>
                  <span class="legend-item"><span class="legend-color fail-color" /> 失败</span>
                </div>
              </div>
              <el-empty v-else description="暂无趋势数据" />
            </div>
          </el-col>

          <el-col :span="12">
            <div class="card">
              <div class="card-title">
                <el-icon><WarningFilled /></el-icon>
                降级原因分布
              </div>
              <div v-if="dashboardDegradeStats.length" class="distribution-list">
                <div
                  v-for="item in dashboardDegradeStats"
                  :key="item.reason"
                  class="distribution-item"
                >
                  <div class="distribution-header">
                    <span class="degrade-reason">{{ item.reason }}</span>
                    <span class="distribution-count">{{ item.count }} 次</span>
                  </div>
                  <el-progress
                    :percentage="item.percentage"
                    color="#ff4d4f"
                    :stroke-width="8"
                  />
                </div>
              </div>
              <el-empty v-else description="暂无降级数据" />
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="意图缓存" name="cache">
        <div class="help-tip" style="margin-bottom: 20px;">
          <div class="help-tip-title">💡 缓存说明</div>
          <ul>
            <li><strong>缓存机制</strong>：对相同或相似的用户消息，缓存其意图识别结果，减少重复AI调用</li>
            <li><strong>缓存来源</strong>：keyword(关键词匹配)、ai(AI分类)、default(默认规则)</li>
            <li><strong>清除缓存</strong>：修改关键词规则后建议清除相关缓存，确保识别结果准确</li>
          </ul>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🗄️</div>
            <div class="stat-content">
              <div class="stat-value">{{ cacheStats?.total || 0 }}</div>
              <div class="stat-label">缓存总数</div>
            </div>
          </div>
          <div class="stat-card success" v-for="(count, intent) in cacheStats?.byIntent || {}" :key="intent">
            <div class="stat-icon">📌</div>
            <div class="stat-content">
              <div class="stat-value">{{ count }}</div>
              <div class="stat-label">{{ getCacheIntentLabel(intent) }}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            缓存列表
            <el-tag type="info" size="small">{{ cacheTotal }} 条</el-tag>
          </div>

          <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <el-select v-model="cacheFilterIntent" placeholder="意图类型" clearable style="width: 140px;" @change="loadCacheList">
              <el-option label="通用(general)" value="general" />
              <el-option label="代码(code)" value="code" />
              <el-option label="数学(math)" value="math" />
              <el-option label="创意(creative)" value="creative" />
              <el-option label="生图(image)" value="image" />
              <el-option label="语音合成(tts)" value="tts" />
              <el-option label="语音识别(asr)" value="asr" />
            </el-select>

            <el-select v-model="cacheFilterSource" placeholder="来源" clearable style="width: 140px;" @change="loadCacheList">
              <el-option label="关键词匹配" value="keyword" />
              <el-option label="AI分类" value="ai" />
              <el-option label="默认规则" value="default" />
            </el-select>

            <el-button type="danger" plain @click="handleClearCacheByFilter" :disabled="!cacheFilterIntent && !cacheFilterSource">
              <el-icon><Delete /></el-icon>
              按条件清除
            </el-button>

            <el-button type="danger" @click="handleClearAllCache">
              <el-icon><Delete /></el-icon>
              清除全部缓存
            </el-button>

            <el-button @click="loadCacheAll" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

          <el-table :data="cacheList" stripe v-loading="cacheLoading">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="intent" label="意图类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getCacheIntentTagType(row.intent)">{{ getCacheIntentLabel(row.intent) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="100">
              <template #default="{ row }">
                <el-tag :type="getCacheSourceTagType(row.source)">{{ getCacheSourceLabel(row.source) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="userMessage" label="用户消息" min-width="250" show-overflow-tooltip />
            <el-table-column prop="confidence" label="置信度" width="100" align="center">
              <template #default="{ row }">
                <el-progress :percentage="Math.round(row.confidence * 100)" :stroke-width="6" :show-text="true" />
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="170">
              <template #default="{ row }">
                {{ formatCacheTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="170">
              <template #default="{ row }">
                {{ formatCacheTime(row.updatedAt) }}
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
            <el-pagination
              v-model:current-page="cachePage"
              v-model:page-size="cachePageSize"
              :total="cacheTotal"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @change="loadCacheList"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="路由日志" name="routing-log">
        <div class="help-tip" style="margin-bottom: 20px;">
          <div class="help-tip-title">💡 日志说明</div>
          <ul>
            <li><strong>分类来源</strong>：specified(指定模型)、keyword(关键词匹配)、ai(AI分类)、default(默认规则)</li>
            <li><strong>降级</strong>：当指定模型不支持当前意图或所有模型不可用时，自动降级到备用方案</li>
            <li><strong>路由耗时</strong>：从开始路由到选定模型的耗时，不含实际模型调用时间</li>
          </ul>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📋</div>
            <div class="stat-content">
              <div class="stat-value">{{ routingLogStats?.total || 0 }}</div>
              <div class="stat-label">日志总数</div>
            </div>
          </div>
          <div class="stat-card success">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <div class="stat-value">{{ (routingLogStats?.successRate || 0).toFixed(1) }}%</div>
              <div class="stat-label">成功率</div>
            </div>
          </div>
          <div class="stat-card info">
            <div class="stat-icon">⚡</div>
            <div class="stat-content">
              <div class="stat-value">{{ routingLogStats?.avgCostMs || 0 }}ms</div>
              <div class="stat-label">平均耗时</div>
            </div>
          </div>
          <div class="stat-card warning">
            <div class="stat-icon">⚠️</div>
            <div class="stat-content">
              <div class="stat-value">{{ (routingLogStats?.degradeRate || 0).toFixed(1) }}%</div>
              <div class="stat-label">降级率</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            日志列表
            <el-tag type="info" size="small">{{ routingLogTotal }} 条</el-tag>
          </div>

          <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <el-select v-model="routingLogFilterIntent" placeholder="意图类型" clearable style="width: 140px;" @change="loadRoutingLogList">
              <el-option label="通用(general)" value="general" />
              <el-option label="代码(code)" value="code" />
              <el-option label="数学(math)" value="math" />
              <el-option label="创意(creative)" value="creative" />
              <el-option label="生图(image)" value="image" />
              <el-option label="语音合成(tts)" value="tts" />
              <el-option label="语音识别(asr)" value="asr" />
            </el-select>

            <el-select v-model="routingLogFilterSource" placeholder="分类来源" clearable style="width: 130px;" @change="loadRoutingLogList">
              <el-option label="指定模型" value="specified" />
              <el-option label="关键词匹配" value="keyword" />
              <el-option label="AI分类" value="ai" />
              <el-option label="默认规则" value="default" />
            </el-select>

            <el-select v-model="routingLogFilterModelType" placeholder="模型类型" clearable style="width: 130px;" @change="loadRoutingLogList">
              <el-option label="LLM" value="llm" />
              <el-option label="TTS" value="tts" />
              <el-option label="ASR" value="asr" />
              <el-option label="Image" value="image" />
            </el-select>

            <el-select v-model="routingLogFilterSuccess" placeholder="是否成功" clearable style="width: 120px;" @change="loadRoutingLogList">
              <el-option label="成功" :value="true" />
              <el-option label="失败" :value="false" />
            </el-select>

            <el-select v-model="routingLogFilterDegraded" placeholder="是否降级" clearable style="width: 120px;" @change="loadRoutingLogList">
              <el-option label="已降级" :value="true" />
              <el-option label="未降级" :value="false" />
            </el-select>

            <el-date-picker
              v-model="routingLogFilterDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 260px;"
              @change="loadRoutingLogList"
            />

            <el-button @click="loadRoutingLogAll" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

          <el-table :data="routingLogList" stripe v-loading="routingLogLoading">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="detectedIntent" label="意图" width="100">
              <template #default="{ row }">
                <el-tag :type="getRoutingLogIntentTagType(row.detectedIntent)" size="small">
                  {{ getRoutingLogIntentLabel(row.detectedIntent) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="90">
              <template #default="{ row }">
                <el-tag :type="getRoutingLogSourceTagType(row.source)" size="small">
                  {{ getRoutingLogSourceLabel(row.source) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="selectedModelCode" label="选中模型" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.selectedModelCode" type="info">{{ row.selectedModelCode }}</el-tag>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="modelType" label="模型类型" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.modelType" size="small">{{ row.modelType }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="confidence" label="置信度" width="90" align="center">
              <template #default="{ row }">
                {{ (row.confidence * 100).toFixed(0) }}%
              </template>
            </el-table-column>
            <el-table-column prop="isDegraded" label="降级" width="80" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.isDegraded" type="warning" size="small">是</el-tag>
                <el-tag v-else type="success" size="small">否</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="success" label="结果" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                  {{ row.success ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="costMs" label="耗时" width="80" align="center">
              <template #default="{ row }">
                {{ row.costMs }}ms
              </template>
            </el-table-column>
            <el-table-column prop="appCode" label="应用" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.appCode" size="small" type="info">{{ row.appCode }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" width="170">
              <template #default="{ row }">
                {{ formatRoutingLogTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="right" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="handleViewRoutingLogDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
            <el-pagination
              v-model:current-page="routingLogPage"
              v-model:page-size="routingLogPageSize"
              :total="routingLogTotal"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @change="loadRoutingLogList"
            />
          </div>
        </div>

        <el-dialog v-model="routingLogDetailVisible" title="路由日志详情" width="650px">
          <el-descriptions v-if="routingLogCurrent" :column="2" border>
            <el-descriptions-item label="ID">{{ routingLogCurrent.id }}</el-descriptions-item>
            <el-descriptions-item label="时间">{{ formatRoutingLogTime(routingLogCurrent.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="检测意图">
              <el-tag :type="getRoutingLogIntentTagType(routingLogCurrent.detectedIntent)">
                {{ getRoutingLogIntentLabel(routingLogCurrent.detectedIntent) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="置信度">{{ (routingLogCurrent.confidence * 100).toFixed(0) }}%</el-descriptions-item>
            <el-descriptions-item label="分类来源">
              <el-tag :type="getRoutingLogSourceTagType(routingLogCurrent.source)">{{ getRoutingLogSourceLabel(routingLogCurrent.source) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="模型类型">{{ routingLogCurrent.modelType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="选中模型">{{ routingLogCurrent.selectedModelCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="路由耗时">{{ routingLogCurrent.costMs }}ms</el-descriptions-item>
            <el-descriptions-item label="是否降级">
              <el-tag :type="routingLogCurrent.isDegraded ? 'warning' : 'success'">
                {{ routingLogCurrent.isDegraded ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="路由结果">
              <el-tag :type="routingLogCurrent.success ? 'success' : 'danger'">
                {{ routingLogCurrent.success ? '成功' : '失败' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="routingLogCurrent.degradeReason" label="降级原因" :span="2">
              {{ routingLogCurrent.degradeReason }}
            </el-descriptions-item>
            <el-descriptions-item v-if="routingLogCurrent.errorMessage" label="错误信息" :span="2">
              <span style="color: #ff4d4f;">{{ routingLogCurrent.errorMessage }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="routingLogCurrent.userMessage" label="用户消息" :span="2">
              {{ routingLogCurrent.userMessage }}
            </el-descriptions-item>
            <el-descriptions-item v-if="routingLogCurrent.appCode" label="应用">{{ routingLogCurrent.appCode }}</el-descriptions-item>
            <el-descriptions-item v-if="routingLogCurrent.clientIp" label="客户端IP">{{ routingLogCurrent.clientIp }}</el-descriptions-item>
            <el-descriptions-item v-if="routingLogCurrent.uid" label="用户ID">{{ routingLogCurrent.uid }}</el-descriptions-item>
          </el-descriptions>
        </el-dialog>
      </el-tab-pane>
    </el-tabs>


    <el-dialog v-model="dialogVisible" :title="editingStrategy ? '编辑策略' : '新建策略'" width="700px" @close="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="140px">
        <el-form-item label="模型类型" prop="modelType">
          <el-input v-model="form.modelType" placeholder="请输入模型类型，如：gpt-4, claude-3" :disabled="!!editingStrategy" />
        </el-form-item>

        <el-form-item label="调度策略" prop="strategy">
          <el-select v-model="form.strategy" placeholder="请选择调度策略" style="width: 100%">
            <el-option label="权重调度" value="weight" />
            <el-option label="随机调度" value="random" />
            <el-option label="轮询调度" value="round_robin" />
            <el-option label="故障转移" value="failover" />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">重试配置</el-divider>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="重试次数" prop="retryCount">
              <el-input-number v-model="form.retryCount" :min="0" :max="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="超时时间(ms)" prop="timeout">
              <el-input-number v-model="form.timeout" :min="1000" :max="300000" :step="1000" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">熔断配置</el-divider>

        <el-form-item label="启用熔断">
          <el-switch v-model="form.enableCircuit" />
          <el-text size="small" type="info" style="margin-left: 10px">
            当错误次数达到阈值时自动熔断
          </el-text>
        </el-form-item>

        <template v-if="form.enableCircuit">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="错误阈值" prop="circuitThreshold">
                <el-input-number v-model="form.circuitThreshold" :min="1" :max="100" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="恢复时间(ms)" prop="circuitTimeout">
                <el-input-number v-model="form.circuitTimeout" :min="10000" :max="600000" :step="10000"
                  style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <el-divider content-position="left">降级配置</el-divider>

        <el-form-item label="降级模型ID">
          <el-input v-model="form.fallbackModelId" placeholder="可选：当主模型不可用时切换到此模型" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Upload, Search, Refresh, PieChart, DataLine, TrendCharts, WarningFilled, Delete } from '@element-plus/icons-vue'
import { mcpApi, type McpStrategy, type McpStrategyForm } from '@/api/mcp'
import { intentKeywordApi, type IntentKeyword, type IntentKeywordForm } from '@/api/intent-keyword'
import {
  intentDashboardApi,
  type DashboardOverview,
  type TrendPoint,
  type ModelUsageRank,
  type DegradeStat
} from '@/api/intent-dashboard'
import { appApi } from '@/api/app'
import { intentCacheApi, type IntentCacheItem, type CacheStats } from '@/api/intent-cache'
import {
  intentRoutingLogApi,
  type IntentRoutingLog,
  type RoutingLogStats
} from '@/api/intent-routing-log'

const activeTab = ref('status')
const statusLoading = ref(false)
const strategyLoading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const modelStatus = ref<any[]>([])
const strategies = ref<McpStrategy[]>([])
const editingStrategy = ref<McpStrategy | null>(null)
const formRef = ref<FormInstance>()

const form = reactive<McpStrategyForm>({
  modelType: '',
  strategy: 'weight',
  retryCount: 3,
  timeout: 30000,
  fallbackModelId: '',
  enableCircuit: true,
  circuitThreshold: 5,
  circuitTimeout: 300000
})

const rules: FormRules = {
  modelType: [
    { required: true, message: '请输入模型类型', trigger: 'blur' }
  ],
  strategy: [
    { required: true, message: '请选择调度策略', trigger: 'change' }
  ],
  retryCount: [
    { required: true, message: '请输入重试次数', trigger: 'blur' }
  ],
  timeout: [
    { required: true, message: '请输入超时时间', trigger: 'blur' }
  ]
}

const getCircuitTagType = (status: string) => {
  const map: Record<string, any> = {
    'closed': 'success',
    'open': 'danger',
    'half_open': 'warning'
  }
  return map[status] || 'info'
}

const getCircuitStatusText = (status: string) => {
  const map: Record<string, string> = {
    'closed': '正常',
    'open': '熔断',
    'half_open': '恢复中'
  }
  return map[status] || status
}

const getStrategyLabel = (strategy: string) => {
  const map: Record<string, string> = {
    weight: '权重',
    random: '随机',
    round_robin: '轮询',
    failover: '故障转移'
  }
  return map[strategy] || strategy
}

const getStrategyType = (strategy: string) => {
  const map: Record<string, any> = {
    weight: 'primary',
    random: 'success',
    round_robin: 'warning',
    failover: 'danger'
  }
  return map[strategy] || ''
}

const loadModelStatus = async () => {
  statusLoading.value = true
  try {
    const { data } = await mcpApi.getStatus()
    modelStatus.value = data.data || []
  } catch (error) {
    console.error('加载模型状态失败', error)
    ElMessage.error('加载模型状态失败')
  } finally {
    statusLoading.value = false
  }
}

const handleResetCircuit = async (modelId: string) => {
  try {
    await mcpApi.resetCircuit(modelId)
    ElMessage.success('熔断状态已重置')
    loadModelStatus()
  } catch (error) {
    console.error('重置熔断失败', error)
    ElMessage.error('重置熔断失败')
  }
}

const loadStrategies = async () => {
  strategyLoading.value = true
  try {
    const { data } = await mcpApi.getStrategies()
    strategies.value = data.data || []
  } catch (error) {
    console.error('加载策略列表失败', error)
    ElMessage.error('加载策略列表失败')
  } finally {
    strategyLoading.value = false
  }
}

const handleAddStrategy = () => {
  editingStrategy.value = null
  resetForm()
  dialogVisible.value = true
}

const handleEditStrategy = (row: McpStrategy) => {
  editingStrategy.value = row
  Object.assign(form, {
    modelType: row.modelType,
    strategy: row.strategy,
    retryCount: row.retryCount,
    timeout: row.timeout,
    fallbackModelId: row.fallbackModelId || '',
    enableCircuit: row.enableCircuit,
    circuitThreshold: row.circuitThreshold,
    circuitTimeout: row.circuitTimeout
  })
  dialogVisible.value = true
}

const handleDeleteStrategy = async (_modelType: string) => {
  try {
    await ElMessageBox.confirm('确定要删除该策略吗？', '提示', {
      type: 'warning'
    })
    ElMessage.success('删除成功')
    loadStrategies()
  } catch (error) {
    console.error('删除失败', error)
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      if (editingStrategy.value) {
        await mcpApi.updateStrategy(editingStrategy.value.modelType, form)
        ElMessage.success('更新成功')
      } else {
        await mcpApi.createStrategy(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      loadStrategies()
    } catch (error) {
      console.error('提交失败', error)
      ElMessage.error('操作失败')
    } finally {
      submitting.value = false
    }
  })
}

const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(form, {
    modelType: '',
    strategy: 'weight',
    retryCount: 3,
    timeout: 30000,
    fallbackModelId: '',
    enableCircuit: true,
    circuitThreshold: 5,
    circuitTimeout: 300000
  })
}

// ========== 意图关键词管理 ==========

const keywordList = ref<IntentKeyword[]>([])
const keywordTotal = ref(0)
const keywordPage = ref(1)
const keywordPageSize = ref(20)
const keywordLoading = ref(false)
const keywordSubmitting = ref(false)
const keywordDialogVisible = ref(false)
const editingKeyword = ref(false)
const editingKeywordId = ref<number | null>(null)

const keywordFilterIntent = ref<string>()
const keywordFilterStatus = ref<boolean>()
const keywordFilterText = ref<string>()

const showBatchImport = ref(false)
const batchText = ref('')
const batchImporting = ref(false)

const keywordForm = reactive<IntentKeywordForm>({
  intent: 'general',
  keyword: '',
  weight: 1,
  isRegex: false,
  description: ''
})

/**
 * 关键词意图标签类型
 */
const getKeywordIntentTagType = (intent: string): string => {
  const map: Record<string, string> = {
    general: '',
    code: 'success',
    math: 'warning',
    creative: 'danger',
    image: 'info',
    tts: '',
    asr: 'warning'
  }
  return map[intent] || ''
}

/**
 * 关键词意图标签文本
 */
const getKeywordIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: '通用',
    code: '代码',
    math: '数学',
    creative: '创意',
    image: '生图',
    tts: '语音合成',
    asr: '语音识别'
  }
  return map[intent] || intent
}

/**
 * 格式化关键词时间
 */
const formatKeywordTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

/**
 * 加载关键词列表
 */
const loadKeywords = async () => {
  keywordLoading.value = true
  try {
    const res = await intentKeywordApi.getList({
      intent: keywordFilterIntent.value,
      status: keywordFilterStatus.value,
      keyword: keywordFilterText.value || undefined,
      page: keywordPage.value,
      pageSize: keywordPageSize.value
    })
    keywordList.value = res.data.data?.list || []
    keywordTotal.value = res.data.data?.total || 0
  } catch {
    ElMessage.error('加载关键词列表失败')
  } finally {
    keywordLoading.value = false
  }
}

/**
 * 添加关键词
 */
const handleAddKeyword = () => {
  editingKeyword.value = false
  editingKeywordId.value = null
  keywordForm.intent = 'general'
  keywordForm.keyword = ''
  keywordForm.weight = 1
  keywordForm.isRegex = false
  keywordForm.description = ''
  keywordDialogVisible.value = true
}

/**
 * 编辑关键词
 */
const handleEditKeyword = (row: IntentKeyword) => {
  editingKeyword.value = true
  editingKeywordId.value = row.id
  keywordForm.intent = row.intent
  keywordForm.keyword = row.keyword
  keywordForm.weight = row.weight
  keywordForm.isRegex = row.isRegex
  keywordForm.description = row.description || ''
  keywordDialogVisible.value = true
}

/**
 * 提交关键词表单
 */
const handleSubmitKeyword = async () => {
  if (!keywordForm.intent || !keywordForm.keyword) {
    ElMessage.warning('请填写意图类型和关键词')
    return
  }

  keywordSubmitting.value = true
  try {
    if (editingKeyword.value && editingKeywordId.value) {
      await intentKeywordApi.update(editingKeywordId.value, keywordForm)
      ElMessage.success('关键词更新成功')
    } else {
      await intentKeywordApi.create(keywordForm)
      ElMessage.success('关键词创建成功')
    }
    keywordDialogVisible.value = false
    await loadKeywords()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    keywordSubmitting.value = false
  }
}

/**
 * 删除关键词
 */
const handleDeleteKeyword = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除该关键词吗？', '确认删除', {
      type: 'warning'
    })
    await intentKeywordApi.delete(id)
    ElMessage.success('关键词已删除')
    await loadKeywords()
  } catch {
    // 取消删除
  }
}

/**
 * 切换关键词状态
 */
const handleToggleKeywordStatus = async (id: number, status: boolean) => {
  try {
    await intentKeywordApi.toggleStatus(id, status)
    ElMessage.success(status ? '关键词已启用' : '关键词已禁用')
    await loadKeywords()
  } catch {
    ElMessage.error('状态切换失败')
  }
}

/**
 * 批量导入关键词
 */
const handleBatchImport = async () => {
  if (!batchText.value.trim()) {
    ElMessage.warning('请输入导入数据')
    return
  }

  const lines = batchText.value.trim().split('\n').filter(line => line.trim())
  const keywords: IntentKeywordForm[] = []

  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim())
    if (parts.length < 2) continue

    keywords.push({
      intent: parts[0],
      keyword: parts[1],
      weight: parts[2] ? parseInt(parts[2]) : 1,
      isRegex: parts[3] === 'true',
      description: parts[4] || undefined
    })
  }

  if (keywords.length === 0) {
    ElMessage.warning('没有有效的导入数据')
    return
  }

  batchImporting.value = true
  try {
    const res = await intentKeywordApi.batchImport({ keywords })
    const result = res.data.data
    ElMessage.success(`导入完成：新增 ${result?.created || 0} 条，跳过 ${result?.skipped || 0} 条`)
    showBatchImport.value = false
    batchText.value = ''
    await loadKeywords()
  } catch {
    ElMessage.error('批量导入失败')
  } finally {
    batchImporting.value = false
  }
}

// ========== 意图监控看板 ==========

const dashboardDateRange = ref<[string, string] | null>(null)
const dashboardFilterAppCode = ref<string>()
const dashboardApps = ref<Array<{ code: string; name: string }>>([])

const dashboardOverview = ref<DashboardOverview | null>(null)
const dashboardTrendData = ref<TrendPoint[]>([])
const dashboardTrendGranularity = ref<'hour' | 'day'>('hour')
const dashboardModelUsage = ref<ModelUsageRank[]>([])
const dashboardDegradeStats = ref<DegradeStat[]>([])

/**
 * 看板最大趋势值
 */
const dashboardMaxTrendValue = computed(() => {
  if (!dashboardTrendData.value.length) return 1
  return Math.max(...dashboardTrendData.value.map(d => d.count), 1)
})

/**
 * 看板意图标签类型
 */
const getDashboardIntentTagType = (intent: string): string => {
  const map: Record<string, string> = {
    general: '',
    code: 'success',
    math: 'warning',
    creative: 'danger',
    image: 'info',
    tts: '',
    asr: 'warning'
  }
  return map[intent] || ''
}

/**
 * 看板意图标签文本
 */
const getDashboardIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: '通用',
    code: '代码',
    math: '数学',
    creative: '创意',
    image: '生图',
    tts: '语音合成',
    asr: '语音识别'
  }
  return map[intent] || intent
}

/**
 * 看板意图颜色
 */
const getDashboardIntentColor = (intent: string): string => {
  const map: Record<string, string> = {
    general: '#1890ff',
    code: '#52c41a',
    math: '#faad14',
    creative: '#ff4d4f',
    image: '#722ed1',
    tts: '#13c2c2',
    asr: '#eb2f96'
  }
  return map[intent] || '#1890ff'
}

/**
 * 看板柱状图高度
 */
const getDashboardBarHeight = (value: number, max: number): string => {
  if (max === 0) return '0%'
  return `${(value / max) * 100}%`
}

/**
 * 格式化看板趋势标签
 */
const formatDashboardTrendLabel = (time: string): string => {
  if (dashboardTrendGranularity.value === 'hour') {
    return time.slice(-5)
  }
  return time.slice(5)
}

/**
 * 加载看板应用列表
 */
const loadDashboardApps = async () => {
  try {
    const res = await appApi.getList()
    dashboardApps.value = res.data.data?.list || []
  } catch {
    // 忽略
  }
}

/**
 * 加载看板概览
 */
const loadDashboardOverview = async () => {
  try {
    const res = await intentDashboardApi.getOverview({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1],
      appCode: dashboardFilterAppCode.value
    })
    dashboardOverview.value = res.data.data || null
  } catch {
    ElMessage.error('加载概览数据失败')
  }
}

/**
 * 加载看板趋势
 */
const loadDashboardTrend = async () => {
  try {
    const res = await intentDashboardApi.getTrend({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1],
      granularity: dashboardTrendGranularity.value
    })
    dashboardTrendData.value = res.data.data || []
  } catch {
    ElMessage.error('加载趋势数据失败')
  }
}

/**
 * 加载看板模型使用排行
 */
const loadDashboardModelUsage = async () => {
  try {
    const res = await intentDashboardApi.getModelUsage({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1]
    })
    dashboardModelUsage.value = res.data.data || []
  } catch {
    ElMessage.error('加载模型使用数据失败')
  }
}

/**
 * 加载看板降级统计
 */
const loadDashboardDegradeStats = async () => {
  try {
    const res = await intentDashboardApi.getDegradeStats({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1]
    })
    dashboardDegradeStats.value = res.data.data || []
  } catch {
    ElMessage.error('加载降级统计数据失败')
  }
}

/**
 * 加载看板所有数据
 */
const loadDashboardAll = () => {
  loadDashboardOverview()
  loadDashboardTrend()
  loadDashboardModelUsage()
  loadDashboardDegradeStats()
}

// ========== 意图缓存管理 ==========

const cacheList = ref<IntentCacheItem[]>([])
const cacheTotal = ref(0)
const cachePage = ref(1)
const cachePageSize = ref(20)
const cacheLoading = ref(false)
const cacheStats = ref<CacheStats | null>(null)

const cacheFilterIntent = ref<string>()
const cacheFilterSource = ref<string>()

/**
 * 缓存意图标签类型
 */
const getCacheIntentTagType = (intent: string): string => {
  const map: Record<string, string> = {
    general: '',
    code: 'success',
    math: 'warning',
    creative: 'danger',
    image: 'info',
    tts: '',
    asr: 'warning'
  }
  return map[intent] || ''
}

/**
 * 缓存意图标签文本
 */
const getCacheIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: '通用',
    code: '代码',
    math: '数学',
    creative: '创意',
    image: '生图',
    tts: '语音合成',
    asr: '语音识别'
  }
  return map[intent] || intent
}

/**
 * 缓存来源标签类型
 */
const getCacheSourceTagType = (source: string): string => {
  const map: Record<string, string> = {
    keyword: 'success',
    ai: 'warning',
    default: 'info'
  }
  return map[source] || ''
}

/**
 * 缓存来源标签文本
 */
const getCacheSourceLabel = (source: string): string => {
  const map: Record<string, string> = {
    keyword: '关键词',
    ai: 'AI分类',
    default: '默认'
  }
  return map[source] || source
}

/**
 * 格式化缓存时间
 */
const formatCacheTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

/**
 * 加载缓存列表
 */
const loadCacheList = async () => {
  cacheLoading.value = true
  try {
    const res = await intentCacheApi.getList({
      intent: cacheFilterIntent.value,
      source: cacheFilterSource.value,
      page: cachePage.value,
      pageSize: cachePageSize.value
    })
    cacheList.value = res.data.data?.list || []
    cacheTotal.value = res.data.data?.total || 0
  } catch {
    ElMessage.error('加载缓存列表失败')
  } finally {
    cacheLoading.value = false
  }
}

/**
 * 加载缓存统计
 */
const loadCacheStats = async () => {
  try {
    const res = await intentCacheApi.getStats()
    cacheStats.value = res.data.data || null
  } catch {
    // 忽略
  }
}

/**
 * 按条件清除缓存
 */
const handleClearCacheByFilter = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清除 ${cacheFilterIntent.value ? getCacheIntentLabel(cacheFilterIntent.value) + ' ' : ''}${cacheFilterSource.value ? getCacheSourceLabel(cacheFilterSource.value) + ' ' : ''}缓存吗？`,
      '确认清除',
      { type: 'warning' }
    )
    const res = await intentCacheApi.clear({
      intent: cacheFilterIntent.value,
      source: cacheFilterSource.value
    })
    ElMessage.success(`已清除 ${res.data.data?.cleared || 0} 条缓存`)
    await loadCacheAll()
  } catch {
    // 取消
  }
}

/**
 * 清除全部缓存
 */
const handleClearAllCache = async () => {
  try {
    await ElMessageBox.confirm('确定要清除所有意图缓存吗？此操作不可恢复。', '确认清除全部', {
      type: 'warning',
      confirmButtonText: '确定清除',
      confirmButtonClass: 'el-button--danger'
    })
    const res = await intentCacheApi.clearAll()
    ElMessage.success(`已清除 ${res.data.data?.cleared || 0} 条缓存`)
    await loadCacheAll()
  } catch {
    // 取消
  }
}

/**
 * 加载缓存所有数据
 */
const loadCacheAll = () => {
  loadCacheList()
  loadCacheStats()
}

// ========== 路由调度日志 ==========

const routingLogList = ref<IntentRoutingLog[]>([])
const routingLogTotal = ref(0)
const routingLogPage = ref(1)
const routingLogPageSize = ref(20)
const routingLogLoading = ref(false)
const routingLogStats = ref<RoutingLogStats | null>(null)

const routingLogFilterIntent = ref<string>()
const routingLogFilterSource = ref<string>()
const routingLogFilterModelType = ref<string>()
const routingLogFilterSuccess = ref<boolean>()
const routingLogFilterDegraded = ref<boolean>()
const routingLogFilterDateRange = ref<[string, string] | null>(null)

const routingLogDetailVisible = ref(false)
const routingLogCurrent = ref<IntentRoutingLog | null>(null)

/**
 * 路由日志意图标签类型
 */
const getRoutingLogIntentTagType = (intent: string): string => {
  const map: Record<string, string> = {
    general: '',
    code: 'success',
    math: 'warning',
    creative: 'danger',
    image: 'info',
    tts: '',
    asr: 'warning'
  }
  return map[intent] || ''
}

/**
 * 路由日志意图标签文本
 */
const getRoutingLogIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: '通用',
    code: '代码',
    math: '数学',
    creative: '创意',
    image: '生图',
    tts: '语音合成',
    asr: '语音识别'
  }
  return map[intent] || intent
}

/**
 * 路由日志来源标签类型
 */
const getRoutingLogSourceTagType = (source: string): string => {
  const map: Record<string, string> = {
    specified: '',
    keyword: 'success',
    ai: 'warning',
    default: 'info'
  }
  return map[source] || ''
}

/**
 * 路由日志来源标签文本
 */
const getRoutingLogSourceLabel = (source: string): string => {
  const map: Record<string, string> = {
    specified: '指定模型',
    keyword: '关键词',
    ai: 'AI分类',
    default: '默认'
  }
  return map[source] || source
}

/**
 * 格式化路由日志时间
 */
const formatRoutingLogTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

/**
 * 加载路由日志列表
 */
const loadRoutingLogList = async () => {
  routingLogLoading.value = true
  try {
    const res = await intentRoutingLogApi.getList({
      intent: routingLogFilterIntent.value,
      source: routingLogFilterSource.value,
      modelType: routingLogFilterModelType.value,
      success: routingLogFilterSuccess.value,
      isDegraded: routingLogFilterDegraded.value,
      startDate: routingLogFilterDateRange.value?.[0],
      endDate: routingLogFilterDateRange.value?.[1],
      page: routingLogPage.value,
      pageSize: routingLogPageSize.value
    })
    routingLogList.value = res.data.data?.list || []
    routingLogTotal.value = res.data.data?.total || 0
  } catch {
    ElMessage.error('加载日志列表失败')
  } finally {
    routingLogLoading.value = false
  }
}

/**
 * 加载路由日志统计
 */
const loadRoutingLogStats = async () => {
  try {
    const res = await intentRoutingLogApi.getStats({
      startDate: routingLogFilterDateRange.value?.[0],
      endDate: routingLogFilterDateRange.value?.[1]
    })
    routingLogStats.value = res.data.data || null
  } catch {
    // 忽略
  }
}

/**
 * 查看路由日志详情
 */
const handleViewRoutingLogDetail = (row: IntentRoutingLog) => {
  routingLogCurrent.value = row
  routingLogDetailVisible.value = true
}

/**
 * 加载路由日志所有数据
 */
const loadRoutingLogAll = () => {
  loadRoutingLogList()
  loadRoutingLogStats()
}

onMounted(() => {
  loadModelStatus()
  loadStrategies()
  loadKeywords()
  loadDashboardApps()
  loadDashboardAll()
  loadCacheAll()
  loadRoutingLogAll()
})
</script>

<style scoped lang="scss">
.distribution-list {
  .distribution-item {
    margin-bottom: 16px;

    .distribution-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;

      .distribution-count {
        font-size: 13px;
        color: #666;
      }
    }

    .degrade-reason {
      font-size: 13px;
      color: #333;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.trend-chart {
  .trend-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 200px;
    padding: 0 8px;

    .trend-bar-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;

      .trend-bar-container {
        flex: 1;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 1px;

        .trend-bar {
          width: 100%;
          border-radius: 2px 2px 0 0;
          min-height: 2px;
          transition: height 0.3s;

          &.success-bar {
            background: #52c41a;
          }

          &.fail-bar {
            background: #ff4d4f;
          }
        }
      }

      .trend-label {
        font-size: 10px;
        color: #999;
        margin-top: 4px;
        writing-mode: vertical-lr;
        text-orientation: mixed;
      }
    }
  }

  .trend-legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 12px;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #666;

      .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;

        &.success-color {
          background: #52c41a;
        }

        &.fail-color {
          background: #ff4d4f;
        }
      }
    }
  }
}
</style>
