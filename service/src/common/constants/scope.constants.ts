/**
 * OAuth Scope 权限枚举
 * 命名规范：{模块}:{操作}
 * - read: 查询类操作
 * - write: 创建/更新/删除类操作（自动包含 read）
 * - execute: 执行类操作（独立权限）
 */
export enum AdminScope {
  // 应用管理
  APP_READ = 'app:read',
  APP_WRITE = 'app:write',

  // 模型管理
  MODEL_READ = 'model:read',
  MODEL_WRITE = 'model:write',

  // 模型模板
  MODEL_TEMPLATE_READ = 'model-template:read',
  MODEL_TEMPLATE_WRITE = 'model-template:write',

  // 智能体
  AGENT_READ = 'agent:read',
  AGENT_WRITE = 'agent:write',

  // 技能
  SKILL_READ = 'skill:read',
  SKILL_WRITE = 'skill:write',
  SKILL_EXECUTE = 'skill:execute',

  // 知识库
  KB_READ = 'kb:read',
  KB_WRITE = 'kb:write',

  // 文档
  DOCUMENT_READ = 'document:read',
  DOCUMENT_WRITE = 'document:write',

  // 会话
  CONVERSATION_READ = 'conversation:read',
  CONVERSATION_WRITE = 'conversation:write',

  // Prompt模板
  PROMPT_TEMPLATE_READ = 'prompt-template:read',
  PROMPT_TEMPLATE_WRITE = 'prompt-template:write',

  // MCP调度
  MCP_READ = 'mcp:read',
  MCP_WRITE = 'mcp:write',

  // MCP Server
  MCP_SERVER_READ = 'mcp-server:read',
  MCP_SERVER_WRITE = 'mcp-server:write',

  // OAuth
  OAUTH_READ = 'oauth:read',
  OAUTH_WRITE = 'oauth:write',

  // 限流
  RATE_LIMIT_READ = 'rate-limit:read',
  RATE_LIMIT_WRITE = 'rate-limit:write',

  // 任务
  TASK_READ = 'task:read',
  TASK_WRITE = 'task:write',

  // 日志
  LOG_READ = 'log:read',
  LOG_WRITE = 'log:write',

  // 管理员
  ADMIN_READ = 'admin:read',
  ADMIN_WRITE = 'admin:write',

  // 意图关键词
  INTENT_KEYWORD_READ = 'intent-keyword:read',
  INTENT_KEYWORD_WRITE = 'intent-keyword:write',

  // 意图监控
  INTENT_DASHBOARD_READ = 'intent-dashboard:read',

  // 意图缓存
  INTENT_CACHE_READ = 'intent-cache:read',
  INTENT_CACHE_WRITE = 'intent-cache:write',

  // 意图路由日志
  INTENT_ROUTING_LOG_READ = 'intent-routing-log:read',
}

/**
 * Scope 层级关系
 * write scope 自动包含对应 read scope
 */
export const SCOPE_HIERARCHY: Record<string, string[]> = {
  [AdminScope.APP_WRITE]: [AdminScope.APP_READ],
  [AdminScope.MODEL_WRITE]: [AdminScope.MODEL_READ],
  [AdminScope.MODEL_TEMPLATE_WRITE]: [AdminScope.MODEL_TEMPLATE_READ],
  [AdminScope.AGENT_WRITE]: [AdminScope.AGENT_READ],
  [AdminScope.SKILL_WRITE]: [AdminScope.SKILL_READ],
  [AdminScope.KB_WRITE]: [AdminScope.KB_READ],
  [AdminScope.DOCUMENT_WRITE]: [AdminScope.DOCUMENT_READ],
  [AdminScope.CONVERSATION_WRITE]: [AdminScope.CONVERSATION_READ],
  [AdminScope.PROMPT_TEMPLATE_WRITE]: [AdminScope.PROMPT_TEMPLATE_READ],
  [AdminScope.MCP_WRITE]: [AdminScope.MCP_READ],
  [AdminScope.MCP_SERVER_WRITE]: [AdminScope.MCP_SERVER_READ],
  [AdminScope.OAUTH_WRITE]: [AdminScope.OAUTH_READ],
  [AdminScope.RATE_LIMIT_WRITE]: [AdminScope.RATE_LIMIT_READ],
  [AdminScope.TASK_WRITE]: [AdminScope.TASK_READ],
  [AdminScope.LOG_WRITE]: [AdminScope.LOG_READ],
  [AdminScope.ADMIN_WRITE]: [AdminScope.ADMIN_READ],
  [AdminScope.INTENT_KEYWORD_WRITE]: [AdminScope.INTENT_KEYWORD_READ],
  [AdminScope.INTENT_CACHE_WRITE]: [AdminScope.INTENT_CACHE_READ],
};

/**
 * Scope 分组（用于授权页面展示和快速选择）
 */
export const SCOPE_GROUPS: { label: string; scopes: AdminScope[] }[] = [
  { label: '应用管理', scopes: [AdminScope.APP_READ, AdminScope.APP_WRITE] },
  { label: '模型管理', scopes: [AdminScope.MODEL_READ, AdminScope.MODEL_WRITE] },
  { label: '模型模板', scopes: [AdminScope.MODEL_TEMPLATE_READ, AdminScope.MODEL_TEMPLATE_WRITE] },
  { label: '智能体', scopes: [AdminScope.AGENT_READ, AdminScope.AGENT_WRITE] },
  { label: '技能', scopes: [AdminScope.SKILL_READ, AdminScope.SKILL_WRITE, AdminScope.SKILL_EXECUTE] },
  { label: '知识库', scopes: [AdminScope.KB_READ, AdminScope.KB_WRITE] },
  { label: '文档', scopes: [AdminScope.DOCUMENT_READ, AdminScope.DOCUMENT_WRITE] },
  { label: '会话', scopes: [AdminScope.CONVERSATION_READ, AdminScope.CONVERSATION_WRITE] },
  { label: 'Prompt模板', scopes: [AdminScope.PROMPT_TEMPLATE_READ, AdminScope.PROMPT_TEMPLATE_WRITE] },
  { label: 'MCP调度', scopes: [AdminScope.MCP_READ, AdminScope.MCP_WRITE, AdminScope.INTENT_KEYWORD_READ, AdminScope.INTENT_KEYWORD_WRITE, AdminScope.INTENT_DASHBOARD_READ, AdminScope.INTENT_CACHE_READ, AdminScope.INTENT_CACHE_WRITE, AdminScope.INTENT_ROUTING_LOG_READ] },
  { label: 'MCP Server', scopes: [AdminScope.MCP_SERVER_READ, AdminScope.MCP_SERVER_WRITE] },
  { label: 'OAuth', scopes: [AdminScope.OAUTH_READ, AdminScope.OAUTH_WRITE] },
  { label: '限流', scopes: [AdminScope.RATE_LIMIT_READ, AdminScope.RATE_LIMIT_WRITE] },
  { label: '任务', scopes: [AdminScope.TASK_READ, AdminScope.TASK_WRITE] },
  { label: '日志', scopes: [AdminScope.LOG_READ, AdminScope.LOG_WRITE] },
  { label: '管理员', scopes: [AdminScope.ADMIN_READ, AdminScope.ADMIN_WRITE] },
];

/**
 * Scope 描述映射（用于前端展示）
 */
export const SCOPE_DESCRIPTIONS: Record<AdminScope, string> = {
  [AdminScope.APP_READ]: '查看应用列表和详情',
  [AdminScope.APP_WRITE]: '创建、更新、删除应用',
  [AdminScope.MODEL_READ]: '查看模型列表和详情',
  [AdminScope.MODEL_WRITE]: '创建、更新、删除模型',
  [AdminScope.MODEL_TEMPLATE_READ]: '查看模型参数模板',
  [AdminScope.MODEL_TEMPLATE_WRITE]: '管理模型参数模板',
  [AdminScope.AGENT_READ]: '查看智能体列表和详情',
  [AdminScope.AGENT_WRITE]: '创建、更新、删除智能体',
  [AdminScope.SKILL_READ]: '查看技能列表和详情',
  [AdminScope.SKILL_WRITE]: '创建、更新、删除技能',
  [AdminScope.SKILL_EXECUTE]: '执行技能和测试函数',
  [AdminScope.KB_READ]: '查看知识库列表和详情',
  [AdminScope.KB_WRITE]: '创建、更新、删除知识库',
  [AdminScope.DOCUMENT_READ]: '查看文档列表',
  [AdminScope.DOCUMENT_WRITE]: '上传和删除文档',
  [AdminScope.CONVERSATION_READ]: '查看会话列表和详情',
  [AdminScope.CONVERSATION_WRITE]: '删除会话',
  [AdminScope.PROMPT_TEMPLATE_READ]: '查看Prompt模板',
  [AdminScope.PROMPT_TEMPLATE_WRITE]: '管理Prompt模板',
  [AdminScope.MCP_READ]: '查看MCP调度配置',
  [AdminScope.MCP_WRITE]: '管理MCP调度配置',
  [AdminScope.INTENT_KEYWORD_READ]: '查看意图关键词',
  [AdminScope.INTENT_KEYWORD_WRITE]: '管理意图关键词',
  [AdminScope.INTENT_DASHBOARD_READ]: '查看意图监控看板',
  [AdminScope.INTENT_CACHE_READ]: '查看意图缓存',
  [AdminScope.INTENT_CACHE_WRITE]: '清除意图缓存',
  [AdminScope.INTENT_ROUTING_LOG_READ]: '查看意图路由日志',
  [AdminScope.MCP_SERVER_READ]: '查看MCP Server',
  [AdminScope.MCP_SERVER_WRITE]: '管理MCP Server',
  [AdminScope.OAUTH_READ]: '查看OAuth客户端和令牌',
  [AdminScope.OAUTH_WRITE]: '管理OAuth客户端和令牌',
  [AdminScope.RATE_LIMIT_READ]: '查看限流规则和统计',
  [AdminScope.RATE_LIMIT_WRITE]: '管理限流规则',
  [AdminScope.TASK_READ]: '查看任务队列状态',
  [AdminScope.TASK_WRITE]: '清空队列和重试任务',
  [AdminScope.LOG_READ]: '查看操作日志和统计',
  [AdminScope.LOG_WRITE]: '管理日志（预留）',
  [AdminScope.ADMIN_READ]: '查看管理员列表',
  [AdminScope.ADMIN_WRITE]: '创建、更新、删除管理员',
};
