<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('voice.title') }}</h1>
      <p class="page-description">{{ $t('voice.description') }}</p>
    </div>

    <div class="card">
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          {{ $t('voice.addVoice') }}
        </el-button>

        <div class="toolbar-right">
          <el-input
            v-model="searchKeyword"
            :placeholder="$t('voice.searchPlaceholder')"
            clearable
            style="width: 250px;"
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
          <el-button @click="handleSearch">
            <el-icon><Search /></el-icon>
          </el-button>
          <el-button @click="loadList">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>

      <el-table :data="voiceList" stripe v-loading="loading">
        <el-table-column prop="name" :label="$t('voice.voiceName')" min-width="140" />
        <el-table-column prop="code" :label="$t('voice.voiceCode')" width="140">
          <template #default="{ row }">
            <el-tag type="info">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="voiceId" :label="$t('voice.voiceId')" width="120" />
        <el-table-column prop="provider" :label="$t('voice.provider')" width="100">
          <template #default="{ row }">
            <el-tag>{{ getProviderLabel(row.provider) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="modelCode" :label="$t('voice.modelCode')" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.modelCode" type="info" size="small">{{ row.modelCode }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="language" :label="$t('voice.language')" width="80">
          <template #default="{ row }">
            <el-tag type="success" size="small">{{ getLanguageLabel(row.language) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="gender" :label="$t('voice.gender')" width="70">
          <template #default="{ row }">
            <span v-if="row.gender">{{ getGenderLabel(row.gender) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="sampleRate" :label="$t('voice.sampleRate')" width="100">
          <template #default="{ row }">
            {{ row.sampleRate }}Hz
          </template>
        </el-table-column>
        <el-table-column prop="isDefault" :label="$t('voice.isDefault')" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="warning" size="small">{{ $t('voice.default') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="$t('voice.status')" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? $t('voice.enabled') : $t('voice.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('voice.actions')" width="220" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="handleEdit(row)">
              {{ $t('voice.edit') }}
            </el-button>
            <el-button
              v-if="!row.isDefault"
              link
              size="small"
              type="warning"
              @click="handleSetDefault(row)"
            >
              {{ $t('voice.setDefault') }}
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">
              {{ $t('voice.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </div>

    <VoiceEditDrawer
      v-model:visible="editDrawerVisible"
      :voice="currentVoice"
      @success="handleSaveSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { voiceProfileApi, type VoiceProfile } from '@/api/voice-profile'
import VoiceEditDrawer from './components/VoiceEditDrawer.vue'

const { t } = useI18n()

/** 列表数据 */
const voiceList = ref<VoiceProfile[]>([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')

/** 编辑弹窗 */
const editDrawerVisible = ref(false)
const currentVoice = ref<VoiceProfile | null>(null)

/**
 * 加载语音配置列表
 */
async function loadList() {
  loading.value = true
  try {
    const response = await voiceProfileApi.getList({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
    })
    const { data } = response.data
    voiceList.value = data.list
    total.value = data.total
  } catch (error) {
    console.error('加载语音配置列表失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 搜索
 */
function handleSearch() {
  currentPage.value = 1
  loadList()
}

/**
 * 新增
 */
function handleAdd() {
  currentVoice.value = null
  editDrawerVisible.value = true
}

/**
 * 编辑
 * @param row 语音配置
 */
function handleEdit(row: VoiceProfile) {
  currentVoice.value = { ...row }
  editDrawerVisible.value = true
}

/**
 * 删除
 * @param row 语音配置
 */
async function handleDelete(row: VoiceProfile) {
  try {
    await ElMessageBox.confirm(t('voice.confirmDelete'), t('common.warning'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
    await voiceProfileApi.delete(row.id)
    ElMessage.success(t('voice.deleteSuccess'))
    loadList()
  } catch {
    // cancelled
  }
}

/**
 * 设为默认
 * @param row 语音配置
 */
async function handleSetDefault(row: VoiceProfile) {
  try {
    await voiceProfileApi.setDefault(row.id)
    ElMessage.success(t('voice.setDefaultSuccess'))
    loadList()
  } catch (error) {
    console.error('设为默认失败:', error)
  }
}

/**
 * 保存成功回调
 */
function handleSaveSuccess() {
  loadList()
}

/**
 * 获取提供商标签
 * @param provider 提供商
 * @returns {string} 标签文本
 */
function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: t('voice.providerOpenai'),
    azure: t('voice.providerAzure'),
    aliyun: t('voice.providerAliyun'),
    local: t('voice.providerLocal'),
  }
  return labels[provider] || provider
}

/**
 * 获取语言标签
 * @param language 语言
 * @returns {string} 标签文本
 */
function getLanguageLabel(language: string): string {
  const labels: Record<string, string> = {
    'zh-CN': t('voice.languageZh'),
    'en-US': t('voice.languageEn'),
    'ja-JP': t('voice.languageJa'),
    'ko-KR': t('voice.languageKo'),
  }
  return labels[language] || language
}

/**
 * 获取性别标签
 * @param gender 性别
 * @returns {string} 标签文本
 */
function getGenderLabel(gender: string): string {
  const labels: Record<string, string> = {
    male: t('voice.male'),
    female: t('voice.female'),
    neutral: t('voice.neutral'),
  }
  return labels[gender] || gender
}

onMounted(() => {
  loadList()
})
</script>

<style scoped lang="scss">
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
