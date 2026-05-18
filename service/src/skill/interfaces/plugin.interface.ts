/**
 * 函数执行结果
 */
export interface FunctionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  duration?: number;
}
