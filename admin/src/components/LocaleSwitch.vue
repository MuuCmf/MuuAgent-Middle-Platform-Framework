<template>
  <el-dropdown @command="handleLanguageChange" trigger="click">
    <el-button type="primary" text>
      <el-icon><IEpGlobeSolid /></el-icon>
      <span class="lang-text">{{ currentLangLabel }}</span>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item 
          v-for="lang in languages" 
          :key="lang.value" 
          :command="lang.value"
          :disabled="lang.value === currentLang"
        >
          <el-icon v-if="lang.value === currentLang"><IEpCheck /></el-icon>
          <span>{{ lang.label }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

/**
 * 语言选项类型定义
 */
interface LanguageOption {
  label: string
  value: string
}

/**
 * 支持的语言列表
 */
const languages: LanguageOption[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]

const { locale } = useI18n()

/**
 * 当前语言
 */
const currentLang = computed(() => locale.value)

/**
 * 当前语言标签
 */
const currentLangLabel = computed(() => {
  const lang = languages.find(l => l.value === currentLang.value)
  return lang?.label || '简体中文'
})

/**
 * 切换语言
 * @param lang 语言代码
 */
const handleLanguageChange = (lang: string) => {
  if (lang === locale.value) return
  
  locale.value = lang
  localStorage.setItem('locale', lang)
  
  const langLabel = languages.find(l => l.value === lang)?.label
  ElMessage.success(`语言已切换为 ${langLabel}`)
  
  window.location.reload()
}
</script>

<style scoped lang="scss">
.lang-text {
  margin-left: 4px;
}
</style>
