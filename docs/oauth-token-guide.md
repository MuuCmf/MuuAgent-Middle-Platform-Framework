# OAuth Token 使用指南

## 概述

MuuAgent 中台支持 OAuth 2.0 授权码模式，允许三方应用获取访问令牌（Access Token）来调用管理端接口。本指南详细介绍如何创建 OAuth 客户端、获取 Token 以及使用 Token 进行接口调用。

## OAuth 架构

### 认证流程

```
三方应用                    MuuAgent 中台
    │                            │
    ├─ 1. 创建 OAuth 客户端 ──────►│
    │                            │
    ├─ 2. 获取授权码 ────────────►│
    │                            │
    ├─ 3. 换取 Access Token ─────►│
    │                            │
    ├─ 4. 调用受保护接口 ────────►│
    │                            │
    └─ 5. 刷新 Token（过期时）───►│
```

### 术语说明

| 术语 | 说明 |
|------|------|
| **Client ID** | 客户端唯一标识，创建客户端时自动生成 |
| **Client Secret** | 客户端密钥，创建时生成，仅返回一次 |
| **Authorization Code** | 授权码，用于换取 Token，有效期 10 分钟 |
| **Access Token** | 访问令牌，用于 API 调用，有效期 2 小时 |
| **Refresh Token** | 刷新令牌，用于获取新的 Access Token，有效期 7 天 |
| **Scope** | 权限范围，定义客户端可访问的资源 |

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
   - **回调地址**：授权后的重定向地址（可填多个）
   - **权限范围**：选择需要的权限
   - **授权类型**：默认 `authorization_code` 和 `refresh_token`
   - **所属应用**：关联的应用（可选）

5. 点击「保存」

#### 通过 API

```bash
curl -X POST https://api.yourdomain.com/admin/oauth/clients \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的第三方应用",
    "redirectUris": ["https://example.com/callback"],
    "scopes": ["model:read", "agent:read"],
    "grants": ["authorization_code", "refresh_token"],
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
    "redirectUris": ["https://example.com/callback"],
    "scopes": ["model:read", "agent:read"],
    "grants": ["authorization_code", "refresh_token"],
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

## 第二步：获取授权码

### 授权端点

```
GET /oauth/authorize
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `client_id` | string | 是 | 客户端 ID |
| `redirect_uri` | string | 是 | 回调地址（必须与注册时一致） |
| `response_type` | string | 是 | 固定值 `code` |
| `scope` | string | 是 | 权限范围，空格分隔 |
| `state` | string | 否 | 状态参数，用于防止 CSRF |

### 请求示例

```bash
curl "https://api.yourdomain.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=https://example.com/callback&response_type=code&scope=model:read%20agent:read&state=random123"
```

### 响应示例

```json
{
  "client_name": "我的第三方应用",
  "scope": "model:read agent:read",
  "scope_details": [
    { "scope": "model:read", "description": "查看模型列表和详情" },
    { "scope": "agent:read", "description": "查看智能体列表和详情" }
  ],
  "state": "random123",
  "redirect_uri": "https://example.com/callback"
}
```

### 用户确认授权

管理员需要确认授权才能生成授权码：

```bash
curl -X POST https://api.yourdomain.com/oauth/authorize/confirm \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR_CLIENT_ID",
    "redirectUri": "https://example.com/callback",
    "scope": "model:read agent:read",
    "state": "random123"
  }'
```

### 授权码响应

```json
{
  "code": "abc123def456...",
  "state": "random123"
}
```

**授权码有效期：10 分钟**

---

## 第三步：换取 Access Token

### 令牌端点

```
POST /oauth/token
```

### 请求参数（授权码模式）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `grant_type` | string | 是 | 固定值 `authorization_code` |
| `code` | string | 是 | 授权码 |
| `client_id` | string | 是 | 客户端 ID |
| `client_secret` | string | 是 | 客户端密钥 |
| `redirect_uri` | string | 是 | 回调地址（必须与授权时一致） |

### 请求示例

```bash
curl -X POST https://api.yourdomain.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=abc123def456...&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=https://example.com/callback"
```

### Token 响应

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "abc123def456...",
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

## 第四步：使用 Access Token 调用接口

### 请求格式

在请求头中携带 Access Token：

```bash
curl -X GET https://api.yourdomain.com/admin/model \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

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

Token 只能访问授权时指定的 scope：

| Scope | 可访问的接口 |
|-------|-------------|
| `model:read` | GET /admin/model |
| `model:write` | POST/PUT/DELETE /admin/model |
| `agent:read` | GET /admin/agent |
| `agent:write` | POST/PUT/DELETE /admin/agent |
| `oauth:read` | GET /admin/oauth/clients |
| `oauth:write` | POST/PUT/DELETE /admin/oauth/clients |

**权限继承：** `write` 权限自动包含 `read` 权限

---

## 第五步：刷新 Access Token

当 Access Token 过期（HTTP 401 错误）时，使用 Refresh Token 获取新的 Token。

### 请求参数（刷新模式）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `grant_type` | string | 是 | 固定值 `refresh_token` |
| `refresh_token` | string | 是 | 刷新令牌 |
| `client_id` | string | 是 | 客户端 ID |
| `client_secret` | string | 是 | 客户端密钥 |

### 请求示例

```bash
curl -X POST https://api.yourdomain.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=abc123def456...&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### 响应示例

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

## 撤销令牌

### 撤销访问令牌或刷新令牌

```bash
curl -X POST https://api.yourdomain.com/oauth/revoke \
  -H "Content-Type: application/json" \
  -d '{ "token": "YOUR_TOKEN" }'
```

### 响应

```json
{ "message": "令牌已撤销" }
```

---

## 权限范围（Scope）列表

### 应用管理

| Scope | 描述 |
|-------|------|
| `app:read` | 查看应用列表和详情 |
| `app:write` | 创建、更新、删除应用 |

### 模型管理

| Scope | 描述 |
|-------|------|
| `model:read` | 查看模型列表和详情 |
| `model:write` | 创建、更新、删除模型 |

### 智能体

| Scope | 描述 |
|-------|------|
| `agent:read` | 查看智能体列表和详情 |
| `agent:write` | 创建、更新、删除智能体 |

### 技能

| Scope | 描述 |
|-------|------|
| `skill:read` | 查看技能列表和详情 |
| `skill:write` | 创建、更新、删除技能 |
| `skill:execute` | 执行技能和测试函数 |

### 知识库

| Scope | 描述 |
|-------|------|
| `kb:read` | 查看知识库列表和详情 |
| `kb:write` | 创建、更新、删除知识库 |

### OAuth

| Scope | 描述 |
|-------|------|
| `oauth:read` | 查看 OAuth 客户端和令牌 |
| `oauth:write` | 管理 OAuth 客户端和令牌 |

### 限流

| Scope | 描述 |
|-------|------|
| `rate-limit:read` | 查看限流规则和统计 |
| `rate-limit:write` | 管理限流规则 |

### 日志

| Scope | 描述 |
|-------|------|
| `log:read` | 查看操作日志和统计 |

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

### 4. 回调地址验证

- ✅ 注册时使用精确的回调地址
- ✅ 避免使用通配符地址
- ✅ 验证回调地址是否匹配

---

## 完整流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OAuth 2.0 授权码流程                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. 创建客户端                                                         │
│     POST /admin/oauth/clients                                         │
│     ↓                                                                 │
│  2. 获取授权码（用户确认）                                             │
│     GET  /oauth/authorize                                             │
│     POST /oauth/authorize/confirm                                     │
│     ↓                                                                 │
│  3. 换取 Token                                                        │
│     POST /oauth/token?grant_type=authorization_code                   │
│     ↓                                                                 │
│  4. 调用受保护接口                                                     │
│     GET /admin/model                                                  │
│     Headers: Authorization: Bearer <access_token>                     │
│     ↓                                                                 │
│  5. Token 过期 → 刷新 Token                                           │
│     POST /oauth/token?grant_type=refresh_token                        │
│     ↓                                                                 │
│  6. 撤销 Token（可选）                                                 │
│     POST /oauth/revoke                                                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 相关文档

- [管理端鉴权文档](./admin-authentication.md)
- [API 调用示例](./api-examples.md)
- [生产部署文档](./production-deployment.md)

## 更新日志

- **2026-05-25**：初始版本，实现 OAuth 2.0 授权码模式使用指南