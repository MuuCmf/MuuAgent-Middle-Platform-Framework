<template>
  <div class="mcp-page">
    <div class="page-header">
      <h2>MCP 调度管理</h2>
      <p class="page-desc">管理模型调度策略、监控模型状态、配置意图识别规则</p>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="模型状态监控" name="status">
        <ModelStatus />
      </el-tab-pane>

      <el-tab-pane label="策略配置" name="strategy">
        <StrategyConfig />
      </el-tab-pane>

      <el-tab-pane label="意图关键词" name="keyword">
        <IntentKeyword />
      </el-tab-pane>

      <el-tab-pane label="意图监控" name="dashboard">
        <IntentDashboard />
      </el-tab-pane>

      <el-tab-pane label="意图缓存" name="cache">
        <IntentCache />
      </el-tab-pane>

      <el-tab-pane label="路由日志" name="routing-log">
        <RoutingLog />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ModelStatus from './components/ModelStatus.vue'
import StrategyConfig from './components/StrategyConfig.vue'
import IntentKeyword from './components/IntentKeyword.vue'
import IntentDashboard from './components/IntentDashboard.vue'
import IntentCache from './components/IntentCache.vue'
import RoutingLog from './components/RoutingLog.vue'

const activeTab = ref('status')
</script>

<style scoped lang="scss">
.mcp-page {
  .page-header {
    margin-bottom: 20px;

    h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }

    .page-desc {
      margin: 0;
      font-size: 14px;
      color: #909399;
    }
  }
}
</style>