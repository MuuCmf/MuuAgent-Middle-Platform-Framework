<template>
  <div class="app-selector">
    <el-select
      v-model="selectedAppCode"
      :placeholder="computedPlaceholder"
      :clearable="clearable"
      :disabled="disabled"
      :size="size"
      :style="{ width: width }"
      @change="handleChange"
    >
      <el-option
        v-for="app in appList"
        :key="app.code"
        :label="app.name"
        :value="app.code"
      >
        <div class="app-option">
          <span class="app-name">{{ app.name }}</span>
          <span class="app-code">{{ app.code }}</span>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { appApi, type App } from '@/api/app'
import { useUserStore } from '@/stores/user'
import { useI18n } from 'vue-i18n'

/**
 * 组件属性
 */
interface Props {
  modelValue?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  size?: 'large' | 'default' | 'small'
  width?: string
}

const { t } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  clearable: true,
  disabled: false,
  size: 'default',
  width: '200px',
})

const computedPlaceholder = computed(() => props.placeholder || t('component.selectApp'))

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string, app: App | null]
}>()

const userStore = useUserStore()
const appList = ref<App[]>([])
const loading = ref(false)
const selectedAppCode = ref(props.modelValue)

/**
 * 是否为超级管理员
 */
const isSuperAdmin = computed(() => userStore.isSuperAdmin)

/**
 * 加载应用列表
 */
const loadAppList = async () => {
  if (!isSuperAdmin.value) {
    return
  }

  loading.value = true
  try {
    const { data } = await appApi.getList({ pageSize: 100 })
    appList.value = data.data.list
  } catch (error) {
    console.error(t('component.loadAppListFailed'), error)
    ElMessage.error(t('component.loadAppListFailed'))
  } finally {
    loading.value = false
  }
}

/**
 * 处理选择变化
 */
const handleChange = (value: string) => {
  emit('update:modelValue', value)
  const selectedApp = appList.value.find(app => app.code === value) || null
  emit('change', value, selectedApp)
}

/**
 * 监听外部值变化
 */
watch(() => props.modelValue, (newVal) => {
  selectedAppCode.value = newVal
})

/**
 * 组件挂载时加载应用列表
 */
onMounted(() => {
  if (isSuperAdmin.value) {
    loadAppList()
  }
})
</script>

<style scoped lang="scss">
.app-selector {
  display: inline-block;
}

.app-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .app-name {
    font-weight: 500;
  }

  .app-code {
    font-size: 12px;
    color: #909399;
    margin-left: 8px;
  }
}
</style>
