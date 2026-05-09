# 技能管理配置文档

## 概述

技能是智能体可以调用的工具，用于执行特定任务。本文档详细说明技能管理中各字段的填写规范和使用方法。

---

## 技能类型

系统支持以下五种技能类型：

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `http` | HTTP请求 | 调用外部API接口 |
| `function` | 函数技能 | 内置函数、插件函数、自定义代码 |
| `database` | 数据库查询 | 执行SQL查询 |
| `mcp` | MCP工具 | 调用MCP Server的工具 |
| `rpc` | 远程过程调用 | 预留类型，暂未实现 |

---

## 字段说明

### 基本信息

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 名称 | string | ✅ | 技能的显示名称，如"查询天气" |
| 标识 | string | ✅ | 技能的唯一标识符，如"get_weather"，用于代码中引用 |
| 描述 | string | ✅ | 功能描述，**供LLM理解技能用途**，用于智能体自动判断是否调用 |
| 类型 | enum | ✅ | 技能类型：`http`、`function`、`database`、`mcp` |
| 参数描述 | JSON | ✅ | 定义技能需要的参数，**供LLM生成正确的调用参数** |
| 执行配置 | JSON | ✅ | 定义技能的具体执行方式 |
| 状态 | boolean | ❌ | 是否启用，默认true |
| 超时时间 | number | ❌ | 执行超时时间（毫秒），默认30000 |

### 函数技能专用字段

当技能类型为 `function` 时，需要额外配置以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| 函数类型 | enum | `builtin`（内置函数）、`plugin`（插件函数）、`sandbox`（自定义代码） |
| 插件名称 | string | 插件函数专用，选择已安装的插件 |
| 函数名称 | string | 内置函数或插件函数的名称 |
| 代码内容 | text | 自定义代码专用，JavaScript代码 |

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
| url | string | ✅ | 请求地址，支持参数占位符 `{参数名}` |
| method | string | ✅ | 请求方法：`get`、`post`、`put`、`delete`、`patch` |
| headers | object | ❌ | 请求头 |

#### 示例

**GET请求**

```json
{
  "url": "https://api.openweathermap.org/data/2.5/weather?city={city}",
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

函数技能支持三种执行方式：内置函数、插件函数、自定义代码。

#### 1. 内置函数 (builtin)

系统内置了以下函数，可直接使用：

| 函数名 | 说明 | 参数 | 返回值 |
|--------|------|------|--------|
| `get_time` | 获取当前时间 | 无 | `{"time": "2026/5/6 23:33:02", "timestamp": 1715003582000}` |
| `get_date` | 获取当前日期 | 无 | `{"date": "2026-05-06", "year": 2026, "month": 5, "day": 6}` |
| `echo` | 回显输入 | `value`: 任意值 | `{"echo": 输入参数}` |
| `random` | 生成随机数 | `min`: 最小值(默认0), `max`: 最大值(默认100) | `{"random": 42, "range": {"min": 0, "max": 100}}` |
| `uuid` | 生成UUID | 无 | `{"uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}` |
| `base64_encode` | Base64编码 | `text`: 要编码的文本 | `{"encoded": "SGVsbG8gV29ybGQ="}` |
| `base64_decode` | Base64解码 | `encoded`: Base64字符串 | `{"decoded": "Hello World"}` |
| `json_parse` | JSON解析 | `text`: JSON字符串 | `{"parsed": {...}}` |
| `json_stringify` | JSON序列化 | `object`: 要序列化的对象 | `{"stringified": "{...}"}` |

**配置示例：**

选择内置函数后，系统会自动填充函数名称，无需额外配置。

#### 2. 插件函数 (plugin)

插件是可扩展的函数模块，需要先安装插件后才能使用。

**配置步骤：**
1. 选择函数类型为"插件函数"
2. 从下拉列表选择已安装的插件
3. 选择要使用的函数

**配置示例：**

```json
{
  "pluginName": "weather-plugin",
  "functionName": "get_weather"
}
```

#### 3. 自定义代码 (sandbox)

支持编写JavaScript代码在沙箱环境中执行。

**代码规范：**
- 代码必须导出一个 `main` 函数
- `main` 函数接收 `params` 参数（调用时传入的参数）
- 返回值将作为执行结果

**代码示例：**

```javascript
/**
 * 自定义函数示例：计算器
 * @param {Object} params - 调用参数
 * @returns {Object} 计算结果
 */
function main(params) {
  const { operation, a, b } = params;
  
  let result;
  switch (operation) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      result = b !== 0 ? a / b : null;
      break;
    default:
      throw new Error('不支持的操作: ' + operation);
  }
  
  return {
    operation,
    a,
    b,
    result
  };
}
```

**沙箱限制：**
- 执行超时时间：默认5秒，最长可配置30秒
- 不支持访问文件系统
- 不支持网络请求
- 不支持使用外部模块

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

### MCP类型

用于调用MCP (Model Context Protocol) Server的工具。

#### 配置字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | ✅ | MCP Server地址 |
| apiKey | string | ❌ | API密钥（如果需要） |
| toolName | string | ✅ | 要调用的工具名称 |

#### 示例

```json
{
  "url": "http://localhost:8080/mcp",
  "apiKey": "your-api-key",
  "toolName": "get_weather"
}
```

---

## 完整示例

### 示例1：查询天气（HTTP类型）

| 字段 | 值 |
|------|-----|
| 名称 | 查询天气 |
| 标识 | get_weather |
| 描述 | 获取指定城市的当前天气信息，包括温度、湿度、天气状况等 |
| 类型 | http |
| 参数描述 | `{"city": {"type": "string", "description": "城市名称，如：北京、上海、广州"}}` |
| 执行配置 | `{"url": "https://api.openweathermap.org/data/2.5/weather?city={city}", "method": "get", "headers": {"Accept": "application/json"}}` |

---

### 示例2：获取当前时间（内置函数）

| 字段 | 值 |
|------|-----|
| 名称 | 获取当前时间 |
| 标识 | get_time |
| 描述 | 获取当前的日期和时间 |
| 类型 | function |
| 函数类型 | builtin |
| 函数名称 | get_time |
| 参数描述 | `{}` |
| 执行配置 | `{}` |

---

### 示例3：生成随机数（内置函数）

| 字段 | 值 |
|------|-----|
| 名称 | 生成随机数 |
| 标识 | random_number |
| 描述 | 生成指定范围内的随机整数 |
| 类型 | function |
| 函数类型 | builtin |
| 函数名称 | random |
| 参数描述 | `{"min": {"type": "number", "description": "最小值，默认0"}, "max": {"type": "number", "description": "最大值，默认100"}}` |
| 执行配置 | `{}` |

---

### 示例4：自定义计算器（沙箱代码）

| 字段 | 值 |
|------|-----|
| 名称 | 计算器 |
| 标识 | calculator |
| 描述 | 执行基本的数学运算：加、减、乘、除 |
| 类型 | function |
| 函数类型 | sandbox |
| 参数描述 | `{"operation": {"type": "string", "description": "操作类型：add、subtract、multiply、divide"}, "a": {"type": "number", "description": "第一个操作数"}, "b": {"type": "number", "description": "第二个操作数"}}` |
| 代码内容 | 见上方自定义代码示例 |

---

### 示例5：发送邮件（HTTP类型）

| 字段 | 值 |
|------|-----|
| 名称 | 发送邮件 |
| 标识 | send_email |
| 描述 | 发送邮件给指定收件人 |
| 类型 | http |
| 参数描述 | `{"to": {"type": "string", "description": "收件人邮箱地址"}, "subject": {"type": "string", "description": "邮件主题"}, "body": {"type": "string", "description": "邮件正文内容"}}` |
| 执行配置 | `{"url": "https://api.mailgun.net/v3/domain.com/messages", "method": "post", "headers": {"Authorization": "Basic base64_credentials", "Content-Type": "application/json"}}` |

---

### 示例6：查询数据库（数据库类型）

| 字段 | 值 |
|------|-----|
| 名称 | 查询用户信息 |
| 标识 | query_users |
| 描述 | 根据条件查询用户信息 |
| 类型 | database |
| 参数描述 | `{"name": {"type": "string", "description": "用户姓名"}, "status": {"type": "string", "description": "用户状态：active、inactive"}}` |
| 执行配置 | `{"query": "SELECT * FROM users WHERE name = :name AND status = :status", "connection": {"host": "localhost", "port": 3306, "database": "mydb", "user": "root", "password": "password"}}` |

---

### 示例7：MCP工具调用

| 字段 | 值 |
|------|-----|
| 名称 | 文件操作 |
| 标识 | file_operations |
| 描述 | 通过MCP Server执行文件读写操作 |
| 类型 | mcp |
| 参数描述 | `{"path": {"type": "string", "description": "文件路径"}, "content": {"type": "string", "description": "文件内容（写入时需要）"}}` |
| 执行配置 | `{"url": "http://localhost:8080/mcp", "toolName": "file_write"}` |

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
- MCP调用：建议10-30秒

### 4. 安全注意事项

- 敏感信息（API密钥、数据库密码）建议通过环境变量配置
- 不要在前端暴露敏感配置
- 数据库查询建议使用只读权限的账号
- 沙箱代码不支持访问文件系统和网络

### 5. 函数类型选择建议

| 场景 | 推荐类型 |
|------|----------|
| 简单的数据处理 | 内置函数 |
| 需要特定功能扩展 | 插件函数 |
| 复杂的业务逻辑 | 自定义代码 |
| 调用外部API | HTTP类型 |

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
5. 沙箱代码语法错误

### Q: 如何调试技能？

A: 建议：
1. 先单独测试HTTP接口/函数/数据库查询
2. 检查参数是否正确传递
3. 查看服务端日志获取详细错误信息
4. 使用沙箱代码的"代码分析"和"测试代码"功能

### Q: 内置函数和插件函数的区别？

A: 
- **内置函数**：系统预置的函数，无需安装，直接可用
- **插件函数**：需要先安装插件，支持扩展更多功能

### Q: 沙箱代码有什么限制？

A: 
- 不支持访问文件系统
- 不支持网络请求
- 不支持使用外部模块（如require、import）
- 执行时间有限制（默认5秒）

---

## 技能调用日志

每次技能调用都会记录日志，包含以下信息：

| 字段 | 说明 |
|------|------|
| skillCode | 技能标识 |
| request | 请求数据（JSON格式） |
| response | 响应数据（JSON格式） |
| costMs | 执行耗时（毫秒） |
| success | 是否成功 |
| errorMessage | 错误信息（如果失败） |

可以在"日志管理 > 技能日志"中查看调用历史，用于调试和分析。
