import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Global modules (always loaded — providers available everywhere)
import { PrismaModule } from './common/prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { PromptTemplateModule } from './prompt-template/prompt-template.module';
import { FileModule } from './file/file.module';

// Infrastructure modules (always loaded — forRoot / forRootAsync)
import { CacheModule } from './cache/cache.module';
import { TaskModule } from './task/task.module';

// Business module auto-discovery
import { resolveBusinessModules } from './module-discovery/discovery';

/**
 * 应用根模块
 *
 * 业务模块通过 ModuleDiscovery 自动加载：
 * - ENABLED_MODULES=all 或未设置（默认，加载全部）
 * - ENABLED_MODULES=agent,skill,kb（指定模块 + 传递依赖自动补全）
 * - ENABLED_MODULES=all,-log,-oauth（排除特定模块）
 * - 在 src/modules/ 目录下放置新模块目录即可实现即插即用
 */
@Module({
  imports: [
    // === Infrastructure (forRoot / forRootAsync) ===
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // === Infrastructure (always loaded) ===
    CacheModule,
    TaskModule,

    // === Global modules (always loaded) ===
    PrismaModule,
    CommonModule,
    AuthModule,
    RateLimitModule,
    PromptTemplateModule,
    FileModule,

    // === Business modules (auto-discovered, dependency-sorted) ===
    ...resolveBusinessModules({
      envModules: process.env.ENABLED_MODULES,
    }),
  ],
})
export class AppModule {}
