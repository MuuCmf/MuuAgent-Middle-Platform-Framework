import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VoiceProfileService } from './voice-profile.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantPermissionGuard } from '../common/guards/tenant-permission.guard';
import { success } from '../common/response/api.response';

/**
 * 语音配置业务端控制器（客户端调用）
 */
@ApiTags('语音配置（业务端）')
@ApiBearerAuth('api-key')
@UseGuards(TenantGuard, TenantPermissionGuard)
@Controller('voice-profile')
export class VoiceProfileClientController {
  constructor(private readonly voiceProfileService: VoiceProfileService) {}

  /**
   * 获取启用的语音配置列表
   * @param lang 语言筛选（可选）
   * @returns {Promise<Object>} 语音配置列表
   */
  @Get('list')
  @ApiOperation({ summary: '获取启用的语音配置列表' })
  async getActiveList(@Query('lang') lang?: string) {
    const query: any = { pageSize: 100 };
    if (lang) {
      query.language = lang;
    }
    const result = await this.voiceProfileService.findAll({
      ...query,
      status: true,
    });
    return success(result);
  }
}
