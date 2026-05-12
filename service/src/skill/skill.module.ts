import { Module } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { McpClientService } from './mcp-client.service';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { AiSdkModule } from '../ai/providers/ai-sdk.module';
import { ModelModule } from '../model/model.module';
import { BuiltinExecutor } from './executors/builtin.executor';
import { PluginExecutor } from './executors/plugin.executor';
import { SandboxExecutor } from './executors/sandbox.executor';
import { PluginLoader } from './plugin-loader';

/**
 * 技能模块
 */
@Module({
  imports: [PromptTemplateModule, AiSdkModule, ModelModule],
  controllers: [SkillController],
  providers: [
    SkillService,
    McpClientService,
    BuiltinExecutor,
    PluginExecutor,
    SandboxExecutor,
    PluginLoader,
  ],
  exports: [SkillService, McpClientService, BuiltinExecutor],
})
export class SkillModule {}
