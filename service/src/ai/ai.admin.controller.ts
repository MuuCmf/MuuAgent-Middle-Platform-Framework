import { Controller, Post, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { TtsStreamService } from './tts-stream.service';
import { StrategyFactory } from './strategies/strategy.factory';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TtsDto, TtsRealtimeDto, TtsCapabilityDto, TtsAppendDto, AsrDto } from './dto/ai.dto';
import { ModelService } from '../model/model.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { success } from '../common/response/api.response';
import { Request } from 'express';

/**
 * AI管理端控制器（管理后台调用）
 * 提供TTS/ASR等测试功能，使用管理端认证
 */
@ApiTags('模型（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/ai')
export class AdminAiController {
  private readonly logger = new Logger(AdminAiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly ttsStreamService: TtsStreamService,
    private readonly strategyFactory: StrategyFactory,
    private readonly modelService: ModelService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * TTS语音合成（管理端）
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 音频结果
   */
  @Post('tts')
  @ApiOperation({ summary: '语音合成（管理端测试）' })
  async tts(@Body() dto: TtsDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = (req as any).admin?.id?.toString?.() || 'admin';
    const appCode = (req as any).appCode;
    const result = await this.aiService.tts(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }

  /**
   * ASR语音识别（管理端）
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 识别结果
   */
  @Post('asr')
  @ApiOperation({ summary: '语音识别（管理端测试）' })
  async asr(@Body() dto: AsrDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = (req as any).admin?.id?.toString?.() || 'admin';
    const appCode = (req as any).appCode;
    const result = await this.aiService.asr(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }

  /**
   * 实时TTS语音合成（管理端测试）
   * 客户端需先通过WebSocket连接 /tts 命名空间，再调用此接口触发实时流式合成
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 触发结果
   */
  @Post('tts/realtime')
  @ApiOperation({ summary: '实时语音合成（管理端测试）' })
  async ttsRealtime(@Body() dto: TtsRealtimeDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = (req as any).admin?.id?.toString?.() || 'admin';
    const appCode = (req as any).appCode;

    this.ttsStreamService.synthesizeAndPush(
      dto.text,
      dto.conversationId,
      clientIp,
      userAgent,
      uid,
      appCode,
      dto.voice,
      dto.speed,
      dto.modelCode,
    );

    return success({ message: '实时合成已触发' });
  }

  /**
   * 查询TTS模型能力（管理端测试用）
   * 查询指定模型或语音配置是否支持实时/非实时语音合成
   * @param dto 查询参数
   * @returns {Promise<Object>} 能力信息
   */
  @Post('tts/capability')
  @ApiOperation({ summary: '查询TTS模型能力（管理端测试用）' })
  async ttsCapability(@Body() dto: TtsCapabilityDto) {
    let modelCode = dto.modelCode;

    if (!modelCode && dto.voice) {
      try {
        const voiceProfile = await this.prisma.voiceProfile.findFirst({
          where: { voiceId: dto.voice, status: true },
          orderBy: { isDefault: 'desc' },
        });
        if (voiceProfile?.modelCode) {
          modelCode = voiceProfile.modelCode;
        }
      } catch {
        // ignore
      }
    }

    if (!modelCode) {
      return success({
        supportsRealtime: false,
        supportsNonRealtime: true,
        message: '未指定模型，默认仅支持非实时合成',
      });
    }

    try {
      const model = await this.modelService.findByCode(modelCode);
      if (!model) {
        return success({
          supportsRealtime: false,
          supportsNonRealtime: false,
          message: '模型不存在',
        });
      }

      const strategy = this.strategyFactory.getStrategy(model.provider);
      let supportsNonRealtime = !!strategy.executeTTS;
      let supportsRealtime = !!strategy.executeTTSStream;

      if (model.capabilities) {
        try {
          const caps: string[] = JSON.parse(model.capabilities as string);
          if (caps.length > 0) {
            supportsRealtime = caps.includes('tts:realtime');
            supportsNonRealtime = caps.includes('tts');
          }
        } catch {
          // 解析失败时使用默认推断
        }
      }

      return success({
        supportsRealtime,
        supportsNonRealtime,
        provider: model.provider,
      });
    } catch {
      return success({
        supportsRealtime: false,
        supportsNonRealtime: true,
        message: '无法获取模型信息，默认仅支持非实时合成',
      });
    }
  }

  /**
   * 追加文本合成（管理端测试用）
   * 在已有实时TTS会话中追加文本并触发合成
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 触发结果
   */
  @Post('tts/append')
  @ApiOperation({ summary: '追加文本合成（管理端测试用）' })
  async ttsAppend(@Body() dto: TtsAppendDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = (req as any).admin?.id?.toString?.() || 'admin';
    const appCode = (req as any).appCode;

    // 不 await，让合成在后台异步进行，音频通过 WebSocket 推送
    this.ttsStreamService.synthesizeSentence(
      dto.text,
      dto.conversationId,
      clientIp,
      userAgent,
      uid,
      appCode,
    ).catch((err) => {
      this.logger.warn(`追加文本合成异常: ${(err as Error).message}`);
    });

    return success({ message: '追加合成已触发' });
  }
}
