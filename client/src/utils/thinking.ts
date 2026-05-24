import type { Message } from '../api/types'

/**
 * 思考内容标记模式配置
 */
const THINKING_PATTERNS = [
  { thinking: '[THINKING]', answer: '[ANSWER]' },
  { thinking: '[思考]', answer: '[回答]' },
] as const

/**
 * 处理流式消息中的思考内容和答案内容分割
 * 当消息中包含 [THINKING]/[ANSWER] 或 [思考]/[回答] 标记时，
 * 自动将内容分割到 thinkingContent 和 content 字段，
 * 同时同步更新 contentBlocks 以避免原始标记泄漏到渲染输出中
 * @param msg 消息对象（会被原地修改）
 * @param chunk 新接收的内容片段
 */
export function processThinkingContent(msg: Message, chunk: string): void {
  const hadThinkingContent = !!msg.thinkingContent
  msg.content += chunk

  for (const { thinking: thinkingTag, answer: answerTag } of THINKING_PATTERNS) {
    const thinkingIndex = msg.content.indexOf(thinkingTag)
    const answerIndex = msg.content.indexOf(answerTag)

    if (thinkingIndex !== -1 && answerIndex !== -1 && answerIndex > thinkingIndex) {
      const thinkingContent = msg.content.substring(thinkingIndex + thinkingTag.length, answerIndex).trim()
      const answerContent = msg.content.substring(answerIndex + answerTag.length).trim()
      const beforeThinking = msg.content.substring(0, thinkingIndex).trim()

      msg.thinkingContent = thinkingContent
      msg.content = beforeThinking + (beforeThinking && answerContent ? '\n\n' : '') + answerContent

      // 首次分离时同步更新 contentBlocks，避免 [THINKING]...[ANSWER] 标记泄漏到渲染
      if (!hadThinkingContent && msg.contentBlocks && msg.contentBlocks.length > 0) {
        const textBlock = msg.contentBlocks.find(b => b.type === 'text')
        if (textBlock) {
          textBlock.content = msg.content
        }
        // 插入 thinking 块到 text 块之前
        const textIdx = msg.contentBlocks.findIndex(b => b.type === 'text')
        const thinkingBlock = {
          type: 'thinking' as const,
          index: textIdx >= 0 ? textIdx : 0,
          content: thinkingContent,
          toolStatus: 'completed' as const,
        }
        if (textIdx >= 0) {
          msg.contentBlocks.splice(textIdx, 0, thinkingBlock)
        } else {
          msg.contentBlocks.unshift(thinkingBlock)
        }
      }
      return
    }
  }
}

/**
 * 思考模式系统提示词
 */
export const THINKING_SYSTEM_PROMPT = `请按照以下格式回答问题：
[THINKING]
你的思考过程和分析
[ANSWER]
正式回答内容

注意：
1. [THINKING] 部分写出你的思考过程
2. [ANSWER] 部分给出正式回答
3. 必须严格按照这个格式输出`