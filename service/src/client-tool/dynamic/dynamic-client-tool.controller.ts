import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsBoolean, IsIn, IsInt, IsNotEmpty } from 'class-validator';
import { DynamicClientToolService, CreateDynamicClientToolDto, UpdateDynamicClientToolDto } from './dynamic-client-tool.service';
import { success as apiSuccess } from '../../common/response/api.response';

class CreateDynamicClientToolBody {
  @ApiProperty({ description: '工具名称' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: '显示名称' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({ description: '工具描述' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: '参数 JSON Schema' })
  @IsObject()
  parameters!: Record<string, unknown>;

  @ApiProperty({ description: '执行模板类型', enum: ['http_request', 'script', 'command'] })
  @IsString()
  @IsIn(['http_request', 'script', 'command'])
  executorType!: string;

  @ApiProperty({ description: '执行模板配置' })
  @IsObject()
  executorConfig!: Record<string, unknown>;

  @ApiPropertyOptional({ description: '确认模式', enum: ['auto', 'confirm', 'deny'] })
  @IsString()
  @IsOptional()
  confirmMode?: string;

  @ApiPropertyOptional({ description: '确认提示消息' })
  @IsString()
  @IsOptional()
  confirmMessage?: string;

  @ApiPropertyOptional({ description: '超时时间(毫秒)' })
  @IsInt()
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: '所属应用标识' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '创建者用户ID（应用级隔离）' })
  @IsString()
  @IsOptional()
  uid?: string;
}

class UpdateDynamicClientToolBody {
  @ApiPropertyOptional({ description: '显示名称' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: '工具描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '参数 JSON Schema' })
  @IsObject()
  @IsOptional()
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '执行模板类型', enum: ['http_request', 'script', 'command'] })
  @IsString()
  @IsOptional()
  executorType?: string;

  @ApiPropertyOptional({ description: '执行模板配置' })
  @IsObject()
  @IsOptional()
  executorConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '确认模式', enum: ['auto', 'confirm', 'deny'] })
  @IsString()
  @IsOptional()
  confirmMode?: string;

  @ApiPropertyOptional({ description: '确认提示消息' })
  @IsString()
  @IsOptional()
  confirmMessage?: string;

  @ApiPropertyOptional({ description: '超时时间(毫秒)' })
  @IsInt()
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

@ApiTags('动态客户端工具')
@Controller('agent/dynamic-client-tools')
export class DynamicClientToolController {
  constructor(
    private readonly dynamicClientToolService: DynamicClientToolService,
  ) {}

  /**
   * 创建动态客户端工具
   * @param body 创建参数
   * @returns {object} 创建的工具记录
   */
  @Post()
  @ApiOperation({ summary: '创建动态客户端工具' })
  async create(@Body() body: CreateDynamicClientToolBody) {
    const dto: CreateDynamicClientToolDto = {
      name: body.name,
      displayName: body.displayName,
      description: body.description,
      parameters: body.parameters,
      executorType: body.executorType as 'http_request' | 'script' | 'command',
      executorConfig: body.executorConfig,
      confirmMode: body.confirmMode as 'auto' | 'confirm' | 'deny' | undefined,
      confirmMessage: body.confirmMessage,
      timeout: body.timeout,
      appCode: body.appCode,
      uid: body.uid,
    };
    const tool = await this.dynamicClientToolService.create(dto);
    return apiSuccess(tool);
  }

  /**
   * 获取动态客户端工具列表（按 appCode + uid 过滤）
   * @param appCode 应用标识
   * @param uid 用户ID
   * @returns {object} 工具列表
   */
  @Get()
  @ApiOperation({ summary: '获取动态客户端工具列表' })
  async findAll(
    @Query('appCode') appCode?: string,
    @Query('uid') uid?: string,
  ) {
    const tools = await this.dynamicClientToolService.findAll(appCode, uid);
    return apiSuccess(tools);
  }

  /**
   * 客户端同步动态工具定义（含执行配置）
   * 隔离规则：只返回匹配 appCode + uid 的工具，以及全局工具
   * 注意：此路由必须在 :id 路由之前，否则 "client" 会被当作 id 参数
   * @param appCode 应用标识
   * @param uid 用户ID
   * @returns {object} 工具定义列表
   */
  @Get('client/sync')
  @ApiOperation({ summary: '客户端同步动态工具定义' })
  async syncForClient(
    @Query('appCode') appCode?: string,
    @Query('uid') uid?: string,
  ) {
    const definitions = await this.dynamicClientToolService.getDefinitionsForClient(appCode, uid);
    return apiSuccess(definitions);
  }

  /**
   * 获取单个动态客户端工具
   * @param id 工具ID
   * @returns {object} 工具记录
   */
  @Get(':id')
  @ApiOperation({ summary: '获取动态客户端工具详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const tool = await this.dynamicClientToolService.findOne(id);
    return apiSuccess(tool);
  }

  /**
   * 更新动态客户端工具
   * @param id 工具ID
   * @param body 更新参数
   * @returns {object} 更新后的工具记录
   */
  @Put(':id')
  @ApiOperation({ summary: '更新动态客户端工具' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDynamicClientToolBody,
  ) {
    const dto: UpdateDynamicClientToolDto = {
      displayName: body.displayName,
      description: body.description,
      parameters: body.parameters,
      executorType: body.executorType as 'http_request' | 'script' | 'command' | undefined,
      executorConfig: body.executorConfig,
      confirmMode: body.confirmMode as 'auto' | 'confirm' | 'deny' | undefined,
      confirmMessage: body.confirmMessage,
      timeout: body.timeout,
      enabled: body.enabled,
    };
    const tool = await this.dynamicClientToolService.update(id, dto);
    return apiSuccess(tool);
  }

  /**
   * 删除动态客户端工具
   * @param id 工具ID
   * @returns {object} 删除确认
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除动态客户端工具' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const tool = await this.dynamicClientToolService.remove(id);
    return apiSuccess(tool);
  }
}
