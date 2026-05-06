# 环境变量配置说明

本文档详细说明了 AI 中台服务的环境变量配置。

## 配置文件

项目包含以下环境配置文件：

- `.env.example` - 配置模板文件（提交到 Git）
- `.env` - 开发环境配置（不提交到 Git）
- `.env.production` - 生产环境配置（不提交到 Git）

## 快速开始

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置
vim .env
```

## 环境变量说明

### 数据库配置

#### DATABASE_URL

数据库连接字符串。

**开发环境（SQLite）：**
```env
DATABASE_URL="file:./dev.db"
```

**生产环境（MySQL）：**
```env
DATABASE_URL="mysql://user:password@localhost:3306/muu_ai_platform?connection_limit=10&pool_timeout=30"
```

**参数说明：**
- `connection_limit`: 连接池大小，默认 10
- `pool_timeout`: 连接池超时时间（秒），默认 30

### 服务配置

#### PORT

服务监听端口。

```env
PORT=3002
```

**默认值：** 3002

#### NODE_ENV

Node.js 运行环境。

```env
NODE_ENV=development
```

**可选值：**
- `development` - 开发环境
- `production` - 生产环境
- `test` - 测试环境

### 安全配置

#### API_KEY

API 鉴权密钥，用于验证 API 请求。

```env
API_KEY="your-api-key"
```

**生成方法：**
```bash
openssl rand -base64 32
```

**重要：** 生产环境必须使用强密钥！

#### JWT_SECRET

JWT Token 签名密钥。

```env
JWT_SECRET="your-jwt-secret"
```

**生成方法：**
```bash
openssl rand -base64 64
```

**重要：** 生产环境必须使用强密钥！

### Redis 配置

#### REDIS_URL

Redis 连接地址，用于限流和缓存。

```env
REDIS_URL="redis://localhost:6379"
```

**说明：**
- 如果不配置 Redis，限流功能将使用内存存储
- 生产环境强烈建议使用 Redis

#### REDIS_PASSWORD

Redis 密码（如果有）。

```env
REDIS_PASSWORD="your-redis-password"
```

### 日志配置

#### LOG_LEVEL

日志输出级别。

```env
LOG_LEVEL="info"
```

**可选值：**
- `error` - 仅错误
- `warn` - 警告和错误
- `info` - 信息、警告和错误（推荐）
- `debug` - 调试信息
- `verbose` - 详细日志

**建议：**
- 开发环境：`info` 或 `debug`
- 生产环境：`warn` 或 `error`

### 限流配置

#### RATE_LIMIT_WINDOW_MS

限流时间窗口（毫秒）。

```env
RATE_LIMIT_WINDOW_MS=60000
```

**默认值：** 60000（1 分钟）

#### RATE_LIMIT_MAX_REQUESTS

时间窗口内允许的最大请求数。

```env
RATE_LIMIT_MAX_REQUESTS=100
```

**默认值：** 100

**说明：** 超过限制的请求将返回 429 状态码

### 熔断器配置

#### CIRCUIT_BREAKER_TIMEOUT

熔断器超时时间（毫秒）。

```env
CIRCUIT_BREAKER_TIMEOUT=60000
```

**默认值：** 60000（1 分钟）

**说明：** 熔断器打开后，等待多久尝试恢复

#### CIRCUIT_BREAKER_ERROR_THRESHOLD

触发熔断的错误次数阈值。

```env
CIRCUIT_BREAKER_ERROR_THRESHOLD=5
```

**默认值：** 5

**说明：** 连续失败多少次后触发熔断

#### CIRCUIT_BREAKER_SUCCESS_THRESHOLD

恢复熔断的成功次数阈值。

```env
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3
```

**默认值：** 3

**说明：** 半开状态下连续成功多少次后关闭熔断

### 并发控制

#### MAX_CONCURRENT_REQUESTS

最大并发请求数。

```env
MAX_CONCURRENT_REQUESTS=100
```

**默认值：** 100

**说明：** 超过限制的请求将排队等待

### 开发工具配置

#### ENABLE_SWAGGER

是否启用 Swagger API 文档。

```env
ENABLE_SWAGGER=true
```

**默认值：** true

**说明：** 生产环境建议关闭

#### SWAGGER_PATH

Swagger 文档访问路径。

```env
SWAGGER_PATH="api-docs"
```

**默认值：** api-docs

**访问地址：** http://localhost:3002/api-docs

#### ENABLE_CORS

是否启用 CORS 跨域。

```env
ENABLE_CORS=true
```

**默认值：** true

#### CORS_ORIGINS

允许的跨域源（逗号分隔）。

```env
CORS_ORIGINS="http://localhost:3000,http://localhost:8080"
```

### 调试配置

#### DEBUG

是否启用调试模式。

```env
DEBUG=false
```

**默认值：** false

**说明：** 启用后将输出详细的调试信息

#### DEBUG_PORT

调试端口。

```env
DEBUG_PORT=9229
```

**默认值：** 9229

## 环境差异配置

### 开发环境

```env
NODE_ENV=development
DATABASE_URL="file:./dev.db"
LOG_LEVEL="info"
ENABLE_SWAGGER=true
DEBUG=false
```

### 生产环境

```env
NODE_ENV=production
DATABASE_URL="mysql://user:pass@host:3306/db"
LOG_LEVEL="warn"
ENABLE_SWAGGER=false
DEBUG=false
```

### 测试环境

```env
NODE_ENV=test
DATABASE_URL="file:./test.db"
LOG_LEVEL="error"
ENABLE_SWAGGER=false
DEBUG=false
```

## 安全建议

1. **密钥管理**
   - 生产环境必须使用强密钥
   - 不要将密钥提交到 Git
   - 定期更换密钥

2. **数据库安全**
   - 使用强密码
   - 限制数据库用户权限
   - 启用 SSL 连接

3. **网络安全**
   - 生产环境使用 HTTPS
   - 配置防火墙规则
   - 限制 CORS 源

## 常见问题

### Q: 如何生成安全的密钥？

```bash
# API Key
openssl rand -base64 32

# JWT Secret
openssl rand -base64 64
```

### Q: Redis 连接失败怎么办？

1. 检查 Redis 是否启动：`redis-cli ping`
2. 检查 REDIS_URL 配置是否正确
3. 如果不使用 Redis，可以注释掉 REDIS_URL

### Q: 数据库迁移失败怎么办？

1. 检查 DATABASE_URL 配置
2. 确保数据库已创建
3. 运行 `npx prisma migrate reset` 重置数据库

### Q: 如何查看当前配置？

```bash
# 查看环境变量
node -e "console.log(process.env)"

# 或在代码中
console.log(process.env);
```

## 相关文档

- [快速部署指南](../docs/quick-start.md)
- [生产部署文档](../docs/production-deployment.md)
- [服务 README](./README.md)
