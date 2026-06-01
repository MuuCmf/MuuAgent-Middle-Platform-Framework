# OAuth Token 使用指南

## 概述

MuuAgent 中台提供两套认证方式，分别对应两种接口类型：

| 认证方式 | 适用接口 | 说明 |
|---------|---------|------|
| **OAuth 2.0 客户端凭证模式** | 管理端接口 `/admin/*` | 通过 client_id + client_secret 获取 Token，调用各类管理接口 |
| **API Key 认证** | 业务端接口 `/agent` `/ai` `/kb` | 通过 API Key + 透传 UID 调用业务接口 |

本指南主要介绍 OAuth 客户端凭证模式的使用方法。

### 术语说明

| 术语 | 说明 |
|------|------|
| **Client ID** | 客户端唯一标识，创建客户端时自动生成 |
| **Client Secret** | 客户端密钥，创建时生成，仅返回一次 |
| **Access Token** | 访问令牌，用于 API 调用，有效期 2 小时 |
| **Refresh Token** | 刷新令牌，用于获取新的 Access Token，有效期 7 天 |
| **Scope** | 权限范围，定义客户端可访问的资源 |
| **API Key** | 租户 API 密钥，用于业务端接口认证 |

---

## 认证架构

### 管理端接口认证（OAuth 客户端凭证模式）

```
三方应用                      MuuAgent 中台
    │                              │
    ├─ 1. 创建 OAuth 客户端 ───────►│
    │                              │
    ├─ 2. POST /oauth/token ──────►│
    │   grant_type=client_credentials
    │   client_id + client_secret
    │                              │
    ├─ 3. 返回 access_token ──────►│
    │                              │
    ├─ 4. 调用 /admin/* 接口 ──────►│
    │   Authorization: Bearer <token>
    │                              │
    └─ 5. 刷新 Token（过期时）────►│
        POST /oauth/token
        grant_type=refresh_token
```

### 业务端接口认证（API Key）

```
三方应用                      MuuAgent 中台
    │                              │
    ├─ 调用 /agent /ai /kb 接口 ──►│
    │   x-api-key: <API Key>
    │   x-uid: <用户ID>
    │                              │
    └─ 返回业务数据 ──────────────►│
```

---

## 第一步：创建 OAuth 客户端

### 前置条件

- 已登录管理后台
- 拥有 `oauth:write` 权限

### 创建客户端

#### 通过管理后台

1. 登录管理后台
2. 进入「应用管理」→「OAuth 客户端」
3. 点击「创建客户端」按钮
4. 填写以下信息：
   - **名称**：客户端名称（用于标识）
   - **权限范围**：选择需要的权限
   - **授权类型**：默认 `client_credentials` 和 `refresh_token`
   - **所属应用**：关联的应用（可选）

5. 点击「保存」

#### 通过 API

```bash
curl -X POST https://api.yourdomain.com/admin/oauth/clients \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的第三方应用",
    "scopes": ["model:read", "agent:read"],
    "grants": ["client_credentials", "refresh_token"],
    "appCode": "myapp"
  }'
```

### 创建成功响应

```json
{
  "code": 200,
  "data": {
    "id": "1",
    "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "clientSecret": "7f8d9c2a3b4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    "name": "我的第三方应用",
    "scopes": ["model:read", "agent:read"],
    "grants": ["client_credentials", "refresh_token"],
    "appCode": "myapp",
    "status": 1
  },
  "message": "客户端创建成功"
}
```

**⚠️ 重要：** `clientSecret` 仅在创建时返回一次，请妥善保存！

### 重置客户端密钥

如果密钥泄露或遗忘，可以重置：

```bash
curl -X POST https://api.yourdomain.com/admin/oauth/clients/{id}/reset-secret \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

---

## 第二步：获取 Access Token（客户端凭证模式）

### 令牌端点

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `grant_type` | string | 是 | 固定值 `client_credentials` |
| `client_id` | string | 是 | 客户端 ID |
| `client_secret` | string | 是 | 客户端密钥 |

### 请求示例

```bash
curl -X POST https://api.yourdomain.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### Token 响应

```json
{
  "access_token": "base64url随机字符串...",
  "refresh_token": "base64url随机字符串...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "scope": "model:read agent:read"
}
```

### Token 有效期

| Token 类型 | 有效期 | 说明 |
|-----------|--------|------|
| `access_token` | 2 小时 | 用于 API 调用 |
| `refresh_token` | 7 天 | 用于刷新 Access Token |

---

## 第三步：使用 Access Token 调用管理端接口

### 请求格式

在请求头中携带 Access Token：

```bash
curl -X GET https://api.yourdomain.com/admin/model \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

OAuth Token 会自动关联到对应的 OAuthClient，服务端会根据 OAuthClient 的 `appCode` 进行数据隔离。**无需**额外传递 `x-app-code` 请求头。

### 完整示例

#### 获取模型列表

```bash
curl -X GET https://api.yourdomain.com/admin/model \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 获取智能体列表

```bash
curl -X GET https://api.yourdomain.com/admin/agent \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 权限验证

Token 只能访问创建客户端时指定的 scope：

| Scope | 可访问的接口 |
|-------|-------------|
| `model:read` | GET /admin/model |
| `model:write` | POST/PUT/DELETE /admin/model |
| `agent:read` | GET /admin/agent |
| `agent:write` | POST/PUT/DELETE /admin/agent |
| `oauth:read` | GET /admin/oauth/clients |
| `oauth:write` | POST/PUT/DELETE /admin/oauth/clients |
| `app:read` | GET /admin/app |
| `app:write` | POST/PUT/DELETE /admin/app |
| `kb:read` | GET /admin/kb |
| `kb:write` | POST/PUT/DELETE /admin/kb |
| `skill:read` | GET /admin/skill |
| `skill:write` | POST/PUT/DELETE /admin/skill |
| `skill:execute` | POST /admin/skill/execute |
| `log:read` | GET /admin/log |
| `rate-limit:read` | GET /admin/rate-limit |
| `rate-limit:write` | POST/PUT/DELETE /admin/rate-limit |

**权限继承：** `write` 权限自动包含 `read` 权限

---

## 第四步：刷新 Access Token

当 Access Token 过期（HTTP 401）时，使用 Refresh Token 获取新的 Token：

```bash
curl -X POST https://api.yourdomain.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### 响应

```json
{
  "access_token": "new-token-value...",
  "refresh_token": "new-refresh-token...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "scope": "model:read agent:read"
}
```

---

## 第五步：调用业务端接口

管理端接口用于管理配置（模型、应用、知识库等 CRUD），业务端接口用于实际的业务调用（AI 对话、智能体执行、知识库检索）。

### 认证方式

业务端接口使用 **API Key + 透传 UID** 认证：

| 请求头 | 说明 |
|--------|------|
| `x-api-key` | 中台 AppTenant 的 API Key |
| `x-uid` | 终端用户 ID，标识操作者 |

### 请求示例

```bash
curl -X POST https://api.yourdomain.com/agent/chat \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-uid: user_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": 1,
    "question": "你好"
  }'
```

完整业务端接口列表：

| 接口 | 说明 |
|------|------|
| `/agent/*` | 智能体对话、执行 |
| `/ai/*` | AI 模型调用 |
| `/kb/*` | 知识库检索 |

---

## 撤销令牌

撤销访问令牌或刷新令牌：

```bash
curl -X POST https://api.yourdomain.com/oauth/revoke \
  -H "Content-Type: application/json" \
  -d '{ "token": "YOUR_TOKEN" }'
```

响应：

```json
{ "message": "令牌已撤销" }
```

---

## PHP SDK 示例

中台提供了 PHP 客户端 SDK `MuuAgent`，封装了 OAuth Token 管理和接口调用逻辑。

### 配置

`.env` 文件：

```ini
[MUUAGENT]
muuagent.base_url = http://localhost:3000
muuagent.client_id = your_client_id
muuagent.client_secret = your_client_secret
muuagent.api_key = your_api_key
muuagent.app_code = muucmf_t6
```

### 调用管理端接口

```php
$agent = new MuuAgent();

// 获取模型列表
$models = $agent->callAdmin('GET', '/admin/model');

// 创建智能体
$agent->callAdmin('POST', '/admin/agent', [
    'name' => '客服助手',
    'description' => '智能客服',
]);
```

### 调用业务端接口

```php
$agent = new MuuAgent();

// AI 对话，传入终端用户 ID
$result = $agent->callApi('POST', '/agent/chat', [
    'agent_id' => 1,
    'question' => '你好',
], uid: 'user_12345');
```

SDK 自动处理 Token 的获取、缓存和刷新，开发者无需手动管理 Token 生命周期。

---

## 错误处理

### 常见错误码

| HTTP 状态码 | 错误类型 | 说明 |
|------------|---------|------|
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | Token 无效或过期 |
| 403 | Forbidden | 权限不足 |
| 404 | Not Found | 资源不存在 |

### 错误响应格式

```json
{
  "statusCode": 401,
  "message": "无效的认证令牌",
  "error": "Unauthorized"
}
```

---

## 安全建议

### 1. 密钥安全

- ✅ `clientSecret` 仅在创建时返回，妥善保存
- ✅ 不要在客户端代码中硬编码密钥
- ✅ 使用环境变量或密钥管理服务存储密钥
- ✅ 定期轮换密钥

### 2. Token 安全

- ✅ 使用 HTTPS 传输 Token
- ✅ Access Token 有效期较短（2小时）
- ✅ Refresh Token 妥善保管，不要泄露
- ✅ Token 过期后及时刷新

### 3. Scope 最小化

- ✅ 只申请必要的权限范围
- ✅ 定期审查权限配置
- ✅ 根据实际需求调整权限

### 4. API Key 安全

- ✅ API Key 对应中台 AppTenant，具有独立的配额限制
- ✅ 在服务端使用 API Key，不要暴露给客户端

---

## 完整流程图

```
┌───────────────────────────────────────────────────────┐
│             OAuth 客户端凭证模式流程                  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  1. 创建 OAuth 客户端                                  │
│     POST /admin/oauth/clients                        │
│     → 获取 client_id + client_secret                 │
│     ↓                                                │
│  2. 获取 Token                                        │
│     POST /oauth/token?grant_type=client_credentials   │
│     → 获取 access_token + refresh_token               │
│     ↓                                                │
│  3. 调用管理端接口                                     │
│     GET  /admin/model                                │
│     Headers: Authorization: Bearer <access_token>     │
│     ↓                                                │
│  4. Token 过期 → 刷新 Token                           │
│     POST /oauth/token?grant_type=refresh_token        │
│     ↓                                                │
│  5. 撤销 Token（可选）                                 │
│     POST /oauth/revoke                               │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 相关文档

- [管理端鉴权文档](./admin-authentication.md)
- [API 调用示例](./api-examples.md)
- [生产部署文档](./production-deployment.md)

## 更新日志

- **2026-06-01**：重构为客户端凭证模式，移除授权码模式，新增业务端 API Key 认证说明
- **2026-05-25**：初始版本