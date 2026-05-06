<template>
  <el-dialog
    v-model="visible"
    title="选择技能"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="skill-select-container">
      <div class="search-box">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索技能名称或标识"
          clearable
          prefix-icon="Search"
        />
      </div>

      <div class="selected-skills" v-if="selectedSkills.length > 0">
        <div class="selected-header">
          <span class="selected-title">已选择 ({{ selectedSkills.length }})</span>
          <el-button text type="primary" size="small" @click="clearSelection">
            清空
          </el-button>
        </div>
        <div class="selected-tags">
          <el-tag
            v-for="skill in selectedSkills"
            :key="skill.code"
            closable
            @close="removeSkill(skill.code)"
            style="margin: 4px;"
          >
            {{ skill.name }} ({{ skill.code }})
          </el-tag>
        </div>
      </div>

      <div class="skill-list">
        <div v-if="filteredSkills.length === 0" class="empty-skills">
          <el-empty description="暂无可用技能" :image-size="80" />
        </div>
        <div v-else class="skill-items">
          <div
            v-for="skill in filteredSkills"
            :key="skill.code"
            class="skill-item"
            :class="{ 'is-selected': isSkillSelected(skill.code) }"
            @click="toggleSkill(skill)"
          >
            <div class="skill-checkbox">
              <el-checkbox
                :model-value="isSkillSelected(skill.code)"
                @click.stop
                @change="toggleSkill(skill)"
              />
            </div>
            <div class="skill-info">
              <div class="skill-name">{{ skill.name }}</div>
              <div class="skill-code">{{ skill.code }}</div>
              <div class="skill-description" v-if="skill.description">
                {{ skill.description }}
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
          确定 ({{ selectedSkills.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Skill } from '@/api/skill'

interface Props {
  modelValue: boolean
  skills: Skill[]
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
const selectedSkills = ref<Skill[]>([])

const filteredSkills = computed(() => {
  if (!searchKeyword.value) {
    return props.skills
  }

  const keyword = searchKeyword.value.toLowerCase()
  return props.skills.filter(skill =>
    skill.name.toLowerCase().includes(keyword) ||
    skill.code.toLowerCase().includes(keyword) ||
    (skill.description && skill.description.toLowerCase().includes(keyword))
  )
})

watch(visible, (newVal) => {
  if (newVal) {
    selectedSkills.value = props.skills.filter(skill =>
      props.selectedCodes.includes(skill.code)
    )
    searchKeyword.value = ''
  }
})

const isSkillSelected = (code: string) => {
  return selectedSkills.value.some(skill => skill.code === code)
}

const toggleSkill = (skill: Skill) => {
  const index = selectedSkills.value.findIndex(s => s.code === skill.code)
  if (index > -1) {
    selectedSkills.value.splice(index, 1)
  } else {
    selectedSkills.value.push(skill)
  }
}

const removeSkill = (code: string) => {
  const index = selectedSkills.value.findIndex(s => s.code === code)
  if (index > -1) {
    selectedSkills.value.splice(index, 1)
  }
}

const clearSelection = () => {
  selectedSkills.value = []
}

const handleConfirm = () => {
  const codes = selectedSkills.value.map(skill => skill.code)
  emit('confirm', codes)
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

.skill-code {
  font-size: 12px;
  color: #909399;
  font-family: 'Courier New', monospace;
  margin-bottom: 4px;
}

.skill-description {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin-top: 8px;
}
</style>
