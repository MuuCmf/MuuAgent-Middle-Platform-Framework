import { Module, Global } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppUsageService } from './services/app-usage.service';
import { IsolationService } from './services/base-isolated.service';

/**
 * 公共模块
 *
 * 提供全局可用的公共服务
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AppUsageService, IsolationService],
  exports: [AppUsageService, IsolationService],
})
export class CommonModule {}
