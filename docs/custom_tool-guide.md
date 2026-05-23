# 自定义 Skill 开发指南

## 概述

MuuAgent 平台提供两套独立的自定义 Skill 子系统，分别服务于不同场景：

| 子系统 | 面向对象 | 执行位置 | 定义方式 | 适用场景 |
|--------|---------|---------|---------|---------|
| Agent Skills（标准技能） | LLM / Agent | 服务端 | SKILL.md 文件 | 扩展 Agent 的指令能力、声明依赖 |
| Dynamic Client Tools（动态客户端工具） | 客户端 | 客户端 | 数据库记录 | 扩展客户端的执行能力（HTTP/脚本/命令） |

---

## 一、Agent Skills（标准技能）

### 1.1 架构概览

```
SKILL.md + scripts/ + references/ + assets/
         ↓
    SkillScanner（文件系统扫描，建立 L1 索引）
         ↓
    SkillProviderChain（Database 优先 → Filesystem 回源）
         ↓
    SkillRegistry（三层缓存门面）
         ↓
    SkillResolutionBuilder（Agent 绑定技能时解析依赖链）
```

**三层缓存架构：**

| 层级 | 内容 | 存储位置 | TTL |
|------|------|---------|-----|
| L1 | 技能元数据列表 | Redis | 30 分钟 |
| L2 | 完整技能描述符 | 内存 LRU | 5 分钟 |
| L3 | 参考文档内容 | Redis | 1 小时 |

### 1.2 目录结构

标准技能以文件系统目录组织，遵循 Agent Skills Open Specification V1.0：

```
skills/standard/
  ├── _public/                    ← 公开技能（所有应用可见）
  │   ├── web-search/
  │   │   └── SKILL.md
  │   ├── json-formatter/
  │   │   ├── SKILL.md
  │   │   └── scripts/
  │   │       └── format.js
  │   └── my-custom-skill/
  │       ├── SKILL.md            ← 必填：技能定义文件
  │       ├── scripts/            ← 可选：脚本文件
  │       ├── references/         ← 可选：参考文档
  │       └── assets/             ← 可选：资源文件
  └── app-{code}/                 ← 应用专属技能（仅该应用可见）
      └── internal-tool/
          └── SKILL.md
```

**多租户隔离规则：**

| 目录位置 | 隔离行为 |
|---------|---------|
| `_public/` 下的技能 | 所有应用可见 |
| `app-{code}/` 下的技能 | 仅 `code` 对应的应用可见 |
| 其他位置 | 默认公开 |

### 1.3 SKILL.md 格式

SKILL.md 由 **Frontmatter**（YAML 元数据）和 **Body**（Markdown 指令正文）组成：

```yaml
---
name: my-custom-skill
description: 我的自定义技能描述，说明触发条件和使用场景
version: "1.0.0"
license: MIT
metadata:
  author: my-team
  tags: ["custom", "tool"]
requires:
  mcp-servers:
    - my-mcp-server
  skills:
    - base-skill
  workspace: true
allowed-tools: web_search read_file
---

# 技能指令正文

这里写 LLM 执行该技能时遵循的指令...

## 使用场景

描述技能的典型使用场景...

## 工具调用

描述技能依赖的工具及其参数...
```

#### Frontmatter 字段说明

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `name` | 是 | string | 技能唯一标识，小写字母+数字+连字符，≤64字符，须与目录名一致 |
| `description` | 是 | string | 技能描述及触发条件，≤1024字符 |
| `version` | 否 | string | 语义版本号，推荐格式 `1.0.0` |
| `license` | 否 | string | 许可协议标识，如 `MIT`、`Apache-2.0` |
| `compatibility` | 否 | string | 环境兼容性说明，≤500字符 |
| `metadata` | 否 | object | 平台扩展元数据，自定义键值对 |
| `allowed-tools` | 否 | string | 预授权工具列表，空格或逗号分隔 |
| `requires` | 否 | object | 依赖声明（MuuAgent 扩展） |

#### `requires` 依赖声明

| 子字段 | 类型 | 说明 |
|--------|------|------|
| `mcp-servers` | string[] | 依赖的 MCP Server 名称列表 |
| `knowledge-bases` | string[] | 依赖的知识库列表 |
| `tools` | string[] | 依赖的内置工具列表 |
| `skills` | string[] | 依赖的其他技能（会递归解析） |
| `workspace` | boolean | 是否需要 workspace 文件操作能力 |

### 1.4 添加自定义技能

#### 方式一：文件系统方式

1. 在 `skills/standard/` 对应目录下创建技能目录
2. 编写 `SKILL.md` 文件
3. 按需添加 `scripts/`、`references/`、`assets/` 子目录
4. 执行扫描和数据库同步：

```bash
# 扫描文件系统技能
POST /admin/skill/standard/scan

# 同步到数据库
POST /admin/skill/sync
```

#### 方式二：ZIP 导入方式

通过管理后台的"导入技能"功能上传 `.zip` 包，导入流程：

```
上传 ZIP → 解压提取 → 解析 SKILL.md → 校验 → 安全扫描 → 写入文件系统
```

**ZIP 包结构示例：**

```
my-custom-skill.zip
  └── my-custom-skill/
      ├── SKILL.md
      ├── scripts/
      │   └── process.js
      └── references/
          └── api-docs.md
```

**安全防护：**

| 防护项 | 限制 |
|--------|------|
| ZIP 炸弹 - 文件数 | ≤ 100 个文件 |
| ZIP 炸弹 - 总大小 | ≤ 5MB |
| 文件类型白名单 | `.md` `.py` `.sh` `.js` `.json` `.yaml` `.yml` `.txt` `.csv` `.xml` `.toml` `.cfg` `.ini` `.env.example` |
| 危险代码检测 | `eval()` `exec()` `child_process` `rm -rf` 等 |
| 提示注入检测 | `ignore previous instructions` 等模式 |
| 硬编码凭证检测 | `password=` `secret=` `api_key=` 等模式 |

### 1.5 校验规则

| 字段 | 规则 | 错误级别 |
|------|------|---------|
| `name` | 必填，`/^[a-z0-9]+(-[a-z0-9]+)*$/`，≤64字符，须与目录名一致 | 错误 |
| `description` | 必填，≤1024字符 | 错误 |
| `version` | 推荐语义版本号格式 | 警告 |
| `license` | 建议填写 | 警告 |
| `body` | ≤5000 tokens 硬限制，≤500 行软限制 | 错误/警告 |

### 1.6 技能依赖解析

当 Agent 绑定技能时，[SkillResolutionBuilder](../service/src/agent/execution/skill-resolution.builder.ts) 会递归解析依赖链：

1. 解析 `requires.skills` 中的依赖技能名称
2. 递归解析每个依赖技能的依赖
3. 检测循环依赖（已访问的技能跳过）
4. 检查 `requires.mcp-servers` 是否已绑定
5. 检查 `requires.workspace` 是否需要启用

### 1.7 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/skill/standard/list` | 列出标准技能（L1 缓存，支持分页） |
| GET | `/admin/skill/standard/:name` | 获取技能详情（L2 缓存） |
| POST | `/admin/skill/standard/scan` | 触发扫描并同步到数据库 |
| POST | `/admin/skill/import` | 导入 ZIP 技能包 |
| DELETE | `/admin/skill/cache/:name` | 清除指定技能缓存 |
| DELETE | `/admin/skill/cache` | 清除所有技能缓存 |
| POST | `/admin/skill/sync` | 手动同步技能到数据库 |
| GET | `/admin/skill/stats` | 获取技能统计信息 |

---

## 二、Dynamic Client Tools（动态客户端工具）

### 2.1 架构概览

```
管理后台创建工具定义（DynamicClientTool 表）
         ↓
DynamicClientToolService（CRUD + 刷新 Handler 缓存）
         ↓
DynamicClientToolHandler（服务端：SSE 下发调用 → 等待结果回传）
         ↓  SSE 事件
ClientToolService.syncToRegistry()（客户端：同步工具定义）
         ↓
DynamicPluginRegistry（客户端：插件注册表）
         ↓
DynamicClientToolExecutor（客户端：执行器）
         ↓
ExecutorTemplate（http_request / script / command）
```

### 2.2 与标准技能的区别

| 维度 | Agent Skills | Dynamic Client Tools |
|------|-------------|---------------------|
| 面向对象 | LLM / Agent | 客户端 |
| 定义方式 | SKILL.md 文件 | 数据库记录 |
| 执行位置 | 服务端（LLM 推理 + MCP/脚本） | 客户端（HTTP/JS/命令） |
| 添加方式 | 文件系统 / ZIP 导入 | 管理后台 CRUD |
| 是否需要代码 | 不需要（Markdown + 脚本） | 不需要（配置式） |
| 隔离方式 | appCode 目录层级 | appCode + uid 数据库字段 |
| 缓存机制 | 三层缓存（Redis + 内存 + Redis） | Handler 内存缓存 |

### 2.3 创建动态客户端工具

通过管理后台或 API 创建工具定义：

```json
{
  "name": "my_http_tool",
  "displayName": "我的HTTP工具",
  "description": "调用外部API获取数据",
  "parameters": {
    "type": "object",
    "properties": {
      "endpoint": { "type": "string", "description": "API端点" },
      "token": { "type": "string", "description": "认证令牌" }
    },
    "required": ["endpoint"]
  },
  "executorType": "http_request",
  "executorConfig": {
    "url": "https://api.example.com/{args.endpoint}",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer {args.token}"
    }
  },
  "confirmMode": "confirm",
  "confirmMessage": "确定要调用 {args.endpoint} 吗？",
  "timeout": 30000,
  "appCode": "my-app",
  "uid": "user-123"
}
```

#### 字段说明

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `name` | 是 | string | 工具名称，如 `my_http_tool` |
| `displayName` | 否 | string | 显示名称 |
| `description` | 是 | string | 工具描述（给 LLM 看的） |
| `parameters` | 是 | object | 参数定义（JSON Schema） |
| `executorType` | 是 | string | 执行模板类型：`http_request` / `script` / `command` |
| `executorConfig` | 是 | object | 执行模板配置（JSON） |
| `confirmMode` | 否 | string | 确认模式：`auto` / `confirm` / `deny`，默认 `confirm` |
| `confirmMessage` | 否 | string | 确认提示消息模板，支持 `{args.xxx}` 占位符 |
| `timeout` | 否 | number | 超时时间（毫秒），默认 30000 |
| `appCode` | 否 | string | 所属应用标识（隔离） |
| `uid` | 否 | string | 创建者用户ID（隔离） |

### 2.4 执行模板

#### http_request 模板

发起 HTTP 请求，适用于调用外部 API：

```json
{
  "executorType": "http_request",
  "executorConfig": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {args.token}"
    },
    "body": "{\"query\": \"{args.query}\"}",
    "timeout": 30000
  }
}
```

| 配置项 | 说明 |
|--------|------|
| `url` | 请求 URL，支持 `{args.xxx}` 插值 |
| `method` | HTTP 方法，默认 `GET` |
| `headers` | 请求头 |
| `body` | 请求体，支持 `{args.xxx}` 插值 |
| `timeout` | 请求超时时间 |

#### script 模板

在浏览器环境中执行 JavaScript：

```json
{
  "executorType": "script",
  "executorConfig": {
    "script": "const result = args.numbers.reduce((a, b) => a + b, 0); return { sum: result };",
    "language": "javascript"
  }
}
```

| 配置项 | 说明 |
|--------|------|
| `script` | JavaScript 脚本内容，可通过 `args` 访问工具参数 |
| `language` | 脚本语言（当前仅支持 `javascript`） |

#### command 模板

在 Electron 桌面环境中执行系统命令：

```json
{
  "executorType": "command",
  "executorConfig": {
    "command": "echo",
    "args": ["{args.message}"]
  }
}
```

| 配置项 | 说明 |
|--------|------|
| `command` | 系统命令，支持 `{args.xxx}` 插值 |
| `args` | 命令参数列表，支持 `{args.xxx}` 插值 |

> **注意：** command 模板仅在 Electron 桌面环境中可用，浏览器环境会返回错误。

### 2.5 执行流程

```
1. LLM 决定调用工具
       ↓
2. 服务端生成 callId，通过 SSE 下发 DYNAMIC_TOOL_CALL 事件
       ↓
3. 客户端 ClientToolRouter 裁决权限（auto/confirm/deny）
       ↓
4. DynamicClientToolExecutor 查找插件定义
       ↓
5. 根据执行模板类型选择对应 ExecutorTemplate 执行
       ↓
6. 执行结果回传服务端
       ↓
7. LLM 继续推理
```

### 2.6 权限策略

权限策略分为三级，优先级从高到低：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | 用户本地覆盖 | 用户在客户端手动设置的策略 |
| 2 | 服务端策略 | 管理后台配置的策略 |
| 3 | 默认策略 | 工具定义中的默认值 |

**确认模式说明：**

| 模式 | 行为 |
|------|------|
| `auto` | 自动执行，无需用户确认 |
| `confirm` | 执行前弹出确认提示，用户确认后执行 |
| `deny` | 禁止执行 |

### 2.7 应用级隔离

动态客户端工具通过 `appCode` + `uid` 实现隔离：

| 工具配置 | 可见范围 |
|---------|---------|
| `appCode=null, uid=null` | 全局工具，所有人可见 |
| `appCode="app1", uid=null` | 应用级工具，该应用所有用户可见 |
| `appCode="app1", uid="user1"` | 用户级工具，仅该应用的该用户可见 |

**可见性规则：** 客户端同步时，会获取匹配当前 `appCode` + `uid` 的工具，以及全局工具。

### 2.8 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/dynamic-client-tools` | 创建动态客户端工具 |
| PUT | `/admin/dynamic-client-tools/:id` | 更新动态客户端工具 |
| DELETE | `/admin/dynamic-client-tools/:id` | 删除动态客户端工具 |
| GET | `/admin/dynamic-client-tools` | 获取工具列表（支持 appCode/uid 过滤） |
| GET | `/admin/dynamic-client-tools/:id` | 获取单个工具详情 |
| GET | `/agents/dynamic-client-tools/client/sync` | 客户端同步工具定义 |

---

## 三、硬编码客户端工具扩展（开发者模式）

如果需要添加内置的客户端工具模块（如 workspace），需要同时修改服务端和客户端代码。

### 3.1 服务端：创建 Handler

1. 创建 Handler 类，使用 `@ClientToolProvider` 装饰器：

```typescript
import { ClientToolProvider, IClientToolProvider } from '../client-tool-provider.decorator';
import { ClientToolEntry } from '../client-tool-entry';
import { IClientToolHandler, ClientToolCallResult } from '../client-tool-handler.interface';
import { Injectable } from '@nestjs/common';
import { StreamEmitter } from '../../stream';
import * as crypto from 'crypto';

@ClientToolProvider({ name: 'my-module' })
@Injectable()
export class MyToolHandler implements IClientToolProvider, IClientToolHandler {
  private pendingCalls = new Map<string, {
    resolve: (result: ClientToolCallResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  getClientToolEntry(): ClientToolEntry {
    return {
      name: 'my-module',
      toolNames: new Set(['my_tool_1', 'my_tool_2']),
      toolDefinitions: [
        {
          name: 'my_tool_1',
          description: '工具1描述',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'my_tool_2',
          description: '工具2描述',
          parameters: { type: 'object', properties: {} },
        },
      ],
      isEnabled: (agent) => true,
      eventPrefix: 'MY_MODULE_TOOL',
      handler: this,
      defaultPolicy: {
        moduleName: 'my-module',
        defaultConfirmMode: 'confirm',
        defaultTimeout: 30000,
        tools: [],
      },
    };
  }

  async dispatchToClient(
    emitter: StreamEmitter,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ClientToolCallResult> {
    const callId = crypto.randomUUID();
    emitter.emit('MY_MODULE_TOOL_CALL', { callId, toolName, args });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`工具调用超时: ${toolName}`));
      }, 30000);
      this.pendingCalls.set(callId, { resolve, reject, timer });
    });
  }

  resolveCall(callId: string, result: ClientToolCallResult): void {
    const pending = this.pendingCalls.get(callId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingCalls.delete(callId);
    pending.resolve(result);
  }

  cancelPendingCalls(): void {
    for (const [, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error('流已结束'));
    }
    this.pendingCalls.clear();
  }
}
```

2. 在模块的 `providers` 中添加 Handler 类，`ClientToolDiscoveryService` 会自动发现并注册到 `ClientToolRegistry`

### 3.2 客户端：创建 Executor

1. 实现 `IClientToolExecutor` 接口：

```typescript
import type { ClientToolCallPayload } from '../api/stream';
import type { IClientToolExecutor } from './types';

export class MyModuleExecutor implements IClientToolExecutor {
  moduleName = 'my-module' as const;

  async execute(call: ClientToolCallPayload): Promise<{
    callId: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }> {
    const { callId, toolName, args } = call;

    try {
      let result: unknown;
      switch (toolName) {
        case 'my_tool_1':
          result = await this.handleTool1(args);
          break;
        case 'my_tool_2':
          result = await this.handleTool2(args);
          break;
        default:
          return { callId, success: false, error: `未知工具: ${toolName}` };
      }
      return { callId, success: true, result };
    } catch (e: any) {
      return { callId, success: false, error: e.message };
    }
  }

  private async handleTool1(args: Record<string, unknown>): Promise<unknown> {
    // 实现工具1的逻辑
  }

  private async handleTool2(args: Record<string, unknown>): Promise<unknown> {
    // 实现工具2的逻辑
  }
}

export const myModuleExecutor = new MyModuleExecutor();
```

2. 注册到 `ClientToolRouter`：

```typescript
import { clientToolRouter } from './executor/client-tool-router';
import { myModuleExecutor } from './executor/my-module.executor';

clientToolRouter.registerExecutor(myModuleExecutor);
```

---

## 四、最佳实践

### 4.1 选择合适的子系统

| 需求 | 推荐方案 |
|------|---------|
| 扩展 Agent 的指令能力 | Agent Skills（标准技能） |
| 调用外部 HTTP API | Dynamic Client Tools（http_request 模板） |
| 在客户端执行简单计算 | Dynamic Client Tools（script 模板） |
| 在桌面端执行系统命令 | Dynamic Client Tools（command 模板） |
| 声明 MCP Server 依赖 | Agent Skills（requires.mcp-servers） |
| 声明技能间依赖 | Agent Skills（requires.skills） |
| 需要复杂客户端交互 | 硬编码客户端工具扩展 |

### 4.2 SKILL.md 编写建议

- **description 要精确**：包含触发条件，帮助 LLM 判断何时使用该技能
- **正文控制在 5000 tokens 内**：详细内容放到 `references/` 目录
- **善用 requires 声明依赖**：让系统自动解析和检查依赖
- **目录名与 name 保持一致**：避免校验错误

### 4.3 动态客户端工具安全建议

- **优先使用 `confirm` 模式**：涉及数据修改的操作应要求用户确认
- **设置合理的超时时间**：避免长时间挂起
- **使用 appCode 隔离**：避免工具跨应用泄露
- **executorConfig 中不要硬编码密钥**：使用 `{args.xxx}` 从参数传入
