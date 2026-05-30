/**
 * 租户功能权限配置
 *
 * 设计原则：
 * - 每个模块一个 key，值为该模块允许的操作列表
 * - undefined 表示使用默认值
 * - 默认值由 DEFAULT_TENANT_PERMISSIONS 定义
 * - 空对象 {} 等价于全部使用默认值（向后兼容）
 */

/** 智能体模块权限 */
export interface AgentPermission {
  /** 对话（默认 true） */
  chat?: boolean;
  /** 流式对话（默认 true） */
  stream?: boolean;
}

/** AI调用模块权限 */
export interface AiPermission {
  /** 同步调用（默认 true） */
  invoke?: boolean;
  /** 流式调用（默认 true） */
  stream?: boolean;
  /** 文生图（默认 true） */
  image?: boolean;
  /** 语音合成（默认 true） */
  tts?: boolean;
  /** 语音识别（默认 true） */
  asr?: boolean;
}

/** 知识库模块权限 */
export interface KbPermission {
  /** 向量检索（默认 true） */
  retrieval?: boolean;
  /** RAG问答（默认 true） */
  ragChat?: boolean;
}

/** 会话模块权限 */
export interface ConversationPermission {
  /** 创建会话（默认 true） */
  create?: boolean;
  /** 更新会话（默认 true） */
  update?: boolean;
  /** 删除会话（默认 true） */
  delete?: boolean;
  /** 添加消息（默认 true） */
  addMessage?: boolean;
}

/** 文件模块权限 */
export interface FilePermission {
  /** 上传文件（默认 true） */
  upload?: boolean;
  /** 下载文件（默认 true） */
  download?: boolean;
  /** 删除文件（默认 false） */
  delete?: boolean;
}

/** 动态客户端工具权限 */
export interface DynamicToolPermission {
  /** 创建工具（默认 true） */
  create?: boolean;
  /** 更新工具（默认 true） */
  update?: boolean;
  /** 删除工具（默认 true） */
  delete?: boolean;
}

/** 工具策略权限 */
export interface ToolPolicyPermission {
  /** 读取策略（默认 true） */
  read?: boolean;
  /** 修改策略（默认 false） */
  write?: boolean;
}

/** 租户完整权限配置 */
export interface TenantPermissions {
  /** 智能体模块权限 */
  agent?: AgentPermission;
  /** AI调用模块权限 */
  ai?: AiPermission;
  /** 知识库模块权限 */
  kb?: KbPermission;
  /** 会话模块权限 */
  conversation?: ConversationPermission;
  /** 文件模块权限 */
  file?: FilePermission;
  /** 动态客户端工具权限 */
  dynamicTool?: DynamicToolPermission;
  /** 工具策略权限 */
  toolPolicy?: ToolPolicyPermission;
}

/**
 * 租户默认权限
 * 所有租户创建时默认拥有这些权限
 */
export const DEFAULT_TENANT_PERMISSIONS: Required<TenantPermissions> = {
  agent: { chat: true, stream: true },
  ai: { invoke: true, stream: true, image: true, tts: true, asr: true },
  kb: { retrieval: true, ragChat: true },
  conversation: { create: true, update: true, delete: true, addMessage: true },
  file: { upload: true, download: true, delete: false },
  dynamicTool: { create: true, update: true, delete: true },
  toolPolicy: { read: true, write: false },
};

/**
 * 合并租户权限：用户配置覆盖默认值
 * @param custom 租户自定义权限
 * @returns {Required<TenantPermissions>} 合并后的完整权限
 */
export function mergeTenantPermissions(custom: TenantPermissions): Required<TenantPermissions> {
  return {
    agent: { ...DEFAULT_TENANT_PERMISSIONS.agent, ...custom.agent },
    ai: { ...DEFAULT_TENANT_PERMISSIONS.ai, ...custom.ai },
    kb: { ...DEFAULT_TENANT_PERMISSIONS.kb, ...custom.kb },
    conversation: { ...DEFAULT_TENANT_PERMISSIONS.conversation, ...custom.conversation },
    file: { ...DEFAULT_TENANT_PERMISSIONS.file, ...custom.file },
    dynamicTool: { ...DEFAULT_TENANT_PERMISSIONS.dynamicTool, ...custom.dynamicTool },
    toolPolicy: { ...DEFAULT_TENANT_PERMISSIONS.toolPolicy, ...custom.toolPolicy },
  };
}

/**
 * 解析租户权限 JSON
 * @param permissionsStr 权限 JSON 字符串
 * @returns {Required<TenantPermissions>} 合并后的完整权限
 */
export function parseTenantPermissions(permissionsStr: string | Record<string, any> | null): Required<TenantPermissions> {
  const custom = typeof permissionsStr === 'string'
    ? JSON.parse(permissionsStr || '{}')
    : permissionsStr || {};
  return mergeTenantPermissions(custom);
}

/**
 * 租户权限模块名称映射（用于错误提示）
 */
export const TENANT_PERMISSION_MODULE_LABELS: Record<keyof Required<TenantPermissions>, string> = {
  agent: '智能体',
  ai: 'AI调用',
  kb: '知识库',
  conversation: '会话',
  file: '文件',
  dynamicTool: '动态工具',
  toolPolicy: '工具策略',
};
