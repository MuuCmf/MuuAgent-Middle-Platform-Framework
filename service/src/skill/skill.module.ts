import { Module } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { McpClientService } from './mcp-client.service';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { AiModule } from '../ai/ai.module';
import { ModelModule } from '../model/model.module';
import { BuiltinExecutor } from './executors/builtin.executor';
import { PluginExecutor } from './executors/plugin.executor';
import { SandboxExecutor } from './executors/sandbox.executor';
import { PluginLoader } from './plugin-loader';

/**
 * 技能模块
 */
@Module({
  imports: [PromptTemplateModule, AiModule, ModelModule],
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
