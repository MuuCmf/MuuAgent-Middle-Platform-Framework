<template>
  <el-dialog
    v-model="visible"
    title="语音设置"
    width="400px"
    @close="handleClose"
  >
    <el-form label-width="100px">
      <el-form-item label="自动朗读">
        <el-switch v-model="settings.autoPlay" />
        <div class="form-item-tip">开启后，AI回复完成时自动朗读</div>
      </el-form-item>
      
      <el-form-item label="语音类型">
        <el-select v-model="settings.voiceId" placeholder="选择语音类型" :loading="voicesLoading">
          <el-option
            v-for="voice in voiceOptions"
            :key="voice.voiceId"
            :label="voiceLabel(voice)"
            :value="voice.voiceId"
          />
        </el-select>
        <div class="form-item-tip">选择不同的语音风格</div>
      </el-form-item>
      
      <el-form-item label="语速">
        <el-slider
          v-model="settings.speed"
          :min="0.5"
          :max="2"
          :step="0.1"
          show-input
          :format-tooltip="formatSpeedTooltip"
        />
        <div class="form-item-tip">调整语音播放速度（0.5-2.0）</div>
      </el-form-item>
      
      <el-form-item label="音量">
        <el-slider
          v-model="settings.volume"
          :min="0"
          :max="1"
          :step="0.1"
          show-input
          :format-tooltip="formatVolumeTooltip"
        />
        <div class="form-item-tip">调整音频播放音量（0-1）</div>
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave">保存设置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { voiceService, type VoiceProfileItem } from '../../../services/VoiceService';

const visible = ref(false);
const settings = reactive(voiceService.getConfig());

/** 语音选项列表 */
const voiceOptions = ref<VoiceProfileItem[]>([]);
const voicesLoading = ref(false);

/**
 * 获取语音配置显示标签
 * @param voice 语音配置
 * @returns {string} 显示标签
 */
function voiceLabel(voice: VoiceProfileItem): string {
  const genderMap: Record<string, string> = {
    male: '男声',
    female: '女声',
    neutral: '中性',
  }
  const gender = voice.gender ? ` (${genderMap[voice.gender] || voice.gender})` : ''
  return `${voice.name}${gender} - ${voice.provider}`
}

/**
 * 格式化语速提示
 * @param val 语速值
 * @returns {string} 格式化后的提示文本
 */
function formatSpeedTooltip(val: number): string {
  return `语速: ${val.toFixed(1)}`;
}

/**
 * 格式化音量提示
 * @param val 音量值
 * @returns {string} 格式化后的提示文本
 */
function formatVolumeTooltip(val: number): string {
  return `音量: ${Math.round(val * 100)}%`;
}

/**
 * 保存设置
 */
function handleSave() {
  voiceService.updateConfig(settings);
  ElMessage.success('语音设置已保存');
  visible.value = false;
}

/**
 * 关闭对话框
 */
function handleClose() {
  visible.value = false;
}

/**
 * 打开设置面板
 */
async function open() {
  Object.assign(settings, voiceService.getConfig());
  voicesLoading.value = true;
  voiceOptions.value = await voiceService.getAvailableVoices();
  voicesLoading.value = false;
  visible.value = true;
}

defineExpose({ open });
</script>

<style lang="scss" scoped>
.form-item-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.el-slider {
  margin-top: 8px;
}

.el-select {
  width: 100%;
}
</style>