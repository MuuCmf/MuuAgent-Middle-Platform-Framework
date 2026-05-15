<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">调用日志</h1>
      <p class="page-description">记录所有AI模型调用、技能执行、智能体对话的历史记录</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 调用日志说明</div>
      <p>记录所有AI模型调用、技能执行、智能体对话的历史记录，可用于问题排查和性能分析。</p>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <div class="card">
        <el-tab-pane label="模型调用日志" name="ai">
          <AiLogTab />
        </el-tab-pane>

        <el-tab-pane label="Agent调用日志" name="agent">
          <AgentLogTab />
        </el-tab-pane>

        <el-tab-pane label="Skill调用日志" name="skill">
          <SkillLogTab />
        </el-tab-pane>

        <el-tab-pane label="知识库检索日志" name="retrieval">
          <RetrievalLogTab />
        </el-tab-pane>
      </div>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AiLogTab from './components/AiLogTab.vue'
import AgentLogTab from './components/AgentLogTab.vue'
import SkillLogTab from './components/SkillLogTab.vue'
import RetrievalLogTab from './components/RetrievalLogTab.vue'

const activeTab = ref('ai')

/**
 * 处理标签页切换
 */
const handleTabChange = () => {
}
</script>

<style lang="scss" scoped>

</style>
