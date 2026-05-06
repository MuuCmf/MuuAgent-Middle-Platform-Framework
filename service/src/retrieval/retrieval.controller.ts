import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RetrievalService } from './retrieval.service';
import { RetrievalDto } from './dto/retrieval.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { success } from '../common/response/api.response';

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
}
