import { Injectable, Logger, NotFoundException, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { ModelRoutingService } from "../model-routing/model-routing.service";
import { IntentClassifierService } from '../intent/intent.service';
import { AgentKbService } from './agent-kb.service';
import { KbSearchTool } from './tools/kb-search.tool';
import { ToolExecutor, ToolCall, ToolExecutionResult } from './tools/tool-executor';
import { BUILTIN_TOOL_DEFINITIONS } from './tools/tool-definitions';
import { ReasoningMode, ToolDefinition } from './react/react.types';
import { PromptTemplateService } from '../prompt-template/prompt-template.service';
import { ModelTemplateService } from '../model-template/model-template.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationType } from '../conversation/dto/create-conversation.dto';
import { IsolationService, IsolationContext } from '../common/services/base-isolated.service';
import { mergeModelParams, ModelParams, SYSTEM_DEFAULTS } from '../common/utils/model-params.util';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
  WorkspaceAgentConfig,
  CustomModelParams,
} from './dto/agent.dto';
import { AiService } from '../ai/ai.service';
import { ToolNameSanitizer } from '../ai/providers/tool-name-sanitizer';
import { parseAiError, getErrorCode } from '../ai/utils/error-parser';
import type { ModelMessage } from 'ai';
import { StreamEmitter, StreamEvents } from '../stream';
import { WorkspaceToolHandler } from '../workspace/workspace-tool.handler';
import { WORKSPACE_TOOLS, WORKSPACE_TOOL_NAMES } from '../workspace/workspace-tool.definitions';
import { SkillRegistry, SkillMetadata } from '../skill/skill-registry';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private mcpServerService: McpServerService,
    private agentKbService: AgentKbService,
    private kbSearchTool: KbSearchTool,
    private toolExecutor: ToolExecutor,
    private aiService: AiService,
    private promptTemplateService: PromptTemplateService,
    private modelTemplateService: ModelTemplateService,
    private conversationService: ConversationService,
    private mcpService: ModelRoutingService,
    private intentClassifier: IntentClassifierService,
    private workspaceToolHandler: WorkspaceToolHandler,
    private skillRegistry: SkillRegistry,
    private readonly isolationService: IsolationService,
  ) {}

  async create(dto: CreateAgentDto, context?: IsolationContext) {
    const data = this.isolationService.buildCreateData({
      name: dto.name,
      code: dto.code,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      skills: dto.skills || '[]',
      mcpServers: dto.mcpServers || '[]',
      knowledgeBases: dto.knowledgeBases || '[]',
      maxSteps: dto.maxSteps ?? 5,
      status: dto.status ?? true,
      modelTemplateCode: dto.modelTemplateCode,
      customModelParams: dto.customModelParams,
      reasoningMode: dto.reasoningMode || 'NONE',
      reasoningPrompt: dto.reasoningPrompt,
      kbRetrievalMode: 'tool',
      workspaceConfig: dto.workspaceConfig ? JSON.stringify(dto.workspaceConfig) : null,
      appCode: dto.appCode,
      isPublic: dto.isPublic ?? false,
    }, context || { appCode: null, isSuperAdmin: false });

    return this.prisma.agent.create({ data });
  }

  async update(id: string, dto: UpdateAgentDto, context?: IsolationContext) {
    const where = this.isolationService.buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({ where });
    if (!agent) {
      throw new NotFoundException('智能体不存在或无权限操作');
    }

    const updateData: any = { ...dto };
    if (dto.workspaceConfig !== undefined) {
      updateData.workspaceConfig = dto.workspaceConfig ? JSON.stringify(dto.workspaceConfig) : null;
    }

    return this.prisma.agent.update({
      where: { id: id as any },
      data: updateData,
    });
  }

  async remove(id: string, context?: IsolationContext): Promise<void> {
    const where = this.isolationService.buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({ where });
    if (!agent) {
      throw new NotFoundException('智能体不存在或无权限操作');
    }

    await this.prisma.agent.delete({ where: { id: id as any } });
  }

  async findOne(id: string, context?: IsolationContext) {
    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({
      where: { id, ...isolationWhere },
    });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  async findByCode(code: string, context?: IsolationContext) {
    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({
      where: { code, ...isolationWhere },
    });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  async findAll(query: QueryAgentDto, context?: IsolationContext) {
    const { status, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const where: Record<string, unknown> = { ...isolationWhere };
    if (status !== undefined) where.status = status;

    const [list, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 同步对话
   * @param dto 对话参数
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param appCode 应用标识
   */
   async syncChat(dto: AgentChatDto, clientIp: string, uid?: string, appCode?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const isolationContext: IsolationContext = { appCode: appCode || null, isSuperAdmin: false };
    const agent = await this.getAgent(dto.agentId, isolationContext);
    const context = await this.buildExecutionContext(agent, dto, uid, isolationContext);
    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;

    if (reasoningMode === ReasoningMode.NONE) {
      return this.executeDefaultSyncChat(agent, context, startTime, clientIp, uid, appCode);
    }

    return this.executeReActWithFunctionCallingSync(agent, context, reasoningMode, startTime, clientIp, uid, appCode);
  }

  /**
   * 流式对话（基于 StreamEmitter，推荐使用）
   * @param dto 对话参数
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param emitter 流式发射器
   * @param appCode 应用标识
   */
  async streamChatWithEmitter(
    dto: AgentChatDto,
    clientIp: string,
    uid: string | undefined,
    emitter: StreamEmitter,
    appCode?: string,
  ): Promise<void> {
    this.logger.log(`[AgentStream] streamChat 开始, agentId: ${dto.agentId}`);
    const startTime = Date.now();
    const isolationContext: IsolationContext = { appCode: appCode || null, isSuperAdmin: false };
    const agent = await this.getAgent(dto.agentId, isolationContext);
    this.logger.log(`[AgentStream] 获取到智能体, id: ${agent.id}`);
    const context = await this.buildExecutionContext(agent, dto, uid, isolationContext);
    this.logger.log(`[AgentStream] 构建执行上下文完成`);
    
    if (context.conversationId) {
      emitter.emit(StreamEvents.conversationId(context.conversationId as any));
    }
    
    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;
    this.logger.log(`[AgentStream] reasoningMode: ${reasoningMode}`);

    if (reasoningMode === ReasoningMode.NONE) {
      this.logger.log(`[AgentStream] 执行默认流式模式`);
      await this.executeDefaultStreamWithEmitter(agent, context, startTime, clientIp, uid, emitter, undefined, 0, appCode);
    } else {
      this.logger.log(`[AgentStream] 执行 Function Calling + ReAct 协同架构`);
      await this.executeReActWithFunctionCallingEmitter(
        agent, 
        context, 
        reasoningMode, 
        startTime, 
        clientIp, 
        uid, 
        emitter,
      );
    }
  }

  /**
   * 获取智能体
   * @param agentId 智能体ID或代码
   * @param context 隔离上下文
   */
  private async getAgent(agentId: string, context?: IsolationContext) {
    this.logger.log(`[AgentStream] 获取智能体: ${agentId}`);
    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    
    // 将隔离条件与 id/code 条件合并为 AND 关系，避免两个 OR 同级时后者覆盖前者
    const where = {
      AND: [
        { OR: [{ id: agentId }, { code: agentId }] },
        isolationWhere,
      ],
    };

    let agent;
    try {
      agent = await this.prisma.agent.findFirst({ where });
      this.logger.log(`[AgentStream] 查询结果: ${JSON.stringify(agent)}`);
    } catch (e) {
      this.logger.error(`[AgentStream] 查询智能体失败: ${e}`);
      agent = await this.prisma.agent.findFirst({
        where: { 
          code: agentId,
          ...isolationWhere,
        },
      });
    }

    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    if (!agent.status) {
      throw new HttpException('智能体已禁用', HttpStatus.FORBIDDEN);
    }

    return agent;
  }

  /**
   * 构建执行上下文
   * @param agent 智能体
   * @param dto 对话参数
   * @param uid 用户ID
   */
  private async buildExecutionContext(agent: any, dto: AgentChatDto, uid?: string, isolationContext?: IsolationContext) {
    let model;
    
    this.logger.debug(`buildExecutionContext: dto.agentId=${dto.agentId}, agent.id=${agent.id}, agent.code=${agent.code}, dto.conversationId=${dto.conversationId}, dto.modelCode=${dto.modelCode}`);
    
    // 意图识别：根据用户消息分类意图
    const userMessage = dto.message || '';
    const intentResult = await this.intentClassifier.classify(userMessage);
    const intent = intentResult.intent;
    const intentModelType = this.intentClassifier.getModelTypeForIntent(intent);
    this.logger.debug(`Agent意图分类: intent=${intent}, modelType=${intentModelType}, confidence=${intentResult.confidence}`);

    if (dto.modelCode && dto.modelCode !== 'mcp') {
      // 客户端指定了固定模型，使用意图路由验证能力
      model = await this.mcpService.selectModelByIntent(intentModelType, intent, dto.modelCode);
      this.logger.debug(`使用指定模型(意图路由): ${dto.modelCode}`);
    } else {
      // 使用MCP调度选择最优模型（基于意图）
      model = await this.mcpService.selectModelByIntent(intentModelType, intent);
      this.logger.debug(`MCP调度选择模型(意图路由): ${model?.code || 'none'}`);
    }
    
    if (!model) {
      throw new NotFoundException('没有可用的模型');
    }

    const conversation = await this.conversationService.getOrCreate(
      ConversationType.AGENT,
      agent.id,
      dto.conversationId,
      uid,
      isolationContext,
    );

    this.logger.debug(`buildExecutionContext: conversation.id=${conversation.id as any}, conversation.targetId=${conversation.targetId}, conversation.conversationType=${conversation.conversationType}`);

    let conversationHistory: ModelMessage[] = [];
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id as any, 20);
      conversationHistory = historyMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    let tools: ToolDefinition[] = [];

    if (agent.mcpServers) {
      try {
        const mcpServers = JSON.parse(agent.mcpServers);
        for (const server of mcpServers) {
          if (server && server.url) {
            try {
              const toolsResult = await this.mcpServerService.discoverTools({
                url: server.url,
                apiKey: server.apiKey,
                timeout: server.timeout || 30000,
              });
              if (Array.isArray(toolsResult)) {
                tools.push(...toolsResult.map(t => ({
                  name: `mcp__${server.name || server.url}__${t.name}`,
                  description: t.description || '',
                  parameters: t.inputSchema || { type: 'object', properties: {} },
                  type: 'mcp' as const,
                })));
              }
            } catch (e) {
              this.logger.warn(`Failed to discover tools from MCP server: ${server.name}`);
            }
          }
        }
      } catch (e) {
        this.logger.warn('Failed to parse MCP servers config');
      }
    }

    // ===== 技能工具注入（渐进式披露架构） =====
    let boundSkillCodes: string[] = [];
    try { boundSkillCodes = JSON.parse(agent.skills || '[]'); } catch {}

    // 构建技能清单（L1 元数据）—— SkillRegistry 是唯一数据源
    let skillManifest = '';
    const boundSkills: SkillMetadata[] = [];
    try {
      const allSkills = await this.skillRegistry.listAll(isolationContext);
      for (const s of allSkills) {
        if (boundSkillCodes.includes(s.name)) {
          boundSkills.push(s);
        }
      }
      if (boundSkills.length > 0) {
        skillManifest = boundSkills.map(s =>
          `- **${s.name}** [${s.source}]: ${s.description}`
        ).join('\n');
      }
    } catch (e) {
      this.logger.warn('构建技能清单失败:', e);
    }

    // 日志：绑定但不在注册中心的技能
    const foundNames = new Set(boundSkills.map(s => s.name));
    for (const code of boundSkillCodes) {
      if (!foundNames.has(code)) {
        this.logger.warn(`技能 "${code}" 已绑定但不在注册中心（可能被删除或不可见）`);
      }
    }

    const availableSkillNames = boundSkills.map(s => s.name).join(', ') || '无';

    // 添加 use_skill 元工具（L1 → L2 触发）
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
      type: 'builtin',
    });

    // 添加 load_reference 元工具（L3 资源加载）
    tools.push({
      name: 'load_reference',
      description: '加载技能的参考文档（references/ 中的文件）。当技能指令中引用了附加文档时使用。',
      parameters: {
        type: 'object',
        properties: {
          skill_name: { type: 'string', description: '技能名称' },
          reference_path: { type: 'string', description: '参考文档的相对路径，如 api-docs.md' },
        },
        required: ['skill_name', 'reference_path'],
      },
      type: 'builtin',
    });

    // 添加 run_script 元工具（执行技能预置脚本）
    const hasScriptedSkills = boundSkills.some(s => s.hasScripts);
    if (hasScriptedSkills) {
      tools.push({
        name: 'run_script',
        description: `执行技能预置的脚本（位于技能目录 scripts/ 中）。使用前必须先通过 use_skill 加载技能指令。支持的脚本类型: .js / .py / .sh。`,
        parameters: {
          type: 'object',
          properties: {
            skill_name: { type: 'string', description: `技能名称。可用: ${availableSkillNames}` },
            script: { type: 'string', description: '脚本路径，如 "extract.py"' },
            args: { type: 'object', description: '传递给脚本的参数' },
            timeout: { type: 'number', description: '超时（毫秒），默认 30000' },
          },
          required: ['skill_name', 'script'],
        },
        type: 'builtin',
      });
    }

    // 添加通用能力工具（固定集合，不随技能数量增长）
    tools.push({
      name: 'http_request',
      description: `发起 HTTP 请求。用于调用外部 API、发送 webhook、获取远程数据等。使用前请确保已通过 use_skill 加载相关技能指令，了解正确的 URL、参数和认证方式。禁止访问内网地址。`,
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], description: 'HTTP 方法' },
          url: { type: 'string', description: '完整的请求 URL（含协议）' },
          headers: { type: 'object', description: '请求头' },
          query: { type: 'object', description: 'URL 查询参数' },
          body: { description: '请求体' },
          timeout: { type: 'number', description: '超时（毫秒），默认 30000' },
        },
        required: ['method', 'url'],
      },
      type: 'builtin',
    });

    tools.push({
      name: 'run_code',
      description: `在安全沙箱中执行代码。支持 JavaScript（VM2 沙箱）、Python 和 Bash。JS 中通过 params 变量访问参数；Python/Bash 通过 stdin JSON 接收。代码执行有超时限制，禁止网络和文件系统访问。`,
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['javascript', 'python', 'bash'], description: '代码语言' },
          code: { type: 'string', description: '要执行的代码' },
          params: { type: 'object', description: '传递给代码的参数' },
          timeout: { type: 'number', description: '超时（毫秒），JS 默认 5000，Python/Bash 默认 30000' },
        },
        required: ['language', 'code'],
      },
      type: 'builtin',
    });

    tools.push({
      name: 'db_query',
      description: `执行只读数据库查询（仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN）。支持 MySQL 命名参数。使用前请确保已通过 use_skill 加载相关技能指令。密码支持 {{ENV:VAR}} 环境变量。`,
      parameters: {
        type: 'object',
        properties: {
          host: { type: 'string', description: '数据库主机地址' },
          port: { type: 'number', description: '端口，默认 3306' },
          user: { type: 'string', description: '数据库用户名' },
          password: { type: 'string', description: '数据库密码' },
          database: { type: 'string', description: '数据库名称' },
          sql: { type: 'string', description: 'SQL 查询语句（仅允许 SELECT）' },
          params: { type: 'object', description: 'SQL 参数键值对' },
          max_rows: { type: 'number', description: '最大返回行数，默认 100' },
          timeout: { type: 'number', description: '超时（毫秒），默认 10000' },
        },
        required: ['host', 'user', 'password', 'database', 'sql'],
      },
      type: 'builtin',
    });

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    if (kbCodes.length > 0) {
      const kbTool = await this.kbSearchTool.getToolDefinition(agent.id, kbCodes);
      if (kbTool) {
        tools.push(kbTool);
      }
    }

    for (const [name, def] of Object.entries(BUILTIN_TOOL_DEFINITIONS)) {
      if (!tools.some(t => t.name === name)) {
        tools.push({
          name: def.function.name,
          description: def.function.description,
          parameters: def.function.parameters as Record<string, any>,
          type: 'builtin',
        });
      }
    }

    // ===== 工作目录工具注入 =====
    let workspaceContext = '';
    if (dto.workspace && agent.workspaceConfig) {
      const config: WorkspaceAgentConfig = typeof agent.workspaceConfig === 'string'
        ? JSON.parse(agent.workspaceConfig)
        : agent.workspaceConfig;

      if (config.enabled) {
        const allowedTools = WORKSPACE_TOOLS.filter(tool =>
          !config.allowedOperations ||
          config.allowedOperations.length === 0 ||
          config.allowedOperations.includes(tool.function.name)
        );

        for (const tool of allowedTools) {
          tools.push({
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
            type: 'workspace' as const,
          });
        }

        // 构建带限制说明的 workspace 上下文
        const limits: string[] = [];
        if (config.maxFileSize) {
          limits.push(`- 单文件最大大小: ${formatFileSize(config.maxFileSize)}`);
        }
        if (config.deniedExtensions?.length) {
          limits.push(`- 禁止写入的文件类型: ${config.deniedExtensions.join(', ')}`);
        }

        workspaceContext = `
当前用户的工作目录：${dto.workspace.dirName}
目录结构：
${dto.workspace.treeSummary}

你可以使用以下工具直接操作工作目录中的文件：
${allowedTools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n')}
${limits.length > 0 ? '\n限制条件：\n' + limits.join('\n') : ''}`;
      }
    }

    let templateCode = agent.promptTemplateCode;
    
    if (!templateCode) {
      switch (agent.reasoningMode) {
        case 'REACT':
          templateCode = 'react-reasoning-default';
          break;
        case 'PLAN':
          templateCode = 'plan-reasoning-default';
          break;
        case 'REFLECT':
          templateCode = 'reflect-reasoning-default';
          break;
        default:
          templateCode = 'agent-system-default';
      }
    }

    const hasTools = tools.length > 0;
    const toolsDescription = hasTools ? JSON.stringify(tools, null, 2) : '';

    let systemPrompt = await this.promptTemplateService.render(templateCode, {
      basePrompt: agent.systemPrompt || '你是一个MuuAI开发的AI助手。',
      hasTools: hasTools,
      tools: toolsDescription
    });

    // 注入技能清单（L1 元数据层，渐进式披露）
    if (skillManifest) {
      systemPrompt += `\n\n## 可用技能清单\n以下是可用的专业技能。调用 \`use_skill\` 加载完整指令后，使用通用工具（http_request / run_code / db_query / run_script 等）执行技能中的操作。\n\n${skillManifest}`;
    }

    // 追加工作目录上下文
    if (workspaceContext) {
      systemPrompt = systemPrompt + '\n\n' + workspaceContext;
    }

    /**
     * 获取智能体的合并模型参数
     * 优先级：自定义参数 > 模板参数 > 系统默认值
     */
    const mergedParams = await this.getMergedModelParams(agent);

    return {
      agent,
      model,
      userMessage: dto.message,
      systemPrompt,
      tools,
      maxSteps: agent.maxSteps || 5,
      temperature: mergedParams.temperature,
      topP: mergedParams.topP,
      maxTokens: mergedParams.maxTokens,
      conversationHistory,
      conversation,
      conversationId: conversation.id,
    };
  }

  /**
   * 获取智能体的合并模型参数
   * @param agent 智能体对象
   * @returns {Promise<ModelParams>} 合并后的参数
   */
  private async getMergedModelParams(agent: any): Promise<ModelParams> {
    let templateParams: ModelParams | null = null;
    let customParams: ModelParams | null = null;

    if (agent.modelTemplateCode) {
      try {
        const template = await this.modelTemplateService.findByCode(agent.modelTemplateCode);
        if (template) {
          templateParams = {
            temperature: template.temperature,
            topP: template.topP,
            maxTokens: template.maxTokens,
            contextWindow: template.contextWindow,
          };
        }
      } catch (e) {
        this.logger.warn(`获取模型模板失败: ${agent.modelTemplateCode}`);
      }
    }

    if (agent.customModelParams) {
      try {
        customParams = JSON.parse(agent.customModelParams);
      } catch (e) {
        this.logger.warn('解析自定义模型参数失败');
      }
    }

    return mergeModelParams({
      callParams: null,
      templateParams,
      customParams,
    });
  }

  private async executeDefaultSyncChat(
    agent: any,
    context: any,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );
    } catch (error) {
      this.logger.error('保存用户消息失败:', error);
    }

    try {
      const result = await this.aiService.generateText({
        model: context.model,
        system: context.systemPrompt,
        messages,
        tools,
        temperature: context.temperature,
        clientIp,
        userAgent: 'agent-service',
        uid,
        appCode,
      });

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        result.text,
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(agent, context, { text: result.text }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);

      return {
        response: result.text,
        toolCalls: (result.toolCalls || []).map((tc: any) => ({
          ...tc,
          toolName: nameMap[tc.toolName] || tc.toolName,
        })),
        steps: [],
        reasoningMode: ReasoningMode.NONE,
        conversationId: context.conversationId,
      };
    } catch (error) {
      const errorMsg = parseAiError(error);
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: errorMsg,
          steps: '[]',
          totalCostMs: Date.now() - startTime,
          success: false,
          errorMessage: errorMsg,
          clientIp,
          uid,
          reasoningMode: ReasoningMode.NONE,
          appCode,
        },
      });

      return {
        response: errorMsg,
        steps: [],
        reasoningMode: ReasoningMode.NONE,
        conversationId: context.conversationId,
      };
    }
  }

  /**
   * 执行默认流式模式（基于 StreamEmitter）
   */
  private async executeDefaultStreamWithEmitter(
    agent: any,
    context: any,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    emitter: StreamEmitter,
    messages?: ModelMessage[],
    toolCallCount: number = 0,
    appCode?: string,
  ): Promise<void> {
    const maxToolCalls = 3;
    
    const currentMessages = messages || [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    if (!messages) {
      this.logger.log(`[executeDefaultStream] 开始执行默认流式模式，tools count: ${Object.keys(tools).length}`);
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );
    }

    try {
      let toolCallToExecute: { name: string; args: any } | null = null;

      await this.aiService.streamText({
        model: context.model,
        system: context.systemPrompt,
        messages: currentMessages,
        tools,
        temperature: context.temperature,
        clientIp,
        userAgent: 'agent-service',
        uid,
        appCode,
        onChunk: (chunk) => {
          this.logger.debug(`[executeDefaultStream] 收到 chunk: ${chunk.substring(0, 50)}...`);
          emitter.emitTextDelta(chunk);
        },
        onToolCall: (toolCall) => {
          this.logger.log(`[executeDefaultStream] 收到工具调用: ${toolCall.name}`);
          toolCallToExecute = toolCall;
        },
        onFinish: async (result) => {
          this.logger.log(`[executeDefaultStream] 收到 finish，text length: ${result.text?.length || 0}, toolCallToExecute: ${toolCallToExecute?.name || 'none'}`);

          const isFunctionCallText = this.aiService.getToolCallParser().containsFunctionCallMarkers(result.text || '');
          const hasToolCall = toolCallToExecute || isFunctionCallText;

          if (hasToolCall && toolCallCount < maxToolCalls) {
            const parsedToolCall = this.aiService.getToolCallParser().parseFromText(result.text || '');
            const rawCall = toolCallToExecute || (parsedToolCall ? { name: parsedToolCall.toolName, args: parsedToolCall.args } : null);

            if (rawCall) {
              // 反向映射：将 provider 合规名恢复为内部协议名（skill__xxx / mcp__xxx）
              const resolvedName = nameMap[rawCall.name] || rawCall.name;
              const toolCall = { ...rawCall, name: resolvedName };

              try {
                let toolResult: ToolExecutionResult;

                // 工作目录工具：下发给客户端执行
                if (WORKSPACE_TOOL_NAMES.has(toolCall.name)) {
                  const workspaceResult = await this.workspaceToolHandler.dispatchToClient(
                    emitter,
                    toolCall.name,
                    toolCall.args,
                  );

                  if (workspaceResult.success) {
                    toolResult = {
                      toolCallId: `tc_${Date.now()}`,
                      toolName: toolCall.name,
                      args: toolCall.args,
                      result: workspaceResult.result,
                      success: true,
                      costMs: 0,
                    };
                  } else {
                    throw new Error(workspaceResult.error || '客户端执行失败');
                  }
                } else {
                  toolResult = await this.toolExecutor.executeToolCall(
                    {
                      id: `tc_${Date.now()}`,
                      function: {
                        name: toolCall.name,
                        arguments: JSON.stringify(toolCall.args),
                      },
                    },
                    { agent: context.agent, conversationId: context.conversationId, uid, isolationContext: { appCode: appCode || context.agent?.appCode || null, isSuperAdmin: false } },
                  );
                }

                emitter.emit(StreamEvents.toolCall(toolCall.name, toolCall.args, toolResult.result));

                const resultText = typeof toolResult.result === 'object' ? JSON.stringify(toolResult.result, null, 2) : String(toolResult.result);

                const newMessages: ModelMessage[] = [
                  ...currentMessages,
                  {
                    role: 'assistant' as const,
                    content: `Action: ${rawCall.name}\nAction Input: ${JSON.stringify(toolCall.args)}\nObservation: ${resultText}`,
                  },
                  {
                    role: 'user' as const,
                    content: `请基于工具返回结果用自然语言回答用户问题。工具返回: ${resultText}`,
                  },
                ];

                await this.executeDefaultStreamWithEmitter(agent, context, startTime, clientIp, uid, emitter, newMessages, toolCallCount + 1, appCode);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
                this.logger.error(`[executeDefaultStream] 工具执行失败: ${errorMsg}`);

                emitter.emit(StreamEvents.toolCall(toolCall.name, toolCall.args, `工具执行失败: ${errorMsg}`));
                await this.saveLog(agent, context, { text: `抱歉，工具执行失败: ${errorMsg}` }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);
                emitter.emitDone({
                  conversationId: context.conversationId,
                  response: `抱歉，工具执行失败: ${errorMsg}`,
                  totalCostMs: Date.now() - startTime,
                });
              }
              return;
            }
          }

          if (result.text && result.text.length > 0) {
            const cleanText = this.aiService.getToolCallParser().stripFunctionCallMarkers(result.text);

            if (cleanText) {
              await this.conversationService.addMessage(
                context.conversationId,
                'assistant',
                cleanText,
              );
            }

            if (context.conversationHistory.length === 0 && !messages) {
              await this.conversationService.generateTitle(context.conversationId);
            }

            await this.saveLog(agent, context, { text: cleanText || result.text }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);
            emitter.emitDone({
              conversationId: context.conversationId,
              response: cleanText || '',
              totalCostMs: Date.now() - startTime,
            });
          } else {
            const finalResponse = result.text || '抱歉，我无法回答您的问题。';

            await this.conversationService.addMessage(
              context.conversationId,
              'assistant',
              finalResponse,
            );

            if (context.conversationHistory.length === 0 && !messages) {
              await this.conversationService.generateTitle(context.conversationId);
            }

            await this.saveLog(agent, context, { text: finalResponse }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);
            emitter.emitDone({
              conversationId: context.conversationId,
              response: finalResponse,
              totalCostMs: Date.now() - startTime,
            });
          }
        },
        onError: (error) => {
          this.logger.error(`[executeDefaultStream] 收到错误: ${error}`);
          const errorMsg = parseAiError(error);
          const errorCode = getErrorCode(error);
          emitter.emitError(errorMsg, errorCode);
        },
      });
    } catch (error) {
      this.logger.error(`[executeDefaultStream] 异常: ${error instanceof Error ? error.message : error}`);
      const errorMsg = parseAiError(error);
      const errorCode = getErrorCode(error);
      emitter.emitError(errorMsg, errorCode);
    }
  }

  /**
   * 保存对话日志
   * @param agent 智能体配置
   * @param context 执行上下文
   * @param result 对话结果
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param reasoningMode 推理模式
   * @param startTime 开始时间
   */
  private async saveLog(
    agent: any,
    context: any,
    result: any,
    clientIp: string,
    uid: string | undefined,
    reasoningMode: ReasoningMode,
    startTime: number,
    appCode?: string,
  ): Promise<void> {
    try {
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: result.text || result.response || '',
          steps: JSON.stringify(result.steps || []),
          totalCostMs: Date.now() - startTime,
          success: true,
          clientIp,
          uid,
          reasoningMode,
          appCode,
        },
      });
    } catch (e) {
      this.logger.error('Failed to save log:', e);
    }
  }

  /**
   * 使用 Function Calling + ReAct 协同架构执行智能体对话（基于 StreamEmitter）
   */
  private async executeReActWithFunctionCallingEmitter(
    agent: any,
    context: any,
    reasoningMode: ReasoningMode,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    emitter: StreamEmitter,
  ): Promise<void> {
    this.logger.log(`[ReAct+FC] 开始执行协同架构, reasoningMode: ${reasoningMode}`);

    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const steps: any[] = [];
    let finalResponse = '';

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      // ReAct 推理循环
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[ReAct+FC] Step ${i + 1}/${context.maxSteps}`);

        let stepText = '';
        let hasToolCall = false;

        await this.aiService.streamText({
          model: context.model,
          system: context.systemPrompt,
          messages,
          tools,
          temperature: context.temperature,
          clientIp,
          userAgent: 'agent-service',
          uid,
          onChunk: (chunk) => {
            stepText += chunk;
            emitter.emitTextDelta(chunk);
          },
          onToolCall: async (toolCall: { name: string; args: any }) => {
            // 反向映射：将 provider 合规名恢复为内部协议名
            const resolvedName = nameMap[toolCall.name] || toolCall.name;
            this.logger.log(`[ReAct+FC] 检测到工具调用: ${resolvedName}`);
            hasToolCall = true;

            // 记录推理步骤
            const thoughtStep = {
              stepNumber: steps.length + 1,
              stepType: 'thought',
              content: stepText || `需要调用工具 ${resolvedName}`,
            };
            steps.push(thoughtStep);
            emitter.emit(StreamEvents.reasoningStep(thoughtStep));

            // 记录行动步骤
            const actionStep = {
              stepNumber: steps.length + 1,
              stepType: 'action',
              content: `调用工具: ${resolvedName}`,
              action: resolvedName,
              actionInput: toolCall.args,
            };
            steps.push(actionStep);
            emitter.emit(StreamEvents.reasoningStep(actionStep));

            // 执行工具（工作目录工具下发给客户端）
            let toolResult: ToolExecutionResult;
            if (WORKSPACE_TOOL_NAMES.has(resolvedName)) {
              const workspaceResult = await this.workspaceToolHandler.dispatchToClient(
                emitter,
                resolvedName,
                toolCall.args,
              );
              if (workspaceResult.success) {
                toolResult = {
                  toolCallId: `tc_${Date.now()}`,
                  toolName: resolvedName,
                  args: toolCall.args,
                  result: workspaceResult.result,
                  success: true,
                  costMs: 0,
                };
              } else {
                throw new Error(workspaceResult.error || '客户端执行失败');
              }
            } else {
              toolResult = await this.toolExecutor.executeToolCall(
                {
                  id: `tc_${Date.now()}`,
                  function: {
                    name: resolvedName,
                    arguments: JSON.stringify(toolCall.args),
                  },
                },
                { agent: context.agent, conversationId: context.conversationId, uid, isolationContext: { appCode: context.agent?.appCode || null, isSuperAdmin: false } },
              );
            }

            // 发送工具调用事件
            emitter.emit(StreamEvents.toolCall(resolvedName, toolCall.args, toolResult.result));

            // 记录观察步骤
            const resultText = typeof toolResult.result === 'object'
              ? JSON.stringify(toolResult.result, null, 2)
              : String(toolResult.result);

            const observationStep = {
              stepNumber: steps.length + 1,
              stepType: 'observation',
              content: resultText,
              observation: resultText,
              toolOutput: toolResult.result,
            };
            steps.push(observationStep);
            emitter.emit(StreamEvents.reasoningStep(observationStep));

            // 添加工具结果到消息历史
            messages.push({
              role: 'assistant',
              content: stepText,
            });
            messages.push({
              role: 'user',
              content: `工具 ${toolCall.name} 返回结果:\n${resultText}\n\n请基于以上结果继续回答用户问题。如果已经得到答案，直接给出最终答案。`,
            });
          },
        });

        // 如果没有工具调用，说明已经得到最终答案
        if (!hasToolCall) {
          finalResponse = stepText.trim();
          
          const finalStep = {
            stepNumber: steps.length + 1,
            stepType: 'final_answer',
            content: finalResponse,
          };
          steps.push(finalStep);
          emitter.emit(StreamEvents.reasoningStep(finalStep));
          break;
        }
      }

      // 保存对话消息
      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
      );

      // 新会话生成标题
      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      // 保存日志
      await this.saveLog(agent, context, { response: finalResponse, steps }, clientIp, uid, reasoningMode, startTime);

      // 发送完成事件
      emitter.emitDone({
        conversationId: context.conversationId,
        response: finalResponse,
        totalCostMs: Date.now() - startTime,
      });

      this.logger.log(`[ReAct+FC] 执行完成, 耗时: ${Date.now() - startTime}ms`);
    } catch (error) {
      const errorMsg = parseAiError(error);
      const errorCode = getErrorCode(error);
      this.logger.error(`[ReAct+FC] 执行失败:`, errorMsg);
      emitter.emitError(errorMsg, errorCode);
    }
  }

  /**
   * 使用 Function Calling + ReAct 协同架构执行智能体对话（同步版本）
   * @param agent 智能体配置
   * @param context 执行上下文
   * @param reasoningMode 推理模式
   * @param startTime 开始时间
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @returns 执行结果
   */
  private async executeReActWithFunctionCallingSync(
    agent: any,
    context: any,
    reasoningMode: ReasoningMode,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`[ReAct+FC Sync] 开始执行协同架构, reasoningMode: ${reasoningMode}`);

    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const steps: any[] = [];
    let finalResponse = '';

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      // ReAct 推理循环
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[ReAct+FC Sync] Step ${i + 1}/${context.maxSteps}`);

        // 调用模型（使用 Function Calling）
        const result = await this.aiService.generateText({
          model: context.model,
          system: context.systemPrompt,
          messages,
          tools,
          temperature: context.temperature,
          clientIp,
          userAgent: 'agent-service',
          uid,
          appCode,
        });

        const stepText = result.text;

        // 检查是否有工具调用
        if (result.toolCalls && result.toolCalls.length > 0) {
          // 记录推理步骤
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'thought',
            content: stepText || `需要调用工具`,
          });

          // 执行工具
          for (const toolCall of result.toolCalls) {
            // 反向映射：将 provider 合规名恢复为内部协议名
            const resolvedName = nameMap[toolCall.toolName] || toolCall.toolName;

            const toolResult = await this.toolExecutor.executeToolCall(
              {
                id: toolCall.toolCallId || `tc_${Date.now()}`,
                function: {
                  name: resolvedName,
                  arguments: JSON.stringify(toolCall.args),
                },
              },
              { agent: context.agent, conversationId: context.conversationId, uid, isolationContext: { appCode: appCode || context.agent?.appCode || null, isSuperAdmin: false } },
            );

            // 记录行动步骤
            steps.push({
              stepNumber: steps.length + 1,
              stepType: 'action',
              content: `调用工具: ${resolvedName}`,
              action: resolvedName,
              actionInput: toolCall.args,
            });

            // 记录观察步骤
            const resultText = typeof toolResult.result === 'object'
              ? JSON.stringify(toolResult.result, null, 2)
              : String(toolResult.result);

            steps.push({
              stepNumber: steps.length + 1,
              stepType: 'observation',
              content: resultText,
              observation: resultText,
              toolOutput: toolResult.result,
            });

            // 添加工具结果到消息历史
            messages.push({
              role: 'assistant',
              content: [
                { type: 'text', text: stepText || '' },
                {
                  type: 'tool-call',
                  toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                },
              ],
            } as any);
            messages.push({
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
                  toolName: toolCall.toolName,
                  result: resultText,
                },
              ],
            } as any);
          }
        } else {
          // 没有工具调用，返回最终答案
          finalResponse = stepText.trim();
          
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'final_answer',
            content: finalResponse,
          });
          break;
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法在有限的步骤内完成您的请求。';
      }

      // 保存对话消息
      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
      );

      // 新会话生成标题
      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      // 保存日志
      await this.saveLog(agent, context, { response: finalResponse, steps }, clientIp, uid, reasoningMode, startTime, appCode);

      this.logger.log(`[ReAct+FC Sync] 执行完成, 耗时: ${Date.now() - startTime}ms`);

      return {
        response: finalResponse,
        steps,
        reasoningMode,
        conversationId: context.conversationId,
      };
    } catch (error) {
      const errorMsg = parseAiError(error);
      this.logger.error(`[ReAct+FC Sync] 执行失败:`, errorMsg);

      return {
        response: `执行失败: ${errorMsg}`,
        steps,
        reasoningMode,
        conversationId: context.conversationId,
      };
    }
  }
}

/**
 * 格式化文件大小显示
 */
function formatFileSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)}MB`;
  return `${kb}KB`;
}