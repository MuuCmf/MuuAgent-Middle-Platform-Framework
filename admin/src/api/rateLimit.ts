import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 限流级别枚举
 */
export enum RateLimitLevel {
  GLOBAL = 'global',
  APP = 'app',
  INTERFACE = 'interface',
  MODEL = 'model'
}

/**
 * 限流规则接口
 */
export interface RateLimitRule {
  id: string
  level: string
  target: string
  qpsLimit: number
  concurrentLimit: number
  dailyLimit: number
  burstSize: number
  enableQueue: boolean
  queueSize: number
  queueTimeout: number
  status: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 限流规则表单接口
 */
export interface RateLimitRuleForm {
  level: string
  target: string
  qpsLimit: number
  concurrentLimit: number
  dailyLimit: number
  burstSize: number
  enableQueue: boolean
  queueSize: number
  queueTimeout: number
}

/**
 * 限流统计接口
 */
export interface RateLimitStatistics {
  level: string
  target: string
  qpsLimit: number
  concurrentLimit: number
  dailyLimit: number
  currentQps: number
  currentConcurrent: number
  todayCount: number
}

/**
 * 黑名单接口
 */
export interface BlacklistItem {
  clientIp: string
  reason: string
  duration: number
}

/**
 * 熔断规则接口
 */
export interface ModelRoutingRule {
  id: string
  modelId: string
  qpsLimit: number
  maxConcurrent: number
  currentConcurrent: number
  circuitStatus: string
  errorCount: number
  lastErrorTime?: string
  circuitOpenTime?: string
  createdAt: string
  updatedAt: string
  model?: {
    name: string
    code: string
  }
}

/**
 * 熔断规则表单接口
 */
export interface ModelRoutingRuleForm {
  modelId: string
  qpsLimit: number
  maxConcurrent: number
}

/**
 * 熔断状态接口
 */
export interface ModelRoutingStatus {
  modelId: string
  modelCode: string
  modelName: string
  status: boolean
  circuitStatus: string
  errorCount: number
  currentConcurrent: number
  maxConcurrent: number
  qpsLimit: number
  lastErrorTime?: string
  circuitOpenTime?: string
  nextRetryTime?: string
  successCount: number
  failureCount: number
}

/**
 * 限流API
 */
export const rateLimitApi = {
  /**
   * 获取所有限流规则
   */
  getRules(): Promise<AxiosResponse<{ data: RateLimitRule[] }>> {
    return adminRequest.get('api/admin/rate-limit/rules')
  },

  /**
   * 创建或更新限流规则
   */
  upsertRule(data: RateLimitRuleForm): Promise<AxiosResponse> {
    return adminRequest.post('api/admin/rate-limit/rule', data)
  },

  /**
   * 获取限流统计信息
   */
  getStatistics(): Promise<AxiosResponse<{ data: RateLimitStatistics[] }>> {
    return adminRequest.get('api/admin/rate-limit/statistics')
  },

  /**
   * 添加IP到黑名单
   */
  addToBlacklist(data: BlacklistItem): Promise<AxiosResponse> {
    return adminRequest.post('api/admin/rate-limit/blacklist', data)
  },

  /**
   * 初始化默认限流规则
   */
  initDefaultRules(): Promise<AxiosResponse> {
    return adminRequest.post('api/admin/rate-limit/init')
  }
}

/**
 * 熔断API
 */
export const circuitBreakerApi = {
  /**
   * 获取所有熔断规则
   */
  getRules(): Promise<AxiosResponse<{ data: ModelRoutingRule[] }>> {
    return adminRequest.get('api/admin/model-routing/rules')
  },

  /**
   * 创建或更新熔断规则
   */
  upsertRule(data: ModelRoutingRuleForm): Promise<AxiosResponse> {
    return adminRequest.post('api/admin/model-routing/rule', data)
  },

  /**
   * 删除熔断规则
   * @param modelId 模型ID
   */
  deleteRule(modelId: string): Promise<AxiosResponse> {
    return adminRequest.delete(`api/admin/model-routing/rule/${modelId}`)
  },

  /**
   * 获取熔断状态
   */
  getStatus(): Promise<AxiosResponse<{ data: ModelRoutingStatus[] }>> {
    return adminRequest.get('api/admin/model-routing/status')
  },

  /**
   * 重置熔断状态
   */
  resetStatus(modelId: string): Promise<AxiosResponse> {
    return adminRequest.post(`api/admin/model-routing/circuit/reset/${modelId}`)
  }
}
