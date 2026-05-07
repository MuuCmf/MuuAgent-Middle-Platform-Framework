import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { ModelModule } from './model/model.module';
import { ModelTemplateModule } from './model-template/model-template.module';
import { McpModule } from './mcp/mcp.module';
import { McpServerModule } from './mcp-server/mcp-server.module';
import { AiModule } from './ai/ai.module';
import { SkillModule } from './skill/skill.module';
import { AgentModule } from './agent/agent.module';
import { LogModule } from './log/log.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { KbModule } from './kb/kb.module';
import { DocumentModule } from './document/document.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { PermissionModule } from './permission/permission.module';
import { VectorModule } from './vector/vector.module';
import { CacheModule } from './cache/cache.module';
import { TaskModule } from './task/task.module';
import { OAuthModule } from './oauth/oauth.module';

/**
 * 应用根模块
 * 负责整合所有功能模块
 */
@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 限流模块
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Prisma数据库模块
    PrismaModule,

    // 缓存模块
    CacheModule,

    // 任务队列模块
    TaskModule,

    // 认证模块（全局）
    AuthModule,

    // 限流模块（多级别限流）
    RateLimitModule,

    // 业务模块
    ModelModule,
    ModelTemplateModule,
    McpModule,
    McpServerModule,
    AiModule,
    SkillModule,
    AgentModule,
    LogModule,

    // 知识库相关模块
    KbModule,
    DocumentModule,
    RetrievalModule,
    PermissionModule,
    VectorModule,

    // 管理员模块
    AdminModule,

    // OAuth认证模块
    OAuthModule,
  ],
})
export class AppModule {}
