# 用户透传功能使用文档

## 概述

用户透传功能允许第三方系统在调用 AI 中台接口时，传递用户唯一标识（uid），实现用户级别的调用隔离和日志追踪。该功能支持多租户场景，便于不同系统整合使用同一套 AI 中台服务。

## 功能特性

- **用户标识透传**：支持通过请求头或请求体传递用户唯一标识
- **日志关联**：所有调用日志自动关联用户标识，便于追踪和审计
- **日志筛选**：支持按用户标识筛选查询日志
- **多租户支持**：不同系统的用户调用相互隔离

## 使用方式

### 方式一：请求头传递（推荐）

在 HTTP 请求头中添加 `x-uid` 字段传递用户标识：

```http
POST /api/ai/invoke HTTP/1.1
Host: your-api-host
Content-Type: application/json
Authorization: Bearer your-api-key
x-uid: user-12345

{
  "messages": [
    {"role": "user", "content": "你好"}
  ]
}
```

### 方式二：请求体传递

在请求体 JSON 中添加 `uid` 字段：

```http
POST /api/ai/invoke HTTP/1.1
Host: your-api-host
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "uid": "user-12345",
  "messages": [
    {"role": "user", "content": "你好"}
  ]
}
```

### 优先级说明

当请求头和请求体同时包含 `uid` 时，优先使用请求体中的 `uid` 值。

## 支持的接口

### AI 调用接口

| 接口路径 | 方法 | 说明 |
|---------|------|------|
| `/api/ai/invoke` | POST | 普通 AI 调用 |
| `/api/ai/stream` | POST | SSE 流式调用 |
| `/api/ai/embedding` | POST | Embedding 向量生成 |
| `/api/ai/image` | POST | 文生图 |

### Agent 对话接口

| 接口路径 | 方法 | 说明 |
|---------|------|------|
| `/api/agent/chat` | POST | Agent 对话 |

## 请求示例

### cURL 示例

```bash
# 使用请求头传递 uid
curl -X POST "https://your-api-host/api/ai/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "x-uid: user-12345" \
  -d '{
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'

# 使用请求体传递 uid
curl -X POST "https://your-api-host/api/ai/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "uid": "user-12345",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

### JavaScript 示例

```javascript
// 使用 fetch API
async function callAI(uid, message) {
  const response = await fetch('https://your-api-host/api/ai/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key',
      'x-uid': uid,
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: message }
      ]
    }),
  });
  
  return response.json();
}

// 使用请求体传递 uid
async function callAIWithBodyUid(uid, message) {
  const response = await fetch('https://your-api-host/api/ai/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key',
    },
    body: JSON.stringify({
      uid: uid,
      messages: [
        { role: 'user', content: message }
      ]
    }),
  });
  
  return response.json();
}
```

### Python 示例

```python
import requests

# 使用请求头传递 uid
def call_ai(uid, message):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key',
        'x-uid': uid,
    }
    data = {
        'messages': [
            {'role': 'user', 'content': message}
        ]
    }
    response = requests.post(
        'https://your-api-host/api/ai/invoke',
        headers=headers,
        json=data
    )
    return response.json()

# 使用请求体传递 uid
def call_ai_with_body_uid(uid, message):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key',
    }
    data = {
        'uid': uid,
        'messages': [
            {'role': 'user', 'content': message}
        ]
    }
    response = requests.post(
        'https://your-api-host/api/ai/invoke',
        headers=headers,
        json=data
    )
    return response.json()
```

## 日志查询

### 按用户标识筛选日志

在日志查询接口中添加 `uid` 参数即可筛选特定用户的调用日志：

```http
GET /api/log/ai?uid=user-12345&page=1&pageSize=20 HTTP/1.1
Host: your-api-host
Authorization: Bearer your-api-key
```

### 支持的日志查询接口

| 接口路径 | 方法 | 说明 |
|---------|------|------|
| `/api/log/ai` | GET | AI 调用日志查询 |
| `/api/log/skill` | GET | 技能调用日志查询 |
| `/api/log/agent` | GET | Agent 调用日志查询 |

## 数据库设计

### 日志表字段

所有日志表均新增 `uid` 字段用于存储用户标识：

```sql
-- AiInvokeLog 表
ALTER TABLE AiInvokeLog ADD COLUMN uid TEXT;
CREATE INDEX idx_ai_log_uid ON AiInvokeLog(uid, createdAt);

-- SkillInvokeLog 表
ALTER TABLE SkillInvokeLog ADD COLUMN uid TEXT;
CREATE INDEX idx_skill_log_uid ON SkillInvokeLog(uid, createdAt);

-- AgentInvokeLog 表
ALTER TABLE AgentInvokeLog ADD COLUMN uid TEXT;
CREATE INDEX idx_agent_log_uid ON AgentInvokeLog(uid, createdAt);
```

## 最佳实践

### 1. 用户标识规范

- 建议使用有意义的用户标识，如：`system-userId` 格式
- 示例：`crm-user001`、`shop-user123`
- 避免使用特殊字符和空格

### 2. 安全建议

- 用户标识仅用于日志追踪，不作为权限控制依据
- 敏感操作仍需通过 API Key 和其他认证机制验证
- 建议在网关层对用户标识进行校验

### 3. 性能优化

- 用户标识字段已建立索引，查询性能良好
- 建议结合时间范围查询，避免全表扫描

## 常见问题

### Q: uid 是否必填？

A: uid 为可选参数，不传递时日志中该字段为空。

### Q: uid 的最大长度是多少？

A: uid 字段类型为 TEXT，无固定长度限制，建议不超过 128 字符。

### Q: 如何区分不同系统的用户？

A: 建议使用 `系统标识-用户ID` 的格式，如 `crm-user001`、`shop-user123`。

### Q: 日志中 uid 为空是什么原因？

A: 可能是调用时未传递 uid 参数，或传递的值为空字符串。

## 更新日志

### v1.0.0 (2026-05-05)

- 新增用户透传功能
- 支持请求头和请求体两种传递方式
- 日志表新增 uid 字段
- 日志查询支持按 uid 筛选
