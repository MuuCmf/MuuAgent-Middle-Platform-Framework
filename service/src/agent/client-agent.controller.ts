import { Controller, Get, Param, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AgentService } from '../agent/agent.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { AgentChatDto } from '../agent/dto/agent.dto';
import { success } from '../common/response/api.response';
import { Request, Response } from 'express';
import { Sse } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { MessageEvent } from '@nestjs/common';

/**
 * 业务端智能体控制器
 * 提供公开的智能体查询和对话接口
 */
@ApiTags('业务端-智能体')
@Controller('client/agent')
export class ClientAgentController {
  /**
   * 构造函数
   * @param agentService 智能体服务
   */
  constructor(private readonly agentService: AgentService) {}

  /**
   * 过滤敏感字段
   * @param agent 智能体数据
   * @returns {any} 过滤后的智能体数据
   */
  private filterSensitiveData(agent: any): any {
    const { apiKey, endpoint, config, ...safeData } = agent;
    return safeData;
  }

  /**
   * 获取启用的智能体列表
   * @returns {Promise<Object>} 启用的智能体列表
   */
  @Get()
  @ApiOperation({ summary: '获取启用的智能体列表' })
  async getEnabledAgents() {
    const agents = await this.agentService.findAll({ status: true, page: 1, pageSize: 100 });
    const safeAgents = agents.list.map(agent => this.filterSensitiveData(agent));
    return success(safeAgents);
  }

  /**
   * 获取智能体详情
   * @param code 智能体代码
   * @returns {Promise<Object>} 智能体详情
   */
  @Get(':code')
  @ApiOperation({ summary: '获取智能体详情' })
  async getAgentByCode(@Param('code') code: string) {
    const agent = await this.agentService.findByCode(code);
    return success(this.filterSensitiveData(agent));
  }

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
   * Agent对话（同步）
   * @param dto 对话参数
   * @param req 请求对象
   * @returns {Promise<Object>} 对话结果
   */
  @Post('chat')
  @ApiOperation({ summary: 'Agent对话（同步）' })
  async chat(@Body() dto: AgentChatDto, @Req() req: Request) {
    const uid = this.extractUid(req, dto);
    const result = await this.agentService.syncChat(dto, req.ip || 'unknown', uid);
    return success(result);
  }

  /**
   * Agent对话（流式）
   * @param dto 对话参数
   * @param req 请求对象
   * @returns {Observable<MessageEvent>} 流式响应
   */
  @Post('chat/stream')
  @Sse()
  @ApiOperation({ summary: 'Agent对话（流式）' })
  async chatStream(@Body() dto: AgentChatDto, @Req() req: Request): Promise<Observable<MessageEvent>> {
    const uid = this.extractUid(req, dto);
    const subject = new Subject<MessageEvent>();

    this.agentService.streamChat(
      dto,
      req.ip || 'unknown',
      uid,
      {
        onConversationId: (conversationId: string) => {
          subject.next(new MessageEvent('message', { data: `[CONVERSATION_ID]${conversationId}` }));
        },
        onChunk: (chunk: string) => {
          subject.next(new MessageEvent('message', { data: chunk }));
        },
        onDone: (result: any) => {
          subject.next(new MessageEvent('message', { data: '[DONE]' }));
          subject.complete();
        },
        onError: (error: string) => {
          subject.next(new MessageEvent('message', { data: `[ERROR] ${error}` }));
          subject.complete();
        },
      },
    );

    return subject.asObservable();
  }
}
