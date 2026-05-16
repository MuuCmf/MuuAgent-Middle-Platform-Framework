<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">模型配置中心</h1>
      <p class="page-description">统一管理AI模型配置和参数模板，实现模型资源的标准化和规范化管理</p>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="模型管理" name="models">
        <ModelList />
      </el-tab-pane>

      <el-tab-pane label="参数模板" name="templates">
        <TemplateList />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ModelList from './components/ModelList.vue'
import TemplateList from './components/TemplateList.vue'

const activeTab = ref('models')
</script>

<style lang="scss" scoped>
</style>