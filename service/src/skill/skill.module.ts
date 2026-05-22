import { Module } from '@nestjs/common';
import { SkillController } from './skill.controller';
import { BuiltinExecutor } from './executors/builtin.executor';
import { BuiltinFunctionExecutor } from './executors/builtin-function.executor';
import { SandboxExecutor } from './executors/sandbox.executor';
import { SandboxCodeExecutor } from './executors/sandbox-code.executor';
import { ScriptExecutor } from './executors/script.executor';
import { WorkspaceExecutor } from './executors/workspace.executor';
import { ConnectionPoolManager } from './database/connection-pool.manager';
import { SqlValidator } from './database/sql-validator';

// 标准技能子系统
import { SkillMdParser } from './standard/skill-md-parser';
import { SkillMdValidator } from './standard/skill-md-validator';
import { SkillScanner } from './standard/skill-scanner';
import { FileSkillProvider } from './standard/file-skill-provider';
import { DatabaseSkillProvider } from './standard/database-skill-provider';
import { ScriptRunner } from './standard/script-runner';
import { SkillRegistry } from './skill-registry';
import { SkillCacheManager } from './skill-cache-manager';
import { SkillProviderChain } from './skill-provider-chain';
import { SkillImporter } from './skill-importer';
import { SkillKbService } from './skill-kb.service';

// 依赖模块
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { ClientToolModule } from '../client-tool';

@Module({
  imports: [RetrievalModule, AiModule, PrismaModule, CacheModule, ClientToolModule],
  controllers: [SkillController],
  providers: [
    BuiltinExecutor,
    BuiltinFunctionExecutor,
    SandboxExecutor,
    SandboxCodeExecutor,
    ScriptExecutor,
    WorkspaceExecutor,
    ConnectionPoolManager,
    SqlValidator,

    // 标准技能子系统
    SkillMdParser,
    SkillMdValidator,
    SkillScanner,
    FileSkillProvider,
    DatabaseSkillProvider,
    ScriptRunner,
    SkillCacheManager,
    SkillProviderChain,
    SkillRegistry,
    SkillImporter,
    SkillKbService,
  ],
  exports: [
    BuiltinExecutor,
    BuiltinFunctionExecutor,
    SandboxExecutor,
    SandboxCodeExecutor,
    ScriptExecutor,
    WorkspaceExecutor,
    ScriptRunner,
    ConnectionPoolManager,
    SqlValidator,

    // 导出标准技能组件供 Agent 等模块使用
    SkillRegistry,
    SkillScanner,
    SkillImporter,
    SkillKbService,
    SkillCacheManager,
    DatabaseSkillProvider,
  ],
})
export class SkillModule {}
