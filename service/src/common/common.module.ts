import { Module, Global } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppUsageService } from './services/app-usage.service';

/**
 * 公共模块
 * 
 * 提供全局可用的公共服务
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AppUsageService],
  exports: [AppUsageService],
})
export class CommonModule {}
