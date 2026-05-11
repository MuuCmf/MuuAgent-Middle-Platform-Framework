/**
 * OAuth Scope 权限常量
 * 与服务端 scope.constants.ts 保持同步
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

/**
 * Scope 描述映射
 */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'model:read': '查看模型列表和详情',
  'model:write': '创建、更新、删除模型',
  'model-template:read': '查看模型参数模板',
  'model-template:write': '管理模型参数模板',
  'agent:read': '查看智能体列表和详情',
  'agent:write': '创建、更新、删除智能体',
  'skill:read': '查看技能列表和详情',
  'skill:write': '创建、更新、删除技能',
  'skill:execute': '执行技能和测试函数',
  'kb:read': '查看知识库列表和详情',
  'kb:write': '创建、更新、删除知识库',
  'document:read': '查看文档列表',
  'document:write': '上传和删除文档',
  'conversation:read': '查看会话列表和详情',
  'conversation:write': '删除会话',
  'prompt-template:read': '查看Prompt模板',
  'prompt-template:write': '管理Prompt模板',
  'mcp:read': '查看MCP调度配置',
  'mcp:write': '管理MCP调度配置',
  'mcp-server:read': '查看MCP Server',
  'mcp-server:write': '管理MCP Server',
  'oauth:read': '查看OAuth客户端和令牌',
  'oauth:write': '管理OAuth客户端和令牌',
  'rate-limit:read': '查看限流规则和统计',
  'rate-limit:write': '管理限流规则',
  'task:read': '查看任务队列状态',
  'task:write': '清空队列和重试任务',
  'log:read': '查看操作日志和统计',
  'log:write': '管理日志（预留）',
  'admin:read': '查看管理员列表',
  'admin:write': '创建、更新、删除管理员',
}

/**
 * Scope 中文标签映射
 */
const SCOPE_LABELS: Record<string, string> = {
  'model:read': '模型-读取',
  'model:write': '模型-写入',
  'model-template:read': '模型模板-读取',
  'model-template:write': '模型模板-写入',
  'agent:read': '智能体-读取',
  'agent:write': '智能体-写入',
  'skill:read': '技能-读取',
  'skill:write': '技能-写入',
  'skill:execute': '技能-执行',
  'kb:read': '知识库-读取',
  'kb:write': '知识库-写入',
  'document:read': '文档-读取',
  'document:write': '文档-写入',
  'conversation:read': '会话-读取',
  'conversation:write': '会话-写入',
  'prompt-template:read': 'Prompt模板-读取',
  'prompt-template:write': 'Prompt模板-写入',
  'mcp:read': 'MCP调度-读取',
  'mcp:write': 'MCP调度-写入',
  'mcp-server:read': 'MCP Server-读取',
  'mcp-server:write': 'MCP Server-写入',
  'oauth:read': 'OAuth-读取',
  'oauth:write': 'OAuth-写入',
  'rate-limit:read': '限流-读取',
  'rate-limit:write': '限流-写入',
  'task:read': '任务-读取',
  'task:write': '任务-写入',
  'log:read': '日志-读取',
  'log:write': '日志-写入',
  'admin:read': '管理员-读取',
  'admin:write': '管理员-写入',
}

/**
 * Scope 分组定义（用于编辑页面的分组选择器）
 */
export const SCOPE_GROUPS: ScopeGroup[] = [
  {
    label: '模型管理',
    scopes: [
      { value: 'model:read', label: SCOPE_LABELS['model:read'], description: SCOPE_DESCRIPTIONS['model:read'] },
      { value: 'model:write', label: SCOPE_LABELS['model:write'], description: SCOPE_DESCRIPTIONS['model:write'] },
    ],
  },
  {
    label: '模型模板',
    scopes: [
      { value: 'model-template:read', label: SCOPE_LABELS['model-template:read'], description: SCOPE_DESCRIPTIONS['model-template:read'] },
      { value: 'model-template:write', label: SCOPE_LABELS['model-template:write'], description: SCOPE_DESCRIPTIONS['model-template:write'] },
    ],
  },
  {
    label: '智能体',
    scopes: [
      { value: 'agent:read', label: SCOPE_LABELS['agent:read'], description: SCOPE_DESCRIPTIONS['agent:read'] },
      { value: 'agent:write', label: SCOPE_LABELS['agent:write'], description: SCOPE_DESCRIPTIONS['agent:write'] },
    ],
  },
  {
    label: '技能',
    scopes: [
      { value: 'skill:read', label: SCOPE_LABELS['skill:read'], description: SCOPE_DESCRIPTIONS['skill:read'] },
      { value: 'skill:write', label: SCOPE_LABELS['skill:write'], description: SCOPE_DESCRIPTIONS['skill:write'] },
      { value: 'skill:execute', label: SCOPE_LABELS['skill:execute'], description: SCOPE_DESCRIPTIONS['skill:execute'] },
    ],
  },
  {
    label: '知识库',
    scopes: [
      { value: 'kb:read', label: SCOPE_LABELS['kb:read'], description: SCOPE_DESCRIPTIONS['kb:read'] },
      { value: 'kb:write', label: SCOPE_LABELS['kb:write'], description: SCOPE_DESCRIPTIONS['kb:write'] },
    ],
  },
  {
    label: '文档',
    scopes: [
      { value: 'document:read', label: SCOPE_LABELS['document:read'], description: SCOPE_DESCRIPTIONS['document:read'] },
      { value: 'document:write', label: SCOPE_LABELS['document:write'], description: SCOPE_DESCRIPTIONS['document:write'] },
    ],
  },
  {
    label: '会话',
    scopes: [
      { value: 'conversation:read', label: SCOPE_LABELS['conversation:read'], description: SCOPE_DESCRIPTIONS['conversation:read'] },
      { value: 'conversation:write', label: SCOPE_LABELS['conversation:write'], description: SCOPE_DESCRIPTIONS['conversation:write'] },
    ],
  },
  {
    label: 'Prompt模板',
    scopes: [
      { value: 'prompt-template:read', label: SCOPE_LABELS['prompt-template:read'], description: SCOPE_DESCRIPTIONS['prompt-template:read'] },
      { value: 'prompt-template:write', label: SCOPE_LABELS['prompt-template:write'], description: SCOPE_DESCRIPTIONS['prompt-template:write'] },
    ],
  },
  {
    label: 'MCP调度',
    scopes: [
      { value: 'mcp:read', label: SCOPE_LABELS['mcp:read'], description: SCOPE_DESCRIPTIONS['mcp:read'] },
      { value: 'mcp:write', label: SCOPE_LABELS['mcp:write'], description: SCOPE_DESCRIPTIONS['mcp:write'] },
    ],
  },
  {
    label: 'MCP Server',
    scopes: [
      { value: 'mcp-server:read', label: SCOPE_LABELS['mcp-server:read'], description: SCOPE_DESCRIPTIONS['mcp-server:read'] },
      { value: 'mcp-server:write', label: SCOPE_LABELS['mcp-server:write'], description: SCOPE_DESCRIPTIONS['mcp-server:write'] },
    ],
  },
  {
    label: 'OAuth',
    scopes: [
      { value: 'oauth:read', label: SCOPE_LABELS['oauth:read'], description: SCOPE_DESCRIPTIONS['oauth:read'] },
      { value: 'oauth:write', label: SCOPE_LABELS['oauth:write'], description: SCOPE_DESCRIPTIONS['oauth:write'] },
    ],
  },
  {
    label: '限流',
    scopes: [
      { value: 'rate-limit:read', label: SCOPE_LABELS['rate-limit:read'], description: SCOPE_DESCRIPTIONS['rate-limit:read'] },
      { value: 'rate-limit:write', label: SCOPE_LABELS['rate-limit:write'], description: SCOPE_DESCRIPTIONS['rate-limit:write'] },
    ],
  },
  {
    label: '任务',
    scopes: [
      { value: 'task:read', label: SCOPE_LABELS['task:read'], description: SCOPE_DESCRIPTIONS['task:read'] },
      { value: 'task:write', label: SCOPE_LABELS['task:write'], description: SCOPE_DESCRIPTIONS['task:write'] },
    ],
  },
  {
    label: '日志',
    scopes: [
      { value: 'log:read', label: SCOPE_LABELS['log:read'], description: SCOPE_DESCRIPTIONS['log:read'] },
      { value: 'log:write', label: SCOPE_LABELS['log:write'], description: SCOPE_DESCRIPTIONS['log:write'] },
    ],
  },
  {
    label: '管理员',
    scopes: [
      { value: 'admin:read', label: SCOPE_LABELS['admin:read'], description: SCOPE_DESCRIPTIONS['admin:read'] },
      { value: 'admin:write', label: SCOPE_LABELS['admin:write'], description: SCOPE_DESCRIPTIONS['admin:write'] },
    ],
  },
]

/**
 * 获取 scope 描述
 * @param scope scope 值
 * @returns 描述文本
 */
export function getScopeDescription(scope: string): string {
  return SCOPE_DESCRIPTIONS[scope] || scope
}

/**
 * 获取 scope 中文标签
 * @param scope scope 值
 * @returns 中文标签
 */
export function getScopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] || scope
}

/**
 * 获取 scope 类型（用于 tag 颜色）
 * @param scope scope 值
 * @returns tag type
 */
export function getScopeTagType(scope: string): '' | 'success' | 'warning' | 'danger' | 'info' {
  if (scope.endsWith(':write')) return 'danger'
  if (scope.endsWith(':execute')) return 'warning'
  if (scope.endsWith(':read')) return 'success'
  return 'info'
}
