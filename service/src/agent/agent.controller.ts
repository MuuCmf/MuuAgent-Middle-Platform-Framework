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
  UseInterceptors,
  Res,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AgentService } from "./agent.service";
import { CombinedAuthGuard } from "../common/guards/combined-auth.guard";
import { ScopeGuard } from "../common/guards/scope.guard";
import { AdminScope } from "../common/constants/scope.constants";
import { RequireScope } from "../common/decorators/scope.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RateLimitGuard } from "../rate-limit/rate-limit.guard";
import { RateLimitInterceptor } from "../rate-limit/rate-limit.interceptor";
import { extractIsolationContext, IsolationContext } from "../common/utils/isolation.util";
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from "./dto/agent.dto";
import { success, page } from "../common/response/api.response";
import { Request, Response } from "express";
import { Observable, Subject } from 'rxjs';
import { Sse } from '@nestjs/common';

@ApiTags("智能体 (管理端)")
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller("admin/agent")
export class AgentAdminController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  @ApiOperation({ summary: "创建智能体" })
  @RequireScope(AdminScope.AGENT_WRITE)
  async create(@Body() dto: CreateAgentDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const agent = await this.agentService.create(dto, context);
    return success(agent, "智能体创建成功");
  }

  @Put(":id")
  @ApiOperation({ summary: "更新智能体" })
  @RequireScope(AdminScope.AGENT_WRITE)
  async update(@Param("id") id: string, @Body() dto: UpdateAgentDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const agent = await this.agentService.update(id, dto, context);
    return success(agent, "智能体更新成功");
  }

  @Delete(":id")
  @ApiOperation({ summary: "删除智能体" })
  @RequireScope(AdminScope.AGENT_WRITE)
  async remove(@Param("id") id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    await this.agentService.remove(id, context);
    return success(null, "智能体删除成功");
  }

  @Get(":id")
  @ApiOperation({ summary: "查询智能体详情" })
  @RequireScope(AdminScope.AGENT_READ)
  async findOne(@Param("id") id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const agent = await this.agentService.findOne(id, context);
    return success(agent);
  }

  @Get()
  @ApiOperation({ summary: "查询智能体列表" })
  @RequireScope(AdminScope.AGENT_READ)
  async findAll(@Query() query: QueryAgentDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const {
      list,
      total,
      page: pageNum,
      pageSize,
    } = await this.agentService.findAll(query, context);
    return page(list, total, pageNum, pageSize);
  }
}

@ApiTags("智能体 (业务端)")
@ApiBearerAuth("api-key")
@UseGuards(TenantGuard, RateLimitGuard)
@UseInterceptors(RateLimitInterceptor)
@Controller("agent")
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
  ) {}

  private extractUid(req: Request, dto: { uid?: string }): string | undefined {
    return dto.uid || (req.headers["x-uid"] as string) || undefined;
  }

  /**
   * Agent对话（同步）
   * @param dto 对话参数
   * @param req 请求对象
   * @returns {Promise<Object>} 对话结果
   */
  @Post("chat")
  @ApiOperation({ summary: "Agent对话（同步）" })
  async chat(@Body() dto: AgentChatDto, @Req() req: Request) {
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const result = await this.agentService.syncChat(
      dto,
      req.ip || "unknown",
      uid,
      appCode,
    );
    
    return success(result);
  }

  /**
   * Agent对话（流式）
   * @param dto 对话参数
   * @param req 请求对象
   * @returns {Observable<MessageEvent>} 流式响应
   */
  @Post("chat/stream")
  @Sse()
  @ApiOperation({ summary: "Agent对话（流式）" })
  async chatStream(
    @Body() dto: AgentChatDto,
    @Req() req: Request,
  ): Promise<Observable<MessageEvent>> {
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const subject = new Subject<MessageEvent>();

    this.agentService.streamChat(dto, req.ip || "unknown", uid, {
      onConversationId: (conversationId: string) => {
        subject.next(
          new MessageEvent("message", {
            data: JSON.stringify({
              type: "conversation_id",
              conversationId,
            }),
          }),
        );
      },
      onStep: (step: any) => {
        subject.next(
          new MessageEvent("message", {
            data: JSON.stringify({
              type: "reasoning_step",
              step: step,
            }),
          }),
        );
      },
      onChunk: (chunk: string) => {
        subject.next(new MessageEvent("message", { data: chunk }));
      },
      onToolCall: (toolCall: any) => {
        subject.next(
          new MessageEvent("message", {
            data: JSON.stringify({
              type: "tool",
              ...toolCall,
            }),
          }),
        );
      },
      onDone: (result: any) => {
        subject.next(new MessageEvent("message", { data: "[DONE]" }));
        subject.complete();
      },
      onError: (error: string) => {
        subject.next(new MessageEvent("message", { data: `[ERROR] ${error}` }));
        subject.complete();
      },
    }, appCode);

    return subject.asObservable();
  }

  /**
   * 获取启用的智能体列表
   * @returns {Promise<Object>} 启用的智能体列表
   */
  @Get()
  @ApiOperation({ summary: "获取启用的智能体列表" })
  async getEnabledAgents(@Req() req: Request) {
    // 仅返回当前应用的智能体
    const context = extractIsolationContext(req);
    // 仅返回当前应用的智能体
    const agents = await this.agentService.findAll({
      status: true,
      page: 1,
      pageSize: 100,
    }, context);
    const safeAgents = agents.list.map((agent) =>
      this.filterSensitiveData(agent),
    );
    return success(safeAgents);
  }

  /**
   * 获取智能体详情
   * @param code 智能体代码
   * @returns {Promise<Object>} 智能体详情
   */
  @Get(":code")
  @ApiOperation({ summary: "获取智能体详情" })
  async getAgentByCode(@Param("code") code: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const agent = await this.agentService.findByCode(code, context);
    return success(this.filterSensitiveData(agent));
  }

  /**
   * 过滤敏感字段
   * @param agent 智能体数据
   * @returns {any} 过滤后的智能体数据
   */
  private filterSensitiveData(agent: any): any {
    const { apiKey, endpoint, config, ...safeData } = agent;
    return safeData;
  }
}
