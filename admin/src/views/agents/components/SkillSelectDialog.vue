<template>
  <el-dialog
    v-model="visible"
    :title="$t('skillSelect.selectSkill')"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="skill-select-container">
      <div class="search-box">
        <el-input
          v-model="searchKeyword"
          :placeholder="$t('skillSelect.searchSkillName')"
          clearable
          prefix-icon="Search"
          @input="handleSearch"
        />
      </div>

      <div class="selected-skills" v-if="selectedSkills.length > 0">
        <div class="selected-header">
          <span class="selected-title">{{ $t('skillSelect.selected') }} ({{ selectedSkills.length }})</span>
          <el-button text type="primary" size="small" @click="clearSelection">
            {{ $t('skillSelect.clear') }}
          </el-button>
        </div>
        <div class="selected-tags">
          <el-tag
            v-for="skill in selectedSkills"
            :key="skill.name"
            closable
            @close="removeSkill(skill.name)"
            style="margin: 4px;"
          >
            {{ skill.name }}
          </el-tag>
        </div>
      </div>

      <div class="skill-list">
        <div v-if="paginatedSkills.length === 0" class="empty-skills">
          <el-empty :description="$t('skillSelect.noAvailableSkills')" :image-size="80" />
        </div>
        <div v-else class="skill-items">
          <div
            v-for="skill in paginatedSkills"
            :key="skill.name"
            class="skill-item"
            :class="{ 'is-selected': isSkillSelected(skill.name) }"
            @click="toggleSkill(skill)"
          >
            <div class="skill-checkbox">
              <el-checkbox
                :model-value="isSkillSelected(skill.name)"
                @click.stop
                @change="toggleSkill(skill)"
              />
            </div>
            <div class="skill-info">
              <div class="skill-name">{{ skill.name }}</div>
              <div class="skill-description" v-if="skill.description">
                {{ skill.description }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination-container" v-if="totalFiltered > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalFiltered"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          small
        />
      </div>
    </div>

    <template #footer>
      <div style="text-align: right;">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">
          {{ $t('skillSelect.confirm') }} ({{ selectedSkills.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface SkillItem {
  name: string
  description: string
}

interface Props {
  modelValue: boolean
  skills: SkillItem[]
  selectedCodes?: string[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', skills: string[]): void
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
const selectedSkills = ref<SkillItem[]>([])
const currentPage = ref(1)
const pageSize = ref(20)

const filteredSkills = computed(() => {
  if (!searchKeyword.value) {
    return props.skills
  }

  const keyword = searchKeyword.value.toLowerCase()
  return props.skills.filter(skill =>
    skill.name.toLowerCase().includes(keyword) ||
    (skill.description && skill.description.toLowerCase().includes(keyword))
  )
})

const totalFiltered = computed(() => filteredSkills.value.length)

const paginatedSkills = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredSkills.value.slice(start, end)
})

const handleSearch = () => {
  currentPage.value = 1
}

watch(visible, (newVal) => {
  if (newVal) {
    selectedSkills.value = props.skills.filter(skill =>
      props.selectedCodes.includes(skill.name)
    )
    searchKeyword.value = ''
    currentPage.value = 1
  }
})

const isSkillSelected = (name: string) => {
  return selectedSkills.value.some(skill => skill.name === name)
}

const toggleSkill = (skill: SkillItem) => {
  const index = selectedSkills.value.findIndex(s => s.name === skill.name)
  if (index > -1) {
    selectedSkills.value.splice(index, 1)
  } else {
    selectedSkills.value.push(skill)
  }
}

const removeSkill = (name: string) => {
  const index = selectedSkills.value.findIndex(s => s.name === name)
  if (index > -1) {
    selectedSkills.value.splice(index, 1)
  }
}

const clearSelection = () => {
  selectedSkills.value = []
}

const handleConfirm = () => {
  const names = selectedSkills.value.map(skill => skill.name)
  emit('confirm', names)
  handleClose()
}

const handleClose = () => {
  visible.value = false
}
</script>

<style lang="scss" scoped>
.skill-select-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-box {
  margin-bottom: 8px;
}

.selected-skills {
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

.skill-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.empty-skills {
  padding: 40px 20px;
  text-align: center;
}

.skill-items {
  padding: 8px;
}

.skill-item {
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

.skill-checkbox {
  flex-shrink: 0;
  margin-top: 2px;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.skill-description {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin-top: 8px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
