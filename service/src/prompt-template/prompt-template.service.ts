import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreatePromptTemplateDto,
  UpdatePromptTemplateDto,
  QueryPromptTemplateDto,
  RenderPromptTemplateDto,
  RollbackPromptTemplateDto,
} from './dto/prompt-template.dto';
import { IsolationContext, buildIsolationWhere, buildCreateData, buildOwnerWhere } from '../common/utils/isolation.util';

/**
 * Prompt 模板服务
 * 负责模板的 CRUD、渲染、版本管理等核心功能
 */
@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建模板
   * @param dto 创建 DTO
   * @param context 隔离上下文
   * @returns 创建的模板
   */
  async create(dto: CreatePromptTemplateDto, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const existing = await this.prisma.promptTemplate.findFirst({
      where: { code: dto.code, ...isolationWhere },
    });

    if (existing) {
      throw new ConflictException('模板标识已存在');
    }

    if (dto.isDefault) {
      await this.prisma.promptTemplate.updateMany({
        where: {
          category: dto.category,
          isDefault: true,
          ...isolationWhere,
        },
        data: { isDefault: false },
      });
    }

    const data = buildCreateData({
      name: dto.name,
      code: dto.code,
      category: dto.category,
      content: dto.content,
      variables: dto.variables ? JSON.stringify(dto.variables) : null,
      isDefault: dto.isDefault ?? false,
      status: dto.status ?? true,
      description: dto.description,
      tags: dto.tags ? JSON.stringify(dto.tags) : null,
      metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
      createdBy: dto.createdBy,
      appCode: dto.appCode,
      isPublic: dto.isPublic ?? false,
    }, context || { appCode: null, isSuperAdmin: false });

    const template = await this.prisma.promptTemplate.create({ data });

    await this.prisma.promptVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        content: template.content,
        variables: template.variables,
        changeLog: '初始版本',
        changeType: 'create',
        createdBy: dto.createdBy,
      },
    });

    this.logger.log(`创建模板成功: ${template.code}`);
    return template;
  }

  /**
   * 更新模板（创建新版本）
   * @param code 模板标识
   * @param dto 更新 DTO
   * @param context 隔离上下文
   * @returns 更新后的模板
   */
  async update(code: string, dto: UpdatePromptTemplateDto, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const template = await this.prisma.promptTemplate.findFirst({
      where: { code, ...isolationWhere },
    });

    if (!template) {
      throw new NotFoundException('模板不存在或无权限操作');
    }

    if (dto.isDefault) {
      await this.prisma.promptTemplate.updateMany({
        where: {
          category: template.category,
          isDefault: true,
          id: { not: template.id },
          ...isolationWhere,
        },
        data: { isDefault: false },
      });
    }

    await this.prisma.$transaction([
      this.prisma.promptVersion.create({
        data: {
          templateId: template.id,
          version: template.version,
          content: template.content,
          variables: template.variables,
          changeLog: dto.changeLog || '版本更新',
          changeType: 'update',
          createdBy: dto.createdBy,
        },
      }),
      this.prisma.promptTemplate.update({
        where: { id: template.id },
        data: {
          name: dto.name,
          content: dto.content,
          variables: dto.variables ? JSON.stringify(dto.variables) : undefined,
          isDefault: dto.isDefault,
          status: dto.status,
          description: dto.description,
          tags: dto.tags ? JSON.stringify(dto.tags) : undefined,
          metadata: dto.metadata ? JSON.stringify(dto.metadata) : undefined,
          version: { increment: 1 },
        },
      }),
    ]);

    this.logger.log(`更新模板成功: ${code}, 新版本: ${template.version + 1}`);
    return this.prisma.promptTemplate.findUnique({ where: { id: template.id } });
  }

  /**
   * 删除模板
   * @param id 模板 ID
   * @param context 隔离上下文
   */
  async delete(id: string, context?: IsolationContext) {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const template = await this.prisma.promptTemplate.findFirst({
      where: { ...where },
    });

    if (!template) {
      throw new NotFoundException('模板不存在或无权限操作');
    }

    await this.prisma.promptTemplate.delete({
      where: { id: id as any },
    });

    this.logger.log(`删除模板成功: ${template.code}`);
  }

  /**
   * 查询单个模板
   * @param id 模板 ID
   * @param context 隔离上下文
   * @returns 模板详情
   */
  async findOne(id: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const template = await this.prisma.promptTemplate.findFirst({
      where: { id, ...isolationWhere },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
        },
      },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return template;
  }

  /**
   * 根据标识查询模板
   * @param code 模板标识
   * @param context 隔离上下文
   * @returns 模板详情
   */
  async findByCode(code: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const template = await this.prisma.promptTemplate.findFirst({
      where: { code, ...isolationWhere },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return template;
  }

  /**
   * 查询模板列表
   * @param query 查询条件
   * @param context 隔离上下文
   * @returns 模板列表和总数
   */
  async findAll(query: QueryPromptTemplateDto, context?: IsolationContext) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const where: any = { ...isolationWhere };

    if (query.code) {
      where.code = { contains: query.code };
    }

    if (query.name) {
      where.name = { contains: query.name };
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.isDefault !== undefined) {
      where.isDefault = query.isDefault;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.tag) {
      where.tags = { contains: query.tag };
    }

    const [list, total] = await Promise.all([
      this.prisma.promptTemplate.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.promptTemplate.count({ where }),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 渲染模板
   * @param code 模板标识
   * @param variables 变量值
   * @returns 渲染后的 Prompt
   */
  async render(code: string, variables: Record<string, any>): Promise<string> {
    const startTime = Date.now();

    const template = await this.prisma.promptTemplate.findFirst({
      where: { code, status: true },
    });

    if (!template) {
      this.logger.warn(`模板不存在或未启用: ${code}, 使用内置默认模板`);
      return this.getBuiltinTemplate(code, variables);
    }

    const variableDefs = template.variables ? JSON.parse(template.variables) : [];
    const missingVariables = variableDefs
      .filter((v: any) => v.required && !variables.hasOwnProperty(v.name))
      .map((v: any) => v.name);

    if (missingVariables.length > 0) {
      throw new BadRequestException(`缺少必填变量: ${missingVariables.join(', ')}`);
    }

    let renderedPrompt = template.content;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    const costMs = Date.now() - startTime;
    this.logger.debug(`渲染模板成功: ${code}, 耗时: ${costMs}ms`);

    return renderedPrompt;
  }

  /**
   * 渲染模板并记录日志
   * @param dto 渲染 DTO
   * @param clientIp 客户端 IP
   * @param uid 用户 ID
   * @returns 渲染后的 Prompt
   */
  async renderWithLog(
    dto: RenderPromptTemplateDto,
    clientIp?: string,
    uid?: string,
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const renderedPrompt = await this.render(dto.code, dto.variables);

      const template = await this.prisma.promptTemplate.findFirst({
        where: { code: dto.code },
      });

      if (template) {
        await this.prisma.promptInvokeLog.create({
          data: {
            templateId: template.id,
            templateCode: dto.code,
            templateVersion: template.version,
            variables: JSON.stringify(dto.variables),
            renderedPrompt,
            success: true,
            costMs: Date.now() - startTime,
            clientIp,
            uid,
          },
        });
      }

      return renderedPrompt;
    } catch (error) {
      await this.prisma.promptInvokeLog.create({
        data: {
          templateCode: dto.code,
          templateVersion: 0,
          variables: JSON.stringify(dto.variables),
          renderedPrompt: '',
          success: false,
          errorMessage: error.message,
          costMs: Date.now() - startTime,
          clientIp,
          uid,
        },
      });

      throw error;
    }
  }

  /**
   * 获取版本历史
   * @param templateId 模板 ID
   * @param limit 限制数量
   * @returns 版本历史列表
   */
  async getVersionHistory(templateId: string, limit: number = 10) {
    return this.prisma.promptVersion.findMany({
      where: { templateId: templateId as any },
      orderBy: { version: 'desc' },
      take: limit,
    });
  }

  /**
   * 版本回滚
   * @param id 模板 ID
   * @param version 目标版本号
   * @param dto 回滚 DTO
   * @param context 隔离上下文
   * @returns 回滚后的模板
   */
  async rollback(id: string, version: number, dto?: RollbackPromptTemplateDto, context?: IsolationContext) {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const template = await this.prisma.promptTemplate.findFirst({
      where: { ...where },
    });

    if (!template) {
      throw new NotFoundException('模板不存在或无权限操作');
    }

    const targetVersion = await this.prisma.promptVersion.findFirst({
      where: { templateId: id as any, version },
    });

    if (!targetVersion) {
      throw new NotFoundException('目标版本不存在');
    }

    await this.prisma.$transaction([
      this.prisma.promptVersion.create({
        data: {
          templateId: template.id,
          version: template.version,
          content: template.content,
          variables: template.variables,
          changeLog: dto?.changeLog || `回滚到版本 ${version}`,
          changeType: 'rollback',
          createdBy: dto?.createdBy,
        },
      }),
      this.prisma.promptTemplate.update({
        where: { id: id as any },
        data: {
          content: targetVersion.content,
          variables: targetVersion.variables,
          version: { increment: 1 },
        },
      }),
    ]);

    this.logger.log(`版本回滚成功: ${template.code}, 回滚到版本 ${version}`);
    return this.prisma.promptTemplate.findUnique({ where: { id: id as any } });
  }

  /**
   * 获取默认模板
   * @param category 分类
   * @param context 隔离上下文
   * @returns 默认模板
   */
  async getDefaultTemplate(category: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const template = await this.prisma.promptTemplate.findFirst({
      where: {
        category,
        isDefault: true,
        status: true,
        ...isolationWhere,
      },
    });

    return template;
  }

  /**
   * 设置默认模板
   * @param id 模板 ID
   * @param context 隔离上下文
   * @returns 更新后的模板
   */
  async setDefault(id: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const template = await this.prisma.promptTemplate.findFirst({
      where: { ...where },
    });

    if (!template) {
      throw new NotFoundException('模板不存在或无权限操作');
    }

    await this.prisma.$transaction([
      this.prisma.promptTemplate.updateMany({
        where: {
          category: template.category,
          isDefault: true,
          ...isolationWhere,
        },
        data: { isDefault: false },
      }),
      this.prisma.promptTemplate.update({
        where: { id: id as any },
        data: { isDefault: true },
      }),
    ]);

    this.logger.log(`设置默认模板成功: ${template.code}`);
    return this.prisma.promptTemplate.findUnique({ where: { id: id as any } });
  }

  /**
   * 获取内置默认模板内容
   * 当数据库中不存在模板时使用
   * @param code 模板标识
   * @param variables 变量值
   * @returns 渲染后的提示词
   */
  private getBuiltinTemplate(code: string, variables: Record<string, any>): string {
    const builtinTemplates: Record<string, string> = {
      'agent-system-default': `{{basePrompt}}

{{#if hasTools}}
## 可用工具

{{tools}}

## 工具使用规则

当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。
{{/if}}

## 回答要求

1. 准确回答用户问题
2. 使用友好、专业的语气
3. 如果不确定，请明确说明`,

      'rag-chat-default': `你是一个专业的问答助手。请根据以下参考信息回答用户的问题。

## 参考信息
{{context}}

## 用户问题
{{query}}

## 回答格式
请按照以下格式回答：
[THINKING]
你的思考过程和分析
[ANSWER]
正式回答内容

## 回答要求
1. 基于参考信息给出准确、详细的回答
2. 如果参考信息中没有相关内容，请明确告知用户
3. 使用友好、专业的语气
4. 引用参考信息的来源`,

      'react-reasoning-default': `{{basePrompt}}

## 可用工具

{{tools}}

## 工具使用规则

当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。

## 回答格式（严格遵守）

每个标记必须独占一行，格式如下：

Thought: 思考当前需要做什么，分析用户问题和已有信息
Action: 要执行的工具名称（必须是上述工具之一）
Action Input: 工具参数，JSON格式，例如：{}
Observation: 工具返回结果（由系统自动提供）

... (这个 Thought/Action/Action Input/Observation 可以重复多次)

Thought: 我现在知道最终答案了
Final Answer: 对用户问题的最终回答

## 重要规则

1. 每次只能调用一个工具
2. **必须严格按照格式输出，每个标记独占一行**
3. **标记后面必须有冒号和空格，例如："Thought: "而不是"Thought"**
4. 收到 Observation 后，继续思考下一步行动
5. 当你有足够信息回答用户问题时，输出 Final Answer
6. Final Answer 必须用自然语言回答，不要提及工具调用细节
7. **如果不需要调用工具，直接输出 Final Answer**`,

      'skill-invoke-default': `你是一个技能选择助手。你的任务是根据用户的请求，选择最合适的技能并提取参数。

## 可用技能列表

{{skillDescription}}

## 用户请求

{{userRequest}}

## 返回格式要求

请严格按照以下 JSON 格式返回结果，不要添加任何其他内容：
{
  "skillCode": "技能标识",
  "params": {
    "参数名": "参数值"
  },
  "reason": "选择理由"
}

## 重要规则

1. skillCode 必须是上述可用技能之一
2. params 必须是一个对象，包含调用技能所需的参数
3. 如果用户请求不需要调用技能，返回 skillCode 为空字符串
4. 只返回 JSON，不要有任何其他文字说明`,

      'intent-classify-default': `你是一个对话意图分类助手。请分析用户消息，判断其意图类别。

## 意图类别定义

- general: 通用对话、闲聊、问答
- code: 编程开发、代码编写、调试、技术问题
- math: 数学计算、公式推导、统计分析
- creative: 创意写作、文案创作、翻译润色
- image: 图像生成、绘图、图片处理
- tts: 语音合成、文字转语音、朗读
- asr: 语音识别、语音转文字

## 用户消息

{{userMessage}}

## 返回格式要求

请严格按照以下 JSON 格式返回，不要添加任何其他内容：
{
  "intent": "意图类别",
  "confidence": 0.95
}

## 规则

1. intent 必须是上述类别之一
2. confidence 是 0-1 之间的置信度
3. 如果无法确定，返回 general，confidence 设为 0.5
4. 只返回 JSON，不要有任何其他文字`,
    };

    const template = builtinTemplates[code];
    if (!template) {
      throw new NotFoundException(`模板不存在且无内置默认模板: ${code}`);
    }

    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return rendered;
  }
}
