import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import type { ApiResponse } from '@/utils/request'

export interface McpStrategy {
  id: string
  modelType: string
  strategy: string
  retryCount: number
  timeout: number
  fallbackModelId?: string
  enableCircuit: boolean
  circuitThreshold: number
  circuitTimeout: number
  createdAt: string
  updatedAt: string
}

export interface McpStrategyForm {
  modelType: string
  strategy: string
  retryCount: number
  timeout: number
  fallbackModelId?: string
  enableCircuit: boolean
  circuitThreshold: number
  circuitTimeout: number
}

export interface McpRule {
  id: string
  modelId: string
  qpsLimit: number
  maxConcurrent: number
  currentConcurrent: number
  errorCount: number
  circuitOpen: boolean
  circuitOpenAt?: string
  lastErrorAt?: string
  createdAt: string
  updatedAt: string
}

export interface McpStatus {
  modelId: string
  modelName: string
  status: string
  qpsLimit: number
  currentQps: number
  maxConcurrent: number
  currentConcurrent: number
  errorCount: number
  circuitOpen: boolean
}

export const mcpApi = {
  getStrategies(): Promise<AxiosResponse<ApiResponse<McpStrategy[]>>> {
    return adminRequest.get('/admin/mcp/strategies')
  },
  
  getStrategy(modelType: string): Promise<AxiosResponse<ApiResponse<McpStrategy>>> {
    return adminRequest.get(`/admin/mcp/strategy/${modelType}`)
  },
  
  createStrategy(data: McpStrategyForm): Promise<AxiosResponse<ApiResponse<McpStrategy>>> {
    return adminRequest.post('/admin/mcp/strategy', data)
  },
  
  updateStrategy(modelType: string, data: Partial<McpStrategyForm>): Promise<AxiosResponse<ApiResponse<McpStrategy>>> {
    return adminRequest.put(`/admin/mcp/strategy/${modelType}`, data)
  },
  
  getRules(): Promise<AxiosResponse<ApiResponse<McpRule[]>>> {
    return adminRequest.get('/admin/mcp/rules')
  },
  
  createRule(data: any): Promise<AxiosResponse<ApiResponse<McpRule>>> {
    return adminRequest.post('/admin/mcp/rule', data)
  },
  
  updateRule(modelId: string, data: any): Promise<AxiosResponse<ApiResponse<McpRule>>> {
    return adminRequest.put(`/admin/mcp/rule/${modelId}`, data)
  },
  
  getRule(modelId: string): Promise<AxiosResponse<ApiResponse<McpRule>>> {
    return adminRequest.get(`/admin/mcp/rule/${modelId}`)
  },
  
  resetCircuit(modelId: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.post(`/admin/mcp/circuit/reset/${modelId}`)
  },
  
  getStatus(): Promise<AxiosResponse<ApiResponse<McpStatus[]>>> {
    return adminRequest.get('/admin/mcp/status')
  }
}
