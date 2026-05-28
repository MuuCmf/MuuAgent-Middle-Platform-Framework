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

// 基础设施层
import { LogService } from './infrastructure/log.service';

// 处理层
import { ErrorHandler } from './handlers/error.handler';

// 核心层
import { ContextManager } from './core/context.manager';
import { StreamProcessor } from './core/stream.processor';
import { ModelExecutor } from './core/model.executor';

// 策略层
import { OpenAIStrategy } from './strategies/openai.strategy';
import { ZhipuStrategy } from './strategies/zhipu.strategy';
import { DeepSeekStrategy } from './strategies/deepseek.strategy';
import { OllamaStrategy } from './strategies/ollama.strategy';
import { AliyunStrategy } from './strategies/aliyun.strategy';
import { StrategyFactory } from './strategies/strategy.factory';

// 解析器层
import { ToolCallParser } from './parsers/tool-call.parser';

/**
 * AI调用模块
 */
@Module({
  imports: [ModelRoutingModule, ModelModule, ModelTemplateModule, ConversationModule, IntentModule, PrismaModule],
  controllers: [AiController, AdminAiController],
  providers: [
    // 基础设施层
    LogService,

    // 处理层
    ErrorHandler,

    // 核心层
    ContextManager,
    StreamProcessor,
    ModelExecutor,

    // 策略层
    OpenAIStrategy,
    ZhipuStrategy,
    DeepSeekStrategy,
    OllamaStrategy,
    AliyunStrategy,
    StrategyFactory,

    // 解析器层
    ToolCallParser,

    // 服务
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
