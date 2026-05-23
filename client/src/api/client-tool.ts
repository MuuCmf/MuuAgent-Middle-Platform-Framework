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
 * 动态客户端工具定义（含执行配置）
 */
export interface DynamicClientToolDefinition {
  /** 工具名称 */
  name: string
  /** 显示名称 */
  displayName: string | null
  /** 工具描述 */
  description: string
  /** 参数 JSON Schema */
  parameters: Record<string, unknown>
  /** 执行模板类型 */
  executorType: string
  /** 执行模板配置 */
  executorConfig: Record<string, unknown>
  /** 确认模式 */
  confirmMode: string
  /** 确认消息 */
  confirmMessage: string | null
  /** 超时时间 */
  timeout: number
}

/**
 * 统一提交客户端工具执行结果
 * 所有客户端工具（workspace 等）统一使用此接口回传结果
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

/**
 * 从服务端同步动态客户端工具定义
 * @param appCode 应用标识
 * @param uid 用户ID
 * @returns {Promise<DynamicClientToolDefinition[]>} 工具定义列表
 */
export async function syncDynamicClientTools(
  appCode?: string,
  uid?: string,
): Promise<DynamicClientToolDefinition[]> {
  const params: Record<string, string> = {}
  if (appCode) params.appCode = appCode
  if (uid) params.uid = uid
  const response = await httpClient.getInstance().get(
    `${API_ENDPOINTS.agents}/dynamic-client-tools/client/sync`,
    { params },
  )

  if (response.data?.code === 200) {
    return response.data.data || []
  }

  throw new Error(response.data?.message || '同步动态工具定义失败')
}
