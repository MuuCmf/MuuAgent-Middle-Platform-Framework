import { Injectable, Logger } from '@nestjs/common';
import { AgentChatDto } from '../dto/agent.dto';
import { ExecutionContext } from './execution-context';
import { IsolationContext } from '../../common/services/base-isolated.service';
import { ModelRoutingService } from '../../model-routing/model-routing.service';
import { IntentClassifierService } from '../../intent/intent.service';
import { ConversationService } from '../../conversation/conversation.service';
import { AgentSkills } from '../types/agent-skills';
import { SkillResolutionBuilder } from './skill-resolution.builder';
import { ToolAssemblyBuilder } from './tool-assembly.builder';
import { SystemPromptBuilder } from './system-prompt.builder';
import { ModelParamsBuilder } from './model-params.builder';
import { SkillKbService } from '../../skill/skill-kb.service';
import { HybridRetrievalService } from '../hybrid-retrieval.service';
import type { ModelMessage } from 'ai';
import { ConversationType } from '../../conversation/dto/create-conversation.dto';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';

@Injectable()
export class ContextBuilder {
  private readonly logger = new Logger(ContextBuilder.name);

  constructor(
    private readonly mcpService: ModelRoutingService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly conversationService: ConversationService,
    private readonly skillResolution: SkillResolutionBuilder,
    private readonly toolAssembly: ToolAssemblyBuilder,
    private readonly systemPrompt: SystemPromptBuilder,
    private readonly modelParams: ModelParamsBuilder,
    private readonly skillKbService: SkillKbService,
    private readonly hybridRetrievalService: HybridRetrievalService,
    private readonly promptTemplateService: PromptTemplateService,
  ) {}

  async build(
    dto: AgentChatDto,
    agent: any,
    uid?: string,
    isolationContext?: IsolationContext,
  ): Promise<ExecutionContext> {
    this.logger.debug(`buildExecutionContext: agentId=${dto.agentId}, uid=${uid}`);

    const userMessage = dto.message || '';
    const intentResult = await this.intentClassifier.classify(userMessage);
    const intent = intentResult.intent;
    const intentModelType = this.intentClassifier.getModelTypeForIntent(intent);
    this.logger.debug(`意图分类: intent=${intent}, modelType=${intentModelType}, confidence=${intentResult.confidence}`);

    let model;
    if (dto.modelCode && dto.modelCode !== 'mcp') {
      model = await this.mcpService.selectModelByIntent(intentModelType, intent, dto.modelCode);
      this.logger.debug(`使用指定模型: ${dto.modelCode}`);
    } else {
      model = await this.mcpService.selectModelByIntent(intentModelType, intent);
      this.logger.debug(`MCP调度选择模型: ${model?.code || 'none'}`);
    }

    if (!model) {
      throw new Error('没有可用的模型');
    }

    const conversation = await this.conversationService.getOrCreate(
      ConversationType.AGENT,
      agent.id,
      dto.conversationId,
      uid,
      isolationContext,
    );

    this.logger.debug(`对话ID: ${conversation.id}`);

    const conversationHistory = await this.buildConversationHistory(conversation);

    const isoCtx: IsolationContext = isolationContext || { appCode: agent.appCode || null, skipIsolation: false };
    const agentSkills = AgentSkills.fromJson(agent.skills);
    const agentMcpServers = agent.mcpServers ? JSON.parse(agent.mcpServers) : [];
    this.logger.debug(`Agent MCP Servers: ${JSON.stringify(agentMcpServers)}`);
    const resolution = await this.skillResolution.resolve(agentSkills, isoCtx, agentMcpServers);
    this.logger.debug(`Resolved MCP Servers: ${JSON.stringify(resolution.resolvedMcpServers)}`);

    const resolvedKbCodes = await this.skillKbService.getAgentKbCodes(String(agent.id), isoCtx);

    const kbRetrievalConfig = this.hybridRetrievalService.parseConfig(agent);
    this.logger.debug(`知识库检索策略: ${kbRetrievalConfig.strategy}`);

    const shouldAutoRetrieve = this.hybridRetrievalService.shouldAutoRetrieve(
      kbRetrievalConfig,
      userMessage,
      conversationHistory,
    );

    let autoRetrievalResult;
    const enableToolRetrieval = this.hybridRetrievalService.shouldEnableToolRetrieval(kbRetrievalConfig);
    const toolConfig = this.hybridRetrievalService.getToolRetrievalConfig(kbRetrievalConfig);

    const tools = await this.toolAssembly.buildTools(
      resolution,
      resolvedKbCodes,
      agent,
      enableToolRetrieval,
      toolConfig,
      uid,
    );

    // Resolve reasoningPrompt template code before passing to system prompt
    if (agent.reasoningPrompt) {
      agent = { ...agent, reasoningPrompt: await this.resolveReasoningPrompt(agent.reasoningPrompt, isolationContext) };
    }
    let finalSystemPrompt = this.systemPrompt.build(agent, tools);

    if (dto.workspace?.dirName) {
      const hasWorkspaceTool = tools.some(t => WORKSPACE_TOOL_NAMES.has(t.name));
      if (hasWorkspaceTool) {
        const toolNames = [...WORKSPACE_TOOL_NAMES].join('、');
        finalSystemPrompt = `## 工作目录: ${dto.workspace.dirName}\n${toolNames} 等文件工具皆相对于此目录执行。\n\n${finalSystemPrompt}`;
      }
    }

    if (shouldAutoRetrieve && resolvedKbCodes.length > 0) {
      this.logger.debug(`执行自动检索...`);
      autoRetrievalResult = await this.hybridRetrievalService.executeAutoRetrieval(
        agent.id,
        userMessage,
        finalSystemPrompt,
        agentSkills,
        kbRetrievalConfig,
        isoCtx,
      );

      if (autoRetrievalResult.success && autoRetrievalResult.augmentedSystemPrompt) {
        finalSystemPrompt = autoRetrievalResult.augmentedSystemPrompt;
        this.logger.debug(`系统提示词已增强, 检索到${autoRetrievalResult.chunks.length}条内容`);
      }
    }

    const mergedParams = await this.modelParams.build(agent);

    const context = new ExecutionContext();
    context.agent = agent;
    context.model = model;
    context.userMessage = userMessage;
    context.systemPrompt = finalSystemPrompt;
    context.tools = tools;
    context.maxSteps = agent.maxSteps || 5;
    context.temperature = mergedParams.temperature!;
    context.topP = mergedParams.topP!;
    context.maxTokens = mergedParams.maxTokens!;
    context.conversationHistory = conversationHistory;
    context.conversation = conversation;
    context.conversationId = String(conversation.id);
    context.isolationContext = isoCtx;
    context.uid = uid;
    context.userAgent = 'agent-service';
    context.kbRetrievalConfig = kbRetrievalConfig;
    context.autoRetrievalResult = autoRetrievalResult;
    context.resolvedKbCodes = resolvedKbCodes;

    return context;
  }

  private async buildConversationHistory(conversation: any): Promise<ModelMessage[]> {
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id, 20);
      return historyMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }
    return [];
  }

  /**
   * 解析 reasoningPrompt 模板代码
   * 如果 reasoningPrompt 是一个已知的模板代码（如 "react-reasoning-default"），
   * 则解析为实际模板内容；否则原样返回。
   * @param reasoningPrompt 推理提示词原始值
   * @returns 解析后的推理提示词内容
   */
  private async resolveReasoningPrompt(reasoningPrompt: string, isolationContext?: IsolationContext): Promise<string> {
    try {
      const template = await this.promptTemplateService.findByCode(reasoningPrompt, isolationContext);
      if (template) {
        this.logger.warn(
          `reasoningPrompt 是模板代码 "${reasoningPrompt}"，而非实际提示词。` +
          `模板代码应通过 promptTemplateCode 字段配置。将回退到默认推理提示词。`,
        );
        return '';
      }
    } catch (err) {
      this.logger.debug(`reasoningPrompt 非模板代码，使用原始值: ${reasoningPrompt}`);
    }
    return reasoningPrompt;
  }
}
