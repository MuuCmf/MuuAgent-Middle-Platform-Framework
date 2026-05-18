import { Injectable, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ExecuteSkillDto,
  QuerySkillDto,
  SkillType,
} from './dto/skill.dto';
import { Skill } from '@prisma/client';
import axios from 'axios';
import { McpClientService } from './mcp-client.service';
import { PromptTemplateService } from '../prompt-template/prompt-template.service';
import { AiService } from '../ai/ai.service';
import { ModelService } from '../model/model.service';
import { BuiltinExecutor } from './executors/builtin.executor';
import { PluginExecutor } from './executors/plugin.executor';
import { SandboxExecutor } from './executors/sandbox.executor';
import { PluginLoader } from './plugin-loader';
import { IsolationContext, buildIsolationWhere, buildCreateData, buildOwnerWhere } from '../common/utils/isolation.util';
import { FileExecutor } from '../file/file.executor';
import { DatabaseExecutor } from './executors/database.executor';
import { DatabaseQueryResult } from './database/dto/database-config.dto';

/**
 * 技能服务
 * 提供技能的CRUD和执行功能
 */
@Injectable()
export class SkillService {
  private readonly logger = new Logger(SkillService.name);
  private readonly DEFAULT_TIMEOUT = 30000;

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param mcpClient MCP客户端服务
   * @param promptTemplateService 提示词模板服务
   * @param aiService AI服务
   * @param modelService 模型服务
   * @param builtinExecutor 内置函数执行器
   * @param pluginExecutor 插件函数执行器
   * @param sandboxExecutor 沙箱函数执行器
   * @param pluginLoader 插件加载器
   * @param fileExecutor 文件执行器
   * @param databaseExecutor 数据库执行器
   */
  constructor(
    private prisma: PrismaService,
    private mcpClient: McpClientService,
    private promptTemplateService: PromptTemplateService,
    private aiService: AiService,
    private modelService: ModelService,
    private builtinExecutor: BuiltinExecutor,
    private pluginExecutor: PluginExecutor,
    private sandboxExecutor: SandboxExecutor,
    private pluginLoader: PluginLoader,
    private fileExecutor: FileExecutor,
    private databaseExecutor: DatabaseExecutor,
  ) {}

  /**
   * 创建技能
   * @param dto 创建技能DTO
   * @param context 隔离上下文
   * @returns {Promise<Object>} 创建的技能
   */
  async create(dto: CreateSkillDto, context?: IsolationContext) {
    const data = buildCreateData({
      name: dto.name,
      code: dto.code,
      description: dto.description,
      type: dto.type,
      params: dto.params,
      config: dto.config,
      status: dto.status ?? true,
      timeout: dto.timeout ?? 30000,
      codeType: dto.codeType,
      pluginName: dto.pluginName,
      functionName: dto.functionName,
      codeContent: dto.codeContent,
      appCode: dto.appCode,
      isPublic: dto.isPublic ?? false,
    }, context || { appCode: null, isSuperAdmin: false });

    return this.prisma.skill.create({ data });
  }

  /**
   * 更新技能
   * @param id 技能ID
   * @param dto 更新技能DTO
   * @param context 隔离上下文
   * @returns {Promise<Object>} 更新后的技能
   */
  async update(id: string, dto: UpdateSkillDto, context?: IsolationContext) {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const skill = await this.prisma.skill.findFirst({ where });
    if (!skill) {
      throw new NotFoundException('技能不存在或无权限操作');
    }

    return this.prisma.skill.update({
      where: { id: id as any },
      data: dto,
    });
  }

  /**
   * 删除技能
   * @param id 技能ID
   * @param context 隔离上下文
   * @returns {Promise<void>}
   */
  async remove(id: string, context?: IsolationContext): Promise<void> {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const skill = await this.prisma.skill.findFirst({ where });
    if (!skill) {
      throw new NotFoundException('技能不存在或无权限操作');
    }

    await this.prisma.skill.delete({ where: { id: id as any } });
  }

  /**
   * 根据ID查询技能
   * @param id 技能ID
   * @param context 隔离上下文
   * @returns {Promise<Object>} 技能详情
   */
  async findOne(id: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const skill = await this.prisma.skill.findFirst({
      where: { id, ...isolationWhere },
    });
    if (!skill) {
      throw new NotFoundException('技能不存在');
    }
    return skill;
  }

  /**
   * 根据Code查询技能
   * @param code 技能标识
   * @param context 隔离上下文
   * @returns {Promise<Object>} 技能详情
   */
  async findByCode(code: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const skill = await this.prisma.skill.findFirst({
      where: { code, ...isolationWhere },
    });
    if (!skill) {
      throw new NotFoundException('技能不存在');
    }
    return skill;
  }

  /**
   * 分页查询技能列表
   * @param query 查询参数
   * @param context 隔离上下文
   * @returns {Promise<Object>} 分页技能列表
   */
  async findAll(query: QuerySkillDto, context?: IsolationContext) {
    const { type, status, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const where: Record<string, unknown> = { ...isolationWhere };
    if (type) where.type = type;
    if (status !== undefined) where.status = status;

    const [list, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.skill.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 执行技能
   * @param dto 执行技能DTO
   * @param context 隔离上下文
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  async execute(dto: ExecuteSkillDto, context?: IsolationContext): Promise<Record<string, unknown>> {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const skill = await this.prisma.skill.findFirst({
      where: { code: dto.skillCode, ...isolationWhere },
    });

    if (!skill) {
      throw new NotFoundException('技能不存在');
    }

    if (!skill.status) {
      throw new HttpException('技能已禁用', HttpStatus.FORBIDDEN);
    }

    const params = dto.params || {};
    const startTime = Date.now();
    let result: Record<string, unknown>;
    let success = true;
    let errorMessage: string | null = null;

    try {
      switch (skill.type) {
        case SkillType.HTTP:
          result = await this.executeHttpSkill(skill, params);
          break;
        case SkillType.FUNCTION:
          result = await this.executeFunctionSkill(skill, params);
          break;
        case SkillType.DATABASE:
          result = await this.executeDatabaseSkill(skill, params) as unknown as Record<string, unknown>;
          break;
        case SkillType.MCP:
          result = await this.executeMcpSkill(skill, params);
          break;
        case SkillType.FILE:
          result = await this.fileExecutor.execute(skill, params);
          break;
        default:
          throw new HttpException('不支持的技能类型', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      success = false;
      // 保留原始 HttpException 的状态码和消息
      if (error instanceof HttpException) {
        await this.logInvoke(skill, params, startTime, success, error.message, context);
        throw error;
      }
      errorMessage = error instanceof Error ? error.message : '执行失败';
      result = { error: errorMessage };
    }

    // 记录调用日志
    await this.logInvoke(skill, params, startTime, success, errorMessage, context);

    if (!success) {
      throw new HttpException(errorMessage || '执行失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result;
  }

  /**
   * 执行HTTP类型技能
   * @param skill 技能信息
   * @param params 执行参数
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  private async executeHttpSkill(
    skill: { config: string; timeout: number },
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config);
    const { url, method = 'get', headers = {} } = config;

    const response = await axios({
      url,
      method,
      params: method.toLowerCase() === 'get' ? params : undefined,
      data: method.toLowerCase() === 'post' ? params : undefined,
      headers,
      timeout: skill.timeout,
    });

    return response.data;
  }

  /**
   * 执行函数类型技能
   * @param skill 技能信息
   * @param params 执行参数
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  private async executeFunctionSkill(
    skill: Skill,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config || '{}');
    const codeType = skill.codeType || config.codeType || 'builtin';

    switch (codeType) {
      case 'builtin':
        return await this.executeBuiltin(skill, params);

      case 'plugin':
        return await this.executePlugin(skill, params);

      case 'sandbox':
        return await this.executeSandbox(skill, params);

      default:
        throw new HttpException(
          `不支持的函数类型: ${codeType}`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  /**
   * 执行内置函数
   */
  private async executeBuiltin(
    skill: Skill,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config || '{}');
    const functionName = skill.functionName || config.functionName || skill.code;

    const result = await this.builtinExecutor.execute(functionName, params);

    if (!result.success) {
      throw new HttpException(result.error || '执行失败', HttpStatus.BAD_REQUEST);
    }

    return result.data || {};
  }

  /**
   * 执行插件函数
   */
  private async executePlugin(
    skill: Skill,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config || '{}');
    const pluginName = skill.pluginName || config.pluginName;
    const functionName = skill.functionName || config.functionName;

    if (!pluginName || !functionName) {
      throw new HttpException(
        '插件名称和函数名称不能为空',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.pluginExecutor.execute(
      pluginName,
      functionName,
      params,
    );

    if (!result.success) {
      throw new HttpException(result.error || '执行失败', HttpStatus.BAD_REQUEST);
    }

    return result.data || {};
  }

  /**
   * 执行沙箱函数
   */
  private async executeSandbox(
    skill: Skill,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const code = skill.codeContent;
    if (!code) {
      throw new HttpException('代码内容不能为空', HttpStatus.BAD_REQUEST);
    }

    const result = await this.sandboxExecutor.execute(
      code,
      params,
      skill.timeout || 5000,
    );

    if (!result.success) {
      throw new HttpException(result.error || '执行失败', HttpStatus.BAD_REQUEST);
    }

    return result.data || {};
  }

  /**
   * 执行数据库类型技能
   * @param skill 技能信息
   * @param params 执行参数
   * @returns 查询结果
   */
  private async executeDatabaseSkill(
    skill: Skill,
    params: Record<string, unknown>,
  ): Promise<DatabaseQueryResult> {
    return await this.databaseExecutor.execute(skill, params);
  }

  /**
   * 执行MCP类型技能
   * @param skill 技能信息
   * @param params 执行参数
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  private async executeMcpSkill(
    skill: { config: string; timeout: number },
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config);
    const { url, apiKey, toolName } = config;

    if (!url) {
      throw new HttpException('MCP Server URL 未配置', HttpStatus.BAD_REQUEST);
    }

    if (!toolName) {
      throw new HttpException('MCP 工具名称未配置', HttpStatus.BAD_REQUEST);
    }

    const result = await this.mcpClient.callTool(
      {
        url,
        apiKey,
        timeout: skill.timeout || 30000,
      },
      toolName,
      params,
    );

    if (typeof result === 'string') {
      return { result };
    }

    return result as Record<string, unknown>;
  }

  /**
   * 记录技能调用日志
   */
  private async logInvoke(
    skill: { id: any; code: string; appCode?: string | null },
    params: Record<string, unknown>,
    startTime: number,
    success: boolean,
    errorMessage: string | null,
    context?: IsolationContext,
  ): Promise<void> {
    try {
      await this.prisma.skillInvokeLog.create({
        data: {
          skillId: skill.id,
          skillCode: skill.code,
          params: JSON.stringify(params),
          result: JSON.stringify({}),
          costMs: Date.now() - startTime,
          success,
          errorMessage,
          appCode: context?.appCode || skill.appCode,
        },
      });
    } catch { /* 日志记录失败不应影响主流程 */ }
  }

  /**
   * 获取技能描述(用于LLM)
   * @param skillCodes 技能标识列表
   * @returns {Promise<string>} 技能描述文本
   */
  async getSkillDescriptions(skillCodes: string[]): Promise<string> {
    const skills = await this.prisma.skill.findMany({
      where: {
        code: { in: skillCodes },
        status: true,
      },
    });

    return skills
      .map((s: Skill) => `${s.code}: ${s.description}\n参数: ${s.params}`)
      .join('\n\n');
  }

  /**
   * @param skillCode 技能标识
   * @param userRequest 用户请求
   * @returns {Promise<string>} 渲染后的提示词
   */
  async renderSkillInvokePrompt(
    skillCode: string,
    userRequest: string,
    context?: IsolationContext,
  ): Promise<string> {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const skill = await this.prisma.skill.findFirst({
      where: { code: skillCode, ...isolationWhere },
    });

    if (!skill) {
      throw new NotFoundException('技能不存在');
    }

    const renderedPrompt = await this.promptTemplateService.render(
      'skill-invoke-default',
      {
        skillName: skill.name,
        skillDescription: skill.description,
        skillType: skill.type,
        userRequest,
      },
    );

    return renderedPrompt;
  }

  /**
   * 智能选择技能（基于用户请求）
   * @param userRequest 用户请求
   * @param availableSkills 可用技能列表
   * @param context 隔离上下文
   * @returns {Promise<{skillCode: string; params: Record<string, unknown>}>} 选择的技能和参数
   */
  async selectSkill(
    userRequest: string,
    availableSkills: string[],
    context?: IsolationContext,
  ): Promise<{ skillCode: string; params: Record<string, unknown>; prompt: string; reason?: string }> {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const skills = await this.prisma.skill.findMany({
      where: {
        code: { in: availableSkills },
        status: true,
        ...isolationWhere,
      },
    });

    if (skills.length === 0) {
      throw new NotFoundException('没有可用的技能');
    }

    const skillDescriptions = skills
      .map(
        (s) =>
          `- ${s.code}: ${s.description}\n  参数: ${s.params}`,
      )
      .join('\n\n');

    const systemPrompt = await this.promptTemplateService.render(
      'skill-invoke-default',
      {
        skillDescription: skillDescriptions,
        userRequest,
      },
    );

    try {
      const availableModels = await this.modelService.getAvailableModels('llm');
      
      if (!availableModels || availableModels.length === 0) {
        this.logger.warn('未找到可用的 LLM 模型，使用第一个可用技能');
        return {
          skillCode: skills[0].code,
          params: {},
          prompt: systemPrompt,
        };
      }

      const defaultModel = availableModels[0];

      const result = await this.aiService.generateText({
        model: defaultModel,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userRequest,
          },
        ],
        temperature: 0.3,
        clientIp: 'skill-service',
      });

      const aiResponse = result.text.trim();
      
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('AI 返回格式不正确');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        if (!parsed.skillCode || !availableSkills.includes(parsed.skillCode)) {
          this.logger.warn(`AI 返回的技能标识无效: ${parsed.skillCode}`);
          return {
            skillCode: skills[0].code,
            params: {},
            prompt: systemPrompt,
          };
        }

        return {
          skillCode: parsed.skillCode,
          params: parsed.params || {},
          prompt: systemPrompt,
          reason: parsed.reason,
        };
      } catch (parseError) {
        this.logger.error('解析 AI 返回结果失败:', parseError);
        return {
          skillCode: skills[0].code,
          params: {},
          prompt: systemPrompt,
        };
      }
    } catch (error) {
      this.logger.error('调用 AI 模型失败:', error);
      return {
        skillCode: skills[0].code,
        params: {},
        prompt: systemPrompt,
      };
    }
  }

  /**
   * 获取内置函数列表
   * @returns 内置函数列表
   */
  getBuiltinFunctions() {
    return this.builtinExecutor.getFunctionList();
  }

  /**
   * 获取插件列表
   * @returns 插件列表
   */
  getPlugins() {
    const plugins = this.pluginLoader.getAllPlugins();
    return plugins.map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      functions: Object.entries(plugin.functions).map(([name, func]) => ({
        name,
        description: func.description,
        parameters: func.parameters,
      })),
    }));
  }

  /**
   * 分析沙箱代码
   * @param code JavaScript 代码
   * @returns 分析结果
   */
  analyzeCode(code: string) {
    return this.sandboxExecutor.analyzeCode(code);
  }

  /**
   * 测试函数
   * @param body 测试参数
   * @returns 测试结果
   */
  async testFunction(body: {
    codeType: string;
    pluginName?: string;
    functionName?: string;
    codeContent?: string;
    params: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    duration?: number;
  }> {
    const { codeType, pluginName, functionName, codeContent, params } = body;

    switch (codeType) {
      case 'builtin':
        if (!functionName) {
          throw new HttpException('函数名称不能为空', HttpStatus.BAD_REQUEST);
        }
        const builtinResult = await this.builtinExecutor.execute(functionName, params);
        return builtinResult;

      case 'plugin':
        if (!pluginName || !functionName) {
          throw new HttpException('插件名称和函数名称不能为空', HttpStatus.BAD_REQUEST);
        }
        const pluginResult = await this.pluginExecutor.execute(pluginName, functionName, params);
        return pluginResult;

      case 'sandbox':
        if (!codeContent) {
          throw new HttpException('代码内容不能为空', HttpStatus.BAD_REQUEST);
        }
        const sandboxResult = await this.sandboxExecutor.execute(codeContent, params, this.DEFAULT_TIMEOUT);
        return sandboxResult;

      default:
        throw new HttpException(`不支持的函数类型: ${codeType}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 测试 HTTP 请求
   * @param configStr 技能配置 JSON 字符串
   * @param params 测试参数
   * @returns 测试结果，包含状态码、响应头、响应体和耗时
   */
  async testHttpRequest(
    configStr: string,
    params: Record<string, unknown>,
  ): Promise<{
    status: number;
    statusText: string;
    headers: Record<string, unknown>;
    data: unknown;
    costMs: number;
  }> {
    const config = JSON.parse(configStr);
    const { url, method = 'get', headers = {}, body, bodyType = 'json' } = config;

    if (!url) {
      throw new HttpException('URL 不能为空', HttpStatus.BAD_REQUEST);
    }

    const startTime = Date.now();

    const response = await axios({
      url,
      method,
      headers,
      params: ['get', 'head', 'options'].includes(method.toLowerCase()) ? params : undefined,
      data: ['post', 'put', 'patch', 'delete'].includes(method.toLowerCase())
        ? (body || params)
        : undefined,
      timeout: 10000,
      validateStatus: () => true,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, unknown>,
      data: response.data,
      costMs: Date.now() - startTime,
    };
  }
}
