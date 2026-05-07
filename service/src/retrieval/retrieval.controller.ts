import { Controller, Post, Body, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RetrievalService } from './retrieval.service';
import { RetrievalDto } from './dto/retrieval.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { success } from '../common/response/api.response';
import type { Response } from 'express';

/**
 * 检索和RAG问答控制器
 */
@Controller('kb')
@ApiTags('知识库检索与问答')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
export class RetrievalController {
  /**
   * 构造函数
   * @param retrievalService 检索服务
   */
  constructor(private readonly retrievalService: RetrievalService) {}

  /**
   * 向量检索
   * @param dto 检索参数
   * @returns {Promise<any>} 检索结果
   */
  @Post('retrieval')
  @ApiOperation({ summary: '向量检索', description: '根据查询内容在知识库中进行向量检索，返回相似文档片段' })
  @ApiResponse({ status: 200, description: '检索成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async retrieval(@Body() dto: RetrievalDto) {
    const result = await this.retrievalService.retrieval(dto);
    return success(result, '检索成功');
  }

  /**
   * RAG问答
   * @param dto RAG问答参数
   * @returns {Promise<any>} RAG问答结果
   */
  @Post('chat/rag')
  @ApiOperation({ summary: 'RAG问答', description: '基于知识库内容进行问答，返回回答和相关引用来源' })
  @ApiResponse({ status: 200, description: '问答成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async ragChat(@Body() dto: RagChatDto) {
    const result = await this.retrievalService.ragChat(dto);
    return success(result, 'RAG问答成功');
  }

  /**
   * 流式RAG问答
   * @param dto RAG问答参数
   * @param res 响应对象
   */
  @Post('chat/rag/stream')
  @ApiOperation({ summary: '流式RAG问答', description: '基于知识库内容进行流式问答，实时返回回答内容' })
  @ApiResponse({ status: 200, description: '问答成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未启用' })
  async ragChatStream(@Body() dto: RagChatDto, @Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      const stream$ = await this.retrievalService.ragChatStream(dto);
      console.log('[Controller] 获取到 Observable');
      
      stream$.subscribe({
        next: (data) => {
          console.log('[Controller] 收到数据:', data.substring(0, 100));
          res.write(`data: ${data}\n\n`);
          // 立即刷新缓冲区（使用类型断言）
          (res as any).flush?.();
        },
        error: (err) => {
          res.write(`data: [ERROR] ${err.message}\n\n`);
          res.end();
        },
        complete: () => {
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
