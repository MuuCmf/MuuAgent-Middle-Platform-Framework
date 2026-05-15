<template>
  <div class="file-config-editor">
    <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
      <template #title>
        <div style="display: flex; align-items: center; gap: 8px;">
          <el-icon><Document /></el-icon>
          <span>文件操作技能配置</span>
        </div>
      </template>
      <div style="margin-top: 8px; font-size: 13px;">
        文件操作技能允许智能体通过技能系统操作文件，包括上传、下载、处理等操作。
      </div>
    </el-alert>

    <el-form-item label="允许的操作">
      <el-checkbox-group v-model="allowedActions">
        <el-checkbox label="upload">上传文件</el-checkbox>
        <el-checkbox label="download">下载文件</el-checkbox>
        <el-checkbox label="delete">删除文件</el-checkbox>
        <el-checkbox label="list">查询列表</el-checkbox>
        <el-checkbox label="info">文件信息</el-checkbox>
        <el-checkbox label="exists">存在检查</el-checkbox>
        <el-checkbox label="process">文件处理</el-checkbox>
      </el-checkbox-group>
      <div class="field-tip">选择智能体可以执行的文件操作类型</div>
    </el-form-item>

    <el-form-item label="允许的处理类型" v-if="allowedActions.includes('process')">
      <el-checkbox-group v-model="allowedProcessTypes">
        <el-checkbox label="compress">压缩</el-checkbox>
        <el-checkbox label="convert">格式转换</el-checkbox>
        <el-checkbox label="resize">缩放</el-checkbox>
        <el-checkbox label="crop">裁剪</el-checkbox>
        <el-checkbox label="watermark">水印</el-checkbox>
        <el-checkbox label="thumbnail">缩略图</el-checkbox>
      </el-checkbox-group>
      <div class="field-tip">选择智能体可以执行的文件处理类型</div>
    </el-form-item>

    <el-form-item label="文件大小限制">
      <el-input-number v-model="maxFileSize" :min="1" :max="100" :step="1" />
      <span style="margin-left: 8px;">MB</span>
      <div class="field-tip">单个文件的最大大小限制（默认10MB）</div>
    </el-form-item>

    <el-form-item label="存储配额">
      <el-input-number v-model="maxStorage" :min="10" :max="10000" :step="10" />
      <span style="margin-left: 8px;">MB</span>
      <div class="field-tip">应用的总存储空间限制（默认100MB）</div>
    </el-form-item>

    <el-form-item label="允许的文件类型">
      <el-select v-model="allowedTypes" multiple placeholder="选择允许的文件类型" style="width: 100%;">
        <el-option label="图片 (image)" value="image" />
        <el-option label="视频 (video)" value="video" />
        <el-option label="音频 (audio)" value="audio" />
        <el-option label="PDF文档 (pdf)" value="pdf" />
        <el-option label="Word文档 (doc)" value="doc" />
        <el-option label="Excel表格 (excel)" value="excel" />
        <el-option label="文本文件 (txt)" value="txt" />
        <el-option label="压缩包 (zip)" value="zip" />
      </el-select>
      <div class="field-tip">留空表示允许所有类型</div>
    </el-form-item>

    <el-form-item label="禁止的扩展名">
      <el-select v-model="deniedExtensions" multiple filterable allow-create placeholder="输入或选择禁止的扩展名" style="width: 100%;">
        <el-option label=".exe" value=".exe" />
        <el-option label=".bat" value=".bat" />
        <el-option label=".sh" value=".sh" />
        <el-option label=".cmd" value=".cmd" />
        <el-option label=".js" value=".js" />
        <el-option label=".vbs" value=".vbs" />
      </el-select>
      <div class="field-tip">禁止上传的文件扩展名（安全考虑）</div>
    </el-form-item>

    <el-form-item label="业务类型">
      <el-select v-model="businessType" placeholder="选择业务类型" style="width: 100%;">
        <el-option label="知识库 (kb)" value="kb" />
        <el-option label="智能体 (agent)" value="agent" />
        <el-option label="工作流 (workflow)" value="workflow" />
        <el-option label="临时文件 (temp)" value="temp" />
        <el-option label="导出文件 (export)" value="export" />
      </el-select>
      <div class="field-tip">文件所属的业务类型，用于分类管理</div>
    </el-form-item>

    <el-form-item label="默认操作">
      <el-select v-model="defaultAction" placeholder="选择默认操作" style="width: 100%;">
        <el-option label="上传" value="upload" />
        <el-option label="下载" value="download" />
        <el-option label="查询列表" value="list" />
        <el-option label="文件信息" value="info" />
        <el-option label="文件处理" value="process" />
      </el-select>
      <div class="field-tip">智能体调用技能时的默认操作</div>
    </el-form-item>

    <el-divider />

    <div class="config-preview">
      <div class="preview-header">
        <span>配置预览</span>
        <el-button size="small" @click="copyConfig">复制配置</el-button>
      </div>
      <pre class="preview-code">{{ configPreview }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'

interface Props {
  config?: string
}

interface Emits {
  (e: 'update:config', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  config: '{}'
})

const emit = defineEmits<Emits>()

const allowedActions = ref<string[]>(['upload', 'download', 'list', 'info', 'process'])
const allowedProcessTypes = ref<string[]>(['compress', 'convert', 'thumbnail'])
const maxFileSize = ref(10)
const maxStorage = ref(100)
const allowedTypes = ref<string[]>(['image', 'pdf', 'doc'])
const deniedExtensions = ref<string[]>(['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'])
const businessType = ref('agent')
const defaultAction = ref('upload')

const configPreview = computed(() => {
  const config: Record<string, any> = {
    allowedActions: allowedActions.value,
    maxFileSize: maxFileSize.value * 1024 * 1024,
    maxStorage: maxStorage.value * 1024 * 1024,
    allowedTypes: allowedTypes.value,
    deniedExtensions: deniedExtensions.value,
    businessType: businessType.value,
    defaultAction: defaultAction.value,
  }

  if (allowedActions.value.includes('process')) {
    config.allowedProcessTypes = allowedProcessTypes.value
  }

  return JSON.stringify(config, null, 2)
})

watch([allowedActions, allowedProcessTypes, maxFileSize, maxStorage, allowedTypes, deniedExtensions, businessType, defaultAction], () => {
  emit('update:config', configPreview.value)
}, { deep: true })

watch(() => props.config, (newVal) => {
  if (newVal) {
    try {
      const config = JSON.parse(newVal)
      allowedActions.value = config.allowedActions || ['upload', 'download', 'list', 'info', 'process']
      allowedProcessTypes.value = config.allowedProcessTypes || ['compress', 'convert', 'thumbnail']
      maxFileSize.value = Math.floor((config.maxFileSize || 10485760) / 1024 / 1024)
      maxStorage.value = Math.floor((config.maxStorage || 104857600) / 1024 / 1024)
      allowedTypes.value = config.allowedTypes || ['image', 'pdf', 'doc']
      deniedExtensions.value = config.deniedExtensions || ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs']
      businessType.value = config.businessType || 'agent'
      defaultAction.value = config.defaultAction || 'upload'
    } catch (error) {
      console.error('解析配置失败:', error)
    }
  }
}, { immediate: true })

const copyConfig = async () => {
  try {
    await navigator.clipboard.writeText(configPreview.value)
    ElMessage.success('配置已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}
</script>

<style lang="scss" scoped>
.file-config-editor {
  .field-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .config-preview {
    margin-top: 16px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f5f7fa;
      border-bottom: 1px solid #dcdfe6;
      font-weight: 500;
    }

    .preview-code {
      margin: 0;
      padding: 12px;
      background: #fafafa;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
    }
  }
}
</style>
