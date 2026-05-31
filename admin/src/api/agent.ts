import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

export interface CustomModelParams {
  temperature?: number
  topP?: number
  maxTokens?: number
  contextWindow?: number
}

/**
 * 知识库检索策略
 */
export type KbRetrievalStrategy = 'AUTO' | 'TOOL' | 'HYBRID' | 'DISABLED'

/**
 * 自动检索配置
 */
export interface AutoRetrievalConfig {
  enabled: boolean
  topN?: number
  similarityThresh?: number
  showSources?: boolean
  trigger?: 'always' | 'first_message' | 'keyword'
  keywords?: string[]
}

/**
 * 工具检索配置
 */
export interface ToolRetrievalConfig {
  enabled: boolean
  defaultTopN?: number
  defaultSimilarityThresh?: number
  allowSpecifyKb?: boolean
}

/**
 * 知识库检索配置
 */
export interface KbRetrievalConfig {
  strategy: KbRetrievalStrategy
  autoRetrieval?: AutoRetrievalConfig
  toolRetrieval?: ToolRetrievalConfig
}

export interface Agent {
  id: number
  name: string
  code: string
  description?: string
  systemPrompt: string
  skills: string
  mcpServers?: string
  maxSteps: number
  status: boolean
  sort: number
  modelTemplateCode?: string
  customModelParams?: string
  reasoningMode?: string
  reasoningPrompt?: string
  knowledgeBases?: string
  kbRetrievalConfig?: KbRetrievalConfig | string
  appCode?: string
  isPublic?: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentForm {
  name: string
  code: string
  description?: string
  systemPrompt: string
  skills: string
  mcpServers?: string
  maxSteps: number
  status: boolean
  sort: number
  modelTemplateCode?: string
  customModelParams?: string
  reasoningMode?: string
  reasoningPrompt?: string
  knowledgeBases?: string
  kbRetrievalConfig?: string
  appCode?: string
  isPublic?: boolean
}

export interface AgentListResponse {
  list: Agent[]
  total: number
}

export interface ReasoningStep {
  id?: string
  stepNumber: number
  stepType: 'thought' | 'action' | 'observation' | 'final_answer' | 'tool-call'
  content?: string
  thought?: string
  action?: string
  actionInput?: any
  observation?: string
  toolOutput?: any
  toolName?: string
  toolArgs?: any
  toolCallId?: string
  args?: any
  costMs?: number
  createdAt?: string
}

/**
 * 工具缓存统计信息
 */
export interface ToolCacheStats {
  /** 当前缓存项数量 */
  size: number
  /** 最大缓存项数量 */
  maxSize: number
  /** 命中次数 */
  hits: number
  /** 未命中次数 */
  misses: number
  /** 命中率 (0-1) */
  hitRate: number
  /** 淘汰次数 */
  evictions: number
  /** 过期清理次数 */
  expirations: number
  /** 总请求数 */
  totalRequests: number
  /** 平均访问次数 */
  avgAccessCount: number
  /** 内存使用估算 (字节) */
  estimatedMemoryUsage: number
}

/**
 * 工具缓存配置
 */
export interface ToolCacheConfig {
  /** 最大缓存项数量 */
  maxSize: number
  /** 默认TTL (毫秒) */
  defaultTtl: number
  /** 是否启用缓存 */
  enabled: boolean
  /** 不缓存的工具名称列表 */
  excludeTools: string[]
}

/**
 * 全局缓存概览
 */
export interface CacheOverview {
  toolExecutor: {
    backend: string
    keys: number
    maxSize: number
    hitRate: number
    hits: number
    misses: number
    evictions: number
    expirations: number
  }
  skillCache: {
    backend: string
    l2MemKeys: number
    l2HitRate: number
    l2Hits: number
    l2Misses: number
    l2Evictions: number
    trackedRedisL1: number
    trackedRedisL2: number
    trackedRedisL3: number
    config: {
      L1_TTL: number
      L2_TTL: number
      L3_TTL: number
      L2_MAX_SIZE: number
    }
  }
  mcpServer: {
    backend: string
    keys: number
    ttlMs: number
    expiredCount: number
  }
  intentCache: {
    backend: string
    keys: number
  }
}

export const agentApi = {
  getList(): Promise<AxiosResponse<{ data: AgentListResponse }>> {
    return adminRequest.get('api/admin/agent')
  },

  create(data: AgentForm): Promise<AxiosResponse> {
    return adminRequest.post('api/admin/agent', data)
  },

  update(id: number, data: AgentForm): Promise<AxiosResponse> {
    return adminRequest.put(`api/admin/agent/${id}`, data)
  },

  delete(id: number): Promise<AxiosResponse> {
    return adminRequest.delete(`api/admin/agent/${id}`)
  },

  /**
   * 获取工具缓存统计信息
   */
  getCacheStats(): Promise<AxiosResponse<{ data: ToolCacheStats }>> {
    return adminRequest.get('api/admin/agent/cache/stats')
  },

  /**
   * 获取工具缓存配置
   */
  getCacheConfig(): Promise<AxiosResponse<{ data: ToolCacheConfig }>> {
    return adminRequest.get('api/admin/agent/cache/config')
  },

  /**
   * 清空工具缓存
   */
  clearCache(): Promise<AxiosResponse> {
    return adminRequest.delete('api/admin/agent/cache')
  },

  /**
   * 手动清理过期缓存
   */
  cleanupExpiredCache(): Promise<AxiosResponse<{ data: { cleanedCount: number } }>> {
    return adminRequest.post('api/admin/agent/cache/cleanup')
  },

  /**
   * 获取全局缓存概览（聚合工具/技能/MCP/意图缓存）
   */
  getCacheOverview(): Promise<AxiosResponse<{ data: CacheOverview }>> {
    return adminRequest.get('api/admin/agent/cache/overview')
  }
}
