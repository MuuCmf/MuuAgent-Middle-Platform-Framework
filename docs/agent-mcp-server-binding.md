# 智能体绑定 MCP Server 功能开发文档

## 0. 命名约定

### 0.1 重要说明

系统中存在两个 **MCP** 缩写，需要明确区分：

| 缩写 | 全称 | 说明 | 目录 | API路径 |
|------|------|------|------|---------|
| **MCP** | Model Control Plane | 模型控制平面（已存在） | `service/src/mcp/` | `/api/admin/mcp/*` |
| **MCPServer** | Model Context Protocol Server | 模型上下文协议服务（新增） | `service/src/mcp-server/` | `/api/admin/mcp-server/*` |

### 0.2 命名规范

为避免混淆，本文档使用以下命名：

- **MCP（模型控制平面）**：指现有的模型路由、限流、熔断功能
- **MCPServer（模型上下文协议）**：指新增的第三方 MCP Server 连接功能
- **MCP工具**：指通过 MCPServer 提供的工具

---

## 1. 功能概述

### 1.1 背景

MCPServer (Model Context Protocol) 是 Anthropic 推出的开放协议，用于让 AI 模型与外部工具和数据源交互。当前系统已支持 MCP 类型的技能，但每个 MCP 工具需要单独创建技能，配置繁琐。

### 1.2 目标

实现智能体直接绑定 MCPServer，自动发现并调用其提供的所有工具，提升配置效率和用户体验。

### 1.3 功能特性

| 特性 | 说明 |
|------|------|
| 多 MCPServer 绑定 | 一个智能体可绑定多个 MCPServer |
| 自动工具发现 | 自动获取 MCPServer 提供的工具列表 |
| 统一工具调用 | 与现有技能调用流程统一 |
| 工具命名冲突处理 | 支持前缀区分同名工具 |
| 连接池管理 | 管理 MCPServer 连接生命周期 |

---

## 2. 需求分析

### 2.1 用户场景

```
场景1：企业知识库助手
├── 文件系统 MCP Server（读取文档）
├── 数据库 MCP Server（查询业务数据）
└── Web搜索 MCP Server（搜索互联网）

场景2：代码开发助手
├── Git MCP Server（代码版本管理）
├── 文件系统 MCP Server（读写代码文件）
└── 终端 MCP Server（执行命令）
```

### 2.2 功能需求

| 需求ID | 需求描述 | 优先级 |
|--------|----------|--------|
| REQ-001 | 智能体支持绑定多个 MCP Server | P0 |
| REQ-002 | 自动发现 MCP Server 提供的工具列表 | P0 |
| REQ-003 | 智能体对话时自动调用 MCP 工具 | P0 |
| REQ-004 | 前端支持配置 MCP Server 绑定 | P0 |
| REQ-005 | 支持工具命名冲突处理 | P1 |
| REQ-006 | MCP 连接池管理 | P1 |
| REQ-007 | MCP Server 健康检查 | P2 |

### 2.3 非功能需求

| 需求ID | 需求描述 |
|--------|----------|
| NFR-001 | MCP 连接超时时间可配置 |
| NFR-002 | 支持 MCP Server 认证 |
| NFR-003 | 工具调用日志记录 |
| NFR-004 | 错误处理和重试机制 |

---

## 3. 技术方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        智能体 (Agent)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 技能列表    │  │ MCP Server  │  │ MCP Server  │  ...    │
│  │ (Skills)    │  │ #1          │  │ #2          │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         ↓                ↓                ↓                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              工具发现与调用服务                       │   │
│  │  • 合并所有工具列表                                   │   │
│  │  • 构建系统提示词                                     │   │
│  │  • 路由工具调用                                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │   LLM 调用      │
                    └─────────────────┘
```

### 3.2 工具调用流程

```
用户提问
    │
    ▼
┌─────────────────────┐
│ 获取智能体配置       │
│ • 绑定的技能列表     │
│ • 绑定的 MCP Server │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 发现所有可用工具     │
│ • 技能工具           │
│ • MCP 工具（动态）   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 构建系统提示词       │
│ • 包含所有工具描述   │
│ • 工具调用格式说明   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ LLM 分析并返回      │
│ 工具调用指令         │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 执行工具调用         │
│ • 技能执行           │
│ • MCP 工具调用       │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 返回结果给 LLM      │
│ 生成最终回答         │
└─────────────────────┘
```

### 3.3 工具命名规范

```
技能工具：
  {skillCode}
  示例：get_weather, get_time

MCP 工具：
  mcp:{serverName}:{toolName}
  示例：mcp:filesystem:read_file, mcp:database:query

简化格式（无冲突时）：
  {toolName}
  示例：read_file, query
```

---

## 4. 数据模型设计

### 4.1 Agent 模型扩展

```prisma
model Agent {
  id           String   @id @default(uuid())
  name         String
  code         String   @unique
  description  String?
  systemPrompt String
  modelId      String?
  skills       String   @default("[]")    // 绑定的技能code列表(JSON数组)
  mcpServers   String?  @default("[]")    // 绑定的MCP Server配置(JSON数组) - 新增
  maxSteps     Int      @default(5)
  temperature  Float    @default(0.7)
  status       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  model Model? @relation(fields: [modelId], references: [id])

  @@index([code])
  @@index([status])
}
```

### 4.2 MCPServer 配置结构

```typescript
interface McpServerConfig {
  /** MCPServer 名称（用于标识和工具命名前缀） */
  name: string;
  
  /** MCPServer HTTP 端点地址 */
  url: string;
  
  /** API 密钥（可选） */
  apiKey?: string;
  
  /** 允许使用的工具列表（空数组表示允许所有） */
  tools?: string[];
  
  /** 超时时间（毫秒） */
  timeout?: number;
  
  /** 是否启用 */
  enabled?: boolean;
}

// 示例
const mcpServersConfig: McpServerConfig[] = [
  {
    name: "filesystem",
    url: "http://localhost:8081/mcp",
    apiKey: "fs-api-key",
    tools: ["read_file", "write_file", "list_directory"],
    timeout: 30000,
    enabled: true
  },
  {
    name: "database",
    url: "http://localhost:8082/mcp",
    tools: [],  // 允许所有工具
    enabled: true
  }
];
```

### 4.3 工具描述结构

```typescript
interface ToolDescription {
  /** 工具标识 */
  name: string;
  
  /** 工具来源：skill | mcp */
  source: 'skill' | 'mcp';
  
  /** MCP Server 名称（仅 MCP 工具） */
  serverName?: string;
  
  /** 工具描述 */
  description: string;
  
  /** 参数 Schema */
  inputSchema?: Record<string, unknown>;
}
```

---

## 5. API 设计

### 5.1 获取 MCPServer 工具列表

```
POST /api/admin/mcp-server/discover
```

**请求体：**
```json
{
  "url": "http://localhost:8081/mcp",
  "apiKey": "xxx"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "tools": [
      {
        "name": "read_file",
        "description": "读取文件内容",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "文件路径" }
          },
          "required": ["path"]
        }
      }
    ]
  }
}
```

### 5.2 更新智能体 MCPServer 配置

```
PUT /api/admin/agent/:id/mcp-servers
```

**请求体：**
```json
{
  "mcpServers": [
    {
      "name": "filesystem",
      "url": "http://localhost:8081/mcp",
      "apiKey": "xxx",
      "tools": ["read_file", "write_file"],
      "enabled": true
    }
  ]
}
```

### 5.3 测试 MCPServer 连接

```
POST /api/admin/mcp-server/test
```

**请求体：**
```json
{
  "url": "http://localhost:8081/mcp",
  "apiKey": "xxx",
  "toolName": "read_file",
  "params": { "path": "/test.txt" }
}
```

---

## 6. 前端设计

### 6.1 智能体编辑页面

```
┌─────────────────────────────────────────────────────────────┐
│ 编辑智能体                                                   │
├─────────────────────────────────────────────────────────────┤
│ 基本信息                                                     │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 名称：[____________]  标识：[____________]            │   │
│ │ 描述：[________________________________]              │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ 模型配置                                                     │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 绑定模型：[下拉选择]                                   │   │
│ │ 温度参数：[滑块]                                       │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ 技能绑定                                                     │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ [✓] get_weather - 获取天气                            │   │
│ │ [✓] get_time - 获取时间                               │   │
│ │ [ ] send_email - 发送邮件                             │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ MCPServer 绑定                           [+ 添加]          │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ ┌─────────────────────────────────────────────────┐   │   │
│ │ │ 📁 文件系统                    [测试] [删除]     │   │   │
│ │ │ URL: http://localhost:8081/mcp                   │   │   │
│ │ │ 工具: read_file, write_file, list_directory      │   │   │
│ │ │ 状态: ✅ 已连接                                   │   │   │
│ │ └─────────────────────────────────────────────────┘   │   │
│ │ ┌─────────────────────────────────────────────────┐   │   │
│ │ │ 🗄️ 数据库查询                  [测试] [删除]     │   │   │
│ │ │ URL: http://localhost:8082/mcp                   │   │   │
│ │ │ 工具: query, insert, update                      │   │   │
│ │ │ 状态: ✅ 已连接                                   │   │   │
│ │ └─────────────────────────────────────────────────┘   │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│                                    [取消] [保存]            │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 MCPServer 配置弹窗

```
┌─────────────────────────────────────────────────────────────┐
│ 添加 MCPServer                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 名称：[____________]  （用于工具命名前缀）                    │
│                                                             │
│ URL：[________________________________]                      │
│                                                             │
│ API Key：[________________________________]（可选）          │
│                                                             │
│ 超时时间：[30000] 毫秒                                       │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 工具筛选                                                     │
│ ○ 允许所有工具                                               │
│ ○ 仅允许指定工具：                                           │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ [✓] read_file      [✓] write_file                  │   │
│   │ [✓] list_directory [ ] delete_file                  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ [发现工具]  [测试连接]                                        │
│                                                             │
│                              [取消] [确定]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 实现计划

### 7.1 开发任务分解

| 阶段 | 任务 | 预估工时 | 依赖 |
|------|------|----------|------|
| **Phase 1: 数据模型** | | 2h | |
| | 更新 Agent 模型添加 mcpServers 字段 | 0.5h | |
| | 创建数据库迁移 | 0.5h | |
| | 更新 DTO 定义 | 1h | |
| **Phase 2: 后端服务** | | 6h | Phase 1 |
| | 创建 `service/src/mcp-server/` 目录 | 0.5h | |
| | 创建 McpServerService 服务 | 2h | |
| | 实现工具发现服务 | 1.5h | |
| | 更新 AgentService 集成 MCPServer | 2h | |
| **Phase 3: API 接口** | | 3h | Phase 2 |
| | 创建 McpServerController | 1h | |
| | MCPServer 工具发现接口 | 1h | |
| | Agent MCPServer 配置接口 | 1h | |
| **Phase 4: 前端实现** | | 5h | Phase 3 |
| | MCPServer 配置组件 | 2h | |
| | Agent 编辑页面集成 | 2h | |
| | 工具发现和测试功能 | 1h | |
| **Phase 5: 测试与文档** | | 2h | Phase 4 |
| | 单元测试 | 1h | |
| | 集成测试 | 0.5h | |
| | 用户文档更新 | 0.5h | |

**总计：18 小时**

### 7.2 目录结构

```
service/src/
├── mcp/                    # 现有：模型控制平面（Model Control Plane）
│   ├── mcp.controller.ts
│   ├── mcp.service.ts
│   ├── mcp.module.ts
│   └── dto/
│       └── mcp.dto.ts
│
├── mcp-server/             # 新增：模型上下文协议（Model Context Protocol）
│   ├── mcp-server.controller.ts
│   ├── mcp-server.service.ts
│   ├── mcp-server.module.ts
│   └── dto/
│       └── mcp-server.dto.ts
│
└── skill/
    └── mcp-client.service.ts  # 已存在：MCP客户端服务
```

### 7.3 里程碑

| 里程碑 | 完成标准 | 预计日期 |
|--------|----------|----------|
| M1 | 数据模型更新完成 | Day 1 |
| M2 | 后端服务开发完成 | Day 2 |
| M3 | API 接口开发完成 | Day 3 |
| M4 | 前端功能开发完成 | Day 4 |
| M5 | 测试通过，文档完成 | Day 5 |

---

## 8. 风险与对策

### 8.1 技术风险

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| MCPServer 不稳定 | 工具调用失败 | 中 | 实现重试机制和熔断保护 |
| 工具命名冲突 | 调用错误工具 | 低 | 使用前缀区分，提供配置选项 |
| 连接超时 | 用户体验差 | 中 | 可配置超时时间，异步加载工具 |
| 大量工具导致提示词过长 | Token 消耗大 | 中 | 支持工具筛选，按需加载 |
| 与现有 MCP（模型控制平面）混淆 | 开发/维护困难 | 中 | 使用明确命名区分，文档说明 |

### 8.2 兼容性风险

| 风险 | 影响 | 对策 |
|------|------|------|
| 现有技能功能受影响 | 功能回退 | 保持现有技能调用逻辑不变 |
| 数据库迁移失败 | 服务不可用 | 提供回滚脚本 |
| API 路径冲突 | 接口调用失败 | 使用 `/api/admin/mcp-server/*` 路径 |

---

## 9. 测试计划

### 9.1 单元测试

- [ ] McpServerService.connect()
- [ ] McpServerService.listTools()
- [ ] McpServerService.callTool()
- [ ] AgentService.discoverTools()
- [ ] 工具命名冲突处理

### 9.2 集成测试

- [ ] 智能体绑定单个 MCPServer
- [ ] 智能体绑定多个 MCPServer
- [ ] 工具发现和调用流程
- [ ] 错误处理和重试

### 9.3 端到端测试

- [ ] 用户配置 MCPServer
- [ ] 智能体对话调用 MCP 工具
- [ ] 多 MCPServer 工具调用

---

## 10. 附录

### 10.1 MCP 协议参考

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [MCP 规范](https://spec.modelcontextprotocol.io/)
- [MCP SDK](https://github.com/modelcontextprotocol)

### 10.2 相关代码文件

| 文件 | 说明 |
|------|------|
| `service/src/mcp/` | 现有：模型控制平面（Model Control Plane） |
| `service/src/mcp-server/` | 新增：模型上下文协议（Model Context Protocol） |
| `service/src/skill/mcp-client.service.ts` | MCP 客户端服务 |
| `service/src/skill/skill.service.ts` | 技能服务 |
| `service/src/agent/agent.service.ts` | 智能体服务 |
| `admin/src/views/agents/index.vue` | 智能体管理页面 |
| `admin/src/views/skills/index.vue` | 技能管理页面 |

### 10.3 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2026-05-07 | AI | 初始版本 |
| 1.1 | 2026-05-07 | AI | 添加命名约定，区分 MCP（模型控制平面）和 MCPServer（模型上下文协议） |
