import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import type { ApiResponse } from '@/utils/request'

export interface ModelRoutingStrategy {
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

export interface ModelRoutingStrategyForm {
  modelType: string
  strategy: string
  retryCount: number
  timeout: number
  fallbackModelId?: string
  enableCircuit: boolean
  circuitThreshold: number
  circuitTimeout: number
}

export interface ModelRoutingRule {
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

export interface ModelRoutingStatus {
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

export const routingApi = {
  getStrategies(): Promise<AxiosResponse<ApiResponse<ModelRoutingStrategy[]>>> {
    return adminRequest.get('api/admin/model-routing/strategies')
  },

  getStrategy(modelType: string): Promise<AxiosResponse<ApiResponse<ModelRoutingStrategy>>> {
    return adminRequest.get(`api/admin/model-routing/strategy/${modelType}`)
  },

  createStrategy(data: ModelRoutingStrategyForm): Promise<AxiosResponse<ApiResponse<ModelRoutingStrategy>>> {
    return adminRequest.post('api/admin/model-routing/strategy', data)
  },

  updateStrategy(modelType: string, data: Partial<ModelRoutingStrategyForm>): Promise<AxiosResponse<ApiResponse<ModelRoutingStrategy>>> {
    return adminRequest.put(`api/admin/model-routing/strategy/${modelType}`, data)
  },

  getRules(): Promise<AxiosResponse<ApiResponse<ModelRoutingRule[]>>> {
    return adminRequest.get('api/admin/model-routing/rules')
  },

  createRule(data: any): Promise<AxiosResponse<ApiResponse<ModelRoutingRule>>> {
    return adminRequest.post('api/admin/model-routing/rule', data)
  },

  updateRule(modelId: string, data: any): Promise<AxiosResponse<ApiResponse<ModelRoutingRule>>> {
    return adminRequest.put(`api/admin/model-routing/rule/${modelId}`, data)
  },

  getRule(modelId: string): Promise<AxiosResponse<ApiResponse<ModelRoutingRule>>> {
    return adminRequest.get(`api/admin/model-routing/rule/${modelId}`)
  },

  resetCircuit(modelId: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.post(`api/admin/model-routing/circuit/reset/${modelId}`)
  },

  getStatus(): Promise<AxiosResponse<ApiResponse<ModelRoutingStatus[]>>> {
    return adminRequest.get('api/admin/model-routing/status')
  }
}