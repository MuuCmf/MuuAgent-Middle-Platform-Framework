import { Controller, Post, Body, Req, Sse, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import {
  AiInvokeDto,
  EmbeddingDto,
  ImageGenerateDto,
} from './dto/ai.dto';
import { success } from '../common/response/api.response';
import { Observable } from 'rxjs';
import { Request } from 'express';

/**
 * AI统一调用控制器
 * 提供AI模型调用的统一入口
 */
@ApiTags('AI调用')
@ApiBearerAuth('api-key')
@UseGuards(ApiKeyGuard, RateLimitGuard)
@Controller('ai')
export class AiController {
  /**
   * 构造函数
   * @param aiService AI服务
   */
  constructor(private readonly aiService: AiService) {}

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
   * 普通AI调用
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 调用结果
   */
  @Post('invoke')
  @ApiOperation({ summary: '普通AI调用' })
  async invoke(@Body() dto: AiInvokeDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const result = await this.aiService.invoke(dto, clientIp, userAgent, uid);
    return success(result);
  }

  /**
   * SSE流式调用
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Observable<MessageEvent>} 流式响应
   */
  @Post('stream')
  @Sse()
  @ApiOperation({ summary: 'SSE流式调用' })
  stream(
    @Body() dto: AiInvokeDto,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    return this.aiService.streamInvoke(dto, clientIp, userAgent, uid);
  }

  /**
   * Embedding向量生成
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 向量结果
   */
  @Post('embedding')
  @ApiOperation({ summary: 'Embedding向量生成' })
  async embedding(@Body() dto: EmbeddingDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const result = await this.aiService.embedding(dto, clientIp, userAgent, uid);
    return success(result);
  }

  /**
   * 文生图
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 图片结果
   */
  @Post('image')
  @ApiOperation({ summary: '文生图' })
  async imageGenerate(@Body() dto: ImageGenerateDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const result = await this.aiService.imageGenerate(dto, clientIp, userAgent, uid);
    return success(result);
  }
}
