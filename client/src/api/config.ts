/**
 * API配置文件
 */
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 60000,
}

/**
 * API端点
 */
export const API_ENDPOINTS = {
  chat: '/api/ai/stream',
  models: '/api/model',
  agents: '/api/agent',
  conversations: '/api/conversation',
}
