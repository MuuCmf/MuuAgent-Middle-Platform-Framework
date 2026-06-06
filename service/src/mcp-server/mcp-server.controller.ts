import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { McpServerService } from './mcp-server.service';
import { McpServerRepository } from './mcp-server.repository';
import { McpServerRegistry } from './mcp-server-registry';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import {
  CreateMcpServerDto,
  UpdateMcpServerDto,
  QueryMcpServerDto,
  DiscoverToolsDto,
  TestConnectionDto,
  McpServerResponseDto,
  ToolDescriptionDto,
  ImportMcpServersDto,
  ImportResultDto,
} from './dto/mcp-server.dto';
import { success, page } from '../common/response/api.response';
import { extractIsolationContext, IsolationService } from '../common/services/base-isolated.service';
import { McpServer } from '@prisma/client';
import { McpTransport } from './types/mcp-server.types';
import type { Request } from 'express';

/**
 * MCP Server控制器
 * 提供MCP Server的管理接口
 */
@ApiTags('MCP Server（管理端）')
@ApiBearerAuth()
@Controller('admin/mcp-server')
@UseGuards(CombinedAuthGuard, ScopeGuard)
export class McpServerController {
  /**
   * 构造函数
   * @param mcpServerService MCP Server服务
   * @param repository MCP Server仓库
   * @param registry MCP Server注册表
   * @param isolationService 应用隔离服务
   */
  constructor(
    private readonly mcpServerService: McpServerService,
    private readonly repository: McpServerRepository,
    private readonly registry: McpServerRegistry,
    private readonly isolationService: IsolationService,
  ) {}

  /**
   * 创建 MCP Server
   * @param dto 创建请求DTO
   * @param req 请求对象（用于应用隔离）
   * @returns {Promise<ApiResponseClass>} 创建的 MCP Server
   */
  @Post()
  @ApiOperation({ summary: '创建 MCP Server' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async create(@Body() dto: CreateMcpServerDto, @Req() req: Request): Promise<{ data: McpServerResponseDto }> {
    const context = extractIsolationContext(req);
    const exists = await this.repository.existsByName(dto.name);
    if (exists) {
      throw new Error(`MCP Server 名称 "${dto.name}" 已存在`);
    }

    const createData = this.isolationService.buildCreateData({
      name: dto.name,
      displayName: dto.displayName,
      description: dto.description,
      transport: dto.transport,
      url: dto.url,
      command: dto.command,
      args: dto.args,
      env: dto.env,
      apiKey: dto.apiKey,
      timeout: dto.timeout,
      enabled: dto.enabled,
      tools: dto.tools,
      metadata: dto.metadata,
      appCode: dto.appCode,
    }, context);

    const server = await this.repository.create(createData);

    await this.registry.refresh();

    return success(this.toResponseDto(server));
  }

  /**
   * 导入 MCP Server（支持 Claude Desktop 配置格式）
   * @param dto 导入请求DTO
   * @param req 请求对象（用于应用隔离）
   * @returns {Promise<ImportResultDto>} 导入结果
   */
  @Post('import')
  @ApiOperation({ summary: '导入 MCP Server（支持 Claude Desktop 配置格式）' })
  @ApiResponse({ status: 200, description: '导入完成' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async importServers(@Body() dto: ImportMcpServersDto, @Req() req: Request): Promise<{ data: ImportResultDto }> {
    const context = extractIsolationContext(req);
    const result = await this.importMcpServers(dto, context.appCode ?? undefined);
    await this.registry.refresh();
    return success(result);
  }

  /**
   * 获取 MCP Server 列表（分页）
   * @param query 查询参数
   * @param req 请求对象（用于应用隔离）
   * @returns {Promise<ApiResponseClass>} MCP Server 分页列表
   */
  @Get()
  @ApiOperation({ summary: '获取 MCP Server 列表（分页）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @RequireScope(AdminScope.MCP_SERVER_READ)
  async findAll(@Query() query: QueryMcpServerDto, @Req() req: Request): Promise<{ data: { list: McpServerResponseDto[]; total: number; page: number; pageSize: number } }> {
    const context = extractIsolationContext(req);
    const { page: pageNum = 1, pageSize = 10, ...filterParams } = query;

    const isolationWhere = this.isolationService.buildIsolationWhere(context, { includePublic: false });

    const result = await this.repository.findWithPagination({
      ...filterParams,
      extraWhere: isolationWhere,
      page: pageNum,
      pageSize,
    });

    return page(
      result.list.map(s => this.toResponseDto(s)),
      result.total,
      result.page,
      result.pageSize,
    );
  }

  /**
   * 获取 MCP Server 详情
   * @param id MCP Server ID
   * @param req 请求对象（用于应用隔离）
   * @returns {Promise<ApiResponseClass>} MCP Server 详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取 MCP Server 详情' })
  @ApiParam({ name: 'id', description: 'MCP Server ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @RequireScope(AdminScope.MCP_SERVER_READ)
  async findById(@Param('id') id: string, @Req() req: Request): Promise<{ data: McpServerResponseDto }> {
    const context = extractIsolationContext(req);
    const where = this.isolationService.buildOwnerWhere(id, context);
    const server = await this.repository.findFirst(where);
    if (!server) {
      throw new Error(`MCP Server "${id}" 未找到`);
    }
    return success(this.toResponseDto(server));
  }

  /**
   * 更新 MCP Server
   * @param id MCP Server ID
   * @param dto 更新请求DTO
   * @param req 请求对象（用于应用隔离）
   * @returns {Promise<ApiResponseClass>} 更新后的 MCP Server
   */
  @Put(':id')
  @ApiOperation({ summary: '更新 MCP Server' })
  @ApiParam({ name: 'id', description: 'MCP Server ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
    @Req() req: Request,
  ): Promise<{ data: McpServerResponseDto }> {
    const context = extractIsolationContext(req);
    const where = this.isolationService.buildOwnerWhere(id, context);
    const existing = await this.repository.findFirst(where);
    if (!existing) {
      throw new Error(`MCP Server "${id}" 未找到`);
    }

    const server = await this.repository.update(id, {
      displayName: dto.displayName,
      description: dto.description,
      transport: dto.transport,
      url: dto.url,
      command: dto.command,
      args: dto.args,
      env: dto.env,
      apiKey: dto.apiKey,
      timeout: dto.timeout,
      enabled: dto.enabled,
      tools: dto.tools,
      metadata: dto.metadata,
    });

    await this.registry.refresh();

    return success(this.toResponseDto(server));
  }

  /**
   * 删除 MCP Server
   * @param id MCP Server ID
   * @param req 请求对象（用于应用隔离）
   * @returns {Promise<void>} 删除结果
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除 MCP Server' })
  @ApiParam({ name: 'id', description: 'MCP Server ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const context = extractIsolationContext(req);
    const where = this.isolationService.buildOwnerWhere(id, context);
    const existing = await this.repository.findFirst(where);
    if (!existing) {
      throw new Error(`MCP Server "${id}" 未找到`);
    }

    await this.repository.softDelete(id);
    await this.registry.refresh();
  }

  /**
   * 发现 MCP Server 工具
   * @param dto 发现工具请求DTO
   * @returns {Promise<ApiResponseClass>} 工具列表
   */
  @Post('discover')
  @ApiOperation({ summary: '发现 MCP Server 工具' })
  @ApiResponse({ status: 200, description: '成功获取工具列表' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async discoverTools(@Body() dto: DiscoverToolsDto): Promise<{ data: { tools: ToolDescriptionDto[] } }> {
    const tools = await this.mcpServerService.discoverTools(dto);
    return success({ tools });
  }

  /**
   * 同步 MCP Server 工具
   * @param id MCP Server ID
   * @returns {Promise<ApiResponseClass>} 同步结果
   */
  @Post(':id/sync')
  @ApiOperation({ summary: '同步 MCP Server 工具' })
  @ApiParam({ name: 'id', description: 'MCP Server ID' })
  @ApiResponse({ status: 200, description: '同步成功' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async syncTools(@Param('id') id: string, @Req() req: Request): Promise<{ data: { toolCount: number; tools: ToolDescriptionDto[] } }> {
    const context = extractIsolationContext(req);
    const where = this.isolationService.buildOwnerWhere(id, context);
    const server = await this.repository.findFirst(where);
    if (!server) {
      throw new Error(`MCP Server "${id}" 未找到`);
    }

    const tools = await this.mcpServerService.discoverToolsByName(server.name);

    return success({
      toolCount: tools.length,
      tools,
    });
  }

  /**
   * 测试 MCP Server 连接
   * @param dto 测试连接请求DTO
   * @returns {Promise<ApiResponseClass>} 测试结果
   */
  @Post('test')
  @ApiOperation({ summary: '测试 MCP Server 连接' })
  @ApiResponse({ status: 200, description: '测试完成' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async testConnection(@Body() dto: TestConnectionDto): Promise<{ data: { success: boolean; message: string; result?: unknown } }> {
    const result = await this.mcpServerService.testConnection(dto);
    return success(result);
  }

  /**
   * 测试已注册的 MCP Server 连接
   * @param id MCP Server ID
   * @returns {Promise<ApiResponseClass>} 测试结果
   */
  @Post(':id/test')
  @ApiOperation({ summary: '测试已注册的 MCP Server 连接' })
  @ApiParam({ name: 'id', description: 'MCP Server ID' })
  @ApiResponse({ status: 200, description: '测试完成' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async testConnectionById(@Param('id') id: string, @Req() req: Request): Promise<{ data: { success: boolean; message: string; latency?: number } }> {
    const context = extractIsolationContext(req);
    const where = this.isolationService.buildOwnerWhere(id, context);
    const server = await this.repository.findFirst(where);
    if (!server) {
      throw new Error(`MCP Server "${id}" 未找到`);
    }

    const result = await this.mcpServerService.testConnectionByName(server.name);
    return success(result);
  }

  /**
   * 健康检查所有 MCP Server
   * @param req 请求对象（用于应用隔离）
   * @returns {Promise<ApiResponseClass>} 健康状态
   */
  @Post('health-check')
  @ApiOperation({ summary: '健康检查所有 MCP Server' })
  @ApiResponse({ status: 200, description: '检查完成' })
  @RequireScope(AdminScope.MCP_SERVER_READ)
  async healthCheckAll(@Req() req: Request): Promise<{ data: Record<string, { healthy: boolean; latency: number }> }> {
    const context = extractIsolationContext(req);
    const results = await this.mcpServerService.healthCheckAll(context.skipIsolation ? undefined : (context.appCode || undefined));
    return success(results);
  }

  /**
   * 刷新 MCP Server 缓存
   * @returns {Promise<ApiResponseClass>} 刷新结果
   */
  @Post('refresh-cache')
  @ApiOperation({ summary: '刷新 MCP Server 缓存' })
  @ApiResponse({ status: 200, description: '刷新成功' })
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async refreshCache(): Promise<{ data: { message: string } }> {
    await this.registry.refresh();
    return success({ message: '缓存已刷新' });
  }

  /**
   * 转换为响应 DTO
   * @param server 数据库记录
   * @returns {McpServerResponseDto} 响应 DTO
   */
  private toResponseDto(server: McpServer): McpServerResponseDto {
    return {
      id: server.id.toString(),
      name: server.name,
      displayName: server.displayName || undefined,
      description: server.description || undefined,
      transport: (server.transport as McpTransport) || 'http',
      url: server.url || undefined,
      command: server.command || undefined,
      args: this.repository.parseArgs(server),
      env: this.repository.parseEnv(server),
      hasApiKey: !!server.apiKey,
      timeout: server.timeout,
      enabled: server.enabled,
      tools: this.repository.parseTools(server),
      healthStatus: server.healthStatus || undefined,
      lastSyncAt: server.lastSyncAt || undefined,
      lastHealthCheck: server.lastHealthCheck || undefined,
      appCode: server.appCode || undefined,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  }

  /**
   * 导入 MCP Servers（支持 Claude Desktop 配置格式）
   * @param dto 导入请求DTO
   * @param appCode 应用标识（用于应用隔离）
   * @returns {Promise<ImportResultDto>} 导入结果
   */
  private async importMcpServers(dto: ImportMcpServersDto, appCode?: string): Promise<ImportResultDto> {
    const results: ImportResultDto['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    const mcpServers = dto.mcpServers || {};

    for (const [name, config] of Object.entries(mcpServers)) {
      try {
        const exists = await this.repository.existsByName(name);
        if (exists) {
          results.push({
            name,
            success: false,
            error: `MCP Server "${name}" 已存在`,
          });
          failedCount++;
          continue;
        }

        let transport: McpTransport = 'stdio';
        if (config.transport === 'http' || config.transport === 'sse') {
          transport = config.transport;
        } else if (config.url) {
          transport = 'http';
        }

        const server = await this.repository.create({
          name,
          transport,
          url: config.url,
          command: config.command,
          args: config.args,
          env: config.env,
          enabled: true,
          appCode,
        });

        results.push({
          name,
          success: true,
          server: this.toResponseDto(server),
        });
        successCount++;
      } catch (error) {
        results.push({
          name,
          success: false,
          error: (error as Error).message,
        });
        failedCount++;
      }
    }

    return {
      total: Object.keys(mcpServers).length,
      success: successCount,
      failed: failedCount,
      results,
    };
  }
}
