/**
 * 流式事件类型枚举
 * 统一定义所有流式调用中可能产生的事件类型
 */
export enum StreamEventType {
  /** 会话ID事件 - 流式开始时发送，告知客户端会话标识 */
  CONVERSATION_ID = 'conversation_id',
  /** 文本增量事件 - 每次接收到模型输出的文本片段 */
  TEXT_DELTA = 'text_delta',
  /** 工具调用事件 - 模型请求执行工具 */
  TOOL_CALL = 'tool_call',
  /** 推理步骤事件 - ReAct 等推理模式中的步骤 */
  REASONING_STEP = 'reasoning_step',
  /** 来源引用事件 - RAG 检索结果的引用来源 */
  SOURCES = 'sources',
  /** 流结束事件 */
  DONE = 'done',
  /** 错误事件 */
  ERROR = 'error',
  /** 客户端工具调用事件（通用） */
  CLIENT_TOOL_CALL = 'client_tool_call',
  /** 客户端工具结果事件（通用） */
  CLIENT_TOOL_RESULT = 'client_tool_result',
  /** 客户端工具权限策略事件 - 会话开始时下发权限策略 */
  CLIENT_TOOL_POLICY = 'client_tool_policy',
}

/**
 * 统一流式事件接口
 * 所有模块的流式调用均使用此事件模型，保证协议一致
 */
export interface StreamEvent {
  /** 事件类型 */
  type: StreamEventType;
  /** 事件载荷，不同类型对应不同结构 */
  payload: StreamEventPayload;
}

/**
 * 各事件类型的载荷定义
 */
export type StreamEventPayload =
  | ConversationIdPayload
  | TextDeltaPayload
  | ToolCallPayload
  | ReasoningStepPayload
  | SourcesPayload
  | DonePayload
  | ErrorPayload
  | ClientToolCallPayload
  | ClientToolResultPayload
  | ClientToolPolicyPayload;

/** 会话ID载荷 */
export interface ConversationIdPayload {
  conversationId: string;
}

/** 文本增量载荷 */
export interface TextDeltaPayload {
  delta: string;
}

/** 工具调用载荷 */
export interface ToolCallPayload {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/** 推理步骤载荷 */
export interface ReasoningStepPayload {
  stepNumber: number;
  stepType: string;
  content?: string;
  action?: string;
  actionInput?: unknown;
  observation?: string;
  toolOutput?: unknown;
}

/** 来源引用载荷 */
export interface SourcesPayload {
  sources: unknown[];
}

/** 流结束载荷 */
export interface DonePayload {
  conversationId?: string;
  response?: string;
  totalCostMs?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** 错误载荷 */
export interface ErrorPayload {
  message: string;
  code?: string;
}

/** 客户端工具调用载荷（通用） - 服务端下发给客户端 */
export interface ClientToolCallPayload {
  /** 模块名称，如 'workspace', 'browser' */
  moduleName: string;
  /** 调用ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  args: Record<string, unknown>;
}

/** 客户端工具结果载荷（通用） - 客户端回传给服务端 */
export interface ClientToolResultPayload {
  /** 模块名称 */
  moduleName: string;
  /** 调用ID */
  callId: string;
  /** 是否成功 */
  success: boolean;
  /** 执行结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
}

/**
 * 客户端工具权限策略载荷 - 服务端在会话开始时下发给客户端
 * 客户端根据此策略决定工具的执行权限（自动执行/需确认/禁止）
 */
export interface ClientToolPolicyPayload {
  /** 权限策略列表，每个模块一条 */
  policies: Array<{
    /** 模块名称 */
    moduleName: string;
    /** 模块默认确认模式 */
    defaultConfirmMode: 'auto' | 'confirm' | 'deny';
    /** 模块默认超时时间 */
    defaultTimeout: number;
    /** 各工具的权限策略 */
    tools: Array<{
      /** 工具名称 */
      toolName: string;
      /** 确认模式 */
      confirmMode: 'auto' | 'confirm' | 'deny';
      /** 确认提示消息模板 */
      confirmMessage?: string;
      /** 超时时间 */
      timeout?: number;
    }>;
  }>;
}

/**
 * StreamEvent 工厂函数 - 类型安全的创建事件
 */
export const StreamEvents = {
  conversationId: (conversationId: string): StreamEvent => ({
    type: StreamEventType.CONVERSATION_ID,
    payload: { conversationId },
  }),

  textDelta: (delta: string): StreamEvent => ({
    type: StreamEventType.TEXT_DELTA,
    payload: { delta },
  }),

  toolCall: (name: string, args: Record<string, unknown>, result?: unknown): StreamEvent => ({
    type: StreamEventType.TOOL_CALL,
    payload: { name, args, result },
  }),

  reasoningStep: (step: ReasoningStepPayload): StreamEvent => ({
    type: StreamEventType.REASONING_STEP,
    payload: step,
  }),

  sources: (sources: unknown[]): StreamEvent => ({
    type: StreamEventType.SOURCES,
    payload: { sources },
  }),

  done: (payload: DonePayload = {}): StreamEvent => ({
    type: StreamEventType.DONE,
    payload,
  }),

  error: (message: string, code?: string): StreamEvent => ({
    type: StreamEventType.ERROR,
    payload: { message, code },
  }),

  clientToolCall: (moduleName: string, callId: string, toolName: string, args: Record<string, unknown>): StreamEvent => ({
    type: StreamEventType.CLIENT_TOOL_CALL,
    payload: { moduleName, callId, toolName, args },
  }),

  clientToolResult: (moduleName: string, callId: string, success: boolean, result?: unknown, error?: string): StreamEvent => ({
    type: StreamEventType.CLIENT_TOOL_RESULT,
    payload: { moduleName, callId, success, result, error },
  }),

  clientToolPolicy: (policies: ClientToolPolicyPayload['policies']): StreamEvent => ({
    type: StreamEventType.CLIENT_TOOL_POLICY,
    payload: { policies },
  }),
};