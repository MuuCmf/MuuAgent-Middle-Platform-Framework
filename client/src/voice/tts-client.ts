/**
 * 语音合成客户端（渲染进程侧）
 * 使用浏览器原生 fetch 从后端 TTS 接口获取合成音频
 */
export class TtsClient {
  /**
   * 请求后端 TTS 合成音频
   * @param text 要合成的文本
   * @param url 后端 TTS 接口地址
   * @returns {Promise<ArrayBuffer>} 音频数据
   */
  async synthesize(text: string, url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`TTS 合成失败: ${response.status} ${response.statusText}`)
    }

    return await response.arrayBuffer()
  }
}
