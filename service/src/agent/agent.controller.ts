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
import { ToolExecutor } from "./tools/tool-executor";
import { SkillCacheManager } from "../skill/skill-cache-manager";
import { McpServerRegistry } from "../mcp-server/mcp-server-registry";
import { PrismaService } from "../common/prisma/prisma.service";
import { CombinedAuthGuard } from "../common/guards/combined-auth.guard";
import { ScopeGuard } from "../common/guards/scope.guard";
import { AdminScope } from "../common/constants/scope.constants";
import { RequireScope } from "../common/decorators/scope.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RateLimitGuard } from "../rate-limit/rate-limit.guard";
import { RateLimitInterceptor } from "../rate-limit/rate-limit.interceptor";
import { extractIsolationContext, IsolationContext } from "../common/services/base-isolated.service";
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from "./dto/agent.dto";
import { success, page } from "../common/response/api.response";
import { Request, Response } from "express";
import { Observable } from 'rxjs';
import { Sse } from '@nestjs/common';
import { StreamEmitter, SseResponseBuilder } from '../stream';

@ApiTags("智能体 (管理端)")
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller("admin/agent")
export class AgentAdminController {
  constructor(
    private readonly agentService: AgentService,
    private readonly toolExecutor: ToolExecutor,
    private readonly skillCacheManager: SkillCacheManager,
    private readonly mcpServerRegistry: McpServerRegistry,
    private readonly prisma: PrismaService,
  ) {}

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

  @Get("cache/stats")
  @ApiOperation({ summary: "获取工具缓存统计信息" })
  @RequireScope(AdminScope.AGENT_READ)
  getCacheStats() {
    const stats = this.toolExecutor.getCacheStats();
    return success(stats);
  }

  @Get("cache/config")
  @ApiOperation({ summary: "获取工具缓存配置" })
  @RequireScope(AdminScope.AGENT_READ)
  getCacheConfig() {
    const config = this.toolExecutor.getCacheConfig();
    return success(config);
  }

  @Delete("cache")
  @ApiOperation({ summary: "清空工具缓存" })
  @RequireScope(AdminScope.AGENT_WRITE)
  clearCache() {
    this.toolExecutor.clearCache();
    return success(null, "缓存已清空");
  }

  @Post("cache/cleanup")
  @ApiOperation({ summary: "手动清理过期缓存" })
  @RequireScope(AdminScope.AGENT_WRITE)
  cleanupExpiredCache() {
    const count = this.toolExecutor.cleanupExpiredCache();
    return success({ cleanedCount: count }, `已清理 ${count} 个过期缓存项`);
  }

  @Get("cache/overview")
  @ApiOperation({ summary: "获取全局缓存概览" })
  @RequireScope(AdminScope.AGENT_READ)
  async getCacheOverview() {
    const toolStats = this.toolExecutor.getCacheStats();
    const skillStats = this.skillCacheManager.getStats();
    const mcpStats = this.mcpServerRegistry.getStats();
    const intentCount = await this.prisma.intentCache.count();

    return success({
      toolExecutor: {
        backend: "Memory (LRU)",
        keys: toolStats.size,
        maxSize: toolStats.maxSize,
        hitRate: toolStats.hitRate,
        hits: toolStats.hits,
        misses: toolStats.misses,
        evictions: toolStats.evictions,
        expirations: toolStats.expirations,
      },
      skillCache: {
        backend: "Redis + Memory (L1/L2/L3)",
        l2MemKeys: skillStats.l2CacheSize,
        l2HitRate: skillStats.l2HitRate,
        l2Hits: skillStats.l2Hits,
        l2Misses: skillStats.l2Misses,
        l2Evictions: skillStats.l2Evictions,
        trackedRedisL1: skillStats.trackedL1Keys,
        trackedRedisL2: skillStats.trackedL2Keys,
        trackedRedisL3: skillStats.trackedL3Keys,
        config: skillStats.cacheConfig,
      },
      mcpServer: {
        backend: "Memory (Map)",
        keys: mcpStats.size,
        ttlMs: mcpStats.ttlMs,
        expiredCount: mcpStats.expiredCount,
      },
      intentCache: {
        backend: "MySQL (intentCache)",
        keys: intentCount,
      },
    });
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
    const emitter = new StreamEmitter();

    // 不 await，流式在后台执行
    this.agentService.streamChatWithEmitter(dto, req.ip || "unknown", uid, emitter, appCode);

    return SseResponseBuilder.create(emitter);
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
