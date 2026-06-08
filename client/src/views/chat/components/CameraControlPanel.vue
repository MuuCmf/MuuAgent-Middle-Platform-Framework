<template>
  <!-- 触发按钮 -->
  <div
    class="av-trigger"
    :class="{ active: modelValue }"
    @click="handleTriggerClick"
    title="音视频对话（点击开启/关闭）"
  >
    <el-icon :size="18"><VideoCamera /></el-icon>
    <span class="av-trigger-badge" :class="{ active: modelValue }" />
  </div>

  <!-- 摄像头控制面板 -->
  <Teleport to="body">
    <Transition name="video-sheet">
      <div v-if="visible" class="video-sheet-overlay" @click.self="handleOverlayClick">
        <div class="video-sheet-panel" :style="{ transform: `translate(${panelOffsetX}px, ${panelOffsetY}px)` }">
          <div class="video-sheet-header" @mousedown="handlePanelDragStart">
            <span class="video-sheet-title">音视频控制</span>
            <div class="video-sheet-header-right">
              <el-button size="small" round @click="handleCloseBtnClick">
                关闭
              </el-button>
            </div>
          </div>
          <div class="video-sheet-body">
            <!-- 摄像头开关按钮 -->
            <div class="camera-control-row">
              <span class="camera-control-label">摄像头</span>
              <el-button
                :type="localCameraActive ? 'primary' : 'default'"
                :icon="localCameraActive ? VideoCameraFilled : VideoCamera"
                round
                size="small"
                @click="handleCameraToggle"
              >
                {{ localCameraActive ? '关闭摄像头' : '开启摄像头' }}
              </el-button>
            </div>
            <!-- 视频预览区域 -->
            <div v-if="localCameraActive" class="camera-preview-area">
              <video ref="videoRef" autoplay playsinline muted class="camera-video"></video>
              <canvas ref="canvasRef" class="camera-canvas" style="display:none"></canvas>
            </div>
            <div v-else class="camera-preview-placeholder">
              <el-icon :size="48" color="#999">
                <VideoCamera />
              </el-icon>
              <p>摄像头未开启</p>
              <p class="camera-hint">仅使用语音进行对话</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoCamera, VideoCameraFilled } from '@element-plus/icons-vue'
import { useCamera } from '../../../composables/useCamera'

/**
 * 帧数据接口
 */
interface FrameData {
  /** Base64 数据 URL */
  dataUrl: string
  /** MIME 类型 */
  mimeType: string
}

const props = withDefaults(defineProps<{
  /** 音视频模式是否启用（v-model） */
  modelValue?: boolean
}>(), {
  modelValue: false,
})

const emit = defineEmits<{
  /** 音视频模式状态变更 */
  'update:modelValue': [value: boolean]
  /** 帧捕获事件 */
  'frame-capture': [frame: FrameData]
  /** 摄像头激活状态变更 */
  'update:camera-active': [value: boolean]
}>()

/** 面板是否可见 */
const visible = ref(false)
/** 摄像头是否已开启（本地状态） */
const localCameraActive = ref(false)

/** 视频元素引用 */
const videoRef = ref<HTMLVideoElement | null>(null)
/** Canvas 元素引用 */
const canvasRef = ref<HTMLCanvasElement | null>(null)

/** 摄像头 Composables */
const camera = useCamera({
  hashSize: 8,
  similarityThreshold: 0.95,
  frameQuality: 0.7,
})

/** 帧捕获定时器 */
let frameTimer: ReturnType<typeof setInterval> | null = null

/* ====== 弹窗拖拽 ====== */
/** 弹窗累计偏移量 */
const panelOffsetX = ref(0)
const panelOffsetY = ref(0)
/** 是否正在拖拽 */
const isDragging = ref(false)
/** 拖拽起始位置 */
let dragStartX = 0
let dragStartY = 0
/** 拖拽起始偏移量（用于累加） */
let dragOriginX = 0
let dragOriginY = 0

/**
 * 拖拽开始（在 header 上 mousedown）
 * @param e 鼠标事件
 */
const handlePanelDragStart = (e: MouseEvent) => {
  if (e.button !== 0 || (e.target as HTMLElement)?.closest('button, input, .el-button')) return
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOriginX = panelOffsetX.value
  dragOriginY = panelOffsetY.value
  document.addEventListener('mousemove', handlePanelDragMove)
  document.addEventListener('mouseup', handlePanelDragEnd)
}

/** 拖拽移动 */
const handlePanelDragMove = (e: MouseEvent) => {
  panelOffsetX.value = dragOriginX + (e.clientX - dragStartX)
  panelOffsetY.value = dragOriginY + (e.clientY - dragStartY)
}

/** 拖拽结束 */
const handlePanelDragEnd = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handlePanelDragMove)
  document.removeEventListener('mouseup', handlePanelDragEnd)
}

/** 组件卸载时清理资源 */
onBeforeUnmount(() => {
  stopCameraPreview()
  handlePanelDragEnd()
})

/**
 * 处理触发按钮点击
 * 三态逻辑：
 * 1. 未激活 → 激活 + 显示面板
 * 2. 已激活且面板可见 → 关闭面板 + 停用
 * 3. 已激活但面板隐藏 → 仅显示面板
 */
const handleTriggerClick = () => {
  if (!props.modelValue) {
    // 未激活：激活并显示面板
    emit('update:modelValue', true)
    visible.value = true
  } else if (visible.value) {
    // 已激活且面板可见：关闭面板并停用
    visible.value = false
    stopCameraPreviewIfNeeded()
    emit('update:modelValue', false)
  } else {
    // 已激活但面板隐藏：仅重新显示面板
    visible.value = true
  }
}

/**
 * 点击遮罩关闭
 */
const handleOverlayClick = () => {
  visible.value = false
  stopCameraPreviewIfNeeded()
  emit('update:modelValue', false)
}

/**
 * 点击关闭按钮
 */
const handleCloseBtnClick = () => {
  visible.value = false
  stopCameraPreviewIfNeeded()
  emit('update:modelValue', false)
}

/**
 * 需要关闭时停止摄像头预览
 */
const stopCameraPreviewIfNeeded = () => {
  if (localCameraActive.value) {
    stopCameraCapture()
    localCameraActive.value = false
    emit('update:camera-active', false)
  }
}

/**
 * 独立开关摄像头（面板内）
 */
const handleCameraToggle = async () => {
  if (localCameraActive.value) {
    stopCameraCapture()
    localCameraActive.value = false
    emit('update:camera-active', false)
  } else {
    localCameraActive.value = true
    emit('update:camera-active', true)
    visible.value = true
    await startCameraPreview()
  }
}

/**
 * 启动摄像头预览
 */
const startCameraPreview = async () => {
  await nextTick()

  if (videoRef.value) {
    camera.setVideoElement(videoRef.value)
  }
  if (canvasRef.value) {
    camera.setCanvasElement(canvasRef.value)
  }

  const success = await camera.startCamera({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: true,
  })

  if (success) {
    startFrameCapture()
  } else {
    localCameraActive.value = false
    emit('update:camera-active', false)
    ElMessage.error(camera.error.value || '摄像头启动失败，请检查权限')
  }
}

/**
 * 停止摄像头捕获
 */
const stopCameraCapture = () => {
  stopFrameCapture()
  camera.stopCamera()
}

/**
 * 停止摄像头预览（关闭面板时）
 */
const stopCameraPreview = () => {
  stopCameraCapture()
}

/**
 * 启动定时帧捕获
 */
const startFrameCapture = () => {
  stopFrameCapture()
  frameTimer = setInterval(() => {
    const frame = camera.captureFrame()
    if (frame) {
      emit('frame-capture', frame)
    }
  }, 2000)
}

/**
 * 停止定时帧捕获
 */
const stopFrameCapture = () => {
  if (frameTimer) {
    clearInterval(frameTimer)
    frameTimer = null
  }
}
</script>

<style lang="scss" scoped>
/* ========== 触发按钮 ========== */
.av-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-tertiary, #999);

  &:hover {
    background: var(--bg-tertiary, #f5f5f5);
    color: var(--primary-color, #409eff);
  }

  &.active {
    color: var(--primary-color, #409eff);
  }
}

.av-trigger-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary, #999);
  border: 2px solid var(--white, #fff);
  transition: all 0.2s ease;

  &.active {
    background: #67c23a;
    box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
  }
}

/* ========== 摄像头控制面板 ========== */
.video-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: transparent;
  pointer-events: none;
  padding-bottom: 16px;
}

.video-sheet-panel {
  width: 100%;
  max-width: 480px;
  background: var(--white);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  margin: 0 12px;
  pointer-events: auto;
  will-change: transform;
}

.video-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
}

.video-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.video-sheet-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.video-sheet-body {
  position: relative;
  background: var(--bg-color, #f5f7fa);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}

/* 摄像头控制行（弹窗内开关按钮） */
.camera-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-color, #f5f7fa);
  box-sizing: border-box;
}

.camera-control-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

/* 摄像头未开启时的占位提示 */
.camera-preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #999;
  font-size: 14px;
  flex: 1;
  min-height: 240px;
}

.camera-preview-placeholder p {
  margin: 0;
}

.camera-hint {
  font-size: 12px;
  opacity: 0.7;
}

.camera-preview-area {
  width: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 0 0 16px 16px;
}

.camera-canvas {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.video-sheet-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.video-sheet-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.video-sheet-enter-from,
.video-sheet-leave-to {
  opacity: 0;

  .video-sheet-panel {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
}

.video-sheet-enter-to,
.video-sheet-leave-from {
  opacity: 1;
}
</style>
