/**
 * 推理模式枚举
 */
export enum ReasoningMode {
  NONE = 'NONE',
  REACT = 'REACT',
  PLAN = 'PLAN',
  REFLECT = 'REFLECT',
}

/**
 * ReAct 步骤类型
 */
export enum StepType {
  THOUGHT = 'thought',
  ACTION = 'action',
  OBSERVATION = 'observation',
  FINAL_ANSWER = 'final_answer',
}

/**
 * 推理步骤接口
 */
export interface ReasoningStep {
  stepNumber: number;
  stepType: StepType;
  content?: string;
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
  toolOutput?: unknown;
  costMs?: number;
}

/**
 * ReAct 解析结果
 */
export interface ReActParseResult {
  type: StepType;
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
  rawContent: string;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  agent: any;
  model: any;
  userMessage: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxSteps: number;
  temperature: number;
  conversationHistory?: ConversationMessage[];
  mcpServerConfigs?: any[];
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  type: 'skill' | 'mcp' | 'kb';
}

/**
 * 对话消息
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  response: string;
  steps: ReasoningStep[];
  totalCostMs: number;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage?: string;
}

/**
 * LLM调用函数类型
 */
export type CallLLMFn = (
  systemPrompt: string,
  userMessage: string,
) => Promise<{ response: string; inputTokens?: number; outputTokens?: number }>;
