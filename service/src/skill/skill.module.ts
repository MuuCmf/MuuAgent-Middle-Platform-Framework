import { Module } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { McpClientService } from './mcp-client.service';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { AiModule } from '../ai/ai.module';
import { ModelModule } from '../model/model.module';
import { FileModule } from '../file/file.module';
import { BuiltinExecutor } from './executors/builtin.executor';
import { PluginExecutor } from './executors/plugin.executor';
import { SandboxExecutor } from './executors/sandbox.executor';
import { PluginLoader } from './plugin-loader';
import { DatabaseExecutor } from './executors/database.executor';
import { ConnectionPoolManager } from './database/connection-pool.manager';
import { SqlValidator } from './database/sql-validator';

/**
 * 技能模块
 */
@Module({
  imports: [PromptTemplateModule, AiModule, ModelModule, FileModule],
  controllers: [SkillController],
  providers: [
    SkillService,
    McpClientService,
    BuiltinExecutor,
    PluginExecutor,
    SandboxExecutor,
    PluginLoader,
    DatabaseExecutor,
    ConnectionPoolManager,
    SqlValidator,
  ],
  exports: [SkillService, McpClientService, BuiltinExecutor],
})
export class SkillModule {}
