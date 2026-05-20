<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('model.configCenter') }}</h1>
      <p class="page-description">{{ $t('model.configCenterDesc') }}</p>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane :label="$t('model.modelManagement')" name="models">
        <ModelList />
      </el-tab-pane>

      <el-tab-pane :label="$t('model.paramTemplate')" name="templates">
        <TemplateList />
      </el-tab-pane>

      <el-tab-pane :label="$t('model.strategyConfig')" name="strategy">
        <StrategyConfig />
      </el-tab-pane>

      <el-tab-pane :label="$t('model.modelStatus')" name="status">
        <ModelStatus />
      </el-tab-pane>

      <el-tab-pane :label="$t('model.intentKeyword')" name="keyword">
        <IntentKeyword />
      </el-tab-pane>

      <el-tab-pane :label="$t('model.intentDashboard')" name="dashboard">
        <IntentDashboard />
      </el-tab-pane>

      <el-tab-pane :label="$t('model.intentCache')" name="cache">
        <IntentCache />
      </el-tab-pane>

      <el-tab-pane :label="$t('model.routingLog')" name="routing-log">
        <RoutingLog />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ModelList from './components/ModelList.vue'
import TemplateList from './components/TemplateList.vue'
import StrategyConfig from './components/StrategyConfig.vue'
import ModelStatus from './components/ModelStatus.vue'
import IntentKeyword from './components/IntentKeyword.vue'
import IntentDashboard from './components/IntentDashboard.vue'
import IntentCache from './components/IntentCache.vue'
import RoutingLog from './components/RoutingLog.vue'

const activeTab = ref('models')
</script>

<style lang="scss" scoped>
</style>
