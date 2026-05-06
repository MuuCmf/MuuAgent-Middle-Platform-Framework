<template>
  <div class="theme-toggle">
    <el-switch
      v-model="isDark"
      active-text="暗色"
      inactive-text="亮色"
      @change="handleThemeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isDark = ref(false)

const handleThemeChange = (val: boolean) => {
  const html = document.documentElement
  
  if (val) {
    html.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    html.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
})
</script>

<style lang="scss" scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  padding: 0 20px;
}
</style>
