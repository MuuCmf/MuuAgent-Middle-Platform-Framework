# 服务端内置工具注册与使用指南

## 概述

MuuAgent 服务端内置工具系统提供了一套**即插即用的工具注册和执行框架**。通过装饰器 + 自动发现机制，新增工具只需编写工具类并声明即可自动注册，无需手动编写注册代码。

### 工具分类

| 分类 | 名称 | 说明 | 执行位置 |
|------|------|------|---------|
| `builtin` | 内置工具 | 平台提供的基础能力工具 | 服务端 |
| `skill-meta` | 技能元工具 | 技能加载、脚本执行等元操作 | 服务端 |
| `mcp` | MCP 工具 | 外部 MCP Server 提供的工具 | MCP Server |
| `kb` | 知识库工具 | 知识库检索 | 服务端 |
| `workspace` | 工作区工具 | 客户端文件系统操作 | 客户端 |
| `dynamic` | 动态工具 | 用户通过管理后台自定义 | 客户端 |

---

## 一、架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                        ToolModule (工具模块)                       │
│                                                                   │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐ │
│  │ ToolDiscoveryService │───▶│          ToolRegistry             │ │
│  │   (自动发现工具)      │    │        (工具注册中心)              │ │
│  │                     │    │                                  │ │
│  │ OnApplicationBootstrap│   │ Map<name, IAgentTool>           │ │
│  │ → discoverAndRegister│    │ register() / get() / getAll()   │ │
│  └─────────────────────┘    └──────────────┬───────────────────┘ │
│                                            │                      │
│  ┌─────────────────────┐                   │                      │
│  │DispatcherCollectorSvc│                  │                      │
│  │  (自动收集分发器)     │                  │                      │
│  │                     │                  │                      │
│  │ OnApplicationBootstrap│                 │                      │
│  │ → collectAndSort    │                  │                      │
│  └──────────┬──────────┘                  │                      │
│             │                              │                      │
│             ▼                              ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    ToolExecutor (工具执行器)                   │ │
│  │                                                              │ │
│  │  责任链模式:                                                  │ │
│  │  RegisteredDispatcher → McpDispatcher → KbDispatcher         │ │
│  │  → ClientDispatcher → BuiltinFunctionDispatcher              │ │
│  │                                                              │ │
│  │  + LRU 缓存 + 并行执行 + 缓存命中率监控                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                ToolAssemblyBuilder (工具组装器)               │ │
│  │                                                              │ │
│  │  根据 Agent 配置 + 技能解析结果，动态组装可用工具列表:           │ │
│  │  MCP工具 → 知识库工具 → 注册工具 → 客户端工具 → 动态工具        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、核心组件

### 2.1 ToolRegistry — 工具注册中心

**职责**：存储所有已注册工具实例的内存级注册表。

**文件位置**：`service/src/agent/tools/tool-registry.ts`

| 方法 | 说明 |
|------|------|
| `register(tool)` | 注册工具实例 |
| `get(name)` | 按名称获取工具 |
| `getAll()` | 获取所有工具 |
| `getDefinitions()` | 获取所有工具定义 |
| `has(name)` | 检查工具是否存在 |
| `getBuiltinTools()` | 获取内置工具列表（用于前端展示） |
| `clear()` | 清空注册中心 |

```typescript
@Injectable()
export class ToolRegistry {
  private tools = new Map<string, IAgentTool>();

  register(tool: IAgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): IAgentTool | undefined {
    return this.tools.get(name);
  }
}
```

### 2.2 ToolDiscoveryService — 工具自动发现服务

**职责**：应用启动时自动扫描并注册所有带 `@AgentTool` 装饰器的工具。

**文件位置**：`service/src/agent/tools/core/tool-discovery.service.ts`

**自动发现流程**：

1. 应用启动 → `OnApplicationBootstrap` 钩子触发
2. 通过 `DiscoveryService.getProviders()` 获取所有 NestJS provider 实例
3. 遍历每个实例，读取 `@AgentTool` 装饰器的 `Reflect` 元数据
4. 检查工具是否启用（配置 `tools.<name>.enabled`）
5. 校验工具有效性（必须有 `name`、`definition`、`execute` 方法）
6. 通过 → `ToolRegistry.register()` 注册

**启动日志示例**：

```
工具发现完成: 注册 7 个 [http_request, kb_search, db_query, run_code, use_skill, load_reference, run_script], 禁用 0 个, 无效 0 个
```

### 2.3 ToolExecutor — 工具执行器

**职责**：使用**责任链模式**将工具调用分发给对应的 Dispatcher。

**文件位置**：`service/src/agent/tools/tool-executor.ts`

**分发器链**（按 order 排序）：

| 顺序 | 分发器 | 匹配规则 | 说明 |
|------|--------|---------|------|
| 10 | `RegisteredToolDispatcher` | `ToolRegistry.has(name)` | 已注册的内置/技能元工具 |
| 20 | `McpToolDispatcher` | `name.startsWith('mcp__')` | 外部 MCP Server 工具 |
| 30 | `KbSearchDispatcher` | `name === 'kb_search'` | 知识库搜索 |
| 40 | `ClientToolDispatcher` | `ClientToolRegistry.isClientTool(name)` | 客户端工具（仅服务端匹配，客户端执行） |
| 50 | `BuiltinFunctionDispatcher` | `BuiltinExecutor.hasFunction(name)` | 内置函数（DAST 扫描等） |

**缓存机制**：

```typescript
// 默认缓存配置
{
  maxSize: 500,        // 最大缓存项
  defaultTtl: 60000,   // 默认 TTL 60 秒
  enabled: true,       // 是否启用
  excludeTools: ['run_code', 'http_request', 'db_query'],  // 不缓存的工具
}
```

> 具有副作用的工具（代码执行、HTTP 请求、数据库写操作）默认不缓存。

### 2.4 ToolAssemblyBuilder — 工具组装器

**职责**：根据 Agent 配置、技能解析结果、知识库绑定等条件，动态组装每个 Agent 会话的可用工具列表。

**文件位置**：`service/src/agent/execution/tool-assembly.builder.ts`

**组装顺序**：

1. **MCP 工具** — 从技能解析结果 `resolvedMcpServers` 中获取，通过 MCP Server 动态发现
2. **知识库工具** — 当 Agent 绑定了知识库且 `enableKbTool` 为 true 时添加
3. **注册工具** — 从 `ToolRegistry` 获取所有已注册工具，按类别过滤：
   - `use_skill`：注入可用技能列表到参数描述
   - `run_script`：仅当绑定的技能包含脚本时添加
   - `builtin` 类别：按 `allowedBuiltinTools` 白名单过滤
   - 其他类别：直接添加
4. **客户端工具** — 当技能解析结果包含工作区时启用
5. **动态客户端工具** — 用户通过管理后台自定义的工具，按 `appCode + uid` 隔离

### 2.5 DispatcherCollectorService — 分发器自动收集服务

**职责**：应用启动时自动扫描并收集所有带 `@ToolDispatcher` 装饰器的分发器，按 `order` 排序。

**文件位置**：`service/src/agent/tools/core/dispatcher-collector.service.ts`

---

## 三、系统架构中的实体关系

```
@AgentTool({ name, category, enabled })          @ToolDispatcher({ name, order })
        │                                                    │
        ▼                                                    ▼
  ┌───────────┐                                    ┌──────────────────┐
  │  工具类    │                                    │    分发器类        │
  │ BaseTool  │                                    │  IToolDispatcher  │
  └─────┬─────┘                                    └────────┬─────────┘
        │                                                   │
        │ 1. 声明在 ToolModule.providers 中                  │ 1. 声明在 DISPATCHER_PROVIDERS 中
        │ 2. ToolDiscoveryService 自动发现                   │ 2. DispatcherCollectorService 自动收集
        │                                                   │
        ▼                                                   ▼
  ┌───────────┐                                    ┌──────────────────┐
  │ToolRegistry│                                    │DispatcherCollector│
  │ Map<name,  │                                    │   (排序后的       │
  │  IAgentTool│                                    │    分发器链)      │
  └─────┬─────┘                                    └────────┬─────────┘
        │                                                   │
        └─────────────────────┬─────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   ToolExecutor   │
                    │  (责任链分发)     │
                    └──────────────────┘
```

---

## 四、开箱即用的内置工具清单

| 工具名称 | 显示名称 | 分类 | 是否敏感 | 图标 | 说明 |
|---------|---------|------|---------|------|------|
| `http_request` | HTTP请求 | 网络 | 否 | Connection | 发起 HTTP 请求，调用外部 API |
| `kb_search` | 知识库搜索 | 检索 | 否 | Search | 搜索知识库文档 |
| `db_query` | 数据库查询 | 数据 | 是 | Coin | 执行只读数据库查询 |
| `run_code` | 代码执行 | 计算 | 是 | Cpu | 在沙箱中执行代码（Python/JS） |
| `use_skill` | 加载技能 | skill-meta | 否 | - | 按需加载指定技能的完整指令 |
| `load_reference` | 加载参考 | skill-meta | 否 | - | 加载技能的参考文档 |
| `run_script` | 执行脚本 | skill-meta | 否 | - | 执行技能附带的脚本 |

### 4.1 前端展示

管理后台通过 API 获取内置工具列表进行展示：

```
GET /api/admin/tools/builtin         → 获取所有内置工具列表
GET /api/admin/tools/builtin/:name   → 获取指定工具详情
```

前端 `BuiltinToolSelector` 组件支持：
- 卡片式多选工具
- 全选 / 清空
- 仅选择安全工具（自动排除 `db_query`、`run_code` 等敏感工具）

---

## 五、如何新增一个内置工具

新增一个内置工具只需 **3 步**，且第 3 步由系统自动完成：

### 步骤 1：创建工具类

在 `service/src/agent/tools/builtin/` 目录下创建新文件，继承 `BaseTool`，使用 `@AgentTool` 装饰器：

```typescript
// service/src/agent/tools/builtin/my-tool.tool.ts

import { BaseTool } from '../abstract/base-tool';
import { ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { AgentTool } from '../decorators';

@AgentTool({
  name: 'my_tool',           // 工具唯一名称
  enabled: true,             // 是否启用
  category: 'builtin',       // 分类：builtin | skill-meta
})
export class MyTool extends BaseTool {
  readonly name = 'my_tool';

  readonly definition: ToolDefinition = {
    name: 'my_tool',
    description: '我的自定义工具的描述，LLM 会根据此描述决定何时调用',
    parameters: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: '参数1的说明',
        },
        param2: {
          type: 'number',
          description: '参数2的说明',
        },
      },
      required: ['param1'],
    },
    type: 'builtin',
  };

  /**
   * 执行工具
   * @param args 工具参数
   * @param context 执行上下文（包含 agent、conversationId、uid 等）
   * @returns 执行结果
   */
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const param1 = this.getArg<string>(args, 'param1');
    const param2 = this.getArg<number>(args, 'param2', 0);

    // 业务逻辑...
    return {
      result: `处理完成: ${param1}`,
      timestamp: Date.now(),
    };
  }
}
```

### 步骤 2：注册到 ToolModule

**2a.** 在 `builtin/index.ts` 中添加导出：

```typescript
// service/src/agent/tools/builtin/index.ts
export * from './http-request.tool';
export * from './db-query.tool';
export * from './run-code.tool';
export * from './kb-search.tool';
export * from './my-tool.tool';          // ← 新增
```

**2b.** 在 `ToolModule` 的 `BUILTIN_TOOL_PROVIDERS` 数组中添加：

```typescript
// service/src/agent/tools/tool.module.ts
export const BUILTIN_TOOL_PROVIDERS = [
  HttpRequestTool,
  DbQueryTool,
  RunCodeTool,
  KbSearchTool,
  MyTool,                               // ← 新增
];
```

### 步骤 3：自动发现与注册（无需手动操作）

应用启动后，`ToolDiscoveryService` 会自动：
1. 扫描 `MyTool` 实例
2. 读取 `@AgentTool({ name: 'my_tool', category: 'builtin' })` 元数据
3. 检查配置 `tools.my_tool.enabled` 是否启用
4. 校验 `name`、`definition`、`execute` 方法是否存在
5. 通过后自动调用 `ToolRegistry.register()`

启动日志会输出：

```
工具 [my_tool] 已自动注册
工具发现完成: 注册 8 个 [..., my_tool], 禁用 0 个, 无效 0 个
```

---

## 六、工具的生命周期

基于 `BaseTool` 抽象基类，每个工具具有完整的生命周期：

```
┌──────────────┐
│ onModuleInit │  ← 模块初始化（可覆盖，执行初始化逻辑）
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ ToolDiscovery│  ← 自动发现、验证、注册到 ToolRegistry
│ Service      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   execute()  │  ← LLM 调用时执行（必须实现）
│              │     ← LRU 缓存加速（可配置排除）
└──────┬───────┘
       │
       ▼
┌───────────────┐
│ healthCheck() │  ← 健康检查（可覆盖）
└──────┬────────┘
       │
       ▼
┌────────────────┐
│ onModuleDestroy│  ← 模块销毁（可覆盖，执行清理逻辑）
└────────────────┘
```

### BaseTool 提供的基类方法

| 方法 | 说明 |
|------|------|
| `validateRequired(args, required)` | 验证必需参数，缺少时抛出错误 |
| `getArg<T>(args, key, default?)` | 类型安全地获取参数值 |
| `healthCheck()` | 默认返回健康，可覆盖 |
| `onModuleInit()` | 初始化钩子，可覆盖 |
| `onModuleDestroy()` | 销毁钩子，可覆盖 |

---

## 七、配置化工具启用/禁用

工具可通过**环境变量**或**配置文件**动态控制启用/禁用，无需修改代码：

```
# .env
# 禁用 HTTP 请求工具
tools.http_request.enabled=false

# 禁用代码执行工具
tools.run_code.enabled=false

# 禁用数据库查询工具
tools.db_query.enabled=false
```

配置键格式：`tools.<工具名称>.enabled`

> **注意**：配置禁用优先级最高，会覆盖 `@AgentTool` 装饰器中的 `enabled: true`。

---

## 八、Agent 级别的工具白名单

每个 Agent 可以配置 `allowedBuiltinTools` 字段，控制该 Agent 可使用的内置工具：

```json
{
  "allowedBuiltinTools": "[\"http_request\", \"kb_search\"]"
}
```

- **空数组或不填**：允许所有内置工具
- **指定列表**：仅允许列表中的工具

解析逻辑在 `ToolAssemblyBuilder.parseAllowedBuiltinTools()` 中：

```typescript
private parseAllowedBuiltinTools(config?: string): string[] {
  if (!config) return [];  // 空 = 允许所有

  try {
    const tools = JSON.parse(config);
    return Array.isArray(tools) ? tools : [];
  } catch (e) {
    return [];
  }
}
```

---

## 九、新增分发器的步骤

如果内置工具的执行逻辑与现有分发器不匹配，可以新增自定义分发器：

### 步骤 1：创建分发器类

```typescript
// service/src/agent/tools/dispatchers/my-dispatcher.ts

import { Injectable } from '@nestjs/common';
import { IToolDispatcher } from './tool-dispatchers';
import { ToolDispatcher } from '../decorators';
import { ToolExecutionContext } from '../abstract/tool.interface';

@Injectable()
@ToolDispatcher({ name: 'my-custom', order: 35 })
export class MyCustomDispatcher implements IToolDispatcher {
  canHandle(name: string): boolean {
    return name.startsWith('my__');
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    // 自定义执行逻辑...
    return { result: 'ok' };
  }
}
```

### 步骤 2：注册到 DISPATCHER_PROVIDERS

```typescript
// service/src/agent/tools/tool.module.ts
export const DISPATCHER_PROVIDERS = [
  RegisteredToolDispatcher,
  McpToolDispatcher,
  KbSearchDispatcher,
  ClientToolDispatcher,
  BuiltinFunctionDispatcher,
  MyCustomDispatcher,    // ← 新增
];
```

系统启动后，`DispatcherCollectorService` 会自动收集并按 `order` 排序。

---

## 十、工具执行完整流程

```
LLM 输出 tool_call
       │
       ▼
┌──────────────────┐
│  ToolExecutor     │
│  executeToolCall()│
└────────┬─────────┘
         │
         ├─ 检查 LRU 缓存
         │   ├─ 命中 → 直接返回缓存结果
         │   └─ 未命中 ↓
         │
         ▼
┌──────────────────┐
│ dispatch()        │
│ 遍历分发器链      │
└────────┬─────────┘
         │
         ├─ 1. RegisteredToolDispatcher.canHandle(name)?
         │     └─ ToolRegistry.has(name) → tool.execute(args, context)
         │
         ├─ 2. McpToolDispatcher.canHandle(name)?
         │     └─ name.startsWith('mcp__') → McpServerService.callToolByName()
         │
         ├─ 3. KbSearchDispatcher.canHandle(name)?
         │     └─ name === 'kb_search' → KbSearchTool.execute()
         │
         ├─ 4. ClientToolDispatcher.canHandle(name)?
         │     └─ ClientToolRegistry.isClientTool(name) → 抛错（应在客户端执行）
         │
         └─ 5. BuiltinFunctionDispatcher.canHandle(name)?
               └─ BuiltinExecutor.hasFunction(name) → BuiltinExecutor.execute()
```

---

## 十一、相关文件索引

| 文件 | 说明 |
|------|------|
| `service/src/agent/tools/tool.module.ts` | 工具模块定义，BUILTIN_TOOL_PROVIDERS 数组 |
| `service/src/agent/tools/tool-registry.ts` | 工具注册中心 |
| `service/src/agent/tools/tool-executor.ts` | 工具执行器（责任链 + 缓存） |
| `service/src/agent/tools/core/tool-discovery.service.ts` | 工具自动发现服务 |
| `service/src/agent/tools/core/dispatcher-collector.service.ts` | 分发器自动收集服务 |
| `service/src/agent/tools/abstract/base-tool.ts` | 工具抽象基类 |
| `service/src/agent/tools/abstract/tool.interface.ts` | 工具接口定义 |
| `service/src/agent/tools/decorators/tool.decorator.ts` | `@AgentTool` / `@ToolDispatcher` 装饰器 |
| `service/src/agent/tools/constants/tool.constants.ts` | 工具系统常量 |
| `service/src/agent/tools/builtin/*.tool.ts` | 内置工具实现 |
| `service/src/agent/tools/skill-meta/*.tool.ts` | 技能元工具实现 |
| `service/src/agent/tools/dispatchers/tool-dispatchers.ts` | 分发器实现 |
| `service/src/agent/tools/tool.controller.ts` | 工具管理 API 控制器 |
| `service/src/agent/execution/tool-assembly.builder.ts` | 工具组装器 |
| `admin/src/stores/tool.ts` | 前端工具 Store |
| `admin/src/views/agents/components/BuiltinToolSelector.vue` | 前端工具选择器组件 |
| `admin/src/api/tool.ts` | 前端工具 API 调用 |