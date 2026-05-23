import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from '../api/config'
import { clientToolRouter } from '../executor/client-tool-router'
import { dynamicPluginRegistry } from '../executor/dynamic-plugin-registry'
import { getUid } from '../utils/auth'

/**
 * 客户端工具执行结果载荷
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
 * 动态客户端工具定义
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
 * 客户端工具服务
 * 封装客户端工具相关的API调用和工具注册逻辑
 */
export class ClientToolService {
  /**
   * 提交客户端工具执行结果
   * @param result 工具执行结果
   */
  async submitResult(result: ClientToolResultPayload): Promise<void> {
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
   * @returns 工具定义列表
   */
  async syncDynamicTools(
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

  /**
   * 同步动态工具定义到插件注册表
   * @param appCode 应用标识
   * @param uid 用户ID
   */
  async syncToRegistry(appCode?: string, uid?: string): Promise<void> {
    try {
      const effectiveUid = uid || getUid() || undefined
      const definitions = await this.syncDynamicTools(appCode, effectiveUid)
      dynamicPluginRegistry.sync(
        definitions.map((d) => ({
          name: d.name,
          displayName: d.displayName || undefined,
          description: d.description,
          parameters: d.parameters,
          executorType: d.executorType as 'http_request' | 'script' | 'command',
          executorConfig: d.executorConfig,
          confirmMode: d.confirmMode as 'auto' | 'confirm' | 'deny',
          confirmMessage: d.confirmMessage || undefined,
          timeout: d.timeout,
        })),
      )
    } catch (e) {
      console.warn('[ClientToolService] 同步动态工具定义失败:', e)
    }
  }

  /**
   * 获取所有客户端工具权限策略
   * @returns 策略列表
   */
  getAllPolicies() {
    return clientToolRouter.getAllPolicies()
  }

  /**
   * 更新客户端工具权限策略
   * @param policies 策略列表
   */
  updatePolicies(policies: import('../executor/types').ClientToolModulePolicy[]) {
    clientToolRouter.updatePolicies(policies)
  }

  /**
   * 处理客户端工具调用
   * @param call 工具调用载荷
   * @param confirmFn 确认函数
   * @param conversationId 会话ID
   * @returns 执行结果
   */
  async handleCall(
    call: import('../api/stream').ClientToolCallPayload,
    confirmFn: (message: string) => Promise<boolean>,
    conversationId?: string | null,
  ) {
    return clientToolRouter.handleCall(call, confirmFn, conversationId)
  }
}

/** 客户端工具服务实例 */
export const clientToolService = new ClientToolService()
