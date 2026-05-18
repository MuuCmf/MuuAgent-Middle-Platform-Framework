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

// 标准技能子系统
import { SkillMdParser } from './standard/skill-md-parser';
import { SkillMdValidator } from './standard/skill-md-validator';
import { SkillScanner } from './standard/skill-scanner';
import { FileSkillProvider } from './standard/file-skill-provider';
import { ScriptRunner } from './standard/script-runner';
import { StandardSkillExecutor } from './standard/standard-skill-executor';
import { SkillRegistry } from './skill-registry';
import { SkillExporter } from './skill-exporter';
import { SkillImporter } from './skill-importer';

/**
 * 技能模块
 */
@Module({
  imports: [PromptTemplateModule, AiModule, ModelModule, FileModule],
  controllers: [SkillController],
  providers: [
    // 现有组件
    SkillService,
    McpClientService,
    BuiltinExecutor,
    PluginExecutor,
    SandboxExecutor,
    PluginLoader,
    DatabaseExecutor,
    ConnectionPoolManager,
    SqlValidator,

    // 标准技能子系统
    SkillMdParser,
    SkillMdValidator,
    SkillScanner,
    FileSkillProvider,
    ScriptRunner,
    StandardSkillExecutor,
    SkillRegistry,
    SkillExporter,
    SkillImporter,
  ],
  exports: [
    SkillService,
    McpClientService,
    BuiltinExecutor,

    // 导出标准技能组件供 Agent 等模块使用
    SkillRegistry,
    SkillScanner,
    StandardSkillExecutor,
    SkillExporter,
    SkillImporter,
  ],
})
export class SkillModule {}
