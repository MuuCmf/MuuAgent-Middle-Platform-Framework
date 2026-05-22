import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from './config'

/**
 * 工作区工具结果载荷
 * 用于将客户端执行结果回传给服务端
 */
export interface WorkspaceToolResultPayload {
  callId: string
  success: boolean
  result?: unknown
  error?: string
}

/**
 * 提交工作目录工具执行结果
 * @param conversationId 会话ID
 * @param result 工具执行结果
 * @returns {Promise<void>}
 */
export async function submitWorkspaceResult(
  conversationId: string,
  result: WorkspaceToolResultPayload,
): Promise<void> {
  const response = await httpClient.getInstance().post(
    `${API_ENDPOINTS.agents}/chat/workspace-result`,
    {
      conversationId,
      ...result,
    },
  )
  
  if (response.data?.code !== 200) {
    throw new Error(response.data?.message || '提交工作目录结果失败')
  }
}