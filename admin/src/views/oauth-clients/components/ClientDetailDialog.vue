<template>
  <el-dialog
    v-model="visible"
    title="客户端详情"
    width="700px"
    @close="handleClose"
  >
    <el-descriptions v-if="client" :column="1" border>
      <el-descriptions-item label="客户端名称">
        {{ client.name }}
      </el-descriptions-item>
      
      <el-descriptions-item label="客户端ID">
        <el-tag type="info">{{ client.clientId }}</el-tag>
        <el-button
          size="small"
          type="primary"
          link
          @click="copyToClipboard(client.clientId)"
          style="margin-left: 8px;"
        >
          复制
        </el-button>
      </el-descriptions-item>

      <el-descriptions-item label="回调地址">
        <el-space wrap>
          <el-tag
            v-for="uri in client.redirectUris"
            :key="uri"
            type="success"
            size="small"
          >
            {{ uri }}
          </el-tag>
        </el-space>
      </el-descriptions-item>

      <el-descriptions-item label="权限范围">
        <el-space wrap>
          <el-tooltip
            v-for="scope in client.scopes"
            :key="scope"
            :content="getScopeDescription(scope)"
            placement="top"
          >
            <el-tag
              :type="getScopeTagType(scope)"
              size="small"
            >
              {{ scope }}
            </el-tag>
          </el-tooltip>
        </el-space>
      </el-descriptions-item>

      <el-descriptions-item label="授权类型">
        <el-space wrap>
          <el-tag
            v-for="grant in client.grants"
            :key="grant"
            size="small"
          >
            {{ getGrantLabel(grant) }}
          </el-tag>
        </el-space>
      </el-descriptions-item>

      <el-descriptions-item label="状态">
        <el-tag :type="client.status === 1 ? 'success' : 'danger'">
          {{ client.status === 1 ? '启用' : '禁用' }}
        </el-tag>
      </el-descriptions-item>

      <el-descriptions-item label="令牌数量">
        <el-tag type="info">{{ client.tokenCount || 0 }} 个</el-tag>
      </el-descriptions-item>

      <el-descriptions-item label="创建时间">
        {{ formatDate(client.createdAt) }}
      </el-descriptions-item>

      <el-descriptions-item label="更新时间">
        {{ formatDate(client.updatedAt) }}
      </el-descriptions-item>
    </el-descriptions>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { OAuthClient } from '@/api/oauth'
import { getScopeDescription, getScopeTagType } from '@/constants/scope'

interface Props {
  visible: boolean
  client: OAuthClient | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

/**
 * 关闭对话框
 */
const handleClose = () => {
  visible.value = false
}

/**
 * 获取授权类型标签
 * @param grant 授权类型
 * @returns {string} 标签文本
 */
const getGrantLabel = (grant: string) => {
  const labels: Record<string, string> = {
    authorization_code: '授权码模式',
    refresh_token: '刷新令牌',
  }
  return labels[grant] || grant
}

/**
 * 格式化日期
 * @param date 日期字符串
 * @returns {string} 格式化后的日期
 */
const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}

/**
 * 复制到剪贴板
 * @param text 要复制的文本
 */
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}
</script>
