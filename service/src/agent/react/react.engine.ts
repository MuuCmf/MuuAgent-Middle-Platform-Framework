import { Injectable, Logger } from '@nestjs/common';
import {
  ReasoningStep,
  StepType,
  ExecutionContext,
  ExecutionResult,
  ToolDefinition,
} from './react.types';
import { ReActPromptBuilder } from './react.prompt';
import { ReActParser } from './react.parser';
import { SkillService } from '../../skill/skill.service';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { KbSearchTool } from '../tools/kb-search.tool';
import { CallLLMFn } from './react.types';

/**
 * ReAct 推理引擎
 */
@Injectable()
export class ReActEngine {
  private readonly logger = new Logger(ReActEngine.name);

  constructor(
    private skillService: SkillService,
    private mcpServerService: McpServerService,
    private kbSearchTool: KbSearchTool,
  ) {}

  /**
   * 执行 ReAct 推理循环
   */
  async execute(
    context: ExecutionContext,
    callLLM: CallLLMFn,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // 构建系统提示词
    const systemPrompt = ReActPromptBuilder.buildSystemPrompt(
      context.systemPrompt,
      context.tools,
    );

    let currentPrompt = context.userMessage;
    let finalResponse = '';
    let success = true;
    let errorMessage: string | undefined;

    try {
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`ReAct Step ${i + 1}: Calling LLM`);

        // 调用 LLM
        const llmResult = await callLLM(systemPrompt, currentPrompt);

        if (llmResult.inputTokens) totalInputTokens += llmResult.inputTokens;
        if (llmResult.outputTokens) totalOutputTokens += llmResult.outputTokens;

        // 解析响应
        const parseResult = ReActParser.parse(llmResult.response);
        this.logger.debug(`Parse result type: ${parseResult.type}`);

        // 处理最终答案
        if (parseResult.type === StepType.FINAL_ANSWER) {
          finalResponse = parseResult.finalAnswer || llmResult.response;

          steps.push({
            stepNumber: i + 1,
            stepType: StepType.FINAL_ANSWER,
            content: finalResponse,
            thought: parseResult.thought,
          });

          break;
        }

        // 处理行动
        if (parseResult.type === StepType.ACTION && parseResult.action) {
          const stepStartTime = Date.now();

          const step: ReasoningStep = {
            stepNumber: i + 1,
            stepType: StepType.ACTION,
            content: `调用工具: ${parseResult.action}`,
            thought: parseResult.thought,
            action: parseResult.action,
            actionInput: parseResult.actionInput,
          };

          try {
            // 执行工具
            const toolResult = await this.executeTool(
              parseResult.action,
              parseResult.actionInput || {},
              context,
            );

            const observation = typeof toolResult === 'object'
              ? JSON.stringify(toolResult, null, 2)
              : String(toolResult);

            step.observation = observation;
            step.toolOutput = toolResult;
            step.costMs = Date.now() - stepStartTime;

            steps.push(step);

            // 构建下一步提示
            currentPrompt = ReActPromptBuilder.buildNextPrompt(
              context.userMessage,
              steps,
            );
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '执行失败';
            step.observation = `错误: ${errorMsg}`;
            step.costMs = Date.now() - stepStartTime;
            steps.push(step);

            // 继续尝试其他方案
            currentPrompt = ReActPromptBuilder.buildNextPrompt(
              context.userMessage,
              steps,
              step.observation,
            );
          }
        }
      }

      // 如果达到最大步数还没有最终答案
      if (!finalResponse) {
        finalResponse = '抱歉，我无法在有限的步骤内完成您的请求。';
        success = false;
        errorMessage = '达到最大执行步数';
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : '执行失败';
      finalResponse = `执行出错: ${errorMessage}`;
      this.logger.error(`ReAct execution failed: ${errorMessage}`);
    }

    return {
      success,
      response: finalResponse,
      steps,
      totalCostMs: Date.now() - startTime,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      errorMessage,
    };
  }

  /**
   * 执行工具
   */
  private async executeTool(
    action: string,
    actionInput: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    // 知识库检索工具
    if (action === 'kb_search') {
      const kbCodes: string[] = JSON.parse(context.agent.knowledgeBases || '[]');
      return this.kbSearchTool.execute(
        context.agent.id,
        kbCodes,
        actionInput as any,
      );
    }

    // MCP 工具
    if (action.startsWith('mcp:')) {
      const mcpServerConfigs = context.mcpServerConfigs || [];
      return this.mcpServerService.callTool(
        mcpServerConfigs,
        action,
        actionInput,
      );
    }

    // 技能工具
    return this.skillService.execute({
      skillCode: action,
      params: actionInput,
    });
  }
}
