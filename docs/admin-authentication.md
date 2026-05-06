# Web 管理端鉴权使用文档

## 概述

AI 中台管理端采用 **JWT（JSON Web Token）** 鉴权方案，实现管理员登录和权限控制。管理端接口与业务接口完全隔离，使用不同的鉴权机制。

## 鉴权架构

### 双层鉴权体系

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx 反向代理                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  管理端接口 (/admin/**)      业务接口 (/api/**)        │
│  ├─ JWT Token 鉴权           ├─ API Key 鉴权          │
│  ├─ 管理员登录                ├─ AI 调用              │
│  ├─ 模型管理                  ├─ Agent 调用           │
│  ├─ MCP 配置                  └─ 流式对话             │
│  ├─ 技能管理                                          │
│  └─ 日志查询                                          │
│                                                         │
│  高危接口 (/api/system/**)                             │
│  └─ 仅内网访问                                         │
└─────────────────────────────────────────────────────────┘
```

### 路由划分

| 路由前缀 | 鉴权方式 | 访问范围 | 说明 |
|---------|---------|---------|------|
| `/admin/**` | JWT Token | 公网（需登录） | 管理端接口 |
| `/api/ai/**` | API Key | 公网 | AI 调用接口 |
| `/api/agent/**` | API Key | 公网 | Agent 调用接口 |
| `/api/system/**` | 内网白名单 | 仅内网 | 高危系统接口 |

## 管理员账号管理

### 初始化管理员账号

项目首次部署时，需要初始化管理员账号：

```bash
cd service
npm run init:admin
```

**默认账号信息：**
- 账号：`admin`
- 密码：`admin123`
- 角色：`admin`（超级管理员）

**⚠️ 重要：登录后请立即修改默认密码！**

### 管理员角色

| 角色 | 权限说明 |
|------|---------|
| `admin` | 超级管理员，拥有所有权限 |
| `ops` | 运维管理员，可管理模型和配置 |
| `read` | 只读权限，仅可查看数据 |

### 创建新管理员

```bash
# 登录管理后台后，通过界面创建
# 或使用 API 创建

curl -X POST https://api.yourdomain.com/admin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newadmin",
    "password": "password123",
    "nickname": "新管理员",
    "role": "ops"
  }'
```

## 登录流程

### 1. 前端登录

访问管理后台登录页面：

```
https://yourdomain.com/login
```

输入账号密码后，系统会返回 JWT Token：

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "uuid",
      "username": "admin",
      "nickname": "超级管理员",
      "role": "admin"
    }
  }
}
```

### 2. Token 存储

前端将 Token 存储在 `localStorage`：

```javascript
localStorage.setItem('admin_token', token)
localStorage.setItem('admin_user', JSON.stringify(admin))
```

### 3. 请求携带 Token

后续请求在 `Authorization` 头中携带 Token：

```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

### 4. Token 过期处理

Token 默认有效期为 **2 小时**。过期后需要重新登录。

前端拦截器会自动处理 401 错误，跳转到登录页面。

## API 调用示例

### 登录接口

```bash
curl -X POST https://api.yourdomain.com/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

### 获取当前管理员信息

```bash
curl -X GET https://api.yourdomain.com/admin/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 获取模型列表

```bash
curl -X GET https://api.yourdomain.com/admin/model \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 创建模型

```bash
curl -X POST https://api.yourdomain.com/admin/model \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPT-4",
    "code": "gpt-4",
    "type": "llm",
    "provider": "openai",
    "endpoint": "https://api.openai.com/v1",
    "apiKey": "sk-xxx"
  }'
```

## 前端集成

### 请求拦截器

```typescript
// src/utils/request.ts
service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  }
)
```

### 响应拦截器

```typescript
// src/utils/request.ts
service.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      router.push('/login')
    }
    return Promise.reject(error)
  }
)
```

### 路由守卫

```typescript
// src/router/index.ts
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')
  
  if (to.meta.requiresAuth !== false && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})
```

## 安全建议

### 1. 密码安全

- ✅ 使用强密码（至少 8 位，包含大小写字母、数字、特殊字符）
- ✅ 定期更换密码
- ✅ 不要使用默认密码
- ✅ 密码使用 BCrypt 加密存储

### 2. Token 安全

- ✅ Token 存储在 localStorage（生产环境建议使用 HttpOnly Cookie）
- ✅ Token 有效期不宜过长（默认 2 小时）
- ✅ 实现 Token 刷新机制（可选）
- ✅ 退出登录时清除 Token

### 3. 传输安全

- ✅ 强制使用 HTTPS
- ✅ 启用 HSTS
- ✅ 使用安全的加密套件

### 4. 访问控制

- ✅ 管理后台不要暴露在根路径
- ✅ 实现登录失败次数限制
- ✅ 记录登录日志和操作日志
- ✅ 高危操作需要二次确认

### 5. Nginx 加固

```nginx
# 限流配置
limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=5r/s;

location /admin/ {
    # 限流保护
    limit_req zone=admin_limit burst=10 nodelay;
    
    # 其他配置...
}
```

## 常见问题

### Q: Token 过期了怎么办？

A: Token 过期后，前端会自动跳转到登录页面，重新登录即可。

### Q: 如何修改密码？

A: 登录管理后台后，在个人设置中修改密码。或使用 API：

```bash
curl -X POST https://api.yourdomain.com/admin/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "oldPassword": "oldpass",
    "newPassword": "newpass"
  }'
```

### Q: 如何禁用管理员账号？

A: 超级管理员可以在管理员列表中禁用其他账号：

```bash
curl -X PATCH https://api.yourdomain.com/admin/{id}/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{ "status": 0 }'
```

### Q: 如何查看登录日志？

A: 管理员登录日志记录在数据库中，可以通过日志查询接口查看。

### Q: 忘记密码怎么办？

A: 联系超级管理员重置密码，或直接修改数据库中的密码字段（需要 BCrypt 加密）。

## 相关文档

- [Nginx 鉴权配置](./nginx-authentication.md)
- [API 调用示例](./api-examples.md)
- [生产部署文档](./production-deployment.md)
- [环境变量配置](../service/ENV.md)

## 技术实现

### 后端实现

- **管理员表**：`AdminUser`（Prisma 模型）
- **鉴权守卫**：`AdminGuard`（JWT 验证）
- **登录服务**：`AdminService`（密码验证、Token 生成）
- **Token 有效期**：2 小时（可配置）

### 前端实现

- **登录页面**：`/login`
- **Token 存储**：`localStorage`
- **请求拦截**：自动添加 Authorization 头
- **路由守卫**：未登录跳转到登录页

## 更新日志

- **2026-05-05**：初始版本，实现 JWT 鉴权方案
