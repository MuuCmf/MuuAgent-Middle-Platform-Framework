<template>
  <div class="chat-input">
    <el-input :model-value="input" @update:model-value="$emit('update:input', $event)" placeholder="输入消息..." @keyup.enter="$emit('send')" :disabled="loading" />
    <el-button type="primary" @click="$emit('send')" :disabled="loading || !input.trim()">
      发送
    </el-button>
    <el-button @click="$emit('new-conversation')" :disabled="loading">
      新建会话
    </el-button>
    <el-button @click="$emit('clear')" :disabled="messagesEmpty">
      清空
    </el-button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  input: string
  loading: boolean
  messagesEmpty: boolean
}>()

defineEmits<{
  'update:input': [value: string]
  'send': []
  'clear': []
  'new-conversation': []
}>()
</script>

<style lang="scss" scoped>
.chat-input {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
}
</style>
