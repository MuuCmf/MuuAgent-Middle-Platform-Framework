<template>
  <div class="user-info" :title="`${user.name} - ${roleLabel}`">
    <div class="user-avatar">
      <img v-if="user.avatar" :src="user.avatar" :alt="user.name" class="avatar-img" />
      <span v-else class="avatar-text">{{ initials }}</span>
    </div>
    <div class="user-detail">
      <span class="user-name">{{ user.name }}</span>
      <span class="user-role">{{ roleLabel }}</span>
    </div>
    <div class="user-action">
      <el-icon :size="16"><ArrowDown /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import { getCurrentUser, getInitials, roleLabelMap, type UserInfo } from '../../mock/user'

/**
 * 当前用户信息
 */
const user = computed<UserInfo>(() => getCurrentUser())

/**
 * 用户名首字母（头像回退）
 */
const initials = computed(() => getInitials(user.value.name))

/**
 * 角色中文标签
 */
const roleLabel = computed(() => roleLabelMap[user.value.role])
</script>

<style lang="scss" scoped>
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-top: 1px solid var(--border-color, #e8e8e8);
  background: var(--bg-secondary, #fafbfc);

  &:hover {
    background: var(--bg-tertiary, #f0f2f5);

    .user-action {
      color: var(--text-secondary, #666);
    }
  }
}

.user-avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-text {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-gradient);
  color: white;
  font-size: 14px;
  font-weight: 600;
  border-radius: 50%;
}

.user-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: 11px;
  color: var(--text-tertiary, #999);
}

.user-action {
  flex-shrink: 0;
  color: var(--text-tertiary, #999);
  transition: color 0.2s;
}
</style>