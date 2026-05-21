<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('log.title') }}</h1>
      <p class="page-description">{{ t('log.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">{{ t('log.helpTip.title') }}</div>
      <p>{{ t('log.helpTip.content') }}</p>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <div class="card">
        <el-tab-pane :label="t('log.tabs.ai')" name="ai">
          <AiLogTab />
        </el-tab-pane>

        <el-tab-pane :label="t('log.tabs.agent')" name="agent">
          <AgentLogTab />
        </el-tab-pane>

        <el-tab-pane :label="t('log.tabs.skill')" name="skill">
          <SkillLogTab />
        </el-tab-pane>

        <el-tab-pane :label="t('log.tabs.retrieval')" name="retrieval">
          <RetrievalLogTab />
        </el-tab-pane>
      </div>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AiLogTab from './components/AiLogTab.vue'
import AgentLogTab from './components/AgentLogTab.vue'
import SkillLogTab from './components/SkillLogTab.vue'
import RetrievalLogTab from './components/RetrievalLogTab.vue'

const { t } = useI18n()

const activeTab = ref('ai')

/**
 * 处理标签页切换
 */
const handleTabChange = () => {
}
</script>

<style lang="scss" scoped>

</style>
