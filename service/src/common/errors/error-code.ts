/**
 * 错误码枚举
 * 
 * 命名规范：
 * - 模块前缀：AGENT_、AI_、MODEL_、SKILL_、KB_、MCP_、AUTH_、RATE_ 等
 * - 错误类型：NOT_FOUND、INVALID、EXISTS、FAILED、TIMEOUT、FORBIDDEN 等
 */
export enum ErrorCode {
  // ==================== 通用错误 1xxx ====================
  UNKNOWN = 1000,
  INVALID_PARAMS = 1001,
  INVALID_JSON = 1002,
  NOT_FOUND = 1003,
  ALREADY_EXISTS = 1004,
  OPERATION_FAILED = 1005,
  PERMISSION_DENIED = 1006,
  RATE_LIMITED = 1007,
  SERVICE_UNAVAILABLE = 1008,
  TIMEOUT = 1009,

  // ==================== 认证授权错误 2xxx ====================
  AUTH_UNAUTHORIZED = 2000,
  AUTH_TOKEN_EXPIRED = 2001,
  AUTH_TOKEN_INVALID = 2002,
  AUTH_FORBIDDEN = 2003,
  AUTH_INVALID_CREDENTIALS = 2004,
  AUTH_USER_NOT_FOUND = 2005,
  AUTH_USER_DISABLED = 2006,
  AUTH_PASSWORD_MISMATCH = 2007,

  // ==================== 智能体错误 3xxx ====================
  AGENT_NOT_FOUND = 3000,
  AGENT_DISABLED = 3001,
  AGENT_SKILL_NOT_FOUND = 3002,
  AGENT_MODEL_NOT_FOUND = 3003,
  AGENT_EXECUTION_FAILED = 3004,
  AGENT_MAX_STEPS_EXCEEDED = 3005,
  AGENT_TOOL_CALL_FAILED = 3006,

  // ==================== AI服务错误 4xxx ====================
  AI_SERVICE_ERROR = 4000,
  AI_MODEL_NOT_FOUND = 4001,
  AI_MODEL_DISABLED = 4002,
  AI_PROVIDER_ERROR = 4003,
  AI_RATE_LIMITED = 4004,
  AI_CONTEXT_TOO_LONG = 4005,
  AI_RESPONSE_PARSE_ERROR = 4006,
  AI_STREAM_ERROR = 4007,
  AI_TOOL_CALL_INVALID = 4008,

  // ==================== 模型错误 5xxx ====================
  MODEL_NOT_FOUND = 5000,
  MODEL_DISABLED = 5001,
  MODEL_PROVIDER_NOT_FOUND = 5002,
  MODEL_ROUTING_FAILED = 5003,
  MODEL_CIRCUIT_OPEN = 5004,

  // ==================== 技能错误 6xxx ====================
  SKILL_NOT_FOUND = 6000,
  SKILL_DISABLED = 6001,
  SKILL_EXECUTION_FAILED = 6002,
  SKILL_SCRIPT_ERROR = 6003,
  SKILL_TIMEOUT = 6004,
  SKILL_INVALID_OUTPUT = 6005,

  // ==================== 知识库错误 7xxx ====================
  KB_NOT_FOUND = 7000,
  KB_DISABLED = 7001,
  KB_SEARCH_FAILED = 7002,
  KB_INDEX_ERROR = 7003,
  KB_DOCUMENT_NOT_FOUND = 7004,
  KB_EMBEDDING_FAILED = 7005,

  // ==================== MCP错误 8xxx ====================
  MCP_SERVER_NOT_FOUND = 8000,
  MCP_SERVER_DISABLED = 8001,
  MCP_CONNECTION_FAILED = 8002,
  MCP_TOOL_NOT_FOUND = 8003,
  MCP_TOOL_EXECUTION_FAILED = 8004,
  MCP_TIMEOUT = 8005,

  // ==================== 工具错误 9xxx ====================
  TOOL_NOT_FOUND = 9000,
  TOOL_EXECUTION_FAILED = 9001,
  TOOL_TIMEOUT = 9002,
  TOOL_INVALID_ARGS = 9003,
  TOOL_PERMISSION_DENIED = 9004,

  // ==================== 文件错误 10xxx ====================
  FILE_NOT_FOUND = 10000,
  FILE_TOO_LARGE = 10001,
  FILE_TYPE_NOT_ALLOWED = 10002,
  FILE_UPLOAD_FAILED = 10003,
  FILE_PROCESSING_FAILED = 10004,

  // ==================== 数据库错误 11xxx ====================
  DB_CONNECTION_FAILED = 11000,
  DB_QUERY_FAILED = 11001,
  DB_TRANSACTION_FAILED = 11002,

  // ==================== 向量数据库错误 12xxx ====================
  VECTOR_CONNECTION_FAILED = 12000,
  VECTOR_SEARCH_FAILED = 12001,
  VECTOR_INDEX_ERROR = 12002,
}

/**
 * 错误码映射到HTTP状态码
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  // 通用错误
  [ErrorCode.UNKNOWN]: 500,
  [ErrorCode.INVALID_PARAMS]: 400,
  [ErrorCode.INVALID_JSON]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.OPERATION_FAILED]: 500,
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.TIMEOUT]: 504,

  // 认证授权错误
  [ErrorCode.AUTH_UNAUTHORIZED]: 401,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.AUTH_TOKEN_INVALID]: 401,
  [ErrorCode.AUTH_FORBIDDEN]: 403,
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCode.AUTH_USER_NOT_FOUND]: 404,
  [ErrorCode.AUTH_USER_DISABLED]: 403,
  [ErrorCode.AUTH_PASSWORD_MISMATCH]: 401,

  // 智能体错误
  [ErrorCode.AGENT_NOT_FOUND]: 404,
  [ErrorCode.AGENT_DISABLED]: 403,
  [ErrorCode.AGENT_SKILL_NOT_FOUND]: 404,
  [ErrorCode.AGENT_MODEL_NOT_FOUND]: 404,
  [ErrorCode.AGENT_EXECUTION_FAILED]: 500,
  [ErrorCode.AGENT_MAX_STEPS_EXCEEDED]: 500,
  [ErrorCode.AGENT_TOOL_CALL_FAILED]: 500,

  // AI服务错误
  [ErrorCode.AI_SERVICE_ERROR]: 500,
  [ErrorCode.AI_MODEL_NOT_FOUND]: 404,
  [ErrorCode.AI_MODEL_DISABLED]: 403,
  [ErrorCode.AI_PROVIDER_ERROR]: 502,
  [ErrorCode.AI_RATE_LIMITED]: 429,
  [ErrorCode.AI_CONTEXT_TOO_LONG]: 400,
  [ErrorCode.AI_RESPONSE_PARSE_ERROR]: 500,
  [ErrorCode.AI_STREAM_ERROR]: 500,
  [ErrorCode.AI_TOOL_CALL_INVALID]: 400,

  // 模型错误
  [ErrorCode.MODEL_NOT_FOUND]: 404,
  [ErrorCode.MODEL_DISABLED]: 403,
  [ErrorCode.MODEL_PROVIDER_NOT_FOUND]: 404,
  [ErrorCode.MODEL_ROUTING_FAILED]: 500,
  [ErrorCode.MODEL_CIRCUIT_OPEN]: 503,

  // 技能错误
  [ErrorCode.SKILL_NOT_FOUND]: 404,
  [ErrorCode.SKILL_DISABLED]: 403,
  [ErrorCode.SKILL_EXECUTION_FAILED]: 500,
  [ErrorCode.SKILL_SCRIPT_ERROR]: 500,
  [ErrorCode.SKILL_TIMEOUT]: 504,
  [ErrorCode.SKILL_INVALID_OUTPUT]: 500,

  // 知识库错误
  [ErrorCode.KB_NOT_FOUND]: 404,
  [ErrorCode.KB_DISABLED]: 403,
  [ErrorCode.KB_SEARCH_FAILED]: 500,
  [ErrorCode.KB_INDEX_ERROR]: 500,
  [ErrorCode.KB_DOCUMENT_NOT_FOUND]: 404,
  [ErrorCode.KB_EMBEDDING_FAILED]: 500,

  // MCP错误
  [ErrorCode.MCP_SERVER_NOT_FOUND]: 404,
  [ErrorCode.MCP_SERVER_DISABLED]: 403,
  [ErrorCode.MCP_CONNECTION_FAILED]: 502,
  [ErrorCode.MCP_TOOL_NOT_FOUND]: 404,
  [ErrorCode.MCP_TOOL_EXECUTION_FAILED]: 500,
  [ErrorCode.MCP_TIMEOUT]: 504,

  // 工具错误
  [ErrorCode.TOOL_NOT_FOUND]: 404,
  [ErrorCode.TOOL_EXECUTION_FAILED]: 500,
  [ErrorCode.TOOL_TIMEOUT]: 504,
  [ErrorCode.TOOL_INVALID_ARGS]: 400,
  [ErrorCode.TOOL_PERMISSION_DENIED]: 403,

  // 文件错误
  [ErrorCode.FILE_NOT_FOUND]: 404,
  [ErrorCode.FILE_TOO_LARGE]: 413,
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: 415,
  [ErrorCode.FILE_UPLOAD_FAILED]: 500,
  [ErrorCode.FILE_PROCESSING_FAILED]: 500,

  // 数据库错误
  [ErrorCode.DB_CONNECTION_FAILED]: 503,
  [ErrorCode.DB_QUERY_FAILED]: 500,
  [ErrorCode.DB_TRANSACTION_FAILED]: 500,

  // 向量数据库错误
  [ErrorCode.VECTOR_CONNECTION_FAILED]: 503,
  [ErrorCode.VECTOR_SEARCH_FAILED]: 500,
  [ErrorCode.VECTOR_INDEX_ERROR]: 500,
};

/**
 * 错误码默认消息
 */
export const ErrorCodeMessages: Record<ErrorCode, string> = {
  // 通用错误
  [ErrorCode.UNKNOWN]: '未知错误',
  [ErrorCode.INVALID_PARAMS]: '参数无效',
  [ErrorCode.INVALID_JSON]: 'JSON格式无效',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.ALREADY_EXISTS]: '资源已存在',
  [ErrorCode.OPERATION_FAILED]: '操作失败',
  [ErrorCode.PERMISSION_DENIED]: '权限不足',
  [ErrorCode.RATE_LIMITED]: '请求过于频繁',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂不可用',
  [ErrorCode.TIMEOUT]: '请求超时',

  // 认证授权错误
  [ErrorCode.AUTH_UNAUTHORIZED]: '未授权',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: '令牌已过期',
  [ErrorCode.AUTH_TOKEN_INVALID]: '令牌无效',
  [ErrorCode.AUTH_FORBIDDEN]: '禁止访问',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: '凭证无效',
  [ErrorCode.AUTH_USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.AUTH_USER_DISABLED]: '用户已禁用',
  [ErrorCode.AUTH_PASSWORD_MISMATCH]: '密码错误',

  // 智能体错误
  [ErrorCode.AGENT_NOT_FOUND]: '智能体不存在',
  [ErrorCode.AGENT_DISABLED]: '智能体已禁用',
  [ErrorCode.AGENT_SKILL_NOT_FOUND]: '技能不存在',
  [ErrorCode.AGENT_MODEL_NOT_FOUND]: '模型不存在',
  [ErrorCode.AGENT_EXECUTION_FAILED]: '智能体执行失败',
  [ErrorCode.AGENT_MAX_STEPS_EXCEEDED]: '超过最大执行步数',
  [ErrorCode.AGENT_TOOL_CALL_FAILED]: '工具调用失败',

  // AI服务错误
  [ErrorCode.AI_SERVICE_ERROR]: 'AI服务错误',
  [ErrorCode.AI_MODEL_NOT_FOUND]: 'AI模型不存在',
  [ErrorCode.AI_MODEL_DISABLED]: 'AI模型已禁用',
  [ErrorCode.AI_PROVIDER_ERROR]: 'AI提供商错误',
  [ErrorCode.AI_RATE_LIMITED]: 'AI服务限流',
  [ErrorCode.AI_CONTEXT_TOO_LONG]: '上下文过长',
  [ErrorCode.AI_RESPONSE_PARSE_ERROR]: 'AI响应解析错误',
  [ErrorCode.AI_STREAM_ERROR]: 'AI流式响应错误',
  [ErrorCode.AI_TOOL_CALL_INVALID]: 'AI工具调用无效',

  // 模型错误
  [ErrorCode.MODEL_NOT_FOUND]: '模型不存在',
  [ErrorCode.MODEL_DISABLED]: '模型已禁用',
  [ErrorCode.MODEL_PROVIDER_NOT_FOUND]: '模型提供商不存在',
  [ErrorCode.MODEL_ROUTING_FAILED]: '模型路由失败',
  [ErrorCode.MODEL_CIRCUIT_OPEN]: '模型熔断中',

  // 技能错误
  [ErrorCode.SKILL_NOT_FOUND]: '技能不存在',
  [ErrorCode.SKILL_DISABLED]: '技能已禁用',
  [ErrorCode.SKILL_EXECUTION_FAILED]: '技能执行失败',
  [ErrorCode.SKILL_SCRIPT_ERROR]: '技能脚本错误',
  [ErrorCode.SKILL_TIMEOUT]: '技能执行超时',
  [ErrorCode.SKILL_INVALID_OUTPUT]: '技能输出无效',

  // 知识库错误
  [ErrorCode.KB_NOT_FOUND]: '知识库不存在',
  [ErrorCode.KB_DISABLED]: '知识库已禁用',
  [ErrorCode.KB_SEARCH_FAILED]: '知识库搜索失败',
  [ErrorCode.KB_INDEX_ERROR]: '知识库索引错误',
  [ErrorCode.KB_DOCUMENT_NOT_FOUND]: '文档不存在',
  [ErrorCode.KB_EMBEDDING_FAILED]: '向量化失败',

  // MCP错误
  [ErrorCode.MCP_SERVER_NOT_FOUND]: 'MCP服务器不存在',
  [ErrorCode.MCP_SERVER_DISABLED]: 'MCP服务器已禁用',
  [ErrorCode.MCP_CONNECTION_FAILED]: 'MCP连接失败',
  [ErrorCode.MCP_TOOL_NOT_FOUND]: 'MCP工具不存在',
  [ErrorCode.MCP_TOOL_EXECUTION_FAILED]: 'MCP工具执行失败',
  [ErrorCode.MCP_TIMEOUT]: 'MCP超时',

  // 工具错误
  [ErrorCode.TOOL_NOT_FOUND]: '工具不存在',
  [ErrorCode.TOOL_EXECUTION_FAILED]: '工具执行失败',
  [ErrorCode.TOOL_TIMEOUT]: '工具执行超时',
  [ErrorCode.TOOL_INVALID_ARGS]: '工具参数无效',
  [ErrorCode.TOOL_PERMISSION_DENIED]: '工具权限不足',

  // 文件错误
  [ErrorCode.FILE_NOT_FOUND]: '文件不存在',
  [ErrorCode.FILE_TOO_LARGE]: '文件过大',
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: '文件类型不允许',
  [ErrorCode.FILE_UPLOAD_FAILED]: '文件上传失败',
  [ErrorCode.FILE_PROCESSING_FAILED]: '文件处理失败',

  // 数据库错误
  [ErrorCode.DB_CONNECTION_FAILED]: '数据库连接失败',
  [ErrorCode.DB_QUERY_FAILED]: '数据库查询失败',
  [ErrorCode.DB_TRANSACTION_FAILED]: '数据库事务失败',

  // 向量数据库错误
  [ErrorCode.VECTOR_CONNECTION_FAILED]: '向量数据库连接失败',
  [ErrorCode.VECTOR_SEARCH_FAILED]: '向量搜索失败',
  [ErrorCode.VECTOR_INDEX_ERROR]: '向量索引错误',
};
