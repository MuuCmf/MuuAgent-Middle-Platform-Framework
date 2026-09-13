import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { success } from '../../common/response/api.response';
import { SystemUpdaterService } from './system-updater.service';
import { RunUpdateDto } from './dto/run-update.dto';

/**
 * 系统在线更新控制器
 *
 * GET  /api/admin/system-updater/check — 检查云端是否有更高版本
 * POST /api/admin/system-updater/run   — 执行在线更新（支持 dryRun 预览）
 */
@ApiTags('系统在线更新')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/system-updater')
export class SystemUpdaterController {
  constructor(private readonly systemUpdaterService: SystemUpdaterService) {}

  /**
   * 检查更新：请求云端最新版本并与本地版本对比
   */
  @Get('check')
  @ApiOperation({ summary: '检查云端是否有更高版本' })
  async check() {
    const result = await this.systemUpdaterService.checkUpdate();
    return success(result);
  }

  /**
   * 执行在线更新：下载升级文件替换本地（先备份）、执行升级 SQL、更新版本号
   */
  @Post('run')
  @ApiOperation({ summary: '执行系统在线更新' })
  async run(@Body() dto: RunUpdateDto) {
    const result = await this.systemUpdaterService.runUpdate({
      version: dto.version,
      dryRun: dto.dryRun,
    });
    return success(result);
  }
}
