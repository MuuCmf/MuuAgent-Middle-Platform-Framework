<template>
  <router-view />
  <ApiKeyDialog ref="apiKeyDialogRef" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import { hasCredentials } from './utils/auth'

/**
 * API Key 配置弹窗引用
 */
const apiKeyDialogRef = ref<InstanceType<typeof ApiKeyDialog>>()

onMounted(() => {
  if (!hasCredentials()) {
    apiKeyDialogRef.value?.open()
  }
})
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
