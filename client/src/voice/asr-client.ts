/**
 * 语音识别客户端（渲染进程侧）
 * 使用浏览器原生 WebSocket 连接后端 ASR 接口
 */
export class AsrClient {
  /** WebSocket 连接实例 */
  private ws: WebSocket | null = null

  /**
   * 连接后端 ASR WebSocket 接口
   * @param url 后端 ASR WebSocket 地址
   * @param onResult 识别结果回调
   */
  connect(url: string, onResult: (text: string, isFinal: boolean) => void): void {
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('[ASR] WebSocket 连接已建立')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        onResult(data.text || '', data.isFinal ?? false)
      } catch (e) {
        console.error('[ASR] 解析识别结果失败:', e)
      }
    }

    this.ws.onerror = (error) => {
      console.error('[ASR] WebSocket 错误:', error)
    }

    this.ws.onclose = () => {
      console.log('[ASR] WebSocket 连接已关闭')
      this.ws = null
    }
  }

  /**
   * 发送音频数据帧
   * @param audioData PCM 音频数据
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData)
    }
  }

  /** 断开连接 */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /** 是否已连接 */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
