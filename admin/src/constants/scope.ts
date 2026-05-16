/**
 * OAuth Scope 类型定义
 */

/**
 * Scope 定义
 */
export interface ScopeOption {
  value: string
  label: string
  description: string
}

/**
 * Scope 分组
 */
export interface ScopeGroup {
  label: string
  scopes: ScopeOption[]
}
