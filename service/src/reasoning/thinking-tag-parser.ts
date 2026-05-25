/**
 * 思考标签解析段类型
 */
export interface ThinkingSegment {
  /** 段类型：text_delta=文本增量, begin_thinking=进入思考, end_thinking=退出思考 */
  type: 'text_delta' | 'begin_thinking' | 'end_thinking'
  /** 文本内容（仅 text_delta 类型有值） */
  content?: string
}

/**
 * 思考标签解析器
 *
 * 通过状态机解析模型输出中的 <thinking> 和 </thinking> 标签，
 * 将流式文本切分为思考段和回答段。支持标签跨 chunk 局部匹配。
 *
 * 三种状态：
 * - normal: 未进入思考，文本为普通回答
 * - in_thinking: 在 <thinking> 内，文本为思考过程
 * - after_thinking: 在 </thinking> 后，文本为最终回答
 */
export class ThinkingTagParser {
  /** 当前状态机状态 */
  private state: 'normal' | 'in_thinking' | 'after_thinking' = 'normal'

  /** 缓冲区：保存可能包含局部标签匹配的末尾文本 */
  private buffer = ''

  private static readonly OPEN_TAG = '<thinking>'
  private static readonly CLOSE_TAG = '</thinking>'

  /**
   * 处理一个文本块，返回解析后的段列表
   * @param chunk 模型输出的文本块
   * @returns 解析后的段列表
   */
  process(chunk: string): ThinkingSegment[] {
    this.buffer += chunk
    return this.flushBuffer()
  }

  /**
   * 清空所有缓冲区，返回剩余的段
   * 用于流结束或工具调用前确保内容不丢失
   * @returns 剩余段列表
   */
  flush(): ThinkingSegment[] {
    const result = this.flushBuffer()
    if (this.buffer.length > 0) {
      result.push({ type: 'text_delta', content: this.buffer })
      this.buffer = ''
    }
    return result
  }

  /**
   * 重置解析器状态（每次模型调用前调用）
   */
  reset(): void {
    this.state = 'normal'
    this.buffer = ''
  }

  /**
   * 尝试从缓冲区中清出可确定的内容
   * 保留可能的局部标签匹配在缓冲区中
   * @returns 解析出的段列表
   */
  private flushBuffer(): ThinkingSegment[] {
    const segments: ThinkingSegment[] = []

    while (this.buffer.length > 0) {
      if (this.state === 'after_thinking') {
        segments.push({ type: 'text_delta', content: this.buffer })
        this.buffer = ''
        return segments
      }

      if (this.state === 'normal') {
        const idx = this.buffer.indexOf(ThinkingTagParser.OPEN_TAG)
        if (idx === -1) {
          const partialLen = this.partialMatchLen(this.buffer, ThinkingTagParser.OPEN_TAG)
          if (partialLen > 0) {
            const toEmit = this.buffer.substring(0, this.buffer.length - partialLen)
            if (toEmit) segments.push({ type: 'text_delta', content: toEmit })
            this.buffer = this.buffer.substring(this.buffer.length - partialLen)
          } else {
            segments.push({ type: 'text_delta', content: this.buffer })
            this.buffer = ''
          }
          return segments
        }

        const before = this.buffer.substring(0, idx)
        if (before) segments.push({ type: 'text_delta', content: before })
        segments.push({ type: 'begin_thinking' })
        this.buffer = this.buffer.substring(idx + ThinkingTagParser.OPEN_TAG.length)
        this.state = 'in_thinking'
        continue
      }

      if (this.state === 'in_thinking') {
        const idx = this.buffer.indexOf(ThinkingTagParser.CLOSE_TAG)
        if (idx === -1) {
          const partialLen = this.partialMatchLen(this.buffer, ThinkingTagParser.CLOSE_TAG)
          if (partialLen > 0) {
            const toEmit = this.buffer.substring(0, this.buffer.length - partialLen)
            if (toEmit) segments.push({ type: 'text_delta', content: toEmit })
            this.buffer = this.buffer.substring(this.buffer.length - partialLen)
          } else {
            segments.push({ type: 'text_delta', content: this.buffer })
            this.buffer = ''
          }
          return segments
        }

        const before = this.buffer.substring(0, idx)
        if (before) segments.push({ type: 'text_delta', content: before })
        segments.push({ type: 'end_thinking' })
        this.buffer = this.buffer.substring(idx + ThinkingTagParser.CLOSE_TAG.length)
        this.state = 'after_thinking'
        continue
      }
    }

    return segments
  }

  /**
   * 计算缓冲区末尾与目标标签的局部匹配长度
   * 例如 buffer="...<thin" 与 "<thinking>" 匹配长度为 5
   * @param buffer 当前缓冲区内容
   * @param tag 目标标签
   * @returns 匹配长度，0 表示不匹配
   */
  private partialMatchLen(buffer: string, tag: string): number {
    for (let i = tag.length - 1; i > 0; i--) {
      if (buffer.endsWith(tag.substring(0, i))) return i
    }
    return 0
  }
}