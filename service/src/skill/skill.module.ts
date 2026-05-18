import { Module } from '@nestjs/common';
import { SkillController } from './skill.controller';
import { McpClientService } from './mcp-client.service';
import { BuiltinExecutor } from './executors/builtin.executor';
import { SandboxExecutor } from './executors/sandbox.executor';
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
import { SkillImporter } from './skill-importer';

/**
 * 技能模块（标准技能）
 *
 * 所有技能均以 Agent Skills V1.0 标准格式存储在文件系统中。
 * 不再维护 DB 技能表。
 */
@Module({
  controllers: [SkillController],
  providers: [
    McpClientService,
    BuiltinExecutor,
    SandboxExecutor,
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
    SkillImporter,
  ],
  exports: [
    McpClientService,
    BuiltinExecutor,
    SandboxExecutor,
    ScriptRunner,
    ConnectionPoolManager,
    SqlValidator,

    // 导出标准技能组件供 Agent 等模块使用
    SkillRegistry,
    SkillScanner,
    StandardSkillExecutor,
    SkillImporter,
  ],
})
export class SkillModule {}
