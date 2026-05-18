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
import { DatabaseSkillProvider } from './standard/database-skill-provider';
import { ScriptRunner } from './standard/script-runner';
import { SkillRegistry } from './skill-registry';
import { SkillImporter } from './skill-importer';
import { SkillKbService } from './skill-kb.service';

// 依赖模块
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

/**
 * 技能模块（标准技能）
 *
 * 实现三层缓存架构：
 * - L1层：技能元数据列表（Redis缓存，TTL 30分钟）
 * - L2层：完整技能描述符（内存LRU缓存，TTL 5分钟）
 * - L3层：参考文档内容（Redis缓存，TTL 1小时）
 *
 * Provider查询顺序：Database -> Filesystem（回源）
 */
@Module({
  imports: [RetrievalModule, AiModule, PrismaModule, CacheModule],
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
    DatabaseSkillProvider,
    ScriptRunner,
    SkillRegistry,
    SkillImporter,
    SkillKbService,
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
    SkillImporter,
    SkillKbService,
    DatabaseSkillProvider,
  ],
})
export class SkillModule {}
