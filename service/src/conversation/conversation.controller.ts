import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitInterceptor } from '../rate-limit/rate-limit.interceptor';
import { extractIsolationContext } from '../common/utils/isolation.util';
import { success, page } from '../common/response/api.response';
import { Request } from 'express';

/**
 * 会话管理控制器（用户API）
 */
@ApiTags('会话管理（业务端）')
@UseGuards(TenantGuard, RateLimitGuard)
@UseInterceptors(RateLimitInterceptor)
@Controller('conversation')
export class ConversationController {
  /**
   * 构造函数
   * @param conversationService 会话服务
   */
  constructor(private readonly conversationService: ConversationService) {}

  /**
   * 创建会话
   * @param dto 创建参数
   * @returns {Promise<any>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建会话' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(@Body() dto: CreateConversationDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.conversationService.create(dto, context);
    return success(result, '创建会话成功');
  }

  /**
   * 查询会话列表
   * @param query 查询参数
   * @returns {Promise<any>} 查询结果
   */
  @Get()
  @ApiOperation({ summary: '查询会话列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(@Query() query: QueryConversationDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.conversationService.findAll(query, context);
    return page(result.list, result.total, result.page, result.pageSize);
  }

  /**
   * 查询会话详情
   * @param id 会话ID
   * @param messageLimit 消息数量限制
   * @returns {Promise<any>} 会话详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询会话详情' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('messageLimit') messageLimit?: number,
    @Req() req?: Request,
  ) {
    const context = req ? extractIsolationContext(req) : undefined;
    const result = await this.conversationService.findOne(id, messageLimit, context);
    return success(result);
  }

  /**
   * 更新会话
   * @param id 会话ID
   * @param dto 更新参数
   * @returns {Promise<any>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新会话' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
    @Req() req: Request,
  ) {
    const context = extractIsolationContext(req);
    const result = await this.conversationService.update(id, dto, context);
    return success(result, '更新会话成功');
  }

  /**
   * 删除会话
   * @param id 会话ID
   * @returns {Promise<any>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除会话' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    await this.conversationService.remove(id, context);
    return success(null, '删除会话成功');
  }

  /**
   * 获取会话消息列表
   * @param id 会话ID
   * @param limit 消息数量限制
   * @returns {Promise<any>} 消息列表
   */
  @Get(':id/messages')
  @ApiOperation({ summary: '获取会话消息列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    const result = await this.conversationService.getMessages(id, limit || 50);
    return success(result);
  }

  /**
   * 添加消息到会话
   * @param id 会话ID
   * @param dto 消息参数
   * @returns {Promise<any>} 添加结果
   */
  @Post(':id/messages')
  @ApiOperation({ summary: '添加消息到会话' })
  @ApiResponse({ status: 201, description: '添加成功' })
  async addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMessageDto,
  ) {
    const result = await this.conversationService.addMessage(
      id,
      dto.role as any,
      dto.content,
      {
        toolCalls: dto.toolCalls,
        toolCallId: dto.toolCallId,
        tokenCount: dto.tokenCount,
        reasoningSteps: dto.reasoningSteps,
        metadata: dto.metadata,
      },
    );
    return success(result, '添加消息成功');
  }

  /**
   * 清空会话消息
   * @param id 会话ID
   * @returns {Promise<any>} 清空结果
   */
  @Delete(':id/messages')
  @ApiOperation({ summary: '清空会话消息' })
  @ApiResponse({ status: 200, description: '清空成功' })
  async clearMessages(@Param('id', ParseUUIDPipe) id: string) {
    await this.conversationService.clearMessages(id);
    return success(null, '清空消息成功');
  }
}

/**
 * 会话管理控制器（管理后台）
 */
@ApiTags('会话管理（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/conversation')
export class ConversationAdminController {
  /**
   * 构造函数
   * @param conversationService 会话服务
   */
  constructor(private readonly conversationService: ConversationService) {}

  /**
   * 创建会话
   * @param dto 创建参数
   * @returns {Promise<any>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建会话' })
  @RequireScope(AdminScope.CONVERSATION_WRITE)
  async create(@Body() dto: CreateConversationDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.conversationService.create(dto, context);
    return success(result, '创建会话成功');
  }

  /**
   * 查询会话列表
   * @param query 查询参数
   * @returns {Promise<any>} 查询结果
   */
  @Get()
  @ApiOperation({ summary: '查询会话列表' })
  @RequireScope(AdminScope.CONVERSATION_READ)
  async findAll(@Query() query: QueryConversationDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.conversationService.findAll(query, context);
    return page(result.list, result.total, result.page, result.pageSize);
  }

  /**
   * 查询会话详情
   * @param id 会话ID
   * @param messageLimit 消息数量限制
   * @returns {Promise<any>} 会话详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询会话详情' })
  @RequireScope(AdminScope.CONVERSATION_READ)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('messageLimit') messageLimit?: number,
    @Req() req?: Request,
  ) {
    const context = req ? extractIsolationContext(req) : undefined;
    const result = await this.conversationService.findOne(id, messageLimit, context);
    return success(result);
  }

  /**
   * 更新会话
   * @param id 会话ID
   * @param dto 更新参数
   * @returns {Promise<any>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新会话' })
  @RequireScope(AdminScope.CONVERSATION_WRITE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
    @Req() req: Request,
  ) {
    const context = extractIsolationContext(req);
    const result = await this.conversationService.update(id, dto, context);
    return success(result, '更新会话成功');
  }

  /**
   * 删除会话
   * @param id 会话ID
   * @returns {Promise<any>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除会话' })
  @RequireScope(AdminScope.CONVERSATION_WRITE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    await this.conversationService.remove(id, context);
    return success(null, '删除会话成功');
  }

  /**
   * 获取会话消息列表
   * @param id 会话ID
   * @param limit 消息数量限制
   * @returns {Promise<any>} 消息列表
   */
  @Get(':id/messages')
  @ApiOperation({ summary: '获取会话消息列表' })
  @RequireScope(AdminScope.CONVERSATION_READ)
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    const result = await this.conversationService.getMessages(id, limit || 50);
    return success(result);
  }

  /**
   * 生成会话标题
   * @param id 会话ID
   * @returns {Promise<any>} 生成结果
   */
  @Post(':id/generate-title')
  @ApiOperation({ summary: '生成会话标题' })
  @RequireScope(AdminScope.CONVERSATION_WRITE)
  async generateTitle(@Param('id', ParseUUIDPipe) id: string) {
    await this.conversationService.generateTitle(id);
    const conversation = await this.conversationService.findOne(id);
    return success({ title: conversation.conversation.title }, '生成标题成功');
  }
}
