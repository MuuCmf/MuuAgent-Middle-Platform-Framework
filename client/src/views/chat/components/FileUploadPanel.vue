<template>
  <!-- 附件上传按钮 -->
  <div
    class="attach-btn"
    @click="showFilePicker = true"
    title="上传附件"
  >
    <el-icon :size="20">
      <Paperclip />
    </el-icon>
  </div>

  <!-- 文件上传弹出层 -->
  <Teleport to="body">
    <Transition name="file-sheet">
      <div v-if="showFilePicker" class="file-sheet-overlay" @click.self="showFilePicker = false">
        <div class="file-sheet-panel">
          <div class="file-sheet-header">
            <span class="file-sheet-title">上传文件</span>
            <el-icon class="file-sheet-close" :size="20" @click="showFilePicker = false">
              <Close />
            </el-icon>
          </div>
          <div class="file-sheet-body">
            <div class="file-sheet-item" @click="selectFileType('image/*', 'image')">
              <span class="file-sheet-emoji">🖼️</span>
              <div class="file-sheet-info">
                <div class="file-sheet-name">图片</div>
                <div class="file-sheet-desc">上传 JPG、PNG、GIF 等格式图片</div>
              </div>
            </div>
            <div class="file-sheet-item" @click="selectFileType('video/*', 'video')">
              <span class="file-sheet-emoji">🎬</span>
              <div class="file-sheet-info">
                <div class="file-sheet-name">视频</div>
                <div class="file-sheet-desc">上传 MP4、AVI、MOV 等格式视频</div>
              </div>
            </div>
            <div class="file-sheet-item" @click="selectFileType('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar', 'file')">
              <span class="file-sheet-emoji">📄</span>
              <div class="file-sheet-info">
                <div class="file-sheet-name">文件</div>
                <div class="file-sheet-desc">上传 PDF、Word、Excel、PPT 等文档</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <input ref="fileInputRef" type="file" style="display: none" @change="handleFileChange" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Paperclip, Close } from '@element-plus/icons-vue'

const emit = defineEmits<{
  /** 文件上传 */
  'file-upload': [file: File, fileType: string]
}>()

/** 文件选择器是否显示 */
const showFilePicker = ref(false)
/** 隐藏的文件输入框引用 */
const fileInputRef = ref<HTMLInputElement | null>()
/** 当前待上传的文件类型 */
const pendingFileType = ref('')

/**
 * 处理文件选择完成
 * @param e 事件对象
 */
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('file-upload', target.files[0], pendingFileType.value)
  }
}

/**
 * 选择文件类型，触发原生文件选择器
 * @param accept 允许的文件类型
 * @param fileType 文件类别（image/video/file）
 */
const selectFileType = (accept: string, fileType: string) => {
  pendingFileType.value = fileType
  if (fileInputRef.value) {
    fileInputRef.value.accept = accept
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
  showFilePicker.value = false
}
</script>

<style scoped>
/* ========== 附件上传按钮 ========== */
.attach-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg-tertiary, #f0f2f5);
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.attach-btn:hover {
  background: var(--bg-secondary, #e8eaed);
  color: var(--text-color, #333);
  transform: scale(1.05);
}

/* ========== 文件上传弹出层 ========== */
.file-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.file-sheet-panel {
  width: 100%;
  max-width: 400px;
  background: var(--white);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  margin: 0 20px;
}

.file-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.file-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.file-sheet-close {
  cursor: pointer;
  color: var(--text-tertiary);
  transition: color 0.2s;
}

.file-sheet-close:hover {
  color: var(--text-color);
}

.file-sheet-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-sheet-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-sheet-item:hover {
  background: var(--bg-secondary);
}

.file-sheet-emoji {
  font-size: 28px;
  line-height: 1;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.file-sheet-info {
  flex: 1;
  min-width: 0;
}

.file-sheet-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.file-sheet-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.file-sheet-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-sheet-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-sheet-enter-from,
.file-sheet-leave-to {
  opacity: 0;
}

.file-sheet-enter-from .file-sheet-panel,
.file-sheet-leave-to .file-sheet-panel {
  transform: scale(0.9) translateY(20px);
  opacity: 0;
}

.file-sheet-enter-to,
.file-sheet-leave-from {
  opacity: 1;
}
</style>
