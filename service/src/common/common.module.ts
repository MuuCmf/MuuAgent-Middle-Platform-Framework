import { Module, Global } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppUsageService } from './services/app-usage.service';
import { IsolationService } from './services/base-isolated.service';
import { VersionService } from './services/version.service';
import { VersionController } from './controllers/version.controller';

/**
 * 公共模块
 *
 * 提供全局可用的公共服务
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [VersionController],
  providers: [AppUsageService, IsolationService, VersionService],
  exports: [AppUsageService, IsolationService, VersionService],
})
export class CommonModule {}
