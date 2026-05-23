import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from './config'

/**
 * 系统控制工具结果载荷
 * 用于将客户端执行结果回传给服务端
 */
export interface SystemControlToolResultPayload {
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
 * 提交系统控制工具执行结果
 * @param conversationId 会话ID
 * @param result 工具执行结果
 * @returns {Promise<void>}
 */
export async function submitSystemControlResult(
  conversationId: string,
  result: SystemControlToolResultPayload,
): Promise<void> {
  const response = await httpClient.getInstance().post(
    `${API_ENDPOINTS.agents}/chat/system-control-result`,
    {
      conversationId,
      ...result,
    },
  )

  if (response.data?.code !== 200) {
    throw new Error(response.data?.message || '提交系统控制结果失败')
  }
}
