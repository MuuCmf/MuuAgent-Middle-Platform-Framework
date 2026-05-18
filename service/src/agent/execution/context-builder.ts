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
import { AgentKbService } from '../agent-kb.service';
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
    private readonly agentKbService: AgentKbService,
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

    let boundSkillCodes: string[] = [];
    try {
      boundSkillCodes = JSON.parse(agent.skills || '[]');
    } catch {}

    const isolationContext: IsolationContext = { appCode: agent.appCode || null, isSuperAdmin: false };
    const boundSkills = await this.resolveSkillsWithDependencies(boundSkillCodes, isolationContext);

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

    tools.push({
      name: 'use_skill',
      description: `按需加载指定技能的完整指令。可用技能: ${availableSkillNames}。当需要技能的详细操作步骤、API参数格式或执行注意事项时调用此工具。`,
      parameters: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            description: `要加载的技能名称。可用: ${availableSkillNames}`,
          },
        },
        required: ['skill_name'],
      },
      type: 'skill-meta' as const,
    });

    tools.push({
      name: 'load_reference',
      description: '加载技能的参考文档（references/ 中的文件）。当技能指令中引用了附加文档时使用。',
      parameters: {
        type: 'object',
        properties: {
          skill_name: { type: 'string', description: '技能名称' },
          reference_path: { type: 'string', description: '参考文档的相对路径' },
        },
        required: ['skill_name', 'reference_path'],
      },
      type: 'skill-meta' as const,
    });

    const hasScriptedSkills = boundSkills.some(s => s.metadata.hasScripts);
    if (hasScriptedSkills) {
      tools.push({
        name: 'run_script',
        description: `执行技能预置的脚本（位于技能目录 scripts/ 中）。使用前必须先通过 use_skill 加载技能指令。`,
        parameters: {
          type: 'object',
          properties: {
            skill_name: { type: 'string', description: `技能名称。可用: ${availableSkillNames}` },
            script: { type: 'string', description: '脚本路径' },
            args: { type: 'object', description: '传递给脚本的参数' },
            timeout: { type: 'number', description: '超时（毫秒）' },
          },
          required: ['skill_name', 'script'],
        },
        type: 'skill-meta' as const,
      });
    }

    tools.push({
      name: 'http_request',
      description: '发起 HTTP 请求。用于调用外部 API、发送 webhook、获取远程数据等。',
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], description: 'HTTP 方法' },
          url: { type: 'string', description: '完整的请求 URL' },
          headers: { type: 'object', description: '请求头' },
          query: { type: 'object', description: 'URL 查询参数' },
          body: { description: '请求体' },
          timeout: { type: 'number', description: '超时（毫秒）' },
        },
        required: ['method', 'url'],
      },
      type: 'builtin' as const,
    });

    tools.push({
      name: 'run_code',
      description: '在安全沙箱中执行代码。支持 JavaScript、Python 和 Bash。',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['javascript', 'python', 'bash'], description: '代码语言' },
          code: { type: 'string', description: '要执行的代码' },
          params: { type: 'object', description: '传递给代码的参数' },
          timeout: { type: 'number', description: '超时（毫秒）' },
        },
        required: ['language', 'code'],
      },
      type: 'builtin' as const,
    });

    tools.push({
      name: 'db_query',
      description: '执行只读数据库查询（仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN）。',
      parameters: {
        type: 'object',
        properties: {
          host: { type: 'string', description: '数据库主机地址' },
          port: { type: 'number', description: '端口' },
          user: { type: 'string', description: '数据库用户名' },
          password: { type: 'string', description: '数据库密码' },
          database: { type: 'string', description: '数据库名称' },
          sql: { type: 'string', description: 'SQL 查询语句' },
          params: { type: 'object', description: 'SQL 参数' },
          max_rows: { type: 'number', description: '最大返回行数' },
          timeout: { type: 'number', description: '超时（毫秒）' },
        },
        required: ['host', 'user', 'password', 'database', 'sql'],
      },
      type: 'builtin' as const,
    });

    if (dto.workspace && agent.workspaceConfig) {
      const config = typeof agent.workspaceConfig === 'string'
        ? JSON.parse(agent.workspaceConfig)
        : agent.workspaceConfig;

      if (config.enabled) {
        const workspaceTools = WORKSPACE_TOOLS.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
          type: 'workspace' as const,
        }));
        tools.push(...workspaceTools);
      }
    }

    const registeredTools = this.toolRegistry.getAll();
    for (const tool of registeredTools) {
      const existing = tools.find(t => t.name === tool.definition.name);
      if (!existing) {
        tools.push(tool.definition);
      }
    }

    return tools;
  }

  private async resolveSkillsWithDependencies(skillCodes: string[], isolationContext: IsolationContext): Promise<SkillDescriptor[]> {
    const resolved: SkillDescriptor[] = [];
    const visited = new Set<string>();

    for (const code of skillCodes) {
      await this.resolveSkillRecursive(code, isolationContext, visited, resolved);
    }

    return resolved;
  }

  private async resolveSkillRecursive(
    code: string,
    isolationContext: IsolationContext,
    visited: Set<string>,
    resolved: SkillDescriptor[],
  ): Promise<void> {
    if (visited.has(code)) return;
    visited.add(code);

    const skill = await this.skillRegistry.resolve(code, isolationContext);
    if (!skill) {
      this.logger.warn(`技能 ${code} 不存在或无法解析`);
      return;
    }

    if (skill.frontmatter?.requires?.skills) {
      for (const depCode of skill.frontmatter.requires.skills) {
        await this.resolveSkillRecursive(depCode, isolationContext, visited, resolved);
      }
    }

    resolved.push(skill);
  }

  private async addMcpTools(tools: ToolDefinition[], serverName: string): Promise<void> {
    const serverConfig = this.mcpServerRegistry.get(serverName);
    if (!serverConfig) {
      this.logger.warn(`MCP Server ${serverName} 未在注册表中找到`);
      return;
    }

    try {
      const toolsResult = await this.mcpServerService.discoverTools({
        url: serverConfig.url,
        apiKey: serverConfig.apiKey,
        timeout: 30000,
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
      const params = JSON.stringify(t.parameters, null, 2);
      return `- ${t.name}: ${t.description}\n参数: ${params}`;
    }).join('\n');

    if (toolDescriptions) {
      systemPrompt = `${systemPrompt}\n\n## 可用工具\n\n${toolDescriptions}`;
    }

    return systemPrompt;
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

    const customParams = typeof agent.customModelParams === 'string'
      ? JSON.parse(agent.customModelParams)
      : agent.customModelParams || {};

    return mergeModelParams({
      templateParams,
      customParams,
    });
  }
}