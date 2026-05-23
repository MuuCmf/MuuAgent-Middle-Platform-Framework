import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DynamicClientToolHandler } from './dynamic-client-tool.handler';

/**
 * 创建动态客户端工具 DTO
 */
export interface CreateDynamicClientToolDto {
  /** 工具名称 */
  name: string;
  /** 显示名称 */
  displayName?: string;
  /** 工具描述 */
  description: string;
  /** 参数 JSON Schema */
  parameters: Record<string, unknown>;
  /** 执行模板类型 */
  executorType: 'http_request' | 'script' | 'command';
  /** 执行模板配置 */
  executorConfig: Record<string, unknown>;
  /** 确认模式 */
  confirmMode?: 'auto' | 'confirm' | 'deny';
  /** 确认提示消息 */
  confirmMessage?: string;
  /** 超时时间 */
  timeout?: number;
  /** 所属应用标识 */
  appCode?: string;
}

/**
 * 更新动态客户端工具 DTO
 */
export interface UpdateDynamicClientToolDto {
  /** 显示名称 */
  displayName?: string;
  /** 工具描述 */
  description?: string;
  /** 参数 JSON Schema */
  parameters?: Record<string, unknown>;
  /** 执行模板类型 */
  executorType?: 'http_request' | 'script' | 'command';
  /** 执行模板配置 */
  executorConfig?: Record<string, unknown>;
  /** 确认模式 */
  confirmMode?: 'auto' | 'confirm' | 'deny';
  /** 确认提示消息 */
  confirmMessage?: string;
  /** 超时时间 */
  timeout?: number;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 动态客户端工具管理服务
 * 提供工具的 CRUD 操作，变更后自动刷新 Handler 缓存
 */
@Injectable()
export class DynamicClientToolService {
  private readonly logger = new Logger(DynamicClientToolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamicHandler: DynamicClientToolHandler,
  ) {}

  /**
   * 创建动态客户端工具
   * @param dto 创建 DTO
   * @param createdBy 创建者
   * @returns {Promise<any>} 创建的工具记录
   */
  async create(dto: CreateDynamicClientToolDto, createdBy?: string): Promise<any> {
    const tool = await this.prisma.dynamicClientTool.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        parameters: JSON.stringify(dto.parameters),
        executorType: dto.executorType,
        executorConfig: JSON.stringify(dto.executorConfig),
        confirmMode: dto.confirmMode || 'confirm',
        confirmMessage: dto.confirmMessage,
        timeout: dto.timeout || 30000,
        appCode: dto.appCode,
        createdBy,
      },
    });

    await this.dynamicHandler.refreshDefinitions();

    this.logger.log(`动态客户端工具已创建: ${dto.name}`);
    return tool;
  }

  /**
   * 更新动态客户端工具
   * @param id 工具ID
   * @param dto 更新 DTO
   * @returns {Promise<any>} 更新后的工具记录
   */
  async update(id: number, dto: UpdateDynamicClientToolDto): Promise<any> {
    const data: Record<string, unknown> = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.parameters !== undefined) data.parameters = JSON.stringify(dto.parameters);
    if (dto.executorType !== undefined) data.executorType = dto.executorType;
    if (dto.executorConfig !== undefined) data.executorConfig = JSON.stringify(dto.executorConfig);
    if (dto.confirmMode !== undefined) data.confirmMode = dto.confirmMode;
    if (dto.confirmMessage !== undefined) data.confirmMessage = dto.confirmMessage;
    if (dto.timeout !== undefined) data.timeout = dto.timeout;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    const tool = await this.prisma.dynamicClientTool.update({
      where: { id },
      data,
    });

    await this.dynamicHandler.refreshDefinitions();

    this.logger.log(`动态客户端工具已更新: ${tool.name}`);
    return tool;
  }

  /**
   * 删除动态客户端工具
   * @param id 工具ID
   * @returns {Promise<any>} 删除的工具记录
   */
  async remove(id: number): Promise<any> {
    const tool = await this.prisma.dynamicClientTool.delete({
      where: { id },
    });

    await this.dynamicHandler.refreshDefinitions();

    this.logger.log(`动态客户端工具已删除: ${tool.name}`);
    return tool;
  }

  /**
   * 获取所有动态客户端工具列表
   * @param appCode 应用标识
   * @returns {Promise<any[]>} 工具列表
   */
  async findAll(appCode?: string): Promise<any[]> {
    const where = appCode ? { appCode } : {};
    return this.prisma.dynamicClientTool.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取单个动态客户端工具
   * @param id 工具ID
   * @returns {Promise<any | null>} 工具记录
   */
  async findOne(id: number): Promise<any | null> {
    return this.prisma.dynamicClientTool.findUnique({
      where: { id },
    });
  }

  /**
   * 获取指定应用可用的动态工具定义（含执行配置，供客户端同步）
   * @param appCode 应用标识
   * @returns {Promise<Array>} 工具定义列表
   */
  async getDefinitionsForClient(appCode?: string): Promise<Array<{
    /** 工具名称 */
    name: string;
    /** 显示名称 */
    displayName: string | null;
    /** 工具描述 */
    description: string;
    /** 参数定义 */
    parameters: Record<string, unknown>;
    /** 执行模板类型 */
    executorType: string;
    /** 执行模板配置 */
    executorConfig: Record<string, unknown>;
    /** 确认模式 */
    confirmMode: string;
    /** 确认消息 */
    confirmMessage: string | null;
    /** 超时时间 */
    timeout: number;
  }>> {
    const where: Record<string, unknown> = { enabled: true };
    if (appCode) {
      where.OR = [
        { appCode },
        { appCode: null },
      ];
    }

    const tools = await this.prisma.dynamicClientTool.findMany({ where });

    return tools.map(tool => ({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      parameters: JSON.parse(tool.parameters),
      executorType: tool.executorType,
      executorConfig: JSON.parse(tool.executorConfig),
      confirmMode: tool.confirmMode,
      confirmMessage: tool.confirmMessage,
      timeout: tool.timeout,
    }));
  }
}
