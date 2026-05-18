import { Injectable, Logger } from '@nestjs/common';
import { AgentChatDto } from '../dto/agent.dto';
import { ExecutionContext } from './execution-context';
import { IsolationContext } from '../../common/services/base-isolated.service';
import { ModelRoutingService } from '../../model-routing/model-routing.service';
import { IntentClassifierService } from '../../intent/intent.service';
import { ConversationService } from '../../conversation/conversation.service';
import { PromptTemplateService } from '../../prompt-template/prompt-template.service';
import { ModelTemplateService } from '../../model-template/model-template.service';
import { ToolRegistry } from '../tools/tool-registry';
import { SkillKbService } from '../../skill/skill-kb.service';
import { SkillRegistry, SkillDescriptor } from '../../skill/skill-registry';
import { WorkspaceToolHandler } from '../../workspace/workspace-tool.handler';
import { WORKSPACE_TOOLS } from '../../workspace/workspace-tool.definitions';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import { ReasoningMode } from '../react/react.types';
import { mergeModelParams, ModelParams, SYSTEM_DEFAULTS } from '../../common/utils/model-params.util';
import type { ModelMessage } from 'ai';
import { ConversationType } from '../../conversation/dto/create-conversation.dto';
import { KbSearchTool } from '../tools/kb-search.tool';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { McpServerRegistry } from '../../mcp-server/mcp-server-registry';

@Injectable()
export class ContextBuilder {
  private readonly logger = new Logger(ContextBuilder.name);

  constructor(
    private readonly mcpService: ModelRoutingService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly conversationService: ConversationService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly modelTemplateService: ModelTemplateService,
    private readonly toolRegistry: ToolRegistry,
    private readonly skillKbService: SkillKbService,
    private readonly skillRegistry: SkillRegistry,
    private readonly workspaceToolHandler: WorkspaceToolHandler,
    private readonly kbSearchTool: KbSearchTool,
    private readonly mcpServerService: McpServerService,
    private readonly mcpServerRegistry: McpServerRegistry,
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

    const tools = await this.buildTools(agent, dto);

    const systemPrompt = await this.buildSystemPrompt(agent, tools);

    const mergedParams = await this.getMergedModelParams(agent);

    const context = new ExecutionContext();
    context.agent = agent;
    context.model = model;
    context.userMessage = userMessage;
    context.systemPrompt = systemPrompt;
    context.tools = tools;
    context.maxSteps = agent.maxSteps || 5;
    context.temperature = mergedParams.temperature!;
    context.topP = mergedParams.topP!;
    context.maxTokens = mergedParams.maxTokens!;
    context.conversationHistory = conversationHistory;
    context.conversation = conversation;
    context.conversationId = String(conversation.id);
    context.isolationContext = isolationContext || { appCode: null, isSuperAdmin: false };
    context.uid = uid;

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

  private async buildTools(agent: any, dto: AgentChatDto): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    let boundSkillNames: string[] = [];
    try {
      boundSkillNames = JSON.parse(agent.skills || '[]');
    } catch {}

    const isolationContext: IsolationContext = { appCode: agent.appCode || null, isSuperAdmin: false };
    const boundSkills = await this.resolveSkillsWithDependencies(boundSkillNames, isolationContext);

    const availableSkillNames = boundSkills.map(s => s.metadata.name).join(', ') || '无';

    const resolvedMcpServers = new Set<string>();
    const resolvedKbCodes = new Set<string>();

    for (const skill of boundSkills) {
      if (skill.frontmatter?.requires) {
        const requires = skill.frontmatter.requires;

        if (requires.mcpServers) {
          for (const serverName of requires.mcpServers) {
            if (!resolvedMcpServers.has(serverName)) {
              resolvedMcpServers.add(serverName);
              await this.addMcpTools(tools, serverName);
            }
          }
        }

        if (requires.knowledgeBases) {
          for (const kbCode of requires.knowledgeBases) {
            resolvedKbCodes.add(kbCode);
          }
        }
      }
    }

    if (resolvedKbCodes.size > 0) {
      const kbTool = await this.kbSearchTool.getToolDefinition(agent.id, Array.from(resolvedKbCodes));
      if (kbTool) {
        tools.push({
          name: kbTool.name,
          description: kbTool.description,
          parameters: kbTool.parameters,
          type: 'kb' as const,
        });
      }
    }

    const registeredTools = this.toolRegistry.getAll();
    for (const tool of registeredTools) {
      const def = tool.definition;
      
      if (def.name === 'use_skill') {
        tools.push({
          ...def,
          description: `按需加载指定技能的完整指令。可用技能: ${availableSkillNames}。当需要技能的详细操作步骤、API参数格式或执行注意事项时调用此工具。`,
          parameters: {
            ...def.parameters,
            properties: {
              skill_name: {
                type: 'string',
                description: `要加载的技能名称。可用: ${availableSkillNames}`,
              },
            },
          },
        });
      } else if (def.name === 'run_script') {
        const hasScriptedSkills = boundSkills.some(s => s.metadata.hasScripts);
        if (hasScriptedSkills) {
          tools.push({
            ...def,
            parameters: {
              ...def.parameters,
              properties: {
                ...def.parameters.properties,
                skill_name: {
                  type: 'string',
                  description: `技能名称。可用: ${availableSkillNames}`,
                },
              },
            },
          });
        }
      } else if (def.name === 'run_code') {
        tools.push(def);
      } else {
        const existing = tools.find(t => t.name === def.name);
        if (!existing) {
          tools.push(def);
        }
      }
    }

    if (dto.workspace && agent.workspaceConfig) {
      const config = typeof agent.workspaceConfig === 'string'
        ? JSON.parse(agent.workspaceConfig)
        : agent.workspaceConfig;

      if (config.enabled) {
        tools.push(...WORKSPACE_TOOLS);
      }
    }

    return tools;
  }

  private async resolveSkillsWithDependencies(skillNames: string[], isolationContext: IsolationContext): Promise<SkillDescriptor[]> {
    const resolved: SkillDescriptor[] = [];
    const visited = new Set<string>();

    for (const name of skillNames) {
      await this.resolveSkillRecursive(name, isolationContext, visited, resolved);
    }

    return resolved;
  }

  private async resolveSkillRecursive(
    name: string,
    isolationContext: IsolationContext,
    visited: Set<string>,
    resolved: SkillDescriptor[],
  ): Promise<void> {
    if (visited.has(name)) return;
    visited.add(name);

    const skill = await this.skillRegistry.resolve(name, isolationContext);
    if (!skill) {
      this.logger.warn(`技能 "${name}" 不存在或无法解析`);
      return;
    }

    if (skill.frontmatter?.requires?.skills) {
      for (const depName of skill.frontmatter.requires.skills) {
        await this.resolveSkillRecursive(depName, isolationContext, visited, resolved);
      }
    }

    resolved.push(skill);
  }

  private async addMcpTools(tools: ToolDefinition[], serverName: string): Promise<void> {
    const serverConfig = await this.mcpServerRegistry.get(serverName);
    if (!serverConfig) {
      this.logger.warn(`MCP Server ${serverName} 未在注册表中找到`);
      return;
    }

    try {
      const toolsResult = await this.mcpServerService.discoverTools({
        url: serverConfig.url,
        apiKey: serverConfig.apiKey,
        timeout: serverConfig.timeout || 30000,
      });

      if (Array.isArray(toolsResult)) {
        tools.push(...toolsResult.map(t => ({
          name: `mcp__${serverName}__${t.name}`,
          description: t.description || '',
          parameters: t.inputSchema || { type: 'object', properties: {} },
          type: 'mcp' as const,
        })));
      }
    } catch (e) {
      this.logger.warn(`从 MCP Server ${serverName} 发现工具失败: ${e}`);
    }
  }

  private async buildSystemPrompt(agent: any, tools: ToolDefinition[]): Promise<string> {
    let systemPrompt = agent.systemPrompt || '';

    if (agent.reasoningMode && agent.reasoningMode !== 'NONE') {
      const reasoningPrompt = agent.reasoningPrompt || this.getDefaultReasoningPrompt(agent.reasoningMode);
      systemPrompt = reasoningPrompt + '\n\n' + systemPrompt;
    }

    const toolDescriptions = tools.map(t => {
      const simplifiedParams = this.simplifyParameters(t.parameters);
      return `- ${t.name}: ${t.description}\n参数: ${simplifiedParams}`;
    }).join('\n');

    if (toolDescriptions) {
      systemPrompt = `${systemPrompt}\n\n## 可用工具\n\n${toolDescriptions}`;
    }

    return systemPrompt;
  }

  private simplifyParameters(parameters: any): string {
    if (!parameters || !parameters.properties) {
      return '{}';
    }

    const required = parameters.required || [];
    const props = parameters.properties;
    const simplified: Record<string, string> = {};

    for (const [key, value] of Object.entries(props)) {
      const prop = value as any;
      const isRequired = required.includes(key);
      const typeDesc = prop.type || 'any';
      const enumDesc = prop.enum ? ` (${prop.enum.join('|')})` : '';
      const desc = prop.description ? ` - ${prop.description}` : '';
      const reqMark = isRequired ? '*' : '';
      
      simplified[key] = `${typeDesc}${enumDesc}${reqMark}${desc}`;
    }

    return JSON.stringify(simplified, null, 0);
  }

  private getDefaultReasoningPrompt(mode: string): string {
    switch (mode) {
      case ReasoningMode.REACT:
        return `## 推理规则
你是一个能够使用工具的智能助手。请按照以下格式进行思考和操作：

思考：我需要分析当前问题，决定是否需要调用工具。
行动：<工具名称>(<参数>)
结果：工具返回的结果
...（重复）
最终答案：基于所有信息给出最终回答

请仔细思考何时需要调用工具，何时可以直接回答。`;
      case ReasoningMode.PLAN:
        return `## 推理规则
你是一个能够进行规划的智能助手。请按照以下步骤操作：

1. 分析问题，制定详细的执行计划
2. 按照计划逐步执行，调用必要的工具
3. 汇总结果，给出最终答案

请先输出你的计划，然后逐步执行。`;
      case ReasoningMode.REFLECT:
        return `## 推理规则
你是一个具有反思能力的智能助手。在执行过程中，请定期反思：
- 我当前的思路是否正确？
- 是否有更好的方法？
- 是否遗漏了重要信息？

请在每两步操作后进行一次反思。`;
      default:
        return '';
    }
  }

  private async getMergedModelParams(agent: any): Promise<ModelParams> {
    let templateParams: ModelParams | null = null;
    if (agent.modelTemplateCode) {
      try {
        const template = await this.modelTemplateService.findByCode(agent.modelTemplateCode);
        templateParams = {
          temperature: template.temperature,
          topP: template.topP,
          maxTokens: template.maxTokens,
        };
      } catch {
        // 模板不存在，使用默认值
      }
    }

    let customParams: ModelParams = {};
    if (agent.customModelParams) {
      try {
        if (typeof agent.customModelParams === 'string') {
          if (agent.customModelParams.trim()) {
            customParams = JSON.parse(agent.customModelParams);
          }
        } else {
          customParams = agent.customModelParams;
        }
      } catch (error) {
        this.logger.warn(`解析自定义模型参数失败: ${error}`);
      }
    }

    return mergeModelParams({
      templateParams,
      customParams,
    });
  }
}