import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from './dto/agent.dto';
import { success, page } from '../common/response/api.response';
import { Request } from 'express';

/**
 * 智能体管理控制器（管理端）
 */
@ApiTags('智能体管理')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/agent')
export class AgentAdminController {
  /**
   * 构造函数
   * @param agentService 智能体服务
   */
  constructor(private readonly agentService: AgentService) {}

  /**
   * 创建智能体
   * @param dto 创建智能体DTO
   * @returns {Promise<Object>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建智能体' })
  async create(@Body() dto: CreateAgentDto) {
    const agent = await this.agentService.create(dto);
    return success(agent, '智能体创建成功');
  }

  /**
   * 更新智能体
   * @param id 智能体ID
   * @param dto 更新智能体DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新智能体' })
  async update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    const agent = await this.agentService.update(id, dto);
    return success(agent, '智能体更新成功');
  }

  /**
   * 删除智能体
   * @param id 智能体ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除智能体' })
  async remove(@Param('id') id: string) {
    await this.agentService.remove(id);
    return success(null, '智能体删除成功');
  }

  /**
   * 查询智能体详情
   * @param id 智能体ID
   * @returns {Promise<Object>} 智能体详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询智能体详情' })
  async findOne(@Param('id') id: string) {
    const agent = await this.agentService.findOne(id);
    return success(agent);
  }

  /**
   * 查询智能体列表
   * @param query 查询参数
   * @returns {Promise<Object>} 智能体列表
   */
  @Get()
  @ApiOperation({ summary: '查询智能体列表' })
  async findAll(@Query() query: QueryAgentDto) {
    const { list, total, page: pageNum, pageSize } = await this.agentService.findAll(query);
    return page(list, total, pageNum, pageSize);
  }
}

/**
 * 智能体对话控制器（业务端）
 */
@ApiTags('智能体对话')
@ApiBearerAuth('api-key')
@UseGuards(ApiKeyGuard, RateLimitGuard)
@Controller('agent')
export class AgentController {
  /**
   * 构造函数
   * @param agentService 智能体服务
   */
  constructor(private readonly agentService: AgentService) {}

  /**
   * 从请求中提取用户标识
   * @param req 请求对象
   * @param dto DTO对象
   * @returns {string | undefined} 用户标识
   */
  private extractUid(req: Request, dto: { uid?: string }): string | undefined {
    return dto.uid || (req.headers['x-uid'] as string) || undefined;
  }

  /**
   * Agent对话
   * @param dto 对话请求DTO
   * @param req 请求对象
   * @returns {Promise<Object>} 对话结果
   */
  @Post('chat')
  @ApiOperation({ summary: 'Agent对话' })
  async chat(@Body() dto: AgentChatDto, @Req() req: Request) {
    const uid = this.extractUid(req, dto);
    const result = await this.agentService.chat(dto, req.ip || 'unknown', uid);
    return success(result);
  }
}
