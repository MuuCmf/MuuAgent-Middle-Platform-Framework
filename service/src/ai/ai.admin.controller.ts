import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TtsDto, AsrDto } from './dto/ai.dto';
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
  constructor(private readonly aiService: AiService) {}

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
}
