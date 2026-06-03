import { ref, readonly } from 'vue';

/**
 * 录音状态
 */
export type RecorderStatus = 'idle' | 'recording' | 'paused';

/**
 * 录音结果
 */
export interface AudioRecordingResult {
  /** Base64 编码的音频数据 */
  audioBase64: string;
  /** 音频 MIME 类型，如 'audio/webm' */
  mimeType: string;
  /** 录音时长（毫秒） */
  duration: number;
  /** 音频 Blob */
  blob: Blob;
}

/**
 * 录音配置
 */
export interface AudioRecorderConfig {
  /** 音频 MIME 类型，默认由浏览器自动选择 */
  mimeType?: string;
  /** 音频比特率（bps），默认 128000 */
  audioBitsPerSecond?: number;
  /** 最大录音时长（ms），超过自动停止，0 表示不限，默认 60000 */
  maxDuration?: number;
  /** 是否在浏览器不支持时静默失败，默认 false */
  silentOnUnsupported?: boolean;
}

/**
 * 浏览器音频录制 Composable
 *
 * 使用 MediaRecorder API 捕获麦克风音频，
 * 输出 Base64 编码的音频数据供后端 ASR 接口使用。
 *
 * 支持：
 * - 开始/暂停/恢复/停止录制
 * - 最大时长自动停止
 * - 录音时长统计
 * - 音频可视化（音量电平）
 *
 * @param config 录音配置
 */
export function useAudioRecorder(config: AudioRecorderConfig = {}) {
  const {
    mimeType: preferredMimeType,
    audioBitsPerSecond = 128000,
    maxDuration = 60000,
    silentOnUnsupported = false,
  } = config;

  /** 录音状态 */
  const status = ref<RecorderStatus>('idle');
  /** 错误信息 */
  const error = ref<string | null>(null);
  /** 当前录音时长（ms） */
  const duration = ref(0);
  /** 音量电平 (0-1) */
  const audioLevel = ref(0);

  /** 浏览器是否支持录音 */
  const isSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && !!navigator.mediaDevices.getUserMedia
    && typeof MediaRecorder !== 'undefined';

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let audioChunks: Blob[] = [];
  let startTime = 0;
  let durationTimer: ReturnType<typeof setInterval> | null = null;
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let animationFrameId: number | null = null;

  /**
   * 获取浏览器支持的 MIME 类型
   * 优先选择 webm/opus，其次 webm，最后使用浏览器默认
   * 
   * @returns 支持的 MIME 类型
   */
  function getSupportedMimeType(): string {
    if (preferredMimeType && MediaRecorder.isTypeSupported(preferredMimeType)) {
      return preferredMimeType;
    }
    // webm + opus 是 Chrome 的默认格式，也支持 Whisper
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return 'audio/webm';
    }
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return 'audio/mp4';
    }
    return ''; // 使用浏览器默认
  }

  /**
   * 清理资源
   */
  function cleanup(): void {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
      analyser = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    mediaRecorder = null;
    audioChunks = [];
  }

  /**
   * 更新音量电平（通过 AnalyserNode 分析音频数据）
   */
  function updateAudioLevel(): void {
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    audioLevel.value = Math.min(sum / dataArray.length / 128, 1);
    animationFrameId = requestAnimationFrame(updateAudioLevel);
  }

  /**
   * 开始录音
   * 
   * @returns 是否成功开始
   */
  async function startRecording(): Promise<boolean> {
    if (!isSupported) {
      const msg = '当前浏览器不支持录音功能';
      if (!silentOnUnsupported) {
        error.value = msg;
      }
      return false;
    }

    try {
      // 请求麦克风权限并获取音频流
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 设置音频分析器用于音量可视化
      try {
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        updateAudioLevel();
      } catch {
        // 音频分析失败不影响录音
      }

      const mimeType = getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond,
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      mediaRecorder = new MediaRecorder(mediaStream, recorderOptions);

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        error.value = '录音过程中发生错误';
        stopRecording();
      };

      // 开始录音，每秒收集一次数据
      mediaRecorder.start(1000);
      startTime = Date.now();
      status.value = 'recording';
      error.value = null;

      // 启动时长计时器
      durationTimer = setInterval(() => {
        duration.value = Date.now() - startTime;
      }, 100);

      // 设置最大时长自动停止
      if (maxDuration > 0) {
        maxDurationTimer = setTimeout(() => {
          if (status.value === 'recording') {
            stopRecording();
          }
        }, maxDuration);
      }

      return true;
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? '麦克风权限被拒绝'
        : `录音启动失败: ${err.message || err}`;
      error.value = msg;
      cleanup();
      return false;
    }
  }

  /**
   * 暂停录音
   */
  function pauseRecording(): void {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      status.value = 'paused';
      if (durationTimer) {
        clearInterval(durationTimer);
        durationTimer = null;
      }
    }
  }

  /**
   * 恢复录音
   */
  function resumeRecording(): void {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      status.value = 'recording';
      duration.value = Date.now() - startTime;
      durationTimer = setInterval(() => {
        duration.value = Date.now() - startTime;
      }, 100);
    }
  }

  /**
   * 停止录音并返回音频数据
   * 
   * @returns 录音结果，包含 Base64 音频数据
   */
  async function stopRecording(): Promise<AudioRecordingResult | null> {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return null;
    }

    return new Promise((resolve) => {
      mediaRecorder!.addEventListener('stop', async () => {
        const actualDuration = Date.now() - startTime;
        const mimeType = mediaRecorder!.mimeType || 'audio/webm';

        status.value = 'idle';
        duration.value = 0;
        audioLevel.value = 0;

        if (audioChunks.length === 0) {
          cleanup();
          resolve(null);
          return;
        }

        // 合并所有音频块
        const audioBlob = new Blob(audioChunks, { type: mimeType });

        // 转换为 Base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = uint8ArrayToBase64(uint8Array);

        cleanup();

        resolve({
          audioBase64: base64,
          mimeType,
          duration: actualDuration,
          blob: audioBlob,
        });
      }, { once: true });

      mediaRecorder!.stop();
    });
  }

  /**
   * 取消录音（不返回数据）
   */
  function cancelRecording(): void {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.ondataavailable = null; // 防止最后一次 dataavailable 被收集
    }
    status.value = 'idle';
    duration.value = 0;
    audioLevel.value = 0;
    cleanup();
  }

  return {
    status: readonly(status),
    error: readonly(error),
    duration: readonly(duration),
    audioLevel: readonly(audioLevel),
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  };
}

/**
 * Uint8Array 转 Base64 字符串
 * 使用分块处理避免栈溢出
 * 
 * @param buffer 字节数组
 * @returns Base64 编码字符串
 */
function uint8ArrayToBase64(buffer: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks: string[] = [];
  for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
    const chunk = buffer.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return btoa(chunks.join(''));
}