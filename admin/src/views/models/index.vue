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