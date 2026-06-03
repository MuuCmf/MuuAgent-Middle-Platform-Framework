import { Controller, Post, Body, Req, Sse, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantPermissionGuard } from '../common/guards/tenant-permission.guard';
import { RequireTenantPermission } from '../common/decorators/tenant-permission.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitInterceptor } from '../rate-limit/rate-limit.interceptor';
import {
  AiInvokeDto,
  EmbeddingDto,
  ImageGenerateDto,
  TtsDto,
  AsrDto,
  S2SDto,
  VoiceChatDto,
} from './dto/ai.dto';
import { success } from '../common/response/api.response';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { StreamEmitter, SseResponseBuilder } from '../stream';

/**
 * AI统一调用控制器
 * 提供AI模型调用的统一入口
 */
@ApiTags('模型（业务端）')
@ApiBearerAuth('api-key')
@UseGuards(TenantGuard, TenantPermissionGuard, RateLimitGuard)
@UseInterceptors(RateLimitInterceptor)
@Controller('ai')
export class AiController {
  /**
   * 构造函数
   * @param aiService AI服务
   */
  constructor(
    private readonly aiService: AiService,
  ) {}

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
  @ApiOperation({ summary: '同步调用' })
  @RequireTenantPermission('ai', 'invoke')
  async invoke(@Body() dto: AiInvokeDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const result = await this.aiService.invoke(dto, clientIp, userAgent, uid, appCode);
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
  @RequireTenantPermission('ai', 'stream')
  stream(
    @Body() dto: AiInvokeDto,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const emitter = new StreamEmitter();
    // 不 await，流式在后台执行
    this.aiService.streamInvoke(dto, clientIp, userAgent, uid, appCode, emitter);
    return SseResponseBuilder.create(emitter);
  }

  /**
   * 文生图
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 图片结果
   */
  @Post('image')
  @ApiOperation({ summary: '文生图' })
  @RequireTenantPermission('ai', 'image')
  async imageGenerate(@Body() dto: ImageGenerateDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const result = await this.aiService.imageGenerate(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }

  /**
   * TTS语音合成
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 音频结果
   */
  @Post('tts')
  @ApiOperation({ summary: '语音合成' })
  @RequireTenantPermission('ai', 'tts')
  async tts(@Body() dto: TtsDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const result = await this.aiService.tts(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }

  /**
   * ASR语音识别
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 识别结果
   */
  @Post('asr')
  @ApiOperation({ summary: '语音识别' })
  @RequireTenantPermission('ai', 'asr')
  async asr(@Body() dto: AsrDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const result = await this.aiService.asr(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }

  /**
   * S2S端到端语音
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 语音结果
   */
  @Post('s2s')
  @ApiOperation({ summary: '端到端语音' })
  @RequireTenantPermission('ai', 's2s')
  async s2s(@Body() dto: S2SDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const result = await this.aiService.s2s(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }

  /**
   * 语音聊天（ASR → 文本，前端再用文本走 LLM 流式对话）
   * 按住说话→松开→音频转文字→返回识别文本
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 识别文本
   */
  @Post('voice-chat')
  @ApiOperation({ summary: '语音聊天（音频转文字）' })
  @RequireTenantPermission('ai', 'invoke')
  async voiceChat(@Body() dto: VoiceChatDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = this.extractUid(req, dto);
    const appCode = (req as any).appCode;
    const result = await this.aiService.voiceChat(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }
}
