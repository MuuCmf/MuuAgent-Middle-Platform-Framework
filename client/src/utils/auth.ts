/**
 * localStorage 存储键名
 */
const STORAGE_KEYS = {
  API_KEY: 'x-api-key',
  UID: 'x-uid',
} as const

/**
 * 获取 API_KEY，优先从 localStorage 读取，其次从环境变量读取
 * @returns API_KEY 字符串
 */
export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || import.meta.env.VITE_API_KEY || ''
}

/**
 * 保存 API_KEY 到 localStorage
 * @param key API_KEY
 */
export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key)
}

/**
 * 获取 UID，优先从 localStorage 读取
 * @returns UID 字符串
 */
export function getUid(): string {
  return localStorage.getItem(STORAGE_KEYS.UID) || ''
}

/**
 * 保存 UID 到 localStorage
 * @param uid UID
 */
export function setUid(uid: string): void {
  localStorage.setItem(STORAGE_KEYS.UID, uid)
}

/**
 * 检查是否已配置 API_KEY 和 UID
 * @returns 是否已配置
 */
export function hasCredentials(): boolean {
  return !!(getApiKey() && getUid())
}
