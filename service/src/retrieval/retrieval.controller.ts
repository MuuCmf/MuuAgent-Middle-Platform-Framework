import { Controller, Post, Body, UseGuards, UseInterceptors, Res, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RetrievalService } from './retrieval.service';
import { RetrievalDto } from './dto/retrieval.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitInterceptor } from '../rate-limit/rate-limit.interceptor';
import { AppUsageService } from '../common/services/app-usage.service';
import { extractIsolationContext } from '../common/utils/isolation.util';
import { success } from '../common/response/api.response';
import type { Response, Request } from 'express';

/**
 * 检索和RAG问答控制器
 */
@Controller('kb')
@ApiTags('知识库（业务端）')
@ApiBearerAuth()
@UseGuards(TenantGuard, RateLimitGuard)
@UseInterceptors(RateLimitInterceptor)
export class RetrievalController {
  /**
   * 构造函数
   * @param retrievalService 检索服务
   * @param appUsageService 应用使用量服务
   */
  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly appUsageService: AppUsageService,
  ) {}

  /**
   * 向量检索
   * @param dto 检索参数
   * @param req 请求对象
   * @returns {Promise<any>} 检索结果
   */
  @Post('retrieval')
  @ApiOperation({ summary: '向量检索', description: '根据查询内容在知识库中进行向量检索，返回相似文档片段' })
  @ApiResponse({ status: 200, description: '检索成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async retrieval(@Body() dto: RetrievalDto, @Req() req: Request) {
    const appCode = (req as any).appCode;
    const context = extractIsolationContext(req);
    const result = await this.retrievalService.retrieval(dto, context);
    
    if (appCode) {
      await this.appUsageService.incrementCallCount(appCode);
    }
    
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
  @ApiResponse({ status: 200, description: '问答成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async ragChat(@Body() dto: RagChatDto, @Req() req: Request) {
    const appCode = (req as any).appCode;
    const context = extractIsolationContext(req);
    const result = await this.retrievalService.ragChat(dto, context);
    
    if (appCode) {
      await this.appUsageService.incrementCallCount(appCode);
    }
    
    return success(result, 'RAG问答成功');
  }

  /**
   * 流式RAG问答
   * @param dto RAG问答参数
   * @param req 请求对象
   * @param res 响应对象
   */
  @Post('chat/rag/stream')
  @ApiOperation({ summary: '流式RAG问答', description: '基于知识库内容进行流式问答，实时返回回答内容' })
  @ApiResponse({ status: 200, description: '问答成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async ragChatStream(@Body() dto: RagChatDto, @Req() req: Request, @Res() res: Response) {
    const appCode = (req as any).appCode;
    const context = extractIsolationContext(req);
    
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      const stream$ = await this.retrievalService.ragChatStream(dto, context);
      console.log('[Controller] 获取到 Observable');
      
      stream$.subscribe({
        next: (data) => {
          console.log('[Controller] 收到数据:', data.substring(0, 100));
          res.write(`data: ${data}\n\n`);
          (res as any).flush?.();
        },
        error: (err) => {
          res.write(`data: [ERROR] ${err.message}\n\n`);
          res.end();
        },
        complete: () => {
          if (appCode) {
            this.appUsageService.incrementCallCount(appCode).catch(console.error);
          }
          res.write(`data: [DONE]\n\n`);
          res.end();
        },
      });
    } catch (error: any) {
      res.write(`data: [ERROR] ${error.message}\n\n`);
      res.end();
    }
  }
}
