import { Model } from '@prisma/client';
import type { Tool, ModelMessage, ToolChoice } from 'ai';

/**
 * Token 使用统计接口
 */
export interface TokenUsage {
  /** 输入 Token 数 */
  promptTokens: number;
  /** 输出 Token 数 */
  completionTokens: number;
  /** 总 Token 数 */
  totalTokens: number;
}

/**
 * 工具调用接口
 */
export interface ToolCall {
  /** 工具调用 ID */
  toolCallId: string;
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  args: Record<string, unknown>;
}

/**
 * 推理步骤接口
 */
export interface ReasoningStep {
  /** 步骤编号 */
  stepNumber: number;
  /** 步骤类型 */
  stepType: string;
  /** 内容 */
  content?: string;
  /** 思考 */
  thought?: string;
  /** 动作 */
  action?: string;
  /** 动作输入 */
  actionInput?: Record<string, unknown>;
  /** 观察 */
  observation?: string;
  /** 工具输出 */
  toolOutput?: unknown;
  /** 工具调用 ID */
  toolCallId?: string;
  /** 工具调用名称 */
  toolCallName?: string;
  /** 耗时 */
  costMs?: number;
}

/**
 * 执行选项接口
 */
export interface ExecutionOptions {
  /** 温度参数 */
  temperature?: number;
  /** 最大 Token 数 */
  maxTokens?: number;
  /** 工具选择策略 */
  toolChoice?: ToolChoice<Record<string, Tool>>;
  /** 是否流式 */
  stream?: boolean;
  /** 超时时间 */
  timeout?: number;
}

/**
 * 调用上下文接口
 */
export interface ExecutionContext {
  /** 请求唯一标识 */
  requestId: string;
  /** 开始时间 */
  startTime: number;
  /** 客户端 IP */
  clientIp: string;
  /** 用户代理 */
  userAgent?: string;
  /** 用户唯一标识 */
  uid?: string;
  /** 应用编码 */
  appCode?: string;
  /** 会话 ID */
  conversationId?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 执行参数接口
 */
export interface ExecutionParams {
  /** 模型配置 */
  model: Model;
  /** 系统提示 */
  system?: string;
  /** 消息列表 */
  messages: ModelMessage[];
  /** 工具定义 */
  tools?: Record<string, Tool>;
  /** 执行选项 */
  options?: ExecutionOptions;
  /** 调用上下文 */
  context: ExecutionContext;
}

/**
 * 执行结果接口
 */
export interface ExecutionResult {
  /** 响应内容 */
  content: string;
  /** 完成原因 */
  finishReason: 'stop' | 'length' | 'tool-calls' | 'content-filter' | string;
  /** Token 使用统计 */
  usage?: TokenUsage;
  /** 工具调用列表 */
  toolCalls?: ToolCall[];
  /** 推理步骤 */
  steps?: ReasoningStep[];
  /** 原始响应（调试用） */
  raw?: unknown;
}

/**
 * 流式响应块接口
 */
export interface StreamChunk {
  /** 块类型 */
  type: 'text-delta' | 'tool-call' | 'finish' | 'error';
  /** 文本增量 */
  delta?: string;
  /** 工具调用 */
  toolCall?: ToolCall;
  /** 完成信息 */
  finish?: {
    reason: string;
    usage?: TokenUsage;
  };
  /** 错误信息 */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * 模型执行器接口
 */
export interface IModelExecutor {
  /**
   * 执行同步调用
   * @param params 执行参数
   * @returns 执行结果
   */
  execute(params: ExecutionParams): Promise<ExecutionResult>;

  /**
   * 执行流式调用
   * @param params 执行参数
   * @returns 流式响应块迭代器
   */
  stream(params: ExecutionParams): AsyncIterable<StreamChunk>;
}
