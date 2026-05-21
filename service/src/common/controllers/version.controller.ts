import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VersionService } from '../services/version.service';
import { success } from '../response/api.response';

/**
 * 版本信息控制器
 * 
 * 提供版本信息查询接口
 */
@ApiTags('系统信息')
@Controller('version')
export class VersionController {
  /**
   * 构造函数
   * @param versionService 版本信息服务
   */
  constructor(private readonly versionService: VersionService) {}

  /**
   * 获取版本信息
   * @returns {Promise<object>} 版本信息
   */
  @Get()
  @ApiOperation({ summary: '获取版本信息' })
  async getVersion() {
    const info = this.versionService.getVersionInfo();
    return success(info);
  }
}
