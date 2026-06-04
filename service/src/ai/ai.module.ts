import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AdminAiController } from './ai.admin.controller';
import { ModelRoutingModule } from "../model-routing/model-routing.module";
import { ModelModule } from '../model/model.module';
import { ModelTemplateModule } from '../model-template/model-template.module';
import { ConversationModule } from '../conversation/conversation.module';
import { IntentModule } from '../intent/intent.module';
import { PrismaModule } from '../common/prisma/prisma.module';

import { LogService } from './infrastructure/log.service';
import { ErrorHandler } from './handlers/error.handler';
import { ContextManager } from './core/context.manager';
import { StreamProcessor } from './core/stream.processor';
import { ModelExecutor } from './core/model.executor';

import { OpenAIStrategy } from './strategies/openai.strategy';
import { ZhipuStrategy } from './strategies/zhipu.strategy';
import { DeepSeekStrategy } from './strategies/deepseek.strategy';
import { OllamaStrategy } from './strategies/ollama.strategy';
import { AliyunStrategy } from './strategies/aliyun.strategy';
import { VolcengineStrategy } from './strategies/volcengine.strategy';
import { StrategyFactory } from './strategies/strategy.factory';

import { ToolCallParser } from './parsers/tool-call.parser';

import { TtsGateway } from './tts/tts.gateway';
import { TtsService } from './tts/tts.service';
import { TtsSessionManager } from './tts/tts-session.manager';

import { S2sGateway } from './s2s/s2s.gateway';
import { S2sSessionManager } from './s2s/s2s-session.manager';

@Module({
  imports: [
    ModelRoutingModule,
    ModelModule,
    ModelTemplateModule,
    ConversationModule,
    IntentModule,
    PrismaModule,
  ],
  controllers: [AiController, AdminAiController],
  providers: [
    LogService,
    ErrorHandler,
    ContextManager,
    StreamProcessor,
    ModelExecutor,
    OpenAIStrategy,
    ZhipuStrategy,
    DeepSeekStrategy,
    OllamaStrategy,
    AliyunStrategy,
    VolcengineStrategy,
    StrategyFactory,
    ToolCallParser,
    AiService,
    TtsGateway,
    TtsSessionManager,
    TtsService,
    S2sGateway,
    S2sSessionManager,
  ],
  exports: [AiService, TtsService],
})
export class AiModule {}
