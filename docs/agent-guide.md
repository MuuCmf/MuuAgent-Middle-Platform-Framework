# 智能体 (Agent) 使用文档

## 概述

智能体模块是 MuuAgent 的核心功能之一，提供了基于大语言模型的智能对话能力，支持多种推理模式、知识库检索、技能调用等高级功能。

## 核心功能

| 功能 | 说明 |
|------|------|
| 多推理模式 | 支持 NONE/REACT/PLAN/REFLECT 四种推理模式 |
| 知识库检索 | 支持向量检索和 BM25 文本检索 |
| 技能调用 | 支持自定义技能和 MCP Server 工具调用 |
| 流式输出 | 支持 Server-Sent Events (SSE) 流式响应 |
| 对话管理 | 支持多轮对话会话管理 |

---

## API 接口

### 1. 智能体管理接口（管理端）

#### 1.1 创建智能体

**POST** `/admin/agent`

请求体：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 智能体名称 |
| code | string | 是 | 智能体唯一标识 |
| description | string | 否 | 智能体描述 |
| systemPrompt | string | 是 | 系统提示词 |
| modelId | string | 否 | 绑定模型ID |
| skills | string | 否 | 绑定技能列表（JSON数组） |
| mcpServers | string | 否 | MCP Server配置（JSON数组） |
| knowledgeBases | string | 否 | 绑定知识库列表（JSON数组） |
| maxSteps | number | 否 | 最大执行步数（1-20），默认5 |
| temperature | number | 否 | 温度参数（0-2），默认0.7 |
| status | boolean | 否 | 是否启用，默认true |
| reasoningMode | string | 否 | 推理模式：NONE/REACT/PLAN/REFLECT |
| reasoningPrompt | string | 否 | 自定义推理提示词 |
| kbRetrievalMode | string | 否 | 知识库检索模式：auto/tool/disabled |
| kbRetrievalMethod | string | 否 | 知识库检索方式：auto/vector/bm25 |

**示例请求**：

```json
{
  "name": "产品助手",
  "code": "product_assistant",
  "description": "帮助用户查询产品信息",
  "systemPrompt": "你是一个专业的产品助手，负责解答用户关于产品的问题。",
  "knowledgeBases": "[\"kb_product\", \"kb_faq\"]",
  "maxSteps": 5,
  "temperature": 0.7,
  "reasoningMode": "REACT",
  "kbRetrievalMode": "auto",
  "kbRetrievalMethod": "auto"
}
```

#### 1.2 更新智能体

**PUT** `/admin/agent/:id`

请求体字段同创建接口（均为可选）。

#### 1.3 删除智能体

**DELETE** `/admin/agent/:id`

#### 1.4 查询智能体详情

**GET** `/admin/agent/:id`

#### 1.5 查询智能体列表

**GET** `/admin/agent?status=true&page=1&pageSize=10`

### 2. 智能体对话接口（业务端）

#### 2.1 同步对话

**POST** `/agent/chat`

请求体：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agentId | string | 是 | 智能体ID或标识 |
| message | string | 是 | 用户消息 |
| conversationId | string | 否 | 会话ID（用于多轮对话） |
| uid | string | 否 | 用户唯一标识 |

**示例请求**：

```json
{
  "agentId": "product_assistant",
  "message": "产品的主要功能是什么？",
  "uid": "user123"
}
```

**响应示例**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "response": "我们的产品主要包含以下功能：...",
    "steps": [],
    "sources": []
  }
}
```

#### 2.2 流式对话（推荐）

**POST** `/agent/chat/stream`

请求体同同步对话接口。

响应格式（Server-Sent Events）：

| 类型 | 说明 |
|------|------|
| `chunk` | 内容片段，流式返回 |
| `reasoning_step` | 推理步骤（小字显示） |
| `tool` | 工具调用结果 |
| `done` | 完成标志 |
| `error` | 错误信息 |

**响应示例**：

```
data: {"type":"reasoning_step","step":{"stepNumber":1,"stepType":"thought","thought":"用户想了解产品功能，我需要从知识库中检索相关信息"}}
data: {"type":"reasoning_step","step":{"stepNumber":2,"stepType":"action","action":"kb_search","actionInput":{"query":"产品功能"}}}
data: {"type":"chunk","content":"我们"}
data: {"type":"chunk","content":"的产品"}
data: {"type":"chunk","content":"主要包含"}
data: {"type":"done","content":"我们的产品主要包含以下功能：...","steps":[...],"reasoningMode":"REACT"}
```

---

## 推理模式

### NONE（默认）

直接调用大语言模型生成响应，不进行推理思考。适用于简单问答场景。

### REACT

基于 ReAct 框架的推理模式，智能体会：
1. 分析问题
2. 决定是否需要调用工具
3. 执行工具调用
4. 基于工具返回结果生成最终回答

### PLAN

规划模式，智能体会先制定解决问题的步骤计划，然后逐步执行。

### REFLECT

反思模式，在执行过程中会不断反思和评估执行结果，必要时调整策略。

---

## 知识库集成

### 检索模式

| 模式 | 说明 |
|------|------|
| auto | 自动模式，智能体根据问题自动决定是否检索 |
| tool | 工具模式，将知识库检索作为工具供智能体调用 |
| disabled | 禁用知识库检索 |

### 检索方式

| 方式 | 说明 |
|------|------|
| auto | 自动选择，根据数据情况自动选择最优方式 |
| vector | 向量检索，基于语义相似度 |
| bm25 | 文本检索，基于词频统计 |

### 知识库检索工具

智能体绑定知识库后，会自动获得 `kb_search` 工具：

```typescript
{
  name: 'kb_search',
  description: '从知识库中检索相关信息',
  parameters: {
    query: '检索查询语句',
    kb_codes: ['知识库代码列表'],
    top_k: 5,
    similarity_threshold: 0.7,
    retrieval_method: 'auto'
  }
}
```

---

## 技能集成

### 技能配置

技能通过 `skills` 字段配置，格式为 JSON 数组：

```json
["get_weather", "get_time", "send_email"]
```

### 技能调用流程

1. 智能体解析用户问题
2. 判断是否需要调用技能
3. 调用相应技能获取结果
4. 基于技能结果生成回答

---

## MCP Server 集成

MCP（Model Context Protocol）允许智能体调用外部工具和服务。

### 配置格式

```json
[
  {
    "name": "filesystem",
    "url": "http://localhost:8081/mcp",
    "enabled": true
  }
]
```

---

## 前端集成示例

### 同步对话

```typescript
async function sendMessage(agentId: string, message: string) {
  const response = await fetch('/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key'
    },
    body: JSON.stringify({ agentId, message })
  });
  const result = await response.json();
  return result.data.response;
}
```

### 流式对话

```typescript
async function streamChat(agentId: string, message: string, onChunk: (chunk: string) => void) {
  const response = await fetch('/agent/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key'
    },
    body: JSON.stringify({ agentId, message })
  });

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value);
    const lines = buffer.split('\n');
    
    for (const line of lines.slice(0, -1)) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        if (data.type === 'chunk') {
          onChunk(data.content);
        }
      }
    }
    
    buffer = lines[lines.length - 1] || '';
  }
}
```

---

## 最佳实践

### 1. 系统提示词编写建议

- 明确智能体的角色和职责
- 定义回答风格（正式/友好/专业）
- 指定输出格式要求
- 包含安全和合规约束

### 2. 推理模式选择

| 场景 | 推荐模式 |
|------|----------|
| 简单问答 | NONE |
| 需要知识库 | REACT |
| 复杂任务规划 | PLAN |
| 需要自我修正 | REFLECT |

### 3. 性能优化

- 使用流式输出提升用户体验
- 合理设置 `maxSteps` 避免无限循环
- 根据知识库大小调整检索阈值
- 启用缓存机制减少重复检索

### 4. 安全考虑

- 限制工具调用权限
- 对用户输入进行过滤
- 记录所有工具调用日志
- 设置合理的调用频率限制

---

## 故障排除

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 智能体无响应 | 模型服务未启动 | 检查模型服务状态 |
| 知识库检索无结果 | BM25分数计算错误 | 检查 BM25Service 配置 |
| 流式输出不实时 | 响应头未禁用压缩 | 确保设置 `X-Accel-Buffering: no` |
| 工具调用失败 | 技能未正确注册 | 检查技能配置和服务状态 |

### 日志排查

```bash
# 查看智能体服务日志
tail -f logs/agent.log

# 查看检索服务日志
tail -f logs/retrieval.log
```

---

## 版本历史

| 版本 | 更新内容 |
|------|----------|
| 1.0 | 基础智能体功能 |
| 1.1 | 添加 ReAct 推理模式 |
| 1.2 | 添加流式输出支持 |
| 1.3 | 添加知识库检索增强 |
| 1.4 | 添加 MCP Server 集成 |