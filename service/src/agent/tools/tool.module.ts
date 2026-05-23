import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';

import { ToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { ToolDiscoveryService } from './core/tool-discovery.service';
import { DispatcherCollectorService } from './core/dispatcher-collector.service';
import { ToolController } from './tool.controller';

import { HttpRequestTool, DbQueryTool, RunCodeTool, KbSearchTool } from './builtin';
import { UseSkillTool, LoadReferenceTool, RunScriptTool } from './skill-meta';

import {
  TOOL_DISPATCHERS,
  RegisteredToolDispatcher,
  McpToolDispatcher,
  KbSearchDispatcher,
  ClientToolDispatcher,
  BuiltinFunctionDispatcher,
} from './dispatchers';

import { SkillModule } from '../../skill/skill.module';
import { McpServerModule } from '../../mcp-server/mcp-server.module';
import { RetrievalModule } from '../../retrieval/retrieval.module';
import { ClientToolModule } from '../../client-tool';

/**
 * 内置工具 providers 列表
 * 新增内置工具时，只需在此数组中添加工具类即可
 * ToolDiscoveryService 会自动发现并注册到 ToolRegistry
 */
export const BUILTIN_TOOL_PROVIDERS = [
  HttpRequestTool,
  DbQueryTool,
  RunCodeTool,
  KbSearchTool,
];

/**
 * 技能元工具 providers 列表
 * 新增技能元工具时，只需在此数组中添加工具类即可
 */
export const SKILL_META_TOOL_PROVIDERS = [
  UseSkillTool,
  LoadReferenceTool,
  RunScriptTool,
];

/**
 * 分发器 providers 列表
 * 新增分发器时，只需在此数组中添加分发器类并使用 @ToolDispatcher 装饰器
 * DispatcherCollectorService 会自动发现并按 order 排序
 */
export const DISPATCHER_PROVIDERS = [
  RegisteredToolDispatcher,
  McpToolDispatcher,
  KbSearchDispatcher,
  ClientToolDispatcher,
  BuiltinFunctionDispatcher,
];

/**
 * 工具模块
 *
 * 提供即插即用的工具注册和执行能力：
 * - 自动发现并注册带有 @AgentTool 装饰器的工具
 * - 自动收集带有 @ToolDispatcher 装饰器的分发器
 * - 支持配置化启用/禁用工具
 * - 提供统一的工具执行接口
 *
 * @example
 * 新增内置工具只需两步：
 * ```typescript
 * // 1. 创建工具类并使用 @AgentTool 装饰器
 * @AgentTool({ name: 'my_tool', enabled: true, category: 'builtin' })
 * export class MyTool extends BaseTool { ... }
 *
 * // 2. 在 BUILTIN_TOOL_PROVIDERS 数组中添加
 * export const BUILTIN_TOOL_PROVIDERS = [
 *   ...,
 *   MyTool,
 * ];
 * ```
 *
 * 新增分发器只需两步：
 * ```typescript
 * // 1. 创建分发器类并使用 @ToolDispatcher 装饰器
 * @ToolDispatcher({ name: 'my_dispatcher', order: 60 })
 * export class MyDispatcher implements IToolDispatcher { ... }
 *
 * // 2. 在 DISPATCHER_PROVIDERS 数组中添加
 * export const DISPATCHER_PROVIDERS = [
 *   ...,
 *   MyDispatcher,
 * ];
 * ```
 */
@Global()
@Module({
  imports: [DiscoveryModule, ConfigModule, SkillModule, McpServerModule, RetrievalModule, ClientToolModule],
  controllers: [ToolController],
  providers: [
    ToolRegistry,
    ToolExecutor,
    ToolDiscoveryService,
    DispatcherCollectorService,

    ...BUILTIN_TOOL_PROVIDERS,
    ...SKILL_META_TOOL_PROVIDERS,
    ...DISPATCHER_PROVIDERS,

    {
      provide: TOOL_DISPATCHERS,
      useFactory: (collector: DispatcherCollectorService) => collector.getDispatchers(),
      inject: [DispatcherCollectorService],
    },
  ],
  exports: [ToolRegistry, ToolExecutor, ToolDiscoveryService, KbSearchTool],
})
export class ToolModule {}
