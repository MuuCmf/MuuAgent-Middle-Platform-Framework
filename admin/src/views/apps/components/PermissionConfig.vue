<template>
  <div class="permission-config" v-loading="loading">
    <div class="permission-header">
      <el-button type="primary" size="small" @click="handleSave" :loading="saving">
        {{ $t('app.savePermissions') }}
      </el-button>
    </div>

    <div class="permission-modules">
      <div
        v-for="mod in modules"
        :key="mod.key"
        class="permission-module"
      >
        <div class="module-header">
          <el-icon :size="18"><component :is="mod.icon" /></el-icon>
          <span class="module-title">{{ mod.label }}</span>
          <el-switch
            :model-value="isModuleEnabled(mod.key)"
            @change="(val: boolean) => toggleModule(mod.key, val)"
            size="small"
            :active-text="$t('app.enabled')"
            :inactive-text="$t('app.disabled')"
          />
        </div>

        <div class="module-actions" v-if="isModuleEnabled(mod.key)">
          <div
            v-for="action in mod.actions"
            :key="action.key"
            class="action-item"
          >
            <el-switch
              :model-value="getActionValue(mod.key, action.key)"
              @change="(val: boolean) => setActionValue(mod.key, action.key, val)"
              size="small"
            />
            <span class="action-label">{{ action.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Monitor, Cpu, Collection, ChatDotRound, FolderOpened, SetUp, Lock } from '@element-plus/icons-vue'
import { appApi, type TenantPermissions } from '@/api/app'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  /** 应用ID */
  appId: string
}

const props = defineProps<Props>()

/** 加载状态 */
const loading = ref(false)
/** 保存状态 */
const saving = ref(false)
/** 权限数据 */
const permissions = reactive<TenantPermissions>({})

/** 模块定义 */
const modules = [
  {
    key: 'agent' as const,
    label: t('app.permAgent'),
    icon: Monitor,
    actions: [
      { key: 'chat', label: t('app.permAgentChat') },
      { key: 'stream', label: t('app.permAgentStream') },
    ],
  },
  {
    key: 'ai' as const,
    label: t('app.permAi'),
    icon: Cpu,
    actions: [
      { key: 'invoke', label: t('app.permAiInvoke') },
      { key: 'stream', label: t('app.permAiStream') },
      { key: 'image', label: t('app.permAiImage') },
      { key: 'tts', label: t('app.permAiTts') },
      { key: 'asr', label: t('app.permAiAsr') },
    ],
  },
  {
    key: 'kb' as const,
    label: t('app.permKb'),
    icon: Collection,
    actions: [
      { key: 'retrieval', label: t('app.permKbRetrieval') },
      { key: 'ragChat', label: t('app.permKbRagChat') },
    ],
  },
  {
    key: 'conversation' as const,
    label: t('app.permConversation'),
    icon: ChatDotRound,
    actions: [
      { key: 'create', label: t('app.permConversationCreate') },
      { key: 'update', label: t('app.permConversationUpdate') },
      { key: 'delete', label: t('app.permConversationDelete') },
      { key: 'addMessage', label: t('app.permConversationAddMessage') },
    ],
  },
  {
    key: 'file' as const,
    label: t('app.permFile'),
    icon: FolderOpened,
    actions: [
      { key: 'upload', label: t('app.permFileUpload') },
      { key: 'download', label: t('app.permFileDownload') },
      { key: 'delete', label: t('app.permFileDelete') },
    ],
  },
  {
    key: 'dynamicTool' as const,
    label: t('app.permDynamicTool'),
    icon: SetUp,
    actions: [
      { key: 'create', label: t('app.permDynamicToolCreate') },
      { key: 'update', label: t('app.permDynamicToolUpdate') },
      { key: 'delete', label: t('app.permDynamicToolDelete') },
    ],
  },
  {
    key: 'toolPolicy' as const,
    label: t('app.permToolPolicy'),
    icon: Lock,
    actions: [
      { key: 'read', label: t('app.permToolPolicyRead') },
      { key: 'write', label: t('app.permToolPolicyWrite') },
    ],
  },
]

/**
 * 判断模块是否启用（至少有一个操作为true）
 * @param moduleKey 模块键
 * @returns {boolean} 是否启用
 */
const isModuleEnabled = (moduleKey: keyof TenantPermissions): boolean => {
  const mod = permissions[moduleKey] as Record<string, boolean> | undefined
  if (!mod) return false
  return Object.values(mod).some((v) => v === true)
}

/**
 * 切换模块启用状态
 * @param moduleKey 模块键
 * @param enabled 是否启用
 */
const toggleModule = (moduleKey: keyof TenantPermissions, enabled: boolean) => {
  if (enabled) {
    (permissions as any)[moduleKey] = {}
    const mod = modules.find((m) => m.key === moduleKey)
    if (mod) {
      mod.actions.forEach((action) => {
        ;(permissions[moduleKey] as Record<string, boolean>)[action.key] = true
      })
    }
  } else {
    (permissions as any)[moduleKey] = {}
  }
}

/**
 * 获取操作值
 * @param moduleKey 模块键
 * @param actionKey 操作键
 * @returns {boolean} 操作是否启用
 */
const getActionValue = (moduleKey: keyof TenantPermissions, actionKey: string): boolean => {
  const mod = permissions[moduleKey] as Record<string, boolean> | undefined
  return mod?.[actionKey] ?? false
}

/**
 * 设置操作值
 * @param moduleKey 模块键
 * @param actionKey 操作键
 * @param value 值
 */
const setActionValue = (moduleKey: keyof TenantPermissions, actionKey: string, value: boolean) => {
  if (!permissions[moduleKey]) {
    ;(permissions as any)[moduleKey] = {}
  }
  ;(permissions[moduleKey] as Record<string, boolean>)[actionKey] = value
}

/**
 * 加载权限配置
 */
const loadPermissions = async () => {
  loading.value = true
  try {
    const { data } = await appApi.getPermissions(props.appId)
    Object.assign(permissions, data.data)
  } catch (error) {
    console.error('获取权限配置失败:', error)
    ElMessage.error(t('app.getPermissionsFailed'))
  } finally {
    loading.value = false
  }
}

/**
 * 保存权限配置
 */
const handleSave = async () => {
  saving.value = true
  try {
    await appApi.updatePermissions(props.appId, { ...permissions })
    ElMessage.success(t('app.savePermissionsSuccess'))
  } catch (error) {
    console.error('保存权限配置失败:', error)
    ElMessage.error(t('app.savePermissionsFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadPermissions()
})
</script>

<style scoped lang="scss">
.permission-config {
  padding: 4px 0;
}

.permission-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.permission-modules {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.permission-module {
  background: #fafafa;
  border: 1px solid #f3f4f6;
  border-radius: 10px;
  padding: 16px 20px;
}

.module-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.module-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e1b4b;
  flex: 1;
}

.module-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding-left: 28px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-label {
  font-size: 13px;
  color: #6b7280;
}
</style>
