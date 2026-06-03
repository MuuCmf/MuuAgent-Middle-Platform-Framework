import { ref, readonly } from 'vue';

/**
 * 简易感知哈希（Average Hash）
 * 将图像缩放到 w×h 并转换为灰度，生成二进制哈希用于帧去重
 * 
 * @param imageData Canvas 图像数据
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 二进制哈希字符串，每位表示像素是否高于平均值
 */
function averageHash(imageData: ImageData, width: number, height: number): string {
  const pixels = imageData.data;
  const grayValues: number[] = [];

  for (let i = 0; i < pixels.length; i += 4) {
    // 加权灰度转换：R*0.299 + G*0.587 + B*0.114
    const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    grayValues.push(gray);
  }

  const avg = grayValues.reduce((sum, v) => sum + v, 0) / grayValues.length;
  return grayValues.map((v) => (v >= avg ? '1' : '0')).join('');
}

/**
 * 计算两个哈希之间的汉明距离（即不同位的数量）
 * 
 * @param hash1 哈希字符串1
 * @param hash2 哈希字符串2
 * @returns 汉明距离，0 表示完全相同
 */
function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

/**
 * 帧去重配置
 */
export interface FrameDedupConfig {
  /** 哈希大小（建议 8-16），越大越精确但计算越慢，默认 8 */
  hashSize?: number;
  /** 相似度阈值 (0-1)，两帧相似度高于此值时视为同一帧而跳过，默认 0.95 */
  similarityThreshold?: number;
  /** 最小帧间隔（ms），同一场景至少间隔此时间才会发送新帧，默认 1000 */
  minFrameInterval?: number;
  /** 帧 JPEG 质量 (0-1)，默认 0.7 */
  frameQuality?: number;
}

/**
 * 摄像头帧捕获 Composable
 * 负责摄像头管理、帧捕获、帧去重
 * 
 * 帧去重策略：
 * 1. 计算当前帧的感知哈希（Average Hash）
 * 2. 对比上一帧哈希的汉明距离
 * 3. 相似度 >= 阈值 → 跳过（画面无显著变化）
 * 4. 距上次发送 < minFrameInterval → 跳过（防止高频发送）
 * 5. 通过上述检查 → 输出帧 Base64
 * 
 * @param config 帧去重配置
 */
export function useCamera(config: FrameDedupConfig = {}) {
  const {
    hashSize = 8,
    similarityThreshold = 0.95,
    minFrameInterval = 1000,
    frameQuality = 0.7,
  } = config;

  /** 摄像头媒体流 */
  const stream = ref<MediaStream | null>(null);
  /** 是否正在捕获 */
  const isCapturing = ref(false);
  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 上一帧的感知哈希 */
  let lastFrameHash = '';
  /** 上一帧的发送时间戳 */
  let lastFrameTime = 0;
  /** 视频元素引用 */
  let videoElement: HTMLVideoElement | null = null;
  /** Canvas 元素引用 */
  let canvasElement: HTMLCanvasElement | null = null;

  /**
   * 启动摄像头
   * 
   * @param constraints 媒体约束，默认 640×480 前置摄像头
   * @returns 是否成功启动
   */
  async function startCamera(
    constraints: MediaStreamConstraints = {
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    },
  ): Promise<boolean> {
    try {
      stream.value = await navigator.mediaDevices.getUserMedia(constraints);
      isCapturing.value = true;
      error.value = null;

      // 如果有关联的 video 元素，自动绑定流
      if (videoElement) {
        videoElement.srcObject = stream.value;
      }

      // 重置去重状态
      lastFrameHash = '';
      lastFrameTime = 0;

      return true;
    } catch (err: any) {
      error.value = `摄像头启动失败: ${err.message || err}`;
      isCapturing.value = false;
      return false;
    }
  }

  /**
   * 停止摄像头并释放资源
   */
  function stopCamera(): void {
    if (stream.value) {
      stream.value.getTracks().forEach((track) => track.stop());
      stream.value = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
    isCapturing.value = false;
    lastFrameHash = '';
    lastFrameTime = 0;
  }

  /**
   * 设置视频元素（用于显示摄像头预览）
   * 
   * @param video 视频元素
   */
  function setVideoElement(video: HTMLVideoElement): void {
    videoElement = video;
    if (stream.value) {
      video.srcObject = stream.value;
    }
  }

  /**
   * 设置 Canvas 元素（用于帧捕获）
   * 
   * @param canvas Canvas 元素
   */
  function setCanvasElement(canvas: HTMLCanvasElement): void {
    canvasElement = canvas;
  }

  /**
   * 捕获当前帧（含去重逻辑）
   * 每次调用会判断当前画面与上一帧的相似度，
   * 无显著变化或过于频繁则返回 null
   * 
   * @returns 当前帧数据，无变化时返回 null
   */
  function captureFrame(): { dataUrl: string; mimeType: string } | null {
    if (!videoElement || !canvasElement) {
      error.value = '视频或 Canvas 元素未设置';
      return null;
    }

    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      error.value = '无法获取 Canvas 2D 上下文';
      return null;
    }

    const videoWidth = videoElement.videoWidth || 640;
    const videoHeight = videoElement.videoHeight || 480;

    // 绘制视频帧到 Canvas
    canvasElement.width = videoWidth;
    canvasElement.height = videoHeight;
    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    // 缩小到 hashSize×hashSize 用于计算感知哈希
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = hashSize;
    smallCanvas.height = hashSize;
    const smallCtx = smallCanvas.getContext('2d');
    if (!smallCtx) return null;
    smallCtx.drawImage(canvasElement, 0, 0, hashSize, hashSize);

    const imageData = smallCtx.getImageData(0, 0, hashSize, hashSize);
    const currentHash = averageHash(imageData, hashSize, hashSize);
    const now = Date.now();

    // 帧去重检查
    if (lastFrameHash) {
      const distance = hammingDistance(currentHash, lastFrameHash);
      const similarity = 1 - distance / (hashSize * hashSize);

      if (similarity >= similarityThreshold) {
        // 画面无显著变化，跳过
        return null;
      }

      if (now - lastFrameTime < minFrameInterval) {
        // 距上次发送太近，跳过
        return null;
      }
    }

    // 更新去重状态
    lastFrameHash = currentHash;
    lastFrameTime = now;

    const mimeType = 'image/jpeg';
    const dataUrl = canvasElement.toDataURL(mimeType, frameQuality);
    return { dataUrl, mimeType };
  }

  return {
    stream: readonly(stream),
    isCapturing: readonly(isCapturing),
    error: readonly(error),
    startCamera,
    stopCamera,
    captureFrame,
    setVideoElement,
    setCanvasElement,
  };
}