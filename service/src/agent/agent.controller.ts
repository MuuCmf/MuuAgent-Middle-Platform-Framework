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
  Res,
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
import { Request, Response } from 'express';

@ApiTags('智能体管理')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/agent')
export class AgentAdminController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  @ApiOperation({ summary: '创建智能体' })
  async create(@Body() dto: CreateAgentDto) {
    const agent = await this.agentService.create(dto);
    return success(agent, '智能体创建成功');
  }

  @Put(':id')
  @ApiOperation({ summary: '更新智能体' })
  async update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    const agent = await this.agentService.update(id, dto);
    return success(agent, '智能体更新成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除智能体' })
  async remove(@Param('id') id: string) {
    await this.agentService.remove(id);
    return success(null, '智能体删除成功');
  }

  @Get(':id')
  @ApiOperation({ summary: '查询智能体详情' })
  async findOne(@Param('id') id: string) {
    const agent = await this.agentService.findOne(id);
    return success(agent);
  }

  @Get()
  @ApiOperation({ summary: '查询智能体列表' })
  async findAll(@Query() query: QueryAgentDto) {
    const { list, total, page: pageNum, pageSize } = await this.agentService.findAll(query);
    return page(list, total, pageNum, pageSize);
  }
}

@ApiTags('智能体对话')
@ApiBearerAuth('api-key')
@UseGuards(ApiKeyGuard, RateLimitGuard)
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
  ) {}

  private extractUid(req: Request, dto: { uid?: string }): string | undefined {
    return dto.uid || (req.headers['x-uid'] as string) || undefined;
  }

  @Post('chat')
  @ApiOperation({ summary: 'Agent对话（同步）' })
  async chat(@Body() dto: AgentChatDto, @Req() req: Request) {
    const uid = this.extractUid(req, dto);
    const result = await this.agentService.syncChat(dto, req.ip || 'unknown', uid);
    return success(result);
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'Agent对话（流式）' })
  async chatStream(@Body() dto: AgentChatDto, @Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const uid = this.extractUid(req, dto);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'identity');

    try {
      // 获取底层 HTTP 响应对象
      const httpResponse = res as any;
      const socket = httpResponse.socket;

      await this.agentService.streamChat(dto, req.ip || 'unknown', uid, {
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          // 强制刷新缓冲区，确保数据立即发送到客户端
          if (socket && socket.writable) {
            socket.cork?.();
            socket.uncork?.();
          }
        },
        onStep: (step) => {
          res.write(`data: ${JSON.stringify({ type: 'reasoning_step', step })}\n\n`);
          if (socket && socket.writable) {
            socket.cork?.();
            socket.uncork?.();
          }
        },
        onToolCall: (toolCall) => {
          res.write(`data: ${JSON.stringify({ type: 'tool', ...toolCall })}\n\n`);
          if (socket && socket.writable) {
            socket.cork?.();
            socket.uncork?.();
          }
        },
        onDone: (result) => {
          res.write(`data: ${JSON.stringify({ type: 'done', ...result })}\n\n`);
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', content: error })}\n\n`);
          res.end();
        },
      });
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
      res.end();
    }
  }
}