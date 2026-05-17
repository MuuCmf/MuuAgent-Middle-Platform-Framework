import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { AppModule as AppMgmtModule } from './app/app.module';
import { ModelModule } from './model/model.module';
import { ModelTemplateModule } from './model-template/model-template.module';
import { PromptTemplateModule } from './prompt-template/prompt-template.module';
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
import { VectorModule } from './vector/vector.module';
import { CacheModule } from './cache/cache.module';
import { TaskModule } from './task/task.module';
import { OAuthModule } from './oauth/oauth.module';
import { ConversationModule } from './conversation/conversation.module';
import { FileModule } from './file/file.module';
import { IntentModule } from './intent/intent.module';

/**
 * 应用根模块
 * 负责整合所有功能模块
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    PrismaModule,

    CommonModule,

    CacheModule,

    TaskModule,

    AuthModule,

    RateLimitModule,

    AppMgmtModule,

    ModelModule,
    ModelTemplateModule,
    PromptTemplateModule,
    McpModule,
    McpServerModule,
    AiModule,
    SkillModule,
    AgentModule,
    LogModule,

    KbModule,
    DocumentModule,
    RetrievalModule,
    VectorModule,

    FileModule,

    AdminModule,

    OAuthModule,

    ConversationModule,

    IntentModule,
  ],
})
export class AppModule {}
