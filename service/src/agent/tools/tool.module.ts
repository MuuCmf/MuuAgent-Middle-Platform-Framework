import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';

// 核心组件
import { ToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { ToolDiscoveryService } from './core/tool-discovery.service';
import { ToolController } from './tool.controller';

// 内置工具
import { HttpRequestTool, DbQueryTool, RunCodeTool, KbSearchTool } from './builtin';

// 技能元工具
import { UseSkillTool, LoadReferenceTool, RunScriptTool } from './skill-meta';

// 分发器
import {
  TOOL_DISPATCHERS,
  RegisteredToolDispatcher,
  McpToolDispatcher,
  KbSearchDispatcher,
  ClientToolDispatcher,
  BuiltinFunctionDispatcher,
} from './dispatchers';

// 依赖模块
import { SkillModule } from '../../skill/skill.module';
import { McpServerModule } from '../../mcp-server/mcp-server.module';
import { RetrievalModule } from '../../retrieval/retrieval.module';
import { ClientToolModule } from '../../client-tool';

/**
 * 工具模块
 *
 * 提供即插即用的工具注册和执行能力：
 * - 自动发现并注册带有 @AgentTool 装饰器的工具
 * - 支持配置化启用/禁用工具
 * - 提供统一的工具执行接口
 *
 * @example
 * ```typescript
 * // 新增工具只需：
 * // 1. 创建工具类并使用 @AgentTool 装饰器
 * // 2. 在 providers 中添加工具类
 * @AgentTool({ name: 'my_tool', enabled: true })
 * export class MyTool extends BaseTool { ... }
 * ```
 */
@Global()
@Module({
  imports: [DiscoveryModule, ConfigModule, SkillModule, McpServerModule, RetrievalModule, ClientToolModule],
  controllers: [ToolController],
  providers: [
    // 核心服务
    ToolRegistry,
    ToolExecutor,
    ToolDiscoveryService,

    // 内置工具（会被自动发现注册）
    HttpRequestTool,
    DbQueryTool,
    RunCodeTool,
    KbSearchTool,

    // 技能元工具
    UseSkillTool,
    LoadReferenceTool,
    RunScriptTool,

    // 分发器
    RegisteredToolDispatcher,
    McpToolDispatcher,
    KbSearchDispatcher,
    ClientToolDispatcher,
    BuiltinFunctionDispatcher,
    {
      provide: TOOL_DISPATCHERS,
      useFactory: (
        registered: RegisteredToolDispatcher,
        mcp: McpToolDispatcher,
        kb: KbSearchDispatcher,
        clientTool: ClientToolDispatcher,
        builtin: BuiltinFunctionDispatcher,
      ) => [registered, mcp, kb, clientTool, builtin],
      inject: [
        RegisteredToolDispatcher,
        McpToolDispatcher,
        KbSearchDispatcher,
        ClientToolDispatcher,
        BuiltinFunctionDispatcher,
      ],
    },
  ],
  exports: [ToolRegistry, ToolExecutor, ToolDiscoveryService, KbSearchTool],
})
export class ToolModule {}
