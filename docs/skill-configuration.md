# 技能管理配置文档

## 概述

技能是智能体可以调用的工具，用于执行特定任务。本文档详细说明技能管理中各字段的填写规范。

---

## 字段说明

### 基本信息

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 名称 | string | ✅ | 技能的显示名称，如"查询天气" |
| 标识 | string | ✅ | 技能的唯一标识符，如"get_weather"，用于代码中引用 |
| 描述 | string | ✅ | 功能描述，**供LLM理解技能用途**，用于智能体自动判断是否调用 |
| 类型 | enum | ✅ | 技能类型：`http`、`function`、`database`、`rpc` |
| 参数描述 | JSON | ✅ | 定义技能需要的参数，**供LLM生成正确的调用参数** |
| 执行配置 | JSON | ✅ | 定义技能的具体执行方式 |
| 状态 | boolean | ❌ | 是否启用，默认true |
| 超时时间 | number | ❌ | 执行超时时间（毫秒），默认30000 |

---

## 参数描述 (`params`)

### 用途

告诉LLM这个技能需要什么参数，用于智能体自动调用时生成正确的参数。

### 格式

```json
{
  "参数名": {
    "type": "参数类型",
    "description": "参数说明",
    "required": true
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | ✅ | 参数类型：`string`、`number`、`boolean`、`object`、`array` |
| description | string | ✅ | 参数说明，帮助LLM理解参数含义 |
| required | boolean | ❌ | 是否必填，默认false |

### 示例

#### 无参数技能

```json
{}
```

#### 单参数技能

```json
{
  "city": {
    "type": "string",
    "description": "城市名称，如：北京、上海、广州"
  }
}
```

#### 多参数技能

```json
{
  "to": {
    "type": "string",
    "description": "收件人邮箱地址"
  },
  "subject": {
    "type": "string",
    "description": "邮件主题"
  },
  "body": {
    "type": "string",
    "description": "邮件正文内容"
  }
}
```

#### 复杂参数技能

```json
{
  "table": {
    "type": "string",
    "description": "数据库表名"
  },
  "conditions": {
    "type": "object",
    "description": "查询条件，如：{\"status\": \"active\", \"age\": {\"$gt\": 18}}"
  },
  "fields": {
    "type": "array",
    "description": "返回字段列表，如：[\"name\", \"email\", \"phone\"]"
  }
}
```

---

## 执行配置 (`config`)

执行配置根据技能类型不同有不同的配置项。

### HTTP类型

用于调用外部HTTP API。

#### 配置字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | ✅ | 请求地址 |
| method | string | ✅ | 请求方法：`get`、`post`、`put`、`delete`、`patch` |
| headers | object | ❌ | 请求头 |

#### 示例

**GET请求**

```json
{
  "url": "https://api.openweathermap.org/data/2.5/weather",
  "method": "get",
  "headers": {
    "Accept": "application/json"
  }
}
```

**POST请求**

```json
{
  "url": "https://api.mailgun.net/v3/domain.com/messages",
  "method": "post",
  "headers": {
    "Authorization": "Basic base64_credentials",
    "Content-Type": "application/json"
  }
}
```

**带认证的请求**

```json
{
  "url": "https://api.example.com/data",
  "method": "get",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY",
    "X-Custom-Header": "custom-value"
  }
}
```

---

### 函数类型

用于调用内置函数。

#### 内置函数列表

| 函数名 | 说明 | 参数 | 返回值 |
|--------|------|------|--------|
| `get_time` | 获取当前时间 | 无 | `{"time": "2026/5/6 23:33:02"}` |
| `get_date` | 获取当前日期 | 无 | `{"date": "2026-05-06"}` |
| `echo` | 回显输入 | 任意参数 | `{"echo": 输入参数}` |
| `random` | 生成随机数 | 无 | `{"random": 0.123456}` |

#### 配置字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| functionName | string | ❌ | 内置函数名，默认使用技能标识 |

#### 示例

```json
{}
```

或

```json
{
  "functionName": "get_time"
}
```

---

### 数据库类型

用于执行数据库查询。

#### 配置字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | ✅ | SQL查询语句，使用 `:参数名` 作为占位符 |
| connection | object | ✅ | 数据库连接配置 |

#### 连接配置字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| host | string | ✅ | 数据库主机 |
| port | number | ✅ | 数据库端口 |
| database | string | ✅ | 数据库名 |
| user | string | ✅ | 用户名 |
| password | string | ✅ | 密码 |

#### 示例

```json
{
  "query": "SELECT * FROM users WHERE name = :name AND status = :status",
  "connection": {
    "host": "localhost",
    "port": 3306,
    "database": "mydb",
    "user": "root",
    "password": "password"
  }
}
```

---

### RPC类型

用于远程过程调用（预留，暂未实现）。

---

## 完整示例

### 示例1：查询天气

| 字段 | 值 |
|------|-----|
| 名称 | 查询天气 |
| 标识 | get_weather |
| 描述 | 获取指定城市的当前天气信息，包括温度、湿度、天气状况等 |
| 类型 | http |
| 参数描述 | `{"city": {"type": "string", "description": "城市名称，如：北京、上海、广州"}}` |
| 执行配置 | `{"url": "https://api.openweathermap.org/data/2.5/weather", "method": "get", "headers": {"Accept": "application/json"}}` |

---

### 示例2：获取当前时间

| 字段 | 值 |
|------|-----|
| 名称 | 获取当前时间 |
| 标识 | get_time |
| 描述 | 获取当前的日期和时间 |
| 类型 | function |
| 参数描述 | `{}` |
| 执行配置 | `{}` |

---

### 示例3：发送邮件

| 字段 | 值 |
|------|-----|
| 名称 | 发送邮件 |
| 标识 | send_email |
| 描述 | 发送邮件给指定收件人 |
| 类型 | http |
| 参数描述 | `{"to": {"type": "string", "description": "收件人邮箱地址"}, "subject": {"type": "string", "description": "邮件主题"}, "body": {"type": "string", "description": "邮件正文内容"}}` |
| 执行配置 | `{"url": "https://api.mailgun.net/v3/domain.com/messages", "method": "post", "headers": {"Authorization": "Basic base64_credentials", "Content-Type": "application/json"}}` |

---

### 示例4：查询数据库

| 字段 | 值 |
|------|-----|
| 名称 | 查询用户信息 |
| 标识 | query_users |
| 描述 | 根据条件查询用户信息 |
| 类型 | database |
| 参数描述 | `{"name": {"type": "string", "description": "用户姓名"}, "status": {"type": "string", "description": "用户状态：active、inactive"}}` |
| 执行配置 | `{"query": "SELECT * FROM users WHERE name = :name AND status = :status", "connection": {"host": "localhost", "port": 3306, "database": "mydb", "user": "root", "password": "password"}}` |

---

## 智能体调用流程

```
用户问题
    ↓
LLM分析问题，判断是否需要调用技能
    ↓
需要调用 → 根据参数描述生成调用参数
    ↓
执行配置定义的HTTP请求/函数/数据库查询
    ↓
返回执行结果
    ↓
LLM根据结果生成自然语言回答
```

### 调用示例

**用户问题**：北京今天天气怎么样？

**LLM处理流程**：

1. 分析问题，判断需要调用 `get_weather` 技能
2. 根据参数描述，生成参数：`{"city": "北京"}`
3. 执行HTTP请求：`GET https://api.openweathermap.org/data/2.5/weather?city=北京`
4. 获取返回结果：`{"temp": 25, "humidity": 60, "weather": "晴"}`
5. 生成自然语言回答：北京今天天气晴朗，气温25度，湿度60%。

---

## 最佳实践

### 1. 描述要清晰

❌ 不好的描述：
```
获取天气
```

✅ 好的描述：
```
获取指定城市的当前天气信息，包括温度、湿度、天气状况、风速等详细信息
```

### 2. 参数描述要具体

❌ 不好的参数描述：
```json
{
  "city": {
    "type": "string",
    "description": "城市"
  }
}
```

✅ 好的参数描述：
```json
{
  "city": {
    "type": "string",
    "description": "城市名称，支持中文城市名或城市拼音，如：北京、上海、guangzhou"
  }
}
```

### 3. 合理设置超时时间

- HTTP请求：建议10-30秒
- 数据库查询：建议5-10秒
- 函数调用：建议1-5秒

### 4. 安全注意事项

- 敏感信息（API密钥、数据库密码）建议通过环境变量配置
- 不要在前端暴露敏感配置
- 数据库查询建议使用只读权限的账号

---

## 常见问题

### Q: 为什么LLM没有调用技能？

A: 可能的原因：
1. 描述不够清晰，LLM无法理解技能用途
2. 技能未启用
3. 智能体未绑定该技能
4. 系统提示词中没有包含技能描述

### Q: 为什么技能调用失败？

A: 可能的原因：
1. 执行配置错误（URL错误、认证失败等）
2. 参数格式不正确
3. 超时时间过短
4. 目标服务不可用

### Q: 如何调试技能？

A: 建议：
1. 先单独测试HTTP接口/函数/数据库查询
2. 检查参数是否正确传递
3. 查看服务端日志获取详细错误信息
