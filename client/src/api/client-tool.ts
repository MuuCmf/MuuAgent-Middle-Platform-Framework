import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from './config'

/**
 * 客户端工具执行结果载荷
 * 所有客户端工具模块统一使用此结构回传结果
 */
export interface ClientToolResultPayload {
  /** 会话ID */
  conversationId: string
  /** 调用ID */
  callId: string
  /** 是否成功 */
  success: boolean
  /** 执行结果 */
  result?: unknown
  /** 错误信息 */
  error?: string
}

/**
 * 统一提交客户端工具执行结果
 * 所有客户端工具（workspace、system_control 等）统一使用此接口回传结果
 * @param result 工具执行结果
 * @returns {Promise<void>}
 */
export async function submitClientToolResult(
  result: ClientToolResultPayload,
): Promise<void> {
  const response = await httpClient.getInstance().post(
    `${API_ENDPOINTS.agents}/chat/client-tool-result`,
    result,
  )

  if (response.data?.code !== 200) {
    throw new Error(response.data?.message || '提交客户端工具结果失败')
  }
}
