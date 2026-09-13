import { Module } from '@nestjs/common';
import { SystemUpdaterController } from './system-updater.controller';
import { SystemUpdaterService } from './system-updater.service';

/**
 * 中台框架在线更新模块（自更新，即插即用，由模块自动发现机制加载）
 *
 * - 请求云端检查版本（GET /api/admin/system-updater/check）
 * - 发现更高版本后执行在线更新（POST /api/admin/system-updater/run），
 *   更新完成后需重启服务进程使新代码生效
 */
@Module({
  // 模块自动发现依赖 @Module 元数据中存在 imports 键，空数组也必须显式声明
  imports: [],
  controllers: [SystemUpdaterController],
  providers: [SystemUpdaterService],
})
export class SystemUpdaterModule {}
