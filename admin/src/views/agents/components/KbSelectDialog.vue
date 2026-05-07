<template>
  <el-dialog
    v-model="visible"
    title="选择知识库"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="kb-select-container">
      <div class="search-box">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索知识库名称或标识"
          clearable
          prefix-icon="Search"
        />
      </div>

      <div class="selected-kbs" v-if="selectedKbs.length > 0">
        <div class="selected-header">
          <span class="selected-title">已选择 ({{ selectedKbs.length }})</span>
          <el-button text type="primary" size="small" @click="clearSelection">
            清空
          </el-button>
        </div>
        <div class="selected-tags">
          <el-tag
            v-for="kb in selectedKbs"
            :key="kb.kbCode"
            closable
            @close="removeKb(kb.kbCode)"
            style="margin: 4px;"
          >
            {{ kb.kbName }} ({{ kb.kbCode }})
          </el-tag>
        </div>
      </div>

      <div class="kb-list">
        <div v-if="loading" class="loading-kbs">
          <el-empty description="加载中..." :image-size="80" />
        </div>
        <div v-else-if="filteredKbs.length === 0" class="empty-kbs">
          <el-empty description="暂无可用知识库" :image-size="80" />
        </div>
        <div v-else class="kb-items">
          <div
            v-for="kb in filteredKbs"
            :key="kb.kbCode"
            class="kb-item"
            :class="{ 'is-selected': isKbSelected(kb.kbCode) }"
            @click="toggleKb(kb)"
          >
            <div class="kb-checkbox">
              <el-checkbox
                :model-value="isKbSelected(kb.kbCode)"
                @click.stop
                @change="toggleKb(kb)"
              />
            </div>
            <div class="kb-info">
              <div class="kb-name">{{ kb.kbName }}</div>
              <div class="kb-code">{{ kb.kbCode }}</div>
              <div class="kb-description" v-if="kb.description">
                {{ kb.description }}
              </div>
              <div class="kb-meta">
                <el-tag size="small" type="info">{{ kb.documentCount || 0 }} 文档</el-tag>
                <el-tag size="small" type="info" style="margin-left: 8px;">{{ kb.chunkCount || 0 }} 切片</el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div style="text-align: right;">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleConfirm">
          确定 ({{ selectedKbs.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { KbInfo } from '@/api/kb'
import { kbApi } from '@/api/kb'

interface Props {
  modelValue: boolean
  selectedCodes?: string[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', kbs: string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  selectedCodes: () => []
})

const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const searchKeyword = ref('')
const selectedKbs = ref<KbInfo[]>([])
const availableKbs = ref<KbInfo[]>([])
const loading = ref(false)

const filteredKbs = computed(() => {
  if (!searchKeyword.value) {
    return availableKbs.value
  }

  const keyword = searchKeyword.value.toLowerCase()
  return availableKbs.value.filter(kb =>
    kb.kbName.toLowerCase().includes(keyword) ||
    kb.kbCode.toLowerCase().includes(keyword) ||
    (kb.description && kb.description.toLowerCase().includes(keyword))
  )
})

const loadKbs = async () => {
  loading.value = true
  try {
    const response = await kbApi.getList({ pageSize: 100, status: true })
    if (response.data.code === 200) {
      availableKbs.value = response.data.data.list
    } else {
      ElMessage.error(response.data.message || '加载知识库列表失败')
    }
  } catch (error) {
    console.error('加载知识库列表失败', error)
    ElMessage.error('加载知识库列表失败')
  } finally {
    loading.value = false
  }
}

watch(visible, (newVal) => {
  if (newVal) {
    selectedKbs.value = availableKbs.value.filter(kb =>
      props.selectedCodes.includes(kb.kbCode)
    )
    searchKeyword.value = ''
  }
})

onMounted(() => {
  loadKbs()
})

const isKbSelected = (kbCode: string) => {
  return selectedKbs.value.some(kb => kb.kbCode === kbCode)
}

const toggleKb = (kb: KbInfo) => {
  const index = selectedKbs.value.findIndex(k => k.kbCode === kb.kbCode)
  if (index > -1) {
    selectedKbs.value.splice(index, 1)
  } else {
    selectedKbs.value.push(kb)
  }
}

const removeKb = (kbCode: string) => {
  const index = selectedKbs.value.findIndex(k => k.kbCode === kbCode)
  if (index > -1) {
    selectedKbs.value.splice(index, 1)
  }
}

const clearSelection = () => {
  selectedKbs.value = []
}

const handleConfirm = () => {
  const codes = selectedKbs.value.map(kb => kb.kbCode)
  emit('confirm', codes)
  handleClose()
}

const handleClose = () => {
  visible.value = false
}
</script>

<style lang="scss" scoped>
.kb-select-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-box {
  margin-bottom: 8px;
}

.selected-kbs {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.selected-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.selected-title {
  font-weight: 500;
  color: #303133;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
}

.kb-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.loading-kbs,
.empty-kbs {
  padding: 40px 20px;
  text-align: center;
}

.kb-items {
  padding: 8px;
}

.kb-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;

  &:hover {
    background: #f5f7fa;
  }

  &.is-selected {
    background: #ecf5ff;
    border: 1px solid #409eff;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.kb-checkbox {
  flex-shrink: 0;
  margin-top: 2px;
}

.kb-info {
  flex: 1;
  min-width: 0;
}

.kb-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.kb-code {
  font-size: 12px;
  color: #909399;
  font-family: 'Courier New', monospace;
  margin-bottom: 4px;
}

.kb-description {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin-top: 8px;
}

.kb-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
}
</style>
