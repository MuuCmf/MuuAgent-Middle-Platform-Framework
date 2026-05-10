/**
 * 推理步骤接口
 */
export interface ReasoningStep {
  id?: string
  stepNumber: number
  stepType: 'thought' | 'action' | 'observation' | 'final_answer' | 'tool-call'
  content?: string
  thought?: string
  action?: string
  actionInput?: any
  observation?: string
  toolOutput?: any
  toolName?: string
  toolArgs?: any
  toolCallId?: string
  args?: any
  costMs?: number
  createdAt?: string
}

/**
 * 流式响应类型
 */
export interface StreamResponse {
  type: 'chunk' | 'tool' | 'error' | 'done' | 'reasoning_step'
  content?: string
  skill?: string
  name?: string
  result?: any
  args?: any
  steps?: ReasoningStep[]
  step?: ReasoningStep
  reasoningMode?: string
  response?: string
}
