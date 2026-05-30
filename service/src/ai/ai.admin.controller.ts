import { Controller, Post, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { TtsService } from './tts/tts.service';
import { StrategyFactory } from './strategies/strategy.factory';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { TtsDto, TtsRealtimeDto, TtsCapabilityDto, AsrDto } from './dto/ai.dto';
import { ModelService } from '../model/model.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { success } from '../common/response/api.response';
import { Request } from 'express';

/**
 * AI管理端控制器
 * 提供TTS/ASR等测试功能
 */
@ApiTags('模型（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/ai')
export class AdminAiController {
  private readonly logger = new Logger(AdminAiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly ttsService: TtsService,
    private readonly strategyFactory: StrategyFactory,
    private readonly modelService: ModelService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * TTS语音合成（管理端，非实时）
   * @param dto 调用参数
   * @param req 请求对象
   * @returns {Promise<Object>} 音频结果
   */
  @Post('tts')
  @ApiOperation({ summary: '语音合成（管理端测试）' })
  @RequireScope(AdminScope.MODEL_READ)
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
  @RequireScope(AdminScope.MODEL_READ)
  async asr(@Body() dto: AsrDto, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const uid = (req as any).admin?.id?.toString?.() || 'admin';
    const appCode = (req as any).appCode;
    const result = await this.aiService.asr(dto, clientIp, userAgent, uid, appCode);
    return success(result);
  }

  /**
   * 实时流式TTS合成（管理端测试）
   * @param dto 调用参数
   * @returns {Promise<Object>} 触发结果
   */
  @Post('tts/realtime')
  @ApiOperation({ summary: '实时流式语音合成（管理端测试）' })
  @RequireScope(AdminScope.MODEL_READ)
  async ttsRealtime(@Body() dto: TtsRealtimeDto) {
    this.ttsService.streamSynthesize(
      dto.text, dto.conversationId, dto.voice, dto.speed, dto.modelCode,
    ).catch((err) => {
      this.logger.warn(`实时TTS异常: ${(err as Error).message}`);
    });

    return success({ message: '实时合成已触发' });
  }

  /**
   * 批量TTS合成（管理端测试，通过WebSocket推送）
   * @param dto 调用参数
   * @returns {Promise<Object>} 触发结果
   */
  @Post('tts/batch')
  @ApiOperation({ summary: '批量语音合成（管理端测试）' })
  @RequireScope(AdminScope.MODEL_READ)
  async ttsBatch(@Body() dto: TtsDto) {
    const conversationId = dto.conversationId || crypto.randomUUID();

    this.ttsService.batchSynthesize(
      dto.text, conversationId, dto.voice, dto.speed, dto.modelCode,
    ).catch((err) => {
      this.logger.warn(`批量TTS异常: ${(err as Error).message}`);
    });

    return success({ message: '批量合成已触发', conversationId });
  }

  /**
   * 查询TTS模型能力
   * @param dto 查询参数
   * @returns {Promise<Object>} 能力信息
   */
  @Post('tts/capability')
  @ApiOperation({ summary: '查询TTS模型能力（管理端测试用）' })
  @RequireScope(AdminScope.MODEL_READ)
  async ttsCapability(@Body() dto: TtsCapabilityDto) {
    let modelCode = dto.modelCode;

    if (!modelCode && dto.voice) {
      try {
        const voiceProfile = await this.prisma.voiceProfile.findFirst({
          where: { voiceId: dto.voice, status: true },
          orderBy: { isDefault: 'desc' },
        });
        if (voiceProfile?.modelCode) modelCode = voiceProfile.modelCode;
      } catch { /* ignore */ }
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
        return success({ supportsRealtime: false, supportsNonRealtime: false, message: '模型不存在' });
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
        } catch { /* ignore */ }
      }

      return success({ supportsRealtime, supportsNonRealtime, provider: model.provider });
    } catch {
      return success({ supportsRealtime: false, supportsNonRealtime: true, message: '无法获取模型信息' });
    }
  }
}
