import { Controller, Post, Body, UseGuards, UseInterceptors, Req, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RetrievalService } from './retrieval.service';
import { RetrievalDto } from './dto/retrieval.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantPermissionGuard } from '../common/guards/tenant-permission.guard';
import { RequireTenantPermission } from '../common/decorators/tenant-permission.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitInterceptor } from '../rate-limit/rate-limit.interceptor';
import { extractIsolationContext } from '../common/services/base-isolated.service';
import { success } from '../common/response/api.response';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { StreamEmitter, SseResponseBuilder } from '../stream';

/**
 * 检索和RAG问答控制器
 */
@Controller('kb')
@ApiTags('知识库（业务端）')
@ApiBearerAuth()
@UseGuards(TenantGuard, TenantPermissionGuard, RateLimitGuard)
@UseInterceptors(RateLimitInterceptor)
export class RetrievalController {
  /**
   * 构造函数
   * @param retrievalService 检索服务
   * @param appUsageService 应用使用量服务
   */
  constructor(
    private readonly retrievalService: RetrievalService,
  ) {}

  /**
   * 向量检索
   * @param dto 检索参数
   * @param req 请求对象
   * @returns {Promise<any>} 检索结果
   */
  @Post('retrieval')
  @ApiOperation({ summary: '向量检索', description: '根据查询内容在知识库中进行向量检索，返回相似文档片段' })
  @RequireTenantPermission('kb', 'retrieval')
  @ApiResponse({ status: 200, description: '检索成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async retrieval(@Body() dto: RetrievalDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.retrievalService.retrieval(dto, context);
    return success(result, '检索成功');
  }

  /**
   * RAG问答
   * @param dto RAG问答参数
   * @param req 请求对象
   * @returns {Promise<any>} RAG问答结果
   */
  @Post('chat/rag')
  @ApiOperation({ summary: 'RAG问答', description: '基于知识库内容进行问答，返回回答和相关引用来源' })
  @RequireTenantPermission('kb', 'ragChat')
  @ApiResponse({ status: 200, description: '问答成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async ragChat(@Body() dto: RagChatDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.retrievalService.ragChat(dto, context);
    return success(result, 'RAG问答成功');
  }

  /**
   * 流式RAG问答
   * @param dto RAG问答参数
   * @param req 请求对象
   */
  @Post('chat/rag/stream')
  @Sse()
  @ApiOperation({ summary: '流式RAG问答', description: '基于知识库内容进行流式问答，实时返回回答内容' })
  @RequireTenantPermission('kb', 'ragChat')
  @ApiResponse({ status: 200, description: '问答成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async ragChatStream(@Body() dto: RagChatDto, @Req() req: Request): Promise<Observable<MessageEvent>> {
    const context = extractIsolationContext(req);
    const emitter = new StreamEmitter();
    // 不 await，流式在后台执行
    this.retrievalService.ragChatStreamWithEmitter(dto, context, emitter);
    return SseResponseBuilder.create(emitter);
  }
}
